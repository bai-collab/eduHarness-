# 學習者行為與挑戰驗收紀錄

> 使用說明：這是空白審查模板。每一個結論都要填證據來源；未知就寫 `unknown`，不能用模板文字冒充已完成驗證。

## 1. 範圍與結果

| 欄位 | 紀錄 |
| --- | --- |
| `review_status` | `intake-only`／`behavior-hypothesis-ready`／`challenge-ladder-ready`／`dom-pass`／`dom-blocked`／`chrome-pass`／`dom-only`／`chrome-blocked`／`teacher-review-required` |
| 學習者群組 |  |
| 年段／教材來源 |  |
| 學習目標 |  |
| 遊戲情境 |  |
| 本次驗收範圍 |  |
| 本機 URL |  |
| 不在範圍內的項目 |  |

## 2. 證據台帳

| ID | 類型 | 可觀察紀錄 | 來源 | 信心 |
| --- | --- | --- | --- | --- |
| E-001 | `dom_measurement`／`interaction_trace`／`screenshot_visual`／`teacher_report`／`student_report`／`research_reference`／`inference` |  |  | `observed`／`reported`／`inferred`／`unknown` |

## 3. 行為假設

| ID | 觀察證據 | 可能原因 A | 可能原因 B | 可觀察預測 | 最小測試 | 結果／決策 |
| --- | --- | --- | --- | --- | --- | --- |
| H-001 |  |  |  |  |  | `pending`／`supported`／`refuted`／`inconclusive` |

禁止把「不會」「不專心」「沒興趣」當成未驗證的原因結論；改寫成可測試的介面或任務假設。

## 4. 挑戰階梯

| 階段 | 進入條件 | 目標行為 | 只新增的一種負荷 | 支援 | 成功條件 | 回退規則 |
| --- | --- | --- | --- | --- | --- | --- |
| D0 |  |  |  |  |  |  |
| D1 |  |  |  |  |  |  |
| D2 |  |  |  |  |  |  |
| D3 |  |  |  |  |  |  |
| D4 |  |  |  |  |  |  |
| D5 |  |  |  |  |  |  |

國小原型預設 `time_pressure: none`；記錄闖關經過時間即可，不加入倒數懲罰。

## 5. 答案洩漏審查

| ID | 表面 | 檢查 | 結果 | 修正／保留理由 |
| --- | --- | --- | --- | --- |
| L-001 | 可見文字／ARIA／tooltip／選取樣式／提示／debug |  | `pass`／`revise`／`block`／`unknown` |  |

必查：選卡不亮目標、沒有直接 mapping、句塊初始打亂、提示不直接替學生作答、disabled 有下一步而不是靜默卡住。

## 6. 狀態與恢復矩陣

| 狀態 | 學習目標 | 主要下一步 | 可見線索 | 被鎖控制項的原因 | 卡住後恢復 | 成功轉移 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## 7. DOM gate

| Check ID | 方法／selector／測試 | 實際值 | 預期值 | 結果 | 證據產物 |
| --- | --- | --- | --- | --- | --- |
| DOM-01 |  |  |  | `pass`／`block`／`unknown` |  |
| DOM-02 |  |  |  |  |  |
| DOM-03 |  |  |  |  |  |
| DOM-04 |  |  |  |  |  |
| DOM-05 |  |  |  |  |  |
| DOM-06 |  |  |  |  |  |
| DOM-07 |  |  |  |  |  |
| DOM-08 |  |  |  |  |  |

DOM 結果：`not-run`／`pass`／`blocked`。只要核心列有 `block`、`unknown` 或無證據，就不能進入 Chrome gate。

## 8. Chrome gate

| Check ID | viewport／操作 | 實際結果 | 截圖／logs／產物 | 結果 |
| --- | --- | --- | --- | --- |
| CHR-01 |  |  |  | `pass`／`block`／`unknown` |
| CHR-02 |  |  |  |  |
| CHR-03 |  |  |  |  |
| CHR-04 |  |  |  |  |
| CHR-05 |  |  |  |  |
| CHR-06 |  |  |  |  |
| CHR-07 |  |  |  |  |

Chrome 結果：`not-run`／`pass`／`blocked`／`not-available`。若 DOM 未通過，填 `blocked-by-dom`，不要假稱已完成視覺驗收。

## 9. 決策、未知與下一步

- 決策：
- 必須修正的阻塞：
- 可以延後的改善：
- 需要教師裁決的內容：
- 尚未解決的不確定性：
- 下一個最小測試：
