/* QR codes to join a game from another device (scan → player view).
 * joinUrl(code, p) needs the host's LAN address: the page's own origin, or – if opened via localhost – the first
 * LAN IPv4 from GET /api/info. qrSvg(text) is synchronous once the vendor lib is loaded; prepareQr() loads both
 * and resolves true when something changed (caller re-renders). */
import { ensureQrLib } from '../geo/markers.js';
import { sheet, esc as escHtml } from './components.js';
import { DEFAULT_SERVER } from '../account.js';

let base = null, pending = null;
const isLocal = h => /^(localhost|127\.|\[::1\]|::1)/.test(h);

export function prepareQr() {
  if (base && window.qrcode) return Promise.resolve(false);
  if (pending) return pending;
  pending = Promise.all([
    ensureQrLib(),
    isLocal(location.hostname)
      ? fetch('/api/info', { cache: 'no-store' }).then(r => r.json()).then(i => (i.lan && i.lan[0] ? `http://${i.lan[0]}:${i.port}` : location.origin)).catch(() => location.origin)
      : Promise.resolve(location.origin)
  ]).then(([, b]) => { base = b; return true; }).finally(() => { pending = null; });
  return pending;
}

export const qrReady = () => !!(base && typeof window !== 'undefined' && window.qrcode);
/** The game's address for typing it in: the host's LAN address (or the online server). */
export const directUrl = (code, route) => `${base || location.origin}/index.html#/g/${code}/${route}`;
/** The join link in the QR codes: https://<online server>/j/CODE/<route>?at=<LAN host:port> – a phone with the app opens
 *  it in the app (App Link), a browser is sent on to the game's host; an online game needs no "at". */
export const joinLink = (code, route) => {
  const b = base || location.origin;
  return b === DEFAULT_SERVER ? `${DEFAULT_SERVER}/j/${code}/${route}` : `${DEFAULT_SERVER}/j/${code}/${route}?at=${encodeURIComponent(b.replace(/^https?:\/\//, ''))}`;
};
export const joinUrl = (code, p) => joinLink(code, `p/${p}`);

/** SVG string (black on white, quiet zone 2 modules) or '' if the lib is not loaded yet. */
export function qrSvg(text, px = 180) {
  const lib = typeof window !== 'undefined' && window.qrcode;
  if (!lib) return '';
  const qr = lib(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), q = 2, N = n + 2 * q;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${N} ${N}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${N}" height="${N}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/* "Join with another device": QR codes for both players and the score view – any time during the game (the
 * roll-off step is not the only place). Browsers cannot discover games in the Wi-Fi, so this is their way in. */
const routeUrl = (code, route) => joinLink(code, route);
export async function openJoinSheet(code, names = []) {
  await prepareQr().catch(() => {});
  const items = [['p/0', names[0] || 'Player 1', 'p0'], ['p/1', names[1] || 'Player 2', 'p1'], ['table', 'Score (tablet)', '']];
  sheet({
    title: 'Join with another device',
    cls: 'join-sheet',
    body: `<p class="muted small">Scan with the phone camera (same Wi-Fi): a phone with the app opens the game in the app, any other in the browser. Devices with the app also find the game under "Games nearby".</p>
      <div class="join-grid">${items.map(([route, label, cls]) => `<div class="join-card ${cls}">${qrReady() ? qrSvg(routeUrl(code, route), 200) : ''}
        <div class="join-label${cls ? ' text-' + cls : ''}">${escHtml(label)}</div><div class="join-url xs muted">${escHtml(directUrl(code, route))}</div></div>`).join('')}</div>
      <p class="xs muted">No internet at the table? Type the address under the code into the browser – it is the game's own address in this Wi-Fi.</p>`,
    actions: [{ label: 'Close', kind: 'ghost' }]
  });
}
