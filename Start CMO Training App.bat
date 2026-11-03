@echo off
rem Windows: double-click to start the CMO Training demo. Close this window to stop it.
title CMO Training
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js is not installed. Get it from https://nodejs.org and try again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo First run: installing packages, one time only...
  call npm install || (
    echo Install failed.
    pause
    exit /b 1
  )
)
echo Starting CMO Training. A browser tab opens when it is ready.
call npm run dev -- --open
