---
name: educational-web-game-workflow
description: >-
  當使用者同時提供或要求教材／學習目標、Web 分支，以及從教學規格、資產、Web 實作到驗證的完整教育遊戲編排時使用；也適用於把已核准的 AI／程序化資產接入教育 Web 遊戲，但只能走可追溯的導入預覽。缺少教材、學習目標或 Web 分支時只輸出 intake 與缺件清單。不要用於只有教材轉遊戲規格（改用 material-to-quest-game）、已有遊戲只評估或加入 Three.js（改用 quest-threejs-adoption）、單一參考圖轉 Three.js 展示頁（改用 image-to-3d-scene）、只有角色／場景分鏡（改用 visual-art-storyboard），或 physical／both 分支。
---

# 教育 Web 教學遊戲工作流

把教材變成可學習、可操作、可降級、可驗證的 Web 教學遊戲。先固定學習目標與 DOM-only 任務，再決定 2D 或可關閉的 Three.js 視覺層；AI 生成的圖片、模型與程式碼都只視為候選產物。

回覆使用者時使用繁體中文。不要把規格完成、資產生成、導入或部署誤報為遊戲完成。

## Workflow 路由

1. 沒有教材、學習目標或 Web 分支：只輸出教師 intake、缺件清單與空白契約，狀態為 intake-only；不得猜年段、內容或成效。
2. 只有教材轉 Web／實體／雙分支遊戲規格：路由至 material-to-quest-game；不要啟動完整實作編排。
3. 已有 Web 遊戲，只要求評估或加入 Three.js：路由至 quest-threejs-adoption；不要重新產生教材遊戲規格。
4. 只有一張參考圖且要求可旋轉 Three.js 展示頁：路由至 image-to-3d-scene；不要把展示頁結果宣稱為遊戲資產或 GLB。
5. 只有角色、場景或連續演出規劃：需要時路由至 visual-art-storyboard；靜態資產不自動加入分鏡。
6. 從教材與學習目標開始，且要求規格、資產、Web 實作與驗證串接：由本 Workflow 編排，仍需呼叫上述專門 skill。
7. physical／both 分支不由本 Workflow 實作；回到 material-to-quest-game。
8. 要建立程式、導入資產或安裝套件：先完成本 Workflow 的契約、Task Packet 與 implementation preview，取得精確變更核准後才執行。

## Gate 0：教師 Intake

使用 assets/teacher-intake-template.md 收集：

- 教材與來源、學習目標、年段與先備能力。
- web 分支、教室場域、目標裝置、瀏覽器與網路。
- 評量方式、可及性需求、資產政策、可用工時與停止條件。

缺少會改變教學設計的資料時停在 intake-only。不要用 synthetic fixture 補足真實課程內容。

## Gate 1：學習與遊戲規格

呼叫 material-to-quest-game，確認以下輸出已存在：

- material concept map 與 learning mechanic matrix。
- game design spec、level map、question and feedback bank。
- asset spec、accessibility and safety review、playtest plan、teacher guide。
- 每一關的學習目標、DOM-only 任務、評量指標與停止條件。

每個題目必須有答案、理由、提示、錯誤回饋與補救路徑。若只能描述世界觀或美術，尚未達到 spec-ready。

## Gate 2：2D／3D 必要性

先分類 3D 是遊戲美術還是學習物件：

- 關卡入口、背景、寶箱、粒子、天氣與演出：只依動機、成本、裝置與可及性評估。
- 需要旋轉、剖面、拆解、遮蔽或空間關係的物件：只有 2D 不足且能用指標比較時才進 3D Pilot。

若文字、公式、平面圖、時間軸、表單或 2D 拖曳已足夠，選 DOM／SVG／Canvas。不要為了展示 AI 產物而加入 Three.js。

3D 分支交給 quest-threejs-adoption，第一個 Pilot 限定一題、一個教學物件、3–5 個熱點，以及必要的旋轉、縮放、剖面或拆解。

