import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveAgyBinary } from '../agy/agy-process.mjs';
import { buildArgv, assertNoForbiddenFlags } from '../agy/flags.mjs';
import { parseAgyOutput } from '../agy/stream-json.mjs';
import { classifyCall, classifyTask } from '../agy/interpreter.mjs';
import { resolveCodex, runProcess, processSucceeded } from './process.mjs';

export function parseObject(text) {
  const raw = text.trim();
  const fenced = /^```json\s*\n([\s\S]*?)\n```$/.exec(raw);
  const value = JSON.parse(fenced ? fenced[1] : raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('OBJECT_REQUIRED');
  return value;
}

// `agy models` 每行「<id>\t<顯示名稱>」；其他行（如 Fetching…）略過。
export function parseAgyModels(stdout) {
  return stdout.split(/\r?\n/).map(line => /^([a-z0-9][a-z0-9.-]*)\t/i.exec(line)?.[1]).filter(Boolean);
}

// 設定檔省略 reviewer_model 時，改用能力帳本 modes.review.default_model（模型下架只需改帳本一處）；
// 明確指定者照用，不覆寫。
export function withDefaultReviewer(config, ledger) {
  if (!config || typeof config !== 'object' || config.reviewer_model !== undefined) return config;
  const fallback = ledger?.modes?.review?.default_model;
  return typeof fallback === 'string' && fallback ? { ...config, reviewer_model: fallback } : config;
}

// ---- S3：AGY 審查工具使用偵測（偵測式防護；讀檔／網路等副作用只能事後發現，無法撤回）----
// adapter 自行以 JSON 解析掃描整個 stdout，不改 stream-json.mjs（它也供 companion 使用）。
// 任一條件成立即不採信該次審查，並把 stdout 等可能夾帶讀取內容的欄位換成固定代碼。
// 不涵蓋：沒有任何 step 事件時的工具使用（只標 tool_visibility_unverified）、子代理內部步驟、伺服器端工具。
export const TOOL_USE_CODE = 'TOOL_USE_DETECTED';
export const ISOLATION_DIR_PREFIX = 'review-loop-agy-iso-';
export const PREFLIGHT_ADD_DIR_PLACEHOLDER = '<per-call-empty-dir>';
const ALLOWED_EVENTS = new Set(['init', 'step_update', 'result']);
// finish 不列入（W5 使用者決定）：它在 init.tools 中是工具，且只在已禁用的 --json-schema 下出現。
const ALLOWED_STEP_TYPES = new Set(['user_input', 'agent_response', 'system_message', 'error_message']);
const TOOL_FIELDS = new Set(['tool_name', 'tool_info', 'tool_call']);
const MAX_TOOL_STEPS = 100, MAX_COUNT_KEYS = 50;
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
// 只保留短識別字（名稱／狀態），不記任何參數、路徑或輸出（W5：路徑參數不記）。
const label = value => value === null || value === undefined ? null :
  String(value).slice(0, 64).replace(/[^A-Za-z0-9_.:-]/g, '?');
// 遞迴檢查「鍵」而非字串值：text_delta 內容提到 tool_name 等字樣不會命中。
function hasToolField(root) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) { for (const item of node) stack.push(item); continue; }
    for (const key of Object.keys(node)) { if (TOOL_FIELDS.has(key)) return true; stack.push(node[key]); }
  }
  return false;
}
const nonEmptyDenials = value => Array.isArray(value) ? value.length > 0 :
  value !== null && value !== undefined && value !== false && value !== '' &&
  !(typeof value === 'object' && !Object.keys(value).length);

