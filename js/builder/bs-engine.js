// BattleScribe roster engine for the army builder (isomorphic: browser/WebView + Node, no dependencies).
// Reads the BSData catalogues (BattleScribe JSON, the same files New Recruit uses) and evaluates them like New Recruit:
// available entries, option groups, hidden flags, constraints (min/max) and costs – all with their modifiers and
// conditions. Rosters are plain JSON (stored by js/builder/store.js):
//
//   roster = { id, name, catalogueId, limit, sel: [Sel] }          (one "Army Roster" force)
//   Sel    = { id, t: 'token>token', n, ch: [Sel] }                 t = path of entry/link/group ids below the parent
//
// n is the number per parent instance (a model stack of 9 has n = 9; its weapon has n = 1 = one per model).

const PTS = '51b2-306e-1021-d207';
const ARMY_ROSTER = 'bb9d-299a-ed60-2d8a';   // force entry of the game system ("Army Roster")
let uid = 0;
export const newId = () => 's' + Date.now().toString(36) + (uid++).toString(36) + Math.random().toString(36).slice(2, 6);
const arr = v => (Array.isArray(v) ? v : []);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export class BSystem {
  /** docs: array of parsed BattleScribe JSON roots ({ gameSystem } / { catalogue }) – game system + the catalogues needed. */
  constructor(docs) {
    this.idx = new Map();
    this.cats = new Map();
    this.gst = null;
    for (const d of docs) {
      const r = d && (d.catalogue || d.gameSystem);
      if (!r) continue;
      if (d.gameSystem) this.gst = r;
      this.cats.set(r.id, r);
      const idx = this.idx;
      (function walk(o) {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { for (const x of o) walk(x); return; }
        if (typeof o.id === 'string' && !idx.has(o.id)) idx.set(o.id, o);
        for (const k in o) if (k !== 'id' && typeof o[k] === 'object') walk(o[k]);
      })(r);
    }
    if (!this.gst) throw new Error('Game system missing');
    this.forceEntry = arr(this.gst.forceEntries).find(f => f.id === ARMY_ROSTER) || arr(this.gst.forceEntries)[0];
    this.nodeCache = new Map();
    this.categoryNames = new Map();
    for (const c of this.cats.values()) for (const ce of arr(c.categoryEntries)) this.categoryNames.set(ce.id, ce.name);
  }

  // ───────── Entry nodes (entry / group, merged with the link that points to it) ─────────
  node(el, link) {
    const key = (link ? link.id : '') + '|' + el.id;
    let n = this.nodeCache.get(key);
    if (n) return n;
    const isGroup = !el.type || el.type === 'selectionEntryGroup' || (link && link.type === 'selectionEntryGroup');
    const L = link || {};
    n = {
      token: link ? link.id : el.id,
      id: el.id, linkId: link ? link.id : null, el, link,
      group: isGroup,
      name: L.name || el.name,
      type: isGroup ? 'group' : el.type,
      hidden: !!(el.hidden || L.hidden),
      collective: !!(el.collective || L.collective),
      constraints: [...arr(el.constraints), ...arr(L.constraints)],
      modifiers: [...arr(el.modifiers), ...arr(L.modifiers)],
      modifierGroups: [...arr(el.modifierGroups), ...arr(L.modifierGroups)],
      costs: arr(L.costs).length ? arr(L.costs) : arr(el.costs),
      categoryLinks: [...arr(el.categoryLinks), ...arr(L.categoryLinks)],
      defaultId: el.defaultSelectionEntryId && el.defaultSelectionEntryId !== 'none' ? el.defaultSelectionEntryId : null,
      sortIndex: L.sortIndex != null ? L.sortIndex : el.sortIndex,
      profiles: [...arr(el.profiles), ...arr(L.profiles)],
      infoLinks: [...arr(el.infoLinks), ...arr(L.infoLinks)],
      rules: [...arr(el.rules), ...arr(L.rules)],
      _children: null
    };
    n.ids = new Set([n.id, n.linkId].filter(Boolean));
    n.primaryCategory = (n.categoryLinks.find(c => c.primary) || {}).targetId || null;
    this.nodeCache.set(key, n);
    return n;
  }
  /** Children of an entry or group (entries, groups and links), sorted like BattleScribe (sortIndex, then name). */
  children(n) {
    if (n._children) return n._children;
    const out = [];
    const el = n.el;
    for (const e of arr(el.selectionEntries)) out.push(this.node(e, null));
    for (const g of arr(el.selectionEntryGroups)) out.push(this.node(g, null));
    for (const l of arr(el.entryLinks)) { const t = this.idx.get(l.targetId); if (t) out.push(this.node(t, l)); }
    out.sort((a, b) => (num(a.sortIndex) - num(b.sortIndex)) || String(a.name).localeCompare(String(b.name), 'en', { numeric: true }));
    return (n._children = out);
  }
  /** Root entries a force of `catalogueId` can select: catalogue root (+ imported roots of linked catalogues) + game system roots. */
  rootNodes(catalogueId) {
    const key = 'root|' + catalogueId;
    if (this.nodeCache.has(key)) return this.nodeCache.get(key);
    const out = []; const seen = new Set();
    const add = c => {
      if (!c || seen.has(c.id)) return; seen.add(c.id);
      for (const e of arr(c.selectionEntries)) out.push(this.node(e, null));
      for (const l of arr(c.entryLinks)) { const t = this.idx.get(l.targetId); if (t) out.push(this.node(t, l)); }
      for (const cl of arr(c.catalogueLinks)) if (cl.importRootEntries) add(this.cats.get(cl.targetId));
    };
    add(this.cats.get(catalogueId));
    add(this.gst);
    this.nodeCache.set(key, out);
    return out;
  }
  /** Node for a token path below a parent node (or the force root when parent is null). */
  resolve(parentNode, t, catalogueId) {
    const toks = String(t).split('>');
    let list = parentNode ? this.children(parentNode) : this.rootNodes(catalogueId);
    let n = null;
    for (const tok of toks) {
      n = list.find(x => x.token === tok) || null;
      if (!n) return null;
      list = this.children(n);
    }
    return n;
  }
  /** Group chain of a token path ([group…, entry]). */
  chain(parentNode, t, catalogueId) {
    const toks = String(t).split('>');
    let list = parentNode ? this.children(parentNode) : this.rootNodes(catalogueId);
    const out = [];
    for (const tok of toks) {
      const n = list.find(x => x.token === tok);
      if (!n) return null;
      out.push(n); list = this.children(n);
    }
    return out;
  }
}

