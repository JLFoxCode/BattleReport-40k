/* Astra Militarum – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/astra-militarum.json; effect texts are short English summaries of the CHANGE only. */
const DIRECT_ORDERS = { id: 'direct-orders', name: 'Direct Orders', kind: 'always', source: 'detachment', effect: 'OFFICER Orders can be issued to any friendly ASTRA MILITARUM unit within range, regardless of keywords' };

export default {
  faction: 'astra-militarum',
  effects: [
    { id: 'voice-of-command', name: 'Voice of Command (Orders)', kind: 'choice', source: 'army', pick: 'multi', max: 6,
      when: 'Per unit: your Command phase, or end of a phase in which the OFFICER disembarked / was set up (OFFICER within 6"; one Order per unit; not Battle-shocked)',
      duration: 'until your next Command phase',
      options: [
        { id: 'move-move-move', name: 'Move! Move! Move!', effect: '+3" Move' },
        { id: 'fix-bayonets', name: 'Fix Bayonets!', effect: 'Melee weapons +1 WS' },
        { id: 'take-aim', name: 'Take Aim!', effect: 'Ranged weapons +1 BS' },
        { id: 'first-rank-fire', name: 'First Rank, Fire! Second Rank, Fire!', effect: '[RAPID FIRE] weapons +1 A' },
        { id: 'take-cover', name: 'Take Cover!', effect: '+1 Save (max. 3+)' },
        { id: 'duty-and-honour', name: 'Duty and Honour!', effect: '+1 Ld and +1 OC' }
      ] }
  ],
  detachments: {
    'astra-militarum--grizzled-company': [
      { id: 'ruthless-discipline', name: 'Ruthless Discipline', kind: 'always', source: 'detachment', effect: 'OFFICER models issue +1 Order · ASTRA MILITARUM units affected by an Order: re-roll Hit rolls of 1' }
    ],
    'astra-militarum--siege-regiment': [
      { id: 'artillery-support', name: 'Artillery Support', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Start of the battle round (max. units: Incursion 2, Strike Force 3, Onslaught 4)', duration: 'battle round',
        options: [
          { id: 'creeping-barrage', name: 'Creeping Barrage', effect: 'Enemy units more than 12" from your army: on 5+ shaken – −2" Move and −2 to Charge rolls' },
          { id: 'incendiary-bombardment', name: 'Incendiary Bombardment', effect: 'Selected enemy units more than 12" from your army are scattered – cannot have the Benefit of Cover' },
          { id: 'smoke-shells', name: 'Smoke Shells', effect: 'Selected units from your army have Stealth' }
        ] }
    ],
    'astra-militarum--hammer-of-the-emperor': [
      { id: 'iron-tread', name: 'Iron Tread', kind: 'always', source: 'detachment', effect: 'SQUADRON units Advance +6" (no roll) and can move through Engagement Range (not end within it)' }
    ],
    'astra-militarum--steel-hammer': [
      { id: 'ceaseless-cannonade', name: 'Ceaseless Cannonade', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ASTRA MILITARUM TITANIC / SQUADRON units can shoot enemy units within Engagement Range (incl. Blast) without the Hit penalty, if no other friendly unit is engaged with that enemy (not Indirect Fire)' },
      { id: 'titanic-characters', name: 'Titanic Characters', kind: 'always', source: 'detachment', effect: 'Selected ASTRA MILITARUM TITANIC units gain CHARACTER (Muster Armies)' }
    ],
    'astra-militarum--mechanised-assault': [
      { id: 'armoured-fist', name: 'Armoured Fist', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'ASTRA MILITARUM ranged attacks in a turn the model disembarked from a TRANSPORT: +1 to Wound' }
    ],
    'astra-militarum--recon-element': [
      { id: 'masters-of-camouflage', name: 'Masters of Camouflage', kind: 'always', source: 'detachment', effect: 'ASTRA MILITARUM units (not TITANIC) have Stealth' }
    ],
    'astra-militarum--armoured-infantry': [
      { id: 'squadron-command', name: 'Squadron Command', kind: 'always', source: 'detachment', effect: 'OFFICER units can issue Orders to SQUADRON units · ASTRA MILITARUM SQUADRON units gain ARMOURED SKIRMISHER (not ARTILLERY / W13+) · New Order On My Signal (ARMOURED SKIRMISHER): Normal move up to D6" when an enemy unit ends a Normal / Advance move within 8" (once per turn)' }
    ],
    'astra-militarum--combined-arms': [
      { id: 'born-soldiers', name: 'Born Soldiers', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'REGIMENT ranged attacks vs visible units (not MONSTER / VEHICLE) gain [LETHAL HITS] · SQUADRON ranged attacks vs visible MONSTER / VEHICLE units gain [LETHAL HITS]' }
    ],
    'astra-militarum--bridgehead-strike': [
      { id: 'fire-zone-purge', name: 'Fire Zone Purge', kind: 'always', source: 'detachment', effect: 'MILITARUM TEMPESTUS OFFICER as WARLORD: TEMPESTUS SCIONS gain BATTLELINE and +1 OC · MILITARUM TEMPESTUS units set up this turn: +1 to Hit with ranged attacks' }
    ],
    'astra-militarum--designation-force': [
      { id: 'designated-targets', name: 'Designated Targets', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'SCOUT SENTINEL / ASTRA MILITARUM INFANTRY SMOKE units: in your Shooting phase, designate one visible enemy unit within 12" – designated units have +3" detection range' }
    ],
    'astra-militarum--abhuman-auxiliaries': [
      { id: 'absolutist-principles', name: 'Absolutist Principles', kind: 'always', source: 'detachment', effect: 'BULLGRYN SQUAD / OGRYN SQUAD / RATLINGS gain ABHUMAN · COMMISSAR models can issue Take Aim! and 1 Order to a friendly ABHUMAN unit' }
    ],
    'astra-militarum--embarked-regiment': [
      DIRECT_ORDERS,
      { id: 'get-down', name: 'Get Down!', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'When selected to shoot: ignore one other friendly ASTRA MILITARUM unit (not OGRYN) for visibility this phase' }
    ],
    'astra-militarum--tempestus-boarding-regiment': [
      DIRECT_ORDERS,
      { id: 'purge-sweep-protocols', name: 'Purge-Sweep Protocols', kind: 'always', source: 'detachment', scope: 'Shooting', effect: 'MILITARUM TEMPESTUS units within 1" of an open Hatchway: ranged weapons gain [LETHAL HITS] vs one enemy unit on the other side (this phase)' }
    ]
  },
  stratAddons: {}
};
