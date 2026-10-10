// Astra Finn: "Size Explorer" (scale.js)
// Two modes, chosen by ctx.data.mode:
//   "asteroids" (default): pick a space rock and something to compare it with; both stand on a
//                          horizon line at true relative scale, the camera eases so the bigger one
//                          fills about 70% of the height, and a computed caption explains the size.
//   "zoom": "The Big Zoom". One giant slider drives a log-scale camera from Finn (1.2 m) out to the Sun.
// ctx.data schema:
//   { mode: "asteroids" | "zoom",
//     asteroid: "bennu",            // first rock shown (ids below)
//     compare: "house",             // first comparison object (ids below)
//     asteroids: ["bennu", ...],    // optional subset/order of rock chips
//     objects: ["finn", ...],       // optional subset/order of comparison chips
//     start: 0 }                    // zoom mode: starting slider position 0..1
// Rock ids: chelyabinsk, yr4, dimorphos, apophis, bennu, ryugu, dino, eros, vesta, ceres
// Object ids: finn, house, bus, bigben, pitch, starship, eiffel, everest, gb

const TAU = Math.PI * 2;
const GOLD = '#f2b544', GOLD2 = '#ffd27a', INK = '#f3efe6', INK2 = '#b9c0cf', INK3 = '#7d869a';
const BG = '#05070d', BG2 = '#0b1020';
const FONT_D = '"Space Grotesk", system-ui, sans-serif';
const FONT_B = 'Inter, system-ui, sans-serif';

const CSS = `
.g-scale { position:absolute; inset:0; display:flex; flex-direction:column; background:var(--bg); color:var(--ink); font-family:var(--font-body); overflow:hidden; user-select:none; -webkit-user-select:none; }
.g-scale .gs-view { position:relative; flex:1 1 auto; min-height:0; }
.g-scale canvas.gs-canvas { position:absolute; inset:0; width:100%; height:100%; display:block; touch-action:none; }
.g-scale .gs-cap { position:absolute; left:0; right:0; top:0; padding:16px clamp(16px,3vw,40px) 0; text-align:center; pointer-events:none; }
.g-scale .gs-cap-main { font-family:var(--font-display); font-weight:600; font-size:clamp(26px,2.7vw,34px); line-height:1.16; color:var(--ink); max-width:1040px; margin:0 auto; text-wrap:balance; text-shadow:0 2px 18px rgba(0,0,0,.7); transition:opacity .25s ease; }
.g-scale .gs-cap-main.swap { opacity:.15; }
.g-scale .gs-cap-sub { margin-top:6px; font-size:19px; color:var(--ink-2); text-shadow:0 2px 12px rgba(0,0,0,.7); }
.g-scale .gs-cap-sub b { color:var(--gold); font-weight:600; }
.g-scale .gs-cap-sub i { font-style:normal; color:var(--ink-3); padding:0 8px; }
.g-scale .gs-pick { flex:none; display:flex; flex-direction:column; gap:8px; padding:10px 0 12px; border-top:1px solid var(--line); background:linear-gradient(180deg, rgba(11,16,32,.92), rgba(5,7,13,.98)); }
.g-scale .gs-row { display:flex; align-items:center; gap:10px; min-width:0; }
.g-scale .gs-rowlabel { flex:none; width:128px; padding-left:clamp(12px,2vw,24px); font-family:var(--font-display); font-size:18px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); line-height:1.1; }
.g-scale .gs-chips { flex:1; min-width:0; display:flex; gap:10px; overflow-x:auto; overflow-y:hidden; padding:3px 40px 3px 3px; scrollbar-width:none; touch-action:pan-x; -webkit-overflow-scrolling:touch; -webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 48px),transparent); mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 48px),transparent); }
.g-scale .gs-chips::-webkit-scrollbar { display:none; }
.g-scale .gs-chip { flex:none; appearance:none; cursor:pointer; display:inline-flex; align-items:center; gap:10px; min-height:60px; padding:0 20px 0 10px; border-radius:999px; border:1.5px solid var(--line); background:rgba(255,255,255,.04); color:var(--ink); font-family:var(--font-display); font-size:20px; font-weight:600; white-space:nowrap; transition:background .2s, border-color .2s, transform .15s, box-shadow .2s; }
.g-scale .gs-chip:active { transform:scale(.96); }
.g-scale .gs-chip canvas { width:40px; height:40px; flex:none; display:block; }
.g-scale .gs-chip .sz { font-family:var(--font-body); font-weight:500; font-size:18px; color:var(--ink-2); }
.g-scale .gs-chip.on { background:rgba(242,181,68,.15); border-color:var(--gold); box-shadow:inset 0 0 0 1px var(--gold), 0 0 22px rgba(242,181,68,.18); }
.g-scale .gs-chip.on .sz { color:var(--gold-2); }
.g-scale .gs-zoombar { flex:none; display:flex; align-items:center; gap:14px; padding:8px clamp(14px,3vw,36px) 12px; border-top:1px solid var(--line); background:linear-gradient(180deg, rgba(11,16,32,.92), rgba(5,7,13,.98)); }
.g-scale .gs-end { flex:none; min-width:56px; text-align:center; font-family:var(--font-display); font-weight:600; font-size:20px; color:var(--ink-2); line-height:1.1; }
.g-scale .gs-end small { display:block; font-family:var(--font-body); font-weight:500; font-size:18px; color:var(--ink-3); }
.g-scale .gs-slider { position:relative; flex:1; min-width:120px; height:92px; touch-action:none; cursor:pointer; outline:none; }
.g-scale .gs-track { position:absolute; left:38px; right:38px; top:50%; height:14px; margin-top:-7px; border-radius:999px; background:rgba(255,255,255,.08); box-shadow:inset 0 0 0 1px var(--line); }
.g-scale .gs-fill { position:absolute; left:0; top:0; bottom:0; width:0; border-radius:999px; background:linear-gradient(90deg, rgba(242,181,68,.35), var(--gold)); }
.g-scale .gs-tick { position:absolute; top:50%; width:10px; height:10px; margin:-5px 0 0 -5px; border-radius:50%; background:var(--ink-3); transition:background .2s, transform .2s; }
.g-scale .gs-tick.on { background:var(--gold-2); }
.g-scale .gs-thumb { position:absolute; top:50%; left:38px; width:76px; height:76px; margin:-38px 0 0 -38px; border-radius:50%; background:radial-gradient(circle at 35% 30%, var(--gold-2), var(--gold) 60%, #c98f22); color:#1a1205; display:grid; place-items:center; box-shadow:0 8px 28px rgba(0,0,0,.55), 0 0 0 7px rgba(242,181,68,.16); transition:transform .15s ease; pointer-events:none; }
.g-scale .gs-slider.drag .gs-thumb { transform:scale(1.1); }
.g-scale .gs-slider:focus-visible .gs-thumb { outline:3px solid var(--cyan); outline-offset:4px; }
.g-scale .gs-thumb svg { width:36px; height:36px; }
.g-scale .gs-hint { position:absolute; left:38px; bottom:calc(50% + 44px); font-family:var(--font-display); font-weight:600; font-size:19px; color:var(--gold-2); white-space:nowrap; pointer-events:none; animation:gsNudge 1.6s ease-in-out infinite; transition:opacity .4s; }
.g-scale .gs-hint.gone { opacity:0; }
@keyframes gsNudge { 0%,100% { transform:translateX(0); } 50% { transform:translateX(12px); } }
@media (max-width:640px) {
  .g-scale .gs-row { flex-direction:column; align-items:stretch; gap:4px; }
  .g-scale .gs-rowlabel { width:auto; }
  .g-scale .gs-chips { padding-left:12px; }
  .g-scale .gs-end { min-width:44px; font-size:18px; }
}
@media (prefers-reduced-motion: reduce) { .g-scale .gs-hint { animation:none; } }
`;

function injectCSS() {
  if (document.querySelector('style[data-module="scale"]')) return;
  const s = document.createElement('style');
  s.setAttribute('data-module', 'scale');
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ---------- small helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const rgb = (r, g, b, a = 1) => `rgba(${clamp(Math.round(r), 0, 255)},${clamp(Math.round(g), 0, 255)},${clamp(Math.round(b), 0, 255)},${a})`;
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function fmtLen(m) {
  if (m < 1000) return (m < 10 ? +m.toFixed(1) : Math.round(m)).toLocaleString('en-GB') + ' m';
  const km = m / 1000;
  return (km < 10 ? +km.toFixed(1) : Math.round(km)).toLocaleString('en-GB') + ' km';
}

// Round a big count to something a six-year-old (and Dad) can say.
function roundNice(x) {
  if (x < 20) return Math.max(1, Math.round(x));
  if (x < 100) return Math.round(x / 5) * 5;
  if (x < 1000) return Math.round(x / 10) * 10;
  if (x < 10000) return Math.round(x / 100) * 100;
  const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / p) * p;
}
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// For x >= 1.35. Returns { text, about, whole }.
function countOf(x) {
  let v, text, whole = true;
  if (x < 1.75) { v = 1.5; text = 'one and a half'; whole = false; }
  else if (x < 2.25) { v = 2; text = 'two'; }
  else if (x < 2.75) { v = 2.5; text = 'two and a half'; whole = false; }
  else if (x < 10.4 && Math.abs(x - (Math.floor(x) + 0.5)) < 0.12) { v = Math.floor(x) + 0.5; text = WORDS[Math.floor(x)] + ' and a half'; whole = false; }
  else { v = roundNice(x); text = v.toLocaleString('en-GB'); }
  const about = Math.abs(v - x) / x > 0.04 ? 'about ' : '';
  return { v, text, about, whole };
}
// For 1.35 <= q < 2.75: "one and a half times" / "twice" / "two and a half times".
function timesOf(q) {
  const v = q < 1.75 ? 1.5 : q < 2.25 ? 2 : 2.5;
  const text = v === 1.5 ? 'one and a half times' : v === 2 ? 'twice' : 'two and a half times';
  return { text, about: Math.abs(v - q) / q > 0.04 ? 'about ' : '' };
}

