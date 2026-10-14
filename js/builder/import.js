/* Import an army from New Recruit into "My armies":
 *  - roster file (.rosz = zipped XML, .ros = XML; BattleScribe format, also exported by New Recruit): exact entries
 *  - text export (New Recruit / GW app, file or pasted): faction, battle size, detachment, units, model types, wargear,
 *    enhancements, Warlord and "Leading …" are matched by name against the BSData catalogues.
 * Returns { army, report: [lines that could not be matched] }. */
import * as E from './bs-engine.js';
import { parseArmyText } from '../../engine/index.js';
import { playableCatalogues, systemFor } from './load.js';
import { armyId } from './store.js';

const norm = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/* ───────── files ───────── */
export async function importArmyFile(file) {
  const name = String(file.name || '');
  if (/\.rosz$/i.test(name)) return importRoster(await unzipFirst(await file.arrayBuffer()));
  const text = await file.text();
  if (/\.ros$/i.test(name) || /^\s*<\?xml|<roster[\s>]/.test(text)) return importRoster(text);
  return importText(text);
}
/** First file of a zip archive (a .rosz holds one .ros). */
async function unzipFirst(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x04034b50) throw new Error('Not a .rosz (zip) file');
  let method = dv.getUint16(8, true), size = dv.getUint32(18, true), start = 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
  if (dv.getUint16(6, true) & 8 || !size) {   // sizes only in the central directory
    let e = buf.byteLength - 22;
    while (e > 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    const cd = dv.getUint32(e + 16, true);
    method = dv.getUint16(cd + 10, true); size = dv.getUint32(cd + 20, true);
    const lh = dv.getUint32(cd + 42, true);
    start = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true);
  }
  const data = new Uint8Array(buf, start, size);
  if (method === 0) return new TextDecoder().decode(data);
  const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  return new TextDecoder().decode(out);
}

/* ───────── common ───────── */
function base(sys, cat, limit) {
  let r = { id: armyId(), name: '', catalogueId: cat.id, catalogueName: cat.name, catalogueLabel: cat.label, file: cat.file, faction: cat.faction, limit, sel: [] };
  const V0 = E.view(sys, r);
  for (const n of sys.rootNodes(r.catalogueId)) {
    const l = E.limits(V0, n, null, V0.force);
    if (!l.hidden && l.min > 0 && n.type === 'upgrade') r = E.addSel(sys, r, null, n.token);
  }
  const V = E.view(sys, r);
  const bs = V.force.ch.find(w => w.node && w.node.name === 'Battle Size');
  const g = bs && sys.children(bs.node).find(k => k.group && k.name === 'Battle Size');
  const std = limit <= 1000 ? 1000 : 2000;
  const opt = g && sys.children(g).find(o => new RegExp('\\(' + std + ' Point').test(o.name));
  if (opt) r = E.chooseInGroup(sys, r, bs.s.id, g.token, g.token + '>' + opt.token);
  return r;
}
/** All entries below a node (through groups): [{ node, tok, group }] – the token path relative to the node. */
function entriesBelow(sys, node, depth = 0, pre = '', group = null, out = []) {
  if (depth > 4) return out;
  for (const k of sys.children(node)) {
    if (/^(Crusade|Weapon Modifications)/i.test(k.name)) continue;
    const tok = pre ? pre + '>' + k.token : k.token;
    if (k.group) entriesBelow(sys, k, depth + 1, tok, { node: k, tok }, out);
    else out.push({ node: k, tok, group });
  }
  return out;
}
const last = (r, sys) => { const V = E.view(sys, r); return V.force.ch[V.force.ch.length - 1]; };

