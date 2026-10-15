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
const DP = '82ae-1066-5107-6ae0';   // Detachment Points
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
    this.costNames = new Map();
    for (const c of this.cats.values()) for (const ct of arr(c.costTypes)) this.costNames.set(ct.id, ct.name);
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
      defaultAmount: L.defaultAmount != null && L.defaultAmount !== '' ? L.defaultAmount : el.defaultAmount,
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
    // a link can bring entries of its own on top of its target's (Chaos Daemons: "Show Khorne Daemons" … on the
    // catalogue's Show/Hide Options link; extra Warlord / Enhancement options on a shared character)
    const L = n.link;
    if (L) {
      for (const e of arr(L.selectionEntries)) out.push(this.node(e, null));
      for (const g of arr(L.selectionEntryGroups)) out.push(this.node(g, null));
      for (const l of arr(L.entryLinks)) { const t = this.idx.get(l.targetId); if (t) out.push(this.node(t, l)); }
    }
    out.sort((a, b) => (num(a.sortIndex) - num(b.sortIndex)) || String(a.name).localeCompare(String(b.name), 'en', { numeric: true }));
    return (n._children = out);
  }
  /** Root entries a force of `catalogueId` can select: catalogue root (+ imported roots of linked catalogues) + game system roots. */
  rootNodes(catalogueId) {
    const key = 'root|' + catalogueId;
    if (this.nodeCache.has(key)) return this.nodeCache.get(key);
    const out = []; const seen = new Set();
    // root entries of an imported catalogue marked import="false" stay in that catalogue (e.g. the allies' own Detachment entry)
    const add = (c, imported) => {
      if (!c || seen.has(c.id)) return; seen.add(c.id);
      for (const e of arr(c.selectionEntries)) if (!(imported && e.import === false)) out.push(this.node(e, null));
      for (const l of arr(c.entryLinks)) { if (imported && l.import === false) continue; const t = this.idx.get(l.targetId); if (t) out.push(this.node(t, l)); }
      for (const cl of arr(c.catalogueLinks)) if (cl.importRootEntries) add(this.cats.get(cl.targetId), true);
    };
    add(this.cats.get(catalogueId), false);
    // some catalogues keep their own detachments only as a shared entry without a root link (Adeptus Custodes): offer it
    if (!out.some(n => /^Detachments?$/.test(n.name))) {
      const own = this.cats.get(catalogueId);
      for (const e of arr(own && own.sharedSelectionEntries)) if (/^Detachments?$/.test(e.name)) out.unshift(this.node(e, null));
    }
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
  const V = { sys, roster, catalogueId: roster.catalogueId, all: [], byId: new Map(), force: null, stale: [] };
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
    V.all.push(w); if (node) V.byId.set(s.id, w);
    if (node) w.ch = arr(s.ch).map(c => wrap(c, w, node)).filter(Boolean); else w.ch = [];
    // a selection the data does not know (any more – e.g. after a New Recruit data update): kept out of the tree, so
    // nothing trips over it; autoSync removes it, validate reports it
    if (!node) { V.stale.push(w); return null; }
    return w;
  };
  force.ch = arr(roster.sel).map(s => wrap(s, force, null)).filter(Boolean);
  return V;
}

/** Categories of a selection (category links of its node, after category modifiers). */
/** Categories (= keywords, "Faction: …") of a selection as the data has them right now – exported for the game hand-over. */
export function categoriesOfSel(V, w) { return categoriesOf(V, w); }
/** The selection a category modifier of `d` changes, by its scope: none/self = d, parent, root-entry (the unit), the
 *  nearest model / unit / upgrade above, or the nearest selection of an entry id. (Modifiers with `affects` change
 *  weapon entries – not handled here.) */
