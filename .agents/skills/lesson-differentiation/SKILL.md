---
name: lesson-differentiation
description: Differentiate an existing lesson or explicitly supplied lesson source into supported tiers while preserving the core learning objective, task, and standard. Use for 教案差異化, lesson differentiation, tiered support, remediation, extension, or adapting an existing lesson for learner differences. Do not use for authoring a new lesson without a source lesson.
---
# 教案差異化教學

## 定位

在既有教案或明確來源上設計分層支援、補救與延伸；不重新發明核心目標，也不把「新建教案」誤路由為差異化。

## 觸發與反觸發

- 觸發：`教案差異化`、`教案差異化教學`、lesson differentiation、分層教學、補救／延伸活動。
- 必須有既有教案、課程來源或使用者明確指定的 lesson draft。
- 沒有來源 lesson 時，轉交 `lesson-plan-authoring` 或啟動「提示詞優化」列缺件，不猜測原始目標。

## 必要輸入

既有 lesson、科目、核心目標與評量、學習者差異／先備、分層數量、可用時間／設備、語言／可及性需求、補救與延伸限制。

差異化分析最低必須產出三個分析面向：

- 學科迷思概念：學生可能持有的錯誤概念、正確概念、來源證據與教學回應。
- 易錯概念：容易出錯的步驟／表徵／術語、觸發條件、預防性檢核與 exit ticket。
- 鷹架理論：採用的鷹架理論、由強到弱的支援層級、每個 tier 的支援對應與撤除條件。

若來源沒有足夠證據，不得自行補成學科事實；改列待確認、intake-gap 或 deferred，並保留 evidence reference。

## 執行流程

1. 讀取來源 lesson，鎖定核心目標、任務、評量與不可降低的標準。
2. 建立 learner-profile 與 differentiation matrix，分別設計 access support、補救與延伸。
3. 建立 concept-risk-register，分開記錄學科迷思概念與易錯概念；每項都要有 evidence、錯誤／迷思描述、教學回應與可觀察 look-for。
4. 明示鷹架理論與支援退場路徑，將示範、提示、部分完成範例、同儕／工具支援與獨立作答對應到各 tier；不得把鷹架當成降低核心標準。
5. 保持核心概念與評量對齊；below tier 只能增加支援，不得默默降低學習標準。
6. 以 `verifier` 檢查每層的目標、活動、語言、可及性、迷思／易錯概念回應、鷹架撤除條件與評量映射。

## 輸出契約

輸出 `source-lesson-summary.md`、`learner-profile.md`、`differentiation-matrix.md`、`subject-misconception-analysis.md`、`error-prone-concept-analysis.md`、`scaffolding-theory-rationale.md`、`tier-support-plan.md`、`remediation-plan.md`、`extension-plan.md`、`assessment-alignment.md`、`artifact-alignment-report.md`、`teacher-implementation-notes.md` 與 review brief。

## 停止規則

- 無來源 lesson、核心目標或評量時，只輸出缺件報告。
- 學科迷思、易錯概念或鷹架理論沒有來源證據時，不得把模型推測寫成定論；只輸出待確認分析與缺件報告。
- 差異化方案會改變核心標準、評量公平性、學生個資或正式資格判定時，停在教師／使用者審查。
- 美國 Knowledge Graph、MCP provider、provider-owned rubric 與外部課綱只可作參考索引；不得呼叫、安裝、上傳資料或當成臺灣官方規則。
- 不安裝工具、不呼叫未核准 provider、不寫入 凍結的舊工作區。

## 工作區邊界

文件內容閱讀遵循 MarkItDown；格式／版面審查一律保留原始檔例外。提示詞缺口先交 `prompt-optimization`，不靜默改變原教案。
