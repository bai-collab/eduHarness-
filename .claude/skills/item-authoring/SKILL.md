---
name: item-authoring
description: Create and review digital-learning assessment items with indicator, source, coverage, item-type, answer, rationale, and human-review contracts. Use for 試題命題, 命題, item authoring, item bank creation, or requests to turn a supplied curriculum source into an item bank. Do not use for generic lesson plans, game design, or unsupported official-policy claims.
---
# 試題命題

## 定位

將使用者提供的課綱、教學材料或已核准來源轉為可審查的數位學習題目規格；本 skill 只產生草稿與證據清單，不宣稱地方規範或題庫已通過正式審查。

## 觸發與反觸發

- 觸發：`試題命題`、`命題`、指定題數／題型／指標的命題請求。
- 不觸發：一般教案、教材轉遊戲、教案差異化；這些請路由到對應 workflow。
- 若目標、學段、科目、題數、題型、指標或來源不足以改變結果，先啟動「提示詞優化」並列出最小缺件；不得猜測。

## 必要輸入

學段、科目、教材／來源、題數、題型、學習指標範圍、難度、答案格式、使用語言與人工審查需求。來源需標記 `user-supplied`、`official`、`reference` 或 `unknown`。

## 執行流程

1. 建立 intake 與來源 ledger，記錄 URI／檔名、日期、版本、授權與證據狀態。
2. 對齊指標、認知層次、題型、正確答案、干擾項、解析與難度；重複題與自相矛盾題先標記。
3. 產生 coverage matrix、item blueprint 與 item-bank draft；每題保留來源定位與人工覆核欄位。
4. 產出後以清單逐欄檢查欄位完整性與 coverage；如環境有獨立審查者（fresh reviewer），交付其做新鮮脈絡的內容檢查。

## 輸出契約

至少輸出 `intake-gap.md`（有缺件時）、`indicator-checklist.md`、`source-ledger.md`、`coverage-matrix.md`、`item-blueprint.md`、`item-bank-draft.md`、`review-report.md` 與 `human-review-brief.md`。

## 停止規則

- 缺少學段、科目、來源或指標時，停止正式命題，只輸出缺件報告。
- 沒有官方證據時，不把工作坊／模型建議標為官方規範。
- 涉及學生個資、未授權題庫、外部發布或正式評量時，停在使用者核准閘門。
- 模型或工具不可用時如實回報 `unavailable`，不自動改派。

## 工作區邊界

不得安裝套件、不得讀取 secrets、不得覆寫使用者來源檔；所有輸出寫入使用者指定的輸出目錄。
