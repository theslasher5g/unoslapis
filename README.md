# 🐎 unoslapis.ch – Das Big H Universe

Eine Meme-Website für Big H. Hengst, Nerd, Weeb, Legende.

| Domain | Inhalt |
|---|---|
| `unoslapis.ch` | Dashboard: Glitch-Titel, Power-Level-Zähler (IT'S OVER 9000), Status-Ticker, Meme-Wall, „Nicht drücken"-Knopf |
| `dating.unoslapis.ch` | Kitschiger Liebesbrief. Der **Nein**-Knopf flieht vor Maus und Finger, der **Ja**-Knopf wird immer grösser. Am Ende gibt es eine Beziehungsurkunde. |
| `overwatch.unoslapis.ch` | Play-of-the-Game-Intro, Career Profile, Stats, Top Heroes, Clips, Voice-Line-Soundboard (Sprachausgabe), Patch Notes |
| `b-day.unoslapis.ch` | Countdown bis zum 4. Oktober, XP-Balken, Torte (Kerzen per Klick **oder Mikrofon** auspusten), Happy-Birthday-Melodie, Ballons, Wunschliste |
| `goon.unoslapis.ch` | FSK-18-Sperre, Steam „Library of Shame", Goon-Statistiken, Goon-o-Meter, **Panik-Knopf/ESC** (wechselt zu einer Fake-Excel-Tabelle) |

Easter Eggs auf allen Seiten: Konami-Code `↑ ↑ ↓ ↓ ← → ← → B A` (Big H Mode), oder einfach irgendwo `hengst`, `goon`, `nani`, `uwu`, `gg` tippen.

## Aufbau

```
Internet ──► Caddy (Port 80/443, automatisches HTTPS) ──► nginx (statische Seiten, Routing per Hostname)
```

```
docker-compose.yml
caddy/Caddyfile        # Reverse Proxy + Let's Encrypt
nginx/default.conf     # Hostname -> Ordner in sites/
sites/
  shared/              # style.css, fun.js, 404.html (gilt für alle Subdomains)
  dashboard/  dating/  overwatch/  b-day/  goon/
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

Alternativ ein Wildcard-Eintrag `A  *  <VPS-IP>` plus `A  @  <VPS-IP>`. Falls der VPS eine IPv6-Adresse hat, zusätzlich `AAAA`-Einträge anlegen. Prüfen kannst du das mit `dig +short dating.unoslapis.ch`.

### 2. Firewall

Die Ports **80/tcp**, **443/tcp** und **443/udp** müssen offen sein, z.B. mit ufw:

```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
```

Auf dem VPS darf kein anderer Dienst (Apache, nginx, Traefik …) die Ports 80/443 belegen. Prüfen mit `sudo ss -tlnp | grep -E ':80|:443'`.

### 3. Starten

```bash
git clone <repo-url> unoslapis && cd unoslapis
cp .env.example .env          # DOMAIN=unoslapis.ch
docker compose up -d
docker compose logs -f caddy  # sollte „certificate obtained successfully" zeigen
```

Caddy holt die HTTPS-Zertifikate beim ersten Aufruf automatisch. Das Volume `caddy_data` nicht löschen, sonst läuft man in die Rate-Limits von Let's Encrypt.

### Updates

Die Seiten sind nur read-only eingebunden. HTML ändern, `git pull`, fertig, ohne Neustart.
Nach Änderungen an `Caddyfile` oder `default.conf`: `docker compose restart`.

## Anpassen

Die Werte stehen jeweils oben im `<script>` unter `// ==== KONFIG ====`:

- **Overwatch** (`sites/overwatch/index.html`): Battletag, Rank, Stats, Heroes, Clips, Voice-Lines
- **Goon** (`sites/goon/index.html`): Liste `GAMES`, Spiele ergänzen, Stunden, Reviews
- **B-Day** (`sites/b-day/index.html`): `BIRTH_YEAR = 2004` setzen, dann werden Level und Kerzenzahl automatisch berechnet
- **Echte Meme-Bilder**: Bilder nach `sites/shared/memes/` kopieren und in `sites/dashboard/index.html` bei `MEME_IMAGES` eintragen, z.B. `['/shared/memes/bigh.jpg']`

### Neue Subdomain hinzufügen (z.B. `waifu`)

1. `caddy/Caddyfile`: `waifu.{$DOMAIN}` in die Liste eintragen
2. `nginx/default.conf`: in der `map` die Zeile `~^waifu\.  waifu;` ergänzen
3. `sites/waifu/index.html` anlegen (`/shared/style.css` und `/shared/fun.js` einbinden)
4. In `sites/shared/fun.js` `'waifu'` in `SUBS` aufnehmen
5. DNS-Eintrag anlegen, dann `docker compose restart`

## Lokal testen

```bash
DOMAIN=localhost docker compose up -d
# Chrome/Firefox: https://localhost, https://dating.localhost, ... (Zertifikatswarnung akzeptieren)
```
