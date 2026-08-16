# Local Pluggable Harness

這是一個只在本機執行的 Harness 基線。它把「治理規則」與「執行環境」分開，並以可插拔區塊推動模型或工具沿著可驗證路徑工作。

## 內建 Skill 功能

Skill 是針對特定工作整理好的能力模組，包含使用時機、輸出規則、相依 Skill、可用工具與驗證方式。Skill 不會全部一次載入，而是依任務需要按需啟用。

目前 Registry 已註冊 18 個內建 Skill。

### 教學、命題與推理

| Skill | 功能 |
| --- | --- |
| 教案撰寫 | 根據學習目標設計教學活動、流程與評量。 |
| 數位學習精進教案 | 撰寫數位學習方案，補足平台使用、學習證據與申請格式。 |
| 教案差異化教學 | 將既有教案調整為分層、補救與延伸活動。 |
| 試題命題 | 設計試題、題型、題庫草稿與 coverage 檢查，保留人工審查。 |
| 臺南數位教學命題 | 針對臺南數位教學情境進行命題與教材設計。 |
| 臆測五階段 | 設計數學臆測、驗證、反例與修正的五階段教學活動。 |
| AI 文件 Markdown 轉換 | 將文件內容安全轉成 Markdown，支援內容擷取、摘要與比較。 |
| 證據式推理核心 | 管理假設、證據、測試、結果與不確定性，不保存模型私有 Chain-of-Thought。 |

### 遊戲、Web 與 3D

| Skill | 功能 |
| --- | --- |
| 教材轉闖關遊戲 | 將教材與學習目標轉成闖關遊戲規格，包含可及性與試玩設計。 |
| 教育 Web 教學遊戲工作流 | 以 DOM-first 方式規劃與製作教育 Web 遊戲，並進行視覺驗證。 |
| 闖關遊戲 Three.js 導入 | 評估將 Three.js 導入既有闖關遊戲，兼顧 DOM 可及性、效能與 Pilot 範圍。 |
| 圖片轉 3D 場景 | 將圖片或視覺需求轉成可環繞 3D 展示頁與程序化場景流程。 |
| 網頁版面拓樸分析 | 分析網頁區塊、元件矩形、Responsive 版面與重疊／遮擋關係。 |
| 程序化場景共用世界與量測迭代工作流 | 建立程序化場景的共用欄位、量測指標、效能 baseline 與可重現流程。 |

### 視覺、寫作與輸出

| Skill | 功能 |
| --- | --- |
| 美工與分鏡設計 | 規劃角色、場景、畫面風格與八格分鏡。 |
| Pixel AI 美術提示詞祕書 | 整理角色一致性、四視角與 Pixel Art 提示詞套件，不直接管理 API Key。 |
| 海明威寫作法 | 將文字改寫得更具體、清楚、有畫面感。 |
| 行動優先輸出 | 在使用者明確啟用時，優先呈現下一步、短步驟與目前狀態。 |

## Skill 與 Chain-of-Thought 的關係

這個 Harness 將 Skill、私有 Chain-of-Thought（CoT，模型內部的逐步思考）與可稽核的外部決策紀錄分開。Skill 定義的是可重複的工作方法與輸出契約，不是要求模型公開內部思考過程。

| 部分 | 負責什麼 | 保存方式 |
| --- | --- | --- |
| Skill | 定義使用時機、工作規則、輸出格式、相依能力與驗證方式。 | 以 Skill package 與 Registry 保存。 |
| 私有 CoT | 模型內部用來形成答案的逐步思考。 | 不要求、不保存、不公開。 |
| 外部決策紀錄 | 記錄必要的 goal、assumption、hypothesis、evidence、check、result、uncertainty 與 decision。 | 依任務需要寫入可稽核的 plan、checkpoint 或結果摘要。 |

### Skill 如何處理需要推理的任務

- **Simple 任務**：通常直接進入準備與驗證，不強制載入 reasoning。
- **Standard／Complex 任務**：遇到模糊、衝突、不確定或高風險情境時，才按需載入「證據式推理核心」。
- **使用者可檢查與介入**：外部紀錄讓使用者看見決策依據、修改方向或停止流程，但不會把私有 CoT 當成產品資料保存。
- **Skill 不改寫流程**：Skill resolution 是 Route Plan 的旁路資料；載入 Skill 或相依能力不能新增、刪除、重排節點，也不能改變 verifier budget。

這種設計像是留下「會議決議與檢查清單」，而不是保存每個人的腦內自言自語：足以稽核與接續工作，又不把模型的私有推理當成輸出內容。

## 為什麼這樣設計？

- **按需載入，減少干擾**：簡單任務只載入必要能力，複雜任務才增加推理、版面或驗證工具。
- **工作流程與 Skill 分離**：Route Plan 先決定任務節點、依賴與驗證預算；Skill 不會偷偷改寫整個流程。
- **使用者保有最終決定權**：使用者可以調整範圍、流程、選用 Skill、工具、驗證方式，也能隨時停止。
- **可攜且不綁定個人環境**：設定使用 repository-relative path，不依賴特定磁碟代號、使用者名稱、帳號或雲端服務。
- **安全邊界清楚**：不自動安裝套件或外部 Runtime、不自動匯入未知 Skill、不保存 secrets，寫入前先檢查目標。
- **可稽核但不保存私有思考**：保存 goal、assumption、hypothesis、evidence、check、result 與 uncertainty 等可檢查紀錄。
- **驗證成本依任務調整**：Simple、Standard、Complex 使用不同 verifier 策略，在安全性與成本間取得平衡。
- **Registry 讓 Skill 可管理、可驗證**：每個 Skill 都要登錄、提供繁體中文顯示名稱，並通過 `harness:validate`。

