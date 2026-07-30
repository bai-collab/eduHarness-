# 資料夾結構

每個資料夾放什麼、誰可以改、什麼時候被讀取。「可以改嗎」那一欄是最常被問的，先看它。

## 頂層

| 路徑 | 放什麼 | 可以改嗎 |
|---|---|---|
| `brain/skills/` | 18 個技能的正本 | ✅ 唯一可編輯技能的地方 |
| `brain/SKILL.md` | 讀取路由——AI 什麼情況讀哪一層 | ✅ 內建檔，改了更新會覆蓋 |
| `brain/instincts/` | 每次啟動全量載入的短規則 | ✅ 你可新增檔案；上限 200 行 |
| `brain/knowledge-base/` | 經審核的耐久知識 | ✅ 你可新增檔案 |
| `brain/errorLog/` | 已驗證的失敗與根因 | ✅ 你可新增檔案 |
| `brain/experience/` | 任務後的可重用經驗 | ✅ 你可新增檔案 |
| `brain/wiki-index.md` | Brain 索引 | ✅ 內建檔 |
| `.claude/skills/` | 給 Claude Code 讀的投影 | ❌ 自動生成，改了會被覆蓋 |
| `.agents/skills/` | 給 Codex 讀的投影 | ❌ 自動生成，改了會被覆蓋 |
| `harness/scripts/` | 投影與防重工具 | ⚠️ 可改但屬內建檔，更新會覆蓋 |
| `harness/config/` | registry 等設定 | ⚠️ 同上 |
| `docs/` | 這份手冊 | ⚠️ 內建檔，更新會覆蓋 |
| `RELEASE-NOTES/` | 各版本說明 | ❌ 隨發佈生成 |
| `CHANGELOG.md` | 更新紀錄 | ❌ 隨發佈生成 |

「內建檔，更新會覆蓋」和「你可新增檔案」的差別很重要，見[更新怎麼運作、你的修改會怎樣](../explanation/how-updates-work.md)。簡單說：**你自己新增的檔案 `git pull` 不會刪；你改過的內建檔會被覆蓋。**

## 一個技能長什麼樣

```
brain/skills/item-authoring/
  SKILL.md              技能本體：定位、觸發、必要輸入、流程、輸出契約、停止規則
  agents/openai.yaml    給 Codex 的顯示設定（有些技能才有）
```

多數技能直接放在 `brain/skills/` 底下，通用工程類收在 `brain/skills/engineering/`（例如 `brain/skills/engineering/api-design`）。確切路徑以[技能一覽](skills.md)的「正本路徑」欄或 `harness/config/skill-registry.json` 為準。

## 三份同名資料夾是怎麼回事

`brain/skills/`、`.claude/skills/`、`.agents/skills/` 裡有同名的技能，內容逐位元組相同。一份是正本、兩份是投影，不是三個版本。原因見[為什麼同一個技能有三份](../explanation/why-three-copies.md)。

## 記憶層各自何時被讀

| 層 | 讀取時機 |
|---|---|
| `brain/instincts/` | 每次對話啟動，全量 |
| `brain/skills/` | 被相關任務觸發 |
| `brain/knowledge-base/` | 被相關任務觸發 |
| `brain/errorLog/` | 被相關任務觸發 |
| `brain/experience/` | 主要在任務後回寫 |

為什麼要分這兩種時機，見[記憶層與 context 預算](../explanation/brain-memory.md)。

## 相關

- [技能一覽](skills.md)
- [指令參考](commands.md)
- [互動架構地圖](../architecture.html)
