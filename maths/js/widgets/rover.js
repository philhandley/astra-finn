// rover: a Moon-base floor grid seen from above, with a rover that faces N, E, S or W (up, right, down, left on screen).
// Look (style v2): a clean white map with light grid squares, outlined grey moon rocks, a yellow flag and a sticker-style rover;
//        white push buttons with ink arrows. Clockwise turns are blue, anticlockwise turns pink (buttons and turn arcs match).
// Props: cols (default 6), rows (default 5), start { x, y, dir } (x from the left, y from the top, dir 'N' | 'E' | 'S' | 'W'),
//        target { x, y } (a flag), rocks (array of { x, y } blocked squares),
//        controls (array from 'forward', 'back', 'left' (quarter turn anticlockwise), 'right' (quarter turn clockwise), 'half'),
//        program (true: taps queue arrow cards and Go! runs them from the start; otherwise each tap moves at once),
//        showTurnArc (draw each turn as a curved arrow from the old heading to the new one, with a right-angle mark
//            and a small "clockwise" / "anticlockwise" label), trail (default true: dots where it has been),
//        ahead (true: light the squares in front of the rover with a dashed blue arrow, the way Forward would take it),
//        answerCmds (array of commands that showAnswer acts out from the start when there is no flag, e.g. ['right', 'right']
//            for "a half turn"), readonly.
// Driving off the grid or into a rock gives a gentle bump and no move.
// State: { x, y, dir, turns, moves, atTarget, queued }  (turns = quarter turns clockwise minus anticlockwise since the start;
//         moves = squares moved; queued = cards waiting in program mode)
// Debug: dev/harness.html?widget=rover&props={"controls":["forward","left","right"],"target":{"x":4,"y":1},"showTurnArc":true}
import { S, svgRoot, onTap, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { artInner } from '../core/art.js';
import { COL, PAL, FONT } from '../core/theme.js';
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
const CW = PAL.blue, ACW = PAL.pink; // turn colours: clockwise, anticlockwise
const ICON_COL = { forward: COL.ink, back: COL.ink, left: ACW, right: CW, half: CW };

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

function icon(cmd, cx, cy, s = 1, colour = ICON_COL[cmd] || COL.ink) {
  const g = S('g', { transform: `translate(${cx} ${cy}) scale(${s})` });
  if (cmd === 'forward' || cmd === 'back') {
    g.appendChild(S('path', { d: 'M0 -25L21 -2H8V23H-8V-2H-21Z', fill: colour, stroke: colour, 'stroke-width': 2, 'stroke-linejoin': 'round', transform: cmd === 'back' ? 'rotate(180)' : '' }));
  } else {
    const spec = cmd === 'right' ? [70, 330] : cmd === 'left' ? [-70, -330] : [-90, 90];
    const a = arcArrow(0, cmd === 'half' ? 8 : 2, 18, spec[0], spec[1], 17);
    g.appendChild(S('path', { d: a.d, fill: 'none', stroke: colour, 'stroke-width': 7, 'stroke-linecap': 'round' }));
    g.appendChild(S('path', { d: a.head, fill: colour, stroke: colour, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  }
  return g;
}

// The rover, facing up (N), drawn in a box about 100 units across: an outlined sticker with a red nose arrow.
function roverSprite() {
  const ink = { stroke: COL.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' };
  const g = S('g');
  for (const [x, y] of [[-46, -33], [32, -33], [-46, 8], [32, 8]]) g.appendChild(S('rect', { x, y, width: 14, height: 25, rx: 5, fill: COL.ink }));
  g.appendChild(S('path', { d: 'M0 -62L17 -40H-17Z', fill: PAL.red, ...ink }));
  g.appendChild(S('rect', { x: -31, y: -38, width: 62, height: 74, rx: 15, fill: PAL.yellow, ...ink }));
  g.appendChild(S('rect', { x: -20, y: 4, width: 40, height: 24, rx: 4, fill: PAL.blue, stroke: COL.ink, 'stroke-width': 3 }));
  g.appendChild(S('path', { d: 'M-7 4V28M7 4V28M-20 16H20', stroke: '#fff', 'stroke-width': 2 }));
  g.appendChild(S('circle', { cx: 0, cy: -18, r: 10, fill: '#fff', stroke: COL.ink, 'stroke-width': 3.5 }));
  g.appendChild(S('circle', { cx: 0, cy: -18, r: 4.5, fill: COL.ink }));
  return g;
}

// A Synthesis-style push button: white face, light border, solid bottom edge (blue face for the main action).
function ctlButton({ x, y, w, h, primary = false, off = false, aria, cls = '' }, children = []) {
  const g = S('g', { class: `ctl btn3 ${cls}${off ? ' off' : ''}`, role: 'button', 'aria-label': aria }, [
    S('rect', { x, y: y + 5, width: w, height: h, rx: 16, fill: primary ? PAL.blueDark : COL.line }),
    S('g', { class: 'face' }, [S('rect', { x, y, width: w, height: h, rx: 16, fill: primary ? PAL.blue : COL.surface, stroke: primary ? PAL.blue : COL.line, 'stroke-width': 3 }), ...children]),
  ]);
  if (!off) {
    const up = () => g.classList.remove('down');
    g.addEventListener('pointerdown', () => g.classList.add('down'));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => g.addEventListener(t, up));
  }
  return g;
}
const textW = (str, fs) => str.length * fs * 0.62; // Lexend bold, roughly

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-rover', `
    .w-rover { width: 100%; height: 100%; }
    .w-rover .ctl { cursor: pointer; }
    .w-rover .ctl .face { transition: transform .08s ease; }
    .w-rover .ctl.down .face { transform: translateY(4px); }
    .w-rover .ctl.off { opacity: .45; cursor: default; }
    .w-rover .deco { pointer-events: none; }
    @media (prefers-reduced-motion: reduce) { .w-rover .ctl .face { transition: none; } }
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
    root.appendChild(S('rect', { x: gx, y: gy, width: cell * C, height: cell * R, rx: 12, fill: COL.surface }));
    const lines = [];
    for (let i = 1; i < C; i++) lines.push(`M${f1(gx + i * cell)} ${f1(gy)}V${f1(gy + cell * R)}`);
    for (let j = 1; j < R; j++) lines.push(`M${f1(gx)} ${f1(gy + j * cell)}H${f1(gx + cell * C)}`);
    if (lines.length) root.appendChild(S('path', { d: lines.join(''), stroke: COL.line, 'stroke-width': 3 }));
    root.appendChild(S('rect', { x: gx, y: gy, width: cell * C, height: cell * R, rx: 12, fill: 'none', stroke: COL.lineStrong, 'stroke-width': 4 }));
    // Trail.
    if (p.trail !== false) {
      trail.slice(0, -1).forEach(([x, y]) => root.appendChild(S('circle', { class: 'deco', cx: f1(L.cx(x)), cy: f1(L.cy(y)), r: Math.max(5, cell * 0.09), fill: PAL.blue, 'fill-opacity': 0.3 })));
    }
    if (p.ahead) drawAhead();
    // Rocks and flag.
    const art = (name, x, y, size) => {
      const g = S('g', { class: 'deco', transform: `translate(${f1(L.cx(x) - size / 2)} ${f1(L.cy(y) - size / 2)}) scale(${size / 100})` });
      g.innerHTML = artInner(name);
      root.appendChild(g);
    };
    rocks().forEach(r => { if (r.x >= 0 && r.y >= 0 && r.x < C && r.y < R) art('asteroid', r.x, r.y, cell * 0.8); });
    const t = target();
    if (t && t.x >= 0 && t.y >= 0 && t.x < C && t.y < R) {
      if (atTarget() && !running) root.appendChild(S('rect', { class: 'deco', x: f1(gx + t.x * cell + 4), y: f1(gy + t.y * cell + 4), width: f1(cell - 8), height: f1(cell - 8), rx: 10, fill: COL.goodSoft, stroke: COL.good, 'stroke-width': 4 }));
      art('flag', t.x, t.y, cell * 0.78);
    }
    overlay = S('g', { class: 'deco' });
    root.appendChild(overlay);
    roverG = S('g', { class: 'deco' }, [roverSprite()]);
    root.appendChild(roverG);
    placeRover();

    if (L.showCtl) {
      // "Start again" button beside the grid (words, not a house: the app's own Home button is a house).
      const rw = 104, rx = Math.min(gx + cell * C + 16, W - rw - 6), ry = gy;
      const rb = ctlButton({ x: rx, y: ry, w: rw, h: 72, aria: 'Start again', off: running }, [
        S('text', { x: rx + rw / 2, y: ry + 31, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 22, fill: COL.ink }, ['Start']),
        S('text', { x: rx + rw / 2, y: ry + 56, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 22, fill: COL.ink }, ['again']),
      ]);
      unbinds.push(onTap(rb, () => { if (running) return; resetPos(); ranIdx = -1; sfx('click'); draw(); changed(); }));
      root.appendChild(rb);
      drawButtons();
      if (L.prog) drawProgram();
    }
  }

  // The squares the rover would drive over going forward (until a rock or the edge), with a dashed arrow.
  function drawAhead() {
    const [dx, dy] = DV[st.dir];
    let n = 0;
    while (n < 12 && !blocked(st.x + dx * (n + 1), st.y + dy * (n + 1))) n++;
    if (!n) return;
    const { cell, gx, gy } = L;
    const g = S('g', { class: 'deco' });
    for (let k = 1; k <= n; k++) {
      const x = st.x + dx * k, y = st.y + dy * k;
      g.appendChild(S('rect', { x: f1(gx + x * cell + 5), y: f1(gy + y * cell + 5), width: f1(cell - 10), height: f1(cell - 10), rx: 10, fill: COL.focusSoft }));
    }
    const hd = Math.max(18, cell * 0.3), sw = Math.max(6, cell * 0.08);
    const x0 = L.cx(st.x) + dx * cell * 0.55, y0 = L.cy(st.y) + dy * cell * 0.55;
    const xe = L.cx(st.x + dx * n), ye = L.cy(st.y + dy * n);
    g.appendChild(S('path', { d: `M${f1(x0)} ${f1(y0)}L${f1(xe - dx * hd * 0.4)} ${f1(ye - dy * hd * 0.4)}`, stroke: COL.focus, 'stroke-width': f1(sw), 'stroke-dasharray': `${f1(sw * 1.6)} ${f1(sw * 1.4)}`, 'stroke-linecap': 'round', fill: 'none' }));
    const tip = [xe + dx * hd * 0.6, ye + dy * hd * 0.6], b = [xe - dx * hd * 0.5, ye - dy * hd * 0.5];
    g.appendChild(S('path', { d: `M${f1(tip[0])} ${f1(tip[1])}L${f1(b[0] - dy * hd * 0.7)} ${f1(b[1] + dx * hd * 0.7)}L${f1(b[0] + dy * hd * 0.7)} ${f1(b[1] - dx * hd * 0.7)}Z`, fill: COL.focus, stroke: COL.focus, 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    root.appendChild(g);
  }

  function drawButtons() {
    const ctl = controls();
    const n = ctl.length;
    // Each button is as wide as its word needs, so "anticlockwise" stays big enough to read.
    const gap = 12, bh = 92, avail = W - 16 - (n - 1) * gap;
    let fs = 23;
    const need = f => ctl.map(c => Math.max(112, textW(LABEL[c], f) + 26));
    let ws = need(fs);
    while (ws.reduce((a, b) => a + b, 0) > avail && fs > 16) { fs -= 0.5; ws = need(fs); }
    const extra = Math.max(0, (avail - ws.reduce((a, b) => a + b, 0)) / n);
    ws = ws.map(w => Math.min(w + extra, 210));
    const total = ws.reduce((a, b) => a + b, 0) + (n - 1) * gap;
    let x = (W - total) / 2;
    const y0 = H - bh - 8;
    ctl.forEach((cmd, i) => {
      const bw = ws[i], label = LABEL[cmd];
      const g = ctlButton({ x, y: y0, w: bw, h: bh, off: running, aria: cmd === 'left' ? 'Quarter turn anticlockwise' : cmd === 'right' ? 'Quarter turn clockwise' : label }, [
        icon(cmd, x + bw / 2, y0 + 34, 1),
        S('text', { x: x + bw / 2, y: y0 + bh - 13, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': f1(fs), fill: COL.ink }, [label]),
      ]);
      unbinds.push(onTap(g, () => press(cmd)));
      root.appendChild(g);
      x += bw + gap;
    });
  }

  function drawProgram() {
    const y = 310, cs = 46, step = 50;
    root.appendChild(S('rect', { x: 10, y: y - 4, width: W - 252, height: cs + 26, rx: 16, fill: COL.surface2, stroke: COL.line, 'stroke-width': 3 }));
    queue.forEach((cmd, i) => {
      const x = 20 + i * step;
      const done = running ? i <= ranIdx : false;
      root.appendChild(S('rect', { class: 'deco', x, y: y + 9, width: cs, height: cs, rx: 10, fill: done ? COL.focusSoft : COL.surface, stroke: done ? COL.focus : COL.lineStrong, 'stroke-width': 3 }));
      root.appendChild(icon(cmd, x + cs / 2, y + 9 + cs / 2, 0.74));
    });
    const off = running || !queue.length;
    const undo = ctlButton({ x: W - 232, y: y - 6, w: 98, h: 68, off, aria: 'Undo' }, [
      S('text', { x: W - 183, y: y + 36, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 24, fill: COL.ink }, ['Undo']),
    ]);
    unbinds.push(onTap(undo, () => { if (running || !queue.length) return; queue.pop(); sfx('click'); draw(); changed(); }));
    root.appendChild(undo);
    const go = ctlButton({ x: W - 124, y: y - 6, w: 114, h: 68, primary: true, off, aria: 'Go' }, [
      S('text', { x: W - 67, y: y + 39, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: '#fff' }, ['Go!']),
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
    const col = lastTurn.qd > 0 ? CW : ACW;
    overlay.appendChild(S('line', { x1: f1(cx), y1: f1(cy), ...(([x, y]) => ({ x2: f1(x), y2: f1(y) }))(at(cx, cy, r, a0)), stroke: COL.ink3, 'stroke-width': 3, 'stroke-dasharray': '7 6' }));
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
    words.forEach((w, i) => overlay.appendChild(S('text', { x: 14, y: 32 + i * 30, 'font-family': FONT.display, 'font-weight': i ? 700 : 600, 'font-size': 24, fill: i ? col : COL.ink2 }, [w])));
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
      // A turning goal such as { turns: 2 }, { dir: 'E', turns: 1 } or { turns: { gte: 4 } } is acted out from the start.
      let turnCmds = null;
      if (answer && typeof answer === 'object' && !Array.isArray(answer) && !answer.atTarget && ('turns' in answer || 'dir' in answer)) {
        let tv = answer.turns;
        if (tv && typeof tv === 'object') tv = tv.eq ?? tv.gte ?? tv.lte;
        if (tv !== undefined && tv !== null && Number.isFinite(+tv)) {
          const n = clamp(Math.round(+tv), -8, 8);
          turnCmds = Array(Math.abs(n)).fill(n >= 0 ? 'right' : 'left');
        } else if (DIRS.includes(answer.dir)) {
          const q = (((DIRS.indexOf(answer.dir) - DIRS.indexOf(startOf().dir)) % 4) + 4) % 4;
          turnCmds = q === 3 ? ['left'] : Array(q).fill('right');
        }
      }
      if (turnCmds && !turnCmds.length) { resetPos(); draw(); changed(); return; } // { turns: 0 }: back to the start
      const cmds = turnCmds ? turnCmds
        : Array.isArray(answer) ? answer.filter(c => CMDS.includes(c))
        : Array.isArray(p.answerCmds) ? p.answerCmds.filter(c => CMDS.includes(c))
        : t ? roverRoute(cols(), rows(), startOf(), t, rocks()) : null;
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
