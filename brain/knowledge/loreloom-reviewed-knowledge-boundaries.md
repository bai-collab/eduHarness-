---
name: loreloom-reviewed-knowledge-boundaries
description: Loreloom 將來源、人工確認知識與可再生成 Wiki 分層的治理模式
type: knowledge-reference
status: recorded-not-installed
source: https://github.com/yi-john-huang/loreloom
source_revision: e5359736fd385a7c90f74a27ca7924ed4bcd6be2
source_collection: linebot-notes
primary_source: github
primary_source_repo: https://example.invalid/source-omitted-for-share-build/notes
legacy_source_sheet_row: 448
source_fingerprint: sha256:ac9cd141581d22643033a3d646c9c4b9893e6935628a73e071e7ae16ebdb8a36
verified_at: 2026-07-24
---
# Loreloom：人工確認的知識分層

## 已查核設計

- Loreloom 以 Markdown 作為耐久格式，分開保存來源、人工確認的 `Knowledge/` 與可再生成的 `Wiki/`。
- AI 可以建立草稿，但由人決定何時把知識狀態提升為長期可信內容。
- 專案以 frontmatter schema、來源證據、hash、validator、Git review 與 agent policy 管理知識生命週期。
- 官方 README 建議使用者先從 template 建立私人 repository，再放入個人、機密或受著作權保護的材料。

## F 槽採用邊界

- 本紀錄只保存可移植的治理觀念，不安裝 Loreloom，也不改用 Obsidian vault 取代 Brain。
- 可採納的原則是「證據先於綜合」「人工決定永久知識」「可生成層可以重建」。
- 若未來評估工具導入，須另做 schema、路徑、隱私與 Windows 相容性檢查。

## 來源

- Repository／README：<https://github.com/yi-john-huang/loreloom>
- README blob：`e5359736fd385a7c90f74a27ca7924ed4bcd6be2`

