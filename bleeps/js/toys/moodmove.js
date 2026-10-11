// Happy and sad chords, a movement game (Mission 7).
// Sunny plays C major then F major as a bouncy sparkle with a Hoot bass and a light boom-tss beat (about 4 s):
// the sun bounces, the sky warms, "Bounce!". Rainy plays A minor then E minor, slower, soft held Hoot notes and
// no drums (about 4 s): pixel rain falls and everything sways, "Sway...".
// props: none. Done after both have been played at least twice.
import { ensure, now, note, drum, stopAll } from '../core/chip.js';
import { botSVG } from '../core/bots.js';
import { CHORDS } from '../core/song.js';
import { sticker } from '../core/stickers.js';
import { h, injectCSS } from '../core/dom.js';
import { isSpeaking, onSpeaking } from '../core/ui.js';

const SUNNY_BEAT = 0.5; // 120 bpm: 2 bars of 4 beats = 4 s
const RAINY_CHORD = 2.1; // two slow chords, about 4 s
const DROPS = [[4, 0], [11, .9], [17, .3], [24, 1.3], [30, .6], [37, 1.6], [43, .2], [49, 1.1], [56, .5], [62, 1.4], [68, .1], [74, .8], [80, 1.7], [86, .4], [92, 1.2], [97, .7]];

