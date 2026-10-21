# 再犯（第 3 次）：交付檔案位置先給相對路徑，另一宿主端提醒型守門沒有生效

- 日期：2026-10-18
- 宿主：另一個網頁介面代理宿主（已停用）
- 情境：交付兩支動畫網頁時，先用表格列 repository-relative path；使用者要求完整連結後改給 `<file:///<磁碟>:/…/index.html>`，使用者指出連結格式錯誤；第三次才改成 text 區塊的絕對路徑。
- 使用者指出：需要一直提醒同樣的錯誤；規則已寫、hook 也已設定，卻仍重犯。
- 既有規則：`brain/knowledge/user-facing-absolute-paths-copyable.md`；前次紀錄：`brain/error-log/2026-10-16-handoff-relative-paths-not-copyable.md`、`brain/error-log/2026-10-17-relative-paths-to-user-again.md`、`brain/error-log/2026-10-17-bare-url-swallows-fullwidth-text.md`；守門：守門規則表的 `user-facing-absolute-paths` 條目（status active）。

## 證據（事實）

1. 該宿主的治理橋接擴充（harness-bridge）只註冊 `session_start` 與 `tool_call` 兩個事件，沒有讀取 `guard-rules.json`，也沒有把 reminder 注入對話。提醒型守門在該宿主端不存在。
2. AGENTS.md（該宿主會載入）沒有「對使用者列路徑用絕對路徑」的規則；這條規則只在 `brain/`，而 AGENTS.md 已寫明該宿主不會自動注入 `brain/` 教訓。
3. 本次 CONSULT-before-act 只用主題關鍵詞檢索（AI 素養、動畫），沒有檢索回覆格式類規則；與 2026-10-17 紀錄的失敗模式相同。

## 錯誤

- 交付時用相對路徑表格。
- 被提醒後給 `file:///`，在網頁介面中無法點開。
- 守門只在 Claude 端生效，卻被當成「各宿主都有」。

## How to apply

- 對使用者列出要看、點開或複製的檔案位置：用當下解析的 Windows 絕對路徑，每個路徑單獨一個 ```text 區塊。
- 要可點的網頁：啟動只綁 127.0.0.1 的本機伺服器，用 curl 確認 200 後給 `[名稱](http://127.0.0.1:<port>/…)`；不給 `file:///` 當可點連結。
- 修補機制（待使用者核准）：(A) 在 AGENTS.md 加一行輸出慣例；(B) 讓 harness-bridge 在 `before_agent_start` 讀 `guard-rules.json`，把 active reminder 注入該宿主系統提示。
