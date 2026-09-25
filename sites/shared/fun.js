/* ============ Big H Universe – Shared Fun ============ */
(function () {
  'use strict';

  const SUBS = ['www', 'dating', 'overwatch', 'b-day', 'goon'];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Basis-Domain aus aktuellem Host ableiten (funktioniert auch lokal mit *.localhost)
  const parts = location.hostname.split('.');
  const rootHost = SUBS.includes(parts[0]) && parts.length > 1 ? parts.slice(1).join('.') : location.hostname;
  const port = location.port ? ':' + location.port : '';

  function link(sub) {
    return location.protocol + '//' + (sub ? sub + '.' : '') + rootHost + port + '/';
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ---------- Toasts ----------
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
    t.textContent = msg;
    toastBox.appendChild(t);
    setTimeout(() => t.remove(), 3700);
  }

  // ---------- Partikel / Konfetti ----------
  function burst(x, y, emojis, count) {
    if (reduced) return;
    emojis = emojis || ['🎉', '✨', '💥', '⭐', '🔥'];
    count = count || 24;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.textContent = pick(emojis);
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.fontSize = rand(16, 34) + 'px';
      document.body.appendChild(p);
      const angle = rand(0, Math.PI * 2);
      const dist = rand(80, 260);
      const anim = p.animate([
        { transform: 'translate(-50%, -50%) scale(.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist + 120}px)) rotate(${rand(-360, 360)}deg) scale(1)`, opacity: 0 }
      ], { duration: rand(900, 1600), easing: 'cubic-bezier(.2,.8,.3,1)' });
      anim.onfinish = () => p.remove();
    }
  }

  function confettiRain(emojis, count) {
    if (reduced) return;
    count = count || 80;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const p = document.createElement('span');
        p.className = 'particle';
        p.textContent = pick(emojis || ['🎉', '🎊', '✨', '🥳']);
        p.style.left = rand(0, 100) + 'vw';
        p.style.top = '-50px';
        p.style.fontSize = rand(18, 36) + 'px';
        document.body.appendChild(p);
        const anim = p.animate([
          { transform: 'translateY(0) rotate(0)' },
          { transform: `translateY(calc(100vh + 100px)) translateX(${rand(-120, 120)}px) rotate(${rand(-720, 720)}deg)` }
        ], { duration: rand(2200, 4200), easing: 'linear' });
        anim.onfinish = () => p.remove();
      }, i * 35);
    }
  }

  // ---------- Fallende Hintergrund-Emojis ----------
  function emojiBackground(emojis, everyMs) {
    if (reduced) return;
    setInterval(() => {
      if (document.hidden) return;
      const e = document.createElement('span');
      e.className = 'bg-emoji';
      e.textContent = pick(emojis);
      e.style.left = rand(0, 100) + 'vw';
      e.style.fontSize = rand(18, 42) + 'px';
      e.style.setProperty('--rot', rand(-540, 540) + 'deg');
      const dur = rand(7, 14);
      e.style.animationDuration = dur + 's';
      document.body.appendChild(e);
      setTimeout(() => e.remove(), dur * 1000 + 200);
    }, everyMs || 900);
  }

  // ---------- Sound (ohne Dateien, per Web Audio) ----------
  let audioCtx;
  function beep(freq, dur, type, vol) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq || 440;
      g.gain.setValueAtTime(vol || 0.05, audioCtx.currentTime);
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
    goon: () => toast('👀 Ertappt. Wir sehen dich, Goon-Lord.'),
    hengst: () => { gallop(); toast('🐎 HENGST DETECTED'); },
    bigh: () => toast('👑 All hail Big H'),
    nani: () => toast('NANI?!?! 😱'),
    gg: () => toast('gg ez no re 😎'),
    uwu: () => toast('OwO what\'s this? 🐾'),
    grass: () => toast('🌱 Gras? Nie davon gehört.')
  };

  document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keyBuf = keyBuf.concat(key).slice(-KONAMI.length);
    if (keyBuf.join() === KONAMI.join()) {
      keyBuf = [];
      document.body.classList.toggle('bigh-mode');
      const on = document.body.classList.contains('bigh-mode');
      toast(on ? '🌈 BIG H MODE AKTIVIERT' : 'Big H Mode deaktiviert 😔');
      if (on) { confettiRain(['🐎', '👑', '💯', '🔥', 'H'], 60); gallop(); }
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
    // Links: <a data-sub="dating"> -> https://dating.domain/
    document.querySelectorAll('[data-sub]').forEach((a) => {
      a.href = link(a.dataset.sub);
    });

    // Zurück-Button auf Subdomains
    if (document.body.dataset.back !== undefined) {
      const b = document.createElement('a');
      b.className = 'bigh-back';
      b.href = link('');
      b.textContent = '← Big H HQ';
      document.body.appendChild(b);
    }
  });

  console.log('%cBIG H', 'font:900 60px Impact;color:#ff3e9a;text-shadow:3px 3px #2de2e6');
  console.log('%cWas machst du in der Konsole? Geh lieber Gras anfassen. (Tipp: ↑↑↓↓←→←→BA)', 'font-size:14px;color:#ffd23f');

  window.BIGH = { link, toast, burst, confettiRain, emojiBackground, beep, gallop, rand, pick, reduced };
})();
