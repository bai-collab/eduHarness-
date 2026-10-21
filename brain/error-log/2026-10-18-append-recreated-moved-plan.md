---
name: append-recreated-moved-plan
description: 用 >> 附加 checkpoint 時，計畫書已被另一個 session 移到 planned/complete/，附加指令在原路徑重建了一份只有一行的殘檔
type: errorlog
triggers: [checkpoint, 計畫書, planned/complete, 附加, ">>", printf, 移動, 多 session, 殘檔]
updated: 2026-10-18
---

主 session 回寫 click-demo 計畫的 W1 checkpoint 時，用 `printf '…' >> planned/<計畫>.md`。同一時間（20:15）另一個 session 已依使用者確認把該計畫移到 `planned/complete/`，並寫好完整的 W1 紀錄。`>>` 在檔案不存在時會建立新檔，結果在 `planned/` 留下 289 bytes、只有一行的殘檔；後續「流程」分頁自動挑計畫時會選到它（顯示「沒有可辨識的節點」），由 S3 執行者回報才發現。

**根因：** 把「附加」當成只會修改既有檔；沒有先確認目標仍存在。多個 session 同時處理同一份計畫時，路徑可能在兩次操作之間改變。

**How to apply:**
1. 回寫 checkpoint 前先確認計畫檔存在（`[ -f <檔> ] || { echo MISSING; exit 1; }`）；不存在就先找 `planned/complete/`、`planned/shelved/` 下的同名檔，再決定寫哪裡或要不要寫。
2. 用 Python／Edit 修改既有計畫時同樣先檢查存在；不要用會「不存在就建立」的寫法回寫 checkpoint。
3. 發現自己造成的殘檔：先比對正本是否已含同樣資訊，再把殘檔移到該任務的 `workspace/<主題>/backup/`（不直接刪），並在現行計畫 checkpoint 記錄。

證據：殘檔已移至原工作區該任務的備份資料夾（SHA-256 前綴 `fccbdf34…`）；已移至 `planned/complete/` 的正本末行即另一 session 的 W1 紀錄；處置記於當時現行計畫的 S3-P3。
