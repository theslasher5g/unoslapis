// Big H Jeopardy: ein Host (hat die Lösungen, wählt die Fragen, bewertet) und bis zu 7 Spieler mit Handy-Buzzer.
// Räume leben nur im Arbeitsspeicher. Jeder bekommt beim Erstellen/Beitreten einen geheimen Schlüssel (X-Jeopardy).
//
//   GET  /api/jeopardy                 -> offene Räume + Kategorien
//   POST /api/jeopardy {name, cats}    -> Raum erstellen (man wird Host)
//   POST /api/jeopardy/CODE/join {name}-> beitreten (Spieler)
//   GET  /api/jeopardy/CODE?v=N        -> Zustand (wartet bis zu 25 s auf Änderungen); ohne Schlüssel = Bildschirm-Ansicht
//   POST /api/jeopardy/CODE/<aktion>   -> siehe ACTIONS unten
'use strict';

const crypto = require('crypto');
const { CATEGORIES, FINALS, PRESETS } = require('./jeopardy-data');

const MAX_PLAYERS = 7, MAX_ROOMS = 30, MAX_BODY = 4096;
const IDLE_MS = 3 * 3600e3, LOBBY_IDLE_MS = 45 * 60e3;
const EARLY_MS = 1000, FINAL_MS = 45000, POLL_MS = 25000;
const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
const JOKERS = ['double', 'shield', 'freeze', 'hint'];
const JOKER_NAMES = { double: 'Doppelt', shield: 'Schild', freeze: 'Einfrieren', hint: 'Tipp' };
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CAT_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// Sprüche von Big H als Moderator
const LINES = {
  start: ['Willkommen bei Big H Jeopardy. Ich muss danach noch baden gehen, also los.', 'Die Show beginnt. Wer verliert, räumt Lapisien auf.'],
  right: ['Das war kein Wissen, das war Rizz.', 'Korrekt. Sogar Mausi ist beeindruckt.', 'Richtig! Team Diff, aber diesmal zu deinen Gunsten.', 'Stimmt. Ich hätte es auch gewusst. Wahrscheinlich.'],
  wrong: ['Falsch. Team Diff.', 'Nope. Das war ein NPC-Move.', 'Leider falsch. Geh mal Gras anfassen.', 'Daneben. Der Supercomputer ist enttäuscht.'],
  nobody: ['Niemand? Ernsthaft? Dann halt nicht.', 'Stille. Wie in meinem Posteingang.', 'Keiner wusste es. Der Wasserzähler auch nicht.'],
  early: ['zu früh gedrückt. Eine Sekunde Strafe.', 'hat den Buzzer zu früh gedrückt. Geduld, junger Goon.'],
  dd: ['Daily Double! Jetzt wird gezockt.', 'Daily Double. Nur für eine Person. Kein Druck.'],
  final: ['Finale! Jetzt zählt jeder Punkt.', 'Final Jeopardy. Ich hole schon mal das Badetuch.']
};
const pick = (a) => a[crypto.randomInt(a.length)];

