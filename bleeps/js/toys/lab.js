// Sound Lab (Mission 6 "Make" step and the Studio).
// Every game sound is a recipe: a robot, a start note, a slide, a length and an effect.
// Left: the recipe controls. Right: a "recipe card" LCD showing the sound's pitch path, and a big PLAY button.
// props:
//   slot: 'jump' (or any kit slot)  show "Use this for our game", which saves the recipe to that Moon Run slot.
//   studio: true (no slot)          show small "Save as Jump / Star / Bump" buttons.
// Done: in a mission with a slot, when the crew saves. Without a slot, after 4 sounds have been played.
import { sfx, noteLabel, stopAll } from '../core/chip.js';
import { botSVG, sing } from '../core/bots.js';
import { BOTS, colourOf } from '../core/song.js';
import { h, esc, injectCSS, clamp } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { sticker } from '../core/stickers.js';

/* ---------- shared with the Sound Detective ---------- */
const K = '#1b1b24';
const ART = {
  // A spring with an arrow: "jump".
  jump: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 23V6M23 14l9-9 9 9" fill="none" stroke="${K}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M32 23V6M23 14l9-9 9 9" fill="none" stroke="#ff4f45" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M23 51 41 47 23 43 41 39 23 35 41 32" fill="none" stroke="${K}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M23 51 41 47 23 43 41 39 23 35 41 32" fill="none" stroke="#f6c81e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="15" y="26" width="34" height="7" rx="3" fill="#14b8a6" stroke="${K}" stroke-width="3"/>
    <rect x="13" y="52" width="38" height="7" rx="3" fill="#9aa1b1" stroke="${K}" stroke-width="3"/></svg>`,
  // A puff of dust: "crash".
  dust: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M16 54a10 10 0 0 1-1-20 13 13 0 0 1 25-5 10 10 0 0 1 12 9 8 8 0 0 1-2 16Z" fill="#d9c9a6" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M21 46a6 6 0 0 1 8-5M35 40a6 6 0 0 1 8 1" fill="none" stroke="#a8956c" stroke-width="3" stroke-linecap="round"/>
    <rect x="4" y="20" width="6" height="6" fill="#b8a582" stroke="${K}" stroke-width="2"/><rect x="52" y="14" width="6" height="6" fill="#b8a582" stroke="${K}" stroke-width="2"/>
    <rect x="40" y="5" width="5" height="5" fill="#b8a582" stroke="${K}" stroke-width="2"/><rect x="15" y="8" width="5" height="5" fill="#b8a582" stroke="${K}" stroke-width="2"/>
    <rect x="27" y="3" width="4" height="4" fill="#b8a582" stroke="${K}" stroke-width="2"/></svg>`,
};
export function soundArt(name) {
  if (ART[name]) return ART[name];
  return sticker(name);
}
export const LAB_PRESETS = [
  { id: 'jump', name: 'Jump', art: 'jump', col: 'crew', r: { voice: 'bleep', duty: 0.25, from: 62, to: 79, len: 0.2 } },
  { id: 'coin', name: 'Coin', art: 'star', col: 'buzz', r: { voice: 'bleep', duty: 0.5, notes: [83, 88], len: 0.22 } },
  { id: 'laser', name: 'Laser', art: 'bolt', col: 'bleep', r: { voice: 'bleep', duty: 0.125, from: 96, to: 60, len: 0.25 } },
  { id: 'power', name: 'Power-up', art: 'rocket', col: 'hoot', r: { voice: 'bleep', duty: 0.5, from: 60, to: 84, len: 0.6, fx: 'sparkle' } },
  { id: 'crash', name: 'Crash', art: 'dust', col: 'fizz', r: { voice: 'fizz', from: 70, to: 40, len: 0.6 } },
  { id: 'bonk', name: 'Bonk', art: 'rock', col: 'hoot', r: { voice: 'hoot', from: 57, to: 40, len: 0.2 } },
];

