---
name: repo-to-teaching-animation
description: repo 轉教學動畫網頁。把一個 repo（或其中幾篇講義、README、設計文件）做成單檔 HTML 的教學解說動畫：只用已查證事實寫 brief、分段計時、使用者核准分鏡後才寫碼，畫面只由時間 t 決定（window.DURATION＋window.SEGS＋async window.seek(t)），每關截圖自審，可選擇轉成研習平台內建簡報。觸發：「repo 轉教學動畫」「把 <repo／講義> 做成教學動畫網頁」「用 AI 時代教育動畫的方法做 <主題>」「幫這份文件做解說動畫」。反觸發：皮影戲風格（shadow-movie）；讓學生調變因的互動模擬（causal-sandbox-inquiry）；只要一張靜態圖解（explain-visual）；要 MP4 成片或配音（本 Skill 只做網頁版）；闖關遊戲（material-to-quest-game）。
---

# repo 轉教學動畫網頁

## 設定

本 Skill 不寫死帳號、網址與埠號。設定來源順序：① 工作區根目錄 `private/config/sites.local.json`（本機實際值，不上傳）→ ② `config/sites.example.json`（公開範本，只有佔位值）。值含 `<…>` 或 `example` 字樣即視為**缺值**；缺值時**停下來問使用者**，不猜。

| 設定鍵 | 用途 | 預設值 |
|---|---|---|
| `tools.github.default_owner` | 取材 repo 時 `gh api` 預設的 owner | 無（缺值＝請使用者給完整 `owner/repo`） |
| `local.chrome_debug_port` | 截圖自審時 Chrome 遠端除錯埠（`check-anim`、`fs-check` 的 `--port`） | 9222（Chrome 通用預設，僅缺值時用） |
| `sites.<site_id>.project_dir` | 選配（第 6 節）：研習平台專案資料夾，相對工作區根目錄 | 無（缺值＝不做第 6 節） |

目的：把文件裡的機制講成「一次一個概念、可停在任一段」的網頁動畫，內容每句都有出處，畫面可重現、可嵌入研習平台。

方法來源：「網頁電影」架構（畫面只由時間決定、分段計時、截圖自審），細節以本檔為準；提示詞與風格參考 `brain/knowledge/animation-prompt-references.md`。

## 0. 邊界

- **取材 repo 一律唯讀**：只用 `gh api …/contents`（owner 未指定時取設定鍵 `tools.github.default_owner`）、`git clone` 到 `workspace/` 或讀本機檔；不 push、不開 PR、不改設定。要放回原 repo 另行取得使用者同意。
- 只做網頁版：不渲染 MP4、不配音、不安裝套件（Playwright／ffmpeg 不在本 Skill 範圍）。
- 事實只來自 brief 的「已查證事實」表；不從參考片或模型記憶補內容。原文沒寫的數字、人物、案例一律不放。
- 不放秘密、帳號、本機路徑；外部連結只放原文已有的公開網址。
- 輸出位置（SSOT）：`projects/<主題>-animations/<動畫代號>/`；過程暫存：`workspace/<主題>-animations/`。動手前在計畫書的 allowed paths 寫死。

## 1. 流程（每關都要留下證據）

```text
[A1] 取材：列出來源檔（路徑＋commit／分支＋SHA-256）
  ▼
[A2] brief.md：觀眾、學完能說出、已查證事實表（每條附 檔名#段落）、禁用清單、風格
  ▼
[A3] timing.json：分段（grp、name、len 秒、cap 字幕）；總長 60–150 秒、每段 8–16 秒
  ▼
[W]  使用者核准分鏡：節拍表＋4 張關鍵影格描述（不核准不寫碼）
  ▼
[A4] 場景檔 XX-scenes.js（META＋s1…sN）→ scripts/assemble.mjs 組裝成 index.html
  ▼
[A5] 截圖自審（G2 各段中點 contact sheet → G3 段落轉場 → G4 全段掃描）
  ▼
[A6] 交付：事實對照表＋截圖＋已知限制；依計畫書審查級別決定是否送外審
  ▼
[A7]（選配）轉成研習平台內建簡報（第 6 節）
```

## 2. brief.md 格式

