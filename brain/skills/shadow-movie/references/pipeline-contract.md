# Shadow Movie v0.2 Pipeline Contract

## 1. 目標

這份契約是 `movie.json`、`script.json`、`storyboard.json`、`assets.json`、Validator、Runtime 與 Build 的共同來源。自然語言規格可以補充美術與敘事原則，但不能改寫 JSON 欄位語意。

## 2. 相對路徑與資料根目錄

- 契約的根目錄是 Skill package 的 `demo/` 或呼叫者指定的 demo root。
- `movie.json` 的 `files` 只能指向根目錄內的相對 JSON 檔案。
- `assets.json` 的 `src`、`views`、`layers` 與 `frame_sequence.frames` 只能指向根目錄內的 SVG 或 PNG 檔案。
- 每個 asset 的 `format` 必須是 `svg` 或 `png`，且所有該 asset 的媒體路徑副檔名必須相同；同一份 `assets.json` 可以混用不同 asset format。
- 禁止 `..`、絕對路徑、Windows 磁碟代號、URL、data URL 與 bearer URL。
- Build 先驗證並讀取 SVG／PNG，將 SVG 經 sanitizer、PNG 轉成受控 data URL，之後才建立 bundle；Runtime 不負責信任未驗證的原始檔。

## 3. 時間與座標

- 舞台預設為 1920×1080、24 FPS；manifest 可調整 FPS，但範圍為 12～60。
- 所有位置是虛擬舞台座標，`x`、`y` 必須是有限數字。
- 時間變化一律使用 `from` 與選用的 `to`：

```json
{
  "from": {"x": 50, "y": 590},
  "to": {"x": 720, "y": 590}
}
```

- 不使用 `startX`、`endX`、`startY`、`endY`、`toScale` 等別名。舊 v0.1 資料必須先經 migration。
- `shot.duration` 大於 0；字幕的 `start` 不得小於 0，且 `start < end <= shot.duration`。

## 4. Canonical 檔案關係

```text
movie.json
├─ files.script → script/script.json
├─ files.storyboard → storyboard/storyboard.json
└─ files.assets → assets/assets.json
```

- `movie.scenes` 必須與 script 的 `scene_id` 集合相同。
- 每個 storyboard shot 的 `scene_id` 必須存在於 script。
- 每個 character、background 與 layer asset 引用都必須存在於 assets。
- `mount_on` 只能引用同一 shot 中已出現且未掛載的父角色；不可形成循環。

## 5. 角色與背景

角色 asset 使用單張 `src` 或 `views.side`、`views.front`、`views.back`；Shot 的 `view` 預設為 `side`。角色可以是可標註關節的 SVG，也可以是保留透明 artboard 的 PNG；PNG 逐格角色可省略 `src`／`views`，改用 `frame_sequence.frames`。角色 SVG 的關節應以穩定 id 或 `data-joint` 標示，例如 `part-head`、`part-chest`、`part-waist`、`dragon-seg-head`。

背景 asset 可使用單張 `src`，或使用 `layers.far`、`layers.middle`、`layers.ground`。SVG／PNG 都可以作為背景層；單張 PNG 會放在 ground layer 並與角色共用相同舞台 transform。視差係數固定由 manifest／Runtime 共同使用：

```text
sky=0.0, far=0.2, middle=0.5, ground=1.0
```

### 5.1 骨架、物件與 WebGPU rig

需要拆解角色或可動物件時，character asset 可選擇加入 `rig`；欄位以 [rig.schema.json](schemas/rig.schema.json) 為準。

- `rig.bones`：每個 bone 有 `id`、`parent`、`local_position`，可選 `local_rotation`、`local_scale`、`control` 與 `position_control`。parent graph 必須無循環。
- `rig.attachments`：身體部件與可繪製 layer；`rig.objects`：郵袋、圍巾、信封、操偶桿等非骨架物件。兩者都必須以 `bone` 綁定，不得把子物件另存成固定舞台座標。
- CPU preflight 將 parent id 編譯為 `parentIndex`，計算 `depth`；WebGPU bone compute 依 depth 分批 dispatch，完成後才執行 object attachment compute。
- 每個 object 使用 `boneIndex`、bone-local position／rotation／scale 與 inherit flags；世界矩陣規則為 `objectWorld = boneWorld × localObject`。
- 角色沿橋面、道路或地面移動時，背景掛在靜止的 `world-root`，角色掛在帶 `position_control` 的 `stage-root`；移動只更新 root channel，不逐件修改舞台座標。
- 角色走路時，`stage-root.position_control` 應同時提供 `walkX`／`walkY`；同一個 `gaitChannels(progress)` 先決定支撐腳，再由腳端 probe 與路徑函數解算 root。支撐腿保持接觸，擺動腿抬起折膝，並以雙腿四個 channel 與 `maxContactError` 驗收，不能只檢查 root 是否改變。
- 手持信件、旗子或操偶桿時，先建立 hand／grip child bone，再把 prop attachment 綁到該 bone；prop 的 `joint_anchor` 與 local offset 必須在手臂旋轉和 root 位移中保持一致。
- `movie.render.backend` 可為 `auto`、`svg-cpu` 或 `webgpu`。`webgpu` 失敗時必須回到同一份 PoseState 的 SVG／CPU renderer，不能改變關節語意。
- movie 時間仍依 `fps`（預設 24）保存；render loop 可在相鄰 pose 間插值，但 seek／逐幀必須落回精確的 24 FPS pose。

