# eduHarness Workspace Governance

## Authority

本檔是本工作區的治理 SSOT（single source of truth）。

## Read order

1. 本檔。
2. `brain/SKILL.md`——知識與技能讀取入口。
3. `brain/instincts/` 全部檔案（短小且跨任務適用，不分任務類型）。
4. 只讀任務觸發的 `brain/skills/`、`brain/knowledge-base/` 或 `brain/errorLog/`。

## Workspace layers

- `brain/skills/`：技能唯一原始版本（canonical）。
- `brain/instincts/`：每次啟動全量載入的短規則；全目錄上限 200 行。
- `brain/knowledge-base/`：經審核的耐久知識，觸發才讀。
- `brain/errorLog/`：已驗證的失敗、根因與 Do Not Repeat，觸發才讀。
- `brain/experience/`：任務後可重用經驗。
- `brain/wiki-index.md`：共讀索引。
- `.claude/skills/`、`.agents/skills/`：受控投影，由 `harness/scripts/project-skills.mjs` 生成；禁止直接編輯。
- `harness/`：治理腳本與設定。

## Core gates

- 繁體中文優先；事實與完成宣告要有工具或檔案證據。
- 技能防重：任何技能新增、匯入或更新前先跑 `node harness/scripts/check-skill-dedup.mjs --require-ready`；未 READY 一律停止。
- 投影更新：先 `node harness/scripts/project-skills.mjs` 預覽，確認後 `--apply`（更新既有投影另加 `--allow-update`）。
- 只有可重用且已驗證的內容才寫進 `brain/`；一次性的過程紀錄不寫入。
- `brain/instincts/` 全目錄合計超過 200 行必須合併或淘汰，不得無限增長。
- 不讀取、輸出、複製或提交 secrets、tokens、cookies、private keys。
- 涉及學生個資、對外發布或正式評量的產出，停在使用者核准閘門。
- 任何刪除、批次搬移或 Git 歷史操作均需精確預覽及使用者核准。
