// High and Low: a movement game for everyone (Mission 3).
// The grown-up plays high and low notes; the children stretch up tall for high and crouch down small for low.
// "Surprise!" plays one at random after a "Ready..." pause without showing which, then reveals it 1.5 s later,
// so the children have to listen and move first.
// props: none. Done after 6 sounds.
import { ensure, now, note, drum } from '../core/chip.js';
import { botSVG, sing } from '../core/bots.js';
import { sticker } from '../core/stickers.js';
import { icon } from '../core/icons.js';
import { h, esc, injectCSS } from '../core/dom.js';
import { isSpeaking, onSpeaking } from '../core/ui.js';

const HIGHS = [84, 86, 88, 91]; // C6 D6 E6 G6
const LOWS = [36, 38, 40, 43];  // C2 D2 E2 G2
const GOAL = 6;
const START_LINE = "When the sound is high, stretch up tall. When it's low, crouch down small!";

export function mount(el, props = {}, api) {
  injectCSS('t-highlow', CSS);
  const eng = (api.crew && api.crew.engineer) || 'Grown-up';
  const root = h(`<div class="t-highlow">
    <div class="hl-main">
      <button class="hl-big hl-high" type="button" aria-label="Play a high note">
        <span class="hl-pic">${sticker('mouse')}</span>
        <span class="hl-lab">${icon('up')}High</span>
      </button>
      <div class="hl-stage">
        <div class="hl-word hl-wh" aria-hidden="true"><span>HIGH!</span></div>
        <div class="hl-zone"><div class="bot hl-bot" data-bot="hoot">${botSVG('hoot')}</div></div>
        <div class="hl-ground hl-wl" aria-hidden="true"><span>LOW!</span></div>
        <div class="hl-over" aria-live="polite"><div class="lcd"><span class="hl-ov-pic"></span><span class="hl-ov-t"></span></div></div>
      </div>
      <button class="hl-big hl-low" type="button" aria-label="Play a low note">
        <span class="hl-pic">${sticker('bear')}</span>
        <span class="hl-lab">${icon('down')}Low</span>
      </button>
    </div>
    <div class="hl-foot">
      <span class="hl-tip"><b>${esc(eng)}:</b> play a mystery sound</span>
      <button class="btn big primary hl-surprise" type="button">${icon('shuffle')}Surprise!</button>
    </div>
  </div>`);
  el.appendChild(root);

  const $ = s => root.querySelector(s);
  const stage = $('.hl-stage'), bot = $('.hl-bot'), wh = $('.hl-wh'), wl = $('.hl-wl');
  const highBtn = $('.hl-high'), lowBtn = $('.hl-low'), surpriseBtn = $('.hl-surprise');
  const over = $('.hl-over'), ovPic = $('.hl-ov-pic'), ovT = $('.hl-ov-t');

  let count = 0, finished = false, lastHigh = 0, lastLow = 0;
  let poseT = 0, litT = 0, surprising = false, sTimers = [];
  const history = [];
  const cleanups = [];

  const pick = (list, last) => { const o = list.filter(m => m !== last); return o[Math.floor(Math.random() * o.length)]; };
  const counted = () => { count++; if (count >= GOAL && !finished) { finished = true; api.done(); } };

  // The two sounds. Picks a slightly different note each time.
  function sound(which) {
    ensure();
    const t = now() + 0.005;
    if (which === 'high') {
      const m = pick(HIGHS, lastHigh); lastHigh = m;
      const quick = { a: 0.002, d: 0.05, s: 0.8, r: 0.03 };
      note({ voice: 'bleep', duty: 0.25, midi: m, at: t, dur: 0.1, vol: 0.85, env: quick });
      note({ voice: 'bleep', duty: 0.25, midi: m, at: t + 0.15, dur: 0.1, vol: 0.85, env: quick });
      note({ voice: 'bleep', duty: 0.5, midi: m, at: t + 0.3, dur: 0.46, vol: 0.85, env: { a: 0.003, d: 0.2, s: 0.7, r: 0.08 } });
    } else {
      const m = pick(LOWS, lastLow); lastLow = m;
      note({ voice: 'hoot', midi: m, at: t, dur: 0.95, vol: 1, env: { a: 0.01, d: 0.3, s: 0.85, r: 0.12 } });
      // A soft square underneath so the deep note still carries on a small tablet speaker.
      note({ voice: 'bleep', duty: 0.5, midi: m, at: t, dur: 0.9, vol: 0.3, env: { a: 0.01, d: 0.3, s: 0.6, r: 0.1 } });
    }
  }

  function retrigger(w, on) {
    w.classList.remove('show');
    if (on) { void w.offsetWidth; w.classList.add('show'); }
  }
  function resetPose() {
    clearTimeout(poseT);
    stage.classList.remove('high', 'low');
    wh.classList.remove('show'); wl.classList.remove('show');
  }
  function pose(which) {
    clearTimeout(poseT);
    stage.classList.remove('high', 'low');
    stage.classList.add(which);
    retrigger(wh, which === 'high');
    retrigger(wl, which === 'low');
    sing(bot, which === 'high' ? 800 : 1000);
    poseT = setTimeout(resetPose, 2600);
  }
  function light(btn) {
    clearTimeout(litT);
    highBtn.classList.remove('lit'); lowBtn.classList.remove('lit');
    btn.classList.add('lit');
    litT = setTimeout(() => btn.classList.remove('lit'), 2600);
  }

  function showOver(text, pic = '') {
    ovT.textContent = text;
    ovPic.innerHTML = pic;
    ovPic.style.display = pic ? '' : 'none';
    over.classList.add('show');
  }
  function cancelSurprise() {
    sTimers.forEach(clearTimeout); sTimers = [];
    surprising = false;
    over.classList.remove('show');
    surpriseBtn.classList.remove('busy');
  }
  function chooseSurprise() {
    let w = Math.random() < 0.5 ? 'high' : 'low';
    const n = history.length;
    if (n >= 2 && history[n - 1] === history[n - 2] && history[n - 1] === w) w = w === 'high' ? 'low' : 'high';
    history.push(w);
    return w;
  }

  function direct(which) {
    cancelSurprise();
    sound(which);
    pose(which);
    counted();
  }
  function surprise() {
    drum('tss'); // the touch makes a sound straight away
    if (surprising) return;
    surprising = true;
    surpriseBtn.classList.add('busy');
    resetPose();
    clearTimeout(litT); highBtn.classList.remove('lit'); lowBtn.classList.remove('lit');
    const which = chooseSurprise();
    showOver('Ready...');
    sTimers.push(setTimeout(() => { sound(which); showOver('Listen!', sticker('ear')); }, 1000));
    sTimers.push(setTimeout(() => {
      over.classList.remove('show');
      surprising = false;
      surpriseBtn.classList.remove('busy');
      pose(which);
      light(which === 'high' ? highBtn : lowBtn);
      api.say(which === 'high' ? 'Stretch up high!' : 'Crouch down low!');
      counted();
    }, 2500));
  }

  cleanups.push(tap(highBtn, () => direct('high')));
  cleanups.push(tap(lowBtn, () => direct('low')));
  cleanups.push(tap(surpriseBtn, surprise));
  cleanups.push(tap(bot, () => direct(Math.random() < 0.5 ? 'high' : 'low')));

  api.setWho && api.setWho('everyone');
  cleanups.push(sayStart(api, props, START_LINE));

  return {
    destroy() {
      cancelSurprise();
      clearTimeout(poseT); clearTimeout(litT);
      cleanups.forEach(f => f && f());
    },
  };
}

