# WebGPU Rig：骨架與物件連動

這份 reference 是 `shadow-movie` v0.2 的可選 WebGPU 實作契約。它把已驗證的父子骨架邏輯搬到 GPU compute，並保留 SVG／CPU renderer 作為同語意 fallback。

## 何時啟用

只有在角色數量、可動物件、粒子或畫面更新量已經讓 CPU／SVG 成為瓶頸時才啟用 WebGPU。單一角色的視覺驗收仍可使用 SVG／CPU；不要為了「用了 GPU」而犧牲主視覺比對。

`movie.json` 可使用：

```json
{
  "render": {
    "backend": "auto",
    "interpolation": true
  }
}
```

- `auto`：優先嘗試 WebGPU，失敗回 SVG／CPU。
- `svg-cpu`：強制使用可讀、容易做視覺比對的 SVG／CPU renderer。
- `webgpu`：要求 WebGPU；若瀏覽器不可用，必須顯示 fallback／失敗狀態，不得靜默產生另一套姿勢。

## Rig data

角色 asset 的 `rig` 使用 [schemas/rig.schema.json](schemas/rig.schema.json)：

```json
{
  "version": "0.1.0",
  "bones": [
    {"id": "world-root", "parent": null, "local_position": {"x": 0, "y": 0}},
    {"id": "stage-root", "parent": "world-root", "local_position": {"x": 0, "y": 0}, "position_control": {"x": "walkX", "y": "walkY"}},
    {"id": "torso", "parent": "stage-root", "local_position": {"x": 0, "y": 0}},
    {"id": "thigh", "parent": "torso", "local_position": {"x": 85, "y": 125}, "control": "thighAngle"},
    {"id": "shin", "parent": "thigh", "local_position": {"x": 56, "y": 131}, "control": "shinAngle"}
  ],
  "attachments": [
    {"id": "leg-thigh", "kind": "part", "bone": "thigh", "asset": "part-thigh", "local_position": {"x": -96, "y": -75}},
    {"id": "postal-bag", "kind": "prop", "bone": "torso", "asset": "prop-bag", "local_position": {"x": -80, "y": 70}, "local_scale": {"x": 1, "y": 1}}
  ]
}
```

## Root motion 與手持 attachment

角色要在橋面或道路上移動時，將背景掛在靜止的 `world-root`，角色掛在帶 `position_control` 的 `stage-root`。`position_control` 的 channel 值會在每次 pose update 加到 bone 的 local position，CPU 與 GPU 都走同一個 root matrix；不要把同一段位移複製到頭、軀幹、手臂和腿。

手持信件時，先建立 `hand-front` 這類 grip child bone，讓它成為手臂末端的語意接點，再把信件 attachment 綁在該 bone。信件自己的 `joint_anchor` 用來把信封握持點映射到 grip origin；`inherit_rotation` 預設為 true，手臂旋轉時信件必須留在手中。

```json
{
  "id": "hand-front",
  "parent": "arm-front",
  "local_position": {"x": 225, "y": 7}
}
```

`stage-root` 的 root channel、hand／grip 的子骨架與 prop attachment 都要在 CPU／GPU 同時驗證；背景固定、角色移動中段與手持物件中段是必要畫面案例。

### 步態接觸與 root coupling

走路不能只把角色 root 從左移到右。使用同一個 `gaitChannels(progress)` 產生 `baseWalkX`、步相位、前後大腿／小腿角度與 `supportFoot`，再用兩個腳端 world probe 做接觸解算：

```text
relativeFoot = footProbeWorld(pose_without_root)
supportTarget = baseWalkX + neutralSupportFoot + bridgePathY(rootX)
root = supportTarget - relativeFoot
```

- `stage-root.position_control` 必須同時映射 `walkX`、`walkY`；`walkY` 只顯示在控制面板而沒有進入 bone matrix，視為失敗。
- `supportFoot` 交替時，支撐腿保持接觸姿勢，擺動腿才改變 thigh／shin，並在有效擺動相位抬離接觸面。
- linked check 要合計前後腿四個角度 channel；只看前腿會漏掉前腿支撐、後腿擺動的半個步態週期。
- 至少保存 `maxContactError`、`walkX` 單調性、兩個相反支撐相位與連續播放中段的證據。CPU／GPU 矩陣一致不能取代腳步畫面驗收。

`attachments` 是身體部件與圖層；`objects` 是語意上獨立的物件。兩者最後都編譯成 GPU object input，因此郵袋、圍巾、信封、操偶桿與身體部件使用同一套掛載規則。

## Joint anchor 校準

`local_position` 不是圖片框左上角的猜測值。每個會旋轉或被鏡像的部件，都要在資產資料中保存一個可稽核的 `joint_anchor`：

```json
{
  "role": "shoulder",
  "source_size": {"width": 1316, "height": 1195},
  "source_px": {"x": 292, "y": 505}
}
```

把素材從來源像素縮放到 stage 後，令該 anchor 落在 bone origin。若素材沒有鏡像，圖片原點的 local x 偏移是 `-anchor_x`；若素材鏡像，偏移是 `+anchor_x`，如此兩邊的同一顆肩／髖／膝鉚釘才會落在同一個 bone origin。不能沿用未校準的圖片框左上角再直接乘 `scaleX = -1`，那會把鏡像件移離骨架並造成可見縫隙。

父子 bone 也要由兩個 anchor 的 stage 向量建立。例如大腿的髖 anchor 到膝 anchor 是小腿 bone 的 `local_position`；不能另填一組只在某一幀看似接近的估計數字。C／D／E 審查都要檢查 rest、父 bone 正負角度，以及 child-only 角度的接點是否仍重合。

## CPU preflight 與 buffer layout

