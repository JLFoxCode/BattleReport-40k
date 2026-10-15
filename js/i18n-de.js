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
  'Add unit': 'Einheit hinzufügen', 'Add units': 'Einheiten hinzufügen', 'Add army list': 'Armeeliste hinzufügen',
  'No units yet. Add them manually or import the export from the GW app / New Recruit.': 'Noch keine Einheiten. Füge sie von Hand hinzu oder importiere den Export aus der GW-App / New Recruit.',
  'Optional: the army list is only used for keyword matching': 'Optional: Die Armeeliste wird nur für den Keyword-Abgleich genutzt',
  'The game works the same without it – points and objective markers are tracked on the tablet.': 'Das Spiel funktioniert auch ohne sie – Punkte und Objective markers werden auf dem Tablet geführt.',
  'Deployment map missing': 'Aufstellungskarte fehlt', 'Attacker / Defender': 'Attacker / Defender', 'Twist': 'Twist',
  'The Attacker deploys in the upper zone (top of the map = Attacker\'s edge).': 'Der Attacker stellt in der oberen Zone auf (oben auf der Karte = Kante des Attackers).',
  'The Attacker uses the Attacker deployment zone of the deployment map, the Defender the opposite one.': 'Der Attacker nutzt die Attacker-Deployment zone der Karte, der Defender die gegenüberliegende.',
  'Each player chooses a Disposition. The Primary Mission results from your own and your opponent\'s Disposition.': 'Jeder Spieler wählt eine Disposition. Die Primary Mission ergibt sich aus deiner und der gegnerischen Disposition.',
  'The Primary Mission appears once both Dispositions are chosen.': 'Die Primary Mission erscheint, sobald beide Dispositions gewählt sind.',
  'Dispositions → Primary mission': 'Dispositions → Primary mission', 'Tactical': 'Taktisch', 'Fixed': 'Fest', 'Tactical (deck will be shuffled)': 'Taktisch (Deck wird gemischt)',
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
  'tap to mark as used': 'tippen, um als genutzt zu markieren', 'used – tap to undo': 'genutzt – tippen zum Rückgängigmachen',
  'In which phase of this turn did you use it?': 'In welcher Phase dieses Zuges hast du es genutzt?', 'Booked automatically:': 'Automatisch gebucht:', 'Changed automatically:': 'Automatisch geändert:',
  'Adjusted to the rules': 'An die Regeln angepasst', 'marked as used': 'als genutzt markiert',
  // ── army builder
  'New army': 'Neue Armee', 'Find a unit by name or keyword …': 'Einheit nach Name oder Keyword suchen …', 'Rule not in the data.': 'Regel nicht in den Daten.', 'Datasheet view': 'Datenblatt-Ansicht', 'all units as datasheets, to play': 'alle Einheiten als Datenblätter, zum Spielen', 'read only – switch off to edit': 'nur lesen – zum Bearbeiten ausschalten', 'All datasheets of this army to play – nothing to edit here.': 'Alle Datenblätter dieser Armee zum Spielen – hier wird nichts bearbeitet.', 'Print / PDF': 'Drucken / PDF', '– shown with that unit.': '– bei dieser Einheit gezeigt.', 'no datasheet in the data.': 'kein Datenblatt in den Daten.', 'tap the box to open it': 'zum Öffnen auf den Kasten tippen', 'The Oath (one Deed and one Quality) is chosen or rolled at the start of the battle – in the game under “Active effects”.': 'Der Eid (eine Tat und eine Eigenschaft) wird zu Beginn der Schlacht gewählt oder ausgewürfelt – im Spiel unter „Aktive Effekte“.', 'Show units': 'Einheiten anzeigen', 'Switches from the data: which further units can be selected (e.g. Legends, allies).': 'Schalter aus den Daten: welche weiteren Einheiten wählbar sind (z. B. Legends, Verbündete).', 'Learn to play': 'Spielen lernen', 'Step by step, phase by phase': 'Schritt für Schritt, Phase für Phase', 'Show the guide during games': 'Guide während des Spiels anzeigen', '⇩ Import from New Recruit': '⇩ Aus New Recruit importieren', 'text export or roster file (.ros / .rosz)': 'Text-Export oder Roster-Datei (.ros / .rosz)', 'Import army': 'Armee importieren', 'Import done': 'Import fertig', 'Please check these by hand:': 'Bitte von Hand prüfen:', 'Everything was matched.': 'Alles wurde zugeordnet.', 'or paste the text export': 'oder Text-Export einfügen', 'Paste the New Recruit text export here': 'New-Recruit-Text-Export hier einfügen', 'Choose a file or paste the export': 'Datei wählen oder Export einfügen', 'Importing …': 'Importiere …', 'Problems': 'Probleme', 'No problems': 'Keine Probleme',
  'No army lists yet.': 'Noch keine Armeelisten.', 'Battle size': 'Battle size', 'Custom points limit': 'Eigenes Punktelimit', 
  'Choose a faction': 'Fraktion wählen', 'Army configuration': 'Armee-Konfiguration', '+ Add unit': '+ Einheit hinzufügen', 'Copy as text': 'Als Text kopieren',
  'Search units': 'Einheiten suchen', 'Model types': 'Modelltypen', 'Compare': 'Vergleichen', 'Compare detachments': 'Detachments vergleichen', 'Each equipped with': 'Jeweils ausgerüstet mit',
  'Equipped with': 'Ausgerüstet mit', 'Tap to equip': 'Tippen zum Ausrüsten', 'Tap to take': 'Tippen zum Nehmen', 'Tap to select': 'Tippen zum Auswählen',
  'Tap to add': 'Tippen zum Hinzufügen', 'Tap to swap in': 'Tippen zum Eintauschen', 'limit reached': 'Limit erreicht',
  'led by': 'angeführt von', 'Rename army': 'Armee umbenennen', 'Delete army?': 'Armee löschen?',
  'more possible': 'weitere möglich', 'unit full – swap models': 'Einheit voll – Modelle tauschen', 'swaps one': 'tauscht ein',
  'Show problems': 'Probleme anzeigen', 
  'Every model has': 'Jedes Modell hat', 'Only the weapons every model has.': 'Nur die Waffen, die jedes Modell hat.',
  'Its weapons are chosen in its card below.': 'Seine Waffen werden in seiner Karte darunter gewählt.', 'Equip one of these': 'Eines dieser',
  'A custom game uses the rules of the nearest standard size (up to 1000 pts Incursion, above that Strike Force); the Detachment Points can be set by hand.': 'Ein eigenes Spiel nutzt die Regeln der nächsten Standardgröße (bis 1000 Pkt. Incursion, darüber Strike Force); die Detachment Points lassen sich von Hand setzen.',
  'Set by hand': 'Von Hand gesetzt', 'Led by': 'Angeführt von', 'what a leader adds is shown in its colour.': 'was ein Leader beisteuert, ist in seiner Farbe markiert.',
  'Back to My armies': 'Zurück zu Meine Armeen', 'Army not found': 'Armee nicht gefunden', 'Loading datasheet …': 'Datasheet wird geladen …', 'Loading': 'Lädt',
  // ── generic
  
  'Game terms in English': 'Spielbegriffe auf Englisch',
  'German: the interface is in German; rules texts stay in their English original as long as no official German version is available in the data. “Game terms in English” keeps terms like Stratagem, CP, Command phase or Leader in English.': 'Deutsch: Die Oberfläche ist deutsch; Regeltexte bleiben im englischen Original, solange keine offizielle deutsche Fassung in den Daten vorliegt. „Spielbegriffe auf Englisch“ lässt Spielbegriffe (Phasen, Punkte, Strategem-, Anführer- und Missionsbegriffe) englisch.'
};

