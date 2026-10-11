// Wake up the Bleep Bots (Mission 1, the Co-pilot's turn): tap each sleeping robot; it wakes and sings.
import { h, injectCSS } from '../core/dom.js';
import { hello, ensure, sfx } from '../core/chip.js';
import { botSVG, sing } from '../core/bots.js';
import { BOTS } from '../core/song.js';


export function mount(el, props = {}, api) {
  injectCSS('t-wake', CSS);
  const bots = props.bots || ['bleep', 'hoot', 'buzz', 'fizz'];
  const awake = new Set();
  const timers = [];
  const root = h(`<div class="t-wake"><div class="wk-stage">${bots.map(b => `<button class="bot wk" type="button" data-bot="${b}" aria-label="Wake up ${BOTS[b].name}"><span class="art">${botSVG(b, { sleep: true, label: false })}</span><span class="name">?</span></button>`).join('')}</div><div class="wk-floor"></div></div>`);
  el.appendChild(root);
  root.querySelectorAll('.wk').forEach(b => b.addEventListener('pointerdown', () => {
    ensure();
    const id = b.dataset.bot;
    if (!awake.has(id)) {
      awake.add(id);
      b.querySelector('.art').innerHTML = botSVG(id, { label: false });
      b.querySelector('.name').textContent = BOTS[id].name;
      b.classList.add('up');
      sfx({ voice: 'bleep', duty: 0.5, from: 60, to: 84, len: 0.18 });
      timers.push(setTimeout(() => { const len = hello(id); sing(b, Math.max(700, len * 1000)); }, 220));
      timers.push(setTimeout(() => api.say(`${BOTS[id].name}!`), 900));
      if (awake.size === bots.length) {
        timers.push(setTimeout(() => {
          bots.forEach((x, i) => timers.push(setTimeout(() => { hello(x); sing(root.querySelector(`.wk[data-bot="${x}"]`), 800); }, i * 260)));
          timers.push(setTimeout(() => { api.say('All awake! Hello, Bleep Bots!'); api.done(); }, bots.length * 260 + 700));
        }, 1600));
      }
    } else {
      const len = hello(id);
      sing(b, Math.max(600, len * 1000));
    }
  }));
  return { destroy() { timers.forEach(clearTimeout); } };
}

const CSS = `
.t-wake { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 10px 30px 0; background: linear-gradient(#2a2440, #1b1b2e); margin: 12px 18px 18px; border: 3px solid var(--edge); border-radius: 26px; box-shadow: var(--pop); overflow: hidden; }
.t-wake .wk-stage { flex: 1; min-height: 0; display: flex; align-items: flex-end; justify-content: space-around; gap: 10px; }
.t-wake .wk { width: 22%; max-width: 230px; height: 100%; justify-content: flex-end; background: none; border: 0; padding: 0 0 6px; cursor: pointer; filter: saturate(.55) brightness(.85); transition: filter .3s; }
.t-wake .wk.up { filter: none; }
.t-wake .wk .art { display: block; width: 100%; max-height: calc(100% - 40px); }
.t-wake .wk .art svg { width: 100%; height: 100%; }
.t-wake .wk .name { color: #fff; font-weight: 800; font-size: 26px; min-height: 34px; }
.t-wake .wk-floor { height: 26px; margin: 0 -30px; background: repeating-linear-gradient(90deg, #3a3358 0 26px, #332d4f 26px 52px); border-top: 3px solid #120f1f; }
`;
