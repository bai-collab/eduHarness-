# config/：網站與服務設定（skill 不寫死網址帳號）

本資料夾放設定的**公開範本**（`sites.example.json`）與說明；實際的「值」（網址、網域、部署目標、帳號名稱、連接埠、校內 IP）放在私人區 `private/config/sites.local.json`，不隨公開版提供。skill 只寫「要讀哪個設定鍵」，不寫值本身。AI 能不能連到某個網域，則由 `.claude/settings*.json` 的網域允許清單控制。兩層都要設，缺一層都不通。

```text
config/sites.example.json  ──複製、填值──▶  private/config/sites.local.json
   （公開範本：佔位值＋公開預設）              （本機實際值，不上傳）
            │                                         │
            └──── skill 讀取順序：先 local，沒有再 example ────┘

.claude/settings.json        公開安全的網域允許（github.com 等）
.claude/settings.local.json  私人網站網域允許（不上傳）
```

## 兩個檔的關係

| 檔案 | 內容 | 是否上傳 GitHub |
|---|---|---|
| `config/sites.example.json` | 結構、每個鍵的 `_說明`、佔位值與公開安全的預設值 | 上傳 |
| `private/config/sites.local.json` | 使用者目前實際使用的非秘密值 | **不上傳**（放在 `private/`，整個資料夾由 `.gitignore` 的 `private/` 排除；`*.local.*` 另外也排除） |

skill 讀設定的順序固定：`private/config/sites.local.json` → `config/sites.example.json`。值含 `<…>` 或 `example` 字樣視為**缺值**，skill 必須停下來問使用者，不猜、不沿用舊計畫書或舊對話裡的值。

## 鍵的意義

| 設定鍵 | 意義 | 用到的 skill |
|---|---|---|
| `sites.<site_id>.project_dir` | 站台專案資料夾（相對工作區根目錄） | cloudflare-workers-redeploy、repo-to-teaching-animation |
| `sites.<site_id>.worker_name` | 主站 Worker 名稱 | cloudflare-workers-redeploy |
| `sites.<site_id>.subdomain` | Cloudflare 帳號的 `workers.dev` 子網域（只寫子網域字串） | cloudflare-workers-redeploy |
| `sites.<site_id>.main_url` | 主站正式網址 | cloudflare-workers-redeploy、educational-card-game |
| `sites.<site_id>.deck_host_url` | 選配：第二個 Worker（簡報／靜態內容主機）網址 | cloudflare-workers-redeploy |
| `sites.<site_id>.oauth_origins` | 選配：OAuth 用戶端要登記的來源網址清單 | cloudflare-workers-redeploy |
| `sites.<site_id>.reserved_ports` | 使用者自己常開的本機埠；不得佔用或終止 | cloudflare-workers-redeploy |
| `sites.<site_id>.secrets_env` | 部署用到的**環境變數名稱**（例如 `CLOUDFLARE_API_TOKEN`），只存名稱 | cloudflare-workers-redeploy |
| `services.gas.endpoint_url` | GAS Web App 部署網址（`/exec` 結尾） | teacher-workspace-ui、educational-card-game |
| `services.sheet.id` | Google 試算表 ID（只作伺服器端 allowlist 對應） | educational-card-game |
| `services.ai.endpoint` | 教師端 AI 分析的 Responses 相容端點 | teacher-workspace-ui |
| `local.teacher_port` | 教師工作台本機埠號 | teacher-workspace-ui |
| `local.student_port` | 校內學生端伺服器埠號 | teacher-workspace-ui |
| `local.chrome_debug_port` | 截圖自審用 Chrome 遠端除錯埠 | repo-to-teaching-animation |
| `local.lan_ipv4` | 教師機校內 IPv4 | teacher-workspace-ui |
| `tools.github.default_owner` | `gh api` 取材時預設的 GitHub owner | repo-to-teaching-animation |
| `tools.claude_cli.launcher` | 開 Claude CLI 接手的啟動檔路徑（範本預設隨附的 `tools/claude-cli/start-claude-api.cmd`） | codex-handoff |
| `upstream.anycreature_repo_url` | anyCreature 公開上游網址（可改成自己的 fork） | text-to-creature |

