---
type: decomposition-retro
plan: <plan-slug 或 spec 檔名>
date: <YYYY-MM-DD>
reviewer: <填寫者>
task_type: <feature|refactor|spec|infra|investigation|docs|...>
unexpected_rework: <true|false>
boundary_error: <none|missing|overlap|dependency|mixed>
granularity: <appropriate|too-coarse|too-fine>
confidence: <low|medium|high>
cause_code: <none|context|capability|domain-ownership|authority|proof|feedback-delivery|worker-limitation>
event_id: <唯一事件 id，用於去重>
handoff_count: <整數，跨平台/跨 agent 交接次數>
over_decomposition: <true|false，是否切得過碎>
counterexample_searched: <true|false，是否搜過反例>
---

# 拆解回顧：<計畫名稱>

## 對象
<這份回顧在評的是哪個計畫/spec,一句話範圍>

## 非預期返工
<有/無;若有,是什麼、為何。等核准/額度/依賴的阻擋不算返工>

## 邊界
<漏了哪些子任務?有無重疊?依賴排序對不對?切太粗還是太碎?>

## 主因（一句話）
<拆解好壞的主要成因>

## 替代解釋（必填，至少一個）
<對上面的判定,提一個「其實不是拆解問題」的可能>

## 成功面（必填）
<哪些部分拆得好、為什麼>

## 暫定啟發（可留空）
<若有一句可複用的拆解教訓;僅候選,不進 planning skill>
