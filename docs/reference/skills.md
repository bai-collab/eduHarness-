# 技能一覽

> 本頁於發佈時自動生成，生成日期 2026-07-30，共 18 個技能。
> 技能 ID、繁中標題與路徑的權威來源是 `harness/config/skill-registry.json`；用途一句話為人工維護。請勿手動編輯本頁，它會在下次發佈時重新生成。

你不需要記這些名稱。用平常講話的方式描述你要做的事，AI 會自動挑對應技能；下表是給想確認「有哪些技能、正本在哪」的人查的。

| 技能 | 機器 ID | 用途 | 正本路徑 |
|---|---|---|---|
| 教案撰寫 | `lesson-plan-authoring` | 從課綱、學習者與時數限制產出完整教案。 | `brain/skills/lesson-plan-authoring` |
| 教案差異化教學 | `lesson-differentiation` | 把現有教案改寫成分層支持版本，核心目標不降低。 | `brain/skills/lesson-differentiation` |
| 數位學習精進教案 | `digital-learning-lesson-plan` | 台灣數位學習精進方案格式的教案，含平台佐證與隱私揭露。 | `brain/skills/digital-learning-lesson-plan` |
| 試題命題 | `item-authoring` | 把課綱或教材轉成可審查的題庫草稿。 | `brain/skills/item-authoring` |
| 教材轉闖關遊戲 | `material-to-quest-game` | 把教材轉成實體或網頁闖關遊戲規格。 | `brain/skills/material-to-quest-game` |
| 美工與分鏡設計 | `visual-art-storyboard` | 規劃美術方向、角色、場景、素材提示詞與八格連續分鏡。 | `brain/skills/visual-art-storyboard` |
| AI 文件 Markdown 轉換 | `document-to-markdown-ingestion` | AI 讀 Word／PDF 等文件內容前的安全轉換流程。 | `brain/skills/document-to-markdown-ingestion` |
| 海明威寫作法 | `hemingway-writing` | 具體、有畫面感的寫作約束，去除抽象與贅字。 | `brain/skills/hemingway-writing` |
| 行動優先輸出 | `i-have-adhd` | 讓 AI 回覆行動優先、步驟編號。 | `brain/skills/i-have-adhd` |
| 圖片轉3D | `image-to-3d-scene` | 把場景圖片重建成可環繞的 3D 展示頁。 | `brain/skills/image-to-3d-scene` |
| Pixel AI 美術提示詞祕書 | `pixel-ai-secretary` | 像素風虛擬助理角色的一致性提示包。 | `brain/skills/pixel-ai-secretary` |
| API 與介面設計 | `api-design` | 設計穩定的 API 與模組介面契約。 | `brain/skills/engineering/api-design` |
| 安全與強化 | `security-and-hardening` | 處理輸入、認證、儲存與外部整合的防禦性開發指南。 | `brain/skills/engineering/security` |
| 規格驅動開發 | `spec-driven-development` | 新功能或多檔流程的規格、計畫與驗收準則。 | `brain/skills/engineering/spec-driven` |
| 測試驅動開發（TDD） | `test-driven-development` | 邏輯變更與修 bug 的測試先行流程。 | `brain/skills/engineering/tdd` |
| 除錯與錯誤恢復 | `debugging-and-error-recovery` | 原因不明、重複失敗或工具出錯時的除錯流程。 | `brain/skills/engineering/debugging` |
| 任務規劃與分解 | `planning-and-task-breakdown` | 把已核准規格拆成可測試、有相依的任務。 | `brain/skills/engineering/planning` |
| 提示詞優化 | `prompt-optimization` | 把模糊或自相矛盾的指令改寫成結果導向的清楚提示。 | `brain/skills/prompt-optimization` |

## 怎麼用

直接對 AI 說你要什麼即可，例如「幫我把這份課綱命 20 題選擇題」會命中`試題命題`。想強制指定某個技能，直接講它的中文名稱。各技能的實際步驟見[操作指南](../index.md#操作指南--這件事怎麼做)。

## 分類

- **教育類**：教案撰寫、教案差異化教學、數位學習精進教案、試題命題、教材轉闖關遊戲、美工與分鏡設計、圖片轉3D、Pixel AI 美術提示詞祕書。
- **寫作與互動**：AI 文件 Markdown 轉換、海明威寫作法、行動優先輸出、提示詞優化。
- **通用工程**：API 與介面設計、安全與強化、規格驅動開發、測試驅動開發、除錯與錯誤恢復、任務規劃與分解。
