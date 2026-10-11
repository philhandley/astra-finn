// Shop Run (SVG). Pay the exact price with UK coins; a bonus star for using the fewest coins.
// Mid-round one coin slot breaks for a few items ("The 20p slot is broken!"). No timer, no fail.
// Tests only: ctx.debug or ?arcdebug exposes window.__arc (price, total, trayCoin, counter, bought).
import { S, svgRoot, onTap, injectCSS, clamp, esc, reducedMotion } from '../core/dom.js';
import { makeRand } from '../core/rand.js';
import { COL, FONT } from '../core/theme.js';
import { artInner } from '../core/art.js';
import { sfx as coreSfx } from '../core/sfx.js';

export const meta = { id: 'shoprun', title: 'Shop Run', about: 'Pay the exact price with the fewest coins.', icon: 'fuel' };

const C = 'arc-shop';
const VW = 1280, VH = 636;
const ROUND = 8;
const BROKEN_FROM = 3, BROKEN_TO = 5; // item indexes (0-based) with a broken coin slot

const COPPER = { fill: '#c97a4b', rim: '#97512c', hi: '#e8a477', ink: '#3a1a08' };
const SILVERC = { fill: '#d3d9e1', rim: '#98a3b2', hi: '#f1f4f8', ink: '#1b2332' };
const GOLDC = { fill: '#e2bd57', rim: '#b08a2a', hi: '#f6dc8c', ink: '#3a2a05' };
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
const BACK = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function stripCSS(c) {
  return `
  .${c} { position: absolute; inset: 0; display: flex; flex-direction: column; color: var(--ink, #f3efe6); font-family: var(--font-body, system-ui); overflow: hidden; user-select: none; -webkit-user-select: none; }
  .${c}-top { flex: none; height: 84px; display: flex; align-items: center; gap: 18px; padding: 0 18px; border-bottom: 1px solid var(--line, rgba(255,255,255,.12)); background: rgba(5,8,18,.6); position: relative; z-index: 3; }
  .${c} button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .${c}-exit { appearance: none; min-height: 64px; min-width: 64px; padding: 0 22px 0 14px; border-radius: 999px; border: 1.5px solid var(--line, rgba(255,255,255,.12)); background: rgba(255,255,255,.04); color: var(--ink, #f3efe6); font: 600 22px ${FONT.display}; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
  .${c}-exit:active { transform: scale(.96); }
  .${c}-title { flex: 1; font: 600 28px ${FONT.display}; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .${c}-lv { display: flex; align-items: center; gap: 8px; }
  .${c}-lv span { font: 600 15px ${FONT.display}; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3, #7d869a); margin-right: 4px; }
  .${c}-lv button { appearance: none; width: 64px; height: 64px; border-radius: 50%; border: 1.5px solid var(--line, rgba(255,255,255,.12)); background: transparent; color: var(--ink, #f3efe6); font: 600 26px ${FONT.display}; cursor: pointer; transition: background .2s, color .2s; }
  .${c}-lv button.on { background: var(--gold, #f2b544); border-color: var(--gold, #f2b544); color: #1a1205; }
  .${c}-tally { min-width: 130px; text-align: right; line-height: 1.1; }
  .${c}-tally b { font: 700 30px ${FONT.display}; color: var(--gold, #f2b544); }
  .${c}-tally small { display: block; font: 500 16px ${FONT.display}; color: var(--ink-3, #7d869a); margin-top: 3px; }
  .${c}-tally b.bump { animation: ${c}-bump .35s ease; display: inline-block; }
  @keyframes ${c}-bump { 40% { transform: scale(1.3); } }
  .${c}-sum { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(4,6,14,.62); z-index: 5; animation: ${c}-fade .3s ease; }
  .${c}-sum .${c}-card { min-width: 460px; max-width: 640px; text-align: center; padding: 34px 40px 30px; border-radius: 24px; background: #111a2e; border: 1px solid rgba(255,255,255,.14); box-shadow: 0 20px 60px rgba(0,0,0,.5); }
  .${c}-sum .eb { font: 600 16px ${FONT.display}; letter-spacing: .16em; text-transform: uppercase; color: var(--gold, #f2b544); }
  .${c}-sum .big { font: 700 64px ${FONT.display}; color: var(--gold, #f2b544); margin: 10px 0 2px; }
  .${c}-sum p { margin: 6px 0; font-size: 22px; color: var(--ink-2, #b9c0cf); }
  .${c}-sum p.best { font-size: 18px; color: var(--ink-3, #7d869a); }
  .${c}-sum .row { display: flex; gap: 14px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
  .${c}-btn { appearance: none; border: 0; min-height: 64px; padding: 0 30px; border-radius: 999px; font: 600 23px ${FONT.display}; background: var(--gold, #f2b544); color: #1a1205; cursor: pointer; }
  .${c}-btn.ghost { background: transparent; color: var(--ink, #f3efe6); border: 1.5px solid rgba(255,255,255,.18); }
  .${c}-btn:active { transform: scale(.96); }
  @keyframes ${c}-fade { from { opacity: 0; } to { opacity: 1; } }
  `;
}
function makeStrip(root, c, title, level, { onExit, onLevel }) {
  const top = document.createElement('div');
  top.className = `${c}-top`;
  top.innerHTML = `<button type="button" class="${c}-exit" aria-label="Exit">${BACK}Exit</button>
    <div class="${c}-title">${esc(title)}</div>
    <div class="${c}-lv" role="group" aria-label="Level"><span>Level</span>${[1, 2, 3].map(n => `<button type="button" data-l="${n}" aria-label="Level ${n}">${n}</button>`).join('')}</div>
    <div class="${c}-tally" aria-live="polite"><b>★ 0</b><small></small></div>`;
  root.appendChild(top);
  const unb = [onTap(top.querySelector(`.${c}-exit`), () => onExit())];
  top.querySelectorAll(`.${c}-lv button`).forEach(b => unb.push(onTap(b, () => onLevel(+b.dataset.l))));
  const tb = top.querySelector(`.${c}-tally b`), ts = top.querySelector(`.${c}-tally small`);
  const api = {
    setLevel(l) { top.querySelectorAll(`.${c}-lv button`).forEach(b => b.classList.toggle('on', +b.dataset.l === l)); },
    setTally(html, bump) { tb.innerHTML = html; if (bump) { tb.classList.remove('bump'); void tb.offsetWidth; tb.classList.add('bump'); } },
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
  g.appendChild(S('path', { d: shapePath(c.shape, r), fill: 'rgba(0,0,0,.4)', transform: 'translate(2 4)' }));
  g.appendChild(S('path', { d: shapePath(c.shape, r), fill: m.fill, stroke: m.rim, 'stroke-width': 3 }));
  if (c.inner) {
    g.appendChild(S('circle', { r: r * 0.64, fill: c.inner.fill, stroke: c.inner.rim, 'stroke-width': 2 }));
  } else {
    g.appendChild(S('path', { d: shapePath(c.shape, r * 0.84), fill: 'none', stroke: m.rim, 'stroke-width': 1.5, opacity: 0.6 }));
  }
  g.appendChild(S('path', { d: `M${-r * 0.55} ${-r * 0.55} A${r * 0.78} ${r * 0.78} 0 0 1 ${r * 0.35} ${-r * 0.72}`, fill: 'none', stroke: (c.inner || m).hi, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.7 }));
  const fs = Math.max(24, Math.round(r * (c.label.length > 2 ? 0.56 : 0.66)));
  g.appendChild(S('text', { y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 700, 'font-size': fs, fill: (c.inner || m).ink }, [c.label]));
  return g;
}

// ---------- the game ----------
export function mount(el, ctx = {}) {
  injectCSS(C, stripCSS(C) + `
  .${C}-stage { flex: 1; min-height: 0; position: relative; }
  .${C}-stage svg { position: absolute; inset: 0; }
  .${C} .sh-tc { cursor: pointer; }
  .${C} .sh-tc:active .sh-coin { transform: scale(.94); }
  .${C} .sh-tc.sh-broken { cursor: default; }
  .${C} .sh-tc.sh-broken .sh-coin { opacity: .5; }
  .${C} .sh-cc { cursor: pointer; }
  .${C} .sh-mv { transition: transform .28s cubic-bezier(.2,.8,.3,1), opacity .28s; }
  .${C} .sh-item { transition: transform .5s cubic-bezier(.2,.8,.3,1), opacity .5s; transform-box: fill-box; transform-origin: center; }
  .${C} .sh-item.sh-sold { transform: scale(1.18) translateY(-12px); opacity: 0; }
  .${C} .sh-item.sh-enter { transform: scale(.6); opacity: 0; }
  .${C}-banner { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; z-index: 4; padding: 24px 48px; border-radius: 26px; background: rgba(8,12,28,.92); border: 1.5px solid rgba(255,179,107,.7); box-shadow: 0 0 60px rgba(255,179,107,.22); animation: ${C}-pop .45s cubic-bezier(.2,1.4,.4,1); }
  .${C}-banner .k { font: 700 44px ${FONT.display}; color: var(--ink, #f3efe6); }
  .${C}-banner .r { font: 500 26px ${FONT.body}; color: var(--ink-2, #b9c0cf); margin-top: 6px; }
  .${C}-banner.fixed { border-color: rgba(111,227,165,.7); box-shadow: 0 0 60px rgba(111,227,165,.2); }
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

  // ----- static scene -----
  const defs = S('defs', {});
  defs.innerHTML = `
    <radialGradient id="${C}-spot" cx=".5" cy=".35" r=".65"><stop offset="0" stop-color="#2a3a6a"/><stop offset="1" stop-color="#141d36"/></radialGradient>
    <linearGradient id="${C}-bench" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2a4c"/><stop offset="1" stop-color="#141e38"/></linearGradient>
    <pattern id="${C}-tape" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="22" height="22" fill="#1a1205"/><rect width="11" height="22" fill="#ffb36b"/></pattern>`;
  svg.appendChild(defs);
  // Shop window (left).
  svg.appendChild(S('rect', { x: 30, y: 18, width: 400, height: 382, rx: 28, fill: `url(#${C}-spot)`, stroke: 'rgba(255,255,255,.1)', 'stroke-width': 2 }));
  svg.appendChild(S('ellipse', { cx: 230, cy: 222, rx: 110, ry: 16, fill: 'rgba(0,0,0,.3)' }));
  const itemG = S('g', { class: 'sh-item' });
  svg.appendChild(itemG);
  const nameT = S('text', { x: 230, y: 262, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 26, fill: COL.ink2 });
  svg.appendChild(nameT);
  // Price tag.
  const tagG = S('g', { transform: 'translate(230 318) rotate(-3)' });
  tagG.appendChild(S('path', { d: 'M-118 -38 H100 A12 12 0 0 1 112 -26 V26 A12 12 0 0 1 100 38 H-118 L-146 0 Z', fill: '#f3efe6', stroke: '#d9ccb0', 'stroke-width': 2 }));
  tagG.appendChild(S('circle', { cx: -122, cy: 0, r: 7, fill: '#141d36' }));
  const priceT = S('text', { x: -8, y: 3, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 56, fill: '#0c1430' });
  tagG.appendChild(priceT);
  svg.appendChild(tagG);
  const pipsG = S('g', { transform: 'translate(139 382)' });
  svg.appendChild(pipsG);
  // Counter (right).
  svg.appendChild(S('rect', { x: 460, y: 18, width: 790, height: 290, rx: 28, fill: `url(#${C}-bench)`, stroke: 'rgba(255,255,255,.1)', 'stroke-width': 2 }));
  svg.appendChild(S('text', { x: 494, y: 62, 'font-family': FONT.display, 'font-weight': 600, 'font-size': 18, 'letter-spacing': '3', fill: COL.ink3 }, ['ON THE COUNTER']));
  const paidT = S('text', { x: 1216, y: 66, 'text-anchor': 'end', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 40, fill: COL.ink });
  svg.appendChild(paidT);
  const counterG = S('g', {});
  svg.appendChild(counterG);
  const msgT = S('text', { x: 855, y: 352, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 30, fill: COL.ink2 });
  svg.appendChild(msgT);
  // Coin tray (bottom).
  svg.appendChild(S('rect', { x: 30, y: 400, width: 1220, height: 222, rx: 28, fill: 'rgba(255,255,255,.035)', stroke: 'rgba(255,255,255,.1)', 'stroke-width': 2 }));
  svg.appendChild(S('text', { x: 60, y: 436, 'font-family': FONT.display, 'font-weight': 600, 'font-size': 18, 'letter-spacing': '3', fill: COL.ink3 }, ['YOUR COINS']));
  const trayG = S('g', {});
  svg.appendChild(trayG);
  const flyG = S('g', {});
  svg.appendChild(flyG);

  // ----- state -----
  let R, coinsAll, broken, brokenCoin, items, idx, price, paid, stars, fewestCount, locked, sumEl = null, banner = null;
  const trayX = {};
  const TRAY_Y = 520;

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
    const cw = 1180 / n;
    coinsAll.forEach((v, i) => {
      const x = 50 + cw * (i + 0.5);
      trayX[v] = x;
      const g = S('g', { class: `sh-tc${v === broken ? ' sh-broken' : ''}`, transform: `translate(${x} ${TRAY_Y})`, role: 'button', 'aria-label': COINS[v].label, 'data-v': v });
      g.appendChild(S('rect', { x: -cw / 2 + 4, y: -90, width: cw - 8, height: 186, fill: 'transparent' }));
      g.appendChild(coinPic(v));
      if (v === broken) {
        const tape = S('g', { transform: `translate(0 ${COINS[v].d * 0.3}) rotate(-12)` });
        tape.appendChild(S('rect', { x: -64, y: -11, width: 128, height: 22, rx: 4, fill: `url(#${C}-tape)`, stroke: '#1a1205', 'stroke-width': 2 }));
        g.appendChild(tape);
        g.appendChild(S('text', { y: 84, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 21, fill: COL.warn }, [`${COINS[v].label} out of order`]));
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
    const cx = 855 + (col - (inRow - 1) / 2) * sp;
    const cy = rows > 1 ? 138 + row * 108 : 180;
    return { x: cx, y: Math.min(cy, 262) };
  }
  function layoutCounter() {
    paid.forEach((c, i) => {
      const p = counterPos(i, paid.length);
      c.g.style.transform = `translate(${p.x}px, ${p.y}px)`;
    });
    const t = total();
    paidT.textContent = t ? fmt(t) : '';
    paidT.setAttribute('fill', t === price ? COL.good : COL.ink);
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
    else if (t > price) msg(`Too much: ${fmt(t)}. Tap a coin to take it back.`, COL.warn);
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
    msg(isFewest ? `Bought! Fewest coins! ★ ★` : `Bought! ★  There's a way with ${min} ${min === 1 ? 'coin' : 'coins'} too.`, isFewest ? COL.tens : COL.good);
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
    const a = S('g', { transform: 'translate(135 34) scale(1.9)' });
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
    for (let i = 0; i < ROUND; i++) pipsG.appendChild(S('circle', { cx: i * 26, cy: 0, r: 8, fill: i < idx ? COL.tens : 'none', stroke: i === idx ? COL.tens : 'rgba(255,255,255,.3)', 'stroke-width': 2 }));
  }

  const bestAll = () => { const b = load('best'); return b && typeof b === 'object' ? b : {}; };
  function showBest() { const b = bestAll()[level]; strip.setNote(b ? `Best ★ ${b}` : ''); }

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
      <div class="big">★ ${stars}</div>
      <p>${ROUND} things bought, ${fewestCount} with the fewest coins</p>
      <p class="best">${isBest ? 'Your best yet at this level.' : prev ? `Your best at level ${level}: ★ ${prev}` : ''}</p>
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
