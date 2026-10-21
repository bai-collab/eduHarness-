# GAS Web App Endpoint Contract v0.1

這份契約描述 GitHub 靜態前端、GAS Web App、受保護管理介面與 Google Sheet／KMS 之間的邊界。它不是已部署的 URL，也不包含任何 secret。

## 1. 端點面

| surface | 用途 | 執行／讀寫邊界 |
|---|---|---|
| `public collector` | 學生 login 與事件 batch | 公開路由；只能寫入已允許的 game／workbook；不可讀成績、roster 或 vault |
| `teacher console` | 教師查成績與學習摘要 | 受 Google 登入、allowlist 與 course scope 保護；只讀 grade read model |
| `school roster admin` | 校方匯入、停用、重設 | 受 Google 登入與 school scope 保護；不把 PIN 直接寫入 Sheet |
| `credential admin` | C1 狀態／重設、C2 單筆 reveal | 受 Google 登入、credential-reveal scope、re-auth 與 audit 保護 |

不讓同一個公開 `doPost` 同時承擔四種角色。若 GAS Web App 以 owner 身分執行，不能因為 request 帶有 `teacherPrincipal` 或 `adminPrincipal` 就相信呼叫者；權威身份必須由受保護登入路徑建立。

## 2. Request envelope

所有 request 使用 JSON body，具有：

```json
{
  "schemaVersion": "1.0",
  "requestId": "req-example-001",
  "action": "login",
  "clientVersion": "web-0.1.0",
  "body": {}
}
```

`requestId` 只作追蹤與去重，不是身份證明。拒絕未知欄位、超大 body、過長字串、控制字元、前導公式字元與不在 enum 的 action。

## 3. Roster provision

`action=provision-roster` 僅能由 school roster admin console 呼叫：

```json
{
  "schemaVersion": "1.0",
  "requestId": "req-import-001",
  "action": "provision-roster",
  "importId": "import-2026-001",
  "schoolKey": "school-demo",
  "rows": [
    {
      "studentKey": "s-001",
      "displayName": "合成學生",
      "classKey": "class-a",
      "initialPin": "0000",
      "validFrom": "2026-08-28T00:00:00Z",
      "validUntil": "2027-07-31T00:00:00Z"
    }
  ]
}
```

以上只作 schema illustration；`initialPin` 不得進 repository、fixture output、Log 或 Sheet。實際匯入需 dry-run、school scope、duplicate key、rowVersion、公式注入與 PIN 政策檢查；回應只回統計與錯誤代碼，不回 PIN。

## 4. Student login

`action=login` 只接受既有 roster：

```json
{
  "schemaVersion": "1.0",
  "requestId": "req-login-001",
  "action": "login",
  "launchContext": "server-issued-short-lived-context",
  "gameId": "fraction-market",
  "schoolKey": "school-demo",
  "courseKey": "math-grade-4",
  "studentKey": "s-001",
  "pin": "0000",
  "clientVersion": "web-0.1.0"
}
```

禁止 `register`、`spreadsheetId`、`teacherPrincipal`、`adminPrincipal`、`reauthPassed`、長期 token 與任何讀取 query。PIN 只在 HTTPS request body 短暫存在；成功只回 scoped、短效 `studentSessionToken`。

## 5. Event batch

事件 request 不帶 PIN：

```json
{
  "schemaVersion": "1.0",
  "requestId": "req-events-001",
  "action": "event-batch",
  "gameId": "fraction-market",
  "courseKey": "math-grade-4",
  "studentSessionToken": "short-lived-token",
  "sessionId": "session-001",
  "batchId": "batch-001",
  "events": [
    {
      "eventId": "evt-001",
      "seq": 1,
      "type": "answer.submitted",
      "objectiveId": "compare-fractions",
      "cardId": "card-001",
      "answerCode": "choice-b",
      "stateRevision": 3,
      "occurredAtMs": 1787913600000
    }
  ]
}
```

GAS 伺服器補上 `receivedAtMs`、scope、server schema／game version 與 canonical key。`clientCorrect`、`clientScoreDelta` 若保留只能標為未可信遙測；正式成績由版本化答案目錄重算或標成非權威。

canonical key 至少為 `schoolKey|courseKey|gameId|sessionId|eventId`。相同 key 但 payload hash 不同時拒絕並產生 conflict audit；重複相同 payload 回傳 idempotent accepted；跳號／亂序依 session policy 保存但不倒退 summary。

## 6. Teacher read

教師 request 只帶查詢範圍，例如 `courseKey`、`classKey`、`studentKey`、`queryVersion`。GAS 從登入 session 與 allowlist 得到 principal，不接受 client 宣稱的角色。回應只包含允許的 read model：`sessions_latest`、`session_mastery`、`class_mastery` 與必要 roster display mapping；不回傳 verifier、ciphertext、PIN 或 KMS material。

## 7. Admin credential action

管理者 request 只包含 `credentialId`、`action`、`reasonCode`、`requestId`。身份、school scope 與 re-auth 狀態由 GAS server session 判定；`reauthPassed=true` 不是有效證據。

C2 `reveal-pin` 必須：

1. 驗證 admin scope、re-auth TTL、credential scope 與 request rate budget。
2. 寫入不可由一般管理者改寫的 audit sink，再執行單筆 KMS decrypt。
3. 回傳遮罩／一次性顯示，不提供批次 API、CSV、長期快取或 query string。
4. 解密失敗時 fail closed；不能回傳明文或 KMS 錯誤細節。

## 8. Server processing order

~~~text
body／JSON／schema／size／budget／kill switch
→ authentication／scope／launchContext
→ action-specific validation
→ verifier／KMS（必要時）
→ bounded Lock
→ batch setValues／rollup queue
→ generic response／idempotency result
~~~

無效公開 request 只做取樣／計數，不為每次攻擊寫一列 dead letter。CacheService 只作短期抑制，不當 durable dedupe。GAS URL 不視為 secret；若跨來源無法讀 ACK，只能宣稱 queued／sent，不能宣稱 exactly-once。
