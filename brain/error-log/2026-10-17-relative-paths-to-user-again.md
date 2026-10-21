# 再犯：對使用者列檔案位置仍用相對路徑（第 2 次被糾正）

- 日期：2026-10-17
- 情境：某研究計畫（P1～V1）回報時，對使用者列出報告、腳本、收據、啟動說明都寫 repository-relative path；P4 啟動說明的 `Set-Location` 還留 `<repo>` 佔位，使用者無法直接複製執行。
- 使用者指出：先前已說過要給完整路徑。
- 既有規則：`brain/knowledge/user-facing-absolute-paths-copyable.md`（2026-10-16 建立）；前次紀錄：`brain/error-log/2026-10-16-handoff-relative-paths-not-copyable.md`。

## 錯誤

動工前的記憶檢索只用了任務主題關鍵詞，沒有檢索「回覆格式」類規則；同一主題第 2 次被糾正。

## How to apply

- 每次回覆列出檔案、資料夾、收據或要使用者執行的指令前，先自問：「這是給使用者看或複製的嗎？」是 → 用當下解析的絕對路徑（Windows 反斜線格式），每個路徑獨立一個 ```text 區塊。
- 要使用者執行的指令與給使用者的啟動說明（不屬可攜規範的 `projects/`、`analysis/` 文件），`cd`／`Set-Location` 寫絕對路徑，不留 `<repo>` 佔位。
- 計畫書拓樸圖、可攜規範、程式內部引用仍用相對路徑。
- 已達「同一主題被糾正 ≥2 次」：依 AGENTS.md 提議提醒型守門，待使用者核准才啟用。
