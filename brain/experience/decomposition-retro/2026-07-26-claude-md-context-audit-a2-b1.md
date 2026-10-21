---
type: decomposition-retro
plan: 26-07-25-claude-md-context-audit-plan
date: 2026-07-26
reviewer: claude-fable-5-main-session
task_type: docs
unexpected_rework: true
boundary_error: missing
granularity: appropriate
confidence: high
cause_code: context
event_id: 2026-07-26-claude-md-audit-a2-b1
handoff_count: 0
over_decomposition: false
counterexample_searched: true
---

# 拆解回顧：CLAUDE.md 指令鏈瘦身（A2＋B1 執行）

## 對象

依 Claude 5 context engineering 六原則體檢三份指令檔，經三輪裁決後執行 A2（Orchestration 保守去重）＋B1（codex-lanes skill 化），全域檔 20,441 → 9,774 chars。

## 非預期返工

有兩處。(1) 裁決點 A 先裁「A1＋護欄」後改裁 A2——計畫書為 A1 寫的跨模型分析成了沉沒成本，但該分析正是促成改裁的資訊，屬有價值的返工。(2) 動手時才發現 Orchestration 段在 `<!-- pilotfish:begin/end -->` 受管標記內（pilotfish v1.3.1 plugin 管理），計畫階段完全沒預見；被迫臨場改為「保留標記、改內文、記錄升版還原風險」。

## 邊界

漏了一個關鍵前置子任務：「確認目標檔案的**所有權**（誰生成、誰管理、會不會被重寫）」。計畫做了大小測量、內容分類、原則對映，卻沒問「這段文字是誰的」。AGENTS.md 逐行體檢時有做誠實修正（4.8→4.5KB 而非樂觀的 3.5KB），這條邊界抓得對。依賴排序正確：skill 先建成、投影驗證通過後才動全域檔，中途失敗不會留下斷 pointer。

## 主因（一句話）

計畫階段只讀了檔案「內容」沒讀檔案「開頭的管理標記」——體檢瘦身類任務的 discovery 應包含目標檔的生成／管理來源檢查。

## 替代解釋（必填，至少一個）

也可能不是拆解問題而是工具視角問題：系統提示注入的 claudeMd 內容不含 HTML 註解標記（或被忽略），所以「計畫時看不到標記」是資訊通道的限制，非拆解疏漏；只有實際 Read 原檔才會看到，而 Read 原檔本來就排在執行階段。若如此，教訓是「改任何檔前先 Read 原檔」（本來就做了，且正因此在寫入前發現了標記），流程其實正常運作。

## 成功面（必填）

三輪 AskUserQuestion 裁決把「砍全域規則」這種高風險決策完全交給使用者，且每輪都補了使用者真正要的比較維度（優缺點→新舊模型影響→白話比喻），沒有一次擅自動手；備份先行；skill 建立走完 dedup→registry→預覽→apply 全治理流程一次通過；validate-harness 失敗正確歸因為既有問題並外掛成獨立任務，沒有混入本次改動。

## 暫定啟發（可留空）

瘦身／重寫既有檔案的計畫，discovery 清單加一條：檔案是否含生成器或 plugin 的受管標記（`begin/end` 註解、generated 警語），所有權不明前不要承諾改寫幅度。
