// shapes2d: 2-D shapes to name, tap (count sides or vertices) and fold for a vertical line of symmetry.
// Props: shape (see SHAPES2D), rotate (degrees, clockwise), scale (0.4 to 1), colour (name or #hex),
//        tap ('sides' | 'vertices' | null): tapping a side lights it gold and numbers it; tapping a vertex drops a numbered dot.
//            Each side or vertex counts once only (a second tap on it does nothing).
//        fold (true: dashed vertical line through the middle and a Fold button; the left half folds over the right),
//        folded (start folded), marks ('right': small squares on right-angle corners),
//        showAll ('sides' | 'vertices': light and number them all, e.g. for a reveal),
//        shapes (array of { shape | poly, rotate, scale, x, y, colour, label } to draw several shapes at once:
//            without x/y they sit in a neat grid, each fitted to its cell; with x/y (viewBox units, 800 by 500) the shape's
//            own origin goes at (x, y) and one unit is `unit` (default 60) times scale pixels, so pieces can be composed exactly;
//            `poly` is an array of [x, y] points in those units),
//        readonly.
// State: { sides, vertices, folded, symmetric, shape }  (sides/vertices = how many tapped so far;
//         symmetric = the true vertical-symmetry property of the shape as rotated now)
// Debug: dev/harness.html?widget=shapes2d&props={"shape":"kite","tap":"sides","fold":true}
import { S, svgRoot, onTap, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { COL, FONT, FRAC } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: '2-D shapes',
  playground: { shape: 'hexagon', tap: 'sides', fold: true },
  state: ['sides', 'vertices', 'folded', 'symmetric', 'shape'],
};

const W = 800, H = 500;
let uid = 0;

// Named colours used by shapes2d, pattern and the generators. Goals compare the name, so content uses names.
export const COLOURS = {
  gold: '#f2b544', cyan: '#5fd4ff', pink: '#ff8fb1', green: '#6fe3a5', purple: '#b48cff',
  orange: '#ff9a52', red: '#ff6b57', blue: '#4f9dff', white: '#f3efe6', grey: '#9aa3b2',
};
export function colourOf(c, fallback = '#b48cff') {
  if (c && COLOURS[c]) return COLOURS[c];
  if (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)) return c;
  return fallback;
}

// ---------- geometry (unit coordinates, y down, clockwise rotation for positive degrees) ----------
const rad = d => (d * Math.PI) / 180;
const reg = (n, r, start) => Array.from({ length: n }, (_, i) => { const a = rad(start + (i * 360) / n); return [r * Math.cos(a), r * Math.sin(a)]; });
const arcPts = (rx, ry, cx, cy, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = rad(a0 + ((a1 - a0) * i) / n); return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
function cubic(p0, p1, p2, p3, n = 18) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    const f = k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k];
    return [f(0), f(1)];
  });
}
function quadB(p0, c, p1, n = 16) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
  });
}

