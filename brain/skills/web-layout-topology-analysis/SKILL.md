---
name: web-layout-topology-analysis
description: >-
  在開始製作 Web 頁面、教育 Web 遊戲、Dashboard、表單或互動場景前，先把 viewport、頁面區塊、元件矩形、anchor、safe area、z-order、containment、overlap、pointer collision 與 2D／3D collision channel 整理成可稽核的 layout_plan。用於使用者要求先規劃版面、切割區塊、避免重疊／遮擋／點擊衝突、responsive layout 或 DOM／Canvas／Three.js 混合頁面；不取代瀏覽器實測、DOM／CUA 或物理引擎。
---

# 網頁版面拓樸分析

## 定位

在寫 HTML／CSS／React 或建立 Three.js 場景前，先建立版面與元件的空間模型。輸出 `layout_plan`，不直接修改程式、不宣稱瀏覽器實測通過，也不改寫 Harness 的 `route_plan`。

使用者對內容優先級、固定與可捲動區域、可接受的裝飾重疊及 responsive 取捨擁有最後決定權。資料不足時提出問題與建議，不能用固定螢幕尺寸或猜測內容代替。

## 適用範圍與邊界

適用於：

- Web 頁面、教育 Web 遊戲、Dashboard、表單、互動展示頁。
- DOM／SVG／Canvas／Three.js 混合介面的區塊切割與元件配置。
- 開始實作前的重疊、遮擋、點擊區衝突、裁切與 responsive 風險分析。

不適用於：

- 只需要文案、資料整理或單純視覺風格提案。
- 取代完成後的 DOM、瀏覽器、CUA 或真實裝置驗證。
- 宣稱 3D 物理引擎碰撞已實作；本 Skill 只建立碰撞代理與關係預案。

## 執行流程

### 1. 建立分析輸入

先記錄：

- viewport profile：以相對座標 `0..1` 描述，必要時附目標寬高作驗證標籤，不把單一解析度寫死。
- 頁面模式：固定單頁、可捲動頁面、遊戲畫布、面板式或混合模式。
- layer：DOM、SVG、Canvas、Three.js、overlay、pointer／focus layer。
- 元件清單：內容、控制、提示、裝飾、互動熱點、fallback。
- 使用者優先級：不可被遮住、可捲動、可點擊、可鍵盤操作、可降級等限制。

### 2. 切割 `layout_blocks`

把頁面切成有責任的區塊，而不是只列 CSS class。每個區塊至少記錄：

- `id`、`parent_id`、`role`、`layout_model`。
- 相對 `rect`：`x`、`y`、`width`、`height`。
- `min`／`max` 約束、anchor、safe area 與 overflow policy。
- 內容、控制、互動、裝飾的 priority。

區塊可以巢狀，但不要為了方便把所有元件放進一個大矩形；每個區塊應能說明自己的溢位與遮擋責任。

### 3. 建立 `component_rects`

為每個可見或可操作元件記錄：

- `id`、`block_id`、`kind`、`rect`、`anchor`、`layer`／`z_index`。
- `visual_rect` 與 `hit_rect`；點擊區不可只靠圖片外觀猜測。
- `scroll_context`、responsive variant、`collision_channels`。
- 必要時記錄 3D `bounds`、collision proxy、hotspot 或 socket。

### 4. 計算關係

依每一個 viewport profile 計算並記錄：

- `containment`：元件是否在父區塊或 safe area 內。
- `overlap`：兩個 visual rect 或 hit rect 的交集面積及比例。
- `occlusion`：高 layer 元件是否遮住低 layer 的必要內容。
- `adjacency`／`alignment`：區塊是否保持預期間距與對齊。
- `overflow`／`clipping`：內容是否超出容器且沒有明確內部捲動。
- `collision`：只針對指定 channel 分析 UI hit collision、2D interaction collision 或 3D proxy collision；不要把視覺重疊誤稱為物理碰撞。

每一個 warning 都要保留 `source_ids`、viewport、計算值、threshold、severity、是否為刻意設計及建議處置。

### 5. 實作前 Gate

在 `layout_plan.status` 變成 `ready` 前，先處理：

- 核心內容、主要控制列或必要 hit target 的未預期重疊。
- hit rect 重疊造成的點擊歧義或鍵盤焦點順序衝突。
- 必要內容被遮住、裁切、超出 safe area 或 responsive variant 沒有替代位置。
- 3D hotspot、collision proxy、socket 與物件 bounds 不一致。

裝飾與背景的刻意重疊可以保留，但要標記 `intentional: true`，不可用它掩蓋功能性衝突。

### 6. 交給實作與驗證

把穩定的 block／component ID 帶入 implementation preview。完成頁面後再用瀏覽器 `getBoundingClientRect()`、`elementFromPoint()`、scroll metrics、截圖與實際操作重新量測；把實測結果放入 `verification`，不可把預測的 `layout_plan` 當成 `DOM_PASS` 或 `CUA_PASS`。

## 輸出契約

使用 [layout-plan-contract.md](references/layout-plan-contract.md) 與 [layout-plan-template.json](assets/layout-plan-template.json) 建立 `layout_plan`。至少包含：

- `viewport_profiles`
- `layout_blocks`
- `component_rects`
- `relations`
- `responsive_variants`
- `warnings`
- `assumptions`
- `unresolved_questions`
- `verification`

狀態使用 `draft`、`ready`、`blocked` 或 `verified`。只有瀏覽器與實際裝置證據完成後才可使用 `verified`。

## 與 Harness 的邊界

- 本 Skill 的輸出是獨立 `layout_plan`，不能新增、刪除、重排或改寫 `route_plan` 節點。
- 不因為發現重疊就自行改變 agent、platform 或 verifier 預算；只提出 warning 與建議，交由使用者裁決。
- 若版面分析需要額外瀏覽器工具，先由平台 preflight 確認；工具不可用時保留 `draft`／`blocked`，不能假報完成。
