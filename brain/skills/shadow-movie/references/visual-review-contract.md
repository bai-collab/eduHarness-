# 皮影戲網頁電影：視覺審查契約

## 1. 何時啟用

只要任一情況成立，就把任務視為 `reference-driven`（有視覺參考的任務）：

- 使用者提供或核准了主視覺 PNG、角色圖、場景圖或其他風格參考。
- 使用者要求「跟這張圖一樣」、「依圖拆解」、「保持同一種皮影戲風格」或相近意思。
- 任務先產生主視覺，再要把它拆成關節、物件、背景層並組裝成網頁。

若沒有外部視覺參考，仍要做美術方向檢查，但可以使用 `art-direction` 模式，不得假稱有做參考圖比對。

## 2. 技術驗證與視覺驗證是兩件事

`scripts/validate.mjs`、`scripts/sanitize-svg.mjs` 與一般 Build 只能證明 JSON 欄位、路徑、SVG／PNG 媒體安全性、時間軸與 HTML 組裝正確。它們不能證明畫面風格相同，也不能把 DOM 測試當成美術驗收。

視覺驗證要用 `visual-review.json` 記錄：

1. 使用者核准的視覺錨點（style anchor）。
2. 使用的先生圖固定 prompt id、版本與鎖定狀態。
3. 每個角色、背景與可動物件的來源映射、取材區域與推導方式。
4. C／D／E 三個階段的截圖或並排對照證據。
5. 使用者在各階段的核准訊息。不得替使用者捏造核准。

## 3. 視覺錨點與素材來源

`visual-review.json` 放在與 `movie.json` 相同的輸入根目錄，所有路徑都相對於該根目錄，且只能使用 `/`。禁止 `..`、絕對路徑、URL、data URL 與 Windows 磁碟代號。

reference 模式至少要有：

```json
{
  "version": "0.1.0",
  "mode": "reference",
  "prompt_lock": {
    "id": "shadow-puppet-master-visual",
    "version": "1.0.0",
    "status": "locked",
    "source": "shadow-movie/references/master-visual-prompt.md"
  },
  "reference": {
    "path": "concept/master-key-visual.png",
    "role": "style-anchor",
    "approval": "user-approved"
  },
  "asset_mappings": [
    {
      "asset_id": "character-child",
      "asset_paths": ["assets/characters/character-child.svg"],
      "reference_path": "concept/master-key-visual.png",
      "source_region": "畫面中央偏右的人物；頭、軀幹、雙臂、雙腿與操偶桿",
      "derivation": "由主視覺取材後拆成可旋轉關節的 SVG 部件",
      "status": "approved"
    }
  ]
}
```

`prompt_lock` 必須對應 [master-visual-prompt.md](master-visual-prompt.md) 的固定 `prompt_id`，並記錄實際使用的版本；`status` 不是 `locked` 就不能通過 reference-driven 的 C gate。

`asset_mappings` 要覆蓋輸入資料內的每個角色、背景與可動物件；`asset_paths` 要列出該 asset 在 `assets.json` 實際引用的每個 SVG／PNG，包括 `frame_sequence.frames` 的每一張圖。只用相同色票重新畫一套無關幾何圖形，不能標為 `approved`；那只能是 `draft`，必須回到 C checkpoint 修正。

## 4. C／D／E 視覺 gate

每一個已核准的 gate 都要有實際存在的圖片證據，並在 `user_approval` 留下使用者的核准訊息。

### C：素材與風格一致

在正式 Build 前，將主視覺與角色、背景、物件拆解圖做並排或同畫布對照。檢查：

- 構圖、比例與剪影是否仍是同一個畫面語言。
- 透光材質、光影、邊框、紋理與色彩對比是否一致。
- 細節密度是否一致，而不是把精細皮影圖簡化成一般扁平插圖。
- 頭、胸、腰、肩、肘、髖、膝等關節與操偶桿是否能合理控制。
- 遠景、中景、地面層的深度、遮擋順序與視差是否保留。

任何一項明顯不一致，都標為 `needs_revision`；不能以「SVG 可 Build」通過 C。

### D：動畫不破壞素材

至少檢查動畫的起始、中段、結束畫面。確認走路骨架、手臂、頭部、掛載角色與操偶桿不穿插、不斷裂，且運動後仍保留 C gate 的材質、剪影、層次與色彩。把代表幀截圖存入證據後，才可核准 D。

### E：HTML 實機預覽一致

在目標 viewport 的本機瀏覽器載入最後 HTML，至少檢查第一幀、代表中間幀與最後一幀。使用可用的瀏覽器／CDP 視覺檢查工具或本機截圖流程，將 HTML 截圖與主視覺並排比較。播放、seek、逐幀、字幕與鍵盤是另一組技術檢查，不能取代風格比對。

只有使用者明確確認 E 的畫面與預告片目的相符，才可稱為完成品或交付品。

## 5. Build gate 與失敗處理

`scripts/validate-visual-review.mjs` 只做可重複的結構、路徑、證據存在性與 gate 前置條件檢查；它不會假裝能代替人的美術判斷，也不要求預設做像素級 diff。像素級 diff 只有在兩邊的輸出格式與用途合適時才可另外使用。

reference-driven 任務在 C 核准後才可用下列旗標 Build：

```powershell
node scripts/build.mjs --root <package-or-demo-root> --input <demo-root> --output <output-root> --require-visual-review --visual-review-gate C
```

交付前再以 `--visual-review-gate E` 檢查 C、D、E 與最終使用者確認。缺少錨點、來源映射、證據或核准時，流程必須停下來修正或請使用者決策；不得偷偷換成另一種畫風，也不得刪掉參考圖來讓驗證通過。
