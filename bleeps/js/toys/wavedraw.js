// Wave Drawer (Mission 2 and the Studio).
// The Game Boy's wave channel played a drawn wave of 32 steps, each a 4-bit number (0 to 15).
// The crew draws one with a finger, hears it change as they draw, and plays it on eight rainbow pads.
// props:
//   save: true   show the name field and "Save our bot" (Mission 2 "Make" step). Also shown in studio mode.
// Done: with save, when the crew saves; otherwise once they have drawn something and played 3 notes.
import { note, now, setCrewWave, crewWave, stopAll } from '../core/chip.js';
import { botSVG, sing, lcdWave } from '../core/bots.js';
import { scaleNotes, colourOf } from '../core/song.js';
import { h, esc, injectCSS, clamp } from '../core/dom.js';
import { icon } from '../core/icons.js';

const N = 32;          // steps in the wave
const L = 16;          // levels per step (4 bits)
const MID = 67;        // the note heard while drawing (G4)
const LINE = 'Draw a wiggle with your finger, then press the pads!';

const toSound = lv => lv.map(v => +(v / 7.5 - 1).toFixed(4));
function toLevels(t) {
  if (!Array.isArray(t) || t.length < 2) return null;
  return Array.from({ length: N }, (_, i) => clamp(Math.round(((+t[Math.floor((i * t.length) / N)] || 0) + 1) * 7.5), 0, 15));
}
const lv = f => Array.from({ length: N }, (_, i) => clamp(Math.round(f(i / N, i)), 0, 15));
const tri = p => (p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4);

function surprise() {
  // A smooth-ish random wave: the fundamental plus two or three random harmonics, stretched to fill 0..15.
  const parts = [[1, 1, Math.random() * Math.PI * 2]];
  const pool = [2, 3, 4, 5];
  const count = 2 + Math.floor(Math.random() * 2);
  for (let k = 0; k < count; k++) {
    const n = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    parts.push([n, 0.25 + Math.random() * 0.6, Math.random() * Math.PI * 2]);
  }
  const raw = Array.from({ length: N }, (_, i) => parts.reduce((s, [n, a, ph]) => s + a * Math.sin((i / N) * Math.PI * 2 * n + ph), 0));
  const lo = Math.min(...raw), hi = Math.max(...raw);
  return raw.map(v => clamp(Math.round(((v - lo) / (hi - lo || 1)) * 15), 0, 15));
}

const PRESETS = [
  { id: 'hill', name: 'Hill', make: () => lv(p => 7.5 + 7.5 * Math.sin(p * Math.PI * 2)) },
  { id: 'square', name: 'Square', make: () => lv(p => (p < 0.5 ? 15 : 0)) },
  { id: 'triangle', name: 'Triangle', make: () => lv(p => 7.5 + 7.5 * tri(p)) },
  { id: 'saw', name: 'Saw', make: () => lv((p, i) => Math.floor(i / 2)) },
  { id: 'zigzag', name: 'Zigzag', make: () => lv((p, i) => 7.5 + 5 * Math.sin(p * Math.PI * 2) + (Math.floor(i / 2) % 2 ? -2.5 : 2.5)) },
  { id: 'surprise', name: 'Surprise', make: surprise },
];
// A fixed picture for the Surprise button (the real one is different every time).
const SURPRISE_PIC = lv(p => 7.5 + 4.6 * Math.sin(p * Math.PI * 2 + 0.4) + 2.9 * Math.sin(p * Math.PI * 6 + 1.2));

