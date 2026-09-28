// Mini-Backend für guestbook., bewertungen., karte. und wordle.unoslapis.ch – ohne Abhängigkeiten.
//
// Gästebuch:
//   GET    /api/entries          -> neueste Einträge
//   POST   /api/entries          -> neuer Eintrag {name, message, emoji}
//   DELETE /api/entries/:id      -> Eintrag löschen (Header: Authorization: Bearer <ADMIN_TOKEN>)
// Bewertungen:
//   GET    /api/reviews          -> neueste Bewertungen + Durchschnitt + Sterne-Verteilung
//   POST   /api/reviews          -> neue Bewertung {name, stars (1–5), message, tag}
//   DELETE /api/reviews/:id      -> Bewertung löschen (Header: Authorization: Bearer <ADMIN_TOKEN>)
//
// Geburtstagskarte:
//   GET    /api/cards            -> Unterschriften
//   POST   /api/cards            -> neue Unterschrift {name, message, color}
//   DELETE /api/cards/:id
// Wordle-Rangliste:
//   GET    /api/wordle?day=N     -> Ergebnisse von Tag N + Allzeit-Rangliste
//   POST   /api/wordle           -> Ergebnis {name, day, grid} (grid: Zeilen aus o/n/x, getrennt mit "-")
//   DELETE /api/wordle/:id
//
//   GET    /api/health           -> Healthcheck
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = process.env.DATA_FILE || './entries.json';
const DATA_DIR = path.dirname(DATA_FILE);
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_ITEMS = 2000;
const MAX_BODY = 4096;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 3;

const EMOJIS = ['🐎', '👑', '🥵', '💀', '😂', '🎮', '🍜', '💜', '🔥', '🌱', '🎂', '🗡️'];
const CARD_COLORS = ['rose', 'amber', 'violet', 'cyan', 'green', 'blue'];
// Wordle: Tag 1 = 25.09.2026 (wie im Frontend). Clients in anderen Zeitzonen dürfen ±1 Tag abweichen.
const WORDLE_START = Date.UTC(2026, 8, 25);
function wordleDay() { return Math.floor((Date.now() - WORDLE_START) / 86400000) + 1; }
const nameKey = (n) => n.toLowerCase().replace(/\s+/g, ' ').trim();
const TAGS = ['Dating', 'Gaming', 'Geburtstag', 'Ausrede gehört', 'Zufällig vorbei', 'Katze gerettet'];

