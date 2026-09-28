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
  // ---------- Ton: alles live synthetisiert, global abschaltbar ----------
  let soundOn = true;
  try { soundOn = localStorage.getItem('bigh-sound') !== 'off'; } catch (e) { /* egal */ }
  function ctx() {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, at, dur, type, vol, glide) {
    const c = ctx(), t = c.currentTime + (at || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(at, dur, vol, filter, f1, f2) {
    const c = ctx(), t = c.currentTime + (at || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = filter || 'bandpass';
    f.frequency.setValueAtTime(f1 || 2000, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t); src.stop(t + dur + 0.02);
  }
  const SFX = {
    click: () => tone(1100, 0, 0.04, 'triangle', 0.025),
    tick: () => tone(1700, 0, 0.018, 'square', 0.012),
    coin: () => { tone(988, 0, 0.08, 'square', 0.025); tone(1319, 0.07, 0.22, 'square', 0.025); },
    chip: () => { noise(0, 0.05, 0.08, 'highpass', 3000); tone(2400, 0, 0.03, 'triangle', 0.02); },
    card: () => noise(0, 0.07, 0.09, 'bandpass', 2500, 1200),
    flip: () => { noise(0, 0.1, 0.07, 'bandpass', 1500, 4000); tone(620, 0.02, 0.08, 'triangle', 0.02); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.045)),
    bigwin: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.08, 0.3, 'triangle', 0.045)); for (let i = 0; i < 8; i++) tone(2000 + Math.random() * 2000, 0.5 + i * 0.06, 0.12, 'sine', 0.015); },
    lose: () => { tone(330, 0, 0.25, 'sawtooth', 0.02, 220); tone(262, 0.2, 0.35, 'sawtooth', 0.02, 165); },
    rip: () => noise(0, 0.45, 0.12, 'bandpass', 800, 5000),
    shine: () => { for (let i = 0; i < 10; i++) tone(1800 + Math.random() * 2400, i * 0.05, 0.15, 'sine', 0.018); },
    whoosh: () => noise(0, 0.5, 0.08, 'lowpass', 300, 3000),
    tadum: () => { tone(98, 0, 0.35, 'sine', 0.2); noise(0, 0.18, 0.06, 'lowpass', 400); tone(73.4, 0.42, 1.6, 'sine', 0.22); tone(146.8, 0.42, 1.4, 'triangle', 0.05); tone(110, 0.42, 1.5, 'sine', 0.08); },
    jingle: () => [659, 784, 988, 784, 1319].forEach((f, i) => tone(f, i * 0.11, 0.2, 'triangle', 0.04))
  };
  function sfx(name) {
    if (!soundOn || !SFX[name]) return;
    try { SFX[name](); } catch (e) { /* kein Audio – egal */ }
  }
  function renderSoundButtons() {
    document.querySelectorAll('.bigh-sound').forEach((b) => {
      b.innerHTML = icon(soundOn ? 'volume-2' : 'volume-x');
      b.setAttribute('aria-label', soundOn ? 'Ton aus' : 'Ton an');
      b.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    });
  }
  function setSound(on) {
    soundOn = on;
    try { localStorage.setItem('bigh-sound', on ? 'on' : 'off'); } catch (e) { /* egal */ }
    renderSoundButtons();
    if (on) sfx('jingle');
    document.dispatchEvent(new CustomEvent('bigh-sound', { detail: on }));
  }

  function beep(freq, dur, type, vol) {
    if (!soundOn) return;
    try {
      ctx();
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

    if (!document.body.hasAttribute('data-no-sound-toggle')) {
      const sb = document.createElement('button');
      sb.type = 'button';
      sb.className = 'bigh-sound';
      sb.title = 'Ton an/aus';
      sb.addEventListener('click', () => setSound(!soundOn));
      document.body.appendChild(sb);
      renderSoundButtons();
    }
    // Leiser Klick auf Knöpfen
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.btn, .chip, .tabs a, .seg button');
      if (b && !b.disabled) sfx('click');
    }, true);
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

  window.BIGH = { link, toast, burst, confettiRain, emojiBackground, beep, sfx, setSound, get soundOn() { return soundOn; }, gallop, rand, pick, reduced, icon, hydrateIcons, stripEmoji };
})();
