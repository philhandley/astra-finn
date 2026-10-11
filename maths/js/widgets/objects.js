// objects: a set of things to count, group or take away. Reference widget for the contract in ENGINE.md.
// Props: n, icon (art name or 'dot'), arrange ('row' | 'rows' | 'groups' | 'scatter' | 'dice' | 'line'),
//        perRow, groups (array of group sizes), colours ([gold count, cyan count]), crossed (cross out the last k),
//        tappable (tap to count: each tapped item gets its count number), groupLabels (text under each group, e.g. running totals), mirror ('alternate': every second item faces the other way, for pairs of boots), readonly.
// State: { n, tapped }
import { S, svgRoot, onTap, injectCSS, clamp } from '../core/dom.js';
import { artInner } from '../core/art.js';
import { COL, PAL, FONT } from '../core/theme.js';
import { makeRand } from '../core/rand.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Counting set',
  playground: { n: 12, icon: 'star', arrange: 'scatter', tappable: true },
  state: ['n', 'tapped'],
};

const W = 800, H = 500;
const DICE = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function layout(p) {
  const n = clamp(Math.round(p.n ?? 0), 0, 120);
  const arrange = p.arrange || (n <= 10 ? 'row' : 'rows');
  const pos = []; // {x, y, r, g}  g = group index
  const rings = []; // {x, y, w, h}
  if (arrange === 'groups' && Array.isArray(p.groups) && p.groups.length) {
    const gs = p.groups.map(g => clamp(Math.round(g), 0, 30)).slice(0, 12);
    const big = Math.max(...gs, 1);
    // Groups of 10 sit as 5 x 2 (like a tens frame); others as near-squares.
    const inner = big === 10 ? 5 : Math.ceil(Math.sqrt(big));
    const linesMax = Math.ceil(big / inner);
    const labelled = Array.isArray(p.groupLabels) && p.groupLabels.length;
    const SP = 2.3;
    // Pick the grid of groups that draws the items largest.
    let best = null;
    for (let cols = 1; cols <= gs.length; cols++) {
      const rowsN = Math.ceil(gs.length / cols);
      const cw = W / cols, ch = H / rowsN;
      const r = Math.min((cw * 0.9) / (inner * SP + 0.8), ((ch - (labelled ? 46 : 0)) * 0.9) / (linesMax * SP + 0.8), 54);
      if (!best || r > best.r + 0.01) best = { cols, rowsN, cw, ch, r };
    }
    const { cols, cw, ch, r } = best;
    gs.forEach((size, gi) => {
      // A short last row of groups sits in the middle, not at the left.
      const row = Math.floor(gi / cols), inRow = Math.min(cols, gs.length - row * cols);
      const cx = (gi % cols + 0.5 + (cols - inRow) / 2) * cw, cy = (row + 0.5) * ch - (labelled ? 20 : 0);
      const per = Math.min(inner, Math.max(1, size));
      const lines = Math.ceil(size / per) || 1;
      const sp = r * SP;
      rings.push({ x: cx - (per * sp) / 2 - r * 0.4, y: cy - (lines * sp) / 2 - r * 0.4, w: per * sp + r * 0.8, h: lines * sp + r * 0.8, label: labelled ? p.groupLabels[gi] : null });
      for (let k = 0; k < size; k++) {
        pos.push({ x: cx - ((per - 1) * sp) / 2 + (k % per) * sp, y: cy - ((lines - 1) * sp) / 2 + Math.floor(k / per) * sp, r, g: gi });
      }
    });
    return { pos, rings };
  }
  if (arrange === 'scatter') {
    const R = makeRand(1000 + n * 7);
    const r = clamp(Math.sqrt((W * H) / Math.max(n, 1)) * 0.26, 14, 60);
    let tries = 0;
    while (pos.length < n && tries < 6000) {
      tries++;
      const x = r + 10 + R.next() * (W - 2 * r - 20), y = r + 10 + R.next() * (H - 2 * r - 20);
      if (pos.every(q => Math.hypot(q.x - x, q.y - y) > r * 2.25)) pos.push({ x, y, r, g: 0 });
    }
    while (pos.length < n) pos.push({ x: W / 2, y: H / 2, r, g: 0 });
    return { pos, rings };
  }
  if (arrange === 'dice') {
    // Dice patterns of up to 6, side by side.
    const chunks = [];
    for (let left = n; left > 0; left -= 6) chunks.push(Math.min(6, left));
    const cols = Math.min(chunks.length, 4), rowsN = Math.ceil(chunks.length / cols);
    const cw = W / cols, ch = H / rowsN;
    const r = Math.min(cw, ch) * 0.11;
    chunks.forEach((c, gi) => {
      const cx = (gi % cols + 0.5) * cw, cy = (Math.floor(gi / cols) + 0.5) * ch;
      const sp = Math.min(cw, ch) * 0.26;
      rings.push({ x: cx - sp * 1.7, y: cy - sp * 1.7, w: sp * 3.4, h: sp * 3.4 });
      for (const [dx, dy] of DICE[c]) pos.push({ x: cx + dx * sp, y: cy + dy * sp, r, g: gi });
    });
    return { pos, rings };
  }
  // row, line, rows
  const perRow = arrange === 'row' || arrange === 'line' ? Math.max(n, 1) : clamp(Math.round(p.perRow || (n <= 20 ? 5 : 10)), 1, 20);
  const rowsN = Math.max(1, Math.ceil(n / perRow));
  const gapEvery = perRow >= 10 ? 5 : 0; // a small gap after every 5 in long rows
  const units = perRow + (gapEvery ? Math.floor((perRow - 1) / gapEvery) * 0.6 : 0);
  const sp = Math.min((W - 40) / units, (H - 40) / rowsN, 130);
  const r = sp * 0.4;
  const totalW = units * sp, totalH = rowsN * sp;
  for (let i = 0; i < n; i++) {
    const col = i % perRow, row = Math.floor(i / perRow);
    const extra = gapEvery ? Math.floor(col / gapEvery) * 0.6 : 0;
    pos.push({ x: (W - totalW) / 2 + (col + extra + 0.5) * sp, y: (H - totalH) / 2 + (row + 0.5) * sp, r, g: row });
  }
  return { pos, rings };
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-objects', `
    .w-objects { width: 100%; height: 100%; }
    .w-objects .it { cursor: pointer; }
    .w-objects.ro .it { cursor: default; }
    .w-objects .it.counted .halo { opacity: 1; }
    .w-objects .halo { opacity: 0; transition: opacity .15s; }
  `);
  let p = { ...props };
  let tapped = []; // indices in tap order
  const root = svgRoot(W, H, 'w-objects');
  el.appendChild(root);
  const unbinds = [];

  const ro = () => !!(p.readonly || ctx.readonly);

  function colourFor(i) {
    const cs = Array.isArray(p.colours) ? p.colours : null;
    if (!cs) return PAL.blue;
    let acc = 0;
    const palette = [COL.a, COL.b, PAL.blue, PAL.green];
    for (let k = 0; k < cs.length; k++) { acc += cs[k]; if (i < acc) return palette[k % palette.length]; }
    return COL.ink3;
  }

  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    root.classList.toggle('ro', ro());
    const { pos, rings } = layout(p);
    const n = pos.length;
    const crossed = clamp(Math.round(p.crossed || 0), 0, n);
    for (const rg of rings) {
      root.appendChild(S('rect', { x: rg.x, y: rg.y, width: rg.w, height: rg.h, rx: Math.min(rg.w, rg.h) * 0.3, fill: COL.surface2, stroke: COL.lineStrong, 'stroke-width': 3, 'stroke-dasharray': '10 8' }));
      if (rg.label !== null && rg.label !== undefined && rg.label !== '') {
        root.appendChild(S('text', { x: rg.x + rg.w / 2, y: rg.y + rg.h + 40, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 36, fill: COL.focus }, [String(rg.label)]));
      }
    }
    const icon = p.icon || 'dot';
    const labels = [];
    pos.forEach((q, i) => {
      const g = S('g', { class: 'it', transform: `translate(${q.x} ${q.y})` });
      const k = tapped.indexOf(i);
      if (k >= 0) g.classList.add('counted');
      g.appendChild(S('circle', { class: 'halo', r: q.r * 1.15, fill: COL.focusSoft, stroke: COL.focus, 'stroke-width': 4 }));
      if (icon === 'dot') {
        g.appendChild(S('circle', { r: q.r * 0.82, fill: colourFor(i), stroke: 'rgba(27,30,46,.18)', 'stroke-width': 3 }));
      } else {
        if (Array.isArray(p.colours)) g.appendChild(S('circle', { r: q.r * 1.02, fill: 'none', stroke: colourFor(i), 'stroke-width': 5 }));
        const s = (q.r * 1.7) / 100;
        const flip = p.mirror === 'alternate' && i % 2 === 1;
        const a = S('g', { transform: flip ? `translate(${q.r * 0.85} ${-q.r * 0.85}) scale(${-s} ${s})` : `translate(${-q.r * 0.85} ${-q.r * 0.85}) scale(${s})` });
        a.innerHTML = artInner(icon);
        g.appendChild(a);
      }
      if (i >= n - crossed) {
        g.setAttribute('opacity', '.38');
        g.appendChild(S('path', { d: `M${-q.r} ${-q.r}L${q.r} ${q.r}`, stroke: COL.ink, 'stroke-width': 6, 'stroke-linecap': 'round' }));
      }
      if (k >= 0) {
        // Count labels go on a top layer (so the next row never covers them). With two colours, each colour counts from 1.
        let num = k + 1;
        if (Array.isArray(p.colours)) { const c = colourFor(i); num = tapped.slice(0, k + 1).filter(j => colourFor(j) === c).length; }
        const fs = clamp(q.r * 1.05, 22, 34);
        labels.push(S('text', { x: q.x, y: q.y + q.r * 1.15 + fs, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': fs, fill: COL.focus, stroke: '#fff', 'stroke-width': 7, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }, [String(num)]));
      }
      if (p.tappable && !ro()) {
        // Large invisible hit area.
        g.insertBefore(S('circle', { r: Math.max(q.r * 1.2, 34), fill: 'transparent' }), g.firstChild);
        unbinds.push(onTap(g, () => {
          const at = tapped.indexOf(i);
          if (at >= 0) tapped = tapped.slice(0, at); else tapped.push(i);
          sfx('pop');
          draw();
          ctx.onChange && ctx.onChange(api.getState());
        }));
      }
      root.appendChild(g);
    });
    labels.forEach(l => root.appendChild(l));
  }

  const api = {
    getState() { return { n: layout(p).pos.length, tapped: tapped.length }; },
    update(np) { p = { ...p, ...np }; if ('n' in np || 'groups' in np || 'arrange' in np) tapped = []; draw(); },
    showAnswer() {
      const all = layout(p).pos.map((_, i) => i);
      const crossed = clamp(Math.round(p.crossed || 0), 0, all.length);
      tapped = all.slice(0, all.length - crossed);
      draw();
    },
    destroy() { unbinds.splice(0).forEach(u => u()); el.replaceChildren(); },
  };
  draw();
  return api;
}
