/* ═══════════════════════════════════════════════════════════════════
   Großbildschirm (js/ui/desktop.js) – SPEC §7 „Desktop (Großbild, 16:9)“

   render(root, ctx) für #/g/CODE/desktop. Lese-Dashboard für einen Fernseher/Monitor
   neben dem Tisch: links das Spielfeld (oder das neueste Tischfoto), rechts zwei
   Spieler-Panels, oben Runde/Zug/Phase, unten die Zeitleiste.

   Bedienung nur per Tastatur:  F = Vollbild · P = Foto/Spielfeld · Strg+Z = Rückgängig (main.js)

   Das Gerüst wird einmal gebaut (root.__desk), die Karte lebt über alle Renders
   hinweg (nur update()), Textbereiche werden je State-Push per innerHTML ersetzt.
   ═══════════════════════════════════════════════════════════════════ */
import { esc, colorOf } from './components.js';
import { createMap } from './map.js';

const ROUNDS = 5;
const MEASURE_MS = 10000;
const TIMELINE_N = 8;

// Homographie-Helfer nur, wenn das Modul existiert (wird parallel gebaut).
let toCss = null;
import('../geo/homography.js').then(m => { if (m && typeof m.toCss === 'function') toCss = m.toCss; }).catch(() => { toCss = null; });

let current = null;          // aktives Dashboard (für Tastatur/Resize)

/* ───────── Hilfen ───────── */
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isIdx = v => v === 0 || v === 1;
function nameOf(state, p) { const pl = state && state.players && state.players[p]; return (pl && pl.name) || `Spieler ${p + 1}`; }
function timeOf(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function fmtInch(v) {
  const n = Math.round(num(v) * 10) / 10;
  return n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + '"';
}
function signed(v) { const n = num(v); return (n > 0 ? '+' : '') + n; }

/** Art eines Log-Eintrags → { kind, icon, label } */
function logKind(e) {
  const t = String((e && e.type) || '');
  const data = (e && e.data) || {};
  if (t.startsWith('score.')) return { kind: 'score', icon: '★', label: 'Wertung' };
  if (t.startsWith('strat.')) return { kind: 'strat', icon: '⚡', label: 'Stratagem' };
  if (t === 'unit.status' && data.status === 'destroyed') return { kind: 'kill', icon: '☠', label: 'Verlust' };
  if (t === 'unit.place' || t === 'unit.reserve') return { kind: 'move', icon: '➜', label: 'Bewegung' };
  if (t === 'unit.status' || t === 'unit.models') return { kind: 'unit', icon: '●', label: 'Einheit' };
  if (t.startsWith('sec.') || t === 'secondaries.mode') return { kind: 'card', icon: '▯', label: 'Karte' };
  if (t.startsWith('phase.') || t.startsWith('stage.')) return { kind: 'phase', icon: '▶', label: 'Phase' };
  if (t === 'cp.adjust') return { kind: 'cp', icon: 'CP', label: 'CP' };
  if (t.startsWith('objective')) return { kind: 'obj', icon: '◎', label: 'Missionsziel' };
  if (t === 'game.end') return { kind: 'end', icon: '⚑', label: 'Ende' };
  if (t === 'note.add') return { kind: 'note', icon: '✎', label: 'Notiz' };
  return { kind: 'misc', icon: '•', label: 'Ereignis' };
}

function setPlayerColors(state, WH) {
  const app = document.documentElement; // on :root so popups (appended outside #app) get the player colours too
  if (!app || !state || !Array.isArray(state.players)) return;
  state.players.forEach((pl, i) => {
    const c = WH && WH.COLORS && WH.COLORS[num(pl && pl.color)];
    const col = (c && c.d) || colorOf(num(pl && pl.color));
    app.style.setProperty('--p' + i, col);
  });
}

/* ───────── Gerüst ───────── */
function build(root, ctx) {
  const old = root.__desk;
  if (old) teardown(old);
  root.innerHTML = `
    <div class="desk" data-stage="">
      <header class="desk-top"></header>
      <div class="desk-main">
        <div class="desk-left">
          <div class="desk-map-wrap">
            <div class="desk-map"></div>
            <div class="desk-photo hidden">
              <img class="desk-photo-img" alt="Tischfoto" draggable="false">
              <div class="desk-photo-ov hidden"><div class="desk-photo-ovmap"></div></div>
              <div class="desk-photo-cap"></div>
            </div>
            <div class="desk-measure hidden"></div>
          </div>
          <div class="desk-legend"></div>
        </div>
        <aside class="desk-side"></aside>
      </div>
      <footer class="desk-bottom"></footer>
      <div class="desk-over hidden"></div>
    </div>`;
  const el = root.querySelector('.desk');
  const d = {
    code: ctx.code, el, ctx,
    top: el.querySelector('.desk-top'), left: el.querySelector('.desk-left'), side: el.querySelector('.desk-side'),
    bottom: el.querySelector('.desk-bottom'), legend: el.querySelector('.desk-legend'), over: el.querySelector('.desk-over'),
    measureEl: el.querySelector('.desk-measure'),
    mapEl: el.querySelector('.desk-map'),
    map: null,
    net: null, unsubs: [],
    measure: null, measureTimer: null,
    photo: {
      mode: false, latest: null, loaded: false, loading: false, src: '',
      el: el.querySelector('.desk-photo'), img: el.querySelector('.desk-photo-img'),
      ov: el.querySelector('.desk-photo-ov'), ovMapEl: el.querySelector('.desk-photo-ovmap'), ovMap: null,
      cap: el.querySelector('.desk-photo-cap')
    }
  };
  d.map = createMap(d.mapEl, { fill: true, rot: 90, interactive: false, terrain: ctx.data.TERRAIN_LAYOUTS || [] });
  d.photo.img.addEventListener('load', () => layoutPhoto(d));
  d.photo.img.addEventListener('error', () => { d.photo.cap.textContent = 'Foto konnte nicht geladen werden'; });
  root.__desk = d;
  bindOnce(root);
  return d;
}

function teardown(d) {
  try { d.map && d.map.destroy(); } catch {}
  try { d.photo.ovMap && d.photo.ovMap.destroy(); } catch {}
  for (const u of d.unsubs) { try { u(); } catch {} }
  d.unsubs = [];
  if (d.measureTimer) clearTimeout(d.measureTimer);
  if (current === d) current = null;
}

function bindOnce(root) {
  if (!root.__desktopBound) {
    root.__desktopBound = true;
    root.addEventListener('click', e => {
      const b = e.target && e.target.closest && e.target.closest('[data-action]');
      if (!b || !current) return;
      const a = b.dataset.action;
      if (a === 'fullscreen') toggleFullscreen();
      else if (a === 'photo') togglePhoto(current);
      else if (a === 'undo') current.ctx.undo && current.ctx.undo();
    });
  }
  if (!window.__sb40kDesktopKeys) {
    window.__sb40kDesktopKeys = true;
    window.addEventListener('keydown', e => {
      if (!current || document.body.dataset.view !== 'desktop') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = String(e.key || '').toLowerCase();
      if (k === 'f') { e.preventDefault(); toggleFullscreen(); }
      else if (k === 'p') { e.preventDefault(); togglePhoto(current); }
    });
    window.addEventListener('resize', () => { if (current && current.photo.mode) layoutPhoto(current); });
  }
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  } catch (e) { console.warn('Vollbild', e); }
}