export function mount(el, props = {}, api) {
  injectCSS('t-moodmove', CSS);
  const root = h(`<div class="t-moodmove">
    <button class="mm-card mm-sunny" type="button" aria-label="Sunny music">
      <span class="mm-pics"><span class="mm-pic">${sticker('sun')}</span><span class="mm-pic">${sticker('happy')}</span></span>
      <b>Sunny</b>
    </button>
    <div class="mm-scene" aria-live="polite">
      <div class="mm-sun">${sticker('sun')}</div>
      <div class="mm-cloud">${sticker('greycloud')}</div>
      <div class="mm-rain" aria-hidden="true">${DROPS.map(([x, d]) => `<i style="left:${x}%;animation-delay:-${d}s"></i>`).join('')}</div>
      <div class="mm-word"><span></span></div>
      <div class="mm-ground">
        <span class="mm-flower f1">${sticker('flower')}</span>
        <span class="bot mm-bot" data-bot="bleep">${botSVG('bleep', { label: false })}</span>
        <span class="mm-flower f2">${sticker('flower')}</span>
      </div>
    </div>
    <button class="mm-card mm-rainy" type="button" aria-label="Rainy music">
      <span class="mm-pics"><span class="mm-pic">${sticker('rain')}</span><span class="mm-pic">${sticker('sad')}</span></span>
      <b>Rainy</b>
    </button>
  </div>`);
  el.appendChild(root);

  const $ = s => root.querySelector(s);
  const sunnyBtn = $('.mm-sunny'), rainyBtn = $('.mm-rainy'), word = $('.mm-word span');
  const plays = { sunny: 0, rainy: 0 };
  const cleanups = [];
  let mood = null, endT = 0, finished = false;

  function setMood(m) {
    mood = m;
    root.classList.remove('sunny', 'rainy');
    if (m) { void root.offsetWidth; root.classList.add(m); }
    sunnyBtn.classList.toggle('on', m === 'sunny');
    rainyBtn.classList.toggle('on', m === 'rainy');
    word.textContent = m === 'sunny' ? 'Bounce!' : m === 'rainy' ? 'Sway...' : 'Sunny or rainy?';
    word.parentElement.classList.toggle('idle', !m);
  }

  function playSunny() {
    const t0 = now() + 0.03;
    [CHORDS.home, CHORDS.sunny].forEach((c, bar) => {
      for (let b = 0; b < 4; b++) {
        const t = t0 + (bar * 4 + b) * SUNNY_BEAT;
        note({ voice: 'bleep', duty: 0.25, midi: c.root + 12, arp: [...c.iv, c.iv[0] + 12], arpRate: 1 / 24, at: t, dur: SUNNY_BEAT * 0.8, vol: 0.5, bus: 'chords', env: { a: 0.003, d: 0.15, s: 0.6, r: 0.05 } });
        note({ voice: 'hoot', midi: c.root + (b % 2 ? 7 : 0), at: t, dur: SUNNY_BEAT * 0.7, vol: 0.9, bus: 'bass', env: { a: 0.004, d: 0.1, s: 0.7, r: 0.06 } });
        drum(b % 2 ? 'tss' : 'boom', t, { vol: 0.7 });
      }
    });
    // A last bright "ta-da" on Home.
    const end = t0 + 8 * SUNNY_BEAT;
    note({ voice: 'bleep', duty: 0.25, midi: CHORDS.home.root + 12, arp: [0, 4, 7, 12], arpRate: 1 / 24, at: end, dur: 0.4, vol: 0.45, bus: 'chords' });
    note({ voice: 'hoot', midi: CHORDS.home.root, at: end, dur: 0.4, vol: 0.9, bus: 'bass' });
    return 8 * SUNNY_BEAT + 0.45;
  }

  function playRainy() {
    const t0 = now() + 0.03;
    const soft = { a: 0.12, d: 0.5, s: 0.75, r: 0.4 };
    // A slow falling line on top of each chord.
    const tops = [[76, 72], [71, 67]];
    [CHORDS.rainy, CHORDS.dreamy].forEach((c, k) => {
      const t = t0 + k * RAINY_CHORD;
      c.iv.forEach((iv, j) => note({ voice: 'hoot', midi: c.root + iv, at: t + j * 0.12, dur: RAINY_CHORD - 0.15 - j * 0.12, vol: 0.5, bus: 'chords', wobble: 0.2, env: soft }));
      note({ voice: 'hoot', midi: c.root - 12, at: t, dur: RAINY_CHORD - 0.1, vol: 0.75, bus: 'bass', env: soft });
      tops[k].forEach((m, j) => note({ voice: 'hoot', midi: m, at: t + 0.1 + j * 1.0, dur: 0.85, vol: 0.45, bus: 'lead', wobble: 0.35, env: soft }));
    });
    return 2 * RAINY_CHORD + 0.3;
  }

  function play(m) {
    ensure();
    clearTimeout(endT);
    stopAll(); // a new choice replaces the music that was playing
    const len = m === 'sunny' ? playSunny() : playRainy();
    setMood(m);
    endT = setTimeout(() => setMood(null), len * 1000);
    plays[m]++;
    if (plays.sunny >= 2 && plays.rainy >= 2 && !finished) { finished = true; api.done(); }
  }

  cleanups.push(tap(sunnyBtn, () => play('sunny')));
  cleanups.push(tap(rainyBtn, () => play('rainy')));

  setMood(null);
  api.setWho && api.setWho('everyone');
  cleanups.push(sayStart(api, props, 'Sunny music: bounce! Rainy music: sway slowly.'));

  return { destroy() { clearTimeout(endT); stopAll(); cleanups.forEach(f => f && f()); } };
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
.t-moodmove { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr minmax(0, 1.25fr) 1fr; gap: clamp(14px, 2.2cqw, 26px); padding: 18px 24px; container-type: size; transition: background-color .6s; }
.t-moodmove.sunny { background-color: #f6e3bf; }
.t-moodmove.rainy { background-color: #d9e1ea; }

.t-moodmove .mm-card {
  position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(10px, 3cqh, 24px);
  padding: 16px; border: 3px solid var(--edge); border-radius: 28px; box-shadow: 0 7px 0 var(--edge); cursor: pointer; font: inherit; color: var(--ink);
  touch-action: manipulation; transition: transform .07s, box-shadow .07s, outline-color .2s; outline: 6px solid transparent; outline-offset: 4px;
}
.t-moodmove .mm-card.press { transform: translateY(5px); box-shadow: 0 2px 0 var(--edge); }
.t-moodmove .mm-card:focus-visible { outline-color: var(--a); }
.t-moodmove .mm-card.on { outline-color: var(--ink); }
.t-moodmove .mm-sunny { background: #ffcf4a; }
.t-moodmove .mm-rainy { background: var(--hoot); color: #fff; }
.t-moodmove .mm-pics { display: flex; flex-direction: column; align-items: center; gap: clamp(6px, 2cqh, 14px); }
.t-moodmove .mm-pic { width: clamp(76px, 25cqh, 170px); aspect-ratio: 1; border-radius: 50%; background: #fff; border: 3px solid var(--edge); display: flex; align-items: center; justify-content: center; }
.t-moodmove .mm-rainy .mm-pic { background: #eef4ff; }
.t-moodmove .mm-pic svg { width: 80%; height: 80%; }
.t-moodmove .mm-card b { font-size: clamp(28px, 6.5cqh, 42px); font-weight: 800; line-height: 1; }
.t-moodmove.sunny .mm-sunny.on .mm-pic { animation: mm-bounce .5s ease-in-out infinite; }
.t-moodmove.rainy .mm-rainy.on .mm-pic { animation: mm-sway 2.1s ease-in-out infinite; }

.t-moodmove .mm-scene { position: relative; min-width: 0; min-height: 0; container-type: size; border: 3px solid var(--edge); border-radius: 28px; box-shadow: var(--pop); overflow: hidden; background: #dcebf7; transition: background-color .6s; display: flex; flex-direction: column; }
.t-moodmove.sunny .mm-scene { background: #ffe39a; }
.t-moodmove.rainy .mm-scene { background: #9fb3cc; }
.t-moodmove .mm-sun { position: absolute; left: 7%; top: 6%; width: min(24cqh, 30cqw, 150px); aspect-ratio: 1; transition: opacity .6s, transform .6s; }
.t-moodmove .mm-sun svg, .t-moodmove .mm-cloud svg { width: 100%; height: 100%; }
.t-moodmove.sunny .mm-sun { animation: mm-bounce .5s ease-in-out infinite; }
.t-moodmove.rainy .mm-sun { opacity: 0; transform: translateY(-30%); }
.t-moodmove .mm-cloud { position: absolute; right: 6%; top: 4%; width: min(28cqh, 36cqw, 190px); aspect-ratio: 1; opacity: .5; transition: opacity .6s, transform .6s; }
.t-moodmove.sunny .mm-cloud { opacity: 0; transform: translateX(40%); }
.t-moodmove.rainy .mm-cloud { opacity: 1; right: auto; left: 50%; transform: translateX(-50%) scale(1.35); animation: none; }
.t-moodmove .mm-rain { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .5s; }
.t-moodmove .mm-rain i { position: absolute; top: -10%; width: 6px; height: 18px; background: #3b82f6; box-shadow: 0 0 0 2px rgba(255,255,255,.35); }
.t-moodmove.rainy .mm-rain { opacity: 1; }
.t-moodmove.rainy .mm-rain i { animation: mm-drop 1.8s linear infinite; }
@keyframes mm-drop { from { transform: translateY(0); } to { transform: translateY(80cqh); } }
.t-moodmove .mm-word { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; position: relative; z-index: 2; padding-top: 12%; }
.t-moodmove .mm-word span { display: inline-block; font-size: clamp(30px, min(11cqh, 13cqw), 64px); font-weight: 800; color: var(--ink); text-shadow: 3px 3px 0 #fff; }
.t-moodmove .mm-word.idle span { font-size: clamp(22px, min(5.5cqh, 6.5cqw), 30px); color: var(--ink-2); text-shadow: none; }
.t-moodmove.sunny .mm-word span { animation: mm-bounce .5s ease-in-out infinite; }
.t-moodmove.rainy .mm-word span { animation: mm-sway 2.1s ease-in-out infinite; }
.t-moodmove .mm-ground { flex: none; height: 46%; display: flex; align-items: flex-end; justify-content: center; gap: 4%; padding: 0 6%; background: linear-gradient(transparent 62%, #7cc46a 62%); border-bottom: 0; position: relative; z-index: 1; }
.t-moodmove .mm-ground::after { content: ''; position: absolute; left: 0; right: 0; top: 62%; border-top: 3px solid var(--edge); }
.t-moodmove .mm-bot { height: min(40cqh, 46cqw); aspect-ratio: 120 / 140; margin-bottom: 4%; transform-origin: 50% 100%; position: relative; z-index: 1; }
.t-moodmove .mm-bot .botsvg { width: 100%; height: 100%; }
.t-moodmove .mm-flower { height: min(20cqh, 22cqw); aspect-ratio: 1; margin-bottom: 6%; transform-origin: 50% 100%; position: relative; z-index: 1; }
.t-moodmove .mm-flower svg { width: 100%; height: 100%; }
.t-moodmove.sunny .mm-bot { animation: mm-hop .5s ease-in-out infinite; }
.t-moodmove.sunny .mm-bot .mouth { animation: talk .12s steps(2) infinite; }
.t-moodmove.sunny .mm-flower { animation: mm-bob .5s ease-in-out infinite; }
.t-moodmove.sunny .mm-flower.f2 { animation-delay: -.25s; }
.t-moodmove.rainy .mm-bot, .t-moodmove.rainy .mm-flower { animation: mm-sway 2.1s ease-in-out infinite; }
.t-moodmove.rainy .mm-flower.f2 { animation-delay: -1.05s; }
@keyframes mm-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14%); } }
@keyframes mm-hop { 0%, 100% { transform: translateY(0) scale(1.06, .94); } 50% { transform: translateY(-16%) scale(.96, 1.05); } }
@keyframes mm-bob { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg) translateY(-6%); } }
@keyframes mm-sway { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
@media (prefers-reduced-motion: reduce) { .t-moodmove * { animation-duration: 0s !important; } }
`;
