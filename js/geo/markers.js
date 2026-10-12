/* ═══════════════════════════════════════════════════════════════════
   QR-Marker (js/geo/markers.js) – Erkennung im Bild und SVG-Erzeugung (SPEC §11).

   Marker-Inhalt: `SB40K|<id>|<size>`  (size = Kantenlänge in Zoll, Dezimalpunkt)

   WICHTIG zur Geometrie: Alle Detektoren (BarcodeDetector, jsQR) liefern die vier Ecken des
   QR-CODES selbst (äußere Kante des Modulrasters, 21 × 21 Module bei Version 1), NICHT die
   Ecken des gedruckten Plättchens. Deshalb ist `size` die Kantenlänge des QR-Codes; der Code
   wird mit einer weißen Ruhezone (MARKER_QUIET = 0.3") und einer dünnen Schnittlinie außen
   gedruckt. Die Schnittlinie dient nur zum Ausschneiden und wird nicht vermessen.

   API
     detectMarkers(source, opts) → Promise<[{ id, size, corners: [[u,v]×4] (TL,TR,BR,BL), text, precise, engine }]>
        source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap | ImageData | Blob
        opts:   { maxDetectPx: 1600, maxCodes: 8, refine: true, all: false, tiles: true, tilePx: 1000, tileOverlap: 350, tileScales: [1, .75, 1.3], onProgress(msg) }
        Reihenfolge: nach id (natürlich sortiert). Fremde QR-Codes nur mit opts.all (size null).
     generateMarkerSvg(id, sizeInch, opts) → SVG-String (benötigt geladene qrcode-Lib: await ensureQrLib())
     markerPayload(id, size) · parsePayload(text) · ensureJsQR() · ensureQrLib() · toCanvas(source)
     drawDetections(ctx2d, markers, scale, opts)  – Ecken/IDs auf ein Canvas zeichnen
   ═══════════════════════════════════════════════════════════════════ */

export const MARKER_PREFIX = 'SB40K';
export const MARKER_QUIET = 0.3;            // Zoll weiße Ruhezone um den Code
export const MARKER_SIZES = [3, 4, 5];
export const MARKER_LABEL_STRIP = 0.22;     // Zoll Beschriftungsstreifen unter der Schnittlinie (wird abgeschnitten)

/* ───────── Vendor-Skripte lazy laden ───────── */
const VENDOR = new URL('../../vendor/', import.meta.url);
const loading = new Map();
export function loadScript(file, globalName) {
  if (typeof window !== 'undefined' && window[globalName]) return Promise.resolve(window[globalName]);
  if (loading.has(file)) return loading.get(file);
  const p = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('Kein DOM'));
    const s = document.createElement('script');
    s.src = new URL(file, VENDOR).href;
    s.async = true;
    s.onload = () => (window[globalName] ? resolve(window[globalName]) : reject(new Error(`${file}: ${globalName} fehlt`)));
    s.onerror = () => reject(new Error(`${file} konnte nicht geladen werden`));
    document.head.appendChild(s);
  });
  loading.set(file, p);
  p.catch(() => loading.delete(file));
  return p;
}
export const ensureJsQR = () => loadScript('jsqr.min.js', 'jsQR');
export const ensureQrLib = () => loadScript('qrcode.min.js', 'qrcode');

/* ───────── Payload ───────── */
export function markerPayload(id, size) {
  const s = Number(size);
  return `${MARKER_PREFIX}|${String(id).trim()}|${Number.isFinite(s) ? String(+s.toFixed(3)) : '4'}`;
}
export function parsePayload(text) {
  if (typeof text !== 'string') return null;
  const m = /^\s*SB40K\|([^|]{1,24})\|([0-9]+(?:\.[0-9]+)?)\s*$/.exec(text);
  if (!m) return null;
  const size = Number(m[2]);
  if (!(size > 0 && size < 100)) return null;
  return { id: m[1].trim(), size };
}
const natural = (a, b) => String(a).localeCompare(String(b), 'de', { numeric: true, sensitivity: 'base' });

