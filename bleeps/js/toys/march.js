// March to the beat, and Freeze Dance (Mission 4, everyone moves).
// props.mode 'march' (default): a drum that bounces on every beat, footprints that light left-right-left-right,
//   a huge Play/Stop button and three speeds (Tortoise 80, Cat 110, Hare 140 bpm; props.speed picks the first one).
//   Done after 16 beats.
// props.mode 'freeze': Freeze Dance. Robot Dance plays and the robots dance; after 4 to 9 seconds the music stops
//   dead and everyone freezes. After 3 seconds a "Ready... GO!" countdown (or the big Go! button) restarts it.
//   Done after 3 freezes.
import { ensure, now, drum, sfx, stopAll } from '../core/chip.js';
import { Sequencer } from '../core/seq.js';
import { botSVG } from '../core/bots.js';
import { demoSongs, stepsOf, stepDur, scheduleStep } from '../core/song.js';
import { sticker } from '../core/stickers.js';
import { icon } from '../core/icons.js';
import { h, injectCSS } from '../core/dom.js';
import { isSpeaking, onSpeaking } from '../core/ui.js';

const SPEEDS = [
  { id: 'tortoise', name: 'Tortoise', bpm: 80 },
  { id: 'cat', name: 'Cat', bpm: 110 },
  { id: 'hare', name: 'Hare', bpm: 140 },
];

export function mount(el, props = {}, api) {
  injectCSS('t-march', CSS);
  api.setWho && api.setWho('everyone');
  return props.mode === 'freeze' ? mountFreeze(el, props, api) : mountMarch(el, props, api);
}

/* ---------------- March ---------------- */
// One foot (a left foot: big toe on the right). The right foot is the mirror image.
const FOOT = `<path d="M24 25c8 0 12 7 11 17-1 10-4 19-11 19s-10-9-10-18c0-10 3-18 10-18z"/>
  <circle cx="30.5" cy="13" r="5.6"/><circle cx="21.5" cy="10" r="4.2"/><circle cx="14.5" cy="12.5" r="3.6"/><circle cx="9.2" cy="17.8" r="3.1"/><circle cx="6" cy="24.5" r="2.7"/>`;
const foot = side => `<svg viewBox="0 0 48 64" aria-hidden="true">${side === 'r' ? `<g transform="translate(48 0) scale(-1 1)">${FOOT}</g>` : FOOT}</svg>`;

