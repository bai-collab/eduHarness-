---
name: grunt-work-done-by-opus
description: 粗工沒派 Codex 也沒派便宜模型，由 Opus 主 session 自己寫，事前也沒列節點分工
type: errorlog
triggers: [Codex, codex exec, 粗工, 寫程式, 派工, 省錢, Sonnet, Haiku, model 分工, 節點分工]
updated: 2026-10-15
---

使用者核准先完成 S2～S6（某外掛實作＋文件）後，主 session（Opus 5.5）沒列出節點的 owner＋model 就直接全部自己寫，沒有派 Codex，也沒有改派較便宜的 Claude 模型；交付時才補一句「沒有使用 Codex」。使用者追問原因，並補充：沒用 Codex 時，粗工要交給 Sonnet 5.5 high 或 Haiku 5.5 max，以節省費用。

**根因：** 把「codex-rescue 寫入工作區磁碟會失敗」的舊教訓，當成「Codex 不可用、所以主 session 自己做」的理由；實際上 `codex exec -s workspace-write` 可寫入工作區磁碟，而且就算不派 Codex，也還有便宜的 Claude subagent 可用。跳過「先列分工給使用者核准」，讓使用者沒有機會決定。

**How to apply:**
1. 實作類工作動手前，先列節點分工（owner＋model）給使用者核准；核准即授權派工。
2. 寫程式、找資料、搬檔等粗工優先 Codex gpt-6-luna max（寫入工作區磁碟用 `codex exec -s workspace-write -m gpt-6-luna -c model_reasoning_effort=max`）。
3. 不派 Codex 時寫明理由，改派 Claude subagent：需要判斷的實作用 Sonnet 5.5 high，機械性重複用 Haiku 5.5 max；Agent 呼叫明帶 `model` 與 `effort`。
4. Opus 主 session 只留規劃、整合、除錯判斷與審查裁決；外審仍交非 Claude 家族（AGY）。

本次證據：S2–S6 交付訊息「這次沒有使用 Codex，程式都是我直接寫的」；記憶 `model-routing-policy` 已補上同一條規則。
