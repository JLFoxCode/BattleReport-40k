/* Kleine UI-Helfer (SPEC §7): esc, h, btn, chip, badge, sheet, confirmSheet, toast, colorOf.
 * Alle Funktionen liefern HTML-Strings (außer sheet/confirmSheet/toast, die DOM anlegen).
 */
import { WH } from '../../data/rules.js';

export function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Markiert einen String als bereits sicheres HTML (für h``). */
export function raw(html) { return { __html: String(html == null ? '' : html) }; }

/** Tagged Template: h`<b>${name}</b>` – Interpolationen werden escaped, außer raw()/Arrays von raw(). */
export function h(strings, ...vals) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < vals.length) out += part(vals[i]);
  }
  return out;
  function part(v) {
    if (v == null || v === false) return '';
    if (Array.isArray(v)) return v.map(part).join('');
    if (typeof v === 'object' && '__html' in v) return v.__html;
    return esc(v);
  }
}

/** Attribut-String aus Objekt: { 'data-x': 1, disabled: true, hidden: false } → ' data-x="1" disabled' */
export function attrs(obj = {}) {
  return Object.entries(obj).map(([k, v]) => {
    if (v === false || v == null) return '';
    if (v === true) return ' ' + k;
    return ` ${k}="${esc(v)}"`;
  }).join('');
}

/**
 * btn({ label, kind: 'primary'|'ghost'|'danger'|'', cta, small, icon, action, data, disabled, cls, title, type })
 * Events: data-action="<action>" (+ weitere data-*), per Delegation im Modul abfangen.
 */
export function btn(o = {}) {
  if (typeof o === 'string') o = { label: o };
  const cls = ['btn', o.kind || '', o.cta ? 'cta' : '', o.small ? 'sm' : '', o.icon && !o.label && !o.html ? 'icon' : '', o.cls || ''].filter(Boolean).join(' ');
  const a = { class: cls, type: o.type || 'button', disabled: !!o.disabled, title: o.title || null };
  if (o.action) a['data-action'] = o.action;
  if (o.data) for (const [k, v] of Object.entries(o.data)) a['data-' + k] = v;
  const icon = o.icon ? `<span class="icon" aria-hidden="true">${o.rawIcon ? o.icon : esc(o.icon)}</span>` : '';
  return `<button${attrs(a)}>${icon}${o.html ? o.html : esc(o.label)}</button>`;
}

/** chip({ label, color, on, action, data, cls }) – color: CSS-Farbe oder Spielerindex (Zahl). */
export function chip(o = {}) {
  if (typeof o === 'string') o = { label: o };
  const cls = ['chip', o.on ? 'on' : '', o.kind || '', o.cls || ''].filter(Boolean).join(' ');
  const a = { class: cls };
  const color = typeof o.color === 'number' ? colorOf(o.color) : o.color;
  if (color) a.style = `--chip:${color}`;
  if (o.action) { a['data-action'] = o.action; a.role = 'button'; a.tabindex = '0'; }
  if (o.data) for (const [k, v] of Object.entries(o.data)) a['data-' + k] = v;
  return `<span${attrs(a)}>${o.html ? o.html : esc(o.label)}</span>`;
}

/** badge(label, kind) – kind: ok | warn | bad | muted | p0 | p1 */
export function badge(label, kind = '') {
  return `<span class="badge ${esc(kind)}">${esc(label)}</span>`;
}

/** Spielerfarbe aus WH.COLORS (Index); Dark-Mode-Variante standardmäßig. */
export function colorOf(idx, mode = 'd') {
  const list = (WH && WH.COLORS) || [];
  const c = list[((Number(idx) || 0) % Math.max(1, list.length) + list.length) % Math.max(1, list.length)];
  if (!c) return mode === 'd' ? '#9aa4b2' : '#5a6472';
  return c[mode] || c.d || c.l || '#9aa4b2';
}
export function colorName(idx) {
  const list = (WH && WH.COLORS) || [];
  const c = list[Number(idx) || 0];
  return c ? c.name : '';
}

// ---------------------------------------------------------------- Sheet (Bottom-Sheet/Modal)
let sheetCount = 0;
/**
 * sheet({ title, body (HTML), actions: [ { label, kind, cta, onClick(close, sheetEl), keep } ], onOpen(el, close), onClose, dismiss: true, cls })
 * → close() Funktion. Buttons in actions schließen das Sheet nach onClick, außer keep: true.
 */
