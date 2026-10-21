# GAS／Google Sheet 威脅模型 v0.1

## 1. 資產與信任邊界

| 資產 | 信任等級 | 保存位置 | 主要保護 |
|---|---|---|---|
| `displayName`／school／class | 個人／學生資料 | 受限 `roster_pii` workbook | Google 身分、school scope、保存與刪除政策 |
| verifier／salt | 認證資料 | credential vault | 最小權限、版本、限速、不可公開讀取 |
| 原始短 PIN | 高敏感秘密 | 只在輸入／受控 decrypt runtime | 不落 Log／Sheet；C2 KMS、單筆 reveal、獨立稽核 |
| studentSessionToken | 短期 bearer secret | 瀏覽器記憶體／request | scope、TTL、撤銷、HTTPS、不可查成績 |
| events／mastery | 學習資料 | grade workbook | batch、append-only、去重、保存與刪除 |
| GAS endpoint URL | 公開路由 | GitHub bundle | 不靠隱藏 URL；依賴驗證、限流與 kill switch |

## 2. 威脅清單

| ID | 威脅 | 影響 | 必要控制／停止條件 |
|---|---|---|---|
| T-001 | 冒用 school／studentKey 搶註 | 成績歸屬錯誤、拒絕服務 | roster 先建檔；public 不提供 register；launch scope；登入限速 |
| T-002 | 猜測短 PIN | 冒用學生、污染事件 | 每學生／裝置／課程／來源 budget、冷卻、鎖定、教師 reset；正式高風險評量需更強身份 |
| T-003 | 前端偽造 teacher／admin principal | 越權查分／查碼 | principal 只由 server session 產生；移除 request 權威欄位；fail closed |
| T-004 | 批次或逐筆呼叫 reveal | 原 PIN 大量外洩 | 單筆 action、per-admin／credential／school rate limit、異常警示、不可批次匯出、re-auth |
| T-005 | Sheet／Log 外洩 PIN | 學生帳號被重用 | PIN 只在 body／controlled runtime；C2 envelope；不進一般 Sheet／事件／Log |
| T-006 | KMS 金鑰或 service principal 濫用 | 大量解密 | IAM 分離、key reference 不等於 key material、decrypt audit、輪替、最小權限 |
| T-007 | 事件重送或 payload conflict | mastery overcount／資料污染 | canonical key、payload hash、durable rollup dedupe、conflict audit |
| T-008 | public endpoint 被耗盡 | GAS 配額／Sheet Lock／KMS 費用耗盡 | body／batch／每日／來源 budget 先檢查；kill switch；無效 request 不放大 dead letter |
| T-009 | 公式注入或超長欄位 | Sheet 執行公式／效能下降 | 欄位白名單、enum／regex、固定欄位陣列、拒絕 `= + - @` 前導內容 |
| T-010 | CORS／redirect／opaque ACK 誤判 | 假同步、遺失事件 | browser preflight；IndexedDB queue；無 ACK 只宣稱 queued；跨來源 Gate 未過不交付 |
| T-011 | 全校名冊公開 | 個人資料暴露 | 公開頁不下載 roster；launch 只給 scoped context；姓名留在受限 mapping |
| T-012 | 管理者 audit 可竄改 | 無法追責 | KMS decrypt audit 用獨立 sink；`audit_admin` 只作鏡像，不能是唯一證據 |

## 3. 驗證情境

- 合成攻擊者以不存在、已存在、停用與跨校 studentKey 嘗試 login；所有錯誤不枚舉身份。
- 同一 `canonicalEventKey` 重送相同 payload、不同 payload、不同 batch、亂序與跳號；確認 idempotency／conflict／summary 不倒退。
- 合成 admin 嘗試沒有 scope、過期 re-auth、跨校 credential、重複 reveal 與逐筆自動化；確認 fail closed、rate limit 與 audit。
- 匯入重送舊 `importId`、部分失敗、重複 studentKey、formula injection 與超長 displayName；確認 dry-run、回滾與不寫 PIN。
- KMS timeout／拒絕／key rotation 時，登入 verifier 不被破壞，reveal 不回明文，事件 queue 仍可安全延後。
- 累積到 body／batch／每日／Sheet cell 警戒線時，確認 kill switch、輪替與升級路徑。

## 4. 不可宣稱

- 不能把 public GAS URL 當作密碼。
- 不能把短 PIN、HMAC 或密文說成高強度身份。
- 不能把 `audit_admin` Sheet 一列說成不可竄改的完整稽核。
- 不能把 client score、事件送達或一次成功的登入說成學習成效。
