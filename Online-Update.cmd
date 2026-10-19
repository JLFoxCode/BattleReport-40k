@echo off
title Battle Report 40k - Online server update
cd /d "%~dp0"
rem git pull --ff-only in this checkout; the running server (Online-Server.cmd) is restarted without downtime only if server code changed.
node server\online-admin.mjs update %*
pause
