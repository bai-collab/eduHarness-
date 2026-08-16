# Shared Brain Index

這是可攜式 Brain 的人類可讀入口；機器讀取以 [`index.json`](index.json) 為準。

| 層 | 相對路徑 | 載入方式 | 用途 |
|---|---|---|---|
| Skills | `brain/skills/` | 任務觸發 | 可執行 Skill 與流程契約 |
| Knowledge | `brain/knowledge/` | 按需 | 經審核的技術與領域知識 |
| Templates | `brain/templates/` | 按需 | 可重用的範本與測試素材 |

## 治理入口

- Brain 載入規則：[`SKILL.md`](SKILL.md)
- 機器索引：[`index.json`](index.json)
- Harness Brain adapter：[`harness/core/brain.mjs`](../harness/core/brain.mjs)
- Brain CLI：[`harness/cli/brain.mjs`](../harness/cli/brain.mjs)

## 讀取邊界

Harness 先讀索引，再依任務目標搜尋候選。除非任務明確要求，系統不會預載全部技術文件或範本內容。
本副本只會搜尋與載入索引中列出的 collection；未列出的來源資料不屬於可攜副本。