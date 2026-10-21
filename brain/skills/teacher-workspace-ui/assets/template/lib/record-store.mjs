import fs from 'node:fs/promises';
import path from 'node:path';
const str = (value, max) => typeof value === 'string' && value.length <= max ? value : '';
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
export function cleanProgram(program) {
    if (!plain(program) || !Array.isArray(program.targets) || program.targets.length > 100 ||
        JSON.stringify(program).length > 120000) throw new Error('INVALID_PROGRAM');
    const targets = program.targets.map(target => {
        if (!plain(target) || !plain(target.blocks)) throw new Error('INVALID_PROGRAM');
        const definitions = input => Object.fromEntries(Object.entries(plain(input) ? input : {}).map(([id, value]) => {
            if (!Array.isArray(value) || typeof value[0] !== 'string') throw new Error('INVALID_PROGRAM');
            return [id, [str(value[0], 1000)]];
        }));
        const blocks = Object.fromEntries(Object.entries(target.blocks).map(([id, block]) => {
            if (Array.isArray(block)) {
                if (block.length > 10 || block.some(v => !['string', 'number'].includes(typeof v))) throw new Error('INVALID_PROGRAM');
                return [id, block];
            }
            if (!plain(block) || typeof block.opcode !== 'string') throw new Error('INVALID_PROGRAM');
            const copy = {opcode: str(block.opcode, 100)};
            for (const key of ['next', 'parent', 'inputs', 'fields', 'shadow', 'topLevel', 'x', 'y']) {
                if (Object.hasOwn(block, key)) copy[key] = block[key];
            }
            return [id, copy];
        }));
        return {name: str(target.name, 200), isStage: target.isStage === true,
            variables: definitions(target.variables), lists: definitions(target.lists), blocks};
    });
    return {targets};
}
export function cleanRecord(input) {
    if (!plain(input) || !/^[a-zA-Z0-9_-]{8,80}$/.test(input.id || '') ||
        !/^[\p{L}\p{N}_-]{1,40}$/u.test(input.studentId || '') ||
        !['ai', 'grade'].includes(input.type) || !['completed', 'failed'].includes(input.status) ||
        !str(input.task?.code, 120)) throw new Error('INVALID_RECORD');
    const record = {id: input.id, studentId: input.studentId, type: input.type, status: input.status,
        task: {code: input.task.code, title: str(input.task.title, 200)}, program: cleanProgram(input.program)};
    if (input.type === 'grade') {
        if (input.status === 'completed' && (!Number.isFinite(input.totalScore) || !Number.isFinite(input.maxScore) ||
            input.totalScore < 0 || input.maxScore < input.totalScore)) throw new Error('INVALID_SCORE');
        Object.assign(record, {totalScore: input.status === 'completed' ? input.totalScore : null,
            maxScore: input.status === 'completed' ? input.maxScore : null, demoLoaded: input.demoLoaded === true,
            programChanged: input.programChanged !== false, errorCode: input.status === 'failed' ? 'GRADING_FAILED' : ''});
    } else {
        if (!['mock', 'live'].includes(input.source) || !str(input.question, 1500)) throw new Error('INVALID_RECORD');
        Object.assign(record, {source: input.source, question: input.question,
            guidance: str(input.guidance, 2000), followup: str(input.followup, 2000),
            errorCode: /^[A-Z_]{1,60}$/.test(input.errorCode || '') ? input.errorCode : ''});
    }
    return record;
}
export function summarize(records) {
    const pairs = new Map();
    for (const record of [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
        const key = JSON.stringify([record.studentId, record.task.code]);
        const row = pairs.get(key) || {studentId: record.studentId, task: record.task, latestGrade: null,
            latestProgram: null, aiCount: 0, gradeCount: 0};
        if (record.type === 'ai') row.aiCount++;
        else {
            row.gradeCount++;
            if (record.status === 'completed' && !record.demoLoaded && !record.programChanged) row.latestGrade = record;
        }
        row.latestProgram = record;
        row.lastActivity = record.timestamp;
        pairs.set(key, row);
    }
    return [...pairs.values()].map(row => ({...row,
        latestGrade: row.latestGrade ? {id: row.latestGrade.id, totalScore: row.latestGrade.totalScore,
            maxScore: row.latestGrade.maxScore, timestamp: row.latestGrade.timestamp} : null,
        latestProgram: row.latestProgram?.id}));
}
// 本機紀錄總數上限：到達後一律拒絕新增（不刪舊資料），所有寫入路徑都經過 save。
export const RECORD_LIMIT = 50000;
export const isRecordLimitError = error => error?.code === 'RECORD_LIMIT';
export function createRecordStore(directory, {sheetClient = null, syncScope = '', recordLimit = RECORD_LIMIT} = {}) {
    const limit = Number.isSafeInteger(recordLimit) && recordLimit > 0 ? recordLimit : RECORD_LIMIT;
    let initialized;
    let tail = Promise.resolve();
    let syncing;
    let changingClient = false;
    let pullOffset = 0;
    const records = new Map(), synced = new Set();
    let lastSyncError = '';
    const eventsFile = path.join(directory, 'events.jsonl');
    const receiptPath = scope => {
        if (scope && !/^(?:offline|[a-f0-9]{64})$/.test(scope)) throw new Error('INVALID_SYNC_SCOPE');
        return path.join(directory, scope ? `synced-${scope}.jsonl` : 'synced.jsonl');
    };
    let syncFile = receiptPath(syncScope);
    const readLines = async (file, onLine) => {
        let content;
        try { content = await fs.readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
        for (const line of content.split('\n').filter(Boolean)) onLine(JSON.parse(line));
    };
    const init = () => initialized ||= (async () => {
        await fs.mkdir(directory, {recursive: true});
        await readLines(eventsFile, record => {
            const clean = cleanRecord(record);
            if (!Number.isFinite(Date.parse(record.timestamp))) throw new Error('INVALID_STORED_RECORD');
            records.set(clean.id, {...clean, timestamp: record.timestamp});
        });
        await readLines(syncFile, id => {if (typeof id === 'string') synced.add(id);});
    })();
    const append = async (file, data) => {
        const handle = await fs.open(file, 'a');
        try { await handle.writeFile(JSON.stringify(data) + '\n'); await handle.sync(); } finally { await handle.close(); }
    };
    const serialize = operation => {
        const pending = tail.then(operation);
        tail = pending.catch(() => {});
        return pending;
    };
    const save = (input, {imported = false} = {}) => serialize(async () => {
        await init();
        const clean = cleanRecord(input);
        const existing = records.get(clean.id);
        if (existing && JSON.stringify(cleanRecord(existing)) !== JSON.stringify(clean)) throw new Error('RECORD_ID_CONFLICT');
        if (!existing) {
            if (records.size >= limit) throw Object.assign(new Error('RECORD_LIMIT'), {code: 'RECORD_LIMIT'});
            const timestamp = imported && Number.isFinite(Date.parse(input.timestamp)) ? input.timestamp : new Date().toISOString();
            const record = {...clean, timestamp};
            await append(eventsFile, record);
            records.set(clean.id, record);
        }
        if (imported && !synced.has(clean.id)) { await append(syncFile, clean.id); synced.add(clean.id); }
        return {status: 'saved_local', id: clean.id};
    });
    const status = () => ({configured: Boolean(sheetClient), total: records.size,
        pending: [...records.keys()].filter(id => !synced.has(id)).length, lastSyncError});
    const sync = ({pull = true} = {}) => {
        if (changingClient) return Promise.resolve({...status(), pushed: 0, imported: 0, more: false, lastSyncError: 'SHEET_SETTINGS_UPDATING'});
        if (syncing) return syncing;
        syncing = (async () => {
            await init();
            if (!sheetClient) return {...status(), pushed: 0, imported: 0, more: false};
            let pushed = 0, imported = 0, more = false;
            lastSyncError = '';
            try {
                const pending = [...records.values()].filter(record => !synced.has(record.id)).slice(0, 10);
                for (const record of pending) {
                    await sheetClient.append(record);
                    await serialize(async () => {await append(syncFile, record.id); synced.add(record.id);});
                    pushed++;
                }
                if (pull) {
                    const page = await sheetClient.read(pullOffset);
                    for (const record of page.records) { await save(record, {imported: true}); imported++; }
                    pullOffset = page.nextOffset;
                    more = page.more;
                }
            } catch (error) { lastSyncError = 'SHEET_SYNC_FAILED'; }
            return {...status(), pushed, imported, more};
        })().finally(() => { syncing = null; });
        return syncing;
    };
    const autoSync = () => {
        if (!sheetClient) return;
        void sync({pull: false}).then(result => {
            if (result.pending && !result.lastSyncError) setTimeout(autoSync, 0);
        }).catch(() => {});
    };
    const setSheetClient = async (client, scope) => {
        if (changingClient) throw new Error('SHEET_SETTINGS_UPDATING');
        changingClient = true;
        try {
            if (syncing) await syncing;
            await serialize(async () => {
            await init();
            const nextFile = receiptPath(scope);
            const nextSynced = new Set();
            await readLines(nextFile, id => {if (typeof id === 'string') nextSynced.add(id);});
            sheetClient = client;
            syncFile = nextFile;
            synced.clear();
            for (const id of nextSynced) synced.add(id);
            pullOffset = 0;
            lastSyncError = '';
            });
        } finally { changingClient = false; }
    };
    return {save, sync, autoSync, setSheetClient, list: async () => {await init(); await tail; return [...records.values()];},
        status: async () => {await init(); return status();},
        // 呼叫上游模型前先確認是否已滿，避免付費請求後才發現無法保存。
        full: async () => {await init(); await tail; return records.size >= limit;}};
}
