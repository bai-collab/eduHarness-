# Windows AppX 與容器衝突參考

本文件是 `claude-repair` 的進階參考。先完成主流程的授權邊界與唯讀盤點，再使用這裡的對照；它不是讓代理程式直接批次終止程序的腳本。

## 唯讀資料欄位

建議只收集下列欄位，並在對外報告時遮罩使用者名稱與不必要的路徑：

| 對象 | 欄位 |
|---|---|
| 程序 | `ProcessId`、`Name`、`ParentProcessId`、`ExecutablePath`、`SessionId`、`CreationDate` |
| 服務 | `Name`、`Status`、`StartType`、`ProcessId` |
| AppX | `Name`、`PackageFullName`、`Version`、`InstallLocation`、manifest 路徑 |
| 事件 | 時間、事件 ID、HRESULT、套件版本、錯誤摘要 |
| Job | 名稱、容器版本、使用者／服務角色、成員 PID 與成員名稱 |

PowerShell 的 `Get-Process`、`Get-CimInstance Win32_Process`、`Get-Service`、`Get-AppxPackage` 與 `Get-WinEvent` 可用於這些唯讀欄位。若用 `Get-CimInstance Win32_Process`，不要選取 `CommandLine`。不要把 `Get-Job` 的結果當成 Windows AppX 容器 Job。

## 事件對照

事件文字與版本可能因 Windows 版本不同而略有差異，因此把下表當作假設線索，不是單一事件的定論：

| 事件／值 | 可支持的判斷 |
|---|---|
| AppModel-Runtime 208 | 建立套件程序時失敗；需再看 HRESULT 與上下文 |
| AppModel-Runtime 215 | 建立或轉換 Desktop AppX container／Job 時失敗 |
| AppModel-Runtime 217 | 容器終止；可用來確認生命週期是否有收束 |
| AppModel-Runtime 210／211 | 容器建立或加入程序的生命週期線索 |
| `0x80070020` | Windows 分享違規；可能是真正檔案鎖，也可能是容器／Job 佔用衝突 |

把事件時間與套件版本對齊。單獨看到 `0x80070020` 時，不要把「檔案被誰開啟」寫成已證實。

## Container Job 辨識

唯讀列舉到的名稱通常具有類似下列結構：

```text
Container_Claude_<version>_x64__<token>-S-<user-sid>
Container_Claude_<version>_x64__<token>-PackagedService
```

這些只是模式，不是固定名稱。請用目前機器實際列舉結果比對：

- 舊版本、使用者 SID 結尾的 Job 可能是待調查的殘留容器，但仍須逐一查看成員。
- `-PackagedService` 代表服務脈絡的容器；不能因它看起來像 Claude 就終止。
- Job 成員可能包含目前的開發工具或其他仍有未儲存工作的程序。只有在成員、父子關係、路徑、啟動時間與使用者明確確認都吻合時，才可列入目標。
- 若無法取得可靠的 Job 成員清單，就停在證據不足，不要用程序名稱猜測。

列舉工具若需要 Windows 原生 API，先做唯讀版本並由使用者在自己的系統管理員 PowerShell 執行。不要把固定磁碟代號、使用者名稱、SID、版本號或 PID 寫入 Skill。

## AppX 註冊的脈絡限制

重新註冊目前 manifest 屬於相對保守的修復，但必須在受影響的使用者脈絡執行。SYSTEM、沙箱帳號或另一個 SID 的 PowerShell 可能回報權限／部署錯誤；這不一定代表套件本身壞掉。

執行前確認：

1. 使用者身分是受影響帳號，且 PowerShell 已提升權限。
2. manifest 來自目前安裝的 AppX `InstallLocation`，不是猜測的舊版本資料夾。
3. 沒有把命令列、Token 或使用者私有資料寫入報告。
4. 執行後仍需重新啟動並驗證視窗與事件；成功回傳不是最終證據。

## PowerShell 輔助腳本防錯

產生或修改暫存 `.ps1` 時，先確認檔案只含 PowerShell 原始碼，沒有 ``` 圍欄、說明段落或編碼損壞的引號。可做純剖析，不會執行腳本：

```powershell
$source = Get-Content -LiteralPath $scriptPath -Raw
[void][scriptblock]::Create($source)
```

若用 Hashtable 保存預期程序，`$expected.Keys` 是 `KeyCollection`，不是 `Get-Process -Id` 可直接接受的整數陣列。應先明確轉型：

```powershell
$expectedIds = @($expected.Keys | ForEach-Object { [int]$_ })
Get-Process -Id $expectedIds -ErrorAction SilentlyContinue
```

終止前要逐 PID 重新取得並比對名稱、父 PID、路徑與 Job 角色。終止後允許程序已不存在，不要把「查不到」當成腳本失敗；用 `-ErrorAction SilentlyContinue` 重查並記錄實際結果。

若 PowerShell 腳本的解析或目標驗證失敗，整個動作都應停止。不可為了讓腳本繼續而移除驗證、改成名稱萬用字元或直接使用 `Stop-Process -Name`。

## 授權與復原

終止前的最小確認應列出精確集合與影響，例如：

```text
即將終止 N 個已重新核對的程序：PID／名稱／原因如下。
這可能關閉目前工具並遺失未儲存工作；不會處理清單外的程序。
是否只終止這一組？
```

若使用者拒絕，請使用者先自行正常關閉可關閉的程式，再重新做唯讀盤點。若流程曾停止服務，保存原本的 Status／StartType，驗證完成後只恢復自己改過的狀態；不要擅自把原本停用的服務改成 Automatic。

Reset 或重裝前，先停下來取得新的同意，說明應用程式資料可能遺失，並提供使用者可接受的備份與復原方式。這兩個動作不屬於「終止舊容器」授權的延伸範圍。

## 最終驗證

至少確認：

- 目前使用者能啟動 Claude，主視窗有可互動內容。
- 同一時間範圍內沒有新的 208／215 失敗事件。
- 舊版本使用者容器不再持有已清理的目標成員；服務容器仍依預期存在。
- 服務狀態與動作前快照一致，除非使用者明確選擇新的設定。
