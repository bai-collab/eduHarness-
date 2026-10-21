# Google Sheet 建立清單

## Workbook

- `roster_pii`：姓名、學校、班級、studentKey 對照；受限存取。
- `credential_vault`：verifier 與 C2 ciphertextEnvelope；不與 grade workbook 共用。
- `grade`：events、sessions_latest、session_mastery、class_mastery、games、meta、dead_letter。

## 必須固定

- game／course／school scope：
- schemaVersion／gameVersion：
- events partition：`events_YYYYMM`，依 server `receivedAtMs`：
- canonical key：`schoolKey|courseKey|gameId|sessionId|eventId`：
- payload conflict 行為：拒絕／隔離／audit：
- batch setValues 上限：
- bounded Lock 與 timeout：
- cell budget 警戒線：
- rollup lag 門檻：
- 輪替檔案與升級資料層條件：

## 禁止欄位

一般 grade／events 不放 `pin`、`authCode`、plaintext、token、完整題幹、完整 state JSON 或未審核自由文字。
