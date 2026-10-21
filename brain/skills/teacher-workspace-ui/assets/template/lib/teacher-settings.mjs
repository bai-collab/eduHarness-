import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes, scryptSync, timingSafeEqual, createHash} from 'node:crypto';
import {createSheetClient} from './sheet-client.mjs';

const validKey = value => typeof value === 'string' && value.length >= 8 && value.length <= 512 && /^[\x21-\x7e]+$/.test(value);
export const sheetScope = url => url ? createHash('sha256').update(url).digest('hex') : 'offline';
// 本機檔案保護範圍：密碼雜湊；服務密鑰為本機明文，不宣稱能防控制電腦者。
export async function createTeacherSettings(file) {
    let state = null, writing = false;
    const validate = value => {
        if (!value || value.version !== 1 || !/^[a-f0-9]{32}$/.test(value.salt || '') ||
            !/^[a-f0-9]{128}$/.test(value.passwordHash || '') ||
            typeof value.aiKey !== 'string' || (value.aiKey && !validKey(value.aiKey)) ||
            typeof value.sheetUrl !== 'string' || typeof value.sheetToken !== 'string') throw new Error('INVALID_SETTINGS');
        createSheetClient({url: value.sheetUrl, token: value.sheetToken});
        return {version: 1, salt: value.salt, passwordHash: value.passwordHash,
            aiKey: value.aiKey, sheetUrl: value.sheetUrl, sheetToken: value.sheetToken};
    };
    try { state = validate(JSON.parse(await fs.readFile(file, 'utf8'))); }
    catch (error) {if (error.code !== 'ENOENT') throw new Error('SETTINGS_READ_FAILED');}
    const status = () => ({managed: true, initialized: Boolean(state), aiConfigured: Boolean(state?.aiKey),
        sheetConfigured: Boolean(state?.sheetUrl)});
    const verify = password => {
        if (!state || typeof password !== 'string' || password.length > 256) return false;
        const hash = scryptSync(password, state.salt, 64);
        return timingSafeEqual(hash, Buffer.from(state.passwordHash, 'hex'));
    };
    const save = async input => {
        if (writing) throw new Error('SETTINGS_BUSY');
        writing = true;
        let temp;
        try {
            if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_SETTINGS');
            for (const field of ['password', 'aiKey', 'sheetUrl', 'sheetToken']) {
                if (input[field] !== undefined && typeof input[field] !== 'string') throw new Error('INVALID_SETTINGS');
            }
            const password = input.password || '';
            if ((!state || password) && (password.length < 12 || password.length > 256)) throw new Error('INVALID_PASSWORD');
            const next = {...(state || {}), version: 1};
            if (!state || password) {
                next.salt = randomBytes(16).toString('hex');
                next.passwordHash = scryptSync(password, next.salt, 64).toString('hex');
            }
            next.aiKey = input.clearAi === true ? '' : input.aiKey?.trim() || state?.aiKey || '';
            if (input.clearSheet === true) { next.sheetUrl = ''; next.sheetToken = ''; }
            else {
                next.sheetUrl = input.sheetUrl?.trim() || state?.sheetUrl || '';
                next.sheetToken = input.sheetToken?.trim() || state?.sheetToken || '';
            }
            const clean = validate(next);
            await fs.mkdir(path.dirname(file), {recursive: true});
            temp = `${file}.${randomBytes(12).toString('hex')}.tmp`;
            const handle = await fs.open(temp, 'wx', 0o600);
            try {await handle.writeFile(JSON.stringify(clean)); await handle.sync();} finally {await handle.close();}
            await fs.rename(temp, file);
            state = clean;
            return status();
        } finally {
            writing = false;
            if (temp) await fs.unlink(temp).catch(error => {if (error.code !== 'ENOENT') throw error;});
        }
    };
    return {status, verify, save, secrets: () => ({aiKey: state?.aiKey || '', sheetUrl: state?.sheetUrl || '',
        sheetToken: state?.sheetToken || ''})};
}
