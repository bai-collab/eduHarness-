import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findSecrets, maskSecrets, deepMask } from '../runtime/review-loop/secret-scan.mjs';
import { runLoop, snapshot, sha } from '../runtime/review-loop/loop.mjs';

// 本檔所有假秘密一律在執行時拼接產生；原始碼中不得出現任何可被規則命中的字面值。
const LOWER = 'abcdefghijklmnopqrstuvwxyz', UPPER = LOWER.toUpperCase(), DIGITS = '0123456789';
const ALNUM = UPPER + LOWER + DIGITS;
const gen = (n, alphabet = ALNUM, seed = 0) => Array.from({ length: n }, (_, i) => alphabet[(i * 7 + seed * 13 + 3) % alphabet.length]).join('');
const D5 = '-'.repeat(5);
const pem = (kind = 'RSA PRIVATE KEY', body = gen(48, ALNUM, 9), end = true) =>
  `${D5}BEGIN ${kind}${D5}\n${body}\n${body.split('').reverse().join('')}\n` + (end ? `${D5}END ${kind}${D5}` : '');

// 每條規則：[pattern_id, 正例, 近似反例]
const CASES = [
  ['anthropic_key', 'sk-' + 'ant-api03-' + gen(40, ALNUM, 1), 'sk-' + 'ant-api03-' + gen(20, ALNUM, 1)],
  ['openai_project_key', 'sk-' + 'proj-' + gen(48, ALNUM, 2), 'sk-' + 'proj-' + gen(30, ALNUM, 2)],
  ['openai_legacy_key', 'sk-' + gen(48, ALNUM, 3), 'my-sk-' + gen(48, ALNUM, 3)],
  ['aws_access_key_id', 'AK' + 'IA' + gen(16, UPPER + DIGITS, 4), 'AK' + 'IA' + gen(17, UPPER + DIGITS, 4)],
  ['github_token', 'gh' + 'p_' + gen(36, ALNUM, 5), 'gh' + 'p_' + gen(20, ALNUM, 5)],
  ['github_pat', 'github' + '_pat_' + gen(22, ALNUM, 6) + '_' + gen(59, ALNUM, 7), 'github' + '_pat_' + gen(21, ALNUM, 6) + '_' + gen(59, ALNUM, 7)],
  ['slack_token', 'xo' + 'xb-' + gen(12, DIGITS, 8) + '-' + gen(24, ALNUM, 8), 'xo' + 'xb-' + gen(12, LOWER, 8) + '-' + gen(24, ALNUM, 8)],
  ['google_api_key', 'AI' + 'za' + gen(35, ALNUM, 9), 'AI' + 'za' + gen(34, ALNUM, 9)],
  ['google_oauth_access_token', 'ya' + '29.' + gen(40, ALNUM, 10), 'ya' + '29.' + gen(12, ALNUM, 10)],
  ['google_oauth_client_secret', 'GOC' + 'SPX-' + gen(28, ALNUM, 11), 'GOC' + 'SPX-' + gen(27, ALNUM, 11)],
  ['private_key_block', pem(), pem('PUBLIC KEY')],
  ['jwt', 'ey' + 'J' + gen(20, ALNUM, 12) + '.ey' + 'J' + gen(20, ALNUM, 13) + '.' + gen(30, ALNUM, 14), 'ey' + 'J' + gen(20, ALNUM, 12) + '.' + gen(20, ALNUM, 13) + '.' + gen(30, ALNUM, 14)],
  ['bearer_token', 'Authorization: ' + 'Bear' + 'er ' + gen(32, ALNUM, 15), 'Bear' + 'er ' + gen(32, LOWER, 15)],
  ['azure_storage_account_key', 'Account' + 'Key=' + gen(86, ALNUM + '+/', 16) + '==', 'Account' + 'Key=' + gen(85, ALNUM + '+/', 16) + '==']
];
const ids = text => findSecrets(text).map(h => h.pattern_id);
// 假秘密主體（去掉固定前綴的部分）；任何長度 ≥12 的子字串都不准出現在證據或事件中。
const PEM_BODY = gen(48, ALNUM, 9);
const BODIES = CASES.map(([id, positive]) => id === 'private_key_block' ? PEM_BODY : positive.slice(-24));
const KEY = CASES[0][1];