// ───────── Roster context: a resolved view of the roster used for every evaluation ─────────
/** Wraps a roster: resolves every selection to its node and builds parent links. */
export function view(sys, roster) {
  const V = { sys, roster, catalogueId: roster.catalogueId, all: [], byId: new Map(), force: null };
  const force = { kind: 'force', ids: new Set([sys.forceEntry && sys.forceEntry.id, roster.catalogueId].filter(Boolean)), ch: [], n: 1, parent: null };
  V.force = force;
  const rosterObj = { kind: 'roster', ch: [force], n: 1, parent: null, ids: new Set(['roster']) };
  force.parent = rosterObj; V.rosterObj = rosterObj;
  const wrap = (s, parent, parentNode) => {
    const ch = sys.chain(parentNode, s.t, roster.catalogueId);
    const node = ch ? ch[ch.length - 1] : null;
    const w = { kind: 'sel', s, node, groups: ch ? ch.slice(0, -1) : [], parent, n: Math.max(0, num(s.n) || 0), ch: [] };
    w.ids = new Set();
    if (node) { node.ids.forEach(i => w.ids.add(i)); w.groups.forEach(g => g.ids.forEach(i => w.ids.add(i))); }
    V.all.push(w); V.byId.set(s.id, w);
    if (node) w.ch = arr(s.ch).map(c => wrap(c, w, node)); else w.ch = [];
    return w;
  };
  force.ch = arr(roster.sel).map(s => wrap(s, force, null));
  return V;
}

