// Kartenkatalog "Crazy Cupcakes – Hoing Boings". Die Seltenheit muss zu guestbook/casino.js passen.
// t = Typ, hp = KP, a = Attacken [Name, Schaden, Text], f = Flavor-Text
window.CC_CARDS = [
  // ---------- Häufig (C) ----------
  { id: 'katze', n: 'Miau-H', r: 'C', t: 'colorless', hp: 50, a: [['Kratzen', 10, ''], ['Schnurren', 0, 'Heilt 20 KP. Danach schläft Big H sofort ein.']], f: 'Trägt Katzenohren seit dem Tag der Katzenrettung. Mausi ist nicht beeindruckt.' },
  { id: 'alien', n: 'Grünling-H', r: 'C', t: 'psychic', hp: 60, a: [['Entführung', 20, 'Der Gegner meldet sich danach nie wieder. Wie Big Hs Dates.']], f: 'Kommt aus einer fernen Galaxie, in der Gras verboten ist.' },
  { id: 'teufel', n: 'Teufels-H', r: 'C', t: 'fire', hp: 60, a: [['Kleine Sünde', 20, 'Münzwurf: Kopf doppelter Schaden, Zahl nichts.']], f: 'Die Hörner sind echt. Sagt er.' },
  { id: 'kitty', n: 'Hallo-H', r: 'C', t: 'colorless', hp: 50, a: [['Schleifchen-Schlag', 10, ''], ['Niedlich schauen', 0, 'Der Gegner setzt vielleicht eine Runde aus. Zu süss.']], f: 'Die Schleife hat er im Merch-Shop gekauft. Lieferung: nie.' },
  { id: 'caesar', n: 'Cäsar-H', r: 'C', t: 'fighting', hp: 70, a: [['Veni, Vidi, Goon', 30, '']], f: 'Kam, sah und ging baden.' },
  { id: 'clown', n: 'Clown-H', r: 'C', t: 'psychic', hp: 50, a: [['Rote Nase', 10, 'Der Gegner lacht und setzt vielleicht eine Runde aus.']], f: 'Nimmt das Leben nicht ernst. Das Ranked schon.' },
  { id: 'traene', n: 'Heul-H', r: 'C', t: 'water', hp: 60, a: [['Tränenflut', 20, 'Nur nach einem Ranked-Loss einsetzbar. Also immer.']], f: 'Weint nicht. Es regnet nur in seinem Zimmer.' },
  { id: 'peaky', n: 'Peaky-H', r: 'C', t: 'dark', hp: 70, a: [['Mützen-Hieb', 30, '']], f: 'Auf Befehl des Goon-Königs.' },
  { id: 'sonnenbrille', n: 'Cool-H', r: 'C', t: 'colorless', hp: 60, a: [['Zu cool für draussen', 20, 'Diese Karte kann nicht von Sonnenlicht getroffen werden.']], f: 'Trägt die Brille auch nachts. Vor allem nachts.' },
  { id: 'nerd', n: 'Nerd-H', r: 'C', t: 'psychic', hp: 50, a: [['Eigentlich …', 20, '40 Minuten Hazbin-Hotel-Lore: Der Gegner setzt vielleicht eine Runde aus.']], f: 'Hat eine Meinung zu jedem Anime. Und zu deinem.' },
  { id: 'laser', n: 'Laser-H', r: 'C', t: 'electric', hp: 60, a: [['Laserblick', 30, '']], f: 'Starrt so lange auf den Bildschirm, bis Laser kommen.' },
  { id: 'glatze', n: 'Glatzen-H', r: 'C', t: 'metal', hp: 70, a: [['Blendung', 20, 'Reflektiert Sonnenlicht. Endlich ist es zu etwas nütze.']], f: 'Frisur: aerodynamisch.' },
  { id: 'matrose', n: 'Matrosen-H', r: 'C', t: 'water', hp: 60, a: [['Ahoi', 20, '']], f: 'War einmal auf einem Tretboot. Erzählt es heute noch.' },
  { id: 'rapper', n: 'Drip-H', r: 'C', t: 'dark', hp: 60, a: [['Goldkette', 30, 'Aus dem Kaugummiautomaten. Glänzt trotzdem.']], f: 'Flow wie ein verstopfter Abfluss.' },
  { id: 'propeller', n: 'Propeller-H', r: 'C', t: 'electric', hp: 50, a: [['Abheben', 20, 'Fliegt 3 cm hoch. Persönlicher Rekord.']], f: 'Hat den Lolli seit 2019. Nie gegessen.' },
  { id: 'toad', n: 'Pilz-H', r: 'C', t: 'grass', hp: 60, a: [['Anderes Schloss', 20, 'Die Prinzessin ist leider in einem anderen Schloss.']], f: 'Das einzige Grünzeug in seinem Leben.' },
  // ---------- Ungewöhnlich (U) ----------
  { id: 'zauberer', n: 'Magier-H', r: 'U', t: 'psychic', hp: 80, a: [['Arkaner Rizz', 40, ''], ['Teleport', 0, 'Zurück ins Bett: heilt 30 KP.']], f: 'Kann jeden Zauber. Ausser den, der eine Freundin herbeiruft.' },
  { id: 'steve', n: 'Block-H', r: 'U', t: 'fighting', hp: 90, a: [['Grasblock abbauen', 40, 'Das einzige Gras, das er je angefasst hat.']], f: 'Kopf: kubisch. Pläne: auch.' },
  { id: 'soldier', n: 'Soldat-H', r: 'U', t: 'fighting', hp: 90, a: [['Helix-Raketen', 50, '']], f: 'Ruft „Ich bin der Held, den ihr braucht“ und stirbt zuerst.' },
  { id: 'joker', n: 'Joker-H', r: 'U', t: 'dark', hp: 80, a: [['Warum so ernst?', 40, 'Der Gegner kann nächste Runde keine Ausreden benutzen.']], f: 'Lacht über seine eigenen Witze. Als Einziger.' },
  { id: 'batman', n: 'Fledermaus-H', r: 'U', t: 'dark', hp: 90, a: [['Ich bin die Nacht', 50, 'Doppelter Schaden zwischen 00:00 und 04:00 Uhr.']], f: 'Nachtaktiv seit 2019. Kein Butler, nur Mausi.' },
  { id: 'jason', n: 'Hockey-H', r: 'U', t: 'dark', hp: 90, a: [['Freitag, der 13.', 50, '']], f: 'Hat noch nie Hockey gespielt. Die Maske ist wegen der Pickel.' },
  { id: '2b', n: 'Androiden-H', r: 'U', t: 'metal', hp: 80, a: [['Augenbinde', 40, 'Sieht trotzdem alles. Vor allem deine Fehler.']], f: 'Ruhm der Menschheit. Sagt er.' },
  { id: 'engel', n: 'Engel-H', r: 'U', t: 'colorless', hp: 80, a: [['Heiligenschein', 30, 'Heilt diese Karte um 20 KP.']], f: 'Unschuldig. Angeblich.' },
  { id: 'naruto', n: 'Ninja-H', r: 'U', t: 'fighting', hp: 80, a: [['Schattendoppelgänger', 60, '']], f: 'Genin seit 8 Jahren. Glaubt immer noch an den Hokage-Titel.' },
  { id: 'papst', n: 'Heiliger H', r: 'U', t: 'psychic', hp: 90, a: [['Segen', 30, 'Heilt dein ganzes Team um 20 KP. Nur nicht seinen Rank.']], f: 'Predigt Enthaltsamkeit. Siehe NoFap-Tracker.' },
  { id: 'pirat', n: 'Piraten-H', r: 'U', t: 'water', hp: 90, a: [['Enterhaken', 50, '']], f: 'Sucht das One Piece. Findet nur Chips unter dem Sofa.' },
  { id: 'mike', n: 'Einaug-H', r: 'U', t: 'grass', hp: 70, a: [['Ein Auge zudrücken', 30, 'Ignoriert eine Schwäche. Ausser Gras.']], f: 'Arbeitet in der Schreckensabteilung. Erschreckt nur sich selbst.' },
  // ---------- Selten (R, Holo) ----------
  { id: 'mario', n: 'Klempner-H', r: 'R', t: 'fire', hp: 120, a: [['Pilz-Power', 0, 'Diese Karte bekommt 30 KP dazu (einmal pro Duell).'], ['Stampfer', 70, '']], f: 'Repariert keine Rohre. Nur Ausreden.' },
  { id: 'jawa', n: 'Wüsten-H', r: 'R', t: 'dark', hp: 110, a: [['Utini!', 70, 'Verkauft dem Gegner einen kaputten Droiden.']], f: 'Man sieht nur die Augen. Ist besser so.' },
  { id: 'blauer-kobold', n: 'Wut-Kobold', r: 'R', t: 'water', hp: 110, a: [['Wutausbruch', 80, 'Nur nach 14 Ranked-Losses in Folge. Also jetzt.']], f: 'Entsteht, wenn der Support nicht heilt.' },
  { id: 'mercy', n: 'Heiler-H', r: 'R', t: 'colorless', hp: 120, a: [['Heldenhafte Rückkehr', 0, 'Heilt dein ganzes Team um 40 KP.'], ['Pistole', 40, 'Heilt trotzdem nie Big H.']], f: 'Helden sterben nie. Big H schon, ständig.' },
  { id: 'omen', n: 'Schatten-H', r: 'R', t: 'psychic', hp: 120, a: [['Paranoia', 70, 'Blendet alle. Auch das eigene Team.']], f: 'OMEN ♥. Mehr weiss man nicht.' },
  { id: 'ghostface', n: 'Schrei-H', r: 'R', t: 'dark', hp: 110, a: [['Anruf', 60, '„Was ist dein Lieblings-Horrorfilm?“ – „Mein Rank.“']], f: 'Ruft nie zurück. Wie Big H.' },
  { id: 'fortnite', n: 'Default-H', r: 'R', t: 'colorless', hp: 100, a: [['Default Dance', 50, ''], ['90er bauen', 0, 'Baut in 0,3 s ein Haus: +40 KP (einmal). Wohnt trotzdem bei Mama.']], f: 'Keine Skins. Nur Skill. Sagt er.' },
  // ---------- Ultra selten (UR) ----------
  { id: 'vader', n: 'Darth H', r: 'UR', t: 'dark', hp: 200, a: [['Machtwürgen', 120, ''], ['Ich bin dein Vater', 0, '„Nein. Ich muss baden gehen.“ Der Gegner setzt vielleicht eine Runde aus.']], f: 'Atmet laut ins Headset. Seit 2019.' },
  { id: 'barbarenkoenig', n: 'Barbarenkönig H', r: 'UR', t: 'fighting', hp: 180, a: [['Königliche Klinge', 130, '']], f: 'Das Schwert ist grösser als sein Selbstvertrauen. Knapp.' },
  { id: 'gigachad', n: 'Gigachad-H', r: 'UR', t: 'fighting', hp: 220, a: [['Sigma-Grindset', 150, 'Kann nicht besiegt werden, solange er nicht redet.']], f: 'Arme aus Beton, Ausreden aus Gold.' },
  { id: 'dschinni', n: 'Dschinni-H', r: 'UR', t: 'psychic', hp: 190, a: [['Drei Wünsche', 100, 'Münzwurf: Kopf doppelter Schaden, Zahl nichts. Wunsch 3: nochmal Wunsch 1.']], f: 'Lebt in einer Lampe. Grösser als sein Zimmer.' },
  // ---------- Geheim (SR) ----------
  { id: 'bigh', n: 'Alastor Lapis', r: 'SR', t: 'colorless', hp: 250, a: [['Goon-König', 160, 'Gewinnt fast jedes Duell. Danach muss er baden gehen.']], f: 'Das Original im weissen Pelz. Es gibt nur einen.', img: '/shared/img/bigh.jpg' }
];
window.CC_TYPES = {
  fire: ['Feuer', 'flame', '#ea580c', '#fed7aa'], water: ['Wasser', 'droplet', '#0284c7', '#bae6fd'], grass: ['Pflanze', 'sprout', '#16a34a', '#bbf7d0'],
  electric: ['Elektro', 'zap', '#ca8a04', '#fef08a'], psychic: ['Psycho', 'brain', '#9333ea', '#e9d5ff'], fighting: ['Kampf', 'swords', '#b45309', '#fcd9b6'],
  dark: ['Finsternis', 'moon', '#334155', '#cbd5e1'], metal: ['Metall', 'shield', '#64748b', '#e2e8f0'], colorless: ['Farblos', 'star', '#78716c', '#f5f5f4']
};
window.CC_RARITY = { C: ['Häufig', '●'], U: ['Ungewöhnlich', '◆'], R: ['Selten', '★'], UR: ['Ultra selten', '★★'], SR: ['Geheim', '✦'] };
