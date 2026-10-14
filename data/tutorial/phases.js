/* Learn to play – part 2: the battle round and the phases, part 3: more rules (see data/tutorial/index.js).
 * Written in own words from the 11th-edition core rules; refs point to the original sections.
 * Practical "how to play" level: what you do, in order, and what to watch out for – no edge cases.
 * Diagram coordinates in inches (top-left origin); 32 mm base = 0.63" radius, distances edge to edge. */

const M = (x, y, side, o = {}) => ({ x, y, side, ...o });
/* rectangle (x0,y0)-(x1,y1) grown by d on every side, with rounded corners → polygon for "within d of a hull" */
const grow = (x0, y0, x1, y1, d) => {
  const p = [];
  const arc = (cx, cy, a0) => { for (let i = 0; i <= 4; i++) { const a = (a0 + i * 22.5) * Math.PI / 180; p.push([+(cx + d * Math.cos(a)).toFixed(2), +(cy + d * Math.sin(a)).toFixed(2)]); } };
  arc(x1, y0, -90); arc(x1, y1, 0); arc(x0, y1, 90); arc(x0, y0, 180);
  return p;
};
const STRATS = { text: 'Check your stratagems for this phase (Stratagems tab)', text_de: 'Strategeme für diese Phase prüfen (Tab Strategeme)', refs: ['15.01'] };

