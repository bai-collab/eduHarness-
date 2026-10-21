# 測試全綠，但正式 Worker 打包失敗（Vite 專屬的 `?raw` import）

- **日期**：2026-10-06
- **專案**：某教學網站專案 M6
- **發生了什麼**：
  - Codex 在 Worker 的 Skill 登錄模組用 `import("./x/SKILL.md?raw")` 載入 Skill 文件。
  - vitest（`@cloudflare/vitest-pool-workers` 底層是 Vite）認得 `?raw`，所以 510 個測試都通過，審查閘門也全綠。
  - `wrangler dev`／`wrangler deploy` 用 esbuild 打包，不認得 `?raw`，直接 `Build failed`：本機開發伺服器起不來，正式部署也會失敗。
  - 直到 Chrome 驗收時 `/api` 請求一直沒有回應，才被發現。
- **事實**：`wrangler deploy --dry-run` 重現打包失敗；改成在 wrangler.toml 加 `[[rules]] type = "Text" globs = ["**/*.md"]`，並改用不帶 `?raw` 的 import 後，dry-run 成功，vitest 也照 rules 載入（AI 測試 43/43 通過）。
- **錯在哪**：審查閘門只建置 web，沒有用 wrangler 實際打包 worker；「測試通過」被當成「可以部署」。

## 規則（How to apply）
1. Cloudflare Worker 專案的審查閘門必須包含 `wrangler deploy --dry-run --outdir <暫存>`，每個 Worker 都要跑。
2. 看到 Worker 原始碼出現 Vite 專屬語法（`?raw`、`?url`、`import.meta.glob`、`import.meta.env`），就要求改用 wrangler 支援的寫法（module rules 或一般模組）。
3. 瀏覽器驗收時，如果 `/api` 請求一直沒有回應，先看 dev server 的 log 有沒有出現 build 錯誤，再懷疑瀏覽器。