每個鍵的詳細說明在 `sites.example.json` 各層的 `_說明` 物件裡。`sites` 底下可以放多個站台（多個 `site_id`）；使用者說的站台名稱對不上任何 `site_id` 時，skill 要問。

## skill 怎麼讀

1. 每個用到設定的 skill，在 `SKILL.md` 開頭的「設定」一節列出它要的鍵、預設值與缺值行為。
2. 先讀 `private/config/sites.local.json`；沒有該檔或鍵缺值，再讀 `config/sites.example.json`；仍是佔位值就停下來問使用者。
3. 只有公開安全的值才有預設（例如 Chrome 偵錯埠 9222、公開上游網址）；其他一律沒有預設。
4. 讀到的值只用於本次任務；不把實際值寫回 skill、計畫書、`brain/`、交接檔或任何會上傳的檔案。

## 絕對不能放進來的東西

- 金鑰、API key、token、密碼、cookie、OAuth client secret、私鑰、KMS 金鑰。需要時只寫**環境變數名稱**（`secrets_env`），值由使用者在自己的環境設定。
- email、電話、學生或教師的個資、學校名稱。
- 任何會讓公開 repo 洩漏私人網站、帳號或校內網路位置的值：這類值只能放 `private/config/sites.local.json`，不能放 `sites.example.json`、`.claude/settings.json`、skill 或 `brain/`。
- 例外：GAS 部署網址與試算表 ID 雖然不是密碼（不能靠隱藏網址保護），仍只放 `private/config/sites.local.json`。

## 兩層網站權限怎麼對齊

| 層 | 檔案 | 管什麼 | 要放什麼 |
|---|---|---|---|
| 值 | `private/config/sites.local.json` | skill 要連哪個網址、用哪個站台、哪個埠 | 實際網址、子網域、埠號 |
| AI 網域允許 | `.claude/settings.json`（公開） | AI 抓取網頁（WebFetch）可以去哪些**公開文件網域** | github.com、developers.cloudflare.com 等 |
| AI 網域允許 | `.claude/settings.local.json`（不公開） | AI 抓取**私人網站**網域 | 自己站台的主機名稱，一個站台一至兩筆 |

新增站台時：先在 `private/config/sites.local.json` 加一個 `site_id`，再在 `.claude/settings.local.json` 的 `permissions.allow` 補 `WebFetch(domain:<主機名稱>)`。這兩個設定檔不加任何 Bash 允許、不加 `defaultMode`、不加會自動核准寫入或網路變更的權限。

## review-loop 用到的環境變數（只寫名稱，不寫值）

review-loop（`harness/cli/review-loop.mjs`）不讀 `config/sites*.json`；外部程式位置與工作區根目錄由環境變數覆寫，沒設就用預設搜尋。

| 環境變數 | 用途 | 沒設時 |
|---|---|---|
| `AGY_BIN` | AGY（Antigravity CLI）執行檔完整路徑 | 先找 `%LOCALAPPDATA%` 底下 `agy\bin\agy.exe`，再找 PATH 上的 `agy` |
| `CODEX_BIN` | Codex 執行檔（原生執行檔或 `codex.js`；不接受 `.cmd`／`.bat`／`.ps1`） | 從 PATH 找 `codex.exe` 或 npm 安裝的 `codex.js` |
| `HARNESS_ROOT` | 明確指定工作區根目錄（該處必須有 `harness/config/local-harness.json`） | 從目前資料夾往上找根標記 |
| `HARNESS_REVIEW_TRIGGER_LOG_DISABLED` | 設為 `1` 時，提醒 hook 不寫 `harness/state/` 的追蹤紀錄 | 會寫追蹤紀錄（只含雜湊與事件代碼） |

這些變數都在使用者自己的環境設定，不寫進任何會上傳的檔案。
