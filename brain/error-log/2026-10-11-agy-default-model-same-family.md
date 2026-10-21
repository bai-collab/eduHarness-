# AGY 沒指定模型時用了 Claude，外審獨立性不成立

- 日期：2026-10-11
- 事實：
  - 作者是另一個以 Claude 為底的代理宿主（Claude 家族）。用 `agy --mode plan --sandbox --output-format json` 送審，沒有指定 `--model`。
  - AGY 在回覆中自報模型是 Claude Opus 5.5，並主動提醒「同家族不能互審」。
  - `json` 輸出沒有模型欄位。改加 `--model gemini-3.1-pro-high --output-format stream-json` 重審，`init.model` 顯示為 Gemini，才算有效外審。
- 推論：AGY 的預設模型取決於使用者在 AGY 端的設定，不保證是非 Claude 家族。
- How to apply：
  1. 作者是 Claude 家族（含以 Claude 為底的其他代理宿主）時，送 AGY 外審**一律明確指定非 Claude 模型**；用 `agy models` 查可用 id。
  2. 一律用 `--output-format stream-json`，在收據記下 `init.model`；沒有 `init.model` 就判獨立性未知（INCONCLUSIVE）。
  3. 「外審交 AGY」不等於「不同模型家族」；收據要寫實際模型，不能只寫「AGY」。
- 收據：保存在原工作區（未隨附）。
