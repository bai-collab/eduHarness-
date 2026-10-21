# AGY（Antigravity CLI）本機呼叫與結果判讀

- 定位：本機（Windows）操作手冊，補充 `AGENTS.md` 的「AGY 呼叫守則」；平台相關的細節放這裡，不放進可攜規則。
- 最近核對：2026-10-13，`agy` 1.3.4；版本、旗標與可用模型每次仍須現場查詢，不沿用歷史清單。

## 現行呼叫規範（優先於下方歷史案例）

1. 使用實際可執行檔路徑；每個新任務／服務變動後，在與外審相同執行環境依序核對 `--version`、`--help` 與 `models`。模型查詢設時間上限並保留 stdout／stderr／退出碼；查詢失敗不能冒充最新模型清單。
2. `--model` 必須從當次 `models` 回傳的完整 id 選取，不沿用 `capabilities.json` 或記憶中已移除的名稱。2026-10-13 核對到 Gemini 3.8 Flash、Claude Opus／Sonnet 5.5；這只是當日觀察，不是永久白名單。Codex 作者的 Gemini 外審目前選用當次清單中的 `gemini-3.8-flash-high`。
3. Gemini 在 AGY 1.3.4 **不額外加 `--effort`**；High／Medium／Low 以當次模型 id 選擇。不要把一般 `--help` 列出旗標當成每個模型都支援。其他家族亦須確認該版本與模型支援，才可增加推理強度參數。
4. 唯讀外審保留 `--mode plan --sandbox --output-format stream-json`、有限 `--print-timeout` 與限定工作目錄。長提示詞由無 shell 的子程序以 UTF-8 標準輸入送入；不在命令列內插完整來源、不使用自動核准旗標、不安裝工具。
5. 來源送附行號、未二次跳脫的全文，區別 JSON 中繼資料與原始碼。保存候選 SHA-256、實際 argv、原始回覆及涵蓋範圍。正式入口的封包／全域排他鎖／來源與身分接受閘必須保留。
6. 核對這次 `init.model` 是否符合指定模型，並檢查非空切題回覆、錯誤、警告、拒絕動作、逾時與截斷。模型清單、exit=0 或 SUCCESS 都不能單獨證明外審完成。
7. 模型名稱／旗標被拒是參數相容問題；503 是服務不可用，不是登入證據。已有授權時可在原範圍用不同策略有限重試一次；替代方式仍無有效回覆則停止，記 INCONCLUSIVE／審查未完成，不反覆付費。
8. 2026-10-15 起共用的 review-loop 轉接層 **預設不送 `--effort`**；設定檔明確寫 `reviewer_effort`（low／medium／high）才送。preflight 另跑 `agy models`，`reviewer_model` 不在當次清單時以 `REVIEWER_MODEL_NOT_OFFERED` 停止（INCONCLUSIVE，`detail` 列出目前可用模型），不自動換模型。唯讀、`--sandbox`、`--mode plan`、`init.model` 身分核對與來源涵蓋閘不變。2026-10-15 依使用者決定，AGY 能力帳本（`capabilities.json`）的模型清單已依 1.3.5 更新（下架者標 `unavailable` 並保留歷史），`modes.review.default_model` 設為 `gemini-3.8-flash-high`：review-loop 設定檔與 `agy review` 省略模型時都用它。**模型再下架時只改帳本這一處**；明確指定的模型照用、不自動替換。能力（capabilities）證據仍是 `agy_version` 所記版本的探測結果。

- 2026-10-14 觀察（agy 1.3.4，同一台 Windows 非沙箱）：正式 `review-loop.mjs` 帶 `--model gemini-3.8-flash-high --effort high` **未被拒**，exit 0、`init.model=gemini-3.8-flash-high`、回覆完整（收據保存在原工作區，未隨附）。與 10-13 被拒結果不同，原因未知（可能是服務端調整）；第 3、8 條仍保留：每次以當次輸出判斷，被拒時才改用相容傳輸層。

