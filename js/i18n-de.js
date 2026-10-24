/* German interface texts (js/i18n.js). PHRASES: interface wording (game terms stay English here – TERMS turns them into
 * the official GW German terms unless the player keeps game terms in English). Only terms whose official German wording is
 * certain are in TERMS; everything else (e.g. Detachment, Battleline, battle sizes, 11th-edition terms) stays English.
 * Rules content (abilities, stratagem texts, datasheets …) is never translated – see SKIP in js/i18n.js. */

export const TERMS = {
  'Stratagems': 'Strategeme', 'Stratagem': 'Strategem',
  'Command Points': 'Befehlspunkte', 'CP': 'BP',
  'Victory Points': 'Siegpunkte', 'VP': 'SP',
  'Command phase': 'Kommandophase', 'Movement phase': 'Bewegungsphase', 'Shooting phase': 'Fernkampfphase',
  'Charge phase': 'Angriffsphase', 'Fight phase': 'Nahkampfphase',
  'Command phases': 'Kommandophasen',
  'Battle-shocked': 'kampfgeschockt', 'Battle-shock': 'Kampfschock', 'battle-shocked': 'kampfgeschockte',
  'Enhancements': 'Optimierungen', 'Enhancement': 'Optimierung',
  'Leaders': 'Anführer', 'Leader': 'Anführer', 'leader': 'Anführer', 'leaders': 'Anführer',
  'Warlord': 'Kriegsherr', 'Characters': 'Charaktermodelle', 'Character': 'Charaktermodell',
  'Epic Hero': 'Epischer Held', 'Infantry': 'Infanterie', 'Vehicle': 'Fahrzeug', 'Fortification': 'Befestigung',
  'Battle round': 'Schlachtrunde', 'battle round': 'Schlachtrunde',
  'Objective markers': 'Missionszielmarker', 'objective markers': 'Missionszielmarker', 'objective marker': 'Missionszielmarker',
  'Objectives': 'Missionsziele', 'objectives': 'Missionsziele', 'Objective': 'Missionsziel', 'objective': 'Missionsziel',
  'Primary Mission': 'Primärmission', 'Primary mission': 'Primärmission', 'Secondary Missions': 'Sekundärmissionen', 'Secondary Mission': 'Sekundärmission',
  'Deployment': 'Aufstellung', 'deployment zone': 'Aufstellungszone', 'Deployment zone': 'Aufstellungszone',
  'Attacker': 'Angreifer', 'Defender': 'Verteidiger',
  'Strategic Reserves': 'Strategische Reserven', 'Reserves': 'Reserven', 'Deep Strike': 'Schocktruppen',
  'Datasheets': 'Datenblätter', 'datasheets': 'Datenblätter', 'Datasheet': 'Datenblatt', 'datasheet': 'Datenblatt',
  'Army rules': 'Armeeregeln', 'Army rule': 'Armeeregel',
  'Wargear': 'Ausrüstung', 'wargear': 'Ausrüstung',
  'RANGED WEAPONS': 'FERNKAMPFWAFFEN', 'MELEE WEAPONS': 'NAHKAMPFWAFFEN', 'Ranged weapons': 'Fernkampfwaffen', 'Melee weapons': 'Nahkampfwaffen',
  'Ranged weapon': 'Fernkampfwaffe', 'Melee weapon': 'Nahkampfwaffe',
  'ABILITIES': 'FÄHIGKEITEN', 'WARGEAR ABILITIES': 'AUSRÜSTUNGSFÄHIGKEITEN', 'UNIT COMPOSITION': 'EINHEITENZUSAMMENSETZUNG',
  'Invulnerable save': 'Rettungswurf', 'invulnerable save': 'Rettungswurf',
  'Primary': 'Primär', 'Secondary': 'Sekundär',
  'Battle round 1': 'Schlachtrunde 1'
};
/* single words that are only translated when they are the whole text (phase pills, tabs …) */
export const EXACT_TERMS = {
  'Command': 'Kommando', 'Movement': 'Bewegung', 'Shooting': 'Fernkampf', 'Charge': 'Angriff', 'Fight': 'Nahkampf',
  'COMMAND': 'KOMMANDO', 'MOVEMENT': 'BEWEGUNG', 'SHOOTING': 'FERNKAMPF', 'CHARGE': 'ANGRIFF', 'FIGHT': 'NAHKAMPF',
  'Melee': 'Nahkampf', 'Round': 'Runde', 'Turn': 'Zug', 'LEADER': 'ANFÜHRER'
};