/* ───────── Bildquelle → Canvas ───────── */
export async function toCanvas(source) {
  if (!source) throw new Error('Keine Bildquelle');
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) return source;
  if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) return source;
  let w = 0, h = 0, drawable = source;
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    drawable = await createImageBitmap(source);
    w = drawable.width; h = drawable.height;
  } else if (typeof ImageData !== 'undefined' && source instanceof ImageData) {
    const c = document.createElement('canvas');
    c.width = source.width; c.height = source.height;
    c.getContext('2d').putImageData(source, 0, 0);
    return c;
  } else if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    w = source.videoWidth; h = source.videoHeight;
  } else if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    if (!source.complete || !source.naturalWidth) await new Promise((res, rej) => { source.addEventListener('load', res, { once: true }); source.addEventListener('error', () => rej(new Error('Bild konnte nicht geladen werden')), { once: true }); });
    w = source.naturalWidth; h = source.naturalHeight;
  } else {
    w = source.width; h = source.height;
  }
  if (!w || !h) throw new Error('Bildquelle hat keine Größe');
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d', { willReadFrequently: true }).drawImage(drawable, 0, 0, w, h);
  if (drawable !== source && drawable.close) { try { drawable.close(); } catch {} }
  return c;
}

function getImageData(canvas, sx, sy, sw, sh, scale) {
  // Ausschnitt (sx,sy,sw,sh) skaliert um `scale` als ImageData
  const dw = Math.max(1, Math.round(sw * scale)), dh = Math.max(1, Math.round(sh * scale));
  const c = document.createElement('canvas');
  c.width = dw; c.height = dh;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, dw, dh);
  return ctx.getImageData(0, 0, dw, dh);
}

function maskPolygon(img, poly, margin) {
  // Füllt das Polygon (+margin px) im ImageData mit Mittelgrau, damit jsQR den Code nicht erneut findet.
  const { width, height, data } = img;
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const cx = xs.reduce((a, b) => a + b, 0) / 4, cy = ys.reduce((a, b) => a + b, 0) / 4;
  // Polygon vom Schwerpunkt aus um margin aufblasen
  const ex = poly.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; const f = (d + margin) / d; return [cx + (x - cx) * f, cy + (y - cy) * f]; });
  const x0 = Math.max(0, Math.floor(Math.min(...ex.map(p => p[0])))), x1 = Math.min(width - 1, Math.ceil(Math.max(...ex.map(p => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...ex.map(p => p[1])))), y1 = Math.min(height - 1, Math.ceil(Math.max(...ex.map(p => p[1]))));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let inside = false;
      for (let i = 0, j = 3; i < 4; j = i++) {
        const xi = ex[i][0], yi = ex[i][1], xj = ex[j][0], yj = ex[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) { const k = (y * width + x) * 4; data[k] = data[k + 1] = data[k + 2] = 128; }
    }
  }
}

function cornersFromJsQR(loc, scale, ox = 0, oy = 0) {
  const c = p => [p.x / scale + ox, p.y / scale + oy];
  return [c(loc.topLeftCorner), c(loc.topRightCorner), c(loc.bottomRightCorner), c(loc.bottomLeftCorner)];
}

