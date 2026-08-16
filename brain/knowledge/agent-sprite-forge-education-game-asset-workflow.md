---
name: agent-sprite-forge-education-game-asset-workflow
desc: Agent Sprite Forge 的教育遊戲視覺資產生產流程、雙平台分工與未來導入邊界
status: recorded-not-installed
source: https://github.com/0x0funky/agent-sprite-forge
verified_at: 2026-07-13
---
# Agent Sprite Forge：教育遊戲資產生產流程

## 記錄目的

供未來開發教育遊戲時規劃角色、NPC、怪物、特效、地圖及引擎素材。本文只記錄已查核的上游流程及本工作區預定的使用方式；目前未安裝、未匯入程式碼，也未完成 F 槽實機驗證。

## 資訊狀態

- ✅ 上游為 Codex-first 的 2D sprite／map 資產工作流。
- ✅ `generate2dsprite` 與 `generate2dmap` 以 host 內建 image generation 產生原始圖，再由本地 Python 做確定性後處理。
- ✅ `video2dsprite` 的生成階段限定 Grok Build，Codex／Claude 缺少其要求的 `image_to_video`。
- ✅ Python requirements 列出 `numpy>=1.26`、`Pillow>=10.0`；video pipeline 另需 PATH 上的 `ffmpeg`。
- ✅ 上游採 MIT License。
- ⏳ 尚未在 `source-root` 安裝或執行 smoke test。
- ⏳ Claude、Codex bridge 與 image output 本機落檔能力仍待實測。

## 上游核心生產流程

```text
自然語言需求
→ Agent 判斷資產類型、視角、動作、格數、anchor、style 與輸出組合
→ 內建 image generation 產生純 #FF00FF 背景的 raw sheet／map 素材
→ Python 做去背、despill、切格、component 篩選、縮放與 anchor 對齊
→ 輸出透明 PNG frames、sheet、GIF 與 pipeline metadata
→ 人工／自動 QC
→ Web-first 專案交給 PixiJS Atlas Adapter／Runtime；其他需求再評估 Godot 或 Unity
```

上游明確區分「生成創意資產」與「確定性後處理」：Agent／image model 決定視覺內容；Python 不負責用幾何圖形取代使用者要求的美術。

## Pipeline A：`generate2dsprite`

### 適用資產

角色、玩家、NPC、怪物、召喚物、道具、施法、投射物、命中特效及 animation sheet。

### 流程

1. Agent 從需求推定 `asset_type`、`action`、`view`、sheet layout、frame count、bundle、anchor、scale strategy 與 art style。
2. 撰寫 image prompt；固定格數、相機距離、角色尺度、格內安全區與純洋紅背景。
3. 使用 host 的 image generation 產生 raw PNG。
4. 使用 `generate2dsprite.py process`：
   - 洋紅去背與 despill
   - 切分 frames
   - component 選擇
   - 尺度與 feet／bottom／center anchor 對齊
   - edge-touch 等 QC metadata
   - 透明 sheet、frames 與 GIF 匯出
5. 多動作主角先逐動作生成與 QC，再以確定性方式組裝 engine atlas；避免一次要求模型生成彼此無關的動作列。
6. body、projectile、impact 與大型 FX 原則上分層輸出，避免特效擴大 bounding box 而縮小角色。

### 典型輸出

```text
raw-sheet.png
raw-sheet-clean.png
sheet-transparent.png
frames/*.png
animation.gif
prompt-used.txt
pipeline-meta.json
```

## Pipeline B：`generate2dmap`

### 適用資產

單張 baked map、layered raster map、prop pack、碰撞與 zone metadata，以及可編輯 Godot map 素材。

### 流程

1. 先選 map mode、視覺模式、runtime、collision 與 export 策略。
2. Layered raster 通常依序建立：

```text
ground-only base
→ dressed reference
→ compact prop pack／獨立大型物件
→ transparent prop extraction
→ placement、collision、zone metadata
→ layered preview
```

3. 可互動物件、門、危險物、pickup、角色與前景遮擋物不應烘焙進不可編輯背景。
4. 小型緊湊物件可用 `2x2`／`3x3`／`4x4` prop pack；平台、橋、牆、門與碰撞關鍵大型物件使用獨立圖、長條或自訂 cell。
5. 引擎整合是資產生產後的獨立階段，不能只用展示 mockup 宣稱 playable map 已完成。

## Pipeline C：`video2dsprite`

```text
base still
→ Grok image_to_video
→ ffmpeg 抽幀
→ 洋紅去背
→ 8／16／24／48 frames 取樣
→ strip／grid／GIF
```

此流程可能產生較密集動作，但上游也明示可能有柔化、identity drift、chroma fringe 與非完美循環。因目前 harness 收斂於 Claude＋Codex，本流程只保留為參考，不列入預定 runtime。

## 教育遊戲的本地應用流程（規劃）

以下是 `source-root` 的預定整合方式，不是上游已完成能力：

