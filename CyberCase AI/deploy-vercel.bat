@echo off
cd /d "%~dp0"
echo ===================================================
echo   Deploying CyberCase AI to Vercel (Instant Load)
echo ===================================================
echo.
echo If this is your first time, a browser tab will open
echo to log into your free Vercel account.
echo.
call npx vercel
pause