const CSS = `
.t-wavedraw { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px; padding: 16px 22px 20px; }
.t-wavedraw .wd-main { flex: 1; min-height: 0; display: flex; gap: 18px; }
.t-wavedraw .wd-eyebrow { font-family: var(--pixel); font-size: 12px; color: var(--ink-2); letter-spacing: .5px; text-transform: uppercase; }

.t-wavedraw .wd-presets { flex: none; width: 236px; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.t-wavedraw .wd-pgrid { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(0, 1fr); gap: 10px; max-height: 420px; }
.t-wavedraw .wd-pre {
  min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 6px 6px;
  border: 3px solid var(--edge); border-radius: 16px; background: var(--card); box-shadow: 0 4px 0 var(--edge); cursor: pointer;
  font-family: var(--font); font-size: 18px; font-weight: 800; color: var(--ink); touch-action: manipulation;
  transition: transform .06s, box-shadow .06s;
}
.t-wavedraw .wd-pre .pic { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
.t-wavedraw .wd-pre .lcdwave { width: 100%; max-width: 96px; height: auto; max-height: 100%; border-radius: 8px; border: 2.5px solid var(--bezel); }
.t-wavedraw .wd-pre:active, .t-wavedraw .wd-pre.press { transform: translateY(3px); box-shadow: 0 1px 0 var(--edge); }
.t-wavedraw .wd-pre.on { background: var(--crew-soft); outline: 4px solid var(--crew); outline-offset: -8px; }

.t-wavedraw .wd-screen { flex: 1; min-width: 0; min-height: 0; position: relative; display: flex; flex-direction: column; border-radius: 22px; box-shadow: var(--pop); }
.t-wavedraw .wd-screen.lcd { border-width: 12px; }
.t-wavedraw .wd-svg { flex: 1; min-height: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; border-radius: 4px; }
.t-wavedraw .wd-strip { flex: none; display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 7px 10px 6px; border-bottom: 2px solid #86a50e;
  font-family: var(--pixel); font-size: 10px; color: var(--lcd-dark); pointer-events: none; white-space: nowrap; overflow: hidden; }
.t-wavedraw .wd-strip .hint { transition: opacity .4s; }
.t-wavedraw .wd-strip .hint.gone { opacity: .35; }

.t-wavedraw .wd-side { flex: none; width: 230px; display: flex; flex-direction: column; justify-content: center; gap: 12px; min-height: 0; padding: 14px 16px 16px;
  background: var(--card); border: 3px solid var(--edge); border-radius: 22px; box-shadow: var(--pop); }
.t-wavedraw .wd-botbox { flex: 1 1 210px; max-height: 210px; min-height: 70px; position: relative; }
.t-wavedraw .wd-botbox .bot { position: absolute; left: 50%; bottom: 0; height: 100%; max-height: 200px; aspect-ratio: 120 / 140; transform: translateX(-50%); }
.t-wavedraw .wd-botbox .bot .botsvg { width: 100%; height: 100%; }
.t-wavedraw .wd-botname { text-align: center; font-weight: 800; font-size: 23px; line-height: 1.15; color: var(--crew-dark); min-height: 27px; overflow-wrap: anywhere; }
.t-wavedraw .wd-field { display: flex; flex-direction: column; gap: 6px; }
.t-wavedraw .wd-field input { width: 100%; min-height: 58px; border-radius: 14px; border: 3px solid var(--edge); padding: 0 14px; font-size: 22px; font-weight: 700; background: #fff; color: var(--ink); }
.t-wavedraw .wd-field input:focus { outline: 4px solid var(--crew-soft); }
.t-wavedraw .wd-save { width: 100%; padding: 0 12px; font-size: 22px; }
.t-wavedraw .wd-save.saved { background: var(--go); }

.t-wavedraw .wd-pads { flex: none; height: 116px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 12px; }
.t-wavedraw .wd-pad {
  position: relative; border: 3px solid var(--edge); border-radius: 20px; background: var(--c); box-shadow: 0 6px 0 var(--edge); cursor: pointer;
  touch-action: manipulation; overflow: hidden; transition: transform .05s, box-shadow .05s, filter .1s; min-width: 0;
}
.t-wavedraw .wd-pad::before { content: ''; position: absolute; left: 10px; right: 10px; top: 8px; height: 14px; border-radius: 8px; background: rgba(255,255,255,.35); }
.t-wavedraw .wd-pad .nm { position: absolute; left: 0; right: 0; bottom: 8px; text-align: center; font-family: var(--pixel); font-size: 11px; color: rgba(27,27,36,.55); }
.t-wavedraw .wd-pad.hit { transform: translateY(5px); box-shadow: 0 1px 0 var(--edge); filter: brightness(1.15); }

@media (max-width: 1100px) {
  .t-wavedraw .wd-presets { width: 204px; }
  .t-wavedraw .wd-side { width: 214px; padding: 12px 12px 14px; }
  .t-wavedraw .wd-pre { font-size: 17px; }
  .t-wavedraw .wd-save { font-size: 21px; }
  .t-wavedraw .wd-save svg { display: none; }
}
@media (max-width: 900px) {
  .t-wavedraw { padding: 12px 14px 16px; gap: 12px; }
  .t-wavedraw .wd-main { gap: 12px; }
  .t-wavedraw .wd-presets { width: 170px; }
  .t-wavedraw .wd-side { width: 180px; padding: 10px; }
  .t-wavedraw .wd-pads { gap: 8px; height: 104px; }
}
@media (max-height: 640px) {
  .t-wavedraw { gap: 12px; padding-top: 12px; padding-bottom: 16px; }
  .t-wavedraw .wd-pads { height: 104px; }
}
`;

