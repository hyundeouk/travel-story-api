@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Travel Story - put secret keys to Cloudflare
node secret.js
echo.
pause
