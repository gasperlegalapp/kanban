@echo off
rem Starts Case Control on this PC and opens it in the browser.
rem Leave this window open while you use the app; close it to stop the app.
title Case Control
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
set COREPACK_ENABLE_DOWNLOAD_PROMPT=0
if not exist node_modules (
  echo Installing dependencies, this only happens the first time...
  call corepack pnpm install
)
echo.
echo Case Control is starting. Your browser will open in a few seconds.
echo Keep this window open. Close it when you are done.
echo.
start "" /b cmd /c "timeout /t 6 >nul && start http://localhost:3000"
call corepack pnpm dev
pause
