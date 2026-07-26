---
name: digital-learning-lesson-plan
description: Prepare Taiwan digital-learning improvement lesson plans with a selected submission profile, platform evidence, teacher-student operation matrix, learning evidence, privacy disclosure, and fallback. Use for 數位學習精進教案, digital learning improvement plan, or requests tied to a current education submission format. Do not apply an old or unspecified annual template as fact.
---
# 數位學習精進教案

## 定位

把教案內容包裝成可追溯的數位學習精進計畫草稿；profile、年度、地方徵件或使用者模板不同時，保留差異，不混用欄位。

## 觸發與反觸發

- 觸發：`數位精進計畫教案`、`數位學習精進教案`、數位學習計畫／徵件格式。
- 必須指定或確認 profile：教育部指引、當年度徵件、地方模板或使用者模板。
- 若 profile、年度、平台、學習證據或 AI／個資揭露不明，先啟動「提示詞優化」並回報缺件。

## 必要輸入

既有教案或課程脈絡、學段／科目／節數、學習目標、數位平台、教師／學生操作、設備與網路條件、評量與學習證據、profile 來源與日期、隱私／AI 揭露需求。

## 執行流程

1. 建立 `submission-profile.md` 與 `platform-evidence-ledger.md`，記錄來源版本與適用年度。
2. 建立 `digital-strategy-map.md`、`teacher-student-operation-matrix.md` 與 `learning-evidence-plan.md`。
3. 對齊目標、活動、平台操作、評量、無網路 fallback 與教師審查。
4. 產出 generic 或 profile-specific draft；格式與年度證據不足時標示 pending。

## 輸出契約

沿用 `lesson-plan-authoring` 的對齊輸出，增加 `submission-profile.md`、`platform-evidence-ledger.md`、`digital-strategy-map.md`、`teacher-student-operation-matrix.md`、`learning-evidence-plan.md`、`privacy-ai-disclosure.md` 與格式差異報告。

## 停止規則

- 未確認 profile／年度／來源時，不套用舊格式，不宣稱符合當年度徵件。
- 平台功能、版本、個資或 AI 使用缺少證據時，輸出待確認欄位。
- 正式送件、外部上傳或學生個資處理需使用者核准。
- provider、MCP、bridge 或 runtime 不可用時，保留 deferred，不假造平台結果。

## 工作區邊界

一般文件內容先走 MarkItDown；格式／版面審查依原始檔例外。不得安裝工具、寫入 凍結的舊工作區 或輸出未授權資料。
