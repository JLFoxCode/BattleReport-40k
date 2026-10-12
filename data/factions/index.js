/* Faction library: seed (all factions, detachment names) + detail files (stratagems).
 * Same faction id → the detail file adds/replaces detachments (by id). */
import { ARMY_SEED } from './seed.js';
import sororitas from './adepta-sororitas.js';
import militarum from './astra-militarum.js';
import custodes from './custodes.js';
import necrons from './necrons.js';
import orks from './orks.js';
import tau from './tau.js';
import marines from './space-marines.js';
import space_wolves from './space-wolves.js';
import deathwatch from './deathwatch.js';
import dark_angels from './dark-angels.js';
import blood_angels from './blood-angels.js';
import black_templars from './black-templars.js';
import adeptus_mechanicus from './adeptus-mechanicus.js';
import aeldari from './aeldari.js';
import chaos_daemons from './chaos-daemons.js';
import chaos_knights from './chaos-knights.js';
import chaos_space_marines from './chaos-space-marines.js';
import death_guard from './death-guard.js';
import drukhari from './drukhari.js';
import emperors_children from './emperors-children.js';
import genestealer_cults from './genestealer-cults.js';
import grey_knights from './grey-knights.js';
import imperial_agents from './imperial-agents.js';
import imperial_knights from './imperial-knights.js';
import thousand_sons from './thousand-sons.js';
import tyranids from './tyranids.js';
import world_eaters from './world-eaters.js';

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const clone = o => JSON.parse(JSON.stringify(o));

function normStrat(s, facId, detId, i) {
  return Object.assign({ id: s.id || (detId + '--' + slug(s.name || 'strat-' + i)), when: '', target: '', effect: '', restr: '', t: '' }, s,
    { cost: Number(s.cost) || 0, ph: Array.isArray(s.ph) && s.ph.length ? s.ph : ['any'], whose: s.whose || 'either', timing: s.timing || 'any', type: 'Detachment' });
}
function normDet(d, facId) {
  const id = d.id || (facId + '--' + slug(d.name));
  return Object.assign({ dp: 0, rule: '', resource: null }, d, { id, strats: (d.strats || []).map((s, i) => normStrat(s, facId, id, i)) });
}
function normFac(f) {
  const id = f.id || slug(f.name);
  return Object.assign({ group: '', rule: '', resource: null }, f, { id, detachments: (f.detachments || []).map(d => normDet(d, id)) });
}

const out = clone(ARMY_SEED.factions).map(normFac);
[].concat(sororitas, militarum, custodes, necrons, orks, tau, marines, adeptus_mechanicus, aeldari, chaos_daemons, chaos_knights, chaos_space_marines, death_guard, drukhari, emperors_children, genestealer_cults, grey_knights, imperial_agents, imperial_knights, thousand_sons, tyranids, world_eaters, black_templars, blood_angels, dark_angels, deathwatch, space_wolves).forEach(raw => {
  const f = normFac(clone(raw));
  const base = out.find(x => x.id === f.id) || out.find(x => norm(x.name) === norm(f.name));
  if (!base) { out.push(f); return; }
  ['name', 'group', 'rule', 'resource', 'reminders'].forEach(k => { if (raw[k] != null && raw[k] !== '') base[k] = f[k]; });
  f.detachments.forEach(d => {
    const j = base.detachments.findIndex(x => x.id === d.id || norm(x.name) === norm(d.name));
    if (j >= 0) base.detachments[j] = d; else base.detachments.push(d);
  });
});
// Do not offer factions without detachments (e.g. Adeptus Titanicus)
const filtered = out.filter(f => f.detachments.length > 0);
filtered.sort((a, b) => a.name.localeCompare(b.name, 'de'));

export const FACTIONS = filtered;
export const factionById = id => FACTIONS.find(f => f.id === id) || null;
export const detachmentById = (facId, detId) => { const f = factionById(facId); return f ? f.detachments.find(d => d.id === detId) || null : null; };
