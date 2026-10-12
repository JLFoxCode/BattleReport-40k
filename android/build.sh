#!/usr/bin/env bash
# Builds the Android app without Gradle: web app → assets/www, aapt2 → javac → d8 → zipalign → apksigner.
# The app contains everything (web app, engine, rules, unit data, its own game server) and works without internet.
#   android/build.sh   → app/BattleReport40k.apk
set -e
cd "$(dirname "$0")"
MODE="${1:-release}"
SDK="${ANDROID_HOME:-/c/Android/sdk}"; BT="$SDK/build-tools/35.0.0"; PLAT="$SDK/platforms/android-35/android.jar"
export JAVA_HOME="${JAVA_HOME:-C:/Program Files/Microsoft/jdk-17.0.19.10-hotspot}"; export PATH="$JAVA_HOME/bin:$PATH"
rm -rf build && mkdir -p build/res build/classes build/gen build/assets/www/bsdata
# Web app + raw BSData (New Recruit's unit data – the app converts updates itself, js/data/bsdata-convert-core.js)
( cd .. && cp -r index.html engine-host.html manifest.webmanifest sw.js js css engine data vendor icons android/build/assets/www/ )
cp ../vendor-data/bsdata/wh40k-11e-main/*.json build/assets/www/bsdata/
cp AndroidManifest.xml build/AndroidManifest.xml
CODE=${VERSION_CODE:-$(( ($(date +%s) - 1767225600) / 60 ))}   # minutes since 2026-01-01 → always increasing
sed -i -e "s/android:versionCode=\"[0-9]*\"/android:versionCode=\"$CODE\"/" build/AndroidManifest.xml
# App updates come from the GitHub Releases named in release.json
[ -f release.json ] && cp release.json build/assets/app-release.json
OUT=../app/BattleReport40k.apk
SRC=$(ls src/de/schlachtbericht/app/*.java | grep -v "/DevUpdater.java$")   # the app; dev-build.sh may add its dev classes
[ "$MODE" != "release" ] && [ -f dev-build.sh ] && . ./dev-build.sh   # local development variant (not part of the repo)
mkdir -p ../app
"$BT/aapt2.exe" compile --dir res -o build/res.zip
"$BT/aapt2.exe" link -o build/app.unsigned.apk -I "$PLAT" --manifest build/AndroidManifest.xml --java build/gen build/res.zip -A build/assets --auto-add-overlay
javac -source 17 -target 17 -Xlint:-options -nowarn -d build/classes -cp "$PLAT" $(find build/gen -name R.java) $SRC
"$BT/d8.bat" --release --min-api 26 --lib "$PLAT" --output build $(find build/classes -name '*.class')
python -c "import zipfile; z=zipfile.ZipFile('build/app.unsigned.apk','a'); z.write('build/classes.dex','classes.dex', compress_type=zipfile.ZIP_DEFLATED); z.close()"
"$BT/zipalign.exe" -f 4 build/app.unsigned.apk build/app.aligned.apk 2>/dev/null
[ -f debug.keystore ] || keytool -genkeypair -v -keystore debug.keystore -storepass battlereport -keypass battlereport -alias app -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Battle Report 40k, O=Home, C=DE" >/dev/null 2>&1
"$BT/apksigner.bat" sign --ks debug.keystore --ks-pass pass:battlereport --key-pass pass:battlereport --out "$OUT" build/app.aligned.apk
type dev_after_sign >/dev/null 2>&1 && dev_after_sign
ls -la "$OUT"
