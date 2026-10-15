/* Army list → New Recruit text (WTC layout, the format engine/reduce.js parseArmyText reads) + the game's faction /
 * detachment choice. Used to take a saved list into a game and to copy it as text. */
import { view, totalCost, effective, categoriesOfSel, limits } from './bs-engine.js';
import { profileChanges } from './profiles.js';

const CONFIG = /^(Battle Size|Detachment|Force Disposition|Show\/Hide Options|Show Legends|Order of Battle|Show Unaligned|Show Crucible)/i;
const ENH_GROUP = /Enhancement/i;
const nameOf = (V, w) => effective(V, w.node, w, w.parent).name;
const isConfig = w => w.node && w.node.type === 'upgrade' && CONFIG.test(w.node.name);
const isEnh = w => w.groups.some(g => ENH_GROUP.test(g.name));
const models = w => w.ch.reduce((x, c) => x + (c.node && c.node.type === 'model' ? c.n : 0) + (c.node && c.node.type === 'upgrade' ? models(c) * c.n : 0), 0);

/** Wargear of a selection: its upgrade children (no enhancements / Warlord), counts per one instance. */
function gearOf(V, w, mult = 1) {
  const out = [];
  for (const c of w.ch) {
    if (!c.node || c.node.type === 'model' || isEnh(c) || /^Warlord$/i.test(c.node.name)) continue;
    if (c.ch.some(k => k.node && k.node.type === 'model')) continue;   // size options ("5 models") hold the models
    // a bundle ("Axe and flail") holds the weapons: list those, so the game's datasheet finds them
    if (c.ch.some(k => k.node && k.node.type === 'upgrade')) { out.push(...gearOf(V, c, c.n * mult)); continue; }
    out.push({ name: nameOf(V, c), n: c.n * mult });
  }
  return out;
}
/** Model stacks of a unit (also inside size options). */
function modelStacks(w, mult = 1) {
  const out = [];
  for (const c of w.ch) {
    if (!c.node) continue;
    if (c.node.type === 'model') out.push([c, c.n * mult]);
    else if (c.node.type === 'upgrade' && c.ch.length) out.push(...modelStacks(c, c.n * mult));
  }
  return out;
}

