# Layout Plan Contract

## 目的

`layout_plan` 是 Web 實作前的空間契約。它描述預期位置與關係，不等於瀏覽器實際渲染結果，也不等於 3D 物理引擎。

## 座標

每個 `viewport_profile` 使用 `0..1` normalized 座標：

```text
x = left / viewport_width
y = top / viewport_height
width = element_width / viewport_width
height = element_height / viewport_height
```

如果必須記錄像素，放在指定 viewport 的驗證註記，不把單一像素值當成跨裝置規則。`rect` 的 `x + width` 與 `y + height` 可以暫時超出 `0..1`，但必須產生 overflow 或 clipping 關係。

## 核心欄位

| 欄位 | 意義 |
|---|---|
| `viewport_profiles` | 目標裝置、方向、safe area 與座標空間 |
| `layout_blocks` | 具有版面責任的巢狀區塊 |
| `component_rects` | 可見、可操作或會影響遮擋的元件矩形 |
| `relations` | containment、overlap、occlusion、adjacency、alignment、overflow、collision |
| `responsive_variants` | 同一元件在不同 viewport 的替代配置或隱藏規則 |
| `warnings` | 計算結果、門檻、嚴重度與處置建議 |
| `verification` | 後續 DOM／瀏覽器／CUA 實測證據 |

## 關係判定

對兩個矩形 `A`、`B`：

```text
ix = max(0, min(A.right, B.right) - max(A.left, B.left))
iy = max(0, min(A.bottom, B.bottom) - max(A.top, B.top))
intersection_area = ix * iy
```

- `overlap`：`intersection_area` 大於採用的 tolerance；同時記錄 `area_ratio` 與 `relative_to`。
- `containment`：一個矩形的四邊在另一個矩形內，允許明確記錄的 safe-area tolerance。
- `occlusion`：兩者有視覺交集，且較高 layer 的元件遮住較低 layer 的必要內容。
- `hit-collision`：`hit_rect` 交集會讓同一個指標或觸控操作可能命中兩個互斥目標。
- `overflow`：元件超出父區塊；若父區塊有明確 `auto`／`scroll` 且內容設計允許，記錄為可接受而非錯誤。
- `collision`：只有在 `collision_channels` 明確指定 `2d` 或 `3d-proxy` 時使用；不能從單純 visual overlap 推論物理碰撞。

## Severity

- `error`：核心內容、必要控制、焦點順序或安全區發生未核准衝突；不得進入實作。
- `warning`：可能在特定 viewport、輸入方式或低效能模式出問題；需要使用者決定或修正。
- `info`：刻意裝飾重疊、可接受 overflow 或待瀏覽器實測的假設。

## 實作前最小門檻

`ready` 至少需要：

1. 所有目標 viewport 都有 profile。
2. 所有必要內容與控制都有 `component_rects`。
3. 未解決的 `error` 為零。
4. 每個 `warning` 都有處置或使用者決定。
5. responsive variant 沒有孤立的必要元件。

`verified` 另需附瀏覽器量測、截圖與實際操作證據。
