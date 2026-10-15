/* Learn to play (route #/learn, #/learn/<chapter>/<step>) and the in-game guide card (guideHtml, player view).
 *
 * Content: data/tutorial (own words, English + German). The original core rule sections named in each step (refs) open in
 * a popup – loaded once on the device from Wahapedia (js/rules-orig.js), never shipped with the app.
 * The whole view carries data-no-i18n: the German text comes from the content itself, not from the UI translation.
 */
import { CHAPTERS, PARTS, chapterById, phaseChapter } from '../../data/tutorial/index.js';
import { diagramSvg } from './diagram.js';
import { esc, sheet, toast } from './components.js';
import { getLang } from '../i18n.js';
import { originals, getSection, downloadOriginals, forgetOriginals, CORE_URL } from '../rules-orig.js';

const de = () => getLang() === 'de';
const T = (en, deText) => (de() ? deText : en);
const pick = (o, k) => (o ? (de() && o[k + '_de'] != null ? o[k + '_de'] : o[k]) : '');

// ───────── progress (per device) ─────────
const SEEN = 'br40k.tut.seen';
function seen() { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch { return new Set(); } }
function markSeen(id) { const s = seen(); if (s.has(id)) return; s.add(id); try { localStorage.setItem(SEEN, JSON.stringify([...s])); } catch {} }

