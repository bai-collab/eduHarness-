# codex exec 以子專案為工作目錄時沙箱無法啟動指令

- 日期：2026-10-13
- 事實：`codex exec -s workspace-write -C projects/<子專案>`（codex-cli 0.162.1，子專案是獨立 git repo）每個指令都回 `helper_unknown_error: setup refresh had errors`，Codex 未改任何檔就回報無法作業。同一台改 `-C <repo 根>` 後指令正常（`node --version` 成功），S1 完整完成。
- 推論：沙箱 helper 對「巢狀 git repo 當工作根」初始化失敗；未查證確切原因。
- How to apply：
  1. 派 Codex 寫 `projects/<子 repo>` 時，`-C` 指向 harness 根目錄，brief 第一行要求先 cd 進子專案。
  2. 派工前先用一次 `node --version` 小探測確認沙箱可執行，再派長任務。
  3. Codex 回報「無法執行指令」時先看 log 的 `helper_unknown_error`，屬環境問題，不是模型或權限不足。