export const PHRASES = {
  // ── main menu / lobby
  'Main menu': 'Hauptmenü', 'Menu': 'Menü', 'New game': 'Neues Spiel', 'Host a battle on this device': 'Eine Schlacht auf diesem Gerät hosten',
  'Join game': 'Spiel beitreten', 'Nearby or by code': 'In der Nähe oder per Code', 'My armies': 'Meine Armeen', 'Build your army lists': 'Armeelisten erstellen',
  'Rulebook': 'Regelwerk', 'Core rules & missions': 'Grundregeln & Missionen', 'Finished games': 'Beendete Spiele', 'Results & battle logs': 'Ergebnisse & Schlachtberichte',
  'VR table setup': 'VR-Tischaufbau', 'Meta Quest: zones & terrain on the table': 'Meta Quest: Zonen & Gelände auf dem Tisch',
  'Meta Quest 3 · Mixed reality': 'Meta Quest 3 · Mixed Reality', 'Start VR': 'VR starten',
  'App & data': 'App & Daten', 'Updates & unit data': 'Updates & Einheitendaten', 'Continue game': 'Spiel fortsetzen',
  'Games nearby': 'Spiele in der Nähe', 'Join by code': 'Per Code beitreten', 'Games on this device': 'Spiele auf diesem Gerät', 
  'Refresh': 'Aktualisieren', 'No games on this device yet.': 'Noch keine Spiele auf diesem Gerät.', 'No finished games on this device yet.': 'Noch keine beendeten Spiele auf diesem Gerät.',
  'Running in the browser – updates come with the app.': 'Läuft im Browser – Updates kommen mit der App.',
  'Battle Report 40k is an app for': 'Battle Report 40k ist eine App für', 'download the latest release': 'neueste Version herunterladen',
  '. Devices without the app (e.g. iPhone) can still join a game by scanning its QR code.': '. Geräte ohne die App (z. B. iPhone) können einem Spiel trotzdem per QR-Code beitreten.',
  'Searching the Wi-Fi … A game appears here as soon as a device in the same network creates one with this app.': 'WLAN wird durchsucht … Ein Spiel erscheint hier, sobald ein Gerät im selben Netz eines mit dieser App erstellt.',
  'A game you create on this device is hosted by it – the other devices find it automatically, or scan the QR codes shown at "Roll off for the first turn".': 'Ein Spiel, das du auf diesem Gerät erstellst, wird von diesem Gerät gehostet – die anderen Geräte finden es automatisch oder scannen die QR-Codes bei „Wurf um den ersten Zug“.',
  'Player 1 (phone)': 'Spieler 1 (Handy)', 'Player 2 (phone)': 'Spieler 2 (Handy)', 'Score (tablet)': 'Spielstand (Tablet)', '(phone)': '(Handy)',
  'Player 1': 'Spieler 1', 'Player 2': 'Spieler 2', 'Scoreboard': 'Spielstand', 'Spectator': 'Zuschauer', 
  'Names are optional and can be changed in setup.': 'Namen sind optional und können im Setup geändert werden.', 'Create game': 'Spiel erstellen', 'Cancel': 'Abbrechen', 
  'Unit data (New Recruit / BSData)': 'Einheitendaten (New Recruit / BSData)', 'Check now': 'Jetzt prüfen', 'Check for updates': 'Nach Updates suchen', 'App version': 'App-Version',
  'new versions and unit data are offered when the app opens with internet.': 'neue Versionen und Einheitendaten werden beim Öffnen der App mit Internet angeboten.',
  'Everything is up to date – app and unit data.': 'Alles ist aktuell – App und Einheitendaten.', 'Checking for updates …': 'Suche nach Updates …',
  'New app version available': 'Neue App-Version verfügbar', 'New unit data available': 'Neue Einheitendaten verfügbar', 'Update now': 'Jetzt aktualisieren', 'Later': 'Später',
  // ── app bar / navigation
  '‹ Back': '‹ Zurück', '‹ Menu': '‹ Menü',
  'View only – nothing can be changed': 'Nur ansehen – nichts kann geändert werden', 'Spectator – view only': 'Zuschauer – nur ansehen',
  'Join with another device (QR codes)': 'Mit einem weiteren Gerät beitreten (QR-Codes)', 'Join with another device (QR)': 'Mit weiterem Gerät beitreten (QR)', 'QR code': 'QR-Code',
  'Last action undone': 'Letzte Aktion rückgängig gemacht', 'Connection to the server lost – reconnecting …': 'Verbindung zum Server verloren – verbinde neu …',
  // ── setup
  'Prepare the battle': 'Schlacht vorbereiten', 'Players': 'Spieler', 'Army list (optional)': 'Armeeliste (optional)', 'Army list': 'Armeeliste',
  'Review & start': 'Prüfen & starten', 'Next: Army ›': 'Weiter: Armee ›', 'Next: Army list (optional) ›': 'Weiter: Armeeliste (optional) ›',
  'Next: Mission ›': 'Weiter: Mission ›', 'Next: Secondary ›': 'Weiter: Sekundär ›', 'Next: Review & start ›': 'Weiter: Prüfen & starten ›',
  'Game options': 'Spieloptionen', 'Game size': 'Spielgröße', 'Points limit': 'Punktelimit', 'Detachment Points': 'Detachment Points', 'By game size': 'Nach Spielgröße',
  'Stratagem lock': 'Stratagem-Sperre', 'Per phase (rule)': 'Pro Phase (Regel)', 'Per round (house rule)': 'Pro Runde (Hausregel)', 'Colour': 'Farbe',
  '– light/dark depending on the theme': '– hell/dunkel je nach Design', '(taken by opponent)': '(vom Gegner gewählt)',
  'Search faction': 'Fraktion suchen', 'Clear search': 'Suche leeren', 'no faction chosen': 'keine Fraktion gewählt', 
  'Add unit': 'Einheit hinzufügen', 'Remove the last copy': 'Letzte Kopie entfernen',
  'belongs to the model': 'gehört zum Modell', 'belongs to the models': 'gehört zu den Modellen', 'comes from the attached Leader': 'kommt vom angeschlossenen Leader', 'of': 'von',
  'The unit has it only while that model is alive – once it is destroyed, the unit no longer counts as having it (for rules, Stratagems and abilities that ask for it).': 'Die Einheit hat es nur, solange dieses Modell lebt – ist es zerstört, zählt die Einheit nicht mehr als Träger (für Regeln, Strategeme und Fähigkeiten, die danach fragen).',
  'The unit has it only while that Leader is attached and alive – once he is destroyed or leaves, it is gone.': 'Die Einheit hat es nur, solange dieser Leader angeschlossen ist und lebt – ist er zerstört oder weg, ist es weg.',
  'A keyword has no rule text of its own – rules, Stratagems and abilities refer to it by name.': 'Ein Keyword hat keinen eigenen Regeltext – Regeln, Strategeme und Fähigkeiten beziehen sich darauf über den Namen.',
  'Faction ability – the army rule of': 'Fraktionsfähigkeit – die Armeeregel von', 'A unit has it only while a model with this ability is in it – an attached Leader brings it along and takes it with him when he dies.': 'Eine Einheit hat sie nur, solange ein Modell mit dieser Fähigkeit in ihr ist – ein angeschlossener Leader bringt sie mit und nimmt sie mit, wenn er stirbt.', 'Units with this ability': 'Einheiten mit dieser Fähigkeit', 'Army rule (BSData / New Recruit).': 'Armeeregel (BSData / New Recruit).', 'A faction ability marked with a Leader\'s tag comes from that model only – the unit loses it when he is destroyed or leaves the unit.': 'Eine Fraktionsfähigkeit mit Leader-Marke kommt nur von diesem Modell – die Einheit verliert sie, wenn er zerstört wird oder die Einheit verlässt.', 'Add units': 'Einheiten hinzufügen', 'Add army list': 'Armeeliste hinzufügen',
  'No units yet. Add them manually or import the export from the GW app / New Recruit.': 'Noch keine Einheiten. Füge sie von Hand hinzu oder importiere den Export aus der GW-App / New Recruit.',
  'Optional: the army list is only used for keyword matching': 'Optional: Die Armeeliste wird nur für den Keyword-Abgleich genutzt',
  'The game works the same without it – points and objective markers are tracked on the tablet.': 'Das Spiel funktioniert auch ohne sie – Punkte und Objective markers werden auf dem Tablet geführt.',
  'Deployment map missing': 'Aufstellungskarte fehlt', 'Attacker / Defender': 'Attacker / Defender', 'Twist': 'Twist',
  'The Attacker deploys in the upper zone (top of the map = Attacker\'s edge).': 'Der Attacker stellt in der oberen Zone auf (oben auf der Karte = Kante des Attackers).',
  'The Attacker uses the Attacker deployment zone of the deployment map, the Defender the opposite one.': 'Der Attacker nutzt die Attacker-Deployment zone der Karte, der Defender die gegenüberliegende.',
  'Each player chooses a Disposition. The Primary Mission results from your own and your opponent\'s Disposition.': 'Jeder Spieler wählt eine Disposition. Die Primary Mission ergibt sich aus deiner und der gegnerischen Disposition.',
  'The Primary Mission appears once both Dispositions are chosen.': 'Die Primary Mission erscheint, sobald beide Dispositions gewählt sind.',
  'Dispositions → Primary mission': 'Dispositions → Primary mission', 'Tactical (deck will be shuffled)': 'Taktisch (Deck wird gemischt)',
  'At the start of each of your Command phases draw 2 cards (your hand grows, completed cards are discarded).': 'Zu Beginn jeder deiner Command phases ziehst du 2 Karten (deine Hand wächst, erfüllte Karten werden abgelegt).',
  'See the checklist for what is missing – starting will tell you what is still open.': 'In der Checkliste steht, was fehlt – beim Starten wird angezeigt, was noch offen ist.',
  'Both players ready': 'Beide Spieler bereit', 'Not ready': 'Nicht bereit', 'is ready.': 'ist bereit.', 'is no longer ready.': 'ist nicht mehr bereit.', 'not ready': 'nicht bereit',
  'Go to setup': 'Zum Setup', 'Go to deployment': 'Zur Aufstellung', 
  'The game is still in setup': 'Das Spiel ist noch im Setup', 'Players, armies and mission are set in the setup.': 'Spieler, Armeen und Mission werden im Setup festgelegt.',
  'Your army, stratagems and army list will appear here afterwards.': 'Deine Armee, Stratagems und Armeeliste erscheinen danach hier.',
  'From My armies': 'Aus Meine Armeen', 'Or import a text export': 'Oder einen Text-Export importieren', 'or paste text': 'oder Text einfügen', 'File (.txt)': 'Datei (.txt)',
  'Replace units?': 'Einheiten ersetzen?', 'Replace': 'Ersetzen', 'Add to them': 'Dazu hinzufügen',
  // ── deployment / score / table
  'Deploy alternately': 'Abwechselnd aufstellen', 'Roll off for the first turn': 'Wurf um den ersten Zug', 'Declare Reserves and infiltrators': 'Reserves und Infiltratoren ansagen',
  'Openly declare Strategic Reserves, Deep Strike and transports to both players.': 'Strategic Reserves, Deep Strike und Transporter beiden Spielern offen ansagen.',
  'Confirm scoring': 'Wertung bestätigen', 'Scoring': 'Wertung', 'End of turn': 'Ende des Zuges', 'End turn of': 'Zug beenden von',
  'scoring, then': 'Wertung, dann', 'Your turn': 'Dein Zug', 'Opponent\'s turn': 'Zug des Gegners', 'My turn': 'Mein Zug', 'active turn': 'aktiver Zug', '1st turn': '1. Zug', '2nd turn': '2. Zug',
  'Achieved': 'Erfüllt', 'Not achieved': 'Nicht erfüllt', 'No cards in hand.': 'Keine Karten auf der Hand.',
  'Primary battle': 'Primary Schlacht', 'Primary round': 'Primary Runde', 'Secondary battle': 'Secondary Schlacht', 'Secondary round': 'Secondary Runde',
  'Max 15 VP per round, 45 VP per battle.': 'Max. 15 VP pro Runde, 45 VP pro Schlacht.', 'You control more objectives than your opponent': 'Du kontrollierst mehr Objectives als dein Gegner',
  'Rules for the current phase': 'Regeln für die aktuelle Phase', 'Rule for this counter': 'Regel für diesen Zähler', 'Wording of this condition': 'Wortlaut dieser Bedingung',
  'Start battle': 'Schlacht starten', 'takes the first turn': 'hat den ersten Zug', 'The battle begins.': 'Die Schlacht beginnt.', 'has the first turn.': 'hat den ersten Zug.',
  'Both players gain 1 CP.': 'Beide Spieler erhalten 1 CP.', 'Settings': 'Einstellungen',
  'Settings, notes and links': 'Einstellungen, Notizen und Links', 
  'Game over': 'Spiel vorbei', 'End game': 'Spiel beenden', 'Next phase': 'Nächste Phase', 'Any phase': 'Jede Phase', 'Any time': 'Jederzeit',
  // ── player phone
  'Active effects': 'Aktive Effekte', 'Once-per abilities': 'Einmal-pro-Fähigkeiten', 'once per battle': 'einmal pro Schlacht', 'once per turn': 'einmal pro Zug',
  'once per phase': 'einmal pro Phase', 'once per battle round': 'einmal pro Battle round', 'in battle': 'in der Schlacht', 
  'Usable this turn': 'In diesem Zug nutzbar', 'Available during the battle.': 'Während der Schlacht verfügbar.', 'No Stratagem available right now.': 'Gerade kein Stratagem verfügbar.',
  'Not enough CP': 'Nicht genug CP', 'CP cost': 'CP-Kosten', 'You have': 'Du hast', 'CP after use:': 'CP nach Einsatz:',
  'CP reduction': 'CP-Reduktion', 'Unit (optional)': 'Einheit (optional)', '– no unit –': '– keine Einheit –', 'Original text': 'Originaltext',
  'A unit can only be targeted by one Stratagem per phase; Battle-shocked units cannot be targeted by your own Stratagems.': 'Eine Einheit kann pro Phase nur Ziel eines Stratagems sein; Battle-shocked Einheiten können nicht Ziel deiner eigenen Stratagems sein.',
  'not in round 1': 'nicht in Runde 1', 'Leader attachments': 'Anführer-Zuordnungen', 'No leader attachments in the list.': 'Keine Leader-Zuordnungen in der Liste.',
  'attached to': 'angeschlossen an', '– not attached –': '– nicht angeschlossen –', 'not attached yet': 'noch nicht angeschlossen', 'leader not attached yet': 'Leader noch nicht angeschlossen',
  'leaders not attached yet': 'Leaders noch nicht angeschlossen', 'This character can lead a unit of your army – attach to give the unit the leader\'s abilities.': 'Dieser Charakter kann eine Einheit deiner Armee anführen – schließe ihn an, damit die Einheit seine Fähigkeiten erhält.',
  'These characters can lead a unit of your army – attach to give the unit the leader\'s abilities.': 'Diese Charaktere können Einheiten deiner Armee anführen – schließe sie an, damit die Einheiten ihre Fähigkeiten erhalten.',
  'Filter units by name or keyword …': 'Einheiten nach Name oder Keyword filtern …', 'with a datasheet': 'mit Datasheet', 
  'Show rule and use': 'Regel zeigen und einsetzen', 'Show text of': 'Text zeigen von', 'Original text of': 'Originaltext von', 'Rules text': 'Regeltext',
  'Referenced rules': 'Zugehörige Regeln', 'Core rule (BSData / New Recruit).': 'Kernregel (BSData / New Recruit).',
  'No core rule with this name – if it is an ability of a datasheet, its text is in the unit\'s abilities.': 'Keine Kernregel dieses Namens – ist es eine Fähigkeit eines Datasheets, steht ihr Text bei den Fähigkeiten der Einheit.',
  'The asterisk (*) means the datasheet limits this ability – see the unit\'s abilities for the condition.': 'Das Sternchen (*) bedeutet: Das Datasheet schränkt diese Fähigkeit ein – die Bedingung steht bei den Fähigkeiten der Einheit.',
  'Used in': 'Eingesetzt in', 'Not specified': 'Nicht angegeben', 'Loading rules …': 'Regeln werden geladen …',
  'Each Stratagem once per phase – pick the phase to use it again later in this turn.': 'Jedes Stratagem einmal pro Phase – Phase wählen, um es später in diesem Zug erneut einzusetzen.',
  'Short explanation of this app – the original text is a tap away (download once).': 'Kurzerklärung der App – der Originaltext ist einen Tipp entfernt (einmal herunterladen).',
  'Original text: Warhammer 40,000 Core Rules (Games Workshop), via': 'Originaltext: Warhammer 40.000 Grundregeln (Games Workshop), über',
  'Confirm the open scoring first – the end-of-battle scoring follows.': 'Bestätige zuerst die offene Wertung – danach folgt die Wertung zum Schlachtende.',
  'End of battle requested – after the pending scoring is confirmed': 'Schlachtende angefordert – nach Bestätigung der offenen Wertung',
  'The end-of-battle scoring is already requested': 'Die Wertung zum Schlachtende ist bereits angefordert',
  'If Cleanse is active for you, you can shuffle Plunder back into your deck and draw a new card.': 'Wenn Cleanse für dich aktiv ist, kannst du Plunder zurück in dein Deck mischen und eine neue Karte ziehen.',
  'If Plunder is active for you, you can shuffle Cleanse back into your deck and draw a new card.': 'Wenn Plunder für dich aktiv ist, kannst du Cleanse zurück in dein Deck mischen und eine neue Karte ziehen.',
  'End turn': 'Zug beenden', 'End battle': 'Schlacht beenden', 'Phases are tracked from now on': 'Phasen werden ab jetzt verfolgt',
  'Not active in this battle round': 'In dieser Schlachtrunde nicht aktiv', 'Arrived': 'Angekommen', 'Replace units?': 'Einheiten ersetzen?',
  'Units in strategic reserves arrive with an ingress move (20.04) from the second battle round onwards (20.03).': 'Einheiten in strategischen Reserven kommen ab der zweiten Schlachtrunde mit einer Ankunftsbewegung (20.04) aufs Schlachtfeld (20.03).',
  'Can arrive now: ingress move (20.04) – wholly within 6" of a battlefield edge, more than 8" horizontally from all enemy units; before the third battle round not within your opponent\'s deployment zone.': 'Können jetzt ankommen: Ankunftsbewegung (20.04) – vollständig innerhalb von 6" einer Spielfeldkante, horizontal mehr als 8" von allen feindlichen Einheiten entfernt; vor der dritten Schlachtrunde nicht in der Aufstellungszone des Gegners.',
  'Last round to arrive: at the end of the third battle round, strategic reserves units that have not made an ingress move are destroyed (20.04).': 'Letzte Runde zum Ankommen: Am Ende der dritten Schlachtrunde werden Einheiten in strategischen Reserven ohne Ankunftsbewegung vernichtet (20.04).',
  'Strategic reserves units that had not arrived by the end of the third battle round are destroyed.': 'Einheiten in strategischen Reserven, die bis zum Ende der dritten Schlachtrunde nicht angekommen waren, sind vernichtet.',
  'Discard & draw a new card': 'Abwerfen & neue Karte ziehen', 'Draw a new card & shuffle this back': 'Neue Karte ziehen & diese zurückmischen',
  'No connection to the server': 'Keine Verbindung zum Server',
  'Declare Battle Formations': 'Kampfformationen festlegen',
  'Before deploying, each player secretly notes which Leaders are attached to which units, which units start embarked in TRANSPORTS and which start in Reserves (Strategic Reserves, Deep Strike); then both reveal them.': 'Vor dem Aufstellen notiert jeder Spieler geheim, welche Leaders welchen Einheiten angeschlossen sind, welche Einheiten in TRANSPORTS eingeschifft beginnen und welche in Reserves (Strategic Reserves, Deep Strike); danach decken beide sie auf.',
  'no change': 'keine Änderung', 'Choose file': 'Datei wählen', 'No file chosen': 'Keine Datei gewählt', 'per unit': 'pro Einheit',
  'Games on the host device': 'Spiele auf dem Host-Gerät', 'No games on the host device yet.': 'Noch keine Spiele auf dem Host-Gerät.',
  'Only the device hosting the game can delete it': 'Nur das Gerät, auf dem das Spiel läuft, kann es löschen',
  'The last action was not made on this phone': 'Die letzte Aktion wurde nicht auf diesem Handy gemacht', 'it can only be undone there or on the scoreboard.': 'sie kann nur dort oder an der Anzeigetafel rückgängig gemacht werden.',
  'Battle Ready army: 10 VP at the end of the battle. Total max. 100 VP. The tablet caps automatically.': 'Battle-Ready-Armee: 10 SP am Ende der Schlacht. Insgesamt max. 100 SP. Das Tablet begrenzt automatisch.',
  'Battle Ready max. 10 VP': 'Battle Ready max. 10 SP',
  'Discard at end of turn: in your own turn, once per turn, +1 CP at the end of the turn. Discard and redraw: 1 CP, once per battle, at the end of your Command phase': 'Abwerfen am Zugende: im eigenen Zug, einmal pro Zug, +1 CP am Ende des Zuges. Abwerfen und neu ziehen: 1 CP, einmal pro Schlacht, am Ende deiner Kommandophase',
  'already used': 'bereits genutzt', 'still available': 'noch verfügbar', 'not now': 'jetzt nicht',
  'Discard and redraw only at the end of your Command phase': 'Abwerfen und neu ziehen nur am Ende deiner Kommandophase',
  '+1 CP at the end of the turn': '+1 CP am Ende des Zuges', '+1 CP for discarding at the end of the turn': '+1 CP für das Abwerfen am Zugende',
  "End of opponent's turn": 'Ende des gegnerischen Zuges',
  'tap to mark as used': 'tippen, um als genutzt zu markieren', 'used – tap to undo': 'genutzt – tippen zum Rückgängigmachen',
  'In which phase of this turn did you use it?': 'In welcher Phase dieses Zuges hast du es genutzt?', 'Booked automatically:': 'Automatisch gebucht:', 'Changed automatically:': 'Automatisch geändert:',
  'Adjusted to the rules': 'An die Regeln angepasst', 'marked as used': 'als genutzt markiert',
  // ── army builder
  'New army': 'Neue Armee', 'All detachments: rules, enhancements, stratagems': 'Alle Detachments: Regeln, Optimierungen, Strategeme', 'rule · enhancements · stratagems': 'Regel · Optimierungen · Strategeme', 'Choose a detachment – its rule, enhancements and stratagems then show here.': 'Detachment wählen – Regel, Optimierungen und Strategeme erscheinen dann hier.', 'Stratagems: not in the data for this detachment.': 'Strategeme: für dieses Detachment nicht in den Daten.', 'Hide report': 'Bericht ausblenden', 'Hide import report': 'Import-Bericht ausblenden', 'what the import could not take over 1:1': 'was der Import nicht 1:1 übernehmen konnte', 'Import report': 'Import-Bericht', 'Not imported': 'Nicht importiert', 'Different from the list': 'Anders als in der Liste', 'Rule problems in the imported army': 'Regelprobleme der importierten Armee', 'These were left out – add them by hand if you need them.': 'Diese wurden ausgelassen – bei Bedarf von Hand ergänzen.', 'Imported, but not exactly as in the list – please check.': 'Importiert, aber nicht genau wie in der Liste – bitte prüfen.', 'The army as imported breaks these rules (state at the import).': 'Die importierte Armee verstößt gegen diese Regeln (Stand beim Import).', 'Everything was imported exactly as in the list.': 'Alles wurde genau wie in der Liste importiert.', 'Dismiss': 'Ausblenden', '⇩ Import list': '⇩ Liste importieren', 'Paste the list': 'Liste einfügen', 'or choose a file': 'oder Datei wählen', 'Paste the army list here': 'Armeeliste hier einfügen', 'Paste a list – a New Recruit text export, a GW app list or a list copied from Reddit, a forum or a chat – or choose a file (New Recruit ': 'Liste einfügen – ein New-Recruit-Text-Export, eine GW-App-Liste oder eine Liste aus Reddit, einem Forum oder Chat – oder eine Datei wählen (New Recruit ', ' or roster ': ' oder Roster ', '). Units, models, wargear, enhancements and the Warlord are matched by name; the import becomes a new army.': '). Einheiten, Modelle, Ausrüstung, Optimierungen und der Kriegsherr werden über den Namen zugeordnet; der Import wird eine neue Armee.', ' Without a faction line in the list, the faction of this army is used.': ' Ohne Fraktionszeile in der Liste wird die Fraktion dieser Armee verwendet.', 'An entry that is no longer in the data (data update) – it is removed when the army is opened': 'Ein Eintrag, der nicht mehr in den Daten ist (Datenupdate) – er wird beim Öffnen der Armee entfernt', 'Find a unit by name or keyword …': 'Einheit nach Name oder Keyword suchen …', 'Rule not in the data.': 'Regel nicht in den Daten.', 'Datasheet view': 'Datenblatt-Ansicht', 'all units as datasheets, to play': 'alle Einheiten als Datenblätter, zum Spielen', 'read only – switch off to edit': 'nur lesen – zum Bearbeiten ausschalten', 'All datasheets of this army to play – nothing to edit here.': 'Alle Datenblätter dieser Armee zum Spielen – hier wird nichts bearbeitet.', 'Print / PDF': 'Drucken / PDF', '– shown with that unit.': '– bei dieser Einheit gezeigt.', 'no datasheet in the data.': 'kein Datenblatt in den Daten.', 'tap the box to open it': 'zum Öffnen auf den Kasten tippen', 'The Oath (one Deed and one Quality) is chosen or rolled at the start of the battle – in the game under “Active effects”.': 'Der Eid (eine Tat und eine Eigenschaft) wird zu Beginn der Schlacht gewählt oder ausgewürfelt – im Spiel unter „Aktive Effekte“.', 'Show units': 'Einheiten anzeigen', 'Switches from the data: which further units can be selected (e.g. Legends, allies).': 'Schalter aus den Daten: welche weiteren Einheiten wählbar sind (z. B. Legends, Verbündete).', 'Learn to play': 'Spielen lernen', 'Step by step, phase by phase': 'Schritt für Schritt, Phase für Phase', 'Show the guide during games': 'Guide während des Spiels anzeigen', '⇩ Import from New Recruit': '⇩ Aus New Recruit importieren', 'text export or roster file (.ros / .rosz)': 'Text-Export oder Roster-Datei (.ros / .rosz)', 'Import army': 'Armee importieren', 'Import done': 'Import fertig', 'Please check these by hand:': 'Bitte von Hand prüfen:', 'Everything was matched.': 'Alles wurde zugeordnet.', 'or paste the text export': 'oder Text-Export einfügen', 'Paste the New Recruit text export here': 'New-Recruit-Text-Export hier einfügen', 'Choose a file or paste the export': 'Datei wählen oder Export einfügen', 'Importing …': 'Importiere …', 'Problems': 'Probleme', 'No problems': 'Keine Probleme',
  'No army lists yet.': 'Noch keine Armeelisten.', 'Battle size': 'Battle size', 'Custom points limit': 'Eigenes Punktelimit', 
  'Choose a faction': 'Fraktion wählen', 'Army configuration': 'Armee-Konfiguration', '+ Add unit': '+ Einheit hinzufügen', 'Copy as text': 'Als Text kopieren',
  'Search units': 'Einheiten suchen', 'Model types': 'Modelltypen', 'Compare': 'Vergleichen', 'Compare detachments': 'Detachments vergleichen', 'Each equipped with': 'Jeweils ausgerüstet mit',
  'Equipped with': 'Ausgerüstet mit', 'Tap to equip': 'Tippen zum Ausrüsten', 'Tap to take': 'Tippen zum Nehmen', 'Tap to select': 'Tippen zum Auswählen',
  'Tap to add': 'Tippen zum Hinzufügen', 'Tap to swap in': 'Tippen zum Eintauschen', 'limit reached': 'Limit erreicht',
  'led by': 'angeführt von', '– led by': '– geführt von', 'Rename army': 'Armee umbenennen', 'Delete army?': 'Armee löschen?',
  'more possible': 'weitere möglich', 'unit full – swap models': 'Einheit voll – Modelle tauschen', 'swaps one': 'tauscht ein',
  'Show problems': 'Probleme anzeigen', 
  'Every model has': 'Jedes Modell hat', 'Only the weapons every model has.': 'Nur die Waffen, die jedes Modell hat.',
  'Its weapons are chosen in its card below.': 'Seine Waffen werden in seiner Karte darunter gewählt.', 'Equip one of these': 'Eines dieser',
  'A custom game uses the rules of the nearest standard size (up to 1000 pts Incursion, above that Strike Force); the Detachment Points can be set by hand.': 'Ein eigenes Spiel nutzt die Regeln der nächsten Standardgröße (bis 1000 Pkt. Incursion, darüber Strike Force); die Detachment Points lassen sich von Hand setzen.',
  'Set by hand': 'Von Hand gesetzt', 'Led by': 'Angeführt von', 'what a leader adds is shown in its colour.': 'was ein Leader beisteuert, ist in seiner Farbe markiert.',
  'Back to My armies': 'Zurück zu Meine Armeen', 'Army not found': 'Armee nicht gefunden', 'Loading datasheet …': 'Datasheet wird geladen …', 'Loading': 'Lädt',
  // ── account (online server, js/ui/account.js)
  'Sync your lists across devices': 'Listen auf allen Geräten synchronisieren', 'Host a battle on the online server': 'Eine Schlacht auf dem Online-Server austragen',
  'Your games on the online server': 'Deine Spiele auf dem Online-Server', 'No games yet – create one, or join a game by its code.': 'Noch keine Spiele – lege eins an oder tritt einem Spiel per Code bei.',
  'Online server – sign in with your account. New here? Create an account with the invite code you got from the host.': 'Online-Server – melde dich mit deinem Konto an. Neu hier? Erstelle ein Konto mit dem Einladungscode, den du vom Gastgeber bekommen hast.',
  'With an account on the online server your army lists and finished games are kept in the account and synced to every device you sign in on – build a list on the PC, use it on your phone. Games at the table still run on this device as before.': 'Mit einem Konto auf dem Online-Server liegen deine Armeelisten und beendeten Spiele im Konto und werden mit jedem Gerät synchronisiert, auf dem du angemeldet bist – Liste am PC bauen, am Handy nutzen. Spiele am Tisch laufen weiter wie bisher auf diesem Gerät.',
  'Signed in as': 'Angemeldet als', 'Online server:': 'Online-Server:', 'Sync now': 'Jetzt synchronisieren', 'Synced': 'Synchronisiert', 'Syncing …': 'Synchronisiere …',
  'Not synced yet': 'Noch nicht synchronisiert', 'Sync failed:': 'Synchronisieren fehlgeschlagen:', 'Upload lists from this device': 'Listen von diesem Gerät hochladen',
  'Offline – the lists on this device keep working and sync later.': 'Offline – die Listen auf diesem Gerät funktionieren weiter und werden später synchronisiert.',
  'Games for players apart (other places, mobile data):': 'Spiele für Spieler an verschiedenen Orten (oder über mobile Daten):', 'open the online server': 'Online-Server öffnen',
  '– sign in there with the same account.': '– dort mit demselben Konto anmelden.', 'Change password': 'Passwort ändern', 'Current password': 'Aktuelles Passwort',
  'New password': 'Neues Passwort', 'At least 8 characters. Your other devices are signed out.': 'Mindestens 8 Zeichen. Deine anderen Geräte werden abgemeldet.',
  'Save password': 'Passwort speichern', 'Sign out': 'Abmelden', 'Sign out?': 'Abmelden?', 'Signed out': 'Abgemeldet', 'Sign in': 'Anmelden', 'Create account': 'Konto erstellen',
  'Server address': 'Serveradresse', 'User name': 'Benutzername', 'Password': 'Passwort', 'Invite code': 'Einladungscode', 'Password changed': 'Passwort geändert',
  'User name: 3–24 characters (a–z, 0–9, _ and -). Password: at least 8 characters.': 'Benutzername: 3–24 Zeichen (a–z, 0–9, _ und -). Passwort: mindestens 8 Zeichen.',
  'Lists and finished games that are in the account are removed from this device – they come back when you sign in again.': 'Listen und beendete Spiele, die im Konto liegen, werden von diesem Gerät entfernt – sie kommen zurück, sobald du dich wieder anmeldest.',
  'Upload your lists?': 'Listen hochladen?', '1 army list on this device is not in your account yet. Upload it so it is on all your devices?': '1 Armeeliste auf diesem Gerät ist noch nicht in deinem Konto. Hochladen, damit sie auf allen deinen Geräten ist?',
  'Wrong user name or password': 'Falscher Benutzername oder falsches Passwort', 'Invalid or already used invite code': 'Ungültiger oder bereits verwendeter Einladungscode',
  'This user name is taken': 'Dieser Benutzername ist vergeben', 'The password needs at least 8 characters': 'Das Passwort braucht mindestens 8 Zeichen',
  'User name: 3–24 characters, only a–z, 0–9, _ and -': 'Benutzername: 3–24 Zeichen, nur a–z, 0–9, _ und -', 'Too many attempts – please wait a while and try again.': 'Zu viele Versuche – bitte warte eine Weile und versuche es dann erneut.',
  'The current password is wrong': 'Das aktuelle Passwort ist falsch', 'The online server cannot be reached': 'Der Online-Server ist nicht erreichbar',
  'Enter the address of the online server': 'Gib die Adresse des Online-Servers ein', 'This is not a valid address': 'Das ist keine gültige Adresse',
  'Use the https:// address of the online server': 'Nutze die https://-Adresse des Online-Servers', 'Please sign in': 'Bitte melde dich an',
  'Only the player who created the game can delete it': 'Nur wer das Spiel angelegt hat, kann es löschen', 'Not available on the online server': 'Auf dem Online-Server nicht verfügbar',
  'Request from another site refused': 'Anfrage von einer anderen Seite abgelehnt', 'Online server': 'Online-Server',
  // ── generic
  
  'Game terms in English': 'Spielbegriffe auf Englisch',
  'German: the interface is in German; rules texts stay in their English original as long as no official German version is available in the data. “Game terms in English” keeps terms like Stratagem, CP, Command phase or Leader in English.': 'Deutsch: Die Oberfläche ist deutsch; Regeltexte bleiben im englischen Original, solange keine offizielle deutsche Fassung in den Daten vorliegt. „Spielbegriffe auf Englisch“ lässt Spielbegriffe (Phasen, Punkte, Strategem-, Anführer- und Missionsbegriffe) englisch.'
};

