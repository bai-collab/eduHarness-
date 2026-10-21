---
name: claude-opus-4-8-review
description: 當需要讓 Claude Code 命令列使用 Claude Opus 4.8 與高強度推理，唯讀讀取指定程式檔和驗收證據，輸出可稽核的結構化審查結果時使用；不把本機測試通過當成真實模型或系統驗收通過。
---

# Claude Opus 4.8 高強度唯讀驗收

## 目的與界線

這個 Skill 把本機的 Claude Code 命令列審查流程固定成一個可重複使用的入口：要求模型 `claude-opus-4-8`，並傳入命令列的 `--effort high`。審查只讀取使用者指定的程式檔與驗收資料，產出結構化 JSON 報告。

這個 Skill 不代表 Claude 一定能連上服務，也不代表受審系統一定可用。它要把下列各層分開記錄：命令是否啟動、模型請求是否出現、是否有回覆、審查是否產生完整結論，以及受審系統的結論是 `PASS`、`FAIL` 或 `INCONCLUSIVE`。

不要把 API 金鑰、Cookie、環境變數或未授權的檔案放入讀取清單。`--safe-mode`、`--tools Read` 與 `--allowedTools Read` 是 Claude 的工具限制；它們不等於作業系統的檔案隔離，提示中的路徑也不等於已證明檔案完整讀取。

## 執行流程

### 1. 先做唯讀預檢

在受審專案根目錄確認 `scripts/claude-review.mjs` 與 `claude` 命令列可用。先用乾跑檢查路徑，不會呼叫 Claude：

```powershell
npm run claude:review -- --dry-run --model claude-opus-4-8 --effort high --file <程式檔> --evidence <驗收證據>
```

只接受專案內相對路徑。把程式檔與驗收證據分開列出，並在真正呼叫前檢查清單中沒有秘密或不應外傳的資料。

### 2. 守住逐檔授權閘門

真正呼叫前，必須有使用者對**這一次要讀取的確切檔案清單**的授權；同一回合已明確授權的清單可以沿用。乾跑、檢查檔案存在與讀取命令說明不需要外傳授權。若清單改變，先重新取得授權，不要用「同一個專案」推定所有檔案都可以送出。

### 3. 以固定參數執行唯讀審查

優先使用專案已提供的包裝程式，不要自行改寫另一套呼叫邏輯：

```powershell
npm run claude:review -- --model claude-opus-4-8 --effort high --file <程式檔> --evidence <驗收證據> --output results/claude-review-<時間>.json
```

包裝程式會使用 `-p`、`--output-format stream-json`、`--verbose`、`--json-schema`、`--safe-mode`、`--permission-mode dontAsk`、`--no-session-persistence`，並只開放 `Read`。輸出檔採建立新檔方式，不覆寫既有報告。除非使用者另行指定，預設逾時為 120 秒。

若包裝程式不存在或 Claude CLI 不可啟動，停止並回報「尚未完成 Claude 審查」；不要把乾跑成功或本機測試結果冒充外部審查。

### 4. 讀報告時使用分層判定

回報至少包含下列欄位與意義：

- `model_requested`、`effort_requested`：這次要求的模型與強度。它們不是供應端對每個內部請求的保證。
- `execution.status: completed`：Claude 已產生完整審查結論；這只表示審查完成，不表示受審系統通過。
- `execution.parse.verdict.verdict`：受審系統在指定證據下的 `PASS`、`FAIL` 或 `INCONCLUSIVE`。
- `execution.diagnosis.stages`：分開看命令啟動、模型請求、API 回應、模型回覆與完整審查結論。
- `execution.diagnostics.dispatchedModels`：除錯資料中實際看見的模型名稱；若有輔助模型，只能如實列出，不能把所有內部呼叫都寫成 Opus。
- `execution.stream.readPaths`：只表示模型提出過 `Read` 呼叫，不證明每個檔案都讀成功或已完整理解。

判定規則：

1. 有完整結構化結論且結論為 `FAIL`，表示 Claude 審查完成並在證據中找到受審系統問題。
2. 有完整結構化結論且結論為 `PASS`，只表示這批指定證據通過審查；仍要說明證據範圍，不延伸成教學成效或未測功能的保證。
3. 沒有完整結構化結論、逾時、命令啟動失敗或權限錯誤，表示審查未完成；不得把它改寫成系統通過，也不得只憑缺少除錯標記宣稱遠端服務故障。
4. `12/12` 本機或模擬測試只能標為本機測試結果；若真實模型請求、瀏覽器互動或網路證據失敗，整體不能標為通過。

## 收尾格式

以繁體中文回報：

1. 報告檔的相對路徑。
2. `model_requested`、`effort_requested` 與 `execution.status`。
3. 五個執行階段的實際狀態。
4. 受審系統的 `PASS`、`FAIL` 或 `INCONCLUSIVE`；沒有完整結論就明說「Claude 審查未完成」。
5. 主要發現、檔案與行號（報告有提供時）。
6. 已確認、尚未確認與下一步，避免把審查完成誤寫成系統修正完成。

