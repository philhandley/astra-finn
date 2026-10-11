// tensframe: one or two tens frames with gold and cyan counters. Reference widget for ENGINE.md.
// Props: count, frames (1 | 2; default 2 when count or max is over 10), colours ([red, yellow] counts; overrides count),
//        twoColour (show the brush toggle), interactive (default true), max (10 or 20), readonly.
// Counters always fill in order: top row left to right, then the bottom row, then the next frame.
// Tap anywhere on a frame to add a counter in the next space. Tap a counter to take it away.
// State: { count, a, b, frames }  (a = red counters, b = yellow counters)
import { S, svgRoot, onTap, injectCSS, clamp } from '../core/dom.js';
import { COL } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Tens frame',
  playground: { count: 0, frames: 2, twoColour: true, interactive: true },
  state: ['count', 'a', 'b', 'frames'],
};

const W = 800, H = 500, CELL = 92, GAP = 34;

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-tensframe', `
    .w-tensframe { width: 100%; height: 100%; }
    .w-tensframe .frame { cursor: pointer; }
    .w-tensframe.ro .frame, .w-tensframe.ro .ctr { cursor: default; }
    .w-tensframe .ctr { cursor: pointer; transition: transform .18s ease; }
    .w-tensframe .brush { cursor: pointer; }
  `);
  let p = {};
  let cells = []; // colour keys in fill order: 'a' | 'b'
  let brush = 'a';
  const root = svgRoot(W, H, 'w-tensframe');
  el.appendChild(root);
  const unbinds = [];

  const ro = () => !!(p.readonly || ctx.readonly || p.interactive === false);
  const capacity = () => frames() * 10;
  const frames = () => clamp(p.frames || ((p.max || 0) > 10 || cells.length > 10 ? 2 : 1), 1, 2);

  function setFromProps(np) {
    p = { ...p, ...np };
    if ('colours' in np && Array.isArray(np.colours)) {
      const [a = 0, b = 0] = np.colours.map(v => clamp(Math.round(v) || 0, 0, 20));
      cells = [...Array(a).fill('a'), ...Array(b).fill('b')];
    } else if ('count' in np) {
      cells = Array(clamp(Math.round(np.count) || 0, 0, 20)).fill('a');
    }
    cells = cells.slice(0, capacity());
  }

  function changed() { draw(); ctx.onChange && ctx.onChange(api.getState()); }

  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    root.classList.toggle('ro', ro());
    const nF = frames();
    const fw = CELL * 5, fh = CELL * 2;
    const totalH = nF * fh + (nF - 1) * GAP;
    const ox = (W - fw) / 2 - (p.twoColour && !ro() ? 60 : 0), oy = (H - totalH) / 2;
    for (let f = 0; f < nF; f++) {
      const fy = oy + f * (fh + GAP);
      const frame = S('g', { class: 'frame' });
      frame.appendChild(S('rect', { x: ox - 8, y: fy - 8, width: fw + 16, height: fh + 16, rx: 16, fill: COL.surface, stroke: COL.ink, 'stroke-width': 5 }));
      for (let k = 0; k < 10; k++) {
        const cx = ox + (k % 5) * CELL, cy = fy + Math.floor(k / 5) * CELL;
        frame.appendChild(S('rect', { x: cx, y: cy, width: CELL, height: CELL, fill: 'none', stroke: COL.lineStrong, 'stroke-width': 3 }));
      }
      if (!ro()) {
        unbinds.push(onTap(frame, () => {
          if (cells.length >= capacity()) return;
          cells.push(brush);
          sfx('pop');
          changed();
        }));
      }
      root.appendChild(frame);
      for (let k = 0; k < 10; k++) {
        const idx = f * 10 + k;
        if (idx >= cells.length) break;
        const cx = ox + (k % 5) * CELL + CELL / 2, cy = fy + Math.floor(k / 5) * CELL + CELL / 2;
        const c = S('circle', { class: 'ctr', cx, cy, r: CELL * 0.37, fill: cells[idx] === 'a' ? COL.a : COL.b, stroke: cells[idx] === 'a' ? COL.aDark : COL.bDark, 'stroke-width': 4 });
        if (!ro()) {
          unbinds.push(onTap(c, e => {
            e.stopPropagation && e.stopPropagation();
            cells.splice(idx, 1);
            sfx('click');
            changed();
          }));
          // Stop the frame's tap from also adding a counter.
          c.addEventListener('pointerdown', e => e.stopPropagation());
          c.addEventListener('pointerup', e => e.stopPropagation());
        }
        root.appendChild(c);
      }
    }
    if (p.twoColour && !ro()) {
      const bx = ox + fw + 110;
      ['a', 'b'].forEach((key, i) => {
        const by = H / 2 - 50 + i * 100;
        const g = S('g', { class: 'brush' });
        g.appendChild(S('circle', { cx: bx, cy: by, r: 42, fill: COL.surface, stroke: brush === key ? COL.ink : COL.line, 'stroke-width': brush === key ? 6 : 3 }));
        g.appendChild(S('circle', { cx: bx, cy: by, r: 27, fill: key === 'a' ? COL.a : COL.b, stroke: key === 'a' ? COL.aDark : COL.bDark, 'stroke-width': 4 }));
        unbinds.push(onTap(g, () => { brush = key; sfx('click'); draw(); }));
        root.appendChild(g);
      });
    }
  }

  const api = {
    getState() {
      const a = cells.filter(c => c === 'a').length;
      return { count: cells.length, a, b: cells.length - a, frames: frames() };
    },
    update(np) { setFromProps(np); draw(); },
    showAnswer(answer) {
      if (typeof answer === 'number') { cells = Array(clamp(answer, 0, capacity())).fill('a'); draw(); }
    },
    destroy() { unbinds.splice(0).forEach(u => u()); el.replaceChildren(); },
  };
  setFromProps(props);
  draw();
  return api;
}
