---
name: shared-brain-router
description: 可攜式 Brain 的知識、經驗、錯誤記憶與 Skill 讀取入口
---

# Shared Brain Router

Brain 是本機可攜式的記憶層，不是固定磁碟位置，也不是自動把所有文件塞進模型上下文的資料夾。
工作區根目錄由工作區設定或啟動參數決定；所有正式路徑都從 `brain/index.json` 解析。

## 載入原則

1. 先讀 `AGENTS.md`、本檔與 `brain/index.json`。
2. `brain/instincts/` 只保留短小、跨任務且與安全或證據邊界有關的規則；啟動時可輕量載入。
3. 只依任務需要搜尋或讀取 `brain/knowledge/`、`brain/experience/`、`brain/error-log/`。
4. Skill 是可執行契約，但不能改寫 Route Plan、節點拓樸或 verifier 預算。

## 任務記憶交付契約

- `startup-light` 只提供短版、低負擔的行動提醒；載入位置不會提升它的權威，也不會取代使用者指示、`AGENTS.md` 或安全限制。
- 搜尋命中是 `candidate`，代表「可能相關」；只有任務明確指定 `brain_read_paths`，文件才會被讀取並附上相對路徑、hash、完整性與狀態。
- `dispatch` 的 `memory_attachment` 代表已交付給執行節點，不代表模型已採用或工作已完成。
- 目前 `execute` 是 plan-only：應回報 `execution_status: not_executed`，不可把準備好的記憶寫成 `applied`。
- `verify` 必須確認必要文件已完整交付、候選／已讀／已套用狀態沒有混淆，而且每個節點仍沿用原本的 Route Plan。
- 記憶正文、版本、適用範圍或證據不足時，保留 `incomplete`／`candidate_only` 等狀態，不自行補完或提升權威。

## Brain 層

- `brain/skills/`：可執行的共用 Skill package。
- `brain/knowledge/`：經審核的耐久知識與技術參考。
- `brain/instincts/`：短小的安全提醒與重複錯誤防護。
- `brain/error-log/`：已驗證的失敗、根因、證據與 Do Not Repeat。
- `brain/experience/`：任務完成後可重用的反思與流程經驗。

## 遷移規則

- 遷移輸入可以來自任何使用者明確指定的舊工作區；輸出 manifest 只記錄來源的邏輯相對路徑，不保存固定磁碟路徑。
- 每個檔案都要記錄來源 hash、目的 hash、目的相對路徑與遷移狀態。
- 目的檔案已存在且 hash 不同時停止，不自動覆寫；需要新的預覽與使用者決定。
- 外部來源預設唯讀、手動同步；不自動連外、不安裝外部工具。
- 遷移完成後重新計算目的檔案 hash 並核對。

## 寫入邊界

- 任務進度寫入 `planned/` 或專案自己的狀態區，不直接寫入 Brain。
- 只有可重用且有證據的內容才可提升為 Knowledge、Experience 或 Error Log。
- 不儲存 secrets、tokens、cookies、credentials 或私鑰。
- 使用者決定是最終權限；模型只能提出候選、摘要與風險。
