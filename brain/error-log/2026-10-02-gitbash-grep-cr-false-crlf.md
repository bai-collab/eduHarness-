---
name: gitbash-grep-cr-false-crlf
description: Git Bash 的 grep -c $'\r' 把純 LF 檔誤報成 CRLF，導致一次錯誤的換行「修正」。
type: errorlog
triggers: [CRLF, LF, 換行, grep, Git Bash, Windows, 位元組, 驗收]
updated: 2026-10-02
---

# 用 grep 判斷 CR 會誤報，換行一律以位元組計數為準

## 已證實的情況

規則鏈壓縮任務驗收時，附錄逐字比對失敗。在 Windows Git Bash 執行 `grep -c $'\r' <檔案>`，對備份的 `AGENTS.md`、`CLAUDE.md`、`MEMORY.md` 都回報「每一行都含 CR」，因此判定原檔是 CRLF，把 6 個寫入檔改成 CRLF。之後用 Node 逐位元組計數，才發現原檔 CR 位元組是 0，實際上是純 LF；剛才的 CRLF 轉換反而改壞檔案，只好再改回 LF，並核對 sha256 與第一次寫入時相同。

比對失敗的真正原因是計畫書被 Python（`io.open(..., 'w')`，Windows 預設會轉換換行）存成 CRLF，驗收腳本卻用 LF 去切附錄。

## How to apply

1. 判斷換行一律用位元組計數，例如 Node：`readFileSync(p).filter(b => b === 13).length`。不要用 `grep -c $'\r'` 或 `file` 的輸出下結論。
2. 在 Windows 上，Python 寫文字檔要明確指定 `newline=''` 或 `newline='\n'`，否則會被存成 CRLF。
3. 比對文字前，先把兩邊都統一成 LF。正規化只用在比對，不要因為比對失敗就去改寫目標檔。
4. 任何「修正」寫入前，先用另一種方法確認原因是否真的成立；只有一種工具的訊號時，算是未知，不算事實。
5. 派工規格也要遵守第 1 條：寫進規格的換行前提與驗收指令，一律先用位元組計數確認，不能用 `grep`。
6. 核對 executor 的改動時，要比對改動前後的 CR 數量，不能只看「去掉 `\r` 後的 diff」，那樣會漏掉整檔換行被改掉的情況。

## 再犯紀錄
- 2026-10-15，S7 守門規則表任務：
  - 主 session 用 `grep -c $'\r'` 核對 I1 的成果，誤以為換行維持 CRLF，又把錯誤前提「三檔都是 CRLF」寫進 I2 規格。
  - 實際情況：I1 已經把原本 CRLF 的 harness 測試檔（教訓注入測試）整檔改成 LF。
  - I2 的 executor 用位元組計數發現前提不符，停下來回報，才抓到這件事。