/* ───────── Netz: Signale + Fotos ───────── */
function bindNet(d, ctx) {
  const net = ctx.net || null;
  if (d.net === net) return;
  for (const u of d.unsubs) { try { u(); } catch {} }
  d.unsubs = [];
  d.net = net;
  if (!net) return;
  if (typeof net.onSignal === 'function') {
    d.unsubs.push(net.onSignal(sig => {
      if (!sig || typeof sig !== 'object') return;
      const isMeasure = sig.type === 'measure' || (sig.type === 'pointer' && sig.tool === 'measure' && sig.dist != null);
      if (!isMeasure) return;
      const dist = sig.dist != null ? sig.dist : sig.d;
      if (!Number.isFinite(Number(dist))) return;
      showMeasure(d, Number(dist), sig);
    }));
  }
  if (typeof net.onPhoto === 'function') {
    d.unsubs.push(net.onPhoto(ev => {
      if (!ev || typeof ev !== 'object') return;
      const ph = ev.photo;
      const p = d.photo;
      if (ev.kind === 'new' && ph) { p.latest = ph; p.loaded = true; }
      else if (ev.kind === 'meta' && ph) { if (p.latest && p.latest.id === ph.id) p.latest = Object.assign({}, p.latest, ph); else if (!p.latest) p.latest = ph; }
      else if (ev.kind === 'delete') { p.loaded = false; if (p.mode) loadPhotos(d); return; }
      if (p.mode) renderPhoto(d);
    }));
  }
}

function showMeasure(d, dist, sig) {
  d.measure = { dist, by: sig && isIdx(sig.by) ? sig.by : null, at: Date.now() };
  if (d.measureTimer) clearTimeout(d.measureTimer);
  d.measureTimer = setTimeout(() => { d.measure = null; d.measureTimer = null; renderMeasure(d); }, MEASURE_MS);
  renderMeasure(d);
}
function renderMeasure(d) {
  const m = d.measure;
  const el = d.measureEl;
  if (!m) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  const state = d.ctx.state;
  const who = isIdx(m.by) ? `<span class="who p${m.by}">${esc(nameOf(state, m.by))}</span>` : '';
  el.className = 'desk-measure' + (isIdx(m.by) ? ` p${m.by}` : '');
  el.innerHTML = `<span class="lbl">Messung</span><span class="val">${esc(fmtInch(m.dist))}</span>${who}`;
}

