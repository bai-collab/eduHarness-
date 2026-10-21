# 教育卡牌 Pilot 驗收清單

## 教學與遊戲

- [ ] 每個 objective 有可觀察行為與正確證據。
- [ ] 每張卡有答案、理由、提示、正誤回饋、補救與來源。
- [ ] Zone 唯一性、remove-then-add、effect order、失效目標、牌庫耗盡與 RNG 有測試。
- [ ] 分數與學習證據分開。

## Web 與可及性

- [ ] DOM-only baseline 可完成任務。
- [ ] layout plan ready，沒有未處理的 overlap／occlusion／hit collision。
- [ ] 鍵盤、觸控、非顏色線索、reduced motion 與低效能 fallback 通過。
- [ ] 先 DOM_PASS，再 CUA_PASS；證據可重現。

## 身份與資料

- [ ] roster 由授權校管理者預載；公開 collector 沒有 register。
- [ ] 短 PIN 被標示為低強度登入碼，已設定 launch scope、限速、冷卻、鎖定與 reset。
- [ ] 教師只能查授權成績；管理者 reveal 受 scope、re-auth、理由碼、單筆限制與 audit 保護。
- [ ] 沒有 PIN、token、Sheet ID 或 secret 進入 GitHub bundle／Log／events。
- [ ] 姓名／學校對照、credential vault、grade workbook 分層。

## 同步與效能

- [ ] IndexedDB queue、batch、至少一次語意與 canonical dedupe 已測試。
- [ ] server receivedAt、payload conflict、session lifecycle／revision 已測試。
- [ ] p50／p95、Lock、quota、rollup lag、cell budget 與 10 分鐘操作有 evidence。
- [ ] kill switch、輪替與升級條件可執行。

## 教師裁決

- [ ] 教師核准題庫、回饋、資料目的與保存政策。
- [ ] 使用合成資料完成登入、匯入、重設、查分、reveal、撤銷與刪除測試。
- [ ] Pilot 樣本、成功門檻、教師 rubric、失敗回退與中止條件已記錄。
