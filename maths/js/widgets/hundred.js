// hundred: a 100 square (1 to 100, or 0 to 99) that lights up.
// Props:
//   start       1 (1 to 100, default) or 0 (0 to 99)
//   highlight   array of numbers shown gold
//   highlight2  array of numbers shown cyan
//   pattern     { every: n, from: k } highlights k, k + n, k + 2n ... in gold (add colour: 'cyan' for cyan).
//               An array of such objects also works.
//   hide        array of numbers shown as blank cells with a gold "?"
//   mode        'display' (default) | 'tap'
//   rows        show only the first N rows (default 10)
//   readonly
// Tap mode: tapping a cell toggles it gold. Highlights from props start gold and can be toggled too.
// State: { selected, taps, count }
//   selected  the last number Finn turned gold that is still gold (null if none)
//   taps      the numbers Finn turned gold, in tap order (a number turned off again is removed)
//   count     how many cells are gold now (including gold highlights from props)
// The grid fills the whole box (cells may be wider than tall) so cells are as big as possible.
// Debug: dev/harness.html?widget=hundred&props={"mode":"tap","pattern":{"every":10,"from":7}}
import { S, svgRoot, onTap, injectCSS, clamp } from '../core/dom.js';
import { COL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: '100 square',
  playground: { mode: 'tap', start: 1 },
  state: ['selected', 'taps', 'count'],
};

