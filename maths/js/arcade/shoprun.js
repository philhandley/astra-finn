// Shop Run (SVG). Pay the exact price with UK coins; a bonus star for using the fewest coins.
// Mid-round one coin slot breaks for a few items ("The 20p slot is broken!"). No timer, no fail.
// Style v2: a bright white shop. The item on a white card with an ink outline, a white price tag,
// the counter a soft well, coins with darker rims so they stand out on white, the tray on a soft shelf.
// Tests only: ctx.debug or ?arcdebug exposes window.__arc (price, total, trayCoin, counter, bought).
import { S, svgRoot, onTap, injectCSS, clamp, esc, reducedMotion } from '../core/dom.js';
import { makeRand } from '../core/rand.js';
import { COL, PAL, FONT } from '../core/theme.js';
import { artInner } from '../core/art.js';
import { sfx as coreSfx } from '../core/sfx.js';

export const meta = { id: 'shoprun', title: 'Shop Run', about: 'Pay the exact price with the fewest coins.', icon: 'fuel' };

const C = 'arc-shop';
const VW = 1280, VH = 660;
const ROUND = 8;
const BROKEN_FROM = 3, BROKEN_TO = 5; // item indexes (0-based) with a broken coin slot

const COPPER = { fill: '#c27a3e', rim: '#8a4f22', hi: '#e3a676', ink: '#3d1d06' };
const SILVERC = { fill: '#d9dde4', rim: '#8b93a3', hi: '#f6f7fa', ink: '#1b1e2e' };
const GOLDC = { fill: '#e8bf4f', rim: '#a37a12', hi: '#f8e08f', ink: '#3a2a05' };
const COINS = {
  1: { label: '1p', d: 76, shape: 'round', m: COPPER },
  2: { label: '2p', d: 96, shape: 'round', m: COPPER },
  5: { label: '5p', d: 70, shape: 'round', m: SILVERC },
  10: { label: '10p', d: 92, shape: 'round', m: SILVERC },
  20: { label: '20p', d: 82, shape: 'hept', m: SILVERC },
  50: { label: '50p', d: 104, shape: 'hept', m: SILVERC },
  100: { label: '£1', d: 90, shape: 'dodec', m: GOLDC, inner: SILVERC },
  200: { label: '£2', d: 108, shape: 'round', m: GOLDC, inner: SILVERC },
};
const SETS = { 1: [1, 2, 5, 10, 20], 2: [1, 2, 5, 10, 20, 50], 3: [1, 2, 5, 10, 20, 50, 100, 200] };
const ITEMS = [
  { art: 'fuel', name: 'Fuel can' }, { art: 'crystal', name: 'Space crystal' }, { art: 'cookie', name: 'Space snack' },
  { art: 'helmet', name: 'Helmet sticker' }, { art: 'apple', name: 'Moon apple' }, { art: 'robot', name: 'Toy robot' },
  { art: 'boot', name: 'Moon boot' }, { art: 'satellite', name: 'Mini satellite' }, { art: 'flag', name: 'Base flag' },
  { art: 'star', name: 'Star badge' }, { art: 'planet', name: 'Planet ball' }, { art: 'ufo', name: 'UFO kite' },
];

export const fmt = p => (p >= 100 ? `£${Math.floor(p / 100)}${p % 100 ? '.' + String(p % 100).padStart(2, '0') : ''}` : `${p}p`);
const sayPrice = p => (p >= 100 ? `${Math.floor(p / 100)} pound${p >= 200 ? 's' : ''}${p % 100 ? ' ' + (p % 100) : ''}` : `${p} pence`);
// Fewest coins to make p from the given coin values (unlimited supply).
export function fewest(p, coins) {
  const best = new Array(p + 1).fill(Infinity);
  best[0] = 0;
  for (let v = 1; v <= p; v++) for (const c of coins) if (c <= v && best[v - c] + 1 < best[v]) best[v] = best[v - c] + 1;
  return best[p];
}
function greedy(p, coins) {
  const out = [];
  for (const c of [...coins].sort((a, b) => b - a)) while (p >= c) { out.push(c); p -= c; }
  return out;
}

