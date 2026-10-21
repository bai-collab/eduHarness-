---
name: cloudflare-workers-redeploy
description: 重新部署使用者自己的 Cloudflare Workers 網站（通用版；站台資訊全部讀工作區設定 `sites.<site_id>.*`，不寫死帳號、子網域或網址）。觸發：使用者說「重新部署 <站台>」「把新內容放上 Cloudflare」「<站台> 上線／更新正式版」，並能指出是哪個站台（site_id）。做法：讀設定確認站台 → 確認內容與清單 → 本機測試 → commit → 使用者核准後 wrangler deploy → 線上唯讀檢查 → 回報網址與結果。反觸發：只在本機開服務測試（直接 wrangler dev）；GitHub push／公開 repo；修改站台功能本身（先走一般開發與審查流程）；改 Cloudflare 後台設定、DNS 或帳號；啟用付費功能。
---

# 重新部署 Cloudflare Workers 網站

目的：把工作區內某個站台專案部署到使用者的 Cloudflare Workers（正式版），每次結果可稽核、網址不變。本 Skill 只定義流程與邊界；站台專案自己的建置、測試與部署腳本以**該專案文件**為準。

## 設定

本 Skill 不寫死帳號、子網域、網址、埠號。設定來源順序：① 工作區根目錄 `private/config/sites.local.json`（本機實際值，不上傳）→ ② `config/sites.example.json`（公開範本，只有佔位值）。值含 `<…>` 或 `example` 字樣即視為**缺值**；缺值時**停下來問使用者**，不猜、不從舊計畫書或舊對話沿用。

先確定 `site_id`（使用者說的站台名稱對應 `sites` 底下哪一個鍵；對不上或有多個候選就問）。以下鍵都在 `sites.<site_id>.` 之下：

| 設定鍵 | 用途 | 預設值 |
|---|---|---|
| `project_dir` | 站台專案資料夾（相對工作區根目錄） | 無 |
| `worker_name` | 主站 Worker 名稱（對應 `wrangler` 設定的 `name`） | 無 |
| `subdomain` | 帳號的 `workers.dev` 子網域 | 無（缺值就問使用者；不要猜） |
| `main_url` | 主站正式網址（部署後線上檢查用） | 無 |
| `deck_host_url` | 選配：第二個 Worker（例如簡報／靜態內容主機）的正式網址 | 無（缺值＝只有一個 Worker） |
| `oauth_origins` | 選配：需登記在 OAuth 用戶端「已授權的 JavaScript 來源」的網址清單 | 無 |
| `reserved_ports` | 使用者自己常開的本機埠；測試時不得佔用或終止 | 空清單 |
| `secrets_env` | 部署會用到的**環境變數名稱**（例如 `CLOUDFLARE_API_TOKEN`）；只存名稱，**絕不存值** | 空清單 |

## 0. 前提與邊界

- **部署是對外變更**：每次實際部署前都要使用者在當次對話明確同意；使用者說「重新部署 <站台>」本身即視為同意部署，但若本次還改了程式（不只是內容），先停下說明改了什麼。
- 網址固定（跟著 Worker 名稱，不跟部署次數）：主站 `main_url`；有第二個 Worker 時是 `deck_host_url`。
- 不 push、不建 repo、不改 Cloudflare 後台設定或 DNS、不讀取或印出任何金鑰；後台已設定的變數與密鑰由管理者在後台管理，部署流程不得清掉（專案的 wrangler 設定應保留既有變數）。
- 金鑰只用環境變數（名稱見 `secrets_env`）；沒有就請使用者自己執行 `wrangler login`，不要代登、不要把 token 寫進任何檔案或命令列歷史。
- 只用 repo 相對路徑；不碰 `reserved_ports` 列的埠；只終止自己啟動並記錄 PID 的程序，不以名稱批次終止。

## 1. 動工前

