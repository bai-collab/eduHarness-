# Local Pluggable Harness

這是 local-only 的可插拔 Harness。它只依賴目前 repository 內的相對路徑與本機已存在的工具；不得把特定磁碟代號、使用者名稱、外部帳號、Cloud installation 或單一平台寫入 portable 規則。

## 核心原則

- 使用者意見是流程路徑、範圍、取捨與停止決定的最高權限。
- 模型提出建議，Harness 提供上下文、工具、區塊順序與驗證；模型建議不能取代使用者裁決。
- 任務依複雜度採 Simple、Standard、Complex 三種流程，不要求每件事都走完整管線。
- 區塊是可拔插的。可加入、移除、替換或標記 deferred；缺少 optional capability 不得阻塞整個 Harness。
- 非瑣碎任務先建立 Route Plan：節點、依賴、requested platform／agent、fallback、allowed paths 與 verifier mode 必須在執行前可檢視。
- Skill 解析是 Route Plan 的旁路資料；Skill 不得新增、刪除、重排 Route Plan 節點，也不得改變 Route Plan 的 verifier 預算。Skill 依賴需要使用者確認時，必須提出問題與建議後停在 user-authority。
- Route Plan 中指定的非主平台要先做無副作用 preflight；平台不可用時，若使用者未要求該平台不可替代，預設由 primary-agent 接手並記錄 requested／actual 差異。
- Verifier 依 profile、節點風險與跨平台情況節流：Simple 可不派獨立 verifier、Standard 預設最後驗證、Complex 只驗證關鍵節點；使用者明確指定的 verifier mode 優先。
- 只保存可稽核的 goal、assumption、hypothesis、evidence、check、result、uncertainty 與 decision，不要求或保存私有 chain-of-thought。
- portable 設定只使用相對路徑；本機覆寫集中在未提交的 `harness/config/env.local.json`。
- 不自動安裝套件、plugin、外部 runtime 或服務。
- 寫入前先檢查目標；預設使用 create-only，禁止無聲覆寫。
- 新建或移植 Skill 必須先登錄 `harness/config/skill-registry.json`；穩定英文 `id` 只供內部使用，`display_name_zh_tw`、`aliases_zh_tw` 與 `agents/openai.yaml` 的 `interface.display_name` 必須使用繁體中文可見名稱。
- `harness:validate` 對未登錄 Skill、缺少繁體中文可見名稱或 UI 名稱不一致的 package 直接報錯。

## 計畫書執行拓樸圖（全域設定）

- 每一份可供使用者閱讀的計畫書，都必須包含一張簡易 Mermaid 執行拓樸圖；圖的位置應在目標／範圍之後、詳細步驟之前。
- 拓樸圖的每個節點都必須同時寫出四項資訊：
  1. 節點名稱／步驟：使用穩定的節點 ID，例如 `P0`、`P1`。
  2. 節點功能：例如規劃、執行、呼叫工具、呼叫 Skill、驗證或等待使用者決策。
  3. 使用 agent：填寫 `主 agent` 或 `subagent（角色）`；沒有委派 subagent 時寫 `主 agent`。
  4. 節點狀態：只能使用 `已執行`、`未執行` 或 `有問題`；如有問題，另附一句可稽核的原因。
- 節點之間要用箭頭表達順序或依賴；分支、等待與停止條件要在箭頭或節點旁標明。
- 狀態必須反映實際進度，不得把「計畫要做」寫成「已執行」；計畫內容變更時，拓樸圖與文字步驟必須同步更新。
- 每完成一個節點，必須在進入下一個節點前立即回寫該節點的狀態，並留下簡短的結果、證據、偏離檢查與下一步；不能等整個任務結束才一次更新。
- 每個節點完成後都要做一次 drift review：比較實際執行內容與原定功能、依賴、allowed paths、agent 及 verifier mode；若範圍、路徑、權限或結果跑歪，將節點標為 `有問題`，先停下來修正計畫或取得使用者決策。
- 任務中斷後，先讀取拓樸圖與最近一筆 checkpoint；從第一個不是 `已執行` 的節點續接。若最近節點是 `有問題`，必須先處理該問題，不能跳到後續節點；外部狀態改變時要重新做 preflight。
- `已執行` 只有在節點的檢查證據已保存後才能使用；checkpoint 只記錄可稽核摘要，不保存私有 chain-of-thought。
- 拓樸圖只能使用 repository-relative path 或中性 placeholder，不得放入磁碟代號、使用者名稱、帳號、秘密或其他本機識別資訊。
- 舊計畫書在下一次被修改時，必須補上符合本規則的拓樸圖。

## 檔案歸屬與命名規則（全域設定）

### 目錄歸屬

