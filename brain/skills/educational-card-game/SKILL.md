---
name: educational-card-game
description: >-
  當教師要把教材與學習目標設計成可玩的教育 Web 卡牌遊戲，並需要教師引導、卡牌規則、可及性、GitHub 靜態前端、GAS／Google Sheet 保存與教師查分時使用；缺少教材、學習目標、年段或 Web 分支時只輸出 intake，不猜測。不要用於只有實體卡牌、只有一般教材轉遊戲規格，或已有遊戲的單純視覺改造。
---

# 教育卡牌遊戲設計與製作

## 設定

本 Skill 的規格、範本與驗證腳本**不含**任何 GAS 網址或 Sheet ID（一律用 `<...>` 佔位）。只有在使用者明確要求「部署／接線」時才讀設定。設定來源順序：① 工作區根目錄 `private/config/sites.local.json`（本機實際值，不上傳）→ ② `config/sites.example.json`（公開範本，只有佔位值）。值含 `<…>` 或 `example` 字樣即視為**缺值**；缺值時**停下來問使用者**，不猜。

| 設定鍵 | 用途 | 預設值 |
|---|---|---|
| `services.gas.endpoint_url` | 部署後的 GAS Web App 網址（只在部署時填入 GAS 設定，不寫進 repo 檔案、fixture 或 Log） | 無 |
| `services.sheet.id` | Google Sheet ID（只作 GAS server-side allowlist 的對應來源，不可由前端傳入） | 無 |
| `sites.<site_id>.main_url` | 選配：GitHub Pages 等靜態前端的網址 | 無 |

PIN、token、OAuth 秘密、KMS 金鑰**永遠不放設定檔**。

這個 Skill 把「先確認教學目的，再設計卡牌，最後產出可驗證的 Web 遊戲契約」固定成可重用流程。回覆教師時使用繁體中文，先說目前狀態與缺件，不把規格、資產、GAS、部署或教學成效誤報為完成。

## 啟動與邊界

啟動條件至少包含：教材或可核准來源、學習目標、學段／年齡、`web` 分支，以及預期的課堂場域。缺少會改變設計的資料時，只輸出 `intake-only`、問題清單與空白契約。

以下請求應轉交或停在相鄰 Skill：

- 只有教材轉成遊戲規格：使用 `material-to-quest-game`。
- 需要從教材、資產、Web 實作一路串到瀏覽器與試點驗證：由 `educational-web-game-workflow` 編排。
- 需要製作遊戲畫面：先使用 `web-layout-topology-analysis`；`layout_plan.status=ready` 前不得寫 HTML／CSS／JavaScript。
- 只有實體卡牌、physical／both 分支：回到 `material-to-quest-game`，不要假設本 Skill 會產生印刷品。
- 只有角色、場景或連續演出：必要時再詢問是否載入美工與分鏡；單張卡面與 UI 不自動啟動分鏡。

## 固定流程

### Gate 0：教師 Intake

使用 `assets/teacher-intake-template.md`，收集教材來源、年段、先備能力、2–5 個可觀察學習目標、常見迷思、課堂時間、玩家人數、合作／競賽方式、裝置／網路、可及性、評量、資料保存目的與資產限制。不要用猜測補足教材或學習目標。

### Gate 1：學習—機制矩陣

先建立 `learning-mechanic-matrix.md`：

`學習目標 → 可觀察行為 → 卡牌操作 → 正確證據 → 錯誤回饋 → 補救路徑 → 可保存事件`

每個目標至少要有一個可觀察行為與正確證據；只有世界觀、卡面或分數，尚未達 `spec-ready`。

### Gate 2：卡牌資料與規則

使用 `references/card-data.schema.json` 與 `assets/educational-card-spec-template.md`。每張卡要有穩定 ID、目標／概念、題幹、答案規則、理由、提示、迷思標籤、正誤回饋、補救、來源、可及性與版本。

規則引擎至少維持以下不變式：

- 一張卡同一時間只能位於一個 Zone。
- 合法性、目標、費用與答案先驗證，再用 remove-then-add 一次改變狀態；提交後檢查沒有重複卡或遺失卡。
- effect queue 明確採 FIFO 或 LIFO；失效目標有固定的 fizzle、取消或重新選目標結果。
- 洗牌固定 PRNG／shuffle 版本與 seed；replay fixture 能重現牌序、效果順序與結果。
- 手牌上限、牌庫耗盡／疲勞、資源曲線、提示代價與勝負條件集中管理，調整要有測試與 rollback 值。
- `GameState`、`LearningState`、`VisualSnapshot` 分離；動畫完成不能直接代表學習完成。

### Gate 3：美術、版面與可玩性

先選 DOM／SVG、Canvas 2D 或 hybrid，不為了外觀預設 3D。需要畫面時，先建立 viewport、layout blocks、component rects、icon specs、hit rect、z-order、overflow 與 collision channel；核心遊戲區與必要操作優先於裝飾。

