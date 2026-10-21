// 產生動畫的畫面文字清單（screen-text.md）：暫存 deck.json → extract-deck-text 擷取 → 寫成 Markdown → 清掉暫存。
// 用法：node <本 Skill>/scripts/screen-text.mjs <動畫資料夾> <deck id> [--extractor <extract-deck-text.mjs 路徑>]
// 擷取工具由使用者指定（--extractor 或環境變數 DECK_TEXT_EXTRACTOR）；沒有就停下，不猜路徑。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const root = process.cwd();
const args = process.argv.slice(2);
const xi = args.indexOf("--extractor");
const extractorArg = xi >= 0 ? args[xi + 1] : process.env.DECK_TEXT_EXTRACTOR;
if (!extractorArg) { console.error("請以 --extractor 或環境變數 DECK_TEXT_EXTRACTOR 指定畫面文字擷取工具"); process.exit(2); }
const extractor = path.resolve(extractorArg);
if (!fs.existsSync(extractor)) { console.error("找不到擷取工具：" + extractor); process.exit(2); }
const dir = path.resolve(process.argv[2]);
const id = process.argv[3];
const name = path.basename(dir);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `anim-${name}-`)), out = tmp + "-text";
fs.rmSync(out, { recursive: true, force: true });
fs.copyFileSync(path.join(dir, "index.html"), path.join(tmp, "index.html"));
const t = JSON.parse(fs.readFileSync(path.join(dir, "timing.json"), "utf8"));
fs.writeFileSync(path.join(tmp, "deck.json"), JSON.stringify({ contract: 1, id, title: t.title, version: "2026-10-17", entry: "index.html", runtime: "timeline",
  segments: t.segments.map((s) => ({ group: s.grp, title: s.name, duration: s.len })), pages: t.segments.map((s, i) => ({ type: "anim", seg: i })) }, null, 2));
execFileSync(process.execPath, [extractor, tmp, "--out", out, "--version", "2026-10-17"], { stdio: "inherit" });
const d = JSON.parse(fs.readFileSync(path.join(out, "deck.json"), "utf8"));
let s = `# ${t.title}：各段實際出現在畫面上的文字（自動擷取）\n\n- 擷取方式：extract-deck-text（研習平台提供的擷取工具），每段每 0.5 秒取樣可見 SVG 文字＋字幕（去除打字機半截字與頁碼列）。\n- 對應動畫：${name}/index.html\n\n`;
d.pages.forEach((p, i) => { s += `## 第 ${i + 1} 段：${d.segments[p.seg].group}・${d.segments[p.seg].title}\n\n\`\`\`text\n${p.text}\n\`\`\`\n\n`; });
fs.writeFileSync(path.join(dir, "screen-text.md"), s);
for (const x of [tmp, out]) fs.rmSync(x, { recursive: true, force: true });
console.log(`寫入 ${path.relative(root, path.join(dir, "screen-text.md"))}`);
