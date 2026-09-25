// Gästebuch-Backend für guestbook.unoslapis.ch – ohne Abhängigkeiten.
// GET    /api/entries        -> neueste Einträge
// POST   /api/entries        -> neuer Eintrag {name, message, emoji}
// DELETE /api/entries/:id    -> Eintrag löschen (Header: Authorization: Bearer <ADMIN_TOKEN>)
// GET    /api/health         -> Healthcheck
'use strict';

const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

const DATA_FILE = process.env.DATA_FILE || './entries.json';
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_ENTRIES = 2000;
const MAX_BODY = 4096;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 3;
const EMOJIS = ['🐎', '👑', '🥵', '💀', '😂', '🎮', '🍜', '💜', '🔥', '🌱', '🎂', '🗡️'];

let entries = [];
try {
  entries = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(entries)) entries = [];
} catch (e) {
  entries = [];
}

function save() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(entries));
  fs.renameSync(tmp, DATA_FILE);
}

// Einfaches Rate-Limit pro IP (nur im Speicher, IPs werden nicht gespeichert)
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (list.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(ip);
}, RATE_WINDOW_MS).unref();

function clean(str, max) {
  if (typeof str !== 'string') return '';
  // Steuerzeichen raus (Zeilenumbrüche im Text erlaubt), Whitespace zusammenfassen
  return str.replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '');

  if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true });

  if (req.method === 'GET' && path === '/api/entries') {
    return send(res, 200, { entries: entries.slice(0, 300), total: entries.length });
  }

  if (req.method === 'POST' && path === '/api/entries') {
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

      const name = clean(data.name, 30).replace(/\s+/g, ' ');
      const message = clean(data.message, 500);
      const emoji = EMOJIS.includes(data.emoji) ? data.emoji : EMOJIS[0];
      if (name.length < 1) return send(res, 400, { error: 'Name fehlt' });
      if (message.length < 2) return send(res, 400, { error: 'Nachricht ist zu kurz' });
      if (rateLimited(clientIp(req))) {
        return send(res, 429, { error: 'Zu viele Einträge. Warte ein paar Minuten (oder fass Gras an).' });
      }

      const entry = { id: crypto.randomBytes(6).toString('hex'), name, message, emoji, ts: Date.now() };
      entries.unshift(entry);
      if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
      try { save(); } catch (e) {
        entries.shift();
        console.error('Speichern fehlgeschlagen:', e.message);
        return send(res, 500, { error: 'Speichern fehlgeschlagen' });
      }
      return send(res, 201, { entry });
    });
    return;
  }

  const del = path.match(/^\/api\/entries\/([a-f0-9]{12})$/);
  if (req.method === 'DELETE' && del) {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!ADMIN_TOKEN || !token || !safeEqual(token, ADMIN_TOKEN)) return send(res, 401, { error: 'Nicht erlaubt' });
    const i = entries.findIndex((e) => e.id === del[1]);
    if (i === -1) return send(res, 404, { error: 'Nicht gefunden' });
    const [removed] = entries.splice(i, 1);
    try { save(); } catch (e) {
      entries.splice(i, 0, removed);
      return send(res, 500, { error: 'Speichern fehlgeschlagen' });
    }
    return send(res, 200, { ok: true });
  }

  send(res, 404, { error: 'Nicht gefunden' });
});

server.listen(PORT, () => console.log('Gästebuch läuft auf Port ' + PORT + ' – ' + entries.length + ' Einträge'));
