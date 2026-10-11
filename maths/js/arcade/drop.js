// Bond Drop (canvas well + DOM panels). A gentle, Tetris-style number game for a six-year-old.
// One number block falls at a time. Steer it (tap a column, drag, or the big arrow keys) and Drop it.
// Add: two touching blocks that make the target pop. Take away: two touching blocks whose difference
// is the target pop. Blocks above fall and can chain ("Combo!"). No game over: when a column reaches
// the top, the top three rows slide away. A round is 20 pops, then a summary card.
// Style v2: black chrome, white board, a deep night-blue well framed in ink, bright outlined blocks
// with big white numerals, a big yellow target card, tactile keys.
//
// URL params (tests and screenshots only):
//   ?debug (or ctx.debug, ?arcdebug)  exposes window.__drop (state, setBoard, warp, until, manual, ...)
//   ?dropmode=sub                     start in Take away mode (otherwise the saved mode, else Add)
//   ?dropseed=<n>                     seed the random numbers so a picture can be repeated
import { injectCSS, onTap, clamp, esc, reducedMotion } from '../core/dom.js';
import { makeRand } from '../core/rand.js';
import { COL, PAL, FONT } from '../core/theme.js';
import { factKey } from '../core/facts.js';
import { sfx as coreSfx } from '../core/sfx.js';

export const meta = { id: 'drop', title: 'Bond Drop', about: 'Drop number blocks so touching pairs make the target.', icon: 'star' };

const C = 'arc-drop';
const COLS = 6, ROWS = 9;
const ROUND = 20;          // pops per round
const CHANGE_EVERY = 5;    // pops between "New target!" (not Add level 1)
const PACE = { 1: 0.75, 2: 0.95, 3: 1.15 }; // rows per second while falling on its own
const HOVER = 0.7;         // seconds a new block hovers at the top before it starts to fall
const LOCK = 0.25;         // grace after touching down (soft landings only)
const HARD = 24;           // rows per second when dropped
const GRAV = 46;           // rows per second squared when blocks above a pop fall
const BURST = 0.45, SLIDE = 0.8, FLY = 0.65;
const USEFUL = 0.9;        // chance the next block is one that can pop somewhere
const INK = COL.ink;
const YEL = '#ffcc33', YEL_D = '#c99a0e';

// ---------- numbers ----------
const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
// targets: what the target can be; hi: biggest block; change: "New target!" every few pops; seed: starter blocks.
const LEVELS = {
  add: {
    1: { targets: [10], hi: 9, change: false, seed: 4 },
    2: { targets: range(8, 15), hi: 14, change: true, seed: 5 },
    3: { targets: range(11, 20), hi: 15, change: true, seed: 6 },
  },
  sub: {
    1: { targets: [1, 2, 3], hi: 10, change: true, seed: 4 },
    2: { targets: range(2, 6), hi: 15, change: true, seed: 5 },
    3: { targets: range(3, 9), hi: 20, change: true, seed: 6 },
  },
};

export function makeRule(mode, T, hi) {
  if (mode === 'add') {
    const lo = Math.max(1, T - hi), top = Math.min(hi, T - 1);
    const r = {
      mode, T, lo, hi: top,
      match: (a, b) => a + b === T,
      partners: n => (T - n >= lo && T - n <= top ? [T - n] : []),
      eq: (a, b) => `${a} + ${b} = ${T}`,
      fact: (a, b) => factKey('+', a, b),
    };
    r.values = range(lo, top).filter(v => r.partners(v).length);
    return r;
  }
  const r = {
    mode, T, lo: 1, hi,
    match: (a, b) => Math.abs(a - b) === T,
    partners: n => [n + T, n - T].filter(v => v >= 1 && v <= hi),
    eq: (a, b) => `${Math.max(a, b)} − ${Math.min(a, b)} = ${T}`,
    fact: (a, b) => factKey('-', Math.max(a, b), Math.min(a, b)),
  };
  r.values = range(1, hi).filter(v => r.partners(v).length);
  return r;
}

// Block colours by value, so the same number always looks the same: [face, lip].
const BLOCK = [
  [PAL.red, PAL.redDark], [PAL.orange, PAL.orangeDark], [PAL.yellow, PAL.yellowDark], [PAL.green, PAL.greenDark],
  [PAL.teal, PAL.tealDark], [PAL.blue, PAL.blueDark], [PAL.purple, PAL.purpleDark], [PAL.pink, PAL.pinkDark],
];
const colourOf = v => BLOCK[(Math.max(1, v) - 1) % BLOCK.length];

