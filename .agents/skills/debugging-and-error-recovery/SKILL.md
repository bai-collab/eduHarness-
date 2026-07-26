---
name: debugging-and-error-recovery
description: Use when Codex faces failing tests, runtime errors, broken behavior, repeated failed fixes, tool failures, or unclear root cause. Produces reproduction, localization, reduced cause, fix plan, validation, and guardrail. Do not use when the fix is already clear and covered by TDD.
---

# 除錯與錯誤恢復

## Shared Routing Contract

- Trigger: failing tests, runtime errors, broken behavior, tool failure, or three ineffective fix attempts.
- Do not use when: the expected behavior and implementation path are already clear; route to TDD.
- Inputs: exact error, logs, reproduction steps, recent changes, environment, and prior failed attempts.
- Outputs: reproduction, localized cause, fix plan, validation result, and Do Not Repeat note when durable.
- Runtime boundary: isolate before changing; avoid speculative broad edits.
- Validation: rerun the failing command or a reduced equivalent after each fix.
- Do Not Repeat: do not retry the same command/fix loop without a changed hypothesis.

## 核心目標

用系統性方法定位問題根因，而非靠猜測和隨機修改。每次除錯都必須產出「防禦性程式碼」，確保同類問題不再發生。

## 何時使用

- 測試失敗。
- 建置中斷。
- 執行時行為與預期不符。
- 使用者回報 Bug。
- MCP 工具或外部服務回傳非預期結果。

## 流程：五步調研法 (Five-Step Triage)

### Step 1：重現 (Reproduce)
**不能重現的 Bug 不算 Bug。**
1. 記錄觸發條件（輸入、環境、步驟）。
2. 建立最小重現案例 (Minimal Reproduction)。
3. 確認問題在隔離環境中仍然發生。

### Step 2：定位 (Localize)
**縮小範圍，而非擴大搜索。**
1. 使用二分法：註解掉一半程式碼，看問題是否消失。
2. 檢查最近的變更（`git log -5`, `git diff`）。
3. 閱讀錯誤訊息的**完整** Stack Trace，不只是第一行。

### Step 3：精簡 (Reduce)
**找到最小的失敗案例。**
1. 移除所有無關的程式碼和設定。
2. 用硬編碼的值取代動態輸入。
3. 確認問題仍然存在。

### Step 4：修復 (Fix)
**只修改你確定的根因。**
1. 先寫測試來驗證修復（TDD 技能連動）。
2. 修改程式碼，讓測試通過。
3. 確認修復沒有破壞其他功能（回歸測試）。

### Step 5：防禦 (Guard)
**確保同類問題不再發生。**
1. 將重現案例轉化為永久的回歸測試。
2. 如果是邊界條件，加入輸入驗證。
3. 記錄問題的根因與解決方案到 `brain/errorLog/`。

## 停損線規則 (Stop-the-Line)

當以下情況發生時，**立即停止所有其他工作**：
- 主分支建置失敗。
- 資料遺失或損壞。
- 安全漏洞被發現。
- 測試通過但行為明顯錯誤（靜默失敗）。

## 行為防護 (Anti-Rationalization)

| 藉口 | 共同治理反駁邏輯 |
|---|---|
| 「我大概知道問題在哪，直接改看看。」 | **拒絕**。「大概知道」= 猜測。先走完 Step 1-3，確認根因後再動手。 |
| 「這個 Bug 太難重現，先跳過。」 | **拒絕**。不能重現 = 你不理解觸發條件。花時間找到重現路徑。 |
| 「改了就好了，不需要寫測試。」 | **拒絕**。沒有測試的修復 = 未來的回歸 Bug。Step 5 是強制的。 |
| 「可能是環境問題，重啟看看。」 | **拒絕**。重啟不是修復。如果重啟解決了問題，你需要找出「為什麼重啟前會壞」。 |
| 「錯誤訊息看不懂，直接搜 Stack Overflow。」 | **拒絕**。先讀完整 Stack Trace，理解每一行的含義。盲目搜尋只會複製別人的 Bug。 |

## 紅旗警訊 (Red Flags)

- 🚩 連續嘗試超過 3 次不同的「修復」但問題依舊（你在猜，不是在除錯）。
- 🚩 修改了與錯誤訊息無關的檔案。
- 🚩 修復後沒有新增任何測試。
- 🚩 錯誤日誌被忽略或刪除而非分析。
- 🚩 「暫時先這樣」出現在 Commit Message 中。

## 驗證門檻 (Verification)

- [ ] 問題的根因已被明確記錄（不是「改了就好了」）。
- [ ] 有至少一個新的測試案例覆蓋該 Bug 的觸發條件。
- [ ] 回歸測試全數通過。
- [ ] 錯誤日誌已寫入 `brain/errorLog/`（若為重大問題）。
