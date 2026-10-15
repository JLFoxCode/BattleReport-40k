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
    if (/^(Crusade\b|Weapon Modifications)/i.test(k.name)) continue;   // not "Crusaders" (Crusader Squad)
    const tok = pre ? pre + '>' + k.token : k.token;
    if (k.group) entriesBelow(sys, k, depth + 1, tok, { node: k, tok }, out);
    else out.push({ node: k, tok, group });
  }
  return out;
}
const last = (r, sys) => { const V = E.view(sys, r); return V.force.ch[V.force.ch.length - 1]; };

/* ───────── Show/Hide switches ───────── */
const showRoot = (sys, r) => { const V = E.view(sys, r); return sys.rootNodes(r.catalogueId).find(n => /^Show\/Hide Options$/i.test(n.name) && !E.limits(V, n, null, V.force).hidden && sys.children(n).some(k => !k.group)); };
/** Switch on the Show/Hide options whose name matches `re` (a RegExp or a test function) – new Chaos Daemons army: the four gods. */
export function switchOn(sys, r, re) {
  const ok = typeof re === 'function' ? re : n => re.test(n);
  const root = showRoot(sys, r);
  if (!root) return r;
  for (const k of sys.children(root).filter(k => !k.group && ok(k.name))) {
    let w = E.view(sys, r).force.ch.find(x => x.node && x.node.token === root.token);
    if (!w) { r = E.addSel(sys, r, null, root.token); w = E.view(sys, r).force.ch.find(x => x.node && x.node.token === root.token); }
    if (!w.ch.some(c => c.s.t === k.token)) r = E.addSel(sys, r, w.s.id, k.token);
  }
  return r;
}
/** Units of the list that are hidden (Legends, a Daemon god, allies …): switch on the Show/Hide options that make them
 *  available – one at a time, kept only when it helps. Before autoSync, which would remove hidden units. */
export function revealUnits(sys, r) {
  const root = showRoot(sys, r);
  if (!root) return r;
  const hidden = rr => { const V = E.view(sys, rr); return V.force.ch.filter(w => w.node && ['unit', 'model'].includes(w.node.type) && E.effective(V, w.node, w, V.force).hidden).length; };
  let left = hidden(r);
  for (const k of sys.children(root).filter(k => !k.group)) {
    if (!left) break;
    const r2 = switchOn(sys, r, n => n === k.name);
    const n = hidden(r2);
    if (n < left) { r = r2; left = n; }
  }
  return r;
}

