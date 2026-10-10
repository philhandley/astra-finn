/*
 * Astra Finn - "Say hello to Mars" (js/games/delay.js)
 *
 * Earth on the left, Mars on the right. The Commander taps "Say hello to Mars"
 * and a glowing radio pulse crosses the gap at the speed of light. A big timer
 * shows the real time (fast-forwarded: 1 real minute = 1 second). Mars Base
 * replies the same way. A Close/Far switch shows the 3 and 22 minute extremes,
 * and a Moon button compares a real-time 1.3 second hop.
 *
 * Facts (research/04-images-facts.md): Mars is 54.6 to 401.4 million km away,
 * so light takes about 3 to 22 minutes one way. The Moon is 384,400 km away,
 * about 1.3 seconds. Mars averages about minus 60 degrees C.
 *
 * ctx.data schema (every field optional):
 * {
 *   "start": "close",              // "close" | "far" | "moon": the trip selected at the start
 *   "secondsPerMinute": 1,         // fast-forward for Mars: screen seconds per real minute
 *   "replies": {                   // replies from the base; {commander} becomes the crew name
 *     "close": "Hello {commander}! It's sunny and minus 60 degrees here.",
 *     "far":   "Hello {commander}! It's sunny and minus 60 degrees here.",
 *     "moon":  "Hello {commander}! Moon Base here. That was quick!"
 *   },
 *   "lesson": "That's why astronauts on Mars must fix things themselves. They can't wait for Earth to answer.",
 *   "moonLesson": "The Moon is so close, talking is almost like a phone call. Mars is much, much further away."
 * }
 *
 * Debug URL params (dev only): debugMode=close|far|moon  debugPhase=out|wait|back|done  debugPulse=0.5
 * debugTimers=1 (run the loop on timers for headless tests)
 */

const MOD = 'delay';
let styleRefs = 0;

const LIGHT_KM_S = 299792.458;
const TRIPS = {
  close: {
    km: 54.6e6, target: 'mars', dist: '55 million km', crew: 60,
    stat: '3 minutes there. 3 minutes back.',
    compare: 'All together, as long as brushing your teeth three times.',
    log: 'Mars close: about 3 minutes each way',
  },
  far: {
    km: 401.4e6, target: 'mars', dist: '401 million km', crew: 60,
    stat: '22 minutes there. 22 minutes back.',
    compare: 'All together, about as long as half a football match!',
    log: 'Mars far: about 22 minutes each way',
  },
  moon: {
    km: 384400, target: 'moon', dist: '384,400 km', crew: 0.6,
    stat: 'About 1 second there. 1 second back.',
    compare: 'Quicker than saying “Hello Moon!” twice.',
    log: 'the Moon: about 1.3 seconds each way',
  },
};
const DEFAULTS = {
  replies: {
    close: "Hello {commander}! It's sunny and minus 60 degrees here.",
    far: "Hello {commander}! It's sunny and minus 60 degrees here.",
    moon: 'Hello {commander}! Moon Base here. That was quick!',
  },
  lesson: "That's why astronauts on Mars must fix things themselves. They can't wait for Earth to answer.",
  moonLesson: 'The Moon is so close, talking is almost like a phone call. Mars is much, much further away.',
};
const CAPTIONS = {
  mars: {
    idle: 'Say “Hello Mars!” out loud. Then press the gold button.',
    out: [
      'Your hello is flying to Mars at the speed of light.',
      'Light could zoom round the Earth 7 times in one second!',
      'Still flying... Mars is very, very far away.',
      'Nothing in the whole universe is faster than light.',
    ],
    wait: 'It reached Mars! The crew takes a minute to write back...',
    back: ['Their answer is flying home to Earth...', 'Still coming... Imagine waiting this long for every answer!'],
    done: 'Message received!',
  },
  moon: {
    idle: 'Say “Hello Moon!” out loud. Then press the gold button.',
    out: ['Your hello is flying to the Moon...'],
    wait: 'It reached the Moon!',
    back: ['The answer is coming back...'],
    done: 'Message received!',
  },
};

const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const RADIO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/></svg>';
const FF = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 6.5v11l8-5.5zM12 6.5v11l8-5.5z"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5.5v13l10.5-6.5z"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/></svg>';

