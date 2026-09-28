// Casino Lapis – Konten, Spiele und Multiplayer-Blackjack. Das Guthaben liegt nur hier auf dem Server,
// alle Ergebnisse werden hier ausgewürfelt; der Browser zeigt sie nur an.
//
// Konto (Header X-Player: <token>):
//   POST /api/casino/join {name}          -> neues Konto {token, me}
//   GET  /api/casino/me                   -> Kontostand, Preise, Karten
//   POST /api/casino/name {name}          -> umbenennen
//   POST /api/casino/credit               -> Kredit (nur bei weniger als 10 Talern)
// Spiele:
//   POST /api/casino/slots {bet}
//   POST /api/casino/roulette {bets: {feld: betrag}}
//   GET  /api/casino/claw                 -> Preise im Automaten
//   POST /api/casino/claw {index, offset}
//   POST /api/casino/pack {free}          -> Booster-Pack (5 Karten)
//   POST /api/casino/sell                 -> doppelte Karten verkaufen
//   GET  /api/casino/leaderboard
// Blackjack-Tische:
//   GET  /api/casino/bj                   -> offene Tische
//   POST /api/casino/bj {name}            -> Tisch eröffnen (und hinsetzen)
//   GET  /api/casino/bj/:id?v=N           -> Tischzustand (wartet bis zu 25 s auf Änderungen)
//   POST /api/casino/bj/:id/join | leave | bet {amount} | action {action} | say {text}
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const START_BALANCE = 1000;
const CREDIT = 500;
const MAX_BODY = 4096;

// ---------- Slots (Rückzahlquote ca. 95 %) ----------
const SLOT_SYMBOLS = [['h', 1, 200], ['crown', 2, 80], ['gem', 3, 40], ['bath', 3, 30], ['flame', 4, 16], ['cat', 4, 12], ['pad', 5, 8]];
const SLOT_W = SLOT_SYMBOLS.reduce((a, s) => a + s[1], 0);
const SLOT_BETS = [10, 25, 50, 100];

// ---------- Roulette ----------
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const RL_BETS = {};
for (let n = 0; n <= 36; n++) RL_BETS['n' + n] = { nums: [n], pay: 35 };
[1, 2, 3].forEach((c) => { RL_BETS['col' + c] = { nums: range(1, 36).filter((n) => (n - 1) % 3 === c - 1), pay: 2 }; });
[1, 2, 3].forEach((d) => { RL_BETS['doz' + d] = { nums: range((d - 1) * 12 + 1, d * 12), pay: 2 }; });
Object.assign(RL_BETS, {
  low: { nums: range(1, 18), pay: 1 }, high: { nums: range(19, 36), pay: 1 },
  even: { nums: range(1, 36).filter((n) => n % 2 === 0), pay: 1 }, odd: { nums: range(1, 36).filter((n) => n % 2 === 1), pay: 1 },
  red: { nums: [...REDS], pay: 1 }, black: { nums: range(1, 36).filter((n) => !REDS.has(n)), pay: 1 }
});
for (const b of Object.values(RL_BETS)) b.set = new Set(b.nums);

// ---------- Greifautomat ----------
// Höchstens ~46 Taler Erwartungswert bei 50 Taler Einsatz, auch bei perfektem Zielen
const PRIZES = { mausi: [120, 3, 1], duck: [80, 4, 1], can: [60, 4, 1], bat: [100, 3, 1], pad: [90, 3, 1], heart: [70, 3, 1], crown: [400, 1, 0.25] }; // Wert, Häufigkeit, Griff-Faktor
const PRIZE_IDS = Object.keys(PRIZES);
const PILE_SIZE = 9;
const CLAW_COST = 50;

