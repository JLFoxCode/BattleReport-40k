/* window.BR – the same bridge API as the Android app (MainActivity.Bridge). Synchronous where Android is synchronous. */
const { contextBridge, ipcRenderer } = require('electron');

const s = (name, ...args) => ipcRenderer.sendSync('br:' + name, ...args);
const str = v => (v == null ? v : String(v));

contextBridge.exposeInMainWorld('BR', {
  nearby: () => s('nearby'),                                   // JSON: [{ name, host, port, code, p0, p1, stage }]
  lanIps: () => s('lanIps'),                                   // JSON: ["192.168.…"]
  port: () => s('port'),                                       // number
  platform: () => 'windows',
  releaseInfo: () => s('releaseInfo'),                         // JSON: { repo }
  devInfo: () => s('devInfo'),                                 // JSON: { versionCode, installed, shell, dev: false }
  saveData: (rel, text) => s('saveData', str(rel), str(text)), // boolean
  clearData: () => { s('clearData'); },
  saveGame: (code, meta, full) => { s('saveGame', str(code), str(meta), str(full)); },
  listGames: () => s('listGames'),                             // JSON: metas, savedAt desc
  loadGame: code => s('loadGame', str(code)),                  // string | null
  deleteGame: code => { s('deleteGame', str(code)); },
  installUpdate: url => { ipcRenderer.send('br:installUpdate', str(url)); },
  saveWeb: (rel, b64) => s('saveWeb', str(rel), str(b64)),       // boolean – partial update: one changed web file
  setWebVersion: code => { s('setWebVersion', str(code)); },
  applyWebUpdate: () => { s('applyWebUpdate'); }                  // restarts the app with the new files
});
