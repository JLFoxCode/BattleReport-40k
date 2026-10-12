/* Orks – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/orks.json; effect texts are short English summaries of the CHANGE only.
 * Waaagh! call timing (once per battle, start of a Command phase, until the end of the next turn) follows the faction resource. */
const voidWaaagh = { id: 'void-waaagh', name: 'Void WAAAGH!', kind: 'toggle', source: 'detachment', limit: 'battle', duration: 'until the start of the next battle round', when: 'Start of the battle round', effect: 'Units with Waaagh!: melee weapons +1 Strength and +1 Attacks · 5+ invulnerable save · counts as a Waaagh!' };

export default {
  faction: 'orks',
  effects: [
    { id: 'waaagh', name: 'Waaagh!', kind: 'toggle', source: 'army', limit: 'battle', duration: 'until the end of the next turn', when: 'Start of a Command phase',
      effect: 'ORKS units with Waaagh! are riled up: 5+ invulnerable save · ranged attacks have [ASSAULT] · can charge after Advancing' },
    { id: 'waaagh-advance', name: 'Waaagh! (always)', kind: 'always', source: 'army', scope: 'Movement', effect: 'ORKS units with Waaagh!: re-roll Advance rolls' },
    { id: 'da-boss', name: 'Da Boss', kind: 'always', source: 'army', effect: 'Start of the battle round: +1CP if a model with Da Boss is your WARLORD' }
  ],
  detachments: {
    'orks--war-horde': [
      { id: 'get-stuck-in', name: 'Get Stuck In', kind: 'always', source: 'detachment', scope: 'Fight', effect: 'ORKS melee attacks have [SUSTAINED HITS 1]' }
    ],
    'orks--green-tide': [
      { id: 'mob-handed-brutality', name: 'Mob-handed Brutality', kind: 'always', source: 'detachment', scope: 'Fight', effect: 'BOYZ melee attacks have [SUSTAINED HITS 1] · ORKS INFANTRY that made a Charge move this turn: melee attacks have [LETHAL HITS] vs non-MONSTER/VEHICLE' }
    ],
    'orks--bully-boyz': [
      { id: 'displays-of-savagery', name: 'Displays of Savagery', kind: 'always', source: 'detachment', scope: 'Fight', effect: 'MEGANOBZ / NOBZ melee attacks have [SUSTAINED HITS 1]' }
    ],
    'orks--runt-swarm': [
      { id: 'sneaky-little-gitz', name: 'Sneaky Little Gitz', kind: 'always', source: 'detachment', effect: 'GRETCHIN have BATTLELINE · Advance / Fall Back does not prevent GRETCHIN from starting an action' }
    ],
    'orks--shoota-boyz': [
      { id: 'dakka-dakka-dakka', name: 'Dakka! Dakka! Dakka!', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ORKS INFANTRY ranged attacks have [ASSAULT] · riled up: +3" Range' }
    ],
    'orks--taktikal-brigade': [
      { id: 'suspiciously-well-organised', name: 'Suspiciously Well Organised', kind: 'always', source: 'detachment', effect: 'STORMBOYZ have BATTLELINE · BOYZ / KOMMANDOS / STORMBOYZ can charge after Falling Back' }
    ],
    'orks--wreckas': [
      { id: 'wreckin-and-lootin', name: 'Wreckin’ and Lootin’', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'Your Shooting phase: BREAKA BOYZ / FLASH GITZ / TANKBUSTAS re-roll Hit rolls of 1 if the unit or its target is within range of an objective' }
    ],
    'orks--da-big-hunt': [
      { id: 'da-hunt-is-on', name: 'Da Hunt Is On', kind: 'always', source: 'detachment', effect: 'BEAST SNAGGA attacks vs MONSTER / VEHICLE: +1 AP' }
    ],
    'orks--madcap-meks': [
      { id: 'unpredictable-genius', name: 'Unpredictable Genius', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Your Shooting phase: BIG MEK / MEK GUNS / MORKANAUT / WAZBOM BLASTAJET targets a single enemy unit with all ranged attacks (roll D6)', duration: 'until the unit has shot',
        options: [
          { id: 'dats-weird', name: '1 – Dat’s Weird', effect: 'Target has a 4+ invulnerable save' },
          { id: 'hop-splat', name: '2–3 – Hop Splat', effect: 'One other enemy unit within 3" of the target suffers D3 mortal wounds' },
          { id: 'seekerz', name: '4 – Seekerz', effect: '+1 to Hit' },
          { id: 'lifted', name: '5 – Lifted', effect: 'Target has FLY and cannot have the benefit of cover' },
          { id: 'runitified', name: '6 – Runitified', effect: 'Target has −1 Toughness' }
        ] }
    ],
    'orks--dread-mob': [
      { id: 'try-dat-button', name: 'Try Dat Button!', kind: 'choice', source: 'detachment', pick: 'multi', max: 2,
        when: 'Shooting or Fight phase: ORKS WALKER (not TITANIC) selected to attack – roll one or two D6 (two D6: hazard roll afterwards)', duration: 'until the unit has attacked',
        options: [
          { id: 'attacks', name: '1–2', effect: '+1 Attacks' },
          { id: 'strength', name: '3–4', effect: '+2 Strength' },
          { id: 'ap', name: '5–6', effect: '+1 AP' }
        ] }
    ],
    'orks--blitz-brigade': [
      { id: 'unstoppable-momentum', name: 'Unstoppable Momentum', kind: 'always', source: 'detachment', effect: 'WAGON units: re-roll Charge rolls · Advance rolls can be changed to 6' }
    ],
    'orks--kult-of-speed': [
      { id: 'adrenaline-junkies', name: 'Adrenaline Junkies', kind: 'always', source: 'detachment', effect: 'WARBIKERS have BATTLELINE · SPEED FREEKS Advance / Fall Back: ranged attacks have [ASSAULT] until the end of the turn and can still charge' }
    ],
    'orks--flyboyz': [
      { id: 'skyborne-loons', name: 'Skyborne Loons', kind: 'always', source: 'detachment', effect: 'ORKS AIRCRAFT do not count towards the Strategic Reserves points limit · riled up ORKS AIRCRAFT / DEFFKOPTAS: ranged attacks +1 to Hit' }
    ],
    'orks--brute-bosses': [
      { id: 'ard-as-nails', name: '’Ard As Nails', kind: 'always', source: 'detachment', effect: 'WARBOSS destroyed before its unit has fought: on a 3+ (+1 if riled up) it fights before being removed' }
    ],
    'orks--wurrband': [
      { id: 'powers-of-da-waaagh', name: 'Powers of Da Waaagh!', kind: 'always', source: 'detachment', effect: 'ORKS PSYKER [PSYCHIC] attacks: +1 Strength, +1 more per 5 models in the unit (or embarked) · ORKS PSYKER models have Roar of Mork and Visions of Violence' },
      { id: 'roar-of-mork', name: 'Roar of Mork (psychic level 1)', kind: 'always', source: 'detachment', scope: 'Movement', effect: 'Your Movement phase, psychic roll (1: Battle-shocked): one enemy unit within 12" (not MONSTER / VEHICLE) makes a Battle-shock roll, −1 per 10 models in this unit' },
      { id: 'visions-of-violence', name: 'Visions of Violence (psychic level 1)', kind: 'always', source: 'detachment', scope: 'Fight', effect: 'Start of the Fight phase, psychic roll (1: Battle-shocked): this unit has Fights First' }
    ],
    'orks--ramship-raiders': [
      voidWaaagh,
      { id: 'belligerent-boarders', name: 'Belligerent Boarders', kind: 'always', source: 'detachment', effect: 'Attacks vs ORKS units (not GROTS) with S > T: −1 to Wound' }
    ],
    'orks--kaptin-killers': [
      voidWaaagh,
      { id: 'comin-through', name: 'Comin’ Through', kind: 'always', source: 'detachment', scope: 'Movement', effect: 'Your Movement phase: Desperate Escape tests automatically passed · ORKS Normal / Advance / Fall Back moves pass through models with lower Toughness' }
    ]
  },
  stratAddons: {}
};