/* short interface words – only translated when they are the whole text of a button / label */
export const EXACT = { 'File': 'Datei', 'Account': 'Konto', 'Upload': 'Hochladen',
  'Yes': 'Ja', 'No': 'Nein', 'All': 'Alle', 'Delete': 'Löschen', 'Done': 'Fertig', 'Close': 'Schließen',
  'Save': 'Speichern', 'Join': 'Beitreten', 'Import': 'Importieren', 'Back': 'Zurück', 'Score': 'Spielstand',
  'Note': 'Notiz', 'More': 'Mehr', 'Less': 'Weniger', 'Fewer': 'Weniger', 'Status': 'Status', 'Limit': 'Limit', 'Step': 'Schritt',
  'Description': 'Beschreibung', 'Problem': 'Problem', 'Point': 'Punkt', 'End': 'Ende', 'Army': 'Armee',
  'Lead': 'Anführen', 'Navigation': 'Navigation', 'Live': 'Live', 'Book': 'Buch', 'Window': 'Fenster', 'Overview': 'Übersicht', 'View': 'Ansicht'
};

/* numbers with units and other short composites (whole text node; applied before PHRASES) */
export const PATTERNS = [
  ['^(\\d+) lists? uploaded$', (m, n) => n + (n === '1' ? ' Liste hochgeladen' : ' Listen hochgeladen')],
  ['^(\\d+) army lists on this device are not in your account yet\\. Upload them so they are on all your devices\\?$', (m, n) => n + ' Armeelisten auf diesem Gerät sind noch nicht in deinem Konto. Hochladen, damit sie auf allen deinen Geräten sind?'],
  ['^Next phase: (.+)$', (m, p) => 'Nächste Phase: ' + p],
  ['^Only in the (.+)$', (m, p) => 'Nur in der ' + p],
  ['^Only while (.+) is active for you$', (m, c) => 'Nur solange ' + c + ' für dich aktiv ist'],
  ['^(\\d+) units? (?:is|are) already in the list\\. Remove them and import the pasted list\\?$', (m, n) => n + ' Einheit(en) sind schon in der Liste. Entfernen und die eingefügte Liste importieren?'],
  ['^Server error (\\d+)$', (m, n) => 'Serverfehler ' + n], ['^Upload failed \\((.+)\\)$', (m, n) => 'Upload fehlgeschlagen (' + n + ')'],
  ['\\(\\+(\\d+) CP – raise the CP cost below\\)', (m, n) => '(+' + n + ' CP – CP-Kosten unten erhöhen)'],
  ['^Not possible – (.+)$', (m, r) => 'Nicht möglich – ' + r],
  ['^Notes from the data$', () => 'Hinweise aus den Daten'], ['^no rule problem$', () => 'kein Regelproblem'],
  ['^Led by (.+) – a bodyguard unit can only have one Leader unit attached$', (m, a) => 'Angeführt von ' + a + ' – eine Bodyguard-Einheit kann nur eine Leader-Einheit angeschlossen haben'],
  ['^Led by (.+) – at most (\\d+) Leader units can be attached$', (m, a, n) => 'Angeführt von ' + a + ' – höchstens ' + n + ' Leader-Einheiten können angeschlossen werden'],
  ['^Led by (.+) – no more than one of them can be a (.+) unit$', (m, a, k) => 'Angeführt von ' + a + ' – höchstens eine davon darf eine ' + k + '-Einheit sein'],
  ['^Led by (.+) – the Leader units must not be duplicates$', (m, a) => 'Angeführt von ' + a + ' – die Leader-Einheiten dürfen keine Duplikate sein'],
  ['^Supported by (.+) – a bodyguard unit can only have one Support unit attached$', (m, a) => 'Unterstützt von ' + a + ' – eine Bodyguard-Einheit kann nur eine Support-Einheit angeschlossen haben'],
  ['^(\\d+) enhancements \\((.+)\\) – a unit can only have one enhancement$', (m, n, l) => n + ' Optimierungen (' + l + ') – eine Einheit kann nur eine Optimierung haben'],
  ['^Support unit not attached – each support unit must be attached to a bodyguard unit$', () => 'Support-Einheit nicht angeschlossen – jede Support-Einheit muss einer Bodyguard-Einheit angeschlossen sein'],
  ['^Supports$', () => 'Unterstützt'],
  ['^(\\d+) models?$', (m, n) => n + (n === '1' ? ' Modell' : ' Modelle')],
  ['(?<![A-Za-z])(\\d+) models(?![A-Za-z])', (m, n) => n + ' Modelle'], ['(?<![A-Za-z])1 model(?![A-Za-z])', () => '1 Modell'],
  ['(?<![A-Za-z])(\\d+) units?(?![A-Za-z])', (m, n) => n + (n === '1' ? ' Einheit' : ' Einheiten')],
  ['(?<![A-Za-z])(\\d+) pts(?![A-Za-z])', (m, n) => n + ' Pkt.'], ['/ (\\d+) pts', (m, n) => '/ ' + n + ' Pkt.'],
  ['(?<![A-Za-z])(\\d+) problems?(?![A-Za-z])', (m, n) => n + (n === '1' ? ' Problem' : ' Probleme')],
  ['(?<![A-Za-z])(\\d+) lists?(?![A-Za-z])', (m, n) => n + (n === '1' ? ' Liste' : ' Listen')],
  ['(?<![A-Za-z])(\\d+) cards?(?![A-Za-z])', (m, n) => n + (n === '1' ? ' Karte' : ' Karten')],
  ['(?<![A-Za-z])(\\d+) saved(?![A-Za-z])', (m, n) => n + ' gespeichert'],
  ['(?<![A-Za-z])(\\d+) games? nearby(?![A-Za-z])', (m, n) => n + (n === '1' ? ' Spiel in der Nähe' : ' Spiele in der Nähe')],
  ['^Round (\\d+)', (m, n) => 'Runde ' + n], ['(?<![A-Za-z])Round (\\d+)/(\\d+)', (m, a, b) => 'Runde ' + a + '/' + b], ['^ROUND (\\d+)', (m, n) => 'RUNDE ' + n],
  ['(?<![A-Za-z])(\\d+) more possible', (m, n) => n + ' weitere möglich'],
  ['^(\\d+) / (\\d+) chosen', (m, a, b) => a + ' / ' + b + ' gewählt'], ['at least (\\d+)', (m, n) => 'mindestens ' + n],
  ['^(\\d+) added', (m, n) => n + ' hinzugefügt'], ['^(.+) removed$', (m, n) => n + ' entfernt'], ['^Add units · (\\d+) added', (m, n) => 'Einheiten hinzufügen · ' + n + ' hinzugefügt'],
  ['(\\d+) Detachment Points used', (m, n) => n + ' Detachment Points verbraucht'],
  ['^(.+) is ready\\.$', (m, n) => n + ' ist bereit.'], ['^(.+) is the Attacker', (m, n) => n + ' ist der Attacker'], ['^(.+) is the Defender', (m, n) => n + ' ist der Defender'],
  ['^(.+)\'s turn$', (m, n) => 'Zug von ' + n], ['^Your turn · (.+)$', (m, n) => 'Dein Zug · ' + n], ['^(.+) \\(you\\)$', (m, n) => n + ' (du)']
];
/* single words / labels translated only when they are the whole text */
Object.assign(EXACT, {
  'models': 'Modelle', 'model': 'Modell', 'units': 'Einheiten', 'unit': 'Einheit', 'pts': 'Pkt.', 'Model': 'Modell', 'Unit': 'Einheit', 'used': 'genutzt', 'available': 'verfügbar',
  'optional': 'optional', 'equipped': 'ausgerüstet', 'chosen': 'gewählt', 'selected': 'ausgewählt', 'full': 'voll', 'valid': 'gültig', 'Now': 'Jetzt', 'Phase': 'Phase',
  'Rule': 'Regel', 'Rules': 'Regeln', 'None': 'Keine', 'Custom': 'Eigene', 'Leads': 'Führt an', 'Duplicate': 'Duplizieren', 'Discard': 'Abwerfen', 'Resource': 'Ressource',
  'Problems': 'Probleme', 'problems': 'Probleme', 'Mission': 'Mission', 'Round': 'Runde', 'Turn': 'Zug'
});

