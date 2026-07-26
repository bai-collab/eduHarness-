---
name: spec-driven-development
description: Use when Claude or Codex must plan a new feature, architecture, multi-file workflow, API boundary, or risky implementation before coding. Produces a PRD, implementation plan, acceptance criteria, out-of-scope list, and validation plan. Do not use for tiny bugfixes or read-only answers; use TDD/debugging skills for logic fixes and failures.
---

# 規格驅動開發

## Shared Routing Contract

- Trigger: new feature, new architecture, multi-file workflow, API/module boundary, project setup, or user explicitly requests spec / PRD / implementation plan.
- Do not use when: the task is a small one-file bugfix, pure verification, or a direct question that needs no durable plan.
- Inputs: user goal, current project context, relevant AGENTS/docs, constraints, acceptance criteria if supplied.
- Outputs: PRD or implementation plan with scope, non-goals, phase breakdown, validation, rollback, and approval gate.
- Runtime boundary: do not edit implementation files until the plan is approved unless root Fast Track rules apply.
- Validation: plan must include measurable acceptance criteria and at least one concrete verification path.
- Do Not Repeat: do not call a prototype or idea a spec until behavior, constraints, and validation are explicit.

# 規格驅動開發 (Spec-Driven Development)

## 核心目標

確保每一行程式碼都有明確的規格依據。沒有規格的程式碼是「技術債的起源」。

## 何時使用

- 啟動任何新專案或新功能。
- 進行涉及多個檔案或多個模組的變更。
- 修復涉及行為改變的 Bug。
- 使用者需求模糊或不完整時。

## 流程 (Process)

### Step 1：需求釐清
在動手之前，回答以下問題：
1. **誰** 是使用者？（角色、情境）
2. **做什麼**？（具體行為描述）
3. **為什麼**？（商業價值或技術必要性）
4. **邊界在哪**？（明確列出「不做什麼」）

### Step 2：撰寫 PRD
PRD 必須包含以下區塊：

```markdown
# [功能名稱]

## 目標
一句話描述這個功能要解決什麼問題。

## 使用者故事
作為 [角色]，我想要 [行為]，以便 [價值]。

## 指令 / API 介面
列出所有對外的介面（端點、CLI 指令、UI 元件 Props）。

## 資料結構
定義核心資料模型與狀態流轉。

## 驗收標準
- [ ] 條件 A 時，系統應該做 X。
- [ ] 條件 B 時，系統應該做 Y。
- [ ] 錯誤條件 C 時，系統應該回傳 Z。

## 不做的事 (Out of Scope)
明確列出本次不實作的功能。

## 技術限制
列出已知的技術債、相依性或環境限制。
```

### Step 3：審核與確認
- PRD 必須經過使用者確認後才能開始實作。
- 對 PRD 中的每一條驗收標準，預先設計對應的測試案例。

### Step 4：實作對齊
- 開發過程中，每完成一個功能點，回頭對照 PRD 的驗收標準。
- 若實作過程中發現 PRD 有遺漏，**先更新 PRD，再繼續編碼**。

## 行為防護 (Anti-Rationalization)

| 藉口 | 共同治理反駁邏輯 |
|---|---|
| 「需求很簡單，不需要寫規格。」 | **拒絕**。越簡單越容易被忽略。三行規格也是規格。 |
| 「先寫 Code 做 Prototype，之後再補規格。」 | **拒絕**。Prototype 會變成正式版。先寫規格才能區分 MVP 與技術債。 |
| 「使用者自己也不知道要什麼，寫規格沒意義。」 | **拒絕**。正因為需求模糊，更需要用規格來逼出具體問題。 |
| 「這是 Hotfix，沒時間寫規格。」 | **拒絕**。Hotfix 的驗收標準只需要一行：「問題 X 不再重現」。這不花時間。 |

## 紅旗警訊 (Red Flags)

- 🚩 開始寫程式碼時，無法回答「這個功能的驗收標準是什麼？」
- 🚩 PRD 中的「不做的事」區塊是空的。
- 🚩 實作過程中反覆修改需求，但 PRD 從未更新。
- 🚩 使用者在 Review 時才第一次看到功能行為。

## 驗證門檻 (Verification)

- [ ] PRD 已建立並經使用者確認。
- [ ] 每條驗收標準都有對應的測試案例。
- [ ] 「不做的事」區塊至少有一項。
- [ ] 實作完成後，所有驗收標準均已通過。
