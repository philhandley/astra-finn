// Rocket Landing (SVG). A target number appears; move the rocket above the number line and land it.
// Bullseye (gold star) within 1 (exact at level 1); Close (silver star) within 5. Ten landings a round.
// Tests only: ctx.debug or ?arcdebug exposes window.__arc (target, aimAt, land, result, stars).
import { S, svgRoot, onTap, drag, injectCSS, clamp, esc, reducedMotion } from '../core/dom.js';
import { makeRand } from '../core/rand.js';
import { COL, FONT } from '../core/theme.js';
import { artInner } from '../core/art.js';
import { sfx as coreSfx } from '../core/sfx.js';

export const meta = { id: 'landing', title: 'Rocket Landing', about: 'Land the rocket on the right spot on the number line.', icon: 'rocket' };

const C = 'arc-land';
const VW = 1280, VH = 636;
const ROUND = 10;
const X0 = 80, X1 = 1200, LINE_Y = 500, HOVER_Y = 250;
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
const BACK = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function stripCSS(c) {
  return `
  .${c} { position: absolute; inset: 0; display: flex; flex-direction: column; color: var(--ink, #f3efe6); font-family: var(--font-body, system-ui); overflow: hidden; user-select: none; -webkit-user-select: none; }
  .${c}-top { flex: none; height: 84px; display: flex; align-items: center; gap: 18px; padding: 0 18px; border-bottom: 1px solid var(--line, rgba(255,255,255,.12)); background: rgba(5,8,18,.6); position: relative; z-index: 3; }
  .${c} button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .${c}-exit { appearance: none; min-height: 64px; min-width: 64px; padding: 0 22px 0 14px; border-radius: 999px; border: 1.5px solid var(--line, rgba(255,255,255,.12)); background: rgba(255,255,255,.04); color: var(--ink, #f3efe6); font: 600 22px ${FONT.display}; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
  .${c}-exit:active { transform: scale(.96); }
  .${c}-title { flex: 1; font: 600 28px ${FONT.display}; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .${c}-lv { display: flex; align-items: center; gap: 8px; }
  .${c}-lv span { font: 600 15px ${FONT.display}; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3, #7d869a); margin-right: 4px; }
  .${c}-lv button { appearance: none; width: 64px; height: 64px; border-radius: 50%; border: 1.5px solid var(--line, rgba(255,255,255,.12)); background: transparent; color: var(--ink, #f3efe6); font: 600 26px ${FONT.display}; cursor: pointer; transition: background .2s, color .2s; }
  .${c}-lv button.on { background: var(--gold, #f2b544); border-color: var(--gold, #f2b544); color: #1a1205; }
  .${c}-tally { min-width: 130px; text-align: right; line-height: 1.1; }
  .${c}-tally b { font: 700 30px ${FONT.display}; color: var(--gold, #f2b544); }
  .${c}-tally small { display: block; font: 500 16px ${FONT.display}; color: var(--ink-3, #7d869a); margin-top: 3px; }
  .${c}-tally b.bump { animation: ${c}-bump .35s ease; display: inline-block; }
  @keyframes ${c}-bump { 40% { transform: scale(1.3); } }
  .${c}-sum { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(4,6,14,.62); z-index: 5; animation: ${c}-fade .3s ease; }
  .${c}-sum .${c}-card { min-width: 460px; max-width: 640px; text-align: center; padding: 34px 40px 30px; border-radius: 24px; background: #111a2e; border: 1px solid rgba(255,255,255,.14); box-shadow: 0 20px 60px rgba(0,0,0,.5); }
  .${c}-sum .eb { font: 600 16px ${FONT.display}; letter-spacing: .16em; text-transform: uppercase; color: var(--gold, #f2b544); }
  .${c}-sum .big { font: 700 64px ${FONT.display}; color: var(--gold, #f2b544); margin: 10px 0 2px; }
  .${c}-sum p { margin: 6px 0; font-size: 22px; color: var(--ink-2, #b9c0cf); }
  .${c}-sum p.best { font-size: 18px; color: var(--ink-3, #7d869a); }
  .${c}-sum .row { display: flex; gap: 14px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
  .${c}-btn { appearance: none; border: 0; min-height: 64px; padding: 0 30px; border-radius: 999px; font: 600 23px ${FONT.display}; background: var(--gold, #f2b544); color: #1a1205; cursor: pointer; }
  .${c}-btn.ghost { background: transparent; color: var(--ink, #f3efe6); border: 1.5px solid rgba(255,255,255,.18); }
  .${c}-btn:active { transform: scale(.96); }
  @keyframes ${c}-fade { from { opacity: 0; } to { opacity: 1; } }
  `;
}
function makeStrip(root, c, title, level, { onExit, onLevel }) {
  const top = document.createElement('div');
  top.className = `${c}-top`;
  top.innerHTML = `<button type="button" class="${c}-exit" aria-label="Exit">${BACK}Exit</button>
    <div class="${c}-title">${esc(title)}</div>
    <div class="${c}-lv" role="group" aria-label="Level"><span>Level</span>${[1, 2, 3].map(n => `<button type="button" data-l="${n}" aria-label="Level ${n}">${n}</button>`).join('')}</div>
    <div class="${c}-tally" aria-live="polite"><b>★ 0</b><small></small></div>`;
  root.appendChild(top);
  const unb = [onTap(top.querySelector(`.${c}-exit`), () => onExit())];
  top.querySelectorAll(`.${c}-lv button`).forEach(b => unb.push(onTap(b, () => onLevel(+b.dataset.l))));
  const tb = top.querySelector(`.${c}-tally b`), ts = top.querySelector(`.${c}-tally small`);
  const api = {
    setLevel(l) { top.querySelectorAll(`.${c}-lv button`).forEach(b => b.classList.toggle('on', +b.dataset.l === l)); },
    setTally(html, bump) { tb.innerHTML = html; if (bump) { tb.classList.remove('bump'); void tb.offsetWidth; tb.classList.add('bump'); } },
    setNote(t) { ts.textContent = t || ''; },
    destroy() { unb.forEach(u => u()); },
  };
  api.setLevel(level);
  return api;
}

