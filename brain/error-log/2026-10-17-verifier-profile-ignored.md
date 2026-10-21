# 沒有宣告 profile，所有節點都套上最重的審查

- 日期：2026-10-17
- 情境：某教學網站拆分計畫的 S3、S4。
- 事實：
  - Route Plan 從頭到尾沒有宣告 Simple／Standard／Complex，也沒有寫 verifier mode。
  - 實際做法：每份計畫跑 security-reviewer 1 次、plan-verifier 最多 2 輪；每個子片都跑 AGY 外審；每個安全子片另跑 fresh verifier；最後再跑整合 verifier。
  - 使用者更正：說明已設定三種檢核跑法——簡單不跑、普通最後跑、嚴重每個節點跑，並質疑為何現在每個節點都跑審查。
- 原因：把全域 CLAUDE.md 的「風險觸發」（安全相關就必跑 plan-verifier＋verifier）逐片套用，沒有先依 AGENTS.md「Verifier 依 profile 節流」決定整個任務的級別；也沒有在計畫書寫出 verifier mode 讓使用者檢視。
- How to apply：
  1. 寫 Route Plan 時，第一件事是宣告 profile（Simple／Standard／Complex）與 verifier mode，並寫進計畫書讓使用者核准。
  2. 依 profile 決定審查次數：Simple 不派獨立審查；Standard 只在最後驗證一次；Complex 依使用者的定義（每個節點，或 AGENTS.md 的「關鍵節點」）。兩者說法不同時先問使用者。
  3. 使用者指定的 verifier mode 優先於全域風險觸發的預設做法；若全域規則要求更多，要在計畫書明列差異並請使用者決定，不得默默加碼。
  4. 審查成本（token、5 小時額度）要在計畫書估算，讓使用者能比較。
- 使用者定案（2026-10-17）：之後寫計畫書，第一步就是宣告級別，交使用者核准。
  - 計畫書的第一個節點（`P0`）固定是「宣告級別」：寫出 profile（Simple／Standard／Complex）、verifier mode、預計審查次數與成本估算。
  - 這一步要先停下來交使用者核准；級別沒核准前，不派 security-reviewer、plan-verifier、AGY 或 verifier，也不展開後續節點的細節。
  - 使用者改了級別，就照新的級別重排審查節點。
- 使用者補充定案（2026-10-17）：
  - 級別對使用者一律用繁體中文加燈號：🟢 簡單、🟡 普通、🔴 嚴重，不只寫英文 profile 名稱。
  - 🔴 嚴重維持 AGENTS.md「只驗證關鍵節點」（不是每個節點），計畫書要列出是哪幾個關鍵節點。上面 How to apply 第 2 點「兩者說法不同時先問」已由這次定案解決。
  - 已寫入 AGENTS.md「計畫書執行拓樸圖」第一條。

## 補記：本版必做功能被誤列為選用（2026-10-17）
- 使用者指出：先前已說明這一版要有 LLM，讓使用者在單頁遇到問題時可以提問。
- 事實：使用者 2026-10-16 已同意「先只做文字＋Markdown」的單頁問答，計畫卻寫成「S8，選用」並加 W3「是否做 S8」關卡；S3、S4 與交接檔都把它排除在範圍外。
- How to apply：使用者同意要做的功能，一律列為本版必做節點，不自行降級成「選用」或另加「是否要做」的關卡；不確定就當面確認一次。
