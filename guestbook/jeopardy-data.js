// Eingebaute Kategorien für Jeopardy. Pro Kategorie 5 Fragen (100–500 Punkte):
// [Hinweis, Lösung in Frageform, Tipp für den Tipp-Joker, Bild]
// Bild: 'flag:xx' = Flagge aus sites/jeopardy/flags/xx.svg (wird verschwommen angezeigt).
// Eigene Kategorien legt man im Editor auf jeopardy.unoslapis.ch an.
'use strict';

const FLAG = 'Welches Land hat diese Flagge?';

const CATEGORIES = [
  { id: 'flag-europa', name: 'Flaggen Europa', group: 'flags', qs: [
    [FLAG, 'Was ist Italien?', 'Pizza, Pasta, Kolosseum.', 'flag:it'],
    [FLAG, 'Was ist Deutschland?', 'Nördlicher Nachbar der Schweiz.', 'flag:de'],
    [FLAG, 'Was ist Schweden?', 'Hier kommt IKEA her.', 'flag:se'],
    [FLAG, 'Was ist Griechenland?', 'Hier fanden die ersten Olympischen Spiele statt.', 'flag:gr'],
    [FLAG, 'Was ist Malta?', 'Kleiner Inselstaat südlich von Sizilien.', 'flag:mt']
  ] },
  { id: 'flag-welt', name: 'Flaggen der Welt', group: 'flags', qs: [
    [FLAG, 'Was ist Japan?', 'Land der aufgehenden Sonne.', 'flag:jp'],
    [FLAG, 'Was ist Brasilien?', 'Fünfmal Fussball-Weltmeister.', 'flag:br'],
    [FLAG, 'Was ist Kanada?', 'Ahornsirup und Elche.', 'flag:ca'],
    [FLAG, 'Was ist Südkorea?', 'Heimat von K-Pop und Samsung.', 'flag:kr'],
    [FLAG, 'Was ist Argentinien?', 'Heimat von Lionel Messi.', 'flag:ar']
  ] },
  { id: 'flag-exotisch', name: 'Exotische Flaggen', group: 'flags', qs: [
    [FLAG, 'Was ist Jamaika?', 'Usain Bolt und Reggae.', 'flag:jm'],
    [FLAG, 'Was ist Südafrika?', 'Kapstadt liegt hier.', 'flag:za'],
    [FLAG, 'Was ist Kasachstan?', 'Grösster Binnenstaat der Welt.', 'flag:kz'],
    [FLAG, 'Was ist Bhutan?', 'Auf der Flagge ist ein Drache. Liegt im Himalaya.', 'flag:bt'],
    [FLAG, 'Was sind die Seychellen?', 'Inselstaat im Indischen Ozean.', 'flag:sc']
  ] },
  { id: 'flag-insel', name: 'Inseln & Zwergstaaten', group: 'flags', qs: [
    [FLAG, 'Was ist Island?', 'Vulkane, Geysire und Gletscher.', 'flag:is'],
    [FLAG, 'Was ist Monaco?', 'Formel-1-Rennen durch die Stadt.', 'flag:mc'],
    [FLAG, 'Was ist Liechtenstein?', 'Unser kleiner Nachbar mit Vaduz.', 'flag:li'],
    [FLAG, 'Was ist Neuseeland?', 'Hier wurde Herr der Ringe gedreht.', 'flag:nz'],
    [FLAG, 'Was ist Zypern?', 'Die Insel ist auf der Flagge abgebildet.', 'flag:cy']
  ] },
  { id: 'gaming', name: 'Gaming-Klassiker', group: 'gaming', qs: [
    ['Dieser Klempner mit roter Mütze ist Nintendos Maskottchen.', 'Wer ist Mario?', 'Sein Bruder heisst Luigi.'],
    ['Dieses Puzzlespiel mit fallenden Blöcken entstand 1984 in der Sowjetunion.', 'Was ist Tetris?', 'Vier Quadrate pro Stein.'],
    ['Diese Firma steckt hinter League of Legends und Valorant.', 'Was ist Riot Games?', 'Englisch für Aufstand.'],
    ['In diesem Jahr kam die erste PlayStation in Japan auf den Markt.', 'Was ist 1994?', 'Mitte der 90er.'],
    ['So heisst der ewige Bösewicht aus The Legend of Zelda.', 'Wer ist Ganon (Ganondorf)?', 'König der Gerudo.']
  ] },
  { id: 'nintendo', name: 'Nintendo', group: 'gaming', qs: [
    ['Marios grüner Bruder.', 'Wer ist Luigi?', 'Hat ein eigenes Geisterhaus-Spiel.'],
    ['Dieses rosa Knäuel saugt Gegner ein und kopiert ihre Fähigkeiten.', 'Wer ist Kirby?', 'Fängt mit K an.'],
    ['Diese Prinzessin wird von Mario immer wieder gerettet.', 'Wer ist Peach?', 'Eine Frucht.'],
    ['Diese Konsole von 2006 wurde dank Bewegungssteuerung zum Familien-Hit.', 'Was ist die Wii?', 'Klingt wie „wir“ auf Englisch.'],
    ['In diesem Königreich spielen fast alle Zelda-Spiele.', 'Was ist Hyrule?', 'Fängt mit H an.']
  ] },
  { id: 'shooter', name: 'Shooter & Battle Royale', group: 'gaming', qs: [
    ['In diesem Battle Royale von Epic Games baut man in Sekunden ganze Festungen.', 'Was ist Fortnite?', 'Klingt wie „vierzehn Tage“ auf Englisch.'],
    ['Diese Reihe von Activision hat Ableger wie Modern Warfare und Black Ops.', 'Was ist Call of Duty?', 'Abgekürzt CoD.'],
    ['In Counter-Strike legt das Terroristen-Team das hier.', 'Was ist die Bombe?', 'Die Counter-Terroristen müssen sie entschärfen.'],
    ['Die berühmteste Counter-Strike-Map mit Long A und Mid-Doors.', 'Was ist Dust 2?', 'Staub, Teil zwei.'],
    ['In dieser Shooter-Reihe von Bungie (ab 2001) kämpft der Master Chief.', 'Was ist Halo?', 'Englisch für Heiligenschein.']
  ] },
  { id: 'figuren', name: 'Videospiel-Figuren', group: 'gaming', qs: [
    ['Dieser blaue Igel ist schneller als alle anderen.', 'Wer ist Sonic?', 'Von Sega.'],
    ['Dieses gelbe Elektro-Pokémon begleitet Ash.', 'Wer ist Pikachu?', 'Pika pika!'],
    ['Diese Archäologin plündert seit 1996 Gräber.', 'Wer ist Lara Croft?', 'Tomb Raider.'],
    ['Der spartanische Krieger aus God of War.', 'Wer ist Kratos?', 'Hat einen Sohn namens Atreus.'],
    ['Der stumme Physiker mit Brecheisen aus Half-Life.', 'Wer ist Gordon Freeman?', 'Freier Mann.']
  ] },
  { id: 'rekorde', name: 'Gaming-Rekorde', group: 'gaming', qs: [
    ['Das meistverkaufte Videospiel aller Zeiten, mit über 300 Millionen Exemplaren.', 'Was ist Minecraft?', 'Blöcke und Creeper.'],
    ['In diesem Jahr erschien Pong von Atari.', 'Was ist 1972?', 'Anfang der 70er.'],
    ['Diese Firma betreibt die PC-Spieleplattform Steam.', 'Was ist Valve?', 'Englisch für Ventil.'],
    ['Dieses Rockstar-Spiel von 2013 spielte in drei Tagen über eine Milliarde Dollar ein.', 'Was ist GTA V (Grand Theft Auto V)?', 'Spielt in Los Santos.'],
    ['So viele Pokémon gab es in der ersten Generation (Rot und Blau).', 'Was ist 151?', 'Etwas über 150.']
  ] },
  { id: 'slang', name: 'Internet-Slang', group: 'mix', qs: [
    ['Mit diesen zwei Buchstaben bedankt man sich nach einem Spiel.', 'Was ist GG (good game)?', 'Good …'],
    ['Dieser Ratschlag kommt, wenn man zu viel online ist.', 'Was ist „Touch Grass“?', 'Geh mal raus und fass … an.'],
    ['Dieses Wort für Charme und Flirt-Talent wurde 2023 Oxford-Wort des Jahres.', 'Was ist Rizz?', 'Kommt von „Charisma“.'],
    ['Eigentlich eine Spielfigur, die niemand steuert – heute ein Wort für Mitläufer.', 'Was ist ein NPC?', 'Drei Buchstaben, Non-Player …'],
    ['Dieses Wort für „verdächtig“ wurde durch Among Us berühmt.', 'Was ist sus?', 'Kurz für „suspicious“.']
  ] },
  { id: 'serien', name: 'Anime & Serien', group: 'mix', qs: [
    ['In dieser Serie betreibt Charlie Morningstar ein Hotel, um Sünder zu bessern.', 'Was ist Hazbin Hotel?', 'Spielt in der Hölle.'],
    ['Diese Netflix-Serie spielt in Hawkins, Indiana.', 'Was ist Stranger Things?', 'Upside Down.'],
    ['In diesem Anime will Ruffy König der Piraten werden.', 'Was ist One Piece?', 'Ein Schatz.'],
    ['In diesem Anime verschmilzt Denji mit seinem Hund Pochita.', 'Was ist Chainsaw Man?', 'Ein Werkzeug für Holz.'],
    ['In dieser Serie wird der Chemielehrer Walter White zum Drogenboss.', 'Was ist Breaking Bad?', 'Heisenberg.']
  ] },
  { id: 'schweiz', name: 'Schweiz', group: 'mix', qs: [
    ['So viele Landessprachen hat die Schweiz.', 'Was ist vier?', 'Deutsch, Französisch, Italienisch und …'],
    ['Diese Stadt ist die Bundesstadt der Schweiz.', 'Was ist Bern?', 'Hat Bären im Wappen.'],
    ['Dieser Berg bei Zermatt war lange auf der Toblerone-Packung abgebildet.', 'Was ist das Matterhorn?', 'Steht über Zermatt.'],
    ['In diesem Jahr soll der Rütlischwur stattgefunden haben.', 'Was ist 1291?', 'Ende des 13. Jahrhunderts.'],
    ['Diese Organisation wurde 1863 in Genf unter anderem von Henry Dunant gegründet.', 'Was ist das Rote Kreuz (IKRK)?', 'Ihr Zeichen ist die umgekehrte Schweizer Fahne.']
  ] }
];

