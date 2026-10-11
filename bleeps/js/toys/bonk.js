// Who says bonk? (Mission 1, Make): hear each robot bump a rock, then choose the game's Bump sound.
import { h, injectCSS } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { sfx, ensure, BONKS } from '../core/chip.js';
import { botSVG, sing } from '../core/bots.js';
import { sticker } from '../core/stickers.js';
import { BOTS } from '../core/song.js';
import { burst} from '../core/ui.js';

export function mount(el, props = {}, api) {
  injectCSS('t-bonk', CSS);
  const bots = ['bleep', 'hoot', 'buzz', 'fizz'];
  const saved = api.kit.get('bump');
  let pick = saved ? bots.find(b => BONKS[b].voice === saved.voice) || null : null;
  const root = h(`<div class="t-bonk">
    <div class="bk-grid">${bots.map(b => `<button class="bk-card" type="button" data-bot="${b}" style="--bc:${BOTS[b].col}">
      <span class="bk-scene"><span class="bot">${botSVG(b, { label: false })}</span><span class="rock">${sticker('rock')}</span><span class="pow">BONK!</span></span>
      <span class="name">${BOTS[b].name}</span></button>`).join('')}</div>
    <div class="bk-foot"><span class="bk-pick"></span><button class="btn primary big" type="button" disabled>${icon('check')} Use this bonk</button></div>
  </div>`);
  el.appendChild(root);
  const useBtn = root.querySelector('.bk-foot .btn');
  const pickEl = root.querySelector('.bk-pick');
  function draw() {
    root.querySelectorAll('.bk-card').forEach(c => c.classList.toggle('sel', c.dataset.bot === pick));
    useBtn.disabled = !pick;
    pickEl.textContent = pick ? `${BOTS[pick].name} says bonk!` : 'Tap each robot to hear its bonk.';
  }
  root.querySelectorAll('.bk-card').forEach(c => c.addEventListener('pointerdown', () => {
    ensure();
    const b = c.dataset.bot;
    pick = b;
    c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit');
    setTimeout(() => sfx(BONKS[b]), 180);
    setTimeout(() => sing(c.querySelector('.bot'), 400), 180);
    draw();
  }));
  useBtn.addEventListener('click', () => {
    if (!pick) return;
    api.kit.set('bump', { ...BONKS[pick] });
    api.log(`Chose ${BOTS[pick].name}'s bonk for when our robot bumps a rock.`);
    api.say(`${BOTS[pick].name} will say bonk in our game!`);
    burst(root, useBtn);
    api.done();
  });
  draw();
  return { destroy() {} };
}

const CSS = `
.t-bonk { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px; padding: 14px 24px 18px; }
.t-bonk .bk-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
.t-bonk .bk-card { border: 4px solid var(--edge); border-radius: 26px; background: var(--card); box-shadow: var(--pop); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px; min-height: 0; overflow: hidden; }
.t-bonk .bk-card.sel { background: var(--bc); outline: 6px solid var(--edge); outline-offset: 3px; }
.t-bonk .bk-card .name { font-size: 26px; font-weight: 800; }
.t-bonk .bk-scene { position: relative; flex: 1; min-height: 0; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.t-bonk .bk-scene .bot { height: 78%; max-height: 220px; width: auto; position: relative; z-index: 1; }
.t-bonk .bk-scene .bot svg { height: 100%; width: auto; }
.t-bonk .bk-scene .rock { position: absolute; right: 2%; bottom: 0; width: 34%; max-width: 90px; }
.t-bonk .bk-scene .pow { position: absolute; right: 6%; top: 8%; font-family: var(--pixel); font-size: 18px; color: var(--ink); background: #fff; border: 3px solid var(--edge); border-radius: 10px; padding: 6px 8px; opacity: 0; transform: scale(.4) rotate(-10deg); }
.t-bonk .bk-card.hit .bot { animation: bkrun .45s ease-out; }
.t-bonk .bk-card.hit .pow { animation: bkpow .7s ease-out; }
@keyframes bkrun { 0% { transform: translateX(-40%); } 40% { transform: translateX(18%); } 60% { transform: translateX(-6%) rotate(-6deg); } 100% { transform: none; } }
@keyframes bkpow { 0%, 30% { opacity: 0; transform: scale(.4) rotate(-10deg); } 45% { opacity: 1; transform: scale(1.15) rotate(-6deg); } 85% { opacity: 1; transform: scale(1) rotate(-6deg); } 100% { opacity: 0; } }
.t-bonk .bk-foot { display: flex; align-items: center; justify-content: center; gap: 24px; flex: none; }
.t-bonk .bk-pick { font-size: 26px; font-weight: 700; }
`;
