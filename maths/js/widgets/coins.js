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
import { COL, PAL, FONT } from '../core/theme.js';
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
  '£5': { v: 500, note: true, w: 170, h: 90, col: PAL.teal, dark: PAL.tealDark },
  '£10': { v: 1000, note: true, w: 178, h: 94, col: '#f2862e', dark: '#b4561a' },
  '£20': { v: 2000, note: true, w: 186, h: 98, col: PAL.purple, dark: PAL.purpleDark },
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

// Style v2: on white, every coin has a darker rim line and a thin "edge" below it so it reads as a solid coin.
const METAL = {
  copper: { fill: '#c27a3e', rim: '#8a4f22', ring: '#d9965f', ink: '#2e1707' },
  silver: { fill: '#d9dde4', rim: '#8b93a3', ring: '#eef0f4', ink: COL.ink },
  gold: { fill: '#efc65b', rim: '#5c4513', ring: '#f7dc8f', ink: COL.ink },
};
const EDGE = 4; // coin thickness, in coin units

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

// The outline of a coin as an SVG element (circle or path), centred on 0,0.
function coinShape(c, r, attrs) {
  if (c.shape === 'hept') return S('path', { d: polyPath(7, r, -90, r * 1.75), 'stroke-linejoin': 'round', ...attrs });
  if (c.shape === 'dodec') return S('path', { d: polyPath(12, r, -90), 'stroke-linejoin': 'round', ...attrs });
  return S('circle', { r, ...attrs });
}

