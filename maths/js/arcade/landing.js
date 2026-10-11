// Rocket Landing (SVG). A target number appears; move the rocket above the number line and land it.
// Bullseye (gold star) within 1 (exact at level 1); Close (silver star) within 5. Ten landings a round.
// Style v2: a light, friendly sky (pale blue, white clouds), a bold ink number line with big labels,
// the outlined rocket, chunky white controls, landing markers in green (bullseye) and blue (where the target is).
// Tests only: ctx.debug or ?arcdebug exposes window.__arc (target, aimAt, land, result, stars).
import { S, svgRoot, onTap, drag, injectCSS, clamp, esc, reducedMotion } from '../core/dom.js';
import { makeRand } from '../core/rand.js';
import { COL, PAL, FONT } from '../core/theme.js';
import { artInner } from '../core/art.js';
import { sfx as coreSfx } from '../core/sfx.js';

export const meta = { id: 'landing', title: 'Rocket Landing', about: 'Land the rocket on the right spot on the number line.', icon: 'rocket' };

const C = 'arc-land';
const VW = 1280, VH = 660;
const ROUND = 10;
const X0 = 80, X1 = 1200, LINE_Y = 500, HOVER_Y = 262;
const RS = 128; // rocket size in viewBox units
const LEVELS = {
  1: { min: 0, max: 20, labels: 'all', bull: 0, close: 5 },
  2: { min: 0, max: 100, labels: 'tens', bull: 1, close: 5 },
  3: { min: 0, max: 100, labels: 'ends', bull: 1, close: 5 },
};

// Grade one landing. Exported for tests.
export function grade(level, target, landed) {
  const L = LEVELS[level];
  const d = Math.abs(landed - target);
  if (d <= L.bull) return { kind: 'gold', d, text: 'Bullseye!', line: `Right on ${target}.` };
  if (d <= L.close) return { kind: 'silver', d, text: 'Close!', line: `It landed on ${landed}. ${target} is ${d === 1 ? '1 away' : `${d} away`}.` };
  const dir = landed > target ? 'left' : 'right';
  return { kind: 'none', d, text: `It landed on ${landed}.`, line: `${target} is ${d > 15 ? 'further' : 'a bit'} to the ${dir}.` };
}