/* short interface words – only translated when they are the whole text of a button / label */
export const EXACT = { 'File': 'Datei',
  'Yes': 'Ja', 'No': 'Nein', 'All': 'Alle', 'Delete': 'Löschen', 'Done': 'Fertig', 'Close': 'Schließen',
  'Save': 'Speichern', 'Join': 'Beitreten', 'Import': 'Importieren', 'Back': 'Zurück', 'Score': 'Spielstand',
  'Note': 'Notiz', 'More': 'Mehr', 'Less': 'Weniger', 'Fewer': 'Weniger', 'Status': 'Status', 'Limit': 'Limit', 'Step': 'Schritt',
  'Description': 'Beschreibung', 'Problem': 'Problem', 'Point': 'Punkt', 'End': 'Ende', 'Army': 'Armee',
  'Lead': 'Anführen', 'Navigation': 'Navigation', 'Live': 'Live', 'Book': 'Buch', 'Window': 'Fenster', 'Overview': 'Übersicht', 'View': 'Ansicht'
};

/* numbers with units and other short composites (whole text node; applied before PHRASES) */
export const PATTERNS = [
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
  ['^(\\d+) added', (m, n) => n + ' hinzugefügt'], ['^Add units · (\\d+) added', (m, n) => 'Einheiten hinzufügen · ' + n + ' hinzugefügt'],
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
PATTERNS.push(['^\\+ Add (.+?)\\s*$', (m, n) => '+ ' + n + ' hinzufügen'], ['^replaces one (.+)$', (m, n) => 'ersetzt: ' + n]);
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
