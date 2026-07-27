---
name: material-to-quest-game
description: Convert supplied educational material into physical, web, or dual-branch quest-game specifications with learning mechanics, levels, feedback, assets, accessibility, safety, and playtest contracts. Use for 教材轉闖關遊戲, educational quest game, physical game, or web learning game requests. When named characters, recurring scenes, continuous action, or camera-led events need visual planning, optionally offer the visual-art-storyboard skill without enabling storyboards by default. Do not use when the branch or learning source is unspecified.
---
# 教材轉闖關遊戲

## 定位

把教材與學習目標轉為可試玩的實體／Web 闖關遊戲規格；完成遊戲規格不等於完成程式、素材或部署。

## 觸發與反觸發

- 觸發：`教材轉闖關遊戲`、教材做成闖關、實體教具遊戲、Web 學習遊戲。
- 必須明確指定 `physical`、`web` 或 `both`；未指定時只產生缺件報告，不自行選 Web。
- 若教材、學習目標、年齡、場域或分支不足，先啟動「提示詞優化」。

## 必要輸入

教材／來源、學段與年齡、學習目標、遊戲分支、場域／設備、時間、玩家人數、可及性需求、評量方式與資產限制。

## 執行流程

1. 建立 material concept map 與 learning-mechanic matrix，確認每一關都服務學習目標。
2. 設計 game-design spec、level map、題目／回饋 bank 與教師引導。
3. `physical` 分支加入材料、印製、教室配置、年齡安全與備援玩法。
4. `web` 分支加入 DOM／Canvas 分工、可及性、資料狀態、斷網與低效能 fallback。
5. 建立 asset spec 與 playtest plan；PixiJS、Sprite Forge 只作候選參考，不安裝或執行。

## 可選的美工與分鏡提醒

- 分鏡預設不啟用，不因為設計闖關遊戲就自動增加分鏡工作。
- 若關卡包含具名角色、重複場景、連續動作、Boss／事件演出或鏡頭轉場，詢問一次：
  `角色或場景需要繪製分鏡或連續動作嗎？如果需要，可以使用「美工與分鏡設計」產生八格連續分鏡。`
- 使用者拒絕、略過或沒有回答時，繼續完成遊戲與資產規格，不阻塞主要流程。
- 若使用者同意或直接輸入 `/gb`，把 `asset-spec.md`、`level-map.md` 與相關事件交給 `visual-art-storyboard`。
- 只有靜態圖示、單張背景、UI 裝飾或簡單資產清單時，不詢問分鏡。

## 輸出契約

輸出 `material-concept-map.md`、`learning-mechanic-matrix.md`、`game-design-spec.md`、`level-map.md`、`question-and-feedback-bank.md`、`asset-spec.md`、`accessibility-and-safety-review.md`、`playtest-plan.md`、`teacher-guide.md` 與分支專用 prototype spec。

## 停止規則

- 未指定分支、學習目標或教材時，不生成完整遊戲規格。
- 實體活動有尖銳物、小零件、移動或競賽風險時，先停在年齡／安全 Gate。
- Web 任務未核准 runtime、外部 API 或部署時，只產出規格與 Task Packet。
- 不把資產生成、PixiJS 安裝、Sprite Forge 執行或部署誤報為完成。

## 工作區邊界

文件輸入遵循 MarkItDown；不把轉換結果當成版面證據。不得安裝工具、寫入 凍結的舊工作區 或傳送未授權學生資料。