```text
教學目標／學習者／遊戲機制
→ Claude Desktop 統整需求與教學限制
→ Pixel AI Secretary 或專案美術規格產生角色 prompt package
→ Claude Code 透過 bridge 派給 Codex
→ Codex 執行 generate2dsprite／generate2dmap
→ F 槽隔離輸出與 QC
→ Result Packet 回收檔案、metadata、限制與驗證
→ 教師／使用者審查
→ Web-first：PixiJS Atlas Adapter 產生 PNG atlas＋spritesheet JSON
→ 核准後才整合進 PixiJS、Godot 或 Unity 教育遊戲專案
```

### 建議任務分工

| 階段 | 建議責任面 |
|---|---|
| 教學目標、年齡、教材語意與活動限制 | Claude 主控；使用者最終確認 |
| 資產規格、角色一致性、視覺 prompt package | Claude／Pixel AI Secretary |
| image generation 與 sprite/map 後處理 | Codex executor |
| 路徑、metadata、透明度、frame、碰撞資料驗證 | Codex verifier 或規則工具 |
| 教學適切性、文化與內容審查 | Claude＋使用者 |
| Web-first 2D 呈現、動畫與互動 | PixiJS 為預設候選；專案 Task Packet 另行核准 |
| 複雜物理、原生發行或完整關卡工具 | 另評估 Godot／Unity |

## 未來導入邊界

- 不直接執行上游的全域 `Copy-Item -Force` 安裝方式。
- 不修改使用者全域 Python 或 Codex skill 目錄。
- 固定完整 commit SHA，不追蹤浮動 `main`。
- 只選擇性匯入需要的 skill、references、scripts 與 MIT LICENSE；不搬移 showcase 素材。
- 第一階段只評估 `generate2dsprite`；`generate2dmap` 於 sprite pilot 通過後再評估。
- `video2dsprite` 不進 Claude＋Codex 核心 runtime。
- PixiJS 已納入為 Web-first 2D Runtime 候選，但目前不安裝、不建立專案、不寫入 Harness runtime Registry。
- Sprite Forge 輸出不可直接視為 PixiJS-ready；需另建 deterministic Atlas Adapter 並驗證 JSON frame、animation name、anchor 與 scale。
- 執行環境、依賴與輸出全部限制在 `source-root`。
- 每個 task 使用獨立 `outputs/sprite-forge/<task-id>/`，禁止將 output 指向 root、Brain、references 或舊 D 槽。
- 上游 video processor 會刪除輸出目錄內既有 `frame_*.png` 並以 `ffmpeg -y` 覆寫；導入前必須增加路徑 confinement、精確 write/delete preview 與 rollback。
- 只使用自行擁有、獲授權或適合使用的角色與素材；MIT License 適用於上游軟體，不等於自動授權所有生成內容、第三方角色或參考圖。

## 未來 Pilot 驗收項目

- [ ] 固定並記錄完整 upstream commit SHA。
- [ ] 建立 F 槽專屬 Python environment 與精確 dependency lock。
- [ ] 驗證 Codex image generation 的 PNG 可被本地 processor 取得。
- [ ] 驗證禁止寫入 `source-root`、Brain、references 與非核准 project paths。
- [ ] 驗證透明邊緣、洋紅殘留、frame 邊界、anchor、角色尺度與 GIF loop。
- [ ] 產出一組教育遊戲 NPC 的 sprite pilot，不直接整合遊戲程式。
- [ ] 將核准的 sprite pilot 轉為 PixiJS spritesheet JSON，完成最小動畫、點擊／觸控與鍵盤操作驗證。
- [ ] Task Packet／Result Packet 留存 prompt、輸出路徑、metadata、限制與 QC 證據。
- [ ] 使用者確認後才決定是否正式建立共用 skill。

## 已知上游限制與待查事項

- 上游目前沒有 release 或 tag；正式採用需 pin commit。
- 查核時 GitHub Actions workflow 數量為 0；不能以 README 展示取代本機測試。
- Open issue #3 回報透明邊緣可能殘留紫色。
- Open issue #4 回報 Codex image generation 輸出未必落到 skill 預期的可讀本機 PNG 路徑。
- Open issue #7 討論透過 Codex CLI bridge 支援 Claude Code 等非 Codex agent，表示原生跨 agent 支援仍是待辦方向。

## 來源

- Repository／README: https://github.com/0x0funky/agent-sprite-forge
- Sprite skill: https://github.com/0x0funky/agent-sprite-forge/blob/main/skills/generate2dsprite/SKILL.md
- Map skill: https://github.com/0x0funky/agent-sprite-forge/blob/main/skills/generate2dmap/SKILL.md
- Video skill: https://github.com/0x0funky/agent-sprite-forge/blob/main/skills/video2dsprite/SKILL.md
- Requirements: https://github.com/0x0funky/agent-sprite-forge/blob/main/requirements.txt
- License: https://github.com/0x0funky/agent-sprite-forge/blob/main/LICENSE
- Issues: https://github.com/0x0funky/agent-sprite-forge/issues/3, https://github.com/0x0funky/agent-sprite-forge/issues/4, https://github.com/0x0funky/agent-sprite-forge/issues/7
- Related Web Runtime decision: `brain/knowledge-base/pixijs-education-game-web-runtime.md`

## Provenance

- 查核日期：2026-07-13（Asia/Taipei）
- 查核分支：`main`
- 查核時最新 commit 前綴：`64fd0b57`
- 狀態：僅記錄流程；未安裝、未匯入、未執行
