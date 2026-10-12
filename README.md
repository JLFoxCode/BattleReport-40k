# Battle Report 40k

Companion app for Warhammer 40,000 (11th edition, Chapter Approved 2026-27) for **Android** and **Windows**. A tablet in the middle of
the table keeps the score; every player's phone shows the rules of their own army in the order of play. Everything
readable is English; rules, mission cards and stratagems can be opened with their verbatim original text.

## How it works

- **No internet, no server.** The app contains everything: the web app, the game engine, all rules and the unit data.
- **One device hosts the game.** The device that creates a game (usually the tablet) runs it; the other devices with the
  app (Android or Windows) find it automatically in the same Wi-Fi ("Games nearby" in the lobby), or scan the QR code shown at
  "Roll off for the first turn" (works in any browser, e.g. iPhone).
- **When the battle is over** every connected device keeps a copy of the game (Lobby → "Finished games"), then the
  host closes the game.
- **Updates:** when the app opens with internet it checks for a newer app version (GitHub Releases of this repository)
  and newer unit data (New Recruit's BSData repository) and offers each update in a popup. Unit data is downloaded
  (only the changed files) and converted on the device.

## Install

From [Releases](https://github.com/JLFoxCode/BattleReport-40k/releases):

- **Android:** `BattleReport40k-….apk` – allow "Install unknown apps" for your browser once.
- **Windows:** `BattleReport40k-Setup-….exe` – the installer is not code-signed, so SmartScreen asks once ("More info" → "Run anyway"); allow the app in the Windows Firewall for **private networks** so other devices can join games hosted on the PC.

## Data sources

- **Units, abilities, army rules, detachment rules, enhancements:** [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e)
  (the data New Recruit uses) – raw files in `vendor-data/bsdata/`, converted by `js/data/bsdata-convert-core.js`
  into `data/datasheets/`.
- **Stratagems, missions, core rules:** `data/` (originals in `data/orig/`).

Warhammer 40,000 and all associated names are trademarks of Games Workshop Ltd. This is an unofficial fan project.

## Build

Android – Android SDK (build-tools 35, platform 35) and JDK 17, no Gradle:

```bash
android/build.sh
```

Windows – Node.js 22+ (Electron, electron-builder via npm):

```bash
desktop/build.sh
```

Output: `app/BattleReport40k.apk` and `app/BattleReport40k-Setup-<version>.exe`. Signing uses a local keystore (`android/debug.keystore`, created on the
first build and not part of this repository).

## Structure

| Path | Content |
|---|---|
| `index.html`, `js/`, `css/`, `vendor/`, `icons/` | the app (vanilla ES modules, no dependencies) |
| `engine/`, `engine-host.html` | game engine (rules, scoring) – runs on the hosting device |
| `data/` | rules, missions, stratagems, factions, converted unit data |
| `android/` | Android app: built-in game server, Wi-Fi discovery, updates |
| `desktop/`, `server/` | Windows app (Electron): built-in game server and Wi-Fi discovery (DNS-SD) |
| `vendor-data/bsdata/` | raw BSData catalogues (bundled for on-device data updates) |