const POLYS = {
  triangle: reg(3, 1, -90),
  'right-triangle': [[-1, -0.9], [-1, 0.9], [1.6, 0.9]],
  'long-triangle': [[0, -1.6], [0.5, 1], [-0.5, 1]],
  scalene: [[-1, 0.8], [1.3, 0.8], [-0.3, -1]],
  'half-square': [[-1, -1], [-1, 1], [1, 1]],
  square: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
  rectangle: [[-1.5, -0.9], [1.5, -0.9], [1.5, 0.9], [-1.5, 0.9]],
  'long-rectangle': [[-2.2, -0.45], [2.2, -0.45], [2.2, 0.45], [-2.2, 0.45]],
  pentagon: reg(5, 1, -90),
  hexagon: reg(6, 1, 0),
  octagon: reg(8, 1, 22.5),
  kite: [[0, -1.2], [0.75, -0.35], [0, 1.3], [-0.75, -0.35]],
  rhombus: [[0, -1.1], [0.75, 0], [0, 1.1], [-0.75, 0]],
  parallelogram: [[-1.3, 0.65], [0.6, 0.65], [1.3, -0.65], [-0.6, -0.65]],
  trapezium: [[-1.3, 0.7], [1.3, 0.7], [0.65, -0.7], [-0.65, -0.7]],
  'irregular-quad': [[-1.1, 0.9], [1.2, 0.6], [0.6, -1], [-0.6, -0.4]],
  'irregular-pentagon': [[-1.1, 0.8], [0.9, 1], [1.2, -0.1], [0.15, -1], [-0.85, -0.55]],
  'irregular-hexagon': [[-1.2, 0.2], [-0.6, 1], [0.7, 0.85], [1.25, 0.1], [0.6, -0.9], [-0.5, -0.75]],
  'l-hexagon': [[-1, -1], [0, -1], [0, 0], [1, 0], [1, 1], [-1, 1]],
  house: [[-0.9, 1], [0.9, 1], [0.9, -0.1], [0, -1.2], [-0.9, -0.1]],
  arrow: [[0, -1.2], [0.8, -0.2], [0.3, -0.2], [0.3, 1], [-0.3, 1], [-0.3, -0.2], [-0.8, -0.2]],
  star: Array.from({ length: 10 }, (_, i) => { const a = rad(-90 + i * 36), r = i % 2 ? 0.45 : 1; return [r * Math.cos(a), r * Math.sin(a)]; }),
};
const CURVES = ['circle', 'semicircle', 'oval', 'heart', 'curvy-triangle'];

export const SHAPES2D = [...Object.keys(POLYS), ...CURVES];

// The name a child would use. Irregular shapes take the name their number of sides gives them.
export const NAME2D = {
  circle: 'circle', semicircle: 'semicircle', oval: 'oval', heart: 'heart', 'curvy-triangle': 'curvy shape',
  triangle: 'triangle', 'right-triangle': 'triangle', 'long-triangle': 'triangle', scalene: 'triangle', 'half-square': 'triangle',
  square: 'square', rectangle: 'rectangle', 'long-rectangle': 'rectangle',
  pentagon: 'pentagon', 'irregular-pentagon': 'pentagon', house: 'pentagon',
  hexagon: 'hexagon', 'irregular-hexagon': 'hexagon', 'l-hexagon': 'hexagon', octagon: 'octagon',
  kite: 'kite', rhombus: 'rhombus', parallelogram: 'parallelogram', trapezium: 'trapezium', 'irregular-quad': 'quadrilateral',
  arrow: 'arrow', star: 'star',
};

const DEFS = {};
function def(name) {
  if (DEFS[name]) return DEFS[name];
  let d;
  if (POLYS[name]) {
    const pts = POLYS[name];
    d = { sides: pts.map((q, i) => [q, pts[(i + 1) % pts.length]]), verts: pts };
  } else if (name === 'circle') {
    d = { sides: [arcPts(1, 1, 0, 0, 0, 360, 64)], verts: [] };
  } else if (name === 'oval') {
    d = { sides: [arcPts(1.45, 0.95, 0, 0, 0, 360, 64)], verts: [] };
  } else if (name === 'semicircle') {
    const arc = arcPts(1, 1, 0, 0.45, 180, 360, 48);
    d = { sides: [arc, [arc[arc.length - 1], arc[0]]], verts: [arc[0], arc[arc.length - 1]] };
  } else if (name === 'heart') {
    const tip = [0, 1.05], dip = [0, -0.55];
    const right = [...cubic(tip, [0.55, 0.6], [1.15, 0.15], [1.1, -0.45]), ...cubic([1.1, -0.45], [1.05, -1.05], [0.25, -1.15], dip).slice(1)];
    const left = right.map(([x, y]) => [-x, y]).reverse();
    d = { sides: [right, left], verts: [tip, dip] };
  } else if (name === 'curvy-triangle') {
    const v = reg(3, 1, -90);
    const sides = v.map((a, i) => {
      const b = v[(i + 1) % 3];
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const len = Math.hypot(m[0], m[1]) || 1;
      return quadB(a, [m[0] + (m[0] / len) * 0.55, m[1] + (m[1] / len) * 0.55], b);
    });
    d = { sides, verts: v };
  } else {
    return def('square');
  }
  DEFS[name] = d;
  return d;
}

