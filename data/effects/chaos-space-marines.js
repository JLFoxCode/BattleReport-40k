/* Chaos Space Marines – current effects (data/effects/SCHEMA.md). Derived from the verbatim originals in
 * data/orig/chaos-space-marines.json; effect texts are short English summaries of the CHANGE only. */
const FORSAKEN = { id: 'the-forsaken', name: 'The Forsaken', kind: 'always', source: 'detachment', effect: 'Failed Dark Pact Leadership test: unit is Forsaken and loses Dark Pacts for the rest of the battle' };

export default {
  faction: 'chaos-space-marines',
  effects: [
    {
      id: 'dark-pacts', name: 'Dark Pacts', kind: 'choice', source: 'army', pick: 'one',
      when: 'Unit selected to shoot or fight (Leadership test – fail = D3 mortal wounds)', duration: 'this phase',
      options: [
        { id: 'lethal-hits', name: '[LETHAL HITS]', effect: 'Weapons gain [LETHAL HITS]' },
        { id: 'sustained-hits', name: '[SUSTAINED HITS 1]', effect: 'Weapons gain [SUSTAINED HITS 1]' }
      ]
    }
  ],
  detachments: {
    'chaos-space-marines--pactbound-zealots': [
      { id: 'marks-of-chaos', name: 'Marks of Chaos', kind: 'always', source: 'detachment', effect: 'Successful Dark Pact, this phase: KHORNE + [LETHAL HITS]: melee Critical Hit on 5+ · TZEENTCH + [LETHAL HITS]: ranged Critical Hit on 5+ · NURGLE + [SUSTAINED HITS 1]: ranged Critical Hit on 5+ · SLAANESH + [SUSTAINED HITS 1]: melee Critical Hit on 5+ · CHAOS UNDIVIDED: re-roll Hit rolls of 1' }
    ],
    'chaos-space-marines--creations-of-bile': [
      {
        id: 'creations-of-bile', name: 'Creations of Bile', kind: 'choice', source: 'detachment', pick: 'multi', max: 2,
        when: 'Start of the battle (select one, or roll 2D6 for two)', duration: 'battle',
        options: [
          { id: 'cholinergic-accelerants', name: '1 – Cholinergic Accelerants', effect: 'HERETIC ASTARTES INFANTRY (not DAMNED): +1 Attacks on melee weapons' },
          { id: 'hyperadrenal-infusion', name: '2 – Hyperadrenal Infusion', effect: 'HERETIC ASTARTES INFANTRY (not DAMNED): +2" Move' },
          { id: 'paraneural-reactions', name: '3 – Paraneural Reactions', effect: 'HERETIC ASTARTES INFANTRY (not DAMNED): improve WS of melee weapons by 1' },
          { id: 'supracutaneous-chitination', name: '4 – Supracutaneous Chitination', effect: 'HERETIC ASTARTES INFANTRY (not DAMNED): +1 Toughness' },
          { id: 'macrotensile-sinews', name: '5 – Macrotensile Sinews', effect: 'HERETIC ASTARTES INFANTRY (not DAMNED): +1 Strength on melee weapons' },
          { id: 'ophthalmic-enhancement', name: '6 – Ophthalmic Enhancement', effect: 'HERETIC ASTARTES INFANTRY (not DAMNED): improve BS of ranged weapons by 1' }
        ]
      }
    ],
    'chaos-space-marines--hurons-marauders': [
      {
        id: 'tyrannical-motivation', name: 'Tyrannical Motivation', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Your Command phase', duration: 'until your next Command phase',
        options: [
          { id: 'hurons-elite', name: 'Huron’s Elite', effect: 'HERETIC ASTARTES INFANTRY: +1 to Hit (both abilities while visible to HURON BLACKHEART)' },
          { id: 'mobile-marauders', name: 'Mobile Marauders', effect: 'HERETIC ASTARTES INFANTRY can shoot and declare a charge after Falling Back (both abilities while visible to HURON BLACKHEART)' }
        ]
      }
    ],
    'chaos-space-marines--renegade-raiders': [
      { id: 'raiders-and-reavers', name: 'Raiders and Reavers', kind: 'always', source: 'detachment', effect: 'HERETIC ASTARTES ranged weapons have [ASSAULT] · attacks vs a unit within range of an objective marker: improve AP by 1' }
    ],
    'chaos-space-marines--deceptors': [
      { id: 'masters-of-misdirection', name: 'Masters of Misdirection', kind: 'always', source: 'detachment', effect: 'Selected LEGIONARIES and CULTIST MOB units (2/3/4 each by battle size) and attached CHARACTERS (not EPIC HERO) have Infiltrators' }
    ],
    'chaos-space-marines--dread-talons': [
      { id: 'terror-descends', name: 'Terror Descends (Aura)', kind: 'always', source: 'detachment', effect: 'Enemy units within 12" of HERETIC ASTARTES units: below Starting Strength = Battle-shock test in their Battle-shock step · −1 to Battle-shock tests' }
    ],
    'chaos-space-marines--nightmare-hunt': [
      { id: 'terror-made-manifest', name: 'Terror Made Manifest', kind: 'always', source: 'detachment', effect: 'Enemy units below Starting Strength within 12": Battle-shock test at −1 · +1 to Hit vs Below Half-strength units · −1 to Hit for Battle-shocked attackers · +1 to Wound vs Battle-shocked units' }
    ],
    'chaos-space-marines--warpstrike-champions': [
      { id: 'warp-portals', name: 'Warp Portals', kind: 'always', source: 'detachment', effect: 'End of opponent’s turn: up to 1/2/3 unengaged HERETIC ASTARTES TERMINATOR, OBLITERATORS or MUTILATORS units into Strategic Reserves' }
    ],
    'chaos-space-marines--chaos-cult': [
      { id: 'desperate-devotion', name: 'Desperate Devotion', kind: 'always', source: 'detachment', effect: 'DAMNED units with Dark Pacts (Normal/Advance move or charge, not arrived from Reserves this turn): Desperate Pact – +2" Move and +2 to Charge rolls this phase (Leadership test, fail = D3 mortal wounds)' }
    ],
    'chaos-space-marines--cult-of-the-arkifane': [
      { id: 'soul-forge-boons', name: 'Soul Forge Boons', kind: 'always', source: 'detachment', effect: 'HERETIC ASTARTES VEHICLE units gain DAEMON · VEHICLE, LORD DISCORDANT and VASHTORR THE ARKIFANE units gain SOUL FORGE · SOUL FORGE units have a 5+ invulnerable save' }
    ],
    'chaos-space-marines--renegade-warband': [
      { id: 'slaves-to-none', name: 'Slaves to None', kind: 'always', replaces: ['dark-pacts'], source: 'detachment', effect: 'HERETIC ASTARTES models lose Dark Pacts · ranged weapons have [ASSAULT]' },
      { id: 'vendetta', name: 'Vendetta', kind: 'always', source: 'detachment', effect: 'Start of your Command phase: one enemy unit – HERETIC ASTARTES (not DAMNED) attacks vs it can re-roll the Hit roll until your next Command phase' },
      {
        id: 'twisted-doctrine', name: 'Twisted Doctrine', kind: 'choice', source: 'detachment', pick: 'one',
        when: 'Your Movement phase, unit set up or selected to move (Battle-shock test first)', duration: 'until end of turn',
        options: [
          { id: 'fall-back', name: 'Fall Back', effect: 'Can shoot and declare a charge after Falling Back' },
          { id: 'advance', name: 'Advance', effect: 'Can declare a charge after Advancing' }
        ]
      }
    ],
    'chaos-space-marines--fellhammer-siege-host': [
      { id: 'iron-fortitude', name: 'Iron Fortitude', kind: 'always', source: 'detachment', effect: 'Ranged attacks vs HERETIC ASTARTES units (not DAMNED): −1 to Wound if S > T' }
    ],
    'chaos-space-marines--soulforged-warpack': [
      { id: 'debt-to-the-soulforge', name: 'Debt to the Soulforge', kind: 'always', source: 'detachment', effect: 'HERETIC ASTARTES DAEMON VEHICLE invoking its contract with a Dark Pact: −1 to the Leadership test · this phase +1 to Wound for ranged attacks and +2 Attacks on melee weapons' }
    ],
    'chaos-space-marines--veterans-of-the-long-war': [
      { id: 'focus-of-hatred', name: 'Focus of Hatred', kind: 'always', source: 'detachment', effect: 'Start of your Command phase: one enemy unit – HERETIC ASTARTES (not DAMNED) attacks vs it can re-roll the Hit roll until your next Command phase' }
    ],
    'chaos-space-marines--cabal-of-chaos': [
      { id: 'empyric-wellspring', name: 'Empyric Wellspring', kind: 'always', source: 'detachment', effect: 'Dark Pact: HERETIC ASTARTES PSYKER (not DAEMON) ranged attacks +1 S in your Shooting phase · DAEMON PRINCE (WITH WINGS) (not KHORNE) melee attacks +2 S and +1 AP in the Fight phase' }
    ],
    'chaos-space-marines--devotees-of-destruction': [
      { id: 'rain-of-ruin', name: 'Rain of Ruin', kind: 'always', source: 'detachment', effect: 'HAVOCS / OBLITERATORS ranged attacks have [HEAVY]' }
    ],
    'chaos-space-marines--murdertalon-raiders': [
      { id: 'prey-on-the-weak', name: 'Prey on the Weak', kind: 'always', source: 'detachment', effect: 'HERETIC ASTARTES INFANTRY FLY attacks vs Battle-shocked or at/below Half-strength units: re-roll Hit rolls of 1 · such enemy units attacking them: −1 to Hit' }
    ],
    'chaos-space-marines--infernal-reavers': [
      FORSAKEN,
      { id: 'dark-rewards', name: 'Dark Rewards', kind: 'always', source: 'detachment', effect: 'Dark Pact Leadership test of 9+: gain 1CP' }
    ],
    'chaos-space-marines--underdeck-uprising': [
      FORSAKEN,
      { id: 'fanatical-onslaught', name: 'Fanatical Onslaught', kind: 'always', source: 'detachment', effect: 'Opponent’s Shooting phase: HERETIC ASTARTES unit lost models to an enemy unit’s shots – Rush move up to 3" towards the attacker (not Battle-shocked, once per turn)' }
    ],
    'chaos-space-marines--champions-of-chaos': [
      FORSAKEN,
      { id: 'dark-purpose', name: 'Dark Purpose', kind: 'always', source: 'detachment', effect: 'HERETIC ASTARTES unit not in Engagement Range: Consolidation move can go towards the closest objective marker (must end within range of it)' }
    ]
  },
  stratAddons: {}
};