證據：`brain/error-log/2026-10-13-agy-gemini-effort-compatibility.md`；兩份對應審查收據保存在原工作區（未隨附）。使用者於 2026-10-13 明確要求將本規範寫入呼叫記憶並依此重新送審。

## 找執行檔

- Codex 內裸 `agy` 可能解析不到；解析不到不等於沒安裝。
- Windows 預設安裝位置在使用者的 LocalAppData 底下：
  - PowerShell：`& "$env:LOCALAPPDATA\agy\bin\agy.exe" --version`
  - cmd：`"%LOCALAPPDATA%\agy\bin\agy.exe" --version`
  - Git Bash：`"$LOCALAPPDATA/agy/bin/agy.exe" --version`
- 每個新任務先跑 `--version`、`--help` 與 `models`，確認可執行、旗標與當次模型名稱。

## 唯讀審查的啟動參數（PowerShell）

```powershell
& "$env:LOCALAPPDATA\agy\bin\agy.exe" --mode plan --sandbox --model gemini-3.8-flash-high --output-format stream-json --print-timeout 180s
```

- 上例只展示啟動參數；模型 id 先經當次 `models` 核對。正式審查由程式將完整提示詞寫入子程序標準輸入，不把上例當成已執行審查的證據。
- `-p`／`--print` 吃參數；長提示詞一律改用 UTF-8 標準輸入，不將整包來源塞進 argv。
- ✅ 2026-09-24 實測 agy 1.2.9：**不加 `-p`、改用標準輸入**可以送提示詞（`agy --mode plan --sandbox --output-format json < prompt.md`）；加了 `-p` 卻不給值會報 `flag needs an argument`。長提示詞（例如 2 萬字、46KB）用 `-p "$(cat …)"` 會超過 Windows 命令列上限（`Argument list too long`，exit 126，這是參數格式問題，不是登入問題），一律改用標準輸入。
- ⚠️ 歷史：Windows PowerShell 5.1 曾把含雙引號的長字串拆成多個參數（2026-09-23 agy 1.2.9 回 `unexpected argument ...`、exit 2）。現行規範使用無 shell 子程序加 UTF-8 stdin；不再以 Git Bash 加長 `-p` 字串作通用解法。
- `--mode plan` 是規劃模式（是否等於唯讀未完整驗證，見下）；`--sandbox` 會限制終端機指令。
- ⚠️ 2026-09-25 實測 agy 1.2.10：**不要同時加 `--disable-slash-commands`**，stderr 會警告 `--mode plan has no effect while slash command expansion is disabled`，plan 模式會失效。
- 2026-09-25 實測 agy 1.2.10：`--json-schema`（檔案或字串、json 或 stream-json、有無 plan）皆**不生效**，要結構化輸出請在提示詞要求並自行驗證。
- 實際模型 id 只出現在 `--output-format stream-json` 的第一個 `init` 事件（`init.model`），同一事件也列出完整工具清單；`json` 輸出沒有模型欄位。
- ⚠️ **輸入有長度上限，超過會被靜默截斷**（2026-09-25 實測 agy 1.2.10／1.2.11）：送審封包 280KB 時，AGY 在約 188KB 處看到 `<truncated … bytes>` 並據實判 INCONCLUSIVE；但 209KB 封包時，最後一份來源只讀到一半，AGY **沒有主動標示截斷**，只在「讀到範圍」寫「節錄」。做法：單包控制在約 **150KB 以內**；超過就分包送審；每次都核對回應的「實際讀到範圍」是否涵蓋每個檔案的最後一行。`status=SUCCESS` 不代表讀完全部輸入。
- 寫檔被拒時，`denied_actions` 可能是空的，拒絕只寫在回覆文字裡（2026-09-25 F3）；判讀不能只看 `denied_actions`。
- 在 Codex 的 Windows 沙箱（`codex sandbox`）內呼叫 agy 會回 `You are not logged into Antigravity`／`authentication failed or timed out`，但**同一台機器在沙箱外正常**：這是沙箱讀不到憑證，不是使用者未登入，不要請使用者重新登入（2026-09-25 F2）。完整探測紀錄保存在原工作區（未隨附）。
- ⚠️ 2026-10-04 實測 agy 1.2.16：**互動模式的 `/usage`（查模型額度）在 print 模式不會展開**。`agy -p "/usage"` 被當成一般提示詞送給模型（flash-low 耗約 1.7 萬輸入 token），模型改去呼叫指令、遭 headless 自動拒絕，沒有任何用量資料。`agy --help` 也沒有對應的子指令。要看 AGY 用量只能開互動式 `agy` 再輸入 `/usage`；不要再用 `-p` 重試，也不要為此加 `--dangerously-skip-permissions`。
- 未經使用者明確同意，不得使用 `--dangerously-skip-permissions`（這是 agy 自己的旗標，會自動核准所有工具）。

