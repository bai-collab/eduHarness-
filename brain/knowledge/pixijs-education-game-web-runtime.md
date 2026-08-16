---
name: pixijs-education-game-web-runtime
desc: PixiJS 作為 Web-first 教育遊戲 2D Runtime 候選的定位、整合流程、邊界與未來 Pilot 閘門
status: recorded-not-installed
source: https://pixijs.com/
verified_at: 2026-07-13
---
# PixiJS：教育遊戲 Web Runtime 候選

## 採納決策

- ✅ 納入 `source-root` 教育遊戲開發流程。
- ✅ 定位為 **Web-first 教育遊戲的預設 2D Runtime 候選**，不是所有教育內容的強制框架。
- ✅ 位於視覺資產完成 QC 之後，負責瀏覽器中的 2D 呈現、動畫與互動。
- ⏳ 目前只記錄架構與導入條件；未安裝 npm package、CLI、extension、plugin 或 PixiJS Skill。
- ⏳ 尚未建立專案、鎖定版本或完成 F 槽實機 Pilot。

## 已確認的官方能力

- PixiJS 官方將核心定位為高效能 2D WebGL renderer／creation engine，而非完整遊戲引擎。
- v8 架構提供 renderer、scene graph、Assets、Ticker、pointer events 與 accessibility extension。
- `Assets` 支援 PNG 等 texture、JSON sprite sheet、字型及 manifest／bundle 載入。
- accessibility 透過 DOM overlay 提供鍵盤焦點與螢幕閱讀器資訊，但屬 opt-in，必須明確啟用與驗證。

## F 槽預定流程

```text
教學目標／學習者／遊戲機制
→ Claude Desktop 統整教學限制
→ Pixel AI Secretary／Agent Sprite Forge 產生視覺資產
→ 去背、切格、anchor、透明度與動畫 QC
→ PixiJS Atlas Adapter
→ PNG atlas＋PixiJS spritesheet JSON＋animation names／anchors
→ PixiJS Web Runtime
→ 教學狀態、作答回饋、紀錄與教師審查
→ 瀏覽器驗證與部署
```

PixiJS 不負責 Sprite Forge 的生成與確定性後處理；它消費通過 QC 的資產。Atlas Adapter 是獨立的 deterministic contract，不得把展示用 sheet 直接視為可執行遊戲整合已完成。

## 選用規則

| 情境 | 預定選擇 |
|---|---|
| 2D 角色動畫、互動地圖、點擊探索、配對、拖放、情境對話 | PixiJS 優先候選 |
| 純文章、表單、一般測驗或教師後台 | HTML／React 優先；PixiJS 非必要 |
| 複雜物理、完整關卡編輯器、原生遊戲發行 | 另評估 Godot／Unity |
| Canvas 與語意 UI 混合 | PixiJS 負責場景；DOM 負責主要表單、長文與可及性介面 |

## 不由 PixiJS 單獨承擔

- 教學流程、課程規則、評量與學習狀態。
- 資料庫、登入、作答紀錄與學習分析。
- 完整音訊、物理、存檔、場景編輯器及教師後台。
- 單靠 Canvas 即宣稱符合無障礙；需鍵盤、焦點、螢幕閱讀器與 DOM 替代路徑驗證。

## 未安裝邊界

- 不在 root 或全域環境執行 `npm install`。
- 不建立 `node_modules`、lockfile、PixiJS project 或全域工具。
- 不追蹤浮動版本；真正 Pilot 先查核 stable release，再由專案 lockfile 固定精確版本。
- 不把 PixiJS 加入 Harness runtime／bridge Registry；它屬未來教育遊戲專案相依性。
- 不將第三方 PixiJS AI Skill 直接加入 Brain；若未來採用，先走 Skill Registry、防重、來源與 hash 審查。

## 未來 Pilot 驗收

- [ ] 在 `projects/<education-game>/` 建立 project-local spec、AGENTS 與 dependency lock。
- [ ] 驗證 Sprite Forge 輸出可確定性轉換為 PixiJS spritesheet JSON。
- [ ] 驗證 frame rectangle、animation name、anchor、scale、透明邊緣與 atlas 尺寸。
- [ ] 驗證滑鼠、觸控、鍵盤、焦點順序及螢幕閱讀器替代內容。
- [ ] 驗證 Chrome／Edge 的 WebGL／WebGPU fallback、載入錯誤與低效能裝置行為。
- [ ] 將教學狀態與 render state 分離，測試重新整理、復原與錯誤回報。
- [ ] 使用者核准 Pilot 後才將 PixiJS 升級為特定專案的正式 runtime。

## 官方來源

- 首頁／定位：https://pixijs.com/
- FAQ（非完整遊戲引擎）：https://pixijs.com/faq
- v8 Architecture：https://pixijs.com/8.x/guides/concepts/architecture
- v8 Assets：https://pixijs.com/8.x/guides/components/assets
- v8 Events：https://pixijs.com/8.x/guides/components/events
- v8 Accessibility：https://pixijs.com/8.x/guides/components/accessibility

## Provenance

- 查核日期：2026-07-13（Asia/Taipei）
- 狀態：採納為流程候選；未安裝、未建立專案、未執行