/** Categories of a selection (category links of its node, after category modifiers). */
function categoriesOf(V, w) {
  if (w.kind !== 'sel' || !w.node) return new Set();
  if (w._cats) return w._cats;
  const cats = new Set(w.node.categoryLinks.map(c => c.targetId));
  w._cats = cats;   // set first: category modifiers may themselves test categories
  applyMods(V, w.node, w, (m, times) => {
    if (m.field !== 'category') return;
    if (m.type === 'add') cats.add(m.value); else if (m.type === 'remove') cats.delete(m.value);
  });
  return cats;
}
function matches(V, w, childId) {
  if (!childId || childId === 'any') return true;
  if (w.kind !== 'sel') return w.ids && w.ids.has(childId);
  if (w.ids.has(childId)) return true;
  const ty = w.node ? w.node.type : '';
  if (childId === 'model' || childId === 'unit' || childId === 'upgrade') return ty === childId;
  return categoriesOf(V, w).has(childId);
}
/** Selections below `scope` (direct children, or all descendants), with their effective multiplicity relative to scope. */
function descendants(scope, deep, out = [], mult = 1) {
  for (const c of scope.ch || []) {
    if (c.kind === 'force') { descendants(c, deep, out, mult); continue; }
    const m = mult * c.n;
    out.push([c, m]);
    if (deep) descendants(c, deep, out, m);
  }
  return out;
}
function costOf(V, w) {
  if (w._cost) return w._cost;
  const out = {};
  if (w.node) {
    for (const c of w.node.costs) out[c.typeId] = num(c.value);
    applyMods(V, w.node, w, (m, times) => {
      if (!isCostType(V, m.field)) return;
      out[m.field] = modNum(out[m.field] || 0, m, times);
    });
  }
  w._cost = out;
  return out;
}
const costTypeIds = new WeakMap();
function isCostType(V, id) {
  let s = costTypeIds.get(V.sys);
  if (!s) { s = new Set(arr(V.sys.gst.costTypes).map(c => c.id)); costTypeIds.set(V.sys, s); }
  return s.has(id);
}
/** Total cost (type) of a selection including its children, for one instance of its parent. */
export function totalCost(V, w, type = PTS) {
  const own = num(costOf(V, w)[type]);
  const kids = (w.ch || []).reduce((x, c) => x + totalCost(V, c, type), 0);
  return w.n * (own + kids);
}
function sumCost(V, scope, childId, deep, type) {
  if (scope.kind === 'sel' && !childId) return totalCost(V, scope, type) / Math.max(1, scope.n);
  return descendants(scope, true).filter(([c]) => matches(V, c, childId)).reduce((x, [c, m]) => x + m / Math.max(1, c.n) * num(costOf(V, c)[type]) * c.n, 0);
}

// ───────── Conditions ─────────
function scopeObj(V, scope, self, parent) {
  const sel = self || parent;
  switch (scope) {
    case 'self': return self || parent;
    case 'parent': return parent || V.force;
    case 'force': return V.force;
    case 'roster': return V.rosterObj;
    case 'primary-catalogue': return { kind: 'catalogue', ids: new Set([V.catalogueId]) };
    case 'root-entry': { let x = sel; while (x && x.parent && x.parent.kind === 'sel') x = x.parent; return x && x.kind === 'sel' ? x : V.force; }
    case 'ancestor': return parent || V.force;
    case 'unit': case 'unit-self': case 'model': case 'upgrade': {
      const ty = scope === 'unit-self' ? 'unit' : scope;
      let x = sel; while (x && x.kind === 'sel' && !(x.node && x.node.type === ty)) x = x.parent;
      return x && x.kind === 'sel' ? x : null;
    }
    default: {
      let x = sel;
      while (x) { if (x.kind === 'sel' ? matches(V, x, scope) : x.ids && x.ids.has(scope)) return x; x = x.parent; }
      return null;
    }
  }
}
function countIn(V, c, scope) {
  if (!scope) return 0;
  const deep = !!c.includeChildSelections || scope.kind === 'force' && c.includeChildSelections !== false && c.scope !== 'force' || scope.kind === 'roster';
  if (c.field === 'selections') {
    if (scope.kind === 'catalogue') return 0;
    return descendants(scope, deep).filter(([w]) => matches(V, w, c.childId)).reduce((x, [, m]) => x + m, 0);
  }
  if (c.field === 'forces') return V.force.ids.has(c.childId) || !c.childId || c.childId === 'any' ? 1 : 0;
  if (/^limit::/.test(c.field)) return num(V.roster.limit);
  if (isCostType(V, c.field)) return sumCost(V, scope, c.childId, deep, c.field);
  return 0;
}
function cmp(type, v, ref) {
  switch (type) {
    case 'atLeast': return v >= ref;
    case 'atMost': return v <= ref;
    case 'greaterThan': return v > ref;
    case 'lessThan': return v < ref;
    case 'equalTo': return v === ref;
    case 'notEqualTo': return v !== ref;
    default: return false;
  }
}
function evalCond(V, c, self, parent) {
  const scope = scopeObj(V, c.scope, self, parent);
  if (c.type === 'instanceOf' || c.type === 'notInstanceOf') {
    let is = false;
    if (c.scope === 'ancestor') { let x = parent; while (x && !is) { is = x.kind === 'sel' ? matches(V, x, c.childId) : !!(x.ids && x.ids.has(c.childId)); x = x.parent; } }
    else if (scope) is = scope.kind === 'sel' ? matches(V, scope, c.childId) : !!(scope.ids && scope.ids.has(c.childId));
    if (!is && c.scope === 'primary-catalogue') is = catalogueImports(V, c.childId);
    return c.type === 'instanceOf' ? is : !is;
  }
  return cmp(c.type, countIn(V, c, scope), num(c.value));
}
function catalogueImports(V, id) {
  const seen = new Set();
  const walk = cid => { if (seen.has(cid)) return false; seen.add(cid); if (cid === id) return true; const c = V.sys.cats.get(cid); return !!c && arr(c.catalogueLinks).some(l => walk(l.targetId)); };
  return walk(V.catalogueId);
}
function evalGroup(V, g, self, parent) {
  const parts = [...arr(g.conditions).map(c => () => evalCond(V, c, self, parent)), ...arr(g.conditionGroups).map(x => () => evalGroup(V, x, self, parent)),
    ...arr(g.localConditionGroups).map(x => () => evalLocal(V, x, self, parent))];
  if (!parts.length) return true;
  return g.type === 'or' ? parts.some(f => f()) : parts.every(f => f());
}
/* New Recruit extension: count the selections in a scope that meet all `conditions` (evaluated on each of them; type
   "before" = it comes before the evaluated selection) – e.g. the 2nd+ copy of a unit costs more. */
