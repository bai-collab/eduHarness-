---
name: ui-visual-cdp-gate
description: 教育 Web 介面修改的預設視覺與 CDP 驗收門檻
type: knowledge
triggers: [視覺審查, 視覺化, CDP, 瀏覽器驗收, UI, Web, app.js, localhost]
updated: 2026-09-16
---

# 介面修改的視覺與 CDP 預設門檻

## Why

只確認 DOM 存在、可及性樹有文字或自動測試通過，不能證明使用者看得懂、點得到或瀏覽器資源真的載入。教育介面還要確認資料內容、學生任務、狀態變化與回饋彼此一致。

## How to apply

每次涉及 Web 介面新增、修改或修 bug，動工前先查詢並寫出：

1. 使用者第一眼看到什麼、資料代表什麼、下一個操作是什麼。
2. 桌面與窄螢幕的版面區塊、最小點擊區、文字換行與重疊風險。
3. 若有互動，至少列出初始、操作後、取消／錯誤恢復三個可見狀態。

完成後固定做兩層驗收：

1. 視覺／互動：用瀏覽器實際操作，檢查文字、樣式、焦點、狀態、輸入與回饋；必要時保存截圖或可稽核的版面數值。
2. CDP：在實際 localhost 頁面重新載入，檢查 `Network.loadingFailed`、HTTP 失敗、`Runtime.exceptionThrown`、主控台錯誤、腳本與 API 狀態、DOM／計算後樣式、窄螢幕版面及至少一條真實操作請求。

AX／Playwright 可作為操作工具，但不能把它們的成功當成 CDP 驗證；若尚未做 CDP，回報必須明確寫「CDP 未驗證」。

## 可執行的 Harness 閘

若要讓規則真的阻擋漏驗，UI 任務的 `verify` 必須要求已完成執行紀錄與三類結構化證據。每筆證據都要能指向工作區內的 JSON 檔，檔案內容要有 `executed: true`、`status: "passed"`、同一 `run_id`、實際目標、觀察時間與通過檢查；不能用一般文件、目錄或只含關鍵字的字串代替。Simple 流程也不能跳過這個閘。
