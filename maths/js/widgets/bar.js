// bar: a bar model (display only). Owner: addsub. Bars are drawn to scale; an unknown shows a blue "?".
// Style v2: flat coloured bars with ink outlines and big ink numbers. Whole bar blue; parts red, yellow, green, orange.
//   Compare: bar a red, bar b yellow; the gap is a dashed box (unit boxes when icons are shown) with an ink bracket.
// Props:
//   kind        'partwhole' (default) | 'compare'
//   partwhole:  whole, parts (array of 2 or 3), labels (array of part labels), wholeLabel,
//               unknown ('whole' | part index | null)
//               colours (optional array of palette names, one per part, e.g. ['yellow', 'red'], so a part keeps
//               its colour when the parts swap places; default red, yellow, green, orange in turn)
//   compare:    a, b, labelA, labelB, unknown ('difference' | 'a' | 'b' | null), diffLabel (text for a known difference)
//               Two left-aligned bars; a dashed box and a bracket mark the difference.
//   generic:    top ([{ v, label }]), bottom ([{ v, label }]), unknown (a label whose bar shows "?")
//   icons       art name drawn once per unit inside bars of 12 or less (never inside an unknown bar).
//   readonly    (always display only)
// State: { kind } (no interaction)
// Debug: dev/harness.html?widget=bar&props={"kind":"compare","a":9,"b":5,"labelA":"Finn","labelB":"Dad","unknown":"difference","icons":"star"}
import { S, svgRoot, injectCSS, clamp } from '../core/dom.js';
import { artInner } from '../core/art.js';
import { COL, PAL, FONT } from '../core/theme.js';

export const meta = {
  title: 'Bar model',
  playground: { kind: 'compare', a: 9, b: 5, labelA: 'Rockets', labelB: 'Moons', unknown: 'difference', icons: 'rocket' },
  state: ['kind'],
};

const W = 800, H = 500;
const Q = COL.focus, QSOFT = COL.focusSoft; // the unknown: a blue "?" on a soft blue fill
const WHOLE_COL = PAL.blue;
const SEG_COL = [COL.a, COL.b, PAL.green, PAL.orange, PAL.purple, PAL.teal];
const CMP_COL = [COL.a, COL.b];
const num = v => { const x = Number(v); return Number.isFinite(x) ? clamp(x, 0, 100000) : 0; };

