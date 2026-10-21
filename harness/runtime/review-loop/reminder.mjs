import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const TRIGGER_LOG = 'harness/state/review-trigger-events.jsonl';
export const OBSERVATION_DISABLED_ENV = 'HARNESS_REVIEW_TRIGGER_LOG_DISABLED';
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
const validId = id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);

function logPath(root, create = false) {
  let current = fs.realpathSync(root);
  const parts = TRIGGER_LOG.split('/');
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    let s;
    try { s = fs.lstatSync(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (s) {
      if (s.isSymbolicLink() || (s.isFile() && s.nlink > 1)) throw new Error('TRIGGER_LOG_ALIAS');
      if (index < parts.length - 1 && !s.isDirectory()) throw new Error('TRIGGER_LOG_PARENT_INVALID');
    } else if (create && index < parts.length - 1) fs.mkdirSync(current);
  }
  return current;
}

// 只記摘要；呼叫者不能把原始 prompt、回應或任意欄位塞入事件。
export function recordTriggerEvent(root, id, kind, detail = /** @type {Record<string, any>} */ ({})) {
  if (!validId(id)) return false;
  const allowed = ['reminder_prepared', 'stdout_emitted', 'entry_started', 'review_dispatch_intent', 'review_call_returned', 'entry_finished'];
  if (!allowed.includes(kind)) return false;
  const event = /** @type {Record<string, any>} */ ({ at: new Date().toISOString(), reminder_id: id, kind });
  for (const key of ['session_sha256', 'turn_sha256', 'prompt_sha256', 'reminder_sha256', 'config_sha256', 'candidate_hash', 'input_sha256']) {
    if (typeof detail[key] === 'string' && /^[a-f0-9]{64}$/.test(detail[key])) event[key] = detail[key];
  }
  if (typeof detail.ok === 'boolean') event.ok = detail.ok;
  if (typeof detail.status === 'string' && /^[A-Z_]{1,64}$/.test(detail.status)) event.status = detail.status;
  try { fs.appendFileSync(logPath(root, true), JSON.stringify(event) + '\n', 'utf8'); return true; }
  catch { return false; }
}

export function readTriggerEvents(root, id) {
  if (!validId(id)) throw new Error('TRIGGER_ID_INVALID');
  const file = logPath(root);
  if (!fs.existsSync(file)) return [];
  if (fs.statSync(file).size > 10_000_000) throw new Error('TRIGGER_LOG_TOO_LARGE');
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  }).filter(e => e?.reminder_id === id);
}

export function buildReminder(id = null) {
  const command = 'node harness/cli/review-loop.mjs <本任務設定檔.json>' + (id ? ` --trigger-id ${id}` : '');
  return `【實作任務審查提醒】\n本輪若涉及實作或修改程式／文件／設定，依 Route Plan 的 profile 與使用者指示確認審查需求；需審查時，交付前建立本任務的限定檔案與必要檢查設定，主動執行 ${command}，不要拿示範或其他任務收據代替。Codex 作者的預設外部審查者為 AGY，作者不得自審；使用者指定的審查者、豁免與停止決定優先。只啟動已授權範圍；不安裝、不加入秘密。交付列出本次結論與收據；未知、空回覆或未啟動均標示「審查未完成」，不得稱通過。純問答不因提醒而呼叫模型。這是提醒，不是完成閘。`;
}

// 每個有效提交固定提醒；不靠詞彙分類，才能覆蓋「好，補上」這類短續接。
/** @param {{root?: string, observe?: boolean}} [options] */
export function prepareReminder(event, payload, options = {}) {
  const { root, observe = true } = options;
  if (event !== 'UserPromptSubmit') return { context: '', id: null, recorded: false };
  const prompt = ['prompt', 'user_prompt', 'input', 'message'].map(k => payload?.[k]).find(v => typeof v === 'string' && v.trim());
  if (!prompt) return { context: '', id: null, recorded: false };
  const id = crypto.randomBytes(16).toString('hex');
  const context = buildReminder(id);
  const detail = /** @type {Record<string, any>} */ ({ prompt_sha256: digest(prompt), reminder_sha256: digest(context) });
  if (typeof payload.session_id === 'string') detail.session_sha256 = digest(payload.session_id);
  if (typeof payload.turn_id === 'string') detail.turn_sha256 = digest(payload.turn_id);
  const recorded = observe && recordTriggerEvent(root, id, 'reminder_prepared', detail);
  return { context: recorded ? context : buildReminder(), id: recorded ? id : null, recorded };
}

export function parseReviewArgs(args) {
  const [file, ...rest] = args;
  if (!file || file.startsWith('--')) throw new Error('REVIEW_CONFIG_REQUIRED');
  let preflightOnly = false, triggerId = null;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--preflight-only' && !preflightOnly) { preflightOnly = true; continue; }
    if (rest[i] === '--trigger-id' && !triggerId && validId(rest[i + 1])) { triggerId = rest[++i]; continue; }
    throw new Error('REVIEW_OPTION_INVALID');
  }
  return { file, preflightOnly, triggerId };
}

export function requirePreparedTrigger(root, id) {
  if (!readTriggerEvents(root, id).some(e => e.kind === 'reminder_prepared')) throw new Error('TRIGGER_PREPARATION_NOT_FOUND');
}
