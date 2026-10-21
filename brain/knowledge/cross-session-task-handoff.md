---
name: cross-session-task-handoff
description: 跨 Codex session 交接任務時，以 AGENTS、active plan、checkpoint 與 evidence 分層承接，避免重複規則與狀態漂移
type: user
triggers: [跨 session, 新 session, session handoff, handoff, task handoff, 交接, 交代任務, 繼續任務, continuation, 討論指令, context handoff]
updated: 2026-09-09
---

# 跨 session 任務交接規則

## 核心原則

新 session 不繼承前一個 session 的對話內容。交接應該**指向既有 SSOT，不複製既有規則與整份狀態**。

- `AGENTS.md`：穩定的全域／目錄治理規則。若新 session 位於適用的 workspace 路徑，先確認它是否已自動載入；不要把全文再貼進 handoff prompt。
- `planned/<plan>.md`：該任務的拓樸、交付清單、驗收條件、checkpoint 與節點狀態。
- `projects/<topic>/`：可持續修改的 source／project SSOT。
- `outputs/<topic>/`：build、test、runtime、CDP 等匯出證據，不是 source 或第二份 project。
- handoff prompt：只承載任務入口、目前使用者意圖、write-target 與本回合第一個動作。

## How to apply

1. 新 session 開始時，先確認目前工作目錄適用的 `AGENTS.md`。同一 workspace 已自動載入時，不重複貼規則；若工作目錄不同或載入狀態不明，才唯讀確認。
2. 讀取 active plan 與最近 checkpoint／evidence；前一個 session 的口頭「已完成」不是證據。
3. 依任務主題執行 CONSULT：搜尋 `brain/error-log` 與 `brain/knowledge`，命中的規則先讀完，再開始工作。
4. 若路徑、Git 狀態、外部服務或前一 session 的實際進度不確定，第一回合只做唯讀 preflight，回報實際狀態與下一個 gate，等待使用者確認。
5. 精簡 handoff 至少包含：任務目標、active plan 路徑、唯一 write-target、本回合動作、需要使用者決定的 gate。不要複製 `AGENTS.md`、整份計畫或可能快速過時的完整狀態表。
6. 每個節點仍須以保存證據後才能標記「已執行」，並在進入下一節點前更新 checkpoint 與做 drift review。
7. 若 session 間外部狀態有變，重新做 preflight；不要沿用舊 session 的路徑、依賴或完成判斷。
8. 同一主題被使用者更正兩次以上時，停止字面補丁，回到最小不變式與 SSOT 分層重新整理。
9. portable handoff、plan 與 memory 只寫 repository-relative path；不要寫入磁碟代號、使用者名稱、帳號、秘密或 session ID。

## 最小 handoff 範本

```text
請接續 <任務名稱>。

請使用本 session 已載入的 AGENTS.md，不要複製其中規則。
請讀取：
- <active plan>
- brain/knowledge/agent-memory-discipline.md

依 CONSULT-before-act 搜尋並讀取相關 brain/error-log 與 brain/knowledge。
本回合只做 <唯讀 preflight／指定節點>。
唯一 write-target：<projects-relative-path>
完成後回報 <指定證據、狀態與 gate>，等待使用者確認。
```

## 邊界

這份記憶是跨 session 的工作方法，不取代 `AGENTS.md`、使用者當次指示、active plan 或目前可驗證的程式狀態。若它們衝突，以使用者指示與適用的治理／安全規則為準，並先標記衝突。