function clean(str, max) {
  if (typeof str !== 'string') return '';
  // Steuer- und unsichtbare Richtungszeichen raus (Zeilenumbrüche erlaubt), Leerzeilen begrenzen
  return str.replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

// ---------- Sammlungen ----------
// validate(data) liefert entweder { error } oder das zu speichernde Objekt (ohne id/ts)
const COLLECTIONS = {
  entries: {
    file: DATA_FILE,
    rateMsg: 'Zu viele Einträge. Warte ein paar Minuten (oder fass Gras an).',
    validate(data) {
      const name = clean(data.name, 30).replace(/\s+/g, ' ');
      const message = clean(data.message, 500);
      const emoji = EMOJIS.includes(data.emoji) ? data.emoji : EMOJIS[0];
      if (name.length < 1) return { error: 'Name fehlt' };
      if (message.length < 2) return { error: 'Nachricht ist zu kurz' };
      return { name, message, emoji };
    },
    list(items) {
      return { entries: items.slice(0, 300), total: items.length };
    }
  },
  reviews: {
    file: path.join(DATA_DIR, 'reviews.json'),
    rateMsg: 'Zu viele Bewertungen. Warte ein paar Minuten (oder geh baden).',
    validate(data) {
      const name = clean(data.name, 30).replace(/\s+/g, ' ');
      const message = clean(data.message, 600);
      const stars = Number(data.stars);
      const tag = TAGS.includes(data.tag) ? data.tag : '';
      if (name.length < 1) return { error: 'Name fehlt' };
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { error: 'Bitte 1 bis 5 Sterne wählen' };
      if (message.length < 2) return { error: 'Bewertung ist zu kurz' };
      return { name, stars, message, tag };
    },
    list(items) {
      const dist = [0, 0, 0, 0, 0];
      let sum = 0;
      for (const r of items) { dist[r.stars - 1]++; sum += r.stars; }
      return {
        reviews: items.slice(0, 300),
        total: items.length,
        average: items.length ? Math.round(sum / items.length * 10) / 10 : 0,
        distribution: dist // Index 0 = 1 Stern … Index 4 = 5 Sterne
      };
    }
  },
  cards: {
    file: path.join(DATA_DIR, 'cards.json'),
    rateMax: 20, // viele Kollegen teilen sich im Büro eine IP
    rateMsg: 'Du hast schon unterschrieben. Warte ein paar Minuten.',
    validate(data) {
      const name = clean(data.name, 30).replace(/\s+/g, ' ');
      const message = clean(data.message, 280);
      const color = CARD_COLORS.includes(data.color) ? data.color : CARD_COLORS[0];
      if (name.length < 1) return { error: 'Name fehlt' };
      if (message.length < 2) return { error: 'Glückwunsch ist zu kurz' };
      return { name, message, color };
    },
    list(items) {
      return { cards: items.slice(0, 300), total: items.length };
    }
  },
  wordle: {
    file: path.join(DATA_DIR, 'wordle.json'),
    max: 50000,
    rateMax: 20,
    rateMsg: 'Zu viele Einträge. Warte ein paar Minuten.',
    validate(data, items) {
      const name = clean(data.name, 20).replace(/\s+/g, ' ');
      const day = Number(data.day);
      const grid = typeof data.grid === 'string' ? data.grid : '';
      if (name.length < 1) return { error: 'Name fehlt' };
      const today = wordleDay();
      if (!Number.isInteger(day) || day < 1 || Math.abs(day - today) > 1) return { error: 'Das ist nicht das Wort des Tages' };
      // Raster prüfen: 1–6 Zeilen à 5 Felder, gewonnen = letzte Zeile komplett grün, davor keine
      const rows = grid.split('-');
      if (!rows.length || rows.length > 6 || !rows.every((r) => /^[onx]{5}$/.test(r))) return { error: 'Ungültiges Ergebnis' };
      const winAt = rows.findIndex((r) => r === 'ooooo');
      const won = winAt !== -1;
      if (won && winAt !== rows.length - 1) return { error: 'Ungültiges Ergebnis' };
      if (!won && rows.length !== 6) return { error: 'Ungültiges Ergebnis' };
      if (items.some((e) => e.day === day && nameKey(e.name) === nameKey(name))) return { error: 'Dieser Name steht für heute schon in der Rangliste', status: 409 };
      return { name, day, tries: won ? rows.length : 0, grid: rows.join('-') };
    },
    list(items, query) {
      const day = Number(query.get('day')) || wordleDay();
      const byRank = (a, b) => (a.tries || 7) - (b.tries || 7) || a.ts - b.ts;
      const todays = items.filter((e) => e.day === day).sort(byRank).slice(0, 200);
      // Allzeit: Punkte = 7 − Versuche (1 Versuch = 6 Punkte, verloren = 0)
      const agg = new Map();
      for (const e of items) {
        const k = nameKey(e.name);
        const a = agg.get(k) || { name: e.name, played: 0, wins: 0, points: 0, triesSum: 0 };
        a.played++;
        if (e.tries) { a.wins++; a.points += 7 - e.tries; a.triesSum += e.tries; }
        agg.set(k, a);
      }
      const allTime = [...agg.values()]
        .map((a) => ({ name: a.name, played: a.played, wins: a.wins, points: a.points, avg: a.wins ? Math.round(a.triesSum / a.wins * 100) / 100 : null }))
        .sort((a, b) => b.points - a.points || (a.avg || 9) - (b.avg || 9) || b.played - a.played)
        .slice(0, 100);
      return { day, today: wordleDay(), results: todays, total: todays.length, players: agg.size, allTime };
    }
  }
};

for (const c of Object.values(COLLECTIONS)) {
  try {
    c.items = JSON.parse(fs.readFileSync(c.file, 'utf8'));
    if (!Array.isArray(c.items)) c.items = [];
  } catch (e) {
    c.items = [];
  }
}

function save(c) {
  const tmp = c.file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(c.items));
  fs.renameSync(tmp, c.file);
}

