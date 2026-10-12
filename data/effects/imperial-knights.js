/* Imperial Knights – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/imperial-knights.json; effect texts are short English summaries of the CHANGE only.
 * The Deeds/Qualities themselves are not in the army rule text; they follow the faction reminders in data/factions/imperial-knights.js. */

export default {
  faction: 'imperial-knights',
  effects: [
    { id: 'oath-deed', name: 'Code Chivalric – Deed', kind: 'choice', source: 'army', pick: 'one',
      when: 'End of the Read Mission Objectives step (select or roll D6)', duration: 'battle',
      options: [
        { id: 'tyrant', name: 'Tyrant', effect: 'Completed: selected enemy CHARACTER destroyed (checked at the end of each turn)' },
        { id: 'realm', name: 'Realm', effect: 'Completed: end of your opponent’s turn, you control more objective markers than your opponent' },
        { id: 'tally', name: 'Tally', effect: 'Completed: end of the battle round, destroyed enemy units > battle round number' }
      ] },
    { id: 'oath-quality', name: 'Code Chivalric – Quality', kind: 'choice', source: 'army', pick: 'one',
      when: 'End of the Read Mission Objectives step (select or roll D6)', duration: 'battle',
      options: [
        { id: 'valour', name: 'Martial Valour', effect: 'Per unit: re-roll one Hit roll and one Wound roll when shooting or fighting' },
        { id: 'challenge', name: 'Eager for the Challenge', effect: '+2" Move · +1 to Advance and Charge rolls' },
        { id: 'legacy', name: 'Legacy', effect: '+2 OC · +1 Leadership' }
      ] },
    { id: 'oath-fulfilled', name: 'Oath fulfilled (Honoured)', kind: 'toggle', source: 'army', limit: 'battle', duration: 'until the end of the battle',
      when: 'First time the selected Deed is completed', effect: 'Army is Honoured · +2CP (+3CP if Deed and/or Quality was randomly selected; exempt from the 1CP per round limit)' },
    { id: 'bondsman', name: 'Bondsman', kind: 'always', source: 'army', scope: 'Command', effect: 'Your Command phase: each model using its Bondsman ability affects one ARMIGER within 12" (not already affected) until your next Command phase' },
    { id: 'super-heavy-walker', name: 'Super-heavy Walker', kind: 'always', source: 'army', scope: 'Movement', effect: 'Normal / Advance / Fall Back moves pass through models (not TITANIC) and terrain up to 4" high · may cross Engagement Range but not end in it · taller terrain: D6 afterwards, on a 1 Battle-shocked' }
  ],
  detachments: {
    'imperial-knights--freeblade-company': [
      { id: 'knights-of-legend', name: 'Knights of Legend', kind: 'always', source: 'detachment', effect: 'IMPERIAL KNIGHTS models: Feel No Pain 6+ · start of your Command phase: each regains 1 lost wound' }
    ],
    'imperial-knights--questoris-companions': [
      { id: 'heroes-of-legend', name: 'Heroes of Legend', kind: 'always', source: 'detachment', effect: 'Start of your turn, current Oath fulfilled: determine an additional Oath (Deed and Quality not yet chosen) · Qualities of fulfilled Oaths stay active · additional Oath fulfilled: +1CP' },
      { id: 'valours-reward', name: 'Valour’s Reward', kind: 'always', source: 'detachment', effect: 'Detachment Enhancements can become expended · each fulfilled Oath refreshes all expended Enhancements' }
    ],
    'imperial-knights--valourstrike-lance': [
      { id: 'bold-gallantry', name: 'Bold Gallantry', kind: 'always', source: 'detachment', effect: 'IMPERIAL KNIGHTS unit Advances: IMPERIAL KNIGHTS ranged weapons have [ASSAULT] until the end of the turn' }
    ],
    'imperial-knights--spearhead-at-arms': [
      { id: 'knightly-teachings', name: 'Knightly Teachings', kind: 'always', source: 'detachment', scope: 'Command', effect: 'First use of each Bondsman ability per turn: up to three ARMIGER models within 12" (15" while Honoured) · ARMIGER models have BATTLELINE' }
    ],
    'imperial-knights--gate-warden-lance': [
      { id: 'dauntless-defenders', name: 'Dauntless Defenders', kind: 'always', source: 'detachment', effect: 'Start of battle round 1: select two objectives as foundations · IMPERIAL KNIGHTS on the defensive line between them (Against the Horde): ignore Hit roll modifiers vs visible targets · weapons have [SUSTAINED HITS 1]' }
    ],
    'imperial-knights--questor-forgepact': [
      { id: 'cogbound-alliance', name: 'Cogbound Alliance', kind: 'always', source: 'detachment', effect: 'IMPERIAL KNIGHTS (Assisted Targeting Aura): ADEPTUS MECHANICUS units within 6": ranged attacks improve BS by 1 and have [HEAVY] · TECH-PRIEST (Sacristan Pledge): your Command phase, one IMPERIAL KNIGHTS model within 3" heals D3 wounds' }
    ],
    'imperial-knights--dominus-foebreakers': [
      { id: 'rain-of-devastation', name: 'Rain of Devastation', kind: 'always', source: 'detachment', effect: 'IMPERIAL KNIGHTS DOMINUS attacks vs a unit in a terrain area: +1 to Hit' }
    ],
    'imperial-knights--throne-bonded-outriders': [
      { id: 'driven-from-their-lairs', name: 'Driven From Their Lairs', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ARMIGER affected by a Bondsman ability: ranged attacks have [IGNORES COVER]' }
    ]
  },
  stratAddons: {}
};
