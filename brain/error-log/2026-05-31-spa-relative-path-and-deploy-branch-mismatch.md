---
name: spa-relative-path-and-deploy-branch-mismatch
description: Vite 絕對路徑 404、monorepo 獨立倉庫誤推、Pages 環境保護規則
type: errorlog
triggers: [vite, 404, github-pages, gh-pages, deploy, monorepo, subtree, environment-protection]
rules:
  - "SPA 內部資源一律用相對路徑 ./,不用絕對路徑 /"
  - "monorepo 子專案對應獨立 repo:不直接 push,走 deploy 腳本;Pages 有環境保護規則沿用 gh-pages 分支"
updated: 2026-07-09
---
# 錯誤記錄：Vite 引入路徑 404 與 Monorepo 獨立倉庫部署分支混淆

- **時間**：2026-05-31
- **專案**：某網頁小遊戲專案（monorepo 下的子資料夾）
- **錯誤類型**：資源載入 404、Git 倉庫與分支配置混淆、GitHub Actions 觸發與環境保護規則限制

---

## 1. Vite 引入主腳本絕對路徑導致 404 錯誤

### 問題描述
當功能修改完成並在本機建置成功後，於瀏覽器載入時出現以下錯誤：
```text
src/main.ts:1  Failed to load resource: the server responded with a status of 404 ()
<子目錄>/:1 Uncaught (in promise) Object
```
遊戲畫面完全無法初始化（一片空白）。

### 根本原因
在子專案的 `index.html` 中，引入主程式腳本的 `<script>` 標籤原本寫為絕對路徑：
```html
<script type="module" src="/src/main.ts"></script>
```
這導致當遊戲不是部署於網頁伺服器根目錄，而是部署於子目錄（如 `/<子目錄>/`）時，瀏覽器會試圖去最頂層網域的 `/src/main.ts` 載入資源，從而造成 404 錯誤。

### 修正方法
將該絕對路徑改為相對路徑：
```html
<script type="module" src="./src/main.ts"></script>
```
這能確保無論專案被部署在任何目錄層級（包括 Subfolder），瀏覽器都能相對於 `index.html` 的位置正確載入主程式。

---

## 2. Monorepo 子專案與獨立 GitHub 倉庫/部署分支混淆

### 問題描述
我們將修改推送至 Git 遠端後，發現 GitHub 上的自動部署工作流（GitHub Actions）沒有被觸發，線上網頁遲遲未更新。

### 根本原因
1. **倉庫混淆**：
   - 本地工作目錄 `<工作區根>` 是一個大倉庫 (Monorepo)，其 `origin` 關聯的是 `<GitHub 帳號>/<monorepo>.git`。
   - 而該子專案在 GitHub 上的線上部署是託管於一個**獨立的 Repository**：`<GitHub 帳號>/<repo>.git`。
   - 我們本地的子專案目錄內並無 `.git`（所以它在本地只是大倉庫下的一個資料夾），這導致直接執行 git add/push 會推入大倉庫，而不會同步到子專案的獨立倉庫。

2. **分支與觸發條件限制**：
   - 獨立部署倉庫的 GitHub Actions 設定檔 `.github/workflows/pages.yml` 中，自動部署的觸發條件被限制在只有 **`main`** 分支有 push 時才會啟動。

---

## 3. GitHub Pages 環境保護規則（Environment Protection Rules）限制

### 問題描述
當我們合併並推送到 `main` 分支後，GitHub Actions 顯示 `Deploy to GitHub Pages` 失敗，日誌中回報：
```text
X Branch "main" is not allowed to deploy to github-pages due to environment protection rules.
X The deployment was rejected or didn't satisfy other protection rules.
```

### 根本原因
1. **保護規則限制**：
   - 在 GitHub 的 Repository Settings 裡，`github-pages` 環境被設定了環境保護規則（Environment Protection Rules），限制了只有特定的分支（通常是 `gh-pages` 分支）才可以進行網站部署發布。
   - 當我們的 Action 跑在 `main` 分支並直接呼叫 `actions/deploy-pages@v4` 時，會因為保護規則而被 GitHub 直接拒絕，導致部署失敗。

### 修正與部署步驟
1. 建立臨時資料夾，重新克隆獨立倉庫。
2. 將 `.github/workflows/pages.yml` 重新修改回使用 `peaceiris/actions-gh-pages@v4` 部署到 `gh-pages` 分支的結構：
   - `build-and-deploy` 任務：執行 `npm run build`，隨後將 `./dist` 目錄的內容推送到遠端 `gh-pages` 分支。
3. 推送該修改到 `main` 分支，這會成功跑完 `Deploy GitHub Pages`，並將打包後的內容推上遠端的 `gh-pages` 分支。
4. **人工介入（GitHub 設定調整）**：
   - 請使用者在 GitHub 網頁的 **`Settings -> Pages`** 裡。
   - 將 **`Build and deployment -> Source`** 設定從 `GitHub Actions` 改回 **`Deploy from a branch`**。
   - 分支（Branch）設定為 **`gh-pages`**，資料夾設定為 `/ (root)`，並點擊 **`Save`**。
   - 當改回此設定後，GitHub Page 就會被允許從 `gh-pages` 分支自動抓取最新已打包程式（`dist` 內容）並成功部署上線。
5. 安全刪除該臨時資料夾。

---

## 4. 防範與改進建議
1. **預防絕對路徑錯誤**：在開發單頁應用 (SPA) 或是靜態網頁時，引入內部資源（如 `.ts`、`.js` , `.css` 或圖片）時，優先使用相對於 `index.html` 的相對路徑（`./`），避免使用絕對路徑（`/`）。
2. **多倉庫管理意識**：在 Monorepo 架構中，若某子目錄在遠端是個獨立倉庫（有獨立部署 Actions），切記不能直接在大倉庫執行 push。應該建立自動化發布指令（例如使用 Git Subtree、或在此專案中新增 `npm run deploy` 腳本，封裝 clone、copy、push 的動作），避免因手動部署流程繁雜而發生失誤。
3. **遵循倉庫既有的部署路徑**：如果 GitHub 設定了 Environment Protection Rules，應繼續沿用推送到 `gh-pages` 分支的部署方式，不應隨意改成 `GitHub Actions` 直下部署，除非已在 Settings 中將 `main` 分支加入 github-pages 環境的安全存取清單中。
