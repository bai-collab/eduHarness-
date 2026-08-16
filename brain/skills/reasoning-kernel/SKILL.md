---
name: reasoning-kernel
description: Reusable evidence-based reasoning support for local Harness tasks. Activates conditionally when a task requires competing hypotheses, uncertainty reduction, diagnosis, decision comparison, counterexample testing, or iterative verification; exposes an auditable decision record rather than private chain-of-thought.
---
# Reasoning Kernel｜證據式推理核心

## 定位

`reasoning-kernel` 是本機 Harness 的共用推理支援層，不取代領域 Skill，也不負責選擇主要任務流程。

Primary Skill 決定「要完成什麼工作」；本 Kernel 在需要時協助回答：

1. 已確認看到什麼？
2. 哪些解釋／方案仍可能成立？
3. 哪個下一步最能降低關鍵不確定性？
4. 新證據支持、削弱或否定了什麼？
5. 目前是否足以形成結論，還是應停止並保留未知？

本 Skill 只輸出可稽核的外部推理紀錄（evidence / hypothesis / test / result / conclusion），不得要求、保存或輸出模型私有 chain-of-thought。

## 何時啟動

至少符合一項：

- 有兩個以上合理假設、方案或解釋，需要區分。
- 來源互相衝突、證據強度不同，不能直接裁決。
- 任務涉及診斷、除錯、研究、策略或因果判斷。
- 需要設計反例、測試、實驗或查證步驟才能提高信心。
- 結論會影響後續高成本工作，值得先驗證關鍵假設。
- Primary Skill 明確依賴本 Kernel。

## 何時略過

以下情況預設不啟動：

- 單純抄錄、翻譯、格式轉換、明確規則下的機械操作。
- 可由單一可靠來源直接回答的簡單事實查詢。
- 使用者已提供完整程序，且不需要額外判斷或驗證。
- 啟動推理迴圈的成本高於可能降低的不確定性。

## Working State Contract

本 Kernel 的 working state 是單次任務的暫態狀態，不等同 Brain 長期記憶，不得自動寫入 Knowledge、Experience 或 Error Log。

```yaml
working_state:
  problem: null
  goal: null
  constraints: []
  observations: []
  evidence:
    confirmed: []
    partial: []
    conflicts: []
    unknown: []
  hypotheses:
    active: []
    rejected: []
    supported: []
  predictions: []
  candidate_checks: []
  selected_check: null
  check_result: null
  confirmed_patterns: []
  remaining_uncertainties: []
  budget:
    step_limit: null
    steps_used: 0
  status: reasoning | ready | blocked | exhausted
```

Evidence status：

- `✅` 已確認
- `⚠️` 合理推測／部分支持
- `⏳` 待確認或工具不可用
- `❓` 來源未提及
- `❌` 已否定
- `❗` 來源衝突

## Reasoning Loop

### 1. Observe & Encode

把使用者輸入、來源、工具結果與既有工作狀態拆開記錄。不把推論寫成觀察，不把搜尋到檔案等同已讀內容，也不把來源提及等同外部事實已證實。

產出：`observations`、`evidence`、`remaining_uncertainties`。

### 2. Hypothesize

只有在存在實質不確定性時建立候選假設。通常維持 2–4 個彼此可區分的候選；每個假設必須指出可觀察的預測或被否定的條件，不為了湊數建立虛假替代方案。

產出：`hypotheses.active`、`predictions`。

### 3. Select Discriminative Check

從可用來源、工具或安全操作中，選擇最能區分候選假設的下一步，依序考量 information gain、evidence quality、cost、risk 與 redundancy。

產出：`candidate_checks`、`selected_check`。

### 4. Execute / Inspect

由 Primary Skill 或平台可用 Tool 實際執行查證、讀取、計算、測試或其他允許操作。Kernel 不得虛構 Tool 成功、來源內容或 runtime capability。

產出：`check_result`。

### 5. Reflect & Revise

比較預測與實際結果：支持就增加支持但不過度升級；反駁就移入 `hypotheses.rejected`；意外結果新增未知或新候選；來源衝突保留 `❗`，無法裁決時不強行合併。

### 6. Consolidate

整理 `confirmed_patterns`、supported hypotheses、rejected hypotheses 與 `remaining_uncertainties`。這是領域 Skill 與 Kernel 之間的穩定介面。

### 7. Validate Before Conclusion

形成結論前檢查反例、證據強度、未知資訊是否被自行補完、是否仍有同樣能解釋證據的候選，以及是否需要 User Authority 或更高品質來源。未通過就回到候選建立或查證；無可行查證路徑則標記 `blocked`。

## Stopping Rule

任一條件成立即可停止：

- `ready`：關鍵結論已被足夠證據支持，且無未處理的致命反例。
- `blocked`：缺少必要來源、工具、權限或使用者裁決，無法安全繼續。
- `exhausted`：已達合理 step、時間或資源預算，新增操作的資訊增益過低。
- Primary Skill 的完成條件已滿足。

不得因「想更確定」無限循環。

## Output Contract

預設不輸出逐步私有思考，只在對任務有價值時提供精簡 `reasoning_record`：

```yaml
reasoning_record:
  conclusion: null
  evidence_used: []
  alternatives_considered: []
  checks_performed: []
  rejected_or_weakened: []
  remaining_uncertainties: []
  confidence: high | medium | low
  next_action: null
```

一般輸出優先轉成：結論、依據、重要替代解釋、未知與限制、下一步。

## Integration Contract

- Registry / Project Orchestrator 負責 Primary Skill routing。
- 本 Kernel 是 Supporting Skill；不得因啟動 Kernel 而覆蓋 Primary Skill 的 domain rules、output contract、User Authority 或 stopping rule。
- 若規則衝突：Project 全域規則 > Registry routing > Primary Skill domain contract > Reasoning Kernel 一般程序。
- Kernel 結果只能作為可驗證的工作狀態／決策紀錄，不自動進入 Brain 長期記憶。
- 本機 Runtime 不保證 shell、Git、Node 以外的工具存在；實際能力以 platform preflight 與當次 adapter 結果為準。

## Failure Policy

- 缺來源：`⏳ SOURCE_UNAVAILABLE`
- 缺 runtime 能力：`⏳ RUNTIME_INCOMPATIBLE`
- 來源衝突無法裁決：`❗ SOURCE_CONFLICT`
- 關鍵假設被否定：標 `❌` 並回到候選建立，不得沿用舊結論。
- 無法取得區分性證據：保留多個候選，不強迫單一答案。

## Provenance

- kind: `local-adaptation`
- basis: eduHarness evidence-based reasoning kernel
- adaptation: 移除 Cloud installation 假設，改由本機 Registry、Route Plan、platform preflight 與 User Authority 管理。
- version: `0.1.0`
