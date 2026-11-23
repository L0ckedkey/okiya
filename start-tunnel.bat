@echo off
title Okiya Online - Cloudflare Tunnel
where cloudflared >nul 2>nul || (echo cloudflared belum terpasang. Jalankan: winget install --id Cloudflare.cloudflared & pause & exit /b)
echo Cari baris berisi https://....trycloudflare.com di bawah, itu link untuk dibagikan.
cloudflared tunnel --url http://localhost:3000
pause
