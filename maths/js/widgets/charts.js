// charts: tally charts, tables, pictograms and block diagrams to read or build.
// Props: kind ('tally' | 'pictogram' | 'block' | 'table'),
//        cats (array of { label, icon (art name), value, colour (name or #hex, shown as a swatch or block colour) }, up to 6),
//        key (pictogram: one icon stands for `key` items; part icons are drawn for the remainder, e.g. half an icon for 1 when key is 2),
//        interactive (- and + buttons per category: +1 tally / table / block, +key for a pictogram (or +step)),
//        step (pictogram button step, default key), max (block axis top; tally/table cap), axisStep (block axis labels: 1, 2, 5 or 10),
//        title (small heading), heads (table column headings, e.g. ["Colour", "Number"]),
//        given (array of numbers to copy, shown beside each category) with givenAs ('tally' | 'number'),
//        readonly.
// State: { values, total }  (values in category order)
// Debug: dev/harness.html?widget=charts&props={"kind":"block","cats":[{"label":"Red","value":3},{"label":"Blue","value":5}],"interactive":true}
import { S, svgRoot, onTap, injectCSS, clamp } from '../core/dom.js';
import { artInner } from '../core/art.js';
import { COL, FONT, FRAC } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Charts',
  playground: { kind: 'block', interactive: true, cats: [{ label: 'Red', colour: 'red', value: 0 }, { label: 'Blue', colour: 'blue', value: 0 }, { label: 'Green', colour: 'green', value: 0 }, { label: 'Gold', colour: 'gold', value: 0 }] },
  state: ['values', 'total'],
};

const W = 800, H = 500;
let uid = 0;
const NAMED = { gold: '#f2b544', cyan: '#5fd4ff', pink: '#ff8fb1', green: '#6fe3a5', purple: '#b48cff', orange: '#ff9a52', red: '#ff6b57', blue: '#4f9dff', white: '#f3efe6', grey: '#9aa3b2' };
const colourOf = (c, i) => NAMED[c] || (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : FRAC[i % FRAC.length]);
const f1 = v => Math.round(v * 10) / 10;