// ---------- silhouettes ----------
// A builder that turns shapes given in metres (x right, y up from the ground) into screen Path2Ds.
function rrPath(p, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath();
}
function builder(x0, y0, s) {
  const parts = [];
  const X = a => x0 + a * s, Y = b => y0 - b * s;
  const b = {
    parts,
    poly(pts) { const p = new Path2D(); pts.forEach(([a, c], i) => (i ? p.lineTo(X(a), Y(c)) : p.moveTo(X(a), Y(c)))); p.closePath(); parts.push(p); return b; },
    rect(a, c, w, h) { const p = new Path2D(); p.rect(X(a), Y(c + h), w * s, h * s); parts.push(p); return b; },
    rr(a, c, w, h, r) { const p = new Path2D(); rrPath(p, X(a), Y(c + h), w * s, h * s, r * s); parts.push(p); return b; },
    circ(a, c, r) { const p = new Path2D(); p.arc(X(a), Y(c), Math.max(0.05, r * s), 0, TAU); parts.push(p); return b; },
    path(cmds) {
      const p = new Path2D();
      for (const k of cmds) {
        if (k[0] === 'M') p.moveTo(X(k[1]), Y(k[2]));
        else if (k[0] === 'L') p.lineTo(X(k[1]), Y(k[2]));
        else if (k[0] === 'Q') p.quadraticCurveTo(X(k[1]), Y(k[2]), X(k[3]), Y(k[4]));
        else if (k[0] === 'C') p.bezierCurveTo(X(k[1]), Y(k[2]), X(k[3]), Y(k[4]), X(k[5]), Y(k[6]));
      }
      p.closePath(); parts.push(p); return b;
    },
  };
  return b;
}

// Great Britain mainland, approximate coastline (lon, lat), clockwise from Land's End.
const GB_LL = [
  [-5.72, 50.07], [-5.2, 49.96], [-5.05, 50.15], [-4.14, 50.34], [-3.64, 50.22], [-3.5, 50.45], [-3.4, 50.62], [-2.95, 50.72],
  [-2.45, 50.52], [-1.95, 50.6], [-1.4, 50.83], [-0.79, 50.72], [-0.14, 50.81], [0.25, 50.73], [0.97, 50.91], [1.38, 51.14],
  [1.44, 51.38], [0.7, 51.47], [0.95, 51.75], [1.28, 51.94], [1.57, 52.09], [1.76, 52.48], [1.3, 52.93], [0.5, 52.95],
  [0.2, 52.8], [0.35, 53.15], [0.12, 53.58], [-0.07, 54.12], [-0.6, 54.49], [-1.18, 54.69], [-1.37, 54.91], [-1.5, 55.13],
  [-1.8, 55.67], [-2.0, 55.77], [-2.13, 55.92], [-2.5, 56.0], [-3.2, 55.97], [-3.6, 56.05], [-3.0, 56.12], [-2.58, 56.28],
  [-2.95, 56.45], [-2.58, 56.56], [-2.45, 56.7], [-2.07, 57.14], [-1.78, 57.5], [-2.0, 57.69], [-2.52, 57.67], [-3.28, 57.72],
  [-4.2, 57.48], [-3.77, 57.86], [-4.0, 57.88], [-3.65, 58.12], [-3.08, 58.44], [-3.02, 58.64], [-3.37, 58.67], [-4.4, 58.55],
  [-5.0, 58.62], [-5.25, 58.15], [-5.2, 57.9], [-5.8, 57.72], [-5.85, 57.43], [-5.7, 57.28], [-5.83, 57.0], [-6.22, 56.73],
  [-5.47, 56.42], [-5.6, 56.0], [-5.8, 55.3], [-5.45, 55.65], [-4.9, 55.95], [-4.75, 55.9], [-4.63, 55.46], [-4.86, 55.24],
  [-5.15, 55.0], [-4.86, 54.64], [-4.05, 54.83], [-3.4, 54.95], [-3.63, 54.5], [-3.23, 54.1], [-2.9, 54.15], [-3.05, 53.82],
  [-3.05, 53.45], [-3.2, 53.33], [-3.85, 53.33], [-4.65, 53.31], [-4.5, 53.15], [-4.75, 52.79], [-4.4, 52.88], [-4.05, 52.72],
  [-4.08, 52.41], [-4.66, 52.11], [-5.3, 51.88], [-5.05, 51.68], [-4.7, 51.67], [-4.3, 51.56], [-3.95, 51.6], [-3.16, 51.46],
  [-2.65, 51.6], [-2.7, 51.48], [-3.0, 51.33], [-3.47, 51.21], [-4.53, 51.02], [-4.95, 50.55], [-5.48, 50.21],
];
const GB_PTS = (() => {
  const kx = Math.cos(54.3 * Math.PI / 180) * 111320, ky = 111320;
  let pts = GB_LL.map(([lo, la]) => [(lo + 6.22) * kx, (la - 49.96) * ky]);
  const hh = Math.max(...pts.map(p => p[1])), f = 1000000 / hh; // normalise to 1,000 km long
  pts = pts.map(([x, y]) => [x * f, y * f]);
  return pts;
})();
const GB_W = Math.max(...GB_PTS.map(p => p[0]));

const EIFFEL_HALF = [[0, 0], [8, 20], [14, 40], [19, 57], [16.5, 57], [16.5, 62], [22, 62], [28, 90], [31, 115], [29, 115], [29, 120], [33, 120], [42, 170], [50, 230], [55, 262], [57, 276], [55.5, 276], [55.5, 281], [58.5, 281], [59.5, 295], [61, 300], [61.8, 300], [62.5, 330]];
const EIFFEL_PTS = EIFFEL_HALF.concat(EIFFEL_HALF.slice(0, -1).reverse().map(([a, y]) => [125 - a, y]));

const SIL = {
  finn: { h: 1.2, w: 0.42, shape(b) {
    b.circ(0.21, 1.08, 0.104).path([['M', 0.098, 1.1], ['C', 0.1, 1.2, 0.32, 1.21, 0.322, 1.1], ['L', 0.3, 1.13], ['L', 0.12, 1.13]])
      .rect(0.183, 0.92, 0.054, 0.08)
      .path([['M', 0.07, 0.88], ['Q', 0.075, 0.95, 0.145, 0.952], ['L', 0.275, 0.952], ['Q', 0.345, 0.95, 0.35, 0.88], ['L', 0.335, 0.6], ['L', 0.085, 0.6]])
      .poly([[0.072, 0.9], [0.128, 0.885], [0.088, 0.6], [0.03, 0.6]]).poly([[0.348, 0.9], [0.292, 0.885], [0.332, 0.6], [0.39, 0.6]])
      .circ(0.058, 0.575, 0.036).circ(0.362, 0.575, 0.036)
      .poly([[0.088, 0.62], [0.332, 0.62], [0.338, 0.43], [0.222, 0.43], [0.21, 0.47], [0.198, 0.43], [0.082, 0.43]])
      .rect(0.105, 0.05, 0.088, 0.4).rect(0.227, 0.05, 0.088, 0.4)
      .rr(0.078, 0, 0.13, 0.068, 0.03).rr(0.212, 0, 0.13, 0.068, 0.03);
  } },
  house: { h: 9, w: 8.6, shape(b) {
    b.rect(0.3, 0, 8, 5.6).poly([[0, 5.35], [4.3, 8.3], [8.6, 5.35]]).rect(6.0, 6.2, 0.85, 2.8);
  }, detail(b) {
    b.rect(3.75, 0, 1.1, 2.15).rect(1.1, 1.0, 1.6, 1.3).rect(5.9, 1.0, 1.6, 1.3).rect(1.1, 3.3, 1.6, 1.3).rect(5.9, 3.3, 1.6, 1.3).rect(3.6, 3.3, 1.4, 1.3);
  } },
  bus: { h: 4.4, w: 11, shape(b) {
    b.rr(0, 0.38, 11, 4.02, 0.5).circ(2.3, 0.55, 0.55).circ(8.7, 0.55, 0.55);
  }, detail(b) {
    for (let i = 0; i < 6; i++) b.rr(0.5 + i * 1.66, 2.95, 1.42, 1.0, 0.14);
    for (let i = 0; i < 5; i++) b.rr(2.0 + i * 1.66, 1.6, 1.42, 0.95, 0.14);
    b.rr(0.45, 0.62, 1.05, 1.95, 0.1).rr(10.25, 1.45, 0.55, 1.12, 0.1).circ(2.3, 0.55, 0.24).circ(8.7, 0.55, 0.24);
  } },
  bigben: { h: 96, w: 12, shape(b) {
    b.rect(1.6, 0, 8.8, 56).rect(0.6, 54, 10.8, 15).rect(1.4, 68, 9.2, 8.5)
      .poly([[0.9, 76], [11.1, 76], [8.6, 85], [6.7, 93], [6, 96], [5.3, 93], [3.4, 85]])
      .rect(0.3, 75, 1.3, 5).rect(10.4, 75, 1.3, 5);
  }, detail(b) {
    b.circ(6, 61.5, 4.3);
    for (let k = 0; k < 5; k++) b.rect(3.0, 6 + k * 9.5, 1.1, 5.5).rect(7.9, 6 + k * 9.5, 1.1, 5.5);
    b.rect(2.6, 69.6, 1.6, 5.4).rect(5.2, 69.6, 1.6, 5.4).rect(7.8, 69.6, 1.6, 5.4);
  }, extra(c, x0, y0, s) {
    const r = 4.3 * s; if (r < 5) return;
    const cx = x0 + 6 * s, cy = y0 - 61.5 * s;
    c.strokeStyle = GOLD; c.lineWidth = Math.max(1, r * 0.08); c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cy, r * 0.82, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy - r * 0.62); c.moveTo(cx, cy); c.lineTo(cx + r * 0.4, cy + r * 0.12); c.stroke();
  } },
  pitch: { h: 2.44, w: 109, shape(b) {
    b.rect(2, 0, 105, 0.4)
      .rect(1.85, 0, 0.25, 2.44).rect(0, 2.26, 2.1, 0.18).rect(0, 0, 0.18, 2.44)
      .rect(106.9, 0, 0.25, 2.44).rect(106.9, 2.26, 2.1, 0.18).rect(108.82, 0, 0.18, 2.44)
      .rect(54.44, 0, 0.12, 1.5).poly([[54.56, 1.5], [55.6, 1.3], [54.56, 1.1]]);
  } },
  starship: { h: 124, w: 14, shape(b) {
    b.poly([[2.9, 3.2], [11.1, 3.2], [10.6, 0], [3.4, 0]]).rect(2.5, 3, 9, 70.5)
      .rect(1.0, 65.5, 1.6, 4.5).rect(11.4, 65.5, 1.6, 4.5)
      .rect(2.5, 73.5, 9, 31)
      .path([['M', 2.5, 104], ['C', 2.5, 112, 4.2, 120.5, 7, 124], ['C', 9.8, 120.5, 11.5, 112, 11.5, 104]])
      .poly([[2.6, 74], [0.3, 75.5], [0.2, 84], [2.6, 86.5]]).poly([[11.4, 74], [13.7, 75.5], [13.8, 84], [11.4, 86.5]])
      .poly([[3.0, 107], [1.4, 108.5], [1.9, 114.5], [3.4, 113]]).poly([[11, 107], [12.6, 108.5], [12.1, 114.5], [10.6, 113]]);
  }, detail(b) { b.rect(2.5, 72.1, 9, 1.0).rect(2.5, 30, 9, 0.4); } },
  eiffel: { h: 330, w: 125, shape(b) { b.poly(EIFFEL_PTS); }, detail(b) {
    b.path([['M', 17, 0], ['C', 30, 30, 45, 38.5, 62.5, 39], ['C', 80, 38.5, 95, 30, 108, 0]]);
    b.poly([[33, 64], [92, 64], [86, 112], [39, 112]]).poly([[40, 122], [85, 122], [65, 250], [60, 250]]);
  } },
  everest: { h: 8849, w: 19500, shape(b) {
    b.poly([[0, 0], [1800, 900], [3200, 2100], [4300, 2700], [5200, 3600], [6100, 4300], [7000, 5600], [7700, 6100], [8400, 7100], [9100, 7600], [9700, 8350], [10200, 8849], [10650, 8500], [11100, 8300], [11700, 7900], [12500, 8000], [13100, 8300], [13600, 7600], [14600, 6400], [15500, 5900], [16700, 4200], [17800, 2600], [18700, 1300], [19500, 0]]);
  }, light(b) {
    b.poly([[8400, 7100], [9100, 7600], [9700, 8350], [10200, 8849], [10650, 8500], [11100, 8300], [11700, 7900], [12500, 8000], [13100, 8300], [13600, 7600], [12900, 7350], [12200, 7550], [11400, 7150], [10700, 7700], [10050, 7250], [9300, 7000]]);
  } },
  gb: { h: 1000000, w: GB_W, shape(b) { b.poly(GB_PTS); } },
};