/* ---------- the recipe controls ---------- */
const ROBOTS = ['bleep', 'hoot', 'buzz', 'fizz', 'crew'];
const STARTS = [81, 71, 64, 55, 48];     // top to bottom: high to low (A5 B4 E4 G3 C3: five different note colours)
const SLIDES = [
  { id: 'up', name: 'Slide up', ic: '<path d="M4 19 19 5"/><path d="M11 5h8v8"/>' },
  { id: 'flat', name: 'Stay flat', ic: '<path d="M3 12h17"/><path d="m15 7 5 5-5 5"/>' },
  { id: 'down', name: 'Slide down', ic: '<path d="M4 5l15 14"/><path d="M11 19h8v-8"/>' },
  { id: 'hop', name: 'Hop: two notes', ic: '<rect x="2.5" y="13" width="8" height="6.5" rx="1.5" fill="currentColor" stroke="none"/><rect x="13.5" y="4.5" width="8" height="6.5" rx="1.5" fill="currentColor" stroke="none"/>' },
];
const LENS = [
  { id: 'short', name: 'Short', len: 0.12, ic: '<rect x="3" y="9" width="6" height="6" rx="2" fill="currentColor" stroke="none"/>' },
  { id: 'middle', name: 'Middle', len: 0.25, ic: '<rect x="3" y="9" width="11" height="6" rx="2" fill="currentColor" stroke="none"/>' },
  { id: 'long', name: 'Long', len: 0.6, ic: '<rect x="2.5" y="9" width="19" height="6" rx="2" fill="currentColor" stroke="none"/>' },
];
const FX = [
  { id: 'none', name: 'No effect', ic: '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>' },
  { id: 'wobble', name: 'Wobble', ic: null },
  { id: 'echo', name: 'Echo', ic: null },
  { id: 'sparkle', name: 'Sparkle', ic: null },
];
const svgIc = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const clampM = m => clamp(Math.round(+m || 72), 36, 100);
const nearest = (list, v, key = x => x) => list.reduce((b, x) => (Math.abs(key(x) - v) < Math.abs(key(b) - v) ? x : b), list[0]);
const endFor = (slide, from) => (slide === 'up' ? Math.min(100, from + (from >= 72 ? 12 : 17)) : slide === 'down' ? Math.max(36, from - (from <= 60 ? 12 : 24)) : from);

function fromRecipe(r = {}) {
  const s = { voice: ROBOTS.includes(r.voice) ? r.voice : 'bleep', duty: [0.125, 0.25, 0.5].includes(r.duty) ? r.duty : 0.5, len: clamp(+r.len || 0.25, 0.05, 1.2), fx: r.fx || 'none', from: 72, to: 72, notes: null };
  if (Array.isArray(r.notes) && r.notes.length) { s.notes = r.notes.slice(0, 4).map(clampM); s.from = s.notes[0]; s.to = s.notes[s.notes.length - 1]; }
  else { s.from = clampM(r.from ?? 72); s.to = clampM(r.to ?? s.from); }
  return s;
}
export function toRecipe(s) {
  const r = { voice: s.voice };
  if (s.voice === 'bleep') r.duty = s.duty;
  if (s.notes) r.notes = s.notes.slice(); else { r.from = s.from; r.to = s.to; }
  r.len = s.len;
  if (s.fx && s.fx !== 'none') r.fx = s.fx;
  return r;
}
const slideOf = s => (s.notes ? 'hop' : s.to > s.from ? 'up' : s.to < s.from ? 'down' : 'flat');
const dutyLabel = d => (d === 0.125 ? '12.5%' : Math.round(d * 100) + '%');
function codeLine(s) {
  const p = [s.voice === 'crew' ? 'OURBOT' : s.voice.toUpperCase()];
  if (s.voice === 'bleep') p.push(dutyLabel(s.duty));
  if (s.notes) p.push(s.notes.map(noteLabel).join('+'));
  else p.push(s.to !== s.from ? `${noteLabel(s.from)}>${noteLabel(s.to)}` : noteLabel(s.from));
  p.push(s.len.toFixed(2) + 's');
  if (s.fx && s.fx !== 'none') p.push(s.fx.toUpperCase());
  return p.join(' ');
}

