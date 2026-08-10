# Harness 導入預覽契約

## import-preview.json

必要欄位：

~~~text
schemaVersion
previewId
projectRoot
sourceArtifacts[]
destinationPaths[]
allowedPaths[]
dependencies[]
expectedChanges[]
assetHashes[]
rollback
approval
driftRecheck
~~~

`expectedChanges[]` 至少要說明 `path`、`operation`、`overwrite`、`oldSha256`、`newSha256` 與 `rollbackAction`；`assetHashes[]` 要能區分導入前與導入後 hash。任何 `update` 或 `delete` 都必須提供舊 hash，避免把 drift 當成可安全覆寫。

`driftRecheck` 必須在預覽產生後、實際導入前重新檢查；若工作樹或來源 hash 改變，狀態為 `fail` 並停止，不可沿用舊核准。

## 導入規則

1. 所有來源與目的地先正規化；不得使用工作區外路徑或含有 .. 的逃逸路徑。
2. 來源檔案、manifest、依賴與 decoder 都要列出版本與 hash。
3. 任何 setup、install 或 update 先執行 check-installation-dedup.mjs --require-ready。
4. 只產生預覽時不得寫入專案；使用者核准精確變更後才可套用。投影也要有獨立核准，不得由一般實作核准自動推導。
5. 導入後保留 last-known-good manifest，載入失敗時回退 placeholder 或 DOM-only。
6. Registry、validator、fixture、metadata 與投影變更保留逐檔 pre/post hash；回退只能針對本次明列的檔案，不使用 Git reset。
7. 不讀取、輸出或提交 secrets、tokens、cookies、private keys 或學生個資。

## 錯誤狀態

~~~text
preview-invalid
path-rejected
license-missing
hash-mismatch
dependency-unresolved
approval-required
import-failed
rolled-back
~~~

錯誤回應只暴露可行動的原因，不輸出內部 stack trace 或秘密。