// ---------- Sammelkarten ----------
const CARDS = {
  C: ['katze', 'alien', 'teufel', 'kitty', 'caesar', 'clown', 'traene', 'peaky', 'sonnenbrille', 'nerd', 'laser', 'glatze', 'matrose', 'rapper', 'propeller', 'toad'],
  U: ['zauberer', 'steve', 'soldier', 'joker', 'batman', 'jason', '2b', 'engel', 'naruto', 'papst', 'pirat', 'mike'],
  R: ['mario', 'jawa', 'blauer-kobold', 'mercy', 'omen', 'ghostface', 'fortnite'],
  UR: ['vader', 'barbarenkoenig', 'gigachad', 'dschinni'],
  SR: ['bigh']
};
const CARD_RARITY = {};
for (const [r, ids] of Object.entries(CARDS)) ids.forEach((id) => { CARD_RARITY[id] = r; });
const PACK_PRICE = 150;
const FREE_PACK_MS = 4 * 3600 * 1000;
const SELL = { C: 5, U: 12, R: 30, UR: 80, SR: 250 }; // Erwartungswert eines Packs beim Verkauf ca. 80 < 150

// ---------- Blackjack ----------
const BJ_MAX_TABLES = 12, BJ_SEATS = 5, BJ_MIN = 10, BJ_MAX = 5000;
const BET_MS = 12000, TURN_MS = 25000, RESULT_MS = 7000, SEAT_TIMEOUT = 45000;

const rnd = (n) => crypto.randomInt(n);
const pick = (a) => a[rnd(a.length)];

