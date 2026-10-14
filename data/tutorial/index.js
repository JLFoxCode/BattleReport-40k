/* Learn to play – the step-by-step guide (main menu "Learn to play", and the in-game guide per phase).
 *
 * Own words, written from the 11th-edition core rules (originals: js/rules-orig.js, loaded on the device; condensed
 * reference: data/core.js). Every step names the original sections it explains (refs), so the original text can be
 * shown next to it. Rule names / keywords stay in English UPPER CASE as printed ([BLAST], DEEP STRIKE, CHARACTER).
 *
 * Chapter = {
 *   id, part: 'basics' | 'phases' | 'more',
 *   phase: 'command'|'movement'|'shooting'|'charge'|'fight'|'end'   (phase chapters only – used by the in-game guide)
 *   title, title_de, intro, intro_de,
 *   steps: [{
 *     id, title, title_de,
 *     text, text_de          HTML: <p>, <b>, <i>, <ul><li>; no other tags
 *     tips, tips_de          ["what to watch out for", …] (optional)
 *     diagram                see js/ui/diagram.js (optional); caption / caption_de, note texts: text / text_de
 *     refs                   ['03.03', '03.04'] – original core rule sections
 *   }],
 *   game: {                  (phase chapters only) the in-game checklist for this phase
 *     you: [{ text, text_de, refs }],   active player, in order
 *     opp: [{ text, text_de, refs }]    the other player meanwhile
 *   }
 * }
 */
import { BASICS } from './basics.js';
import { PHASES } from './phases.js';

export const CHAPTERS = [...BASICS, ...PHASES];
export const PARTS = [
  { id: 'basics', title: 'Basics', title_de: 'Grundlagen' },
  { id: 'phases', title: 'Playing a turn', title_de: 'Einen Zug spielen' },
  { id: 'more', title: 'More rules', title_de: 'Weitere Regeln' }
];
export const chapterById = id => CHAPTERS.find(c => c.id === id) || null;
export const phaseChapter = phase => CHAPTERS.find(c => c.phase === phase) || null;