function catTarget(d, scope) {
  if (!scope || scope === 'self') return d;
  if (scope === 'parent') return d.parent && d.parent.kind === 'sel' ? d.parent : null;
  if (scope === 'root-entry') { let x = d; while (x.parent && x.parent.kind === 'sel') x = x.parent; return x; }
  if (scope === 'force' || scope === 'roster' || scope === 'primary-catalogue') return null;
  for (let x = d.parent; x && x.kind === 'sel'; x = x.parent) {
    if (scope === 'model' || scope === 'unit' || scope === 'upgrade') { if (x.node && x.node.type === scope) return x; }
    else if (x.ids && x.ids.has(scope)) return x;
  }
  return null;
}
function categoriesOf(V, w) {
  if (w.kind !== 'sel' || !w.node) return new Set();
  if (w._cats) return w._cats;
  const cats = new Set(w.node.categoryLinks.map(c => c.targetId));
  w._cats = cats;   // set first: category modifiers may themselves test categories
  const use = m => { if (m.type === 'add' || m.type === 'set-primary') cats.add(m.value); else if (m.type === 'remove') cats.delete(m.value); };
  const mine = (d, m) => m.field === 'category' && !m.affects && catTarget(d, m.scope) === w;
  applyMods(V, w.node, w, m => { if (mine(w, m)) use(m); });
  // selections below can change this one's categories ("Character Upgrade" makes a Banesword a CHARACTER, "Daemon of
  // Blood" adds KHORNE to its Daemon Prince, a mount removes INFANTRY …)
  (function f(x) {
    for (const c of x.ch || []) {
      if (c.kind !== 'sel' || !c.node) continue;
      applyMods(V, c.node, c, m => { if (m.scope && m.scope !== 'self' && mine(c, m)) use(m); });
      f(c);
    }
  })(w);
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
    case 'model-or-unit': {   // the nearest model or unit (New Recruit)
      let x = sel; while (x && x.kind === 'sel' && !(x.node && (x.node.type === 'model' || x.node.type === 'unit'))) x = x.parent;
      return x && x.kind === 'sel' ? x : null;
    }
    case 'unit': case 'unit-self': case 'model': case 'upgrade': {
      const ty = scope === 'unit-self' ? 'unit' : scope;
      // "upgrade": the upgrade the entry sits in (a weapon upgrade's conditions are about its weapon, not itself)
      let x = scope === 'upgrade' && self ? self.parent : sel;
      while (x && x.kind === 'sel' && !(x.node && x.node.type === ty)) x = x.parent;
      return x && x.kind === 'sel' ? x : null;
    }
    default: {
      // the scope is an option group (Vanguard Veterans "for every 5 models", Nemesis Claw "4 - 9 Legionaries"): the
      // selections made through that group below the selection that holds it – not the model that sits in the group
      let x = sel;
      while (x) {
        if (x.kind === 'sel' && x.node) {
          if (x.groups.some(g => g.ids.has(scope))) return groupScope(x.parent, scope);
          if (groupBelow(V.sys, x.node, scope)) return groupScope(x, scope);
        }
        if (x.kind === 'sel' ? matches(V, x, scope) : x.ids && x.ids.has(scope)) return x;
        x = x.parent;
      }
      return null;
    }
  }
}
/** Pseudo scope "option group `gid` below selection p": the selections made through that group. */
function groupScope(p, gid) {
  if (!p) return null;
  return { kind: 'group', ids: new Set([gid]), n: 1, parent: p, ch: (p.ch || []).filter(c => c.groups && c.groups.some(g => g.ids.has(gid))) };
}
/** Whether an option group with id `gid` sits directly below `node` (through groups only). */
const groupBelowCache = new WeakMap();
function groupBelow(sys, node, gid) {
  let m = groupBelowCache.get(node);
  if (!m) {
    m = new Set();
    (function f(n, d) { if (d > 5) return; for (const k of sys.children(n)) if (k.group) { k.ids.forEach(i => m.add(i)); f(k, d + 1); } })(node, 0);
    groupBelowCache.set(node, m);
  }
  return m.has(gid);
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
  let v = countIn(V, c, scope);
  // a category counted in the parent also counts on the parent itself: the Khorne mark adds KHORNE to its Daemon
  // Prince (not to the mark), so "KHORNE in parent: at least 1" (Conduit of Chaos hidden) must see the unit
  if (c.scope === 'parent' && c.field === 'selections' && scope && scope.kind === 'sel' && c.childId && !scope.ids.has(c.childId)
    && V.sys.categoryNames.has(c.childId) && categoriesOf(V, scope).has(c.childId)) v += 1;
  return cmp(c.type, v, num(c.value));
}
/* The army's catalogue counts as an instance of a catalogue it is built on – one whose root entries it imports (Blood
   Angels → Space Marines). A plain catalogue link only borrows entries: Chaos Daemons link Chaos Space Marines for the
   Shadow Legion units, but a Daemons army is no CSM army (else the Daemonic Pact cap on LEGIONES DAEMONICA applies). */
