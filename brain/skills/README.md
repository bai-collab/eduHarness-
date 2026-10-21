# brain/skills：帶入的 Skill 清單

本資料夾是新工作區的 Skill 正本（共 31 個）。每個 Skill 是一個資料夾，內有 `SKILL.md`、`VERSION`、`agents/openai.yaml`，部分另有 `references/`、`assets/`、`scripts/`。

**待辦**：新工作區暫時沒有 harness 與 `skill-registry.json`。投影到 `.claude/skills`、`.agents/skills` 與 registry 登錄，待 harness 帶入後處理。在那之前，這些 Skill 不會被自動載入，只能當成文件參考或手動複製使用。部分 Skill 的內文仍提到 `harness/`、`references/tw-curriculum-108/` 等路徑（例如 conjecturing-five-stage 的 lint 指令、document-to-markdown-ingestion 的根目錄標記檔），這些要等 harness 與參考資料帶入後才有效。

## 設定鍵怎麼用

標「是」的 Skill 會讀工作區根目錄的 `private/config/sites.local.json`（再退到 `config/sites.example.json`），不寫死網址、帳號、IP 與埠號；缺值就停下來問使用者。每個 Skill 的 `SKILL.md` 開頭有「設定」一節列出用到的鍵、預設值與缺值行為。鍵的總表與規則見 `config/README.md`。

## 帶入清單

| id | 繁中可見名稱 | 一句用途 | 用設定鍵 |
|---|---|---|---|
| claude-opus-4-8-review | Claude Opus 4.8 高強度唯讀驗收 | 用 Claude Opus 4.8 高強度唯讀審查指定證據 | 否 |
| causal-sandbox-inquiry | 因子模擬探究沙盒 | 把多變因互相牽動的教材做成會回應學生的活系統模擬，讓學生戳出因果圖 | 否 |
| claude-repair | claude修復 | 安全診斷 Windows Claude Desktop 啟動與更新錯誤 | 否 |
| cloudflare-workers-redeploy | 重新部署 Cloudflare Workers 網站 | 讀 `sites.<site_id>` 設定，測試、commit、經同意後部署 Workers 站台並做線上唯讀檢查（通用版，取代綁單一站台的舊 Skill） | 是：`sites.<site_id>.*` |
| codex-handoff | 交接給 Claude CLI／Codex | 額度將滿時寫交接檔，並處理 CLI 交回桌面版的接回 | 是：`tools.claude_cli.launcher` |
| conjecturing-five-stage | 臆測五階段 | 把數學單元改寫成造例、提出猜想、效化、一般化、證實的臆測教案 | 否 |
| creative-collaboration-loop | AI 創作協作循環 | 引導發散、收斂與受控分支的 AI 協作流程 | 否 |
| digital-learning-lesson-plan | 數位學習精進教案 | 依年度 profile 與平台證據整理數位學習精進教案 | 否 |
| document-to-markdown-ingestion | AI 文件 Markdown 轉換 | 內容閱讀先轉 Markdown，格式與版面審查保留原檔 | 否 |
| educational-card-game | 教育卡牌遊戲設計與製作 | 引導教師把教材做成可玩、可及、可驗證的 Web 卡牌遊戲 | 是：`services.gas.endpoint_url`、`services.sheet.id`、`sites.<site_id>.main_url`（只在部署接線時） |
| educational-web-game-workflow | 教育 Web 教學遊戲工作流 | 把教材、學習機制、版面與資產串成可驗證的 Web 教學遊戲 | 否 |
| explain-visual | 圖解先行 | 解釋機制或流程時先給最小視覺 | 否 |
| hemingway-writing | 海明威寫作法 | 禁副詞與抽象形容詞，用具體畫面寫作 | 否 |
| i-have-adhd | 行動優先輸出 | 先給下一個行動、編號步驟，讓進度清楚可見 | 否 |
| image-to-3d-scene | 圖片轉 3D 場景 | 把場景圖片重建成可環繞的 Three.js 展示頁 | 否 |
| item-authoring | 試題命題 | 把課程來源轉成可審查的數位學習試題庫 | 否 |
| learner-behavior-game-review | 學習者行為與挑戰驗收 | 審查學生操作、挑戰階梯與答案洩漏 | 否 |
| lesson-differentiation | 教案差異化教學 | 在既有教案上設計分層支援、補救與延伸 | 否 |
| lesson-plan-authoring | 教案撰寫 | 把課程目標、活動與評量整理成可覆核教案草稿 | 否 |
| material-to-quest-game | 教材轉闖關遊戲 | 將教材轉成實體或 Web 闖關遊戲規格與試玩契約 | 否 |
| pixel-ai-secretary | Pixel AI 美術提示詞祕書 | 產生 Pixel Art 角色、動作與素材提示詞套件 | 否 |
| playable-world-prep | 可玩世界備課 | 把教材變成會回應學生的可玩探究頁（備課紀律與路由） | 否 |
| procedural-world-field-metrics-workflow | 程序化場景共用世界與量測迭代工作流 | 建立可重現的世界欄位、程序模組與量測迭代 | 否 |
| quest-threejs-adoption | 闖關遊戲 Three.js 導入 | 協助教師把闖關內容漸進導入 Three.js | 否 |
| reasoning-kernel | 證據式推理核心 | 需要時整理假設、證據、查證與不確定性 | 否 |
| repo-to-teaching-animation | repo 轉教學動畫網頁 | 把 repo 或講義做成單檔 HTML 教學解說動畫，可選轉成研習平台內建簡報 | 是：`tools.github.default_owner`、`local.chrome_debug_port`、`sites.<site_id>.project_dir` |
| shadow-movie | 皮影戲網頁電影 | 混用 SVG 與 PNG 製作皮影動畫與 HTML 舞台 | 否 |
| teacher-workspace-ui | 教師工作台建立 | 建立教師工作台，整合學生紀錄、AI 分析與校內區網部署 | 是：`services.gas.endpoint_url`、`services.ai.endpoint`、`local.teacher_port`、`local.student_port`、`local.lan_ipv4` |
| text-to-creature | 文字造獸 | 一句描述產生遊戲可用的 3D 生物 GLB（anyCreature 引擎） | 是：`upstream.anycreature_repo_url`（預設為公開上游） |
| visual-art-storyboard | 美工與分鏡設計 | 規劃美術風格、角色、場景與可選的八格分鏡 | 否 |
| web-layout-topology-analysis | 網頁版面拓樸分析 | 先規畫區塊與元件重疊關係，再進行 Web 實作驗證 | 否 |