## Gate 3：資產管線

### 2D

建立資產清單、來源與授權；為關鍵資訊提供文字、形狀、圖示或替代文字，不只用顏色傳達。

**候選外部 2D 素材來源**

- AetherForge 免費素材：`https://www.aetherforgeai.com/zh-tw/free-assets`（2D sprite，粉彩／點陣風格；角色、生活道具、事件物品、消耗品與合成素材）。站方標示為免費、可商用；下載可能需登入。
- 採用規則：取用每件素材時，仍逐件記錄該素材的實際授權文字／條款、取得日期、來源 URL、版本與 SHA-256。本專案作品與 eduHarness 採 CC 授權，散布前確認素材授權與 CC 相容。頁面未標示 AI 生成狀態與檔案格式，於資產清單標註「格式／授權條款待逐件確認」。

### 程序化 3D

建立 scene art spec，使用程序化幾何、材質、光線與粒子。image-to-3d-scene 可協助參考圖構圖與展示頁研究，但其邊界仍是程序化展示，不是模型檔匯出。

### GLB／AI 3D

使用 references/asset-pipeline.md。流程固定為：

~~~text
參考圖或 AI 概念圖
→ 物件 brief 與輸入影像授權
→ 生成或重建候選模型
→ 比例、朝向、pivot、階層、材質、UV、動畫、碰撞與檔案量檢查
→ GLB + asset manifest + 預覽圖 + ledger
→ 真實瀏覽器載入、效能與 fallback 驗證
~~~

img2threejs 仍是 `experimental-blocked` candidate。沒有核准的 AI-to-GLB executor、pinned commit、隔離測試、P0 fidelity 修復、認證方式與授權證據時，只能保留 asset brief 或驗證使用者已提供的 GLB；不得自行下載未知遠端模型、生成 GLB 或進正式 Pilot。

每個上線資產都要能回溯 assetId、來源、授權／SPDX、輸入影像、版本、SHA-256、尺寸、單位、up axis、元件、動畫、貼圖、預算與 fallback。

## Gate 4：DOM-first 實作契約

DOM-only baseline 必須先能顯示題目、提示、輸入、回饋、進度並完成整個學習任務。Quest State 保存答案、得分、進度與完成狀態，是唯一真相。

Three.js Art Island 只能透過 SceneAdapter 接收唯讀 state snapshot，並送出版本化語意事件。不得把 Mesh、Object3D、動畫完成或 WebGL 狀態當作學習進度。

必要契約：

- scene-event-contract：contractVersion、eventId、sceneInstanceId、questRevision、correlationId、type、payload。
- 允許初始事件：scene.ready、hotspot.selected、object.collectRequested、animation.completed、scene.failed。
- animation.completed 只能表示視覺動畫完成，不得直接推進關卡。
- 每個 hotspot 都要有鍵盤、觸控、螢幕閱讀器與 DOM 等價操作。
- WebGL 關閉、quest3d=off、低效能、載入失敗與 context loss 都要回到可完成任務的路徑。

### DOM-first 硬閘門

每一個 UI 或互動需求都固定依下列順序驗收：

~~~text
規格鎖定
→ DOM／程式檢查
→ DOM_PASS
→ CUA 視覺與實際操作檢查
→ CUA_PASS
~~~

- DOM／程式檢查失敗時，立即停止該需求，不啟動 CUA，也不以截圖掩蓋失敗。
- DOM 檢查至少要能確認元素、事件、學習狀態、數值與必要尺寸；單元測試、瀏覽器 evaluate 與可重現的 selector 都可以作為證據。
- CUA（Computer Use Agent，電腦操作代理）只確認美工、構圖、動畫、文字可讀性、畫面異常與實際點擊／觸控感受，不能取代單元測試、DOM 檢查或狀態驗證。
- CUA 發現問題時，回到實作修正，再從 DOM 檢查重新開始；不能只補截圖。
- 未同時取得 `DOM_PASS` 與 `CUA_PASS`，不得把該需求或整體功能標為完成。