```markdown
# <動畫標題>
- 觀眾：<例：國中小教師、無程式背景>
- 學完能說出：<1～3 句>
- 來源：<repo>@<分支或 commit>：<檔案路徑>（SHA-256 前 12 碼）
## 已查證事實（動畫只能用這些）
| # | 事實（改寫成白話也要保留原意） | 出處 |
|---|---|---|
| F1 | … | lessons/01-xxx.md §2 |
## 不放進動畫的內容與理由
## 禁用清單：置中文字＋漸層淡入、無出處數字、炫技動效、小於 22px 的字
## 風格：沿用黑板舞台（--board #23392f、--chalk #efe9d8、--yellow #f2c14e）或使用者指定
```

- 每段字幕與畫面文字都要能對到至少一個 F 編號；交付時附「段落 → F 編號」對照表。
- 原文有比喻就用原文比喻；自創比喻要在 brief 標「比喻，非原文」。

## 3. index.html 契約（違反就不算完成）

1. 單一 HTML；素材只用同資料夾 `assets/` 與程序化 SVG／Canvas；字型可用 Google Fonts（研習平台簡報主機 CSP 允許），其他外部連線一律不用。
2. `window.DURATION`（秒）、`window.SEGS`（每段 `{len, grp, name, cap}`，載入時算出 `a`、`b`）、`async window.seek(t)`：畫面**只由 t 決定**。
3. 禁止：`Date.now`、`performance.now` 驅動畫面、`requestAnimationFrame` 迴圈當時間來源（播放器外殼可用 rAF 推進 t，但畫面仍只呼叫 `seek(t)`）、計時器、CSS transition／animation、沒設種子的 `Math.random`。
4. `window.ready`：字型與圖片就緒的 Promise；就緒前不擷取、不送 ready。
5. `?embed=1`：隱藏標題、控制列、章節、延伸連結，只留 16:9 舞台與字幕，尺寸全用 vh。
6. postMessage（研習平台嵌入契約）：被嵌入時就緒後送 `{ptt:1,type:'ready',duration}`；只接受 `event.source===window.parent` 且 `{ptt:1,type:'seek',t:有限數字}`；被嵌入（`?embed=1`）時不讀不寫 cookie／localStorage。只有獨立播放（非 embed）才可讀寫 UI 狀態（目前只有兩項：進度條收合，鍵 `anim.ui.seek`；標註工具收合，鍵 `anim.ui.ink`），且一律包 try／catch，不可用時只留在記憶體、不報錯。
7. 舞台 `viewBox="0 0 1600 900"`；文字留 60px 安全邊界；字幕放 `.caption`，可含 `<b>` 強調，其他 HTML 不用。
8. 可及性：舞台 `role="img"`＋`aria-label`；字幕 `aria-live="polite"`；鍵盤空白鍵播放、左右鍵換段、F 全螢幕；`prefers-reduced-motion` 時減少位移。
9. 頁尾 `.note` 寫出處（repo 與檔名）與「畫面只由時間決定」。
10. 標註工具（v0.4.0 起）：獨立播放時控制列有「標註工具 ▸／▾」，可用畫筆、文字、5 色色票、收回上一筆、清除本段標註；**標註以段落為單位，只存在記憶體**——不寫 localStorage（只記工具列收合狀態）、不送網路、重新整理即消失；`?embed=1` 不建立標註層與工具；標註層不改變舞台內容（`#stage` 的 SVG 與 `seek` 回傳值不變）。

範本：`assets/template.html`（本 Skill 資料夾內）已實作 2～8，版面見下方「播放器版面公版」。

### 播放器版面公版（v0.3.0 起，之後的動畫一律用此版面；v0.4.0 加標註工具）

沿用研習平台研習頁的三項規則；改範本以外的地方不得另寫一套：

