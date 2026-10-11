// The Beat Maker (Mission 4, Make): an 8-box drum loop with Boom, Tap and Tss, saved as the crew's Beat.
import { h, injectCSS } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { drum, ensure, stopAll } from '../core/chip.js';
import { Sequencer } from '../core/seq.js';
import { botSVG, sing } from '../core/bots.js';
import { sticker } from '../core/stickers.js';
import { store } from '../core/store.js';
import { SPEEDS, speedIndex } from '../core/song.js';
import { burst} from '../core/ui.js';

const KINDS = [{ k: 'boom', name: 'Boom' }, { k: 'tap', name: 'Tap' }, { k: 'tss', name: 'Tss' }];
const GLYPH = {
  boom: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="currentColor"/></svg>',
  tap: '<svg viewBox="0 0 40 40"><rect x="8" y="8" width="24" height="24" rx="5" fill="currentColor"/></svg>',
  tss: '<svg viewBox="0 0 40 40"><path d="M20 4 24 16 36 20 24 24 20 36 16 24 4 20 16 16Z" fill="currentColor"/></svg>',
};
const SPEED_ART = { snail: 'snail', tortoise: 'tortoise', cat: 'cat', hare: 'hare', rocket: 'rocket' };

export function mount(el, props = {}, api) {
  injectCSS('t-beat', CSS);
  let beat = (api.kit.get('beat') || []).map(x => x.slice());
  const ch = store.state.choices?.speed;
  let speed = ch === 'slow' ? 'tortoise' : ch === 'fast' ? 'hare' : 'cat';
  let seq = null;
  let taps = 0;
  const root = h(`<div class="t-beat">
    <div class="bt-left">
      <div class="bt-grid">${KINDS.map((d, r) => `<div class="bt-row"><button class="bt-lab" type="button" data-r="${r}"><span class="g">${GLYPH[d.k]}</span>${d.name}</button>${Array.from({ length: 8 }, (_, s) => `<button class="bt-cell ${d.k} ${s % 4 === 0 ? 'one' : ''}" type="button" data-r="${r}" data-s="${s}"></button>`).join('')}</div>`).join('')}
      <div class="bt-row nums"><span></span>${Array.from({ length: 8 }, (_, s) => `<span class="pixel">${s + 1}</span>`).join('')}</div></div>
    </div>
    <aside class="bt-side">
      <div class="bt-bot bot">${botSVG('fizz')}</div>
      <button class="btn go bt-play" type="button">${icon('play')}<span class="pixel">PLAY</span></button>
      <button class="btn bt-speed" type="button"></button>
      ${props.slot ? `<button class="btn primary big bt-save" type="button">${icon('save')} Use this beat</button>` : ''}
    </aside>
  </div>`);
  el.appendChild(root);
  const has = (s, r) => beat.some(b => b[0] === s && b[1] === r);
  function draw(now = -1) {
    root.querySelectorAll('.bt-cell').forEach(c => {
      const s = +c.dataset.s, r = +c.dataset.r;
      c.classList.toggle('on', has(s, r));
      c.classList.toggle('now', s === now);
      c.innerHTML = has(s, r) ? GLYPH[KINDS[r].k] : '';
    });
    const sp = SPEEDS[speedIndex(speed)];
    root.querySelector('.bt-speed').innerHTML = `<span class="stk">${sticker(SPEED_ART[sp.id])}</span><span>${sp.name}</span>`;
    const pb = root.querySelector('.bt-play');
    pb.className = `btn bt-play ${seq ? 'primary' : 'go'}`;
    pb.innerHTML = `${icon(seq ? 'stop' : 'play')}<span class="pixel">${seq ? 'STOP' : 'PLAY'}</span>`;
  }
  root.querySelector('.bt-grid').addEventListener('pointerdown', e => {
    ensure();
    const lab = e.target.closest('.bt-lab');
    if (lab) { drum(KINDS[+lab.dataset.r].k); return; }
    const c = e.target.closest('.bt-cell');
    if (!c) return;
    const s = +c.dataset.s, r = +c.dataset.r;
    if (has(s, r)) beat = beat.filter(b => !(b[0] === s && b[1] === r));
    else { beat.push([s, r]); drum(KINDS[r].k); taps++; }
    draw();
    if (!props.slot && taps >= 6) api.done(false);
  });
  root.querySelector('.bt-play').addEventListener('pointerdown', e => {
    e.preventDefault();
    if (seq) { seq.stop(); seq = null; draw(); return; }
    ensure();
    seq = new Sequencer({
      steps: () => 8,
      stepDur: () => 30 / SPEEDS[speedIndex(speed)].bpm,
      schedule: (s, t) => { for (const [st, r] of beat) if (st === s) drum(KINDS[r].k, t); },
      onStep: s => { draw(s); if (beat.some(b => b[0] === s)) sing(root.querySelector('.bt-bot'), 200); },
      loop: true,
    });
    seq.start();
    draw();
  });
  root.querySelector('.bt-speed').addEventListener('pointerdown', () => { speed = SPEEDS[(speedIndex(speed) + 1) % SPEEDS.length].id; drum('tap'); draw(); });
  root.querySelector('.bt-save')?.addEventListener('click', () => {
    if (!beat.length) { api.say('Tap some boxes first!'); return; }
    api.kit.set('beat', beat.map(b => b.slice()).sort((a, b) => a[0] - b[0]));
    api.log(`Made our beat: ${beat.length} drum hits in 8 boxes.`);
    api.say('Saved! That is our beat.');
    burst(root, root.querySelector('.bt-save'));
    api.done();
  });
  draw();
  return { destroy() { if (seq) seq.stop(); stopAll(); } };
}

