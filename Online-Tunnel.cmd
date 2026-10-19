@echo off
title Battle Report 40k - Cloudflare tunnel
cd /d "%~dp0"
rem Quick tunnel: a random https://....trycloudflare.com address for the online server (Online-Server.cmd must run).
rem A fixed address with your own domain: named tunnel, see ONLINE.md (then run: cloudflared tunnel run battlereport).
where cloudflared >nul 2>nul || (echo cloudflared was not found on PATH. Install it from Cloudflare first - see ONLINE.md. & pause & exit /b 1)
echo Starting the quick tunnel - the https://....trycloudflare.com address appears below. Give it to the players.
cloudflared tunnel --url http://127.0.0.1:8420
pause