// ───────── in-game guide setting ─────────
const GUIDE = 'br40k.guide', GUIDE_OPEN = 'br40k.guideOpen', LEARN_FROM = 'br40k.learnFrom';
/** Game screen the tutorial was opened from via the guide (session only), or ''. */
const learnFrom = () => { try { const h = sessionStorage.getItem(LEARN_FROM) || ''; return /^#\/g\/[A-Za-z0-9]+\//.test(h) ? h : ''; } catch { return ''; } };
export const guideOn = () => { try { return localStorage.getItem(GUIDE) !== '0'; } catch { return true; } };
export function setGuideOn(on) { try { localStorage.setItem(GUIDE, on ? '1' : '0'); } catch {} }
const guideOpen = () => { try { return localStorage.getItem(GUIDE_OPEN) !== '0'; } catch { return true; } };

// ───────── view ─────────
let lastRoot = null, lastCtx = null;
export function render(root, ctx) {
  lastRoot = root; lastCtx = ctx;
  if (!root.__tutBound) { root.__tutBound = true; root.addEventListener('click', onClick); bindSwipe(root); }
  root.setAttribute('data-no-i18n', '');
  const [cid, si] = String(ctx.me || '').split('/');
  const ch = cid ? chapterById(cid) : null;
  if (!ch) { root.innerHTML = listHtml(); return; }
  const i = Math.max(0, Math.min(ch.steps.length - 1, Number(si) || 0));
  root.innerHTML = stepHtml(ch, i);
  markSeen(ch.steps[i].id);
  root.scrollTop = 0; window.scrollTo(0, 0);
}
const rerender = () => { if (lastRoot && lastCtx && lastRoot.isConnected) render(lastRoot, lastCtx); };

function listHtml() {
  const s = seen();
  let n = 0;
  const parts = PARTS.map(p => {
    const chs = CHAPTERS.filter(c => c.part === p.id);
    if (!chs.length) return '';
    return `<div class="tut-part">${esc(pick(p, 'title'))}</div><div class="tut-chapters">${chs.map(c => {
      n++;
      const done = c.steps.filter(x => s.has(x.id)).length;
      return `<a class="tut-ch" href="#/learn/${esc(c.id)}/${done && done < c.steps.length ? c.steps.findIndex(x => !s.has(x.id)) : 0}">
        <span class="n">${n}</span><span class="t"><b>${esc(pick(c, 'title'))}</b><small>${esc(pick(c, 'intro'))}</small></span>
        <span class="${done === c.steps.length ? 'done' : 'muted small'}">${done === c.steps.length ? '✓' : `${done}/${c.steps.length}`}</span></a>`;
    }).join('')}</div>`;
  }).join('');
  return `<div class="tut">
    <header class="tut-head"><a class="btn ghost sm" href="#/">‹ ${T('Menu', 'Menü')}</a><h1 class="title">${T('Learn to play', 'Spielen lernen')}</h1></header>
    <p class="muted">${T('Warhammer 40,000 step by step: first the basic rules, then every phase of a turn. Every step shows the original rule it explains.',
      'Warhammer 40.000 Schritt für Schritt: erst die Grundregeln, dann jede Phase eines Zuges. Zu jedem Schritt gibt es die Originalregel.')}</p>
    ${parts}
    ${origCard()}
  </div>`;
}

function origCard() {
  const o = originals();
  return `<div class="tut-orig-card">
    <p><b>${T('Original rules', 'Originalregeln')}</b> · ${o
      ? T(`loaded on this device (${new Date(o.fetchedAt).toLocaleDateString()}, ${o.sections.length} sections)`, `auf diesem Gerät geladen (${new Date(o.fetchedAt).toLocaleDateString()}, ${o.sections.length} Abschnitte)`)
      : T('not loaded yet', 'noch nicht geladen')}</p>
    <p class="muted small">${T('The app explains the rules in its own words. The original English core rules (free from Games Workshop, as published on Wahapedia) are downloaded once and kept only on this device.',
      'Die App erklärt die Regeln in eigenen Worten. Die englischen Original-Grundregeln (kostenlos von Games Workshop, wie auf Wahapedia veröffentlicht) werden einmal heruntergeladen und nur auf diesem Gerät gespeichert.')}</p>
    <button type="button" class="btn ${o ? 'ghost' : 'primary'} sm" data-tut="download">${o ? T('Update', 'Aktualisieren') : T('Download original rules', 'Originalregeln laden')}</button>
    ${o ? `<button type="button" class="btn ghost sm" data-tut="forget">${T('Remove', 'Entfernen')}</button>` : ''}
  </div>`;
}

function stepHtml(ch, i) {
  const s = ch.steps[i];
  const idx = CHAPTERS.indexOf(ch);
  const next = i < ch.steps.length - 1 ? `#/learn/${ch.id}/${i + 1}` : (CHAPTERS[idx + 1] ? `#/learn/${CHAPTERS[idx + 1].id}/0` : '#/learn');
  const prev = i > 0 ? `#/learn/${ch.id}/${i - 1}` : (CHAPTERS[idx - 1] ? `#/learn/${CHAPTERS[idx - 1].id}/${CHAPTERS[idx - 1].steps.length - 1}` : '#/learn');
  const nextLabel = i < ch.steps.length - 1 ? T('Next', 'Weiter') : (CHAPTERS[idx + 1] ? T('Next chapter', 'Nächstes Kapitel') : T('Done', 'Fertig'));
  const tips = pick(s, 'tips') || [];
  return `<div class="tut">
    <header class="tut-head"><a class="btn ghost sm" href="#/learn">‹ ${T('Chapters', 'Kapitel')}</a><h1 class="title">${esc(pick(ch, 'title'))}</h1></header>
    ${learnFrom() ? `<p><a class="btn ghost sm" href="${esc(learnFrom())}">‹ ${T('Back to the game', 'Zurück zum Spiel')}</a></p>` : ''}
    <article class="tut-step" data-prev="${prev}" data-next="${next}">
      <div class="kicker">${T('Step', 'Schritt')} ${i + 1} / ${ch.steps.length}</div>
      <h2>${esc(pick(s, 'title'))}</h2>
      ${pics(s, 'top')}
      <div class="tut-text">${pick(s, 'text')}</div>
      ${pics(s, 'bottom')}
      ${tips.length ? `<div class="tut-tips"><div class="h">${T('Watch out', 'Darauf achten')}</div><ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul></div>` : ''}
      ${refsHtml(s.refs)}
    </article>
    <nav class="tut-nav">
      <a class="btn ghost" href="${prev}">‹ ${T('Back', 'Zurück')}</a>
      <span class="tut-dots">${ch.steps.map((x, j) => `<i class="${j === i ? 'on' : seen().has(x.id) ? 'seen' : ''}"></i>`).join('')}</span>
      <a class="btn primary" href="${next}">${nextLabel} ›</a>
    </nav>
  </div>`;
}

/** The pictures of a step: diagram (one) or diagrams (several); each above the text unless at: 'bottom'
 *  (in a list, every picture after the first defaults to below the text). */
export function stepPictures(s) { return s.diagrams ? s.diagrams.map((d, i) => [d, d.at || (i ? 'bottom' : 'top')]) : s.diagram ? [[s.diagram, s.diagram.at || 'top']] : []; }
const pics = (s, where) => stepPictures(s).filter(([, at]) => at === where).map(([d]) => diagramSvg(d, de() ? 'de' : 'en')).join('');

function refsHtml(refs) {
  if (!refs || !refs.length) return '';
  const o = originals();
  return `<div class="tut-refs">${refs.map(r => {
    const sec = o && o.sections.find(x => x.num === r);
    return `<button type="button" class="tut-ref" data-tut-ref="${esc(r)}">📖 <b>${esc(r)}</b>${sec ? ' ' + esc(sec.title) : ''}</button>`;
  }).join('')}</div>`;
}

function onClick(e) {
  const b = e.target.closest('[data-tut]');
  if (!b) return;
  if (b.dataset.tut === 'download') { download().then(rerender); }
  if (b.dataset.tut === 'forget') { forgetOriginals(); rerender(); }
}

let busy = null;
function download() {
  if (busy) return busy;
  const kill = toast(T('Downloading the core rules …', 'Lade die Grundregeln …'), 'ok', 30000);
  busy = downloadOriginals()
    .then(o => { kill(); toast(T(`Original rules loaded (${o.sections.length} sections)`, `Originalregeln geladen (${o.sections.length} Abschnitte)`), 'ok'); return o; })
    .catch(err => { kill(); toast((err && err.message) || String(err), 'bad', 7000); return null; })
    .finally(() => { busy = null; });
  return busy;
}

/** Popup with one original section (anywhere in the app: [data-tut-ref="03.03"]). */
export function openOrig(num) {
  const s = getSection(num);
  if (!s) {
    sheet({
      title: T('Original rule', 'Originalregel') + ' ' + num, cls: 'wide',
      body: `<p>${T('The original core rules are not on this device yet. Download them once (about 0.8 MB, needs internet); afterwards they work offline.',
        'Die Original-Grundregeln sind noch nicht auf diesem Gerät. Einmal herunterladen (ca. 0,8 MB, braucht Internet), danach gehen sie offline.')}</p>`,
      actions: [{ label: T('Cancel', 'Abbrechen'), kind: 'ghost' }, { label: T('Download', 'Herunterladen'), kind: 'primary', onClick: () => { download().then(o => { if (o) { rerender(); openOrig(num); } }); } }]
    });
    return;
  }
  sheet({
    title: `${s.num} ${s.title}`, cls: 'wide orig-sheet',
    body: `<div class="orig-sec" data-no-i18n lang="en">${s.html}</div><p class="orig-src">${T('Original text: Warhammer 40,000 Core Rules (Games Workshop), via', 'Originaltext: Warhammer 40.000 Grundregeln (Games Workshop), über')} ${esc(CORE_URL.replace(/^https:\/\//, ''))}</p>`
  });
}
export function installTutorialLinks() {
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-tut-ref]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    openOrig(b.dataset.tutRef);
  }, true);
}

