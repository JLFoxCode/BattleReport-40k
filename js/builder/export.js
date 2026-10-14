/* Army list → New Recruit text (WTC layout, the format engine/reduce.js parseArmyText reads) + the game's faction /
 * detachment choice. Used to take a saved list into a game and to copy it as text. */
import { view, totalCost, effective } from './bs-engine.js';

const CONFIG = /^(Battle Size|Detachment|Force Disposition|Show\/Hide Options|Show Legends|Order of Battle|Show Unaligned|Show Crucible)/i;
const ENH_GROUP = /Enhancement/i;
const nameOf = (V, w) => effective(V, w.node, w, w.parent).name;
const isConfig = w => w.node && w.node.type === 'upgrade' && CONFIG.test(w.node.name);
const isEnh = w => w.groups.some(g => ENH_GROUP.test(g.name));
const models = w => w.ch.reduce((x, c) => x + (c.node && c.node.type === 'model' ? c.n : 0) + (c.node && c.node.type === 'upgrade' ? models(c) * c.n : 0), 0);

/** Wargear of a selection: its upgrade children (no enhancements / Warlord), counts per one instance. */
function gearOf(V, w) {
  const out = [];
  for (const c of w.ch) {
    if (!c.node || c.node.type === 'model' || isEnh(c) || /^Warlord$/i.test(c.node.name)) continue;
    if (c.ch.some(k => k.node && k.node.type === 'model')) continue;   // size options ("5 models") hold the models
    out.push({ name: nameOf(V, c), n: c.n });
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
  const cfg = name => V.force.ch.filter(w => w.node && w.node.name === name).flatMap(w => w.ch.map(c => nameOf(V, c)));
  const units = [];
  for (const w of V.force.ch) {
    if (!w.node || isConfig(w) || !['unit', 'model'].includes(w.node.type)) continue;
    const stacks = modelStacks(w);
    const n = w.node.type === 'model' ? w.n : Math.max(1, stacks.reduce((x, [, k]) => x + k, 0));
    units.push({
      id: w.s.id, name: nameOf(V, w), pts: totalCost(V, w), models: n, character: [...(w.node.categoryLinks || [])].some(c => /Character/i.test(c.name || '')),
      warlord: w.ch.some(c => c.node && /^Warlord$/i.test(c.node.name)),
      enhancements: w.ch.filter(isEnh).map(c => ({ name: nameOf(V, c), pts: totalCost(V, c) })),
      gear: gearOf(V, w), stacks: stacks.map(([m, k]) => ({ name: nameOf(V, m), n: k, gear: gearOf(V, m) }))
    });
  }
  const size = (cfg('Battle Size')[0] || '').replace(/^\d+\.\s*/, '').replace(/\s*\(.*$/, '');
  return { detachments: cfg('Detachment'), disposition: cfg('Force Disposition')[0] || null, size, units, points: units.reduce((x, u) => x + u.pts, 0) };
}

/** New Recruit WTC text of the list (parseArmyText reads it back: units, models, wargear, Warlord, enhancements). */
export function armyText(sys, roster, meta = {}) {
  const s = summarize(sys, roster);
  const L = [];
  L.push('+++++++++++++++++++++++++++++++++++++++++++++++');
  if (meta.faction) L.push('+ FACTION KEYWORD: ' + meta.faction);
  if (s.detachments.length) L.push('+ DETACHMENT: ' + s.detachments.join(', '));
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
  }
  L.push('Created with Battle Report 40k');
  return L.join('\n') + '\n';
}