function evalLocal(V, g, self, parent) {
  const scope = scopeObj(V, g.scope, self, parent);
  if (!scope) return false;
  const list = descendants(scope, !!g.includeChildSelections).map(([w]) => w);
  if (self && self.kind === 'sel' && !list.includes(self)) list.push(self);
  const ord = w => { const i = V.all.indexOf(w); return i < 0 ? Infinity : i; };
  const me = self ? ord(self) : Infinity;
  const n = list.filter(w => arr(g.conditions).every(c => c.type === 'before' ? ord(w) < me : evalCond(V, c, w, w.parent))).length;
  return cmp(g.type, n, num(g.value));
}
function repeatsOf(V, m, self, parent) {
  if (!arr(m.repeats).length) return 1;
  return arr(m.repeats).reduce((t, r) => {
    const v = countIn(V, r, scopeObj(V, r.scope, self, parent));
    const per = num(r.value) || 1;
    return t + (r.roundUp ? Math.ceil(v / per) : Math.floor(v / per)) * (num(r.repeats) || 1);
  }, 0);
}
function modNum(cur, m, times) {
  const v = num(m.value);
  switch (m.type) {
    case 'set': return v;
    case 'increment': return cur + v * times;
    case 'decrement': return cur - v * times;
    case 'multiply': return cur * Math.pow(v, times);
    case 'divide': return v ? cur / Math.pow(v, times) : cur;
    case 'floor': return Math.floor(cur);
    case 'ceil': return Math.ceil(cur);
    default: return cur;
  }
}
/** Walks all modifiers (incl. modifier groups) of a node whose conditions hold for `self` (selection or null) under `parent`. */
function applyMods(V, node, self, fn, parent = self ? self.parent : null) {
  const run = (mods, groups) => {
    for (const m of mods) {
      const ok = evalGroup(V, { type: 'and', conditions: m.conditions, conditionGroups: m.conditionGroups }, self, parent);
      if (!ok) continue;
      const times = repeatsOf(V, m, self, parent);
      if (arr(m.repeats).length && !times) continue;
      fn(m, times);
    }
    for (const g of groups) {
      if (!evalGroup(V, { type: 'and', conditions: g.conditions, conditionGroups: g.conditionGroups }, self, parent)) continue;
      run(arr(g.modifiers), arr(g.modifierGroups));
    }
  };
  run(node.modifiers, node.modifierGroups);
}

