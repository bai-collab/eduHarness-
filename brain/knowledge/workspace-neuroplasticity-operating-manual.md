# 工作區操作手冊：依神經可塑性讓工作區「越用越順手」

- 定位：跨專案可重用的**工作方法知識**（非某個專案的產物），故歸 `brain/knowledge/`。
- 來源：2026-09-09 多任務模式 T3 產出；與 T2（`projects/outputs/workspace` 消歧規則，已寫入 `AGENTS.md`）同源。
- authority：`reviewed-reference`（建議，非硬契約；硬規則落在 `AGENTS.md` 與 `brain/instincts/`）。

## 核心洞見

這個 harness **已經長出大部分「神經器官」**：`skills`＝把重複序列打包的 chunk、`memory`／`MEMORY.md`＝檢索線索、`brain/error-log`＝糾錯迴路、`brain/index.json`＋專案分類索引＝線索層、`planned/complete/`＝修剪歸檔。所以「越用越順手」不是再蓋新東西，而是**固化哪些習慣**，並補上唯一結構弱點——寫入位置每次重判（見下表 Hebbian 列，已由 T2 修補）。

## 原理 → 器官 → 要強化的習慣

| 神經可塑性原理 | 工作區既有器官 | 要強化的習慣 |
|---|---|---|
| **Hebbian**：一起放電就連線，重複路徑變快 | —（弱點所在） | **一物一家**：每個常做的事只有一條正規路徑（＝T2：SSOT 一律在 `projects/`） |
| **髓鞘化**：一致重複才把路徑變粗 | `package.json` scripts、skills | **固定命名·位置·入口**；同一件事永遠用同一種方式做 |
| **Chunking／基模**：把重複序列壓成一個單位 | skills、多任務協定、templates | **把反覆的多步流程升級成具名 skill／template**（已很擅長→繼續） |
| **修剪（用進廢退）**：沒用的連結被剪、雜訊競爭資源 | `planned/complete/`、`brain/` | **完成即歸檔／刪除**：計畫→complete、scratch 清掉、過期掃描報告移除 |
| **間隔效應＋提取練習**：間隔複習與主動回想才鞏固 | `MEMORY.md`、memory 檔、`consolidate-memory` skill | **洞見當下就寫 memory**，定期 consolidate |
| **線索依賴回想**：好線索讓回想自動化 | 專案分類索引、`brain/index.json`、`brain/wiki-index.md` | **開工先看索引**，變成固定儀式 |
| **錯誤驅動學習**：有回饋的錯誤驅動可塑性 | `brain/error-log/` | **記可驗證失敗**＝一次防復發的 wiring 更新 |

## 六條「越用越順手」設計（優先序）

1. **一物一家**（＝T2，最高槓桿，同時消滅四散）：SSOT 一律 `projects/<主題>/`；`outputs/`＝匯出副本、`workspace/`＝可丟暫存。判準見 `AGENTS.md` 目錄歸屬節。
2. **固定入口與命名**：常用操作走固定 `npm run` / skill / slash command；命名照 `AGENTS.md` 命名規則，不同義多拼法。
3. **重複流程升級為 skill／template**：一個流程做到第 2–3 次就封裝，減少工作記憶負擔。
4. **完成即修剪**：計畫確認完成→立刻移 `planned/complete/`；一次性 scratch 用完即清；過期報告歸檔。
5. **開工看索引、洞見即寫 memory**：進場先讀 `MEMORY.md` 與專案分類索引；每有一個非顯而易見的判斷就寫一則 memory，形成間隔鞏固。
6. **安全熱路徑降摩擦**：對安全的唯讀/常用操作用 `fewer-permission-prompts`、在 Route Plan 預先宣告 `allowed paths`，把 automaticity 讓給高判斷工作。

## 與其他規則的關係

- 硬規則（判準、SSOT-in-projects、write-target）已落 `AGENTS.md`，本手冊是其**方法論背景與習慣層**。
- 可再把第 1、4、6 條蒸餾成 `brain/instincts/` 的短行動規則（startup-light 載入、最常被 recall），作為下一步。
- 相關：模型分工路由、專案分類索引、自主作業協定（多任務模式）等紀錄（未隨本工作區提供）。
