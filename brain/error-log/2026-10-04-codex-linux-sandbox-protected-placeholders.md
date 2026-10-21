---
name: codex-linux-sandbox-protected-placeholders
description: Codex Linux 沙箱會在工作目錄暫建 .agents/.codex/.aws/.git 受保護掛載點，空目錄檢查會誤判且無法寫入這些目錄
type: errorlog
triggers: [codex, sandbox, workspace-write, WSL, Linux, 複製, rsync, .codex, .agents]
---
# Codex Linux 沙箱在工作目錄內建立受保護掛載點

事實：M1 把 harness 複製到 WSL 新建的空目錄，派 WSL 內的 codex exec（workspace-write）在該目錄執行。Codex 的「目標必須為空」預檢回報 TARGET_NONEMPTY 並依指示停止；事後目錄為空，但目錄修改時間晚於建立時間。用 codex sandbox -c sandbox_mode=workspace-write 在同目錄執行 find，沙箱內可見 .agents、.codex、.aws、.git 四個目錄，結束後消失。

**Why:** Codex 0.160.0 的 Linux 沙箱會把這些路徑當受保護路徑，在可寫根目錄內建立唯讀掛載點。因此 (1) 沙箱內的空目錄檢查一定失敗；(2) 任務若需要在工作目錄寫入 .codex、.agents 或 .git（例如複製本工作區或 git init），Codex 在 workspace-write 下做不到。

**How to apply:** 目標為空的檢查改由主 session 在派工前於沙箱外完成，不交給 Codex。要寫入 .codex、.agents、.git 的複製或建庫任務，不派 Codex workspace-write，改派 Claude executor，並在 checkpoint 記錄 requested／actual 差異。不以放寬沙箱或擴大可寫根目錄繞過，除非使用者明確核准。

證據：原工作區的 M1 執行紀錄，以及某 WSL 混合工作流程計畫的 M1 checkpoint。
