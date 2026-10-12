/* Leagues of Votann – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/leagues-of-votann.json; effect texts are short English summaries of the CHANGE only. */
const YP = 'Yield Points (YP)';

export default {
  faction: 'leagues-of-votann',
  effects: [
    {
      id: 'prioritised-efficiency', name: 'Prioritised Efficiency', kind: 'threshold', source: 'army',
      resource: YP, decidedAt: 'End of your Command phase (start of battle: Hostile Acquisition)',
      states: [
        { id: 'hostile-acquisition', name: 'Hostile Acquisition', max: 6, effect: '+1 to Hit vs enemy units within range of an objective marker · Re-roll Advance and Charge rolls' },
        { id: 'fortify-takeover', name: 'Fortify Takeover', min: 7, effect: '+1 to Hit while this unit is within range of an objective marker you control · −1 to Wound against this unit if the attack’s S > its T (not VEHICLE)' }
      ]
    }
  ],
  detachments: {
    'hearthband': [
      { id: 'methodical-annihilation', name: 'Methodical Annihilation', kind: 'always', source: 'detachment', effect: 'Attacks vs the closest eligible target or a target within Engagement Range: re-roll Wound rolls of 1 · KÂHL / EINHYR HEARTHGUARD / ÛTHAR THE DESTINED: improve AP by 1 (see original)' }
    ],
    'needga-rd-oathband': [
      { id: 'martial-leverage', name: 'Martial Leverage', kind: 'always', source: 'detachment', effect: 'Gain 1 YP each time an enemy unit is destroyed' }
    ],
    'persecution-prospect': [
      { id: 'assailed-from-every-angle', name: 'Guerrilla Adepts', kind: 'always', source: 'detachment', effect: 'Shooting phase, when selected to shoot: mark one enemy unit (not MONSTER/VEHICLE) as assailed (see original)' }
    ],
    'hearthfyre-arsenal': [
      { id: 'optimal-application', name: 'Optimal Application', kind: 'always', source: 'detachment', effect: 'End of your Command phase: +1 YP per controlled objective outside your deployment zone with an IRON-MASTER / MEMNYR STRATEGIST in range (max. 2 YP per turn)' }
    ],
    'd-lve-assault-shift': [
      { id: 'fury-from-the-delve', name: 'Fury from the Dêlve', kind: 'always', source: 'detachment', effect: 'CTHONIAN BESERKS units have Deep Strike' }
    ],
    'brandfast-oathband': [
      { id: 'mobile-sensor-relays', name: 'Firebase Control (Aura)', kind: 'always', source: 'detachment', effect: 'LEAGUES OF VOTANN INFANTRY wholly within 6" of a TRANSPORT: ranged weapons have [SUSTAINED HITS 1]' }
    ],
    'mercenary-oathband': [
      { id: 'ruthless-reinvestment', name: 'Ruthless Reinvestment', kind: 'choice', source: 'detachment', pick: 'one',
        replaces: ['prioritised-efficiency'], default: 'hostile-acquisition', switchCost: 3, resource: YP,
        when: 'End of your Command phase (spend 3 YP to switch)', duration: 'until changed',
        options: [
          { id: 'hostile-acquisition', name: 'Hostile Acquisition', effect: '+1 to Hit vs enemy units within range of an objective marker · Re-roll Advance and Charge rolls' },
          { id: 'fortify-takeover', name: 'Fortify Takeover', effect: '+1 to Hit while within range of an objective marker you control · −1 to Wound if the attack’s S > T (not VEHICLE)' }
        ] }
    ],
    'armoured-trailblazers': [
      { id: 'sagitaur-spearhead', name: 'Sagitaur Spearhead', kind: 'always', source: 'detachment', effect: 'SAGITAUR units have Scouts 6"' }
    ],
    'farseekers': [
      { id: 'eye-of-the-hunt', name: 'Eye of the Hunt', kind: 'always', source: 'detachment', effect: 'HERNKYN ranged attacks vs a unit within 12": +1 to Hit' }
    ],
    'hearthguard-covenant': [
      { id: 'avatars-of-the-ancestors', name: 'Avatars of the Ancestors', kind: 'always', source: 'detachment', effect: 'KÂHL / EINHYR CHAMPION / EINHYR HEARTHGUARD / ÛTHAR THE DESTINED ranged attacks vs a unit within 9": re-roll Wound rolls of 1' }
    ]
  },
  // Keyed by stratagem NAME (matched case-insensitively). Cost is deducted from the resource on use.
  stratAddons: {
    'Fury of the Hearth': [{ id: 'sh1', name: '+[SUSTAINED HITS 1]', resource: YP, cost: 1, effect: 'Ranged weapons also gain [SUSTAINED HITS 1]' }],
    'Ancestral Sentence': [{ id: 'sh2', name: '[SUSTAINED HITS 2]', resource: YP, cost: 3, effect: '[SUSTAINED HITS 2] instead of [SUSTAINED HITS 1]' }],
    'Honour of the Hold': [{ id: 'ap2', name: 'AP +2', resource: YP, cost: 3, effect: 'Improve AP by 2 instead of 1' }],
    'Exposed Flaws': [{ id: 'rr-wound', name: 'Re-roll Wound rolls', resource: YP, cost: 2, effect: 'Re-roll the Wound roll against any target' }],
    'Claimstaker Reflex': [{ id: 'move6', name: 'Move 6"', resource: YP, cost: 2, effect: 'Normal move of up to 6" instead of D6"' }],
    'Wall of Steel': [{ id: 'plus2d6', name: '+2 D6', resource: YP, cost: 2, effect: 'Roll two additional D6' }],
    'Cyberstimm Infusion': [{ id: 'rr-wound', name: 'Re-roll Wound rolls', resource: YP, cost: 2, effect: 'Re-roll the Wound roll instead of only 1s' }],
    'Augmented Assault': [{ id: 'move', name: '+X" Move', resource: YP, cost: 'any', max: 2, effect: '+1" Move per YP spent (up to 2)' }],
    'Tectonic Fracture': [{ id: 'charge-2', name: '−2 Charge', resource: YP, cost: 2, effect: 'Also subtract 2 from Charge rolls' }],
    'Vengeance Flare': [{ id: 'hekaton', name: 'HEKATON LAND FORTRESS', resource: YP, cost: 2, effect: 'Select a HEKATON LAND FORTRESS instead' }],
    'Optimal Expenditure': [{ id: 'rr-wound', name: 'Re-roll Wound rolls', resource: YP, cost: 3, effect: 'Re-roll Hit rolls of 1 and the Wound roll' }],
    'Privateer Arsenal': [{ id: 'rr-hit', name: 'Re-roll Hit rolls', resource: YP, cost: 3, effect: 'Re-roll the Hit roll and Wound rolls of 1' }],
    'Adaptable Avarice': [{ id: 'spend', name: 'Spend YP (any)', resource: YP, cost: 'any', effect: 'If 6 or fewer YP remain: Hostile Acquisition until the start of your next turn' }]
  }
};
