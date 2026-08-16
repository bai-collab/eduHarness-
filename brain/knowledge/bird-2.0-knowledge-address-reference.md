---
name: bird-2-0-knowledge-address-reference
description: BIRD 2.0 知識地址協定的外部程式碼與資料契約摘錄；只保存可驗證的來源摘要，不複製提供者程式碼
type: knowledge-reference
status: recorded-not-installed
source: https://github.com/twhsi/skills/tree/main/skills/thebrain-bird-address
source_revision: 62af6c1fdc64187f7665254f6109dbfa1799d1fe
source_updated_at: 2026-07-12T17:52:43+08:00
verified_at: 2026-07-15
---
# BIRD 2.0 知識地址：外部來源紀錄

## 來源與證據狀態

- ✅已確認：公開來源是 `twhsi/skills` 的 `thebrain-bird-address` skill；網站產生的索引標示版本 `2.0`、revision `62af6c1`，並列出 `agents`、`references`、`scripts` 資源。
- ✅已確認：上游正式協定將 `B` 定義為 `Book Address`、`I` 定義為 `Knowledge Index`、`R` 定義為 `Route`、`D` 定義為 `Deep Link`。
- ✅已確認：上游 `I` 使用 `W + T + K + A`；權重為 `I4/I3/I2/I1`，Index Type 為 `C/M/P/B/T/O/L/E/S/A/X`，並要求 canonical keyword 與去重 aliases。
- ✅已確認：上游把 `StructuralType`（書、部、章、節、項）與 `IndexType` 分開，不能互換。
- ✅已確認：上游要求 Deep Link 使用已提供且已驗證的 URI，不能由標題猜測、重建、縮短或改寫；新節點保持空白或待建立。
- ✅已確認：上游提供 `BIRD分析`、`拆書正文`、`代碼表` 三個 Excel 工作表契約，另有 Roam Research JSON 轉換器與自我驗證。
- ⚠️推測：BIRD 適合作為 F 槽 Brain 之上的「定位與互通層」，不應取代 Brain 的 Markdown SSOT、planned 狀態或 references 唯讀來源。
- ⏳待確認：TheBrain、Roam、Obsidian 的實際執行環境與 Deep Link 清單目前未在 F 槽啟用；本工作只記錄規格，不安裝、不匯入、不寫入外部工具。

## 上游程式碼可移植的行為

1. 解析器接受單一物件、陣列，或包含 `items`、`records`、`rows` 的物件，方便 JSON、Excel 平坦列與 agent packet 互通。
2. 解析器會正規化巢狀 `index` 與舊式欄位名稱，例如 `B_BookAddress`、`I_Weight`、`I_TypeCode`、`I_Keyword`、`R_Route`、`D_DeepLink`。
3. 驗證器拒絕缺少 Book Address、非法 Weight/Type、空 canonical Keyword、沒有 URI scheme 的 Deep Link；Route、Alias 會去重。
4. Roam 輸出把 BIRD 欄位放進支援的 block，而不是新增未知 JSON 欄位；輸出預設不帶 UID，並檢查空標題、重複頁名與 block 結構。
5. 上游拆書規則以核心主張、讀者問題、獨立案例、定義或可重用推理步驟變化作為分割依據，不按段落長度機械切割。

## F 槽採納界線

- ✅採納 BIRD 核心欄位與代碼，作為每一個「作品／專案知識節點」的可定位互通格式。
- ✅採納 `bookId + bookAddress` 作為跨作品穩定主鍵；這是 F 槽擴充，不改寫上游 `B` 顯示值。
- ✅採納來源雜湊、來源定位、擷取時間、審查狀態等 provenance 欄位，放入 F extension，不污染 BIRD 2.0 核心欄位。
- ✅採納中文可見標題與中文工作狀態；內部英文 `name` 仍保留，以符合 F 槽 skill/workflow 契約。
- ⏳待確認：`Summary`、批次增量索引、搜尋 API、向量資料庫與 Knowledge Graph 不是上游 BIRD 2.0 canonical JSON 欄位；若需要，必須以 F extension 設計並經驗證。
- ❌已否定：直接複製或安裝上游 skill 到 Claude/Codex；第三方程式碼保留連結與 revision，移植時只重寫必要介面。

## 參考連結

- BIRD 說明頁：<https://www.twhsi.com/bird>
- 上游 skill：<https://github.com/twhsi/skills/tree/main/skills/thebrain-bird-address>
- BIRD 2.0 protocol：<https://github.com/twhsi/skills/blob/main/skills/thebrain-bird-address/references/bird-2.0-spec.md>
- Excel schema：<https://github.com/twhsi/skills/blob/main/skills/thebrain-bird-address/references/excel-schema.md>
- Roam converter：<https://github.com/twhsi/skills/tree/main/skills/thebrain-bird-address/scripts>

本檔案是外部來源摘要，不是上游授權程式碼的副本；任何新 revision 先更新來源登錄與差異審查，再決定是否調整 F 槽規格。
