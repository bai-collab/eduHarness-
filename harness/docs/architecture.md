# Local Pluggable Harness Architecture

## Layers

1. **Kernel**：只保存 portable policy、使用者權限與任務生命週期原則。
2. **Environment**：保存本機可覆寫設定；portable 設定以 repository-relative path 為主。
3. **Skill packages**：以 `brain/skills/<skill-id>` 保存可攜式 `SKILL.md` 與必要子資源。
4. **Registry**：保存 block、Skill、capability、依賴、來源、雜湊與 route 的 logical metadata。
5. **Reasoning blocks**：依任務複雜度選擇分類、上下文、推理 scaffold、驗證與重規劃。
6. **Route Plan**：只在執行前建立節點拓樸、平台、fallback 與 verifier 策略；不由 Skill 選擇改寫。
7. **Skill resolution**：平行解析 Primary／Supporting Skill、條件依賴與 package 完整性；結果放在獨立的 `skill_resolution` artifact。
8. **Platform preflight**：對 Route Plan 中實際被指定的平台做無副作用 readiness probe。
9. **Runtime adapters**：只使用本機已存在的工具；缺少 optional adapter 時 fallback 到主 Agent 或標記 deferred。
10. **State**：保存 plan、user decision、route、Skill resolution、preflight、dispatch、verification 與 replan 紀錄。

## Adaptive loop

```text
classify → context? → reason? → route-plan → platform-preflight → user-authority → dispatch → execute/prepare → reconcile? → verify → replan?
```

`?` 代表 optional block。Task 可以指定 profile、Route Plan 節點、平台、fallback、block sequence 或跳過 optional block；核心治理區塊仍會保留可替換實作，但不能被無聲移除。

## Route Plan contract

每一個 route node 都應能回答：

- 要完成什麼 objective？
- 依賴哪些前置節點？
- 原本指定哪個 platform／agent／role？
- 平台不可用時由誰接手？
- 需要 node、final、escalate 還是 none verifier？
- 實際使用的平台與結果證據是什麼？

`platform-registry.json` 保存邏輯平台與 adapter metadata；`route-profiles.json` 保存不同複雜度的預設驗證策略。兩者都使用 repository-relative path，實際本機 adapter 可由未提交的 `env.local.json` 以相對路徑覆寫。

`skill-registry.json` 採 hybrid contract：eduHarness 的條件載入與 Primary／Supporting 分層，加上 share-harness 的 package 完整性、SHA-256 tree hash 與平台 projection metadata。Skill 不會預載，也不會改寫 Route Plan；它只產生獨立的 `skill_resolution`，供 user-authority 與 dispatch 準備階段使用。

Skill 的 `user-confirmed` 依賴必須先產生繁中問題、建議與「載入／先略過」選項。沒有使用者決定時，流程停在 user-authority；使用者的選擇不會改變 Route Plan 的節點、依賴或 verifier 排程。

## Verifier budget

Verifier 不是每個節點的固定前置步驟：

- Simple：不安排獨立 agent verifier，只做輕量 plan contract check。
- Standard：預設最後統一驗證一次。
- Complex：高風險、跨平台或明確要求的節點才安排 node verifier，並保留 final verification。
- 使用者明確指定的 verifier mode 優先於 profile 預設值。

## Thinking boundary

Harness 不要求或儲存私有 Chain-of-Thought。它只要求可稽核的：

- assumptions
- hypotheses
- alternatives
- evidence
- checks
- conclusion
- uncertainty
- next action

模型輸出是 advisory；使用者決定是 final。
