---
name: shared-brain-router
description: 可攜式 Brain 的知識、範本與 Skill 讀取入口
---

# Shared Brain Router

Brain 是本機可攜式的記憶層，不是固定磁碟位置，也不是自動把所有文件塞進模型上下文的資料夾。
工作區根目錄由 Harness marker discovery、`HARNESS_ROOT` 或 `--root` 決定；所有正式路徑都從
`brain/index.json` 與 `harness/config/local-harness.json` 解析。

## 載入原則

1. 先讀 `AGENTS.md`、本檔與 `brain/index.json`。
2. 只依任務需要搜尋或讀取 `brain/knowledge/`、`brain/templates/` 與已註冊的 `brain/skills/`。
3. Skill 是可執行契約，但不能改寫 Route Plan、節點拓樸或 verifier 預算。
4. 未列在 `brain/index.json` 的資料不會被自動搜尋或載入。

## Brain 層

- `brain/skills/`：可執行的共用 Skill package。
- `brain/knowledge/`：經審核的耐久知識與技術參考。
- `brain/templates/`：可重用的範本與測試素材。

## 遷移規則

- 遷移輸入可以來自任何使用者明確指定的舊工作區；來源只在執行當下提供。
- 目的檔案已存在且 hash 不同時停止，不自動覆寫；需要新的預覽與使用者決定。
- 本可攜副本不攜帶來源工作紀錄、私人鏡像或遷移帳本；若執行新的遷移，稽核結果只依該次任務的明確範圍產生。
- 不自動連外、不安裝外部工具。

## 寫入邊界

- 任務進度寫入 `planned/` 或專案自己的狀態區，不直接寫入 Brain。
- 只有可重用且有證據的內容才可提升為 Knowledge。
- 不儲存 secrets、tokens、cookies、credentials 或私鑰。
- 使用者決定是最終權限；模型只能提出候選、摘要與風險。