Object.assign(PHRASES, {
  'Army rules': 'Army rules', 'Army rule': 'Army rule',   // whole term first (TERMS turns it into Armeeregel(n))
  'Attacker/Defender, alternating deployment and the roll-off for the first turn are handled on the Score tablet. Deployment and reserve rules are in the Rulebook.': 'Attacker/Defender, abwechselnde Aufstellung und der Wurf um den ersten Zug laufen auf dem Spielstand-Tablet. Regeln zu Deployment und Reserves stehen im Regelwerk.',
  'the Score tablet runs the sequence': 'das Spielstand-Tablet führt durch den Ablauf',
  'Incursion 2 DP, Strike Force 3 DP – set by hand for other agreements. Detachments are bought with these points.': 'Incursion 2 DP, Strike Force 3 DP – für andere Absprachen von Hand setzen. Mit diesen Punkten werden Detachments gekauft.',
  'Set by hand – “By game size” goes back to Incursion 2 / Strike Force 3.': 'Von Hand gesetzt – „Nach Spielgröße“ setzt auf Incursion 2 / Strike Force 3 zurück.',
  'Scan to open the rules of': 'Scannen, um die Regeln zu öffnen von', 'points · 0 units': 'Punkte · 0 Einheiten',
  'Tap a detachment to take it or drop it; open the sections to read everything.': 'Tippe ein Detachment an, um es zu nehmen oder abzuwählen; klappe die Abschnitte auf, um alles zu lesen.',
  'Every option with its weapons or effect – an option can bring several weapons (same colour).': 'Jede Option mit ihren Waffen oder ihrem Effekt – eine Option kann mehrere Waffen bringen (gleiche Farbe).',
  'Tap an option to equip it.': 'Tippe eine Option an, um sie auszurüsten.', 'Tap to add an option (again), − takes one away.': 'Tippen fügt eine Option (erneut) hinzu, − nimmt eine weg.',
  'The model types of this group with their weapons. Tap one to select it – then take it with “Add” / “Swap in” in the unit.': 'Die Modelltypen dieser Gruppe mit ihren Waffen. Tippe einen an, um ihn auszuwählen – dann nimm ihn mit „+“ in der Einheit.',
  'Other models you can take': 'Weitere mögliche Modelle', 'Standard models': 'Standardmodelle', 'Rule not in the data.': 'Regel nicht in den Daten.',
  'Stratagems: not in the data for this detachment.': 'Stratagems: für dieses Detachment nicht in den Daten.', 'No profile in the data.': 'Kein Profil in den Daten.',
  'Build your army right here – units, wargear, enhancements and points straight from the New Recruit data (BSData). Saved lists can be taken into any game.': 'Baue deine Armee direkt hier – Einheiten, Wargear, Enhancements und Punkte direkt aus den New-Recruit-Daten (BSData). Gespeicherte Listen kannst du in jedes Spiel übernehmen.',
  'Each time': 'Jedes Mal', 'not attached': 'nicht angeschlossen', 'Tap to take one more': 'Tippen für noch eins', 'Tap to add one more': 'Tippen für noch eins',
  'One leader is': 'Ein Leader ist', 'leaders are': 'Leaders sind', 'not attached to a unit yet:': 'noch keiner Einheit angeschlossen:', '1 leader is': '1 Leader ist'
});
PATTERNS.push(['^\\+ Add (.+?)\\s*$', (m, n) => '+ ' + n + ' hinzufügen'], ['^replaces one (.+)$', (m, n) => 'ersetzt: ' + n],
  ['^· up to (\\d+), max 1 of each$', (m, n) => '· bis zu ' + n + ', je höchstens 1']);
PATTERNS.push(
  ['^Draw (\\d+) cards?$', (m, n) => n + ' Karten ziehen'], ['^Opponent: (.+) – active effects$', (m, n) => 'Gegner: ' + n + ' – aktive Effekte'],
  ['(?<![A-Za-z])Round (\\d+)(?![/\\d])', (m, n) => 'Runde ' + n], ['(?<![A-Za-z])(\\d+) points(?![A-Za-z])', (m, n) => n + ' Punkte'],
  ['Detachments: (\\d+) Detachment Points used – only (\\d+) available', (m, a, b) => 'Detachments: ' + a + ' Detachment Points verbraucht – nur ' + b + ' verfügbar'],
  ['^(\\d+) / (\\d+) Detachment Points used\\.', (m, a, b) => a + ' / ' + b + ' Detachment Points verbraucht.'],
  ['^Deck: (\\d+) cards$', (m, n) => 'Deck: ' + n + ' Karten'],
  ['^Deployment begins\\. (.+) is the Attacker\\. Both players start with 0 CP\\.$', (m, n) => 'Deployment beginnt. ' + n + ' ist der Attacker. Beide Spieler beginnen mit 0 CP.'],
  ['^(.+) attached to$', (m, n) => n + ' angeschlossen an']
);

Object.assign(EXACT, { 'Army': 'Armee', 'Score': 'Spielstand', 'Total': 'Gesamt', 'Draw': 'Ziehen', 'Delete': 'Löschen', 'Done': 'Fertig', 'Close': 'Schließen', 'Save': 'Speichern',
  'OK': 'OK', 'Note': 'Notiz', 'Back': 'Zurück', 'Join': 'Beitreten', 'Import': 'Importieren', 'Setup': 'Setup', 'Name': 'Name', 'Faction': 'Fraktion', 'Modifier': 'Modifikator',
  'Role': 'Rolle', 'Lobby': 'Lobby', 'Undo': 'Rückgängig', 'Reload': 'Neu laden', 'Language': 'Sprache', 'Copy': 'Kopieren', 'Set': 'Setzen', 'Change': 'Ändern',
  'Game': 'Spiel', 'Player': 'Spieler', 'Points': 'Punkte', 'Use': 'Einsetzen', 'Used': 'Genutzt', 'Score (tablet)': 'Spielstand (Tablet)' });
PATTERNS.push(['^Draw \\((\\d+)\\)$', (m, n) => 'Ziehen (' + n + ')'], ['^Setup · Game', () => 'Setup · Spiel'], ['^Game (\\w{4}) · (.+)$', (m, c, n) => 'Spiel ' + c + ' · ' + n],
  ['(.+): available – ', (m, n) => n + ': verfügbar – '], ['· your turn', () => '· dein Zug'], ['^(.+) is the Attacker ·', (m, n) => n + ' ist der Attacker ·'], ['^is the Attacker ·$', () => 'ist der Attacker ·'],
  ['^is the Defender$', () => 'ist der Defender'], ['^Weiter: (.+) ›$', (m, n) => 'Weiter: ' + n + ' ›']);

Object.assign(PHRASES, {
  'no list – Stratagems without “Affects” matching': 'keine Liste – Stratagems ohne „Affects“-Abgleich',
  '(“Affects: …” on Stratagems on the phone)': '(„Affects: …“ bei Stratagems auf dem Handy)'
});
PATTERNS.push(
  ['^(.+): Army$', (m, n) => n + ': Armee'],
  ['^Start of (.+)\'s turn · Round (\\d+) · Tactical Missions: draw (\\d+) cards, read them, then review your active cards\\.$', (m, n, r, c) => 'Beginn des Zuges von ' + n + ' · Runde ' + r + ' · Taktische Missionen: ' + c + ' Karten ziehen, lesen, dann die aktiven Karten prüfen.'],
  ['^Battle round (\\d+), (.+)\'s turn: (.+?)\\. Both players gain 1 CP\\. (.+) draws (\\d+) Secondary Mission cards\\.$', (m, r, n, ph, n2, c) => 'Battle round ' + r + ', Zug von ' + n + ': ' + ph + '. Beide Spieler erhalten 1 CP. ' + n2 + ' zieht ' + c + ' Secondary Mission-Karten.'],
  ['· achieved (\\d+)', (m, n) => '· erfüllt ' + n]
);

Object.assign(EXACT, { 'Book': 'Buchen' });
PATTERNS.push(['^Game (\\w{4})$', (m, c) => 'Spiel ' + c]);

