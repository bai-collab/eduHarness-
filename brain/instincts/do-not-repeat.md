# Do Not Repeat

> 由本工作區已採納 errorLogs 的 frontmatter rules 生成；完整脈絡按需讀來源檔。

- 未備份、未驗證假設前永不改第三方核心檔案:先測現有工具可否呼叫再動手;被環境擋下先分析原因,不急著繞路 [2026-05-03-mcp-bridge-modification-failure.md]
- SPA 內部資源一律用相對路徑 ./,不用絕對路徑 / [2026-05-31-spa-relative-path-and-deploy-branch-mismatch.md]
- monorepo 子專案對應獨立 repo:不直接 push,走 deploy 腳本;Pages 有環境保護規則沿用 gh-pages 分支 [2026-05-31-spa-relative-path-and-deploy-branch-mismatch.md]
- Windows helper_unknown_error 不逐條重試:必要唯讀檢查合併成一次 require_escalated,justification 限定範圍與目的 [2026-07-08-codex-session-windows-doc-skill-friction.md]
- 中文檔內容以 UTF-8 Python 讀回為準,不信 PowerShell 顯示;多行 Python 用 here-string,不硬塞 python -c [2026-07-08-codex-session-windows-doc-skill-friction.md]
- 中文檔一律明確指定 UTF-8,永不用系統預設 CP950 讀寫;發現亂碼(嚗/?)先備份查 git 歷史,不機械轉成 ?(會銷毀位元組資訊) [2026-07-08-utf8-cp950-mojibake-corruption.md]
- 破壞性覆寫前必有備份、寫入後立即驗 size;shell 暫存檔一律用 scratchpad 絕對路徑(寫 / 會靜默產生空檔截斷目標) [2026-07-08-utf8-cp950-mojibake-corruption.md]
- 使用者(或其工具)撰寫的內容只有使用者能改;push 前我只驗證技術完整性並以提問 surface 編輯疑慮,絕不自行「修正」內容,再小再顯然也一樣 [2026-07-27-eduharness-push-unilateral-changelog-edit.md]
- 單次核准只授權該次動作,不升級成常設政策;發現不一致預設為刻意,用提問裁決,不自行選邊還 push [2026-07-27-eduharness-push-unilateral-changelog-edit.md]
- 治理決策(放哪／能不能／核准／目錄結構)回答前先開完整 AGENTS.md 對應章節;hook 摘錄只指路不當答案,摘錄提到某概念≠掌握完整規則 [2026-07-30-repo-placement-generalized-special-case-over-ssot.md]
- 不把特例當通則:manifest／設定明定位置(如另一個指定工作區=target_workspace)是特例,新獨立專案一律放 projects/<name>/ 並含 AGENTS.md 與 docs/{task-state,phase-log,handoff}.md [2026-07-30-repo-placement-generalized-special-case-over-ssot.md]
