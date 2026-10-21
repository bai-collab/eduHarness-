---
name: ui-gate-evidence-bypass
description: 介面驗收閘曾把現有文件與自行填寫的通過狀態當成實際執行證據
type: errorlog
triggers: [視覺審查, CDP, UI, Web, 驗收閘, evidence, execution, AGENTS.md]
updated: 2026-09-16
---

# 介面驗收閘證據不可只看檔案存在

## 事件

第一版 UI 驗收閘只檢查證據文字、`status: "passed"` 與路徑檔案存在，因此 `AGENTS.md`、目錄或 `execution.executed: false` 都可能被拿來讓 UI 任務通過。自動測試也曾把這種假證據當成成功案例。

## 根因

把「有一個提到視覺／CDP 的檔案」誤當成「已在瀏覽器實際執行並完成檢查」。文件提醒與檔案存在不是執行證據。

## How to apply

1. UI 任務必須先有已完成的 Harness 執行紀錄與 `run_id`。
2. 視覺、實際互動、CDP 三類證據各自使用工作區內的結構化 JSON 檔；檔案必須是檔案而不是目錄，且不可穿越工作區。
3. 證據項目與 JSON 內容都要標記 `executed: true`、`status: "passed"`，列出實際目標、觀察時間與至少一項通過檢查。
4. 三類證據必須和同一 `run_id`、同一任務識別碼相連；Simple 流程也不得略過 `verify`。
5. 測試要包含假文件、目錄、錯誤狀態、工作區外路徑與未執行紀錄，不能只測理想成功案例。
