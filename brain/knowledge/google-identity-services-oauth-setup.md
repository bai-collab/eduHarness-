# Google 登入（Google Identity Services）網頁用戶端設定與「已封鎖存取權」排查

- 來源：2026-10-16 某教學網站正式部署，使用者首次登入出現「已封鎖存取權：授權錯誤」，依下列步驟調整後成功。
- 適用：前端用 GIS 按鈕（popup）取得 ID token、後端自行驗證的網站；只用 email／profile 基本範圍。

## 規則（How to apply）

1. 用戶端類型必須是「網頁應用程式」；只需「已授權的 JavaScript 來源」，重新導向 URI 留空。
2. 來源逐字填 `https://<網域>`：要有協定、**結尾不加 `/`**、不加路徑；本機另加 `http://localhost:<port>`。變更可能需數分鐘才生效，用無痕視窗重試。
3. 同意畫面：外部（External）且「測試中」時只有測試使用者能登入；基本範圍可直接「發布應用程式」，不需 Google 審查。內部（Internal）只允許該 Cloud 專案所屬組織的帳號。
4. 學校／企業 Workspace 帳號若被擋（訊息提到管理員），需由 Workspace 管理員在 admin.google.com →「安全性」→「存取權和資料控管」→「API 控制項」→「管理第三方應用程式存取權」把用戶端 ID 設為「信任」。
5. 排查先看錯誤頁的代碼：`origin_mismatch`→第 2 條；`access_denied`／測試人員→第 3 條；`org_internal`→第 3 條；`admin_policy_enforced`→第 4 條；`invalid_client`→用戶端 ID 錯或已刪。
6. 用戶端 ID 是公開值，可寫進部署設定（例如 `wrangler.toml` 的 `[vars]`）；用戶端密碼在 GIS 流程用不到，不要索取或保存。
7. 網站 CSP 需允許 `https://accounts.google.com/gsi/client`（script）、`https://accounts.google.com/gsi/style`（style）、`https://accounts.google.com/gsi/`（frame、connect）；`Referrer-Policy` 用 `strict-origin-when-cross-origin`。
