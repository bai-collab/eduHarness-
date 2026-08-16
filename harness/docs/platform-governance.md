# 多平台治理

## 定義

Harness 本身是 local control plane：Route Plan、使用者裁決、preflight、dispatch、evidence 與 verifier 都在目前 repository 內完成。

平台是可插拔的 local adapter。平台可以是主 Agent、rule-tool，或使用者另外接入的 Codex／Claude／Antigravity 本機 adapter。平台是否能使用，不由名稱推定，必須由 registry 與 readiness probe 證明。

## 規劃期路由

每個非瑣碎任務先形成 Route Plan。Route Plan 不只列步驟，也列出：

- 節點 objective 與依賴。
- requested platform、agent、role 與 capability。
- fallback platform；預設為 primary-agent。
- verifier mode 與 verifier platform。
- allowed paths 與預期 evidence。

使用者可在 execution 前修改整張 Route Plan。模型或 router 只能提出建議。

## Preflight

Preflight 只做無副作用檢查：

1. platform 是否在 registry。
2. platform 是否啟用。
3. adapter module 是否存在。
4. adapter 是否提供 `probe`。
5. capability 是否符合節點需求。

結果分為：

- `ready`：指定平台可使用。
- `fallback`：指定平台不可用，已改由 primary-agent 接手。
- `deferred`：沒有安全可用的替代平台。

`requested_platform` 與 `actual_platform` 必須同時保留。

## Verifier policy

Verifier 是依風險與複雜度排程，不是每個節點固定派一個：

- Simple：`none`，只做本機 plan contract check。
- Standard：`final`，任務最後統一驗證。
- Complex：跨平台、high risk 或明確指定的節點使用 `node`；最後可再做 `final`。
- `escalate`：只在結果衝突、不可逆或使用者要求時增加審查。

Profile 提供 `max_node_verifiers` 預算。使用者明確指定的 verifier mode 優先於預設預算，並在 plan 中留下原因。

## Fallback

平台不可用不等於整個任務失敗：

- 若使用者允許替代，改由 primary-agent 執行並記錄原因。
- 若指定平台是任務必要條件，停在 `awaiting_user` 或 `deferred`。
- 不得把 requested platform 假報成 actual platform。
- 不得因 fallback 自動擴大 allowed paths 或任務範圍。