/* swipe left/right on a step = next / back */
function bindSwipe(root) {
  let x0 = null, y0 = null;
  root.addEventListener('touchstart', e => { if (e.touches.length === 1 && e.target.closest('.tut-step')) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } else x0 = null; }, { passive: true });
  root.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    const st = root.querySelector('.tut-step');
    if (st) location.hash = dx < 0 ? st.dataset.next : st.dataset.prev;
  }, { passive: true });
}

/* ───────── in-game guide (player view) ───────── */
/** The checklist of the current phase for this player: active player → game.you, the other → game.opp. */
export function guideHtml(state, me) {
  if (!guideOn() || !state || state.stage !== 'battle') return '';
  const ch = phaseChapter(state.phase);
  if (!ch || !ch.game) return '';
  const own = state.turn === me;
  const items = (own ? ch.game.you : ch.game.opp) || [];
  if (!items.length) return '';
  const li = g => `<li>${pick(g, 'text')}${(g.refs || []).slice(0, 2).map(r => ` <button type="button" class="tut-ref" data-tut-ref="${esc(r)}">${esc(r)}</button>`).join('')}</li>`;
  return `<details class="card tile guide-card" data-no-i18n${guideOpen() ? ' open' : ''} data-guide>
    <summary class="tile-title"><span>🧭 ${T('Guide', 'Guide')} · ${esc(pick(ch, 'title'))}</span><span class="muted xs">${own ? T('your turn', 'dein Zug') : T("opponent's turn", 'Zug des Gegners')}</span></summary>
    <ol class="guide-list">${items.map(li).join('')}</ol>
    <p class="mt"><a class="btn ghost sm" href="#/learn/${esc(ch.id)}/0" data-learn-from>${T('Explain this phase', 'Diese Phase erklären')} ›</a>
      <button type="button" class="btn ghost sm" data-guide-off>${T('Hide guide', 'Guide ausblenden')}</button></p>
  </details>`;
}
/** Wire the guide card inside a container (open state remembered, "hide" switches the guide off). */
export function bindGuide(root, onChange) {
  if (root.__guideBound) return;
  root.__guideBound = true;
  root.addEventListener('toggle', e => { if (e.target.matches && e.target.matches('[data-guide]')) { try { localStorage.setItem(GUIDE_OPEN, e.target.open ? '1' : '0'); } catch {} } }, true);
  root.addEventListener('click', e => {
    // "Explain this phase": remember the game screen, the tutorial offers a way back to it
    if (e.target.closest('[data-learn-from]')) { try { sessionStorage.setItem(LEARN_FROM, location.hash); } catch {} return; }
    if (!e.target.closest('[data-guide-off]')) return;
    setGuideOn(false);
    toast(T('Guide hidden – switch it on again under App & data', 'Guide ausgeblendet – unter App & Daten wieder einschalten'), 'ok', 4000);
    if (onChange) onChange();
  });
}
