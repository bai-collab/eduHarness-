---
name: colab-long-job-transport
description: colab CLI 跑長工作的教訓：長互動 exec 會斷線、控制器停掉後機器會被回收、思考模型的輸出上限要夠大
type: knowledge
triggers: [Colab, colab exec, Connection was lost, A100, 長工作, 背景執行, llama-server, max_tokens, 思考模式]
updated: 2026-10-20
---

# colab CLI 長工作的傳輸與預算教訓

來源：某 A100 對照評測計畫 P7 三次真跑（google-colab-cli 0.7.4、A100-SXM4-40GB）。

## 事實

1. `colab exec` 長時間互動執行會報 `RuntimeError: Connection was lost.`（jupyter_kernel_client wsclient）：一次在新機器第一個指令（約 150 秒），一次在 47.5 分鐘的作答步驟；後者雲端沒有任何輸出。
2. 改成「雲端 setsid 背景程序＋本機每 30 秒短 exec 輪詢」後，驗題、載入兩個模型、該評測 27 題作答都完成。
3. 本機控制器停止後（Claude Code 記憶體不足回收背景指令），約 20 分鐘計費後雲端 session 消失；只用 `colab download` 輪詢狀態檔未能讓機器保持存活（推論，根因未確認）。
4. llama-server 第一次請求會暖機約 2 分鐘（0.1 tokens/s），之後正常；10-12 舊紀錄相同。
5. 思考模式＋`max_tokens 8192`：該評測 27 題中 22 題 `finish_reason=length` 且無最終內容。

## How to apply

1. Colab 上超過約 2 分鐘的步驟一律背景執行＋短輪詢；短 exec 遇傳輸錯誤有限重試。
2. 長工作期間要有持續活動的連線（例如輪詢 exec），並把控制器設計成可續接（以 run_id 與 status 檔接回），不要假設控制器不會被本機回收。
3. 開始付費真跑前提醒使用者本機記憶體狀況；控制器被停時，第一件事查 `colab sessions`／`usage`，先救回雲端檔案再關機。
4. 評測思考模型時，輸出上限要能容納思考＋答案（例如 ≥16384），或限制思考長度；否則結果測到的是額度截斷，不是能力。報告須把「無答案（截斷）」與「答錯」分開。

相關：[[evidence-first-tool-diagnostics]]
