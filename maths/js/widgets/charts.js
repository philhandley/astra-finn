// charts: tally charts, tables, pictograms and block diagrams to read or build.
// Look (style v2): white tables with light rules and ink text, thick ink tally marks, outlined pictogram icons,
//        flat coloured blocks with ink outlines on a clean axis, white push buttons for - and +.
// Props: kind ('tally' | 'pictogram' | 'block' | 'table'),
//        cats (array of { label, icon (art name), value, colour (palette name or #hex, shown as a swatch or block colour) }, up to 6),
//        key (pictogram: one icon stands for `key` items; part icons are drawn for the remainder, e.g. half an icon for 1 when key is 2),
//        interactive (- and + buttons per category: +1 tally / table / block, +key for a pictogram (or +step)),
//        step (pictogram button step, default key), max (block axis top; tally/table cap), axisStep (block axis labels: 1, 2, 5 or 10),
//        title (small heading), heads (table column headings, e.g. ["Colour", "Number"]),
//        given (array of numbers to copy, shown beside each category) with givenAs ('tally' | 'number'),
//        highlight (a category index or array of indices: a soft blue band behind that row or column, with its number,
//            e.g. to reveal which has the most),
//        Hint helpers (they point without giving the number away):
//        focus (index or array: the same soft blue band, but no number), guide (block: index, array or 'all': a dashed blue
//            line from the top of that column across to the number axis), gates (tally: true: a small blue 5, 10, 15 over
//            each finished gate, in the focused rows or every row), focusKey (pictogram: ring the key in blue),
//        ghost (array of target values drawn faintly, to build over: grey tally marks, faded pictures, dashed block outlines),
//        readonly.
// State: { values, total }  (values in category order)
// Debug: dev/harness.html?widget=charts&props={"kind":"block","cats":[{"label":"Red","colour":"red","value":3},{"label":"Blue","colour":"blue","value":5}],"interactive":true}
import { S, svgRoot, onTap, injectCSS, clamp } from '../core/dom.js';
import { artInner } from '../core/art.js';
import { COL, PAL, FONT, FRAC } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Charts',
  playground: { kind: 'block', interactive: true, cats: [{ label: 'Red', colour: 'red', value: 0 }, { label: 'Blue', colour: 'blue', value: 0 }, { label: 'Green', colour: 'green', value: 0 }, { label: 'Yellow', colour: 'yellow', value: 0 }] },
  state: ['values', 'total'],
};

const W = 800, H = 500;
let uid = 0;
// Palette names (old names kept only so stale content still draws).
const NAMED = { red: PAL.red, yellow: PAL.yellow, blue: PAL.blue, green: PAL.green, orange: PAL.orange, pink: PAL.pink, purple: PAL.purple, teal: PAL.teal,
  white: '#ffffff', grey: '#c9cfdb', gold: PAL.yellow, cyan: PAL.teal };