function substrings(body, n = 12) { const out = []; for (let i = 0; i + n <= body.length; i++) out.push(body.slice(i, i + n)); return out; }
function assertNoLeak(text, bodies = BODIES) {
  for (const b of bodies) for (const s of substrings(b)) assert.equal(text.includes(s), false, `洩漏片段（規則主體第 ${b.indexOf(s)} 字起）`);
}
function readAll(dir) {
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir, { withFileTypes: true }).map(e => e.isDirectory() ? readAll(path.join(dir, e.name)) : fs.readFileSync(path.join(dir, e.name), 'utf8')).join('\n');
}

test('每條規則：正例命中、近似反例不命中', () => {
  for (const [id, positive, negative] of CASES) {
    assert.ok(ids(`前文 ${positive} 後文`).includes(id), `${id} 正例`);
    assert.equal(ids(`前文 ${negative} 後文`).includes(id), false, `${id} 反例`);
    const masked = maskSecrets(`前文 ${positive} 後文`);
    assert.match(masked, new RegExp(`\\[REDACTED:${id}\\]`)); assertNoLeak(masked);
  }
});

test('誤判語料不命中：kebab、sha256、UUID、已遮罩標記、一般程式碼', () => {
  const corpus = ['task-selection-layout-plan', 'risk-assessment-and-mitigation-steps-for-review-loop-module',
    crypto.createHash('sha256').update('x').digest('hex'), crypto.randomUUID(), '[REDACTED:x]', '[REDACTED:anthropic_key]',
    'export const value = 1;', 'desk-' + gen(40, LOWER), 'Bearer token missing', 'AccountKey=short==',
    fs.readFileSync(new URL('../runtime/review-loop/loop.mjs', import.meta.url), 'utf8')];
  for (const text of corpus) assert.deepEqual(findSecrets(text), [], text.slice(0, 40));
});

test('findSecrets 只回 line／pattern_id、結果穩定、行號正確；同字串兩個秘密都遮', () => {
  const text = `第一行\n第二行 ${KEY}\n${CASES[3][1]} 與 ${CASES[4][1]}\n`;
  const a = findSecrets(text), b = findSecrets(text);
  assert.deepEqual(a, b);
  assert.deepEqual(a, [{ line: 2, pattern_id: 'anthropic_key' }, { line: 3, pattern_id: 'aws_access_key_id' }, { line: 3, pattern_id: 'github_token' }]);
  for (const h of a) assert.deepEqual(Object.keys(h).sort(), ['line', 'pattern_id']);
  assertNoLeak(JSON.stringify(a));
  const two = maskSecrets(`${KEY} 和 ${KEY}`);
  assert.equal(two, '[REDACTED:anthropic_key] 和 [REDACTED:anthropic_key]');
});

test('PEM 本體不出現（含無 END 的截斷）；deepMask 回新物件與 redactions', () => {
  const full = maskSecrets(`前\n${pem()}\n後`);
  assert.equal(full, '前\n[REDACTED:private_key_block]\n後'); assertNoLeak(full);
  const cut = maskSecrets(`前\n${pem(undefined, undefined, false)}尾巴`);
  assert.equal(cut, '前\n[REDACTED:private_key_block]'); assertNoLeak(cut);
  const pgp = maskSecrets(pem('PGP PRIVATE KEY BLOCK')); assertNoLeak(pgp);
  const input = { raw: { stdout: `x ${KEY}`, stderr: '' }, list: [pem()], [KEY]: 1 };
  const before = JSON.stringify(input);
  const m = deepMask(input);
  assert.equal(JSON.stringify(input), before, '原物件不可被改動');
  assertNoLeak(JSON.stringify(m.value)); assertNoLeak(JSON.stringify(m.redactions));
  assert.deepEqual(m.redactions.map(r => [r.field, r.pattern_id, r.count]), [
    ['raw.stdout', 'anthropic_key', 1], ['list[0]', 'private_key_block', 1], ['[REDACTED:anthropic_key](key)', 'anthropic_key', 1]]);
});

