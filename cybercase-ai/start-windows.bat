@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo Created .env. Add your Gemini API key in the next window, then save and close it.
  notepad .env
)
if not exist node_modules (
  echo Installing dependencies. This requires internet access...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection and run npm install manually.
    pause
    exit /b 1
  )
)
echo Starting CyberCase at http://localhost:3000
call npm start
pause
