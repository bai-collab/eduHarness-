# 行為與挑戰驗收契約

本文件是 `learner-behavior-game-review` 的欄位與證據契約。它把「學生行為研究」限制在可觀察、可回放、低風險的學習介面證據，不把設計者的猜測當成學生特質。

## 1. Review artifact

審查結果使用下列結構。這是資料形狀，不代表任何欄位已經通過：

```yaml
review_status: intake-only | behavior-hypothesis-ready | challenge-ladder-ready | dom-pass | dom-blocked | chrome-pass | dom-only | chrome-blocked | teacher-review-required
scope:
  learner_group: ""
  learning_goal: ""
  game_context: ""
  local_url: ""
evidence_ledger:
  - id: E-001
    type: dom_measurement | interaction_trace | screenshot_visual | teacher_report | student_report | research_reference | inference
    observation: ""
    source: "repository-relative path or local evidence label"
    confidence: observed | reported | inferred | unknown
behavior_hypotheses:
  - id: H-001
    observation_ids: [E-001]
    alternatives: ["", ""]
    prediction: ""
    smallest_test: ""
    result: pending | supported | refuted | inconclusive
    decision: keep | revise | rollback | teacher-review
challenge_ladder:
  - level: D0
    entry_criteria: ""
    target_behavior: ""
    one_changed_load: ""
    support: ""
    success_criteria: ""
    rollback_rule: ""
answer_leak_audit:
  - id: L-001
    surface: visible-text | aria | title | tooltip | alt | hidden-text | selection-style | hint | debug
    check: ""
    result: pass | revise | block | unknown
state_recovery_matrix:
  - state: ""
    learning_goal: ""
    primary_action: ""
    visible_cue: ""
    blocked_control_reason: ""
    recovery_action: ""
    success_transition: ""
dom_gate:
  status: not-run | pass | blocked
  checks: []
  evidence: []
chrome_gate:
  status: not-run | pass | blocked | not-available
  prerequisite: dom-pass
  viewport: ""
  actions: []
  evidence: []
decision: ""
uncertainty: [""]
```

`source` 只能填 repository-relative path、本機測試產物或不含秘密的證據標籤；不要放磁碟帳號、cookie、token 或個人識別資料。

## 2. 行為假設最小單位

一個假設要能被一次小改動區分。推薦用下表檢查：

| 欄位 | 例子 | 審查要求 |
| --- | --- | --- |
| Observation | 學生連續點擊 disabled 的出口三次 | 可由 trace 或 DOM 狀態重現 |
| Alternative A | 出口的下一步說明不在目前 viewport | 要能檢查提示位置或 scroll |
| Alternative B | 鍵卡雖已取得，但 state 沒有切到 `exit_ready` | 要能檢查 transition 與 disabled reason |
| Prediction | 改善其中一項後，重複點擊下降且能找到恢復入口 | 指標是操作，不是人格評語 |
| Smallest test | 只在出口旁補「下一步」區塊 | 不同時換顏色、文字和流程 |

不要把「停留時間較久」單獨當成困難證據。它也可能代表學生在讀題、與同學討論、裝置變慢或等待教師；要配合操作序列與回報。

## 3. 挑戰負荷欄位

每一階只記一個主負荷；其餘維持基線：

```yaml
load_dimension: distractors | clue_distance | language_support | dependency_count | working_memory | time_pressure
baseline: ""
change: ""
reason: ""
```

對國小教育遊戲，`time_pressure` 預設是 `none`。可以顯示「本次花費 04:18」作為回顧，但不以倒數逼迫學生。若升階後同時增加干擾項、縮短提示、打亂句塊並加入倒數，該階不合格，必須拆成多階或回退。

## 4. 答案洩漏閘門

### 必須 block 的情況

- 玩家選卡後目標位置立即發光、跳動、加框、顯示文字或自動捲動。
- 玩家畫面、ARIA、tooltip、`title`、`alt` 或 hidden text 直接列出配對答案。
- NPC 在學生還沒嘗試前直接說出「把 X 放到 Y」或正確句子順序。
- 成功條件在資料狀態已滿足，但玩家沒有可找到的下一步、命中區或恢復說明。

### 可以保留但要分層的情況

- 顯示目前完成數與未完成數，但不顯示未完成答案。
- 問「你覺得哪個物件能打開出口？」而不是告訴學生哪張卡。
- 學生主動要求提示後，提供觀察方向、分類或句型框架；每升一層都要記錄提示層級。
- 教師檢查模式可顯示答案 mapping，但必須和玩家 DOM、ARIA 與操作路徑分開。

## 5. DOM gate checks

`DOM_PASS` 的每一列都要能指出實際 selector、狀態值、矩形數值或測試產物：

| check_id | 檢查 | pass 條件 |
| --- | --- | --- |
| DOM-01 | 必要節點與唯一 id | 所有核心節點存在，沒有重複 id |
| DOM-02 | accessible name／角色 | 可互動元素可被辨識與操作 |
| DOM-03 | state transition | 核心流程的成功、錯誤、重試、恢復可重現 |
| DOM-04 | answer leak | 玩家可讀 DOM 沒有直接 mapping 或目標提示 |
| DOM-05 | selection isolation | 選卡只改卡牌狀態，目標物件不被凸顯 |
| DOM-06 | disabled recovery | disabled 有原因，且存在下一步／恢復入口 |
| DOM-07 | geometry baseline | 無水平溢位、明顯矩形重疊與命中區遮擋 |
| DOM-08 | runtime baseline | 沒有會阻斷任務的 fatal runtime error |

任何 `block`、`unknown` 或缺乏證據的核心列，都不能宣告 `dom-pass`。DOM 通過後才可開始 Chrome；DOM 未通過時，Chrome gate 應記為 `blocked-by-dom`。

## 6. Chrome gate checks

Chrome 只驗證 DOM gate 已證明存在的功能，並補上人眼與實際輸入才看得出的問題：

| check_id | 檢查 | 證據 |
| --- | --- | --- |
| CHR-01 | 新 agent tab 載入本機 URL | URL、viewport、載入結果 |
| CHR-02 | 實際點擊／拖放／鍵盤流程 | 操作序列與每個狀態結果 |
| CHR-03 | 選卡不洩漏答案 | 操作前後截圖或視覺紀錄 |
| CHR-04 | 句塊可讀、可打亂、可退回 | 實際組句與錯誤恢復紀錄 |
| CHR-05 | 解鎖到出口完整可操作 | key／lock／exit 的實際命中證據 |
| CHR-06 | 桌面與窄 viewport | 截圖、裁切／重疊／溢位結果 |
| CHR-07 | console／錯誤覆蓋層 | logs、錯誤清單與結果 |

Chrome 不可用時只記 `not-available` 或 `blocked`；不能以 DOM 截圖或靜態程式碼取代 `chrome-pass`。