async function loadPhotos(d) {
  const net = d.net;
  const p = d.photo;
  if (!net || typeof net.listPhotos !== 'function' || p.loading) return;
  p.loading = true;
  try {
    const list = await net.listPhotos();
    const arr = Array.isArray(list) ? list : [];
    p.latest = arr.reduce((best, x) => (!best || num(x.id) > num(best.id)) ? x : best, null);
    p.loaded = true;
  } catch (e) {
    console.warn('Fotos laden', e);
    p.loaded = true;
  } finally {
    p.loading = false;
    if (p.mode) renderPhoto(d);
  }
}

function togglePhoto(d) {
  const p = d.photo;
  p.mode = !p.mode;
  d.left.classList.toggle('photo', p.mode);
  p.el.classList.toggle('hidden', !p.mode);
  d.mapEl.classList.toggle('hidden', p.mode);
  if (p.mode && !p.loaded) loadPhotos(d);
  renderPhoto(d);
  renderLegend(d);
}

function photoUrl(d, ph) {
  if (!ph) return '';
  if (ph.url) return ph.url;
  const net = d.net;
  return net && typeof net.photoUrl === 'function' ? net.photoUrl(ph.id, ph.file && String(ph.file).endsWith('.png') ? 'png' : 'jpg') : '';
}

function renderPhoto(d) {
  const p = d.photo;
  if (!p.mode) return;
  const ph = p.latest;
  const state = d.ctx.state;
  if (!ph) {
    if (p.src) { p.src = ''; p.img.removeAttribute('src'); }
    p.img.classList.add('hidden');
    p.ov.classList.add('hidden');
    p.cap.innerHTML = p.loading || !p.loaded ? 'Fotos werden geladen …' : 'Noch kein Tischfoto vorhanden – <b>P</b> zurück zum Spielfeld';
    return;
  }
  const url = photoUrl(d, ph);
  p.img.classList.remove('hidden');
  if (url && url !== p.src) { p.src = url; p.img.src = url; }
  const bits = [];
  bits.push(`Foto ${esc(ph.id)}`);
  if (ph.round) bits.push(`Runde ${esc(ph.round)}`);
  if (isIdx(ph.turn)) bits.push(`Zug ${esc(nameOf(state, ph.turn))}`);
  if (ph.ts) bits.push(esc(timeOf(ph.ts)));
  if (isIdx(ph.by)) bits.push(`von ${esc(nameOf(state, ph.by))}`); else if (ph.by === 'camera') bits.push('Deckenkamera');
  const hasH = Array.isArray(ph.H) && ph.H.length === 9;
  bits.push(hasH ? (toCss ? `Overlay kalibriert${ph.rms != null ? ` (± ${esc(fmtInch(ph.rms))})` : ''}` : 'kalibriert') : 'ohne Kalibrierung');
  p.cap.innerHTML = bits.join(' · ');
  layoutPhoto(d);
}

/** Overlay (SVG-Spielfeld) per matrix3d über das angezeigte Foto legen. */
function layoutPhoto(d) {
  const p = d.photo;
  if (!p.mode) return;
  const ph = p.latest;
  const img = p.img;
  const hasH = ph && Array.isArray(ph.H) && ph.H.length === 9 && typeof toCss === 'function';
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!hasH || !nw || !nh) { p.ov.classList.add('hidden'); return; }
  const box = p.el.getBoundingClientRect();
  const cw = box.width, ch = box.height;
  if (!cw || !ch) { p.ov.classList.add('hidden'); return; }
  const scale = Math.min(cw / nw, ch / nh);
  const dw = nw * scale, dh = nh * scale;
  const ox = (cw - dw) / 2, oy = (ch - dh) / 2;
  const w = num(ph.w) || nw, h = num(ph.h) || nh;
  let css = '';
  try { css = toCss(ph.H, w, h, { elem: [44, 60], display: [dw, dh] }); } catch (e) { console.warn('toCss', e); }
  if (!css) { p.ov.classList.add('hidden'); return; }
  p.ov.classList.remove('hidden');
  p.ov.style.left = ox.toFixed(1) + 'px';
  p.ov.style.top = oy.toFixed(1) + 'px';
  p.ov.style.transform = css;
  if (!p.ovMap) {
    p.ovMap = createMap(p.ovMapEl, { fill: true, rot: 0, interactive: false, terrain: d.ctx.data.TERRAIN_LAYOUTS || [] });
  }
  p.ovMap.update(d.ctx.state, d.ctx.derived || {});
}

