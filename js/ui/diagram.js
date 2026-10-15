/* Rule diagrams for the tutorial: a small description (inches, top-left origin, y down) → an SVG string.
 *
 * diagram = {
 *   w, h                      board area in inches (e.g. 12 × 8)
 *   grid: true                1" grid (default true)
 *   caption                   one line below the picture (plain text)
 *   zones:     [{ x, y, w, h, side: 0|1, label }]                                deployment zones / areas
 *   terrain:   [{ x, y, w, h, type: 'ruin'|'woods'|'crater'|'wall'|'area'|'hill', label, poly: [[x,y]…] }]
 *              poly (optional) replaces the rectangle; type 'wall' = a solid wall section (thin rect)
 *   objectives:[{ x, y, label, ring: true }]   40 mm marker; ring = 3" control range drawn around it
 *   rings:     [{ x, y, r, kind: 'engage'|'range'|'coherency'|'aura'|'control', label }]   r measured from the centre
 *   lines:     [{ from: [x,y], to: [x,y], kind: 'los'|'los-blocked'|'measure'|'coherency'|'coherency-bad', label }]
 *   arrows:    [{ from: [x,y], to: [x,y], via: [x,y], kind: 'move'|'advance'|'charge'|'fallback'|'pile'|'consolidate'|'shoot'|'shoot-blocked'|'deepstrike', label }]
 *   models:    [{ x, y, side: 0|1, r, shape: 'round'|'oval'|'rect', rw, rh, rot, label, ghost, mark: 'ok'|'bad'|'shock'|'target'|'cover'|'dead' }]
 *              r = base radius in inches (default 0.63 = 32 mm); oval/rect use rw × rh (full width/height in inches)
 *   notes:     [{ x, y, text, side, anchor: 'start'|'middle'|'end' }]
 * }
 *
 * Other picture types (d.type) – plain HTML, every text field also as <field>_de:
 *   flow:  { type: 'flow', dir: 'down'|'right', items: [{ title, text, kind: 'you'|'opp'|'ok'|'bad'|'warn'|'info' }], caption }
 *          a sequence of boxes with arrows (attack sequence, phase order, "what happens when …")
 *   dice:  { type: 'dice', rows: [{ label, dice: [1..6, …], need: 3, crit: 6, mark: [indexes], note }], caption }
 *          dice faces; with need: ≥ need = success (green), below = fail (grey); crit: ≥ crit gold; mark = highlighted
 *          (e.g. the re-rolled dice); dice values may be strings like '2→5' for a re-roll (shown as 5, marked)
 *   table: { type: 'table', head: ['', 'T 3', …], rows: [['S 4', '3+', …], …], hl: [[row, col], …], caption }
 *   sheet: { type: 'sheet', name, stats: [['M','6"'], ['T','4'], …], weapons: [{ name, range, A, skill, S, AP, D, abilities }],
 *            abilities: ['DEEP STRIKE', …], keywords, callouts: [{ n: 1, text }], marks: { 'T': 1, 'w0.S': 2 } , caption }
 *          a mock datasheet; marks puts the callout number next to a stat (stat name), a weapon field (w<index>.<field>),
 *          an ability (ab<index>), 'name', 'weapon' or 'keywords' – every callout should have its mark on the sheet
 *   compare: { type: 'compare', items: [<diagram>, <diagram>], labels: [{ text, kind: 'ok'|'bad' }] , caption }
 *          two (or three) pictures side by side / stacked on phones, each with a ✓ / ✕ heading
 * Distances in the rules are measured between the closest points of the bases – place models accordingly
 * (two 32 mm bases 2" apart edge to edge: centres 2 + 2 × 0.63 = 3.26" apart).
 */
const S = 30;          // px per inch
const PAD = 8;
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const P = v => (v * S + PAD).toFixed(1);
const L = v => (v * S).toFixed(1);

