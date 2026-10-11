// The Jukebox: the crew's songs as game cartridges, plus demo songs. Tap to play.
import { h, esc, injectCSS } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { ensure, stopAll } from '../core/chip.js';
import { Sequencer } from '../core/seq.js';
import { store } from '../core/store.js';
import { demoSongs, cleanSong, stepsOf, stepDur, scheduleStep, songLength } from '../core/song.js';
import { confirmBox, say } from '../core/ui.js';
import { cartridgeHTML } from './songmaker.js';

export function mount(el, props = {}, api) {
  injectCSS('t-juke', CSS);
  let seq = null;
  let playingId = null;
  let raf = 0;
  let t0 = 0;
  let len = 1;
  const root = h(`<div class="t-juke scroll">
    <div class="jk-now lcd"><div class="jk-eq">${'<i></i>'.repeat(12)}</div><div class="jk-title">PICK A SONG!</div><div class="jk-bar"><i></i></div></div>
    <div class="jk-sec"><h2>Our songs</h2><div class="jk-grid" data-g="crew"></div></div>
    <div class="jk-sec"><h2>Demo songs</h2><div class="jk-grid" data-g="demo"></div></div>
  </div>`);
  el.appendChild(root);
  const nowEl = root.querySelector('.jk-now');

  function all() {
    const crew = (store.state.songs || []).filter(x => !String(x.id).startsWith('demo-')).map(cleanSong);
    const win = api.kit.get('win');
    if (win) crew.push(cleanSong({ ...win, id: 'kit-win', name: 'Win tune', cover: { col: '#1fa35c', sticker: 'flag' }, kit: true }));
    return { crew, demo: demoSongs() };
  }
  function draw() {
    const { crew, demo } = all();
    const music = api.kit.get('music')?.id;
    const card = (s, demoSong) => `<div class="jk-item ${playingId === s.id ? 'playing' : ''}" data-id="${esc(s.id)}">
        <button class="jk-cart" type="button" data-a="play" aria-label="Play ${esc(s.name)}">${cartridgeHTML({ name: s.name || 'Our song', col: s.cover?.col || '#ff4f45', sticker: s.cover?.sticker || 'note' })}
          <span class="jk-pl">${icon(playingId === s.id ? 'stop' : 'play')}</span>${music === s.id ? `<span class="jk-game">${icon('game')} Moon Run</span>` : ''}</button>
        <div class="jk-acts">
          ${s.kit ? '' : `<a class="btn small" href="#/studio/song/${encodeURIComponent(s.id)}" aria-label="Change ${esc(s.name)}">${icon('edit')}</a>`}
          ${s.kit ? '' : `<button class="btn small ${music === s.id ? 'on' : ''}" type="button" data-a="game" aria-label="Use in Moon Run">${icon('game')}</button>`}
          ${demoSong || s.kit ? '' : `<button class="btn small" type="button" data-a="del" aria-label="Delete ${esc(s.name)}">${icon('trash')}</button>`}
        </div></div>`;
    root.querySelector('[data-g=crew]').innerHTML = crew.length ? crew.map(s => card(s, false)).join('') : `<p class="muted lead" style="grid-column:1/-1">Your saved songs appear here. Make one in the <a href="#/studio/song">Song Maker</a>!</p>`;
    root.querySelector('[data-g=demo]').innerHTML = demo.map(s => card(s, true)).join('');
  }
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const id = b.closest('.jk-item')?.dataset.id;
    const { crew, demo } = all();
    const s = [...crew, ...demo].find(x => x.id === id);
    if (!s) return;
    if (b.dataset.a === 'play') { playingId === id ? stop() : play(s); }
    else if (b.dataset.a === 'game') {
      if (s.demo) { const copy = cleanSong({ ...s, demo: false }); store.saveSong(copy); }
      api.kit.set('music', { id: s.id });
      api.log(`Chose "${s.name}" as the Moon Run music.`);
      api.toast(`"${s.name}" will play in Moon Run!`);
      draw();
    } else if (b.dataset.a === 'del') {
      if (await confirmBox('Delete this song?', `"${s.name}" will be gone for good.`, 'Delete it', 'Keep it')) {
        if (playingId === id) stop();
        store.deleteSong(id);
        if (api.kit.get('music')?.id === id) api.kit.set('music', null);
        draw();
      }
    }
  });
  function play(s) {
    stop();
    ensure();
    const song = cleanSong(s);
    seq = new Sequencer({ steps: () => stepsOf(song), stepDur: st => stepDur(song, st), schedule: (st, t, d) => scheduleStep(song, st, t, d), loop: false, onEnd: () => stop(), onStep: st => bump(st) });
    seq.start();
    playingId = s.id;
    len = songLength(song);
    t0 = performance.now();
    nowEl.querySelector('.jk-title').textContent = (s.name || 'Our song').toUpperCase();
    nowEl.classList.add('on');
    const tick = () => { nowEl.querySelector('.jk-bar i').style.width = Math.min(100, ((performance.now() - t0) / 1000 / len) * 100) + '%'; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    draw();
  }
  function bump(st) {
    const bars = nowEl.querySelectorAll('.jk-eq i');
    bars.forEach((b, i) => { b.style.height = (20 + Math.abs(Math.sin(st * 1.7 + i * 1.3)) * 80) + '%'; });
  }
  function stop() {
    if (seq) { seq.stop(); seq = null; }
    cancelAnimationFrame(raf);
    playingId = null;
    nowEl.classList.remove('on');
    nowEl.querySelector('.jk-title').textContent = 'PICK A SONG!';
    nowEl.querySelector('.jk-bar i').style.width = '0';
    draw();
  }
  draw();
  if (props.studio) api.say('Tap a cartridge to play a song.');
  return { destroy() { if (seq) seq.stop(); cancelAnimationFrame(raf); stopAll(); } };
}