/* ───────── Kopfzeile ───────── */
function renderTop(d, ctx) {
  const { state } = ctx;
  const derived = ctx.derived || {};
  const WH = ctx.data.WH;
  const stage = state.stage;
  const players = state.players || [];
  let mid = '';
  if (stage === 'setup') {
    const chips = players.map((pl, i) => `<span class="chip sm p${i} ${pl.ready ? 'on' : ''}">${esc(nameOf(state, i))}: ${pl.ready ? 'bereit' : 'noch nicht bereit'}</span>`).join('');
    mid = `<div class="desk-stage"><span class="stage-name">Setup</span><span class="chips">${chips}</span></div>`;
  } else if (stage === 'deploy') {
    const chips = players.map((pl, i) => {
      const units = pl.units || [];
      const placed = units.filter(u => u.pos || (u.reserve && u.reserve !== 'none')).length;
      return `<span class="chip sm p${i}">${esc(nameOf(state, i))}: ${placed}/${units.length} aufgestellt</span>`;
    }).join('');
    const first = isIdx(state.mission && state.mission.first) ? `<span class="muted">Erster Zug: <b class="text-p${state.mission.first}">${esc(nameOf(state, state.mission.first))}</b></span>` : `<span class="muted">Wurf um den ersten Zug steht aus</span>`;
    mid = `<div class="desk-stage"><span class="stage-name">Aufstellung</span><span class="chips">${chips}</span>${first}</div>`;
  } else {
    const active = isIdx(derived.active) ? derived.active : (state.turn === 1 ? 1 : 0);
    const phIdx = derived.phase && Number.isFinite(derived.phase.index) ? derived.phase.index : Math.max(0, (WH.PHASES || []).findIndex(p => p.id === state.phase));
    const segs = (WH.PHASES || []).map((ph, i) => `<span class="${i < phIdx ? 'done' : i === phIdx ? 'cur' : ''}"></span>`).join('');
    const labels = (WH.PHASES || []).map((ph, i) => `<span class="${i === phIdx ? 'cur' : ''}">${esc(ph.name)}</span>`).join('');
    const over = stage === 'over';
    mid = `
      <div class="desk-round"><span class="lbl">Runde</span><span class="val">${esc(num(state.round))}<small>/ ${ROUNDS}</small></span></div>
      <div class="desk-turn p${active}"><span class="dot pulse"></span><span class="lbl">Zug</span><span class="val">${esc(nameOf(state, active))}</span></div>
      <div class="desk-phase p${active}">
        ${over ? `<div class="stage-name text-ok">Schlacht beendet</div>` : `
        <div class="progress lg">${segs}</div>
        <div class="progress-labels">${labels}</div>`}
      </div>`;
  }
  d.top.innerHTML = `
    <div class="desk-code"><span class="lbl">Spiel</span><span class="val">${esc(state.code || ctx.code || '')}</span></div>
    ${mid}
    <div class="desk-keys muted">
      <button class="key" type="button" data-action="fullscreen" title="Vollbild"><kbd>F</kbd> Vollbild</button>
      <button class="key ${d.photo.mode ? 'on' : ''}" type="button" data-action="photo" title="Foto / Spielfeld"><kbd>P</kbd> ${d.photo.mode ? 'Spielfeld' : 'Foto'}</button>
      <button class="key" type="button" data-action="undo" title="Rückgängig"><kbd>Strg+Z</kbd> Rückgängig</button>
    </div>
    <div class="desk-conn ${ctx.online ? 'ok' : 'bad'}" title="${ctx.online ? 'Verbunden' : 'Keine Verbindung'}"><span class="dot ${ctx.online ? 'ok' : 'bad pulse'}"></span><span class="lbl">${ctx.online ? 'Live' : 'Offline'}</span></div>`;
  d.el.dataset.stage = stage || '';
}

/* ───────── Spieler-Panels ───────── */
function capBar(label, used, max) {
  const u = num(used), m = Math.max(1, num(max));
  const pct = Math.max(0, Math.min(100, Math.round(u / m * 100)));
  return `<div class="cap"><span class="cap-l">${esc(label)}</span><span class="cap-bar"><span style="width:${pct}%"></span></span><span class="cap-v">${u}<small>/${m}</small></span></div>`;
}

function condList(conds, cls = '') {
  if (!Array.isArray(conds) || !conds.length) return '';
  return `<ul class="conds ${esc(cls)}">${conds.map(c => {
    const active = !!c.active;
    const vpTxt = c.k === 'choice'
      ? (active && c.choice >= 0 && c.opts && c.opts[c.choice] ? signed(c.opts[c.choice].vp) : (c.max != null ? `bis ${c.max}` : ''))
      : c.k === 'per'
        ? (active ? signed(c.suggest) : `${c.vp != null ? c.vp : ''} je${c.max != null ? `, max. ${c.max}` : ''}`)
        : (active ? signed(c.suggest) : (c.vp != null ? String(c.vp) : ''));
    const scored = num(c.scoredThisTurn) > 0 ? `<span class="badge ok">gebucht ${c.scoredThisTurn}</span>` : '';
    const r = Array.isArray(c.r) && (c.r[0] !== 1 || c.r[1] !== 5) ? ` R${c.r[0]}${c.r[1] !== c.r[0] ? '–' + c.r[1] : ''}` : '';
    return `<li class="cond ${active ? 'active' : ''} ${c.sub ? 'sub' : ''}">
      <span class="cond-vp">${esc(vpTxt)}</span>
      <span class="cond-t">${esc(c.text)}${scored}</span>
      <span class="cond-w">${esc(c.whenLabel || c.when || '')}${esc(r)}</span>
    </li>`;
  }).join('')}</ul>`;
}

