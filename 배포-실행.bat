@echo off
cd /d "%~dp0"
echo ====================================================
echo   Deploying travel-story-api to Netlify...
echo   Please wait 1-3 minutes. A log is saved to deploy-log.txt
echo ====================================================
echo.
echo [%date% %time%] start > deploy-log.txt
call npx -y @netlify/mcp@latest --site-id 81d15e1c-ad12-4428-9d0a-74c22cea5185 --proxy-path "https://netlify-mcp.netlify.app/proxy/eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..UUeKNTx6zrMrnItu.1K4MPmD2x7tdaqO6030WzxdsboztBA3kuuk8CMgBxgi6qEn9-kNFHWYgrQdPEx4kggfgDahuyyu0QPqHzhQVZc8B1i0Rqq3jFex40SV181KTEYppnRxGaf9HYxlQy-3d9QeS24iAPvJN_8s-aFosoR_6Z_aGPdzDNH9dcKoChbiOmLwn8huszzPvE51ePy1dsS4GFBJI7ryKYlE0SyLjK7MJcapP3BIPArq9Umo3K5YTUkX63HqAPB1ZVY4heh7ByX_GZq9bR9UMgECHxTP1_ye3XfL9s_fwBb49RP8zGOdmgzVX3HDLPp3oOUjZdXdzM4BT3q_Vhnp5HeV9G6N8Ot6wE0TddncxwxOWNIipjmYj6CgOxTNzqNuEEe8ITjWjWw6_BOJ1VmiVIFuWw5XsvZMtV7g.unZizSgHobocCGGxy8-RVA" >> deploy-log.txt 2>&1
set RC=%ERRORLEVEL%
echo [%date% %time%] exit code %RC% >> deploy-log.txt
type deploy-log.txt
echo.
echo ====================================================
if "%RC%"=="0" (echo   RESULT: OK - exit code 0) else (echo   RESULT: FAILED - exit code %RC%)
echo   Tell Claude when this window shows the result.
echo ====================================================
pause >nul
