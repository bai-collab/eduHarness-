---
name: explain-visual
description: 圖解先行（visual-first explanation）。當使用者要「理解／解釋」一個機制、流程、架構、依賴關係或狀態轉移時觸發——尤其 route plan、.harness/topology、agent 依賴圖、orchestration 流程、pilotfish/Baton 生命週期、狀態機（enum/transaction state machine）、資料流、before/after 或方案 A vs B 對比、模組重構、檔案/元件結構。原則：先給最小視覺（Mermaid／內建 show_widget 的內聯 SVG／樹狀／pseudocode／diff／custom HTML），文字只當輔助。反觸發：純事實問答、單行就能答完、使用者明說只要文字、已經很清楚不需圖、或涉及需嚴謹逐項錨定的文獻分析（那用「文獻研究」）。
metadata:
  type: reference
---

# 圖解先行（explain-visual）

把「用一段散文解釋複雜機制」的預設，換成「**先給一張最小的圖，文字只補圖說不出的部分**」。核心原則：Skip preamble, show visually first, explain secondarily。

此 skill 是**解說風格紀律**，不是產生器；真正把圖畫好的能力來自既有工具（見「渲染路由」）。它的價值在**兩件事**：① 判斷此刻該不該給圖；② 給的話選哪一種最小形式、用哪個工具渲染。

## 何時該給圖（觸發判準）

出現以下之一，且文字解釋會讓讀者得自己在腦中重組結構時，改用圖解先行：

- **route plan / 計畫書節點與依賴**：節點、owner/model、依賴邊、platform、verifier gate。
- **`.harness/topology.md`、排程器狀態**：RUNNABLE / ALL_DONE / WAITING_HUMAN / DEP_ERROR / STATE_ERROR 的轉移。
- **agent 依賴 / 分工 / fan-out**：誰產出、誰消費、哪些可平行、worktree 隔離邊界。
- **orchestration 生命週期**：discovery→plan→approval→execution→verification 各 gate 的流動。
- **狀態機 / 交易式流程**：狀態、觸發事件、副作用（尤其會寄信／呼叫付費 API／不可逆者）。
- **資料流 / 檢索管線 / RAG 架構**：資料經過哪些節點、在哪裡被切/存/取。
- **對比**：before/after、方案 A vs B、有無某條邊的差異。
- **檔案 / 元件 / 呼叫結構**：目錄樹、component tree、call tree。

## 何時不要給圖（反觸發，優先於觸發）

- 純事實問答、定義、單行答案、是非題。
- 使用者明說只要文字、或情境需要可複製的純文字。
- 一兩句就講得清楚——**硬塞圖會讓輸出顯得 AI 生成、增加雜訊**。
- 需要逐項頁碼/表號錨定的文獻深讀 → 用 `文獻研究`。
- 版面/區塊/碰撞規劃 → 用 `web-layout-topology-analysis`；純數據圖表 → 用 `dataviz`。

不確定時：一句話能更快說清楚，就寫那句話。

## 選型：用最小的形式承載那一個重點

| 內容型態 | 最小形式 |
|---|---|
| 邏輯 / 演算法 | pseudocode（fenced code） |
| 執行期呼叫序 | call tree（縮排文字樹） |
| 檔案 / 目錄 / 元件結構 | file tree / component tree（文字樹） |
| 流程 / 依賴 / 狀態轉移 / 資料流 | Mermaid（flowchart / stateDiagram / sequenceDiagram） |
| 兩案 / 前後對比 | 並排 SVG，或 diff |
| 密集或需互動的概念 | custom HTML（Artifact） |

一圖一主張：一張圖只回答一個問題；箭頭一律標動詞（`writes` / `invalidates` / `polls 30s`），別留「不知怎地有關」的裸箭頭；畫機制本身，不要只畫一個叫「cache」的方框。

## 渲染路由（用既有工具，不自己造輪子）

1. **樹 / pseudocode / diff**：直接用 fenced code block（terminal 一定讀得到，最省）。
2. **流程 / 狀態機 / 依賴圖，想留在對話裡**：優先 `mcp__visualize__show_widget`（內聯 SVG/HTML，先 `read_me`）；或 Mermaid fenced block（Artifact/支援的 renderer 會畫）。
3. **要一張可分享 / 可互動 / 較講究的頁**：做成 **Artifact**；此時**務必先載入 `artifact-design` 與 `artifact-diagramming`**，內聯 SVG 的機制、雙主題 token、`viewBox`、`currentColor`、marker 箭頭、`<figure>+<figcaption>` 都照那份規範走。

內聯 SVG 快則：`viewBox` 定尺寸、`currentColor` 吃雙主題、只保留一個有意義的語意色、箭頭用 `<marker>` 或 `<polygon>`、文字 11–13px、長句放 figcaption 不放圖內。

## 流程

1. **判斷**：符合觸發、且不落入反觸發 → 給圖；否則正常回文字。
2. **選型**：挑能講清那一個重點的最小形式。
3. **渲染**：依上表選工具。
4. **配一句話**：圖擺前面，文字只補圖說不出的（為什麼、注意事項、下一步）。

## 反例（別做）

- 為了「看起來完整」而畫的裝飾圖、把散文重講一遍的方框清單、每個名詞都框起來卻沒有一條有意義的邊。
- 明明一句話的事，硬做成 Artifact。
- 箭頭全裸、沒有主張、一張圖塞五件事。
