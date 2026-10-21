import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runLoop, snapshot, validateConfig, validateReview, validateRepair, safePath } from '../runtime/review-loop/loop.mjs';
import { runProcess, processSucceeded } from '../runtime/review-loop/process.mjs';
import { liveAdapters, parseAgyModels, withDefaultReviewer } from '../runtime/review-loop/adapters.mjs';

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-loop-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'source.mjs'), 'export const value = 0;\n');
  const config = { goal: 'value 必須為 1', files: ['source.mjs'], evidence_dir: 'outputs/run',
    checks: [{ id: 'value', argv: ['$node', '--input-type=module', '-e', "import('./source.mjs').then(m=>process.exit(m.value===1?0:1))"] }],
    author_platform: 'codex', reviewer_model: 'gemini-3.8-flash-high', repair_model: 'gpt-6-sol', max_repairs: 2, timeout_ms: 3000 };
  const calls = [];
  const adapters = {
    preflight: async () => ({ ok: true }),
    review: async () => {
      calls.push('review'); const c = snapshot(root, config.files);
      return { ok: true, identity: { platform: 'antigravity', source: 'stream_init', actual_model: config.reviewer_model },
        value: { candidate_hash: c.hash, verdict: c.files[0].content.includes('= 1') ? 'PASS' : 'FAIL',
          coverage: c.files.map(f => ({ path: f.path, sha256: f.sha256, last_line: f.lines })),
          findings: c.files[0].content.includes('= 1') ? [] : [{ path: 'source.mjs', line: 1, message: '改為 1' }] } };
    },
    repair: async () => {
      calls.push('repair'); const c = snapshot(root, config.files);
      return { ok: true, identity: { platform: 'codex', source: 'controller_launch' }, value: { candidate_hash: c.hash,
        replacements: [{ path: 'source.mjs', previous_sha256: c.files[0].sha256, content: 'export const value = 1;\n' }] } };
    }
  };
  return { root, config, adapters, calls };
}

test('實際子程序檢查：FAIL 自動回修後 PASS；固定指紋、呼叫次序與新收據', async t => {
  const s = setup(t), r = await runLoop(s);
  assert.equal(r.status, 'REVIEW_PASSED'); assert.equal(r.repairs, 1);
  assert.deepEqual(s.calls, ['review', 'repair', 'review']); assert.equal(r.governance_acceptance, false);
  const old = JSON.parse(fs.readFileSync(path.join(s.root, 'outputs/run/candidate-0.json')));
  const next = JSON.parse(fs.readFileSync(path.join(s.root, 'outputs/run/candidate-1.json')));
  assert.notEqual(old.hash, next.hash);
  await assert.rejects(runLoop(s), /EVIDENCE_DIR_NOT_EMPTY/);
  assert.equal(fs.existsSync(path.join(s.root, '.harness-review-loop.lock')), false);
});

for (const [name, mutate, expected] of [
  ['未知審查', r => { r.value.verdict = 'INCONCLUSIVE'; }, 'REVIEW_INCONCLUSIVE'],
  ['工具失敗', r => { r.ok = false; }, 'REVIEW_TRANSPORT_OR_IDENTITY_FAILED'],
  ['錯誤身分', r => { r.identity.platform = 'codex'; }, 'REVIEW_TRANSPORT_OR_IDENTITY_FAILED'],
  ['模型被替換', r => { r.identity.actual_model = 'other'; }, 'REVIEW_TRANSPORT_OR_IDENTITY_FAILED'],
  ['舊收據', r => { r.value.candidate_hash = 'stale'; }, 'REVIEW_BINDING_INVALID'],
  ['缺全文覆蓋', r => { r.value.coverage = []; }, 'REVIEW_COVERAGE_MISSING'],
  ['未讀到結尾', r => { r.value.coverage[0].last_line = 999; }, 'REVIEW_COVERAGE_INVALID'],
  ['空未通過', r => { r.value.findings = []; }, 'FAIL_WITHOUT_FINDINGS'],
  ['無效行號', r => { r.value.findings[0].line = 99; }, 'REVIEW_FINDINGS_INVALID']
]) test(`${name}不能啟動回修`, async t => {
  const s = setup(t), original = s.adapters.review;
  s.adapters.review = async () => { const r = await original(); mutate(r); return r; };
  const r = await runLoop(s); assert.equal(r.status, 'INCONCLUSIVE'); assert.equal(r.reason, expected);
  assert.deepEqual(s.calls, ['review']);
});

