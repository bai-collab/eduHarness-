# 可攜式 Brain 遷移層

Brain 遷移層把「來源工作區」與「目前工作區」分離。它只在使用者明確要求遷移時讀取來源，並以 repository-relative path 與 hash 做衝突檢查。

## 目前副本的狀態

乾淨分享副本不攜帶 migration manifest。這是正常狀態，不代表資料損壞；`node harness/cli/brain.mjs verify` 會回報 `not-applicable`，同時仍驗證 `brain/index.json` 與實際 collection。

只有在本機明確執行遷移並使用 `--apply` 時，才會在工作區產生該次任務的 manifest。它不屬於可攜 Brain 的固定輸入，也不應被放進分享副本。

## 遷移流程

先預覽：

```powershell
node harness/cli/brain.mjs migrate --source <source-root>
```

確認來源與衝突為零後才套用：

```powershell
node harness/cli/brain.mjs migrate --source <source-root> --apply
```

遷移器會逐檔計算來源 hash、目的 hash 與 repository-relative destination path；目的檔案已存在且 hash 不同時停止，不自動覆寫。

## 驗證與按需查詢

```powershell
node harness/cli/brain.mjs verify
node harness/cli/brain.mjs inspect
node harness/cli/brain.mjs search "可攜 Brain 知識"
```

驗證結果有三種語意：

- `ok`：manifest 存在且 hash、Brain index 與 collection 都通過。
- `not-applicable`：沒有 manifest，但 Brain index 與 collection 正常；這是乾淨分享副本的預期結果。
- `failed`：Brain index、collection、manifest 或 hash 檢查發現錯誤。