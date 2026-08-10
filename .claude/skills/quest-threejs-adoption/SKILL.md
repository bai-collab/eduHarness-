---
name: quest-threejs-adoption
description: Guide teachers and developers to progressively add Three.js to a web educational quest game while keeping learning state and accessible operation in DOM. Use for 闖關遊戲 Three.js 導入、教師 3D 闖關 Workflow、3D 教學物件 Pilot、DOM baseline 與 Three.js art island planning. When no material is supplied, produce only a teacher intake and blank contracts; do not invent teaching content. Do not use for rebuilding a scene from one image; use image-to-3d-scene instead.
---

# 闖關遊戲 Three.js 導入

## 定位

協助教師把「確實需要空間理解」的內容，以小型 Pilot 漸進加入 Web 闖關遊戲。Quest State 與 DOM 永遠承擔題目、得分、進度和等價操作；Three.js 只作可關閉的 3D 美術與互動層。

本 Workflow 為實驗版規格流程，尚未代表通過真實課堂 Pilot。

## 分支判斷

1. **沒有教材或案例**：使用 `assets/teacher-intake-template.md`，輸出 `intake-only`。不得猜教材、年段或學習目標。
2. **只有教材，尚無闖關規格**：先使用 `$material-to-quest-game` 建立 `web` 分支，再回到本 Workflow。
3. **已有 Web 闖關規格與學習目標**：先分類這個 3D 的角色，再判斷是否不可替代。
   - **遊戲美術層**（關卡入口、地圖、寶箱、Boss、演出、粒子、天氣）：與學習成效無關，僅以動機、成本與可及性決定；預設維持 2D／DOM，不進學習證據流程。
   - **學習物件層**：內容本身是否為立體、且 2D 會遺失深度／遮蔽／內部構造？（判準：把它轉一圈，會不會看到平面圖看不到的東西？）
     - 否（文字、公式、平面圖表、時間軸、2D 拖曳）：維持 DOM／SVG；大量 2D 畫面才評估 PixiJS。
     - 是（如立體幾何剖面、向量與空間座標、電磁場與力的方向、拋體與圓周運動軌跡、分子結構、地層、機械傳動、人體解剖）：3D 能幫助空間理解，主動引導使用者建置 3D 教學物件 Pilot（進 Gate 2–3）。
4. **只有一張場景參考圖且要求重建展示頁**：改用 `$image-to-3d-scene`。
5. **要求建立程式或安裝套件**：先完成本 Workflow 全部契約、project-local Task Packet、安裝防重檢查與精確預覽；未核准前停止。

## 執行流程

### Gate 0：教師 Intake

確認教材、學習目標、年段、場域、Web 分支、Pilot 物件、目標裝置、網路、可及性、評量方式、資產政策與可用時間。缺少會改變教學設計的資料時，只輸出缺件報告。

### Gate 1：先完成 DOM-only baseline

規格必須讓 WebGL 關閉、裝置過慢或教師停用 3D 時，學生仍能完成同一學習任務。每個 3D hotspot 都要有完整 DOM 等價操作。

### Gate 2：單一 3D 教學物件

第一個 Pilot 只含一題、一個 3D 物件、3–5 個熱點，以及旋轉、縮放、剖面或拆解中的必要操作。不製作 3D 地圖、戰鬥、物理、自由走動或多人連線。

### Gate 3：建立契約

以 `assets/` 內模板產生下列檔案：

- `teacher-intake.md`
- `quest-3d-use-case.md`
- `scene-art-spec.md`
- `scene-event-contract.md`
- `asset-ledger.md`
- `performance-budget.md`
- `pilot-acceptance-checklist.md`
- `pilot-budget-and-kill-switch.md`

Scene Event 至少含 `contractVersion`、`eventId`、`sceneInstanceId`、`questRevision`、`correlationId`、`type` 與 `payload`。使用 `object.collectRequested`，不要讓 `animation.completed` 控制進度。

### Gate 4：驗證與停止判斷

比較 DOM-only 與 3D 版的任務完成率、完成時間、迷思概念、教師觀察及學生不適。效能以命名裝置與網路量測冷啟動 P50／P95、frame-time、記憶體、draw calls、10 分鐘連續操作與降級結果。

若 3D 沒有可觀察的學習增益、兩輪仍無法辨識、造成不適或超過 Pilot 預算，回退 DOM／SVG。

### Gate 5：延後擴張

第一個 Pilot 通過後，第二個不同類型 Pilot 才可評估 3D 關卡地圖。至少兩個不同類型 Pilot 通過，且完成一次「只列重複、不急著抽共用模組」的排練後，才評估共用 Adapter、編輯器或成熟 Skill。

## 資產與授權

- 第一個 Pilot 只用自製或直接驗證的 CC0 資產。
- 聚合站只作搜尋線索；ledger 同時記錄聚合頁與原作者頁。
- 輸入影像也要記錄作者、來源與授權；不得把未授權圖片轉成衍生 3D 資產。
- Tiny World Builder 只作清淨室概念參考：規格整理者不讀 source，實作者不採用其 AGPL 程式碼或專有識別符。

## 可及性與安全

- 提供鍵盤、觸控、螢幕閱讀器與 DOM 等價路徑。
- `prefers-reduced-motion` 必須停用鏡頭過場、晃動與非必要動畫。
- 檢查 WCAG 2.3.1 三閃、動暈、動態背景上的文字對比、靜音與焦點順序。
- WebGL context loss、載入失敗與 Kill Switch 不得破壞 Quest State。
- 不載入未知遠端模型，不收集或輸出學生個資。

## 輸出狀態

- `intake-only`：缺少案例資料，只輸出教師 intake。
- `spec-ready`：契約完整，但未建立程式、未安裝套件。
- `implementation-preview`：具 project-local Task Packet、安裝預檢與精確變更預覽，等待核准。
- `pilot-evidence-ready`：只有真實裝置、瀏覽器與教學比較證據齊全時才可使用。

詳細欄位與 synthetic 示例見 `references/workflow-contract.md`；示例不得當成課程事實或課堂成效證據。