export function sheet(o = {}) {
  const id = 'sheet' + (++sheetCount);
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.dataset.sheet = id;
  const actions = Array.isArray(o.actions) ? o.actions : [];
  wrap.innerHTML =
    `<div class="sheet ${esc(o.cls || '')}" role="dialog" aria-modal="true" aria-labelledby="${id}-t">
      <div class="grabber" aria-hidden="true"></div>
      <div class="sheet-head">
        <h2 class="title" id="${id}-t">${esc(o.title || '')}</h2>
        ${o.dismiss === false ? '' : `<button class="btn ghost icon sheet-close" type="button" data-sheet-close aria-label="Close">✕</button>`}
      </div>
      <div class="sheet-body">${o.body || ''}</div>
      ${actions.length ? `<div class="sheet-foot">${actions.map((a, i) => btn({
        label: a.label, html: a.html, kind: a.kind, cta: a.cta, disabled: a.disabled, cls: a.cls,
        data: { 'sheet-action': i }
      })).join('')}</div>` : ''}
    </div>`;
  let closed = false;
  const onKey = e => { if (e.key === 'Escape' && o.dismiss !== false) close(); };
  function close(result) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    wrap.remove();
    if (typeof o.onClose === 'function') { try { o.onClose(result); } catch (e) { console.error(e); } }
  }
  wrap.addEventListener('click', e => {
    const t = e.target;
    if (t === wrap) { if (o.dismiss !== false) close(); return; }
    const closeBtn = t.closest && t.closest('[data-sheet-close]');
    if (closeBtn) { close(); return; }
    const ab = t.closest && t.closest('[data-sheet-action]');
    if (ab) {
      const a = actions[Number(ab.dataset.sheetAction)];
      if (!a) return;
      let keep = a.keep;
      if (typeof a.onClick === 'function') {
        try { const r = a.onClick(close, wrap.querySelector('.sheet')); if (r === false) keep = true; }
        catch (err) { console.error(err); toast(err && err.message ? err.message : String(err), 'bad'); keep = true; }
      }
      if (!keep) close(a.value !== undefined ? a.value : a.label);
    }
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap);
  if (typeof o.onOpen === 'function') { try { o.onOpen(wrap.querySelector('.sheet'), close); } catch (e) { console.error(e); } }
  const first = wrap.querySelector('.sheet-body input, .sheet-body select, .sheet-body textarea');
  if (first) { try { first.focus(); } catch {} }
  return close;
}

/** confirmSheet({ title, text/body, ok, cancel, kind }) → Promise<boolean> */
export function confirmSheet(o = {}) {
  if (typeof o === 'string') o = { text: o };
  return new Promise(resolve => {
    let result = false;
    sheet({
      title: o.title || 'Are you sure?',
      body: o.body || `<p>${esc(o.text || '')}</p>`,
      cls: 'confirm',
      actions: [
        { label: o.cancel || 'Cancel', kind: 'ghost' },
        { label: o.ok || 'OK', kind: o.kind || 'primary', onClick: () => { result = true; } }
      ],
      onClose: () => resolve(result)
    });
  });
}

/** promptSheet({ title, label, value, placeholder, ok }) → Promise<string|null> */
export function promptSheet(o = {}) {
  return new Promise(resolve => {
    let result = null;
    sheet({
      title: o.title || 'Input',
      body: `<label class="field"><span>${esc(o.label || '')}</span><input type="text" name="v" value="${esc(o.value || '')}" placeholder="${esc(o.placeholder || '')}" autocomplete="off"></label>`,
      actions: [
        { label: o.cancel || 'Cancel', kind: 'ghost' },
        { label: o.ok || 'OK', kind: 'primary', onClick: (close, el) => { result = el.querySelector('input[name=v]').value; } }
      ],
      onOpen: (el, close) => {
        el.querySelector('input[name=v]').addEventListener('keydown', e => {
          if (e.key === 'Enter') { result = e.target.value; close(); }
        });
      },
      onClose: () => resolve(result)
    });
  });
}

// ---------------------------------------------------------------- Toast
let toastHost = null;
/** toast(msg, kind: 'ok'|'warn'|'bad'|'', ms) */
export function toast(msg, kind = '', ms) {
  if (!toastHost || !toastHost.isConnected) {
    toastHost = document.createElement('div');
    toastHost.className = 'toasts';
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const el = document.createElement('div');
  el.className = `toast ${kind || ''}`.trim();
  el.textContent = String(msg == null ? '' : msg);
  toastHost.appendChild(el);
  while (toastHost.children.length > 4) toastHost.firstChild.remove();
  const ttl = ms || (kind === 'bad' ? 5000 : 3000);
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  const t = setTimeout(kill, ttl);
  el.addEventListener('click', () => { clearTimeout(t); kill(); });
  return kill;
}

/** Kleiner Helfer: Spielerlabel "Player 1" bzw. Name */
export function playerLabel(state, idx) {
  const p = state && state.players && state.players[idx];
  return (p && p.name) || `Player ${idx + 1}`;
}

/** Formatiert Zoll mit einer Nachkommastelle: 7.25 → "7.3"" */
export function inch(n) {
  const v = Math.round((Number(n) || 0) * 10) / 10;
  return v.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + '"';
}
