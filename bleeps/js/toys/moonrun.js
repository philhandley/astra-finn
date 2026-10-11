// Moon Run: a tiny one-button runner on the Moon. Our Bot runs by itself; tap anywhere (or Space / Up) to jump.
// Collect stars, hop over rocks (a bump is only a little stumble: the rock crumbles and the robot carries on),
// and reach the flag. There is no losing: no lives, no game over, no visible timer, no score between players.
//
// The game plays ONLY the sounds the crew has made (api.kit), so each mission audibly adds one thing:
//   jump / star / bump  the kit recipe, or silence while the slot is empty
//   music               kit.music (a saved song, looped), else kit.beat (8-step drum loop), else none
//   win                 kit.win (a Tiny song, once), else silence (the overlay and pixel confetti still show)
// Exception: in the Studio, when the kit is completely empty, KIT_DEFAULTS and a default fanfare are used,
// so the game is not silent the first time someone opens it. props.silent always means no sound at all.
//
// The crew's Big Question about channels (store.state.choices.channel):
//   'borrow' (default)  a sound effect makes the tune channel go quiet while it plays (NES style)
//   'none'              no star sound; music never ducks
//   'spare'             the song's chords channel is muted for the whole run, so one channel is always free
//
// props:
//   seconds    length of the run in seconds (default 45). Demo mode without seconds runs forever.
//   demo       true: the robot plays itself (taps still work). A demo starts on its own.
//   silent     true: no sound at all (Mission 1). With demo, a little "...?" appears after a few seconds.
//   studio     true when opened from the Studio: the start card shows which kit slots are filled.
//   autostart  true: skip the start card (testing hook for headless screenshots). false: demo waits for a tap.
//   speed      optional override of store.state.choices.speed ('slow' | 'medium' | 'fast' | 'faster').
//   channel    optional override of store.state.choices.channel ('borrow' | 'none' | 'spare').
//   seed       optional number for a repeatable level.
//   skip       testing hook: fast-forward this many seconds at mount, without sound (headless screenshots).
import { ensure, now, sfx, drum, borrow, muteBus, stopAll, unduckAll, context } from '../core/chip.js';
import { Sequencer } from '../core/seq.js';
import { KIT_DEFAULTS, SPEEDS, speedIndex, cleanSong, stepsOf, stepDur, scheduleStep, demoSongs, NOTE_COL } from '../core/song.js';
import { store } from '../core/store.js';
import { injectCSS } from '../core/dom.js';
import { icon } from '../core/icons.js';

/* ---------------- World constants (internal pixels) ---------------- */
const H = 144;                       // internal height; the width stretches from 256 to 352 to fill the space
const MIN_W = 256, MAX_W = 352;
const GY = 118;                      // the ground line: the robot's feet stand here
const RX = 52;                       // the robot's left edge on screen
const RW = 16, RH = 18;              // robot sprite size
const DT = 1 / 120;                  // fixed update step, so the game runs the same at 60 and 120 Hz
const AIR = 0.7, JUMP_H = 40;        // a full jump: 0.7 s in the air, 40 px high
const GRAV = (8 * JUMP_H) / (AIR * AIR);
const JUMP_V = (4 * JUMP_H) / AIR;
const SPEED = { slow: 54, medium: 70, fast: 88 };          // px per second (the screen is 256 to 352 px wide)
const BEAT_STEP = { slow: 0.38, medium: 0.31, fast: 0.26 }; // seconds per beat step, to match the game speed
const FANFARE = { voice: 'bleep', duty: 0.5, notes: [72, 76, 79, 84], len: 0.7, fx: 'echo' };
const DRUM_OF = ['boom', 'tap', 'tss'];
const CONFETTI = Object.values(NOTE_COL);

const C = {
  sky: '#0d1026', star1: '#ffffff', star2: '#9fb4ff', star3: '#3d4677',
  far: '#20253f', farHi: '#2c3253', near: '#353c57', nearHi: '#48516f',
  gTop: '#e6e9ef', gLight: '#cdd2db', ground: '#b7bdc9', gLow: '#a6acba', crater: '#959cab', crDeep: '#80879a',
  ink: '#1b1b24', teal: '#14b8a6', tealLt: '#5eead4', tealDk: '#0b7f73', lcd: '#9bbc0f', lcdDk: '#306230', lcdInk: '#0f380f',
  yellow: '#f6c81e', yellowLt: '#fff3b0', orange: '#d18a00', red: '#e8352e', redDk: '#a8211b', magenta: '#b0246a', leg: '#9aa1b8',
  rock: '#9aa1b1', rockHi: '#c6cbd5', rockSh: '#6f7687', rockInk: '#2b2f3d', pole: '#e6e9ef', shadow: '#8c93a2',
  hud: 'rgba(6,8,22,0.66)', bar: '#2c3360', dust: '#dfe3ea', white: '#ffffff',
};

