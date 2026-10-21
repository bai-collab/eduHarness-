# 短 PIN 與認證保存政策

## 1. 需求分類

- PIN 用途：低強度課堂登入／其他：
- 是否允許管理者查回原 PIN：是／否
- 是否把遊戲結果當正式高風險評量：是／否
- 若是高風險評量，增加的教師確認／QR／更強身份：

## 2. 校方預載

- 匯入角色與 school scope：
- 匯入來源與核准人：
- dry-run 與 commit 流程：
- `importId`／rowVersion／重送政策：
- 初始 PIN 是否只經 HTTPS body 送入 GAS：
- PIN 是否不進 Log、Sheet、回應與前端長期儲存：

## 3. PIN 可用性與安全補償

- PIN 長度／字元：
- 禁止重複碼：
- 每學生／裝置／課程／來源失敗上限：
- 冷卻／鎖定：
- 教師／校管重設：
- 共用裝置清除策略：
- generic error 與不枚舉策略：
- launch context 的 TTL／scope／撤銷：

短 PIN 不得被描述為強密碼。加密保存主要保護靜態資料，不能取代線上限速。

## 4. C1／C2

- C1 verifier algorithm／version／salt／pepper 或外部 KDF：
- C2 ciphertext envelope／key reference／key version／AAD：
- KMS service identity 與 IAM 分離：
- reveal 角色、重新驗證、理由碼、單筆限制與 rate limit：
- 獨立 audit sink 與保存期限：
- KMS 不可用時的 fail-closed 行為：

## 5. 資料治理

- `roster_pii` 保存期限：
- credential vault 保存期限：
- grade events／rollup 保存期限：
- backup／export／audit sink 刪除傳播：
- 學生／家長／學校的告知與權利流程：