/* ───────── text export ───────── */
export async function importText(text) {
  const report = [];
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  const head = lines.slice(0, 12).join('\n');
  // faction: "+ FACTION KEYWORD: …" or a catalogue name in the first lines
  const cats = await playableCatalogues();
  const fk = /FACTION KEYWORD:\s*(.+)/i.exec(head);
  const hay = norm(fk ? fk[1] : head);
  const cat = cats.filter(c => hay.includes(norm(c.label)) || hay.includes(norm(c.name))).sort((a, b) => b.label.length - a.label.length)[0];
  if (!cat) throw new Error('Faction not recognised – the export needs the faction (e.g. "+ FACTION KEYWORD: …" or the faction name on top)');
  const sys = await systemFor(cat.id);
  // battle size / points
  const sz = /(Incursion|Strike Force|Onslaught)\s*\((\d{3,5})/i.exec(head);
  const tot = /TOTAL ARMY POINTS:\s*(\d+)/i.exec(head) || /\((\d{3,5}) points?\)/i.exec(lines[0] || '');
  const limit = sz ? Number(sz[2]) : tot && Number(tot[1]) > 1000 ? 2000 : 1000;
  let r = base(sys, cat, limit);
  // detachment(s) – "DETACHMENT: A, B (note)"; a faction can have more than one Detachment entry (allies), every one is searched
  const dl = /DETACHMENT:\s*(.+)/i.exec(head);
  const wanted = (dl ? dl[1].split(/\s*,\s*/) : lines.slice(0, 8)).map(x => norm(x.replace(/\s*\(.*\)\s*$/, '')));
  let any = false;
  for (const wn of wanted) {
    const V0 = E.view(sys, r);
    for (const dw of V0.force.ch.filter(w => w.node && /^Detachments?$/.test(w.node.name))) {
      const g = sys.children(dw.node).find(k => k.group);
      const o = g && sys.children(g).find(x => norm(x.name) === wn);
      if (o) { r = E.addSel(sys, r, dw.s.id, g.token + '>' + o.token); any = true; break; }
    }
  }
  if (!any) report.push('Detachment not recognised – choose it in the army configuration');
  // units
  const roots = sys.rootNodes(cat.id).filter(n => ['unit', 'model'].includes(n.type));
  const units = parseArmyText(text);
  const leads = [];
  for (const u of units) {
    const node = roots.find(n => norm(n.name) === norm(u.name)) || roots.find(n => norm(u.name).startsWith(norm(n.name)) || norm(n.name).startsWith(norm(u.name)));
    if (!node) { report.push(`Unit not found: ${u.name}`); continue; }
    r = E.addSel(sys, r, null, node.token);
    const id = last(r, sys).s.id;
    r = setModels(sys, r, id, u, report);
    r = setWargear(sys, r, id, u, report);
    // enhancements, Warlord
    for (const en of u.enhancements || []) {
      const e = entriesBelow(sys, node).find(x => x.group && /Enhancement/i.test(x.group.node.name) && norm(x.node.name) === norm(en));
      if (e) r = E.addSel(sys, r, id, e.tok); else report.push(`${u.name}: enhancement not found: ${en}`);
    }
    if (u.warlord) {
      const wl = entriesBelow(sys, node).find(x => /^Warlord$/i.test(x.node.name));
      const have = E.view(sys, r).byId.get(id).ch.some(c => c.node && /^Warlord$/i.test(c.node.name));
      if (wl && !have) r = E.addSel(sys, r, id, wl.tok);
    }
    if (u.leading) leads.push({ id, target: u.leading });
  }
  // "Leading …": the first unit of that name not led yet
  for (const l of leads) {
    const V = E.view(sys, r);
    const t = V.force.ch.find(w => w.node && norm(w.node.name) === norm(l.target) && !V.force.ch.some(x => x.s.lead === w.s.id));
    if (t) { const x = r.sel.find(s => s.id === l.id); if (x) x.lead = t.s.id; }
  }
  r = E.autoSync(sys, r);
  const pts = E.totalPoints(E.view(sys, r));
  r.name = `${cat.label} ${pts}`;
  return { army: r, sys, report, units: units.length };
}

const onlyOne = a => (a.length === 1 ? a[0] : undefined);

/** Model types of the unit from the export lines ("9x Hearthkyn Warrior w/ bolter"). */
function setModels(sys, r, id, u, report) {
  let V = E.view(sys, r);
  const w = V.byId.get(id);
  const types = entriesBelow(sys, w.node).filter(x => x.node.type === 'model');
  if (!types.length) return r;
  const lines = (u.modelLines || []).map(m => ({ m, t: types.find(x => norm(x.node.name) === norm(m.name)) || onlyOne(types.filter(x => norm(x.node.name).startsWith(norm(m.name) + ' w '))) })).filter(x => x.t);
  if (!lines.length) {
    // no model lines: grow the biggest stack to the unit's model count
    const stacks = []; (function f(x) { for (const c of x.ch) { if (c.node && c.node.type === 'model') stacks.push(c); else f(c); } })(w);
    const cur = stacks.reduce((a, c) => a + c.n, 0);
    const big = stacks.sort((a, b) => b.n - a.n)[0];
    if (big && u.models > cur) r = E.setCount(r, big.s.id, big.n + u.models - cur);
    return r;
  }
  const seen = new Set();
  for (const { m, t } of lines) {
    V = E.view(sys, r);
    const ww = V.byId.get(id);
    const have = ww.ch.find(c => c.s.t === t.tok && !seen.has(c.s.id));
    if (have) { r = E.setCount(r, have.s.id, m.count); seen.add(have.s.id); }
    else { r = E.addSel(sys, r, id, t.tok, m.count); const nw = E.view(sys, r).byId.get(id); const c = nw.ch[nw.ch.length - 1]; if (c) seen.add(c.s.id); }
  }
  // default stacks the export does not mention go away
  V = E.view(sys, r);
  const uw = V.byId.get(id);
  for (const c of uw.ch) if (c.node && c.node.type === 'model' && !seen.has(c.s.id) && E.limits(V, c.node, c, uw).min === 0) r = E.removeSel(r, c.s.id);   // mandatory models stay
  return r;
}

/** Wargear by name: as many models as the export says get it – chosen in the group of their model stack. */
function setWargear(sys, r, id, u, report) {
  const missing = [];
  for (const g of u.wargear || []) {
    if (/^warlord$/i.test(g.name)) continue;
    let tries = 0, matched = false;
    for (;;) {
      if (++tries > 12) break;
      const V = E.view(sys, r);
      const w = V.byId.get(id);
      const holders = [w]; (function f(x) { for (const c of x.ch) { if (c.node && c.node.type === 'model') holders.push(c); } })(w);
      const has = x => { let found = false; (function f(y) { for (const c of y.ch) { if (c.node && c.node.type !== 'model' && norm(c.node.name) === norm(g.name)) found = true; if (c.node && c.node.type !== 'model') f(c); } })(x); return found; };
      // a single model (or the unit itself) counts its weapons ("4x Lascannon" on a vehicle), a stack counts its models
      const mine = x => { const out = []; (function f(y) { for (const c of y.ch) { if (c.node && c.node.type !== 'model' && norm(c.node.name) === norm(g.name)) out.push(c); if (c.node && c.node.type !== 'model') f(c); } })(x); return out; };
      const single = h => h === w || h.n === 1;
      const current = holders.reduce((t, h) => t + (single(h) ? mine(h).reduce((a, c) => a + c.n, 0) : has(h) ? h.n : 0), 0);
      let need = Math.max(1, g.count) - current;
      if (need <= 0) { matched = true; break; }
      // more of a weapon a single model already has: raise its count, as far as the rules allow
      const grow = holders.filter(single).map(h => mine(h)[0]).find(Boolean);
      if (grow) {
        const before = E.validate(V).length;
        const r2 = E.setCount(r, grow.s.id, grow.n + need);
        if (E.validate(E.view(sys, r2)).length <= before) { r = r2; continue; }
      }
      const cands = holders.filter(h => !has(h)).map(h => ({ h, e: entriesBelow(sys, h.node).find(x => x.node.type !== 'model' && norm(x.node.name) === norm(g.name)) })).filter(c => c.e);
      if (!cands.length) break;
      const n = c => (c.h === w ? 1 : c.h.n);
      cands.sort((p, q) => (n(q) === need) - (n(p) === need) || (n(q) <= need) - (n(p) <= need) || n(q) - n(p));
      let c = cands[0];
      // a stack bigger than needed: split the needed number off first (e.g. 2 of 9 with a different weapon)
      if (c.h !== w && c.h.n > need) {
        for (let i = 0; i < need; i++) r = E.splitSel(r, c.h.s.id);
        const V2 = E.view(sys, r);
        const parent = V2.byId.get(c.h.s.id).parent;
        const split = parent.ch.filter(x => x.s.t === c.h.s.t && x.s.id !== c.h.s.id && x.n === 1).slice(0, need);
        if (split.length > 1) { r = E.removeSel(r, split[1].s.id); for (const x of split.slice(2)) r = E.removeSel(r, x.s.id); r = E.setCount(r, split[0].s.id, need); }
        c = { h: E.view(sys, r).byId.get(split[0].s.id), e: c.e };
      }
      const V3 = E.view(sys, r);
      const h = V3.byId.get(c.h.s.id);
      if (c.e.group) {
        const gl = E.limits(V3, c.e.group.node, null, h);
        r = gl.max === 1 ? E.chooseInGroup(sys, r, h.s.id, c.e.group.tok, c.e.tok) : E.addSel(sys, r, h.s.id, c.e.tok, 1);
      } else r = E.addSel(sys, r, h.s.id, c.e.tok);
      matched = true;
    }
    if (!matched) missing.push(g);
  }
  if (missing.length) r = bundles(sys, r, id, u, missing);
  for (const g of missing) report.push(`${u.name}: wargear not matched: ${g.count > 1 ? g.count + '× ' : ''}${g.name}`);
  return r;
}

/** Option bundles ("2 Lascannons and 2 Twin Heavy Bolters"): the export lists only the weapons inside. Try the bundles of
 *  the unit and keep the one that brings the weapon counts closest to the export; repeat while it gets better.
 *  Drops what is matched from `missing`. */
function bundles(sys, r, id, u, missing) {
  const want = new Map((u.wargear || []).map(g => [norm(g.name), Math.max(1, g.count)]));
  const counts = rr => {
    const m = new Map();
    (function f(x, mul) { for (const c of x.ch) { if (!c.node || c.node.type === 'model') continue; const k = norm(c.node.name); if (!c.ch.length) m.set(k, (m.get(k) || 0) + c.n * mul); f(c, c.n * mul); } })(E.view(sys, rr).byId.get(id), 1);
    return m;
  };
  const score = rr => { let sc = 0; for (const [k, v] of counts(rr)) { const t = want.get(k); sc += t ? Math.min(v, t) - Math.max(0, v - t) : -v; } return sc; };
  for (let pass = 0; pass < 6; pass++) {
    const V = E.view(sys, r);
    const w = V.byId.get(id);
    const errs = E.validate(V).length;
    const taken = new Set(); (function f(x) { for (const c of x.ch) { taken.add(c.s.t); f(c); } })(w);
    let best = null, bestScore = score(r);
    for (const e of entriesBelow(sys, w.node)) {
      if (!e.group || e.node.type === 'model' || !sys.children(e.node).length || want.has(norm(e.node.name)) || taken.has(e.tok.split('>').pop())) continue;
      let r2;
      try {
        const gl = E.limits(V, e.group.node, null, w);
        r2 = gl.max === 1 ? E.chooseInGroup(sys, r, id, e.group.tok, e.tok) : E.addSel(sys, r, id, e.tok, 1);
      } catch { continue; }
      const sc = score(r2);
      if (sc > bestScore && E.validate(E.view(sys, r2)).length <= errs) { best = r2; bestScore = sc; }
    }
    if (!best) break;
    r = best;
  }
  const have = counts(r);
  for (let i = missing.length - 1; i >= 0; i--) if ((have.get(norm(missing[i].name)) || 0) >= Math.max(1, missing[i].count)) missing.splice(i, 1);
  return r;
}

/* ───────── roster file (exact BSData entries) ───────── */
export async function importRoster(xml) {
  const report = [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('The roster file could not be read');
  const force = doc.querySelector('forces > force');
  if (!force) throw new Error('No force in the roster');
  const cats = await playableCatalogues();
  const catId = force.getAttribute('catalogueId');
  const cat = cats.find(c => c.id === catId);
  if (!cat) throw new Error('Faction of the roster not available: ' + (force.getAttribute('catalogueName') || catId));
  const sys = await systemFor(cat.id);
  const lim = doc.querySelector('costLimits > costLimit[name="pts"], costLimits > costLimit[typeId="51b2-306e-1021-d207"]');
  const limit = lim ? Number(lim.getAttribute('value')) || 2000 : 2000;
  // token path of a roster selection below a node (entryId "link::target", entryGroupId for the groups)
  const find = (list, ids) => {
    const walk = (nodes, pre, d) => {
      for (const k of nodes) {
        const tok = pre ? pre + '>' + k.token : k.token;
        if (!k.group && ids.some(i => k.ids.has(i))) return { node: k, tok };
        if (k.group && d < 5) { const x = walk(sys.children(k), tok, d + 1); if (x) return x; }
      }
      return null;
    };
    return walk(list, '', 0);
  };
  // roster numbers count all models of a stack (9 bolters for 9 warriors); the builder counts per model
  const conv = (xmlSel, parentNode, parentN = 1) => {
    const ids = String(xmlSel.getAttribute('entryId') || '').split('::').filter(Boolean).reverse();
    const hit = find(parentNode ? sys.children(parentNode) : sys.rootNodes(cat.id), ids);
    if (!hit) { report.push('Not found in the data: ' + (xmlSel.getAttribute('name') || ids[0])); return null; }
    const kids = [...xmlSel.children].find(c => c.tagName === 'selections');
    const raw = Math.max(1, Number(xmlSel.getAttribute('number')) || 1);
    const n = parentN > 1 && raw % parentN === 0 ? raw / parentN : raw;
    return { id: E.newId(), t: hit.tok, n, ch: kids ? [...kids.children].filter(c => c.tagName === 'selection').map(c => conv(c, hit.node, n * parentN > 1 && hit.node.type === 'model' ? n : 1)).filter(Boolean) : [] };
  };
  const top = [...force.children].find(c => c.tagName === 'selections');
  let r = { id: armyId(), name: doc.querySelector('roster')?.getAttribute('name') || cat.label, catalogueId: cat.id, catalogueName: cat.name, catalogueLabel: cat.label, file: cat.file, faction: cat.faction, limit, sel: [] };
  r.sel = top ? [...top.children].filter(c => c.tagName === 'selection').map(c => conv(c, null)).filter(Boolean) : [];
  r = E.autoSync(sys, r);
  return { army: r, sys, report, units: r.sel.length };
}
