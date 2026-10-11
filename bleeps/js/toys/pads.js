// Bleep Pads: eight huge rainbow pads in the magic notes, a robot picker, wobble and echo,
// and a live wave on a Game Boy screen. Hold a pad for a long note; slide across pads like a keyboard.
// Also exports makePads() and makeScope() for other toys.
import { h, esc, injectCSS } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { note, ensure, analyser, stopAll, noteName } from '../core/chip.js';
import { botSVG, sing, LCD } from '../core/bots.js';
import { scaleNotes, colourOf, BOTS, NOTE_WORD } from '../core/song.js';
import { store } from '../core/store.js';

// A set of pads. opts: { notes, voice: () => voice, duty, fx: () => ({ wobble, echo }), onPlay(midi, i), rows, big, labels }
export function makePads(host, opts = {}) {
  injectCSS('t-padset', PAD_CSS);
  const notes = opts.notes || scaleNotes('magic', 8);
  const rows = opts.rows || 1;
  const per = Math.ceil(notes.length / rows);
  const wrap = h(`<div class="padset" style="--per:${per};--rows:${rows}"></div>`);
  // Lowest notes bottom-left, highest top-right.
  const order = [];
  for (let r = rows - 1; r >= 0; r--) for (let c = 0; c < per; c++) { const i = r * per + c; if (i < notes.length) order.push(i); }
  wrap.innerHTML = order.map(i => `<button class="pad" type="button" data-i="${i}" style="--c:${colourOf(notes[i])}" aria-label="${noteName(notes[i])}">${opts.labels === false ? '' : `<span class="pn">${noteName(notes[i])}</span>`}</button>`).join('');
  host.appendChild(wrap);
  const held = new Map(); // pointerId -> { i, handle, t0 }
  let enabled = true;

  const start = (i, pid) => {
    const midi = notes[i];
    const fx = opts.fx ? opts.fx() : {};
    const handle = note({ voice: opts.voice ? opts.voice() : 'bleep', midi, dur: opts.hold === false ? 0.32 : 3, duty: opts.duty ?? 0.5, table: opts.table ? opts.table() : undefined, wobble: fx.wobble ? 1 : 0, echo: fx.echo ? 0.5 : 0, vol: 0.95 });
    held.set(pid, { i, handle, t0: performance.now() });
    const b = wrap.querySelector(`.pad[data-i="${i}"]`);
    b && b.classList.add('down');
    opts.onPlay && opts.onPlay(midi, i);
  };
  const end = pid => {
    const it = held.get(pid);
    if (!it) return;
    held.delete(pid);
    const b = wrap.querySelector(`.pad[data-i="${it.i}"]`);
    if (![...held.values()].some(x => x.i === it.i)) b && b.classList.remove('down');
    if (it.handle && opts.hold !== false) {
      const age = (performance.now() - it.t0) / 1000;
      const ac = it.handle;
      if (age < 0.18) setTimeout(() => ac.stop(), (0.18 - age) * 1000); else ac.stop();
    }
  };
  wrap.addEventListener('pointerdown', e => {
    if (!enabled) return;
    const b = e.target.closest('.pad');
    if (!b) return;
    e.preventDefault();
    ensure();
    try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    end(e.pointerId);
    start(+b.dataset.i, e.pointerId);
  });
  wrap.addEventListener('pointermove', e => {
    const it = held.get(e.pointerId);
    if (!it || !enabled) return;
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const b = t && t.closest && t.closest('.pad');
    if (b && wrap.contains(b) && +b.dataset.i !== it.i) { end(e.pointerId); start(+b.dataset.i, e.pointerId); }
  });
  const up = e => end(e.pointerId);
  wrap.addEventListener('pointerup', up);
  wrap.addEventListener('pointercancel', up);
  return {
    el: wrap,
    notes,
    flash(i, ms = 300) { const b = wrap.querySelector(`.pad[data-i="${i}"]`); if (!b) return; b.classList.add('down'); setTimeout(() => b.classList.remove('down'), ms); },
    enable(on) { enabled = on; wrap.classList.toggle('off', !on); if (!on) for (const pid of [...held.keys()]) end(pid); },
    destroy() { for (const pid of [...held.keys()]) end(pid); },
  };
}