// ---- runLoop 整合：注入假 adapter 與假 processRunner ----
function setup(t, { content = 'export const value = 1;\n', author = 'claude', stdout = 'ok', stderr = '' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-loop-secret-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'source.mjs'), content);
  const config = { goal: 'value 必須為 1', files: ['source.mjs'], evidence_dir: 'outputs/run',
    checks: [{ id: 'value', argv: ['$node', '-e', '0'] }], author_platform: author, reviewer_model: 'gemini-3.8-flash-high',
    max_repairs: author === 'codex' ? 1 : 0, ...(author === 'codex' ? { repair_model: 'gpt-6-sol' } : {}), timeout_ms: 3000 };
  const calls = { preflight: 0, check: 0, review: 0, repair: 0 }, inputs = [], events = [];
  const pass = () => { const c = snapshot(root, config.files);
    return { ok: true, identity: { platform: 'antigravity', source: 'stream_init', actual_model: config.reviewer_model },
      value: { candidate_hash: c.hash, verdict: 'PASS', coverage: c.files.map(f => ({ path: f.path, sha256: f.sha256, last_line: f.lines })), findings: [] } }; };
  const s = { root, config, calls, inputs, events, pass, out: { stdout, stderr },
    processRunner: async () => { calls.check++; return { exitCode: 0, signal: null, stdout: s.out.stdout, stderr: s.out.stderr, timedOut: false, overflow: false, spawnError: null }; },
    onEvent: e => events.push(e),
    adapters: {
      preflight: async () => { calls.preflight++; return { ok: true }; },
      review: async input => { calls.review++; inputs.push(input); return pass(); },
      repair: async input => { calls.repair++; inputs.push(input); return { ok: false }; }
    } };
  return s;
}
const evidence = s => path.join(s.root, 'outputs/run');
const files = s => fs.existsSync(evidence(s)) ? fs.readdirSync(evidence(s)).sort() : [];
const lockPath = s => path.join(s.root, '.harness-review-loop.lock');
function assertRunClean(s, result) {
  assertNoLeak(readAll(evidence(s))); assertNoLeak(JSON.stringify(s.events)); assertNoLeak(JSON.stringify(result));
  assert.equal(fs.existsSync(lockPath(s)), false);
}

test('config：goal 命中拋 SECRET_DETECTED_IN_GOAL；其他欄位拋 SECRET_DETECTED_IN_CONFIG；無鎖檔、evidence_dir 無內容', async t => {
  const s = setup(t);
  s.config.goal = `請審查 ${KEY}`;
  await assert.rejects(runLoop(s), e => { assert.match(e.message, /^SECRET_DETECTED_IN_GOAL:anthropic_key$/); assertNoLeak(e.message); return true; });
  assert.equal(fs.existsSync(lockPath(s)), false); assert.deepEqual(files(s), []);
  const s2 = setup(t);
  s2.config.checks = [{ id: 'value', argv: ['$node', '-e', `x\n${CASES[4][1]}`] }];
  await assert.rejects(runLoop(s2), /^Error: SECRET_DETECTED_IN_CONFIG:github_token$/);
  const s3 = setup(t);
  s3.config.note = `換行之後\n${CASES[2][1]}`;
  await assert.rejects(runLoop(s3), /SECRET_DETECTED_IN_CONFIG:openai_legacy_key/);
  for (const x of [s2, s3]) { assert.equal(fs.existsSync(lockPath(x)), false); assert.deepEqual(files(x), []); }
  assert.deepEqual([s.calls, s2.calls, s3.calls].map(c => c.preflight + c.check + c.review), [0, 0, 0]);
});

