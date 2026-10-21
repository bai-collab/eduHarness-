@echo off
rem Claude CLI with API key billing (--bare). Double-click, or pass a first prompt:
rem   start-claude-api.cmd "read workspace/.../handoff.md and follow it"
rem --bare skips CLAUDE.md auto-discovery, so --add-dir re-loads the repo CLAUDE.md.
rem Work folder: user env var CLAUDE_WORKDIR if set (env or HKCU), else two folders above this file.
rem The key comes from the user-level ANTHROPIC_API_KEY variable; never put it here or echo it.
setlocal
rem Work folder: CLAUDE_WORKDIR (user env var) if set, else two levels up (local repo layout).
if not defined CLAUDE_WORKDIR (
  for /f "tokens=2,*" %%A in ('reg query HKCU\Environment /v CLAUDE_WORKDIR 2^>nul ^| findstr /i CLAUDE_WORKDIR') do set "CLAUDE_WORKDIR=%%B"
)
if not defined CLAUDE_WORKDIR set "CLAUDE_WORKDIR=%~dp0..\.."
cd /d "%CLAUDE_WORKDIR%" || (echo Cannot open work folder: %CLAUDE_WORKDIR% & pause & exit /b 1)
if not defined ANTHROPIC_API_KEY (
  for /f "tokens=2,*" %%A in ('reg query HKCU\Environment /v ANTHROPIC_API_KEY 2^>nul ^| findstr /i ANTHROPIC_API_KEY') do set "ANTHROPIC_API_KEY=%%B"
)
echo [1/2] auth status (expect "authMethod": "api_key"):
call claude.cmd --bare auth status
if errorlevel 1 (
  echo.
  echo Not logged in with an API key. Set ANTHROPIC_API_KEY at user level, then retry.
  pause
  exit /b 1
)
echo.
echo [2/2] starting claude-opus-5-5 in %CD%
call claude.cmd --bare --model claude-opus-5-5 --add-dir "%CD%" %*
endlocal
