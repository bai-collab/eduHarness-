# 指令參考

分享版帶三個腳本，都在 `harness/scripts/`。本頁只描述它們做什麼、有哪些旗標、輸出代表什麼；想知道**為什麼**需要這些機制，看[為什麼同一個技能有三份](../explanation/why-three-copies.md)。

一般使用技能完全不需要這些指令——它們是給要**改技能**的人用的，流程見[改技能並重新投影](../how-to/edit-a-skill.md)。

執行前先 `cd` 到 repository 根目錄。

---

## check-skill-dedup.mjs

防重與一致性檢查。任何技能新增、匯入、更新前先跑它。

```bash
node harness/scripts/check-skill-dedup.mjs --require-ready
```

### 旗標

| 旗標 | 作用 |
|---|---|
| `--require-ready` | 未達 READY 時以離開碼 `2` 結束，方便接在其他流程前當關卡 |
| `--self-test` | 只跑內建自我測試後結束，不檢查實際 registry |

### 輸出與離開碼

| 輸出 | 意思 | 離開碼 |
|---|---|---|
| `SKILL_DEDUP_POLICY_OK` | 政策設定通過 | — |
| `SKILL_PROJECTION_READY skills=N projections=M` | 一切一致，可以繼續 | `0` |
| `SKILL_PROJECTION_BLOCKED unresolved=N` | 有 N 項不一致，下方會列出 | 帶 `--require-ready` 時為 `2` |
| `SKILL_DEDUP_SELF_TEST_OK` | 自我測試通過（`--self-test`） | `0` |

**看到 `BLOCKED` 怎麼辦**：不要繼續做別的事。先看它列出的不一致項目，通常是有人動了投影、或正本改了還沒重新投影。用下面的 `project-skills.mjs` 重新投影。

---

## project-skills.mjs

從正本 `brain/skills/` 生成兩份投影（`.claude/skills`、`.agents/skills`）。這是交易式的：中途中斷不會留下半完成狀態。

### 預覽（預設，不動檔案）

```bash
node harness/scripts/project-skills.mjs
```

只印出計畫，**不寫任何檔案**。先預覽是硬規定。

### 套用

```bash
node harness/scripts/project-skills.mjs --apply --allow-update
```

### 復原

```bash
node harness/scripts/project-skills.mjs --recover
```

### 旗標

| 旗標 | 作用 |
|---|---|
| （無） | 預覽模式，只印計畫 |
| `--apply` | 實際寫入投影 |
| `--allow-update` | 更新既有投影時必須加上（避免誤覆蓋） |
| `--recover` | 復原一筆中斷的投影交易；與 `--apply` 互斥 |

### 輸出

| 輸出 | 意思 |
|---|---|
| `PLAN CREATE/UPDATE …` | 預覽：這些投影會被建立或更新 |
| `SKILL_PROJECTION_PLAN skills=N actions=M` | 預覽摘要 |
| `NO_CHANGES_USE_--apply` | 沒有變更，不需套用 |
| `APPLY CREATE/UPDATE …` | 套用：正在寫這些投影 |
| `SKILL_PROJECTION_APPLIED skills=N projections=M` | 套用完成 |
| `SKILL_PROJECTION_READY transaction=…` | 套用後驗證通過 |
| `SKILL_PROJECTION_RECOVERY_REQUIRED … use --recover` | 偵測到中斷的交易，必須先 `--recover` 才能繼續 |
| `SKILL_PROJECTION_RECOVERED … validation=READY` | 復原成功 |

**看到 `RECOVERY_REQUIRED`**：先跑 `--recover`，復原完成前不允許做下一次 `--apply`。

---

## test-skill-projection-transaction.mjs

驗證投影交易在各種中斷點都能正確復原。改動投影邏輯後才需要跑，一般使用者用不到。

```bash
node harness/scripts/test-skill-projection-transaction.mjs
```

通過時印出 `SKILL_PROJECTION_TRANSACTION_TEST_OK`。

## 相關

- [改技能並重新投影](../how-to/edit-a-skill.md) — 把這些指令串成一次完整操作
- [為什麼同一個技能有三份](../explanation/why-three-copies.md) — 這些檢查為什麼存在
- [資料夾結構](folders.md)
