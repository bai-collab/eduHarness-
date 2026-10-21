# GAS 設定模板（不含秘密）

此檔只描述部署時需要填入的設定名稱，不放 GAS URL、Sheet ID、OAuth token、服務帳戶金鑰、KMS key material 或學生資料。

```json
{
  "schemaVersion": "1.0",
  "deployments": {
    "publicCollector": {
      "endpointVersion": "v1",
      "allowedGameIds": [],
      "gradeWorkbookRef": "<server-side-reference>",
      "killSwitch": false
    },
    "teacherConsole": {
      "allowedGoogleDomain": "<approved-domain>",
      "teacherAllowlistRef": "<server-side-reference>",
      "courseScopes": []
    },
    "schoolRosterAdmin": {
      "schoolScopes": [],
      "importBatchLimit": 0
    },
    "credentialAdmin": {
      "revealEnabled": false,
      "credentialRevealScopes": [],
      "kmsKeyReference": "<external-kms-reference>",
      "reauthTtlSeconds": 0
    }
  },
  "budgets": {
    "maxBodyBytes": 0,
    "maxEventsPerBatch": 0,
    "maxRequestsPerLaunch": 0,
    "maxRevealPerAdminWindow": 0
  }
}
```

部署前要另外產生密鑰／KMS、Sheet allowlist、Google 身分與保留政策的受控設定；不要把 `<...>` placeholder 當作可上線值。
