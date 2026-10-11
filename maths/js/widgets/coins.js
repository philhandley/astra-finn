// coins: UK coins and notes, a purse and a tray (Measure Lab).
// Props: tray (array of names Finn can tap to add, e.g. ["1p","2p","5p","10p","20p","50p","£1","£2"]; [] hides it),
//        purse (array of names already in the purse), showTotal (show the purse total, "35p" or "£1.35"),
//        interactive (default true), price (pence: show a price tag), readonly, maxItems (default 12),
//        labels (default true: write the value on each coin; false for recognising coins by shape and colour),
//        sort (true: show the purse biggest first).
// Names: 1p 2p 5p 10p 20p 50p £1 £2 £5 £10 £20 (also "100p" for £1 and "200p" for £2).
// Tap a tray coin: it flies into the purse. Tap a purse coin: it goes back.
// State: { total (pence), count, items (array of names in purse order) }
// Debug: dev/harness.html?widget=coins&props={"tray":["1p","2p","5p","10p","20p","50p","£1","£2"],"showTotal":true,"price":45}
import { S, svgRoot, onTap, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { COL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Coins and notes',
  playground: { tray: ['1p', '2p', '5p', '10p', '20p', '50p', '£1', '£2', '£5', '£10'], purse: [], showTotal: true, interactive: true },
  state: ['total', 'count', 'items'],
};

const W = 800, H = 500, K = 3.3; // coin diameter in viewBox units per millimetre
export const COINS = {
  '1p': { v: 1, d: 20.3, shape: 'round', metal: 'copper' },
  '2p': { v: 2, d: 25.9, shape: 'round', metal: 'copper' },
  '5p': { v: 5, d: 18, shape: 'round', metal: 'silver' },
  '10p': { v: 10, d: 24.5, shape: 'round', metal: 'silver' },
  '20p': { v: 20, d: 21.4, shape: 'hept', metal: 'silver' },
  '50p': { v: 50, d: 27.3, shape: 'hept', metal: 'silver' },
  '£1': { v: 100, d: 23.4, shape: 'dodec', metal: 'bi' },
  '£2': { v: 200, d: 28.4, shape: 'round', metal: 'bi' },
  '£5': { v: 500, note: true, w: 170, h: 90, col: '#3fb3a6', dark: '#1d6f67' },
  '£10': { v: 1000, note: true, w: 178, h: 94, col: '#e98a3c', dark: '#97501a' },
  '£20': { v: 2000, note: true, w: 186, h: 98, col: '#8d63d2', dark: '#55358f' },
};
export const coinNames = Object.keys(COINS);
const ALIAS = { '100p': '£1', '200p': '£2', '1': '1p', '2': '2p', '5': '5p', '10': '10p', '20': '20p', '50': '50p', '£1.00': '£1', '£2.00': '£2' };
export const normCoin = n => { const s = String(n ?? '').trim(); return COINS[s] ? s : ALIAS[s] || null; };

export function money(pence) {
  pence = Math.round(Number(pence) || 0);
  if (pence < 100) return `${pence}p`;
  const pounds = Math.floor(pence / 100), p = pence % 100;
  return p === 0 ? `£${pounds}` : `£${pounds}.${String(p).padStart(2, '0')}`;
}

const METAL = {
  copper: { fill: '#c8794b', rim: '#8a4a26', ring: '#e7a37b', ink: '#3b1a07' },
  silver: { fill: '#d3d9e1', rim: '#8e98a8', ring: '#f1f4f8', ink: '#1d2638' },
  gold: { fill: '#e7c15a', rim: '#a5832c', ring: '#f6dd92', ink: '#3a2a04' },
};

function polyPath(n, r, rot = -90, bulge = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = ((rot + (360 * i) / n) * Math.PI) / 180;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  if (!bulge) return 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L') + 'Z';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i <= n; i++) { const p = pts[i % n]; d += `A${bulge} ${bulge} 0 0 1 ${p[0].toFixed(1)} ${p[1].toFixed(1)}`; }
  return d + 'Z';
}

// Draw one coin or note centred on 0,0 (unscaled). Returns a <g>.
export function drawMoney(name, labels = true) {
  const c = COINS[name];
  const g = S('g', {});
  if (!c) return g;
  if (c.note) {
    const w = c.w, h = c.h;
    g.appendChild(S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 9, fill: c.col, stroke: c.dark, 'stroke-width': 3 }));
    g.appendChild(S('rect', { x: -w / 2 + 7, y: -h / 2 + 7, width: w - 14, height: h - 14, rx: 6, fill: 'none', stroke: 'rgba(255,255,255,.45)', 'stroke-width': 2 }));
    // A see-through window and a few wavy lines (no portraits).
    g.appendChild(S('rect', { x: -w / 2 + 16, y: -h / 2 + 16, width: w * 0.2, height: h - 32, rx: 6, fill: 'rgba(255,255,255,.55)' }));
    g.appendChild(S('circle', { cx: -w / 2 + 16 + w * 0.1, cy: 0, r: Math.min(w * 0.07, 12), fill: c.col, opacity: 0.8 }));
    for (let k = 0; k < 3; k++) g.appendChild(S('path', { d: `M${-w * 0.2} ${h * (0.18 + k * 0.1)}q${w * 0.1} -10 ${w * 0.2} 0t${w * 0.2} 0`, stroke: 'rgba(255,255,255,.35)', 'stroke-width': 2, fill: 'none' }));
    if (labels) g.appendChild(S('text', { x: w * 0.16, y: h * 0.06, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 44, fill: '#fff', stroke: c.dark, 'stroke-width': 1.5, 'paint-order': 'stroke' }, [name]));
    else g.appendChild(S('circle', { cx: w * 0.16, cy: 0, r: 20, fill: 'rgba(255,255,255,.3)' }));
    return g;
  }
  const r = (c.d * K) / 2;
  if (c.metal === 'bi') {
    const G = METAL.gold, Sv = METAL.silver;
    if (c.shape === 'dodec') g.appendChild(S('path', { d: polyPath(12, r, -90), fill: G.fill, stroke: G.rim, 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    else g.appendChild(S('circle', { r, fill: G.fill, stroke: G.rim, 'stroke-width': 3 }));
    g.appendChild(S('circle', { r: r * 0.66, fill: Sv.fill, stroke: '#b0b8c4', 'stroke-width': 2 }));
    g.appendChild(S('circle', { r: r * 0.86, fill: 'none', stroke: G.ring, 'stroke-width': 1.5, opacity: 0.8 }));
    if (labels) g.appendChild(S('text', { y: r * 0.2, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': Math.round(r * 0.58), fill: Sv.ink }, [name]));
    return g;
  }
  const M = METAL[c.metal];
  if (c.shape === 'hept') g.appendChild(S('path', { d: polyPath(7, r, -90, r * 1.75), fill: M.fill, stroke: M.rim, 'stroke-width': 3, 'stroke-linejoin': 'round' }));
  else g.appendChild(S('circle', { r, fill: M.fill, stroke: M.rim, 'stroke-width': 3 }));
  g.appendChild(S('circle', { r: r * 0.82, fill: 'none', stroke: M.ring, 'stroke-width': 2, opacity: 0.9 }));
  if (labels) g.appendChild(S('text', { y: r * 0.24, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': Math.round(Math.max(22, r * 0.68)), fill: M.ink }, [name]));
  else g.appendChild(S('path', { d: polyPath(5, r * 0.3, -90), fill: M.ring, opacity: 0.7 }));
  return g;
}

const sizeOf = name => { const c = COINS[name]; return c.note ? { w: c.w, h: c.h } : { w: c.d * K, h: c.d * K }; };

// Flow items into rows inside a box at scale s. Returns positions or null if they do not fit.
function flow(names, box, s, gap = 18) {
  const rows = [];
  let row = [], rw = 0;
  for (const n of names) {
    const { w, h } = sizeOf(n);
    const iw = w * s, ih = h * s;
    if (row.length && rw + gap + iw > box.w) { rows.push(row); row = []; rw = 0; }
    row.push({ n, iw, ih });
    rw += (row.length > 1 ? gap : 0) + iw;
  }
  if (row.length) rows.push(row);
  const rowH = rows.map(r => Math.max(...r.map(i => i.ih)));
  const totalH = rowH.reduce((a, b) => a + b, 0) + gap * Math.max(0, rows.length - 1);
  if (totalH > box.h || rows.some(r => r.reduce((a, i) => a + i.iw, 0) + gap * (r.length - 1) > box.w + 0.5)) return null;
  const out = [];
  let y = box.y + (box.h - totalH) / 2;
  rows.forEach((r, ri) => {
    const w = r.reduce((a, i) => a + i.iw, 0) + gap * (r.length - 1);
    let x = box.x + (box.w - w) / 2;
    for (const i of r) { out.push({ n: i.n, x: x + i.iw / 2, y: y + rowH[ri] / 2, s }); x += i.iw + gap; }
    y += rowH[ri] + gap;
  });
  return out;
}

function fit(names, box, maxS) {
  if (!names.length) return [];
  for (let s = maxS; s > 0.2; s *= 0.94) { const f = flow(names, box, s); if (f) return f; }
  return flow(names, box, 0.2) || [];
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-coins', `
    .w-coins { width: 100%; height: 100%; }
    .w-coins .tap { cursor: pointer; }
    .w-coins.ro .tap { cursor: default; }
  `);
  let p = {};
  let purse = [];
  const root = svgRoot(W, H, 'w-coins');
  el.appendChild(root);
  const unbinds = [];
  let flyFrom = null; // { index, x, y } of a coin just added, for the fly-in animation

  const ro = () => !!(p.readonly || ctx.readonly || p.interactive === false);
  const maxItems = () => clamp(Math.round(p.maxItems || 12), 1, 30);
  const tray = () => (ro() || !Array.isArray(p.tray) ? [] : p.tray.map(normCoin).filter(Boolean));
  const total = () => purse.reduce((a, n) => a + COINS[n].v, 0);

  function setFromProps(np) {
    p = { ...p, ...np };
    if ('purse' in np || !purse) purse = (Array.isArray(p.purse) ? p.purse : []).map(normCoin).filter(Boolean).slice(0, 30);
  }

  function changed() { draw(); ctx.onChange && ctx.onChange(api.getState()); }

  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    root.classList.toggle('ro', ro());
    const tr = tray();
    const hasTray = tr.length > 0;
    const hasTop = !!(p.showTotal || Number.isFinite(Number(p.price)) && p.price !== undefined && p.price !== null);
    const purseBox = hasTray ? { x: 8, y: 8, w: W - 16, h: 362 } : { x: 4, y: 4, w: W - 8, h: H - 8 };
    // The purse.
    if (hasTray || hasTop) {
      root.appendChild(S('rect', { x: purseBox.x, y: purseBox.y, width: purseBox.w, height: purseBox.h, rx: 26, fill: 'rgba(255,255,255,.035)', stroke: COL.ink3, 'stroke-width': 3, 'stroke-dasharray': '12 10' }));
    }
    const top = hasTop ? 78 : 0;
    if (p.showTotal) {
      root.appendChild(S('text', { x: purseBox.x + 26, y: purseBox.y + 62, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 54, fill: COL.tens }, [money(total())]));
    }
    if (p.price !== undefined && p.price !== null && Number.isFinite(Number(p.price))) {
      const txt = money(Number(p.price));
      const tw = 46 + txt.length * 27, tx = purseBox.x + purseBox.w - tw - 18, ty = purseBox.y + 12;
      root.appendChild(S('path', { d: `M${tx + 26} ${ty}H${tx + tw}V${ty + 64}H${tx + 26}L${tx} ${ty + 32}Z`, fill: '#f6dd92', stroke: '#a5832c', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
      root.appendChild(S('circle', { cx: tx + 22, cy: ty + 32, r: 6, fill: COL.panel }));
      root.appendChild(S('text', { x: tx + 30 + (tw - 30) / 2, y: ty + 47, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 44, fill: '#2a1e04' }, [txt]));
    }
    const inner = { x: purseBox.x + 14, y: purseBox.y + 10 + top, w: purseBox.w - 28, h: purseBox.h - 20 - top };
    const shown = purse.map((n, i) => ({ n, i }));
    if (p.sort) shown.sort((a, b) => COINS[b.n].v - COINS[a.n].v);
    const maxS = hasTray ? 1.25 : purse.length <= 1 ? 4 : purse.length <= 3 ? 2.6 : 1.9;
    const pos = fit(shown.map(o => o.n), inner, maxS);
    const labels = p.labels !== false;
    pos.forEach((q, k) => {
      const idx = shown[k].i;
      const outer = S('g', {});
      const g = S('g', { class: 'tap', 'data-purse': idx, transform: `translate(${q.x} ${q.y}) scale(${q.s})` });
      g.appendChild(drawMoney(q.n, labels));
      outer.appendChild(g);
      root.appendChild(outer);
      if (!ro()) {
        const sz = sizeOf(q.n);
        g.insertBefore(S('rect', { x: -Math.max(sz.w, 70) / 2, y: -Math.max(sz.h, 70) / 2, width: Math.max(sz.w, 70), height: Math.max(sz.h, 70), fill: 'transparent' }), g.firstChild);
        unbinds.push(onTap(g, () => { purse.splice(idx, 1); sfx('click'); changed(); }));
      }
      if (flyFrom && flyFrom.index === idx && !reducedMotion() && outer.animate) {
        outer.animate([{ transform: `translate(${flyFrom.x - q.x}px, ${flyFrom.y - q.y}px)` }, { transform: 'translate(0px, 0px)' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.3,1)' });
      }
    });
    flyFrom = null;
    // The tray: one of each, tap to add.
    if (hasTray) {
      root.appendChild(S('rect', { x: 8, y: 382, width: W - 16, height: 112, rx: 22, fill: 'rgba(255,255,255,.06)', stroke: COL.line, 'stroke-width': 2 }));
      const full = purse.length >= maxItems();
      const tpos = fit(tr, { x: 18, y: 388, w: W - 36, h: 100 }, 1.0);
      tpos.forEach(q => {
        const g = S('g', { class: 'tap', 'data-tray': q.n, transform: `translate(${q.x} ${q.y}) scale(${q.s})`, opacity: full ? 0.45 : 1 });
        const sz = sizeOf(q.n);
        g.appendChild(S('rect', { x: -Math.max(sz.w, 76) / 2, y: -64, width: Math.max(sz.w, 76), height: 128, fill: 'transparent' }));
        g.appendChild(drawMoney(q.n, labels));
        root.appendChild(g);
        unbinds.push(onTap(g, () => {
          if (purse.length >= maxItems()) { sfx('clunk'); return; }
          purse.push(q.n);
          flyFrom = { index: purse.length - 1, x: q.x, y: q.y };
          sfx('pop');
          changed();
        }));
      });
    }
  }

  // Fewest coins for an amount, from the tray if there is one.
  function makeChange(amount) {
    const avail = (tray().length ? tray() : coinNames).filter(n => COINS[n].v <= amount).sort((a, b) => COINS[b].v - COINS[a].v);
    const out = [];
    let left = amount;
    for (const n of avail) while (left >= COINS[n].v && out.length < 30) { out.push(n); left -= COINS[n].v; }
    return left === 0 ? out : null;
  }

  const api = {
    getState() { return { total: total(), count: purse.length, items: [...purse] }; },
    update(np) { setFromProps(np || {}); draw(); },
    showAnswer(answer) {
      let amt = null;
      if (typeof answer === 'number') amt = answer;
      else if (answer && typeof answer === 'object' && Number.isFinite(Number(answer.total))) amt = Number(answer.total);
      else if (Array.isArray(answer)) { purse = answer.map(normCoin).filter(Boolean); draw(); return; }
      if (amt === null) return;
      const set = makeChange(Math.round(amt));
      if (!set) return;
      purse = [];
      draw();
      // Drop the coins in one at a time.
      timers.forEach(clearTimeout);
      timers = set.map((n, i) => setTimeout(() => { purse.push(n); draw(); }, reducedMotion() ? 0 : 200 * (i + 1)));
    },
    destroy() { timers.forEach(clearTimeout); unbinds.splice(0).forEach(u => u()); el.replaceChildren(); },
  };
  let timers = [];
  purse = null;
  setFromProps(props);
  draw();
  return api;
}