1. 依工作區規則檢索記憶：`grep -ril "deploy\|wrangler\|<site_id>" brain/error-log brain/knowledge`，命中的教訓當硬約束。
2. `git -C <project_dir> status -s`：有未提交的改動先問使用者是不是要一起部署。
3. 在 `<project_dir>` 執行 `wrangler whoami`（用專案內安裝的 wrangler，例如 `node node_modules/wrangler/bin/wrangler.js whoami`）：確認已登入；沒登入請使用者自己登入。
4. 讀專案自己的部署文件（`README`、`docs/`、`package.json` 的 `scripts`）：找出建置清單、測試、部署指令與首次部署所需旗標；找不到就問使用者，不自行發明指令。

## 2. 更新內容

依專案文件更新要上線的內容（例如新增或更新內建資料夾）。更新既有內容時依專案規則**改版本號**；移除內容前先問使用者（已使用它的場次或資料可能載入失敗）。專案的建置腳本失敗時，把錯誤訊息原樣告訴使用者，不要自行改內容。

## 3. 建置並測試（在 `<project_dir>` 執行）

依專案文件執行建置清單與測試（通常是 `package.json` 的 `build`、`test` 與冒煙測試腳本）。本次若改了程式（不只是內容），另跑專案的審查檢查，並依計畫書審查級別決定是否需要外部審查。

## 4. commit（不 push）

只 `git add` 本次變更的檔案；commit 訊息寫部署內容與版本。部署腳本若要求工作樹乾淨，部署內容才能對應到一個 commit。

## 5. 部署

1. 先看會做什麼（不部署）：專案若有 `--plan`／`--dry-run` 類旗標就先跑；沒有就跑 `wrangler deploy --dry-run`。
2. 取得使用者同意後實際部署（專案腳本，或在 `<project_dir>` 執行 `wrangler deploy`）；有第二個 Worker 時兩個都要部署，順序依專案文件。
3. **首次部署**（或後台變數被清掉時）才需要一次性旗標（例如管理者信箱、OAuth 用戶端 ID 這類值）：**向使用者要，不寫進 Skill、設定檔或計畫書**；依專案文件帶入。
4. 任何步驟失敗，立即停止；把失敗步驟與輸出摘要告訴使用者，不要重試部署超過一次。

## 6. 線上唯讀檢查與回報

- 檢查只用唯讀 GET：`main_url`（及 `deck_host_url`）回 200、專案自己的線上檢查腳本（若有）全過。`status=0` 不等於成功，要看到「0 失敗」之類的實際結果；剛部署完回 404 或 5xx 可等 15 秒重試一次。
- 回報（繁體中文）：
  1. 部署的 commit 與內容清單（id、版本）。
  2. 網址用角括號包住，例如 `<main_url>`，後面不緊接全形字。
  3. 線上檢查通過數；失敗項目原文。
  4. 提醒：新版內容可能需要重新建立場次／重新整理；部署時連線中的使用者可能斷線幾秒後自動重連。
- 在該專案的計畫書檔尾追加 checkpoint（日期、commit、Worker 版本 ID、檢查結果、偏離）。

## 7. 常見狀況

| 狀況 | 處理 |
|---|---|
| `wrangler whoami` 未登入 | 請使用者自己登入（`wrangler login` 或設定 `secrets_env` 列的環境變數），完成後重跑 |
| 線上檢查「後台變數已設定」類項目失敗 | 後台變數不見了：用首次部署流程重新部署（先向使用者要必要值） |
| 內嵌的第二個 Worker 內容空白 | 檢查兩個 Worker 之間互相指向的來源設定（`main_url`、`deck_host_url`）是否一致 |
| OAuth（例如 Google 登入）失敗 | 請使用者在 OAuth 用戶端「已授權的 JavaScript 來源」加入 `oauth_origins` 列的網址 |
| 想啟用付費功能或改後台設定 | 屬範圍變動，停下來請使用者決定 |
