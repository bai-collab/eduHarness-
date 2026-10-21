---
name: utf8-cp950-mojibake-corruption
description: 6 檔中文內容遭 UTF-8↔CP950 誤解讀鏈損壞;3 檔由 git 舊版+手術復原,3 檔永久損失待重建
type: errorlog
triggers: [encoding, mojibake, 亂碼, cp950, big5, utf-8, powershell, 嚗, iconv]
rules:
  - "中文檔一律明確指定 UTF-8,永不用系統預設 CP950 讀寫;發現亂碼(嚗/?)先備份查 git 歷史,不機械轉成 ?(會銷毀位元組資訊)"
  - "破壞性覆寫前必有備份、寫入後立即驗 size;shell 暫存檔一律用 scratchpad 絕對路徑(寫 / 會靜默產生空檔截斷目標)"
updated: 2026-07-09
---

# 2026-07-08 UTF-8/CP950 亂碼損壞事件

## 發現

skill/workflow 優化過程中發現 6 檔中文內容損壞(特徵字 `嚗` + `?` 遺失洞):

| 檔案 | 損壞 | 處置 |
| --- | --- | --- |
| `brain/skills/engineering/tdd/SKILL.md` | 8 處 | ✅ git f40abf7 乾淨版手術復原 |
| `brain/skills/engineering/planning/SKILL.md` | 25 處 | ✅ 同上 |
| `brain/skills/engineering/debugging/SKILL.md` | 29 處 | ✅ 同上 |
| `brain/skills/reading-game-browser-storybook-pipeline/SKILL.md` | 12 行 | ⚠️ git 無乾淨版,待重建 |
| `.agents/workflows/batch-process-paper.md` | 44 行 | ⚠️ 同上(英文 Contract 完好) |
| `.agents/workflows/paper-fetch.md` | 12 行 | ⚠️ 同上(英文 Contract 完好) |

## 根因

檔案在某次(≤2026-06-16 commit 前)被以系統預設編碼(CP950)讀取 UTF-8 內容再存回,中文 3-byte 序列被斬斷:可映射者變成罕見字(嚗、蝔、瘚…),不可映射者變 `?`(位元組永久遺失)。

## 修復方法(可重用)

1. `grep -rl "嚗" --include="*.md"` 全區掃描定位受災檔。
2. `GIT_CONFIG_GLOBAL=<temp>` 繞過 dubious ownership 唯讀查歷史(不動使用者設定):逐 commit `git show <c>:<path> | grep -c 嚗` 找乾淨版。
3. 手術拼接:損壞版 frontmatter/英文 Contract + 乾淨版中文內文;驗證 `嚗=0` 且 size 合理。
4. 無乾淨版者:`line.encode('cp950').decode('utf-8')` 理論可逆,但實測 `?` 洞會級聯破壞鄰近字 → 放棄機械轉換,保留原亂碼(資訊量較高)。

## 失敗嘗試(Do Not Repeat)

- awk 手術腳本把暫存檔寫到 `/`(Permission denied)→ cat 空檔 → **目標檔被截斷成 0 byte**。靠事前 `.trash/` 備份救回。教訓:破壞性覆寫前必有備份 + 寫入後立即驗 size。
- 容錯 iconv 逆轉讓 `?` 從 12→21 行擴散,立即從備份回滾。
