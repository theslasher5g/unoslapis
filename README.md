# 🐎 unoslapis.ch – Das Big H Universe

Eine Meme-Website für Big H alias **Alastor Lapis** (Steam & Valorant: `unoslapis`). Stecher, Nerd, Goon-König, Legende.

| Domain | Inhalt |
|---|---|
| `unoslapis.ch` | Dashboard: Glitch-Titel, Power-Level-Zähler (IT'S OVER 9000), Status-Ticker, Meme-Wall, „Nicht drücken"-Knopf |
| `dating.unoslapis.ch` | Kitschiger Liebesbrief. Der **Nein**-Knopf flieht vor Maus und Finger, der **Ja**-Knopf wird immer grösser. Am Ende gibt es eine Beziehungsurkunde. |
| `overwatch.unoslapis.ch` | Play-of-the-Game-Intro, Career Profile, Stats, Top Heroes, Clips, Voice-Line-Soundboard (Sprachausgabe), Patch Notes |
| `b-day.unoslapis.ch` | Countdown bis zum 4. Oktober, XP-Balken, Torte (Kerzen per Klick **oder Mikrofon** auspusten), Happy-Birthday-Melodie, Ballons, Wunschliste |
| `goon.unoslapis.ch` | FSK-18-Sperre, Steam „Library of Shame", Goon-Statistiken, Goon-o-Meter, **Panik-Knopf/ESC** (wechselt zu einer Fake-Excel-Tabelle) |
| `news.unoslapis.ch` | **The Big'H Times**: Zeitung zum Umblättern (Eselsohr, Pfeiltasten, Wischen). Katze gerettet, Auto verschenkt, Jagd nach gothischen Schlechties, Rizz-Forschung, Sport, Horoskop, Kleinanzeigen |
| `girlfriend.unoslapis.ch` | Countdown bis zur ersten Freundin (Ziel: 25.09.2027). Läuft er ab, verlängert er sich automatisch um ein Jahr |
| `linkedin.unoslapis.ch` | „LinkedOut"-Profil: Alastor Lapis, Senior Goon Engineer. Cringe-Post, Skills zum Bestätigen, Empfehlungen |
| `nofap.unoslapis.ch` | NoFap-Tracker, der jeden Tag um 00:04 zurückspringt, dazu No-Nut-November-Archiv und Heatmap |
| `touchgrass.unoslapis.ch` | Tage seit dem letzten Grasskontakt, interaktive Wiese, „nach draussen schicken"-Animation |
| `waifu.unoslapis.ch` | Waifu-Tierliste mit Drag & Drop (oder antippen), seine „offizielle" Liste, als Text kopieren |
| `quotes.unoslapis.ch` | Hall of Fame seiner Zitate, Zitat des Tages, Filter, Motivationsposter-Modus |
| `guestbook.unoslapis.ch` | Gästebuch im 2003-Stil. Einträge werden **wirklich gespeichert** (eigenes Backend) |
| `excuses.unoslapis.ch` | Ausreden-Generator als Spielautomat (3 Situationen), Jackpot: „Ich muss baden gehen", Kopieren-Knopf |
| `horoskop.unoslapis.ch` | Astro-Lapis: tägliches Horoskop für alle 12 Sternzeichen, Big H (Waage) als Spezial, Partner-Check |
| `merch.unoslapis.ch` | Fake-Shop mit Warenkorb, Sale-Countdown und „Bestellung" (fragt nichts ab, verschickt nichts) |
| `discord.unoslapis.ch` | Nachgebauter Chat-Server mit Kanälen wie #baden-gehen und #goon-logs; man kann selbst schreiben und unoslapis antwortet |
| `wordle.unoslapis.ch` | unoslapis Wordle: Wort des Tages (für alle gleich) + Endlos-Modus, Statistik, Teilen als Emoji-Raster |
| `tinder.unoslapis.ch` | „Hinder"-Dating-Profil von Alastor: Karte wischen, Fotos durchtippen, Nope bringt nichts, bei Match antwortet er im Chat |

Easter Eggs auf allen Seiten: Konami-Code `↑ ↑ ↓ ↓ ← → ← → B A` (Big H Mode), oder einfach irgendwo `alastor`, `stecher`, `unoslapis`, `goon`, `nani`, `uwu`, `gg` (und ein geheimes Wort) tippen.

## Aufbau

```
Internet ──► Caddy (Port 80/443, automatisches HTTPS) ──► nginx      (alle Seiten, Routing per Hostname)
                                                     └──► guestbook  (nur guestbook.…/api/*, speichert JSON)
```

```
docker-compose.yml
caddy/Caddyfile        # Reverse Proxy + Let's Encrypt
guestbook/             # Gästebuch-Backend (Node, ohne Abhängigkeiten)
nginx/default.conf     # Hostname -> Ordner in sites/
sites/
  shared/              # style.css, fun.js, 404.html (gilt für alle Subdomains)
  dashboard/  dating/  overwatch/  b-day/  goon/  news/  girlfriend/
  linkedin/  nofap/  touchgrass/  waifu/  quotes/  guestbook/
  excuses/  horoskop/  merch/  discord/  wordle/  tinder/
```

## Deploy auf dem VPS

### 1. DNS-Einträge beim Domain-Anbieter

Alle Einträge zeigen auf die IP deines VPS:

| Typ | Name | Wert |
|---|---|---|
| A | `@` | `<VPS-IP>` |
| A | `www` | `<VPS-IP>` |
| A | `dating` | `<VPS-IP>` |
| A | `overwatch` | `<VPS-IP>` |
| A | `b-day` | `<VPS-IP>` |
| A | `goon` | `<VPS-IP>` |
| A | `news`, `girlfriend`, `linkedin`, `nofap`, `touchgrass`, `waifu`, `quotes`, `guestbook`, `excuses`, `horoskop`, `merch`, `discord`, `wordle`, `tinder` | `<VPS-IP>` (je ein Eintrag) |

**Einfacher:** ein Wildcard-Eintrag `A  *  <VPS-IP>` plus `A  @  <VPS-IP>`. Damit sind alle Subdomains inkl. `www` auf einmal erledigt.

> Solange eine Subdomain keinen DNS-Eintrag hat, schreibt Caddy Fehler wie `NXDOMAIN` ins Log und versucht es alle paar Minuten erneut (dabei gegen „acme-staging", das ist normal). Die anderen Subdomains funktionieren trotzdem. Falls der VPS eine IPv6-Adresse hat, zusätzlich `AAAA`-Einträge anlegen. Prüfen kannst du das mit `dig +short dating.unoslapis.ch`.

### 2. Firewall

Die Ports **80/tcp**, **443/tcp** und **443/udp** müssen offen sein, z.B. mit ufw:

```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
```

Auf dem VPS darf kein anderer Dienst (Apache, nginx, Traefik …) die Ports 80/443 belegen. Prüfen mit `sudo ss -tlnp | grep -E ':80|:443'`.

### 3. Starten

```bash
git clone <repo-url> unoslapis && cd unoslapis
cp .env.example .env          # DOMAIN=unoslapis.ch + GUESTBOOK_ADMIN_TOKEN setzen
docker compose up -d --build
docker compose logs -f caddy  # sollte „certificate obtained successfully" zeigen
```

Caddy holt die HTTPS-Zertifikate beim ersten Aufruf automatisch. Das Volume `caddy_data` nicht löschen, sonst läuft man in die Rate-Limits von Let's Encrypt.

### Updates

Die Seiten sind nur read-only eingebunden. HTML ändern, `git pull`, fertig, ohne Neustart.
Nach Änderungen an `Caddyfile` oder `default.conf`: `docker compose restart`.
Nach Änderungen am Gästebuch-Backend oder neuen Services: `docker compose up -d --build`.

### Gästebuch moderieren

1. In `.env` ein geheimes `GUESTBOOK_ADMIN_TOKEN` setzen (z.B. `openssl rand -hex 24`) und `docker compose up -d`.
2. `https://guestbook.unoslapis.ch/#admin` öffnen. Neben jedem Eintrag erscheint 🗑️, beim ersten Löschen wird nach dem Token gefragt.

Schutz eingebaut: max. 3 Einträge pro 10 Minuten pro IP, Honeypot gegen Bots, max. 500 Zeichen. Die Einträge liegen im Docker-Volume `guestbook_data` (bleiben bei Neustarts und Updates erhalten). Backup: `docker compose cp guestbook:/data/entries.json ./backup.json`.

## Anpassen

Die Werte stehen jeweils oben im `<script>` unter `// ==== KONFIG ====`:

- **Overwatch** (`sites/overwatch/index.html`): Battletag, Rank, Stats, Heroes, Clips, Voice-Lines
- **Goon** (`sites/goon/index.html`): Liste `GAMES`, Spiele ergänzen, Stunden, Reviews
- **B-Day** (`sites/b-day/index.html`): `BIRTH_YEAR` (steht auf 2002) → Level und Kerzenzahl werden automatisch berechnet
- **Girlfriend** (`sites/girlfriend/index.html`): `TARGET` (Zieldatum), `ROADMAP`, `TIPS`
- **Quotes** (`sites/quotes/index.html`): Liste `QUOTES`, hier seine **echten** Sprüche eintragen
- **Touchgrass** (`sites/touchgrass/index.html`): `LAST_TOUCH` (letzter Grasskontakt)
- **Waifu** (`sites/waifu/index.html`): `CHARS` und seine Liste `PRESET`
- **Excuses** (`sites/excuses/index.html`): `CATS` (Ausreden je Situation), `HOF`
- **Merch** (`sites/merch/index.html`): `PRODUCTS`
- **Discord** (`sites/discord/index.html`): `USERS`, `CHANNELS` (Nachrichten), `REPLIES` (Antworten des Bots)
- **Wordle** (`sites/wordle/index.html`): Liste `WORDS` (5 Buchstaben A–Z + Erklärung)
- **Tinder** (`sites/tinder/index.html`): `PHOTOS`, `REPLIES`, Profiltexte direkt im HTML
- **News** (`sites/news/index.html`): Artikel direkt im HTML; eine neue Seite = ein weiteres `<article class="page">`
- **Echte Meme-Bilder**: Bilder nach `sites/shared/memes/` kopieren und in `sites/dashboard/index.html` bei `MEME_IMAGES` eintragen, z.B. `['/shared/memes/bigh.jpg']`

### Neue Subdomain hinzufügen (z.B. `memes`)

1. `caddy/Caddyfile`: `memes.{$DOMAIN}` in die Liste eintragen
2. `nginx/default.conf`: in der `map` die Zeile `~^memes\.  memes;` ergänzen
3. `sites/memes/index.html` anlegen (`/shared/style.css` und `/shared/fun.js` einbinden)
4. DNS-Eintrag anlegen (oder Wildcard `*`), dann `docker compose restart`

## Lokal testen

```bash
DOMAIN=localhost docker compose up -d
# Chrome/Firefox: https://localhost, https://dating.localhost, ... (Zertifikatswarnung akzeptieren)
```
