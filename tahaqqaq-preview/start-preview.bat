@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Run: winget install OpenJS.NodeJS.LTS  then open this file again. & pause & exit /b)
start "" http://localhost:3000
node server.mjs
pause