// 六條件代碼：tool_step、step_type_not_allowed、tool_field、event_not_allowed、denied_actions、unparsable_line。
export function scanAgyStream(stdout) {
  const text = typeof stdout === 'string' ? stdout.replace(/^﻿/, '') : '';
  const reasons = new Set(), counts = new Map(), steps = new Map();
  let stepEventsSeen = false;
  const count = key => {
    const k = counts.has(key) || counts.size < MAX_COUNT_KEYS ? key : '(other)';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try { obj = JSON.parse(trimmed); } catch { reasons.add('unparsable_line'); count('(unparsable)'); continue; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { reasons.add('unparsable_line'); count('(non_object)'); continue; }
    const event = own(obj, 'event') ? obj.event : undefined;
    count(event === undefined ? '(none)' : `event:${label(event)}`);
    if (!ALLOWED_EVENTS.has(event)) reasons.add('event_not_allowed');
    if (hasToolField(obj)) reasons.add('tool_field');
    if (event === 'step_update') {
      stepEventsSeen = true;
      const step = obj.step_update && typeof obj.step_update === 'object' && !Array.isArray(obj.step_update) ? obj.step_update : {};
      count(`step_type:${label(step.step_type) ?? '(none)'}`);
      if (!ALLOWED_STEP_TYPES.has(step.step_type)) reasons.add('step_type_not_allowed');
      if (step.step_type === 'tool') {
        reasons.add('tool_step');
        const key = own(step, 'step_index') ? String(step.step_index) : `#${steps.size}`;
        if (steps.has(key) || steps.size < MAX_TOOL_STEPS) {
          steps.set(key, { name: label(step.tool_name ?? step.tool_info?.name), state: label(step.state) });
        }
      }
    }
    // result 事件，或 --output-format json 的隱含結果物件（無 event、有 status），與 stream-json.mjs 同口徑。
    const result = event === 'result' ? obj.result : event === undefined && own(obj, 'status') ? obj : null;
    if (result && typeof result === 'object' && nonEmptyDenials(result.denied_actions)) reasons.add('denied_actions');
  }
  return { suspected: reasons.size > 0, reasons: [...reasons], toolSteps: [...steps.values()],
    stepEventsSeen, eventTypeCounts: Object.fromEntries(counts) };
}

// 偵測成立：value 一律 null、call.error／parseError 換固定代碼、stdout 清空（不存雜湊）；
// 保留 exitCode、signal（loop.mjs 靠它保留鎖）、timedOut、overflow、spawnError、stderr 等運輸欄位。
function applyDetection(out, scan) {
  const raw = out.raw && typeof out.raw === 'object' ? out.raw : {};
  const stdout = typeof raw.stdout === 'string' ? raw.stdout : '';
  const next = { ...out, ok: false, value: null, tool_use_suspected: true, tool_steps: scan.toolSteps,
    suspect_reasons: scan.reasons,
    raw: { ...raw, stdout: '', stdout_omitted: TOOL_USE_CODE, stdout_bytes: Buffer.byteLength(stdout, 'utf8'),
      event_type_counts: scan.eventTypeCounts } };
  if (next.call && typeof next.call === 'object') next.call = { ...next.call, error: TOOL_USE_CODE };
  if (own(next, 'parseError')) next.parseError = TOOL_USE_CODE;
  return next;
}

// 每次審查新建空暫存目錄當 cwd 與 --add-dir：只是整潔措施，不是安全邊界（P-S3 證實不限制絕對路徑讀檔）。
// 刻意不走 flags.mjs 的 resolveAddDir（它要求 add-dir 在 root 內），這是已知取捨；改為反向確認不在 root 底下。
const realOrResolved = p => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
function assertOutsideRoot(dir, root) {
  const norm = p => process.platform === 'win32' ? realOrResolved(p).toLowerCase() : realOrResolved(p);
  const rel = path.relative(norm(root), norm(dir));
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new Error('AGY_ISOLATION_DIR_INSIDE_ROOT');
}
// 清除失敗不拋例外：只回布林與暫存路徑供人工清理，避免吞掉審查紀錄或破壞 raw.signal 的鎖保留。
function cleanupIsolationDir(dir) {
  let dirty;
  try { dirty = fs.readdirSync(dir).length > 0; } catch { dirty = true; }
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  catch { return { isolation_dir_dirty: dirty, isolation_dir_cleanup_failed: true, isolation_dir: dir }; }
  return { isolation_dir_dirty: dirty };
}

// reviewerEffort 只在設定檔明確指定時才送 --effort；AGY 1.3.4 起 Gemini 會拒絕額外 effort，強度以模型 id 選擇。
export function liveAdapters({ root, reviewerModel, reviewerEffort, repairModel, timeoutMs, ledgerPath,
  processRunner = runProcess, codexLauncher = resolveCodex, agyLauncher = resolveAgyBinary }) {
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8').replace(/^\uFEFF/, ''));
  if (ledger.models?.[reviewerModel]?.availability !== 'available') throw new Error('AGY_MODEL_NOT_IN_LOCAL_LEDGER');
  // 未設定回修模型（非 Codex 作者、max_repairs=0）時不解析也不 preflight Codex。
  const codex = repairModel ? codexLauncher() : null;
  const agy = agyLauncher();
  const argvFor = addDir => buildArgv({ model: reviewerModel, effort: reviewerEffort, timeoutSeconds: Math.ceil(timeoutMs / 1000), addDir });
  // 建構時以絕對路徑哨兵值（只驗格式、不使用）驗證，保留 AGY_EFFORT_INVALID 等提早失敗。
  const sentinelArgv = argvFor(os.tmpdir());
  assertNoForbiddenFlags(sentinelArgv);
  // 只供 preflight 紀錄的樣板；不得傳進 assert 或 spawn（review() 每次以真實暫存目錄重建並 assert）。
  const argv = sentinelArgv.map((v, i) => sentinelArgv[i - 1] === '--add-dir' ? PREFLIGHT_ADD_DIR_PLACEHOLDER : v);
  return {
    async preflight() {
      const agyVersion = await processRunner(agy, ['--version'], { cwd: root, timeoutMs: 15000 });
      const codexVersion = codex ? await processRunner(codex.command, [...codex.prefix, '--version'], { cwd: root, timeoutMs: 15000 }) : null;
      // 以當次 `agy models` 為準核對指定模型仍提供；查不到或已下架就停，不自動換模型。
      const agyModels = await processRunner(agy, ['models'], { cwd: root, timeoutMs: 60000 });
      const availableModels = processSucceeded(agyModels) ? parseAgyModels(agyModels.stdout) : [];
      const versionsOk = [agyVersion, codexVersion].every(r => r === null || (processSucceeded(r) && r.stdout.trim()));
      const base = { agyVersion, codexVersion, agyModels, available_models: availableModels, argv };
      if (!versionsOk) return { ok: false, error: 'VERSION_CHECK_FAILED', ...base };
      if (!availableModels.length) return { ok: false, error: 'AGY_MODELS_UNAVAILABLE',
        message: '無法取得本次 agy models 清單，不能確認審查模型仍可用。', ...base };
      if (!availableModels.includes(reviewerModel)) return { ok: false, error: 'REVIEWER_MODEL_NOT_OFFERED',
        message: `審查模型 ${reviewerModel} 不在本次 agy models 清單（可能已下架）；不自動換模型，請在設定檔改 reviewer_model（或刪掉該欄改用帳本 modes.review.default_model）。目前可用：${availableModels.join(', ')}`, ...base };
      return { ok: true, ...base };
    },
    async review(input, callTimeoutMs = timeoutMs) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), ISOLATION_DIR_PREFIX));
      let out;
      try {
        assertOutsideRoot(dir, root);
        const callArgv = argvFor(dir);
        assertNoForbiddenFlags(callArgv);
        const raw = await processRunner(agy, callArgv, { cwd: dir, input, timeoutMs: callTimeoutMs });
        // 偵測先算好，所有回傳路徑（含 timeout／overflow／parseError）最後一律套用。
        const scan = scanAgyStream(raw?.stdout);
        let parsed = null;
        try { parsed = parseAgyOutput(raw.stdout); }
        catch (e) { out = { ok: false, value: null, raw, parseError: String(e?.message ?? e) }; }
        if (!out) {
          const call = classifyCall({ ...raw, parsedOutput: parsed });
          const task = classifyTask({ status: parsed.result?.status, response: parsed.result?.response,
            deniedActions: parsed.result?.denied_actions, stderr: raw.stderr });
          const ok = !scan.suspected && processSucceeded(raw) && parsed.result?.status === 'SUCCESS' &&
            parsed.model === reviewerModel && !call.error && !call.truncated && !call.warnings.length && task === 'completed';
          let value = null;
          if (ok) { try { value = parseObject(parsed.result.response); } catch {} }
          out = { ok: ok && value !== null, value, raw, call, task,
            identity: { platform: 'antigravity', requested_model: reviewerModel, requested_effort: reviewerEffort ?? null, actual_model: parsed.model, source: 'stream_init' } };
        }
        out.step_events_seen = scan.stepEventsSeen;
        out.tool_visibility_unverified = !scan.stepEventsSeen;
        if (scan.suspected) out = applyDetection(out, scan);
      } finally {
        // processRunner 拋錯時也清除，之後照常拋出原錯誤；清除本身失敗不拋。
        const iso = cleanupIsolationDir(dir);
        if (out) Object.assign(out, iso);
      }
      return out;
    },
    async repair(input, callTimeoutMs = timeoutMs) {
      if (!codex) return { ok: false, value: null, raw: null, identity: null, error: 'REPAIR_NOT_CONFIGURED' };
      const args = [...codex.prefix, 'exec', '--sandbox', 'read-only', '--skip-git-repo-check',
        '--ephemeral', '--json', '--cd', root, '--model', repairModel, '-'];
      const raw = await processRunner(codex.command, args, { cwd: root, input, timeoutMs: callTimeoutMs });
      let last = null, complete = false, error = false;
      for (const line of raw.stdout.split(/\r?\n/).filter(Boolean)) {
        try {
          const e = JSON.parse(line);
          if (e.type === 'item.completed' && e.item?.type === 'agent_message') last = e.item.text;
          if (e.type === 'turn.completed') complete = true;
          if (e.type === 'error' || e.type === 'turn.failed') error = true;
        } catch { error = true; }
      }
      let value = null;
      if (processSucceeded(raw) && complete && !error && last) { try { value = parseObject(last); } catch {} }
      return { ok: value !== null, value, raw,
        identity: { platform: 'codex', requested_model: repairModel, actual_model: null,
          source: 'controller_launch', note: '模型名稱由啟動參數指定；串流未提供實際模型名稱。' } };
    }
  };
}