// ---------- the things we compare ----------
const ASTEROIDS = [
  { id: 'chelyabinsk', name: 'Chelyabinsk rock', the: 'the Chelyabinsk rock', many: 'Chelyabinsk rocks', size: 18, aspect: 1.3, seed: 11, lump: 0.14, craters: 4, boulders: true, tone: [122, 110, 98] },
  { id: 'yr4', name: '2024 YR4', the: '2024 YR4', many: 'rocks like 2024 YR4', size: 60, aspect: 1.2, seed: 23, lump: 0.11, craters: 8, boulders: true, tone: [118, 112, 106] },
  { id: 'dimorphos', name: 'Dimorphos', many: 'rocks like Dimorphos', size: 160, aspect: 1.15, seed: 5, lump: 0.07, img: 'dimorphos.jpg', boulders: true, craters: 4, tone: [128, 122, 114] },
  { id: 'apophis', name: 'Apophis', many: 'rocks like Apophis', size: 375, aspect: 1.35, peanut: 0.14, seed: 42, lump: 0.05, craters: 22, tone: [126, 114, 100] },
  { id: 'bennu', name: 'Bennu', many: 'Bennus', size: 490, aspect: 1.05, diamond: 0.35, seed: 7, lump: 0.03, img: 'bennu.jpg', boulders: true, craters: 8, tone: [112, 108, 104] },
  { id: 'ryugu', name: 'Ryugu', many: 'Ryugus', size: 900, aspect: 1.08, diamond: 0.45, seed: 19, lump: 0.025, img: 'ryugu.jpg', boulders: true, craters: 10, tone: [104, 98, 92] },
  { id: 'dino', name: 'Dinosaur asteroid', the: 'the dinosaur asteroid', many: 'dinosaur asteroids', size: 10000, aspect: 1.12, seed: 31, lump: 0.06, craters: 40, tone: [120, 106, 92] },
  { id: 'eros', name: 'Eros', many: 'rocks like Eros', size: 33000, aspect: 2.5, peanut: 0.2, seed: 3, lump: 0.04, img: 'eros.jpg', long: true, craters: 30, tone: [150, 132, 108] },
  { id: 'vesta', name: 'Vesta', many: 'Vestas', size: 525000, aspect: 1.12, seed: 13, lump: 0.03, img: 'vesta.jpg', craters: 50, basin: [0.55, 0.86, 0.33], tone: [138, 132, 124] },
  { id: 'ceres', name: 'Ceres', many: 'rocks like Ceres', size: 950000, aspect: 1.0, seed: 17, lump: 0.01, img: 'ceres.jpg', round: true, craters: 70, spots: [[0.56, 0.4], [0.585, 0.415], [0.545, 0.425]], tone: [104, 102, 100] },
];

const OBJECTS = [
  { id: 'finn', name: 'Finn', the: 'Finn', many: 'Finns', sil: 'finn', dim: 'tall' },
  { id: 'house', name: 'Our house', the: 'our house', many: 'houses', sil: 'house', dim: 'tall' },
  { id: 'bus', name: 'London bus', the: 'a London bus', many: 'London buses', sil: 'bus', dim: 'long', len: 11 },
  { id: 'bigben', name: 'Big Ben', the: 'Big Ben', many: 'Big Bens', sil: 'bigben', dim: 'tall' },
  { id: 'pitch', name: 'Football pitch', the: 'a football pitch', many: 'football pitches', sil: 'pitch', dim: 'long', len: 105 },
  { id: 'starship', name: 'Starship', the: 'Starship', many: 'Starships', sil: 'starship', dim: 'tall' },
  { id: 'eiffel', name: 'Eiffel Tower', the: 'the Eiffel Tower', many: 'Eiffel Towers', sil: 'eiffel', dim: 'tall' },
  { id: 'everest', name: 'Mount Everest', the: 'Mount Everest', many: 'Mount Everests', sil: 'everest', dim: 'tall' },
  { id: 'gb', name: 'Great Britain', the: 'the whole of Great Britain', many: 'Great Britains', sil: 'gb', dim: 'long', len: 1000000 },
];

// The caption for an asteroid A next to an object O. Always computed, so always true.
function pairCaption(A, O) {
  const tall = O.dim === 'tall';
  const o = tall ? SIL[O.sil].h : O.len;
  const k = A.size / o;
  const An = capFirst(A.the || A.name), On = capFirst(O.the);
  if (k >= 0.87 && k <= 1.15) {
    if (tall) return A.long ? `Stood on its end, ${A.the || A.name} would be about as tall as ${O.the}!` : `${An} is about as tall as ${O.the}!`;
    return `${An} is about as wide as ${O.the} is long!`;
  }
  if (k > 1.15) {
    if (k < 1.35) return tall ? `${An} is a bit taller than ${O.the}!` : `${An} is a bit wider than ${O.the} is long!`;
    const c = countOf(k);
    if (tall) {
      if (A.long) return `Stood on its end, ${A.the || A.name} would be as tall as ${c.about}${c.text} ${O.many}!`;
      return c.whole ? `${An} is as tall as ${c.about}${c.text} ${O.many} stacked up!` : `${An} is as tall as ${c.about}${c.text} ${O.many}!`;
    }
    return c.whole ? `You could line up ${c.about}${c.text} ${O.many} across ${A.the || A.name}!` : `${An} is as wide as ${c.about}${c.text} ${O.many} in a row!`;
  }
  const q = 1 / k;
  if (q < 1.35) return tall ? `${An} is nearly as tall as ${O.the}!` : `${An} is nearly as wide as ${O.the} is long!`;
  if (q < 2.75) {
    const t = timesOf(q);
    return tall ? `${On} is ${t.about}${t.text} as tall as ${A.the || A.name}!` : `${On} is ${t.about}${t.text} as long as ${A.the || A.name} is wide!`;
  }
  const c = countOf(q);
  return tall ? `You could stack ${c.about}${c.text} ${A.many} to reach the top of ${O.the}!` : `You could line up ${c.about}${c.text} ${A.many} along ${O.the}!`;
}

// ---------- drawing: silhouettes ----------
// x = left edge (px), y = ground line (px), s = px per metre.
function drawSil(c, key, x, y, s, alpha = 1, opts = {}) {
  const S = SIL[key];
  const hp = S.h * s, wp = S.w * s;
  c.save();
  c.globalAlpha = alpha;
  if (Math.max(hp, wp) < 2.5) { // too small to draw: a gold speck
    c.fillStyle = GOLD; c.beginPath(); c.arc(x + wp / 2, y - Math.max(1, hp / 2), 1.6, 0, TAU); c.fill(); c.restore(); return;
  }
  const b = builder(x, y, s); S.shape(b);
  const lw = opts.lw || clamp(Math.min(hp, wp * 3) * 0.012, 0.9, 2.2);
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = GOLD; c.lineWidth = lw * 2;
  for (const p of b.parts) c.stroke(p);
  const top = y - hp;
  const g = c.createLinearGradient(0, Math.max(top, -4000), 0, y);
  g.addColorStop(0, '#cfd5e1'); g.addColorStop(1, '#8d95a7');
  c.fillStyle = g;
  for (const p of b.parts) c.fill(p);
  if (S.detail && hp > 26) {
    const d = builder(x, y, s); S.detail(d);
    c.fillStyle = 'rgba(9,13,28,0.9)'; c.strokeStyle = 'rgba(242,181,68,0.5)'; c.lineWidth = Math.max(0.8, lw * 0.7);
    for (const p of d.parts) { c.fill(p); c.stroke(p); }
  }
  if (S.light && hp > 20) {
    const d = builder(x, y, s); S.light(d);
    c.fillStyle = 'rgba(243,239,230,0.75)';
    for (const p of d.parts) c.fill(p);
  }
  if (S.extra && hp > 40) S.extra(c, x, y, s);
  c.restore();
}

