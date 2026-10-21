# eduHarness：本機可插拔治理 Harness＋教育用 Skill 與知識庫

## 這是什麼

這是一套**只在自己電腦上跑**的 AI 工作規範與工具組，給用 AI 代理（Claude Code、Codex 等）做教育相關工作的老師與開發者參考。它分成三塊：

- **治理規則**：`AGENTS.md`（各家代理共用的工作規則）與 `CLAUDE.md`（Claude 端補充）。重點是「使用者說了算」：非瑣碎的任務先寫計畫、列出每一步誰做、怎麼驗證，使用者核准後才動手；作者不能審自己的成果。
- **教育用 Skill**：教案、命題、臆測教學、教材轉遊戲、教學動畫、圖解等 31 個 Skill，每個 Skill 是一份「什麼時候用、怎麼做、交付什麼」的工作說明。
- **知識庫**：`brain/` 收錄踩雷紀錄與做法筆記，讓代理動手前先查「以前錯過什麼」。

打個比方：Skill 是食譜，`brain/` 是廚房的失敗筆記本，`AGENTS.md` 是廚房規矩，`harness/` 是幫忙檢查的小工具。

## 目錄導覽

| 位置 | 內容 |
|---|---|
| `AGENTS.md` | 工作規則正本（各家代理共用） |
| `CLAUDE.md` | Claude 端補充規則 |
| `brain/skills/` | 31 個 Skill；清單見 [`brain/skills/README.md`](brain/skills/README.md) |
| `brain/knowledge/`、`brain/error-log/`、`brain/instincts/`、`brain/experience/` | 做法筆記、踩雷紀錄、行為準則、回顧 |
| `config/` | 網站與服務設定的公開範本（`sites.example.json`）與說明 |
| `harness/` | 審查迴圈（review-loop）、AGY 呼叫元件、守門提醒 hook、公開掃描器與測試 |
| `tools/claude-cli/` | Windows 雙擊開 Claude Code CLI 的啟動檔（可選訂閱或 API 金鑰計費），說明見 [`tools/claude-cli/README.md`](tools/claude-cli/README.md) |
| `.claude/` | Claude Code 專案設定（公開安全的網域允許清單、守門提醒 hook） |

## 快速開始

需要 Node.js 20.11 以上，不需要安裝任何套件。

1. 跑測試：

   ```text
   npm test
   ```

2. 公開掃描（分享或提交前檢查有沒有私人資料外洩）：

   ```text
   npm run scan:public
   ```

   掃描器需要你自己的禁止字串清單才會執行（沒有就拒絕執行），做法見下方「公開與私人內容怎麼分」。

3. 送外部審查（review-loop）：

   ```text
   node harness/cli/review-loop.mjs <本任務設定檔.json>
   ```

   設定檔寫明審查目標、要審的檔案（每包最多 30 個）、檢查項目與審查模型。審查由 AGY（Antigravity CLI）執行，需要先在本機裝好並能用 `--version` 跑起來；作者是 Claude 時，審查模型必須指定非 Claude 家族。只想檢查設定檔可加 `--preflight-only`。

## 公開與私人內容怎麼分

- 私人資料（個人規則、本機網址與埠號、帳號、禁止字串清單）一律放在 `private/` 資料夾或 `*.local.*` 檔，兩者都被 `.gitignore` 排除，**不在這個 repo 裡**。clone 下來沒有 `private/` 是正常的。
- 自建私人區：
  1. 把 `harness/tools/forbidden-strings.example.json` 複製成 `private/scan/forbidden-strings.local.json`，把裡面的假值換成你自己不想外洩的字串（帳號、學校、內部代號等），再跑：

     ```text
     node harness/tools/scan-public.mjs --self-test
     ```

  2. 把 `config/sites.example.json` 複製成 `private/config/sites.local.json`，填入你自己的網址、埠號等值。Skill 只讀設定鍵，讀不到值會停下來問你，不會亂猜。
- 金鑰、token、密碼**不寫進任何檔案**，只放在使用者層的環境變數。
- 完整規則見 `AGENTS.md`「公開／私人切割規範」。

## Skill 清單

所有 Skill 的名稱、用途與是否需要設定，見 [`brain/skills/README.md`](brain/skills/README.md)。目前 Skill 放在 `brain/skills/`，尚未自動投影到 `.claude/skills`，要用時請手動複製到你的代理會讀的位置。

## 授權

- 程式碼：MIT，見 [`LICENSE`](LICENSE)。
- 文件（規則、知識庫、Skill 說明等）：CC BY 4.0，見 [`LICENSE-DOCS.md`](LICENSE-DOCS.md)。
- 檔案內標示來自第三方上游專案的內容，依該上游原本的授權與署名要求。
