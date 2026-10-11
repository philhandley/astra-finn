// pattern: a row of shapes, colours or turned arrows in a repeating pattern, with a gap to fill or the next items to build.
// Look (style v2): shapes are flat outlined stickers; the gap is a dashed blue box with a blue "?"; palette tiles are white push buttons.
// Props: items (array of { shape, colour, rotate } using shapes2d names and colour names, or { art, rotate } using art names),
//        gap (an index shown as a "?" slot, or 'end' for empty slots after the row), slots (how many 'end' slots, default 1),
//        interactive (tap a palette tile to fill the next empty slot; tap a filled slot to clear it and the ones after),
//        palette (array of items to build with), unit (draw a bracket under every `unit` items to show the repeat),
//        filled (items already placed in the slots, e.g. to reveal an answer), readonly.
// State: { filled, count, lastShape, lastColour, lastRotate, seq }
//        filled = items placed so far; lastShape is the shape (or art) name of the last one; seq = keys like "circle-yellow" or "arrow-blue-r90".
// Debug: dev/harness.html?widget=pattern&props={"items":[{"shape":"circle","colour":"yellow"},{"shape":"square","colour":"blue"}],"gap":"end","interactive":true,"palette":[{"shape":"circle","colour":"yellow"},{"shape":"square","colour":"blue"}]}
import { S, svgRoot, onTap, injectCSS, clamp } from '../core/dom.js';
import { artInner } from '../core/art.js';
import { COL, PAL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';
import { shapePathFit, colourOf, SHAPES2D, OUTLINE } from './shapes2d.js';

export const meta = {
  title: 'Patterns',
  playground: {
    items: [{ shape: 'circle', colour: 'yellow' }, { shape: 'triangle', colour: 'blue' }, { shape: 'circle', colour: 'yellow' }, { shape: 'triangle', colour: 'blue' }, { shape: 'circle', colour: 'yellow' }],
    gap: 'end', slots: 3, interactive: true,
    palette: [{ shape: 'circle', colour: 'yellow' }, { shape: 'triangle', colour: 'blue' }, { shape: 'square', colour: 'pink' }],
  },
  state: ['filled', 'count', 'lastShape', 'lastColour', 'lastRotate', 'seq'],
};

const W = 800, H = 500;
const normRot = r => ((Math.round(+r || 0) % 360) + 360) % 360;
const f1 = v => Math.round(v * 10) / 10;
// A short key for an item: "circle-yellow", "arrow-blue-r90", "rocket".
export function patternKey(it) {
  if (!it) return '';
  const parts = [it.shape || it.art || '?'];
  if (it.colour) parts.push(it.colour);
  if (normRot(it.rotate)) parts.push('r' + normRot(it.rotate));
  return parts.join('-');
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-pattern', `
    .w-pattern { width: 100%; height: 100%; }
    .w-pattern .tile, .w-pattern .slot.full { cursor: pointer; }
    .w-pattern .ctl .face { transition: transform .08s ease; }
    .w-pattern .ctl.down .face { transform: translateY(4px); }
    .w-pattern .deco { pointer-events: none; }
    .w-pattern .pop { animation: w-pattern-pop .25s ease; transform-box: fill-box; transform-origin: center; }
    @keyframes w-pattern-pop { from { transform: scale(.6); opacity: .3; } }
    @media (prefers-reduced-motion: reduce) { .w-pattern .pop { animation: none; } .w-pattern .ctl .face { transition: none; } }
  `);
  let p = { ...props };
  let filled = [];
  let justPlaced = -1;
  const root = svgRoot(W, H, 'w-pattern');
  el.appendChild(root);
  const unbinds = [];
  // readonly: false arriving through update() (a hint) switches interaction on even if mounted readonly.
  const ro = () => (p.readonly === false ? false : !!(p.readonly || ctx.readonly));
  const items = () => (Array.isArray(p.items) ? p.items : []).filter(Boolean).slice(0, 16);
  const gapIdx = () => (p.gap === 'end' ? -1 : Number.isInteger(+p.gap) && p.gap !== null && p.gap !== '' && +p.gap >= 0 && +p.gap < items().length ? +p.gap : null);
  const endSlots = () => (p.gap === 'end' ? clamp(Math.round(+p.slots || 1), 1, 8) : 0);
  const nSlots = () => (p.gap === 'end' ? endSlots() : gapIdx() !== null ? 1 : 0);
  const palette = () => (Array.isArray(p.palette) ? p.palette : []).filter(Boolean).slice(0, 6);

  function drawItem(it, cx, cy, size, extra = {}) {
    if (!it) return null;
    if (it.art) {
      const g = S('g', { class: 'deco', transform: `translate(${cx} ${cy}) rotate(${normRot(it.rotate)}) translate(${-size / 2} ${-size / 2}) scale(${(size / 100).toFixed(4)})`, ...extra });
      g.innerHTML = artInner(it.art);
      return g;
    }
    const shape = SHAPES2D.includes(it.shape) ? it.shape : 'circle';
    return S('path', { class: 'deco', d: shapePathFit(shape, normRot(it.rotate), cx, cy, size), fill: colourOf(it.colour), ...OUTLINE, ...extra });
  }

  function changed() { draw(); ctx.onChange && ctx.onChange(api.getState()); }

  function place(it) {
    const n = nSlots();
    if (!n) return;
    if (filled.length < n) filled.push({ ...it });
    else if (p.gap !== 'end') filled = [{ ...it }];
    else { sfx('tick'); return; }
    justPlaced = filled.length - 1;
    sfx('pop');
    changed();
  }

  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    const its = items();
    const g = gapIdx();
    const inter = !!p.interactive && !ro() && palette().length > 0 && nSlots() > 0;
    // The row: items, with the gap slot replacing one item or extra slots at the end.
    const row = its.map((it, i) => (i === g ? { slot: 0 } : { it }));
    for (let k = 0; k < endSlots(); k++) row.push({ slot: k });
    const n = Math.max(row.length, 1);
    const cell = Math.min(112, (W - 40) / n);
    const size = cell * 0.74;
    const x0 = (W - cell * n) / 2;
    const cy = inter ? 160 : 230;
    row.forEach((r, i) => {
      const cx = x0 + (i + 0.5) * cell;
      if (r.it) { root.appendChild(drawItem(r.it, cx, cy, size)); return; }
      const f = filled[r.slot];
      const next = !f && (r.slot === filled.length || p.gap !== 'end');
      const sg = S('g', { class: 'slot' + (f ? ' full' : '') });
      // The gap to fill: dashed blue with a blue "?". Filled: solid blue edge (selected). Later empty slots: faint dashes.
      sg.appendChild(S('rect', { x: cx - cell * 0.46, y: cy - cell * 0.46, width: cell * 0.92, height: cell * 0.92, rx: 14,
        fill: f || next ? COL.focusSoft : COL.surface, stroke: f || next ? COL.focus : COL.lineStrong, 'stroke-width': 3.5, 'stroke-dasharray': f ? null : '10 7' }));
      if (f) sg.appendChild(drawItem(f, cx, cy, size, r.slot === justPlaced ? { class: 'deco pop' } : {}));
      else if (next) sg.appendChild(S('text', { class: 'deco', x: cx, y: cy + Math.min(18, cell * 0.2), 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 800, 'font-size': Math.min(52, cell * 0.55), fill: COL.focus }, ['?']));
      if (f && inter) {
        unbinds.push(onTap(sg, () => { filled = filled.slice(0, r.slot); justPlaced = -1; sfx('click'); changed(); }));
      }
      root.appendChild(sg);
    });
    // Repeat brackets.
    const u = Math.round(+p.unit || 0);
    if (u >= 1 && u < n) {
      for (let s = 0; s + u <= n; s += u) {
        const xa = x0 + s * cell + 8, xb = x0 + (s + u) * cell - 8, yb = cy + cell * 0.55;
        root.appendChild(S('path', { class: 'deco', d: `M${xa} ${yb}v12H${xb}v-12`, fill: 'none', stroke: COL.ink2, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      }
    }
    // Read-only rows: fit the view to the row so it fills small option tiles (with a minimum size in big spaces).
    if (!inter) {
      const pad = 18 + cell * 0.55;
      const cw = cell * n + 16, ch = pad * 2;
      const small = el.clientWidth > 0 && el.clientWidth < 420;
      const vw = Math.max(cw, small ? 0 : 700), vh = Math.max(ch, small ? 0 : 300);
      root.setAttribute('viewBox', `${f1(x0 - 8 - (vw - cw) / 2)} ${f1(cy - vh / 2)} ${f1(vw)} ${f1(vh)}`);
    } else root.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // Palette.
    if (inter) {
      const pal = palette();
      const ts = Math.min(104, (W - 40) / pal.length - 14);
      const total = pal.length * ts + (pal.length - 1) * 14;
      const px = (W - total) / 2, py = 330;
      root.appendChild(S('line', { class: 'deco', x1: 30, y1: 300, x2: W - 30, y2: 300, stroke: COL.line, 'stroke-width': 3 }));
      pal.forEach((it, i) => {
        const x = px + i * (ts + 14);
        // White push button (light border, solid bottom edge) holding the shape.
        const face = S('g', { class: 'face' }, [S('rect', { x, y: py, width: ts, height: ts, rx: 18, fill: COL.surface, stroke: COL.line, 'stroke-width': 3 })]);
        face.appendChild(drawItem(it, x + ts / 2, py + ts / 2, ts * 0.64));
        const tile = S('g', { class: 'ctl tile', role: 'button', 'aria-label': patternKey(it) }, [
          S('rect', { x, y: py + 5, width: ts, height: ts, rx: 18, fill: COL.line }), face,
        ]);
        const up = () => tile.classList.remove('down');
        tile.addEventListener('pointerdown', () => tile.classList.add('down'));
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => tile.addEventListener(t, up));
        unbinds.push(onTap(tile, () => place(it)));
        root.appendChild(tile);
      });
    }
  }

  const api = {
    getState() {
      const last = filled[filled.length - 1] || null;
      return {
        filled: filled.map(f => ({ ...f })),
        count: filled.length,
        lastShape: last ? (last.shape || last.art || null) : null,
        lastColour: last ? (last.colour || null) : null,
        lastRotate: last ? normRot(last.rotate) : null,
        seq: filled.map(patternKey),
      };
    },
    update(np = {}) {
      p = { ...p, ...np };
      if ('items' in np || 'gap' in np || 'slots' in np || 'palette' in np) filled = [];
      if (Array.isArray(np.filled)) filled = np.filled.filter(Boolean).slice(0, nSlots()).map(it => ({ ...it }));
      justPlaced = -1;
      draw();
    },
    // "Show me" accepts a list of items or keys, or a goal: { seq: [...] }, { lastShape, lastColour, lastRotate }
    // (places a matching palette tile in the next slot) or { count: n } (carries the repeat on for n slots).
    showAnswer(answer) {
      const byKey = k => [...palette(), ...items()].find(it => patternKey(it) === k);
      let list = [];
      if (Array.isArray(answer)) list = answer.map(a => (typeof a === 'string' ? byKey(a) : a));
      else if (typeof answer === 'string') list = [byKey(answer)];
      else if (answer && typeof answer === 'object' && (answer.shape || answer.art)) list = [answer];
      else if (answer && typeof answer === 'object') {
        if (Array.isArray(answer.seq)) list = answer.seq.map(byKey);
        else if (answer.lastShape || answer.lastColour || answer.lastRotate !== undefined) {
          const fits = it => (!answer.lastShape || (it.shape || it.art) === answer.lastShape) && (!answer.lastColour || it.colour === answer.lastColour)
            && (answer.lastRotate === undefined || normRot(it.rotate) === normRot(answer.lastRotate));
          const it = palette().find(fits) || items().find(fits);
          if (it) list = filled.length < nSlots() ? [...filled, it] : [...filled.slice(0, -1), it];
        } else if (answer.count !== undefined) {
          let n = answer.count;
          if (n && typeof n === 'object') n = n.eq ?? n.gte ?? n.lte;
          // With no row to carry on (Finn makes his own), show an AB pattern from the first two palette tiles.
          const its = items().length ? items() : palette().slice(0, 2);
          // The repeating unit: the `unit` prop, or the shortest block that repeats through the row.
          let k = Math.round(+p.unit || 0);
          if (!(k > 0)) { k = its.length || 1; for (let c = 1; c <= its.length; c++) if (its.every((it, i) => patternKey(it) === patternKey(its[i % c]))) { k = c; break; } }
          list = Array.from({ length: clamp(Math.round(+n || 0), 0, nSlots()) }, (_, j) => its[(its.length + j) % k]);
        }
      }
      list = list.filter(Boolean);
      if (!list.length) return;
      filled = list.slice(0, nSlots()).map(it => ({ ...it }));
      justPlaced = filled.length - 1;
      changed();
    },
    destroy() { unbinds.splice(0).forEach(u => u()); el.replaceChildren(); },
  };
  if (Array.isArray(p.filled)) filled = p.filled.filter(Boolean).slice(0, nSlots()).map(it => ({ ...it }));
  draw();
  return api;
}
