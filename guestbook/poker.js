// Texas Hold'em für bis zu 6 Spieler (No Limit). Alles wird auf dem Server gemischt und ausgewertet;
// jeder Spieler sieht nur die eigenen Karten (ausser beim Showdown).
//
//   GET  /api/casino/poker                  -> offene Tische + eigene Statistik
//   POST /api/casino/poker {blinds, buyin}  -> Tisch eröffnen und hinsetzen
//   GET  /api/casino/poker/:id?v=N          -> Tischzustand (wartet bis zu 25 s auf Änderungen)
//   POST /api/casino/poker/:id/sit {buyin}  -> hinsetzen (Chips kommen vom Konto)
//   POST /api/casino/poker/:id/leave        -> aufstehen (Chips gehen zurück aufs Konto)
//   POST /api/casino/poker/:id/act {action: fold|check|call|raise|allin, to}
//   POST /api/casino/poker/:id/topup {amount} | back | bot | say {text}
'use strict';

const crypto = require('crypto');

const SEATS = 6;
const BLINDS = { 5: [5, 10], 25: [25, 50], 100: [100, 200] }; // Schlüssel = Small Blind
const TURN_MS = 30000, SHOWDOWN_MS = 6000, FOLD_WIN_MS = 3000, NEXT_MS = 1500, SEAT_TIMEOUT = 50000, MAX_TABLES = 12;
const BOT_NAMES = ['Big H (Bot)', 'Mausi (Bot)', 'Goth-Baddie (Bot)', 'Beat (Bot)', 'Supercomputer (Bot)'];
const HAND_NAMES = ['Höchste Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Straße', 'Flush', 'Full House', 'Vierling', 'Straight Flush', 'Royal Flush'];
const RANK_TXT = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

const rnd = (n) => crypto.randomInt(n);

// ---------- Handbewertung ----------
// Ergebnis: [Kategorie, Tiebreaker ...], lexikografisch vergleichbar
function eval5(cards) {
  const r = cards.map((c) => c.r).sort((a, b) => b - a);
  const flush = cards.every((c) => c.s === cards[0].s);
  const uniq = [...new Set(r)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (r[0] - r[4] === 4) straightHigh = r[0];
    else if (r[0] === 14 && r[1] === 5) straightHigh = 5; // A-2-3-4-5
  }
  const counts = {};
  r.forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
  const groups = Object.entries(counts).map(([k, v]) => [v, +k]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  if (straightHigh && flush) return [straightHigh === 14 ? 9 : 8, straightHigh];
  if (groups[0][0] === 4) return [7, groups[0][1], groups[1][1]];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, groups[0][1], groups[1][1]];
  if (flush) return [5, ...r];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][0] === 3) return [3, groups[0][1], ...groups.slice(1).map((g) => g[1])];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, groups[0][1], groups[1][1], groups[2][1]];
  if (groups[0][0] === 2) return [1, groups[0][1], ...groups.slice(1).map((g) => g[1])];
  return [0, ...r];
}
function cmp(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
function best(cards) {
  let top = null, topCards = null;
  const n = cards.length;
  if (n <= 5) return { score: eval5(cards.concat([])), cards };
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
    const s = eval5(five);
    if (!top || cmp(s, top) > 0) { top = s; topCards = five; }
  }
  return { score: top, cards: topCards };
}
const rankName = (r) => RANK_TXT[r] || String(r);
function describe(score) {
  const [cat, a, b] = score;
  const plural = { 2: 'Zweien', 3: 'Dreien', 4: 'Vieren', 5: 'Fünfen', 6: 'Sechsen', 7: 'Siebnen', 8: 'Achten', 9: 'Neunen', 10: 'Zehnen', 11: 'Buben', 12: 'Damen', 13: 'Königen', 14: 'Assen' };
  switch (cat) {
    case 1: return 'Paar ' + (plural[a] ? 'aus ' + plural[a] : '');
    case 2: return 'Zwei Paare, ' + rankName(a) + ' und ' + rankName(b);
    case 3: return 'Drilling ' + (plural[a] ? 'aus ' + plural[a] : '');
    case 4: return 'Straße bis ' + rankName(a);
    case 6: return 'Full House, ' + rankName(a) + ' über ' + rankName(b);
    case 7: return 'Vierling ' + (plural[a] ? 'aus ' + plural[a] : '');
    case 8: return 'Straight Flush bis ' + rankName(a);
    default: return HAND_NAMES[cat] + (cat === 0 ? ' ' + rankName(a) : '');
  }
}

