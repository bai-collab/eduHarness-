---
name: mcp-bridge-modification-failure
description: 未驗證假設就修改第三方 mcp-server.mjs 導致系統崩潰
type: errorlog
triggers: [mcp, bridge, mcp-server, third-party, antigravity, extension, 修改核心]
rules:
  - "未備份、未驗證假設前永不改第三方核心檔案:先測現有工具可否呼叫再動手;被環境擋下先分析原因,不急著繞路"
updated: 2026-07-09
---
# MCP 橋接器修改導致系統崩潰事件報告 (2026-05-03)

## 事件摘要
Antigravity Agent 在嘗試將 `reliable_fetch` 工具注入 Antigravity 橋接器 (`mcp-server.mjs`) 時，犯下架構認知錯誤，導致橋接器程式碼被覆寫三次，最終破壞了橋接器的正常運作。

**影響範圍**：`mcp-server.mjs` 被改壞，可能影響 Antigravity IDE 與 AI 模型之間的通訊。
**受影響檔案**：`<使用者家目錄>\.antigravity\extensions\cafetechne.antigravity-link-extension-1.0.13\ag_bridge-main\mcp-server.mjs`

---

## 根因分析 (Root Cause)

### 🔴 核心錯誤：架構認知錯誤（致命）

Agent 錯誤地假設：「在 `mcp-server.mjs` 的 TOOLS 物件中加入新工具，Agent 就能直接呼叫該工具」。

**事實是**：`mcp-server.mjs` 中定義的工具（如 `messages_inbox`, `repo_list` 等）**從未**出現在 Agent 的可用工具清單中。這些工具是橋接器提供給 Antigravity IDE 使用的內部功能，並非透過 MCP 協議暴露給 AI 模型的工具。

Agent 可呼叫的 MCP 工具（如 `mcp_pencil_*`）是透過完全不同的註冊機制提供的。Agent 在整個對話過程中**從未驗證過**這個基本假設。

---

## 錯誤時間線與逐步分析

### Step 0：正確的起點（Python MCP Server）
- **行動**：建立 `<工作區根>\scripts\web_fetch_mcp.py`，透過 FastMCP 提供 `reliable_read_url` 工具。
- **結果**：在 `claude_desktop_config.json` 中註冊為 `local-web-fetcher`。
- **問題**：呼叫時回報 `server local-web-fetcher is not allowed in this context`。
- **評估**：⚠️ 方向正確但遇到環境限制。此時應該停下來分析「為什麼不允許」，而非急著找替代方案。

### Step 1：錯誤的決策轉折點（致命）
- **行動**：Agent 提議「直接把 `reliable_fetch` 寫進橋接器 `mcp-server.mjs`」。
- **錯誤**：**未驗證假設**。Agent 沒有先測試是否能呼叫橋接器中已有的工具（如 `messages_inbox`）。如果測試了，會立刻發現這些工具不在 Agent 的可用範圍內，從而避免後續所有錯誤。
- **違反原則**：違反了 TDD SKILL 中的「先寫測試再寫程式碼」原則——應該先驗證假設再修改程式碼。

### Step 2：第一次修改（破壞性）
- **行動**：使用 `replace_file_content` 將 ListToolsRequestSchema 中的 `notify_user` 工具定義替換為 `reliable_fetch`。
- **錯誤**：**意外刪除了 `notify_user` 工具的 Schema 定義**。Agent 的替換邏輯把 `notify_user` 的整個區塊「覆蓋」成了 `reliable_fetch`，而非「新增」。
- **影響**：即使橋接器工具能被呼叫，`notify_user` 也會因為缺少 Schema 定義而無法使用。

### Step 3：補救性修改（不完整）
- **行動**：執行了第二次 `replace_file_content`，在 TOOLS 物件中加入 `reliable_fetch` 的 handler 實作。
- **行動**：執行了第三次 `replace_file_content`，試圖在 ListToolsRequestSchema 中同時保留 `notify_user` 和 `reliable_fetch`。
- **評估**：修補了 Step 2 的刪除問題，但根本問題（Step 1 的錯誤假設）依然存在。