1. **播放區佔滿一個視窗高**：`.player`（標題列＋舞台＋字幕＋控制列）高度 `100dvh`（含 `100vh` 後備）；章節按鈕、延伸閱讀、`.note` 出處放在播放區下方，往下捲才看到。字幕 `.caption` 至少預留兩行（`min-height:3em`），段落切換時舞台不跳動。
2. **舞台吃剩餘空間並維持 16:9**：`.stage-area` 設 `container-type:size`，`.board`（含木框）寬度用容器查詢單位 `min(100cqw, (100cqh - 2*var(--bw))*16/9 + 2*var(--bw))`，木框寬只透過 `--bw` 變數計入，確保 SVG 本身仍是 16:9。**不得再用固定像素去扣高度**（例如 `calc((100dvh - 250px)…)`）。全螢幕（`#theater:fullscreen`）沿用同一套規則並保留兩行字幕。
3. **控制列與進度條**：上一段／播放／下一段／全螢幕永遠顯示；「進度條 ▸／▾」按鈕（`aria-expanded`、`aria-controls="seekrow"`）收合一列進度條列：`#scrub` 全長時間軸＋每段分界細線刻度（黃色 6px 粗軌道、16px 圓拇指、webkit／moz 都寫）＋右側「x.x / 總長」。預設收起，狀態存 localStorage 鍵 `anim.ui.seek`（只有非 embed 才讀寫，try／catch）；收起時舞台自動變大。

4. **標註工具（沿用研習頁的手寫筆跡與文字輸入）**：範本內的標註模組（`.annoLayer` 掛在 `.board` 內、與舞台同尺寸同縮放，用 ResizeObserver 追蹤）；「標註工具 ▸／▾」（`#toggleInk`，`aria-expanded`、`aria-controls="annoTools"`）收合一列工具列：畫筆、文字、5 色色票（`#efe9d8 #f2c14e #e8875b #7fb6d9 #8fd18a`）、收回上一筆、清除本段標註。預設收起，狀態存 `anim.ui.ink`（非 embed、try／catch）；收起時畫筆關閉，舞台依規則放大。標註層平常 `pointer-events:none`，只有畫筆／文字啟用時才攔截，不影響點舞台播放；播放中畫筆維持播放不自動暫停；輸入文字時所有按鍵不往上送（空白鍵、方向鍵、F 不觸發播放器快捷鍵），Enter 放上、Esc 取消。標註以段落為單位只存在記憶體；全螢幕不放工具列，筆跡仍顯示。

`?embed=1` 不套用以上版面（維持只留舞台與字幕、尺寸全用 vh），也不建立標註層。新增的播放器函式與變數一律以 `player` 開頭，避免與場景函式重名。

### 工具（本 Skill 資料夾內；在 repo 根目錄執行）

| 檔案 | 用途 |
|---|---|
| `assets/template.html` | 播放器外殼與契約；播放器函式已改名 playerShow／playerPlay／playerPause／playerTick，場景勿重名 |
| `assets/common-scenes.js` | 共用圖形：`C` 色票、`arrow`、`curve`、`hframe`、`card`、`ccard`、`chip`、`tick`、`cross`、`dot`、`underline`、`stagger` |
| `scripts/assemble.mjs` | `node <Skill>/scripts/assemble.mjs <動畫資料夾> <場景檔.js>`：範本＋共用圖形＋場景檔，段落／秒數／字幕從 `timing.json` 注入（字幕唯一來源）；缺 `sN()` 或總秒數不符就停止 |
| `scripts/check-anim.mjs` | 契約、冪等、溢出、重疊、embed、播放鍵、主控台例外；輸出各段中點與段尾截圖 |
| `scripts/fs-check.mjs` | 6 種比例全螢幕，量字幕實際文字高度 |
| `scripts/screen-text.mjs` | `node <Skill>/scripts/screen-text.mjs <動畫資料夾> <deck id>`：擷取各段實際畫面文字＋字幕寫成 `screen-text.md`（外審時與講義對照；需要研習平台的 extract-deck-text 擷取工具，以 `--extractor` 或環境變數 `DECK_TEXT_EXTRACTOR` 指定，沒有就停下） |

`timing.json` 格式：`{ "title", "total_seconds", "segments": [{ "grp", "name", "len", "facts": ["F1"], "cap" }] }`；場景檔裡不要再寫 `SEGS`。

### 製作經驗（每次都要看）

