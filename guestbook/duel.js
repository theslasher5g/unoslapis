// Karten-Duelle: 3 gegen 3 mit den eigenen Crazy-Cupcakes-Karten. Alles wird hier auf dem Server berechnet.
//
//   GET  /api/casino/duel                 -> offene Duelle, laufende Duelle, eigene Statistik
//   POST /api/casino/duel {team, stake, bot}   -> Duell eröffnen (bot: sofort gegen Big H)
//   GET  /api/casino/duel/:id?v=N         -> Zustand (wartet bis zu 25 s auf Änderungen)
//   POST /api/casino/duel/:id/join {team} -> beitreten
//   POST /api/casino/duel/:id/act {type: attack|switch|forfeit, index, to}
//   POST /api/casino/duel/:id/cancel      -> eigenes, noch offenes Duell zurückziehen
'use strict';

const crypto = require('crypto');

// Kampfwerte je Karte: [Typ, KP, [[Attacke, Schaden, Effekt], ...]]
// Effekte: heal:N (aktive Karte), healAll:N (ganzes Team), buff:N (+N max. KP), stun (Gegner setzt aus, 50 %),
//          coin (Kopf: doppelt, Zahl: nichts), night (doppelt zwischen 00 und 04 Uhr)
const STATS = {
  katze: ['colorless', 50, [['Kratzen', 10], ['Schnurren', 0, 'heal:20']]],
  alien: ['psychic', 60, [['Entführung', 20]]],
  teufel: ['fire', 60, [['Kleine Sünde', 20, 'coin']]],
  kitty: ['colorless', 50, [['Schleifchen-Schlag', 10], ['Niedlich schauen', 0, 'stun']]],
  caesar: ['fighting', 70, [['Veni, Vidi, Goon', 30]]],
  clown: ['psychic', 50, [['Rote Nase', 10, 'stun']]],
  traene: ['water', 60, [['Tränenflut', 20]]],
  peaky: ['dark', 70, [['Mützen-Hieb', 30]]],
  sonnenbrille: ['colorless', 60, [['Zu cool für draussen', 20]]],
  nerd: ['psychic', 50, [['Eigentlich …', 20, 'stun']]],
  laser: ['electric', 60, [['Laserblick', 30]]],
  glatze: ['metal', 70, [['Blendung', 20]]],
  matrose: ['water', 60, [['Ahoi', 20]]],
  rapper: ['dark', 60, [['Goldkette', 30]]],
  propeller: ['electric', 50, [['Abheben', 20]]],
  toad: ['grass', 60, [['Anderes Schloss', 20]]],
  zauberer: ['psychic', 80, [['Arkaner Rizz', 40], ['Teleport', 0, 'heal:30']]],
  steve: ['fighting', 90, [['Grasblock abbauen', 40]]],
  soldier: ['fighting', 90, [['Helix-Raketen', 50]]],
  joker: ['dark', 80, [['Warum so ernst?', 40]]],
  batman: ['dark', 90, [['Ich bin die Nacht', 50, 'night']]],
  jason: ['dark', 90, [['Freitag, der 13.', 50]]],
  '2b': ['metal', 80, [['Augenbinde', 40]]],
  engel: ['colorless', 80, [['Heiligenschein', 30, 'heal:20']]],
  naruto: ['fighting', 80, [['Schattendoppelgänger', 60]]],
  papst: ['psychic', 90, [['Segen', 30, 'healAll:20']]],
  pirat: ['water', 90, [['Enterhaken', 50]]],
  mike: ['grass', 70, [['Ein Auge zudrücken', 30]]],
  mario: ['fire', 120, [['Pilz-Power', 0, 'buff:30'], ['Stampfer', 70]]],
  jawa: ['dark', 110, [['Utini!', 70]]],
  'blauer-kobold': ['water', 110, [['Wutausbruch', 80]]],
  mercy: ['colorless', 120, [['Heldenhafte Rückkehr', 0, 'healAll:40'], ['Pistole', 40]]],
  omen: ['psychic', 120, [['Paranoia', 70]]],
  ghostface: ['dark', 110, [['Anruf', 60]]],
  fortnite: ['colorless', 100, [['Default Dance', 50], ['90er bauen', 0, 'buff:40']]],
  vader: ['dark', 200, [['Machtwürgen', 120], ['Ich bin dein Vater', 0, 'stun']]],
  barbarenkoenig: ['fighting', 180, [['Königliche Klinge', 130]]],
  gigachad: ['fighting', 220, [['Sigma-Grindset', 150]]],
  dschinni: ['psychic', 190, [['Drei Wünsche', 100, 'coin']]],
  bigh: ['colorless', 250, [['Goon-König', 160]]]
};
// Anzeigenamen für das Kampfprotokoll (wie in sites/casino/packs/cards.js)
const NAMES = {
  katze: 'Miau-H', alien: 'Grünling-H', teufel: 'Teufels-H', kitty: 'Hallo-H', caesar: 'Cäsar-H', clown: 'Clown-H', traene: 'Heul-H', peaky: 'Peaky-H',
  sonnenbrille: 'Cool-H', nerd: 'Nerd-H', laser: 'Laser-H', glatze: 'Glatzen-H', matrose: 'Matrosen-H', rapper: 'Drip-H', propeller: 'Propeller-H', toad: 'Pilz-H',
  zauberer: 'Magier-H', steve: 'Block-H', soldier: 'Soldat-H', joker: 'Joker-H', batman: 'Fledermaus-H', jason: 'Hockey-H', '2b': 'Androiden-H', engel: 'Engel-H',
  naruto: 'Ninja-H', papst: 'Heiliger H', pirat: 'Piraten-H', mike: 'Einaug-H', mario: 'Klempner-H', jawa: 'Wüsten-H', 'blauer-kobold': 'Wut-Kobold', mercy: 'Heiler-H',
  omen: 'Schatten-H', ghostface: 'Schrei-H', fortnite: 'Default-H', vader: 'Darth H', barbarenkoenig: 'Barbarenkönig H', gigachad: 'Gigachad-H', dschinni: 'Dschinni-H', bigh: 'Alastor Lapis'
};
const POINTS = { C: 1, U: 2, R: 3, UR: 4, SR: 5 };
const MAX_POINTS = 8, TEAM_SIZE = 3;
// Typ-Vorteile (×1.5). Dazu: Pflanzen-Attacken machen immer doppelten Schaden – steht ja auf jeder Karte: „Schwäche: Gras ×2“.
const STRONG = { fire: ['grass', 'metal'], water: ['fire'], electric: ['water'], psychic: ['fighting'], dark: ['psychic'], fighting: ['colorless', 'dark', 'metal'], metal: ['electric'], grass: [], colorless: [] };
const SUDDEN_DEATH = 20; // ab dieser Runde: keine Heilung mehr, +50 % Schaden (verhindert endlose Duelle)
const TURN_MS = 30000, OPEN_MS = 15 * 60000, MAX_DUELS = 40;
const STAKES = [0, 50, 100, 250, 500];
const BOT = { id: 'bot', name: 'Big H (Bot)' };

