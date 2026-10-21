import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyReviewFailure, classifyPreflightFailure } from '../runtime/review-loop/failure-category.mjs';
import { classifyCall, classifyTask } from '../runtime/agy/interpreter.mjs';
import { runLoop, snapshot } from '../runtime/review-loop/loop.mjs';

const MODEL = 'gemini-3.8-flash-high';
const goodIdentity = { platform: 'antigravity', source: 'stream_init', actual_model: MODEL };
const baseRaw = { exitCode: 0, signal: null, stdout: '', stderr: '', timedOut: false, overflow: false, spawnError: null };
// 以真實 interpreter 產生 call／task，貼近 adapters.review 的輸出形狀。
const make = ({ raw = {}, response = '{}', status = 'SUCCESS', parsed = { model: MODEL, result: { status, response } }, extra = {} } = {}) => {
  const r = { ...baseRaw, ...raw };
  const call = classifyCall({ ...r, parsedOutput: parsed });
  const task = classifyTask({ status: parsed?.result?.status, response: parsed?.result?.response, stderr: r.stderr });
  return { ok: false, value: null, raw: r, call, task, identity: goodIdentity, ...extra };
};

test('純 401 文字沒有身分層字串 → 不是 auth_failed', () => {
  const r = make({ raw: { exitCode: 1, stderr: 'HTTP 401 Unauthorized' }, status: 'ERROR' });
  const f = classifyReviewFailure(r, MODEL);
  assert.notEqual(f.category, 'auth_failed');
  assert.equal(f.category, 'call_error');
  assert.deepEqual(f.evidence, ['rule:raw.exitCode', 'exit_code:1']);
});

test('身分層字串＋空回覆 → auth_failed', () => {
  const r = make({ raw: { exitCode: 1, stderr: 'Error: Not logged into Antigravity' }, status: 'ERROR', response: '' });
  assert.equal(r.task, 'auth_failed');
  assert.equal(classifyReviewFailure(r, MODEL).category, 'auth_failed');
});

test('429／RESOURCE_EXHAUSTED → rate_limited_or_quota（stderr 與 call.error 皆可）', () => {
  assert.equal(classifyReviewFailure(make({ raw: { exitCode: 1, stderr: 'got 429 Too Many Requests' }, status: 'ERROR' }), MODEL).category, 'rate_limited_or_quota');
  const viaError = make({ parsed: { model: MODEL, result: { status: 'ERROR', response: '', error: 'RESOURCE_EXHAUSTED: try later' } } });
  assert.equal(viaError.call.error, 'RESOURCE_EXHAUSTED: try later');
  const f = classifyReviewFailure(viaError, MODEL);
  assert.equal(f.category, 'rate_limited_or_quota');
  assert.deepEqual(f.evidence, ['rule:call.error:rate_limit_pattern', 'exit_code:0']);
  assert.equal(classifyReviewFailure({ raw: { stderr: 'quota exceeded' } }, MODEL).category, 'rate_limited_or_quota');
});

test('503／UNAVAILABLE → service_unavailable', () => {
  assert.equal(classifyReviewFailure(make({ raw: { exitCode: 1, stderr: 'upstream returned 503' }, status: 'ERROR' }), MODEL).category, 'service_unavailable');
  assert.equal(classifyReviewFailure({ call: { error: 'The model is currently unavailable' } }, MODEL).category, 'service_unavailable');
});

test('逾時、溢出、啟動失敗、終止未確認各有分類且次序正確', () => {
  assert.equal(classifyReviewFailure(make({ raw: { timedOut: true, exitCode: null } }), MODEL).category, 'timeout');
  assert.equal(classifyReviewFailure({ raw: { overflow: true } }, MODEL).category, 'output_overflow');
  assert.equal(classifyReviewFailure({ raw: { spawnError: 'ENOENT', timedOut: true } }, MODEL).category, 'spawn_failed');
  assert.equal(classifyReviewFailure({ raw: { signal: 'TERMINATION_UNCONFIRMED', timedOut: true } }, MODEL).category, 'termination_unconfirmed');
  // 其他 signal 不算終止未確認
  assert.notEqual(classifyReviewFailure({ raw: { signal: 'SIGTERM' } }, MODEL).category, 'termination_unconfirmed');
  assert.equal(classifyReviewFailure({ parseError: 'bad', raw: baseRaw }, MODEL).category, 'parse_failed');
});

