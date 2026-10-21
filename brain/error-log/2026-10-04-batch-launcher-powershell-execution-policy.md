# 批次入口被PowerShell執行原則攔下

事實：使用者直接執行本機start-next-batch.ps1，收到PSSecurityException與UnauthorizedAccess，未啟動批次。此前交付只提供直接執行方式，未處理這台電腦的指令碼限制。

方法：以powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File啟動指定本機入口；執行原則僅限該子程序，不永久修改CurrentUser或LocalMachine。群組原則仍優先，若仍阻擋，先查看Get-ExecutionPolicy -List，不擅自取消組織原則。

驗證：本次以同一Windows PowerShell命令加-DryRun，exit=0，正確輸出PROJECT與全新batch命令；未讀取金鑰、未啟動模型。移除-DryRun才由使用者實際啟動，仍須手動yes。

How to apply：交付本機PS入口時提供完整單次會話啟動命令，並先DryRun驗證；不要假定直接呼叫ps1一定可執行，不為此永久降低系統原則。

官方依據：https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies?view=powershell-5.1
