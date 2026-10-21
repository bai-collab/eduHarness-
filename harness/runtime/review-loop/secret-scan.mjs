// 送審前秘密檢查（純函式）。規則來源：R1 安全前置審查最終清單（審查紀錄保存在舊工作區，未隨附）。
// 只偵測已知格式；通用 KEY=VALUE、熵值、無前綴 token、URL 內嵌密碼與編碼後秘密不在範圍內。
// findSecrets 只回傳行號與規則 id，絕不回傳命中值、欄位、長度或部分值。

// 每次呼叫都由來源字串新建 RegExp（帶 g），避免共用 lastIndex 狀態。
// 順序有意義：anthropic_key 放在 OpenAI 規則之前。
//
// 左邊界：R1 原為「前一字元不是英數類」。但 JSON 字串化或原始碼中的跳脫序列（反斜線＋n／t／r、
// 雙重跳脫、\uHHHH、\xHH）最後一個字元本身是英數，會讓緊接其後的秘密漏判。
// 因此改為「前一字元不在類別內，或它是跳脫序列的結尾字元」：
//   (?<!(?<!ESC)CLS)，ESC＝單一反斜線｜反斜線 u 加 3 個十六進位｜反斜線 x 加 1 個十六進位。
// 這只會讓命中變多（不放寬），kebab（如 task-sk-…）因前一字元前面不是反斜線，仍不命中。
// lookbehind 長度固定且很短，不會造成回溯爆炸。右邊界不受影響（跳脫序列以反斜線開頭，不在任何類別內）。
const ESC = String.raw`\\|\\u[0-9A-Fa-f]{3}|\\x[0-9A-Fa-f]`;
const LB = cls => `(?<!(?<!${ESC})${cls})`;
const W = '[A-Za-z0-9_-]';
const RULE_SOURCES = [
  ['anthropic_key', LB(W) + String.raw`sk-ant-[a-z]{2,10}[0-9]{2}-[A-Za-z0-9_-]{32,}`],
  ['openai_project_key', LB(W) + String.raw`sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,}`],
  ['openai_legacy_key', LB(W) + String.raw`sk-[A-Za-z0-9]{32,}(?![A-Za-z0-9_-])`],
  ['aws_access_key_id', LB('[A-Z0-9]') + String.raw`(?:AKIA|ASIA)[0-9A-Z]{16}(?![A-Z0-9])`],
  ['github_token', LB('[A-Za-z0-9_]') + String.raw`gh[pousr]_[A-Za-z0-9]{36,255}(?![A-Za-z0-9_])`],
  ['github_pat', LB('[A-Za-z0-9_]') + String.raw`github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}(?![A-Za-z0-9_])`],
  ['slack_token', LB('[A-Za-z0-9-]') + String.raw`xox[abposr]-[0-9]{6,}-[A-Za-z0-9-]{10,}`],
  ['google_api_key', LB(W) + String.raw`AIza[0-9A-Za-z_-]{35}(?![A-Za-z0-9_-])`],
  ['google_oauth_access_token', LB(W) + String.raw`ya29\.[0-9A-Za-z_-]{30,}`],
  ['google_oauth_client_secret', LB(W) + String.raw`GOCSPX-[0-9A-Za-z_-]{28}(?![A-Za-z0-9_-])`],
  ['jwt', LB(W) + String.raw`eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}`],
  // 原為 \bBearer；\b 等同左側不是 [A-Za-z0-9_]，同樣改成可接在跳脫序列之後。
  ['bearer_token', LB('[A-Za-z0-9_]') + String.raw`Bearer[ \t]+(?=[A-Za-z0-9._~+/-]*[0-9])[A-Za-z0-9._~+/_-]{24,}=*`],
  ['azure_storage_account_key', String.raw`AccountKey=[A-Za-z0-9+/]{86}==`]
];

// PEM／PGP 私鑰區塊：只用開頭行偵測；遮罩以 indexOf 找結尾，不用懶惰正則。
const PEM_ID = 'private_key_block';
const DASH5 = '-'.repeat(5);
const PEM_BEGIN_SOURCE = DASH5 + 'BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY(?: BLOCK)?' + DASH5;
const PEM_END_MARK = DASH5 + 'END';

const ruleList = () => RULE_SOURCES.map(([id, source]) => [id, new RegExp(source, 'g')]);
const pemBegin = () => new RegExp(PEM_BEGIN_SOURCE, 'g');

// 預先算好每行起點，再以二分搜尋把字元位移換成 1 起算的行號。
function lineStarts(text) {
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return starts;
}
function lineOf(starts, index) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= index) lo = mid; else hi = mid - 1; }
  return lo + 1;
}

export function findSecrets(text) {
  if (typeof text !== 'string' || !text) return [];
  const starts = lineStarts(text);
  const hits = [];
  for (const m of text.matchAll(pemBegin())) hits.push({ index: m.index, line: lineOf(starts, m.index), pattern_id: PEM_ID });
  for (const [id, re] of ruleList()) for (const m of text.matchAll(re)) hits.push({ index: m.index, line: lineOf(starts, m.index), pattern_id: id });
  hits.sort((a, b) => a.index - b.index || a.pattern_id.localeCompare(b.pattern_id));
  return hits.map(({ line, pattern_id }) => ({ line, pattern_id }));
}

// 私鑰區塊從 BEGIN 遮到 END 那一行的行尾；找不到 END 就遮到文字結尾（截斷的區塊也不外洩）。
function maskPem(text, counts) {
  const re = pemBegin();
  let out = '', cursor = 0, m;
  while ((m = re.exec(text)) !== null) {
    const begin = m.index;
    const endMark = text.indexOf(PEM_END_MARK, begin + m[0].length);
    let stop;
    if (endMark === -1) stop = text.length;
    else { const nl = text.indexOf('\n', endMark); stop = nl === -1 ? text.length : nl; }
    out += text.slice(cursor, begin) + `[REDACTED:${PEM_ID}]`;
    counts.set(PEM_ID, (counts.get(PEM_ID) ?? 0) + 1);
    cursor = stop; re.lastIndex = stop;
  }
  return out + text.slice(cursor);
}

function maskWithCounts(text) {
  const counts = new Map();
  if (typeof text !== 'string' || !text) return { text, counts };
  let out = maskPem(text, counts);
  for (const [id, re] of ruleList()) {
    out = out.replace(re, () => { counts.set(id, (counts.get(id) ?? 0) + 1); return `[REDACTED:${id}]`; });
  }
  return { text: out, counts };
}

export function maskSecrets(text) {
  return maskWithCounts(text).text;
}

// 遞迴遮罩所有字串值與物件鍵，回傳新物件；原物件不改動（驗證與失敗分類仍用遮罩前的記憶體物件）。
// redactions 只記欄位路徑、規則 id 與次數。
export function deepMask(input) {
  const redactions = [];
  const seen = new WeakSet();
  const note = (field, counts) => { for (const [pattern_id, count] of counts) redactions.push({ field, pattern_id, count }); };
  const walk = (value, field) => {
    if (typeof value === 'string') { const r = maskWithCounts(value); note(field || '(root)', r.counts); return r.text; }
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    let result;
    if (Array.isArray(value)) result = value.map((v, i) => walk(v, `${field}[${i}]`));
    else {
      result = {};
      for (const [key, v] of Object.entries(value)) {
        const k = maskWithCounts(key);
        const childField = field ? `${field}.${k.text}` : k.text;
        note(`${childField}(key)`, k.counts);
        result[k.text] = walk(v, childField);
      }
    }
    seen.delete(value);
    return result;
  };
  const value = walk(input, '');
  return { value, redactions };
}