### 5.2 混合媒體與 PNG 逐格動作

同一份 `assets.json` 可以保留 SVG 骨架角色、SVG 分層背景、PNG 單張背景與 PNG 逐格角色；這是 asset-level 的格式選擇，不是另建一套 Skill 或第二份時間軸。PNG asset 的最小寫法如下：

```json
{
  "id": "fox-badminton",
  "name": "狐狸打羽球",
  "type": "character",
  "format": "png",
  "frame_sequence": {
    "frames": [
      "assets/fox/frame-01.png",
      "assets/fox/frame-02.png"
    ],
    "hold_ticks": 3,
    "phase_ticks": 0,
    "loop": true
  }
}
```

- `hold_ticks` 是每張圖保持的電影 tick 數；省略時由 Runtime 使用 3 tick。
- `phase_ticks` 是序列起始偏移；省略時為 0。`loop=false` 時停在最後一張。
- 同一 `frame_sequence` 的 PNG 必須有相同寬高；角色 PNG 與 PNG frame 必須有 alpha，避免把矩形背景誤當成皮影角色。
- Runtime 只替換 PNG `<img>` 的 `src`，不重建角色容器、不改寫 stage 座標；SVG 仍沿用原本 DOM／骨架路徑。

## 6. Build 與 Runtime

1. Parse JSON。
2. 驗證欄位、引用、時間、數值與相對路徑。
3. 依 `asset.format` 讀取媒體：SVG 執行白名單 sanitizer；PNG 驗證 signature／IHDR、尺寸、色彩型別與檔案大小，角色 PNG 另外檢查 alpha。
4. 將已驗證的 SVG 字串與 PNG data URL 寫入 bundle；逐格 PNG 以 `frame_sequence.frames` 保留順序與 hold／phase／loop 設定。
5. 若選用 WebGPU rig，初始化 shader／buffer／texture quad；不能在每幀重建 GPU pipeline。
6. 將 Runtime、CSS 與 bundle 產生自包含 `index.html`。
7. 由 Runtime 初始化資產；播放時只更新 PoseState、transform 與字幕，不每幀重建整棵 SVG DOM。

若輸出目錄存在，Build 必須停止；只有明確傳入 `--force` 才可重建。

## 7. Checkpoints

- A：劇本完成，使用者確認角色、事件與結局。
- B：分鏡完成，使用者確認 Shot、節奏、運鏡與字幕。
- C：素材完成，使用者確認角色視角、關節、背景層與資產來源。
- D：動畫完成，使用者確認時間軸、步態、root motion、龍身波浪、parent-child 骨架、手持物件掛載與 CPU／WebGPU world transform 一致。
- E：HTML 預覽完成，驗證播放、seek、逐幀、字幕、鍵盤與最後一幀覆蓋。

### 7.1 Reference-driven 視覺 gate

若使用者提供或核准主視覺、要求依圖拆解或要求「同風格」，先讀 [master-visual-prompt.md](master-visual-prompt.md)，以固定的先生圖 Prompt 產生或確認主視覺，並在 `visual-review.json` 鎖定 prompt id／版本；C／D／E 還要走 [visual-review-contract.md](visual-review-contract.md) 定義的視覺 gate。這是技術 Checkpoint 之外的必要條件，不是可有可無的美術備註。

- C 要把主視覺與角色、背景、可動物件拆解圖並排比對，並記錄每個 asset 的來源映射。若只是用同色票重新畫出另一套扁平幾何圖，C 不得核准。
- D 要檢查第一幀、中間代表幀與最後一幀，確認走路關節、掛載、操偶桿、遮擋與材質在運動後仍完整。
- 若有 `rig`，D 還要檢查大腿角度改變時小腿膝 world position 是否改變、子部件局部 0° 是否仍跟著 parent，以及物件是否跟著指定 bone；不得只比較 transform 字串。
- 若有 root motion 或手持物件，D 還要檢查背景保持固定、角色沿路徑移動、信件／旗子／操偶桿在中段仍留在 grip；不得只檢查第一幀。
- E 要在目標 viewport 的本機瀏覽器檢查 HTML 截圖與主視覺的風格一致，再取得使用者明確確認。播放、seek、逐幀與字幕測試不能取代這項比對。
- `scripts/validate.mjs` 與一般 Build 只做結構、安全、時間軸、媒體格式與組裝檢查；`scripts/validate-visual-review.mjs` 的 `asset_paths` 可列 SVG 或 PNG，並會檢查 `frame_sequence.frames` 是否完整映射。它只檢查視覺審查紀錄的結構、相對路徑、證據存在與 gate 前置條件。預設不要求像素級 diff，因為不同輸出媒介不一定適合直接做像素差。

音效與 Quiz 在 v0.2 不進 active pipeline；若日後啟用，必須新增 Schema、Runtime 行為、測試與使用者授權 checkpoint。