## 改寫過的 Skill（相對舊工作區）

| id | 改寫類型 | 版本 |
|---|---|---|
| cloudflare-workers-redeploy | 新 id；由綁單一站台與帳號的舊 Skill 改成讀 `sites.<site_id>.*` 的通用範本 | 0.1.1 |
| teacher-workspace-ui | 改讀設定（埠號不再內建專屬值，範本預設 8080）；校內區網篇與測試改成通用「校內區網部署」（`start` 轉接任意專案的學生端入口、埠號不給預設）；移除綁特定專案的範例圖與來源連結；資料來源欄位的專有標籤改為 `live`；測試 IP 夾具改用合成位址 | 1.1.1 |
| repo-to-teaching-animation | 改讀設定（取材 owner、Chrome 偵錯埠）；選配的研習平台串接改為通用說明；腳本移除寫死路徑與埠號 | 0.4.1 |
| codex-handoff | 啟動檔路徑改讀 `tools.claude_cli.launcher`；移除私人外掛與專案路徑；2026-10-21 範本預設改指隨附的 `tools/claude-cli/start-claude-api.cmd` | 0.4.2 |
| text-to-creature | 上游網址改由設定覆寫（預設保留公開上游） | 0.1.1 |
| educational-card-game | 加「設定」一節（原內容已是佔位寫法） | 0.1.1 |
| conjecturing-five-stage | 移除私人研究資料夾路徑引用（內容為使用者核准公開的通用教學 Skill） | 0.1.2 |
| playable-world-prep | 路由表原註明 causal-sandbox-inquiry 尚未帶入；2026-10-21 補入後已移除該註記 | 0.1.1 |

其餘 Skill 原樣複製。

補充：`causal-sandbox-inquiry` 在舊工作區只有投影（沒有正本），2026-10-21 由投影的 `SKILL.md` 原樣複製（內容無私人值，未改寫），並依其他 Skill 的格式補上最小版 `VERSION`（0.1.0）與 `agents/openai.yaml`。

## 未帶入清單

| id | 理由 |
|---|---|
| 特定縣市版命題 Skill | 綁特定縣市；已有通用版 `item-authoring`，不重複帶入 |
| 單一站台的舊部署 Skill | 綁單一 Cloudflare 帳號與私人網站；已由通用版 `cloudflare-workers-redeploy` 取代 |

## 二進位檔

只有 4 個圖片：`shadow-movie/demo/assets/raster/sample.png`，以及 `teacher-workspace-ui/assets/screenshots/` 的 3 張公開範本截圖（假資料）。已檢查：JPEG 只有 JFIF 標頭、PNG 無文字或 EXIF 區塊，沒有作者、GPS 或相機資料；截圖畫面只有 DEMO_01、DEMO_02 假資料。綁特定專案的 3 張範例截圖未帶入。沒有 docx、pptx、pdf。
