// Skinny and fat squares (Mission 2): the pulse width of a square wave.
// Old chips could make the square thinner (12.5%, 25% or 50% "on"). Thinner sounds thinner and more nasal.
// props: none.
// Done: once all three widths have been heard (tapped, or through "Listen to all three").
import { note, now, pulseTable, stopAll } from '../core/chip.js';
import { botSVG, sing, lcdWave } from '../core/bots.js';
import { h, injectCSS } from '../core/dom.js';
import { icon } from '../core/icons.js';

const LINE = 'Tap the skinny square, the middle one and the fat one. Do they sound different?';
const WIDTHS = [
  { id: 'skinny', name: 'Skinny', duty: 0.125, pct: '12.5%', squash: 0.58 },
  { id: 'middle', name: 'Middle', duty: 0.25, pct: '25%', squash: 1 },
  { id: 'fat', name: 'Fat', duty: 0.5, pct: '50%', squash: 1.42 },
];
const TUNE = [72, 76, 79, 76];

const CSS = `
.t-pulse { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 18px; padding: 18px 26px 22px; }
.t-pulse .pl-cards { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.t-pulse .pl-card {
  position: relative; min-height: 0; min-width: 0; display: flex; flex-direction: column; align-items: stretch; gap: 12px; padding: 16px 16px 14px;
  background: var(--card); border: 3px solid var(--edge); border-radius: 24px; box-shadow: var(--pop); cursor: pointer; color: var(--ink);
  font-family: var(--font); touch-action: manipulation; transition: transform .07s, box-shadow .07s, background .2s;
}
.t-pulse .pl-card:active, .t-pulse .pl-card.press { transform: translateY(4px); box-shadow: 1px 1px 0 var(--edge); }
.t-pulse .pl-card.playing { background: var(--bleep-soft); }
.t-pulse .pl-card.playing .pl-lcd { box-shadow: 0 0 0 4px var(--bleep); }
.t-pulse .pl-lcd { position: relative; flex: none; display: flex; flex-direction: column; gap: 6px; border-radius: 14px; background: var(--bezel); padding: 8px 8px 7px; transition: box-shadow .15s; }
.t-pulse .pl-lcd .lcdwave { width: 100%; height: auto; border-radius: 8px; }
.t-pulse .pl-pct { text-align: center; font-family: var(--pixel); font-size: 11px; color: #d9d7e4; letter-spacing: .5px; }
.t-pulse .pl-led { position: absolute; left: 50%; top: -11px; width: 20px; height: 20px; margin-left: -10px; border-radius: 6px; border: 3px solid var(--edge); background: #4a475a; transition: background .2s, box-shadow .2s; z-index: 2; }
.t-pulse .pl-card.heard .pl-led { background: var(--lcd); box-shadow: 0 0 10px var(--lcd); }
.t-pulse .pl-botbox { flex: 1; min-height: 80px; position: relative; container-type: size; }
.t-pulse .pl-botbox .bot { position: absolute; left: 50%; bottom: 50%; height: 100%; height: min(100%, 74cqw); max-height: 300px; aspect-ratio: 120 / 140; transform: translate(-50%, 50%) scaleX(var(--sq, 1)); transform-origin: 50% 50%; pointer-events: none; }
.t-pulse .pl-botbox .bot .botsvg { width: 100%; height: 100%; }
.t-pulse .pl-name { flex: none; text-align: center; font-size: 30px; font-weight: 800; line-height: 1.1; }
.t-pulse .pl-foot { flex: none; display: flex; align-items: center; justify-content: center; gap: 22px; flex-wrap: wrap; }
.t-pulse .pl-foot .hint { font-size: 19px; color: var(--ink-2); }
@media (max-width: 900px) {
  .t-pulse { padding: 14px 14px 18px; }
  .t-pulse .pl-cards { gap: 14px; }
  .t-pulse .pl-name { font-size: 25px; }
  .t-pulse .pl-foot .hint { display: none; }
  .t-pulse .pl-botbox .bot { max-height: 160px; }
}
@media (max-height: 640px) {
  .t-pulse { gap: 14px; padding-top: 16px; padding-bottom: 16px; }
  .t-pulse .pl-card { gap: 8px; padding: 12px 14px 10px; }
  .t-pulse .pl-name { font-size: 26px; }
}
`;