test('模型不符或身分缺失 → identity_mismatch', () => {
  const wrong = make({ extra: { identity: { ...goodIdentity, actual_model: 'other-model' }, ok: true, value: {} } });
  assert.equal(classifyReviewFailure(wrong, MODEL).category, 'identity_mismatch');
  const noIdentity = make({ extra: { identity: undefined, value: {} } });
  assert.equal(classifyReviewFailure(noIdentity, MODEL).category, 'identity_mismatch');
  const wrongPlatform = make({ extra: { identity: { ...goodIdentity, platform: 'codex' }, ok: true, value: {} } });
  assert.equal(classifyReviewFailure(wrongPlatform, MODEL).category, 'identity_mismatch');
});

test('SUCCESS 空回覆 → empty_response；截斷 → truncated', () => {
  const empty = make({ response: '' });
  assert.equal(empty.task, 'empty');
  assert.equal(classifyReviewFailure(empty, MODEL).category, 'empty_response');
  const truncated = make({ parsed: { model: MODEL, result: null } });
  assert.equal(truncated.call.truncated, true);
  assert.equal(classifyReviewFailure(truncated, MODEL).category, 'truncated');
});

test('policy_blocked／denials_unverified／environment_blocked 沿用 task', () => {
  assert.equal(classifyReviewFailure({ task: 'policy_blocked' }, MODEL).category, 'policy_blocked');
  assert.equal(classifyReviewFailure({ task: 'denials_unverified' }, MODEL).category, 'denials_unverified');
  assert.equal(classifyReviewFailure({ task: 'environment_blocked' }, MODEL).category, 'environment_blocked');
});

test('回覆不是合法 JSON（value 為 null）→ no_review_value；其餘 → unknown', () => {
  const noValue = make({ response: 'not json', extra: { value: null } });
  assert.equal(noValue.task, 'completed');
  assert.equal(classifyReviewFailure(noValue, MODEL).category, 'no_review_value');
  assert.equal(classifyReviewFailure(make({ extra: { value: { x: 1 } } }), MODEL).category, 'unknown');
});

test('缺欄位不拋錯，evidence 只含規則標籤與 exit code', () => {
  for (const input of [undefined, null, {}, { raw: null }, { raw: {}, call: null, identity: null }, 'x'])
    assert.doesNotThrow(() => classifyReviewFailure(input, MODEL));
  assert.equal(classifyReviewFailure({ raw: { signal: 'TERMINATION_UNCONFIRMED' } }, MODEL).category, 'termination_unconfirmed');
  const secretish = 'stderr 429 with plenty of original text';
  const f = classifyReviewFailure({ raw: { exitCode: 2, stderr: secretish } }, MODEL);
  for (const e of f.evidence) assert.match(e, /^(rule:[A-Za-z0-9_.:]+|exit_code:\d+)$/);
  assert.ok(!JSON.stringify(f).includes('plenty'));
});

test('preflight 分類；models_unavailable／version_check_failed 不代表未登入', () => {
  assert.equal(classifyPreflightFailure({ ok: false, error: 'VERSION_CHECK_FAILED' }).category, 'version_check_failed');
  assert.equal(classifyPreflightFailure({ ok: false, error: 'AGY_MODELS_UNAVAILABLE' }).category, 'models_unavailable');
  assert.equal(classifyPreflightFailure({ ok: false, error: 'REVIEWER_MODEL_NOT_OFFERED' }).category, 'model_not_offered');
  for (const p of [{ ok: false, error: 'SOMETHING_ELSE' }, { ok: false }, undefined, null]) {
    const f = classifyPreflightFailure(p);
    assert.equal(f.category, 'unknown');
    assert.ok(!JSON.stringify(f).includes('SOMETHING_ELSE'));
  }
});