- 截圖只看中點會漏掉後半出場的元素；**一定要看段尾截圖**。
- 自動檢查抓不到的常見問題：線條或箭頭穿過文字、卡片內文字超出框、亮點或叉叉蓋住字、移動中的元素與旁邊重疊（改成淡出淡入，不要途中交疊）。
- 箭頭中間的說明字太寬時，拆成上下兩行，不要縮到 22px 以下。
- 寫完逐句對照 brief：最容易混進「別篇講義的內容」或「自己加的解讀」，發現就刪。
- 外審送「brief＋timing＋screen-text＋場景檔＋唯讀原文」即可，共用範本與播放器不必送，兩支一包約 50–60 KB。

## 4. 截圖自審（A5）

- 用本機 Chrome 無頭模式（`--headless=new --remote-debugging-port=<local.chrome_debug_port>`），開 `file://…/index.html`，對每段中點、起點＋0.3 秒、終點－0.3 秒呼叫 `seek(t)` 截圖，拼成 contact sheet 存 `contact/`。只關自己啟動的 Chrome（taskkill /T /PID）。
- 檢查：文字沒有溢出 1600×900 或互相重疊；對比足夠；沒有黑格（就緒前截圖）；同一個 t 截兩次畫面相同（冪等）；`?embed=1` 版只剩舞台與字幕。
- 自審工具（見上方工具表）：`node <本 Skill 資料夾>/scripts/check-anim.mjs <index.html> --out <截圖資料夾> [--port <local.chrome_debug_port>]`，自動檢查契約、冪等、文字溢出與重疊、embed 版與主控台例外，並輸出各段中點截圖；FAIL 項目全部修到 0 才交付。
- 全螢幕檢查：`node <本 Skill 資料夾>/scripts/fs-check.mjs <index.html> [--shot <截圖.png>]`，在 6 種螢幕比例進入全螢幕，逐段量測字幕實際文字高度（scrollHeight，不是被壓縮後的框）是否超出畫面；字幕長到換兩行的段落最容易出事。
- 可參考的取樣腳本：研習平台提供的 `extract-deck-text.mjs`（逐段 seek、收集可見文字），也可直接用它檢查每段畫面文字是否都在 brief 事實表內。

## 5. 交付回報（繁體中文）

1. 動畫網址或檔案路徑（網址用角括號包住，後面不接全形字）。
2. 分段表：段名、秒數、對應 F 編號。
3. contact sheet 路徑與自審結果；未驗證項目（例如手機實機、Safari）。
4. 依計畫書審查級別：🟢 不送審；🟡 交付前送一次 AGY（非 Claude 模型）做「畫面與字幕 vs 原文」事實一致性審查；🔴 依計畫列出的關鍵節點。

## 6. 選配：轉成研習平台內建簡報

站台資訊取自設定鍵 `sites.<site_id>.project_dir`（平台專案資料夾，相對工作區根目錄）；缺值就停下問使用者要用哪個站台。

1. 寫 `deck.json`（格式依該平台專案的簡報契約文件，通常在其 `docs/` 內）：`runtime: "timeline"`、`entry: "index.html"`、`segments` 與 SEGS 一一對應（group＝grp、title＝name、duration＝len）、每段一個 `{type:"anim", seg:i}` 頁，需要討論頁再加 `disc` 頁。
2. 跑 `node <project_dir>/scripts/extract-deck-text.mjs <動畫資料夾> --out <新資料夾> --version <版本>`，把畫面文字＋字幕補進每頁 `text`（給「問 AI」用）。
3. 新資料夾放進 `<project_dir>/builtin-decks/<id>/`，再呼叫 Skill `cloudflare-workers-redeploy`（部署屬對外變更，要使用者同意）。

## 7. 常見症狀

| 症狀 | 原因 | 修法 |
|---|---|---|
| 截圖黑格或字型跳動 | 未等 `window.ready` | 擷取前 `await window.ready` |
| 同一個 t 畫面不同 | 用了真實時間或亂數 | 只用 t；亂數用固定種子 |
| 文字被切 | 沒留安全邊界、字太長 | 量測、斷行或縮短（不改原意） |
| 嵌入後位置偏移 | embed 版用 px | embed 版尺寸全用 vh |
| AI 問答答不出畫面上的字 | 畫面文字只在 SVG | 跑第 6 節第 2 步 |
| 成品很普通 | 沒參考、沒自看影格 | 先找 1～2 支參考片看節奏，補 contact sheet 自審 |
