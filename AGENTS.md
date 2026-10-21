# Local Pluggable Harness（可插拔治理工作區）

這是 local-only 的可插拔 Harness。它只依賴目前 repository 內的相對路徑與本機已存在的工具；不得把特定磁碟代號、使用者名稱、外部帳號、Cloud installation 或單一平台寫入 portable 規則。

**個人化補充**：若 `private/AGENTS.private.md` 存在，視為本檔的個人化補充，一併遵守；兩者衝突時，以使用者在 private 檔中的裁決為準。該檔不存在（例如公開 clone）時，只依本檔執行。

## 本資料夾的角色

- 本資料夾是一個可直接使用的治理工作區：根目錄的 `AGENTS.md`（本檔）與 `CLAUDE.md` 是工作規則；`brain/` 是可重用的知識、教訓與 Skill；`config/` 放網站與服務設定的公開範本；`harness/` 放已帶入的工具（review-loop 送審、教訓提醒 hook、公開掃描器）；`.claude/settings.json` 是 Claude Code 的公開設定。
- **私人內容集中在 `private/`**（整個資料夾由 `.gitignore` 排除，不隨公開版提供）：個人規則、私人索引、本機設定的實際值（`private/config/sites.local.json`）、公開掃描用的禁止字串清單與例外。公開 clone 沒有這個資料夾是正常的；需要時依下文「公開／私人切割規範」自建。
- 網站權限與網址設定分兩層：值放 `private/config/sites.local.json`（沒有就退到公開範本 `config/sites.example.json`）；AI 可連的網域放 `.claude/settings.json`（公開文件網域）與 `.claude/settings.local.json`（私人網域，不公開；Claude Code 固定讀這個位置）。skill 不寫死網址、帳號、連接埠，一律讀設定，缺值就停下問使用者。說明見 `config/README.md`。
- **review-loop**：送審入口 `node harness/cli/review-loop.mjs <本任務設定檔.json>`（可附 `--trigger-id <reminder_id>`），含送審前秘密閘與失敗原因分類；實作審查提醒由 `.claude/settings.json` 的 UserPromptSubmit hook（`harness/hooks/inject-lessons.mjs`）注入，提醒追蹤紀錄只寫 `harness/state/`（不上傳）。
- 本檔與 `CLAUDE.md` 內提到、但本資料夾目前沒有的路徑（例如 `planned/`、`projects/`、`harness/docs/`、`harness/config/skill-registry.json`），代表該慣例的預定位置；尚未建立時依本檔文字執行，建立時照本檔命名。

## 最常用規則速覽

1. 對使用者一律繁體中文、白話好懂，不中英夾雜 → 「回應語言」
2. 給使用者看或複製的路徑一律絕對路徑，每個獨立一個 text 區塊 → 「給使用者的路徑與連結」
3. 非瑣碎任務先建 Route Plan；計畫書第一步 `P0` 宣告級別（🟢🟡🔴）並等使用者核准 → 「計畫書執行拓樸圖」
4. 誰做的不由自己審；範圍變動、不可逆或外部變更（push、發布、刪除）、付費真跑先回使用者 → 「共同安全底線」
5. 動工前先檢索記憶；被糾正的當下回寫；同主題第 2 次被糾正就回原則層 → 「核心原則」CONSULT
6. 工具 `SUCCESS` 不等於完成；先證據後歸因 → 「核心原則」EVIDENCE-first
7. 交付操作整合成單一入口；靜態網頁給檔案路徑，需後端的網頁才開本機服務 → 「交付與操作習慣」
8. 私人值只放 `private/` 或 `*.local.*`；公開、提交或分享前先跑公開掃描且 0 命中 → 「公開／私人切割規範」
9. 新建、改名、移動檔案前先確認目錄歸屬與命名 → 「檔案歸屬與命名規則」

## 核心原則

