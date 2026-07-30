# 為什麼同一個技能有三份

打開專案你會看到同一個技能出現在三個地方：

```
brain/skills/item-authoring/SKILL.md
.claude/skills/item-authoring/SKILL.md
.agents/skills/item-authoring/SKILL.md
```

三份內容**逐位元組相同**。這不是三個版本，也不是有人忘記刪。

## 為什麼要複製

因為兩家 AI 助理規定的路徑不一樣：

- Claude Code 只認 `.claude/skills`
- Codex 只認 `.agents/skills`

想讓同一套技能兩邊都能用，就得在兩個位置各放一份。這是外部工具的規定，不是這個專案的選擇。

## 那為什麼還要第三份

因為需要一個「正本」。

如果只有兩份投影，你改了其中一份，另一份就落後了。過幾週再看，兩邊內容不一樣，你不會知道哪一份才是對的——而 AI 讀到哪一份取決於你用哪個工具。這種分歧不會報錯，只會讓輸出品質忽好忽壞。

所以 `brain/skills/` 是唯一可以編輯的正本，另外兩份由 `project-skills.mjs` 從正本生成。改正本、重新投影，兩邊一定同步。

## 怎麼確保它們真的一樣

靠雜湊比對，不是靠自律。

`harness/config/skill-registry.json` 記錄每個技能的 SHA-256。投影時比對正本與兩份投影的雜湊，對不上就擋下來：

```bash
node harness/scripts/check-skill-dedup.mjs --require-ready
```

沒印出 `SKILL_PROJECTION_READY` 就代表有東西不一致，這時候不要繼續做別的事，先查清楚。

這樣做的意義是：「投影跟正本一致」變成**可以驗證的事實**，而不是一句承諾。

## 如果你直接改了投影

會發生兩件事：

1. 下次投影時，你的修改被整份覆蓋。
2. 在那之前，雜湊對不上，防重腳本會擋住後續操作。

第 2 點看起來很煩，但它正是在保護你——它讓「有東西不對勁」變得吵，而不是安靜地爛掉。

要改技能，改 `brain/skills/`，見[改技能並重新投影](../how-to/edit-a-skill.md)。

## 為什麼不用符號連結

符號連結（symlink）在 Windows 上需要額外權限，而且很多同步工具、壓縮工具、Git 設定會把它變成一個普通檔案，變成沉默的失敗。複製三份加雜湊檢查比較笨，但在各種環境下都能預期地運作。

## 相關

- [互動架構地圖](../architecture.html) — 用圖看這套關係
- [指令參考](../reference/commands.md) — 投影與檢查指令的完整說明
- [更新怎麼運作、你的修改會怎樣](how-updates-work.md)
