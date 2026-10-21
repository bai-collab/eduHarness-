# Cloudflare Workers 本機工具鏈（wrangler＋vitest-pool-workers）踩雷紀錄

- 驗證日期：2026-10-05；wrangler 4.147.0、`@cloudflare/vitest-pool-workers` 0.22.0（內附 miniflare 5.20260815.0-alpha）、vitest 4.1.11、npm 10.9.8、Windows。
- 來源：某教學網站專案 M1 實作 checkpoint。

## 規則

1. **`compatibility_date` 不能晚於內附 workerd 支援的日期。**
   - 症狀：vitest 啟動時只出現 `ERR_RUNTIME_FAILURE`，沒有其他訊息，之後卡在「Vite server 無法結束」。
   - 處理：日期設成 ≤ miniflare 版本號裡的日期（例如 `5.20260815.0` → `2026-08-15`）。
2. **vitest-pool-workers 0.22（vitest 4）改了設定 API。**
   - `@cloudflare/vitest-pool-workers/config` 子路徑已移除。
   - 新寫法：`import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers"`，在 `vitest/config` 的 `defineConfig({ plugins: [cloudflareTest(...)] })` 裡設定；`test.poolOptions` 不再使用。
   - 套件內附 codemod：`dist/codemods/vitest-v3-to-v4.mjs`，可對照新舊寫法。
   - D1 migration：在設定檔用 `readD1Migrations()` 讀取，透過 `miniflare.bindings` 傳入，再於 setup 檔呼叫 `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`。
3. **型別設定**：
   - Worker 的 tsconfig 不要含 DOM lib，用 `"lib": ["ESNext"]`。
   - types 用 `@cloudflare/workers-types` 與 `@cloudflare/vitest-pool-workers/types`。
   - 開 `skipLibCheck`：workers-types 5.x 與 pool-workers 的型別宣告互相衝突。
   - binding 型別宣告在 `declare namespace Cloudflare { interface Env {...} }`，worker 和 `cloudflare:test` 會共用。
4. **npm 10.9.8 安裝時出現 `Cannot read properties of null (reading 'edgesOut')`。**
   - 原因：arborist 解析 vitest 的選用 peer（`@vitest/browser-*` 會被解析成 5.x，或 `vitest@*`）時當掉。
   - 試過但無效：overrides、`"$vitest"` 參照。
   - 可行做法：在專案層 `.npmrc` 設 `legacy-peer-deps=true`，註明理由與移除條件，並把需要的 peer 都明確列在 package.json；之後用 `npm ls --all` 確認沒有 UNMET PEER。
5. **wrangler 靜態資源（`[assets]`）＋薄 Worker 轉送 `env.ASSETS.fetch` 時，`public/_headers` 仍然有效**，已實測回應標頭。審查者若宣稱無效，用 curl 實測反駁。
6. **刪除 node_modules 前，先停掉 wrangler／vite dev server**，否則 Windows 會回報 `Device or resource busy`。
7. **workerd 的 `fetch` 不支援 `redirect: 'error'`**（只接受 `follow`／`manual`），會直接拋例外。
   - 症狀：沿用 Node 寫法的 provider 在 wrangler dev 一律回「無法連線」；單元測試用假 fetch 測不出來。
   - 處理：改 `redirect: 'manual'`，3xx 交給 `!response.ok` 處理；catch 內把例外名稱與訊息（遮罩金鑰）記到 Worker 主控台。
   - 來源：2026-10-14 某教學網站專案串接某 OpenAI 相容端點的生成器實測。
8. **本機 8787 可能已被其他本機服務佔用（127.0.0.1:8787）**：wrangler dev 預設也用 8787，且經 Vite 代理的 `/api/health` 會拿到該服務的 200 回應，造成啟動腳本誤判。
   - 處理：專案在 `wrangler.toml` 設 `[dev] port`（例如 8790），Vite proxy 與 e2e 腳本同步；健康檢查要核對專案特有欄位，不能只看 HTTP 200。
