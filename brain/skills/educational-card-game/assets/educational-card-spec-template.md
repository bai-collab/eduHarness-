# 教育卡牌規格

## 1. 遊戲摘要

- `gameId`：
- 題名／主題：
- 年級／時間／玩家：
- 卡牌原型：
- DOM-only 任務：
- 完成條件：

## 2. 規則不變式

- Zone：牌庫、手牌、場上、棄牌與補救區的唯一性：
- 合法操作與費用先驗證：
- card move：remove-then-add 與重複／遺失 assertion：
- effect queue：FIFO／LIFO：
- 失效目標：fizzle／取消／重新選目標：
- PRNG／shuffle 版本與 seed：
- 手牌上限／牌庫耗盡／資源曲線／提示代價：
- 勝負與學習完成條件：

## 3. 學習狀態

| objectiveId | 作答證據 | 錯誤概念 | 提示 | 補救卡 | 事件代碼 |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## 4. 卡牌資料

每張卡使用 `references/card-data.schema.json`。不得只寫卡名、世界觀或美術；必須有答案、理由、回饋、補救與來源。

## 5. 輸出與驗收

- game design spec：
- level map：
- question／feedback bank：
- layout plan：
- asset ledger：
- teacher guide：
- playtest plan：
- 未解問題與停止條件：
