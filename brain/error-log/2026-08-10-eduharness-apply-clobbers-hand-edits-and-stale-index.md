# eduHarness 發佈：索引未刷新，且 --apply 覆蓋手動編輯

## 症狀

1. v2026.08.0 發佈後，4 個新技能的技能檔都上線了，但教師索引 `docs/reference/skills.md` 沒列它們——使用者以為技能沒推上。
2. 做 v2026.08.1 補丁時，`eduharness-convert.mjs --apply` 又造成兩個回歸（pre-push verifier 抓到）：README 被模板版覆蓋（還原掉使用者在 GitHub 網頁改的 codex 品牌／連結）；CHANGELOG 被重生成，弄丟 v2026.08.0 手動加的「新增能力與文件」NOOA 段。

## 根因

`--apply` 每次都從來源重生成再同步，會蓋掉「發佈後在目標 repo 手動改的東西」：

- **索引未刷新**：`docs/reference/skills.md` 是 `gen-eduharness-skills-doc.mjs` 的產物，但發佈流程沒有先跑 gen，convert 只複製了舊模板 → 新技能進了白名單、技能檔也投影了，唯獨索引落後。技能「清單」若不在每次發佈時由 registry 重新生成，必然漂移。
- **README／CHANGELOG 被覆蓋**：README.md 列在 `manifest.templates`，`--apply` 用模板重生成並蓋掉目標；CHANGELOG 由 ledger 重生成，任何「發佈後手動加在某版條目的 prose」不在 ledger 中，下次 apply 即消失。

## 修復

- 把 `gen-eduharness-skills-doc.mjs` 接進 `eduharness-convert.mjs`：staging 前先重生成索引，fail-closed；新技能一進白名單就自動出現在索引。並補齊 4 新技能的 USAGE 與分類。
- README 移出 `manifest.templates`，改為 eduHarness repo 自管；`--apply` 不再覆蓋使用者的網頁編輯。（代價：全新一次性轉換不會自動產生 README，需首發時另備；既有 repo 不受影響。）
- **CHANGELOG 結構性修**：`convert` 改為從**已發佈的目標 CHANGELOG** 讀舊版內容（缺才回退快取），只草擬新版、逐字保留所有舊版（含發佈後手動加的 prose）。已發佈版本＝權威來源，不再被快取覆蓋。
- 修補 v2026.08.1 時，改以 `git reset --hard` 回已發佈版當乾淨底，只放回修好的索引＋新版條目，避免把 `--apply` 的附帶覆蓋一起提交（此為結構性修之前的一次性繞過）。

## 防護

- 「自動生成物」（索引、registry 投影）一律在**發佈前重新生成**並納入流程，不靠人工同步；缺口要 fail-closed 而非靜默。
- 目標 repo 允許手動維護的檔（README、CHANGELOG 的人工 prose）**不要列為會被 --apply 重生成覆蓋的 template**；否則手動編輯每次發佈都被吃掉。
- 補丁發佈時，先確認 commit 是**乾淨最小 diff**（只含本次意圖的檔）；`--apply` 會帶進非預期的重生成差異，須 `git show --numstat` 逐檔核對，必要時 reset 回乾淨底重做。參見 [[eduharness-rewrite-missed-internal-codename-namespace]]：對外發佈前一定跑 fresh verifier 全庫核對，不可只信流程自帶的綠燈。
