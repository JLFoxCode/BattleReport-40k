// Originaltexte (englisch, wörtlich) – data/orig/<fraktion>.json, data/orig/missions.json, data/orig/core.json
// (erzeugt per tools/orig-extract.mjs und tools/orig-missions.mjs). Browser-ESM ohne Abhängigkeiten: laden + cachen + nachschlagen.
// Die Texte werden unverändert angezeigt (keine Paraphrase, keine Übersetzung) – Keywords bleiben so 1:1 erhalten.

import { loadDatasheets } from './datasheets.js';

const cache = new Map();   // key → Promise<object | null>
const BASE = new URL('../../data/orig/', import.meta.url);

/** Normalisiert Namen für den Vergleich: klein, ohne Diakritika, Satzzeichen und Leerzeichen ("Serpent’s Brood" → "serpentsbrood"). */
const LIG = { 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'ø': 'o', 'đ': 'd', 'ł': 'l', 'þ': 'th' };
export function normKey(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[æœßøđłþ]/g, c => LIG[c]).replace(/[^a-z0-9]+/g, '');
}
/** Wie normKey, aber ohne Klammerzusätze ("X (Boarding Actions)" → "x"). */
export function normKeyBase(s) {
  return normKey(String(s == null ? '' : s).replace(/\s*\([^)]*\)\s*/g, ' '));
}

function load(file) {
  if (!cache.has(file)) {
    const p = fetch(new URL(file, BASE)).then(r => (r.ok ? r.json() : null)).catch(() => null);
    cache.set(file, p);
  }
  return cache.get(file);
}

/** Lädt die Originaltexte einer Fraktion (gecacht); null, wenn es keine gibt.
 *  Armeeregeln, Detachment-Regeln und Enhancements kommen AUSSCHLIESSLICH aus BSData (New Recruit, data/datasheets/<id>.json,
 *  Feld bs) – eine Quelle für alles zur Armee. Aus data/orig (Wahapedia) kommen nur noch die Stratageme. */
export function loadOrig(factionId) {
  const id = String(factionId || '').trim();
  if (!id) return Promise.resolve(null);
  const key = 'combined:' + id;
  if (!cache.has(key)) {
    cache.set(key, Promise.all([load(id + '.json'), loadDatasheets(id)]).then(([o, ds]) => {
      if (!o && !ds) return null;
      return Object.assign({}, o || {}, { bs: ds ? { armyRules: ds.armyRules || [], detachments: ds.detachments || [] } : null });
    }));
  }
  return cache.get(key);
}
/** BSData-Detachment nach Name (exakt normalisiert, sonst ohne Klammerzusatz). */
function bsDetachment(orig, detachmentName) {
  const dets = orig && orig.bs && orig.bs.detachments;
  if (!dets || !detachmentName) return null;
  const k = normKey(detachmentName), kb = normKeyBase(detachmentName);
  return dets.find(d => normKey(d.name) === k) || dets.find(d => normKeyBase(d.name) === kb) || null;
}
/** Lädt die Originaltexte des Missionsdecks (gecacht); null bei Fehler. */
export function loadMissionsOrig() { return load('missions.json'); }
/** Lädt Kernregel-Originale (Fähigkeiten + Kern-Stratageme), gecacht; null bei Fehler. */
export function loadCoreOrig() { return load('core.json'); }

/** Findet den Detachment-Eintrag (Schlüssel = unser Detachment-Name) – exakt, sonst ohne Klammerzusatz. */
export function origDetachment(orig, detachmentName) {
  const dets = orig && orig.detachments;
  if (!dets) return null;
  if (dets[detachmentName]) return dets[detachmentName];
  const k = normKey(detachmentName), kb = normKeyBase(detachmentName);
  for (const [name, d] of Object.entries(dets)) if (normKey(name) === k) return d;
  for (const [name, d] of Object.entries(dets)) if (normKeyBase(name) === kb) return d;
  return null;
}

/** Stratagem-Original: zuerst im Detachment, sonst fraktionsweit nach Name. → { name, cost, when, target, effect, restrictions, text, … } | null */
export function origStratagem(orig, detachmentName, stratName) {
  if (!orig) return null;
  const k = normKey(stratName);
  const d = detachmentName ? origDetachment(orig, detachmentName) : null;
  if (d && d.stratagems) {
    if (d.stratagems[stratName]) return d.stratagems[stratName];
    for (const [name, s] of Object.entries(d.stratagems)) if (normKey(name) === k) return s;
  }
  return (orig.stratagemsByName && orig.stratagemsByName[k]) || null;
}

/** Detachment-Regel(n) als Liste [{ name, text }] (leer, wenn unbekannt). */
export function origDetachmentRule(orig, detachmentName) {
  const d = bsDetachment(orig, detachmentName);           // BSData only
  return d && Array.isArray(d.rules) ? d.rules : [];
}
/** Verstärkungen eines Detachments [{ name, cost, text }]. */
export function origEnhancements(orig, detachmentName) {
  const d = bsDetachment(orig, detachmentName);           // BSData only
  return d && Array.isArray(d.enhancements) ? d.enhancements : [];
}
/** Armeeregeln [{ name, text }]. */
export function origArmyRules(orig) {
  return orig && orig.bs && Array.isArray(orig.bs.armyRules) ? orig.bs.armyRules : [];   // BSData only
}

/** Primärmission nach WH.PRIMARY-Schlüssel → { name, text, … } | null */
export function origPrimary(m, key) { return (m && m.primary && m.primary[key]) || null; }
/** Sekundärmission nach WH.SECONDARY-Schlüssel → { name, text, fixed?, … } | null */
export function origSecondary(m, key) { return (m && m.secondary && m.secondary[key]) || null; }
/** Twist nach WH.TWISTS[].id → { name, text } | null */
export function origTwist(m, id) { return (m && m.twists && m.twists[id]) || null; }
/** Aufstellungskarte nach Name (WH.DEPLOYMENTS) → { name, text, image } | null */
export function origDeployment(m, name) {
  if (!m || !m.deployments) return null;
  if (m.deployments[name]) return m.deployments[name];
  const k = normKey(name);
  for (const [n, d] of Object.entries(m.deployments)) if (normKey(n) === k) return d;
  return null;
}
/** Schritt der Missionssequenz nach Titel (z. B. "Deploy Armies") → { n, step, text } | null */
export function origSequenceStep(m, title) {
  if (!m || !Array.isArray(m.sequence)) return null;
  const k = normKey(title);
  return m.sequence.find(s => normKey(s.step) === k) || null;
}
/** Allgemeiner Abschnitt (z. B. "Tactical Missions", "Victory Points") → Text | '' */
export function origGeneral(m, key) { return (m && m.general && m.general[key]) || ''; }