### 固定單頁與內部 overflow 契約

若遊戲規格選擇固定單頁 Web 介面，實作前先鎖定 viewport 與容器契約：

- `body` 與整體頁面不得產生上下捲軸；頁面本身使用 `overflow: hidden` 或等效的明確限制。
- `app-shell`／`screen` 必須跟隨 viewport 高度，並允許 grid／flex 子項目縮小；動態內容所在的 grid 子項目要有 `min-height: 0`。
- 可能超出的內容面板預先使用 `overflow-y: auto` 或 `overflow-y: scroll`、`overflow-x: hidden`；不要用 `overflow: hidden` 把尚未驗證的內容裁掉。
- 內部捲動面板要能用滑鼠滾輪與觸控操作；不依賴某一個解析度的固定高度例外來遮住問題。

DOM 驗收至少包含下列檢查；若正常內容未超出面板，另用「故意放入超長內容」的最小 fixture 驗證內部 bar：

```js
const pageScroll = {
  htmlFitsViewport: document.documentElement.scrollHeight === document.documentElement.clientHeight,
  atTop: window.scrollY === 0,
  bodyOverflow: getComputedStyle(document.body).overflow,
  panelOverflowY: getComputedStyle(targetPanel).overflowY,
  panelCanScroll: targetPanel.scrollHeight > targetPanel.clientHeight,
};
```

必要結果為：`htmlFitsViewport === true`、`atTop === true`、body 不可頁面捲動；在超長內容案例中，目標面板必須滿足 `scrollHeight > clientHeight`，且 `panelOverflowY` 為 `auto` 或 `scroll`。

### CUA 啟動時機

CUA 不等到所有功能完成才啟動，而是在三個檢查點進入：

1. **骨架檢查**：首頁、主要操作頁與裝備／設定頁第一次可操作後，先取得 `DOM_PASS`，再做 CUA 基準截圖。
2. **功能檢查**：每完成一個視覺／互動功能，先驗證 DOM 事件與狀態，再以 CUA 操作實際流程。
3. **回歸檢查**：功能完成後，以固定 viewport 與短 viewport 重跑 DOM → CUA；必要時加入手機尺寸。

CUA 至少確認：重要角色、敵人、生命／進度 bar 與按鈕實際可見；攻擊或回饋動畫真的出現在畫面；內容面板沒有裁切或遮住控制列；文字與字卡可讀、可點擊、可觸控；沒有意外的 body 捲軸。低動態模式下也要驗證靜態回饋仍可見。

### 規格－DOM－CUA 驗收矩陣

每個 UI／互動需求都要填寫同一份矩陣，不能只在測試報告或截圖旁口頭說明：

| 欄位 | 內容 |
|---|---|
| Requirement ID | 對應使用者需求或規格條文 |
| DOM／程式預期 | 狀態、事件、元素、尺寸或公式 |
| DOM 驗證 | 可重現的 selector、evaluate、單元測試或命令 |
| CUA 操作 | 要點擊／觸控的實際步驟 |
| CUA 視覺預期 | 截圖或操作畫面必須看到的結果 |
| Viewport | 例如 `1280×720`、`1323×585`、手機尺寸 |
| Evidence | 測試輸出、DOM 結果、截圖或錄影位置 |
| Status | `PENDING`、`DOM_PASS`、`CUA_PASS`、`BLOCKED` |

狀態只能依序前進：

~~~text
PENDING → DOM_PASS → CUA_PASS
~~~

`CUA_PASS` 不得跳過 `DOM_PASS`；任何停止條件、缺件或環境阻礙都標為 `BLOCKED`，修正後回到 `PENDING`，不可把 `BLOCKED` 直接改成通過。

可直接套用到部件守城類版面的最小案例：

