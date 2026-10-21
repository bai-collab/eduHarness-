@AGENTS.md
@private/CLAUDE.private.md

<!-- 上一行匯入 Claude 端的個人化補充；private/ 不隨公開版提供，檔案不存在時略過即可。 -->

# 專案工作慣例（Claude 端）

工作規則 SSOT 是 `AGENTS.md`；本檔只補 Claude 端的通用做法。個人化的模型指定、額度交接與本機啟動檔放在 `private/CLAUDE.private.md`（不公開）。

## 專案簡介

本機（local-only）的可插拔治理 Harness：把「治理規則」與「執行環境」分開，非瑣碎任務先建 Route Plan（節點／依賴／platform／agent／verifier mode）再執行。使用者裁決為最高權限，模型建議只能是 advisory。

## 分工與審查原則（寫計畫書時每個執行節點須填 owner + model）

- 計畫書的每個執行節點都要寫出指定的 owner（主 session、具名角色或外部代理）與 model；實際用哪些模型由使用者決定（寫在 `private/CLAUDE.private.md` 或計畫書）。
- 實作類工作**動手前**，先在計畫節點列 owner + model 請使用者核准；使用者**核准該計畫 = 觸發授權**，不需每個節點再追問（滿足 harness「不主動 spawn subagent」政策）。
- 粗工（找資料、寫程式、搬檔）優先交給成本較低的子代理或外部代理，不由主 session 自己做；外部代理不可用時改派其他子代理，並在節點記錄 requested／actual 差異。
- 作者屬 Claude 家族時，需要審查就交非 Claude 家族（例如 AGY 指定非 Claude 模型）。
- 安全相關（authn/authz、憑證/secrets、加密、輸入驗證、漏洞分析）：執行後的**審查／裁決交主 session 指定的模型**，且**與執行的 subagent 不同模型**；不得同一模型自做自審。安全敏感實作不交給一般粗工代理。
- 涉及模型接入、成本或條款的規劃，先確認計費方式（訂閱登入或 API 金鑰）；未確認前兩種情境分開列。
- 外部代理回傳 400、版本或 broker 錯誤時，先查 `brain/` 的相關紀錄，不要判成未登入（依 `AGENTS.md` EVIDENCE-first）。

### 不可越過的底線
- 共同底線（不得自審、範圍變動／不可逆變更須回到使用者）見 `AGENTS.md`「共同安全底線」。
1. 安全敏感節點的**審查不得由執行它的同一 subagent／模型自審**；審查／裁決交主 session 指定、刻意與執行者不同的模型。
2. 執行中 Codex 節點碰到**範圍變動**或**不可逆／外部變更**（push、發布、刪除、外部 mutation），仍須停下問使用者，不自動衝。
3. 改 Claude Code 外掛／hook 程式前，先請使用者確認不是 auto mode；被分類器擋下時不重試、不用 Bash 繞過，停下交使用者決定，切掉後要**新派** executor。

## 對話標題與圖解（Claude 端做法）

- 對話標題規則見 `AGENTS.md`「對話標題命名」。桌面版呼叫 `mcp__ccd_session_mgmt__set_session_title`（`session_id: "self"`，先用 ToolSearch `select:` 載入）；桌面版不認 `[[conv:rename:…]]` 標記。CLI（`CLAUDE_CODE_ENTRYPOINT=cli`）沒有改名工具：在回覆中給使用者一行 `/rename <狀態> | <主題>｜<動作>`（獨立 text 程式碼區塊）；對話由問答轉成實作時也要給。
- 圖解先行套用 skill「圖解先行」（`explain-visual`）；選渲染方式（code block／show_widget／Artifact）前先讀 `harness/docs/visual-first-explanation.md`「Claude 端補充」（尚未帶入時依 `AGENTS.md`「圖解先行」）。