// ───────── Effective values ─────────
/** Hidden / name / constraints of a node, evaluated for selection `self` (or a would-be selection under `parent`). */
export function effective(V, node, self, parent) {
  let hidden = node.hidden, name = node.name;
  const errors = [];
  const cons = node.constraints.map(c => ({ ...c, value: num(c.value) }));
  const byId = new Map(cons.map(c => [c.id, c]));
  applyMods(V, node, self, (m, times) => {
    if (m.field === 'hidden') { if (m.type === 'set') hidden = m.value === true || m.value === 'true'; }
    else if (m.field === 'error' || m.field === 'warning') errors.push(String(m.value));
    else if (m.field === 'name') { if (m.type === 'set') name = String(m.value); else if (m.type === 'append') name = name + ' ' + m.value; }
    else if (byId.has(m.field)) { const c = byId.get(m.field); c.value = modNum(c.value, m, times); }
  }, parent);
  return { hidden, name, constraints: cons, errors };
}
/** Points of a node for one instance (selection or would-be selection). */
export function nodeCost(V, node, self, parent, type = PTS) {
  if (self) return num(costOf(V, self)[type]);
  const fake = { kind: 'sel', node, parent, n: 1, ch: [], ids: node.ids, groups: [], s: {} };
  return num(costOf(V, fake)[type]);
}
/** min/max (selections, scope parent or force/roster) of a node for the UI; max -1 = no limit. */
export function limits(V, node, self, parent) {
  const eff = effective(V, node, self, parent);
  let min = 0, max = -1;
  for (const c of eff.constraints) {
    if (c.field !== 'selections' || c.childId) continue;
    const perParent = c.scope === 'parent' || (node.group && c.scope === 'self') || (parent && parent.kind === 'force' && (c.scope === 'force' || c.scope === 'roster'));
    if (c.type === 'min' && perParent) min = Math.max(min, c.value);
    // a max in a wider scope (e.g. an enhancement: once per army) also caps the choice under one parent
    if (c.type === 'max' && c.value >= 0) max = max < 0 ? c.value : Math.min(max, c.value);
  }
  return { min, max, hidden: eff.hidden, name: eff.name };
}

/** Selections under `parent` (a wrapper) that were made from `node` (entry) or through `node` (group). */
export function selsOf(V, parent, node) {
  return (parent.ch || []).filter(w => w.node === node || w.groups.includes(node));
}
/** Count of `node` selections inside a constraint scope. */
function countNode(V, node, c, self, parent) {
  const scope = c.scope === 'parent' ? parent || V.force : scopeObj(V, c.scope, self, parent);
  if (!scope) return 0;
  if (c.field === 'selections') {
    if (c.childId) return countIn(V, c, scope);
    const deep = c.scope !== 'parent' && c.scope !== 'self';
    if (c.scope === 'self' && self) return descendants(self, !!c.includeChildSelections).reduce((x, [, m]) => x + m, 0);
    return descendants(scope, deep).filter(([w]) => w.node === node || w.groups.includes(node) || (w.ids.has(node.id) && !node.group)).reduce((x, [, m]) => x + m, 0);
  }
  if (isCostType(V, c.field)) return sumCost(V, scope, c.childId, true, c.field);
  return null;
}