- 使用者意見是流程路徑、範圍、取捨與停止決定的最高權限。
- 模型提出建議，Harness 提供上下文、工具、區塊順序與驗證；模型建議不能取代使用者裁決。
- 任務依複雜度採 Simple、Standard、Complex 三種流程，不要求每件事都走完整管線。
- 區塊是可拔插的。可加入、移除、替換或標記 deferred；缺少 optional capability 不得阻塞整個 Harness。
- 非瑣碎任務先建立 Route Plan：節點、依賴、requested platform／agent、fallback、allowed paths 與 verifier mode 必須在執行前可檢視。
- Skill 解析是 Route Plan 的旁路資料；Skill 不得新增、刪除、重排 Route Plan 節點，也不得改變 Route Plan 的 verifier 預算。Skill 依賴需要使用者確認時，必須提出問題與建議後停在 user-authority。
- Route Plan 中指定的非主平台要先做無副作用 preflight；平台不可用時，若使用者未要求該平台不可替代，預設由 primary-agent 接手並記錄 requested／actual 差異。
- Verifier 依 profile、節點風險與跨平台情況節流：Simple 可不派獨立 verifier、Standard 預設最後驗證、Complex 只驗證關鍵節點（不是每個節點）；使用者明確指定的 verifier mode 優先。
- **Codex 實作審查觸發**：涉及程式／文件／設定實作變更，且依 profile 或使用者指示需要審查的任務，必須在 Route Plan 明列審查節點，於交付前建立本任務限定檔案與必要檢查設定，執行 `node harness/cli/review-loop.mjs <本任務設定檔.json>`。提交掛鉤送達 reminder_id 時，命令另附 `--trigger-id <reminder_id>`；紀錄缺失須明列 gap，不得用其他任務收據代替。Codex 作者預設由 AGY 外部審查，使用者指定、免審與停止決定優先；作者不可自審，不把 AGY 固定成所有平台的唯一審查者。純問答不因提醒自動呼叫模型；不自動安裝、傳送秘密或擴張授權檔案。交付列出當前版本結論與收據；未知、未啟動或無有效回覆必須標示「審查未完成」，不得稱通過。提醒／啟動紀錄不取代審查收據或控制器接受閘。
- 驗證獨立性另以 `disabled`／`preferred`／`required` 表示：`preferred` 不可用時允許主工作降級繼續但必須留下 gap；`required` 節點只有在 executor 與 verifier 的實際 platform／agent 可區分且有外部身分來源時才能通過接受閘門，模型自報的 `verifier_ref` 不算證明。
- 審查獨立性的唯一不變式是「誰做的不由自己審」：審查者由主 session 指派、非作者、不同模型，可以是 Claude 角色或 Codex；協作或單獨做由主 session 依任務選，不強制多 agent 拓樸。
- 只保存可稽核的 goal、assumption、hypothesis、evidence、check、result、uncertainty 與 decision，不要求或保存私有 chain-of-thought。
- portable 設定只使用相對路徑；本機覆寫集中在未提交的 `*.local.*` 檔（例如 `harness/config/env.local.json`）或 `private/`。
- 不自動安裝套件、plugin、外部 runtime 或服務。
- 寫入前先檢查目標；預設使用 create-only，禁止無聲覆寫。
- 新建或移植 Skill 必須先登錄 `harness/config/skill-registry.json`；穩定英文 `id` 只供內部使用，`display_name_zh_tw`、`aliases_zh_tw` 與 `agents/openai.yaml` 的 `interface.display_name` 必須使用繁體中文可見名稱。`harness:validate` 對未登錄 Skill、缺少繁體中文可見名稱或 UI 名稱不一致的 package 直接報錯。
- **動工前先檢索記憶（CONSULT-before-act）**：非瑣碎任務開始前，先用關鍵詞 `grep -ril "<關鍵詞>" brain/error-log brain/knowledge`；關鍵詞除任務主題外，也要含輸出格式類（路徑、標題、語言）。命中的教訓（尤其 `How to apply`／`rules`）當**硬約束**遵守。使用者提到的專有名詞或 README 列出的參考專案，先搜 `projects/`、`brain/` 與參考專案，查不到才問並說明查過哪裡。被使用者更正或踩雷的**當下**即回寫一則紀錄（錯誤→`brain/error-log/YYYY-MM-DD-<topic>.md`、方法→`brain/knowledge/<topic>.md`）。同一主題被糾正 ≥2 次 → 停手、回原則層重述再動，並提議在 `harness/config/guard-rules.json` 加一條提醒型守門（連回該教訓、附使用者核准原話），使用者核准才啟用；PreToolUse 攔截只在能精準比對時逐條核准。完整規格見 `brain/knowledge/agent-memory-discipline.md`。此規則對無自動記憶注入的平台（如 Codex）尤其必要——不主動讀，等於沒有記憶。
- **工具診斷先證據後歸因（EVIDENCE-first）**：工具回傳 `status=SUCCESS` 不等於任務完成；必須同時核對非空且切題的產物、`error`／`warnings`、`denied_actions` 與是否截斷。先分列「事實／推論／未知」，再分類為身分驗證、工具策略、參數格式、執行期或結果缺失。沒有明確且屬於該服務／身分層的 `401`、`AUTH_EXPIRED`、`LoginRequired` 或等價身分證據，不得宣稱未登入或要求使用者重新登入；即使有 `401` 也要先確認其服務與身分層。若有已授權的替代工具，保留原任務範圍並改策略重試一次；若替代方式完成任務但原因仍未知，標記任務完成並保留原因未知，若沒有替代方式才回報 `INCONCLUSIVE`。完整規則見 `brain/knowledge/evidence-first-tool-diagnostics.md`。
- Web 介面任務：計畫節點先列視覺驗收與 CDP 驗收；回報分列自動測試、瀏覽器實際操作、CDP 結果，沒做的寫「未驗證」，不得稱「完整瀏覽器驗收」。