/* whole-text labels (names such as "Tactical Brethren" / "Fixed Missions" stay English) */
Object.assign(EXACT, {
  'Tactical': 'Taktisch', 'Fixed': 'Fest', 'Nothing chosen': 'Nichts gewählt', 'Nothing chosen – pick:': 'Nichts gewählt – wählen:',
  'once per battle': 'einmal pro Schlacht', 'once per battle round': 'einmal pro Schlachtrunde', 'once per turn': 'einmal pro Zug', 'once per phase': 'einmal pro Phase',
  'twice per battle': 'zweimal pro Schlacht', 'not in round 1': 'nicht in Runde 1', 'Already used this phase': 'In dieser Phase bereits genutzt'
});
Object.assign(PHRASES, {
  'No rule text on file for this keyword.': 'Kein Regeltext zu diesem Keyword vorhanden.', '– the rule below uses it as “x”.': '– die Regel unten verwendet ihn als „x“.',
  'Could not check for new unit data – using the data on this device.': 'Neue Einheitendaten konnten nicht geprüft werden – die Daten auf diesem Gerät werden verwendet.',
  'Could not check for new unit data.': 'Neue Einheitendaten konnten nicht geprüft werden.', 'List copied as text': 'Liste als Text kopiert',
  'Back to setup': 'Zurück zum Setup', 'over the points limit': 'über dem Punktelimit',
  'No once-per-battle/round/turn abilities recognised': 'Keine Einmal-pro-Schlacht/Runde/Zug-Fähigkeiten erkannt',
  'Find a unit by name or keyword …': 'Einheit nach Name oder Keyword suchen …', 'Search rules, missions, stratagems, units…': 'Regeln, Missionen, Stratagems, Einheiten suchen …',
  'Paste the export from New Recruit or the GW app here': 'Export aus New Recruit oder der GW-App hier einfügen', 'Paste the army list here': 'Armeeliste hier einfügen',
  'e.g. Votann 2000': 'z. B. Votann 2000', 'e.g. Orks, Necrons, Space Marines': 'z. B. Orks, Necrons, Space Marines', 'e.g. 1500': 'z. B. 1500', 'Points, e.g. 1500': 'Punkte, z. B. 1500',
  'e.g. Boyz': 'z. B. Boyz', 'e.g. dice result, agreement …': 'z. B. Würfelergebnis, Absprache …', 'in the rule below.': 'in der Regel unten.'
});
PATTERNS.push(
  ['^(.+) with the value(\\s*)$', (m, k, sp) => k + ' mit dem Wert' + sp],
  ['^Game (\\w{4}) created$', (m, c) => 'Spiel ' + c + ' erstellt'], ['^(\\d+) units? imported$', (m, n) => n + (n === '1' ? ' Einheit' : ' Einheiten') + ' importiert'],
  ['^At least (\\d+) (.+) required \\(has (\\d+)\\)$', (m, n, w, v) => 'Mindestens ' + n + ' ' + w + ' erforderlich (vorhanden: ' + v + ')'],
  ['^(.+): at least (\\d+)(.*) required \\(has (\\d+)\\)$', (m, a, n, w, v) => a + ': mindestens ' + n + w + ' erforderlich (vorhanden: ' + v + ')'],
  ['^(.+): at most (\\d+)(.*) per army \\(has (\\d+)\\)$', (m, a, n, w, v) => a + ': höchstens ' + n + w + ' pro Armee (vorhanden: ' + v + ')'],
  ['^(.+) needs at least (\\d+)(.*) \\(has (\\d+)\\)$', (m, a, n, w, v) => a + ' braucht mindestens ' + n + w + ' (vorhanden: ' + v + ')']
);

/* Rulebook chrome (the entries themselves – rule texts, names, keywords – stay English, see SKIP in js/i18n.js) */
Object.assign(PHRASES, {
  'Core rule': 'Grundregel', 'Core rules': 'Grundregeln', 'Phase step': 'Phasenschritt', 'Phase steps': 'Phasenschritte', 'Glossary': 'Glossar',
  'Core stratagem': 'Kern-Stratagem', 'Core stratagems': 'Kern-Stratagems', 'Detachment rule': 'Detachment-Regel', 'Detachment rules': 'Detachment-Regeln',
  'Text export from New Recruit (choose file or paste text). Units, number of models and wargear are recognised and linked to the datasheets.': 'Textexport aus New Recruit (Datei wählen oder Text einfügen). Einheiten, Modellanzahl und Ausrüstung werden erkannt und mit den Datenblättern verknüpft.',
  'Search units of:': 'Einheiten suchen von:', '– choose faction –': '– Fraktion wählen –',
  'All factions (every datasheet)': 'Alle Fraktionen (alle Datenblätter)', 'Load datasheets of a faction': 'Datenblätter einer Fraktion laden',
  'Core rules by phase': 'Grundregeln nach Phase', 'Start of turn / battle round': 'Zugbeginn / Beginn der Schlachtrunde',
  'Glossary (A–Z)': 'Glossar (A–Z)', 'Primary missions': 'Primärmissionen', 'Secondary missions': 'Sekundärmissionen', 'Secondary mission': 'Sekundärmission',
  'Mission sequence': 'Missionsablauf', '‹ Factions': '‹ Fraktionen', 'No army rule on file.': 'Keine Armeeregel vorhanden.', 'No detachment rule on file.': 'Keine Detachment-Regel vorhanden.',
  'Loading units …': 'Einheiten werden geladen …', 'Loading …': 'Wird geladen …', 'units loaded': 'Einheiten geladen',
  'Start of battle round': 'Beginn der Schlachtrunde', 'Start of turn': 'Zugbeginn', 'Search the rulebook': 'Regelwerk durchsuchen',
  'No datasheets available for this faction.': 'Für diese Fraktion sind keine Datenblätter vorhanden.', 'Either turn': 'Beide Züge',
  'not in the first battle round': 'nicht in der ersten Schlachtrunde', 'Mission sequence not available (data/orig/missions.json).': 'Missionsablauf nicht verfügbar (data/orig/missions.json).',
  'Fixed only': 'nur Fest', 'Tactical only': 'nur Taktisch', 'Units are only searched for loaded factions – pick one above.': 'Einheiten werden nur in geladenen Fraktionen gesucht – oben eine wählen.',
  'datasheets – tap to expand.': 'Datenblätter – zum Aufklappen antippen.', 'VP each': 'VP je',
  // tablet scoring rows
  'due now': 'jetzt fällig', 'Booked': 'Gebucht', 'Choose': 'Wählen', 'Wording of this condition': 'Wortlaut dieser Bedingung',
  'End of Command phase': 'Ende der Command phase', 'End of battle': 'Schlachtende',
  'Primary Mission: max. 15 VP per battle round and 45 VP per battle. Secondary Missions: max. 15 VP per battle round and 45 VP per battle, with Fixed Missions max. 20 VP per card. Battle Ready army: 10 VP at the end of the battle. Total max. 100 VP. The tablet caps automatically.':
    'Primary Mission: max. 15 VP pro Battle round und 45 VP pro Schlacht. Secondary Missions: max. 15 VP pro Battle round und 45 VP pro Schlacht, bei Fixed Missions max. 20 VP pro Karte. Battle-Ready-Armee: 10 VP am Ende der Schlacht. Insgesamt max. 100 VP. Das Tablet begrenzt automatisch.'
});
/* single words: only as the whole text (inside names such as "Fixed Missions" or "Replace bolt pistol" they stay English) */
delete PHRASES['Replace'];
Object.assign(EXACT, {
  'Missions': 'Missionen', 'Units': 'Einheiten', 'Reference': 'Nachschlagen', 'Twists': 'Twists', 'Factions': 'Fraktionen', 'Reminders': 'Erinnerungen',
  'Detachments': 'Detachments', 'Always': 'Immer', 'Replace': 'Ersetzen', 'Battle size': 'Spielgröße', 'BATTLE SIZE': 'SPIELGRÖSSE'
});
PATTERNS.push(
  ['^No match for “(.+?)”\\.', (m, q) => 'Kein Treffer für „' + q + '“.'],
  ['^(\\d+) results?$', (m, n) => n + (n === '1' ? ' Treffer' : ' Treffer')],
  ['^(\\d+) results? · showing the first (\\d+) – refine your search$', (m, n, k) => n + ' Treffer · die ersten ' + k + ' werden gezeigt – Suche verfeinern'],
  ['^Units \\((\\d+)\\)$', (m, n) => 'Einheiten (' + n + ')'],
  ['(?<![A-Za-z])rounds (\\d)', (m, n) => 'Runden ' + n],
  ['^booked (\\d+) VP$', (m, n) => 'gebucht: ' + n + ' VP'],
  // "Round 2 · opponent's turn" (active effects) – before the general "<name>'s turn" template
  ['^Round (\\d+) · opponent\'s turn$', (m, n) => 'Runde ' + n + ' · Zug des Gegners'], ['^Round (\\d+) · your turn$', (m, n) => 'Runde ' + n + ' · dein Zug'],
  // one Undo takes back a whole tablet step (End turn / Next phase); score popup: total before the VP caps
  ['^Last step undone \\((\\d+) actions\\)$', (m, n) => 'Letzter Schritt rückgängig gemacht (' + n + ' Aktionen)'],
  ['^\\((-?\\d+) VP before the caps\\)$', (m, n) => '(' + n + ' VP vor den Obergrenzen)']
);

/* Handing a game over to another host device (lobby "Take over as host", server messages, the switch on every device) */
Object.assign(PHRASES, {
  'Take over as host': 'Als Host übernehmen',
  'The game moves here with its whole history and this device hosts it from now on. All connected devices switch over automatically; the other device keeps a read-only copy.': 'Das Spiel zieht mit seinem ganzen Verlauf hierher um, und ab jetzt hostet dieses Gerät es. Alle verbundenen Geräte wechseln automatisch; das andere Gerät behält eine schreibgeschützte Kopie.',
  'Could not take over the game': 'Das Spiel konnte nicht übernommen werden',
  'A game with this code already exists on this device': 'Auf diesem Gerät gibt es schon ein Spiel mit diesem Code',
  'The game changed meanwhile – try again': 'Das Spiel hat sich inzwischen geändert – bitte noch einmal versuchen',
  'The game kept changing during the handover – try again': 'Das Spiel hat sich während der Übergabe immer wieder geändert – bitte noch einmal versuchen',
  'Only this device itself can take over a game': 'Nur dieses Gerät selbst kann ein Spiel übernehmen',
  'The old host did not hand over the game': 'Das bisherige Host-Gerät hat das Spiel nicht übergeben',
  'The other device could not be reached': 'Das andere Gerät war nicht erreichbar',
  'Invalid address of the old host': 'Ungültige Adresse des bisherigen Host-Geräts',
  'Port of the new host missing': 'Port des neuen Host-Geräts fehlt',
  'Action log missing': 'Aktionsprotokoll fehlt', 'Import failed': 'Import fehlgeschlagen'
});
Object.assign(EXACT, { 'Take over': 'Übernehmen', 'Moved': 'Umgezogen' });
PATTERNS.push(
  ['^Host game (\\w{4}) on this device\\?$', (m, c) => 'Spiel ' + c + ' auf diesem Gerät hosten?'],
  ['^You are now hosting game (\\w{4})$', (m, c) => 'Dieses Gerät hostet jetzt Spiel ' + c],
  ['^Game (\\w{4}) moved to (.+) – switching …$', (m, c, n) => 'Spiel ' + c + ' ist auf ' + n + ' umgezogen – wechsle …'],
  ['^This game was moved to (.+) – continue there\\.$', (m, n) => 'Dieses Spiel ist auf ' + n + ' umgezogen – dort weiterspielen.'],
  ['^Moved to (.+)$', (m, n) => 'Umgezogen auf ' + n]
);

