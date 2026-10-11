// partwhole: the cherry (part-whole) diagram. Owner: addsub.
// Props:
//   whole                 the whole (top circle). Defaults to the sum of the parts.
//   parts                 [a, b] or [a, b, c].
//   hide                  'whole' | 0 | 1 | 2 | null: that circle shows a gold "?" instead of its number.
//   counters              'digits' (default) | 'dots' | 'both'. Dots are drawn only for numbers up to 20.
//   mode                  'display' (default) | 'split'.
//   readonly              no interaction.
// Split mode: the whole's counters sit in the part circles (all in part 0 unless valid parts are given).
//   Tap a part circle to move one counter to the other part (with three parts: to the next part).
//   Or drag a counter to the part you want. The part numbers update as counters move.
// State: { whole, parts, a, b, c (three parts only), ways }
//   a, b, c are the parts as top-level keys so tutor lines can say "{a} and {b}".
//   ways = how many different splits have been made so far (split mode), for goals like { "ways": { "gte": 5 } }.
// Debug: dev/harness.html?widget=partwhole&props={"whole":7,"mode":"split"}
//        dev/harness.html?widget=partwhole&props={"whole":10,"parts":[6,4],"hide":1,"counters":"both"}
import { S, svgRoot, injectCSS, clamp, drag } from '../core/dom.js';
import { COL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Part-whole',
  playground: { whole: 7, mode: 'split' },
  state: ['whole', 'parts', 'a', 'b', 'c', 'ways'],
};

const W = 800, H = 500;
const PART_COL = [COL.a, COL.b, '#6fe3a5'];
const GOLD = COL.tens;
const DARK = '#0c1430';

function geometry(n, split) {
  if (n === 3) {
    const r = split ? 116 : 100;
    return { whole: { x: 400, y: 98, r: 80 }, parts: [{ x: 140, y: 350, r }, { x: 400, y: 372, r }, { x: 660, y: 350, r }] };
  }
  if (split) return { whole: { x: 400, y: 94, r: 78 }, parts: [{ x: 205, y: 338, r: 145 }, { x: 595, y: 338, r: 145 }] };
  return { whole: { x: 400, y: 116, r: 92 }, parts: [{ x: 215, y: 352, r: 110 }, { x: 585, y: 352, r: 110 }] };
}

// Dot slots for n counters inside a circle of radius r, centred on 0,0.
function dotLayout(n, r) {
  if (n <= 0) return { pts: [], dr: 0 };
  let cols, rows;
  if (n <= 4) { cols = n; rows = 1; } else if (n <= 6) { cols = 3; rows = 2; } else if (n <= 8) { cols = 4; rows = 2; } else if (n <= 10) { cols = 5; rows = 2; } else if (n <= 12) { cols = 4; rows = 3; } else if (n <= 15) { cols = 5; rows = 3; } else { cols = 5; rows = 4; }
  const dist = Math.hypot((cols - 1) / 2, (rows - 1) / 2);
  const s = Math.min((0.9 * r) / (dist + 0.45), 0.62 * r);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const inRow = Math.min(cols, n - row * cols);
    pts.push({ x: (col - (inRow - 1) / 2) * s, y: (row - (rows - 1) / 2) * s });
  }
  return { pts, dr: s * 0.4 };
}

