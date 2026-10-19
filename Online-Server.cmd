@echo off
title Battle Report 40k - Online server
cd /d "%~dp0"
rem Online server on 127.0.0.1:8420 (data in %APPDATA%\BattleReport40k-online). Internet access: Online-Tunnel.cmd
node server\online-server.mjs %*
pause
