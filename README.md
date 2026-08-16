# Local Pluggable Harness

這是一個只在本機執行的 Harness 基線。它把「治理規則」與「執行環境」分開，並以可插拔區塊推動模型或工具沿著可驗證路徑工作。

## 內建 Skill 功能

Skill 是針對特定工作整理好的能力模組，包含使用時機、輸出規則、相依 Skill、可用工具與驗證方式。Skill 不會全部一次載入，而是依任務需要按需啟用。

目前 Registry 已註冊 17 個內建 Skill。

### 教學、命題與推理

| Skill | 功能 |
| --- | --- |
| 教案撰寫 | 根據學習目標設計教學活動、流程與評量。 |
| 數位學習精進教案 | 撰寫數位學習方案，補足平台使用、學習證據與申請格式。 |
| 教案差異化教學 | 將既有教案調整為分層、補救與延伸活動。 |
| 試題命題 | 設計試題、題型、題庫草稿與 coverage 檢查，保留人工審查。 |
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

目前已註冊 17 個混合版 Skill，涵蓋教育、命題、美工、網頁製作、版面拓樸、文書處理、海明威寫法與行動優先輸出等工作流。所有 Skill 都以繁體中文可見名稱呈現，完整清單與可攜分類請看 `harness/config/skill-registry.json` 與 `harness/config/skill-migration-catalog.json`。


## 內建 Skill 的運作流程

每個 Skill 都遵循相同的基本節奏：確認輸入與範圍 → 建立來源／假設紀錄 → 執行專屬步驟 → 產出可稽核文件 → 驗證 → 完成、待確認或停止。Skill 只提供工作指引，不會自行改寫 Route Plan、驗證預算或使用者決定。

### 1. 教案撰寫

確認來源、學習目標、學習者與評量 → 建立 context brief 與來源版本紀錄 → 把目標拆成可觀察表現 → 建立目標、活動、評量對照表 → 設計通用支持、補救與延伸 → 設計形成性／總結性評量、規準與成功條件 → 排列師生流程與教材 → 檢查目標、活動、差異化與評量是否對齊。缺少來源、目標、學習者差異或評量時，先輸出 intake gap；無證據的迷思概念不得直接寫成事實。

### 2. 證據式推理核心

區分觀察、證據與未知 → 提出 2 至 4 個可區分的假設 → 為每個假設寫出預測與可反駁條件 → 選擇資訊增益高、成本與風險可接受的檢查 → 呼叫適當的 Skill 或工具取得結果 → 更新支持、排除與新未知 → 用反例、替代假設與證據強度做結論前驗證。只保存可稽核的 evidence、hypothesis、check、result 與 uncertainty，不保存私有 chain-of-thought。

### 3. AI 文件 Markdown 轉換

先判斷需求是讀內容，還是檢查版面 → 確認檔案不含秘密、憑證或無關私人資料 → 先做 plan-only 與輸入／副檔名／版本／相對路徑檢查 → 工具可用且使用者允許時才轉換 → 分析新產生的 Markdown → 表格、公式、圖片、掃描或遺漏可能影響結論時，回看原始頁面 → 回報來源、轉換器版本、輸出位置與限制。原檔不覆寫；工具不可用時標示 deferred 或 blocked。

### 4. 數位學習精進教案

確認學校／年級／平台、學習證據、AI 與個資揭露要求 → 建立 submission profile 與平台證據 ledger → 對照數位教學計畫格式 → 建立數位策略、師生操作矩陣與學習證據計畫 → 對齊目標、平台操作、活動、評量與離線備援 → 產出草稿、格式差異與隱私／AI 揭露文件 → 做最終對齊檢查。缺少年度、版本或正式格式時只能標示待補，不宣稱符合當年度規範。

### 5. 教案差異化教學

讀取既有教案 → 鎖定核心目標、核心任務與不可降低的評量標準 → 建立學習者輪廓與差異化矩陣 → 分辨迷思概念、易錯概念與一般學習障礙 → 為各層設計示範、提示、部分例題、同儕／工具支持與獨立完成路徑 → 對齊活動、語言、可及性與評量 → 檢查鷹架是否能逐步撤除。缺少原教案、核心目標或評量時先停在 gap；沒有證據的迷思或理論不直接採用。

### 6. 試題命題

確認年級、科目、題數、指標與來源 → 建立來源 ledger，記錄位置、版本、日期、授權與證據 → 對齊學習指標、認知層次、題型、答案、誘答、解析與難度 → 建立 coverage matrix 與命題藍圖 → 產出題庫草稿，每題保留來源位置與人工審查欄位 → 檢查欄位完整性、覆蓋率、重複與衝突 → 交給人員做最後審查。缺少正式指標或來源時，不把推測寫成官方規則，也不直接發布正式題庫。

### 7. 臆測五階段

先確認教材事實、術語與版本 → 建立材料事實 ledger → 依序設計造例、提出猜想、效化、一般化、證實五階段 → 每段安排異質例子、非真例、錯誤例、反例、限制條件與量詞 → 對照單元、課次、先備知識與時間 → 產出學生版、教師版、評量與差異化材料 → 由新鮮脈絡檢查是否可 CONFIRMED 或 REFUTED。時間不容納或原始圖表不清楚時停止重設計，不跳過驗證。

### 8. 教材轉闖關遊戲

確認教材、學習目標與實體／Web 分支 → 建立教材概念圖與學習機制矩陣 → 讓每一關都對應學習目標 → 產出遊戲規格、關卡圖、題目／回饋庫與教師指南 → 實體分支補上材料、列印、教室、安全與備援 → Web 分支補上 DOM／Canvas、可及性、狀態、離線與低效能備援 → 建立素材規格與 playtest 計畫。未確認分支、目標或安全條件時只做 intake；不宣稱已安裝、產生素材或部署。