const num = v => { const x = Math.round(Number(v)); return Number.isFinite(x) ? clamp(x, 0, 999) : 0; };

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-partwhole', `
    .w-partwhole { width: 100%; height: 100%; }
    .w-partwhole .ctr { pointer-events: none; transition: transform .26s ease, fill .26s ease; }
    .w-partwhole .ctr.nt { transition: none; }
    .w-partwhole .hit { cursor: pointer; }
    .w-partwhole.ro .hit { cursor: default; }
    .w-partwhole .glow { animation: w-partwhole-glow 1.2s ease-in-out 2; }
    @keyframes w-partwhole-glow { 50% { stroke-width: 12; } }
    @media (prefers-reduced-motion: reduce) { .w-partwhole .ctr { transition: none; } .w-partwhole .glow { animation: none; } }
  `);
  let p = {};
  let whole = 0, parts = [0, 0], nParts = 2, split = false;
  let ctrs = []; // split mode: [{ el, part }]
  let ways = new Set();
  let revealed = null;
  const root = svgRoot(W, H, 'w-partwhole');
  el.appendChild(root);
  const unbinds = [];
  let gStatic, gCtr, gLab, gHit;

  const ro = () => !!(p.readonly || ctx.readonly);
  const hidden = i => (p.hide === 'whole'
    ? i === 'whole' && revealed !== 'whole'
    : p.hide !== null && p.hide !== undefined && p.hide !== '' && Number(p.hide) === i && revealed !== i);

  function setFromProps(np) {
    p = { ...p, ...np };
    split = p.mode === 'split';
    const given = Array.isArray(p.parts) ? p.parts.slice(0, 3).map(num) : null;
    nParts = given && given.length === 3 ? 3 : 2;
    if (split) {
      whole = clamp(num(p.whole ?? (given ? given.reduce((s, v) => s + v, 0) : 5)), 0, 20);
      const sum = given ? given.reduce((s, v) => s + v, 0) : -1;
      parts = given && sum === whole && given.length >= 2 ? given.slice(0, nParts) : (nParts === 3 ? [whole, 0, 0] : [whole, 0]);
    } else {
      parts = given && given.length >= 2 ? given.slice(0, nParts) : [num(p.whole ?? 0), 0];
      whole = p.whole !== undefined && p.whole !== null ? num(p.whole) : parts.reduce((s, v) => s + v, 0);
    }
    revealed = null;
    ways = new Set([parts.join(',')]);
  }

  function state() {
    const s = { whole, parts: parts.slice(), a: parts[0], b: parts[1], ways: ways.size };
    if (nParts === 3) s.c = parts[2];
    return s;
  }

  function changed() { refresh(); ways.add(parts.join(',')); ctx.onChange && ctx.onChange(state()); }

  function useDots(v) { const c = split ? 'both' : (p.counters || 'digits'); return (c === 'dots' || c === 'both') && v <= 20; }
  function useDigits(v) { const c = split ? 'both' : (p.counters || 'digits'); return c === 'digits' || c === 'both' || v > 20; }

  function circle(g, c, key, i) {
    const isHidden = hidden(key);
    const stroke = isHidden ? GOLD : key === 'whole' ? COL.ink : (split ? PART_COL[i] : COL.ink2);
    g.appendChild(S('circle', {
      cx: c.x, cy: c.y, r: c.r, fill: isHidden ? 'rgba(242,181,68,.08)' : 'rgba(255,255,255,.05)', stroke, 'stroke-width': key === 'whole' ? 5 : 4,
      'stroke-dasharray': isHidden ? '14 10' : null, class: revealed === key ? 'glow' : null,
    }));
  }

  function bigText(g, x, y, text, size, fill) {
    g.appendChild(S('text', { x, y: y + size * 0.35, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': size, fill }, [text]));
  }

  function badgePos(c, key, i) {
    if (key === 'whole') return { x: c.x + c.r + 16, y: c.y - c.r * 0.45 };
    if (nParts === 2) return { x: c.x + (i === 0 ? -1 : 1) * c.r * 0.76, y: c.y - c.r * 0.76 };
    return { x: c.x + (i === 0 ? -1 : 1) * c.r * 0.76, y: c.y - c.r * 0.76 };
  }

  function badge(g, c, key, i, v) {
    const b = badgePos(c, key, i);
    const isHidden = hidden(key);
    g.appendChild(S('circle', { cx: b.x, cy: b.y, r: 34, fill: COL.panel2, stroke: isHidden ? GOLD : key === 'whole' ? COL.ink : PART_COL[i], 'stroke-width': 4 }));
    bigText(g, b.x, b.y, isHidden ? '?' : String(v), String(v).length > 2 ? 30 : 40, isHidden ? GOLD : COL.ink);
  }

  // Number or "?" (and static dots in display mode) for one circle.
  function label(g, c, key, i, v) {
    const isHidden = hidden(key);
    const dotsHere = !isHidden && useDots(v) && !(split && key === 'whole');
    if (isHidden) {
      bigText(g, c.x, c.y, '?', c.r * 0.95, GOLD);
      return;
    }
    if (dotsHere) {
      if (!split) {
        const { pts, dr } = dotLayout(v, c.r);
        pts.forEach(q => g.appendChild(S('circle', { cx: c.x + q.x, cy: c.y + q.y, r: dr, fill: key === 'whole' ? COL.ink2 : PART_COL[i], stroke: 'rgba(0,0,0,.25)', 'stroke-width': 2 })));
      }
      if (useDigits(v) && (p.counters === 'both' || split)) badge(g, c, key, i, v);
      return;
    }
    const s = String(v);
    bigText(g, c.x, c.y, s, c.r * (s.length > 2 ? 0.62 : 0.86), COL.ink);
  }

  function slotsFor(i) {
    const geo = geometry(nParts, split);
    return dotLayout(whole, geo.parts[i].r);
  }

  function placeCounters() {
    if (!split) return;
    const geo = geometry(nParts, split);
    const idx = Array(nParts).fill(0);
    for (const c of ctrs) {
      const pc = geo.parts[c.part];
      const { pts, dr } = slotsFor(c.part);
      const q = pts[idx[c.part]++] || { x: 0, y: 0 };
      c.el.setAttribute('r', dr);
      c.el.style.transform = `translate(${pc.x + q.x}px, ${pc.y + q.y}px)`;
      c.el.style.fill = PART_COL[c.part];
    }
  }

  function refresh() {
    // Re-count parts from the counters in split mode.
    if (split) { parts = Array(nParts).fill(0); ctrs.forEach(c => parts[c.part]++); }
    gLab.replaceChildren();
    const geo = geometry(nParts, split);
    label(gLab, geo.whole, 'whole', -1, whole);
    geo.parts.forEach((c, i) => label(gLab, c, i, i, parts[i]));
    placeCounters();
    // Hidden circles: redraw strokes (hide can change with reveal).
  }

  function partAt(pt) {
    const geo = geometry(nParts, split);
    let best = null, bd = Infinity;
    geo.parts.forEach((c, i) => { const d = Math.hypot(pt.x - c.x, pt.y - c.y); if (d < c.r * 1.25 && d < bd) { bd = d; best = i; } });
    return best;
  }

  function nearestCounter(part, pt) {
    const geo = geometry(nParts, split);
    const pc = geo.parts[part];
    const { pts } = slotsFor(part);
    let k = 0, best = null, bd = Infinity;
    for (const c of ctrs) {
      if (c.part !== part) continue;
      const q = pts[k++] || { x: 0, y: 0 };
      const d = Math.hypot(pt.x - (pc.x + q.x), pt.y - (pc.y + q.y));
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function moveTo(c, target) {
    // Moved counters join the end of their new part.
    ctrs = ctrs.filter(x => x !== c);
    c.part = target;
    ctrs.push(c);
    sfx('pop');
    changed();
  }

  function build() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    root.classList.toggle('ro', ro());
    gStatic = S('g'); gCtr = S('g'); gLab = S('g'); gHit = S('g');
    root.append(gStatic, gCtr, gLab, gHit);
    const geo = geometry(nParts, split);
    geo.parts.forEach(c => {
      // Join the circles edge to edge (the circle fills are see-through).
      const w = geo.whole, d = Math.hypot(c.x - w.x, c.y - w.y), ux = (c.x - w.x) / d, uy = (c.y - w.y) / d;
      gStatic.appendChild(S('line', { x1: w.x + ux * w.r, y1: w.y + uy * w.r, x2: c.x - ux * c.r, y2: c.y - uy * c.r, stroke: COL.ink3, 'stroke-width': 5, 'stroke-linecap': 'round' }));
    });
    circle(gStatic, geo.whole, 'whole', -1);
    geo.parts.forEach((c, i) => circle(gStatic, c, i, i));
    ctrs = [];
    if (split) {
      parts.forEach((v, part) => { for (let k = 0; k < v; k++) ctrs.push({ part, el: null }); });
      ctrs.forEach(c => {
        c.el = S('circle', { class: 'ctr nt', cx: 0, cy: 0, r: 10, stroke: 'rgba(0,0,0,.28)', 'stroke-width': 2.5 });
        gCtr.appendChild(c.el);
      });
      if (!ro()) {
        geo.parts.forEach((c, i) => {
          const hit = S('circle', { class: 'hit', cx: c.x, cy: c.y, r: c.r + 12, fill: 'transparent' });
          gHit.appendChild(hit);
          let st = null;
          unbinds.push(drag(hit, {
            start(pt) { st = { x0: pt.x, y0: pt.y, moved: false, c: nearestCounter(i, pt) }; },
            move(pt) {
              if (!st || !st.c) return;
              if (!st.moved && Math.hypot(pt.x - st.x0, pt.y - st.y0) > 14) { st.moved = true; st.c.el.classList.add('nt'); }
              if (st.moved) st.c.el.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
            },
            end(pt) {
              const s0 = st; st = null;
              if (!s0 || !s0.c) return;
              s0.c.el.classList.remove('nt');
              if (s0.moved) {
                const t = partAt(pt);
                if (t !== null && t !== i) moveTo(s0.c, t); else placeCounters();
              } else {
                moveTo(s0.c, (i + 1) % nParts);
              }
            },
          }, root));
        });
      }
    }
    refresh();
    // Turn transitions on after the first placement so counters do not fly in from the corner.
    requestAnimationFrame(() => ctrs.forEach(c => c.el && c.el.classList.remove('nt')));
  }

  const api = {
    getState: state,
    update(np) {
      const reset = ['whole', 'parts', 'mode', 'hide'].some(k => k in np);
      if (reset) setFromProps(np); else p = { ...p, ...np };
      build();
    },
    showAnswer(answer) {
      if (split && Array.isArray(answer) && answer.length === nParts && answer.reduce((s, v) => s + num(v), 0) === whole) {
        // Move counters until the parts match the answer.
        const want = answer.map(num);
        let guard = 100;
        while (guard-- > 0) {
          const now = Array(nParts).fill(0); ctrs.forEach(c => now[c.part]++);
          const from = now.findIndex((v, i) => v > want[i]);
          const to = now.findIndex((v, i) => v < want[i]);
          if (from < 0 || to < 0) break;
          const c = [...ctrs].reverse().find(x => x.part === from);
          ctrs = ctrs.filter(x => x !== c); c.part = to; ctrs.push(c);
        }
        ways.add(want.join(','));
        refresh();
        return;
      }
      if (p.hide !== null && p.hide !== undefined && p.hide !== '') {
        revealed = p.hide === 'whole' ? 'whole' : Number(p.hide);
        build();
      }
    },
    destroy() { unbinds.splice(0).forEach(u => u()); el.replaceChildren(); },
  };
  setFromProps(props);
  build();
  return api;
}