export function mount(el, props = {}, api) {
  injectCSS('t-wavedraw', CSS);
  const saving = props.save === true || props.studio === true || api.mode === 'studio';
  const saved = api.kit && api.kit.get ? api.kit.get('wave') : null;
  let levels = toLevels(saved && saved.table) || toLevels(crewWave()) || PRESETS[0].make();
  let name = (saved && saved.name) || 'Our Bot';
  const pads = scaleNotes('magic', 8);

  const root = h(`<div class="t-wavedraw">
    <div class="wd-main">
      <div class="wd-presets">
        <div class="wd-eyebrow">Shapes</div>
        <div class="wd-pgrid">${PRESETS.map((p, i) => `<button class="wd-pre" type="button" data-i="${i}" aria-label="${esc(p.name)} wave">
          <span class="pic">${lcdWave(toSound(p.id === 'surprise' ? SURPRISE_PIC : p.make()), { w: 120, h: 64, cycles: 1, smooth: p.id === 'hill' })}</span><span>${esc(p.name)}</span></button>`).join('')}</div>
      </div>
      <div class="wd-screen lcd" aria-label="Wave drawing screen. Drag your finger to draw a wave.">
        <div class="wd-strip"><span class="hint">DRAW A WAVE</span><span>32 STEPS x 16 LEVELS</span></div>
      </div>
      <div class="wd-side">
        <div class="wd-botbox"><div class="bot" data-bot="crew"></div></div>
        <div class="wd-botname"></div>
        ${saving ? `<label class="wd-field"><span class="wd-eyebrow">Robot name</span><input type="text" maxlength="14" autocomplete="off" spellcheck="false" value="${esc(name)}" aria-label="Robot name"></label>
        <button class="btn primary big wd-save" type="button">${icon('save')}<span>Save our bot</span></button>` : ''}
      </div>
    </div>
    <div class="wd-pads">${pads.map((m, i) => `<button class="wd-pad" type="button" data-i="${i}" style="--c:${colourOf(m)}" aria-label="Play note ${i + 1}"><span class="nm">${i + 1}</span></button>`).join('')}</div>
  </div>`);
  el.appendChild(root);

  /* ---------- the drawing screen ---------- */
  const screen = root.querySelector('.wd-screen');
  const NS = 'http://www.w3.org/2000/svg';
  const W = N * 10, H = L * 10;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'wd-svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  let grid = '';
  for (let i = 1; i < N; i++) grid += `M${i * 10} 0V${H}`;
  for (let j = 1; j < L; j++) if (j !== 8) grid += `M0 ${j * 10}H${W}`;
  svg.innerHTML = `<rect width="${W}" height="${H}" fill="#9bbc0f"/>
    <path d="${grid}" stroke="#86a50e" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>
    <path d="M0 80H${W}" stroke="#306230" stroke-width="2" stroke-dasharray="6 5" vector-effect="non-scaling-stroke" opacity=".55"/>
    <g class="bars"></g><g class="tops"></g>`;
  screen.appendChild(svg);
  const bars = svg.querySelector('.bars'), tops = svg.querySelector('.tops');
  const barEls = [], topEls = [];
  for (let i = 0; i < N; i++) {
    const b = document.createElementNS(NS, 'rect');
    b.setAttribute('x', i * 10 + 1); b.setAttribute('width', 8); b.setAttribute('fill', '#306230'); b.setAttribute('opacity', '.38');
    bars.appendChild(b); barEls.push(b);
    const t = document.createElementNS(NS, 'rect');
    t.setAttribute('x', i * 10 + 1); t.setAttribute('width', 8); t.setAttribute('height', 8); t.setAttribute('fill', '#0f380f');
    tops.appendChild(t); topEls.push(t);
  }
  function drawScreen() {
    for (let i = 0; i < N; i++) {
      const v = levels[i];
      const y = (15 - v) * 10;
      const y0 = v >= 8 ? y + 1 : 80, y1 = v >= 8 ? 80 : y + 9;
      barEls[i].setAttribute('y', Math.min(y0, y1));
      barEls[i].setAttribute('height', Math.max(0, Math.abs(y1 - y0)));
      topEls[i].setAttribute('y', y + 1);
    }
  }

  /* ---------- robot preview ---------- */
  const botEl = root.querySelector('.wd-botbox .bot');
  const nameEl = root.querySelector('.wd-botname');
  let botRaf = 0;
  function drawBot() {
    botRaf = 0;
    botEl.innerHTML = botSVG('crew', { table: toSound(levels), label: false });
  }
  const queueBot = () => { if (!botRaf) botRaf = requestAnimationFrame(drawBot); };
  const showName = () => { nameEl.textContent = name; };

  /* ---------- sound ---------- */
  let lastPreview = 0;
  function preview(force = false) {
    const t = performance.now();
    if (!force && t - lastPreview < 150) return;
    lastPreview = t;
    try { note({ voice: 'crew', table: toSound(levels), midi: MID, dur: 0.14, vol: 0.55 }); } catch (e) { /* no sound */ }
  }

  const timers = [];
  let drawn = false, plays = 0, finished = false;
  const checkDone = () => {
    if (!saving && !finished && drawn && plays >= 3) { finished = true; api.done(); }
  };
  const presetBtns = [...root.querySelectorAll('.wd-pre')];
  const clearPreset = () => presetBtns.forEach(b => b.classList.remove('on'));

  /* ---------- drawing with a finger ---------- */
  let active = null, last = null;
  const hint = root.querySelector('.wd-strip .hint');
  function cellAt(e) {
    const r = svg.getBoundingClientRect();
    return {
      c: clamp(Math.floor(((e.clientX - r.left) / Math.max(1, r.width)) * N), 0, N - 1),
      l: clamp(15 - Math.floor(((e.clientY - r.top) / Math.max(1, r.height)) * L), 0, 15),
    };
  }
  function paint(p) {
    if (last && last.c !== p.c) {
      // Fill every column a fast finger skipped, in a straight line.
      const dc = p.c - last.c, step = Math.sign(dc);
      for (let c = last.c + step; c !== p.c; c += step) levels[c] = Math.round(last.l + ((p.l - last.l) * (c - last.c)) / dc);
    }
    levels[p.c] = p.l;
    last = p;
    drawScreen();
    queueBot();
  }
  const onDown = e => {
    if (active !== null || e.button > 0) return;
    active = e.pointerId;
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
    last = null;
    drawn = true;
    clearPreset();
    hint.classList.add('gone');
    paint(cellAt(e));
    preview(true);
    checkDone();
  };
  const onMove = e => {
    if (e.pointerId !== active) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (evs.length ? evs : [e]).forEach(ev => paint(cellAt(ev)));
    preview();
  };
  const onUp = e => {
    if (e.pointerId !== active) return;
    active = null; last = null;
    try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  };
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);

  /* ---------- presets ---------- */
  presetBtns.forEach((b, i) => {
    press(b, () => {
      levels = PRESETS[i].make();
      drawn = true;
      clearPreset(); b.classList.add('on');
      flash(b, 'press', 120);
      drawScreen(); drawBot();
      try { note({ voice: 'crew', table: toSound(levels), midi: MID, dur: 0.4 }); } catch (e) { /* no sound */ }
      sing(botEl, 500);
      checkDone();
    });
  });

  /* ---------- pads ---------- */
  root.querySelectorAll('.wd-pad').forEach((p, i) => {
    press(p, () => {
      try { note({ voice: 'crew', table: toSound(levels), midi: pads[i], dur: 0.35 }); } catch (e) { /* no sound */ }
      flash(p, 'hit', 160);
      sing(botEl, 450);
      plays++;
      checkDone();
    });
  });

  /* ---------- naming and saving ---------- */
  if (saving) {
    const input = root.querySelector('.wd-field input');
    const btn = root.querySelector('.wd-save');
    input.addEventListener('input', () => { name = input.value.slice(0, 14).trim() || 'Our Bot'; showName(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    let savedT = 0;
    press(btn, () => {
      name = input.value.slice(0, 14).trim() || 'Our Bot';
      input.blur();
      const table = toSound(levels);
      try { setCrewWave(table); } catch (e) { /* ignore */ }
      api.kit.set('wave', { table, name });
      api.log('Made our own robot sound: ' + name);
      api.toast(name + ' is saved! It sings in the Studio now.');
      try { const t0 = now(); [67, 71, 74, 79].forEach((m, k) => note({ voice: 'crew', table, midi: m, at: t0 + k * 0.13, dur: 0.16, vol: 0.9 })); } catch (e) { /* no sound */ }
      sing(botEl, 900);
      btn.classList.add('saved');
      btn.querySelector('span').textContent = 'Saved!';
      clearTimeout(savedT);
      savedT = setTimeout(() => { btn.classList.remove('saved'); btn.querySelector('span').textContent = 'Save our bot'; }, 2200);
      timers.push(savedT);
      api.done();
    });
  }

  drawScreen();
  drawBot();
  showName();
  timers.push(startLine(props, api, LINE));

  return {
    destroy() {
      timers.forEach(t => clearTimeout(t));
      if (botRaf) cancelAnimationFrame(botRaf);
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('pointercancel', onUp);
      try { stopAll(); } catch (e) { /* ignore */ }
      root.remove();
    },
  };
}

/* ---------- small helpers (local to this toy) ---------- */
// Sound on pointerdown; Enter and Space work for keyboards.
function press(el, fn) {
  el.addEventListener('pointerdown', e => { if (e.button > 0) return; fn(e); });
  el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); fn(e); } });
}
function flash(el, cls, ms) {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  clearTimeout(el._fl); el._fl = setTimeout(() => el.classList.remove(cls), ms);
}
// Speak the toy's opening line. In a mission the runner first reads the step's intro aloud,
// so wait until that has probably finished instead of cutting it off.
function startLine(props, api, text) {
  const intro = props && props.step ? String(props.step.intro || props.step.title || '') : '';
  if (!intro) { api.say(text); return 0; }
  return setTimeout(() => api.say(text), Math.min(9000, 900 + intro.length * 72));
}
