---
name: static-file-script-path-and-api-mode
description: 靜態頁面內部資源使用相對路徑，直接開檔時不可嘗試呼叫伺服器 API
type: feedback
triggers: [ERR_FILE_NOT_FOUND, file URL, app.js, 靜態頁面, 本機伺服器]
updated: 2026-09-16
---

# 直接開啟 HTML 時要能顯示，伺服器功能要明確說明

## 使用者回報

直接開啟 `web/index.html` 時，`/web/app.js` 被解析成磁碟根目錄路徑，造成 `ERR_FILE_NOT_FOUND`；`file:` 頁面呼叫 `/api` 又觸發瀏覽器的來源限制。

## How to apply

1. HTML 內部腳本、樣式與圖片一律優先使用 `./` 相對路徑。
2. 前端先辨識是否由 `http:` 或 `https:` 提供；`file:` 模式不可發出 API 請求。
3. 直接開檔模式仍須顯示完整靜態活動內容，並清楚說明互動回饋需從本機伺服器網址開啟。
4. 驗收要分開檢查靜態內容可讀與 localhost 完整功能，不能把其中一個當成另一個。
5. localhost 完整功能須用 CDP 檢查主控台例外、失敗請求、DOM 與實際送出流程。
