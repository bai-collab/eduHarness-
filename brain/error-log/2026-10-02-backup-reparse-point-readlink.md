---
name: backup-reparse-point-readlink
description: Windows 重新解析點不一定可用 os.readlink 讀取，備份盤點需保留原始描述
type: errorlog
triggers: [backup, reparse, readlink, Windows]
---

# 備份盤點：重新解析點不一定是一般符號連結

事實：本機磁碟備份盤點以 FILE_ATTRIBUTE_REPARSE_POINT 偵測特殊項目後呼叫 os.readlink，首次子程序回傳 ValueError: not a symbolic link 並 exit 1。來源保持唯讀，目的地只有本次未完成的清單。

**Why:** 重新解析點包含多種 Windows／WSL 檔案表示方式；標為重新解析點不代表一般連結 API 能識別。只捕捉 OSError 也不足以涵蓋 ValueError。

**How to apply:** 盤點先保存 reparse tag；一般目標 API 失敗時，以不追蹤目標的 Windows API 讀取 FSCTL_GET_REPARSE_POINT 原始描述。保留原始 bytes 或讀取錯誤，不推測目標、不略過後宣稱完整。未完成清單可在同一個本任務目的地重建，須記錄修復原因並重新驗證。

證據：某磁碟備份計畫的 P1 中斷 checkpoint 與本輪盤點工具回傳（保存在原工作區）。

## 同任務的暫時性命令組裝修正

接續封存命令重用 Windows API helper 時，漏帶 ctypes 與 wintypes 匯入；回傳 NameError，發生在開啟接續寫入前。已保存封存前綴未變，補齊匯入後在相同目的地續作。

**How to apply:** 暫時性命令重用 helper 時要一併核對其 imports；初始化與狀態核對放在取得寫入權前。初始化失敗不得宣稱接續已啟動，也不得丟棄已保存的前綴。
