// 真的呼叫 agy 的唯一入口。測試一律注入自己的 spawnImpl，不得走到這裡的真實 spawn。
import { spawn as nodeSpawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function resolveAgyBinary(env = process.env) {
  if (env.AGY_BIN) return env.AGY_BIN;
  const localAppData = env.LOCALAPPDATA;
  if (localAppData) {
    const candidate = path.join(localAppData, "agy", "bin", "agy.exe");
    if (fs.existsSync(candidate)) return candidate;
  }
  return "agy";
}

/** @param {string[]} argv
 * @param {{cwd?: string, input?: string, env?: NodeJS.ProcessEnv, timeoutMs?: number}} [options]
 */
export function spawnAgy(argv, { cwd, input = "", env = process.env, timeoutMs } = {}) {
  return new Promise(resolve => {
    const bin = resolveAgyBinary(env);
    let child;
    try {
      child = nodeSpawn(bin, argv, { cwd, env, windowsHide: true });
    } catch (spawnError) {
      resolve({ stdout: "", stderr: "", exitCode: null, signal: null, timedOut: false, spawnError: String(spawnError?.message ?? spawnError) });
      return;
    }
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timer = null;
    if (timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);
    }
    child.stdout?.on("data", chunk => { stdout += chunk; });
    child.stderr?.on("data", chunk => { stderr += chunk; });
    child.on("error", error => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: null, signal: null, timedOut, spawnError: String(error?.message ?? error) });
    });
    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code, signal, timedOut, spawnError: null });
    });
    if (child.stdin) {
      child.stdin.write(input ?? "");
      child.stdin.end();
    }
  });
}