## 共同安全底線（各宿主皆適用）

- 安全敏感節點的審查不得由執行它的同一代理／模型（或同一模型家族）自審；執行中遇到範圍變動或不可逆／外部變更（push、發布、刪除、外部 mutation），須停下回到使用者決策。規則只點名部分宿主之處，同樣適用於 Claude CLI 與日後新增的宿主。
- 使用者已授權的 AGY／Codex 唯讀外審，直接送、不逐次詢問外傳同意；封包只含任務相關資料，先掃描無秘密與個人資料、控制大小。這不擴大成安裝、破壞性操作、公開發布或自動核准所有工具；付費真跑、push、發布、刪除仍先問使用者。
- 只終止自己啟動並記錄 PID 的程序，不以名稱或命令列樣式批次終止；連接埠被佔用時先判斷是不是使用者的程序，是就不關。

## AGY（Antigravity CLI）呼叫守則（各宿主皆適用）

1. **先確認可執行**：命令名稱解析不到不等於沒安裝；每個新任務先跑 `--version` 或 `--help`，旗標以實際輸出為準。執行檔位置與呼叫範例見 `brain/knowledge/agy-cli-invocation.md`。
2. **唯讀呼叫**：唯讀審查用唯讀模式；未經使用者明確同意，不得使用自動核准所有工具的旗標。
3. **結果判讀**：exit 0 或 `status=SUCCESS` 不等於完成；要同時核對回應非空且切題、`denied_actions`、逾時與錯誤訊息。
4. **登入狀態每次重新判定、不沿用**：只有這次呼叫的輸出中，出現**確定來自 AGY 本身身分層**的失敗訊息，而且該次沒有產生可用回應，才能說未登入。來源不明的 `401` 要先依 EVIDENCE-first 確認服務與身分層；只是觸發了登入流程、之後仍完成回應的，不算未登入。空回應、被拒動作、逾時或網路錯誤都不是登入證據，一律判「未知」。**過去某次「未登入」的紀錄不能當成這次的結論**。
5. **沒有可用審查內容時**：記為 `INCONCLUSIVE`，不得寫成 PASS，並把本機檢查結果分開報告。
6. **外審要指定不同家族的模型**：作者是 Claude 家族（含 Claude CLI）時，送 AGY 外審一律用 `--model` 指定非 Claude 模型，並用 `--output-format stream-json` 在收據記下 `init.model`；沒有 `init.model` 判獨立性未知（`INCONCLUSIVE`）。收據寫實際模型，不能只寫「AGY」。