/* Usability run 2026-10-16: whole sentences / templates instead of word-by-word pieces (no half translations) */
TERMS['Command points'] = 'Befehlspunkte';
delete PHRASES['in battle'];   // only as the whole text (ability state) – inside sentences it broke "Not in battle round 1"
Object.assign(EXACT, {
  'in battle': 'in der Schlacht', 'ready': 'bereit', '✓ Ready': '✓ Bereit', 'Ready': 'Bereit', 'Update': 'Aktualisieren', 'Add': 'Hinzufügen', 'or': 'oder',
  'Once per battle': 'Einmal pro Schlacht', 'Once per battle round': 'Einmal pro Schlachtrunde', 'Once per turn': 'Einmal pro Zug', 'Once per phase': 'Einmal pro Phase',
  'Twice per battle': 'Zweimal pro Schlacht', 'Factions:': 'Fraktionen:', 'All factions': 'Alle Fraktionen', 'Models': 'Modelle', 'Reserve': 'Reserve',
  'Edit unit': 'Einheit bearbeiten', 'First turn:': 'Erster Zug:', 'Drawn now': 'Gerade gezogen', 'Already active': 'Bereits aktiv', 'Battle over': 'Schlacht vorbei'
});
Object.assign(PHRASES, {
  // setup / review & start / deployment checklist
  'I’m ready': 'Ich bin bereit', 'tap to take it back': 'tippen zum Zurücknehmen', 'Deployment in progress': 'Aufstellung läuft', 'Score – setup in progress': 'Spielstand – Setup läuft',
  'no list yet – the phone then has no datasheets, Stratagem targets or automatic army rules': 'noch keine Liste – das Handy hat dann keine Datenblätter, keine Stratagem-Ziele und keine automatischen Armeeregeln',
  'Continue on the devices': 'Auf den Geräten weiter', 'Tablet in the middle of the table (Score):': 'Tablet in der Tischmitte (Spielstand):', '· one phone per player (rules):': '· ein Handy pro Spieler (Regeln):',
  'Keywords (comma-separated)': 'Keywords (durch Komma getrennt)', 'Token radius (inches)': 'Token-Radius (Zoll)', 'M (inches)': 'M (Zoll)',
  'Token radius: automatic by number of models as long as the field is left empty.': 'Token-Radius: automatisch nach Modellanzahl, solange das Feld leer bleibt.',
  '(Defender) deploys first: one unit each, alternating, wholly within your own deployment zone, until all units are deployed or in Reserves. After deploying a TITANIC unit, skip your next deployment. Redeployments afterwards alternate, starting with the Attacker.':
    '(Defender) stellt zuerst auf: abwechselnd je eine Einheit, vollständig in der eigenen deployment zone, bis alle Einheiten aufgestellt oder in Reserves sind. Nach einer TITANIC-Einheit setzt du beim nächsten Aufstellen einmal aus. Umstellungen danach abwechselnd, beginnend mit dem Attacker.',
  'Roll off: both players roll, the winner takes the first turn. Pre-battle rules (e.g. Scouts) are resolved alternately afterwards, starting with the player taking the first turn.':
    'Wurf: Beide Spieler würfeln, der Gewinner hat den ersten Zug. Regeln vor der Schlacht (z. B. Scouts) werden danach abwechselnd abgehandelt, beginnend mit dem Spieler, der den ersten Zug hat.',
  'Start battle (choose first turn first)': 'Schlacht starten (zuerst den ersten Zug wählen)',
  'No Warlord marked in the list – choose one in the army': 'Kein Warlord in der Liste markiert – wähle einen in der Armee',
  'Choose a Force Disposition in the army configuration (it is not part of a list)': 'Wähle eine Force Disposition in der Armee-Konfiguration (sie ist nicht Teil einer Liste)',
  // player phone / tablet
  'Active Secondary Missions': 'Aktive Secondary Missions', 'No Fixed Missions chosen.': 'Keine Fixed Missions gewählt.',
  // Stratagem checks of the game engine (engine/stratagems.js) – also inside "Not possible – …"
  'Not in battle round 1': 'Nicht in Schlachtrunde 1', 'Once per battle – already used': 'Einmal pro Schlacht – bereits genutzt',
  'Already used this battle round (house rule)': 'In dieser Schlachtrunde bereits genutzt (Hausregel)', 'Battle not in progress': 'Die Schlacht läuft nicht',
  'Unknown Stratagem': 'Unbekanntes Stratagem', 'Unknown player': 'Unbekannter Spieler', "Only in your opponent's turn": 'Nur im Zug des Gegners', 'Only in your own turn': 'Nur im eigenen Zug',
  'Invalid cost': 'Ungültige Kosten', 'Unit not found': 'Einheit nicht gefunden', 'Unit is destroyed': 'Die Einheit ist vernichtet',
  'Battle-shocked units cannot be targeted by your own Stratagems': 'Battle-shocked Einheiten können nicht Ziel deiner eigenen Stratagems sein',
  'This unit was already targeted by a Stratagem this phase': 'Diese Einheit war in dieser Phase bereits Ziel eines Stratagems',
  // unit data / app updates (popup, banner, status line in App & data)
  "New Recruit's data (BSData) has been updated.": 'Die Daten von New Recruit (BSData) wurden aktualisiert.',
  'Datasheets, abilities, army and detachment rules and enhancements will be updated on this device (takes a few seconds, games are not affected).': 'Datenblätter, Fähigkeiten, Armee- und Detachment-Regeln sowie Optimierungen werden auf diesem Gerät aktualisiert (dauert ein paar Sekunden, Spiele sind nicht betroffen).',
  'New unit data available – not installed yet.': 'Neue Einheitendaten verfügbar – noch nicht installiert.', 'Unit data is up to date.': 'Die Einheitendaten sind aktuell.',
  'No internet – using the data on this device.': 'Kein Internet – die Daten auf diesem Gerät werden verwendet.', 'Checking New Recruit data (BSData) …': 'Prüfe die New-Recruit-Daten (BSData) …',
  'Update check failed – using the data on this device.': 'Update-Prüfung fehlgeschlagen – die Daten auf diesem Gerät werden verwendet.',
  'Your games stay on this device.': 'Deine Spiele bleiben auf diesem Gerät.', 'Downloading the new app version …': 'Die neue App-Version wird geladen …',
  'The update installs in the background and the app restarts by itself; your games stay on this computer.': 'Das Update wird im Hintergrund installiert und die App startet von selbst neu; deine Spiele bleiben auf diesem Computer.',
  'Android will ask you to confirm the installation; your games stay on the device.': 'Android bittet dich, die Installation zu bestätigen; deine Spiele bleiben auf dem Gerät.',
  'No internet – the app keeps working with what it has.': 'Kein Internet – die App arbeitet mit dem weiter, was sie hat.',
  // rulebook search
  'Core rules only': 'nur Grundregeln',
  'Only the factions of your game or army lists are searched – “All factions” searches every faction.': 'Nur die Fraktionen deines Spiels bzw. deiner Armeelisten werden durchsucht – „Alle Fraktionen“ durchsucht jede Fraktion.',
  'Matches in other factions – tap “All factions”.': 'Treffer in anderen Fraktionen – tippe auf „Alle Fraktionen“.'
});
const nUnits = n => n + (n === '1' ? ' Einheit' : ' Einheiten'), nFiles = n => n + (n === '1' ? ' Datei' : ' Dateien');
const readyDe = r => (r === 'ready' ? 'bereit' : 'nicht bereit');
PATTERNS.push(
  // builder
  ['^Create (.+) army$', (m, n) => 'Armee erstellen: ' + n], ['^(\\d+) profiles$', (m, n) => n + ' Profile'],
  ['^No enhancements in your list( \\(no army list imported\\))?\\.$', (m, x) => 'Keine Optimierungen in deiner Liste' + (x ? ' (keine Armeeliste importiert)' : '') + '.'],
  // setup
  ['^(.+): up to (\\d+) Detachment Points\\. Several Detachments are allowed as long as the DP total fits\\.$', (m, s, n) => s + ': bis zu ' + n + ' Detachment Points. Mehrere Detachments sind erlaubt, solange die DP-Summe passt.'],
  ['^(.+?): (not ready|ready)(?: · (.+?): (not ready|ready))?$', (m, a, ra, b, rb) => a + ': ' + readyDe(ra) + (b ? ' · ' + b + ': ' + readyDe(rb) : '')],
  ['^points · (\\d+) units?$', (m, n) => 'Punkte · ' + nUnits(n)],
  ['^“(.+)” taken into the game(?: · game size (.+) \\((\\d+) points\\))?$', (m, n, g, p) => '„' + n + '“ ins Spiel übernommen' + (g ? ' · Spielgröße ' + g + ' (' + p + ' Punkte)' : '')],
  ['^“(.+)” could not be taken into the game – nothing was imported$', (m, n) => '„' + n + '“ konnte nicht ins Spiel übernommen werden – nichts wurde importiert'],
  ['^Army is (\\d+) points over the limit\\.$', (m, n) => 'Die Armee liegt ' + n + ' Punkte über dem Limit.'],
  ['^Battle · Round (\\d+)$', (m, n) => 'Schlacht · Runde ' + n], ['^Game (\\w{4}) created\\.$', (m, c) => 'Spiel ' + c + ' erstellt.'],
  ['^The battle begins – (.+) takes the first turn$', (m, n) => 'Die Schlacht beginnt – ' + n + ' hat den ersten Zug'],
  // tablet: start of a turn (Secondary Missions)
  ['^Start of (.+)\'s turn · Round (\\d+) · Read your new cards, then review your active Secondary Missions\\.$', (m, n, r) => 'Beginn des Zuges von ' + n + ' · Runde ' + r + ' · Lies deine neuen Karten und prüfe dann deine aktiven Secondary Missions.'],
  ['^Start of (.+)\'s turn · Round (\\d+) · Your Fixed Secondary Missions \\(active all battle\\):$', (m, n, r) => 'Beginn des Zuges von ' + n + ' · Runde ' + r + ' · Deine Fixed Secondary Missions (die ganze Schlacht aktiv):'],
  // player phone: toasts / booked notes (one line each – js/i18n.js translates multi-line toasts line by line)
  ['^(.+) used \\((.+)\\)$', (m, n, l) => n + ' genutzt (' + l + ')'], ['^(.+): use undone$', (m, n) => n + ': Nutzung rückgängig gemacht'],
  ['^(.+) undone$', (m, n) => n + ' rückgängig gemacht'], ['^(.+) used$', (m, n) => n + ' eingesetzt'],
  ['^Only in: (.+)$', (m, p) => 'Nur in: ' + p], ['^Not enough CP \\((\\d+)/(\\d+)\\)$', (m, a, b) => 'Nicht genug CP (' + a + '/' + b + ')'],
  // unit data / app updates
  ['^New Recruit\'s data \\(BSData\\) has been updated on (.+)\\.$', (m, d) => 'Die Daten von New Recruit (BSData) wurden am ' + d + ' aktualisiert.'],
  ['^(\\d+) files? changed$', (m, n) => nFiles(n) + ' geändert'], ['^New Recruit data from (.+)$', (m, d) => 'New-Recruit-Daten vom ' + d],
  ['^Battle Report 40k (\\S+)(?: from (.+?))? is available \\(installed: (\\d+)\\)\\.$', (m, t, d, n) => 'Battle Report 40k ' + t + (d ? ' vom ' + d : '') + ' ist verfügbar (installiert: ' + n + ').'],
  ['^Only the changes are downloaded: (\\d+) files?, (.+)\\.$', (m, n, s) => 'Nur die Änderungen werden geladen: ' + nFiles(n) + ', ' + s + '.'],
  ['^Downloading (\\d+) changed files? \\((.+)\\) …$', (m, n, s) => nFiles(n).replace(/^(\d+) /, '$1 geänderte ') + ' werden geladen (' + s + ') …'],
  ['^Updated to (.+) – restarting …$', (m, t) => 'Aktualisiert auf ' + t + ' – Neustart …'], ['^App update failed: (.+)$', (m, e) => 'App-Update fehlgeschlagen: ' + e],
  ['(?<![A-Za-z])Downloading (\\S+) \\((\\d+)/(\\d+)\\) …', (m, f, a, b) => 'Lade ' + f + ' (' + a + '/' + b + ') …'],
  ['(?<![A-Za-z])Loading (\\S+\\.json) \\((\\d+)/(\\d+)\\) …', (m, f, a, b) => 'Lese ' + f + ' (' + a + '/' + b + ') …'],
  ['(?<![A-Za-z])Converting (\\d+) files on the device …', (m, n) => 'Wandle ' + nFiles(n) + ' auf dem Gerät um …'],
  ['(?<![A-Za-z])Unit data updated \\((\\d+) files? downloaded\\) – reloading …', (m, n) => 'Einheitendaten aktualisiert (' + nFiles(n) + ' geladen) – lade neu …'],
  // rulebook
  ['^(.+) – step (\\d+)$', (m, p, n) => p + ' – Schritt ' + n],
  ['^No entry contains all (\\d+) words – best matches with (\\d+) of them\\.$', (m, n, k) => 'Kein Eintrag enthält alle ' + n + ' Wörter – beste Treffer mit ' + k + ' davon.']
);

/* Seamless game flow 2026-10-16: merged scoring sheet, scoring on the phone, CP rule offers, score correction, card-rule
 * picks, army builder (allies, saved mark, leader picker), setup "From My armies", host handover */