function mountMarch(el, props, api) {
  let speed = SPEEDS.find(s => s.id === props.speed) || SPEEDS[1];
  const root = h(`<div class="t-march mc">
    <div class="mc-stage">
      <div class="mc-drumzone"><div class="mc-drum">${sticker('drum')}</div></div>
      <div class="mc-line">March with the beat!</div>
      <div class="mc-feet" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<span class="mc-ft ${i % 2 ? 'r' : 'l'}">${foot(i % 2 ? 'r' : 'l')}</span>`).join('')}</div>
    </div>
    <div class="mc-ctrl">
      <button class="btn go mc-play" type="button"><span class="mc-pi">${icon('play')}</span><span class="mc-pt">Play</span></button>
      <div class="mc-speeds" role="group" aria-label="Speed">
        ${SPEEDS.map(s => `<button class="mc-sp" type="button" data-id="${s.id}"><span class="mc-spic">${sticker(s.id)}</span><b>${s.name}</b></button>`).join('')}
      </div>
    </div>
  </div>`);
  el.appendChild(root);

  const $ = s => root.querySelector(s);
  const drumEl = $('.mc-drum'), playBtn = $('.mc-play'), feet = [...root.querySelectorAll('.mc-ft')];
  const spBtns = [...root.querySelectorAll('.mc-sp')];
  const cleanups = [];
  let beats = 0, finished = false;

  const seq = new Sequencer({
    steps: 8, // eighth notes: beats on the even steps
    stepDur: () => 30 / speed.bpm,
    schedule: (s, t) => {
      if (s % 2 === 0) drum(s % 4 === 0 ? 'boom' : 'tap', t, { vol: s % 4 === 0 ? 1 : 0.8 });
      else drum('tss', t, { vol: 0.4 });
    },
    onStep: s => { if (s % 2 === 0) beat(s % 4 === 0); },
  });

  function beat(big) {
    drumEl.classList.remove('boom', 'tap');
    void drumEl.offsetWidth;
    drumEl.classList.add(big ? 'boom' : 'tap');
    const i = beats % 8;
    feet.forEach((f, k) => f.classList.toggle('lit', k === i));
    beats++;
    if (beats >= 16 && !finished) { finished = true; api.done(); }
  }
  function drawPlay() {
    const on = seq.playing;
    playBtn.classList.toggle('go', !on);
    playBtn.classList.toggle('primary', on);
    playBtn.querySelector('.mc-pi').innerHTML = icon(on ? 'stop' : 'play');
    playBtn.querySelector('.mc-pt').textContent = on ? 'Stop' : 'Play';
    root.classList.toggle('playing', on);
  }
  function drawSpeed() { spBtns.forEach(b => b.classList.toggle('on', b.dataset.id === speed.id)); }

  cleanups.push(tap(playBtn, () => {
    if (seq.playing) {
      seq.stop();
      sfx({ voice: 'bleep', duty: 0.25, from: 72, to: 60, len: 0.12 });
      feet.forEach(f => f.classList.remove('lit'));
    } else {
      seq.start();
    }
    drawPlay();
  }));
  spBtns.forEach(b => cleanups.push(tap(b, () => {
    speed = SPEEDS.find(s => s.id === b.dataset.id) || speed;
    drawSpeed();
    // Playing: the next step simply uses the new speed. Stopped: hear two beats at this speed.
    if (!seq.playing) {
      ensure();
      const t = now() + 0.01;
      drum('boom', t);
      drum('tap', t + 60 / speed.bpm, { vol: 0.8 });
    }
  })));

  drawPlay(); drawSpeed();
  return { destroy() { seq.stop(); cleanups.forEach(f => f && f()); } };
}

/* ---------------- Freeze Dance ---------------- */
const DANCERS = ['bleep', 'hoot', 'buzz', 'fizz'];
const SKY = [[6, 10], [18, 30], [29, 8], [41, 22], [53, 12], [64, 34], [76, 9], [88, 25], [12, 48], [35, 42], [58, 50], [83, 46], [95, 14], [47, 4], [71, 58], [23, 62]];

function mountFreeze(el, props, api) {
  const songs = demoSongs();
  const song = songs.find(s => s.id === 'demo-robot') || songs[0];
  const root = h(`<div class="t-march fz">
    <div class="fz-stage">
      <div class="fz-sky" aria-hidden="true">${SKY.map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('')}</div>
      <div class="fz-bots">${DANCERS.map((b, i) => `<div class="bot fz-bot d${i}" data-bot="${b}">${botSVG(b, { label: false })}</div>`).join('')}</div>
      <div class="fz-floor"></div>
      <div class="fz-over" aria-live="assertive"><span></span></div>
    </div>
    <div class="fz-ctrl">
      <button class="btn go fz-main" type="button"><span class="fz-mi">${icon('play')}</span><span class="fz-mt">Dance!</span></button>
      <div class="fz-lcd lcd" aria-hidden="true">READY?</div>
      <div class="fz-rules card" aria-label="How to play">
        <div class="fz-rule"><span class="fz-ric">${sticker('note')}</span><span><b>Music</b> dance!</span></div>
        <div class="fz-rule"><span class="fz-ric">${sticker('nosound')}</span><span><b>Quiet</b> freeze!</span></div>
      </div>
    </div>
  </div>`);
  el.appendChild(root);

  const $ = s => root.querySelector(s);
  const stage = $('.fz-stage'), over = $('.fz-over'), overT = over.querySelector('span'), main = $('.fz-main'), lcd = $('.fz-lcd');
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };
  const cleanups = [];
  let state = 'idle', freezes = 0, finished = false, flip = false;

  const seq = new Sequencer({
    steps: () => stepsOf(song),
    stepDur: s => stepDur(song, s),
    schedule: (s, t, d) => scheduleStep(song, s, t, d),
    onStep: s => { if (s % 2 === 0 && state === 'dancing') dance(); },
    loop: true,
  });

  function dance() {
    flip = !flip;
    stage.classList.toggle('pa', flip);
    stage.classList.toggle('pb', !flip);
  }
  function show(text, kind = '') {
    overT.textContent = text;
    over.className = 'fz-over show ' + kind;
  }
  const hide = () => { over.className = 'fz-over'; };
  function setState(s) {
    state = s;
    stage.classList.toggle('dancing', s === 'dancing');
    stage.classList.toggle('frozen', s === 'frozen' || s === 'count');
    const label = { idle: 'Dance!', dancing: 'Stop', frozen: 'Go!', count: 'Go!' }[s];
    main.querySelector('.fz-mt').textContent = label;
    main.querySelector('.fz-mi').innerHTML = icon(s === 'dancing' ? 'stop' : 'play');
    main.classList.toggle('go', s !== 'dancing');
    main.classList.toggle('primary', s === 'dancing');
    main.classList.toggle('glow', s === 'frozen' || s === 'count');
    lcd.textContent = { idle: 'READY?', dancing: 'DANCE!', frozen: 'FREEZE!', count: 'READY...' }[s];
  }
  function blip(m) { sfx({ voice: 'bleep', duty: 0.5, notes: [m], len: 0.12 }); }

  function startDance() {
    setState('dancing');
    seq.start();
    later(freeze, 4000 + Math.random() * 5000);
  }
  function freeze() {
    seq.stop(); // the music stops dead
    sfx({ voice: 'bleep', duty: 0.5, from: 84, to: 60, len: 0.25 });
    setState('frozen');
    show('FREEZE!', 'ice');
    api.say('Freeze!');
    freezes++;
    if (freezes >= 3 && !finished) { finished = true; api.done(); }
    later(() => { setState('count'); show('Ready...'); blip(72); }, 3000);
    later(go, 4000);
  }
  function go() {
    clearTimers();
    show('GO!', 'go');
    blip(84);
    startDance();
    later(hide, 700);
  }
  function stopDance() {
    clearTimers();
    seq.stop();
    sfx({ voice: 'bleep', duty: 0.25, from: 72, to: 60, len: 0.12 });
    hide();
    stage.classList.remove('pa', 'pb');
    setState('idle');
  }

  cleanups.push(tap(main, () => {
    if (state === 'idle') { clearTimers(); hide(); startDance(); }
    else if (state === 'dancing') stopDance();
    else go();
  }));

  setState('idle');
  cleanups.push(sayStart(api, props, 'Dance! When the music stops, freeze!'));

  return { destroy() { clearTimers(); seq.stop(); stopAll(); cleanups.forEach(f => f && f()); } };
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
.t-march { flex: 1; min-height: 0; display: flex; align-items: stretch; gap: clamp(16px, 2.4cqw, 28px); padding: 18px 24px; container-type: size; }

/* March */
.t-march .mc-stage { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; border: 3px solid var(--edge); border-radius: 28px; background: var(--card); box-shadow: var(--pop); padding: clamp(10px, 2.4cqh, 20px) 20px clamp(12px, 3cqh, 24px); overflow: hidden; }
.t-march .mc-drumzone { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
.t-march .mc-drum { height: min(100%, 300px); aspect-ratio: 1; transform-origin: 50% 85%; }
.t-march .mc-drum svg { width: 100%; height: 100%; }
.t-march .mc-drum.boom { animation: mc-boom .3s ease-out; }
.t-march .mc-drum.tap { animation: mc-tap .24s ease-out; }
@keyframes mc-boom { 0% { transform: scale(1.16, .84); } 45% { transform: scale(.96, 1.06) translateY(-4%); } 100% { transform: none; } }
@keyframes mc-tap { 0% { transform: scale(1.07, .93); } 100% { transform: none; } }
.t-march .mc-line { flex: none; font-size: clamp(26px, 6cqh, 36px); font-weight: 800; margin: 6px 0 clamp(8px, 2.4cqh, 18px); }
.t-march .mc-feet { flex: none; width: 100%; max-width: 860px; height: clamp(66px, 16cqh, 112px); display: flex; justify-content: space-between; align-items: center; padding: 0 8px; }
.t-march .mc-ft { height: 80%; aspect-ratio: 48 / 64; color: var(--line); transition: color .35s, transform .2s; }
.t-march .mc-ft.l { transform: translateY(-14%) rotate(-6deg); }
.t-march .mc-ft.r { transform: translateY(14%) rotate(6deg); }
.t-march .mc-ft svg { width: 100%; height: 100%; fill: currentColor; overflow: visible; }
.t-march .mc-ft.lit { color: var(--cmd); transition: color .05s, transform .1s; }
.t-march .mc-ft.lit svg { stroke: var(--edge); stroke-width: 3; }
.t-march .mc-ft.l.lit { transform: translateY(-14%) rotate(-6deg) scale(1.18); }
.t-march .mc-ft.r.lit { transform: translateY(14%) rotate(6deg) scale(1.18); }

.t-march .mc-ctrl, .t-march .fz-ctrl { flex: 0 0 clamp(230px, 26cqw, 320px); display: flex; flex-direction: column; gap: clamp(10px, 2.4cqh, 18px); }
.t-march .mc-play, .t-march .fz-main { flex: none; width: 100%; min-height: clamp(96px, 24cqh, 140px); border-radius: 28px; font-size: clamp(30px, 7cqh, 40px); gap: 14px; box-shadow: 0 7px 0 var(--edge); }
.t-march .mc-play svg, .t-march .fz-main svg { width: 1.2em; height: 1.2em; }
.t-march .mc-play.press, .t-march .fz-main.press { transform: translateY(5px); box-shadow: 0 2px 0 var(--edge); }
.t-march .mc-speeds { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: clamp(8px, 2cqh, 14px); }
.t-march .mc-sp {
  flex: 1; min-height: 64px; display: flex; align-items: center; gap: 14px; padding: 0 16px; border: 3px solid var(--edge); border-radius: 20px;
  background: var(--card); box-shadow: 0 5px 0 var(--edge); cursor: pointer; font: inherit; color: var(--ink); touch-action: manipulation; transition: transform .07s, box-shadow .07s, background .15s;
}
.t-march .mc-sp.press { transform: translateY(4px); box-shadow: 0 1px 0 var(--edge); }
.t-march .mc-sp.on { background: #fff1c7; box-shadow: 0 5px 0 var(--edge), inset 0 0 0 5px var(--cmd); }
.t-march .mc-spic { height: clamp(48px, 13cqh, 80px); aspect-ratio: 1; flex: none; }
.t-march .mc-spic svg { width: 100%; height: 100%; }
.t-march .mc-sp b { font-size: clamp(22px, 5cqh, 28px); font-weight: 800; }

/* Freeze Dance */
.t-march .fz-stage { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; border: 3px solid var(--edge); border-radius: 28px; box-shadow: var(--pop); overflow: hidden; background: linear-gradient(#2a2440, #1b1b2e); }
.t-march .fz-sky { position: absolute; inset: 0; pointer-events: none; }
.t-march .fz-sky i { position: absolute; width: 6px; height: 6px; background: #ffd76a; opacity: .5; }
.t-march .fz-stage.dancing .fz-sky i { animation: fz-twinkle 1.1s steps(2) infinite; }
.t-march .fz-sky i:nth-child(3n) { animation-delay: .35s; background: #9cc7ff; }
.t-march .fz-sky i:nth-child(3n+1) { animation-delay: .7s; background: #ff9ad1; }
@keyframes fz-twinkle { 50% { opacity: 1; } }
.t-march .fz-bots { position: relative; flex: 1; min-height: 0; display: flex; align-items: flex-end; justify-content: space-around; padding: 0 2%; }
.t-march .fz-bot { width: 21%; max-width: 200px; max-height: 88%; transform-origin: 50% 100%; transition: transform .16s ease-out; cursor: default; }
.t-march .fz-bot .botsvg { width: 100%; height: auto; max-height: 100%; }
.t-march .fz-stage.dancing .fz-bot .mouth { animation: talk .14s steps(2) infinite; }
.t-march .fz-stage.pa .d0 { transform: rotate(-9deg); }
.t-march .fz-stage.pb .d0 { transform: translateY(-12%) rotate(9deg); }
.t-march .fz-stage.pa .d1 { transform: translateY(-16%) scale(.94, 1.08); }
.t-march .fz-stage.pb .d1 { transform: scale(1.1, .88); }
.t-march .fz-stage.pa .d2 { transform: translateX(-6%) rotate(-10deg); }
.t-march .fz-stage.pb .d2 { transform: translateX(6%) rotate(10deg); }
.t-march .fz-stage.pa .d3 { transform: translateY(-4%) rotate(8deg); }
.t-march .fz-stage.pb .d3 { transform: translateY(-18%) rotate(-12deg); }
.t-march .fz-stage.frozen .fz-bot { transition: none; }
.t-march .fz-stage.frozen .fz-bot .botsvg { filter: drop-shadow(3px 0 0 #bfe3ff) drop-shadow(-3px 0 0 #bfe3ff) drop-shadow(0 3px 0 #bfe3ff) drop-shadow(0 -3px 0 #bfe3ff); }
.t-march .fz-stage.frozen .eyes { animation: none; }
.t-march .fz-floor { flex: none; height: clamp(22px, 5cqh, 32px); background: repeating-linear-gradient(90deg, #3a3358 0 30px, #332d4f 30px 60px); border-top: 3px solid #120f1f; }
.t-march .fz-over { position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 6%; pointer-events: none; opacity: 0; transition: opacity .15s; }
.t-march .fz-over span { font-family: var(--pixel); font-size: clamp(34px, min(12cqh, 7cqw), 88px); color: #fff; text-shadow: 5px 5px 0 var(--edge); padding: 22px 34px; border-radius: 22px; transform: scale(.4); transition: transform .35s cubic-bezier(.34, 1.56, .64, 1); }
.t-march .fz-over.show { opacity: 1; }
.t-march .fz-over.show span { transform: none; }
.t-march .fz-over.ice span { color: #e8f5ff; background: rgba(59, 130, 246, .82); border: 4px solid #bfe3ff; box-shadow: 0 0 0 4px var(--edge); }
.t-march .fz-over.go span { color: #fff; background: var(--go); border: 4px solid var(--edge); }
.t-march .fz-rules { flex: 1; min-height: 0; padding: 12px 16px; display: flex; flex-direction: column; justify-content: center; gap: clamp(6px, 2cqh, 14px); }
.t-march .fz-rule { display: flex; align-items: center; gap: 12px; font-size: 22px; line-height: 1.15; }
.t-march .fz-rule b { display: block; font-weight: 800; }
.t-march .fz-ric { width: clamp(44px, 11cqh, 64px); height: clamp(44px, 11cqh, 64px); flex: none; }
.t-march .fz-ric svg { width: 100%; height: 100%; }
.t-march .fz-lcd { flex: none; height: clamp(64px, 17cqh, 110px); display: flex; align-items: center; justify-content: center; font-size: clamp(20px, 4.5cqh, 28px); text-align: center; padding: 10px; }
.t-march .fz-stage.dancing ~ .fz-ctrl .fz-lcd { animation: fz-pulse .55s ease-in-out infinite; }
@keyframes fz-pulse { 50% { color: var(--lcd-dark); } }
@media (prefers-reduced-motion: reduce) { .t-march .fz-bot { transition: none; } }
`;
