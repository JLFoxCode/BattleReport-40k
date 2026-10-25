@echo off
title Battle Report 40k - https front (own domain)
cd /d "%~dp0"
rem Own domain + certificate instead of the Cloudflare tunnel: terminates https on port 443 (and redirects port 80) and
rem forwards to the supervised server on 127.0.0.1:8420 (Online-Server.cmd must run).
rem Files: B:\BattleReportServer\tls\certificate.pem (certificate + intermediate chain) and private-key.pem.
rem Router: forward TCP 443 and 80 to this PC; DNS: A record of the host name below to the router's public address (DynDNS).
rem Options: --host battlereport.jlpicture.de --https 443 --http 80 --cert <file> --key <file> --upstream 8420
rem Ports below 1024 need no admin rights on Windows.
node server\online-https.mjs --host battlereport.jlpicture.de %*
pause
