// 組裝動畫：Skill 範本＋場景檔（META 與 s1…sN 場景函式）＋timing.json（段落、秒數、字幕的唯一來源）。
// 用法：node <本 Skill>/scripts/assemble.mjs <動畫資料夾> <場景檔.js> [--no-common]
// 場景檔只寫 META 與 s1…sN；段落、秒數、字幕只寫在動畫資料夾的 timing.json（total_seconds 必須等於各段總和）。
import fs from "node:fs";
import path from "node:path";
const skill = path.resolve(import.meta.dirname, "..");
const root = process.cwd();
const [dir, scenesFile] = process.argv.slice(2).filter((a) => !a.startsWith("--")).map((p) => path.resolve(p));
const tpl = fs.readFileSync(path.join(skill, "assets/template.html"), "utf8");
const timing = JSON.parse(fs.readFileSync(path.join(dir, "timing.json"), "utf8"));
const commonFile = path.join(skill, "assets/common-scenes.js");
const scenes = (process.argv.includes("--no-common") ? "" : fs.readFileSync(commonFile, "utf8") + "\n") + fs.readFileSync(scenesFile, "utf8");
const total = timing.segments.reduce((a, s) => a + s.len, 0);
if (total !== timing.total_seconds) throw new Error(`timing 總長 ${total} ≠ total_seconds ${timing.total_seconds}`);
timing.segments.forEach((s, i) => { if (!new RegExp(`function s${i + 1}\\(`).test(scenes)) throw new Error(`場景檔缺 s${i + 1}()`); });
const segs = "const SEGS = [\n" + timing.segments.map((s, i) =>
  `  { len: ${s.len}, grp: ${JSON.stringify(s.grp)}, name: ${JSON.stringify(s.name)}, scene: s${i + 1},\n    cap: ${JSON.stringify(s.cap)} },`).join("\n") + "\n];\n";
const a = tpl.indexOf("// ===================== 設定區"), b = tpl.indexOf("// ===================== 工具（通常不用改）");
let out = tpl.slice(0, a) + "// ===================== 設定區（段落與字幕由 timing.json 注入）=====================\n" + scenes + "\n" + segs + "\n" + tpl.slice(b);
out = out.replace("<title>【標題】</title>", `<title>${timing.title}</title>`);
fs.writeFileSync(path.join(dir, "index.html"), out);
console.log(`組裝完成：${path.relative(root, path.join(dir, "index.html"))}（${timing.segments.length} 段、${total} 秒）`);
