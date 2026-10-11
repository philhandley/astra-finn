// The Beat Pad (Mission 4, the Co-pilot's turn): tap the big drum with the beat.
// A soft guide beat (tss) plays and a ring pulses out from the pad on every beat. Tapping plays a boom and the pad
// squashes and lights up; a tap close to a beat adds a little sparkle. Nothing is ever said about missing.
// props.speed: 'tortoise' (default, 80 bpm) | 'cat' (110) | 'hare' (140). Done after 12 taps.
import { ensure, now, drum, context } from '../core/chip.js';
import { Sequencer } from '../core/seq.js';
import { sticker } from '../core/stickers.js';
import { icon } from '../core/icons.js';
import { h, injectCSS } from '../core/dom.js';
import { isSpeaking, onSpeaking } from '../core/ui.js';

const SPEEDS = [
  { id: 'tortoise', name: 'Tortoise', bpm: 80 },
  { id: 'cat', name: 'Cat', bpm: 110 },
  { id: 'hare', name: 'Hare', bpm: 140 },
];
const GOAL = 12;
const NEAR = 0.12; // seconds either side of a beat that count as "with the beat"
const SPARKS = ['#ff4f45', '#3b82f6', '#f5b400', '#14b8a6', '#9bbc0f', '#ffffff'];