for (const phase of ['review', 'repair']) test(`${phase}期間來源異動停止`, async t => {
  const s = setup(t), original = s.adapters[phase];
  s.adapters[phase] = async input => { const r = await original(input); fs.writeFileSync(path.join(s.root, 'source.mjs'), 'changed'); return r; };
  const r = await runLoop(s); assert.equal(r.status, 'INCONCLUSIVE'); assert.match(r.reason, /CANDIDATE_CHANGED/);
});

test('預算零不回修；無進展停止', async t => {
  const s = setup(t); s.config.max_repairs = 0;
  assert.equal((await runLoop(s)).reason, 'REPAIR_BUDGET_EXHAUSTED'); assert.deepEqual(s.calls, ['review']);
  s.config.evidence_dir = 'outputs/second'; s.config.max_repairs = 2;
  s.adapters.repair = async () => { const c = snapshot(s.root, s.config.files); return { ok: true,
    identity: { platform: 'codex', source: 'controller_launch' }, value: { candidate_hash: c.hash,
      replacements: [{ path: 'source.mjs', previous_sha256: c.files[0].sha256, content: c.files[0].content }] } }; };
  assert.equal((await runLoop(s)).reason, 'NO_PROGRESS');
});

test('修正越界／舊指紋不能寫入', async t => {
  const s = setup(t), original = s.adapters.repair;
  s.adapters.repair = async input => { const r = await original(input); r.value.replacements[0].path = '../escape'; return r; };
  assert.equal((await runLoop(s)).reason, 'REPAIR_REPLACEMENT_INVALID');
  assert.match(fs.readFileSync(path.join(s.root, 'source.mjs'), 'utf8'), /= 0/);
  const c = snapshot(s.root, s.config.files);
  assert.throws(() => validateRepair({ candidate_hash: c.hash, replacements: [{ path: 'source.mjs', previous_sha256: 'old', content: 'x' }] }, c), /INVALID/);
  assert.throws(() => validateReview({ candidate_hash: c.hash, verdict: 'PASS', coverage: [{ path: 'source.mjs', sha256: c.files[0].sha256, last_line: c.files[0].lines }], findings: [{ path: 'source.mjs', line: 1, message: 'problem' }] }, c), /PASS_WITH_FINDINGS/);
});

test('檢查 FAIL 與審查 PASS 衝突不能通過', async t => {
  const s = setup(t), original = s.adapters.review;
  s.adapters.review = async () => { const r = await original(); r.value.verdict = 'PASS'; r.value.findings = []; return r; };
  assert.equal((await runLoop(s)).reason, 'REVIEW_CHECK_CONFLICT'); assert.deepEqual(s.calls, ['review']);
});

test('排他鎖阻止重入，保留未知中斷的鎖', async t => {
  const s = setup(t); fs.writeFileSync(path.join(s.root, '.harness-review-loop.lock'), 'previous');
  await assert.rejects(runLoop(s), /EEXIST/); assert.deepEqual(s.calls, []);
  assert.equal(fs.readFileSync(path.join(s.root, '.harness-review-loop.lock'), 'utf8'), 'previous');
});

test('終止未確認保留鎖、不接受、不盲目重派', async t => {
  const s = setup(t);
  s.adapters.review = async () => ({ ok: false, raw: { signal: 'TERMINATION_UNCONFIRMED' } });
  assert.equal((await runLoop(s)).status, 'INCONCLUSIVE');
  assert.equal(fs.existsSync(path.join(s.root, '.harness-review-loop.lock')), true);
  await assert.rejects(runLoop(s), /EEXIST/);
});

