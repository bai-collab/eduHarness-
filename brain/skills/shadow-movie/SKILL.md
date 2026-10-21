---
name: shadow-movie
description: 將故事、劇本與分鏡轉換為傳統皮影戲風格的可播放 HTML 網頁電影；使用 v0.2 結構化 JSON、可混用的 SVG／PNG 資產、24 FPS 時間軸、骨架／物件連動、核准主視覺錨點與可驗證的本機 Build 流程。當使用者提到皮影戲、皮影動畫、皮影電影、故事轉皮影、/shadow 或 shadow-movie 時使用；不適用於需要音效、互動問答或正式影片匯出的工作。
---

# 皮影戲網頁電影

## 定位

此 Skill 將故事依序轉換為：

```text
Story → Script → Scene → Shot → Asset → Timeline → HTML Runtime
```

v0.2 的正式輸入是結構化 JSON 與資料根目錄內的相對路徑 SVG／PNG。單一 `assets.json` 可以讓不同 asset 混用兩種格式：SVG 保留可拆解的骨架與關節語意，PNG 用於單張背景／角色或固定 artboard 的逐格動作。Runtime 與 Demo 必須由同一份資料 Build 產生，不得在 Demo 內另外維護 `ASSETS` 或 `SHOTS`。

## v0.2 支援範圍

- Story／Script／Scene／Shot 結構化資料。
- 24 FPS 時間軸、相機平移與縮放、分層視差。
- SVG／PNG 角色與背景；單張角色可用 `src`／`views`，PNG 角色也可用 `frame_sequence` 播放固定 artboard 的逐格動作。
- 同一份 JSON 混用 SVG 與 PNG；Build 會驗證格式、PNG header／透明通道與逐格尺寸，並把素材內嵌到自包含 HTML。
- parent-child 骨架樹、bone attachment 與可動物件掛載；可動素材需保存可稽核的 joint anchor，不能只保存圖片框的左上角。
- 根骨架位移、支撐腳／擺動腳步態與手持物件 attachment；角色移動用 root-motion channel，信件等手持物件綁到 hand／arm 子骨架，不能逐件改舞台座標。
- 可選 WebGPU rig compute：先算 bone world matrix，再算 attachment／prop world matrix；沒有 WebGPU 時使用同一 PoseState 的 SVG／CPU fallback。
- 24 FPS pose clock 與 render interpolation，讓電影時間軸固定而畫面保持平順。
- 字幕、Play／Pause／Restart／Seek／逐幀／Shot navigation。
- 本機零外部依賴的 validator 與 Build。

音效、旁白、互動 Quiz、完整 Props 素材製作、Transition 與完整 keyframe 編輯器目前是延後功能；但已生成物件的 bone attachment 與 world transform 屬於支援範圍，不得混為一談。

## 必要流程

1. 先讀取 [pipeline-contract.md](references/pipeline-contract.md) 與相關 Schema。
2. 先判斷任務是否有主視覺／風格參考；有的話讀取 [master-visual-prompt.md](references/master-visual-prompt.md)，啟用 `reference-driven` 流程，先用固定 prompt 產生或確認先生圖，再把核准圖登錄為 visual anchor。
3. 以 `from`／`to` 描述時間變化；不要新增 `startX`／`endX` 等平行欄位。
4. 需要拆解角色或可動物件時，先建立無循環的 `rig.bones`；將 parent id 編譯為 `parentIndex` 與 `depth`，再把部件、郵袋、圍巾、信封、操偶桿等 attachment 綁到 bone-local transform。不得讓子部件各自繞固定舞台 pivot。
5. 拆解 PNG／SVG 部件時，為每個可動件記錄 `joint_anchor`（語意角色、素材像素座標與來源尺寸），把該 anchor 映射到 bone origin；`mirror=true` 的 attachment 沒有 `joint_anchor` 時，validator 必須拒絕。鏡像只反轉 anchor 的 x 偏移，不可直接把整張圖片框的左上角拿來做負 scale。父子 bone 的 local vector 也要由素材的兩個關節 anchor 校準，例如髖→膝，而不是用估計的框座標。若 PNG 是逐格動作，八格共用同一個 artboard、anchor 與來源尺寸，使用 `frame_sequence.frames`、`hold_ticks`、`phase_ticks`、`loop` 描述時間，不在 Runtime 偷裁切或逐格縮放。
6. 需要角色沿地面、橋面或道路移動時，將背景掛在不移動的 `world-root`，角色掛在有 `position_control` 的 `stage-root`；移動只更新 root channel，不能把位移分散到每個部件。
7. 需要角色走路時，先由同一個 `gaitChannels(progress)` 推導 `baseWalkX`、步相位、支撐腳與前後腿角度；`stage-root.position_control` 必須同時接收 `walkX`／`walkY`。用腳端 probe 反算支撐腳接觸位置，支撐腿保持接觸，擺動腿才抬起折膝；播放與 seek 不能只更新 root。
8. 步態驗收至少取兩個相反支撐相位，並合計前後大腿／小腿四個 channel；檢查 `walkX` 單調前進、支撐腳接觸誤差、擺動腳抬升與 CPU／GPU world matrix。只檢查當前前腿會漏掉「前腿支撐、後腿擺動」的錯誤。
9. 需要手持信件、旗子或其他物件時，先建立 hand／grip 子 bone，再以 attachment 的 `joint_anchor` 與 bone-local offset 綁定；驗收手臂旋轉與 root 位移中段，確認物件沒有脫手。
10. 若選用 WebGPU，依 [webgpu-rig.md](references/webgpu-rig.md) 執行 bone depth passes → object attachment pass → texture quad renderer；不能在同一個 unordered dispatch 讀取尚未完成的 parent，也不能讓 GPU 直接假裝更新 SVG DOM。圖片紋理建立、外部圖片複製與 render pipeline 必須使用 validation error scope，錯誤要顯示在 gate 狀態，不得只讓畫面靜默變黑。
11. 所有資產路徑必須是資料根目錄內的相對路徑；不得讀取路徑外檔案或外部 URL。每個 asset 的 `format` 必須與其 SVG／PNG 副檔名一致；背景可用 `src` 作單張全幅圖，或用 `layers.far`／`middle`／`ground` 做分層視差。
12. 依序完成 A 劇本、B 分鏡、C 素材視覺對照、D 代表幀視覺對照、E HTML 實機視覺對照；每一關都要停下來取得使用者確認。
13. Build 前先執行 `scripts/validate.mjs`；reference-driven 任務還要執行 `scripts/validate-visual-review.mjs --required --gate C`，通過後才可正式 Build。
14. Build 產生可重播的自包含 HTML；不要把外部 bearer URL、秘密或本機絕對路徑放入輸出。交付前要以 `--gate E` 完成最後視覺與使用者確認。

