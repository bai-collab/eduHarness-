---
name: series-loop-exit-code-only-1
description: 多模型 R1 啟動迴圈只在 exit=1 時停止；node 因系統記憶體不足崩潰（exit 134、0xC0000409）後迴圈仍啟動後續模型，並留下帳本鎖與未結算保留額。
type: errorlog
triggers: [live-batch-series, 啟動指令, PowerShell 迴圈, exit code, 134, heap out of memory, ledger.lock, LEDGER_LOCKED]
updated: 2026-10-12
---

# 多模型啟動迴圈只在 exit=1 時停止，崩潰後仍續跑付費模型

## 事件
某多模型評測的啟動指引第一版用 `if ($code -eq 1) { break }`。gpt-4o-mini 串在第 2 批第 2 場時 node 以 `FATAL ERROR: Committing semi space failed ... heap out of memory`（exit 134）崩潰；迴圈照樣啟動 gpt-5.6-luna（exit 134）、gpt-5.6-sol（exit -1073740791），第四個才因 `LEDGER_LOCKED` 回 1 而停。崩潰留下兩本帳本的 `ledger.lock` 與一筆 10 美元未結算保留額。

## 根因
- 指令作者只考慮了 series 自己定義的結束碼（0／1／2），沒有考慮程序被作業系統或 V8 強制終止的結束碼。
- 崩潰時系統可用實體記憶體約 0.7 GB、其他程序（例如 OneDrive 同步）占用大量已認可記憶體；「Committing semi space failed」表示向作業系統要記憶體失敗（推論，非已證實）。

## How to apply
1. 付費串接指令的迴圈一律「只在明確成功碼繼續」（白名單 0、2），其餘一律停止。
2. 寫啟動指令時附上崩潰後的恢復步驟：確認無 bench 程序 → 刪兩本 ledger.lock → `--settle` 結算保留額。
3. 長時間批次前提醒使用者檢查系統記憶體。