## 使用者要求 AGY 審查時的來源授權判讀

- 使用者直接指示「交給 AGY 審查」或「讓 AGY 審查」時，視為已明確授權把完成該次唯讀審查所需的指定專案原始碼／資料提供給 AGY；不得只因內容尚未公開而重複詢問同一項傳輸授權。
- 傳送範圍限於本次審查需要的指定檔案與證據。這項授權不包含 AGY 寫檔、執行破壞性操作、使用自動核准所有工具的旗標，也不包含秘密、金鑰或無關資料。
- 來源傳輸授權與登入狀態分開判斷；每次呼叫仍依該次輸出核對身份、回應、錯誤、拒絕動作與逾時。
- 此次更正的紀錄：`brain/error-log/2026-09-23-agy-review-authorization-overasked.md`。

## 常見狀況與判讀

| 輸出 | 判讀 | 處置 |
|---|---|---|
| `status=SUCCESS`、`response` 空字串、`denied_actions` 有 `command`／`RunCommand`；stderr 說 headless 無法詢問 `command` 權限 | **工具權限策略**，不是登入問題 | 資料已內嵌在 prompt 時，明確寫「不要執行任何指令、不要讀檔」後重試一次（2026-09-23 實測有效）；需要讀檔時限定只用讀檔工具 |
| 該次輸出有 AGY 自身的身分層失敗訊息（例如 `You are not logged into Antigravity`、`Authentication required. Please visit the URL to log in`），而且沒有產生可用回應 | **未登入** | 請使用者登入；本次審查記 `INCONCLUSIVE` |
| 只看到「開始 OAuth 流程」之類的訊息，但該次最後有完成回應 | **不是未登入**（流程可能已成功） | 照常判讀回應內容 |
| 單獨的 `401`，看不出來自哪個服務 | **未知**，先確認服務與身分層 | 不得直接宣稱未登入 |
| 逾時、網路／socket 錯誤、空回應但沒有身分訊息 | **未知** | 記 `INCONCLUSIVE`，不得寫成 PASS |

## 來源案例

- `brain/error-log/2026-09-22-agy-empty-response-misdiagnosis.md`：空回應被誤判為未登入。
- `brain/error-log/2026-09-23-codex-agy-memory-overclaim.md`：09-20 有真實的未登入證據，但被寫成長期事實。
- 登入狀態會因執行環境（Claude 端 shell 或 Codex 沙箱）與時間而不同，不得沿用過去的結論。

## `--add-dir` 不是讀檔邊界（2026-10-21 實測 agy 1.4.3）

- cwd 與 `--add-dir` 都設成空的暫存目錄、`--mode plan --sandbox`（init `permission_mode=request-review`），要求讀工作區內測試檔的**絕對路徑**：`read_file` 狀態 DONE、回覆含檔內隨機標記。headless 沒有詢問就放行。
- 結論：`--add-dir`／cwd 只影響相對路徑解析與工作區視圖，**不能**當成防止 AGY 讀取其他檔案（含 `.env`、本機設定）的隔離。`--help` 沒有禁用工具的旗標。
- 套用：送審資料要假設 AGY 能讀本機任何可讀檔；防護只能靠送審端偵測（事件流出現工具步驟即判審查未完成）與另行設定的拒絕規則，不能靠 add-dir。證據：原工作區探測紀錄（未隨附）。