/* ---------------- Pixel art ---------------- */
// Our Bot: a rounded teal box with a Game Boy green screen face, antennae and two legs.
const BODY = [
  '...y........y...',
  '...n........n...',
  '..kkkkkkkkkkkk..',
  '.klllttttttttdk.',
  '.klKKKKKKKKKKdk.',
  '.klKggggggggKdk.',
  '.klKggggggggKdk.',
  '.klKggggggggKdk.',
  '.klKggggggggKdk.',
  '.klKKKKKKKKKKdk.',
  '.kltkttttttmtdk.',
  '.ktkkktttmtttdk.',
  '.kttktttttttddk.',
  '..kkkkkkkkkkkk..',
];
const LEGS = {
  stand: ['....nn....nn....', '....nn....nn....', '....nn....nn....', '....kkk...kkk...'],
  runA: ['....nn....nn....', '....nn....nn....', '....nn....kkk...', '....kkk.........'],
  runB: ['....nn....nn....', '....nn....nn....', '....kkk...nn....', '..........kkk...'],
  jump: ['...nn......nn...', '..kkk......kkk..', '................', '................'],
};
// Faces on the 8 x 4 LCD screen.
const FACES = {
  normal: ['.e....e.', '.e....e.', '........', '...ee...'],
  blink: ['........', '.ee..ee.', '........', '...ee...'],
  ouch: ['e......e', '.e....e.', 'e......e', '..eeee..'],
  joy: ['.e....e.', 'e.e..e.e', '..eeee..', '...ee...'],
};
const ROCK_S = [
  '...kkkkk....',
  '..khhhbbk...',
  '.khhbbbbbkk.',
  '.khbbbbbbbsk',
  'khbbbbbbbbsk',
  'kbbbbbbbbssk',
  'kbbbbbbbsssk',
  'kssbbbsssssk',
  'kkkkkkkkkkkk',
];
const ROCK_B = [
  '.....kkkkk......',
  '...kkhhhhbkk....',
  '..khhhbbbbbbk...',
  '.khhbbbbbbbbbk..',
  '.khbbbbbbbbbbsk.',
  'khbbbbbbbbbbbbsk',
  'kbbbbbbbbbbbbssk',
  'kbbbsbbbbbbbbssk',
  'kbbbbsbbbbbbsssk',
  'kbbbbbbbbbbssssk',
  'ksssbbbbbssssssk',
  'kkkkkkkkkkkkkkkk',
];
// What is left of a rock after a bump: a little pile of pebbles.
const PILE = [
  '...kk....kkk..',
  '..khbk..kbhbk.',
  '.kbbbskkbbbbsk',
  'kkkkkkkkkkkkkk',
];
const STAR = [
  '...y...',
  '..ywy..',
  'yyyyyyo',
  '.yyyyo.',
  '..yyo..',
  '.yo.yo.',
  '.o...o.',
];
// A 5 x 7 pixel font for the HUD and banners (only the characters the game uses).
const FONT = {
  0: '01110100011000110001100011000101110', 1: '00100011000010000100001000010001110',
  2: '01110100010000100110010001000011111', 3: '11110000010000101110000010000111110',
  4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
  6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000',
  8: '01110100011000101110100011000101110', 9: '01110100011000101111000010001001100',
  A: '01110100011000111111100011000110001', E: '11111100001000011110100001000011111',
  F: '11111100001000011110100001000010000', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100',
  '!': '00100001000010000100001000000000100', '?': '01110100010000100010001000000000100',
  '.': '00000000000000000000000000110001100', ' ': '00000000000000000000000000000000000',
};

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function sprite(rows, pal, solid) {
  const c = canvas(rows[0].length, rows.length);
  const g = c.getContext('2d');
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      const col = solid || (pal && pal[ch]);
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The Earth hanging in the sky: oceans, land, a few clouds, a night side.
function buildEarth() {
  const R = 11, S = 25, c = canvas(S, S), g = c.getContext('2d');
  const land = [[-5, -4, 4.5], [-2, -1, 3], [4, 3, 4], [1, 7, 2.5], [6, -5, 2.2], [-6, 5, 2]];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - 12, dy = y - 12, d2 = dx * dx + dy * dy;
      if (d2 > R * R + 3) continue;
      let isLand = false;
      for (const [lx, ly, lr] of land) if ((dx - lx) ** 2 + (dy - ly) ** 2 < lr * lr) { isLand = true; break; }
      const cloud = (dy === -7 && dx > -2 && dx < 4) || (dy === 2 && dx > -9 && dx < -4) || (dy === 6 && dx > 2 && dx < 8);
      const shade = (dx * 0.75 + dy * 0.55) / R; // light from the top left
      let col;
      if (cloud) col = shade > 0.5 ? '#9fb0cc' : '#eef4ff';
      else if (isLand) col = shade > 0.5 ? '#0d5a31' : '#1fa35c';
      else col = shade > 0.5 ? '#173f8f' : '#3b82f6';
      if (!cloud && shade < -0.62 && d2 > (R - 2) ** 2) col = isLand ? '#5fd38e' : '#7fb2ff';
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// A tileable mountain ridge (periodic sines, so the tile repeats with no seam). Slopes facing the light get a rim.
function buildRidge(w, h, base, waves, col, hi, seed) {
  const c = canvas(w, h), g = c.getContext('2d');
  const r = rng(seed);
  const ph = waves.map(() => r() * Math.PI * 2);
  const raw = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let y = base;
    for (let i = 0; i < waves.length; i++) y += waves[i][1] * Math.sin((Math.PI * 2 * waves[i][0] * x) / w + ph[i]);
    raw[x] = y;
  }
  for (let x = 0; x < w; x++) {
    const y = Math.max(1, Math.min(h - 1, Math.round(raw[x])));
    g.fillStyle = col;
    g.fillRect(x, y, 1, h - y);
    if (raw[(x + 1) % w] - raw[(x - 1 + w) % w] < -0.15) { g.fillStyle = hi; g.fillRect(x, y, 1, 3); }
  }
  return c;
}

// A tileable strip of Moon ground with craters.
function buildGround(w, h, seed) {
  const c = canvas(w, h), g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = C.ground; g.fillRect(0, 0, w, h);
  g.fillStyle = C.gLight; g.fillRect(0, 0, w, 3);
  g.fillStyle = C.gTop; g.fillRect(0, 0, w, 1);
  g.fillStyle = C.gLow; g.fillRect(0, h - 7, w, 7);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = r() < 0.5 ? C.crater : C.gLight;
    g.fillRect(Math.floor(r() * w), 4 + Math.floor(r() * (h - 4)), 1, 1);
  }
  for (let i = 0; i < 15; i++) {
    const rx = 3 + Math.floor(r() * 6), ry = Math.max(1, Math.round(rx * 0.38));
    const cx = 14 + Math.floor(r() * (w - 28)), cy = 5 + ry + Math.floor(r() * (h - 9 - 2 * ry));
    for (let y = -ry - 1; y <= ry + 1; y++) {
      for (let x = -rx - 1; x <= rx + 1; x++) {
        const d = (x / rx) ** 2 + (y / ry) ** 2;
        if (d <= 1) g.fillStyle = y < 0 ? C.crDeep : C.crater;
        else if (d <= 1.7 && y > 0) g.fillStyle = C.gTop;
        else continue;
        g.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }
  return c;
}

// The same pixel star as an outlined SVG, for the "You made it!" card.
const STAR_SVG = (() => {
  const fill = { y: C.yellow, w: C.yellowLt, o: C.orange };
  const on = (x, y) => y >= 0 && y < 7 && x >= 0 && x < 7 && STAR[y][x] !== '.';
  let ink = '', body = '';
  for (let y = -1; y <= 7; y++) {
    for (let x = -1; x <= 7; x++) {
      if (on(x, y)) body += `<rect x="${x + 1}" y="${y + 1}" width="1.02" height="1.02" fill="${fill[STAR[y][x]]}"/>`;
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) ink += `<rect x="${x + 1}" y="${y + 1}" width="1.02" height="1.02" fill="${C.ink}"/>`;
    }
  }
  return `<svg viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true">${ink}${body}</svg>`;
})();

let ART = null;
function art() {
  if (ART) return ART;
  const PB = { k: C.ink, t: C.teal, l: C.tealLt, d: C.tealDk, K: C.lcdDk, g: C.lcd, y: C.yellow, m: C.magenta, n: C.leg };
  const PR = { k: C.rockInk, h: C.rockHi, b: C.rock, s: C.rockSh };
  const body = {}, sil = {}, face = {};
  for (const f of Object.keys(LEGS)) {
    const rows = BODY.concat(LEGS[f]);
    body[f] = sprite(rows, PB);
    sil[f] = sprite(rows, null, '#effffc');
  }
  for (const k of Object.keys(FACES)) face[k] = sprite(FACES[k], { e: C.lcdInk });
  ART = {
    body, sil, face,
    rockS: sprite(ROCK_S, PR), rockB: sprite(ROCK_B, PR), pile: sprite(PILE, PR),
    star: sprite(STAR, { y: C.yellow, w: C.yellowLt, o: C.orange }),
    earth: buildEarth(),
    far: buildRidge(512, 52, 26, [[2, 9], [5, 6], [11, 3]], C.far, C.farHi, 3),
    near: buildRidge(512, 30, 15, [[3, 5], [7, 4], [13, 2]], C.near, C.nearHi, 9),
    ground: buildGround(512, H - GY, 11),
  };
  return ART;
}

// Twinkling background stars (fixed positions, very slow parallax).
const NST = 56;
const BG = (() => {
  const r = rng(42);
  const x = new Float32Array(NST), y = new Uint8Array(NST), sp = new Float32Array(NST), ph = new Float32Array(NST), big = new Uint8Array(NST);
  for (let i = 0; i < NST; i++) {
    x[i] = r() * 360; y[i] = 3 + Math.floor(r() * (GY - 40)); sp[i] = 0.8 + r() * 2.2; ph[i] = r() * 6.3; big[i] = r() < 0.12 ? 1 : 0;
  }
  return { x, y, sp, ph, big };
})();

/* ---------------- CSS ---------------- */
const CSS = `
.t-moonrun { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;
  background: ${C.sky}; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent; cursor: pointer; --u: 5px; }
.t-moonrun .mr-stage { position: relative; flex: none; }
.t-moonrun .mr-cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block;
  image-rendering: crisp-edges; image-rendering: pixelated; }
.t-moonrun .mr-start { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: calc(var(--u) * 4); padding-bottom: calc(var(--u) * 16); pointer-events: none; }
.t-moonrun .mr-start[hidden], .t-moonrun .mr-win[hidden], .t-moonrun .mr-stars[hidden], .t-moonrun .mr-kit[hidden] { display: none; }
.t-moonrun .mr-hand { color: #fff; animation: mr-bob .9s ease-in-out infinite; }
.t-moonrun .mr-hand svg { width: clamp(44px, calc(var(--u) * 12), 72px); height: clamp(44px, calc(var(--u) * 12), 72px); display: block; }
.t-moonrun .mr-tap { font-family: var(--pixel); font-size: clamp(24px, calc(var(--u) * 9), 56px); line-height: 1.25; color: ${C.yellow};
  text-align: center; text-shadow: calc(var(--u) * .9) calc(var(--u) * .9) 0 ${C.ink}; animation: mr-pulse 1.2s ease-in-out infinite; }
.t-moonrun .mr-kit { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; max-width: 92%; }
.t-moonrun .mr-kit .lbl { font: 600 22px/1 var(--font); color: #fff; margin-right: 4px; }
.t-moonrun .mr-chip { display: inline-flex; align-items: center; gap: 6px; height: 46px; padding: 0 16px; border-radius: 23px;
  font: 600 22px/1 var(--font); color: rgba(255,255,255,.62); border: 2px dashed rgba(255,255,255,.4); background: rgba(255,255,255,.06); }
.t-moonrun .mr-chip.on { color: #fff; background: ${C.teal}; border: 2px solid ${C.ink}; box-shadow: 2px 3px 0 ${C.ink}; }
.t-moonrun .mr-chip svg { width: 22px; height: 22px; }
.t-moonrun .mr-win { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 0 3% 0 26%; background: rgba(13,16,38,.38); cursor: default; }
.t-moonrun .mr-card { background: var(--card, #fbf8f2); border: 3px solid var(--edge, #1b1b24); border-radius: 26px;
  box-shadow: var(--pop, 4px 5px 0 #1b1b24); padding: 20px 40px 24px; max-width: 100%; display: flex; flex-direction: column;
  align-items: center; gap: 12px; text-align: center; animation: mr-in .45s cubic-bezier(.2,1.4,.4,1) both; }
.t-moonrun .mr-title { font: 800 clamp(34px, calc(var(--u) * 10), 64px)/1.05 var(--font); color: var(--ink, #1b1b24); }
.t-moonrun .mr-stars { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; max-width: 560px; }
.t-moonrun .mr-stars span { display: block; animation: mr-pop .35s cubic-bezier(.2,1.6,.4,1) both; }
.t-moonrun .mr-stars svg { width: clamp(30px, calc(var(--u) * 8), 46px); height: clamp(30px, calc(var(--u) * 8), 46px); display: block; }
.t-moonrun .mr-count { font: 700 clamp(24px, calc(var(--u) * 6), 36px)/1.15 var(--font); color: var(--ink, #1b1b24); }
.t-moonrun .mr-again { min-height: 100px; font-size: 30px; padding: 0 40px; margin-top: 4px; opacity: 0; transform: scale(.85);
  pointer-events: none; transition: opacity .25s, transform .25s; }
.t-moonrun .mr-again svg { width: 34px; height: 34px; }
.t-moonrun .mr-again.ready { opacity: 1; transform: none; pointer-events: auto; }
.t-moonrun .mr-again.ready:active { transform: translateY(4px); }
@keyframes mr-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes mr-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(calc(var(--u) * 2)); } }
@keyframes mr-in { from { transform: scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes mr-pop { from { transform: scale(0); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) { .t-moonrun .mr-tap, .t-moonrun .mr-hand { animation: none; } }
`;

/* ---------------- The toy ---------------- */
export function mount(el, props, api) {
  const P = props || {};
  api = api || {};
  injectCSS('t-moonrun', CSS);
  const A = art();

  const demo = P.demo === true;
  const silent = P.silent === true;
  const studio = !!P.studio || api.mode === 'studio';
  const missionMode = !studio && api.mode !== 'studio';
  const secsGiven = Number(P.seconds) > 0;
  const secs = secsGiven ? Math.max(4, Math.min(600, Number(P.seconds))) : 45;
  const endless = demo && !secsGiven;
  const autostart = P.autostart === true || (demo && P.autostart !== false);
  const seedBase = Number.isFinite(Number(P.seed)) && P.seed !== undefined ? Number(P.seed) | 0 : (Date.now() & 0xffff) ^ 0x5eed;

  /* ----- DOM ----- */
  const root = document.createElement('div');
  root.className = 't-moonrun';
  root.innerHTML = `<div class="mr-stage">
      <canvas class="mr-cv" width="${MIN_W}" height="${H}" role="img" aria-label="Moon Run: a robot running on the Moon"></canvas>
      <div class="mr-start" hidden><div class="mr-hand">${icon('hand')}</div><div class="mr-tap">TAP TO RUN!</div><div class="mr-kit" hidden></div></div>
      <div class="mr-win" hidden><div class="mr-card" role="dialog" aria-label="You made it!">
        <div class="mr-title">You made it!</div><div class="mr-stars"></div><div class="mr-count"></div>
        <button class="btn go big mr-again" type="button">${icon('refresh')}<span>Play again</span></button>
      </div></div>
    </div>`;
  el.appendChild(root);
  const stage = root.querySelector('.mr-stage');
  const cv = root.querySelector('.mr-cv');
  const startEl = root.querySelector('.mr-start');
  const kitEl = root.querySelector('.mr-kit');
  const winEl = root.querySelector('.mr-win');
  const starsEl = root.querySelector('.mr-stars');
  const countEl = root.querySelector('.mr-count');
  const again = root.querySelector('.mr-again');
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  let W = MIN_W;

  /* ----- Pools (allocated once; nothing big is allocated per frame) ----- */
  const rocks = Array.from({ length: 10 }, () => ({ on: false, x: 0, big: false, hit: false }));
  const stars = Array.from({ length: 64 }, () => ({ on: false, x: 0, y: 0, ph: 0 }));
  const parts = Array.from({ length: 112 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, col: '#fff', g: 0, size: 1, b: false }));
  const flyers = Array.from({ length: 10 }, () => ({ on: false, x: 0, y: 0, t: 0 }));
  const cues = Array.from({ length: 16 }, () => ({ on: false, x: 0, jit: 0 }));
  let pi = 0;

  /* ----- State ----- */
  let state = 'ready';          // ready | run | finish | won
  let dead = false, raf = 0, last = 0, accum = 0, clock = 0, stateT = 0, runT = 0, wonT = 0;
  let dist = 0, speed = 0, h = 0, vy = 0, onGround = true, jumps = 0, bufferT = 0, startAt = 0;
  let stumbleT = 0, knock = 0, starCount = 0, countStr = '0', hudPulse = 0, bannerT = 0, hops = 0, nextHop = 0, dustT = 0;
  let mode = 'medium', faster = false, v1 = 70, v2 = 70, v3 = 70, b1 = Infinity, b2 = Infinity, levelLen = 3000, flagX = 0, phaseIdx = 0;
  let rnd = rng(seedBase), runs = 0, nextX = 0, lastRockX = -1e9, patterns = 0, rocksMade = 0;
  let channel = 'borrow', kit = {}, useDefaults = false;
  let musicSeq = null, winSeq = null, song = null, beatPat = null, beatStep = 0.31, musicOn = false, musicBus = 'lead', chordsMuted = false;
  let lastStarSound = -1, winReady = false, winTimer = 0, saidStart = false, quiet = false;
  const stats = { jump: 0, star: 0, bump: 0, borrow: 0, win: 'none' }; // for getState() and tests

  /* ----- Helpers ----- */
  const say = t => { try { api.say && api.say(t); } catch (e) { /* ignore */ } };
  const done = () => { try { api.done && api.done(); } catch (e) { /* ignore */ } };
  const choices = () => { try { return (store.state && store.state.choices) || {}; } catch (e) { return {}; } };
  const isRecipe = v => !!v && typeof v === 'object' && !Array.isArray(v);
  function readKit() {
    const get = k => { try { return api.kit && api.kit.get ? api.kit.get(k) : null; } catch (e) { return null; } };
    const k = { jump: get('jump'), star: get('star'), bump: get('bump'), music: get('music'), beat: get('beat'), win: get('win') };
    k.jump = isRecipe(k.jump) ? k.jump : null;
    k.star = isRecipe(k.star) ? k.star : null;
    k.bump = isRecipe(k.bump) ? k.bump : null;
    k.music = k.music && typeof k.music === 'object' && k.music.id ? k.music : null;
    k.beat = Array.isArray(k.beat) ? k.beat.filter(b => Array.isArray(b) && b.length >= 2) : null;
    if (k.beat && !k.beat.length) k.beat = null;
    k.win = isRecipe(k.win) && Array.isArray(k.win.notes) ? k.win : null;
    return k;
  }
  const kitEmpty = k => !k.jump && !k.star && !k.bump && !k.music && !k.beat && !k.win;

  /* ----- Layout: integer device-pixel scaling, letterboxed in the sky colour ----- */
  function layout() {
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const s = Math.max(1, Math.floor(Math.min((r.width * dpr) / MIN_W, (r.height * dpr) / H)));
    const w = Math.max(MIN_W, Math.min(MAX_W, Math.floor((r.width * dpr) / s)));
    if (w !== W || cv.width !== w) { W = w; cv.width = W; cv.height = H; g.imageSmoothingEnabled = false; }
    stage.style.width = (W * s) / dpr + 'px';
    stage.style.height = (H * s) / dpr + 'px';
    root.style.setProperty('--u', s / dpr + 'px');
    render();
  }

  /* ----- A run ----- */
  function setupRun() {
    kit = readKit();
    useDefaults = studio && kitEmpty(kit);
    const ch = choices();
    const sp = P.speed || ch.speed;
    mode = sp === 'slow' ? 'slow' : sp === 'fast' ? 'fast' : sp === 'faster' ? 'faster' : 'medium';
    faster = mode === 'faster';
    const c = P.channel || ch.channel;
    channel = c === 'none' || c === 'spare' ? c : 'borrow';
    if (faster) {
      v1 = SPEED.slow; v2 = SPEED.medium; v3 = SPEED.fast;
      b1 = v1 * secs * 0.4; b2 = b1 + v2 * secs * 0.3; levelLen = b2 + v3 * secs * 0.3;
    } else {
      v1 = v2 = v3 = SPEED[mode]; b1 = b2 = Infinity; levelLen = v1 * secs;
    }
    flagX = Math.round(levelLen) + RX + 17;
    rnd = rng(seedBase + runs * 7919);
    runs++;
    for (const r of rocks) r.on = false;
    for (const s of stars) s.on = false;
    for (const p of parts) p.on = false;
    for (const f of flyers) f.on = false;
    for (const q of cues) q.on = false;
    dist = 0; speed = 0; h = 0; vy = 0; onGround = true; jumps = 0; bufferT = 0; stumbleT = 0; knock = 0;
    starCount = 0; countStr = '0'; hudPulse = 0; bannerT = 0; phaseIdx = 0; stateT = 0; runT = 0; hops = 0; dustT = 0;
    nextX = RX + 120; lastRockX = -1e9; patterns = 0; rocksMade = 0; lastStarSound = -1;
    beatStep = BEAT_STEP[faster ? 'slow' : mode];
    spawnAhead();
  }

  const speedFor = d => (d < b1 ? v1 : d < b2 ? v2 : v3);
  const phaseOf = d => (!faster ? 0 : d < b1 ? 0 : d < b2 ? 1 : 2);

  /* ----- Level: friendly patterns, rocks well apart, star arcs that follow the jump ----- */
  function addRock(x, big) {
    for (const r of rocks) if (!r.on) { r.on = true; r.x = Math.round(x); r.big = big; r.hit = false; return r; }
    return null;
  }
  function addStar(x, y) {
    for (const s of stars) if (!s.on) { s.on = true; s.x = Math.round(x); s.y = Math.round(y); s.ph = rnd() * 6.3; return s; }
    return null;
  }
  function addCue(x) {
    for (const q of cues) if (!q.on) { q.on = true; q.x = x; q.jit = (rnd() - 0.5) * 5; return; }
  }
  // Stars along the path of a jump whose highest point is over cx.
  function arc(cx, v, n) {
    const k = (n - 1) / 2, stepX = v * AIR * 0.15;
    for (let i = -k; i <= k; i++) {
      const dx = i * stepX, tau = dx / v;
      addStar(cx + dx, GY - RH / 2 - (JUMP_H - 0.5 * GRAV * tau * tau) + 1);
    }
  }
  function placePattern() {
    const x = nextX;
    const v = speedFor(Math.max(0, x - RX - 8));
    const r = rnd();
    const rockOk = patterns > 0 && x - lastRockX >= v * 1.9;
    let kind;
    if (patterns === 0) kind = 'row';
    else if (rockOk) kind = r < 0.45 ? 'rockArc' : r < 0.6 ? 'rock' : r < 0.82 ? 'row' : 'arc';
    else kind = r < 0.55 ? 'row' : 'arc';
    let len = 0;
    if (kind === 'row') {
      // Low stars: just keep running and they're yours.
      const n = 3 + (rnd() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) addStar(x + i * 14, GY - 9);
      len = (n - 1) * 14;
    } else if (kind === 'arc') {
      // Stars up high: jump to catch them.
      const cx = x + v * AIR * 0.3;
      arc(cx, v, 3);
      if (rnd() < 0.6) addCue(cx);
      len = v * AIR * 0.6;
    } else {
      const big = rnd() < 0.45, w = big ? 16 : 12, cx = x + w / 2;
      addRock(x, big);
      lastRockX = x;
      if (kind === 'rockArc') arc(cx, v, rnd() < 0.5 ? 3 : 5);
      // The demo robot jumps most rocks but bumps about one in five, so the crew hears the bump too.
      const miss = rocksMade > 0 && rnd() < 0.2;
      if (!miss) addCue(cx);
      rocksMade++;
      len = w;
    }
    patterns++;
    nextX = x + len + v * (1.0 + rnd() * 0.7);
  }
  function spawnAhead() {
    const limit = dist + W + 48;
    let guard = 0;
    while (nextX < limit && guard++ < 20) {
      if (!endless && nextX > levelLen + RX - speedFor(levelLen) * 2.2) { nextX = Infinity; break; }
      placePattern();
    }
  }

  /* ----- Sound ----- */
  // Play a kit recipe (or nothing); borrow the music channel while it sounds if the crew chose that.
  function playSfx(recipe, slot) {
    if (silent || !recipe) return 0;
    stats[slot]++;
    if (quiet) return 0;
    let len = 0;
    try { len = sfx(recipe) || 0; } catch (e) { console.warn('moonrun sfx', e); return 0; }
    if (len > 0 && channel === 'borrow' && musicOn) { stats.borrow++; try { borrow(musicBus, now(), len); } catch (e) { /* ignore */ } }
    return len;
  }
  const kitSound = slot => kit[slot] || (useDefaults ? KIT_DEFAULTS[slot] : null);
  const playJump = () => playSfx(kitSound('jump'), 'jump');
  const playBump = () => playSfx(kitSound('bump'), 'bump');
  function playStar() {
    if (channel === 'none') return; // the crew chose: keep the music, no star sound
    if (clock - lastStarSound < 0.06) return;
    lastStarSound = clock;
    playSfx(kitSound('star'), 'star');
  }

  function startMusic() {
    stopMusic();
    if (silent) return;
    try {
      if (channel === 'spare') { muteBus('chords', true); chordsMuted = true; }
      if (kit.music) {
        let s = null;
        try { s = store.song(kit.music.id); } catch (e) { s = null; }
        if (!s) s = demoSongs().find(d => d.id === kit.music.id) || null;
        if (s) {
          song = cleanSong(s); // a copy: speeding it up never changes the saved song
          musicSeq = new Sequencer({ steps: () => stepsOf(song), stepDur: st => stepDur(song, st), schedule: (st, t, d) => scheduleStep(song, st, t, d), loop: true });
          musicBus = 'lead';
          musicOn = !!musicSeq.start(0);
          return;
        }
      }
      if (kit.beat) {
        beatPat = kit.beat;
        musicSeq = new Sequencer({
          steps: 8,
          stepDur: () => beatStep,
          schedule: (st, t) => { for (const b of beatPat) if ((b[0] | 0) === st) drum(DRUM_OF[b[1] | 0] || 'boom', t, { vol: 0.85 }); },
          loop: true,
        });
        // With only a beat there is no tune channel, so an effect borrows the drum channel instead.
        musicBus = 'drums';
        musicOn = !!musicSeq.start(0);
      }
    } catch (e) { console.warn('moonrun music', e); musicOn = false; }
  }
  function stopMusic() {
    if (musicSeq) { try { musicSeq.stop(); } catch (e) { /* ignore */ } }
    musicSeq = null; musicOn = false; song = null; beatPat = null;
  }
  function speedUpMusic() {
    if (song) {
      const up = id => SPEEDS[Math.min(SPEEDS.length - 1, speedIndex(id) + 1)].id;
      song.speed = up(song.speed);
      if (Array.isArray(song.pageSpeed)) song.pageSpeed = song.pageSpeed.map(p => (p ? up(p) : p));
    } else if (beatPat) {
      beatStep = BEAT_STEP[phaseIdx >= 2 ? 'fast' : 'medium'];
    }
  }
  function playWin() {
    stopMusic();
    if (silent) return;
    try { unduckAll(); } catch (e) { /* ignore */ }
    try {
      if (kit.win) {
        const ws = cleanSong(kit.win);
        winSeq = new Sequencer({ steps: () => stepsOf(ws), stepDur: st => stepDur(ws, st), schedule: (st, t, d) => scheduleStep(ws, st, t, d), loop: false });
        winSeq.start(0);
        stats.win = 'song';
      } else if (useDefaults) {
        stats.win = 'fanfare';
        if (!quiet) sfx(FANFARE);
      }
    } catch (e) { console.warn('moonrun win', e); }
  }
  function stopWin() {
    if (winSeq) { try { winSeq.stop(); } catch (e) { /* ignore */ } }
    winSeq = null;
  }

  /* ----- Particles ----- */
  function emit(x, y, vx, vy0, life, col, grav, size, bounce) {
    const p = parts[pi];
    pi = (pi + 1) % parts.length;
    p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy0; p.life = life; p.max = life; p.col = col; p.g = grav; p.size = size; p.b = bounce;
  }
  function dust(x, n, spread) {
    for (let i = 0; i < n; i++) emit(x + (Math.random() - 0.5) * spread, GY - 1 - Math.random() * 2, (Math.random() - 0.5) * 24 - speed * 0.3, -6 - Math.random() * 10, 0.35 + Math.random() * 0.25, C.dust, -6, Math.random() < 0.5 ? 2 : 1, false);
  }

  /* ----- Actions ----- */
  function doJump(v) {
    vy = Math.max(vy, v);
    if (onGround) dust(dist + RX + 8, 3, 8);
    onGround = false;
    jumps++;
    bufferT = 0;
    playJump();
  }
  function tryJump() {
    if (state !== 'run' || performance.now() - startAt < 150) return; // the starting tap never jumps
    if (onGround) doJump(JUMP_V);
    else if (jumps < 2) doJump(JUMP_V * 0.75); // one extra little hop in the air
    else bufferT = 0.16;                        // a tap just before landing still jumps
  }
  function bump(r) {
    r.hit = true;
    stumbleT = 0.65;
    speed = -34;  // knocked back a little
    knock = -3;
    vy = 120; onGround = false; jumps = Math.max(jumps, 1);
    const cx = r.x + (r.big ? 8 : 6), top = GY - (r.big ? 12 : 9);
    for (let i = 0; i < 7; i++) emit(cx + (Math.random() - 0.5) * 8, top + Math.random() * 4, (Math.random() - 0.3) * 60, -50 - Math.random() * 60, 0.9, i & 1 ? C.rock : C.rockSh, 260, 2, true);
    dust(cx, 5, 12);
    playBump();
  }
  function collect(s) {
    s.on = false;
    starCount++;
    countStr = String(starCount);
    const sx = s.x - Math.floor(dist), sy = s.y;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; emit(s.x, sy, Math.cos(a) * 40, Math.sin(a) * 40, 0.3, i & 1 ? C.yellowLt : C.yellow, 0, 1, false); }
    for (const f of flyers) if (!f.on) { f.on = true; f.x = sx; f.y = sy; f.t = 0; break; }
    playStar();
  }

  /* ----- Update (fixed step) ----- */
  function physics(dt) {
    if (onGround) return;
    vy -= GRAV * dt;
    h += vy * dt;
    if (h <= 0) {
      h = 0; vy = 0; onGround = true; jumps = 0;
      dust(dist + RX + 8, 3, 10);
      if (bufferT > 0 && state === 'run') doJump(JUMP_V);
    }
  }
  function demoThink() {
    if (!onGround || speed < 20) return;
    const rc = dist + RX + 8;
    for (const q of cues) {
      if (!q.on) continue;
      const d = q.x - rc;
      if (d < -4) { q.on = false; continue; }
      if (d <= speed * (AIR / 2) + q.jit) { q.on = false; doJump(JUMP_V); return; }
    }
  }
  function collide() {
    const rb = GY - h, rt = rb - RH, wx = dist + RX;
    const fx0 = wx + 4, fx1 = wx + 12;
    for (const r of rocks) {
      if (!r.on || r.hit) continue;
      const w = r.big ? 16 : 12, rh = r.big ? 12 : 9;
      // Forgiving: the rock's hit box is 3 px smaller than its picture on each side and on top.
      if (fx1 > r.x + 3 && fx0 < r.x + w - 3 && rb > GY - rh + 3) bump(r);
    }
    for (const s of stars) {
      if (!s.on) continue;
      // Generous: stars are collected from 5 px around the robot.
      if (s.x > wx - 5 && s.x < wx + RW + 5 && s.y > rt - 6 && s.y < rb + 3) collect(s);
    }
  }
  function cull() {
    const left = Math.floor(dist) - 24;
    for (const r of rocks) if (r.on && r.x + 16 < left) r.on = false;
    for (const s of stars) if (s.on && s.x + 4 < left) s.on = false;
  }
  function update(dt) {
    clock += dt;
    if (bannerT > 0) bannerT -= dt;
    if (hudPulse > 0) hudPulse -= dt;
    for (const p of parts) {
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.b && p.y > GY - 1) { p.y = GY - 1; p.vy *= -0.35; p.vx *= 0.5; }
    }
    for (const f of flyers) {
      if (!f.on) continue;
      f.t += dt / 0.45;
      if (f.t >= 1) { f.on = false; hudPulse = 0.22; }
    }
    if (state === 'ready') return;
    if (state === 'won') { wonT += dt; return; }
    stateT += dt;
    if (state === 'run') {
      runT += dt;
      const tgt = speedFor(dist);
      const acc = stumbleT > 0 ? 150 : 70;
      speed = speed < tgt ? Math.min(tgt, speed + acc * dt) : Math.max(tgt, speed - acc * dt);
      const ph = phaseOf(dist);
      if (ph > phaseIdx) { phaseIdx = ph; bannerT = 1.8; speedUpMusic(); }
      dist += speed * dt;
      if (stumbleT > 0) stumbleT -= dt;
      knock += -knock * Math.min(1, dt * 5);
      if (bufferT > 0) bufferT -= dt;
      if (onGround && speed > 30) { dustT -= dt; if (dustT <= 0) { dustT = 0.28; emit(dist + RX + 3, GY - 1, -10, -4, 0.3, C.dust, -4, 1, false); } }
      if (demo) demoThink();
      physics(dt);
      spawnAhead();
      collide();
      cull();
      if (!endless && dist >= levelLen) { dist = levelLen; finish(); }
    } else if (state === 'finish') {
      physics(dt);
      if (onGround && hops > 0 && stateT > nextHop) { vy = 150; onGround = false; hops--; nextHop = stateT + 0.5; }
      if (stateT > 1.15) showWin();
    }
  }

  function finish() {
    state = 'finish';
    stateT = 0; speed = 0; stumbleT = 0; hops = 2; nextHop = 0.15;
    playWin();
    const fx = flagX, top = GY - 34;
    for (let i = 0; i < 34; i++) emit(fx + (Math.random() - 0.5) * 6, top, (Math.random() - 0.5) * 140, -60 - Math.random() * 110, 1.6 + Math.random() * 0.8, CONFETTI[i % CONFETTI.length], 120, 2, true);
  }
  function showWin() {
    state = 'won';
    wonT = 0;
    const n = starCount, show = Math.min(n, 10);
    let html = '';
    for (let i = 0; i < show; i++) html += `<span style="animation-delay:${(0.25 + i * 0.08).toFixed(2)}s">${STAR_SVG}</span>`;
    starsEl.innerHTML = html;
    starsEl.hidden = show === 0;
    countEl.textContent = n === 0 ? 'Next time, jump for the stars!' : n === 1 ? '1 star!' : `${n} stars!`;
    winEl.hidden = false;
    winReady = false;
    again.classList.remove('ready');
    clearTimeout(winTimer);
    // The button arrives a moment later, so a stray tap can't skip the celebration.
    winTimer = setTimeout(() => { winReady = true; again.classList.add('ready'); }, 900);
    done();
    if (!silent) say('You made it!');
  }

  /* ----- Render ----- */
  function drawText(str, x, y, s, col) {
    g.fillStyle = col;
    for (let i = 0; i < str.length; i++) {
      const gl = FONT[str[i]];
      if (gl) for (let k = 0; k < 35; k++) if (gl.charCodeAt(k) === 49) g.fillRect(x + (k % 5) * s, y + ((k / 5) | 0) * s, s, s);
      x += 6 * s;
    }
  }
  function shadowText(str, x, y, s, col) { drawText(str, x + 1, y + 1, s, C.ink); drawText(str, x, y, s, col); }
  const textW = (str, s) => str.length * 6 * s - s;
  function panel(x, y, w, hh) {
    g.fillStyle = C.hud;
    g.fillRect(x + 1, y, w - 2, hh);
    g.fillRect(x, y + 1, 1, hh - 2);
    g.fillRect(x + w - 1, y + 1, 1, hh - 2);
  }
  function tile(img, off, y) {
    const w = img.width;
    let x = -Math.floor(((off % w) + w) % w);
    for (; x < W; x += w) g.drawImage(img, x, y);
  }
  function drawFlag(x) {
    const top = GY - 34;
    g.fillStyle = C.rockInk; g.fillRect(x - 3, GY - 3, 8, 3);
    g.fillStyle = C.rock; g.fillRect(x - 2, GY - 2, 6, 1);
    g.fillStyle = C.ink; g.fillRect(x - 1, top, 3, GY - top - 2);
    g.fillStyle = C.pole; g.fillRect(x, top + 1, 1, GY - top - 3);
    g.fillStyle = C.ink; g.fillRect(x - 2, top - 3, 5, 3);
    g.fillStyle = C.yellow; g.fillRect(x - 1, top - 3, 3, 2);
    const wave = state === 'run' ? 5 : 10;
    for (let c = 0; c < 12; c++) {
      const yo = Math.round(Math.sin(clock * wave - c * 0.7) * 1.3 * (c / 11));
      g.fillStyle = C.ink; g.fillRect(x + 2 + c, top + yo, 1, 10);
      g.fillStyle = C.red; g.fillRect(x + 2 + c, top + 1 + yo, 1, 8);
      g.fillStyle = C.redDk; g.fillRect(x + 2 + c, top + 8 + yo, 1, 1);
    }
    g.fillStyle = C.ink; g.fillRect(x + 14, top + Math.round(Math.sin(clock * wave - 12 * 0.7) * 1.3), 1, 10);
    // a little star on the flag
    const sy = top + 3 + Math.round(Math.sin(clock * wave - 5 * 0.7) * 0.7);
    g.fillStyle = C.yellow; g.fillRect(x + 7, sy, 1, 3); g.fillRect(x + 6, sy + 1, 3, 1);
  }
  function drawRobot() {
    const top = Math.round(GY - RH - h);
    let x = RX + Math.round(knock);
    if (stumbleT > 0) x += (Math.floor(stumbleT * 30) & 1) ? 1 : -1;
    const sw = Math.max(6, 14 - Math.floor(h / 5));
    g.fillStyle = C.shadow;
    g.fillRect(RX + 8 - (sw >> 1), GY, sw, 1);
    let f = 'stand';
    if (!onGround) f = 'jump';
    else if (state === 'run' && speed > 4) f = (Math.floor(dist / 7) & 1) ? 'runA' : 'runB';
    if (stumbleT > 0.12 && (Math.floor(stumbleT * 16) & 1) === 1) { g.drawImage(A.sil[f], x, top); return; }
    g.drawImage(A.body[f], x, top);
    let face = 'normal';
    if (stumbleT > 0) face = 'ouch';
    else if (state === 'finish' || state === 'won') face = 'joy';
    else if (clock % 3.4 < 0.13) face = 'blink';
    g.drawImage(A.face[face], x + 4, top + 5);
  }
  function render() {
    if (dead) return;
    const cam = Math.floor(dist);
    g.fillStyle = C.sky;
    g.fillRect(0, 0, W, H);
    // twinkling stars
    for (let i = 0; i < NST; i++) {
      let x = (BG.x[i] - dist * 0.03) % 360;
      if (x < 0) x += 360;
      if (x >= W) continue;
      x |= 0;
      const b = Math.sin(clock * BG.sp[i] + BG.ph[i]);
      g.fillStyle = b > 0.55 ? C.star1 : b > -0.3 ? C.star2 : C.star3;
      const y = BG.y[i];
      g.fillRect(x, y, 1, 1);
      if (BG.big[i] && b > 0.55) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
    }
    g.drawImage(A.earth, Math.round(W * 0.3) - 12, 24);
    tile(A.far, Math.floor(dist * 0.12), GY - A.far.height + 2);
    tile(A.near, Math.floor(dist * 0.35), GY - A.near.height + 1);
    tile(A.ground, cam, GY);
    // rocks and pebble piles
    for (const r of rocks) {
      if (!r.on) continue;
      const sx = r.x - cam;
      if (sx < -20 || sx > W + 4) continue;
      if (r.hit) g.drawImage(A.pile, sx - 1, GY - 3);
      else if (r.big) g.drawImage(A.rockB, sx, GY - 11);
      else g.drawImage(A.rockS, sx, GY - 8);
    }
    // stars
    for (const s of stars) {
      if (!s.on) continue;
      const sx = s.x - cam;
      if (sx < -8 || sx > W + 8) continue;
      const bob = Math.sin(clock * 3.2 + s.ph) > 0 ? 0 : 1;
      g.drawImage(A.star, sx - 3, s.y - 3 + bob);
      if (Math.sin(clock * 2.1 + s.ph * 3) > 0.93) { g.fillStyle = C.white; g.fillRect(sx + 3, s.y - 5 + bob, 1, 1); }
    }
    if (!endless) { const fx = flagX - cam; if (fx > -20 && fx < W + 20) drawFlag(fx); }
    drawRobot();
    // particles
    for (const p of parts) {
      if (!p.on) continue;
      const x = Math.round(p.x - cam), y = Math.round(p.y);
      if (x < -2 || x > W + 2) continue;
      g.fillStyle = p.col;
      const s = p.life < p.max * 0.35 ? 1 : p.size;
      g.fillRect(x, y, s, s);
    }
    // stars flying to the counter
    for (const f of flyers) {
      if (!f.on) continue;
      const e = f.t * f.t * (3 - 2 * f.t);
      const x = f.x + (10 - f.x) * e, y = f.y + (10 - f.y) * e - Math.sin(f.t * Math.PI) * 14;
      g.drawImage(A.star, Math.round(x) - 3, Math.round(y) - 3);
    }
    // HUD: star count
    const pw = 16 + textW(countStr, 1) + 5;
    panel(3, 3, pw, 15);
    if (hudPulse > 0) g.drawImage(A.star, 5, 6, 9, 9);
    else g.drawImage(A.star, 6, 7);
    shadowText(countStr, 16, 7, 1, C.white);
    // HUD: how far to the flag
    if (!endless) {
      const x0 = W - 84, x1 = W - 16, y = 10, p = Math.max(0, Math.min(1, dist / levelLen));
      panel(x0 - 13, 3, x1 - x0 + 26, 15);
      g.fillStyle = C.rockHi; g.fillRect(x0 - 9, y - 2, 3, 5); g.fillRect(x0 - 10, y - 1, 5, 3);
      g.fillStyle = C.rock; g.fillRect(x0 - 9, y - 1, 1, 1); g.fillRect(x0 - 7, y + 1, 1, 1);
      g.fillStyle = C.bar; g.fillRect(x0, y, x1 - x0, 2);
      g.fillStyle = C.teal; g.fillRect(x0, y, Math.round(p * (x1 - x0)), 2);
      const mx = x0 + Math.round(p * (x1 - x0));
      g.fillStyle = C.ink; g.fillRect(mx - 3, y - 4, 7, 7);
      g.fillStyle = C.teal; g.fillRect(mx - 2, y - 3, 5, 5);
      g.fillStyle = C.lcd; g.fillRect(mx - 1, y - 2, 3, 2);
      g.fillStyle = C.pole; g.fillRect(x1 + 4, y - 4, 1, 9);
      g.fillStyle = C.red; g.fillRect(x1 + 5, y - 4, 4, 3);
    }
    // FASTER! banner
    if (bannerT > 0 && (bannerT > 0.6 || (Math.floor(bannerT * 8) & 1))) {
      const tw = textW('FASTER!', 1), bx = Math.round((W - tw) / 2);
      panel(bx - 5, 26, tw + 10, 15);
      shadowText('FASTER!', bx, 30, 1, C.yellow);
    }
    // Silent demo: the robot wonders what is missing.
    if (silent && demo && (state === 'run' || state === 'finish') && runT > 3) {
      const tw = textW('...?', 1), bob = Math.sin(clock * 3) > 0 ? 0 : 1;
      shadowText('...?', RX + 8 - (tw >> 1), Math.round(GY - RH - h) - 13 + bob, 1, C.white);
    }
  }

  /* ----- Loop ----- */
  function frame(ts) {
    raf = 0;
    if (dead) return;
    let d = (ts - last) / 1000;
    last = ts;
    if (!(d > 0)) d = 0;
    if (d > 0.1) d = 0.1;
    accum += d;
    while (accum >= DT) { update(DT); accum -= DT; }
    render();
    if (!document.hidden && !(state === 'won' && wonT > 3)) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (dead || raf || document.hidden) return;
    last = performance.now();
    accum = 0;
    raf = requestAnimationFrame(frame);
  }

  /* ----- Start, play again ----- */
  function showStart() {
    if (studio) {
      const slots = [['jump', 'Jump', !!kit.jump], ['star', 'Star', !!kit.star], ['bump', 'Bump', !!kit.bump],
        ['music', kit.music ? 'Music' : kit.beat ? 'Beat' : 'Music', !!(kit.music || kit.beat)], ['win', 'Win', !!kit.win]];
      kitEl.innerHTML = `<span class="lbl">Our sounds</span>` + slots.map(([, name, on]) => `<span class="mr-chip${on ? ' on' : ''}">${on ? icon('check') : ''}${name}</span>`).join('');
      kitEl.hidden = false;
    }
    startEl.hidden = false;
  }
  function go(fromTap) {
    if (dead || state === 'run' || state === 'finish') return;
    startEl.hidden = true;
    winEl.hidden = true;
    stopWin();
    clearTimeout(winTimer);
    winReady = false;
    again.classList.remove('ready');
    if (state !== 'ready') setupRun();
    state = 'run';
    stateT = 0;
    startAt = performance.now();
    if (!silent) { try { ensure(); } catch (e) { /* ignore */ } }
    startMusic();
    if (fromTap && missionMode && !silent && !demo && !saidStart) { saidStart = true; say('Tap to jump!'); }
    kick();
  }
  function press() {
    if (state === 'ready') go(true);
    else if (state === 'run') tryJump();
  }
  function playAgain() {
    if (state !== 'won' || !winReady) return;
    go(true);
  }

  /* ----- Input ----- */
  const onDown = e => {
    if (e.button > 0) return;
    if (e.target && e.target.closest && e.target.closest('.mr-again')) return;
    if (e.cancelable) e.preventDefault();
    press();
  };
  const onAgain = e => {
    e.stopPropagation();
    if (e.button > 0) return;
    playAgain();
  };
  const onAgainClick = () => playAgain(); // keyboard and assistive tech
  const onKey = e => {
    if (dead || !root.isConnected) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const k = e.key;
    const jumpKey = k === ' ' || k === 'Spacebar' || k === 'ArrowUp' || e.code === 'Space';
    if (state === 'won') {
      if ((jumpKey || k === 'Enter') && winReady) { e.preventDefault(); if (!e.repeat) playAgain(); }
      return;
    }
    if (!jumpKey) return;
    e.preventDefault();
    if (e.repeat) return;
    press();
  };
  const onCtx = e => e.preventDefault();
  const onVis = () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
    else kick();
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('contextmenu', onCtx);
  again.addEventListener('pointerdown', onAgain);
  again.addEventListener('click', onAgainClick);
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVis);
  let ro = null;
  if (window.ResizeObserver) { ro = new ResizeObserver(() => layout()); ro.observe(el); }
  else window.addEventListener('resize', layout);

  /* ----- Begin ----- */
  setupRun();
  layout();
  if (autostart) go(false);
  else { showStart(); kick(); }
  if (Number(P.skip) > 0) {
    quiet = true;
    if (state === 'ready') go(false);
    for (let t = 0; t < Math.min(600, Number(P.skip)); t += DT) update(DT);
    quiet = false;
    render();
  }

  return {
    destroy() {
      if (dead) return;
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(winTimer);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', layout);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('contextmenu', onCtx);
      again.removeEventListener('pointerdown', onAgain);
      again.removeEventListener('click', onAgainClick);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      stopMusic();
      stopWin();
      try { stopAll(); unduckAll(); } catch (e) { /* ignore */ }
      try { if (chordsMuted || context()) muteBus('chords', false); } catch (e) { /* ignore */ }
      chordsMuted = false;
      root.remove();
    },
    getState() {
      return {
        state, stars: starCount, progress: endless ? 0 : Math.min(1, dist / levelLen),
        speed: mode, channel, music: song ? 'song' : beatPat ? 'beat' : null, musicOn, defaults: useDefaults, sounds: { ...stats },
      };
    },
  };
}
