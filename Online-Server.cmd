@echo off
title Battle Report 40k - Online server
cd /d "%~dp0"
rem Supervised online server on 127.0.0.1:8420 (data in B:\BattleReportServer\data, backups in B:\BattleReportServer\backups). Internet access: Online-Tunnel.cmd
rem Rolling restarts without downtime: daily at 05:00 when no game is active, or "node server\online-admin.mjs reload".
rem Update the code: Online-Update.cmd. Options: --port 8420 --data <dir> --restart-at 05:00 (or off)
node server\online-supervisor.mjs %*
pause
