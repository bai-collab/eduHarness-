# 多代理派工系統 verifier：等待時間與 readiness 新鮮度混淆回顧

## 結論

本次返工的根因是把兩個不同時鐘當成同一個：

- readiness freshness（5 分鐘）像「入場券有效期」，只決定能不能開始派工；
- verdict wait（10 分鐘）像「入場後等候結果」，開始後要等同一個 session，不能因入場券後來過期就把人趕走。

## 發生了什麼

舊修訂計畫錯把使用者要求解讀成把 freshness TTL 從 5 分鐘延長到 10 分鐘。實際需求是 fallback verifier 的回覆等待時間要 10 分鐘。selector 原本也把 readiness snapshot 的 expiry 放進 attempt `deadline_at`，terminalizer 則會在 fallback 尚在 running 時過早判 unavailable。

## 修正

- freshness 保留 `300000 ms`。
- policy 新增 fallback verdict wait `600000 ms`。
- selector 將 `readiness_expires_at` 與 runtime `deadline_at` 分開。
- fallback invocation 明列 same-session、no-redispatch 與 10 分鐘 timeout。
- terminalizer 在 599999 ms 保持 pending，600000 ms 才 unavailable。
- workflow-gate 補傳 `started_at`、`wait_timeout_ms`、`wait_same_session`。
- 全域 `AGENTS.md` 與 `codex-lanes` 用白話寫成硬規則。

## 工具失敗與恢復

Skill 投影第一次 apply 因 sandbox 下 Windows directory rename `EPERM`，留下 `RECOVERY_REQUIRED`。使用交易器內建 `--recover` 依 journal hash 完整 rollback，再於 sandbox 外重跑同一交易並 `COMMITTED`。最後 canonical、Claude projection、Codex projection 三份 hash 完全一致，dedup 為 READY。

## 不再重複

未來任何 verifier timeout 修訂，計畫與測試都要先寫出兩條獨立時間線：dispatch 前的 readiness TTL，以及 dispatch 後同一 session 的 verdict wait。若 selector、workflow-gate、terminalizer 任一層沒有攜帶相同等待契約，不得宣稱 lane 已完成。