const WHEN_DE = { 'End of turn': 'Ende des Zuges', 'End of battle': 'Schlachtende', 'End of the battle': 'Ende der Schlacht', 'End of Command phase': 'Ende der Command phase', 'End of your turn': 'Ende deines Zuges' };
/** "End of turn + End of Anna's turn" → German, or null when a part is not a known moment. */
const whenDe = w => {
  const parts = String(w).split(' + ').map(x => WHEN_DE[x] || (/^End of (.+)'s turn$/.test(x) ? x.replace(/^End of (.+)'s turn$/, 'Ende des Zuges von $1') : null));
  return parts.every(Boolean) ? parts.join(' + ') : null;
};
Object.assign(EXACT, {
  'Skip': 'Überspringen', 'Allies': 'Verbündete', '✓ Saved': '✓ Gespeichert', '⚠ Not saved': '⚠ Nicht gespeichert', 'Battle Size': 'Spielgröße',
  'Waiting for': 'Warten auf', 'to confirm on their phones': '– Bestätigung auf den Handys', 'to confirm on their phone': '– Bestätigung auf dem Handy',
  'Confirm here': 'Hier bestätigen', '\'s phone is connected': ' – Handy verbunden', 'Leading:': 'Führt an:', 'Led by:': 'Angeführt von:', '(not in list)': '(nicht in der Liste)',
  '– led by': '– angeführt von', 'Score now': 'Jetzt werten', 'Score breakdown': 'Punkteübersicht', 'Your scoring is due': 'Deine Wertung ist fällig',
  'Scoring confirmed': 'Wertung bestätigt', 'Correct last scoring': 'Letzte Wertung korrigieren', 'Save correction': 'Korrektur speichern', 'No change': 'Keine Änderung',
  'Select beacon unit': 'Beacon-Einheit wählen', 'Change beacon unit': 'Beacon-Einheit ändern', 'Select guards': 'Wachen wählen', 'Change guards': 'Wachen ändern',
  '– no guard –': '– keine Wache –', 'Beacon unit selected': 'Beacon-Einheit gewählt', 'Guards saved': 'Wachen gespeichert',
  'End of your turn': 'Ende deines Zuges', 'End of the battle': 'Ende der Schlacht', 'End of the battle:': 'Am Ende der Schlacht:',
  'End of turn and end of the battle': 'Ende des Zuges und Ende der Schlacht', 'Start of': 'Beginn des Zuges von', 'active now': 'jetzt aktiv',
  'none of your units': 'keine deiner Einheiten', 'Units with the keyword': 'Einheiten mit dem Keyword', 'Your units excluded': 'Deine ausgeschlossenen Einheiten',
  'Move host to another device': 'Host auf ein anderes Gerät verlegen', 'Move host to another device…': 'Host auf ein anderes Gerät verlegen …',
  'is ready and waiting for you': 'ist bereit und wartet auf dich', 'is ready and waiting for': 'ist bereit und wartet auf', '✓ You are ready – waiting for': '✓ Du bist bereit – warten auf',
  'and tap': 'und tippe auf', 'No card left to draw': 'Keine Karte mehr zum Ziehen'
});
Object.assign(PHRASES, {
  'Discard · +1 CP': 'Abwerfen · +1 CP', 'Discard & redraw (1 CP)': 'Abwerfen & neu ziehen (1 CP)',   // whole line: CP still goes through TERMS
  // scoring (tablet sheet, phone sheet, correction)
  'No scoring pending for you': 'Für dich ist keine Wertung offen', 'No scoring pending': 'Keine Wertung offen', 'This scoring was already confirmed': 'Diese Wertung wurde bereits bestätigt',
  'Nothing to score right now.': 'Gerade gibt es nichts zu werten.', 'Your latest entries': 'Deine letzten Einträge',
  'Mark what you achieved and confirm. The score device shows the result.': 'Markiere, was du erfüllt hast, und bestätige. Das Spielstand-Gerät zeigt das Ergebnis.',
  'pre-filled from the objective strip – check': 'aus der Missionsziel-Leiste vorausgefüllt – bitte prüfen',
  'Shows what is booked for that turn. Change what was wrong – only the difference is booked.': 'Zeigt, was für diesen Zug gebucht ist. Ändere, was falsch war – nur die Differenz wird gebucht.',
  // Secondary Missions on the phone
  'Discarding a card in your turn gives +1 CP at the end of your turn (once per turn).': 'Wirfst du in deinem Zug eine Karte ab, erhältst du am Ende deines Zuges +1 CP (einmal pro Zug).',
  'You already discarded a card this turn – no further CP.': 'Du hast in diesem Zug schon eine Karte abgeworfen – kein weiterer CP.',
  'Once per battle, at the end of your Command phase, you can spend 1 CP to discard a card and draw a new one.': 'Einmal pro Schlacht kannst du am Ende deiner Command phase 1 CP ausgeben, um eine Karte abzuwerfen und eine neue zu ziehen.',
  'You gain 1 CP now (once per turn).': 'Du erhältst jetzt 1 CP (einmal pro Zug).', 'You gain 1 CP at the end of your turn (once per turn).': 'Du erhältst am Ende deines Zuges 1 CP (einmal pro Zug).',
  'No CP – you already discarded a card this turn.': 'Kein CP – du hast in diesem Zug schon eine Karte abgeworfen.', 'No CP – it is not your turn.': 'Kein CP – es ist nicht dein Zug.',
  'Or, once per battle at the end of your Command phase: spend 1 CP to discard it and draw a new card.': 'Oder, einmal pro Schlacht am Ende deiner Command phase: 1 CP ausgeben, um sie abzuwerfen und eine neue Karte zu ziehen.',
  'Discard & redraw already used this battle.': 'Abwerfen & neu ziehen in dieser Schlacht schon genutzt.', 'Card rule applied – new card drawn': 'Kartenregel angewendet – neue Karte gezogen',
  'The card moves to your achieved pile and leaves your hand. Book its VP first – your end-of-turn scoring moves scored cards there by itself.': 'Die Karte kommt auf deinen Stapel der erfüllten Karten und verlässt deine Hand. Buche zuerst ihre VP – deine Wertung am Zugende legt gewertete Karten von selbst dorthin.',
  // stratagem keyword chips / affected units
  'None of your units is excluded.': 'Keine deiner Einheiten ist ausgeschlossen.', 'None of your units has this keyword.': 'Keine deiner Einheiten hat dieses Keyword.',
  'Attached unit · acts as one unit': 'Angeschlossene Einheit · zählt als eine Einheit',
  // army builder
  'More than the points left': 'Mehr als die verbleibenden Punkte', 'Every change is saved on this device automatically': 'Jede Änderung wird automatisch auf diesem Gerät gespeichert',
  'Not saved – tap to try again': 'Nicht gespeichert – tippen, um es erneut zu versuchen', 'Army saved': 'Armee gespeichert', 'Still not saved – storage full or blocked': 'Immer noch nicht gespeichert – Speicher voll oder blockiert',
  'Could not save the army on this device (storage full or blocked) – nothing was created.': 'Die Armee konnte auf diesem Gerät nicht gespeichert werden (Speicher voll oder blockiert) – nichts wurde angelegt.',
  'Could not save the army on this device – your changes are kept while the editor stays open. Free some storage and try again.': 'Die Armee konnte auf diesem Gerät nicht gespeichert werden – deine Änderungen bleiben erhalten, solange der Editor offen ist. Gib Speicher frei und versuche es erneut.',
  'Could not save the copy on this device (storage full or blocked)': 'Die Kopie konnte auf diesem Gerät nicht gespeichert werden (Speicher voll oder blockiert)',
  'Detachment Points (DP): every detachment costs DP (shown next to it); the battle size sets how many you can spend – Incursion 2, Strike Force 3.': 'Detachment Points (DP): Jedes Detachment kostet DP (daneben angezeigt); die Spielgröße legt fest, wie viele du ausgeben kannst – Incursion 2, Strike Force 3.',
  'Fewer Detachment Points': 'Weniger Detachment Points', 'More Detachment Points': 'Mehr Detachment Points',
  'Not shown – the data hides this unit behind a switch:': 'Nicht angezeigt – die Daten verbergen diese Einheit hinter einem Schalter:',
  'Not shown – the data hides these units behind a switch:': 'Nicht angezeigt – die Daten verbergen diese Einheiten hinter einem Schalter:',
  // setup
  'One tap sets faction, Detachment and the army list.': 'Ein Tipp setzt Fraktion, Detachment und Armeeliste.', 'Or choose faction and Detachment by hand': 'Oder Fraktion und Detachment von Hand wählen',
  // host handover (More → Move host to another device)
  'The game runs on the device that created it. To move it to this tablet / PC or another one (e.g. when the phone that hosts it must leave the table):': 'Das Spiel läuft auf dem Gerät, das es erstellt hat. So verlegst du es auf dieses Tablet / diesen PC oder ein anderes Gerät (z. B. wenn das hostende Handy den Tisch verlassen muss):',
  'On the device that should host the game, open Battle Report 40k (the app – Android or Windows).': 'Öffne auf dem Gerät, das das Spiel hosten soll, Battle Report 40k (die App – Android oder Windows).',
  'All connected devices switch to the new host by themselves, in the same role. The old device keeps a read-only copy.': 'Alle verbundenen Geräte wechseln von selbst zum neuen Host, in derselben Rolle. Das alte Gerät behält eine schreibgeschützte Kopie.',
  'Both devices must be in the same Wi-Fi. Nothing is lost: the whole history moves with the game.': 'Beide Geräte müssen im selben WLAN sein. Nichts geht verloren: der ganze Verlauf zieht mit dem Spiel um.',
  'Join game': 'Spiel beitreten', 'Games nearby': 'Spiele in der Nähe',
  // engine messages (toasts)
  'This CP offer is no longer open': 'Dieses CP-Angebot ist nicht mehr offen', 'Nothing to correct': 'Nichts zu korrigieren', 'Round must be 1–5': 'Die Runde muss 1–5 sein',
  'VP must not be negative': 'VP dürfen nicht negativ sein', 'Invalid turn': 'Ungültiger Zug', 'No battle in progress': 'Keine Schlacht im Gange'
});
PATTERNS.push(
  // when labels ("End of Anna's turn", joined with +), sheet titles and lines built from them
  ['^End of (.+)\'s turn$', (m, n) => 'Ende des Zuges von ' + n], ['^(End of .+ \\+ End of .+)$', (m, w) => whenDe(w) || m],
['^Your scoring · (.+)$', (m, w) => 'Deine Wertung · ' + (whenDe(w) || w)],
  ['^(End of .+?) · Round (\\d+)$', (m, w, r) => (whenDe(w) || w) + ' · Runde ' + r],
  ['^End of (.+)\'s turn and end of the battle$', (m, n) => 'Ende des Zuges von ' + n + ' und Ende der Schlacht'],
  ['^Missions that score at the end of (.+)\'s turn$', (m, n) => 'Missionen, die am Ende des Zuges von ' + n + ' werten'],
  ['^(.+) can also confirm this part on their own phone\\.$', (m, n) => n + ' kann diesen Teil auch auf dem eigenen Handy bestätigen.'],
  ['^Scoring confirmed: (.+)$', (m, x) => 'Wertung bestätigt: ' + x.replace(/(-?\d+) VP for /g, '$1 VP für ')],
  ['^Correct the last scoring of (.+)$', (m, n) => 'Letzte Wertung von ' + n + ' korrigieren'], ['^Correct scoring – (.+)$', (m, n) => 'Wertung korrigieren – ' + n],
  ['^Scoring of (.+) corrected$', (m, n) => 'Wertung von ' + n + ' korrigiert'], ['^Round (\\d+) · (.+)\'s turn$', (m, r, n) => 'Runde ' + r + ' · Zug von ' + n],
  ['^(.+) has no confirmed scoring to correct yet – book points on the condition rows\\.$', (m, n) => n + ' hat noch keine bestätigte Wertung zum Korrigieren – buche Punkte über die Bedingungszeilen.'],
  ['^(?:Your scoring is confirmed\\. )?Waiting for (.+) to confirm their scoring\\.$', (m, n) => (m.startsWith('Your') ? 'Deine Wertung ist bestätigt. ' : '') + 'Warten auf die Bestätigung der Wertung von ' + n.replace(/ & /g, ' & ') + '.'],
  ['^Objective control · tap a marker: (.+?) → (.+?) → (nobody|none → auto) · stays set between turns and pre-fills the scoring$', (m, a, b, z) => 'Kontrolle der Missionsziele · Marker antippen: ' + a + ' → ' + b + ' → ' + (z === 'nobody' ? 'niemand' : 'keiner → auto') + ' · bleibt zwischen den Zügen gesetzt und füllt die Wertung vor'],
  ['^From round (\\d+):$', (m, r) => 'Ab Runde ' + r + ':'], ['^Card text of (.+)$', (m, n) => 'Kartentext von ' + n], ['^Datasheet of (.+)$', (m, n) => 'Datenblatt von ' + n],
  // "+1 CP" rule offers (tablet line, phone card)
  ['^\\(only if your WARLORD \\((.+)\\) is on the battlefield\\)$', (m, n) => '(nur wenn dein WARLORD (' + n + ') auf dem Schlachtfeld ist)'],
  ['^\\(only if (.+) is on the battlefield\\)$', (m, n) => '(nur wenn ' + n + ' auf dem Schlachtfeld ist)'],
  ['^Only if your WARLORD \\((.+)\\) is on the battlefield\\.$', (m, n) => 'Nur wenn dein WARLORD (' + n + ') auf dem Schlachtfeld ist.'],
  ['^Only if (.+) is on the battlefield\\.$', (m, n) => 'Nur wenn ' + n + ' auf dem Schlachtfeld ist.'], ['^Add (\\d+) CP$', (m, n) => n + ' CP hinzufügen'],
  // Beacon / Burden of Trust picks, card rules, discards
  ['^Beacon unit: (.+)$', (m, n) => 'Beacon-Einheit: ' + n], ['^Guards: (.+)$', (m, n) => 'Wachen: ' + n],
  ['^(.+) – select the beacon unit$', (m, n) => n + ' – Beacon-Einheit wählen'], ['^(.+) – select the guards$', (m, n) => n + ' – Wachen wählen'],
  ['^No unit in (.+)\'s army list qualifies\\.$', (m, n) => 'Keine Einheit in der Armeeliste von ' + n + ' kommt infrage.'],
  ['^(.+) discarded · drew (.+)$', (m, a, b) => a + ' abgeworfen · gezogen: ' + b], ['^(.+) discarded · no card left to draw$', (m, a) => a + ' abgeworfen · keine Karte mehr zum Ziehen'],
  ['^(.+) discarded( · \\+1 CP)?( at the end of your turn)?$', (m, a, cp, end) => a + ' abgeworfen' + (cp ? ' · +1 CP' + (end ? ' am Ende deines Zuges' : '') : '')],
  ['^New card: (.+)$', (m, n) => 'Neue Karte: ' + n], ['^Discard “(.+)”\\?$', (m, n) => '„' + n + '“ abwerfen?'], ['^“(.+)” achieved\\?$', (m, n) => '„' + n + '“ erfüllt?'],
  ['^Drawn: (.+)$', (m, n) => 'Gezogen: ' + n],
  ['^\'s turn · Fixed Secondary Missions: (.+)$', (m, l) => '· Fixed Secondary Missions: ' + l],
  // stratagems on the phone
  ['^Not available: (.+)$', (m, r) => 'Nicht verfügbar: ' + r], ['^needs (\\d+) CP$', (m, n) => 'braucht ' + n + ' CP'], ['^used \\(R(\\d+)\\)$', (m, r) => 'genutzt (R' + r + ')'],
  ['^Your units with (.+)$', (m, k) => 'Deine Einheiten mit ' + k],
  ['^(?:\\(unless they are (.+)\\) )?cannot be selected for this Stratagem\\.$', (m, u) => (u ? '(außer sie sind ' + u.replace(/ or /g, ' oder ') + ') ' : '') + 'können für dieses Stratagem nicht gewählt werden.'],
  // army builder / setup
  ['^(.+) – other catalogues this army may include$', (m, l) => l + ' – weitere Kataloge, die diese Armee enthalten darf'],
  ['^needs (\\d+) DP – (\\d+) of (\\d+) left(.*)$', (m, d, l, t, x) => 'braucht ' + d + ' DP – ' + l + ' von ' + t + ' übrig' + x],
  ['^“(.+)”: units taken, but the faction / Detachment could not be set completely – check step 2 \\(Army\\)$', (m, n) => '„' + n + '“: Einheiten übernommen, aber Fraktion / Detachment konnten nicht vollständig gesetzt werden – prüfe Schritt 2 (Armee)'],
  // host handover steps (text pieces around the bold labels)
  ['^On a tablet or PC the home screen shows “Take over game (\\w{4})”; otherwise go to$', (m, c) => 'Auf einem Tablet oder PC zeigt der Startbildschirm „Spiel ' + c + ' übernehmen“; sonst gehe zu'],
  ['^on game (\\w{4})\\.$', (m, c) => 'bei Spiel ' + c + '.'],
  // log lines of the game engine
  ['^Scoring (End of Command phase|End of turn|End of battle) for (.+): (\\d+) condition\\(s\\) to check$', (m, w, n, k) => 'Wertung ' + whenDe(w) + ' für ' + n + ': ' + k + ' Bedingung(en) zu prüfen'],
  ['^(.+): scoring confirmed \\((-?\\d+) VP\\)$', (m, n, v) => n + ': Wertung bestätigt (' + v + ' VP)'],
  ['^(.+): \\+(\\d+) CP – (.+) \\((.+), start of the (battle round|Command phase)\\), now (\\d+) CP$', (m, n, c, r, u, w, k) => n + ': +' + c + ' CP – ' + r + ' (' + u + ', Beginn der ' + (w === 'battle round' ? 'Schlachtrunde' : 'Command phase') + '), jetzt ' + k + ' CP'],
  ['^(.+): scoring corrected \\(round (\\d+), (.+)\'s turn\\) – (.+)$', (m, n, r, t, x) => n + ': Wertung korrigiert (Runde ' + r + ', Zug von ' + t + ') – ' + (x === 'no change' ? 'keine Änderung' : x)],
  ['^(.+): “(.+)” achieved \\((\\d+) VP\\) – discarded$', (m, n, c, v) => n + ': „' + c + '“ erfüllt (' + v + ' VP) – abgeworfen'],
  ['^(.+): “(.+)” discarded and redrawn \\(1 CP, (\\d+) left\\)(?: – drew “(.+)”|( – no card left to draw))?$', (m, n, c, k, d, none) => n + ': „' + c + '“ abgeworfen und neu gezogen (1 CP, ' + k + ' übrig)' + (d ? ' – gezogen: „' + d + '“' : none ? ' – keine Karte mehr zum Ziehen' : '')],
  ['^No pending scoring for (.+)$', (m, n) => 'Keine offene Wertung für ' + n]
);