const SILVER = '#c9d1dc';

// ---------- the game ----------
export function mount(el, ctx = {}) {
  injectCSS(C, stripCSS(C) + `
  .${C}-stage { flex: 1; min-height: 0; position: relative; }
  .${C}-stage svg { position: absolute; inset: 0; }
  .${C} .ld-sky { cursor: ew-resize; }
  .${C} .ld-ctl { cursor: pointer; }
  .${C} .ld-ctl:active { opacity: .8; }
  .${C} .ld-ctl.ld-off { opacity: .35; pointer-events: none; }
  .${C} .ld-msg { transition: opacity .25s; }
  .${C} .ld-tally-silver { color: ${SILVER}; }
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
    <linearGradient id="${C}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060a18"/><stop offset="1" stop-color="#0f1a36"/></linearGradient>
    <linearGradient id="${C}-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3350"/><stop offset="1" stop-color="#151b2e"/></linearGradient>
    <radialGradient id="${C}-flame" cx=".5" cy=".2" r=".8"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#ffb35c"/><stop offset="1" stop-color="#ff6b3d" stop-opacity="0"/></radialGradient>`;
  svg.appendChild(defs);
  svg.appendChild(S('rect', { x: 0, y: 0, width: VW, height: VH, fill: `url(#${C}-sky)` }));
  const starsG = S('g', { opacity: 0.8 });
  const SR = makeRand(11);
  for (let i = 0; i < 90; i++) starsG.appendChild(S('circle', { cx: SR.int(0, VW), cy: SR.int(0, LINE_Y - 40), r: (0.6 + SR.next() * 1.4).toFixed(2), fill: SR.chance(0.15) ? '#ffe9b8' : '#cfe3ff', opacity: (0.3 + SR.next() * 0.6).toFixed(2) }));
  svg.appendChild(starsG);
  // A far planet for depth.
  svg.appendChild(S('circle', { cx: 150, cy: 330, r: 34, fill: '#2b3a66', opacity: 0.55 }));
  svg.appendChild(S('ellipse', { cx: 150, cy: 330, rx: 56, ry: 11, fill: 'none', stroke: '#7c9cff', 'stroke-width': 3, opacity: 0.28, transform: 'rotate(-14 150 330)' }));
  // Ground and number line.
  svg.appendChild(S('path', { d: `M0 ${LINE_Y} H${VW} V${VH} H0Z`, fill: `url(#${C}-ground)` }));
  [[180, 590, 60, 10], [640, 610, 80, 12], [1050, 585, 50, 9], [400, 615, 36, 7]].forEach(([cx, cy, rx, ry]) => svg.appendChild(S('ellipse', { cx, cy, rx, ry, fill: 'rgba(0,0,0,.22)' })));
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
  const guide = S('line', { x1: 0, y1: HOVER_Y + RS * 0.45, x2: 0, y2: LINE_Y - 4, stroke: 'rgba(95,212,255,.35)', 'stroke-width': 3, 'stroke-dasharray': '6 10', 'pointer-events': 'none' });
  svg.appendChild(guide);
  const shadow = S('ellipse', { cx: 0, cy: LINE_Y, rx: 26, ry: 6, fill: 'rgba(95,212,255,.3)', 'pointer-events': 'none' });
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
  // Header: target and message.
  const head = S('g', { class: 'ld-msg' });
  svg.appendChild(head);
  // Progress pips.
  const pipsG = S('g', { transform: 'translate(40 40)' });
  svg.appendChild(pipsG);
  // Controls: nudge left, nudge right, Land / Next.
  const ctlG = S('g', {});
  svg.appendChild(ctlG);
  function button(x, y, w, h, label, cls, fill, ink) {
    const g = S('g', { class: `ld-ctl ld-${cls}`, transform: `translate(${x} ${y})`, role: 'button', 'aria-label': label });
    g.appendChild(S('rect', { x: 0, y: 0, width: w, height: h, rx: h / 2, fill, stroke: fill === 'none' ? 'rgba(255,255,255,.22)' : 'none', 'stroke-width': 2 }));
    g.appendChild(S('text', { x: w / 2, y: h / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 28, fill: ink }, [label]));
    ctlG.appendChild(g);
    return g;
  }
  const bLeft = button(870, 22, 76, 72, '◀', 'nudge', 'rgba(255,255,255,.06)', COL.ink);
  const bRight = button(956, 22, 76, 72, '▶', 'nudge', 'rgba(255,255,255,.06)', COL.ink);
  const bLand = button(1046, 22, 200, 72, 'Land', 'land', COL.tens, '#1a1205');
  const landText = bLand.querySelector('text');

  // ----- geometry -----
  const xOf = v => X0 + ((v - L.min) / (L.max - L.min)) * (X1 - X0);
  const vOf = x => clamp(Math.round(L.min + ((x - X0) / (X1 - X0)) * (L.max - L.min)), L.min, L.max);
  const unit = () => (X1 - X0) / (L.max - L.min);

  function drawLine() {
    lineG.replaceChildren();
    lineG.appendChild(S('line', { x1: X0 - 20, y1: LINE_Y, x2: X1 + 20, y2: LINE_Y, stroke: COL.ink, 'stroke-width': 5, 'stroke-linecap': 'round' }));
    for (let v = L.min; v <= L.max; v++) {
      let h = 0, lab = false;
      if (L.labels === 'all') { h = 18; lab = true; }
      else if (L.labels === 'tens') { h = v % 10 === 0 ? 24 : v % 5 === 0 ? 14 : 8; lab = v % 10 === 0; }
      else { if (v === L.min || v === L.max || v === (L.min + L.max) / 2) { h = 24; lab = true; } }
      if (!h) continue;
      lineG.appendChild(S('line', { x1: xOf(v), y1: LINE_Y - h / 2, x2: xOf(v), y2: LINE_Y + h / 2, stroke: COL.ink, 'stroke-width': lab ? 3 : 2, opacity: lab ? 1 : 0.6 }));
      if (lab) lineG.appendChild(S('text', { x: xOf(v), y: LINE_Y + 44, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 600, 'font-size': L.labels === 'all' ? 28 : 32, fill: COL.ink2 }, [String(v)]));
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

  function header(main, sub, col = COL.ink) {
    head.replaceChildren();
    head.appendChild(S('text', { x: VW / 2 - 60, y: 66, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 52, fill: col }, [main]));
    if (sub) head.appendChild(S('text', { x: VW / 2 - 60, y: 116, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 500, 'font-size': 28, fill: COL.ink2 }, [sub]));
  }
  function targetHeader() {
    head.replaceChildren();
    const t = S('text', { x: VW / 2 - 60, y: 70, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 52, fill: COL.ink });
    t.appendChild(S('tspan', {}, ['Land on ']));
    t.appendChild(S('tspan', { fill: COL.tens, 'font-size': 64 }, [String(target)]));
    head.appendChild(t);
  }
  function pips() {
    pipsG.replaceChildren();
    for (let i = 0; i < ROUND; i++) {
      const r = results[i];
      const fill = r ? (r.kind === 'gold' ? COL.tens : r.kind === 'silver' ? SILVER : 'rgba(255,255,255,.25)') : 'none';
      pipsG.appendChild(S('circle', { cx: i * 26, cy: 0, r: 8, fill, stroke: i === n && phase !== 'done' ? COL.tens : 'rgba(255,255,255,.3)', 'stroke-width': 2 }));
    }
  }
  function tallyText(bump) {
    strip.setTally(`★ ${gold} <span class="ld-tally-silver">☆ ${silver}</span>`, bump);
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
      const c = S('circle', { cx: rocketX + dx, cy: LINE_Y - 6, r: 8, fill: 'rgba(200,205,220,.5)' });
      c.style.transition = 'transform .7s ease-out, opacity .7s ease-out';
      dust.appendChild(c);
      requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transform = `translate(${dx * 1.6}px, ${-10 - Math.abs(dx) * 0.2}px) scale(1.6)`; c.style.opacity = '0'; }));
    }
    const r = grade(level, target, v);
    results[n] = { target, landed: v, ...r };
    // Marker where it touched down.
    const mk = S('g', { transform: `translate(${xOf(v)} ${LINE_Y})` });
    mk.appendChild(S('path', { d: 'M0 -2 L-12 -22 H12 Z', fill: r.kind === 'none' ? COL.ink : r.kind === 'gold' ? COL.tens : SILVER }));
    mk.appendChild(S('rect', { x: -34, y: 58, width: 68, height: 44, rx: 12, fill: 'rgba(8,12,28,.9)', stroke: r.kind === 'gold' ? COL.tens : 'rgba(255,255,255,.3)', 'stroke-width': 2 }));
    mk.appendChild(S('text', { x: 0, y: 81, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: r.kind === 'gold' ? COL.tens : COL.ink }, [String(v)]));
    markG.appendChild(mk);
    if (r.kind !== 'gold') {
      // Show where the target lives.
      const tx = xOf(target);
      const tg = S('g', { transform: `translate(${tx} ${LINE_Y})` });
      tg.appendChild(S('circle', { cx: 0, cy: 0, r: 13, fill: 'none', stroke: COL.ones, 'stroke-width': 4 }));
      tg.appendChild(S('path', { d: 'M0 -18 V-70', stroke: COL.ones, 'stroke-width': 3, 'stroke-dasharray': '5 6' }));
      tg.appendChild(S('rect', { x: -34, y: -118, width: 68, height: 46, rx: 12, fill: 'rgba(95,212,255,.16)', stroke: COL.ones, 'stroke-width': 2 }));
      tg.appendChild(S('text', { x: 0, y: -95, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: COL.ones }, [String(target)]));
      ghostG.appendChild(tg);
    }
    if (r.kind === 'gold') { gold++; sfx('chime'); header(`★ ${r.text}`, r.line, COL.tens); }
    else if (r.kind === 'silver') { silver++; sfx('pop'); header(`☆ ${r.text}`, r.line, SILVER); }
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
      <div class="big">★ ${gold} <span style="color:${SILVER}">☆ ${silver}</span></div>
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
      landButton: () => ({ el: bLand, ...client(1146, 58) }),
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
