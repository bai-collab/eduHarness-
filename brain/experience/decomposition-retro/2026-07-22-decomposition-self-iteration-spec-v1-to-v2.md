---
type: decomposition-retro
plan: 26-07-22-decomposition-self-iteration-spec
date: 2026-07-22
reviewer: Claude Fable (main session), dogfood 首例
task_type: spec
unexpected_rework: true
boundary_error: mixed
granularity: too-coarse
confidence: high
cause_code: proof
event_id: 2026-07-22-spec-decomp-v1v2
handoff_count: 1
over_decomposition: false
counterexample_searched: true
---

# 拆解回顧：拆解自我迭代 spec（v1 → v2）

## 對象
本回顧評的是「拆解品質自我迭代層」spec 從 v1 到 v2 的規劃過程。v1 經 Codex Sol high
對抗式審查後被大幅重寫,是本 session 最明確的一次規劃品質教訓,故取為 Phase A 首個真實樣本。

## 非預期返工
有。v1 交出後即被 Sol 審查推翻 19/21 條,主控重寫成 v2。這是**非預期**的整份重寫,
非「原訂下一階段」——屬真返工。

## 邊界
- **too-coarse(太粗)**：v1 把「儀器化量測」與「自動迴路」綁成一次到位,應先拆成
  Phase A 量測 → B pilot → C 迴路(v2 已改)。
- **missing(漏)**:v1 漏了「成功面/反事實」這個必要子任務,只設計失敗訊號 → 會導致無限細拆。
- **dependency(依賴錯)**:v1 把「有真實資料」當前置已滿足,實際 `harness/state` 是空的;
  依賴排序把「建迴路」擺在「有標註集」之前。

## 主因（一句話）
規劃時把「檔案通道存在」誤當「已有可分析原料」,在無真相標註集的情況下就設計自動蒸餾,
過度信任 proxy 訊號等於真相。

## 替代解釋（必填）
也許不是「拆解」問題,而是 **spec 格式本身鼓勵過度承諾**——spec-driven 樣板要求「完整設計」,
誘導把未來所有階段一次寫滿。若如此,修正點在樣板(加「先量測後建」預設),不在個別規劃者。
(此解釋本身待 Phase B 更多樣本檢驗,不現在下結論。)

## 成功面（必填）
- 理論邊界誠實:v1 一開始就講清楚 blog 是執行 harness 理論、不是自我迭代迴路,沒有假裝
  現有 harness 是 RLM。Sol 也判此為 SOUND。
- 主動送 Sol 對抗式審查、並逐條驗證 Sol 的事實宣稱(而非照單全收),讓返工發生在**規劃階段**
  而非實作後——這是好的驗證前置。

## 暫定啟發（候選，不進 planning skill）
「規劃自我改良系統時,先問『我現在有沒有可分析的真實資料』;沒有就先只做量測與人工標註,
不建自動迴路。」——僅候選,需 Phase B 累積 ≥3 獨立事件跨 ≥2 情境才可能晉升。
