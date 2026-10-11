// Star Maker (Mission 3 "Make" step): pick two quick notes for the Moon Run star sound.
// Two short ladders (note 1 and note 2, five rungs each) and a choice of robot (Bleep or Hoot).
// Every tap plays the two-note star sound at once. "Use this for our game" saves it to the kit's star slot.
// props: none. Done when the crew saves a star sound.
import { ensure, sfx, noteName } from '../core/chip.js';
import { botSVG, sing } from '../core/bots.js';
import { BOTS, NOTE_COL } from '../core/song.js';
import { sticker } from '../core/stickers.js';
import { icon } from '../core/icons.js';
import { h, injectCSS } from '../core/dom.js';
import { isSpeaking, onSpeaking } from '../core/ui.js';

const RUNGS = [72, 76, 79, 84, 88]; // C5 E5 G5 C6 E6, lowest first: every pair sounds good
const COLS = [NOTE_COL.C, NOTE_COL.D, NOTE_COL.E, NOTE_COL.G, NOTE_COL.A]; // a rainbow, bottom to top
const VOICES = ['bleep', 'hoot'];
const START_LINE = 'Pick two notes for our star sound. Try going up!';

export function mount(el, props = {}, api) {
  injectCSS('t-starmaker', CSS);

  // Start from the crew's saved star sound if there is one.
  const saved = api.kit && api.kit.get ? api.kit.get('star') : null;
  const nearest = m => RUNGS.reduce((best, r, i) => (Math.abs(r - m) < Math.abs(RUNGS[best] - m) ? i : best), 0);
  let voice = saved && VOICES.includes(saved.voice) ? saved.voice : 'bleep';
  let sel = saved && Array.isArray(saved.notes) && saved.notes.length >= 2 ? [nearest(saved.notes[0]), nearest(saved.notes[1])] : [2, 3];
  let finished = false;

  const ladder = n => `<div class="sm-lad" data-l="${n}">
      <div class="sm-num">${n + 1}</div>
      <div class="sm-rungs">${RUNGS.map((m, i) => `<button class="sm-rung" type="button" data-l="${n}" data-i="${i}" style="--c:${COLS[i]}" aria-label="Note ${n + 1}: ${noteName(m)}"><span class="sm-mark">${sticker('star')}</span></button>`).reverse().join('')}</div>
    </div>`;
  const root = h(`<div class="t-starmaker">
    <div class="sm-bots" role="group" aria-label="Which robot sings it?">
      ${VOICES.map(v => `<button class="sm-bot" type="button" data-v="${v}" style="--bc:${BOTS[v].col};--bs:${BOTS[v].soft}"><span class="bot">${botSVG(v, { label: false })}</span><b>${BOTS[v].name}</b></button>`).join('')}
    </div>
    <div class="sm-ladders">
      ${ladder(0)}
      <div class="sm-then" aria-hidden="true">${icon('next')}</div>
      ${ladder(1)}
    </div>
    <div class="sm-side">
      <button class="sm-star" type="button" aria-label="Play our star sound">${sticker('star')}</button>
      <div class="sm-pic lcd" aria-hidden="true"></div>
      <div class="sm-word" aria-live="polite"></div>
      <button class="btn big primary sm-use" type="button">${icon('game')}<span>Use this for our game</span></button>
    </div>
  </div>`);
  el.appendChild(root);

  const $ = s => root.querySelector(s);
  const star = $('.sm-star'), pic = $('.sm-pic'), word = $('.sm-word'), use = $('.sm-use'), useT = use.querySelector('span');
  const botBtns = [...root.querySelectorAll('.sm-bot')];
  const rungBtns = [...root.querySelectorAll('.sm-rung')];
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const cleanups = [];

  const recipe = () => ({ voice, duty: 0.5, notes: [RUNGS[sel[0]], RUNGS[sel[1]]], len: 0.22 });
  const dir = () => (sel[1] > sel[0] ? 'up' : sel[1] < sel[0] ? 'down' : 'same');

  function draw() {
    botBtns.forEach(b => b.classList.toggle('on', b.dataset.v === voice));
    rungBtns.forEach(b => b.classList.toggle('sel', +b.dataset.i === sel[+b.dataset.l]));
    const y = i => 92 - i * 18;
    pic.innerHTML = `<svg viewBox="0 0 220 120" xmlns="http://www.w3.org/2000/svg">
      ${[0, 1, 2, 3, 4].map(i => `<path d="M14 ${y(i) + 8}H206" stroke="#8bac0f" stroke-width="2" stroke-dasharray="4 4"/>`).join('')}
      <rect class="sm-b1" x="34" y="${y(sel[0])}" width="62" height="16" fill="#0f380f"/>
      <rect class="sm-b2" x="124" y="${y(sel[1])}" width="62" height="16" fill="#0f380f"/>
    </svg>`;
    const d = dir();
    word.className = 'sm-word ' + d;
    word.innerHTML = d === 'same' ? `<span class="sm-wi">${icon('minus')}</span>Same!` : `<span class="sm-wi">${icon(d)}</span>${d === 'up' ? 'Up!' : 'Down!'}`;
  }

  function play() {
    ensure();
    sfx(recipe());
    star.classList.remove('pop'); void star.offsetWidth; star.classList.add('pop');
    const b1 = pic.querySelector('.sm-b1'), b2 = pic.querySelector('.sm-b2');
    [b1, b2].forEach(b => b && b.classList.remove('hop'));
    void pic.offsetWidth;
    b1 && b1.classList.add('hop');
    later(() => b2 && b2.classList.add('hop'), 110);
    const bot = root.querySelector(`.sm-bot[data-v="${voice}"] .bot`);
    sing(bot, 400);
  }
  function changed() {
    use.classList.remove('saved');
    useT.textContent = 'Use this for our game';
  }

  rungBtns.forEach(b => cleanups.push(tap(b, () => {
    sel[+b.dataset.l] = +b.dataset.i;
    draw(); play(); changed();
  })));
  botBtns.forEach(b => cleanups.push(tap(b, () => {
    voice = b.dataset.v;
    draw(); play(); changed();
  })));
  cleanups.push(tap(star, play));
  cleanups.push(tap(use, () => {
    play();
    const r = recipe();
    api.kit.set('star', r);
    const d = dir();
    const how = d === 'same' ? 'the same note twice' : `going ${d}`;
    api.log(`Made the star sound: ${BOTS[voice].name} plays ${noteName(r.notes[0])} then ${noteName(r.notes[1])}, ${how}.`);
    api.toast('Star sound saved for Moon Run!');
    use.classList.add('saved');
    useT.textContent = 'In our game!';
    if (!finished) { finished = true; api.done(); }
  }));

  draw();
  cleanups.push(sayStart(api, props, START_LINE));

  return { destroy() { timers.forEach(clearTimeout); timers.clear(); cleanups.forEach(f => f && f()); } };
}

