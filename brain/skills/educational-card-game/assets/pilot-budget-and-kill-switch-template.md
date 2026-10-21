# Pilot 預算與 Kill Switch

## 預算

| 項目 | 核准上限 | 目前用量 | 警戒線 | 超線處置 |
|---|---:|---:|---:|---|
| 每批 body bytes |  |  |  | 拒絕 batch |
| 每批事件數 |  |  |  | 拆批／延後 |
| 每 launch requests |  |  |  | 冷卻 launch |
| 每 studentKey 失敗登入 |  |  |  | 鎖定／教師 reset |
| 每 school／course 事件 |  |  |  | 停止 collector |
| 每 admin reveal |  |  |  | 暫停 reveal／警示 |
| Sheet cells |  |  |  | 輪替 workbook |
| rollup backlog |  |  |  | 降級摘要／升級資料層 |

## Kill switch

- `publicCollectorEnabled`：
- `schoolKey` allowlist：
- `courseKey` allowlist：
- `revealEnabled`：
- 啟用人／時間／理由：
- 停止時前端行為：繼續離線遊戲／停止送出／提示教師：
- 既有 queue 如何保留與重試：
- 回復前要重新驗證的指標：

Kill switch 設定由受保護管理者操作；前端只讀取非敏感狀態，不可自行解除。