function blockSVG(v, size) {
  const [f, d] = colourOf(v);
  const t = String(v), fs = t.length > 1 ? 44 : 54;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <rect x="4" y="4" width="92" height="92" rx="17" fill="${d}"/>
    <rect x="4" y="4" width="92" height="85" rx="17" fill="${f}"/>
    <rect x="16" y="12" width="29" height="8" rx="4" fill="#fff" opacity=".38"/>
    <rect x="4" y="4" width="92" height="92" rx="17" fill="none" stroke="${INK}" stroke-width="5"/>
    <text x="50" y="48" text-anchor="middle" dominant-baseline="central" font-family="${FONT.display.replace(/"/g, "'")}" font-weight="800" font-size="${fs}"
      fill="#fff" stroke="${INK}" stroke-width="9" stroke-linejoin="round" paint-order="stroke">${t}</text>
  </svg>`;
}

const ICON = {
  left: '<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><path d="M29 9L14 24l15 15" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><path d="M19 9l15 15-15 15" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 48 48" width="42" height="42" aria-hidden="true"><path d="M24 7v29M11 24l13 13 13-13" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="5.5" y="4.5" width="4.5" height="15" rx="1.6" fill="currentColor"/><rect x="14" y="4.5" width="4.5" height="15" rx="1.6" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
};

// ---------- shared strip (each arcade file carries its own copy; this one adds the Add / Take away toggle) ----------
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
  .${c}-mode { display: inline-flex; border-radius: 16px; border: 2px solid #3a3f4d; background: #23262f; box-shadow: 0 5px 0 #3a3f4d; overflow: hidden; margin-right: 10px; }
  .${c}-mode button { appearance: none; cursor: pointer; border: 0; background: transparent; color: #c5cad6; font-weight: 700; font-size: 21px; min-height: 58px; padding: 0 18px 0 12px; display: inline-flex; align-items: center; gap: 10px; transition: background .15s, color .15s; }
  .${c}-mode button + button { border-left: 2px solid #3a3f4d; }
  .${c}-mode button i { font-style: normal; display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: #3a3f4d; color: #fff; font-weight: 800; font-size: 26px; line-height: 1; padding-bottom: 3px; }
  .${c}-mode button.on { background: #fff; color: #1b1e2e; }
  .${c}-mode button.on i { background: ${PAL.blue}; }
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
  .${c}-sum { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.55); z-index: 8; animation: ${c}-fade .3s ease; }
  .${c}-card { min-width: 480px; max-width: 660px; text-align: center; padding: 30px 44px 34px; border-radius: 28px; background: #fff; color: #1b1e2e; border: 4px solid #1b1e2e; box-shadow: 0 8px 0 #1b1e2e, 0 30px 70px rgba(0,0,0,.45); animation: ${c}-pop .45s cubic-bezier(.2,1.4,.4,1); }
  .${c}-sum .eb { font-weight: 700; font-size: 15px; letter-spacing: .16em; text-transform: uppercase; color: #4b5168; }
  .${c}-sum .big { display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 800; font-size: 72px; line-height: 1; margin: 16px 0 10px; color: #1b1e2e; }
  .${c}-sum .big span { display: inline-flex; align-items: center; gap: 12px; margin-left: 18px; }
  .${c}-sum p { margin: 6px 0; font-size: 22px; font-weight: 500; color: #4b5168; }
  .${c}-sum p.best { font-size: 18px; color: #8b91a7; min-height: 1.2em; }
  .${c}-sum .row { display: flex; gap: 14px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
  .${c}-btn { appearance: none; cursor: pointer; min-height: 64px; padding: 0 30px; border-radius: 18px; border: 3px solid #1d4ed8; background: #3b82f6; color: #fff; font-weight: 700; font-size: 23px; box-shadow: 0 5px 0 #1d4ed8; transition: transform .1s ease, box-shadow .1s ease; display: inline-flex; align-items: center; justify-content: center; gap: 10px; }
  .${c}-btn:active { transform: translateY(4px); box-shadow: 0 1px 0 #1d4ed8; }
  .${c}-btn.ghost { background: #fff; color: #1b1e2e; border-color: #dfe3ec; box-shadow: 0 5px 0 #dfe3ec; }
  .${c}-btn.ghost:active { box-shadow: 0 1px 0 #dfe3ec; }
  @keyframes ${c}-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ${c}-pop { from { transform: scale(.8); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .${c} *, .${c} *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
  `;
}
function makeStrip(root, c, title, level, mode, { onExit, onLevel, onMode }) {
  const top = document.createElement('div');
  top.className = `${c}-top`;
  top.innerHTML = `<button type="button" class="${c}-key ${c}-exit" aria-label="Exit">${BACK}Exit</button>
    <div class="${c}-title">${esc(title)}</div>
    <div class="${c}-mode" role="group" aria-label="Mode"><button type="button" data-m="add"><i>+</i>Add</button><button type="button" data-m="sub"><i>−</i>Take away</button></div>
    <div class="${c}-lv" role="group" aria-label="Level"><span>Level</span>${[1, 2, 3].map(n => `<button type="button" class="${c}-key" data-l="${n}" aria-label="Level ${n}">${n}</button>`).join('')}</div>
    <div class="${c}-tally" aria-live="polite"><b>${withStars('★ 0', 30)}</b><small></small></div>`;
  root.appendChild(top);
  const unb = [onTap(top.querySelector(`.${c}-exit`), () => onExit())];
  top.querySelectorAll(`.${c}-lv button`).forEach(b => unb.push(onTap(b, () => onLevel(+b.dataset.l))));
  top.querySelectorAll(`.${c}-mode button`).forEach(b => unb.push(onTap(b, () => onMode(b.dataset.m))));
  const tb = top.querySelector(`.${c}-tally b`), ts = top.querySelector(`.${c}-tally small`);
  const api = {
    el: top,
    setLevel(l) { top.querySelectorAll(`.${c}-lv button`).forEach(b => b.classList.toggle('on', +b.dataset.l === l)); },
    setMode(m) { top.querySelectorAll(`.${c}-mode button`).forEach(b => { b.classList.toggle('on', b.dataset.m === m); b.setAttribute('aria-pressed', String(b.dataset.m === m)); }); },
    setTally(html, bump) { tb.innerHTML = withStars(html, 30); if (bump) { tb.classList.remove('bump'); void tb.offsetWidth; tb.classList.add('bump'); } },
    setNote(t) { ts.textContent = t || ''; },
    starRect() { const s = tb.querySelector('.st'); if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    destroy() { unb.forEach(u => u()); },
  };
  api.setLevel(level);
  api.setMode(mode);
  return api;
}

// ---------- the game ----------
export function mount(el, ctx = {}) {
  injectCSS(C, stripCSS(C) + `
  .${C}-board { flex: 1; min-height: 0; margin: 0 12px 12px; border-radius: 26px; background: ${COL.surface}; color: ${INK}; position: relative; overflow: hidden;
    display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); column-gap: 34px; padding: 14px 26px 16px; }
  .${C}-side { display: flex; flex-direction: column; gap: 16px; min-width: 0; width: 100%; max-width: 320px; min-height: 0; }
  .${C}-left { justify-self: end; }
  .${C}-right { justify-self: start; }
  .${C}-grow { flex: 1; min-height: 0; }
  .${C}-lab { font-weight: 700; font-size: 15px; letter-spacing: .15em; text-transform: uppercase; color: ${COL.ink3}; }
  .${C}-target { position: relative; text-align: center; color: ${INK}; background: ${YEL}; border: 4px solid ${INK}; border-radius: 28px; box-shadow: 0 8px 0 ${INK}; padding: 16px 14px 20px; margin-bottom: 8px; }
  .${C}-target .eb { font-weight: 800; font-size: 19px; letter-spacing: .16em; text-transform: uppercase; color: #5b4300; }
  .${C}-target .num { font-weight: 800; font-size: 124px; line-height: 1; letter-spacing: -.03em; margin: 4px 0 12px; }
  .${C}-target .eq { display: flex; align-items: center; justify-content: center; gap: 9px; font-weight: 800; font-size: 32px; line-height: 1; }
  .${C}-target .eq i { flex: none; width: 46px; height: 46px; border-radius: 12px; background: #fff; border: 3px solid ${INK}; box-shadow: inset 0 -5px 0 ${COL.line}; }
  .${C}-target.flash { animation: ${C}-flash 1s cubic-bezier(.2,1.4,.4,1); }
  @keyframes ${C}-flash { 0% { transform: scale(.82) rotate(-3deg); } 40% { transform: scale(1.08) rotate(1deg); background: #ffe27a; } 100% { transform: none; } }
  .${C}-hint { font-size: 19px; font-weight: 500; line-height: 1.35; color: ${COL.ink2}; text-align: center; padding: 0 6px; }
  .${C}-hint b { color: ${INK}; font-weight: 800; }
  .${C}-prog .top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 9px; }
  .${C}-prog .top b { font-weight: 800; font-size: 21px; color: ${INK}; }
  .${C}-prog .bar { height: 24px; border-radius: 12px; background: ${COL.surface2}; border: 3px solid ${COL.line}; overflow: hidden; }
  .${C}-prog .bar i { display: block; height: 100%; width: 0; background: ${COL.good}; border-radius: 9px; transition: width .45s cubic-bezier(.3,1.3,.5,1); }
  .${C}-k { appearance: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 10px; border-radius: 22px; border: 3px solid ${COL.line}; background: #fff; color: ${INK};
    font-weight: 700; font-size: 23px; box-shadow: 0 6px 0 ${COL.line}; transition: transform .08s ease, box-shadow .08s ease, background .15s; touch-action: manipulation; }
  .${C}-k.down, .${C}-k:active { transform: translateY(5px); box-shadow: 0 1px 0 ${COL.line}; background: ${COL.surface2}; }
  .${C}-pause { min-height: 64px; width: 100%; }
  .${C}-pause.on { border-color: ${PAL.blue}; color: ${PAL.blueDark}; background: ${COL.focusSoft}; box-shadow: 0 6px 0 ${PAL.blue}; }
  .${C}-next { border: 3px solid ${COL.line}; border-radius: 24px; background: ${COL.surface2}; padding: 14px 16px 18px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .${C}-next .blk { width: 108px; height: 108px; }
  .${C}-next .blk svg { display: block; width: 100%; height: 100%; }
  .${C}-next .blk.pop { animation: ${C}-in .35s cubic-bezier(.2,1.5,.4,1); }
  @keyframes ${C}-in { from { transform: translateY(-18px) scale(.6); opacity: 0; } }
  .${C}-arrows { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .${C}-arrows .${C}-k { height: 104px; }
  .${C}-dropk { height: 112px; width: 100%; background: ${PAL.blue}; border-color: ${PAL.blueDark}; color: #fff; box-shadow: 0 6px 0 ${PAL.blueDark}; font-size: 32px; font-weight: 800; }
  .${C}-dropk.down, .${C}-dropk:active { background: #2f74e6; box-shadow: 0 1px 0 ${PAL.blueDark}; }
  .${C}-wellbox { position: relative; align-self: center; }
  .${C}-well { position: relative; border: 4px solid ${INK}; border-radius: 24px; overflow: hidden; background: ${COL.dark}; box-shadow: 0 7px 0 ${COL.lineStrong}; }
  .${C}-well canvas { display: block; touch-action: none; cursor: pointer; }
  .${C}-banner { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); z-index: 4; pointer-events: none; text-align: center; white-space: nowrap;
    padding: 22px 38px 26px; border-radius: 28px; background: #fff; color: ${INK}; border: 4px solid ${INK}; box-shadow: 0 8px 0 ${INK}, 0 24px 60px rgba(0,0,0,.45); animation: ${C}-bpop .45s cubic-bezier(.2,1.4,.4,1); }
  .${C}-banner .k { font-weight: 800; font-size: 42px; line-height: 1.1; }
  .${C}-banner .r { display: inline-block; font-weight: 800; font-size: 34px; color: #1d1600; background: ${YEL}; border-radius: 999px; padding: 10px 30px; margin-top: 14px; box-shadow: 0 5px 0 ${YEL_D}; }
  .${C}-banner p { margin: 10px 0 0; font-size: 24px; font-weight: 600; color: ${COL.ink2}; }
  .${C}-banner.out { opacity: 0; transition: opacity .35s; }
  @keyframes ${C}-bpop { from { transform: translate(-50%, -50%) scale(.6); opacity: 0; } }
  .${C}-paused { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; background: rgba(11,16,32,.78); border-radius: 24px; animation: ${C}-fade .2s ease; }
  .${C}-paused .in { text-align: center; color: #fff; }
  .${C}-paused .k { font-weight: 800; font-size: 44px; margin-bottom: 20px; }
  .${C}-paused .${C}-btn { min-height: 76px; padding: 0 40px; font-size: 28px; }
  .${C}-fly { position: absolute; left: 0; top: 0; width: 44px; height: 44px; margin: -22px 0 0 -22px; z-index: 7; pointer-events: none; will-change: transform; }
  .${C}-fly svg { display: block; }
  `);

  const say = t => { try { ctx.say && ctx.say(t); } catch (e) { /* ignore */ } };
  const sfx = n => { try { (ctx.sfx || coreSfx)(n); } catch (e) { /* ignore */ } };
  const load = k => { try { return ctx.load ? ctx.load(k) : null; } catch (e) { return null; } };
  const save = (k, v) => { try { ctx.save && ctx.save(k, v); } catch (e) { /* ignore */ } };
  const record = (k, ok) => { try { k && ctx.recordFact && ctx.recordFact(k, ok); } catch (e) { /* ignore */ } };
  const calm = reducedMotion();
  const params = new URLSearchParams(location.search);
  const seedParam = params.has('dropseed') ? +params.get('dropseed') : undefined;

  let level = clamp(Math.round(ctx.level || 1), 1, 3);
  let mode = params.get('dropmode') === 'sub' ? 'sub' : params.get('dropmode') === 'add' ? 'add' : load('mode') === 'sub' ? 'sub' : 'add';

  // ----- DOM -----
  const root = document.createElement('div');
  root.className = C;
  el.appendChild(root);
  const strip = makeStrip(root, C, meta.title, level, mode, {
    onExit: () => ctx.onExit && ctx.onExit(),
    onLevel: l => { level = l; strip.setLevel(l); startRound(); },
    onMode: m => { if (m !== mode) { mode = m; save('mode', m); } strip.setMode(m); startRound(); },
  });
  const board = document.createElement('div');
  board.className = `${C}-board`;
  board.innerHTML = `
    <div class="${C}-side ${C}-left">
      <div class="${C}-target"><div class="eb"></div><div class="num"></div><div class="eq"></div></div>
      <div class="${C}-hint"></div>
      <div class="${C}-grow"></div>
      <div class="${C}-prog"><div class="top"><span class="${C}-lab">Pairs</span><b></b></div><div class="bar"><i></i></div></div>
      <button type="button" class="${C}-k ${C}-pause" aria-label="Pause">${ICON.pause}<span>Pause</span></button>
    </div>
    <div class="${C}-wellbox"><div class="${C}-well"><canvas aria-label="The well. Tap a column to move the block there. Tap its column again to drop it."></canvas></div></div>
    <div class="${C}-side ${C}-right">
      <div class="${C}-next"><span class="${C}-lab">Next</span><div class="blk"></div></div>
      <div class="${C}-hint ${C}-tip">Tap a column to move there.<br>Tap it again to drop.</div>
      <div class="${C}-grow"></div>
      <div class="${C}-arrows"><button type="button" class="${C}-k mvl" aria-label="Move left">${ICON.left}</button><button type="button" class="${C}-k mvr" aria-label="Move right">${ICON.right}</button></div>
      <button type="button" class="${C}-k ${C}-dropk" aria-label="Drop">${ICON.down}<span>Drop</span></button>
    </div>`;
  root.appendChild(board);
  const $ = s => board.querySelector(s);
  const tCard = $(`.${C}-target`), tEb = tCard.querySelector('.eb'), tNum = tCard.querySelector('.num'), tEq = tCard.querySelector('.eq');
  const hintEl = $(`.${C}-hint`);
  const progB = $(`.${C}-prog b`), progI = $(`.${C}-prog .bar i`);
  const pauseKey = $(`.${C}-pause`);
  const wellbox = $(`.${C}-wellbox`), well = $(`.${C}-well`), cv = well.querySelector('canvas');
  const nextBox = $(`.${C}-next .blk`);
  const keyL = $('.mvl'), keyR = $('.mvr'), keyD = $(`.${C}-dropk`);
  const g = cv.getContext('2d');
  try { document.fonts && document.fonts.load(`800 40px ${FONT.display}`).then(() => { if (alive && !raf) draw(); }); } catch (e) { /* ignore */ }

  // ----- state -----
  let R = makeRand(seedParam);
  let LV, rule, grid, blocks, cur, next, lastPicked = null;
  let phase = 'idle', paused = false, gameT = 0, timers = [], roundId = 0;
  let bursts = 0, stars = 0, shown = 0, combos = 0, chain = 0, sinceChange = 0, drops = 0, spawns = 0, fairOK = 0, rescues = 0;
  let roundLen = ROUND, changeEvery = CHANGE_EVERY, refillOn = true;
  let burstEnd = 0, burstSet = [], moved = [], settleT = 0;
  let parts = [], labels = [], links = [], bubbles = [];
  let banner = null, sumEl = null, pausedEl = null, hoverCol = null;
  let nextId = 1;
  const flights = new Set();
  let raf = 0, last = 0, alive = true, manual = false;
  let W = 360, H = 540, cell = 60, dpr = 1, bg = null, sized = false;

  const later = (s, fn) => timers.push({ at: gameT + s, fn, round: roundId });
  const best = () => { const b = load('best'); return b && typeof b === 'object' ? b : {}; };
  const showBest = () => { const b = best()[mode + level]; strip.setNote(b ? `Best ${b}` : ''); };

  // ----- grid helpers (r = 0 is the bottom row) -----
  const cellAt = (c, r) => (c >= 0 && c < COLS && r >= 0 && r < ROWS ? grid[c][r] : null);
  const height = c => { for (let r = ROWS - 1; r >= 0; r--) if (grid[c][r]) return r + 1; return 0; };
  const NB = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function landingNeighbours(c) {
    const r = height(c);
    if (r >= ROWS) return null;
    return [cellAt(c - 1, r), cellAt(c + 1, r), cellAt(c, r - 1)].filter(Boolean);
  }
  function burstCols(v) {
    const out = [];
    for (let c = 0; c < COLS; c++) { const nb = landingNeighbours(c); if (nb && nb.some(b => rule.match(v, b.v))) out.push(c); }
    return out;
  }
  function exposed() {
    const s = new Set();
    for (let c = 0; c < COLS; c++) (landingNeighbours(c) || []).forEach(b => s.add(b));
    return [...s];
  }
  function place(c, r, v) {
    const b = { id: nextId++, v, c, r, y: r, vy: 0, landT: -9, burstT: null, slideT: null, hard: false };
    grid[c][r] = b; blocks.push(b);
    return b;
  }
  const setRule = T => { rule = makeRule(mode, T, LV.hi); };

  // Pick the next block so it can pop somewhere most of the time. It is chosen while the current block is
  // still falling, so look one step ahead: imagine the current block landing in each column (a kid usually
  // picks a column where it pops), and score each value by how often it could then pop on the board left behind.
  const snapshot = () => grid.map(col => { const o = []; for (const b of col) { if (!b) break; o.push(b.v); } return o; });
  function canPopOn(cols, v) {
    for (let c = 0; c < COLS; c++) {
      const r = cols[c].length;
      if (r >= ROWS) continue;
      const nb = [cols[c - 1] && cols[c - 1][r], cols[c + 1] && cols[c + 1][r], r > 0 ? cols[c][r - 1] : undefined];
      if (nb.some(n => n !== undefined && rule.match(v, n))) return true;
    }
    return false;
  }
  function landOn(cols, c, v) {
    const out = cols.map(col => col.slice());
    const r = out[c].length;
    if (r >= ROWS) return null;
    const hits = [[c - 1, r], [c + 1, r], [c, r - 1]].filter(([x, y]) => x >= 0 && x < COLS && y >= 0 && out[x][y] !== undefined && rule.match(v, out[x][y]));
    if (!hits.length) { out[c].push(v); return out; }
    hits.sort((a, b) => b[1] - a[1]).forEach(([x, y]) => out[x].splice(y, 1));
    return out;
  }
  function pickValue(curV) {
    const base = snapshot();
    let boards;
    if (curV == null) boards = [{ cols: base, w: 1 }];
    else {
      const popCols = new Set(burstCols(curV));
      const free = range(0, COLS - 1).filter(c => base[c].length < ROWS);
      const nPop = free.filter(c => popCols.has(c)).length, nOther = free.length - nPop;
      boards = free.map(c => ({ cols: landOn(base, c, curV), w: popCols.has(c) ? 0.65 / nPop : (nPop ? 0.35 : 1) / nOther }));
    }
    const score = new Map();
    for (const v of rule.values) {
      let sc = 0;
      for (const b of boards) if (b.cols && canPopOn(b.cols, v)) sc += b.w;
      if (v === lastPicked) sc *= 0.5;
      if (sc > 0.05) score.set(v, sc * sc);
    }
    let v;
    if (score.size && R.chance(USEFUL)) {
      let tot = 0; for (const k of score.values()) tot += k;
      let x = R.next() * tot;
      for (const [val, k] of score) { x -= k; if (x <= 0) { v = val; break; } }
      if (v === undefined) v = [...score.keys()].pop();
    } else v = R.pick(rule.values);
    lastPicked = v;
    return v;
  }

  function seedBoard() {
    const cols = R.sample(range(0, COLS - 1), LV.seed).sort((a, b) => a - b);
    for (const c of cols) {
      let v, tries = 0;
      do { v = R.pick(rule.values); tries++; }
      while (tries < 60 && [cellAt(c - 1, 0), cellAt(c + 1, 0)].some(b => b && (rule.match(v, b.v) || b.v === v)));
      place(c, 0, v);
    }
  }

  function chooseTarget() {
    const cands = LV.targets.filter(t => t !== rule.T);
    if (!cands.length) return rule.T;
    const ex = exposed();
    const pairs = [];
    for (const b of blocks) for (const [dc, dr] of [[1, 0], [0, 1]]) { const n = cellAt(b.c + dc, b.r + dr); if (n) pairs.push([b.v, n.v]); }
    let bestT = cands[0], bs = -Infinity;
    for (const t of cands) {
      const rr = makeRule(mode, t, LV.hi);
      let s = R.next() * 3;
      for (const b of ex) if (rr.partners(b.v).length) s += 1;
      for (const [a, b] of pairs) if (rr.match(a, b)) s -= 5;
      if (Math.abs(t - rule.T) > 4) s -= 1;
      if (s > bs) { bs = s; bestT = t; }
    }
    return bestT;
  }

  // ----- words -----
  const targetText = () => (mode === 'add' ? `Make ${rule.T}` : `Difference ${rule.T}`);
  const sayTarget = start => (mode === 'add'
    ? (start ? `Make ${rule.T}. Drop a block next to a number that makes ${rule.T}.` : `Make ${rule.T}.`)
    : (start ? `Find a difference of ${rule.T}. Drop a block next to a number that is ${rule.T} more or ${rule.T} less.` : `Find a difference of ${rule.T}.`));
  function targetCard(flash) {
    tEb.textContent = mode === 'add' ? 'Make' : 'Difference';
    tNum.textContent = String(rule.T);
    tEq.innerHTML = `<i></i><span>${mode === 'add' ? '+' : '−'}</span><i></i><span>=</span><span>${rule.T}</span>`;
    hintEl.innerHTML = mode === 'add'
      ? `Touching blocks that make <b>${rule.T}</b> go pop!`
      : `Touching blocks <b>${rule.T}</b> apart go pop!`;
    if (flash) { tCard.classList.remove('flash'); void tCard.offsetWidth; tCard.classList.add('flash'); }
  }
  function showNext(pop) {
    nextBox.innerHTML = next != null ? blockSVG(next, 108) : '';
    if (pop) { nextBox.classList.remove('pop'); void nextBox.offsetWidth; nextBox.classList.add('pop'); }
  }
  function progress() {
    const n = Math.min(bursts, roundLen);
    progB.textContent = `${n} / ${roundLen > 999 ? '∞' : roundLen}`;
    progI.style.width = `${Math.round((n / Math.min(roundLen, 999)) * 100)}%`;
  }
  function showBanner(html) {
    hideBanner(true);
    banner = document.createElement('div');
    banner.className = `${C}-banner`;
    banner.innerHTML = html;
    wellbox.appendChild(banner);
  }
  function hideBanner(now) {
    if (!banner) return;
    const b = banner; banner = null;
    if (now || calm) { b.remove(); return; }
    b.classList.add('out');
    b.addEventListener('transitionend', () => b.remove(), { once: true });
    later(0.5, () => b.remove());
  }

  // ----- round -----
  function startRound() {
    roundId++;
    timers = [];
    hideBanner(true);
    if (sumEl) { sumEl.remove(); sumEl = null; }
    setPaused(false, true);
    flights.forEach(a => { try { a.cancel(); } catch (e) { /* ignore */ } }); flights.clear();
    root.querySelectorAll(`.${C}-fly`).forEach(n => n.remove());
    R = makeRand(seedParam);
    LV = LEVELS[mode][level];
    rule = null;
    setRule(R.pick(LV.targets));
    grid = Array.from({ length: COLS }, () => Array(ROWS).fill(null));
    blocks = []; cur = null; lastPicked = null;
    bursts = stars = shown = combos = chain = sinceChange = drops = spawns = fairOK = rescues = 0;
    parts = []; labels = []; links = []; bubbles = []; burstSet = []; moved = [];
    seedBoard();
    next = pickValue(null);
    targetCard(true);
    progress();
    strip.setTally('★ 0');
    showBest();
    say(sayTarget(true));
    spawn();
    run();
  }

  function spawnCol() {
    let c = height(2) <= height(3) ? 2 : 3;
    if (height(c) >= ROWS - 2) { let b = 0; for (let k = 1; k < COLS; k++) if (height(k) < height(b)) b = k; c = b; }
    return c;
  }
  function spawn() {
    const v = next;
    const c = spawnCol();
    cur = { v, c, x: c, y: ROWS - 1, hover: HOVER, lock: 0, fast: false, born: gameT, nudge: 0, nudgeT: -9 };
    next = pickValue(v);
    spawns++;
    if (burstCols(v).length) fairOK++;
    phase = 'fall';
    showNext(true);
  }

  // ----- steering -----
  const live = () => phase === 'fall' && !paused && !!cur;
  const canEnter = c => c >= 0 && c < COLS && height(c) <= cur.y + 1e-6;
  function move(dir, quiet) {
    if (!live() || cur.fast) return false;
    const t = cur.c + dir;
    if (canEnter(t)) { cur.c = t; cur.lock = 0; if (!quiet) sfx('tick'); return true; }
    cur.nudge = dir; cur.nudgeT = gameT;
    return false;
  }
  function steerTo(col) {
    if (!live() || cur.fast) return false;
    col = clamp(col, 0, COLS - 1);
    let any = false;
    while (cur.c !== col) { if (!move(Math.sign(col - cur.c), true)) break; any = true; }
    if (any) sfx('tick');
    return any;
  }
  function hardDrop() {
    if (!live() || cur.fast) return false;
    cur.fast = true; cur.hover = 0;
    return true;
  }

  // ----- landing, pops and chains -----
  function land() {
    const c = cur.c, r = height(c);
    const b = place(c, r, cur.v);
    b.landT = gameT; b.hard = cur.fast;
    sfx(cur.fast ? 'clunk' : 'click');
    dust(c, r, cur.fast);
    cur = null; drops++;
    chain = 0;
    const pairs = findPairs([b]);
    if (pairs.length) startBurst(pairs); else finishResolve();
  }

  function findPairs(list) {
    const seen = new Set(), out = [];
    for (const a of list) {
      if (!a || a.burstT !== null || grid[a.c][a.r] !== a) continue;
      for (const [dc, dr] of NB) {
        const b = cellAt(a.c + dc, a.r + dr);
        if (!b || b.burstT !== null) continue;
        const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
        if (seen.has(key) || !rule.match(a.v, b.v)) continue;
        seen.add(key);
        out.push([a, b]);
      }
    }
    return out;
  }

  function startBurst(pairs) {
    chain++;
    phase = 'burst';
    burstEnd = gameT + BURST;
    const set = new Set();
    let sc = 0, sr = 0;
    pairs.forEach(([a, b], i) => {
      set.add(a); set.add(b);
      bursts++; stars++; sinceChange++;
      record(rule.fact(a.v, b.v), true);
      const mc = (a.c + b.c) / 2, mr = (a.r + b.r) / 2;
      sc += mc; sr += mr;
      addLabel(rule.eq(a.v, b.v), mc, mr, i * 0.12);
      links.push({ a: [a.c, a.r], b: [b.c, b.r], t0: gameT, life: 0.5 });
      flyStar(mc, mr, 0.1 + i * 0.14);
    });
    for (const b of set) { b.burstT = gameT; sparkle(b); }
    burstSet = [...set];
    sfx('pop');
    if (chain >= 2) {
      combos++; stars++;
      const c = sc / pairs.length, r = sr / pairs.length;
      bubbles.push({ text: chain === 2 ? 'Combo!' : chain === 3 ? 'Super combo!' : 'Mega combo!', c, r: r + 1.3, t0: gameT, life: 1.5 });
      later(0.12, () => sfx('chime'));
      flyStar(c, r + 1.3, 0.45);
    }
    progress();
  }

  // Sum labels rise from the pop. An older label nearby fades out quickly; labels from one pop stack up.
  const labelRow = l => l.r + 0.75 + Math.max(0, gameT - l.t0) * 0.45;
  function addLabel(text, c, r, delay) {
    for (const l of labels) {
      if (l.t0 < gameT && Math.abs(l.c - c) < 3 && Math.abs(labelRow(l) - (r + 0.75)) < 1.6) l.life = Math.min(l.life, gameT - l.t0 + 0.25);
    }
    const mine = labels.filter(l => l.t0 >= gameT);
    let rr = r;
    for (let k = 0; k < 4 && mine.some(l => Math.abs(l.c - c) < 2.6 && Math.abs(l.r - rr) < 0.9); k++) rr += 0.95;
    labels.push({ text, c, r: rr, t0: gameT + delay, life: 1.6 });
  }

  function afterBurst() {
    for (const b of burstSet) if (grid[b.c][b.r] === b) grid[b.c][b.r] = null;
    const gone = new Set(burstSet);
    blocks = blocks.filter(b => !gone.has(b));
    burstSet = [];
    moved = [];
    for (let c = 0; c < COLS; c++) {
      let w = 0;
      for (let r = 0; r < ROWS; r++) {
        const b = grid[c][r];
        if (!b) continue;
        if (r !== w) { grid[c][w] = b; grid[c][r] = null; b.r = w; moved.push(b); }
        w++;
      }
    }
    if (moved.length) { phase = 'gravity'; settleT = 0; } else afterSettle();
  }

  function stepGravity(dt) {
    let moving = false, thud = false;
    for (const b of blocks) {
      if (b.y > b.r) {
        b.vy = Math.min(16, b.vy + GRAV * dt);
        b.y -= b.vy * dt;
        if (b.y <= b.r) { b.y = b.r; b.vy = 0; b.landT = gameT; b.hard = false; thud = true; } else moving = true;
      }
    }
    if (thud) sfx('tick');
    if (!moving) { settleT += dt; if (settleT >= 0.1) afterSettle(); }
  }

  function afterSettle() {
    const pairs = findPairs(moved);
    moved = [];
    if (pairs.length) startBurst(pairs); else finishResolve();
  }

  function finishResolve() {
    phase = 'idle';
    if (bursts >= roundLen) { phase = 'ending'; later(0.9, finish); return; }
    let full = false;
    for (let c = 0; c < COLS; c++) if (height(c) >= ROWS) full = true;
    if (full) { fullUp(); return; }
    if (LV.change && sinceChange >= changeEvery) { newTarget(); return; }
    if (refillOn && blocks.length < LV.seed - 1) { refill(); return; }
    spawn();
  }

  // Keep a few blocks in the well so there is always something to pair with: when it gets nearly empty,
  // one or two helper blocks fall in from the top. One is a partner for the Next block; none pops on landing.
  function refill() {
    const n = clamp(LV.seed - 1 - blocks.length, 1, 3);
    const nextCan = burstCols(next).length > 0;
    const used = new Set();
    moved = [];
    for (let i = 0; i < n; i++) {
      const cols = range(0, COLS - 1).filter(c => !used.has(c) && c !== spawnCol() && height(c) < ROWS - 3);
      if (!cols.length) break;
      const low = Math.min(...cols.map(height));
      const c = R.pick(cols.filter(k => height(k) <= low + 1));
      const r = height(c);
      const nb = [cellAt(c - 1, r), cellAt(c + 1, r), cellAt(c, r - 1)].filter(Boolean);
      const okV = v => !nb.some(b => rule.match(v, b.v) || b.v === v);
      let pool = i === 0 && !nextCan ? rule.partners(next).filter(okV) : [];
      if (!pool.length) pool = rule.values.filter(v => okV(v) && !rule.match(v, next));
      if (!pool.length) pool = rule.values.filter(okV);
      if (!pool.length) continue;
      const b = place(c, r, R.pick(pool));
      b.y = ROWS + 0.4 + i * 0.9;
      used.add(c);
      moved.push(b);
    }
    if (!moved.length) { spawn(); return; }
    phase = 'gravity';
    settleT = 0;
  }

  // No game over: slide the top three rows away and carry on.
  function fullUp() {
    phase = 'full';
    showBanner(`<div class="k">Full up!</div><p>Let's clear some space.</p>`);
    say("Full up! Let's clear some space.");
    later(1.3, () => {
      sfx('whoosh');
      for (const b of blocks) if (b.r >= ROWS - 3) b.slideT = gameT;
    });
    later(1.3 + SLIDE, () => {
      for (const b of blocks) if (b.slideT !== null && grid[b.c][b.r] === b) grid[b.c][b.r] = null;
      blocks = blocks.filter(b => b.slideT === null);
      hideBanner();
      rescues++;
      spawn();
    });
  }

  function newTarget() {
    phase = 'banner';
    setRule(chooseTarget());
    sinceChange = 0;
    next = pickValue(null);
    showNext(true);
    targetCard(true);
    sfx('whoosh');
    showBanner(`<div class="k">New target!</div><div class="r">${esc(targetText())}</div>`);
    say(`New target! ${sayTarget(false)}`);
    later(2.3, () => {
      hideBanner();
      chain = 0;
      const pairs = findPairs(blocks);
      if (pairs.length) startBurst(pairs); else spawn();
    });
  }

  function finish() {
    phase = 'done';
    stopLoop();
    draw();
    shown = stars;
    strip.setTally(`★ ${stars}`);
    const b = best(), key = mode + level, prev = b[key] || 0, isBest = stars > prev;
    if (isBest) { b[key] = stars; save('best', b); }
    save('plays', (load('plays') || 0) + 1);
    showBest();
    sfx('chime');
    sumEl = document.createElement('div');
    sumEl.className = `${C}-sum`;
    sumEl.innerHTML = `<div class="${C}-card">
      <div class="eb">Round complete</div>
      <div class="big">${withStars(`★ ${stars}`, 64)}</div>
      <p>${bursts} pairs popped${combos ? ` · ${combos} ${combos === 1 ? 'combo' : 'combos'}` : ''}</p>
      <p class="best">${isBest ? 'Best round yet!' : `Best round: ${prev} stars`}</p>
      <div class="row"><button type="button" class="${C}-btn go">Play again</button>${level < 3 ? `<button type="button" class="${C}-btn ghost up">Try level ${level + 1}</button>` : ''}</div>
    </div>`;
    root.appendChild(sumEl);
    const u = [];
    u.push(onTap(sumEl.querySelector('.go'), () => { u.forEach(f => f()); startRound(); }));
    const up = sumEl.querySelector('.up');
    if (up) u.push(onTap(up, () => { u.forEach(f => f()); level += 1; strip.setLevel(level); startRound(); }));
  }

  // ----- pause -----
  function setPaused(on, silent) {
    on = !!on;
    if (on && phase === 'done') return;
    if (on === paused) return;
    paused = on;
    pauseKey.classList.toggle('on', on);
    pauseKey.innerHTML = on ? `${ICON.play}<span>Play</span>` : `${ICON.pause}<span>Pause</span>`;
    pauseKey.setAttribute('aria-label', on ? 'Play' : 'Pause');
    if (on) {
      stopLoop();
      pausedEl = document.createElement('div');
      pausedEl.className = `${C}-paused`;
      pausedEl.innerHTML = `<div class="in"><div class="k">Paused</div><button type="button" class="${C}-btn">${ICON.play}Play</button></div>`;
      wellbox.appendChild(pausedEl);
      pausedEl._u = onTap(pausedEl.querySelector('button'), () => setPaused(false));
      draw();
    } else {
      if (pausedEl) { pausedEl._u && pausedEl._u(); pausedEl.remove(); pausedEl = null; }
      if (!silent) sfx('click');
      run();
    }
  }

  // ----- effects -----
  function cellClient(c, r) {
    const b = cv.getBoundingClientRect();
    if (!b.width) return null;
    return { x: b.left + (c + 0.5) * (b.width / COLS), y: b.top + b.height - (r + 0.5) * (b.height / ROWS) };
  }
  function flyStar(c, r, delay) {
    const id = roundId;
    later(delay, () => {
      if (!calm) {
        const from = cellClient(c, r), to = strip.starRect(), rr = root.getBoundingClientRect();
        if (from && to && root.animate) {
          const s = document.createElement('div');
          s.className = `${C}-fly`;
          s.innerHTML = starSvg(44);
          root.appendChild(s);
          const x0 = from.x - rr.left, y0 = from.y - rr.top, x1 = to.x - rr.left, y1 = to.y - rr.top;
          const anim = s.animate([
            { transform: `translate(${x0}px, ${y0}px) scale(.3)`, opacity: 0 },
            { transform: `translate(${x0 + (x1 - x0) * 0.25}px, ${Math.min(y0, y1 + 200) - 70}px) scale(1.3)`, opacity: 1, offset: 0.3 },
            { transform: `translate(${x1}px, ${y1}px) scale(.68)`, opacity: 1 },
          ], { duration: FLY * 1000, easing: 'cubic-bezier(.45,0,.35,1)' });
          flights.add(anim);
          const done = () => { flights.delete(anim); s.remove(); };
          anim.onfinish = done; anim.oncancel = done;
        }
      }
      later(FLY, () => { if (id !== roundId) return; shown = Math.min(stars, shown + 1); strip.setTally(`★ ${shown}`, true); });
    });
  }
  function sparkle(b) {
    const [f] = colourOf(b.v);
    const x = (b.c + 0.5) * cell, y = H - (b.r + 0.5) * cell;
    const n = calm ? 8 : 18, cols = [f, YEL, '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = cell * (1.2 + Math.random() * 3.4);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - cell, t: 0, life: 0.55 + Math.random() * 0.45, col: cols[i % 3], s: cell * (0.035 + Math.random() * 0.05), star: i % 3 !== 2 });
    }
    parts.push({ ring: true, x, y, t: 0, life: 0.45, r0: cell * 0.3, r1: cell * 1.05 });
  }
  function dust(c, r, hard) {
    if (calm) return;
    const y = H - r * cell - 2;
    for (let i = 0; i < (hard ? 8 : 4); i++) {
      const side = i % 2 ? 1 : -1;
      parts.push({ x: (c + 0.5 + side * 0.42) * cell, y, vx: side * cell * (0.6 + Math.random() * 1.2), vy: -cell * (0.3 + Math.random() * 0.7), t: 0, life: 0.35 + Math.random() * 0.2, col: 'rgba(220,230,255,.75)', s: cell * (0.03 + Math.random() * 0.03), puff: true });
    }
  }

  // ----- simulation -----
  function step(dt) {
    gameT += dt;
    if (timers.length) {
      const due = timers.filter(t => gameT >= t.at);
      if (due.length) {
        timers = timers.filter(t => gameT < t.at);
        for (const t of due) if (t.round === roundId) t.fn();
      }
    }
    for (const p of parts) {
      p.t += dt;
      if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.12, dt); p.vy = p.vy * Math.pow(0.12, dt) + cell * 7 * dt; }
    }
    parts = parts.filter(p => p.t < p.life);
    labels = labels.filter(l => gameT - l.t0 < l.life);
    links = links.filter(l => gameT - l.t0 < l.life);
    bubbles = bubbles.filter(b => gameT - b.t0 < b.life);
    if (phase === 'fall' && cur) stepFall(dt);
    else if (phase === 'burst') { if (gameT >= burstEnd) afterBurst(); }
    else if (phase === 'gravity') stepGravity(dt);
  }
  function stepFall(dt) {
    const f = cur;
    f.x += (f.c - f.x) * Math.min(1, dt * 18);
    if (Math.abs(f.c - f.x) < 0.002) f.x = f.c;
    if (f.hover > 0 && !f.fast) { f.hover -= dt; return; }
    const floor = height(f.c);
    const sp = f.fast ? HARD : PACE[level];
    if (f.y > floor) { f.y = Math.max(floor, f.y - sp * dt); if (f.y > floor) f.lock = 0; }
    if (f.y <= floor + 1e-6) {
      f.y = floor;
      if (f.fast) land();
      else { f.lock += dt; if (f.lock >= LOCK) land(); }
    }
  }

  // ----- drawing -----
  const SR = makeRand(11);
  const SKY = Array.from({ length: 54 }, () => ({ x: SR.next(), y: SR.next(), z: SR.next(), tw: SR.next() * 6 }));
  const rrect = (x, y, w, h, r) => {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };
  const rowY = r => H - (r + 1) * cell;

  function drawBlock(x, y, s, v, o = {}) {
    const [fill, dark] = colourOf(v);
    const pad = Math.max(2, s * 0.045), w = s - 2 * pad, rr = s * 0.17, lip = s * 0.075;
    g.save();
    g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    const ax = s / 2, ay = o.mid ? s / 2 : s - pad;
    g.translate(x + ax, y + ay);
    g.scale(o.sx || 1, o.sy || 1);
    g.translate(-ax, -ay);
    rrect(pad, pad, w, w, rr); g.fillStyle = dark; g.fill();
    rrect(pad, pad, w, w - lip, rr); g.fillStyle = fill; g.fill();
    rrect(pad + w * 0.14, pad + w * 0.09, w * 0.3, w * 0.085, w * 0.042); g.fillStyle = 'rgba(255,255,255,.4)'; g.fill();
    if (o.flash) { rrect(pad, pad, w, w, rr); g.fillStyle = `rgba(255,255,255,${o.flash})`; g.fill(); }
    rrect(pad, pad, w, w, rr); g.lineWidth = Math.max(2.5, s * 0.05); g.strokeStyle = INK; g.stroke();
    const t = String(v), fs = Math.round(s * (t.length > 1 ? 0.47 : 0.57));
    g.font = `800 ${fs}px ${FONT.display}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = Math.max(4, s * 0.1); g.strokeStyle = INK;
    const cy = pad + (w - lip) / 2 + fs * 0.05;
    g.strokeText(t, s / 2, cy);
    g.fillStyle = '#ffffff'; g.fillText(t, s / 2, cy);
    g.restore();
  }

  function drawGhost(c, r, v) {
    const s = cell, x = c * s, y = rowY(r), pad = s * 0.07;
    g.save();
    g.setLineDash([s * 0.13, s * 0.09]);
    g.lineWidth = Math.max(2.5, s * 0.04);
    g.strokeStyle = 'rgba(255,255,255,.6)';
    rrect(x + pad, y + pad, s - 2 * pad, s - 2 * pad, s * 0.16); g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 0.3;
    const t = String(v), fs = Math.round(s * (t.length > 1 ? 0.42 : 0.5));
    g.font = `800 ${fs}px ${FONT.display}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.fillText(t, x + s / 2, y + s / 2 + fs * 0.05);
    g.restore();
  }

  function pill(x, y, text, o = {}) {
    const fs = Math.max(20, Math.round(cell * (o.big ? 0.44 : 0.34)));
    g.save();
    g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    g.font = `800 ${fs}px ${FONT.display}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(text).width + fs * 1.3, h = fs * 1.75, edge = Math.max(3, fs * 0.16);
    x = clamp(x, w / 2 + 6, W - w / 2 - 6);
    y = clamp(y, h / 2 + 6, H - h / 2 - 10);
    g.translate(x, y);
    if (o.scale) g.scale(o.scale, o.scale);
    rrect(-w / 2, -h / 2 + edge, w, h, h / 2); g.fillStyle = o.white ? INK : YEL_D; g.fill();
    rrect(-w / 2, -h / 2, w, h, h / 2); g.fillStyle = o.white ? '#ffffff' : YEL; g.fill();
    g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    g.fillStyle = o.white ? INK : '#1d1600';
    g.fillText(text, 0, fs * 0.06);
    g.restore();
  }

  function draw() {
    if (!grid) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = bg || COL.dark; g.fillRect(0, 0, W, H);
    for (const s of SKY) {
      g.globalAlpha = (0.18 + s.z * 0.5) * (0.65 + 0.35 * Math.sin(gameT * 1.3 + s.tw));
      g.fillStyle = s.z > 0.85 ? '#ffe9b8' : '#cfe3ff';
      g.beginPath(); g.arc(s.x * W, s.y * H, 0.6 + s.z * 1.3, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
    // Faint lanes help aim.
    g.fillStyle = 'rgba(255,255,255,.035)';
    for (let c = 1; c < COLS; c += 2) g.fillRect(c * cell, 0, cell, H);
    if (hoverCol !== null && live()) { g.fillStyle = 'rgba(79,157,255,.12)'; g.fillRect(hoverCol * cell, 0, cell, H); }
    // Aim lane and ghost under the falling block.
    if (cur && phase === 'fall') {
      const gy = height(cur.c);
      const x = cur.c * cell, top = rowY(cur.y) + cell, bot = rowY(gy);
      if (bot > top + 1) {
        const lg = g.createLinearGradient(0, top, 0, bot);
        lg.addColorStop(0, 'rgba(255,255,255,.13)'); lg.addColorStop(1, 'rgba(255,255,255,.03)');
        g.fillStyle = lg; g.fillRect(x + cell * 0.1, top, cell * 0.8, bot - top);
      }
      if (cur.y - gy > 0.6) drawGhost(cur.c, gy, cur.v);
    }
    // Stacked blocks.
    for (const b of blocks) {
      let x = b.c * cell, y = rowY(b.y);
      const o = {};
      if (b.burstT !== null) {
        const k = clamp((gameT - b.burstT) / BURST, 0, 1);
        o.mid = true;
        if (k < 0.3) { o.sx = o.sy = 1 + 0.22 * (k / 0.3); o.flash = 0.75 * (k / 0.3); }
        else { const q = (k - 0.3) / 0.7; o.sx = o.sy = 1.22 * (1 - q * q); o.flash = 0.75 * (1 - q); o.alpha = 1 - q * 0.6; }
        if (k >= 1) continue;
      } else if (b.slideT !== null) {
        const k = clamp((gameT - b.slideT) / SLIDE, 0, 1);
        y -= k * k * cell * 3.2;
        x += Math.sin(k * 3 + b.c) * cell * 0.08 * k;
        o.alpha = 1 - k;
      } else {
        const k = (gameT - b.landT) / 0.22;
        if (k >= 0 && k < 1) { const s = Math.sin(k * Math.PI) * (b.hard ? 0.16 : 0.09); o.sx = 1 + s * 0.6; o.sy = 1 - s; }
      }
      drawBlock(x, y, cell, b.v, o);
    }
    // The falling block.
    if (cur) {
      const k = clamp((gameT - cur.born) / 0.3, 0, 1);
      let x = cur.x * cell;
      const nk = (gameT - cur.nudgeT) / 0.25;
      if (nk >= 0 && nk < 1) x += Math.sin(nk * Math.PI * 3) * (1 - nk) * cell * 0.1;
      const s = 0.7 + 0.3 * (1 - Math.pow(1 - k, 3));
      drawBlock(x, rowY(cur.y), cell, cur.v, { alpha: k, sx: s, sy: s, mid: true });
    }
    // Pair links.
    for (const l of links) {
      const k = (gameT - l.t0) / l.life;
      const ax = (l.a[0] + 0.5) * cell, ay = H - (l.a[1] + 0.5) * cell, bx = (l.b[0] + 0.5) * cell, by = H - (l.b[1] + 0.5) * cell;
      g.save();
      g.lineCap = 'round';
      g.globalAlpha = 1 - k;
      g.strokeStyle = YEL; g.lineWidth = cell * 0.22;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = cell * 0.08;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      g.restore();
    }
    // Sparkles.
    for (const p of parts) {
      const k = p.t / p.life;
      g.save();
      if (p.ring) {
        g.globalAlpha = 1 - k; g.strokeStyle = YEL; g.lineWidth = cell * 0.08 * (1 - k) + 1;
        g.beginPath(); g.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * k, 0, 6.283); g.stroke();
        g.restore(); continue;
      }
      g.globalAlpha = (1 - k) * (p.puff ? 0.7 : 1);
      g.fillStyle = p.col;
      if (p.star) {
        const s = p.s * 2.3;
        g.beginPath();
        g.moveTo(p.x, p.y - s); g.lineTo(p.x + s * 0.3, p.y - s * 0.3); g.lineTo(p.x + s, p.y); g.lineTo(p.x + s * 0.3, p.y + s * 0.3);
        g.lineTo(p.x, p.y + s); g.lineTo(p.x - s * 0.3, p.y + s * 0.3); g.lineTo(p.x - s, p.y); g.lineTo(p.x - s * 0.3, p.y - s * 0.3);
        g.closePath(); g.fill();
      } else { g.beginPath(); g.arc(p.x, p.y, p.s * (p.puff ? 1 + k * 1.5 : 1), 0, 6.283); g.fill(); }
      g.restore();
    }
    // Sums that popped, and combo bubbles.
    for (const l of labels) {
      const t = gameT - l.t0;
      if (t < 0) continue;
      const a = Math.min(1, t / 0.12, (l.life - t) / 0.4);
      pill((l.c + 0.5) * cell, H - (labelRow(l) + 0.5) * cell, l.text, { alpha: a });
    }
    for (const b of bubbles) {
      const t = gameT - b.t0, k = t / b.life;
      const sc = t < 0.25 ? 0.5 + 0.7 * (t / 0.25) : t < 0.4 ? 1.2 - 0.2 * ((t - 0.25) / 0.15) : 1;
      pill((b.c + 0.5) * cell, H - (b.r + 0.5) * cell - cell * 0.3 - k * cell * 0.4, b.text, { alpha: Math.min(1, (b.life - t) / 0.35), scale: sc, big: true, white: true });
    }
  }

  // ----- layout -----
  function layout() {
    const cs = getComputedStyle(board);
    const ah = board.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 8 - 7;
    const aw = board.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2 * 34 - 2 * 230 - 8;
    const nc = Math.max(36, Math.floor(Math.min(ah / ROWS, aw / COLS)));
    const ndpr = Math.min(2, window.devicePixelRatio || 1);
    if (sized && nc === cell && ndpr === dpr) return;
    sized = true;
    // Keep particles in step with the new size.
    const k = nc / cell;
    parts.forEach(p => { p.x *= k; p.y = (nc * ROWS) - (H - p.y) * k; if (p.ring) { p.r0 *= k; p.r1 *= k; } });
    cell = nc; dpr = ndpr;
    W = cell * COLS; H = cell * ROWS;
    well.style.width = `${W + 8}px`; well.style.height = `${H + 8}px`;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b1020'); bg.addColorStop(0.65, '#111a3a'); bg.addColorStop(1, '#1a2850');
    draw();
  }
  const ro = new ResizeObserver(() => layout());
  ro.observe(board);

  // ----- loop -----
  const shouldRun = () => alive && !paused && !manual && !document.hidden && phase !== 'done';
  function frame(t) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    step(dt);
    draw();
    if (shouldRun()) raf = requestAnimationFrame(frame);
  }
  function run() { if (!raf && shouldRun()) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  const onVis = () => { if (document.hidden) { stopLoop(); if (phase !== 'done') setPaused(true); } else run(); };
  document.addEventListener('visibilitychange', onVis);

  // ----- input -----
  let ptr = null;
  const colAt = e => { const r = cv.getBoundingClientRect(); return clamp(Math.floor(((e.clientX - r.left) / r.width) * COLS), 0, COLS - 1); };
  const onDown = e => {
    if (e.button > 0) return;
    e.preventDefault();
    if (!live()) { ptr = null; return; }
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: false, dropped: false };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    hoverCol = colAt(e);
    if (!raf) draw();
  };
  const onMove = e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    const cw = cv.getBoundingClientRect().width / COLS;
    if (!ptr.drag && Math.abs(dx) > cw * 0.35) ptr.drag = true;
    if (ptr.drag && live() && !cur.fast) steerTo(colAt(e));
    if (!ptr.dropped && dy > cw * 1.4 && dy > Math.abs(dx) * 1.5) { ptr.dropped = true; hardDrop(); }
    hoverCol = colAt(e);
  };
  const onUp = e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = ptr;
    ptr = null; hoverCol = null;
    try { cv.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (e.type === 'pointercancel' || p.drag || p.dropped || !live()) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 16) return;
    // Tap a column to move there; tap the block's own column to drop it.
    const col = colAt(e);
    if (col === cur.c) hardDrop(); else steerTo(col);
  };
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);

  // Game keys act on pointerdown so they feel instant.
  function press(btn, fn) {
    const down = e => { if (e.button > 0) return; e.preventDefault(); btn.classList.add('down'); fn(); };
    const up = () => btn.classList.remove('down');
    const key = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); fn(); } };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('keydown', key);
    return () => { btn.removeEventListener('pointerdown', down); btn.removeEventListener('pointerup', up); btn.removeEventListener('pointercancel', up); btn.removeEventListener('pointerleave', up); btn.removeEventListener('keydown', key); };
  }
  const unb = [
    press(keyL, () => move(-1)),
    press(keyR, () => move(1)),
    press(keyD, () => hardDrop()),
    onTap(pauseKey, () => setPaused(!paused)),
  ];
  const onKey = e => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowDown' || (e.key === ' ' && tag !== 'BUTTON')) { e.preventDefault(); hardDrop(); }
    else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { if (phase !== 'done') setPaused(!paused); }
  };
  window.addEventListener('keydown', onKey);

  layout();
  startRound();

  // ----- tests only -----
  const debug = !!(ctx.debug || /[?&](debug|arcdebug)\b/.test(location.search));
  if (debug) {
    window.__drop = {
      id: meta.id,
      state: () => ({
        phase, mode, level, target: rule.T, paused, bursts, stars, shown, combos, chain, drops, spawns, fairOK, rescues, sinceChange,
        lo: rule.lo, hi: rule.hi,
        cur: cur && { v: cur.v, c: cur.c, y: +cur.y.toFixed(2), fast: cur.fast },
        next, heights: range(0, COLS - 1).map(height),
        grid: grid.map(col => col.map(b => (b ? b.v : 0))),
        banner: banner ? banner.textContent.replace(/\s+/g, ' ').trim() : '',
        summary: sumEl ? sumEl.textContent.replace(/\s+/g, ' ').trim() : '',
      }),
      // cols: one array per column, bottom first, e.g. [[3, 4, 7], [5], [], [], [], []].
      setBoard(cols) {
        grid = Array.from({ length: COLS }, () => Array(ROWS).fill(null));
        blocks = [];
        cols.forEach((col, c) => (col || []).forEach((v, r) => { if (v) place(c, r, v); }));
        draw();
      },
      setCur(v, c) { if (!cur) return false; cur.v = v; if (c !== undefined) { cur.c = c; cur.x = c; } draw(); return true; },
      setNext(v) { next = v; showNext(); },
      setTarget(T) { setRule(T); targetCard(); },
      peek: () => ({ phase, fast: !!(cur && cur.fast), cur: !!cur, drops, spawns, target: rule.T }),
      burstCols: v => burstCols(v === undefined ? cur && cur.v : v),
      move, steerTo, drop: hardDrop, pause: setPaused,
      warp(sec) { for (let t = 0; t < sec - 1e-9; t += 1 / 60) step(1 / 60); draw(); return gameT; },
      until(pred, max = 30) { let t = 0; while (!pred() && t < max) { step(1 / 60); t += 1 / 60; } draw(); return t; },
      manual(on = true) { manual = !!on; if (manual) stopLoop(); else run(); },
      opts(o = {}) { if (o.roundLen) { roundLen = o.roundLen; progress(); } if (o.changeEvery) changeEvery = o.changeEvery; if (o.refill !== undefined) refillOn = !!o.refill; },
      colClient: (c, r = ROWS - 1) => cellClient(c, r),
      els: { canvas: cv, left: keyL, right: keyR, drop: keyD, pause: pauseKey, strip: strip.el, board },
      loop: () => ({ raf, timers: timers.length, alive, flights: flights.size, manual }),
    };
  }

  return {
    destroy() {
      alive = false;
      stopLoop();
      timers = [];
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', onKey);
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
      unb.forEach(u => u());
      if (pausedEl && pausedEl._u) pausedEl._u();
      flights.forEach(a => { try { a.cancel(); } catch (e) { /* ignore */ } }); flights.clear();
      ro.disconnect();
      strip.destroy();
      if (debug && window.__drop && window.__drop.id === meta.id) delete window.__drop;
      el.replaceChildren();
    },
  };
}