test('路徑穿越、重複、證據重疊與非 node 檢查被拒', t => {
  const { root, config } = setup(t);
  for (const p of ['../source.mjs', 'C:/secret', 'dir/../source.mjs', 'dir\\file', './source.mjs']) assert.throws(() => safePath(root, p), /INVALID/);
  assert.throws(() => validateConfig({ ...config, files: ['source.mjs', 'SOURCE.mjs'] }, root), /DUPLICATE/);
  assert.throws(() => validateConfig({ ...config, checks: [{ id: 'x', argv: ['cmd.exe', '/c', 'echo'] }] }, root), /MUST_BE_NODE/);
  assert.throws(() => validateConfig({ ...config, checks: [] }, root), /REQUIRED_CHECKS/);
  assert.throws(() => validateConfig({ ...config, max_repairs: -1 }, root), /BUDGET/);
});

test('Claude 作者：非同家族審查、只審不修；同家族與回修被拒；Codex 原行為不收緊', async t => {
  const s = setup(t), { root } = s;
  const claude = { ...s.config, author_platform: 'claude', max_repairs: 0 };
  delete claude.repair_model;
  assert.equal(validateConfig(claude, root).max_repairs, 0);
  for (const reviewer_model of ['claude-opus-4-6-thinking', 'Claude-sonnet-4-6'])
    assert.throws(() => validateConfig({ ...claude, reviewer_model }, root), /SELF_REVIEW_FORBIDDEN/);
  assert.doesNotThrow(() => validateConfig({ ...claude, reviewer_model: 'new-vendor-model' }, root));
  assert.throws(() => validateConfig({ ...claude, max_repairs: undefined }, root), /REPAIR_REQUIRES_CODEX_AUTHOR/);
  assert.throws(() => validateConfig({ ...claude, max_repairs: 2, repair_model: 'gpt-6-sol' }, root), /REPAIR_REQUIRES_CODEX_AUTHOR/);
  assert.throws(() => validateConfig({ ...claude, repair_model: '../bad' }, root), /MODEL_REQUIRED/);
  for (const author_platform of ['agy', undefined])
    assert.throws(() => validateConfig({ ...s.config, author_platform }, root), /AUTHOR_PLATFORM_REQUIRED/);
  for (const reviewer_model of ['gpt-oss-120b-medium', 'claude-opus-4-6-thinking', 'new-vendor-model'])
    assert.doesNotThrow(() => validateConfig({ ...s.config, reviewer_model }, root));
  assert.throws(() => validateConfig({ ...s.config, repair_model: undefined }, root), /MODEL_REQUIRED/);
  s.config = claude;
  const r = await runLoop(s);
  assert.equal(r.reason, 'REPAIR_BUDGET_EXHAUSTED'); assert.deepEqual(s.calls, ['review']);
});

test('未設定回修模型時 adapter 不解析、不 preflight Codex', async t => {
  const s = setup(t); const ledger = path.join(s.root, 'ledger.json');
  fs.writeFileSync(ledger, JSON.stringify({ models: { [s.config.reviewer_model]: { availability: 'available' } } }));
  const launched = [];
  const adapters = liveAdapters({ root: s.root, reviewerModel: s.config.reviewer_model, repairModel: undefined, timeoutMs: 1000,
    ledgerPath: ledger, codexLauncher: () => { throw new Error('CODEX_SHOULD_NOT_RESOLVE'); }, agyLauncher: () => 'agy-fixture',
    processRunner: async (command, argv) => { launched.push(command); return { exitCode: 0, signal: null,
      stdout: argv[0] === 'models' ? `${s.config.reviewer_model}\tFixture\n` : '1.0', stderr: '', timedOut: false, overflow: false, spawnError: null }; } });
  const pre = await adapters.preflight();
  assert.equal(pre.ok, true); assert.equal(pre.codexVersion, null); assert.deepEqual(launched, ['agy-fixture', 'agy-fixture']);
  const repair = await adapters.repair('x');
  assert.equal(repair.ok, false); assert.equal(repair.error, 'REPAIR_NOT_CONFIGURED'); assert.deepEqual(launched, ['agy-fixture', 'agy-fixture']);
});

