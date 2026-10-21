# 教育卡牌 Skill 工作契約 v0.1

## 1. 使用目的

本契約把教師需求整理成可審核的教育 Web 卡牌遊戲設計。它不取代教師的學科判斷，也不表示已完成程式、資產、GAS 部署或教學成效驗證。

## 2. 必要輸入

至少需要：

| 欄位 | 要回答的問題 |
|---|---|
| `materialSource` | 教材、頁碼、教師核准內容或可追溯來源是什麼？ |
| `learningObjectives` | 學生完成後能做什麼？每個目標如何觀察？ |
| `learnerProfile` | 年級、年齡、先備能力、語言與班級差異？ |
| `branch` | 是否明確選擇 `web`？本 Skill 不自行選 physical／both。 |
| `classContext` | 課堂時間、學生數、合作／競賽、教師介入時機？ |
| `deviceNetwork` | 裝置、瀏覽器、網路、是否需要離線可玩？ |
| `accessibility` | 鍵盤、觸控、閱讀器、低動態、色覺、文字閱讀需求？ |
| `assessmentAndData` | 評量目的、資料控制者、保存、刪除、匯出與權限？ |
| `assetPolicy` | 素材來源、授權、版本、hash 與 fallback？ |

缺少會改變學習或 Web 方向的資料時，輸出 `intake-only`，列出缺件與假設，不生成完整卡牌內容。

## 3. Gate 與狀態

~~~text
intake-only
  → learning-ready
  → spec-ready
  → layout-ready
  → implementation-preview
  → pilot-evidence-ready
~~~

任何安全、資料治理、授權、可及性或證據缺口都可回退為 `stopped` 或 `experimental-blocked`。狀態不可因為有 Markdown 檔案就自動前進。

### Gate 0：Intake

產出 `teacher-intake.md`。若教材或目標不清楚，只問最少且關鍵的問題。

### Gate 1：學習—機制矩陣

產出 `learning-mechanic-matrix.md`。每個目標都要連到可觀察行為、卡牌操作、正確證據、錯誤回饋、補救與事件。沒有正確證據就不能進 `spec-ready`。

### Gate 2：卡牌規格

產出 `educational-card-spec.md`、`question-and-feedback-bank.md` 與 `game-design-spec.md`。使用 `card-data.schema.json` 驗證資料，不把自由文字效果直接當作可執行規則。

### Gate 3：版面與可及性

產出 `layout_plan.json` 與 `accessibility-and-safety-review.md`。只要有遊戲畫面，就先完成 viewport、layout blocks、component rects、hit rect、z-order、overflow、collision channels 與核心圖示預覽。

### Gate 4：同步與角色

產出 `gas-endpoint-contract.md`、`credential-and-role-model.md` 與 `sheet-schema.md`。先用合成資料測試，不把前端輸入當可信身份或正式成績。

### Gate 5：實作預覽

產出 implementation preview／Task Packet，列出相對路徑、依賴、schema 版本、資產 hash、覆寫行為、rollback 與 drift recheck。只有使用者核准精確變更後才建立程式或部署設定。

### Gate 6：驗證／試點

邏輯契約 → DOM_PASS → CUA_PASS → 真實裝置／網路 → 教師裁決 → pilot evidence。任何一段沒有 fresh evidence，都不能宣稱 `pilot-evidence-ready`。

## 4. Runtime 不變式

- `LearningState` 是作答、迷思、提示、補救與完成狀態的唯一真相。
- `GameState` 是 Zone、牌序、資源、回合、queue、seed 與勝負的唯一真相。
- `VisualSnapshot` 只能讀取狀態；動畫完成不是學習完成。
- `PersistenceQueue` 可丟失、可重送、可去重；同步失敗不得阻塞遊戲。
- 分數與學習證據分欄，不能以高分直接推論學會。
- 事件以至少一次語意送出；mastery rollup 必須先做 canonical dedupe。

## 5. 產物最小集合

### 設計階段

`teacher-intake.md`、`learning-mechanic-matrix.md`、`educational-card-spec.md`、`question-and-feedback-bank.md`、`game-design-spec.md`、`level-map.md`、`asset-spec.md`、`accessibility-and-safety-review.md`、`playtest-plan.md`、`teacher-guide.md`。

### Web／保存階段

`layout_plan.json`、`gas-endpoint-contract.md`、`gas-threat-model.md`、`credential-and-role-model.md`、`sheet-schema.md`、`storage-performance-model.md`、`pilot-acceptance-checklist.md`。

## 6. 輸出品質檢查

每次輸出都要列出：

- 目前狀態與已完成的 Gate。
- 使用者已提供的事實、暫定假設與尚未知事項。
- 尚未通過的安全／資料／可及性／效能檢查。
- 下一個可逆步驟與需要使用者決定的事項。

不得把 synthetic fixture 當成真實學生、瀏覽器、效能或教學成效證據。