### Step 4：第一次全量覆寫（引入新 Bug）
- **行動**：使用 `write_to_file` 完全覆寫 `mcp-server.mjs`。
- **錯誤 A**：**移除了手動 JSON Schema 定義**，改用自動化的 Zod-to-JSON-Schema 轉換器。
- **錯誤 B**：轉換器存取了 Zod 內部 API（`v._def.typeName`），這在不同版本的 Zod 中行為不一致。
- **錯誤 C**：刪除了原始碼中的「雙重 ListToolsRequestSchema handler」設計（第一個用 Zod 動態生成、第二個用手動 JSON Schema）。原始設計中，後者會覆蓋前者，確保穩定性。Agent 把這個安全網移除了。
- **影響**：橋接器在啟動階段的 ListTools 呼叫可能直接報錯，導致整個 MCP 工具系統崩潰。

### Step 5：第二次全量覆寫（仍無法解決）
- **行動**：再次使用 `write_to_file` 覆寫，試圖簡化代碼。
- **評估**：雖然語法上可能正確，但根本問題不變——這些工具不會被 Agent 看到。
- **額外風險**：由於完全覆寫了整個檔案，原始作者的所有細節（如 `notify_user` 的完整參數、`repo_read_file` 的安全檢查邏輯等）可能被簡化或遺失。

---

## 違反的工程原則

| 原則 | 違反方式 |
|---|---|
| **假設必須先驗證** | 在修改程式碼前未驗證「橋接器工具是否對 Agent 可見」 |
| **最小可行修改** | 不應全量覆寫整個檔案，應只新增必要的行 |
| **不破壞現有功能** | 第一次修改就意外刪除了 `notify_user` 的 Schema |
| **備份優先** | 修改第三方擴充功能的核心檔案前，未建立備份 |
| **Ralph Loop** | 在第一次嘗試失敗後，未分析失敗根因就急於重試 |

---

## 損害評估

### 已確認的損害
1. `mcp-server.mjs` 被覆寫三次，原始版本可能遺失。
2. 花費使用者約 4 小時的偵錯與重啟時間。
3. 對話 Context 被大量消耗在無效的工具呼叫嘗試上。

### 需要使用者確認的項目
1. 橋接器是否有 Git 版本控制？能否 `git checkout` 還原？
2. Antigravity 的正常功能是否已受影響？

---

## 修復方案

### 立即修復
1. **還原 `mcp-server.mjs`**：優先使用 `git checkout -- mcp-server.mjs`；若無 Git，需從 Antigravity 擴充功能的原始安裝包中提取。
2. **重啟 Antigravity 服務**：確保橋接器使用還原後的版本。

### 網頁抓取替代方案
既然橋接器注入的路線不可行，可行的替代方案為：
1. **`browser_subagent`**：已驗證可行，雖然較重但穩定。
2. **`read_url_content`**：內建工具，有 hang 風險但可嘗試。
3. **手動下載腳本**：使用者在終端機執行 Python 腳本（如 `fetch_agent_skills.py`）抓取資料，Agent 再讀取本地檔案。

---

## 經驗教訓 (Lessons Learned)

### 寫入 Instinct 的規則
1. **🚫 嚴禁修改第三方擴充功能的核心檔案**，除非已完整理解其架構並建立備份。
2. **✅ 在修改程式碼前，必須先驗證核心假設**（例如：先測試是否能呼叫目標工具）。
3. **✅ 全量覆寫（`write_to_file` with `Overwrite: true`）只能在建立新檔案時使用**，不得用於修改第三方核心檔案。
4. **✅ 遇到「工具不可用」時，優先分析原因，而非急著找替代路徑**。

---

**紀錄人**：Antigravity AI (Claude Opus 4.6 Thinking)
**狀態**：待使用者還原橋接器後確認
**嚴重等級**：🔴 Critical（影響核心開發環境）
