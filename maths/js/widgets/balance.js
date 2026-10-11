// balance: a pan balance with an expression on each pan (display only). Owner: addsub.
// Props:
//   left, right            strings such as "3 + 4", "7", "? + 4", "15 − 6". Tokens are separated by spaces.
//   leftValue, rightValue  numbers. If omitted they are worked out from the string (when it has no "?").
//   hold                   true: the pans rest on two supports and the beam stays level (for "which way will it tip?"
//                          guesses); update({ hold: false }) lets it swing.
//   readonly               (always display only)
// The beam tilts down on the heavier side and is level when the sides are equal.
// If a side contains "?" and its value is not given, the beam stays level and the "?" card pulses blue.
// Style v2: an ink-outlined balance with white pans; numbers are white cards with an ink outline and big ink digits.
// State: { level, held, leftValue, rightValue } (no interaction)
// Debug: dev/harness.html?widget=balance&props={"left":"? + 4","right":"9"}
import { S, svgRoot, injectCSS } from '../core/dom.js';
import { COL, PAL, FONT } from '../core/theme.js';

export const meta = {
  title: 'Balance',
  playground: { left: '3 + 4', right: '5 + 2' },
  state: ['level', 'held', 'leftValue', 'rightValue'],
};

const W = 800, H = 500;
const Q = COL.focus, QSOFT = COL.focusSoft; // the unknown: a blue "?" on a soft blue card
const PX = 400, PY = 178, L = 252, DROP = 150, TILT = 9;

const tokens = s => String(s ?? '').replace(/([+\-−=])/g, ' $1 ').replace(/\?/g, ' ? ').split(/\s+/).filter(Boolean);

