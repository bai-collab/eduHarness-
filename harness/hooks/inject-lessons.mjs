import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareReminder, recordTriggerEvent, OBSERVATION_DISABLED_ENV } from "../runtime/review-loop/reminder.mjs";

// 開工自動注入教訓（Codex 與 Claude 共用的 hook 腳本）。
// 只讀 brain/，不寫任何檔；屬參考注入（advisory）而非安全閘，任何錯誤都靜默不注入。
// 用法：node harness/hooks/inject-lessons.mjs <SessionStart|UserPromptSubmit>，hook payload 由 stdin 傳入。

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LESSON_DIRS = ["brain/error-log", "brain/knowledge"];
const INDEX_DIR = "brain/error-log";
const INDEX_CAP = 3500;
const MATCH_CAP = 2400;
const ITEM_CAP = 700;
const MAX_MATCHES = 3;
const MIN_SCORE = 2.5;
// 依優先順序挑段落：越前面越能直接照做。
// 注意：不能用 \b，它只認 ASCII 字詞邊界，「修正要求」後接換行時永遠比對不到。
const ACTION_HEADINGS = ["How to apply", "修正要求", "之後如何避免", "防護", "快速操作準則", "規則", "rules", "常見狀況與判讀", "判讀", "準則", "處置", "修正", "錯誤模式"];
const headingPattern = name => new RegExp(`^#{2,3}\\s*${name}(?=\\s|$|[：:（(])`, "iu");
const ASCII_STOPWORDS = new Set(["the", "and", "with", "for", "from", "into", "not", "md", "plan", "error", "log", "reference", "notes"]);

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { meta: {}, body: text };
  const meta = {};
  let listKey = null;
  for (const line of text.slice(3, end).split(/\r?\n/u)) {
    const item = line.match(/^\s+-\s+"?(.*?)"?\s*$/u);
    if (item && listKey) {
      meta[listKey].push(item[1]);
      continue;
    }
    const pair = line.match(/^([A-Za-z_]+):\s*(.*)$/u);
    if (!pair) continue;
    const [, key, raw] = pair;
    const value = raw.trim();
    if (value === "") {
      meta[key] = [];
      listKey = key;
    } else if (value.startsWith("[") && value.endsWith("]")) {
      meta[key] = value.slice(1, -1).split(",").map(part => part.trim().replace(/^["']|["']$/gu, "")).filter(Boolean);
      listKey = null;
    } else {
      meta[key] = value.replace(/^["']|["']$/gu, "");
      listKey = null;
    }
  }
  return { meta, body: text.slice(end + 4) };
}

function actionSection(body) {
  const lines = body.split(/\r?\n/u);
  let start = -1;
  for (const name of ACTION_HEADINGS) {
    const pattern = headingPattern(name);
    start = lines.findIndex(line => pattern.test(line));
    if (start >= 0) break;
  }
  if (start < 0) return "";
  const rest = lines.slice(start + 1);
  const stop = rest.findIndex(line => /^#{1,3}\s/u.test(line));
  return (stop < 0 ? rest : rest.slice(0, stop)).join("\n").trim();
}

function firstParagraph(body) {
  const afterTitle = body.replace(/^[\s\S]*?^#\s.*$/mu, "");
  const paragraph = afterTitle.split(/\r?\n\s*\r?\n/u).map(block => block.trim()).find(block => block && !block.startsWith("#"));
  return paragraph ?? "";
}

export function parseLesson(relativePath, text) {
  const { meta, body } = parseFrontmatter(text);
  const heading = body.match(/^#\s+(.+)$/mu)?.[1]?.trim();
  const title = heading || (typeof meta.description === "string" && meta.description) || (typeof meta.name === "string" && meta.name) || path.basename(relativePath, ".md");
  const rules = Array.isArray(meta.rules) && meta.rules.length ? meta.rules.map(rule => `- ${rule}`).join("\n") : "";
  const lesson = rules || actionSection(body) || (typeof meta.description === "string" ? meta.description : "") || firstParagraph(body);
  const triggers = Array.isArray(meta.triggers) ? meta.triggers : [];
  // 全文只拿來估「這個詞有多常見」，不拿來決定命中（命中只看標題、檔名、triggers）。
  return { path: relativePath, title, lesson, triggers, text: `${title}\n${body}`.toLowerCase() };
}

function asciiTokens(text) {
  return (text.toLowerCase().match(/[a-z][a-z0-9]{2,}/gu) ?? []).filter(token => !ASCII_STOPWORDS.has(token));
}

function cjkBigrams(text) {
  const result = [];
  for (const run of text.match(/[㐀-鿿]+/gu) ?? []) {
    for (let i = 0; i + 1 < run.length; i += 1) result.push(run.slice(i, i + 2));
  }
  return result;
}

export function lessonTerms(lesson) {
  const name = path.basename(lesson.path, ".md").replace(/^\d{4}-\d{2}-\d{2}-/u, "");
  const source = [name.replace(/-/gu, " "), lesson.title, ...lesson.triggers].join(" ");
  return new Set([...asciiTokens(source), ...cjkBigrams(source)]);
}

export function loadLessons(root = ROOT, dirs = LESSON_DIRS) {
  const lessons = [];
  for (const dir of dirs) {
    const absolute = path.join(root, dir);
    if (!fs.existsSync(absolute)) continue;
    for (const file of fs.readdirSync(absolute).filter(name => name.endsWith(".md")).sort()) {
      lessons.push(parseLesson(`${dir}/${file}`, fs.readFileSync(path.join(absolute, file), "utf8")));
    }
  }
  return lessons;
}

function clip(text, cap) {
  return text.length <= cap ? text : `${text.slice(0, cap - 1)}…`;
}

// 提問裡相連的雙字詞（「教育遊戲」→教育、育遊、遊戲）屬於同一個詞：取最高分，其餘只算 RUN_TAIL_WEIGHT，
// 避免長詞被重複計分、蓋過真正稀有的詞（如「裁切」）。
const RUN_TAIL_WEIGHT = 0.3;
// 單一中文雙字詞只有在夠稀有（最多出現在這麼多篇）時才算命中，例如「亂碼」；「更新」這類常見詞不算。
const RARE_SINGLE_DF = 2;
// 英文詞的小加分：只用來在同分附近稍微偏向英文專有詞；太大會讓 windows 這種常見英文詞蓋過稀有中文詞。
const ASCII_BONUS = 0.5;

function cjkRunScore(promptBigrams, hitSet, idf) {
  let total = 0;
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const sorted = run.map(idf).sort((a, b) => b - a);
    total += sorted[0] + RUN_TAIL_WEIGHT * sorted.slice(1).reduce((sum, value) => sum + value, 0);
    run = [];
  };
  for (const bigram of promptBigrams) {
    if (hitSet.has(bigram)) run.push(bigram);
    else flush();
  }
  flush();
  return total;
}

export function matchLessons(prompt, lessons, { max = MAX_MATCHES, minScore = MIN_SCORE } = {}) {
  const promptBigrams = [];
  for (const run of prompt.match(/[㐀-鿿]+/gu) ?? []) {
    for (let i = 0; i + 1 < run.length; i += 1) promptBigrams.push(run.slice(i, i + 2));
    promptBigrams.push(null); // 不同中文片段之間斷開，不視為同一個詞
  }
  const promptTerms = new Set([...asciiTokens(prompt), ...promptBigrams.filter(Boolean)]);
  if (!promptTerms.size || !lessons.length) return [];
  const termSets = lessons.map(lessonTerms);
  const total = lessons.length;
  // 詞的常見度用「全文」估：「審查」「工作」這類詞很少出現在標題、卻遍布內文，只看標題會被誤當成稀有詞。
  const df = new Map();
  for (const term of promptTerms) {
    let count = 0;
    for (const [index, lesson] of lessons.entries()) {
      if (termSets[index].has(term) || (lesson.text ?? "").includes(term)) count += 1;
    }
    df.set(term, count);
  }
  const isAscii = term => /^[a-z]/u.test(term);
  // 門檻隨語料大小調整：只出現在一篇的英文專有詞（分數 log(N)+ASCII_BONUS）單獨命中也要能過門檻。
  const threshold = Math.min(minScore, Math.log(total) + ASCII_BONUS);
  const idf = term => Math.log(total / Math.max(1, df.get(term)));
  return lessons
    .map((lesson, index) => {
      const hits = [...termSets[index]].filter(term => promptTerms.has(term));
      const asciiHits = hits.filter(isAscii);
      const cjkHits = new Set(hits.filter(term => !isAscii(term)));
      const score = asciiHits.reduce((sum, term) => sum + idf(term) + ASCII_BONUS, 0) + cjkRunScore(promptBigrams, cjkHits, idf);
      const rareSingle = hits.length === 1 && df.get(hits[0]) <= RARE_SINGLE_DF;
      return { lesson, score, hits, ascii: asciiHits.length > 0, rareSingle };
    })
    // 只命中單一個常見中文雙字詞（如「更新」）訊號太弱；至少要 2 個詞、1 個英文詞，或 1 個夠稀有的中文詞（如「亂碼」）。
    .filter(item => item.score >= threshold && (item.hits.length >= 2 || item.ascii || item.rareSingle))
    .sort((a, b) => b.score - a.score || a.lesson.path.localeCompare(b.lesson.path))
    .slice(0, max);
}

export function buildSessionContext(lessons) {
  const index = lessons.filter(lesson => lesson.path.startsWith(`${INDEX_DIR}/`)).reverse();
  if (!index.length) return "";
  const header = "【自動注入・本工作區過往教訓索引】以下標題來自 brain/error-log/（新到舊）。依 AGENTS.md「動工前先檢索記憶」，動工前先讀與任務相關的那幾篇，命中的教訓視為硬約束；本段只是索引，內容以原檔為準。\n";
  let text = header;
  for (const lesson of index) {
    const line = `- ${lesson.title} — ${lesson.path}\n`;
    if (text.length + line.length > INDEX_CAP) break;
    text += line;
  }
  return text.trimEnd();
}

export function buildPromptContext(prompt, lessons) {
  const matches = matchLessons(prompt, lessons);
  if (!matches.length) return "";
  let text = "【自動注入・與這次提問相關的過往教訓】依 AGENTS.md「動工前先檢索記憶」視為硬約束；以下為節錄，完整內容以原檔為準。\n";
  for (const { lesson } of matches) {
    const block = `\n### ${lesson.title}\n來源：${lesson.path}\n${clip(lesson.lesson || "（原檔沒有可節錄的段落，請直接讀原檔）", ITEM_CAP)}\n`;
    if (text.length + block.length > MATCH_CAP) break;
    text += block;
  }
  return text.trimEnd();
}

// 對話標題命名提醒：規則見 AGENTS.md「對話標題命名」，教訓見 brain/error-log/2026-10-15-session-title-rule-not-enforced.md。
// 只在 Claude 桌面版或 CLI、且目前標題缺少或不合 `<狀態> | <主題>｜<動作>` 時提醒；第一回合沒有自訂標題，自然會提醒。
// 桌面版由模型呼叫 set_session_title；CLI 沒有改名工具，改成請模型給使用者一行 /rename 指令。
const DESKTOP_ENTRYPOINT = "claude-desktop";
const CLI_ENTRYPOINT = "cli";
const TITLE_PATTERN = /^\S+ \| [^｜|]+｜\S.*$/u;

export function isValidSessionTitle(title) {
  return typeof title === "string" && TITLE_PATTERN.test(title.trim());
}

export function latestCustomTitle(transcriptText) {
  const lines = transcriptText.split(/\r?\n/u);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].includes('"custom-title"')) continue;
    try {
      const entry = JSON.parse(lines[i]);
      if (entry?.type === "custom-title" && typeof entry.customTitle === "string") return entry.customTitle;
    } catch { /* 壞行略過 */ }
  }
  return null;
}

export function titleReminder(event, payload, env = process.env) {
  const entrypoint = env.CLAUDE_CODE_ENTRYPOINT;
  if (event !== "UserPromptSubmit" || (entrypoint !== DESKTOP_ENTRYPOINT && entrypoint !== CLI_ENTRYPOINT)) return "";
  let title = null;
  try {
    if (typeof payload?.transcript_path === "string" && fs.existsSync(payload.transcript_path)) {
      title = latestCustomTitle(fs.readFileSync(payload.transcript_path, "utf8"));
    }
  } catch { /* 讀不到就當沒有標題 */ }
  if (isValidSessionTitle(title)) return "";
  const current = title ? `目前標題「${title}」不合格式` : "目前尚未設定合格標題";
  if (entrypoint === CLI_ENTRYPOINT) {
    return `【對話標題命名提醒】${current}。這是 Claude Code CLI，模型沒有改名工具；非瑣碎對話須依 AGENTS.md「對話標題命名」，在本回合回覆中給使用者一行完整可貼上的指令（獨立 text 程式碼區塊）：/rename <狀態> | <主題>｜<動作>，請使用者執行；對話由問答轉成實作時也要給。純問答也要給。`;
  }
  return `【對話標題命名提醒】${current}。非瑣碎對話須依 AGENTS.md「對話標題命名」，在本回合第一批工具呼叫中用 ToolSearch 載入並呼叫 mcp__ccd_session_mgmt__set_session_title（session_id: "self"），格式「<狀態> | <主題>｜<動作>」，並讀回結果確認；純寒暄、單行問答可略過。`;
}

// 提醒型守門規則表：規格見舊工作區的守門升級計畫（未隨附）。
// 每條規則連回一篇教訓、附使用者核准原話；只在 UserPromptSubmit 產生提醒，屬 advisory，不是安全閘。
// 出錯就放行：整張表壞掉 → 全部不提醒；單條格式錯 → 只略過該條。
const GUARD_RULES_FILE = "harness/config/guard-rules.json";
const GUARD_CAP = 1200;
const GUARD_STATUSES = new Set(["active", "disabled"]);
// builtin 只認程式內建名稱；規則表不能自帶程式。
const GUARD_BUILTINS = { session_title: (event, payload, env) => titleReminder(event, payload, env) };
const GUARD_STALE_NOTE = "（出處教訓在核准後改過，請核對提醒是否過時）";
const DAY_MS = 24 * 60 * 60 * 1000;

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

// 回傳整理後的規則；格式不合回傳 null。
function normalizeGuardRule(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { id, status, lesson, approved, when, reminder } = raw;
  if (!nonEmptyString(id) || !GUARD_STATUSES.has(status) || !nonEmptyString(lesson)) return null;
  // lesson 必須是 repo 相對路徑，不得是絕對路徑或跳出 repo。
  if (path.isAbsolute(lesson) || path.win32.isAbsolute(lesson) || lesson.split(/[\\/]/u).includes("..")) return null;
  if (!approved || !nonEmptyString(approved.quote) || typeof approved.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(approved.date)) return null;
  const approvedAt = Date.parse(`${approved.date}T00:00:00Z`);
  if (Number.isNaN(approvedAt)) return null;
  if (!when || typeof when !== "object") return null;
  const base = { id, status, lesson, approvedAt, reminder: typeof reminder === "string" ? reminder.trim() : "" };
  if (when.kind === "always") {
    return nonEmptyString(reminder) ? { ...base, kind: "always" } : null;
  }
  if (when.kind === "prompt_match") {
    if (!nonEmptyString(when.pattern) || !nonEmptyString(reminder)) return null;
    const flags = when.flags ?? "";
    if (typeof flags !== "string" || !/^[iu]*$/u.test(flags)) return null;
    try {
      return { ...base, kind: "prompt_match", regex: new RegExp(when.pattern, flags) };
    } catch {
      return null;
    }
  }
  if (when.kind === "builtin") {
    return Object.hasOwn(GUARD_BUILTINS, when.name) ? { ...base, kind: "builtin", name: when.name } : null;
  }
  return null;
}

export function loadGuardRules(root = ROOT, file = GUARD_RULES_FILE) {
  try {
    const table = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
    if (table?.version !== 1 || !Array.isArray(table.rules)) return [];
    return table.rules.map(normalizeGuardRule).filter(Boolean);
  } catch {
    return [];
  }
}

// 防過時：教訓檔 mtime 晚於「核准日隔天 00:00（UTC）」就視為核准後改過。
// 選 UTC 是為了不隨機器時區改變判定；核准日當天（含時區差內）的修改不算過時。
function lessonState(root, rule) {
  try {
    const absolute = path.resolve(root, rule.lesson);
    const rel = path.relative(path.resolve(root), absolute);
    if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return "missing";
    const stat = fs.statSync(absolute);
    if (!stat.isFile()) return "missing";
    return stat.mtimeMs > rule.approvedAt + DAY_MS ? "stale" : "fresh";
  } catch {
    return "missing";
  }
}

export function guardReminders(event, payload, rules, { root = ROOT, env = process.env } = {}) {
  if (event !== "UserPromptSubmit" || !Array.isArray(rules)) return "";
  const prompt = promptFrom(payload);
  const lines = [];
  for (const rule of rules) {
    try {
      if (rule.status !== "active") continue;
      let text = "";
      if (rule.kind === "always") text = `【守門 ${rule.id}】${rule.reminder}`;
      else if (rule.kind === "prompt_match") text = rule.regex.test(prompt) ? `【守門 ${rule.id}】${rule.reminder}` : "";
      else if (rule.kind === "builtin") text = GUARD_BUILTINS[rule.name](event, payload, env);
      if (!text) continue;
      const state = lessonState(root, rule);
      if (state === "missing") lines.push(`【守門 ${rule.id}】出處教訓 ${rule.lesson} 不見了，請核對或停用這條守門。`);
      else lines.push(state === "stale" ? `${text}${GUARD_STALE_NOTE}` : text);
    } catch { /* 單條規則出錯只略過該條。 */ }
  }
  return clip(lines.join("\n"), GUARD_CAP);
}

function promptFrom(payload) {
  for (const key of ["prompt", "user_prompt", "input", "message"]) {
    if (typeof payload?.[key] === "string" && payload[key].trim()) return payload[key];
  }
  return "";
}

export function contextFor(event, payload, lessons) {
  if (event === "SessionStart") return buildSessionContext(lessons);
  if (event === "UserPromptSubmit") return buildPromptContext(promptFrom(payload), lessons);
  return "";
}

async function main() {
  const event = process.argv[2];
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  let payload = {};
  try {
    payload = input.trim() ? JSON.parse(input) : {};
  } catch {
    payload = {};
  }
  const reminder = prepareReminder(event, payload, { root: ROOT, observe: process.env[OBSERVATION_DISABLED_ENV] !== "1" });
  let lessons = [];
  try { lessons = loadLessons(); } catch { /* 教訓讀取失敗不得吞掉固定審查提醒。 */ }
  let guard = "";
  try { guard = guardReminders(event, payload, loadGuardRules(ROOT), { root: ROOT }); } catch { /* 守門提醒失敗不得吞掉其他注入。 */ }
  const context = [reminder.context, guard, contextFor(event, payload, lessons)].filter(Boolean).join("\n\n");
  if (!context) return;
  await new Promise(resolve => {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } }), () => {
      if (reminder.recorded) recordTriggerEvent(ROOT, reminder.id, 'stdout_emitted');
      resolve(null);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    // 參考注入不得阻斷工作：任何錯誤都靜默結束、不輸出。
    process.exitCode = 0;
  });
}
