@echo off
title Okiya Online - Server
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js belum terpasang. Unduh di https://nodejs.org & pause & exit /b)
if not exist node_modules (
  echo Memasang dependensi...
  call npm install
)
node server.js
pause