// Evaluate "a + b − c" left to right. Returns null if it has a "?" or anything else.
function evaluate(str) {
  const t = tokens(str);
  if (!t.length) return null;
  let total = null, op = '+';
  for (const tok of t) {
    if (tok === '+' || tok === '-' || tok === '−') { op = tok; continue; }
    if (!/^\d+$/.test(tok)) return null;
    const v = +tok;
    total = total === null ? v : op === '+' ? total + v : total - v;
  }
  return total;
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-balance', `
    .w-balance { width: 100%; height: 100%; }
    .w-balance .beam { transform-origin: ${PX}px ${PY}px; transition: transform .6s cubic-bezier(.3,1.4,.5,1); }
    .w-balance .pan { transition: transform .6s cubic-bezier(.3,1.4,.5,1); }
    .w-balance .qglow { animation: w-balance-q 1.6s ease-in-out infinite; }
    @keyframes w-balance-q { 50% { stroke-width: 8; fill: #d3e3fd; } }
    @media (prefers-reduced-motion: reduce) { .w-balance .beam, .w-balance .pan { transition: none; } .w-balance .qglow { animation: none; } }
  `);
  let p = { ...props };
  const root = svgRoot(W, H, 'w-balance');
  el.appendChild(root);
  let beam, pans = [], timer = null;

  function values() {
    const has = s => /\?/.test(String(s ?? ''));
    const lv = p.leftValue !== undefined && p.leftValue !== null && p.leftValue !== '' ? Number(p.leftValue) : (has(p.left) ? null : evaluate(p.left));
    const rv = p.rightValue !== undefined && p.rightValue !== null && p.rightValue !== '' ? Number(p.rightValue) : (has(p.right) ? null : evaluate(p.right));
    const unknown = lv === null || rv === null || !Number.isFinite(lv) || !Number.isFinite(rv);
    const angle = p.hold || unknown || lv === rv ? 0 : rv > lv ? TILT : -TILT;
    return { lv, rv, unknown, angle };
  }

  function tiles(str, highlight) {
    const g = S('g');
    const t = tokens(str);
    const parts = [];
    let x = 0;
    for (const tok of t) {
      const isOp = /^[+\-−=]$/.test(tok);
      const w = isOp ? 40 : Math.max(78, 30 + tok.length * 32);
      parts.push({ tok, isOp, x, w });
      x += w + 8;
    }
    const total = Math.max(0, x - 8);
    const scale = total > 236 ? 236 / total : 1;
    const inner = S('g', { transform: `scale(${scale}) translate(${-total / 2} 0)` });
    for (const q of parts) {
      if (q.isOp) {
        inner.appendChild(S('text', { x: q.x + q.w / 2, y: -42, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 52, fill: COL.ink }, [q.tok === '-' ? '−' : q.tok]));
        continue;
      }
      const isQ = q.tok === '?';
      inner.appendChild(S('rect', {
        x: q.x, y: -86, width: q.w, height: 84, rx: 14,
        fill: isQ ? QSOFT : COL.surface, stroke: isQ ? Q : COL.ink, 'stroke-width': 4,
        'stroke-dasharray': isQ ? '12 8' : null, 'stroke-linecap': 'round', class: isQ && highlight ? 'qglow' : null,
      }));
      inner.appendChild(S('text', { x: q.x + q.w / 2, y: -44, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 56, fill: isQ ? Q : COL.ink }, [q.tok]));
    }
    g.appendChild(inner);
    return g;
  }

  function panAt(side, angle) {
    const a = (angle * Math.PI) / 180;
    const dx = side * L * Math.cos(a) - side * L;
    const dy = side * L * Math.sin(a);
    return `translate(${dx}px, ${dy}px)`;
  }

  function draw(initialLevel) {
    clearTimeout(timer);
    root.replaceChildren();
    const v = values();
    // Stand.
    root.appendChild(S('rect', { x: PX - 13, y: PY, width: 26, height: 280, rx: 8, fill: COL.surface3, stroke: COL.ink, 'stroke-width': 4 }));
    root.appendChild(S('path', { d: `M${PX - 112} 490 L${PX + 112} 490 L${PX + 74} 460 L${PX - 74} 460 Z`, fill: COL.surface3, stroke: COL.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
    if (p.hold) {
      // Two supports under the pans keep the beam level until they are taken away.
      [-1, 1].forEach(side => {
        const ex = PX + side * L;
        root.appendChild(S('rect', { x: ex - 36, y: PY + DROP + 32, width: 72, height: 490 - (PY + DROP + 32), rx: 10, fill: COL.surface3, stroke: COL.ink, 'stroke-width': 4 }));
      });
    }
    // Pans hang from the beam ends and move with them.
    pans = [-1, 1].map(side => {
      const ex = PX + side * L;
      const g = S('g', { class: 'pan' });
      g.style.transform = panAt(side, initialLevel ? 0 : v.angle);
      g.appendChild(S('path', { d: `M${ex} ${PY} L${ex - 118} ${PY + DROP} M${ex} ${PY} L${ex + 118} ${PY + DROP}`, stroke: COL.ink, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }));
      g.appendChild(S('path', { d: `M${ex - 130} ${PY + DROP} L${ex + 130} ${PY + DROP} Q${ex + 116} ${PY + DROP + 36} ${ex} ${PY + DROP + 36} Q${ex - 116} ${PY + DROP + 36} ${ex - 130} ${PY + DROP} Z`, fill: COL.surface, stroke: COL.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' }));
      const t = tiles(side < 0 ? p.left : p.right, v.unknown);
      t.setAttribute('transform', `translate(${ex} ${PY + DROP - 6})`);
      g.appendChild(t);
      root.appendChild(g);
      return g;
    });
    // Beam on top of the strings.
    beam = S('g', { class: 'beam' });
    beam.style.transform = `rotate(${initialLevel ? 0 : v.angle}deg)`;
    beam.appendChild(S('rect', { x: PX - L - 16, y: PY - 11, width: 2 * L + 32, height: 22, rx: 11, fill: PAL.blue, stroke: COL.ink, 'stroke-width': 4 }));
    beam.appendChild(S('circle', { cx: PX - L, cy: PY, r: 8, fill: COL.surface, stroke: COL.ink, 'stroke-width': 3.5 }));
    beam.appendChild(S('circle', { cx: PX + L, cy: PY, r: 8, fill: COL.surface, stroke: COL.ink, 'stroke-width': 3.5 }));
    root.appendChild(beam);
    root.appendChild(S('circle', { cx: PX, cy: PY, r: 18, fill: PAL.yellow, stroke: COL.ink, 'stroke-width': 4 }));
    if (initialLevel && v.angle !== 0) {
      // Start level, then tip, so the eye sees the scales move.
      // Keep this drawing's own beam and pans: a later redraw must not be tipped by this one's timer.
      const b = beam, ps = pans;
      timer = setTimeout(() => {
        requestAnimationFrame(() => {
          if (b !== beam) return;
          b.style.transform = `rotate(${v.angle}deg)`;
          ps[0].style.transform = panAt(-1, v.angle);
          ps[1].style.transform = panAt(1, v.angle);
        });
      }, 250);
    }
  }

  const api = {
    getState() { const v = values(); return { level: v.angle === 0, held: !!p.hold, leftValue: v.lv, rightValue: v.rv }; },
    update(np) { p = { ...p, ...np }; draw(true); },
    showAnswer(answer) {
      // Fill a "?" with the answer and let the scales settle.
      if (answer === undefined || answer === null) return;
      const fill = s => String(s ?? '').replace('?', String(answer));
      const qL = /\?/.test(String(p.left ?? '')), qR = /\?/.test(String(p.right ?? ''));
      p = { ...p, left: fill(p.left), right: fill(p.right) };
      if (qL) p.leftValue = null;
      if (qR) p.rightValue = null;
      draw(true);
    },
    destroy() { clearTimeout(timer); el.replaceChildren(); },
  };
  draw(true);
  return api;
}
