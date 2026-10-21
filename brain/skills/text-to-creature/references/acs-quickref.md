# ACS spec 速查（anyCreature）

一份 JSON spec 定義整隻生物。engine 用 `node engine/cli.js spec.json out.glb` 編成 GLB。參考範例：上游 `example/wolf.json`（2211 頂點、31 關節）。

## 頂層結構

```json
{
  "joints":  { "<JointName>": [x, y, z], ... },
  "joints_R": { ... },                         // 選：右側鏡像雙生（可 staggered pose）
  "chains":  { "<ChainName>": "J1, J2, J3" },   // 一串關節＝一段骨鏈
  "mirror":  "LFront, LBack",                   // 這些鏈自動生右側雙生
  "volumes": [ { "chain": "...", "profile": [...], "color": [...], ... } ],
  "parts":   [ { "type": "curve|membrane|fin|eye|paw|spike", "host": "Joint", ... } ],
  "shading": { "pattern": {...}, "grain": ..., "ramp": ... },
  "animations": { "<clip>": { ... } },
  "smooth_angle": 50,        // 法線平均臨界角（度），預設 50
  "embed_spec": true         // 把 spec 嵌進 GLB（可供 graft 部件），預設 true
}
```

## 幾何要點

- **關節即點**：joints 是 3D 座標；chains 把它們串起來；engine 沿鏈用 Catmull-Rom 生漸縮管狀 volume，並自己推理比例。
- **volume profile**：沿鏈的剖面列（superellipse 或具名凹形），可帶 per-volume 顏色弧。
- **parts**：`curve`(角/獠牙)、`membrane`(翼/膜)、`fin`(鰭/板)、`eye`、`paw`、`spike`；掛在 host 關節上。
- **frame 三模式**（環的朝向，engine 自選/可指示）：parallel-transport（預設，四肢不扭轉）、up-frame（扁身體鎖世界上方）、ground-anchored（腳掌底面貼地）。
- `build:"rigid"` / `faceted`：機械/晶體的硬邊逃生口。
- **剪影優先**：先讓四視角剪影可辨識（寬高比、質量三分佈、腿佔比），再談顏色細節。

## 動畫 schema

```json
"animations": {
  "<clip>": {
    "duration": 1.6,          // 秒
    "loop": true,             // idle/走路 true；attack false
    "mirror_phase": 0.5,      // 選：左右成對肢體的相位差
    "tracks": {
      "<Joint>": {
        "rx": [[frac, deg], ...],   // 繞局部 X 旋轉（度）
        "ry": [[frac, deg], ...],   // Y
        "rz": [[frac, deg], ...],   // Z
        "tx": [[frac, val], ...],   // 位移
        "ty": [[frac, val], ...],
        "tz": [[frac, val], ...]
      }
    }
  }
}
```

- `frac` = 0..1 佔 duration；值：rx/ry/rz 是**度數**、t* 是位移。
- **內插只有線性**：要順就每個往復加密到 ~8–12 個 keyframe（正弦取樣假造 ease-in/out），不要只 `[0, 峰值, 0]`。
- **關節階層**：轉根關節會帶動所有子關節；子關節只加小幅、相位延後的 follow-through。
- **無縫循環**：每條 track `t=0` 與 `t=1` 同值。

### 軸向慣例（照 wolf 範例，實測）

| 動作 | 軸 | 關節 |
|---|---|---|
| 尾巴左右擺 | `ry` | Tail1（主）+ Tail2（延後跟隨） |
| 頭上下點 | `rx` | NeckB（帶整頭）+ Skull（反向小幅抵銷） |
| 腿彎/步態 | `rx` | LFrontRoot→Elbow→Wrist→Toe；LBackRoot→Knee→Hock→Toe（相位依序偏移） |
| 身體浮動 | `ty` | Hips（貼合 footfall） |

- 若點頭方向相反（先抬頭），把該 track 數值正負對調即可，對稱不影響循環。
- 四足自然步態＝對角對（diagonal pairs）+ `mirror_phase:0.5`。

## 常見輸出欄位（編譯後 JSON 摘要）

`{"ok":true, "out":"...", "verts":N, "faces":N, "joints":N, "anims":[...], "checks":"all green", "contract":"ok"}` — `checks` 非 all green 就沒過。
