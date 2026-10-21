# tools/claude-cli：Claude Code CLI 啟動檔

在 Windows 上雙擊就能開 Claude Code 命令列（CLI），並先選好計費方式。主要用途是 Claude 桌面版額度將滿時，交接給 CLI 接手（見 skill `codex-handoff`，設定鍵 `tools.claude_cli.launcher`）。

| 檔案 | 做什麼 |
|---|---|
| `start-claude.cmd` | 雙擊後先問計費方式：按 `1` 用訂閱登入、按 `2` 用 API 金鑰（轉交 `start-claude-api.cmd`） |
| `start-claude-api.cmd` | 直接用 API 金鑰計費開 CLI（`--bare` 模式，並用 `--add-dir` 重新載入工作區的 `CLAUDE.md`） |

## 怎麼用

1. 先裝好 Claude Code CLI，確定命令 `claude.cmd` 可以執行。
2. 雙擊 `start-claude.cmd`（或 `start-claude-api.cmd`）。
3. 也可以帶第一句指令，例如在命令列輸入：

   ```text
   start-claude-api.cmd "讀 workspace/<主題>/handoff-to-claude-cli-YYYY-MM-DD.md 並照做"
   ```

啟動檔會先跑 `claude.cmd auth status` 確認登入方式，確認不對就停下來，不會直接開始。

## 兩種計費方式

- **訂閱（選 1）**：用 claude.ai 帳號登入（OAuth）。只在這個視窗清掉 `ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN`，不動使用者層設定；登入方式不是 claude.ai 就停下。
- **API 金鑰（選 2 或直接開 `start-claude-api.cmd`）**：讀環境變數 `ANTHROPIC_API_KEY`，按用量計費。`--bare` 模式不會自動載入 hooks、外掛與自動記憶，所以啟動檔用 `--add-dir` 把工作區的 `CLAUDE.md`（含 `@AGENTS.md`）載回來。

## 金鑰放哪裡

- 金鑰**只放在使用者層的環境變數** `ANTHROPIC_API_KEY`（Windows「編輯您帳戶的環境變數」）。
- **絕對不要**把金鑰寫進這兩個啟動檔、`config/`、`private/` 或任何會被複製、分享的檔案；啟動檔也不會把金鑰印出來。

## 工作資料夾

- 預設是「本檔往上兩層」，放在 `tools/claude-cli/` 時就是工作區根目錄。
- 如果有設使用者層環境變數 `CLAUDE_WORKDIR`，會改用它指定的資料夾。換工作區時記得檢查這個變數有沒有指到舊位置。
