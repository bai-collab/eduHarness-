# Local Pluggable Harness

這是一個只在本機執行的 Harness 基線。它把「治理規則」與「執行環境」分開，並以可插拔區塊推動模型或工具沿著可驗證路徑工作。

## 它如何推動思考

Harness 不要求模型輸出私有 Chain-of-Thought，而是要求留下可檢查的決策紀錄：

```text
goal → assumptions → hypotheses/options → evidence → checks → result → uncertainty → next action
```

只有遇到複雜、模糊、衝突或高風險任務時，才載入 reasoning 區塊；簡單任務可以直接進入本機執行準備與驗證。

## 使用者權限

使用者可以：

- 指定或改變 profile
- 指定區塊順序
- 跳過 optional block
- 指定本機 adapter
- 修改方案、範圍與驗證方式
- 隨時停止流程

Harness 會把這些決定寫入 plan artifact。模型產生的建議只能標記為 advisory，不能覆蓋 user decision。

## Route Plan 與多平台治理

非瑣碎任務會先建立 Route Plan，再開始執行。每個節點會記錄：

- objective、依賴與 allowed paths
- requested platform／agent／role
- platform preflight 結果
- 不可用時的 primary-agent fallback
- 該節點的 verifier mode

平台預檢只做無副作用的 readiness probe。外部平台未啟用或 adapter 不存在時，會記錄原因並改由主 Agent 接手；若沒有安全 fallback，才標記 `deferred`。

Verifier 採節流策略：Simple 預設不派獨立 verifier、Standard 最後統一驗證、Complex 只對關鍵節點安排 verifier，並受 route profile 的 verifier budget 限制。

## 路徑

portable config 使用 repository-relative path。實際根目錄由 marker discovery、`HARNESS_ROOT` 或 `--root` 決定，不依賴固定磁碟代號或本機絕對位置。

## 快速開始

```powershell
npm test
npm run harness:validate
node harness/cli/harness.mjs plan harness/examples/task.simple.json
node harness/cli/harness.mjs plan harness/examples/task.standard.approved.json
node harness/cli/harness.mjs plan harness/examples/task.complex.pending.json
node harness/cli/harness.mjs plan harness/examples/task.lesson-plan.standard.json
node harness/cli/harness.mjs plan harness/examples/task.document.simple.json
```

`task.complex.pending.json` 會停在 `awaiting_user`，因為 Complex 路徑需要使用者明確裁決；這是預期行為。

`task.standard.approved.json` 展示 Standard 路徑：使用者已核准、先做 route preflight，最後只排一次 final verifier。

## Brain 遷移與按需知識

Brain 使用 `brain/index.json` 管理 repository-relative path。知識、Skill 與範本先索引、後按需載入；不會因為建立任務就把全部文件全文放進上下文。

```powershell
npm run harness:brain -- inspect
npm run harness:brain -- verify
npm run harness:brain -- search "verifier 路徑錯誤"
```

遷移舊工作區前先預覽，再明確加上 `--apply`；目的檔案 hash 不一致時會停止而不覆寫。完整規則見 [`harness/docs/brain-migration.md`](harness/docs/brain-migration.md)。

## Skill 與條件依賴

目前已註冊 18 個混合版 Skill，涵蓋教育、命題、美工、網頁製作、版面拓樸、文書處理、海明威寫法與行動優先輸出等工作流。所有 Skill 都以繁體中文可見名稱呈現，完整清單與可攜分類請看 `harness/config/skill-registry.json` 與 `harness/config/skill-migration-catalog.json`。

Skill 不是全域預載清單：Route Plan 先建立與 Skill 無關的節點拓樸，Skill 解析結果另放在 `skill_resolution`。`user-confirmed` optional dependency 沒有使用者決定時會停在 user-authority，先顯示問題、建議與「載入／先略過」選項；Skill 不得改變 Route Plan 節點、拓樸或 verifier 預算。

查看 Skill Registry：

```powershell
node harness/cli/harness.mjs skills
node harness/cli/harness.mjs catalog
```

Skill package 位於 `brain/skills`；Registry 位於 `harness/config/skill-registry.json`。不會預載全部 Skill，也不會自動安裝或覆寫平台 projection。

新建或移植 Skill 請從 `harness/templates/skill-package` 開始：英文小寫連字號 `id` 只供內部穩定引用；使用者看到的 `display_name_zh_tw`、中文別名與 `agents/openai.yaml` 的 `interface.display_name` 必須使用繁體中文，而且三者要一致。完成後執行 `npm run harness:validate`；未註冊、缺中文名稱或名稱不一致都會被阻擋。

Skill 的可攜分類與批次資訊在 `harness/config/skill-migration-catalog.json`；它只描述本副本實際存在的 Skill。

目前內建的 `rule-tool` 只會建立安全的執行準備，不會任意執行 shell。若要接上其他本機模型或工具，請依照 `harness/runtime/README.md` 實作 adapter，再透過 registry 或 local override 啟用。
