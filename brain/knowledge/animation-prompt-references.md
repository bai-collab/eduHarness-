# 教材動畫提示詞參考庫

> 建立：2026-10-09。來源評估：2026-10 外部工具評估第 7、8 項。
> 本機動畫架構 SSOT：某教學動畫專案的網頁電影架構文件（`brief.md` → `timing.json` → `scene.html` 的 `DURATION`＋`seek(t)` → Playwright 逐格 → ffmpeg）。

## 參考站

| 站 | 用哪幾類 | 費用 | 備註 |
|---|---|---|---|
| https://skillry.dev/ai-videos/opus-5-5 | **Explainers（67）**；3D 只在需要空間概念時看 | 提示詞免費；skill 月費 9.99／年費 79／終身 169 美元，**不可退款** | 每支附原作者提示詞與站方重做版；技術多為 Remotion、HyperFrames、SVG、GSAP、Three.js |
| https://prompt-motion.com/ | **Diagrams（31）、Charts（33）**、Code（21） | 免費瀏覽 | 策展人 @p4nthera_；條目分 Prompt／Skill；技術標示有 Remotion、Manim、Three.js、HTML/SVG |

## 使用規則（How to apply）

1. 只拿來參考**風格、節奏與提示詞結構**；事實一律以 `brief.md` 已查證事實為準，不從參考片抄內容。
2. 渲染器維持本機 `seek(t)`＋Playwright，不因參考片使用 Remotion 就改。若日後改用 Remotion，學校使用前先查授權（未查證）。
3. 提示詞屬原作者：用於教材或公開分享時註明來源連結。
4. 付費 skill 暫不購買；先用免費提示詞做出 2～3 支教材短片，驗證有需要再議。
5. Motion graphics／Kinetic type 類偏炫技，教材少用；教材動畫以「一次一個概念、節奏可停頓」為準。

## 已知限制

- 兩站都沒有公開操作教學、授權與 API 說明（2026-10-09 查詢）。
- 「技術」欄是從條目標籤／網址推得，不是官方確認的技術堆疊。
