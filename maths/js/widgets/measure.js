// measure: measuring tools for the Measure Lab.
// tool: 'ruler' | 'scales' | 'jug' | 'thermometer' | 'compare'
// Common props: value, unit, min, max, step (snap), marks (mark interval; default = step), labels (label every n),
//               interactive (default true), readonly, object.
// ruler:       unit 'cm' (default, max 20 or 30) or 'm' (metre stick, max 5); object 'pencil' | 'rocket' | 'crayon' | 'key'
//              | 'worm' | 'spoon' | 'rover' | 'bar'; value = length; start (default 0) = where the object begins.
//              Drag the gold handle (or anywhere along the ruler) to set the length.
// scales:      kitchen dial, unit 'g' (max 1000, labels 100, marks 50) or 'kg' (max 5, labels 1, marks 1);
//              object = an art name on the pan (default 'asteroid'). Drag the dial or tap - / +.
// jug:         unit 'ml' (max 1000, labels 100, marks 50) or 'l' (max 5); liquid (colour, default water). Drag the level.
// thermometer: degrees C, min -10, max 40, labels 10, marks 2 (use min 0 for Year 2); object = an art name beside it
//              (sun, moon, planet...). Drag the red level.
// compare:     Year 1 comparing: kind 'length' | 'height' | 'mass' | 'capacity'; a, b (any non-standard amounts; b may be
//              left out for one thing); icons ([a, b]: object names for length, art or object names for height and mass);
//              cubes: true shows cubes (non-standard units); max (capacity of the containers, default 10).
//              mass with cubes and interactive: tap - / + to change the cubes on the right pan (b).
// State: { tool, value } (compare also gives a and b; value is b, or a when there is only one thing).
// Debug: dev/harness.html?widget=measure&props={"tool":"scales","value":350,"max":1000,"labels":100,"marks":50}
import { S, svgRoot, onTap, drag, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { artInner, artNames } from '../core/art.js';
import { COL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Measuring tools',
  playground: { tool: 'ruler', value: 7, object: 'pencil', interactive: true },
  state: ['tool', 'value'],
};

const W = 800, H = 500;
const FACE = '#f3efe6', NAVY = '#0c1430', WOOD = '#ead9a8', WOOD2 = '#dcc68d', WOODLINE = '#9c8546', NEEDLE = '#e0661f';
const TOOLS = ['ruler', 'scales', 'jug', 'thermometer', 'compare'];
const OBJECTS = ['pencil', 'rocket', 'crayon', 'key', 'worm', 'spoon', 'rover', 'bar'];
const LIQUID = { water: '#4f9dff', juice: '#ff9a52', fuel: '#6fe3a5', milk: '#e8edf5' };
const num = (v, d) => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) ? n : d; };
const fmtNum = v => (v < 0 ? '−' + Math.abs(v) : String(Math.round(v * 1000) / 1000));
const round3 = v => Math.round(v * 1000) / 1000;

function config(p) {
  const tool = TOOLS.includes(p.tool) ? p.tool : 'ruler';
  let unit, min = 0, max, marks, labels;
  if (tool === 'ruler') {
    unit = p.unit === 'm' ? 'm' : 'cm';
    const need = num(p.start, 0) + num(p.value, 0);
    max = num(p.max, unit === 'm' ? clamp(Math.ceil(need), 5, 10) : need > 20 ? 30 : 20);
    marks = num(p.marks, 1);
    labels = num(p.labels, 0);
    if (!labels) { const u = 700 / max; labels = [1, 2, 5, 10, 20, 50].find(k => u * k >= 42) || 100; }
  } else if (tool === 'scales') {
    unit = p.unit === 'kg' ? 'kg' : 'g';
    min = num(p.min, 0);
    max = num(p.max, unit === 'kg' ? 5 : 1000);
    labels = num(p.labels, unit === 'kg' ? (max <= 10 ? 1 : max <= 20 ? 5 : 10) : (max <= 1000 ? 100 : 500));
    marks = num(p.marks, num(p.step, unit === 'kg' ? 1 : labels / 2));
  } else if (tool === 'jug') {
    unit = p.unit === 'l' ? 'l' : 'ml';
    max = num(p.max, unit === 'l' ? 5 : 1000);
    labels = num(p.labels, unit === 'l' ? 1 : 100);
    marks = num(p.marks, num(p.step, unit === 'l' ? 1 : 50));
  } else if (tool === 'thermometer') {
    unit = '°C';
    min = num(p.min, -10); max = num(p.max, 40);
    labels = num(p.labels, 10);
    marks = num(p.marks, num(p.step, 2));
  } else {
    unit = ''; max = num(p.max, 10); labels = 1; marks = 1;
  }
  if (!(max > min)) max = min + 1;
  marks = Math.max(Math.abs(marks) || 1, (max - min) / 200);
  labels = Math.max(Math.abs(labels) || marks, marks);
  const step = Math.max(Math.abs(num(p.step, marks)) || marks, (max - min) / 1000);
  return { tool, unit, min, max, marks, labels, step };
}
const isLabel = (v, c) => Math.abs(v / c.labels - Math.round(v / c.labels)) < 1e-6;
function eachMark(c, fn) {
  const n = Math.round((c.max - c.min) / c.marks);
  for (let i = 0; i <= n; i++) fn(round3(c.min + i * c.marks), i);
}

