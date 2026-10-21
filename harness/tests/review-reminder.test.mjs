import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildReminder, parseReviewArgs, prepareReminder, readTriggerEvents, recordTriggerEvent, requirePreparedTrigger, TRIGGER_LOG } from '../runtime/review-loop/reminder.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
function fixture(t, copyRuntime = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-reminder-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  if (copyRuntime) for (const f of [
    'harness/hooks/inject-lessons.mjs', 'harness/runtime/review-loop/reminder.mjs',
    'harness/cli/review-loop.mjs', 'harness/core/root.mjs',
    'harness/runtime/review-loop/loop.mjs', 'harness/runtime/review-loop/process.mjs', 'harness/runtime/review-loop/adapters.mjs',
    'harness/runtime/review-loop/failure-category.mjs', 'harness/runtime/review-loop/secret-scan.mjs',
    'harness/runtime/agy/agy-process.mjs', 'harness/runtime/agy/flags.mjs',
    'harness/runtime/agy/stream-json.mjs', 'harness/runtime/agy/interpreter.mjs'
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.copyFileSync(path.join(REPO, f), path.join(root, f));
  }
  return root;
}

for (const prompt of ['好，補上', '幫我修正功能', '今天天氣如何', '不要呼叫 AGY，只回答']) {
  test(`有效提交固定提醒：${prompt}`, t => {
    const root = fixture(t);
    const r = prepareReminder('UserPromptSubmit', { prompt, session_id: 'private-session', turn_id: 'private-turn' }, { root });
    assert.equal(r.recorded, true); assert.match(r.context, /【實作任務審查提醒】/);
    assert.match(r.context, new RegExp(`--trigger-id ${r.id}`));
    assert.match(r.context, /純問答不因提醒而呼叫模型/); assert.match(r.context, /停止決定優先/);
    const e = readTriggerEvents(root, r.id);
    assert.equal(e.length, 1); assert.equal(e[0].kind, 'reminder_prepared');
    assert.equal(e[0].prompt_sha256, hash(prompt)); assert.equal(e[0].reminder_sha256, hash(r.context));
    const raw = fs.readFileSync(path.join(root, TRIGGER_LOG), 'utf8');
    assert.equal(raw.includes('private-session'), false); assert.equal(raw.includes('private-turn'), false);
    assert.equal(raw.includes(prompt), false); requirePreparedTrigger(root, r.id);
  });
}

test('其他事件、空／錯誤提交不記錄也不呼叫外部程序', t => {
  const root = fixture(t);
  for (const [event, payload] of [['SessionStart', { prompt: 'implement' }], ['UserPromptSubmit', {}], ['UserPromptSubmit', { prompt: 42 }], ['UserPromptSubmit', { prompt: ' ' }]]) {
    assert.equal(prepareReminder(event, payload, { root }).context, '');
  }
  assert.equal(fs.existsSync(path.join(root, TRIGGER_LOG)), false);
});

test('追蹤寫入失敗／停用時仍送提醒，沒有不可用識別碼', t => {
  const root = fixture(t); fs.writeFileSync(path.join(root, 'harness'), 'not-a-directory');
  const r = prepareReminder('UserPromptSubmit', { prompt: '修正' }, { root });
  assert.equal(r.recorded, false); assert.equal(r.id, null); assert.equal(r.context, buildReminder());
  assert.equal(r.context.includes('--trigger-id'), false);
  const disabled = prepareReminder('UserPromptSubmit', { prompt: '修正' }, { root, observe: false });
  assert.equal(disabled.context, buildReminder());
});

test('事件紀錄只存允許欄位；缺準備收據／錯識別碼拒絕', t => {
  const root = fixture(t); const r = prepareReminder('UserPromptSubmit', { prompt: '修正' }, { root });
  assert.equal(recordTriggerEvent(root, r.id, 'entry_started', { config_sha256: 'a'.repeat(64), prompt: 'secret', arbitrary: 'secret' }), true);
  assert.equal(recordTriggerEvent(root, r.id, 'invented_kind'), false);
  const e = readTriggerEvents(root, r.id).at(-1);
  assert.equal(e.config_sha256, 'a'.repeat(64)); assert.equal('prompt' in e, false); assert.equal('arbitrary' in e, false);
  assert.throws(() => requirePreparedTrigger(root, 'b'.repeat(32)), /NOT_FOUND/);
  assert.throws(() => requirePreparedTrigger(root, '../escape'), /INVALID/);
});

test('CLI 選項值與重複旗標拒絕；保留既有 preflight-only', () => {
  assert.deepEqual(parseReviewArgs(['task.json']), { file: 'task.json', preflightOnly: false, triggerId: null });
  assert.equal(parseReviewArgs(['task.json', '--preflight-only']).preflightOnly, true);
  assert.equal(parseReviewArgs(['task.json', '--trigger-id', 'a'.repeat(32), '--preflight-only']).triggerId, 'a'.repeat(32));
  for (const args of [[], ['--trigger-id'], ['task.json', '--trigger-id', '../escape'], ['task.json', '--trigger-id'], ['task.json', '--preflight-only', '--preflight-only'], ['task.json', '--dangerously-skip-permissions']]) assert.throws(() => parseReviewArgs(args));
});

test('追蹤紀錄硬連結不寫穿其他名稱', t => {
  const root = fixture(t);
  const r = prepareReminder('UserPromptSubmit', { prompt: '修正' }, { root });
  const file = path.join(root, TRIGGER_LOG), alias = path.join(root, 'alias.jsonl');
  fs.linkSync(file, alias);
  const before = fs.readFileSync(alias, 'utf8');
  assert.equal(recordTriggerEvent(root, r.id, 'entry_started'), false);
  assert.equal(fs.readFileSync(alias, 'utf8'), before);
  assert.throws(() => readTriggerEvents(root, r.id), /TRIGGER_LOG_ALIAS/);
});

test('追蹤紀錄拒絕目標不存在的父目錄連結', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'harness'));
  const target = path.join(root, 'missing-target');
  fs.symlinkSync(target, path.join(root, 'harness/state'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(recordTriggerEvent(root, 'a'.repeat(32), 'entry_started'), false);
  assert.equal(fs.existsSync(target), false);
});