test('候選檔（含唯讀檔）命中：STOPPED，preflight／檢查／審查呼叫 0 次，不寫 candidate／checks／review-input', async t => {
  const s = setup(t, { content: `export const value = 1;\nconst k = '${KEY}';\n` });
  const r = await runLoop(s);
  assert.equal(r.status, 'STOPPED'); assert.equal(r.reason, 'SECRET_DETECTED_IN_CANDIDATE');
  assert.equal(r.detail, 'total=1; source.mjs:2:anthropic_key');
  assert.deepEqual(s.calls, { preflight: 0, check: 0, review: 0, repair: 0 });
  assert.equal(files(s).some(f => /^(candidate|checks|review-input|preflight)/.test(f)), false);
  assertRunClean(s, r);
  const s2 = setup(t);
  fs.writeFileSync(path.join(s2.root, 'spec.txt'), Array.from({ length: 25 }, (_, i) => `${i} ${CASES[3][1]}`).join('\n'));
  s2.config.read_only_files = ['spec.txt'];
  const r2 = await runLoop(s2);
  assert.equal(r2.reason, 'SECRET_DETECTED_IN_CANDIDATE'); assert.equal(s2.calls.preflight, 0);
  assert.match(r2.detail, /^total=25; spec\.txt:1:aws_access_key_id; /);
  // 最多 20 筆＋總數；整段仍受 500 字上限，總數放最前面不會被截掉。
  assert.ok(r2.detail.split('; ').length <= 21); assert.ok(r2.detail.length <= 500);
  assertRunClean(s2, r2);
});

