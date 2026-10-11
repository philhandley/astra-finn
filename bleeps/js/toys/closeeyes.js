// Close your eyes! (Mission 1, everyone): one crew member secretly taps a robot, the other listens and guesses.
import { h, esc, injectCSS } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { hello, ensure } from '../core/chip.js';
import { botSVG, sing } from '../core/bots.js';
import { sticker } from '../core/stickers.js';
import { BOTS } from '../core/song.js';


export function mount(el, props = {}, api) {
  injectCSS('t-eyes', CSS);
  const bots = props.bots || ['bleep', 'hoot', 'buzz', 'fizz'];
  const c = api.crew;
  const pairs = [['copilot', 'commander'], ['commander', 'copilot'], ['engineer', 'commander']];
  let round = 0;
  let phase = 'hide';
  let secret = null;
  const timers = [];
  const root = h(`<div class="t-eyes">
    <div class="ey-msg"><div class="ey-ic"></div><div class="ey-text"></div><div class="ey-act"></div></div>
    <div class="ey-bots">${bots.map(b => `<button class="ey-bot" type="button" data-bot="${b}"><span class="cover">?</span><span class="art bot">${botSVG(b, { label: false })}</span><span class="name">${BOTS[b].name}</span></button>`).join('')}</div>
  </div>`);
  el.appendChild(root);
  const msg = root.querySelector('.ey-text');
  const ic = root.querySelector('.ey-ic');
  const act = root.querySelector('.ey-act');

  function show() {
    const [maker, guesser] = pairs[round % pairs.length];
    root.classList.toggle('hidden-bots', phase === 'guess');
    root.querySelectorAll('.ey-bot').forEach(b => b.classList.remove('secret'));
    act.innerHTML = '';
    if (phase === 'hide') {
      ic.innerHTML = sticker('sleep');
      msg.innerHTML = `<b>${esc(c[guesser])}</b>, close your eyes!<br><b>${esc(c[maker])}</b>, tap a secret robot.`;
      api.setWho && api.setWho(maker);
      api.say(`${c[guesser]}, close your eyes! ${c[maker]}, tap a secret robot.`);
    } else if (phase === 'guess') {
      ic.innerHTML = sticker('eyes');
      msg.innerHTML = `Open your eyes, <b>${esc(c[guesser])}</b>! Who sang?`;
      const again = h(`<button class="btn go big" type="button">${icon('play')} Hear it again</button>`);
      again.addEventListener('pointerdown', () => { ensure(); hello(secret); });
      act.appendChild(again);
      api.setWho && api.setWho(guesser);
      api.say(`Open your eyes, ${c[guesser]}! Who sang?`);
    } else if (phase === 'reveal') {
      ic.innerHTML = sticker('happy');
      act.appendChild(nextBtn());
    }
  }
  function nextBtn() {
    const b = h(`<button class="btn primary big" type="button">${icon('refresh')} Swap and play again</button>`);
    b.addEventListener('click', () => { round++; phase = 'hide'; show(); });
    return b;
  }
  root.querySelectorAll('.ey-bot').forEach(b => b.addEventListener('pointerdown', () => {
    ensure();
    const id = b.dataset.bot;
    if (phase === 'hide') {
      secret = id;
      phase = 'guess';
      root.classList.add('hidden-bots');
      hello(id);
      timers.push(setTimeout(show, 700));
    } else if (phase === 'guess') {
      phase = 'reveal';
      root.classList.remove('hidden-bots');
      const sb = root.querySelector(`.ey-bot[data-bot="${secret}"]`);
      sb.classList.add('secret');
      timers.push(setTimeout(() => { hello(secret); sing(sb.querySelector('.bot'), 900); }, 250));
      const right = id === secret;
      msg.innerHTML = right ? `Yes! It was <b>${BOTS[secret].name}</b>. Brilliant listening!` : `Ooh! It was <b>${BOTS[secret].name}</b>. Listen...`;
      timers.push(setTimeout(() => api.say(right ? `Yes! It was ${BOTS[secret].name}. Brilliant listening!` : `Ooh, it was ${BOTS[secret].name}! Listen.`), 1100));
      api.log(`Close your eyes: ${BOTS[secret].name} sang and ${c[pairs[round % pairs.length][1]]} ${right ? 'heard it' : 'guessed ' + BOTS[id].name}.`);
      if (round >= 1) api.done();
      show();
      root.querySelectorAll('.ey-bot').forEach(x => x.classList.toggle('secret', x.dataset.bot === secret));
    } else {
      hello(id);
      sing(b.querySelector('.bot'), 600);
    }
  }));
  show();
  return { destroy() { timers.forEach(clearTimeout); } };
}

const CSS = `
.t-eyes { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 18px; padding: 14px 26px 22px; }
.t-eyes .ey-msg { display: flex; align-items: center; gap: 18px; background: var(--card); border: 3px solid var(--edge); border-radius: 22px; box-shadow: var(--pop); padding: 12px 20px; flex: none; }
.t-eyes .ey-ic { width: 76px; height: 76px; flex: none; }
.t-eyes .ey-text { flex: 1; font-size: 28px; line-height: 1.3; }
.t-eyes .ey-bots { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
.t-eyes .ey-bot { position: relative; border: 4px solid var(--edge); border-radius: 26px; background: var(--card); box-shadow: var(--pop); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px; min-height: 0; overflow: hidden; }
.t-eyes .ey-bot .art { flex: 1; min-height: 0; width: 100%; display: flex; justify-content: center; }
.t-eyes .ey-bot .art svg { height: 100%; width: auto; max-width: 100%; }
.t-eyes .ey-bot .name { font-weight: 800; font-size: 24px; }
.t-eyes .ey-bot .cover { position: absolute; inset: 0; background: repeating-linear-gradient(45deg, #4b4b5c 0 18px, #43435a 18px 36px); color: #fff; font-family: var(--pixel); font-size: 64px; display: none; align-items: center; justify-content: center; z-index: 2; }
.t-eyes.hidden-bots .ey-bot .cover { display: flex; }
.t-eyes .ey-bot.secret { outline: 7px solid var(--go); outline-offset: 3px; }
`;
