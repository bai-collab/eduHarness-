# Hybrid Skill Contract

新 Harness 的 Skill 採用兩層混合設計：

```text
brain/skills/<skill-id>/       package：怎麼完成工作
harness/config/skill-registry.json  routing：何時載入、依賴誰、如何投影
harness/core/skills.mjs        runtime：驗證 package、讀取契約、產生選擇結果
```

## Package contract

每個 Skill 以資料夾為單位，至少包含 `SKILL.md`。需要平台顯示或可重現時，另外提供 `agents/openai.yaml` 與 `VERSION`；需要工具時，把 `scripts/`、`references/`、`templates/` 或 `assets/` 放在同一個 package 內。

`SKILL.md` 只描述工作目的、觸發／反觸發、執行流程、輸出契約、停止規則與工具邊界。不得把完整 Harness 路徑、特定磁碟代號或單一平台假設寫死。

## 可見名稱規則

- `id` 是穩定的內部 slug，可保留英文，供 Registry、版本、依賴與 Route Plan 使用。
- `display_name_zh_tw` 是使用者可見名稱，所有正式 Skill 都必須使用繁體中文；專有名詞如 GitHub、Claude、Codex、API、Three.js 可保留原文。
- `aliases_zh_tw` 放使用者可能輸入的中文叫法，Route Plan 可以用中文名稱找到內部 `id`。
- `agents/openai.yaml` 的 `interface.display_name` 必須與 `display_name_zh_tw` 一致。
- CLI 與 Catalog 顯示名稱時優先顯示中文，不把英文 `id` 當作主要名稱。
- 新建 Skill 請以 `harness/templates/skill-package` 為起點；完成後先加入 Registry，再執行 `npm run harness:validate`。

## Registry contract

Registry 管理：

- `kind`：`primary`、`supporting` 或 `supporting-tool`
- `triggers`、`anti_triggers` 與 `dependencies`
- `when` 條件，例如 `content-input` 或 `reasoning-needed`
- `user-confirmed` 條件依賴的繁中 `question`、`suggestion` 與載入／略過選項
- `preferred_platforms` 與 `verifier_policy`
- package 的 relative path、來源、版本、SHA-256 tree hash
- Claude／Codex 等 projection 的目標與狀態

Registry 不會自動安裝、匯入或覆寫 Skill。未知 Skill 依 `ask_user_or_defer` 處理，不把單一缺件直接擴大成整個 Harness 停止。

Skill resolution 與 Route Plan 分離：Skill 可以決定「哪些工作指引可供後續準備使用」，但不得新增、刪除、重排 Route Plan 節點，也不得改變平台選擇、拓樸依賴或 verifier 預算。Route Plan 只由任務路由、route profile、平台 preflight 與使用者直接指定的路由設定決定。

## Loading policy

Skill 不是全部預載：

1. Route Plan 先建立與 Skill 無關的節點拓樸；Skill 解析另外產生 `skill_resolution`。
2. 只解析使用者指定或路由請求的 Primary Skill 及其必要依賴。
3. Standard／Complex 或使用者明確要求時，才條件載入 `reasoning-kernel`。
4. Tool-bound Skill 必須先完成本機工具／路徑 preflight。
5. Skill 的完整 `SKILL.md` 會在進入執行準備前讀取；未載入的 Skill 不得被宣稱為已執行。
6. `user-confirmed` 依賴沒有決定時，必須在 user-authority 顯示問題與建議；系統預設建議先略過 optional dependency，不得默默載入。

## Migration and topology checks

目前已註冊的 18 個 Skill 都必須通過相同的移植與拓樸檢查：

- package 位於 `brain/skills/<skill-id>`，且有 Registry 登錄與繁體中文可見名稱。
- 依賴目標必須存在、條件必須受支援，並且不得形成循環。
- `user-confirmed` 依賴必須有繁中問題與建議；目前臺南命題與 Three.js 導入各自用此條件保留可拔插性。
- Skill 解析結果放在 `skill_resolution`；測試必須確認 `route_plan.nodes` 不含 Skill 狀態。
- `web-layout-topology-analysis` 另產生 `layout_plan`，先計算區塊、元件矩形與重疊關係；它不得改寫 `route_plan`。

新增 Skill 時沿用同一套檢查，不要求複製既有 Skill 的固定流程。
