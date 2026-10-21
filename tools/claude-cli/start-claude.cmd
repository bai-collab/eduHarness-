@echo off
rem Claude CLI launcher: choose billing before starting. Double-click, or pass a first prompt:
rem   start-claude.cmd "read workspace/.../handoff.md and follow it"
rem 1 = subscription (OAuth, claude.ai login): clears ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN
rem     for this window only (user-level registry value is untouched); no --bare, CLAUDE.md loads normally.
rem 2 = API key: hands off to start-claude-api.cmd (--bare, auth check, --add-dir).
rem Work folder: user env var CLAUDE_WORKDIR if set (env or HKCU), else two folders above this file.
rem Never put a key here or echo it.
setlocal
rem Work folder: CLAUDE_WORKDIR (user env var) if set, else two levels up (local repo layout).
if not defined CLAUDE_WORKDIR (
  for /f "tokens=2,*" %%A in ('reg query HKCU\Environment /v CLAUDE_WORKDIR 2^>nul ^| findstr /i CLAUDE_WORKDIR') do set "CLAUDE_WORKDIR=%%B"
)
if not defined CLAUDE_WORKDIR set "CLAUDE_WORKDIR=%~dp0..\.."
cd /d "%CLAUDE_WORKDIR%" || (echo Cannot open work folder: %CLAUDE_WORKDIR% & pause & exit /b 1)
echo Claude Code CLI - choose billing:
echo   1 = Subscription (claude.ai login, OAuth)
echo   2 = API key (ANTHROPIC_API_KEY, via start-claude-api.cmd)
choice /c 12 /n /m "Press 1 or 2: "
rem Exact match: choice returns 255 on error/EOF and 0 on Ctrl+C; both must stop here.
if "%ERRORLEVEL%"=="2" goto apikey
if "%ERRORLEVEL%"=="1" goto subscription
:nochoice
echo No choice made. Exiting.
exit /b 1

:subscription
set "ANTHROPIC_API_KEY="
set "ANTHROPIC_AUTH_TOKEN="
echo.
echo [1/2] auth status (expect a claude.ai / subscription authMethod, not api_key):
call claude.cmd auth status
if errorlevel 1 (
  echo.
  echo Not logged in with the subscription. Run: claude.cmd auth login
  echo or start claude and use /login inside, then retry.
  pause
  exit /b 1
)
rem Fail closed: a key source outside the env (apiKeyHelper, settings) still exits 0 above.
call claude.cmd auth status | findstr /r /c:"authMethod.*claude\.ai" >nul
if errorlevel 1 goto notsubscription
echo.
echo [2/2] starting claude (subscription) in %CD%
call claude.cmd %*
exit /b %ERRORLEVEL%

:notsubscription
echo.
echo Option 1 is not using the subscription (authMethod is not claude.ai).
echo Check apiKeyHelper / CLAUDE_CODE_OAUTH_TOKEN / settings.json.
pause
exit /b 1

:apikey
echo.
call "%~dp0start-claude-api.cmd" %*
exit /b %ERRORLEVEL%
