#!/usr/bin/env bash
# Builds the Windows desktop app (Electron) – the same app as on Android: web app + its own game server + DNS-SD.
#   desktop/build.sh   → app/BattleReport40k-Setup-<versionCode>.exe   (NSIS, one-click, per-user, no admin rights)
# Needs: Node + npm (npm install runs once). No code signing (Windows SmartScreen may warn on first start).
set -e
cd "$(dirname "$0")"
[ -x node_modules/.bin/electron-builder ] || [ -f node_modules/.bin/electron-builder.cmd ] || npm install
[ -f node_modules/electron/path.txt ] || node node_modules/electron/install.js   # electron binary (npm may skip install scripts)
rm -rf www server dist
mkdir -p www/bsdata server
# Web app + raw BSData (New Recruit's unit data – the app converts updates itself, js/data/bsdata-convert-core.js)
( cd .. && cp -r index.html engine-host.html manifest.webmanifest sw.js js css engine data vendor icons desktop/www/ )
cp ../vendor-data/bsdata/wh40k-11e-main/*.json www/bsdata/
cp ../server/*.js server/
CODE=${VERSION_CODE:-$(( ($(date +%s) - 1767225600) / 60 ))}   # minutes since 2026-01-01 → always increasing (as android/build.sh)
echo "Version 2.0.$CODE"
# Updates: release config (repo + shell version) and the hashed list of web files for partial updates
cp ../release/app-release.json www/app-release.json
( cd .. && node release/web-index.mjs "$CODE" ) && cp ../release/web-index.json www/web-index.json
npx electron-builder --win nsis --x64 --publish never \
  -c.extraMetadata.version="2.0.$CODE" \
  -c.nsis.artifactName="BattleReport40k-Setup-$CODE.exe"
mkdir -p ../app
cp "dist/BattleReport40k-Setup-$CODE.exe" ../app/
ls -la "../app/BattleReport40k-Setup-$CODE.exe"
