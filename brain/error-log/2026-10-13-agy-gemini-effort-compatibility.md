---
name: agy-gemini-effort-compatibility
description: AGY 1.3.4 的 Gemini 模型不接受額外 effort，替代呼叫仍可能遇到服務 503
type: errorlog
triggers: [AGY, Gemini, effort, review-loop, 503]
updated: 2026-10-13
---

## 事實

某模型控制台功能已取得使用者本次十份限定來源的唯讀外審授權。正式 `review-loop.mjs` 的 AGY 呼叫附 `--model gemini-3.1-pro-high --effort high`，在 AGY 1.3.4 回 `invalid model selection ... --effort is not supported`，沒有 init.model、回覆或模型執行（num_turns=0、usage=0）。

在相同非沙箱執行環境查 `agy models`，Gemini 選項為 `gemini-3.8-flash-high`、`medium`、`low`。任務限定相容重試沿用正式 runLoop 的固定候選、接受閘與排他鎖，只移除不支援的 effort，記下完整原／實際 argv。第二次回 `Eligibility check failed: UNAVAILABLE (code 503): The service is currently unavailable.`，仍沒有 init.model 或審查回覆。

收據（兩份）與重試工具保存在原工作區（未隨附）。原共用 Harness 未修改，原設計三次 REVISE 帳本未變。

## How to apply

- 新任務重新核對版本與同環境可用模型；不要只依歷史模型清單判斷。Gemini 模型名稱中的 High 不代表還接受 `--effort high`。
- 既有入口若附加不支援參數，先記為參數相容問題。已授權替代策略只作有限重試，保留舊收據及實際 argv，不移除唯讀、來源涵蓋、身分或排他鎖閘。
- 503 服務不可用不是登入證據；沒有有效回覆與 init.model 時外審為 INCONCLUSIVE／審查未完成。不得用模型清單、本機檢查或退出碼補成通過。
- 沙箱內查 models 曾出現無法寫 AGY 自身日誌及身分錯誤；同環境非沙箱查詢成功。這不能泛化為使用者未登入。
