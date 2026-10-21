# eduHarness 分享版改寫漏了內部代號命名空間

## 症狀

WP-P 投影 NOOA-1 契約到 eduHarness v2026.08.0，convert 掃描回報 `SCAN_HITS 0`、兩道核准閘都過，但 pre-push fresh verifier REFUTED：`harness/schemas/skill-contract.schema.json:3` 的 JSON Schema `$id` 仍是 `https://<內部代號>.local/schemas/...`，內部代號隨公開發佈外洩。

## 根因

分享版轉換的路徑改寫（`rewrites`）只涵蓋**檔案系統路徑形式**（`<磁碟>:\<內部代號>`、`<磁碟>:/<內部代號>`），沒涵蓋**同一代號的其他載體**——schema `$id` 用的是 `<內部代號>.local` 這個網域式命名空間。`forbidden_patterns` 的 `source-workspace-residual` 也只比對路徑形式，對 `<內部代號>.local` 同樣漏接。結果：改寫沒改到、掃描也沒攔到，`SCAN_HITS 0` 是假綠燈。「乾淨」只代表未被現有規則證明髒，不等於真的乾淨。

## 修復

- `eduharness-share-manifest.json` `rewrites` 增 `<內部代號>.local → eduharness.local`（改寫在掃描前，故能一次清乾淨所有現在／未來投影的 schema `$id`）。
- 增 `forbidden_patterns` backstop `internal-codename-residual: <內部代號的大小寫不敏感樣式>`：任何形式的代號殘留都會被掃描攔下（fail-closed），不再依賴逐一列舉路徑形式。
- 對 `document-to-markdown-ingestion/scripts/convert-document.ps1` 的防禦守衛行（刻意寫舊工作區路徑來拒絕它）加 `scan_exceptions`，避免 backstop 誤傷。

## 防護

- 新增內部代號或命名空間時，改寫規則要涵蓋**所有載體**（路徑、URI/命名空間、套件名），不只檔案路徑。
- 對「絕不該出現在公開產物」的字串，優先用 forbidden backstop（正面表列會漏），讓掃描主動 fail-closed，而非仰賴改寫窮舉。
- 對外發佈前一定跑 fresh verifier 獨立全庫掃描；不可只信 convert 自帶掃描的 `SCAN_HITS 0`（那只證明「未被現有規則判髒」）。參見 [[repo-placement-generalized-special-case-over-ssot]] 的同類教訓：工具回報的「正常」不是查證依據。
