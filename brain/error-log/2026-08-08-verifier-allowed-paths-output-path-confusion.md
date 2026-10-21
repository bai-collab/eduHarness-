# Verifier 證據路徑與輸出路徑混用

## 症狀

WP1 tier-2 fresh verifier 在批次讀取時先碰到尚未建立的 Result Packet，因路徑不存在而中止，沒有讀取契約證據，也沒有執行 validator，最後依法回傳 `REFUTED`。

## 根因

`allowed_paths` 是權限邊界，表示 verifier 可以存取哪些位置；它不是「全部都必須先讀取」的證據清單。驗證封包把未來才會建立的輸出檔與既存證據混在同一份讀取清單，造成 verifier 把輸出路徑誤當輸入證據。

## 修復

- `extensions.evidence_paths` 只列驗證開始前已存在的輸入證據。
- `extensions.result_path` 單獨記錄未來 Result Packet 的位置。
- Verifier 提示詞明定只讀 `evidence_paths`，不得把 `result_path` 當成輸入。

## 防護

派工前逐一用 `Test-Path` 檢查 `evidence_paths`；任一不存在即停止派工。`result_path` 只檢查父目錄與寫入邊界，不要求結果檔預先存在。
