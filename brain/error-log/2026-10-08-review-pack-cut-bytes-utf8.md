---
name: review-pack-cut-bytes-utf8
date: 2026-10-08
topic: 組外審封包時用 cut -c 截斷中文，封包變成不合法 UTF-8
---

# 外審封包被 cut -c 切壞

## 事實

組 AGY 計畫審查封包時，對程式節錄每行用 `cut -c1-400` 截斷。Git Bash 的 `cut -c` 依位元組切，把多位元組中文切成半個字元，封包不是合法 UTF-8。review-loop 在呼叫 AGY 前以 `EXECUTION_INTERRUPTED:UTF8_TEXT_REQUIRED` 停止（INCONCLUSIVE，未送出）。保留壞封包與原證據目錄（原工作區）。

## How to apply

1. 組送審封包不要用 `cut -c` 截斷含中文的內容；需要截斷時用 Node 依字元處理，或乾脆不截斷。
2. 送審前用 `new TextDecoder('utf-8',{fatal:true})` 驗證封包；`--preflight-only` 不檢查封包編碼，不能代替。
3. 失敗的證據目錄保留，重送時改用新的 evidence_dir，不覆寫舊收據。