export function mount(el, props = {}, api) {
  injectCSS('t-pulse', CSS);
  const root = h(`<div class="t-pulse">
    <div class="pl-cards">${WIDTHS.map((w, i) => `<button class="pl-card" type="button" data-i="${i}" aria-label="${w.name} square wave">
      <span class="pl-led" aria-hidden="true"></span>
      <div class="pl-lcd">${lcdWave(pulseTable(w.duty), { w: 300, h: 104, cycles: 3 })}<span class="pl-pct">${w.pct} ON</span></div>
      <div class="pl-botbox"><div class="bot" data-bot="bleep" style="--sq:${w.squash}">${botSVG('bleep', { label: false })}</div></div>
      <div class="pl-name">${w.name}</div>
    </button>`).join('')}</div>
    <div class="pl-foot">
      <button class="btn pl-all" type="button">${icon('play')}<span>Listen to all three</span></button>
      <span class="hint">Same robot, same notes. Only the square's width changes.</span>
    </div>
  </div>`);
  el.appendChild(root);

  const cards = [...root.querySelectorAll('.pl-card')];
  const bots = cards.map(c => c.querySelector('.bot'));
  const heard = new Set();
  const timers = [];
  let finished = false;
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

  function mark(i) {
    heard.add(i);
    cards[i].classList.add('heard');
    if (!finished && heard.size === WIDTHS.length) { finished = true; api.done(); }
  }
  function light(i, ms) {
    cards[i].classList.add('playing');
    sing(bots[i], ms);
    clearTimeout(cards[i]._pl);
    cards[i]._pl = later(() => cards[i].classList.remove('playing'), ms);
  }
  function playTune(i) {
    const d = WIDTHS[i].duty;
    try {
      const t0 = now();
      TUNE.forEach((m, k) => note({ voice: 'bleep', duty: d, midi: m, at: t0 + k * 0.17, dur: k === TUNE.length - 1 ? 0.26 : 0.15 }));
    } catch (e) { /* no sound */ }
    light(i, 820);
    mark(i);
  }

  cards.forEach((c, i) => press(c, () => { flash(c, 'press', 110); playTune(i); }));

  const all = root.querySelector('.pl-all');
  let busy = false;
  press(all, () => {
    if (busy) return;
    busy = true;
    flash(all, 'press', 110);
    let t0 = 0;
    try { t0 = now(); } catch (e) { /* ignore */ }
    WIDTHS.forEach((w, i) => {
      try { note({ voice: 'bleep', duty: w.duty, midi: 72, at: t0 + i * 0.8, dur: 0.55 }); } catch (e) { /* no sound */ }
      later(() => { light(i, 650); mark(i); }, i * 800);
    });
    later(() => { busy = false; }, 2300);
  });

  timers.push(startLine(props, api, LINE));

  return {
    destroy() {
      timers.forEach(t => clearTimeout(t));
      cards.forEach(c => clearTimeout(c._pl));
      try { stopAll(); } catch (e) { /* ignore */ }
      root.remove();
    },
  };
}

/* ---------- small helpers (local to this toy) ---------- */
function press(el, fn) {
  el.addEventListener('pointerdown', e => { if (e.button > 0) return; fn(e); });
  el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); fn(e); } });
}
function flash(el, cls, ms) {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  clearTimeout(el._fl); el._fl = setTimeout(() => el.classList.remove(cls), ms);
}
function startLine(props, api, text) {
  const intro = props && props.step ? String(props.step.intro || props.step.title || '') : '';
  if (!intro) { api.say(text); return 0; }
  return setTimeout(() => api.say(text), Math.min(9000, 900 + intro.length * 72));
}