const FINALS = [
  { cat: 'Flaggen', clue: 'Das einzige Land der Welt, dessen Nationalflagge nicht rechteckig ist.', answer: 'Was ist Nepal?' },
  { cat: 'Flaggen', clue: 'Nur diese zwei Staaten haben eine quadratische Flagge.', answer: 'Was sind die Schweiz und die Vatikanstadt?' },
  { cat: 'Gaming-Geschichte', clue: 'Unter diesem Namen hatte Mario 1981 in Donkey Kong seinen ersten Auftritt.', answer: 'Was ist Jumpman?' },
  { cat: 'Arcade', clue: 'Dieses Spiel von 1980 sollte in Japan ursprünglich „Puck Man“ heissen.', answer: 'Was ist Pac-Man?' },
  { cat: 'Konsolen', clue: 'Diese Nintendo-Konsole ist mit über 150 Millionen Stück die meistverkaufte Handheld-Konsole von Nintendo.', answer: 'Was ist der Nintendo DS?' }
];

const PRESETS = [
  { name: 'Flaggen & Gaming', cats: ['flag-europa', 'flag-welt', 'flag-exotisch', 'gaming', 'nintendo', 'figuren'] },
  { name: 'Nur Flaggen', cats: ['flag-europa', 'flag-welt', 'flag-exotisch', 'flag-insel'] },
  { name: 'Nur Gaming', cats: ['gaming', 'nintendo', 'shooter', 'figuren', 'rekorde'] }
];

const GROUPS = { flags: 'Flaggen', gaming: 'Gaming', mix: 'Sonstiges' };

module.exports = { CATEGORIES, FINALS, PRESETS, GROUPS };