const colourOf = (c, i) => NAMED[c] || (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : FRAC[i % FRAC.length]);
const f1 = v => Math.round(v * 10) / 10;
// Crystals take their category's colour, so "pink crystals" are drawn pink (words match pictures). Asteroids stay grey
// with a coloured ring round them, the same way the objects widget draws "asteroids by colour".
const TINTABLE = { crystal: [['#8b5cf6', 'body'], ['#c4b5fd', 'light']], asteroid: 'ring' };
const mixHex = (hex, to, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + to * k).toString(16).padStart(2, '0')).join('');
function tintedArt(name, colour) {
  const svg = artInner(name);
  const body = colour && NAMED[colour];
  if (!TINTABLE[name] || !body || colour === 'white' || colour === 'grey') return svg;
  if (TINTABLE[name] === 'ring') return `<circle cx="50" cy="50" r="45" fill="#ffffff" stroke="${body}" stroke-width="9"/><g transform="translate(15 15) scale(0.7)">${svg}</g>`;
  const shade = { body, light: mixHex(body, 255, 0.55), dark: PAL[colour + 'Dark'] || mixHex(body, 0, 0.3) };
  return TINTABLE[name].reduce((out, [from, role]) => out.split(`fill="${from}"`).join(`fill="${shade[role]}"`), svg);
}
const tintable = name => !!TINTABLE[name];

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
  if (d.length) g.appendChild(S('path', { d: d.join(''), stroke: colour, 'stroke-width': Math.max(4, sp * 0.36), 'stroke-linecap': 'round' }));
  return g;
}
const tallyWidth = (n, sp) => Math.floor(n / 5) * (5.6 * sp) + (n % 5) * sp;

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-charts', `
    .w-charts { width: 100%; height: 100%; }
    .w-charts .ctl { cursor: pointer; }
    .w-charts .ctl .face { transition: transform .08s ease; }
    .w-charts .ctl.down .face { transform: translateY(4px); }
    .w-charts .deco { pointer-events: none; }
    @media (prefers-reduced-motion: reduce) { .w-charts .ctl .face { transition: none; } }
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
  const idxList = v => (v === 'all' ? cats().map((_, i) => i) : Array.isArray(v) ? v.map(Number) : v === null || v === undefined || v === '' || v === false ? [] : [+v]);
  const lit = i => idxList(p.highlight).includes(i);
  const focused = i => idxList(p.focus).includes(i);
  const banded = i => lit(i) || focused(i);
  const ghostOf = i => (Array.isArray(p.ghost) ? Math.max(0, Math.round(+p.ghost[i] || 0)) : 0);
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

  // A Synthesis-style push button (white face, light border, solid bottom edge) with an ink + or -.
  function pmButton(x, y, s, sign, i) {
    const g = S('g', { class: 'ctl pm', role: 'button', 'aria-label': `${sign > 0 ? 'Add' : 'Take away'} ${cats()[i].label}` }, [
      S('rect', { x, y: y + 5, width: s, height: s, rx: 14, fill: COL.line }),
      S('g', { class: 'face' }, [
        S('rect', { x, y, width: s, height: s, rx: 14, fill: COL.surface, stroke: COL.line, 'stroke-width': 3 }),
        S('path', { d: sign > 0 ? `M${f1(x + s / 2)} ${f1(y + s * 0.27)}V${f1(y + s * 0.73)}M${f1(x + s * 0.27)} ${f1(y + s / 2)}H${f1(x + s * 0.73)}` : `M${f1(x + s * 0.27)} ${f1(y + s / 2)}H${f1(x + s * 0.73)}`, stroke: COL.ink, 'stroke-width': 6, 'stroke-linecap': 'round' }),
      ]),
    ]);
    const up = () => g.classList.remove('down');
    g.addEventListener('pointerdown', () => g.classList.add('down'));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => g.addEventListener(t, up));
    unbinds.push(onTap(g, () => bump(i, sign)));
    root.appendChild(g);
  }

  function drawArt(name, x, y, size, clipW = 1, tint = null) {
    const g = S('g', { class: 'deco', transform: `translate(${f1(x)} ${f1(y)}) scale(${(size / 100).toFixed(4)})` });
    if (clipW < 1) {
      const cid = `w-ch-${id}-${Math.round(x)}-${Math.round(y)}`;
      g.appendChild(S('defs', {}, [S('clipPath', { id: cid }, [S('rect', { x: 0, y: 0, width: 100 * clipW, height: 100 })])]));
      const inner = S('g', { 'clip-path': `url(#${cid})` });
      inner.innerHTML = tintedArt(name, tint);
      g.appendChild(inner);
    } else g.innerHTML = tintedArt(name, tint);
    root.appendChild(g);
  }

  function labelCell(c, x, yMid, rowH, maxW) {
    let tx = x;
    const s = Math.min(rowH * 0.7, 52);
    if (c.icon && kind() !== 'pictogram') { drawArt(c.icon, tx, yMid - s / 2, s, 1, c.colour); tx += s + 10; }
    // A colour swatch, unless the icon itself already shows the colour.
    if (c.colour && !(c.icon && kind() !== 'pictogram' && tintable(c.icon))) { root.appendChild(S('circle', { class: 'deco', cx: tx + 14, cy: yMid, r: 14, fill: c.col, stroke: COL.ink, 'stroke-width': 3 })); tx += 38; }
    const room = maxW - (tx - x);
    const fs = clamp(room / Math.max(1, c.label.length * 0.6), 18, 27);
    root.appendChild(S('text', { class: 'deco', x: tx, y: yMid + fs * 0.36, 'font-family': FONT.display, 'font-weight': 600, 'font-size': f1(fs), fill: COL.ink }, [c.label]));
  }

  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    const cs = cats();
    const top = p.title ? 54 : 12;
    const title = cx => {
      if (p.title) root.appendChild(S('text', { class: 'deco', x: f1(cx), y: 36, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 26, fill: COL.ink }, [String(p.title)]));
    };
    root.setAttribute('viewBox', `0 0 ${W} ${H}`);
    if (!cs.length) { title(W / 2); return; }
    if (kind() === 'block') {
      // Read-only diagrams keep columns close together and crop the view to them, so they draw bigger.
      const right = drawBlock(cs, top);
      const titleW = p.title ? String(p.title).length * 16 + 40 : 0;
      const vw = Math.min(W, Math.max(right + 8, titleW));
      title(titleW > right + 8 ? vw / 2 : (86 + right) / 2);
      if (vw < W) root.setAttribute('viewBox', `0 0 ${Math.round(vw)} ${H}`);
      return;
    }
    // Fit the viewBox to the rows (and, when read-only, to their width) so short charts fill small option tiles.
    // In a big space keep a sensible minimum size so a one-row chart does not become giant.
    const { bottom, right } = drawRows(cs, top);
    const rightAll = Math.max(right, p.title ? String(p.title).length * 16 + 40 : 0);
    title(rightAll / 2);
    const small = el.clientWidth > 0 && el.clientWidth < 420;
    const vw = Math.max(rightAll, small ? 0 : 600), vh = Math.min(H, Math.max(bottom + 12, small ? 0 : 200));
    root.setAttribute('viewBox', `${f1(-(vw - rightAll) / 2)} 0 ${f1(vw)} ${Math.round(vh)}`);
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
    // Label column as wide as the longest label needs (icon, swatch and word).
    const sIcon = Math.min(rowH * 0.7, 52);
    const labNeed = Math.max(...cs.map(c => 14 + (c.icon && k !== 'pictogram' ? sIcon + 10 : 0) + (c.colour ? 38 : 0) + c.label.length * 26 * 0.6 + 10));
    const labW = clamp(Math.ceil(labNeed), 150, 230), givenW = given ? 130 : 0;
    const x0 = 20, xData = x0 + labW + givenW + 10;
    // Read-only charts are only as wide as their longest row; interactive ones leave room for the buttons.
    const maxV = Math.max(1, ...values, ...cs.map((c, i) => ghostOf(i)));
    const litRoom = k !== 'table' && cs.some((c, i) => lit(i)) ? 56 : 0;
    const need = litRoom + (k === 'tally' ? 12 + tallyWidth(maxV, 17) + 26 : k === 'table' ? 160 : 14 + Math.ceil(maxV / key()) * (Math.min(rowH * 0.78, 58) + 6));
    const xEnd = inter ? W - 160 : Math.min(W - 20, xData + Math.max(150, need));
    const y0 = top + headH;
    const tableW = k === 'table' ? Math.min(xEnd, xData + 160) : xEnd;
    const btnX = Math.min(W - 150, tableW + 24); // - and + sit just right of the table
    // Frame and row lines.
    const fx = x0 - 8, fw = tableW - x0 + 16, fy = y0 - headH, fh = rowH * n + headH;
    root.appendChild(S('rect', { class: 'deco', x: fx, y: fy, width: fw, height: fh, rx: 14, fill: COL.surface }));
    cs.forEach((c, i) => {
      if (banded(i)) root.appendChild(S('rect', { class: 'deco', x: fx + 5, y: f1(y0 + i * rowH + 5), width: fw - 10, height: f1(rowH - 10), rx: 12, fill: COL.focusSoft, stroke: COL.focus, 'stroke-width': 4 }));
    });
    if (headH) {
      // Heading band: soft grey with rounded top corners.
      root.appendChild(S('path', { class: 'deco', d: `M${fx} ${y0}V${fy + 14}Q${fx} ${fy} ${fx + 14} ${fy}H${fx + fw - 14}Q${fx + fw} ${fy} ${fx + fw} ${fy + 14}V${y0}Z`, fill: COL.surface2 }));
    }
    for (let i = 1; i < n; i++) root.appendChild(S('line', { class: 'deco', x1: fx, y1: y0 + i * rowH, x2: fx + fw, y2: y0 + i * rowH, stroke: COL.line, 'stroke-width': 3 }));
    if (headH) root.appendChild(S('line', { class: 'deco', x1: fx, y1: y0, x2: fx + fw, y2: y0, stroke: COL.lineStrong, 'stroke-width': 3 }));
    root.appendChild(S('line', { class: 'deco', x1: x0 + labW, y1: fy, x2: x0 + labW, y2: y0 + rowH * n, stroke: COL.line, 'stroke-width': 3 }));
    if (given) root.appendChild(S('line', { class: 'deco', x1: x0 + labW + givenW, y1: fy, x2: x0 + labW + givenW, y2: y0 + rowH * n, stroke: COL.line, 'stroke-width': 3 }));
    root.appendChild(S('rect', { class: 'deco', x: fx, y: fy, width: fw, height: fh, rx: 14, fill: 'none', stroke: COL.lineStrong, 'stroke-width': 3 }));
    if (headH) {
      const [h1 = '', h2 = ''] = p.heads.map(String);
      root.appendChild(S('text', { class: 'deco', x: x0 + 6, y: y0 - 16, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 22, fill: COL.ink2 }, [h1]));
      root.appendChild(S('text', { class: 'deco', x: xData + 70, y: y0 - 16, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 22, fill: COL.ink2 }, [h2]));
    }
    cs.forEach((c, i) => {
      const yMid = y0 + (i + 0.5) * rowH;
      labelCell(c, x0, yMid, rowH, labW - 14);
      if (given) {
        const gv = Math.max(0, Math.round(+given[i] || 0));
        if (p.givenAs === 'tally') {
          const sp = Math.min(13, (givenW - 20) / Math.max(1, tallyWidth(gv, 1)));
          root.appendChild(tallyMarks(gv, x0 + labW + 14, yMid - rowH * 0.25, rowH * 0.5, sp, PAL.blue));
        } else root.appendChild(S('text', { class: 'deco', x: x0 + labW + givenW / 2, y: yMid + 11, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 32, fill: PAL.blue }, [String(gv)]));
      }
      const v = values[i];
      const avail = xEnd - xData - 10;
      const avail2 = avail - litRoom;
      const litNum = x => { if (lit(i)) root.appendChild(S('text', { class: 'deco', x: f1(x + 14), y: f1(yMid + 12), 'font-family': FONT.display, 'font-weight': 800, 'font-size': 34, fill: COL.focus }, [String(v)])); };
      if (k === 'tally') {
        const gv = ghostOf(i);
        const sp = Math.min(17, avail2 / Math.max(1, tallyWidth(Math.max(v, gv), 1)));
        // With gate numbers on, the marks sit a little lower so a small number fits over each gate.
        const showGates = !!p.gates && (focused(i) || !idxList(p.focus).length) && v >= 5;
        const ty = showGates ? yMid - rowH * 0.12 : yMid - rowH * 0.3, th = showGates ? rowH * 0.46 : rowH * 0.6;
        if (gv) root.appendChild(tallyMarks(gv, xData + 12, ty, th, sp, COL.lineStrong));
        root.appendChild(tallyMarks(v, xData + 12, ty, th, sp));
        if (showGates) {
          for (let gk = 0; gk < Math.floor(v / 5); gk++) {
            const gx = xData + 12 + gk * 5.6 * sp + 1.5 * sp;
            root.appendChild(S('text', { class: 'deco', x: f1(gx), y: f1(ty - 7), 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 24, fill: COL.focus }, [String((gk + 1) * 5)]));
          }
        }
        litNum(xData + 12 + tallyWidth(v, sp));
      } else if (k === 'table') {
        root.appendChild(S('text', { class: 'deco', x: xData + 70, y: yMid + 12, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 34, fill: COL.ink }, [String(v)]));
      } else {
        const kk = key();
        const full = Math.floor(v / kk), part = (v % kk) / kk;
        const count = full + (part > 0 ? 1 : 0);
        const gv = ghostOf(i), gFull = Math.floor(gv / kk), gPart = (gv % kk) / kk, gCount = gFull + (gPart > 0 ? 1 : 0);
        const room = Math.max(count, gCount);
        const size = Math.min(rowH * 0.78, 58, room ? (avail2 - 4) / room - 6 : 58);
        const icon = p.icon || c.icon || 'star';
        // Ghost pictures: faded, to build over.
        for (let j = count; j < gCount; j++) {
          const gg = S('g', { class: 'deco', opacity: 0.22 });
          root.appendChild(gg);
          drawArt(icon, xData + 8 + j * (size + 6), yMid - size / 2, size, j < gFull ? 1 : gPart, c.colour);
          gg.appendChild(root.lastChild);
        }
        for (let j = 0; j < count; j++) drawArt(icon, xData + 8 + j * (size + 6), yMid - size / 2, size, j < full ? 1 : part, c.colour);
        litNum(xData + 8 + count * (size + 6) - 6);
      }
      if (inter) {
        const s = clamp(rowH - 10, 56, 64);
        pmButton(btnX, yMid - s / 2, s, -1, i);
        pmButton(btnX + s + 10, yMid - s / 2, s, 1, i);
      }
    });
    if (k === 'pictogram') {
      // Key box: [icon] = n
      const kk = key();
      const icon = p.icon || cs.find(c => c.icon)?.icon || 'star';
      const bx = x0, by = Math.min(H - keyH + 8, y0 + rowH * n + 14), bh = keyH - 16;
      const fk = !!p.focusKey;
      // Rows with different pictures (aliens, robots...) get a worded key: "1 picture = 2".
      const mixed = !p.icon && new Set(cs.map(c => c.icon).filter(Boolean)).size > 1;
      const kw = mixed ? 300 : 210;
      root.appendChild(S('rect', { class: 'deco', x: bx, y: by, width: kw, height: bh, rx: 14, fill: fk ? COL.focusSoft : COL.surface2, stroke: fk ? COL.focus : COL.lineStrong, 'stroke-width': fk ? 5 : 3 }));
      root.appendChild(S('text', { class: 'deco', x: bx + 14, y: by + bh / 2 + 9, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 24, fill: COL.ink2 }, ['Key:']));
      if (mixed) root.appendChild(S('text', { class: 'deco', x: bx + 78, y: by + bh / 2 + 10, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 27, fill: COL.ink }, [`1 picture = ${kk}`]));
      else {
        drawArt(icon, bx + 78, by + (bh - 44) / 2, 44);
        root.appendChild(S('text', { class: 'deco', x: bx + 130, y: by + bh / 2 + 11, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: COL.ink }, [`= ${kk}`]));
      }
      return { bottom: by + bh, right: inter ? btnX + 150 : Math.max(tableW + 8, bx + kw) + 12 };
    }
    return { bottom: y0 + rowH * n, right: inter ? btnX + 150 : tableW + 20 };
  }

  function drawBlock(cs, top) {
    const n = cs.length;
    const inter = interactive();
    const given = Array.isArray(p.given) ? p.given : null;
    const max = blockMax();
    const step = [1, 2, 5, 10].includes(+p.axisStep) ? +p.axisStep : max <= 10 ? 1 : max <= 20 ? 2 : max <= 50 ? 5 : 10;
    const x0 = 86, x1 = inter ? W - 16 : Math.min(W - 16, x0 + n * 150);
    const labelH = 64 + (given ? 46 : 0);
    const btnH = inter ? 72 : 0;
    const yTop = top + 14, yBot = H - labelH - btnH - 6;
    const unit = (yBot - yTop) / max;
    // Grid lines and axis labels.
    for (let v = 0; v <= max; v += step) {
      const y = yBot - v * unit;
      if (v > 0) root.appendChild(S('line', { class: 'deco', x1: x0, y1: f1(y), x2: x1, y2: f1(y), stroke: COL.line, 'stroke-width': 2 }));
      root.appendChild(S('text', { class: 'deco', x: x0 - 14, y: f1(y + 8), 'text-anchor': 'end', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 22, fill: COL.ink2 }, [String(v)]));
    }
    const colW = (x1 - x0) / n;
    const bw = Math.min(colW * 0.62, 96);
    cs.forEach((c, i) => {
      if (!banded(i)) return;
      const cx = x0 + (i + 0.5) * colW, bx = Math.max(x0 + 4, cx - colW * 0.46);
      root.insertBefore(S('rect', { class: 'deco', x: f1(bx), y: f1(yTop - 22), width: f1(Math.min(colW * 0.92, x1 - bx)), height: f1(yBot - yTop + 70), rx: 14, fill: COL.focusSoft, stroke: COL.focus, 'stroke-width': 4 }), root.firstChild);
    });
    cs.forEach((c, i) => {
      const cx = x0 + (i + 0.5) * colW;
      const v = Math.min(values[i], max);
      // Blocks: one square-ish block per item.
      const g = S('g', { class: 'deco' });
      const gv = Math.min(ghostOf(i), max);
      // Ghost: a dashed outline of the target column, to build up to.
      if (gv > v) g.appendChild(S('rect', { x: f1(cx - bw / 2), y: f1(yBot - gv * unit), width: f1(bw), height: f1((gv - v) * unit), fill: COL.focusSoft, stroke: COL.focus, 'stroke-width': 3.5, 'stroke-dasharray': '10 7' }));
      for (let b = 0; b < v; b++) {
        g.appendChild(S('rect', { x: f1(cx - bw / 2), y: f1(yBot - (b + 1) * unit), width: f1(bw), height: f1(unit), fill: c.col, stroke: COL.ink, 'stroke-width': f1(clamp(unit * 0.12, 1.5, 3)), 'stroke-linejoin': 'round' }));
      }
      root.appendChild(g);
      if (lit(i)) {
        // The number sits just above the column (or inside its top block when the column reaches the top).
        const above = yBot - v * unit - 12, room = above - 28 >= yTop - 22;
        root.appendChild(S('text', { class: 'deco', x: f1(cx), y: f1(room ? above : yBot - v * unit + 34), 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 34, fill: room ? COL.focus : '#fff', ...(room ? {} : { stroke: COL.focus, 'stroke-width': 8, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }) }, [String(values[i])]));
      }
      // Label (and icon) under the column.
      const ly = yBot + 34;
      const iconW = c.icon ? 34 : 0;
      const fs = clamp((colW - 10 - iconW) / Math.max(1, c.label.length * 0.6), 16, 24);
      const textW = c.label.length * fs * 0.6;
      const sx = cx - (iconW + textW) / 2;
      if (c.icon) drawArt(c.icon, sx, ly - 24, 30, 1, c.colour);
      root.appendChild(S('text', { class: 'deco', x: f1(sx + iconW), y: f1(ly), 'font-family': FONT.display, 'font-weight': 600, 'font-size': f1(fs), fill: COL.ink, textLength: textW > colW - iconW - 6 ? f1(colW - iconW - 6) : null, lengthAdjust: 'spacingAndGlyphs' }, [c.label]));
      if (given) {
        const gv = Math.max(0, Math.round(+given[i] || 0));
        if (p.givenAs === 'tally') {
          const sp = Math.min(11, (colW - 20) / Math.max(1, tallyWidth(gv, 1)));
          const tw = tallyWidth(gv, sp);
          root.appendChild(tallyMarks(gv, cx - tw / 2 + sp * 0.3, ly + 14, 28, sp, PAL.blue));
        } else root.appendChild(S('text', { class: 'deco', x: f1(cx), y: f1(ly + 40), 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: PAL.blue }, [String(gv)]));
      }
      if (inter) {
        const s = Math.min(60, (colW - 12) / 2);
        const by = H - btnH + 4;
        pmButton(cx - s - 4, by, s, -1, i);
        pmButton(cx + 4, by, s, 1, i);
      }
    });
    // Guide lines: from the top of a column, a dashed blue line across to the number axis.
    cs.forEach((c, i) => {
      if (!idxList(p.guide).includes(i)) return;
      const v = Math.min(values[i], max);
      if (v <= 0) return;
      const cx = x0 + (i + 0.5) * colW, y = yBot - v * unit;
      root.appendChild(S('path', { class: 'deco', d: `M${f1(cx + bw / 2)} ${f1(y)}H${x0 + 8}`, fill: 'none', stroke: COL.focus, 'stroke-width': 5, 'stroke-dasharray': '12 9', 'stroke-linecap': 'round' }));
      root.appendChild(S('path', { class: 'deco', d: `M${x0 + 4} ${f1(y)}l14 -10v20Z`, fill: COL.focus }));
    });
    // Axes in ink, on top of the blocks.
    root.appendChild(S('path', { class: 'deco', d: `M${x0} ${f1(yTop - 6)}V${f1(yBot)}H${x1}`, fill: 'none', stroke: COL.ink, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    return x1;
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