## 公開／私人切割規範（建立 skill、專案時一律遵守）

- **私人值只放 `private/` 或 `*.local.*`**：網址、子網域、帳號、人名、學校、埠號、本機路徑、內部代號，以及金鑰名稱以外的任何秘密，只能放在工作區的 `private/`（例如 `private/config/sites.local.json`）或 `*.local.*` 檔；兩者都由 `.gitignore` 排除。金鑰、token、密碼本身不寫進任何檔案，需要時只寫**環境變數名稱**。
- **skill 只寫設定鍵**：skill 的 `SKILL.md`、範本與腳本只寫「要讀哪個設定鍵」與缺值行為；讀不到值或仍是佔位值時，停下來問使用者，不猜、不沿用舊值，也不把讀到的值寫回 skill、計畫書、`brain/` 或交接檔。
- **專案的私人資料放專案內 `private/` 或 `*.local.*`**：`.gitignore` 的 `private/` 規則沒有開頭斜線，任何深度名為 `private/` 的資料夾都會被排除；新專案若有其他私人檔，要在 `.gitignore` 補上對應規則，並先確認規則真的生效。
- **公開、提交或分享前必跑公開掃描且 0 命中**：入口是 `node harness/tools/scan-public.mjs`（或 `npm run scan:public`），預設掃全庫、套用根目錄 `.gitignore`、讀 `private/scan/forbidden-strings.local.json`（禁止樣式）與 `private/scan/scan-allow.json`（逐檔例外）。只掃某個資料夾時加 `--root <資料夾>`；`brain/` 另加 `--scope brain` 套用 brain 專屬樣式。掃描前先跑 `--self-test`。命中時改內容，不靠加例外過關；例外只給「偵測邏輯本身」或「已人工確認無個資」的檔案，並寫明理由。
- **新增的私人代號要同步補進禁止樣式**：新專案、新帳號、新站台、新評測代號一出現，就補進 `private/scan/forbidden-strings.local.json`，再跑一次 `--self-test`。公開 clone 沒有這個檔：照 `harness/tools/forbidden-strings.example.json`（只有類別與假值）複製到 `private/scan/forbidden-strings.local.json` 後換成自己的值；掃描器缺檔時會拒絕執行（fail-closed）。
- 禁止樣式清單與例外檔本身含敏感字面值，只能在 `private/`；掃描器會把公開範圍內與它們位元組相同的檔案判為命中，不可被例外放行。
- 二進位檔（docx、pptx、圖片）文字掃描抓不到作者欄或 EXIF，公開前另查 metadata。

## 交付與操作習慣