function renderPanel(ctx, p) {
  const { state } = ctx;
  const derived = ctx.derived || {};
  const WH = ctx.data.WH;
  const pl = state.players[p] || {};
  const active = isIdx(derived.active) ? derived.active : (state.turn === 1 ? 1 : 0);
  const inBattle = state.stage === 'battle';
  const isActive = (inBattle || state.stage === 'over') && active === p;
  const vp = (derived.vp && derived.vp[p]) || { primary: num(pl.vp && pl.vp.primary), secondary: num(pl.vp && pl.vp.secondary), bonus: num(pl.vp && pl.vp.bonus) };
  const total = vp.total != null ? vp.total : num(vp.primary) + num(vp.secondary) + num(vp.bonus);
  const cp = derived.cp ? num(derived.cp[p]) : num(pl.cp);
  const sc = (derived.scoring && derived.scoring[p]) || { primary: { name: '–', conds: [] }, secondaries: [], caps: null };
  const caps = sc.caps || null;
  const counts = (derived.counts && derived.counts[p]) || { objs: 0, ids: [] };
  const army = (derived.armyRules && derived.armyRules[p]) || { faction: null, detachments: [] };
  const facName = army.faction ? army.faction.name : (pl.faction || 'Keine Fraktion');
  const dets = (army.detachments || []).map(x => x.name).filter(Boolean);
  const units = pl.units || [];
  const alive = units.filter(u => u.status !== 'destroyed');
  const dead = units.length - alive.length;
  const reserve = alive.filter(u => !u.pos && u.reserve && u.reserve !== 'none').length;
  const shocked = alive.filter(u => u.status === 'shocked').length;
  const modelsNow = alive.reduce((a, u) => a + num(u.models), 0);
  const modelsStart = units.reduce((a, u) => a + num(u.modelsStart != null ? u.modelsStart : u.models), 0);
  const sec = pl.secondaries || {};
  const scores = (state.scores || []).filter(s => s.player === p);
  const cardVp = id => scores.filter(s => s.src === 'secondary' && s.card === id).reduce((a, s) => a + num(s.vp), 0);
  const objs = state.objectives || [];
  const prim = sc.primary || { name: '–', conds: [] };
  const primActive = (prim.conds || []).filter(c => c.active);
  const primSuggest = primActive.reduce((a, c) => a + num(c.suggest), 0);
  const dispo = state.mission && state.mission.dispositions ? (WH.DISPOSITIONS || []).find(x => x.id === state.mission.dispositions[p]) : null;

  const secHead = sec.mode === 'fixed'
    ? `<span class="muted">Fixed</span>`
    : `<span class="muted">Tactical · Hand ${num(sec.hand && sec.hand.length)} · Deck ${num(sec.deck && sec.deck.length)} · Erfüllt ${num(sec.achieved && sec.achieved.length)}${num(sec.toDraw) > 0 ? ` · <b class="text-warn">${num(sec.toDraw)} ziehen</b>` : ''}</span>`;
  const secCards = (sc.secondaries || []).map(c => {
    const act = (c.conds || []).filter(x => x.active);
    const sug = act.reduce((a, x) => a + num(x.suggest), 0);
    const got = cardVp(c.card);
    return `<li class="seccard ${act.length ? 'active' : ''}">
      <span class="sec-name">${esc(c.name)}</span>
      <span class="sec-vp">${got} SP${c.fixed ? `<small>/${caps ? caps.fixedCard : 20}</small>` : ''}</span>
      ${act.length ? `<span class="sec-sug">${esc(signed(sug))}</span>` : ''}
    </li>`;
  }).join('');
  const secEmpty = !(sc.secondaries || []).length ? `<li class="seccard muted">${sec.mode === 'fixed' ? 'Keine Fixed-Karten gewählt' : 'Keine Karten auf der Hand'}</li>` : '';

  const objChips = (counts.ids || []).map(id => {
    const o = objs.find(x => x.id === id) || {};
    const home = o.home === p ? ' ⌂' : o.home === 1 - p ? ' ⚑' : '';
    return `<span class="objchip p${p}">${esc(String(id).toUpperCase())}${esc(home)}</span>`;
  }).join('');

  const res = (pl.resources || []).map(r => `<span class="reschip"><span class="r-n">${esc(r.name)}</span><span class="r-v">${num(r.value)}${r.max != null ? `<small>/${esc(r.max)}</small>` : ''}</span></span>`).join('');

  return `
    <section class="pnl p${p} ${isActive ? 'active' : ''}">
      <header class="pnl-head">
        <span class="dot ${isActive ? 'pulse' : ''}"></span>
        <h2 class="pnl-name">${esc(nameOf(state, p))}</h2>
        ${isActive ? `<span class="badge p${p}">Am Zug</span>` : ''}
        ${state.stage === 'setup' ? `<span class="badge ${pl.ready ? 'ok' : ''}">${pl.ready ? 'Bereit' : 'Setup offen'}</span>` : ''}
        <span class="pnl-army">${esc(facName)}${dets.length ? ` · ${esc(dets.join(' · '))}` : ''}${dispo ? ` · <span class="muted">${esc(dispo.name)}</span>` : ''}</span>
      </header>
      <div class="pnl-kpis">
        <div class="kpi"><b class="${cp <= 0 ? 'text-bad' : ''}">${cp}</b><small>CP</small></div>
        <div class="kpi vp"><b>${total}</b><small>SP gesamt</small></div>
        <div class="vp-split">
          <span><b>${num(vp.primary)}</b><small>Primär</small></span>
          <span><b>${num(vp.secondary)}</b><small>Sekundär</small></span>
          <span><b>${num(vp.bonus)}</b><small>Bonus</small></span>
        </div>
        ${caps ? `<div class="caps">
          ${capBar('Primär R', caps.used.primaryRound, caps.primaryRound)}${capBar('Primär S', caps.used.primaryBattle, caps.primaryBattle)}
          ${capBar('Sek. R', caps.used.secRound, caps.secRound)}${capBar('Sek. S', caps.used.secBattle, caps.secBattle)}
        </div>` : ''}
      </div>
      <div class="pnl-body">
        <div class="pnl-col">
          <div class="blk">
            <div class="blk-h"><span class="blk-t">Primär</span><span class="blk-n">${esc(prim.name || '–')}</span>${primActive.length ? `<span class="badge warn">jetzt ${esc(signed(primSuggest))} SP</span>` : ''}</div>
            ${condList(prim.conds, 'prim')}
          </div>
          <div class="blk">
            <div class="blk-h"><span class="blk-t">Sekundär</span>${secHead}</div>
            <ul class="seccards">${secCards}${secEmpty}</ul>
          </div>
        </div>
        <div class="pnl-col">
          <div class="blk">
            <div class="blk-h"><span class="blk-t">Missionsziele</span><span class="blk-big">${num(counts.objs)}</span><span class="muted">von ${objs.length}</span></div>
            <div class="objchips">${objChips || '<span class="muted">keins kontrolliert</span>'}</div>
          </div>
          <div class="blk">
            <div class="blk-h"><span class="blk-t">Einheiten</span><span class="blk-big">${alive.length}</span><span class="muted">von ${units.length}</span></div>
            <div class="unitline">
              <span class="${dead ? 'text-bad' : 'muted'}">☠ ${dead} vernichtet</span>
              <span class="${shocked ? 'text-warn' : 'muted'}">${shocked} geschockt</span>
              <span class="muted">${reserve} Reserve</span>
              <span class="muted">Modelle ${modelsNow}/${modelsStart}</span>
            </div>
          </div>
          ${res ? `<div class="blk"><div class="blk-h"><span class="blk-t">Ressourcen</span></div><div class="reschips">${res}</div></div>` : ''}
        </div>
      </div>
    </section>`;
}