test('真正掛鉤子程序：沒有教訓目錄仍輸出提醒與 stdout 發送紀錄', t => {
  const root = fixture(t, true);
  const result = spawnSync(process.execPath, [path.join(root, 'harness/hooks/inject-lessons.mjs'), 'UserPromptSubmit'],
    { input: JSON.stringify({ prompt: '好，補上', session_id: 's', turn_id: 't' }), encoding: 'utf8', env: { ...process.env, HARNESS_REVIEW_TRIGGER_LOG_DISABLED: '0' } });
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, 'UserPromptSubmit'); assert.match(out.additionalContext, /【實作任務審查提醒】/);
  const id = /--trigger-id ([a-f0-9]{32})/.exec(out.additionalContext)[1];
  assert.deepEqual(readTriggerEvents(root, id).map(e=>e.kind), ['reminder_prepared', 'stdout_emitted']);
});

test('真正 CLI 子程序：preflight 不算入口；正式啟動失敗仍保存終止狀態', t => {
  const root = fixture(t, true);
  fs.mkdirSync(path.join(root, 'harness/config')); fs.writeFileSync(path.join(root, 'harness/config/local-harness.json'), '{}');
  fs.writeFileSync(path.join(root, 'harness/runtime/agy/capabilities.json'), JSON.stringify({ models: { gemini: { availability: 'available' } } }));
  fs.writeFileSync(path.join(root, 'candidate.txt'), 'candidate');
  const config = { goal: 'probe only', files: ['candidate.txt'], evidence_dir: 'outputs/probe', author_platform: 'codex', reviewer_model: 'gemini', repair_model: 'codex', checks: [{ id: 'unused', argv: ['$node', '-e', 'process.exit(0)'] }] };
  fs.writeFileSync(path.join(root, 'task.json'), JSON.stringify(config));
  const r = prepareReminder('UserPromptSubmit', { prompt: 'probe' }, { root });
  const env = { ...process.env, HARNESS_ROOT: root, CODEX_BIN: process.execPath, AGY_BIN: path.join(root, 'missing-agy.exe') };
  const invoke = extra => spawnSync(process.execPath, [path.join(root, 'harness/cli/review-loop.mjs'), 'task.json', '--trigger-id', r.id, ...extra], { cwd: root, env, encoding: 'utf8', timeout: 20000 });
  const preflight = invoke(['--preflight-only']); assert.equal(preflight.status, 2, preflight.stderr);
  assert.deepEqual(readTriggerEvents(root, r.id).map(e=>e.kind), ['reminder_prepared']);
  const actual = invoke([]); assert.equal(actual.status, 2, actual.stderr);
  assert.deepEqual(readTriggerEvents(root, r.id).map(e=>e.kind), ['reminder_prepared', 'entry_started', 'entry_finished']);
  assert.equal(readTriggerEvents(root, r.id).at(-1).status, 'INCONCLUSIVE');
  const repeated = invoke([]); assert.equal(repeated.status, 2);
  assert.equal(readTriggerEvents(root, r.id).at(-1).status, 'ENTRY_ABORTED');
});
