// Crazy-Cupcakes-Karten als HTML bauen (Packs und Duell). Braucht cards.js und /shared/fun.js.
(function () {
  'use strict';
  const CARDS = window.CC_CARDS, TYPES = window.CC_TYPES, RAR = window.CC_RARITY;
  const byId = Object.fromEntries(CARDS.map((c, i) => [c.id, Object.assign(c, { no: i + 1 })]));

  function cardEl(id) {
    const c = byId[id];
    const [tname, ticon, tc, tl] = TYPES[c.t];
    const el = document.createElement('div');
    el.className = 'pc r-' + c.r;
    el.style.setProperty('--tc', tc);
    el.style.setProperty('--tl', tl);
    const cost = (n) => '<span class="cost">' + '<i></i>'.repeat(n) + '</span>';
    el.innerHTML = '<div class="pc-in">' +
      '<div class="pc-top"><span class="stg">' + (c.r === 'SR' ? 'LEGENDE' : c.r === 'UR' ? 'EX' : 'BASIS') + '</span><span class="nm"></span><span class="hp">KP <b>' + c.hp + '</b></span><span class="ty" title="' + tname + '">' + BIGH.icon(ticon) + '</span></div>' +
      '<div class="pc-art"><img alt="" loading="lazy" decoding="async"></div>' +
      '<div class="pc-info">Nr. ' + c.no + ' · Crazy-Cupcakes-Figur · Grösse: ja · Gewicht: 3 Pizzen</div>' +
      c.a.map((a, i) => '<div class="pc-atk">' + cost(a[1] ? Math.min(4, 1 + Math.floor(a[1] / 50)) : 1) + '<b></b><span class="dmg">' + (a[1] || '') + '</span>' + (a[2] ? '<p></p>' : '') + '</div>').join('') +
      '<div class="pc-spacer"></div>' +
      '<div class="pc-bottom"><span>Schwäche<b>Gras ×2</b></span><span>Resistenz<b>Kritik −30</b></span><span>Rückzug<b>baden gehen</b></span></div>' +
      '<div class="pc-flavor"></div>' +
      '<div class="pc-foot"><span>Illus. Crazy Cupcakes</span><span>' + c.no + '/40 ' + RAR[c.r][1] + '</span></div>' +
      '</div><div class="glare"></div>';
    el.querySelector('.nm').textContent = c.n;
    el.querySelector('img').src = c.img || '/shared/cupcakes/' + c.id + '.webp';
    el.querySelectorAll('.pc-atk').forEach((row, i) => {
      row.querySelector('b').textContent = c.a[i][0];
      const p = row.querySelector('p'); if (p) p.textContent = c.a[i][2];
    });
    el.querySelector('.pc-flavor').textContent = c.f;
    return el;
  }
  function backEl() {
    const el = document.createElement('div');
    el.className = 'pc back';
    el.innerHTML = '<div class="pc-in"><div class="ball"><span>H</span></div></div>';
    return el;
  }
  // Holo-Effekt: Neigung und Glanz folgen dem Zeiger
  function tilt(el, strength) {
    const move = (x, y) => {
      const r = el.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (x - r.left) / r.width)), py = Math.min(1, Math.max(0, (y - r.top) / r.height));
      el.style.transform = 'rotateY(' + (px - 0.5) * strength + 'deg) rotateX(' + (0.5 - py) * strength + 'deg)';
      el.style.setProperty('--hx', px * 100 + '%'); el.style.setProperty('--hy', py * 100 + '%');
      el.classList.add('tilt');
    };
    el.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
    el.addEventListener('pointerleave', () => { el.style.transform = ''; el.classList.remove('tilt'); });
    return move;
  }

  window.CC_UI = { cardEl, backEl, tilt, byId };
})();
