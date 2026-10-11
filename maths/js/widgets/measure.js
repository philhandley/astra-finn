// measure: measuring tools for the Measure Lab.
// tool: 'ruler' | 'scales' | 'jug' | 'thermometer' | 'compare'
// Common props: value, unit, min, max, step (snap), marks (mark interval; default = step), labels (label every n),
//               interactive (default true), readonly, object.
// ruler:       unit 'cm' (default, max 20 or 30) or 'm' (metre stick, max 5); object 'pencil' | 'rocket' | 'crayon' | 'key'
//              | 'worm' | 'spoon' | 'rover' | 'bar'; value = length; start (default 0) = where the object begins.
//              Drag the orange handle (or anywhere along the ruler) to set the length.
// scales:      kitchen dial, unit 'g' (max 1000, labels 100, marks 50) or 'kg' (max 5, labels 1, marks 1);
//              object = an art name on the pan (default 'asteroid'). Drag the dial or tap - / +.
// jug:         unit 'ml' (max 1000, labels 100, marks 50) or 'l' (max 5); liquid (colour, default water). Drag the level
//              (or the orange handle).
// thermometer: degrees C, min -10, max 40, labels 10, marks 2 (use min 0 for Year 2); object = an art name beside it
//              (sun, moon, planet...). Drag the red level (or the orange handle).
// compare:     Year 1 comparing: kind 'length' | 'height' | 'mass' | 'capacity'; a, b (any non-standard amounts; b may be
//              left out for one thing); icons ([a, b]: object names for length, art or object names for height and mass);
//              cubes: true shows cubes (non-standard units); max (capacity of the containers, default 10).
//              mass with cubes and interactive: tap - / + to change the cubes on the right pan (b).
//              mass also takes tags (["8 kg", "3 kg"]: a label under each pan) and sign (">", "<" or "=": shown
//              big above the balance, for a reveal).
// readout:     true (ruler, scales, jug, thermometer) shows the reading for a reveal: a green label with the value
//              and unit; the ruler gets a green bracket from start to end, the dial a green ring at the needle,
//              the jug and thermometer a green line at the level. showAnswer() turns it on.
// Hint props (ruler, scales, jug, thermometer):
//              target: a value on the scale to point at (a blue arrow and a blue ring round its number), e.g. the
//              labelled number to start counting from; hops: a value to count on from, drawn as purple hops (dots on
//              the dial) from there up to the reading, one per small mark (ruler: one per centimetre).
// compare capacity also takes shapes (['tall'] or ['wide'] per container: a tall thin or short wide glass),
//              liquid ('water', 'juice', ...), halfLine (a dashed "half" line) and guides (dashed lines at each level).
// Style v2 (white surface): yellow school ruler, white dials with ink rims, red needle, clear jug with blue water,
//              white thermometer with red liquid, orange drag handles, white press buttons.
// showAnswer(value or goal) moves to the answer, shows the readout, then fires onChange (for hands-on steps).
// State: { tool, value } (compare also gives a and b; value is b, or a when there is only one thing).
// Debug: dev/harness.html?widget=measure&props={"tool":"scales","value":350,"max":1000,"labels":100,"marks":50}
import { S, svgRoot, onTap, drag, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { artInner, artNames } from '../core/art.js';
import { COL, PAL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Measuring tools',
  playground: { tool: 'ruler', value: 7, object: 'pencil', interactive: true },
  state: ['tool', 'value'],
};

const W = 800, H = 500;
const INK = COL.ink;
const RULER = '#fde68a', RULER2 = '#fff6cc';          // classic yellow school ruler (metre stick alternates)
const HANDLE = PAL.orange;                             // every drag handle is orange ("the orange handle")
const NEEDLE = PAL.red;
const TARGET = PAL.blue, TARGET_SOFT = '#dbe8ff';      // hint: "start here" / "find this number"
const HOP = PAL.purple;                                // hint: count-on hops
const METAL = '#d9dde4', METAL2 = '#b6bdc9';
const GLASS = '#f5f9ff';
const TOOLS = ['ruler', 'scales', 'jug', 'thermometer', 'compare'];
const OBJECTS = ['pencil', 'rocket', 'crayon', 'key', 'worm', 'spoon', 'rover', 'bar'];
// Top and bottom of the drawn part of some art icons (in their 100 by 100 box), so things of the same height
// look the same height and all stand on the ground line.
const ART_Y = { rocket: [6, 97], astronaut: [13, 96], alien: [3, 86], robot: [5, 94] };
// Liquids: a flat fill and a darker surface line.
const LIQUID = {
  water: ['#93c5fd', PAL.blue],
  juice: ['#fdba74', PAL.orange],
  fuel: ['#86efac', PAL.green],
  milk: ['#f8fafc', COL.lineStrong],
};
const num = (v, d) => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) ? n : d; };
const fmtNum = v => (v < 0 ? '−' + Math.abs(v) : String(Math.round(v * 1000) / 1000));
const round3 = v => Math.round(v * 1000) / 1000;
const label = (attrs, t) => S('text', { 'font-family': FONT.display, 'font-weight': 800, fill: INK, ...attrs }, [t]);

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

// Give a group of flat shapes one clean ink silhouette outline (a copy behind it, inked and fattened by w).
// Shapes marked data-hl (highlights, small details) are left out of the outline.
function outlined(g, w = 7) {
  const back = S('g', {});
  for (const n of [...g.querySelectorAll('*')]) {
    if (n.tagName === 'g' || n.hasAttribute('data-hl')) continue;
    const m = n.cloneNode(false);
    const st = m.getAttribute('stroke');
    const sw = st && st !== 'none' ? (parseFloat(m.getAttribute('stroke-width')) || 1) : 0;
    m.setAttribute('stroke', INK);
    m.setAttribute('stroke-width', sw + w);
    m.setAttribute('stroke-linejoin', 'round');
    if (m.getAttribute('fill') && m.getAttribute('fill') !== 'none') m.setAttribute('fill', INK);
    m.removeAttribute('opacity');
    const tr = n.parentNode !== g && n.parentNode.getAttribute('transform');
    if (tr) m.setAttribute('transform', tr + ' ' + (m.getAttribute('transform') || ''));
    back.appendChild(m);
  }
  g.insertBefore(back, g.firstChild);
  return g;
}