const validShape = s => (POLYS[s] || CURVES.includes(s) ? s : 'square');

function rotPts(pts, deg) {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}
function rotated(name, deg) {
  const d = def(validShape(name));
  return { sides: d.sides.map(sd => rotPts(sd, deg)), verts: rotPts(d.verts, deg) };
}
function bbox(sides) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const sd of sides) for (const [x, y] of sd) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0 || 1, h: y1 - y0 || 1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
function distSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  let t = L ? ((px - a[0]) * dx + (py - a[1]) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}
const fmt = v => Math.round(v * 10) / 10;
function pathOf(sides, close = true) {
  let d = '';
  sides.forEach((sd, i) => sd.forEach((q, j) => {
    if (i === 0 && j === 0) d += `M${fmt(q[0])} ${fmt(q[1])}`;
    else if (j > 0) d += `L${fmt(q[0])} ${fmt(q[1])}`;
  }));
  return d + (close ? 'Z' : '');
}
const linePath = pts => pts.map((q, j) => `${j ? 'L' : 'M'}${fmt(q[0])} ${fmt(q[1])}`).join('');

// Facts about a shape (used by the generators too).
export function shapeInfo(name) {
  const d = def(validShape(name));
  const straight = d.sides.filter(s => s.length === 2).length;
  return { sides: d.sides.length, vertices: d.verts.length, straight, curved: d.sides.length - straight, name: NAME2D[validShape(name)] };
}

const SYM = {};
// True if the shape, turned by `deg`, has a vertical line of symmetry through its middle.
export function isSymmetric(name, deg = 0) {
  const key = `${name}@${Math.round(((deg % 360) + 360) % 360)}`;
  if (key in SYM) return SYM[key];
  const r = rotated(name, deg);
  const b = bbox(r.sides);
  const segs = [];
  r.sides.forEach(sd => { for (let i = 0; i < sd.length - 1; i++) segs.push([sd[i], sd[i + 1]]); });
  const tol = 0.012 * Math.max(b.w, b.h);
  let ok = true;
  outer: for (const [a, q] of segs) {
    for (let k = 0; k < 4; k++) {
      const t = k / 4, x = a[0] + (q[0] - a[0]) * t, y = a[1] + (q[1] - a[1]) * t;
      const rx = 2 * b.cx - x;
      if (!segs.some(sg => distSeg(rx, y, sg[0], sg[1]) < tol)) { ok = false; break outer; }
    }
  }
  SYM[key] = ok;
  return ok;
}

// Indices of the vertices that are right angles (convex corners only). Curved shapes have none.
export function rightAngleIdx(name) {
  const pts = POLYS[validShape(name)];
  if (!pts) return [];
  let area = 0;
  pts.forEach((q, i) => { const r = pts[(i + 1) % pts.length]; area += q[0] * r[1] - r[0] * q[1]; });
  const out = [];
  pts.forEach((v, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const u = [v[0] - a[0], v[1] - a[1]], w = [b[0] - v[0], b[1] - v[1]];
    const cos = (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w));
    const cross = u[0] * w[1] - u[1] * w[0];
    if (Math.abs(cos) < 0.03 && Math.sign(cross) === Math.sign(area)) out.push(i);
  });
  return out;
}
export const rightAngles = name => rightAngleIdx(name).length;

// A path string for the shape fitted in a size-by-size box centred at (cx, cy). Used by the pattern widget.
export function shapePathFit(name, rotate, cx, cy, size) {
  const r = rotated(name, rotate || 0);
  const b = bbox(r.sides);
  const k = size / Math.max(b.w, b.h);
  return pathOf(r.sides.map(sd => sd.map(([x, y]) => [cx + (x - b.cx) * k, cy + (y - b.cy) * k])));
}