// ---------- drawing: rocks ----------
function rockOutline(A) {
  const R = rng(A.seed), N = 120, harm = [];
  for (let k = 2; k <= 10; k++) harm.push([k, (R() * 2 - 1) * A.lump * (k <= 3 ? 1.5 : 1) / Math.pow(k / 2, 0.85), R() * TAU]);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU, ct = Math.cos(t), st = Math.sin(t);
    let r = 1;
    for (const [k, a, p] of harm) r += a * Math.sin(k * t + p);
    if (A.diamond) r *= 1 - A.diamond * (1 - 1 / (Math.abs(ct) + Math.abs(st)));
    if (A.peanut) r -= A.peanut * Math.pow(Math.abs(st), 5) * (1 - 0.6 * Math.abs(ct));
    r += (R() - 0.5) * A.lump * 0.25;
    pts.push([ct * r, st * r]);
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return pts.map(([x, y]) => [((x - x0) / (x1 - x0)) * 2 - 1, ((y - y0) / (y1 - y0)) * 2 - 1]);
}
function outlinePath(pts, x, y, w, h) {
  const p = new Path2D();
  pts.forEach(([u, v], i) => { const px = x + ((u + 1) / 2) * w, py = y + ((v + 1) / 2) * h; i ? p.lineTo(px, py) : p.moveTo(px, py); });
  p.closePath(); return p;
}
function crater(c, x, y, r, R, k = 1) {
  const sq = 0.8 + R() * 0.2, rot = R() * 0.6 - 0.3;
  c.save();
  c.translate(x, y); c.rotate(rot); c.scale(1, sq);
  // bowl: shadowed upper-left inner wall, sunlit lower-right inner wall (light comes from the upper left)
  const gr = c.createLinearGradient(-r, -r, r, r);
  gr.addColorStop(0, `rgba(0,0,0,${0.46 * k})`); gr.addColorStop(0.5, `rgba(0,0,0,${0.14 * k})`); gr.addColorStop(1, `rgba(255,240,215,${0.2 * k})`);
  c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  c.lineWidth = Math.max(0.8, r * 0.13);
  c.strokeStyle = `rgba(255,240,220,${0.2 * k})`; c.beginPath(); c.arc(0, 0, r * 1.03, Math.PI * 0.95, Math.PI * 1.55); c.stroke();
  c.strokeStyle = `rgba(0,0,0,${0.2 * k})`; c.beginPath(); c.arc(0, 0, r * 1.05, Math.PI * -0.05, Math.PI * 0.55); c.stroke();
  c.restore();
}
function boulder(c, x, y, rad, R, r, g, b) {
  const n = 6 + Math.floor(R() * 3), pts = [];
  for (let i = 0; i < n; i++) { const t = (i / n) * TAU + R() * 0.5, rr = rad * (0.65 + R() * 0.45); pts.push([Math.cos(t) * rr, Math.sin(t) * rr * 0.8]); }
  const shape = (dx, dy) => { c.beginPath(); pts.forEach(([u, v], i) => (i ? c.lineTo(x + u + dx, y + v + dy) : c.moveTo(x + u + dx, y + v + dy))); c.closePath(); };
  c.fillStyle = 'rgba(0,0,0,0.4)'; shape(rad * 0.5, rad * 0.38); c.fill();
  const gr = c.createLinearGradient(x - rad, y - rad, x + rad, y + rad);
  gr.addColorStop(0, rgb(r + 70, g + 66, b + 60, 0.92)); gr.addColorStop(1, rgb(r * 0.5, g * 0.5, b * 0.5, 0.92));
  c.fillStyle = gr; shape(0, 0); c.fill();
}
function makeRockSprite(A, outline, aspect) {
  const SW = 512, SH = Math.max(96, Math.round(512 / aspect));
  const cv = mkCanvas(SW, SH), c = cv.getContext('2d');
  const P = outlinePath(outline, 0, 0, SW, SH);
  const [r, g, b] = A.tone || [124, 114, 104];
  const R = rng(A.seed * 7 + 3);
  c.save(); c.clip(P);
  const gr = c.createRadialGradient(SW * 0.3, SH * 0.26, 0, SW * 0.42, SH * 0.45, Math.max(SW, SH) * 0.78);
  gr.addColorStop(0, rgb(r + 78, g + 72, b + 64)); gr.addColorStop(0.42, rgb(r, g, b)); gr.addColorStop(1, rgb(r * 0.28, g * 0.27, b * 0.26));
  c.fillStyle = gr; c.fillRect(0, 0, SW, SH);
  for (let i = 0; i < 70; i++) {
    const rad = (0.03 + R() * 0.13) * SW;
    c.fillStyle = R() < 0.55 ? 'rgba(0,0,0,0.075)' : 'rgba(255,240,220,0.055)';
    c.beginPath(); c.ellipse(R() * SW, R() * SH, rad, rad * (0.5 + R() * 0.5), R() * TAU, 0, TAU); c.fill();
  }
  const nc = A.craters !== undefined ? A.craters : 30, unit = Math.min(SW, SH * 1.3);
  if (A.basin) { const [bx, by, br] = A.basin; crater(c, bx * SW, by * SH, br * unit, R, 0.8); }
  for (let i = 0; i < nc; i++) crater(c, R() * SW, R() * SH, (0.008 + Math.pow(R(), 3) * 0.09) * unit, R, 0.85);
  if (A.boulders) for (let i = 0; i < 260; i++) boulder(c, R() * SW, R() * SH, (0.003 + Math.pow(R(), 3.2) * 0.03) * SW, R, r, g, b);
  if (A.spots) for (const [sx, sy] of A.spots) {
    const rg = c.createRadialGradient(sx * SW, sy * SH, 0, sx * SW, sy * SH, SW * 0.02);
    rg.addColorStop(0, 'rgba(255,255,250,0.95)'); rg.addColorStop(1, 'rgba(255,255,250,0)');
    c.fillStyle = rg; c.beginPath(); c.arc(sx * SW, sy * SH, SW * 0.02, 0, TAU); c.fill();
  }
  for (let i = 0; i < 1600; i++) {
    c.fillStyle = R() < 0.5 ? `rgba(0,0,0,${0.05 + R() * 0.09})` : `rgba(255,245,230,${0.03 + R() * 0.07})`;
    const sz = 1 + R() * 2.2; c.fillRect(R() * SW, R() * SH, sz, sz);
  }
  const sh = c.createLinearGradient(SW * 0.1, SH * 0.05, SW * 0.95, SH * 0.98);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.5, 'rgba(0,0,0,0.1)'); sh.addColorStop(1, 'rgba(0,0,0,0.62)');
  c.fillStyle = sh; c.fillRect(0, 0, SW, SH);
  c.lineWidth = 10; c.strokeStyle = 'rgba(255,236,205,0.10)'; c.stroke(P);
  c.restore();
  return cv;
}

// ---------- drawing: planets ----------
function blob(c, x, y, rx, ry, col, R, n = 9) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const t = (i / (n * 2)) * TAU, k = 0.75 + R() * 0.45;
    const px = x + Math.cos(t) * rx * k, py = y + Math.sin(t) * ry * k;
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath(); c.fill();
}
function makePlanetSprite(kind) {
  const S = 512, cv = mkCanvas(S, S), c = cv.getContext('2d'), m = S / 2;
  const R = rng(kind.length * 977 + kind.charCodeAt(0));
  c.save(); c.beginPath(); c.arc(m, m, m, 0, TAU); c.clip();
  if (kind === 'sun') {
    const g = c.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, '#fffbe6'); g.addColorStop(0.45, '#ffe6a0'); g.addColorStop(0.78, '#ffbd52'); g.addColorStop(0.94, '#f28c2c'); g.addColorStop(1, '#d4601c');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 5200; i++) { c.fillStyle = R() < 0.5 ? 'rgba(255,255,235,0.06)' : 'rgba(190,80,0,0.06)'; const z = 1.5 + R() * 2.5; c.beginPath(); c.arc(R() * S, R() * S, z, 0, TAU); c.fill(); }
    for (const [sx, sy, n] of [[0.36, 0.42, 3], [0.62, 0.58, 2]]) for (let i = 0; i < n; i++) {
      const x = sx * S + (R() - 0.5) * 18, y = sy * S + (R() - 0.5) * 10, rr = 2 + R() * 2.5;
      c.fillStyle = 'rgba(160,70,10,0.35)'; c.beginPath(); c.arc(x, y, rr * 2, 0, TAU); c.fill();
      c.fillStyle = 'rgba(90,30,0,0.6)'; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
    }
  } else if (kind === 'moon') {
    c.fillStyle = '#b3b0a9'; c.fillRect(0, 0, S, S);
    const maria = [[0.36, 0.32, 0.15, 0.12], [0.58, 0.31, 0.08, 0.08], [0.65, 0.46, 0.1, 0.09], [0.82, 0.37, 0.05, 0.05], [0.24, 0.5, 0.13, 0.22], [0.44, 0.66, 0.09, 0.07], [0.74, 0.6, 0.07, 0.08], [0.5, 0.17, 0.2, 0.04]];
    for (const [x, y, rx, ry] of maria) blob(c, x * S, y * S, rx * S, ry * S, 'rgba(70,72,78,0.5)', R, 11);
    for (let i = 0; i < 140; i++) crater(c, R() * S, R() * S, 2 + Math.pow(R(), 3) * 18, R);
    c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const a = R() * TAU; c.beginPath(); c.moveTo(S * 0.46, S * 0.84); c.lineTo(S * 0.46 + Math.cos(a) * S * 0.3, S * 0.84 + Math.sin(a) * S * 0.3); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(S * 0.46, S * 0.84, 5, 0, TAU); c.fill();
  } else if (kind === 'mars') {
    const g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#d9774a'); g.addColorStop(1, '#a8482a');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 14; i++) blob(c, R() * S, S * (0.25 + R() * 0.55), S * (0.05 + R() * 0.12), S * (0.03 + R() * 0.07), 'rgba(80,32,20,0.32)', R);
    c.strokeStyle = 'rgba(70,25,15,0.5)'; c.lineWidth = S * 0.018; c.lineCap = 'round';
    c.beginPath(); c.moveTo(S * 0.22, S * 0.52); c.quadraticCurveTo(S * 0.45, S * 0.5, S * 0.7, S * 0.56); c.stroke();
    for (let i = 0; i < 30; i++) crater(c, R() * S, R() * S, 2 + R() * 8, R);
    c.fillStyle = 'rgba(255,250,245,0.88)'; c.beginPath(); c.ellipse(m, S * 0.035, S * 0.2, S * 0.07, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,250,245,0.6)'; c.beginPath(); c.ellipse(m * 1.05, S * 0.975, S * 0.12, S * 0.04, 0, 0, TAU); c.fill();
  } else if (kind === 'earth') {
    const g = c.createRadialGradient(m * 0.8, m * 0.75, 0, m, m, m); g.addColorStop(0, '#3b82c4'); g.addColorStop(1, '#0f3567');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    blob(c, S * 0.5, S * 0.52, S * 0.15, S * 0.24, '#8f7c4c', R, 12);
    blob(c, S * 0.47, S * 0.6, S * 0.1, S * 0.14, '#4d6a35', R, 10);
    blob(c, S * 0.66, S * 0.36, S * 0.12, S * 0.08, '#9a8455', R, 10);
    blob(c, S * 0.46, S * 0.22, S * 0.12, S * 0.06, '#5d7340', R, 10);
    blob(c, m, S * 0.99, S * 0.42, S * 0.09, '#f2f4f7', R, 14);
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      c.lineWidth = 3 + R() * 9; const x = R() * S, y = R() * S, rr = 20 + R() * 70, a = R() * TAU;
      c.beginPath(); c.arc(x, y, rr, a, a + 0.6 + R() * 1.4); c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 30; i++) { c.beginPath(); c.ellipse(R() * S, R() * S, 10 + R() * 40, 4 + R() * 10, R() * 3, 0, TAU); c.fill(); }
  } else if (kind === 'jupiter') {
    const bands = ['#cdb9a0', '#e9dcc6', '#b98b62', '#efe4d0', '#a8714b', '#e7d6bb', '#c49a6c', '#efe3cc', '#b4825b', '#e2d2b6', '#9c7a5f', '#bfae98'];
    const n = bands.length;
    for (let i = 0; i < n; i++) {
      const y0 = (i / n) * S, y1 = ((i + 1) / n) * S + 2;
      c.fillStyle = bands[i]; c.beginPath(); c.moveTo(0, y0);
      for (let x = 0; x <= S; x += 16) c.lineTo(x, y0 + Math.sin(x * 0.03 + i * 1.7) * 4 * (i % 2 ? 1 : -1));
      c.lineTo(S, y1); c.lineTo(0, y1); c.closePath(); c.fill();
    }
    for (let i = 0; i < 40; i++) { c.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(120,70,40,0.16)'; c.beginPath(); c.ellipse(R() * S, R() * S, 8 + R() * 30, 3 + R() * 6, 0, 0, TAU); c.fill(); }
    c.fillStyle = '#d7d0c3'; c.beginPath(); c.ellipse(S * 0.64, S * 0.66, S * 0.1, S * 0.055, 0, 0, TAU); c.fill();
    c.fillStyle = '#c0613d'; c.beginPath(); c.ellipse(S * 0.64, S * 0.66, S * 0.085, S * 0.042, 0, 0, TAU); c.fill();
  }
  if (kind !== 'sun') {
    const sh = c.createRadialGradient(m * 0.72, m * 0.68, m * 0.1, m, m, m * 1.02);
    sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, kind === 'moon' ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.62)');
    c.fillStyle = sh; c.fillRect(0, 0, S, S);
  }
  if (kind === 'earth' || kind === 'mars') {
    c.strokeStyle = kind === 'earth' ? 'rgba(130,195,255,0.45)' : 'rgba(255,200,170,0.25)'; c.lineWidth = S * 0.02;
    c.beginPath(); c.arc(m, m, m - S * 0.01, 0, TAU); c.stroke();
  }
  c.restore();
  return cv;
}