/** { faction, detachments: [names], size, points, units: [{ name, pts, models, warlord, enhancements, text }] } */
export function summarize(sys, roster) {
  const V = view(sys, roster);
  const cfg = name => V.force.ch.filter(w => w.node && (name === 'Detachment' ? /^Detachments?$/.test(w.node.name) : w.node.name === name)).flatMap(w => w.ch.map(c => nameOf(V, c)));
  const units = [];
  for (const w of V.force.ch) {
    if (!w.node || isConfig(w) || !['unit', 'model'].includes(w.node.type)) continue;
    const stacks = modelStacks(w);
    // keywords exactly as the data has them for this unit in this army (choices included: Character Upgrade → CHARACTER,
    // an allegiance → KHORNE …); "Faction: X" → faction keywords; "Allies: …", Configuration … are no keywords
    const cats = [...categoriesOfSel(V, w)].map(id => sys.categoryNames.get(id)).filter(Boolean);
    const kw = cats.filter(c => !/^(Faction:|Allies:)/i.test(c) && !/^(Configuration|Unit|Warlord|Legends)$/i.test(c)).map(c => c.toUpperCase());
    const fkw = cats.filter(c => /^Faction:/i.test(c)).map(c => c.replace(/^Faction:\s*/i, '').toUpperCase());
    const n = w.node.type === 'model' ? w.n : Math.max(1, stacks.reduce((x, [, k]) => x + k, 0));
    units.push({
      id: w.s.id, name: nameOf(V, w), pts: totalCost(V, w), leads: w.s.lead && V.byId.get(w.s.lead) ? nameOf(V, V.byId.get(w.s.lead)) : null, models: n, character: kw.includes('CHARACTER'), keywords: [...new Set(kw)], factionKeywords: [...new Set(fkw)],
      // profile changes (enhancements, wargear) for the datasheets in the game – the attached unit evaluated as one
      mods: (() => { try { const body = w.s.lead ? V.byId.get(w.s.lead) : w; return profileChanges(V, w, body ? [body, ...V.force.ch.filter(y => y.s.lead === body.s.id)] : [w]); } catch { return null; } })(),
      warlord: w.ch.some(c => c.node && /^Warlord$/i.test(c.node.name)),
      enhancements: w.ch.filter(isEnh).map(c => ({ name: nameOf(V, c), pts: totalCost(V, c) })),
      gear: gearOf(V, w), stacks: stacks.map(([m, k]) => ({ name: nameOf(V, m), n: k, gear: gearOf(V, m) }))
    });
  }
  // which instance is led: "[n]" = n-th unit of that name in the list (two same-named bodyguard units stay apart)
  for (const w of V.force.ch) {
    const u = w.s && w.s.lead ? units.find(x => x.id === w.s.id) : null;
    const t = u ? units.find(x => x.id === w.s.lead) : null;
    if (t) { const same = units.filter(x => x.name === t.name); u.leadsNth = same.length > 1 ? same.indexOf(t) + 1 : 0; }
  }
  const size = (cfg('Battle Size')[0] || '').replace(/^\d+\.\s*/, '').replace(/\s*\(.*$/, '');
  return { detachments: cfg('Detachment'), disposition: cfg('Force Disposition')[0] || null, dispositions: dispositionsOf(sys, V), size, units, points: units.reduce((x, u) => x + u.pts, 0) };
}

/** Force Dispositions the army's detachments make available (the options of the Force Disposition configuration that are
 *  not hidden) – the game offers only these in the Mission step. [] when the data has no such choice. */
function dispositionsOf(sys, V) {
  const out = [];
  for (const w of V.force.ch.filter(x => x.node && x.node.name === 'Force Disposition')) {
    const walk = (n, d) => {
      if (d > 2) return;
      for (const k of sys.children(n)) {
        if (limits(V, k, null, w).hidden) continue;
        if (k.group) walk(k, d + 1); else out.push(String(k.name || '').replace(/^\d+\.\s*/, ''));
      }
    };
    try { walk(w.node, 0); } catch { /* data without the choice */ }
  }
  return [...new Set(out.filter(Boolean))];
}

/** New Recruit WTC text of the list (parseArmyText reads it back: units, models, wargear, Warlord, enhancements). */
export function armyText(sys, roster, meta = {}) {
  const s = summarize(sys, roster);
  const L = [];
  L.push('+++++++++++++++++++++++++++++++++++++++++++++++');
  if (meta.faction) L.push('+ FACTION KEYWORD: ' + meta.faction);
  if (s.detachments.length) L.push('+ DETACHMENT: ' + s.detachments.join(', '));
  if (s.disposition) L.push('+ FORCE DISPOSITION: ' + s.disposition);
  if (s.dispositions.length) L.push('+ FORCE DISPOSITIONS AVAILABLE: ' + s.dispositions.join(', '));
  L.push('+ TOTAL ARMY POINTS: ' + s.points + 'pts');
  L.push('+++++++++++++++++++++++++++++++++++++++++++++++');
  let ci = 0;
  for (const u of s.units) {
    const pre = u.character ? 'Char' + (++ci) + ': ' : '';
    const gear = [u.warlord ? 'Warlord' : null, ...u.gear.map(g => (g.n > 1 ? g.n + 'x ' : '') + g.name)].filter(Boolean);
    const single = u.stacks.length <= 1 && (!u.stacks[0] || !u.stacks[0].gear.length || u.models === 1);
    if (single) {
      const all = gear.concat(u.stacks[0] ? u.stacks[0].gear.map(g => (g.n > 1 ? g.n + 'x ' : '') + g.name) : []);
      L.push(`${pre}${u.models}x ${u.name} (${u.pts} pts)${all.length ? ': ' + all.join(', ') : ''}`);
    } else {
      L.push(`${pre}${u.models}x ${u.name} (${u.pts} pts)${gear.length ? ': ' + gear.join(', ') : ''}`);
      for (const m of u.stacks) {
        const g = m.gear.map(x => x.name);
        L.push(`• ${m.n}x ${m.name}${g.length ? ': ' + (m.n > 1 ? m.n + ' with ' : '') + g.join(', ') : ''}`);
      }
    }
    for (const e of u.enhancements) L.push(`Enhancement: ${e.name} (+${e.pts} pts)`);
    if (u.leads) L.push(`Leading ${u.leads}${u.leadsNth ? '[' + u.leadsNth + ']' : ''}`);
  }
  L.push('Created with Battle Report 40k');
  return L.join('\n') + '\n';
}