| 目錄 | 主要用途／SSOT | 不應放入的內容 |
|---|---|---|
| `planned/` | 任務計畫書、執行拓樸圖、checkpoint、未完成與已完成計畫 | 穩定系統說明、Brain 知識正文、原始筆記 |
| `harness/blocks/` | 可插拔流程區塊 | 任務個案資料、私人工作紀錄 |
| `harness/cli/` | Harness／Brain 命令列入口 | 計畫正文、執行輸出 |
| `harness/core/` | 核心邏輯與 domain contract | 本機帳號、目的地特例、執行 session |
| `harness/config/` | portable 設定、Registry、路由與 schema 對應設定 | `env.local.json`、token、cookie、機器專屬覆寫 |
| `harness/docs/` | 穩定的架構、治理、操作與 API／契約文件 | 進行中的任務計畫與逐步 checkpoint |
| `harness/state/` | 執行期產物與狀態 | 可攜規則、長期知識、私人資料 |
| `harness/examples/` | 可重現的範例任務 | 真實使用者輸入、私人路徑、秘密 |
| `harness/schemas/` | JSON Schema 與資料契約 | 未驗證的個案資料 |
| `harness/tests/` | 自動化測試與固定 fixture | 真實帳號、外部服務資料 |
| `brain/skills/<skill-id>/` | 已註冊 Skill package；由 Skill Registry 管理 | 未登錄 Skill、任務計畫、私人 session |
| `brain/knowledge/` | 審查過、可重用的知識 | 原始聊天紀錄、未審查個人筆記 |
| `brain/experience/` | 可重用的經驗回顧 | 進行中的計畫、秘密與完整 session transcript |
| `brain/error-log/` | 可驗證的失敗紀錄 | 憑證、個人識別資訊、無證據的抱怨 |
| `brain/instincts/` | 短小、通用的安全與行動規則 | 個人化偏好以外的長篇工作紀錄 |
| `brain/index.json` | Brain collection 與相對路徑的索引 SSOT | 絕對路徑、已移除內容的殘留 entry |
| `references/` | 唯讀來源、外部資料鏡像與 provenance | 對來源鏡像的手工改寫、執行狀態 |
| `projects/` | 可持續的專案工作產物 | Harness 系統設定、臨時掃描報告 |
| `workspace/` | 任務輸入、暫存與隔離工作區 | 長期知識、portable 設定 |
| `outputs/` | 由任務產生的輸出物 | 來源真實資料、可攜規則正文 |

根目錄的 `AGENTS.md` 是工作規則 SSOT；`README.md` 是使用者導覽；`package.json` 是命令與 runtime metadata。若檔案同時符合多個目錄用途，優先放入更具體的子目錄，並在索引或計畫中留下相對路徑。

### 命名規則

- 新計畫書一律放在 `planned/`，檔名使用 `YY-MM-DD-<lowercase-kebab-topic>-plan.md`；例如 `26-08-16-education-copy-sanitization-plan.md`。
- 計畫書內的 checkpoint、拓樸節點 ID 與檔名要保持穩定；計畫移動時只改路徑，不任意改變節點 ID。
- `harness/docs/` 的新文件使用 `<lowercase-kebab-topic>.md`；穩定規則文件不加任務日期，避免與 `planned/` 混淆。
- `harness/config/` 的 JSON 檔使用 `<lowercase-kebab-topic>.json`；既有被程式以固定檔名讀取的檔案不可只改名而不更新 loader、測試與引用。
- Skill 目錄名與 Registry 的 stable ID 使用 lowercase kebab-case；必要檔名維持 `SKILL.md`、`VERSION` 與 `agents/openai.yaml`，可見名稱依 Skill 規則使用繁體中文。
- `brain/knowledge/` 新檔使用描述性的 lowercase kebab-case；`brain/experience/` 與 `brain/error-log/` 新檔使用 `YYYY-MM-DD-<topic>.md`，以便按時間追蹤。
- `references/` 的鏡像檔名若由來源系統產生，保留來源檔名，不自行改名；若改名，必須同步更新 index、manifest 與 provenance。
- 新檔名不得包含磁碟代號、使用者名稱、帳號、秘密、session ID 或未必要的本機識別資訊；機器管理的檔名避免空白與大小寫混用。
- 不得用同義檔名建立多份 SSOT。若內容已存在，更新原檔或先在計畫中明確宣告新的 SSOT 與遷移方式。

## Workspace discovery

CLI 會從目前工作目錄向上尋找 `harness/config/local-harness.json`。也可以用 `HARNESS_ROOT` 或 `--root` 明確指定本機 repository 根目錄。設定檔本身不得依賴絕對路徑。

## 工作流程

```text
classify → context? → reasoning? → route-plan → platform-preflight → user authority → dispatch → execute/prepare → reconcile? → verify → optional replan
```

區塊順序不是憲法；registry 與 task 的 user directives 可以調整。`verify` 是預設安全檢查，若要改變它，必須在 task 中留下明確的使用者決定與風險紀錄。

## Commands

```powershell
npm test
npm run harness:validate
npm run harness:blocks
node harness/cli/harness.mjs plan harness/examples/task.simple.json
node harness/cli/harness.mjs plan harness/examples/task.complex.pending.json
```
