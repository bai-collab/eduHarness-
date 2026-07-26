---
name: test-driven-development
description: Use when Claude or Codex must implement logic changes or bug fixes with tests first, reproduce a failure, add or adjust coverage, make the smallest code change, and verify RED-GREEN-REFACTOR. Do not use for pure planning, UI-only copy changes, or failures that first need root-cause triage; use debugging-and-error-recovery for unclear failures.
---

# 測試驅動開發（TDD）

## Shared Routing Contract

- Trigger: logic change, bug fix, regression, or feature behavior that can be captured by tests.
- Do not use when: root cause is unclear after repeated attempts; route to debugging-and-error-recovery.
- Inputs: expected behavior, failure evidence or spec, relevant local commands, and test surface.
- Outputs: failing or adjusted test, minimal implementation, passing validation, and residual risk.
- Runtime boundary: avoid broad refactors unless tests prove the contract requires them.
- Validation: record RED, GREEN, and REFACTOR evidence or explain why a test-first step was impossible.
- Do Not Repeat: do not patch production logic repeatedly without a reproducer.

## Overview

在撰寫實作程式碼之前，先撰寫一個會失敗的測試。對於 Bug 修復，在嘗試修復之前，先用測試重現該 Bug。測試即是證明 —— 「看起來是對的」並不代表完成。

## When to Use

- 實作任何新的邏輯或行為
- 修復任何 Bug (Prove-It Pattern)
- 修改現有功能
- 處理邊際情況 (Edge cases)

**何時不適用:** 單純的配置更改、文檔更新、或無行為影響的靜態內容更改。

## Process: The TDD Cycle

遵循 **RED -> GREEN -> REFACTOR** 循環：

1.  **RED**: 撰寫一個會失敗的測試。測試必須失敗，否則無法證明它檢驗了新行為。
2.  **GREEN**: 撰寫「最小量」的程式碼使測試通過。不要過度工程。
3.  **REFACTOR**: 在測試通過的前提下，清理程式碼（命名、去重、優化），每次重構後確保測試依然通過。

## Anti-Rationalization (行為防護)

| 藉口 | 反駁 |
| :--- | :--- |
| 「我寫完程式碼後再補測試。」 | 你不會補。且事後補的測試往往是在測試「實作」而非「行為」。 |
| 「這太簡單了，不需要測試。」 | 簡單的程式碼會變複雜。測試是行為的規格書。 |
| 「測試會拖慢我的速度。」 | 測試現在會慢一點，但以後每次修改程式碼時都會讓你變快。 |
| 「我手動測試過了。」 | 手動測試無法持久。明天的修改可能會壞掉而你無從得知。 |

## Red Flags

- 撰寫程式碼卻沒有對應的測試。
- 測試在第一次執行時就通過了（可能沒測到正確的東西）。
- 回報「測試通過」但實際上並沒有執行測試指令。
- 修復 Bug 但沒有重現該 Bug 的測試。

## Verification (驗證清單)

- [ ] 每個新行為都有對應的測試案例。
- [ ] 所有測試皆通過 (執行 `npm test` 或對應指令)。
- [ ] Bug 修復包含一個在修復前會失敗的重現測試。
- [ ] 測試名稱清楚描述了被驗證的行為。
- [ ] 沒有跳過 (Skip) 任何測試。