// ---------- shared strip (each arcade file carries its own copy) ----------
// Black top bar like the app's mission bar: chunky Exit and level keys (solid bottom edge), white title, quiet star tally.
const BACK = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STAR_D = 'M50 6l12 28 30 3-23 20 7 30-26-16-26 16 7-30L8 37l30-3z';
const starSvg = (size, fill = '#ffcc33') => `<svg class="st" viewBox="-6 -6 112 112" width="${size}" height="${size}" aria-hidden="true"><path d="${STAR_D}" fill="${fill}" stroke="#1b1e2e" stroke-width="7" stroke-linejoin="round"/></svg>`;
const withStars = (html, size) => String(html).replace(/★/g, starSvg(size)).replace(/☆/g, starSvg(size, '#d3d9e3'));
function stripCSS(c) {
  return `
  .${c} { position: absolute; inset: 0; display: flex; flex-direction: column; background: #000; color: #fff; font-family: ${FONT.display}; overflow: hidden; user-select: none; -webkit-user-select: none; }
  .${c} button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; font-family: ${FONT.display}; }
  .${c}-top { flex: none; height: 82px; display: flex; align-items: center; gap: 14px; padding: 0 16px 4px; background: #000; position: relative; z-index: 3; }
  .${c}-key { appearance: none; cursor: pointer; min-width: 60px; min-height: 60px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 16px; border: 2px solid #3a3f4d; background: #23262f; color: #fff; font-weight: 700; font-size: 22px; box-shadow: 0 5px 0 #3a3f4d; transition: transform .1s ease, box-shadow .1s ease, background .2s; }
  .${c}-key:active { transform: translateY(4px); box-shadow: 0 1px 0 #3a3f4d; }
  .${c}-exit { padding: 0 22px 0 14px; }
  .${c}-title { flex: 1; min-width: 0; font-weight: 700; font-size: 26px; letter-spacing: -.01em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .${c}-lv { display: flex; align-items: center; gap: 10px; }
  .${c}-lv span { font-weight: 700; font-size: 14px; letter-spacing: .14em; text-transform: uppercase; color: #7d8397; margin-right: 2px; }
  .${c}-lv button { width: 60px; height: 60px; padding: 0; font-size: 26px; font-weight: 800; }
  .${c}-lv button.on { background: #ffcc33; border-color: #ffcc33; color: #1d1600; box-shadow: 0 5px 0 #c99a0e; }
  .${c}-lv button.on:active { box-shadow: 0 1px 0 #c99a0e; }
  .${c}-tally { min-width: 124px; text-align: right; line-height: 1.1; margin-left: 6px; }
  .${c}-tally b { display: inline-flex; align-items: center; gap: 7px; font-weight: 800; font-size: 28px; color: #fff; }
  .${c}-tally b span { display: inline-flex; align-items: center; gap: 7px; margin-left: 8px; }
  .${c}-tally .st { flex: none; }
  .${c}-tally small { display: block; font-weight: 500; font-size: 14px; color: #7d8397; margin-top: 4px; }
  .${c}-tally b.bump { animation: ${c}-bump .35s ease; }
  @keyframes ${c}-bump { 40% { transform: scale(1.25); } }
  .${c}-sum { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.55); z-index: 5; animation: ${c}-fade .3s ease; }
  .${c}-card { min-width: 480px; max-width: 660px; text-align: center; padding: 30px 44px 34px; border-radius: 28px; background: #fff; color: #1b1e2e; border: 4px solid #1b1e2e; box-shadow: 0 8px 0 #1b1e2e, 0 30px 70px rgba(0,0,0,.45); animation: ${c}-pop .45s cubic-bezier(.2,1.4,.4,1); }
  .${c}-sum .eb { font-weight: 700; font-size: 15px; letter-spacing: .16em; text-transform: uppercase; color: #4b5168; }
  .${c}-sum .big { display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 800; font-size: 72px; line-height: 1; margin: 16px 0 10px; color: #1b1e2e; }
  .${c}-sum .big span { display: inline-flex; align-items: center; gap: 12px; margin-left: 18px; }
  .${c}-sum p { margin: 6px 0; font-size: 22px; font-weight: 500; color: #4b5168; }
  .${c}-sum p.best { font-size: 18px; color: #8b91a7; min-height: 1.2em; }
  .${c}-sum .row { display: flex; gap: 14px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
  .${c}-btn { appearance: none; cursor: pointer; min-height: 64px; padding: 0 30px; border-radius: 18px; border: 3px solid #1d4ed8; background: #3b82f6; color: #fff; font-weight: 700; font-size: 23px; box-shadow: 0 5px 0 #1d4ed8; transition: transform .1s ease, box-shadow .1s ease; }
  .${c}-btn:active { transform: translateY(4px); box-shadow: 0 1px 0 #1d4ed8; }
  .${c}-btn.ghost { background: #fff; color: #1b1e2e; border-color: #dfe3ec; box-shadow: 0 5px 0 #dfe3ec; }
  .${c}-btn.ghost:active { box-shadow: 0 1px 0 #dfe3ec; }
  @keyframes ${c}-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ${c}-pop { from { transform: scale(.8); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .${c} *, .${c} *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
  `;
}
function makeStrip(root, c, title, level, { onExit, onLevel }) {
  const top = document.createElement('div');
  top.className = `${c}-top`;
  top.innerHTML = `<button type="button" class="${c}-key ${c}-exit" aria-label="Exit">${BACK}Exit</button>
    <div class="${c}-title">${esc(title)}</div>
    <div class="${c}-lv" role="group" aria-label="Level"><span>Level</span>${[1, 2, 3].map(n => `<button type="button" class="${c}-key" data-l="${n}" aria-label="Level ${n}">${n}</button>`).join('')}</div>
    <div class="${c}-tally" aria-live="polite"><b>${withStars('★ 0', 30)}</b><small></small></div>`;
  root.appendChild(top);
  const unb = [onTap(top.querySelector(`.${c}-exit`), () => onExit())];
  top.querySelectorAll(`.${c}-lv button`).forEach(b => unb.push(onTap(b, () => onLevel(+b.dataset.l))));
  const tb = top.querySelector(`.${c}-tally b`), ts = top.querySelector(`.${c}-tally small`);
  const api = {
    setLevel(l) { top.querySelectorAll(`.${c}-lv button`).forEach(b => b.classList.toggle('on', +b.dataset.l === l)); },
    setTally(html, bump) { tb.innerHTML = withStars(html, 30); if (bump) { tb.classList.remove('bump'); void tb.offsetWidth; tb.classList.add('bump'); } },
    setNote(t) { ts.textContent = t || ''; },
    destroy() { unb.forEach(u => u()); },
  };
  api.setLevel(level);
  return api;
}

