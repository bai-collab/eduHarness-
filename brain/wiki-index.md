# Shared Brain Index

這是可攜式 Brain 的人類可讀入口；機器讀取以 [`index.json`](index.json) 為準。

| 層 | 相對路徑 | 載入方式 | 用途 |
|---|---|---|---|
| Skills | `brain/skills/` | 任務觸發 | 可執行 Skill 與流程契約 |
| Knowledge | `brain/knowledge/` | 按需 | 經審核的技術與領域知識 |
| Instincts | `brain/instincts/` | 啟動輕量載入 | 短小的安全與證據提醒 |
| Error Log | `brain/error-log/` | 按需 | 失敗證據、根因與 Do Not Repeat |
| Experience | `brain/experience/` | 按需 | 可重用的任務後經驗 |

## 治理入口

- Brain 載入規則：[`SKILL.md`](SKILL.md)
- 機器索引：[`index.json`](index.json)

## 讀取邊界

Harness 先讀索引，再依任務目標搜尋候選。除非任務明確要求，系統不會預載全部技術文件或錯誤紀錄全文。
