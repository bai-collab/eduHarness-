import os from 'node:os';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {spawn} from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultConfig = path.join(here, '..', 'local-data', 'school-lan.json');
const virtual = /vEthernet|WSL|VMware|VirtualBox|Hyper-V|Loopback|Bluetooth|Tailscale|ZeroTier|tun|tap|VPN/i;
const fail = code => Object.assign(new Error(code), {code});
export function addressKind(address) {
    if (!net.isIPv4(address)) return 'excluded';
    const [a, b, c] = address.split('.').map(Number);
    if (a === 0 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
        (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0 && [0, 2].includes(c)) ||
        (a === 198 && [18, 19].includes(b)) || (a === 198 && b === 51 && c === 100) ||
        (a === 203 && b === 0 && c === 113)) return 'excluded';
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ? 'private' : 'public';
}
export function listInterfaces(interfaces = os.networkInterfaces()) {
    return Object.entries(interfaces).flatMap(([name, entries]) => (entries || []).map(item => {
        const kind = addressKind(item.address);
        const reason = virtual.test(name) ? '虛擬或通道網卡' : item.internal ? '本機內部網卡' :
            !['IPv4', 4].includes(item.family) ? '目前只支援IPv4' : kind === 'excluded' ? '特殊／保留位址' : '';
        return {name, address: item.address, kind, usable: !reason, reason};
    }));
}
// Explicit IP selection; never infer the school network from RFC1918 alone.
export function makeConfig({ip, port}, interfaces = os.networkInterfaces()) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw fail('INVALID_PORT');
    if (typeof ip !== 'string' || addressKind(ip) === 'excluded') throw fail('INVALID_LAN_IP');
    const matches = listInterfaces(interfaces).filter(item => item.address === ip);
    if (matches.length !== 1 || !matches[0].usable) throw fail('LAN_INTERFACE_UNAVAILABLE');
    return {version: 1, access: 'student-only', ip, port, interfaceName: matches[0].name};
}
export async function saveConfig(file, value) {
    await fs.mkdir(path.dirname(path.resolve(file)), {recursive: true});
    await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx', mode: 0o600});
}
export async function readConfig(file, interfaces = os.networkInterfaces()) {
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!value || Object.keys(value).sort().join(',') !== 'access,interfaceName,ip,port,version' ||
        value.version !== 1 || value.access !== 'student-only') throw fail('INVALID_LAN_CONFIG');
    const checked = makeConfig(value, interfaces);
    if (value.interfaceName !== checked.interfaceName) throw fail('LAN_INTERFACE_CHANGED');
    return checked;
}
export async function lanLaunchPlan({project, entry, studentPath = '/', teacherPath = '/teacher.html', config = defaultConfig},
    interfaces = os.networkInterfaces()) {
    if (typeof project !== 'string' || !project.trim()) throw fail('PROJECT_REQUIRED');
    if (typeof entry !== 'string' || !entry.trim() || path.isAbsolute(entry)) throw fail('ENTRY_REQUIRED');
    const settings = await readConfig(config, interfaces);
    const cwd = await fs.realpath(project);
    const script = await fs.realpath(path.resolve(cwd, entry));
    const inside = path.relative(cwd, script);
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside) || !(await fs.stat(script)).isFile()) throw fail('ENTRY_REQUIRED');
    // Use the project's own student server; never expose the standalone teacher template.
    return {cwd, argv: [script], env: {TUTOR_LAN: '1', TUTOR_LAN_IP: settings.ip, TUTOR_PORT: String(settings.port)},
        studentUrl: `http://${settings.ip}:${settings.port}${studentPath}`,
        teacherUrl: `http://127.0.0.1:${settings.port}${teacherPath}`};
}
export function launchLan(plan) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, plan.argv, {cwd: plan.cwd, env: {...process.env, ...plan.env}, stdio: 'inherit'});
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve(signal ? 1 : code ?? 1));
    });
}
const help = `用法（在範本資料夾）：
  node scripts/school-lan.mjs list
  node scripts/school-lan.mjs configure --ip <此機校內IPv4> --port <學生端埠號>
  node scripts/school-lan.mjs start --project <專案資料夾> --entry <學生端伺服器相對路徑> [--student-path /] [--teacher-path /teacher.html]
可用 --config <設定檔路徑> 指定另一份設定。設定工具不開監聽器、不改防火牆。
IPv4 與埠號不寫死：請由工作區根目錄 private/config/sites.local.json 的 local.lan_ipv4、local.student_port 取值後傳入。
教師範本 server.mjs 維持本機；start 需要專案本身已有學生端伺服器，並讀取 TUTOR_LAN／TUTOR_LAN_IP／TUTOR_PORT。`;
export async function main(args = process.argv.slice(2)) {
    const [command, ...flags] = args;
    if (!command || command === 'help') {console.log(help); return 0;}
    const {values} = parseArgs({args: flags, options: {ip: {type: 'string'}, port: {type: 'string'},
        config: {type: 'string'}, project: {type: 'string'}, entry: {type: 'string'},
        'student-path': {type: 'string'}, 'teacher-path': {type: 'string'}}, strict: true, allowPositionals: false});
    const allowed = {list: [], configure: ['ip', 'port', 'config'], start: ['project', 'entry', 'student-path', 'teacher-path', 'config']}[command];
    if (!allowed || Object.keys(values).some(key => !allowed.includes(key))) throw fail('INVALID_COMMAND');
    if (command === 'list') {
        for (const item of listInterfaces()) console.log(`${item.name}\t${item.address}\t${item.usable ?
            item.kind === 'public' ? '可選：公開網段，需確認校內防火牆' : '可選：私人網段' : '排除：' + item.reason}`);
        return 0;
    }
    if (command === 'configure') {
        if (values.port != null && !/^\d+$/.test(values.port)) throw fail('INVALID_PORT');
        const settings = makeConfig({ip: values.ip, port: values.port == null ? undefined : Number(values.port)});
        await saveConfig(values.config || defaultConfig, settings);
        console.log('區網設定已保存；尚未開啟服務。只允許學生端區網，教師端保留本機。');
        return 0;
    }
    const plan = await lanLaunchPlan({project: values.project, entry: values.entry, studentPath: values['student-path'] || '/',
        teacherPath: values['teacher-path'] || '/teacher.html', config: values.config || defaultConfig});
    console.log('嘗試啟動專案的學生端服務；以下網址須等原服務顯示啟動成功才可用：');
    console.log(`學生：${plan.studentUrl}\n教師（僅本機）：${plan.teacherUrl}`);
    return launchLan(plan);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().then(code => {process.exitCode = code;}).catch(error => {
        const messages = {INVALID_PORT: '埠號須為1024～65535的整數。', INVALID_LAN_IP: '請選擇這台教師機的有效校內IPv4。',
            LAN_INTERFACE_UNAVAILABLE: '位址不在唯一可用實體網卡上；請重新列出網卡，不自動改用其他位址。',
            LAN_INTERFACE_CHANGED: '同位址的網卡已變更，請重新確認並建立另一份設定。',
            EEXIST: '設定檔已存在，未覆寫；換網路時請用--config指定另一份檔案。',
            ENOENT: '找不到設定、專案資料夾或學生端伺服器檔案；請核對路徑。',
            INVALID_LAN_CONFIG: '區網設定格式不符，教師遠端開放不在此工具範圍。', PROJECT_REQUIRED: '請指定專案資料夾。', ENTRY_REQUIRED: '請以 --entry 指定專案內學生端伺服器的相對路徑（不可在專案外）。'};
        console.error(messages[error.code] || '操作未完成，請用help核對命令與專案檔案。'); process.exitCode = 1;
    });
}