/* ---------------- Objects drawn along a length (0..L on the x axis, centred on y = 0) ---------------- */
export function drawObject(name, L, h = 70) {
  const g = S('g', {});
  L = Math.max(L, 6);
  const k = Math.min(1, L / 110);
  switch (name) {
    case 'pencil': {
      const bh = h * 0.6, er = 18 * k, fe = 12 * k, tip = Math.min(42, L * 0.3);
      g.appendChild(S('rect', { x: 0, y: -bh / 2, width: er + 6, height: bh, rx: 6 * k, fill: '#ff8fb1' }));
      g.appendChild(S('rect', { x: er, y: -bh / 2, width: fe, height: bh, fill: '#c9ced6' }));
      const bw = Math.max(0, L - tip - er - fe);
      g.appendChild(S('rect', { x: er + fe, y: -bh / 2, width: bw, height: bh, fill: '#f2b544' }));
      g.appendChild(S('rect', { x: er + fe, y: -bh / 6, width: bw, height: bh / 3, fill: '#ffd27a', opacity: 0.7 }));
      g.appendChild(S('path', { d: `M${L - tip} ${-bh / 2}L${L} 0L${L - tip} ${bh / 2}Z`, fill: '#f1d2a0' }));
      g.appendChild(S('path', { d: `M${L - tip * 0.32} ${-bh * 0.16}L${L} 0L${L - tip * 0.32} ${bh * 0.16}Z`, fill: '#2b2f3a' }));
      break;
    }
    case 'crayon': {
      const bh = h * 0.58, tip = Math.min(30, L * 0.25), col = '#4f9dff', dark = '#2c6fd6';
      g.appendChild(S('rect', { x: 0, y: -bh / 2, width: L - tip + 2, height: bh, rx: 8 * k, fill: col }));
      g.appendChild(S('rect', { x: (L - tip) * 0.14, y: -bh / 2, width: (L - tip) * 0.7, height: bh, fill: '#cfe3ff' }));
      g.appendChild(S('rect', { x: (L - tip) * 0.14, y: -bh * 0.12, width: (L - tip) * 0.7, height: bh * 0.24, fill: col, opacity: 0.5 }));
      g.appendChild(S('path', { d: `M${L - tip} ${-bh * 0.44}L${L - 5} ${-bh * 0.14}Q${L} 0 ${L - 5} ${bh * 0.14}L${L - tip} ${bh * 0.44}Z`, fill: dark }));
      break;
    }
    case 'rocket': {
      const bh = h * 0.54, nose = Math.min(52, L * 0.32), fin = Math.min(40, L * 0.28);
      g.appendChild(S('path', { d: `M0 ${-h / 2}L${fin * 1.5} ${-bh / 2}L0 ${-bh / 2}Z`, fill: '#ff9a52' }));
      g.appendChild(S('path', { d: `M0 ${h / 2}L${fin * 1.5} ${bh / 2}L0 ${bh / 2}Z`, fill: '#ff9a52' }));
      g.appendChild(S('rect', { x: 0, y: -bh / 2, width: L - nose + 1, height: bh, fill: FACE }));
      g.appendChild(S('rect', { x: 0, y: bh * 0.18, width: L - nose + 1, height: bh * 0.32, fill: '#000', opacity: 0.1 }));
      g.appendChild(S('path', { d: `M${L - nose} ${-bh / 2}Q${L - nose * 0.25} ${-bh / 2} ${L} 0Q${L - nose * 0.25} ${bh / 2} ${L - nose} ${bh / 2}Z`, fill: '#f2b544' }));
      g.appendChild(S('circle', { cx: L - nose - bh * 0.42, cy: 0, r: bh * 0.24, fill: '#5fd4ff', stroke: NAVY, 'stroke-width': 3 }));
      break;
    }
    case 'key': {
      const rr = h * 0.28, sw = 10;
      g.appendChild(S('circle', { cx: rr + sw / 2, cy: 0, r: rr, fill: 'none', stroke: '#f2b544', 'stroke-width': sw }));
      g.appendChild(S('rect', { x: rr * 2 + sw * 0.6, y: -7, width: Math.max(0, L - rr * 2 - sw * 0.6), height: 14, rx: 3, fill: '#f2b544' }));
      g.appendChild(S('rect', { x: L - 40 * k, y: 6, width: 10 * k, height: 16, fill: '#f2b544' }));
      g.appendChild(S('rect', { x: L - 22 * k, y: 6, width: 10 * k, height: 11, fill: '#f2b544' }));
      break;
    }
    case 'worm': {
      const t = h * 0.42, x0 = t / 2, x1 = L - t / 2, n = Math.max(1, Math.round((x1 - x0) / 60));
      let d = `M${x0} 0`;
      for (let i = 0; i < n; i++) {
        const a = x0 + ((x1 - x0) * i) / n, b = x0 + ((x1 - x0) * (i + 1)) / n;
        d += `Q${(a + b) / 2} ${i % 2 ? 9 : -9} ${b} 0`;
      }
      g.appendChild(S('path', { d, stroke: '#ff8fb1', 'stroke-width': t, 'stroke-linecap': 'round', fill: 'none' }));
      for (let i = 1; i < n * 2; i++) {
        const x = x0 + ((x1 - x0) * i) / (n * 2);
        g.appendChild(S('line', { x1: x, y1: -t * 0.38, x2: x, y2: t * 0.38, stroke: '#d9628a', 'stroke-width': 2, opacity: 0.6 }));
      }
      g.appendChild(S('circle', { cx: Math.max(x0, L - t * 0.75), cy: -t * 0.12, r: 4, fill: NAVY }));
      break;
    }
    case 'spoon': {
      const rx = Math.min(L * 0.28, h * 0.55), ry = h * 0.34;
      g.appendChild(S('rect', { x: 0, y: -h * 0.08, width: Math.max(0, L - rx * 2 + 8), height: h * 0.16, rx: h * 0.08, fill: '#c9ced6' }));
      g.appendChild(S('ellipse', { cx: L - rx, cy: 0, rx, ry, fill: '#dfe4ea', stroke: '#8e98a8', 'stroke-width': 3 }));
      break;
    }
    case 'rover': {
      const wr = Math.min(h * 0.2, L * 0.12);
      g.appendChild(S('rect', { x: 0, y: -h * 0.36, width: L, height: h * 0.42, rx: 8, fill: FACE }));
      g.appendChild(S('line', { x1: L * 0.72, y1: -h * 0.36, x2: L * 0.72, y2: -h * 0.62, stroke: FACE, 'stroke-width': 4 }));
      g.appendChild(S('circle', { cx: L * 0.72, cy: -h * 0.64, r: 7, fill: '#f2b544' }));
      [wr, L / 2, L - wr].forEach(x => {
        g.appendChild(S('circle', { cx: x, cy: h * 0.22, r: wr, fill: NAVY, stroke: '#9aa3b2', 'stroke-width': 3 }));
      });
      break;
    }
    default:
      g.appendChild(S('rect', { x: 0, y: -h * 0.26, width: L, height: h * 0.52, rx: 8, fill: '#f2b544' }));
  }
  return g;
}

