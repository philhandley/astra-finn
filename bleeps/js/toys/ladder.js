// The Pitch Ladder and the Lift game (Mission 3).
// props.mode 'ladder' (default): eight rungs of magic notes, lowest at the bottom. Slide a finger up and down
//   (or tap) and each rung plays as the finger crosses it; Bleep climbs to the last note. Done after 6 different rungs.
// props.mode 'lift': press Listen to hear two notes, guess Up or Down, then the lift moves floor to floor to show it.
//   Every answer gets a warm reveal ("Yes!" is added when it matched). Done after 4 rounds.
import { ensure, now, note } from '../core/chip.js';
import { botSVG, sing } from '../core/bots.js';
import { scaleNotes, colourOf } from '../core/song.js';
import { sticker } from '../core/stickers.js';
import { icon } from '../core/icons.js';
import { h, injectCSS } from '../core/dom.js';

const NOTES = scaleNotes('magic', 8); // C4 D4 E4 G4 A4 C5 D5 E5, row 0 lowest

export function mount(el, props = {}, api) {
  injectCSS('t-ladder', CSS);
  return props.mode === 'lift' ? mountLift(el, props, api) : mountLadder(el, props, api);
}

/* ---------------- The Pitch Ladder ---------------- */
function mountLadder(el, props, api) {
  const rungs = NOTES.map((m, i) => `<div class="ld-rung" data-i="${i}" style="--c:${colourOf(m)}"><i></i></div>`).reverse().join('');
  const root = h(`<div class="t-ladder ld">
    <div class="ld-hint" aria-hidden="true">
      <div class="ld-end">${sticker('mouse')}<b>higher</b></div>
      <div class="ld-arrow"><span class="ld-head">${icon('up')}</span><span class="ld-shaft"></span></div>
      <div class="ld-end">${sticker('bear')}<b>lower</b></div>
    </div>
    <div class="ld-ladder" role="group" aria-label="Pitch ladder. Slide up and down.">
      <span class="ld-rail l"></span><span class="ld-rail r"></span>
      <div class="ld-rungs">${rungs}</div>
    </div>
    <div class="ld-track"><div class="bot ld-bot" data-bot="bleep">${botSVG('bleep')}</div></div>
  </div>`);
  el.appendChild(root);

  const ladder = root.querySelector('.ld-ladder');
  const track = root.querySelector('.ld-track');
  const bot = root.querySelector('.ld-bot');
  const rungEls = [...root.querySelectorAll('.ld-rung')].sort((a, b) => a.dataset.i - b.dataset.i); // index = note row
  const played = new Set();
  const pointers = new Map(); // pointerId -> rung index
  const litT = new Map();
  let current = 0, finished = false;

  function place(i, animate = true) {
    const r = rungEls[i].getBoundingClientRect(), tr = track.getBoundingClientRect();
    if (!r.height) return;
    const bh = bot.offsetHeight;
    const y = r.top + r.height / 2 - tr.top - bh * 0.6;
    if (!animate) bot.style.transition = 'none';
    bot.style.transform = `translateY(${Math.round(y)}px)`;
    if (!animate) { void bot.offsetWidth; bot.style.transition = ''; }
  }

  function play(i) {
    ensure();
    note({ voice: 'bleep', duty: 0.5, midi: NOTES[i], dur: 0.22, vol: 0.9, env: { a: 0.003, d: 0.08, s: 0.7, r: 0.06 } });
    const r = rungEls[i];
    r.classList.add('lit');
    clearTimeout(litT.get(i));
    litT.set(i, setTimeout(() => r.classList.remove('lit'), 260));
    current = i;
    place(i);
    sing(bot, 300);
    played.add(i);
    if (played.size >= 6 && !finished) { finished = true; api.done(); }
  }

  // The rung nearest the finger's height (the finger may wander off the side while sliding).
  function rungAt(y) {
    let best = 0, bd = Infinity;
    rungEls.forEach((r, i) => { const b = r.getBoundingClientRect(); const d = Math.abs(b.top + b.height / 2 - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  const down = e => {
    if (e.button > 0) return;
    e.preventDefault();
    try { ladder.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const i = rungAt(e.clientY);
    pointers.set(e.pointerId, i);
    play(i);
  };
  const move = e => {
    if (!pointers.has(e.pointerId)) return;
    const i = rungAt(e.clientY);
    if (i !== pointers.get(e.pointerId)) {
      // Fast slides can skip a rung between two events: play every rung crossed.
      const from = pointers.get(e.pointerId), step = i > from ? 1 : -1;
      for (let k = from + step; k !== i + step; k += step) play(k);
      pointers.set(e.pointerId, i);
    }
  };
  const up = e => { pointers.delete(e.pointerId); };
  ladder.addEventListener('pointerdown', down);
  ladder.addEventListener('pointermove', move);
  ladder.addEventListener('pointerup', up);
  ladder.addEventListener('pointercancel', up);
  const botTap = e => { if (e.button > 0) return; e.preventDefault(); play(current); };
  bot.addEventListener('pointerdown', botTap);
  const key = e => {
    if (e.key === 'ArrowUp') { e.preventDefault(); play(Math.min(7, current + 1)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); play(Math.max(0, current - 1)); }
  };
  ladder.tabIndex = 0;
  ladder.addEventListener('keydown', key);

  const ro = new ResizeObserver(() => place(current, false));
  ro.observe(root);
  requestAnimationFrame(() => place(0, false));

  return {
    destroy() {
      ro.disconnect();
      litT.forEach(t => clearTimeout(t));
      ladder.removeEventListener('pointerdown', down);
      ladder.removeEventListener('pointermove', move);
      ladder.removeEventListener('pointerup', up);
      ladder.removeEventListener('pointercancel', up);
      ladder.removeEventListener('keydown', key);
      bot.removeEventListener('pointerdown', botTap);
    },
  };
}

/* ---------------- The Lift game ---------------- */
function mountLift(el, props, api) {
  const floors = NOTES.map((m, i) => `<div class="lf-floor" data-i="${i}" style="--c:${colourOf(m)}"><span class="lf-lamp"></span></div>`).reverse().join('');
  const root = h(`<div class="t-ladder lf">
    <div class="lf-shaft" aria-hidden="true">
      <div class="lf-floors">${floors}</div>
      <div class="lf-well"><div class="lf-car" style="--f:0"><span class="lf-cable"></span><span class="lf-box"><span class="bot lf-bot" data-bot="bleep">${botSVG('bleep', { label: false })}</span></span></div></div>
    </div>
    <div class="lf-buttons">
      <button class="lf-btn lf-up" type="button" aria-label="It went up">${icon('up')}<b>Up</b></button>
      <button class="lf-btn lf-down" type="button" aria-label="It went down">${icon('down')}<b>Down</b></button>
    </div>
    <div class="lf-side">
      <button class="playbig lf-listen glowing" type="button"><span class="disc">${icon('play')}</span><span class="lf-lt">Listen</span></button>
      <div class="lf-msg card" aria-live="polite"><span class="lf-pic"></span><span class="lf-txt"></span></div>
      <button class="btn big go lf-next" type="button">Next ${icon('next')}</button>
    </div>
  </div>`);
  el.appendChild(root);

  const $ = s => root.querySelector(s);
  const car = $('.lf-car'), carBot = $('.lf-bot');
  const upBtn = $('.lf-up'), downBtn = $('.lf-down'), listen = $('.lf-listen'), listenT = $('.lf-lt'), next = $('.lf-next');
  const msgPic = $('.lf-pic'), msgTxt = $('.lf-txt');
  const lamps = [...root.querySelectorAll('.lf-floor')].sort((a, b) => a.dataset.i - b.dataset.i);
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };
  const cleanups = [];

  let state = 'idle'; // idle | playing | asked | showing | revealed
  let pair = null, guess = null, rounds = 0, finished = false, pairEnd = 0, floor = 0;
  const dirs = [];

  function message(text, pic = '') {
    msgTxt.textContent = text;
    msgPic.innerHTML = pic;
    msgPic.style.display = pic ? '' : 'none';
  }
  function setFloor(f, animate = true) {
    floor = f;
    if (!animate) car.style.transition = 'none';
    car.style.setProperty('--f', f);
    if (!animate) { void car.offsetWidth; car.style.transition = ''; }
    lamps.forEach((l, i) => l.classList.toggle('on', i === f));
  }
  function newPair() {
    let a, b, up;
    for (let k = 0; k < 40; k++) {
      a = Math.floor(Math.random() * 8); b = Math.floor(Math.random() * 8);
      up = b > a;
      const n = dirs.length;
      const third = n >= 2 && dirs[n - 1] === dirs[n - 2] && dirs[n - 1] === up; // never three the same way in a row
      if (Math.abs(a - b) >= 2 && !third) break;
    }
    if (a === b) b = a < 4 ? a + 3 : a - 3;
    dirs.push(b > a);
    return [a, b];
  }
  function tone(i, at, dur = 0.4) {
    note({ voice: 'bleep', duty: 0.5, midi: NOTES[i], at, dur, vol: 0.9, env: { a: 0.003, d: 0.1, s: 0.75, r: 0.07 } });
  }
  function ding() {
    note({ voice: 'hoot', midi: 88, dur: 0.18, vol: 0.7, env: { a: 0.002, d: 0.12, s: 0.3, r: 0.12 } });
    note({ voice: 'bleep', duty: 0.125, midi: 88, dur: 0.06, vol: 0.35 });
  }
  function setState(s) {
    state = s;
    root.dataset.state = s;
    listen.classList.toggle('glowing', s === 'idle');
    upBtn.classList.toggle('ask', s === 'asked');
    downBtn.classList.toggle('ask', s === 'asked');
    next.classList.toggle('show', s === 'revealed');
  }

  // Play the pair without moving the lift (no clues), then ask.
  function playPair() {
    ensure();
    clearTimers();
    upBtn.classList.remove('picked'); downBtn.classList.remove('picked');
    guess = null;
    const t = now() + 0.03;
    tone(pair[0], t); tone(pair[1], t + 0.5, 0.45);
    pairEnd = performance.now() + 1000;
    setState('playing');
    listenT.textContent = 'Again';
    message('Shh... listen!', sticker('ear'));
    later(() => sing(carBot, 380), 30);
    later(() => sing(carBot, 420), 530);
    later(() => {
      if (state !== 'playing') return;
      setState('asked');
      message('Did it go up or down?');
      api.say('Did it go up or down?');
    }, 1150);
  }

  // Play the pair again while the lift shows the answer.
  function showAnswer(counts) {
    clearTimers();
    setState('showing');
    const [a, b] = pair, up = b > a;
    message('Watch the lift!', sticker('eyes'));
    later(() => {
      ensure();
      setFloor(a, Math.abs(floor - a) <= 1);
      tone(a, now() + 0.01);
      sing(carBot, 400);
    }, 350);
    later(() => {
      setFloor(b);
      tone(b, now() + 0.01, 0.45);
      sing(carBot, 450);
    }, 1050);
    later(() => {
      const yes = counts && guess === (up ? 'up' : 'down');
      const line = (yes ? 'Yes! ' : '') + (up ? 'It went up!' : 'It went down!');
      message(line, `<span class="lf-arrow ${up ? 'up' : 'down'}">${icon(up ? 'up' : 'down')}</span>`);
      api.say(line);
      setState('revealed');
      if (counts) {
        rounds++;
        if (rounds >= 4 && !finished) { finished = true; api.done(); }
      }
    }, 1750);
  }

  function onListen() {
    if (state === 'idle') { pair = newPair(); playPair(); }
    else if (state === 'playing' || state === 'asked') playPair();
    else if (state === 'revealed') showAnswer(false);
  }
  function onAnswer(dir) {
    ding();
    const btn = dir === 'up' ? upBtn : downBtn;
    if (state === 'playing' || state === 'asked') {
      guess = dir;
      btn.classList.add('picked');
      // Let the second note finish before the lift moves.
      later(() => showAnswer(true), Math.max(250, pairEnd - performance.now() + 150));
      setState('showing');
      message(dir === 'up' ? 'You said up!' : 'You said down!', `<span class="lf-arrow ${dir}">${icon(dir)}</span>`);
    } else if (state === 'idle' || state === 'revealed') {
      listen.classList.remove('nudge'); void listen.offsetWidth; listen.classList.add('nudge');
    }
  }
  function onNext() {
    pair = newPair();
    playPair();
  }

  cleanups.push(tap(listen, onListen));
  cleanups.push(tap(upBtn, () => onAnswer('up')));
  cleanups.push(tap(downBtn, () => onAnswer('down')));
  cleanups.push(tap(next, onNext));

  setFloor(0, false);
  setState('idle');
  message('Two notes. Up or down?');

  return { destroy() { clearTimers(); cleanups.forEach(f => f && f()); } };
}

/* ---------------- Helpers ---------------- */
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

const CSS = `
.t-ladder { flex: 1; min-height: 0; display: flex; padding: 18px 24px; container-type: size; }

/* Ladder */
.t-ladder.ld { justify-content: center; align-items: stretch; gap: clamp(18px, 3cqw, 40px); }
.t-ladder .ld-hint { flex: none; width: clamp(96px, 11cqw, 140px); display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 4px 0; }
.t-ladder .ld-end { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.t-ladder .ld-end svg { width: clamp(48px, 11cqh, 72px); height: clamp(48px, 11cqh, 72px); }
.t-ladder .ld-end b { font-size: 22px; font-weight: 800; color: var(--ink-2); }
.t-ladder .ld-arrow { flex: 1; min-height: 40px; display: flex; flex-direction: column; align-items: center; }
.t-ladder .ld-head { width: 54px; height: 54px; border-radius: 50%; background: var(--ink); color: #fff; display: flex; align-items: center; justify-content: center; flex: none; }
.t-ladder .ld-head svg { width: 34px; height: 34px; stroke-width: 3; }
.t-ladder .ld-shaft { flex: 1; width: 8px; margin-top: -4px; border-radius: 4px; background: repeating-linear-gradient(var(--ink) 0 14px, transparent 14px 24px); opacity: .45; }

.t-ladder .ld-ladder { position: relative; flex: 0 1 600px; min-width: 260px; padding: 18px 30px; touch-action: none; cursor: pointer; outline: none; }
.t-ladder .ld-ladder:focus-visible { outline: 4px solid var(--a); outline-offset: 2px; border-radius: 20px; }
.t-ladder .ld-rail { position: absolute; top: 0; bottom: 0; width: 26px; border: 3px solid var(--edge); border-radius: 12px; background: #8d8a9c; box-shadow: inset -6px 0 0 #6f6c80; z-index: 2; pointer-events: none; }
.t-ladder .ld-rail.l { left: 10px; }
.t-ladder .ld-rail.r { right: 10px; }
.t-ladder .ld-rungs { height: 100%; display: flex; flex-direction: column; gap: clamp(6px, 1.6cqh, 12px); }
.t-ladder .ld-rung { position: relative; flex: 1; min-height: 0; border: 3px solid var(--edge); border-radius: 14px; background: var(--c); box-shadow: 0 4px 0 var(--edge); transition: transform .12s, filter .12s, box-shadow .12s; }
.t-ladder .ld-rung i { position: absolute; left: 34px; right: 34px; top: 18%; height: 18%; min-height: 4px; border-radius: 6px; background: #fff; opacity: .35; }
.t-ladder .ld-rung.lit { transform: scale(1.03, 1.12); filter: brightness(1.15) saturate(1.1); box-shadow: 0 0 0 5px #fff, 0 4px 0 5px var(--edge); z-index: 1; }

.t-ladder .ld-track { position: relative; flex: none; width: clamp(110px, 15cqw, 170px); }
.t-ladder .ld-bot { position: absolute; left: 0; top: 0; width: 100%; max-width: clamp(80px, 21cqh, 150px); transition: transform .3s cubic-bezier(.34, 1.5, .64, 1); }

/* Lift */
.t-ladder.lf { gap: clamp(16px, 2.4cqw, 30px); align-items: stretch; }
.t-ladder .lf-shaft { position: relative; flex: 0 0 clamp(150px, 18cqw, 220px); display: flex; border: 3px solid var(--edge); border-radius: 22px; background: var(--bezel); box-shadow: var(--pop); padding: 10px; gap: 8px; }
.t-ladder .lf-floors { flex: none; width: 34px; display: flex; flex-direction: column; }
.t-ladder .lf-floor { flex: 1; display: flex; align-items: center; justify-content: center; }
.t-ladder .lf-lamp { width: 24px; height: 24px; border-radius: 7px; border: 3px solid var(--edge); background: var(--c); opacity: .5; filter: saturate(.6); transition: opacity .2s, transform .2s; }
.t-ladder .lf-floor.on .lf-lamp { opacity: 1; filter: none; transform: scale(1.18); box-shadow: 0 0 12px var(--c); }
.t-ladder .lf-well { position: relative; flex: 1; border-radius: 12px; overflow: hidden; background: repeating-linear-gradient(#3d3d4c 0 calc(12.5% - 3px), #2e2e3b calc(12.5% - 3px) 12.5%); }
.t-ladder .lf-car { position: absolute; left: 6px; right: 6px; top: 0; height: 12.5%; padding: 3px 0; transform: translateY(calc((7 - var(--f)) * 100%)); transition: transform .5s cubic-bezier(.45, 0, .3, 1); }
.t-ladder .lf-cable { position: absolute; left: 50%; bottom: calc(100% - 3px); width: 4px; margin-left: -2px; height: 1200px; background: #1b1b24; }
.t-ladder .lf-box { position: relative; height: 100%; display: flex; align-items: flex-end; justify-content: center; background: var(--card); border: 3px solid var(--edge); border-radius: 10px; overflow: hidden; }
.t-ladder .lf-bot { height: 96%; aspect-ratio: 120 / 140; }
.t-ladder .lf-bot .botsvg { width: 100%; height: 100%; }

.t-ladder .lf-buttons { flex: 0 1 clamp(200px, 25cqw, 300px); display: flex; flex-direction: column; gap: clamp(14px, 3cqh, 24px); }
.t-ladder .lf-btn {
  flex: 1; min-height: 96px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  border: 3px solid var(--edge); border-radius: 28px; box-shadow: 0 7px 0 var(--edge); cursor: pointer; font: inherit; color: var(--ink);
  touch-action: manipulation; transition: transform .07s, box-shadow .07s, outline-color .2s; outline: 6px solid transparent; outline-offset: 4px;
}
.t-ladder .lf-btn svg { width: clamp(56px, 17cqh, 110px); height: clamp(56px, 17cqh, 110px); stroke-width: 3.2; }
.t-ladder .lf-btn b { font-size: clamp(26px, 6cqh, 38px); font-weight: 800; line-height: 1; }
.t-ladder .lf-up { background: #ffe28a; }
.t-ladder .lf-down { background: var(--hoot-dark); color: #fff; }
.t-ladder .lf-btn.press { transform: translateY(5px); box-shadow: 0 2px 0 var(--edge); }
.t-ladder .lf-btn.ask { animation: lf-ask 1.4s ease-in-out infinite; }
.t-ladder .lf-btn.picked { outline-color: var(--a); }
.t-ladder .lf-btn:focus-visible { outline-color: var(--a); }
@keyframes lf-ask { 50% { transform: scale(1.03); } }

.t-ladder .lf-side { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: clamp(12px, 3cqh, 22px); }
.t-ladder .lf-listen { min-height: clamp(80px, 17cqh, 104px); font-size: clamp(26px, 5.5cqh, 34px); padding-right: 38px; }
.t-ladder .lf-listen .disc { width: clamp(56px, 12cqh, 72px); height: clamp(56px, 12cqh, 72px); }
.t-ladder .lf-listen.glowing { animation: lf-glow 1.6s ease-in-out infinite; }
@keyframes lf-glow { 0%, 100% { box-shadow: 0 6px 0 var(--edge), 0 0 0 0 rgba(31, 163, 92, .5); } 50% { box-shadow: 0 6px 0 var(--edge), 0 0 0 16px rgba(31, 163, 92, 0); } }
.t-ladder .lf-listen.nudge { animation: lf-nudge .5s ease-in-out; }
@keyframes lf-nudge { 20%, 60% { transform: rotate(-4deg) scale(1.05); } 40%, 80% { transform: rotate(4deg) scale(1.05); } }
.t-ladder .lf-msg { width: 100%; max-width: 460px; flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 16px; }
.t-ladder .lf-txt { font-size: clamp(24px, 5.5cqh, 34px); font-weight: 800; line-height: 1.2; }
.t-ladder .lf-pic { width: clamp(56px, 16cqh, 110px); height: clamp(56px, 16cqh, 110px); flex: none; }
.t-ladder .lf-pic > svg { width: 100%; height: 100%; }
.t-ladder .lf-arrow { width: 100%; height: 100%; border-radius: 50%; border: 3px solid var(--edge); display: flex; align-items: center; justify-content: center; }
.t-ladder .lf-arrow svg { width: 66%; height: 66%; stroke-width: 3.2; }
.t-ladder .lf-arrow.up { background: #ffe28a; }
.t-ladder .lf-arrow.down { background: var(--hoot-dark); color: #fff; }
.t-ladder[data-state="playing"] .lf-pic { animation: lf-throb .6s ease-in-out infinite; }
@keyframes lf-throb { 50% { transform: scale(1.1); } }
.t-ladder .lf-next { visibility: hidden; }
.t-ladder .lf-next.show { visibility: visible; animation: glow 1.6s ease-in-out infinite; }
@container (max-height: 440px) {
  .t-ladder .lf-next.btn.big { min-height: 64px; font-size: 24px; }
  .t-ladder .lf-msg { padding: 10px; }
}
@media (prefers-reduced-motion: reduce) { .t-ladder .lf-btn.ask, .t-ladder .lf-listen.glowing { animation: none; } }
`;