test('符號連結來源與證據路徑拒絕', t => {
  const s = setup(t);
  try { fs.symlinkSync(s.root, path.join(s.root, 'alias'), 'junction'); }
  catch (e) { if (e.code === 'EPERM') { t.skip('此環境不允許建立連結'); return; } throw e; }
  assert.throws(() => safePath(s.root, 'alias/source.mjs'), /SYMLINK/);
  assert.throws(() => safePath(s.root, 'alias/new', { existing: false }), /SYMLINK/);
});

test('硬連結只替換指定名稱，不寫穿別名；唯讀規格不能修改', async t => {
  const s = setup(t);
  fs.linkSync(path.join(s.root, 'source.mjs'), path.join(s.root, 'hard.mjs'));
  assert.equal((await runLoop(s)).status, 'REVIEW_PASSED');
  assert.match(fs.readFileSync(path.join(s.root, 'hard.mjs'), 'utf8'), /= 0/);
  assert.match(fs.readFileSync(path.join(s.root, 'source.mjs'), 'utf8'), /= 1/);
  s.config.evidence_dir = 'outputs/readonly';
  fs.writeFileSync(path.join(s.root, 'spec.txt'), '固定規格');
  s.config.read_only_files = ['spec.txt'];
  const c = snapshot(s.root, s.config.files, s.config.read_only_files);
  assert.throws(() => validateRepair({ candidate_hash: c.hash, replacements: [{ path: 'spec.txt', previous_sha256: c.files.find(f=>f.path==='spec.txt').sha256, content: '改掉' }] }, c), /REPLACEMENT_INVALID/);
  const original = s.adapters.review;
  s.adapters.review = async () => { const r = await original(); fs.writeFileSync(path.join(s.root, 'spec.txt'), '異動'); return r; };
  assert.equal((await runLoop(s)).reason, 'CANDIDATE_CHANGED_DURING_REVIEW');
});

test('真子程序 stdin、UTF-8 分片、nonzero、逾時與輸出上限', async () => {
  const echo = await runProcess(process.execPath, ['-e', "process.stdin.on('data',d=>process.stdout.write(d))"], { input: '繁體中文', timeoutMs: 2000 });
  assert.equal(echo.stdout, '繁體中文'); assert.equal(processSucceeded(echo), true);
  const bad = await runProcess(process.execPath, ['-e', 'process.exit(3)'], { timeoutMs: 2000 }); assert.equal(processSucceeded(bad), false);
  const timeout = await runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 100 }); assert.equal(timeout.timedOut, true);
  const overflow = await runProcess(process.execPath, ['-e', "process.stdout.write('x'.repeat(10000))"], { maxBytes: 100, timeoutMs: 2000 }); assert.equal(overflow.overflow, true);
});