function renderSide(d, ctx) {
  d.side.innerHTML = renderPanel(ctx, 0) + renderPanel(ctx, 1);
  fitSide(d);
}

/** Auto-Fit: Panel-Inhalt kürzen/verkleinern, bis keine Spalte mehr überläuft (Stufen 1–4, siehe desktop.css). */
function fitSide(d) {
  const side = d.side;
  const overflows = () => Array.from(side.querySelectorAll('.pnl-col')).some(c => c.scrollHeight > c.clientHeight + 1);
  let n = 0;
  side.dataset.fit = '0';
  while (n < 4 && overflows()) { n += 1; side.dataset.fit = String(n); }
}

/* ───────── Legende + Messung ───────── */
function renderLegend(d) {
  const ctx = d.ctx;
  const state = ctx.state;
  const WH = ctx.data.WH;
  const att = state.mission && state.mission.attacker === 1 ? 1 : 0;
  const dep = state.mission && state.mission.deployment;
  const terrain = state.mission && state.mission.terrainLayout ? (ctx.data.TERRAIN_LAYOUTS || []).find(t => t.id === state.mission.terrainLayout) : null;
  const twist = state.mission && state.mission.twist ? (WH.TWISTS || []).find(t => t.id === state.mission.twist) : null;
  const parts = [
    `<span class="lg p0"><i class="sw"></i>${esc(nameOf(state, 0))}</span>`,
    `<span class="lg p1"><i class="sw"></i>${esc(nameOf(state, 1))}</span>`,
    `<span class="lg"><i class="sw none"></i>niemand</span>`,
    `<span class="lg">⌂ Heimziel</span>`,
    `<span class="lg"><i class="ring"></i>Battle-shocked</span>`
  ];
  if (d.photo.mode) parts.push(`<span class="lg muted">Foto: Draufsicht der Kamera</span>`);
  else parts.push(`<span class="lg muted">Angreiferkante (${esc(nameOf(state, att))}) rechts</span>`);
  const mis = [dep ? esc(dep) : '', twist ? 'Twist: ' + esc(twist.name || twist.id) : '', terrain ? esc(terrain.name) : ''].filter(Boolean).join(' · ');
  d.legend.innerHTML = `<div class="legend-l">${parts.join('')}</div><div class="legend-r muted">${mis}</div>`;
  renderMeasure(d);
}