test('檢查輸出整段遮罩後才截 2000 字；adapter 收到的 input＝review-input 檔＝input_sha256；跨邊界秘密不外洩', async t => {
  // github_pat 在原文跨第 2000 字（從第 1982 字開始）；若先截後遮會漏出前 18 字。
  const s = setup(t, { stdout: 'x'.repeat(1980) + ` ${CASES[5][1]} 尾`, stderr: `${KEY}\n` + pem(undefined, undefined, false) });
  const r = await runLoop(s);
  assert.equal(r.status, 'REVIEW_PASSED'); assert.equal(s.calls.review, 1);
  const input = s.inputs[0];
  assert.match(input, /\[REDACTED:anthropic_key\]/); assert.match(input, /\[REDACTED:private_key_block\]/); assert.match(input, /\[REDACTED:github/);
  assert.equal(fs.readFileSync(path.join(evidence(s), 'review-input-0.txt'), 'utf8'), input);
  assert.equal(s.events.find(e => e.state === 'REVIEW_INTENT').input_sha256, sha(input));
  const checks = JSON.parse(fs.readFileSync(path.join(evidence(s), 'checks-0.json'), 'utf8'));
  assert.ok(checks[0].redactions.some(x => x.field === 'raw.stdout' && x.pattern_id === 'github_pat'));
  assertRunClean(s, r);
});

test('review raw／parseError／call.error 含假秘密：存檔已遮罩，失敗分類用遮罩前物件', async t => {
  const s = setup(t);
  s.adapters.review = async input => { s.calls.review++; s.inputs.push(input);
    return { ok: false, value: null, raw: { exitCode: 1, stdout: `out ${KEY}`, stderr: `err ${CASES[9][1]}` },
      parseError: `bad json near ${CASES[12][1]}`, call: { error: `429 rate limit ${CASES[7][1]}` }, task: 'error',
      identity: { platform: 'antigravity', source: 'stream_init', actual_model: s.config.reviewer_model } }; };
  const r = await runLoop(s);
  assert.equal(r.reason, 'REVIEW_TRANSPORT_OR_IDENTITY_FAILED'); assert.equal(r.failure_category, 'parse_failed');
  const saved = JSON.parse(fs.readFileSync(path.join(evidence(s), 'review-0.json'), 'utf8'));
  assert.deepEqual(saved.redactions.map(x => x.field).sort(), ['call.error', 'parseError', 'raw.stderr', 'raw.stdout']);
  assert.match(saved.raw.stdout, /\[REDACTED:anthropic_key\]/);
  assertRunClean(s, r);
});

test('preflight 訊息與中斷例外含秘密：detail／reason 遮罩且 ≤500 字', async t => {
  const s = setup(t);
  s.adapters.preflight = async () => ({ ok: false, error: 'AGY_MODELS_UNAVAILABLE', message: `清單失敗 ${KEY} ` + 'y'.repeat(900) });
  const r = await runLoop(s);
  assert.equal(r.reason, 'PREFLIGHT_FAILED'); assert.ok(r.detail.length <= 500); assert.match(r.detail, /^清單失敗 \[REDACTED:anthropic_key\]/);
  assert.equal(r.failure_category, 'models_unavailable');
  assertRunClean(s, r);
  const s2 = setup(t);
  s2.adapters.review = async () => { throw new Error(`boom ${CASES[1][1]} ` + 'z'.repeat(900)); };
  const r2 = await runLoop(s2);
  assert.match(r2.reason, /^EXECUTION_INTERRUPTED:boom \[REDACTED:openai_project_key\]/); assert.ok(r2.reason.length <= 500);
  assertRunClean(s2, r2);
});

test('封包整包檢查：截斷造成的命中擋下 review 封包，不寫檔、不送審', async t => {
  // 近似字串（右側接 -，原本不符規則）剛好被第 2000 字截斷後才變成命中；不是規則內秘密，故不列入洩漏主體。
  const near = 'sk-' + gen(40, ALNUM, 20);
  const s = setup(t, { stdout: 'x'.repeat(2000 - near.length - 1) + ' ' + near + '-tail' });
  assert.deepEqual(findSecrets(s.out.stdout), []);
  const r = await runLoop(s);
  assert.equal(r.status, 'STOPPED'); assert.equal(r.reason, 'SECRET_DETECTED_IN_REVIEW_PACKET'); assert.equal(r.detail, 'openai_legacy_key');
  assert.equal(s.calls.review, 0); assert.equal(files(s).some(f => f.startsWith('review-input')), false);
  assert.equal(s.events.some(e => e.state === 'REVIEW_INTENT'), false);
  assertNoLeak(JSON.stringify(s.events)); assertNoLeak(JSON.stringify(r));
});

test('封包整包檢查：審查 findings 帶秘密時擋下 repair 封包，不寫檔、不呼叫回修；review 存檔已遮罩', async t => {
  const s = setup(t, { author: 'codex' });
  s.adapters.review = async input => { s.calls.review++; const r = s.pass(); r.value.verdict = 'FAIL';
    r.value.findings = [{ path: 'source.mjs', line: 1, message: `請移除\n${CASES[10][1]}` }]; return r; };
  const r = await runLoop(s);
  assert.equal(r.reason, 'SECRET_DETECTED_IN_REPAIR_PACKET'); assert.equal(r.detail, 'private_key_block');
  assert.equal(s.calls.repair, 0); assert.equal(files(s).some(f => f.startsWith('repair-input')), false);
  assertRunClean(s, r);
});

test('回修內容含秘密：不套用、原檔 sha 不變、無 .tmp、無 APPLY_INTENT；repair 存檔已遮罩', async t => {
  const s = setup(t, { author: 'codex' });
  s.adapters.review = async () => { s.calls.review++; const r = s.pass(); r.value.verdict = 'FAIL';
    r.value.findings = [{ path: 'source.mjs', line: 1, message: '改寫' }]; return r; };
  s.adapters.repair = async () => { s.calls.repair++; const c = snapshot(s.root, s.config.files);
    return { ok: true, identity: { platform: 'codex', source: 'controller_launch' }, value: { candidate_hash: c.hash,
      replacements: [{ path: 'source.mjs', previous_sha256: c.files[0].sha256, content: `export const value = 1;\nconst t = '${CASES[8][1]}';\n` }] } }; };
  const before = sha(fs.readFileSync(path.join(s.root, 'source.mjs')));
  const r = await runLoop(s);
  assert.equal(r.status, 'STOPPED'); assert.equal(r.reason, 'SECRET_DETECTED_IN_REPAIR');
  assert.equal(r.detail, 'total=1; source.mjs:2:google_oauth_access_token');
  assert.equal(sha(fs.readFileSync(path.join(s.root, 'source.mjs'))), before);
  assert.equal(fs.readdirSync(s.root).some(f => f.endsWith('.tmp')), false);
  assert.equal(s.events.some(e => e.state === 'APPLY_INTENT'), false);
  const saved = JSON.parse(fs.readFileSync(path.join(evidence(s), 'repair-0.json'), 'utf8'));
  assert.ok(saved.redactions.some(x => x.field === 'value.replacements[0].content'));
  assertRunClean(s, r);
});

test('全規則壓力：每條假秘密同時出現在檢查輸出、審查回覆與 preflight，證據與事件皆無 ≥12 字主體片段', async t => {
  const all = CASES.map(([, p]) => p).join('\n');
  const s = setup(t, { stdout: all, stderr: all });
  s.adapters.preflight = async () => { s.calls.preflight++; return { ok: true, note: all, agyModels: { stdout: all } }; };
  s.adapters.review = async input => { s.calls.review++; s.inputs.push(input); const r = s.pass(); r.raw = { stdout: all, stderr: all }; r.extra = [all]; return r; };
  const r = await runLoop(s);
  assert.equal(r.status, 'REVIEW_PASSED');
  assertNoLeak(s.inputs.join('\n'));
  assertRunClean(s, r);
  const names = files(s);
  for (const f of ['config.json', 'preflight.json', 'candidate-0.json', 'checks-0.json', 'review-input-0.txt', 'review-0.json', 'result.json']) assert.ok(names.includes(f), f);
});

// ---- 第 2 次派工：跳脫序列（反斜線＋字母）之後的秘密不可漏判 ----
const BS = String.fromCharCode(92);
// 有左邊界的規則（R1 lookbehind 受跳脫序列影響者）：[pattern_id, 正例本體]
const LB_CASES = CASES.filter(([id]) => !['private_key_block', 'azure_storage_account_key'].includes(id))
  .map(([id, positive]) => [id, id === 'bearer_token' ? positive.slice('Authorization: '.length) : positive]);
const ANT = CASES[0][1], PROJ = CASES[1][1], GHP = CASES[4][1];

test('跳脫序列之後仍命中：\\n、\\t、雙重跳脫、\\r、\\"、\\u000a、\\x0a 與 JSON 字串化', () => {
  for (const [id, p] of LB_CASES) {
    for (const prefix of [BS + 'n', BS + 't', BS + BS + 'n', BS + 'r', BS + '"', BS + 'u000a', BS + 'u000A', BS + 'x0a']) {
      const text = 'ok' + prefix + p;
      assert.ok(ids(text).includes(id), `${id} 接在 ${JSON.stringify(prefix)} 後`);
      assertNoLeak(maskSecrets(text));
    }
    for (const text of [JSON.stringify({ a: 'ok\n' + p }), JSON.stringify(JSON.stringify({ a: 'ok\t' + p })), JSON.stringify({ a: 'ok\u0001' + p })]) {
      assert.ok(ids(text).includes(id), `${id} JSON 字串化`); assertNoLeak(maskSecrets(text));
    }
    // 前一字元是類別內英數且前面不是反斜線：仍不命中（左邊界未放寬）
    assert.equal(ids('Z9' + p).includes(id), false, `${id} 緊接英數`);
  }
  for (const text of ['task-' + CASES[1][1], 'task-' + CASES[2][1], 'task-' + ANT, 'task-selection-layout-plan',
    crypto.createHash('sha256').update('y').digest('hex'), crypto.randomUUID(), '[REDACTED:x]', BS + 'n[REDACTED:x]'])
    assert.deepEqual(findSecrets(text), [], text.slice(0, 30));
});

test('ReDoS：1MB 惡意輸入（大量反斜線與跳脫交錯）每種 < 200 ms', () => {
  const MB = 1 << 20;
  const fill = unit => unit.repeat(Math.ceil(MB / unit.length)).slice(0, MB);
  const inputs = [fill(BS + 'n'), fill(BS + BS + 'n' + BS), fill(BS + 'u000'), fill(BS + 'nsk-' + gen(31)), fill(BS + 'tsk-ant-ab01-' + gen(31) + '.'),
    fill(BS + 'nBearer ' + gen(23, LOWER)), 'Bearer ' + fill(gen(64, LOWER) + BS + 'n'), fill(BS + 'neyJ' + gen(9) + '.eyJ'), fill(BS + 'nAKIA' + gen(15, UPPER)),
    fill(BS + 'ngh' + 'p_' + gen(35)), 'sk-' + fill('a'), fill(BS)];
  for (const [i, text] of inputs.entries()) {
    for (const fn of [findSecrets, maskSecrets]) {
      const t0 = performance.now(); fn(text); const ms = performance.now() - t0;
      assert.ok(ms < 200, `輸入 #${i} ${fn.name} 用了 ${ms.toFixed(1)} ms`);
    }
  }
});

test('情境 A：審查 raw.stdout 是 JSON 包裝（\\n 後接秘密）→ review-0.json 與事件不含主體', async t => {
  const s = setup(t);
  s.adapters.review = async input => { s.calls.review++; s.inputs.push(input); const r = s.pass();
    r.raw = { exitCode: 0, stdout: JSON.stringify({ type: 'result', response: 'line1\n' + ANT + '\n' + GHP }), stderr: '' }; return r; };
  const r = await runLoop(s);
  assert.equal(r.status, 'REVIEW_PASSED');
  const saved = JSON.parse(fs.readFileSync(path.join(evidence(s), 'review-0.json'), 'utf8'));
  assert.deepEqual(saved.redactions.map(x => x.pattern_id).sort(), ['anthropic_key', 'github_token']);
  assertRunClean(s, r);
});

test('情境 B：Codex 回修 JSONL 包裝含秘密 → STOPPED，repair-0.json 不含主體、原檔不變', async t => {
  const s = setup(t, { author: 'codex' });
  s.adapters.review = async () => { s.calls.review++; const r = s.pass(); r.value.verdict = 'FAIL';
    r.value.findings = [{ path: 'source.mjs', line: 1, message: '改寫' }]; return r; };
  s.adapters.repair = async input => { s.calls.repair++; s.inputs.push(input); const c = snapshot(s.root, s.config.files);
    const value = { candidate_hash: c.hash, replacements: [{ path: 'source.mjs', previous_sha256: c.files[0].sha256, content: 'export const value = 1;\n' + PROJ + '\n' }] };
    const stdout = [{ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(value) } }, { type: 'turn.completed' }].map(e => JSON.stringify(e)).join('\n');
    return { ok: true, value, raw: { exitCode: 0, stdout, stderr: '' }, identity: { platform: 'codex', source: 'controller_launch' } }; };
  const before = sha(fs.readFileSync(path.join(s.root, 'source.mjs')));
  const r = await runLoop(s);
  assert.equal(r.status, 'STOPPED'); assert.equal(r.reason, 'SECRET_DETECTED_IN_REPAIR');
  assert.equal(sha(fs.readFileSync(path.join(s.root, 'source.mjs'))), before);
  assert.equal(fs.readdirSync(s.root).some(f => f.endsWith('.tmp')), false);
  const saved = fs.readFileSync(path.join(evidence(s), 'repair-0.json'), 'utf8');
  assert.match(saved, /REDACTED:openai_project_key/);
  assertNoLeak(s.inputs.join('\n')); assertRunClean(s, r);
});