test('正式 adapter 核對 init、狀態、拒絕、警告、截斷，不放寬既有讀檔判讀器', async t => {
  const s = setup(t); const ledger = path.join(s.root, 'ledger.json');
  fs.writeFileSync(ledger, JSON.stringify({ models: { [s.config.reviewer_model]: { availability: 'available' } } }));
  let response = { exitCode: 0, signal: null, stdout: '', stderr: '', timedOut: false, overflow: false, spawnError: null };
  let launch;
  const adapters = liveAdapters({ root: s.root, reviewerModel: s.config.reviewer_model, repairModel: s.config.repair_model,
    timeoutMs: 1000, ledgerPath: ledger, codexLauncher: () => ({ command: process.execPath, prefix: ['codex-fixture.js'] }), agyLauncher: () => 'agy-fixture',
    processRunner: async (command, argv, opts) => { launch = { command, argv, opts }; return response; } });
  const stream = (model, result) => JSON.stringify({ event: 'init', init: { model } }) + '\n' + JSON.stringify({ event: 'result', result });
  response.stdout = stream(s.config.reviewer_model, { status: 'SUCCESS', response: '{"verdict":"PASS"}', denied_actions: [] });
  assert.equal((await adapters.review('sensitive-prompt-token')).ok, true);
  assert.equal(launch.opts.input, 'sensitive-prompt-token'); assert.equal(launch.argv.includes('sensitive-prompt-token'), false);
  assert.equal(launch.argv.includes('--sandbox'), true); assert.equal(launch.argv.includes('accept-edits'), false);
  for (const change of [
    { exitCode: 1 }, { overflow: true }, { stderr: 'warning: issue' },
    { stdout: stream('different', { status: 'SUCCESS', response: '{}' }) },
    { stdout: stream(s.config.reviewer_model, { status: 'SUCCESS', response: '{}', denied_actions: [{ action: 'read' }] }) },
    { stdout: JSON.stringify({ event: 'init', init: { model: s.config.reviewer_model } }) }
  ]) { const before = response; response = { ...response, ...change }; assert.equal((await adapters.review('x')).ok, false); response = before; }
  response.stdout = [ { type: 'item.completed', item: { type: 'agent_message', text: '{}' } }, { type: 'turn.completed' } ].map(JSON.stringify).join('\n');
  assert.equal((await adapters.repair('repair-prompt')).ok, true);
  assert.equal(launch.argv[launch.argv.indexOf('--sandbox') + 1], 'read-only'); assert.equal(launch.argv.at(-1), '-');
  response.stdout = JSON.stringify({ type: 'turn.failed' }); assert.equal((await adapters.repair('x')).ok, false);
});

const AGY_135_MODELS = 'Fetching available models...\ngemini-3.8-flash-high\tGemini 3.8 Flash (High)\ngemini-3.8-flash-low\tGemini 3.8 Flash (Low)\r\ngpt-oss-120b-medium\tGPT-OSS 120B (Medium)\n';

function fakeAgy(t, { reviewerModel = 'gemini-3.8-flash-high', reviewerEffort, models = { exitCode: 0, stdout: AGY_135_MODELS } } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-loop-agy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const ledger = path.join(root, 'ledger.json');
  fs.writeFileSync(ledger, JSON.stringify({ models: { [reviewerModel]: { availability: 'available' } } }));
  const launches = [];
  const base = { exitCode: 0, signal: null, stdout: '1.3.5', stderr: '', timedOut: false, overflow: false, spawnError: null };
  const adapters = liveAdapters({ root, reviewerModel, reviewerEffort, repairModel: undefined, timeoutMs: 1000, ledgerPath: ledger,
    codexLauncher: () => { throw new Error('CODEX_SHOULD_NOT_RESOLVE'); }, agyLauncher: () => 'agy-fixture',
    processRunner: async (command, argv, opts) => { launches.push({ argv, opts });
      return argv[0] === 'models' ? { ...base, ...models } : argv[0] === '--version' ? base :
        { ...base, stdout: JSON.stringify({ event: 'init', init: { model: reviewerModel } }) + '\n' +
          JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: '{"verdict":"PASS"}', denied_actions: [] } }) }; } });
  return { adapters, launches };
}

test('agy models 解析：只取 id 欄，略過提示行與 CRLF', () => {
  assert.deepEqual(parseAgyModels(AGY_135_MODELS), ['gemini-3.8-flash-high', 'gemini-3.8-flash-low', 'gpt-oss-120b-medium']);
  assert.deepEqual(parseAgyModels('Fetching available models...\n'), []);
});