// 經 runLoop 注入假 adapter 的整合案例
function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-loop-fc-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'source.mjs'), 'export const value = 1;\n');
  const config = { goal: 'value 必須為 1', files: ['source.mjs'], evidence_dir: 'outputs/run',
    checks: [{ id: 'value', argv: ['$node', '--input-type=module', '-e', "import('./source.mjs').then(m=>process.exit(m.value===1?0:1))"] }],
    author_platform: 'claude', reviewer_model: MODEL, max_repairs: 0, timeout_ms: 3000 };
  return { root, config, adapters: { preflight: async () => ({ ok: true }) } };
}
const readResult = s => JSON.parse(fs.readFileSync(path.join(s.root, 'outputs/run/result.json'), 'utf8'));

test('runLoop：preflight 失敗 → result.json 帶 failure_category，status／reason 不變', async t => {
  const s = setup(t);
  s.adapters.preflight = async () => ({ ok: false, error: 'AGY_MODELS_UNAVAILABLE', message: '無法取得清單' });
  const r = await runLoop(s);
  assert.equal(r.status, 'INCONCLUSIVE'); assert.equal(r.reason, 'PREFLIGHT_FAILED'); assert.equal(r.detail, '無法取得清單');
  const saved = readResult(s);
  assert.equal(saved.failure_category, 'models_unavailable');
  assert.deepEqual(saved.failure_evidence, ['rule:preflight.AGY_MODELS_UNAVAILABLE']);
  assert.equal(fs.existsSync(path.join(s.root, '.harness-review-loop.lock')), false);
});

test('runLoop：模型下架 preflight → reason 仍為 REVIEWER_MODEL_NOT_OFFERED 並帶 model_not_offered', async t => {
  const s = setup(t);
  s.adapters.preflight = async () => ({ ok: false, error: 'REVIEWER_MODEL_NOT_OFFERED', message: 'x' });
  const r = await runLoop(s);
  assert.equal(r.reason, 'REVIEWER_MODEL_NOT_OFFERED'); assert.equal(readResult(s).failure_category, 'model_not_offered');
});

test('runLoop：審查呼叫失敗 → REVIEW_TRANSPORT_OR_IDENTITY_FAILED 並帶 failure_category', async t => {
  const s = setup(t);
  s.adapters.review = async () => make({ raw: { exitCode: 1, stderr: 'got 429 Too Many Requests' }, status: 'ERROR' });
  const r = await runLoop(s);
  assert.equal(r.status, 'INCONCLUSIVE'); assert.equal(r.reason, 'REVIEW_TRANSPORT_OR_IDENTITY_FAILED');
  const saved = readResult(s);
  assert.equal(saved.failure_category, 'rate_limited_or_quota');
  assert.deepEqual(saved.failure_evidence, ['rule:raw.stderr:rate_limit_pattern', 'exit_code:1']);
});

test('runLoop：身分不符 → identity_mismatch；其他結束原因不帶 failure_category', async t => {
  const s = setup(t);
  s.adapters.review = async () => { const c = snapshot(s.root, s.config.files);
    return { ok: true, identity: { ...goodIdentity, actual_model: 'other-model' }, value: { candidate_hash: c.hash } }; };
  await runLoop(s);
  assert.equal(readResult(s).failure_category, 'identity_mismatch');
  s.config.evidence_dir = 'outputs/pass';
  s.adapters.review = async () => { const c = snapshot(s.root, s.config.files);
    return { ok: true, identity: goodIdentity, value: { candidate_hash: c.hash, verdict: 'PASS',
      coverage: c.files.map(f => ({ path: f.path, sha256: f.sha256, last_line: f.lines })), findings: [] } }; };
  const ok = await runLoop(s);
  assert.equal(ok.status, 'REVIEW_PASSED'); assert.equal('failure_category' in ok, false);
});
