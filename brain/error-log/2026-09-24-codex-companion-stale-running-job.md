# Codex companion 任務顯示 running，但工作程序早已不存在

- 日期：2026-09-24
- 情境：用 `codex:codex-rescue`（`--model gpt-6-sol --effort high`）做計畫書收尾審查。

## 發生什麼

- 轉發子代理回報「仍在背景執行」，其輸出檔最後一行是 `[killed]`。
- `codex-companion.mjs status <job>` 持續顯示 `running`，經過時間一路累積到 3 小時以上。
- job log 最後一筆活動停在開跑後約 3 分鐘，之後完全沒有新事件。
- 取消時 `taskkill` 回「找不到處理程序 <PID>」，也就是工作程序早已結束，只是狀態紀錄沒有更新。
- 主 session 因此空等約 2.5 小時，並一度把原因推論成「sol high 會卡死」。

## 教訓（How to apply）

1. 等 Codex 長任務時，不能只看 `status` 的 `running`。要同時看 job log 最後一筆事件的時間；超過約 15 分鐘沒有新事件，就去核對 PID 是否還活著（Windows：`tasklist /FI "PID eq <pid>"`）。
2. PID 不存在＝工作程序已中斷，不是模型在長考。直接重派，不要繼續等。
3. 在轉發輸出裡看到 `[killed]`，要馬上檢查工作程序還在不在，不能假設背景仍在跑。
4. 在 Git Bash 下執行 `codex-companion.mjs cancel` 時，內部的 `taskkill /PID` 會被 MSYS 路徑轉換弄壞。處理方式：設 `MSYS_NO_PATHCONV=1`，並且腳本路徑改用「磁碟代號＋正斜線」形式（如 `<磁碟>:/...`）。在 PowerShell 下執行則要在工作區根目錄，否則會找不到 job。
5. 「某模型會卡死」屬於推論；先排除工作程序已中斷的可能，再歸因到模型。
6. 殭屍任務會污染後續派工：任務文字裡有「再審／繼續／已吸收前幾輪」這類字眼時，`codex-rescue` 可能自動加上 `--resume-last`，接回已經死掉的對話，1 秒就以 `Codex Resume` 失敗，但轉發子代理仍回報完成（沒有結果內容）。要開新審查時，在任務開頭明寫 `--fresh`。收到沒有結果內容的完成通知時，先用 `status` 看 `Latest finished` 的 Kind 和 Phase。
7. 2026-09-25 再次確認：在本工作區（工作區所在磁碟）派 `codex-rescue` 做「需要寫檔」的工作，先由主 session 建好目錄也沒用，`apply_patch` 仍回 `Failed to write file`。需要寫入工作區磁碟的實作節點，派工前就改排 Claude `executor`（或主 session），Codex 只排唯讀的審查／驗證；計畫書的 owner 欄要在規劃時就這樣寫，不要等失敗三次才改。
