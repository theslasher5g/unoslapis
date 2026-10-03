// Fragenkatalog für Big H Jeopardy. Pro Kategorie 5 Hinweise (100–500 Punkte):
// [Hinweis, Lösung in Frageform, Tipp für den Tipp-Joker]
// Die Big-H-Kategorien stützen sich auf die (frei erfundene) Bigipedia auf wiki.unoslapis.ch.
'use strict';

const CATEGORIES = [
  { id: 'lapisien', name: 'Fürstentum Lapisien', group: 'bigh', qs: [
    ['Dieses Land rief Alastor Lapis 2011 in seinem Kinderzimmer aus.', 'Was ist das Fürstentum Lapisien?', 'Klingt wie sein Nachname.'],
    ['Unter diesem Namen regierte Big H sein Fürstentum.', 'Wer ist Fürst Alastor I.?', 'Fürst … der Erste.'],
    ['Artikel 1 der lapisischen Verfassung: Der Fürst muss das nicht tun.', 'Was ist aufräumen?', 'Hat mit seinem Zimmer zu tun.'],
    ['Dieses Möbelstück wurde zur Hauptstadt Lapisiens ernannt – und steht heute unter Denkmalschutz.', 'Was ist der Schreibtisch?', 'Dort steht sein PC.'],
    ['An diesem Tag dankte Alastor I. ab und fasste zum letzten Mal Gras an.', 'Was ist der 12. Juni 2019?', 'Sommer 2019, sechster Monat.']
  ] },
  { id: 'baden', name: 'Ich muss baden gehen', group: 'bigh', qs: [
    ['Mit diesem Satz sagt Big H am liebsten Verabredungen ab.', 'Was ist „Ich muss baden gehen“?', 'Hat mit Wasser zu tun.'],
    ['So viele Verabredungen sagte er laut Bigipedia mindestens mit dieser Ausrede ab.', 'Was ist 312?', 'Zwischen 300 und 320.'],
    ['So viele Liter zeigte der Wasserzähler im selben Zeitraum an.', 'Was ist 0?', 'Weniger geht nicht.'],
    ['So nennt Big H den Wasserzähler, seit der die Baden-Affäre aufgedeckt hat.', 'Was ist ein Hater?', 'Internet-Wort für Neider.'],
    ['Unter diesem Hashtag wurde die Affäre im Netz bekannt.', 'Was ist #badengehen?', 'Zwei Wörter, zusammengeschrieben.']
  ] },
  { id: 'loewe', name: 'Der nackte Löwe', group: 'bigh', qs: [
    ['Diesen Berg will Big H 2023 nackt bestiegen haben.', 'Was ist der Mount Everest?', 'Höchster Berg der Welt.'],
    ['Die letzten 800 Höhenmeter legte er auf allen vieren zurück, brüllend wie dieses Tier.', 'Was ist ein Löwe?', 'König der Tiere.'],
    ['Davon ernährte er sich während des ganzen Aufstiegs.', 'Was ist Monster Energy?', 'Grüne Krallen auf der Dose.'],
    ['Diese zwei Wörter sagte er zum Sherpa, der ihn am Hillary Step überholte.', 'Was ist „Team Diff“?', 'Gaming-Ausrede nach einer Niederlage.'],
    ['Mit dieser Begründung gibt es keine Gipfelfotos.', 'Was ist „Der Akku war leer“ (wegen der Kälte)?', 'Handy + Kälte = …'],
  ] },
  { id: 'teamdiff', name: 'Team Diff', group: 'bigh', qs: [
    ['So heisst Big H auf Steam und in Valorant.', 'Was ist unoslapis?', 'Steht auch in der Adresse dieser Website.'],
    ['Über 4\'269 Stunden hat er in diesem Heldenshooter von Blizzard verbracht.', 'Was ist Overwatch?', 'Erschienen 2016, Nachfolger heisst „… 2“.'],
    ['Diesen Overwatch-Helden mit Cyber-Ninja-Schwert spielt er am liebsten.', 'Wer ist Genji?', 'Sein Bruder heisst Hanzo.'],
    ['Diese Agentin spielt er in Valorant – seine Spielweise nennt er „strategisches Lurken“.', 'Wer ist Jett?', 'Koreanische Duelistin mit Wind-Fähigkeiten.'],
    ['So oft hat er laut eigener Angabe „Team Diff“ gesagt – eine berühmte Meme-Zahl aus Dragon Ball.', 'Was ist 9\'001?', '„It\'s over …“'],
  ] },
  { id: 'mausi', name: 'Mausi & Co.', group: 'bigh', qs: [
    ['Diese Katze rettete Big H 2025 aus einem brennenden Haus.', 'Wer ist Mausi?', 'Klingt nach einem Kosenamen.'],
    ['Dieser Einsatzleiter der Feuerwehr kam sieben Minuten zu spät zur Katzenrettung.', 'Wer ist Beat Brandschutz?', 'Nachname wie sein Job.'],
    ['Dieses Gerät stürzte ab, als es Big Hs Chancen auf eine Freundin berechnete.', 'Was ist der Supercomputer?', 'Ein sehr, sehr grosser Rechner.'],
    ['So viel Prozent betrug das Ergebnis vor dem Absturz.', 'Was ist 0,2 %?', 'Weniger als ein halbes Prozent.'],
    ['Diese Figur steht auf Big Hs Waifu-Tierliste seit Beginn der Aufzeichnungen auf Platz 1.', 'Wer ist Makima?', 'Aus Chainsaw Man.'],
  ] },
  { id: 'website', name: 'unoslapis.ch', group: 'bigh', qs: [
    ['So heisst die Netflix-Parodie auf unoslapis.ch.', 'Was ist Bigflix?', 'Big + …'],
    ['So heisst die Währung im Casino Lapis.', 'Was sind Lapis-Taler?', 'Eine alte Münze.'],
    ['Im Runner-Spiel auf game.unoslapis.ch flieht Big H vor diesem Ding.', 'Was ist Gras?', 'Touch …'],
    ['Die Google-Parodie, auf der man Big H Sterne geben kann.', 'Was ist Goongle?', 'Google mit einem Hauch Goon.'],
    ['In diesem Sammelkarten-Set stecken 40 Figuren, darunter Big H selbst.', 'Was sind die Crazy Cupcakes?', 'Verrücktes Gebäck.'],
  ] },
  { id: 'schweiz', name: 'Schweiz', group: 'mix', qs: [
    ['So viele Landessprachen hat die Schweiz.', 'Was ist vier?', 'Deutsch, Französisch, Italienisch und …'],
    ['Diese Stadt ist die Bundesstadt der Schweiz.', 'Was ist Bern?', 'Hat Bären im Wappen.'],
    ['Dieser Berg bei Zermatt war lange auf der Toblerone-Packung abgebildet.', 'Was ist das Matterhorn?', 'Steht über Zermatt.'],
    ['In diesem Jahr soll der Rütlischwur stattgefunden haben.', 'Was ist 1291?', 'Ende des 13. Jahrhunderts.'],
    ['Diese Organisation wurde 1863 in Genf unter anderem von Henry Dunant gegründet.', 'Was ist das Rote Kreuz (IKRK)?', 'Ihr Zeichen ist die umgekehrte Schweizer Fahne.'],
  ] },
  { id: 'gaming', name: 'Gaming-Klassiker', group: 'mix', qs: [
    ['Dieser Klempner mit roter Mütze ist Nintendos Maskottchen.', 'Wer ist Mario?', 'Sein Bruder heisst Luigi.'],
    ['In diesem Spiel baut man mit Blöcken und wird nachts von Creepern gesprengt.', 'Was ist Minecraft?', 'Mine + …'],
    ['Diese Firma steckt hinter League of Legends und Valorant.', 'Was ist Riot Games?', 'Englisch für Aufstand.'],
    ['In diesem Jahr kam die erste PlayStation in Japan auf den Markt.', 'Was ist 1994?', 'Mitte der 90er.'],
    ['So heisst der ewige Bösewicht aus The Legend of Zelda.', 'Wer ist Ganon (Ganondorf)?', 'König der Gerudo.'],
  ] },
  { id: 'slang', name: 'Internet-Slang', group: 'mix', qs: [
    ['Mit diesen zwei Buchstaben bedankt man sich nach einem Spiel.', 'Was ist GG (good game)?', 'Good …'],
    ['Dieser Ratschlag kommt, wenn man zu viel online ist.', 'Was ist „Touch Grass“?', 'Geh mal raus und fass … an.'],
    ['Dieses Wort für Charme und Flirt-Talent wurde 2023 Oxford-Wort des Jahres.', 'Was ist Rizz?', 'Kommt von „Charisma“.'],
    ['Eigentlich eine Spielfigur, die niemand steuert – heute ein Wort für Mitläufer.', 'Was ist ein NPC?', 'Drei Buchstaben, Non-Player …'],
    ['Dieses Wort für „verdächtig“ wurde durch Among Us berühmt.', 'Was ist sus?', 'Kurz für „suspicious“.'],
  ] },
  { id: 'serien', name: 'Anime & Serien', group: 'mix', qs: [
    ['In dieser Serie betreibt Charlie Morningstar ein Hotel, um Sünder zu bessern.', 'Was ist Hazbin Hotel?', 'Big Hs Lieblingsserie.'],
    ['So heisst der Radio-Dämon aus Hazbin Hotel – Big Hs Namensvetter.', 'Wer ist Alastor?', 'Schau dir Big Hs echten Vornamen an.'],
    ['Diese Netflix-Serie spielt in Hawkins, Indiana.', 'Was ist Stranger Things?', 'Upside Down.'],
    ['In diesem Anime verschmilzt Denji mit seinem Hund Pochita.', 'Was ist Chainsaw Man?', 'Ein Werkzeug für Holz.'],
    ['In dieser Serie wird der Chemielehrer Walter White zum Drogenboss.', 'Was ist Breaking Bad?', 'Heisenberg.'],
  ] },
  { id: 'essen', name: 'Znüni & Zvieri', group: 'mix', qs: [
    ['So heisst die Zwischenmahlzeit am Vormittag in der Schweiz.', 'Was ist das Znüni?', 'Um neun Uhr.'],
    ['Diesen Schweizer Käse erkennt man an seinen grossen Löchern.', 'Was ist Emmentaler?', 'Benannt nach einem Tal im Kanton Bern.'],
    ['Nach diesem Kartoffelgericht ist die Sprachgrenze zur Westschweiz benannt.', 'Was ist Rösti (Röstigraben)?', '…graben.'],
    ['Dieser österreichische Energy-Drink verleiht angeblich Flügel.', 'Was ist Red Bull?', 'Ein rotes Tier.'],
    ['Diese Schweizer Firma brachte 1938 den löslichen Kaffee Nescafé heraus.', 'Was ist Nestlé?', 'Sitz in Vevey.'],
  ] },
  { id: 'zahlen', name: 'Zahlen, bitte', group: 'mix', qs: [
    ['So viele Spieler hat ein Fussballteam auf dem Feld.', 'Was ist 11?', 'Mehr als zehn.'],
    ['So viele Bits hat ein Byte.', 'Was ist 8?', 'Zwei hoch drei.'],
    ['So viele Karten hat ein Pokerdeck ohne Joker.', 'Was ist 52?', 'Vier Farben à 13.'],
    ['So viele Felder hat ein Schachbrett.', 'Was ist 64?', 'Acht mal acht.'],
    ['So viele Knochen hat ein erwachsener Mensch ungefähr.', 'Was ist 206?', 'Etwas über 200.'],
  ] },
  { id: 'buero', name: 'Büro-Alltag', group: 'mix', qs: [
    ['Mit dieser Tastenkombination kopiert man unter Windows.', 'Was ist Ctrl + C (Strg + C)?', 'C wie Copy.'],
    ['Diese Microsoft-App nutzen viele Büros für Chat und Videocalls.', 'Was ist Microsoft Teams?', 'Englisch für Mannschaften.'],
    ['Dieses Kürzel in E-Mails bedeutet „so schnell wie möglich“.', 'Was ist ASAP?', 'As soon as …'],
    ['Mit dieser Tastenkombination schneidet man unter Windows einen Screenshot aus.', 'Was ist Windows + Shift + S?', 'Windows-Taste, Umschalt und ein Buchstabe.'],
    ['So heisst die Software, mit der fast jede Präsentation im Büro gemacht wird.', 'Was ist PowerPoint?', 'Power + …'],
  ] }
];