/* ───────── text export ───────── */
export async function importText(text, opts = {}) {
  const report = [];
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  const head = lines.slice(0, 12).join('\n');
  // faction: "+ FACTION KEYWORD: …" or a catalogue name in the first lines
  const cats = await playableCatalogues();
  const fk = /FACTION KEYWORD:\s*(.+)/i.exec(head);
  const hay = norm(fk ? fk[1] : head);
  // the faction named in the list – or, without one (lists from Reddit / chats), the army it is imported from
  const cat = cats.filter(c => hay.includes(norm(c.label)) || hay.includes(norm(c.name))).sort((a, b) => b.label.length - a.label.length)[0]
    || (opts.catalogueId ? cats.find(c => c.id === opts.catalogueId) : null);
  if (!cat) throw new Error('Faction not recognised – the export needs the faction (e.g. "+ FACTION KEYWORD: …" or the faction name on top)');
  const sys = await systemFor(cat.id);
  // the list's title: a first line with points ("Stormlord Dynasty (1970 Points)") in a list with sections (GW app) or
  // with 500+ points – no unit, its name becomes the army's name
  const SECTION = /^(CHARACTERS?|BATTLELINE|OTHER DATASHEETS|DEDICATED TRANSPORTS?|EPIC HEROE?S?|INFANTRY|VEHICLES?|MONSTERS?|ALLIED UNITS)\b/i;
  const ptsNum = s => Number(String(s).replace(/[,.\s]/g, ''));
  const tm = /^(?![+&=#])(.+?)\s*[([]\s*(\d[\d,.]*)\s*(?:pts?|points?)\s*[)\]]\s*$/i.exec(lines[0] || '');
  const title = tm && (lines.some(l => SECTION.test(l)) || ptsNum(tm[2]) >= 500) ? tm[1].trim() : null;
  // battle size / points: "Strike Force (2,000 Points)", "Battle Size: 2. Strike Force (2000 Point limit)", "Strike
  // Force 2000", a round number in the first line ("Necrons 2000 - Awakened Dynasty", "Aeldari - Aspect Host - 2000pts"),
  // else from the list's total
  const SIZE_PTS = { incursion: 1000, 'strike force': 2000, onslaught: 3000 };
  const sz = /\b(Incursion|Strike Force|Onslaught)\b\s*[-–:(]?\s*(\d{1,2}[,.]?\d{3})?/i.exec(head);
  const round = /(?:^|[\s|–-])([123][,.]?000)\s*(?:pts?|points?)?(?=$|[\s|–-])/i.exec(lines[0] || '');
  const tot = /TOTAL ARMY POINTS:\s*(\d[\d,.]*)/i.exec(head) || (tm ? [tm[0], tm[2]] : null) || /\[\s*(\d[\d,.]*)\s*pts?\s*\]/i.exec(lines[0] || '');
  const limit = sz ? (sz[2] ? ptsNum(sz[2]) : SIZE_PTS[sz[1].toLowerCase()]) : round ? ptsNum(round[1]) : tot && ptsNum(tot[1]) > 1000 ? 2000 : 1000;
  let r = base(sys, cat, limit);
  // detachment(s): every name of this faction's detachments that appears in the list's head (the lines before the first
  // unit) or in any line mentioning "Detachment" – "+ DETACHMENT: A, B", "Detachment: A", "A Detachment",
  // "Strike Force (2000) – A", "A + B", a line of its own (GW app / New Recruit text) …
  // a unit line: points below 500 ("Beastboss (80 points)", "[25 pts]", "10x …") or a section heading; the list's title
  // and the battle size carry 1000 / 2000 points and belong to the head
  const isUnitLine = (l, i) => {
    if (/^\+/.test(l) || (i === 0 && title)) return false;
    if (/^(CHARACTERS?|BATTLELINE|OTHER DATASHEETS|DEDICATED TRANSPORTS?|EPIC HEROE?S?|INFANTRY|VEHICLES?|MONSTERS?|ALLIED UNITS)\b/i.test(l)) return true;
    if (/^\d+\s*x\s/i.test(l) || /^Char\d/i.test(l)) return true;
    const m = /[([]\s*(\d+)\s*(pts?|points?)\s*[)\]]/i.exec(l);
    return !!m && Number(m[1]) < 500;
  };
  const firstUnit = lines.findIndex(isUnitLine);
  const cand = [...lines.slice(0, firstUnit < 0 ? 15 : Math.max(firstUnit, 1)), ...lines.filter(l => /detachment/i.test(l))];
  const hayDet = ' ' + cand.map(norm).join(' | ') + ' ';
  const found = [];
  {
    const V0 = E.view(sys, r);
    for (const dw of V0.force.ch.filter(w => w.node && /^Detachments?$/.test(w.node.name))) {
      const g = sys.children(dw.node).find(k => k.group);
      for (const o of g ? sys.children(g) : []) {
        const n = norm(o.name);
        const at = n ? hayDet.indexOf(' ' + n + ' ') : -1;
        if (at >= 0 && !found.some(f => f.o === o)) found.push({ o, dw, g, at, len: n.length });
      }
    }
  }
  // longer names first when one is part of another ("Combined Arms" inside "Combined Arms Regiment"), list order after
  found.sort((a, b) => a.at - b.at || b.len - a.len);
  const taken = [];
  for (const f of found) {
    if (taken.some(t => t.at <= f.at && f.at < t.at + t.len + 1 && t.o !== f.o)) continue;   // part of a longer name taken
    r = E.addSel(sys, r, f.dw.s.id, f.g.token + '>' + f.o.token);
    taken.push(f);
  }
  if (!taken.length) report.push('Detachment not recognised – choose it in the army configuration');
  // units
  const roots = sys.rootNodes(cat.id).filter(n => ['unit', 'model'].includes(n.type));
  const units = parseArmyText(text).filter(u => !(title && norm(u.name) === norm(title)));   // the title is no unit
  // lines that look like a unit with its points ("Overlord (115 pts) - Warlord, …", "10x Dire Avengers - 140",
  // "Autarch (90): …") but became no unit: reported as not imported instead of vanishing silently
  {
    const got = units.map(u => norm(u.name)).filter(Boolean);
    const ptsOf = l => { const m = /[([]\s*(\d+)\s*(?:pts?|points?)\s*[)\]]|[([]\s*(\d+)\s*[)\]]\s*(?::|$)|[-–:]\s*(\d{2,3})\s*(?:pts?|points?)?\s*$/i.exec(l); return m ? Number(m[1] || m[2] || m[3]) : null; };
    for (const [i, l] of lines.entries()) {
      if (i === 0 && title) continue;
      if (/^[+&=#•◦○]/.test(l) || !/[a-z]{3}/i.test(l) || /detachment|faction|total|strike force|incursion|onslaught|version/i.test(l)) continue;
      const p = ptsOf(l);
      if (p == null || p >= 500 || got.some(n => norm(l).includes(n))) continue;
      report.push(`Unit not found: ${l}`);
    }
  }
  const leads = [];
  const made = [];   // [{ u, id }] – a list unit and the selection it became
  for (const u of units) {
    // several entries of the same name (BSData keeps hidden shared copies, e.g. a 3-model Marneus Calgar): the one this
    // army can take – a hidden one only if there is no other (Legends etc. are revealed below)
    const V0 = E.view(sys, r);
    const usable = list => list.find(n => { try { return !E.limits(V0, n, null, V0.force).hidden; } catch { return true; } }) || list[0];
    const node = usable(roots.filter(n => norm(n.name) === norm(u.name))) || usable(roots.filter(n => norm(u.name).startsWith(norm(n.name)) || norm(n.name).startsWith(norm(u.name))));
    if (!node) { report.push(`Unit not found: ${u.name}`); continue; }
    r = E.addSel(sys, r, null, node.token);
    const id = last(r, sys).s.id;
    made.push({ u, id });
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
    if (u.leading) leads.push({ id, target: u.leading, nth: u.leadingNth || 0, name: u.name });
  }
  // "Leading X[2]": the 2nd unit of that name in the list (the app's own export numbers same-named units); without a
  // number the first unit of that name not led yet
  for (const l of leads) {
    const V = E.view(sys, r);
    const named = V.force.ch.filter(w => w.node && norm(w.node.name) === norm(l.target));
    const t = (l.nth && named[l.nth - 1]) || named.find(w => !V.force.ch.some(x => x.s.lead === w.s.id));
    if (t) { const x = r.sel.find(s => s.id === l.id); if (x) x.lead = t.s.id; }
    else report.push(`${l.name} leads ${l.target} – that unit is not in the imported army`);
  }
  r = revealUnits(sys, r);
  r = E.autoSync(sys, r);
  // the list's own title – else faction and detachment (no points in the name: they go stale once the army is edited)
  const own = title && !/\b(Incursion|Strike Force|Onslaught)\b/i.test(title) && norm(title) !== norm(cat.label) ? title : null;   // not "Necrons - Awakened Dynasty - Strike Force"
  r.name = own || `${cat.label}${taken.length ? ' – ' + taken.map(t => t.o.name).join(' + ') : ''}`;
  const notes = importNotes(sys, r, report, made, tot ? ptsNum(tot[1]) : null, units.some(u => u.warlord), taken.map(t => t.o.name));
  r.importNotes = notes;
  return { army: r, sys, report, notes, units: units.length };
}

/* ───────── Import report ───────── */
/** Everything the import could not take over 1:1, by importance:
 *  error = not imported · warn = different from the list · rule = rule problem of the imported army · info = note.
 *  → [{ level, text }] (also stored on the army as army.importNotes, shown in the editor until dismissed) */
function importNotes(sys, r, report, made, listTotal, hasWarlord, dets = []) {
  const notes = [];
  const add = (level, text) => { if (!notes.some(n => n.text === text)) notes.push({ level, text }); };
  if (dets.length) add('info', `Detachment${dets.length === 1 ? '' : 's'} from the list: ${dets.join(' + ')}`);
  for (const t of report) add(/^Unit not found/.test(t) ? 'error' : 'warn', t);
  const V = E.view(sys, r);
  const modelsOf = w => {
    if (w.node.type === 'model') return w.n;
    let n = 0; (function f(x, mult) { for (const c of x.ch) { if (!c.node) continue; if (c.node.type === 'model') n += c.n * mult; else f(c, mult * c.n); } })(w, 1);
    return n;
  };
  for (const { u, id } of made) {
    const w = V.byId.get(id);
    if (!w) { add('error', `${u.name}: removed – not allowed in this army with the current data`); continue; }
    const c = E.totalCost(V, w);
    if (u.points > 0 && c !== u.points) add('warn', `${u.name}: ${u.points} pts in the list, ${c} pts with the current data${c < u.points || c > u.points ? ' (points update or different options)' : ''}`);
    const m = modelsOf(w);
    // a single-model unit (Doomsday Ark, Knight Castellan): "• 2x Gauss Flayer Array" lines are its weapons, not models
    const single = w.node.type === 'model' && m === 1;
    if (u.models > 0 && m > 0 && m !== u.models && !single) add('warn', `${u.name}: ${u.models} model${u.models === 1 ? '' : 's'} in the list, ${m} imported`);
  }
  // total of the units that were imported: the list's points against the current data (the list's header total is often
  // the battle size, so the units' own points are compared)
  const listSum = made.reduce((x, m) => x + (V.byId.get(m.id) && m.u.points > 0 ? m.u.points : 0), 0);
  const curSum = made.reduce((x, m) => { const w = V.byId.get(m.id); return x + (w && m.u.points > 0 ? E.totalCost(V, w) : 0); }, 0);
  if (listSum && listSum !== curSum) add('warn', `Imported units: ${listSum} pts in the list, ${curSum} pts with the current data`);
  if (!hasWarlord) add('warn', 'No Warlord marked in the list – choose one in the army');
  for (const e of E.validate(V)) {
    if (/Force Disposition/.test(e.msg)) { add('info', 'Choose a Force Disposition in the army configuration (it is not part of a list)'); continue; }
    if (/^Warlord: at least/.test(e.msg) && !hasWarlord) continue;
    add('rule', e.msg);
  }
  return notes;
}

const onlyOne = a => (a.length === 1 ? a[0] : undefined);

/** Model types of the unit from the export lines ("9x Hearthkyn Warrior w/ bolter"). */
function setModels(sys, r, id, u, report) {
  let V = E.view(sys, r);
  const w = V.byId.get(id);
  // model stacks of the unit, also inside a size option that holds them ("2 Sergeants and 18 Shock Troopers")
  const stacksOf = rr => { const o = []; (function f(x, mult) { for (const c of x.ch) { if (!c.node) continue; if (c.node.type === 'model') o.push({ c, n: c.n * mult }); else f(c, mult * c.n); } })(E.view(sys, rr).byId.get(id), 1); return o; };
  const modelCount = rr => stacksOf(rr).reduce((a, s) => a + s.n, 0);
  // size options of the unit (a group whose options hold the models): the one with the list's model count
  const sizes = entriesBelow(sys, w.node).filter(x => x.group && x.node.type === 'upgrade' && !x.group.tok.includes('>') && sys.children(x.node).some(k => k.type === 'model'));
  if (u.models && sizes.length > 1 && modelCount(r) !== u.models) {
    for (const s of sizes) {
      let r2 = null;
      try { r2 = E.chooseInGroup(sys, r, id, s.group.tok, s.tok); } catch { r2 = null; }
      if (r2 && modelCount(r2) === u.models) { r = r2; break; }
    }
  }
  // model types: the unit's own and those of its chosen size option
  const chosen = sizes.filter(s => E.view(sys, r).byId.get(id).ch.some(c => c.s.t === s.tok));
  const types = [...entriesBelow(sys, w.node), ...chosen.flatMap(s => entriesBelow(sys, s.node, 1, s.tok))].filter(x => x.node.type === 'model');
  if (!types.length) return r;
  const lines = (u.modelLines || []).map(m => ({ m, t: types.find(x => norm(x.node.name) === norm(m.name)) || onlyOne(types.filter(x => norm(x.node.name).startsWith(norm(m.name) + ' w '))) })).filter(x => x.t);
  if (!lines.length) {
    // no model lines: grow the biggest stack to the unit's model count
    const stacks = []; (function f(x) { for (const c of x.ch) { if (c.node && c.node.type === 'model') stacks.push(c); else f(c); } })(E.view(sys, r).byId.get(id));
    const cur = stacks.reduce((a, c) => a + c.n, 0);
    const big = stacks.sort((a, b) => b.n - a.n)[0];
    if (big && u.models > cur) r = E.setCount(r, big.s.id, big.n + u.models - cur);
    return r;
  }
  const seen = new Set();
  for (const { m, t } of lines) {
    V = E.view(sys, r);
    const ww = V.byId.get(id);
    const have = ww.ch.find(c => c.s.t === t.tok && !seen.has(c.s.id))
      || (stacksOf(r).find(s => s.c.node.name === t.node.name && !seen.has(s.c.s.id)) || {}).c;   // a stack inside the size option
    if (have) { r = E.setCount(r, have.s.id, m.count); seen.add(have.s.id); }
    else {
      // a model type of the chosen size option is added inside that option's selection, not as a second option
      const host = ww.ch.find(c => t.tok.startsWith(c.s.t + '>'));
      const pid = host ? host.s.id : id;
      r = E.addSel(sys, r, pid, host ? t.tok.slice(host.s.t.length + 1) : t.tok, m.count);
      const nw = E.view(sys, r).byId.get(pid); const c = nw && nw.ch[nw.ch.length - 1]; if (c) seen.add(c.s.id);
    }
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
    // "2 Multi-meltas" in the list may be one BSData option of that name ("2 Multi-meltas"), worth its count
    const alt = g.count > 1 ? norm(g.count + ' ' + g.name) : null;
    const isG = n => norm(n) === norm(g.name) || (!!alt && norm(n) === alt);
    const worth = c => (alt && norm(c.node.name) === alt ? g.count : 1);
    for (;;) {
      if (++tries > 12) break;
      const V = E.view(sys, r);
      const w = V.byId.get(id);
      const holders = [w]; (function f(x) { for (const c of x.ch) { if (!c.node) continue; if (c.node.type === 'model') holders.push(c); else if (c.ch.some(k => k.node && k.node.type === 'model')) f(c); } })(w);   // models also inside a composition entry ("1 Sergeant and 9 Troopers")
      const has = x => { let found = false; (function f(y) { for (const c of y.ch) { if (c.node && c.node.type !== 'model' && isG(c.node.name)) found = true; if (c.node && c.node.type !== 'model') f(c); } })(x); return found; };
      // a single model (or the unit itself) counts its weapons ("4x Lascannon" on a vehicle), a stack counts its models
      const mine = x => { const out = []; (function f(y) { for (const c of y.ch) { if (c.node && c.node.type !== 'model' && isG(c.node.name)) out.push(c); if (c.node && c.node.type !== 'model') f(c); } })(x); return out; };
      const single = h => h === w || h.n === 1;
      const current = holders.reduce((t, h) => t + (single(h) ? mine(h).reduce((a, c) => a + c.n * worth(c), 0) : has(h) ? h.n : 0), 0);
      let need = Math.max(1, g.count) - current;
      if (need <= 0) { matched = true; break; }
      // more of a weapon a single model already has: raise its count, as far as the rules allow
      const grow = holders.filter(single).map(h => mine(h)[0]).find(Boolean);
      if (grow) {
        const before = E.validate(V).length;
        const r2 = E.setCount(r, grow.s.id, grow.n + need);
        if (E.validate(E.view(sys, r2)).length <= before) { r = r2; continue; }
      }
      const cands = holders.filter(h => !has(h)).map(h => ({ h, e: entriesBelow(sys, h.node).find(x => x.node.type !== 'model' && norm(x.node.name) === norm(g.name)) || (alt && entriesBelow(sys, h.node).find(x => x.node.type !== 'model' && norm(x.node.name) === alt)) })).filter(c => c.e);
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
    if (!matched) {
      // the weapon is a model type of its own ("20x Gauss Reaper" → "Warrior w/ gauss reaper"): that many models change type
      const r2 = modelOfWeapon(sys, r, id, g);
      if (r2) r = r2; else missing.push(g);
    }
  }
  if (missing.length) r = bundles(sys, r, id, u, missing);
  for (const g of missing) report.push(`${u.name}: wargear not matched: ${g.count > 1 ? g.count + '× ' : ''}${g.name}`);
  return r;
}

/** A weapon line that names a model type of the unit ("• 20x Gauss Reaper" – BSData: "Warrior w/ gauss reaper"): that many
 *  models of the other types of its group become this type. The new roster, or null when there is no such model type. */
function modelOfWeapon(sys, r, id, g) {
  const V = E.view(sys, r);
  const w = V.byId.get(id);
  const t = entriesBelow(sys, w.node).find(x => x.node.type === 'model' && / w /.test(' ' + norm(x.node.name) + ' ') && norm(x.node.name).endsWith(' w ' + norm(g.name)));
  if (!t) return null;
  const par = s => s.split('>').slice(0, -1).join('>');
  const stacks = w.ch.filter(c => c.node && c.node.type === 'model');
  const have = stacks.filter(c => c.s.t === t.tok).reduce((a, c) => a + c.n, 0);
  let need = Math.max(1, g.count) - have;
  if (need <= 0) return r;
  // models that give way: other types of the same group, not the unit's leader model, biggest first
  const from = stacks.filter(c => c.s.t !== t.tok && par(c.s.t) === par(t.tok) && E.limits(V, c.node, c, w).max !== 1).sort((p, q) => q.n - p.n);
  if (!from.length) return null;
  let moved = 0;
  for (const c of from) {
    if (need <= 0) break;
    const k = Math.min(need, c.n);
    r = k >= c.n ? E.removeSel(r, c.s.id) : E.setCount(r, c.s.id, c.n - k);
    need -= k; moved += k;
  }
  if (!moved) return null;
  const cur = E.view(sys, r).byId.get(id).ch.find(c => c.s.t === t.tok);
  return cur ? E.setCount(r, cur.s.id, cur.n + moved) : E.addSel(sys, r, id, t.tok, moved);
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
  r = revealUnits(sys, r);
  r = E.autoSync(sys, r);
  const hasWl = E.view(sys, r).force.ch.some(w => w.ch.some(c => c.node && /^Warlord$/i.test(c.node.name)));
  const notes = importNotes(sys, r, report, [], null, hasWl);
  r.importNotes = notes;
  return { army: r, sys, report, notes, units: r.sel.length };
}