/* ---------------- Objects drawn along a length (0..L on the x axis, centred on y = 0) ---------------- */
export function drawObject(name, L, h = 70) {
  const g = S('g', {});
  L = Math.max(L, 6);
  const k = Math.min(1, L / 110);
  switch (name) {
    case 'pencil': {
      const bh = h * 0.6, er = 18 * k, fe = 12 * k, tip = Math.min(42, L * 0.3);
      g.appendChild(S('rect', { x: 0, y: -bh / 2, width: er + 6, height: bh, rx: 6 * k, fill: '#f9a8d4' }));
      g.appendChild(S('rect', { x: er, y: -bh / 2, width: fe, height: bh, fill: METAL2 }));
      const bw = Math.max(0, L - tip - er - fe);
      g.appendChild(S('rect', { x: er + fe, y: -bh / 2, width: bw, height: bh, fill: PAL.yellow }));
      g.appendChild(S('rect', { 'data-hl': 1, x: er + fe, y: -bh / 6, width: bw, height: bh / 3, fill: '#fde68a' }));
      g.appendChild(S('path', { d: `M${L - tip} ${-bh / 2}L${L} 0L${L - tip} ${bh / 2}Z`, fill: '#f5d7a8' }));
      g.appendChild(S('path', { 'data-hl': 1, d: `M${L - tip * 0.32} ${-bh * 0.16}L${L} 0L${L - tip * 0.32} ${bh * 0.16}Z`, fill: INK }));
      for (const x of [er, er + fe, L - tip]) g.appendChild(S('line', { 'data-hl': 1, x1: x, y1: -bh / 2, x2: x, y2: bh / 2, stroke: INK, 'stroke-width': 2.5 }));
      break;
    }
    case 'crayon': {
      const bh = h * 0.58, tip = Math.min(30, L * 0.25), col = PAL.blue, dark = PAL.blueDark;
      g.appendChild(S('rect', { x: 0, y: -bh / 2, width: L - tip + 2, height: bh, rx: 8 * k, fill: col }));
      g.appendChild(S('rect', { 'data-hl': 1, x: (L - tip) * 0.14, y: -bh / 2, width: (L - tip) * 0.7, height: bh, fill: '#bfdbfe' }));
      g.appendChild(S('rect', { 'data-hl': 1, x: (L - tip) * 0.14, y: -bh * 0.12, width: (L - tip) * 0.7, height: bh * 0.24, fill: col, opacity: 0.6 }));
      g.appendChild(S('path', { d: `M${L - tip} ${-bh * 0.44}L${L - 5} ${-bh * 0.14}Q${L} 0 ${L - 5} ${bh * 0.14}L${L - tip} ${bh * 0.44}Z`, fill: dark }));
      for (const x of [(L - tip) * 0.14, (L - tip) * 0.84]) g.appendChild(S('line', { 'data-hl': 1, x1: x, y1: -bh / 2, x2: x, y2: bh / 2, stroke: INK, 'stroke-width': 2.5 }));
      break;
    }
    case 'rocket': {
      const bh = h * 0.54, nose = Math.min(52, L * 0.32), fin = Math.min(40, L * 0.28);
      g.appendChild(S('path', { d: `M0 ${-h / 2}L${fin * 1.5} ${-bh / 2}L0 ${-bh / 2}Z`, fill: PAL.red }));
      g.appendChild(S('path', { d: `M0 ${h / 2}L${fin * 1.5} ${bh / 2}L0 ${bh / 2}Z`, fill: PAL.red }));
      g.appendChild(S('rect', { x: 0, y: -bh / 2, width: L - nose + 1, height: bh, fill: COL.surface }));
      g.appendChild(S('rect', { 'data-hl': 1, x: 0, y: bh * 0.18, width: L - nose + 1, height: bh * 0.32, fill: COL.surface3 }));
      g.appendChild(S('path', { d: `M${L - nose} ${-bh / 2}Q${L - nose * 0.25} ${-bh / 2} ${L} 0Q${L - nose * 0.25} ${bh / 2} ${L - nose} ${bh / 2}Z`, fill: PAL.red }));
      g.appendChild(S('line', { 'data-hl': 1, x1: L - nose, y1: -bh / 2, x2: L - nose, y2: bh / 2, stroke: INK, 'stroke-width': 2.5 }));
      g.appendChild(S('circle', { 'data-hl': 1, cx: L - nose - bh * 0.42, cy: 0, r: bh * 0.24, fill: PAL.blue, stroke: INK, 'stroke-width': 3 }));
      break;
    }
    case 'key': {
      const rr = h * 0.28, sw = 10;
      g.appendChild(S('circle', { cx: rr + sw / 2, cy: 0, r: rr, fill: 'none', stroke: PAL.yellow, 'stroke-width': sw }));
      g.appendChild(S('rect', { x: rr * 2 + sw * 0.6, y: -7, width: Math.max(0, L - rr * 2 - sw * 0.6), height: 14, rx: 3, fill: PAL.yellow }));
      g.appendChild(S('rect', { x: L - 40 * k, y: 4, width: 10 * k, height: 18, fill: PAL.yellow }));
      g.appendChild(S('rect', { x: L - 22 * k, y: 4, width: 10 * k, height: 13, fill: PAL.yellow }));
      break;
    }
    case 'worm': {
      const t = h * 0.42, x0 = t / 2, x1 = L - t / 2, n = Math.max(1, Math.round((x1 - x0) / 60));
      let d = `M${x0} 0`;
      for (let i = 0; i < n; i++) {
        const a = x0 + ((x1 - x0) * i) / n, b = x0 + ((x1 - x0) * (i + 1)) / n;
        d += `Q${(a + b) / 2} ${i % 2 ? 9 : -9} ${b} 0`;
      }
      g.appendChild(S('path', { d, stroke: '#f9a8d4', 'stroke-width': t, 'stroke-linecap': 'round', fill: 'none' }));
      for (let i = 1; i < n * 2; i++) {
        const x = x0 + ((x1 - x0) * i) / (n * 2);
        g.appendChild(S('line', { 'data-hl': 1, x1: x, y1: -t * 0.3, x2: x, y2: t * 0.3, stroke: PAL.pinkDark, 'stroke-width': 2.5, opacity: 0.5 }));
      }
      g.appendChild(S('circle', { 'data-hl': 1, cx: Math.max(x0, L - t * 0.75), cy: -t * 0.12, r: 4.5, fill: INK }));
      break;
    }
    case 'spoon': {
      const rx = Math.min(L * 0.28, h * 0.55), ry = h * 0.34;
      g.appendChild(S('rect', { x: 0, y: -h * 0.08, width: Math.max(0, L - rx * 2 + 8), height: h * 0.16, rx: h * 0.08, fill: METAL2 }));
      g.appendChild(S('ellipse', { cx: L - rx, cy: 0, rx, ry, fill: METAL }));
      g.appendChild(S('ellipse', { 'data-hl': 1, cx: L - rx * 1.05, cy: -ry * 0.2, rx: rx * 0.55, ry: ry * 0.4, fill: '#eef0f4' }));
      break;
    }
    case 'rover': {
      const wr = Math.min(h * 0.2, L * 0.12);
      g.appendChild(S('line', { x1: L * 0.72, y1: -h * 0.36, x2: L * 0.72, y2: -h * 0.62, stroke: COL.ink2, 'stroke-width': 4 }));
      g.appendChild(S('circle', { cx: L * 0.72, cy: -h * 0.64, r: 7, fill: PAL.yellow }));
      g.appendChild(S('rect', { x: 0, y: -h * 0.36, width: L, height: h * 0.42, rx: 8, fill: COL.surface }));
      g.appendChild(S('rect', { 'data-hl': 1, x: L * 0.12, y: -h * 0.28, width: L * 0.3, height: h * 0.16, rx: 4, fill: PAL.blue }));
      [wr, L / 2, L - wr].forEach(x => {
        g.appendChild(S('circle', { cx: x, cy: h * 0.22, r: wr, fill: COL.ink2 }));
        g.appendChild(S('circle', { 'data-hl': 1, cx: x, cy: h * 0.22, r: wr * 0.4, fill: METAL }));
      });
      break;
    }
    default:
      g.appendChild(S('rect', { x: 0, y: -h * 0.26, width: L, height: h * 0.52, rx: 8, fill: PAL.yellow }));
  }
  return outlined(g);
}