function catalogueImports(V, id) {
  const seen = new Set();
  const walk = cid => { if (seen.has(cid)) return false; seen.add(cid); if (cid === id) return true; const c = V.sys.cats.get(cid); return !!c && arr(c.catalogueLinks).some(l => l.importRootEntries && walk(l.targetId)); };
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
  // a modifier group can repeat too: its modifiers then apply once per repeat (Skitarii Vanguard: radium carbines
  // -1 per special weapon model) – and not at all while the repeat count is 0
  const run = (mods, groups, mult) => {
    for (const m of mods) {
      const ok = evalGroup(V, { type: 'and', conditions: m.conditions, conditionGroups: m.conditionGroups }, self, parent);
      if (!ok) continue;
      const times = repeatsOf(V, m, self, parent);
      if (arr(m.repeats).length && !times) continue;
      fn(m, times * mult);
    }
    for (const g of groups) {
      if (!evalGroup(V, { type: 'and', conditions: g.conditions, conditionGroups: g.conditionGroups }, self, parent)) continue;
      const times = repeatsOf(V, g, self, parent);
      if (arr(g.repeats).length && !times) continue;
      run(arr(g.modifiers), arr(g.modifierGroups), mult * times);
    }
  };
  run(node.modifiers, node.modifierGroups, 1);
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
  // messages written for New Recruit use {this} for the entry's own name ("Max 1 {this} per 5 models")
  return { hidden, name, constraints: cons, errors: errors.map(e => e.replace(/\{this\}/g, name)) };
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
    // shared: false – only the selections made through THIS entry (link) count, not the same item taken elsewhere
    // (a Sister Superior's fixed bolt pistol and a second one chosen as her ranged weapon)
    const own = c.shared === false && !node.group;
    return descendants(scope, deep).filter(([w]) => w.node === node || w.groups.includes(node) || (!own && w.ids.has(node.id) && !node.group) || (own && w.s.t.split('>').pop() === node.token)).reduce((x, [, m]) => x + m, 0);
  }
  if (isCostType(V, c.field)) return sumCost(V, scope, c.childId, true, c.field);
  return null;
}

