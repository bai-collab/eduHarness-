# AI／GLB 資產管線

## 輸入

- 物件用途與教學關聯。
- 參考圖或 AI 概念圖。
- 目標風格、比例、單位、朝向與鏡頭距離。
- 需要的元件、pivot、socket、碰撞、LOD 與動畫。
- 輸入影像作者、來源、取得日期與授權。

## 生成路由

1. 優先使用程序化幾何或自製資產。
2. 已驗證的 CC0／直接授權資產可進 Pilot，但每件資產都要獨立記錄。
3. AI 生成資產先放在候選區，通過品質與授權 Gate 後才可進 manifest；未通過時狀態為 `experimental-blocked`。
4. img2threejs 目前只作 `experimental-blocked` candidate；必須有核准的 executor、固定版本、隔離執行、認證方式、完整測試與已知限制，才可重新評估解鎖。
5. image-to-3d-scene 用於參考圖到程序化展示頁，不宣稱 GLB／OBJ／FBX 匯出。

## 資產驗證

- 幾何：比例、尺寸、up axis、原點、pivot、階層、法線、退化面與 bounding box。
- 材質：Base Color、UV、透明度、色彩空間；Normal／ORM 只在近距離確有差異時使用。
- 動畫：命名、播放、可中斷、可跳過；不得控制 Quest State。
- 互動：教學 hotspot、socket、碰撞或選取 metadata。
- 效能：mesh、triangle、texture、animation、解碼後記憶體、draw calls、下載量。
- 回退：placeholder、靜態圖、DOM-only 與載入逾時。
- 追溯：版本、SHA-256、來源、授權／SPDX、依賴與 decoder。

## 輸出

~~~text
asset.glb
asset-manifest.json
asset-preview.png
asset-ledger.md
asset-validation-report.md
placeholder
~~~

不把「模型能被載入」等同於「資產可教學使用」或「Pilot 已完成」。

沒有核准的 AI-to-GLB executor 時，本 Workflow 只能驗證使用者已提供的 GLB 或產出 asset brief；不得自行抓取未知遠端模型。