const SIDE = ['var(--p0)', 'var(--p1)'];
const ARROW = {
  move: { c: 'var(--text)', dash: '' }, advance: { c: '#E8B23C', dash: '6 4' }, charge: { c: '#E8643C', dash: '' },
  fallback: { c: '#B48CFF', dash: '6 4' }, pile: { c: '#F07FA8', dash: '' }, consolidate: { c: '#F07FA8', dash: '6 4' },
  shoot: { c: '#46C8C0', dash: '' }, 'shoot-blocked': { c: '#E05A5A', dash: '4 4' }, deepstrike: { c: '#8E9BA6', dash: '2 4' }
};
const RING = {
  engage: { c: '#E05A5A', dash: '5 4' }, range: { c: '#46C8C0', dash: '5 4' }, coherency: { c: '#7BC86C', dash: '5 4' },
  aura: { c: '#B48CFF', dash: '5 4' }, control: { c: '#E8B23C', dash: '5 4' }
};
const LINE = {
  los: { c: '#7BC86C', dash: '' }, 'los-blocked': { c: '#E05A5A', dash: '5 4' }, measure: { c: 'var(--text)', dash: '2 3' },
  coherency: { c: '#7BC86C', dash: '' }, 'coherency-bad': { c: '#E05A5A', dash: '4 3' }
};
const TERRAIN = {
  ruin: { fill: 'rgba(150,140,120,.28)', stroke: 'rgba(170,160,140,.9)', dash: '' },
  woods: { fill: 'rgba(90,150,80,.28)', stroke: 'rgba(110,170,95,.9)', dash: '6 4' },
  crater: { fill: 'rgba(140,110,80,.25)', stroke: 'rgba(160,130,95,.9)', dash: '3 3' },
  hill: { fill: 'rgba(120,130,90,.25)', stroke: 'rgba(140,150,105,.9)', dash: '' },
  area: { fill: 'rgba(140,150,160,.18)', stroke: 'rgba(160,170,180,.8)', dash: '6 4' },
  wall: { fill: 'rgba(190,180,160,.85)', stroke: 'rgba(210,200,180,1)', dash: '' }
};