// Tally marks: groups of five (four upright and one across). Returns a <g>.
export function tallyMarks(n, x, y, h, sp, colour = COL.ink) {
  const g = S('g', { class: 'deco' });
  let cx = x;
  const groups = Math.floor(n / 5), rest = n % 5;
  const d = [];
  for (let k = 0; k < groups; k++) {
    for (let i = 0; i < 4; i++) d.push(`M${f1(cx + i * sp)} ${f1(y)}V${f1(y + h)}`);
    d.push(`M${f1(cx - sp * 0.6)} ${f1(y + h * 0.82)}L${f1(cx + 3 * sp + sp * 0.6)} ${f1(y + h * 0.18)}`);
    cx += 4 * sp + sp * 1.6;
  }
  for (let i = 0; i < rest; i++) d.push(`M${f1(cx + i * sp)} ${f1(y)}V${f1(y + h)}`);
  if (d.length) g.appendChild(S('path', { d: d.join(''), stroke: colour, 'stroke-width': Math.max(3, sp * 0.28), 'stroke-linecap': 'round' }));
  return g;
}
const tallyWidth = (n, sp) => Math.floor(n / 5) * (5.6 * sp) + (n % 5) * sp;

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-charts', `
    .w-charts { width: 100%; height: 100%; }
    .w-charts .pm { cursor: pointer; }
    .w-charts .pm:active rect { fill: rgba(242,181,68,.35); }
    .w-charts .deco { pointer-events: none; }
  `);
  const id = ++uid;
  let p = {};
  let values = [];
  const root = svgRoot(W, H, 'w-charts');
  el.appendChild(root);
  const unbinds = [];
  // readonly: false arriving through update() (a hint) switches interaction on even if mounted readonly.
  const ro = () => (p.readonly === false ? false : !!(p.readonly || ctx.readonly));
  const kind = () => (['tally', 'pictogram', 'block', 'table'].includes(p.kind) ? p.kind : 'block');
  const cats = () => (Array.isArray(p.cats) ? p.cats : []).slice(0, 6).map((c, i) => ({ label: String(c?.label ?? ''), icon: c?.icon, colour: c?.colour, col: colourOf(c?.colour, i) }));
  const key = () => clamp(Math.round(+p.key || 1), 1, 100);
  const interactive = () => !!p.interactive && !ro();
  const cap = () => {
    if (kind() === 'block') return blockMax();
    if (kind() === 'pictogram') return key() * 12;
    return clamp(Math.round(+p.max || (kind() === 'table' ? 99 : 30)), 1, 99);
  };
  function blockMax() {
    const top = Math.max(1, ...values, ...(Array.isArray(p.given) ? p.given.map(Number).filter(Number.isFinite) : [0]));
    if (+p.max > 0) return Math.max(Math.round(+p.max), 1);
    return top <= 10 ? 10 : top <= 20 ? 20 : Math.ceil(top / 10) * 10;
  }

  function setValues(np) {
    if ('cats' in np) values = cats().map((c, i) => clamp(Math.round(+(p.cats[i]?.value) || 0), 0, 999));
    values = values.slice(0, cats().length);
    while (values.length < cats().length) values.push(0);
  }

  function changed() { draw(); ctx.onChange && ctx.onChange(api.getState()); }

  function bump(i, dir) {
    const stepN = kind() === 'pictogram' ? clamp(Math.round(+p.step || key()), 1, 100) : 1;
    const nv = clamp(values[i] + dir * stepN, 0, cap());
    if (nv === values[i]) { sfx('tick'); return; }
    values[i] = nv;
    sfx(dir > 0 ? 'pop' : 'click');
    changed();
  }

  function pmButton(x, y, s, sign, i) {
    const g = S('g', { class: 'pm', role: 'button', 'aria-label': `${sign > 0 ? 'Add' : 'Take away'} ${cats()[i].label}` }, [
      S('rect', { x, y, width: s, height: s, rx: 14, fill: 'rgba(242,181,68,.12)', stroke: COL.tens, 'stroke-width': 3 }),
      S('path', { d: sign > 0 ? `M${x + s / 2} ${y + s * 0.26}V${y + s * 0.74}M${x + s * 0.26} ${y + s / 2}H${x + s * 0.74}` : `M${x + s * 0.26} ${y + s / 2}H${x + s * 0.74}`, stroke: COL.tens, 'stroke-width': 6, 'stroke-linecap': 'round' }),
    ]);
    unbinds.push(onTap(g, () => bump(i, sign)));
    root.appendChild(g);
  }

  function drawArt(name, x, y, size, clipW = 1) {
    const g = S('g', { class: 'deco', transform: `translate(${f1(x)} ${f1(y)}) scale(${(size / 100).toFixed(4)})` });
    if (clipW < 1) {
      const cid = `w-ch-${id}-${Math.round(x)}-${Math.round(y)}`;
      g.appendChild(S('defs', {}, [S('clipPath', { id: cid }, [S('rect', { x: 0, y: 0, width: 100 * clipW, height: 100 })])]));
      const inner = S('g', { 'clip-path': `url(#${cid})` });
      inner.innerHTML = artInner(name);
      g.appendChild(inner);
    } else g.innerHTML = artInner(name);
    root.appendChild(g);
  }

  function labelCell(c, x, yMid, rowH, maxW) {
    let tx = x;
    const s = Math.min(rowH * 0.7, 52);
    if (c.icon && kind() !== 'pictogram') { drawArt(c.icon, tx, yMid - s / 2, s); tx += s + 10; }
    if (c.colour) { root.appendChild(S('circle', { class: 'deco', cx: tx + 13, cy: yMid, r: 13, fill: c.col, stroke: 'rgba(0,0,0,.3)', 'stroke-width': 2 })); tx += 34; }
    const room = maxW - (tx - x);
    const fs = clamp(room / Math.max(1, c.label.length * 0.56), 18, 26);
    root.appendChild(S('text', { class: 'deco', x: tx, y: yMid + fs * 0.36, 'font-family': FONT.display, 'font-weight': 600, 'font-size': f1(fs), fill: COL.ink }, [c.label]));
  }

  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    const cs = cats();
    let top = 12;
    if (p.title) {
      root.appendChild(S('text', { class: 'deco', x: W / 2, y: 36, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 26, fill: COL.ink2 }, [String(p.title)]));
      top = 54;
    }
    root.setAttribute('viewBox', `0 0 ${W} ${H}`);
    if (!cs.length) return;
    if (kind() === 'block') drawBlock(cs, top);
    else {
      // Fit the viewBox to the rows so short charts fill small spaces (option tiles) and big ones.
      const bottom = drawRows(cs, top);
      root.setAttribute('viewBox', `0 0 ${W} ${Math.round(Math.max(220, Math.min(H, bottom + 12)))}`);
    }
  }

  // Tally, table and pictogram: one row per category.
  function drawRows(cs, top) {
    const k = kind();
    const n = cs.length;
    const keyH = k === 'pictogram' ? 70 : 0;
    const headH = k === 'table' && Array.isArray(p.heads) ? 50 : 0;
    const inter = interactive();
    const rowH = Math.min(84, (H - top - 10 - keyH - headH) / n);
    const given = Array.isArray(p.given) ? p.given : null;
    const labW = 230, givenW = given ? 130 : 0;
    const x0 = 20, xData = x0 + labW + givenW + 10;
    const xEnd = inter ? W - 160 : W - 20;
    const y0 = top + headH;
    const tableW = k === 'table' ? Math.min(xEnd, xData + 160) : xEnd;
    // Frame and row lines.
    root.appendChild(S('rect', { class: 'deco', x: x0 - 8, y: y0 - headH, width: tableW - x0 + 16, height: rowH * n + headH, rx: 10, fill: 'rgba(255,255,255,.03)', stroke: COL.line, 'stroke-width': 2 }));
    for (let i = 1; i < n; i++) root.appendChild(S('line', { class: 'deco', x1: x0 - 8, y1: y0 + i * rowH, x2: tableW + 8, y2: y0 + i * rowH, stroke: COL.line, 'stroke-width': 2 }));
    if (headH) root.appendChild(S('line', { class: 'deco', x1: x0 - 8, y1: y0, x2: tableW + 8, y2: y0, stroke: COL.ink3, 'stroke-width': 2 }));
    root.appendChild(S('line', { class: 'deco', x1: x0 + labW, y1: y0 - headH, x2: x0 + labW, y2: y0 + rowH * n, stroke: COL.line, 'stroke-width': 2 }));
    if (given) root.appendChild(S('line', { class: 'deco', x1: x0 + labW + givenW, y1: y0 - headH, x2: x0 + labW + givenW, y2: y0 + rowH * n, stroke: COL.line, 'stroke-width': 2 }));
    if (headH) {
      const [h1 = '', h2 = ''] = p.heads.map(String);
      root.appendChild(S('text', { class: 'deco', x: x0 + 6, y: y0 - 16, 'font-family': FONT.display, 'font-weight': 600, 'font-size': 22, fill: COL.ink2 }, [h1]));
      root.appendChild(S('text', { class: 'deco', x: xData + 70, y: y0 - 16, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 22, fill: COL.ink2 }, [h2]));
    }
    cs.forEach((c, i) => {
      const yMid = y0 + (i + 0.5) * rowH;
      labelCell(c, x0, yMid, rowH, labW - 14);
      if (given) {
        const gv = Math.max(0, Math.round(+given[i] || 0));
        if (p.givenAs === 'tally') {
          const sp = Math.min(13, (givenW - 20) / Math.max(1, tallyWidth(gv, 1)));
          root.appendChild(tallyMarks(gv, x0 + labW + 14, yMid - rowH * 0.25, rowH * 0.5, sp, COL.ones));
        } else root.appendChild(S('text', { class: 'deco', x: x0 + labW + givenW / 2, y: yMid + 11, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 32, fill: COL.ones }, [String(gv)]));
      }
      const v = values[i];
      const avail = xEnd - xData - 10;
      if (k === 'tally') {
        const sp = Math.min(17, avail / Math.max(1, tallyWidth(v, 1)));
        root.appendChild(tallyMarks(v, xData + 12, yMid - rowH * 0.3, rowH * 0.6, sp));
      } else if (k === 'table') {
        root.appendChild(S('text', { class: 'deco', x: xData + 70, y: yMid + 12, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 34, fill: COL.ink }, [String(v)]));
      } else {
        const kk = key();
        const full = Math.floor(v / kk), part = (v % kk) / kk;
        const count = full + (part > 0 ? 1 : 0);
        const size = Math.min(rowH * 0.78, 58, count ? (avail - 4) / count - 6 : 58);
        const icon = p.icon || c.icon || 'star';
        for (let j = 0; j < count; j++) drawArt(icon, xData + 8 + j * (size + 6), yMid - size / 2, size, j < full ? 1 : part);
      }
      if (inter) {
        const s = clamp(rowH - 10, 56, 64);
        pmButton(W - 150, yMid - s / 2, s, -1, i);
        pmButton(W - 150 + s + 10, yMid - s / 2, s, 1, i);
      }
    });
    if (k === 'pictogram') {
      // Key box: [icon] = n
      const kk = key();
      const icon = p.icon || cs.find(c => c.icon)?.icon || 'star';
      const bx = x0, by = Math.min(H - keyH + 8, y0 + rowH * n + 14), bh = keyH - 16;
      root.appendChild(S('rect', { class: 'deco', x: bx, y: by, width: 210, height: bh, rx: 12, fill: 'rgba(95,212,255,.08)', stroke: COL.ones, 'stroke-width': 2.5 }));
      root.appendChild(S('text', { class: 'deco', x: bx + 14, y: by + bh / 2 + 9, 'font-family': FONT.display, 'font-weight': 600, 'font-size': 24, fill: COL.ink2 }, ['Key:']));
      drawArt(icon, bx + 78, by + (bh - 44) / 2, 44);
      root.appendChild(S('text', { class: 'deco', x: bx + 130, y: by + bh / 2 + 11, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: COL.ink }, [`= ${kk}`]));
      return by + bh;
    }
    return y0 + rowH * n;
  }

  function drawBlock(cs, top) {
    const n = cs.length;
    const inter = interactive();
    const given = Array.isArray(p.given) ? p.given : null;
    const max = blockMax();
    const step = [1, 2, 5, 10].includes(+p.axisStep) ? +p.axisStep : max <= 10 ? 1 : max <= 20 ? 2 : max <= 50 ? 5 : 10;
    const x0 = 86, x1 = W - 16;
    const labelH = 64 + (given ? 46 : 0);
    const btnH = inter ? 72 : 0;
    const yTop = top + 14, yBot = H - labelH - btnH - 6;
    const unit = (yBot - yTop) / max;
    // Grid lines and axis labels.
    for (let v = 0; v <= max; v += step) {
      const y = yBot - v * unit;
      root.appendChild(S('line', { class: 'deco', x1: x0, y1: f1(y), x2: x1, y2: f1(y), stroke: v === 0 ? COL.ink2 : COL.line, 'stroke-width': v === 0 ? 3 : 1.5 }));
      root.appendChild(S('text', { class: 'deco', x: x0 - 12, y: f1(y + 8), 'text-anchor': 'end', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 22, fill: COL.ink2 }, [String(v)]));
    }
    root.appendChild(S('line', { class: 'deco', x1: x0, y1: yTop - 6, x2: x0, y2: yBot, stroke: COL.ink2, 'stroke-width': 3 }));
    const colW = (x1 - x0) / n;
    const bw = Math.min(colW * 0.62, 96);
    cs.forEach((c, i) => {
      const cx = x0 + (i + 0.5) * colW;
      const v = Math.min(values[i], max);
      // Blocks: one square-ish block per item.
      const g = S('g', { class: 'deco' });
      for (let b = 0; b < v; b++) {
        g.appendChild(S('rect', { x: f1(cx - bw / 2), y: f1(yBot - (b + 1) * unit), width: f1(bw), height: f1(unit), fill: c.col, 'fill-opacity': 0.85, stroke: COL.panel, 'stroke-width': Math.min(2.5, unit * 0.12) }));
      }
      root.appendChild(g);
      // Label (and icon) under the column.
      const ly = yBot + 34;
      const iconW = c.icon ? 34 : 0;
      const fs = clamp((colW - 10 - iconW) / Math.max(1, c.label.length * 0.56), 16, 24);
      const textW = c.label.length * fs * 0.56;
      const sx = cx - (iconW + textW) / 2;
      if (c.icon) drawArt(c.icon, sx, ly - 24, 30);
      root.appendChild(S('text', { class: 'deco', x: f1(sx + iconW), y: f1(ly), 'font-family': FONT.display, 'font-weight': 600, 'font-size': f1(fs), fill: COL.ink, textLength: textW > colW - iconW - 6 ? f1(colW - iconW - 6) : null, lengthAdjust: 'spacingAndGlyphs' }, [c.label]));
      if (given) {
        const gv = Math.max(0, Math.round(+given[i] || 0));
        if (p.givenAs === 'tally') {
          const sp = Math.min(11, (colW - 20) / Math.max(1, tallyWidth(gv, 1)));
          const tw = tallyWidth(gv, sp);
          root.appendChild(tallyMarks(gv, cx - tw / 2 + sp * 0.3, ly + 14, 28, sp, COL.ones));
        } else root.appendChild(S('text', { class: 'deco', x: f1(cx), y: f1(ly + 40), 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: COL.ones }, [String(gv)]));
      }
      if (inter) {
        const s = Math.min(60, (colW - 12) / 2);
        const by = H - btnH + 4;
        pmButton(cx - s - 4, by, s, -1, i);
        pmButton(cx + 4, by, s, 1, i);
      }
    });
  }

  const api = {
    getState() { return { values: values.slice(), total: values.reduce((a, b) => a + b, 0) }; },
    update(np = {}) { p = { ...p, ...np }; setValues(np); draw(); },
    showAnswer(answer) {
      const target = Array.isArray(answer) ? answer : answer && Array.isArray(answer.values) ? answer.values : null;
      if (!target) return;
      values = values.map((v, i) => clamp(Math.round(+target[i] || 0), 0, 999));
      draw();
    },
    destroy() { unbinds.splice(0).forEach(u => u()); el.replaceChildren(); },
  };
  p = { ...props };
  setValues({ cats: p.cats });
  draw();
  return api;
}
