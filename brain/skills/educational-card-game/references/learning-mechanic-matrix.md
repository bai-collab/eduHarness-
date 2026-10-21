# 學習—卡牌機制矩陣

每一列代表一個可觀察的學習目標，不以「完成一關」代替學習證據。

## 欄位

| 欄位 | 規則 |
|---|---|
| `objectiveId` | 穩定的小寫 ID，與 card catalog、事件與報表一致。 |
| `objective` | 使用可觀察動詞描述，不只寫「了解」。 |
| `observableBehavior` | 學生在遊戲中實際做出的行為。 |
| `cardMechanic` | 分類／配對、排序／流程、情境決策、資源管理或合作組牌。 |
| `correctEvidence` | 能判斷表現的答案、順序、理由或教師核准證據。 |
| `misconceptionTags` | 可重用的錯誤概念標籤。 |
| `feedback` | 正確、錯誤、提示與不揭露答案的理由。 |
| `remediation` | 錯誤後的下一個較小任務、例子或重新嘗試。 |
| `eventCodes` | 只記錄必要的短代碼，不保存完整題幹或自由文字個資。 |
| `successMeasure` | 次數、正確率、理由品質、提示依賴或教師觀察 rubric。 |
| `source` | 教材頁碼、教師輸入或核准備註。 |

## 空白模板

| objectiveId | objective | observableBehavior | cardMechanic | correctEvidence | misconceptionTags | feedback／remediation | eventCodes | successMeasure | source |
|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |  |

## 追問順序

1. 這個目標能否在一局中看見？
2. 學生的哪個操作能證明或反駁它？
3. 錯誤時要讓學生看到哪個理由，而不是只顯示「錯誤」？
4. 下一張補救卡要降低哪一個負荷？
5. 保存的事件能否支持教師下一個教學決定？

## 完成門檻

- 每個目標至少一個可觀察行為與正確證據。
- 每個錯誤證據至少一個 misconception tag 與 remediation。
- 每張卡可回溯到來源或教師核准。
- 事件代碼不包含姓名、PIN、完整答案文字或未經核准的自由文字。
- 遊戲分數與學習證據分開欄位。
