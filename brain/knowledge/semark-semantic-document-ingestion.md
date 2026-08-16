---
name: semark-semantic-document-ingestion
description: Semark 以 MinerU、VLM／LLM review 與品質閘門產生語意 Markdown 的能力與限制
type: knowledge-reference
status: recorded-not-installed
source: https://github.com/KingsleyOWO/Semark
source_revision: 89e60c04acbda2d2b4c705d5bc60a328951afa65
source_collection: linebot-notes
primary_source: github
primary_source_repo: https://example.invalid/source-omitted-for-share-build/notes
legacy_source_sheet_row: 461
source_fingerprint: sha256:599cbb1adb65ab0a6aebde15dcc13c0e074f28b4ac6cae02565d237b0ec3972e
verified_at: 2026-07-24
---
# Semark：語意文件攝取候選工具

## 已查核能力

- Semark 使用 MinerU 取得解析、OCR 與版面證據，再以選用的 VLM／LLM 處理表單、流程圖、圖片語意與品質檢查。
- 輸出可包含主 Markdown、結構化 chunks、source maps，以及表格、流程圖或附件的獨立語意文件。
- 專案提供本機與 Docker 路徑；遠端 OpenAI-compatible endpoint 是選用設定，不是必要預設。
- 個資遮罩是 pattern-based 的最後防線，不是完整保證；高度敏感內容仍應在來源端先遮蔽。

## F 槽採用邊界

- 本紀錄不代表已安裝 Semark、MinerU、Ollama 或任何模型。
- 若未來導入，必須先驗證下載體積、license、模型資料流、Docker volume、備份與刪除風險。
- Semark 產出的 Markdown 仍須經來源引用、內容正確性、敏感資料與版面需求的獨立檢查。

## 來源

- Repository／README：<https://github.com/KingsleyOWO/Semark>
- README blob：`89e60c04acbda2d2b4c705d5bc60a328951afa65`