const VW = 1000;
const numList = a => (Array.isArray(a) ? a : a === undefined || a === null ? [] : [a]).map(Number).filter(Number.isFinite).map(Math.round);

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-hundred', `
    .w-hundred { width: 100%; height: 100%; }
    .w-hundred .hc { cursor: pointer; }
    .w-hundred.ro .hc { cursor: default; }
    .w-hundred .hc .face { transition: fill .18s, stroke .18s; }
    .w-hundred .hc.pop { animation: w-h-pop .3s ease-out; transform-box: fill-box; transform-origin: center; }
    .w-hundred .hc.glow .face { stroke: #fff; stroke-width: 4; }
    @keyframes w-h-pop { 0% { transform: scale(.82); } 60% { transform: scale(1.1); } 100% { transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { .w-hundred .hc.pop { animation: none; } }
  `);
  let p = { ...props };
  let gold = new Set();   // gold cells now
  let taps = [];          // Finn's gold taps in order
  let popN = null;
  const root = svgRoot(VW, 640, 'w-hundred');
  el.appendChild(root);
  const unbinds = [];
  let ro_ = null;
  let drawnWH = '';

  const ro = () => !!(p.readonly || ctx.readonly);
  const first = () => (Number(p.start) === 0 ? 0 : 1);
  const rowsN = () => clamp(Math.round(Number(p.rows) || 10), 1, 10);

  function patternNums() {
    const out = { gold: [], cyan: [] };
    const pats = Array.isArray(p.pattern) ? p.pattern : p.pattern && typeof p.pattern === 'object' ? [p.pattern] : [];
    const lo = first(), hi = first() + 99;
    for (const pt of pats) {
      const every = Math.round(Number(pt.every));
      if (!(every >= 1)) continue;
      let k = Math.round(Number(pt.from ?? pt.start ?? every));
      if (!Number.isFinite(k)) continue;
      const list = pt.colour === 'cyan' || pt.color === 'cyan' ? out.cyan : out.gold;
      for (let n = k, guard = 0; n <= hi && guard < 200; n += every, guard++) if (n >= lo) list.push(n);
    }
    return out;
  }

  function resetSets() {
    const pat = patternNums();
    gold = new Set([...numList(p.highlight), ...pat.gold]);
    taps = [];
  }

  function size() {
    const w = el.clientWidth || 860, h = el.clientHeight || 560;
    return { w, h };
  }

  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    root.classList.toggle('ro', ro());
    const { w, h } = size();
    drawnWH = `${Math.round(w)}x${Math.round(h)}`;
    const n = rowsN();
    // viewBox matches the box's shape so the grid can use the full height.
    const VH = clamp((VW * h) / w, 120, 1600);
    root.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
    const m = 3, g = 4, mid = 9;
    const pitchH = (VH - 2 * m - (n > 5 ? mid : 0)) / n;
    let pitchW = (VW - 2 * m - mid) / 10;
    let ph = pitchH;
    if (pitchW > ph * 1.75) pitchW = ph * 1.75;
    if (ph > pitchW * 1.05) ph = pitchW * 1.05;
    const gridW = pitchW * 10 + mid, gridH = ph * n + (n > 5 ? mid : 0);
    const ox = (VW - gridW) / 2, oy = (VH - gridH) / 2;
    const cw = pitchW - g, ch = ph - g;
    const fs = Math.min(ch * 0.56, cw * 0.46);
    const cyan = new Set([...numList(p.highlight2), ...patternNums().cyan]);
    const hide = new Set(numList(p.hide));
    const f0 = first();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < 10; c++) {
        const num = f0 + r * 10 + c;
        const x = ox + c * pitchW + (c >= 5 ? mid : 0), y = oy + r * ph + (r >= 5 ? mid : 0);
        const isGold = gold.has(num), isCyan = cyan.has(num), isHid = hide.has(num);
        const cell = S('g', { class: 'hc' + (popN === num ? ' pop' : ''), 'data-n': num });
        // Hit area covers the gap too.
        cell.appendChild(S('rect', { x, y, width: pitchW, height: ph, fill: 'transparent' }));
        let fill = 'rgba(255,255,255,.05)', stroke = 'rgba(255,255,255,.16)', ink = COL.ink, dash = null;
        if (isCyan) { fill = COL.ones; stroke = '#c4f0ff'; ink = '#04202b'; }
        if (isGold) { fill = COL.tens; stroke = isCyan ? COL.ones : '#ffe0a0'; ink = '#1a1205'; }
        if (isHid && !isGold && !isCyan) { fill = 'rgba(242,181,68,.08)'; stroke = COL.tens; ink = COL.tens; dash = '7 6'; }
        cell.appendChild(S('rect', { class: 'face', x: x + g / 2, y: y + g / 2, width: cw, height: ch, rx: Math.min(10, ch * 0.18), fill, stroke, 'stroke-width': isGold && isCyan ? 5 : 2, 'stroke-dasharray': dash }));
        cell.appendChild(S('text', { x: x + pitchW / 2, y: y + ph / 2 + fs * 0.36, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': isGold || isCyan ? 700 : 600, 'font-size': fs, fill: ink, 'pointer-events': 'none' }, [isHid ? '?' : String(num)]));
        if (p.mode === 'tap' && !ro()) unbinds.push(onTap(cell, () => toggle(num)));
        root.appendChild(cell);
      }
    }
    popN = null;
  }

  function toggle(num) {
    if (gold.has(num)) {
      gold.delete(num);
      taps = taps.filter(t => t !== num);
      sfx('click');
    } else {
      gold.add(num);
      taps.push(num);
      popN = num;
      sfx('pop');
    }
    draw();
    ctx.onChange && ctx.onChange(api.getState());
  }

  // Redraw when the box changes shape (the viewBox follows it).
  // drawnWH is the size the last draw used; redraw only if the box really changed.
  let rq = 0;
  const recheck = () => {
    const { w, h } = size();
    if (`${Math.round(w)}x${Math.round(h)}` === drawnWH) return;
    clearTimeout(rq);
    rq = setTimeout(draw, 30);
  };
  if (typeof ResizeObserver !== 'undefined') {
    ro_ = new ResizeObserver(recheck);
    ro_.observe(el);
  }
  // Belt and braces for a box that gets its size just after mount (observers can lag in background tabs).
  const t1 = setTimeout(recheck, 60), t2 = setTimeout(recheck, 400), t3 = setTimeout(recheck, 1500);

  const api = {
    getState() {
      return { selected: taps.length ? taps[taps.length - 1] : null, taps: [...taps], count: gold.size };
    },
    update(np = {}) {
      p = { ...p, ...np };
      if (['highlight', 'pattern', 'start', 'mode', 'rows'].some(k => k in np)) resetSets();
      draw();
    },
    showAnswer(answer) {
      const list = numList(answer);
      list.forEach(nm => { if (!gold.has(nm)) { gold.add(nm); taps.push(nm); } });
      popN = list[0] ?? null;
      draw();
      // Make the answer cells glow briefly.
      list.forEach(nm => { const c = root.querySelector(`.hc[data-n="${nm}"]`); if (c) c.classList.add('glow'); });
    },
    destroy() {
      unbinds.splice(0).forEach(u => u());
      if (ro_) ro_.disconnect();
      clearTimeout(rq); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      el.replaceChildren();
    },
  };
  resetSets();
  draw();
  return api;
}