/* ---------- the pitch path picture ---------- */
// The picture's width follows the screen's shape (set by fitPic), so the pixels stay square.
const VB = { w: 400, h: 200, x0: 40, x1: 392, top: 14, bot: 186 };
let PPS = (VB.x1 - VB.x0) / 0.95;        // pixels per second: a long (0.6 s) sound fills about two thirds
const PX = 8;
function setSize(w, h) {
  VB.w = Math.round(w); VB.h = Math.round(h);
  VB.x1 = VB.w - 10; VB.bot = VB.h - 14;
  PPS = (VB.x1 - VB.x0) / 0.95;
}
const yOf = m => VB.bot - ((clamp(m, 36, 100) - 36) / 64) * (VB.bot - VB.top);
function pitchAt(s, t) {
  let m;
  if (s.notes) { const each = s.len / s.notes.length; m = s.notes[Math.min(s.notes.length - 1, Math.floor(t / each))]; }
  else m = s.from + (s.to - s.from) * Math.min(1, t / s.len);
  if (s.fx === 'wobble') m += Math.sin(t * Math.PI * 2 * 6) * 2.6;
  if (s.fx === 'sparkle') m += [0, 4, 7, 12][Math.floor(t / 0.04) % 4];
  return m;
}
function pathPixels(s, shift = 0) {
  let out = '';
  const n = Math.max(2, Math.round((s.len * PPS) / PX));
  for (let k = 0; k < n; k++) {
    const x = VB.x0 + shift * PPS + k * PX;
    if (x > VB.x1 - PX) break;
    let m = pitchAt(s, (k * PX) / PPS);
    if (s.voice === 'fizz') m += (((k * 7919) % 13) / 13 - 0.5) * 9;   // noise: a fuzzy, jumpy line
    const y = Math.round(yOf(m) / PX) * PX - PX / 2;
    out += `<rect x="${x.toFixed(1)}" y="${clamp(y, VB.top - 4, VB.bot - 4)}" width="${PX - 1}" height="${PX - 1}"/>`;
  }
  return out;
}
function pathSVG(s) {
  let grid = '';
  for (let x = VB.x0 + 32; x <= VB.x1; x += 32) grid += `M${x} ${VB.top}V${VB.bot}`;
  for (let k = 0; k < 4; k++) { const y = Math.round(VB.top + (k * (VB.bot - VB.top)) / 4); grid += `M${VB.x0} ${y}H${VB.x1}`; }
  const echoes = s.fx === 'echo' ? `<g fill="#306230" opacity=".55">${pathPixels(s, 0.23)}</g><g fill="#306230" opacity=".28">${pathPixels(s, 0.46)}</g>` : '';
  return `<path d="${grid}" stroke="#86a50e" stroke-width="1.5" fill="none"/>
    <text x="6" y="${VB.top + 10}" font-family="'Press Start 2P', monospace" font-size="10" fill="#306230">HI</text>
    <text x="6" y="${VB.bot}" font-family="'Press Start 2P', monospace" font-size="10" fill="#306230">LO</text>
    <path d="M${VB.x0 - 6} ${VB.top}V${VB.bot}H${VB.x1}" stroke="#306230" stroke-width="2.5" fill="none"/>
    ${echoes}<g fill="#0f380f">${pathPixels(s)}</g>
    <rect class="lb-head" x="${VB.x0}" y="${VB.top - 4}" width="4" height="${VB.bot - VB.top + 4}" fill="#306230" opacity="0"/>`;
}

