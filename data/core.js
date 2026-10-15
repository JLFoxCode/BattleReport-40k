/* Warhammer 40,000 – 11th Edition (June 2026) · Core rules for the phone rulebook
 *
 * Sources (as of 2026-10-11):
 *  - Wahapedia, 11th Edition Core Rules: https://wahapedia.ru/wh40k11ed/the-rules/core-rules/
 *    (sections 01–25: core concepts, phases, terrain, objectives, stratagems, transports,
 *    attached units, strategic reserves, core abilities, weapon abilities, muster armies)
 *  - Wahapedia, 11th Edition Rules Appendix: https://wahapedia.ru/wh40k11ed/the-rules/rules-appendix/
 *    (modifiers, re-rolls, starting strength, not on the battlefield, random characteristics …)
 *  - Mission / scoring rules (VP limits, tactical cards, DP): Chapter Approved Mission Deck 2026-27
 *    (https://wahapedia.ru/wh40k11ed/the-rules/mission-deck-2026-27/) and data/rules.js of this project.
 *  - data/datasheets/core-abilities.json: verbatim core and weapon ability texts (glossary entries
 *    marked `orig: true` quote them word for word; examples and designer's notes omitted).
 *
 * All texts are short English condensations of the original 11th-edition wording. Rule names,
 * keywords and weapon abilities are kept in UPPER CASE as printed. Entries that differ from the
 * 10th Edition are marked `ed: 11`, unverified points `unsure: true`, verbatim quotes `orig: true`.
 *
 * Schema:
 *  phases.<id>  { title, order: ['step …'], rules: [{ id, title, text, tags, ed?, unsure?, orig? }] }
 *  turnStart    [{ id, title, text }]            start of battle round / start of turn
 *  general      [{ id, title, text, tags }]      reference section
 *  glossary     [{ term, text, orig? }]          weapon abilities and core terms
 */

