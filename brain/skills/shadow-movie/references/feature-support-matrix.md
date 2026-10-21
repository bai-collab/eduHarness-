# v0.2 Feature Support Matrix

| 功能 | 狀態 | v0.2 行為 |
|---|---|---|
| Story → Script → Scene → Shot | 支援 | 由結構化 JSON 保存，Build 前驗證引用 |
| 相機 from／to | 支援 | 支援平移、垂直移動與 scale 插值 |
| 角色 from／to | 支援 | 支援位置插值、facing、view、scale、rotation |
| `mount_on` | 支援 | 由父角色位置加 `mount_offset` 推導 |
| 分層視差 | 支援 | `far=0.2`、`middle=0.5`、`ground=1.0` |
| SVG 關節動畫 | 支援 | 小明步態、抬頭、騎乘；神龍多節脊椎波浪 |
| 混合 SVG／PNG 資產 | 支援 | 同一份 `assets.json` 可混用 SVG 與 PNG；Build 產生自包含 HTML |
| PNG 單張角色／背景 | 支援 | 角色使用透明 PNG；背景可用 `src` 或 `layers`，沿用同一舞台 transform |
| PNG `frame_sequence` | 支援 | 以 `frames`、`hold_ticks`、`phase_ticks`、`loop` 播放固定 artboard 逐格動作 |
| PNG 安全與尺寸驗證 | 支援 | 檢查 signature／IHDR、尺寸、色彩型別、檔案大小、角色 alpha 與序列同尺寸 |
| parent-child 骨架樹 | 支援 | 以 `parent`、`parentIndex`、`depth` 與 affine world matrix 計算髖→膝→踝等階層；不得把子部件固定在舞台座標 |
| root motion／position control | 支援 | 以 `position_control` 驅動 stage-root 的 x／y；背景留在 world-root，角色與子部件一起沿橋面或道路移動 |
| bone attachment／物件連動 | 支援 | 部件、郵袋、圍巾、信封、操偶桿等物件以 `boneIndex` + bone-local transform 掛載，骨架完成後再計算物件 world transform |
| hand／grip handheld prop | 支援 | 先建立 hand／grip child bone，再以 `joint_anchor` 綁定信件、旗子等物件；手臂旋轉時繼承同一 world transform |
| WebGPU rig compute | 支援（可選） | `runtime/webgpu-rig.js` 依 depth dispatch bone pass，再執行 object attachment pass；WebGPU 不可用時沿用同一 PoseState 的 SVG／CPU fallback |
| 24 FPS pose 與 render interpolation | 支援 | 電影時間軸維持 24 FPS；繪製可在螢幕更新率插值，避免姿勢在 frame boundary 跳動 |
| 字幕 | 支援 | Shot 內相對時間，使用 `textContent` |
| Play／Pause／Restart | 支援 | 使用 requestAnimationFrame 播放 |
| Seek／逐幀／Shot navigation | 支援 | 逐幀步長為 `1 / fps` |
| 主視覺錨點與 C／D／E 視覺審查 | 有參考圖時支援 | 使用 `visual-review.json` 記錄素材來源、截圖證據與使用者核准；不把技術 Build 當成風格驗收 |
| 音效／旁白 | 延後 | 不在 v0.2 Runtime 宣稱支援 |
| Quiz／答題回饋 | 延後 | 不在 v0.2 active contract |
| Props 素材生成／Transition | 延後 | 物件的骨架掛載與矩陣運算已支援；完整物件素材製作與轉場效果後續另訂 contract |
| 外部 MCP／雲端服務 | 不需要 | 保持 local-only |
