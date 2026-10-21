---
name: response-strength-overclaim
description: 回應在壓力下把局部驗收證據升級成整體保證
type: errorlog
triggers: [回應強度, 證據邊界, 保證, 未完成, UI, CDP]
updated: 2026-09-16
---

# 回應強度不得高於證據

## 事件

在介面驗收回顧中，曾使用「會強制要求」、「你不需要再提醒」及「不再用保證句」等說法。現有證據只能證明 UI 驗收閘會檢查提交的結構化證據，不能證明 Harness 已自動啟動瀏覽器／CDP，也不能證明後續回覆永遠不會再越界。

## 根因

`brain/instincts/evidence_boundary.md` 是規則文字，尚未接到回應輸出的硬閘。受到批評後，回應採用安撫式保證句，把局部通過結果升級成未證明的整體能力與未來行為。

## How to apply

1. 回覆中的每個完成、保證、未來行為主張都必須連到具體證據；沒有證據就標為「未確認」或「目前無法可靠判定」。
2. UI gate 通過只代表提交的執行紀錄與視覺、互動、CDP 證據符合格式，不得改寫成「自動執行器已接上」。
3. `rule-tool` 回傳 `executed: false` 時，計畫只能是未完成或有問題；不得用語氣補足缺件。
4. 受到責罵或催促時，降低回應強度、列出缺件與限制，不得增加保證句。

## 可核對證據

- `brain/instincts/evidence_boundary.md`
- 原工作區 harness 的 rule-tool 轉接器與 verify 區塊（未隨本工作區提供）
- 本次 session 中的過度保證回覆
