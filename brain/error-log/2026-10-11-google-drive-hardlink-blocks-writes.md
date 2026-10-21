# Google Drive 同步會在工作區建立硬連結，擋下投影並擴大寫入範圍

- 日期：2026-10-11
- 事實：
  - Google Drive 上傳時，會把剛修改的檔案硬連結到根目錄下雲端同步的上傳暫存資料夾（`fsutil hardlink list` 可見兩個路徑；Node `lstat().nlink` 為 2）。
  - Harness 的 Skill 投影指令（`project --apply`）因此報 `SKILL_PROJECTION_REGISTRY_HARDLINK_FORBIDDEN`（投影模組的 registry 檢查）。
  - 只把檔案複製成新檔、取代原路徑，Drive 幾秒內會再次建立硬連結；單獨解連結無效。
  - 同一天也在派工的 WriteDir 內看到 `.env`、`ok.txt` 被硬連結；子程序編輯硬連結檔會連帶改到範圍外的同一份內容。
- 有效處置：在同一個 PowerShell 指令內「複製成新檔並取代 → 立刻執行 `project --apply`」，搶在 Drive 重新連結前完成；事前先備份並比對 SHA-256。
- How to apply：
  1. 遇到 `*_HARDLINK_FORBIDDEN` 或 nlink>1，先用 `fsutil hardlink list` 看另一路徑；在雲端同步的上傳暫存資料夾下就是 Drive，不要判成攻擊或程式錯誤。
  2. 優先請使用者暫停 Drive 同步再執行；使用者同意時可用上面的同指令搶跑法。
  3. 派工、快照等寫入範圍檢查要拒絕 link count > 1 的檔（某派工腳本待修）。
  4. 長期建議：把本工作區排除在 Drive 同步外，或只同步 `outputs/`。
