---
name: planning-and-task-breakdown
description: Use when Claude or Codex must break an approved spec, PRD, or complex request into ordered, testable tasks with dependencies, owners, validation, and rollback. Produces a task plan or task-state draft. Do not use for brand-new architecture decisions before a PRD; use spec-driven-development first.
---

# 任務規劃與分解

## Shared Routing Contract

- Trigger: approved PRD/spec, user asks for /plan, phased execution order, dependency map, or task breakdown.
- Do not use when: feature scope is still undefined; route to spec-driven-development first.
- Inputs: approved goal/spec, constraints, acceptance criteria, repo/project context.
- Outputs: ordered task list, dependencies, verification, blockers, rollback, owner, and next action.
- Runtime boundary: planning only unless the user explicitly asks to execute.
- Validation: each task has measurable completion criteria and a feasible verification path.
- Do Not Repeat: do not label vague ideas as executable tasks.

## 核心目標

將模糊的「做一個功能」轉化為具體的「執行清單」。每個任務必須：小到一次完成、有明確的完成條件、獨立可驗證。

## 何時使用

- 收到已確認的 PRD 後。
- 任何預計超過 30 分鐘的開發任務。
- 跨模組的變更。
- 使用者輸入 `/plan` 時強制觸發。

## 流程 (Process)

### Step 1：依賴分析
1. 列出所有需要修改的檔案與模組。
2. 畫出模組之間的依賴關係（先做底層，再做上層）。
3. 標記外部依賴（API、第三方套件、環境設定）。

### Step 2：切割任務
每個任務必須符合 **SMART** 原則：
- **S**pecific（具體）：「在 UserService 中加入 getById 方法」而非「實作使用者功能」。
- **M**easurable（可衡量）：有明確的測試案例或驗收標準。
- **A**chievable（可完成）：單一 Commit 可完成。
- **R**elevant（相關）：直接對應 PRD 中的驗收標準。
- **T**ime-bound（有時限）：預估 30 分鐘以內。

### Step 3：排序與風險標記
```
- [ ] 🟢 Task 1: 建立資料模型 (低風險，無外部依賴)
- [ ] 🟢 Task 2: 實作 Repository 層 (低風險，依賴 Task 1)
- [ ] 🟡 Task 3: 整合第三方 API (中風險，需要 API Key)
- [ ] 🔴 Task 4: 資料遷移腳本 (高風險，不可逆操作)
```

### Step 4：建立 task.md
將排序後的任務寫入 `task.md`，每個任務包含：
1. 任務描述（一句話）
2. 修改的檔案列表
3. 驗收標準（至少一條）
4. 風險等級（🟢🟡🔴）

## 行為防護 (Anti-Rationalization)

| 藉口 | 共同治理反駁邏輯 |
|---|---|
| 「任務太小了，不需要拆。」 | **拒絕**。如果你不能在一句話內描述完成條件，它就不夠小。 |
| 「我先寫完再拆成 Commit。」 | **拒絕**。這代表你沒有規劃。寫完再拆 = 事後合理化。 |
| 「依賴關係太複雜，沒辦法排序。」 | **拒絕**。這正是你需要畫依賴圖的原因。複雜 = 更需要規劃。 |
| 「反正只有我一個人做，不需要這麼正式。」 | **拒絕**。你的「未來自己」也是協作者。他會忘記你現在在想什麼。 |

## 紅旗警訊 (Red Flags)

- 🚩 一個任務預估超過 2 小時。
- 🚩 一個任務需要修改超過 5 個檔案。
- 🚩 任務之間存在循環依賴。
- 🚩 `task.md` 中有任務缺少驗收標準。
- 🚩 所有任務都標記為🟢（你在騙自己沒有風險）。

## 驗證門檻 (Verification)

- [ ] `task.md` 已建立，包含所有任務。
- [ ] 每個任務都有一句話描述與驗收標準。
- [ ] 依賴關係已標明（哪個要先做）。
- [ ] 風險等級已標記。
- [ ] 所有🔴高風險任務都有回退方案 (Rollback Plan)。