test('effort 預設不送；設定檔明確指定才送，且唯讀旗標不變', async t => {
  const plain = fakeAgy(t);
  assert.equal((await plain.adapters.review('x')).ok, true);
  const argv = plain.launches.at(-1).argv;
  assert.equal(argv.includes('--effort'), false);
  for (const flag of ['--sandbox', '--model']) assert.equal(argv.includes(flag), true);
  assert.equal(argv[argv.indexOf('--mode') + 1], 'plan'); assert.equal(argv[argv.indexOf('--output-format') + 1], 'stream-json');
  const withEffort = fakeAgy(t, { reviewerEffort: 'medium' });
  const r = await withEffort.adapters.review('x');
  assert.equal(r.ok, true); assert.equal(r.identity.requested_effort, 'medium');
  const argv2 = withEffort.launches.at(-1).argv;
  assert.equal(argv2[argv2.indexOf('--effort') + 1], 'medium');
  assert.throws(() => fakeAgy(t, { reviewerEffort: 'max' }), /AGY_EFFORT_INVALID/);
});

test('設定檔 reviewer_effort 值域驗證；省略時不補預設', t => {
  const s = setup(t);
  assert.equal(validateConfig(s.config, s.root).reviewer_effort, undefined);
  assert.equal(validateConfig({ ...s.config, reviewer_effort: 'low' }, s.root).reviewer_effort, 'low');
  for (const bad of ['max', '', null, 'accept-edits']) assert.throws(() => validateConfig({ ...s.config, reviewer_effort: bad }, s.root), /REVIEWER_EFFORT_INVALID/);
});

test('指定審查模型不在本次 agy models 清單：明確錯誤、不自動換模型、不送審', async t => {
  const gone = fakeAgy(t, { reviewerModel: 'gemini-3.1-pro-high' });
  const pre = await gone.adapters.preflight();
  assert.equal(pre.ok, false); assert.equal(pre.error, 'REVIEWER_MODEL_NOT_OFFERED');
  assert.match(pre.message, /gemini-3.1-pro-high/); assert.match(pre.message, /gemini-3.8-flash-high/);
  assert.equal(pre.argv[pre.argv.indexOf('--model') + 1], 'gemini-3.1-pro-high');
  const failed = fakeAgy(t, { models: { exitCode: 1, stdout: '' } });
  const pre2 = await failed.adapters.preflight();
  assert.equal(pre2.ok, false); assert.equal(pre2.error, 'AGY_MODELS_UNAVAILABLE');
  const ok = await fakeAgy(t).adapters.preflight();
  assert.equal(ok.ok, true);
});

test('runLoop：模型下架時 INCONCLUSIVE 並帶可讀原因，不進審查', async t => {
  const s = setup(t);
  s.adapters.preflight = async () => ({ ok: false, error: 'REVIEWER_MODEL_NOT_OFFERED', message: '審查模型 gemini-3.1-pro-high 不在本次 agy models 清單' });
  const r = await runLoop(s);
  assert.equal(r.status, 'INCONCLUSIVE'); assert.equal(r.reason, 'REVIEWER_MODEL_NOT_OFFERED');
  assert.match(r.detail, /gemini-3.1-pro-high/); assert.deepEqual(s.calls, []);
  s.config.evidence_dir = 'outputs/run2';
  s.adapters.preflight = async () => ({ ok: false, error: 'VERSION_CHECK_FAILED' });
  assert.equal((await runLoop(s)).reason, 'PREFLIGHT_FAILED');
});

test('設定檔省略 reviewer_model 時用帳本審查預設；明確指定不覆寫；正式帳本預設可用且非 Claude', () => {
  const ledger = { modes: { review: { default_model: 'gemini-3.8-flash-high' } } };
  assert.equal(withDefaultReviewer({ goal: 'x' }, ledger).reviewer_model, 'gemini-3.8-flash-high');
  assert.equal(withDefaultReviewer({ reviewer_model: 'gpt-oss-120b-medium' }, ledger).reviewer_model, 'gpt-oss-120b-medium');
  assert.equal(withDefaultReviewer({ goal: 'x' }, { modes: {} }).reviewer_model, undefined);
  const real = JSON.parse(fs.readFileSync(new URL('../runtime/agy/capabilities.json', import.meta.url), 'utf8'));
  const chosen = real.modes.review.default_model;
  assert.equal(real.models[chosen]?.availability, 'available'); assert.doesNotMatch(chosen, /^claude-/i);
});