const SILVER = { fill: '#d3d9e3', rim: '#8b93a3' };
const GREEN_INK = '#15803d';

// ---------- the game ----------
export function mount(el, ctx = {}) {
  injectCSS(C, stripCSS(C) + `
  .${C}-stage { flex: 1; min-height: 0; position: relative; margin: 0 12px 12px; border-radius: 26px; background: #e4f2ff; overflow: hidden; }
  .${C}-stage svg { position: absolute; inset: 0; }
  .${C} .ld-sky { cursor: ew-resize; }
  .${C} .ld-ctl { cursor: pointer; }
  .${C} .ld-ctl .ld-face { transition: transform .1s ease; }
  .${C} .ld-ctl:active .ld-face { transform: translateY(4px); }
  .${C} .ld-ctl.ld-off { opacity: .4; pointer-events: none; }
  .${C} .ld-msg { transition: opacity .25s; }
  `);

  const say = t => { try { ctx.say && ctx.say(t); } catch (e) { /* ignore */ } };
  const sfx = n => { try { (ctx.sfx || coreSfx)(n); } catch (e) { /* ignore */ } };
  const load = k => { try { return ctx.load ? ctx.load(k) : null; } catch (e) { return null; } };
  const save = (k, v) => { try { ctx.save && ctx.save(k, v); } catch (e) { /* ignore */ } };
  const calm = reducedMotion();

  let level = clamp(Math.round(ctx.level || 1), 1, 3);
  const root = document.createElement('div');
  root.className = C;
  el.appendChild(root);
  const strip = makeStrip(root, C, meta.title, level, { onExit: () => ctx.onExit && ctx.onExit(), onLevel: l => { level = l; strip.setLevel(l); startRound(); } });
  const stage = document.createElement('div');
  stage.className = `${C}-stage`;
  root.appendChild(stage);
  const svg = svgRoot(VW, VH);
  stage.appendChild(svg);

  const unb = [];
  let raf = 0, alive = true;
  let R, L, target, rocketX, phase, n, gold, silver, results, sumEl = null, lastTarget = null;
  const tween = { on: false };

  // ----- static layers -----
  const defs = S('defs', {});
  defs.innerHTML = `
    <linearGradient id="${C}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe1ff"/><stop offset=".75" stop-color="#e8f4ff"/><stop offset="1" stop-color="#f4f9ff"/></linearGradient>
    <radialGradient id="${C}-flame" cx=".5" cy=".2" r=".8"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#ffb35c"/><stop offset="1" stop-color="#ff6b3d" stop-opacity="0"/></radialGradient>`;
  svg.appendChild(defs);
  svg.appendChild(S('rect', { x: -400, y: -200, width: VW + 800, height: LINE_Y + 200, fill: `url(#${C}-sky)` }));
  // Soft white clouds with a pale outline (outline pass first, then the fill, so the bumps merge).
  const cloud = (x, y, s) => {
    const bumps = [[-48, 6, 26], [-20, -12, 34], [18, -18, 38], [52, 0, 28], [0, 10, 30]];
    const g = S('g', { transform: `translate(${x} ${y}) scale(${s})` });
    const o = S('g', {}), f = S('g', {});
    bumps.forEach(([bx, by, r]) => { o.appendChild(S('circle', { cx: bx, cy: by, r, fill: '#cfe2f3', stroke: '#cfe2f3', 'stroke-width': 8 })); f.appendChild(S('circle', { cx: bx, cy: by, r, fill: '#fff' })); });
    o.appendChild(S('rect', { x: -76, y: 8, width: 156, height: 32, rx: 16, fill: '#cfe2f3', stroke: '#cfe2f3', 'stroke-width': 8 }));
    f.appendChild(S('rect', { x: -76, y: 8, width: 156, height: 32, rx: 16, fill: '#fff' }));
    g.appendChild(o); g.appendChild(f);
    return g;
  };
  [[250, 150, 0.9], [760, 210, 0.7], [1110, 300, 0.85], [420, 360, 0.55], [1000, 150, 0.5]].forEach(([x, y, s]) => svg.appendChild(cloud(x, y, s)));
  // A friendly planet for space flavour.
  const planet = S('g', { transform: 'translate(36 300) scale(1.05)' });
  planet.innerHTML = artInner('planet');
  svg.appendChild(planet);
  // Moon ground and number line.
  svg.appendChild(S('rect', { x: -400, y: LINE_Y, width: VW + 800, height: VH - LINE_Y + 200, fill: '#ebe9f5' }));
  [[180, 610, 60, 12], [640, 628, 80, 13], [1050, 606, 50, 10], [400, 640, 36, 8], [880, 645, 44, 8]].forEach(([cx, cy, rx, ry]) => svg.appendChild(S('ellipse', { cx, cy, rx, ry, fill: '#dddaeb' })));
  const lineG = S('g', {});
  svg.appendChild(lineG);
  const ghostG = S('g', {});
  svg.appendChild(ghostG);
  const markG = S('g', {});
  svg.appendChild(markG);
  // Sky hit area (drag or tap to move the rocket).
  const sky = S('rect', { class: 'ld-sky', x: 0, y: 70, width: VW, height: LINE_Y - 70, fill: 'transparent' });
  svg.appendChild(sky);
  // Guide and rocket.
  const guide = S('line', { x1: 0, y1: HOVER_Y + RS * 0.45, x2: 0, y2: LINE_Y - 4, stroke: 'rgba(59,130,246,.55)', 'stroke-width': 4, 'stroke-dasharray': '6 10', 'stroke-linecap': 'round', 'pointer-events': 'none' });
  svg.appendChild(guide);
  const shadow = S('ellipse', { cx: 0, cy: LINE_Y, rx: 26, ry: 6, fill: 'rgba(27,30,46,.16)', 'pointer-events': 'none' });
  svg.appendChild(shadow);
  const rocketG = S('g', { 'pointer-events': 'none' });
  const flame = S('ellipse', { cx: 50, cy: 104, rx: 9, ry: 22, fill: `url(#${C}-flame)`, opacity: 0 });
  const body = S('g', {});
  body.innerHTML = artInner('rocket');
  const rocketInner = S('g', { transform: `translate(${-RS / 2} ${-RS * 0.9}) scale(${RS / 100})` }, [flame, body]);
  rocketG.appendChild(rocketInner);
  svg.appendChild(rocketG);
  const dust = S('g', { 'pointer-events': 'none' });
  svg.appendChild(dust);
  // Header card: the target, then the result.
  const HEAD = { cx: 580, y: 18, w: 460, h: 112 };
  const head = S('g', { class: 'ld-msg' });
  svg.appendChild(head);
  // Progress pips.
  const pipsG = S('g', { transform: 'translate(44 44)' });
  svg.appendChild(pipsG);
  // Controls: nudge left, nudge right, Land / Next (chunky keys with a solid bottom edge).
  const ctlG = S('g', {});
  svg.appendChild(ctlG);
  function button(x, y, w, h, label, cls, primary, iconD) {
    const g = S('g', { class: `ld-ctl ld-${cls}`, transform: `translate(${x} ${y})`, role: 'button', 'aria-label': label });
    const edge = primary ? PAL.blueDark : COL.lineStrong;
    g.appendChild(S('rect', { x: 0, y: 6, width: w, height: h, rx: 20, fill: edge }));
    const face = S('g', { class: 'ld-face' });
    face.appendChild(S('rect', { x: 1.5, y: 1.5, width: w - 3, height: h - 3, rx: 19, fill: primary ? PAL.blue : '#fff', stroke: edge, 'stroke-width': 3 }));
    if (iconD) face.appendChild(S('path', { d: iconD, transform: `translate(${w / 2} ${h / 2})`, fill: COL.ink, stroke: COL.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
    else face.appendChild(S('text', { x: w / 2, y: h / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 30, fill: primary ? '#fff' : COL.ink }, [label]));
    g.appendChild(face);
    ctlG.appendChild(g);
    return g;
  }
  const BTN = { y: 22, h: 76 };
  const bLeft = button(878, BTN.y, 80, BTN.h, 'Left', 'nudge', false, 'M-11 0 L9 -13 V13 Z');
  const bRight = button(968, BTN.y, 80, BTN.h, 'Right', 'nudge', false, 'M11 0 L-9 -13 V13 Z');
  const LAND = { x: 1058, w: 196 };
  const bLand = button(LAND.x, BTN.y, LAND.w, BTN.h, 'Land', 'land', true);
  const landText = bLand.querySelector('text');

  // ----- geometry -----
  const xOf = v => X0 + ((v - L.min) / (L.max - L.min)) * (X1 - X0);
  const vOf = x => clamp(Math.round(L.min + ((x - X0) / (X1 - X0)) * (L.max - L.min)), L.min, L.max);
  const unit = () => (X1 - X0) / (L.max - L.min);

  function drawLine() {
    lineG.replaceChildren();
    lineG.appendChild(S('line', { x1: X0 - 26, y1: LINE_Y, x2: X1 + 26, y2: LINE_Y, stroke: COL.ink, 'stroke-width': 6, 'stroke-linecap': 'round' }));
    for (let v = L.min; v <= L.max; v++) {
      let h = 0, lab = false;
      if (L.labels === 'all') { h = 24; lab = true; }
      else if (L.labels === 'tens') { h = v % 10 === 0 ? 30 : v % 5 === 0 ? 18 : 10; lab = v % 10 === 0; }
      else { if (v === L.min || v === L.max || v === (L.min + L.max) / 2) { h = 30; lab = true; } }
      if (!h) continue;
      lineG.appendChild(S('line', { x1: xOf(v), y1: LINE_Y - h / 2, x2: xOf(v), y2: LINE_Y + h / 2, stroke: COL.ink, 'stroke-width': lab ? 4 : 3, 'stroke-linecap': 'round', opacity: lab ? 1 : 0.55 }));
      if (lab) lineG.appendChild(S('text', { x: xOf(v), y: LINE_Y + 52, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': L.labels === 'all' ? 30 : 36, fill: COL.ink }, [String(v)]));
    }
  }

  function setRocket(x, y, flameOn) {
    rocketG.setAttribute('transform', `translate(${x} ${y})`);
    guide.setAttribute('x1', x); guide.setAttribute('x2', x);
    guide.setAttribute('y1', y + 6);
    shadow.setAttribute('cx', x);
    const k = clamp((y - HOVER_Y) / (LINE_Y - HOVER_Y), 0, 1);
    shadow.setAttribute('rx', 18 + k * 18); shadow.setAttribute('opacity', 0.5 + k * 0.5);
    flame.setAttribute('opacity', flameOn ? 1 : 0);
  }
  function setX(x) {
    rocketX = clamp(x, X0, X1);
    setRocket(rocketX, HOVER_Y, false);
  }

  function card() {
    head.replaceChildren();
    const x = HEAD.cx - HEAD.w / 2;
    head.appendChild(S('rect', { x, y: HEAD.y + 7, width: HEAD.w, height: HEAD.h, rx: 24, fill: COL.ink }));
    head.appendChild(S('rect', { x, y: HEAD.y, width: HEAD.w, height: HEAD.h, rx: 24, fill: '#fff', stroke: COL.ink, 'stroke-width': 4 }));
  }
  function starIcon(x, y, size, fill, rim) {
    const g = S('g', { transform: `translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})` });
    g.appendChild(S('path', { d: STAR_D, fill, stroke: rim, 'stroke-width': 7, 'stroke-linejoin': 'round' }));
    head.appendChild(g);
  }
  function header(main, sub, col = COL.ink, kind = 'none') {
    card();
    const hasStar = kind !== 'none';
    const tx = HEAD.cx + (hasStar ? 26 : 0);
    const t = S('text', { x: tx, y: HEAD.y + 46, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 40, fill: col }, [main]);
    head.appendChild(t);
    if (hasStar) {
      let w = main.length * 22;
      try { w = t.getComputedTextLength() || w; } catch (e) { /* ignore */ }
      starIcon(tx - w / 2 - 30, HEAD.y + 44, 46, kind === 'gold' ? PAL.yellow : SILVER.fill, COL.ink);
    }
    if (sub) head.appendChild(S('text', { x: HEAD.cx, y: HEAD.y + 88, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 500, 'font-size': 24, fill: COL.ink2 }, [sub]));
  }
  function targetHeader() {
    card();
    const t = S('text', { x: HEAD.cx, y: HEAD.y + HEAD.h / 2 + 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 44, fill: COL.ink });
    t.appendChild(S('tspan', {}, ['Land on ']));
    t.appendChild(S('tspan', { fill: PAL.blue, 'font-size': 70, 'font-weight': 800 }, [String(target)]));
    head.appendChild(t);
  }
  function pips() {
    pipsG.replaceChildren();
    for (let i = 0; i < ROUND; i++) {
      const r = results[i];
      const fill = r ? (r.kind === 'gold' ? PAL.yellow : r.kind === 'silver' ? SILVER.fill : '#9aa3b5') : '#fff';
      const stroke = r ? (r.kind === 'gold' ? PAL.yellowDark : r.kind === 'silver' ? SILVER.rim : '#9aa3b5') : i === n && phase !== 'done' ? COL.ink : COL.lineStrong;
      pipsG.appendChild(S('circle', { cx: i * 28, cy: 0, r: 9, fill, stroke, 'stroke-width': 3 }));
    }
  }
  function tallyText(bump) {
    strip.setTally(`★ ${gold} <span>☆ ${silver}</span>`, bump);
  }
  const bestAll = () => { const b = load('best'); return b && typeof b === 'object' ? b : {}; };
  function showBest() { const b = bestAll()[level]; strip.setNote(b ? `Best ${b} bullseyes` : ''); }

  // ----- animation -----
  function animate(ms, fn, done) {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    let paused = 0, hiddenAt = 0;
    tween.resume = () => { if (hiddenAt) { paused += performance.now() - hiddenAt; hiddenAt = 0; } raf = requestAnimationFrame(tick); };
    tween.pause = () => { hiddenAt = performance.now(); cancelAnimationFrame(raf); raf = 0; };
    const tick = now => {
      raf = 0;
      if (!alive) return;
      const k = calm ? 1 : clamp((now - t0 - paused) / ms, 0, 1);
      fn(k, now);
      if (k < 1) { if (!document.hidden) raf = requestAnimationFrame(tick); else tween.pause(); }
      else { tween.resume = tween.pause = null; done && done(); }
    };
    raf = requestAnimationFrame(tick);
  }
  const onVis = () => { if (document.hidden) tween.pause && tween.pause(); else tween.resume && tween.resume(); };
  document.addEventListener('visibilitychange', onVis);

  // ----- round flow -----
  function pickTarget() {
    let t;
    for (let i = 0; i < 30; i++) {
      if (level === 1) t = R.int(1, 19);
      else if (level === 2) t = R.chance(0.15) ? R.int(1, 9) * 10 : R.int(3, 97);
      else t = R.int(4, 96);
      if (level === 3 && [50].includes(t)) continue;
      if (t !== lastTarget && Math.abs(t - vOf(rocketX ?? X0)) > (level === 1 ? 2 : 8)) break;
    }
    lastTarget = t;
    return t;
  }
  function setControls(mode) {
    // mode: 'aim' (nudges + Land), 'busy' (nothing), 'next' (Next)
    bLeft.classList.toggle('ld-off', mode !== 'aim');
    bRight.classList.toggle('ld-off', mode !== 'aim');
    bLand.classList.toggle('ld-off', mode === 'busy');
    landText.textContent = mode === 'next' ? (n + 1 >= ROUND ? 'Finish' : 'Next') : 'Land';
  }
  function nextLanding() {
    markG.replaceChildren(); ghostG.replaceChildren(); dust.replaceChildren();
    target = pickTarget();
    phase = 'lift';
    setControls('busy');
    pips();
    const fromY = rocketG.__y ?? HOVER_Y;
    if (fromY > HOVER_Y + 1) {
      sfx('whoosh');
      animate(700, k => { const e = 1 - Math.pow(1 - k, 3); rocketG.__y = fromY + (HOVER_Y - fromY) * e; setRocket(rocketX, rocketG.__y, true); }, aim);
    } else aim();
  }
  function aim() {
    rocketG.__y = HOVER_Y;
    setRocket(rocketX, HOVER_Y, false);
    phase = 'aim';
    targetHeader();
    setControls('aim');
    say(`Land on ${target}.`);
  }
  function land() {
    if (phase !== 'aim') return;
    phase = 'landing';
    setControls('busy');
    const v = vOf(rocketX);
    const fromX = rocketX, toX = xOf(v);
    sfx('whoosh');
    animate(1300, (k, now) => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      rocketX = fromX + (toX - fromX) * Math.min(1, k * 2);
      rocketG.__y = HOVER_Y + (LINE_Y - HOVER_Y) * e;
      setRocket(rocketX, rocketG.__y, true);
      flame.setAttribute('ry', 18 + Math.sin(now / 30) * 5 + (1 - k) * 8);
    }, () => touchdown(v));
  }
  function touchdown(v) {
    setRocket(rocketX, LINE_Y, false);
    sfx('clunk');
    // Dust puff.
    for (let i = 0; i < 8; i++) {
      const dx = (i - 3.5) * 14;
      const c = S('circle', { cx: rocketX + dx, cy: LINE_Y - 6, r: 8, fill: 'rgba(150,160,182,.45)' });
      c.style.transition = 'transform .7s ease-out, opacity .7s ease-out';
      dust.appendChild(c);
      requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transform = `translate(${dx * 1.6}px, ${-10 - Math.abs(dx) * 0.2}px) scale(1.6)`; c.style.opacity = '0'; }));
    }
    const r = grade(level, target, v);
    results[n] = { target, landed: v, ...r };
    const isGold = r.kind === 'gold';
    // Marker where it touched down: green for a bullseye, ink otherwise.
    const mk = S('g', { transform: `translate(${xOf(v)} ${LINE_Y})` });
    mk.appendChild(S('rect', { x: -38, y: 70, width: 76, height: 50, rx: 14, fill: isGold ? COL.goodSoft : '#fff', stroke: isGold ? COL.good : COL.ink, 'stroke-width': 4 }));
    mk.appendChild(S('path', { d: 'M0 57 L-11 70 H11 Z', fill: isGold ? COL.good : COL.ink }));
    mk.appendChild(S('text', { x: 0, y: 96, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 32, fill: isGold ? GREEN_INK : COL.ink }, [String(v)]));
    markG.appendChild(mk);
    if (!isGold) {
      // Show where the target lives, in blue.
      const tx = xOf(target);
      const tg = S('g', { transform: `translate(${tx} ${LINE_Y})` });
      tg.appendChild(S('circle', { cx: 0, cy: 0, r: 14, fill: '#fff', stroke: PAL.blue, 'stroke-width': 5 }));
      tg.appendChild(S('path', { d: 'M0 -20 V-66', stroke: PAL.blue, 'stroke-width': 4, 'stroke-dasharray': '5 7', 'stroke-linecap': 'round' }));
      tg.appendChild(S('rect', { x: -40, y: -122, width: 80, height: 52, rx: 14, fill: COL.focusSoft, stroke: PAL.blue, 'stroke-width': 4 }));
      tg.appendChild(S('text', { x: 0, y: -96, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 32, fill: PAL.blueDark }, [String(target)]));
      ghostG.appendChild(tg);
    }
    if (isGold) { gold++; sfx('chime'); header(r.text, r.line, GREEN_INK, 'gold'); }
    else if (r.kind === 'silver') { silver++; sfx('pop'); header(r.text, r.line, PAL.blueDark, 'silver'); }
    else header(r.text, r.line, COL.ink);
    tallyText(r.kind !== 'none');
    phase = 'landed';
    n++;
    pips();
    setControls('next');
  }
  function onMain() {
    if (phase === 'aim') land();
    else if (phase === 'landed') { if (n >= ROUND) finish(); else nextLanding(); }
  }
  function finish() {
    phase = 'done';
    setControls('busy');
    const b = bestAll();
    const prev = b[level] || 0;
    const isBest = gold > prev;
    if (isBest) { b[level] = gold; save('best', b); }
    save('plays', (load('plays') || 0) + 1);
    showBest();
    sfx('chime');
    sumEl = document.createElement('div');
    sumEl.className = `${C}-sum`;
    sumEl.innerHTML = `<div class="${C}-card">
      <div class="eb">${ROUND} landings</div>
      <div class="big">${withStars(`★ ${gold} <span>☆ ${silver}</span>`, 64)}</div>
      <p>${gold === 1 ? '1 bullseye' : `${gold} bullseyes`} and ${silver} close</p>
      <p class="best">${isBest && gold > 0 ? 'Your best yet at this level.' : prev ? `Your best at level ${level}: ${prev} bullseyes` : ''}</p>
      <div class="row"><button type="button" class="${C}-btn go">Play again</button>${level < 3 ? `<button type="button" class="${C}-btn ghost up">Try level ${level + 1}</button>` : ''}</div>
    </div>`;
    root.appendChild(sumEl);
    const u = [];
    u.push(onTap(sumEl.querySelector('.go'), () => { u.forEach(f => f()); startRound(); }));
    const up = sumEl.querySelector('.up');
    if (up) u.push(onTap(up, () => { u.forEach(f => f()); level += 1; strip.setLevel(level); startRound(); }));
  }
  function startRound() {
    cancelAnimationFrame(raf); raf = 0;
    if (sumEl) { sumEl.remove(); sumEl = null; }
    R = makeRand();
    L = LEVELS[level];
    drawLine();
    n = 0; gold = 0; silver = 0; results = [];
    tallyText(false);
    showBest();
    rocketX = (X0 + X1) / 2;
    rocketG.__y = HOVER_Y;
    nextLanding();
  }

  // ----- input -----
  unb.push(drag(sky, {
    start(p) { if (phase === 'aim') { sfx('tick'); glideTo(p.x); } },
    move(p) { if (phase === 'aim') { cancelAnimationFrame(raf); raf = 0; setX(p.x); } },
  }, svg));
  function glideTo(x) {
    const from = rocketX, to = clamp(x, X0, X1);
    animate(160, k => setX(from + (to - from) * (1 - Math.pow(1 - k, 2))));
  }
  unb.push(onTap(bLeft, () => { if (phase === 'aim') { sfx('tick'); setX(xOf(vOf(rocketX)) - unit()); } }));
  unb.push(onTap(bRight, () => { if (phase === 'aim') { sfx('tick'); setX(xOf(vOf(rocketX)) + unit()); } }));
  unb.push(onTap(bLand, onMain));

  startRound();

  // Tests only.
  const debug = !!(ctx.debug || /[?&]arcdebug\b/.test(location.search));
  if (debug) {
    const client = (x, y) => { const m = svg.getScreenCTM(); const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; const q = pt.matrixTransform(m); return { cx: q.x, cy: q.y }; };
    window.__arc = {
      id: meta.id,
      target: () => target,
      phase: () => phase,
      aimPoint: v => client(xOf(v), HOVER_Y - 40),
      rocketValue: () => vOf(rocketX),
      landButton: () => ({ el: bLand, ...client(LAND.x + LAND.w / 2, BTN.y + BTN.h / 2) }),
      skyEl: sky,
      result: () => results[n - 1],
      stars: () => ({ gold, silver, n }),
    };
  }

  return {
    destroy() {
      alive = false;
      cancelAnimationFrame(raf); raf = 0;
      document.removeEventListener('visibilitychange', onVis);
      unb.forEach(u => u());
      strip.destroy();
      if (debug && window.__arc && window.__arc.id === meta.id) delete window.__arc;
      el.replaceChildren();
    },
  };
}
