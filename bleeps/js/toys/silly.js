// Silly Sound Machine (Mission 6, the Co-pilot's turn).
// Four giant effect buttons (Wobble, Echo, Slide, Sparkle) and four robot faces to choose who sings.
// Every tap plays a random magic note with that effect, so it never sounds the same twice.
// props: none.
// Done: after 6 taps on the effect buttons.
import { note, hello, stopAll } from '../core/chip.js';
import { botSVG, sing } from '../core/bots.js';
import { BOTS, scaleNotes } from '../core/song.js';
import { h, esc, injectCSS, reducedMotion } from '../core/dom.js';

const ROBOTS = ['bleep', 'hoot', 'buzz', 'crew'];
const K = '#1b1b24';
// Pictures drawn as white shapes with a dark outline, on the button's colour.
const line = (d, w = 9) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 7}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const PICS = {
  wobble: `<svg viewBox="0 0 120 120" aria-hidden="true">${line('M10 60c8-26 17-26 25 0s17 26 25 0 17-26 25 0 17 26 25 0')}</svg>`,
  echo: `<svg viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="13" fill="#fff" stroke="${K}" stroke-width="5"/>
    <circle cx="60" cy="60" r="29" fill="none" stroke="${K}" stroke-width="12"/><circle cx="60" cy="60" r="29" fill="none" stroke="#fff" stroke-width="6"/>
    <circle cx="60" cy="60" r="45" fill="none" stroke="${K}" stroke-width="10" opacity=".75"/><circle cx="60" cy="60" r="45" fill="none" stroke="#fff" stroke-width="5" opacity=".75"/></svg>`,
  slide: `<svg viewBox="0 0 120 120" aria-hidden="true">${line('M18 98 94 22', 11)}${line('M54 22h40v40', 11)}</svg>`,
  sparkle: `<svg viewBox="0 0 120 120" aria-hidden="true">
    <path d="M60 10 69 47 106 56 69 65 60 102 51 65 14 56 51 47Z" fill="#fff" stroke="${K}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M96 12 99 22 109 25 99 28 96 38 93 28 83 25 93 22Z" fill="#fff" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M24 84 27 92 35 95 27 98 24 106 21 98 13 95 21 92Z" fill="#fff" stroke="${K}" stroke-width="4" stroke-linejoin="round"/></svg>`,
};
const EFFECTS = [
  { id: 'wobble', name: 'Wobble', col: 'bleep' },
  { id: 'echo', name: 'Echo', col: 'hoot' },
  { id: 'slide', name: 'Slide', col: 'buzz' },
  { id: 'sparkle', name: 'Sparkle', col: 'fizz' },
];

const CSS = `
.t-silly { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: var(--vgap, 22px); padding: 16px 22px 24px; }
.t-silly .sl-bots { flex: none; display: flex; justify-content: center; gap: 18px; }
.t-silly .sl-bot {
  width: 104px; height: 104px; flex: none; padding: 6px 0 0; display: flex; align-items: center; justify-content: center;
  border: 3px solid var(--edge); border-radius: 22px; background: var(--card); box-shadow: 0 5px 0 var(--edge); cursor: pointer;
  touch-action: manipulation; transition: transform .07s, box-shadow .07s, background .15s;
}
.t-silly .sl-bot .bot { width: 76px; pointer-events: none; }
.t-silly .sl-bot .bot .botsvg { width: 100%; height: auto; }
.t-silly .sl-bot.on { background: var(--soft); box-shadow: 0 2px 0 var(--edge), inset 0 0 0 5px var(--col); transform: translateY(3px); }
.t-silly .sl-grid { flex: none; min-height: 0; display: grid; justify-content: center; align-content: center; gap: var(--gap, 22px);
  grid-template-columns: repeat(var(--cols, 4), var(--sz, 220px)); grid-auto-rows: var(--sz, 220px); }
.t-silly .sl-fx {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4%; padding: 6% 6% 7%;
  border: 3px solid var(--edge); border-radius: 30px; background: var(--col); box-shadow: 0 8px 0 var(--edge); cursor: pointer; color: #fff;
  font-family: var(--font); touch-action: manipulation; overflow: visible; transition: box-shadow .07s;
}
.t-silly .sl-fx::before { content: ''; position: absolute; left: 14px; right: 14px; top: 10px; height: 16px; border-radius: 10px; background: rgba(255,255,255,.28); pointer-events: none; }
.t-silly .sl-fx .pic { width: 62%; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.t-silly .sl-fx .pic svg { width: 100%; height: 100%; overflow: visible; }
.t-silly .sl-fx .nm { font-size: calc(var(--sz, 220px) * .13); font-weight: 800; line-height: 1; text-shadow: 0 2px 0 rgba(0,0,0,.35); pointer-events: none; }
.t-silly .sl-fx.press { box-shadow: 0 2px 0 var(--edge); }
.t-silly .sl-px { position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; border: 2.5px solid var(--edge); pointer-events: none; z-index: 3; }
`;