## 骨架與物件連動固定規則

成功的走路連動不是「每個部件的 transform 字串都改變」，而是可驗證的父子拓樸：

```text
world(child) = world(parent) × translate(local_position) × rotate(local_rotation)
objectWorld = boneWorld × translate(local_position) × rotate(local_rotation) × scale(local_scale)
```

- 大腿是髖部之後的 parent；小腿是大腿的 child。大腿改變時，小腿局部 `0°` 也必須跟著膝部 world position 移動。
- 小腿單獨改變時，膝部 world position 不可跟著漂移；只改變膝部以下方向。
- 可動圖片的 `joint_anchor` 必須先對準對應 bone origin，再套用旋轉與鏡像；鏡像件的 anchor 必須與非鏡像件使用同一個語意關節，不能只鏡像圖片框。
- 父子 bone 的 local position 必須等於父部件「上一個關節 anchor」到「下一個關節 anchor」的向量；驗收時要檢查 rest、正負父角度與 child-only 角度都沒有可見縫隙。
- 物件先綁定 `boneIndex`，再進 attachment pass；不要把郵袋、圍巾或操偶桿複製成另一套固定 stage 座標。
- 根位移使用 `position_control` 綁定到 stage-root；背景留在 world-root，角色子部件與其 prop 一起平移。
- 步態的 `position_control` 要包含 x／y；同一個 progress 先決定 `supportFoot`，再以支撐腳 probe 和橋面函數反算 root x／y。支撐腿保持接觸，擺動腿才改變大腿／小腿角度；不可用單一 `walkX` 事件讓人物滑過舞台。
- 前後腿的 linked check 必須同時讀取兩條腿，並保存 `maxContactError`、`walkX` 單調性與有效擺動相位的抬腳高度；矩陣一致但腳未動仍判定失敗。
- 手持物件先掛到 hand／grip child bone，再用物件自己的 `joint_anchor` 計算 local offset；物件預設繼承手部旋轉，不能只在第一幀看起來接近。
- 部件圖層可維持 flat SVG sibling 以保留 z-order；parent-child 關係放在 rig data／GPU buffer，不靠 nested SVG 偶然形成。
- movie 的 pose 仍以 24 FPS 保存；render loop 可插值相鄰 pose。seek、逐幀與 restart 必須回到精確 pose，不得累積前一幀矩陣。
- WebGPU 建立失敗、瀏覽器不支援或 shader／buffer 驗證失敗時，回到同一 PoseState 的 SVG／CPU fallback，並在驗收紀錄中標明實際 backend。

詳細的 rig schema、GPU buffer layout、WGSL compute 與最低測試案例見 [webgpu-rig.md](references/webgpu-rig.md)。

## 視覺錨點與視覺比對

當使用者提供、核准或要求比照一張圖片時，該圖片是主視覺錨點，不只是參考靈感。先看懂它的構圖、剪影、透光材質、邊框／鏤空細節、色彩、景深與遮擋，再依同一套規則拆成關節與物件；不能只抽幾個色碼，另畫一套一般扁平幾何圖形。

