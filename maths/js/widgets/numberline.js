// numberline: a number line for counting, hopping, placing and estimating.
// Props:
//   min (0), max (20)          the ends. Any numbers; non-integers are fine (fractions lines such as 0 to 3).
//   step                       labelled tick spacing. Default 1 when max - min <= 20, else 10.
//   minor                      small tick spacing. Default 1 when max - min <= 50, else 5. 0 = none.
//   labels                     'all' (every step tick, default), 'ends', 'tens', 'fives', 'none',
//                              or an array of numbers and/or { at, text } objects (e.g. [{ at: 0.5, text: '½' }]).
//   hide                       numbers whose label shows as a gold "?" box.
//   marks                      numbers (a plain dot) or { at, label, colour } (a dot with a label above it).
//   hops                       arcs drawn above the line: { from, to, label? }; label defaults to "+n" / "−n".
//   mode                       'display' | 'hop' | 'place'.
//   start                      hop mode: where the rocket starts (default min).
//   hopSize                    hop mode: size of one hop (default 1; negative hops go backwards).
//   value                      place mode: the marker's starting value (omit for "no marker yet": it waits
//                              in the dock, top left). Display mode: draws the marker at value.
//   snap                       place mode: snap spacing (default 1).
//   markerArt                  art name for the marker (default 'rocket').
//   showValue                  show the marker's number in a bubble above it.
//   readonly                   no interaction.
// Hop mode: the big Hop button (or a tap on the line ahead of the rocket) makes one hop of hopSize with an arc
// and a count badge; Back undoes the last hop. Place mode: drag the rocket (snaps to whole numbers) or tap the line.
// State: { value, hops, pos, placed }
//   hop mode: value = pos = where the rocket is, hops = hops made, placed = hops > 0.
//   place mode: value = pos = marker value (null while it is still in the dock), placed = true once moved.
// Debug: dev/harness.html?widget=numberline&props={"mode":"hop","hopSize":2}
import { S, svgRoot, svgPoint, onTap, drag, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { artInner } from '../core/art.js';
import { COL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Number line',
  playground: { min: 0, max: 20, mode: 'hop', hopSize: 2, start: 0 },
  state: ['value', 'hops', 'pos', 'placed'],
};

const W = 1000, XL = 60, XR = 940;
const EPS = 1e-6;

const num = (v, d) => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) ? n : d; };
const round6 = v => Math.round(v * 1e6) / 1e6;
const near = (a, b) => Math.abs(a - b) < EPS;
const fmt = v => { const r = Math.round(v * 1000) / 1000; return (r < 0 ? '−' : '') + String(Math.abs(r)); };
// Like fmt, but common fractions show as ½ ¼ ¾ ⅓ ⅔ (used for hop labels and the value bubble).
const GLYPH = [[0.5, '½'], [0.25, '¼'], [0.75, '¾'], [1 / 3, '⅓'], [2 / 3, '⅔']];
const fmtF = v => {
  const a = Math.abs(v), w = Math.floor(a + 1e-9), f = a - w;
  if (f < 1e-6) return fmt(v);
  const g = GLYPH.find(([x]) => Math.abs(x - f) < 1e-3);
  return g ? (v < 0 ? '−' : '') + (w ? String(w) : '') + g[1] : fmt(v);
};
const colourOf = c => (c === 'gold' || c === 'a' || c === 'tens' ? COL.tens : c === 'cyan' || c === 'b' || c === 'ones' ? COL.ones : c === 'green' ? COL.good : typeof c === 'string' && c ? c : COL.ones);

function multiples(a, b, d) {
  if (!(d > 0)) return [];
  const k0 = Math.ceil(a / d - 1e-9), k1 = Math.floor(b / d + 1e-9);
  if (k1 - k0 > 2000) return [];
  const out = [];
  for (let k = k0; k <= k1; k++) out.push(round6(k * d));
  return out;
}