export const PHASES = [
  // ═════════════════════════════ The battle round ═════════════════════════════
  {
    id: 'battle-round', part: 'phases',
    title: 'The battle round', title_de: 'Die Schlachtrunde',
    intro: 'How a game is split into battle rounds and turns – and when it is over.',
    intro_de: 'Wie eine Partie in Schlachtrunden und Züge aufgeteilt ist – und wann sie vorbei ist.',
    steps: [
      {
        id: 'br-rounds', title: 'Rounds and turns', title_de: 'Runden und Züge',
        text: `<p>A battle is played over several <b>battle rounds</b>. In every round <b>each player takes one turn</b>: first one player plays their whole turn, then the other. The <b>same player always goes first</b> – your mission tells you how that player is chosen.</p><p>Whoever's turn it is, is the <b>active player</b>. The other player is not idle, though: they roll saves, fight back in melee and can use stratagems.</p>`,
        text_de: `<p>Eine Schlacht wird über mehrere <b>Schlachtrunden</b> gespielt. In jeder Runde hat <b>jeder Spieler einen Zug</b>: Erst spielt ein Spieler seinen kompletten Zug, dann der andere. <b>Derselbe Spieler beginnt immer</b> – wie er bestimmt wird, steht in deiner Mission.</p><p>Wer am Zug ist, ist der <b>aktive Spieler</b>. Der andere ist trotzdem nicht untätig: Er würfelt Schutzwürfe, schlägt im Nahkampf zurück und kann Strategeme einsetzen.</p>`,
        refs: ['07', '07.02', '01.03']
      },
      {
        id: 'br-turn', title: 'The parts of a turn', title_de: 'Die Teile eines Zuges',
        text: `<p>Every turn runs through the same parts, always in this order:</p><ul><li><b>Start of the turn</b> – rules that happen "at the start of your turn".</li><li><b>Command phase</b> – gain CP, check battle-shock.</li><li><b>Movement phase</b> – move your units, bring in reserves.</li><li><b>Shooting phase</b> – fire ranged weapons.</li><li><b>Charge phase</b> – rush into close combat.</li><li><b>Fight phase</b> – <i>both</i> players' units fight in melee.</li><li><b>End of the turn</b> – tidy up and score.</li></ul><p>Finish one phase completely before the next one starts – once you are shooting, you cannot go back and move a unit.</p>`,
        text_de: `<p>Jeder Zug besteht aus denselben Teilen, immer in dieser Reihenfolge:</p><ul><li><b>Zugbeginn</b> – Regeln, die „zu Beginn deines Zuges“ greifen.</li><li><b>Kommandophase</b> – BP erhalten, Kampfschock prüfen.</li><li><b>Bewegungsphase</b> – Einheiten bewegen, Reserven bringen.</li><li><b>Fernkampfphase</b> – mit Fernkampfwaffen schießen.</li><li><b>Angriffsphase</b> – in den Nahkampf stürmen.</li><li><b>Nahkampfphase</b> – die Einheiten <i>beider</i> Spieler kämpfen.</li><li><b>Zugende</b> – aufräumen und werten.</li></ul><p>Schließe eine Phase vollständig ab, bevor die nächste beginnt – wenn du schon schießt, kannst du keine Einheit mehr bewegen.</p>`,
        tips: ['Say each phase change out loud – it gives your opponent the chance to use a stratagem "at the end of the phase".'],
        tips_de: ['Sag jeden Phasenwechsel laut an – so kann dein Gegner rechtzeitig ein Strategem „am Ende der Phase“ einsetzen.'],
        refs: ['07.02', '07.03']
      },
      {
        id: 'br-end', title: 'How the battle ends', title_de: 'Wie die Schlacht endet',
        text: `<p>When both players have had their turn, the battle round ends and the next one begins. Your <b>mission</b> says how many rounds are played – usually <b>five</b>. After the last one the battle is over and the victory points decide the winner.</p>`,
        text_de: `<p>Wenn beide Spieler ihren Zug hatten, endet die Schlachtrunde und die nächste beginnt. Wie viele Runden gespielt werden, sagt deine <b>Mission</b> – meist sind es <b>fünf</b>. Danach ist die Schlacht vorbei und die Siegpunkte entscheiden.</p>`,
        tips: ['Plan for the last turn: the second player moves last and can grab objectives without an answer.'],
        tips_de: ['Plane den letzten Zug mit ein: Der zweite Spieler zieht zuletzt und kann Missionsziele nehmen, ohne dass noch eine Antwort kommt.'],
        refs: ['07.03']
      }
    ]
  },

  // ═════════════════════════════ Command phase ═════════════════════════════
  {
    id: 'command-phase', part: 'phases', phase: 'command',
    title: 'Command phase', title_de: 'Kommandophase',
    intro: 'Gain Command Points, check your troops\' nerve, score what your mission asks for.',
    intro_de: 'Befehlspunkte erhalten, die Moral deiner Truppen prüfen, werten, was deine Mission verlangt.',
    steps: [
      {
        id: 'cmd-cp', title: 'Start of turn and Command Points', title_de: 'Zugbeginn und Befehlspunkte',
        text: `<p>First resolve anything that happens "at the start of your turn" or "at the start of the Command phase". If you play with <b>tactical secondary missions</b>, draw two Secondary Mission cards now (cards you still hold stay active).</p><p>Then <b>both players gain 1 CP</b> – your opponent too. You spend CP on <b>stratagems</b>: each one says when it can be used and what it costs.</p>`,
        text_de: `<p>Handle zuerst alles ab, was „zu Beginn deines Zuges“ oder „zu Beginn der Kommandophase“ passiert. Spielst du mit <b>taktischen Sekundärmissionen</b>, ziehst du jetzt zwei Sekundärmissionskarten (Karten, die du noch hältst, bleiben aktiv).</p><p>Dann erhalten <b>beide Spieler 1 BP</b> – auch dein Gegner. BP gibst du für <b>Strategeme</b> aus: Jedes sagt, wann es eingesetzt werden kann und was es kostet.</p>`,
        tips: ['Book your opponent\'s CP too – it is easy to forget during your own turn.'],
        tips_de: ['Buche auch die BP deines Gegners – das vergisst man im eigenen Zug leicht.'],
        refs: ['07.02', '08.01', '08.02', '15.01']
      },
      {
        id: 'cmd-shock', title: 'Battle-shock', title_de: 'Kampfschock',
        text: `<p>Make a <b>battle-shock roll</b> for each of your units that is already battle-shocked or at <b>half-strength or below</b> (e.g. 5 of 10 models left). Roll <b>2D6</b>: equal to or higher than the unit's <b>Ld</b> passes – a battle-shocked unit recovers. A failed roll makes the unit <b>battle-shocked</b>:</p><ul><li>OC "–": it cannot hold objectives,</li><li>you cannot use stratagems on it,</li><li>it cannot do actions.</li></ul>`,
        text_de: `<p>Lege einen <b>Kampfschocktest</b> für jede deiner Einheiten ab, die schon kampfgeschockt ist oder auf <b>halber Sollstärke oder darunter</b> ist (z. B. noch 5 von 10 Modellen). Wirf <b>2W6</b>: gleich oder höher als der <b>Ld</b>-Wert der Einheit besteht – eine kampfgeschockte Einheit erholt sich. Ein misslungener Test macht die Einheit <b>kampfgeschockt</b>:</p><ul><li>OC „–“: sie kann keine Missionsziele halten,</li><li>du kannst keine Strategeme auf sie anwenden,</li><li>sie kann keine Aktionen ausführen.</li></ul>`,
        tips: ['Only the player whose turn it is rolls for battle-shock here.', 'A stratagem such as INSANE BRAVERY can save a key unit from failing – check what you have.'],
        tips_de: ['Hier würfelt nur der Spieler, der am Zug ist.', 'Ein Strategem wie INSANE BRAVERY kann eine wichtige Einheit vor dem Scheitern bewahren – schau nach, was du hast.'],
        refs: ['08.03', '01.06', '01.07', '15.04'],
        diagram: {
          w: 12, h: 5,
          caption: 'Left: 10 models, 5 left – at half-strength, roll. Right: 5 models, 3 left – above half-strength, no roll.',
          caption_de: 'Links: 10 Modelle, noch 5 – halbe Sollstärke, Test. Rechts: 5 Modelle, noch 3 – über halber Sollstärke, kein Test.',
          models: [
            M(0.9, 1.5, 0), M(2.26, 1.5, 0), M(3.62, 1.5, 0), M(4.98, 1.5, 0), M(6.34, 1.5, 0, { mark: 'shock' }),
            M(0.9, 2.86, 0, { ghost: true }), M(2.26, 2.86, 0, { ghost: true }), M(3.62, 2.86, 0, { ghost: true }), M(4.98, 2.86, 0, { ghost: true }), M(6.34, 2.86, 0, { ghost: true }),
            M(8.2, 1.5, 0), M(9.56, 1.5, 0), M(10.92, 1.5, 0, { mark: 'ok' }),
            M(8.2, 2.86, 0, { ghost: true }), M(9.56, 2.86, 0, { ghost: true })
          ],
          notes: [
            { x: 3.62, y: 4.4, text: '10 → 5 left: roll', text_de: '10 → noch 5: Test', anchor: 'middle' },
            { x: 9.56, y: 4.4, text: '5 → 3: no roll', text_de: '5 → 3: kein Test', anchor: 'middle' }
          ]
        }
      },
      {
        id: 'cmd-end', title: 'Abilities and scoring', title_de: 'Fähigkeiten und Wertung',
        text: `<p>Now use everything that happens "in your Command phase" – army or datasheet abilities that, for example, pick a bonus for this turn.</p><p>At the <b>end of the Command phase</b> both players check their missions. Many <b>primary missions score here</b>, usually from the second battle round on – so count your objectives before you move anything.</p>`,
        text_de: `<p>Nutze jetzt alles, was „in deiner Kommandophase“ passiert – Armee- oder Datenblattfähigkeiten, die zum Beispiel einen Bonus für diesen Zug wählen.</p><p>Am <b>Ende der Kommandophase</b> prüfen beide Spieler ihre Missionen. Viele <b>Primärmissionen werten hier</b>, meist ab der zweiten Schlachtrunde – zähle deine Missionsziele also, bevor du etwas bewegst.</p>`,
        refs: ['08.04', '08.05']
      }
    ],
    game: {
      you: [
        { text: 'Resolve "start of turn" rules; tactical missions: draw 2 cards', text_de: 'Regeln „zu Beginn des Zuges“ abhandeln; taktische Missionen: 2 Karten ziehen', refs: ['07.02', '08.01'] },
        { text: 'Both players gain 1 CP', text_de: 'Beide Spieler erhalten 1 BP', refs: ['08.02'] },
        { text: 'Battle-shock roll (2D6 ≥ Ld) for shocked units and units at/below half-strength', text_de: 'Kampfschocktest (2W6 ≥ Ld) für geschockte Einheiten und solche auf halber Sollstärke oder darunter', refs: ['08.03', '01.07'] },
        { text: 'Use "in your Command phase" abilities', text_de: '„In deiner Kommandophase“-Fähigkeiten nutzen', refs: ['08.04'] },
        { text: 'End of phase: score primary VP if your mission says so (usually from round 2)', text_de: 'Ende der Phase: Primär-SP werten, wenn die Mission es vorsieht (meist ab Runde 2)', refs: ['08.05'] },
        STRATS
      ],
      opp: [
        { text: 'Gains 1 CP as well', text_de: 'Erhält ebenfalls 1 BP', refs: ['08.02'] },
        { text: 'Makes no battle-shock rolls in your turn', text_de: 'Würfelt in deinem Zug keine Kampfschocktests', refs: ['08.03'] }
      ]
    }
  },

  // ═════════════════════════════ Movement phase ═════════════════════════════
  {
    id: 'movement-phase', part: 'phases', phase: 'movement',
    title: 'Movement phase', title_de: 'Bewegungsphase',
    intro: 'Move your units one at a time and bring in reinforcements.',
    intro_de: 'Bewege deine Einheiten nacheinander und bringe Verstärkungen ins Spiel.',
    steps: [
      {
        id: 'mov-select', title: 'One unit at a time', title_de: 'Eine Einheit nach der anderen',
        text: `<p>Pick a unit, choose how it moves, finish the move, then pick the next. Every unit is picked once – a unit you do not want to move <b>remains stationary</b>. The options:</p><ul><li><b>NORMAL MOVE</b> – up to the unit's Move (M).</li><li><b>ADVANCE MOVE</b> – up to M + D6", but with restrictions afterwards.</li><li><b>FALL-BACK MOVE</b> – to get out of melee.</li><li>Getting out of a TRANSPORT or arriving from reserves (see below and in "More rules").</li></ul>`,
        text_de: `<p>Wähle eine Einheit, bestimme, wie sie sich bewegt, führe die Bewegung aus und wähle dann die nächste. Jede Einheit kommt einmal dran – eine Einheit, die du nicht bewegen willst, <b>bleibt stehen</b> (REMAIN STATIONARY). Die Möglichkeiten:</p><ul><li><b>NORMAL MOVE</b> – bis zum Bewegungswert (M) der Einheit.</li><li><b>ADVANCE MOVE</b> – bis M + W6", danach aber mit Einschränkungen.</li><li><b>FALL-BACK MOVE</b> – um aus dem Nahkampf zu kommen.</li><li>Aus einem TRANSPORT aussteigen oder aus der Reserve ankommen (siehe unten und unter „Weitere Regeln“).</li></ul>`,
        tips: ['Finish one unit completely – including coherency – before you touch the next.'],
        tips_de: ['Schließe eine Einheit komplett ab – inklusive Kohärenz –, bevor du die nächste anfasst.'],
        refs: ['09', '09.02', '09.04']
      },
      {
        id: 'mov-normal', title: 'NORMAL MOVE and ADVANCE MOVE', title_de: 'NORMAL MOVE und ADVANCE MOVE',
        text: `<p>With a <b>NORMAL MOVE</b> each model moves up to M inches. Measure the same point of the base before and after; turning is free. Models can pass through friendly models but not through enemies, and must end <b>more than 2"</b> from enemy models (outside engagement range) and in coherency.</p><p>Need more speed? Make an <b>ADVANCE MOVE</b>: roll a D6 first and add it to M. The price for the rest of the turn: the unit <b>cannot charge</b>, cannot do actions and can only shoot <b>[ASSAULT]</b> weapons.</p>`,
        text_de: `<p>Bei einem <b>NORMAL MOVE</b> bewegt sich jedes Modell bis zu M Zoll. Miss vorher und nachher vom selben Punkt der Base; Drehen ist gratis. Modelle dürfen durch eigene Modelle, aber nicht durch gegnerische, und müssen <b>mehr als 2"</b> von gegnerischen Modellen entfernt (außerhalb der Nahkampfreichweite) und kohärent enden.</p><p>Mehr Tempo nötig? Mach einen <b>ADVANCE MOVE</b>: Wirf zuerst einen W6 und addiere ihn zu M. Der Preis für den Rest des Zuges: Die Einheit <b>kann nicht angreifen</b>, keine Aktionen ausführen und nur mit <b>[ASSAULT]</b>-Waffen schießen.</p>`,
        tips: ['Plan ahead: a unit that advances gives up its charge this turn.', 'Ruins, woods and buildings stop most models that are not INFANTRY – check the terrain before a long move.'],
        tips_de: ['Plane voraus: Eine Einheit, die vorrückt, verzichtet in diesem Zug auf ihren Angriff.', 'Ruinen, Wälder und Gebäude halten die meisten Modelle auf, die keine INFANTRY sind – prüfe das Gelände vor einer langen Bewegung.'],
        refs: ['09.05', '09.06', '03.01', '03.03', '03.04'],
        diagram: {
          w: 15, h: 6.4,
          caption: 'Top: NORMAL MOVE, M 6". Bottom: ADVANCE MOVE with a 4 on the D6 – 10", but no charge this turn.',
          caption_de: 'Oben: NORMAL MOVE, M 6". Unten: ADVANCE MOVE mit einer 4 auf dem W6 – 10", aber kein Angriff in diesem Zug.',
          models: [M(1.2, 1.8, 0, { ghost: true }), M(7.2, 1.8, 0), M(1.2, 4.4, 0, { ghost: true }), M(11.2, 4.4, 0)],
          arrows: [
            { from: [1.9, 1.8], to: [6.5, 1.8], kind: 'move', label: 'NORMAL 6"' },
            { from: [1.9, 4.4], to: [10.5, 4.4], kind: 'advance', label: 'ADVANCE 6" + 4" (D6)', label_de: 'ADVANCE 6" + 4" (W6)' }
          ],
          notes: [
            { x: 8.2, y: 1.95, text: 'may shoot and charge', text_de: 'darf schießen und angreifen' },
            { x: 7.5, y: 5.9, text: 'no charge · only [ASSAULT] weapons', text_de: 'kein Angriff · nur [ASSAULT]-Waffen', anchor: 'middle' }
          ]
        }
      },
      {
        id: 'mov-fallback', title: 'FALL-BACK MOVE', title_de: 'FALL-BACK MOVE',
        text: `<p>A unit that is <b>engaged</b> (within 2" of an enemy) can only leave the fight by falling back up to M". It must end more than 2" from all enemies, and for the rest of the turn it <b>cannot shoot or charge</b>.</p><p>A <b>battle-shocked</b> unit must flee in panic (<i>Desperate Escape</i>): roll a D6 for each model, every 1–2 costs a mortal wound – but it may move through enemy models. A unit that chooses this mode without being battle-shocked must take a battle-shock roll afterwards.</p>`,
        text_de: `<p>Eine Einheit <b>im Nahkampf</b> (innerhalb von 2" zu einem Gegner) kann ihn nur verlassen, indem sie sich bis zu M" zurückzieht. Sie muss mehr als 2" von allen Gegnern entfernt enden und kann für den Rest des Zuges <b>nicht schießen und nicht angreifen</b>.</p><p>Eine <b>kampfgeschockte</b> Einheit muss in Panik fliehen (<i>Desperate Escape</i>): Wirf für jedes Modell einen W6, jede 1–2 kostet eine tödliche Wunde – dafür darf sie sich durch gegnerische Modelle bewegen. Eine Einheit, die diesen Modus ohne Kampfschock wählt, muss danach einen Kampfschocktest ablegen.</p>`,
        tips: ['Falling back costs the unit its shooting this turn – sometimes it is better to stay and keep the enemy busy.'],
        tips_de: ['Ein Rückzug kostet die Einheit ihr Schießen in diesem Zug – manchmal ist es besser, zu bleiben und den Gegner zu binden.'],
        refs: ['09.07', '09.07.01', '06.03'],
        diagram: {
          w: 12, h: 6.6,
          caption: 'The engaged unit falls back up to its M and ends more than 2" from every enemy model.',
          caption_de: 'Die Einheit im Nahkampf zieht sich bis zu ihrem M-Wert zurück und endet mehr als 2" von jedem gegnerischen Modell entfernt.',
          rings: [{ x: 8.8, y: 3.8, r: 2.63, kind: 'engage', label: '2"' }],
          models: [M(6.4, 2.4, 0, { ghost: true }), M(6.6, 3.9, 0, { ghost: true }), M(1.6, 2.4, 0), M(1.8, 3.9, 0), M(8.6, 2.2, 1), M(8.8, 3.8, 1)],
          arrows: [
            { from: [5.7, 2.4], to: [2.3, 2.4], kind: 'fallback', label: 'FALL-BACK ≤ 6"' },
            { from: [5.9, 3.9], to: [2.5, 3.9], kind: 'fallback' }
          ],
          notes: [{ x: 6, y: 6.2, text: 'afterwards: no shooting, no charge', text_de: 'danach: kein Schießen, kein Angriff', anchor: 'middle' }]
        }
      },
      {
        id: 'mov-ingress', title: 'Reinforcements and the end of the phase', title_de: 'Verstärkungen und Ende der Phase',
        text: `<p>From the <b>second battle round</b>, units waiting in <b>strategic reserves</b> can arrive: set them up <b>wholly within 6"</b> of a battlefield edge and <b>more than 8"</b> from every enemy unit (before round 3 not in the enemy deployment zone). Units with <b>DEEP STRIKE</b> can arrive anywhere more than 8" from the enemy.</p><p>When all your units have moved, your opponent may react – for example with <b>FIRE OVERWATCH</b>, shooting one of your units that ended within 24", hitting only on 6s. Check your own stratagems too.</p>`,
        text_de: `<p>Ab der <b>zweiten Schlachtrunde</b> können Einheiten aus den <b>Strategischen Reserven</b> ankommen: Stelle sie <b>vollständig innerhalb von 6"</b> zu einer Spielfeldkante und <b>mehr als 8"</b> von jeder gegnerischen Einheit entfernt auf (vor Runde 3 nicht in der gegnerischen Aufstellungszone). Einheiten mit <b>DEEP STRIKE</b> können überall ankommen, wo sie mehr als 8" vom Gegner entfernt sind.</p><p>Wenn alle deine Einheiten bewegt sind, kann dein Gegner reagieren – zum Beispiel mit <b>FIRE OVERWATCH</b> auf eine deiner Einheiten innerhalb von 24", Treffer nur bei 6. Prüfe auch deine eigenen Strategeme.</p>`,
        tips: ['Arriving units can still charge this turn – but from more than 8" away they need a roll of 9 or more.'],
        tips_de: ['Angekommene Einheiten dürfen in diesem Zug noch angreifen – aus mehr als 8" brauchen sie aber eine 9 oder mehr.'],
        refs: ['20.03', '20.04', '24.09', '09.03', '15.08'],
        diagram: {
          w: 16, h: 8,
          caption: 'The left side is the battlefield edge. The arriving unit stands wholly within 6" of it and more than 8" from the enemy; the crossed-out spot is too close.',
          caption_de: 'Links ist die Spielfeldkante. Die ankommende Einheit steht vollständig innerhalb von 6" dazu und mehr als 8" vom Gegner entfernt; die durchgestrichene Stelle ist zu nah.',
          zones: [{ x: 0, y: 0, w: 6, h: 8, side: 0, label: 'within 6" of the edge', label_de: 'bis 6" von der Kante' }],
          rings: [{ x: 12, y: 3, r: 8.63, kind: 'range' }, { x: 12.3, y: 4.5, r: 8.63, kind: 'range' }],
          lines: [{ from: [11.37, 3], to: [3.37, 3], kind: 'measure', label: '8"' }],
          models: [M(2.0, 6.5, 0), M(3.4, 7.2, 0), M(4.4, 3.9, 0, { ghost: true, mark: 'bad' }), M(12, 3, 1), M(12.3, 4.5, 1)],
          notes: [{ x: 15.8, y: 7.6, text: 'more than 8" from every enemy', text_de: 'mehr als 8" von jedem Gegner', anchor: 'end' }]
        }
      }
    ],
    game: {
      you: [
        { text: 'Pick every unit once: stay, NORMAL, ADVANCE or FALL-BACK MOVE', text_de: 'Jede Einheit einmal wählen: stehen, NORMAL, ADVANCE oder FALL-BACK MOVE', refs: ['09.02'] },
        { text: 'End more than 2" from enemies and in coherency', text_de: 'Mehr als 2" vom Gegner entfernt und kohärent enden', refs: ['09.05', '03.03'] },
        { text: 'Advanced: no charge, only [ASSAULT] shooting this turn', text_de: 'Vorgerückt: kein Angriff, nur [ASSAULT]-Schüsse in diesem Zug', refs: ['09.06'] },
        { text: 'Fell back: no shooting, no charge this turn', text_de: 'Zurückgezogen: kein Schießen, kein Angriff in diesem Zug', refs: ['09.07'] },
        { text: 'Get out of TRANSPORTS', text_de: 'Aus TRANSPORTERN aussteigen', refs: ['18.03'] },
        { text: 'From round 2: reserves arrive – within 6" of an edge, more than 8" from enemies', text_de: 'Ab Runde 2: Reserven kommen an – innerhalb 6" zur Kante, mehr als 8" vom Gegner', refs: ['20.04'] },
        STRATS
      ],
      opp: [
        { text: 'End of phase: may react with stratagems, e.g. FIRE OVERWATCH', text_de: 'Ende der Phase: kann mit Strategemen reagieren, z. B. FIRE OVERWATCH', refs: ['15.08'] }
      ]
    }
  },

  // ═════════════════════════════ Shooting phase ═════════════════════════════
  {
    id: 'shooting-phase', part: 'phases', phase: 'shooting',
    title: 'Shooting phase', title_de: 'Fernkampfphase',
    intro: 'Your units open fire, one after another.',
    intro_de: 'Deine Einheiten eröffnen nacheinander das Feuer.',
    steps: [
      {
        id: 'sho-select', title: 'Who may shoot', title_de: 'Wer schießen darf',
        text: `<p>Pick a unit, resolve all its shots, then pick the next. Every unit shoots at most once, and you do not have to shoot with all of them. How a unit may shoot depends on what it did:</p><ul><li><b>Moved normally or stood still</b> – all ranged weapons (NORMAL SHOOTING).</li><li><b>Advanced</b> – only <b>[ASSAULT]</b> weapons.</li><li><b>Fell back</b> or started an action – no shooting.</li><li><b>Engaged</b> – only <b>[PISTOL]</b>/<b>[CLOSE-QUARTERS]</b> weapons, at the enemy it is fighting. MONSTERS and VEHICLES may fire all their guns, at -1 to hit.</li></ul>`,
        text_de: `<p>Wähle eine Einheit, handle all ihre Schüsse ab, dann wähle die nächste. Jede Einheit schießt höchstens einmal, und du musst nicht mit allen schießen. Wie eine Einheit schießen darf, hängt davon ab, was sie getan hat:</p><ul><li><b>Normal bewegt oder stehen geblieben</b> – alle Fernkampfwaffen (NORMAL SHOOTING).</li><li><b>Vorgerückt</b> – nur <b>[ASSAULT]</b>-Waffen.</li><li><b>Zurückgezogen</b> oder Aktion begonnen – kein Schießen.</li><li><b>Im Nahkampf</b> – nur <b>[PISTOL]</b>/<b>[CLOSE-QUARTERS]</b>-Waffen, auf den Gegner, mit dem sie kämpft. MONSTER und VEHICLE dürfen alle Waffen abfeuern, mit -1 auf Treffer.</li></ul>`,
        tips: ['A unit either shoots or starts an action this turn – never both.'],
        tips_de: ['Eine Einheit schießt in diesem Zug oder beginnt eine Aktion – nie beides.'],
        refs: ['10.02', '10.04', '10.05', '10.06', '16.01', '24.27']
      },
      {
        id: 'sho-targets', title: 'Choosing targets', title_de: 'Ziele wählen',
        text: `<p>For each model, choose its weapons and a target for each weapon. The target must be</p><ul><li><b>visible</b> to that model (it can see at least one model of the unit),</li><li><b>within range</b> of that weapon (measured to the closest model),</li><li><b>not engaged</b> in melee.</li></ul><p>Different weapons may shoot at different units. Choose all targets first, then roll. A target in or behind terrain may have <b>cover</b>, which makes it harder to hit.</p>`,
        text_de: `<p>Wähle für jedes Modell seine Waffen und für jede Waffe ein Ziel. Das Ziel muss</p><ul><li>für dieses Modell <b>sichtbar</b> sein (es sieht mindestens ein Modell der Einheit),</li><li><b>in Reichweite</b> der Waffe sein (gemessen zum nächsten Modell),</li><li><b>nicht im Nahkampf</b> sein.</li></ul><p>Verschiedene Waffen dürfen auf verschiedene Einheiten schießen. Erst alle Ziele wählen, dann würfeln. Ein Ziel im oder hinter Gelände kann <b>Deckung</b> haben und ist dann schwerer zu treffen.</p>`,
        tips: ['INFANTRY sitting in terrain can be hidden and is then only visible from within 15".', 'Weapons with [INDIRECT FIRE] may shoot at targets they cannot see – but hit much less often.'],
        tips_de: ['INFANTRY im Gelände kann verborgen sein und ist dann nur aus 15" oder näher sichtbar.', 'Waffen mit [INDIRECT FIRE] dürfen auf Ziele schießen, die sie nicht sehen – treffen aber viel seltener.'],
        refs: ['04.01', '04.02', '06.01', '13.08', '13.09', '10.07'],
        diagram: {
          w: 15, h: 7,
          caption: 'Weapon range 8". Each model checks its own shot: the top one may fire, the one behind the ruin cannot see the enemy, the left one is out of range.',
          caption_de: 'Waffenreichweite 8". Jedes Modell prüft seinen eigenen Schuss: Das obere darf feuern, das hinter der Ruine sieht den Gegner nicht, das linke ist außer Reichweite.',
          terrain: [{ x: 5.5, y: 3.2, w: 2.5, h: 3.0, type: 'ruin', label: 'ruin', label_de: 'Ruine', ly: 5.8 }],
          lines: [{ from: [1.53, 3.04], to: [10.97, 2.06], kind: 'measure', label: '9.5" > 8"' }],
          models: [M(3.0, 1.9, 0, { mark: 'ok' }), M(3.4, 4.4, 0, { mark: 'bad' }), M(0.9, 3.1, 0, { mark: 'bad' }), M(11.6, 2.0, 1), M(12.6, 3.6, 1), M(11.7, 5.2, 1)],
          arrows: [
            { from: [3.63, 1.9], to: [10.95, 1.99], kind: 'shoot', label: 'in range', label_de: 'in Reichweite' },
            { from: [4.03, 4.46], to: [11.07, 5.14], kind: 'shoot-blocked', label: 'no line of sight', label_de: 'keine Sichtlinie' }
          ],
          notes: [{ x: 0.3, y: 0.6, text: 'range 8"', text_de: 'Reichweite 8"' }]
        }
      },
      {
        id: 'sho-resolve', title: 'Roll the attacks', title_de: 'Attacken auswürfeln',
        text: `<p>Now roll <b>hit</b>, <b>wound</b>, your opponent rolls <b>saves</b>, then apply <b>damage</b> – as explained in the basics on the attack sequence. Finish all attacks of this unit before the next one shoots.</p><p>Before you start, look at your stratagems for this phase – some boost a unit's shooting, and a <b>COMMAND RE-ROLL</b> can save a bad roll.</p>`,
        text_de: `<p>Jetzt würfelst du <b>Treffer</b> und <b>Verwundung</b>, dein Gegner würfelt <b>Schutzwürfe</b>, dann wird der <b>Schaden</b> verteilt – wie in den Grundlagen zur Attackensequenz erklärt. Handle alle Attacken dieser Einheit ab, bevor die nächste schießt.</p><p>Schau vorher in deine Strategeme für diese Phase – manche verstärken das Schießen einer Einheit, und ein <b>COMMAND RE-ROLL</b> kann einen schlechten Wurf retten.</p>`,
        tips: ['Shoot first with the unit whose result matters most – it may change what the others do.'],
        tips_de: ['Schieß zuerst mit der Einheit, deren Ergebnis am wichtigsten ist – das kann ändern, was die anderen tun.'],
        refs: ['04.03', '05', '15.02']
      }
    ],
    game: {
      you: [
        { text: 'Pick a unit; fell back or started an action → it cannot shoot', text_de: 'Einheit wählen; zurückgezogen oder Aktion begonnen → sie kann nicht schießen', refs: ['10.02', '09.07', '16.01'] },
        { text: 'Advanced → only [ASSAULT]; engaged → only [PISTOL]', text_de: 'Vorgerückt → nur [ASSAULT]; im Nahkampf → nur [PISTOL]', refs: ['10.05', '10.06'] },
        { text: 'Each weapon: target visible, in range, not engaged', text_de: 'Jede Waffe: Ziel sichtbar, in Reichweite, nicht im Nahkampf', refs: ['04.02'] },
        { text: 'Hit → wound → save → damage', text_de: 'Treffer → Verwundung → Schutzwurf → Schaden', refs: ['05'] },
        STRATS
      ],
      opp: [
        { text: 'Rolls the saves and removes casualties', text_de: 'Würfelt die Schutzwürfe und entfernt Verluste', refs: ['05.03'] },
        { text: 'May use stratagems, e.g. to give a unit cover', text_de: 'Kann Strategeme einsetzen, z. B. um einer Einheit Deckung zu geben', refs: ['15.10'] }
      ]
    }
  },

  // ═════════════════════════════ Charge phase ═════════════════════════════
  {
    id: 'charge-phase', part: 'phases', phase: 'charge',
    title: 'Charge phase', title_de: 'Angriffsphase',
    intro: 'Declare a charge, roll 2D6 and crash into the enemy.',
    intro_de: 'Angriff ansagen, 2W6 würfeln und in den Feind krachen.',
    steps: [
      {
        id: 'chg-roll', title: 'Declare and roll', title_de: 'Ansagen und würfeln',
        text: `<p>A unit can charge if it is <b>within 12"</b> of an enemy unit, is <b>not engaged</b> and did <b>not advance or fall back</b> this turn.</p><p>Declare the charge, then roll <b>2D6</b> – that is how far the models may move. Now choose the <b>targets</b>: enemy units within 12" whose distance is <b>no more than your roll</b>. An enemy 8" away cannot be chosen with a roll of 7.</p>`,
        text_de: `<p>Eine Einheit kann angreifen, wenn sie <b>innerhalb von 12"</b> zu einer gegnerischen Einheit steht, <b>nicht im Nahkampf</b> ist und in diesem Zug <b>nicht vorgerückt ist oder sich zurückgezogen hat</b>.</p><p>Sag den Angriff an und wirf dann <b>2W6</b> – so weit dürfen sich die Modelle bewegen. Jetzt wählst du die <b>Ziele</b>: gegnerische Einheiten innerhalb von 12", deren Abstand <b>nicht größer als dein Wurf</b> ist. Ein Gegner in 8" Entfernung kann bei einer 7 nicht gewählt werden.</p>`,
        tips: ['A COMMAND RE-ROLL re-rolls both charge dice – handy for the one charge that really matters.'],
        tips_de: ['Ein COMMAND RE-ROLL wiederholt beide Angriffswürfel – praktisch für den einen Angriff, der wirklich zählt.'],
        refs: ['11.02', '11.04', '15.02'],
        diagram: {
          w: 13, h: 8,
          caption: 'Charge roll 7: enemy A (6" away) can be a target, enemy B (8" away) cannot.',
          caption_de: 'Angriffswurf 7: Gegner A (6" entfernt) kann Ziel sein, Gegner B (8" entfernt) nicht.',
          lines: [
            { from: [2.42, 3.18], to: [8.28, 2.02], kind: 'measure', label: '6" ≤ 7"' },
            { from: [2.42, 5.02], to: [10.28, 6.48], kind: 'measure', label: '8" > 7"' }
          ],
          models: [M(1.8, 3.3, 0), M(1.8, 4.9, 0), M(8.9, 1.9, 1, { label: 'A', mark: 'target' }), M(10.9, 6.6, 1, { label: 'B', mark: 'bad' })],
          notes: [{ x: 0.3, y: 0.6, text: 'charge roll: 7', text_de: 'Angriffswurf: 7' }]
        }
      },
      {
        id: 'chg-move', title: 'The CHARGE MOVE', title_de: 'Der CHARGE MOVE',
        text: `<p>Move the models up to the rolled distance. Each model has to end <b>closer</b> to a target, every model that can end within 1" of a target must do so, and every model that can end within 2" of one must do so. At the end the unit must be <b>engaged with every target</b> and with no other enemy unit.</p><p>Success: the unit <b>fights first</b> in the Fight phase this turn (FIGHTS FIRST). If the move is not possible, the charge fails and the unit stays where it is.</p>`,
        text_de: `<p>Bewege die Modelle bis zur erwürfelten Distanz. Jedes Modell muss <b>näher</b> an einem Ziel enden, jedes Modell, das innerhalb von 1" zu einem Ziel enden kann, muss das tun, und ebenso jedes, das innerhalb von 2" enden kann. Am Ende muss die Einheit <b>mit jedem Ziel im Nahkampf</b> sein und mit keiner anderen gegnerischen Einheit.</p><p>Erfolg: Die Einheit <b>kämpft zuerst</b> in der Nahkampfphase dieses Zuges (FIGHTS FIRST). Ist die Bewegung nicht möglich, scheitert der Angriff und die Einheit bleibt stehen.</p>`,
        tips: ['Terrain in the way counts: a wall can make a charge fail even if the straight-line distance would be enough.'],
        tips_de: ['Gelände im Weg zählt mit: Eine Mauer kann einen Angriff scheitern lassen, auch wenn die Luftlinie reichen würde.'],
        refs: ['11.04', '11.02', '24.13'],
        diagram: {
          w: 12, h: 7,
          caption: 'Roll 7: every model ends closer to the target and within 2" of it – the unit is engaged and fights first.',
          caption_de: 'Wurf 7: Jedes Modell endet näher am Ziel und innerhalb von 2" dazu – die Einheit ist im Nahkampf und kämpft zuerst.',
          models: [
            M(1.6, 2.0, 0, { ghost: true }), M(1.6, 3.5, 0, { ghost: true }), M(1.6, 5.0, 0, { ghost: true }),
            M(8.0, 1.75, 0), M(8.34, 3.0, 0), M(8.2, 4.6, 0),
            M(9.6, 3.0, 1), M(9.6, 4.6, 1)
          ],
          arrows: [
            { from: [2.23, 1.98], to: [7.37, 1.78], kind: 'charge', label: '≤ 7"' },
            { from: [2.23, 3.45], to: [7.71, 3.05], kind: 'charge' },
            { from: [2.23, 4.96], to: [7.57, 4.64], kind: 'charge' }
          ],
          notes: [
            { x: 0.3, y: 0.6, text: 'charge roll: 7', text_de: 'Angriffswurf: 7' },
            { x: 6, y: 6.6, text: 'engaged → FIGHTS FIRST this turn', text_de: 'im Nahkampf → FIGHTS FIRST in diesem Zug', anchor: 'middle' }
          ]
        }
      },
      {
        id: 'chg-react', title: 'Reactions', title_de: 'Reaktionen',
        text: `<p>Charges can trigger stratagems on both sides. For example, your opponent can answer at the end of the phase with a <b>HEROIC INTERVENTION</b> and charge one of your units themselves. Big models of yours may ram the enemy right after charging.</p><p>Check your stratagems for the Charge phase before you roll – some must be used before or right after a charge.</p>`,
        text_de: `<p>Angriffe können auf beiden Seiten Strategeme auslösen. Dein Gegner kann zum Beispiel am Ende der Phase mit einer <b>HEROIC INTERVENTION</b> antworten und selbst eine deiner Einheiten angreifen. Deine großen Modelle können den Gegner direkt nach dem Angriff rammen.</p><p>Prüfe deine Strategeme für die Angriffsphase, bevor du würfelst – manche müssen vor oder direkt nach einem Angriff eingesetzt werden.</p>`,
        refs: ['15.11', '15.06', '15.01']
      }
    ],
    game: {
      you: [
        { text: 'Can charge: within 12", not engaged, did not advance or fall back', text_de: 'Darf angreifen: innerhalb 12", nicht im Nahkampf, nicht vorgerückt/zurückgezogen', refs: ['11.02'] },
        { text: 'Declare, roll 2D6, then choose targets within the roll', text_de: 'Ansagen, 2W6 würfeln, dann Ziele innerhalb des Wurfs wählen', refs: ['11.02', '11.04'] },
        { text: 'Move: end engaged with all targets, no other enemy', text_de: 'Bewegen: mit allen Zielen im Nahkampf enden, mit keinem anderen Gegner', refs: ['11.04'] },
        { text: 'Charged units have FIGHTS FIRST this turn', text_de: 'Einheiten, die angegriffen haben, haben in diesem Zug FIGHTS FIRST', refs: ['11.04', '24.13'] },
        STRATS
      ],
      opp: [
        { text: 'End of phase: may counter-charge, e.g. HEROIC INTERVENTION', text_de: 'Ende der Phase: kann zurückstürmen, z. B. HEROIC INTERVENTION', refs: ['15.11'] }
      ]
    }
  },

  // ═════════════════════════════ Fight phase ═════════════════════════════
  {
    id: 'fight-phase', part: 'phases', phase: 'fight',
    title: 'Fight phase', title_de: 'Nahkampfphase',
    intro: 'Both players fight: pile in, strike in turn, consolidate.',
    intro_de: 'Beide Spieler kämpfen: heranrücken, abwechselnd zuschlagen, konsolidieren.',
    steps: [
      {
        id: 'fgt-pilein', title: 'Pile in', title_de: 'Heranrücken',
        text: `<p>In the Fight phase <b>both players' units</b> fight – every unit that is engaged or charged this turn <b>must</b> fight.</p><p>First, you and then your opponent may <b>pile in</b>: each such unit moves up to <b>3"</b>. Models already in base contact stay put; the others move closer to the nearest enemy and into engagement range if they can. Only models within 2" of an enemy can attack, so piling in brings more of them into the fight.</p>`,
        text_de: `<p>In der Nahkampfphase kämpfen die Einheiten <b>beider Spieler</b> – jede Einheit, die im Nahkampf ist oder in diesem Zug angegriffen hat, <b>muss</b> kämpfen.</p><p>Zuerst du, dann dein Gegner dürfen <b>heranrücken</b> (Pile in): Jede dieser Einheiten bewegt sich bis zu <b>3"</b>. Modelle in Basekontakt bleiben stehen, die anderen rücken näher an den nächsten Gegner und, wenn möglich, in Nahkampfreichweite. Nur Modelle innerhalb von 2" zu einem Gegner können attackieren – Heranrücken bringt also mehr von ihnen in den Kampf.</p>`,
        refs: ['12', '12.01', '12.02', '12.03', '12.04'],
        diagram: {
          w: 10, h: 6,
          caption: 'Pile in: the two outer models move up to 3" toward the nearest enemy and end within 2" of it.',
          caption_de: 'Heranrücken: Die beiden äußeren Modelle bewegen sich bis zu 3" auf den nächsten Gegner zu und enden innerhalb von 2" zu ihm.',
          models: [
            M(5.0, 2.6, 0), M(3.0, 1.0, 0, { ghost: true }), M(5.3, 1.2, 0), M(3.2, 4.4, 0, { ghost: true }), M(5.6, 4.3, 0),
            M(6.26, 2.6, 1), M(7.0, 3.9, 1)
          ],
          arrows: [
            { from: [3.0, 1.0], to: [4.67, 1.15], kind: 'pile', label: '≤ 3"' },
            { from: [3.2, 4.4], to: [4.97, 4.33], kind: 'pile' }
          ],
          notes: [{ x: 5, y: 5.7, text: 'in base contact: stays', text_de: 'in Basekontakt: bleibt stehen', anchor: 'middle' }]
        }
      },
      {
        id: 'fgt-order', title: 'Who strikes first', title_de: 'Wer zuerst zuschlägt',
        text: `<p>Units fight one at a time, the players taking turns:</p><ul><li>First all units with <b>FIGHTS FIRST</b> – that includes every unit that charged this turn. You start, then your opponent, and so on.</li><li>Then all other units, again alternating.</li></ul><p>When a unit fights, each model picks one melee weapon and attacks enemy units within 2" of it. Roll the attacks just like shooting. A unit that charged but whose target is already gone may pile in again and still fight (OVERRUN FIGHT).</p>`,
        text_de: `<p>Die Einheiten kämpfen nacheinander, die Spieler wechseln sich ab:</p><ul><li>Zuerst alle Einheiten mit <b>FIGHTS FIRST</b> – dazu gehört jede Einheit, die in diesem Zug angegriffen hat. Du beginnst, dann dein Gegner und so weiter.</li><li>Danach alle anderen Einheiten, wieder abwechselnd.</li></ul><p>Wenn eine Einheit kämpft, wählt jedes Modell eine Nahkampfwaffe und attackiert gegnerische Einheiten innerhalb von 2". Die Attacken werden wie beim Schießen ausgewürfelt. Eine Einheit, die angegriffen hat, deren Ziel aber schon weg ist, darf erneut heranrücken und trotzdem kämpfen (OVERRUN FIGHT).</p>`,
        tips: ['Think about the order: kill the enemy unit that would hit back hardest before it gets its turn.', 'Your opponent may have a stratagem that lets one of their units strike next – check yours too.'],
        tips_de: ['Denk an die Reihenfolge: Schalte die gegnerische Einheit aus, die am härtesten zurückschlagen würde, bevor sie dran ist.', 'Dein Gegner hat vielleicht ein Strategem, mit dem eine seiner Einheiten als Nächste zuschlägt – prüfe auch deine.'],
        refs: ['12.04', '12.05', '12.06', '04.01', '04.02', '24.13']
      },
      {
        id: 'fgt-consolidate', title: 'Consolidate', title_de: 'Konsolidieren',
        text: `<p>When all fights are over, you and then your opponent may <b>consolidate</b>: every unit that fought moves up to <b>3"</b>. Which way is not a free choice:</p><ul><li>still engaged → closer into the fight,</li><li>an enemy within 3" → into engagement with it (if it has not fought yet, it now fights back),</li><li>otherwise an objective within 3" → onto the objective.</li></ul>`,
        text_de: `<p>Wenn alle Kämpfe vorbei sind, dürfen erst du, dann dein Gegner <b>konsolidieren</b> (Consolidate): Jede Einheit, die gekämpft hat, bewegt sich bis zu <b>3"</b>. Die Richtung ist nicht frei wählbar:</p><ul><li>noch im Nahkampf → enger in den Kampf,</li><li>ein Gegner innerhalb von 3" → in den Nahkampf mit ihm (hat er noch nicht gekämpft, schlägt er jetzt zurück),</li><li>sonst ein Missionsziel innerhalb von 3" → auf das Missionsziel.</li></ul>`,
        tips: ['Consolidating onto an objective is a great way to finish a won fight.'],
        tips_de: ['Nach einem gewonnenen Kampf aufs Missionsziel nachzurücken ist ein starker Abschluss.'],
        refs: ['12.07', '12.08', '12.09'],
        diagram: {
          w: 12, h: 6,
          caption: 'An enemy unit is within 3": the unit consolidates up to 3" into engagement with it.',
          caption_de: 'Eine gegnerische Einheit ist innerhalb von 3": Die Einheit rückt bis zu 3" nach, in den Nahkampf mit ihr.',
          models: [M(4.6, 2.6, 0, { ghost: true }), M(4.4, 4.2, 0, { ghost: true }), M(7.0, 2.5, 0), M(6.9, 4.0, 0), M(8.4, 2.4, 1), M(8.6, 3.9, 1)],
          arrows: [
            { from: [4.6, 2.6], to: [6.37, 2.53], kind: 'consolidate', label: '≤ 3"' },
            { from: [4.4, 4.2], to: [6.27, 4.05], kind: 'consolidate' }
          ],
          notes: [{ x: 6, y: 5.6, text: 'if it has not fought yet, it fights now', text_de: 'hat er noch nicht gekämpft, kämpft er jetzt', anchor: 'middle' }]
        }
      }
    ],
    game: {
      you: [
        { text: 'Pile in up to 3": you first, then your opponent', text_de: 'Heranrücken bis 3": erst du, dann dein Gegner', refs: ['12.02', '12.03'] },
        { text: 'FIGHTS FIRST units (all chargers) fight first, alternating – you start', text_de: 'FIGHTS FIRST-Einheiten (alle Angreifer) kämpfen zuerst, abwechselnd – du beginnst', refs: ['12.04'] },
        { text: 'Then all other units, alternating', text_de: 'Dann alle anderen Einheiten, abwechselnd', refs: ['12.04'] },
        { text: 'Each model: one melee weapon against enemies within 2"', text_de: 'Jedes Modell: eine Nahkampfwaffe gegen Gegner innerhalb 2"', refs: ['04.01', '04.02'] },
        { text: 'Consolidate up to 3": into the fight or onto an objective', text_de: 'Konsolidieren bis 3": in den Kampf oder aufs Missionsziel', refs: ['12.07', '12.08'] },
        STRATS
      ],
      opp: [
        { text: 'Piles in and consolidates after you', text_de: 'Rückt nach dir heran und nach', refs: ['12.02', '12.07'] },
        { text: 'Picks their own units to fight in between – all of them must fight', text_de: 'Wählt abwechselnd eigene Einheiten zum Kämpfen – alle müssen kämpfen', refs: ['12.04'] },
        { text: 'May use fight stratagems too, e.g. to strike next', text_de: 'Kann ebenfalls Nahkampf-Strategeme einsetzen, z. B. um als Nächster zuzuschlagen', refs: ['15.12'] }
      ]
    }
  },

  // ═════════════════════════════ End of turn ═════════════════════════════
  {
    id: 'end-of-turn', part: 'phases', phase: 'end',
    title: 'End of the turn', title_de: 'Ende des Zuges',
    intro: 'Check the objectives, tidy up, score your mission – then hand over.',
    intro_de: 'Missionsziele prüfen, aufräumen, Mission werten – dann übergeben.',
    steps: [
      {
        id: 'end-objectives', title: 'Who controls the objectives', title_de: 'Wer die Missionsziele kontrolliert',
        text: `<p>First check every objective: add up the <b>OC</b> of each player's models within range – within 3" of an objective marker, or inside the terrain area of a terrain objective. The <b>higher total</b> controls it; on a tie nobody does. Battle-shocked models count for nothing.</p>`,
        text_de: `<p>Prüfe zuerst jedes Missionsziel: Zähle den <b>OC</b> aller Modelle jedes Spielers in Reichweite zusammen – innerhalb von 3" zu einem Missionszielmarker oder im Geländebereich eines Gelände-Missionsziels. Die <b>höhere Summe</b> kontrolliert es; bei Gleichstand niemand. Kampfgeschockte Modelle zählen nicht.</p>`,
        tips: ['Control is checked at the end of every phase, not only at the end of the turn.'],
        tips_de: ['Die Kontrolle wird am Ende jeder Phase geprüft, nicht nur am Ende des Zuges.'],
        refs: ['14.02', '14.02.01', '14.01.01', '01.07'],
        diagram: {
          w: 12, h: 8,
          caption: 'Your OC 2 + 2 = 4 beats the enemy\'s 1 + 1 + 1 = 3. The model outside 3" and the battle-shocked model (OC –) do not count.',
          caption_de: 'Dein OC 2 + 2 = 4 schlägt den gegnerischen OC 1 + 1 + 1 = 3. Das Modell außerhalb von 3" und das kampfgeschockte Modell (OC –) zählen nicht.',
          objectives: [{ x: 6, y: 4, ring: true }],
          models: [
            M(3.5, 3.0, 0, { label: '2' }), M(3.4, 4.5, 0, { label: '2' }),
            M(8.4, 3.2, 1, { label: '1' }), M(8.6, 4.6, 1, { label: '1' }), M(8.0, 5.9, 1, { label: '1' }), M(10.6, 6.9, 1, { label: '1', mark: 'bad' }),
            M(6.0, 7.2, 1, { label: '–', mark: 'shock' })
          ],
          notes: [
            { x: 0.3, y: 0.6, text: 'you: 4', text_de: 'du: 4', side: 0 },
            { x: 11.7, y: 0.6, text: 'enemy: 3', text_de: 'Gegner: 3', side: 1, anchor: 'end' }
          ]
        }
      },
      {
        id: 'end-tidy', title: 'Tidy up and score', title_de: 'Aufräumen und werten',
        text: `<p>Any unit that is no longer in <b>coherency</b> (e.g. casualties split it into two groups) removes models until it is one group again – those models are destroyed.</p><p>Then both players score their <b>missions</b>: you what triggers "at the end of your turn", your opponent what triggers at the end of their opponent's turn. With tactical secondary missions, achieved cards are discarded; at the end of your turn you may also discard other cards to gain 1 CP.</p>`,
        text_de: `<p>Jede Einheit, die nicht mehr <b>kohärent</b> ist (z. B. weil Verluste sie in zwei Gruppen geteilt haben), entfernt Modelle, bis sie wieder eine Gruppe ist – diese Modelle gelten als vernichtet.</p><p>Dann werten beide Spieler ihre <b>Missionen</b>: du, was „am Ende deines Zuges“ greift, dein Gegner, was am Ende des gegnerischen Zuges greift. Bei taktischen Sekundärmissionen werden erfüllte Karten abgeworfen; am Ende deines Zuges kannst du zusätzlich andere Karten abwerfen und dafür 1 BP erhalten.</p>`,
        tips: ['Remove casualties from the ends of a line, not the middle, so the unit stays in one piece.', 'Note your points right away – a forgotten card is easy to miss at the end of a long turn.'],
        tips_de: ['Entferne Verluste an den Enden einer Linie, nicht in der Mitte, damit die Einheit zusammenbleibt.', 'Notiere deine Punkte sofort – eine vergessene Karte übersieht man am Ende eines langen Zuges leicht.'],
        refs: ['07.03', '03.03', '16.01']
      },
      {
        id: 'end-next', title: 'Hand over – or end the round', title_de: 'Übergeben – oder die Runde beenden',
        text: `<p>If you were the first player, your opponent now starts their turn. If you were the second player, the <b>battle round ends</b> and the next one begins. After the last round (usually the fifth) the battle is over.</p>`,
        text_de: `<p>Warst du der erste Spieler, beginnt jetzt dein Gegner seinen Zug. Warst du der zweite Spieler, <b>endet die Schlachtrunde</b> und die nächste beginnt. Nach der letzten Runde (meist der fünften) ist die Schlacht vorbei.</p>`,
        tips: ['Units still in strategic reserves at the end of the third battle round are destroyed – bring them in by then.'],
        tips_de: ['Einheiten, die am Ende der dritten Schlachtrunde noch in Strategischen Reserven sind, werden vernichtet – bring sie bis dahin ins Spiel.'],
        refs: ['07.02', '07.03', '20.04']
      }
    ],
    game: {
      you: [
        { text: 'Check who controls each objective (OC totals)', text_de: 'Prüfen, wer welches Missionsziel kontrolliert (OC-Summen)', refs: ['14.02', '14.02.01'] },
        { text: 'Remove models from units out of coherency', text_de: 'Modelle aus nicht kohärenten Einheiten entfernen', refs: ['03.03'] },
        { text: 'Score your "end of your turn" missions', text_de: 'Missionen „am Ende deines Zuges“ werten', refs: ['07.03'] },
        { text: 'Tactical: discard achieved cards; discard others for +1 CP', text_de: 'Taktisch: erfüllte Karten abwerfen; andere für +1 BP abwerfen', refs: ['07.03'] },
        STRATS
      ],
      opp: [
        { text: 'Scores their "end of opponent\'s turn" missions', text_de: 'Wertet seine Missionen „am Ende des gegnerischen Zuges“', refs: ['07.03'] },
        { text: 'Removes models from their own units out of coherency', text_de: 'Entfernt Modelle aus eigenen nicht kohärenten Einheiten', refs: ['03.03'] }
      ]
    }
  },

  // ═════════════════════════════ More rules ═════════════════════════════
  {
    id: 'transports', part: 'more',
    title: 'Transports', title_de: 'Transporter',
    intro: 'Riding into battle inside a TRANSPORT.',
    intro_de: 'In einem TRANSPORT in die Schlacht fahren.',
    steps: [
      {
        id: 'tr-in', title: 'Getting in', title_de: 'Einsteigen',
        text: `<p>A TRANSPORT's datasheet says which models fit inside and how many. Units can start the battle <b>embarked</b>; a DEDICATED TRANSPORT must start with a unit inside. Later, a unit can embark right after moving if every model ended within <b>3"</b> of the TRANSPORT.</p><p>Embarked units are <b>off the battlefield</b>: they cannot be seen or attacked – and cannot shoot themselves, unless the TRANSPORT has FIRING DECK.</p>`,
        text_de: `<p>Das Datenblatt eines TRANSPORT sagt, welche Modelle hineinpassen und wie viele. Einheiten können die Schlacht <b>eingestiegen</b> beginnen; ein DEDICATED TRANSPORT muss mit einer Einheit darin beginnen. Später kann eine Einheit direkt nach einer Bewegung einsteigen, wenn jedes Modell innerhalb von <b>3"</b> zum TRANSPORT endet.</p><p>Eingestiegene Einheiten sind <b>nicht auf dem Schlachtfeld</b>: Sie können weder gesehen noch angegriffen werden – und selbst nicht schießen, außer der TRANSPORT hat FIRING DECK.</p>`,
        refs: ['18.01', '18.02', '24.14']
      },
      {
        id: 'tr-out', title: 'Getting out', title_de: 'Aussteigen',
        text: `<p>In your Movement phase the passengers get out by setting up <b>wholly within 3"</b> of the TRANSPORT (not within 2" of enemies).</p><ul><li>If they get out <b>before the TRANSPORT moves</b>, they may then move normally and charge this turn.</li><li>If the TRANSPORT <b>already moved</b>, they get out but cannot charge this turn.</li><li>If the TRANSPORT advanced or fell back, nobody gets out this phase.</li></ul><p>If the TRANSPORT is destroyed, the passengers must bail out within 6" – some may get hurt, and they are battle-shocked.</p>`,
        text_de: `<p>In deiner Bewegungsphase steigen die Passagiere aus, indem sie <b>vollständig innerhalb von 3"</b> zum TRANSPORT aufgestellt werden (nicht innerhalb von 2" zu Gegnern).</p><ul><li>Steigen sie aus, <b>bevor der TRANSPORT sich bewegt</b>, dürfen sie sich danach normal bewegen und in diesem Zug angreifen.</li><li>Hat sich der TRANSPORT <b>schon bewegt</b>, steigen sie aus, dürfen in diesem Zug aber nicht angreifen.</li><li>Ist der TRANSPORT vorgerückt oder hat sich zurückgezogen, steigt in dieser Phase niemand aus.</li></ul><p>Wird der TRANSPORT zerstört, müssen die Passagiere innerhalb von 6" aussteigen – dabei kann es Verluste geben, und sie sind kampfgeschockt.</p>`,
        refs: ['18.03', '18.04', '18.05'],
        diagram: {
          w: 12, h: 8.6,
          caption: 'Getting out before the TRANSPORT moves: set up wholly within 3" of it, then move. The crossed-out model sticks out of the 3" zone.',
          caption_de: 'Aussteigen, bevor der TRANSPORT fährt: vollständig innerhalb von 3" aufstellen, dann bewegen. Das durchgestrichene Modell ragt aus der 3"-Zone.',
          terrain: [{ type: 'area', poly: grow(3.2, 3.2, 6.8, 5.4, 3) }],
          lines: [{ from: [5.0, 3.2], to: [5.0, 0.2], kind: 'measure', label: '3"' }],
          models: [
            M(5.0, 4.3, 0, { shape: 'rect', rw: 3.6, rh: 2.2, label: 'TRANSPORT' }),
            M(7.6, 3.6, 0), M(7.7, 5.0, 0), M(8.9, 4.3, 0), M(7.8, 6.4, 0), M(9.2, 2.4, 0, { mark: 'bad' })
          ],
          arrows: [{ from: [9.6, 4.3], to: [11.4, 4.3], kind: 'move', label: 'then move', label_de: 'dann bewegen' }]
        }
      }
    ]
  },
  {
    id: 'attached-units', part: 'more',
    title: 'Leaders and attached units', title_de: 'Anführer und angeschlossene Einheiten',
    intro: 'Characters that join a squad and fight as one unit.',
    intro_de: 'Charaktermodelle, die sich einem Trupp anschließen und als eine Einheit kämpfen.',
    steps: [
      {
        id: 'att-form', title: 'One unit with a leader', title_de: 'Eine Einheit mit Anführer',
        text: `<p>Characters with <b>LEADER</b> (or <b>SUPPORT</b>) can join one of the units listed on their datasheet – the bodyguard. You decide this when you build your army, and it lasts the whole battle. From then on they are <b>one unit</b>: they move, shoot and fight together and must stay in coherency.</p><p>Attacks against the unit use the <b>Toughness of the bodyguard</b>, and the character is usually hit last. The leader's abilities help the whole unit as long as the leader lives.</p>`,
        text_de: `<p>Charaktermodelle mit <b>LEADER</b> (oder <b>SUPPORT</b>) können sich einer auf ihrem Datenblatt genannten Einheit anschließen – der Leibwache. Das legst du beim Aufstellen der Armee fest, und es gilt für die ganze Schlacht. Ab dann sind sie <b>eine Einheit</b>: Sie bewegen sich, schießen und kämpfen zusammen und müssen kohärent bleiben.</p><p>Attacken gegen die Einheit nutzen die <b>Toughness der Leibwache</b>, und das Charaktermodell wird meist zuletzt getroffen. Die Fähigkeiten des Anführers helfen der ganzen Einheit, solange er lebt.</p>`,
        tips: ['Weapons with [PRECISION] can pick out the character inside the unit.'],
        tips_de: ['Waffen mit [PRECISION] können das Charaktermodell gezielt in der Einheit treffen.'],
        refs: ['19.01', '19.02', '19.04', '24.22', '24.28'],
        diagram: {
          w: 11, h: 5,
          caption: 'A leader (L) attached to four bodyguard models: one unit. Attacks against it use the bodyguard\'s T5.',
          caption_de: 'Ein Anführer (L) bei vier Leibwächtern: eine Einheit. Attacken dagegen nutzen T5 der Leibwache.',
          models: [M(1.5, 2.5, 0, { label: 'T5' }), M(2.9, 2.5, 0, { label: 'T5' }), M(4.45, 2.5, 0, { r: 0.79, label: 'L' }), M(5.97, 2.5, 0, { label: 'T5' }), M(7.37, 2.5, 0, { label: 'T5' })],
          notes: [{ x: 4.45, y: 4.3, text: 'one unit: LEADER + bodyguard', text_de: 'eine Einheit: LEADER + Leibwache', anchor: 'middle' }]
        }
      }
    ]
  },
  {
    id: 'reserves', part: 'more',
    title: 'Reserves and DEEP STRIKE', title_de: 'Reserven und DEEP STRIKE',
    intro: 'Keep units off the table and bring them in later.',
    intro_de: 'Einheiten vom Tisch fernhalten und später ins Spiel bringen.',
    steps: [
      {
        id: 'res-place', title: 'Strategic reserves', title_de: 'Strategische Reserven',
        text: `<p>Before the battle you can put units into <b>strategic reserves</b> instead of deploying them – at most <b>half your points</b>. From the <b>second battle round</b> they arrive in your Movement phase: wholly within 6" of a battlefield edge and more than 8" from all enemy units (before round 3 not in the enemy deployment zone).</p><p>Units that have not arrived by the end of the <b>third round</b> are destroyed.</p>`,
        text_de: `<p>Vor der Schlacht kannst du Einheiten in <b>Strategische Reserven</b> stellen, statt sie aufzustellen – höchstens <b>die Hälfte deiner Punkte</b>. Ab der <b>zweiten Schlachtrunde</b> kommen sie in deiner Bewegungsphase an: vollständig innerhalb von 6" zu einer Spielfeldkante und mehr als 8" von allen gegnerischen Einheiten entfernt (vor Runde 3 nicht in der gegnerischen Aufstellungszone).</p><p>Einheiten, die bis zum Ende der <b>dritten Runde</b> nicht angekommen sind, werden vernichtet.</p>`,
        refs: ['20.01', '20.03', '20.04']
      },
      {
        id: 'res-deepstrike', title: 'DEEP STRIKE', title_de: 'DEEP STRIKE',
        text: `<p>If <b>every model</b> in a unit has DEEP STRIKE, it can arrive <b>anywhere</b> on the battlefield more than 8" from all enemy units – even deep inside the enemy deployment zone. It still arrives from the second battle round on.</p>`,
        text_de: `<p>Hat <b>jedes Modell</b> einer Einheit DEEP STRIKE, kann sie <b>überall</b> auf dem Schlachtfeld ankommen, wo sie mehr als 8" von allen gegnerischen Einheiten entfernt ist – sogar tief in der gegnerischen Aufstellungszone. Sie kommt trotzdem erst ab der zweiten Schlachtrunde.</p>`,
        tips: ['Spread your own units out: an enemy deep striker needs a spot more than 8" from all of them.', 'From more than 8" away, a charge needs at least a 9.'],
        tips_de: ['Verteile deine eigenen Einheiten: Ein gegnerischer Deep Striker braucht einen Platz mehr als 8" von allen entfernt.', 'Aus mehr als 8" braucht ein Angriff mindestens eine 9.'],
        refs: ['24.09', '20.04'],
        diagram: {
          w: 16, h: 9,
          caption: 'DEEP STRIKE: set up more than 8" from every enemy unit – here even inside the enemy deployment zone. The crossed-out spot is too close.',
          caption_de: 'DEEP STRIKE: mehr als 8" von jeder gegnerischen Einheit entfernt aufstellen – hier sogar in der gegnerischen Aufstellungszone. Die durchgestrichene Stelle ist zu nah.',
          zones: [{ x: 11, y: 0, w: 5, h: 9, side: 1, label: 'enemy deployment zone', label_de: 'gegn. Aufstellungszone' }],
          rings: [{ x: 4, y: 3, r: 8.63, kind: 'range' }, { x: 4.3, y: 4.5, r: 8.63, kind: 'range' }],
          lines: [{ from: [4.63, 3.0], to: [12.63, 3.0], kind: 'measure', label: '8"' }],
          models: [M(4, 3, 1), M(4.3, 4.5, 1), M(14.6, 3.0, 0), M(14.6, 4.6, 0), M(11.8, 6.4, 0, { ghost: true, mark: 'bad' })],
          arrows: [{ from: [15.6, 0.4], to: [15.0, 2.2], kind: 'deepstrike' }],
          notes: [{ x: 0.3, y: 8.6, text: 'anywhere more than 8" from all enemies', text_de: 'überall mit mehr als 8" Abstand zu allen Gegnern' }]
        }
      }
    ]
  },
  {
    id: 'big-and-flying', part: 'more',
    title: 'Monsters, vehicles, flyers and aircraft', title_de: 'Monster, Fahrzeuge, Flieger und Flugzeuge',
    intro: 'What changes for big models and for models that can fly.',
    intro_de: 'Was sich für große Modelle und für Modelle, die fliegen können, ändert.',
    steps: [
      {
        id: 'big-models', title: 'Monsters and vehicles', title_de: 'Monster und Fahrzeuge',
        text: `<ul><li>With a NORMAL or ADVANCE MOVE they can drive <b>through enemy models</b> (not through other MONSTERS/VEHICLES) – but must still end more than 2" away.</li><li>They cannot go through tall ruins and buildings; they have to drive around.</li><li>In melee they can keep shooting all their guns at -1 to hit, and your other units can shoot an engaged enemy MONSTER/VEHICLE at -1 to hit.</li><li>Models without a base (FRAME) are measured to the closest point of the model itself.</li></ul>`,
        text_de: `<ul><li>Bei einem NORMAL oder ADVANCE MOVE können sie <b>durch gegnerische Modelle</b> fahren (nicht durch andere MONSTER/VEHICLE) – müssen aber trotzdem mehr als 2" entfernt enden.</li><li>Durch hohe Ruinen und Gebäude kommen sie nicht; sie müssen außen herum.</li><li>Im Nahkampf können sie mit allen Waffen weiterschießen, mit -1 auf Treffer, und deine anderen Einheiten dürfen auf ein gegnerisches MONSTER/VEHICLE im Nahkampf schießen, ebenfalls mit -1.</li><li>Modelle ohne Base (FRAME) werden zum nächsten Punkt des Modells selbst gemessen.</li></ul>`,
        refs: ['17.01', '13.06', '10.06', '17.03', '17.02']
      },
      {
        id: 'fly', title: 'FLY: taking to the skies', title_de: 'FLY: abheben',
        text: `<p>A unit with <b>FLY</b> may declare before it moves (before any dice are rolled) that it <b>takes to the skies</b>: its move is <b>2" shorter</b>, but it ignores height and can pass over all models and all terrain. (HOVER units do not lose the 2".)</p><p>Some abilities also allow a sudden <b>surge move</b> toward the nearest enemy, outside the normal turn order – the ability explains when.</p>`,
        text_de: `<p>Eine Einheit mit <b>FLY</b> kann vor ihrer Bewegung (bevor gewürfelt wird) ansagen, dass sie <b>abhebt</b>: Ihre Bewegung ist <b>2" kürzer</b>, dafür ignoriert sie Höhen und kann über alle Modelle und jedes Gelände hinweg. (HOVER-Einheiten verlieren die 2" nicht.)</p><p>Manche Fähigkeiten erlauben außerdem einen plötzlichen <b>Surge Move</b> auf den nächsten Gegner zu, außerhalb der normalen Reihenfolge – die Fähigkeit sagt, wann.</p>`,
        refs: ['21.03', '24.17', '21.02'],
        diagram: {
          w: 15, h: 7,
          caption: 'M 14", taking to the skies: 12" straight over the ruin and the enemy line – it still has to end more than 2" from the enemy.',
          caption_de: 'M 14", abgehoben: 12" geradeaus über die Ruine und die gegnerische Linie – das Modell muss trotzdem mehr als 2" vom Gegner entfernt enden.',
          terrain: [{ x: 4.0, y: 1.0, w: 3.0, h: 5.0, type: 'ruin', label: 'ruin', label_de: 'Ruine', ly: 5.4 }],
          models: [M(1.2, 3.5, 0, { ghost: true }), M(13.2, 3.5, 0), M(9.4, 2.0, 1), M(9.4, 3.4, 1), M(9.4, 4.8, 1)],
          arrows: [{ from: [1.83, 3.5], to: [12.57, 3.5], kind: 'move', label: '14" − 2"' }]
        }
      },
      {
        id: 'aircraft', title: 'AIRCRAFT', title_de: 'AIRCRAFT',
        text: `<p>AIRCRAFT always start in strategic reserves and only ever arrive with an ingress move. At the end of your opponent's turn they leave again – so they swoop in during each of your turns. Other units can move through them; they cannot charge, and only FLYING units can fight them in melee.</p>`,
        text_de: `<p>AIRCRAFT beginnen immer in Strategischen Reserven und kommen nur per INGRESS MOVE ins Spiel. Am Ende des gegnerischen Zuges verlassen sie das Feld wieder – sie fliegen also in jedem deiner Züge neu ein. Andere Einheiten dürfen sich durch sie bewegen; sie können nicht angreifen, und nur FLYING-Einheiten können sie im Nahkampf bekämpfen.</p>`,
        refs: ['23.01', '23.02', '23.04']
      }
    ]
  },
  {
    id: 'abilities', part: 'more',
    title: 'Abilities and auras', title_de: 'Fähigkeiten und Auren',
    intro: 'How to read the abilities on your datasheets.',
    intro_de: 'Wie du die Fähigkeiten auf deinen Datenblättern liest.',
    steps: [
      {
        id: 'ab-read', title: 'Reading abilities', title_de: 'Fähigkeiten lesen',
        text: `<p>Abilities in square brackets belong to weapons – [ASSAULT], [PISTOL], [RAPID FIRE 1], [LETHAL HITS] … Others belong to the unit – DEEP STRIKE, FEEL NO PAIN 5+, STEALTH … The app shows the exact rule text when you tap them.</p><p>The same ability twice does <b>not stack</b>. A keyword after an ability, like [ANTI-VEHICLE 4+], means it only works against units with that keyword.</p>`,
        text_de: `<p>Fähigkeiten in eckigen Klammern gehören zu Waffen – [ASSAULT], [PISTOL], [RAPID FIRE 1], [LETHAL HITS] … Andere gehören zur Einheit – DEEP STRIKE, FEEL NO PAIN 5+, STEALTH … Die App zeigt den genauen Regeltext, wenn du sie antippst.</p><p>Dieselbe Fähigkeit zweimal <b>addiert sich nicht</b>. Ein Schlüsselwort hinter einer Fähigkeit, etwa [ANTI-VEHICLE 4+], heißt: Sie wirkt nur gegen Einheiten mit diesem Schlüsselwort.</p>`,
        refs: ['24', '24.01', '24.02']
      },
      {
        id: 'ab-aura', title: 'Auras', title_de: 'Auren',
        text: `<p>An <b>Aura</b> ability affects units within a stated distance of its bearer. A unit is within range as soon as one of its models is. The same aura only counts once for a unit, even if two models carrying it are close.</p>`,
        text_de: `<p>Eine <b>Aura</b>-Fähigkeit wirkt auf Einheiten innerhalb einer bestimmten Entfernung zu ihrem Träger. Eine Einheit ist in Reichweite, sobald eines ihrer Modelle es ist. Dieselbe Aura zählt für eine Einheit nur einmal, auch wenn zwei Träger in der Nähe sind.</p>`,
        refs: ['22.01', '01.04'],
        diagram: {
          w: 12, h: 8.4,
          caption: 'Aura 3": unit A has a model within 3" of the character and is affected; unit B is not.',
          caption_de: 'Aura 3": Einheit A hat ein Modell innerhalb von 3" zum Charaktermodell und ist betroffen; Einheit B nicht.',
          rings: [{ x: 6, y: 4.3, r: 3.79, kind: 'aura', label: 'Aura 3"', label_de: 'Aura 3"' }],
          models: [M(6, 4.3, 0, { r: 0.79, label: 'C' }), M(9.0, 2.3, 0, { label: 'A', mark: 'ok' }), M(10.4, 1.5, 0, { label: 'A' }), M(1.4, 5.6, 0, { label: 'B', mark: 'bad' }), M(1.0, 7.0, 0, { label: 'B' })]
        }
      }
    ]
  },
  {
    id: 'mustering', part: 'more',
    title: 'Mustering an army', title_de: 'Eine Armee aufstellen',
    intro: 'What goes into an army list.',
    intro_de: 'Was in eine Armeeliste gehört.',
    steps: [
      {
        id: 'mu-size', title: 'Battle size and detachments', title_de: 'Spielgröße und Detachments',
        text: `<p>Choose your <b>army faction</b> and agree on a battle size with your opponent:</p><ul><li><b>Incursion</b>: 1000 points, 2 Detachment Points (DP), up to 2 enhancements, max. 2 units with the same name.</li><li><b>Strike Force</b>: 2000 points, 3 DP, up to 4 enhancements, max. 3 units with the same name.</li></ul><p>BATTLELINE and DEDICATED TRANSPORT units may be taken twice as often, every EPIC HERO only once. Spend your DP on <b>detachments</b> of your faction – they bring rules, enhancements and stratagems.</p>`,
        text_de: `<p>Wähle deine <b>Armeefraktion</b> und einigt euch auf eine Spielgröße:</p><ul><li><b>Incursion</b>: 1000 Punkte, 2 Detachment Points (DP), bis zu 2 Optimierungen, max. 2 Einheiten mit gleichem Namen.</li><li><b>Strike Force</b>: 2000 Punkte, 3 DP, bis zu 4 Optimierungen, max. 3 Einheiten mit gleichem Namen.</li></ul><p>BATTLELINE- und DEDICATED TRANSPORT-Einheiten dürfen doppelt so oft genommen werden, jeder EPIC HERO nur einmal. Gib deine DP für <b>Detachments</b> deiner Fraktion aus – sie bringen Regeln, Optimierungen und Strategeme mit.</p>`,
        refs: ['25.02', '25.03', '25.04']
      },
      {
        id: 'mu-units', title: 'Units, Warlord, leaders, enhancements', title_de: 'Einheiten, Kriegsherr, Anführer, Optimierungen',
        text: `<ul><li>Add units of your faction with their wargear; note models and points.</li><li>Pick one CHARACTER model as your <b>WARLORD</b>.</li><li>Attach LEADER and SUPPORT units to their bodyguard units.</li><li>Give <b>enhancements</b> to CHARACTER units (not EPIC HEROES) – each one only once, at most one per unit.</li></ul><p>Show your finished list to your opponent before the game.</p>`,
        text_de: `<ul><li>Füge Einheiten deiner Fraktion mit ihrer Ausrüstung hinzu; notiere Modelle und Punkte.</li><li>Wähle ein Charaktermodell als deinen <b>Kriegsherrn</b> (WARLORD).</li><li>Schließe LEADER- und SUPPORT-Einheiten ihren Leibwachen an.</li><li>Gib <b>Optimierungen</b> an CHARACTER-Einheiten (keine EPIC HEROES) – jede nur einmal, höchstens eine pro Einheit.</li></ul><p>Zeig deine fertige Liste vor dem Spiel deinem Gegner.</p>`,
        refs: ['25.01', '25.04', '19.01']
      }
    ]
  }
];
