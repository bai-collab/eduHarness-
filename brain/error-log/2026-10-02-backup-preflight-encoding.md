# 備份清空前紀錄的管線編碼

事實：PowerShell here-string 傳入暫時性 Python 命令後，清空前紀錄的中文 user_confirmation 出現替代字元；674401 個來源項目與備份證據核對無差異，來源未改動，格式化尚未啟動。

How to apply：跨 PowerShell／Python 管線傳中文時明確設定雙端編碼，或在暫時性程式中用 ASCII Unicode 跳脫，輸出檔固定 UTF-8。出現問題先保存原紀錄，再於同一授權目標修復文字；不得修改資料核對數字或把受損的文字當成授權來源。授權必須來自使用者訊息。

本次修復只修改確認文字與新增修復說明；原紀錄保存為 clear-preflight-before-encoding-repair-01.json，來源核對結果保留不變。證據：某磁碟備份計畫的 P5 checkpoint 與本輪工具輸出（保存在原工作區）。
