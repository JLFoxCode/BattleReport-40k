/* Tyranids – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/tyranids.json; effect texts are short English summaries of the CHANGE only. */
const synapticWeb = { id: 'synaptic-web', name: 'Synaptic Web', kind: 'always', source: 'detachment', effect: 'Synapse Range ignores Walls and closed Hatchways' };

export default {
  faction: 'tyranids',
  effects: [
    { id: 'synapse', name: 'Synapse', kind: 'always', source: 'army', effect: 'TYRANIDS within 6" of a friendly SYNAPSE model: Battle-shock tests on 3D6 · melee attacks +1 Strength' },
    { id: 'shadow-in-the-warp', name: 'Shadow in the Warp', kind: 'toggle', source: 'army', limit: 'battle', duration: 'this phase', when: 'Either player’s Command phase',
      effect: 'Each enemy unit takes a Battle-shock test (−1 if within 6" of a SYNAPSE unit)' }
  ],
  detachments: {
    'tyranids--subterranean-assault': [
      { id: 'surprise-assault', name: 'Surprise Assault', kind: 'always', source: 'detachment', effect: 'TYRANIDS attacks: re-roll Hit rolls of 1 · MAWLOC / TRYGON have BURROWER · BURROWER arriving from Reserves places a Tunnel Marker · Reserves can arrive wholly within 9" of a Tunnel Marker and more than 6" from enemy units' }
    ],
    'tyranids--invasion-fleet': [
      { id: 'hyper-adaptations', name: 'Hyper-adaptations', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of the first battle round', duration: 'battle',
        options: [
          { id: 'swarming-instincts', name: 'Swarming Instincts', effect: 'TYRANIDS attacks vs INFANTRY / SWARM have [SUSTAINED HITS 1]' },
          { id: 'hyper-aggression', name: 'Hyper-aggression', effect: 'TYRANIDS attacks vs MONSTER / VEHICLE have [LETHAL HITS]' },
          { id: 'hive-predators', name: 'Hive Predators', effect: 'TYRANIDS attacks vs CHARACTER: Critical Hit → [PRECISION]' }
        ] }
    ],
    'tyranids--synaptic-nexus': [
      { id: 'synaptic-imperatives', name: 'Synaptic Imperatives', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of the battle round', duration: 'battle round',
        options: [
          { id: 'synaptic-augmentation', name: 'Synaptic Augmentation', effect: 'TYRANIDS within Synapse Range: 5+ invulnerable save', limit: 'battle' },
          { id: 'surging-vitality', name: 'Surging Vitality', effect: 'TYRANIDS within Synapse Range: +1 to Advance and Charge rolls', limit: 'battle' },
          { id: 'goaded-to-slaughter', name: 'Goaded to Slaughter', effect: 'TYRANIDS within Synapse Range: melee attacks +1 to Hit', limit: 'battle' }
        ] }
    ],
    'tyranids--assimilation-swarm': [
      { id: 'feed-the-swarm', name: 'Feed the Swarm', kind: 'always', source: 'detachment', scope: 'Command', effect: 'Your Command phase: each HARVESTER Regenerates one TYRANIDS unit within 6": one model regains up to D3+1 lost wounds, or one destroyed INFANTRY model (not CHARACTER) returns (ENDLESS MULTITUDE: up to 3)' }
    ],
    'tyranids--crusher-stampede': [
      { id: 'enraged-behemoths', name: 'Enraged Behemoths', kind: 'always', source: 'detachment', effect: 'TYRANIDS MONSTER attacks: +1 to Hit if below Starting Strength; also +1 to Wound if Below Half-strength · at Starting Strength (not Battle-shocked): +2 OC' }
    ],
    'tyranids--vanguard-onslaught': [
      { id: 'questing-tendrils', name: 'Questing Tendrils', kind: 'always', source: 'detachment', effect: 'TYRANIDS can charge after Falling Back · VANGUARD INVADER can charge after Advancing' },
      { id: 'vanguard-prime', name: 'Vanguard Prime', kind: 'always', source: 'detachment', effect: 'DEATHLEAPER loses Hunter Organism and can be your WARLORD' }
    ],
    'tyranids--unending-swarm': [
      { id: 'insurmountable-odds', name: 'Insurmountable Odds', kind: 'always', source: 'detachment', effect: 'Your opponent’s Shooting phase: ENDLESS MULTITUDE unit that lost a model to an enemy unit’s attacks can make a surge move of up to D6"' }
    ],
    'tyranids--ambush-predators': [
      { id: 'mindhunger', name: 'Mindhunger', kind: 'always', source: 'detachment', effect: 'DEATHLEAPER / LICTOR / NEUROLICTOR have Deep Strike · LICTOR / NEUROLICTOR attacks vs CHARACTER: re-roll Hit rolls of 1' }
    ],
    'tyranids--talons-of-the-norn-queen': [
      { id: 'higher-imperatives', name: 'Higher Imperatives', kind: 'always', source: 'detachment', effect: 'NORN EMISSARY / NORN ASSIMILATOR (Protean Purpose): once per battle per unit, your Command phase – re-select Singular Purpose' }
    ],
    'tyranids--warrior-bioform-onslaught': [
      { id: 'leader-beasts', name: 'Leader-beasts', kind: 'always', source: 'detachment', effect: 'TYRANID WARRIORS units have TYRANID WARRIORS and BATTLELINE · TYRANID WARRIORS / TYRANID PRIME WITH LASH WHIP / WINGED TYRANID PRIME: 5+ invulnerable save' }
    ],
    'tyranids--tyranid-attack': [
      synapticWeb,
      { id: 'xeno-terror', name: 'Xeno-Terror', kind: 'always', source: 'detachment', effect: 'Shadow in the Warp: additional −1 to the Battle-shock tests · units that fail cannot Fire Overwatch this turn' }
    ],
    'tyranids--boarding-swarm': [
      synapticWeb,
      { id: 'priority-predation', name: 'Priority Predation', kind: 'always', source: 'detachment', effect: 'Enemy unit Falls Back from TYRANIDS units: each of them no longer engaged can make a Normal move of up to 3"' }
    ],
    'tyranids--biotide': [
      synapticWeb,
      { id: 'unstoppable-swarm', name: 'Unstoppable Swarm', kind: 'always', source: 'detachment', effect: 'TYRANIDS move through friendly TYRANIDS models · +1 to Hatchway roll-offs' }
    ],
    'tyranids--infestation-swarm': [
      { id: 'auspex-ghosts', name: 'Auspex Ghosts', kind: 'always', source: 'detachment', effect: 'Replaces SYNAPSE and Cult Ambush · Your opponent sets up their entire army before you set up any units' },
      { id: 'half-glimpsed-shadows', name: 'Half-Glimpsed Shadows', kind: 'always', source: 'detachment', effect: 'Ranged attacks vs GREAT DEVOURER units from more than 6" away: −1 to Hit' }
    ]
  },
  stratAddons: {}
};