export function mount(el, props = {}, api) {
  injectCSS('t-silly', CSS);
  const notes = scaleNotes('magic', 8);
  const crewTable = (api.kit && api.kit.get && api.kit.get('wave') && api.kit.get('wave').table) || null;
  let bot = 'bleep', taps = 0, finished = false, lastNote = null;
  const vars = b => `--col:${BOTS[b].col};--soft:${BOTS[b].soft}`;

  const root = h(`<div class="t-silly">
    <div class="sl-bots" role="group" aria-label="Who sings?">${ROBOTS.map(b => `<button class="sl-bot${b === bot ? ' on' : ''}" type="button" data-b="${b}" style="${vars(b)}" aria-label="${esc(BOTS[b].name)} sings"><span class="bot" data-bot="${b}">${botSVG(b, { label: false, table: b === 'crew' ? crewTable : null })}</span></button>`).join('')}</div>
    <div class="sl-grid">${EFFECTS.map(f => `<button class="sl-fx" type="button" data-fx="${f.id}" style="${vars(f.col)}" aria-label="${f.name}"><span class="pic">${PICS[f.id]}</span><span class="nm">${f.name}</span></button>`).join('')}</div>
  </div>`);
  el.appendChild(root);

  const grid = root.querySelector('.sl-grid');
  const botBtns = [...root.querySelectorAll('.sl-bot')];
  const fxBtns = [...root.querySelectorAll('.sl-fx')];

  // Size the four buttons to fit: four in a row on wide screens, two by two when that makes them bigger.
  const bots = root.querySelector('.sl-bots');
  function fit() {
    const cs = getComputedStyle(root);
    const W = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const vgap = root.clientHeight < 640 ? 16 : 26;
    root.style.setProperty('--vgap', vgap + 'px');
    const H = root.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - bots.offsetHeight - vgap - 10;
    if (W < 50 || H < 50) return;
    const gap = W < 900 ? 16 : 22;
    const s4 = Math.min((W - 3 * gap) / 4, H);
    const s2 = Math.min((W - gap) / 2, (H - gap) / 2);
    const two = s2 > s4 * 1.08;
    const sz = Math.floor(Math.max(120, Math.min(two ? s2 : s4, 330)));
    grid.style.setProperty('--cols', two ? 2 : 4);
    grid.style.setProperty('--sz', sz + 'px');
    grid.style.setProperty('--gap', gap + 'px');
  }
  let ro = null;
  if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(root); }
  fit();

  const pick = () => {
    let m;
    do { m = notes[Math.floor(Math.random() * notes.length)]; } while (m === lastNote && notes.length > 1);
    lastNote = m;
    return m;
  };
  const SOUNDS = {
    wobble: (v, m) => note({ voice: v, midi: m, dur: 0.8, wobble: 1.8 }),
    echo: (v, m) => note({ voice: v, midi: m, dur: 0.16, echo: 0.75 }),
    slide: (v, m) => note({ voice: v, midi: m - 12, to: m + 6, dur: 0.6, slideTime: 0.5 }),
    sparkle: (v, m) => note({ voice: v, midi: m, dur: 0.8, arp: [0, 4, 7, 12] }),
  };

  botBtns.forEach(b => press(b, () => {
    bot = b.dataset.b;
    botBtns.forEach(x => x.classList.toggle('on', x === b));
    try { hello(bot); } catch (e) { /* no sound */ }
    sing(b.querySelector('.bot'), 650);
  }));

  fxBtns.forEach(b => press(b, () => {
    const id = b.dataset.fx;
    try { SOUNDS[id](bot, pick()); } catch (e) { /* no sound */ }
    bounce(b);
    burst(b);
    sing(root.querySelector(`.sl-bot[data-b="${bot}"] .bot`), id === 'echo' ? 500 : 850);
    taps++;
    if (!finished && taps >= 6) { finished = true; api.done(); }
  }));

  const t = startLine(props, api, `${api.crew && api.crew.copilot ? api.crew.copilot : 'Co-pilot'}, press the big buttons!`);

  return {
    destroy() {
      clearTimeout(t);
      if (ro) ro.disconnect();
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
function bounce(el) {
  el.classList.remove('press'); void el.offsetWidth; el.classList.add('press');
  clearTimeout(el._fl); el._fl = setTimeout(() => el.classList.remove('press'), 160);
  if (reducedMotion() || !el.animate) return;
  try {
    el.animate([
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(6px) scale(.92, .9)', offset: 0.25 },
      { transform: 'translateY(-6px) scale(1.05)', offset: 0.6 },
      { transform: 'translateY(0) scale(1)' },
    ], { duration: 420, easing: 'ease-out' });
  } catch (e) { /* ignore */ }
}
// A little burst of pixel squares flying out of the button.
const PX_COLS = ['#ffffff', '#f6c81e', '#9bbc0f', '#ff4f45', '#3b82f6', '#14b8a6'];
function burst(el) {
  if (reducedMotion() || !el.animate) return;
  const r = el.getBoundingClientRect();
  const reach = Math.max(80, r.width * 0.55);
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('span');
    p.className = 'sl-px';
    p.style.background = PX_COLS[i % PX_COLS.length];
    el.appendChild(p);
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
    const d = reach * (0.75 + Math.random() * 0.45);
    try {
      const anim = p.animate([
        { transform: 'translate(-50%, -50%) scale(.6)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1)`, opacity: 0 },
      ], { duration: 520 + Math.random() * 160, easing: 'cubic-bezier(.15,.7,.3,1)' });
      anim.onfinish = () => p.remove();
      anim.oncancel = () => p.remove();
    } catch (e) { p.remove(); }
  }
}
function startLine(props, api, text) {
  const intro = props && props.step ? String(props.step.intro || props.step.title || '') : '';
  if (!intro) { api.say(text); return 0; }
  return setTimeout(() => api.say(text), Math.min(9000, 900 + intro.length * 72));
}
