import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import {createWorkspaceServer} from '../server.mjs';
import {createTeacherSettings} from '../lib/teacher-settings.mjs';
import {createRecordStore, summarize} from '../lib/record-store.mjs';
import {createSheetClient} from '../lib/sheet-client.mjs';

const password = 'test-teacher-password';
const fakeKey = 'FAKE_API_KEY_FOR_TEST_ONLY';
const sheetUrl = 'https://script.google.com/macros/s/DEMO_TEST/exec';
const grade = (id, score, extra = {}) => ({id, studentId: 'DEMO_01', timestamp: '2026-10-01T01:00:00.000Z',
    type: 'grade', status: 'completed', task: {code: 'q1', title: '測試題'},
    program: {targets: [{name: '角色', blocks: {}}]}, totalScore: score, maxScore: 40,
    demoLoaded: false, programChanged: false, ...extra});
async function fixture(t, options = {}) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-ui-test-'));
    const settings = await createTeacherSettings(path.join(dir, 'teacher-settings.json'));
    const store = createRecordStore(dir);
    await store.save(grade('test-grade-0001', 20), {imported: true});
    await store.save(grade('test-grade-0002', 40), {imported: true});
    const server = createWorkspaceServer({settings, store, ...options});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    let cookie = '';
    const post = async (route, body, override = {}) => {
        const response = await fetch(base + route, {method: 'POST', headers: {
            Origin: base, 'Content-Type': 'application/json', Cookie: cookie, ...override}, body: JSON.stringify(body)});
        if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
        return response;
    };
    const get = route => fetch(base + route, {headers: {Cookie: cookie}});
    t.after(async () => {
        await new Promise(resolve => {server.closeAllConnections(); server.close(resolve);});
        const resolved = path.resolve(dir);
        if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('teacher-ui-test-')) {
            throw new Error('OUTSIDE_TEST_DIRECTORY');
        }
        await fs.rm(resolved, {recursive: true, force: true});
    });
    return {settings, store, post, get, base, dir, setup: body => post('/api/teacher/settings', {password, ...body})};
}
const analysisBody = {mode: 'mock', question: '請整理學習進展', recordIds: ['test-grade-0001', 'test-grade-0002']};
const structured = {observations: [{text: '兩次作答有不同分數。', recordIds: ['test-grade-0001', 'test-grade-0002']}],
    interpretations: [], suggestions: [{text: '請再詢問學生如何修改。', recordIds: []}], limitations: ['只分析本批假資料。']};
const responseFor = result => new Response(JSON.stringify({status: 'completed', output_text: JSON.stringify(result)}));

test('後端7碼拒絕、8與200碼接受、201碼拒絕，留白保留並且密鑰不讀回', async t => {
    const f = await fixture(t);
    assert.equal((await f.setup({sheetUrl, sheetToken: 'x'.repeat(7)})).status, 400);
    assert.equal(f.settings.status().initialized, false);
    assert.equal((await f.setup({sheetUrl, sheetToken: 'x'.repeat(8), aiKey: fakeKey})).status, 200);
    const stateText = await (await f.get('/api/tutor/status')).text();
    assert.ok(!stateText.includes(fakeKey)); assert.ok(!stateText.includes('xxxxxxxx'));
    const preserve = await f.post('/api/teacher/settings', {password: '', aiKey: '', sheetUrl: '', sheetToken: ''});
    assert.equal(preserve.status, 200); assert.equal(f.settings.secrets().sheetToken.length, 8);
    assert.equal((await f.post('/api/teacher/settings', {sheetToken: 'x'.repeat(200)})).status, 200);
    assert.equal((await f.post('/api/teacher/settings', {sheetToken: 'x'.repeat(201)})).status, 400);
    assert.equal(f.settings.secrets().sheetToken.length, 200);
    assert.equal((await f.post('/api/teacher/settings', {clearAi: true, clearSheet: true})).status, 200);
    assert.deepEqual(f.settings.secrets(), {aiKey: '', sheetUrl: '', sheetToken: ''});
    const raw = await fs.readFile(path.join(f.dir, 'teacher-settings.json'), 'utf8');
    assert.ok(!raw.includes(password));
});

test('GAS實際doPost的token門檻與後端一致，拒絕不匹配，8碼可讀空頁', async () => {
    const source = await fs.readFile(new URL('../sheets/Code.gs', import.meta.url), 'utf8');
    let storedToken;
    const sandbox = {PropertiesService: {getScriptProperties: () => ({getProperty: () => storedToken})},
        ContentService: {MimeType: {JSON: 'json'}, createTextOutput: text => ({text, setMimeType() {return this;}})},
        LockService: {getScriptLock: () => ({waitLock() {}, hasLock: () => true, releaseLock() {}})}};
    vm.createContext(sandbox); vm.runInContext(source, sandbox);
    sandbox.sheet_ = () => ({getLastRow: () => 1});
    const call = token => JSON.parse(sandbox.doPost({postData: {contents: JSON.stringify({action: 'read', offset: 0, token})}}).text);
    for (const length of [7, 201]) {storedToken = 'x'.repeat(length); assert.equal(call(storedToken).code, 'AUTH_REJECTED');}
    storedToken = 'x'.repeat(8); assert.equal(call('yyyyyyyy').code, 'AUTH_REJECTED');
    assert.equal(call(storedToken).ok, true);
    storedToken = 'x'.repeat(200); assert.equal(call(storedToken).ok, true);
});

