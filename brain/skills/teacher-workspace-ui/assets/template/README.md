# 可執行教師工作台範本

需要已存在的Node.js 22以上。沒有第三方套件，不必執行npm install。這是教師端範本，不包含學生編輯器或完整課程。

校內其他電腦連線見 [校內區網部署](../../references/school-lan.md)。附 `scripts/school-lan.mjs` 列網卡／建立本機設定／轉接專案自己的學生端伺服器；本教師範本仍只在本機提供，不會因建立區網設定檔就開放教師頁。

## 先看示範

在此資料夾開終端機，執行：

```sh
node server.mjs --demo
```

開 `http://127.0.0.1:<埠號>/teacher.html`（未指定 `PORT` 時用 8080；工作區設定的教師端埠號在 `private/config/sites.local.json` 的 `local.teacher_port`，由 AI 代為啟動時以 `PORT` 環境變數傳入），首次先設定至少12字的教師密碼，其餘留白。保存後可看到DEMO_01與DEMO_02，搜尋、篩選、展開紀錄、切到分析並選「本機摘要」送出。不需要金鑰或GAS。假資料模式禁止試算表同步，避免把假學生上傳。

直接開 `public/teacher.html` 只看版型；不發API，保存／送出停用。完整操作需上述本機服務網址。按Ctrl+C停止，修改後端後重新啟動。埠衝突時可改PORT環境變數。

## 套用正式專案

```sh
node server.mjs
```

正式模式和示範模式使用不同資料目錄；兩者教師密碼也分開設定。正式模式首次沒有學生紀錄，需接上自己的資料來源。讀 [功能與資料契約](../../references/workspace-contract.md)，將既有資料轉成recordStore格式，用後端 `store.save(record)` 存入。此範本不開放匿名學生寫入API；既有學生端和教師端的權限由原專案處理。

預設資料目錄為此範本的 `local-data/records/`；示範為 `local-data/demo/`。不要將任一資料目錄推上Git。改用其他目錄可由程式呼叫 `startWorkspace({dataDir, port})`，路徑由呼叫端決定。

## AI API KEY

1. 確認自己的服務支援非串流Responses請求與output_text，或output陣列中的message/output_text；若不同需改 `lib/teacher-analysis.mjs` 轉接。
2. 啟動前設定 `TEACHER_AI_ENDPOINT` 為完整HTTPS請求網址、`TEACHER_AI_MODEL` 為該服務的模型識別碼；不提供服務商或模型預設，也不要求特定帳號。
3. 在教師頁「連線設定」保存該服務API金鑰。金鑰不用放環境檔、網址或指令列。
4. 選學生／日期，在分析頁選「AI分析」，按送出才傳送選取紀錄和最近對話，可能產生費用。教師問題及程式摘要有長度上限，最多200筆，截斷會標示。

PowerShell例（請填你自己的端點與模型，不要把API金鑰放進命令）：

```powershell
$env:TEACHER_AI_ENDPOINT = 'https://your-provider.example/v1/responses'
$env:TEACHER_AI_MODEL = 'your-model-id'
node server.mjs
```

上例網址僅佔位示意，不可直接用。其他終端機以其環境變數方式設定相同兩個變數。實際送出包含model、store:false、stream:false、max_output_tokens及input；不保證每個服務或模型支援這些參數。範本不會自動重試付費請求。

## GAS URL與RECORD_TOKEN

1. 建立自己的Google試算表，從「擴充功能 → Apps Script」開專案，貼入 `sheets/Code.gs`。
2. 在「專案設定 → 指令碼屬性」新增 `SHEET_ID`（试算表網址 `/d/` 後的代碼）與 `RECORD_TOKEN`。token自行設定8～200碼，不使用本文件文字當密碼。
3. 執行 `initializeRecords`，完成Google要求的授權，確認出現「學習事件」分頁。
4. 部署為網頁應用程式：以你自己身分執行，存取權選適合學校政策、且能讓本機後端無互動讀取的部署方式。一般ContentService範本需允許不經Google登入的請求，以token驗證；若学校禁止此模式，不變更學校政策，改用受支援的身分／傳輸轉接。
5. 複製正式 `/exec` URL，在教師頁和相同的RECORD_TOKEN一起保存；不要用 `/dev` 測試網址。程式更新後要更新部署版本。
6. 正式模式按「同步試算表」：每批最多上傳10筆、讀回100筆；more代表還有下一批，可再次同步。不宣稱一次按鈕就拉完全部。失敗保留本機資料。

前端、後端、GAS的token門檻皆8～200碼。教師登入密碼仍至少12字。GAS token是共享密鑰，不能貼在學生頁或公開儲存庫。若串接的既有專案有更嚴的 token 規則，沿用該專案規則；本範本設定不會改既有專案。

## 測試與限制

```sh
node --test tests/*.test.mjs
```

測試使用假資料、假AI與GAS服務替身，不消耗API費用、不連正式Google。服務只在教師電腦loopback監聽；若要雲端／區網，另做HTTPS、身分和部署設定。教師密碼以scrypt雜湊保存；API金鑰和token在本機檔案是明文，能控制電腦者仍可能取得。

模型引用檢查不能驗證語意為真；工作台不自動判定學生能力、改成績、做排名或診斷。範本保留Scratch結構快照格式，其他學科需轉接資料和分析提示。
