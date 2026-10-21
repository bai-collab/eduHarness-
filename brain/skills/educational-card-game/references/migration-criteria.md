# 儲存升級與 schema 遷移準則 v0.1

## 1. 何時繼續用 Sheet

適合單校／少量課堂、教師主要讀摘要、事件可以批次寫入、查詢範圍可分檔、且 p95／Lock／quota 都在已量測門檻內。每次 schema 版本都要保留 migration note 與 rollback。

## 2. 何時升級受控 proxy／資料庫

符合下列任一情況就進入 D4 評估：

- 需要高併發或跨校即時查詢。
- dedupe／conflict／rollup 需要 durable transaction 或複合索引。
- Sheet cell、配額、Lock wait 或 rollup backlog 反覆超過門檻。
- 需要可靠 ACK、重試結果、教師即時查詢與學生事件同時運作。
- 需要保留大量 replay 或進行長期歷程分析。

升級不是把原始事件靜默搬走；要先定義 `sourceOfTruth`、雙寫期間、event schema、重算策略、刪除／保留傳播與回退方式。

## 3. Schema 版本規則

- 每個事件、summary、mastery、credential 與 audit 都帶 `schemaVersion`。
- 新增欄位優先使用向後相容的 nullable／default；改變語意必須升版。
- `gameVersion` 與 `schemaVersion` 分開；題庫改版不能改寫歷史事件。
- `receivedAtMs` 產生的 partition 不因客戶端 occurredAt 變更；遷移需保存原 partition。
- C2 key rotation 產生新 `keyVersion` 與新 envelope，不重寫歷史 audit；舊 key 依政策保留到資料期限結束。
- migration script 必須 dry-run、輸出統計、可重跑、可驗證 hash，並保留 last-known-good。
