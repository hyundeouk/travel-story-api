@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Travel Story - Cloudflare deploy. Please wait...
node setup.js
echo.
pause
