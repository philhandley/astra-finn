// fractions: Smash and Glue. A shape (square, rect, circle, bar) or a set of dots, split into equal parts.
// Props: shape ('square' | 'rect' | 'circle' | 'bar' | 'set'), parts (1, 2, 3, 4, 6, 8; default 1), setSize (set only),
//        shaded (count of shaded parts, filled in reading order) or shadedIdx (array of part indices),
//        tools (array from '2', '3', '4', 'glue', 'fill'), labels (write 1/n in each part), unequal (draw UNEQUAL parts),
//        colour (shading colour), interactive (default true), readonly.
// Hammer n splits the whole into n equal parts, or splits each part into n when the result is at most 8 parts (2 -> 4).
// Glue joins pairs of equal parts (4 quarters -> 2 halves), keeping the shading where it can (2/4 becomes 1/2).
// Tap a part to shade or unshade it. The paint button changes the shading colour.
// State: { parts, shaded, equal, fraction }  fraction is "shaded/parts", e.g. "3/4"; equal is false only for unequal drawings.
// Debug: dev/harness.html?widget=fractions&props={"shape":"square","parts":4,"shaded":3,"labels":true}
//        dev/harness.html?widget=fractions&props={"shape":"circle","tools":["2","3","4","glue","fill"]}
//        dev/harness.html?widget=fractions&props={"shape":"set","setSize":8,"parts":4,"shaded":1}
import { S, svgRoot, onTap, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { COL, FRAC, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Smash and Glue',
  playground: { shape: 'square', parts: 1, tools: ['2', '3', '4', 'glue', 'fill'], labels: true, interactive: true },
  state: ['parts', 'shaded', 'equal', 'fraction'],
};

const VW = 600, VH = 460;
const INK = '#f3efe6';
const EMPTY = 'rgba(255,255,255,.07)';
const CANON = { 1: [1, 1], 2: [2, 1], 3: [3, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2] };
const ALLOWED = [1, 2, 3, 4, 6, 8];

const CSS = `
.w-fractions { position: absolute; inset: 0; display: flex; user-select: none; -webkit-user-select: none; }
.w-fractions .w-fr-svg { flex: 1 1 auto; min-width: 0; position: relative; }
.w-fractions .w-fr-svg > svg { position: absolute; inset: 0; }
.w-fractions .pc { cursor: pointer; transition: fill .2s; }
.w-fractions.ro .pc { cursor: default; }
.w-fractions .shake { animation: wfr-shake .32s ease; transform-box: fill-box; transform-origin: center; }
@keyframes wfr-shake { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-7px, 2px); } 45% { transform: translate(6px, -2px); } 70% { transform: translate(-3px, 1px); } }
.w-fractions .crack { stroke-dasharray: 1200; stroke-dashoffset: 1200; animation: wfr-crack .35s ease-out forwards; }
@keyframes wfr-crack { to { stroke-dashoffset: 0; } }
.w-fractions .fadein { animation: wfr-fade .35s ease both; }
@keyframes wfr-fade { from { opacity: 0; } to { opacity: 1; } }
.w-fractions.rm .shake, .w-fractions.rm .crack, .w-fractions.rm .fadein { animation: none; stroke-dashoffset: 0; }
.w-fr-tools { flex: none; display: flex; flex-direction: column; justify-content: center; gap: 10px; padding: 8px 10px 8px 4px; }
.w-fr-tools button { appearance: none; border: 1.5px solid rgba(255,255,255,.2); background: rgba(255,255,255,.07); color: ${INK};
  width: 92px; min-height: 64px; border-radius: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
  font-family: ${FONT.display}; font-weight: 700; font-size: 26px; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform .1s, background .15s; }
.w-fr-tools button:active { transform: scale(.94); background: rgba(255,255,255,.14); }
.w-fr-tools button svg { width: 34px; height: 34px; flex: none; }
.w-fr-tools button.glue { font-size: 20px; }
.w-fr-tools .sw { width: 30px; height: 30px; border-radius: 50%; border: 3px solid rgba(255,255,255,.85); flex: none; }
`;

const I_HAMMER = '<svg viewBox="0 0 32 32"><path d="M6 9l7-5 5 3-2 3 2 2-3 3-2-2-3 3z" fill="#c9ced6"/><path d="M13 16l3-3 12 12a2 2 0 0 1-3 3z" fill="#d9a066"/><path d="M6 9l3 4" stroke="#7d869a" stroke-width="2"/></svg>';
const I_GLUE = '<svg viewBox="0 0 32 32"><rect x="9" y="11" width="14" height="17" rx="3" fill="#f3efe6"/><rect x="11" y="16" width="10" height="6" rx="1.5" fill="#5fd4ff"/><path d="M13 11V7h6v4z" fill="#f2b544"/><path d="M15 7l1-4 1 4z" fill="#f2b544"/></svg>';
const I_PAINT = '<svg viewBox="0 0 32 32"><path d="M7 15l9-9 9 9-9 9z" fill="#f3efe6"/><path d="M25 15c1.8 3 2.5 4.6 2.5 5.6a2.5 2.5 0 0 1-5 0c0-1 .7-2.6 2.5-5.6z" fill="currentColor"/></svg>';

// Uneven cut positions for "is this a half?" pictures.
const UNEVEN = { 2: [0, 0.36, 1], 3: [0, 0.22, 0.58, 1], 4: [0, 0.14, 0.42, 0.66, 1], 6: [0, 0.1, 0.25, 0.45, 0.6, 0.82, 1], 8: [0, 0.07, 0.17, 0.3, 0.42, 0.55, 0.7, 0.83, 1] };
const UNEVEN_ANG = { 2: [0, 0.36, 1], 3: [0, 0.2, 0.55, 1], 4: [0, 0.18, 0.5, 0.64, 1], 6: [0, 0.1, 0.3, 0.42, 0.6, 0.78, 1], 8: [0, 0.08, 0.2, 0.3, 0.45, 0.55, 0.7, 0.82, 1] };

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-fractions', CSS);
  let p = {};
  let shape = 'square';
  let cols = 1, rows = 1;          // grid shapes
  let n = 1, rot = 0;              // circle and set: parts, circle rotation (in parts of a turn)
  let paint = [];                  // per part: null or a colour
  let unequal = false;
  let setSize = 8;
  let colourIdx = 0;
  let oldLines = new Set();
  let shakeNext = false;
  let noCrack = true;   // the first draw after a set-up shows its lines without the crack animation
  const unbinds = [];
  let pieceUnbinds = [];

  const wrap = document.createElement('div');
  wrap.className = 'w-fractions';
  const svgBox = document.createElement('div');
  svgBox.className = 'w-fr-svg';
  const root = svgRoot(VW, VH, '');
  svgBox.appendChild(root);
  const tools = document.createElement('div');
  tools.className = 'w-fr-tools';
  wrap.append(svgBox, tools);
  el.appendChild(wrap);

  const ro = () => !!(p.readonly || ctx.readonly || p.interactive === false);
  const parts = () => (shape === 'circle' || shape === 'set' ? n : cols * rows);
  const shadeCol = () => p.colour || FRAC[colourIdx % FRAC.length];
  const state = () => {
    const pt = parts(), sh = paint.filter(Boolean).length;
    return { parts: pt, shaded: sh, equal: !unequal && (shape !== 'set' || setSize % n === 0), fraction: `${sh}/${pt}` };
  };
  const changed = () => { ctx.onChange && ctx.onChange(state()); };

  // ---------- geometry ----------
  function box() {
    if (shape === 'rect') return { x: (VW - 520) / 2, y: (VH - 320) / 2, w: 520, h: 320 };
    if (shape === 'bar') return { x: (VW - 560) / 2, y: (VH - 120) / 2, w: 560, h: 120 };
    return { x: (VW - 400) / 2, y: (VH - 400) / 2, w: 400, h: 400 };
  }
  const cutsX = () => (unequal && UNEVEN[cols] && rows === 1 ? UNEVEN[cols] : unequal && cols === 2 && rows === 2 ? [0, 0.38, 1] : even(cols));
  const cutsY = () => (unequal && cols === 2 && rows === 2 ? [0, 0.64, 1] : even(rows));
  function even(k) { return Array.from({ length: k + 1 }, (_, i) => i / k); }
  const angCuts = () => (unequal && UNEVEN_ANG[n] ? UNEVEN_ANG[n] : even(n)).map(t => rot / n + t);

  // ---------- model ----------
  function setup() {
    shape = ['square', 'rect', 'circle', 'bar', 'set'].includes(p.shape) ? p.shape : 'square';
    let k = Math.round(p.parts ?? 1) || 1;
    if (!ALLOWED.includes(k)) k = ALLOWED.reduce((a, b) => (Math.abs(b - k) < Math.abs(a - k) ? b : a), 1);
    setSize = clamp(Math.round(p.setSize ?? 8) || 8, 1, 24);
    unequal = !!p.unequal && k > 1;
    rot = 0;
    if (shape === 'set') { n = Math.min(k, setSize); }
    else if (shape === 'circle') n = k;
    else if (shape === 'bar') { cols = k; rows = 1; }
    else if (unequal && k === 4 && shape !== 'bar') { cols = 2; rows = 2; }
    else if (unequal) { cols = k; rows = 1; }
    else [cols, rows] = CANON[k];
    paint = Array(parts()).fill(null);
    if (Array.isArray(p.shadedIdx)) p.shadedIdx.forEach(i => { if (i >= 0 && i < paint.length) paint[i] = shadeCol(); });
    else { const s = clamp(Math.round(p.shaded ?? 0) || 0, 0, paint.length); for (let i = 0; i < s; i++) paint[i] = shadeCol(); }
  }

  function hammer(k) {
    if (ro()) return;
    const pt = parts();
    const old = paint.slice();
    if (shape === 'set') {
      let nn = pt * k;
      if (unequal || nn > 8 || setSize % nn !== 0) nn = setSize % k === 0 ? k : 0;
      if (!nn || nn === pt && !unequal) { wobble(); return; }
      const fromSplit = !unequal && nn % pt === 0 && nn !== k;
      unequal = false;
      n = nn;
      paint = Array(n).fill(null);
      if (fromSplit) old.forEach((c, i) => { for (let j = 0; j < k; j++) paint[i * k + j] = c; });
    } else if (shape === 'circle') {
      if (!unequal && pt * k <= 8) {
        n = pt * k; rot = rot * k;
        paint = []; old.forEach(c => { for (let j = 0; j < k; j++) paint.push(c); });
      } else { n = k; rot = 0; paint = Array(n).fill(null); }
      unequal = false;
    } else {
      const b = box();
      if (!unequal && pt * k <= 8) {
        const cw = b.w / cols, ch = b.h / rows;
        const byCols = shape === 'bar' || cw >= ch - 0.5;
        const nc = byCols ? cols * k : cols, nr = byCols ? rows : rows * k;
        const np = Array(nc * nr).fill(null);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const v = old[r * cols + c];
          for (let j = 0; j < k; j++) {
            const rr = byCols ? r : r * k + j, cc = byCols ? c * k + j : c;
            np[rr * nc + cc] = v;
          }
        }
        cols = nc; rows = nr; paint = np;
      } else {
        if (shape === 'bar') { cols = k; rows = 1; } else [cols, rows] = CANON[k];
        paint = Array(parts()).fill(null);
      }
      unequal = false;
    }
    sfx('clunk');
    shakeNext = true;
    draw();
    changed();
  }

  function glue() {
    if (ro()) return;
    const pt = parts();
    if (pt <= 1) { wobble(); return; }
    const old = paint.slice();
    const merge = (a, b) => (a && b ? a : null);
    if (unequal) {
      // Unequal pieces glue straight back into the whole.
      unequal = false;
      if (shape === 'set' || shape === 'circle') n = 1; else { cols = 1; rows = 1; }
      paint = [old.every(Boolean) ? old[0] : null];
    } else if (pt % 2 === 1) {
      if (shape === 'set' || shape === 'circle') n = 1; else { cols = 1; rows = 1; }
      rot = 0;
      paint = [old.every(Boolean) ? old[0] : null];
    } else if (shape === 'set' || shape === 'circle') {
      const score = off => { let s = 0; for (let i = 0; i < pt; i += 2) { const a = old[(i + off) % pt], b = old[(i + off + 1) % pt]; if (!!a === !!b) s++; } return s; };
      const off = shape === 'circle' && score(1) > score(0) ? 1 : 0;
      const np = [];
      for (let i = 0; i < pt; i += 2) np.push(merge(old[(i + off) % pt], old[(i + off + 1) % pt]));
      if (shape === 'circle') rot = (rot + off) / 2;
      n = pt / 2; paint = np;
    } else {
      // Grid: merge pairs of columns or pairs of rows, whichever keeps the shading.
      const opts = [];
      if (rows % 2 === 0) opts.push('rows');
      if (cols % 2 === 0) opts.push('cols');
      const result = how => {
        const nc = how === 'cols' ? cols / 2 : cols, nr = how === 'rows' ? rows / 2 : rows;
        const np = Array(nc * nr).fill(null); let ok = 0;
        for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
          const [i1, i2] = how === 'cols' ? [r * cols + 2 * c, r * cols + 2 * c + 1] : [2 * r * cols + c, (2 * r + 1) * cols + c];
          const a = old[i1], b = old[i2];
          if (!!a === !!b) ok++;
          np[r * nc + c] = merge(a, b);
        }
        return { nc, nr, np, ok, how };
      };
      const cands = opts.map(result);
      // Prefer the merge that keeps the most shading; on a tie undo the bigger dimension (rows first when equal).
      cands.sort((a, b) => (b.ok - a.ok) || ((a.how === 'rows' ? rows : cols) >= (b.how === 'rows' ? rows : cols) ? -1 : 1));
      const best = cands[0];
      cols = best.nc; rows = best.nr; paint = best.np;
    }
    sfx('pop');
    draw();
    changed();
  }

  function wobble() {
    sfx('click');
    shakeNext = true;
    draw();
  }

  function toggle(i) {
    if (ro()) return;
    paint[i] = paint[i] ? null : shadeCol();
    sfx('click');
    draw();
    changed();
  }

  // ---------- drawing ----------
  function label(x, y, size, den, colour = INK) {
    const g = S('g', { 'pointer-events': 'none' });
    const fs = clamp(size, 24, 64);
    g.appendChild(S('text', { x, y: y - fs * 0.12, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': fs, fill: colour }, ['1']));
    g.appendChild(S('rect', { x: x - fs * 0.34, y: y - fs * 0.02 + 2, width: fs * 0.68, height: Math.max(3, fs * 0.08), rx: 1.5, fill: colour }));
    g.appendChild(S('text', { x, y: y + fs * 0.86, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': fs, fill: colour }, [String(den)]));
    return g;
  }

  function piece(elm, i) {
    elm.setAttribute('class', 'pc');
    elm.setAttribute('fill', paint[i] || EMPTY);
    if (!ro()) pieceUnbinds.push(onTap(elm, () => toggle(i)));
    return elm;
  }

  function draw() {
    pieceUnbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    wrap.classList.toggle('ro', ro());
    wrap.classList.toggle('rm', reducedMotion());
    const body = S('g', { class: shakeNext ? 'shake' : '' });
    shakeNext = false;
    const newLines = new Set();
    const line = (key, d, w = 4) => {
      newLines.add(key);
      return S('path', { d, stroke: INK, 'stroke-width': w, 'stroke-linecap': 'round', fill: 'none', class: noCrack || oldLines.has(key) ? '' : 'crack', 'pointer-events': 'none' });
    };
    const showLabels = p.labels && !unequal;
    if (shape === 'set') drawSet(body, line, showLabels);
    else if (shape === 'circle') {
      const cx = VW / 2, cy = VH / 2, R = 200;
      const cuts = angCuts();
      if (n === 1) body.appendChild(piece(S('circle', { cx, cy, r: R }), 0));
      else if (unequal && n === 2) {
        // A cut that misses the middle.
        const x = cx + R * 0.38, dy = Math.sqrt(R * R - (x - cx) ** 2);
        body.appendChild(piece(S('path', { d: `M${x} ${cy - dy}A${R} ${R} 0 1 0 ${x} ${cy + dy}Z` }), 0));
        body.appendChild(piece(S('path', { d: `M${x} ${cy - dy}A${R} ${R} 0 0 1 ${x} ${cy + dy}Z` }), 1));
      } else {
        for (let i = 0; i < n; i++) {
          const a0 = cuts[i] * 2 * Math.PI - Math.PI / 2, a1 = cuts[i + 1] * 2 * Math.PI - Math.PI / 2;
          const big = a1 - a0 > Math.PI ? 1 : 0;
          const d = `M${cx} ${cy}L${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)}A${R} ${R} 0 ${big} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}Z`;
          body.appendChild(piece(S('path', { d }), i));
        }
      }
      // Cut lines.
      if (n > 1) {
        if (unequal && n === 2) {
          const x = cx + R * 0.38, dy = Math.sqrt(R * R - (x - cx) ** 2);
          body.appendChild(line(`c:u`, `M${x} ${cy - dy}L${x} ${cy + dy}`));
        } else {
          for (let i = 0; i < n; i++) {
            const a = cuts[i] * 2 * Math.PI - Math.PI / 2;
            body.appendChild(line(`c:${(cuts[i] % 1).toFixed(4)}`, `M${cx} ${cy}L${cx + R * Math.cos(a)} ${cy + R * Math.sin(a)}`));
          }
        }
      }
      body.appendChild(S('circle', { cx, cy, r: R, fill: 'none', stroke: INK, 'stroke-width': 5, 'pointer-events': 'none' }));
      if (showLabels && n > 1) {
        for (let i = 0; i < n; i++) {
          const am = ((cuts[i] + cuts[i + 1]) / 2) * 2 * Math.PI - Math.PI / 2;
          const rr = n === 2 ? R * 0.5 : R * 0.6;
          body.appendChild(label(cx + rr * Math.cos(am), cy + rr * Math.sin(am) - 8, n >= 8 ? 26 : n >= 6 ? 32 : 46, n));
        }
      }
    } else {
      const b = box();
      const xs = cutsX(), ys = cutsY();
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x0 = b.x + xs[c] * b.w, x1 = b.x + xs[c + 1] * b.w, y0 = b.y + ys[r] * b.h, y1 = b.y + ys[r + 1] * b.h;
        body.appendChild(piece(S('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }), r * cols + c));
        if (showLabels && cols * rows > 1) {
          const sz = Math.min(x1 - x0, y1 - y0) * 0.3;
          body.appendChild(label((x0 + x1) / 2, (y0 + y1) / 2 - sz * 0.3, sz, cols * rows));
        }
      }
      for (let c = 1; c < cols; c++) { const x = b.x + xs[c] * b.w; body.appendChild(line(`v:${xs[c].toFixed(4)}`, `M${x} ${b.y}V${b.y + b.h}`)); }
      for (let r = 1; r < rows; r++) { const y = b.y + ys[r] * b.h; body.appendChild(line(`h:${ys[r].toFixed(4)}`, `M${b.x} ${y}H${b.x + b.w}`)); }
      body.appendChild(S('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 4, fill: 'none', stroke: INK, 'stroke-width': 5, 'pointer-events': 'none' }));
    }
    root.appendChild(body);
    oldLines = newLines;
    noCrack = false;
    syncTools();
  }

  function setSizes() {
    if (!unequal || n <= 1) return Array(n).fill(0).map((_, i) => Math.floor(setSize / n) + (i < setSize % n ? 1 : 0));
    const base = Array(n).fill(0).map((_, i) => Math.floor(setSize / n) + (i < setSize % n ? 1 : 0));
    if (base[0] > 1) { base[0]--; base[n - 1]++; }
    if (n > 2 && base[1] > 1) { base[1]--; base[n - 2]++; }
    return base;
  }

  function drawSet(body, line, showLabels) {
    const sizes = setSizes();
    const AW = VW - 30, AH = VH - 30;
    const maxG = Math.max(...sizes, 1);
    const lab = showLabels && n > 1 ? 1.5 : 0;
    // Pick groups-per-row and dots-per-row that give the biggest dots.
    let best = null;
    for (let pr = 1; pr <= n; pr++) {
      const g2 = Math.ceil(n / pr);
      for (let gc = 1; gc <= maxG; gc++) {
        const rr = Math.ceil(maxG / gc);
        const spk = Math.min((AW / pr) * 0.88 / (gc + 0.7), (AH / g2) * 0.88 / (rr + 0.7 + lab), 80) * (maxG % gc === 0 ? 1 : 0.95);
        if (!best || spk > best.sp + 0.01) best = { sp: spk, per: pr, gcols: gc };
      }
    }
    const per = best.per, gr = Math.ceil(n / per), gcols = best.gcols, sp = best.sp;
    const grows = Math.ceil(maxG / gcols);
    const cw = AW / per, ch = AH / gr;
    sizes.forEach((sz, gi) => {
      const row = Math.floor(gi / per), inRow = Math.min(per, n - row * per);
      const cx = VW / 2 + ((gi % per) - (inRow - 1) / 2) * cw, cy = 15 + (row + 0.5) * ch - lab * sp * 0.5;
      const c = paint[gi];
      const rw = (gcols + 0.7) * sp, rh = (grows + 0.7) * sp;
      const ring = S('rect', { x: cx - rw / 2, y: cy - rh / 2, width: rw, height: rh, rx: Math.min(rw, rh) * 0.42,
        stroke: c || 'rgba(243,239,230,.55)', 'stroke-width': 4, 'stroke-dasharray': c ? '' : '10 8' });
      piece(ring, gi);
      ring.setAttribute('fill', c ? hexA(c, 0.16) : 'rgba(255,255,255,.04)');
      if (n > 1 && !noCrack && !oldLines.has(`s:${n}:${gi}`)) ring.classList.add('fadein');
      line(`s:${n}:${gi}`, '');
      body.appendChild(ring);
      for (let k = 0; k < sz; k++) {
        const r = Math.floor(k / gcols), inR = Math.min(gcols, sz - r * gcols);
        const rowsHere = Math.ceil(sz / gcols);
        const x = cx + ((k % gcols) - (inR - 1) / 2) * sp, y = cy + (r - (rowsHere - 1) / 2) * sp;
        body.appendChild(S('circle', { cx: x, cy: y, r: sp * 0.36, fill: c || 'rgba(243,239,230,.16)', stroke: c ? 'rgba(0,0,0,.25)' : 'rgba(243,239,230,.7)', 'stroke-width': 3, 'pointer-events': 'none' }));
      }
      if (lab) { const fs = clamp(sp * 0.62, 24, 40); body.appendChild(label(cx, cy + rh / 2 + fs * 0.95, fs, n)); }
    });
  }

  function hexA(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return `rgba(255,255,255,${a})`;
    const v = parseInt(m[1], 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
  }

  // ---------- tools ----------
  let toolKey = '';
  function syncTools() {
    const list = ro() ? [] : (Array.isArray(p.tools) ? p.tools.map(String) : []);
    tools.style.display = list.length ? '' : 'none';
    const key = list.join(',') + '|' + colourIdx + '|' + (p.colour || '');
    if (key === toolKey) return;
    toolKey = key;
    unbinds.splice(0).forEach(u => u());
    tools.replaceChildren();
    for (const t of list) {
      const b = document.createElement('button');
      if (['2', '3', '4'].includes(t)) {
        b.innerHTML = `${I_HAMMER}<span>${t}</span>`;
        b.setAttribute('aria-label', `Split in ${t}`);
        unbinds.push(onTap(b, () => hammer(+t)));
      } else if (t === 'glue') {
        b.className = 'glue';
        b.innerHTML = `${I_GLUE}<span>Glue</span>`;
        b.setAttribute('aria-label', 'Glue');
        unbinds.push(onTap(b, glue));
      } else if (t === 'fill') {
        b.innerHTML = `<span class="sw" style="background:${shadeCol()}"></span>`;
        b.style.color = shadeCol();
        b.setAttribute('aria-label', 'Paint colour');
        unbinds.push(onTap(b, () => { if (p.colour) return; colourIdx = (colourIdx + 1) % 4; sfx('click'); syncTools(); }));
      } else continue;
      tools.appendChild(b);
    }
  }

  const api = {
    getState: state,
    update(np = {}) {
      p = { ...p, ...np };
      const geo = ['shape', 'parts', 'setSize', 'shaded', 'shadedIdx', 'unequal'].some(k => k in np);
      if (geo) { setup(); noCrack = true; }
      draw();
    },
    showAnswer(answer) {
      // answer: a goal { parts, shaded } (or { fraction: "3/4" }) rebuilds the picture. Anything else
      // (a choice answer such as "3/4" for a picture that is already right) just gives the shape a nudge.
      let k = null, sh = null;
      if (answer && typeof answer === 'object') {
        k = answer.parts ?? null; sh = answer.shaded ?? null;
        if (typeof answer.fraction === 'string' && /^\d+\/\d+$/.test(answer.fraction)) [sh, k] = answer.fraction.split('/').map(Number);
      }
      if (k && ALLOWED.includes(k) && k !== parts()) { p = { ...p, parts: k, shaded: 0, shadedIdx: undefined, unequal: false }; setup(); }
      if (sh !== null) { paint = paint.map((_, i) => (i < sh ? shadeCol() : null)); }
      shakeNext = true;
      draw();
    },
    destroy() {
      pieceUnbinds.splice(0).forEach(u => u());
      unbinds.splice(0).forEach(u => u());
      el.replaceChildren();
    },
  };

  p = { ...props };
  setup();
  draw();
  return api;
}
