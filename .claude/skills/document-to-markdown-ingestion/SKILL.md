---
name: document-to-markdown-ingestion
description: Convert supported source documents to Markdown before Claude or Codex reads, summarizes, searches, extracts, compares, or reviews their content. Use for content-focused AI ingestion of DOCX, PDF, PPTX, XLSX, XLS, MSG, HTML, CSV, JSON, XML, EPUB, or IPYNB files. Do not convert when any requested task concerns formatting, layout, typography, margins, pagination, visual placement, rendering, or format compliance; inspect and render the original file instead.
---

# AI 文件 Markdown 轉換

Apply this workspace-level gate before AI content reading.

## Classify first

| Intent | Required path |
|---|---|
| Read, summarize, search, extract, compare, translate, or review meaning／argument | Convert to Markdown first |
| Check layout, fonts, margins, pagination, line spacing, sections, visual tables／figures, rendering, or official format | Do not convert; inspect／render the original |
| Mixed content＋format request | Format exception dominates; do not run MarkItDown for that file |
| Existing Markdown or source code | Read directly; no conversion needed |

When intent is unclear, inspect the user's requested outcome. Do not infer “content-only” merely from the file extension.

## Content ingestion workflow

1. Confirm the file is not a secret, credential, token, key, auth export, or unrelated private file.
2. Run the wrapper without `-Execute` and inspect `INGESTION_PLAN`.
3. Verify input, pinned package, F-only cache, F-only output, and extension.
4. Run again with `-Execute` only when conversion is in scope.
5. Read the generated Markdown for subsequent content passes; do not repeatedly reconvert an unchanged source.
6. If tables, equations, figures, scans, or extraction gaps affect a content conclusion, inspect the relevant original pages as secondary evidence. The Markdown remains the primary text-ingestion artifact.

```powershell
& F:\eduHarness\brain\skills\document-to-markdown-ingestion\scripts\convert-document.ps1 `
  -Purpose Content `
  -InputPath <source-file>

& F:\eduHarness\brain\skills\document-to-markdown-ingestion\scripts\convert-document.ps1 `
  -Purpose Content `
  -InputPath <source-file> `
  -Execute
```

## Format exception

For every format or visual review, call the wrapper only as a guard check when useful:

```powershell
& F:\eduHarness\brain\skills\document-to-markdown-ingestion\scripts\convert-document.ps1 `
  -Purpose Format `
  -InputPath <source-file>
```

The required result is `FORMAT_REVIEW_ORIGINAL_REQUIRED`; then route to the file-type formatter／renderer Skill. Never use converted Markdown as evidence for page-level correctness.

## Fixed execution boundary

- MarkItDown package: `markitdown==0.1.6`, with only the required format extra.
- uv cache: `F:\eduHarness\.cache\uv\markitdown`.
- output: `F:\eduHarness\scratch\document-ingestion\...`.
- execution: `uvx` isolated run; no `uv tool install`, `pip install`, global PATH change, or project dependency.
- source is never overwritten; output must be a new `.md` file.
- do not read or write the frozen external workspace.

## Report

Record source path, source metadata, output path, converter version, whether original-file follow-up was needed, and limitations. Report conversion as preprocessing, not as proof that visual formatting was preserved.
