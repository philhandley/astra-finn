// Tile Dock (SVG). A grid of number tiles with gaps; row totals on the right, column totals underneath.
// Drag (or tap, then tap a gap) the loose tiles into the gaps until every row and column adds up.
// Matched totals turn green. Five puzzles make a round.
// Style v2 (Synthesis tile-sums look): white board, peach tiles with dark purple numerals and dot patterns,
// solid orange gaps on a soft peach plate, pill toggles for Hints and New puzzle.
// Tests only: ctx.debug or ?arcdebug exposes window.__arc (puzzle, solved).
import { S, svgRoot, onTap, drag, injectCSS, clamp, esc } from '../core/dom.js';
import { makeRand } from '../core/rand.js';
import { COL, FONT } from '../core/theme.js';
import { artInner } from '../core/art.js';
import { sfx as coreSfx } from '../core/sfx.js';

export const meta = { id: 'tiledock', title: 'Tile Dock', about: 'Slot the tiles in so every row and column adds up.', icon: 'crystal' };

const C = 'arc-tile';
const VW = 1000, VH = 540;
const ROUND = 5;
// Tile colours (Synthesis-like peach and purple).
const TD = {
  plate: '#ffd7ae', plateEdge: '#f8bd83',
  tile: '#ffe4cc', edge: '#f59e0b', lip: '#d98a1c',
  slot: '#fb923c', slotHot: '#f97316',
  num: '#3b1d5e', dot: '#ea7a0c',
};

