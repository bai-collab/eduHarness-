# 把 Codex 記憶中有證據的 AGY「未登入」紀錄誤判為錯誤教訓

## 事件

排查「Codex 一直犯 AGY 呼叫錯誤」時，主 agent 在 Codex 自有記憶（`~/.codex/memories/MEMORY.md`）看到「AGY was not logged in」，只因為它和 `brain/error-log/2026-09-22-agy-empty-response-misdiagnosis.md` 的方向相反，就直接向使用者宣稱「Codex 記憶裡是錯的教訓」，並提議把它改掉。

## 實際情況

回到該次（2026-09-20）Codex session 的原始紀錄，AGY 當次輸出含身分層證據：`You are not logged into Antigravity`、`Authentication required. Please visit the URL to log in`。所以當次判「未登入」**是正確的**。2026-09-22 那則 error-log 是另一個事件（只有空回應與 `denied_actions`，沒有身分證據）。兩則紀錄並不衝突。

真正的缺陷是：那條紀錄被寫成沒有範圍的通則（rollout 摘要甚至寫「未來應保留此限制」），可能讓 Codex 不重新檢查就沿用「AGY 未登入」。

## 錯誤模式

用「另一則紀錄的結論」推定這則紀錄的對錯，沒有回到原始證據。這和 09-22 的錯誤是同一類：證據不足就下結論。同一主題（AGY 登入判定）第二次被證據推翻，依 `brain/knowledge/agent-memory-discipline.md`，之後處理這個主題要回到原則層：每次都以當次原始輸出為準。

## 修正要求

1. 判定一則記憶是對是錯之前，先找它當次的原始輸出（session 紀錄、log）。
2. 記憶中的「狀態」（登入、可用性、版本）一律標註「當次、哪個環境」，不寫成長期事實。
3. 用 session 紀錄搜尋某個字串，來推論 agent「有沒有讀某檔案」時，要先排除那個字串本來就在每次都會載入的規則檔（例如 `AGENTS.md`）裡。

## 處置

`AGENTS.md` 新增「AGY 呼叫守則」；Codex 記憶 4 處改為「當次有證據、不沿用」，並未刪除事實。