// ───────── Validation ─────────
/** All problems of the roster: [{ sel: selection id | null, msg }]. */
export function validate(V) {
  const out = [];
  const label = w => (w && w.kind === 'sel' ? effective(V, w.node, w, w.parent).name : 'Army');
  // a constraint scope as words: 'army', or the name of the entry / group it means (never its raw id)
  const scopeName = s => (s === 'force' || s === 'roster' ? 'army' : (V.sys.idx.get(s) || {}).name || (/^[0-9a-f]{3,4}-/.test(s) ? 'unit' : s));
  // under: inside a hidden group (Crusade options …) – its minimums do not apply
  const checkNode = (node, parent, owner, under = false) => {
    const sels = selsOf(V, parent, node);
    const self = node.group ? null : sels[0] || null;
    const eff = effective(V, node, self, parent);
    if (sels.length) for (const m of eff.errors) out.push({ sel: (owner ? owner.s.id : sels[0].s.id) || null, msg: `${owner ? label(owner) + ': ' : ''}${m}` });
    if (eff.hidden && !sels.length) { if (node.group) for (const k of V.sys.children(node)) checkNode(k, parent, owner, true); return; }   // not available here → its rules do not apply
    if (eff.hidden && sels.length) out.push({ sel: (sels[0].s || {}).id || null, msg: `${eff.name} is not available${owner ? ' for ' + label(owner) : ''}` });
    for (const c of eff.constraints) {
      if (c.field === 'associations' || (c.type === 'max' && c.value < 0)) continue;
      if (c.type === 'min' && !sels.length && c.scope === 'parent' && eff.hidden) continue;
      if (c.type === 'min' && under) continue;
      if (c.scope === 'self' && !self && !node.group) continue;   // a group's scope self = its parent (enhancements: max 1)
      if (c.scope !== 'parent' && c.scope !== 'self' && !sels.length && c.type === 'max') continue;
      const v = countNode(V, node, c, self, parent);
      if (v == null) continue;
      const what = c.field === PTS ? ' pts' : '';
      if (c.type === 'min' && v < c.value) out.push({ sel: owner ? owner.s.id : null, msg: c.message ? c.message.replace(/{this}/g, eff.name) : `${label(owner)}: ${eff.name === label(owner) ? '' : eff.name + ' '}needs at least ${c.value}${what} (has ${v})` });
      if (c.type === 'max' && v > c.value) out.push({ sel: (sels[0] && sels[0].s.id) || (owner ? owner.s.id : null), msg: c.message ? c.message.replace(/{this}/g, eff.name) : `${eff.name}: at most ${c.value}${what} ${c.scope === 'parent' || c.scope === 'self' ? (owner ? 'in ' + label(owner) : '') : 'per ' + scopeName(c.scope)} (has ${v})` });
    }
    if (node.group) for (const k of V.sys.children(node)) checkNode(k, parent, owner, under);
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
  // limits of the army roster itself (game system): Enhancements per army (2 at Incursion, otherwise 4) … – the points
  // limit and the Detachment Points are checked by the builder (custom limits, DP set by hand)
  for (const c of rosterLimits(V)) {
    if (c.field === PTS || c.field === DP || !isCostType(V, c.field)) continue;
    if ((c.type === 'max' && c.value < 0) || (c.type === 'min' && c.value <= 0)) continue;
    const v = V.force.ch.reduce((x, w) => x + totalCost(V, w, c.field), 0);
    const name = V.sys.costNames ? V.sys.costNames.get(c.field) : c.field;
    const msg = c.message ? c.message.replace(/\{value\}/g, c.value).replace(/\{this\}/g, name) : null;
    if (c.type === 'max' && v > c.value) out.push({ sel: null, msg: msg || `${name}: at most ${c.value} per army (has ${v})` });
    if (c.type === 'min' && v < c.value) out.push({ sel: null, msg: msg || `${name}: at least ${c.value} (has ${v})` });
  }
  // limits stored on the catalogues' categories: one EPIC HERO per army, max 3 Soul Grinders, a Warlord, allied points caps …
  const catEntries = []; const seenCat = new Set();
  const addCat = c => { if (!c || seenCat.has(c.id)) return; seenCat.add(c.id); for (const ce of arr(c.categoryEntries)) if (arr(ce.constraints).length) catEntries.push(ce); for (const l of arr(c.catalogueLinks)) addCat(V.sys.cats.get(l.targetId)); };
  addCat(V.sys.cats.get(V.catalogueId)); addCat(V.sys.gst);
  for (const ce of catEntries) {
    const node = { modifiers: arr(ce.modifiers), modifierGroups: arr(ce.modifierGroups), constraints: arr(ce.constraints), name: ce.name, hidden: false };
    const eff = effective(V, node, null, V.force);
    for (const c of eff.constraints) {
      if ((c.type === 'max' && c.value < 0) || (c.type === 'min' && c.value <= 0) || (c.scope !== 'force' && c.scope !== 'roster')) continue;
      let v;
      if (c.field === 'selections') v = descendants(V.force, !!c.includeChildSelections).filter(([w]) => categoriesOf(V, w).has(ce.id)).reduce((x, [, m]) => x + m, 0);
      else if (isCostType(V, c.field)) v = V.force.ch.filter(w => w.node && categoriesOf(V, w).has(ce.id)).reduce((x, w) => x + totalCost(V, w, c.field), 0);
      else continue;
      const what = c.field === PTS ? ' pts' : '';
      const msg = c.message ? c.message.replace(/\{this\}/g, ce.name) : null;
      if (c.type === 'min' && v < c.value) out.push({ sel: null, msg: msg || `${ce.name}: at least ${c.value}${what} required (has ${v})` });
      if (c.type === 'max' && v > c.value) out.push({ sel: null, msg: msg || `${ce.name}: at most ${c.value}${what} per army (has ${v})` });
    }
  }
  // selections: their children
  const walk = w => {
    if (!w.node) { out.push({ sel: w.s.id, msg: 'Unknown entry (data changed?)' }); return; }
    for (const k of V.sys.children(w.node)) checkNode(k, w, w);
    w.ch.forEach(walk);
  };
  V.force.ch.forEach(walk);
  for (const w of V.stale) out.push({ sel: w.parent && w.parent.kind === 'sel' ? w.parent.s.id : null, msg: 'An entry that is no longer in the data (data update) – it is removed when the army is opened' });
  const pts = totalPoints(V);
  if (num(V.roster.limit) > 0 && pts > num(V.roster.limit)) out.push({ sel: null, msg: `${pts} / ${V.roster.limit} pts – over the points limit` });
  const seen = new Set();
  // an army-wide limit is checked under every unit that has the entry: list it once
  return out.filter(e => { const k = / per army \(has /.test(e.msg) ? e.msg : e.sel + '|' + e.msg; if (seen.has(k)) return false; seen.add(k); return true; });
}
/** The army roster's own limits (game system force entry) with their modifiers applied: [{ field, type, value, message }]. */
export function rosterLimits(V) {
  const fe = V.sys.forceEntry;
  if (!fe) return [];
  const node = { modifiers: arr(fe.modifiers), modifierGroups: arr(fe.modifierGroups), constraints: arr(fe.constraints), name: fe.name, hidden: false };
  return effective(V, node, null, V.force).constraints;
}
/** Effective maximum of a cost type for the whole army from the data (Detachment Points: 2 / 3 / 4 by battle size …), or null. */
export function rosterMax(V, typeId) {
  const c = rosterLimits(V).find(x => x.field === typeId && x.type === 'max' && x.value >= 0);
  return c ? c.value : null;
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
/** The default option of a group: its defaultId – or, when the data sets none, the option the group is named after
 *  (group "Laspistol" → Laspistol; BSData names weapon groups after the standard weapon). */
function isDefault(g, x) {
  if (g.defaultId) return x.id === g.defaultId || x.linkId === g.defaultId;
  return !!g.name && String(x.name).toLowerCase() === String(g.name).toLowerCase();
}
/** BSData / New Recruit defaultAmount of an entry: how many are selected when its parent is created – a number, or a
 *  list "1,1" = that many separate selections (two battlesuits that can be equipped differently). null = none given. */
function defAmounts(x) {
  const v = x.defaultAmount;
  if (v == null || v === '') return null;
  const a = String(v).split(',').map(p => num(p.trim())).filter(p => p > 0);
  return a.length ? a : null;
}
const sumA = a => a.reduce((x, y) => x + y, 0);
function fillDefaults(sys, V, node, s, parentW, groups = []) {
  // wrapper for condition evaluation of the new selection (not yet in the roster); it collects the wrappers of what is
  // filled in, so later defaults see earlier ones (the Desolation Sergeant's launcher follows the squad's)
  const ids = new Set(node.ids); for (const g of groups) g.ids.forEach(i => ids.add(i));
  const w = { kind: 'sel', s, node, groups, parent: parentW, n: s.n, ch: [], ids };
  /* Fill group k (token tok) with `need` selections: entries with their own minimum first (e.g. the Sergeant), the
     share of mandatory groups inside (the 1 "Special Weapon" slot of 9 Farstalkers), then the default entry (or the
     first one) up to its maximum, then the next ones; whatever is still missing goes into the groups inside
     ("Squad Members" 10 = only sub-groups of Heavy Intercessors …). */
  const fillGroup = (k, tok, need) => {
    const opts = sys.children(k).filter(x => !x.group).map(x => ({ x, l: limits(V, x, null, w) })).filter(o => !o.l.hidden);
    const groups = sys.children(k).filter(x => x.group).map(g => ({ g, l: limits(V, g, null, w) })).filter(o => !o.l.hidden);
    // a group's share: its own minimum, or what the mandatory entries inside it need (4 + 3 + 3 of 10 Heavy Intercessors)
    const minInside = (g, d = 0) => d > 4 ? 0 : sys.children(g).reduce((x, c) => { const l = limits(V, c, null, w); return l.hidden ? x : x + (c.group ? Math.max(l.min, minInside(c, d + 1)) : Math.max(0, l.min)); }, 0);
    const share = new Map(groups.map(o => [o.g, Math.max(0, o.l.min, minInside(o.g))]));
    const counts = new Map();
    let left = Math.max(0, need - [...share.values()].reduce((a, b) => a + b, 0));
    // the data's default amounts come first (Crisis Fireknife: plasma rifle 1 + missile pod 1 instead of 2 of the first);
    // the group's default entry before the others when they compete for the places (TX42: every option has 1)
    const order = opts.slice().sort((p, q) => (isDefault(k, q.x) ? 1 : 0) - (isDefault(k, p.x) ? 1 : 0));
    for (const o of order) {
      const da = defAmounts(o.x);
      if (!da || o.l.max === 0 || left <= 0) continue;
      const c = Math.min(sumA(da), left, o.l.max < 0 ? Infinity : o.l.max);
      if (c > 0) { counts.set(o.x, c); left -= c; }
    }
    for (const o of opts) if (o.l.min > 0 && left > 0) { const have = counts.get(o.x) || 0; const c = Math.min(Math.max(0, o.l.min - have), left); if (c > 0) { counts.set(o.x, have + c); left -= c; } }
    for (const o of order) {
      if (left <= 0) break;
      const have = counts.get(o.x) || 0;
      const room = o.l.max < 0 ? left : Math.max(0, Math.min(left, o.l.max - have));
      if (room > 0) { counts.set(o.x, have + room); left -= room; }
    }
    // still missing in a group made only of groups: into those – mandatory ones first, each up to its maximum
    // (a group with entries of its own keeps its gap: there the limits often depend on the choice, e.g. "twin tools OR
    // one melee + one ranged weapon")
    if (!opts.length) for (const o of groups.slice().sort((p, q) => (q.l.min > 0) - (p.l.min > 0))) {
      if (left <= 0) break;
      const have = share.get(o.g);
      const room = o.l.max < 0 ? left : Math.max(0, Math.min(left, o.l.max - have));
      if (room > 0) { share.set(o.g, have + room); left -= room; }
    }
    for (const o of opts) {
      const n = counts.get(o.x); if (!n) continue;
      addEntry(o.x, tok + '>' + o.x.token, n);
    }
    for (const o of groups) {
      const n = share.get(o.g);
      if (n > 0) fillGroup(o.g, tok + '>' + o.g.token, n);
      else visit(sys.children(o.g), tok + '>' + o.g.token);   // optional group: only what is mandatory inside
    }
  };
  const visit = (list, prefix) => {
    for (const k of list) {
      const lim = limits(V, k, null, w);
      if (lim.hidden) continue;
      const tok = prefix ? prefix + '>' + k.token : k.token;
      if (k.group) {
        // configuration entries (Detachment, Battle Size …): a choice without a default is left to the player
        const ask = !k.defaultId && node.type === 'upgrade' && parentW && parentW.kind === 'force';
        if (lim.min > 0 && !ask) fillGroup(k, tok, lim.min);
        else visit(sys.children(k), tok);   // nested groups / entries with their own min
      } else {
        const da = lim.max === 0 ? null : defAmounts(k);
        const n = Math.max(lim.min, da ? Math.min(sumA(da), lim.max < 0 ? Infinity : lim.max) : 0);
        if (n > 0) addEntry(k, tok, n);
      }
    }
  };
  // n of entry x: one selection – or, when the data's default amount is a list ("1,1") and it adds up, one per item
  const addEntry = (x, t, n) => {
    const da = defAmounts(x);
    const parts = da && da.length > 1 && sumA(da) === n ? da : [n];
    const ch = sys.chain(node, t);
    for (const p of parts) {
      const c = { id: newId(), t, n: p, ch: [] };
      w.ch.push(fillDefaults(sys, V, x, c, w, ch ? ch.slice(0, -1) : []));
      s.ch.push(c);
    }
  };
  visit(sys.children(node), '');
  return w;
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
  // the copy leads nobody yet (a leader can only lead one unit)
  const go = list => { const i = list.findIndex(s => s.id === id); if (i >= 0) { const c = dup(list[i]); delete c.lead; list.splice(i + 1, 0, c); return true; } return list.some(s => go(arr(s.ch))); };
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

export { PTS, DP, findSel };
/** For js/builder/profiles.js: the modifiers of a selection whose conditions hold, and whether a selection matches an id/category. */
export const applyModsOf = (V, w, fn) => applyMods(V, w.node, w, fn);
export const matchesSel = (V, w, id) => matches(V, w, id);
/** All profiles of an entry: its own, those it links (infoLink type "profile" – many models share one Unit profile this
 *  way, e.g. Cadian Veteran Guardsman) and those of its info groups (own or linked). */
export function profilesOf(sys, node) {
  if (node._profiles) return node._profiles;
  const out = [...node.profiles];
  const seen = new Set(out.map(p => p.id));
  const take = p => { if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); } };
  const info = (links, groups, d) => {
    if (d > 4) return;
    for (const l of arr(links)) {
      const t = sys.idx.get(l.targetId);
      if (!t) continue;
      if (l.type === 'profile') take(t);
      else if (l.type === 'infoGroup') { arr(t.profiles).forEach(take); info(t.infoLinks, t.infoGroups, d + 1); }
    }
    for (const g of arr(groups)) { arr(g.profiles).forEach(take); info(g.infoLinks, g.infoGroups, d + 1); }
  };
  info(node.infoLinks, [...arr(node.el.infoGroups), ...arr(node.link && node.link.infoGroups)], 0);
  return (node._profiles = out);
}

/* Keeps a roster consistent with the data after a change (as New Recruit does):
 *  - a selection that is no longer available (hidden or max 0 by its modifiers, e.g. the Hesyr's gauntlet once he takes a hammer,
 *    or an option tied to the squad's weapon choice) is removed;
 *  - a mandatory piece of wargear that is available now but missing (min > 0, e.g. the Hesyr's weapon that follows the
 *    squad's choice) is added; a mandatory choice without selection gets its default (only when it is unambiguous).
 *  Model counts are left to the player. */
/** All entries below a node through its groups: [{ node, tok }] (tok = token path relative to the node). */
function optionPaths(sys, node, pre = '', depth = 0, out = []) {
  if (depth > 4) return out;
  for (const k of sys.children(node)) {
    const tok = pre ? pre + '>' + k.token : k.token;
    if (k.group) optionPaths(sys, k, tok, depth + 1, out); else out.push({ node: k, tok });
  }
  return out;
}
/** Store each selection's entry name on it (s.nm) – lets autoSync find a choice again after a data update changed ids. */
export function nameSels(sys, roster) {
  const V = view(sys, roster);
  const r = clone(roster);
  (function f(list) { for (const s of list || []) { const w = V.byId.get(s.id); if (w && w.node) s.nm = w.node.name; f(s.ch); } })(r.sel);
  return r;
}
export function autoSync(sys, roster) {
  let r = roster;
  // selections the data does not know any more (a data update changed their ids): found again by their stored name
  // below the same parent (s.nm, see nameSels) – otherwise removed
  for (let i = 0; i < 80; i++) {
    const V0 = view(sys, r);
    const st = V0.stale[0];
    if (!st) break;
    const p = st.parent && st.parent.kind === 'sel' ? st.parent : null;
    const pool = p ? p.node && optionPaths(sys, p.node) : sys.rootNodes(r.catalogueId).map(n => ({ node: n, tok: n.token }));
    const hit = st.s.nm && (pool || []).find(o => o.node.name === st.s.nm);
    if (hit) { r = clone(r); const x = findSel(r.sel, st.s.id); if (x) x.t = hit.tok; }
    else r = removeSel(r, st.s.id);
  }
  for (let pass = 0; pass < 12; pass++) {
    const V = view(sys, r);
    let change = null;
    const visit = (w, nodes, prefix, room = Infinity) => {
      for (const k of nodes) {
        if (change) return;
        if (/^(Crusade|Weapon Modifications|Battle Scars|Battle Honours)/i.test(k.name)) continue;
        const tok = prefix ? prefix + '>' + k.token : k.token;
        const lim = limits(V, k, null, w);
        if (k.group) {
          const inG = w.ch.filter(c => c.s.t.startsWith(tok + '>'));
          if (lim.hidden || lim.max === 0) { if (inG.length) change = { rm: inG[0].s.id }; continue; }
          const gRoom = Math.min(room, lim.max < 0 ? Infinity : lim.max - inG.reduce((x, c) => x + c.n, 0));
          if (lim.min > 0 && !inG.length && gRoom > 0) {
            // options that are allowed right now; one that is mandatory now (min > 0) wins over the default
            const opts = sys.children(k).filter(x => !x.group).map(x => ({ x, l: limits(V, x, null, w) })).filter(o => !o.l.hidden && o.l.max !== 0);
            const pick = opts.find(o => o.l.min > 0) || opts.find(o => defAmounts(o.x)) || opts.find(o => isDefault(k, o.x)) || (opts.length === 1 ? opts[0] : null);
            const def = pick ? pick.x : null;
            if (def) { change = { add: { p: w.s.id, t: tok + '>' + def.token, n: def.type === 'model' ? lim.min : 1 } }; return; }
          }
          // a choice raised the group's minimum (20 Jakhals → 2 Dishonoured instead of 1): top up the biggest stack there
          const total = inG.reduce((x, c) => x + c.n, 0);
          const baseMin = k.constraints.filter(c => c.type === 'min' && c.field === 'selections' && (!c.scope || c.scope === 'parent')).reduce((m, c) => Math.max(m, num(c.value)), 0);
          if (inG.length && lim.min > baseMin && total < lim.min && gRoom > 0) {
            const big = inG.filter(c => c.node && c.node.type === 'model').sort((p, q) => q.n - p.n)
              .find(c => { const l = limits(V, c.node, c, w); return l.max < 0 || l.max >= c.n + Math.min(gRoom, lim.min - total); });
            if (big) { change = { set: { id: big.s.id, n: big.n + Math.min(gRoom, lim.min - total) } }; return; }
          }
          // … or lowered its maximum (a Weapons Team takes two of the 9 places): the biggest stack gives way
          const baseMax = k.constraints.filter(c => c.type === 'max' && c.field === 'selections' && (!c.scope || c.scope === 'parent') && num(c.value) >= 0).reduce((m, c) => Math.min(m, num(c.value)), Infinity);
          if (inG.length && lim.max >= 0 && lim.max < baseMax && total > lim.max) {
            const big = inG.filter(c => c.node && c.node.type === 'model').sort((p, q) => q.n - p.n)
              .find(c => c.n - (total - lim.max) >= Math.max(0, limits(V, c.node, c, w).min));
            if (big) { change = { set: { id: big.s.id, n: big.n - (total - lim.max) } }; return; }
          }
          visit(w, sys.children(k), tok, gRoom);
          continue;
        }
        const sels = w.ch.filter(c => c.s.t === tok);
        const eff = effective(V, k, sels[0] || null, w);
        const maxNow = eff.constraints.filter(c => c.type === 'max' && c.field === 'selections' && !c.childId && c.scope === 'parent').reduce((m, c) => Math.min(m, c.value), Infinity);
        if (eff.hidden || (maxNow === 0 && k.type !== 'model')) { if (sels.length) change = { rm: sels[0].s.id }; continue; }   // not available (any more)
        // models: counts are the player's – only a mandatory model that is missing entirely comes back (the Sergeant)
        if (k.type === 'model') { if (lim.min > 0 && !sels.length && room >= lim.min) change = { add: { p: w.s.id, t: tok, n: lim.min } }; continue; }
        const have = sels.reduce((x, c) => x + c.n, 0);
        if (lim.min > 0 && have < lim.min && room >= lim.min - have) change = sels.length ? { set: { id: sels[0].s.id, n: sels[0].s.n + lim.min - have } } : { add: { p: w.s.id, t: tok, n: lim.min - have } };
      }
    };
    const walk = w => { if (change || !w.node) return; visit(w, sys.children(w.node), ''); w.ch.forEach(walk); };
    V.force.ch.forEach(walk);
    if (!change) break;
    if (change.rm) r = removeSel(r, change.rm);
    else if (change.set) r = setCount(r, change.set.id, change.set.n);
    else r = addSel(sys, r, change.add.p, change.add.t, change.add.n);
  }
  return r;
}
