# eduHarness Workspace Governance

## Authority

本檔是本工作區的治理 SSOT（single source of truth）。

## Workspace layers

- `brain/skills/`：技能唯一原始版本（canonical）。
- `.claude/skills/`、`.agents/skills/`：受控投影，由 `harness/scripts/project-skills.mjs` 生成；禁止直接編輯。
- `harness/`：治理腳本與設定。

## Core gates

- 繁體中文優先；事實與完成宣告要有工具或檔案證據。
- 技能防重：任何技能新增、匯入或更新前先跑 `node harness/scripts/check-skill-dedup.mjs --require-ready`；未 READY 一律停止。
- 投影更新：先 `node harness/scripts/project-skills.mjs` 預覽，確認後 `--apply`（更新既有投影另加 `--allow-update`）。
- 不讀取、輸出、複製或提交 secrets、tokens、cookies、private keys。
- 涉及學生個資、對外發布或正式評量的產出，停在使用者核准閘門。
- 任何刪除、批次搬移或 Git 歷史操作均需精確預覽及使用者核准。
