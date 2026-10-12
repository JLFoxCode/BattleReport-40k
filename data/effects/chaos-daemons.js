/* Chaos Daemons – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/chaos-daemons.json; effect texts are short English summaries of the CHANGE only. */
const FLUX = 'Flux tokens';
const GREATER = 'BLOODTHIRSTER / GREAT UNCLEAN ONE / KAIROS FATEWEAVER / KEEPER OF SECRETS / LORD OF CHANGE / ROTIGUS / SHALAXI HELBANE / SKARBRAND';
const SOUL_HUNTERS = { id: 'soul-hunters', name: 'Soul Hunters', kind: 'always', source: 'detachment', effect: 'Replaces Shadow of Chaos · Enemy units within 7" are Hunted: ranged weapons have [IGNORES COVER] vs them · they can be charge targets even if not visible' };

export default {
  faction: 'chaos-daemons',
  effects: [
    {
      id: 'shadow-of-chaos', name: 'The Shadow of Chaos', kind: 'choice', source: 'army', pick: 'multi', max: 2,
      when: 'Start of any phase (you control at least half of the objective markers in that area)', duration: 'this phase',
      options: [
        { id: 'no-mans-land', name: 'No Man’s Land', effect: 'No Man’s Land is within your Shadow of Chaos (your deployment zone always is)' },
        { id: 'enemy-deployment-zone', name: 'Opponent’s deployment zone', effect: 'Opponent’s deployment zone is within your Shadow of Chaos (your deployment zone always is)' }
      ]
    },
    { id: 'daemonic-manifestation', name: 'Daemonic Manifestation', kind: 'always', source: 'army', effect: 'LEGIONES DAEMONICA units within your Shadow of Chaos: +1 to Battle-shock rolls · on a success one model heals D3 wounds (BATTLELINE: return up to D3 destroyed non-CHARACTER models instead)' },
    { id: 'daemonic-terror', name: 'Daemonic Terror', kind: 'always', source: 'army', effect: `Enemy units within your Shadow of Chaos and/or within 6" of ${GREATER}: −1 to Battle-shock tests · failed test = D3 mortal wounds` }
  ],
  detachments: {
    'chaos-daemons--daemonic-incursion': [
      { id: 'warp-rifts', name: 'Warp Rifts', kind: 'always', source: 'detachment', effect: `Deep Strike wholly within your Shadow of Chaos and/or wholly within 6" of a friendly ${GREATER} sharing a god keyword: more than 6" from enemy models instead of 8"` }
    ],
    'chaos-daemons--legion-of-excess': [
      { id: 'beguiling-aura', name: 'Beguiling Aura', kind: 'always', source: 'detachment', effect: 'LEGIONES DAEMONICA SLAANESH units can declare a charge in a turn in which they Fell Back' }
    ],
    'chaos-daemons--scintillating-legion': [
      { id: 'fates-in-flux', name: 'Fates in Flux', kind: 'always', source: 'detachment', effect: 'Spend 1 Flux token: re-roll an Advance, Hit, Wound, Damage roll, saving throw or Hazardous test for a LEGIONES DAEMONICA TZEENTCH model/unit (token passes to the opponent) · +1 Flux token in your Command phase if your opponent has any' }
    ],
    'chaos-daemons--blood-legion': [
      { id: 'murdercall', name: 'Murdercall', kind: 'always', source: 'detachment', effect: 'Opponent’s Movement phase: enemy unit (not AIRCRAFT) ends a move within 8" of LEGIONES DAEMONICA KHORNE units – one of them can surge move up to D6"' },
      { id: 'bloodtainted', name: 'Bloodtainted', kind: 'always', source: 'detachment', effect: 'LEGIONES DAEMONICA KHORNE unit destroys an enemy unit that was within range of an objective marker: if your Level of Control is higher, that marker stays yours until the opponent’s Level of Control is greater at the end of a phase' }
    ],
    'chaos-daemons--shadow-legion': [
      { id: 'first-prince-of-chaos', name: 'First Prince of Chaos', kind: 'always', source: 'detachment', effect: 'Abilities linked to the relevant units (see datasheets)' }
    ],
    'chaos-daemons--plague-legion': [
      { id: 'melancholic-miasma', name: 'Melancholic Miasma', kind: 'always', source: 'detachment', effect: 'Enemy units within 9" of LEGIONES DAEMONICA NURGLE units are within your Shadow of Chaos · Each Command phase: one enemy unit within your Shadow of Chaos takes a Battle-shock test' }
    ],
    'chaos-daemons--cavalcade-of-chaos': [
      { id: 'unholy-avalanche', name: 'Unholy Avalanche', kind: 'always', source: 'detachment', effect: 'LEGIONES DAEMONICA MOUNTED units can shoot and declare a charge in a turn in which they Fell Back' }
    ],
    'chaos-daemons--warptide': [
      { id: 'shudderblink', name: 'Shudderblink', kind: 'always', source: 'detachment', effect: 'LEGIONES DAEMONICA BATTLELINE unit Advances: ranged attacks have [ASSAULT] until end of turn · can still declare a charge' }
    ],
    'chaos-daemons--lords-of-the-warp': [
      { id: 'loci-of-power', name: 'Loci of Power', kind: 'always', source: 'detachment', effect: 'LEGIONES DAEMONICA CHARACTER models (not MONSTER): +1 Ld and +1 OC' }
    ],
    'chaos-daemons--daemonic-incursion-ba': [
      SOUL_HUNTERS,
      { id: 'unnatural-energies', name: 'Unnatural Energies', kind: 'always', source: 'detachment', effect: 'LEGIONES DAEMONICA units can perform Secure Site, Set To Defend or Set Overwatch in a turn in which they Advanced or Fell Back' }
    ],
    'chaos-daemons--infernal-onslaught': [
      SOUL_HUNTERS,
      { id: 'brutal-entrance', name: 'Brutal Entrance', kind: 'always', source: 'detachment', effect: 'KHORNE LEGIONES DAEMONICA unit opens a Hatchway: it cannot be closed for the rest of the battle · +1 to Charge rolls this turn if every target is on the other side of it' }
    ],
    'chaos-daemons--rotten-and-rusted': [
      SOUL_HUNTERS,
      { id: 'toxic-miasma', name: 'Toxic Miasma', kind: 'always', source: 'detachment', effect: 'Enemy units within 3" of NURGLE LEGIONES DAEMONICA units (ignoring Walls/closed Hatchways): halve Move · −1 to Advance and Charge rolls' }
    ],
    'chaos-daemons--dread-carnival': [
      SOUL_HUNTERS,
      { id: 'lithe-killers', name: 'Lithe Killers', kind: 'always', source: 'detachment', effect: 'SLAANESH INFANTRY LEGIONES DAEMONICA units can move through models (Normal/Advance/Fall Back) · per model moving through enemy models: D6, on 1–2 its unit suffers 1 mortal wound' }
    ],
    'chaos-daemons--pandaemoniac-inferno': [
      SOUL_HUNTERS,
      { id: 'living-flame', name: 'Living Flame', kind: 'always', source: 'detachment', effect: 'TZEENTCH LEGIONES DAEMONICA units can shoot enemy units within Engagement Range of other friendly TZEENTCH LEGIONES DAEMONICA units · their ranged weapons have [SUSTAINED HITS 1] vs units within Engagement Range of friendly units' }
    ]
  },
  // Keyed by stratagem NAME (matched case-insensitively). Cost is deducted from the resource on use.
  stratAddons: {
    'Impossible Eclipse': [{ id: 'both', name: 'Both areas', resource: FLUX, cost: 1, effect: 'Select both No Man’s Land and the opponent’s deployment zone' }],
    'Pyrogenesis': [{ id: 's3-ap1', name: '+3 S, +1 AP', resource: FLUX, cost: 1, effect: '+3 Strength and improve AP by 1 instead of +2 Strength' }],
    'Flickering Reality': [{ id: 'reroll', name: 'Re-roll the D6', resource: FLUX, cost: 1, effect: 'Re-roll the D6 result' }],
    'Delirium Unmade': [{ id: 'two-units', name: 'Two units', resource: FLUX, cost: 1, effect: 'Target up to two LEGIONES DAEMONICA TZEENTCH units (even within Engagement Range)' }]
  }
};
