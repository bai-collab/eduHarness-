---
name: claude-plugins-official-marketplace-reference
description: Anthropic 官方 Claude Code 外掛市集 repo（claude-plugins-official）的結構、內建外掛清單與供應鏈治理設計（commit 鎖定、每日升版、模型安全審查 schema、改名對照表）；可借給本工作區外掛外審清單
type: knowledge-reference
status: recorded-reference
triggers: [claude-plugins-official, 鏡像, plugin marketplace, 外掛市集, marketplace.json, /plugin install, plugin 審查, plugin 安全審查, hookify, plugin-dev, skill-creator, renames, strict false, git-subdir]
source: https://github.com/anthropics/claude-plugins-official
source_revision: ea10b213686c90bb1984b2016937310e05336cf3
source_license: Apache-2.0
verified_at: 2026-10-19
---
# claude-plugins-official：官方外掛市集

## 1. 定位

- `/plugin install <名稱>@claude-plugins-official` 背後的目錄。核心是 `.claude-plugin/marketplace.json`；repo 本身只帶部分外掛原始碼，多數條目是指向外部 repo 並釘選 commit 的指標。
- 本檔記錄 commit `ea10b21`（2026-10-16T02:40Z）的快照。原工作區另有本機唯讀鏡像（未隨本工作區提供）。下文的 repo 內路徑都相對於上游 repo 根目錄。
- 若自建鏡像，只供閱讀：不得手改，也不得從鏡像執行 hooks／腳本或安裝外掛。數字會隨上游變動，需要最新狀態時以上游 repo 為準重新核對。

## 2. 結構（快照數字）

```text
marketplace.json（315 筆）
  ├─ 本地 "./..."（53）──▶ plugins/（Anthropic 內部 40 個）
  │                       external_plugins/（合作方 14 個，多半只有 .mcp.json）
  ├─ source: url（164）──▶ 外部 git repo
  └─ source: git-subdir（98）─▶ 外部 repo 子目錄（path＋ref＋sha）
  外部 262 筆全部帶 sha
```

- 分類：development 123、productivity 69、database 39、monitoring 22、security 18、未分類 14，其餘 deployment／design／automation／learning／testing／math／location／migration。
- 條目欄位：`name`、`displayName`、`description`、`author`、`category`、`source`、`homepage`、`keywords`／`tags`、`version`、`strict`、`skills`、`lspServers`。
- 每個外掛的標準結構：`.claude-plugin/plugin.json`（必要）、`.mcp.json`、`commands/`、`agents/`、`skills/`、`hooks/`、`README.md`。參考實作：`plugins/example-plugin`。

## 3. 內部外掛（`plugins/`）速查

| 類型 | 外掛 | 備註 |
|---|---|---|
| LSP | clangd、csharp、gopls、jdtls、kotlin、lua、php、pyright、ruby、rust-analyzer、swift、typescript（`*-lsp`） | 只有 `lspServers` 設定 |
| 開發流程 | feature-dev（1 指令／3 代理）、code-review、pr-review-toolkit（6 代理）、commit-commands（3 指令）、code-simplifier | |
| 大型工作流 | code-modernization（13 指令／8 代理／hooks）、claude-security（9 代理／skill／hooks） | 最重 |
| 外掛作者工具 | plugin-dev（7 skill／3 代理）、skill-creator、mcp-server-dev（3 skill）、hookify（4 指令＋hooks）、example-plugin | 寫外掛時先看 |
| 輸出風格 | explanatory-output-style、learning-output-style | 只靠 hooks 注入 |
| 其他 | ralph-loop（循環＋hooks）、security-guidance（hooks）、math-proof、math-olympiad、receipts、session-report、playground、project-artifact、claude-md-management、claude-code-setup、agent-sdk-dev、cwc-makers、mcp-tunnels | |

外部目錄 `external_plugins/`：asana、context7、discord、fakechat、firebase、github、gitlab、imessage、laravel-boost、linear、playwright、serena、telegram、terraform。

## 4. 治理設計（可借鏡）

| 機制 | 位置 | 要點 |
|---|---|---|
| commit 釘選＋每日升版 | `.github/workflows/bump-plugin-shas.yml`、`.github/scripts/discover_bumps.py` | 每日 07:23 UTC 找上游新 commit 開升版 PR；`.github/bump-tracking.json` 的 `releases-only` 清單只跟 release |
| 模型安全審查 | `.github/workflows/scan-plugins.yml`、`.github/policy/prompt.md` | 標準是「負責任處理使用者資料」而非只是「非惡意」；要讀**整包下載內容**（含 `.claude/`、`scripts/`、`tests/` 等不自動載入的路徑）；重點抓「憑證跨服務送出」（依憑證名稱／存放位置判斷歸屬，例如 `ANTHROPIC_*` 送到非 Anthropic 端點即違規）。實際 action 在另一個 repo `anthropics/claude-plugins-community`（釘 sha） |
| 結構化判定 | `.github/policy/schema.json` | 必填：`passes`、`summary`、`violations`、`may_make_external_network_calls`、`may_download_additional_software`、`hooks`（每條寫 `EVENT:path — gated\|ungated — network:yes(host)\|no`）、`has_broad_scope_hooks`、`has_undisclosed_telemetry`、`description_matches_behavior` |
| 升版失敗退回 | `revert-failed-bumps.yml` | 只對 workflow_dispatch 觸發的掃描失敗動作 |
| 外部 PR 管制 | `close-external-prs.yml`、`external-pr-scope-guard.yml` | 外部 PR 自動關閉，新外掛走申請表單；`pull_request_target` 只 checkout base repo |
| 其他驗證 | `validate-frontmatter.yml`、`validate-licenses.yml`、`validate-plugins.yml`、`check-mcp-urls.yml`（每日） | |
| 名稱不可變 | README「Plugin names are immutable」 | 改顯示名用 `displayName`；非改不可時在頂層 `renames` 登記（快照 10 筆），載入器自動遷移舊安裝 |
| 只有 skill 的 repo | README「Skill-bundle plugins」 | `strict: false`＋明列 `skills` 陣列，免 `plugin.json`（快照 14 筆） |

## 5. 對本工作區的用法

- 外審自家外掛時，可把第 4 節 `schema.json` 的欄位當檢查清單送 AGY／Codex，尤其 hooks 逐條標「閘控／連網」。
- 寫 hooks／守門時參考 `hookify`、`security-guidance`、`plugin-dev`。
- 限制：README 明說 Anthropic 不保證外掛行為；模型審查是過濾不是保證。262 個外部上游未逐一審查。安裝任何外掛仍需使用者同意（`AGENTS.md`「不自動安裝」）。
