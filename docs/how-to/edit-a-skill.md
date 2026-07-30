# 改技能並重新投影

這篇是給想要修改技能行為的人看的,不是給一般上課教師看的操作指南。如果你只是想用某個技能,不需要看這篇。

## 開始前準備

**你要改的技能名稱**,以及**它在 `brain/skills/` 底下的正本位置**。只改正本,絕不碰 `.claude/skills/` 與 `.agents/skills/` 這兩份投影——它們是自動生成的,你改了也會在下次投影時被覆蓋。

## 核心規則

技能有三份拷貝:一份正本(`brain/skills/`),兩份給不同執行環境用的投影(`.claude/skills/`、`.agents/skills/`)。你只編輯正本,投影用腳本產生。

## 步驟

### 1. 編輯正本

打開 `brain/skills/<技能名稱>/SKILL.md`,直接修改內容。

### 2. 防重檢查

```bash
node harness/scripts/check-skill-dedup.mjs --require-ready
```

這一步確認你的改動沒有跟其他技能重複或衝突。沒有回報 READY 之前不要往下做。

### 3. 先預覽投影計畫,不加 `--apply`

```bash
node harness/scripts/project-skills.mjs
```

不帶 `--apply` 時,這個指令只會印出計畫,不會真的動任何檔案——這是硬規定,先看計畫再決定要不要真的套用。

### 4. 確認計畫沒問題,再實際套用

```bash
node harness/scripts/project-skills.mjs --apply --allow-update
```

因為你是在更新既有的投影,不是新增,所以要加 `--allow-update`。少了這個旗標,更新既有投影會被擋下來。

## 你會看到什麼輸出

跑上面的指令,你會看到幾種關鍵字樣,意思是:

| 輸出 | 意思 |
|---|---|
| `SKILL_PROJECTION_READY` | 防重檢查通過,可以繼續往下投影 |
| `NO_CHANGES_USE_--apply` | 預覽時沒有實際套用,提醒你要加 `--apply` 才會真的動檔案 |
| `BLOCKED` | 有問題被擋下來,不會繼續投影 |
| `RECOVERY_REQUIRED` | 上一次投影中斷了,要先復原才能做下一次 |

完整的指令與輸出說明,見[指令參考](../reference/commands.md),這裡不重複列。

## 中斷時怎麼辦

如果投影過程中斷,先跑:

```bash
node harness/scripts/project-skills.mjs --recover
```

復原完成前,不能做下一次 `--apply`。

## 常見狀況

**「它說 BLOCKED」**
代表防重檢查或投影計畫發現問題,通常是技能內容跟既有技能重複或衝突。看指令的輸出訊息,先處理掉問題再重跑第 2 步。

**「它說 RECOVERY_REQUIRED」**
代表上一次投影沒有正常跑完。先用 `node harness/scripts/project-skills.mjs --recover` 復原,復原前不要嘗試下一次 `--apply`。

**「我改了投影結果被覆蓋」**
`.claude/skills/` 跟 `.agents/skills/` 是自動生成的投影,不是正本。只要正本或投影腳本再跑一次,你直接改在投影上的內容就會被蓋掉。要保留改動,一定要改在 `brain/skills/` 的正本上。

**「這是內建技能,我改的東西下次更新會不會不見」**
會。你改的如果是內建技能檔案,上游更新時可能會覆蓋你的改動。想長期保留自己的修改,要走 fork 或開 issue,不要直接改內建檔案後期待它永遠留著,細節見[更新怎麼運作、你的修改會怎樣](../explanation/how-updates-work.md)。

## 相關

- [指令參考](../reference/commands.md) — 完整指令與輸出訊息說明
- [為什麼同一個技能有三份](../explanation/why-three-copies.md) — 正本與投影分開設計的原因
- [更新怎麼運作、你的修改會怎樣](../explanation/how-updates-work.md) — 內建檔案被上游更新覆蓋時該怎麼辦
