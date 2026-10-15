/* Effective profiles of a unit: what its selections (enhancements, wargear, its own abilities) change on its weapon and
 * unit profiles – the New Recruit data's profile modifiers ("affects": "self.entries.recursive.profiles.Ranged Weapons",
 * field = a characteristic, type set / increment / decrement / append / replace, plus "annotation" naming the source).
 *
 *   profileChanges(V, unitW, group) → { weapons: { [key]: { chars: { S: '8', A: '2', … }, base: { S: '6', … }, keywords: [], notes: [] } },
 *                                       models:  { [key]: { chars: { SV: '3+', INV: '4+', … }, base: {…}, notes: [] } } }
 *   key = normalised profile name (see profileKey); only profiles that change are listed.
 * group: the units that form one attached unit with unitW (leaders + bodyguard) – for "self.entries.group…".
 */
import { applyModsOf, matchesSel } from './bs-engine.js';

export const profileKey = s => String(s || '').toLowerCase().replace(/^[^a-z0-9]+/, '').replace(/\(.*?\)/g, '').replace(/[’'`´]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const ID = /^[0-9a-f]{3,4}-[0-9a-f]{3,4}-[0-9a-f]{3,4}-[0-9a-f]{3,4}$/i;
// characteristic names of the data → the keys the datasheets use
const CHAR = { sv: 'SV', insv: 'INV', ld: 'LD', oc: 'OC', m: 'M', t: 'T', w: 'W', range: 'range', a: 'A', bs: 'BS', ws: 'WS', s: 'S', ap: 'AP', d: 'D', keywords: 'keywords' };

/** Where a modifier starts: its own selection, or the nearest model / unit / upgrade / parent / the unit above. */
function startOf(w, scope) {
  if (!scope || scope === 'self') return w;
  if (scope === 'parent') return w.parent && w.parent.kind === 'sel' ? w.parent : null;
  if (scope === 'root-entry') { let x = w; while (x.parent && x.parent.kind === 'sel') x = x.parent; return x; }
  const want = scope === 'model-or-unit' ? ['model', 'unit'] : [scope];
  for (let x = w.parent; x && x.kind === 'sel'; x = x.parent) if (x.node && want.includes(x.node.type)) return x;
  return null;
}
const below = (w, recursive, out = []) => { for (const c of w.ch || []) { if (!c.node) continue; out.push(c); if (recursive) below(c, true, out); } return out; };

/** Number arithmetic inside a characteristic ("3+", "-1", "D6+1", "2"): position -1 = the last number, else the first. */
function bump(text, by, position) {
  const s = String(text == null ? '' : text);
  const nums = [...s.matchAll(/-?\d+/g)];
  if (!nums.length) return s;
  const m = position === -1 ? nums[nums.length - 1] : nums[0];
  let v = Number(m[0]) + by;
  // "D6+1" style: the number after a '+' keeps its sign as written
  const out = s.slice(0, m.index) + String(v) + s.slice(m.index + m[0].length);
  return out.replace(/\+-/g, '-').replace(/\+0$/, '');
}

export function profileChanges(V, unitW, group = []) {
  const members = [unitW, ...group.filter(g => g && g !== unitW)];
  const sels = members.flatMap(m => [m, ...below(m, true)]);
  // every profile of every selection, with a working copy of its characteristics
  const profs = [];
  for (const w of sels) {
    for (const p of (w.node && w.node.profiles) || []) {
      if (!/Weapons|^Unit$/i.test(p.typeName || '')) continue;
      const chars = {};
      for (const c of p.characteristics || []) chars[c.typeId] = { name: c.name, v: c.$text == null ? '' : String(c.$text) };
      profs.push({ w, p, type: p.typeName, name: p.name, chars, base: JSON.parse(JSON.stringify(chars)), notes: [] });
    }
  }
  const profsOf = (ws, type) => profs.filter(x => ws.includes(x.w) && x.type === type);
  // modifiers that change profiles, from every selection of the (attached) unit
  for (const w of sels) {
    applyModsOf(V, w, (m, times) => {
      if (!m.affects || !/(^|\.)profiles\./.test(m.affects)) return;
      const start = startOf(w, m.scope);
      if (!start) return;
      const parts = String(m.affects).split('.');
      const pi = parts.indexOf('profiles');
      const type = parts.slice(pi + 1).join('.');
      const pre = parts.slice(0, pi);
      if (pre.includes('associations')) return;
      let ws;
      if (pre[0] === 'self' && pre[1] === 'entries') {
        const rest = pre.slice(2);
        // "group": the whole attached unit (leaders + bodyguard) – a leader's or the unit's ability for all of them
        const bases = rest.includes('group') ? members : [start];
        // "self.entries": the entry itself and the entries below it (a weapon carries its profile itself)
        ws = bases.flatMap(b => [b, ...below(b, rest.includes('recursive'))]);
        for (const id of rest.filter(x => ID.test(x))) ws = ws.filter(x => matchesSel(V, x, id));
      } else {
        ws = [start];
        for (const id of pre.filter(x => ID.test(x))) ws = ws.filter(x => matchesSel(V, x, id));
      }
      for (const t of profsOf(ws, type)) {
        if (m.field === 'annotation') { if (m.type === 'append' && m.value && !t.notes.includes(String(m.value))) t.notes.push(String(m.value)); continue; }
        const c = t.chars[m.field];
        if (!c) continue;
        const n = Math.max(1, times || 1);
        if (m.type === 'set') c.v = String(m.value);
        else if (m.type === 'increment') c.v = bump(c.v, Number(m.value) * n, m.position);
        else if (m.type === 'decrement') c.v = bump(c.v, -Number(m.value) * n, m.position);
        else if (m.type === 'append') {
          const add = String(m.value);
          const cur = c.v && c.v !== '-' ? c.v : '';
          if (!cur.split(/\s*,\s*/).includes(add)) c.v = cur ? cur + (m.join != null ? m.join : '') + add : add;
        } else if (m.type === 'replace') { if (m.arg != null) c.v = c.v.split(String(m.arg)).join(m.value === true ? '' : String(m.value)); }
      }
    });
  }
  // only what changed, by the datasheets' keys
  const out = { weapons: {}, models: {} };
  for (const t of profs) {
    const chars = {}, base = {};
    for (const [id, c] of Object.entries(t.chars)) {
      if (c.v === t.base[id].v) continue;
      const k = CHAR[String(c.name).toLowerCase()] || c.name;
      chars[k] = c.v; base[k] = t.base[id].v;
    }
    if (!Object.keys(chars).length && !t.notes.length) continue;
    const isUnit = /^Unit$/i.test(t.type);
    const entry = { chars, base, notes: t.notes };
    if (!isUnit && chars.keywords != null) {
      const was = String(base.keywords || '').split(/\s*,\s*/).filter(Boolean).map(x => x.toLowerCase());
      entry.keywords = String(chars.keywords).split(/\s*,\s*/).filter(k => k && !was.includes(k.toLowerCase()));
      delete chars.keywords; delete base.keywords;
    }
    const bag = isUnit ? out.models : out.weapons;
    const key = profileKey(t.name);
    // the same weapon on several models: one entry is enough (same changes)
    if (!bag[key]) bag[key] = entry;
  }
  return out;
}