let uid = 0;
/** lang 'de': labels/notes/captions use their _de variant when there is one (label_de, text_de, caption_de). */
export function diagramSvg(d, lang = 'en') {
  const tr = (o, k) => (lang === 'de' && o[k + '_de'] != null ? o[k + '_de'] : o[k]);
  if (!d) return '';
  if (d.type && d.type !== 'board') return htmlDiagram(d, tr, lang);
  const id = 'dg' + (++uid);
  const W = d.w * S + PAD * 2, H = d.h * S + PAD * 2;
  const out = [];
  // --dgk: label scale for phones (css/tutorial.css) – a wide board is shrunk more, so its labels grow in board units
  const k = Math.min(1.8, Math.max(1, W / 300)).toFixed(2);
  out.push(`<svg class="dg" viewBox="0 0 ${W} ${H}" style="--dgk:${k}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(tr(d, 'caption') || 'Rules diagram')}">`);
  const markers = Object.entries(ARROW).map(([k, a]) => `<marker id="${id}-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${a.c}"/></marker>`).join('');
  out.push(`<defs>${markers}<pattern id="${id}-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,.12)" stroke-width="2"/></pattern></defs>`);
  out.push(`<rect x="${PAD}" y="${PAD}" width="${L(d.w)}" height="${L(d.h)}" rx="4" class="dg-board"/>`);
  if (d.grid !== false) {
    const g = [];
    for (let x = 1; x < d.w; x++) g.push(`M${P(x)},${P(0)}V${P(d.h)}`);
    for (let y = 1; y < d.h; y++) g.push(`M${P(0)},${P(y)}H${P(d.w)}`);
    out.push(`<path d="${g.join('')}" class="dg-grid"/>`);
  }
  for (const z of d.zones || []) {
    out.push(`<rect x="${P(z.x)}" y="${P(z.y)}" width="${L(z.w)}" height="${L(z.h)}" fill="${SIDE[z.side] || 'var(--muted)'}" fill-opacity=".10" stroke="${SIDE[z.side] || 'var(--muted)'}" stroke-opacity=".5" stroke-dasharray="6 4"/>`);
    if (z.label) out.push(text(z.x + 0.2, z.y + 0.5, tr(z, 'label'), 'dg-zone-l', 'start', SIDE[z.side]));
  }
  for (const t of d.terrain || []) {
    const st = TERRAIN[t.type] || TERRAIN.area;
    const shape = t.poly ? `<polygon points="${t.poly.map(p => P(p[0]) + ',' + P(p[1])).join(' ')}"` : `<rect x="${P(t.x)}" y="${P(t.y)}" width="${L(t.w)}" height="${L(t.h)}" rx="${t.type === 'wall' ? 1 : 3}"`;
    out.push(`${shape} fill="${st.fill}" stroke="${st.stroke}" stroke-width="1.5"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/>`);
    if (t.type === 'ruin' && !t.poly) out.push(`<rect x="${P(t.x)}" y="${P(t.y)}" width="${L(t.w)}" height="${L(t.h)}" fill="url(#${id}-hatch)"/>`);
    if (t.label) {
      const lb = tr(t, 'label');
      const c = t.poly ? t.poly.reduce((a, p) => [a[0] + p[0] / t.poly.length, a[1] + p[1] / t.poly.length], [0, 0]) : [t.x + t.w / 2, t.y + t.h / 2];
      out.push(text(c[0], (t.ly != null ? t.ly : c[1]) + 0.12, lb, 'dg-terrain-l', 'middle'));
    }
  }
  for (const o of d.objectives || []) {
    if (o.ring) out.push(`<circle cx="${P(o.x)}" cy="${P(o.y)}" r="${L(3 + 0.79)}" fill="#E8B23C" fill-opacity=".07" stroke="#E8B23C" stroke-opacity=".7" stroke-dasharray="5 4"/>`);
    out.push(`<circle cx="${P(o.x)}" cy="${P(o.y)}" r="${L(0.79)}" class="dg-obj"/><path d="M${P(o.x - 0.35)},${P(o.y)}H${P(o.x + 0.35)}M${P(o.x)},${P(o.y - 0.35)}V${P(o.y + 0.35)}" class="dg-obj-x"/>`);
    if (o.label) out.push(text(o.x, o.y + 1.25, tr(o, 'label'), 'dg-note', 'middle'));
  }
  for (const r of d.rings || []) {
    const st = RING[r.kind] || RING.range;
    out.push(`<circle cx="${P(r.x)}" cy="${P(r.y)}" r="${L(r.r)}" fill="${st.c}" fill-opacity=".06" stroke="${st.c}" stroke-width="1.5" stroke-dasharray="${st.dash}"/>`);
    if (r.label) out.push(text(r.x, r.y - r.r - 0.15, tr(r, 'label'), 'dg-note', 'middle', st.c));
  }
  for (const l of d.lines || []) {
    const st = LINE[l.kind] || LINE.measure;
    out.push(`<line x1="${P(l.from[0])}" y1="${P(l.from[1])}" x2="${P(l.to[0])}" y2="${P(l.to[1])}" stroke="${st.c}" stroke-width="${l.kind === 'measure' ? 1.4 : 2}"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}${l.kind === 'measure' ? ' class="dg-measure"' : ''}/>`);
    if (l.kind === 'measure') for (const p of [l.from, l.to]) out.push(`<circle cx="${P(p[0])}" cy="${P(p[1])}" r="2.2" fill="var(--text)"/>`);
    if (l.label) { const m = mid(l.from, l.to); out.push(text(m[0], m[1] - 0.2, tr(l, 'label'), 'dg-tag', 'middle', st.c)); }
  }
  for (const m of d.models || []) out.push(model(m, tr));
  for (const a of d.arrows || []) {
    const st = ARROW[a.kind] || ARROW.move;
    const path = a.via ? `M${P(a.from[0])},${P(a.from[1])} Q${P(a.via[0])},${P(a.via[1])} ${P(a.to[0])},${P(a.to[1])}` : `M${P(a.from[0])},${P(a.from[1])} L${P(a.to[0])},${P(a.to[1])}`;
    out.push(`<path d="${path}" fill="none" stroke="${st.c}" stroke-width="2.2"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''} marker-end="url(#${id}-${a.kind in ARROW ? a.kind : 'move'})"/>`);
    if (a.label) { const m = a.via ? mid(mid(a.from, a.via), mid(a.via, a.to)) : mid(a.from, a.to); out.push(text(m[0], m[1] - 0.25, tr(a, 'label'), 'dg-tag', 'middle', st.c)); }
  }
  for (const n of d.notes || []) out.push(text(n.x, n.y, tr(n, 'text'), 'dg-note', n.anchor || 'start', n.side != null ? SIDE[n.side] : null));
  out.push('</svg>');
  return `<figure class="dg-wrap">${out.join('')}${tr(d, 'caption') ? `<figcaption>${esc(tr(d, 'caption'))}</figcaption>` : ''}</figure>`;
}

