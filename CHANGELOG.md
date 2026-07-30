# 更新紀錄

## v2026.07.4（2026-07-30）

本版新增兩樣東西：一份完整的使用手冊，以及 Brain 記憶層架構。

### 新增

**使用手冊（`docs/`）**

依「教學／操作指南／參考／概念」四類分層，共 17 篇 Markdown 加一張互動架構地圖：

- **教學**：15 分鐘做出第一份題庫的帶做練習。
- **操作指南**：備課、出題、教案分層、教材轉遊戲、數位學習精進、美工分鏡、讀 Word／PDF、改技能，共 8 篇，每篇含可直接複製的提示詞。
- **參考**：技能一覽（自動生成）、指令參考、資料夾結構。
- **概念**：為什麼同一個技能有三份、記憶層與 context 預算、為什麼技能會停下來、更新怎麼運作。
- **互動架構地圖**（`docs/architecture.html`）：可點的技能載入與記憶層說明。

入口見 `docs/index.md`，README 也已加上手冊連結。

**Brain 記憶層架構**

- `brain/SKILL.md`：讀取路由，說明 AI 什麼情況該讀哪一層。
- `brain/instincts/`：每次啟動全量載入的短規則，全目錄上限 200 行。
- `brain/knowledge-base/`：經審核的耐久知識，被任務觸發才讀取。
- `brain/errorLog/`：已驗證的失敗、根因與 Do Not Repeat，附 `TEMPLATE.md`。
- `brain/experience/`：任務後可重用的經驗回顧，附 `TEMPLATE.md`。
- `brain/wiki-index.md`：Brain 索引。

每層的 `README.md` 說明放什麼、什麼時候會被讀取、什麼不該放進來。

**回報與建議指引**

- `CONTRIBUTING.md`：說明為何不收 PR、怎麼開 issue、推薦教材的收錄門檻。

### 相容性

- 既有技能與使用方式不變，不必修改任何東西。
- 記憶層是選用的：不寫任何內容也不影響原本的技能運作。

### 安裝／升級

既有使用者在自己的 eduHarness 專案目錄執行：

```powershell
git pull
```

你自己在 `brain/` 底下新增的檔案不會被更新刪除；但內建的 `README.md` 與 `TEMPLATE.md` 會被新版覆蓋，想客製請另外開新檔。


## v2026.07.3（2026-07-27）

本版新增「美工與分鏡設計」，協助規劃角色、場景、美術方向、素材生成提示詞，以及八格連續分鏡。闖關遊戲若包含重要角色、多個場景、連續動作、頭目戰或明顯的鏡頭轉換，也會適時提醒使用者可選用這項功能。分鏡功能預設關閉，不會因為設計闖關遊戲就自動產生圖片或八格分鏡；使用者可以直接輸入 `/gb` 啟用，或在系統詢問時同意加入，拒絕或略過都不會阻礙原本的遊戲設計流程。

### 新增技能

**美工與分鏡設計（`visual-art-storyboard`）**

- 規劃整體美術方向、色彩、光線與畫面氣氛。
- 設計角色外觀、服裝、道具、表情與一致性規則。
- 規劃場景、關卡畫面與可重複使用的視覺素材。
- 產生一般插畫或 Pixel Art 的素材提示詞。
- 製作八格連續分鏡，標示鏡頭方向、人物動作與場景變化。
- 在連續畫格中維持角色造型、服裝、道具及空間關係一致。

使用方式：只需要角色或場景美術時，可以直接描述需求，不必啟用分鏡；要製作八格連續分鏡時輸入 `/gb`（也支援「運鏡八格」、PREVIS 與 Pixel Art 八格分鏡需求）。`/gb` 用於圖片分鏡規劃，`/Hyperframes` 屬於影片生成流程，兩者不會混用。

### 更新技能

**教材轉闖關遊戲（`material-to-quest-game`）**

- 當遊戲包含具名角色、反覆出現的場景、連續動作、變身、頭目戰或鏡頭演出時，可提醒使用者使用「美工與分鏡設計」。
- 提醒最多一次，而且只是選項；沒有選用時，仍會照常完成闖關遊戲設計。
- 靜態圖示、單一背景或純文字關卡不會為了形式而詢問分鏡。

### 相容性

- 現有教案與闖關遊戲工作流可繼續使用，不必修改。
- 未主動輸入 `/gb` 或同意加入分鏡時，預設輸出行為不變。
- 新 Skill 已提供 Claude Code 與 Codex 使用的受控投影。

### 安裝／升級

初次使用請參考 README 的「安裝」一節。

既有使用者可在自己的 eduHarness 專案目錄執行：

```powershell
git pull
```

若工作目錄中有自行修改但尚未提交的檔案，請先 commit、stash 或另行備份，以免 `git pull` 發生衝突。


## v2026.07.2（2026-07-27）

本版沒有技能內容變更，改動集中在兩件事：讓 clone 到任何路徑都能正常運作，以及讓投影過程中斷後能夠復原。

### 改進

**可攜式 registry**

- `harness/config/skill-registry.json` 從 schema v1 升到 v2，移除硬編的工作區絕對路徑，改用 `workspace_mode: repository-root`。
- clone 到哪個資料夾都能直接使用，不必修改設定。

**交易式投影**

- `project-skills.mjs` 改為「寫入前記錄 → 暫存候選 → 原子換入」的流程，中途中斷不會留下半完成狀態。
- 中斷後以 `node harness/scripts/project-skills.mjs --recover` 明確復原，復原前不允許進行下一次 apply。
- 新增 `harness/scripts/test-skill-projection-transaction.mjs` 驗證交易行為。

**防重檢查強化**

- `check-skill-dedup.mjs` 新增 schema v2 驗證、進行中交易的阻擋，以及自我測試。

**文件**

- README 新增「可攜式 Registry 與復原」一節。

### 相容性

- 技能內容與使用方式不變，既有工作流不受影響。


## v2026.07.1（2026-07-27）

### 更新技能

- 數位學習精進教案（`digital-learning-lesson-plan`）


## v2026.07.0（2026-07-26）

### 新增技能

- 教案撰寫（`lesson-plan-authoring`）
- 教案差異化教學（`lesson-differentiation`）
- 數位學習精進教案（`digital-learning-lesson-plan`）
- 試題命題（`item-authoring`）
- 教材轉闖關遊戲（`material-to-quest-game`）
- AI 文件 Markdown 轉換（`document-to-markdown-ingestion`）
- 海明威寫作法（`hemingway-writing`）
- 行動優先輸出（`i-have-adhd`）
- 圖片轉3D（`image-to-3d-scene`）
- Pixel AI 美術提示詞祕書（`pixel-ai-secretary`）
- API 與介面設計（`api-design`）
- 安全與強化（`security-and-hardening`）
- 規格驅動開發（`spec-driven-development`）
- 測試驅動開發（TDD）（`test-driven-development`）
- 除錯與錯誤恢復（`debugging-and-error-recovery`）
- 任務規劃與分解（`planning-and-task-breakdown`）
- 提示詞優化（`prompt-optimization`）

