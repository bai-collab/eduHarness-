# 2026-10-13 Python 文字模式改檔把混合行尾正規化成 LF

## 發生什麼

U3 改 `src/runner/live-bench.js`、`live-bench-mock.js`、`live-batch-series.js` 時，用 `open(p, encoding='utf8').read()` 讀、`newline='
'` 寫，Python 的通用換行把原本的 CRLF（含 CRLF／LF 混合）全部轉成 LF。結果 diff 從實質十幾行膨脹成數百行，送審封包差點超過上限，也等於無聲改了大量未授權的行。

另一個坑：在 bash heredoc 裡寫 `"\n"` 給 Python，經工具層後變成真的換行，寫進 JS 字串造成語法錯誤。

## 教訓（How to apply）

- 改檔前先量行尾：`python -c "b=open(f,'rb').read();print(b.count(b'
'), b.count(b'
'))"`；有 CRLF 就用二進位讀寫，或改完依備份逐行還原行尾。
- 改完一律 `diff 備份 新檔 | grep -c '^[<>]'` 核對變更行數是否合理，再送審。
- 需要在產出程式碼裡放反斜線跳脫字元時，用 `chr(92)` 組字串，不在 heredoc 裡寫 `\n`。

## 2026-10-14 再犯紀錄

- 另一個代理宿主在 F2 用 heredoc＋Python 改某測試檔，字串內寫 `\n` 仍被寫成真換行，造成 SyntaxError；跑測試時立即發現，改用 `chr(92)` 修正。教訓不變：heredoc 中要寫入字面反斜線時一律用 `chr(92)`，改完立刻 `node --test` 該檔。
