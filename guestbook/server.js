// Mini-Backend für guestbook.unoslapis.ch und bewertungen.unoslapis.ch – ohne Abhängigkeiten.
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
function rateLimited(key) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(key, list); return true; }
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

    const v = c.validate(data);
    if (v.error) return send(res, 400, { error: v.error });
    if (rateLimited(name + '|' + clientIp(req))) return send(res, 429, { error: c.rateMsg });

    const item = Object.assign({ id: crypto.randomBytes(6).toString('hex') }, v, { ts: Date.now() });
    c.items.unshift(item);
    const cut = c.items.length > MAX_ITEMS ? c.items.splice(MAX_ITEMS) : [];
    try { save(c); } catch (e) {
      c.items.shift();
      c.items.push(...cut);
      console.error('Speichern fehlgeschlagen:', e.message);
      return send(res, 500, { error: 'Speichern fehlgeschlagen' });
    }
    // Antwort-Schlüssel wie bisher: "entry" fürs Gästebuch, "review" für Bewertungen
    return send(res, 201, { [name === 'entries' ? 'entry' : 'review']: item });
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

  const m = p.match(/^\/api\/(entries|reviews)(?:\/([a-f0-9]{12}))?$/);
  if (m) {
    const c = COLLECTIONS[m[1]];
    if (!m[2] && req.method === 'GET') return send(res, 200, c.list(c.items));
    if (!m[2] && req.method === 'POST') return handlePost(req, res, m[1], c);
    if (m[2] && req.method === 'DELETE') return handleDelete(req, res, c, m[2]);
  }

  send(res, 404, { error: 'Nicht gefunden' });
});

server.listen(PORT, () => console.log('Backend läuft auf Port ' + PORT + ' – ' +
  COLLECTIONS.entries.items.length + ' Gästebuch-Einträge, ' + COLLECTIONS.reviews.items.length + ' Bewertungen'));
