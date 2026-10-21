import fs from 'node:fs';
import path from 'node:path';
import { findWorkspaceRoot } from '../core/root.mjs';
import { validateConfig, runLoop } from '../runtime/review-loop/loop.mjs';
import { liveAdapters, withDefaultReviewer } from '../runtime/review-loop/adapters.mjs';
import crypto from 'node:crypto';
import { parseReviewArgs, requirePreparedTrigger, recordTriggerEvent } from '../runtime/review-loop/reminder.mjs';

const usage = '用法：node harness/cli/review-loop.mjs <設定檔.json> [--preflight-only] [--trigger-id <提醒識別碼>]';
let entryObserver = null;
try {
  const { file, preflightOnly, triggerId } = parseReviewArgs(process.argv.slice(2));
  const root = fs.realpathSync(findWorkspaceRoot(process.cwd()));
  const ledgerPath = path.join(root, 'harness/runtime/agy/capabilities.json');
  const config = validateConfig(withDefaultReviewer(JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8').replace(/^\uFEFF/, '')),
    JSON.parse(fs.readFileSync(ledgerPath, 'utf8').replace(/^\uFEFF/, ''))), root);
  if (triggerId) requirePreparedTrigger(root, triggerId);
  const adapters = liveAdapters({ root, reviewerModel: config.reviewer_model, reviewerEffort: config.reviewer_effort, repairModel: config.repair_model,
    timeoutMs: config.timeout_ms, ledgerPath });
  const observe = (kind, detail = {}) => {
    if (triggerId && !recordTriggerEvent(root, triggerId, kind, detail)) process.stderr.write('提醒追蹤紀錄寫入失敗；保留審查主流程並標示追蹤缺口。\n');
  };
  if (!preflightOnly) {
    entryObserver = observe;
    observe('entry_started', { config_sha256: crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex') });
  }
  const result = preflightOnly ? await adapters.preflight() :
    await runLoop({ root, config, adapters, onEvent: e => {
      process.stdout.write(JSON.stringify(e) + '\n');
      if (e.state === 'REVIEW_INTENT') observe('review_dispatch_intent', { input_sha256: e.input_sha256 });
      if (e.state === 'REVIEW_RESULT') observe('review_call_returned', { ok: e.ok });
    } });
  if (!preflightOnly) observe('entry_finished', { status: result.status, candidate_hash: result.candidate_hash });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = (preflightOnly ? result.ok : result.status === 'REVIEW_PASSED') ? 0 : 2;
} catch (e) {
  entryObserver?.('entry_finished', { status: 'ENTRY_ABORTED' });
  process.stderr.write(`審查迴圈停止：${e.message}\n${usage}\n`); process.exitCode = 2;
}