// A green "answer" label (reveal readouts, tags): a rounded pill with big ink text, centred on x unless anchored.
function pill(x, y, text, { anchor = 'middle', fs = 40, fill = COL.goodSoft, stroke = COL.good } = {}) {
  const t = String(text);
  const w = Math.round(fs * 0.85 + [...t].reduce((a, ch) => a + (ch === ' ' ? 0.3 : /[°.]/.test(ch) ? 0.4 : 0.64), 0) * fs);
  const h = Math.round(fs * 1.6);
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  const g = S('g', { 'pointer-events': 'none' });
  g.appendChild(S('rect', { x: x0, y: y - h / 2 + 5, width: w, height: h, rx: h * 0.3, fill: stroke }));
  g.appendChild(S('rect', { x: x0, y: y - h / 2, width: w, height: h, rx: h * 0.3, fill, stroke, 'stroke-width': 5 }));
  g.appendChild(label({ x: x0 + w / 2, y: y + fs * 0.36, 'text-anchor': 'middle', 'font-size': fs }, t));
  return g;
}

function artG(name, x, y, size) {
  const g = S('g', { transform: `translate(${x} ${y}) scale(${size / 100})` });
  g.innerHTML = artInner(name);
  return g;
}

// An orange drag handle with an ink outline, a hard shadow and two arrows ('h' left-right or 'v' up-down).
function handle(x, y, dir, r = 30) {
  const g = S('g', { class: 'hdl' });
  g.appendChild(S('circle', { cx: x, cy: y + 5, r, fill: INK }));
  g.appendChild(S('circle', { cx: x, cy: y, r, fill: HANDLE, stroke: INK, 'stroke-width': 4 }));
  const a = r * 0.58, t = r * 0.3;
  const d = dir === 'h'
    ? `M${x - a} ${y}l${t} ${-t}v${t * 2}zM${x + a} ${y}l${-t} ${-t}v${t * 2}z`
    : `M${x} ${y - a}l${-t} ${t}h${t * 2}zM${x} ${y + a}l${-t} ${-t}h${t * 2}z`;
  g.appendChild(S('path', { d, fill: INK, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  return g;
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-measure', `
    .w-measure { width: 100%; height: 100%; }
    .w-measure .grab { cursor: grab; }
    .w-measure .btn { cursor: pointer; }
    .w-measure .btn .face { transition: transform .08s ease; }
    .w-measure .btn.down .face { transform: translateY(4px); }
    .w-measure.ro .grab, .w-measure.ro .btn { cursor: default; }
  `);
  let p = {};
  let c = config({});
  let value = 0;
  let unbindDrag = null;
  const unbinds = [];
  let anim = 0, fallback = 0, answerShown = false;
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

  /* ---------- ruler: a classic yellow school ruler ---------- */
  const R0 = 50, R1 = 750, RY = 300, RH = 92;
  const rx = v => R0 + ((v - c.min) * (R1 - R0)) / (c.max - c.min);
  function rulerStatic() {
    const m = c.unit === 'm';
    const box = { x: R0 - 26, y: RY, width: R1 - R0 + 52, height: RH, rx: 10 };
    bg.appendChild(S('rect', { ...box, y: RY + 6, fill: COL.surface3 }));
    bg.appendChild(S('rect', { ...box, fill: RULER }));
    if (m) for (let k = Math.floor(c.min); k < c.max; k++) if (k % 2) bg.appendChild(S('rect', { x: rx(k), y: RY, width: rx(k + 1) - rx(k), height: RH, fill: RULER2 }));
    bg.appendChild(S('rect', { ...box, fill: 'none', stroke: INK, 'stroke-width': 4 }));
    const chars = Math.max(fmtNum(c.min).length, fmtNum(c.max).length);
    const fsR = clamp(Math.floor(((R1 - R0) * c.labels) / (c.max - c.min) / (chars * 0.62 + 0.35)), 20, 30);
    eachMark(c, v => {
      const major = isLabel(v, c), mid = !m && Math.abs(v % 5) < 1e-6;
      const len = major ? 34 : mid ? 26 : 18;
      bg.appendChild(S('line', { x1: rx(v), y1: RY + 2, x2: rx(v), y2: RY + len, stroke: INK, 'stroke-width': major ? 3.5 : 2.5 }));
      if (major) bg.appendChild(label({ x: rx(v), y: RY + 72, 'text-anchor': 'middle', 'font-size': fsR }, fmtNum(v)));
    });
    bg.appendChild(label({ x: R1 + 26, y: RY + RH + 36, 'text-anchor': 'end', 'font-weight': 700, 'font-size': 28, fill: COL.ink2 }, c.unit));
  }
  function rulerDyn() {
    const s = start(), xs = rx(s), xe = rx(s + value), yc = 222, oh = 74;
    const name = OBJECTS.includes(p.object) ? p.object : c.unit === 'm' ? 'rover' : 'pencil';
    const og = drawObject(name, xe - xs, oh);
    og.setAttribute('transform', `translate(${xs} ${yc})`);
    dyn.appendChild(og);
    const guide = { stroke: COL.ink3, 'stroke-width': 3, 'stroke-dasharray': '6 6' };
    dyn.appendChild(S('line', { x1: xs, y1: yc + oh / 2 + 6, x2: xs, y2: RY - 2, ...guide }));
    if (!ro()) {
      dyn.appendChild(S('line', { x1: xe, y1: 136, x2: xe, y2: RY - 2, stroke: HANDLE, 'stroke-width': 4 }));
      dyn.appendChild(handle(xe, 104, 'h', 32));
    } else dyn.appendChild(S('line', { x1: xe, y1: yc + oh / 2 + 6, x2: xe, y2: RY - 2, ...guide }));
    // Hint: hops of 1 cm from a mark to the end, and a blue arrow at a target mark.
    const hf = num(p.hops, null);
    if (hf !== null) {
      const e = round3(s + value);
      for (let k = hf; k < e - 1e-6; k += 1) {
        const x0 = rx(k), x1 = rx(Math.min(k + 1, e));
        dyn.appendChild(S('path', { d: `M${x0 + 2} ${RY - 4}Q${(x0 + x1) / 2} ${RY - 34} ${x1 - 2} ${RY - 4}`, fill: 'none', stroke: HOP, 'stroke-width': 4, 'stroke-linecap': 'round', 'pointer-events': 'none' }));
      }
    }
    const tg = num(p.target, null);
    if (tg !== null && tg >= c.min && tg <= c.max) {
      const x = rx(tg);
      dyn.appendChild(S('line', { x1: x, y1: RY - 26, x2: x, y2: RY + 36, stroke: TARGET, 'stroke-width': 5, 'pointer-events': 'none' }));
      dyn.appendChild(S('path', { d: `M${x - 15} ${RY - 44}H${x + 15}L${x} ${RY - 20}Z`, fill: TARGET, stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'pointer-events': 'none' }));
      if (isLabel(tg, c)) dyn.appendChild(S('circle', { cx: x, cy: RY + 62, r: 26, fill: 'none', stroke: TARGET, 'stroke-width': 5, 'pointer-events': 'none' }));
    }
  }
  const rulerHit = q => q.y > 60 && q.y < RY + RH + 10 && q.x > R0 - 50 && q.x < R1 + 50;
  const rulerVal = q => c.min + ((q.x - R0) * (c.max - c.min)) / (R1 - R0) - start();

  /* ---------- scales: a kitchen scale with a white dial ---------- */
  const SC = { x: 400, y: 310, r: 162 };
  const sAng = v => -150 + (300 * (v - c.min)) / (c.max - c.min);
  const pol = (r, deg) => ({ x: SC.x + r * Math.sin((deg * Math.PI) / 180), y: SC.y - r * Math.cos((deg * Math.PI) / 180) });
  function scalesStatic() {
    const obj = artNames.includes(p.object) ? p.object : 'asteroid';
    bg.appendChild(S('rect', { x: 384, y: 100, width: 32, height: 30, fill: METAL2, stroke: INK, 'stroke-width': 4 }));
    bg.appendChild(S('ellipse', { cx: 400, cy: 102, rx: 168, ry: 16, fill: METAL, stroke: INK, 'stroke-width': 4 }));
    bg.appendChild(artG(obj, 352, 2, 96));
    bg.appendChild(S('rect', { x: 200, y: 124, width: 400, height: 370, rx: 44, fill: INK }));
    bg.appendChild(S('rect', { x: 200, y: 118, width: 400, height: 370, rx: 44, fill: PAL.blue, stroke: INK, 'stroke-width': 5 }));
    bg.appendChild(S('circle', { cx: SC.x, cy: SC.y, r: SC.r + 10, fill: COL.surface, stroke: INK, 'stroke-width': 6 }));
    // Label size: as big as fits between neighbouring labels at the top of the dial.
    const chord = 2 * SC.r * 0.64 * Math.sin((Math.PI / 180) * (150 * c.labels) / (c.max - c.min));
    const fs3 = clamp(Math.floor(chord / 2.15), 22, 30);
    eachMark(c, v => {
      const major = isLabel(v, c), a = sAng(v);
      const p1 = pol(SC.r * (major ? 0.8 : 0.87), a), p2 = pol(SC.r * 0.97, a);
      bg.appendChild(S('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: major ? INK : COL.ink2, 'stroke-width': major ? 5 : 3, 'stroke-linecap': 'round' }));
      if (major) {
        const t = fmtNum(v), fs = t.length >= 4 ? Math.min(fs3, 25) : fs3, q = pol(SC.r * (t.length >= 4 ? 0.6 : 0.64), a);
        // Numbers sit above the needle with a white halo, so the one it points at stays readable.
        fg.appendChild(label({ x: q.x, y: q.y + fs * 0.36, 'text-anchor': 'middle', 'font-size': fs, stroke: COL.surface, 'stroke-width': 7, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }, t));
      }
    });
    bg.appendChild(label({ x: SC.x, y: SC.y + SC.r * 0.72, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 34, fill: COL.ink2 }, c.unit));
    if (!ro()) plusMinus(105, 314, 695, 314, () => setValue(snapV(value - c.step)), () => setValue(snapV(value + c.step)));
  }
  function scalesDyn() {
    const tg = num(p.target, null);
    if (tg !== null && tg >= c.min && tg <= c.max) {
      const lab = isLabel(tg, c), t = fmtNum(tg), q = pol(SC.r * (lab ? (t.length >= 4 ? 0.6 : 0.64) : 0.92), sAng(tg));
      dyn.appendChild(S('circle', { cx: q.x, cy: q.y, r: lab ? Math.max(30, t.length * 11 + 8) : 16, fill: TARGET_SOFT, stroke: TARGET, 'stroke-width': 5, 'pointer-events': 'none' }));
    }
    const a = sAng(value), tip = pol(SC.r * 0.9, a), tail = pol(-SC.r * 0.16, a);
    dyn.appendChild(S('line', { x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y, stroke: INK, 'stroke-width': 13, 'stroke-linecap': 'round' }));
    dyn.appendChild(S('line', { x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y, stroke: NEEDLE, 'stroke-width': 6, 'stroke-linecap': 'round' }));
    dyn.appendChild(S('circle', { cx: SC.x, cy: SC.y, r: 15, fill: INK }));
    dyn.appendChild(S('circle', { cx: SC.x, cy: SC.y, r: 5, fill: COL.surface }));
    // Hint: purple count-on dots, one per small mark, from a labelled number up to the needle (on top of it).
    const hf = num(p.hops, null);
    if (hf !== null && value > hf) {
      const r = SC.r * 0.75, a0 = sAng(hf), a1 = sAng(value), q0 = pol(r, a0), q1 = pol(r, a1);
      dyn.appendChild(S('path', { d: `M${q0.x} ${q0.y}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${q1.x} ${q1.y}`, fill: 'none', stroke: HOP, 'stroke-width': 4, 'pointer-events': 'none' }));
      for (let v = hf + c.marks; v <= value + 1e-6; v += c.marks) {
        const q = pol(r, sAng(round3(v)));
        dyn.appendChild(S('circle', { cx: q.x, cy: q.y, r: 9, fill: HOP, stroke: COL.surface, 'stroke-width': 2.5, 'pointer-events': 'none' }));
      }
    }
  }
  const scalesHit = q => Math.hypot(q.x - SC.x, q.y - SC.y) < SC.r + 36;
  function scalesVal(q) {
    let a = (Math.atan2(q.x - SC.x, -(q.y - SC.y)) * 180) / Math.PI;
    a = clamp(a, -150, 150);
    return c.min + ((a + 150) / 300) * (c.max - c.min);
  }

  /* ---------- jug: clear, ink outline, blue water ---------- */
  const J = { l: 262, r: 498, top: 44, bot: 476, y0: 462, y1: 96 };
  const jy = v => J.y0 - ((v - c.min) * (J.y0 - J.y1)) / (c.max - c.min);
  const jugPath = `M${J.l} ${J.top}V${J.bot - 24}q0 24 24 24H${J.r - 24}q24 0 24 -24V${J.top + 18}l22 -18`;
  function jugStatic() {
    const hp = `M${J.l} 122C${J.l - 84} 122 ${J.l - 84} 330 ${J.l} 330`;
    bg.appendChild(S('path', { d: hp, fill: 'none', stroke: INK, 'stroke-width': 26 }));
    bg.appendChild(S('path', { d: hp, fill: 'none', stroke: COL.surface2, 'stroke-width': 16 }));
    bg.appendChild(S('path', { d: `M${J.l} ${J.top}V${J.bot - 24}q0 24 24 24H${J.r - 24}q24 0 24 -24V${J.top}Z`, fill: GLASS }));
    const clip = S('clipPath', { id: clipId }, [S('rect', { x: J.l + 2, y: J.top, width: J.r - J.l - 4, height: J.bot - J.top - 2, rx: 22 })]);
    bg.appendChild(S('defs', {}, [clip]));
    fg.appendChild(S('path', { d: jugPath, fill: 'none', stroke: INK, 'stroke-width': 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    eachMark(c, v => {
      if (v <= c.min) return;
      const major = isLabel(v, c), y = jy(v);
      fg.appendChild(S('line', { x1: J.r - (major ? 66 : 38), y1: y, x2: J.r - 4, y2: y, stroke: INK, 'stroke-width': major ? 4 : 2.5 }));
      if (major) fg.appendChild(label({ x: J.r + 22, y: y + 11, 'font-size': 30 }, fmtNum(v)));
    });
    fg.appendChild(label({ x: J.r + 40, y: Math.max(30, jy(c.max) - 34), 'font-weight': 700, 'font-size': 28, fill: COL.ink2 }, c.unit));
  }
  function jugDyn() {
    const y = jy(value);
    const lq = LIQUID[p.liquid] || (typeof p.liquid === 'string' && /^#/.test(p.liquid) ? [p.liquid, INK] : LIQUID.water);
    const g = S('g', { 'clip-path': `url(#${clipId})` });
    if (value > c.min) {
      g.appendChild(S('rect', { x: J.l, y, width: J.r - J.l, height: J.bot - y, fill: lq[0] }));
      g.appendChild(S('rect', { x: J.l, y: y - 2, width: J.r - J.l, height: 5, fill: lq[1] }));
    }
    dyn.appendChild(g);
    sideHints(jy, J.r - 72, J.r + 22, -1);
    if (!ro()) dyn.appendChild(handle(J.l + 50, y, 'v', 28));
  }
  // Hints beside an upright scale (jug, thermometer): purple hops from a mark up to the level, and a blue
  // ring round a target number (or a blue arrow at an unlabelled mark). hx: where the hops sit; lx: label x.
  function sideHints(yOf, hx, lx, dir) {
    const hf = num(p.hops, null);
    if (hf !== null && value > hf) {
      for (let v = hf; v < value - 1e-6; v += c.marks) {
        const y0 = yOf(round3(v)), y1 = yOf(round3(Math.min(v + c.marks, value)));
        dyn.appendChild(S('path', { d: `M${hx} ${y0 - 2}Q${hx + dir * 26} ${(y0 + y1) / 2} ${hx} ${y1 + 2}`, fill: 'none', stroke: HOP, 'stroke-width': 4, 'stroke-linecap': 'round', 'pointer-events': 'none' }));
      }
    }
    const tg = num(p.target, null);
    if (tg !== null && tg >= c.min && tg <= c.max) {
      const y = yOf(tg), t = fmtNum(tg);
      if (isLabel(tg, c)) dyn.appendChild(S('rect', { x: lx - 10, y: y - 23, width: t.length * 19 + 22, height: 44, rx: 22, fill: TARGET_SOFT, stroke: TARGET, 'stroke-width': 5, 'pointer-events': 'none' }));
      else dyn.appendChild(S('path', { d: `M${lx - 4} ${y}l26 -15v30z`, fill: TARGET, stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'pointer-events': 'none' }));
    }
  }
  const jugHit = q => q.x > J.l - 90 && q.x < J.r + 120 && q.y > 20 && q.y < H;
  const jugVal = q => c.min + ((J.y0 - q.y) * (c.max - c.min)) / (J.y0 - J.y1);

  /* ---------- thermometer: white tube, red liquid ---------- */
  const T = { x: 390, y0: 408, y1: 62, top: 36, bulb: 446 };
  const ty = v => T.y0 - ((v - c.min) * (T.y0 - T.y1)) / (c.max - c.min);
  function thermoStatic() {
    if (p.object && artNames.includes(p.object)) bg.appendChild(artG(p.object, 70, 150, 160));
    const tw = 25, br = 40, jy0 = T.bulb - Math.sqrt(br * br - tw * tw);
    const body = `M${T.x - tw} ${jy0}V${T.top + tw}A${tw} ${tw} 0 0 1 ${T.x + tw} ${T.top + tw}V${jy0}A${br} ${br} 0 1 1 ${T.x - tw} ${jy0}Z`;
    bg.appendChild(S('path', { d: body, transform: 'translate(0 6)', fill: COL.surface3 }));
    bg.appendChild(S('path', { d: body, fill: COL.surface, stroke: INK, 'stroke-width': 5 }));
    bg.appendChild(S('rect', { x: T.x - 11, y: T.top + 12, width: 22, height: T.bulb - T.top - 12, rx: 11, fill: COL.surface2 }));
    eachMark(c, v => {
      const major = isLabel(v, c), y = ty(v);
      fg.appendChild(S('line', { x1: T.x + 34, y1: y, x2: T.x + (major ? 68 : 52), y2: y, stroke: INK, 'stroke-width': major ? 4 : 2.5, 'stroke-linecap': 'round' }));
      if (major) fg.appendChild(label({ x: T.x + 80, y: y + 11, 'font-size': 30 }, fmtNum(v)));
    });
    fg.appendChild(label({ x: T.x + 150, y: ty(c.max) + 11, 'font-weight': 700, 'font-size': 28, fill: COL.ink2 }, '°C'));
  }
  function thermoDyn() {
    const y = ty(value);
    dyn.appendChild(S('rect', { x: T.x - 11, y, width: 22, height: T.bulb - y, fill: NEEDLE }));
    dyn.appendChild(S('circle', { cx: T.x, cy: T.bulb, r: 29, fill: NEEDLE }));
    sideHints(ty, T.x - 34, T.x + 80, -1);
    if (!ro()) {
      dyn.appendChild(S('line', { x1: T.x - 40, y1: y, x2: T.x - 12, y2: y, stroke: HANDLE, 'stroke-width': 5 }));
      dyn.appendChild(handle(T.x - 66, y, 'v', 28));
    }
  }
  const thermoHit = q => q.x > T.x - 130 && q.x < T.x + 160 && q.y > 10 && q.y < H;
  const thermoVal = q => c.min + ((T.y0 - q.y) * (c.max - c.min)) / (T.y0 - T.y1);

  /* ---------- compare (Year 1) ---------- */
  const DARK = { [COL.a]: COL.aDark, [COL.b]: COL.bDark };
  function cube(x, y, s, col) {
    return S('rect', { x: x + 1.5, y: y + 1.5, width: s - 3, height: s - 3, rx: Math.min(6, s * 0.15), fill: col, stroke: DARK[col] || INK, 'stroke-width': 3 });
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
      // Two art icons side by side must not overlap, so the tallest is at most 300 high when there are two.
      const u = Math.min((hasB ? 300 : 380) / Math.max(...things, 1), p.cubes ? 60 : 200);
      const xs = hasB ? [250, 560] : [400];
      const ground = 462;
      bg.appendChild(S('line', { x1: 40, y1: ground + 2, x2: 760, y2: ground + 2, stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' }));
      things.forEach((ht, i) => {
        const hgt = ht * u, nm = icons[i] || 'rocket';
        let cubeX = xs[i] + 80;
        if (OBJECTS.includes(nm)) {
          const og = drawObject(nm, hgt, Math.min(90, Math.max(50, hgt * 0.3)));
          og.setAttribute('transform', `translate(${xs[i]} ${ground}) rotate(-90)`);
          bg.appendChild(og);
        } else {
          // Scale the icon so its drawn part (not its empty margin) is exactly hgt tall and stands on the ground.
          const name = artNames.includes(nm) ? nm : 'rocket';
          const [t0, b0] = ART_Y[name] || [4, 96];
          const size = (hgt * 100) / (b0 - t0);
          bg.appendChild(artG(name, xs[i] - size / 2, ground - (b0 * size) / 100, size));
          cubeX = xs[i] + size * 0.32 + 6;
        }
        if (p.cubes) for (let k = 0; k < Math.round(ht); k++) bg.appendChild(cube(cubeX, ground - (k + 1) * u, u, cols[i]));
      });
    } else if (kind === 'mass') {
      const bb = hasB ? b : 0;
      const diff = bb - a;
      const tilt = Math.abs(diff) < 1e-9 ? 0 : Math.sign(diff) * Math.min(15, 6 + (10 * Math.abs(diff)) / Math.max(a, bb, 1));
      const px = 400, py = 168, arm = 250;
      bg.appendChild(S('path', { d: `M326 480L474 480L432 448L368 448Z`, fill: METAL2, stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
      bg.appendChild(S('rect', { x: px - 10, y: py, width: 20, height: 282, fill: METAL, stroke: INK, 'stroke-width': 4 }));
      const rad = (tilt * Math.PI) / 180;
      const ends = [-1, 1].map(sx => ({ x: px + sx * arm * Math.cos(rad), y: py + sx * arm * Math.sin(rad) }));
      bg.appendChild(S('line', { x1: ends[0].x, y1: ends[0].y, x2: ends[1].x, y2: ends[1].y, stroke: INK, 'stroke-width': 22, 'stroke-linecap': 'round' }));
      bg.appendChild(S('line', { x1: ends[0].x, y1: ends[0].y, x2: ends[1].x, y2: ends[1].y, stroke: METAL, 'stroke-width': 13, 'stroke-linecap': 'round' }));
      bg.appendChild(S('circle', { cx: px, cy: py, r: 15, fill: PAL.yellow, stroke: INK, 'stroke-width': 4 }));
      ends.forEach((e, i) => {
        const panY = e.y + 150;
        bg.appendChild(S('line', { x1: e.x, y1: e.y, x2: e.x - 80, y2: panY, stroke: COL.ink2, 'stroke-width': 3 }));
        bg.appendChild(S('line', { x1: e.x, y1: e.y, x2: e.x + 80, y2: panY, stroke: COL.ink2, 'stroke-width': 3 }));
        bg.appendChild(S('path', { d: `M${e.x - 95} ${panY}Q${e.x} ${panY + 40} ${e.x + 95} ${panY}Z`, fill: METAL, stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
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
      // Optional labels under the pans and a big comparison sign above the balance (for reveals).
      const tags = Array.isArray(p.tags) ? p.tags : [];
      ends.forEach((e, i) => { if (tags[i] !== undefined && tags[i] !== null && tags[i] !== '') bg.appendChild(pill(e.x, e.y + 150 + 58, tags[i], { fs: 34, fill: COL.surface, stroke: INK })); });
      if (typeof p.sign === 'string' && p.sign.trim()) {
        bg.appendChild(S('rect', { x: 345, y: 22, width: 110, height: 100, rx: 18, fill: COL.good }));
        bg.appendChild(S('rect', { x: 345, y: 16, width: 110, height: 100, rx: 18, fill: COL.goodSoft, stroke: COL.good, 'stroke-width': 5 }));
        bg.appendChild(label({ x: 400, y: 96, 'text-anchor': 'middle', 'font-size': 84 }, p.sign.trim().slice(0, 2)));
      }
      if (!ro() && p.cubes && hasB) plusMinus(560, 452, 700, 452, () => setValue(Math.max(0, value - 1)), () => setValue(Math.min(30, value + 1)), 38);
    } else {
      const max = Math.max(num(p.max, 10), a, hasB ? b : 0, 1);
      const things = hasB ? [a, b] : [a];
      const xs = hasB ? [250, 550] : [400];
      const shapes = Array.isArray(p.shapes) ? p.shapes : [];
      const lq = LIQUID[p.liquid] || LIQUID.water;
      const bot = 410;
      const levels = [];
      things.forEach((lv, i) => {
        // A tank, or a tall thin glass, or a short wide glass.
        const { w, top } = shapes[i] === 'tall' ? { w: 130, top: 40 } : shapes[i] === 'wide' ? { w: 330, top: 250 } : { w: 190, top: 110 };
        const x = xs[i] - w / 2, y = bot - ((bot - top) * lv) / max;
        levels.push(y);
        bg.appendChild(S('path', { d: `M${x} ${top - 14}V${bot - 18}q0 18 18 18H${x + w - 18}q18 0 18 -18V${top - 14}Z`, fill: GLASS }));
        if (lv > 0) {
          bg.appendChild(S('path', { d: `M${x + 3} ${y}H${x + w - 3}V${bot - 18}q0 15 -15 15H${x + 18}q-15 0 -15 -15Z`, fill: lq[0] }));
          bg.appendChild(S('rect', { x: x + 3, y: y - 2, width: w - 6, height: 5, fill: lq[1] }));
        }
        if (p.halfLine) {
          const yh = bot - (bot - top) / 2;
          bg.appendChild(S('line', { x1: x - 16, y1: yh, x2: x + w + 16, y2: yh, stroke: TARGET, 'stroke-width': 4, 'stroke-dasharray': '12 8' }));
          bg.appendChild(label({ x: x + w + 24, y: yh + 10, 'font-size': 28, fill: TARGET }, 'half'));
        }
        bg.appendChild(S('path', { d: `M${x} ${top - 14}V${bot - 18}q0 18 18 18H${x + w - 18}q18 0 18 -18V${top - 14}`, fill: 'none', stroke: INK, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
        if (hasB) {
          bg.appendChild(S('circle', { cx: xs[i], cy: 458, r: 27, fill: cols[i], stroke: DARK[cols[i]], 'stroke-width': 4 }));
          bg.appendChild(label({ x: xs[i], y: 468, 'text-anchor': 'middle', 'font-size': 28 }, i ? 'B' : 'A'));
        }
      });
      // Hint: dashed lines across at each water level, so the two heights are easy to compare.
      if (p.guides && hasB) levels.forEach(y => bg.appendChild(S('line', { x1: 60, y1: y, x2: 740, y2: y, stroke: TARGET, 'stroke-width': 3, 'stroke-dasharray': '10 8', 'pointer-events': 'none' })));
    }
  }

  // Section 7 press buttons: white, rounded, a light border and a solid bottom edge; the face sinks when pressed.
  function plusMinus(x1, y1, x2, y2, minus, plus, r = 46) {
    [[x1, y1, '-', minus], [x2, y2, '+', plus]].forEach(([x, y, sym, fn]) => {
      const g = S('g', { class: 'btn', 'data-btn': sym });
      const box = { x: x - r, width: r * 2, height: r * 2, rx: 18 };
      g.appendChild(S('rect', { ...box, y: y - r + 5, fill: COL.line }));
      const face = S('g', { class: 'face' });
      face.appendChild(S('rect', { ...box, y: y - r, fill: COL.surface, stroke: COL.line, 'stroke-width': 3 }));
      face.appendChild(S('rect', { x: x - r * 0.42, y: y - 5, width: r * 0.84, height: 10, rx: 5, fill: INK }));
      if (sym === '+') face.appendChild(S('rect', { x: x - 5, y: y - r * 0.42, width: 10, height: r * 0.84, rx: 5, fill: INK }));
      g.appendChild(face);
      const up = () => g.classList.remove('down');
      g.addEventListener('pointerdown', e => { e.stopPropagation(); g.classList.add('down'); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) g.addEventListener(ev, up);
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
    if (v === undefined) { TOOL[c.tool].dy(); readoutDyn(); }
    else { const keep = value; value = v; TOOL[c.tool].dy(); value = keep; }
  }

  // Reveal readout (props.readout): show the reading in green so the picture gives the answer.
  function readoutDyn() {
    if (!p.readout || c.tool === 'compare') return;
    const GOOD = COL.good, txt = `${fmtNum(value)} ${c.unit}`;
    const ring = (x, y, w, h) => dyn.appendChild(S('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: h / 2, fill: 'none', stroke: GOOD, 'stroke-width': 5, 'pointer-events': 'none' }));
    if (c.tool === 'ruler') {
      const xs = rx(start()), xe = rx(start() + value), by = 146;
      dyn.appendChild(S('path', { d: `M${xs} ${by + 22}V${by}H${xe}V${by + 22}`, fill: 'none', stroke: GOOD, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      for (const x of [xs, xe]) dyn.appendChild(S('line', { x1: x, y1: 266, x2: x, y2: RY - 2, stroke: GOOD, 'stroke-width': 6, 'stroke-linecap': 'round' }));
      dyn.appendChild(pill(clamp((xs + xe) / 2, 110, W - 110), 92, txt));
    } else if (c.tool === 'scales') {
      const t = fmtNum(value), q = pol(SC.r * (t.length >= 4 ? 0.6 : 0.64), sAng(value));
      ring(q.x, q.y, Math.max(64, t.length * 19 + 26), 50);
      dyn.appendChild(pill(700, 190, txt, { fs: 38 }));
    } else if (c.tool === 'jug') {
      const y = jy(value);
      dyn.appendChild(S('line', { x1: J.l + 6, y1: y, x2: J.r - 6, y2: y, stroke: GOOD, 'stroke-width': 6, 'stroke-linecap': 'round' }));
      if (isLabel(value, c)) ring(J.r + 22 + fmtNum(value).length * 9.5, y, fmtNum(value).length * 19 + 30, 48);
      dyn.appendChild(pill(616, clamp(y, 44, H - 44), txt, { anchor: 'start', fs: 38 }));
    } else if (c.tool === 'thermometer') {
      const y = ty(value);
      fg.querySelector('.w-measure-read')?.remove();
      fg.appendChild(S('line', { class: 'w-measure-read', x1: T.x + 16, y1: y, x2: isLabel(value, c) ? T.x + 72 : 584, y2: y, stroke: GOOD, 'stroke-width': 6, 'stroke-linecap': 'round', 'pointer-events': 'none' }));
      if (isLabel(value, c)) ring(T.x + 80 + fmtNum(value).length * 9.5, y, fmtNum(value).length * 19 + 30, 48);
      dyn.appendChild(pill(592, clamp(y, 44, H - 44), txt, { anchor: 'start', fs: 38 }));
    }
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
    update(np) {
      cancelAnimationFrame(anim); clearTimeout(fallback);
      // A green answer label from showAnswer() goes away when the picture moves on (a new sub-step or item).
      if (answerShown && !(np && 'readout' in np)) { p.readout = false; answerShown = false; }
      setFromProps(np || {}); draw();
    },
    showAnswer(answer) {
      // compare: only a goal object ({ b }) changes the picture; a counted number (cubes) leaves it as it is.
      if (c.tool === 'compare') {
        const t = answer && typeof answer === 'object' ? num(answer.b, num(answer.value, null)) : null;
        if (t !== null && p.b !== undefined && p.b !== null && t !== value) { value = t; draw(); emit(); }
        return;
      }
      const t = typeof answer === 'number' ? answer : answer && typeof answer === 'object' ? num(answer.value, null) : num(answer, null);
      if (t === null) return;
      const target = snapV(t), from = value;
      value = target;
      if (!p.readout) { p.readout = true; answerShown = true; }
      cancelAnimationFrame(anim); clearTimeout(fallback);
      const moved = Math.abs(target - from) > 1e-9;
      // After the answer is shown, tell the runner (so a hands-on step can move on after "Show me").
      if (reducedMotion() || !moved) { drawDyn(); if (moved) emit(); return; }
      const t0 = performance.now(), ms = 700;
      const stepF = now => {
        const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
        drawDyn(from + (target - from) * e);
        if (k < 1) anim = requestAnimationFrame(stepF);
      };
      anim = requestAnimationFrame(stepF);
      fallback = setTimeout(() => { cancelAnimationFrame(anim); drawDyn(); emit(); }, ms + 80);
    },
    destroy() { cancelAnimationFrame(anim); clearTimeout(fallback); unbinds.splice(0).forEach(u => u()); if (unbindDrag) unbindDrag(); el.replaceChildren(); },
  };
  value = NaN;
  setFromProps(props);
  draw();
  bindDrag();
  el.__dev = { api, ctx }; // test hook: dev pages can set a state and fire onChange
  return api;
}
