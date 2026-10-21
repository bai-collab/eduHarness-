# Google Sheet 儲存契約 v0.1

## 1. Workbook 分層

使用不同 workbook 降低姓名／認證／成績的權限混合。`spreadsheetId` 只能由 GAS server-side allowlist 對應，不能由 GitHub 前端傳入。

| Workbook | Tabs | 主要存取者 | 是否進遊戲熱路徑 |
|---|---|---|---|
| `roster_pii` | `roster_pii`、`import_audit` | 校管理者、被授權教師 | 否 |
| `credential_vault` | `credential_vault`、`audit_admin` | credential admin／KMS | 否；reveal 只單筆 |
| `grade` | `meta`、`games`、`events_YYYYMM`、`sessions_latest`、`session_mastery`、`class_mastery`、`dead_letter` | GAS、教師、管理者 | events append 是 |

不要把全校姓名名冊、原始 PIN、verifier、密文與事件放在同一個教師可讀 workbook。Sheet 是報表／受控小規模儲存，不是無限事件資料庫。

## 2. Tab 欄位

### `roster_pii`

`rosterId`、`schoolKey`、`schoolDisplayName`、`classKey`、`studentKey`、`displayName`、`credentialId`、`validFrom`、`validUntil`、`status`、`importId`、`rowVersion`、`schemaVersion`

只保存校方需要的對照資料。姓名不進公開前端 bundle、events 或 grade read model；教師是否可看到姓名由 course／school policy 決定。

### `credential_vault`

`credentialId`、`schoolKey`、`courseKey`、`studentKey`、`verifier`、`salt`、`verifierAlgorithm`、`verifierVersion`、`ciphertextEnvelope`、`createdAtMs`、`rotatedAtMs`、`failedAttempts`、`lockedUntil`、`status`、`schemaVersion`

`ciphertextEnvelope` 若啟用 C2，固定包含 `format`、`cipherSuite`、`wrappedDek`／`ciphertext`、`nonce`、`tag`、`keyReference`、`keyVersion`、`aadVersion`。不得有 `authCode`、`pin`、`plaintext` 或解密結果欄位。AAD 需綁定 credential 與 student scope，避免密文換綁。

### `events_YYYYMM`

`eventId`、`canonicalEventKey`、`payloadHash`、`sessionId`、`schoolKey`、`courseKey`、`classKey`、`studentKey`、`gameId`、`gameVersion`、`receivedAtMs`、`occurredAtMs`、`type`、`objectiveId`、`cardId`、`answerCode`、`clientCorrect`、`clientScoreDelta`、`stateRevision`、`seq`、`batchId`、`clientVersion`、`schemaVersion`

`receivedAtMs` 由 GAS 產生；tab 依 server received month 分區。`clientCorrect`、`clientScoreDelta` 只作未可信遙測。不要保存完整題幹、完整 state JSON、PIN 或自由文字答案，除非完成額外資料審查。

### `sessions_latest`

`sessionId`、`schoolKey`、`courseKey`、`classKey`、`studentKey`、`gameId`、`gameVersion`、`startedAtMs`、`lastEventAtMs`、`endedAtMs`、`status`、`gameScore`、`learningSummaryCode`、`eventCount`、`lastSeq`、`summaryRevision`、`lastAppliedReceivedAtMs`、`clientVersion`、`schemaVersion`

這是由 events lifecycle rollup 產生的 read model，不是 raw log。`status` 至少支援 `open`、`completed`、`abandoned`、`expired`；重複 close、遲到事件與 resume／reopen 規則要在實作前固定。

### `session_mastery`

`rollupId`、`sessionId`、`scopeType=session`、`scopeKey=sessionId`、`objectiveId`、`attempts`、`distinctEventCount`、`correctCount`、`hintCount`、`misconceptionCode`、`masteryBand`、`lastSeenAtMs`、`updatedAtMs`、`rollupRevision`、`schemaVersion`

### `class_mastery`

`rollupId`、`schoolKey`、`classKey`、`courseKey`、`scopeType=class`、`scopeKey=schoolKey|classKey|courseKey`、`objectiveId`、`attempts`、`distinctEventCount`、`correctCount`、`hintCount`、`misconceptionCode`、`masteryBand`、`lastSeenAtMs`、`updatedAtMs`、`rollupRevision`、`schemaVersion`

### `audit_admin`

`auditId`、`adminPrincipal`、`action`、`credentialId`、`schoolKey`、`courseKey`、`reasonCode`、`result`、`occurredAtMs`、`requestId`、`auditSinkRef`、`schemaVersion`

不保存 PIN、plaintext、解密結果、token 或 KMS key material。KMS decrypt 的權威稽核由獨立 sink 保存，這張 tab 只是受限鏡像。

## 3. 寫入與去重

- 前端 IndexedDB queue 依事件數／時間批次送出；同步失敗不阻塞遊戲。
- GAS 將固定欄位轉為矩形二維陣列，以 `setValues` 批次寫入；不用每事件一次 `appendRow`。
- canonical key：`schoolKey|courseKey|gameId|sessionId|eventId`。
- 同 key、同 payload hash：回傳 idempotent accepted，不重複加總。
- 同 key、不同 payload hash：寫入受控 conflict counter／audit，拒絕該衝突，不覆寫既有 raw event。
- batch 重送：逐 event 去重，成功的與衝突的分別回報；不得整批重算造成 overcount。
- event seq 跳號／亂序：raw event 可保存，但 session summary 只依規則允許的高水位更新，不可倒退。
- `session.opened`、`session.completed`、`session.abandoned`、`session.expired` 都是事件，不以瀏覽器是否正常關頁作唯一依據。

## 4. Formula injection 與資料衛生

只接受白名單欄位、固定型別、有限長度與 enum／regex。對可能寫入 Sheet 的文字拒絕前導 `=`、`+`、`-`、`@` 與控制字元；不使用模糊清洗代替拒絕。未知欄位與超長 body 直接拒絕。

## 5. 刪除與保留

資料政策要同時涵蓋 `roster_pii`、credential vault、grade events、rollup、backup／export 與 audit sink。刪除 student mapping 不代表歷史事件自動消失；要定義刪除、去識別、保留法律證據與稽核最小集合的傳播順序。
