# 場景美術規格 Scene Art Spec

> 對應 Pilot 的單一 3D 教學物件；填寫前先確認 `quest-3d-use-case.md` 的 3D 不可替代理由。所有視覺決策都須保留 DOM／SVG 等價路徑，未確認的項目標記「待確認」而非留空猜測。

## 鏡頭 Camera

- 控制方式：OrbitControls／受限自製控制器
- 預設視角與距離：
- 旋轉／縮放／平移範圍限制：
- 剖面或拆解時的鏡頭行為：
- `prefers-reduced-motion` 時的降級（停用過場、晃動、自動旋轉）：

## 色盤 Palette

- 主色／輔色／強調色：
- 背景與地面：
- 熱點與選取狀態顏色：
- 色彩不可作為唯一資訊來源的替代標示（形狀／文字／圖示）：
- 文字與覆蓋層對比（WCAG 2.2 AA）：

## 光線 Lighting

- 環境光／方向光／點光配置：
- 陰影使用與降級順序：
- emissive／夜景等關鍵提示（延後至基礎 Pilot 通過後）：
- 低效能模式關閉項目：

## 物件 Objects

- 物件名稱與教學對應：
- 來源：程序化幾何／GLB（單一物件，非地圖）
- 元件階層、pivot、socket：
- 比例與朝向基準：
- 材質（Base Color；Normal／ORM 僅近距離可見差異時）：
- 重複物件是否用 InstancedMesh：

## 互動 Interaction

- 熱點數量（3–5）與各自教學意義：
- 每個熱點對應的 Scene Event（`hotspot.selected`／`object.collectRequested`）：
- 每個熱點對應的 DOM 等價操作：
- 鍵盤／滑鼠／觸控操作方式：
- 動畫（AnimationMixer）用途；不得以 `animation.completed` 推進關卡：

## Fallback

- WebGL 關閉／`quest3d=off`／裝置過慢時的靜態圖與 DOM 操作：
- 資產載入失敗的 placeholder 與逾時行為：
- context loss 後場景重建且 Quest State 不遺失：
- 音效靜音等價提示：
