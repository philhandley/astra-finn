// balance: a pan balance with an expression on each pan (display only). Owner: addsub.
// Props:
//   left, right            strings such as "3 + 4", "7", "? + 4", "15 − 6". Tokens are separated by spaces.
//   leftValue, rightValue  numbers. If omitted they are worked out from the string (when it has no "?").
//   hold                   true: the pans rest on two supports and the beam stays level (for "which way will it tip?"
//                          guesses); update({ hold: false }) lets it swing.
//   readonly               (always display only)
// The beam tilts down on the heavier side and is level when the sides are equal.
// If a side contains "?" and its value is not given, the beam stays level and the "?" box glows gold.
// State: { level, held, leftValue, rightValue } (no interaction)
// Debug: dev/harness.html?widget=balance&props={"left":"? + 4","right":"9"}
import { S, svgRoot, injectCSS } from '../core/dom.js';
import { COL, FONT } from '../core/theme.js';

export const meta = {
  title: 'Balance',
  playground: { left: '3 + 4', right: '5 + 2' },
  state: ['level', 'held', 'leftValue', 'rightValue'],
};

const W = 800, H = 500;
const GOLD = COL.tens;
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
    @keyframes w-balance-q { 50% { stroke-width: 9; fill: #4a3d1a; } }
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
        inner.appendChild(S('text', { x: q.x + q.w / 2, y: -42, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 50, fill: COL.ink2 }, [q.tok === '-' ? '−' : q.tok]));
        continue;
      }
      const isQ = q.tok === '?';
      inner.appendChild(S('rect', {
        x: q.x, y: -84, width: q.w, height: 84, rx: 14,
        fill: isQ ? '#2a2616' : COL.panel2, stroke: isQ ? GOLD : COL.ink3, 'stroke-width': isQ ? 5 : 3,
        'stroke-dasharray': isQ ? '12 8' : null, class: isQ && highlight ? 'qglow' : null,
      }));
      inner.appendChild(S('text', { x: q.x + q.w / 2, y: -42, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 54, fill: isQ ? GOLD : COL.ink }, [q.tok]));
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
    root.appendChild(S('path', { d: `M${PX - 110} 488 L${PX + 110} 488 L${PX + 70} 462 L${PX - 70} 462 Z`, fill: COL.panel2, stroke: COL.ink3, 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    root.appendChild(S('rect', { x: PX - 11, y: PY, width: 22, height: 284, rx: 8, fill: COL.panel2, stroke: COL.ink3, 'stroke-width': 3 }));
    if (p.hold) {
      // Two supports under the pans keep the beam level until they are taken away.
      [-1, 1].forEach(side => {
        const ex = PX + side * L;
        root.appendChild(S('rect', { x: ex - 34, y: PY + DROP + 30, width: 68, height: 488 - (PY + DROP + 30), rx: 8, fill: '#3a3226', stroke: '#8a7350', 'stroke-width': 3 }));
      });
    }
    // Pans hang from the beam ends and move with them.
    pans = [-1, 1].map(side => {
      const ex = PX + side * L;
      const g = S('g', { class: 'pan' });
      g.style.transform = panAt(side, initialLevel ? 0 : v.angle);
      g.appendChild(S('path', { d: `M${ex} ${PY} L${ex - 118} ${PY + DROP} M${ex} ${PY} L${ex + 118} ${PY + DROP}`, stroke: COL.ink3, 'stroke-width': 3, fill: 'none' }));
      g.appendChild(S('path', { d: `M${ex - 128} ${PY + DROP} L${ex + 128} ${PY + DROP} Q${ex + 114} ${PY + DROP + 34} ${ex} ${PY + DROP + 34} Q${ex - 114} ${PY + DROP + 34} ${ex - 128} ${PY + DROP} Z`, fill: 'rgba(95,212,255,.12)', stroke: COL.ink2, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
      const t = tiles(side < 0 ? p.left : p.right, v.unknown);
      t.setAttribute('transform', `translate(${ex} ${PY + DROP - 6})`);
      g.appendChild(t);
      root.appendChild(g);
      return g;
    });
    // Beam on top of the strings.
    beam = S('g', { class: 'beam' });
    beam.style.transform = `rotate(${initialLevel ? 0 : v.angle}deg)`;
    beam.appendChild(S('rect', { x: PX - L - 14, y: PY - 9, width: 2 * L + 28, height: 18, rx: 9, fill: COL.ink2 }));
    beam.appendChild(S('circle', { cx: PX - L, cy: PY, r: 9, fill: COL.panel, stroke: COL.ink2, 'stroke-width': 3 }));
    beam.appendChild(S('circle', { cx: PX + L, cy: PY, r: 9, fill: COL.panel, stroke: COL.ink2, 'stroke-width': 3 }));
    root.appendChild(beam);
    root.appendChild(S('circle', { cx: PX, cy: PY, r: 16, fill: GOLD, stroke: COL.panel, 'stroke-width': 4 }));
    if (initialLevel && v.angle !== 0) {
      // Start level, then tip, so the eye sees the scales move.
      timer = setTimeout(() => {
        requestAnimationFrame(() => {
          beam.style.transform = `rotate(${v.angle}deg)`;
          pans[0].style.transform = panAt(-1, v.angle);
          pans[1].style.transform = panAt(1, v.angle);
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