### 9. 美工與分鏡設計

確認用途、受眾、媒介、尺寸、比例、風格與參考 → 建立美術方向、色彩／光線／構圖、角色識別、場景層次與素材清單 → 先鎖定角色一致性 → 預設輸出 art-only；只有明確要求多場景連續畫面時才切換 storyboard-on → 產出美術規格、角色 Bible、場景與提示詞，必要時產出八格連續分鏡 → 若沒有實際圖像工具，只交付規格與提示詞，不宣稱已生成圖片。

### 10. 教育 Web 教學遊戲工作流

先做教師 intake：教材、目標、年級、先備知識、設備、瀏覽器、網路、評量與可及性 → 由教材轉遊戲 Skill 建立學習／遊戲規格 → 判斷 2D 是否足夠，只有有可量測學習價值時才進入 3D → 建立素材授權與 provenance ledger → 先做 DOM-only baseline，再建立以 Quest State 為真實來源的 DOM／SceneAdapter 契約 → 先通過 DOM_PASS，再做 CUA、視覺、效能、安全與授權驗證 → 由新鮮驗證者檢查可學習、可操作與可回復。DOM 不通過時停止，不直接進入 3D 或 CUA。

### 11. 闖關遊戲 Three.js 導入

確認既有教材、Web 遊戲規格與 3D 使用理由 → 先建立 WebGL 關閉或低效能時仍可完成的 DOM-only baseline → 只做一個學習問題、一個 3D 物件與 3 至 5 個必要熱點的 pilot → 定義教師、場景、事件、素材、效能預算與停止條件 → 比較 DOM-only 與 3D 的完成率、時間、迷思、教師觀察、舒適度與裝置效能 → 沒有學習增益、出現不適或超過預算時退回 DOM／SVG → 首次 pilot 通過後才擴充第二個不同案例。

### 12. 圖片轉 3D 場景

分析圖片的構圖、比例、幾何、光線、6 至 8 色主色盤、氣氛與風格 → 使用既有本機或核准的 Three.js 建立單一 HTML 頁面 → 設定相機、色彩、光霧、軌道限制、阻尼、閒置動態、觸控與縮放 → 以 localhost 提供頁面並截圖 → 比較預設視角與原圖的構圖、比例、色彩、光線與情緒 → 檢查 console、裁切、穿插與互動，至少修正與重截兩輪。只宣稱程序化場景，不宣稱 photogrammetry 或模型匯出。

### 13. Pixel AI 美術提示詞祕書

先說明能力與版本限制 → 讀取參考圖或建立 Character Bible → 把動作改寫成安全、可執行的描述 → 產出角色鎖定基準提示詞 → 為每個動作各產出一組正面、四視角與 negative prompt → 檢查角色身份、風格、禁止文字／Logo／浮水印與風險改寫 → 需要保存時只使用 repository-relative path。這個 Skill 只產生提示詞，不呼叫圖像 API，也不管理 API key。

### 14. 程序化場景共用世界與量測迭代工作流

先做治理、既有計畫與 Skill／projection 去重檢查 → 定義含版本、座標、邊界、網格、seed、RNG 與 feature digest 的 WorldSpec → 實作可批次取樣且邊界外回傳 valid=false 的 WorldField → 分離連續場與分類場 → 建立 CPU／GPU parity 與 golden points → 定義固定 viewport、DPR、瀏覽器、GPU、相機、暖機與時間凍結的 CapturePlan → 一次只改一個參數，交錯比較 baseline 與 candidate → 收集 frame time、p95、draws、triangles、pixels、PNG、diff 與環境指紋 → 以 RED → GREEN → REFACTOR 與 fresh verifier 判定 pass、fail 或 needs_review。

### 15. 海明威寫作法

動筆前宣告避免副詞與抽象形容詞 → 逐句掃描程度副詞、弱動詞與抽象字 → 改用更強的動詞與可感知的具體細節 → 在技術、法律或學術內容中保留必要限定詞 → 交付前檢查零多餘程度副詞、具體細節、每個場景至少一個感官錨點與清楚動詞。它適用於敘事、文案與演講，不取代精確文件的必要術語。

### 16. 行動優先輸出

明確啟用後，第一行直接寫下一步 → 多步任務改成編號 → 每一回合重述目前狀態與一個具體下一步 → 壓低枝節、列表最多五項 → 顯示已完成工作、錯誤與具體時間估計 → 發送前移除客套開場、重複摘要與模糊保留語。這是輸出形狀控制，不是領域執行 Skill；收到停止指令後立即停用。

### 17. 網頁版面拓樸分析

先收集 viewport profile、頁面模式、層級、元件清單與優先級 → 切出 layout blocks 與 component rects → 計算包含、重疊、遮蔽、鄰接、對齊、溢出與碰撞關係 → 先處理核心控制項的非預期重疊、裁切、安全區與可點擊範圍不一致 → 產出 implementation preview → 在瀏覽器重新量測 getBoundingClientRect、elementFromPoint、scroll metrics、截圖與互動結果 → 依證據標記 draft、ready、blocked 或 verified。預測結果不能冒充 DOM／CUA 驗證，也不直接修改程式碼。

### Skill 相依與轉接

數位學習精進教案會使用教案撰寫的對齊流程；教材轉闖關遊戲與文件 Markdown 轉換可依輸入條件銜接；教育 Web 教學遊戲工作流可銜接教材轉闖關遊戲與網頁版面拓樸分析；Three.js 導入在缺少遊戲規格時回到教材轉闖關遊戲；臆測五階段只有需要降低不確定性時才載入證據式推理核心。這些 optional dependency 都要經過使用者確認，不能由 Skill 偷改 Route Plan。

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
