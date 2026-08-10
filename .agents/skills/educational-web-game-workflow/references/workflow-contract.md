# Workflow 契約

## 必要輸入

- 教材或來源。
- 學習目標。
- 學生年段與先備能力。
- 已核准的 web 分支。
- 教室場域、目標裝置、瀏覽器與網路。
- 可及性需求與評量方式。
- 資產、授權、工時、預算與停止條件。

缺少教材、學習目標或 web 分支時，唯一允許的內容輸出是 intake、缺件清單與空白契約。

## 3D 必要性

| 問題 | 是 | 否 |
|---|---|---|
| 學生需要從不同角度觀察嗎？ | 繼續判斷 | 優先 DOM／SVG |
| 深度、遮蔽或內部構造會影響理解嗎？ | 繼續判斷 | 優先 2D |
| 平面圖、影片或分步插圖已足夠嗎？ | 回到 2D | 繼續判斷 |
| 能以完成率、時間、錯誤或教師觀察比較增益嗎？ | 可進 Pilot | 停止 |

遊戲美術層不進學習成效判斷，只依動機、成本與可及性評估。

## 狀態與輸出

| 狀態 | 必要證據 |
|---|---|
| intake-only | 缺件清單與未填欄位 |
| spec-ready | 學習、遊戲、資產與 3D 判斷完整 |
| implementation-preview | Task Packet、安裝預檢、精確變更預覽 |
| experimental-blocked | AI／GLB executor、認證、pinned runtime 或隔離測試未核准；只能使用 brief、使用者提供資產或 fallback |
| pilot-evidence-ready | 真實裝置、瀏覽器、DOM／3D 比較、可及性與教師裁決 |
| stopped | 觸發停止條件、回退方式與原因 |

## 路由優先序

路由器可能只讀取 Skill frontmatter，因此以下規則也必須同步寫在 `SKILL.md` 的 `description`：

| 需求 | 使用的 Skill | 停止或不觸發本 Workflow 的條件 |
|---|---|---|
| 只有教材轉遊戲規格 | `material-to-quest-game` | 尚未要求完整 Web 實作與驗證 |
| 已有 Web 遊戲，只加 Three.js | `quest-threejs-adoption` | 不重新建立教材遊戲規格 |
| 單一參考圖轉展示頁 | `image-to-3d-scene` | 不涉及學習目標、Quest Core 或教學評量 |
| 角色／場景／連續演出 | `visual-art-storyboard` | 只有美術規劃時不啟動本 Workflow |
| physical／both 分支 | `material-to-quest-game` | 本 Workflow 僅負責 Web 分支 |
| 教材到 Web 遊戲的規格、資產、實作與驗證編排 | `educational-web-game-workflow` | 需先通過 Gate 0；缺件時只輸出 intake-only |

## 分支產物矩陣

`required` 表示進入該分支前必須存在；`optional` 表示依需求產生；`N/A` 表示該分支不得假裝產生該產物。

| 產物 | 2D Web | 程序化 3D | 使用者提供 GLB | AI／GLB `experimental-blocked` | fallback |
|---|---|---|---|---|---|
| game-design-spec.md | required | required | required | required | required |
| DOM-only baseline | required | required | required | required | required |
| asset-ledger.md | required | required | required | optional | required |
| asset-manifest.json | optional | optional | required | N/A | optional |
| scene-art-spec.md | N/A | required | required | optional | optional |
| import-preview.json | optional | required | required | N/A | optional |
| asset-preview.png | optional | required | required | N/A | optional |
| asset-validation-report.md | optional | required | required | N/A | required |
| placeholder／DOM equivalent | required | required | required | required | required |
| 真實瀏覽器／裝置證據 | required for pilot | required for pilot | required for pilot | N/A until unblocked | required for pilot |

## 契約版本與未知欄位政策

- 可交換 JSON 產物使用 `schemaVersion` 或 `contractVersion`，目前基準版本為 `1.0`。
- 頂層未知欄位一律拒絕（`additionalProperties: false`）；Scene Event 的 `payload` 也採封閉欄位並依事件類型檢查必要欄位。
- Fixture 只驗證路由與停止規則，不證明課程正確性、WebGL context loss、效能或教師成效。

## 教學邊界

Quest Core 保存題目、答案、得分、道具、進度與完成狀態。視覺層只能提供呈現和語意互動事件；重新建立場景不得改變 Quest State。
