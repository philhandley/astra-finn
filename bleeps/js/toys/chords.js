// Chord Blocks: put four chord blocks in a row and they loop, with a bass and a little beat.
// Play the magic-note pads on top. props: { slot: 'chords' } saves the loop for the crew's song.
import { h, esc, injectCSS } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { note, drum, ensure, stopAll } from '../core/chip.js';
import { Sequencer } from '../core/seq.js';
import { sticker } from '../core/stickers.js';
import { CHORDS, STARTER_CHORDS, CHORD_KEYS, SPEEDS, speedIndex, scaleNotes } from '../core/song.js';
import { makePads } from './pads.js';
import { burst} from '../core/ui.js';

const SPEED_ART = { snail: 'snail', tortoise: 'tortoise', cat: 'cat', hare: 'hare', rocket: 'rocket' };
const art = key => { const c = CHORDS[key]; if (!c) return 'note'; return c.icon === 'cloud' ? (key === 'cloudy' ? 'greycloud' : 'rain') : c.icon; };

export function mount(el, props = {}, api) {
  injectCSS('t-chords', CSS);
  const saved = api.kit.get('chords');
  let loop = (props.slot && saved && saved.length === 4 ? saved : ['home', 'sunny', 'ready', 'home']).slice();
  let sel = 0;
  let style = 'sparkle';
  let speed = 'cat';
  let seq = null;
  let placed = 0;
  let plays = 0;
  const palette = props.all || props.studio ? CHORD_KEYS : STARTER_CHORDS;

  const root = h(`<div class="t-chords">
    <div class="cb-left">
      <div class="cb-loop"></div>
      <div class="cb-pal">${palette.map(k => { const c = CHORDS[k]; return `<button class="cb-chip" type="button" data-k="${k}" style="background:${c.col};color:${c.ink}"><span class="a">${sticker(art(k))}</span><b>${c.name}</b><small>${c.mood === 'sad' ? 'a bit sad' : 'happy'}</small></button>`; }).join('')}</div>
      <div class="cb-pads"></div>
    </div>
    <aside class="cb-side">
      <button class="btn go cb-play" type="button">${icon('play')}<span class="pixel">PLAY</span></button>
      <button class="btn cb-speed" type="button"></button>
      <button class="btn cb-style" type="button"></button>
      <div class="grow"></div>
      ${props.slot ? `<button class="btn primary big cb-save" type="button">${icon('save')} Use for our song</button>` : ''}
    </aside>
  </div>`);
  el.appendChild(root);
  const loopEl = root.querySelector('.cb-loop');
  const playBtn = root.querySelector('.cb-play');

  function drawLoop(now = -1) {
    loopEl.innerHTML = loop.map((k, i) => {
      const c = CHORDS[k];
      return `<button class="cb-slot ${i === sel ? 'sel' : ''} ${i === now ? 'now' : ''}" type="button" data-i="${i}" style="${c ? `background:${c.col};color:${c.ink}` : ''}">
        <span class="n">${i + 1}</span>${c ? `<span class="a">${sticker(art(k))}</span><b>${c.name}</b>` : `<span class="empty">${icon('plus')}</span>`}</button>`;
    }).join('');
  }
  function drawSide() {
    const sp = SPEEDS[speedIndex(speed)];
    root.querySelector('.cb-speed').innerHTML = `<span class="stk">${sticker(SPEED_ART[sp.id])}</span><span>${sp.name}</span>`;
    root.querySelector('.cb-style').innerHTML = `${icon(style === 'sparkle' ? 'sparkle' : 'wave')}<span>${style === 'sparkle' ? 'Sparkle' : 'Smooth'}</span>`;
    playBtn.className = `btn cb-play ${seq ? 'primary' : 'go'}`;
    playBtn.innerHTML = `${icon(seq ? 'stop' : 'play')}<span class="pixel">${seq ? 'STOP' : 'PLAY'}</span>`;
  }
  function chordSound(key, t, dur) {
    const c = CHORDS[key];
    if (!c) return;
    if (style === 'sparkle') note({ voice: 'bleep', duty: 0.25, midi: c.root + 12, arp: c.iv.concat(c.iv[0] + 12), arpRate: 1 / 24, at: t, dur: dur * 0.96, vol: 0.55, bus: 'chords' });
    else c.iv.forEach(iv => note({ voice: 'hoot', midi: c.root + 12 + iv, at: t, dur: dur * 0.96, vol: 0.55, bus: 'chords' }));
  }
  function preview(key) {
    ensure();
    const c = CHORDS[key];
    chordSound(key, undefined, 1.0);
    note({ voice: 'hoot', midi: c.root - 12, dur: 1.0, vol: 0.9, bus: 'bass' });
  }

  loopEl.addEventListener('pointerdown', e => {
    const b = e.target.closest('.cb-slot');
    if (!b) return;
    sel = +b.dataset.i;
    if (loop[sel]) preview(loop[sel]);
    drawLoop();
  });
  root.querySelectorAll('.cb-chip').forEach(b => b.addEventListener('pointerdown', () => {
    const k = b.dataset.k;
    preview(k);
    loop[sel] = k;
    placed++;
    sel = (sel + 1) % 4;
    drawLoop();
    if (placed === 1) api.say('Now press Play to hear your loop!');
    check();
  }));
  root.querySelector('.cb-speed').addEventListener('pointerdown', () => { speed = SPEEDS[(speedIndex(speed) + 1) % SPEEDS.length].id; drum('tap'); drawSide(); });
  root.querySelector('.cb-style').addEventListener('pointerdown', () => { style = style === 'sparkle' ? 'smooth' : 'sparkle'; drawSide(); preview(loop[0] || 'home'); });
  playBtn.addEventListener('pointerdown', e => { e.preventDefault(); seq ? stop() : play(); });

  function play() {
    ensure();
    const stepDur = () => 30 / SPEEDS[speedIndex(speed)].bpm;
    seq = new Sequencer({
      steps: () => 16,
      stepDur,
      schedule: (st, t, d) => {
        const slot = Math.floor(st / 4);
        const key = loop[slot];
        const c = CHORDS[key];
        if (st % 4 === 0 && c) {
          chordSound(key, t, d * 4);
          note({ voice: 'hoot', midi: c.root - 12, at: t, dur: d * 1.7, vol: 0.9, bus: 'bass' });
          note({ voice: 'hoot', midi: c.root - 5, at: t + d * 2, dur: d * 1.6, vol: 0.8, bus: 'bass' });
        }
        if (st % 8 === 0) drum('boom', t, { vol: 0.7 });
        if (st % 8 === 4) drum('tap', t, { vol: 0.6 });
        if (st % 2 === 0) drum('tss', t, { vol: 0.5 });
      },
      onStep: st => { if (st % 4 === 0) drawLoop(Math.floor(st / 4)); },
      loop: true,
    });
    seq.start();
    plays++;
    drawSide();
    check();
  }
  function stop() { if (seq) { seq.stop(); seq = null; } drawLoop(); drawSide(); }
  function check() {
    if (!props.slot && plays >= 1 && placed >= 2) api.done(false);
  }

  const pads = makePads(root.querySelector('.cb-pads'), { notes: scaleNotes('magic', 8), rows: 1, voice: () => 'buzz', labels: false });

  root.querySelector('.cb-save')?.addEventListener('click', () => {
    if (loop.some(k => !CHORDS[k])) { api.say('Fill all four blocks first!'); return; }
    api.kit.set('chords', loop.slice());
    api.log(`Made our chord loop: ${loop.map(k => CHORDS[k].name).join(', ')}.`);
    api.toast('Saved! Our song will use these chords.');
    api.say('Saved! Our song will use these chords.');
    burst(root, root.querySelector('.cb-save'));
    api.done();
  });

  drawLoop();
  drawSide();
  return { destroy() { if (seq) seq.stop(); pads.destroy(); stopAll(); } };
}