- **回應語言（Claude、Claude CLI 與 Codex 各端皆適用）**：對使用者的所有回覆一律用**繁體中文**，不中英夾雜；不因進入編碼／執行階段就切成其他語言（含工具執行前後的敘述、清單、總結）。高風險點是工具呼叫之間的短句、長操作後的第一句、輸入英文多時；送出前檢查語言。專有名詞用「中文(English)」格式，且**只在首次出現時**附英文，之後只用中文，例如：大型語言模型(LLM)。程式碼、檔名、指令、路徑與識別碼維持原文。說明時用淺顯易懂的白話，優先舉生活化例子；必要的專有名詞當下補一句白話解釋；避免不必要的術語、過度抽象或冗長說明。
- **給使用者的路徑與連結**：列給使用者看、點開或複製的檔案、資料夾、收據與指令路徑，一律寫當下解析的完整絕對路徑（Windows 用反斜線格式），每個路徑單獨一個 ```text 程式碼區塊；要複製貼上的指令同樣每個獨立一個區塊，`cd`／`Set-Location` 也寫絕對路徑，不留 `<repo>` 佔位。計畫書拓樸圖、可攜規範與程式內部引用才用相對路徑。網頁產物依類型交付：可直接開啟的靜態網頁（如一般教學動畫單檔 HTML）給 HTML 的絕對檔案路徑，讓使用者雙擊開，不另開伺服器；需要後端服務才能運作的網頁（有 API、登入或資料庫的應用）才啟動只綁 `127.0.0.1` 的服務、確認回應 200，再給 `[名稱](http://127.0.0.1:<port>/…)`，並說明啟動方式與何時失效（預覽伺服器回合結束可能被關）；不把 `file:///` 當可點連結，網址後不緊接全形標點。
- **單一入口**：交付給使用者的啟動／操作整合成一個入口（一個可雙擊檔或一個指令），自己處理順序與等待，說明與設定放同一處，不拆成多步讓人拼湊；指令對準使用者實際 shell，不確定就給可雙擊檔；Windows `.cmd` 只放 ASCII＋CRLF，邏輯交給 Node。
- **給外部代理的任務說明**（Codex、AGY 等）寫進 `workspace/<主題>/`，計畫節點記該路徑；不放 Claude 的 job 暫存區（外部代理可能讀不到）。
- **還原與版本核對**：沒有可用的 git 時，還原一律用檔案複製備份與雜湊比對，不提 git revert／reset；session 啟動時顯示的 git 狀態以實測為準。多個 session 共用同一工作區時，範圍外改動先當跨 session 正常活動。
- **改檔核對**：改檔後用雜湊或關鍵字 grep 二次核對（曾有延遲寫入覆蓋、無聲還原舊版）；子代理回報「已還原」不算證據。行尾以位元組計數為準，不用 `grep $'\r'`；Python 文字模式會正規化 CRLF，改前先量行尾、改後核對變更行數；heredoc 內要字面反斜線用 `chr(92)`。
- **跨代理交接（Claude ↔ Claude CLI ↔ Codex，各端皆適用）**：額度將滿或使用者要求時，交出方寫 `workspace/<主題>/handoff-to-<接手方>-YYYY-MM-DD.md`；接手方第一回合只做唯讀 preflight：核對前一代理宣稱的完成項與證據（檔案 SHA-256、可重跑的測試），口頭「已完成」不是證據。在 `workspace/<主題>/` 寫入前先取得 `workspace/<主題>/.agent-lock`（`holder=none` 或檔案不存在才改為自己；`holder` 是別人就停；收工改回 `holder=none`）。git 不可用時，版本核對改用檔案雜湊與備份路徑。Claude CLI 與桌面版同屬 Claude 模型家族，不能互審；外審交 AGY 指定非 Claude 模型或其他家族。完整格式見 `brain/skills/codex-handoff/SKILL.md`。
- **對話標題命名（各宿主有對應機制時皆適用）**：非瑣碎對話在**第一回合回覆**中，用宿主的改名機制命名（桌面版用改名工具；CLI 給使用者一行 `/rename`），不得沿用使用者第一句話當標題。
  1. 格式：`<狀態> | <主題>｜<動作>`，全長建議 ≤ 16 個全形字；主題優先對應 `projects/00-分類索引.md` 的主題名或 `workspace/<主題>/` 目錄名。
  2. 時機：理解需求後的第一回合即命名，只命名一次；任務主題明顯轉換、或對話由問答轉成實作時才再命名一次。
  3. 標題只放主題與動作，不放檔案路徑、磁碟代號、使用者名稱、帳號、秘密或 session ID。
  4. 例外：純寒暄、單行問答可不命名；接手交接檔的對話以交接主題命名。
  5. 屬輸出慣例，不改 Route Plan 節點與 verifier 預算。

## 計畫書執行拓樸圖（全域設定）

- **第一步宣告級別並交使用者核准**：每一份計畫書的第一個節點（`P0`）固定是「宣告級別」，寫出級別、verifier mode、預計審查次數與審查成本估算。級別對使用者一律用繁體中文加燈號呈現：🟢 簡單（Simple，不跑審查）、🟡 普通（Standard，最後跑一次）、🔴 嚴重（Complex，只驗證關鍵節點，並列出是哪幾個節點）；英文 profile 名稱只放在括號或機器設定裡，然後停下來交使用者核准。級別核准前，不派任何審查角色（含 plan-verifier、security-reviewer、AGY、verifier），也不展開後續節點細節；使用者改了級別，就照新級別重排審查節點。全域或宿主規則要求的審查比宣告級別更多時，在 `P0` 列出差異由使用者裁決，不得默默加碼。
- 每一份可供使用者閱讀的計畫書，都必須包含一張簡易 ASCII 執行拓樸圖（放在 ```text 區塊內，不用 Mermaid：Claude 端無法穩定渲染），位置在目標／範圍之後、詳細步驟之前。
- 圖採由上而下的直式排列，一個節點一行或一個方框，用 `│`、`▼`、`├─`、`└─` 或 `-->` 連接；中文為全形字寬，避免多欄橫向對齊。範例：

  ```text
  [P0] 宣告級別（🟡 普通，最後驗證一次）｜主 agent｜已執行
    │
    ▼
  [P1] 實作 ｜subagent（executor）｜未執行
    │
    ├─ 通過 ──▶ [P2] 驗證 ｜subagent（verifier）｜未執行
    └─ 範圍變動 ──▶ [W1] 等待使用者決策 ｜主 agent｜未執行
  ```
- 拓樸圖的每個節點都必須同時寫出：①穩定的節點 ID（`P0`、`P1`）；②節點功能（規劃、執行、呼叫工具、呼叫 Skill、驗證或等待使用者決策）；③使用 agent（`主 agent` 或 `subagent（角色）`）；④節點狀態，只能是 `已執行`、`未執行` 或 `有問題`（有問題須附一句可稽核的原因）。
- 節點之間用箭頭表達順序或依賴，分支、等待與停止條件標在箭頭或節點旁。狀態必須反映實際進度，不得把「計畫要做」寫成「已執行」；計畫內容變更時，拓樸圖與文字步驟同步更新。
- 每完成一個節點，必須在進入下一個節點前立即回寫該節點的狀態，並留下簡短的結果、證據、偏離檢查與下一步；不能等整個任務結束才一次更新。
- 每個節點完成後都要做一次 drift review：比較實際執行內容與原定功能、依賴、allowed paths、agent 及 verifier mode；若範圍、路徑、權限或結果跑歪，將節點標為 `有問題`，先停下來修正計畫或取得使用者決策。
- 任務中斷後，先讀取拓樸圖與最近一筆 checkpoint；從第一個不是 `已執行` 的節點續接。若最近節點是 `有問題`，必須先處理該問題，不能跳到後續節點；外部狀態改變時要重新做 preflight。
- `已執行` 只有在節點的檢查證據已保存後才能使用；checkpoint 只記錄可稽核摘要，不保存私有 chain-of-thought。
- 拓樸圖只能使用 repository-relative path 或中性 placeholder，不得放入磁碟代號、使用者名稱、帳號、秘密或其他本機識別資訊。
- 舊計畫書在下一次被修改時，必須補上符合本規則的拓樸圖；既有 Mermaid 拓樸圖一併改為 ASCII。

## 圖解先行（視覺優先解說）

- 解釋機制、流程、依賴或狀態轉移時，先給最小視覺，文字只補圖說不出的；一圖一主張，箭頭標動詞。
- 純事實、單行可答、使用者只要文字或已足夠清楚時不給圖。
- 屬 Route Plan 旁路，不改節點與 verifier 預算。選圖形式前先讀 `harness/docs/visual-first-explanation.md`（尚未帶入時依本節規則）。

## 檔案歸屬與命名規則（全域設定）

- 完整目錄歸屬表文件（`harness/docs/file-layout-and-naming.md`）未隨附；新工作區目前的目錄依本節與「公開／私人切割規範」，日後新增 `planned/`、`projects/` 等目錄時再補完整歸屬表。
- 根目錄 `AGENTS.md` 是工作規則 SSOT；`README.md` 是使用者導覽；`package.json` 是命令與 runtime metadata。
- **SSOT 一律在 `projects/<主題>/`**；`outputs/` 只放匯出副本並記相對路徑回指 SSOT；`workspace/` 只放過程暫存。拿不準預設落 `projects/<主題>/`。非瑣碎任務的 Route Plan 在 `allowed paths` 進場即寫死 write-target（以 `projects/00-分類索引.md` 的主題當 router）。存量不物理搬移。
- 私人內容一律落 `private/`（或專案內 `private/`、`*.local.*`），不放進公開目錄；規則見「公開／私人切割規範」。
- 測試／實驗產物（含第三方 repo 實驗）預設放 `projects/<kebab-name>/`，不留 session scratchpad；落地後補 `projects/00-分類索引.md` 一行。
- 新計畫書放 `planned/`，檔名 `YY-MM-DD-<lowercase-kebab-topic>-plan.md`；執行完成並經使用者明確確認後，原檔移至 `planned/complete/`（只改位置，不改檔名、checkpoint 或拓樸節點 ID；內容更新時只改路徑，不任意改節點 ID）。
- `harness/docs/` 與 `harness/config/` 新檔用 `<lowercase-kebab-topic>.md`／`.json`（穩定規則不加日期；被程式以固定檔名讀取的檔案不可只改名而不更新 loader、測試與引用）。Skill 目錄名與 Registry 的 stable ID 用 lowercase kebab-case，必要檔名維持 `SKILL.md`、`VERSION`、`agents/openai.yaml`。`brain/knowledge/` 新檔用描述性 kebab-case；`brain/experience/` 與 `brain/error-log/` 新檔用 `YYYY-MM-DD-<topic>.md`。
- `references/` 的鏡像檔名若由來源系統產生，保留來源檔名；若改名，必須同步更新 index、manifest 與 provenance。
- 新檔名不得含磁碟代號、使用者名稱、帳號、秘密、session ID 或不必要的本機識別資訊；機器管理的檔名避免空白與大小寫混用。
- 不得用同義檔名建立多份 SSOT；內容已存在就更新原檔，或先在計畫中宣告新的 SSOT 與遷移方式。

## Workspace discovery 與工作流程

CLI 從目前工作目錄向上尋找 `harness/config/local-harness.json`，也可用 `HARNESS_ROOT` 或 `--root` 指定工作區根目錄；設定檔不得依賴絕對路徑。

```text
classify → context? → reasoning? → route-plan → platform-preflight → user authority → dispatch → execute/prepare → reconcile? → verify → optional replan
```

區塊順序可由 registry 與 task 的 user directives 調整；`verify` 是預設安全檢查，要改變它須在 task 留下明確的使用者決定與風險紀錄。

目前可用的指令（其他 Harness 區塊尚未帶入）：

```powershell
npm test
npm run scan:public
node harness/tools/scan-public.mjs --self-test
node harness/cli/review-loop.mjs <本任務設定檔.json>
```