## 它如何推動思考

Harness 不要求模型輸出私有 Chain-of-Thought，而是要求留下可檢查的決策紀錄：

```text
goal → assumptions → hypotheses/options → evidence → checks → result → uncertainty → next action
```

只有遇到複雜、模糊、衝突或高風險任務時，才載入 reasoning 區塊；簡單任務可以直接進入本機執行準備與驗證。

## 使用者權限

使用者可以：

- 指定或改變 profile
- 指定區塊順序
- 跳過 optional block
- 指定本機 adapter
- 修改方案、範圍與驗證方式
- 隨時停止流程

Harness 會把這些決定寫入 plan artifact。模型產生的建議只能標記為 advisory，不能覆蓋 user decision。

## Route Plan 與多平台治理

非瑣碎任務會先建立 Route Plan，再開始執行。每個節點會記錄：

- objective、依賴與 allowed paths
- requested platform／agent／role
- platform preflight 結果
- 不可用時的 primary-agent fallback
- 該節點的 verifier mode

平台預檢只做無副作用的 readiness probe。外部平台未啟用或 adapter 不存在時，會記錄原因並改由主 Agent 接手；若沒有安全 fallback，才標記 `deferred`。

Verifier 採節流策略：Simple 預設不派獨立 verifier、Standard 最後統一驗證、Complex 只對關鍵節點安排 verifier，並受 route profile 的 verifier budget 限制。

## 路徑

portable config 使用 repository-relative path。實際根目錄由 marker discovery、`HARNESS_ROOT` 或 `--root` 決定，不依賴固定磁碟代號或本機絕對位置。

## 快速開始

```powershell
npm test
npm run harness:validate
node harness/cli/harness.mjs plan harness/examples/task.simple.json
node harness/cli/harness.mjs plan harness/examples/task.standard.approved.json
node harness/cli/harness.mjs plan harness/examples/task.complex.pending.json
node harness/cli/harness.mjs plan harness/examples/task.lesson-plan.standard.json
node harness/cli/harness.mjs plan harness/examples/task.document.simple.json
```

`task.complex.pending.json` 會停在 `awaiting_user`，因為 Complex 路徑需要使用者明確裁決；這是預期行為。

`task.standard.approved.json` 展示 Standard 路徑：使用者已核准、先做 route preflight，最後只排一次 final verifier。

## Brain 遷移與按需知識

Brain 使用 `brain/index.json` 管理 repository-relative path。知識、Skill 與範本先索引、後按需載入；不會因為建立任務就把全部文件全文放進上下文。

```powershell
npm run harness:brain -- inspect
npm run harness:brain -- verify
npm run harness:brain -- search "verifier 路徑錯誤"
```

遷移舊工作區前先預覽，再明確加上 `--apply`；目的檔案 hash 不一致時會停止而不覆寫。完整規則見 [`harness/docs/brain-migration.md`](harness/docs/brain-migration.md)。

## Skill 與條件依賴

目前已註冊 18 個混合版 Skill，涵蓋教育、命題、美工、網頁製作、版面拓樸、文書處理、海明威寫法與行動優先輸出等工作流。所有 Skill 都以繁體中文可見名稱呈現，完整清單與可攜分類請看 `harness/config/skill-registry.json` 與 `harness/config/skill-migration-catalog.json`。

Skill 不是全域預載清單：Route Plan 先建立與 Skill 無關的節點拓樸，Skill 解析結果另放在 `skill_resolution`。`user-confirmed` optional dependency 沒有使用者決定時會停在 user-authority，先顯示問題、建議與「載入／先略過」選項；Skill 不得改變 Route Plan 節點、拓樸或 verifier 預算。

查看 Skill Registry：

```powershell
node harness/cli/harness.mjs skills
node harness/cli/harness.mjs catalog
```

Skill package 位於 `brain/skills`；Registry 位於 `harness/config/skill-registry.json`。不會預載全部 Skill，也不會自動安裝或覆寫平台 projection。

新建或移植 Skill 請從 `harness/templates/skill-package` 開始：英文小寫連字號 `id` 只供內部穩定引用；使用者看到的 `display_name_zh_tw`、中文別名與 `agents/openai.yaml` 的 `interface.display_name` 必須使用繁體中文，而且三者要一致。完成後執行 `npm run harness:validate`；未註冊、缺中文名稱或名稱不一致都會被阻擋。

Skill 的可攜分類與批次資訊在 `harness/config/skill-migration-catalog.json`；它只描述本副本實際存在的 Skill。

目前內建的 `rule-tool` 只會建立安全的執行準備，不會任意執行 shell。若要接上其他本機模型或工具，請依照 `harness/runtime/README.md` 實作 adapter，再透過 registry 或 local override 啟用。