export function mount(el, props = {}, api) {
  injectCSS('t-beatpad', CSS);
  let speed = SPEEDS.find(s => s.id === props.speed) || SPEEDS[0];
  const copilot = (api.crew && api.crew.copilot) || 'Co-pilot';

  const root = h(`<div class="t-beatpad">
    <div class="bp-speeds" role="group" aria-label="Speed">
      ${SPEEDS.map(s => `<button class="bp-sp" type="button" data-id="${s.id}"><span class="bp-spic">${sticker(s.id)}</span><b>${s.name}</b></button>`).join('')}
    </div>
    <div class="bp-zone">
      <div class="bp-wrap">
        <span class="bp-ring"></span><span class="bp-ring"></span>
        <button class="bp-pad" type="button" aria-label="Drum pad"><span class="bp-skin"><span class="bp-hand">${icon('hand')}</span></span></button>
      </div>
    </div>
    <div class="bp-side">
      <button class="btn go bp-play" type="button"><span class="bp-pi">${icon('play')}</span><span class="bp-pt">Beat</span></button>
      <div class="bp-lights lcd" aria-hidden="true">${[0, 1, 2, 3].map(i => `<i data-i="${i}"></i>`).join('')}</div>
    </div>
  </div>`);
  el.appendChild(root);

  const $ = s => root.querySelector(s);
  const pad = $('.bp-pad'), wrap = $('.bp-wrap'), playBtn = $('.bp-play');
  const rings = [...root.querySelectorAll('.bp-ring')], lights = [...root.querySelectorAll('.bp-lights i')];
  const spBtns = [...root.querySelectorAll('.bp-sp')];
  const cleanups = [];
  const sparkTimers = new Set();
  let taps = 0, finished = false, everStarted = false, ringN = 0, hitT = 0;
  let beatTimes = []; // audio-clock times of scheduled beats (recent and upcoming)

  const seq = new Sequencer({
    steps: 4,
    stepDur: () => 60 / speed.bpm,
    schedule: (s, t) => {
      drum('tss', t, { vol: s === 0 ? 0.75 : 0.5 });
      beatTimes.push(t);
      if (beatTimes.length > 8) beatTimes = beatTimes.slice(-8);
    },
    onStep: s => pulse(s),
  });

  function pulse(s) {
    const r = rings[ringN++ % rings.length];
    r.classList.remove('go'); void r.offsetWidth; r.classList.add('go');
    lights.forEach((l, i) => l.classList.toggle('on', i === s));
  }
  function drawPlay() {
    const on = seq.playing;
    playBtn.classList.toggle('go', !on);
    playBtn.classList.toggle('primary', on);
    playBtn.querySelector('.bp-pi').innerHTML = icon(on ? 'stop' : 'play');
    playBtn.querySelector('.bp-pt').textContent = on ? 'Stop' : 'Beat';
    if (!on) lights.forEach(l => l.classList.remove('on'));
  }
  function drawSpeed() { spBtns.forEach(b => b.classList.toggle('on', b.dataset.id === speed.id)); }
  function startBeat() { everStarted = true; seq.start(); drawPlay(); }

  // How close was this tap to a beat? Uses the event's own time and the speaker's delay, and is generous.
  function nearBeat(e) {
    if (!seq.playing || !beatTimes.length) return false;
    const ac = context();
    const lag = ac ? (ac.outputLatency || ac.baseLatency || 0) : 0;
    const age = e && e.timeStamp ? Math.max(0, (performance.now() - e.timeStamp) / 1000) : 0;
    const t = now() - age;
    return beatTimes.some(b => Math.abs(t - b) <= NEAR || Math.abs(t - lag - b) <= NEAR);
  }

  function sparkle() {
    const R = wrap.offsetWidth / 2;
    for (let k = 0; k < 16; k++) {
      const s = document.createElement('i');
      s.className = 'bp-spark';
      const a = (k / 16) * Math.PI * 2 + Math.random() * 0.3;
      const r0 = R * (0.92 + Math.random() * 0.08), r1 = R * (1.2 + Math.random() * 0.25);
      s.style.setProperty('--x0', `${(Math.cos(a) * r0).toFixed(1)}px`);
      s.style.setProperty('--y0', `${(Math.sin(a) * r0).toFixed(1)}px`);
      s.style.setProperty('--x1', `${(Math.cos(a) * r1).toFixed(1)}px`);
      s.style.setProperty('--y1', `${(Math.sin(a) * r1).toFixed(1)}px`);
      s.style.background = SPARKS[k % SPARKS.length];
      wrap.appendChild(s);
      const t = setTimeout(() => { sparkTimers.delete(t); s.remove(); }, 700);
      sparkTimers.add(t);
    }
  }

  function hit(e) {
    drum('boom');
    pad.classList.remove('hit'); void pad.offsetWidth; pad.classList.add('hit');
    clearTimeout(hitT);
    hitT = setTimeout(() => pad.classList.remove('hit'), 260);
    if (nearBeat(e)) sparkle();
    if (!seq.playing && !everStarted) startBeat();
    taps++;
    if (taps >= GOAL && !finished) { finished = true; api.done(); }
  }

  cleanups.push(tap(pad, hit));
  cleanups.push(tap(playBtn, () => {
    if (seq.playing) { seq.stop(); drawPlay(); }
    else startBeat();
  }));
  spBtns.forEach(b => cleanups.push(tap(b, () => {
    speed = SPEEDS.find(s => s.id === b.dataset.id) || speed;
    drawSpeed();
    wrap.style.setProperty('--beat', `${60 / speed.bpm}s`);
    if (!seq.playing) {
      // Hear the speed: two soft beats.
      ensure();
      const t = now() + 0.01;
      drum('tss', t, { vol: 0.75 });
      drum('tss', t + 60 / speed.bpm, { vol: 0.5 });
    }
  })));

  wrap.style.setProperty('--beat', `${60 / speed.bpm}s`);
  drawPlay(); drawSpeed();
  api.setWho && api.setWho('copilot');
  cleanups.push(sayStart(api, props, `${copilot}, tap the drum with the beat!`));

  return {
    destroy() {
      seq.stop();
      clearTimeout(hitT);
      sparkTimers.forEach(clearTimeout); sparkTimers.clear();
      cleanups.forEach(f => f && f());
    },
  };
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
.t-beatpad { flex: 1; min-height: 0; display: flex; align-items: stretch; gap: clamp(16px, 2.4cqw, 30px); padding: 18px 24px; container-type: size; }

.t-beatpad .bp-speeds, .t-beatpad .bp-side { flex: 0 0 clamp(170px, 19cqw, 240px); display: flex; flex-direction: column; justify-content: center; gap: clamp(10px, 2.4cqh, 16px); }
.t-beatpad .bp-sp {
  flex: 0 1 120px; min-height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 10px;
  border: 3px solid var(--edge); border-radius: 22px; background: var(--card); box-shadow: 0 5px 0 var(--edge); cursor: pointer; font: inherit; color: var(--ink);
  touch-action: manipulation; transition: transform .07s, box-shadow .07s, background .15s;
}
.t-beatpad .bp-sp.press { transform: translateY(4px); box-shadow: 0 1px 0 var(--edge); }
.t-beatpad .bp-sp.on { background: var(--fizz-soft); box-shadow: 0 5px 0 var(--edge), inset 0 0 0 5px var(--fizz); }
.t-beatpad .bp-spic { height: clamp(40px, 11cqh, 66px); aspect-ratio: 1; flex: none; }
.t-beatpad .bp-spic svg { width: 100%; height: 100%; }
.t-beatpad .bp-sp b { font-size: 22px; font-weight: 800; line-height: 1.1; }

.t-beatpad .bp-zone { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; container-type: size; }
.t-beatpad .bp-wrap { position: relative; width: clamp(340px, 86cqmin, 470px); aspect-ratio: 1; }
.t-beatpad .bp-ring { position: absolute; inset: 0; border-radius: 50%; border: 8px solid var(--fizz); opacity: 0; pointer-events: none; }
.t-beatpad .bp-ring.go { animation: bp-ring .7s ease-out; }
@keyframes bp-ring { from { opacity: .85; transform: scale(.98); } to { opacity: 0; transform: scale(1.22); } }
.t-beatpad .bp-pad {
  position: absolute; inset: 0; border-radius: 50%; border: 5px solid var(--edge); background: var(--fizz); box-shadow: 6px 9px 0 var(--edge);
  display: flex; align-items: center; justify-content: center; padding: 0; cursor: pointer; touch-action: manipulation; transition: filter .2s;
}
.t-beatpad .bp-skin { width: 76%; height: 76%; border-radius: 50%; background: #a78bfa; border: 4px solid var(--fizz-dark); box-shadow: inset 0 10px 0 rgba(255,255,255,.18); display: flex; align-items: center; justify-content: center; transition: background .15s; }
.t-beatpad .bp-hand { width: 30%; height: 30%; color: #fff; opacity: .75; }
.t-beatpad .bp-hand svg { width: 100%; height: 100%; }
.t-beatpad .bp-pad.hit { animation: bp-hit .26s ease-out; filter: brightness(1.25) saturate(1.1); }
.t-beatpad .bp-pad.hit .bp-skin { background: #ddd0ff; }
@keyframes bp-hit { 0% { transform: scale(.92, .86); } 55% { transform: scale(1.03, 1.02); } 100% { transform: none; } }
.t-beatpad .bp-spark { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px; z-index: 3; pointer-events: none; border: 2px solid var(--edge); animation: bp-spark .65s ease-out forwards; }
@keyframes bp-spark { from { transform: translate(var(--x0), var(--y0)) scale(1.1); opacity: 1; } to { transform: translate(var(--x1), var(--y1)) scale(.4) rotate(90deg); opacity: 0; } }

.t-beatpad .bp-play { width: 100%; min-height: clamp(96px, 22cqh, 130px); border-radius: 26px; font-size: clamp(28px, 6cqh, 36px); box-shadow: 0 7px 0 var(--edge); }
.t-beatpad .bp-play svg { width: 1.2em; height: 1.2em; }
.t-beatpad .bp-play.press { transform: translateY(5px); box-shadow: 0 2px 0 var(--edge); }
.t-beatpad .bp-lights { display: flex; justify-content: space-around; align-items: center; padding: 14px 10px; }
.t-beatpad .bp-lights i { width: clamp(22px, 5cqh, 32px); height: clamp(22px, 5cqh, 32px); background: var(--lcd-2); border: 3px solid var(--lcd-dark); }
.t-beatpad .bp-lights i.on { background: var(--lcd-ink); }
@media (prefers-reduced-motion: reduce) { .t-beatpad .bp-ring.go { animation-duration: .01s; } }
`;