// Normalise props into a layout description. Never throws.
function norm(p) {
  let min = num(p.min, 0), max = num(p.max, 20);
  if (max < min) [min, max] = [max, min];
  if (max - min < EPS) max = min + 1;
  const range = max - min;
  let step = num(p.step, range <= 20 ? 1 : 10);
  if (!(step > 0) || range / step > 400) step = range <= 20 ? 1 : range <= 200 ? 10 : Math.pow(10, Math.floor(Math.log10(range)) - 1);
  let minor = p.minor === 0 || p.minor === false ? 0 : num(p.minor, range <= 50 ? 1 : 5);
  if (!(minor > 0) || range / minor > 600) minor = 0;
  const mode = ['display', 'hop', 'place'].includes(p.mode) ? p.mode : 'display';
  let hopSize = num(p.hopSize, 1);
  if (near(hopSize, 0)) hopSize = 1;
  const start = clamp(num(p.start, min), min, max);
  let snap = num(p.snap, 1);
  if (!(snap > 0)) snap = 1;
  return { min, max, range, step, minor, mode, hopSize, start, snap };
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-numberline', `
    .w-numberline { width: 100%; height: 100%; }
    .w-numberline .nl-btn { cursor: pointer; }
    .w-numberline .nl-btn.off { opacity: .35; cursor: default; }
    .w-numberline .nl-btn:active .nl-face { filter: brightness(1.2); }
    .w-numberline .nl-hit { cursor: pointer; }
    .w-numberline .nl-marker { cursor: grab; }
    .w-numberline .nl-marker.dragging { cursor: grabbing; }
    .w-numberline.ro .nl-hit, .w-numberline.ro .nl-marker { cursor: default; }
    .w-numberline .nl-dock { animation: w-nl-bob 2.4s ease-in-out infinite; }
    .w-numberline .nl-pop { animation: w-nl-pop .32s ease-out; transform-box: fill-box; transform-origin: center; }
    .w-numberline .nl-arc { stroke-dasharray: var(--len); stroke-dashoffset: 0; }
    .w-numberline .nl-arc.grow { animation: w-nl-grow .36s ease-out; }
    @keyframes w-nl-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    @keyframes w-nl-pop { 0% { transform: scale(.6); opacity: .2; } 70% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes w-nl-grow { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
    @media (prefers-reduced-motion: reduce) { .w-numberline .nl-dock, .w-numberline .nl-pop, .w-numberline .nl-arc.grow { animation: none; } }
  `);

  let p = { ...props };
  let L = norm(p);
  const root = svgRoot(W, 440, 'w-numberline');
  el.appendChild(root);
  const unbinds = [];
  const timers = new Set();
  let raf = 0;

  // Interaction state.
  let pos = L.start;          // hop mode
  let hopList = [];           // hop mode: [{from, to}]
  let anim = null;            // hop animation in progress
  let queued = 0;             // hops tapped while animating
  let placeVal = null;        // place mode value (null = in the dock)
  let placed = false;
  let dragging = false;
  let lastPop = null;         // value label to pop on next draw
  let silent = false;         // true while showAnswer replays hops (no onChange)

  function resetFromProps() {
    L = norm(p);
    pos = L.start;
    hopList = [];
    queued = 0;
    const v = num(p.value, null);
    placeVal = v === null ? null : clamp(snapV(v), L.min, L.max);
    placed = false;
  }

  const ro = () => !!(p.readonly || ctx.readonly);
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const X = v => XL + ((v - L.min) / L.range) * (XR - XL);
  const V = x => L.min + ((x - XL) / (XR - XL)) * L.range;
  function snapV(v) { return round6(Math.round((v - 0) / L.snap) * L.snap); }

  // Vertical layout depends on the mode.
  function geom() {
    const hasHops = (Array.isArray(p.hops) && p.hops.length) || L.mode === 'hop';
    if (L.mode === 'hop') return { H: 450, LY: 250 };
    if (L.mode === 'place') return { H: 380, LY: 250 };
    const hasMarker = num(p.value, null) !== null;
    if (hasHops) return { H: 360, LY: 220 };
    return hasMarker ? { H: 330, LY: 200 } : { H: 300, LY: 170 };
  }

  // Which positions get a label, and the text for each.
  function labelList() {
    const { min, max, step } = L;
    const mode = p.labels === undefined || p.labels === null ? 'all' : p.labels;
    let list = [];
    if (Array.isArray(mode)) {
      for (const it of mode) {
        if (it && typeof it === 'object') {
          const at = num(it.at, null);
          if (at === null || at < min - EPS || at > max + EPS) continue;
          list.push({ at, text: String(it.text ?? it.label ?? fmt(at)), fixed: true });
        } else {
          const at = num(it, null);
          if (at === null || at < min - EPS || at > max + EPS) continue;
          list.push({ at, text: fmt(at), fixed: true });
        }
      }
      return list;
    }
    let vals = [];
    if (mode === 'none') vals = [];
    else if (mode === 'ends') vals = [min, max];
    else if (mode === 'tens') vals = multiples(min, max, 10);
    else if (mode === 'fives') vals = multiples(min, max, 5);
    else vals = [...new Set([...multiples(min, max, step), min, max].map(round6))].sort((a, b) => a - b);
    list = vals.map(at => ({ at, text: fmt(at) }));
    // Thin out automatically if the labels would collide (never for explicit arrays).
    if (list.length > 2) {
      const chars = Math.max(...list.map(l => l.text.length));
      const gap = (XR - XL) * (Math.abs(list[1].at - list[0].at) / L.range);
      let stride = 1;
      while (stride < 50 && (gap * stride - 4) / (0.62 * chars) < 22) stride++;
      if (stride > 1) list = list.filter((l, i) => i % stride === 0 || near(l.at, max) || near(l.at, min));
    }
    return list;
  }

  function fontFor(list) {
    if (!list.length) return 40;
    const xs = list.map(l => X(l.at)).sort((a, b) => a - b);
    let gap = Infinity;
    for (let i = 1; i < xs.length; i++) gap = Math.min(gap, xs[i] - xs[i - 1]);
    const chars = Math.max(...list.map(l => [...l.text].length), 1);
    if (!Number.isFinite(gap)) gap = 200;
    return clamp((gap - 4) / (0.62 * chars), 22, 46);
  }

  function arcPath(x1, x2, y, hgt) {
    const mx = (x1 + x2) / 2;
    return `M${x1} ${y} Q${mx} ${y - 2 * hgt} ${x2} ${y}`;
  }
  const arcH = dx => clamp(Math.abs(dx) * 0.42, 34, 150);

  function arrowHead(x1, x2, y, hgt, colour) {
    // Tangent of the quadratic at the end point is (x2 - mx, y - (y - 2h)) direction = (x2 - mx, 2h).
    const mx = (x1 + x2) / 2;
    const ang = Math.atan2(2 * hgt, x2 - mx);
    const s = 13;
    const a1 = ang + Math.PI - 0.45, a2 = ang + Math.PI + 0.45;
    return S('path', { d: `M${x2} ${y}L${x2 + s * Math.cos(a1)} ${y + s * Math.sin(a1)}L${x2 + s * Math.cos(a2)} ${y + s * Math.sin(a2)}Z`, fill: colour });
  }

  function markerArt(x, LY, opts = {}) {
    const name = p.markerArt || 'rocket';
    const s = opts.scale || 1.2;
    const g = S('g', { class: 'nl-art' });
    const a = S('g', { transform: `translate(${-50 * s} ${-94 * s}) scale(${s})` });
    a.innerHTML = artInner(name);
    g.appendChild(a);
    return g;
  }

  function button(x, y, w, hgt, label, sub, onPress, { primary = false, off = false } = {}) {
    const g = S('g', { class: 'nl-btn' + (off ? ' off' : ''), transform: `translate(${x} ${y})` });
    g.appendChild(S('rect', { class: 'nl-face', x: -w / 2, y: -hgt / 2, width: w, height: hgt, rx: hgt / 2, fill: primary ? COL.tens : 'rgba(255,255,255,.07)', stroke: primary ? '#ffe0a0' : COL.ink3, 'stroke-width': 3 }));
    const t = S('text', { x: 0, y: 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': primary ? 40 : 30, fill: primary ? '#1a1205' : COL.ink });
    t.appendChild(document.createTextNode(label));
    if (sub) {
      const ts = S('tspan', { 'font-weight': 600, 'font-size': primary ? 32 : 26, dx: 10, fill: primary ? '#3a2a08' : COL.ink2 });
      ts.textContent = sub;
      t.appendChild(ts);
    }
    g.appendChild(t);
    if (onPress && !ro() && !off) unbinds.push(onTap(g, onPress));
    return g;
  }

  // The Hop and Back buttons are kept between redraws (same DOM nodes and listeners), so a quick tap that
  // straddles a redraw is never lost and outside references stay valid.
  let btnCache = null; // { sig, hop, back, unb }
  function dropButtons() { if (btnCache) { btnCache.unb.forEach(u => u()); btnCache = null; } }
  function hopButtons(by) {
    const hs = L.hopSize;
    const sig = `${Math.round(by)}|${hs}`;
    if (!btnCache || btnCache.sig !== sig) {
      dropButtons();
      const hop = button(W / 2 + 70, by, 250, 92, 'Hop', (hs > 0 ? '+' : '−') + fmtF(Math.abs(hs)), null, { primary: true });
      const back = button(W / 2 - 170, by, 170, 76, 'Back', '', null);
      // Hop at the end of the line still answers with a gentle bump.
      const unb = [onTap(hop, () => requestHop()), onTap(back, () => { if (!back.classList.contains('off')) undo(); })];
      btnCache = { sig, hop, back, unb };
    }
    btnCache.hop.classList.toggle('off', !canHop() && !anim);
    btnCache.back.classList.toggle('off', !hopList.length);
    root.appendChild(btnCache.back);
    root.appendChild(btnCache.hop);
  }

  // ---------- drawing ----------
  let markerG = null, bubbleG = null, beam = null;
  let G = { H: 440, LY: 250 };

  function draw() {
    unbinds.splice(0).forEach(u => u());
    root.replaceChildren();
    root.classList.toggle('ro', ro());
    G = geom();
    const { H, LY } = G;
    root.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const { min, max } = L;

    // Hit area for taps on the line (behind everything else).
    const interactiveLine = !ro() && (L.mode === 'hop' || L.mode === 'place');
    if (interactiveLine) {
      const hit = S('rect', { class: 'nl-hit', x: XL - 30, y: LY - 70, width: XR - XL + 60, height: 120, fill: 'transparent' });
      unbinds.push(onTap(hit, e => tapLine(svgPoint(root, e))));
      root.appendChild(hit);
    }

    // The line with arrows at both ends.
    const ink = COL.ink2;
    root.appendChild(S('line', { x1: XL - 38, y1: LY, x2: XR + 38, y2: LY, stroke: ink, 'stroke-width': 5, 'stroke-linecap': 'round', 'pointer-events': 'none' }));
    root.appendChild(S('path', { d: `M${XR + 52} ${LY}l-20 -12v24z`, fill: ink, 'pointer-events': 'none' }));
    root.appendChild(S('path', { d: `M${XL - 52} ${LY}l20 -12v24z`, fill: ink, 'pointer-events': 'none' }));

    // Ticks.
    const labels = labelList();
    const hide = (Array.isArray(p.hide) ? p.hide : []).map(v => num(v, null)).filter(v => v !== null && v >= min - EPS && v <= max + EPS);
    const majors = [...new Set([...multiples(min, max, L.step), min, max, ...labels.map(l => l.at), ...hide].map(round6))];
    const minors = L.minor > 0 ? multiples(min, max, L.minor).filter(v => !majors.some(m => near(m, v))) : [];
    const minorLen = L.minor > 0 && L.range / L.minor > 60 ? 8 : 12;
    const tg = S('g', { 'pointer-events': 'none' });
    for (const v of minors) tg.appendChild(S('line', { x1: X(v), y1: LY - minorLen, x2: X(v), y2: LY + minorLen, stroke: COL.ink3, 'stroke-width': 2.5 }));
    for (const v of majors) tg.appendChild(S('line', { x1: X(v), y1: LY - 20, x2: X(v), y2: LY + 20, stroke: COL.ink, 'stroke-width': 4, 'stroke-linecap': 'round' }));
    root.appendChild(tg);

    // Labels and "?" boxes.
    const fs = fontFor([...labels, ...hide.map(at => ({ at, text: '??' }))]);
    const here = L.mode === 'hop' ? pos : L.mode === 'place' && placeVal !== null ? placeVal : null;
    const lg = S('g', { 'pointer-events': 'none' });
    const ly = LY + 30 + fs * 0.78;
    for (const l of labels) {
      if (hide.some(hv => near(hv, l.at))) continue;
      const on = here !== null && near(here, l.at) && (L.mode === 'hop' || placed || L.mode === 'place');
      const t = S('text', { x: X(l.at), y: ly, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': on ? 700 : 600, 'font-size': on ? fs * 1.12 : fs, fill: on ? COL.tens : COL.ink }, [l.text]);
      if (on && lastPop !== null && near(lastPop, l.at)) t.classList.add('nl-pop');
      lg.appendChild(t);
    }
    for (const v of hide) {
      const bw = Math.max(fs * 1.25, 40), bh = fs * 1.25;
      lg.appendChild(S('rect', { x: X(v) - bw / 2, y: LY + 26, width: bw, height: bh, rx: 10, fill: 'rgba(242,181,68,.16)', stroke: COL.tens, 'stroke-width': 3 }));
      lg.appendChild(S('text', { x: X(v), y: LY + 26 + bh * 0.76, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': fs * 0.95, fill: COL.tens }, ['?']));
    }
    root.appendChild(lg);
    lastPop = null;

    // Drawn hops from props.
    const hg = S('g', { 'pointer-events': 'none' });
    const propHops = Array.isArray(p.hops) ? p.hops : [];
    for (const hp of propHops) {
      if (!hp || typeof hp !== 'object') continue;
      const f = num(hp.from, null), t = num(hp.to, null);
      if (f === null || t === null || near(f, t)) continue;
      const x1 = X(clamp(f, min, max)), x2 = X(clamp(t, min, max));
      const hh = arcH(x2 - x1);
      const colour = hp.colour ? colourOf(hp.colour) : COL.tens;
      hg.appendChild(S('path', { d: arcPath(x1, x2, LY - 6, hh), fill: 'none', stroke: colour, 'stroke-width': 4.5, 'stroke-linecap': 'round' }));
      hg.appendChild(arrowHead(x1, x2, LY - 6, hh, colour));
      const lab = hp.label !== undefined && hp.label !== null ? String(hp.label) : (t > f ? '+' : '−') + fmtF(Math.abs(t - f));
      if (lab) hg.appendChild(S('text', { x: (x1 + x2) / 2, y: LY - 6 - hh - 12, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: colour }, [lab]));
    }
    // Hops made in hop mode, each with a count badge.
    hopList.forEach((hp, i) => {
      const x1 = X(hp.from), x2 = X(hp.to);
      const hh = arcH(x2 - x1);
      const path = S('path', { class: 'nl-arc', d: arcPath(x1, x2, LY - 6, hh), fill: 'none', stroke: COL.tens, 'stroke-width': 5, 'stroke-linecap': 'round' });
      hg.appendChild(path);
      hg.appendChild(arrowHead(x1, x2, LY - 6, hh, COL.tens));
      const bx = (x1 + x2) / 2, by = LY - 6 - hh;
      const br = Math.min(22, Math.max(15, Math.abs(x2 - x1) * 0.3));
      const badge = S('g', { transform: `translate(${bx} ${by})` });
      badge.appendChild(S('circle', { r: br, fill: '#1a2546', stroke: COL.tens, 'stroke-width': 3 }));
      badge.appendChild(S('text', { y: br * 0.38, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': br * 1.1, fill: COL.tens }, [String(i + 1)]));
      hg.appendChild(badge);
    });
    root.appendChild(hg);

    // Marks.
    const mg = S('g', { 'pointer-events': 'none' });
    for (const m of Array.isArray(p.marks) ? p.marks : []) {
      const at = num(m && typeof m === 'object' ? m.at : m, null);
      if (at === null || at < min - EPS || at > max + EPS) continue;
      const colour = colourOf(m && typeof m === 'object' ? m.colour : null);
      mg.appendChild(S('circle', { cx: X(at), cy: LY, r: 13, fill: colour, stroke: '#0b1020', 'stroke-width': 3 }));
      const lab = m && typeof m === 'object' && m.label !== undefined && m.label !== null ? String(m.label) : '';
      if (lab) mg.appendChild(S('text', { x: X(at), y: LY - 34, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 36, fill: colour }, [lab]));
    }
    root.appendChild(mg);

    // Marker (hop rocket, place rocket, or display value).
    markerG = null; bubbleG = null; beam = null;
    if (L.mode === 'hop') {
      drawMarker(pos, false);
    } else if (L.mode === 'place') {
      if (placeVal === null) drawDock();
      else drawMarker(placeVal, !ro());
    } else if (num(p.value, null) !== null) {
      drawMarker(clamp(num(p.value, 0), min, max), false);
    }

    // Hop buttons (persistent between redraws).
    if (L.mode === 'hop' && !ro()) hopButtons(LY + 30 + fs * 0.78 + 78);
    else dropButtons();
  }

  function drawMarker(v, interactive) {
    const { LY } = G;
    const g = S('g', { class: 'nl-marker', transform: `translate(${X(v)} ${LY})` });
    beam = S('line', { x1: 0, y1: -8, x2: 0, y2: 22, stroke: COL.tens, 'stroke-width': 6, 'stroke-linecap': 'round' });
    g.appendChild(beam);
    if (interactive) g.appendChild(S('rect', { x: -66, y: -175, width: 132, height: 215, fill: 'transparent' }));
    g.appendChild(markerArt(0, LY));
    if (p.showValue) {
      bubbleG = S('g', { transform: 'translate(0 -150)' });
      bubbleG.appendChild(S('rect', { x: -44, y: -30, width: 88, height: 52, rx: 14, fill: '#1a2546', stroke: COL.tens, 'stroke-width': 3 }));
      bubbleG.appendChild(S('text', { y: 9, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 32, fill: COL.tens }, [fmtF(v)]));
      g.appendChild(bubbleG);
    }
    if (interactive) bindDrag(g);
    markerG = g;
    root.appendChild(g);
  }

  function drawDock() {
    const { LY } = G;
    const dx = XL + 40, dy = LY - 150;
    const outer = S('g', { transform: `translate(${dx} ${dy})` });
    const g = S('g', { class: 'nl-marker' + (ro() ? '' : ' nl-dock') });
    g.appendChild(S('ellipse', { cx: 0, cy: 6, rx: 52, ry: 14, fill: 'rgba(95,212,255,.10)', stroke: COL.ones, 'stroke-width': 2.5, 'stroke-dasharray': '8 7' }));
    if (!ro()) g.appendChild(S('rect', { x: -66, y: -120, width: 132, height: 150, fill: 'transparent' }));
    g.appendChild(markerArt(0, 0, { scale: 1.05 }));
    outer.appendChild(g);
    root.appendChild(outer);
    if (!ro()) bindDrag(g, true);
  }

  function bindDrag(g, fromDock = false) {
    let moved = false;
    unbinds.push(drag(g, {
      start() { dragging = true; moved = false; g.classList.add('dragging'); },
      move(pt) {
        moved = true;
        const v = clamp(snapV(clamp(V(pt.x), L.min, L.max)), L.min, L.max);
        if (fromDock) {
          // Leave the dock: redraw with the marker on the line, then keep dragging via the line position.
          fromDock = false;
          placeVal = v;
          moveMarkerTo(v, true);
          return;
        }
        if (placeVal === null || !near(v, placeVal)) { placeVal = v; moveMarkerTo(v, false); sfx('tick'); }
      },
      end() {
        dragging = false;
        g.classList.remove('dragging');
        if (!moved) return;
        placed = true;
        lastPop = placeVal;
        sfx('pop');
        draw();
        changed();
      },
    }, root));
  }

  // Move the marker without a full redraw (a redraw would break the pointer capture mid-drag).
  function moveMarkerTo(v, fromDock) {
    if (fromDock || !markerG) {
      // Swap the docked art for a line marker; the dock group keeps the pointer capture.
      const dock = root.querySelector('.nl-dock') || root.querySelector('.nl-marker');
      if (dock && dock.parentNode) {
        const outer = dock.parentNode;
        outer.setAttribute('transform', `translate(${X(v)} ${G.LY})`);
        dock.classList.remove('nl-dock');
        const ell = dock.querySelector('ellipse');
        if (ell) ell.remove();
        const art = dock.querySelector('.nl-art');
        if (art) art.querySelector('g').setAttribute('transform', `translate(${-50 * 1.2} ${-94 * 1.2}) scale(1.2)`);
        markerG = outer;
      }
      return;
    }
    markerG.setAttribute('transform', `translate(${X(v)} ${G.LY})`);
    if (bubbleG) { const t = bubbleG.querySelector('text'); if (t) t.textContent = fmtF(v); }
  }

  // ---------- hop mode ----------
  const canHop = () => { const to = round6(pos + L.hopSize); return to <= L.max + EPS && to >= L.min - EPS; };

  function requestHop() {
    if (anim) { if (queued < 3) queued++; return; }
    doHop();
  }

  function doHop() {
    if (!canHop()) { bump(); queued = 0; silent = false; return; }
    const from = pos, to = round6(pos + L.hopSize);
    sfx('whoosh');
    const finish = () => {
      anim = null;
      pos = to;
      hopList.push({ from, to });
      lastPop = to;
      draw();
      changed();
      if (queued > 0) { queued--; later(doHop, 40); } else silent = false;
    };
    if (reducedMotion() || !markerG) { finish(); return; }
    const x1 = X(from), x2 = X(to), LY = G.LY, hh = arcH(x2 - x1);
    const t0 = performance.now(), dur = 360;
    const me = { from, to };
    anim = me;
    // Safety net: finish even if animation frames stop (hidden tab, headless test).
    later(() => { if (anim === me) { if (raf) cancelAnimationFrame(raf); raf = 0; finish(); } }, dur + 150);
    const stepFn = now => {
      if (anim !== me) return;
      const t = clamp((now - t0) / dur, 0, 1);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      // Point on the quadratic arc (control point at height 2h).
      const x = (1 - e) * (1 - e) * x1 + 2 * (1 - e) * e * ((x1 + x2) / 2) + e * e * x2;
      const y = LY + (2 * (1 - e) * e) * (-2 * hh);
      if (markerG) markerG.setAttribute('transform', `translate(${x} ${y})`);
      if (beam) beam.setAttribute('opacity', t > 0.05 && t < 0.95 ? 0 : 1);
      if (t < 1) raf = requestAnimationFrame(stepFn); else { raf = 0; finish(); }
    };
    raf = requestAnimationFrame(stepFn);
  }

  function bump() {
    sfx('clunk');
    if (!markerG || reducedMotion()) return;
    const x = X(pos), LY = G.LY;
    const dir = L.hopSize > 0 ? 1 : -1;
    markerG.setAttribute('transform', `translate(${x + dir * 14} ${LY})`);
    later(() => { if (markerG) markerG.setAttribute('transform', `translate(${x} ${LY})`); }, 140);
  }

  function undo() {
    if (anim || !hopList.length) return;
    const last = hopList.pop();
    pos = last.from;
    sfx('click');
    lastPop = pos;
    draw();
    changed();
  }

  function tapLine(pt) {
    if (ro()) return;
    const v = clamp(V(pt.x), L.min, L.max);
    if (L.mode === 'hop') {
      const ahead = L.hopSize > 0 ? v > pos + Math.abs(L.hopSize) * 0.3 : v < pos - Math.abs(L.hopSize) * 0.3;
      if (ahead) requestHop();
      return;
    }
    if (L.mode === 'place') {
      if (dragging) return;
      const sv = clamp(snapV(v), L.min, L.max);
      placeVal = sv;
      placed = true;
      lastPop = sv;
      sfx('pop');
      draw();
      changed();
    }
  }

  function state() {
    if (L.mode === 'hop') return { value: pos, hops: hopList.length, pos, placed: hopList.length > 0 };
    if (L.mode === 'place') return { value: placeVal, hops: 0, pos: placeVal, placed };
    const v = num(p.value, null);
    return { value: v, hops: 0, pos: v, placed: false };
  }
  function changed() { if (!silent && ctx.onChange) ctx.onChange(state()); }

  function stopAnim() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    anim = null;
    queued = 0;
    silent = false;
  }

  const api = {
    getState: state,
    update(np = {}) {
      stopAnim();
      p = { ...p, ...np };
      const resetKeys = ['min', 'max', 'mode', 'start', 'hopSize', 'value', 'snap'];
      if (resetKeys.some(k => k in np)) resetFromProps();
      else L = norm(p);
      draw();
    },
    showAnswer(answer) {
      stopAnim();
      // Accepts a number, or a goal object such as { value: 47 }, { value: { gte: 63, lte: 71 } } or { hops: 3 }.
      let a = answer;
      if (a && typeof a === 'object' && !Array.isArray(a)) {
        if (a.value === undefined && a.pos === undefined && typeof a.hops === 'number') a = L.start + a.hops * L.hopSize;
        else a = a.value ?? a.pos;
      }
      if (a && typeof a === 'object') {
        if ('gte' in a && 'lte' in a) a = (Number(a.gte) + Number(a.lte)) / 2;
        else if (Array.isArray(a.in)) a = a.in[0];
        else a = a.eq ?? a.gte ?? a.lte;
      }
      a = num(a, null);
      if (a === null) return;
      a = clamp(a, L.min, L.max);
      if (L.mode === 'place') {
        placeVal = clamp(snapV(a), L.min, L.max);
        placed = true;
        lastPop = placeVal;
        draw();
      } else if (L.mode === 'hop') {
        // Replay hops from the start until the rocket reaches the answer (if it is on the hop path).
        pos = L.start; hopList = [];
        draw();
        const n = Math.round((a - L.start) / L.hopSize);
        if (n > 0 && near(L.start + n * L.hopSize, a)) {
          // Replay the hops silently (doHop's finish works through the queue, then clears silent).
          silent = true;
          queued = n - 1;
          doHop();
        } else { pos = a; draw(); }
      } else {
        p = { ...p, value: a };
        draw();
      }
    },
    destroy() {
      stopAnim();
      dropButtons();
      timers.forEach(t => clearTimeout(t));
      timers.clear();
      unbinds.splice(0).forEach(u => u());
      el.replaceChildren();
    },
  };

  resetFromProps();
  draw();
  return api;
}
