// blocks: base-10 workspace for adding and subtracting two-digit numbers. Owner: addsub.
// Dienes pieces: green rods are tens, blue cubes are ones (the app-wide place-value colours), on soft grey mats.
// Style v2: the tens | ones column picture has white cells, green tens digits, blue ones digits and an ink rule;
// the buttons are primary blue with a darker bottom edge and press down 4 px.
// Props:
//   a, b            the two numbers (0 to 99; for '+' a + b is at most 100; for '-' b is at most a).
//   op              '+' (default) | '-'
//   interactive     default true. false (or readonly) = display only: no buttons, no taps.
//   showColumns     draw a tens | ones column layout beside the blocks (the "prepare for written methods" picture).
//                   Its answer row fills in only when the calculation is finished.
//   combined        '+': start already put together.     exchanged ('+'): start already exchanged (needs combined).
//   taken           '-': start with this many already subtracted.
//   pulse           true: the button on show (Put together, Swap) pulses. A one-off Help hint: it keeps the blocks as they are.
//   readonly
// '+': a's blocks on the top row, b's below. "Put together" slides them into one row (tens with tens, then ones
//      with ones). With 10 or more ones, "Swap 10 ones for 1 ten" fuses ten cubes into a rod.
//      State { tens, ones, value, exchanged, combined, a, b }
//        tens / ones = rods and loose cubes on the mat (so 36 + 27 put together is 5 tens and 13 ones; after the swap
//        6 tens and 3 ones). value = a + b. exchanged = how many swaps (0 or 1). combined = true after "Put together".
// '-': shows a. Tap a cube or a rod to subtract it (it fades and is crossed out); tap a faded piece to put it back.
//      Subtracting stops at b. When more ones are needed than are left, "Swap 1 ten for 10 ones" appears and
//      breaks a rod into 10 cubes (tapping a rod that would go past b makes that button pulse).
//      State { tens, ones, value, taken, takenTens, takenOnes, exchanged, a, b }
//        tens / ones / value = what is left; taken = how much has been subtracted so far.
// showAnswer(goal) animates the calculation: the whole of it, or just as far as a try-step goal asks
// ({ combined }, { exchanged }, { takenTens }, { taken }), tens before ones. It then reports the state with onChange,
// so a try step's "Show me" also completes the step. update({ showColumns }) or update({ pulse }) alone keeps the blocks.
// Debug: dev/harness.html?widget=blocks&props={"a":36,"b":27,"op":"+","showColumns":true}
//        dev/harness.html?widget=blocks&props={"a":52,"b":27,"op":"-","showColumns":true}
import { S, svgRoot, onTap, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { COL, PAL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Base-10 blocks',
  playground: { a: 36, b: 27, op: '+', showColumns: true },
  state: ['tens', 'ones', 'value', 'exchanged', 'combined', 'taken', 'takenTens', 'takenOnes', 'a', 'b'],
};

const W = 800, H = 500;
const GEO = {
  '+': { C: 17, CS: 15, RW: 17, RP: 26, CP: 26, TX: 165, OX: 446, bottoms: { a: 198, b: 398, sum: 298 }, right: 492, panelX: 530, btnY: 420 },
  '-': { C: 24, CS: 21, RW: 24, RP: 34, CP: 32, TX: 165, OX: 492, bottoms: { a: 330 }, right: 550, panelX: 572, btnY: 420 },
};
const GREEN = COL.tens, GREEN_DARK = PAL.greenDark, BLUE = COL.ones, BLUE_DARK = PAL.blueDark;
const int = (v, d = 0) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? x : d; };

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-blocks', `
    .w-blocks { width: 100%; height: 100%; }
    .w-blocks .piece { transition: transform .32s ease, opacity .25s ease; }
    .w-blocks .piece.nt { transition: none; }
    .w-blocks .piece .x { display: none; }
    .w-blocks .piece.taken .body { opacity: .26; }
    .w-blocks .piece.taken .x { display: inline; }
    .w-blocks .piece .hit { cursor: pointer; }
    .w-blocks .lab { transition: opacity .3s ease; }
    .w-blocks .wbtn { cursor: pointer; }
    .w-blocks .wbtn .face { transition: transform .08s ease; }
    .w-blocks .wbtn.down .face { transform: translateY(4px); }
    .w-blocks .wbtn.pulse { animation: w-blocks-pulse .5s ease-in-out 3; transform-box: fill-box; transform-origin: center; }
    @keyframes w-blocks-pulse { 50% { transform: scale(1.07); } }
    @media (prefers-reduced-motion: reduce) { .w-blocks .piece, .w-blocks .lab, .w-blocks .wbtn .face { transition: none; } .w-blocks .wbtn.pulse { animation: none; } }
  `);
  let p = {};
  let op = '+', G = GEO['+'];
  let A = 0, B = 0;
  let rods = [], cubes = [];   // [{ el, owner: 'a' | 'b' | 'x', hold?: {x, y}, unbind? }]
  let rodsLeft = 0, cubesLeft = 0; // '-' only: pieces at index >= left are taken
  let combined = false, exchanged = 0, busy = false;
  let timers = [];
  const root = svgRoot(W, H, 'w-blocks');
  el.appendChild(root);
  let gAll, gPieces, gLab, gPanel, gBtn, labA, labB;
  let btnUnbinds = [];

  const ro = () => !!(p.readonly || ctx.readonly || p.interactive === false);
  const later = (ms, fn) => { const t = setTimeout(fn, reducedMotion() ? 0 : ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  // ---------- pieces ----------
  function makeRod(owner) {
    const g = S('g', { class: 'piece rod nt' });
    const h = G.C * 10;
    if (op === '-' && !ro()) g.appendChild(S('rect', { class: 'hit', x: -(G.RP - G.RW) / 2, y: -10, width: G.RP, height: h + 20, fill: 'transparent' }));
    g.appendChild(S('rect', { class: 'body', x: 0, y: 0, width: G.RW, height: h, rx: 4, fill: GREEN, stroke: GREEN_DARK, 'stroke-width': 2 }));
    const lines = S('g', { class: 'body' });
    for (let k = 1; k < 10; k++) lines.appendChild(S('line', { x1: 1, y1: k * G.C, x2: G.RW - 1, y2: k * G.C, stroke: GREEN_DARK, 'stroke-opacity': 0.7, 'stroke-width': 1.5 }));
    g.appendChild(lines);
    const c = h / 2, s = G.RW * 0.72;
    g.appendChild(S('path', { class: 'x', d: `M${G.RW / 2 - s} ${c - s}L${G.RW / 2 + s} ${c + s}M${G.RW / 2 + s} ${c - s}L${G.RW / 2 - s} ${c + s}`, stroke: COL.ink, 'stroke-width': 4, 'stroke-linecap': 'round' }));
    gPieces.appendChild(g);
    const r = { el: g, owner };
    if (op === '-' && !ro()) r.unbind = onTap(g, () => tapRod(r));
    return r;
  }

  function makeCube(owner) {
    const g = S('g', { class: 'piece cube nt' });
    if (op === '-' && !ro()) g.appendChild(S('rect', { class: 'hit', x: -(G.CP - G.CS) / 2, y: -(G.C - G.CS) / 2 - 1, width: G.CP, height: G.C + 2, fill: 'transparent' }));
    g.appendChild(S('rect', { class: 'body', x: 0, y: 0, width: G.CS, height: G.CS, rx: 3.5, fill: BLUE, stroke: BLUE_DARK, 'stroke-width': 2 }));
    const m = 3;
    g.appendChild(S('path', { class: 'x', d: `M${-m} ${-m}L${G.CS + m} ${G.CS + m}M${G.CS + m} ${-m}L${-m} ${G.CS + m}`, stroke: COL.ink, 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
    gPieces.appendChild(g);
    const r = { el: g, owner };
    if (op === '-' && !ro()) r.unbind = onTap(g, () => tapCube(r));
    return r;
  }

  function removePiece(r) { r.unbind && r.unbind(); r.el.remove(); }

  const rodXY = (i, bottom) => ({ x: G.TX + i * G.RP, y: bottom - 10 * G.C });
  const cubeXY = (i, bottom) => {
    const col = Math.floor(i / 10), k = i % 10;
    return { x: G.OX + col * G.CP, y: bottom - (k + 1) * G.C + (G.C - G.CS) };
  };
  const place = (r, q) => { r.el.style.transform = `translate(${q.x}px, ${q.y}px)`; };

  // ---------- state ----------
  function counts() {
    if (op === '+') {
      return { tens: rods.length, ones: cubes.length };
    }
    return { tens: rodsLeft, ones: cubesLeft, takenTens: rods.length - rodsLeft, takenOnes: cubes.length - cubesLeft };
  }

  function state() {
    const c = counts();
    if (op === '+') return { tens: c.tens, ones: c.ones, value: c.tens * 10 + c.ones, exchanged, combined, a: A, b: B };
    const value = c.tens * 10 + c.ones;
    return { tens: c.tens, ones: c.ones, value, taken: A - value, takenTens: c.takenTens, takenOnes: c.takenOnes, exchanged, a: A, b: B };
  }

  const taken = () => (op === '-' ? A - (rodsLeft * 10 + cubesLeft) : 0);
  const need = () => (B > 0 ? B - taken() : Infinity);
  function swapNeeded() {
    if (op !== '-' || rodsLeft < 1) return false;
    const n = need();
    if (n === Infinity) return cubesLeft < 10 && cubes.length <= 19;
    return n > 0 && cubesLeft < n % 10;
  }

  function changed() { render(); ctx.onChange && ctx.onChange(state()); }

  // ---------- actions ----------
  function tapRod(r) {
    if (busy) return;
    const i = rods.indexOf(r);
    if (i < 0) return;
    if (i >= rodsLeft) { rodsLeft++; sfx('click'); changed(); return; }
    if (need() < 10) { sfx('clunk'); pulseSwap(); return; }
    rodsLeft--; sfx('pop'); changed();
  }

  function tapCube(r) {
    if (busy) return;
    const i = cubes.indexOf(r);
    if (i < 0) return;
    if (i >= cubesLeft) { cubesLeft++; sfx('click'); changed(); return; }
    if (need() < 1) { sfx('clunk'); return; }
    cubesLeft--; sfx('pop'); changed();
  }

  function pulseSwap() {
    const b = gBtn && gBtn.querySelector('.wbtn');
    if (!b) return;
    b.classList.remove('pulse');
    void b.getBBox();
    b.classList.add('pulse');
  }

  function combine(notify = true) {
    if (op !== '+' || combined) return;
    combined = true;
    cubes.forEach(c => { c.el.style.transitionDelay = reducedMotion() ? '0s' : '.3s'; });
    sfx('whoosh');
    if (notify) changed(); else render();
    later(800, () => cubes.forEach(c => { c.el.style.transitionDelay = ''; }));
  }

  // '+': ten loose cubes fuse into a rod, which slides over to the tens.
  function exchangePlus(notify = true, instant = false) {
    if (op !== '+' || !combined || cubes.length < 10) return;
    const ten = cubes.splice(0, 10);
    const rod = makeRod('x');
    const bottom = G.bottoms.sum;
    rod.hold = { x: G.OX, y: bottom - 10 * G.C };
    rods.push(rod);
    exchanged++;
    if (instant || reducedMotion()) {
      ten.forEach(removePiece); delete rod.hold;
      if (notify) changed(); else render();
      requestAnimationFrame(() => rod.el.classList.remove('nt'));
      return;
    }
    busy = true;
    rod.el.style.opacity = '0';
    if (notify) changed(); else render();
    sfx('chime');
    later(30, () => {
      rod.el.classList.remove('nt');
      rod.el.style.opacity = '1';
      ten.forEach(c => { c.el.style.opacity = '0'; });
    });
    later(330, () => { ten.forEach(removePiece); delete rod.hold; busy = false; render(); });
  }

  // '-': a rod breaks into ten cubes.
  function exchangeMinus(notify = true, instant = false) {
    if (op !== '-' || rodsLeft < 1) return;
    const [rod] = rods.splice(rodsLeft - 1, 1);
    rodsLeft--;
    const bottom = G.bottoms.a;
    const col = Math.min(2, Math.floor((cubesLeft + 5) / 10));
    const rx = G.OX + col * G.CP - (G.RW - G.CS) / 2;
    const fresh = [];
    for (let k = 0; k < 10; k++) {
      const c = makeCube('x');
      c.hold = { x: rx + (G.RW - G.CS) / 2, y: bottom - (k + 1) * G.C + (G.C - G.CS) };
      fresh.push(c);
    }
    cubes.splice(cubesLeft, 0, ...fresh);
    cubesLeft += 10;
    exchanged++;
    if (instant || reducedMotion()) {
      removePiece(rod); fresh.forEach(c => delete c.hold);
      if (notify) changed(); else render();
      requestAnimationFrame(() => fresh.forEach(c => c.el.classList.remove('nt')));
      return;
    }
    busy = true;
    fresh.forEach(c => { c.el.style.opacity = '0'; });
    if (notify) changed(); else render();
    sfx('whoosh');
    place(rod, { x: rx, y: bottom - 10 * G.C });
    later(340, () => {
      rod.el.style.opacity = '0';
      fresh.forEach(c => { c.el.classList.remove('nt'); c.el.style.opacity = '1'; });
      sfx('chime');
    });
    later(600, () => { removePiece(rod); fresh.forEach(c => delete c.hold); busy = false; render(); });
  }

  // ---------- drawing ----------
  function render() {
    const c = counts();
    if (op === '+') {
      let ia = 0, ib = 0;
      rods.forEach((r, i) => {
        if (r.hold) return place(r, r.hold);
        if (combined) return place(r, rodXY(i, G.bottoms.sum));
        place(r, r.owner === 'b' ? rodXY(ib++, G.bottoms.b) : rodXY(ia++, G.bottoms.a));
      });
      ia = 0; ib = 0;
      cubes.forEach((r, i) => {
        if (r.hold) return place(r, r.hold);
        if (combined) return place(r, cubeXY(i, G.bottoms.sum));
        place(r, r.owner === 'b' ? cubeXY(ib++, G.bottoms.b) : cubeXY(ia++, G.bottoms.a));
      });
      if (labA) { labA.style.opacity = combined ? '0' : '1'; labB.style.opacity = combined ? '0' : '1'; }
    } else {
      rods.forEach((r, i) => { r.el.classList.toggle('taken', i >= rodsLeft); if (!r.hold) place(r, rodXY(i, G.bottoms.a)); });
      cubes.forEach((r, i) => { r.el.classList.toggle('taken', i >= cubesLeft); if (r.hold) place(r, r.hold); else place(r, cubeXY(i, G.bottoms.a)); });
    }
    drawTakenPill();
    drawPanel(c);
    drawButtons(c);
  }

  function text(x, y, t, size, fill, anchor = 'middle', weight = 700, cls) {
    return S('text', { x, y, 'text-anchor': anchor, 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': weight, 'font-size': size, fill, class: cls }, [String(t)]);
  }

  function drawTakenPill() {
    gLab.querySelectorAll('.pill').forEach(n => n.remove());
    if (op !== '-') return;
    const t = taken();
    if (t <= 0) return;
    const g = S('g', { class: 'pill' });
    const x = G.TX, y = 28;
    g.appendChild(S('rect', { x, y: y - 27, width: 150, height: 54, rx: 27, fill: COL.surface, stroke: COL.line, 'stroke-width': 3 }));
    g.appendChild(S('rect', { x: x + 18, y: y - 12, width: 24, height: 24, rx: 3.5, fill: BLUE, stroke: BLUE_DARK, 'stroke-width': 2, opacity: 0.3 }));
    g.appendChild(S('path', { d: `M${x + 15} ${y - 15}L${x + 45} ${y + 15}M${x + 45} ${y - 15}L${x + 15} ${y + 15}`, stroke: COL.ink, 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
    g.appendChild(text(x + 96, y + 1, t, 38, COL.ink, 'middle', 800));
    gLab.appendChild(g);
  }

  function drawPanel(c) {
    gPanel.replaceChildren();
    if (!p.showColumns) return;
    // The tens | ones column picture (as Synthesis IMG_5004): white cells, green tens, blue ones, an ink rule.
    const x1 = W - 10;
    const cw = op === '+' ? 84 : 74, ch = 74, gap = 8;
    const ox = x1 - cw / 2, tx = ox - cw - gap, sx = tx - cw / 2 - 30;
    const rows = op === '+' ? { head: 40, a: 116, b: 198, line: 248, ans: 300 } : { head: 54, a: 146, b: 226, line: 274, ans: 324 };
    const cell = (x, y, empty) => gPanel.appendChild(S('rect', {
      x: x - cw / 2, y: y - ch / 2, width: cw, height: ch, rx: 12,
      fill: empty ? COL.surface2 : COL.surface, stroke: empty ? COL.lineStrong : COL.line, 'stroke-width': 3, 'stroke-dasharray': empty ? '9 7' : null,
    }));
    gPanel.appendChild(text(tx, rows.head, 'Tens', 26, GREEN, 'middle', 700));
    gPanel.appendChild(text(ox, rows.head, 'Ones', 26, BLUE, 'middle', 700));
    const at = Math.floor(A / 10), ao = A % 10, bt = Math.floor(B / 10), bo = B % 10;
    const digit = (x, y, d, col, size = 56) => gPanel.appendChild(text(x, y, d, size, col, 'middle', 700));
    [rows.a, rows.b].forEach(y => { cell(tx, y); cell(ox, y); });
    // Row a, with the exchange marks for subtraction.
    if (op === '-' && exchanged > 0) {
      const nt = at - exchanged;
      digit(tx, rows.a, at, COL.ink3);
      gPanel.appendChild(S('line', { x1: tx - 18, y1: rows.a + 20, x2: tx + 18, y2: rows.a - 20, stroke: COL.ink, 'stroke-width': 4, 'stroke-linecap': 'round' }));
      digit(tx, rows.a - ch / 2 - 15, nt, GREEN, 30);
      digit(ox, rows.a, ao, BLUE);
      digit(ox - cw / 2 + 15, rows.a - ch / 2 + 17, '1', BLUE, 24);
    } else {
      if (at > 0) digit(tx, rows.a, at, GREEN);
      digit(ox, rows.a, ao, BLUE);
    }
    gPanel.appendChild(text(sx, rows.b, op === '+' ? '+' : '\u2212', 52, COL.ink, 'middle', 700));
    if (bt > 0) digit(tx, rows.b, bt, GREEN);
    digit(ox, rows.b, bo, BLUE);
    gPanel.appendChild(S('line', { x1: sx - 22, y1: rows.line, x2: x1 - 2, y2: rows.line, stroke: COL.ink, 'stroke-width': 4, 'stroke-linecap': 'round' }));
    // Answer row: filled in only when the calculation is finished.
    const done = op === '+' ? combined : (B > 0 && taken() === B);
    if (!done) { cell(tx, rows.ans, true); cell(ox, rows.ans, true); return; }
    cell(tx, rows.ans); cell(ox, rows.ans);
    if (c.tens > 0 || op === '-') digit(tx, rows.ans, c.tens, GREEN);
    // 13 ones before the swap: show it so the swap has a reason.
    digit(ox, rows.ans, c.ones, BLUE, c.ones >= 10 ? 42 : 56);
    // The exchanged ten is written small under the tens column (UK column addition).
    if (op === '+' && exchanged > 0) digit(tx, rows.ans + ch / 2 + 20, '1', GREEN, 28);
  }

  function button(label, cx, y, w, onPress) {
    // Primary control (style v2): blue face, darker bottom edge, presses down 4 px.
    const g = S('g', { class: 'wbtn', role: 'button', tabindex: 0 });
    const h = 64;
    g.appendChild(S('rect', { class: 'edge', x: cx - w / 2, y: y + 5, width: w, height: h, rx: 18, fill: PAL.blueDark }));
    const face = S('g', { class: 'face' });
    face.appendChild(S('rect', { x: cx - w / 2, y, width: w, height: h, rx: 18, fill: PAL.blue }));
    face.appendChild(text(cx, y + h / 2 + 1, label, 28, '#ffffff', 'middle', 700));
    g.appendChild(face);
    const up = () => g.classList.remove('down');
    g.addEventListener('pointerdown', () => g.classList.add('down'));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => g.addEventListener(n, up));
    gBtn.appendChild(g);
    btnUnbinds.push(onTap(g, () => { if (!busy) onPress(); }));
  }

  function drawButtons() {
    btnUnbinds.splice(0).forEach(u => u());
    gBtn.replaceChildren();
    if (ro()) return;
    const cx = (20 + G.right) / 2;
    if (op === '+') {
      if (!combined) button('Put together', cx, G.btnY, 300, () => combine());
      else if (cubes.length >= 10) button('Swap 10 ones for 1 ten', cx, G.btnY, 380, () => exchangePlus());
    } else if (swapNeeded()) {
      button('Swap 1 ten for 10 ones', cx, G.btnY, 380, () => exchangeMinus());
    }
  }

  function build() {
    clearTimers();
    busy = false;
    [...rods, ...cubes].forEach(r => r.unbind && r.unbind());
    btnUnbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    root.classList.toggle('ro', ro());
    op = p.op === '-' || p.op === '−' ? '-' : '+';
    G = GEO[op];
    A = clamp(int(p.a, 0), 0, 99);
    B = clamp(int(p.b, 0), 0, op === '+' ? 100 - A : A);
    const dx = p.showColumns ? 0 : Math.round((W - (G.right - 20)) / 2 - 20);
    gAll = S('g', { transform: `translate(${dx} 0)` });
    gPieces = S('g'); gLab = S('g'); gBtn = S('g');
    gPanel = S('g', { transform: `translate(${-dx} 0)` });
    const gZone = S('g');
    gAll.append(gZone, gLab, gPieces, gBtn, gPanel);
    {
      const top = op === '+' ? 18 : 76, bot = op === '+' ? 410 : 344;
      const tEnd = G.TX + (op === '+' ? 9 : 8) * G.RP + G.RW + 12;
      // Soft grey mats: one for the tens, one for the ones.
      gZone.appendChild(S('rect', { x: G.TX - 14, y: top, width: tEnd + 2 - (G.TX - 14), height: bot - top, rx: 18, fill: COL.surface2 }));
      gZone.appendChild(S('rect', { x: G.OX - 14, y: top, width: G.CP + G.CS + 28, height: bot - top, rx: 18, fill: COL.surface2 }));
    }
    root.appendChild(gAll);
    rods = []; cubes = []; combined = false; exchanged = 0;
    const at = Math.floor(A / 10), ao = A % 10, bt = Math.floor(B / 10), bo = B % 10;
    labA = labB = null;
    if (op === '+') {
      for (let i = 0; i < at; i++) rods.push(makeRod('a'));
      for (let i = 0; i < bt; i++) rods.push(makeRod('b'));
      for (let i = 0; i < ao; i++) cubes.push(makeCube('a'));
      for (let i = 0; i < bo; i++) cubes.push(makeCube('b'));
      labA = text(136, G.bottoms.a - 85, A, 62, COL.ink, 'end', 800, 'lab');
      labB = text(136, G.bottoms.b - 85, `+ ${B}`, 62, COL.ink, 'end', 800, 'lab');
      gLab.append(labA, labB);
      if (p.combined) {
        combined = true;
        if (p.exchanged && cubes.length >= 10) exchangePlus(false, true);
      }
    } else {
      for (let i = 0; i < at; i++) rods.push(makeRod('a'));
      for (let i = 0; i < ao; i++) cubes.push(makeCube('a'));
      rodsLeft = rods.length; cubesLeft = cubes.length;
      gLab.appendChild(text(136, G.bottoms.a - 150, A, 74, COL.ink, 'end', 800));
      if (B > 0) gLab.appendChild(text(136, G.bottoms.a - 82, `− ${B}`, 46, COL.ink2, 'end', 800));
      const t0 = clamp(int(p.taken, 0), 0, B > 0 ? B : A);
      if (t0 > 0) applyTake(t0);
    }
    render();
    requestAnimationFrame(() => [...rods, ...cubes].forEach(r => { if (!r.hold) r.el.classList.remove('nt'); }));
  }

  // '-' without animation: subtract n, ones first, swapping a ten when needed.
  function applyTake(n) {
    let left = n;
    const onesWanted = left % 10;
    if (cubesLeft < onesWanted && rodsLeft > 0) exchangeMinus(false, true);
    const o = Math.min(onesWanted, cubesLeft);
    cubesLeft -= o; left -= o;
    while (left >= 10 && rodsLeft > 0) { rodsLeft--; left -= 10; }
    while (left > 0 && cubesLeft > 0) { cubesLeft--; left--; }
  }

  const api = {
    getState: state,
    update(np) {
      const keys = Object.keys(np);
      const pulse = !!np.pulse;
      const rest = { ...np }; delete rest.pulse;
      // Cosmetic changes keep Finn's blocks where they are.
      if (keys.every(k => k === 'pulse' || k === 'showColumns') && gAll) {
        p = { ...p, ...rest };
        const dx = p.showColumns ? 0 : Math.round((W - (G.right - 20)) / 2 - 20);
        gAll.setAttribute('transform', `translate(${dx} 0)`);
        gPanel.setAttribute('transform', `translate(${-dx} 0)`);
        render();
      } else {
        p = { ...p, ...rest };
        build();
      }
      if (pulse) pulseSwap();
    },
    showAnswer(goal) {
      clearTimers();
      const g = goal && typeof goal === 'object' && !Array.isArray(goal) ? goal : {};
      const done = () => { if (!busy) { render(); ctx.onChange && ctx.onChange(state()); } else later(200, done); };
      if (op === '+') {
        const wantSwap = !('combined' in g) || 'exchanged' in g || 'value' in g || 'tens' in g;
        if (!combined) {
          combine(false);
          later(1000, () => { if (wantSwap && cubes.length >= 10) exchangePlus(false); later(500, done); });
        } else if (wantSwap && cubes.length >= 10) { exchangePlus(false); later(500, done); } else done();
        return;
      }
      if (B <= 0) return;
      const takenTens = () => rods.length - rodsLeft;
      // Just a swap, or just some tens: stop there.
      if ('exchanged' in g && !('taken' in g)) {
        if (exchanged < 1 && rodsLeft > 0) exchangeMinus(false);
        later(700, done);
        return;
      }
      if ('takenTens' in g && !('taken' in g)) {
        const want = typeof g.takenTens === 'number' ? g.takenTens : Math.floor(B / 10);
        const tens = () => {
          if (takenTens() >= want || rodsLeft <= 0) { done(); return; }
          rodsLeft--; sfx('pop'); render(); later(320, tens);
        };
        tens();
        return;
      }
      // The whole subtraction: tens first, then swap a ten if the ones run out, then the ones.
      const step = () => {
        const n = need();
        if (n <= 0) { done(); return; }
        if (busy) { later(200, step); return; }
        if (n >= 10 && rodsLeft > 0) { rodsLeft--; sfx('pop'); render(); later(320, step); return; }
        if (cubesLeft < n && rodsLeft > 0) { exchangeMinus(false); later(750, step); return; }
        if (cubesLeft > 0) { cubesLeft--; sfx('pop'); render(); later(220, step); return; }
        done();
      };
      step();
    },
    destroy() {
      clearTimers();
      [...rods, ...cubes].forEach(r => r.unbind && r.unbind());
      btnUnbinds.splice(0).forEach(u => u());
      el.replaceChildren();
    },
  };
  p = { ...props };
  build();
  return api;
}
