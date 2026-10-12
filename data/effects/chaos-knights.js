/* Chaos Knights – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/chaos-knights.json; effect texts are short English summaries of the CHANGE only. */
export default {
  faction: 'chaos-knights',
  effects: [
    { id: 'deathly-terror', name: 'Deathly Terror (Aura)', kind: 'always', source: 'army', effect: 'Enemy units within 9" of a model with Harbingers of Dread: −1 Leadership' },
    {
      id: 'harbingers-of-dread', name: 'Harbingers of Dread', kind: 'choice', source: 'army', pick: 'multi', max: 6,
      when: 'Start of battle rounds 1, 3 and 5 (select one, or roll 2D6 for two)', duration: 'battle',
      options: [
        { id: 'despair', name: '1 – Despair (Aura)', limit: 'battle', effect: 'Enemy units within 9": a further −1 Leadership (cumulative with Deathly Terror)' },
        { id: 'doom', name: '2 – Doom', limit: 'battle', effect: '+1 to Wound vs Battle-shocked targets' },
        { id: 'darkness', name: '3 – Darkness', limit: 'battle', effect: 'Stealth' },
        { id: 'dismay', name: '4 – Dismay (Aura)', limit: 'battle', effect: 'Opponent’s Battle-shock step: enemy units below Starting Strength within 9" take a Battle-shock test' },
        { id: 'delirium', name: '5 – Delirium (Aura)', limit: 'battle', effect: 'Enemy units Below Half-strength within 9": failed Battle-shock test = D3 mortal wounds' },
        { id: 'dominion', name: '6 – Dominion', limit: 'battle', effect: '+3" to the range of Aura abilities' }
      ]
    },
    { id: 'super-heavy-walker', name: 'Super-heavy Walker', kind: 'always', source: 'army', effect: 'Normal/Advance/Fall Back: move through models (not TITANIC) and terrain up to 4" high · may cross Engagement Range but not end in it · terrain over 4": roll D6 after moving, on a 1 Battle-shocked' }
  ],
  detachments: {
    'chaos-knights--infernal-lance': [
      {
        id: 'malefic-surge', name: 'Malefic Surge', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Empowered unit (Command phase, Leadership test – fail = D3 mortal wounds) uses one ability', duration: 'this phase',
        options: [
          { id: 'unholy-hunger', name: 'Unholy Hunger', effect: '+3" Move for a Normal, Advance or Fall Back move' },
          { id: 'diabolic-power-lethal', name: 'Diabolic Power: [LETHAL HITS]', effect: 'Weapons have [LETHAL HITS] (when selected to shoot or fight)' },
          { id: 'diabolic-power-sustained', name: 'Diabolic Power: [SUSTAINED HITS 1]', effect: 'Weapons have [SUSTAINED HITS 1] (when selected to shoot or fight)' },
          { id: 'unnatural-fortitude-invuln', name: 'Unnatural Fortitude: 5+ invulnerable', effect: '5+ invulnerable save (when targeted by an attack)' },
          { id: 'unnatural-fortitude-fnp', name: 'Unnatural Fortitude: Feel No Pain 6+', effect: 'Feel No Pain 6+ (when targeted by an attack)' }
        ]
      }
    ],
    'chaos-knights--helhunt-lance': [
      { id: 'masters-of-the-pack', name: 'Masters of the Pack', kind: 'always', source: 'detachment', effect: 'TITANIC CHAOS KNIGHTS unit is also affected by its own Aura that affects WAR DOG units while two or more friendly WAR DOG models are within range of it' }
    ],
    'chaos-knights--traitoris-lance': [
      { id: 'paragons-of-terror', name: 'Paragons of Terror', kind: 'always', source: 'detachment', effect: 'Start of battle round 1: select one additional Dread ability (not random)' }
    ],
    'chaos-knights--houndpack-lance': [
      { id: 'marked-prey', name: 'Marked Prey', kind: 'always', source: 'detachment', effect: 'Start of your Command phase: one enemy unit – WAR DOG attacks vs it (if visible) have [SUSTAINED HITS 1] until your next Command phase · WAR DOG units are BATTLELINE; 3 selected WAR DOG units are CHARACTER' }
    ],
    'chaos-knights--lords-of-dread': [
      { id: 'tyrannical-court', name: 'Tyrannical Court', kind: 'always', source: 'detachment', effect: 'CHAOS KNIGHT CHARACTER models: +2 OC · Once per battle round, while your WARLORD is on the battlefield: Claimed for the Dark Gods costs 0CP' }
    ],
    'chaos-knights--bastions-of-tyranny': [
      { id: 'annihilate-the-unworthy', name: 'Annihilate the Unworthy', kind: 'always', source: 'detachment', effect: 'KNIGHT TYRANT attacks vs a Battle-shocked unit: +1 to Hit' }
    ],
    'chaos-knights--hunting-warpack': [
      { id: 'scenting-fear', name: 'Scenting Fear', kind: 'always', source: 'detachment', effect: 'Once per battle round, your Shooting phase: one visible enemy unit within 12" of a friendly WAR DOG has +6" detection range' }
    ],
    'chaos-knights--iconoclast-fiefdom': [
      { id: 'wretched-thralls', name: 'Wretched Thralls', kind: 'always', source: 'detachment', effect: 'Friendly DAMNED units can re-roll Leadership rolls (up to 500 pts of DAMNED units allowed)' }
    ]
  },
  stratAddons: {}
};
