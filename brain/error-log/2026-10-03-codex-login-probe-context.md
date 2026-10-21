# Codex 登入狀態必須在相同執行環境判讀

事實：使用者本次已完成 Windows CLI 的官方裝置授權，登入程序 Successfully logged in。一般受限工具呼叫 login status 仍回覆 Not logged in；與登入程序相同的 require_escalated 環境回覆 Logged in using ChatGPT，接著唯讀短任務確實呼叫模型並成功。未讀取或複製 auth cache。

不確定性：登入前只有受限環境的 Not logged in，不能據此回推整台 Windows 的既有登入確實不存在。不同環境的憑證可見性或身分差異尚未獨立確認，不宣稱確切內部原因。

How to apply：登入狀態要標記時間、CLI 及執行環境。已授權登入的同一環境先做唯讀 status；受限環境顯示未登入時，先在已授權且同身分環境核對，再決定是否需要重新登入。不能把桌面、Windows CLI、WSL CLI 合併成單一登入結論，也不能因子程序 exit 0 就宣稱模型工具成功。

證據：本次執行輸出與某 WSL 工作站評測的 Windows／WSL 兩份試跑紀錄（保存在原工作區）。來源收據不含登入代碼或憑證。
