@echo off
rem Status panel of the online server on this PC: window + tray icon (green / yellow / red), checks the server, the
rem https front and the public address every 10 s, buttons start the server windows. Closing hides it to the tray.
cd /d "%~dp0"
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0server\online-panel.ps1"