// Sound on pointerdown (not click); keyboard Enter/Space still works through click.
function tap(el, fn) {
  const down = e => {
    if (e.button > 0) return;
    e.preventDefault();
    el.classList.add('press');
    fn(e);
  };
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
.t-highlow { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px; padding: 18px 24px; container-type: size; }
.t-highlow .hl-main { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr minmax(0, 1.1fr) 1fr; gap: clamp(14px, 2.2cqw, 26px); }
.t-highlow .hl-big {
  position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(8px, 3cqh, 22px); padding: 16px; border: 3px solid var(--edge); border-radius: 28px; box-shadow: 0 7px 0 var(--edge);
  cursor: pointer; font: inherit; color: var(--ink); touch-action: manipulation; transition: transform .07s, box-shadow .07s, outline-color .2s;
  outline: 6px solid transparent; outline-offset: 4px;
}
.t-highlow .hl-big.press { transform: translateY(5px); box-shadow: 0 2px 0 var(--edge); }
.t-highlow .hl-big:focus-visible { outline-color: var(--a); }
.t-highlow .hl-big.lit { outline-color: var(--go); }
.t-highlow .hl-high { background: #ffe28a; }
.t-highlow .hl-low { background: var(--hoot-dark); color: #fff; }
.t-highlow .hl-pic { width: min(72%, 44cqh); aspect-ratio: 1; flex: none; border-radius: 50%; background: #fff; border: 3px solid var(--edge); display: flex; align-items: center; justify-content: center; }
.t-highlow .hl-low .hl-pic { background: #dde9ff; }
.t-highlow .hl-pic svg { width: 76%; height: 76%; }
.t-highlow .hl-lab { display: flex; align-items: center; gap: 8px; font-size: clamp(30px, 7cqh, 46px); font-weight: 800; line-height: 1; }
.t-highlow .hl-lab svg { width: 1.05em; height: 1.05em; stroke-width: 3.2; }

.t-highlow .hl-stage { position: relative; min-width: 0; min-height: 0; border: 3px solid var(--edge); border-radius: 28px; box-shadow: var(--pop); overflow: hidden; display: flex; flex-direction: column; background: #dff1ff; transition: background .4s; }
.t-highlow .hl-stage.high { background: #fff3c4; }
.t-highlow .hl-stage.low { background: #c9dcff; }
.t-highlow .hl-word, .t-highlow .hl-ground { flex: none; height: clamp(50px, 13cqh, 92px); display: flex; align-items: center; justify-content: center; font-family: var(--pixel); font-size: clamp(24px, 6cqh, 40px); }
.t-highlow .hl-word span, .t-highlow .hl-ground span { display: inline-block; opacity: 0; transform: scale(.3); transition: opacity .15s, transform .45s cubic-bezier(.34, 1.56, .64, 1); }
.t-highlow .hl-word.show span, .t-highlow .hl-ground.show span { opacity: 1; transform: none; }
.t-highlow .hl-word span { color: var(--ink); text-shadow: 3px 3px 0 #fff; }
.t-highlow .hl-ground { background: #cfc4ad; border-top: 4px solid var(--edge); box-shadow: inset 0 6px 0 #b9ad94; }
.t-highlow .hl-ground span { color: #fff; text-shadow: 3px 3px 0 var(--edge); }
.t-highlow .hl-zone { flex: 1; min-height: 0; position: relative; display: flex; align-items: flex-end; justify-content: center; }
.t-highlow .hl-bot { height: 60%; aspect-ratio: 120 / 140; margin-bottom: -2%; transform-origin: 50% 100%; transition: transform .6s cubic-bezier(.34, 1.56, .64, 1); }
.t-highlow .hl-bot .botsvg { width: 100%; height: 100%; }
.t-highlow .hl-stage.high .hl-bot { transform: translateY(-16%) scale(.86, 1.34); }
.t-highlow .hl-stage.low .hl-bot { transform: scale(1.28, .58); }
.t-highlow .hl-over { position: absolute; inset: 0; z-index: 3; display: flex; align-items: center; justify-content: center; background: rgba(27, 27, 36, .28); opacity: 0; pointer-events: none; transition: opacity .2s; }
.t-highlow .hl-over.show { opacity: 1; }
.t-highlow .hl-over .lcd { padding: 16px 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: clamp(20px, 4.5cqh, 30px); box-shadow: var(--pop); }
.t-highlow .hl-ov-pic { width: clamp(56px, 14cqh, 96px); height: clamp(56px, 14cqh, 96px); animation: hl-throb .7s ease-in-out infinite; }
@keyframes hl-throb { 50% { transform: scale(1.1); } }

.t-highlow .hl-foot { flex: none; display: flex; align-items: center; justify-content: center; gap: 18px; flex-wrap: wrap; }
.t-highlow .hl-tip { font-size: 22px; color: var(--ink-2); }
.t-highlow .hl-tip b { color: var(--eng); }
.t-highlow .hl-surprise.busy { opacity: .6; }
@container (max-height: 470px) {
  .t-highlow .hl-foot .btn.big { min-height: 64px; font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .t-highlow .hl-bot { transition-duration: .01s; }
}
`;
