/* Death Guard – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/death-guard.json; effect texts are short English summaries of the CHANGE only. */
const CR = 'Contagion Range';
const PLAGUES = [
  { id: 'skullsquirm-blight', name: 'Skullsquirm Blight', effect: 'Afflicted enemy units: −1 T · their ranged attacks grant the target cover · −1 to Hit in melee' },
  { id: 'rattlejoint-ague', name: 'Rattlejoint Ague', effect: 'Afflicted enemy units: −1 T · worsen Save by 1' },
  { id: 'scabrous-soulrot', name: 'Scabrous Soulrot', effect: 'Afflicted enemy units: −1 T · worsen Move, Leadership and OC by 1 (OC min. 1)' }
];
const SLOW_DECAY = {
  id: 'slow-decay', name: 'Slow Decay', kind: 'counter', source: 'detachment', resource: CR,
  effect: 'Contagion Range ignores Walls and closed Hatchways; replaces the Nurgle’s Gift values',
  byRound: { 1: '1"', 2: '3"', 3: '6"' }
};

export default {
  faction: 'death-guard',
  effects: [
    {
      id: 'contagion-range', name: 'Nurgle’s Gift (Aura) – Contagion Range', kind: 'counter', source: 'army', resource: CR,
      effect: 'Enemy units within Contagion Range of DEATH GUARD units are Afflicted (max. 12" after modifiers)',
      byRound: { 1: '3"', 2: '6"', 3: '9"' }
    },
    {
      id: 'plague', name: 'Nurgle’s Gift – Plague', kind: 'choice', source: 'army', pick: 'one',
      when: 'Declare Battle Formations', duration: 'battle',
      options: PLAGUES
    }
  ],
  detachments: {
    'death-guard--virulent-vectorium': [
      { id: 'worldblight', name: 'Worldblight', kind: 'always', source: 'detachment', effect: 'End of your Command phase: objectives controlled by DEATH GUARD units are secured · enemy units within range of such an objective are Afflicted (until you lose control)' }
    ],
    'death-guard--mortarions-hammer': [
      { id: 'miasmic-bombardment', name: 'Miasmic Bombardment', kind: 'always', source: 'detachment', effect: 'Start of the battle round: 1/2/3 enemy units more than 12" from all your models are Afflicted until end of the battle round' }
    ],
    'death-guard--champions-of-contagion': [
      {
        id: 'manifold-maladies', name: 'Manifold Maladies', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of the battle round', duration: 'battle',
        options: PLAGUES
      }
    ],
    'death-guard--tallyband-summoners': [
      { id: 'reverberant-rancidity', name: 'Reverberant Rancidity', kind: 'always', source: 'detachment', effect: 'PLAGUE LEGIONS units within 7" of DEATH GUARD units have Nurgle’s Gift · DEATH GUARD units within 7" of PLAGUE LEGIONS units: +3" Contagion Range' }
    ],
    'death-guard--shamblerot-vectorium': [
      { id: 'numberless-horde', name: 'Numberless Horde', kind: 'always', source: 'detachment', effect: 'Your Command phase in rounds 2–3 / 2–4 / 2–5 (by battle size): new 10-model POXWALKERS unit in Strategic Reserves · POXWALKERS are BATTLELINE' }
    ],
    'death-guard--death-lords-chosen': [
      { id: 'deadly-vectors', name: 'Deadly Vectors', kind: 'always', source: 'detachment', effect: 'Opponent’s Command phase: 2D6 per Afflicted enemy unit (−1 if Below Half-strength) – on 6 or less it suffers D3 mortal wounds' }
    ],
    'death-guard--paragons-of-putrescence': [
      { id: 'hypervirulent-strains', name: 'Hypervirulent Strains', kind: 'always', source: 'detachment', effect: 'DEATH GUARD CHARACTER units: +3" Contagion Range (max. 12")' }
    ],
    'death-guard--contagion-engines': [
      { id: 'warped-and-rusted-animus', name: 'Warped and Rusted Animus', kind: 'always', source: 'detachment', effect: 'FOETID BLOAT-DRONE (WITH HEAVY BLIGHT LAUNCHER) / HELBRUTE / MYPHITIC BLIGHT-HAULER units are CONTAGION ENGINE · CONTAGION ENGINE ranged attacks have [ASSAULT]' }
    ],
    'death-guard--flyblown-host': [
      { id: 'verminous-haze', name: 'Verminous Haze', kind: 'always', source: 'detachment', effect: 'Up to two PLAGUE MARINES units have Infiltrators' }
    ],
    'death-guard--vectors-of-decay': [
      SLOW_DECAY,
      { id: 'sevenfold-offerings', name: 'Sevenfold Offerings', kind: 'always', source: 'detachment', effect: '+2" Contagion Range for every seven destroyed enemy models (applies after the current attacking unit finishes)' }
    ],
    'death-guard--unclean-uprising': [
      SLOW_DECAY,
      { id: 'relentless-spread', name: 'Relentless Spread', kind: 'always', source: 'detachment', effect: 'DEATH GUARD Consolidation: up to D3+3" · if it cannot end within Engagement Range, it can move in any direction' }
    ],
    'death-guard--arch-contaminators': [
      SLOW_DECAY,
      { id: 'inescapable-corruption', name: 'Inescapable Corruption', kind: 'always', source: 'detachment', effect: 'Enemy units within Contagion Range performing a Tactical Manoeuvre: Leadership test, fail = no effect · Your Command phase: D6 per opponent-Secured objective within Contagion Range, on 5+ no longer Secured' }
    ]
  },
  stratAddons: {}
};