function bbox(corners) {
  const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Ecken eines (grob) gefundenen Codes auf dem Vollbild nachschärfen: jsQR auf dem Ausschnitt. */
async function refine(canvas, jsQR, found) {
  const b = bbox(found.corners);
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  const m = Math.max(16, 0.3 * Math.max(bw, bh));
  const sx = Math.max(0, Math.floor(b.x0 - m)), sy = Math.max(0, Math.floor(b.y0 - m));
  const sw = Math.min(canvas.width - sx, Math.ceil(bw + 2 * m)), sh = Math.min(canvas.height - sy, Math.ceil(bh + 2 * m));
  if (sw < 24 || sh < 24) return found;
  const base = Math.min(1, 1400 / Math.max(sw, sh));
  for (const f of [1, 0.8, 1.25, 0.65]) {
    const scale = base * f;
    const img = getImageData(canvas, sx, sy, sw, sh, scale);
    let r = null;
    try { r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' }); } catch { r = null; }
    if (r && r.data === found.text) return Object.assign({}, found, { corners: cornersFromJsQR(r.location, scale, sx, sy), precise: scale >= 1, engine: found.engine + '+jsqr' });
  }
  return found;
}

/**
 * detectMarkers(source, opts) → Marker-Liste (siehe Kopf).
 */
export async function detectMarkers(source, opts = {}) {
  const maxDetectPx = opts.maxDetectPx || 1600;
  const maxCodes = opts.maxCodes || 8;
  const progress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};
  const canvas = await toCanvas(source);
  const W = canvas.width, H = canvas.height;
  const found = [];            // { id, size, corners, text, precise, engine }
  const seen = new Set();
  const push = (text, corners, engine, precise) => {
    const p = parsePayload(text);
    if (!p && !opts.all) return false;
    const key = p ? p.id : text;
    if (seen.has(key)) return false;
    seen.add(key);
    found.push({ id: key, size: p ? p.size : null, corners, text, precise: !!precise, engine });
    return true;
  };

  let jsQR = null;
  try { jsQR = await ensureJsQR(); } catch (e) { console.warn('jsQR nicht verfügbar', e); }

  // 1) BarcodeDetector (Chrome/Android): findet mehrere Codes in einem Durchgang
  if (typeof BarcodeDetector !== 'undefined' && opts.barcodeDetector !== false) {
    try {
      const formats = BarcodeDetector.getSupportedFormats ? await BarcodeDetector.getSupportedFormats() : ['qr_code'];
      if (formats.includes('qr_code')) {
        progress('BarcodeDetector …');
        const det = new BarcodeDetector({ formats: ['qr_code'] });
        const res = await det.detect(canvas);
        for (const r of res || []) {
          const cp = r.cornerPoints || [];
          if (cp.length !== 4) continue;
          push(r.rawValue, cp.map(p => [p.x, p.y]), 'barcodedetector', false);
        }
      }
    } catch (e) { console.warn('BarcodeDetector fehlgeschlagen', e); }
  }

  // 2) jsQR: ein Code pro Aufruf → gefundenen Code maskieren, bis zu maxCodes Durchläufe.
  //    Erst ein verkleinerter Gesamtdurchlauf (große Marker), dann Vollauflösung in überlappenden Kacheln
  //    (kleine Marker: jsQR braucht ≥ ~6 px je Modul).
  async function scanRegion(sx, sy, sw, sh, scale, label) {
    const img = getImageData(canvas, sx, sy, sw, sh, scale);
    for (let i = 0; i < maxCodes; i++) {
      progress(`jsQR ${label} Durchlauf ${i + 1} …`);
      await new Promise(r => setTimeout(r, 0));            // UI atmen lassen
      let r = null;
      try { r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' }); } catch (e) { console.warn('jsQR', e); }
      if (!r) break;
      const small = cornersFromJsQR(r.location, 1);
      maskPolygon(img, small, 6);
      push(r.data, small.map(p => [p[0] / scale + sx, p[1] / scale + sy]), 'jsqr', scale === 1);
    }
  }
  if (jsQR && (found.length === 0 || opts.jsqr === true)) {
    const scale = Math.min(1, maxDetectPx / Math.max(W, H));
    await scanRegion(0, 0, W, H, scale, 'gesamt');
    if (scale < 1 && opts.tiles !== false) {
      // jsQR gibt null zurück, sobald sein gewähltes Finder-Tripel nicht dekodiert (z. B. gemischt aus zwei Codes)
      // → kleine Kacheln mit Überlappung ≥ Markergröße, je Kachel mehrere Abtastmaßstäbe (Binarizer-Block 8 px).
      const tile = opts.tilePx || 1000, ov = opts.tileOverlap || 350;
      const scales = opts.tileScales || [1, 0.75, 1.3];
      const nx = Math.max(1, Math.ceil((W - ov) / (tile - ov))), ny = Math.max(1, Math.ceil((H - ov) / (tile - ov)));
      for (const sc of scales) {
        for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) {
          const sx = Math.max(0, Math.min(tx * (tile - ov), W - tile)), sy = Math.max(0, Math.min(ty * (tile - ov), H - tile));
          await scanRegion(sx, sy, Math.min(tile, W - sx), Math.min(tile, H - sy), sc, `Kachel ${ty * nx + tx + 1}/${nx * ny} ×${sc}`);
        }
      }
    }
  }

  // 3) Ecken auf dem Vollbild nachschärfen
  if (jsQR && opts.refine !== false) {
    for (let i = 0; i < found.length; i++) {
      if (found[i].precise) continue;
      progress(`Ecken verfeinern ${found[i].id} …`);
      try { found[i] = await refine(canvas, jsQR, found[i]); } catch (e) { console.warn('refine', e); }
    }
  }
  found.sort((a, b) => natural(a.id, b.id));
  return found;
}

/** Erkennungen auf ein 2D-Canvas zeichnen (scale = Canvas-px je Bild-px). */
export function drawDetections(ctx, markers, scale = 1, o = {}) {
  ctx.save();
  ctx.lineWidth = o.lineWidth || 3;
  ctx.font = `${o.fontPx || 16}px sans-serif`;
  ctx.textBaseline = 'top';
  for (const m of markers || []) {
    const color = m.used === false ? (o.badColor || '#EE6E60') : (o.color || '#4FC57F');
    ctx.strokeStyle = color;
    ctx.beginPath();
    m.corners.forEach((p, i) => (i ? ctx.lineTo(p[0] * scale, p[1] * scale) : ctx.moveTo(p[0] * scale, p[1] * scale)));
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(m.corners[0][0] * scale, m.corners[0][1] * scale, (o.lineWidth || 3) * 1.6, 0, Math.PI * 2); ctx.fill();   // TL markieren
    const label = m.label || `${m.id}${m.rms != null && Number.isFinite(m.rms) ? ' ±' + m.rms.toFixed(2) + '"' : ''}`;
    const x = m.corners[0][0] * scale, y = m.corners[0][1] * scale - (o.fontPx || 16) - 4;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(x - 2, y - 2, tw + 6, (o.fontPx || 16) + 4);
    ctx.fillStyle = color;
    ctx.fillText(label, x + 1, y);
  }
  ctx.restore();
}

/* ───────── SVG-Erzeugung (Druck) ───────── */
/**
 * generateMarkerSvg(id, sizeInch, opts) → SVG-String in echter Größe (width/height in `in`).
 *   opts: { quiet: 0.3, cutLine: true, label: true, strip: 0.22, level: 'M' }
 * Aufbau (von innen nach außen): QR-Code (Kantenlänge = size) · weiße Ruhezone (quiet) · Schnittlinie
 * (Außenkante der Linie = Schnittkante) · darunter ein Beschriftungsstreifen, der abgeschnitten wird.
 * Benötigt die geladene Lib `qrcode` (ensureQrLib()).
 */
export function generateMarkerSvg(id, sizeInch, opts = {}) {
  const qrLib = typeof window !== 'undefined' ? window.qrcode : (typeof globalThis !== 'undefined' ? globalThis.qrcode : null);
  if (typeof qrLib !== 'function') throw new Error('qrcode-Bibliothek nicht geladen (ensureQrLib())');
  const size = Number(sizeInch) > 0 ? Number(sizeInch) : 4;
  const quiet = opts.quiet != null ? Number(opts.quiet) : MARKER_QUIET;
  const strip = opts.label === false ? 0 : (opts.strip != null ? Number(opts.strip) : MARKER_LABEL_STRIP);
  const text = markerPayload(id, size);
  let qr = null;
  for (const type of [1, 2, 3]) {
    try { qr = qrLib(type, opts.level || 'M'); qr.addData(text); qr.make(); break; } catch (e) { qr = null; }
  }
  if (!qr) throw new Error('QR-Code zu lang: ' + text);
  const n = qr.getModuleCount();
  const mod = size / n;
  const T = size + 2 * quiet;                      // Schnittkante
  const total = T + strip;
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!qr.isDark(r, c)) { c++; continue; }
      let c2 = c;
      while (c2 < n && qr.isDark(r, c2)) c2++;
      const x = quiet + c * mod, y = quiet + r * mod, w = (c2 - c) * mod;
      d += `M${x.toFixed(4)} ${y.toFixed(4)}h${w.toFixed(4)}v${mod.toFixed(4)}h${(-w).toFixed(4)}z`;
      c = c2;
    }
  }
  const cut = opts.cutLine === false ? '' :
    `<rect x="0.006" y="0.006" width="${(T - 0.012).toFixed(4)}" height="${(T - 0.012).toFixed(4)}" fill="none" stroke="#000" stroke-width="0.012"/>`;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const label = strip > 0
    ? `<text x="${(T / 2).toFixed(3)}" y="${(T + strip * 0.68).toFixed(3)}" font-family="Arial, Helvetica, sans-serif" font-size="${(strip * 0.55).toFixed(3)}" fill="#555" text-anchor="middle">${esc(id)} · QR ${size}" · Schnittkante ${T.toFixed(1)}" · SB40K</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="marker-svg" width="${T.toFixed(3)}in" height="${total.toFixed(3)}in" viewBox="0 0 ${T.toFixed(4)} ${total.toFixed(4)}" data-id="${esc(id)}" data-size="${size}" data-modules="${n}" role="img" aria-label="Marker ${esc(id)}">` +
    `<rect x="0" y="0" width="${T.toFixed(4)}" height="${total.toFixed(4)}" fill="#fff"/>` +
    `<path d="${d}" fill="#000" shape-rendering="crispEdges"/>` + cut + label + `</svg>`;
}