const CSS = `
.g-delay{position:absolute;inset:0;overflow:hidden;color:var(--ink);font-family:var(--font-body);font-size:20px;line-height:1.35;
  background:radial-gradient(80% 70% at 15% 55%,rgba(95,212,255,.07),transparent 70%),radial-gradient(70% 70% at 88% 55%,rgba(255,107,87,.07),transparent 70%),var(--bg);}
.g-delay button{font-family:var(--font-display);-webkit-tap-highlight-color:transparent;}
.g-delay .dl-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
.g-delay .dl-head{position:absolute;left:0;right:0;top:0;z-index:2;display:flex;align-items:center;flex-wrap:wrap;gap:12px 18px;padding:16px 22px 0;}
.g-delay .dl-titles{flex:1;min-width:240px;}
.g-delay .dl-titles h2{font-size:30px;line-height:1.1;}
.g-delay .dl-titles p{margin:4px 0 0;color:var(--ink-2);font-size:20px;}
.g-delay .dl-controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.g-delay .dl-seg{display:inline-flex;padding:4px;gap:4px;border-radius:999px;border:1.5px solid var(--line);background:rgba(14,20,38,.7);}
.g-delay .dl-opt,.g-delay .dl-moon{appearance:none;border:0;cursor:pointer;min-height:56px;padding:0 22px;border-radius:999px;font-size:20px;font-weight:600;
  color:var(--ink-2);background:transparent;transition:background .25s,color .25s,opacity .25s;white-space:nowrap;display:inline-flex;align-items:center;gap:10px;}
.g-delay .dl-opt.on{background:var(--gold);color:var(--bg);}
.g-delay .dl-moon{border:1.5px solid var(--line);background:rgba(14,20,38,.7);min-height:64px;}
.g-delay .dl-moon svg{width:24px;height:24px;}
.g-delay .dl-moon.on{background:var(--cyan);color:var(--bg);border-color:var(--cyan);}
.g-delay .dl-opt:disabled,.g-delay .dl-moon:disabled{opacity:.45;cursor:default;}
.g-delay .dl-opt:focus-visible,.g-delay .dl-moon:focus-visible{outline:3px solid var(--gold);outline-offset:2px;}

.g-delay .dl-console{position:absolute;left:22px;right:22px;bottom:18px;z-index:2;display:grid;grid-template-columns:auto minmax(0,1fr) auto;
  align-items:center;gap:14px 28px;padding:16px 24px;}
.g-delay .dl-kicker{font-family:var(--font-display);font-weight:600;font-size:18px;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);}
.g-delay .dl-time{display:flex;align-items:baseline;gap:6px;font-family:var(--font-display);font-variant-numeric:tabular-nums;line-height:1;margin:6px 0 8px;white-space:nowrap;}
.g-delay .dl-time b{font-weight:600;font-size:60px;color:var(--ink);min-width:1.1ch;text-align:right;}
.g-delay .dl-time span{font-size:24px;color:var(--ink-2);margin-right:10px;}
.g-delay .dl-time.done b{color:var(--gold);}
.g-delay .dl-ff{display:inline-flex;align-items:center;gap:8px;min-height:34px;padding:0 14px;border-radius:999px;border:1px solid rgba(95,212,255,.4);
  color:var(--cyan);font-size:18px;white-space:nowrap;}
.g-delay .dl-ff svg{width:18px;height:18px;flex:none;}
.g-delay .dl-ff.live{animation:dl-blink 1s steps(2,start) infinite;}
@keyframes dl-blink{50%{border-color:rgba(95,212,255,.9);}}
.g-delay .dl-caption{margin:0;font-size:22px;line-height:1.35;color:var(--ink);font-family:var(--font-display);font-weight:500;}
.g-delay .dl-send{min-width:300px;}
.g-delay .dl-send svg{width:30px;height:30px;}

.g-delay.portrait .dl-console{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center;gap:12px;}
.g-delay.portrait .dl-timer{display:flex;flex-direction:column;align-items:center;}
.g-delay.compact .dl-console{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"timer btn" "cap cap";gap:8px 18px;padding:12px 18px;}
.g-delay.compact .dl-timer{grid-area:timer;}
.g-delay.compact .dl-caption{grid-area:cap;font-size:20px;}
.g-delay.compact .dl-send{grid-area:btn;min-width:0;}
.g-delay.compact .dl-time b{font-size:46px;}
.g-delay.short .dl-titles{display:none;}
.g-delay.short .dl-head{justify-content:center;}
.g-delay .dl-ff .ff-short{display:none;}
.g-delay.narrow .dl-ff .ff-long{display:none;}
.g-delay.narrow .dl-ff .ff-short{display:inline;}
.g-delay.narrow .dl-head{padding:12px 14px 0;}
.g-delay.narrow .dl-titles h2{font-size:26px;}
.g-delay.narrow .dl-console{left:12px;right:12px;bottom:12px;padding:14px 16px;}
.g-delay.narrow .dl-opt,.g-delay.narrow .dl-moon{padding:0 16px;font-size:18px;}
.g-delay.narrow .dl-time b{font-size:42px;}
.g-delay.narrow .dl-time{margin:2px 0 4px;}
.g-delay.narrow .dl-console{gap:8px;}
.g-delay.narrow .dl-send{min-width:0;width:100%;padding:0 18px;}
.g-delay.narrow .dl-caption{font-size:20px;}

.g-delay .dl-end{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,3,8,.6);
  animation:dl-fade .4s ease both;}
.g-delay .dl-endcard{width:min(760px,100%);max-height:100%;overflow-y:auto;display:flex;flex-direction:column;gap:14px;
  border-color:rgba(95,212,255,.45);box-shadow:var(--shadow),0 0 70px rgba(95,212,255,.14);animation:dl-rise .5s cubic-bezier(.2,.9,.3,1.1) both;}
.g-delay .dl-endhead{display:flex;align-items:center;gap:14px;}
.g-delay .dl-endhead .dl-kicker{flex:1;}
.g-delay .dl-quote{margin:0;font-family:var(--font-display);font-weight:500;font-size:clamp(24px,2.6vw,32px);line-height:1.25;color:var(--ink);}
.g-delay .dl-more{display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--line);padding-top:14px;animation:dl-rise .6s ease 1.1s both;}
.g-delay .dl-stat{font-family:var(--font-display);font-weight:600;font-size:26px;color:var(--gold);line-height:1.2;}
.g-delay .dl-compare{margin:0;color:var(--ink-2);font-size:20px;}
.g-delay .dl-lesson{margin:0;font-size:22px;line-height:1.4;}
.g-delay .dl-endbtns{display:flex;gap:12px;flex-wrap:wrap;margin-top:4px;animation:dl-rise .6s ease 1.5s both;}
@keyframes dl-fade{from{opacity:0;}to{opacity:1;}}
@keyframes dl-rise{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:none;}}
.g-delay.is-paused,.g-delay.is-paused *{animation-play-state:paused !important;}
@media (prefers-reduced-motion: reduce){.g-delay .dl-end,.g-delay .dl-endcard,.g-delay .dl-more,.g-delay .dl-endbtns,.g-delay .dl-ff.live{animation:none !important;}}
`;