function model(m, tr) {
  const c = m.side != null ? SIDE[m.side] : 'var(--muted)';
  const op = m.ghost ? ' opacity=".35"' : '';
  const dash = m.ghost ? ' stroke-dasharray="3 3"' : '';
  let s;
  if (m.shape === 'oval' || m.shape === 'rect') {
    const rw = (m.rw || 2) / 2, rh = (m.rh || 1.2) / 2;
    const tr = m.rot ? ` transform="rotate(${m.rot} ${P(m.x)} ${P(m.y)})"` : '';
    s = m.shape === 'oval'
      ? `<ellipse cx="${P(m.x)}" cy="${P(m.y)}" rx="${L(rw)}" ry="${L(rh)}"${tr}`
      : `<rect x="${P(m.x - rw)}" y="${P(m.y - rh)}" width="${L(rw * 2)}" height="${L(rh * 2)}" rx="4"${tr}`;
  } else s = `<circle cx="${P(m.x)}" cy="${P(m.y)}" r="${L(m.r || 0.63)}"`;
  const out = [`${s} fill="${c}" fill-opacity="${m.ghost ? 0.15 : 0.85}" stroke="${c}" stroke-width="2"${dash}${op}/>`];
  if (m.label) out.push(text(m.x, m.y + 0.12, tr(m, 'label'), 'dg-model-l', 'middle'));
  const MK = { ok: ['✓', '#7BC86C'], bad: ['✕', '#E05A5A'], shock: ['!', '#E8B23C'], target: ['◎', '#46C8C0'], cover: ['🛡', '#E8B23C'], dead: ['☠', '#E05A5A'] };
  if (m.mark && MK[m.mark]) {
    const r = m.shape === 'oval' || m.shape === 'rect' ? Math.max(m.rw || 2, m.rh || 1.2) / 2 : (m.r || 0.63);
    out.push(`<circle cx="${P(m.x + r * 0.75)}" cy="${P(m.y - r * 0.75)}" r="8" fill="var(--bg)" stroke="${MK[m.mark][1]}" stroke-width="1.5"/>`);
    out.push(`<text x="${P(m.x + r * 0.75)}" y="${(m.y - r * 0.75) * S + PAD + 4}" text-anchor="middle" class="dg-mark" fill="${MK[m.mark][1]}">${MK[m.mark][0]}</text>`);
  }
  return out.join('');
}
function text(x, y, t, cls, anchor = 'start', color = null) {
  return `<text x="${P(x)}" y="${P(y)}" text-anchor="${anchor}" class="${cls}"${color ? ` fill="${color}"` : ''}>${esc(t)}</text>`;
}
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/* ───────── HTML picture types ───────── */
const KIND = { you: 'var(--p0)', opp: 'var(--p1)', ok: 'var(--ok)', bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--muted)' };
const pip = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
function die(v, cls) {
  const n = Math.max(1, Math.min(6, Number(v) || 1));
  return `<svg class="dg-die ${cls}" viewBox="0 0 100 100" aria-label="${n}"><rect x="5" y="5" width="90" height="90" rx="18"/>${pip[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('')}</svg>`;
}
function htmlDiagram(d, tr, lang) {
  const cap = tr(d, 'caption');
  let body = '';
  if (d.type === 'flow') {
    body = `<div class="dg-flow ${d.dir === 'right' ? 'right' : 'down'}${(d.items || []).length > 3 ? ' many' : ''}">${(d.items || []).map((it, i) => `${i ? '<span class="dg-flow-arrow" aria-hidden="true"></span>' : ''}<div class="dg-flow-box" style="--k:${KIND[it.kind] || KIND.info}">${tr(it, 'title') ? `<b>${esc(tr(it, 'title'))}</b>` : ''}${tr(it, 'text') ? `<span>${esc(tr(it, 'text'))}</span>` : ''}</div>`).join('')}</div>`;
  } else if (d.type === 'dice') {
    body = `<div class="dg-dice">${(d.rows || []).map(r => {
      const dice = (r.dice || []).map((v, i) => {
        const m = /^(\d)\s*(?:→|->)\s*(\d)$/.exec(String(v));
        const val = m ? Number(m[2]) : Number(v);
        let cls = r.need ? (val >= r.need ? 'ok' : 'fail') : '';
        if (r.crit && val >= r.crit) cls = 'crit';
        if (m || (r.mark || []).includes(i)) cls += ' mark';
        return `<span class="dg-die-wrap">${die(val, cls)}${m ? `<small>${m[1]}→</small>` : ''}</span>`;
      }).join('');
      return `<div class="dg-dice-row">${tr(r, 'label') ? `<div class="dg-dice-l">${esc(tr(r, 'label'))}</div>` : ''}<div class="dg-dice-set">${dice}</div>${tr(r, 'note') ? `<div class="dg-dice-n">${esc(tr(r, 'note'))}</div>` : ''}</div>`;
    }).join('')}</div>`;
  } else if (d.type === 'table') {
    const hl = new Set((d.hl || []).map(x => x.join(',')));
    const head = tr(d, 'head') || [];
    const rows = tr(d, 'rows') || [];
    body = `<div class="dg-table-wrap"><table class="dg-table">${head.length ? `<thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map((r, ri) => `<tr>${r.map((c, ci) => ci === 0 ? `<th>${esc(c)}</th>` : `<td class="${hl.has(ri + ',' + ci) ? 'hl' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  } else if (d.type === 'sheet') {
    const marks = d.marks || {};
    const mk = k => (marks[k] != null ? `<i class="dg-co">${esc(marks[k])}</i>` : '');
    const W = ['range', 'A', 'skill', 'S', 'AP', 'D'];
    body = `<div class="dg-sheet"><div class="dg-sheet-name">${esc(d.name || '')}${mk('name')}</div>
      <div class="dg-sheet-stats">${(d.stats || []).map(([k, v]) => `<div><small>${esc(k)}${mk(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>
      ${(d.weapons || []).length ? `<div class="dg-sheet-wwrap"><table class="dg-sheet-w"><thead><tr><th>${esc(tr(d, 'weaponHead') || 'Weapon')}${mk('weapon')}</th><th>Range</th><th>A</th><th>${esc(d.skillHead || 'BS')}</th><th>S</th><th>AP</th><th>D</th></tr></thead><tbody>${d.weapons.map((w, wi) => `<tr><td>${esc(w.name)}${mk('w' + wi + '.name')}${w.abilities ? `<div class="dg-sheet-ab">${esc(w.abilities)}${mk('w' + wi + '.abilities')}</div>` : ''}</td>${W.map(k => `<td>${esc(w[k] == null ? '' : w[k])}${mk('w' + wi + '.' + k)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      ${(d.abilities || []).length ? `<div class="dg-sheet-abl"><small>ABILITIES</small>${d.abilities.map((a, i) => `<span>${esc(a)}${mk('ab' + i)}</span>`).join('')}</div>` : ''}
      ${d.keywords ? `<div class="dg-sheet-kw">KEYWORDS: ${esc(d.keywords)}${mk('keywords')}</div>` : ''}</div>
      ${(d.callouts || []).length ? `<ol class="dg-callouts">${d.callouts.map(c => `<li><i class="dg-co">${esc(c.n)}</i>${esc(tr(c, 'text'))}</li>`).join('')}</ol>` : ''}`;
  } else if (d.type === 'compare') {
    body = `<div class="dg-compare">${(d.items || []).map((x, i) => {
      const l = (d.labels || [])[i] || {};
      return `<div class="dg-cmp-item ${l.kind || ''}">${tr(l, 'text') ? `<div class="dg-cmp-h">${l.kind === 'ok' ? '✓ ' : l.kind === 'bad' ? '✕ ' : ''}${esc(tr(l, 'text'))}</div>` : ''}${diagramSvg(x, lang)}</div>`;
    }).join('')}</div>`;
  }
  return `<figure class="dg-wrap dg-t-${esc(d.type)}">${body}${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`;
}
