/* Learn to play – part 1: basics (see data/tutorial/index.js for the format).
 * Lean on purpose: the essentials a beginner needs for a first game; details live in the original rules (refs).
 * Diagram geometry in inches, distances edge to edge (32 mm base r 0.63, 40 mm 0.79, 50 mm 0.98). */
export const BASICS = [
  // ───────────────────────── 1. The game in a nutshell ─────────────────────────
  {
    id: 'game-overview', part: 'basics',
    title: 'The game in a nutshell', title_de: 'Das Spiel im Überblick',
    intro: 'What a game of Warhammer 40,000 looks like, from the first turn to the final score.',
    intro_de: 'Wie eine Partie Warhammer 40.000 abläuft – vom ersten Zug bis zum Endergebnis.',
    steps: [
      {
        id: 'b-armies', title: 'Armies, units and models', title_de: 'Armeen, Einheiten und Modelle',
        text: '<p>Each player commands an <b>army</b>. Your models are <b>friendly</b>, your opponent\'s are <b>enemy</b>.</p><p>An army is made of <b>units</b>. A unit can be a single model – a tank or a hero – or a squad of many models that always move and fight together as one group. The <b>base</b> a model stands on counts as part of the model. Whatever affects a unit affects every model in it.</p><p>The player whose turn it is, is the <b>active player</b>; the other one is the <b>opposing player</b>. Whenever a unit moves, shoots or fights, its owner counts as the active player until that is done – even in the other player\'s turn.</p>',
        text_de: '<p>Jeder Spieler führt eine <b>Armee</b>. Deine Modelle sind <b>befreundet</b>, die deines Gegners <b>feindlich</b>.</p><p>Eine Armee besteht aus <b>Einheiten</b>. Eine Einheit kann ein einzelnes Modell sein – ein Panzer oder ein Held – oder ein Trupp aus vielen Modellen, die sich immer gemeinsam als eine Gruppe bewegen und kämpfen. Die <b>Base</b>, auf der ein Modell steht, gehört zum Modell. Was eine Einheit betrifft, betrifft jedes Modell darin.</p><p>Wer am Zug ist, ist der <b>aktive Spieler</b>, der andere der <b>Gegenspieler</b>. Sobald eine Einheit sich bewegt, schießt oder kämpft, gilt ihr Besitzer bis zum Ende dieser Aktion als aktiver Spieler – auch im Zug des anderen.</p>',
        refs: ['01', '01.01', '01.02', '01.03'],
        diagrams: [
          {
            w: 14, h: 7.4,
            caption: 'Your army (red) is made of three units: a squad of five models, a tank and a hero. Blue models are the enemy.',
            caption_de: 'Deine Armee (rot) besteht aus drei Einheiten: einem Trupp aus fünf Modellen, einem Panzer und einem Helden. Blaue Modelle sind feindlich.',
            zones: [
              { x: 0.2, y: 4.2, w: 6.9, h: 3, side: 0, label: 'unit: 5 models', label_de: 'Einheit: 5 Modelle' },
              { x: 7.4, y: 4.2, w: 3.4, h: 3, side: 0, label: 'unit: 1 tank', label_de: 'Einheit: 1 Panzer' },
              { x: 11.1, y: 4.2, w: 2.7, h: 3, side: 0, label: 'unit: hero', label_de: 'Einheit: Held' },
              { x: 3.5, y: 0.2, w: 7, h: 2.9, side: 1, label: 'enemy unit', label_de: 'feindliche Einheit' }
            ],
            models: [
              { x: 0.95, y: 5.9, side: 0 }, { x: 2.25, y: 5.9, side: 0 }, { x: 3.55, y: 5.9, side: 0 }, { x: 4.85, y: 5.9, side: 0 }, { x: 6.15, y: 5.9, side: 0 },
              { x: 9.1, y: 5.9, side: 0, shape: 'rect', rw: 2.4, rh: 1.5 },
              { x: 12.45, y: 5.9, side: 0, r: 0.79 },
              { x: 4.6, y: 1.9, side: 1 }, { x: 6, y: 1.9, side: 1 }, { x: 7.4, y: 1.9, side: 1 }, { x: 8.8, y: 1.9, side: 1 }
            ],
            notes: [{ x: 7, y: 3.75, text: 'friendly = yours · enemy = your opponent\'s', text_de: 'befreundet = deine · feindlich = gegnerische', anchor: 'middle' }]
          },
          {
            type: 'flow', dir: 'down',
            caption: 'Whoever acts is the active player – even when it is the other player\'s turn.',
            caption_de: 'Wer gerade handelt, ist der aktive Spieler – auch im Zug des anderen.',
            items: [
              { title: 'Your turn', title_de: 'Dein Zug', text: 'You are the active player.', text_de: 'Du bist der aktive Spieler.', kind: 'you' },
              { title: 'An enemy unit fights back', title_de: 'Eine feindliche Einheit schlägt zurück', text: 'While it fights, your opponent counts as the active player.', text_de: 'Während sie kämpft, gilt dein Gegner als aktiver Spieler.', kind: 'opp' },
              { title: 'Its attacks are done', title_de: 'Ihre Attacken sind erledigt', text: 'You are the active player again.', text_de: 'Du bist wieder der aktive Spieler.', kind: 'you' }
            ]
          }
        ]
      },
      {
        id: 'b-round', title: 'Battle rounds and turns', title_de: 'Schlachtrunden und Züge',
        text: '<p>A battle lasts several <b>battle rounds</b> – your mission says how many, usually five. In each battle round both players take one <b>turn</b>; the same player always goes first.</p><p>Every turn runs through the same parts, always in this order:</p><ul><li><b>Start of turn</b></li><li><b>Command phase</b> – both players gain Command Points; you test weakened units.</li><li><b>Movement phase</b> – your units move, reserves arrive.</li><li><b>Shooting phase</b> – your units fire.</li><li><b>Charge phase</b> – your units charge into combat.</li><li><b>Fight phase</b> – units of <i>both</i> players that are in combat strike.</li><li><b>End of turn</b> – end-of-turn rules, then mission scoring.</li></ul><p>Part 2 of this guide walks you through every phase.</p>',
        text_de: '<p>Eine Schlacht dauert mehrere <b>Schlachtrunden</b> – deine Mission sagt, wie viele, meist fünf. In jeder Schlachtrunde hat jeder Spieler einen <b>Zug</b>; es beginnt immer derselbe Spieler.</p><p>Jeder Zug läuft in derselben Reihenfolge ab:</p><ul><li><b>Zugbeginn</b></li><li><b>Kommandophase</b> – beide Spieler erhalten Befehlspunkte, du testest geschwächte Einheiten.</li><li><b>Bewegungsphase</b> – deine Einheiten bewegen sich, Reserven treffen ein.</li><li><b>Fernkampfphase</b> – deine Einheiten schießen.</li><li><b>Angriffsphase</b> – deine Einheiten stürmen in den Nahkampf.</li><li><b>Nahkampfphase</b> – Einheiten <i>beider</i> Spieler, die im Nahkampf sind, schlagen zu.</li><li><b>Zugende</b> – Regeln für das Zugende, dann die Missionswertung.</li></ul><p>Teil 2 dieser Anleitung geht jede Phase mit dir durch.</p>',
        tips: ['In the Fight phase your opponent\'s units strike back – even though it is your turn.'],
        tips_de: ['In der Nahkampfphase schlagen auch die Einheiten deines Gegners zurück – obwohl du am Zug bist.'],
        refs: ['07', '07.01', '07.02', '07.03'],
        diagrams: [
          {
            type: 'flow', dir: 'right',
            caption: 'A battle: round after round, and in every round the same player goes first.',
            caption_de: 'Eine Schlacht: Runde um Runde, und in jeder Runde beginnt derselbe Spieler.',
            items: [
              { title: 'Round 1', title_de: 'Runde 1', text: 'Player A\'s turn, then player B\'s', text_de: 'Zug von Spieler A, dann von B', kind: 'info' },
              { title: 'Round 2', title_de: 'Runde 2', text: 'same order', text_de: 'gleiche Reihenfolge', kind: 'info' },
              { title: '… Round 5', title_de: '… Runde 5', text: 'then the battle ends', text_de: 'dann endet die Schlacht', kind: 'info' }
            ]
          },
          {
            type: 'flow', dir: 'down',
            caption: 'One turn, always in this order. Yellow = the opponent\'s units take part too.',
            caption_de: 'Ein Zug, immer in dieser Reihenfolge. Gelb = auch die Einheiten des Gegners machen mit.',
            items: [
              { title: 'Start of turn', title_de: 'Zugbeginn', kind: 'info' },
              { title: 'Command phase', title_de: 'Kommandophase', text: 'both +1 CP · battle-shock rolls', text_de: 'beide +1 BP · Kampfschockwürfe', kind: 'you' },
              { title: 'Movement phase', title_de: 'Bewegungsphase', text: 'move · reserves arrive', text_de: 'bewegen · Reserven treffen ein', kind: 'you' },
              { title: 'Shooting phase', title_de: 'Fernkampfphase', text: 'your units fire', text_de: 'deine Einheiten schießen', kind: 'you' },
              { title: 'Charge phase', title_de: 'Angriffsphase', text: 'charge into combat', text_de: 'in den Nahkampf stürmen', kind: 'you' },
              { title: 'Fight phase', title_de: 'Nahkampfphase', text: 'units of both players strike', text_de: 'Einheiten beider Spieler schlagen zu', kind: 'warn' },
              { title: 'End of turn', title_de: 'Zugende', text: 'end-of-turn rules · scoring', text_de: 'Regeln für das Zugende · Wertung', kind: 'info' }
            ]
          }
        ]
      },
      {
        id: 'b-winning', title: 'How you win', title_de: 'Wie man gewinnt',
        text: '<p>You win by having more <b>Victory Points (VP)</b> than your opponent at the end – not necessarily by wiping out their army.</p><p>Your mission tells you how to score. Mostly it is about controlling <b>objectives</b> on the battlefield and achieving secondary missions. Points are scored at fixed moments, for example at the end of a phase, a turn or a battle round.</p>',
        text_de: '<p>Du gewinnst, wenn du am Ende mehr <b>Siegpunkte (SP)</b> hast als dein Gegner – nicht unbedingt, indem du seine Armee auslöschst.</p><p>Deine Mission sagt dir, wie du punktest. Meist geht es darum, <b>Missionsziele</b> auf dem Schlachtfeld zu kontrollieren und Sekundärmissionen zu erfüllen. Gewertet wird zu festen Zeitpunkten, zum Beispiel am Ende einer Phase, eines Zuges oder einer Schlachtrunde.</p>',
        tips: ['Plan around the objectives from the very first turn – destroying enemies only helps if it lets you score.'],
        tips_de: ['Plane von Anfang an rund um die Missionsziele – Gegner zu vernichten hilft nur, wenn du dadurch punktest.'],
        refs: ['07.03', '14'],
        diagrams: [
          {
            w: 14, h: 6,
            caption: 'At a scoring moment you control two objectives, your opponent one – you score more VP.',
            caption_de: 'Zu einem Wertungszeitpunkt kontrollierst du zwei Missionsziele, dein Gegner eines – du bekommst mehr SP.',
            objectives: [
              { x: 2.5, y: 3, label: 'yours', label_de: 'deins' },
              { x: 7, y: 3, label: 'yours', label_de: 'deins' },
              { x: 11.5, y: 3, label: 'enemy\'s', label_de: 'gegnerisch' }
            ],
            models: [
              { x: 1.2, y: 5.1, side: 0 }, { x: 2.6, y: 5.1, side: 0 }, { x: 4.2, y: 2.4, side: 0 },
              { x: 6, y: 5.1, side: 0 }, { x: 7.4, y: 5.1, side: 0 }, { x: 8.6, y: 1.5, side: 0, shape: 'rect', rw: 1.8, rh: 1.3 },
              { x: 10.4, y: 1, side: 1 }, { x: 11.8, y: 1, side: 1 }, { x: 13.1, y: 2, side: 1 }, { x: 13.1, y: 4.5, side: 1 }
            ]
          },
          {
            type: 'table',
            caption: 'You lost twice as many models – but you scored more Victory Points, so you win.',
            caption_de: 'Du hast doppelt so viele Modelle verloren – aber mehr Siegpunkte geholt, also gewinnst du.',
            head: ['End of the battle', 'You', 'Enemy'],
            head_de: ['Ende der Schlacht', 'Du', 'Gegner'],
            rows: [['Models lost', '18', '9'], ['Victory Points', '62', '48'], ['Result', 'win', 'loss']],
            rows_de: [['Verlorene Modelle', '18', '9'], ['Siegpunkte', '62', '48'], ['Ergebnis', 'Sieg', 'Niederlage']],
            hl: [[1, 1], [2, 1]]
          }
        ]
      },
      {
        id: 'b-table', title: 'What you need', title_de: 'Was du brauchst',
        text: '<p>Besides your armies you need:</p><ul><li>A handful of <b>six-sided dice</b> (D6).</li><li>A <b>tape measure</b> in inches ("). You may measure any distance at any time.</li><li>A <b>battlefield</b> with terrain and <b>objective markers</b>, set up as your mission\'s deployment map shows.</li><li>The <b>datasheets</b> of your units – this app shows them for you.</li></ul>',
        text_de: '<p>Neben euren Armeen braucht ihr:</p><ul><li>Eine Handvoll <b>sechsseitige Würfel</b> (W6).</li><li>Ein <b>Maßband</b> in Zoll ("). Messen darfst du jederzeit.</li><li>Ein <b>Schlachtfeld</b> mit Gelände und <b>Missionszielmarkern</b>, aufgebaut nach der Aufstellungskarte deiner Mission.</li><li>Die <b>Datenblätter</b> deiner Einheiten – diese App zeigt sie dir.</li></ul>',
        refs: ['01.04', '01.05', '13.01', '14.01.01'],
        diagrams: [{
          w: 14, h: 8,
          caption: 'A (much smaller) battlefield: both deployment zones, a ruin in the middle and two objective markers.',
          caption_de: 'Ein (stark verkleinertes) Schlachtfeld: beide Aufstellungszonen, eine Ruine in der Mitte und zwei Missionszielmarker.',
          zones: [
            { x: 0, y: 0, w: 14, h: 2, side: 1, label: 'Enemy deployment zone', label_de: 'Gegnerische Aufstellungszone' },
            { x: 0, y: 6, w: 14, h: 2, side: 0, label: 'Your deployment zone', label_de: 'Deine Aufstellungszone' }
          ],
          terrain: [{ x: 5.5, y: 2.9, w: 3, h: 2.2, type: 'ruin', label: 'ruin', label_de: 'Ruine' }],
          objectives: [{ x: 2.6, y: 4, label: 'objective', label_de: 'Missionsziel' }, { x: 11.4, y: 4, label: 'objective', label_de: 'Missionsziel' }],
          models: [
            { x: 8, y: 1.2, side: 1 }, { x: 9.4, y: 1.2, side: 1 }, { x: 10.8, y: 1.2, side: 1 }, { x: 12.6, y: 1.1, side: 1, r: 0.98 },
            { x: 5.8, y: 7.1, side: 0 }, { x: 7.2, y: 7.1, side: 0 }, { x: 8.6, y: 7.1, side: 0 }, { x: 10, y: 7.1, side: 0 }, { x: 11.4, y: 7.1, side: 0 },
            { x: 13, y: 7, side: 0, shape: 'rect', rw: 1.6, rh: 1.3 }
          ]
        }, {
          type: 'dice',
          caption: 'A D6 is an ordinary six-sided dice: it shows 1 to 6.',
          caption_de: 'Ein W6 ist ein ganz normaler sechsseitiger Würfel: Er zeigt 1 bis 6.',
          rows: [{ label: 'D6', label_de: 'W6', dice: [1, 2, 3, 4, 5, 6] }]
        }]
      }
    ]
  },

  // ───────────────────────── 2. Reading a datasheet ─────────────────────────
  {
    id: 'datasheets', part: 'basics',
    title: 'Reading a datasheet', title_de: 'Ein Datenblatt lesen',
    intro: 'Every unit has a datasheet with its numbers, weapons and special rules. This is what the parts mean.',
    intro_de: 'Jede Einheit hat ein Datenblatt mit ihren Werten, Waffen und Sonderregeln. Das bedeuten die einzelnen Teile.',
    steps: [
      {
        id: 'b-profile', title: 'The unit profile', title_de: 'Das Profil der Einheit',
        text: '<p>The profile tells you how fast and tough a model is:</p><ul><li><b>M</b> (Move) – how many inches it can move.</li><li><b>T</b> (Toughness) – how hard it is to wound.</li><li><b>Sv</b> (Save) – its armour, as a dice result: 3+ means a roll of 3 or more saves.</li><li><b>W</b> (Wounds) – how much damage it can take; at 0 it is destroyed.</li><li><b>Ld</b> (Leadership) – its courage, the 2D6 result it needs in leadership rolls (e.g. 7+).</li><li><b>OC</b> (Objective Control) – how strongly it holds objectives.</li></ul><p>Some models also have an <b>invulnerable save</b> (e.g. 4+). Weapons\' AP does not worsen it – you\'ll see how that works under "Making attacks".</p>',
        text_de: '<p>Das Profil zeigt, wie schnell und zäh ein Modell ist (die Datenblätter verwenden die englischen Kürzel):</p><ul><li><b>M</b> (Move, Bewegung) – wie viele Zoll es sich bewegen darf.</li><li><b>T</b> (Toughness, Widerstand) – wie schwer es zu verwunden ist.</li><li><b>Sv</b> (Save, Rüstungswurf) – seine Rüstung als Würfelergebnis: 3+ heißt, eine 3 oder mehr rettet.</li><li><b>W</b> (Wounds, Lebenspunkte) – wie viel Schaden es verträgt; bei 0 ist es vernichtet.</li><li><b>Ld</b> (Leadership, Moralwert) – sein Mut, das 2W6-Ergebnis, das es bei Moralwürfen braucht (z. B. 7+).</li><li><b>OC</b> (Objective Control) – wie stark es Missionsziele hält.</li></ul><p>Manche Modelle haben zusätzlich einen <b>Rettungswurf</b> (z. B. 4+). Der DS einer Waffe verschlechtert ihn nicht – wie das funktioniert, siehst du bei „Angriffe durchführen“.</p>',
        tips: ['Lower is better for Sv and Ld (2+ beats 4+); higher is better for M, T, W and OC.'],
        tips_de: ['Bei Sv und Ld ist niedriger besser (2+ schlägt 4+), bei M, T, W und OC höher.'],
        refs: ['02', '02.01', '02.02'],
        diagrams: [
          {
            type: 'sheet', name: 'Line Trooper Squad',
            caption: 'A made-up example datasheet – the numbers on the left of a real one look just like this.',
            caption_de: 'Ein erfundenes Beispiel-Datenblatt – die Werte eines echten sehen genauso aus.',
            stats: [['M', '6"'], ['T', '4'], ['Sv', '3+'], ['InSv', '5+'], ['W', '2'], ['Ld', '7+'], ['OC', '2']],
            marks: { M: 1, T: 2, Sv: 3, InSv: 4, W: 5, Ld: 6, OC: 7 },
            callouts: [
              { n: 1, text: 'Move: up to 6" in a normal move', text_de: 'Bewegung: bis zu 6" bei einer normalen Bewegung' },
              { n: 2, text: 'Toughness 4: compared with an attack\'s S', text_de: 'Widerstand 4: wird mit der S eines Angriffs verglichen' },
              { n: 3, text: 'Save 3+: a roll of 3 or more stops an attack', text_de: 'Rüstungswurf 3+: eine 3 oder mehr wehrt einen Angriff ab' },
              { n: 4, text: 'Invulnerable save 5+: AP never worsens it', text_de: 'Rettungswurf 5+: AP verschlechtert ihn nie' },
              { n: 5, text: 'Wounds 2: each model is destroyed after losing 2', text_de: 'Lebenspunkte 2: jedes Modell ist nach 2 verlorenen vernichtet' },
              { n: 6, text: 'Leadership 7+: needs 7 or more on 2D6', text_de: 'Moralwert 7+: braucht 7 oder mehr mit 2W6' },
              { n: 7, text: 'Objective Control: each model counts 2', text_de: 'Objective Control: jedes Modell zählt 2' }
            ]
          },
          {
            type: 'dice',
            caption: 'Lower is better for saves: the same six results – a 3+ save stops 4 of them, a 4+ save only 3.',
            caption_de: 'Bei Rüstungswürfen ist niedriger besser: dieselben sechs Ergebnisse – ein 3+ wehrt 4 davon ab, ein 4+ nur 3.',
            rows: [
              { label: 'Sv 3+', dice: [1, 2, 3, 4, 5, 6], need: 3, note: '4 of 6 save', note_de: '4 von 6 retten' },
              { label: 'Sv 4+', dice: [1, 2, 3, 4, 5, 6], need: 4, note: '3 of 6 save', note_de: '3 von 6 retten' }
            ]
          }
        ]
      },
      {
        id: 'b-weapons', title: 'Weapons', title_de: 'Waffen',
        text: '<p>Each weapon has its own line:</p><ul><li><b>Range</b> – how far it shoots, in inches. "Melee" means a close-combat weapon.</li><li><b>A</b> (Attacks) – how many attack dice it rolls; can be random, like D6.</li><li><b>BS</b> / <b>WS</b> (Ballistic / Weapon Skill) – the roll needed to hit.</li><li><b>S</b> (Strength) – compared with the target\'s T to see how easily it wounds.</li><li><b>AP</b> (Armour Penetration) – makes the target\'s save worse, e.g. -1.</li><li><b>D</b> (Damage) – wounds the target loses per successful attack.</li></ul><p>Words in square brackets such as [ASSAULT], [HEAVY] or [RAPID FIRE 1] are <b>weapon abilities</b> that change how the weapon works. Look them up when they come up – nobody learns them all at once.</p>',
        text_de: '<p>Jede Waffe hat ihre eigene Zeile:</p><ul><li><b>Range</b> (Reichweite) – wie weit sie schießt, in Zoll. „Melee“ steht für eine Nahkampfwaffe.</li><li><b>A</b> (Attacken) – wie viele Angriffswürfel sie wirft; kann zufällig sein, z. B. W6.</li><li><b>BS</b> / <b>WS</b> (Ballistische Fertigkeit / Kampfgeschick) – der Wurf, den du zum Treffen brauchst.</li><li><b>S</b> (Stärke) – wird mit dem T des Ziels verglichen und bestimmt, wie leicht sie verwundet.</li><li><b>AP</b> (Durchschlag) – verschlechtert den Rüstungswurf des Ziels, z. B. -1.</li><li><b>D</b> (Schaden) – Lebenspunkte, die das Ziel pro erfolgreichem Angriff verliert.</li></ul><p>Begriffe in eckigen Klammern wie [ASSAULT], [HEAVY] oder [RAPID FIRE 1] sind <b>Waffenfähigkeiten</b>, die die Waffe verändern. Schlag sie nach, wenn sie auftauchen – niemand lernt alle auf einmal.</p>',
        refs: ['02.04', '24'],
        diagrams: [
          {
            type: 'sheet', name: 'Line Trooper Squad', skillHead: 'BS/WS',
            weaponHead: 'Weapon', weaponHead_de: 'Waffe',
            caption: 'The weapons of the made-up squad: one ranged weapon, one melee weapon.',
            caption_de: 'Die Waffen des erfundenen Trupps: eine Fernkampfwaffe, eine Nahkampfwaffe.',
            stats: [['M', '6"'], ['T', '4'], ['Sv', '3+'], ['W', '2'], ['Ld', '7+'], ['OC', '2']],
            weapons: [
              { name: 'Assault rifle', range: '24"', A: 2, skill: '4+', S: 4, AP: -1, D: 1, abilities: '[ASSAULT]' },
              { name: 'Combat knife', range: 'Melee', A: 2, skill: '4+', S: 4, AP: 0, D: 1 }
            ],
            marks: { 'w0.range': 1, 'w0.A': 2, 'w0.skill': 3, 'w0.S': 4, 'w0.AP': 5, 'w0.D': 6, 'w0.abilities': 7, 'w1.range': 8 },
            callouts: [
              { n: 1, text: 'Range: shoots at targets up to 24" away', text_de: 'Reichweite: schießt auf Ziele bis 24" entfernt' },
              { n: 2, text: 'Attacks: 2 dice for each model using it', text_de: 'Attacken: 2 Würfel für jedes Modell, das sie nutzt' },
              { n: 3, text: 'BS 4+: hits on a 4 or more', text_de: 'BS 4+: trifft bei 4 oder mehr' },
              { n: 4, text: 'Strength 4: compared with the target\'s T', text_de: 'Stärke 4: wird mit dem T des Ziels verglichen' },
              { n: 5, text: 'AP -1: the target\'s save gets 1 worse', text_de: 'AP -1: der Rüstungswurf des Ziels wird um 1 schlechter' },
              { n: 6, text: 'Damage 1: per attack that gets through', text_de: 'Schaden 1: pro Angriff, der durchkommt' },
              { n: 7, text: 'Weapon ability – look it up when needed', text_de: 'Waffenfähigkeit – bei Bedarf nachschlagen' },
              { n: 8, text: 'Melee: a close-combat weapon, hits with WS', text_de: 'Melee: eine Nahkampfwaffe, trifft mit WS' }
            ]
          },
          {
            type: 'flow', dir: 'down',
            caption: 'Each number of a weapon is used at one step of an attack (more under "Making attacks").',
            caption_de: 'Jeder Wert einer Waffe wird in einem Schritt eines Angriffs gebraucht (mehr bei „Angriffe durchführen“).',
            items: [
              { title: 'A', text: 'how many dice you roll', text_de: 'wie viele Würfel du wirfst', kind: 'you' },
              { title: 'BS / WS', text: 'hit roll', text_de: 'Trefferwurf', kind: 'you' },
              { title: 'S', text: 'wound roll against the target\'s T', text_de: 'Verwundungswurf gegen den T des Ziels', kind: 'you' },
              { title: 'AP', text: 'worsens the defender\'s save roll', text_de: 'verschlechtert den Rüstungswurf des Verteidigers', kind: 'opp' },
              { title: 'D', text: 'wounds lost per unsaved attack', text_de: 'verlorene Lebenspunkte pro nicht abgewehrtem Angriff', kind: 'bad' }
            ]
          }
        ]
      },
      {
        id: 'b-keywords', title: 'Abilities, keywords and wargear', title_de: 'Fähigkeiten, Schlüsselwörter und Ausrüstung',
        text: '<p><b>Abilities</b> are the unit\'s special rules: core abilities like DEEP STRIKE, your army rule and rules unique to this unit.</p><p><b>Keywords</b> in capitals – INFANTRY, VEHICLE, CHARACTER, BATTLELINE … – describe what the unit is. Many rules only apply to units with a certain keyword, e.g. "INFANTRY units in a terrain area".</p><p><b>Unit composition</b> lists how many models the unit has and what they carry; <b>wargear options</b> list the weapon swaps you may choose when you build your army.</p>',
        text_de: '<p><b>Fähigkeiten</b> sind die Sonderregeln der Einheit: Kernfähigkeiten wie DEEP STRIKE, deine Armeeregel und Regeln, die nur diese Einheit hat.</p><p><b>Schlüsselwörter</b> in Großbuchstaben – INFANTRY, VEHICLE, CHARACTER, BATTLELINE … – beschreiben, was die Einheit ist. Viele Regeln gelten nur für Einheiten mit einem bestimmten Schlüsselwort, z. B. „INFANTRY-Einheiten in einem Geländebereich“.</p><p>Die <b>Einheitenzusammensetzung</b> nennt, wie viele Modelle die Einheit hat und was sie tragen; die <b>Ausrüstungsoptionen</b> zeigen, welche Waffen du beim Armeebau austauschen darfst.</p>',
        tips: ['Read your own units\' abilities before the game – rules that trigger "at the start of the phase" are the ones people forget most.'],
        tips_de: ['Lies vor dem Spiel die Fähigkeiten deiner Einheiten – Regeln, die „zu Beginn der Phase“ ausgelöst werden, vergisst man am leichtesten.'],
        refs: ['02.03', '02.05', '02.06', '02.07'],
        diagrams: [
          {
            type: 'sheet', name: 'Line Trooper Squad',
            caption: 'The keyword line at the bottom of a datasheet tells you what the unit is.',
            caption_de: 'Die Schlüsselwortzeile unten auf dem Datenblatt sagt dir, was die Einheit ist.',
            stats: [['M', '6"'], ['T', '4'], ['Sv', '3+'], ['W', '2'], ['Ld', '7+'], ['OC', '2']],
            keywords: 'INFANTRY, BATTLELINE, GRENADES',
            marks: { name: 1, keywords: 2 },
            callouts: [
              { n: 1, text: 'Datasheet name', text_de: 'Name des Datenblatts' },
              { n: 2, text: 'Keywords: this unit is INFANTRY, so rules for INFANTRY apply to it', text_de: 'Schlüsselwörter: Diese Einheit ist INFANTRY, also gelten Regeln für INFANTRY für sie' }
            ]
          },
          {
            type: 'compare',
            caption: 'Same terrain area, different keyword: only INFANTRY (also BEASTS, SWARM) gets cover just for standing in it.',
            caption_de: 'Gleicher Geländebereich, anderes Schlüsselwort: Nur INFANTRY (auch BEASTS, SWARM) erhält schon fürs Darinstehen Deckung.',
            labels: [{ text: 'INFANTRY: cover', text_de: 'INFANTRY: Deckung', kind: 'ok' }, { text: 'VEHICLE: no cover', text_de: 'VEHICLE: keine Deckung', kind: 'bad' }],
            items: [
              { w: 6, h: 4, terrain: [{ x: 0.5, y: 0.5, w: 5, h: 3, type: 'ruin' }], models: [{ x: 2.4, y: 2, side: 0, mark: 'cover' }, { x: 3.8, y: 2, side: 0 }] },
              { w: 6, h: 4, terrain: [{ x: 0.5, y: 0.5, w: 5, h: 3, type: 'ruin' }], models: [{ x: 3, y: 2, side: 0, shape: 'rect', rw: 2.4, rh: 1.5, mark: 'bad' }] }
            ]
          }
        ]
      }
    ]
  },

  // ───────────────────────── 3. Dice and tests ─────────────────────────
  {
    id: 'dice-tests', part: 'basics',
    title: 'Dice and tests', title_de: 'Würfel und Tests',
    intro: 'How the rules talk about dice, and what leadership and battle-shock rolls are.',
    intro_de: 'Wie die Regeln Würfel angeben und was Moral- und Kampfschockwürfe sind.',
    steps: [
      {
        id: 'b-dice', title: 'Rolling dice', title_de: 'Würfeln',
        text: '<ul><li><b>3+</b> – roll 3 or more on a D6.</li><li><b>2D6</b> – roll two D6 and add them up.</li><li><b>D3</b> – roll a D6 and halve it, rounding up (1–2 = 1, 3–4 = 2, 5–6 = 3).</li><li><b>D6+1</b> – roll and add the number.</li></ul><p>A <b>re-roll</b> means rolling that dice again – the new result counts, even if it is worse, and a dice is never re-rolled twice. <b>Modifiers</b> such as "+1 to the hit roll" change the result; the <b>unmodified</b> result is what the dice actually shows. In a <b>roll-off</b> both players roll a D6 and the higher result wins (re-roll ties).</p>',
        text_de: '<ul><li><b>3+</b> – eine 3 oder mehr mit einem W6.</li><li><b>2W6</b> – zwei W6 werfen und addieren.</li><li><b>W3</b> – einen W6 werfen und halbieren, aufgerundet (1–2 = 1, 3–4 = 2, 5–6 = 3).</li><li><b>W6+1</b> – würfeln und die Zahl addieren.</li></ul><p><b>Wiederholen</b> heißt, den Würfel noch einmal zu werfen – das neue Ergebnis gilt, auch wenn es schlechter ist, und kein Würfel wird zweimal wiederholt. <b>Modifikatoren</b> wie „+1 auf den Trefferwurf“ verändern das Ergebnis; das <b>unmodifizierte</b> Ergebnis ist die Zahl, die der Würfel tatsächlich zeigt. Beim <b>Würfelduell</b> (roll-off) wirft jeder Spieler einen W6, das höhere Ergebnis gewinnt (bei Gleichstand nochmal).</p>',
        tips: ['Roll all dice for the same thing at once – ten hit rolls are one handful of ten dice.'],
        tips_de: ['Wirf alle Würfel für dieselbe Sache auf einmal – zehn Trefferwürfe sind eine Handvoll aus zehn Würfeln.'],
        refs: ['01.05', '05'],
        diagrams: [
          {
            type: 'dice',
            caption: 'How to read dice notation. Green = success.',
            caption_de: 'So liest du Würfelangaben. Grün = Erfolg.',
            rows: [
              { label: '3+', dice: [1, 2, 3, 4, 5, 6], need: 3, note: '3, 4, 5 and 6 succeed', note_de: '3, 4, 5 und 6 gelingen' },
              { label: '2D6', label_de: '2W6', dice: [4, 3], note: '4 + 3 = 7' },
              { label: 'D3', label_de: 'W3', dice: [5], note: '5 halved, rounded up = 3', note_de: '5 halbiert, aufgerundet = 3' },
              { label: 'D6+1', label_de: 'W6+1', dice: [4], note: '4 + 1 = 5' }
            ]
          },
          {
            type: 'dice',
            caption: 'A re-roll: the 2 is rolled again and shows a 5 – the 5 counts. A roll-off: the higher result wins.',
            caption_de: 'Wiederholen: Die 2 wird neu geworfen und zeigt eine 5 – die 5 zählt. Würfelduell: Das höhere Ergebnis gewinnt.',
            rows: [
              { label: 'Roll (need 3+)', label_de: 'Wurf (3+ nötig)', dice: [2], need: 3, note: 'a 2 fails – you may re-roll it', note_de: 'eine 2 misslingt – du darfst sie wiederholen' },
              { label: 'Re-roll', label_de: 'Wiederholung', dice: ['2→5'], need: 3, note: 'the new result counts – it can\'t be re-rolled again', note_de: 'das neue Ergebnis zählt – es darf nicht noch einmal wiederholt werden' },
              { label: 'Roll-off: you', label_de: 'Würfelduell: du', dice: [5] },
              { label: 'Roll-off: opponent', label_de: 'Würfelduell: Gegner', dice: [3], note: '5 beats 3 – you win', note_de: '5 schlägt 3 – du gewinnst' }
            ]
          }
        ]
      },
      {
        id: 'b-battleshock', title: 'Leadership and battle-shock', title_de: 'Moral und Kampfschock',
        text: '<p>For a <b>leadership roll</b> roll 2D6: if the total is equal to or higher than the unit\'s Ld, it succeeds.</p><p>A <b>battle-shock roll</b> is a leadership roll. In your Command phase you make one for each of your units that is <b>at or below half-strength</b> (half its models left – for a single model, half its wounds) or already battle-shocked. If it fails, the unit is <b>battle-shocked</b>:</p><ul><li>its OC becomes "–", so it can\'t hold objectives,</li><li>you can\'t use stratagems on it,</li><li>it can\'t start or complete actions.</li></ul><p>A later successful roll ends battle-shock.</p>',
        text_de: '<p>Für einen <b>Moralwurf</b> (leadership roll) wirfst du 2W6: Ist die Summe gleich oder höher als der Ld der Einheit, ist er geschafft.</p><p>Ein <b>Kampfschockwurf</b> ist ein Moralwurf. In deiner Kommandophase legst du ihn für jede deiner Einheiten ab, die <b>auf halber Stärke oder darunter</b> ist (nur noch die Hälfte der Modelle – bei einem einzelnen Modell die Hälfte der Lebenspunkte) oder bereits kampfgeschockt ist. Misslingt er, ist die Einheit <b>kampfgeschockt</b>:</p><ul><li>ihr OC wird „–“, sie kann also keine Missionsziele halten,</li><li>du kannst keine Strategeme auf sie einsetzen,</li><li>sie kann keine Aktionen beginnen oder abschließen.</li></ul><p>Ein späterer geschaffter Wurf beendet den Kampfschock.</p>',
        tips: ['On 2D6, a 7+ succeeds a little more than half the time (58%), an 8+ less than half (42%).'],
        tips_de: ['Mit 2W6 gelingt eine 7+ etwas mehr als in der Hälfte der Fälle (58 %), eine 8+ in weniger als der Hälfte (42 %).'],
        refs: ['01.06', '01.06.01', '01.07', '08.03', '08.05'],
        diagrams: [{
          w: 12, h: 5,
          caption: 'Both units are at or below half-strength, so each takes a battle-shock roll in your Command phase.',
          caption_de: 'Beide Einheiten sind auf halber Stärke oder darunter und legen in deiner Kommandophase einen Kampfschockwurf ab.',
          models: [
            { x: 1.2, y: 1.6, side: 0 }, { x: 2.6, y: 1.6, side: 0 }, { x: 4, y: 1.6, side: 0 }, { x: 5.4, y: 1.6, side: 0 }, { x: 6.8, y: 1.6, side: 0, mark: 'shock' },
            { x: 1.2, y: 3, side: 0, ghost: true }, { x: 2.6, y: 3, side: 0, ghost: true }, { x: 4, y: 3, side: 0, ghost: true }, { x: 5.4, y: 3, side: 0, ghost: true }, { x: 6.8, y: 3, side: 0, ghost: true },
            { x: 10, y: 2.3, side: 0, shape: 'rect', rw: 2.4, rh: 1.4, mark: 'shock' }
          ],
          notes: [
            { x: 4, y: 4.6, text: '5 of 10 models left', text_de: '5 von 10 Modellen übrig', anchor: 'middle' },
            { x: 10, y: 4.6, text: '3 of 11 W left', text_de: '3 von 11 LP übrig', anchor: 'middle' }
          ]
        }, {
          type: 'dice',
          caption: 'The battle-shock rolls of the two units above: roll 2D6, add them up, compare with Ld.',
          caption_de: 'Die Kampfschockwürfe der beiden Einheiten oben: 2W6 werfen, addieren, mit dem Ld vergleichen.',
          rows: [
            { label: 'Squad, Ld 7+', label_de: 'Trupp, Ld 7+', dice: [3, 2], note: '3 + 2 = 5 – less than 7: battle-shocked', note_de: '3 + 2 = 5 – weniger als 7: kampfgeschockt' },
            { label: 'Tank, Ld 7+', label_de: 'Panzer, Ld 7+', dice: [4, 4], note: '4 + 4 = 8 – passed', note_de: '4 + 4 = 8 – geschafft' }
          ]
        }, {
          type: 'flow', dir: 'down',
          caption: 'What battle-shock does to the squad – until a later battle-shock roll succeeds.',
          caption_de: 'Was der Kampfschock mit dem Trupp macht – bis ein späterer Kampfschockwurf gelingt.',
          items: [
            { title: 'Battle-shocked', title_de: 'Kampfgeschockt', text: 'failed the roll', text_de: 'Wurf misslungen', kind: 'warn' },
            { title: 'OC becomes "–"', title_de: 'OC wird „–“', text: 'it can\'t hold objectives', text_de: 'hält keine Missionsziele', kind: 'bad' },
            { title: 'No stratagems on it', title_de: 'Keine Strategeme auf sie', text: 'you can\'t target it with yours', text_de: 'du kannst deine nicht auf sie einsetzen', kind: 'bad' },
            { title: 'No actions', title_de: 'Keine Aktionen', text: 'can\'t start or complete any', text_de: 'kann keine beginnen oder abschließen', kind: 'bad' },
            { title: 'Next Command phase', title_de: 'Nächste Kommandophase', text: 'roll again – success ends it', text_de: 'erneut würfeln – Erfolg beendet ihn', kind: 'ok' }
          ]
        }]
      }
    ]
  },

  // ───────────────────────── 4. Measuring, moving and staying together ─────────────────────────
  {
    id: 'moving-basics', part: 'basics',
    title: 'Measuring, moving and staying together', title_de: 'Messen, Bewegen und Zusammenbleiben',
    intro: 'How distances are measured, how models move, and why a unit stays one group and keeps clear of the enemy.',
    intro_de: 'Wie Entfernungen gemessen werden, wie Modelle sich bewegen und warum eine Einheit eine Gruppe bleibt und Abstand zum Feind hält.',
    steps: [
      {
        id: 'b-measure', title: 'Measuring distances', title_de: 'Entfernungen messen',
        text: '<p>All distances are in inches ("), and you may measure whenever you like.</p><p>Always measure between the <b>closest points of the bases</b>, never from the middle of a model. A model is <b>within</b> a distance if any part of its base is; a unit is within a distance if at least one of its models is.</p>',
        text_de: '<p>Alle Entfernungen sind in Zoll ("), und du darfst jederzeit messen.</p><p>Gemessen wird immer zwischen den <b>nächsten Punkten der Bases</b>, nie von der Mitte eines Modells. Ein Modell ist <b>innerhalb</b> einer Entfernung, wenn irgendein Teil seiner Base es ist; eine Einheit, wenn mindestens eines ihrer Modelle es ist.</p>',
        tips: ['Big bases matter: the edge of a 50 mm base is almost 1" from its centre.'],
        tips_de: ['Große Bases machen einen Unterschied: Der Rand einer 50-mm-Base liegt fast 1" von ihrer Mitte entfernt.'],
        refs: ['01.04'],
        diagrams: [{
          w: 12, h: 4,
          caption: 'The gap between these two models is 6" – measured edge to edge.',
          caption_de: 'Zwischen diesen beiden Modellen liegen 6" – gemessen von Rand zu Rand.',
          models: [{ x: 1.5, y: 1.8, side: 0 }, { x: 9.11, y: 1.8, side: 1, r: 0.98 }],
          lines: [{ from: [2.13, 1.8], to: [8.13, 1.8], kind: 'measure', label: '6"' }],
          notes: [{ x: 5.6, y: 3.4, text: 'from base edge to base edge', text_de: 'von Base-Rand zu Base-Rand', anchor: 'middle' }]
        }, {
          type: 'compare',
          caption: 'The same two models: they are 2" apart, not 3.3" – never measure from the middle of a base.',
          caption_de: 'Dieselben zwei Modelle: Sie sind 2" voneinander entfernt, nicht 3,3" – miss nie von der Mitte einer Base.',
          labels: [{ text: 'edge to edge: 2"', text_de: 'Rand zu Rand: 2"', kind: 'ok' }, { text: 'centre to centre', text_de: 'Mitte zu Mitte', kind: 'bad' }],
          items: [
            { w: 6, h: 3, models: [{ x: 1.4, y: 1.7, side: 0 }, { x: 4.66, y: 1.7, side: 1 }], lines: [{ from: [2.03, 1.7], to: [4.03, 1.7], kind: 'measure', label: '2"' }] },
            { w: 6, h: 3, models: [{ x: 1.4, y: 1.7, side: 0 }, { x: 4.66, y: 1.7, side: 1 }], lines: [{ from: [1.4, 1.7], to: [4.66, 1.7], kind: 'coherency-bad', label: '3.3"', label_de: '3,3"' }] }
          ]
        }]
      },
      {
        id: 'b-moving', title: 'Moving a model', title_de: 'Ein Modell bewegen',
        text: '<p>When a unit moves, you move its models one at a time. A model can go in straight lines and turn as often as you like:</p><ul><li>Add up all its straight lines – the total may not exceed the move\'s maximum distance.</li><li>Turning on the spot is free.</li><li>It may pass through friendly models, but never through enemy models or off the battlefield.</li><li>Climbing up or down terrain counts towards the distance.</li></ul><p>At the end the unit must be in coherency (see below), and no model may stand on another model or halfway inside a wall. If that doesn\'t work out, the whole move is taken back.</p>',
        text_de: '<p>Bewegt sich eine Einheit, bewegst du ihre Modelle einzeln nacheinander. Ein Modell darf in geraden Linien ziehen und sich beliebig oft drehen:</p><ul><li>Zähle alle Teilstrecken zusammen – die Summe darf die maximale Distanz der Bewegung nicht überschreiten.</li><li>Drehen auf der Stelle ist kostenlos.</li><li>Es darf durch befreundete Modelle hindurch, aber nie durch feindliche Modelle oder über den Spielfeldrand.</li><li>Hoch- und Runterklettern an Gelände zählt zur Distanz.</li></ul><p>Am Ende muss die Einheit kohärent sein (siehe unten), und kein Modell darf auf einem anderen oder halb in einer Wand stehen. Klappt das nicht, wird die ganze Bewegung zurückgenommen.</p>',
        refs: ['03', '03.01', '13.06'],
        diagrams: [{
          w: 10, h: 6,
          caption: 'Two straight lines of 3" each: this model has moved 6" in total.',
          caption_de: 'Zwei gerade Strecken von je 3": Dieses Modell hat sich insgesamt 6" bewegt.',
          models: [{ x: 1.5, y: 4.6, side: 0, ghost: true }, { x: 4.5, y: 4.6, side: 0, ghost: true }, { x: 6.62, y: 2.48, side: 0 }],
          arrows: [{ from: [1.5, 4.6], to: [4.5, 4.6], kind: 'move', label: '3"' }, { from: [4.5, 4.6], to: [6.62, 2.48], kind: 'move', label: '3"' }],
          notes: [{ x: 6.62, y: 1.4, text: 'total 6"', text_de: 'insgesamt 6"', anchor: 'middle' }]
        }, {
          type: 'compare',
          caption: 'A moving model may pass through friendly models, but never through enemy models.',
          caption_de: 'Ein Modell darf sich durch befreundete Modelle hindurchbewegen, aber nie durch feindliche.',
          labels: [{ text: 'through a friend', text_de: 'durch Befreundete', kind: 'ok' }, { text: 'through an enemy', text_de: 'durch Feinde', kind: 'bad' }],
          items: [
            {
              w: 7, h: 3.4,
              models: [{ x: 0.9, y: 1.7, side: 0, ghost: true }, { x: 3.5, y: 1.7, side: 0 }, { x: 6.1, y: 1.7, side: 0, mark: 'ok' }],
              arrows: [{ from: [0.9, 1.7], to: [5.4, 1.7], kind: 'move' }]
            },
            {
              w: 7, h: 3.4,
              models: [{ x: 0.9, y: 1.7, side: 0 }, { x: 3.5, y: 1.7, side: 1 }, { x: 6.1, y: 1.7, side: 0, ghost: true, mark: 'bad' }],
              arrows: [{ from: [0.9, 1.7], to: [5.4, 1.7], kind: 'shoot-blocked' }]
            }
          ]
        }]
      },
      {
        id: 'b-move-types', title: 'Normal move and advance', title_de: 'Normale Bewegung und Vorrücken',
        text: '<p>In the Movement phase each unit picks one <b>move type</b>:</p><ul><li><b>Remain stationary</b> – don\'t move.</li><li><b>Normal move</b> – up to M inches.</li><li><b>Advance</b> – roll a D6 and move up to M plus the roll. Afterwards the unit can\'t charge or start an action this turn, and can only shoot with [ASSAULT] weapons.</li><li><b>Fall back</b> – only for units in combat: up to M inches out of it.</li></ul>',
        text_de: '<p>In der Bewegungsphase wählt jede Einheit eine <b>Bewegungsart</b>:</p><ul><li><b>Stehen bleiben</b> – keine Bewegung.</li><li><b>Normale Bewegung</b> – bis zu M Zoll.</li><li><b>Vorrücken</b> – wirf einen W6 und bewege dich bis zu M plus Wurf. Danach darf die Einheit in diesem Zug keinen Angriff ansagen, keine Aktion beginnen und nur mit [ASSAULT]-Waffen schießen.</li><li><b>Zurückfallen</b> – nur für Einheiten im Nahkampf: bis zu M Zoll aus dem Kampf heraus.</li></ul>',
        refs: ['09.02', '09.04', '09.05', '09.06', '09.07', '10.04', '10.05'],
        diagrams: [{
          w: 14, h: 5.2,
          caption: 'Both models have M 6". The lower one advances and rolls a 4, so it may move up to 10".',
          caption_de: 'Beide Modelle haben M 6". Das untere rückt vor und würfelt eine 4 – es darf sich also bis zu 10" bewegen.',
          models: [
            { x: 1.2, y: 1.4, side: 0, ghost: true }, { x: 7.2, y: 1.4, side: 0 },
            { x: 1.2, y: 3.6, side: 0, ghost: true }, { x: 11.2, y: 3.6, side: 0 }
          ],
          arrows: [
            { from: [1.2, 1.4], to: [7.2, 1.4], kind: 'move', label: 'normal move 6"', label_de: 'normale Bewegung 6"' },
            { from: [1.2, 3.6], to: [11.2, 3.6], kind: 'advance', label: 'advance 6" + 4"', label_de: 'Vorrücken 6" + 4"' }
          ],
          notes: [{ x: 6.2, y: 4.85, text: 'then: no charge, no action', text_de: 'danach: kein Angriff, keine Aktion', anchor: 'middle' }]
        }, {
          type: 'dice',
          caption: 'The advance roll of the lower model: one D6, added to its M.',
          caption_de: 'Der Vorrückwurf des unteren Modells: ein W6, der zu seinem M addiert wird.',
          rows: [{ label: 'Advance roll', label_de: 'Vorrückwurf', dice: [4], note: 'M 6" + 4" = up to 10" this move', note_de: 'M 6" + 4" = bei dieser Bewegung bis zu 10"' }]
        }, {
          w: 12, h: 5.6,
          caption: 'Fall back: this model starts engaged (inside the enemy\'s 2" ring) and moves up to its M of 6" out of combat.',
          caption_de: 'Zurückfallen: Dieses Modell beginnt im Nahkampf (im 2"-Ring des Gegners) und bewegt sich bis zu seinem M von 6" aus dem Kampf.',
          rings: [{ x: 2.9, y: 2.8, r: 2.63, kind: 'engage' }],
          models: [{ x: 2.9, y: 2.8, side: 1 }, { x: 4.7, y: 2.8, side: 0, ghost: true }, { x: 10.7, y: 2.8, side: 0 }],
          arrows: [{ from: [4.7, 2.8], to: [10, 2.8], kind: 'fallback', label: 'fall back 6"', label_de: 'zurückfallen 6"' }],
          notes: [{ x: 10.7, y: 4.25, text: 'unengaged', text_de: 'nicht im Nahkampf', anchor: 'middle' }]
        }]
      },
      {
        id: 'b-coherency', title: 'Coherency', title_de: 'Kohärenz',
        text: '<p>A unit with more than one model must be set up and end every move as <b>one group</b>:</p><ul><li>each model within <b>2"</b> of at least one other model of its unit, and</li><li>each model within <b>9"</b> of every other model of its unit</li></ul><p>(measured horizontally; vertically up to 5"). If casualties leave a unit out of coherency, at the end of the turn its owner removes models until it is one group again – those count as destroyed.</p>',
        text_de: '<p>Eine Einheit aus mehreren Modellen muss als <b>eine Gruppe</b> aufgestellt werden und jede Bewegung so beenden:</p><ul><li>jedes Modell innerhalb von <b>2"</b> zu mindestens einem anderen Modell seiner Einheit und</li><li>jedes Modell innerhalb von <b>9"</b> zu allen anderen Modellen seiner Einheit</li></ul><p>(horizontal gemessen; vertikal bis 5"). Reißen Verluste die Einheit auseinander, entfernt ihr Besitzer am Zugende so lange Modelle, bis sie wieder eine Gruppe ist – diese gelten als vernichtet.</p>',
        tips: ['Keep big units in two or three rows, not one long line – the 9" rule breaks long chains.', 'Take casualties from the ends of your unit, not from the middle.'],
        tips_de: ['Stell große Einheiten in zwei, drei Reihen auf statt in einer langen Linie – die 9"-Regel zerreißt lange Ketten.', 'Entferne Verluste an den Enden deiner Einheit, nicht in der Mitte.'],
        refs: ['03.03', '03.03.01'],
        diagrams: [{
          type: 'compare',
          caption: 'Left: every model is within 2" of a neighbour. Right: the last model is more than 2" from every other model.',
          caption_de: 'Links: Jedes Modell ist innerhalb von 2" zu einem Nachbarn. Rechts: Das letzte Modell steht mehr als 2" von allen anderen entfernt.',
          labels: [{ text: 'in coherency', text_de: 'kohärent', kind: 'ok' }, { text: 'out of coherency', text_de: 'nicht kohärent', kind: 'bad' }],
          items: [
            {
              w: 7, h: 4,
              models: [{ x: 1.5, y: 2.2, side: 0 }, { x: 3.4, y: 1.4, side: 0 }, { x: 5.2, y: 2.6, side: 0 }],
              lines: [{ from: [2.08, 1.96], to: [2.82, 1.64], kind: 'coherency' }, { from: [3.92, 1.75], to: [4.68, 2.25], kind: 'coherency' }],
              notes: [{ x: 3.5, y: 3.75, text: '≤ 2" to a neighbour', text_de: '≤ 2" zum Nachbarn', anchor: 'middle' }]
            },
            {
              w: 7, h: 4,
              models: [{ x: 1.3, y: 2.2, side: 0 }, { x: 3.1, y: 1.6, side: 0 }, { x: 6.2, y: 3, side: 0, mark: 'bad' }],
              lines: [{ from: [1.9, 2], to: [2.5, 1.8], kind: 'coherency' }, { from: [3.67, 1.86], to: [5.63, 2.74], kind: 'coherency-bad', label: '> 2"' }],
              notes: [{ x: 3.5, y: 3.75, text: 'one model too far', text_de: 'ein Modell zu weit weg', anchor: 'middle' }]
            }
          ]
        }, {
          w: 14, h: 3.6,
          caption: 'The 9" rule: every model has a neighbour within 2", but the two end models are 10.1" apart – not in coherency.',
          caption_de: 'Die 9"-Regel: Jedes Modell hat einen Nachbarn innerhalb von 2", aber die beiden äußeren sind 10,1" voneinander entfernt – nicht kohärent.',
          models: [
            { x: 1, y: 1.3, side: 0 }, { x: 2.9, y: 1.3, side: 0 }, { x: 4.8, y: 1.3, side: 0 }, { x: 6.7, y: 1.3, side: 0 },
            { x: 8.6, y: 1.3, side: 0 }, { x: 10.5, y: 1.3, side: 0 }, { x: 12.4, y: 1.3, side: 0, mark: 'bad' }
          ],
          lines: [{ from: [1.63, 2.85], to: [11.77, 2.85], kind: 'coherency-bad', label: '10.1" – more than 9"', label_de: '10,1" – mehr als 9"' }]
        }, {
          type: 'compare',
          caption: 'A casualty from the middle splits the unit. At the end of the turn you remove models until it is one group again – here the lone model.',
          caption_de: 'Ein Verlust in der Mitte teilt die Einheit. Am Zugende entfernst du Modelle, bis sie wieder eine Gruppe ist – hier das einzelne Modell.',
          labels: [{ text: 'after a casualty', text_de: 'nach einem Verlust', kind: 'bad' }, { text: 'end of turn', text_de: 'Zugende', kind: 'ok' }],
          items: [
            {
              w: 7, h: 3,
              models: [{ x: 0.8, y: 1.4, side: 0, mark: 'bad' }, { x: 2.6, y: 1.4, side: 0, ghost: true, mark: 'dead' }, { x: 4.4, y: 1.4, side: 0 }, { x: 6.2, y: 1.4, side: 0 }],
              lines: [{ from: [1.43, 2.45], to: [3.77, 2.45], kind: 'coherency-bad', label: '2.3"', label_de: '2,3"' }]
            },
            {
              w: 7, h: 3,
              models: [{ x: 0.8, y: 1.4, side: 0, ghost: true, mark: 'dead' }, { x: 4.4, y: 1.4, side: 0 }, { x: 6.2, y: 1.4, side: 0, mark: 'ok' }]
            }
          ]
        }]
      },
      {
        id: 'b-engagement', title: 'Engagement range', title_de: 'Nahkampfreichweite',
        text: '<p>Every model has an <b>engagement range</b> of <b>2"</b> around it (5" vertically). As soon as one of your models is within engagement range of an enemy model, both units are <b>engaged</b> – locked in close combat. A unit with no engaged models is <b>unengaged</b>.</p><ul><li>Engaged units can\'t make normal moves or advance – only fall back.</li><li>You normally can\'t shoot at engaged enemy units.</li><li>Normal moves and advances must end unengaged; the usual way into combat is a charge.</li></ul>',
        text_de: '<p>Jedes Modell hat eine <b>Nahkampfreichweite</b> von <b>2"</b> um sich herum (vertikal 5"). Sobald eines deiner Modelle in Nahkampfreichweite eines feindlichen Modells ist, sind beide Einheiten <b>im Nahkampf</b> (engaged) – sie sind im Kampf gebunden. Eine Einheit ohne Modelle im Nahkampf ist <b>nicht im Nahkampf</b> (unengaged).</p><ul><li>Einheiten im Nahkampf können sich nicht normal bewegen oder vorrücken – nur zurückfallen.</li><li>Auf feindliche Einheiten im Nahkampf darfst du normalerweise nicht schießen.</li><li>Normale Bewegungen und Vorrücken müssen außerhalb des Nahkampfs enden; in den Kampf kommst du normalerweise per Angriff.</li></ul>',
        tips: ['Merely moving through an enemy\'s engagement range does not make your unit engaged – only where it stops counts.'],
        tips_de: ['Durch die Nahkampfreichweite eines Gegners hindurchzuziehen bindet deine Einheit nicht – es zählt nur, wo sie stehen bleibt.'],
        refs: ['03.04', '04.02', '09.05', '09.06', '09.07'],
        diagrams: [{
          w: 12, h: 7,
          caption: 'The dashed ring is 2" around the enemy base. The left model is inside it, so the two units are engaged.',
          caption_de: 'Der gestrichelte Ring liegt 2" um die feindliche Base. Das linke Modell steht darin – die beiden Einheiten sind im Nahkampf.',
          rings: [{ x: 7, y: 3.4, r: 2.63, kind: 'engage', label: 'engagement range 2"', label_de: 'Nahkampfreichweite 2"' }],
          models: [{ x: 7, y: 3.4, side: 1 }, { x: 4.24, y: 3.4, side: 0 }, { x: 10.6, y: 5.8, side: 0 }],
          lines: [{ from: [4.87, 3.4], to: [6.37, 3.4], kind: 'measure', label: '1.5"' }],
          notes: [
            { x: 4.24, y: 4.65, text: 'engaged', text_de: 'im Nahkampf', anchor: 'middle' },
            { x: 11.8, y: 6.85, text: 'unengaged', text_de: 'nicht im Nahkampf', anchor: 'end' }
          ]
        }, {
          type: 'compare',
          caption: 'A normal move or advance must end outside every enemy\'s 2" ring – getting into combat is what a charge is for.',
          caption_de: 'Eine normale Bewegung oder ein Vorrücken muss außerhalb des 2"-Rings jedes Gegners enden – in den Kampf kommst du per Angriff.',
          labels: [{ text: 'ends unengaged', text_de: 'endet außerhalb', kind: 'ok' }, { text: 'ends within 2"', text_de: 'endet innerhalb 2"', kind: 'bad' }],
          items: [
            {
              w: 9, h: 5.6,
              rings: [{ x: 6.2, y: 2.8, r: 2.63, kind: 'engage' }],
              models: [{ x: 6.2, y: 2.8, side: 1 }, { x: 0.8, y: 2.8, side: 0, ghost: true }, { x: 2.7, y: 2.8, side: 0, mark: 'ok' }],
              arrows: [{ from: [0.8, 2.8], to: [2, 2.8], kind: 'move' }]
            },
            {
              w: 9, h: 5.6,
              rings: [{ x: 6.2, y: 2.8, r: 2.63, kind: 'engage' }],
              models: [{ x: 6.2, y: 2.8, side: 1 }, { x: 0.8, y: 2.8, side: 0, ghost: true }, { x: 4.2, y: 2.8, side: 0, mark: 'bad' }],
              arrows: [{ from: [0.8, 2.8], to: [3.5, 2.8], kind: 'move' }]
            }
          ]
        }]
      }
    ]
  },

  // ───────────────────────── 5. Terrain ─────────────────────────
  {
    id: 'terrain', part: 'basics',
    title: 'The battlefield and terrain', title_de: 'Schlachtfeld und Gelände',
    intro: 'Ruins, woods and barricades are more than decoration – they slow some units down and hide others.',
    intro_de: 'Ruinen, Wälder und Barrikaden sind mehr als Deko – sie bremsen manche Einheiten und verbergen andere.',
    steps: [
      {
        id: 'b-terrain-areas', title: 'Terrain areas and categories', title_de: 'Geländebereiche und Kategorien',
        text: '<p>Each piece of terrain stands in a <b>terrain area</b>: a mat or base with features on it, or simply the ground a single feature covers. Agree on the areas before the battle if the mission doesn\'t show them.</p><p>Each feature belongs to one of three categories:</p><ul><li><b>Exposed</b> – craters, razorwire, debris. Barely in the way.</li><li><b>Light</b> – barricades, low walls, statues. Give cover, don\'t stop movement.</li><li><b>Dense</b> – buildings, ruins, containers, woods. Block sight and big models.</li></ul>',
        text_de: '<p>Jedes Geländestück steht in einem <b>Geländebereich</b> (terrain area): einer Matte oder Base mit Geländestücken darauf, oder einfach der Fläche, die ein einzelnes Stück bedeckt. Zeigt die Mission die Bereiche nicht, legt sie vor der Schlacht gemeinsam fest.</p><p>Jedes Geländestück gehört zu einer von drei Kategorien:</p><ul><li><b>Exposed</b> (offen) – Krater, Stacheldraht, Trümmer. Kaum ein Hindernis.</li><li><b>Light</b> (leicht) – Barrikaden, niedrige Mauern, Statuen. Geben Deckung, bremsen aber nicht.</li><li><b>Dense</b> (dicht) – Gebäude, Ruinen, Container, Wälder. Blockieren Sicht und große Modelle.</li></ul>',
        refs: ['13', '13.01', '13.02', '13.03', '13.04', '13.05'],
        diagrams: [{
          w: 14, h: 6,
          caption: 'Left: a terrain area (mat) with ruin walls – Dense. A crater is Exposed, a low wall Light, woods are Dense.',
          caption_de: 'Links: ein Geländebereich (Matte) mit Ruinenwänden – Dense. Ein Krater ist Exposed, eine niedrige Mauer Light, ein Wald Dense.',
          terrain: [
            { x: 0.4, y: 0.6, w: 5.2, h: 4.6, type: 'area', label: 'terrain area', label_de: 'Geländebereich', ly: 5.65 },
            { x: 1, y: 1.2, w: 3.6, h: 0.5, type: 'ruin', label: 'Dense', label_de: 'Dense', ly: 2.25 },
            { x: 1, y: 1.2, w: 0.5, h: 3.4, type: 'ruin' },
            { x: 7, y: 0.8, w: 2.6, h: 1.8, type: 'crater', label: 'Exposed', label_de: 'Exposed' },
            { x: 7, y: 3.9, w: 3.2, h: 0.4, type: 'wall', label: 'Light', label_de: 'Light', ly: 3.5 },
            { x: 11, y: 0.8, w: 2.6, h: 4.4, type: 'woods', label: 'Dense', label_de: 'Dense' }
          ]
        }, {
          type: 'table',
          caption: 'The three categories at a glance (details in the next steps).',
          caption_de: 'Die drei Kategorien auf einen Blick (Details in den nächsten Schritten).',
          head: ['', 'Who can move through', 'Area blocks sight'],
          head_de: ['', 'Wer kann hindurch', 'Bereich verdeckt Sicht'],
          rows: [
            ['Exposed (crater)', 'all models', '–'],
            ['Light (low wall)', 'all models', '✓'],
            ['Dense (ruin, woods)', 'INFANTRY; others only ≤ 2" high', '✓ and Solid']
          ],
          rows_de: [
            ['Exposed (Krater)', 'alle Modelle', '–'],
            ['Light (niedrige Mauer)', 'alle Modelle', '✓'],
            ['Dense (Ruine, Wald)', 'INFANTRY; andere nur ≤ 2" hoch', '✓ und Solid']
          ]
        }]
      },
      {
        id: 'b-terrain-moving', title: 'Moving through terrain', title_de: 'Durch Gelände bewegen',
        text: '<ul><li>Every model can move over and through <b>Exposed</b> and <b>Light</b> features.</li><li>INFANTRY (also BEASTS, SWARM) can move through <b>Dense</b> features – through walls and up and down floors.</li><li>Other models, such as VEHICLES and MONSTERS, can only cross parts of a Dense feature that are 2" high or lower; taller parts they have to go around.</li></ul><p>Only INFANTRY, BEASTS, SWARM, FLY and MONSTER models may end a move on an upper floor, and only if they stand stable without overhanging the edge.</p>',
        text_de: '<ul><li>Jedes Modell darf sich über und durch Geländestücke der Kategorien <b>Exposed</b> und <b>Light</b> bewegen.</li><li>INFANTRY (auch BEASTS, SWARM) darf sich durch <b>Dense</b>-Geländestücke bewegen – durch Wände und Stockwerke hinauf und hinunter.</li><li>Andere Modelle wie VEHICLES und MONSTERS können nur Abschnitte eines Dense-Geländestücks überqueren, die höchstens 2" hoch sind; um höhere müssen sie herum.</li></ul><p>Nur INFANTRY-, BEASTS-, SWARM-, FLY- und MONSTER-Modelle dürfen eine Bewegung in einem oberen Stockwerk beenden – und nur, wenn sie stabil stehen und nicht über die Kante ragen.</p>',
        tips: ['No model may end its move halfway inside a wall of a ruin – it has to stand clearly on one side.'],
        tips_de: ['Kein Modell darf seine Bewegung halb in einer Ruinenwand beenden – es muss klar auf einer Seite stehen.'],
        refs: ['13.06'],
        diagrams: [{
          w: 14, h: 7,
          caption: 'The INFANTRY model walks straight through the ruin wall. The VEHICLE can\'t – it has to drive around.',
          caption_de: 'Das INFANTRY-Modell geht direkt durch die Ruinenwand. Das VEHICLE kann das nicht – es muss außen herum fahren.',
          terrain: [{ x: 6.3, y: 0.2, w: 0.4, h: 3.5, type: 'ruin', label: 'wall > 2" high', label_de: 'Wand > 2" hoch', ly: 4.05 }],
          models: [
            { x: 3.6, y: 0.9, side: 0, ghost: true }, { x: 9.4, y: 0.9, side: 0 },
            { x: 3.2, y: 2.5, side: 0, shape: 'rect', rw: 2.2, rh: 1.3, ghost: true }, { x: 9.8, y: 2.5, side: 0, shape: 'rect', rw: 2.2, rh: 1.3 }
          ],
          arrows: [
            { from: [3.6, 0.9], to: [8.7, 0.9], kind: 'move', label: 'INFANTRY' },
            { from: [4.4, 2.5], to: [6.1, 2.5], kind: 'shoot-blocked', label: 'VEHICLE' },
            { from: [3.2, 3.2], via: [6.5, 7.4], to: [9.8, 3.2], kind: 'move' }
          ]
        }, {
          type: 'compare',
          caption: 'Seen from above: an INFANTRY model may end its move on an upper floor only if its whole base stands on it.',
          caption_de: 'Von oben gesehen: Ein INFANTRY-Modell darf seine Bewegung nur dann in einem oberen Stockwerk beenden, wenn seine ganze Base darauf steht.',
          labels: [{ text: 'stands on the floor', text_de: 'steht auf dem Boden', kind: 'ok' }, { text: 'overhangs the edge', text_de: 'ragt über die Kante', kind: 'bad' }],
          items: [
            { w: 6, h: 4, terrain: [{ x: 0.5, y: 0.6, w: 4.4, h: 2.8, type: 'ruin', label: 'upper floor', label_de: 'oberes Stockwerk', ly: 3.05 }], models: [{ x: 2.7, y: 1.7, side: 0, mark: 'ok' }] },
            { w: 6, h: 4, terrain: [{ x: 0.5, y: 0.6, w: 4.4, h: 2.8, type: 'ruin', label: 'upper floor', label_de: 'oberes Stockwerk', ly: 3.05 }], models: [{ x: 4.9, y: 1.7, side: 0, mark: 'bad' }] }
          ]
        }]
      }
    ]
  },

  // ───────────────────────── 6. Seeing the enemy ─────────────────────────
  {
    id: 'seeing', part: 'basics',
    title: 'Seeing the enemy and cover', title_de: 'Sichtlinie und Deckung',
    intro: 'Who can see whom, how terrain blocks sight, and how it protects your units from enemy fire.',
    intro_de: 'Wer wen sehen kann, wie Gelände die Sicht blockiert und wie es deine Einheiten vor Beschuss schützt.',
    steps: [
      {
        id: 'b-los', title: 'Line of sight', title_de: 'Sichtlinie',
        text: '<p>To shoot, a model must be able to <b>see</b> its target. Bend down and look from behind your model: if you can draw a straight line from any part of it to any part of an enemy model, that model is <b>visible</b>. Models in the shooting unit and in the target unit don\'t block the view; everything else can.</p><p>A model is <b>fully visible</b> if you can see every part of it that faces you. A unit is visible if at least one of its models is, and fully visible only if all of them are.</p>',
        text_de: '<p>Um zu schießen, muss ein Modell sein Ziel <b>sehen</b>. Geh in die Knie und schau hinter deinem Modell hervor: Kannst du eine gerade Linie von irgendeinem Teil davon zu irgendeinem Teil eines feindlichen Modells ziehen, ist dieses Modell <b>sichtbar</b>. Modelle der schießenden Einheit und der Zieleinheit verdecken nichts; alles andere schon.</p><p>Ein Modell ist <b>vollständig sichtbar</b>, wenn du jeden Teil siehst, der dir zugewandt ist. Eine Einheit ist sichtbar, wenn mindestens eines ihrer Modelle es ist, und vollständig sichtbar nur, wenn alle es sind.</p>',
        refs: ['06.01', '06.01.01'],
        diagrams: [{
          w: 13, h: 6,
          caption: 'The upper enemy is visible. Every line to the lower one runs into the ruin wall – it is not visible.',
          caption_de: 'Der obere Gegner ist sichtbar. Jede Linie zum unteren endet an der Ruinenwand – er ist nicht sichtbar.',
          terrain: [{ x: 7.5, y: 2.6, w: 0.5, h: 3.4, type: 'ruin', label: 'ruin', label_de: 'Ruine', ly: 5.6 }],
          models: [{ x: 1.5, y: 3, side: 0 }, { x: 11, y: 1.2, side: 1, mark: 'ok' }, { x: 11, y: 4.8, side: 1, mark: 'bad' }],
          lines: [{ from: [2.1, 2.8], to: [10.4, 1.4], kind: 'los' }, { from: [2.1, 3.2], to: [10.4, 4.6], kind: 'los-blocked' }]
        }, {
          type: 'compare',
          caption: 'Models of the shooting unit and of the target unit never block the view. Any other model – like this tank – or terrain can.',
          caption_de: 'Modelle der schießenden Einheit und der Zieleinheit verdecken nie die Sicht. Jedes andere Modell – wie dieser Panzer – oder Gelände schon.',
          labels: [{ text: 'own squad in the way', text_de: 'eigener Trupp im Weg', kind: 'ok' }, { text: 'another unit in the way', text_de: 'andere Einheit im Weg', kind: 'bad' }],
          items: [
            {
              w: 8, h: 4,
              models: [{ x: 1, y: 2, side: 0 }, { x: 3.8, y: 2, side: 0 }, { x: 3.8, y: 3.3, side: 0 }, { x: 7, y: 2, side: 1, mark: 'ok' }],
              lines: [{ from: [1.63, 2], to: [6.37, 2], kind: 'los' }]
            },
            {
              w: 8, h: 4,
              models: [{ x: 1, y: 2, side: 0 }, { x: 4, y: 2, side: 0, shape: 'rect', rw: 1.8, rh: 3.6 }, { x: 7, y: 2, side: 1, mark: 'bad' }],
              lines: [{ from: [1.63, 2], to: [6.37, 2], kind: 'los-blocked' }]
            }
          ]
        }]
      },
      {
        id: 'b-obscuring', title: 'Terrain blocks sight', title_de: 'Gelände verdeckt die Sicht',
        text: '<p>Terrain areas with Light or Dense features are <b>Obscuring</b>: if every line between two models crosses such an area, they can\'t see each other – even if the model kit has gaps. An area that one of the two models stands in doesn\'t count, so you can see into and out of the area you are in.</p><p>Dense features are also <b>Solid</b>: you can\'t see through doors, windows or holes in them up to 3" above the ground.</p>',
        text_de: '<p>Geländebereiche mit Light- oder Dense-Geländestücken sind <b>Obscuring</b> (verdeckend): Kreuzt jede Linie zwischen zwei Modellen einen solchen Bereich, sehen sie sich nicht – auch wenn das Geländemodell Lücken hat. Ein Bereich, in dem eines der beiden Modelle steht, zählt nicht mit – du kannst also in deinen Bereich hinein und aus ihm heraus sehen.</p><p>Dense-Geländestücke sind außerdem <b>Solid</b> (massiv): Durch Türen, Fenster oder Löcher bis 3" über dem Boden sieht man nicht hindurch.</p>',
        tips: ['Look at the terrain area\'s outline on the table, not at the shape of the ruin – the area is what blocks sight.'],
        tips_de: ['Achte auf die Umrisse des Geländebereichs auf dem Tisch, nicht auf die Form der Ruine – der Bereich blockiert die Sicht.'],
        refs: ['13.07', '13.10', '13.11'],
        diagrams: [{
          w: 14, h: 6,
          caption: 'The enemy inside the ruin\'s terrain area can be seen. The one behind it can\'t: every line crosses the area.',
          caption_de: 'Der Gegner im Geländebereich der Ruine ist sichtbar. Der dahinter nicht: Jede Linie kreuzt den Bereich.',
          terrain: [{ x: 5, y: 1.2, w: 4, h: 3.6, type: 'ruin', label: 'terrain area', label_de: 'Geländebereich', ly: 4.35 }],
          models: [{ x: 1.5, y: 3, side: 0 }, { x: 7.6, y: 2, side: 1, mark: 'ok' }, { x: 12.5, y: 3, side: 1, mark: 'bad' }],
          lines: [{ from: [2.1, 2.85], to: [7.0, 2.15], kind: 'los' }, { from: [2.1, 3.4], to: [11.9, 3.4], kind: 'los-blocked' }]
        }, {
          type: 'compare',
          caption: 'The area your own model stands in never blocks its view – an area between the two models does.',
          caption_de: 'Der Bereich, in dem dein eigenes Modell steht, blockiert nie seine Sicht – ein Bereich zwischen den beiden Modellen schon.',
          labels: [{ text: 'seeing out of your area', text_de: 'aus dem eigenen Bereich heraus', kind: 'ok' }, { text: 'area in between', text_de: 'Bereich dazwischen', kind: 'bad' }],
          items: [
            {
              w: 8, h: 4.4,
              terrain: [{ x: 0.3, y: 0.6, w: 3.6, h: 3.2, type: 'ruin' }],
              models: [{ x: 1.8, y: 2.2, side: 0 }, { x: 7, y: 2.2, side: 1, mark: 'ok' }],
              lines: [{ from: [2.43, 2.2], to: [6.37, 2.2], kind: 'los' }]
            },
            {
              w: 8, h: 4.4,
              terrain: [{ x: 2.8, y: 0.6, w: 2.4, h: 3.2, type: 'ruin' }],
              models: [{ x: 1, y: 2.2, side: 0 }, { x: 7, y: 2.2, side: 1, mark: 'bad' }],
              lines: [{ from: [1.63, 2.2], to: [6.37, 2.2], kind: 'los-blocked' }]
            }
          ]
        }]
      },
      {
        id: 'b-cover', title: 'Benefit of cover', title_de: 'Deckung',
        text: '<p>A unit you shoot at has the <b>benefit of cover</b> if <b>every</b> model in it either</p><ul><li>is INFANTRY (or BEASTS, SWARM) and stands in a terrain area, or</li><li>is not fully visible to the shooting model because of terrain in between.</li></ul><p>Cover makes the shot harder: the attack\'s <b>BS gets worse by 1</b> (a 3+ becomes a 4+).</p>',
        text_de: '<p>Eine Einheit, auf die du schießt, hat <b>Deckung</b> (benefit of cover), wenn <b>jedes</b> ihrer Modelle entweder</p><ul><li>INFANTRY (oder BEASTS, SWARM) ist und in einem Geländebereich steht, oder</li><li>wegen Gelände dazwischen für das schießende Modell nicht vollständig sichtbar ist.</li></ul><p>Deckung erschwert den Schuss: Die <b>BS des Angriffs verschlechtert sich um 1</b> (aus 3+ wird 4+).</p>',
        tips: ['One model sticking out of the terrain area is enough to lose cover for the whole unit.', 'Weapons with [IGNORES COVER] ignore all of this.'],
        tips_de: ['Ein einziges Modell außerhalb des Geländebereichs kostet die ganze Einheit die Deckung.', 'Waffen mit [IGNORES COVER] ignorieren das alles.'],
        refs: ['13.08', '24.18'],
        diagrams: [{
          w: 14, h: 9,
          caption: 'All INFANTRY. B stands fully in a ruin: cover. One model of C stands outside its ruin: no cover. D is partly hidden by a low wall: cover.',
          caption_de: 'Alles INFANTRY. B steht ganz in einer Ruine: Deckung. Ein Modell von C steht außerhalb seiner Ruine: keine Deckung. D ist teils von einer niedrigen Mauer verdeckt: Deckung.',
          terrain: [
            { x: 8, y: 0.3, w: 5.6, h: 2.4, type: 'ruin' },
            { x: 8, y: 3.3, w: 3.4, h: 2.4, type: 'ruin' },
            { x: 7.6, y: 6.4, w: 0.4, h: 2.4, type: 'wall' }
          ],
          models: [
            { x: 1.2, y: 4.5, side: 0 },
            { x: 9.2, y: 1.5, side: 1, label: 'B', mark: 'cover' }, { x: 10.8, y: 1.5, side: 1, label: 'B' }, { x: 12.4, y: 1.5, side: 1, label: 'B' },
            { x: 9.2, y: 4.5, side: 1, label: 'C' }, { x: 10.6, y: 4.5, side: 1, label: 'C' }, { x: 12.4, y: 4.5, side: 1, label: 'C', mark: 'bad' },
            { x: 10, y: 7.8, side: 1, label: 'D', mark: 'cover' }, { x: 11.4, y: 7.8, side: 1, label: 'D' }
          ],
          arrows: [
            { from: [1.8, 4.2], to: [8.4, 1.7], kind: 'shoot' },
            { from: [1.85, 4.5], to: [8.4, 4.5], kind: 'shoot' },
            { from: [1.8, 4.8], to: [9.3, 7.6], kind: 'shoot' }
          ],
          notes: [
            { x: 13.8, y: 3.1, text: 'B: cover', text_de: 'B: Deckung', anchor: 'end' },
            { x: 13.8, y: 6.15, text: 'C: no cover', text_de: 'C: keine Deckung', anchor: 'end' },
            { x: 7.8, y: 6.15, text: 'low wall', text_de: 'niedrige Mauer', anchor: 'middle' },
            { x: 13.8, y: 8.9, text: 'D: cover', text_de: 'D: Deckung', anchor: 'end' }
          ]
        }, {
          type: 'dice',
          caption: 'The same six hit rolls: against a target in cover, BS 3+ becomes 4+ and two hits are lost.',
          caption_de: 'Dieselben sechs Trefferwürfe: Gegen ein Ziel in Deckung wird aus BS 3+ ein 4+ – zwei Treffer gehen verloren.',
          rows: [
            { label: 'No cover: BS 3+', label_de: 'Ohne Deckung: BS 3+', dice: [2, 3, 3, 4, 5, 6], need: 3, note: '5 hits', note_de: '5 Treffer' },
            { label: 'Cover: BS 4+', label_de: 'Deckung: BS 4+', dice: [2, 3, 3, 4, 5, 6], need: 4, note: '3 hits', note_de: '3 Treffer' }
          ]
        }]
      },
      {
        id: 'b-hidden', title: 'Hidden', title_de: 'Hidden (versteckt)',
        text: '<p>INFANTRY (also BEASTS, SWARM) in a terrain area with Light or Dense features are <b>hidden</b> as long as their unit hasn\'t made ranged attacks this turn or in the previous turn. Hidden models can only be seen by enemy models within <b>15"</b> (their detection range).</p><p>If a hidden model is also partly behind Dense terrain from the shooter\'s point of view, it has <b>gone to ground</b>: the detection range drops to 12".</p>',
        text_de: '<p>INFANTRY (auch BEASTS, SWARM) in einem Geländebereich mit Light- oder Dense-Geländestücken ist <b>hidden</b> (versteckt), solange ihre Einheit in diesem und im vorigen Zug keine Fernkampfangriffe gemacht hat. Versteckte Modelle können nur von feindlichen Modellen innerhalb von <b>15"</b> gesehen werden (ihre Entdeckungsreichweite).</p><p>Ist ein verstecktes Modell aus Sicht des Schützen zusätzlich teilweise von Dense-Gelände verdeckt, hat es sich <b>Gone to Ground</b> (in Deckung geworfen): Die Entdeckungsreichweite sinkt auf 12".</p>',
        tips: ['Shooting gives you away: a unit that fires is not hidden until the end of the next turn.', 'In the very first turn of the battle, "did not shoot in the previous turn" counts as true.'],
        tips_de: ['Schießen verrät dich: Eine Einheit, die feuert, ist bis zum Ende des nächsten Zuges nicht versteckt.', 'Im allerersten Zug der Schlacht gilt „hat im vorigen Zug nicht geschossen“ als erfüllt.'],
        refs: ['13.09', '13.09.01', '13.11.01'],
        diagrams: [{
          w: 16.5, h: 5,
          caption: 'Your INFANTRY in the ruin is hidden. This enemy is 13" away – within 15", so it can see it. From more than 15" it couldn\'t.',
          caption_de: 'Deine INFANTRY in der Ruine ist versteckt. Dieser Gegner ist 13" entfernt – innerhalb von 15", er sieht sie also. Aus mehr als 15" könnte er es nicht.',
          terrain: [{ x: 0.3, y: 0.8, w: 3.4, h: 3.4, type: 'ruin' }],
          models: [{ x: 1.6, y: 2.5, side: 0 }, { x: 15.86, y: 2.5, side: 1, mark: 'ok' }],
          lines: [{ from: [2.23, 2.5], to: [15.23, 2.5], kind: 'measure', label: '13" – within 15"', label_de: '13" – innerhalb 15"' }],
          notes: [
            { x: 2, y: 4.75, text: 'hidden', text_de: 'versteckt', anchor: 'middle' },
            { x: 15.86, y: 3.95, text: 'sees it', text_de: 'sieht sie', anchor: 'middle' }
          ]
        }, {
          w: 16.5, h: 5,
          caption: 'Now a Dense ruin wall partly hides your model as well: it has gone to ground, detection range 12". From 13" the enemy can no longer see it.',
          caption_de: 'Jetzt verdeckt zusätzlich eine Dense-Ruinenwand dein Modell teilweise: Es hat sich in Deckung geworfen, Entdeckungsreichweite 12". Aus 13" sieht der Gegner es nicht mehr.',
          terrain: [{ x: 0.3, y: 0.8, w: 3.4, h: 3.4, type: 'ruin' }, { x: 2.6, y: 1.3, w: 0.35, h: 1.6, type: 'wall' }],
          models: [{ x: 1.6, y: 2.5, side: 0 }, { x: 15.86, y: 2.5, side: 1, mark: 'bad' }],
          lines: [{ from: [2.23, 2.5], to: [15.23, 2.5], kind: 'measure', label: '13" – more than 12"', label_de: '13" – mehr als 12"' }],
          notes: [
            { x: 2, y: 4.75, text: 'gone to ground', text_de: 'in Deckung geworfen', anchor: 'middle' },
            { x: 16.4, y: 3.95, text: 'can\'t see it', text_de: 'sieht sie nicht', anchor: 'end' }
          ]
        }, {
          type: 'compare',
          caption: 'The same unit in the same ruin: once it has made ranged attacks this turn or in the previous turn, it is not hidden.',
          caption_de: 'Dieselbe Einheit in derselben Ruine: Sobald sie in diesem oder im vorigen Zug Fernkampfangriffe gemacht hat, ist sie nicht versteckt.',
          labels: [{ text: 'held its fire: hidden', text_de: 'nicht geschossen: versteckt', kind: 'ok' }, { text: 'fired: not hidden', text_de: 'geschossen: nicht versteckt', kind: 'bad' }],
          items: [
            { w: 7, h: 3.6, terrain: [{ x: 0.3, y: 0.3, w: 3.2, h: 3, type: 'ruin' }], models: [{ x: 1.9, y: 1.8, side: 0, mark: 'cover' }] },
            { w: 7, h: 3.6, terrain: [{ x: 0.3, y: 0.3, w: 3.2, h: 3, type: 'ruin' }], models: [{ x: 1.9, y: 1.8, side: 0, mark: 'bad' }], arrows: [{ from: [2.6, 1.8], to: [6.7, 1.8], kind: 'shoot' }] }
          ]
        }]
      }
    ]
  },

  // ───────────────────────── 7. Making attacks ─────────────────────────
  {
    id: 'attacking', part: 'basics',
    title: 'Making attacks', title_de: 'Angriffe durchführen',
    intro: 'Shooting and fighting use the same steps: choose weapons and targets, then roll to hit, to wound and to save.',
    intro_de: 'Schießen und Kämpfen laufen gleich ab: Waffen und Ziele wählen, dann für Treffer, Verwundung und Schutz würfeln.',
    steps: [
      {
        id: 'b-targets', title: 'Weapons and targets', title_de: 'Waffen und Ziele',
        text: '<p>When a unit shoots or fights:</p><ul><li><b>Select weapons</b> – shooting: each model may use one or more of its ranged weapons. Fighting: each model picks exactly one melee weapon.</li><li><b>Select targets</b> – a ranged weapon\'s target must be <b>visible</b>, <b>within range</b> and <b>unengaged</b>. A melee weapon\'s target must be engaged with the attacking model.</li><li><b>Resolve attacks</b> – gather one dice per attack and roll them as described next. Identical weapons against the same target are rolled together.</li></ul><p>Different weapons may pick different targets.</p>',
        text_de: '<p>Wenn eine Einheit schießt oder kämpft:</p><ul><li><b>Waffen wählen</b> – beim Schießen darf jedes Modell eine oder mehrere seiner Fernkampfwaffen nutzen. Im Nahkampf wählt jedes Modell genau eine Nahkampfwaffe.</li><li><b>Ziele wählen</b> – das Ziel einer Fernkampfwaffe muss <b>sichtbar</b>, <b>in Reichweite</b> und <b>nicht im Nahkampf</b> sein. Das Ziel einer Nahkampfwaffe muss mit dem angreifenden Modell im Nahkampf sein.</li><li><b>Angriffe abhandeln</b> – nimm einen Würfel pro Attacke und würfle wie im nächsten Schritt beschrieben. Gleiche Waffen gegen dasselbe Ziel werden zusammen geworfen.</li></ul><p>Verschiedene Waffen dürfen verschiedene Ziele wählen.</p>',
        refs: ['04', '04.01', '04.02', '04.03'],
        diagrams: [{
          w: 13, h: 8.4,
          caption: 'Only A is a legal target: B is behind the ruin wall, C is engaged with another of your units.',
          caption_de: 'Nur A ist ein gültiges Ziel: B steht hinter der Ruinenwand, C ist mit einer anderen deiner Einheiten im Nahkampf.',
          terrain: [{ x: 6.5, y: 2.6, w: 0.5, h: 4, type: 'ruin' }],
          models: [
            { x: 1.4, y: 3.4, side: 0 }, { x: 1.4, y: 4.8, side: 0 },
            { x: 9, y: 1.2, side: 1, label: 'A', mark: 'ok' }, { x: 10.4, y: 1.2, side: 1, label: 'A' },
            { x: 10, y: 4.2, side: 1, label: 'B', mark: 'bad' }, { x: 11.4, y: 4.2, side: 1, label: 'B' },
            { x: 10, y: 7, side: 1, label: 'C', mark: 'bad' }, { x: 12.26, y: 7, side: 0 }
          ],
          arrows: [
            { from: [2, 3.2], to: [8.4, 1.4], kind: 'shoot' },
            { from: [2, 4.4], to: [9.3, 4.2], kind: 'shoot-blocked' },
            { from: [2, 5.2], to: [9.4, 6.9], kind: 'shoot-blocked' }
          ],
          notes: [
            { x: 9.7, y: 2.35, text: 'visible, in range', text_de: 'sichtbar, in Reichweite', anchor: 'middle' },
            { x: 10.7, y: 5.4, text: 'not visible', text_de: 'nicht sichtbar', anchor: 'middle' },
            { x: 10, y: 8.25, text: 'engaged', text_de: 'im Nahkampf', anchor: 'middle' }
          ]
        }, {
          type: 'flow', dir: 'right',
          caption: 'The three steps whenever a unit shoots or fights.',
          caption_de: 'Die drei Schritte, wann immer eine Einheit schießt oder kämpft.',
          items: [
            { title: '1. Weapons', title_de: '1. Waffen', text: 'which weapons attack', text_de: 'welche Waffen angreifen', kind: 'you' },
            { title: '2. Targets', title_de: '2. Ziele', text: 'visible, in range, unengaged', text_de: 'sichtbar, in Reichweite, nicht im Nahkampf', kind: 'you' },
            { title: '3. Roll', title_de: '3. Würfeln', text: 'hit, wound, save, damage', text_de: 'treffen, verwunden, schützen, Schaden', kind: 'bad' }
          ]
        }]
      },
      {
        id: 'b-hit-wound', title: 'Hit and wound rolls', title_de: 'Treffer- und Verwundungswürfe',
        text: '<p><b>Hit roll</b>: roll one D6 per attack. Equal to or higher than the weapon\'s BS (shooting) or WS (melee) is a hit.</p><p><b>Wound roll</b>: roll one D6 per hit and compare the weapon\'s S with the target\'s T:</p><ul><li>S at least double T: <b>2+</b></li><li>S greater than T: <b>3+</b></li><li>S equal to T: <b>4+</b></li><li>S less than T: <b>5+</b></li><li>S half of T or less: <b>6+</b></li></ul><p>In both rolls an unmodified 1 always fails, and an unmodified 6 is a <b>critical</b> hit or wound – it always succeeds and triggers abilities like [LETHAL HITS] or [DEVASTATING WOUNDS].</p>',
        text_de: '<p><b>Trefferwurf</b>: ein W6 pro Attacke. Gleich oder höher als die BS (Fernkampf) bzw. WS (Nahkampf) der Waffe ist ein Treffer.</p><p><b>Verwundungswurf</b>: ein W6 pro Treffer; vergleiche die S der Waffe mit dem T des Ziels:</p><ul><li>S mindestens doppelt so hoch wie T: <b>2+</b></li><li>S höher als T: <b>3+</b></li><li>S gleich T: <b>4+</b></li><li>S niedriger als T: <b>5+</b></li><li>S höchstens halb so hoch wie T: <b>6+</b></li></ul><p>Bei beiden Würfen scheitert eine unmodifizierte 1 immer, und eine unmodifizierte 6 ist ein <b>kritischer</b> Treffer bzw. eine kritische Verwundung – sie gelingt immer und löst Fähigkeiten wie [LETHAL HITS] oder [DEVASTATING WOUNDS] aus.</p>',
        refs: ['05', '05.01', '05.01.01', '05.02'],
        tips: ['Remember cover: if the target has it, your BS is 1 worse.'],
        tips_de: ['Denk an Deckung: Hat das Ziel Deckung, ist deine BS um 1 schlechter.'],
        diagrams: [
          {
            type: 'dice',
            caption: 'Ten attacks with BS 3+: 3 or more hits. Gold = unmodified 6, a critical hit.',
            caption_de: 'Zehn Attacken mit BS 3+: 3 oder mehr trifft. Gold = unmodifizierte 6, ein kritischer Treffer.',
            rows: [{ label: 'Hit rolls, BS 3+', label_de: 'Trefferwürfe, BS 3+', dice: [1, 2, 3, 3, 4, 4, 5, 6, 6, 2], need: 3, crit: 6, note: '7 hits – 2 of them critical', note_de: '7 Treffer – 2 davon kritisch' }]
          },
          {
            type: 'table',
            caption: 'Wound roll needed: find the weapon\'s S (row) and the target\'s T (column). S 4 against T 4 needs a 4+.',
            caption_de: 'Benötigter Verwundungswurf: S der Waffe (Zeile) und T des Ziels (Spalte) suchen. S 4 gegen T 4 braucht eine 4+.',
            head: ['', 'T 3', 'T 4', 'T 5', 'T 8'],
            rows: [
              ['S 3', '4+', '5+', '5+', '6+'],
              ['S 4', '3+', '4+', '5+', '6+'],
              ['S 5', '3+', '3+', '4+', '5+'],
              ['S 8', '2+', '2+', '3+', '4+'],
              ['S 10', '2+', '2+', '2+', '3+']
            ],
            hl: [[1, 2]]
          },
          {
            type: 'dice',
            caption: 'The 7 hits roll to wound: S 4 against T 4 needs a 4+.',
            caption_de: 'Die 7 Treffer würfeln auf Verwundung: S 4 gegen T 4 braucht eine 4+.',
            rows: [{ label: 'Wound rolls, 4+', label_de: 'Verwundungswürfe, 4+', dice: [1, 3, 4, 4, 5, 6, 2], need: 4, crit: 6, note: '4 wounds – 1 of them critical', note_de: '4 Verwundungen – 1 davon kritisch' }]
          }
        ]
      },
      {
        id: 'b-saves', title: 'Saves and damage', title_de: 'Schutzwürfe und Schaden',
        text: '<p>Now the defender rolls one D6 per wound – the <b>save roll</b>. Take the result and apply the weapon\'s AP: AP -1 turns a 4 into a 3. If it still reaches the model\'s Sv, the attack is stopped. A model with an invulnerable save checks the unchanged roll against it first – AP doesn\'t affect that. An unmodified 1 never saves.</p><p>Each attack that gets through makes one model lose wounds equal to the weapon\'s D. Damage always goes to a model that is already wounded first, and CHARACTER models in the unit come last. Leftover damage from one attack does not carry over to the next model.</p>',
        text_de: '<p>Jetzt wirft der Verteidiger einen W6 pro Verwundung – den <b>Schutzwurf</b>. Auf das Ergebnis wird der DS (AP) der Waffe angewendet: AP -1 macht aus einer 4 eine 3. Erreicht es dann noch den Sv des Modells, ist der Angriff abgewehrt. Ein Modell mit Rettungswurf prüft das unveränderte Ergebnis zuerst gegen diesen – AP wirkt darauf nicht. Eine unmodifizierte 1 rettet nie.</p><p>Jeder Angriff, der durchkommt, lässt ein Modell so viele Lebenspunkte verlieren, wie der D der Waffe angibt. Schaden geht immer zuerst an ein bereits verwundetes Modell, CHARACTER-Modelle der Einheit kommen zuletzt dran. Überschüssiger Schaden eines Angriffs springt nicht auf das nächste Modell über.</p>',
        tips: ['The defender rolls all saves at once and resolves them from the lowest result up.'],
        tips_de: ['Der Verteidiger wirft alle Schutzwürfe auf einmal und handelt sie vom niedrigsten Ergebnis aufwärts ab.'],
        refs: ['05.03', '05.03.01', '05.04'],
        diagrams: [{
          type: 'table',
          caption: 'The dice result a save needs after AP. Sv 3+ against AP -1: you need a 4 (a 4 becomes a 3). "–" = no save possible.',
          caption_de: 'Das Würfelergebnis, das ein Rüstungswurf nach AP braucht. Sv 3+ gegen AP -1: Du brauchst eine 4 (aus 4 wird 3). „–“ = kein Rüstungswurf möglich.',
          head: ['', 'AP 0', 'AP -1', 'AP -2', 'AP -3'],
          rows: [
            ['Sv 2+', '2+', '3+', '4+', '5+'],
            ['Sv 3+', '3+', '4+', '5+', '6+'],
            ['Sv 4+', '4+', '5+', '6+', '–'],
            ['Sv 5+', '5+', '6+', '–', '–']
          ],
          hl: [[1, 2]]
        }, {
          type: 'dice',
          caption: 'The same six dice against AP -2: armour (Sv 3+) needs 5+ and saves 2; an invulnerable save of 4+ ignores AP and saves 4.',
          caption_de: 'Dieselben sechs Würfel gegen AP -2: Die Rüstung (Sv 3+) braucht 5+ und rettet 2; ein Rettungswurf von 4+ ignoriert AP und rettet 4.',
          rows: [
            { label: 'Sv 3+ with AP -2 → 5+', label_de: 'Sv 3+ mit AP -2 → 5+', dice: [1, 2, 4, 4, 5, 6], need: 5, note: '2 saved, 4 get through', note_de: '2 abgewehrt, 4 kommen durch' },
            { label: 'Invulnerable save 4+', label_de: 'Rettungswurf 4+', dice: [1, 2, 4, 4, 5, 6], need: 4, note: '4 saved, 2 get through', note_de: '4 abgewehrt, 2 kommen durch' }
          ]
        }, {
          w: 10, h: 4.5,
          caption: 'Numbers = wounds left. The next damage must go to the wounded model; the CHARACTER is last.',
          caption_de: 'Zahlen = verbleibende Lebenspunkte. Der nächste Schaden muss an das verwundete Modell; das CHARACTER-Modell kommt zuletzt.',
          models: [
            { x: 1.3, y: 2, side: 1, label: '2' }, { x: 2.7, y: 2, side: 1, label: '2' }, { x: 4.1, y: 2, side: 1, label: '1', mark: 'target' },
            { x: 5.5, y: 2, side: 1, label: '2' }, { x: 7.4, y: 2, side: 1, r: 0.79, label: 'CH' }
          ],
          notes: [
            { x: 4.1, y: 3.6, text: 'first', text_de: 'zuerst', anchor: 'middle' },
            { x: 7.4, y: 3.6, text: 'last', text_de: 'zuletzt', anchor: 'middle' }
          ]
        }]
      },
      {
        id: 'b-attack-example', title: 'A worked example', title_de: 'Ein Rechenbeispiel',
        text: '<p>Ten bolt rifles shoot at Space Marines: <b>10 attacks</b>, BS 3+, S 4, AP -1, D 1 against T 4, Sv 3+.</p><ul><li><b>Hit</b> on 3+ (4 of 6 results): about <b>6.7 hits</b>.</li><li><b>Wound</b>: S 4 equals T 4, so 4+ (half): about <b>3.3 wounds</b>.</li><li><b>Save</b>: AP -1 means the defender needs a 4 to make the 3+ – half fail: about <b>1.7 damage</b>.</li></ul><p>So on average fewer than two wounds get through. If the target had cover, BS 4+ would mean only 5 hits and about 1.25 damage.</p>',
        text_de: '<p>Zehn Boltgewehre schießen auf Space Marines: <b>10 Attacken</b>, BS 3+, S 4, AP -1, D 1 gegen T 4, Sv 3+.</p><ul><li><b>Treffer</b> bei 3+ (4 von 6 Ergebnissen): etwa <b>6,7 Treffer</b>.</li><li><b>Verwundung</b>: S 4 gleich T 4, also 4+ (die Hälfte): etwa <b>3,3 Verwundungen</b>.</li><li><b>Schutzwurf</b>: Mit AP -1 braucht der Verteidiger eine 4, um die 3+ zu schaffen – die Hälfte scheitert: etwa <b>1,7 Schaden</b>.</li></ul><p>Im Schnitt kommen also weniger als zwei Lebenspunkte Schaden durch. Hätte das Ziel Deckung, gäbe BS 4+ nur 5 Treffer und etwa 1,25 Schaden.</p>',
        tips: ['Tough targets need high S, good armour needs AP – pick weapons that fit the target.'],
        tips_de: ['Zähe Ziele brauchen hohe S, gute Rüstung braucht AP – wähle Waffen passend zum Ziel.'],
        refs: ['05', '05.01', '05.02', '05.04', '13.08'],
        diagrams: [
          {
            type: 'flow', dir: 'down',
            caption: 'On average: each step filters out part of the dice.',
            caption_de: 'Im Schnitt: Jeder Schritt siebt einen Teil der Würfel aus.',
            items: [
              { title: '10 attacks', title_de: '10 Attacken', text: 'hit on 3+ (BS 3+)', text_de: 'treffen bei 3+ (BS 3+)', kind: 'you' },
              { title: '≈ 6.7 hits', title_de: '≈ 6,7 Treffer', text: 'wound on 4+ (S 4 = T 4)', text_de: 'verwunden bei 4+ (S 4 = T 4)', kind: 'you' },
              { title: '≈ 3.3 wounds', title_de: '≈ 3,3 Verwundungen', text: 'defender saves on 4+ (Sv 3+, AP -1)', text_de: 'Verteidiger rettet bei 4+ (Sv 3+, AP -1)', kind: 'opp' },
              { title: '≈ 1.7 damage', title_de: '≈ 1,7 Schaden', text: 'D 1 each', text_de: 'je D 1', kind: 'bad' }
            ]
          },
          {
            type: 'dice',
            caption: 'One real roll of the same example: 7 hits, 4 wounds, 2 saved – 2 damage, close to the average.',
            caption_de: 'Ein echter Wurf desselben Beispiels: 7 Treffer, 4 Verwundungen, 2 abgewehrt – 2 Schaden, nah am Durchschnitt.',
            rows: [
              { label: 'Hit, 3+', label_de: 'Treffer, 3+', dice: [1, 2, 3, 3, 4, 5, 5, 6, 2, 4], need: 3, note: '7 hits', note_de: '7 Treffer' },
              { label: 'Wound, 4+', label_de: 'Verwundung, 4+', dice: [1, 2, 4, 5, 6, 3, 4], need: 4, note: '4 wounds', note_de: '4 Verwundungen' },
              { label: 'Save (defender), 4+', label_de: 'Rüstungswurf (Verteidiger), 4+', dice: [2, 3, 4, 6], need: 4, note: '2 saved – 2 damage', note_de: '2 abgewehrt – 2 Schaden' }
            ]
          }
        ]
      },
      {
        id: 'b-mortal', title: 'Mortal wounds and hazard rolls', title_de: 'Tödliche Wunden und Gefahrenwürfe',
        text: '<p><b>Mortal wounds</b> skip the dice: no hit, wound or save roll. Each one simply costs a model 1 wound – and unlike normal damage, they do carry over to the next model.</p><p>A <b>hazard roll</b> is one D6: on a 1–2 the unit suffers 1 mortal wound (3 if it consists only of MONSTERS or VEHICLES). You make them for example after attacking with [HAZARDOUS] weapons – one roll per such weapon used.</p>',
        text_de: '<p><b>Tödliche Wunden</b> überspringen die Würfe: kein Treffer-, Verwundungs- oder Schutzwurf. Jede kostet ein Modell einfach 1 Lebenspunkt – und anders als normaler Schaden gehen sie auf das nächste Modell über.</p><p>Ein <b>Gefahrenwurf</b> (hazard roll) ist ein W6: Bei 1–2 erleidet die Einheit 1 tödliche Wunde (3, wenn sie nur aus MONSTERS oder VEHICLES besteht). Du wirfst sie zum Beispiel nach Angriffen mit [HAZARDOUS]-Waffen – einen pro eingesetzter Waffe.</p>',
        refs: ['06.02', '06.03', '06.03.01', '24.15'],
        diagrams: [
          {
            type: 'compare',
            caption: 'Models with 2 wounds each (numbers = wounds left). A D 3 attack destroys one model and the third point is lost; 3 mortal wounds destroy one and wound the next.',
            caption_de: 'Modelle mit je 2 Lebenspunkten (Zahlen = verbleibende LP). Ein Angriff mit D 3 vernichtet ein Modell, der dritte Punkt verfällt; 3 tödliche Wunden vernichten eines und verwunden das nächste.',
            labels: [{ text: 'one attack, D 3', text_de: 'ein Angriff, D 3' }, { text: '3 mortal wounds', text_de: '3 tödliche Wunden' }],
            items: [
              {
                w: 6, h: 3.2,
                models: [{ x: 1.1, y: 1.4, side: 1, ghost: true, mark: 'dead' }, { x: 2.9, y: 1.4, side: 1, label: '2' }, { x: 4.7, y: 1.4, side: 1, label: '2' }],
                notes: [{ x: 3, y: 2.85, text: '1 damage is lost', text_de: '1 Schaden verfällt', anchor: 'middle' }]
              },
              {
                w: 6, h: 3.2,
                models: [{ x: 1.1, y: 1.4, side: 1, ghost: true, mark: 'dead' }, { x: 2.9, y: 1.4, side: 1, label: '1', mark: 'target' }, { x: 4.7, y: 1.4, side: 1, label: '2' }],
                notes: [{ x: 3, y: 2.85, text: 'the rest carries over', text_de: 'der Rest geht über', anchor: 'middle' }]
              }
            ]
          },
          {
            type: 'dice',
            caption: 'The unit fired two [HAZARDOUS] weapons, so it makes two hazard rolls. The 2 fails: 1 mortal wound.',
            caption_de: 'Die Einheit hat mit zwei [HAZARDOUS]-Waffen geschossen und macht daher zwei Gefahrenwürfe. Die 2 misslingt: 1 tödliche Wunde.',
            rows: [{ label: 'Hazard rolls: 1–2 fails', label_de: 'Gefahrenwürfe: 1–2 misslingt', dice: [2, 5], need: 3, note: '1 mortal wound (3 if only MONSTERS or VEHICLES)', note_de: '1 tödliche Wunde (3, wenn nur MONSTERS oder VEHICLES)' }]
          }
        ]
      }
    ]
  },

  // ───────────────────────── 8. Objectives ─────────────────────────
  {
    id: 'objectives', part: 'basics',
    title: 'Objectives', title_de: 'Missionsziele',
    intro: 'Most Victory Points come from objectives. This is how you find out who controls one.',
    intro_de: 'Die meisten Siegpunkte kommen von Missionszielen. So findest du heraus, wer eines kontrolliert.',
    steps: [
      {
        id: 'b-obj-range', title: 'Within range of an objective', title_de: 'In Reichweite eines Missionsziels',
        text: '<p>Objectives are either a <b>terrain area</b> named by the mission (a terrain objective) or a flat, round <b>40 mm marker</b>. Models may walk over markers and stand on them.</p><p>A model is <b>within range</b> of a marker if it is within <b>3"</b> of it (and 5" vertically), measured from the edge of the marker to the closest point of the base. For a terrain objective, a model is within range while it is within that terrain area.</p>',
        text_de: '<p>Missionsziele sind entweder ein von der Mission bestimmter <b>Geländebereich</b> (Gelände-Missionsziel) oder ein flacher, runder <b>40-mm-Marker</b>. Modelle dürfen über Marker laufen und auf ihnen stehen.</p><p>Ein Modell ist <b>in Reichweite</b> eines Markers, wenn es innerhalb von <b>3"</b> davon ist (vertikal 5"), gemessen vom Rand des Markers zum nächsten Punkt der Base. Bei einem Gelände-Missionsziel ist ein Modell in Reichweite, solange es in diesem Geländebereich steht.</p>',
        refs: ['14', '14.01', '14.01.01'],
        diagrams: [{
          w: 12, h: 8,
          caption: 'The dashed ring is 3" around the marker. The left model reaches into it (2.9"), the right one is 3.4" away.',
          caption_de: 'Der gestrichelte Ring liegt 3" um den Marker. Das linke Modell reicht hinein (2,9"), das rechte ist 3,4" entfernt.',
          objectives: [{ x: 6, y: 4, ring: true }],
          models: [{ x: 1.7, y: 4, side: 0, mark: 'ok' }, { x: 9.9, y: 6.9, side: 1, mark: 'bad' }],
          lines: [
            { from: [2.33, 4], to: [5.21, 4], kind: 'measure', label: '2.9"', label_de: '2,9"' },
            { from: [6.63, 4.47], to: [9.39, 6.52], kind: 'measure', label: '3.4"', label_de: '3,4"' }
          ]
        }, {
          w: 12, h: 6.4,
          caption: 'A terrain objective: every model within the terrain area is within range – even one only partly inside. The model outside is not.',
          caption_de: 'Ein Gelände-Missionsziel: Jedes Modell im Geländebereich ist in Reichweite – auch eines, das nur teilweise darin steht. Das Modell draußen nicht.',
          terrain: [{ x: 2, y: 1, w: 6.5, h: 4.6, type: 'ruin', label: 'terrain objective', label_de: 'Gelände-Missionsziel', ly: 0.6 }],
          models: [
            { x: 4.5, y: 2.8, side: 0, mark: 'ok' }, { x: 2.1, y: 4.6, side: 0, mark: 'ok' },
            { x: 7.4, y: 3.6, side: 1, mark: 'ok' }, { x: 10.6, y: 3, side: 1, mark: 'bad' }
          ],
          notes: [{ x: 10.6, y: 4.3, text: 'outside', text_de: 'draußen', anchor: 'middle' }]
        }]
      },
      {
        id: 'b-obj-control', title: 'Who controls it?', title_de: 'Wer kontrolliert es?',
        text: '<p>At the end of every phase and every turn, each player adds up the <b>OC</b> of all their models within range of the objective. Whoever has the higher total <b>controls</b> it. On a tie, nobody does.</p><p>Models with OC "–" (for example battle-shocked units) count for nothing. A model within range of two objectives counts for both.</p>',
        text_de: '<p>Am Ende jeder Phase und jedes Zuges zählt jeder Spieler den <b>OC</b> aller seiner Modelle in Reichweite des Missionsziels zusammen. Wer die höhere Summe hat, <b>kontrolliert</b> es. Bei Gleichstand niemand.</p><p>Modelle mit OC „–“ (zum Beispiel kampfgeschockte Einheiten) zählen nicht. Ein Modell in Reichweite zweier Missionsziele zählt für beide.</p>',
        tips: ['Control is checked at the end of each phase – an objective you hold after moving can be lost again by the end of the Fight phase.'],
        tips_de: ['Kontrolle wird am Ende jeder Phase geprüft – ein Missionsziel, das du nach der Bewegung hältst, kann bis zum Ende der Nahkampfphase wieder verloren gehen.'],
        refs: ['14.02', '14.02.01'],
        diagrams: [{
          w: 12, h: 9,
          caption: 'Numbers on the bases are OC. Only models within range count: you 4, enemy 3 – you control the objective.',
          caption_de: 'Die Zahlen auf den Bases sind OC. Nur Modelle in Reichweite zählen: du 4, Gegner 3 – du kontrollierst das Missionsziel.',
          objectives: [{ x: 6, y: 4.5, ring: true }],
          models: [
            { x: 2.6, y: 4.5, side: 0, label: '2' }, { x: 3, y: 3, side: 0, label: '2' }, { x: 2.2, y: 1.8, side: 0, label: '2' },
            { x: 8.8, y: 3, side: 1, label: '1' }, { x: 9.4, y: 4.4, side: 1, label: '1' }, { x: 9.2, y: 5.8, side: 1, label: '1' },
            { x: 10.7, y: 3.2, side: 1, label: '1' }, { x: 10.9, y: 4.7, side: 1, label: '1' }
          ],
          notes: [
            { x: 0.3, y: 8.75, text: 'You: 2 + 2 = 4', text_de: 'Du: 2 + 2 = 4', side: 0 },
            { x: 11.7, y: 8.75, text: 'Enemy: 1 + 1 + 1 = 3', text_de: 'Gegner: 1 + 1 + 1 = 3', side: 1, anchor: 'end' }
          ]
        }, {
          type: 'table',
          caption: 'The count for the picture above. Had the enemy reached 4 as well, nobody would control it.',
          caption_de: 'Die Rechnung zum Bild oben. Hätte der Gegner auch 4 erreicht, würde es niemand kontrollieren.',
          head: ['', 'You', 'Enemy'],
          head_de: ['', 'Du', 'Gegner'],
          rows: [['Models within range', '2', '3'], ['OC total', '2 + 2 = 4', '1 + 1 + 1 = 3'], ['Controls it', '✓', '–']],
          rows_de: [['Modelle in Reichweite', '2', '3'], ['OC-Summe', '2 + 2 = 4', '1 + 1 + 1 = 3'], ['Kontrolliert es', '✓', '–']],
          hl: [[1, 1], [2, 1]]
        }]
      },
      {
        id: 'b-obj-terrain', title: 'Terrain objectives and securing', title_de: 'Gelände-Missionsziele und Sichern',
        text: '<p>For a terrain objective you count every model standing in that terrain area – even a vehicle that is only partly inside.</p><p>Some rules let you <b>secure</b> an objective. It then stays yours even after your units leave, until your opponent has a higher OC total there at the end of a phase.</p>',
        text_de: '<p>Bei einem Gelände-Missionsziel zählt jedes Modell, das in diesem Geländebereich steht – auch ein Fahrzeug, das nur teilweise darin steht.</p><p>Manche Regeln erlauben dir, ein Missionsziel zu <b>sichern</b> (secure). Dann bleibt es deins, auch wenn deine Einheiten abziehen – bis dein Gegner dort am Ende einer Phase eine höhere OC-Summe hat.</p>',
        refs: ['14.01', '14.02', '14.03'],
        diagrams: [{
          w: 13, h: 7.2,
          caption: 'Everything in the ruin counts, the half-inside tank too. The battle-shocked enemy unit has OC "–": you 5, enemy 4.',
          caption_de: 'Alles in der Ruine zählt, auch der halb hineinragende Panzer. Die kampfgeschockte feindliche Einheit hat OC „–“: du 5, Gegner 4.',
          terrain: [{ x: 3, y: 1.2, w: 7, h: 4.8, type: 'ruin', label: 'terrain objective', label_de: 'Gelände-Missionsziel', ly: 0.75 }],
          models: [
            { x: 3, y: 4.4, side: 0, shape: 'rect', rw: 2.4, rh: 1.4, label: '3' }, { x: 5, y: 2.4, side: 0, label: '1' }, { x: 5, y: 3.8, side: 0, label: '1' },
            { x: 7.2, y: 2.9, side: 1, label: '1' }, { x: 8.4, y: 2.2, side: 1, label: '1' }, { x: 8.4, y: 3.6, side: 1, label: '1' }, { x: 9.6, y: 2.9, side: 1, label: '1' },
            { x: 7.6, y: 5.1, side: 1, label: '–', mark: 'shock' }, { x: 9, y: 5.1, side: 1, label: '–' }
          ],
          notes: [
            { x: 0.3, y: 6.85, text: 'You: 3 + 1 + 1 = 5', text_de: 'Du: 3 + 1 + 1 = 5', side: 0 },
            { x: 12.7, y: 6.85, text: 'Enemy: 4 (+ 0)', text_de: 'Gegner: 4 (+ 0)', side: 1, anchor: 'end' }
          ]
        }, {
          type: 'flow', dir: 'down',
          caption: 'A secured objective stays yours until the enemy beats your level of control there at the end of a phase.',
          caption_de: 'Ein gesichertes Missionsziel bleibt deins, bis der Gegner dort am Ende einer Phase mehr Kontrolle hat als du.',
          items: [
            { title: 'You control it and secure it', title_de: 'Du kontrollierst es und sicherst es', text: 'a rule lets you secure it', text_de: 'eine Regel erlaubt dir das Sichern', kind: 'you' },
            { title: 'Your units move away', title_de: 'Deine Einheiten ziehen ab', text: 'it stays yours, with 0 OC there', text_de: 'es bleibt deins, auch mit 0 OC dort', kind: 'you' },
            { title: 'End of a phase: enemy OC 2 vs your 0', title_de: 'Ende einer Phase: gegnerischer OC 2 gegen deine 0', text: 'higher than yours – now the enemy controls it', text_de: 'höher als deiner – jetzt kontrolliert es der Gegner', kind: 'opp' }
          ]
        }]
      }
    ]
  },

  // ───────────────────────── 9. Command points, stratagems and actions ─────────────────────────
  {
    id: 'cp-stratagems', part: 'basics',
    title: 'Command points, stratagems and actions', title_de: 'Befehlspunkte, Strategeme und Aktionen',
    intro: 'Spend Command Points on stratagems – special tricks that can turn a fight – and use actions to complete mission tasks.',
    intro_de: 'Gib Befehlspunkte für Strategeme aus – besondere Kniffe, die einen Kampf drehen können – und nutze Aktionen für Missionsaufgaben.',
    steps: [
      {
        id: 'b-stratagems', title: 'Command Points and stratagems', title_de: 'Befehlspunkte und Strategeme',
        text: '<p>In every Command phase – yours and your opponent\'s – <b>both</b> players gain <b>1 Command Point (CP)</b>. You spend CP on <b>stratagems</b>. Each stratagem card shows:</p><ul><li>its <b>cost</b> in CP,</li><li><b>WHEN</b> you may use it,</li><li><b>TARGET</b> – which unit it affects,</li><li><b>EFFECT</b> – what happens.</li></ul><p>You can use each stratagem only <b>once per phase</b>, and normally only one stratagem per unit per phase. Battle-shocked units can\'t be targeted by your own stratagems.</p>',
        text_de: '<p>In jeder Kommandophase – deiner und der deines Gegners – erhalten <b>beide</b> Spieler <b>1 Befehlspunkt (BP)</b>. Befehlspunkte gibst du für <b>Strategeme</b> aus. Jede Strategem-Karte zeigt:</p><ul><li>ihre <b>Kosten</b> in BP,</li><li><b>WHEN</b> – wann du sie einsetzen darfst,</li><li><b>TARGET</b> – welche Einheit betroffen ist,</li><li><b>EFFECT</b> – was passiert.</li></ul><p>Jedes Strategem darfst du nur <b>einmal pro Phase</b> einsetzen, und normalerweise nur ein Strategem pro Einheit und Phase. Auf kampfgeschockte Einheiten kannst du keine eigenen Strategeme einsetzen.</p>',
        refs: ['08.02', '15', '15.01', '01.07'],
        diagrams: [
          {
            type: 'table',
            caption: 'Both players gain 1 CP in every Command phase – their own and the opponent\'s.',
            caption_de: 'Beide Spieler erhalten in jeder Kommandophase 1 BP – in ihrer eigenen und in der des Gegners.',
            head: ['', 'You', 'Opponent'],
            head_de: ['', 'Du', 'Gegner'],
            rows: [['Your Command phase', '+1 CP', '+1 CP'], ['Opponent\'s Command phase', '+1 CP', '+1 CP'], ['Per battle round', '+2 CP', '+2 CP']],
            rows_de: [['Deine Kommandophase', '+1 BP', '+1 BP'], ['Kommandophase des Gegners', '+1 BP', '+1 BP'], ['Pro Schlachtrunde', '+2 BP', '+2 BP']],
            hl: [[2, 1], [2, 2]]
          },
          {
            type: 'flow', dir: 'down',
            caption: 'Using a stratagem, step by step.',
            caption_de: 'Ein Strategem einsetzen, Schritt für Schritt.',
            items: [
              { title: 'WHEN', title_de: 'WHEN', text: 'Is it the moment the card names?', text_de: 'Ist es der Moment, den die Karte nennt?', kind: 'info' },
              { title: 'TARGET', title_de: 'TARGET', text: 'Pick the unit – not one that is battle-shocked or already had a stratagem this phase', text_de: 'Wähle die Einheit – keine kampfgeschockte und keine, die in dieser Phase schon ein Strategem hatte', kind: 'you' },
              { title: 'Pay the CP', title_de: 'BP bezahlen', text: 'e.g. 1 CP', text_de: 'z. B. 1 BP', kind: 'warn' },
              { title: 'EFFECT', title_de: 'EFFECT', text: 'Resolve what the card says', text_de: 'Handle ab, was auf der Karte steht', kind: 'ok' }
            ]
          }
        ]
      },
      {
        id: 'b-strat-example', title: 'An example, and your own stratagems', title_de: 'Ein Beispiel – und deine eigenen Strategeme',
        text: '<p><b>COMMAND RE-ROLL</b> (1 CP) – WHEN: just after you make a hit, wound, save, damage, advance, charge or hazard roll (or roll for the number of attacks). EFFECT: re-roll it – if you rolled several dice together, just one of them (a charge roll is re-rolled in full). Perfect when your key unit\'s save fails at the worst moment.</p><p>Every army can use a handful of core stratagems like this one, and your detachment adds its own. Before your first game, open the <b>Stratagems</b> tab in a game and read through yours: note which ones you\'ll want, and in which phase – many are only usable in your opponent\'s turn.</p>',
        text_de: '<p><b>COMMAND RE-ROLL</b> (1 BP) – WHEN: direkt nachdem du einen Treffer-, Verwundungs-, Schutz-, Schadens-, Vorrück-, Angriffs- oder Gefahrenwurf (oder einen Wurf für die Zahl der Attacken) gemacht hast. EFFECT: Du wiederholst ihn – hast du mehrere Würfel zusammen geworfen, nur einen davon (ein Angriffswurf wird ganz wiederholt). Ideal, wenn der Schutzwurf deiner wichtigsten Einheit im falschen Moment misslingt.</p><p>Jede Armee kann eine Handvoll Kern-Strategeme wie dieses nutzen, und dein Kontingent bringt eigene mit. Öffne vor deinem ersten Spiel im Spiel den Tab <b>Strategeme</b> und lies deine durch: Merk dir, welche du nutzen willst und in welcher Phase – viele gehen nur im Zug des Gegners.</p>',
        tips: ['Keep 1–2 CP in reserve during your opponent\'s turn – reactive stratagems need them there.'],
        tips_de: ['Behalte im Zug des Gegners 1–2 BP in Reserve – reaktive Strategeme brauchen sie genau dann.'],
        refs: ['15.01', '15.02'],
        diagrams: [
          {
            type: 'dice',
            caption: 'Four save rolls at Sv 3+: the 1 fails. COMMAND RE-ROLL lets you re-roll that one dice – it shows a 6.',
            caption_de: 'Vier Rüstungswürfe mit Sv 3+: Die 1 misslingt. Mit COMMAND RE-ROLL wiederholst du genau diesen Würfel – er zeigt eine 6.',
            rows: [
              { label: 'Save rolls, Sv 3+', label_de: 'Rüstungswürfe, Sv 3+', dice: [4, 5, 1, 3], need: 3, note: '1 fails', note_de: '1 misslingt' },
              { label: 'After COMMAND RE-ROLL', label_de: 'Nach COMMAND RE-ROLL', dice: [4, 5, '1→6', 3], need: 3, note: 'all 4 saved', note_de: 'alle 4 abgewehrt' }
            ]
          },
          {
            type: 'flow', dir: 'right',
            caption: 'The same moment as a sequence.',
            caption_de: 'Derselbe Moment als Ablauf.',
            items: [
              { title: 'Save fails', title_de: 'Rüstungswurf misslingt', text: 'one dice shows a 1', text_de: 'ein Würfel zeigt eine 1', kind: 'bad' },
              { title: 'Pay 1 CP', title_de: '1 BP zahlen', text: 'COMMAND RE-ROLL', text_de: 'COMMAND RE-ROLL', kind: 'warn' },
              { title: 'Re-roll it', title_de: 'Neu würfeln', text: 'a 6 – saved', text_de: 'eine 6 – abgewehrt', kind: 'ok' }
            ]
          }
        ]
      },
      {
        id: 'b-actions', title: 'Actions', title_de: 'Aktionen',
        text: '<p>Missions often ask your units to perform <b>actions</b> – searching a ruin, planting a beacon. Each action says when it starts, which units can do it and when it completes.</p><p>A unit can\'t start an action if it is battle-shocked, engaged, has OC 0 or "–", or advanced or fell back this turn. Once it has started, it can\'t shoot or charge for the rest of the turn – and if it moves (other than piling in or consolidating), the action fails.</p>',
        text_de: '<p>Missionen verlangen oft, dass deine Einheiten <b>Aktionen</b> durchführen – eine Ruine durchsuchen, ein Peilsignal setzen. Jede Aktion sagt, wann sie beginnt, welche Einheiten sie durchführen können und wann sie abgeschlossen ist.</p><p>Eine Einheit kann keine Aktion beginnen, wenn sie kampfgeschockt oder im Nahkampf ist, OC 0 oder „–“ hat oder in diesem Zug vorgerückt oder zurückgefallen ist. Hat sie begonnen, darf sie für den Rest des Zuges nicht schießen oder angreifen – und bewegt sie sich (außer beim Heranrücken oder Konsolidieren), scheitert die Aktion.</p>',
        tips: ['Use cheap units for actions – the unit gives up its shooting and charge for that turn.'],
        tips_de: ['Nimm günstige Einheiten für Aktionen – die Einheit verzichtet in diesem Zug auf Schießen und Angreifen.'],
        refs: ['16', '16.01', '01.07'],
        diagrams: [
          {
            type: 'table',
            caption: 'Can this unit start an action? Checked when it wants to start one.',
            caption_de: 'Darf diese Einheit eine Aktion beginnen? Geprüft, wenn sie eine beginnen will.',
            head: ['The unit …', 'Start an action?'],
            head_de: ['Die Einheit …', 'Aktion beginnen?'],
            rows: [
              ['made a normal move or stayed still', '✓'],
              ['advanced or fell back this turn', '✕'],
              ['is engaged', '✕'],
              ['is battle-shocked', '✕'],
              ['has OC 0 or "–"', '✕']
            ],
            rows_de: [
              ['hat sich normal bewegt oder ist stehen geblieben', '✓'],
              ['ist in diesem Zug vorgerückt oder zurückgefallen', '✕'],
              ['ist im Nahkampf', '✕'],
              ['ist kampfgeschockt', '✕'],
              ['hat OC 0 oder „–“', '✕']
            ],
            hl: [[0, 1]]
          },
          {
            type: 'flow', dir: 'down',
            caption: 'An action from start to finish.',
            caption_de: 'Eine Aktion vom Anfang bis zum Ende.',
            items: [
              { title: 'Start the action', title_de: 'Aktion beginnen', text: 'at the moment the action names', text_de: 'zu dem Zeitpunkt, den die Aktion nennt', kind: 'you' },
              { title: 'Rest of the turn', title_de: 'Rest des Zuges', text: 'no shooting, no charge', text_de: 'kein Schießen, kein Angriff', kind: 'warn' },
              { title: 'Don\'t move', title_de: 'Nicht bewegen', text: 'moving (except pile-in or consolidation) makes it fail', text_de: 'eine Bewegung (außer Heranrücken oder Konsolidieren) lässt sie scheitern', kind: 'bad' },
              { title: 'Completes', title_de: 'Abgeschlossen', text: 'its EFFECT happens, e.g. you score', text_de: 'ihr EFFECT tritt ein, z. B. du punktest', kind: 'ok' }
            ]
          }
        ]
      }
    ]
  }
];
