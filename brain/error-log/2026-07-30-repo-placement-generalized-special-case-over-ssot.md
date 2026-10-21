---
name: repo-placement-generalized-special-case-over-ssot
description: 被問「新 repo 放哪」時，憑觀察到的現況（另一個發佈用工作區位於磁碟根層）外推成通則，沒去讀完整 AGENTS.md 就給建議；SSOT 其實明定新獨立專案放 projects/<name>/。記錄「治理決策前先讀 SSOT 檔、不憑 hook 摘錄或印象」與「不把 manifest 特例當通則」
type: errorlog
triggers: [放哪, 資料夾, repo placement, projects, 目錄結構, 治理決策, 能不能, 要不要核准, SSOT, AGENTS.md, hook 注入, 摘錄, 特例外推, eduharness-docs]
rules:
  - "治理決策（放哪／能不能／要不要核准／目錄結構）回答前，先開完整 SSOT（AGENTS.md）對應章節再答;不憑 hook 摘錄、不憑印象、不憑觀察到的現況"
  - "hook 注入是摘錄且明示『以檔案為準』;摘錄提到某概念(如 read order 列了 projects/)不等於掌握其完整規則,規則以完整檔為準"
  - "不把特例外推成通則:manifest 定義的發佈目標(如發佈用工作區由 target_workspace 指定)是特例,新獨立專案一律依 AGENTS.md 放 projects/<name>/ 並含 AGENTS.md 與 docs/{task-state,phase-log,handoff}.md"
date: 2026-07-30
---

# 憑現況外推專案放置位置，未讀 SSOT

## 本次遇到的困難

使用者要把新建的 `eduHarness-docs`（互動架構地圖＋像素圖廊的公開 repo）放到本機某處，問我建議位置。我建議放磁碟根層 `<磁碟根>\eduHarness-docs\`，理由是跟既有的發佈用工作區平行、命名對齊。使用者指出：目前在工作區內作業，repo 應放在 projects 內，並反問 SSOT 是否已有規定。

一查工作區的 `AGENTS.md`，確實明定：第 33 行「`projects/`: independent projects with local governance and state」、第 56 行目錄表「專案 → `projects/<name>/`，需含 `AGENTS.md`、`docs/task-state.md`、`docs/phase-log.md`、`docs/handoff.md`」，且已有 `projects/_template` 與 `projects/README.md`。我的 top-level 建議是錯的。

## 根因

第一，**該讀檔時沒讀**。問題一變成「repo 放哪」，就是 SSOT 直接管轄的治理決策，也正是 hook 注入結尾「衝突時以檔案為準」所指的情境。我卻憑印象與觀察到的現況直接回答，沒去翻完整 AGENTS.md 的目錄章節。

第二，**把特例當通則**。看到發佈用工作區在磁碟根層，就推論新 repo 也放根層。但發佈用工作區是特例——它是 share-conversion 的發佈目標，位置由 `eduharness-share-manifest.json` 的 `target_workspace` 明定，不是一般專案。拿 manifest 特例去套一般新專案，是推理錯誤。

第三，**誤把 hook 摘錄當完整規則**。SessionStart hook 有注入治理摘要，Shared read order 也列了 `projects/<project>/AGENTS.md`，所以 projects/ 這個概念有在眼前;但「新獨立專案要放 projects/<name>/」這條明確規則在**完整檔案**、不在摘錄裡。摘錄只把 projects/ 當「做專案時去哪讀」，我沒連到「新 repo 該建在哪」，也沒去補讀完整檔。

## 之後如何避免

任何「放哪／能不能／要不要核准／目錄怎麼擺」的治理問題，回答前先開完整 `AGENTS.md` 的對應章節（尤其目錄結構表），確認規則後再答。hook 摘錄只當指路，不當答案來源。

看到某個現況（某檔在某位置）想沿用時，先分辨它是**通則**還是**特例**。若該位置由 manifest／設定檔明定（target_workspace 之類），它就是特例，不可外推。

hook 能注入摘要、標出 SSOT、提醒讀檔，但不可能每回合塞完整 AGENTS.md（context 成本）。所以「決策前讀 SSOT 對應章節」這道防線是自己的紀律，不是工具能代勞。

## 快速操作準則

1. 治理決策（放哪／能不能／核准／目錄）→ 先開完整 AGENTS.md 對應章節，再回答。
2. hook 摘錄提到某概念 ≠ 掌握完整規則;規則以完整檔為準。
3. 新獨立專案放 `projects/<name>/`，複製 `_template/`，含 AGENTS.md 與 docs/{task-state,phase-log,handoff}.md。
4. manifest／設定檔明定位置（如發佈用工作區 = target_workspace）是特例，不可外推成通則。
5. 想沿用某現況前，先判斷它是通則還是特例。