// ---------- puzzles ----------
function lines(size) {
  const out = [];
  for (let r = 0; r < size; r++) out.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c++) out.push(Array.from({ length: size }, (_, r) => r * size + c));
  return out;
}
// True when the gaps can be filled one at a time, each from a row or column with a single gap.
function deducible(size, blanks) {
  const unknown = new Set(blanks);
  const ls = lines(size);
  let progress = true;
  while (unknown.size && progress) {
    progress = false;
    for (const l of ls) {
      const u = l.filter(i => unknown.has(i));
      if (u.length === 1) { unknown.delete(u[0]); progress = true; }
    }
  }
  return unknown.size === 0;
}
export function makePuzzle(level, R) {
  const size = level === 1 ? 2 : 3;
  const [lo, hi] = level === 1 ? [1, 5] : [1, 9];
  const nBlank = level === 1 ? 2 : level === 2 ? R.int(3, 4) : R.int(4, 5);
  const n = size * size;
  for (let tries = 0; tries < 2000; tries++) {
    const grid = Array.from({ length: n }, () => R.int(lo, hi));
    const rows = [], cols = [];
    for (let r = 0; r < size; r++) rows.push(grid.slice(r * size, r * size + size).reduce((a, b) => a + b, 0));
    for (let c = 0; c < size; c++) { let s = 0; for (let r = 0; r < size; r++) s += grid[r * size + c]; cols.push(s); }
    if (Math.max(...rows, ...cols) > 20) continue;
    if (level > 1 && Math.min(...rows, ...cols) < 7) continue;
    const blanks = R.sample(Array.from({ length: n }, (_, i) => i), nBlank).sort((a, b) => a - b);
    if (lines(size).some(l => l.every(i => blanks.includes(i)))) continue;
    if (!deducible(size, blanks)) continue;
    const tray = R.shuffle(blanks.map(i => grid[i]));
    if (nBlank > 2 && new Set(tray).size === 1) continue;
    return { size, grid, blanks, rows, cols, tray };
  }
  // Fallback that always works.
  return level === 1
    ? { size: 2, grid: [2, 3, 4, 1], blanks: [1, 2], rows: [5, 5], cols: [6, 4], tray: [4, 3] }
    : { size: 3, grid: [2, 5, 3, 4, 1, 6, 3, 2, 4], blanks: [1, 3, 8], rows: [10, 11, 9], cols: [9, 8, 13], tray: [4, 5, 4] };
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

// ---------- the game ----------
export function mount(el, ctx = {}) {
  injectCSS(C, stripCSS(C) + `
  .${C}-board { flex: 1; min-height: 0; margin: 0 12px 12px; border-radius: 26px; background: ${COL.surface}; color: ${COL.ink}; display: flex; flex-direction: column; overflow: hidden; position: relative; }
  .${C}-ctl { flex: none; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 18px; padding: 16px 24px 6px; }
  .${C}-lab { font-weight: 700; font-size: 14px; letter-spacing: .14em; text-transform: uppercase; color: ${COL.ink3}; }
  .${C}-prog { display: flex; align-items: center; gap: 14px; }
  .${C}-pips { display: flex; gap: 9px; align-items: center; }
  .${C}-pips i { width: 20px; height: 20px; border-radius: 50%; border: 3px solid ${COL.line}; background: #fff; transition: background .3s, border-color .3s; }
  .${C}-pips i.done { background: ${TD.edge}; border-color: ${TD.edge}; }
  .${C}-pips i.now { border-color: ${TD.edge}; }
  .${C}-mid { display: flex; align-items: center; gap: 14px; }
  .${C}-seg { display: inline-flex; border: 3px solid ${COL.line}; border-radius: 18px; background: #fff; box-shadow: 0 5px 0 ${COL.line}; overflow: hidden; }
  .${C}-seg button { appearance: none; cursor: pointer; border: 0; min-width: 84px; min-height: 60px; padding: 0 18px; background: #fff; color: ${COL.ink2}; font-weight: 700; font-size: 21px; transition: background .15s, color .15s; }
  .${C}-seg button + button { border-left: 3px solid ${COL.line}; }
  .${C}-seg button.on { background: #ffdcb8; color: ${TD.num}; }
  .${C}-new { appearance: none; cursor: pointer; min-height: 60px; min-width: 60px; padding: 0 22px; border-radius: 18px; border: 3px solid ${COL.line}; background: #fff; color: ${COL.ink}; font-weight: 700; font-size: 21px; box-shadow: 0 5px 0 ${COL.line}; display: inline-flex; align-items: center; gap: 8px; transition: transform .1s ease, box-shadow .1s ease; }
  .${C}-new svg { width: 24px; height: 24px; }
  .${C}-new:active { transform: translateY(4px); box-shadow: 0 1px 0 ${COL.line}; }
  .${C}-msg { text-align: right; font-size: 19px; font-weight: 500; line-height: 1.3; color: ${COL.ink2}; }
  .${C}-msg b { color: #15803d; font-weight: 800; }
  .${C}-stage { flex: 1; min-height: 0; position: relative; }
  .${C}-stage svg { position: absolute; inset: 0; }
  .${C} svg .td-plate { fill: ${TD.plate}; stroke: ${TD.plateEdge}; stroke-width: 3; transition: stroke .3s, stroke-width .3s; }
  .${C} svg.td-solved .td-plate { stroke: ${COL.good}; stroke-width: 6; }
  .${C} svg .td-slot { fill: ${TD.slot}; stroke: transparent; stroke-width: 5; transition: fill .15s, stroke .15s; }
  .${C} svg .td-slot.td-ready { stroke: #fff; stroke-width: 4; stroke-dasharray: 10 8; }
  .${C} svg .td-slot.td-hot { fill: ${TD.slotHot}; stroke: ${COL.focus}; stroke-width: 6; stroke-dasharray: none; }
  .${C} svg .td-tile { cursor: grab; }
  .${C} svg .td-tile.td-sel .td-face { stroke: ${COL.focus}; stroke-width: 6; }
  .${C} svg .td-num { transition: transform .2s ease; }
  .${C} svg.td-nohints .td-num { transform: translateY(var(--td-shift, 10px)); }
  .${C} svg .td-dots { transition: opacity .2s; }
  .${C} svg.td-nohints .td-dots { opacity: 0; }
  .${C} svg .td-tot rect { fill: ${COL.surface2}; stroke: transparent; stroke-width: 3; transition: fill .25s, stroke .25s; }
  .${C} svg .td-tot text { fill: ${COL.ink}; transition: fill .25s; }
  .${C} svg .td-tot.td-ok rect { fill: ${COL.goodSoft}; stroke: ${COL.good}; }
  .${C} svg .td-tot.td-ok text { fill: #15803d; }
  .${C} svg .td-traywell { transition: opacity .3s; }
  .${C} svg.td-solved .td-traywell { opacity: 0; }
  .${C} svg .td-docked { opacity: 0; transition: opacity .3s; pointer-events: none; }
  .${C} svg.td-solved .td-docked { opacity: 1; }
  `);

  const say = t => { try { ctx.say && ctx.say(t); } catch (e) { /* ignore */ } };
  const sfx = n => { try { (ctx.sfx || coreSfx)(n); } catch (e) { /* ignore */ } };
  const load = k => { try { return ctx.load ? ctx.load(k) : null; } catch (e) { return null; } };
  const save = (k, v) => { try { ctx.save && ctx.save(k, v); } catch (e) { /* ignore */ } };

  let level = clamp(Math.round(ctx.level || 1), 1, 3);
  const root = document.createElement('div');
  root.className = C;
  el.appendChild(root);
  const strip = makeStrip(root, C, meta.title, level, { onExit: () => ctx.onExit && ctx.onExit(), onLevel: l => { level = l; strip.setLevel(l); startRound(); } });
  const body = document.createElement('div');
  body.className = `${C}-board`;
  const REFRESH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  body.innerHTML = `<div class="${C}-ctl">
      <div class="${C}-prog"><span class="${C}-lab">Puzzle</span><div class="${C}-pips"></div></div>
      <div class="${C}-mid">
        <span class="${C}-lab">Hints</span>
        <div class="${C}-seg" role="group" aria-label="Hints"><button type="button" data-h="1">On</button><button type="button" data-h="0">Off</button></div>
        <button type="button" class="${C}-new newp">${REFRESH}New puzzle</button>
      </div>
      <div class="${C}-msg" aria-live="polite"></div>
    </div>
    <div class="${C}-stage"></div>`;
  root.appendChild(body);
  const stage = body.querySelector(`.${C}-stage`);
  const msgEl = body.querySelector(`.${C}-msg`);
  const pipsEl = body.querySelector(`.${C}-pips`);
  const svg = svgRoot(VW, VH);
  stage.appendChild(svg);
  const unb = [];
  const timers = new Set();
  const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

  let hints = load('hints');
  const setHints = on => {
    hints = !!on;
    svg.classList.toggle('td-nohints', !hints);
    body.querySelectorAll(`.${C}-seg button`).forEach(b => b.classList.toggle('on', (b.dataset.h === '1') === hints));
  };
  body.querySelectorAll(`.${C}-seg button`).forEach(b => unb.push(onTap(b, () => { setHints(b.dataset.h === '1'); save('hints', hints); sfx('click'); })));
  unb.push(onTap(body.querySelector('.newp'), () => { if (!locked) { sfx('whoosh'); newPuzzle(); } }));

  let R, P, G, tiles, placed, selected, locked, solvedCount, sumEl = null;
  let tileUnb = [];

  const total = () => +(load('docked') || 0);
  const showNote = () => { const t = total(); strip.setNote(t ? `Docked ${t}` : ''); };

  // Layout: the grid on its peach plate, row totals to the right, column totals underneath, the tile dock on the far right.
  function geom(size, nTray) {
    const cell = size === 2 ? 160 : 118, gap = size === 2 ? 18 : 12, pad = 18, totW = 84, totH = 58;
    const gridW = size * cell + (size - 1) * gap;
    const plateW = gridW + 2 * pad;
    const blockW = plateW + 24 + totW, blockH = plateW + 22 + totH;
    const tCols = nTray <= 2 ? 1 : 2, tRows = Math.ceil(nTray / tCols), tg = 20, tp = 22;
    const trayW = tCols * cell + (tCols - 1) * tg + 2 * tp, trayH = tRows * cell + (tRows - 1) * tg + 2 * tp;
    const between = 64;
    const bx = (VW - (blockW + between + trayW)) / 2, by = (VH - blockH) / 2;
    const x0 = bx + pad, y0 = by + pad;
    const at = i => ({ x: x0 + (i % size) * (cell + gap), y: y0 + Math.floor(i / size) * (cell + gap) });
    const tx = bx + blockW + between, ty = by + (plateW - trayH) / 2;
    const trayAt = k => {
      const row = Math.floor(k / tCols), col = k % tCols;
      const inRow = Math.min(tCols, nTray - row * tCols);
      const shift = inRow < tCols ? ((tCols - inRow) * (cell + tg)) / 2 : 0;
      return { x: tx + tp + shift + col * (cell + tg), y: ty + tp + row * (cell + tg) };
    };
    return { cell, gap, pad, totW, totH, gridW, plateW, bx, by, x0, y0, at, rowX: bx + plateW + 24 + totW / 2, colY: by + plateW + 22 + totH / 2, tray: { x: tx, y: ty, w: trayW, h: trayH }, trayAt };
  }
  const trayPos = k => G.trayAt(k);

  function dotsFor(v, cell) {
    const g = S('g', { class: 'td-dots' });
    const r = cell * 0.04, sp = cell * 0.118;
    const rowsN = v > 5 ? 2 : 1;
    for (let i = 0; i < v; i++) {
      const row = i < 5 ? 0 : 1;
      const inRow = row === 0 ? Math.min(v, 5) : v - 5;
      const k = row === 0 ? i : i - 5;
      const cx = cell / 2 + (k - (inRow - 1) / 2) * sp;
      const cy = rowsN === 1 ? cell * 0.79 : cell * (0.74 + row * 0.11);
      g.appendChild(S('circle', { cx, cy, r, fill: TD.dot }));
    }
    return g;
  }
  function tileFace(v, movable) {
    const cell = G.cell;
    const g = S('g', {});
    if (movable) g.appendChild(S('rect', { x: 0, y: 7, width: cell, height: cell, rx: 18, fill: TD.lip }));
    g.appendChild(S('rect', { class: 'td-face', x: 1.5, y: 1.5, width: cell - 3, height: cell - 3, rx: 17, fill: TD.tile, stroke: TD.edge, 'stroke-width': 3 }));
    g.appendChild(S('text', { class: 'td-num', x: cell / 2, y: cell * 0.42, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 800, 'font-size': Math.round(cell * 0.46), fill: TD.num }, [String(v)]));
    g.appendChild(dotsFor(v, cell));
    return g;
  }
  function place(t, x, y, animate = true) {
    t.x = x; t.y = y;
    t.g.style.transition = animate ? 'transform .22s cubic-bezier(.2,.8,.3,1)' : 'none';
    t.g.style.transform = `translate(${x}px, ${y}px)`;
  }
  function home(t) {
    const p = trayPos(t.home);
    place(t, p.x, p.y);
  }

  let layers = {};
  function build() {
    tileUnb.forEach(u => u()); tileUnb = [];
    svg.replaceChildren();
    svg.classList.remove('td-solved');
    G = geom(P.size, P.tray.length);
    svg.style.setProperty('--td-shift', `${Math.round(G.cell * 0.08)}px`);
    const L = n => { const g = S('g', { class: n }); svg.appendChild(g); return g; };
    layers = { frame: L('l-frame'), fixed: L('l-fixed'), slots: L('l-slots'), tot: L('l-tot'), tray: L('l-tray'), msg: L('l-msg'), tiles: L('l-tiles'), drag: L('l-drag') };
    layers.frame.appendChild(S('rect', { class: 'td-plate', x: G.bx, y: G.by, width: G.plateW, height: G.plateW, rx: 26 }));
    P.grid.forEach((v, i) => {
      const p = G.at(i);
      if (P.blanks.includes(i)) {
        const s = S('rect', { class: 'td-slot', x: p.x, y: p.y, width: G.cell, height: G.cell, rx: 18, 'data-cell': i });
        layers.slots.appendChild(s);
        tileUnb.push(onTap(s, () => { if (!locked && selected) { moveTo(selected, i); } }));
      } else {
        const f = tileFace(v, false);
        f.setAttribute('transform', `translate(${p.x} ${p.y})`);
        layers.fixed.appendChild(f);
      }
    });
    // Totals: soft pills in ink; matched ones go green.
    const totEls = { rows: [], cols: [] };
    const tot = (x, y, val) => {
      const g = S('g', { class: 'td-tot', transform: `translate(${x} ${y})` });
      g.appendChild(S('rect', { x: -G.totW / 2, y: -G.totH / 2, width: G.totW, height: G.totH, rx: G.totH / 2 }));
      g.appendChild(S('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 2, 'font-family': FONT.display, 'font-weight': 800, 'font-size': 36 }, [String(val)]));
      layers.tot.appendChild(g);
      return g;
    };
    for (let r = 0; r < P.size; r++) totEls.rows.push(tot(G.rowX, G.y0 + r * (G.cell + G.gap) + G.cell / 2, P.rows[r]));
    for (let c = 0; c < P.size; c++) totEls.cols.push(tot(G.x0 + c * (G.cell + G.gap) + G.cell / 2, G.colY, P.cols[c]));
    P.totEls = totEls;
    // Tile dock: a soft well on the right.
    layers.tray.appendChild(S('rect', { class: 'td-traywell', x: G.tray.x, y: G.tray.y, width: G.tray.w, height: G.tray.h, rx: 26, fill: COL.surface2, stroke: COL.line, 'stroke-width': 3 }));
    // Movable tiles.
    tiles = P.tray.map((v, k) => {
      const g = S('g', { class: 'td-tile', role: 'button', 'aria-label': `Tile ${v}` });
      g.appendChild(tileFace(v, true));
      layers.tiles.appendChild(g);
      const t = { id: k, v, home: k, at: null, g, x: 0, y: 0 };
      home(t); place(t, t.x, t.y, false);
      bindTile(t);
      return t;
    });
    placed = new Map();
    selected = null;
    // "Docked!" where the tile dock was.
    const cx = G.tray.x + G.tray.w / 2, cy = G.tray.y + G.tray.h / 2;
    const m = S('g', { class: 'td-docked' });
    const star = S('g', { transform: `translate(${cx - 55} ${cy - 108}) scale(1.1)` });
    star.innerHTML = artInner('star');
    m.appendChild(star);
    m.appendChild(S('text', { x: cx, y: cy + 46, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 46, fill: '#15803d' }, ['Docked!']));
    layers.msg.appendChild(m);
    check(false);
  }

  function slotCentre(i) { const p = G.at(i); return { x: p.x + G.cell / 2, y: p.y + G.cell / 2 }; }
  function nearestSlot(cx, cy) {
    let best = null, bd = G.cell * 0.72;
    for (const i of P.blanks) {
      const s = slotCentre(i);
      const d = Math.hypot(s.x - cx, s.y - cy);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function select(t) {
    selected = t;
    tiles.forEach(x => x.g.classList.toggle('td-sel', x === t));
    layers.slots.querySelectorAll('.td-slot').forEach(s => s.classList.toggle('td-ready', !!t));
  }
  // Move tile t into cell i (or back to the tray when i is null). Swaps out any tile already there.
  function moveTo(t, i) {
    const from = t.at;
    if (from !== null) placed.delete(from);
    if (i === null) {
      t.at = null; home(t); sfx('click');
    } else {
      const other = placed.get(i);
      if (other && other !== t) {
        if (from !== null) { other.at = from; placed.set(from, other); const p = G.at(from); place(other, p.x, p.y); }
        else { other.at = null; home(other); }
      }
      t.at = i; placed.set(i, t);
      const p = G.at(i);
      place(t, p.x, p.y);
      sfx('pop');
    }
    select(null);
    check(true);
  }

  function bindTile(t) {
    let start = null, off = null, ghost = null, moved = 0;
    tileUnb.push(drag(t.g, {
      start(p) {
        if (locked) { start = null; return; }
        start = p; moved = 0;
        off = { x: p.x - t.x, y: p.y - t.y };
        ghost = t.g.cloneNode(true);
        ghost.style.transition = 'none';
        ghost.style.pointerEvents = 'none';
        ghost.classList.add('td-ghost');
        ghost.style.filter = 'drop-shadow(0 12px 14px rgba(27,30,46,.28))';
        layers.drag.appendChild(ghost);
        t.g.style.opacity = '0';
      },
      move(p) {
        if (!start) return;
        moved = Math.max(moved, Math.hypot(p.x - start.x, p.y - start.y));
        const x = p.x - off.x, y = p.y - off.y;
        ghost.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
        const s = moved > 10 ? nearestSlot(x + G.cell / 2, y + G.cell / 2) : null;
        layers.slots.querySelectorAll('.td-slot').forEach(el2 => el2.classList.toggle('td-hot', +el2.dataset.cell === s));
      },
      end(p) {
        if (!start) return;
        const x = p.x - off.x, y = p.y - off.y;
        if (ghost) ghost.remove();
        ghost = null;
        layers.slots.querySelectorAll('.td-slot.td-hot').forEach(s => s.classList.remove('td-hot'));
        const wasTap = Math.max(moved, Math.hypot(p.x - start.x, p.y - start.y)) < 10;
        start = null;
        // Start the real tile from where the ghost was, then glide it home.
        place(t, x, y, false);
        void t.g.getBoundingClientRect();
        t.g.style.opacity = '1';
        if (wasTap) {
          const hp = t.at === null ? trayPos(t.home) : G.at(t.at);
          place(t, hp.x, hp.y, false);
          if (t.at === null) { select(selected === t ? null : t); sfx('click'); }
          else if (selected && selected !== t) moveTo(selected, t.at);
          else moveTo(t, null);
          return;
        }
        const s = nearestSlot(x + G.cell / 2, y + G.cell / 2);
        moveTo(t, s);
      },
    }, svg));
  }

  function lineSum(idx) {
    let s = 0;
    for (const i of idx) {
      if (P.blanks.includes(i)) { const t = placed.get(i); if (!t) return null; s += t.v; } else s += P.grid[i];
    }
    return s;
  }
  function check(fromUser) {
    const sz = P.size;
    let all = true;
    for (let r = 0; r < sz; r++) {
      const ok = lineSum(Array.from({ length: sz }, (_, c) => r * sz + c)) === P.rows[r];
      P.totEls.rows[r].classList.toggle('td-ok', ok); all = all && ok;
    }
    for (let c = 0; c < sz; c++) {
      const ok = lineSum(Array.from({ length: sz }, (_, r) => r * sz + c)) === P.cols[c];
      P.totEls.cols[c].classList.toggle('td-ok', ok); all = all && ok;
    }
    if (fromUser && all && !locked) solved();
    else if (fromUser && placed.size === P.blanks.length && !all) msg('Every gap is full. Check the totals that are not green.');
    else if (fromUser) msg('');
  }
  function msg(html) { msgEl.innerHTML = html; }

  function pips() {
    pipsEl.innerHTML = Array.from({ length: ROUND }, (_, i) => `<i class="${i < solvedCount ? 'done' : i === solvedCount ? 'now' : ''}"></i>`).join('');
  }

  function solved() {
    locked = true;
    solvedCount++;
    svg.classList.add('td-solved');
    sfx('chime');
    strip.setTally(`★ ${solvedCount}`, true);
    save('docked', total() + 1);
    showNote();
    msg('<b>Docked!</b> All the totals match.');
    pips();
    later(1700, () => { if (solvedCount >= ROUND) finish(); else newPuzzle(); });
  }

  function newPuzzle() {
    P = makePuzzle(level, R);
    locked = false;
    build();
    msg(solvedCount === 0 ? 'Make every row and column add up.' : '');
    pips();
  }

  function startRound() {
    timers.forEach(t => clearTimeout(t)); timers.clear();
    if (sumEl) { sumEl.remove(); sumEl = null; }
    R = makeRand();
    solvedCount = 0;
    strip.setTally('★ 0');
    showNote();
    setHints(hints === null || hints === undefined ? level === 1 : hints);
    newPuzzle();
    say('Make every row and column add up.');
  }

  function finish() {
    const plays = (load('plays') || 0) + 1;
    save('plays', plays);
    sumEl = document.createElement('div');
    sumEl.className = `${C}-sum`;
    sumEl.innerHTML = `<div class="${C}-card">
      <div class="eb">Round complete</div>
      <div class="big">${withStars(`★ ${solvedCount}`, 64)}</div>
      <p>puzzles docked</p>
      <p class="best">${total()} docked in all.</p>
      <div class="row"><button type="button" class="${C}-btn go">Play again</button>${level < 3 ? `<button type="button" class="${C}-btn ghost up">Try level ${level + 1}</button>` : ''}</div>
    </div>`;
    root.appendChild(sumEl);
    const u = [];
    u.push(onTap(sumEl.querySelector('.go'), () => { u.forEach(f => f()); startRound(); }));
    const up = sumEl.querySelector('.up');
    if (up) u.push(onTap(up, () => { u.forEach(f => f()); level += 1; strip.setLevel(level); startRound(); }));
  }

  startRound();

  // Tests only.
  const debug = !!(ctx.debug || /[?&]arcdebug\b/.test(location.search));
  const client = (x, y) => {
    const m = svg.getScreenCTM(); const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
    const q = pt.matrixTransform(m); return { cx: q.x, cy: q.y };
  };
  if (debug) {
    window.__arc = {
      id: meta.id,
      solved: () => solvedCount,
      locked: () => locked,
      puzzle() {
        return {
          size: P.size, rows: P.rows, cols: P.cols,
          slots: P.blanks.map(i => ({ cell: i, want: P.grid[i], ...client(slotCentre(i).x, slotCentre(i).y) })),
          tray: tiles.filter(t => t.at === null).map(t => ({ id: t.id, v: t.v, ...client(t.x + G.cell / 2, t.y + G.cell / 2) })),
          placed: [...placed.entries()].map(([i, t]) => ({ cell: i, v: t.v })),
          ok: [...svg.querySelectorAll('.td-tot.td-ok')].length,
        };
      },
      tileEl: id => tiles.find(t => t.id === id).g,
      slotEl: cell => svg.querySelector(`.td-slot[data-cell="${cell}"]`),
    };
  }

  return {
    destroy() {
      timers.forEach(t => clearTimeout(t)); timers.clear();
      tileUnb.forEach(u => u()); unb.forEach(u => u());
      strip.destroy();
      if (debug && window.__arc && window.__arc.id === meta.id) delete window.__arc;
      el.replaceChildren();
    },
  };
}
