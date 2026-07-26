---
name: security-and-hardening
description: 系統安全防禦性開發指南。在處理使用者輸入、認證、資料儲存或外部整合時使用。基於 OWASP Top 10 與三層邊界系統。
---

# 安全與強化

## Do Not Use When(anti-triggers)
- 不涉輸入/認證/外部整合的一般 review
- 純文件或內容任務

## 核心目標

將安全性視為「設計的一部分」而非「事後的檢查」。每一個對外的介面都是潛在的攻擊面。

## 何時使用

- 處理任何形式的使用者輸入。
- 實作認證 (Authentication) 或授權 (Authorization)。
- 儲存敏感資料（密碼、API Key、個人資訊）。
- 整合外部 API 或第三方服務。
- 建立檔案上傳或下載功能。

## 三層邊界系統 (Three-Tier Boundary)

### Layer 1：外部邊界 (External Boundary)
所有來自外部的輸入都是**不可信的**。
- HTTP 請求參數、Header、Body。
- URL Query String。
- 第三方 API 回應。
- 使用者上傳的檔案。

**防禦措施：**
- 在進入點進行嚴格的 Schema 驗證（使用 Zod、Joi 等）。
- 設定白名單而非黑名單。
- 限制請求大小 (Body Size Limit)。

### Layer 2：內部邊界 (Internal Boundary)
模組之間的資料傳遞應該有型別保障。
- 使用 TypeScript Strict Mode。
- 定義明確的介面 (Interface) 與型別 (Type)。
- 資料庫查詢一律使用參數化查詢 (Parameterized Query)。

### Layer 3：輸出邊界 (Output Boundary)
傳給使用者或外部系統的資料必須經過過濾。
- HTML 輸出必須進行 XSS 消毒 (Sanitization)。
- API 回應不得包含內部錯誤堆疊 (Stack Trace)。
- 日誌不得記錄敏感資訊（密碼、Token）。

## OWASP Top 10 防禦清單

| 風險 | 防禦策略 |
|---|---|
| **注入攻擊 (Injection)** | 參數化查詢、ORM、輸入白名單 |
| **認證失敗 (Broken Auth)** | 安全的密碼雜湊 (bcrypt)、JWT 過期、MFA |
| **敏感資料暴露** | HTTPS、加密靜態資料、最小權限原則 |
| **XXE** | 禁用 XML 外部實體解析 |
| **存取控制失效** | 每個端點強制檢查權限、預設拒絕 |
| **安全設定錯誤** | 移除預設密碼、禁用除錯模式、定期更新 |
| **XSS** | 輸出編碼、CSP Header、DOMPurify |
| **不安全的反序列化** | 只接受 JSON、禁用 eval/pickle |
| **使用已知漏洞元件** | `npm audit`、Dependabot、定期更新 |
| **日誌與監控不足** | 結構化日誌、異常告警、存取記錄 |

## 秘密管理 (Secrets Management)

**嚴禁在程式碼中硬編碼任何秘密。**

```typescript
// ❌ 嚴禁
const API_KEY = "sk-1234567890abcdef";

// ✅ 正確
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error("Missing API_KEY environment variable");
```

- 使用 `.env` 檔案 + `.gitignore`。
- 生產環境使用環境變數或 Secret Manager。
- API Key 必須可輪替 (Rotatable)。
- 在 `brain/instincts/` 中記錄所有需要的環境變數清單。

## 行為防護 (Anti-Rationalization)

| 藉口 | 共同治理反駁邏輯 |
|---|---|
| 「這只是內部工具，不需要安全性。」 | **拒絕**。內部工具是攻擊者最愛的入口。最小權限原則一律適用。 |
| 「先上線再做安全檢查。」 | **拒絕**。安全是設計的一部分，不是事後的修補。 |
| 「密碼先用明文存，之後再加密。」 | **拒絕**。「之後」永遠不會來。使用 bcrypt，現在。 |
| 「這個 API 不需要認證，資料不敏感。」 | **拒絕**。沒有認證的 API = 任何人都能呼叫。至少要有速率限制。 |

## 紅旗警訊 (Red Flags)

- 🚩 `.env` 檔案被提交到 Git。
- 🚩 SQL 查詢使用字串拼接而非參數化。
- 🚩 API 回應包含完整的 Stack Trace。
- 🚩 使用者密碼以明文或 MD5/SHA1 儲存。
- 🚩 CORS 設定為 `*`（允許所有來源）。
- 🚩 錯誤訊息洩漏了資料庫結構或內部路徑。

## 驗證門檻 (Verification)

- [ ] 所有使用者輸入都在邊界處進行驗證。
- [ ] 無硬編碼的秘密（執行 `grep -r "sk-\|password=" --include="*.ts" --include="*.js"`）。
- [ ] 資料庫查詢使用參數化方式。
- [ ] API 端點有認證與授權檢查。
- [ ] 執行 `npm audit` 無高危漏洞。
- [ ] 錯誤回應不包含內部實作細節。