const CSS = `
.t-juke { flex: 1; min-height: 0; padding: 18px 24px 40px; display: flex; flex-direction: column; gap: 22px; }
.t-juke .jk-now { display: flex; align-items: center; gap: 20px; padding: 14px 20px; min-height: 96px; flex: none; }
.t-juke .jk-eq { display: flex; gap: 4px; align-items: flex-end; height: 56px; width: 140px; flex: none; }
.t-juke .jk-eq i { flex: 1; height: 15%; background: var(--lcd-ink); transition: height .12s; }
.t-juke .jk-now:not(.on) .jk-eq i { height: 12% !important; }
.t-juke .jk-title { flex: 1; font-size: 18px; line-height: 1.4; }
.t-juke .jk-bar { width: 220px; height: 16px; border: 3px solid var(--lcd-ink); }
.t-juke .jk-bar i { display: block; height: 100%; width: 0; background: var(--lcd-ink); }
.t-juke .jk-sec h2 { font-size: 28px; margin-bottom: 12px; }
.t-juke .jk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 22px; }
.t-juke .jk-item { display: flex; flex-direction: column; gap: 10px; }
.t-juke .jk-cart { position: relative; border: 0; background: none; padding: 0; cursor: pointer; text-align: inherit; transition: transform .15s; }
.t-juke .jk-cart .cartridge { padding: 22px 14px 14px; }
.t-juke .jk-cart .ct-art { width: 70px; height: 70px; }
.t-juke .jk-cart .ct-name { font-size: 19px; min-height: 2.2em; display: flex; align-items: center; justify-content: center; }
.t-juke .jk-item.playing .jk-cart { transform: translateY(-10px) rotate(-2deg); }
.t-juke .jk-pl { position: absolute; right: -12px; bottom: -12px; width: 58px; height: 58px; border-radius: 50%; border: 3px solid var(--edge); background: var(--go); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 0 var(--edge); }
.t-juke .jk-item.playing .jk-pl { background: var(--a); }
.t-juke .jk-pl svg { width: 28px; height: 28px; }
.t-juke .jk-game { position: absolute; left: -6px; top: -10px; display: flex; gap: 4px; align-items: center; background: var(--ink); color: #fff; font-size: 13px; font-weight: 700; padding: 4px 8px; border-radius: 8px; }
.t-juke .jk-game svg { width: 18px; height: 18px; }
.t-juke .jk-acts { display: flex; gap: 8px; justify-content: center; }
.t-juke .jk-acts .btn { width: 56px; padding: 0; }
`;