/* 3D battle table (js/ui/table3d.js) */
Object.assign(EXACT, { 'Battle table': 'Spieltisch', 'Battle table (3D)': 'Spieltisch (3D)', 'Flip side': 'Seite wechseln', 'Top': 'Von oben', 'Reset': 'Zurücksetzen',
  'Layout': 'Layout', 'Zones': 'Zonen', '3" range': '3"-Reichweite', 'Dense terrain': 'Dichtes Gelände', 'Light terrain': 'Leichtes Gelände', 'Walls': 'Wände',
  'Units': 'Einheiten', 'Grid': 'Raster', 'Labels': 'Beschriftung', 'Apply event layout': 'Event-Layout übernehmen', 'No terrain': 'Kein Gelände', '‹ Back': '‹ Zurück' });
Object.assign(PHRASES, {
  'Loading 3D view …': '3D-Ansicht wird geladen …',
  'The table as a 3D model: zones, objectives, terrain': 'Der Tisch als 3D-Modell: Zonen, Missionsziele, Gelände',
  'Choose the terrain layout': 'Geländelayout wählen', 'Look from the other table edge': 'Von der anderen Tischkante schauen', 'Straight from above': 'Senkrecht von oben',
  'Reset the view': 'Ansicht zurücksetzen', 'Fullscreen': 'Vollbild', 'Fullscreen is not available here': 'Vollbild ist hier nicht verfügbar',
  'No terrain layout chosen yet – “Layout” picks one of the 45 Event Companion layouts.': 'Noch kein Geländelayout gewählt – „Layout“ wählt eines der 45 Event-Companion-Layouts.',
  'Random layout: its pieces are only known on the VR headset that generated it – pick an official layout here to see terrain.': 'Zufallslayout: Seine Teile kennt nur die VR-Brille, die es erzeugt hat – hier ein offizielles Layout wählen, um Gelände zu sehen.',
  'No deployment zones: choose the Deployment card in the setup or an Event Companion layout.': 'Keine Aufstellungszonen: im Setup die Deployment-Karte oder ein Event-Companion-Layout wählen.',
  'No deployment zones: choose the Deployment card in the setup.': 'Keine Aufstellungszonen: im Setup die Deployment-Karte wählen.',
  'Drag = turn · pinch / wheel = zoom · two fingers or right button = move · double tap = reset.': 'Ziehen = drehen · Pinch / Mausrad = zoomen · zwei Finger oder rechte Taste = verschieben · Doppeltipp = zurücksetzen.',
  'No layout for this pairing': 'Kein Layout für diese Paarung', 'Spectator – view only': 'Zuschauer – nur Ansicht'
});
PATTERNS.push(['^([0-9]+) units? from the 2D map[.]$', (m, n) => n + (n === '1' ? ' Einheit' : ' Einheiten') + ' von der 2D-Karte.']);

/* deleting games (lobby list, score display More tab) */
Object.assign(EXACT, { 'Delete this game': 'Dieses Spiel löschen', 'Delete all': 'Alle löschen' });
Object.assign(PHRASES, {
  'Removes the game from the host – all devices leave it': 'Entfernt das Spiel vom Host – alle Geräte verlassen es',
  'Delete every game you may delete here – e.g. after a series of test games': 'Alle Spiele löschen, die hier gelöscht werden dürfen – z. B. nach einer Reihe Testspiele',
  'All actions and the score will be removed permanently on the host. Phones connected to this game return to the lobby. For a finished game use "End battle" instead – that keeps the result.': 'Alle Aktionen und der Spielstand werden auf dem Host endgültig entfernt. Verbundene Handys kehren zur Lobby zurück. Für ein beendetes Spiel stattdessen „End battle“ nutzen – das behält das Ergebnis.',
  'All actions and the score will be removed permanently.': 'Alle Aktionen und der Spielstand werden endgültig entfernt.'
});
PATTERNS.push(
  ['^Delete all [(]([0-9]+)[)]$', (m, n) => 'Alle löschen (' + n + ')'],
  ['^Delete ([0-9]+) games[?]$', (m, n) => n + ' Spiele löschen?'],
  ['^Delete game ([A-Za-z0-9]+)[?]$', (m, c) => 'Spiel ' + c + ' löschen?'],
  ['^Game ([A-Za-z0-9]+) deleted$', (m, c) => 'Spiel ' + c + ' gelöscht'],
  ['^Game ([A-Za-z0-9]+) was deleted by the host[.]$', (m, c) => 'Spiel ' + c + ' wurde vom Host gelöscht.'],
  ['^([0-9]+) games deleted$', (m, n) => n + ' Spiele gelöscht'],
  ['^([0-9]+) deleted, ([0-9]+) could not be deleted$', (m, a, b) => a + ' gelöscht, ' + b + ' nicht löschbar'],
  ['^(.+) – all actions and scores will be removed permanently[.] Finished games that are already saved on this device stay in "Finished games"[.]$', (m, l) => l + ' – alle Aktionen und Spielstände werden endgültig entfernt. Bereits auf diesem Gerät gespeicherte beendete Spiele bleiben unter „Finished games“.']
);

/* terrain layout in the setup + terrain objectives in the 3D battle table */
Object.assign(EXACT, { 'Terrain layout': 'Geländelayout', 'No terrain layout': 'Kein Geländelayout', 'Control range': 'Kontrollbereich' });
Object.assign(PHRASES, {
  'Warhammer Event Companion (11th edition): three official layouts per pairing of Force Dispositions – deployment zones, objectives inside terrain areas and 16 terrain areas. The 3D battle table shows the chosen layout.': 'Warhammer Event Companion (11. Edition): drei offizielle Layouts je Paarung der Force Dispositions – Aufstellungszonen, Missionsziele in Geländeflächen und 16 Geländeflächen. Der 3D-Spieltisch zeigt das gewählte Layout.',
  'Choose both Dispositions – then the three Event Companion layouts of this pairing appear here.': 'Beide Dispositions wählen – dann erscheinen hier die drei Event-Companion-Layouts dieser Paarung.',
  'No terrain layout chosen yet – Layout A of your two Force Dispositions is assumed. “Layout” or the setup sets the real one.': 'Noch kein Geländelayout gewählt – Layout A eurer beiden Force Dispositions wird angenommen. „Layout“ oder das Setup setzt das echte.'
});
PATTERNS.push(['^Current: (.+) [(]set by the VR headset[)][.]$', (m, c) => 'Aktuell: ' + c + ' (von der VR-Brille gesetzt).']);

/* battle size note (11th edition: one battlefield size) */
Object.assign(PHRASES, {
  'Strike Force · 2000 points · 3 Detachment Points · battlefield 44"×60"': 'Strike Force · 2000 Punkte · 3 Detachment Points · Spielfeld 44"×60"',
  'Incursion · 1000 points · 2 Detachment Points · same 44"×60" battlefield, Deployment cards and layouts as Strike Force': 'Incursion · 1000 Punkte · 2 Detachment Points · gleiches 44"×60"-Spielfeld, gleiche Deployment-Karten und Layouts wie Strike Force'
});

/* half table in the app + measurements layer */
Object.assign(EXACT, { 'Measurements': 'Maße', 'Random layout': 'Zufallslayout', 'New random layout': 'Neues Zufallslayout', 'Battlefield': 'Spielfeld' });
Object.assign(PHRASES, {
  '44"×60" (official)': '44"×60" (offiziell)', '44"×30" half table (unofficial)': '44"×30" Tischhälfte (inoffiziell)',
  'Half table: two games on one 44"×60" table. Unofficial – the 11th edition has no half-size format: the Deployment card is scaled to half length and the terrain comes from the random generator (half the Armageddon set).': 'Tischhälfte: zwei Spiele auf einem 44"×60"-Tisch. Inoffiziell – die 11. Edition kennt kein halbes Format: Die Deployment-Karte wird auf halbe Länge skaliert, das Gelände kommt aus dem Zufallsgenerator (halber Armageddon-Satz).',
  'Half table: the Event Companion layouts are for the 44"×60" battlefield – generate a layout for this half table instead.': 'Tischhälfte: Die Event-Companion-Layouts gelten für das 44"×60"-Spielfeld – erzeuge stattdessen ein Layout für diese Tischhälfte.',
  'Generated layout: half the Armageddon set placed by the Event Companion principles around this Deployment card.': 'Erzeugtes Layout: der halbe Armageddon-Satz nach den Event-Companion-Prinzipien um diese Deployment-Karte gesetzt.',
  'Choose the Deployment card first.': 'Zuerst die Deployment-Karte wählen.', 'No fair layout found – try again': 'Kein faires Layout gefunden – noch einmal versuchen',
  'Measurements: distances from the table edges to the nearest corner of every plate and to every objective, and each plate\'s angle – set the real terrain up by them.': 'Maße: Abstände von den Tischkanten zur nächsten Ecke jeder Platte und zu jedem Missionsziel, dazu der Winkel jeder Platte – danach lässt sich das echte Gelände stellen.'
});

/* mission sequence (Event Companion steps 1–12) */
Object.assign(EXACT, { 'Now': 'Jetzt', 'Reopen': 'Wieder öffnen', 'Mission sequence complete': 'Missionsablauf abgeschlossen' });
Object.assign(PHRASES, {
  'Mission sequence (Warhammer Event Companion)': 'Missionsablauf (Warhammer Event Companion)',
  'Warhammer Event Companion – Mission Sequence, steps 1–12.': 'Warhammer Event Companion – Missionsablauf, Schritte 1–12.',
  'This step follows on the score display once setup is finished (“Go to deployment”).': 'Dieser Schritt folgt auf dem Spielstand-Tablet, sobald das Setup abgeschlossen ist („Go to deployment“).',
  'Muster armies': 'Armeen aufstellen',
  'Each player loads their army roster (Army step) and selects one Force Disposition available to their detachment – noted on the roster.': 'Jeder Spieler lädt seine Armeeliste (Schritt Armee) und wählt eine seinem Detachment erlaubte Force Disposition – auf der Liste vermerkt.',
  'Determine mission': 'Mission bestimmen',
  'Each player finds the opponent\'s Force Disposition on their own card: the Primary Mission listed there is theirs. The app shows both once both Dispositions are chosen.': 'Jeder Spieler sucht die Force Disposition des Gegners auf seiner eigenen Karte: Die dort genannte Primary Mission ist seine. Die App zeigt beide, sobald beide Dispositions gewählt sind.',
  'Determine a layout': 'Layout bestimmen',
  'Choose layout A, B or C of your two Force Dispositions (Mission step → Terrain layout). Events usually go A, B, C in order.': 'Layout A, B oder C eurer beiden Force Dispositions wählen (Schritt Mission → Terrain layout). Auf Events meist A, B, C der Reihe nach.',
  'Half table: generate the layout for this half table (Mission step → Random layout).': 'Tischhälfte: das Layout für diese Tischhälfte erzeugen (Schritt Mission → Random layout).',
  'Create the battlefield': 'Spielfeld aufbauen',
  'Set up the terrain areas and the terrain features on them exactly as the layout shows – open the Battle table (3D), turn on Measurements, and place the real pieces by the distances shown. Confirm when the table is built.': 'Geländeflächen und die Geländeteile darauf genau wie im Layout aufstellen – Spieltisch (3D) öffnen, Maße einschalten und die echten Teile nach den Abständen setzen. Bestätigen, wenn der Tisch steht.',
  'Determine Attacker and Defender': 'Angreifer und Verteidiger bestimmen',
  'Agree which real table edges are the Attacker\'s and the Defender\'s edge of the card. Then roll off: the winner decides who is the Attacker – set it in the Mission step.': 'Einigt euch, welche echten Tischkanten die Angreifer- und die Verteidigerkante der Karte sind. Dann Roll-off: Der Gewinner entscheidet, wer Angreifer ist – im Schritt Mission eintragen.',
  'Select Secondary Missions': 'Secondary Missions wählen',
  'Each player secretly notes Tactical or Fixed (and which two Fixed Missions), then both reveal at once – enter the choice in the Secondary step. Confirm when both are revealed.': 'Jeder Spieler notiert geheim Tactical oder Fixed (und welche zwei Fixed Missions), dann decken beide gleichzeitig auf – die Wahl im Schritt Secondary eintragen. Bestätigen, wenn beide aufgedeckt haben.',
  'Declare Battle Formations': 'Battle Formations erklären',
  'Each player secretly notes which units start embarked in which TRANSPORTS and which start in strategic reserves, then both reveal at once.': 'Jeder Spieler notiert geheim, welche Einheiten in welchen TRANSPORTS starten und welche in den strategischen Reserven, dann decken beide gleichzeitig auf.',
  'Deploy armies': 'Armeen aufstellen',
  'Starting with the Defender, set up one unit at a time wholly within your own deployment zone (a TITANIC unit: skip your next turn to set up). Confirm when both armies stand.': 'Beginnend mit dem Verteidiger abwechselnd je eine Einheit vollständig in der eigenen Aufstellungszone aufstellen (TITANIC: danach eine Aufstellung aussetzen). Bestätigen, wenn beide Armeen stehen.',
  'Redeploy units': 'Einheiten umstellen',
  'Rules that let you redeploy after both armies are deployed are resolved now, alternating, starting with the Attacker (Scouts, Infiltrators\' redeploys …). Confirm when done or if nobody has such rules.': 'Regeln, die nach der Aufstellung ein Umstellen erlauben, jetzt abwechselnd abhandeln, beginnend mit dem Angreifer. Bestätigen, wenn fertig oder niemand solche Regeln hat.',
  'Determine first turn': 'Ersten Zug bestimmen', 'Roll off: the winner takes the first turn – set it below.': 'Roll-off: Der Gewinner hat den ersten Zug – unten eintragen.',
  'Resolve pre-battle rules': 'Vor-Schlacht-Regeln abhandeln',
  'Alternating, starting with the player who takes the first turn, resolve pre-battle rules of your units. Confirm when done.': 'Abwechselnd, beginnend mit dem Spieler mit dem ersten Zug, die Vor-Schlacht-Regeln eurer Einheiten abhandeln. Bestätigen, wenn fertig.',
  'Begin the battle': 'Schlacht beginnen', 'The first battle round begins – “Start battle” on the score display.': 'Die erste Schlachtrunde beginnt – „Start battle“ auf dem Spielstand-Tablet.'
});
