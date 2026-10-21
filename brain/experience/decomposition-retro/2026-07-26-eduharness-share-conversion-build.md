---
type: decomposition-retro
plan: 26-07-26-eduharness-share-conversion-skill-plan
date: 2026-07-26
reviewer: claude-fable-5-main-session
task_type: feature
unexpected_rework: true
boundary_error: missing
granularity: appropriate
confidence: high
cause_code: context
event_id: 2026-07-26-eduharness-build-v2026-07-0
handoff_count: 1
over_decomposition: false
counterexample_searched: true
---

# 拆解回顧：eduHarness 分享版轉換建置與首發

## 對象

從計畫書到 v2026.07.0 發佈的整條建置：item-authoring 去地區化、腳本參數化、manifest／範本／轉換腳本、skill 登記投影、試轉、雙閘核准、push、verifier 驗證。

## 非預期返工

三處。(1) 轉換腳本假設 canonical_path 是 `brain/skills/<id>`，但工程類 skills 在 `engineering/` 子目錄——registry 明明就有 canonical_path 欄位，一開始就該用它。(2) `.ps1` 不在文字副檔名清單，改寫與掃描同時漏檔；靠 apply 前的人工抽查（grep 內部代號殘留）抓到。(3) push 403：本機 git 憑證是個人帳號，repo 在組織名下；權限在計畫階段標了「未知」但沒有列為可先驗證項。

## 邊界

計畫的七步流程與兩道閘設計完全成立，實際執行零調整。漏的子任務是「發佈通道 preflight」：git 憑證帳號 vs repo 擁有者的比對其實可以在閘 2 前用 `git config credential` 或一次 dry-run 探測，而不是等 push 才 403。掃描規則的邊界（豁免機制）是執行中才補的，屬合理的漸進設計而非漏拆。

## 主因（一句話）

對「既有資料已提供的事實」（registry 的 canonical_path、憑證的實際帳號）用假設代替查證，兩個 bug 與一次 403 都是同一種錯。

## 替代解釋（必填，至少一個）

也可能不是拆解問題而是成本合理的試錯：三個返工各花不到 5 分鐘修復，全部被流程內建的檢查（腳本報錯、殘留抽查、push 錯誤回報停止規則）攔住，沒有一個漏到發佈後。若如此，「先跑再修」在這種有多層防護網的管線裡本來就比每步前置查證便宜。

## 成功面（必填）

白名單制＋掃描在真實資料上立刻抓到 3 個計畫沒預見的地區名／跨引用殘留（lesson-plan-authoring、lesson-differentiation），證明「不信任人工檢查、機器掃描守門」的設計正確；兩道核准閘與 stop-rule（push 失敗不重試、如實回報）都照 skill 寫的執行；fresh verifier 用獨立 diff -r 而非信任 hash，五項全 CONFIRMED。

## 暫定啟發（可留空）

管線類腳本讀取任何 registry／config 時，凡欄位已存在（路徑、帳號、副檔名清單）就直接消費欄位，不要用「慣例假設」重建它；對外發佈類計畫把「通道身分 preflight」（憑證帳號＝目標擁有者？）列為標準前置檢查。
