// The Echo game (Mission 5): call and response on five big magic-note pads.
// Round types alternate: Bleep sings three notes and the crew copies them; then a crew member plays
// three notes and Bleep copies them back. Any answer is welcome; a matching echo gets a sparkle.
import { h, esc, injectCSS } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { note, ensure } from '../core/chip.js';
import { botSVG, sing } from '../core/bots.js';
import { scaleNotes } from '../core/song.js';
import { makePads } from './pads.js';
import { burst} from '../core/ui.js';

export function mount(el, props = {}, api) {
  injectCSS('t-echo', CSS);
  const c = api.crew;
  const notes = scaleNotes('magic', 5);
  const LEN = props.len || 3;
  const order = [['bot', 'commander'], ['copilot', 'bot'], ['bot', 'copilot'], ['commander', 'bot']];
  let round = 0;
  let phase = 'idle';
  let call = [];
  let answer = [];
  let rounds = 0;
  const timers = [];
  const root = h(`<div class="t-echo">
    <div class="ec-top"><div class="ec-bot bot">${botSVG('bleep')}</div><div class="ec-bubble"><div class="ec-text"></div><div class="ec-dots"></div></div><div class="ec-act"></div></div>
    <div class="ec-pads"></div>
  </div>`);
  el.appendChild(root);
  const text = root.querySelector('.ec-text');
  const dots = root.querySelector('.ec-dots');
  const act = root.querySelector('.ec-act');
  const botEl = root.querySelector('.ec-bot');
  const pads = makePads(root.querySelector('.ec-pads'), {
    notes, rows: 1, voice: () => 'bleep', hold: false,
    onPlay: (midi, i) => onPad(i),
  });

  const T = (fn, ms) => timers.push(setTimeout(fn, ms));
  function drawDots(n, filled = 0) { dots.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join(''); }

  function startRound() {
    const [caller, echoer] = order[round % order.length];
    call = []; answer = [];
    act.innerHTML = '';
    if (caller === 'bot') {
      phase = 'listen';
      pads.enable(false);
      text.innerHTML = `Listen to Bleep...`;
      drawDots(LEN, 0);
      api.setWho && api.setWho('everyone');
      // A short, singable call from the magic notes, with small steps.
      let i = Math.floor(Math.random() * 3) + 1;
      for (let k = 0; k < LEN; k++) { call.push(i); i = Math.max(0, Math.min(4, i + [-2, -1, 1, 2, 0][Math.floor(Math.random() * 5)])); }
      T(() => playSeq(call, () => {
        phase = 'answer';
        pads.enable(true);
        text.innerHTML = `Your turn, <b>${esc(c[echoer])}</b>! Copy Bleep.`;
        api.setWho && api.setWho(echoer);
        api.say(`Your turn, ${c[echoer]}! Copy Bleep.`);
        again();
      }), 600);
    } else {
      phase = 'call';
      pads.enable(true);
      text.innerHTML = `<b>${esc(c[caller])}</b>, play ${LEN} notes. Bleep will copy you!`;
      drawDots(LEN, 0);
      api.setWho && api.setWho(caller);
      api.say(`${c[caller]}, play ${LEN} notes. Bleep will copy you!`);
    }
  }
  function again() {
    const b = h(`<button class="btn go" type="button">${icon('play')} Hear it again</button>`);
    b.addEventListener('pointerdown', () => { if (phase === 'answer' && !answer.length) { pads.enable(false); playSeq(call, () => pads.enable(true)); } });
    act.replaceChildren(b);
  }
  function playSeq(list, done) {
    ensure();
    list.forEach((i, k) => T(() => { note({ voice: 'bleep', midi: notes[i], dur: 0.36, duty: 0.5 }); pads.flash(i, 320); sing(botEl, 300); drawDots(list.length, k + 1); }, k * 520));
    T(() => done && done(), list.length * 520 + 200);
  }
  function onPad(i) {
    if (phase === 'answer') {
      answer.push(i);
      drawDots(LEN, answer.length);
      if (answer.length === LEN) {
        phase = 'done';
        pads.enable(false);
        const same = answer.every((x, k) => x === call[k]);
        rounds++;
        if (same) { text.innerHTML = `Same! A perfect echo!`; burst(root, botEl); api.say('Same! A perfect echo!'); }
        else { text.innerHTML = `Ooh, a new tune! Here's Bleep's again.`; api.say("Ooh, you made a new tune! Here's Bleep's again."); T(() => playSeq(call), 1400); }
        api.log(`Echo game: ${same ? 'a perfect echo' : 'a new tune'}.`);
        T(nextButton, same ? 600 : 1400 + LEN * 520);
      }
    } else if (phase === 'call') {
      call.push(i);
      drawDots(LEN, call.length);
      if (call.length === LEN) {
        phase = 'echo';
        pads.enable(false);
        text.innerHTML = `Bleep copies you...`;
        T(() => playSeq(call, () => {
          rounds++;
          text.innerHTML = `Bleep copied you!`;
          api.say('Bleep copied you!');
          T(nextButton, 400);
        }), 700);
      }
    }
    if (rounds >= 3) api.done();
  }
  function nextButton() {
    const b = h(`<button class="btn primary big" type="button">${icon('next')} Next round</button>`);
    b.addEventListener('click', () => { round++; startRound(); });
    act.replaceChildren(b);
    if (rounds >= 3) api.done();
  }
  startRound();
  return { destroy() { timers.forEach(clearTimeout); pads.destroy(); } };
}

const CSS = `
.t-echo { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 18px; padding: 12px 22px 22px; }
.t-echo .ec-top { display: flex; align-items: center; gap: 18px; flex: none; height: 150px; }
.t-echo .ec-bot { height: 100%; width: 130px; display: flex; justify-content: center; }
.t-echo .ec-bot svg { height: 100%; width: auto; }
.t-echo .ec-bubble { flex: 1; background: var(--card); border: 3px solid var(--edge); border-radius: 22px; box-shadow: var(--pop); padding: 14px 22px; display: flex; flex-direction: column; gap: 10px; position: relative; }
.t-echo .ec-bubble::before { content: ''; position: absolute; left: -16px; top: 50%; width: 24px; height: 24px; background: var(--card); border-left: 3px solid var(--edge); border-bottom: 3px solid var(--edge); transform: translateY(-50%) rotate(45deg); }
.t-echo .ec-text { font-size: 28px; line-height: 1.25; }
.t-echo .ec-dots { display: flex; gap: 10px; }
.t-echo .ec-dots i { width: 26px; height: 26px; border-radius: 6px; border: 3px solid var(--edge); background: var(--bg-2); }
.t-echo .ec-dots i.on { background: var(--a); }
.t-echo .ec-act { flex: none; }
.t-echo .ec-pads { flex: 1; min-height: 0; display: flex; }
`;