// ---------- shared strip (each arcade file carries its own copy) ----------
// Black top bar like the app's mission bar: chunky Exit and level keys (solid bottom edge), white title, quiet star tally.
const BACK = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STAR_D = 'M50 6l12 28 30 3-23 20 7 30-26-16-26 16 7-30L8 37l30-3z';
const starSvg = (size, fill = '#ffcc33') => `<svg class="st" viewBox="-6 -6 112 112" width="${size}" height="${size}" aria-hidden="true"><path d="${STAR_D}" fill="${fill}" stroke="#1b1e2e" stroke-width="7" stroke-linejoin="round"/></svg>`;
const withStars = (html, size) => String(html).replace(/★/g, starSvg(size)).replace(/☆/g, starSvg(size, '#d3d9e3'));
function stripCSS(c) {
  return `
  .${c} { position: absolute; inset: 0; display: flex; flex-direction: column; background: #000; color: #fff; font-family: ${FONT.display}; overflow: hidden; user-select: none; -webkit-user-select: none; }
  .${c} button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; font-family: ${FONT.display}; }
  .${c}-top { flex: none; height: 82px; display: flex; align-items: center; gap: 14px; padding: 0 16px 4px; background: #000; position: relative; z-index: 3; }
  .${c}-key { appearance: none; cursor: pointer; min-width: 60px; min-height: 60px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 16px; border: 2px solid #3a3f4d; background: #23262f; color: #fff; font-weight: 700; font-size: 22px; box-shadow: 0 5px 0 #3a3f4d; transition: transform .1s ease, box-shadow .1s ease, background .2s; }
  .${c}-key:active { transform: translateY(4px); box-shadow: 0 1px 0 #3a3f4d; }
  .${c}-exit { padding: 0 22px 0 14px; }
  .${c}-title { flex: 1; min-width: 0; font-weight: 700; font-size: 26px; letter-spacing: -.01em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .${c}-lv { display: flex; align-items: center; gap: 10px; }
  .${c}-lv span { font-weight: 700; font-size: 14px; letter-spacing: .14em; text-transform: uppercase; color: #7d8397; margin-right: 2px; }
  .${c}-lv button { width: 60px; height: 60px; padding: 0; font-size: 26px; font-weight: 800; }
  .${c}-lv button.on { background: #ffcc33; border-color: #ffcc33; color: #1d1600; box-shadow: 0 5px 0 #c99a0e; }
  .${c}-lv button.on:active { box-shadow: 0 1px 0 #c99a0e; }
  .${c}-tally { min-width: 124px; text-align: right; line-height: 1.1; margin-left: 6px; }
  .${c}-tally b { display: inline-flex; align-items: center; gap: 7px; font-weight: 800; font-size: 28px; color: #fff; }
  .${c}-tally b span { display: inline-flex; align-items: center; gap: 7px; margin-left: 8px; }
  .${c}-tally .st { flex: none; }
  .${c}-tally small { display: block; font-weight: 500; font-size: 14px; color: #7d8397; margin-top: 4px; }
  .${c}-tally b.bump { animation: ${c}-bump .35s ease; }
  @keyframes ${c}-bump { 40% { transform: scale(1.25); } }
  .${c}-sum { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.55); z-index: 5; animation: ${c}-fade .3s ease; }
  .${c}-card { min-width: 480px; max-width: 660px; text-align: center; padding: 30px 44px 34px; border-radius: 28px; background: #fff; color: #1b1e2e; border: 4px solid #1b1e2e; box-shadow: 0 8px 0 #1b1e2e, 0 30px 70px rgba(0,0,0,.45); animation: ${c}-pop .45s cubic-bezier(.2,1.4,.4,1); }
  .${c}-sum .eb { font-weight: 700; font-size: 15px; letter-spacing: .16em; text-transform: uppercase; color: #4b5168; }
  .${c}-sum .big { display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 800; font-size: 72px; line-height: 1; margin: 16px 0 10px; color: #1b1e2e; }
  .${c}-sum .big span { display: inline-flex; align-items: center; gap: 12px; margin-left: 18px; }
  .${c}-sum p { margin: 6px 0; font-size: 22px; font-weight: 500; color: #4b5168; }
  .${c}-sum p.best { font-size: 18px; color: #8b91a7; min-height: 1.2em; }
  .${c}-sum .row { display: flex; gap: 14px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
  .${c}-btn { appearance: none; cursor: pointer; min-height: 64px; padding: 0 30px; border-radius: 18px; border: 3px solid #1d4ed8; background: #3b82f6; color: #fff; font-weight: 700; font-size: 23px; box-shadow: 0 5px 0 #1d4ed8; transition: transform .1s ease, box-shadow .1s ease; }
  .${c}-btn:active { transform: translateY(4px); box-shadow: 0 1px 0 #1d4ed8; }
  .${c}-btn.ghost { background: #fff; color: #1b1e2e; border-color: #dfe3ec; box-shadow: 0 5px 0 #dfe3ec; }
  .${c}-btn.ghost:active { box-shadow: 0 1px 0 #dfe3ec; }
  @keyframes ${c}-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ${c}-pop { from { transform: scale(.8); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .${c} *, .${c} *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
  `;
}
function makeStrip(root, c, title, level, { onExit, onLevel }) {
  const top = document.createElement('div');
  top.className = `${c}-top`;
  top.innerHTML = `<button type="button" class="${c}-key ${c}-exit" aria-label="Exit">${BACK}Exit</button>
    <div class="${c}-title">${esc(title)}</div>
    <div class="${c}-lv" role="group" aria-label="Level"><span>Level</span>${[1, 2, 3].map(n => `<button type="button" class="${c}-key" data-l="${n}" aria-label="Level ${n}">${n}</button>`).join('')}</div>
    <div class="${c}-tally" aria-live="polite"><b>${withStars('★ 0', 30)}</b><small></small></div>`;
  root.appendChild(top);
  const unb = [onTap(top.querySelector(`.${c}-exit`), () => onExit())];
  top.querySelectorAll(`.${c}-lv button`).forEach(b => unb.push(onTap(b, () => onLevel(+b.dataset.l))));
  const tb = top.querySelector(`.${c}-tally b`), ts = top.querySelector(`.${c}-tally small`);
  const api = {
    setLevel(l) { top.querySelectorAll(`.${c}-lv button`).forEach(b => b.classList.toggle('on', +b.dataset.l === l)); },
    setTally(html, bump) { tb.innerHTML = withStars(html, 30); if (bump) { tb.classList.remove('bump'); void tb.offsetWidth; tb.classList.add('bump'); } },
    setNote(t) { ts.textContent = t || ''; },
    destroy() { unb.forEach(u => u()); },
  };
  api.setLevel(level);
  return api;
}

