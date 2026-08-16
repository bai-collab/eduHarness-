---
name: lesson-plan-authoring
description: Author Taiwan-context lesson plans from supplied curriculum, learner, time, technology, assessment, and source constraints. Use for 教案撰寫, lesson plan authoring, or requests to align objectives, activities, and assessment. Do not use for differentiating an existing lesson, assessment item banking, or game design.
---
# 教案撰寫

## 定位

把已提供或已核准的課程脈絡轉為「目標—活動—差異化—評量」對齊的教案草稿。可以採用使用者指定的模板，但不把未知的年度格式當成既定事實。

## 觸發與反觸發

- 觸發：`教案撰寫`、`lesson plan`、教學活動設計、教案草稿。
- 不觸發：已有教案的分層差異化（改用 `lesson-differentiation`）、題庫命題（改用 `item-authoring`）、教材轉遊戲。
- 缺少學段、科目、節數、目標、教材、設備或評量時，先回報缺件，不自行補齊。

## 必要輸入

學段／年級、科目、節數、先備知識、教材範圍、核心素養／學習目標、可用設備、學習者差異、評量目的（形成性／總結性）、評量方式與限制、交付格式與來源。

## 執行流程

1. 建立 `context-brief.md` 與來源／版本 ledger。
2. 將學習目標拆成可觀察表現，建立 objective–activity–assessment matrix。
3. 依學習者差異設計 universal access、分層支援與補救／延伸；有證據才納入迷思概念與鷹架，沒有證據就標記待確認。
4. 設計形成性／總結性評量、評量規準、成功條件、可及性調整與各 tier 的 assessment alignment；核心目標與評量標準不得因支援層級而降低。
5. 設計 lesson flow、教材資源與教師／學生操作步驟。
6. 產出草稿後，依 Route Plan 的 verifier policy 檢查目標—活動—差異化—評量對齊、證據與過度主張；格式要求另交文件處理 Skill。

## 輸出契約

輸出 `context-brief.md`、`standards-alignment.md`、`objective-activity-assessment-matrix.md`、`differentiation-plan.md`、`assessment-design.md`、`assessment-rubric.md`、`differentiation-assessment-alignment.md`、`lesson-flow.md`、`materials-and-resources.md`、`lesson-plan-draft.md`、`review-report.md` 與下一步核准清單。

## 停止規則

- 無來源、目標、學習者差異或評量目的／方式時，只輸出 `intake-gap.md`，不生成完整教案。
- 差異化支援缺少學科證據時，標記待確認或 deferred，不把模型推測當成迷思概念或教學定論。
- 差異化後評量無法對應核心目標、成功條件或公平性時，阻擋交付。
- 未指定年度／地方模板時，輸出 generic draft 並標示待確認，不冒充官方格式。
- 涉及學生個資、外部發布、付費工具或正式送件時，先交給 User Authority。
- 若使用者提供的是既有教案，轉交 `lesson-differentiation`，不可誤當新建教案。

## Harness 整合

- 本 Skill 是 Primary Skill；由 Skill Registry 與 Route Plan 決定是否載入。
- `reasoning-kernel` 只在需要比較假設、處理衝突或設計查證時作為 Supporting Skill，不覆蓋本 Skill 的輸出契約。
- 文件內容閱讀可依 Registry 條件載入 `document-to-markdown-ingestion`；格式與版面要求仍以原始檔檢查為主。
- 所有輸出位置由 Runtime Context 提供，使用 repository-relative path；本 Skill 不寫死磁碟代號或使用者目錄。
- 不自動安裝 provider、Plugin、MCP 或外部 runtime。
