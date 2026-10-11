// placevalue: tens and ones columns with base-10 (Dienes) blocks or place-value counters.
// Props:
//   tens, ones, hundreds   starting counts. Ones may be 10 or more (3 tens and 14 ones is 44) until swapped.
//   showHundreds           add a Hundreds column (orange flats). Default false.
//   interactive            default true: + and − buttons under each column, swap buttons. false = display only.
//   showDigits             the count under each column, in the column colour (between − and + when interactive).
//   showValue              the total, big.
//   showExpanded           "40 + 7" in column colours ("40 + 7 = 47" with showValue too).
//   max                    largest value the + buttons can reach (default 99, or 999 with showHundreds).
//   look                   'blocks' (default: green rods and blue cubes) or 'counters' (circles marked 10 and 1).
//   readonly
// Style v2 (white surface): each column is a white card with a 3 px border and heading in its place-value colour
// (hundreds orange, tens green, ones blue); chunky white +/− buttons; the swap button is primary blue.
// Interaction: + and − under each column. When there are 10 or more ones a blue "Swap 10 ones for 1 ten" button
// appears (tapping the dashed column of ten ones does the same); ten cubes fuse into a rod and fly to the Tens.
// Tap a rod to be offered "Swap 1 ten for 10 ones". With hundreds, the same for 10 tens and 1 hundred.
// State: { hundreds, tens, ones, value }
// showAnswer(n) (or { tens, ones, hundreds }) animates to the standard partition of n.
// Debug: dev/harness.html?widget=placevalue&props={"tens":3,"ones":14,"showDigits":true,"showExpanded":true,"showValue":true}
import { S, svgRoot, onTap, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { COL, PAL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Tens and ones',
  playground: { tens: 2, ones: 7, showDigits: true, showValue: true, interactive: true },
  state: ['hundreds', 'tens', 'ones', 'value'],
};

const W = 1000;
const LIM = { hundreds: 9, tens: 19, ones: 99 };
const PLACE = { hundreds: 100, tens: 10, ones: 1 };
const NAME = { hundreds: 'Hundreds', tens: 'Tens', ones: 'Ones' };
const COLR = { hundreds: COL.hundreds, tens: COL.tens, ones: COL.ones };
const DARK = { hundreds: PAL.orangeDark, tens: PAL.greenDark, ones: PAL.blueDark };
const int = (v, d = 0) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : d; };

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-placevalue', `
    .w-placevalue { width: 100%; height: 100%; }
    .w-placevalue .pv-btn { cursor: pointer; }
    .w-placevalue .pv-btn.off { opacity: .35; cursor: default; }
    .w-placevalue .pv-btn .pv-face { transition: transform .08s ease; }
    .w-placevalue .pv-btn:not(.off):active .pv-face { transform: translateY(4px); }
    .w-placevalue .pv-tap { cursor: pointer; }
    .w-placevalue.ro .pv-tap { cursor: default; }
    .w-placevalue .pv-halo { animation: w-pv-halo 1.6s ease-in-out infinite; }
    .w-placevalue .pv-pop { animation: w-pv-pop .28s ease-out; transform-box: fill-box; transform-origin: center; }
    .w-placevalue .pv-ready { animation: w-pv-ready 1.4s ease-in-out infinite; }
    @keyframes w-pv-halo { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
    @keyframes w-pv-ready { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
    @keyframes w-pv-pop { 0% { transform: scale(.5); opacity: .3; } 70% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .w-placevalue .pv-halo, .w-placevalue .pv-pop, .w-placevalue .pv-ready { animation: none; } }
  `);
  let p = {};
  let c = { hundreds: 0, tens: 0, ones: 0 };
  let offer = null;          // 'breakTen' | 'breakHundred' after tapping a rod or flat
  let offerTimer = 0;
  let pop = null;            // { key, index } block to pop on next draw
  const timers = new Set();
  const root = svgRoot(W, 640, 'w-placevalue');
  el.appendChild(root);
  const unbinds = [];
  let geo = null;            // last layout, for animations

  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const ro = () => !!(p.readonly || ctx.readonly || p.interactive === false);
  const cols = () => (p.showHundreds ? ['hundreds', 'tens', 'ones'] : ['tens', 'ones']);
  const maxV = () => { const m = int(p.max, p.showHundreds ? 999 : 99); return m > 0 ? m : 99; };
  const value = () => c.hundreds * 100 + c.tens * 10 + c.ones;
  const counters = () => p.look === 'counters';

  function setFromProps(np) {
    p = { ...p, ...np };
    for (const k of ['hundreds', 'tens', 'ones']) if (k in np) c[k] = clamp(int(np[k]), 0, LIM[k]);
    if (!p.showHundreds && 'showHundreds' in np) c.hundreds = 0;
    offer = null;
  }

  // ---------- layout ----------
  function layout() {
    const ks = cols();
    const n = ks.length;
    const margin = 16, gap = 28;
    const pw = (W - 2 * margin - (n - 1) * gap) / n;
    const inter = !ro();
    const slot = inter ? 104 : 0;     // the swap button lives here
    const py = slot + 4;
    const HEAD = 64, BH = 300, PH = HEAD + BH + 18;
    let y = py + PH;
    let digitsY = null, btnY = null;
    if (inter) { btnY = y + 20 + 40; y += 20 + 86; }            // − digit + row (digit only with showDigits)
    else if (p.showDigits) { digitsY = y + 14 + 42; y += 14 + 84; } // digit pill under each card
    const valueY = p.showValue || p.showExpanded ? y + 18 + 42 : null;
    if (valueY) y += 18 + 84;
    const VH = y + 6;
    const panels = {};
    ks.forEach((k, i) => { panels[k] = { x: margin + i * (pw + gap), y: py, w: pw, h: PH, by0: py + HEAD, by1: py + HEAD + BH }; });

    // Unit size for blocks: shrink when there are many rods or many columns of ones.
    let u = 26;
    if (!counters()) {
      if (c.tens > 0) u = Math.min(u, (pw - 24 + 12) / c.tens - 12);
      const oc = Math.ceil(c.ones / 10);
      if (oc > 0) u = Math.min(u, (pw - 24 + 10) / oc - 10);
      u = clamp(u, 7, 26);
    }
    const cell = u + 3;
    // Item positions per column: { x, y, w, h } in viewBox units (x, y = top left).
    const items = { hundreds: [], tens: [], ones: [] };
    for (const k of ks) {
      const P = panels[k];
      const count = c[k];
      if (counters()) {
        const per = 5;
        const ncol = Math.max(1, Math.ceil(count / per));
        const pairGap = 10;
        const rFit = Math.min((BH - 4) / (per * 2.25), (P.w - 24 - Math.floor((ncol - 1) / 2) * pairGap) / (ncol * 2.25));
        const r = clamp(rFit, 9, 30);
        const sp = r * 2.25;
        const totalW = ncol * sp + Math.floor((ncol - 1) / 2) * pairGap;
        const x0 = P.x + (P.w - totalW) / 2;
        const y0 = P.by0 + (BH - per * sp) / 2;
        for (let i = 0; i < count; i++) {
          const col = Math.floor(i / per), row = i % per;
          const cx = x0 + col * sp + Math.floor(col / 2) * pairGap + sp / 2, cy = y0 + row * sp + sp / 2;
          items[k].push({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, r });
        }
      } else if (k === 'hundreds') {
        const g = count <= 1 ? 1 : count <= 4 ? 2 : 3;
        const F = Math.min((P.w - 24 - (g - 1) * 10) / g, (BH - 4 - (g - 1) * 10) / g, 10 * cell - 3);
        const totalW = g * F + (g - 1) * 10, rowsN = Math.ceil(count / g) || 1;
        const totalH = rowsN * F + (rowsN - 1) * 10;
        const x0 = P.x + (P.w - totalW) / 2, y0 = P.by1 - 4 - totalH;
        for (let i = 0; i < count; i++) items[k].push({ x: x0 + (i % g) * (F + 10), y: y0 + Math.floor(i / g) * (F + 10), w: F, h: F });
      } else if (k === 'tens') {
        const sx = u + 12;
        const totalW = count * sx - 12;
        const x0 = P.x + (P.w - totalW) / 2;
        const rodH = 10 * cell - 3;
        for (let i = 0; i < count; i++) items[k].push({ x: x0 + i * sx, y: P.by1 - 4 - rodH, w: u, h: rodH });
      } else {
        const ncol = Math.ceil(count / 10);
        const sx = u + 10;
        const totalW = ncol * sx - 10;
        const x0 = P.x + (P.w - totalW) / 2;
        for (let i = 0; i < count; i++) {
          const col = Math.floor(i / 10), row = i % 10;
          items[k].push({ x: x0 + col * sx, y: P.by1 - 4 - (row + 1) * cell + 3, w: u, h: u });
        }
      }
    }
    return { ks, pw, slot, panels, digitsY, btnY, valueY, VH, u, cell, items };
  }

  // ---------- drawing helpers ----------
  const HI = 'rgba(255,255,255,.28)';   // tiny highlight stripe on blocks
  function drawItem(k, it, i) {
    const g = S('g', { 'data-k': `${k[0]}${i}` });
    if (counters()) {
      const cx = it.x + it.w / 2, cy = it.y + it.h / 2, r = it.r;
      g.appendChild(S('circle', { cx, cy, r, fill: COLR[k], stroke: DARK[k], 'stroke-width': 3 }));
      const label = String(PLACE[k]);
      const fs = r * (label.length === 1 ? 1.05 : label.length === 2 ? 0.86 : 0.62);
      g.appendChild(S('text', { x: cx, y: cy + fs * 0.36, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': fs, fill: '#fff' }, [label]));
      return g;
    }
    if (k === 'hundreds') {
      g.appendChild(S('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 4, fill: COL.hundreds, stroke: DARK[k], 'stroke-width': 2.5 }));
      let d = '';
      for (let j = 1; j < 10; j++) {
        const t = (it.w * j) / 10;
        d += `M${it.x + t} ${it.y}v${it.h}M${it.x} ${it.y + t}h${it.w}`;
      }
      g.appendChild(S('path', { d, stroke: DARK[k], 'stroke-opacity': 0.45, 'stroke-width': 1.5 }));
      return g;
    }
    if (k === 'tens') {
      g.appendChild(S('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: Math.min(5, it.w * 0.2), fill: COL.tens, stroke: DARK[k], 'stroke-width': 2.5 }));
      let d = '';
      const cellH = (it.h + 3) / 10;
      for (let j = 1; j < 10; j++) d += `M${it.x + 2} ${it.y + j * cellH - 1.5}h${it.w - 4}`;
      g.appendChild(S('path', { d, stroke: DARK[k], 'stroke-opacity': 0.55, 'stroke-width': j5(cellH) }));
      g.appendChild(S('rect', { x: it.x + it.w * 0.18, y: it.y + 3, width: it.w * 0.16, height: it.h - 6, rx: 2, fill: HI }));
      return g;
    }
    g.appendChild(S('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: Math.min(5, it.w * 0.2), fill: COL.ones, stroke: DARK[k], 'stroke-width': 2.5 }));
    g.appendChild(S('rect', { x: it.x + it.w * 0.18, y: it.y + it.h * 0.15, width: it.w * 0.18, height: it.h * 0.7, rx: 2, fill: HI }));
    return g;
  }
  const j5 = cellH => (cellH > 14 ? 2 : 1.2);

  // Section 7 control: white rounded rectangle, 3 px COL.line border, solid 5 px bottom edge; the face drops 4 px when pressed.
  function plusMinusBtn(cx, cy, colour, glyph, onPress, off) {
    const w = 96, h = 78, rx = 18;
    const g = S('g', { class: 'pv-btn' + (off ? ' off' : ''), transform: `translate(${cx} ${cy})` });
    g.appendChild(S('rect', { x: -w / 2 - 6, y: -h / 2 - 6, width: w + 12, height: h + 18, fill: 'transparent' })); // bigger hit area
    g.appendChild(S('rect', { x: -w / 2, y: -h / 2 + 5, width: w, height: h, rx, fill: COL.line }));
    const face = S('g', { class: 'pv-face' });
    face.appendChild(S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx, fill: COL.surface, stroke: COL.line, 'stroke-width': 3 }));
    const a = 17;
    face.appendChild(S('path', { d: glyph === '+' ? `M${-a} 0H${a}M0 ${-a}V${a}` : `M${-a} 0H${a}`, stroke: colour, 'stroke-width': 9, 'stroke-linecap': 'round' }));
    g.appendChild(face);
    if (!off) unbinds.push(onTap(g, onPress));
    return g;
  }

  // Primary action: PAL.blue fill, white text, PAL.blueDark bottom edge, with a soft pulsing halo.
  function swapBtn(cx, cy, w, label, onPress) {
    const h = 74, rx = 20;
    const g = S('g', { class: 'pv-btn pv-swap', transform: `translate(${cx} ${cy})` });
    g.appendChild(S('rect', { class: 'pv-halo', x: -w / 2 - 9, y: -h / 2 - 9, width: w + 18, height: h + 23, rx: rx + 8, fill: COL.focusSoft }));
    g.appendChild(S('rect', { x: -w / 2, y: -h / 2 + 5, width: w, height: h, rx, fill: PAL.blueDark }));
    const face = S('g', { class: 'pv-face' });
    face.appendChild(S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx, fill: PAL.blue }));
    face.appendChild(S('text', { y: 11, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 31, fill: '#fff' }, [label]));
    g.appendChild(face);
    unbinds.push(onTap(g, onPress));
    return g;
  }

  // ---------- draw ----------
  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    root.classList.toggle('ro', ro());
    const L = layout();
    geo = L;
    root.setAttribute('viewBox', `0 0 ${W} ${L.VH}`);

    for (const k of L.ks) {
      const P = L.panels[k];
      const panel = S('g', {});
      // A tall white card with a 3 px border and heading in the column colour.
      panel.appendChild(S('rect', { x: P.x, y: P.y, width: P.w, height: P.h, rx: 18, fill: COL.surface, stroke: COLR[k], 'stroke-width': 3.5 }));
      panel.appendChild(S('text', { x: P.x + P.w / 2, y: P.y + 46, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 36, fill: COLR[k] }, [NAME[k]]));
      root.appendChild(panel);

      // A dashed outline round the first full column of ten ones (or ten tens) shows what can be swapped,
      // in the colour of the place it will become.
      const canFuse = !ro() && ((k === 'ones' && c.ones >= 10 && c.tens < LIM.tens) || (k === 'tens' && p.showHundreds && c.tens >= 10 && c.hundreds < LIM.hundreds));
      if (canFuse && !counters()) {
        const first10 = L.items[k].slice(0, 10);
        const ringCol = k === 'ones' ? COL.tens : COL.hundreds;
        const bx = Math.min(...first10.map(i => i.x)) - 7, by = Math.min(...first10.map(i => i.y)) - 7;
        const bw = Math.max(...first10.map(i => i.x + i.w)) - bx + 7, bh = Math.max(...first10.map(i => i.y + i.h)) - by + 7;
        const ring = S('rect', { class: 'pv-ready pv-tap', x: bx, y: by, width: bw, height: bh, rx: 9, fill: k === 'ones' ? COL.goodSoft : '#fef3c7', stroke: ringCol, 'stroke-width': 3.5, 'stroke-dasharray': '9 7' });
        unbinds.push(onTap(ring, () => (k === 'ones' ? swapUp('ones') : swapUp('tens'))));
        root.appendChild(ring);
      }

      const layer = S('g', {});
      L.items[k].forEach((it, i) => {
        const g = drawItem(k, it, i);
        if (pop && pop.key === k && pop.index === i) g.classList.add('pv-pop');
        if (offer && ((offer === 'breakTen' && k === 'tens') || (offer === 'breakHundred' && k === 'hundreds')) && i === L.items[k].length - 1) {
          // Selected: blue outline on a soft blue well.
          g.insertBefore(S('rect', { x: it.x - 7, y: it.y - 7, width: it.w + 14, height: it.h + 14, rx: 10, fill: COL.focusSoft }), g.firstChild);
          g.appendChild(S('rect', { x: it.x - 7, y: it.y - 7, width: it.w + 14, height: it.h + 14, rx: 10, fill: 'none', stroke: COL.focus, 'stroke-width': 4 }));
        }
        if (!ro() && (k === 'tens' || k === 'hundreds')) {
          g.classList.add('pv-tap');
          g.insertBefore(S('rect', { x: it.x - 8, y: it.y - 4, width: it.w + 16, height: it.h + 8, fill: 'transparent' }), g.firstChild);
          unbinds.push(onTap(g, () => offerBreak(k)));
        }
        if (!ro() && k === 'ones' && i < 10 && c.ones >= 10 && c.tens < LIM.tens) {
          g.classList.add('pv-tap');
          unbinds.push(onTap(g, () => swapUp('ones')));
        }
        layer.appendChild(g);
      });
      root.appendChild(layer);

      if (L.digitsY) {
        // Display only: the digit in a soft pill under the card.
        root.appendChild(S('rect', { x: P.x + 6, y: L.digitsY - 42, width: P.w - 12, height: 84, rx: 16, fill: COL.surface2 }));
        root.appendChild(S('text', { x: P.x + P.w / 2, y: L.digitsY + 23, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 64, fill: COLR[k] }, [String(c[k])]));
      }
      if (L.btnY) {
        const v = value(), mx = maxV();
        const cx = P.x + P.w / 2;
        const sep = Math.min(p.showDigits ? 116 : 84, P.w / 2 - 54);
        root.appendChild(plusMinusBtn(cx - sep, L.btnY, COLR[k], '−', () => change(k, -1), c[k] <= 0));
        root.appendChild(plusMinusBtn(cx + sep, L.btnY, COLR[k], '+', () => change(k, +1), c[k] >= LIM[k] || v + PLACE[k] > mx));
        if (p.showDigits) {
          // The digit sits between − and +, in the column colour.
          const txt = String(c[k]);
          root.appendChild(S('text', { x: cx, y: L.btnY + 22, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 800, 'font-size': txt.length > 1 && sep < 110 ? 52 : 64, fill: COLR[k] }, [txt]));
        }
      }
    }

    if (L.valueY) {
      // Expanded form and total in one soft pill: "40 + 7 = 47", values in their column colours, the total in ink.
      root.appendChild(S('rect', { x: 22, y: L.valueY - 42, width: W - 44, height: 84, rx: 18, fill: COL.surface2 }));
      const t = S('text', { x: W / 2, y: L.valueY + 19, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 54 });
      const add = (txt, fill, weight) => { const s = S('tspan', { fill }); if (weight) s.setAttribute('font-weight', weight); s.textContent = txt; t.appendChild(s); };
      if (p.showExpanded) {
        L.ks.forEach((k, i) => { if (i) add(' + ', COL.ink2, 600); add(String(c[k] * PLACE[k]), COLR[k]); });
        if (p.showValue) { add(' = ', COL.ink2, 600); add(String(value()), COL.ink); }
      } else add(String(value()), COL.ink);
      root.appendChild(t);
    }

    // Swap buttons in the top slot.
    if (!ro()) {
      const sy = L.slot / 2 - 4;
      let btn = null;
      if (offer === 'breakTen' && c.tens > 0 && c.ones + 10 <= LIM.ones) btn = swapBtn(W / 2, sy, 470, 'Swap 1 ten for 10 ones', () => swapDown('tens'));
      else if (offer === 'breakHundred' && c.hundreds > 0 && c.tens + 10 <= LIM.tens) btn = swapBtn(W / 2, sy, 540, 'Swap 1 hundred for 10 tens', () => swapDown('hundreds'));
      else if (c.ones >= 10 && c.tens < LIM.tens) btn = swapBtn(W / 2, sy, 470, 'Swap 10 ones for 1 ten', () => swapUp('ones'));
      else if (p.showHundreds && c.tens >= 10 && c.hundreds < LIM.hundreds) btn = swapBtn(W / 2, sy, 540, 'Swap 10 tens for 1 hundred', () => swapUp('tens'));
      if (btn) root.appendChild(btn);
    }
    pop = null;
  }

  // ---------- actions ----------
  function changed() { ctx.onChange && ctx.onChange(api.getState()); }

  function change(k, d) {
    clearOffer();
    if (d > 0) {
      if (c[k] >= LIM[k] || value() + PLACE[k] > maxV()) return;
      c[k] += 1;
      pop = { key: k, index: c[k] - 1 };
      sfx('pop');
    } else {
      if (c[k] <= 0) return;
      c[k] -= 1;
      sfx('click');
    }
    draw();
    changed();
  }

  function clearOffer() { offer = null; clearTimeout(offerTimer); }

  function offerBreak(k) {
    if (ro()) return;
    if (k === 'tens' && c.ones + 10 > LIM.ones) return;
    if (k === 'hundreds' && c.tens + 10 > LIM.tens) return;
    offer = k === 'tens' ? 'breakTen' : 'breakHundred';
    sfx('click');
    clearTimeout(offerTimer);
    offerTimer = later(() => { offer = null; draw(); }, 6000);
    draw();
  }

  const centreOf = list => {
    const x0 = Math.min(...list.map(i => i.x)), y0 = Math.min(...list.map(i => i.y));
    const x1 = Math.max(...list.map(i => i.x + i.w)), y1 = Math.max(...list.map(i => i.y + i.h));
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, x0, y0, x1, y1 };
  };

  // Ten of `from` (ones or tens) fuse into one of the next place.
  function swapUp(from) {
    const to = from === 'ones' ? 'tens' : 'hundreds';
    if (c[from] < 10 || c[to] >= LIM[to] || (to === 'hundreds' && !p.showHundreds)) return;
    clearOffer();
    const before = geo;
    const oldItems = before.items[from].slice(0, 10).map(i => ({ ...i }));
    c[from] -= 10;
    c[to] += 1;
    sfx('whoosh');
    draw();
    animateGhost(from, oldItems, to, geo.items[to].length - 1);
    changed();
  }

  // One of `from` (tens or hundreds) breaks into ten of the place below.
  function swapDown(from) {
    const to = from === 'tens' ? 'ones' : 'tens';
    if (c[from] < 1 || c[to] + 10 > LIM[to]) return;
    clearOffer();
    const oldItem = { ...geo.items[from][geo.items[from].length - 1] };
    c[from] -= 1;
    c[to] += 10;
    sfx('whoosh');
    draw();
    const newIdx = Array.from({ length: 10 }, (_, i) => c[to] - 10 + i);
    animateBreak(from, oldItem, to, newIdx);
    changed();
  }

  function animateGhost(fromKey, oldItems, toKey, targetIdx) {
    if (reducedMotion() || !oldItems.length) return;
    const target = root.querySelector(`[data-k="${toKey[0]}${targetIdx}"]`);
    const tItem = geo.items[toKey][targetIdx];
    if (!target || !tItem) return;
    try {
      target.style.opacity = '0';
      const ghost = S('g', { 'pointer-events': 'none' });
      oldItems.forEach((it, i) => ghost.appendChild(drawItem(fromKey, it, 99 + i)));
      const oc = centreOf(oldItems);
      // The fused piece fades in over the group, centred on it.
      const fused = S('g', {});
      const fItem = { ...tItem, x: oc.x - tItem.w / 2, y: oc.y - tItem.h / 2 };
      fused.appendChild(drawItem(toKey, fItem, 98));
      fused.style.opacity = '0';
      ghost.appendChild(fused);
      root.appendChild(ghost);
      const dx = tItem.x + tItem.w / 2 - oc.x, dy = tItem.y + tItem.h / 2 - oc.y;
      // Counters slide together first; blocks are already a column of ten.
      if (counters()) {
        [...ghost.children].slice(0, oldItems.length).forEach((g, i) => {
          const it = oldItems[i];
          g.animate([{ transform: 'translate(0px,0px)', opacity: 1 }, { transform: `translate(${oc.x - (it.x + it.w / 2)}px,${oc.y - (it.y + it.h / 2)}px)`, opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
        });
      }
      fused.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 120, fill: 'forwards' });
      ghost.animate([{ transform: 'translate(0px,0px)' }, { transform: `translate(${dx}px,${dy}px)` }], { duration: 430, delay: 300, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
      later(() => { ghost.remove(); target.style.opacity = ''; }, 800);
    } catch (e) { if (target) target.style.opacity = ''; }
  }

  function animateBreak(fromKey, oldItem, toKey, newIdx) {
    if (reducedMotion()) return;
    const targets = newIdx.map(i => root.querySelector(`[data-k="${toKey[0]}${i}"]`)).filter(Boolean);
    const tItems = newIdx.map(i => geo.items[toKey][i]).filter(Boolean);
    if (!targets.length || !tItems.length) return;
    try {
      targets.forEach(t => { t.style.opacity = '0'; });
      const ghost = S('g', { 'pointer-events': 'none' });
      ghost.appendChild(drawItem(fromKey, oldItem, 97));
      root.appendChild(ghost);
      const tc = centreOf(tItems);
      const dx = tc.x - (oldItem.x + oldItem.w / 2), dy = tc.y - (oldItem.y + oldItem.h / 2);
      ghost.animate([{ transform: 'translate(0px,0px)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px)`, opacity: 1, offset: 0.8 }, { transform: `translate(${dx}px,${dy}px)`, opacity: 0 }], { duration: 560, easing: 'ease-in-out', fill: 'forwards' });
      targets.forEach((t, i) => t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 430 + i * 18, fill: 'forwards' }));
      later(() => { ghost.remove(); targets.forEach(t => { t.style.opacity = ''; }); }, 900);
    } catch (e) { targets.forEach(t => { t.style.opacity = ''; }); }
  }

  const api = {
    getState() { return { hundreds: c.hundreds, tens: c.tens, ones: c.ones, value: value() }; },
    update(np = {}) {
      timers.forEach(t => clearTimeout(t)); timers.clear();
      setFromProps(np);
      draw();
    },
    showAnswer(answer) {
      // Accepts a number (standard partition) or a goal object such as { value: 52, tens: 5, ones: 2 }
      // or { value: 52, ones: { gte: 10 } } (then tens are swapped for ones until the ones goal is met).
      let target;
      const isNum = v => typeof v === 'number' && Number.isFinite(v);
      const mid = g => (g && typeof g === 'object' ? (isNum(g.eq) ? g.eq : isNum(g.gte) && isNum(g.lte) ? Math.round((g.gte + g.lte) / 2) : isNum(g.gte) ? g.gte : isNum(g.lte) ? g.lte : Array.isArray(g.in) ? g.in[0] : undefined) : g);
      let goal = null;
      if (answer && typeof answer === 'object') {
        goal = answer;
        if (isNum(answer.tens) && isNum(answer.ones)) target = { hundreds: clamp(int(answer.hundreds), 0, LIM.hundreds), tens: clamp(int(answer.tens), 0, LIM.tens), ones: clamp(int(answer.ones), 0, LIM.ones) };
        else answer = mid(answer.value);
      }
      if (!target) {
        const n = clamp(int(answer, value()), 0, 999);
        target = p.showHundreds
          ? { hundreds: Math.floor(n / 100), tens: Math.floor(n / 10) % 10, ones: n % 10 }
          : { hundreds: 0, tens: Math.min(LIM.tens, Math.floor(n / 10)), ones: n % 10 };
        const og = goal && goal.ones && typeof goal.ones === 'object' ? goal.ones : null;
        if (og && isNum(og.gte)) while (target.ones < og.gte && target.tens > 0 && target.ones + 10 <= LIM.ones) { target.tens -= 1; target.ones += 10; }
        if (goal && isNum(goal.ones) && !isNum(goal.tens)) { const v = target.tens * 10 + target.ones; target.ones = goal.ones; target.tens = Math.max(0, Math.floor((v - goal.ones) / 10)); }
      }
      timers.forEach(t => clearTimeout(t)); timers.clear();
      clearOffer();
      // Same value but not standard: animate the swaps. Otherwise step one block at a time.
      const steps = [];
      const sim = { ...c };
      const tv = target.hundreds * 100 + target.tens * 10 + target.ones;
      if (tv === value()) {
        while (sim.ones >= 10 && sim.ones > target.ones) { sim.ones -= 10; sim.tens += 1; steps.push({ swap: 'ones' }); }
        while (p.showHundreds && sim.tens >= 10 && sim.tens > target.tens) { sim.tens -= 10; sim.hundreds += 1; steps.push({ swap: 'tens' }); }
        while (sim.tens > target.tens && sim.ones + 10 <= target.ones) { sim.tens -= 1; sim.ones += 10; steps.push({ brk: 'tens' }); }
      }
      for (const k of ['hundreds', 'tens', 'ones']) {
        while (sim[k] !== target[k] && steps.length < 120) { const d = sim[k] < target[k] ? 1 : -1; sim[k] += d; steps.push({ k, d }); }
      }
      if (reducedMotion()) { c = { ...target }; draw(); return; }
      let i = 0;
      const next = () => {
        if (i >= steps.length) return;
        const s = steps[i++];
        if (s.brk) {
          const old = { ...geo.items.tens[geo.items.tens.length - 1] };
          c.tens -= 1; c.ones += 10; draw();
          animateBreak('tens', old, 'ones', Array.from({ length: 10 }, (_, k) => c.ones - 10 + k));
          later(next, 900);
        } else if (s.swap) {
          const before = geo, from = s.swap, to = from === 'ones' ? 'tens' : 'hundreds';
          const old = before.items[from].slice(0, 10).map(it => ({ ...it }));
          c[from] -= 10; c[to] += 1; draw(); animateGhost(from, old, to, geo.items[to].length - 1);
          later(next, 820);
        } else {
          c[s.k] += s.d;
          if (s.d > 0) pop = { key: s.k, index: c[s.k] - 1 };
          draw();
          later(next, 150);
        }
      };
      next();
    },
    destroy() {
      timers.forEach(t => clearTimeout(t)); timers.clear();
      clearTimeout(offerTimer);
      unbinds.splice(0).forEach(u => u());
      el.replaceChildren();
    },
  };
  setFromProps({ ...props });
  draw();
  return api;
}
