---
name: eduharness-brain-router
description: eduHarness 的知識與技能讀取入口——什麼情況該讀哪一層
---
# Brain 路由

## 這是什麼

`brain/` 是這個工作區的記憶。它分成幾層，差別在**什麼時候被讀取**：有些每次啟動都讀，有些只有被任務觸發才讀。

這樣分是為了省 context。把所有東西都塞進每次對話，AI 能拿來思考的空間就變少了，而且是無聲地變少——你只會覺得它後來變笨。

## 啟動時讀

1. `AGENTS.md`——治理規則。
2. 本檔。
3. `brain/instincts/` 全部檔案。短小且跨任務適用，不分任務類型。

## 被任務觸發才讀

- 要執行某類工作 → 對應技能的 `SKILL.md`，一次只讀主要那一個，必要時才讀相鄰的。技能資料夾多數直接放在 `brain/skills/` 底下，通用工程類則收在 `brain/skills/engineering/`；確切路徑以 `harness/config/skill-registry.json` 的 `canonical_path` 為準。
- 需要既有事實或結論 → `brain/knowledge-base/`。
- 做過類似的事且曾經失敗 → `brain/errorLog/`。

## 任務結束後回寫

- 已驗證的失敗與根因 → `brain/errorLog/`。
- 可重用的做法與判斷經驗 → `brain/experience/`。
- 新增任何一層的檔案後，在 `brain/wiki-index.md` 補一行索引。

## 更新時會發生什麼

執行 `git pull` 取得新版時：

- **你自己新增的檔案不會被動到。** 它們不在版本控制裡，更新不會刪除。
- **內建的 `README.md` 與 `TEMPLATE.md` 會被新版覆蓋。** 你若改過它們，`git pull` 可能出現衝突；想要自己的版本請另外開新檔，不要改內建檔。

## 寫入規則

- 只有**可重用且已驗證**的內容才進 Brain；一次性的過程紀錄不要寫進來。
- 不儲存 secrets、tokens、cookies、credentials、私鑰，也不放學生個資。
- 技能只能改 `brain/skills/`；`.claude/skills/` 與 `.agents/skills/` 是自動投影，直接改會在下次投影時被覆蓋。

## 各層一覽

| 層 | 何時讀 | 放什麼 |
|---|---|---|
| `brain/skills/` | 觸發 | 可執行的流程契約 |
| `brain/instincts/` | 每次啟動全量 | 短規則，全目錄上限 200 行 |
| `brain/knowledge-base/` | 觸發 | 經審核的耐久知識 |
| `brain/errorLog/` | 觸發 | 已驗證的失敗、根因、Do Not Repeat |
| `brain/experience/` | 以回寫為主 | 任務後可重用經驗 |
| `brain/wiki-index.md` | 需要找東西時 | 共讀索引 |