const CSS = `
.t-lab { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 14px; padding: 14px 22px 18px; }
.t-lab .lb-main { flex: 1; min-height: 0; display: flex; gap: 18px; }
.t-lab .lb-lab { font-family: var(--pixel); font-size: 11px; color: var(--ink-2); letter-spacing: .5px; text-transform: uppercase; white-space: nowrap; }

.t-lab .lb-controls { flex: none; display: flex; gap: 16px; padding: 14px 16px; background: var(--card); border: 3px solid var(--edge); border-radius: 24px; box-shadow: var(--pop); min-height: 0; }
.t-lab .lb-start { width: 92px; flex: none; display: flex; flex-direction: column; justify-content: center; gap: 10px; min-height: 0; }
.t-lab .lb-start .lb-lab { text-align: center; }
.t-lab .lb-steps { flex: 1; min-height: 0; max-height: 450px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; }
.t-lab .lb-step {
  flex: 1 1 0; min-height: 40px; max-height: 80px; width: var(--w); border: 3px solid var(--edge); border-radius: 12px; background: var(--c);
  box-shadow: 0 4px 0 var(--edge); cursor: pointer; touch-action: manipulation; position: relative; transition: transform .06s, box-shadow .06s;
}
.t-lab .lb-step::after { content: ''; position: absolute; left: 7px; right: 7px; top: 6px; height: 7px; border-radius: 4px; background: rgba(255,255,255,.4); }
.t-lab .lb-step.on { outline: 4px solid var(--ink); outline-offset: 3px; transform: translateY(3px); box-shadow: 0 1px 0 var(--edge); }
.t-lab .lb-rows { display: flex; flex-direction: column; justify-content: center; gap: 12px; }
.t-lab .lb-row { display: flex; align-items: center; gap: 10px; }
.t-lab .lb-row > .lb-lab { width: 74px; flex: none; }
.t-lab .lb-opts { display: flex; gap: 8px; }
.t-lab .lb-t {
  width: 64px; height: 64px; flex: none; display: inline-flex; align-items: center; justify-content: center; padding: 0;
  border: 3px solid var(--edge); border-radius: 15px; background: var(--card-2); color: var(--ink); box-shadow: 0 4px 0 var(--edge);
  cursor: pointer; touch-action: manipulation; transition: transform .06s, box-shadow .06s, background .12s; overflow: hidden;
}
.t-lab .lb-t > svg { width: 34px; height: 34px; }
.t-lab .lb-t .bot { width: 46px; pointer-events: none; }
.t-lab .lb-t .bot .botsvg { width: 100%; height: auto; }
.t-lab .lb-t.on { background: var(--ink); color: #fff; transform: translateY(3px); box-shadow: 0 1px 0 var(--edge); }
.t-lab .lb-t.bt.on { background: var(--soft); box-shadow: 0 1px 0 var(--edge), inset 0 0 0 4px var(--col); }

.t-lab .lb-right { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.t-lab .lb-screen { flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 22px; box-shadow: var(--pop); border-width: 12px; }
.t-lab .lb-strip { flex: none; display: flex; justify-content: space-between; gap: 10px; padding: 7px 10px 6px; border-bottom: 2px solid #86a50e; font-size: 10px; color: var(--lcd-dark); white-space: nowrap; }
.t-lab .lb-picbox { flex: 1; min-height: 0; position: relative; }
.t-lab .lb-pic { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.t-lab .lb-code { flex: none; padding: 8px 10px 9px; border-top: 2px solid #86a50e; font-size: 13px; line-height: 1.3; color: var(--lcd-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t-lab .lb-actions { flex: none; display: flex; align-items: center; gap: 18px; }
.t-lab .lb-actions.solo { justify-content: center; }
.t-lab .lb-actions.solo .lb-save { display: none; }
.t-lab .lb-play {
  width: 128px; height: 128px; flex: none; border-radius: 50%; border: 3px solid var(--edge); background: var(--go); color: #fff;
  box-shadow: 0 7px 0 var(--edge); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; cursor: pointer;
  font-family: var(--pixel); font-size: 15px; touch-action: manipulation; transition: transform .06s, box-shadow .06s;
}
.t-lab .lb-play svg { width: 46px; height: 46px; margin-left: 6px; }
.t-lab .lb-play.press { transform: translateY(5px); box-shadow: 0 2px 0 var(--edge); }
.t-lab .lb-save { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.t-lab .lb-use { white-space: normal; line-height: 1.15; text-align: left; padding: 10px 22px; font-size: 24px; align-self: flex-start; max-width: 100%; }
.t-lab .lb-use.saved { background: var(--go); }
.t-lab .lb-saveas { display: flex; gap: 8px; flex-wrap: wrap; }
.t-lab .lb-saveas .btn { padding: 0 14px; }
.t-lab .lb-saveas .btn.saved { background: var(--go); color: #fff; }

.t-lab .lb-presets { flex: none; display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.t-lab .lb-pre {
  height: 88px; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0 10px;
  border: 3px solid var(--edge); border-radius: 18px; background: var(--card); box-shadow: 0 5px 0 var(--edge); cursor: pointer; touch-action: manipulation;
  font-family: var(--font); font-size: 20px; font-weight: 800; color: var(--ink); transition: transform .06s, box-shadow .06s, background .12s;
}
.t-lab .lb-pre .art { width: 52px; height: 52px; flex: none; }
.t-lab .lb-pre .art svg { width: 100%; height: 100%; }
.t-lab .lb-pre.on { background: var(--soft); box-shadow: 0 2px 0 var(--edge), inset 0 0 0 4px var(--col); transform: translateY(3px); }
.t-lab .lb-pre.press, .t-lab .lb-t.press, .t-lab .lb-step.press { transform: translateY(4px); box-shadow: 0 0 0 var(--edge); }

@media (max-width: 1180px) {
  .t-lab .lb-pre { flex-direction: column; gap: 2px; font-size: 17px; padding: 4px; }
  .t-lab .lb-pre .art { width: 46px; height: 46px; }
  .t-lab .lb-use { font-size: 21px; padding: 8px 16px; }
}
@media (max-width: 1100px) {
  .t-lab { padding: 12px 16px 16px; }
  .t-lab .lb-main { gap: 14px; }
  .t-lab .lb-controls { gap: 12px; padding: 12px; }
  .t-lab .lb-start { width: 80px; }
  .t-lab .lb-row > .lb-lab { width: 66px; font-size: 10px; }
  .t-lab .lb-play { width: 116px; height: 116px; }
  .t-lab .lb-code { font-size: 11px; }
}
@media (max-width: 900px) {
  .t-lab .lb-row > .lb-lab { display: none; }
  .t-lab .lb-start { width: 70px; }
  .t-lab .lb-opts { gap: 6px; }
  .t-lab .lb-t { width: 60px; height: 60px; }
  .t-lab .lb-presets { gap: 8px; }
  .t-lab .lb-pre { font-size: 15px; }
}
@media (max-height: 640px) {
  .t-lab { gap: 12px; padding-top: 12px; padding-bottom: 14px; }
  .t-lab .lb-pre { height: 80px; }
  .t-lab .lb-rows { gap: 10px; }
}
`;

