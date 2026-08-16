# Local Skills

每個 Skill 是可拔插的程序包。Skill 可以包含 `SKILL.md`、`references/`、`templates/`、`assets/` 與本機可執行的輔助檔案。

Registry 保存 Skill 的 logical ID、相對路徑、觸發條件、依賴、版本、SHA-256 tree hash 與平台 projection 狀態；沒有登錄的 Skill 不會被自動假設存在。不得把安裝位置寫入 Skill 本身。

目前三個移植探針是 `lesson-plan-authoring`、`reasoning-kernel` 與 `document-to-markdown-ingestion`。載入規則與條件依賴請看 `harness/config/skill-registry.json`；混合版契約請看 `harness/docs/skills.md`。