const rnd = (n) => crypto.randomInt(n);
const chance = (p) => crypto.randomInt(1000000) < p * 1000000;
const ZURICH_HOUR = new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', hour: 'numeric', hourCycle: 'h23' });

module.exports = function createDuels({ send, touch, clean, rarity, nameOf }) {
  const duels = new Map();

  function validTeam(a, team) {
    if (!Array.isArray(team) || team.length !== TEAM_SIZE) return 'Wähle genau 3 Karten';
    if (new Set(team).size !== TEAM_SIZE) return 'Jede Karte nur einmal pro Team';
    let pts = 0;
    for (const id of team) {
      if (typeof id !== 'string' || !STATS[id]) return 'Unbekannte Karte';
      if (a && !(a.cards && a.cards[id] > 0)) return 'Du besitzt nicht alle Karten im Team';
      pts += POINTS[rarity[id]];
    }
    if (pts > MAX_POINTS) return 'Dein Team hat ' + pts + ' Punkte, erlaubt sind ' + MAX_POINTS;
    return null;
  }
  const makeTeam = (ids) => ids.map((id) => ({ id, hp: STATS[id][1], max: STATS[id][1] }));
  // Der Bot spielt ungefähr so stark wie das Team des Spielers (gleiche Punktzahl oder einen Punkt weniger)
  const teamPoints = (ids) => ids.reduce((s, id) => s + POINTS[rarity[id]], 0);
  function botTeam(target) {
    const ids = Object.keys(STATS).filter((id) => id !== 'bigh');
    for (let k = 0; k < 2000; k++) {
      const t = [ids[rnd(ids.length)], ids[rnd(ids.length)], ids[rnd(ids.length)]];
      if (!validTeam(null, t)) { const pts = teamPoints(t); if (pts <= target && pts >= target - 1) return t; }
    }
    return ['katze', 'clown', 'matrose'];
  }

  function stats(a) { a.duel = a.duel || { w: 0, l: 0, botW: 0, botL: 0 }; return a.duel; }

  function bump(d) {
    d.version++;
    const ws = d.waiters; d.waiters = new Set();
    for (const w of ws) { clearTimeout(w.timer); send(w.res, 200, view(d, w.acc)); }
  }
  function log(d, text, kind) { d.log.push({ text, kind: kind || '' }); if (d.log.length > 40) d.log.shift(); }
  function setTimer(d, ms, fn) { clearTimeout(d.timer); d.deadline = ms ? Date.now() + ms : 0; d.timer = ms ? setTimeout(fn, ms) : null; }
  const active = (pl) => pl.team[pl.active];
  const alive = (pl) => pl.team.filter((c) => c.hp > 0).length;

  function create(a, team, stake, bot) {
    const id = crypto.randomBytes(4).toString('hex');
    const d = { id, created: Date.now(), version: 1, phase: 'open', stake: bot ? 0 : stake, bot: !!bot, players: [], turn: 0, round: 1, log: [], winner: -1, deadline: 0, timer: null, waiters: new Set(), last: null, reward: 0 };
    d.players.push({ acc: a, team: makeTeam(team), active: 0, stunned: false, immune: false, timeouts: 0 });
    duels.set(id, d);
    if (bot) {
      d.players.push({ acc: BOT, team: makeTeam(botTeam(teamPoints(team))), active: 0, stunned: false, immune: false, timeouts: 0 });
      start(d);
    } else {
      log(d, nameOf(a) + ' wartet auf einen Gegner' + (stake ? ' (Einsatz ' + stake + ' Taler)' : '') + '.');
      setTimer(d, OPEN_MS, () => cancel(d, 'Niemand wollte gegen ' + nameOf(a) + ' antreten. Das Duell wurde geschlossen.'));
    }
    return d;
  }
  function cancel(d, why) {
    if (d.phase !== 'open') return;
    if (d.stake) { d.players[0].acc.balance += d.stake; touch(); }
    d.phase = 'cancelled';
    log(d, why || 'Das Duell wurde zurückgezogen.');
    setTimer(d, 0);
    bump(d);
    setTimeout(() => duels.delete(d.id), 60000).unref();
  }
  function start(d) {
    d.phase = 'playing';
    d.turn = rnd(2);
    log(d, 'Das Duell beginnt! ' + nameOf(d.players[0].acc) + ' gegen ' + nameOf(d.players[1].acc) + '.', 'big');
    log(d, nameOf(d.players[d.turn].acc) + ' beginnt.');
    beginTurn(d);
  }

  function beginTurn(d) {
    const pl = d.players[d.turn];
    if (pl.stunned) {
      pl.stunned = false; pl.immune = true;
      log(d, cardName(active(pl).id) + ' ist noch verwirrt und setzt aus.', 'stun');
      return endTurn(d);
    }
    setTimer(d, TURN_MS, () => {
      pl.timeouts++;
      if (pl.timeouts >= 3) return finish(d, 1 - d.turn, nameOf(pl.acc) + ' ist eingeschlafen. Aufgegeben.');
      log(d, nameOf(pl.acc) + ' war zu langsam. Automatischer Angriff!');
      attack(d, 0);
    });
    bump(d);
    if (pl.acc === BOT) setTimeout(() => { if (d.phase === 'playing' && d.players[d.turn] === pl) botMove(d); }, 1400);
  }
  function endTurn(d) {
    if (d.phase !== 'playing') return;
    d.turn = 1 - d.turn;
    if (d.turn === 0) {
      d.round++;
      if (d.round === SUDDEN_DEATH) log(d, 'Runde ' + SUDDEN_DEATH + ': Sudden Death! Keine Heilung mehr, +50 % Schaden.', 'big');
    }
    beginTurn(d);
  }

  const cardName = (id) => NAMES[id] || id;

  function attack(d, index) {
    const me = d.players[d.turn], foe = d.players[1 - d.turn];
    const att = active(me), def = active(foe);
    const [atype, , attacks] = STATS[att.id];
    const [name, base, eff] = attacks[Math.max(0, Math.min(attacks.length - 1, index))];
    const who = cardName(att.id);
    d.last = { side: d.turn, attack: name, dmg: 0, crit: false, miss: false, eff: eff || null };
    // Fehlschlag
    if (base > 0 && chance(0.08)) {
      d.last.miss = true;
      log(d, who + ' setzt ' + name + ' ein … und verfehlt. Team Diff.', 'miss');
      return endTurn(d);
    }
    let dmg = base;
    let note = '';
    if (eff === 'coin') { if (chance(0.5)) { dmg *= 2; note = ' Kopf! Doppelter Schaden.'; } else { dmg = 0; note = ' Zahl … nichts passiert.'; } }
    if (eff === 'night') { const h = +ZURICH_HOUR.format(Date.now()); if (h < 4) { dmg *= 2; note = ' Es ist Nacht: doppelter Schaden!'; } }
    if (dmg > 0) {
      const dtype = STATS[def.id][0];
      let mult = 1;
      if (atype === 'grass') { mult = 2; note += ' Gras! Schwäche ×2.'; }
      else if (STRONG[atype].includes(dtype)) { mult = 1.5; note += ' Sehr effektiv!'; }
      if (d.round >= SUDDEN_DEATH) mult *= 1.5;
      dmg = dmg * mult * (0.9 + rnd(21) / 100);
      if (chance(0.1)) { dmg *= 1.5; d.last.crit = true; note += ' Volltreffer!'; }
      dmg = Math.max(1, Math.round(dmg));
      def.hp = Math.max(0, def.hp - dmg);
      d.last.dmg = dmg;
      log(d, who + ' setzt ' + name + ' ein: ' + dmg + ' Schaden.' + note, d.last.crit ? 'crit' : 'hit');
    } else {
      log(d, who + ' setzt ' + name + ' ein.' + note);
    }
    // Effekte (im Sudden Death gibt es keine Heilung mehr)
    const noHeal = d.round >= SUDDEN_DEATH && eff && eff.startsWith('heal');
    if (noHeal) log(d, 'Sudden Death: Heilung wirkt nicht mehr. Big H hat die Pflaster gegen Monster Energy getauscht.');
    else if (eff && eff.startsWith('heal:')) { const n = +eff.slice(5); const before = att.hp; att.hp = Math.min(att.max, att.hp + n); log(d, who + ' heilt ' + (att.hp - before) + ' KP.', 'heal'); }
    if (!noHeal && eff && eff.startsWith('healAll:')) { const n = +eff.slice(8); me.team.forEach((c) => { if (c.hp > 0) c.hp = Math.min(c.max, c.hp + n); }); log(d, 'Das ganze Team von ' + nameOf(me.acc) + ' wird um ' + n + ' KP geheilt.', 'heal'); }
    if (eff && eff.startsWith('buff:')) {
      if (att.buffed) log(d, who + ' ist schon gestärkt. Mehr geht nicht.');
      else { const n = +eff.slice(5); att.buffed = true; att.max += n; att.hp += n; log(d, who + ' bekommt ' + n + ' zusätzliche KP.', 'heal'); }
    }
    if (eff === 'stun' && def.hp > 0) {
      if (!foe.immune && chance(0.5)) { foe.stunned = true; log(d, cardName(def.id) + ' ist verwirrt und setzt die nächste Runde aus!', 'stun'); }
      else log(d, cardName(def.id) + ' lässt sich nicht beeindrucken.');
    }
    foe.immune = false;
    // K.o.
    if (def.hp <= 0) {
      log(d, cardName(def.id) + ' ist K.o.!', 'ko');
      foe.stunned = false;
      const next = foe.team.findIndex((c) => c.hp > 0);
      if (next === -1) return finish(d, d.turn, nameOf(me.acc) + ' gewinnt das Duell!');
      foe.active = next;
      log(d, nameOf(foe.acc) + ' schickt ' + cardName(foe.team[next].id) + ' in den Kampf.');
    }
    endTurn(d);
  }
  function switchTo(d, to) {
    const me = d.players[d.turn];
    if (!Number.isInteger(to) || to === me.active || !me.team[to] || me.team[to].hp <= 0) return 'Diese Karte kann nicht in den Kampf';
    me.active = to;
    d.last = { side: d.turn, attack: null, switched: true };
    log(d, nameOf(me.acc) + ' wechselt zu ' + cardName(me.team[to].id) + '.');
    endTurn(d);
    return null;
  }
  function finish(d, winner, text) {
    d.phase = 'done';
    d.winner = winner;
    setTimer(d, 0);
    log(d, text, 'big');
    const W = d.players[winner], L = d.players[1 - winner];
    if (d.bot) {
      if (W.acc !== BOT) stats(W.acc).botW++; else stats(L.acc).botL++;
    } else {
      stats(W.acc).w++; stats(L.acc).l++;
      if (d.stake) { W.acc.balance += d.stake * 2; d.reward = d.stake * 2; }
    }
    touch();
    bump(d);
    setTimeout(() => duels.delete(d.id), 10 * 60000).unref();
  }

  // Einfacher Bot: nimmt den stärksten Angriff, heilt, wenn es eng wird, und wechselt selten
  function botMove(d) {
    const me = d.players[d.turn], foe = d.players[1 - d.turn];
    const att = active(me), def = active(foe);
    const attacks = STATS[att.id][2];
    const low = att.hp / att.max < 0.35;
    const healIdx = attacks.findIndex((x) => x[2] && x[2].startsWith('heal'));
    if (low && healIdx !== -1 && chance(0.6)) return attack(d, healIdx);
    const bench = me.team.map((c, i) => ({ c, i })).filter((x) => x.i !== me.active && x.c.hp > 0 && x.c.hp / x.c.max > 0.7);
    if (low && bench.length && chance(0.25)) return switchTo(d, bench[0].i);
    let best = 0, bestV = -1;
    attacks.forEach((x, i) => {
      let v = x[1];
      if (STATS[att.id][0] === 'grass') v *= 2; else if (STRONG[STATS[att.id][0]].includes(STATS[def.id][0])) v *= 1.5;
      if (x[2] === 'stun' && !foe.immune) v = Math.max(v, 25);
      if (x[2] && x[2].startsWith('buff')) v = att.hp < att.max ? 20 : 5;
      if (v > bestV) { bestV = v; best = i; }
    });
    attack(d, best);
  }

  function view(d, a) {
    const mine = d.players.findIndex((p) => p.acc && a && p.acc.id === a.id);
    return {
      id: d.id, phase: d.phase, version: d.version, stake: d.stake, bot: d.bot, round: d.round,
      turn: d.turn, mySide: mine, winner: d.winner, reward: d.reward,
      deadlineIn: d.deadline ? Math.max(0, d.deadline - Date.now()) : 0,
      last: d.last,
      players: d.players.map((p) => ({ name: nameOf(p.acc), active: p.active, stunned: p.stunned, team: p.team.map((c) => ({ id: c.id, hp: c.hp, max: c.max })) })),
      log: d.log.slice(-14),
      balance: a && a.balance !== undefined ? a.balance : null
    };
  }
  function lobby(a) {
    const open = [], live = [];
    for (const d of duels.values()) {
      if (d.phase === 'open') open.push({ id: d.id, host: nameOf(d.players[0].acc), stake: d.stake, mine: d.players[0].acc === a, age: Date.now() - d.created });
      else if (d.phase === 'playing' && !d.bot) live.push({ id: d.id, names: d.players.map((p) => nameOf(p.acc)), round: d.round });
    }
    const current = [...duels.values()].find((d) => (d.phase === 'playing' || d.phase === 'open') && d.players.some((p) => p.acc === a));
    return { open, live, stats: stats(a), current: current ? current.id : null, maxPoints: MAX_POINTS, points: POINTS, stakes: STAKES };
  }
  function busyIn(a) { return [...duels.values()].find((d) => (d.phase === 'playing' || d.phase === 'open') && d.players.some((p) => p.acc === a)); }

  setInterval(() => { if (duels.size > MAX_DUELS * 3) for (const [id, d] of duels) if (d.phase === 'done' || d.phase === 'cancelled') duels.delete(id); }, 60000).unref();

  function handle(req, res, a, body, id, sub, url) {
    const isPost = req.method === 'POST';
    if (!id) {
      if (!isPost) return send(res, 200, lobby(a));
      const team = body.team, stake = Number(body.stake) || 0;
      const err = validTeam(a, team);
      if (err) return send(res, 400, { error: err });
      if (!STAKES.includes(stake)) return send(res, 400, { error: 'Ungültiger Einsatz' });
      const busy = busyIn(a);
      if (busy) return send(res, 409, { error: 'Du bist schon in einem Duell', id: busy.id });
      if ([...duels.values()].filter((d) => d.phase !== 'done' && d.phase !== 'cancelled').length >= MAX_DUELS) return send(res, 429, { error: 'Gerade laufen zu viele Duelle' });
      if (!body.bot && stake) { if (a.balance < stake) return send(res, 402, { error: 'Zu wenig Taler für diesen Einsatz' }); a.balance -= stake; touch(); }
      const d = create(a, team, stake, !!body.bot);
      return send(res, 201, view(d, a));
    }
    const d = duels.get(id);
    if (!d) return send(res, 404, { error: 'Dieses Duell gibt es nicht mehr' });
    if (!sub && !isPost) {
      const v = Number(url.searchParams.get('v')) || 0;
      if (v >= d.version && d.phase !== 'done' && d.phase !== 'cancelled') {
        const w = { res, acc: a, timer: null };
        w.timer = setTimeout(() => { d.waiters.delete(w); send(res, 200, view(d, a)); }, 25000);
        d.waiters.add(w);
        res.on('close', () => { clearTimeout(w.timer); d.waiters.delete(w); });
        return;
      }
      return send(res, 200, view(d, a));
    }
    if (!isPost) return send(res, 405, { error: 'Nicht erlaubt' });
    if (sub === 'join') {
      if (d.phase !== 'open') return send(res, 409, { error: 'Dieses Duell hat schon begonnen' });
      if (d.players[0].acc === a) return send(res, 400, { error: 'Gegen dich selbst? So einsam ist nicht mal Big H.' });
      const busy = busyIn(a);
      if (busy) return send(res, 409, { error: 'Du bist schon in einem Duell', id: busy.id });
      const err = validTeam(a, body.team);
      if (err) return send(res, 400, { error: err });
      if (d.stake) { if (a.balance < d.stake) return send(res, 402, { error: 'Zu wenig Taler für den Einsatz' }); a.balance -= d.stake; touch(); }
      d.players.push({ acc: a, team: makeTeam(body.team), active: 0, stunned: false, immune: false, timeouts: 0 });
      start(d);
      return send(res, 200, view(d, a));
    }
    if (sub === 'cancel') {
      if (d.phase !== 'open' || d.players[0].acc !== a) return send(res, 400, { error: 'Nicht möglich' });
      cancel(d);
      return send(res, 200, view(d, a));
    }
    if (sub === 'act') {
      const side = d.players.findIndex((p) => p.acc === a);
      if (side === -1) return send(res, 403, { error: 'Du spielst in diesem Duell nicht mit' });
      if (d.phase !== 'playing') return send(res, 409, { error: 'Das Duell läuft nicht' });
      if (body.type === 'forfeit') { finish(d, 1 - side, nameOf(a) + ' gibt auf und geht baden.'); return send(res, 200, view(d, a)); }
      if (d.turn !== side) return send(res, 409, { error: 'Du bist nicht an der Reihe' });
      d.players[side].timeouts = 0;
      if (body.type === 'attack') {
        const n = STATS[active(d.players[side]).id][2].length;
        const i = Number(body.index);
        if (!Number.isInteger(i) || i < 0 || i >= n) return send(res, 400, { error: 'Ungültige Attacke' });
        attack(d, i);
      } else if (body.type === 'switch') {
        const err = switchTo(d, Number(body.to));
        if (err) return send(res, 400, { error: err });
      } else return send(res, 400, { error: 'Unbekannte Aktion' });
      return send(res, 200, view(d, a));
    }
    return send(res, 404, { error: 'Nicht gefunden' });
  }

  function leaderboard(accounts, a) {
    return accounts.filter((x) => x.duel && (x.duel.w || x.duel.l)).map((x) => ({ name: x.name, w: x.duel.w, l: x.duel.l, me: !!a && x.id === a.id }))
      .sort((p, q) => q.w - p.w || p.l - q.l).slice(0, 50);
  }

  return { handle, leaderboard };
};
module.exports.STATS = STATS;