CPU 只做低頻且可稽核的準備：檢查 parent graph、分配 index、計算 depth、解析 asset 來源，並將當前 pose channel 寫入 input buffer。GPU 不解析字串 id，也不自行猜測 parent。

每個 bone 使用兩個 `vec4<f32>`：

```text
boneInput[2*i]   = (localX, localY, localRotationDeg, parentIndex)
boneInput[2*i+1] = (depth, localScaleX, localScaleY, 0)
```

每個 attachment／object 使用兩個 `vec4<f32>`：

```text
objectInput[2*i]   = (boneIndex, localX, localY, localRotationDeg)
objectInput[2*i+1] = (scaleX, scaleY, inheritRotation, inheritScale)
```

world affine matrix 以兩個 `vec4<f32>` 保存，避免 WGSL `mat3x3` 的對齊尺寸讓 layout 不透明：

```text
world[2*i]   = (a, c, e, 0)   // x' = a*x + c*y + e
world[2*i+1] = (b, d, f, 0)   // y' = b*x + d*y + f
```

## WGSL dispatch 順序

`runtime/webgpu-rig.js` 內的 WGSL 有兩個 entry point：`bone_main` 與 `object_main`。

1. 對每個 `depth` 建立一個 compute pass，只處理該 depth 的 bone。
2. pass 內的 bone 讀取 parent world rows，計算 `parent × local`，寫回 `BoneWorldBuffer`。
3. 所有 bone depth 完成後，執行一次 `object_main`。
4. object pass 讀取指定 `boneIndex` 的 world rows，再計算 `boneWorld × localObject`，寫回 `ObjectWorldBuffer`。
5. texture quad renderer 以 object world buffer 畫出部件；SVG fallback 則將同一矩陣轉為 `matrix(a b c d e f)`。

不要把不同 depth 的 bone 放進同一個 unordered dispatch，因為 child 可能在 parent 寫入前讀到舊矩陣。若日後要合併 command submission，仍要用分開的 compute pass 與明確的 buffer synchronization；不可省略拓樸依賴。

## Texture quad 與 GPU validation

Texture quad 不是「建立 canvas 就算完成」。每一張由外部圖片上傳的 texture，至少要具備瀏覽器實際需要的 usage：

```js
GPUTextureUsage.TEXTURE_BINDING |
GPUTextureUsage.COPY_DST |
GPUTextureUsage.RENDER_ATTACHMENT
```

不同瀏覽器對 `copyExternalImageToTexture` 的驗證訊息可能不會直接出現在頁面或 console，因此 renderer 必須：

- 在 `createRenderPipeline` 前後及每次外部圖片複製周圍使用 `device.pushErrorScope("validation")`／`popErrorScope()`。
- 把 validation error 寫入 E gate 狀態並停止宣稱 GPU 畫面通過；不能只看到 adapter、device 或矩陣數值通過就當成完成。
- 等圖片複製完成後再關閉 `ImageBitmap`，並在同一 viewport 截圖確認 texture quad 確實有像素。
- 若 texture、shader、buffer 或 render pass 失敗，回到同一份 PoseState 的 SVG／CPU fallback，且在 `visual-review.json` 記錄 `actual_backend` 與失敗原因。

## 平順播放

使用兩個時間概念：

- `poseTime`：依電影 `fps`（預設 24）取樣，作為字幕、seek、逐幀與輸出語意。
- `renderTime`：依 `requestAnimationFrame` 或 WebGPU render loop 更新；在相鄰 pose 之間計算 `alpha`，對角度、位置與 scale 做插值。

播放時不重建 pipeline、bind group、texture 或 SVG DOM。只更新 pose input／uniform buffer；seek、restart、逐幀時清除插值暫態並直接渲染目標 pose。

## 驗收最低案例

至少要有以下數值與畫面證據：

1. rest：頸、肩、髖、膝的 `joint_anchor` 必須與對應 bone origin 重合；鏡像左右件不得出現可見縫隙。
2. `thigh=-18°、shin=0°` 與 `thigh=+18°、shin=0°`：小腿膝 world position 必須不同，且與 thigh 的 knee attachment 相同。
3. `thigh=0°、shin=-15°` 與 `thigh=0°、shin=+15°`：膝 world position 不變，小腿方向改變。
4. 改變 torso：所有子 bone 與掛載物件一起移動；不允許只有父圖層移動。
5. 改變 postal-bag／scarf／rod 所綁定的 bone：物件依 `inherit_rotation`／`inherit_scale` 反映同一 world transform。
6. stage-root 的 `position_control` 從路徑起點到終點：背景不移動，角色與所有子部件一起移動；中段 root motion 不得造成接點漂移。
7. hand／grip attachment 在手臂旋轉與 root motion 中仍與信件、旗子或操偶桿重合；不得只在 rest 第一幀驗收。
8. gait 的 `walkX` 在 0～100% 應單調前進；支撐腳接觸誤差不得超過矩陣容許值，且兩個相反支撐相位的擺動腳必須有可觀察抬升。
9. CPU／SVG 與 WebGPU 的 world matrix 差異小於 `0.01 stage px`；任何 `NaN`、未知 parent、cycle、anchor 未校準、漏畫 attachment 或支撐腳漂移都判定失敗。
10. WebGPU 不可用時，fallback 仍通過同一組接點與步態測試，並在 `visual-review.json` 記錄 `requested_backend` 與 `actual_backend`。

## 與視覺 gate 的關係

WebGPU 只改變運算／繪製後端，不改變主視覺錨點。C gate 要先確認拆解素材；D gate 要比較第一幀、中段、最後一幀的骨架、物件掛載、遮擋與操偶桿；E gate 要在同一 viewport 比較 SVG fallback 與 WebGPU texture quad，最後仍由使用者確認。