視覺審查與技術驗證分開：JSON／SVG／DOM／播放控制通過，只能表示「能執行」，不能表示「畫風一致」。要用輸入根目錄內的 `visual-review.json` 記錄 visual anchor、素材來源映射、C／D／E 截圖或並排證據、檢查項目與使用者核准。詳細欄位與判定規則見 [visual-review-contract.md](references/visual-review-contract.md)。

reference-driven 任務的最低視覺 gate 是：

- C：主視覺與拆解素材並排比對；剪影、材質、細節密度、關節／操偶桿、景深與遮擋不一致就退回修改。
- D：檢查動畫第一幀、中段與最後一幀；走路骨架、掛載與操偶桿不能破壞素材的造型與層次。
- E：在目標 viewport 的本機瀏覽器預覽 HTML，將代表幀與主視覺比對，再取得使用者明確核准。
- 接點專項：逐一檢查頸、肩、髖、膝等 anchor；若 CPU／GPU 數值一致但畫面在關節處分離，仍判定 E 不通過，必須回到素材 anchor／bone vector 校準。
- 移動／手持專項：檢查 root-motion 的第一幀、中段、最後一幀；背景不得跟著角色移動，手持物件不得脫離 grip，也不得因 arm rotation 產生可見漂移。
- 步態專項：至少檢查前腳支撐／後腳擺動與後腳支撐／前腳擺動兩個相反相位；支撐腳要貼住橋面，擺動腳要離開支撐面，並確認 `walkX` 與兩腿 world probe 都有連續變化。

可重複的結構與證據檢查由 [validate-visual-review.mjs](scripts/validate-visual-review.mjs) 執行；它不會假裝以像素差取代人的美術判斷。缺少 visual anchor、來源映射、視覺證據或使用者核准時，不得稱為完成品。

## 先生圖固定 Prompt（跨對話鎖定）

先生圖是後續拆解與網頁組裝的風格母版。固定使用 [master-visual-prompt.md](references/master-visual-prompt.md) 的 `prompt_id`、`prompt_version`、`STYLE LOCK` 與 Negative Prompt；只替換故事主角、場景、單一動作與構圖欄位。不要在不同對話中憑記憶改寫成另一種「差不多」的亞洲皮影戲風格。

先生圖核准後，將 `prompt_id: shadow-puppet-master-visual`、版本與 `status: locked` 寫入 `visual-review.json` 的 `prompt_lock`。後續角色、背景與物件必須沿用同一核心 prompt，並在 C／D／E gate 檢查材質、剪影、關節、景深與 HTML 畫面是否仍一致；若先生圖或風格要變，必須升 prompt 版本並重新走 C gate。

## 資產安全

SVG 只能通過 `scripts/sanitize-svg.mjs` 的白名單檢查。PNG 必須通過 PNG signature／IHDR、尺寸與檔案大小檢查；角色與逐格角色 PNG 必須保留 alpha 透明通道，同一序列的所有 frame 必須有相同寬高。拒絕 script、事件屬性、JavaScript URL、外部資源、`foreignObject` 與未知元素。字幕和使用者文字使用 `textContent`，不可直接當 HTML 插入。

## 參考資料

- [pipeline-contract.md](references/pipeline-contract.md)：資料、Build、Checkpoint 與路徑契約。
- [master-visual-prompt.md](references/master-visual-prompt.md)：先生圖固定核心 prompt、Negative Prompt、可變欄位與跨對話版本規則。
- [visual-review-contract.md](references/visual-review-contract.md)：主視覺、素材映射、C／D／E 視覺 gate 與證據契約。
- [feature-support-matrix.md](references/feature-support-matrix.md)：支援與延後功能。
- [webgpu-rig.md](references/webgpu-rig.md)：骨架／物件 WebGPU buffer、WGSL、depth dispatch、插值與 fallback 契約。
- [references/schemas/](references/schemas/)：v0.2 JSON Schema。

## 指令

```powershell
node brain/skills/shadow-movie/scripts/validate.mjs --root brain/skills/shadow-movie/demo
node brain/skills/shadow-movie/scripts/validate-visual-review.mjs --root <demo-root> --required --gate C
node brain/skills/shadow-movie/scripts/build.mjs --root brain/skills/shadow-movie --output outputs/shadow-movie
node brain/skills/shadow-movie/scripts/build.mjs --root <package-root> --input <demo-root> --output <output-root> --require-visual-review --visual-review-gate C
node brain/skills/shadow-movie/scripts/migrate-v0.1-to-v0.2.mjs --input <legacy-storyboard.json> --output <storyboard.v0.2.json>
```

Build 預設採 create-only；若輸出目錄已存在，必須明確傳入 `--force` 才能重建，而且只允許覆寫含有本工具 `build-manifest.json` 的既有輸出。

禁止用技術 validator、DOM 通過、單一色票相近或「可以播放」取代視覺比對；也禁止在未取得使用者 E gate 確認前宣稱交付完成。
