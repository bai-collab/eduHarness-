# Sheet 儲存與效能模型 v0.1

## 1. 目標

資料同步不能卡住遊戲；教師查詢要讀摘要，不掃描整份 raw events；容量與配額接近警戒線時要能輪替或升級。

## 2. 估算公式

~~~text
estimatedCells =
  eventColumns × eventsPerSession × sessionsPerPeriod
  + sessionSummaryColumns × sessionsPerPeriod
  + masteryColumns × summaryRows
  + rosterColumns × rosterRows
  + credentialColumns × credentialRows
  + reservedHeaderAndFormulaCells
~~~

分別估算每校／課程／學期與每一個 `events_YYYYMM` partition，不把所有歷史資料混成一個平均數。

## 3. 可量測指標

| 指標 | 必須保存的證據 |
|---|---|
| ingest batch latency | p50／p95、批次大小、冷／暖執行 |
| Lock wait | p50／p95、timeout 次數、同 workbook 併發 |
| quota headroom | GAS 執行數、URL Fetch、KMS、Sheet service 與錯誤 |
| queue backlog | 最長等待、重送次數、永久失敗數 |
| rollup lag | receivedAt 到 read model 更新的延遲 |
| cell budget | 各 tab cells、成長速度與預留比例 |
| user impact | 遊戲操作是否被寫入阻塞、離開頁面送出成功率 |

## 4. 寫入策略

1. 瀏覽器以 IndexedDB 保存事件 queue，單次送固定上限的 batch。
2. GAS 先檢查 body、batch、每日 school／course budget、kill switch，再驗證 token與事件。
3. 只有必要的 append／rollup critical section 取得 bounded Lock。
4. 以固定欄位矩形 `setValues` 寫入，避免逐列 service call。
5. raw events 與 read model 分離；rollup 可排程或分批，不在每個 click 觸發複雜公式。
6. 重送以 canonical key／payload hash 去重；CacheService 只做短期抑制，不當永久索引。

## 5. 初步警戒與升級

10,000,000 cells 是檔案容量參考，不是效能保證。第一版可把 70% 當作需要壓測／輪替的暫定警戒線，並以實際 p95、Lock wait、quota headroom、rollup lag 與教師體感修正。

建議在下列任一條件成立時輪替 workbook 或升級 proxy／資料庫：

- cell budget 接近核准警戒線。
- p95 ingest／查詢超過教師可接受門檻。
- Lock timeout 或 quota error 連續超過 pilot 門檻。
- rollup lag 使教師在課堂內看不到需要的摘要。
- 單一課程或學校的事件流造成其他課程互相影響。

門檻不可在沒有目標課堂資料時假裝是通用數字；壓測使用合成資料。