function injectStyle() {
  styleRefs++;
  if (document.querySelector(`style[data-module="${MOD}"]`)) return;
  const s = document.createElement('style');
  s.setAttribute('data-module', MOD);
  s.textContent = CSS;
  document.head.appendChild(s);
}
function releaseStyle() {
  styleRefs = Math.max(0, styleRefs - 1);
  if (styleRefs === 0) {
    const s = document.querySelector(`style[data-module="${MOD}"]`);
    if (s) s.remove();
  }
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = n => (n < 10 ? '0' : '') + n;

// ---------- colour helpers (all derived from the design tokens) ----------
function hexToRgb(h, fallback) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim());
  if (!m) return fallback;
  let x = m[1];
  if (x.length === 3) x = x.split('').map(c => c + c).join('');
  const n = parseInt(x, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function makeSound(on) {
  let ac = null;
  const get = () => {
    if (!on) return null;
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  };
  const tone = (f0, f1, dur, gain = 0.045, delay = 0) => {
    const a = get();
    if (!a) return;
    try {
      const t = a.currentTime + delay;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  };
  return {
    send: () => { tone(520, 1040, 0.35); },
    arrive: () => { tone(660, 660, 0.25, 0.04); tone(990, 990, 0.35, 0.04, 0.12); },
    home: () => { tone(990, 990, 0.25, 0.04); tone(1320, 1320, 0.45, 0.04, 0.12); },
    close: () => { try { if (ac) ac.close(); } catch (e) { /* ignore */ } ac = null; },
  };
}

export async function mount(el, ctx = {}) {
  ctx = ctx || {};
  const data = ctx.data && typeof ctx.data === 'object' ? ctx.data : {};
  const crew = { commander: 'Finn', engineer: 'Dad', ...(ctx.crew || {}) };
  const call = (fn, ...a) => {
    try { return typeof fn === 'function' ? fn(...a) : undefined; } catch (e) { console.warn('[delay]', e); return undefined; }
  };
  const say = t => call(ctx.speak, t);
  const fill = t => String(t == null ? '' : t)
    .replace(/\{commander\}/g, crew.commander || 'Commander')
    .replace(/\{engineer\}/g, crew.engineer || 'Engineer');
  let params;
  try { params = new URLSearchParams(location.search); } catch (e) { params = new URLSearchParams(); }
  let reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  const spm = typeof data.secondsPerMinute === 'number' && data.secondsPerMinute > 0 ? data.secondsPerMinute : 1;
  const replies = { ...DEFAULTS.replies, ...(data.replies && typeof data.replies === 'object' ? data.replies : {}) };
  const lesson = typeof data.lesson === 'string' ? data.lesson : DEFAULTS.lesson;
  const moonLesson = typeof data.moonLesson === 'string' ? data.moonLesson : DEFAULTS.moonLesson;
  const ffLabel = spm === 1 ? 'Fast-forwarded: 1 minute = 1 second' : `Fast-forwarded: 1 minute = ${spm} seconds`;

  let mode = TRIPS[data.start] ? data.start : 'close';
  if (TRIPS[params.get('debugMode')]) mode = params.get('debugMode');

  let destroyed = false;
  let paused = false;
  let frozen = false;
  let raf = 0;
  let last = 0;
  let clock = 0; // scene seconds, pauses with the module
  let run = null; // { mode, phase, t, elapsed, outDur, waitDur, backDur, speed, capIdx }
  let completed = false;
  let lastCaption = '';
  let lastTime = '';
  const ripples = [];
  const sfx = makeSound(!!ctx.sound);

  injectStyle();
  const root = document.createElement('div');
  root.className = 'g-delay';
  root.innerHTML = `
    <canvas class="dl-canvas" aria-hidden="true"></canvas>
    <header class="dl-head">
      <div class="dl-titles"><h2 class="display">Say hello to Mars</h2></div>
      <div class="dl-controls">
        <div class="dl-seg" role="radiogroup" aria-label="How far away is Mars?">
          <button class="dl-opt" data-mode="close" role="radio">Mars close</button>
          <button class="dl-opt" data-mode="far" role="radio">Mars far</button>
        </div>
        <button class="dl-moon" data-mode="moon" aria-pressed="false">${MOON}Try the Moon</button>
        <button class="speak-btn dl-say" aria-label="Read aloud">${SPEAKER}</button>
      </div>
    </header>
    <section class="card dl-console">
      <div class="dl-timer">
        <div class="dl-kicker">Real time</div>
        <div class="dl-time" aria-live="off"></div>
        <div class="dl-ff"></div>
      </div>
      <p class="dl-caption" aria-live="polite"></p>
      <button class="btn big dl-send">${RADIO}<span class="dl-send-t">Say hello to Mars</span></button>
    </section>`;
  el.appendChild(root);

  const q = s => root.querySelector(s);
  const canvas = q('.dl-canvas');
  const g = canvas.getContext('2d');
  const head = q('.dl-head');
  const consoleEl = q('.dl-console');
  const timeEl = q('.dl-time');
  const ffEl = q('.dl-ff');
  const capEl = q('.dl-caption');
  const sendBtn = q('.dl-send');
  const sendT = q('.dl-send-t');
  const titleEl = q('.dl-titles h2');
  const optBtns = [...root.querySelectorAll('[data-mode]')];
  let endEl = null;

  // ---------- colours ----------
  let col = {};
  function readColours() {
    const cs = getComputedStyle(root);
    const v = (name, fb) => hexToRgb(cs.getPropertyValue(name), fb);
    col = {
      bg: v('--bg', [5, 7, 13]), bg2: v('--bg-2', [11, 16, 32]), ink: v('--ink', [243, 239, 230]),
      ink2: v('--ink-2', [185, 192, 207]), ink3: v('--ink-3', [125, 134, 154]), gold: v('--gold', [242, 181, 68]),
      gold2: v('--gold-2', [255, 210, 122]), cyan: v('--cyan', [95, 212, 255]), red: v('--red', [255, 107, 87]),
      green: v('--green', [111, 227, 165]), oxygen: v('--oxygen', [124, 196, 255]), steel: v('--steel', [201, 206, 214]),
    };
  }

  // ---------- geometry ----------
  let W = 0, H = 0, dpr = 1;
  let geo = null;
  const vis = { tx: 0, tr: 0, moon: mode === 'moon' ? 1 : 0, init: false };
  const stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.3, a: Math.random() * 0.6 + 0.2, tw: Math.random() * 2 + 0.5, p: Math.random() * 6.28 });
  }
  const sprites = {};

  function targetFor(m) {
    const gm = geo;
    const span = gm.farX - gm.earthX;
    if (m === 'far') return { x: gm.farX, r: gm.R * 0.54 };
    if (m === 'moon') return { x: gm.earthX + span * 0.34, r: gm.R * 0.34 };
    return { x: gm.earthX + span * 0.6, r: gm.R * 0.6 };
  }

  function layout() {
    if (destroyed) return;
    const w = el.clientWidth || root.clientWidth;
    const h = el.clientHeight || root.clientHeight;
    if (!w || !h) return;
    const portrait = w / h < 1.15;
    root.classList.toggle('portrait', portrait);
    root.classList.toggle('compact', !portrait && w < 1100);
    root.classList.toggle('narrow', w < 620);
    root.classList.toggle('short', w < 1000 && h < 700);
    W = w; H = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    readColours();
    const top = head.offsetTop + head.offsetHeight + 8;
    const bottom = consoleEl.offsetTop - 8;
    const sceneH = Math.max(120, bottom - top);
    const R = clamp(Math.min(sceneH * 0.27, w * (portrait ? 0.12 : 0.1)), 26, 130);
    const earthX = Math.max(w * 0.12, R + 26);
    const farX = w - Math.max(w * 0.12, R * 0.6 + 30);
    const cy = top + sceneH * 0.6;
    geo = { top, bottom, sceneH, R, earthX, farX, cy };
    const t = targetFor(mode);
    if (!vis.init) { vis.tx = t.x; vis.tr = t.r; vis.init = true; } else { vis.tx = clamp(vis.tx, earthX, farX); }
    buildSprites();
    draw();
  }

  // ---------- planet sprites ----------
  function makeCanvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.max(2, Math.ceil(size));
    return c;
  }
  function shade(x, r) {
    const s = x.createRadialGradient(-r * 0.45, -r * 0.5, r * 0.1, -r * 0.2, -r * 0.2, r * 1.35);
    s.addColorStop(0, 'rgba(255,255,255,0.10)');
    s.addColorStop(0.55, 'rgba(0,0,0,0)');
    s.addColorStop(1, rgba(col.bg, 0.82));
    x.fillStyle = s;
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
  }
  function blob(x, r, cx, cy, rx, ry, rot, color) {
    x.save();
    x.translate(cx * r, cy * r);
    x.rotate(rot);
    x.fillStyle = color;
    x.beginPath();
    x.ellipse(0, 0, rx * r, ry * r, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  function planetSprite(kind, r) {
    const pad = r * 0.45;
    const size = (r + pad) * 2 * dpr;
    const c = makeCanvas(size);
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    x.translate(r + pad, r + pad);
    const glowCol = kind === 'earth' ? col.cyan : kind === 'mars' ? col.red : col.steel;
    const glow = x.createRadialGradient(0, 0, r * 0.9, 0, 0, r + pad);
    glow.addColorStop(0, rgba(glowCol, kind === 'moon' ? 0.12 : 0.28));
    glow.addColorStop(1, rgba(glowCol, 0));
    x.fillStyle = glow;
    x.beginPath(); x.arc(0, 0, r + pad, 0, Math.PI * 2); x.fill();
    x.save();
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.clip();
    const base = x.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
    if (kind === 'earth') {
      base.addColorStop(0, rgba(mix(col.oxygen, col.ink, 0.15)));
      base.addColorStop(0.5, rgba(mix(col.cyan, col.bg2, 0.5)));
      base.addColorStop(1, rgba(mix(col.bg2, col.cyan, 0.18)));
      x.fillStyle = base; x.fillRect(-r, -r, r * 2, r * 2);
      const land = rgba(mix(col.green, col.bg2, 0.45), 0.9);
      // two rough continents built from overlapping ovals, plus an ice cap
      [[-0.42, -0.2, 0.26, 0.17, 0.5], [-0.3, 0.02, 0.17, 0.24, -0.2], [-0.12, 0.3, 0.12, 0.26, 0.35], [-0.5, 0.18, 0.1, 0.12, 0],
        [0.3, -0.42, 0.24, 0.12, 0.3], [0.42, -0.18, 0.14, 0.2, -0.4], [0.5, 0.25, 0.12, 0.17, 0.2], [0.28, 0.48, 0.1, 0.08, 0.5]]
        .forEach(b => blob(x, r, b[0], b[1], b[2], b[3], b[4], land));
      blob(x, r, 0, 0.95, 0.42, 0.13, 0, rgba(col.ink, 0.75));
      // soft cloud bands
      [[-0.15, -0.55, 0.42, 0.08, -0.15], [0.22, 0.1, 0.36, 0.07, 0.25], [-0.32, 0.56, 0.3, 0.06, -0.3]]
        .forEach(b => blob(x, r, b[0], b[1], b[2], b[3], b[4], rgba(col.ink, 0.16)));
    } else if (kind === 'mars') {
      base.addColorStop(0, rgba(mix(col.gold, col.red, 0.55)));
      base.addColorStop(0.55, rgba(mix(col.red, col.bg, 0.38)));
      base.addColorStop(1, rgba(mix(col.red, col.bg, 0.72)));
      x.fillStyle = base; x.fillRect(-r, -r, r * 2, r * 2);
      const dark = rgba(mix(col.red, col.bg, 0.62), 0.55);
      [[-0.25, 0.05, 0.3, 0.14, 0.4], [0.3, 0.3, 0.22, 0.12, -0.5], [0.05, -0.35, 0.35, 0.1, 0.1], [-0.45, 0.45, 0.2, 0.1, 0.8]]
        .forEach(b => blob(x, r, b[0], b[1], b[2], b[3], b[4], dark));
      x.strokeStyle = rgba(mix(col.red, col.bg, 0.6), 0.7);
      x.lineWidth = Math.max(1, r * 0.035);
      x.beginPath(); x.moveTo(-0.5 * r, -0.08 * r); x.quadraticCurveTo(0, 0.05 * r, 0.45 * r, -0.12 * r); x.stroke();
      blob(x, r, 0, -0.93, 0.34, 0.12, 0, rgba(col.ink, 0.85));
    } else {
      base.addColorStop(0, rgba(mix(col.steel, col.ink, 0.3)));
      base.addColorStop(0.6, rgba(mix(col.steel, col.bg, 0.35)));
      base.addColorStop(1, rgba(mix(col.steel, col.bg, 0.65)));
      x.fillStyle = base; x.fillRect(-r, -r, r * 2, r * 2);
      const mare = rgba(mix(col.steel, col.bg, 0.6), 0.45);
      [[-0.25, -0.25, 0.3, 0.22, 0.3], [0.25, -0.05, 0.22, 0.18, 0], [0.05, 0.35, 0.18, 0.12, 0]].forEach(b => blob(x, r, b[0], b[1], b[2], b[3], b[4], mare));
      x.strokeStyle = rgba(mix(col.steel, col.bg, 0.55), 0.6);
      x.lineWidth = Math.max(1, r * 0.04);
      [[0.4, 0.4, 0.12], [-0.45, 0.35, 0.09], [0.55, -0.35, 0.08]].forEach(a => { x.beginPath(); x.arc(a[0] * r, a[1] * r, a[2] * r, 0, Math.PI * 2); x.stroke(); });
    }
    shade(x, r);
    x.restore();
    x.strokeStyle = rgba(glowCol, 0.35);
    x.lineWidth = 1.2;
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke();
    return { c, half: r + pad, r };
  }
  function glowSprite(c3) {
    const s = 64;
    const c = makeCanvas(s * dpr);
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, rgba(col.ink, 1));
    gr.addColorStop(0.12, rgba(c3, 0.95));
    gr.addColorStop(0.4, rgba(c3, 0.35));
    gr.addColorStop(1, rgba(c3, 0));
    x.fillStyle = gr;
    x.fillRect(0, 0, s, s);
    return c;
  }
  function buildSprites() {
    if (!geo) return;
    const R = geo.R;
    sprites.earth = planetSprite('earth', R);
    sprites.marsClose = planetSprite('mars', R * 0.6);
    sprites.marsFar = planetSprite('mars', R * 0.54);
    sprites.moon = planetSprite('moon', R * 0.34);
    sprites.gold = glowSprite(col.gold);
    sprites.cyan = glowSprite(col.cyan);
  }
  function drawPlanet(sp, x, y, r, alpha) {
    if (!sp || alpha <= 0.01) return;
    const k = r / sp.r;
    const half = sp.half * k;
    g.globalAlpha = alpha;
    g.drawImage(sp.c, x - half, y - half, half * 2, half * 2);
    g.globalAlpha = 1;
  }

  // ---------- path ----------
  function pathPts() {
    if (!geo) return null;
    const gm = geo;
    const S = { x: gm.earthX + gm.R * 0.8, y: gm.cy - gm.R * 0.58 };
    const E = { x: vis.tx - vis.tr * 0.8, y: gm.cy - vis.tr * 0.58 };
    const span = Math.max(10, E.x - S.x);
    const archH = clamp(span * 0.24, 18, gm.sceneH * 0.36);
    const Q = { x: (S.x + E.x) / 2, y: Math.min(S.y, E.y) - archH };
    return { S, E, Q };
  }
  const bez = (p, u) => {
    const a = 1 - u;
    return { x: a * a * p.S.x + 2 * a * u * p.Q.x + u * u * p.E.x, y: a * a * p.S.y + 2 * a * u * p.Q.y + u * u * p.E.y };
  };

  // ---------- drawing ----------
  function draw() {
    if (!geo || destroyed) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // stars
    for (const s of stars) {
      const tw = reduced ? 1 : 0.65 + 0.35 * Math.sin(clock * s.tw + s.p);
      g.fillStyle = rgba(col.ink, s.a * tw);
      g.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    const p = pathPts();
    // dotted path
    g.save();
    g.lineCap = 'round';
    g.setLineDash([0.5, 11]);
    g.lineWidth = 4;
    g.strokeStyle = rgba(col.ink3, 0.75);
    g.beginPath(); g.moveTo(p.S.x, p.S.y); g.quadraticCurveTo(p.Q.x, p.Q.y, p.E.x, p.E.y); g.stroke();
    g.restore();
    // lit trail behind the pulse
    const pulse = pulseState();
    if (pulse) {
      g.save();
      g.lineCap = 'round';
      g.lineWidth = 3;
      g.strokeStyle = rgba(pulse.back ? col.cyan : col.gold, 0.35);
      g.beginPath();
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const u = pulse.back ? 1 - (1 - pulse.u) * (i / n) : pulse.u * (i / n);
        const pt = bez(p, u);
        if (i === 0) g.moveTo(pt.x, pt.y); else g.lineTo(pt.x, pt.y);
      }
      g.stroke();
      g.restore();
    }
    // distance label
    const apex = bez(p, 0.5);
    g.font = `600 20px ${fontFamily()}`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillStyle = rgba(col.cyan, 0.95);
    label(TRIPS[mode].dist, apex.x, apex.y - 30);
    // planets
    const gm = geo;
    drawPlanet(sprites.earth, gm.earthX, gm.cy, gm.R, 1);
    const marsA = 1 - vis.moon;
    if (vis.moon > 0.01) {
      // ghost of Mars far away, so the Moon's closeness is obvious
      drawPlanet(sprites.marsFar, gm.farX, gm.cy, gm.R * 0.54, 0.3 * vis.moon);
      g.font = `600 20px ${fontFamily()}`;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.fillStyle = rgba(col.ink3, 0.9 * vis.moon);
      label('Mars is way out here', gm.farX, Math.min(gm.cy + gm.R * 0.54 + 16, gm.bottom - 26));
    }
    const marsSp = mode === 'far' ? sprites.marsFar : sprites.marsClose;
    if (marsA > 0.01) drawPlanet(marsSp, vis.tx, gm.cy, vis.moon > 0.01 ? gm.R * 0.6 : vis.tr, marsA);
    if (vis.moon > 0.01) drawPlanet(sprites.moon, vis.tx, gm.cy, gm.R * 0.34, vis.moon);
    // labels
    g.font = `600 22px ${fontFamily()}`;
    g.textBaseline = 'top';
    g.fillStyle = rgba(col.ink2, 1);
    const ly = Math.min(gm.cy + gm.R + 16, gm.bottom - 26);
    label('Earth', gm.earthX, ly);
    label(vis.moon > 0.5 ? 'Moon' : 'Mars', vis.tx, Math.min(gm.cy + Math.max(vis.tr, gm.R * 0.34) + 16, gm.bottom - 26));
    // antenna dots at both ends
    endDot(p.S, col.gold, 1);
    const waiting = run && run.phase === 'wait';
    endDot(p.E, col.cyan, waiting ? 0.6 + 0.4 * Math.sin(clock * 9) : 1);
    // ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      const age = clock - rp.t0;
      if (age > 1.6) { ripples.splice(i, 1); continue; }
      if (age < 0) continue;
      const k = age / 1.6;
      g.strokeStyle = rgba(rp.c, (1 - k) * 0.8);
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(rp.x, rp.y, 8 + k * Math.max(50, gm.R * 0.7), 0, Math.PI * 2); g.stroke();
    }
    // pulse
    if (pulse) {
      const sp = pulse.back ? sprites.cyan : sprites.gold;
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let k = 14; k >= 1; k--) {
        const u = pulse.back ? pulse.u + k * 0.011 : pulse.u - k * 0.011;
        if (u < 0 || u > 1) continue;
        const pt = bez(p, u);
        const sz = 34 * (1 - k / 16);
        g.globalAlpha = 0.5 * (1 - k / 15);
        g.drawImage(sp, pt.x - sz / 2, pt.y - sz / 2, sz, sz);
      }
      const hp = bez(p, pulse.u);
      const breathe = reduced ? 1 : 1 + 0.12 * Math.sin(clock * 12);
      const sz = 64 * breathe;
      g.globalAlpha = 1;
      g.drawImage(sp, hp.x - sz / 2, hp.y - sz / 2, sz, sz);
      g.restore();
    }
  }
  // centred text, nudged inside the canvas edges
  function label(text, x, y) {
    const half = g.measureText(text).width / 2;
    g.fillText(text, clamp(x, half + 10, W - half - 10), y);
  }
  function endDot(pt, c3, a) {
    g.fillStyle = rgba(c3, 0.25 * a);
    g.beginPath(); g.arc(pt.x, pt.y, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgba(c3, a);
    g.beginPath(); g.arc(pt.x, pt.y, 4, 0, Math.PI * 2); g.fill();
  }
  let fam = '';
  function fontFamily() {
    if (!fam) fam = (getComputedStyle(root).getPropertyValue('--font-display') || '').trim() || '"Space Grotesk", system-ui, sans-serif';
    return fam;
  }
  function pulseState() {
    if (!run) return null;
    if (run.phase === 'out') return { u: clamp(run.t / run.outDur, 0, 1), back: false };
    if (run.phase === 'back') return { u: clamp(1 - run.t / run.backDur, 0, 1), back: true };
    return null;
  }

  // ---------- HUD ----------
  function setTime(real, done) {
    let html;
    if (TRIPS[mode].target === 'moon') {
      html = `<b>${real.toFixed(1)}</b><span>s</span>`;
    } else {
      const total = Math.floor(real);
      html = `<b>${Math.floor(total / 60)}</b><span>min</span><b>${pad2(total % 60)}</b><span>s</span>`;
    }
    if (html !== lastTime) { timeEl.innerHTML = html; lastTime = html; }
    timeEl.classList.toggle('done', !!done);
  }
  function setCaption(t) {
    if (t !== lastCaption) { capEl.textContent = t; lastCaption = t; }
  }
  function captionFor() {
    const set = CAPTIONS[TRIPS[mode].target];
    if (!run) return set.idle;
    if (run.phase === 'out' || run.phase === 'back') {
      const list = set[run.phase];
      const idx = Math.floor(run.t / 5.5) % list.length;
      return list[idx];
    }
    return set[run.phase] || set.done;
  }
  function renderHUD() {
    const moon = TRIPS[mode].target === 'moon';
    optBtns.forEach(b => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('on', on);
      if (b.classList.contains('dl-moon')) b.setAttribute('aria-pressed', on ? 'true' : 'false');
      else b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.disabled = !!(run && run.phase !== 'done');
    });
    titleEl.textContent = moon ? 'Say hello to the Moon' : 'Say hello to Mars';
    sendT.textContent = run && run.phase !== 'done' ? 'On its way...' : moon ? 'Say hello to the Moon' : 'Say hello to Mars';
    sendBtn.disabled = !!(run && run.phase !== 'done');
    sendBtn.classList.toggle('glow', !run || run.phase === 'done');
    ffEl.innerHTML = moon
      ? `${PLAY}<span class="ff-long">Real speed. No fast-forward!</span><span class="ff-short">Real speed</span>`
      : `${FF}<span class="ff-long">${esc(ffLabel)}</span><span class="ff-short">Fast-forwarded</span>`;
    ffEl.classList.toggle('live', !!(run && run.phase !== 'done') && !moon);
    if (!run) setTime(0, false);
    setCaption(captionFor());
  }

  // ---------- run ----------
  function startRun() {
    if (run && run.phase !== 'done') return;
    closeEnd();
    const trip = TRIPS[mode];
    const oneWay = trip.km / LIGHT_KM_S;
    const speed = trip.target === 'moon' ? 1 : 60 / spm;
    run = { mode, phase: 'out', t: 0, elapsed: 0, speed, outDur: oneWay / speed, waitDur: trip.crew / speed, backDur: oneWay / speed };
    run.total = run.outDur + run.waitDur + run.backDur;
    addRipples(pathPts()?.S, col.gold);
    sfx.send();
    if (trip.target === 'mars') say('Message sent! It flies at the speed of light.');
    renderHUD();
  }
  function addRipples(pt, c3) {
    if (!pt) return;
    for (let i = 0; i < 3; i++) ripples.push({ x: pt.x, y: pt.y, c: c3, t0: clock + i * 0.25 });
  }
  function step(dt) {
    clock += dt;
    if (geo) {
      const t = targetFor(mode);
      const k = reduced ? 1 : 1 - Math.exp(-dt * 5);
      vis.tx += (t.x - vis.tx) * k;
      vis.tr += (t.r - vis.tr) * k;
      vis.moon += ((mode === 'moon' ? 1 : 0) - vis.moon) * k;
      if (Math.abs(vis.moon - (mode === 'moon' ? 1 : 0)) < 0.002) vis.moon = mode === 'moon' ? 1 : 0;
    }
    if (!run || run.phase === 'done' || frozen) return;
    run.t += dt;
    run.elapsed = Math.min(run.total, run.elapsed + dt);
    if (run.phase === 'out' && run.t >= run.outDur) {
      run.t -= run.outDur;
      run.phase = 'wait';
      addRipples(pathPts()?.E, col.gold);
      sfx.arrive();
      if (run.outDur > 8) say(TRIPS[mode].target === 'moon' ? 'It reached the Moon!' : 'It reached Mars! Now the crew writes back.');
    }
    if (run.phase === 'wait' && run.t >= run.waitDur) {
      run.t -= run.waitDur;
      run.phase = 'back';
      addRipples(pathPts()?.E, col.cyan);
    }
    if (run.phase === 'back' && run.t >= run.backDur) {
      run.phase = 'done';
      run.elapsed = run.total;
      addRipples(pathPts()?.S, col.cyan);
      sfx.home();
      finishRun();
    }
    setTime(run.elapsed * run.speed, run.phase === 'done');
    setCaption(captionFor());
  }
  function finishRun() {
    renderHUD();
    const trip = TRIPS[mode];
    const moon = trip.target === 'moon';
    const reply = fill(replies[mode] || DEFAULTS.replies[mode]);
    const les = fill(moon ? moonLesson : lesson);
    call(ctx.log, moon ? `Said hello to ${trip.log}.` : `Said hello to Mars (${trip.log}).`);
    if (!completed) { completed = true; call(ctx.complete); }
    showEnd(reply, les);
    say(`${reply} ${les}`);
  }
  function showEnd(reply, les) {
    closeEnd();
    const trip = TRIPS[mode];
    const moon = trip.target === 'moon';
    const next = mode === 'close' ? ['far', 'Try Mars far'] : mode === 'far' ? ['moon', 'Try the Moon'] : ['close', 'Try Mars'];
    endEl = document.createElement('div');
    endEl.className = 'dl-end';
    endEl.innerHTML = `<div class="card dl-endcard" role="dialog" aria-label="Reply">
      <div class="dl-endhead"><div class="dl-kicker">Reply from ${moon ? 'Moon Base' : 'Mars Base'}</div>
        <button class="speak-btn dl-end-say" aria-label="Read aloud">${SPEAKER}</button></div>
      <p class="dl-quote">&ldquo;${esc(reply)}&rdquo;</p>
      <div class="dl-more">
        <div class="dl-stat">${esc(trip.stat)}</div>
        <p class="dl-compare">${esc(trip.compare)}</p>
        <p class="dl-lesson">${esc(les)}</p>
      </div>
      <div class="dl-endbtns">
        <button class="btn big dl-next" data-next="${next[0]}">${esc(next[1])}</button>
        <button class="btn ghost big dl-close">Close</button>
      </div>
    </div>`;
    endEl.dataset.speech = `${reply} ${les}`;
    root.appendChild(endEl);
  }
  function closeEnd() {
    if (endEl) { endEl.remove(); endEl = null; }
  }
  function setMode(m) {
    if (!TRIPS[m] || (run && run.phase !== 'done')) return;
    mode = m;
    run = null;
    frozen = false;
    closeEnd();
    renderHUD();
  }

  // ---------- loop ----------
  // debugTimers=1 (dev only) drives the loop with timers so headless tests without frames still run.
  const useTimers = params.get('debugTimers') === '1';
  const schedule = () => (useTimers ? setTimeout(() => frame(performance.now()), 16) : requestAnimationFrame(frame));
  const unschedule = id => (useTimers ? clearTimeout(id) : cancelAnimationFrame(id));
  function frame(now) {
    raf = 0;
    if (destroyed || paused) return;
    const dt = last ? clamp((now - last) / 1000, 0, 0.1) : 0;
    last = now;
    step(dt);
    draw();
    raf = schedule();
  }
  function startLoop() {
    if (raf || destroyed || paused) return;
    last = 0;
    raf = schedule();
  }
  function onVis() {
    paused = !!document.hidden;
    root.classList.toggle('is-paused', paused);
    if (paused) { unschedule(raf); raf = 0; } else startLoop();
  }

  // ---------- events ----------
  function onClick(e) {
    if (destroyed) return;
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.dl-send')) { startRun(); return; }
    const nx = t.closest('.dl-next');
    if (nx) { setMode(nx.dataset.next); return; }
    if (t.closest('.dl-close')) { closeEnd(); return; }
    if (t.closest('.dl-end-say')) { if (endEl) say(endEl.dataset.speech); return; }
    if (t.closest('.dl-say')) {
      const moon = TRIPS[mode].target === 'moon';
      say(moon
        ? 'Say hello to the Moon! Press the gold button and watch your message fly. The Moon is very close.'
        : 'Say hello to Mars! Press the gold button and watch your message fly. How long will Mars take to answer?');
      return;
    }
    const opt = t.closest('[data-mode]');
    if (opt && root.contains(opt)) setMode(opt.dataset.mode);
  }
  root.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVis);
  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => { if (!destroyed) layout(); });
    ro.observe(el);
  }

  renderHUD();
  layout();

  // ---------- dev-only debug params ----------
  const dPhase = params.get('debugPhase');
  if (params.has('debugPulse') || dPhase) {
    startRun();
    call(ctx.stopSpeaking);
    const u = clamp(Number(params.get('debugPulse')) || 0, 0, 1);
    const ph = ['out', 'wait', 'back', 'done'].includes(dPhase) ? dPhase : 'out';
    ripples.length = 0;
    if (ph === 'done') {
      run.phase = 'done'; run.elapsed = run.total;
      setTime(run.total * run.speed, true);
      finishRun();
    } else {
      run.phase = ph;
      const dur = ph === 'out' ? run.outDur : ph === 'wait' ? run.waitDur : run.backDur;
      run.t = dur * u;
      run.elapsed = (ph === 'out' ? 0 : ph === 'wait' ? run.outDur : run.outDur + run.waitDur) + run.t;
      frozen = true;
      setTime(run.elapsed * run.speed, false);
      renderHUD();
    }
    draw();
  }

  onVis();
  startLoop();

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    unschedule(raf);
    raf = 0;
    try { if (ro) ro.disconnect(); } catch (e) { /* ignore */ }
    document.removeEventListener('visibilitychange', onVis);
    root.removeEventListener('click', onClick);
    sfx.close();
    try { root.remove(); } catch (e) { /* ignore */ }
    releaseStyle();
  }
  return { destroy };
}
