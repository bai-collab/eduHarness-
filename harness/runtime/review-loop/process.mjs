import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';

// 不經 shell；提示詞只走 stdin。逾時／超量時收束程序樹，並限制等待時間。
export function runProcess(command, argv, { cwd = process.cwd(), input = '', timeoutMs = 180000, maxBytes = 2_000_000 } = {}) {
  return new Promise(resolve => {
    let child, timer, grace, done = false;
    let stdout = '', stderr = '', bytes = 0, timedOut = false, overflow = false, spawnError = null;
    const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
    const finish = (exitCode, signal) => {
      if (done) return;
      done = true; clearTimeout(timer); clearTimeout(grace);
      stdout += decoders.stdout.end(); stderr += decoders.stderr.end();
      resolve({ command, argv, exitCode, signal, stdout, stderr, timedOut, overflow, spawnError });
    };
    const stop = () => {
      if (!child?.pid) return;
      if (process.platform === 'win32') {
        const killer = spawn(path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32/taskkill.exe'),
          ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        const fallback = () => { try { child.kill('SIGKILL'); } catch {} };
        killer.on('error', fallback);
        killer.on('exit', code => { if (code !== 0) fallback(); });
      } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} } }
      grace = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} child.unref();
        child.stdout?.destroy(); child.stderr?.destroy(); finish(null, 'TERMINATION_UNCONFIRMED'); }, 5000);
    };
    try {
      child = spawn(command, argv, { cwd, shell: false, windowsHide: true,
        detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) { spawnError = e.message; finish(null, null); return; }
    const collect = (kind, chunk) => {
      if (overflow) return;
      bytes += chunk.length;
      if (bytes > maxBytes) { overflow = true; stop(); return; }
      if (kind === 'stdout') stdout += decoders.stdout.write(chunk); else stderr += decoders.stderr.write(chunk);
    };
    child.stdout.on('data', c => collect('stdout', c)); child.stderr.on('data', c => collect('stderr', c));
    child.on('error', e => { spawnError = e.message; finish(null, null); });
    child.on('close', finish);
    child.stdin.on('error', e => { spawnError ??= `STDIN:${e.message}`; });
    timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    child.stdin.end(input, 'utf8');
  });
}

export function resolveCodex() {
  const override = process.env.CODEX_BIN;
  if (override) {
    const file = fs.realpathSync(override);
    if (/\.js$/i.test(file)) return { command: process.execPath, prefix: [file] };
    if (/\.(cmd|bat|ps1)$/i.test(file)) throw new Error('CODEX_NATIVE_OR_JS_REQUIRED');
    return { command: file, prefix: [] };
  }
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    const native = path.join(dir, process.platform === 'win32' ? 'codex.exe' : 'codex');
    if (fs.existsSync(native)) return { command: fs.realpathSync(native), prefix: [] };
    // npm 的 Windows shim 不經 cmd.exe 啟動，直接呼叫同一安裝的 JS 入口。
    const js = path.join(dir, 'node_modules/@openai/codex/bin/codex.js');
    if (fs.existsSync(js)) return { command: process.execPath, prefix: [fs.realpathSync(js)] };
  }
  throw new Error('CODEX_NOT_FOUND');
}

export const processSucceeded = r => r.exitCode === 0 && !r.signal && !r.timedOut && !r.overflow && !r.spawnError;