| Requirement ID | DOM／程式預期 | CUA 視覺預期 |
|---|---|---|
| `LAYOUT-001` | body 高度等於 viewport，超長 Step 面板 `scrollHeight > clientHeight` 且 `overflow-y` 為 `auto`／`scroll` | 整頁沒有上下 bar，Step 02／Step 03 在自己的框內有 bar，控制列仍可見 |
| `BATTLE-001` | 敵人與生命 bar 存在；攻擊事件更新可見效果層 | 敵人、城牆、bar 與普通／特殊攻擊效果實際出現在畫面 |
| `WORD-001` | 字卡數量符合規格，點擊事件更新答案狀態，送出後回饋可讀 | 字卡可點擊／觸控、順序可辨識，結果面板沒有被裁切 |

### 遊戲平衡參數集中管理

遊戲平衡數值必須集中於單一設定模組，遊戲公式只讀取該模組，不把倍率與關卡成長值散落在事件處理器或畫面元件中。例如：

```js
export const GAME_BALANCE = {
  enemyMovementMultiplier: 0.25,
  wallHpPerLevel: 100,
  killTargetPerLevel: 50,
  extraQuestionTiles: 2,
};
```

集中管理範圍至少涵蓋敵人移動倍率與攻擊頻率、城牆生命與勝利擊殺數、關卡成長係數、字卡干擾數量、能力持續時間／傷害倍率／燃燒週期、裝備成長係數與提示懲罰倍率。每次調參都要留下舊值、新值、預期遊戲影響、對應單元測試、DOM／CUA 實測證據與 rollback 值。

調參紀錄可用下列兩個範例起始：

| 參數 | 舊值 → 新值 | 預期影響 | 測試與 DOM／CUA 證據 | rollback |
|---|---|---|---|---|
| `enemyMovementMultiplier` | `0.5 → 0.25` | 敵人前進速度降低，攻擊頻率與傷害公式不因該參數改變 | 測試比較速度；DOM 確認敵人存在與位置更新；CUA 確認仍看得到敵人持續前進 | `0.5` |
| `extraQuestionTiles` | `3 → 2` | 每題少一張干擾字卡，答案仍完整保留且順序重新洗牌 | 測試驗證字卡數量與答案字元；DOM 確認字卡可操作；CUA 確認文字可讀且不溢位 | `3` |

## Gate 5：Harness 導入預覽

使用 references/import-preview-contract.md。Harness 的自動化範圍是產生可審核的導入預覽，不是跳過授權或核准：

1. 產生符合 references/schemas/import-preview.schema.json 的 import-preview.json，列出 `previewId`、來源／目的地、舊／新 hash、依賴、覆寫行為、預計修改、rollback action 與 drift recheck。
2. 驗證 allowed_paths；路徑正規化後不得逃出目前工作區。
3. 涉及 setup、install 或 update 時，先通過安裝防重預檢。
4. 使用者核准精確預覽後，才導入 manifest、loader、adapter、placeholder 或測試。
5. 保留 last-known-good manifest；失敗時回退 placeholder 或 DOM-only。Registry、validator、fixture、metadata 或投影變更要有逐檔前後 hash 與可執行回退步驟。

不要讀取、輸出、複製或提交 secrets、tokens、cookies、private keys 或學生個資。未知遠端模型、任意 URL loader、未驗證 CDN 與未授權輸入影像不得直接接入。

## Gate 6：驗證與教師試點

驗證至少涵蓋：

- 學習：DOM-only 與 3D 版本的完成率、時間、錯誤類型、迷思概念與教師觀察。
- 功能：題目、狀態、重新整理、載入失敗、上一關／下一關與 context loss。
- 可及性：鍵盤、觸控、焦點、螢幕閱讀器、文字對比、reduced motion、動暈、三閃與靜音。
- 視覺：構圖、比例、光線、色盤、熱點、responsive viewport；若使用參考圖，至少兩輪瀏覽器截圖驗證。
- 效能：命名裝置與網路上的冷啟動 P50／P95、frame-time、記憶體、draw calls、10 分鐘操作與降級。
- 安全與授權：輸入 schema、輸出消毒、CSP、路徑白名單、資產 ledger、hash 與依賴版本。

