# eduHarness — 教師用 AI 教學技能包

給教師的 Claude Code／Codex 技能（skill）集合：教案撰寫、教案差異化、試題命題、教材轉闖關遊戲、數位學習精進教案等，加上一組通用工程與寫作技能，開箱即用。

## 這是什麼

每個「技能」是一份結構化的工作指引（Markdown），AI 助理（Claude Code、Codex 等）讀了之後，會依固定的輸入、流程、輸出與停止規則幫你完成該類任務——例如把課綱轉成題庫草稿、把現有教案做成三層差異化版本。

## 安裝（約 5 分鐘）

1. 安裝 [Claude Code](https://claude.com/claude-code)（或相容的 AI 編碼助理）。
2. 下載本專案：
   ```bash
   git clone https://github.com/bai-collab/eduHarness-.git eduHarness
   cd eduHarness
   ```
   （放其他路徑也可以，路徑不影響使用。）
3. 用 Claude Code 開啟該資料夾，直接對它說你要做的事（例：「幫我把這份課綱命 20 題選擇題」），對應技能會自動載入。

## 技能清單

### 教育類

| 技能 | 用途 |
|---|---|
| 教案撰寫 | 從課綱、學習者與時數限制產出完整教案 |
| 教案差異化教學 | 把現有教案改寫成分層支持版本 |
| 數位學習精進教案 | 台灣數位學習精進方案格式的教案 |
| 試題命題 | 把課綱／教材轉成可審查的題庫草稿 |
| 教材轉闖關遊戲 | 教材轉實體或網頁闖關遊戲規格 |
| AI 文件 Markdown 轉換 | AI 讀文件前的安全轉換流程 |
| 海明威寫作法 | 具體、有畫面感的寫作約束 |
| 行動優先輸出 | 讓 AI 回覆行動優先、步驟編號 |
| 圖片轉 3D | 把場景圖片重建成可環繞的 3D 展示頁 |
| Pixel AI 秘書提示套件 | 像素風虛擬助理角色的一致性提示包 |

### 通用工程類

API 契約設計、安全與強化、規格驅動開發、測試驅動開發、除錯與錯誤修復、規劃與任務拆解、提示詞優化。

## 資料夾結構

- `brain/skills/`：技能原始版本（唯一可編輯處）
- `.claude/skills/`、`.agents/skills/`：自動投影（請勿直接編輯）
- `harness/scripts/`：投影與防重工具（改了技能後跑 `node harness/scripts/project-skills.mjs --apply` 重新投影）

## 可攜式 Registry 與復原

分享版 registry 使用 `workspace_mode: repository-root`，不會保存建立 clone 的電腦絕對路徑。請在 repository root 執行：

```bash
node harness/scripts/check-skill-dedup.mjs --require-ready
node harness/scripts/project-skills.mjs
```

若偵測到中斷的投影交易，必須先明確復原，再進行下一次 apply：

```bash
node harness/scripts/project-skills.mjs --recover
```

## 版本

版本採 CalVer（例：`v2026.07.0` ＝ 2026 年 7 月第 1 版）。每版變更見 [CHANGELOG.md](CHANGELOG.md) 與 `RELEASE-NOTES/`。

**注意**：本專案是上游工作區的定期產出物。你在本地的修改不會被上游看到，且下次更新時會被覆蓋——想保留修改請 fork，想回報問題或建議請開 GitHub Issue。

## 授權

雙授權：`harness/` 程式碼採 MIT；`brain/skills/` 技能內容採 CC BY-NC-SA 4.0（姓名標示—非商業性—相同方式分享）。詳見 [LICENSE.md](LICENSE.md)。
