---
name: procedural-world-field-metrics-workflow
description: 建立可重現的程序化場景 workflow：抽取共用世界欄位、接入材質與生態模組、執行固定條件的截圖與效能量測。當任務涉及 WorldField、程序化地形、植被 instancing、材質烘焙、baseline/candidate 比較或需要把主觀視覺迭代變成可回溯證據時使用。
---

# 程序化場景共用世界與量測迭代工作流

## 核心原則

將工作拆成三層：

1. 可攜契約：`WorldSpec`、`WorldSample`、`GpuCacheManifest`、`CapturePlan`、`CaptureReport`。
2. 參考實作：世界欄位、材質烘焙、生態實例化、capture metrics 四個模組。
3. Workflow：輸入盤點、fixture、固定 capture、量測、verdict 與交接報告。

CPU 世界欄位是 canonical source；GPU texture 只能是有誤差預算的快取。不要複製第三方 repo 的程式碼、素材或未驗證效能宣稱。

## 執行流程

1. 先讀取專案治理、核准計畫與現有 task state；確認 Skill／projection 防重預檢已通過。
2. 定義 `WorldSpec`：schema／generator 版本、座標系、bounds、grid、root seed、RNG algorithm、具名 RNG streams、feature source digest。
3. 實作 `WorldField.sample(xM, zM)` 與 `sampleBatch`。MVP 只支援有限網格、單一無分岔路徑與一個地形來源。
4. 固定欄位語意：距離用公尺、比例用 `0..1`、path 要有 `featureId`／進度／帶符號距離／半寬；超界回傳 `valid=false`，不可默默夾到邊界。
5. 將連續通道與分類欄位分開。`zone`、`surfaceTag`、`roofDensity` 與多路徑語意不是 MVP 欄位，也不可對分類 texture 做線性插值。
6. 建立 `GpuCacheManifest`，記錄通道格式、編碼、濾波、no-data 與每欄 `maxAbsError`；以 golden points 做 CPU/GPU parity test。
7. 建立 `CapturePlan`：固定 baseline/candidate build hash、world hash、viewport、DPR、瀏覽器／GPU、tier、camera poses、warmup、simulation time 與 temporal freeze policy。
8. 每次只改一個 named parameter，交錯執行 baseline/candidate；收集 frame time/p95、draw calls、triangles、像素統計、PNG 與 diff。
9. 效能優先使用 timer query；若只有 fence 同步的 wall-frame time，必須在報告標明方法，不能冒稱純 GPU time。
10. 套用 verdict：門檻通過為 `pass`，明確超標為 `fail`，缺少可靠視覺門檻或量測方法不可用為 `inconclusive`，並標 `needs_review`。

## 驗證與交付

- 先寫會失敗的契約與邊界測試，再做最小實作；維持 RED → GREEN → REFACTOR。
- 至少測試：同 seed fingerprint 三次一致、不同 seed 可辨識、具名 RNG stream 不漂移、邊界／超界、GPU parity、缺 stop、效能超標與無視覺門檻。
- 將 JSON report、PNG、diff、設定 fingerprint 與測量環境一起保存；不要只回報「看起來比較好」。
- 完成後交 fresh verifier；`REFUTED` 必須修正後複驗。Skill canonical 檔可建立，但 `.claude`／`.agents` projection 必須先預覽並取得另外的使用者核准。

## Reference implementation

若目前專案提供參考實作，先由 Runtime Context 解析其 repository-relative 路徑，再執行 `node --test` 或專案的 `npm test`；不需安裝外部套件。若參考實作不存在，只交付契約、測試計畫與量測報告格式，不假造已執行結果。
