---
name: memory-must-promote-visual-cdp
description: 使用者要求視覺化與 CDP 不得靠提醒，必須成為介面任務的預設硬門檻
type: feedback
triggers: [視覺化, 視覺審查, CDP, 記憶功能, 瀏覽器驗收, UI]
updated: 2026-09-16
---

# 視覺化與 CDP 必須由 agent 主動執行

## 使用者更正

使用者不應反覆提醒是否做視覺審查或是否使用 CDP。只做文字、DOM、AX 或 Playwright 檢查，就宣稱介面已驗收，是不完整且誤導的回報。

## 根因

相關規則雖已存在於 AGENTS、Brain 與專案計畫，但 agent 沒有在每次介面修改開始時主動 CONSULT，也沒有把「視覺／互動 + CDP」列為不可跳過的完成條件。

## How to apply

1. 任何 Web 介面任務開頭，先 `grep` `brain/error-log` 與 `brain/knowledge` 的「視覺審查／CDP／瀏覽器驗收」並讀完命中紀錄。
2. Route Plan 或計畫節點先列出視覺驗收與 CDP 驗收；未完成不得標記完成。
3. 最終回報分開寫明：自動測試、瀏覽器實際操作、CDP 網路／主控台／DOM 結果；沒有做的項目必須寫「未驗證」。
4. AX／Playwright 是操作手段，不等於 CDP；CDP 未做時不能使用「完整瀏覽器驗收」字樣。