// ---------- Rate-Limit pro IP und Sammlung (nur im Speicher, IPs werden nicht gespeichert) ----------
const hits = new Map();
function rateLimited(key, max) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= (max || RATE_MAX)) { hits.set(key, list); return true; }
  list.push(now);
  hits.set(key, list);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, list] of hits) if (list.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(key);
}, RATE_WINDOW_MS).unref();

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(data)
  });
  res.end(data);
}

function clientIp(req) {
  // Caddy setzt X-Forwarded-For; der Container ist nur über Caddy erreichbar.
  const xff = req.headers['x-forwarded-for'];
  return (xff ? String(xff).split(',')[0] : req.socket.remoteAddress || '').trim();
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function handlePost(req, res, name, c) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    return send(res, 415, { error: 'JSON erwartet' });
  }
  let body = '';
  let tooBig = false;
  req.on('data', (chunk) => {
    if (tooBig) return;
    body += chunk;
    if (body.length > MAX_BODY) { tooBig = true; send(res, 413, { error: 'Nachricht zu lang' }); }
  });
  req.on('end', () => {
    if (tooBig) return;
    let data;
    try { data = JSON.parse(body); } catch (e) { return send(res, 400, { error: 'Ungültiges JSON' }); }
    if (!data || typeof data !== 'object') return send(res, 400, { error: 'Ungültige Daten' });

    // Honeypot: Bots füllen das versteckte Feld aus
    if (data.website) return send(res, 201, { ok: true });

    const v = c.validate(data, c.items);
    if (v.error) return send(res, v.status || 400, { error: v.error });
    if (rateLimited(name + '|' + clientIp(req), c.rateMax)) return send(res, 429, { error: c.rateMsg });

    const item = Object.assign({ id: crypto.randomBytes(6).toString('hex') }, v, { ts: Date.now() });
    c.items.unshift(item);
    const max = c.max || MAX_ITEMS;
    const cut = c.items.length > max ? c.items.splice(max) : [];
    try { save(c); } catch (e) {
      c.items.shift();
      c.items.push(...cut);
      console.error('Speichern fehlgeschlagen:', e.message);
      return send(res, 500, { error: 'Speichern fehlgeschlagen' });
    }
    // Antwort-Schlüssel: "entry" fürs Gästebuch, "review" für Bewertungen, "card" für die Karte
    const KEY = { entries: 'entry', reviews: 'review', cards: 'card', wordle: 'result' };
    return send(res, 201, { [KEY[name]]: item });
  });
}

function handleDelete(req, res, c, id) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!ADMIN_TOKEN || !token || !safeEqual(token, ADMIN_TOKEN)) return send(res, 401, { error: 'Nicht erlaubt' });
  const i = c.items.findIndex((e) => e.id === id);
  if (i === -1) return send(res, 404, { error: 'Nicht gefunden' });
  const [removed] = c.items.splice(i, 1);
  try { save(c); } catch (e) {
    c.items.splice(i, 0, removed);
    return send(res, 500, { error: 'Speichern fehlgeschlagen' });
  }
  return send(res, 200, { ok: true });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname.replace(/\/+$/, '');

  if (req.method === 'GET' && p === '/api/health') return send(res, 200, { ok: true });

  const m = p.match(/^\/api\/(entries|reviews|cards|wordle)(?:\/([a-f0-9]{12}))?$/);
  if (m) {
    const c = COLLECTIONS[m[1]];
    if (!m[2] && req.method === 'GET') return send(res, 200, c.list(c.items, url.searchParams));
    if (!m[2] && req.method === 'POST') return handlePost(req, res, m[1], c);
    if (m[2] && req.method === 'DELETE') return handleDelete(req, res, c, m[2]);
  }

  send(res, 404, { error: 'Nicht gefunden' });
});

server.listen(PORT, () => console.log('Backend läuft auf Port ' + PORT + ' – ' +
  COLLECTIONS.entries.items.length + ' Gästebuch-Einträge, ' + COLLECTIONS.reviews.items.length + ' Bewertungen, ' + COLLECTIONS.cards.items.length + ' Karten-Grüsse, ' + COLLECTIONS.wordle.items.length + ' Wordle-Ergebnisse'));
