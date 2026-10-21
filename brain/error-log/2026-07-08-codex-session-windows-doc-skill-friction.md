---
name: codex-session-windows-doc-skill-friction
description: Codex Desktop 在 Windows 文件與 skill 維護任務中遇到 sandbox helper、UTF-8/CP950、python -c、apply_patch 與 quick_validate 環境差異的處理規則
type: errorlog
triggers: [codex, windows, helper_unknown_error, apply_patch, powershell, utf-8, cp950, docx, docm, skill, openai.yaml, quick_validate, yaml]
rules:
  - "Windows helper_unknown_error 不逐條重試:必要唯讀檢查合併成一次 require_escalated,justification 限定範圍與目的"
  - "中文檔內容以 UTF-8 Python 讀回為準,不信 PowerShell 顯示;多行 Python 用 here-string,不硬塞 python -c"
updated: 2026-09-29
---

# Codex Session Windows 文件與 Skill 維護摩擦規則

## 2026-09-29 補充：沙箱拒絕寫入既有檔案

使用者要求更新既有交接 Markdown。目標檔案不是唯讀，Windows ACL 也包含 Modify，但一般沙箱中的 PowerShell/.NET WriteAllText 回報 Access to the path is denied。這是一般沙箱寫入遭拒的證據；不能只回報失敗就結束已授權的工作。

**Why:** 只看到 Access denied 就停止，沒有區分檔案 ACL 與 Codex 沙箱限制，會把可完成的使用者要求留在半途。

**How to apply:** 若使用者已明確要求修改同一個檔案，先唯讀確認目標路徑、檔案非唯讀及 ACL；證據顯示限制來自一般沙箱時，針對該既有檔案提出範圍明確的 require_escalated 寫入，成功後用 UTF-8 讀回核對內容。不要換到別的路徑或反覆盲試；若使用者沒有授權繼續處理，依停止規則回報。

## 本次遇到的困難

本次 session 同時處理某長篇文件草稿、DOCM 文字抽取、參考論文整理，以及 Codex skill UI metadata 修改。過程中主要遇到五類摩擦。

第一，Windows sandbox 多次回傳 `helper_unknown_error`。它發生在 `rg`、讀檔檢查、`apply_patch` 讀取既有檔案時，即使操作本身只是唯讀或小範圍修改。若持續逐條重試，會浪費回合並增加不必要的工具噪音。

第二，PowerShell 對 UTF-8 no BOM 中文檔的顯示容易出現 CP950 亂碼。這次 `Get-Content` 與 `Select-String` 一度把正常中文顯示為亂碼，但用 Python 以 UTF-8 讀回後，檔案內容其實是正確的。

第三，多行 Python 腳本直接塞進 `python -c` 時，換行、反斜線、中文引號與 shell 轉義容易造成 `SyntaxError`。本次第一次抽取 DOCM 文字時，就是因為 `\n` 與命令字串混在一起而失敗。

第四，`apply_patch` 在中文路徑或 sandbox helper 不穩時可能失敗。這次草稿已建立成功，但後續小幅 citation replacement 因 helper failed 無法讀檔。改用明確路徑、UTF-8 編碼、只替換剛建立的 Markdown 檔後才完成。

第五，Codex skill 的「可見名稱」與「機器觸發名稱」不同。使用者要求將可見名稱改為某個中文名稱時，正確修改點是 `agents/openai.yaml` 的 `display_name`，而不是 `SKILL.md` frontmatter 的 `name`。此外，官方 `quick_validate.py` 因目前 Python 環境缺 `yaml` 套件而失敗，不能直接解讀為 skill 內容不合格。

## 之後如何避免

遇到 Windows `helper_unknown_error` 時，先判斷是否為必要步驟。若是必要讀取或驗證，將同類唯讀檢查合併成一次 `require_escalated`，並在 justification 中明確寫出「只讀哪些路徑、為何需要」。不要用多個幾乎相同的失敗命令反覆撞 sandbox。

處理中文檔案時，把「終端顯示」與「檔案內容」分開看。凡是看到亂碼、問號或 CP950 顯示異常，先用 Python `Path.read_text(encoding="utf-8")`、`repr()`、檔案大小與關鍵值比對確認，不要立刻重寫檔案。若是 PowerShell 顯示亂碼但 Python 讀回正常，應向使用者說明這是顯示層問題。

需要執行較長 Python 檢查時，不要把多行程式用大量跳脫塞進一行 `python -c`。在 Windows PowerShell 中，優先使用 here-string 放入 `$code` 再傳給 Python；若只是確認一個值，則改成短小、無中文內嵌字串的單行檢查，必要時用 Unicode escape。

`apply_patch` 失敗時，先確認是工具讀取失敗而非 patch 內容錯誤。若目標檔是自己剛建立、修改範圍明確且使用者已授權，可用 PowerShell/.NET `ReadAllText`/`WriteAllText` 搭配 UTF-8 no BOM 做最小字串替換；替代寫法只限於明確目標檔，且需讀回驗證。不要把這種替代寫法用在未知來源、大範圍或未授權的檔案。

修改 skill 顯示名稱時，先檢查 skill 目錄是否有 `agents/openai.yaml`。若只是 UI 可見名稱，修改 `interface.display_name`；若要改觸發名稱或資料夾名稱，才需要重新評估 `SKILL.md` frontmatter、folder name、引用與驗證。中文 display name 可接受；`name` 欄位必須維持 lowercase/hyphen。

驗證 skill 時，若 `quick_validate.py` 因 `ModuleNotFoundError: No module named 'yaml'` 失敗，應標示為驗證工具環境缺依賴，而不是 skill 驗證失敗。可補做最小結構檢查：確認 `SKILL.md` 存在、frontmatter 有 `name` 與 `description`、`agents/openai.yaml` 存在、`display_name` 實際值正確，再把未完成的官方驗證如實回報。

## 快速操作準則

1. 先用 `rg` 搜既有 errorLog；若 `rg` 被 sandbox 擋住，合併成一次授權唯讀搜尋。
2. 中文內容驗證以 UTF-8 Python 讀回為準，不以 PowerShell 亂碼為準。
3. 多行 Python 用 here-string；關鍵中文值比對可用 Unicode escape。
4. `apply_patch` 失敗後，先驗證檔案存在與大小，再採最小替代寫法。
5. skill 可見名稱改 `agents/openai.yaml` 的 `display_name`，不要改 frontmatter `name`。
6. 驗證工具缺依賴時，區分「工具未能執行」與「內容驗證失敗」。