function artG(name, x, y, size) {
  const g = S('g', { transform: `translate(${x} ${y}) scale(${size / 100})` });
  g.innerHTML = artInner(name);
  return g;
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-measure', `
    .w-measure { width: 100%; height: 100%; }
    .w-measure .grab { cursor: grab; }
    .w-measure .btn { cursor: pointer; }
    .w-measure.ro .grab, .w-measure.ro .btn { cursor: default; }
  `);
  let p = {};
  let c = config({});
  let value = 0;
  let unbindDrag = null;
  const unbinds = [];
  let anim = 0, fallback = 0;
  const root = svgRoot(W, H, 'w-measure');
  el.appendChild(root);
  let bg, dyn, fg;
  const clipId = 'w-measure-clip-' + Math.random().toString(36).slice(2, 9);

  const ro = () => !!(p.readonly || ctx.readonly || p.interactive === false);
  const start = () => clamp(num(p.start, 0), c.min, c.max - c.step);
  function snapV(v) {
    let s = c.min + Math.round((v - c.min) / c.step) * c.step;
    if (c.tool === 'ruler') s = clamp(s, c.step, c.max - start());
    else s = clamp(s, c.min, c.max);
    return round3(s);
  }

  function setFromProps(np) {
    p = { ...p, ...np };
    c = config(p);
    if ('value' in np || 'b' in np || 'a' in np || !Number.isFinite(value)) {
      if (c.tool === 'compare') value = num(p.b, num(p.a, 0));
      else value = snapV(num(p.value, c.tool === 'ruler' ? 5 : c.min));
    } else if (c.tool !== 'compare') value = snapV(value);
  }

  function emit() { ctx.onChange && ctx.onChange(api.getState()); }

  /* ---------- ruler ---------- */
  const R0 = 50, R1 = 750, RY = 300, RH = 92;
  const rx = v => R0 + ((v - c.min) * (R1 - R0)) / (c.max - c.min);
  function rulerStatic() {
    const m = c.unit === 'm';
    if (m) {
      bg.appendChild(S('rect', { x: R0 - 26, y: RY, width: R1 - R0 + 52, height: RH, rx: 8, fill: WOOD }));
      for (let k = Math.floor(c.min); k < c.max; k++) bg.appendChild(S('rect', { x: rx(k), y: RY, width: rx(k + 1) - rx(k), height: RH, fill: k % 2 ? WOOD2 : WOOD }));
      bg.appendChild(S('rect', { x: R0 - 26, y: RY, width: R1 - R0 + 52, height: RH, rx: 8, fill: 'none', stroke: WOODLINE, 'stroke-width': 3 }));
    } else {
      bg.appendChild(S('rect', { x: R0 - 26, y: RY, width: R1 - R0 + 52, height: RH, rx: 8, fill: WOOD, stroke: WOODLINE, 'stroke-width': 3 }));
    }
    eachMark(c, v => {
      const major = isLabel(v, c), mid = !m && Math.abs(v % 5) < 1e-6;
      const len = major ? 36 : mid ? 28 : 20;
      bg.appendChild(S('line', { x1: rx(v), y1: RY, x2: rx(v), y2: RY + len, stroke: NAVY, 'stroke-width': major ? 3.5 : 2.5 }));
      if (major) bg.appendChild(S('text', { x: rx(v), y: RY + 70, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 28, fill: NAVY }, [fmtNum(v)]));
    });
    bg.appendChild(S('text', { x: R1 + 26, y: RY + RH + 34, 'text-anchor': 'end', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 28, fill: COL.ink2 }, [c.unit]));
  }
  function rulerDyn() {
    const s = start(), xs = rx(s), xe = rx(s + value), yc = 222, oh = 74;
    const name = OBJECTS.includes(p.object) ? p.object : c.unit === 'm' ? 'rover' : 'pencil';
    const og = drawObject(name, xe - xs, oh);
    og.setAttribute('transform', `translate(${xs} ${yc})`);
    dyn.appendChild(og);
    for (const x of [xs, xe]) dyn.appendChild(S('line', { x1: x, y1: yc + oh / 2 + 2, x2: x, y2: RY, stroke: COL.tens, 'stroke-width': 3, 'stroke-dasharray': '6 5' }));
    if (!ro()) {
      dyn.appendChild(S('line', { x1: xe, y1: yc - oh / 2 - 2, x2: xe, y2: 130, stroke: COL.tens, 'stroke-width': 4 }));
      dyn.appendChild(S('circle', { cx: xe, cy: 106, r: 32, fill: COL.tens, stroke: FACE, 'stroke-width': 4 }));
      dyn.appendChild(S('path', { d: `M${xe - 18} 106l9 -9v18zM${xe + 18} 106l-9 -9v18z`, fill: NAVY }));
    }
  }
  const rulerHit = q => q.y > 60 && q.y < RY + RH + 10 && q.x > R0 - 50 && q.x < R1 + 50;
  const rulerVal = q => c.min + ((q.x - R0) * (c.max - c.min)) / (R1 - R0) - start();

  /* ---------- scales ---------- */
  const SC = { x: 400, y: 314, r: 172 };
  const sAng = v => -150 + (300 * (v - c.min)) / (c.max - c.min);
  const pol = (r, deg) => ({ x: SC.x + r * Math.sin((deg * Math.PI) / 180), y: SC.y - r * Math.cos((deg * Math.PI) / 180) });
  function scalesStatic() {
    const obj = artNames.includes(p.object) ? p.object : 'asteroid';
    bg.appendChild(S('rect', { x: 388, y: 100, width: 24, height: 30, fill: '#8e98a8' }));
    bg.appendChild(S('ellipse', { cx: 400, cy: 102, rx: 170, ry: 16, fill: '#c9ced6', stroke: '#8e98a8', 'stroke-width': 3 }));
    bg.appendChild(artG(obj, 352, 2, 96));
    bg.appendChild(S('rect', { x: 196, y: 120, width: 408, height: 376, rx: 46, fill: '#2f4170', stroke: '#9fb3d9', 'stroke-width': 4 }));
    bg.appendChild(S('circle', { cx: SC.x, cy: SC.y, r: SC.r + 8, fill: '#1c2747' }));
    bg.appendChild(S('circle', { cx: SC.x, cy: SC.y, r: SC.r, fill: FACE }));
    eachMark(c, v => {
      const major = isLabel(v, c), a = sAng(v);
      const p1 = pol(SC.r * (major ? 0.8 : 0.86), a), p2 = pol(SC.r * 0.97, a);
      bg.appendChild(S('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: NAVY, 'stroke-width': major ? 4.5 : 2.5, 'stroke-linecap': 'round' }));
      if (major) {
        const t = fmtNum(v), fs = t.length >= 4 ? 25 : 30, q = pol(SC.r * (t.length >= 4 ? 0.6 : 0.64), a);
        bg.appendChild(S('text', { x: q.x, y: q.y + fs * 0.36, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': fs, fill: NAVY }, [t]));
      }
    });
    bg.appendChild(S('text', { x: SC.x, y: SC.y + SC.r * 0.72, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 36, fill: NEEDLE }, [c.unit]));
    if (!ro()) plusMinus(105, 314, 695, 314, () => setValue(snapV(value - c.step)), () => setValue(snapV(value + c.step)));
  }
  function scalesDyn() {
    const a = sAng(value), tip = pol(SC.r * 0.9, a), tail = pol(-SC.r * 0.16, a);
    dyn.appendChild(S('line', { x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y, stroke: NEEDLE, 'stroke-width': 7, 'stroke-linecap': 'round' }));
    dyn.appendChild(S('circle', { cx: SC.x, cy: SC.y, r: 14, fill: NAVY }));
    dyn.appendChild(S('circle', { cx: SC.x, cy: SC.y, r: 5, fill: FACE }));
  }
  const scalesHit = q => Math.hypot(q.x - SC.x, q.y - SC.y) < SC.r + 30;
  function scalesVal(q) {
    let a = (Math.atan2(q.x - SC.x, -(q.y - SC.y)) * 180) / Math.PI;
    a = clamp(a, -150, 150);
    return c.min + ((a + 150) / 300) * (c.max - c.min);
  }

  /* ---------- jug ---------- */
  const J = { l: 262, r: 498, top: 44, bot: 476, y0: 462, y1: 96 };
  const jy = v => J.y0 - ((v - c.min) * (J.y0 - J.y1)) / (c.max - c.min);
  function jugStatic() {
    bg.appendChild(S('path', { d: `M${J.l} 120C${J.l - 80} 120 ${J.l - 80} 330 ${J.l} 330`, fill: 'none', stroke: '#cfe3ff', 'stroke-width': 18, opacity: 0.55 }));
    bg.appendChild(S('rect', { x: J.l, y: J.top, width: J.r - J.l, height: J.bot - J.top, rx: 24, fill: 'rgba(200,230,255,.07)' }));
    const clip = S('clipPath', { id: clipId }, [S('rect', { x: J.l + 4, y: J.top, width: J.r - J.l - 8, height: J.bot - J.top - 4, rx: 20 })]);
    bg.appendChild(S('defs', {}, [clip]));
    fg.appendChild(S('path', { d: `M${J.l} ${J.top}V${J.bot - 24}q0 24 24 24H${J.r - 24}q24 0 24 -24V${J.top + 18}l22 -18`, fill: 'none', stroke: '#cfe3ff', 'stroke-width': 5, 'stroke-linejoin': 'round' }));
    eachMark(c, v => {
      if (v <= c.min) return;
      const major = isLabel(v, c), y = jy(v);
      fg.appendChild(S('line', { x1: J.r - (major ? 70 : 40), y1: y, x2: J.r - 3, y2: y, stroke: FACE, 'stroke-width': major ? 4 : 2.5 }));
      if (major) fg.appendChild(S('text', { x: J.r + 30, y: y + 11, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: FACE }, [fmtNum(v)]));
    });
    fg.appendChild(S('text', { x: J.r + 30, y: Math.max(30, jy(c.max) - 34), 'font-family': FONT.display, 'font-weight': 600, 'font-size': 28, fill: COL.ink2 }, [c.unit]));
  }
  function jugDyn() {
    const y = jy(value), col = LIQUID[p.liquid] || (typeof p.liquid === 'string' && /^#/.test(p.liquid) ? p.liquid : LIQUID.water);
    const g = S('g', { 'clip-path': `url(#${clipId})` });
    if (value > c.min) {
      g.appendChild(S('rect', { x: J.l, y, width: J.r - J.l, height: J.bot - y, fill: col, opacity: 0.62 }));
      g.appendChild(S('rect', { x: J.l, y: y - 2, width: J.r - J.l, height: 6, fill: '#fff', opacity: 0.35 }));
    }
    dyn.appendChild(g);
    if (!ro()) {
      dyn.appendChild(S('circle', { cx: J.l + 52, cy: y, r: 28, fill: COL.tens, stroke: FACE, 'stroke-width': 4 }));
      dyn.appendChild(S('path', { d: `M${J.l + 52} ${y - 18}l-9 9h18zM${J.l + 52} ${y + 18}l-9 -9h18z`, fill: NAVY }));
    }
  }
  const jugHit = q => q.x > J.l - 90 && q.x < J.r + 120 && q.y > 20 && q.y < H;
  const jugVal = q => c.min + ((J.y0 - q.y) * (c.max - c.min)) / (J.y0 - J.y1);

  /* ---------- thermometer ---------- */
  const T = { x: 390, y0: 408, y1: 62, top: 36, bulb: 446 };
  const ty = v => T.y0 - ((v - c.min) * (T.y0 - T.y1)) / (c.max - c.min);
  function thermoStatic() {
    if (p.object && artNames.includes(p.object)) bg.appendChild(artG(p.object, 70, 150, 160));
    bg.appendChild(S('rect', { x: T.x - 24, y: T.top, width: 48, height: T.bulb - T.top, rx: 24, fill: 'rgba(200,230,255,.1)', stroke: '#cfe3ff', 'stroke-width': 4 }));
    bg.appendChild(S('circle', { cx: T.x, cy: T.bulb, r: 38, fill: '#2a1a24', stroke: '#cfe3ff', 'stroke-width': 4 }));
    eachMark(c, v => {
      const major = isLabel(v, c), y = ty(v);
      fg.appendChild(S('line', { x1: T.x + 30, y1: y, x2: T.x + (major ? 66 : 50), y2: y, stroke: FACE, 'stroke-width': major ? 4 : 2.5 }));
      if (major) fg.appendChild(S('text', { x: T.x + 78, y: y + 11, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: FACE }, [fmtNum(v)]));
    });
    fg.appendChild(S('text', { x: T.x + 150, y: ty(c.max) + 11, 'font-family': FONT.display, 'font-weight': 600, 'font-size': 28, fill: COL.ink2 }, ['°C']));
  }
  function thermoDyn() {
    const y = ty(value);
    dyn.appendChild(S('rect', { x: T.x - 11, y, width: 22, height: T.bulb - y, fill: '#ff5a4a' }));
    dyn.appendChild(S('circle', { cx: T.x, cy: T.bulb, r: 29, fill: '#ff5a4a' }));
    if (!ro()) {
      dyn.appendChild(S('circle', { cx: T.x - 62, cy: y, r: 28, fill: COL.tens, stroke: FACE, 'stroke-width': 4 }));
      dyn.appendChild(S('path', { d: `M${T.x - 62} ${y - 18}l-9 9h18zM${T.x - 62} ${y + 18}l-9 -9h18z`, fill: NAVY }));
      dyn.appendChild(S('line', { x1: T.x - 34, y1: y, x2: T.x - 13, y2: y, stroke: COL.tens, 'stroke-width': 4 }));
    }
  }
  const thermoHit = q => q.x > T.x - 130 && q.x < T.x + 160 && q.y > 10 && q.y < H;
  const thermoVal = q => c.min + ((T.y0 - q.y) * (c.max - c.min)) / (T.y0 - T.y1);

  /* ---------- compare (Year 1) ---------- */
  function cube(x, y, s, col) {
    return S('rect', { x: x + 1.5, y: y + 1.5, width: s - 3, height: s - 3, rx: Math.min(6, s * 0.15), fill: col, stroke: 'rgba(0,0,0,.35)', 'stroke-width': 2 });
  }
  function compareDraw() {
    const kind = ['length', 'height', 'mass', 'capacity'].includes(p.kind) ? p.kind : 'length';
    const a = clamp(num(p.a, 5), 0, 60);
    const hasB = p.b !== undefined && p.b !== null;
    const b = hasB ? clamp(value, 0, 60) : null;
    const icons = Array.isArray(p.icons) ? p.icons : [];
    const cols = [COL.a, COL.b];
    if (kind === 'length') {
      const things = hasB ? [a, b] : [a];
      const u = Math.min(640 / Math.max(...things, 1), p.cubes ? 64 : 160);
      const ys = hasB ? (p.cubes ? [120, 320] : [160, 340]) : [p.cubes ? 210 : 250];
      bg.appendChild(S('line', { x1: 90, y1: 40, x2: 90, y2: 470, stroke: COL.ink3, 'stroke-width': 3, 'stroke-dasharray': '8 8' }));
      things.forEach((len, i) => {
        const name = OBJECTS.includes(icons[i]) ? icons[i] : ['pencil', 'crayon'][i];
        const og = drawObject(name, len * u, 76);
        og.setAttribute('transform', `translate(90 ${ys[i]})`);
        bg.appendChild(og);
        if (p.cubes) for (let k = 0; k < Math.round(len); k++) bg.appendChild(cube(90 + k * u, ys[i] + 48, u, cols[i]));
      });
    } else if (kind === 'height') {
      const things = hasB ? [a, b] : [a];
      const u = Math.min(380 / Math.max(...things, 1), p.cubes ? 60 : 200);
      const xs = hasB ? [250, 560] : [400];
      const ground = 462;
      bg.appendChild(S('line', { x1: 40, y1: ground, x2: 760, y2: ground, stroke: COL.ink3, 'stroke-width': 4 }));
      things.forEach((ht, i) => {
        const hgt = ht * u, nm = icons[i] || 'rocket';
        if (OBJECTS.includes(nm)) {
          const og = drawObject(nm, hgt, Math.min(90, Math.max(50, hgt * 0.3)));
          og.setAttribute('transform', `translate(${xs[i]} ${ground}) rotate(-90)`);
          bg.appendChild(og);
        } else {
          bg.appendChild(artG(artNames.includes(nm) ? nm : 'rocket', xs[i] - hgt / 2, ground - hgt, hgt));
        }
        if (p.cubes) for (let k = 0; k < Math.round(ht); k++) bg.appendChild(cube(xs[i] + 80, ground - (k + 1) * u, u, cols[i]));
      });
    } else if (kind === 'mass') {
      const bb = hasB ? b : 0;
      const diff = bb - a;
      const tilt = Math.abs(diff) < 1e-9 ? 0 : Math.sign(diff) * Math.min(15, 6 + (10 * Math.abs(diff)) / Math.max(a, bb, 1));
      const px = 400, py = 168, arm = 250;
      bg.appendChild(S('path', { d: `M330 478L470 478L430 450L370 450Z`, fill: '#5b6b8f' }));
      bg.appendChild(S('rect', { x: px - 9, y: py, width: 18, height: 285, fill: '#8e98a8' }));
      const rad = (tilt * Math.PI) / 180;
      const ends = [-1, 1].map(sx => ({ x: px + sx * arm * Math.cos(rad), y: py + sx * arm * Math.sin(rad) }));
      bg.appendChild(S('line', { x1: ends[0].x, y1: ends[0].y, x2: ends[1].x, y2: ends[1].y, stroke: '#c9ced6', 'stroke-width': 14, 'stroke-linecap': 'round' }));
      bg.appendChild(S('circle', { cx: px, cy: py, r: 14, fill: '#f2b544' }));
      ends.forEach((e, i) => {
        const panY = e.y + 150;
        bg.appendChild(S('line', { x1: e.x, y1: e.y, x2: e.x - 80, y2: panY, stroke: '#9aa3b2', 'stroke-width': 3 }));
        bg.appendChild(S('line', { x1: e.x, y1: e.y, x2: e.x + 80, y2: panY, stroke: '#9aa3b2', 'stroke-width': 3 }));
        bg.appendChild(S('path', { d: `M${e.x - 95} ${panY}Q${e.x} ${panY + 40} ${e.x + 95} ${panY}Z`, fill: '#c9ced6', stroke: '#8e98a8', 'stroke-width': 3 }));
        const isCubes = i === 1 && (p.cubes || !icons[1]);
        if (i === 0 || (hasB && !isCubes)) {
          const nm = artNames.includes(icons[i]) ? icons[i] : i === 0 ? 'asteroid' : 'apple';
          bg.appendChild(artG(nm, e.x - 55, panY - 104, 110));
        } else if (hasB) {
          const n = Math.round(bb), s = 34;
          for (let k = 0; k < n; k++) {
            const row = Math.floor(k / 5), col = k % 5, inRow = Math.min(5, n - row * 5);
            bg.appendChild(cube(e.x - (inRow * s) / 2 + col * s, panY - 4 - (row + 1) * s, s, COL.b));
          }
        }
      });
      if (!ro() && p.cubes && hasB) plusMinus(560, 452, 700, 452, () => setValue(Math.max(0, value - 1)), () => setValue(Math.min(30, value + 1)), 38);
    } else {
      const max = Math.max(num(p.max, 10), a, hasB ? b : 0, 1);
      const things = hasB ? [a, b] : [a];
      const xs = hasB ? [250, 550] : [400];
      const top = 110, bot = 410, w = 190;
      things.forEach((lv, i) => {
        const x = xs[i] - w / 2, y = bot - ((bot - top) * lv) / max;
        bg.appendChild(S('rect', { x, y: top, width: w, height: bot - top, rx: 18, fill: 'rgba(200,230,255,.07)' }));
        if (lv > 0) bg.appendChild(S('path', { d: `M${x + 3} ${y}H${x + w - 3}V${bot - 18}q0 15 -15 15H${x + 18}q-15 0 -15 -15Z`, fill: LIQUID.water, opacity: 0.62 }));
        bg.appendChild(S('path', { d: `M${x} ${top - 14}V${bot - 18}q0 18 18 18H${x + w - 18}q18 0 18 -18V${top - 14}`, fill: 'none', stroke: '#cfe3ff', 'stroke-width': 5 }));
        if (hasB) {
          bg.appendChild(S('circle', { cx: xs[i], cy: 456, r: 26, fill: cols[i] }));
          bg.appendChild(S('text', { x: xs[i], y: 466, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 28, fill: NAVY }, [i ? 'B' : 'A']));
        }
      });
    }
  }

  function plusMinus(x1, y1, x2, y2, minus, plus, r = 46) {
    [[x1, y1, '-', minus], [x2, y2, '+', plus]].forEach(([x, y, sym, fn]) => {
      const g = S('g', { class: 'btn', 'data-btn': sym });
      g.appendChild(S('circle', { cx: x, cy: y, r, fill: 'rgba(255,255,255,.08)', stroke: COL.ink2, 'stroke-width': 3 }));
      g.appendChild(S('rect', { x: x - r * 0.42, y: y - 4, width: r * 0.84, height: 8, rx: 4, fill: COL.ink }));
      if (sym === '+') g.appendChild(S('rect', { x: x - 4, y: y - r * 0.42, width: 8, height: r * 0.84, rx: 4, fill: COL.ink }));
      g.addEventListener('pointerdown', e => e.stopPropagation());
      unbinds.push(onTap(g, () => { fn(); }));
      fg.appendChild(g);
    });
  }

  function setValue(v) {
    if (v === value) return;
    value = v;
    sfx('click');
    if (c.tool === 'compare') draw(); else drawDyn();
    emit();
  }

  const TOOL = {
    ruler: { st: rulerStatic, dy: rulerDyn, hit: rulerHit, val: rulerVal },
    scales: { st: scalesStatic, dy: scalesDyn, hit: scalesHit, val: scalesVal },
    jug: { st: jugStatic, dy: jugDyn, hit: jugHit, val: jugVal },
    thermometer: { st: thermoStatic, dy: thermoDyn, hit: thermoHit, val: thermoVal },
    compare: { st: compareDraw, dy: () => {}, hit: () => false, val: () => value },
  };

  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    root.classList.toggle('ro', ro());
    bg = S('g', { class: ro() ? '' : 'grab' }); dyn = S('g', { class: ro() ? '' : 'grab' }); fg = S('g', {});
    root.append(bg, dyn, fg);
    TOOL[c.tool].st();
    drawDyn();
  }
  function drawDyn(v) {
    dyn.replaceChildren();
    if (v === undefined) TOOL[c.tool].dy();
    else { const keep = value; value = v; TOOL[c.tool].dy(); value = keep; }
  }

  function bindDrag() {
    let active = false, startV = 0;
    unbindDrag = drag(root, {
      start(q) {
        if (ro() || !TOOL[c.tool].hit(q)) { active = false; return; }
        cancelAnimationFrame(anim); clearTimeout(fallback);
        active = true; startV = value;
        const v = snapV(TOOL[c.tool].val(q));
        if (v !== value) { value = v; sfx('tick'); drawDyn(); }
      },
      move(q) {
        if (!active) return;
        const v = snapV(TOOL[c.tool].val(q));
        if (v !== value) { value = v; sfx('tick'); drawDyn(); }
      },
      end() {
        if (!active) return;
        active = false;
        if (value !== startV) { sfx('click'); emit(); }
      },
    }, root);
  }

  const api = {
    getState() {
      if (c.tool === 'compare') {
        const a = num(p.a, 5), hasB = p.b !== undefined && p.b !== null;
        return { tool: 'compare', value: hasB ? value : a, a, b: hasB ? value : null };
      }
      return { tool: c.tool, value };
    },
    update(np) { cancelAnimationFrame(anim); clearTimeout(fallback); setFromProps(np || {}); draw(); },
    showAnswer(answer) {
      const t = typeof answer === 'number' ? answer : answer && typeof answer === 'object' ? num(answer.value, num(answer.b, null)) : num(answer, null);
      if (t === null) return;
      if (c.tool === 'compare') { value = t; draw(); return; }
      const target = snapV(t), from = value;
      value = target;
      cancelAnimationFrame(anim); clearTimeout(fallback);
      if (reducedMotion()) { drawDyn(); return; }
      const t0 = performance.now(), ms = 700;
      const stepF = now => {
        const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
        drawDyn(from + (target - from) * e);
        if (k < 1) anim = requestAnimationFrame(stepF);
      };
      anim = requestAnimationFrame(stepF);
      fallback = setTimeout(() => { cancelAnimationFrame(anim); drawDyn(); }, ms + 80);
    },
    destroy() { cancelAnimationFrame(anim); clearTimeout(fallback); unbinds.splice(0).forEach(u => u()); if (unbindDrag) unbindDrag(); el.replaceChildren(); },
  };
  value = NaN;
  setFromProps(props);
  draw();
  bindDrag();
  return api;
}
