# 拆解回顧（Decomposition Retrospective）— Phase A

拆解自我迭代 spec 的 **Phase A**：每個完成的計畫/spec 結束後,填一份人工回顧,
累積帶因果標註的**真相標註集**。這是日後任何自動訊號(Phase C)precision 的分母。

> 參考:拆解自我迭代 spec(原工作區計畫文件,未隨本工作區提供)

## Phase A 的邊界（刻意最小）

- **不改** planning skill、**不建** extractor、**不建** gate、**不產生任何規則**。
- 這裡只有資料(人工標註),沒有自動蒸餾。規則晉升是 Phase B/C 的事。
- 檔案 tracked + baselined,比照 `brain/errorLog/` 慣例(頻率低,可接受 baseline churn)。
  Phase C 若引入高頻自動 log,再另做 baseline 排除。

## 何時填

- 任何預計 >30 分鐘、跨模組、或多階段的計畫/spec 完成後。
- 命名:`YYYY-MM-DD-<plan-slug>.md`(比照 errorLog)。

## 三條紀律（防確認偏誤，來自 Sol 審查）

1. **必寫至少一個替代解釋**：對你判定的「拆解問題」,提出一個「其實不是拆解問題」的可能。
   (例:model 升級可能是正確風險控制,不是拆錯。)
2. **必寫成功面**：哪些部分拆得好。只記失敗會把系統推向無限細拆。
3. **是 proxy 不是真相**：訊號只是候選證據,最終因果由人判定,不因文字相符自動歸因。

## 欄位說明

| 欄位 | 意義 |
|---|---|
| `unexpected_rework` | 有沒有**非預期**返工(等核准/額度/依賴的阻擋**不算**返工) |
| `boundary_error` | none / missing(漏子任務)/ overlap(重疊)/ dependency(依賴錯)/ mixed |
| `granularity` | appropriate / too-coarse(太粗)/ too-fine(太碎) |
| `confidence` | 對本回顧判斷的信心 low / medium / high |
| `cause_code` | 主導 gap 分類(7 類 + none),見下 |
| 主因 | 一句話根因 |
| 替代解釋 | 至少一個「其實不是拆解問題」的可能(必填) |
| 成功面 | 拆得好的部分(必填) |
| 暫定啟發 | 若有,一句話;**僅為候選,不進 planning skill** |

### `cause_code` — gap 分類（採自 lopopolo/harness-engineering, CC BY 4.0）

把「拆解不良」的主導成因歸到 7 類之一(無實質 gap 用 `none`):

| code | 意義 |
|---|---|
| `context` | 資訊缺失/過期 |
| `capability` | 需要的操作不存在 |
| `domain-ownership` | 競爭的表述/擁有權不清 |
| `authority` | 權限衝突 |
| `proof` | 內部檢查與實際結果不符(宣稱未經驗證) |
| `feedback-delivery` | 產物無法存活/交付失敗 |
| `worker-limitation` | 執行者不可靠(單次失敗**不足以**判定) |

複製 `TEMPLATE.md` 開新檔。

## Phase B — 晉升門檻與 checker（已建 instrument）

原工作區的 harness 檢查腳本 `check-decomposition-loop.mjs`(未隨本工作區提供)讀本目錄所有回顧,做兩件事:

1. **契約驗證(fail-closed)**：每筆 frontmatter 欄位齊全、enum 合法、`event_id` 唯一、
   且 body 含「替代解釋」與「成功面」兩節;任一不符即非零退出。
2. **晉升門檻計算**：回報 `entries / task_types / promotable`。門檻 = ≥12 筆且 ≥3 種
   task_type(spec §4);未達則 `promotable=false`,任何候選啟發**只能停在 candidate**。

```bash
node <harness 腳本目錄>/check-decomposition-loop.mjs            # 看目前 pilot 狀態
node <harness 腳本目錄>/check-decomposition-loop.mjs --self-test # 契約自測
```

它**只量測,不晉升、不寫檔**。零筆時回報 `count=0 promotable=false`(instrument-first,不造假資料)。
validate-harness 以 `DECOMP_PILOT_GATE_OK state=advisory-only` 接入:**不阻擋主流程**。
