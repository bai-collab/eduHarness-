# 皮影戲先生圖固定 Prompt

## Prompt lock

- `prompt_id`：`shadow-puppet-master-visual`
- `prompt_version`：`1.0.0`
- 用途：先產生一張 16:9 的先生圖（master visual／主視覺），作為後續角色、背景、物件拆解與 HTML 畫面的唯一風格錨點。
- 變更規則：`STYLE LOCK` 不得在不同對話中改寫；要改就升版、重新產生先生圖，並重新走 C checkpoint。

## 固定核心 Prompt

以下區塊是跨對話共用的核心。請保留英文原文，避免不同模型或不同時期的對話改寫關鍵風格詞：

```text
STYLE LOCK — traditional East Asian shadow-puppet theatre on a backlit translucent screen; handcrafted cut-leather puppets with visible perforated cutouts, fine inked surface grain, warm translucent color, dark brown leather edges, practical control rods and believable rotational joints; layered theatrical stage with far, middle, and ground planes, deliberate occlusion and depth; dramatic low-key lighting from behind the screen; restrained palette of deep midnight blue, charcoal, muted teal, warm ochre-gold, cinnabar red, cream highlights, and near-black outlines; tactile handmade irregularity, elegant graphic silhouettes, detailed traditional puppet craftsmanship, cinematic 2D composition, rich shadow layers, cohesive material and lighting across every element.
```

## 先生圖模板

只替換大括號內的故事欄位；不要自行增加另一套美術風格描述：

```text
STYLE LOCK — traditional East Asian shadow-puppet theatre on a backlit translucent screen; handcrafted cut-leather puppets with visible perforated cutouts, fine inked surface grain, warm translucent color, dark brown leather edges, practical control rods and believable rotational joints; layered theatrical stage with far, middle, and ground planes, deliberate occlusion and depth; dramatic low-key lighting from behind the screen; restrained palette of deep midnight blue, charcoal, muted teal, warm ochre-gold, cinnabar red, cream highlights, and near-black outlines; tactile handmade irregularity, elegant graphic silhouettes, detailed traditional puppet craftsmanship, cinematic 2D composition, rich shadow layers, cohesive material and lighting across every element.

Story subject: {主角、重要物件與故事核心}
Setting: {地點、時間與遠景／中景／地面層}
Action: {先生圖要捕捉的單一關鍵動作}
Composition: {主體位置、視線方向、前中後景與留白}
Mood: {情緒；只描述敘事氣氛，不改變 STYLE LOCK}
Create one finished 16:9 master visual, 1920x1080, with no title, subtitle, logo, watermark, interface, or readable text.
```

## 固定 Negative Prompt

每次產生先生圖都附上以下 negative prompt；它用來防止畫面滑向先前被拒絕的扁平插畫風：

```text
3D render, photorealistic, glossy plastic, smooth digital vector art, flat generic cartoon, modern minimalist illustration, kawaii mascot, anime character sheet, chibi proportions, sterile geometric shapes, uniform thick outline, paper sticker, western comic book, random clip art, unrelated color palette, missing cutouts, opaque plastic material, floating limbs, broken anatomy, impossible walking skeleton, detached joints, missing control rods, duplicated body parts, melted hands, inconsistent lighting, inconsistent perspective, text, subtitles, logo, watermark, UI, frame border, blurry, low detail, noisy photobashing
```

## 使用規則

1. 先用完整模板產生先生圖；先生圖只負責鎖定構圖、材質、光影、剪影、色彩與層次，不直接取代可動畫資產。
2. 使用者核准後，記錄 `prompt_id`、`prompt_version` 與 `status: locked`，並把同一張先生圖登錄為 `visual-review.json` 的 reference。
3. 拆解角色、背景與物件時，沿用 `STYLE LOCK` 與先生圖；只改變部件範圍、關節位置與動畫需要，不重新發明畫風。
4. 若使用圖像生成工具支援參考圖或 image-to-image，優先帶入核准先生圖；若不支援，仍要使用同一核心 Prompt 與 Negative Prompt，並在 C gate 做並排比對。
5. 新對話開始時先讀取本檔，回報目前使用的 `prompt_id`／`prompt_version`，再開始產生素材。不得依記憶重寫一份相近但不同的 prompt。
6. 先生圖若被使用者判定風格不對，先修正先生圖與 prompt 版本，不得直接用另一套 SVG 或另一套 prompt 繞過 C gate。

## 風格一致的判定

先生圖、拆解素材與 HTML 預覽必須在以下面向保持同一語言：

- 皮革透光與背光，不是一般不透明扁平色塊。
- 剪影、鏤空、邊緣與手工紋理的細節密度相近。
- 關節、操偶桿、遮擋順序與前中後景可解釋且可動畫。
- 深藍／炭黑舞台、青綠、赭金、硃紅與米白的色彩關係一致。
- 所有角色與背景共享同一方向的光影、輪廓語法與材質；若只剩相近色票，視為不合格。