const SLOT_NAMES = { jump: 'jump', star: 'star', bump: 'bump' };

export function mount(el, props = {}, api) {
  injectCSS('t-lab', CSS);
  const slot = typeof props.slot === 'string' && props.slot ? props.slot : null;
  const studio = props.studio === true || api.mode === 'studio';
  const savedR = slot && api.kit && api.kit.get ? api.kit.get(slot) : null;
  const jump = LAB_PRESETS[0];
  let s = fromRecipe(savedR && typeof savedR === 'object' ? savedR : jump.r);
  if (!savedR) s.voice = 'bleep';
  let presetOn = savedR ? null : 'jump';
  const crewTable = (api.kit && api.kit.get && api.kit.get('wave') && api.kit.get('wave').table) || null;
  const botCol = b => `--col:${BOTS[b].col};--soft:${BOTS[b].soft}`;

  const root = h(`<div class="t-lab">
    <div class="lb-main">
      <div class="lb-controls">
        <div class="lb-start" role="group" aria-label="Start note">
          <div class="lb-lab">Start</div>
          <div class="lb-steps">${STARTS.map((m, i) => `<button class="lb-step" type="button" data-m="${m}" style="--c:${colourOf(m)};--w:${58 + i * 10.5}%" aria-label="Start note ${i === 0 ? 'highest' : i === 4 ? 'lowest' : i + 1}"></button>`).join('')}</div>
        </div>
        <div class="lb-rows">
          <div class="lb-row" role="group" aria-label="Robot"><div class="lb-lab">Robot</div><div class="lb-opts">${ROBOTS.map(b => `<button class="lb-t bt" type="button" data-v="${b}" style="${botCol(b)}" aria-label="${esc(BOTS[b].name)}" title="${esc(BOTS[b].name)}"><span class="bot" data-bot="${b}">${botSVG(b, { label: false, table: b === 'crew' ? crewTable : null })}</span></button>`).join('')}</div></div>
          <div class="lb-row" role="group" aria-label="Slide"><div class="lb-lab">Slide</div><div class="lb-opts">${SLIDES.map(o => `<button class="lb-t" type="button" data-slide="${o.id}" aria-label="${o.name}" title="${o.name}">${svgIc(o.ic)}</button>`).join('')}</div></div>
          <div class="lb-row" role="group" aria-label="Length"><div class="lb-lab">Length</div><div class="lb-opts">${LENS.map(o => `<button class="lb-t" type="button" data-len="${o.id}" aria-label="${o.name}" title="${o.name}">${svgIc(o.ic)}</button>`).join('')}</div></div>
          <div class="lb-row" role="group" aria-label="Effect"><div class="lb-lab">Effect</div><div class="lb-opts">${FX.map(o => `<button class="lb-t" type="button" data-fx="${o.id}" aria-label="${o.name}" title="${o.name}">${o.ic ? svgIc(o.ic) : icon(o.id)}</button>`).join('')}</div></div>
        </div>
      </div>
      <div class="lb-right">
        <div class="lb-screen lcd">
          <div class="lb-strip"><span>SOUND RECIPE</span><span>PITCH / TIME</span></div>
          <div class="lb-picbox"><svg class="lb-pic" viewBox="0 0 ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg></div>
          <div class="lb-code"></div>
        </div>
        <div class="lb-actions${slot || studio ? '' : ' solo'}">
          <button class="lb-play" type="button" aria-label="Play the sound">${icon('play')}<span>PLAY</span></button>
          <div class="lb-save">${slot
            ? `<button class="btn primary big lb-use" type="button">Use this for our game</button>`
            : studio ? `<div class="lb-lab">Save for Moon Run as</div><div class="lb-saveas">${['jump', 'star', 'bump'].map(k => `<button class="btn small" type="button" data-slot="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="lb-presets">${LAB_PRESETS.map(p => `<button class="lb-pre" type="button" data-p="${p.id}" style="${botCol(p.col)}"><span class="art">${soundArt(p.art)}</span><span>${esc(p.name)}</span></button>`).join('')}</div>
  </div>`);
  el.appendChild(root);

  const $$ = sel => [...root.querySelectorAll(sel)];
  const pic = root.querySelector('.lb-pic');
  const codeEl = root.querySelector('.lb-code');
  const playBtn = root.querySelector('.lb-play');
  const timers = [];
  let plays = 0, finished = false;

  function render() {
    const start = nearest(STARTS, s.from);
    $$('.lb-step').forEach(b => b.classList.toggle('on', +b.dataset.m === start));
    $$('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === s.voice));
    const sl = slideOf(s);
    $$('[data-slide]').forEach(b => b.classList.toggle('on', b.dataset.slide === sl));
    const ln = nearest(LENS, s.len, o => o.len).id;
    $$('[data-len]').forEach(b => b.classList.toggle('on', b.dataset.len === ln));
    $$('[data-fx]').forEach(b => b.classList.toggle('on', b.dataset.fx === (s.fx || 'none')));
    $$('.lb-pre').forEach(b => b.classList.toggle('on', b.dataset.p === presetOn));
    drawPic();
    codeEl.textContent = codeLine(s);
  }
  function drawPic() {
    pic.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
    pic.innerHTML = pathSVG(s);
  }
  // Keep the picture's pixels square whatever the screen's shape.
  const picBox = root.querySelector('.lb-picbox');
  function fitPic() {
    const r = picBox.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    // 200 units tall when the screen is wide; 300 units wide (and taller) when it is narrow.
    const aspect = r.width / r.height;
    const w = aspect >= 1.5 ? clamp(200 * aspect, 300, 900) : 300;
    const hgt = aspect >= 1.5 ? 200 : clamp(300 / aspect, 200, 420);
    if (Math.abs(w - VB.w) > 4 || Math.abs(hgt - VB.h) > 4) { setSize(w, hgt); drawPic(); }
  }
  let ro = null;
  if (window.ResizeObserver) { ro = new ResizeObserver(() => fitPic()); ro.observe(picBox); }

  function play() {
    let len = 0;
    try { len = sfx(toRecipe(s)) || 0; } catch (e) { /* no sound */ }
    flash(playBtn, 'press', 140);
    const bot = root.querySelector(`[data-v="${s.voice}"] .bot`);
    sing(bot, Math.max(450, s.len * 1000 + 250));
    const head = pic.querySelector('.lb-head');
    if (head && head.animate) {
      const dx = Math.min(VB.x1 - VB.x0, s.len * PPS);
      try { head.animate([{ transform: 'translateX(0px)', opacity: 1 }, { transform: `translateX(${dx}px)`, opacity: 1 }], { duration: Math.max(80, s.len * 1000), easing: 'linear' }); } catch (e) { /* ignore */ }
    }
    plays++;
    if (!slot && !finished && plays >= 4) { finished = true; api.done(); }
    return len;
  }
  const change = fn => () => { fn(); presetOn = null; render(); play(); };

  $$('.lb-step').forEach(b => press(b, change(() => {
    const m = +b.dataset.m;
    if (s.notes) { const iv = s.notes.length > 1 ? s.notes[1] - s.notes[0] : 5; s.notes = [m, clampM(m + iv)]; s.from = m; s.to = s.notes[1]; }
    else { const sl = slideOf(s); s.from = m; s.to = endFor(sl, m); }
  })));
  $$('[data-v]').forEach(b => press(b, change(() => { s.voice = b.dataset.v; })));
  $$('[data-slide]').forEach(b => press(b, change(() => {
    const k = b.dataset.slide;
    if (k === 'hop') { s.notes = [s.from, clampM(s.from + 5)]; s.to = s.notes[1]; return; }
    if (s.notes) { s.from = s.notes[0]; s.notes = null; }
    s.to = endFor(k, s.from);
  })));
  $$('[data-len]').forEach(b => press(b, change(() => { s.len = LENS.find(o => o.id === b.dataset.len).len; })));
  $$('[data-fx]').forEach(b => press(b, change(() => { s.fx = b.dataset.fx; })));
  $$('.lb-pre').forEach(b => press(b, () => {
    const p = LAB_PRESETS.find(x => x.id === b.dataset.p);
    s = fromRecipe(p.r);
    presetOn = p.id;
    flash(b, 'press', 120);
    render();
    play();
  }));
  press(playBtn, () => play());

  // Saving into the Moon Run kit.
  function saveTo(k, btn, label) {
    const r = toRecipe(s);
    api.kit.set(k, r);
    api.log(`Made our game's ${SLOT_NAMES[k] || k} sound`);
    api.toast(`Saved! Moon Run will use our ${SLOT_NAMES[k] || k} sound.`);
    play();
    btn.classList.add('saved');
    const old = btn.innerHTML;
    btn.innerHTML = `${icon('check')}<span>${label}</span>`;
    timers.push(setTimeout(() => { btn.classList.remove('saved'); btn.innerHTML = old; }, 2000));
    api.done();
  }
  const use = root.querySelector('.lb-use');
  if (use) press(use, () => { if (!use.classList.contains('saved')) saveTo(slot, use, 'Saved!'); });
  $$('.lb-saveas .btn').forEach(b => press(b, () => { if (!b.classList.contains('saved')) saveTo(b.dataset.slot, b, 'Saved'); }));

  render();
  fitPic();
  const line = slot ? (slot === 'jump' ? 'Make a jump sound. Try sliding it up!' : `Make a ${SLOT_NAMES[slot] || 'new'} sound for our game!`) : 'Pick a robot, then make it slide!';
  timers.push(startLine(props, api, line));

  return {
    destroy() {
      timers.forEach(t => clearTimeout(t));
      if (ro) ro.disconnect();
      try { stopAll(); } catch (e) { /* ignore */ }
      root.remove();
    },
    getState: () => toRecipe(s),
  };
}

/* ---------- small helpers (local to this toy) ---------- */
function press(el, fn) {
  el.addEventListener('pointerdown', e => { if (e.button > 0) return; fn(e); });
  el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); fn(e); } });
}
function flash(el, cls, ms) {
  if (!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  clearTimeout(el._fl); el._fl = setTimeout(() => el.classList.remove(cls), ms);
}
function startLine(props, api, text) {
  const intro = props && props.step ? String(props.step.intro || props.step.title || '') : '';
  if (!intro) { api.say(text); return 0; }
  return setTimeout(() => api.say(text), Math.min(9000, 900 + intro.length * 72));
}