// ───────── Validation ─────────
/** All problems of the roster: [{ sel: selection id | null, msg }]. */
export function validate(V) {
  const out = [];
  const label = w => (w && w.kind === 'sel' ? effective(V, w.node, w, w.parent).name : 'Army');
  const checkNode = (node, parent, owner) => {
    const sels = selsOf(V, parent, node);
    const self = node.group ? null : sels[0] || null;
    const eff = effective(V, node, self, parent);
    if (sels.length) for (const m of eff.errors) out.push({ sel: (owner ? owner.s.id : sels[0].s.id) || null, msg: `${owner ? label(owner) + ': ' : ''}${m}` });
    if (eff.hidden && !sels.length) { if (node.group) for (const k of V.sys.children(node)) checkNode(k, parent, owner); return; }   // not available here → its rules do not apply
    if (eff.hidden && sels.length) out.push({ sel: (sels[0].s || {}).id || null, msg: `${eff.name} is not available${owner ? ' for ' + label(owner) : ''}` });
    for (const c of eff.constraints) {
      if (c.field === 'associations' || (c.type === 'max' && c.value < 0)) continue;
      if (c.type === 'min' && !sels.length && c.scope === 'parent' && eff.hidden) continue;
      if (c.scope === 'self' && !self) continue;
      if (c.scope !== 'parent' && c.scope !== 'self' && !sels.length && c.type === 'max') continue;
      const v = countNode(V, node, c, self, parent);
      if (v == null) continue;
      const what = c.field === PTS ? ' pts' : '';
      if (c.type === 'min' && v < c.value) out.push({ sel: owner ? owner.s.id : null, msg: c.message || `${label(owner)}: ${eff.name} needs at least ${c.value}${what} (has ${v})` });
      if (c.type === 'max' && v > c.value) out.push({ sel: (sels[0] && sels[0].s.id) || (owner ? owner.s.id : null), msg: c.message || `${eff.name}: at most ${c.value}${what} ${c.scope === 'parent' ? (owner ? 'in ' + label(owner) : '') : 'per ' + (c.scope === 'force' || c.scope === 'roster' ? 'army' : c.scope)} (has ${v})` });
    }
    if (node.group) for (const k of V.sys.children(node)) checkNode(k, parent, owner);
  };
  // force: root entries (only those used or with a min) + category constraints of the force entry
  for (const n of V.sys.rootNodes(V.catalogueId)) {
    const used = selsOf(V, V.force, n).length;
    const hasMin = n.constraints.some(c => c.type === 'min');
    if (used || hasMin) checkNode(n, V.force, null);
  }
  for (const cl of arr(V.sys.forceEntry && V.sys.forceEntry.categoryLinks)) {
    const node = { modifiers: arr(cl.modifiers), modifierGroups: [], constraints: arr(cl.constraints), name: cl.name, hidden: false };
    const eff = effective(V, node, null, V.force);
    for (const c of eff.constraints) {
      const v = descendants(V.force, false).filter(([w]) => categoriesOf(V, w).has(cl.targetId)).reduce((x, [, m]) => x + m, 0);
      if (c.type === 'min' && v < c.value) out.push({ sel: null, msg: c.message || `At least ${c.value} ${cl.name} required (has ${v})` });
      if (c.type === 'max' && c.value >= 0 && v > c.value) out.push({ sel: null, msg: c.message || `At most ${c.value} ${cl.name} allowed (has ${v})` });
    }
  }
  // selections: their children
  const walk = w => {
    if (!w.node) { out.push({ sel: w.s.id, msg: 'Unknown entry (data changed?)' }); return; }
    for (const k of V.sys.children(w.node)) checkNode(k, w, w);
    w.ch.forEach(walk);
  };
  V.force.ch.forEach(walk);
  const pts = totalPoints(V);
  if (num(V.roster.limit) > 0 && pts > num(V.roster.limit)) out.push({ sel: null, msg: `${pts} / ${V.roster.limit} pts – over the points limit` });
  const seen = new Set();
  return out.filter(e => { const k = e.sel + '|' + e.msg; if (seen.has(k)) return false; seen.add(k); return true; });
}
export function totalPoints(V) { return V.force.ch.reduce((x, w) => x + totalCost(V, w), 0); }

// ───────── Editing (pure: returns a new roster) ─────────
const clone = o => JSON.parse(JSON.stringify(o));
function findSel(list, id) {
  for (const s of list) { if (s.id === id) return s; const r = findSel(arr(s.ch), id); if (r) return r; }
  return null;
}
function parentList(roster, parentId) { return parentId ? (findSel(roster.sel, parentId) || {}).ch : roster.sel; }

