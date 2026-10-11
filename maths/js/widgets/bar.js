// bar: a bar model (display only). Owner: addsub. Bars are drawn to scale; an unknown shows a gold "?".
// Props:
//   kind        'partwhole' (default) | 'compare'
//   partwhole:  whole, parts (array of 2 or 3), labels (array of part labels), wholeLabel,
//               unknown ('whole' | part index | null)
//   compare:    a, b, labelA, labelB, unknown ('difference' | 'a' | 'b' | null), diffLabel (text for a known difference)
//               Two left-aligned bars; a dashed box and a bracket mark the difference.
//   generic:    top ([{ v, label }]), bottom ([{ v, label }]), unknown (a label whose bar shows "?")
//   icons       art name drawn once per unit inside bars of 12 or less (never inside an unknown bar).
//   readonly    (always display only)
// State: { kind } (no interaction)
// Debug: dev/harness.html?widget=bar&props={"kind":"compare","a":9,"b":5,"labelA":"Finn","labelB":"Dad","unknown":"difference","icons":"star"}
import { S, svgRoot, injectCSS, clamp } from '../core/dom.js';
import { artInner } from '../core/art.js';
import { COL, FONT } from '../core/theme.js';

export const meta = {
  title: 'Bar model',
  playground: { kind: 'compare', a: 9, b: 5, labelA: 'Rockets', labelB: 'Moons', unknown: 'difference', icons: 'rocket' },
  state: ['kind'],
};

const W = 800, H = 500;
const GOLD = COL.tens;
const DARK = '#0c1430';
const SEG_COL = [COL.a, COL.b, '#6fe3a5', '#ff8fb1'];
const num = v => { const x = Number(v); return Number.isFinite(x) ? clamp(x, 0, 100000) : 0; };

function text(x, y, t, size, fill, anchor = 'middle', weight = 700) {
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
      class: 'seg', x, y, width: Math.max(w, 2), height: h, rx: 10,
      fill: unknown ? 'rgba(242,181,68,.08)' : colour, 'fill-opacity': unknown ? 1 : 0.88,
      stroke: unknown ? GOLD : 'rgba(0,0,0,.35)', 'stroke-width': unknown ? 4 : 2, 'stroke-dasharray': unknown ? '12 9' : null,
    }));
    if (unknown) { g.appendChild(text(x + w / 2, y + h / 2, '?', Math.min(64, h * 0.7), GOLD)); return; }
    if (showIcons) {
      const cw = w / v;
      const s = Math.min(cw * 0.78, h * 0.72);
      for (let k = 0; k < v; k++) {
        if (k > 0) g.appendChild(S('line', { x1: x + k * cw, y1: y + 6, x2: x + k * cw, y2: y + h - 6, stroke: 'rgba(0,0,0,.28)', 'stroke-width': 2 }));
        const a = S('g', { transform: `translate(${x + k * cw + (cw - s) / 2} ${y + (h - s) / 2}) scale(${s / 100})` });
        a.innerHTML = artInner(icons);
        g.appendChild(a);
      }
      if (numberAt) g.appendChild(text(numberAt.x, numberAt.y, v, 40, COL.ink, numberAt.anchor || 'middle'));
      return;
    }
    const t = String(v);
    const size = Math.min(48, h * 0.55, (w - 8) / (t.length * 0.62));
    if (size >= 18) g.appendChild(text(x + w / 2, y + h / 2, t, size, ink || DARK));
    else if (numberAt) g.appendChild(text(numberAt.x, numberAt.y, t, 36, COL.ink, numberAt.anchor || 'middle'));
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
      row.forEach((o, i) => {
        const colour = isTop && !generic ? 'rgba(243,239,230,.22)' : SEG_COL[i % SEG_COL.length];
        seg(g, x, y, ws[i], bh, o.v, {
          colour, unknown: o.unknown, icons: hasIcons ? p.icons : null, ink: isTop && !generic ? COL.ink : DARK,
          numberAt: { x: x + ws[i] / 2, y: isTop ? y - 30 : y + bh + 30 },
        });
        if (o.label) {
          const lines = wrap(o.label, Math.max(8, Math.floor(ws[i] / 15)));
          const ly = isTop ? y - (hasIcons ? 70 : 30) - (lines.length - 1) * 30 : y + bh + (hasIcons ? 70 : 32);
          lines.forEach((ln, k) => g.appendChild(text(x + ws[i] / 2, ly + k * 30, ln, 26, COL.ink2, 'middle', 600)));
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
    const x0 = hasLabels ? 210 : 60;
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
          colour: r === 0 ? COL.a : COL.b, unknown: unknownRow === r, icons: hasIcons ? p.icons : null,
          numberAt: { x: x0 + maxW + 22, y: ys[r] + bh / 2, anchor: 'start' },
        });
      } else {
        g.appendChild(S('line', { x1: x0, y1: ys[r], x2: x0, y2: ys[r] + bh, stroke: r === 0 ? COL.a : COL.b, 'stroke-width': 5 }));
      }
      const lab = r === 0 ? p.labelA : p.labelB;
      if (lab) {
        const lines = wrap(lab);
        lines.forEach((ln, k) => g.appendChild(text(x0 - 18, ys[r] + bh / 2 + (k - (lines.length - 1) / 2) * 32, ln, 28, COL.ink2, 'end', 600)));
      }
    });
    if (diff > 0) {
      const xs = x0 + Math.min(a, b) * sc, xe = x0 + big * sc;
      const y = ys[smallRow];
      g.appendChild(S('rect', { x: xs, y: y + 4, width: Math.max(xe - xs, 4), height: bh - 8, rx: 8, fill: 'rgba(255,255,255,.03)', stroke: COL.ink3, 'stroke-width': 3, 'stroke-dasharray': '10 8' }));
      const dir = smallRow === 1 ? 1 : -1;
      const by = smallRow === 1 ? y + bh + 10 : y - 10;
      const known = unk !== 'difference';
      g.appendChild(S('path', { d: brace(xs, xe, by, dir), fill: 'none', stroke: known ? COL.ink2 : GOLD, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      const ly = by + dir * 46;
      const t = known ? String(p.diffLabel ?? diff) : '?';
      if (!known) g.appendChild(S('rect', { x: (xs + xe) / 2 - 34, y: ly - 30, width: 68, height: 60, rx: 12, fill: 'rgba(242,181,68,.10)', stroke: GOLD, 'stroke-width': 3, 'stroke-dasharray': '9 7' }));
      g.appendChild(text((xs + xe) / 2, ly, t, 44, known ? COL.ink : GOLD));
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