module.exports = function createJeopardy({ send, clean, clientIp }) {
  const rooms = new Map();
  const creates = new Map(); // IP -> Zeitstempel (Erstell-Limit)

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
  const token = () => crypto.randomBytes(18).toString('hex');
  const cleanName = (n) => clean(n, 18).replace(/\s+/g, ' ');
  const key = (n) => n.toLowerCase().trim();

  function newCode() {
    for (;;) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
      if (!rooms.has(c)) return c;
    }
  }
  function validCats(ids) {
    if (!Array.isArray(ids)) return null;
    const list = [...new Set(ids.map(String))].filter((id) => CAT_BY_ID[id]);
    return list.length >= 3 && list.length <= 6 ? list : null;
  }
  function buildBoard(r) {
    r.board = r.cats.map((id) => {
      const c = CAT_BY_ID[id];
      return { id, name: c.name, tiles: c.qs.map(([clue, answer, hint], i) => ({ v: (i + 1) * 100, clue, answer, hint, used: false, dd: false })) };
    });
    // Daily Doubles: eins pro 3 Kategorien, bevorzugt in den teuren Reihen
    const n = Math.max(1, Math.floor(r.cats.length / 3));
    const cols = r.board.map((_, i) => i).sort(() => crypto.randomInt(3) - 1);
    for (let k = 0; k < n; k++) {
      const c = cols[k % cols.length];
      const row = [2, 3, 3, 4, 4][crypto.randomInt(5)];
      r.board[c].tiles[row].dd = true;
    }
    r.finalQ = FINALS[crypto.randomInt(FINALS.length)];
  }

  function bump(r) {
    r.version++;
    r.touched = Date.now();
    const ws = r.waiters; r.waiters = new Set();
    for (const w of ws) { clearTimeout(w.timer); send(w.res, 200, view(r, w.who)); }
  }
  function say(r, text) { r.line = text; r.lineId++; }
  const player = (r, id) => r.players.find((p) => p.id === id);
  const nameOf = (r, id) => { const p = player(r, id); return p ? p.name : '?'; };

  function create(name, cats) {
    const r = {
      code: newCode(), created: Date.now(), touched: Date.now(), version: 1, waiters: new Set(),
      hostToken: token(), hostName: name, hostSeen: Date.now(), cats, board: [], finalQ: null,
      phase: 'lobby', players: [], control: null, q: null, fin: null, line: 'Warte auf Mitspieler …', lineId: 0, round: 1
    };
    buildBoard(r);
    rooms.set(r.code, r);
    return r;
  }
  function addPlayer(r, name) {
    if (r.players.length >= MAX_PLAYERS) return [null, 'Das Spiel ist voll (max. ' + MAX_PLAYERS + ' Spieler)'];
    if (r.phase === 'final' || r.phase === 'end') return [null, 'Das Finale läuft schon'];
    if (key(name) === key(r.hostName) || r.players.some((p) => key(p.name) === key(name))) return [null, 'Diesen Namen gibt es schon in diesem Spiel'];
    const used = new Set(r.players.map((p) => p.color));
    const p = {
      id: crypto.randomBytes(4).toString('hex'), token: token(), name, color: COLORS.find((c) => !used.has(c)) || COLORS[0],
      score: 0, jokers: Object.fromEntries(JOKERS.map((j) => [j, true])), lastSeen: Date.now(),
      stats: { right: 0, wrong: 0, early: 0, best: 0, buzzes: 0, jokers: 0, gained: 0 }
    };
    r.players.push(p);
    say(r, name + ' ist dabei.');
    return [p, null];
  }

  // ---------- Fragen ----------
  function openTile(r, c, row) {
    const col = r.board[c], t = col && col.tiles[row];
    if (!t || t.used) return 'Diese Frage gibt es nicht mehr';
    r.phase = 'question';
    r.q = {
      c, r: row, value: t.v, status: t.dd ? 'dd' : 'reading', openedAt: 0, buzzer: null, buzzAt: 0, buzzes: [],
      locked: [], frozen: {}, doubled: [], shielded: [], hinted: [], early: {}, results: [],
      dd: t.dd ? { pid: r.control && player(r, r.control) ? r.control : null, wager: null } : null
    };
    say(r, t.dd ? pick(LINES.dd) : col.name + ' für ' + t.v + '.');
    return null;
  }
  const tile = (r) => r.board[r.q.c].tiles[r.q.r];
  const canBuzz = (r, p) => !r.q.locked.includes(p.id) && !r.q.frozen[p.id];

  function buzz(r, p, ms) {
    const q = r.q, now = Date.now();
    if (r.phase !== 'question' || !q) return 'Gerade gibt es nichts zu buzzern';
    if (q.dd) return 'Das ist ein Daily Double für ' + nameOf(r, q.dd.pid);
    if (q.locked.includes(p.id)) return 'Du hast bei dieser Frage schon geantwortet';
    if (q.frozen[p.id]) return 'Du bist eingefroren';
    if (q.status === 'reading') {
      q.early[p.id] = now + EARLY_MS;
      p.stats.early++;
      say(r, p.name + ' ' + pick(LINES.early));
      return { early: EARLY_MS };
    }
    if (q.status === 'open') {
      if ((q.early[p.id] || 0) > now) return { early: q.early[p.id] - now };
      q.status = 'buzzed'; q.buzzer = p.id; q.buzzAt = now;
      const react = Number.isFinite(+ms) && +ms > 0 && +ms < 60000 ? Math.round(+ms) : null;
      q.buzzes = [{ pid: p.id, dt: 0, ms: react }];
      p.stats.buzzes++;
      if (react && (!p.stats.best || react < p.stats.best)) p.stats.best = react;
      say(r, p.name + ' hat gebuzzert!');
      return { first: true };
    }
    if (q.status === 'buzzed' && !q.buzzes.some((b) => b.pid === p.id) && now - q.buzzAt < 3000) {
      q.buzzes.push({ pid: p.id, dt: now - q.buzzAt, ms: null });
      return { late: now - q.buzzAt };
    }
    return 'Zu spät';
  }

  function judge(r, correct) {
    const q = r.q;
    if (r.phase !== 'question' || !q) return 'Keine offene Frage';
    let pid, delta;
    if (q.dd) {
      if (q.status !== 'reading' || q.dd.wager === null) return 'Erst muss der Einsatz feststehen';
      pid = q.dd.pid;
      delta = correct ? q.dd.wager : (q.shielded.includes(pid) ? 0 : -q.dd.wager);
    } else {
      if (q.status !== 'buzzed') return 'Niemand hat gebuzzert';
      pid = q.buzzer;
      const mult = q.doubled.includes(pid) ? 2 : 1;
      delta = correct ? q.value * mult : (q.shielded.includes(pid) ? 0 : -q.value * mult);
    }
    const p = player(r, pid);
    if (!p) return 'Spieler nicht gefunden';
    p.score += delta;
    if (correct) { p.stats.right++; p.stats.gained += delta; } else p.stats.wrong++;
    q.results.push({ pid, correct: !!correct, delta });
    if (correct || q.dd) {
      q.status = 'reveal';
      if (correct || q.dd) r.control = pid;
      say(r, correct ? p.name + ' +' + delta + '. ' + pick(LINES.right) : p.name + ' ' + (delta ? delta : '±0 (Schild)') + '. ' + pick(LINES.wrong));
    } else {
      q.locked.push(pid);
      q.buzzer = null; q.buzzes = [];
      const left = r.players.filter((x) => canBuzz(r, x));
      if (!left.length) { q.status = 'reveal'; say(r, p.name + ' ' + (delta || '±0 (Schild)') + '. ' + pick(LINES.nobody)); }
      else { q.status = 'open'; q.openedAt = Date.now(); say(r, p.name + ' ' + (delta || '±0 (Schild)') + '. ' + pick(LINES.wrong) + ' Buzzer wieder frei!'); }
    }
    return null;
  }

  function useJoker(r, p, type, target) {
    const q = r.q;
    if (!JOKERS.includes(type)) return 'Unbekannter Joker';
    if (!p.jokers[type]) return 'Diesen Joker hast du schon benutzt';
    if (r.phase !== 'question' || !q || q.status === 'reveal') return 'Joker gehen nur, solange eine Frage offen ist';
    const mine = q.dd ? q.dd.pid === p.id : true;
    if (type === 'double') {
      if (q.dd) return 'Beim Daily Double gibt es keinen Doppelt-Joker – setz einfach mehr';
      if (!['reading', 'open'].includes(q.status) || !canBuzz(r, p)) return 'Doppelt geht nur vor dem Buzzern';
      q.doubled.push(p.id);
      say(r, p.name + ' spielt Doppelt: diese Frage zählt für ' + p.name + ' ' + q.value * 2 + ' Punkte. Oder minus.');
    } else if (type === 'shield') {
      if (!mine) return 'Das Daily Double gehört jemand anderem';
      if (q.dd ? q.status === 'reveal' : !['reading', 'open'].includes(q.status) || !canBuzz(r, p)) return 'Schild geht nur vor dem Buzzern';
      q.shielded.push(p.id);
      say(r, p.name + ' aktiviert den Schild. Falsche Antwort kostet nichts.');
    } else if (type === 'freeze') {
      if (q.dd) return 'Beim Daily Double gibt es niemanden einzufrieren';
      if (!['reading', 'open'].includes(q.status)) return 'Einfrieren geht nur, bevor jemand buzzert';
      const t = player(r, String(target || ''));
      if (!t || t.id === p.id) return 'Wen willst du einfrieren?';
      if (!canBuzz(r, t)) return t.name + ' kann bei dieser Frage eh nicht mehr buzzern';
      q.frozen[t.id] = p.id;
      say(r, p.name + ' friert ' + t.name + ' ein. Brrr.');
    } else if (type === 'hint') {
      if (!mine) return 'Das Daily Double gehört jemand anderem';
      q.hinted.push(p.id);
      say(r, p.name + ' holt sich einen Tipp von Big H.');
    }
    p.jokers[type] = false;
    p.stats.jokers++;
    return null;
  }

  // ---------- Finale ----------
  function startFinal(r) {
    r.phase = 'final';
    r.q = null;
    r.fin = { step: 'category', wagers: {}, answers: {}, judged: {}, players: [], deadline: 0, timer: null, current: null };
    say(r, pick(LINES.final));
  }
  function finalNext(r) {
    const f = r.fin;
    if (f.step === 'category') {
      f.players = r.players.filter((p) => p.score > 0).map((p) => p.id);
      if (!f.players.length) { r.phase = 'end'; say(r, 'Niemand hat Punkte für das Finale. Respekt, das ist auch eine Leistung.'); return null; }
      f.step = 'wager';
      say(r, 'Einsätze bitte! Wer Punkte hat, setzt einen Teil davon.');
    } else if (f.step === 'wager') {
      f.players.forEach((id) => { if (!(id in f.wagers)) f.wagers[id] = 0; });
      f.step = 'answer';
      f.deadline = Date.now() + FINAL_MS;
      clearTimeout(f.timer);
      f.timer = setTimeout(() => { if (r.fin === f && f.step === 'answer') { toReveal(r); bump(r); } }, FINAL_MS + 1500);
      say(r, 'Die Uhr läuft. ' + FINAL_MS / 1000 + ' Sekunden.');
    } else if (f.step === 'answer') {
      toReveal(r);
    } else if (f.step === 'reveal') {
      if (f.players.some((id) => !(id in f.judged))) return 'Erst alle Antworten bewerten';
      r.phase = 'end';
      const top = [...r.players].sort((a, b) => b.score - a.score)[0];
      say(r, top ? top.name + ' gewinnt Big H Jeopardy! Ich gehe jetzt baden.' : 'Ende.');
    }
    return null;
  }
  function toReveal(r) {
    const f = r.fin;
    clearTimeout(f.timer);
    f.step = 'reveal';
    // Aufdecken vom niedrigsten zum höchsten Punktestand (wie im Fernsehen)
    f.players.sort((a, b) => player(r, a).score - player(r, b).score);
    f.current = f.players[0];
    say(r, 'Die Zeit ist um. Wir schauen uns die Antworten an.');
  }
  function finalJudge(r, pid, correct) {
    const f = r.fin;
    if (f.step !== 'reveal' || !f.players.includes(pid)) return 'Nicht möglich';
    if (pid in f.judged) return 'Schon bewertet';
    const p = player(r, pid);
    const w = f.wagers[pid] || 0;
    f.judged[pid] = !!correct;
    p.score += correct ? w : -w;
    if (correct) { p.stats.right++; p.stats.gained += w; } else p.stats.wrong++;
    say(r, p.name + (correct ? ' liegt richtig: +' : ' liegt falsch: −') + w + '.');
    f.current = f.players.find((id) => !(id in f.judged)) || null;
    return null;
  }

  // ---------- Ansicht ----------
  function awards(r) {
    const ps = r.players;
    if (!ps.length) return [];
    const by = (fn, filter) => { const l = ps.filter(filter || (() => true)); return l.length ? l.reduce((a, b) => (fn(b) > fn(a) ? b : a)) : null; };
    const out = [];
    const fast = by((p) => -p.stats.best, (p) => p.stats.best > 0);
    if (fast) out.push({ title: 'Schnellster Finger', who: fast.name, text: (fast.stats.best / 1000).toFixed(2).replace('.', ',') + ' s Reaktionszeit' });
    const early = by((p) => p.stats.early, (p) => p.stats.early > 0);
    if (early) out.push({ title: 'Ungeduldigster Buzzer', who: early.name, text: early.stats.early + '× zu früh gedrückt' });
    const right = by((p) => p.stats.right, (p) => p.stats.right > 0);
    if (right) out.push({ title: 'Besserwisser', who: right.name, text: right.stats.right + (right.stats.right === 1 ? ' richtige Antwort' : ' richtige Antworten') });
    const wrong = by((p) => p.stats.wrong, (p) => p.stats.wrong > 0);
    if (wrong) out.push({ title: 'Team Diff Award', who: wrong.name, text: wrong.stats.wrong + (wrong.stats.wrong === 1 ? ' falsche Antwort' : ' falsche Antworten') });
    const jok = by((p) => p.stats.jokers, (p) => p.stats.jokers > 0);
    if (jok) out.push({ title: 'Joker-König', who: jok.name, text: jok.stats.jokers + ' Joker eingesetzt' });
    return out;
  }

  function view(r, who) {
    const now = Date.now();
    const host = who.role === 'host', me = who.p || null;
    const q = r.q, f = r.fin;
    const out = {
      code: r.code, phase: r.phase, version: r.version, role: who.role, me: me ? me.id : null, host: r.hostName,
      hostOnline: now - r.hostSeen < 40000, line: r.line, lineId: r.lineId, control: r.control, round: r.round,
      players: r.players.map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score, jokers: p.jokers, online: now - p.lastSeen < 40000 })),
      cats: r.cats, board: r.board.map((c) => ({ name: c.name, tiles: c.tiles.map((t) => ({ v: t.v, used: t.used, dd: host && t.dd ? true : undefined })) })),
      left: r.board.reduce((s, c) => s + c.tiles.filter((t) => !t.used).length, 0)
    };
    if (r.phase === 'lobby') out.catNames = r.cats.map((id) => CAT_BY_ID[id].name);
    if (q && r.phase === 'question') {
      const t = tile(r);
      const reveal = q.status === 'reveal';
      out.q = {
        c: q.c, r: q.r, cat: r.board[q.c].name, value: q.value, status: q.status,
        clue: q.status === 'dd' ? null : t.clue,
        answer: host || reveal ? t.answer : null,
        hint: host || (me && q.hinted.includes(me.id)) ? t.hint : null,
        dd: q.dd, buzzer: q.buzzer, buzzes: q.buzzes, locked: q.locked, frozen: Object.keys(q.frozen), frozenBy: q.frozen,
        doubled: q.doubled, shielded: q.shielded, hinted: q.hinted, results: q.results,
        openFor: q.status === 'open' ? now - q.openedAt : 0,
        earlyIn: me && (q.early[me.id] || 0) > now ? q.early[me.id] - now : 0,
        maxWager: q.dd && q.dd.pid ? Math.max(500, (player(r, q.dd.pid) || {}).score || 0) : 0
      };
    }
    if (f && r.phase === 'final') {
      const pub = (id) => f.step === 'reveal' && (id in f.judged || id === f.current);
      out.fin = {
        step: f.step, cat: r.finalQ.cat, clue: ['answer', 'reveal'].includes(f.step) ? r.finalQ.clue : null,
        answer: host || (f.step === 'reveal' && !f.current) ? r.finalQ.answer : null,
        players: f.players, current: f.current, judged: f.judged,
        wagered: Object.keys(f.wagers), answered: Object.keys(f.answers),
        wagers: Object.fromEntries(Object.entries(f.wagers).filter(([id]) => host || (me && id === me.id) || pub(id))),
        answers: Object.fromEntries(Object.entries(f.answers).filter(([id]) => (me && id === me.id) || (host && f.step === 'reveal') || pub(id))),
        deadlineIn: f.step === 'answer' ? Math.max(0, f.deadline - now) : 0
      };
    }
    if (r.phase === 'end') out.awards = awards(r);
    return out;
  }

  function lobbyList() {
    return [...rooms.values()].filter((r) => r.phase === 'lobby' || r.phase === 'board' || r.phase === 'question')
      .sort((a, b) => b.created - a.created).slice(0, 20)
      .map((r) => ({ code: r.code, host: r.hostName, players: r.players.length, max: MAX_PLAYERS, phase: r.phase, names: r.players.map((p) => p.name) }));
  }
  function closeRoom(r, msg) {
    if (r.fin) clearTimeout(r.fin.timer);
    for (const w of r.waiters) { clearTimeout(w.timer); send(w.res, 410, { error: msg || 'Das Spiel wurde beendet' }); }
    rooms.delete(r.code);
  }

  setInterval(() => {
    const now = Date.now();
    for (const r of rooms.values()) {
      if (now - r.touched > IDLE_MS || (r.phase === 'lobby' && now - r.hostSeen > LOBBY_IDLE_MS)) closeRoom(r, 'Das Spiel ist abgelaufen');
    }
    for (const [ip, list] of creates) { const l = list.filter((t) => now - t < 3600e3); if (l.length) creates.set(ip, l); else creates.delete(ip); }
  }, 30000).unref();

  // ---------- Routing ----------
  const HOST_ACTIONS = new Set(['cats', 'start', 'pick', 'open', 'judge', 'reveal', 'next', 'dd', 'ddwager', 'adjust', 'kick', 'final', 'finalnext', 'finaljudge', 'restart', 'close']);
  const PLAYER_ACTIONS = new Set(['buzz', 'joker', 'wager', 'answer', 'leave']);

  async function handle(req, res, p, url) {
    const m = p.match(/^\/api\/jeopardy(?:\/([A-Za-z]{4}))?(?:\/([a-z]+))?$/);
    if (!m) return send(res, 404, { error: 'Nicht gefunden' });
    const code = m[1] ? m[1].toUpperCase() : null, action = m[2] || null;
    const d = await readJson(req);
    if (d === null) return send(res, 400, { error: 'Ungültige Daten' });
    const isPost = req.method === 'POST';

    if (!code) {
      if (!isPost) return send(res, 200, { rooms: lobbyList(), categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name, group: c.group })), presets: PRESETS });
      const name = cleanName(d.name);
      if (name.length < 2) return send(res, 400, { error: 'Name zu kurz' });
      const cats = validCats(d.cats);
      if (!cats) return send(res, 400, { error: 'Wähle 3 bis 6 Kategorien' });
      if (rooms.size >= MAX_ROOMS) return send(res, 429, { error: 'Gerade laufen zu viele Spiele' });
      const ip = clientIp(req), list = (creates.get(ip) || []).filter((t) => Date.now() - t < 3600e3);
      if (list.length >= 15) return send(res, 429, { error: 'Zu viele neue Spiele. Versuch es später.' });
      list.push(Date.now()); creates.set(ip, list);
      const r = create(name, cats);
      return send(res, 201, { code: r.code, token: r.hostToken, role: 'host' });
    }

    const r = rooms.get(code);
    if (!r) return send(res, 404, { error: 'Dieses Spiel gibt es nicht (mehr). Code prüfen?' });
    const tok = String(req.headers['x-jeopardy'] || '');
    const who = { role: 'tv', p: null };
    if (tok && tok === r.hostToken) { who.role = 'host'; r.hostSeen = Date.now(); }
    else if (tok) { const pl = r.players.find((x) => x.token === tok); if (pl) { who.role = 'player'; who.p = pl; pl.lastSeen = Date.now(); } }

    if (!action && !isPost) {
      const v = Number(url.searchParams.get('v')) || 0;
      if (v >= r.version) {
        const w = { res, who, timer: null };
        w.timer = setTimeout(() => { r.waiters.delete(w); send(res, 200, view(r, who)); }, POLL_MS);
        r.waiters.add(w);
        res.on('close', () => { clearTimeout(w.timer); r.waiters.delete(w); });
        return;
      }
      return send(res, 200, view(r, who));
    }
    if (!isPost) return send(res, 405, { error: 'Nicht erlaubt' });

    if (action === 'join') {
      if (who.role === 'player') return send(res, 200, { code: r.code, token: tok, role: 'player', id: who.p.id });
      const name = cleanName(d.name);
      if (name.length < 2) return send(res, 400, { error: 'Name zu kurz' });
      const [pl, err] = addPlayer(r, name);
      if (err) return send(res, 400, { error: err });
      bump(r);
      return send(res, 201, { code: r.code, token: pl.token, role: 'player', id: pl.id });
    }

    let err = null, extra = null;
    if (HOST_ACTIONS.has(action)) {
      if (who.role !== 'host') return send(res, 403, { error: 'Das darf nur der Host' });
      const q = r.q;
      switch (action) {
        case 'cats': {
          const cats = validCats(d.cats);
          if (r.phase !== 'lobby') err = 'Kategorien gehen nur in der Lobby';
          else if (!cats) err = 'Wähle 3 bis 6 Kategorien';
          else { r.cats = cats; buildBoard(r); }
          break;
        }
        case 'start':
          if (r.phase !== 'lobby') err = 'Läuft schon';
          else if (!r.players.length) err = 'Es braucht mindestens einen Spieler';
          else { r.phase = 'board'; say(r, pick(LINES.start)); }
          break;
        case 'pick':
          if (r.phase !== 'board') err = 'Zuerst die aktuelle Frage abschliessen';
          else err = openTile(r, Number(d.c), Number(d.r));
          break;
        case 'open':
          if (!q || q.status !== 'reading' || q.dd) err = 'Buzzer kann gerade nicht freigegeben werden';
          else { q.status = 'open'; q.openedAt = Date.now(); say(r, 'Buzzer frei!'); }
          break;
        case 'judge': err = judge(r, !!d.correct); break;
        case 'reveal':
          if (!q || r.phase !== 'question') err = 'Keine offene Frage';
          else if (q.status !== 'reveal') {
            q.status = 'reveal';
            if (q.dd && q.dd.pid) r.control = q.dd.pid;
            say(r, q.results.length ? 'Auflösung.' : pick(LINES.nobody));
          }
          break;
        case 'next':
          if (!q || q.status !== 'reveal') err = 'Erst auflösen';
          else {
            tile(r).used = true;
            r.q = null; r.phase = 'board';
            const left = r.board.reduce((s, c) => s + c.tiles.filter((t) => !t.used).length, 0);
            if (!left) say(r, 'Das Board ist leer. Zeit für das Finale!');
          }
          break;
        case 'dd': {
          const t = player(r, String(d.pid || ''));
          if (!q || !q.dd || q.status !== 'dd') err = 'Kein Daily Double offen';
          else if (!t) err = 'Spieler nicht gefunden';
          else { q.dd.pid = t.id; say(r, 'Daily Double für ' + t.name + '. Wie viel setzt du?'); }
          break;
        }
        case 'ddwager': // falls das Handy des Spielers streikt
          if (!q || !q.dd || q.status !== 'dd' || !q.dd.pid) err = 'Kein Daily Double offen';
          else err = setDdWager(r, Number(d.amount));
          break;
        case 'adjust': {
          const t = player(r, String(d.pid || '')), delta = Math.round(Number(d.delta));
          if (!t || !Number.isFinite(delta) || Math.abs(delta) > 5000) err = 'Ungültig';
          else { t.score += delta; say(r, 'Der Host korrigiert: ' + t.name + ' ' + (delta > 0 ? '+' : '') + delta + '.'); }
          break;
        }
        case 'kick': {
          const t = player(r, String(d.pid || ''));
          if (!t) err = 'Spieler nicht gefunden';
          else { removePlayer(r, t); say(r, t.name + ' wurde vom Host entfernt.'); }
          break;
        }
        case 'final':
          if (r.phase !== 'board') err = 'Das Finale startet vom Board aus';
          else startFinal(r);
          break;
        case 'finalnext': if (r.phase !== 'final') err = 'Kein Finale'; else err = finalNext(r); break;
        case 'finaljudge': if (r.phase !== 'final') err = 'Kein Finale'; else err = finalJudge(r, String(d.pid || ''), !!d.correct); break;
        case 'restart':
          if (r.phase !== 'end') err = 'Erst das Spiel beenden';
          else {
            r.round++;
            buildBoard(r);
            r.players.forEach((pl) => { pl.score = 0; pl.jokers = Object.fromEntries(JOKERS.map((j) => [j, true])); pl.stats = { right: 0, wrong: 0, early: 0, best: 0, buzzes: 0, jokers: 0, gained: 0 }; });
            r.phase = 'lobby'; r.q = null; r.fin = null; r.control = null;
            say(r, 'Revanche! Neue Runde, gleiche Gesichter.');
          }
          break;
        case 'close': closeRoom(r, 'Der Host hat das Spiel beendet'); return send(res, 200, { ok: true });
      }
    } else if (PLAYER_ACTIONS.has(action)) {
      if (who.role !== 'player') return send(res, 403, { error: 'Du spielst in diesem Spiel nicht mit' });
      const me = who.p, q = r.q;
      switch (action) {
        case 'buzz': {
          const out = buzz(r, me, d.ms);
          if (typeof out === 'string') err = out; else extra = out;
          break;
        }
        case 'joker': err = useJoker(r, me, String(d.type || ''), d.target); break;
        case 'wager': {
          const amt = Math.floor(Number(d.amount));
          if (r.phase === 'question' && q && q.dd && q.status === 'dd') {
            if (q.dd.pid !== me.id) err = 'Das Daily Double gehört ' + nameOf(r, q.dd.pid);
            else err = setDdWager(r, amt);
          } else if (r.phase === 'final' && r.fin.step === 'wager') {
            if (!r.fin.players.includes(me.id)) err = 'Ohne Punkte kein Finale';
            else if (!Number.isFinite(amt) || amt < 0 || amt > me.score) err = 'Einsatz zwischen 0 und ' + me.score;
            else r.fin.wagers[me.id] = amt;
          } else err = 'Gerade gibt es nichts zu setzen';
          break;
        }
        case 'answer':
          if (r.phase !== 'final' || r.fin.step !== 'answer' || Date.now() > r.fin.deadline + 1500) err = 'Die Zeit ist um';
          else if (!r.fin.players.includes(me.id)) err = 'Ohne Punkte kein Finale';
          else r.fin.answers[me.id] = clean(String(d.text || ''), 80);
          break;
        case 'leave': removePlayer(r, me); say(r, me.name + ' hat das Spiel verlassen.'); bump(r); return send(res, 200, { ok: true });
      }
    } else return send(res, 404, { error: 'Unbekannte Aktion' });

    if (err) return send(res, 400, { error: err });
    bump(r);
    return send(res, 200, Object.assign(view(r, who), extra ? { result: extra } : {}));
  }

  function setDdWager(r, amt) {
    const q = r.q, p = player(r, q.dd.pid);
    const max = Math.max(500, p.score);
    if (!Number.isFinite(amt) || amt < 5 || amt > max) return 'Einsatz zwischen 5 und ' + max;
    q.dd.wager = amt;
    q.status = 'reading';
    say(r, p.name + ' setzt ' + amt + '. Mutig.');
    return null;
  }
  function removePlayer(r, p) {
    r.players = r.players.filter((x) => x !== p);
    if (r.control === p.id) r.control = null;
    const q = r.q;
    if (q && r.phase === 'question') {
      if (q.buzzer === p.id) { q.buzzer = null; q.buzzes = []; q.status = 'open'; q.openedAt = Date.now(); }
      if (q.dd && q.dd.pid === p.id) { q.dd.pid = null; q.dd.wager = null; q.status = 'dd'; }
    }
    if (r.fin) {
      r.fin.players = r.fin.players.filter((id) => id !== p.id);
      if (r.fin.current === p.id) r.fin.current = r.fin.players.find((id) => !(id in r.fin.judged)) || null;
    }
  }

  return { handle };
};