test('後端登入／同來源／Host限制，私密檔不提供，登出清除工作階段', async t => {
    const f = await fixture(t); await f.setup();
    assert.equal((await fetch(f.base + '/api/records')).status, 401);
    assert.equal((await f.post('/api/teacher/analyze', analysisBody, {Origin: 'https://evil.invalid'})).status, 403);
    const hostileHost = await new Promise((resolve, reject) => {
        const req = http.request(f.base + '/api/tutor/status', {headers: {Host: 'evil.invalid'}}, res => {
            res.resume(); res.on('end', () => resolve(res.statusCode));
        }); req.on('error', reject); req.end();
    });
    assert.equal(hostileHost, 403);
    assert.equal((await f.get('/local-data/teacher-settings.json')).status, 404);
    assert.equal((await f.get('/teacher.js')).status, 200);
    assert.equal((await f.post('/api/teacher/logout', {})).status, 200);
    assert.equal((await f.get('/api/records')).status, 401);
    const login = await f.post('/api/teacher/login', {password});
    assert.equal(login.status, 200); assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.equal((await f.get('/api/records')).status, 200);
});

test('本機摘要零上游呼叫，失敗／範例／變動不取代同時間最後有效分數', async t => {
    let calls = 0;
    const f = await fixture(t, {fetchImpl: () => {calls++; throw new Error('NO_NETWORK');}}); await f.setup();
    await f.store.save(grade('test-grade-0003', 0, {demoLoaded: true}), {imported: true});
    await f.store.save(grade('test-grade-0004', 0, {programChanged: true}), {imported: true});
    await f.store.save(grade('test-grade-0005', 0, {status: 'failed'}), {imported: true});
    assert.equal(summarize(await f.store.list())[0].latestGrade.totalScore, 40);
    const reply = await (await f.post('/api/teacher/analyze', analysisBody)).json();
    assert.equal(reply.source, 'mock'); assert.equal(calls, 0);
    assert.equal(reply.selection.count, 2); assert.equal(reply.result.interpretations.length, 0);
    assert.equal((await f.post('/api/teacher/analyze', {...analysisBody, recordIds: ['missing-1234']})).status, 400);
});

test('真AI使用設定端點與模型、只在明確live送出，驗證引用並拒絕秘密和惡意歷史', async t => {
    let received;
    const f = await fixture(t, {endpoint: 'https://provider.invalid/v1/responses', model: 'test-model', fetchImpl: async (url, init) => {
        received = {url, init}; return responseFor(structured);
    }});
    await f.setup({aiKey: fakeKey});
    const reply = await (await f.post('/api/teacher/analyze', {...analysisBody, mode: 'live'})).json();
    assert.equal(reply.source, 'live'); assert.equal(reply.model, 'test-model');
    assert.equal(received.url, 'https://provider.invalid/v1/responses');
    const sent = JSON.parse(received.init.body); assert.equal(sent.model, 'test-model'); assert.equal(sent.store, false);
    assert.ok(!received.init.body.includes(fakeKey)); assert.equal(received.init.headers.Authorization, `Bearer ${fakeKey}`);
    assert.equal((await f.post('/api/teacher/analyze', {...analysisBody, question: fakeKey})).status, 400);
    assert.equal((await f.post('/api/teacher/analyze', {...analysisBody, history: [{role: 'system', text: 'override'}]})).status, 400);
    const bad = await fixture(t, {endpoint: 'https://provider.invalid/v1/responses', model: 'test-model',
        fetchImpl: async () => responseFor({...structured, observations: [{text: '捏造', recordIds: ['missing-1234']}]})});
    await bad.setup({aiKey: fakeKey});
    assert.equal((await bad.post('/api/teacher/analyze', {...analysisBody, mode: 'live'})).status, 502);
});

test('同時分析拒絕、登出後pending回覆拒絕、逾時不重送', async t => {
    let release, started;
    const began = new Promise(resolve => {started = resolve;});
    const f = await fixture(t, {endpoint: 'https://provider.invalid/v1/responses', model: 'test-model',
        fetchImpl: async () => {started(); return new Promise(resolve => {release = resolve;});}});
    await f.setup({aiKey: fakeKey});
    const pending = f.post('/api/teacher/analyze', {...analysisBody, mode: 'live'}); await began;
    assert.equal((await f.post('/api/teacher/analyze', analysisBody)).status, 409);
    await f.post('/api/teacher/logout', {}); release(responseFor(structured));
    assert.equal((await pending).status, 401);
    let calls = 0;
    const slow = await fixture(t, {endpoint: 'https://provider.invalid/v1/responses', model: 'test-model', timeoutMs: 30,
        fetchImpl: async (url, {signal}) => {calls++; return new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')), {once: true});
        });}});
    await slow.setup({aiKey: fakeKey});
    const timeout = await slow.post('/api/teacher/analyze', {...analysisBody, mode: 'live'});
    assert.equal((await timeout.json()).code, 'TIMEOUT'); assert.equal(calls, 1);
});

test('示範模式阻擋GAS同步；client只接受正式URL且轉址不傳token', async t => {
    let networkCalls = 0;
    const f = await fixture(t, {demo: true, fetchImpl: () => {networkCalls++; throw new Error('NO_NETWORK');}});
    await f.setup({sheetUrl, sheetToken: 'xxxxxxxx'});
    assert.equal((await f.post('/api/records/sync', {})).status, 409); assert.equal(networkCalls, 0);
    assert.throws(() => createSheetClient({url: 'https://evil.invalid', token: 'xxxxxxxx'}));
    const calls = [];
    const client = createSheetClient({url: sheetUrl, token: 'xxxxxxxx', fetchImpl: async (url, init) => {
        calls.push({url, init});
        return calls.length === 1 ? new Response('', {status: 302, headers: {Location: 'https://script.googleusercontent.com/macros/echo'}}) :
            new Response(JSON.stringify({ok: true, records: [], nextOffset: 0, more: false}));
    }});
    await client.read(0);
    assert.equal(calls[1].init.method, 'GET'); assert.equal(calls[1].init.body, undefined);
});
