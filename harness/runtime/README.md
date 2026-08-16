# Local Runtime Adapter Contract

Harness 核心不假設 Claude、Codex、Browser 或任何平台一定存在。Runtime adapter 是可拔插的本機實作，必須由 platform registry 或 local override 啟用。平台先經過 Route Plan 的 preflight，才可能成為實際節點。

平台 registry 的 `adapter` 必須是 repository-relative module path 或 `builtin:*`。未啟用、找不到 adapter、缺少 probe 或 capability 不符時，平台狀態為 unavailable；Route Plan 依 fallback policy 改由 primary-agent 接手。

## Readiness probe

```js
await probe({ workspace, platform, context })
// { status: "ready", capabilities: ["coding", "verification"] }
```

Probe 必須是無副作用的本機檢查，不得修改工作區、安裝套件或自行派工。

## Adapter input

```js
{
  root,
  task,
  plan,
  userDecision,
  allowedPaths,
  operation
}
```

## Adapter output

```js
{
  status: "completed" | "failed" | "deferred" | "awaiting_user",
  evidence: [],
  changedPaths: [],
  observations: [],
  nextAction: null
}
```

Adapter 不得自行擴大範圍、忽略 user decision 或把 requested model 當成 actual model。未啟用的 adapter 由 preflight 標記 unavailable，優先使用已核准的 primary-agent fallback；沒有安全替代方案時才回傳 `deferred`。