module.exports = function createCasino({ dataDir, clean, send, clientIp }) {
  const file = path.join(dataDir, 'casino.json');
  let accounts = {};
  try { accounts = JSON.parse(fs.readFileSync(file, 'utf8')).accounts || {}; } catch (e) { accounts = {}; }
  const byToken = new Map();
  for (const a of Object.values(accounts)) byToken.set(a.tokenHash, a);

  let dirty = false;
  function save() {
    dirty = false;
    try {
      fs.writeFileSync(file + '.tmp', JSON.stringify({ accounts }));
      fs.renameSync(file + '.tmp', file);
    } catch (e) { console.error('Casino speichern fehlgeschlagen:', e.message); }
  }
  function touch() { if (!dirty) { dirty = true; setTimeout(save, 1500).unref(); } }
  process.on('SIGTERM', () => { if (dirty) save(); process.exit(0); });

  const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
  const nameKey = (n) => n.toLowerCase().replace(/\s+/g, ' ').trim();
  const cleanName = (n) => clean(n, 20).replace(/\s+/g, ' ');
  const nameTaken = (n, exceptId) => Object.values(accounts).some((a) => a.id !== exceptId && nameKey(a.name) === nameKey(n));

  function me(a) {
    const nextFree = Math.max(0, (a.freePackAt || 0) - Date.now());
    return { id: a.id, name: a.name, balance: a.balance, credits: a.credits, prizes: a.prizes, cards: a.cards, freePackIn: nextFree, packPrice: PACK_PRICE };
  }
  function auth(req) {
    const t = String(req.headers['x-player'] || '');
    if (!/^[a-f0-9]{48}$/.test(t)) return null;
    const a = byToken.get(hash(t));
    if (a) a.lastSeen = Date.now();
    return a || null;
  }

  function readJson(req) {
    return new Promise((resolve) => {
      if (req.method !== 'POST') return resolve({});
      let body = '', tooBig = false;
      req.on('data', (c) => { body += c; if (body.length > MAX_BODY) tooBig = true; });
      req.on('end', () => {
        if (tooBig) return resolve(null);
        if (!body) return resolve({});
        try { const d = JSON.parse(body); resolve(d && typeof d === 'object' ? d : null); } catch (e) { resolve(null); }
      });
      req.on('error', () => resolve(null));
    });
  }

  const joins = new Map();
  function joinLimited(ip) {
    const now = Date.now();
    const list = (joins.get(ip) || []).filter((t) => now - t < 3600000);
    if (list.length >= 40) return true; // grosszügig, weil sich Kollegen im Büro eine IP teilen
    list.push(now); joins.set(ip, list);
    return false;
  }

  // ================= Einzelspiele =================
  function slotSym() {
    let r = rnd(SLOT_W);
    for (const s of SLOT_SYMBOLS) { if ((r -= s[1]) < 0) return s; }
    return SLOT_SYMBOLS[0];
  }
  function playSlots(a, d) {
    const bet = Number(d.bet);
    if (!SLOT_BETS.includes(bet)) return [400, { error: 'Ungültiger Einsatz' }];
    if (a.balance < bet) return [402, { error: 'Zu wenig Taler' }];
    a.balance -= bet;
    const reels = [0, 1, 2].map(() => [slotSym(), slotSym(), slotSym()]);
    const line = reels.map((r) => r[1]);
    const hs = line.filter((s) => s[0] === 'h').length;
    let mult = 0, kind = '';
    if (line[0][0] === line[1][0] && line[1][0] === line[2][0]) { mult = line[0][2]; kind = 'three'; }
    else if (hs === 2) { mult = 10; kind = 'twoH'; }
    else if (hs === 1) { mult = 1; kind = 'oneH'; }
    else if (line[0][0] === line[1][0]) { mult = 2; kind = 'pair'; }
    const win = bet * mult;
    a.balance += win;
    touch();
    return [200, { reels: reels.map((r) => r.map((s) => s[0])), win, mult, kind, balance: a.balance }];
  }

  function playRoulette(a, d) {
    const bets = d.bets && typeof d.bets === 'object' ? d.bets : null;
    if (!bets) return [400, { error: 'Keine Einsätze' }];
    let total = 0;
    const list = [];
    for (const [k, v] of Object.entries(bets)) {
      const amt = Number(v);
      if (!RL_BETS[k] || !Number.isInteger(amt) || amt < 1) return [400, { error: 'Ungültiger Einsatz' }];
      total += amt; list.push([k, amt]);
    }
    if (!list.length || list.length > 60) return [400, { error: 'Ungültige Einsätze' }];
    if (total > 100000) return [400, { error: 'Maximal 100’000 Taler pro Dreh' }];
    if (a.balance < total) return [402, { error: 'Zu wenig Taler' }];
    a.balance -= total;
    const n = rnd(37);
    let won = 0;
    for (const [k, amt] of list) if (RL_BETS[k].set.has(n)) won += amt * (RL_BETS[k].pay + 1);
    a.balance += won;
    touch();
    return [200, { number: n, won, staked: total, balance: a.balance }];
  }

  function randomPrize() {
    const tw = PRIZE_IDS.reduce((s, id) => s + PRIZES[id][1], 0);
    let r = rnd(tw);
    for (const id of PRIZE_IDS) { if ((r -= PRIZES[id][1]) < 0) return id; }
    return PRIZE_IDS[0];
  }
  function pile(a) {
    if (!Array.isArray(a.pile) || a.pile.length !== PILE_SIZE) { a.pile = Array.from({ length: PILE_SIZE }, randomPrize); touch(); }
    return a.pile;
  }
  function playClaw(a, d) {
    const index = Number(d.index), offset = Number(d.offset);
    if (!Number.isInteger(index) || index < -1 || index >= PILE_SIZE || !Number.isFinite(offset) || offset < 0) return [400, { error: 'Ungültiger Griff' }];
    if (a.balance < CLAW_COST) return [402, { error: 'Zu wenig Taler' }];
    a.balance -= CLAW_COST;
    const p = pile(a);
    let result = 'miss', prize = null, slipAt = null;
    if (index >= 0) {
      prize = p[index];
      const base = offset < 8 ? 0.55 : offset < 16 ? 0.38 : offset < 26 ? 0.18 : 0;
      if (Math.random() < base * PRIZES[prize][2]) {
        if (Math.random() < 0.3) { result = 'slip'; slipAt = 0.35 + Math.random() * 0.4; }
        else {
          result = 'win';
          a.balance += PRIZES[prize][0];
          a.prizes = a.prizes || {};
          a.prizes[prize] = (a.prizes[prize] || 0) + 1;
          p[index] = randomPrize();
        }
      }
    }
    touch();
    return [200, { result, prize, value: prize ? PRIZES[prize][0] : 0, slipAt, balance: a.balance, pile: p, prizes: a.prizes || {} }];
  }

  function openPack(a, d) {
    const now = Date.now();
    const free = !!d.free;
    if (free) {
      if ((a.freePackAt || 0) > now) return [429, { error: 'Das Gratis-Pack ist noch nicht bereit' }];
      a.freePackAt = now + FREE_PACK_MS;
    } else {
      if (a.balance < PACK_PRICE) return [402, { error: 'Zu wenig Taler' }];
      a.balance -= PACK_PRICE;
    }
    const pulls = [pick(CARDS.C), pick(CARDS.C), pick(CARDS.C), pick(CARDS.U)];
    const r = Math.random();
    pulls.push(r < 0.05 ? pick(CARDS.SR) : r < 0.28 ? pick(CARDS.UR) : pick(CARDS.R));
    a.cards = a.cards || {};
    const cards = pulls.map((id) => { const isNew = !a.cards[id]; a.cards[id] = (a.cards[id] || 0) + 1; return { id, rarity: CARD_RARITY[id], isNew }; });
    touch();
    return [200, { cards, me: me(a) }];
  }
  function sellDupes(a) {
    let earned = 0, sold = 0;
    for (const [id, n] of Object.entries(a.cards || {})) {
      if (n > 1 && CARD_RARITY[id]) { earned += (n - 1) * SELL[CARD_RARITY[id]]; sold += n - 1; a.cards[id] = 1; }
    }
    a.balance += earned;
    touch();
    return [200, { earned, sold, me: me(a) }];
  }

  function leaderboard(a) {
    const all = Object.values(accounts).map((x) => ({
      id: x.id, name: x.name, balance: x.balance, credits: x.credits, net: x.balance - x.credits * CREDIT,
      unique: Object.keys(x.cards || {}).filter((k) => CARD_RARITY[k]).length, lastSeen: x.lastSeen || 0
    }));
    const strip = ({ id, lastSeen, ...rest }) => rest; // eslint-disable-line no-unused-vars
    const rich = all.slice().sort((p, q) => q.net - p.net || q.balance - p.balance);
    const coll = all.filter((x) => x.unique).sort((p, q) => q.unique - p.unique || q.net - p.net);
    return [200, {
      rich: rich.slice(0, 50).map((x) => Object.assign(strip(x), { me: !!a && x.id === a.id })),
      collectors: coll.slice(0, 50).map((x) => Object.assign(strip(x), { me: !!a && x.id === a.id })),
      myRank: a ? rich.findIndex((x) => x.id === a.id) + 1 : 0,
      players: all.length,
      totalCards: Object.keys(CARD_RARITY).length
    }];
  }

  // ================= Blackjack-Tische =================
  const tables = new Map();
  const SUITS = ['S', 'H', 'D', 'C'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  function newShoe() {
    const s = [];
    for (let d = 0; d < 6; d++) for (const su of SUITS) for (const r of RANKS) s.push({ r, s: su });
    for (let i = s.length - 1; i > 0; i--) { const j = rnd(i + 1); [s[i], s[j]] = [s[j], s[i]]; }
    return s;
  }
  function total(cards) {
    let t = 0, aces = 0;
    for (const c of cards) { if (c.r === 'A') { aces++; t += 11; } else t += ['J', 'Q', 'K'].includes(c.r) ? 10 : +c.r; }
    while (t > 21 && aces) { t -= 10; aces--; }
    return t;
  }
  const isBJ = (c) => c.length === 2 && total(c) === 21;
  const TALK = {
    deal: ['Karten kommen. Viel Glück, ihr braucht es.', 'Ich misch nicht, ich goone die Karten.', 'Die Bank ist gut drauf. Die Bank bin ich.'],
    dealerBust: ['Überkauft. Das war der Lag.', 'Mein Team hat mich im Stich gelassen.', 'Team Diff. Also meins.'],
    dealerWin: ['Die Bank gewinnt. Die Bank bin ich.', 'Easy.', 'Das nennt man Rizz.'],
    dealerBJ: ['Blackjack. Der Goon-König lässt grüssen.'],
    mixed: ['Ein paar gewinnen, ein paar verlieren. Wie im Ranked.', 'Hätte schlimmer sein können. Für mich.'],
    wait: ['Setzt was. Ich muss danach noch baden.', 'Einsätze bitte. Nicht so schüchtern.']
  };

  function draw(t) { if (t.shoe.length < 60) t.shoe = newShoe(); return t.shoe.pop(); }
  function bump(t) {
    t.version++;
    const waiters = t.waiters; t.waiters = new Set();
    for (const w of waiters) { clearTimeout(w.timer); respondTable(w.res, t, w.acc); }
  }
  function setTimer(t, ms, fn) {
    clearTimeout(t.timer);
    t.deadline = ms ? Date.now() + ms : 0;
    t.timer = ms ? setTimeout(() => { fn(); }, ms) : null;
  }

  function createTable(owner, name) {
    const id = crypto.randomBytes(4).toString('hex');
    const t = { id, name: name || owner.name + 's Tisch', created: Date.now(), version: 1, phase: 'waiting', seats: [], dealer: [], shoe: newShoe(), turn: -1, deadline: 0, timer: null, chat: [], talk: pick(TALK.wait), waiters: new Set(), emptySince: 0 };
    tables.set(id, t);
    return t;
  }
  function seatOf(t, a) { return t.seats.findIndex((s) => s.acc.id === a.id); }
  function leaveAll(a, except) {
    for (const t of tables.values()) { if (t !== except && seatOf(t, a) !== -1) leaveTable(t, a); }
  }
  function joinTable(t, a) {
    if (seatOf(t, a) !== -1) return null;
    if (t.seats.length >= BJ_SEATS) return 'Der Tisch ist voll';
    leaveAll(a, t);
    t.seats.push({ acc: a, bet: 0, cards: [], status: 'idle', result: null, payout: 0, lastSeen: Date.now() });
    t.emptySince = 0;
    addChat(t, null, a.name + ' setzt sich an den Tisch.');
    bump(t);
    return null;
  }
  function leaveTable(t, a) {
    const i = seatOf(t, a);
    if (i === -1) return;
    const s = t.seats[i];
    if (t.phase === 'playing' || t.phase === 'dealer') {
      // Mitten in der Runde: Platz bleibt bis zur Auswertung, die Hand wird gehalten
      s.leaving = true;
      if (t.phase === 'playing' && t.turn === i) nextTurn(t);
    } else {
      if (t.phase === 'betting' && s.bet) { s.acc.balance += s.bet; touch(); }
      t.seats.splice(i, 1);
      if (t.phase === 'betting' && !t.seats.some((x) => x.bet)) { t.phase = 'waiting'; setTimer(t, 0); }
    }
    addChat(t, null, a.name + ' verlässt den Tisch.');
    if (!t.seats.length) t.emptySince = Date.now();
    bump(t);
  }
  function addChat(t, name, text) {
    t.chat.push({ name, text, ts: Date.now() });
    if (t.chat.length > 30) t.chat.shift();
  }

  function placeBet(t, a, amount) {
    const i = seatOf(t, a);
    if (i === -1) return 'Du sitzt nicht an diesem Tisch';
    if (t.phase !== 'waiting' && t.phase !== 'betting') return 'Die Runde läuft schon. Warte auf die nächste.';
    const s = t.seats[i];
    if (!Number.isInteger(amount) || amount < 1) return 'Ungültiger Einsatz';
    if (s.bet + amount > BJ_MAX) return 'Maximal ' + BJ_MAX + ' Taler pro Hand';
    if (a.balance < amount) return 'Zu wenig Taler';
    a.balance -= amount; s.bet += amount; touch();
    if (t.phase === 'waiting') { t.phase = 'betting'; setTimer(t, BET_MS, () => deal(t)); }
    // Alle haben gesetzt (und mindestens den Mindesteinsatz): sofort austeilen
    if (t.seats.every((x) => x.bet >= BJ_MIN)) { setTimer(t, 1500, () => deal(t)); }
    bump(t);
    return null;
  }
  function clearBet(t, a) {
    const i = seatOf(t, a);
    if (i === -1 || t.phase !== 'betting') return 'Jetzt nicht möglich';
    const s = t.seats[i];
    a.balance += s.bet; s.bet = 0; touch();
    if (!t.seats.some((x) => x.bet)) { t.phase = 'waiting'; setTimer(t, 0); }
    bump(t);
    return null;
  }

  function deal(t) {
    // Einsätze unter dem Minimum zurückgeben
    t.seats.forEach((s) => { if (s.bet && s.bet < BJ_MIN) { s.acc.balance += s.bet; s.bet = 0; touch(); } });
    const players = t.seats.filter((s) => s.bet);
    if (!players.length) { t.phase = 'waiting'; setTimer(t, 0); bump(t); return; }
    t.phase = 'playing';
    t.dealer = [];
    t.seats.forEach((s) => { s.cards = []; s.result = null; s.payout = 0; s.status = s.bet ? 'playing' : 'idle'; });
    for (let r = 0; r < 2; r++) { players.forEach((s) => s.cards.push(draw(t))); t.dealer.push(draw(t)); }
    players.forEach((s) => { if (isBJ(s.cards)) s.status = 'bj'; });
    t.talk = pick(TALK.deal);
    if (isBJ(t.dealer)) { t.talk = pick(TALK.dealerBJ); return finish(t); }
    t.turn = -1;
    nextTurn(t);
  }
  function nextTurn(t) {
    const i = t.seats.findIndex((s, k) => k > t.turn && s.status === 'playing' && !s.leaving);
    // Spieler, die gehen, halten automatisch
    t.seats.forEach((s, k) => { if (k > t.turn && s.status === 'playing' && s.leaving && (i === -1 || k < i)) s.status = 'stand'; });
    if (i === -1) { t.turn = -1; return dealerPlay(t); }
    t.turn = i;
    setTimer(t, TURN_MS, () => { const s = t.seats[t.turn]; if (s && s.status === 'playing') { s.status = 'stand'; addChat(t, null, s.acc.name + ' war zu langsam und hält automatisch.'); } nextTurn(t); });
    bump(t);
  }
  function act(t, a, action) {
    const i = seatOf(t, a);
    if (t.phase !== 'playing' || i !== t.turn) return 'Du bist nicht an der Reihe';
    const s = t.seats[i];
    if (action === 'hit') {
      s.cards.push(draw(t));
      const v = total(s.cards);
      if (v > 21) { s.status = 'bust'; nextTurn(t); return null; }
      if (v === 21) { s.status = 'stand'; nextTurn(t); return null; }
      setTimer(t, TURN_MS, () => { if (s.status === 'playing') s.status = 'stand'; nextTurn(t); });
      bump(t);
      return null;
    }
    if (action === 'stand') { s.status = 'stand'; nextTurn(t); return null; }
    if (action === 'double') {
      if (s.cards.length !== 2) return 'Verdoppeln geht nur mit zwei Karten';
      if (a.balance < s.bet) return 'Zu wenig Taler zum Verdoppeln';
      a.balance -= s.bet; s.bet *= 2; touch();
      s.cards.push(draw(t));
      s.status = total(s.cards) > 21 ? 'bust' : 'stand';
      nextTurn(t);
      return null;
    }
    return 'Unbekannte Aktion';
  }
  function dealerPlay(t) {
    t.phase = 'dealer';
    setTimer(t, 0);
    bump(t);
    const needs = t.seats.some((s) => s.status === 'stand' || s.status === 'playing');
    const step = () => {
      if (needs && total(t.dealer) < 17) { t.dealer.push(draw(t)); bump(t); setTimeout(step, 700); }
      else finish(t);
    };
    setTimeout(step, 700);
  }
  function finish(t) {
    const d = total(t.dealer), dBJ = isBJ(t.dealer);
    let won = 0, lost = 0;
    t.seats.forEach((s) => {
      if (!s.bet) return;
      const p = total(s.cards), pBJ = s.status === 'bj';
      let pay = 0, res;
      if (pBJ && dBJ) { pay = s.bet; res = 'push'; }
      else if (pBJ) { pay = Math.floor(s.bet * 2.5); res = 'bj'; }
      else if (dBJ) { res = 'lose'; }
      else if (p > 21) { res = 'bust'; }
      else if (d > 21 || p > d) { pay = s.bet * 2; res = 'win'; }
      else if (p === d) { pay = s.bet; res = 'push'; }
      else res = 'lose';
      s.result = res; s.payout = pay;
      s.acc.balance += pay;
      if (pay > s.bet) won++; else if (pay < s.bet) lost++;
    });
    touch();
    if (!dBJ) t.talk = d > 21 ? pick(TALK.dealerBust) : !won ? pick(TALK.dealerWin) : lost ? pick(TALK.mixed) : pick(TALK.dealerBust);
    t.phase = 'results';
    t.turn = -1;
    setTimer(t, RESULT_MS, () => reset(t));
    bump(t);
  }
  function reset(t) {
    t.seats = t.seats.filter((s) => !s.leaving);
    t.seats.forEach((s) => { s.bet = 0; s.cards = []; s.status = 'idle'; s.result = null; s.payout = 0; });
    t.dealer = [];
    t.phase = 'waiting';
    t.talk = pick(TALK.wait);
    setTimer(t, 0);
    if (!t.seats.length) t.emptySince = Date.now();
    bump(t);
  }

  function publicTable(t, a) {
    const hide = t.phase === 'playing';
    const mine = a ? seatOf(t, a) : -1;
    return {
      id: t.id, name: t.name, phase: t.phase, version: t.version, turn: t.turn,
      deadlineIn: t.deadline ? Math.max(0, t.deadline - Date.now()) : 0,
      dealer: { cards: t.dealer.map((c, i) => (hide && i === 1 ? null : c)), total: t.dealer.length ? (hide ? total([t.dealer[0]]) : total(t.dealer)) : null },
      seats: t.seats.map((s, i) => ({ name: s.acc.name, bet: s.bet, cards: s.cards, total: s.cards.length ? total(s.cards) : null, status: s.status, result: s.result, payout: s.payout, me: i === mine, away: s.leaving || Date.now() - s.lastSeen > 35000 })),
      chat: t.chat.slice(-20), talk: t.talk, minBet: BJ_MIN, maxBet: BJ_MAX, seatsMax: BJ_SEATS,
      mySeat: mine, balance: a ? a.balance : null
    };
  }
  function respondTable(res, t, a) { send(res, 200, publicTable(t, a)); }
  function tableList() {
    return [...tables.values()].sort((p, q) => q.seats.length - p.seats.length || q.created - p.created).map((t) => ({
      id: t.id, name: t.name, phase: t.phase, players: t.seats.map((s) => s.acc.name), seats: t.seats.length, seatsMax: BJ_SEATS
    }));
  }
  // Aufräumen: inaktive Spieler entfernen, leere Tische schliessen
  setInterval(() => {
    const now = Date.now();
    for (const t of tables.values()) {
      for (const s of t.seats.slice()) if (now - s.lastSeen > SEAT_TIMEOUT) leaveTable(t, s.acc);
      if (!t.seats.length && t.emptySince && now - t.emptySince > 60000) {
        clearTimeout(t.timer);
        for (const w of t.waiters) { clearTimeout(w.timer); send(w.res, 410, { error: 'Der Tisch wurde geschlossen' }); }
        tables.delete(t.id);
      }
    }
  }, 5000).unref();

  // ================= Routing =================
  async function handle(req, res, p, url) {
    const m = p.match(/^\/api\/casino\/([a-z]+)(?:\/([a-f0-9]{8}))?(?:\/([a-z]+))?$/);
    if (!m) return send(res, 404, { error: 'Nicht gefunden' });
    const [, what, tid, sub] = m;
    const d = await readJson(req);
    if (d === null) return send(res, 400, { error: 'Ungültige Daten' });
    const isPost = req.method === 'POST';

    if (what === 'join' && isPost) {
      const name = cleanName(d.name);
      if (name.length < 2) return send(res, 400, { error: 'Name zu kurz (mindestens 2 Zeichen)' });
      if (nameTaken(name)) return send(res, 409, { error: 'Diesen Namen gibt es schon im Casino' });
      if (joinLimited(clientIp(req))) return send(res, 429, { error: 'Zu viele neue Konten. Versuch es später.' });
      const token = crypto.randomBytes(24).toString('hex');
      const a = { id: crypto.randomBytes(6).toString('hex'), name, tokenHash: hash(token), balance: START_BALANCE, credits: 0, prizes: {}, cards: {}, pile: null, freePackAt: 0, created: Date.now(), lastSeen: Date.now() };
      accounts[a.id] = a; byToken.set(a.tokenHash, a); touch();
      return send(res, 201, { token, me: me(a) });
    }
    if (what === 'leaderboard' && req.method === 'GET') { const [s, b] = leaderboard(auth(req)); return send(res, s, b); }
    if (what === 'bj' && !tid && req.method === 'GET') return send(res, 200, { tables: tableList() });

    const a = auth(req);
    if (!a) return send(res, 401, { error: 'Kein Konto. Bitte neu anmelden.' });

    if (what === 'me' && req.method === 'GET') return send(res, 200, me(a));
    if (what === 'name' && isPost) {
      const name = cleanName(d.name);
      if (name.length < 2) return send(res, 400, { error: 'Name zu kurz' });
      if (nameTaken(name, a.id)) return send(res, 409, { error: 'Diesen Namen gibt es schon' });
      a.name = name; touch();
      return send(res, 200, me(a));
    }
    if (what === 'credit' && isPost) {
      if (a.balance >= 10) return send(res, 400, { error: 'Kredit gibt es erst, wenn du pleite bist' });
      a.balance += CREDIT; a.credits++; touch();
      return send(res, 200, me(a));
    }
    const game = { slots: playSlots, roulette: playRoulette, pack: openPack };
    if (game[what] && isPost) { const [s, b] = game[what](a, d); return send(res, s, b); }
    if (what === 'sell' && isPost) { const [s, b] = sellDupes(a); return send(res, s, b); }
    if (what === 'claw') {
      if (isPost) { const [s, b] = playClaw(a, d); return send(res, s, b); }
      return send(res, 200, { pile: pile(a), prizes: a.prizes || {}, balance: a.balance });
    }

    if (what === 'bj') {
      if (!tid && isPost) {
        if (tables.size >= BJ_MAX_TABLES) return send(res, 429, { error: 'Alle Tische sind belegt' });
        const t = createTable(a, clean(d.name || '', 30));
        joinTable(t, a);
        return send(res, 201, publicTable(t, a));
      }
      const t = tables.get(tid);
      if (!t) return send(res, 404, { error: 'Diesen Tisch gibt es nicht mehr' });
      const i = seatOf(t, a);
      if (i !== -1) t.seats[i].lastSeen = Date.now();
      if (!sub && req.method === 'GET') {
        const v = Number(url.searchParams.get('v')) || 0;
        if (v >= t.version) {
          // Long-Polling: antworten, sobald sich am Tisch etwas ändert (spätestens nach 25 s)
          const w = { res, acc: a, timer: null };
          w.timer = setTimeout(() => { t.waiters.delete(w); respondTable(res, t, a); }, 25000);
          t.waiters.add(w);
          res.on('close', () => { clearTimeout(w.timer); t.waiters.delete(w); });
          return;
        }
        return respondTable(res, t, a);
      }
      if (!isPost) return send(res, 405, { error: 'Nicht erlaubt' });
      let err = null;
      if (sub === 'join') err = joinTable(t, a);
      else if (sub === 'leave') { leaveTable(t, a); return send(res, 200, { ok: true, balance: a.balance }); }
      else if (sub === 'bet') err = Number(d.amount) === 0 ? clearBet(t, a) : placeBet(t, a, Number(d.amount));
      else if (sub === 'action') err = act(t, a, String(d.action));
      else if (sub === 'say') {
        if (i === -1) err = 'Nur Spieler am Tisch können schreiben';
        else { const text = clean(d.text, 80).replace(/\s+/g, ' '); if (text) { addChat(t, a.name, text); bump(t); } }
      } else return send(res, 404, { error: 'Nicht gefunden' });
      if (err) return send(res, 400, { error: err });
      return respondTable(res, t, a);
    }
    return send(res, 404, { error: 'Nicht gefunden' });
  }

  return { handle };
};
