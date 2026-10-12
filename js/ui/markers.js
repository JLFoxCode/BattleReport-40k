/* ═══════════════════════════════════════════════════════════════════
   Druckseite QR-Marker (js/ui/markers.js) – Route #/print/markers (SPEC §11)

   Druckt Marker in ECHTER Größe (CSS-Zoll). Der QR-Code selbst hat die gewählte Kantenlänge
   (3" / 4" / 5"), außen 0,3" weiße Ruhezone und eine dünne Schnittlinie. Vermessen wird der
   QR-Code (seine 4 Ecken), nicht die Schnittlinie – siehe js/geo/markers.js.
   ═══════════════════════════════════════════════════════════════════ */
import { esc, toast } from './components.js';
import { ensureQrLib, generateMarkerSvg, MARKER_SIZES, MARKER_QUIET } from '../geo/markers.js';

const LS = 'sb40k.markers.print';
const DEFAULTS = { size: 4, count: 6, prefix: 'M', start: 1 };

function loadOpts() {
  try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(LS) || '{}')); } catch { return { ...DEFAULTS }; }
}
function saveOpts(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch {} }

export function render(root, ctx) {
  const o = loadOpts();
  root.innerHTML = `
    <div class="markers-page">
      <div class="topbar no-print">
        <a class="btn ghost icon" href="#/" aria-label="Zur Lobby">←</a>
        <span class="title">QR-Marker drucken</span>
        <span class="spacer"></span>
        <button class="btn primary" data-action="print">Drucken</button>
      </div>
      <div class="wrap">
        <div class="card no-print markers-controls">
          <div class="row top">
            <div class="field">
              <label>Kantenlänge QR-Code</label>
              <div class="chips" data-group="size">
                ${MARKER_SIZES.map(s => `<button class="chip${+o.size === s ? ' on' : ''}" type="button" data-size="${s}">${s}"</button>`).join('')}
              </div>
            </div>
            <div class="field">
              <label>Anzahl</label>
              <div class="stepper"><button type="button" data-action="count" data-d="-1">−</button><span class="stepper-value" data-count>${o.count}</span><button type="button" data-action="count" data-d="1">+</button></div>
            </div>
            <div class="field" style="max-width:120px">
              <label>Präfix</label>
              <input type="text" name="prefix" value="${esc(o.prefix)}" maxlength="6" autocomplete="off">
            </div>
            <div class="field" style="max-width:120px">
              <label>Erste Nr.</label>
              <input type="number" name="start" value="${esc(o.start)}" min="1" max="999">
            </div>
          </div>
          <div class="card flat mt markers-hint">
            <b>Drucken:</b> Auf <b>100 %</b> drucken (keine Seitenanpassung / „An Seite anpassen“ aus), auf stabile Pappe oder
            Acryl kleben, entlang der Schnittlinie schneiden. Die Marker müssen flach auf der Spielfläche liegen.
            Druckmaßstab prüfen: das Lineal unten muss genau <b>5 Zoll = 12,7 cm</b> lang sein.<br>
            <span class="muted">Vermessen wird der QR-Code selbst (<span data-size-label>${esc(String(o.size))}"</span> Kante); die Ruhezone (${String(MARKER_QUIET).replace('.', ',')}") und die Schnittlinie sind nur Rand.
            Inhalt: <code>SB40K|&lt;id&gt;|&lt;Zoll&gt;</code>, QR-Version 1 (21 Module), Fehlerkorrektur M.</span>
          </div>
        </div>
        <div class="markers-sheet" data-sheet aria-live="polite">
          <div class="card center muted">Marker werden erzeugt …</div>
        </div>
        <div class="markers-ruler-wrap">
          <div class="markers-ruler" aria-label="Kontroll-Lineal 5 Zoll">
            ${[0, 1, 2, 3, 4, 5].map(i => `<span class="tick" style="left:${i}in"><i></i><b>${i}"</b></span>`).join('')}
            <span class="bar"></span>
            <span class="caption">Kontroll-Lineal: 5 Zoll = 12,7 cm bei 100 % Druck</span>
          </div>
        </div>
      </div>
    </div>`;

  const sheet = root.querySelector('[data-sheet]');
  let seq = 0;

  async function build() {
    const my = ++seq;
    saveOpts(o);
    try {
      await ensureQrLib();
    } catch (e) {
      sheet.innerHTML = `<div class="card bad"><div class="title">QR-Bibliothek fehlt</div><p>${esc(e.message)}</p></div>`;
      return;
    }
    if (my !== seq) return;
    const n = Math.max(1, Math.min(24, Number(o.count) || 6));
    const items = [];
    for (let i = 0; i < n; i++) {
      const id = `${o.prefix || 'M'}${(Number(o.start) || 1) + i}`;
      try {
        items.push(`<div class="marker"><div class="marker-svg-wrap">${generateMarkerSvg(id, o.size)}</div></div>`);
      } catch (e) {
        items.push(`<div class="marker"><div class="card bad">${esc(e.message)}</div></div>`);
      }
    }
    sheet.innerHTML = items.join('');
    sheet.dataset.size = String(o.size);
  }

  root.addEventListener('click', e => {
    const t = e.target.closest('[data-action], [data-size]');
    if (!t) return;
    if (t.dataset.size) {
      o.size = Number(t.dataset.size);
      root.querySelectorAll('[data-size]').forEach(c => c.classList.toggle('on', c === t));
      const lbl = root.querySelector('[data-size-label]'); if (lbl) lbl.textContent = o.size + '"';
      build();
      return;
    }
    if (t.dataset.action === 'count') {
      o.count = Math.max(1, Math.min(24, (Number(o.count) || 6) + Number(t.dataset.d)));
      root.querySelector('[data-count]').textContent = o.count;
      build();
      return;
    }
    if (t.dataset.action === 'print') {
      try { window.print(); } catch (err) { toast('Drucken nicht möglich: ' + err.message, 'bad'); }
    }
  });
  root.querySelector('input[name=prefix]').addEventListener('change', e => { o.prefix = (e.target.value || 'M').replace(/[|\s]/g, '').slice(0, 6) || 'M'; e.target.value = o.prefix; build(); });
  root.querySelector('input[name=start]').addEventListener('change', e => { o.start = Math.max(1, Math.min(999, Number(e.target.value) || 1)); e.target.value = o.start; build(); });

  build();
}