const CSS = `
.t-chords { flex: 1; min-height: 0; display: flex; gap: 16px; padding: 14px 16px 18px; }
.t-chords .cb-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.t-chords .cb-loop { flex: 1.25; min-height: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.t-chords .cb-slot { position: relative; border: 4px solid var(--edge); border-radius: 24px; background: #fffdf8; box-shadow: var(--pop); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 24px; min-height: 0; }
.t-chords .cb-slot.sel { outline: 5px dashed var(--a); outline-offset: 4px; }
.t-chords .cb-slot.now { transform: translateY(-6px) scale(1.03); box-shadow: 6px 10px 0 var(--edge); }
.t-chords .cb-slot .n { position: absolute; top: 10px; left: 12px; font-family: var(--pixel); font-size: 13px; background: var(--ink); color: #fff; padding: 5px 7px; border-radius: 6px; }
.t-chords .cb-slot .a { width: min(110px, 60%); aspect-ratio: 1; display: flex; }
.t-chords .cb-slot .a svg { width: 100%; height: 100%; }
.t-chords .cb-slot .empty svg { width: 54px; height: 54px; color: #c4baa6; }
.t-chords .cb-pal { flex: .8; min-height: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
.t-chords .cb-chip { border: 3px solid var(--edge); border-radius: 20px; box-shadow: 0 5px 0 var(--edge); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 21px; padding: 6px 10px; min-height: 0; }
.t-chords .cb-chip:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--edge); }
.t-chords .cb-chip .a { width: 52px; height: 52px; flex: none; display: flex; }
.t-chords .cb-chip small { display: none; }
.t-chords .cb-pads { flex: .75; min-height: 0; display: flex; }
.t-chords .cb-side { width: 190px; flex: none; display: flex; flex-direction: column; gap: 12px; }
.t-chords .cb-play { min-height: 100px; flex-direction: column; font-size: 18px; border-radius: 22px; }
.t-chords .cb-play svg { width: 42px; height: 42px; }
.t-chords .cb-speed, .t-chords .cb-style { flex-direction: column; min-height: 84px; gap: 2px; font-size: 18px; }
.t-chords .cb-speed .stk { width: 44px; height: 44px; display: flex; }
.t-chords .cb-style svg { width: 34px; height: 34px; }
.t-chords .cb-save { white-space: normal; line-height: 1.1; padding: 0 12px; }
@media (max-width: 900px) { .t-chords .cb-side { width: 150px; } }
`;