/* ───────── Zeitleiste + Wertungsbanner ───────── */
function renderBottom(d, ctx) {
  const { state } = ctx;
  const log = Array.isArray(state.log) ? state.log.slice(-TIMELINE_N) : [];
  const items = log.map(e => {
    const k = logKind(e);
    const p = isIdx(e.player) ? e.player : null;
    const where = state.stage === 'battle' || state.stage === 'over' ? `R${num(e.round)} · ${esc(timeOf(e.ts))}` : esc(timeOf(e.ts));
    return `<div class="tl ${k.kind} ${p != null ? 'p' + p : ''}">
      <div class="tl-h"><span class="tl-i" aria-hidden="true">${k.icon}</span><span class="tl-k">${esc(k.label)}</span><span class="tl-w">${where}</span></div>
      <div class="tl-t">${esc(e.text)}</div>
    </div>`;
  }).join('');
  let banner = '';
  const pend = state.pending;
  if (pend && pend.kind === 'score') {
    const its = Array.isArray(pend.items) ? pend.items : [];
    const sum = its.reduce((a, it) => a + num(it.vp), 0);
    const whenTxt = pend.when === 'cmd' ? 'Ende Kommandophase' : pend.when === 'end' ? 'Schlachtende' : 'Zugende';
    banner = `<div class="pend p${isIdx(pend.player) ? pend.player : 0}">
      <span class="pend-i">★</span>
      <div class="pend-b">
        <div class="pend-t">Wertung von ${esc(nameOf(state, pend.player))} offen …</div>
        <div class="pend-s">${esc(whenTxt)} · ${its.length} ${its.length === 1 ? 'Vorschlag' : 'Vorschläge'} · <b>${esc(signed(sum))} SP</b> – bitte am Handy bestätigen</div>
      </div>
    </div>`;
  }
  d.bottom.innerHTML = `${banner}<div class="timeline ${banner ? 'with-pend' : ''}">${items || '<div class="muted tl-empty">Noch keine Ereignisse</div>'}</div>`;
  const tl = d.bottom.querySelector('.timeline');
  if (tl) tl.scrollLeft = tl.scrollWidth;
}

/* ───────── Endstand ───────── */
function roundCells(state, p) {
  const sc = (state.scores || []).filter(s => s.player === p);
  const sum = arr => arr.reduce((a, s) => a + num(s.vp), 0);
  const rounds = [];
  for (let r = 1; r <= ROUNDS; r++) {
    const inR = sc.filter(s => s.round === r && s.when !== 'end' && s.src !== 'bonus');
    rounds.push({ pri: sum(inR.filter(s => s.src === 'primary')), sec: sum(inR.filter(s => s.src === 'secondary')) });
  }
  const end = sc.filter(s => s.when === 'end' && s.src !== 'bonus');
  return { rounds, end: { pri: sum(end.filter(s => s.src === 'primary')), sec: sum(end.filter(s => s.src === 'secondary')) }, bonus: sum(sc.filter(s => s.src === 'bonus')) };
}

