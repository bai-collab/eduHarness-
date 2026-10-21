// S3：AGY 審查工具使用偵測＋每次呼叫的空暫存目錄（整潔措施，非安全邊界）。
// 全部離線：假 processRunner／假 launcher，不呼叫真實 agy。真實串流樣本只在執行時讀入，不複製進原始碼。
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { liveAdapters, scanAgyStream, ISOLATION_DIR_PREFIX, PREFLIGHT_ADD_DIR_PLACEHOLDER, TOOL_USE_CODE } from '../runtime/review-loop/adapters.mjs';
import { classifyReviewFailure } from '../runtime/review-loop/failure-category.mjs';
import { runLoop, snapshot } from '../runtime/review-loop/loop.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const MODEL = 'gemini-3.8-flash-low';
const SAMPLES = {
  // 樣本自舊工作區 AGY 探測紀錄複製並去識別（絕對路徑換成 WORKSPACE_ROOT／TEMP_DIR，結構與事件不變）。
  F6d: 'harness/tests/fixtures/review-loop/F6d.stdout.txt',
  F4: 'harness/tests/fixtures/review-loop/F4.stdout.txt',
  F13: 'harness/tests/fixtures/review-loop/F13.stdout.txt',
  S3PROBE: 'harness/tests/fixtures/review-loop/s3-probe.out.jsonl'
};
const readSample = id => fs.readFileSync(path.join(REPO, SAMPLES[id]), 'utf8');
const base = { exitCode: 0, signal: null, stdout: '', stderr: '', timedOut: false, overflow: false, spawnError: null };
const line = obj => JSON.stringify(obj);
const init = (model = MODEL) => line({ event: 'init', init: { model } });
const step = (step_type, extra = {}) => line({ event: 'step_update', step_update: { step_index: 1, state: 'DONE', step_type, ...extra } });
const result = (response, extra = {}) => line({ event: 'result', result: { status: 'SUCCESS', response, ...extra } });
const isInside = (parent, child) => {
  const rel = path.relative(fs.realpathSync(parent).toLowerCase(), path.resolve(child).toLowerCase());
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

// 假 agy：preflight 指令回固定值，審查呼叫交給 respond(argv, opts)。
function harness(t, respond, { model = MODEL } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-loop-iso-root-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const ledgerPath = path.join(root, 'ledger.json');
  fs.writeFileSync(ledgerPath, JSON.stringify({ models: { [model]: { availability: 'available' } } }));
  const launches = [];
  const processRunner = async (command, argv, opts) => {
    if (argv[0] === '--version') return { ...base, stdout: '1.4.3' };
    if (argv[0] === 'models') return { ...base, stdout: `${model}\tModel\n` };
    launches.push({ argv, opts });
    return respond(argv, opts);
  };
  const adapters = liveAdapters({ root, reviewerModel: model, repairModel: undefined, timeoutMs: 5000, ledgerPath,
    codexLauncher: () => { throw new Error('CODEX_SHOULD_NOT_RESOLVE'); }, agyLauncher: () => 'agy-fixture', processRunner });
  return { root, adapters, launches };
}
const okStream = () => [init(), step('user_input'), step('agent_response', { text_delta: '{"verdict":"PASS"}' }), result('{"verdict":"PASS"}')].join('\n');

// ---- 空暫存目錄 ----

test('空目錄：argv --add-dir 與 cwd 是同一個暫存目錄、不在 root 底下；呼叫後該路徑已刪；兩次目錄不同', async t => {
  const seen = [];
  const h = harness(t, (argv, opts) => {
    const addDir = argv[argv.indexOf('--add-dir') + 1];
    seen.push({ addDir, cwd: opts.cwd, existedDuringCall: fs.existsSync(opts.cwd), entries: fs.readdirSync(opts.cwd).length });
    return { ...base, stdout: okStream() };
  });
  const r1 = await h.adapters.review('x');
  const r2 = await h.adapters.review('x');
  assert.equal(r1.ok, true); assert.equal(r2.ok, true);
  assert.equal(seen.length, 2);
  for (const s of seen) {
    assert.equal(s.addDir, s.cwd);
    assert.equal(path.basename(s.cwd).startsWith(ISOLATION_DIR_PREFIX), true);
    assert.equal(isInside(os.tmpdir(), s.cwd), true);
    assert.equal(isInside(h.root, s.cwd), false);
    assert.equal(s.existedDuringCall, true); assert.equal(s.entries, 0);
    assert.equal(fs.existsSync(s.cwd), false, '抓到的那個暫存路徑應已刪除');
  }
  assert.notEqual(seen[0].cwd, seen[1].cwd);
  assert.equal(r1.isolation_dir_dirty, false); assert.equal(r1.isolation_dir_cleanup_failed, undefined);
  assert.equal(r1.step_events_seen, true); assert.equal(r1.tool_visibility_unverified, false);
});

test('preflight 只記樣板 add-dir；建構時仍提早拒絕不合法 effort', async t => {
  const h = harness(t, () => ({ ...base, stdout: okStream() }));
  const pre = await h.adapters.preflight();
  assert.equal(pre.ok, true);
  assert.equal(pre.argv[pre.argv.indexOf('--add-dir') + 1], PREFLIGHT_ADD_DIR_PLACEHOLDER);
  assert.equal(pre.argv.includes(h.root), false);
  const ledgerPath = path.join(h.root, 'ledger.json');
  assert.throws(() => liveAdapters({ root: h.root, reviewerModel: MODEL, reviewerEffort: 'max', timeoutMs: 5000, ledgerPath,
    agyLauncher: () => 'agy-fixture', processRunner: async () => base }), /AGY_EFFORT_INVALID/);
});

test('processRunner 拋錯時暫存目錄仍刪除，原錯誤照常拋出', async t => {
  let captured;
  const h = harness(t, (argv, opts) => { captured = opts.cwd; throw new Error('RUNNER_EXPLODED'); });
  await assert.rejects(h.adapters.review('x'), /RUNNER_EXPLODED/);
  assert.equal(typeof captured, 'string');
  assert.equal(fs.existsSync(captured), false);
});

test('清除失敗（模擬 EBUSY）不拒絕：回 isolation_dir_cleanup_failed 與路徑，raw.signal 保留', async t => {
  let captured;
  const h = harness(t, (argv, opts) => { captured = opts.cwd; fs.writeFileSync(path.join(opts.cwd, 'left.txt'), 'x');
    return { ...base, exitCode: null, signal: 'TERMINATION_UNCONFIRMED', stdout: okStream() }; });
  const original = fs.rmSync;
  const rm = mock.method(fs, 'rmSync', (p, o) => {
    if (String(p).includes(ISOLATION_DIR_PREFIX)) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
    return original(p, o);
  });
  let r;
  try { r = await h.adapters.review('x'); }
  finally { rm.mock.restore(); }
  t.after(() => fs.rmSync(captured, { recursive: true, force: true }));
  assert.equal(r.isolation_dir_cleanup_failed, true);
  assert.equal(r.isolation_dir, captured);
  assert.equal(r.isolation_dir_dirty, true);
  assert.equal(r.raw.signal, 'TERMINATION_UNCONFIRMED');
  assert.equal(r.ok, false);
});

// ---- 偵測：真實串流樣本 ----

const SAMPLE_EXPECT = {
  F6d: { reasons: ['step_type_not_allowed'], steps: [] },
  F4: { reasons: ['denied_actions', 'event_not_allowed'], steps: [] },
  F13: { reasons: ['step_type_not_allowed', 'tool_field', 'tool_step'], steps: [{ name: 'view_file', state: 'DONE' }] },
  S3PROBE: { reasons: ['step_type_not_allowed', 'tool_field', 'tool_step'], steps: [{ name: 'read_file', state: 'DONE' }] }
};

// 從樣本取出工具參數與輸出字串，確認它們不出現在回傳物件中（不把內容寫進原始碼）。
function toolPayloadStrings(stdout) {
  const out = [];
  for (const l of stdout.split(/\r?\n/)) {
    let o; try { o = JSON.parse(l); } catch { continue; }
    const info = o?.step_update?.tool_info;
    if (!info) continue;
    const walk = v => { if (typeof v === 'string' && v.length >= 8) out.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(info.parameters); walk(info.output);
  }
  return out;
}

for (const id of Object.keys(SAMPLES)) {
  test(`真實串流 ${id}：不採信、原因正確、stdout 清空、分類為 tool_use_detected`, async t => {
    const stdout = readSample(id);
    // 用串流中的實際模型名稱，確保失敗原因只來自偵測。
    const model = stdout.split(/\r?\n/).map(l => { try { return JSON.parse(l); } catch { return null; } })
      .find(o => o?.event === 'init')?.init?.model ?? MODEL;
    const h = harness(t, () => ({ ...base, stdout }), { model });
    const r = await h.adapters.review('x');
    assert.equal(r.ok, false); assert.equal(r.value, null);
    assert.equal(r.tool_use_suspected, true);
    assert.deepEqual([...r.suspect_reasons].sort(), SAMPLE_EXPECT[id].reasons);
    assert.deepEqual(r.tool_steps, SAMPLE_EXPECT[id].steps);
    assert.equal(r.raw.stdout, ''); assert.equal(r.raw.stdout_omitted, TOOL_USE_CODE);
    assert.equal(r.raw.stdout_bytes, Buffer.byteLength(stdout, 'utf8'));
    assert.equal(typeof r.raw.event_type_counts, 'object');
    assert.equal(r.call.error, TOOL_USE_CODE);
    const serialized = JSON.stringify(r);
    for (const s of toolPayloadStrings(stdout)) assert.equal(serialized.includes(s), false);
    const f = classifyReviewFailure(r, model);
    assert.equal(f.category, 'tool_use_detected');
    assert.equal(f.evidence[0], 'rule:tool_use');
  });
}

// ---- 偵測：合成條件 ----

test('非白名單 step_type（finish 與虛構型別）、只有 denied_actions、無法解析的行 → tool_use_detected', async t => {
  const cases = [
    [[init(), step('user_input'), step('finish'), result('{}')], 'step_type_not_allowed'],
    [[init(), step('user_input'), step('imaginary_kind_zz'), result('{}')], 'step_type_not_allowed'],
    [[init(), step('user_input'), result('{}', { denied_actions: [{ action: 'x' }] })], 'denied_actions'],
    [[init(), step('user_input'), 'not json at all', result('{}')], 'unparsable_line'],
    [[init(), step('user_input'), line({ event: 'mystery_event' }), result('{}')], 'event_not_allowed'],
    [[init(), step('agent_response', { tool_call: { name: 'x' } }), result('{}')], 'tool_field']
  ];
  for (const [lines, reason] of cases) {
    const h = harness(t, () => ({ ...base, stdout: lines.join('\n') }));
    const r = await h.adapters.review('x');
    assert.equal(r.ok, false, reason); assert.equal(r.value, null);
    assert.equal(r.suspect_reasons.includes(reason), true, reason);
    assert.equal(classifyReviewFailure(r, MODEL).category, 'tool_use_detected', reason);
  }
});

test('工具事件＋逾時：分類仍為 tool_use_detected（優先於 timeout），運輸欄位保留', async t => {
  const stdout = [init(), step('user_input'), step('tool', { tool_name: 'read_file', state: 'ACTIVE', tool_info: { name: 'read_file' } })].join('\n');
  const h = harness(t, () => ({ ...base, exitCode: null, timedOut: true, stdout, stderr: 'some stderr' }));
  const r = await h.adapters.review('x');
  assert.equal(r.ok, false); assert.equal(r.value, null);
  assert.equal(r.raw.timedOut, true); assert.equal(r.raw.exitCode, null); assert.equal(r.raw.stderr, 'some stderr');
  assert.equal(r.raw.stdout, '');
  assert.deepEqual(r.tool_steps, [{ name: 'read_file', state: 'ACTIVE' }]);
  const f = classifyReviewFailure(r, MODEL);
  assert.equal(f.category, 'tool_use_detected');
  assert.equal(f.evidence.some(e => e.startsWith('exit_code')), false);
});

test('tool_steps 的 name／state 限 64 字與字元集，不帶參數', () => {
  const longName = 'a'.repeat(80) + '/x y';
  const s = scanAgyStream([init(), step('tool', { tool_name: longName, state: 'DONE\nX', tool_info: { parameters: { p: 'secret-ish-path' } } })].join('\n'));
  assert.equal(s.toolSteps.length, 1);
  assert.equal(s.toolSteps[0].name, 'a'.repeat(64));
  assert.equal(s.toolSteps[0].state, 'DONE?X');
  assert.deepEqual(Object.keys(s.toolSteps[0]).sort(), ['name', 'state']);
  const odd = scanAgyStream(step('tool', { tool_name: 'x:y/z', state: 'S' }));
  assert.equal(odd.toolSteps[0].name, 'x:y?z');
});

// ---- 不誤擋 ----

test('正常串流：text_delta 內容含 tool_name、step_type 字樣不誤擋', async t => {
  const text = '審查重點：程式會檢查 "tool_name" 與 "step_type" 欄位，也提到 tool_info 與 denied_actions。';
  const stdout = [init(), step('user_input'), step('agent_response', { text_delta: text }), step('system_message'),
    result('{"verdict":"PASS","note":"tool_name step_type tool_call"}', { denied_actions: [] })].join('\n');
  const h = harness(t, () => ({ ...base, stdout }));
  const r = await h.adapters.review('x');
  assert.equal(r.ok, true);
  assert.equal(r.tool_use_suspected, undefined);
  assert.equal(r.raw.stdout, stdout);
  assert.equal(r.step_events_seen, true); assert.equal(r.tool_visibility_unverified, false);
});

test('沒有 step 事件的串流：ok 照舊，只標 tool_visibility_unverified', async t => {
  const h = harness(t, () => ({ ...base, stdout: [init(), result('{"verdict":"PASS"}', { denied_actions: [] })].join('\n') }));
  const r = await h.adapters.review('x');
  assert.equal(r.ok, true);
  assert.equal(r.step_events_seen, false); assert.equal(r.tool_visibility_unverified, true);
  assert.equal(r.tool_use_suspected, undefined);
});

// ---- 落盤 ----

function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

test('落盤：工具步驟＋SUCCESS＋findings 內含 canary 的合法 review JSON → value 為 null、evidence_dir 0 筆 canary 與參數路徑', async t => {
  const canary = `CANARY-${crypto.randomUUID()}`;
  const canaryPath = path.join(os.tmpdir(), `canary-${crypto.randomUUID()}.txt`);
  let root;
  const h = harness(t, (argv, opts) => {
    const c = snapshot(root, ['source.mjs']);
    const review = { candidate_hash: c.hash, verdict: 'FAIL',
      coverage: c.files.map(f => ({ path: f.path, sha256: f.sha256, last_line: f.lines })),
      findings: [{ path: 'source.mjs', line: 1, message: `讀到 ${canary}` }] };
    const stdout = [init(), step('user_input'),
      line({ event: 'step_update', step_update: { step_index: 2, state: 'ACTIVE', step_type: 'tool', tool_name: 'read_file', tool_info: { name: 'read_file', parameters: { AbsolutePath: canaryPath } } } }),
      line({ event: 'step_update', step_update: { step_index: 2, state: 'DONE', step_type: 'tool', tool_name: 'read_file', tool_info: { name: 'read_file', parameters: { AbsolutePath: canaryPath }, output: canary } } }),
      step('agent_response', { step_index: 3, text_delta: canary }),
      result(JSON.stringify(review), { denied_actions: [] })].join('\n');
    return { ...base, stdout, stderr: '' };
  });
  root = h.root;
  fs.writeFileSync(path.join(root, 'source.mjs'), 'export const value = 1;\n');
  const config = { goal: '審查 source.mjs', files: ['source.mjs'], evidence_dir: 'outputs/iso-run',
    checks: [{ id: 'noop', argv: ['$node', '-e', 'process.exit(0)'] }],
    author_platform: 'claude', reviewer_model: MODEL, max_repairs: 0, timeout_ms: 5000 };
  const r = await runLoop({ root, config, adapters: h.adapters });
  assert.equal(r.status, 'INCONCLUSIVE');
  assert.equal(r.reason, 'REVIEW_TRANSPORT_OR_IDENTITY_FAILED');
  assert.equal(r.failure_category, 'tool_use_detected');
  assert.equal(r.failure_evidence[0], 'rule:tool_use');
  const evidenceDir = path.join(root, 'outputs/iso-run');
  const saved = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'review-0.json'), 'utf8'));
  assert.equal(saved.value, null);
  assert.equal(saved.ok, false);
  assert.equal(saved.call.error, TOOL_USE_CODE);
  assert.equal(saved.raw.stdout, '');
  assert.deepEqual(saved.tool_steps, [{ name: 'read_file', state: 'DONE' }]);
  const files = walkFiles(evidenceDir);
  assert.ok(files.length >= 5);
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(text.includes(canary), false, `${path.basename(file)} 含 canary`);
    assert.equal(text.includes(canaryPath), false, `${path.basename(file)} 含參數路徑`);
    assert.equal(text.includes(JSON.stringify(canaryPath).slice(1, -1)), false, `${path.basename(file)} 含跳脫後參數路徑`);
  }
  assert.equal(fs.existsSync(h.launches[0].opts.cwd), false);
  assert.equal(fs.existsSync(path.join(root, '.harness-review-loop.lock')), false);
});
