// 全螢幕檢查：在數種視窗比例下進入全螢幕，逐段確認舞台與字幕都在畫面內（含兩行字幕的段落）。
// 用法：node fs-check.mjs <index.html> [--port <local.chrome_debug_port>] [--verbose]
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const file = resolve(process.argv[2]);
const PORT = Number(process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1] : (process.env.CHROME_DEBUG_PORT || 9222)); // 設定鍵 local.chrome_debug_port
const VERBOSE = process.argv.includes("--verbose");
const SHOT = process.argv.includes("--shot") ? resolve(process.argv[process.argv.indexOf("--shot") + 1]) : null;
const CHROME = process.env.CHROME || join(process.env.ProgramFiles || "", "Google/Chrome/Application/chrome.exe");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "fs-check-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
const stop = () => { if (chrome.pid) spawnSync("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" }); try { rmSync(profile, { recursive: true, force: true }); } catch {} };
let ws, id = 1; const pend = new Map();
const cdp = (m, p = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => { const r = await cdp("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 200)); return r.result.value; };
const MEASURE = `(async () => {
  const out = [];
  for (const s of window.SEGS) {
    await window.seek((s.a + s.b) / 2);
    const cap = document.getElementById('caption');
    const c = cap.getBoundingClientRect(), b = document.querySelector('.board').getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(cap).lineHeight) || parseFloat(getComputedStyle(cap).fontSize) * 1.5;
    out.push({ name: s.name, capTop: Math.round(c.top), capBottom: Math.round(c.top + Math.max(c.height, cap.scrollHeight)), lines: Math.round(cap.scrollHeight / lh),
      boardTop: Math.round(b.top), boardBottom: Math.round(b.bottom), font: getComputedStyle(cap).fontSize });
  }
  return { h: innerHeight, fs: !!document.fullscreenElement, fontOk: document.fonts.check('20px "LXGW WenKai TC"'), rows: out };
})()`;
let failed = 0, passed = 0;
try {
  for (let i = 0; i < 40; i++) { await sleep(250); try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch {} }
  const page = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onmessage = (e) => { const m = JSON.parse(e.data); const p = pend.get(m.id); if (p) { pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  await cdp("Runtime.enable"); await cdp("Page.enable");
  for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 1024], [1440, 900], [2560, 1080], [1280, 720]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await cdp("Page.navigate", { url: pathToFileURL(file).href });
    for (let i = 0; i < 60; i++) { await sleep(200); if (await ev("typeof window.seek==='function'").catch(() => false)) break; }
    await ev("Promise.resolve(window.ready)");
    await ev("document.getElementById('theater').requestFullscreen().then(()=>true,()=>false)");
    await sleep(400);
    const m = await ev(MEASURE);
    const bad = m.rows.filter((r) => r.capBottom > m.h || r.boardTop < 0);
    const maxLines = Math.max(...m.rows.map((r) => r.lines));
    const good = m.fs && bad.length === 0;
    good ? passed++ : failed++;
    console.log(`${good ? "PASS" : "FAIL"}  ${w}×${h} 全螢幕=${m.fs} 字型就緒=${m.fontOk} 字幕最多 ${maxLines} 行${bad.length ? "；超出：" + bad.map((r) => `「${r.name}」字幕底 ${r.capBottom}/${m.h}`).join("、") : ""}`);
    if (SHOT && w === 1366) {
      await ev("window.seek(window.SEGS.at(-1).a + window.SEGS.at(-1).len - 0.3)");
      const s = await cdp("Page.captureScreenshot", { format: "png" });
      writeFileSync(SHOT, Buffer.from(s.data, "base64"));
    }
    if (VERBOSE) for (const r of m.rows) console.log(`   ${r.name}：舞台 ${r.boardTop}–${r.boardBottom}，字幕 ${r.capTop}–${r.capBottom}（${r.lines} 行，${r.font}）`);
    await ev("document.fullscreenElement && document.exitFullscreen()").catch(() => {});
  }
} catch (e) { failed++; console.log("FAIL  " + (e?.stack || e)); }
finally { try { ws?.close(); } catch {} stop(); }
console.log(`\nfs-check：${passed} 通過，${failed} 失敗`);
process.exit(failed ? 1 : 0);
