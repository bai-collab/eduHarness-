# Agent 記憶紀律（讓錯誤不重犯的可攜規格）

- 定位：把 Claude Code 的持久記憶紀律抽成**與平台無關**的規則，供 **Codex** 或任何 agent 參考採用。
- 為什麼需要：Claude 有「系統自動把相關記憶注入 context」的機制；**Codex 沒有**。所以對 Codex 而言，光在對話裡講、甚至把規則寫進檔案都不夠——**少了「動工前主動讀」這一步，寫再多都不會被看到**。「講不聽」的真正原因通常是**只寫不讀，或根本沒寫**，不是固執。

---

## 核心迴路：CONSULT → ACT → CAPTURE

一則錯誤要「不再犯」，必須走完三步，缺一不可：

1. **CONSULT（讀，最常被 Codex 漏掉）**：任務開頭，先用任務關鍵詞掃既有規則與錯誤紀錄，命中就先讀再動。
2. **ACT（做）**：依讀到的規則執行。
3. **CAPTURE（寫）**：被更正／踩雷的**當下**，立刻寫成一則持久紀錄，供下次 CONSULT 命中。

> Claude 的 CONSULT 由系統自動完成；**Codex 必須把 CONSULT 明確寫進自己的作業開頭**（見文末「接線」）。

---

## CAPTURE：一則紀錄怎麼寫

**單一事實 = 單一檔案**。格式：

```markdown
---
name: <short-kebab-slug>
description: <一行摘要，供未來判斷相關性>
type: feedback | errorlog | project | reference | user
triggers: [關鍵詞, 未來會被 grep 到的詞, ...]
updated: YYYY-MM-DD
---

<事實本身。type=feedback/errorlog 必附：>
**Why:** <為何會這樣／為何這條重要>
**How to apply:** <下次具體怎麼套用>
```

- 用 `[[其他-slug]]` 連相關紀錄（連結liberally，指到還沒建的也沒關係）。
- **`triggers` 要放未來 grep 得到的詞**——這是 CONSULT 能不能命中的關鍵。
- 錯誤紀錄多寫一段**根因**：常常不是「做錯動作」，而是某個上游誤解（例：用一個窄例代表整條通則、把原則鑄成固定拓樸）。

**存哪**（本 repo）：
| 內容 | 位置 | 檔名 |
|---|---|---|
| 可驗證的失敗／被糾正的教訓 | `brain/error-log/` | `YYYY-MM-DD-<topic>.md` |
| 可重用的工作方法／原則 | `brain/knowledge/` | `<topic>.md` |

## CONSULT：怎麼讀（Codex 的補課）

任務開頭固定做：

```bash
# 用任務主題的關鍵詞掃紀錄的 triggers/description/內文
grep -ril "<主題關鍵詞>" brain/error-log brain/knowledge
```

- 有命中 → **先讀完再動手**，把命中的 `How to apply` 當硬約束。
- **同一主題被糾正 ≥2 次** → 立刻停手，去讀該主題的 error-log，回**原則層**重述一次讓使用者確認，不要再打字面補丁。

## 寫入紀律（避免記憶自己爛掉）

1. 寫前先查有沒有既有檔——**更新原檔勝過建重複**；同義多檔＝多份 SSOT，禁止。
2. 規則證實是錯的 → **刪掉**，不要留著誤導。
3. **不記 repo 已經記錄的**（程式結構、git 歷史、既有文件）；記的是「非顯而易見、下次會踩」的那一點。
4. 相對路徑；不放磁碟代號、帳號、密鑰、session id。
5. **「使用者要求／偏好」必須附使用者原話**，而且原話要在那段對話裡使用者自己送出的訊息找得到；找不到就不記成使用者要求。hook 回饋、外掛提醒（如用量提醒外掛送出的訊息）、自動注入的教訓、`system-reminder` 與代理自己寫的內容，都不是使用者說的。
6. **代理提出、使用者只回「好」的事，記成「決定」**（type=project，附日期與當時的選項），不記成使用者的偏好或糾正（type=user／feedback）。兩者效力不同：決定可隨情況重議，糾正是硬約束。
7. **人刪掉的紀錄不准自動加回**：使用者手動刪除或要求刪除的紀錄，在該主題的紀錄（或刪除當下的 error-log）留一行「已刪除：<標題>（日期、原因）」當墓碑；之後要再寫同標題的內容，必須附使用者新的原話，否則不寫。
8. **事實類紀錄會過期**：`project`／`reference` 類超過 30 天沒有新根據（沒被用到、沒被核對），引用前先核對現況；核對仍正確就更新 `updated` 日期，已不正確就改寫或刪除。偏好與糾正（`user`／`feedback`）不因時間過期，只在被推翻時改。

> 第 5–8 條改寫自 cablate/ctx-handoff-mod（MIT）的記憶整理設計（引用比對、決定與要求分開、墓碑、30 天封存）；原設計由程式強制，本 repo 目前只作為寫入紀律，由寫入的代理自行遵守。

---

## 接線：讓 Codex 真的會讀（否則本檔也白寫）

Codex 讀 `AGENTS.md` 與 repo 檔，**不會自動 recall**。三選一，讓 CONSULT 一定發生：

1. **寫進 `AGENTS.md`**（Codex 每次都讀）：加一句「動工前先 `grep` `brain/error-log` 與 `brain/knowledge` 命中的主題並遵守」。← 最穩，但屬治理 SSOT 變更，需使用者核准。
2. **寫進每次 `codex:codex-rescue` 的任務 brief 開頭**：「先讀 `brain/error-log/` 中 triggers 命中 <主題> 的檔，再開始」。← 不改治理、逐次生效。
3. **在該類任務目錄放一個 `AGENTS.md`**（Codex 讀 nested）：只放該主題必守的教訓連結。

> 診斷用：若 Codex 仍重犯，先確認是哪一步斷了——沒寫（CAPTURE 缺）、寫了沒讀（CONSULT 缺、多半是這個）、讀了沒套（brief 沒把 How to apply 當硬約束）。

## 範例（本 repo 現成）

- 錯誤紀錄範例：`brain/error-log/2026-09-09-review-independence-misencoding.md`（含 triggers/rules/根因四段）。
- 方法知識範例：`brain/knowledge/workspace-neuroplasticity-operating-manual.md`。