export const CORE = {
  phases: {
    // ───────────────────────── Command phase ─────────────────────────
    command: {
      title: 'Command phase',
      order: [
        'Start of Command phase: resolve "start of your Command phase" rules; Tactical secondaries: draw two cards.',
        'Gain Core CP: both players gain 1 CP.',
        'Battle-shock step: for each of your units that is battle-shocked or at or below half-strength, roll 2D6 against its Ld.',
        'Apply the results: success = the unit is no longer battle-shocked, failure = the unit is battle-shocked.',
        'Command Abilities: resolve rules triggered "in your Command phase" (army rules, datasheets, command abilities).',
        'End of Command phase: check "end of your Command phase" scoring (from battle round 2); Tactical secondaries: (once per battle, 1 CP) discard one card and draw a new one.'
      ],
      rules: [
        {
          id: 'cmd-cp', title: 'Gaining Command Points',
          text: 'In the Gain Core CP step both players gain 1 CP – including the player whose turn it is not. CP are spent to use stratagems.',
          tags: ['CP'], ed: 11
        },
        {
          id: 'cmd-shock-who', title: 'Who must make a battle-shock roll?',
          text: 'Only the active player rolls. One battle-shock roll must be made for each of their units that is currently battle-shocked or at or below half-strength. No more than one battle-shock roll is made per unit in this step.',
          tags: ['BATTLE-SHOCK', 'LEADERSHIP']
        },
        {
          id: 'cmd-shock-roll', title: 'Battle-shock roll',
          text: 'Roll 2D6: if the result is equal to or greater than one or more of the Ld characteristics in that unit, the roll succeeds. A roll that is "automatically successful" is not rolled. If a unit was battle-shocked at the start of the step and its roll succeeds, it is no longer battle-shocked; if the roll fails, the unit and each model in it is battle-shocked.',
          tags: ['BATTLE-SHOCK', 'LEADERSHIP']
        },
        {
          id: 'cmd-shock-effect', title: 'Effects of being battle-shocked',
          text: 'While a unit is battle-shocked: the OC characteristic of all its models is modified to "–" (it cannot control objectives), its controlling player cannot target it with stratagems, it is not eligible to start an action and any action it has started cannot be completed. When falling back it must use the Desperate Escape mode. The condition ends when a battle-shock roll for the unit succeeds.',
          tags: ['BATTLE-SHOCK', 'OC', 'ACTIONS']
        },
        {
          id: 'cmd-half', title: 'Half-strength',
          text: 'Starting strength is the number of models at the start of the first battle round. Units of 2+ models: at half-strength if the remaining models are half the starting strength, below half-strength if fewer. Single-model units: at half-strength if the remaining wounds are half the W characteristic, below if fewer. If the W characteristic or starting strength cannot be evenly divided, the unit can only be below half-strength. An attached unit counts all its models, including the leader.',
          tags: ['BATTLE-SHOCK']
        },
        {
          id: 'cmd-insane', title: 'Insane Bravery (1 CP, once per battle)',
          text: 'Battle-shock step of your Command phase, just before you make a battle-shock roll for a friendly unit: that battle-shock roll is automatically successful. You cannot use this stratagem more than once per battle, and not on a unit that is already battle-shocked (you cannot target battle-shocked units with stratagems).',
          tags: ['STRATAGEM', 'BATTLE-SHOCK']
        },
        {
          id: 'cmd-abilities', title: 'Command Abilities and phase rules',
          text: 'Rules triggered "in your Command phase" (counting resources, selecting buffs, returning models) are resolved in the Command Abilities step, after the battle-shock step. If several rules trigger at the same time, the active player resolves their mandatory rules first, then their optional ones, then the opposing player in the same order.',
          tags: ['SEQUENCING']
        },
        {
          id: 'cmd-tactical', title: 'Tactical Secondary Missions',
          text: 'At the start of your Command phase, draw two Secondary Missions face-up; they are active for you (cards still held from earlier turns remain active). Once per battle, at the end of your Command phase, you can spend 1 CP to discard one of your active Secondary Mission cards and draw one new one. Fixed Missions are two cards chosen before the battle instead; they cannot be discarded and are active throughout the battle.',
          tags: ['MISSION', 'SECONDARY']
        },
        {
          id: 'cmd-score', title: 'Scoring at the end of the Command phase',
          text: 'Many Primary Missions score at the end of your Command phase (from the second battle round onwards; in the fifth battle round usually at the end of your turn instead). The scoring line on the tablet shows the exact timing. Primary Missions: up to 15 VP per battle round.',
          tags: ['MISSION', 'PRIMARY']
        },
        {
          id: 'cmd-reroll', title: 'Command Re-roll (1 CP)',
          text: 'Any phase, just after you make an Advance roll, Charge roll, Damage roll, Hazard roll, Hit roll, Save roll, Wound roll or a roll to determine the number of attacks for a friendly unit or model: re-roll that roll. If you rolled more than one dice together, select one of those dice to re-roll (excluding charge rolls, which you must re-roll in full). Battle-shock rolls are not in this list and cannot be re-rolled with it.',
          tags: ['STRATAGEM', 'RE-ROLL'], ed: 11
        }
      ]
    },

    // ───────────────────────── Movement phase ─────────────────────────
    movement: {
      title: 'Movement phase',
      order: [
        'Select a unit and a move type: Remain Stationary, Normal Move, Advance Move or Fall-back Move (or Disembark / Ingress Move).',
        'Move (M characteristic; Advance: + D6"); observe terrain by category, check coherency at the end of the move.',
        'Resolve embarking and disembark moves from TRANSPORTS (note the disembark mode).',
        'Every unit must be selected to move – units not selected remain stationary.',
        'Reinforcements: units in strategic reserves arrive with an Ingress Move (from battle round 2).',
        'Opponent: end of the phase → Fire Overwatch (1 CP) and Rapid Ingress (1 CP, not in round 1).'
      ],
      rules: [
        {
          id: 'mov-types', title: 'Move types',
          text: 'Each unit is selected to move once per phase: Remain Stationary (no models are moved), Normal Move (up to M"), Advance Move (roll one D6, up to M + result), Fall-back Move (up to M", only if the unit is engaged). Normal and Advance Moves require the unit to be unengaged; after any of these moves the unit must be unengaged. A unit cannot make more than one Normal Move in a phase.',
          tags: ['MOVEMENT']
        },
        {
          id: 'mov-advance', title: 'Advance Move',
          text: 'Before moving, make an advance roll (one D6) and add the result to the M characteristic. Until the end of the turn the unit is not eligible to declare a charge or start an action; it can only shoot using assault shooting, i.e. with [ASSAULT] weapons only.',
          tags: ['ADVANCE', 'ASSAULT']
        },
        {
          id: 'mov-fallback', title: 'Fall-back Move',
          text: 'Only engaged units. Select a mode: Ordered Retreat (only if the unit is not battle-shocked; no rolls) or Desperate Escape. After moving the unit must be unengaged and, until the end of the turn, is not eligible to shoot, declare a charge or start an action.',
          tags: ['FALL BACK', 'BATTLE-SHOCK'], ed: 11
        },
        {
          id: 'mov-desperate', title: 'Desperate Escape',
          text: 'Mandatory for battle-shocked units, otherwise optional. Make a hazard roll for each model in the unit (one D6: on a 1–2 the unit suffers 1 mortal wound, or 3 if every model is a MONSTER/VEHICLE). Each model that is moved can be moved through enemy models. After moving, if the unit is not battle-shocked, you must make a battle-shock roll for it.',
          tags: ['FALL BACK', 'HAZARD ROLL'], ed: 11
        },
        {
          id: 'mov-coherency', title: 'Coherency',
          text: 'Every model must be within 2" horizontally and 5" vertically of at least one other model in its unit, and within 9" horizontally and 5" vertically of every other model in that unit. Checked when setting up and at the end of any kind of move. In the End of Turn step, models are removed from units that are not in coherency until they are again; those models are destroyed (they do not trigger "when destroyed" rules).',
          tags: ['COHERENCY'], ed: 11
        },
        {
          id: 'mov-engagement', title: 'Engagement range',
          text: 'A model\'s engagement range is the area within 2" horizontally and 5" vertically of it. While a friendly model is within engagement range of one or more enemy models, those models and their units are engaged with each other; a unit with no engaged models is unengaged. Normal, Advance and Ingress Moves must end unengaged.',
          tags: ['ENGAGEMENT RANGE'], ed: 11
        },
        {
          id: 'mov-terrain', title: 'Moving through terrain',
          text: 'All models can move horizontally and vertically through exposed and light terrain features. Dense terrain features (buildings, ruins, armoured containers, woods): INFANTRY/BEASTS/SWARM/MOBILE models can move horizontally through them, INFANTRY/BEASTS/SWARM can move vertically through them; other models only where all sections their base moves through are 2" or less in height, otherwise they must ascend or descend vertically (within 1/2" of the feature, vertical distance counts) and cannot end the move above ground level. Only INFANTRY/BEASTS/SWARM/FLY/MONSTER models can be set up or end a move on a surface above ground level, and only if stable with no part of the base overhanging the outer edge.',
          tags: ['TERRAIN', 'INFANTRY', 'MOBILE'], ed: 11
        },
        {
          id: 'mov-solid', title: 'Solid: no models inside',
          text: 'Dense terrain features have the Solid rule: a model cannot end a move such that any part of it is through any enclosed part of that terrain feature that is 3" or less from ground level – not even through small openings such as doors and windows. Moving through walls is allowed, ending the move inside them is not. Some missions may adjust the height.',
          tags: ['TERRAIN'], ed: 11
        },
        {
          id: 'mov-fly', title: 'FLY: taking to the skies',
          text: 'Each time a FLYING unit is selected to make a normal, advance, fall-back or charge move, before moving any models the active player can declare that it will take to the skies. If so: subtract 2" from the maximum distance; each FLYING model ignores all vertical distance, can move through all types of model (including enemy and MONSTER/VEHICLE models) and horizontally and vertically through all categories of terrain feature. HOVER: do not subtract the 2".',
          tags: ['FLY', 'HOVER'], ed: 11
        },
        {
          id: 'mov-monster', title: 'Moving MONSTERS and VEHICLES',
          text: 'Each time a unit makes a normal or advance move, MONSTER/VEHICLE models in it can be moved through friendly and enemy models (excluding other MONSTER/VEHICLE models). Dense terrain features can only be moved through horizontally where they are 2" or less in height; SUPER-HEAVY WALKER units up to 4" (and can gain MOBILE for a move at the risk of battle-shock on a 1).',
          tags: ['MONSTER', 'VEHICLE'], ed: 11
        },
        {
          id: 'mov-reserves', title: 'Reinforcements: Ingress Move',
          text: 'In the Move Units step you can select units in strategic reserves to make an ingress move: set up wholly within 6" of one or more battlefield edges and more than 8" horizontally from all enemy units. Before the third battle round no models can be set up within your opponent\'s deployment zone. Ingress moves are only possible from the second battle round onwards. After an ingress move, unless otherwise stated, the unit is not eligible to make any other type of move until the start of the next Charge phase.',
          tags: ['RESERVES', 'INGRESS'], ed: 11
        },
        {
          id: 'mov-deepstrike', title: 'Deep Strike during an ingress move',
          text: 'Each time a unit makes an ingress move, if every model in it has Deep Strike, it can be set up anywhere on the battlefield that is more than 8" horizontally from all enemy units, even if that is within your opponent\'s deployment zone. Again only from the second battle round onwards.',
          tags: ['DEEP STRIKE', 'RESERVES'], ed: 11
        },
        {
          id: 'mov-reserves-end', title: 'Reserves that do not arrive',
          text: 'At the end of the third battle round, all strategic reserves units that have not made one or more ingress moves are destroyed – except units embarked within TRANSPORTS that have made an ingress move during the battle, and repositioned units. At the end of the final turn, units still in strategic reserves are destroyed (without triggering "when destroyed" rules). Before the battle, at most 50% of your points limit can be placed in strategic reserves.',
          tags: ['RESERVES'], ed: 11
        },
        {
          id: 'mov-embark', title: 'Embarking',
          text: 'Once the first battle round has started, a unit can embark within a friendly TRANSPORT after making a normal, advance or fall-back move if each of its models is within 3" of that TRANSPORT, the unit was not set up on the battlefield this turn, it is eligible to embark within that TRANSPORT and the TRANSPORT has sufficient remaining capacity. The unit is removed from the battlefield and is not on the battlefield.',
          tags: ['TRANSPORT']
        },
        {
          id: 'mov-disembark', title: 'Disembarking: three modes',
          text: 'A unit can disembark in your Movement phase if it did not embark this phase and the TRANSPORT has not made an advance or fall-back move this phase. Rapid Disembark (TRANSPORT made a normal or ingress move this phase): set up wholly within 3", not eligible to declare a charge this turn. Tactical Disembark (TRANSPORT remained stationary or has not yet been selected to move): within 3", then the unit is selected to make a normal or advance move. Combat Disembark (otherwise): within 6", hazard roll for each model, models can be set up engaged with enemy units the TRANSPORT is engaged with, the unit is battle-shocked and cannot declare a charge this turn.',
          tags: ['TRANSPORT'], ed: 11
        },
        {
          id: 'mov-aircraft', title: 'AIRCRAFT',
          text: 'All AIRCRAFT units must be placed in strategic reserves before the battle and are only eligible to make ingress moves. At the end of your opponent\'s turn, all your AIRCRAFT units on the battlefield must be placed in strategic reserves. Other units can move through AIRCRAFT models; AIRCRAFT cannot declare a charge, only FLYING units can charge them, and only FLYING models can make melee attacks against them.',
          tags: ['AIRCRAFT'], ed: 11
        },
        {
          id: 'mov-overwatch', title: 'Opponent: Fire Overwatch (1 CP)',
          text: 'At the end of your Movement phase, your opponent can select one of their unengaged units (excluding TITANIC units) to shoot using snap shooting: only one visible enemy unit within 24" can be targeted, each attack only hits on an unmodified hit roll of 6 (those hits are not critical hits), hit rolls cannot be re-rolled, and the unit cannot start an action until the end of the phase.',
          tags: ['STRATAGEM', 'SNAP SHOOTING'], ed: 11
        }
      ]
    },

    // ───────────────────────── Shooting phase ─────────────────────────
    shooting: {
      title: 'Shooting phase',
      order: [
        'Start actions (mission actions; a unit that starts an action is not eligible to shoot, excluding TITANIC units).',
        'Select an eligible unit and a shooting type: Normal, Assault, Close-quarters or Indirect shooting.',
        'Select targets for each weapon: visible, within range, unengaged (except close-quarters shooting).',
        'Hit roll → wound roll → save roll (opponent) → inflict damage.',
        '[HAZARDOUS] weapons: after the attacks, one hazard roll per selected weapon.',
        'Select the next unit until all units you want to shoot with have shot.'
      ],
      rules: [
        {
          id: 'sho-eligible', title: 'Shooting types',
          text: 'Normal shooting: unengaged and did not advance this turn. Assault shooting: unengaged, advanced this turn, only [ASSAULT] weapons. Close-quarters shooting: engaged and did not advance; non-MONSTER/VEHICLE models can only use [CLOSE-QUARTERS] weapons against enemy units engaged with their unit (MONSTER/VEHICLE see below). Indirect shooting: unengaged, did not advance, has [INDIRECT FIRE] weapons. Units that fell back and units that started an action (excluding TITANIC) are not eligible to shoot. After shooting, a unit cannot start an action until the end of the phase.',
          tags: ['SHOOTING', 'ASSAULT', 'CLOSE-QUARTERS'], ed: 11
        },
        {
          id: 'sho-target', title: 'Selecting targets',
          text: 'Each weapon can have its own target; all targets are selected before any attacks are resolved. Unless otherwise stated, each target must be visible to the model with that weapon, within range of that weapon and unengaged. Distances are measured to and from the closest part of a model\'s base; "within X" means any distance that is not more than X.',
          tags: ['TARGETING']
        },
        {
          id: 'sho-los', title: 'Visibility and line of sight',
          text: 'Line of sight is a straight line from any part of the observing model to any part of the observed model; other models in both units are ignored. A unit is visible if one or more of its models are visible; it is fully visible only if every model is fully visible. Obscuring: if every line of sight between two models crosses a terrain area containing light or dense terrain (excluding one that either model is within), they are not visible to each other. Solid: line of sight cannot be drawn across any enclosed gap in a dense terrain feature that is 3" or less from ground level.',
          tags: ['LINE OF SIGHT', 'TERRAIN'], ed: 11
        },
        {
          id: 'sho-hidden', title: 'Hidden: not visible beyond 15"',
          text: 'An INFANTRY/BEASTS/SWARM model is hidden while it is within a terrain area containing one or more light/dense terrain features and its unit did not make ranged attacks this turn or the previous turn (during the first turn, the previous turn counts as fulfilled). A hidden model can only be visible to enemy models within its detection range, which is 15" unless otherwise stated. Gone to Ground: a hidden model that is not fully visible to the attacking model due to intervening dense terrain features subtracts 3" from its detection range (12").',
          tags: ['HIDDEN', 'INFANTRY', 'TERRAIN'], ed: 11
        },
        {
          id: 'sho-cover', title: 'Benefit of cover',
          text: 'A unit has the benefit of cover against a ranged attack if every model in it either has the INFANTRY/BEASTS/SWARM keyword and is within a terrain area, or is not fully visible to the attacking model due to intervening terrain features and/or obscuring terrain areas. Effect: worsen the BS characteristic of that attack by 1. [IGNORES COVER] removes it; STEALTH grants it against every ranged attack.',
          tags: ['COVER', 'TERRAIN'], ed: 11
        },
        {
          id: 'sho-plunging', title: 'Plunging Fire',
          text: 'Each time a model makes a ranged attack that targets a visible unit containing one or more models on ground level, improve the BS characteristic of that attack by 1 if the attacking model is on a section of a terrain feature that is 3" or more in height, or if it has the TOWERING keyword and the target unit is within 12". Has no effect on attacks made by or targeting AIRCRAFT.',
          tags: ['TERRAIN', 'TOWERING'], ed: 11
        },
        {
          id: 'sho-monster', title: 'MONSTERS/VEHICLES shooting while engaged',
          text: 'Engaged MONSTER/VEHICLE units can use close-quarters shooting with all their weapons, but subtract 1 from the hit roll unless the attack is made with a [CLOSE-QUARTERS] weapon and targets a unit they are engaged with; [BLAST] weapons still cannot target a unit they are engaged with. Engaged enemy MONSTER/VEHICLE units can be targeted by ranged attacks (excluding [BLAST] weapons) with -1 to the hit roll, except for [CLOSE-QUARTERS] weapons of a unit engaged with the target.',
          tags: ['MONSTER', 'VEHICLE', 'BLAST'], ed: 11
        },
        {
          id: 'sho-indirect', title: 'Indirect shooting',
          text: '[INDIRECT FIRE] weapons can target units that are not visible to the attacking model. Each time such a weapon makes an attack: the target has the benefit of cover, hit rolls cannot be re-rolled, and an unmodified hit roll of 1–5 fails – unless the unit remained stationary this turn and the target is visible to one or more friendly units, in which case an unmodified hit roll of 1–3 fails instead.',
          tags: ['INDIRECT FIRE'], ed: 11
        },
        {
          id: 'sho-hit', title: 'Hit roll',
          text: 'One D6 per attack dice: a result equal to or greater than the attack\'s BS/WS is a hit. An unmodified 1 always fails, an unmodified 6 is a critical hit (triggers [LETHAL HITS], [SUSTAINED HITS]). [TORRENT] attacks hit automatically (no critical hit). Hit rolls and wound rolls can never be modified by more than +1 or -1 in total.',
          tags: ['HIT ROLL', 'MODIFIERS']
        },
        {
          id: 'sho-wound', title: 'Wound roll',
          text: 'Compare the attack\'s Strength (S) with the target\'s Toughness (T): S twice T or more → 2+; S greater than T → 3+; S equal to T → 4+; S less than T → 5+; S half of T or less → 6+. An unmodified 1 always fails, an unmodified 6 is a critical wound ([DEVASTATING WOUNDS], [ANTI-X Y+]). Against an attached unit, use the highest T characteristic of its bodyguard models.',
          tags: ['WOUND ROLL']
        },
        {
          id: 'sho-allocate', title: 'Allocation and save rolls',
          text: 'The opposing player creates groups (one for each CHARACTER model, one for all other models with the same W, Sv and InSv) and declares the allocation order: a non-CHARACTER group with a wounded model must be first; no CHARACTER group can be earlier than a non-CHARACTER group (unless [PRECISION]); wounded CHARACTER groups before unwounded ones. One save roll per wounding attack, resolved from lowest to highest: an unmodified 1 always inflicts damage; a result (not modified by AP) equal to or greater than the InSv fails the attack; otherwise, modified by the weapon\'s AP, a result equal to or greater than the Sv fails the attack; anything else inflicts damage.',
          tags: ['SAVE', 'CHARACTER', 'INVULNERABLE']
        },
        {
          id: 'sho-damage', title: 'Damage',
          text: 'Each attack that inflicts damage makes the selected model (a wounded model in the current allocation group if possible) lose a number of wounds equal to the attack\'s D characteristic; at 0 or fewer wounds it is destroyed, any excess is lost. Feel No Pain X+: each time a model would lose a wound, roll one D6; on an X+ that wound is not lost (rolled in the Resolve Damage step). Normal damage from attack dice is resolved before mortal wounds from the same attacks.',
          tags: ['DAMAGE', 'FEEL NO PAIN']
        },
        {
          id: 'sho-mortal', title: 'Mortal wounds',
          text: 'Each mortal wound makes one model lose 1 wound with no save roll (Feel No Pain can be used). Model selection in order: a wounded non-CHARACTER model, then any non-CHARACTER model, then a wounded CHARACTER, then any CHARACTER. [DEVASTATING WOUNDS]: on a critical wound the attack sequence ends and the target suffers mortal wounds equal to the weapon\'s D; each critical wound can damage a maximum of one model, remaining mortal wounds are lost.',
          tags: ['MORTAL WOUNDS', 'DEVASTATING WOUNDS'], ed: 11
        },
        {
          id: 'sho-blast', title: 'Blast and Rapid Fire',
          text: '[BLAST]: add one additional attack dice for every five models in the target unit (rounding down, as counted in the Select Targets step); [BLAST X] adds X per five models instead. [BLAST] weapons cannot target units engaged with the attacking unit. [RAPID FIRE X]: add X additional attack dice if the target was within half range. [MELTA X]: add X to the weapon\'s D characteristic if the target was within half range.',
          tags: ['BLAST', 'RAPID FIRE', 'MELTA']
        },
        {
          id: 'sho-hazard', title: 'Hazardous',
          text: 'After a unit selected to shoot or fight has resolved all of its attacks, make one hazard roll for each [HAZARDOUS] weapon selected in the Select Weapons step: roll one D6, on a 1–2 the unit suffers 1 mortal wound (3 mortal wounds instead if each model in the unit is a MONSTER/VEHICLE model). Several hazard rolls are made simultaneously.',
          tags: ['HAZARDOUS', 'HAZARD ROLL'], ed: 11
        },
        {
          id: 'sho-lone', title: 'Lone Operative',
          text: 'Unless part of an attached unit, a Lone Operative unit is not visible to enemy models unless they are within 12", and cannot be targeted by [INDIRECT FIRE] weapons unless the attacking model is within 12" (Lone Operative X": X" instead). If an attached unit below starting strength only contains Lone Operative models, the ability becomes active again. Detection range and Lone Operative cannot be better than 9" or worse than 30".',
          tags: ['LONE OPERATIVE', 'CHARACTER']
        },
        {
          id: 'sho-explosives', title: 'Explosives (1 CP)',
          text: 'Your Shooting phase: one friendly unengaged EXPLOSIVES/GRENADES unit that is eligible to shoot and did not advance this turn. Select one EXPLOSIVES/GRENADES model in it, then one unengaged enemy unit within 8" of and visible to that model. Roll six D6: for each 4+, that enemy unit suffers 1 mortal wound.',
          tags: ['STRATAGEM', 'EXPLOSIVES'], ed: 11
        },
        {
          id: 'sho-smoke', title: 'Opponent: Smokescreen (1 CP)',
          text: 'Start of your Shooting phase: your opponent selects one of their SMOKE units. Until the end of the phase, each time an attack targets that SMOKE unit, or a unit that is not fully visible to the attacking model because of models in that SMOKE unit, the target has the benefit of cover against that attack.',
          tags: ['STRATAGEM', 'SMOKE'], ed: 11
        },
        {
          id: 'sho-actions', title: 'Actions',
          text: 'Actions are usually started in the Shooting phase. A unit cannot start an action if it is not on the battlefield, is an AIRCRAFT/FORTIFICATION unit, is battle-shocked, has an OC of 0 or "–", is engaged (unless TITANIC), made an advance or fall-back move this turn, or started another action this turn. After starting an action, until the end of the turn the unit is not eligible to shoot (excluding TITANIC units) or declare a charge; if it makes a move (excluding pile-in and consolidation moves) or leaves the battlefield, it does not complete the action.',
          tags: ['ACTIONS', 'MISSION'], ed: 11
        }
      ]
    },

    // ───────────────────────── Charge phase ─────────────────────────
    charge: {
      title: 'Charge phase',
      order: [
        'Select an eligible unit (unengaged, did not advance or fall back, enemy unit within 12") – it declares a charge.',
        'Make the charge roll: 2D6 = maximum distance (modifiers possible, never more than 12).',
        'Select charge targets: enemy units within 12" and within the maximum distance.',
        'Charge move: must end engaged with all charge targets and with no other enemy unit.',
        'Successful charge → the unit has Fights First until the end of the turn. MONSTER/VEHICLE: Crushing Impact (1 CP).',
        'Opponent: end of the phase → Heroic Intervention (1 CP).'
      ],
      rules: [
        {
          id: 'chg-eligible', title: 'Who can declare a charge?',
          text: 'A unit is eligible to declare a charge if it is on the battlefield, unless otherwise stated. It is not eligible if it is not within 12" of one or more enemy units, is engaged, made an advance or fall-back move this turn, or started an action this turn. AIRCRAFT never declare charges; after a rapid or combat disembark the unit cannot declare a charge this turn.',
          tags: ['CHARGE']
        },
        {
          id: 'chg-declare', title: 'Declaring a charge and selecting targets',
          text: 'Select one unit that has not declared a charge this phase; it declares a charge. Make the charge roll first, then (before moving) select one or more enemy units within 12" of your unit and within the maximum distance as charge targets. With several targets the charge move must end engaged with every one of them – otherwise the charge fails.',
          tags: ['CHARGE']
        },
        {
          id: 'chg-roll', title: 'Charge roll',
          text: 'Roll 2D6: the result is the maximum distance each model can move. Modifiers can increase the result, but a charge roll can never be greater than 12. Since engagement range is 2" and a charging unit cannot be engaged when it declares, a roll of 2 (double 1) without modifiers is never sufficient. Command Re-roll re-rolls both dice.',
          tags: ['CHARGE ROLL', 'MODIFIERS'], ed: 11
        },
        {
          id: 'chg-move', title: 'Charge move',
          text: 'Each model must end its move closer to one or more charge targets; each model that can end its move within 1" of a charge target must do so; each model that can end engaged with a charge target must do so. The unit must end engaged with all charge targets and cannot be engaged with any enemy unit that is not a charge target. Coherency applies. If this is not possible, the unit does not move (failed charge).',
          tags: ['CHARGE', 'ENGAGEMENT RANGE'], ed: 11
        },
        {
          id: 'chg-terrain', title: 'Terrain during a charge',
          text: 'The normal terrain rules apply to charge moves: dense terrain can only be moved through horizontally by INFANTRY/BEASTS/SWARM/MOBILE models, vertical distance counts, FLYING units can take to the skies (-2"). A charge can therefore fail because of a detour even if the straight-line distance would suffice.',
          tags: ['CHARGE', 'TERRAIN']
        },
        {
          id: 'chg-fightsfirst', title: 'Fights First from charging',
          text: 'After a charge move, each model in the unit has the Fights First ability until the end of the turn. The unit fights in the Resolve Fights First Combats step of the Fight phase – alternating with enemy Fights First units, starting with the player whose turn it is.',
          tags: ['FIGHTS FIRST', 'CHARGE']
        },
        {
          id: 'chg-fail', title: 'Failed charge',
          text: 'If the charge move is not possible or you choose not to make it, the unit does not move. It has not made a charge move, gains no Fights First and cannot declare another charge this phase.',
          tags: ['CHARGE']
        },
        {
          id: 'chg-crushing', title: 'Crushing Impact (1 CP)',
          text: 'Your Charge phase, just after a friendly MONSTER/VEHICLE unit ends a charge move: select one enemy unit engaged with your unit, then one model in your unit engaged with that enemy unit. Roll a number of D6 equal to that model\'s T characteristic: for each 1, your unit suffers 1 mortal wound; for each 5+, that enemy unit suffers 1 mortal wound (to a maximum of 6 mortal wounds per unit).',
          tags: ['STRATAGEM', 'MONSTER', 'VEHICLE'], ed: 11
        },
        {
          id: 'chg-heroic', title: 'Opponent: Heroic Intervention (1 CP)',
          text: 'End of your Charge phase: your opponent selects one of their unengaged units within 12" of one or more of your units (a VEHICLE only if it is a CHARACTER/WALKER unit) and resolves a charge with it. Before the charge roll they select a mode: Leap to Defend – only enemy units that made a charge move this phase can be charge targets. Into the Fray (+1 CP) – a charge roll greater than 6 (after modifiers) is changed to 6, and any enemy units within 6" and within the maximum distance can be charge targets.',
          tags: ['STRATAGEM', 'HEROIC INTERVENTION'], ed: 11
        },
        {
          id: 'chg-surge', title: 'Surge move',
          text: 'Some rules allow a unit to make a surge move out of sequence. Eligible if the rule has been triggered, the unit is not battle-shocked, is unengaged and has not moved this phase. The closest enemy unit is the surge target; each model must end engaged with it if possible, otherwise as close as possible to it. The unit cannot end engaged with other enemy units and cannot move again this phase.',
          tags: ['SURGE'], ed: 11
        }
      ]
    },

    // ───────────────────────── Fight phase ─────────────────────────
    fight: {
      title: 'Fight phase',
      order: [
        'Pile in (up to 3"): both players, the player whose turn it is first.',
        'Resolve Fights First Combats: alternate selecting Fights First units (player whose turn it is first).',
        'Resolve Remaining Combats: alternate selecting all other eligible units.',
        'Each unit: select weapons, select targets, resolve attacks (hit → wound → save → damage).',
        'Consolidate (up to 3"): player whose turn it is first; mode Ongoing, Engaging or Objective.',
        'The phase ends when all eligible units have fought or both players pass.'
      ],
      rules: [
        {
          id: 'fgt-eligible', title: 'Who fights?',
          text: 'A unit is eligible to fight if it has not already been selected to fight this phase and is engaged (or was engaged at the start of the Fight step) or made a charge move this turn. Units that become engaged during the phase (e.g. through an enemy engaging consolidation) also become eligible. You must fight with all units that can; a player whose eligible units are all more than 5" from every enemy unit can pass instead.',
          tags: ['FIGHT'], ed: 11
        },
        {
          id: 'fgt-pilein', title: 'Pile-in move',
          text: 'In the Pile In step, each unit that is engaged, made a charge move this turn or was selected for an overrun fight can make one pile-in move of up to 3"; the player whose turn it is moves first. Pile-in targets: every enemy unit the unit is engaged with, otherwise one or more enemy units within 5". Models in base contact with enemy models cannot be moved; each moved model must end closer to the closest pile-in target and engaged with it if possible. The unit must be engaged afterwards, and each model that started engaged with an enemy unit must still be engaged with it.',
          tags: ['PILE IN'], ed: 11
        },
        {
          id: 'fgt-order', title: 'Order: Fights First, then the rest',
          text: 'Starting with the player whose turn it is, players alternate selecting one Fights First unit that is eligible to fight (units that charged this turn and units with the ability). When a player cannot, the other player continues; when no Fights First units remain, the Resolve Remaining Combats step starts with the player who moved the sequence on, alternating through all other eligible units. If a Fights First unit becomes eligible in the meantime, the sequence returns to the Fights First step.',
          tags: ['FIGHTS FIRST', 'SEQUENCING'], ed: 11
        },
        {
          id: 'fgt-targets', title: 'Targets in melee',
          text: 'Each model must select one melee weapon (plus all of its [EXTRA ATTACKS] weapons). For each weapon, select one or more enemy units engaged with that model as targets, never more targets than the weapon\'s A characteristic; with several targets, split the attacks and declare at least one attack per target before rolling.',
          tags: ['FIGHT', 'ENGAGEMENT RANGE']
        },
        {
          id: 'fgt-attack', title: 'Resolving attacks',
          text: 'As with shooting: hit roll against WS, wound roll S against T, save roll with AP (or invulnerable save), damage. An unmodified 6 is a critical hit/wound. [LANCE]: add 1 to the wound roll if the attacking model\'s unit made a charge move this turn. The +1/-1 modifier limit for hit and wound rolls applies here too.',
          tags: ['HIT ROLL', 'WOUND ROLL', 'LANCE']
        },
        {
          id: 'fgt-remove', title: 'Removing models',
          text: 'A destroyed model is removed at once; but if a "when destroyed" rule (e.g. Deadly Demise) applies to a model destroyed by an attack, that rule is resolved and the model removed only after the attacking unit\'s attacks have been resolved. Fight On Death: models with such a rule stay on the battlefield until their unit has attacked or until the end of the phase. A unit that lost models still fights when it is selected.',
          tags: ['DESTROYED', 'DEADLY DEMISE']
        },
        {
          id: 'fgt-consolidate', title: 'Consolidation move',
          text: 'In the Consolidate step, each unit that was eligible to fight this phase can make one consolidation move of up to 3" (player whose turn it is first). Ongoing Consolidation (engaged units, mandatory): models in base contact do not move, each moved model ends closer to the closest selected enemy unit and still engaged with the units it was engaged with. Engaging Consolidation (unengaged, enemy within 3"): must end engaged with the selected enemy units; those not yet selected to fight become eligible and are selected to fight by your opponent. Objective Consolidation (otherwise, objective within 3"): end within range of that objective, unengaged.',
          tags: ['CONSOLIDATE'], ed: 11
        },
        {
          id: 'fgt-overrun', title: 'Overrun fight',
          text: 'When a unit is selected to fight, it selects a fight type: Normal Fight (if engaged) or Overrun Fight (if it is unengaged, or was unengaged at the start of the Fight step but became engaged during the phase – e.g. a charging unit whose target was destroyed). An overrun fight lets the unit make one additional pile-in move (targets: every enemy unit it is engaged with, otherwise enemy units within 5") and then fight; enemy units that become engaged by it are eligible to fight this phase.',
          tags: ['FIGHT'], ed: 11
        },
        {
          id: 'fgt-epic', title: 'Epic Challenge (1 CP)',
          text: 'Fight phase, just after a friendly CHARACTER unit is selected to fight: select one CHARACTER model in it. Until the end of the phase, that model\'s melee weapons have the [PRECISION] ability. Can be used in either player\'s turn.',
          tags: ['STRATAGEM', 'CHARACTER', 'PRECISION']
        },
        {
          id: 'fgt-counter', title: 'Opponent: Counteroffensive (2 CP)',
          text: 'Fight step of your Fight phase, just after one of your units has resolved its attacks: your opponent selects one of their units that is eligible to fight. Until the end of the phase it has the Fights First ability and must be the next unit they select to fight.',
          tags: ['STRATAGEM', 'FIGHTS FIRST']
        },
        {
          id: 'fgt-end', title: 'End of the phase',
          text: 'The Fight step ends when no units are eligible to fight, when both players pass in succession, or when one player passes and their opponent has no remaining eligible units. Effects given in this phase without a stated duration end with the phase.',
          tags: ['FIGHT']
        }
      ]
    },

    // ───────────────────────── End of turn ─────────────────────────
    end: {
      title: 'End of turn',
      order: [
        'Determine which objectives are controlled by which player (OC comparison, secured objectives).',
        'Resolve rules triggered "at the end of your turn" (non-mission rules first).',
        'Check coherency: remove models from units that are out of coherency.',
        'Opponent\'s AIRCRAFT return to strategic reserves.',
        'Mission scoring: the active player first, then the opponent; complete actions.',
        'Tactical cards: discard achieved cards; discard further cards = +1 CP.',
        'Second turn of the round finished? → end of battle round, next battle round; after round 5 the battle ends.'
      ],
      rules: [
        {
          id: 'end-sequence', title: 'Order at the end of the turn',
          text: 'At the end of each phase and turn, the first thing players do is determine which objectives are controlled by which player. Then rules triggered at the end of the turn other than mission rules (active player mandatory → active player optional → opponent mandatory → opponent optional), then both players consult their mission and resolve any aspects that are triggered at this point.',
          tags: ['SEQUENCING', 'MISSION'], ed: 11
        },
        {
          id: 'end-coherency', title: 'Coherency check',
          text: 'In the End of Turn step, if units on the battlefield are not in coherency (2"/9" horizontally, 5" vertically), their controlling players must remove models one at a time until they are. Models removed in this way are destroyed – they count for mission objectives, but do not trigger "when destroyed" rules.',
          tags: ['COHERENCY'], ed: 11
        },
        {
          id: 'end-objectives', title: 'Controlling objectives',
          text: 'At the end of each phase and turn, for each objective add together the OC characteristics of all models in each army within range of it (within 3" horizontally and 5" vertically of an objective marker; for terrain objectives: within the terrain area). The player with the highest level of control controls the objective; if tied, nobody does (unless the objective is secured). Battle-shocked models have OC "–".',
          tags: ['OC', 'OBJECTIVES'], ed: 11
        },
        {
          id: 'end-scoring', title: 'Mission scoring',
          text: 'At the end of each player\'s turn, each player scores, starting with the player whose turn it is: "end of your turn" conditions for the active player, "end of your opponent\'s turn" / "end of a turn" conditions for the other. Limits: Primary Missions 45 VP (up to 15 VP per battle round), Secondary Missions 45 VP (up to 15 VP per battle round, and up to 20 VP per Fixed Secondary Mission card); plus 10 VP for a Battle Ready army – 100 VP in total.',
          tags: ['MISSION', 'VP']
        },
        {
          id: 'end-actions', title: 'Completing actions',
          text: 'Many actions complete at the end of your turn (e.g. "if your unit controls that objective"). A unit does not complete its action if it made a move (excluding pile-in and consolidation moves) or left the battlefield after starting it; a battle-shocked unit cannot complete an action. When an action is completed, its Effect is triggered.',
          tags: ['ACTIONS', 'MISSION'], ed: 11
        },
        {
          id: 'end-tactical', title: 'Tactical cards',
          text: 'At the end of each player\'s turn, if you met the conditions of one or more Secondary Missions you gain the VP; with Tactical Missions, that card is then discarded (achieved). Then, if it is your turn and you use Tactical Missions, you can discard one or more of your active Secondary Missions; if you do, you gain 1 CP. Cards not discarded stay active.',
          tags: ['MISSION', 'SECONDARY', 'CP']
        },
        {
          id: 'end-aircraft', title: 'AIRCRAFT return to reserves',
          text: 'At the end of your opponent\'s turn, all AIRCRAFT units in your army that are on the battlefield must be placed in strategic reserves. They return in your next turn with an ingress move.',
          tags: ['AIRCRAFT', 'RESERVES'], ed: 11
        },
        {
          id: 'end-effects', title: 'Effects expire',
          text: 'Effects "until the end of the turn" (Fights First from charging, advance / fall-back restrictions, charge bans after disembarking) end now. A rule or effect given without a stated duration is only active for the phase in which it was given.',
          tags: ['SEQUENCING']
        },
        {
          id: 'end-round', title: 'End of the battle round and the battle',
          text: 'After the second player\'s turn the battle round ends: first rules triggered at the end of the battle round other than mission rules, then mission rules. At the end of the third battle round, strategic reserves units that have not arrived are destroyed. A battle usually lasts five battle rounds; then the end-of-battle scoring follows (not subject to the 15 VP per round limit).',
          tags: ['BATTLE ROUND', 'RESERVES'], ed: 11
        }
      ]
    }
  },

  // ───────────────────────── Start of turn / battle round ─────────────────────────
  turnStart: [
    {
      id: 'ts-round', title: 'Start of the battle round',
      text: 'Count up the battle round (1–5). Rules triggered at the start of the battle round are resolved before the first player starts their turn. The same player always takes the first turn in each battle round.'
    },
    {
      id: 'ts-turn', title: 'Start of Turn step',
      text: 'All rules triggered at the start of your turn are resolved now – before the Command phase (e.g. mission rules such as Punishment or Burden of Trust, army rules that select a state).'
    },
    {
      id: 'ts-phases', title: 'Structure of a turn',
      text: 'Each turn consists of seven parts: the Start of Turn step, the Command, Movement, Shooting, Charge and Fight phases, then the End of Turn step. Rules "at the start of the phase" trigger in every phase of that type – "your phase" only in your turn, "the phase" in both players\' turns.'
    },
    {
      id: 'ts-first', title: 'First battle round',
      text: 'In the first battle round no reinforcements arrive with ingress moves (Rapid Ingress is not allowed either), and for the Hidden rule the previous turn counts as "no ranged attacks made". Units can embark once the first battle round has started. Primary Missions already score in the first battle round; only their conditions scored at the end of your Command phase start in the second battle round (the scoring line on the tablet shows the rounds of each condition).'
    },
    {
      id: 'ts-resources', title: 'Resources and counters',
      text: 'Army resources (Yield Points, Waaagh!, Miracle Dice …) often change at the start of the turn or in the Command phase – the army card at the top shows the exact timing.'
    }
  ],

  // ───────────────────────── Reference ─────────────────────────
  general: [
    {
      id: 'gen-oc', title: 'Objective Control (OC)',
      text: 'Each model has an OC characteristic. For each objective, all models within 3" horizontally and 5" vertically (terrain objective: within the terrain area) count. The player with the highest total controls it; if tied, nobody does. The same model\'s OC can count towards more than one objective. Battle-shocked models have OC "–". A unit with one or more models with OC 1+ within range of an objective you control is controlling it.',
      tags: ['OC', 'OBJECTIVES'], ed: 11
    },
    {
      id: 'gen-secured', title: 'Secured objectives',
      text: 'When an objective is secured by your army (by a mission or rule), it remains under your control – even once you no longer have any units within range of it – until your opponent\'s level of control over it is greater than yours at the end of a phase.',
      tags: ['OBJECTIVES'], ed: 11
    },
    {
      id: 'gen-shock', title: 'Battle-shock',
      text: 'Battle-shock roll in the Battle-shock step of your Command phase for units at or below half-strength or already battle-shocked: 2D6 equal to or greater than Ld = success. While battle-shocked: OC "–", cannot be targeted by your stratagems, cannot start or complete actions, only Desperate Escape when falling back. Other rules (Combat Disembark, Emergency Disembark, Desperate Escape) can also cause battle-shock or require a battle-shock roll; such a roll follows the same rules.',
      tags: ['BATTLE-SHOCK', 'LEADERSHIP']
    },
    {
      id: 'gen-leader', title: 'Leader and Support',
      text: 'Before the battle (Muster Armies), each leader and support unit can be attached to one friendly bodyguard unit it can lead; each bodyguard unit can have one leader unit and one support unit. Each support unit must be attached. An attached unit is a single unit for all rules purposes (starting strength = all models). Attacks against it use the highest T characteristic of the bodyguard models. "While leading" abilities apply to the whole unit.',
      tags: ['LEADER', 'SUPPORT', 'CHARACTER'], ed: 11
    },
    {
      id: 'gen-leader-dead', title: 'Bodyguard destroyed',
      text: 'If all bodyguard models are destroyed, the remaining leader/support models stay a single unit; leader units keep benefiting from their own "while leading" abilities. Rules triggered when a unit is destroyed only trigger when the last model that started the battle in the attached unit is destroyed. Lone Operative becomes active again. If the leader is destroyed, the unit loses its abilities (until it is revived).',
      tags: ['LEADER', 'CHARACTER'], ed: 11
    },
    {
      id: 'gen-precision', title: 'Precision against CHARACTERS',
      text: 'Normally no CHARACTER group in an attached unit can be earlier in the allocation order than a non-CHARACTER group. With [PRECISION], at the start of the Allocation Order step the attacker can select one allocation group containing a visible CHARACTER model; it is the current allocation group until those attacks are resolved or that group is destroyed.',
      tags: ['PRECISION', 'CHARACTER']
    },
    {
      id: 'gen-epic', title: 'EPIC HERO',
      text: 'Every EPIC HERO has a unit limit of 1, regardless of the battle size. EPIC HERO models cannot be given enhancements, but can form an attached unit with a unit that has one.',
      tags: ['EPIC HERO', 'CHARACTER']
    },
    {
      id: 'gen-transport', title: 'Transports',
      text: 'The transport capacity is listed on the datasheet; several units can embark if capacity allows. Embarked units are not on the battlefield: not visible, cannot be measured to, cannot be targeted – but battle-shock rolls must still be made for them. A friendly unit must be embarked within each DEDICATED TRANSPORT before the battle, otherwise it is destroyed at the end of the Declare Battle Formations step. Firing Deck X: up to X embarked models shoot with the TRANSPORT.',
      tags: ['TRANSPORT', 'FIRING DECK']
    },
    {
      id: 'gen-transport-dead', title: 'Transport destroyed',
      text: 'Emergency disembark move: make a hazard roll for each model, then set up each model wholly within 6" of the TRANSPORT and as close as possible to it, unengaged if possible (otherwise engaged); each model that cannot be set up is destroyed. The unit is battle-shocked and cannot declare a charge this turn. Only then is the TRANSPORT\'s Deadly Demise rolled.',
      tags: ['TRANSPORT', 'DEADLY DEMISE'], ed: 11
    },
    {
      id: 'gen-terrain-cat', title: 'Terrain categories',
      text: 'Dense: buildings, ruins, armoured containers, woods – obscuring, Solid, only INFANTRY/BEASTS/SWARM/MOBILE can move horizontally through them. Light: barricades, low walls, statuary – obscuring, all models can move through them. Exposed: craters, razorwire, scattered debris – can be traversed without hindrance. The category itself does not give the benefit of cover: a unit has it if every model is INFANTRY/BEASTS/SWARM within a terrain area (any category) or is not fully visible due to terrain. Terrain features 3" or more in height grant Plunging Fire.',
      tags: ['TERRAIN'], ed: 11
    },
    {
      id: 'gen-terrain-area', title: 'Terrain area',
      text: 'Each terrain feature is placed in a terrain area (a mat or base, a single feature, or a boundary defined by several features; the deployment map may define them, otherwise players agree before the battle). A model is within a terrain area as soon as any part of its base is within its boundary. Terrain areas are the reference for benefit of cover, Hidden, Obscuring and terrain objectives.',
      tags: ['TERRAIN'], ed: 11
    },
    {
      id: 'gen-obscuring', title: 'Obscuring and line of sight',
      text: 'Line of sight: from any part of the observing model to any part of the observed model. Terrain areas containing light or dense terrain features are obscuring terrain areas: if every line of sight between two models crosses one or more of them (excluding those either model is within), the models are not visible to each other. A model within the area can see out and be seen. Solid gaps up to 3" from ground level additionally block line of sight.',
      tags: ['LINE OF SIGHT', 'TERRAIN'], ed: 11
    },
    {
      id: 'gen-cover', title: 'Benefit of cover',
      text: 'A ranged attack against a unit has its BS worsened by 1 if every model in that unit is INFANTRY/BEASTS/SWARM within a terrain area, or is not fully visible to the attacking model due to intervening terrain features / obscuring terrain areas. [IGNORES COVER] removes it. STEALTH and Smokescreen grant it regardless of terrain. There is no benefit of cover against melee attacks.',
      tags: ['COVER'], ed: 11
    },
    {
      id: 'gen-hidden', title: 'Hidden and detection range',
      text: 'INFANTRY/BEASTS/SWARM models within a terrain area containing light or dense terrain features, whose unit made no ranged attacks this turn or the previous turn, are hidden: only visible to enemy models within their detection range (15"). Gone to Ground: additionally not fully visible due to intervening dense terrain → subtract 3" (12"). Detection range cannot be better than 9" or worse than 30".',
      tags: ['HIDDEN', 'TERRAIN'], ed: 11
    },
    {
      id: 'gen-plunging', title: 'Plunging Fire',
      text: 'Improve the BS of a ranged attack by 1 if it targets a visible unit containing models on ground level and the attacking model is on a section of a terrain feature 3" or more in height, or has the TOWERING keyword and the target is within 12". No effect on attacks made by or targeting AIRCRAFT.',
      tags: ['TERRAIN', 'TOWERING'], ed: 11
    },
    {
      id: 'gen-reserves', title: 'Strategic reserves',
      text: 'Before the battle (Declare Battle Formations), units with a combined points value of up to 50% of your points limit can be placed in strategic reserves (never FORTIFICATIONS; AIRCRAFT always). They arrive from battle round 2 with an ingress move: wholly within 6" of a battlefield edge, more than 8" horizontally from all enemy units, not within your opponent\'s deployment zone before round 3. Units that have not arrived are destroyed at the end of battle round 3.',
      tags: ['RESERVES', 'INGRESS'], ed: 11
    },
    {
      id: 'gen-deepstrike', title: 'Deep Strike',
      text: 'If every model in a unit has Deep Strike, each time it makes an ingress move it can be set up anywhere on the battlefield that is more than 8" horizontally from all enemy units – even within your opponent\'s deployment zone. Deep Strike units also arrive from battle round 2 at the earliest.',
      tags: ['DEEP STRIKE', 'RESERVES'], ed: 11
    },
    {
      id: 'gen-rapid', title: 'Rapid Ingress (1 CP)',
      text: 'End of your opponent\'s Movement phase: one friendly unit in strategic reserves (excluding AIRCRAFT) makes an ingress move – with all the usual restrictions. Cannot be used during the first battle round.',
      tags: ['STRATAGEM', 'RESERVES'], ed: 11
    },
    {
      id: 'gen-scouts', title: 'Scouts and Infiltrators',
      text: 'Scouts X": in the Resolve Pre-battle Abilities step, if every model has the ability, a unit wholly within your deployment zone can make a scout move of up to X" and must end more than 8" horizontally from all enemy units; alternatively a unit in strategic reserves can be set up wholly within your deployment zone. Infiltrators: during deployment, if every model has the ability, set up anywhere more than 8" horizontally from your opponent\'s deployment zone and all enemy units.',
      tags: ['SCOUTS', 'INFILTRATORS'], ed: 11
    },
    {
      id: 'gen-aircraft', title: 'AIRCRAFT',
      text: 'Always start in strategic reserves, only make ingress moves and must return to strategic reserves at the end of your opponent\'s turn. Other units can move through them; pile-in, consolidation and surge moves ignore them (unless the moving unit can FLY). They never declare charges, only make melee attacks against FLYING units, and only FLYING units can charge or fight them. Plunging Fire has no effect on or against them.',
      tags: ['AIRCRAFT'], ed: 11
    },
    {
      id: 'gen-fortification', title: 'FORTIFICATIONS',
      text: 'Fortifications are set up with the army, cannot be placed in strategic reserves and cannot start actions. Everything else is governed by the respective datasheet.',
      tags: ['FORTIFICATION']
    },
    {
      id: 'gen-lone', title: 'Lone Operative',
      text: 'Unless part of an attached unit, a Lone Operative unit is only visible to enemy models within 12" (Lone Operative X": X") and can only be targeted by [INDIRECT FIRE] weapons from within that distance. While the unit is part of an attached unit the rule does not apply. The range cannot be better than 9" or worse than 30".',
      tags: ['LONE OPERATIVE', 'CHARACTER']
    },
    {
      id: 'gen-monster', title: 'MONSTERS and VEHICLES',
      text: 'Move through other models during normal/advance moves (not through MONSTER/VEHICLE models). Can shoot while engaged (close-quarters shooting) with -1 to hit, except [CLOSE-QUARTERS] weapons against a unit they are engaged with; [BLAST] never against engaged targets. Shooting at an engaged MONSTER/VEHICLE: -1 to hit (except [CLOSE-QUARTERS] weapons of an engaged unit), no [BLAST]. Hazard rolls cost them 3 mortal wounds instead of 1. FRAME models without a base are measured to the closest point of the model.',
      tags: ['MONSTER', 'VEHICLE', 'FRAME'], ed: 11
    },
    {
      id: 'gen-wound-chart', title: 'Wound roll table',
      text: 'S twice T or more → 2+ · S greater than T → 3+ · S equal to T → 4+ · S less than T → 5+ · S half of T or less → 6+. An unmodified 1 always fails; an unmodified 6 is a critical wound. Weapons with no S characteristic count as S 1.',
      tags: ['WOUND ROLL']
    },
    {
      id: 'gen-dice', title: 'Dice, re-rolls and modifiers',
      text: 'The standard dice is the D6. Re-rolls: before modifiers, each dice only once, all dice of a multi-dice roll (2D6 etc.). Modifier order: set/replace → multiply → add → divide → subtract → round fractions up. Hit and wound rolls can never be modified by more than +1 or -1 in total, charge rolls cannot be greater than 12. A result that would be less than 1 is changed to 1. "Ignore modifiers" lets you ignore all or only some (e.g. only the detrimental) modifiers.',
      tags: ['DICE', 'RE-ROLL', 'MODIFIERS'], ed: 11
    },
    {
      id: 'gen-limits', title: 'Limits of modified characteristics',
      text: 'After all modifiers: Sv and InSv cannot be 1+ or better; WS/BS between 2+ and 6+; Ld between 5+ and 8+; AP cannot be worse than 0; M at least 1"; T, S, A, D at least 1; OC not less than 0 or "–"; range at least 1". Stratagem CP costs cannot be modified below 0 or increased by more than 1.',
      tags: ['MODIFIERS'], ed: 11
    },
    {
      id: 'gen-mortal', title: 'Mortal wounds',
      text: 'Each mortal wound makes one model lose 1 wound with no save roll; Feel No Pain can be used. Selection: wounded non-CHARACTER → other non-CHARACTER → wounded CHARACTER → other CHARACTER. Mortal wounds from an attack are resolved after its normal damage. [DEVASTATING WOUNDS]: a critical wound inflicts D mortal wounds instead of normal damage, damaging a maximum of one model per critical wound.',
      tags: ['MORTAL WOUNDS', 'DEVASTATING WOUNDS'], ed: 11
    },
    {
      id: 'gen-fnp', title: 'Feel No Pain',
      text: 'Feel No Pain X+: each time a model with this ability would lose a wound (including from mortal wounds), roll one D6; on an X+, that wound is not lost. Rolled in the Resolve Damage step, after save rolls.',
      tags: ['FEEL NO PAIN']
    },
    {
      id: 'gen-inv', title: 'Invulnerable save',
      text: 'When checking a save roll, if the models in the current allocation group have an InSv characteristic and the result is equal to or greater than it, the attack fails – AP is ignored (an unmodified 1 still always inflicts damage). Only one save roll is made per attack (the result is checked against InSv first, then against Sv with AP). InSv can never be 1+ or better.',
      tags: ['INVULNERABLE', 'SAVE']
    },
    {
      id: 'gen-demise', title: 'Deadly Demise',
      text: 'Each time a model with Deadly Demise X is destroyed, after the units embarked within it (if any) have made their emergency disembark moves, roll one D6: on a 6, each unit within 6" of that model suffers X mortal wounds (if X is random, roll separately for each unit). Friendly units are not excluded.',
      tags: ['DEADLY DEMISE']
    },
    {
      id: 'gen-actions', title: 'Actions',
      text: 'Each action states STARTS (when), UNITS (who), USE LIMIT, COMPLETES and EFFECT. Cannot start an action: units not on the battlefield, AIRCRAFT, FORTIFICATIONS, battle-shocked units, OC 0 or "–", engaged (unless TITANIC), after an advance or fall-back move this turn, or after starting another action this turn. From starting until the end of the turn: not eligible to shoot (excluding TITANIC) or declare a charge. Any move other than pile-in or consolidation, or leaving the battlefield, means the action is not completed.',
      tags: ['ACTIONS', 'MISSION'], ed: 11
    },
    {
      id: 'gen-army', title: 'Mustering armies in brief',
      text: 'Incursion: 1000 points, 2 Detachment Points (DP), enhancement limit 2, unit limit 2 per datasheet (BATTLELINE / DEDICATED TRANSPORT 4). Strike Force: 2000 points, 3 DP, 4 enhancements, unit limit 3 (BATTLELINE / DEDICATED TRANSPORT 6). Several detachments per army, combined DP within the limit (an Incursion army may select one 3 DP detachment as its only detachment). Every EPIC HERO has a unit limit of 1. Only CHARACTER units can be given enhancements, each enhancement only once; Upgrades can also go to non-CHARACTER units, up to three of the same Upgrade.',
      tags: ['ARMY', 'DETACHMENT', 'DP'], ed: 11
    },
    {
      id: 'gen-measure', title: 'Measuring distances',
      text: 'Distances are measured in inches to or from the closest part of a model\'s base (FRAME models: closest point of the model). A model is within a distance if any part of its base is within it; a unit is within if one or more of its models are. Wholly within requires every part of every base. You can measure distances whenever you want. Distances cannot be measured to or from units that are not on the battlefield (reserves, embarked).',
      tags: ['MEASURING', 'WHOLLY WITHIN']
    },
    {
      id: 'gen-coherency', title: 'Coherency',
      text: '2" horizontally / 5" vertically to at least one other model and 9" horizontally / 5" vertically to every other model in the unit. Applies when setting up, at the end of any kind of move and when returning models. In the End of Turn step, models outside coherency are removed.',
      tags: ['COHERENCY'], ed: 11
    },
    {
      id: 'gen-engagement', title: 'Engagement range',
      text: '2" horizontally and 5" vertically. Engaged units cannot make normal or advance moves, only fall back (being engaged solely with AIRCRAFT does not prevent normal or advance moves), and can only shoot using close-quarters shooting (or as MONSTER/VEHICLE units). Charges must end engaged with all charge targets. A charge roll of 2 is never sufficient.',
      tags: ['ENGAGEMENT RANGE'], ed: 11
    },
    {
      id: 'gen-stationary', title: 'Remain Stationary',
      text: 'No models are moved (either in straight lines or rotated). Units that remain stationary do not trigger any rules that are triggered when a unit starts or ends a move. [HEAVY] (+1 to hit if unengaged, not set up this turn and no model moved more than 3") and the improved indirect shooting (1–3 fails instead of 1–5) depend on it.',
      tags: ['REMAIN STATIONARY', 'HEAVY'], ed: 11
    },
    {
      id: 'gen-stratagems', title: 'Using stratagems',
      text: 'Sequence: select targets → reduce your CP by the cost (not enough CP = cannot use it) → resolve the effects. Each player cannot use the same stratagem more than once in the same phase, and cannot target the same unit with more than one stratagem in the same phase. Battle-shocked units cannot be targeted by their controlling player. All players can use core stratagems; detachment stratagems only with the selected detachment.',
      tags: ['STRATAGEM', 'CP']
    },
    {
      id: 'gen-cp', title: 'Command Points',
      text: 'Both players gain 1 CP in each Command phase (Gain Core CP), plus 1 CP for discarding tactical cards at the end of your turn. The core rules set no maximum; further sources are army or detachment rules. Cost modifiers without a duration only apply to that use of the stratagem; a cost can never go below 0 CP or be increased by more than 1 CP.',
      tags: ['CP'], ed: 11
    },
    {
      id: 'gen-vp', title: 'Victory Points',
      text: 'Primary Missions: up to 15 VP per battle round, 45 VP per battle. Secondary Missions: up to 15 VP per battle round, 45 VP per battle, and up to 20 VP per Fixed Secondary Mission card. Battle Ready army: 10 VP. 100 VP in total. VP scored at the end of the battle are not subject to the 15 VP per round limit.',
      tags: ['MISSION', 'VP']
    },
    {
      id: 'gen-attached', title: 'An attached unit is one unit',
      text: 'An attached unit moves, shoots, fights and scores as a single unit; its starting strength is the number of models at the start of the first battle round. Abilities that affect a single specified model only apply to that model; abilities that affect "this unit" apply to every model until the source is destroyed. Revived leaders return to their attached unit.',
      tags: ['LEADER', 'ATTACHED UNIT'], ed: 11
    },
    {
      id: 'gen-notfield', title: 'Not on the battlefield',
      text: 'Embarked units and units in strategic reserves are not visible, cannot be measured to or from and cannot be targeted – for either side. They are still units in your army (army-wide rules apply) and must make battle-shock rolls. Their abilities that require visibility or a distance cannot be fulfilled.',
      tags: ['RESERVES', 'TRANSPORT']
    },
    {
      id: 'gen-auras', title: 'Auras',
      text: 'Abilities that affect models or units within a stated range are aura abilities. A model is always within range of its own aura. A unit can be affected by more than one aura ability at a time, but the same aura ability only applies to a unit once. Duplicated core or weapon abilities are not cumulative; the controlling player selects which instance applies.',
      tags: ['AURA']
    },
    {
      id: 'gen-sequencing', title: 'Rules at the same time',
      text: 'If several rules trigger at the same time: active player mandatory → active player optional → opposing player mandatory → opposing player optional. Rules that become usable during this sequence do not trigger until all remaining rules of that timing have been resolved. While using an out-of-phase rule you cannot use any other phase-locked rule.',
      tags: ['SEQUENCING']
    },
    {
      id: 'gen-revive', title: 'Returning models',
      text: 'Revived models come from the destroyed models of that unit; the starting strength is never exceeded; they return with full wounds and all wargear they started the battle with. They must be set up in coherency with models that started the phase on the battlefield, and can only be set up engaged with enemy units already engaged with the unit. A unit can only be split once.',
      tags: ['REVIVE']
    }
  ],

  // ───────────────────────── Glossary ─────────────────────────
  glossary: [
    // Weapon abilities (verbatim from the core rules, data/datasheets/core-abilities.json)
    { term: 'ASSAULT', text: 'Units containing one or more models with an [ASSAULT] weapon can shoot using assault shooting (10.05).', orig: true },
    { term: 'HEAVY', text: 'In your Shooting phase, each time an attack is made with a [HEAVY] weapon, add 1 to the hit roll if all of the following apply to the attacking unit: - That unit is unengaged. - That unit was not set up on the battlefield this turn. - No model in that unit has moved more than 3" this turn.', orig: true },
    { term: 'RAPID FIRE X', text: 'This ability always takes the form [RAPID FIRE X]. Each time you gather attack dice for a [RAPID FIRE] weapon, add X additional attack dice if the target unit was within half range of that weapon in the Select Targets step.', orig: true },
    { term: 'PISTOL', text: '[PISTOL] and [CLOSE-QUARTERS] are identical for all rules purposes. Units containing one or more models with a [CLOSE-QUARTERS] weapon can shoot using close-quarters shooting (10.06). When using another shooting type, for each model in that unit (excluding MONSTER/VEHICLE models), you can only select one of the following to make attacks with: - One or more of its [CLOSE-QUARTERS] weapons. - One or more of its other ranged weapons.', orig: true },
    { term: 'CLOSE-QUARTERS', text: 'Units containing one or more models with a [CLOSE-QUARTERS] weapon can shoot using close-quarters shooting (10.06). When using another shooting type, for each model in that unit (excluding MONSTER/VEHICLE models), you can only select one of the following to make attacks with: - One or more of its [CLOSE-QUARTERS] weapons. - One or more of its other ranged weapons.', orig: true },
    { term: 'TORRENT', text: 'Each time an attack is made with a [TORRENT] weapon, that attack automatically hits the target.', orig: true },
    { term: 'BLAST', text: 'Each time you gather attack dice for a [BLAST] weapon, add one additional attack dice for every five models that were in the target unit in the Select Targets step (rounding down). If this ability takes the form [BLAST X], each time you gather attack dice for such a weapon, add X additional attack dice for every five models that were in the target unit in the Select Targets step (rounding down) instead.', orig: true },
    { term: 'CLEAVE X', text: 'This ability always takes the form [CLEAVE X]. Each time you gather attack dice for a [CLEAVE] weapon, if you only selected one target for all of that weapon’s attacks, add X additional attack dice for every five models that were in the target unit in the Select Targets step (rounding down).', orig: true },
    { term: 'HAZARDOUS', text: 'Each time a unit is selected to shoot or selected to fight, after that unit has resolved all of its attacks, make a number of hazard rolls (06.03) for that unit equal to the number of [HAZARDOUS] weapons you selected in the Select Weapons step.', orig: true },
    { term: 'INDIRECT FIRE', text: 'Units containing one or more models with an [INDIRECT FIRE] weapon can shoot using indirect shooting (10.07).', orig: true },
    { term: 'IGNORES COVER', text: 'Each time an attack is made with an [IGNORES COVER] weapon, the target cannot have the benefit of cover against that attack (13.08), including from rules that give a model or unit the benefit of cover (e.g. Stealth).', orig: true },
    { term: 'LANCE', text: 'Each time an attack is made with a [LANCE] weapon, if the attacking model’s unit made a charge move this turn, add 1 to the wound roll.', orig: true },
    { term: 'LETHAL HITS', text: 'Each time an attack made with a [LETHAL HITS] weapon results in a critical hit, you can choose for that attack to automatically wound the target.', orig: true },
    { term: 'SUSTAINED HITS X', text: 'This ability always takes the form [SUSTAINED HITS X]. Each time an attack made with a [SUSTAINED HITS] weapon results in a critical hit, that attack results in a number of additional hits on the target as denoted by X.', orig: true },
    { term: 'DEVASTATING WOUNDS', text: 'Each time an attack made with a [DEVASTATING WOUNDS] weapon results in a critical wound, the attack sequence for that attack ends and the target unit suffers a number of mortal wounds equal to the D characteristic of that weapon. These are inflicted after resolving any normal damage inflicted by those attacks. Mortal wounds inflicted by [DEVASTATING WOUNDS] weapons can damage a maximum of one model for each critical wound; any remaining mortal wounds inflicted by that attack are lost.', orig: true },
    { term: 'PRECISION', text: 'While resolving attacks made with one or more [PRECISION] weapons, at the start of the Allocation Order step (05.03), if the target unit contains one or more CHARACTER models visible to one or more of the attacking models, the active player can select one allocation group that contains one of those visible CHARACTER models. If they do, until those attacks are resolved, or until that CHARACTER group is destroyed (whichever happens first), that CHARACTER group is the current allocation group.', orig: true },
    { term: 'TWIN-LINKED', text: 'Each time an attack is made with a [TWIN-LINKED] weapon, you can re-roll the wound roll.', orig: true },
    { term: 'ANTI-X Y+', text: 'This ability always takes the form [ANTI-X Y+]. Each time an attack is made with an [ANTI] weapon, if the target unit has the keyword denoted by X, an unmodified wound roll of Y+ is a critical wound.', orig: true },
    { term: 'MELTA X', text: 'This ability always takes the form [MELTA X]. Each time a model makes an attack with a [MELTA] weapon, if the target unit was within half range of that weapon in the Select Targets step, until the attacking unit’s attacks have been resolved, add X to that weapon’s D characteristic.', orig: true },
    { term: 'EXTRA ATTACKS', text: 'Each time a unit containing one or more models with an [EXTRA ATTACKS] weapon fights, those models will make attacks with those weapons in addition to any others. In the Select Weapons step (04.01), for each of those models, you must select: - All of that model’s [EXTRA ATTACKS] weapons. - One of that model’s other melee weapons, if possible.', orig: true },
    { term: 'PSYCHIC', text: 'Each time an attack is made with a [PSYCHIC] weapon, you can ignore any or all modifiers to that attack’s BS or WS characteristic and any or all modifiers to the hit roll. Attacks made with [PSYCHIC] weapons are known as psychic attacks (this can be important for the triggering of other rules).', orig: true },
    { term: 'ONE SHOT', text: 'Each weapon with this ability can only be selected to make attacks with once per battle. If a destroyed model is returned to a unit, all of its [ONE SHOT] weapons that have already been selected to make attacks with during the battle cannot be selected to make attacks with again. If a new unit is added to an army, all [ONE SHOT] weapons in that unit can be selected to make attacks with once per battle.', orig: true },
    { term: 'SNAP SHOOTING', text: 'Shooting type used by Fire Overwatch. While shooting: You can only target one visible enemy unit within 24" of your unit (and only if it is an eligible target). Each attack only hits on an unmodified hit roll of 6 (irrespective of the attacking weapon’s BS characteristic or any modifiers). Those hits are not critical hits. You cannot re-roll hit rolls. After shooting: Until the end of the phase, your unit is not eligible to start an action.', orig: true },

    // Characteristics
    { term: 'M', text: 'Move: the speed at which a model traverses the battlefield – the maximum distance in inches for a normal or fall-back move (advance: + D6"). A model with M "–" can be set up but otherwise cannot be moved.' },
    { term: 'T', text: 'Toughness: the model\'s resilience against harm; compared with the attack\'s Strength in the wound roll.' },
    { term: 'SV', text: 'Save: the protection a model\'s armour gives it. A save roll modified by AP that is equal to or greater than Sv makes the attack fail. Can never be 1+ or better.' },
    { term: 'INV', text: 'Invulnerable Save (InSv): a save roll equal to or greater than InSv (not modified by AP) makes the attack fail; an unmodified 1 always inflicts damage. Can never be 1+ or better.' },
    { term: 'W', text: 'Wounds: how much damage a model can sustain before it is destroyed. If a model\'s wounds are reduced to 0 or fewer, it is destroyed.' },
    { term: 'LD', text: 'Leadership: a leadership roll (2D6) equal to or greater than Ld succeeds – used for battle-shock rolls. Cannot be modified to 4+ or better, or 9+ or worse.' },
    { term: 'OC', text: 'Objective Control: how effectively a model can control an objective. A model with OC "–" (e.g. while battle-shocked) cannot control objectives at all.' },
    { term: 'BS / WS', text: 'Ballistic Skill / Weapon Skill: the hit roll result needed for ranged / melee attacks. Cannot be modified to 1+ or better, or 7+ or worse.' },
    { term: 'AP', text: 'Armour Penetration: a modifier to the save roll (e.g. -1); does not affect invulnerable saves. Can never be worse than 0.' },
    { term: 'A / S / D', text: 'Attacks (number of attack dice each time the weapon is used), Strength (compared with T in the wound roll), Damage (wounds lost by each attack that inflicts damage).' },

    // Core terms
    { term: 'ENGAGEMENT RANGE', text: 'A model’s engagement range is the area of the battlefield within 2" horizontally and 5" vertically of it.', orig: true },
    { term: 'ENGAGED', text: 'While a friendly model is within engagement range of one or more enemy models, those models – and the units they belong to – are engaged with each other. While a unit contains no engaged models, that unit is unengaged.', orig: true },
    { term: 'COHERENCY', text: 'Every model within 2" horizontally and 5" vertically of at least one other model in its unit, and within 9" horizontally and 5" vertically of every other model in it. Checked when setting up and at the end of any move; models out of coherency are removed in the End of Turn step.' },
    { term: 'WHOLLY WITHIN', text: 'A model is wholly within a specified distance if every part of its base is within that distance. A unit is wholly within if every model in that unit is wholly within the specified distance.', orig: true },
    { term: 'WITHIN', text: 'If a rule says it applies ‘within’ a specified distance, it applies at any distance that is not more than that distance. A model is within a specified distance if any part of its base is within that distance. A unit is within a specified distance if one or more of its models are within that distance.', orig: true },
    { term: 'CRITICAL HIT', text: 'An unmodified hit roll of 6. Critical hits are still hits; they trigger [LETHAL HITS] and [SUSTAINED HITS]. Snap shooting hits and automatic hits are not critical hits.' },
    { term: 'CRITICAL WOUND', text: 'An unmodified wound roll of 6 (or Y+ with [ANTI-X Y+] against a matching target). Critical wounds are still wounds; they trigger [DEVASTATING WOUNDS].' },
    { term: 'MORTAL WOUND', text: 'One model loses 1 wound with no save roll; Feel No Pain can be used. Allocated to non-CHARACTER models before CHARACTER models (wounded models first).' },
    { term: 'HAZARD ROLL', text: 'To make a hazard roll for a unit, roll one D6: on a 1-2, that roll fails and that unit suffers 1 mortal wound, or 3 mortal wounds instead if each model in that unit is a MONSTER/VEHICLE model. If more than one hazard roll is required for a unit, make all of those rolls simultaneously.', orig: true },
    { term: 'BATTLE-SHOCKED', text: 'OC "–", cannot be targeted by its controlling player\'s stratagems, cannot start or complete actions, must use Desperate Escape when falling back. Ends when a battle-shock roll for the unit succeeds.' },
    { term: 'DESPERATE ESCAPE', text: 'Fall-back mode: hazard roll for each model, models can move through enemy models, then a battle-shock roll if the unit is not already battle-shocked. Mandatory for battle-shocked units.' },
    { term: 'ORDERED RETREAT', text: 'Fall-back mode without any rolls; can only be selected if the unit is not battle-shocked.' },
    { term: 'REMAIN STATIONARY', text: 'No models are moved (either in straight lines or rotated). Units that remain stationary do not trigger any rules that are triggered when a unit starts or ends a move.', orig: true },
    { term: 'ADVANCE', text: 'Advance move: M + D6". Until the end of the turn the unit cannot declare a charge or start an action, and can only shoot with [ASSAULT] weapons (assault shooting).' },
    { term: 'FALL BACK', text: 'Fall-back move out of engagement (up to M"), must end unengaged. Until the end of the turn the unit is not eligible to shoot, declare a charge or start an action.' },
    { term: 'INGRESS MOVE', text: 'Arrival from strategic reserves: set up wholly within 6" of a battlefield edge and more than 8" horizontally from all enemy units; from battle round 2; not within your opponent\'s deployment zone before round 3; no other move until the start of the next Charge phase.' },
    { term: 'DEEP STRIKE', text: 'Each time this unit makes an ingress move (20.04), if every model in this unit has this ability, it can be set up anywhere on the battlefield that is more than 8" horizontally from all enemy units, even if that is within your opponent’s deployment zone.', orig: true },
    { term: 'SCOUTS X"', text: 'This ability always takes the form Scouts X". In the Resolve Pre-battle Abilities step, if every model in a unit has this ability, you can do one of the following: - If that unit is in strategic reserves, you can set up that unit anywhere that is wholly within your deployment zone. - If that unit is wholly within your deployment zone, it can make a scout move. - If that unit is embarked within a DEDICATED TRANSPORT that is wholly within your deployment zone, and if every model embarked within that DEDICATED TRANSPORT has the Scouts ability, that DEDICATED TRANSPORT can make a scout move.', orig: true },
    { term: 'INFILTRATORS', text: 'During deployment, if every model in a unit has this ability, it can be set up anywhere on the battlefield that is more than 8" horizontally from your opponent’s deployment zone and all enemy units.', orig: true },
    { term: 'STRATEGIC RESERVES', text: 'Units not set up during deployment (combined points value up to 50% of your points limit). They arrive with ingress moves from battle round 2; units that have not arrived are destroyed at the end of battle round 3.' },
    { term: 'LONE OPERATIVE', text: 'Unless part of an attached unit, this unit is not visible to enemy models unless they are within 12" of this unit, and it cannot be targeted by [INDIRECT FIRE] weapons unless the attacking model is within 12" of this unit. If this ability takes the form Lone Operative X", unless part of an attached unit, this unit is not visible to enemy models unless they are within X" of this unit, and it cannot be targeted by [INDIRECT FIRE] weapons unless the attacking model is within X" of this unit.', orig: true },
    { term: 'STEALTH', text: 'If every model in a unit has this ability, each time a ranged attack targets that unit, that unit has the benefit of cover against that attack (13.08).', orig: true },
    { term: 'FIGHTS FIRST', text: 'While every model in a unit has this ability, that unit is a Fights First unit. See the Resolve Fights First Combats step in the Fight phase (12.04).', orig: true },
    { term: 'DEADLY DEMISE X', text: 'This ability always takes the form Deadly Demise X. Each time a model with this ability is destroyed, after the units embarked within it (if any) have made their emergency disembark moves, roll one D6. On a 6, that model suffers a deadly demise; each unit within 6" of that model suffers a number of mortal wounds denoted by X (if this is a random number, roll separately for each unit within 6").', orig: true },
    { term: 'FIRING DECK X', text: 'This ability always takes the form Firing Deck X. In your Shooting phase, each time this TRANSPORT is selected to shoot, if one or more units are embarked within it, resolve the following sequence: 1. Select up to X models embarked within this TRANSPORT (excluding models whose units have already been selected to shoot this phase). 2. For each selected model, select one of its ranged weapons (excluding [ONE SHOT] weapons). 3. Until this TRANSPORT has resolved all of its attacks, it has all of those selected weapons in addition to its other weapons. 4. Until the end of the turn, units embarked within this TRANSPORT are not eligible to shoot.', orig: true },
    { term: 'LEADER', text: 'Before the battle, in the Muster Armies step, for each leader and support unit in your army, you can select one friendly bodyguard unit that unit can lead. That unit will then lead that bodyguard unit for the battle and form an attached unit with it. Unless otherwise stated, each bodyguard unit can only have one leader unit and one support unit attached to it.', orig: true },
    { term: 'SUPPORT', text: 'Before the battle, in the Muster Armies step, for each leader and support unit in your army, you can select one friendly bodyguard unit that unit can lead. That unit will then lead that bodyguard unit for the battle and form an attached unit with it. Unless otherwise stated, each bodyguard unit can only have one leader unit and one support unit attached to it.', orig: true },
    { term: 'BENEFIT OF COVER', text: 'Worsen the BS of a ranged attack by 1. Only if every model in the target unit qualifies (INFANTRY/BEASTS/SWARM within a terrain area, or not fully visible due to terrain).' },
    { term: 'HIDDEN', text: 'INFANTRY/BEASTS/SWARM within a terrain area containing light/dense terrain, no ranged attacks this or the previous turn: only visible to enemy models within the detection range of 15" (Gone to Ground: 12").' },
    { term: 'OBSCURING', text: 'Terrain areas containing one or more light or dense terrain features are obscuring terrain areas. If every line of sight drawn between two models crosses one or more obscuring terrain areas (excluding obscuring terrain areas that one or both of those models are within), those two models are not visible to each other.', orig: true },
    { term: 'SOLID', text: 'Dense terrain features have the Solid rule. Line of sight cannot be drawn across any enclosed gap in the surface of such a terrain feature that is 3" or less from ground level.', orig: true },
    { term: 'PLUNGING FIRE', text: 'Improve BS by 1 against visible units with models on ground level, if the attacking model is on a section of terrain 3" or more in height, or is TOWERING and the target is within 12".' },
    { term: 'MOBILE', text: 'Keyword: MOBILE models can move horizontally through dense terrain features like INFANTRY/BEASTS/SWARM.' },
    { term: 'TOWERING', text: 'Keyword for very tall models: Plunging Fire applies against targets on ground level within 12".' },
    { term: 'FLY', text: 'Can take to the skies when making a normal, advance, fall-back or charge move: subtract 2" from the maximum distance, ignore all vertical distance, move through all types of model and all categories of terrain feature.' },
    { term: 'HOVER', text: 'Each time this unit takes to the skies (21.03), do not subtract 2" from the maximum distance.', orig: true },
    { term: 'FRAME', text: 'Model without a base (many MONSTERS/VEHICLES): measure to and from the closest point on that model; rotate it around its central axis.' },
    { term: 'FEEL NO PAIN X+', text: 'This ability always takes the form Feel No Pain X+. Each time a model with this ability would lose a wound, roll one D6: on an X+, that wound is not lost.', orig: true },
    { term: 'DAMAGED X', text: 'This ability always takes the form Damaged X. While a model\'s remaining wounds are equal to or less than X, that model is damaged: - While a model is damaged, that model\'s attacks have -1 to hit rolls.', orig: true },
    { term: 'SURGE MOVE', text: 'Out-of-sequence move towards the closest enemy unit (the surge target); only if the unit is not battle-shocked, unengaged and has not moved this phase. Must end engaged with the surge target if possible, and cannot move again this phase.' },
    { term: 'ACTION', text: 'Mission task with STARTS / UNITS / USE LIMIT / COMPLETES / EFFECT. Not for battle-shocked, engaged (unless TITANIC), OC 0 or "–", AIRCRAFT/FORTIFICATION units, or after an advance / fall-back move; afterwards no shooting (unless TITANIC) or charging this turn.' },
    { term: 'SECURED', text: 'An objective that remains under your control even once you have no units within range of it, until your opponent\'s level of control over it is greater than yours at the end of a phase.' },
    { term: 'TERRAIN OBJECTIVE', text: 'An objective whose location coincides with a terrain area: that terrain area is the objective, and a model is within range of it while it is within that terrain area.' },
    { term: 'STARTING STRENGTH', text: 'The number of models a unit contains at the start of the first battle round (attached unit: all its models, including the leader). Basis for half-strength.' },
    { term: 'CP', text: 'Command Points: both players gain 1 CP in each Command phase, +1 CP for discarding tactical cards at the end of your turn; spent to use stratagems.' },
    { term: 'DP', text: 'Detachment Points: the budget for selecting detachments (Incursion 2, Strike Force 3).' },
    { term: 'EPIC HERO', text: 'Unique CHARACTER: unit limit of 1 per army regardless of battle size, cannot be given enhancements.' },
    { term: 'TITANIC', text: 'Gigantic models: can start actions while engaged and still shoot after starting an action; cannot be selected for Fire Overwatch.' },
    { term: 'EXPLOSIVES / GRENADES', text: 'Units with this keyword can use the Explosives stratagem (one unengaged enemy unit within 8" of and visible to a model; roll six D6, each 4+ inflicts 1 mortal wound).' },
    { term: 'SMOKE', text: 'Units with this keyword can use the Smokescreen stratagem (benefit of cover until the end of the phase, also for units they obscure).' }
  ]
};