const CSS = `
.t-beat { flex: 1; min-height: 0; display: flex; gap: 18px; padding: 14px 18px 18px; }
.t-beat .bt-left { flex: 1; min-width: 0; display: flex; }
.t-beat .bt-grid { flex: 1; display: flex; flex-direction: column; gap: 12px; }
.t-beat .bt-row { flex: 1; min-height: 0; display: grid; grid-template-columns: 120px repeat(8, 1fr); gap: 10px; }
.t-beat .bt-row.nums { flex: none; height: 26px; }
.t-beat .bt-row.nums span { text-align: center; font-size: 13px; color: var(--ink-3); }
.t-beat .bt-lab { border: 3px solid var(--edge); border-radius: 16px; background: var(--card); font-weight: 800; font-size: 22px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; color: var(--ink); }
.t-beat .bt-lab .g { width: 30px; height: 30px; color: var(--fizz); display: flex; }
.t-beat .bt-cell { border: 3px solid #d9d1c0; border-radius: 18px; background: #fffdf8; cursor: pointer; color: var(--fizz-dark); display: flex; align-items: center; justify-content: center; min-height: 0; padding: 0; }
.t-beat .bt-cell.one:not(.on) { background: #f3eee3; }
.t-beat .bt-cell svg { width: 54%; height: 54%; max-width: 54px; }
.t-beat .bt-cell.on { background: var(--fizz-soft); border-color: var(--fizz-dark); }
.t-beat .bt-cell.now { outline: 4px solid var(--ink); }
.t-beat .bt-cell.on.now { background: var(--fizz); color: #fff; transform: scale(1.06); }
.t-beat .bt-side { width: 200px; flex: none; display: flex; flex-direction: column; gap: 12px; }
.t-beat .bt-bot { height: 150px; width: 100%; display: flex; justify-content: center; }
.t-beat .bt-bot svg { height: 100%; width: auto; }
.t-beat .bt-play { min-height: 96px; flex-direction: column; font-size: 18px; border-radius: 22px; }
.t-beat .bt-play svg { width: 40px; height: 40px; }
.t-beat .bt-speed { flex-direction: column; min-height: 84px; gap: 2px; font-size: 18px; }
.t-beat .bt-speed .stk { width: 44px; height: 44px; display: flex; }
.t-beat .bt-save { white-space: normal; line-height: 1.1; padding: 0 12px; }
`;