### DOM → CUA 驗證順序與停止條件

每一個功能固定依下列順序執行：

1. 執行邏輯／單元測試。
2. 啟動本機頁面並鎖定要驗證的 viewport。
3. 執行 DOM／程式檢查，全部通過後才標記 `DOM_PASS`。
4. 只有 `DOM_PASS` 成立時才執行 CUA；完成視覺與操作檢查後才標記 `CUA_PASS`。
5. 將測試輸出、DOM 結果與 CUA 證據寫入驗收矩陣。
6. 由 fresh verifier 重新檢查；fresh evidence 要說明實際檢查的檔案、畫面或命令，不能只複述 executor 結論。

以下任一情況立即停止，不得往下宣稱完成：

- body 出現頁面捲軸，或固定單頁的 `scrollHeight` 不等於 viewport 高度。
- 內容面板超出卻沒有內部 bar，或控制列被裁切、遮住。
- DOM 元素、事件、學習狀態、數值或公式不符合規格。
- CUA 看不到應有元素、文字不可讀、畫面被遮住，或實際動畫只有事件紀錄而沒有視覺效果。
- 調參後沒有對應測試、DOM／CUA 證據或 rollback 值。
- verifier 沒有提供 fresh evidence，或 requested model 與 actual model 的執行期證據混用。

使用 assets/pilot-acceptance-checklist-template.md 與 assets/pilot-budget-and-kill-switch-template.md。只有 fresh verifier 以直接證據確認後，才能使用 pilot-evidence-ready。

## 輸出狀態

- intake-only：缺少關鍵輸入，只輸出 intake 與缺件。
- spec-ready：學習、遊戲、資產與 3D 判斷完成，尚未建立程式。
- implementation-preview：Task Packet、依賴預檢與精確變更預覽完成，等待核准。
- experimental-blocked：AI／GLB executor、認證、pinned runtime 或隔離測試未核准；只能保留 brief、使用者提供資產或 fallback。
- pilot-evidence-ready：真實裝置、瀏覽器、可及性、效能與教學比較證據完成。
- stopped：觸發成本、品質、學習、安全或授權停止條件，回退 DOM-only 或修訂規格。

## 明確不做

- 不把 Codex 宣稱為遊戲引擎；實際 runtime 仍是專案 Web 技術與瀏覽器。
- 不把所有教育遊戲改成 3D。
- 不把單張圖片重建宣稱為精確 3D 掃描或 photogrammetry。
- 不在第一個 Pilot 製作完整 3D 世界、自由探索、物理、敵人 AI、多人連線或編輯器。
- 不把資產生成、導入、部署或教師成效誤報為完成。
- 不把 synthetic fixture 當成真實課程、瀏覽器 WebGL、效能或教學成效證據。

## 參考與模板

- 詳細輸入、狀態與 3D 判斷：references/workflow-contract.md
- AI／GLB 資產與品質 Gate：references/asset-pipeline.md
- Harness 導入與 rollback：references/import-preview-contract.md
- 版本化契約：references/schemas/game-spec.schema.json、asset-manifest.schema.json、scene-event.schema.json、import-preview.schema.json、fixture-case.schema.json、fixture-suite.schema.json
- 可重用模板：assets/teacher-intake-template.md、assets/game-design-spec-template.md、assets/asset-manifest-template.json、assets/asset-ledger-template.md、assets/scene-event-contract-template.md、assets/performance-budget-template.md、assets/pilot-acceptance-checklist-template.md、assets/pilot-budget-and-kill-switch-template.md、assets/import-preview-template.json
- Synthetic fixture：assets/fixtures/fixture-cases.json 與同目錄的 Markdown 案例