// A live oscilloscope on a Game Boy screen. Returns { el, destroy }.
export function makeScope(host, { label = '' } = {}) {
  injectCSS('t-padset', PAD_CSS);
  const el = h(`<div class="scope lcd"><canvas></canvas>${label ? `<span class="sl">${esc(label)}</span>` : ''}</div>`);
  host.appendChild(el);
  const cv = el.querySelector('canvas');
  const g = cv.getContext('2d');
  let raf = 0;
  let buf = null;
  const W = 160, H = 64;
  cv.width = W; cv.height = H;
  const draw = () => {
    raf = requestAnimationFrame(draw);
    g.fillStyle = LCD.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = LCD.light;
    for (let x = 0; x < W; x += 4) g.fillRect(x, H / 2, 2, 1);
    const an = analyser();
    if (!an) return;
    if (!buf || buf.length !== an.fftSize) buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    // Start at a rising zero crossing so the wave stands still.
    let s = 0;
    for (let i = 1; i < buf.length / 2; i++) if (buf[i - 1] < 0 && buf[i] >= 0) { s = i; break; }
    let peak = 0.02;
    for (let i = s; i < s + 640 && i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
    const k = (H * 0.42) / Math.max(0.12, peak);
    g.fillStyle = LCD.ink;
    let py = null;
    for (let x = 0; x < W; x++) {
      const v = buf[s + Math.floor(x * 4)] || 0;
      const y = Math.round(H / 2 - v * k);
      if (py === null) py = y;
      const y0 = Math.min(py, y), y1 = Math.max(py, y);
      g.fillRect(x, Math.max(0, y0 - 1), 2, Math.min(H, y1 - y0 + 3));
      py = y;
    }
  };
  raf = requestAnimationFrame(draw);
  return { el, destroy() { cancelAnimationFrame(raf); } };
}

export function mount(el, props = {}, api) {
  injectCSS('t-pads', CSS);
  const bots = ['bleep', 'hoot', 'buzz', ...(store.kit('wave') ? ['crew'] : [])];
  let voice = props.voice || 'bleep';
  let fx = { wobble: false, echo: false };
  let count = 0;
  const root = h(`<div class="t-pads">
    <div class="pd-top">
      <div class="pd-bots">${bots.map(b => `<button class="bot pd-bot ${b === voice ? 'sel' : ''}" type="button" data-bot="${b}" style="--bc:${BOTS[b].col}" aria-label="${esc(BOTS[b].name)}">${botSVG(b, { label: false, table: b === 'crew' ? store.kit('wave')?.table : null })}</button>`).join('')}</div>
      <div class="pd-scope"></div>
      <div class="pd-fx">
        <button class="btn pd-t" type="button" data-fx="wobble">${icon('wobble')}<span>Wobble</span></button>
        <button class="btn pd-t" type="button" data-fx="echo">${icon('echo')}<span>Echo</span></button>
      </div>
    </div>
    <div class="pd-pads"></div>
  </div>`);
  el.appendChild(root);
  const scope = makeScope(root.querySelector('.pd-scope'));
  const pads = makePads(root.querySelector('.pd-pads'), {
    notes: scaleNotes('magic', 8), rows: 2,
    voice: () => voice, fx: () => fx,
    onPlay: () => {
      sing(root.querySelector('.pd-bot.sel'), 300);
      count++;
      if (count === 8) api.done();
    },
  });
  root.querySelectorAll('.pd-bot').forEach(b => b.addEventListener('pointerdown', () => {
    ensure();
    voice = b.dataset.bot;
    root.querySelectorAll('.pd-bot').forEach(x => x.classList.toggle('sel', x === b));
    note({ voice, midi: 72, dur: 0.3 });
    sing(b, 400);
  }));
  root.querySelectorAll('[data-fx]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.fx;
    fx[k] = !fx[k];
    b.classList.toggle('on', fx[k]);
    note({ voice, midi: 76, dur: 0.6, wobble: fx.wobble ? 1 : 0, echo: fx.echo ? 0.5 : 0 });
  }));
  if (props.studio) api.say('Press the big buttons! There are no wrong notes.');
  return { destroy() { pads.destroy(); scope.destroy(); stopAll(); } };
}

const PAD_CSS = `
.padset { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(var(--per), 1fr); grid-template-rows: repeat(var(--rows), 1fr); gap: 14px; touch-action: none; }
.padset .pad { position: relative; border: 4px solid var(--edge); border-radius: 26px; background: var(--c); box-shadow: inset 0 -12px 0 rgba(0,0,0,.18), 0 7px 0 var(--edge); cursor: pointer; touch-action: none; transition: transform .05s, box-shadow .05s, filter .05s; min-height: 0; }
.padset .pad .pn { position: absolute; left: 14px; top: 10px; font-family: var(--pixel); font-size: 18px; color: rgba(255,255,255,.9); text-shadow: 0 2px 0 rgba(0,0,0,.3); }
.padset .pad::after { content: ''; position: absolute; left: 18%; right: 18%; top: 16%; height: 12%; border-radius: 99px; background: rgba(255,255,255,.28); }
.padset .pad.down { transform: translateY(6px); box-shadow: inset 0 -4px 0 rgba(0,0,0,.18), 0 1px 0 var(--edge); filter: brightness(1.18); }
.padset.off .pad { filter: saturate(.5) brightness(.95); }
.scope { position: relative; border-width: 8px; border-radius: 14px; overflow: hidden; }
.scope canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.scope .sl { position: absolute; left: 8px; top: 6px; font-size: 10px; color: var(--lcd-dark); }
`;

const CSS = `
.t-pads { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px; padding: 14px 18px 22px; }
.t-pads .pd-top { display: flex; gap: 16px; align-items: stretch; height: 118px; flex: none; }
.t-pads .pd-bots { display: flex; gap: 10px; }
.t-pads .pd-bot { width: 96px; height: 100%; border-radius: 18px; border: 3px solid var(--edge); background: var(--card); padding: 4px; cursor: pointer; box-shadow: 0 4px 0 var(--edge); display: flex; align-items: center; justify-content: center; }
.t-pads .pd-bot .botsvg { height: 100%; width: auto; }
.t-pads .pd-bot.sel { background: var(--bc); }
.t-pads .pd-scope { flex: 1; min-width: 0; display: flex; }
.t-pads .pd-scope .scope { flex: 1; }
.t-pads .pd-fx { display: flex; gap: 10px; }
.t-pads .pd-t { flex-direction: column; height: 100%; min-width: 108px; gap: 4px; font-size: 18px; }
.t-pads .pd-t svg { width: 34px; height: 34px; }
.t-pads .pd-pads { flex: 1; min-height: 0; display: flex; }
@media (max-width: 900px) { .t-pads .pd-top { height: 96px; } .t-pads .pd-bot { width: 74px; } .t-pads .pd-t { min-width: 84px; } }
`;