module.exports = function createPoker({ send, touch, clean, nameOf }) {
  const tables = new Map();
  let botSeq = 0;

  function newDeck() {
    const d = [];
    for (const s of ['S', 'H', 'D', 'C']) for (let r = 2; r <= 14; r++) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }
  const isBot = (s) => s && s.acc.bot;
  const stats = (a) => { a.poker = a.poker || { hands: 0, net: 0, best: 0 }; return a.poker; };

  function bump(t) {
    t.version++;
    const ws = t.waiters; t.waiters = new Set();
    for (const w of ws) { clearTimeout(w.timer); send(w.res, 200, view(t, w.acc)); }
  }
  function chat(t, name, text) { t.chat.push({ name, text, ts: Date.now() }); if (t.chat.length > 30) t.chat.shift(); }
  function setTimer(t, ms, fn) { clearTimeout(t.timer); t.deadline = ms ? Date.now() + ms : 0; t.timer = ms ? setTimeout(fn, ms) : null; }
  const seatOf = (t, a) => t.seats.findIndex((s) => s && s.acc === a);
  const humans = (t) => t.seats.filter((s) => s && !isBot(s) && !s.leaving).length;

  function create(a, sb, name) {
    const id = crypto.randomBytes(4).toString('hex');
    const t = { id, name: name || nameOf(a) + 's Tisch', sb: BLINDS[sb][0], bb: BLINDS[sb][1], seats: Array(SEATS).fill(null), button: -1, hand: null, handNo: 0, version: 1, waiters: new Set(), chat: [], timer: null, deadline: 0, created: Date.now(), emptySince: 0, phase: 'waiting', results: null };
    tables.set(id, t);
    return t;
  }
  function buyinRange(t) { return [t.bb * 20, t.bb * 100]; }

  function sit(t, a, buyin) {
    const already = seatOf(t, a);
    if (already !== -1) {
      // Wer mitten in der Hand aufgestanden ist, darf sich einfach wieder hinsetzen
      if (t.seats[already].leaving) { t.seats[already].leaving = false; t.emptySince = 0; bump(t); return null; }
      return 'Du sitzt schon an diesem Tisch';
    }
    const free = freeSeat(t);
    if (free === -1) return 'Der Tisch ist voll';
    const [min, max] = buyinRange(t);
    if (!Number.isInteger(buyin) || buyin < min || buyin > max) return 'Buy-in zwischen ' + min + ' und ' + max + ' Chips';
    if (a.balance < buyin) return 'Zu wenig Taler für dieses Buy-in';
    for (const other of tables.values()) if (other !== t && seatOf(other, a) !== -1) leave(other, a);
    a.balance -= buyin; touch();
    t.seats[free] = { acc: a, stack: buyin, sittingOut: false, lastSeen: Date.now(), timeouts: 0, leaving: false };
    t.emptySince = 0;
    chat(t, null, nameOf(a) + ' setzt sich mit ' + buyin + ' Chips.');
    maybeStart(t);
    bump(t);
    return null;
  }
  // Plätze von Spielern, die in der laufenden Hand gefoldet haben und gegangen sind, bleiben bis zur nächsten Hand gesperrt
  const freeSeat = (t) => t.seats.findIndex((s, i) => !s && !(t.hand && t.hand.players[i]));
  function addBot(t) {
    const free = freeSeat(t);
    if (free === -1) return 'Der Tisch ist voll';
    const used = new Set(t.seats.filter(isBot).map((s) => s.acc.name));
    const name = BOT_NAMES.find((n) => !used.has(n));
    if (!name) return 'Mehr Bots gibt es nicht';
    t.seats[free] = { acc: { id: 'bot' + (++botSeq), name, bot: true }, stack: t.bb * 100, sittingOut: false, lastSeen: Date.now(), timeouts: 0, leaving: false };
    chat(t, null, name + ' setzt sich an den Tisch.');
    maybeStart(t);
    bump(t);
    return null;
  }
  function payout(s) { if (!isBot(s) && s.stack > 0) { s.acc.balance += s.stack; touch(); } s.stack = 0; }
  function leave(t, a) {
    const i = seatOf(t, a);
    if (i === -1) return;
    const s = t.seats[i];
    if (s.leaving) return;
    const hp = t.hand && t.hand.players[i];
    if (hp && !hp.folded && !hp.allIn && t.phase === 'playing' && t.hand.toAct !== -1) {
      // mitten in der Hand: sofort folden. Der Einsatz bleibt im Pot, der Rest geht zurück.
      if (t.hand.toAct === i) act(t, i, 'fold');
      else { hp.folded = true; hp.last = 'Fold'; if (live(t.hand).length === 1) winByFold(t); }
    }
    if (hp && !hp.folded && t.phase !== 'waiting') {
      s.leaving = true; // all-in oder Showdown läuft: Platz wird nach der Hand frei
    } else {
      if (hp && !isBot(s) && t.phase !== 'waiting') stats(a).net -= hp.total; // Einsatz dieser Hand ist verloren
      payout(s);
      t.seats[i] = null;
    }
    chat(t, null, nameOf(a) + ' steht auf.');
    if (!humans(t)) t.emptySince = Date.now();
    bump(t);
  }

  function eligible(t) { return t.seats.map((s, i) => (s && s.stack > 0 && !s.sittingOut && !s.leaving ? i : -1)).filter((i) => i !== -1); }
  function nextFrom(t, from, pred) {
    for (let k = 1; k <= SEATS; k++) { const i = (from + k) % SEATS; if (pred(i)) return i; }
    return -1;
  }
  function maybeStart(t) {
    if (t.phase !== 'waiting') return;
    const el = eligible(t);
    if (el.length >= 2 && el.some((i) => !isBot(t.seats[i]))) setTimer(t, NEXT_MS, () => startHand(t));
  }

  function startHand(t) {
    // Aufräumen: Gegangene entfernen, Bots ohne Chips gehen, Bots ohne Menschen gehen
    t.seats.forEach((s, i) => {
      if (!s) return;
      if (s.leaving || (isBot(s) && (s.stack <= 0 || !humans(t)))) { payout(s); t.seats[i] = null; }
      else if (s.stack <= 0) s.sittingOut = true;
    });
    const el = eligible(t);
    if (el.length < 2 || !el.some((i) => !isBot(t.seats[i]))) { t.phase = 'waiting'; t.hand = null; setTimer(t, 0); bump(t); return; }
    t.handNo++;
    t.results = null;
    t.button = nextFrom(t, t.button < 0 ? SEATS - 1 : t.button, (i) => el.includes(i));
    const h = { deck: newDeck(), board: [], street: 'preflop', players: {}, won: {}, toAct: -1, currentBet: 0, minRaise: t.bb, pot: 0 };
    el.forEach((i) => { h.players[i] = { cards: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, last: '' }; });
    t.hand = h;
    t.phase = 'playing';
    const inHand = (i) => !!h.players[i];
    const heads = el.length === 2;
    const sbSeat = heads ? t.button : nextFrom(t, t.button, inHand);
    const bbSeat = nextFrom(t, sbSeat, inHand);
    post(t, sbSeat, t.sb, 'Small Blind');
    post(t, bbSeat, t.bb, 'Big Blind');
    h.currentBet = t.bb;
    for (let r = 0; r < 2; r++) el.forEach((i) => h.players[i].cards.push(h.deck.pop()));
    el.forEach((i) => { const s = t.seats[i]; if (!isBot(s)) stats(s.acc).hands++; });
    h.sbSeat = sbSeat; h.bbSeat = bbSeat;
    h.toAct = nextFrom(t, bbSeat, (i) => inHand(i) && !h.players[i].allIn);
    // Wenn alle ausser einem schon all-in sind (kleine Stacks), direkt durchlaufen lassen
    if (canAct(h).length === 0 || (canAct(h).length === 1 && h.players[canAct(h)[0]].bet >= h.currentBet)) { h.toAct = -1; return runOut(t); }
    promptTurn(t);
  }
  function post(t, i, amount, label) {
    const s = t.seats[i], p = t.hand.players[i];
    const amt = Math.min(amount, s.stack);
    s.stack -= amt; p.bet += amt; p.total += amt;
    if (s.stack === 0) p.allIn = true;
    p.last = label;
  }
  const canAct = (h) => Object.keys(h.players).map(Number).filter((i) => !h.players[i].folded && !h.players[i].allIn);
  const live = (h) => Object.keys(h.players).map(Number).filter((i) => !h.players[i].folded);

  function promptTurn(t) {
    const h = t.hand, i = h.toAct, s = t.seats[i];
    setTimer(t, TURN_MS, () => {
      s.timeouts++;
      const p = h.players[i];
      const auto = p.bet >= h.currentBet ? 'check' : 'fold';
      chat(t, null, nameOf(s.acc) + ' war zu langsam: ' + (auto === 'check' ? 'Check.' : 'Fold.'));
      if (s.timeouts >= 2 && !isBot(s)) { s.sittingOut = true; chat(t, null, nameOf(s.acc) + ' setzt aus.'); }
      act(t, i, auto);
    });
    bump(t);
    if (isBot(s)) setTimeout(() => { if (t.hand === h && h.toAct === i && t.phase === 'playing') botAct(t, i); }, 700 + rnd(1000));
  }

  // Aktion ausführen. Gibt eine Fehlermeldung zurück oder null.
  function act(t, i, action, to) {
    const h = t.hand, s = t.seats[i], p = h && h.players[i];
    if (!h || t.phase !== 'playing' || h.toAct !== i || !p) return 'Du bist nicht an der Reihe';
    const toCall = h.currentBet - p.bet;
    const pay = (amt) => { amt = Math.min(amt, s.stack); s.stack -= amt; p.bet += amt; p.total += amt; if (s.stack === 0) p.allIn = true; return amt; };
    if (action === 'fold') { p.folded = true; p.last = 'Fold'; }
    else if (action === 'check') { if (toCall > 0) return 'Check geht nicht, es liegt ein Einsatz'; p.last = 'Check'; }
    else if (action === 'call') { if (toCall <= 0) return 'Nichts zu callen'; const paid = pay(toCall); p.last = p.allIn ? 'All-in ' + paid : 'Call ' + paid; }
    else if (action === 'raise' || action === 'allin') {
      const before = h.currentBet;
      const maxTo = p.bet + s.stack;
      let target = action === 'allin' ? maxTo : Math.floor(Number(to));
      if (!Number.isFinite(target)) return 'Ungültiger Betrag';
      const minTo = h.currentBet + h.minRaise;
      if (target > maxTo) target = maxTo;
      if (target <= h.currentBet) { // All-in unter dem aktuellen Einsatz = Call
        if (action !== 'allin') return 'Raise muss höher als ' + h.currentBet + ' sein';
        const paid = pay(toCall); p.last = 'All-in ' + paid;
      } else {
        if (target < minTo && target < maxTo) return 'Mindestens auf ' + minTo + ' erhöhen';
        const raiseBy = target - h.currentBet;
        pay(target - p.bet);
        if (raiseBy >= h.minRaise) {
          h.minRaise = raiseBy;
          Object.keys(h.players).forEach((k) => { if (+k !== i) h.players[k].acted = false; }); // volle Erhöhung öffnet die Runde neu
        }
        h.currentBet = target;
        p.last = (p.allIn ? 'All-in ' : before ? 'Raise auf ' : 'Bet ') + target;
      }
    } else return 'Unbekannte Aktion';
    p.acted = true;
    afterAction(t, true);
    return null;
  }

  function afterAction(t) {
    const h = t.hand;
    if (live(h).length === 1) return winByFold(t);
    const needs = (i) => { const p = h.players[i]; return p && !p.folded && !p.allIn && (!p.acted || p.bet < h.currentBet); };
    const next = nextFrom(t, h.toAct, needs);
    if (next !== -1) { h.toAct = next; return promptTurn(t); }
    // Setzrunde fertig
    endStreet(t);
  }
  function endStreet(t) {
    const h = t.hand;
    Object.values(h.players).forEach((p) => { p.bet = 0; p.acted = false; if (!p.folded && !p.allIn) p.last = ''; });
    h.currentBet = 0; h.minRaise = t.bb;
    if (h.street === 'river') return showdown(t);
    if (canAct(h).length <= 1) return runOut(t);
    dealStreet(t);
    h.toAct = nextFrom(t, t.button, (i) => h.players[i] && !h.players[i].folded && !h.players[i].allIn);
    promptTurn(t);
  }
  function dealStreet(t) {
    const h = t.hand;
    if (h.street === 'preflop') { h.deck.pop(); h.board.push(h.deck.pop(), h.deck.pop(), h.deck.pop()); h.street = 'flop'; }
    else if (h.street === 'flop') { h.deck.pop(); h.board.push(h.deck.pop()); h.street = 'turn'; }
    else if (h.street === 'turn') { h.deck.pop(); h.board.push(h.deck.pop()); h.street = 'river'; }
  }
  // Niemand kann mehr setzen: restliche Karten aufdecken (mit kleinen Pausen, damit es spannend bleibt)
  function runOut(t) {
    const h = t.hand;
    h.toAct = -1;
    Object.values(h.players).forEach((p) => { p.bet = 0; });
    h.reveal = true; // Karten der verbleibenden Spieler zeigen
    setTimer(t, 0);
    bump(t);
    const step = () => {
      if (t.hand !== h || t.phase !== 'playing') return;
      if (h.street === 'river') return showdown(t);
      dealStreet(t);
      bump(t);
      setTimeout(step, 1100);
    };
    setTimeout(step, 900);
  }

  function pots(h) {
    const c = {};
    Object.entries(h.players).forEach(([i, p]) => { c[i] = p.total; });
    const res = [];
    for (;;) {
      const levels = Object.keys(c).filter((i) => c[i] > 0 && !h.players[i].folded).map((i) => c[i]);
      if (!levels.length) {
        const rest = Object.values(c).reduce((a, b) => a + b, 0);
        if (rest && res.length) res[res.length - 1].amount += rest;
        break;
      }
      const lvl = Math.min(...levels);
      let amount = 0;
      const elig = [];
      Object.keys(c).forEach((i) => { const take = Math.min(c[i], lvl); amount += take; c[i] -= take; if (take === lvl && !h.players[i].folded) elig.push(+i); });
      res.push({ amount, elig });
    }
    return res;
  }
  function award(t, i, amt) {
    const s = t.seats[i];
    s.stack += amt;
    t.hand.won[i] = (t.hand.won[i] || 0) + amt;
    if (!isBot(s)) { const st = stats(s.acc); st.best = Math.max(st.best, amt); }
  }
  function winByFold(t) {
    const h = t.hand;
    const w = live(h)[0];
    const total = Object.values(h.players).reduce((a, p) => a + p.total, 0);
    award(t, w, total);
    t.results = { byFold: true, winners: [{ seat: w, amount: total, hand: null }] };
    chat(t, null, nameOf(t.seats[w].acc) + ' gewinnt ' + total + ' Chips. Alle anderen haben gefoldet.');
    endHand(t, FOLD_WIN_MS);
  }
  function showdown(t) {
    const h = t.hand;
    h.street = 'showdown'; h.toAct = -1; h.reveal = true;
    const evals = {};
    live(h).forEach((i) => { evals[i] = best(h.players[i].cards.concat(h.board)); });
    const winners = {};
    pots(h).forEach((pot) => {
      if (!pot.elig.length) return;
      let top = null; let ws = [];
      pot.elig.forEach((i) => { const sc = evals[i].score; const d = top ? cmp(sc, top) : 1; if (d > 0) { top = sc; ws = [i]; } else if (d === 0) ws.push(i); });
      const share = Math.floor(pot.amount / ws.length);
      let rest = pot.amount - share * ws.length;
      // Rest-Chip an den ersten Gewinner links vom Button
      const order = ws.slice().sort((a, b) => ((a - t.button + SEATS) % SEATS) - ((b - t.button + SEATS) % SEATS));
      order.forEach((i) => { const amt = share + (rest > 0 ? 1 : 0); if (rest > 0) rest--; award(t, i, amt); winners[i] = (winners[i] || 0) + amt; });
    });
    t.results = {
      byFold: false,
      winners: Object.entries(winners).map(([i, amount]) => ({ seat: +i, amount, hand: describe(evals[i].score), best: evals[i].cards })),
      hands: Object.fromEntries(Object.entries(evals).map(([i, e]) => [i, describe(e.score)]))
    };
    t.results.winners.forEach((w) => chat(t, null, nameOf(t.seats[w.seat].acc) + ' gewinnt ' + w.amount + ' Chips mit ' + w.hand + '.'));
    endHand(t, SHOWDOWN_MS);
  }
  function endHand(t, ms) {
    t.phase = 'result';
    const h = t.hand;
    Object.entries(h.players).forEach(([i, p]) => { const s = t.seats[i]; if (s && !isBot(s)) stats(s.acc).net += (h.won[i] || 0) - p.total; });
    touch();
    setTimer(t, ms, () => {
      t.phase = 'waiting'; t.hand = null; t.results = null;
      t.seats.forEach((s, i) => { if (s && s.leaving) { payout(s); t.seats[i] = null; } });
      if (!humans(t)) t.emptySince = t.emptySince || Date.now();
      maybeStart(t);
      bump(t);
    });
    bump(t);
  }

  // ---------- Bots ----------
  function preflopScore(c) {
    const [a, b] = c.map((x) => x.r).sort((x, y) => y - x);
    let s = a + b / 2;
    if (a === b) s += 12 + a;
    if (c[0].s === c[1].s) s += 3;
    if (a - b === 1) s += 2;
    if (a - b > 4) s -= 3;
    return s; // ca. 5 (7-2) bis 40 (AA)
  }
  function botAct(t, i) {
    const h = t.hand, s = t.seats[i], p = h.players[i];
    const toCall = h.currentBet - p.bet;
    const pot = Object.values(h.players).reduce((a, x) => a + x.total, 0);
    let strength;
    if (!h.board.length) strength = (preflopScore(p.cards) - 8) / 30;
    else {
      const mine = best(p.cards.concat(h.board)).score, board = best(h.board).score;
      strength = (mine[0] - (h.board.length >= 5 ? board[0] : 0)) / 4 + (mine[0] >= 1 && mine[1] >= 11 ? 0.15 : 0);
      if (mine[0] === 0) strength = Math.max(...p.cards.map((c) => c.r)) >= 13 ? 0.12 : 0.02;
    }
    strength += (rnd(21) - 10) / 100; // etwas Launenhaftigkeit
    const bluff = rnd(100) < 6;
    const raiseTo = (frac) => Math.min(p.bet + s.stack, Math.max(h.currentBet + h.minRaise, Math.round((h.currentBet + pot * frac) / t.bb) * t.bb));
    let r;
    if ((strength > 0.7 || bluff) && s.stack > toCall) r = act(t, i, 'raise', raiseTo(strength > 0.9 ? 1 : 0.6));
    else if (toCall === 0) r = act(t, i, 'check');
    else if (strength > 0.35 || toCall <= t.bb && strength > 0.15 || toCall < pot * 0.15) r = act(t, i, 'call');
    else r = act(t, i, 'fold');
    if (r) act(t, i, toCall ? 'call' : 'check');
  }

  // ---------- Ansicht ----------
  function view(t, a) {
    const mine = a ? seatOf(t, a) : -1;
    const h = t.hand;
    const showCards = (i) => h && h.players[i] && (i === mine || (h.reveal && !h.players[i].folded && (t.phase === 'result' || h.street === 'showdown' || h.toAct === -1)));
    const my = mine !== -1 && h && h.players[mine];
    const myS = mine !== -1 ? t.seats[mine] : null;
    return {
      id: t.id, name: t.name, version: t.version, phase: t.phase, sb: t.sb, bb: t.bb, handNo: t.handNo,
      buyin: buyinRange(t), button: t.button, mySeat: mine, deadlineIn: t.deadline ? Math.max(0, t.deadline - Date.now()) : 0,
      board: h ? h.board : [], street: h ? h.street : null, toAct: h ? h.toAct : -1,
      pot: h ? Object.values(h.players).reduce((s, p) => s + p.total, 0) : 0,
      seats: t.seats.map((s, i) => {
        if (!s) return null;
        const p = h && h.players[i];
        return {
          name: nameOf(s.acc), bot: !!isBot(s), stack: s.stack, sittingOut: s.sittingOut, away: !isBot(s) && Date.now() - s.lastSeen > 35000,
          inHand: !!p, bet: p ? p.bet : 0, folded: p ? p.folded : false, allIn: p ? p.allIn : false, last: p ? p.last : '',
          cards: p ? (showCards(i) ? p.cards : p.cards.map(() => null)) : [], me: i === mine
        };
      }),
      me: my ? {
        toCall: Math.max(0, h.currentBet - my.bet), canCheck: my.bet >= h.currentBet, canRaise: my.bet + myS.stack > h.currentBet,
        minRaiseTo: Math.min(my.bet + myS.stack, h.currentBet + h.minRaise), maxRaiseTo: my.bet + myS.stack, bet: my.bet, currentBet: h.currentBet
      } : null,
      myStack: myS ? myS.stack : 0, mySittingOut: myS ? myS.sittingOut : false,
      results: t.results, chat: t.chat.slice(-20),
      balance: a && typeof a.balance === 'number' ? a.balance : null,
      stats: mine !== -1 ? stats(a) : null
    };
  }
  function lobby(a) {
    const list = [...tables.values()].map((t) => ({
      id: t.id, name: t.name, sb: t.sb, bb: t.bb, players: t.seats.filter(Boolean).map((s) => nameOf(s.acc)), seats: t.seats.filter(Boolean).length, max: SEATS
    })).sort((p, q) => q.seats - p.seats);
    const current = [...tables.values()].find((t) => { const i = seatOf(t, a); return i !== -1 && !t.seats[i].leaving; });
    return { tables: list, stats: stats(a), current: current ? current.id : null, blinds: Object.values(BLINDS) };
  }

  // Aufräumen: inaktive Spieler entfernen, leere Tische schliessen
  setInterval(() => {
    const now = Date.now();
    for (const t of tables.values()) {
      t.seats.forEach((s) => { if (s && !isBot(s) && !s.leaving && now - s.lastSeen > SEAT_TIMEOUT) leave(t, s.acc); });
      if (!humans(t)) {
        if (!t.emptySince) t.emptySince = now;
        if (now - t.emptySince > 60000 && t.phase !== 'playing') {
          t.seats.forEach((s) => { if (s) payout(s); });
          clearTimeout(t.timer);
          for (const w of t.waiters) { clearTimeout(w.timer); send(w.res, 410, { error: 'Der Tisch wurde geschlossen' }); }
          tables.delete(t.id);
        }
      }
    }
  }, 5000).unref();

  // Beim Herunterfahren: alle Chips am Tisch (inkl. laufender Einsätze) zurück aufs Konto
  function shutdown() {
    for (const t of tables.values()) {
      t.seats.forEach((s, i) => {
        if (!s || isBot(s)) return;
        const p = t.hand && t.phase === 'playing' && t.hand.players[i];
        s.acc.balance += s.stack + (p ? p.total : 0);
        s.stack = 0;
      });
    }
  }

  function handle(req, res, a, body, id, sub, url) {
    const isPost = req.method === 'POST';
    if (!id) {
      if (!isPost) return send(res, 200, lobby(a));
      if (tables.size >= MAX_TABLES) return send(res, 429, { error: 'Alle Pokertische sind belegt' });
      const sb = Number(body.blinds);
      if (!BLINDS[sb]) return send(res, 400, { error: 'Ungültige Blinds' });
      const t = create(a, sb, clean(body.name || '', 30));
      const err = sit(t, a, Number(body.buyin));
      if (err) { tables.delete(t.id); return send(res, 400, { error: err }); }
      return send(res, 201, view(t, a));
    }
    const t = tables.get(id);
    if (!t) return send(res, 404, { error: 'Diesen Tisch gibt es nicht mehr' });
    const i = seatOf(t, a);
    if (i !== -1) t.seats[i].lastSeen = Date.now();
    if (!sub && !isPost) {
      const v = Number(url.searchParams.get('v')) || 0;
      if (v >= t.version) {
        const w = { res, acc: a, timer: null };
        w.timer = setTimeout(() => { t.waiters.delete(w); send(res, 200, view(t, a)); }, 25000);
        t.waiters.add(w);
        res.on('close', () => { clearTimeout(w.timer); t.waiters.delete(w); });
        return;
      }
      return send(res, 200, view(t, a));
    }
    if (!isPost) return send(res, 405, { error: 'Nicht erlaubt' });
    let err = null;
    if (sub === 'sit') err = sit(t, a, Number(body.buyin));
    else if (sub === 'leave') { leave(t, a); return send(res, 200, { ok: true, balance: a.balance }); }
    else if (sub === 'bot') err = i === -1 ? 'Setz dich zuerst hin' : addBot(t);
    else if (sub === 'back') { if (i === -1) err = 'Du sitzt nicht am Tisch'; else { t.seats[i].sittingOut = false; t.seats[i].timeouts = 0; maybeStart(t); bump(t); } }
    else if (sub === 'topup') {
      const amt = Number(body.amount);
      if (i === -1) err = 'Du sitzt nicht am Tisch';
      else if (t.phase === 'playing' && t.hand && t.hand.players[i] && !t.hand.players[i].folded) err = 'Nachkaufen geht nur zwischen den Händen';
      else if (!Number.isInteger(amt) || amt < t.bb || t.seats[i].stack + amt > buyinRange(t)[1]) err = 'Maximal ' + buyinRange(t)[1] + ' Chips am Tisch';
      else if (a.balance < amt) err = 'Zu wenig Taler';
      else { a.balance -= amt; t.seats[i].stack += amt; t.seats[i].sittingOut = false; touch(); maybeStart(t); bump(t); }
    } else if (sub === 'act') {
      if (i === -1) err = 'Du sitzt nicht am Tisch';
      else { t.seats[i].timeouts = 0; if (t.seats[i].sittingOut) t.seats[i].sittingOut = false; err = act(t, i, String(body.action), body.to); }
    } else if (sub === 'say') {
      if (i === -1) err = 'Nur Spieler am Tisch können schreiben';
      else { const text = clean(body.text, 80).replace(/\s+/g, ' '); if (text) { chat(t, nameOf(a), text); bump(t); } }
    } else return send(res, 404, { error: 'Nicht gefunden' });
    if (err) return send(res, 400, { error: err });
    return send(res, 200, view(t, a));
  }

  function leaderboard(accounts, a) {
    return accounts.filter((x) => x.poker && x.poker.hands).map((x) => ({ name: x.name, hands: x.poker.hands, net: x.poker.net, best: x.poker.best, me: !!a && x.id === a.id }))
      .sort((p, q) => q.net - p.net || q.hands - p.hands).slice(0, 50);
  }

  return { handle, shutdown, leaderboard };
};
module.exports.eval5 = eval5;
module.exports.best = best;
module.exports.describe = describe;
