---
name: document-to-markdown-ingestion
description: Convert supported source documents to Markdown before the model reads, summarizes, searches, extracts, compares, or reviews their content. Use for content-focused ingestion of DOCX, PDF, PPTX, XLSX, XLS, MSG, HTML, CSV, JSON, XML, EPUB, or IPYNB files. Do not convert when the request concerns formatting, layout, typography, margins, pagination, visual placement, rendering, or format compliance; inspect the original file instead.
---
# AI 文件 Markdown 轉換

這是一個工具型 Supporting Skill，負責把「內容閱讀」與「版面檢查」分流，不替使用者判斷文件內容，也不把轉換結果當成版面正確性的證明。

## Classify first

| Intent | Required path |
|---|---|
| 閱讀、摘要、搜尋、擷取、比較、翻譯或檢查論點 | 先轉 Markdown |
| 檢查版面、字型、邊界、分頁、行距、圖表位置、渲染或官方格式 | 不轉換，檢查原始檔 |
| 內容＋格式混合要求 | 格式例外優先，不對該檔案執行 MarkItDown |
| 已是 Markdown 或原始碼 | 直接讀取，不需要轉換 |

需求不清楚時，依使用者真正想驗證的結果分類，不只看副檔名。

## Content ingestion workflow

1. 確認輸入不是 secret、credential、token、key、auth export 或不相關私人檔案。
2. 先執行 wrapper 的 plan-only 模式並檢查 `INGESTION_PLAN`。
3. 確認輸入、副檔名、固定版本、相對 cache 與相對輸出位置。
4. 只有在內容轉換確實適用時，才加上 `-Execute`。
5. 後續內容分析優先讀產生的 Markdown；同一份未變更來源不要反覆轉換。
6. 若表格、公式、圖片、掃描或擷取缺漏會影響結論，再回看原始檔相關頁面。Markdown 是文字讀取的主要前處理產物，不是視覺正確性的證據。

```powershell
pwsh -File brain/skills/document-to-markdown-ingestion/scripts/convert-document.ps1 `
  -WorkspaceRoot . `
  -Purpose Content `
  -InputPath <source-file>

pwsh -File brain/skills/document-to-markdown-ingestion/scripts/convert-document.ps1 `
  -WorkspaceRoot . `
  -Purpose Content `
  -InputPath <source-file> `
  -Execute
```

`WorkspaceRoot`、cache 與 output 都以 repository-relative path 為優先；實際根目錄由 Harness 的 Runtime Context 或 `HARNESS_ROOT` 決定，不寫死磁碟代號。

## Format exception

格式或視覺審查可把 wrapper 當 guard check：

```powershell
pwsh -File brain/skills/document-to-markdown-ingestion/scripts/convert-document.ps1 `
  -WorkspaceRoot . `
  -Purpose Format `
  -InputPath <source-file>
```

必要結果是 `FORMAT_REVIEW_ORIGINAL_REQUIRED`；之後交給檔案類型對應的 formatter／renderer Skill。不可用轉換後 Markdown 證明頁面級正確性。

## Tool boundary

- MarkItDown 版本固定為 `0.1.6`，只使用必要的 format extra。
- cache 預設為 `scratch/cache/markitdown`，output 預設為 `outputs/document-ingestion`。
- 使用 `uvx` isolated run；不執行 `uv tool install`、`pip install`、全域 PATH 修改或專案依賴安裝。
- source 不覆寫；output 必須是新的 `.md`。
- `uvx` 不存在、輸入不合法或輸出越界時，回報 deferred／blocked，由 Route Plan 決定 fallback；不自行改用未知工具。

## Report

記錄來源路徑、來源 metadata、輸出路徑、converter version、是否需要回看原始檔與限制。轉換只能報告為 preprocessing，不是格式保真證明。
