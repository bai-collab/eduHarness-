---
name: harness-self-improvement-evaluation-boundaries
description: Lilian Weng 對 harness、自我改進、評估器與人類監督邊界的研究整理
type: knowledge-reference
status: recorded-reference
source: https://lilianweng.github.io/posts/2026-07-04-harness/
source_collection: linebot-notes
primary_source: github
primary_source_repo: https://example.invalid/source-omitted-for-share-build/notes
legacy_source_sheet_row: 394
source_fingerprint: sha256:79289fd6f4c4a6f4a80e7bf7cc8da18a1dabe987b4c6973049054071461a9dc7
verified_at: 2026-07-24
---
# Harness 自我改進：評估與監督邊界

## 核心觀點

- Harness 不只是一段 prompt，而是把 context、工具呼叫、subagent、控制流、記憶與工作流程組合起來的程式化系統。
- Harness 本身可成為優化目標，但遞迴結構不保證改善；基礎模型能力與可量測的評估仍是關鍵。
- 自我改進在評估緩慢、模糊或容易被鑽漏洞的任務上風險較高。

## 對本工作區的啟示

- 評估器與權限控制應放在被優化迴圈之外，並保留 held-out tests、trace audit 與重要決策的人類審查。
- 測試通過不能單獨代表長期可維護性；還要檢查 ownership、相容性、遷移成本與未來除錯負擔。
- 人類應移到更高層級的監督位置，而不是從重要決策點完全移除。

## 來源

- Lilian Weng，〈Harness Engineering for Self-Improvement〉：<https://lilianweng.github.io/posts/2026-07-04-harness/>
- 查核日期：2026-07-24。