function text(x, y, t, size, fill, anchor = 'middle', weight = 800) {
  return S('text', { x, y, 'text-anchor': anchor, 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': weight, 'font-size': size, fill }, [String(t)]);
}

// Wrap a short label onto at most two lines.
function wrap(label, max = 11) {
  const s = String(label || '');
  if (s.length <= max || !s.includes(' ')) return [s];
  const words = s.split(' ');
  let a = '';
  while (words.length && (a + ' ' + words[0]).trim().length <= max) a = (a + ' ' + words.shift()).trim();
  if (!a) a = words.shift();
  return [a, words.join(' ')].filter(Boolean);
}

function brace(x1, x2, y, dir) {
  // A curly bracket from x1 to x2 along y; dir 1 = the tip points down, -1 = up.
  const w = x2 - x1;
  const q = Math.min(14, w / 4);
  const d = 18 * dir;
  const m = (x1 + x2) / 2;
  return `M${x1} ${y} q0 ${d / 2} ${q} ${d / 2} L${m - q} ${y + d / 2} q${q} 0 ${q} ${d / 2} q0 ${-d / 2} ${q} ${-d / 2} L${x2 - q} ${y + d / 2} q${q} 0 ${q} ${-d / 2}`;
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-bar', `
    .w-bar { width: 100%; height: 100%; }
    .w-bar .seg { transition: opacity .25s ease; }
  `);
  let p = { ...props };
  const root = svgRoot(W, H, 'w-bar');
  el.appendChild(root);

  function seg(g, x, y, w, h, v, { colour, unknown, icons, numberAt, ink }) {
    const showIcons = icons && !unknown && v > 0 && v <= 12 && Number.isInteger(v) && w / v >= 30;
    g.appendChild(S('rect', {
      class: 'seg', x, y, width: Math.max(w, 2), height: h, rx: 14,
      fill: unknown ? QSOFT : colour,
      stroke: unknown ? Q : COL.ink, 'stroke-width': 4, 'stroke-dasharray': unknown ? '14 10' : null, 'stroke-linecap': 'round',
    }));
    if (unknown) { g.appendChild(text(x + w / 2, y + h / 2, '?', Math.min(66, h * 0.7), Q)); return; }
    if (showIcons) {
      const cw = w / v;
      const s = Math.min(cw * 0.78, h * 0.72);
      for (let k = 0; k < v; k++) {
        if (k > 0) g.appendChild(S('line', { x1: x + k * cw, y1: y + 2, x2: x + k * cw, y2: y + h - 2, stroke: COL.ink, 'stroke-opacity': 0.45, 'stroke-width': 2.5 }));
        const a = S('g', { transform: `translate(${x + k * cw + (cw - s) / 2} ${y + (h - s) / 2}) scale(${s / 100})` });
        a.innerHTML = artInner(icons);
        g.appendChild(a);
      }
      if (numberAt) g.appendChild(text(numberAt.x, numberAt.y, v, 52, COL.ink, numberAt.anchor || 'middle'));
      return;
    }
    const t = String(v);
    const size = Math.min(54, h * 0.56, (w - 10) / (t.length * 0.66));
    if (size >= 20) g.appendChild(text(x + w / 2, y + h / 2, t, size, ink || COL.ink));
    else if (numberAt) g.appendChild(text(numberAt.x, numberAt.y, t, 46, COL.ink, numberAt.anchor || 'middle'));
  }

  function drawPartWhole(g) {
    const generic = Array.isArray(p.top) || Array.isArray(p.bottom);
    let top, bottom;
    if (generic) {
      const unk = p.unknown;
      const mk = arr => (Array.isArray(arr) ? arr : []).slice(0, 6).map(o => ({ v: num(o && typeof o === 'object' ? o.v : o), label: o && typeof o === 'object' ? o.label : '', unknown: unk !== undefined && unk !== null && o && o.label === unk }));
      top = mk(p.top); bottom = mk(p.bottom);
    } else {
      const parts = (Array.isArray(p.parts) ? p.parts : [3, 4]).slice(0, 4).map(num);
      const whole = p.whole !== undefined && p.whole !== null ? num(p.whole) : parts.reduce((s, v) => s + v, 0);
      const unk = p.unknown;
      top = [{ v: whole, label: p.wholeLabel || '', unknown: unk === 'whole' }];
      bottom = parts.map((v, i) => ({ v, label: (p.labels || [])[i] || '', unknown: unk !== undefined && unk !== null && unk !== 'whole' && Number(unk) === i }));
    }
    const total = Math.max(1, top.reduce((s, o) => s + o.v, 0), bottom.reduce((s, o) => s + o.v, 0));
    const x0 = 70, maxW = W - 2 * x0;
    const hasIcons = !!p.icons;
    const bh = 104;
    const y0 = hasIcons ? 120 : 100, y1 = y0 + bh + 34;
    const rowDraw = (row, y, isTop) => {
      // Small parts get a minimum width so their number fits; the rest shrink to keep the total width.
      const minW = 64;
      let ws = row.map(o => (o.v / total) * maxW);
      const small = ws.map(w => w < minW);
      const extra = ws.reduce((s, w, i) => s + (small[i] ? minW - w : 0), 0);
      const bigSum = ws.reduce((s, w, i) => s + (small[i] ? 0 : w), 0);
      ws = ws.map((w, i) => (small[i] ? minW : bigSum > 0 ? w - (extra * w) / bigSum : w));
      let x = x0;
      const GAP = 4; // a small gap between neighbouring parts; the outer edges stay lined up with the other row
      row.forEach((o, i) => {
        const gl = i > 0 ? GAP : 0, gr = i < row.length - 1 ? GAP : 0;
        // The whole is blue; parts take red, yellow, green, orange in turn (a lone generic top bar is a whole too).
        const named = !isTop && Array.isArray(p.colours) && Object.hasOwn(PAL, String(p.colours[i])) ? PAL[p.colours[i]] : null;
        const colour = isTop && (!generic || row.length === 1) ? WHOLE_COL : named || SEG_COL[i % SEG_COL.length];
        seg(g, x + gl, y, ws[i] - gl - gr, bh, o.v, {
          colour, unknown: o.unknown, icons: hasIcons ? p.icons : null,
          numberAt: { x: x + ws[i] / 2, y: isTop ? y - 30 : y + bh + 30 },
        });
        if (o.label) {
          const lines = wrap(o.label, Math.max(8, Math.floor(ws[i] / 15)));
          const ly = isTop ? y - (hasIcons ? 72 : 32) - (lines.length - 1) * 32 : y + bh + (hasIcons ? 72 : 34);
          lines.forEach((ln, k) => g.appendChild(text(x + ws[i] / 2, ly + k * 32, ln, 29, COL.ink2, 'middle', 700)));
        }
        x += ws[i];
      });
    };
    rowDraw(top, y0, true);
    rowDraw(bottom, y1, false);
  }

  function drawCompare(g) {
    const a = num(p.a ?? 9), b = num(p.b ?? 5);
    const unk = p.unknown;
    const hasLabels = !!(p.labelA || p.labelB);
    const hasIcons = !!p.icons && Math.max(a, b) <= 12;
    const x0 = hasLabels ? 222 : 60;
    const maxW = W - x0 - (hasIcons ? 110 : 50);
    const big = Math.max(a, b, 1);
    const sc = maxW / big;
    const bh = 96;
    const ys = [138, 138 + bh + 44];
    const vals = [a, b];
    const unknownRow = unk === 'a' ? 0 : unk === 'b' ? 1 : -1;
    const smallRow = a >= b ? 1 : 0;
    const diff = Math.abs(a - b);
    vals.forEach((v, r) => {
      const w = Math.max(v * sc, v > 0 ? 40 : 0);
      if (w > 0) {
        seg(g, x0, ys[r], w, bh, v, {
          colour: CMP_COL[r], unknown: unknownRow === r, icons: hasIcons ? p.icons : null,
          numberAt: { x: x0 + maxW + 22, y: ys[r] + bh / 2, anchor: 'start' },
        });
      } else {
        g.appendChild(S('line', { x1: x0, y1: ys[r], x2: x0, y2: ys[r] + bh, stroke: COL.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }));
      }
      const lab = r === 0 ? p.labelA : p.labelB;
      if (lab) {
        const lines = wrap(lab, 10);
        lines.forEach((ln, k) => g.appendChild(text(x0 - 18, ys[r] + bh / 2 + (k - (lines.length - 1) / 2) * 36, ln, 32, COL.ink2, 'end', 700)));
      }
    });
    if (diff > 0) {
      const xs = x0 + Math.min(a, b) * sc, xe = x0 + big * sc;
      const y = ys[smallRow];
      if (hasIcons && Number.isInteger(a) && Number.isInteger(b)) {
        // One empty box per unit, so "count the empty boxes" works.
        for (let k = 0; k < diff; k++) {
          g.appendChild(S('rect', { x: xs + k * sc + 4, y: y + 4, width: Math.max(sc - 8, 4), height: bh - 8, rx: 10, fill: COL.surface2, stroke: COL.ink3, 'stroke-width': 3, 'stroke-dasharray': '9 7' }));
        }
      } else {
        g.appendChild(S('rect', { x: xs + 3, y: y + 4, width: Math.max(xe - xs - 6, 4), height: bh - 8, rx: 12, fill: COL.surface2, stroke: COL.ink3, 'stroke-width': 3, 'stroke-dasharray': '10 8' }));
      }
      const dir = smallRow === 1 ? 1 : -1;
      const by = smallRow === 1 ? y + bh + 10 : y - 10;
      const known = unk !== 'difference';
      g.appendChild(S('path', { d: brace(xs, xe, by, dir), fill: 'none', stroke: COL.ink, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      const ly = by + dir * 50;
      const t = known ? String(p.diffLabel ?? diff) : '?';
      if (!known) g.appendChild(S('rect', { x: (xs + xe) / 2 - 40, y: ly - 35, width: 80, height: 70, rx: 16, fill: QSOFT, stroke: Q, 'stroke-width': 4, 'stroke-dasharray': '10 8', 'stroke-linecap': 'round' }));
      g.appendChild(text((xs + xe) / 2, ly, t, known ? 48 : 52, known ? COL.ink : Q));
    }
  }

  function draw() {
    root.replaceChildren();
    const g = S('g');
    root.appendChild(g);
    if (p.kind === 'compare') drawCompare(g); else drawPartWhole(g);
  }

  const api = {
    getState() { return { kind: p.kind === 'compare' ? 'compare' : 'partwhole' }; },
    update(np) { p = { ...p, ...np }; draw(); },
    showAnswer() {
      if (p.unknown === undefined || p.unknown === null) return;
      if (p.kind === 'compare' && p.unknown === 'difference') { p = { ...p, unknown: null }; draw(); return; }
      p = { ...p, unknown: null }; draw();
    },
    destroy() { el.replaceChildren(); },
  };
  draw();
  return api;
}
