# Scene Event 契約

## Envelope

- `contractVersion`
- `eventId`
- `sceneInstanceId`
- `questRevision`
- `correlationId`
- `type`
- `payload`

## 允許事件

- `scene.ready`
- `hotspot.selected`
- `object.collectRequested`
- `animation.completed`
- `scene.failed`

## 規則

- Quest Core 負責冪等、權限、答案、得分與進度。
- `animation.completed` 不得推進關卡。
- 定義 mount、ready timeout、cancel、context loss、degraded 與 dispose。
- 每個 hotspot ID 必須對應 DOM 等價操作。
