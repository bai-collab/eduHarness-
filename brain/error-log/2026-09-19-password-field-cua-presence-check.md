---
name: password-field-cua-presence-check
description: CUA 自動化讀取密碼欄位可能把已輸入值誤判為空白
type: errorlog
triggers: [API Key, password, 密碼欄, 金鑰, Cookie, CUA, Playwright]
updated: 2026-09-19
---

# 密碼欄位的存在檢查不可直接依賴自動化讀值

## 事件

使用 CUA／Playwright 對 `type=password` 欄位執行 `Boolean(element.value)`，得到空白結果；但瀏覽器畫面已顯示遮罩圓點，頁面自己的狀態也能確認欄位已存在內容。這個讀值結果不能拿來判定使用者沒有輸入金鑰。

## Why

瀏覽器自動化層會遮蔽密碼欄位內容，避免代理讀取敏感資料。把這個受保護的讀值當成一般文字欄位檢查，會造成錯誤診斷並要求使用者重貼金鑰。

## How to apply

涉及 API Key 或密碼時，不讀取欄位值，也不以自動化讀值的布林結果判定空白。改用頁面明確顯示的非敏感狀態、重新載入後的功能結果、Cookie 存在的應用層狀態，以及 CDP 只檢查標頭名稱／狀態碼的證據。若需測試保存流程，使用隔離來源的無害測試字串並在測試後清除。
