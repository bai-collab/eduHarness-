# 身份、角色與認證碼模型 v0.1

## 1. 服務邊界

本模型把短 PIN 視為國小課堂的低強度登入碼，不把它當成正式成績或高風險身份證明。正式成績的讀取權由教師的受保護 Google 身分與課程範圍決定。

「假名化」在本 Skill 中只表示事件與報表使用代碼；只要 `studentKey` 能由校方 roster 對回姓名，就仍是可連結的學生學習資料，不是匿名資料。

## 2. 角色矩陣

| 角色 | 身份來源 | 可做的事 | 明確禁止 |
|---|---|---|---|
| 學生遊戲頁 | public collector；只有課程 launch context＋studentKey＋PIN | 登入既有 roster、取得短期寫入 token、送出事件 | register、查成績、列出全校 roster、寫入 PIN、讀 vault |
| 教師 | Google 登入 session＋教師 allowlist／課程 scope | 查授權課程的 sessions、mastery、學習摘要；依政策對照姓名 | 讀 credential vault、查原 PIN、跨課程搜尋 |
| 校管理者 | Google 登入 session＋school scope | dry-run／匯入／停用 roster、設定初始 PIN、觸發重設 | 由公開頁匯入、跨校操作、直接改 grade workbook |
| 認證管理者 | Google 登入 session＋credential-reveal scope＋重新驗證 | 查 vault 狀態；必要時單筆 reveal 原 PIN | 批次匯出、無理由 reveal、把 PIN 寫回一般 Sheet |
| KMS service principal | 受控服務身份 | 封裝／解封單筆資料加密金鑰 | 讀取整本 Sheet、瀏覽器登入、任意批次解密 |

`teacherPrincipal`、`adminPrincipal` 與 `reauthPassed` 都不是可由前端任意宣稱的權威欄位。GAS 必須從已驗證的登入 session、伺服器端 allowlist 與短效 re-auth 狀態取得它們；無法驗證時 fail closed。

## 3. 校方預載流程

~~~text
校管理者登入
→ 上傳受保護的 roster batch
→ dry-run：欄位、重複 key、school scope、PIN 政策、formula injection
→ 使用者確認 import summary
→ GAS 以 importId／rowVersion 做可重試的原子化提交
→ roster_pii 保存姓名／學校／班級對照
→ credential vault 保存 verifier 與 C2 ciphertextEnvelope
→ 回傳不含 PIN 的結果與 import audit
~~~

匯入 request 的 `initialPin` 只存在於 HTTPS body 的短暫處理期間；不可寫入 Log、錯誤訊息、回應、一般 roster tab、grade workbook 或事件。匯入來源檔案由校方依政策刪除，不能把上傳檔案當成長期資料庫。

匯入要具備：

- `schoolKey + studentKey` 唯一鍵與 school scope。
- `importId`、row version、重送結果與較新資料不可被舊批次覆蓋。
- dry-run 與 commit 分離；commit 前顯示新增／停用／變更數量。
- 停用學生時立即撤銷該 studentSessionToken；不得刪除未完成的學習事件而沒有保存政策。
- 重設 PIN 時舊 verifier、舊 ciphertext 與舊 studentSessionToken 按版本撤銷；不把新 PIN 回寫到歷史事件。

## 4. 學生登入

學生流程不是註冊：

~~~text
教師建立課程 launch context
→ 學生在指定課程範圍選 studentKey／學號
→ 輸入短 PIN
→ GAS 以 roster／credential vault 驗證
→ 成功後發 scoped、短效 studentSessionToken
→ 遊戲只用 token 批次送事件
~~~

公開頁不下載全校姓名。`launchContext` 至少要綁定 `schoolKey`、`courseKey`、`classKey`、有效時間、版本與撤銷狀態；可再綁定教師建立的 gameId。登入錯誤採一致回應，不回應 studentKey 是否存在。

## 5. 短 PIN 政策

- 由校方核准 PIN 長度、數字格式、重複碼政策、重設與撤銷。
- 短 PIN 可用大字鍵盤、顯示／隱藏切換與教師協助輸入，不能為了可用性而把 PIN 寫入 localStorage、URL 或事件。
- 每學生、裝置、課程、launch context、來源與學校都要有失敗預算；達門檻後冷卻、鎖定、提示教師或停用該 launch context。
- 加密保存只降低靜態資料外洩風險；不能消除短 PIN 的線上猜測風險。
- 若要把遊戲結果當正式高風險評量，須加教師確認、一次性 QR／代碼或更強的身份方案；短 PIN 單獨不足。

## 6. C1／C2 選擇

| 模式 | 保存 | 管理者能力 | 適用條件 |
|---|---|---|---|
| C1 | verifier、salt、版本、狀態；不可回復原 PIN | 重設／撤銷，不查原 PIN | 可接受忘記時重設，且不需原碼查詢 |
| C2 | C1 verifier＋外部 KMS 保護的 ciphertextEnvelope | 單筆、重新驗證、理由碼、遮罩／一次性 reveal | 業務確實要求查回原 PIN，且 KMS、IAM、audit、限流已通過 preflight |

C2 的解密不是前端功能。管理者頁面不得把原 PIN 放 query string、HTML source、瀏覽器長期儲存、分析事件或可下載 CSV。解密完成後應立即清除 UI 狀態，並以 `Cache-Control: no-store` 等方式降低快取殘留。

## 7. 必要稽核

每次 provision、reset、disable、reveal、key rotation 與權限變更都要有 requestId、principal、scope、reasonCode、結果、伺服器時間與 audit sink reference。KMS 的 decrypt audit 不得只依賴可由同一管理者改寫的 Sheet 鏡像；`audit_admin` 是查詢 read model。
