/* Genestealer Cults – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/genestealer-cults.json; effect texts are short English summaries of the CHANGE only. */
const RP = 'Resurgence Points';

const insidiousAmbushers = { id: 'insidious-ambushers', name: 'Insidious Ambushers', kind: 'always', source: 'detachment', effect: 'Replaces Cult Ambush · Your opponent sets up their entire army before you set up any units' };

export default {
  faction: 'genestealer-cults',
  effects: [
    { id: 'cult-ambush', name: 'Cult Ambush', kind: 'counter', source: 'army', resource: RP,
      tiers: [
        { min: 2, effect: 'Re-add a destroyed 5-model ACOLYTE HYBRIDS / HYBRID METAMORPHS / ATALAN JACKALS / PURESTRAIN GENESTEALERS unit (2 RP)' },
        { min: 3, effect: 'Re-add a destroyed 10-model NEOPHYTE HYBRIDS unit (3 RP)' },
        { min: 4, effect: 'Re-add a destroyed 5-model ABERRANTS (4 RP) or 10-model ACOLYTE HYBRIDS / HYBRID METAMORPHS unit (4 RP)' },
        { min: 6, effect: 'Re-add a destroyed 10-model ATALAN JACKALS / PURESTRAIN GENESTEALERS or 20-model NEOPHYTE HYBRIDS unit (6 RP)' },
        { min: 8, effect: 'Re-add a destroyed 10-model ABERRANTS unit (8 RP)' }
      ] },
    { id: 'cult-ambush-markers', name: 'Cult Ambush markers', kind: 'always', source: 'army', effect: 'Re-added unit goes into Cult Ambush at Starting Strength (not destroyed after battle round 3) + Cult Ambush marker more than 8" from enemy units · End of your opponent’s next Movement phase: per marker, one unit makes an ingress move touching it (others wholly within 3") · Marker removed if an enemy model (not AIRCRAFT) ends a move within 8"' }
  ],
  detachments: {
    'genestealer-cults--host-of-ascension': [
      { id: 'a-perfect-ambush', name: 'A Perfect Ambush', kind: 'always', source: 'detachment', effect: 'GENESTEALER CULTS unit set up as Reinforcements: weapons have [SUSTAINED HITS 1] and [IGNORES COVER] until the end of your next Fight phase' }
    ],
    'genestealer-cults--xenocreed-congregation': [
      { id: 'unquestioning-fanaticism', name: 'Unquestioning Fanaticism', kind: 'always', source: 'detachment', effect: 'ACOLYTE HYBRIDS / HYBRID METAMORPHS / NEOPHYTE HYBRIDS led by a CHARACTER: re-roll Advance and Charge rolls · Leading MAGUS / PRIMUS / ACOLYTE ICONWARD: Feel No Pain 3+' }
    ],
    'genestealer-cults--final-day': [
      { id: 'psionic-parasitism', name: 'Psionic Parasitism', kind: 'always', source: 'detachment', scope: 'Movement', effect: 'End of your Movement phase, per TYRANIDS SYNAPSE unit: one GENESTEALER CULTS unit within 9" (not PURESTRAIN GENESTEALER / PATRIARCH) suffers D3+1 mortal wounds, one model of a TYRANIDS unit within 9" regains that many wounds and that unit gets +1 to Hit until your next Movement phase' },
      { id: 'catalyst', name: 'Catalyst (Aura)', kind: 'always', source: 'detachment', effect: 'GENESTEALER CULTS attacks vs enemy units within 6" of a TYRANIDS unit: +1 to Hit' }
    ],
    'genestealer-cults--outlander-claw': [
      { id: 'rapid-takeover', name: 'Rapid Takeover', kind: 'always', source: 'detachment', effect: 'GENESTEALER CULTS MOUNTED / VEHICLE models (not Battle-shocked): +1 OC · End of your Command phase: objectives you control with ATALAN JACKALS in range stay under your control until the opponent’s Level of Control is greater' }
    ],
    'genestealer-cults--biosanctic-broodsurge': [
      { id: 'hypermorphic-fury', name: 'Hypermorphic Fury', kind: 'always', source: 'detachment', effect: 'ABERRANTS / BIOPHAGUS / PURESTRAIN GENESTEALERS: +1 to Charge rolls · selected to fight after a Charge move this turn: melee weapons +1 Attacks' }
    ],
    'genestealer-cults--brood-brother-auxilia': [
      { id: 'integrated-tactics', name: 'Integrated Tactics', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ASTRA MILITARUM unit selected to shoot can mark one visible enemy unit within 18" (must target only it) as caught in overlapping fire · GENESTEALER CULTS ranged attacks vs that unit: +1 to Hit' },
      { id: 'brood-brothers', name: 'Brood Brothers', kind: 'always', source: 'detachment', effect: 'ASTRA MILITARUM models lose Voice of Command' }
    ],
    'genestealer-cults--heroes-of-the-uprising': [
      { id: 'killer-reputation', name: 'Killer Reputation', kind: 'always', source: 'detachment', effect: 'KELERMORPH / LOCUS / REDUCTUS SABOTEUR / SANCTUS models have KILLER · KILLER attacks: re-roll Hit rolls of 1 and Wound rolls of 1' }
    ],
    'genestealer-cults--purestrain-broodswarm': [
      { id: 'enemy-within', name: 'Enemy Within', kind: 'always', source: 'detachment', effect: 'End of your opponent’s Fight phase: unengaged PURESTRAIN GENESTEALER units can be placed into Strategic Reserves' }
    ],
    'genestealer-cults--xenocult-masses': [
      { id: 'hordes-of-the-faithful', name: 'Hordes of the Faithful', kind: 'always', source: 'detachment', scope: 'Command', effect: 'Your Command phase: NEOPHYTE HYBRIDS units within a terrain area heal 3 wounds' }
    ],
    'genestealer-cults--cult-unveiled': [
      insidiousAmbushers,
      { id: 'harassing-fire', name: 'Harassing Fire', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'End of your Shooting phase: one unengaged GENESTEALER CULTS unit can operate an open Hatchway within 1" and make a Normal move of up to 3" (cannot charge this turn)' }
    ],
    'genestealer-cults--genespawn-onslaught': [
      insidiousAmbushers,
      { id: 'blessed-visages', name: 'Blessed Visages', kind: 'always', source: 'detachment', effect: 'Enemy unit declaring a charge vs GENESTEALER CULTS units takes a Leadership test: if failed, −1 to Hit until the end of the turn' }
    ],
    'genestealer-cults--infestation-swarm': [
      { id: 'auspex-ghosts', name: 'Auspex Ghosts', kind: 'always', source: 'detachment', effect: 'Replaces SYNAPSE and Cult Ambush · Your opponent sets up their entire army before you set up any units' },
      { id: 'half-glimpsed-shadows', name: 'Half-Glimpsed Shadows', kind: 'always', source: 'detachment', effect: 'Ranged attacks vs GREAT DEVOURER units from more than 6" away: −1 to Hit' }
    ]
  },
  stratAddons: {}
};
