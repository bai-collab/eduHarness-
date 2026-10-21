import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createTeacherSettings, sheetScope} from './lib/teacher-settings.mjs';
import {createRecordStore} from './lib/record-store.mjs';
import {createSheetClient} from './lib/sheet-client.mjs';
import {selectAnalysisRecords, analysisContext, mockAnalysis, requestAnalysis} from './lib/teacher-analysis.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cookieName = 'teacherWorkspace';
const files = new Map([['/teacher.html', 'text/html; charset=utf-8'], ['/teacher.js', 'text/javascript; charset=utf-8'],
    ['/teacher.css', 'text/css; charset=utf-8']]);
const fail = (code, status = 400) => Object.assign(new Error(code), {code, status});
async function readBody(req) {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 400000) throw fail('BODY_TOO_LARGE');
        chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const json = (res, status, body) => {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(JSON.stringify(body));
};
function providerConfig(endpoint, model) {
    if (!endpoint && !model) return false;
    let url;
    try { url = new URL(endpoint); } catch { throw new Error('INVALID_AI_ENDPOINT'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
        typeof model !== 'string' || !model.trim() || model.length > 200) throw new Error('INVALID_AI_CONFIG');
    return true;
}

// This factory is loopback-only: it verifies the accepted socket, Host and Origin independently.
export function createWorkspaceServer({settings, store, demo = false, fetchImpl = fetch,
    endpoint = '', model = '', timeoutMs = 90000} = {}) {
    const configured = providerConfig(endpoint, model);
    const sessions = new Map(); let failedLogins = 0, loginWindow = Date.now();
    let busySettings = false, busyAnalysis = false;
    const token = req => /(?:^|;\s*)teacherWorkspace=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    const authorized = req => {
        const value = token(req), expiry = sessions.get(value);
        if (expiry > Date.now()) return true;
        sessions.delete(value); return false;
    };
    const issue = res => {
        for (const [value, expiry] of sessions) if (expiry <= Date.now()) sessions.delete(value);
        if (sessions.size >= 100) throw fail('SESSION_LIMIT', 429);
        const value = randomBytes(24).toString('hex'); sessions.set(value, Date.now() + 8 * 3600000);
        res.setHeader('Set-Cookie', `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`);
    };
    const hasSecret = value => {
        const text = JSON.stringify(value);
        const {aiKey, sheetToken} = settings.secrets();
        return [aiKey, sheetToken].some(secret => secret && text.includes(secret));
    };
    const handle = async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
        res.setHeader('Referrer-Policy', 'no-referrer');
        const address = req.socket.remoteAddress;
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) throw fail('LOCAL_ONLY', 403);
        const host = req.headers.host, port = req.socket.localPort;
        if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host) ||
            req.headers['sec-fetch-site'] === 'cross-site') throw fail('LOCAL_ONLY', 403);
        const url = new URL(req.url, 'http://local.invalid');
        const route = url.pathname === '/' ? '/teacher.html' : url.pathname;
        if (route === '/favicon.ico' && ['GET', 'HEAD'].includes(req.method)) {
            res.writeHead(204); return res.end();
        }
        if (files.has(route)) {
            if (!['GET', 'HEAD'].includes(req.method)) throw fail('METHOD_NOT_ALLOWED', 405);
            const content = await fs.readFile(path.join(here, 'public', route.slice(1)));
            res.writeHead(200, {'Content-Type': files.get(route), 'Cache-Control': 'no-store'});
            return res.end(req.method === 'HEAD' ? undefined : content);
        }
        if (route === '/api/tutor/status' && req.method === 'GET') {
            return json(res, 200, {...settings.status(), providerConfigured: configured, demo});
        }
        if (req.method === 'POST' && (req.headers.origin !== `http://${host}` ||
            !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))) throw fail('SAME_ORIGIN_REQUIRED', 403);
        if (route === '/api/teacher/login' && req.method === 'POST') {
            if (Date.now() - loginWindow > 60000) {failedLogins = 0; loginWindow = Date.now();}
            if (failedLogins >= 10) throw fail('LOGIN_RATE_LIMIT', 429);
            const body = await readBody(req);
            if (!settings.verify(body?.password)) {failedLogins++; throw fail('LOGIN_REJECTED', 401);}
            failedLogins = 0; issue(res); return json(res, 200, {ok: true});
        }
        if (route === '/api/teacher/settings' && req.method === 'POST') {
            if (settings.status().initialized && !authorized(req)) throw fail('LOGIN_REQUIRED', 401);
            if (busySettings || busyAnalysis) throw fail('BUSY', 409);
            busySettings = true;
            try {
                const body = await readBody(req);
                const status = await settings.save(body);
                const secret = settings.secrets();
                // Demo data must never be uploaded, even if a teacher previews connection settings.
                await store.setSheetClient(demo ? null : createSheetClient({url: secret.sheetUrl,
                    token: secret.sheetToken, fetchImpl}), sheetScope(demo ? '' : secret.sheetUrl));
                sessions.clear(); issue(res); return json(res, 200, {ok: true, ...status});
            } finally {busySettings = false;}
        }
        if (!authorized(req)) throw fail('LOGIN_REQUIRED', 401);
        if (route === '/api/teacher/logout' && req.method === 'POST') {
            sessions.delete(token(req));
            res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`);
            return json(res, 200, {ok: true});
        }
        if (route === '/api/records' && req.method === 'GET') {
            const records = await store.list();
            if (hasSecret(records)) throw fail('SECRET_IN_RECORDS');
            return json(res, 200, {records, sync: await store.status()});
        }
        if (route === '/api/records/sync' && req.method === 'POST') {
            if (demo) throw fail('DEMO_SYNC_DISABLED', 409);
            if (busySettings) throw fail('BUSY', 409);
            return json(res, 200, {sync: await store.sync()});
        }
        if (route !== '/api/teacher/analyze' || req.method !== 'POST') throw fail('NOT_FOUND', 404);
        if (busyAnalysis || busySettings) throw fail('BUSY', 409);
        busyAnalysis = true;
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
        const disconnect = () => {if (!res.writableEnded) controller.abort();}; res.on('close', disconnect);
        try {
            const body = await readBody(req);
            if (!body || !['mock', 'live'].includes(body.mode) || typeof body.question !== 'string' ||
                !body.question.trim() || body.question.length > 1500 ||
                (body.history != null && (!Array.isArray(body.history) || body.history.length > 6 ||
                body.history.some(turn => !turn || !['user', 'assistant'].includes(turn.role) ||
                    typeof turn.text !== 'string' || turn.text.length > 6000)))) throw fail('INVALID_ANALYSIS');
            const records = selectAnalysisRecords(await store.list(), body.recordIds);
            const context = analysisContext(records);
            if (hasSecret(body) || hasSecret(context)) throw fail('SECRET_IN_ANALYSIS');
            if (!authorized(req)) throw fail('LOGIN_REQUIRED', 401);
            const apiKey = settings.secrets().aiKey;
            if (body.mode === 'live' && (!apiKey || !configured)) throw fail('AI_NOT_CONFIGURED');
            const result = body.mode === 'mock' ? mockAnalysis(records) : await requestAnalysis({apiKey, context,
                question: body.question.trim(), history: body.history || [], signal: controller.signal,
                fetchImpl, endpoint, model});
            if (controller.signal.aborted) throw fail('TIMEOUT', 504);
            if (!authorized(req)) throw fail('LOGIN_REQUIRED', 401);
            if (hasSecret(result)) throw fail('INVALID_MODEL_OUTPUT', 502);
            return json(res, 200, {result, source: body.mode === 'mock' ? 'mock' : 'live', model: body.mode === 'live' ? model : null,
                selection: {recordIds: records.map(r => r.id), count: context.count, from: context.from,
                    to: context.to, partial: context.partial}});
        } finally {clearTimeout(timer); res.off('close', disconnect); busyAnalysis = false;}
    };
    const messages = {INVALID_SHEET_CONFIG: 'GAS網址需是正式exec部署，RECORD_TOKEN須為8～200碼且與網址一起設定。',
        INVALID_PASSWORD: '教師密碼須為12～256字。', LOGIN_REQUIRED: '請先登入教師頁。',
        AI_NOT_CONFIGURED: '請保存API金鑰，並依說明設定AI端點及模型後重啟服務。',
        DEMO_SYNC_DISABLED: '目前是假資料模式，禁止同步至試算表。請停止服務後以正式模式啟動。',
        TIMEOUT: '分析逾時，未自動重送；上游仍可能已計費。', AUTH_REJECTED: 'AI服務拒絕金鑰，請核對該服務設定。'};
    const server = http.createServer((req, res) => {void handle(req, res).catch(error => {
        const code = error instanceof SyntaxError ? 'INVALID_JSON' : error.code || error.message;
        const upstreamCodes = ['INVALID_MODEL_OUTPUT', 'INVALID_PROVIDER_RESPONSE', 'UPSTREAM_NETWORK',
            'NETWORK_BLOCKED', 'AUTH_REJECTED', 'RATE_LIMITED', 'PROVIDER_ERROR', 'MODEL_INCOMPLETE'];
        json(res, error.status || (code === 'TIMEOUT' ? 504 : upstreamCodes.includes(code) ? 502 : 400),
            {error: messages[code] || '操作未完成，請核對輸入、連線設定與本機資料目錄。', code});
    });});
    server.requestTimeout = 30000; server.headersTimeout = 10000; server.maxConnections = 100;
    return server;
}

export async function startWorkspace({demo = false, port = 8080, dataDir = path.join(here, 'local-data', demo ? 'demo' : 'records'),
    endpoint = process.env.TEACHER_AI_ENDPOINT || '', model = process.env.TEACHER_AI_MODEL || ''} = {}) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_PORT');
    const settings = await createTeacherSettings(path.join(dataDir, 'teacher-settings.json'));
    const secret = settings.secrets();
    const store = createRecordStore(dataDir, {sheetClient: demo ? null : createSheetClient({url: secret.sheetUrl,
        token: secret.sheetToken}), syncScope: sheetScope(demo ? '' : secret.sheetUrl)});
    if (demo) {
        const records = JSON.parse(await fs.readFile(path.join(here, 'demo-records.json'), 'utf8'));
        for (const record of records) await store.save(record, {imported: true});
    }
    const server = createWorkspaceServer({settings, store, demo, endpoint, model});
    await new Promise((resolve, reject) => {server.once('error', reject); server.listen(port, '127.0.0.1', resolve);});
    return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    startWorkspace({demo: process.argv.includes('--demo'), port: Number(process.env.PORT || 8080)})
        .then(server => {
            console.log(`教師工作台：http://127.0.0.1:${server.address().port}/teacher.html`);
            console.log(process.argv.includes('--demo') ? '假資料模式：不提供試算表同步，先在教師頁建立密碼。' : '正式模式：先設定教師密碼，再串接作答紀錄來源。');
        }).catch(() => {console.error('啟動失敗：請核對埠號、資料目錄與AI端點／模型設定。'); process.exitCode = 1;});
}