// ---------- photos (optional) ----------
function loadImage(name) {
  return new Promise(res => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = new URL('../../assets/img/' + name, import.meta.url).href;
  });
}
// Finds the object on a black background. kind 'disc' -> square crop of a full planet disc.
// kind 'rock' -> transparent cut-out of the largest blob. Returns null if the photo doesn't fit the rules.
function processPhoto(im, kind) {
  try {
    const nw = im.naturalWidth, nh = im.naturalHeight;
    if (!nw || !nh) return null;
    const k = Math.min(1, 640 / Math.max(nw, nh));
    const W = Math.max(8, Math.round(nw * k)), H = Math.max(8, Math.round(nh * k));
    const cv = mkCanvas(W, H), c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(im, 0, 0, W, H);
    const id = c.getImageData(0, 0, W, H), px = id.data;
    const lum = new Uint8Array(W * H), hist = new Float64Array(256);
    for (let i = 0, j = 0; j < W * H; i += 4, j++) { const l = Math.round(0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]); lum[j] = l; hist[l]++; }
    // Otsu threshold separates the lit body from the black sky (and any faint glow around it)
    let sumAll = 0; for (let t = 0; t < 256; t++) sumAll += t * hist[t];
    let wB = 0, sB = 0, bestV = 0, otsu = 50;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = W * H - wB; if (!wF) break;
      sB += t * hist[t];
      const v = wB * wF * Math.pow(sB / wB - (sumAll - sB) / wF, 2);
      if (v > bestV) { bestV = v; otsu = t; }
    }
    const TH = kind === 'disc' ? 22 : clamp(otsu * 0.45, 22, 60), mask = new Uint8Array(W * H);
    for (let j = 0; j < W * H; j++) mask[j] = lum[j] > TH ? 1 : 0;
    // largest connected blob
    const lab = new Int32Array(W * H); let best = 0, bestN = 0, cur = 0; const stack = [];
    for (let j = 0; j < W * H; j++) {
      if (!mask[j] || lab[j]) continue;
      cur++; let n = 0; stack.push(j); lab[j] = cur;
      while (stack.length) {
        const q = stack.pop(); n++;
        const x = q % W, y = (q - x) / W;
        if (x > 0 && mask[q - 1] && !lab[q - 1]) { lab[q - 1] = cur; stack.push(q - 1); }
        if (x < W - 1 && mask[q + 1] && !lab[q + 1]) { lab[q + 1] = cur; stack.push(q + 1); }
        if (y > 0 && mask[q - W] && !lab[q - W]) { lab[q - W] = cur; stack.push(q - W); }
        if (y < H - 1 && mask[q + W] && !lab[q + W]) { lab[q + W] = cur; stack.push(q + W); }
      }
      if (n > bestN) { bestN = n; best = cur; }
    }
    if (bestN < 400) return null;
    const rowA = new Int32Array(H).fill(W), rowB = new Int32Array(H).fill(-1), colA = new Int32Array(W).fill(H), colB = new Int32Array(W).fill(-1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (lab[y * W + x] !== best) continue;
      if (x < rowA[y]) rowA[y] = x; if (x > rowB[y]) rowB[y] = x;
      if (y < colA[x]) colA[x] = y; if (y > colB[x]) colB[x] = y;
    }
    let x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let y = 0; y < H; y++) if (rowB[y] >= 0) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let x = 0; x < W; x++) if (colB[x] >= 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const touch = (x0 <= 1) + (y0 <= 1) + (x1 >= W - 2) + (y1 >= H - 2);
    const fill = bestN / (bw * bh);
    if (kind === 'disc') {
      const ar = bw / bh;
      let outside = 0; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (lab[y * W + x] !== best) continue;
        const d = ((x - cx) / (bw / 2)) ** 2 + ((y - cy) / (bh / 2)) ** 2;
        if (d > 1.06) outside++;
      }
      if (touch || ar < 0.85 || ar > 1.18 || fill < 0.72 || outside / bestN > 0.03) return null;
      const S = 512, out = mkCanvas(S, S), oc = out.getContext('2d');
      const r = Math.max(bw, bh) / 2 / k;
      oc.drawImage(im, cx / k - r, cy / k - r, 2 * r, 2 * r, 0, 0, S, S);
      return { cv: out, aspect: 1 };
    }
    if (touch > 0 || fill < 0.35 || fill > 0.97) return null;
    // rock cut-out: inside if within both the row span and the column span of the blob
    const out = mkCanvas(bw, bh), oc = out.getContext('2d');
    const od = oc.createImageData(bw, bh), o = od.data;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const inside = x >= rowA[y] && x <= rowB[y] && y >= colA[x] && y <= colB[x];
      const si = (y * W + x) * 4, di = ((y - y0) * bw + (x - x0)) * 4;
      o[di] = px[si]; o[di + 1] = px[si + 1]; o[di + 2] = px[si + 2];
      o[di + 3] = inside ? 255 : 0;
    }
    oc.putImageData(od, 0, 0);
    return { cv: out, aspect: bw / bh };
  } catch (e) {
    return null;
  }
}

// ---------- background ----------
function makeBackdrop(W, H, dpr, horizon) {
  const cv = mkCanvas(W * dpr, H * dpr), c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04060c'); g.addColorStop(0.65, BG2); g.addColorStop(1, '#0d1428');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const neb = c.createRadialGradient(W * 0.78, H * 0.22, 0, W * 0.78, H * 0.22, Math.max(W, H) * 0.55);
  neb.addColorStop(0, 'rgba(95,130,210,0.07)'); neb.addColorStop(1, 'rgba(95,130,210,0)');
  c.fillStyle = neb; c.fillRect(0, 0, W, H);
  const R = rng(4242), n = Math.round((W * H) / 2600);
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * horizon, z = R();
    c.fillStyle = `rgba(${z > 0.85 ? '255,226,170' : '235,240,255'},${0.15 + Math.pow(R(), 2) * 0.6})`;
    c.beginPath(); c.arc(x, y, z > 0.96 ? 1.3 : z > 0.7 ? 0.9 : 0.6, 0, TAU); c.fill();
  }
  // ground below the horizon
  const gg = c.createLinearGradient(0, horizon, 0, H);
  gg.addColorStop(0, 'rgba(17,26,46,0.95)'); gg.addColorStop(1, 'rgba(5,7,13,1)');
  c.fillStyle = gg; c.fillRect(0, horizon, W, H - horizon);
  const glow = c.createLinearGradient(0, horizon - 40, 0, horizon);
  glow.addColorStop(0, 'rgba(242,181,68,0)'); glow.addColorStop(1, 'rgba(242,181,68,0.06)');
  c.fillStyle = glow; c.fillRect(0, horizon - 40, W, 40);
  const line = c.createLinearGradient(0, 0, W, 0);
  line.addColorStop(0, 'rgba(242,181,68,0)'); line.addColorStop(0.12, 'rgba(242,181,68,0.55)'); line.addColorStop(0.88, 'rgba(242,181,68,0.55)'); line.addColorStop(1, 'rgba(242,181,68,0)');
  c.fillStyle = line; c.fillRect(0, horizon, W, 1.5);
  return cv;
}

