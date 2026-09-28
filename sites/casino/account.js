// Gemeinsames Konto für Casino und Booster-Packs (casino.unoslapis.ch und /packs/).
// Das Guthaben liegt auf dem Server; hier wird nur der geheime Konto-Schlüssel im Browser gemerkt.
(function () {
  'use strict';
  const KEY = 'bigh-casino-token';
  let token = null;
  try { token = localStorage.getItem(KEY); } catch (e) { token = null; }
  let me = null;
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(me); } catch (e) { console.error(e); } });

  function saveToken(t) {
    token = t;
    try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch (e) { /* egal */ }
  }

  async function api(method, path, body) {
    let r;
    try {
      r = await fetch('/api/casino' + path, {
        method,
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'X-Player': token } : {}),
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store'
      });
    } catch (e) { const err = new Error('Casino-Server nicht erreichbar'); err.status = 0; throw err; }
    let d = {};
    try { d = await r.json(); } catch (e) { d = {}; }
    if (r.status === 401 && token && path !== '/me') { saveToken(null); me = null; emit(); join(); }
    if (!r.ok) { const err = new Error(d.error || 'Fehler ' + r.status); err.status = r.status; err.data = d; throw err; }
    return d;
  }
  function update(patch) {
    if (!me) return;
    Object.assign(me, patch);
    emit();
  }

  // ---------- Anmelde-Dialog ----------
  const css = document.createElement('style');
  css.textContent = `
    .acc-bg { position: fixed; inset: 0; z-index: 95; background: rgba(5,5,8,.78); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; padding: 16px; }
    .acc { width: min(420px, 100%); background: #141418; border: 1px solid rgba(255,255,255,.1); border-radius: 22px; padding: 26px; color: #ececef; box-shadow: 0 30px 80px rgba(0,0,0,.5); }
    .acc h2 { font: 700 1.5rem/1.15 'Space Grotesk', sans-serif; margin: 0 0 6px; letter-spacing: -.02em; }
    .acc p { color: #9b9ba7; margin: 0 0 16px; font-size: .92rem; line-height: 1.5; }
    .acc form { display: flex; gap: 8px; }
    .acc input { flex: 1; min-width: 0; background: #0a0a0c; border: 1px solid rgba(255,255,255,.16); border-radius: 12px; padding: 11px 13px; color: #fff; font: 500 1rem Inter, sans-serif; outline: none; }
    .acc input:focus { border-color: #e3b341; }
    .acc button.go { border: 0; border-radius: 12px; padding: 0 16px; background: #e3b341; color: #1a1405; font: 700 .95rem Inter, sans-serif; cursor: pointer; }
    .acc .msg { min-height: 1.3em; margin-top: 8px; font-size: .85rem; color: #fb7185; }
    .acc .alt { background: none; border: 0; color: #9b9ba7; font: 500 .82rem Inter, sans-serif; text-decoration: underline; cursor: pointer; padding: 0; margin-top: 12px; }
    .acc .perks { display: grid; gap: 6px; margin: 0 0 16px; padding: 0; list-style: none; font-size: .88rem; color: #cfcfd6; }
    .acc .perks li::before { content: '·'; color: #e3b341; font-weight: 700; margin-right: 8px; }
  `;
  document.head.appendChild(css);

  let joining = null;
  function join() {
    if (joining) return joining;
    joining = new Promise((resolve) => {
      const bg = document.createElement('div');
      bg.className = 'acc-bg';
      bg.innerHTML = `<div class="acc" role="dialog" aria-modal="true" aria-labelledby="acc-t">
        <h2 id="acc-t">Willkommen im Casino Lapis</h2>
        <p>Wie sollen die anderen dich sehen? Der Name erscheint in der Rangliste und am Blackjack-Tisch.</p>
        <ul class="perks"><li>1'000 Lapis-Taler Startguthaben (Spielgeld)</li><li>Ein Konto für Casino und Booster-Packs</li><li>Kein Passwort: Dein Konto-Schlüssel bleibt in diesem Browser</li></ul>
        <form class="f-join" autocomplete="off"><input class="i-name" maxlength="20" placeholder="Dein Name" aria-label="Name"><button class="go" type="submit">Los</button></form>
        <div class="msg" role="status"></div>
        <button class="alt" type="button">Ich habe schon ein Konto (Schlüssel eingeben)</button>
      </div>`;
      document.body.appendChild(bg);
      const msg = bg.querySelector('.msg');
      const form = bg.querySelector('form');
      const input = bg.querySelector('input');
      let mode = 'name';
      try { input.value = localStorage.getItem('bigh-game-name') || localStorage.getItem('bigh-wordle-name') || ''; } catch (e) { /* egal */ }
      setTimeout(() => input.focus(), 50);
      bg.querySelector('.alt').addEventListener('click', () => {
        mode = mode === 'name' ? 'key' : 'name';
        input.value = '';
        input.placeholder = mode === 'key' ? 'Konto-Schlüssel (48 Zeichen)' : 'Dein Name';
        input.maxLength = mode === 'key' ? 60 : 20;
        bg.querySelector('.alt').textContent = mode === 'key' ? 'Neues Konto erstellen' : 'Ich habe schon ein Konto (Schlüssel eingeben)';
        msg.textContent = '';
        input.focus();
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = input.value.trim();
        msg.textContent = '';
        try {
          if (mode === 'key') {
            if (!/^[a-f0-9]{48}$/.test(v)) { msg.textContent = 'Das sieht nicht nach einem Konto-Schlüssel aus.'; return; }
            saveToken(v);
            try { me = await api('GET', '/me'); } catch (err) { saveToken(null); throw new Error('Kein Konto mit diesem Schlüssel gefunden.'); }
          } else {
            if (v.length < 2) { msg.textContent = 'Mindestens 2 Zeichen.'; return; }
            const d = await api('POST', '/join', { name: v });
            saveToken(d.token);
            me = d.me;
          }
          bg.remove();
          joining = null;
          emit();
          resolve(me);
        } catch (err) { msg.textContent = err.message; }
      });
    });
    return joining;
  }

  async function init() {
    if (token) {
      try { me = await api('GET', '/me'); emit(); return me; }
      catch (e) { if (e.status !== 401) throw e; saveToken(null); }
    }
    return join();
  }

  async function rename() {
    const n = prompt('Neuer Name im Casino:', me ? me.name : '');
    if (!n || !n.trim()) return;
    try { me = await api('POST', '/name', { name: n.trim() }); emit(); BIGH.toast('Du heisst jetzt ' + me.name + '.'); }
    catch (e) { BIGH.toast(e.message); }
  }
  async function copyKey() {
    if (!token) return;
    try { await navigator.clipboard.writeText(token); BIGH.toast('Konto-Schlüssel kopiert. Damit kannst du dich auf einem anderen Gerät anmelden. Nicht teilen!'); }
    catch (e) { prompt('Dein Konto-Schlüssel (nicht teilen):', token); }
  }

  window.Casino = {
    init, api, update, join, rename, copyKey,
    get me() { return me; },
    get token() { return token; },
    onChange(fn) { listeners.push(fn); if (me) fn(me); }
  };
})();