DOM-only baseline 必須能完成完整學習任務；Canvas／動畫只是呈現層。每個拖放操作要有點擊、鍵盤或語意替代。資產要有來源、授權、版本、hash 與 fallback。

### Gate 4：Web、同步與資料權限

讀取以下參考文件：

- `references/gas-endpoint-contract.md`
- `references/gas-threat-model.md`
- `references/credential-and-role-model.md`
- `references/sheet-schema.md`
- `references/storage-performance-model.md`

安全邊界固定如下：

- GitHub 前端的 GAS URL 是公開路由，不是秘密；不得把 OAuth token、服務帳戶金鑰、Sheet ID 或固定寫入 secret 放進 bundle。
- 校方先以受保護介面匯入 roster；公開學生端只有 login，不提供 register，不可搶註或覆寫 studentKey。
- 國小短 PIN 是低強度課堂登入碼，不能冒充高可信正式身份；要配合課程 launch context、每學生／裝置／課程限速、冷卻／鎖定、教師重設與不枚舉錯誤。
- 學生登入、教師查成績、校方 roster 匯入、管理者查回原 PIN 是不同權限面。教師不讀 credential vault；管理者查原 PIN 必須是 C2 外部 KMS／等價受控金鑰服務的單筆、重新驗證、理由碼、遮罩／一次性顯示與獨立稽核路徑。
- C2 的 ciphertext envelope 與 verifier 都不可進事件資料；原 PIN 不進 Log、Sheet、瀏覽器長期儲存或分析事件。若沒有外部 KMS，不能用自製固定金鑰假裝完成 C2，改採 C1 重設。
- 事件至少一次送達；以 `gameId + sessionId + eventId`（含 school／course scope）辨識 canonical key，raw events 不因重送被默默改寫，mastery rollup 必須先去重。
- `receivedAtMs` 由 GAS 產生；`clientCorrect`、`clientScoreDelta` 等客戶端欄位只作未可信遙測。正式學習證據由伺服器題庫重算或標為非權威。
- GAS 只接受固定白名單欄位，先做 body／batch／每日預算與 kill switch，再取得 Lock 或呼叫昂貴服務；Sheet 用批次二維寫入，不採每 click 一次的寫入。

### Gate 5：產物與授權

依目前任務輸出所需的最小集合：

- `teacher-intake.md`
- `learning-mechanic-matrix.md`
- `educational-card-spec.md`
- `question-and-feedback-bank.md`
- `game-design-spec.md` 與 `level-map.md`
- `layout_plan.json`、`asset-spec.md`、`accessibility-and-safety-review.md`
- `gas-endpoint-contract.md`、`sheet-schema.md`、`playtest-plan.md`、`teacher-guide.md`

需要建立專案程式、導入資產或部署設定時，先產生 implementation preview／Task Packet，列出相對路徑、依賴、schema 版本、資產 hash、rollback 與 drift recheck；未取得使用者對精確變更的授權，不建立或部署外部服務。

## 輸出狀態

- `intake-only`：缺少教材、學習目標、年段或 Web 分支。
- `spec-ready`：學習目標、卡牌機制、資料契約、可及性與版面規劃完成，尚未建立遊戲程式。
- `implementation-preview`：精確變更預覽、依賴預檢與 rollback 完成，等待授權。
- `experimental-blocked`：KMS、認證、瀏覽器或外部資產條件未通過，只保留契約與 fallback。
- `pilot-evidence-ready`：有 fresh 的邏輯、DOM、CUA、裝置、效能、可及性與教師試點證據。
- `stopped`：觸發安全、資料治理、學習品質、授權或成本停止條件。

## 參考資料路由

- 初次規劃：`references/workflow-contract.md`、`assets/teacher-intake-template.md`。
- 卡牌規則：`references/card-data.schema.json`、`references/learning-mechanic-matrix.md`。
- GAS／身份：`references/gas-endpoint-contract.md`、`references/gas-threat-model.md`、`references/credential-and-role-model.md`、`references/credential-vault.schema.json`、`references/admin-audit.schema.json`。
- Sheet／效能：`references/sheet-schema.md`、`references/storage-performance-model.md`、`references/migration-criteria.md`。
- 試點：`assets/pilot-acceptance-checklist.md`、`assets/pilot-budget-and-kill-switch-template.md`。

必要時執行：

- `scripts/validate-card-game-contract.mjs`：驗證 card catalog 與規則不變式。
- `scripts/validate-gas-payload.mjs`：驗證合成 request 是否越過身份／秘密邊界。
- `scripts/validate-credential-policy.mjs`：驗證 C1／C2、短 PIN 與管理者查碼政策。
- `scripts/estimate-sheet-budget.mjs`：估算 cells、事件量與輪替警戒。

這些工具只處理合成資料與契約，不讀取或提交真實學生姓名、學號、PIN、token、cookie 或 private key。