function renderOver(d, ctx) {
  const { state } = ctx;
  const derived = ctx.derived || {};
  if (state.stage !== 'over') { d.over.classList.add('hidden'); d.over.innerHTML = ''; return; }
  const WH = ctx.data.WH;
  const vp = [0, 1].map(p => (derived.vp && derived.vp[p]) || { primary: 0, secondary: 0, bonus: 0, total: 0 });
  const tot = p => (vp[p].total != null ? vp[p].total : num(vp[p].primary) + num(vp[p].secondary) + num(vp[p].bonus));
  const t0 = tot(0), t1 = tot(1);
  const winner = t0 === t1 ? null : (t0 > t1 ? 0 : 1);
  const bonusBooked = [0, 1].map(p => (state.scores || []).some(s => s.player === p && s.src === 'bonus'));
  const cells = [0, 1].map(p => roundCells(state, p));
  const kills = Array.isArray(state.kills) ? state.kills : [];
  const killList = p => {
    const ks = kills.filter(k => k.player === p);
    if (!ks.length) return '<li class="muted">keine</li>';
    return ks.map(k => {
      const tags = Array.isArray(k.tags) && k.tags.length ? ` <small class="muted">${esc(k.tags.map(t => { const def = (WH.KILL_TAGS || []).find(x => x.id === t); return def ? def.short : t; }).join(', '))}</small>` : '';
      return `<li><span class="muted">R${num(k.round)}</span> ${esc(k.unitName || k.unitId || '?')}${tags}</li>`;
    }).join('');
  };
  const head = winner == null
    ? `<div class="over-title">Unentschieden</div><div class="over-sub">${t0} : ${t1} Siegpunkte</div>`
    : `<div class="over-title text-p${winner}">${esc(nameOf(state, winner))} gewinnt</div><div class="over-sub">${t0} : ${t1} Siegpunkte · ${Math.abs(t0 - t1)} SP Vorsprung</div>`;
  const table = `
    <table class="over-table">
      <thead><tr><th></th>${Array.from({ length: ROUNDS }, (_, i) => `<th>R${i + 1}</th>`).join('')}<th>Ende</th><th>Bonus</th><th>Primär</th><th>Sekundär</th><th class="tot">Gesamt</th></tr></thead>
      <tbody>${[0, 1].map(p => `
        <tr class="p${p} ${winner === p ? 'win' : ''}">
          <th><span class="dot"></span>${esc(nameOf(state, p))}</th>
          ${cells[p].rounds.map(c => `<td><b>${c.pri + c.sec}</b><small>${c.pri} + ${c.sec}</small></td>`).join('')}
          <td><b>${cells[p].end.pri + cells[p].end.sec}</b><small>${cells[p].end.pri} + ${cells[p].end.sec}</small></td>
          <td><b>${cells[p].bonus}</b><small>${bonusBooked[p] ? 'Battle Ready' : '–'}</small></td>
          <td><b>${num(vp[p].primary)}</b></td>
          <td><b>${num(vp[p].secondary)}</b></td>
          <td class="tot"><b>${tot(p)}</b></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  const ready = [0, 1].map(p => `<span class="chip sm p${p} ${bonusBooked[p] ? 'on' : ''}">${esc(nameOf(state, p))}: Battle Ready ${bonusBooked[p] ? '+10 SP' : 'nicht gebucht'}</span>`).join('');
  d.over.classList.remove('hidden');
  d.over.innerHTML = `
    <div class="over-card">
      ${head}
      <div class="over-totals">
        ${[0, 1].map(p => `<div class="over-p p${p} ${winner === p ? 'win' : ''}">
          <div class="over-n">${esc(nameOf(state, p))}</div>
          <div class="over-v">${tot(p)}</div>
          <div class="over-s">Primär ${num(vp[p].primary)} · Sekundär ${num(vp[p].secondary)} · Bonus ${num(vp[p].bonus)}</div>
        </div>`).join('<div class="over-vs">:</div>')}
      </div>
      ${table}
      <div class="over-ready">${ready}${bonusBooked.every(Boolean) ? '' : `<span class="muted">Battle Ready wird über „Spiel beenden“ am Handy gebucht.</span>`}</div>
      <div class="over-kills">
        ${[0, 1].map(p => `<div class="over-k p${p}"><div class="blk-h"><span class="blk-t">Vernichtet von ${esc(nameOf(state, p))}</span><span class="blk-big">${kills.filter(k => k.player === p).length}</span></div><ul>${killList(p)}</ul></div>`).join('')}
      </div>
      <div class="over-hint muted">Rückgängig: <kbd>Strg+Z</kbd> · Vollbild: <kbd>F</kbd></div>
    </div>`;
}

/* ───────── Einstieg ───────── */
export function render(root, ctx) {
  const state = ctx && ctx.state;
  if (!state) {
    root.innerHTML = `<div class="card center muted"><div class="title">Großbildschirm</div><p>Kein Spielzustand.</p><p><a class="btn ghost" href="#/">Zur Lobby</a></p></div>`;
    return;
  }
  setPlayerColors(state, ctx.data && ctx.data.WH);
  let d = root.__desk;
  if (!d || d.code !== ctx.code || !d.el.isConnected) d = build(root, ctx);
  d.ctx = ctx;
  current = d;
  bindNet(d, ctx);
  renderTop(d, ctx);
  renderSide(d, ctx);
  renderBottom(d, ctx);
  renderLegend(d);
  renderOver(d, ctx);
  try { d.map.update(state, ctx.derived || {}); } catch (e) { console.error('Karte', e); }
  if (d.photo.mode) {
    renderPhoto(d);
    if (d.photo.ovMap) { try { d.photo.ovMap.update(state, ctx.derived || {}); } catch (e) { console.error('Overlay', e); } }
  }
}
