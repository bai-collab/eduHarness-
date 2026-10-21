# Windows Git 不接受 Node 的裝置命名空間空裝置路徑

事實：本次合成效能測試以 Node os.devNull 設定 GIT_CONFIG_GLOBAL，Windows Git 在初始建庫前回覆 Invalid argument。run-01/failed.json 保存原錯誤與來源摘要。獨立同環境測試 GIT_CONFIG_GLOBAL=NUL 後 git config --global --list 成功；限定程式改為 Windows NUL、Linux os.devNull，run-02 完成四條件。

How to apply：Node 能使用的系統裝置路徑不保證外部 Git 也接受。先用相同工具實測，依平台採其支援的空設定來源；只調子程序環境，不清除或覆寫使用者 Git 設定。保留首輪失敗與全新重跑收據，不把初始化失敗當作平台速度差。

證據：某 WSL 工作站評測的 run-01 失敗紀錄、run-02 結果與限定程式（保存在原工作區）。