/** New selection of `node` (token path `t`) with all mandatory children / defaults filled in. */
export function instantiate(sys, V, node, t, parentW, n = 1) {
  const s = { id: newId(), t, n, ch: [] };
  fillDefaults(sys, V, node, s, parentW);
  return s;
}
function fillDefaults(sys, V, node, s, parentW) {
  // wrapper for condition evaluation of the new selection (not yet in the roster)
  const w = { kind: 'sel', s, node, groups: [], parent: parentW, n: s.n, ch: [], ids: node.ids };
  const visit = (list, prefix) => {
    for (const k of list) {
      const lim = limits(V, k, null, w);
      if (lim.hidden) continue;
      const tok = prefix ? prefix + '>' + k.token : k.token;
      if (k.group) {
        // configuration entries (Detachment, Battle Size …): a choice without a default is left to the player
        const ask = !k.defaultId && node.type === 'upgrade' && parentW && parentW.kind === 'force';
        if (lim.min > 0 && !ask) {
          // fill the group's minimum: entries with their own minimum first (e.g. the Sergeant), then the default
          // entry (or the first one) up to its maximum, then the next ones
          const opts = sys.children(k).filter(x => !x.group).map(x => ({ x, l: limits(V, x, null, w) })).filter(o => !o.l.hidden);
          const counts = new Map();
          let left = lim.min;
          for (const o of opts) if (o.l.min > 0 && left > 0) { const c = Math.min(o.l.min, left); counts.set(o.x, c); left -= c; }
          const order = opts.slice().sort((p, q) => (q.x.id === k.defaultId || q.x.linkId === k.defaultId ? 1 : 0) - (p.x.id === k.defaultId || p.x.linkId === k.defaultId ? 1 : 0));
          for (const o of order) {
            if (left <= 0) break;
            const have = counts.get(o.x) || 0;
            const room = o.l.max < 0 ? left : Math.max(0, Math.min(left, o.l.max - have));
            if (room > 0) { counts.set(o.x, have + room); left -= room; }
          }
          if (counts.size) {
            for (const o of opts) {
              const n = counts.get(o.x); if (!n) continue;
              const c = { id: newId(), t: tok + '>' + o.x.token, n, ch: [] };
              fillDefaults(sys, V, o.x, c, w);
              s.ch.push(c);
            }
            continue;
          }
        }
        visit(sys.children(k), tok);   // nested groups / entries with their own min
      } else if (lim.min > 0) {
        const c = { id: newId(), t: tok, n: lim.min, ch: [] };
        fillDefaults(sys, V, k, c, w);
        s.ch.push(c);
      }
    }
  };
  visit(sys.children(node), '');
}

export function addSel(sys, roster, parentId, t, n = 1) {
  const r = clone(roster);
  const V = view(sys, r);
  const parentW = parentId ? V.byId.get(parentId) : V.force;
  const node = sys.resolve(parentId ? parentW.node : null, t, r.catalogueId);
  if (!node) return r;
  const s = instantiate(sys, V, node, t, parentW, n);
  parentList(r, parentId).push(s);
  return r;
}
export function removeSel(roster, id) {
  const r = clone(roster);
  const rm = list => { const i = list.findIndex(s => s.id === id); if (i >= 0) { list.splice(i, 1); return true; } return list.some(s => rm(arr(s.ch))); };
  rm(r.sel);
  return r;
}
export function setCount(roster, id, n) {
  const r = clone(roster);
  const s = findSel(r.sel, id);
  if (s) s.n = Math.max(0, n);
  return r;
}
/** Exclusive choice in a group with max 1: replace whatever was chosen in that group below parent. */
export function chooseInGroup(sys, roster, parentId, groupTok, t) {
  const r0 = clone(roster);
  const list = parentList(r0, parentId);
  const prefix = groupTok + '>';
  const old = list.filter(s => s.t.startsWith(prefix));
  const n = old.reduce((x, s) => x + num(s.n), 0) || 1;
  const r1 = { ...r0, sel: r0.sel };
  for (const o of old) list.splice(list.indexOf(o), 1);
  return addSel(sys, r1, parentId, t, n);
}
export function duplicateSel(roster, id) {
  const r = clone(roster);
  const dup = s => ({ ...s, id: newId(), ch: arr(s.ch).map(dup) });
  const go = list => { const i = list.findIndex(s => s.id === id); if (i >= 0) { list.splice(i + 1, 0, dup(list[i])); return true; } return list.some(s => go(arr(s.ch))); };
  go(r.sel);
  return r;
}
/** Split one model off a stack (so it can take different wargear). */
export function splitSel(roster, id) {
  const r = clone(roster);
  const go = list => {
    const i = list.findIndex(s => s.id === id);
    if (i >= 0) {
      const s = list[i];
      if (num(s.n) < 2) return true;
      s.n -= 1;
      const dup = x => ({ ...x, id: newId(), ch: arr(x.ch).map(dup) });
      list.splice(i + 1, 0, { ...dup(s), n: 1 });
      return true;
    }
    return list.some(x => go(arr(x.ch)));
  };
  go(r.sel);
  return r;
}

export { PTS, findSel };