// ---------- the widget ----------
export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-shapes2d', `
    .w-shapes2d { width: 100%; height: 100%; }
    .w-shapes2d .hit, .w-shapes2d .foldbtn { cursor: pointer; }
    .w-shapes2d.ro .hit { cursor: default; }
    .w-shapes2d .badge, .w-shapes2d .deco { pointer-events: none; }
    .w-shapes2d .glow { filter: drop-shadow(0 0 10px rgba(242,181,68,.9)); }
    .w-shapes2d .foldbtn rect { transition: fill .15s; }
    .w-shapes2d .foldbtn:active rect { fill: rgba(242,181,68,.35); }
    .w-shapes2d .pulse { animation: w-shapes2d-pulse .3s ease; }
    @keyframes w-shapes2d-pulse { 50% { opacity: .4; } }
    @media (prefers-reduced-motion: reduce) { .w-shapes2d .pulse { animation: none; } }
  `);
  const id = ++uid;
  let p = { ...props };
  let lit = [];   // side indices in tap order
  let litV = [];  // vertex indices in tap order
  let folded = !!p.folded;
  let foldT = folded ? 1 : 0;
  let raf = 0, timers = [];
  const root = svgRoot(W, H, 'w-shapes2d');
  el.appendChild(root);
  const unbinds = [];
  // readonly: false arriving through update() (a hint) switches interaction on even if mounted readonly.
  const ro = () => (p.readonly === false ? false : !!(p.readonly || ctx.readonly));
  const shapeName = () => validShape(p.shape);
  const rot = () => +p.rotate || 0;
  const symmetric = () => isSymmetric(shapeName(), rot());
  const tapMode = () => (p.tap === 'sides' || p.tap === 'vertices' ? p.tap : null);

  function layoutSingle() {
    const r = rotated(shapeName(), rot());
    const b = bbox(r.sides);
    const sc = clamp(+p.scale || 1, 0.4, 1);
    const maxW = p.fold ? 500 : 600, maxH = p.fold ? 340 : 360;
    const k = Math.min(maxW / b.w, maxH / b.h) * sc;
    const cx = W / 2, cy = H / 2 - (p.fold ? 14 : 0);
    const T = ([x, y]) => [cx + (x - b.cx) * k, cy + (y - b.cy) * k];
    return { sides: r.sides.map(sd => sd.map(T)), verts: r.verts.map(T), cx, cy, top: cy - (b.h * k) / 2, bottom: cy + (b.h * k) / 2 };
  }

  function badge(x, y, n) {
    return S('g', { class: 'badge', transform: `translate(${fmt(x)} ${fmt(y)})` }, [
      S('circle', { r: 22, fill: COL.tens, stroke: '#1a1205', 'stroke-width': 2 }),
      S('text', { 'text-anchor': 'middle', y: 10, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 28, fill: '#1a1205' }, [String(n)]),
    ]);
  }
  function outward(x, y, cx, cy, d) {
    const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1;
    return [x + (dx / L) * d, y + (dy / L) * d];
  }

  function flapTransform(cx, t) {
    const s = Math.cos(Math.PI * t);
    return `translate(${cx} 0) scale(${Math.abs(s) < 0.001 ? 0.001 : fmt(s * 1000) / 1000} 1) translate(${-cx} 0)`;
  }

  function changed() { draw(); ctx.onChange && ctx.onChange(api.getState()); }

  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    root.classList.toggle('ro', ro());
    if (Array.isArray(p.shapes) && p.shapes.length) { drawMulti(); return; }
    const L = layoutSingle();
    const col = colourOf(p.colour);
    const d = pathOf(L.sides);
    const shapeEl = (c, extra = {}) => S('path', { d, fill: c, 'fill-opacity': 0.3, stroke: c, 'stroke-width': 6, 'stroke-linejoin': 'round', ...extra });

    if (p.fold) {
      const clipL = `w-s2d-${id}-l`, clipR = `w-s2d-${id}-r`;
      root.appendChild(S('defs', {}, [
        S('clipPath', { id: clipL }, [S('rect', { x: -20, y: -20, width: L.cx + 20, height: H + 40 })]),
        S('clipPath', { id: clipR }, [S('rect', { x: L.cx, y: -20, width: W - L.cx + 20, height: H + 40 })]),
      ]));
      const done = folded && foldT >= 1;
      const match = done && symmetric();
      root.appendChild(S('g', { 'clip-path': `url(#${clipR})`, class: match ? 'glow' : '' }, [shapeEl(match ? COL.tens : col)]));
      const flapCol = done && !match ? COL.b : (match ? COL.tens : col);
      const flap = S('g', { class: 'flap' + (match ? ' glow' : ''), transform: flapTransform(L.cx, foldT) }, [
        S('g', { 'clip-path': `url(#${clipL})` }, [shapeEl(flapCol, done && !match ? { 'stroke-dasharray': '16 10', 'fill-opacity': 0.4 } : {})]),
      ]);
      root.appendChild(flap);
      api._flap = { flap, cx: L.cx };
      root.appendChild(S('line', { class: 'deco', x1: L.cx, y1: Math.max(8, L.top - 34), x2: L.cx, y2: Math.min(H - 8, L.bottom + 34), stroke: COL.ink, 'stroke-opacity': 0.75, 'stroke-width': 4, 'stroke-dasharray': '14 10' }));
    } else {
      root.appendChild(shapeEl(col));
    }

    // Right-angle marks.
    if (p.marks === 'right' && !(p.fold && folded)) {
      for (const i of rightAngleIdx(shapeName())) {
        const v = L.verts[i], n = L.verts.length;
        const a = L.verts[(i - 1 + n) % n], b = L.verts[(i + 1) % n];
        const u1 = [(a[0] - v[0]), (a[1] - v[1])], u2 = [(b[0] - v[0]), (b[1] - v[1])];
        const l1 = Math.hypot(...u1), l2 = Math.hypot(...u2), m = Math.min(26, l1 * 0.3, l2 * 0.3);
        const e1 = [u1[0] / l1 * m, u1[1] / l1 * m], e2 = [u2[0] / l2 * m, u2[1] / l2 * m];
        root.appendChild(S('path', { class: 'deco', d: `M${fmt(v[0] + e1[0])} ${fmt(v[1] + e1[1])}L${fmt(v[0] + e1[0] + e2[0])} ${fmt(v[1] + e1[1] + e2[1])}L${fmt(v[0] + e2[0])} ${fmt(v[1] + e2[1])}`, fill: 'none', stroke: COL.ink, 'stroke-width': 4 }));
      }
    }

    const showTaps = !(p.fold && (folded || foldT > 0));
    if (showTaps) {
      // Lit sides and vertices.
      lit.forEach(i => {
        const sd = L.sides[i];
        if (!sd) return;
        root.appendChild(S('path', { class: 'deco lit-side', 'data-i': i, d: linePath(sd), fill: 'none', stroke: COL.tens, 'stroke-width': 13, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      });
      litV.forEach(i => {
        const v = L.verts[i];
        if (v) root.appendChild(S('circle', { class: 'deco', cx: fmt(v[0]), cy: fmt(v[1]), r: 14, fill: COL.tens, stroke: '#1a1205', 'stroke-width': 3 }));
      });
      // Hit areas (generous).
      const mode = tapMode();
      if (mode && !ro()) {
        if (mode === 'sides') {
          L.sides.forEach((sd, i) => {
            const hit = S('path', { class: 'hit', d: linePath(sd), fill: 'none', stroke: '#000', 'stroke-opacity': 0, 'stroke-width': 60, 'stroke-linecap': 'round', 'pointer-events': 'stroke' });
            unbinds.push(onTap(hit, () => {
              if (lit.includes(i)) { sfx('tick'); pulse(`.lit-side[data-i="${i}"]`); return; }
              lit.push(i); sfx('pop'); changed();
            }));
            root.appendChild(hit);
          });
        } else {
          L.verts.forEach((v, i) => {
            const hit = S('circle', { class: 'hit', cx: fmt(v[0]), cy: fmt(v[1]), r: 40, fill: '#000', 'fill-opacity': 0, 'pointer-events': 'all' });
            unbinds.push(onTap(hit, () => {
              if (litV.includes(i)) { sfx('tick'); return; }
              litV.push(i); sfx('pop'); changed();
            }));
            root.appendChild(hit);
          });
        }
      }
      // Number badges on top.
      lit.forEach((i, k) => {
        const sd = L.sides[i];
        if (!sd) return;
        const closed = sd.length > 2 && Math.hypot(sd[0][0] - sd[sd.length - 1][0], sd[0][1] - sd[sd.length - 1][1]) < 1;
        const m = sd.length === 2 ? [(sd[0][0] + sd[1][0]) / 2, (sd[0][1] + sd[1][1]) / 2] : sd[Math.round((sd.length - 1) * (closed ? 0.875 : 0.5))];
        const [bx, by] = outward(m[0], m[1], L.cx, L.cy, 38);
        root.appendChild(badge(clamp(bx, 24, W - 24), clamp(by, 24, H - 24), k + 1));
      });
      litV.forEach((i, k) => {
        const v = L.verts[i];
        if (!v) return;
        const [bx, by] = outward(v[0], v[1], L.cx, L.cy, 42);
        root.appendChild(badge(clamp(bx, 24, W - 24), clamp(by, 24, H - 24), k + 1));
      });
    }

    // Fold button.
    if (p.fold && !ro()) {
      const g = S('g', { class: 'foldbtn', role: 'button', tabindex: 0, 'aria-label': folded ? 'Unfold' : 'Fold' }, [
        S('rect', { x: W - 172, y: H - 80, width: 160, height: 68, rx: 34, fill: 'rgba(242,181,68,.14)', stroke: COL.tens, 'stroke-width': 3 }),
        S('text', { x: W - 92, y: H - 36, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 28, fill: COL.tens }, [folded ? 'Unfold' : 'Fold']),
      ]);
      unbinds.push(onTap(g, toggleFold));
      root.appendChild(g);
    }
  }

  function pulse(sel) {
    const n = root.querySelector(sel);
    if (!n) return;
    n.classList.remove('pulse'); void n.getBoundingClientRect(); n.classList.add('pulse');
  }

  let safety = 0;
  function toggleFold() {
    if (raf || safety) return;
    const from = foldT, to = folded ? 0 : 1;
    sfx('whoosh');
    const finish = () => {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(safety);
      raf = 0; safety = 0; foldT = to; folded = to === 1; changed();
    };
    if (reducedMotion()) { finish(); return; }
    const t0 = performance.now(), dur = 700;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      foldT = from + (to - from) * e;
      if (api._flap) api._flap.flap.setAttribute('transform', flapTransform(api._flap.cx, foldT));
      if (k < 1) raf = requestAnimationFrame(step); else finish();
    };
    // Hide the tap layers while folding.
    foldT = from + (to - from) * 0.001;
    draw();
    raf = requestAnimationFrame(step);
    // Finish even when frames are paused (hidden tab, headless test).
    safety = setTimeout(finish, dur + 200);
  }

  function drawMulti() {
    const items = p.shapes.slice(0, 16);
    const placed = items.some(it => it && (it.x !== undefined || it.y !== undefined));
    const n = items.length;
    const cols = n <= 4 ? n : Math.ceil(n / 2);
    const rowsN = Math.ceil(n / cols);
    const cw = W / cols, ch = H / rowsN;
    const anyLabel = items.some(it => it && it.label);
    items.forEach((it, i) => {
      if (!it) return;
      const r = it.poly ? null : rotated(it.shape, +it.rotate || 0);
      let sides;
      if (it.poly && Array.isArray(it.poly) && it.poly.length >= 3) {
        const pts = rotPts(it.poly, +it.rotate || 0);
        sides = pts.map((q, j) => [q, pts[(j + 1) % pts.length]]);
      } else sides = (r || rotated('square', 0)).sides;
      let T;
      if (placed) {
        const u = (+p.unit || 60) * (it.scale ?? 1);
        const ox = +(it.x ?? W / 2), oy = +(it.y ?? H / 2);
        T = ([x, y]) => [ox + x * u, oy + y * u];
      } else {
        const b = bbox(sides);
        const cx = ((i % cols) + 0.5) * cw, cy = (Math.floor(i / cols) + 0.5) * ch - (anyLabel ? 20 : 0);
        const k = Math.min((cw * 0.74) / b.w, (ch * (anyLabel ? 0.56 : 0.72)) / b.h) * clamp(it.scale ?? 1, 0.3, 1);
        T = ([x, y]) => [cx + (x - b.cx) * k, cy + (y - b.cy) * k];
      }
      const ts = sides.map(sd => sd.map(T));
      const c = colourOf(it.colour, FRAC[i % FRAC.length]);
      root.appendChild(S('path', { d: pathOf(ts), fill: c, 'fill-opacity': 0.32, stroke: c, 'stroke-width': 5, 'stroke-linejoin': 'round' }));
      if (it.label) {
        const b2 = bbox(ts);
        const ly = placed ? Math.min(H - 8, b2.y1 + 36) : Math.min(H - 10, (Math.floor(i / cols) + 1) * ch - 14);
        root.appendChild(S('text', { x: fmt(b2.cx), y: fmt(ly), 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: COL.ink }, [String(it.label)]));
      }
    });
  }

  function lightAll(kind) {
    const d = def(shapeName());
    if (kind === 'sides') lit = d.sides.map((_, i) => i);
    else if (kind === 'vertices') litV = d.verts.map((_, i) => i);
  }

  function clearTimers() { timers.splice(0).forEach(t => clearTimeout(t)); }

  const api = {
    getState() {
      const multi = Array.isArray(p.shapes) && p.shapes.length;
      return { sides: lit.length, vertices: litV.length, folded: !!folded, symmetric: multi ? false : symmetric(), shape: multi ? null : shapeName() };
    },
    update(np = {}) {
      const reset = ['shape', 'rotate', 'tap', 'shapes', 'scale'].some(k => k in np && JSON.stringify(np[k]) !== JSON.stringify(p[k]));
      p = { ...p, ...np };
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      clearTimeout(safety); safety = 0;
      clearTimers();
      if (reset) { lit = []; litV = []; }
      if (np.showAll) lightAll(np.showAll);
      if ('folded' in np) { folded = !!np.folded; foldT = folded ? 1 : 0; }
      else if (reset || ('fold' in np && !np.fold)) { folded = false; foldT = 0; }
      draw();
    },
    showAnswer() {
      clearTimers();
      if (Array.isArray(p.shapes) && p.shapes.length) return;
      const mode = tapMode();
      const d = def(shapeName());
      if (mode === 'sides' || mode === 'vertices') {
        const total = mode === 'sides' ? d.sides.length : d.verts.length;
        const arr = mode === 'sides' ? lit : litV;
        let delay = 0;
        for (let i = 0; i < total; i++) {
          if (arr.includes(i)) continue;
          timers.push(setTimeout(() => { if (!arr.includes(i)) { arr.push(i); sfx('pop'); draw(); } }, (delay += reducedMotion() ? 0 : 280)));
        }
      } else if (p.fold && !folded) toggleFold();
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(safety);
      clearTimers();
      unbinds.splice(0).forEach(u => u());
      el.replaceChildren();
    },
  };
  if (p.showAll) lightAll(p.showAll);
  draw();
  return api;
}
