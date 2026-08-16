---
name: mineru-document-parsing-reference
description: MinerU 文件解析能力、輸出格式與採用邊界的第一手來源摘要
type: knowledge-reference
status: recorded-not-installed
source: https://github.com/opendatalab/MinerU
source_revision: d056e5ca21a9f45504cbdecf74e6d25c3bb750b8
source_collection: linebot-notes
primary_source: github
primary_source_repo: https://example.invalid/source-omitted-for-share-build/notes
legacy_source_sheet_row: 108
source_fingerprint: sha256:a1e425ad648346346e7c6cb3c6b8fb46034b8fb2baf58d3b17c1c1b909819946
verified_at: 2026-07-24
---
# MinerU：文件解析候選工具

## 已查核能力

- MinerU 將 PDF、圖片、DOCX、PPTX、XLSX 等輸入轉成 Markdown、JSON 與其他機器可讀格式。
- 官方 README 描述的能力包含版面閱讀順序、表格與公式轉換、OCR、圖片與標題擷取，以及 CLI、API、WebUI 等使用介面。
- 複雜版面、掃描文件與手寫內容仍可能解析不理想；官方建議先用實際樣本評估品質。

## F 槽採用邊界

- 本紀錄不代表已安裝或核准安裝 MinerU。
- 若未來導入，仍須先走 installation preflight、固定版本、隔離環境與真實文件驗證。
- MinerU 的輸出只能作為文件攝取中間產物；引用、版面與敏感資料仍需獨立驗證。

## 來源

- Repository／README：<https://github.com/opendatalab/MinerU>
- README blob：`d056e5ca21a9f45504cbdecf74e6d25c3bb750b8`