// ---------- coin pictures ----------
function polyPts(n, r, rot = -Math.PI / 2) {
  return Array.from({ length: n }, (_, i) => [Math.cos(rot + (i * 2 * Math.PI) / n) * r, Math.sin(rot + (i * 2 * Math.PI) / n) * r]);
}
function shapePath(shape, r) {
  if (shape === 'hept') {
    // Curved-sided heptagon: each side is an arc centred on the opposite corner.
    const pts = polyPts(7, r);
    const rho = 2 * r * Math.sin((3 * Math.PI) / 7);
    return `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}` + pts.map((_, i) => { const q = pts[(i + 1) % 7]; return ` A${rho.toFixed(2)} ${rho.toFixed(2)} 0 0 1 ${q[0].toFixed(2)} ${q[1].toFixed(2)}`; }).join('') + 'Z';
  }
  if (shape === 'dodec') {
    const pts = polyPts(12, r, -Math.PI / 2 + Math.PI / 12);
    return 'M' + pts.map(p => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L') + 'Z';
  }
  return `M${-r} 0 A${r} ${r} 0 1 1 ${r} 0 A${r} ${r} 0 1 1 ${-r} 0Z`;
}
function coinPic(v) {
  const c = COINS[v], r = c.d / 2, m = c.m;
  const g = S('g', { class: 'sh-coin' });
  g.appendChild(S('path', { d: shapePath(c.shape, r), fill: 'rgba(27,30,46,.16)', transform: 'translate(0 6)' }));
  g.appendChild(S('path', { d: shapePath(c.shape, r - 2), fill: m.fill, stroke: m.rim, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
  if (c.inner) {
    g.appendChild(S('circle', { r: r * 0.62, fill: c.inner.fill, stroke: c.inner.rim, 'stroke-width': 3 }));
  } else {
    g.appendChild(S('path', { d: shapePath(c.shape, r * 0.8), fill: 'none', stroke: m.rim, 'stroke-width': 2, opacity: 0.45 }));
  }
  g.appendChild(S('path', { d: `M${-r * 0.52} ${-r * 0.5} A${r * 0.74} ${r * 0.74} 0 0 1 ${r * 0.3} ${-r * 0.68}`, fill: 'none', stroke: (c.inner || m).hi, 'stroke-width': 3.5, 'stroke-linecap': 'round', opacity: 0.85 }));
  const fs = Math.max(24, Math.round(r * (c.label.length > 2 ? 0.56 : 0.68)));
  g.appendChild(S('text', { y: 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 800, 'font-size': fs, fill: (c.inner || m).ink }, [c.label]));
  return g;
}

// ---------- the game ----------
export function mount(el, ctx = {}) {
  injectCSS(C, stripCSS(C) + `
  .${C}-stage { flex: 1; min-height: 0; position: relative; margin: 0 12px 12px; border-radius: 26px; background: ${COL.surface}; overflow: hidden; }
  .${C}-stage svg { position: absolute; inset: 0; }
  .${C} .sh-tc { cursor: pointer; }
  .${C} .sh-tc .sh-coin { transition: transform .1s ease; }
  .${C} .sh-tc:active .sh-coin { transform: translateY(3px) scale(.95); }
  .${C} .sh-tc.sh-broken { cursor: default; }
  .${C} .sh-tc.sh-broken .sh-coin { opacity: .4; }
  .${C} .sh-cc { cursor: pointer; }
  .${C} .sh-mv { transition: transform .28s cubic-bezier(.2,.8,.3,1), opacity .28s; }
  .${C} .sh-item { transition: transform .5s cubic-bezier(.2,.8,.3,1), opacity .5s; transform-box: fill-box; transform-origin: center; }
  .${C} .sh-item.sh-sold { transform: scale(1.18) translateY(-12px); opacity: 0; }
  .${C} .sh-item.sh-enter { transform: scale(.6); opacity: 0; }
  .${C} .sh-paid { transition: fill .25s; }
  .${C}-banner { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; z-index: 4; padding: 22px 48px 24px; border-radius: 26px; background: #fff; border: 4px solid ${PAL.orange}; box-shadow: 0 8px 0 ${PAL.orangeDark}, 0 24px 50px rgba(27,30,46,.22); animation: ${C}-pop .45s cubic-bezier(.2,1.4,.4,1); color: ${COL.ink}; }
  .${C}-banner .k { font-weight: 800; font-size: 42px; color: ${COL.ink}; }
  .${C}-banner .r { font-weight: 500; font-size: 25px; color: ${COL.ink2}; margin-top: 6px; }
  .${C}-banner.fixed { border-color: ${COL.good}; box-shadow: 0 8px 0 #15803d, 0 24px 50px rgba(27,30,46,.22); }
  .${C}-banner.out { opacity: 0; transition: opacity .4s; }
  @keyframes ${C}-pop { from { transform: translate(-50%, -50%) scale(.6); opacity: 0; } }
  `);

  const say = t => { try { ctx.say && ctx.say(t); } catch (e) { /* ignore */ } };
  const sfx = n => { try { (ctx.sfx || coreSfx)(n); } catch (e) { /* ignore */ } };
  const load = k => { try { return ctx.load ? ctx.load(k) : null; } catch (e) { return null; } };
  const save = (k, v) => { try { ctx.save && ctx.save(k, v); } catch (e) { /* ignore */ } };
  const calm = reducedMotion();

  let level = clamp(Math.round(ctx.level || 1), 1, 3);
  const root = document.createElement('div');
  root.className = C;
  el.appendChild(root);
  const strip = makeStrip(root, C, meta.title, level, { onExit: () => ctx.onExit && ctx.onExit(), onLevel: l => { level = l; strip.setLevel(l); startRound(); } });
  const stage = document.createElement('div');
  stage.className = `${C}-stage`;
  root.appendChild(stage);
  const svg = svgRoot(VW, VH);
  stage.appendChild(svg);

  const unb = [];
  let trayUnb = [];
  const timers = new Set();
  const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, calm ? Math.min(ms, 300) : ms); timers.add(t); return t; };
  const label = (x, y, text, extra = {}) => S('text', { x, y, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 16, 'letter-spacing': '3', fill: COL.ink3, ...extra }, [text]);

  // ----- static scene -----
  const defs = S('defs', {});
  defs.innerHTML = `<pattern id="${C}-tape" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="22" height="22" fill="${COL.ink}"/><rect width="11" height="22" fill="${PAL.yellow}"/></pattern>`;
  svg.appendChild(defs);
  // Item card (left): white with an ink outline, like a flash card.
  const CARD = { x: 26, y: 20, w: 400, h: 408 };
  const CX = CARD.x + CARD.w / 2;
  svg.appendChild(S('rect', { x: CARD.x, y: CARD.y + 8, width: CARD.w, height: CARD.h, rx: 26, fill: COL.ink }));
  svg.appendChild(S('rect', { x: CARD.x, y: CARD.y, width: CARD.w, height: CARD.h, rx: 26, fill: '#fff', stroke: COL.ink, 'stroke-width': 4 }));
  svg.appendChild(S('circle', { cx: CX, cy: 134, r: 98, fill: COL.surface2 }));
  const itemG = S('g', { class: 'sh-item' });
  svg.appendChild(itemG);
  const nameT = S('text', { x: CX, y: 268, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 26, fill: COL.ink2 });
  svg.appendChild(nameT);
  // Price tag: white with an ink outline.
  const tagG = S('g', { transform: `translate(${CX + 14} 334) rotate(-3)` });
  tagG.appendChild(S('path', { d: 'M-118 -38 H100 A14 14 0 0 1 114 -24 V24 A14 14 0 0 1 100 38 H-118 L-148 0 Z', fill: '#fff', stroke: COL.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
  tagG.appendChild(S('circle', { cx: -122, cy: 0, r: 8, fill: COL.surface2, stroke: COL.ink, 'stroke-width': 3 }));
  const priceT = S('text', { x: -6, y: 3, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 56, fill: COL.ink });
  tagG.appendChild(priceT);
  svg.appendChild(tagG);
  const pipsG = S('g', { transform: `translate(${CX - 7 * 14} 402)` });
  svg.appendChild(pipsG);
  // Counter (right): a soft well.
  const CNT = { x: 456, y: 20, w: 798, h: 300 };
  const CNX = CNT.x + CNT.w / 2;
  svg.appendChild(S('rect', { x: CNT.x, y: CNT.y, width: CNT.w, height: CNT.h, rx: 26, fill: COL.surface2, stroke: COL.line, 'stroke-width': 3 }));
  svg.appendChild(label(CNT.x + 32, CNT.y + 40, 'ON THE COUNTER'));
  const paidT = S('text', { class: 'sh-paid', x: CNT.x + CNT.w - 30, y: CNT.y + 50, 'text-anchor': 'end', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 40, fill: COL.ink });
  svg.appendChild(paidT);
  const counterG = S('g', {});
  svg.appendChild(counterG);
  const msgT = S('text', { x: CNX, y: 384, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 29, fill: COL.ink2 });
  svg.appendChild(msgT);
  // Coin tray (bottom): a soft shelf with a solid lip.
  const SH = { x: 26, y: 452, w: 1228, h: 192 };
  svg.appendChild(S('rect', { x: SH.x, y: SH.y + 8, width: SH.w, height: SH.h, rx: 26, fill: COL.line }));
  svg.appendChild(S('rect', { x: SH.x, y: SH.y, width: SH.w, height: SH.h, rx: 26, fill: COL.surface2, stroke: COL.line, 'stroke-width': 3 }));
  svg.appendChild(label(SH.x + 32, SH.y + 38, 'YOUR COINS'));
  const trayG = S('g', {});
  svg.appendChild(trayG);
  const flyG = S('g', {});
  svg.appendChild(flyG);

  // ----- state -----
  let R, coinsAll, broken, brokenCoin, items, idx, price, paid, stars, fewestCount, locked, sumEl = null, banner = null;
  const trayX = {};
  const TRAY_Y = 548;

  const avail = () => coinsAll.filter(c => c !== broken);
  const total = () => paid.reduce((a, c) => a + c.v, 0);

  function makePrices() {
    const out = [];
    for (let i = 0; i < ROUND; i++) {
      const isBroken = i >= BROKEN_FROM && i <= BROKEN_TO;
      let p;
      for (let k = 0; k < 200; k++) {
        if (level === 1) p = R.int(3, 20);
        else if (level === 2) p = R.int(11, 99);
        else p = R.chance(0.7) ? R.int(101, 199) : R.int(55, 200);
        if (out.includes(p)) continue;
        if (fewest(p, SETS[level]) < 2 && R.chance(0.8)) continue; // mostly not a single coin
        if (isBroken && !greedy(p, SETS[level]).includes(brokenCoin)) continue;
        break;
      }
      out.push(p);
    }
    return out;
  }

  function drawTray() {
    trayUnb.forEach(u => u()); trayUnb = [];
    trayG.replaceChildren();
    const n = coinsAll.length;
    const cw = (SH.w - 60) / n;
    coinsAll.forEach((v, i) => {
      const x = SH.x + 30 + cw * (i + 0.5);
      trayX[v] = x;
      const g = S('g', { class: `sh-tc${v === broken ? ' sh-broken' : ''}`, transform: `translate(${x} ${TRAY_Y})`, role: 'button', 'aria-label': COINS[v].label, 'data-v': v });
      g.appendChild(S('rect', { x: -cw / 2 + 4, y: -88, width: cw - 8, height: 180, fill: 'transparent' }));
      g.appendChild(coinPic(v));
      if (v === broken) {
        const tape = S('g', { transform: `translate(0 ${COINS[v].d * 0.3}) rotate(-12)` });
        tape.appendChild(S('rect', { x: -64, y: -11, width: 128, height: 22, rx: 4, fill: `url(#${C}-tape)`, stroke: COL.ink, 'stroke-width': 2.5 }));
        g.appendChild(tape);
        g.appendChild(S('text', { y: 80, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 20, fill: PAL.orangeDark }, [`${COINS[v].label} out of order`]));
      }
      trayG.appendChild(g);
      if (v !== broken) trayUnb.push(onTap(g, () => addCoin(v)));
    });
  }

  function counterPos(i, count) {
    const perRow = 7, sp = 106;
    const row = Math.floor(i / perRow), col = i % perRow;
    const inRow = Math.min(perRow, count - row * perRow);
    const rows = Math.ceil(count / perRow);
    const cx = CNX + (col - (inRow - 1) / 2) * sp;
    const cy = rows > 1 ? 134 + row * 110 : 186;
    return { x: cx, y: Math.min(cy, 262) };
  }
  function layoutCounter() {
    paid.forEach((c, i) => {
      const p = counterPos(i, paid.length);
      c.g.style.transform = `translate(${p.x}px, ${p.y}px)`;
    });
    const t = total();
    paidT.textContent = t ? fmt(t) : '';
    paidT.setAttribute('fill', t === price ? '#15803d' : COL.ink);
  }

  function addCoin(v) {
    if (locked || v === broken) return;
    sfx('click');
    const g = S('g', { class: 'sh-cc sh-mv', 'data-v': v });
    g.appendChild(S('circle', { r: COINS[v].d / 2 + 10, fill: 'transparent' }));
    g.appendChild(coinPic(v));
    g.style.transform = `translate(${trayX[v]}px, ${TRAY_Y}px)`;
    counterG.appendChild(g);
    const c = { v, g };
    paid.push(c);
    void g.getBoundingClientRect();
    layoutCounter();
    c.unb = onTap(g, () => removeCoin(c));
    afterChange();
  }
  function removeCoin(c) {
    if (locked) return;
    const i = paid.indexOf(c);
    if (i < 0) return;
    sfx('tick');
    paid.splice(i, 1);
    c.unb && c.unb();
    c.g.style.transform = `translate(${trayX[c.v] ?? 640}px, ${TRAY_Y}px)`;
    c.g.style.opacity = '0';
    c.g.style.pointerEvents = 'none';
    later(300, () => c.g.remove());
    layoutCounter();
    afterChange();
  }
  function msg(text, col = COL.ink2) { msgT.textContent = text; msgT.setAttribute('fill', col); }

  function afterChange() {
    const t = total();
    if (t === price) bought();
    else if (t > price) msg(`Too much: ${fmt(t)}. Tap a coin to take it back.`, PAL.orangeDark);
    else msg(t ? '' : 'Tap the coins to pay.');
  }

  function bought() {
    locked = true;
    const used = paid.length;
    const min = fewest(price, avail());
    const isFewest = used === min;
    stars += isFewest ? 2 : 1;
    if (isFewest) fewestCount++;
    strip.setTally(`★ ${stars}`, true);
    sfx('chime');
    if (isFewest) later(260, () => sfx('pop'));
    msg(isFewest ? `Bought! Fewest coins! ★ ★` : `Bought! ★  There's a way with ${min} ${min === 1 ? 'coin' : 'coins'} too.`, '#15803d');
    itemG.classList.add('sh-sold');
    later(700, () => {
      paid.forEach(c => { c.unb && c.unb(); c.g.style.transform = `translate(1400px, ${c.g.style.transform.match(/,\s*([\d.]+)px/)?.[1] || 180}px)`; c.g.style.opacity = '0'; });
    });
    later(isFewest ? 1900 : 2600, () => {
      counterG.replaceChildren();
      paid = [];
      idx++;
      pips();
      if (idx >= ROUND) finish();
      else nextItem();
    });
  }

  function showBanner(main, sub, cls = '') {
    if (banner) banner.remove();
    banner = document.createElement('div');
    banner.className = `${C}-banner ${cls}`;
    banner.innerHTML = `<div class="k">${esc(main)}</div>${sub ? `<div class="r">${esc(sub)}</div>` : ''}`;
    stage.appendChild(banner);
    const b = banner;
    later(2300, () => { b.classList.add('out'); later(420, () => { b.remove(); if (banner === b) banner = null; }); });
  }

  function nextItem() {
    // Rule changes at the edges of the broken stretch.
    if (idx === BROKEN_FROM) {
      broken = brokenCoin;
      drawTray();
      locked = true;
      sfx('clunk');
      showBanner(`The ${COINS[broken].label} slot is broken!`, `Pay without ${COINS[broken].label} coins for now.`);
      say(`The ${COINS[broken].label} slot is broken!`);
      later(2600, presentItem);
      return;
    }
    if (idx === BROKEN_TO + 1 && broken) {
      broken = null;
      drawTray();
      locked = true;
      sfx('chime');
      showBanner('Fixed!', `The ${COINS[brokenCoin].label} slot works again.`, 'fixed');
      later(2200, presentItem);
      return;
    }
    presentItem();
  }
  function presentItem() {
    const it = items[idx];
    price = it.price;
    itemG.classList.remove('sh-sold');
    itemG.classList.add('sh-enter');
    itemG.replaceChildren();
    const a = S('g', { transform: `translate(${CX - 86} 48) scale(1.72)` });
    a.innerHTML = artInner(it.art);
    itemG.appendChild(a);
    nameT.textContent = it.name;
    priceT.textContent = fmt(price);
    paidT.textContent = '';
    requestAnimationFrame(() => requestAnimationFrame(() => itemG.classList.remove('sh-enter')));
    locked = false;
    msg('Tap the coins to pay.');
    pips();
    say(`${it.name}: ${sayPrice(price)}.`);
  }
  function pips() {
    pipsG.replaceChildren();
    for (let i = 0; i < ROUND; i++) {
      const done = i < idx, now = i === idx;
      pipsG.appendChild(S('circle', { cx: i * 28, cy: 0, r: 9, fill: done ? COL.good : '#fff', stroke: done ? COL.good : now ? COL.ink : COL.lineStrong, 'stroke-width': 3 }));
    }
  }

  const bestAll = () => { const b = load('best'); return b && typeof b === 'object' ? b : {}; };
  function showBest() { const b = bestAll()[level]; strip.setNote(b ? `Best ${b} stars` : ''); }

  function finish() {
    locked = true;
    const b = bestAll();
    const prev = b[level] || 0;
    const isBest = stars > prev;
    if (isBest) { b[level] = stars; save('best', b); }
    save('plays', (load('plays') || 0) + 1);
    showBest();
    sfx('chime');
    sumEl = document.createElement('div');
    sumEl.className = `${C}-sum`;
    sumEl.innerHTML = `<div class="${C}-card">
      <div class="eb">Shopping done</div>
      <div class="big">${withStars(`★ ${stars}`, 64)}</div>
      <p>${ROUND} things bought, ${fewestCount} with the fewest coins</p>
      <p class="best">${isBest ? 'Your best yet at this level.' : prev ? `Your best at level ${level}: ${prev} stars` : ''}</p>
      <div class="row"><button type="button" class="${C}-btn go">Play again</button>${level < 3 ? `<button type="button" class="${C}-btn ghost up">Try level ${level + 1}</button>` : ''}</div>
    </div>`;
    root.appendChild(sumEl);
    const u = [];
    u.push(onTap(sumEl.querySelector('.go'), () => { u.forEach(f => f()); startRound(); }));
    const up = sumEl.querySelector('.up');
    if (up) u.push(onTap(up, () => { u.forEach(f => f()); level += 1; strip.setLevel(level); startRound(); }));
  }

  function startRound() {
    timers.forEach(t => clearTimeout(t)); timers.clear();
    if (sumEl) { sumEl.remove(); sumEl = null; }
    if (banner) { banner.remove(); banner = null; }
    R = makeRand();
    coinsAll = SETS[level];
    brokenCoin = level === 1 ? R.pick([5, 10]) : level === 2 ? 20 : R.pick([20, 50, 100]);
    broken = null;
    const prices = makePrices();
    const pool = R.shuffle(ITEMS);
    items = prices.map((p, i) => ({ ...pool[i % pool.length], price: p }));
    idx = 0; stars = 0; fewestCount = 0; paid = [];
    counterG.replaceChildren();
    strip.setTally('★ 0');
    showBest();
    drawTray();
    presentItem();
  }

  startRound();

  // Tests only.
  const debug = !!(ctx.debug || /[?&]arcdebug\b/.test(location.search));
  if (debug) {
    const client = (x, y) => { const m = svg.getScreenCTM(); const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; const q = pt.matrixTransform(m); return { cx: q.x, cy: q.y }; };
    window.__arc = {
      id: meta.id,
      price: () => price,
      total,
      idx: () => idx,
      locked: () => locked,
      broken: () => broken,
      stars: () => stars,
      fewest: () => fewest(price, avail()),
      plan: () => greedy(price, avail()),
      trayCoin: v => (coinsAll.includes(v) ? { el: trayG.querySelector(`.sh-tc[data-v="${v}"]`), ...client(trayX[v], TRAY_Y) } : { el: null }),
      counter: () => paid.map((c, i) => ({ v: c.v, el: c.g, ...client(counterPos(i, paid.length).x, counterPos(i, paid.length).y) })),
      message: () => msgT.textContent,
    };
  }

  return {
    destroy() {
      timers.forEach(t => clearTimeout(t)); timers.clear();
      trayUnb.forEach(u => u()); unb.forEach(u => u());
      paid && paid.forEach(c => c.unb && c.unb());
      strip.destroy();
      if (debug && window.__arc && window.__arc.id === meta.id) delete window.__arc;
      el.replaceChildren();
    },
  };
}