// Sound on pointerdown (not click); keyboard Enter/Space still works through click.
function tap(el, fn) {
  const down = e => { if (e.button > 0) return; e.preventDefault(); el.classList.add('press'); fn(e); };
  const up = () => el.classList.remove('press');
  const click = e => { if (e.detail === 0) fn(e); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('click', click);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('pointerleave', up);
    el.removeEventListener('click', click);
  };
}

// Speak the opening line once the step intro (read by the runner) has finished, so it isn't cut off.
function sayStart(api, props, text) {
  const intro = String((props.step && (props.step.intro || props.step.title)) || '').trim().toLowerCase();
  if (intro && intro === text.toLowerCase()) return () => {};
  let t = 0, off = null;
  const cancel = () => { clearTimeout(t); if (off) off(); off = null; };
  const go = () => { cancel(); api.say(text); };
  t = setTimeout(() => {
    if (!isSpeaking()) { go(); return; }
    off = onSpeaking(on => { if (!on) { if (off) off(); off = null; t = setTimeout(go, 300); } });
  }, 150);
  return cancel;
}

const CSS = `
.t-starmaker { flex: 1; min-height: 0; display: flex; align-items: stretch; justify-content: center; gap: clamp(16px, 2.6cqw, 36px); padding: 18px 24px; container-type: size; }

.t-starmaker .sm-bots { flex: 0 0 clamp(130px, 15cqw, 190px); display: flex; flex-direction: column; gap: clamp(12px, 2.4cqh, 20px); }
.t-starmaker .sm-bot {
  flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px;
  border: 3px solid var(--edge); border-radius: 24px; background: var(--card); box-shadow: 0 6px 0 var(--edge); cursor: pointer; font: inherit; color: var(--ink);
  touch-action: manipulation; transition: transform .07s, box-shadow .07s, background .15s;
}
.t-starmaker .sm-bot .bot { height: clamp(64px, 24cqh, 150px); aspect-ratio: 120 / 140; flex: none; }
.t-starmaker .sm-bot .botsvg { width: 100%; height: 100%; }
.t-starmaker .sm-bot b { font-size: 24px; font-weight: 800; }
.t-starmaker .sm-bot.on { background: var(--bs); box-shadow: 0 6px 0 var(--edge), inset 0 0 0 5px var(--bc); }
.t-starmaker .sm-bot.press { transform: translateY(4px); box-shadow: 0 2px 0 var(--edge); }

.t-starmaker .sm-ladders { flex: 0 1 auto; display: flex; align-items: stretch; gap: clamp(8px, 1.4cqw, 16px); }
.t-starmaker .sm-lad { width: clamp(118px, 14cqw, 170px); display: flex; flex-direction: column; gap: 10px; }
.t-starmaker .sm-num { align-self: center; flex: none; min-width: 54px; height: 46px; padding: 0 12px; border-radius: 12px; background: var(--ink); color: #fff; font-family: var(--pixel); font-size: 22px; display: flex; align-items: center; justify-content: center; }
.t-starmaker .sm-rungs { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: clamp(6px, 1.4cqh, 10px); padding: 10px; border: 3px solid var(--edge); border-radius: 22px; background: var(--bg-2); }
.t-starmaker .sm-rung {
  position: relative; flex: 1; min-height: 0; border: 3px solid var(--edge); border-radius: 14px; background: var(--c); box-shadow: 0 4px 0 var(--edge);
  cursor: pointer; padding: 0; touch-action: manipulation; transition: transform .08s, box-shadow .08s;
}
.t-starmaker .sm-rung.press { transform: translateY(3px); box-shadow: 0 1px 0 var(--edge); }
.t-starmaker .sm-rung.sel { box-shadow: 0 0 0 4px #fff, 0 0 0 7px var(--edge), 0 4px 0 7px var(--edge); z-index: 1; }
.t-starmaker .sm-mark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(.3); transition: opacity .15s, transform .3s cubic-bezier(.34, 1.56, .64, 1); pointer-events: none; }
.t-starmaker .sm-mark svg { height: 80%; width: auto; max-width: 70%; aspect-ratio: 1; padding: 3px; border-radius: 50%; background: #fff; border: 3px solid var(--edge); }
.t-starmaker .sm-rung.sel .sm-mark { opacity: 1; transform: none; }
.t-starmaker .sm-then { align-self: center; width: 40px; height: 40px; color: var(--ink-2); margin-top: 56px; }
.t-starmaker .sm-then svg { width: 100%; height: 100%; stroke-width: 3; }

.t-starmaker .sm-side { flex: 0 1 400px; min-width: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(8px, 2.4cqh, 18px); }
.t-starmaker .sm-star {
  width: clamp(110px, 30cqh, 190px); aspect-ratio: 1; flex: none; border-radius: 50%; border: 3px solid var(--edge); background: #fff1c7; box-shadow: 0 7px 0 var(--edge);
  display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; touch-action: manipulation; transition: transform .07s, box-shadow .07s;
}
.t-starmaker .sm-star svg { width: 74%; height: 74%; }
.t-starmaker .sm-star.press { transform: translateY(5px); box-shadow: 0 2px 0 var(--edge); }
.t-starmaker .sm-star.pop svg { animation: sm-pop .45s cubic-bezier(.34, 1.56, .64, 1); }
@keyframes sm-pop { 0% { transform: scale(.8) rotate(-12deg); } 60% { transform: scale(1.15) rotate(6deg); } 100% { transform: none; } }
.t-starmaker .sm-pic { width: clamp(170px, 26cqw, 260px); flex: none; padding: 0; }
.t-starmaker .sm-pic svg { width: 100%; height: auto; max-height: 22cqh; }
.t-starmaker .sm-pic rect { transform-box: fill-box; transform-origin: center; }
.t-starmaker .sm-pic rect.hop { animation: sm-hop .25s ease-out; }
@keyframes sm-hop { 40% { transform: translateY(-6px) scale(1.12); fill: #306230; } }
.t-starmaker .sm-word { display: flex; align-items: center; gap: 10px; font-size: clamp(26px, 6cqh, 38px); font-weight: 800; line-height: 1; }
.t-starmaker .sm-wi { width: 1.25em; height: 1.25em; border-radius: 50%; border: 3px solid var(--edge); display: flex; align-items: center; justify-content: center; background: var(--card); }
.t-starmaker .sm-wi svg { width: 72%; height: 72%; stroke-width: 3.2; }
.t-starmaker .sm-word.up .sm-wi { background: #ffe28a; }
.t-starmaker .sm-word.down .sm-wi { background: var(--hoot-dark); color: #fff; }
.t-starmaker .sm-use { width: 100%; max-width: 400px; white-space: normal; line-height: 1.15; text-align: left; padding: 8px 22px; }
.t-starmaker .sm-use.saved { background: var(--go); }
@container (max-height: 450px) {
  .t-starmaker .sm-use.btn.big { min-height: 64px; font-size: 23px; }
  .t-starmaker .sm-num { height: 38px; font-size: 18px; }
  .t-starmaker .sm-then { margin-top: 48px; }
}
`;