// Draw one coin or note centred on 0,0 (unscaled). Returns a <g>.
// k scales the line widths and edge, so a coin drawn very big or very small keeps a crisp, even outline.
export function drawMoney(name, labels = true, k = 1) {
  const c = COINS[name];
  const g = S('g', {});
  if (!c) return g;
  const E = EDGE * k, sw = v => v * k;
  const txt = (attrs, t) => S('text', { 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 800, ...attrs }, [t]);
  if (c.note) {
    // A flat card with an ink outline, a see-through window and a white value label (no portraits).
    const w = c.w, h = c.h;
    g.appendChild(S('rect', { x: -w / 2, y: -h / 2 + E, width: w, height: h, rx: 12, fill: COL.ink }));
    g.appendChild(S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 12, fill: c.col, stroke: COL.ink, 'stroke-width': sw(4) }));
    g.appendChild(S('rect', { x: -w / 2 + 14, y: -h / 2 + 14, width: w * 0.22, height: h - 28, rx: 7, fill: '#fff', opacity: 0.45 }));
    g.appendChild(S('circle', { cx: -w / 2 + 14 + w * 0.11, cy: 0, r: Math.min(w * 0.06, 11), fill: c.dark, opacity: 0.55 }));
    for (let k = 0; k < 2; k++) g.appendChild(S('path', { d: `M${-w * 0.16} ${h * (0.3 + k * 0.1)}q${w * 0.08} -8 ${w * 0.16} 0t${w * 0.16} 0t${w * 0.16} 0`, stroke: '#fff', opacity: 0.45, 'stroke-width': 2.5, fill: 'none' }));
    const lw = w * 0.5, lh = h * 0.5, lx = w * 0.17;
    g.appendChild(S('rect', { x: lx - lw / 2, y: -h * 0.34, width: lw, height: lh, rx: lh / 2, fill: COL.surface, stroke: COL.ink, 'stroke-width': sw(3) }));
    if (labels) g.appendChild(txt({ x: lx, y: -h * 0.34 + lh / 2 + 13, 'font-size': 37, fill: COL.ink }, name));
    return g;
  }
  const r = (c.d * K) / 2;
  if (c.metal === 'bi') {
    const G = METAL.gold, Sv = METAL.silver;
    g.appendChild(coinShape(c, r, { transform: `translate(0 ${E})`, fill: G.rim }));
    g.appendChild(coinShape(c, r, { fill: G.fill, stroke: G.rim, 'stroke-width': sw(3.5) }));
    g.appendChild(S('circle', { r: r * 0.86, fill: 'none', stroke: G.ring, 'stroke-width': sw(2) }));
    g.appendChild(S('circle', { r: r * 0.66, fill: Sv.fill, stroke: Sv.rim, 'stroke-width': sw(2.5) }));
    if (labels) g.appendChild(txt({ y: r * 0.21, 'font-size': Math.round(r * 0.6), fill: Sv.ink }, name));
    return g;
  }
  const M = METAL[c.metal];
  g.appendChild(coinShape(c, r, { transform: `translate(0 ${E})`, fill: M.rim }));
  g.appendChild(coinShape(c, r, { fill: M.fill, stroke: M.rim, 'stroke-width': sw(3.5) }));
  g.appendChild(S('circle', { r: r * 0.8, fill: 'none', stroke: M.ring, 'stroke-width': sw(2.5) }));
  if (labels) g.appendChild(txt({ y: r * 0.24, 'font-size': Math.round(Math.max(22, r * 0.68)), fill: M.ink }, name));
  else g.appendChild(S('path', { d: polyPath(5, r * 0.3, -90), fill: M.ring }));
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
      root.appendChild(S('rect', { x: purseBox.x + 1.5, y: purseBox.y + 1.5, width: purseBox.w - 3, height: purseBox.h - 3, rx: 26, fill: COL.surface2, stroke: COL.lineStrong, 'stroke-width': 3, 'stroke-dasharray': '14 10' }));
    }
    const top = hasTop ? 78 : 0;
    if (p.showTotal) {
      root.appendChild(S('text', { x: purseBox.x + 26, y: purseBox.y + 64, 'font-family': FONT.display, 'font-weight': 800, 'font-size': 56, fill: COL.ink }, [money(total())]));
    }
    if (p.price !== undefined && p.price !== null && Number.isFinite(Number(p.price))) {
      const txt = money(Number(p.price));
      // A yellow price tag with an ink outline.
      const tw = 50 + txt.length * 28, tx = purseBox.x + purseBox.w - tw - 18, ty = purseBox.y + 12;
      const tag = `M${tx + 28} ${ty}H${tx + tw - 10}Q${tx + tw} ${ty} ${tx + tw} ${ty + 10}V${ty + 58}Q${tx + tw} ${ty + 68} ${tx + tw - 10} ${ty + 68}H${tx + 28}L${tx} ${ty + 34}Z`;
      root.appendChild(S('path', { d: tag, transform: 'translate(0 5)', fill: COL.ink }));
      root.appendChild(S('path', { d: tag, fill: PAL.yellow, stroke: COL.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
      root.appendChild(S('circle', { cx: tx + 24, cy: ty + 34, r: 7, fill: COL.surface, stroke: COL.ink, 'stroke-width': 3 }));
      root.appendChild(S('text', { x: tx + 34 + (tw - 34) / 2, y: ty + 50, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 44, fill: COL.ink }, [txt]));
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
      g.appendChild(drawMoney(q.n, labels, 1 / Math.sqrt(q.s)));
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
      // A soft shelf: a pale tray with a solid bottom edge.
      root.appendChild(S('rect', { x: 9.5, y: 386, width: W - 19, height: 106, rx: 22, fill: COL.line }));
      root.appendChild(S('rect', { x: 9.5, y: 381.5, width: W - 19, height: 104, rx: 22, fill: COL.surface2, stroke: COL.line, 'stroke-width': 3 }));
      const full = purse.length >= maxItems();
      const tpos = fit(tr, { x: 20, y: 386, w: W - 40, h: 94 }, 1.0);
      tpos.forEach(q => {
        const g = S('g', { class: 'tap', 'data-tray': q.n, transform: `translate(${q.x} ${q.y}) scale(${q.s})`, opacity: full ? 0.45 : 1 });
        const sz = sizeOf(q.n);
        g.appendChild(S('rect', { x: -Math.max(sz.w, 76) / 2, y: -64, width: Math.max(sz.w, 76), height: 128, fill: 'transparent' }));
        g.appendChild(drawMoney(q.n, labels, 1 / Math.sqrt(q.s)));
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