// ---------- items: anything that can stand on the horizon ----------
function setRockDims(it, ar) {
  const A = it.A;
  it.ar = ar;
  if (A.long) { it.w = A.size; it.h = A.size / ar; }
  else { it.w = A.size * Math.sqrt(ar); it.h = A.size / Math.sqrt(ar); }
}
function rockItem(A) {
  const it = { kind: 'rock', A, outline: rockOutline(A), sprite: null, photo: null };
  setRockDims(it, A.aspect);
  return it;
}
function silItem(key) { return { kind: 'sil', key, w: SIL[key].w, h: SIL[key].h }; }
function planetItem(key, d) { return { kind: 'planet', key, w: d, h: d, sprite: null, photo: null }; }

function drawItem(c, it, x, y, s, alpha = 1) {
  if (alpha <= 0) return;
  if (it.kind === 'sil') { drawSil(c, it.key, x, y, s, alpha); return; }
  const w = it.w * s, h = it.h * s;
  c.save();
  c.globalAlpha = alpha;
  if (Math.max(w, h) < 2.5) {
    c.fillStyle = it.key === 'sun' ? GOLD2 : '#d9d4ca';
    c.beginPath(); c.arc(x + w / 2, y - Math.max(1, h / 2), 1.6, 0, TAU); c.fill();
    c.restore(); return;
  }
  if (it.kind === 'rock') {
    // soft contact shadow
    c.fillStyle = 'rgba(0,0,0,0.32)';
    c.beginPath(); c.ellipse(x + w / 2, y, w * 0.38, Math.max(1.5, h * 0.025), 0, 0, TAU); c.fill();
    if (it.photo && it.A.round) {
      c.beginPath(); c.ellipse(x + w / 2, y - h / 2, w / 2, h / 2, 0, 0, TAU); c.clip();
      c.drawImage(it.photo, x, y - h, w, h);
    } else if (it.photo) {
      c.drawImage(it.photo, x, y - h, w, h);
    } else {
      if (!it.sprite) it.sprite = makeRockSprite(it.A, it.outline, it.w / it.h);
      c.clip(outlinePath(it.outline, x, y - h, w, h));
      c.drawImage(it.sprite, x, y - h, w, h);
    }
  } else {
    const r = w / 2, cx = x + r, cy = y - r;
    if (it.key === 'sun') {
      const gl = c.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.45);
      gl.addColorStop(0, 'rgba(255,190,90,0.38)'); gl.addColorStop(1, 'rgba(255,170,60,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(cx, cy, r * 1.45, 0, TAU); c.fill();
    } else if (it.key === 'earth') {
      const gl = c.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.12);
      gl.addColorStop(0, 'rgba(110,180,255,0.35)'); gl.addColorStop(1, 'rgba(110,180,255,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(cx, cy, r * 1.12, 0, TAU); c.fill();
    }
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
    if (!it.photo && !it.sprite) it.sprite = makePlanetSprite(it.key);
    c.drawImage(it.photo || it.sprite, cx - r, cy - r, 2 * r, 2 * r);
  }
  c.restore();
}

