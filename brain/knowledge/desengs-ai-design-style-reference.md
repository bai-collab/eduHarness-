---
name: desengs-ai-design-style-reference
description: DesEngs 策展的設計工程資源，作為 AI 生成網站／介面時的風格與規範參照來源
type: knowledge-reference
status: recorded-reference
source: https://desengs.com
source_snapshot: 2026-08-13
source_collection: linebot-notes
primary_source: github
primary_source_repo: https://example.invalid/source-omitted-for-share-build/notes
source_fingerprint: sha256:f51cfb5615e1ab1f44540ecd2c82c03eddf4e829105c41037d78ffe830a905cd
mirror_head: cc988e6f9855672e10e1d00e4a765df2fc8b4d15
detail_index: references/ai-design-style-reference.md
verified_at: 2026-08-13
---
# DesEngs：AI 設計風格參照來源

## 定位

DesEngs（<https://desengs.com>）是由 design engineer 親自策劃的資源站，收錄元件、動畫、設計系統與觀念文章，來源筆記明確指出「拿去給 AI Agent 蒸餾」是預期用途。本節點是把該站作為 **F 槽 AI 生成網站／介面時風格與規範來源**的策展索引；完整 80 筆分類清單見 `references/ai-design-style-reference.md`，本檔只保存決策精華。

## 可用精華（餵給 AI 的優先順序）

- **最高價值＝文字化規則**：設計原則與介面規範可直接塞進 prompt 當守則——Laws of UX、Web Interface Guidelines（Rauno）、Design Principles、Design System Checklist、userinterface.wiki、Interface Craft。
- **次之＝可載入的 agent skill**：Taste Skill、Impeccable、UI Skills、jakubkrehel/skills、emilkowalski/skills；rams 提供自動化設計審查（無障礙／視覺 bug）。
- **視覺基調參照**：元件庫（Magic UI、Fancy Components、Sonner、cmdk、NumberFlow…）與動畫資源（animations.dev、Transitions.dev、Easing Graphs）作為樣式與互動樣本，非規則。
- **實作建議**：原則規範類 + 1～2 個 skill 當守則 → 指定一個元件庫定視覺基調，效果最佳。

## F 槽採用邊界

- 本紀錄不代表安裝任何工具、外掛或 skill；只是把外部資源登記為可查參照。
- 站上多為外部連結，內容與可用性會隨時間變動；引用前須複驗連結有效。
- 生成產物仍受既有治理約束：可近用性、隱私、著作權與品味複審不因採用本清單而豁免。
- 不得整批複製外部元件原始碼視為自有；沿用授權須逐一確認各專案 license。

## 來源

- 策劃站：<https://desengs.com>（快照 2026-08-13）
- 主要來源：外部設計參考站與公開文章；使用前須重新確認內容。
- 完整分類清單：`references/ai-design-style-reference.md`
