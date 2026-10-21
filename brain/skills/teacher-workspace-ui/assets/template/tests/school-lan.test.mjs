import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {addressKind, listInterfaces, makeConfig, saveConfig, readConfig, lanLaunchPlan, launchLan, main} from '../scripts/school-lan.mjs';
// Synthetic fixtures; never bound or contacted. Documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)
// are deliberately rejected by the tool, so the "public" fixture below uses an ordinary public-style address instead.
const ip = '11.22.33.44', privateIp = '10.8.8.9', port = 8700;
const nic = (address, internal = false) => ({address, family: 'IPv4', internal});
const interfaces = {Ethernet: [nic(ip)], WiFi: [nic(privateIp)], vEthernet: [nic('172.24.8.9')],
    Loopback: [nic('127.0.0.1', true)]};

test('explicit public-style IPv4, multiple NICs and excluded addresses', () => {
    assert.equal(addressKind(ip), 'public'); assert.equal(makeConfig({ip, port}, interfaces).ip, ip);
    assert.equal(makeConfig({ip: privateIp, port}, interfaces).interfaceName, 'WiFi');
    assert.equal(listInterfaces(interfaces).find(x => x.name === 'vEthernet').usable, false);
    for (const bad of [undefined, '0.0.0.0', '127.0.0.1', '169.254.1.2', '100.64.1.2', '224.0.0.1', '255.255.255.255',
        '::1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '198.18.1.2', '011.22.33.44', '172.24.8.9', '10.9.9.9']) {
        assert.throws(() => makeConfig({ip: bad, port}, interfaces));
    }
    assert.throws(() => makeConfig({ip, port}, {...interfaces, VPN: [nic(ip)]}), /LAN_INTERFACE_UNAVAILABLE/);
    assert.throws(() => makeConfig({ip}, interfaces), /INVALID_PORT/); // the port is never defaulted
    for (const badPort of [0, 1023, 65536, 8700.5, '8700', NaN]) assert.throws(() => makeConfig({ip, port: badPort}, interfaces), /INVALID_PORT/);
});
test('create-only settings, current interface recheck, no teacher LAN scope', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-lan-')); t.after(() => fs.rm(dir, {recursive: true, force: true}));
    const file = path.join(dir, 'local-data', 'lan.json'), config = makeConfig({ip, port}, interfaces);
    await saveConfig(file, config); assert.deepEqual(await readConfig(file, interfaces), config);
    await assert.rejects(saveConfig(file, {...config, port: 8701}), {code: 'EEXIST'});
    assert.deepEqual(await readConfig(file, interfaces), config);
    await assert.rejects(readConfig(file, {Other: [nic(ip)]}), /LAN_INTERFACE_CHANGED/);
    await assert.rejects(readConfig(file, {Ethernet: [nic('10.2.3.4')]}), /LAN_INTERFACE_UNAVAILABLE/);
    for (const value of [{...config, access: 'teacher'}, {...config, aiKey: 'not-a-real-key'}, {...config, version: 2}]) {
        const bad = path.join(dir, 'bad.json'); await fs.writeFile(bad, JSON.stringify(value));
        await assert.rejects(readConfig(bad, interfaces), /INVALID_LAN_CONFIG/);
    }
});
test('adapter starts the project student-server entry, forwards bounded LAN environment and child failure', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-lan-launch-')); t.after(() => fs.rm(dir, {recursive: true, force: true}));
    const project = path.join(dir, 'project with spaces'), configFile = path.join(dir, 'lan.json');
    const entry = path.join('server', 'student.mjs');
    await saveConfig(configFile, makeConfig({ip, port}, interfaces));
    await assert.rejects(lanLaunchPlan({project, entry, config: configFile}, interfaces), {code: 'ENOENT'});
    await fs.mkdir(path.join(project, 'server'), {recursive: true});
    await assert.rejects(lanLaunchPlan({project, entry, config: configFile}, interfaces), {code: 'ENOENT'});
    const script = path.join(project, entry);
    await fs.writeFile(script, `import fs from 'node:fs'; fs.writeFileSync('observed.json', JSON.stringify({
        mode:process.env.TUTOR_LAN, ip:process.env.TUTOR_LAN_IP, port:process.env.TUTOR_PORT})); process.exit(7);`);
    const real = await fs.realpath(script);
    const plan = await lanLaunchPlan({project, entry, studentPath: '/index.html', config: configFile}, interfaces);
    assert.deepEqual(plan.argv, [real]); assert.equal(plan.teacherUrl, `http://127.0.0.1:${port}/teacher.html`);
    assert.equal(plan.studentUrl, `http://${ip}:${port}/index.html`); assert.equal(await launchLan(plan), 7);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(project, 'observed.json'), 'utf8')), {mode: '1', ip, port: String(port)});
    // The entry must be a relative path that stays inside the project.
    for (const badEntry of [undefined, '', path.resolve(script), path.join('..', 'outside.mjs')]) {
        await assert.rejects(lanLaunchPlan({project, entry: badEntry, config: configFile}, interfaces), /ENTRY_REQUIRED|ENOENT/);
    }
    await assert.rejects(lanLaunchPlan({project, entry, config: configFile}, {Ethernet: [nic('10.2.3.4')]}), /LAN_INTERFACE_UNAVAILABLE/);
    await assert.rejects(main(['list', '--ip', ip]), /INVALID_COMMAND/);
    await assert.rejects(main(['configure', '--ip', ip, '--port', '8e3']), /INVALID_PORT/);
    await assert.rejects(main(['configure', '--ip', ip]), /INVALID_PORT/);
});
