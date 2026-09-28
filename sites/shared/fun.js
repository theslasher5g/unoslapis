/* ============ Big H Universe – Shared Helpers ============ */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Basis-Domain aus dem aktuellen Host ableiten – ohne Liste der Subdomains:
  // dating.unoslapis.ch -> unoslapis.ch, dating.localhost -> localhost, IP bleibt IP
  const host = location.hostname;
  const parts = host.split('.');
  const rootHost = /^\d+(\.\d+){3}$/.test(host) ? host
    : parts[parts.length - 1] === 'localhost' ? 'localhost'
    : parts.length > 2 ? parts.slice(-2).join('.') : host;
  const port = location.port ? ':' + location.port : '';

  function link(sub) {
    return location.protocol + '//' + (sub ? sub + '.' : '') + rootHost + port + '/';
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ---------- Icons (Lucide, siehe /shared/icons.svg) ----------
  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="/shared/icons.svg#' + name + '"></use></svg>';
  }
  // <i data-icon="cake"></i> -> SVG-Icon
  function hydrateIcons(root) {
    (root || document).querySelectorAll('i[data-icon]').forEach((el) => {
      el.outerHTML = icon(el.dataset.icon, el.className);
    });
  }

  // ---------- Toasts (ruhig, ohne Emojis) ----------
  const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
  function stripEmoji(s) { return String(s).replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim(); }
  let toastBox;
  function toast(msg) {
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'toast-box';
      toastBox.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastBox);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = stripEmoji(msg);
    toastBox.appendChild(t);
    while (toastBox.children.length > 3) toastBox.firstChild.remove();
    setTimeout(() => t.remove(), 3600);
  }

  // ---------- Dezentes Konfetti (Formen statt Emojis) ----------
  const COLORS = ['#f43f5e', '#fbbf24', '#22d3ee', '#a78bfa', '#34d399'];
  function piece() {
    const p = document.createElement('span');
    p.className = 'particle';
    const w = rand(5, 9);
    p.style.width = w + 'px';
    p.style.height = (Math.random() < 0.5 ? w : w * 1.8) + 'px';
    p.style.background = pick(COLORS);
    p.style.borderRadius = Math.random() < 0.35 ? '50%' : '2px';
    return p;
  }
  // Das erste Argument (früher Emoji-Liste) wird ignoriert – Signatur bleibt kompatibel
  function burst(x, y, _unused, count) {
    if (reduced) return;
    const n = Math.min(count || 14, 14);
    for (let i = 0; i < n; i++) {
      const p = piece();
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      document.body.appendChild(p);
      const angle = rand(0, Math.PI * 2);
      const dist = rand(40, 120);
      const anim = p.animate([
        { transform: 'translate(-50%, -50%) rotate(0)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist + 40}px)) rotate(${rand(-270, 270)}deg)`, opacity: 0 }
      ], { duration: rand(600, 1000), easing: 'cubic-bezier(.2,.8,.3,1)' });
      anim.onfinish = () => p.remove();
    }
  }

  function confettiRain(_unused, count) {
    if (reduced) return;
    const n = Math.min(count || 60, 60);
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const p = piece();
        p.style.left = rand(0, 100) + 'vw';
        p.style.top = '-20px';
        document.body.appendChild(p);
        const anim = p.animate([
          { transform: 'translateY(0) rotate(0)', opacity: 1 },
          { transform: `translateY(calc(100vh + 40px)) translateX(${rand(-80, 80)}px) rotate(${rand(-540, 540)}deg)`, opacity: .9 }
        ], { duration: rand(2400, 3800), easing: 'cubic-bezier(.3,.5,.6,1)' });
        anim.onfinish = () => p.remove();
      }, i * 25);
    }
  }

  // Früher: fallende Emojis im Hintergrund. Bewusst abgeschaltet (zu unruhig).
  function emojiBackground() {}

  // ---------- Sound (ohne Dateien, per Web Audio, bewusst leise) ----------
  let audioCtx;
  function beep(freq, dur, type, vol) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq || 440;
      g.gain.setValueAtTime((vol || 0.05) * 0.5, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (dur || 0.15));
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + (dur || 0.15));
    } catch (e) { /* kein Audio – egal */ }
  }

  function gallop() {
    const h = document.createElement('div');
    h.className = 'gallop';
    h.textContent = '🐎';
    h.setAttribute('aria-hidden', 'true');
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 3100);
  }

  // ---------- Easter Eggs über Tastatur ----------
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let keyBuf = [];
  let typed = '';
  const WORDS = {
    goon: () => toast('Ertappt. Wir sehen dich, Goon-Lord.'),
    hengst: () => { gallop(); toast('HENGST DETECTED'); },
    stecher: () => toast('Der Stecher ist online.'),
    alastor: () => toast('Alastor Lapis hat den Raum betreten …'),
    unoslapis: () => toast('unoslapis ist jetzt online (Steam & Valorant)'),
    bigh: () => toast('All hail Big H'),
    nani: () => toast('NANI?!'),
    gg: () => toast('gg ez no re'),
    uwu: () => toast('OwO what\'s this?'),
    grass: () => toast('Gras? Nie davon gehört.')
  };

  document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    // Seiten mit eigener Tastatursteuerung (z.B. Wordle) können die Tipp-Eggs abschalten
    if (document.body.hasAttribute('data-no-eggs')) return;

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keyBuf = keyBuf.concat(key).slice(-KONAMI.length);
    if (keyBuf.join() === KONAMI.join()) {
      keyBuf = [];
      document.body.classList.toggle('bigh-mode');
      const on = document.body.classList.contains('bigh-mode');
      toast(on ? 'Big H Mode aktiviert' : 'Big H Mode deaktiviert');
      if (on) { confettiRain(null, 50); gallop(); }
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.15), i * 110));
    }

    if (e.key.length === 1) {
      typed = (typed + e.key.toLowerCase()).slice(-12);
      for (const w in WORDS) {
        if (typed.endsWith(w)) { WORDS[w](); typed = ''; break; }
      }
    }
  });

  // ---------- Auto-Setup ----------
  document.addEventListener('DOMContentLoaded', () => {
    hydrateIcons();

    // Links: <a data-sub="dating"> -> https://dating.domain/
    document.querySelectorAll('[data-sub]').forEach((a) => {
      a.href = link(a.dataset.sub);
    });

    // Zurück-Link auf Subdomains
    if (document.body.dataset.back !== undefined) {
      const b = document.createElement('a');
      b.className = 'bigh-back';
      b.href = link('');
      b.innerHTML = icon('arrow-left') + '<span>Übersicht</span>';
      document.body.appendChild(b);
    }

    birthdayTakeover();
  });

  // ---------- Geburtstags-Takeover: am 4. Oktober auf jeder Seite ----------
  // Testen: beliebige Seite mit ?bday=1 aufrufen
  function isBirthday() {
    const d = new Date();
    return (d.getMonth() === 9 && d.getDate() === 4) || new URLSearchParams(location.search).has('bday');
  }
  function birthdayTakeover() {
    if (!isBirthday() || document.body.hasAttribute('data-no-takeover')) return;
    const age = new Date().getFullYear() - 2002;
    const bar = document.createElement('a');
    bar.className = 'bday-bar';
    bar.href = link('karte');
    bar.innerHTML = icon('party-popper') + '<span>Heute wird Big H ' + age + '. <b>Unterschreib die Geburtstagskarte</b></span>' + icon('arrow-right');
    document.body.prepend(bar);
    document.body.classList.add('has-bday-bar');
    // Konfetti nur beim ersten Seitenaufruf pro Sitzung und Subdomain
    let seen = false;
    try { seen = sessionStorage.getItem('bigh-bday-confetti') === '1'; sessionStorage.setItem('bigh-bday-confetti', '1'); } catch (e) { /* egal */ }
    if (!seen) setTimeout(() => confettiRain(null, 50), 400);
  }

  console.log('%cBig H', 'font:700 40px system-ui;color:#f43f5e');
  console.log('%cWas machst du in der Konsole? Geh lieber Gras anfassen. (Tipp: ↑↑↓↓←→←→BA)', 'font-size:13px;color:#a1a1aa');

  window.BIGH = { link, toast, burst, confettiRain, emojiBackground, beep, gallop, rand, pick, reduced, icon, hydrateIcons, stripEmoji };
})();
