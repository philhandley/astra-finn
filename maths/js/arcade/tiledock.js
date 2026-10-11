// Tile Dock (SVG). A grid of number tiles with gaps; row totals on the right, column totals underneath.
// Drag (or tap, then tap a gap) the loose tiles into the gaps until every row and column adds up.
// Matched totals turn green, unmatched stay grey. Five puzzles make a round.
// Tests only: ctx.debug or ?arcdebug exposes window.__arc (puzzle, solved).
import { S, svgRoot, svgPoint, onTap, drag, injectCSS, clamp, esc } from '../core/dom.js';
import { makeRand } from '../core/rand.js';
import { COL, FONT } from '../core/theme.js';
import { sfx as coreSfx } from '../core/sfx.js';

export const meta = { id: 'tiledock', title: 'Tile Dock', about: 'Slot the tiles in so every row and column adds up.', icon: 'crystal' };

const C = 'arc-tile';
const VW = 1000, VH = 640;
const ROUND = 5;

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

// ---------- the game ----------
export function mount(el, ctx = {}) {
  injectCSS(C, stripCSS(C) + `
  .${C}-body { flex: 1; min-height: 0; display: flex; }
  .${C}-stage { flex: 1; min-width: 0; position: relative; padding: 8px 0 8px 12px; }
  .${C}-side { flex: none; width: 250px; padding: 22px 22px 18px 6px; display: flex; flex-direction: column; gap: 14px; }
  .${C}-side .lab { font: 600 15px ${FONT.display}; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3, #7d869a); }
  .${C}-seg { display: flex; border: 1.5px solid rgba(255,255,255,.14); border-radius: 999px; padding: 4px; gap: 4px; }
  .${C}-seg button { appearance: none; flex: 1; min-height: 62px; border: 0; border-radius: 999px; background: transparent; color: var(--ink-2, #b9c0cf); font: 600 21px ${FONT.display}; cursor: pointer; }
  .${C}-seg button.on { background: rgba(95,212,255,.18); color: var(--cyan, #5fd4ff); }
  .${C}-side .${C}-btn { width: 100%; }
  .${C}-msg { font-size: 21px; line-height: 1.35; color: var(--ink-2, #b9c0cf); min-height: 90px; }
  .${C}-msg b { color: var(--green, #6fe3a5); font-family: ${FONT.display}; font-size: 30px; display: block; }
  .${C}-pips { display: flex; gap: 10px; margin-top: auto; align-items: center; }
  .${C}-pips i { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,.25); }
  .${C}-pips i.done { background: var(--gold, #f2b544); border-color: var(--gold, #f2b544); }
  .${C}-pips i.now { border-color: var(--gold, #f2b544); }
  .${C} svg .td-slot { fill: rgba(95,212,255,.05); stroke: rgba(255,255,255,.32); stroke-width: 3; stroke-dasharray: 10 8; transition: fill .15s, stroke .15s; }
  .${C} svg .td-slot.td-hot { fill: rgba(95,212,255,.18); stroke: ${COL.ones}; stroke-dasharray: none; }
  .${C} svg .td-slot.td-ready { stroke: rgba(242,181,68,.7); }
  .${C} svg .td-tile { cursor: grab; }
  .${C} svg .td-tile.td-sel .td-face { stroke: ${COL.tens}; stroke-width: 6; }
  .${C} svg .td-tile.td-sel { filter: drop-shadow(0 0 10px rgba(242,181,68,.6)); }
  .${C} svg .td-tot rect { fill: rgba(255,255,255,.05); stroke: rgba(255,255,255,.16); stroke-width: 2; transition: fill .25s, stroke .25s; }
  .${C} svg .td-tot text { fill: ${COL.ink2}; transition: fill .25s; }
  .${C} svg .td-tot.td-ok rect { fill: rgba(111,227,165,.16); stroke: ${COL.good}; }
  .${C} svg .td-tot.td-ok text { fill: ${COL.good}; }
  .${C} svg .td-frame { fill: rgba(18,27,51,.85); stroke: rgba(255,255,255,.12); stroke-width: 2; transition: stroke .3s; }
  .${C} svg.td-solved .td-frame { stroke: ${COL.good}; stroke-width: 4; filter: drop-shadow(0 0 16px rgba(111,227,165,.7)); }
  .${C} svg .td-dots { transition: opacity .2s; }
  .${C} svg.td-nohints .td-dots { opacity: 0; }
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
  body.className = `${C}-body`;
  body.innerHTML = `<div class="${C}-stage"></div>
    <div class="${C}-side">
      <div class="lab">Hints</div>
      <div class="${C}-seg" role="group" aria-label="Hints"><button type="button" data-h="1">On</button><button type="button" data-h="0">Off</button></div>
      <button type="button" class="${C}-btn ghost newp">New puzzle</button>
      <div class="${C}-msg" aria-live="polite"></div>
      <div class="${C}-pips"></div>
    </div>`;
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

  function geom(size) {
    const cell = size === 2 ? 140 : 112, gap = size === 2 ? 16 : 12, pad = 16, totW = 84;
    const gridW = size * cell + (size - 1) * gap;
    const blockW = gridW + 2 * pad + 26 + totW;
    const x0 = (VW - blockW) / 2 + pad;
    const y0 = size === 2 ? 52 : 34;
    const at = i => ({ x: x0 + (i % size) * (cell + gap), y: y0 + Math.floor(i / size) * (cell + gap) });
    const colY = y0 + gridW + pad + 38;
    const trayY = colY + 46;
    const midX = x0 + gridW / 2;
    return { cell, gap, pad, totW, gridW, x0, y0, at, rowX: x0 + gridW + pad + 26 + totW / 2, colY, trayY, midX };
  }
  function trayPos(k, count) {
    const sp = G.cell + 22;
    const x = G.midX - ((count - 1) * sp) / 2 + k * sp - G.cell / 2;
    return { x, y: G.trayY };
  }

  function dotsFor(v, cell, col) {
    const g = S('g', { class: 'td-dots' });
    const r = cell * 0.042, sp = cell * 0.13;
    const rowsN = v > 5 ? 2 : 1;
    for (let i = 0; i < v; i++) {
      const row = i < 5 ? 0 : 1;
      const inRow = row === 0 ? Math.min(v, 5) : v - 5;
      const k = row === 0 ? i : i - 5;
      const cx = cell / 2 + (k - (inRow - 1) / 2) * sp;
      const cy = rowsN === 1 ? cell * 0.77 : cell * (0.71 + row * 0.13);
      g.appendChild(S('circle', { cx, cy, r, fill: col }));
    }
    return g;
  }
  function tileFace(v, movable) {
    const cell = G.cell;
    const g = S('g', {});
    g.appendChild(S('rect', { x: 2, y: 6, width: cell, height: cell, rx: 18, fill: 'rgba(0,0,0,.35)' }));
    g.appendChild(S('rect', { class: 'td-face', x: 0, y: 0, width: cell, height: cell, rx: 18, fill: movable ? '#f3efe6' : '#1d2a4c', stroke: movable ? '#d9ccb0' : 'rgba(255,255,255,.14)', 'stroke-width': 2 }));
    g.appendChild(S('text', { class: 'td-num', x: cell / 2, y: cell * 0.43, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 700, 'font-size': Math.round(cell * 0.44), fill: movable ? '#0c1430' : COL.ink }, [String(v)]));
    g.appendChild(dotsFor(v, cell, movable ? '#2f78d6' : COL.ones));
    return g;
  }
  function place(t, x, y, animate = true) {
    t.x = x; t.y = y;
    t.g.style.transition = animate ? 'transform .22s cubic-bezier(.2,.8,.3,1)' : 'none';
    t.g.style.transform = `translate(${x}px, ${y}px)`;
  }
  function home(t) {
    const p = trayPos(t.home, P.tray.length);
    place(t, p.x, p.y);
  }

  let layers = {};
  function build() {
    tileUnb.forEach(u => u()); tileUnb = [];
    svg.replaceChildren();
    svg.classList.remove('td-solved');
    G = geom(P.size);
    const L = n => { const g = S('g', { class: n }); svg.appendChild(g); return g; };
    layers = { frame: L('l-frame'), fixed: L('l-fixed'), slots: L('l-slots'), tot: L('l-tot'), tray: L('l-tray'), tiles: L('l-tiles'), drag: L('l-drag'), msg: L('l-msg') };
    layers.frame.appendChild(S('rect', { class: 'td-frame', x: G.x0 - G.pad, y: G.y0 - G.pad, width: G.gridW + 2 * G.pad, height: G.gridW + 2 * G.pad, rx: 26 }));
    P.grid.forEach((v, i) => {
      const p = G.at(i);
      if (P.blanks.includes(i)) {
        const s = S('rect', { class: 'td-slot', x: p.x + 2, y: p.y + 2, width: G.cell - 4, height: G.cell - 4, rx: 18, 'data-cell': i });
        layers.slots.appendChild(s);
        tileUnb.push(onTap(s, () => { if (!locked && selected) { moveTo(selected, i); } }));
      } else {
        const f = tileFace(v, false);
        f.setAttribute('transform', `translate(${p.x} ${p.y})`);
        layers.fixed.appendChild(f);
      }
    });
    // Totals.
    const totEls = { rows: [], cols: [] };
    const pillH = 56;
    for (let r = 0; r < P.size; r++) {
      const y = G.y0 + r * (G.cell + G.gap) + G.cell / 2;
      const g = S('g', { class: 'td-tot', transform: `translate(${G.rowX} ${y})` });
      g.appendChild(S('rect', { x: -G.totW / 2, y: -pillH / 2, width: G.totW, height: pillH, rx: 28 }));
      g.appendChild(S('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 2, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 34 }, [String(P.rows[r])]));
      layers.tot.appendChild(g); totEls.rows.push(g);
    }
    for (let c = 0; c < P.size; c++) {
      const x = G.x0 + c * (G.cell + G.gap) + G.cell / 2;
      const g = S('g', { class: 'td-tot', transform: `translate(${x} ${G.colY})` });
      g.appendChild(S('rect', { x: -G.totW / 2, y: -pillH / 2, width: G.totW, height: pillH, rx: 28 }));
      g.appendChild(S('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 2, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 34 }, [String(P.cols[c])]));
      layers.tot.appendChild(g); totEls.cols.push(g);
    }
    P.totEls = totEls;
    // Tray dock.
    const n = P.tray.length;
    const a = trayPos(0, n), b = trayPos(n - 1, n);
    layers.tray.appendChild(S('rect', { x: a.x - 16, y: a.y - 12, width: b.x - a.x + G.cell + 32, height: G.cell + 26, rx: 26, fill: 'rgba(255,255,255,.03)', stroke: 'rgba(255,255,255,.1)', 'stroke-width': 2 }));
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
    // Docked message where the tray was.
    const m = S('g', { class: 'td-docked', transform: `translate(${G.midX} ${G.trayY + G.cell / 2})` });
    m.appendChild(S('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 52, fill: COL.good }, ['★ Docked!']));
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
        ghost.style.filter = 'drop-shadow(0 10px 18px rgba(0,0,0,.55))';
        layers.drag.appendChild(ghost);
        t.g.style.opacity = '0';
      },
      move(p) {
        if (!start) return;
        moved = Math.max(moved, Math.hypot(p.x - start.x, p.y - start.y));
        const x = p.x - off.x, y = p.y - off.y;
        ghost.style.transform = `translate(${x}px, ${y}px) scale(1.04)`;
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
          place(t, t.at === null ? trayPos(t.home, P.tray.length).x : G.at(t.at).x, t.at === null ? G.trayY : G.at(t.at).y, false);
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
    else if (fromUser && placed.size === P.blanks.length && !all) msg('Every gap is full. Find a total that is still grey and check it.');
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
    msg('<b>Docked!</b>Every row and column adds up.');
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
      <div class="big">★ ${solvedCount}</div>
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