test('情境 E2：檢查輸出是 JSON（\\n 後接秘密）→ 送出前已遮罩，review-input／checks 不含主體', async t => {
  const s = setup(t, { stdout: JSON.stringify({ log: 'ok\n' + PROJ }) });
  const r = await runLoop(s);
  assert.equal(s.calls.review, 1); assert.equal(r.status, 'REVIEW_PASSED');
  assert.match(s.inputs[0], /REDACTED:openai_project_key/);
  assertNoLeak(s.inputs.join('\n'));
  assertNoLeak(fs.readFileSync(path.join(evidence(s), 'review-input-0.txt'), 'utf8'));
  assertNoLeak(fs.readFileSync(path.join(evidence(s), 'checks-0.json'), 'utf8'));
  assertRunClean(s, r);
});

test('情境 F3：原始碼字串內「反斜線 n」後接秘密 → 候選檔掃描擋下，外部呼叫 0 次', async t => {
  const s = setup(t, { content: 'export const value = 1;\nconst s = "hdr' + BS + 'n' + PROJ + '";\n' });
  const r = await runLoop(s);
  assert.equal(r.status, 'STOPPED'); assert.equal(r.reason, 'SECRET_DETECTED_IN_CANDIDATE');
  assert.equal(r.detail, 'total=1; source.mjs:2:openai_project_key');
  assert.deepEqual(s.calls, { preflight: 0, check: 0, review: 0, repair: 0 }); assert.deepEqual(s.inputs, []);
  assertRunClean(s, r);
});