function niceStep(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
function fmtRuler(m) {
  if (m >= 1e9) { const v = m / 1e9; return (v < 10 ? +v.toFixed(1) : Math.round(v)) + ' million km'; }
  return fmtLen(m);
}

// =====================================================================
export async function mount(el, ctx) {
  injectCSS();
  ctx = ctx || {};
  const data = (ctx.data && typeof ctx.data === 'object') ? ctx.data : {};
  const qs = new URLSearchParams(location.search);
  const mode = (data.mode === 'zoom' || qs.get('debugMode') === 'zoom') ? 'zoom' : 'asteroids';
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const commander = (ctx.crew && ctx.crew.commander) || 'Finn';
  const objects = OBJECTS.map(o => (o.id === 'finn' ? { ...o, name: commander, the: commander, many: commander + 's' } : o));

  let destroyed = false;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (!destroyed) { try { fn(); } catch (e) { console.warn('[scale]', e); } } }, ms);
    timers.add(id); return id;
  };
  const call = (name, ...a) => { try { if (typeof ctx[name] === 'function') return ctx[name](...a); } catch (e) { console.warn('[scale] ctx.' + name, e); } };

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.className = 'g-scale gs-' + mode;
  root.innerHTML = `<div class="gs-view"><canvas class="gs-canvas" aria-hidden="true"></canvas>
    <div class="gs-cap" aria-live="polite"><div class="gs-cap-main"></div><div class="gs-cap-sub"></div></div></div>`;
  el.appendChild(root);
  const view = root.querySelector('.gs-view');
  const canvas = root.querySelector('.gs-canvas');
  const capBox = root.querySelector('.gs-cap');
  const capMain = root.querySelector('.gs-cap-main');
  const capSub = root.querySelector('.gs-cap-sub');
  const g = canvas.getContext('2d');

  let W = 1, H = 1, dpr = 1, backdrop = null, backdropKey = '';
  let raf = 0, dirty = true, now = performance.now();
  let lastCaption = '', speakTimer = 0;

  function setCaption(main, subHTML, speakIt = true) {
    if (main !== lastCaption) {
      lastCaption = main;
      capMain.textContent = main;
      if (!reduced && capMain.animate) { try { capMain.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'ease-out' }); } catch (e) { /* ignore */ } }
      if (speakIt) {
        if (speakTimer) { clearTimeout(speakTimer); timers.delete(speakTimer); }
        speakTimer = later(() => { speakTimer = 0; call('speak', main); }, mode === 'zoom' ? 1000 : 600);
      }
    }
    if (subHTML !== undefined && capSub.innerHTML !== subHTML) capSub.innerHTML = subHTML;
  }

  let capReserve = 0;
  function geom() {
    const horizon = Math.round(H - clamp(H * 0.12, 58, 76));
    const capH = Math.max(capBox.offsetHeight, capReserve);
    const top = Math.min(capH + 14, horizon - 90);
    const narrow = W < 560;
    const left = narrow ? 80 : W < 900 ? 90 : 108, right = narrow ? 16 : 32;
    return { horizon, top, left, right, availW: Math.max(60, W - left - right), availH: Math.max(50, horizon - top) };
  }

  function drawRuler(G, ppm) {
    const span = G.horizon - G.top;
    if (span < 40 || !isFinite(ppm) || ppm <= 0) return;
    const step = niceStep(span / ppm / 4.2);
    const x = W < 560 ? 12 : 20;
    g.save();
    g.strokeStyle = 'rgba(185,192,207,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + 0.5, G.horizon); g.lineTo(x + 0.5, G.top); g.stroke();
    g.font = `500 18px ${FONT_B}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    for (let k = 1; k < 40; k++) {
      const yy = G.horizon - k * step * ppm;
      if (yy < G.top - 2) break;
      g.strokeStyle = 'rgba(242,181,68,0.7)';
      g.beginPath(); g.moveTo(x - 4, Math.round(yy) + 0.5); g.lineTo(x + 9, Math.round(yy) + 0.5); g.stroke();
      g.fillStyle = INK3; g.fillText(fmtRuler(k * step), x + 14, yy);
    }
    g.restore();
  }

  function drawLabel(G, cx, name, sub, placed, strong) {
    g.font = `600 21px ${FONT_D}`; const w1 = g.measureText(name).width;
    g.font = `500 18px ${FONT_B}`; const w2 = sub ? g.measureText(sub).width : 0;
    const w = Math.max(w1, w2);
    const x = clamp(cx, w / 2 + 8, W - w / 2 - 8);
    const box = [x - w / 2 - 8, x + w / 2 + 8];
    for (const p of placed) if (box[0] < p[1] && box[1] > p[0]) return false;
    placed.push(box);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = `600 21px ${FONT_D}`; g.fillStyle = strong ? INK : INK2; g.fillText(name, x, G.horizon + 25);
    if (sub) { g.font = `500 18px ${FONT_B}`; g.fillStyle = strong ? GOLD2 : INK3; g.fillText(sub, x, G.horizon + 47); }
    return true;
  }
  function drawRing(cx, cy) {
    const r = 15 + Math.sin(now / 280) * 2.5;
    cy = Math.min(cy, geom().horizon - 24);
    g.save();
    g.strokeStyle = 'rgba(255,210,122,0.9)'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,210,122,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, r + 7, 0, TAU); g.stroke();
    g.restore();
  }

  function paintBackdrop(G) {
    const key = `${W}x${H}@${dpr}:${G.horizon}`;
    if (key !== backdropKey) { backdrop = makeBackdrop(W, H, dpr, G.horizon); backdropKey = key; }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(backdrop, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Photos: load in the background, swap in when ready.
  async function attachPhoto(it, name, kind) {
    const im = await loadImage(name);
    if (destroyed || !im) return;
    const res = processPhoto(im, kind);
    if (destroyed || !res) return;
    it.photo = res.cv;
    if (it.kind === 'rock') setRockDims(it, it.A.round ? 1 : res.aspect);
    onPhoto(it);
  }
  let onPhoto = () => {};

  // =================== MODE: asteroids ===================
  let renderMode = () => {};
  let busy = () => false;
  let onResizeMode = () => {};
  let startMode = () => {};
  const cleanups = [];

  if (mode === 'asteroids') {
    const pickIds = (list, all) => {
      if (!Array.isArray(list) || !list.length) return all;
      const out = list.map(id => all.find(a => a.id === id)).filter(Boolean);
      return out.length ? out : all;
    };
    const rockDefs = pickIds(data.asteroids, ASTEROIDS);
    const objDefs = pickIds(data.objects, objects);
    const rocks = new Map(rockDefs.map(A => [A.id, rockItem(A)]));
    const objs = new Map(objDefs.map(O => [O.id, { ...silItem(O.sil), O }]));

    let selA = rocks.has(data.asteroid) ? data.asteroid : (rocks.has('bennu') ? 'bennu' : rockDefs[0].id);
    let selB = objs.has(data.compare) ? data.compare : (objs.has('house') ? 'house' : objDefs[0].id);
    const dbg = (qs.get('debugPick') || '').split(',');
    if (dbg[0] && rocks.has(dbg[0])) selA = dbg[0];
    if (dbg[1] && objs.has(dbg[1])) selB = dbg[1];

    // picker UI
    const pick = document.createElement('div');
    pick.className = 'gs-pick';
    pick.innerHTML = `<div class="gs-row"><div class="gs-rowlabel">Space rock</div><div class="gs-chips" data-row="a"></div></div>
      <div class="gs-row"><div class="gs-rowlabel">Compare with</div><div class="gs-chips" data-row="b"></div></div>`;
    root.appendChild(pick);
    const rowA = pick.querySelector('[data-row="a"]'), rowB = pick.querySelector('[data-row="b"]');
    const chipIcons = new Map();

    function drawChipIcon(cv, it) {
      const d = Math.min(2, window.devicePixelRatio || 1);
      cv.width = 40 * d; cv.height = 40 * d;
      const c = cv.getContext('2d');
      c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, 40, 40);
      if (it.kind === 'rock') {
        const ar = it.w / it.h, w = ar >= 1 ? 34 : 34 * ar, h = ar >= 1 ? 34 / ar : 34;
        drawItem(c, it, 20 - w / 2, 20 + h / 2, w / it.w);
      } else if (it.key === 'pitch') {
        c.strokeStyle = GOLD; c.lineWidth = 1.5; c.fillStyle = 'rgba(185,192,207,0.25)';
        c.beginPath(); rrPath(c, 3, 9, 34, 22, 3); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(20, 9); c.lineTo(20, 31); c.stroke();
        c.beginPath(); c.arc(20, 20, 4.5, 0, TAU); c.stroke();
        c.strokeRect(3, 15, 5, 10); c.strokeRect(32, 15, 5, 10);
      } else {
        const S = SIL[it.key], s = Math.min(32 / S.h, 34 / S.w);
        drawSil(c, it.key, 20 - (S.w * s) / 2, 20 + (S.h * s) / 2, s, 1, { lw: 0.7 });
      }
    }
    function makeChip(it, id, label, size, row, which) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'gs-chip'; b.dataset.id = id;
      b.innerHTML = `<canvas aria-hidden="true"></canvas><span>${esc(label)}</span><span class="sz">${esc(size)}</span>`;
      row.appendChild(b);
      const cv = b.querySelector('canvas');
      chipIcons.set(id, () => drawChipIcon(cv, it));
      b.addEventListener('click', () => choose(which, id, true));
    }
    for (const [id, it] of rocks) makeChip(it, id, it.A.name, fmtLen(it.A.size), rowA, 'a');
    for (const [id, it] of objs) makeChip(it, id, it.O.name, fmtLen(it.O.dim === 'tall' ? SIL[it.O.sil].h : it.O.len), rowB, 'b');
    for (const f of chipIcons.values()) f();

    // camera: log(px per metre), tweened
    const cam = { lp: 0, tw: null };
    const fade = { a: -1e9, b: -1e9 };
    const seen = new Set();
    let completed = false;

    const curA = () => rocks.get(selA), curB = () => objs.get(selB);
    const gapPx = G => clamp(G.availW * 0.07, 28, 90);
    function targetLp() {
      const G = geom(), A = curA(), B = curB(), gap = gapPx(G);
      const fillH = Math.min(0.7 * H, G.availH * 0.96);
      const ppm = Math.min(fillH / Math.max(A.h, B.h), (G.availW - gap) / (A.w + B.w));
      return Math.log(ppm);
    }
    function zoomTo(lpTarget, fromLp) {
      const from = fromLp !== undefined ? fromLp : cam.lp;
      const dist = Math.abs(lpTarget - from);
      const dur = reduced ? 250 : clamp(800 + dist * 160, 900, 2300);
      cam.tw = { from, to: lpTarget, t0: performance.now(), dur };
      kick();
    }
    function captionNow() {
      const A = curA(), B = curB(), O = B.O;
      const oDim = O.dim === 'tall' ? SIL[O.sil].h : O.len;
      const sub = `<b>${esc(A.A.name)}</b> ${fmtLen(A.A.size)} ${A.A.long ? 'long' : 'across'}<i>·</i><b>${esc(O.name)}</b> ${fmtLen(oDim)} ${O.dim}`;
      return { main: pairCaption(A.A, O), sub };
    }
    function choose(which, id, user) {
      if (destroyed) return;
      const changed = which === 'a' ? id !== selA : id !== selB;
      if (which === 'a') selA = id; else selB = id;
      for (const b of rowA.children) b.classList.toggle('on', b.dataset.id === selA);
      for (const b of rowB.children) b.classList.toggle('on', b.dataset.id === selB);
      if (changed) fade[which] = performance.now();
      const cap = captionNow();
      setCaption(cap.main, cap.sub, user);
      zoomTo(targetLp());
      if (user) {
        const key = selA + '|' + selB;
        if (!seen.has(key)) {
          seen.add(key);
          const A = curA().A, O = curB().O;
          call('log', `Compared ${A.the || A.name} with ${O.the}`);
          if (seen.size >= 3 && !completed) { completed = true; call('complete'); }
        }
      }
    }
    onPhoto = it => {
      for (const [id, r] of rocks) if (r === it && chipIcons.has(id)) chipIcons.get(id)();
      if (it === curA()) zoomTo(targetLp());
      dirty = true; kick();
    };
    for (const it of rocks.values()) if (it.A.img) attachPhoto(it, it.A.img, it.A.round ? 'disc' : 'rock');

    renderMode = (G) => {
      const t = performance.now();
      if (cam.tw) {
        const k = clamp((t - cam.tw.t0) / cam.tw.dur, 0, 1);
        cam.lp = lerp(cam.tw.from, cam.tw.to, easeIO(k));
        if (k >= 1) cam.tw = null;
      }
      const ppm = Math.exp(cam.lp);
      drawRuler(G, ppm);
      const A = curA(), B = curB(), gap = gapPx(G);
      const wa = A.w * ppm, wb = B.w * ppm;
      const x0 = G.left + (G.availW - (wa + gap + wb)) / 2;
      const xb = x0 + wa + gap;
      const fa = reduced ? 1 : clamp((t - fade.a) / 420, 0, 1), fb = reduced ? 1 : clamp((t - fade.b) / 420, 0, 1);
      const items = [[A, x0, fa], [B, xb, fb]];
      // draw the bigger one first so a tiny one is never hidden
      items.sort((p, q) => q[0].h * q[0].w - p[0].h * p[0].w);
      for (const [it, x, a] of items) {
        g.save();
        if (a < 1) { const sc = 0.94 + 0.06 * easeOut(a); g.translate(x + it.w * ppm / 2, G.horizon); g.scale(sc, sc); g.translate(-(x + it.w * ppm / 2), -G.horizon); }
        drawItem(g, it, x, G.horizon, ppm, easeOut(a));
        g.restore();
      }
      const placed = [];
      const aName = A.A.name, bName = B.O.name;
      const aSub = `${fmtLen(A.A.size)}`, bSub = `${fmtLen(B.O.dim === 'tall' ? SIL[B.O.sil].h : B.O.len)}`;
      // label the bigger one first; the small one gets nudged if they would overlap
      const order = A.h * A.w >= B.h * B.w ? [[A, x0, aName, aSub], [B, xb, bName, bSub]] : [[B, xb, bName, bSub], [A, x0, aName, aSub]];
      for (const [it, x, nm, sb] of order) {
        const cx = x + (it.w * ppm) / 2;
        if (!drawLabel(G, cx, nm, sb, placed, true)) {
          // try to the side
          const other = placed[0];
          const alt = cx < (other[0] + other[1]) / 2 ? other[0] - 80 : other[1] + 80;
          drawLabel(G, alt, nm, sb, placed, true);
        }
      }
      let pulsing = false;
      for (const [it, x] of [[A, x0], [B, xb]]) {
        if (it.h * ppm < 9 && it.w * ppm < 30) { drawRing(x + (it.w * ppm) / 2, G.horizon - Math.max(2, (it.h * ppm) / 2)); pulsing = true; }
      }
      return pulsing || !!cam.tw || fa < 1 || fb < 1;
    };
    busy = () => !!cam.tw;

    // first frame: start zoomed in a little, then ease out to the framing (cinematic intro)
    const first = () => {
      for (const b of rowA.children) b.classList.toggle('on', b.dataset.id === selA);
      for (const b of rowB.children) b.classList.toggle('on', b.dataset.id === selB);
      const cap = captionNow();
      setCaption(cap.main, cap.sub, false);
      const tl = targetLp();
      if (reduced) cam.lp = tl; else zoomTo(tl, tl + 0.7);
      // bring the selected chips into view
      for (const row of [rowA, rowB]) { const on = row.querySelector('.on'); if (on) row.scrollLeft = Math.max(0, on.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft - 24); }
    };
    onResizeMode = () => { if (cam.tw) cam.tw.to = targetLp(); else cam.lp = targetLp(); };
    startMode = first;
  }

  // =================== MODE: zoom (The Big Zoom) ===================
  if (mode === 'zoom') {
    const ceresA = ASTEROIDS.find(a => a.id === 'ceres'), bennuA = ASTEROIDS.find(a => a.id === 'bennu');
    const Z = [
      { it: silItem('finn'), name: commander, sub: '1.2 m tall', cap: () => `This is ${commander}: 1.2 metres tall. Slide to zoom out!` },
      { it: silItem('house'), name: 'A house', sub: '9 m tall', cap: () => { const c = countOf(9 / 1.2); return `A house: ${c.about}${c.text} ${commander}s tall!`; } },
      { it: silItem('starship'), name: 'Starship', sub: '124 m tall', cap: () => { const c = countOf(124 / 9); return `Starship: as tall as ${c.about}${c.text} houses stacked up!`; } },
      { it: silItem('eiffel'), name: 'Eiffel Tower', sub: '330 m tall', cap: () => { const c = countOf(330 / 124); return `The Eiffel Tower: ${c.about}${c.text} Starships tall!`; } },
      { it: rockItem(bennuA), name: 'Bennu', sub: '490 m across', img: 'bennu.jpg', cap: () => { const c = countOf(490 / 330); return `Bennu: as tall as ${c.about}${c.text} Eiffel Towers!`; } },
      { it: silItem('everest'), name: 'Mount Everest', sub: '8.8 km tall', cap: () => { const c = countOf(8849 / 490); return `Mount Everest: as tall as ${c.about}${c.text} Bennus stacked up!`; } },
      { it: rockItem(ceresA), name: 'Ceres', sub: '950 km across', img: 'ceres.jpg', cap: () => 'Ceres: about as wide as Great Britain is long!' },
      { it: planetItem('moon', 3475e3), name: 'The Moon', sub: '3,475 km across', img: 'moon-full.jpg', cap: () => { const c = countOf(3475 / 950); return `The Moon: ${c.about}${c.text} times as wide as Ceres!`; } },
      { it: planetItem('mars', 6792e3), name: 'Mars', sub: '6,792 km across', img: 'mars-globe.jpg', cap: () => { const t = timesOf(6792 / 3475); return `Mars: ${t.about}${t.text} as wide as the Moon!`; } },
      { it: planetItem('earth', 12756e3), name: 'Earth', sub: '12,756 km across', img: 'earth.jpg', cap: () => { const t = timesOf(12756 / 6792); return `Earth: ${t.about}${t.text} as wide as Mars!`; } },
      { it: planetItem('jupiter', 139820e3), name: 'Jupiter', sub: '139,820 km across', img: 'jupiter.jpg', cap: () => `Jupiter: ${Math.round(139820 / 12756)} Earths fit across it!` },
      { it: planetItem('sun', 1392700e3), name: 'The Sun', sub: '1.4 million km across', img: 'sun.jpg', cap: () => `The Sun: ${Math.round(1392700 / 12756)} Earths fit across it!` },
    ];
    const N = Z.length;
    let X = [], KF = [];
    function layoutRow() {
      X = []; let x = 0;
      for (let i = 0; i < N; i++) {
        X.push(x);
        if (i < N - 1) x += Z[i].it.w + 0.3 * Z[i].it.w + 0.05 * Z[i + 1].it.w;
      }
    }
    function keyframes() {
      const G = geom();
      const fillH = Math.min(0.7 * H, G.availH * 0.96);
      KF = Z.map((z, i) => {
        const right = X[i] + z.it.w;
        const ppm = Math.min(fillH / z.it.h, (G.availW * 0.94) / right);
        return { lp: Math.log(ppm), ax: G.left + (G.availW - right * ppm) / 2 };
      });
    }
    layoutRow();

    // slider UI
    const bar = document.createElement('div');
    bar.className = 'gs-zoombar';
    const ticks = Z.map((z, i) => `<span class="gs-tick" style="left:${(i / (N - 1)) * 100}%"></span>`).join('');
    bar.innerHTML = `<div class="gs-end">${esc(commander)}</div>
      <div class="gs-slider" role="slider" tabindex="0" aria-label="Zoom out from ${esc(commander)} to the Sun" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="gs-track"><div class="gs-fill"></div>${ticks}</div>
        <div class="gs-hint">Slide to zoom out &rarr;</div>
        <div class="gs-thumb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M7.5 10.5h6"/></svg></div>
      </div>
      <div class="gs-end">Sun</div>`;
    root.appendChild(bar);
    const slider = bar.querySelector('.gs-slider'), thumb = bar.querySelector('.gs-thumb'), fill = bar.querySelector('.gs-fill');
    const hint = bar.querySelector('.gs-hint'), tickEls = [...bar.querySelectorAll('.gs-tick')];

    let zv = clamp(+(qs.get('debugZoom') ?? data.start ?? 0) || 0, 0, 1);
    let zAnim = null, dragging = false, reachedSun = false, newest = 0, maxReached = 0;
    if (zv > 0) hint.classList.add('gone');

    function syncSlider() {
      const sw = slider.clientWidth;
      thumb.style.left = `${38 + zv * Math.max(0, sw - 76)}px`;
      fill.style.width = `${zv * 100}%`;
      const f = zv * (N - 1);
      tickEls.forEach((t, i) => t.classList.toggle('on', i <= f + 0.001));
      slider.setAttribute('aria-valuenow', String(Math.round(zv * 100)));
      slider.setAttribute('aria-valuetext', Z[newest].name);
    }
    function setZv(v) { zv = clamp(v, 0, 1); syncSlider(); dirty = true; kick(); }
    function animZv(to, dur) { zAnim = { from: zv, to: clamp(to, 0, 1), t0: performance.now(), dur: reduced ? 1 : dur }; kick(); }
    const posToV = clientX => { const r = slider.getBoundingClientRect(); return clamp((clientX - r.left - 38) / Math.max(1, r.width - 76), 0, 1); };
    const snapV = v => Math.round(v * (N - 1)) / (N - 1);
    const hideHint = () => hint.classList.add('gone');

    const onDown = e => {
      e.preventDefault();
      try { slider.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      dragging = true; slider.classList.add('drag'); hideHint();
      const v = posToV(e.clientX);
      const r = slider.getBoundingClientRect();
      if (Math.abs(v - zv) * (r.width - 76) > 44) animZv(v, 450); else { zAnim = null; setZv(v); }
      slider.focus({ preventScroll: true });
    };
    const onMove = e => { if (!dragging) return; zAnim = null; setZv(posToV(e.clientX)); };
    const onUp = () => {
      if (!dragging) return;
      dragging = false; slider.classList.remove('drag');
      const target = zAnim ? snapV(zAnim.to) : snapV(zv);
      animZv(target, 420);
    };
    const onKey = e => {
      const f = Math.round(zv * (N - 1));
      let to = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') to = Math.min(N - 1, f + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') to = Math.max(0, f - 1);
      else if (e.key === 'Home') to = 0; else if (e.key === 'End') to = N - 1;
      if (to === null) return;
      e.preventDefault(); hideHint(); animZv(to / (N - 1), 700);
    };
    slider.addEventListener('pointerdown', onDown);
    slider.addEventListener('pointermove', onMove);
    slider.addEventListener('pointerup', onUp);
    slider.addEventListener('pointercancel', onUp);
    slider.addEventListener('lostpointercapture', onUp);
    slider.addEventListener('keydown', onKey);

    onPhoto = () => { layoutRow(); keyframes(); dirty = true; kick(); };
    for (const z of Z) if (z.img) attachPhoto(z.it, z.img, (z.it.kind === 'planet' || (z.it.A && z.it.A.round)) ? 'disc' : 'rock');

    function camera() {
      const f = zv * (N - 1);
      const i = Math.min(N - 2, Math.floor(f)), s = f - i;
      const a = KF[i], b = KF[i + 1];
      return { ppm: Math.exp(lerp(a.lp, b.lp, s)), ax: lerp(a.ax, b.ax, s) };
    }

    renderMode = (G) => {
      const t = performance.now();
      if (zAnim) {
        const k = clamp((t - zAnim.t0) / zAnim.dur, 0, 1);
        zv = lerp(zAnim.from, zAnim.to, easeIO(k));
        if (k >= 1) zAnim = null;
        syncSlider();
      }
      if (KF.length !== N) keyframes();
      const { ppm, ax } = camera();
      drawRuler(G, ppm);
      // which object is the newest one fully in view?
      let nw = 0;
      for (let i = 0; i < N; i++) {
        const it = Z[i].it, x = ax + X[i] * ppm;
        if (it.h * ppm <= G.availH * 1.02 && x + it.w * ppm <= W + 4) nw = i;
      }
      for (let i = 0; i < N; i++) {
        const it = Z[i].it, x = ax + X[i] * ppm, w = it.w * ppm;
        if (x > W + 20 || x + w < -20) continue;
        drawItem(g, it, x, G.horizon, ppm, 1);
      }
      const placed = [];
      let pulsing = false;
      const lab = i => {
        const it = Z[i].it, x = ax + X[i] * ppm, w = it.w * ppm, h = it.h * ppm;
        if (x > W || x + w < 0) return;
        drawLabel(G, x + w / 2, Z[i].name, Z[i].sub, placed, i === nw);
      };
      lab(nw);
      if (nw > 0) {
        const p = nw - 1, it = Z[p].it, x = ax + X[p] * ppm, h = it.h * ppm, w = it.w * ppm;
        if (h < 10) { drawRing(x + w / 2, G.horizon - Math.max(2, h / 2)); pulsing = true; }
        lab(p);
      }
      for (let i = nw - 2; i >= 0; i--) if (Z[i].it.h * ppm >= 26) lab(i);
      if (nw !== newest || !lastCaption) {
        newest = nw;
        setCaption(Z[nw].cap(), `<b>${esc(Z[nw].name)}</b> ${esc(Z[nw].sub)}`, !!lastCaption);
        slider.setAttribute('aria-valuetext', Z[nw].name);
        if (nw > maxReached) maxReached = nw;
        if (nw === N - 1 && !reachedSun) {
          reachedSun = true;
          call('log', `Zoomed out from ${commander} all the way to the Sun!`);
          call('complete');
        }
      }
      return pulsing || !!zAnim;
    };
    busy = () => !!zAnim || dragging;
    onResizeMode = () => { keyframes(); syncSlider(); };
    startMode = () => { syncSlider(); };
    cleanups.push(() => {
      slider.removeEventListener('pointerdown', onDown);
      slider.removeEventListener('pointermove', onMove);
      slider.removeEventListener('pointerup', onUp);
      slider.removeEventListener('pointercancel', onUp);
      slider.removeEventListener('lostpointercapture', onUp);
      slider.removeEventListener('keydown', onKey);
    });
  }

  // =================== loop, resize, lifecycle ===================
  function render() {
    const G = geom();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackdrop(G);
    let more = false;
    try { more = renderMode(G); } catch (e) { console.warn('[scale] render', e); }
    return more;
  }
  function frame(t) {
    raf = 0;
    if (destroyed || document.hidden) return;
    now = t;
    dirty = false;
    const more = render();
    if (more || dirty) kick();
  }
  function kick() {
    if (!raf && !destroyed && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function resize() {
    if (destroyed) return;
    const r = view.getBoundingClientRect();
    const nW = Math.max(1, Math.round(r.width)), nH = Math.max(1, Math.round(r.height));
    const nd = Math.min(2, window.devicePixelRatio || 1);
    if (nW === W && nH === H && nd === dpr && canvas.width) { kick(); return; }
    W = nW; H = nH; dpr = nd;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (mode === 'zoom') {
      const fs = parseFloat(getComputedStyle(capMain).fontSize) || 30;
      capReserve = 16 + fs * 1.16 * (W < 700 ? 3 : 2) + 34;
    }
    onResizeMode();
    dirty = true;
    // repaint straight away so a resized (cleared) canvas never shows a blank frame
    if (!document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } frame(performance.now()); } else kick();
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(view);
  const onVis = () => { if (!document.hidden) { dirty = true; kick(); } };
  document.addEventListener('visibilitychange', onVis);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destroyed) { dirty = true; kick(); } }).catch(() => {});

  resize();
  startMode();
  dirty = true; kick();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      try { ro.disconnect(); } catch (e) { /* ignore */ }
      document.removeEventListener('visibilitychange', onVis);
      for (const f of cleanups) { try { f(); } catch (e) { /* ignore */ } }
      root.remove();
    },
  };
}
