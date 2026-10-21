// 教學動畫自審（repo-to-teaching-animation 第 3、4 節）：無頭 Chrome 開 file://index.html，檢查契約並截圖。
// 用法：node <repo-to-teaching-animation>/scripts/check-anim.mjs <index.html> [--out <截圖資料夾>] [--port <local.chrome_debug_port>]
// 檢查：DURATION／SEGS／seek／ready 存在；每段中點、起點＋0.3、終點－0.3 截圖；同一 t 兩次 SVG 相同（冪等）；
//       可見 <text> 不超出 1600×900 安全區（60px）且彼此不大幅重疊；主控台無例外；?embed=1 只剩舞台與字幕。
// 只關自己啟動的 Chrome（taskkill /T）。
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const file = resolve(args[0] || "");
const out = opt("--out", null) ? resolve(opt("--out")) : null;
const PORT = Number(opt("--port", process.env.CHROME_DEBUG_PORT || 9222)); // 設定鍵 local.chrome_debug_port
const CHROME = process.env.CHROME || join(process.env.ProgramFiles || "", "Google/Chrome/Application/chrome.exe");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const check = (name, ok, detail = "") => { ok ? passed++ : failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : "  ← " + detail}`); };

const profile = mkdtempSync(join(tmpdir(), "anim-check-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--allow-file-access-from-files", "--window-size=1600,1100", "about:blank"], { stdio: "ignore" });
const stop = () => { if (chrome.pid) spawnSync("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" }); try { rmSync(profile, { recursive: true, force: true }); } catch {} };
let ws, id = 1; const pend = new Map(); const exceptions = [];
const cdp = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
async function open(url) {
  await cdp("Page.navigate", { url });
  for (let i = 0; i < 80; i++) { await sleep(250); if (await ev("typeof window.seek==='function'&&!!window.ready").catch(() => false)) break; }
  await ev("Promise.resolve(window.ready).then(()=>true)");
}
const GEOM = `(() => {
  const svg = document.getElementById('stage'); const vb = svg.viewBox.baseVal; const r = svg.getBoundingClientRect(); const k = vb.width / r.width;
  const vis = (el) => { let o = 1; for (let e = el; e && e !== svg; e = e.parentElement) { const a = e.getAttribute('opacity'); if (a !== null && a !== '') o *= Number(a); } return o; };
  return [...svg.querySelectorAll('text')].filter((t) => vis(t) > 0.3 && t.textContent.trim()).map((t) => { const b = t.getBoundingClientRect();
    return { s: t.textContent.trim().slice(0, 40), x0: (b.left - r.left) * k, y0: (b.top - r.top) * k, x1: (b.right - r.left) * k, y1: (b.bottom - r.top) * k }; });
})()`;

try {
  for (let i = 0; i < 40; i++) { await sleep(250); try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch {} }
  const page = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method === "Runtime.exceptionThrown") exceptions.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text); const p = pend.get(m.id); if (p) { pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  await cdp("Runtime.enable"); await cdp("Page.enable");
  await open(pathToFileURL(file).href);
  const info = await ev("({D:window.DURATION,segs:(window.SEGS||[]).map(s=>({a:s.a,b:s.b,name:s.name,grp:s.grp}))})");
  check("window.DURATION 為正數", Number.isFinite(info.D) && info.D > 0, String(info.D));
  check("window.SEGS 有段落且首尾相接", info.segs.length > 0 && info.segs[0].a === 0 && Math.abs(info.segs.at(-1).b - info.D) < 1e-6 && info.segs.every((s, i) => i === 0 || s.a === info.segs[i - 1].b), JSON.stringify(info.segs).slice(0, 200));
  const src = await ev("document.documentElement.outerHTML");
  check("沒有使用 Date.now／setTimeout／setInterval／CSS transition", !/Date\.now|setTimeout|setInterval|transition\s*:|@keyframes/.test(src));
  if (out) mkdirSync(out, { recursive: true });
  const overflow = [], overlap = [];
  for (let i = 0; i < info.segs.length; i++) {
    const s = info.segs[i];
    for (const [tag, t] of [["start", s.a + 0.3], ["mid", (s.a + s.b) / 2], ["end", s.b - 0.3]]) {
      await ev(`window.seek(${t.toFixed(3)})`);
      const g = await ev(GEOM);
      for (const b of g) if (b.x0 < 50 || b.y0 < 30 || b.x1 > 1550 || b.y1 > 890) overflow.push(`段${i + 1}${tag}「${b.s}」`);
      for (let a = 0; a < g.length; a++) for (let c = a + 1; c < g.length; c++) {
        const A = g[a], B = g[c]; const w = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), h = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        if (w > 0 && h > 0 && w * h > 0.3 * Math.min((A.x1 - A.x0) * (A.y1 - A.y0), (B.x1 - B.x0) * (B.y1 - B.y0))) overlap.push(`段${i + 1}${tag}「${A.s}」×「${B.s}」`);
      }
      if (out && (tag === "mid" || tag === "end")) {
        const shot = await cdp("Page.captureScreenshot", { format: "png" });
        writeFileSync(join(out, `seg${String(i + 1).padStart(2, "0")}-${tag}.png`), Buffer.from(shot.data, "base64"));
      }
    }
    const t = (s.a + s.b) / 2;
    const h1 = await ev(`window.seek(${t}).then(()=>document.getElementById('stage').innerHTML)`);
    await ev(`window.seek(0)`);
    const h2 = await ev(`window.seek(${t}).then(()=>document.getElementById('stage').innerHTML)`);
    if (h1 !== h2) check(`段 ${i + 1} 冪等（同一 t 畫面相同）`, false);
  }
  check("各段冪等（同一 t 畫面相同）", true);
  check("文字都在安全區內", overflow.length === 0, [...new Set(overflow)].slice(0, 8).join("；"));
  check("文字沒有大幅重疊", overlap.length === 0, [...new Set(overlap)].slice(0, 8).join("；"));
  const t0 = await ev("(document.getElementById('play')?.click(), Number(document.getElementById('scrub')?.value||0))");
  await sleep(1500);
  const t1 = await ev("Number(document.getElementById('scrub')?.value||0)");
  await ev("document.getElementById('play')?.click()");
  check("播放鍵可推進時間", t1 > t0 + 0.5, `${t0} → ${t1}`);
  await open(pathToFileURL(file).href + "?embed=1");
  const emb = await ev("[...document.querySelectorAll('header,.controls,.chapters,.works,.note')].every(e=>getComputedStyle(e).display==='none'||e.hidden)");
  check("?embed=1 只剩舞台與字幕", emb);
  if (out) { await ev(`window.seek(${(info.segs[0].a + info.segs[0].b) / 2})`); const shot = await cdp("Page.captureScreenshot", { format: "png" }); writeFileSync(join(out, "embed-seg01.png"), Buffer.from(shot.data, "base64")); }
  check("主控台沒有例外", exceptions.length === 0, exceptions.slice(0, 3).join(" | "));
} catch (e) { failed++; console.log("FAIL  執行錯誤：" + (e?.stack || e)); }
finally { try { ws?.close(); } catch {} stop(); }
console.log(`\ncheck-anim：${passed} 通過，${failed} 失敗${out ? `；截圖：${out}` : ""}`);
process.exit(failed ? 1 : 0);
