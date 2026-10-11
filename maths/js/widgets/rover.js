// rover: a Moon-base floor grid seen from above, with a rover that faces N, E, S or W (up, right, down, left on screen).
// Props: cols (default 6), rows (default 5), start { x, y, dir } (x from the left, y from the top, dir 'N' | 'E' | 'S' | 'W'),
//        target { x, y } (a flag), rocks (array of { x, y } blocked squares),
//        controls (array from 'forward', 'back', 'left' (quarter turn anticlockwise), 'right' (quarter turn clockwise), 'half'),
//        program (true: taps queue arrow cards and Go! runs them from the start; otherwise each tap moves at once),
//        showTurnArc (draw each turn as a curved arrow from the old heading to the new one, with a right-angle mark
//            and a small "clockwise" / "anticlockwise" label), trail (default true: dots where it has been), readonly.
// Driving off the grid or into a rock gives a gentle bump and no move.
// State: { x, y, dir, turns, moves, atTarget, queued }  (turns = quarter turns clockwise minus anticlockwise since the start;
//         moves = squares moved; queued = cards waiting in program mode)
// Debug: dev/harness.html?widget=rover&props={"controls":["forward","left","right"],"target":{"x":4,"y":1},"showTurnArc":true}
import { S, svgRoot, onTap, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { artInner } from '../core/art.js';
import { COL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Moon rover',
  playground: { cols: 6, rows: 5, start: { x: 0, y: 4, dir: 'N' }, target: { x: 4, y: 1 }, rocks: [{ x: 2, y: 2 }], controls: ['forward', 'back', 'left', 'right', 'half'], showTurnArc: true },
  state: ['x', 'y', 'dir', 'turns', 'moves', 'atTarget', 'queued'],
};

const W = 800, H = 500;
export const DIRS = ['N', 'E', 'S', 'W'];
const DV = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const ANG = { N: 0, E: 90, S: 180, W: 270 };
const CMDS = ['forward', 'back', 'left', 'right', 'half'];
const LABEL = { forward: 'Forward', back: 'Back', left: 'anticlockwise', right: 'clockwise', half: 'Half turn' };

// Turn a direction by quarter turns (positive = clockwise).
export const turnDir = (dir, quarters) => DIRS[(((DIRS.indexOf(dir) + quarters) % 4) + 4) % 4];

// Shortest list of commands (forward, left, right) from start to target, or null if it can't be reached.
export function roverRoute(cols, rows, start, target, rocks = []) {
  const rock = new Set(rocks.map(r => `${r.x},${r.y}`));
  const ok = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && !rock.has(`${x},${y}`);
  const key = s => `${s.x},${s.y},${s.dir}`;
  const s0 = { x: start.x, y: start.y, dir: start.dir || 'N' };
  const prev = new Map([[key(s0), null]]);
  const qu = [s0];
  while (qu.length) {
    const s = qu.shift();
    if (s.x === target.x && s.y === target.y) {
      const out = [];
      let k = key(s);
      while (prev.get(k)) { const { from, cmd } = prev.get(k); out.unshift(cmd); k = from; }
      return out;
    }
    const [dx, dy] = DV[s.dir];
    const next = [
      ['forward', { x: s.x + dx, y: s.y + dy, dir: s.dir }],
      ['right', { x: s.x, y: s.y, dir: turnDir(s.dir, 1) }],
      ['left', { x: s.x, y: s.y, dir: turnDir(s.dir, -1) }],
    ];
    for (const [cmd, n] of next) {
      if (!ok(n.x, n.y) || prev.has(key(n))) continue;
      prev.set(key(n), { from: key(s), cmd });
      qu.push(n);
    }
  }
  return null;
}

// Compass angle (0 = up, clockwise) to a point on a circle.
const at = (cx, cy, r, a) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
const f1 = v => Math.round(v * 10) / 10;
function arcArrow(cx, cy, r, a0, a1, head = 12) {
  const cw = a1 > a0;
  const sweep = Math.abs(a1 - a0);
  const [x0, y0] = at(cx, cy, r, a0), [x1, y1] = at(cx, cy, r, a1);
  let d;
  if (sweep >= 359) {
    const mid = (a0 + a1) / 2, [xm, ym] = at(cx, cy, r, mid);
    d = `M${f1(x0)} ${f1(y0)}A${r} ${r} 0 0 ${cw ? 1 : 0} ${f1(xm)} ${f1(ym)}A${r} ${r} 0 0 ${cw ? 1 : 0} ${f1(x1)} ${f1(y1)}`;
  } else d = `M${f1(x0)} ${f1(y0)}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} ${cw ? 1 : 0} ${f1(x1)} ${f1(y1)}`;
  const rad = (a1 * Math.PI) / 180;
  const t = cw ? [Math.cos(rad), Math.sin(rad)] : [-Math.cos(rad), -Math.sin(rad)];
  const n = [-t[1], t[0]];
  const tip = [x1 + t[0] * head * 1.1, y1 + t[1] * head * 1.1];
  const b1 = [x1 - t[0] * head * 0.3 + n[0] * head * 0.55, y1 - t[1] * head * 0.3 + n[1] * head * 0.55];
  const b2 = [x1 - t[0] * head * 0.3 - n[0] * head * 0.55, y1 - t[1] * head * 0.3 - n[1] * head * 0.55];
  return { d, head: `M${f1(tip[0])} ${f1(tip[1])}L${f1(b1[0])} ${f1(b1[1])}L${f1(b2[0])} ${f1(b2[1])}Z` };
}

function icon(cmd, cx, cy, s = 1, colour = COL.ink) {
  const g = S('g', { transform: `translate(${cx} ${cy}) scale(${s})` });
  if (cmd === 'forward' || cmd === 'back') {
    g.appendChild(S('path', { d: 'M0 -24L19 -3H7V22H-7V-3H-19Z', fill: colour, transform: cmd === 'back' ? 'rotate(180)' : '' }));
  } else {
    const spec = cmd === 'right' ? [70, 330] : cmd === 'left' ? [-70, -330] : [-90, 90];
    const a = arcArrow(0, cmd === 'half' ? 8 : 2, 18, spec[0], spec[1], 16);
    g.appendChild(S('path', { d: a.d, fill: 'none', stroke: colour, 'stroke-width': 6, 'stroke-linecap': 'round' }));
    g.appendChild(S('path', { d: a.head, fill: colour }));
  }
  return g;
}

function roverSprite() {
  const g = S('g');
  for (const [x, y] of [[-42, -34], [28, -34], [-42, 10], [28, 10]]) g.appendChild(S('rect', { x, y, width: 14, height: 26, rx: 4, fill: '#3a4258', stroke: '#0c1430', 'stroke-width': 2 }));
  g.appendChild(S('rect', { x: -29, y: -38, width: 58, height: 76, rx: 12, fill: COL.ink, stroke: '#0c1430', 'stroke-width': 3 }));
  g.appendChild(S('rect', { x: -19, y: 2, width: 38, height: 28, rx: 4, fill: '#9fb4d8' }));
  g.appendChild(S('path', { d: 'M-19 9H19M-19 16H19M-19 23H19', stroke: '#6c7fa6', 'stroke-width': 2 }));
  g.appendChild(S('path', { d: 'M0 -56L17 -36H-17Z', fill: COL.tens, stroke: '#0c1430', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  g.appendChild(S('circle', { cx: 0, cy: -18, r: 9, fill: COL.ones, stroke: '#0c1430', 'stroke-width': 3 }));
  return g;
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-rover', `
    .w-rover { width: 100%; height: 100%; }
    .w-rover .btn3 { cursor: pointer; }
    .w-rover .btn3:active rect { fill: rgba(242,181,68,.3); }
    .w-rover .btn3.off { opacity: .45; cursor: default; }
    .w-rover .deco { pointer-events: none; }
  `);
  let p = { ...props };
  let st, ang, trail, lastTurn, queue = [], running = false, ranIdx = -1;
  let disp = { x: 0, y: 0, a: 0 };
  let raf = 0, safety = 0;
  const timers = [];
  const root = svgRoot(W, H, 'w-rover');
  el.appendChild(root);
  const unbinds = [];
  let L = null; // layout
  let roverG = null, overlay = null;

  // readonly: false arriving through update() (a hint) switches interaction on even if mounted readonly.
  const ro = () => (p.readonly === false ? false : !!(p.readonly || ctx.readonly));
  const cols = () => clamp(Math.round(+p.cols || 6), 1, 12);
  const rows = () => clamp(Math.round(+p.rows || 5), 1, 10);
  const startOf = () => {
    const s = p.start || {};
    return { x: clamp(Math.round(+s.x || 0), 0, cols() - 1), y: clamp(Math.round(s.y ?? rows() - 1), 0, rows() - 1), dir: DIRS.includes(s.dir) ? s.dir : 'N' };
  };
  const rocks = () => (Array.isArray(p.rocks) ? p.rocks : []).filter(r => r && Number.isFinite(+r.x) && Number.isFinite(+r.y)).map(r => ({ x: +r.x, y: +r.y }));
  const target = () => (p.target && Number.isFinite(+p.target.x) && Number.isFinite(+p.target.y) ? { x: +p.target.x, y: +p.target.y } : null);
  const controls = () => (Array.isArray(p.controls) ? p.controls : []).filter(c => CMDS.includes(c)).filter((c, i, a) => a.indexOf(c) === i).slice(0, 5);
  const blocked = (x, y) => x < 0 || y < 0 || x >= cols() || y >= rows() || rocks().some(r => r.x === x && r.y === y);
  const atTarget = () => { const t = target(); return !!t && st.x === t.x && st.y === t.y; };

  function resetPos() {
    st = { ...startOf(), turns: 0, moves: 0 };
    ang = ANG[st.dir];
    trail = [[st.x, st.y]];
    lastTurn = null;
    disp = { x: st.x, y: st.y, a: ang };
  }

  function layout() {
    const showCtl = !ro() && controls().length > 0;
    const prog = showCtl && !!p.program;
    const top = 10, bottom = showCtl ? (prog ? 300 : 376) : H - 10;
    const side = showCtl ? 180 : 40;
    const cell = Math.min((W - side) / cols(), (bottom - top) / rows());
    const gx = (W - cell * cols()) / 2, gy = top + (bottom - top - cell * rows()) / 2;
    return { showCtl, prog, cell, gx, gy, cx: x => gx + (x + 0.5) * cell, cy: y => gy + (y + 0.5) * cell };
  }

  function changed() { ctx.onChange && ctx.onChange(api.getState()); }

  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    L = layout();
    const { cell, gx, gy } = L;
    const C = cols(), R = rows();
    // Floor.
    root.appendChild(S('rect', { x: gx, y: gy, width: cell * C, height: cell * R, rx: 10, fill: 'rgba(95,212,255,.05)', stroke: COL.grid, 'stroke-width': 3 }));
    const lines = [];
    for (let i = 1; i < C; i++) lines.push(`M${f1(gx + i * cell)} ${f1(gy)}V${f1(gy + cell * R)}`);
    for (let j = 1; j < R; j++) lines.push(`M${f1(gx)} ${f1(gy + j * cell)}H${f1(gx + cell * C)}`);
    if (lines.length) root.appendChild(S('path', { d: lines.join(''), stroke: COL.grid, 'stroke-width': 2, 'stroke-opacity': 0.7 }));
    // Trail.
    if (p.trail !== false) {
      trail.slice(0, -1).forEach(([x, y]) => root.appendChild(S('circle', { class: 'deco', cx: f1(L.cx(x)), cy: f1(L.cy(y)), r: Math.max(4, cell * 0.08), fill: COL.ones, 'fill-opacity': 0.55 })));
    }
    // Rocks and flag.
    const art = (name, x, y, size) => {
      const g = S('g', { class: 'deco', transform: `translate(${f1(L.cx(x) - size / 2)} ${f1(L.cy(y) - size / 2)}) scale(${size / 100})` });
      g.innerHTML = artInner(name);
      root.appendChild(g);
    };
    rocks().forEach(r => { if (r.x >= 0 && r.y >= 0 && r.x < C && r.y < R) art('asteroid', r.x, r.y, cell * 0.8); });
    const t = target();
    if (t && t.x >= 0 && t.y >= 0 && t.x < C && t.y < R) {
      if (atTarget() && !running) root.appendChild(S('rect', { class: 'deco', x: f1(gx + t.x * cell + 4), y: f1(gy + t.y * cell + 4), width: f1(cell - 8), height: f1(cell - 8), rx: 10, fill: 'rgba(242,181,68,.18)', stroke: COL.tens, 'stroke-width': 4 }));
      art('flag', t.x, t.y, cell * 0.78);
    }
    overlay = S('g', { class: 'deco' });
    root.appendChild(overlay);
    roverG = S('g', { class: 'deco' }, [roverSprite()]);
    root.appendChild(roverG);
    placeRover();

    if (L.showCtl) {
      // Reset (home) button beside the grid.
      const rx = Math.min(gx + cell * C + 18, W - 78), ry = gy;
      const rb = S('g', { class: 'btn3', role: 'button', 'aria-label': 'Back to start' }, [
        S('rect', { x: rx, y: ry, width: 68, height: 68, rx: 16, fill: 'rgba(255,255,255,.06)', stroke: COL.ink3, 'stroke-width': 2 }),
        S('path', { d: `M${rx + 34} ${ry + 16}L${rx + 54} ${ry + 34}H${rx + 48}V${ry + 52}H${rx + 20}V${ry + 34}H${rx + 14}Z`, fill: COL.ink2 }),
      ]);
      unbinds.push(onTap(rb, () => { if (running) return; resetPos(); ranIdx = -1; sfx('click'); draw(); changed(); }));
      root.appendChild(rb);
      drawButtons();
      if (L.prog) drawProgram();
    }
  }

  function drawButtons() {
    const ctl = controls();
    const n = ctl.length;
    const gap = 12, bw = Math.min(150, (W - 20) / n - gap), bh = 96;
    const total = n * bw + (n - 1) * gap, x0 = (W - total) / 2, y0 = H - bh - 6;
    ctl.forEach((cmd, i) => {
      const x = x0 + i * (bw + gap);
      const label = LABEL[cmd];
      const fs = Math.min(22, (bw - 10) / (label.length * 0.56));
      const g = S('g', { class: 'btn3' + (running ? ' off' : ''), role: 'button', 'aria-label': cmd === 'left' ? 'Quarter turn anticlockwise' : cmd === 'right' ? 'Quarter turn clockwise' : label }, [
        S('rect', { x, y: y0, width: bw, height: bh, rx: 18, fill: 'rgba(242,181,68,.12)', stroke: COL.tens, 'stroke-width': 3 }),
        icon(cmd, x + bw / 2, y0 + 36, 1, COL.tens),
        S('text', { x: x + bw / 2, y: y0 + bh - 14, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 600, 'font-size': f1(fs), fill: COL.ink }, [label]),
      ]);
      unbinds.push(onTap(g, () => press(cmd)));
      root.appendChild(g);
    });
  }

  function drawProgram() {
    const y = 310, cs = 44, step = 47;
    root.appendChild(S('rect', { x: 10, y: y - 4, width: W - 250, height: cs + 26, rx: 14, fill: 'rgba(255,255,255,.04)', stroke: COL.line, 'stroke-width': 2 }));
    queue.forEach((cmd, i) => {
      const x = 20 + i * step;
      const done = running ? i <= ranIdx : false;
      root.appendChild(S('rect', { class: 'deco', x, y: y + 9, width: cs, height: cs, rx: 9, fill: done ? 'rgba(242,181,68,.35)' : 'rgba(95,212,255,.14)', stroke: done ? COL.tens : COL.ones, 'stroke-width': 2.5 }));
      root.appendChild(icon(cmd, x + cs / 2, y + 9 + cs / 2, 0.78, done ? COL.tens : COL.ones));
    });
    const undo = S('g', { class: 'btn3' + (running || !queue.length ? ' off' : ''), role: 'button', 'aria-label': 'Undo' }, [
      S('rect', { x: W - 232, y: y - 4, width: 96, height: 70, rx: 16, fill: 'rgba(255,255,255,.06)', stroke: COL.ink3, 'stroke-width': 2 }),
      S('text', { x: W - 184, y: y + 40, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 22, fill: COL.ink }, ['Undo']),
    ]);
    unbinds.push(onTap(undo, () => { if (running || !queue.length) return; queue.pop(); sfx('click'); draw(); changed(); }));
    root.appendChild(undo);
    const go = S('g', { class: 'btn3' + (running || !queue.length ? ' off' : ''), role: 'button', 'aria-label': 'Go' }, [
      S('rect', { x: W - 126, y: y - 4, width: 116, height: 70, rx: 16, fill: COL.tens }),
      S('text', { x: W - 68, y: y + 42, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: '#1a1205' }, ['Go!']),
    ]);
    unbinds.push(onTap(go, runProgram));
    root.appendChild(go);
  }

  function placeRover() {
    if (!roverG || !L) return;
    const s = (L.cell / 100) * 0.86;
    roverG.setAttribute('transform', `translate(${f1(L.gx + (disp.x + 0.5) * L.cell)} ${f1(L.gy + (disp.y + 0.5) * L.cell)}) rotate(${f1(disp.a)}) scale(${(s).toFixed(3)})`);
    drawOverlay();
  }

  function drawOverlay() {
    if (!overlay) return;
    overlay.replaceChildren();
    if (!p.showTurnArc || !lastTurn || !L) return;
    const cx = L.cx(st.x), cy = L.cy(st.y), r = L.cell * 0.62;
    const a0 = ANG[lastTurn.from], a1 = a0 + lastTurn.qd * 90;
    const col = lastTurn.qd > 0 ? COL.tens : COL.ones;
    overlay.appendChild(S('line', { x1: f1(cx), y1: f1(cy), ...(([x, y]) => ({ x2: f1(x), y2: f1(y) }))(at(cx, cy, r, a0)), stroke: COL.ink2, 'stroke-width': 3, 'stroke-dasharray': '7 6' }));
    overlay.appendChild(S('line', { x1: f1(cx), y1: f1(cy), ...(([x, y]) => ({ x2: f1(x), y2: f1(y) }))(at(cx, cy, r, a1)), stroke: col, 'stroke-width': 4 }));
    if (Math.abs(lastTurn.qd) === 1) {
      const m = L.cell * 0.16;
      const [ux, uy] = at(0, 0, m, a0), [vx, vy] = at(0, 0, m, a1);
      overlay.appendChild(S('path', { d: `M${f1(cx + ux)} ${f1(cy + uy)}L${f1(cx + ux + vx)} ${f1(cy + uy + vy)}L${f1(cx + vx)} ${f1(cy + vy)}`, fill: 'none', stroke: col, 'stroke-width': 3 }));
    }
    const a = arcArrow(cx, cy, r, a0 + (lastTurn.qd > 0 ? 8 : -8), a1 - (lastTurn.qd > 0 ? 10 : -10), Math.max(10, L.cell * 0.16));
    overlay.appendChild(S('path', { d: a.d, fill: 'none', stroke: col, 'stroke-width': Math.max(4, L.cell * 0.06), 'stroke-linecap': 'round' }));
    overlay.appendChild(S('path', { d: a.head, fill: col }));
    // Small label in the top-left corner.
    const words = [Math.abs(lastTurn.qd) === 2 ? 'Half turn' : 'Quarter turn', lastTurn.qd > 0 ? 'clockwise' : 'anticlockwise'];
    words.forEach((w, i) => overlay.appendChild(S('text', { x: 14, y: 34 + i * 28, 'font-family': FONT.display, 'font-weight': 600, 'font-size': 24, fill: col }, [w])));
  }

  function tween(target, dur) {
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(safety);
    const from = { ...disp };
    if (reducedMotion() || dur <= 0) { raf = 0; disp = { ...target }; placeRover(); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      disp = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, a: from.a + (target.a - from.a) * e };
      placeRover();
      raf = k < 1 ? requestAnimationFrame(step) : 0;
    };
    raf = requestAnimationFrame(step);
    safety = setTimeout(() => { if (raf) cancelAnimationFrame(raf); raf = 0; disp = { ...target }; placeRover(); }, dur + 60);
  }

  // Apply one command to the logical state and animate it. Returns false if blocked.
  function doCmd(cmd) {
    if (cmd === 'forward' || cmd === 'back') {
      const [dx, dy] = DV[st.dir], s = cmd === 'forward' ? 1 : -1;
      const nx = st.x + dx * s, ny = st.y + dy * s;
      lastTurn = null;
      if (blocked(nx, ny)) {
        sfx('clunk');
        tween({ x: st.x + dx * s * 0.2, y: st.y + dy * s * 0.2, a: ang }, 110);
        timers.push(setTimeout(() => tween({ x: st.x, y: st.y, a: ang }, 140), 130));
        return false;
      }
      st.x = nx; st.y = ny; st.moves++;
      trail.push([nx, ny]);
      sfx('click');
      tween({ x: nx, y: ny, a: ang }, 300);
      return true;
    }
    const qd = cmd === 'right' ? 1 : cmd === 'left' ? -1 : 2;
    lastTurn = { from: st.dir, qd };
    st.dir = turnDir(st.dir, qd);
    st.turns += qd;
    ang += qd * 90;
    sfx('tick');
    tween({ x: st.x, y: st.y, a: ang }, qd === 2 ? 420 : 320);
    return true;
  }

  function press(cmd) {
    if (running || ro()) return;
    if (L && L.prog) {
      if (queue.length >= 12) { sfx('tick'); return; }
      queue.push(cmd);
      ranIdx = -1;
      sfx('pop');
      draw();
      changed();
      return;
    }
    doCmd(cmd);
    draw();
    changed();
  }

  function play(cmds, notify) {
    running = true;
    ranIdx = -1;
    resetPos();
    draw();
    const gapMs = reducedMotion() ? 180 : 460;
    cmds.forEach((cmd, i) => timers.push(setTimeout(() => {
      ranIdx = i;
      doCmd(cmd);
      const keep = { ...disp };
      draw();
      disp = keep; placeRover();
    }, 250 + i * gapMs)));
    timers.push(setTimeout(() => {
      running = false;
      draw();
      if (notify) changed();
    }, 250 + cmds.length * gapMs + 120));
  }

  function runProgram() {
    if (running || !queue.length || ro()) return;
    sfx('whoosh');
    play(queue.slice(), true);
  }

  const api = {
    getState() { return { x: st.x, y: st.y, dir: st.dir, turns: st.turns, moves: st.moves, atTarget: atTarget(), queued: queue.length }; },
    update(np = {}) {
      p = { ...p, ...np };
      timers.splice(0).forEach(t => clearTimeout(t));
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(safety); raf = 0;
      running = false; queue = []; ranIdx = -1;
      resetPos();
      draw();
    },
    showAnswer(answer) {
      if (running) return;
      const t = target();
      const cmds = Array.isArray(answer) ? answer.filter(c => CMDS.includes(c)) : t ? roverRoute(cols(), rows(), startOf(), t, rocks()) : null;
      if (!cmds || !cmds.length) return;
      if (L && L.prog) queue = cmds.slice(0, 12);
      play(cmds, false);
    },
    destroy() {
      timers.splice(0).forEach(t => clearTimeout(t));
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(safety);
      unbinds.splice(0).forEach(u => u());
      el.replaceChildren();
    },
  };
  resetPos();
  draw();
  return api;
}