const FINALS = [
  { cat: 'Staatsfeiertage', clue: 'An diesem Tag ist im Fürstentum Lapisien Staatsfeiertag.', answer: 'Was ist der 4. Oktober (Big Hs Geburtstag)?' },
  { cat: 'Berühmte Worte', clue: 'Big Hs Wahlspruch, am häufigsten gesagt um 03:14 Uhr.', answer: 'Was ist „Nur noch ein Game“?' },
  { cat: 'Schweizer Sport', clue: 'Dieser Basler gewann 20 Grand-Slam-Titel im Einzel.', answer: 'Wer ist Roger Federer?' },
  { cat: 'Lieder', clue: 'Dieses Lied aus Hazbin Hotel hat Big H laut Statistik 2\'847 Mal gehört.', answer: 'Was ist „Insane“?' },
  { cat: 'Titel', clue: 'Diesen Titel verlieh sich Big H am Tag seiner Abdankung selbst.', answer: 'Was ist Goon-König?' }
];

const PRESETS = [
  { name: 'Big H Spezial', cats: ['lapisien', 'baden', 'loewe', 'teamdiff', 'mausi', 'website'] },
  { name: 'Gemischt', cats: ['lapisien', 'baden', 'teamdiff', 'slang', 'serien', 'schweiz'] },
  { name: 'Allgemeinwissen', cats: ['schweiz', 'gaming', 'slang', 'serien', 'essen', 'zahlen'] }
];

module.exports = { CATEGORIES, FINALS, PRESETS };
