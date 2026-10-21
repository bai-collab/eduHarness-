# 工作台 400：舊 server 與新版前端契約不一致

## Error

真人工作台送出作答時，瀏覽器對 `api/workbench/turn` 顯示 HTTP 400。

## Evidence

- `http://127.0.0.1:5183/api/workbench/tasks` 曾回傳沒有 `material_sequence` 的舊任務資料。
- `http://127.0.0.1:5184/api/workbench/tasks` 回傳目前版本的步驟資料（含新版新增的步驟與補充項目）。
- 前端目前會送出 `flow_enabled`、`step_cursor`、`completed_step_ids`、`student_artifacts` 等步驟狀態欄位；舊版 server 未載入這份欄位契約，因此可能以 400 拒絕。
- 重啟同一專案的 `5183` server 後，該 port 回傳最新 `material_sequence`；沒有頁面 Key 時，`/api/workbench/turn` 正確回傳 401，表示已先通過契約版本而進入 Key 檢查。

## Root cause

本機同時存在不同時間啟動的工作台 server；前端檔案已更新，但 `5183` 仍由舊版 Node 程序提供 API。

## Fix

停止已確認佔用 `5183` 的舊專案 server，從目前專案目錄重新啟動最新 `server.mjs`。沒有修改使用者資料、API Key 或教學紀錄。

## How to apply

更新工作台的 `server.mjs`、任務資料或前端契約後，重啟正在使用的本機 server；先以 `/api/workbench/tasks` 確認有 `material_sequence`，再開啟或重新整理工作台。若沒有頁面 Key，預期回合 API 應是 401，而不是用環境 Key 代替。
