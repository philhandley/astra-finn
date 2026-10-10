// Astra Finn: "Planet Lineup and Mars Jump" (planets.js)
// Two panels with a toggle at the top:
//   Lineup: Earth, Mars and the Moon to true scale. Tap one for a card. "Hand-size" turns them into
//           a football, a grapefruit and a tennis ball.
//   Jump:   choose how high Finn jumps on Earth, press JUMP, and watch the same jump on Earth, Mars
//           and the Moon side by side in real-time physics.
// ctx.data schema (all optional):
//   { tab: "lineup" | "jump",           // which panel opens first (default "lineup")
//     jumpCm: 30,                       // starting Earth jump height, 10..80 cm
//     cards: { earth: { title, text, more }, mars: {...}, moon: {...} } }   // override card text
// Calls ctx.complete() after the first full jump. ctx.log() one line per jump and on first Hand-size.

const TAU = Math.PI * 2;
const GOLD = '#f2b544', GOLD2 = '#ffd27a', INK = '#f3efe6', INK2 = '#b9c0cf', INK3 = '#7d869a', CYAN = '#5fd4ff';
const FONT_D = '"Space Grotesk", system-ui, sans-serif';
const FONT_B = 'Inter, system-ui, sans-serif';
const G_EARTH = 9.8, G_MARS = 3.7, G_MOON = 1.62;

const CSS = `
.g-planets { position:absolute; inset:0; display:flex; flex-direction:column; background:var(--bg); color:var(--ink); font-family:var(--font-body); overflow:hidden; user-select:none; -webkit-user-select:none; }
.g-planets .gp-top { flex:none; display:flex; justify-content:center; padding:12px 16px 8px; }
.g-planets .gp-tabs { display:inline-flex; padding:5px; gap:4px; border-radius:999px; background:rgba(255,255,255,.05); border:1px solid var(--line); }
.g-planets .gp-tab { appearance:none; border:0; cursor:pointer; min-height:56px; padding:0 26px; border-radius:999px; background:transparent; color:var(--ink-2); font-family:var(--font-display); font-weight:600; font-size:21px; transition:background .2s, color .2s; white-space:nowrap; }
.g-planets .gp-tab.on { background:var(--gold); color:#1a1205; box-shadow:0 6px 22px rgba(242,181,68,.25); }
.g-planets .gp-body { position:relative; flex:1 1 auto; min-height:0; }
.g-planets .gp-panel { position:absolute; inset:0; display:none; }
.g-planets .gp-panel.on { display:block; animation:gpIn .35s ease; }
@keyframes gpIn { from { opacity:0; } to { opacity:1; } }
.g-planets canvas.gp-cv { position:absolute; inset:0; width:100%; height:100%; display:block; touch-action:none; }
.g-planets .gp-cap { position:absolute; left:0; right:0; top:6px; padding:0 clamp(16px,3vw,40px); text-align:center; pointer-events:none; }
.g-planets .gp-cap-main { font-family:var(--font-display); font-weight:600; font-size:clamp(26px,2.7vw,34px); line-height:1.16; max-width:1000px; margin:0 auto; text-wrap:balance; text-shadow:0 2px 18px rgba(0,0,0,.7); }
.g-planets .gp-cap-sub { margin-top:6px; font-size:20px; color:var(--ink-2); text-shadow:0 2px 12px rgba(0,0,0,.7); }
.g-planets .gp-cap-sub b { color:var(--gold); font-weight:600; }
.g-planets .gp-handbtn { position:absolute; left:50%; bottom:18px; transform:translateX(-50%); }
.g-planets .gp-card { position:absolute; right:clamp(12px,2.5vw,32px); top:50%; transform:translateY(-50%); width:min(390px, calc(100% - 24px)); display:flex; flex-direction:column; gap:12px; animation:gpCard .3s ease; z-index:2; }
@keyframes gpCard { from { opacity:0; transform:translateY(-46%); } to { opacity:1; transform:translateY(-50%); } }
.g-planets .gp-card { background:rgba(14,20,38,.93); }
.g-planets .gp-card.low { top:auto; bottom:88px; right:auto; left:50%; transform:translateX(-50%); animation:gpCardLow .3s ease; }
@keyframes gpCardLow { from { opacity:0; transform:translate(-50%, 12px); } to { opacity:1; transform:translate(-50%, 0); } }
.g-planets .gp-card h3 { font-size:30px; }
.g-planets .gp-card .gp-lead { font-family:var(--font-display); font-weight:600; font-size:25px; line-height:1.25; color:var(--gold-2); margin:0; }
.g-planets .gp-card p { font-size:20px; margin:0; color:var(--ink); }
.g-planets .gp-card .gp-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.g-planets .gp-x { appearance:none; border:1.5px solid var(--line); background:rgba(255,255,255,.05); color:var(--ink); width:52px; height:52px; border-radius:50%; cursor:pointer; font-size:26px; line-height:1; display:grid; place-items:center; }
.g-planets .gp-jumpui { position:absolute; inset:0; display:flex; flex-direction:column; }
.g-planets .gp-ctrl { flex:none; display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:12px 18px; padding:4px 16px 10px; }
.g-planets .gp-q { font-family:var(--font-display); font-weight:600; font-size:22px; color:var(--ink); }
.g-planets .gp-stepper { display:flex; align-items:center; gap:10px; }
.g-planets .gp-pm { appearance:none; cursor:pointer; width:64px; height:64px; border-radius:50%; border:1.5px solid rgba(242,181,68,.55); background:rgba(242,181,68,.08); color:var(--gold-2); font-family:var(--font-display); font-size:34px; font-weight:600; line-height:1; display:grid; place-items:center; transition:transform .12s, background .2s; }
.g-planets .gp-pm:active { transform:scale(.92); background:rgba(242,181,68,.2); }
.g-planets .gp-pm:disabled { opacity:.35; cursor:default; }
.g-planets .gp-val { min-width:118px; text-align:center; font-family:var(--font-display); font-weight:700; font-size:38px; color:var(--ink); }
.g-planets .gp-val small { font-size:22px; color:var(--ink-2); font-weight:600; margin-left:4px; }
.g-planets .gp-jump { min-width:170px; }
.g-planets .gp-scenes { position:relative; flex:1 1 auto; min-height:0; }
.g-planets .gp-jcap { flex:none; text-align:center; padding:10px clamp(16px,3vw,40px) 14px; min-height:96px; }
.g-planets .gp-jcap .gp-cap-main { text-shadow:none; }
@media (max-width:640px) {
  .g-planets .gp-tab { padding:0 16px; font-size:19px; }
  .g-planets .gp-q { font-size:20px; width:100%; text-align:center; }
  .g-planets .gp-card.low { bottom:84px; }
}
@media (prefers-reduced-motion: reduce) { .g-planets .gp-panel.on, .g-planets .gp-card { animation:none; } }
`;

function injectCSS() {
  if (document.querySelector('style[data-module="planets"]')) return;
  const s = document.createElement('style');
  s.setAttribute('data-module', 'planets');
  s.textContent = CSS;
  document.head.appendChild(s);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function rrPath(p, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath();
}
// Height for people: "30 cm", "1.8 m"
function fmtH(m) { return m < 0.995 ? `${Math.round(m * 100)} cm` : `${Math.round(m * 10) / 10} m`; }

// ---------- sprites: planets and balls (procedural; photos replace planets when available) ----------
function blob(c, x, y, rx, ry, col, R, n = 9) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const t = (i / (n * 2)) * TAU, k = 0.75 + R() * 0.45;
    const px = x + Math.cos(t) * rx * k, py = y + Math.sin(t) * ry * k;
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath(); c.fill();
}
function crater(c, x, y, r, R) {
  c.save(); c.translate(x, y); c.scale(1, 0.85 + R() * 0.15);
  const gr = c.createLinearGradient(-r, -r, r, r);
  gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(255,240,215,0.18)');
  c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  c.restore();
}
function sphereShade(c, S, k = 0.6) {
  const m = S / 2, sh = c.createRadialGradient(m * 0.72, m * 0.66, m * 0.08, m, m, m * 1.02);
  sh.addColorStop(0, 'rgba(255,255,255,0.14)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, `rgba(0,0,0,${k})`);
  c.fillStyle = sh; c.fillRect(0, 0, S, S);
}
function makeSprite(kind) {
  const S = 512, cv = mkCanvas(S, S), c = cv.getContext('2d'), m = S / 2;
  const R = rng(kind.length * 131 + kind.charCodeAt(1));
  c.save(); c.beginPath(); c.arc(m, m, m, 0, TAU); c.clip();
  if (kind === 'earth') {
    const g = c.createRadialGradient(m * 0.8, m * 0.75, 0, m, m, m); g.addColorStop(0, '#3b82c4'); g.addColorStop(1, '#0f3567');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    blob(c, S * 0.5, S * 0.52, S * 0.15, S * 0.24, '#8f7c4c', R, 12);
    blob(c, S * 0.47, S * 0.6, S * 0.1, S * 0.14, '#4d6a35', R, 10);
    blob(c, S * 0.66, S * 0.36, S * 0.12, S * 0.08, '#9a8455', R, 10);
    blob(c, S * 0.46, S * 0.22, S * 0.12, S * 0.06, '#5d7340', R, 10);
    blob(c, m, S * 0.99, S * 0.42, S * 0.09, '#f2f4f7', R, 14);
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineCap = 'round';
    for (let i = 0; i < 46; i++) { c.lineWidth = 3 + R() * 9; const x = R() * S, y = R() * S, rr = 20 + R() * 70, a = R() * TAU; c.beginPath(); c.arc(x, y, rr, a, a + 0.6 + R() * 1.4); c.stroke(); }
    sphereShade(c, S, 0.6);
    c.strokeStyle = 'rgba(130,195,255,0.45)'; c.lineWidth = S * 0.02; c.beginPath(); c.arc(m, m, m - S * 0.01, 0, TAU); c.stroke();
  } else if (kind === 'mars') {
    const g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#d9774a'); g.addColorStop(1, '#a8482a');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 14; i++) blob(c, R() * S, S * (0.25 + R() * 0.55), S * (0.05 + R() * 0.12), S * (0.03 + R() * 0.07), 'rgba(80,32,20,0.32)', R);
    c.strokeStyle = 'rgba(70,25,15,0.5)'; c.lineWidth = S * 0.018; c.lineCap = 'round';
    c.beginPath(); c.moveTo(S * 0.22, S * 0.52); c.quadraticCurveTo(S * 0.45, S * 0.5, S * 0.7, S * 0.56); c.stroke();
    c.fillStyle = 'rgba(255,250,245,0.88)'; c.beginPath(); c.ellipse(m, S * 0.035, S * 0.2, S * 0.07, 0, 0, TAU); c.fill();
    sphereShade(c, S, 0.6);
  } else if (kind === 'moon') {
    c.fillStyle = '#b3b0a9'; c.fillRect(0, 0, S, S);
    const maria = [[0.36, 0.32, 0.15, 0.12], [0.58, 0.31, 0.08, 0.08], [0.65, 0.46, 0.1, 0.09], [0.82, 0.37, 0.05, 0.05], [0.24, 0.5, 0.13, 0.22], [0.44, 0.66, 0.09, 0.07], [0.74, 0.6, 0.07, 0.08]];
    for (const [x, y, rx, ry] of maria) blob(c, x * S, y * S, rx * S, ry * S, 'rgba(70,72,78,0.5)', R, 11);
    for (let i = 0; i < 120; i++) crater(c, R() * S, R() * S, 2 + Math.pow(R(), 3) * 16, R);
    sphereShade(c, S, 0.38);
  } else if (kind === 'football') {
    c.fillStyle = '#f4f2ec'; c.fillRect(0, 0, S, S);
    // classic truncated-icosahedron look: a centre pentagon and five around the rim
    const pent = (cx, cy, r, rot, squash) => {
      c.beginPath();
      for (let i = 0; i < 5; i++) { const a = rot + (i / 5) * TAU; const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * squash; i ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.closePath(); c.fill();
    };
    c.fillStyle = '#16181d';
    pent(m * 1.04, m * 0.98, S * 0.13, -Math.PI / 2, 1);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + Math.PI / 5 + (i / 5) * TAU;
      const d = S * 0.4;
      c.save(); c.translate(m * 1.04 + Math.cos(a) * d, m * 0.98 + Math.sin(a) * d); c.rotate(a + Math.PI / 2); c.scale(1, 0.55);
      pent(0, 0, S * 0.12, Math.PI / 2, 1); c.restore();
    }
    c.strokeStyle = 'rgba(40,40,46,0.35)'; c.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU, x0 = m * 1.04 + Math.cos(a) * S * 0.13, y0 = m * 0.98 + Math.sin(a) * S * 0.13;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(m * 1.04 + Math.cos(a) * S * 0.3, m * 0.98 + Math.sin(a) * S * 0.3); c.stroke();
    }
    sphereShade(c, S, 0.55);
  } else if (kind === 'grapefruit') {
    const g = c.createRadialGradient(m * 0.7, m * 0.65, 0, m, m, m); g.addColorStop(0, '#ffc07a'); g.addColorStop(0.6, '#f28f4e'); g.addColorStop(1, '#c4552e');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { c.fillStyle = R() < 0.5 ? 'rgba(255,230,190,0.18)' : 'rgba(150,50,20,0.14)'; c.beginPath(); c.arc(R() * S, R() * S, 1 + R() * 2.2, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(120,60,20,0.5)'; c.beginPath(); c.arc(m * 1.2, m * 0.5, S * 0.018, 0, TAU); c.fill();
    sphereShade(c, S, 0.45);
    const hl = c.createRadialGradient(m * 0.62, m * 0.55, 0, m * 0.62, m * 0.55, S * 0.16);
    hl.addColorStop(0, 'rgba(255,255,255,0.35)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl; c.fillRect(0, 0, S, S);
  } else if (kind === 'tennis') {
    const g = c.createRadialGradient(m * 0.7, m * 0.65, 0, m, m, m); g.addColorStop(0, '#eef77a'); g.addColorStop(0.6, '#cfe03a'); g.addColorStop(1, '#93a21c');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 4000; i++) { c.fillStyle = R() < 0.5 ? 'rgba(255,255,220,0.12)' : 'rgba(90,100,10,0.12)'; c.fillRect(R() * S, R() * S, 1.5, 1.5); }
    c.strokeStyle = '#f7f7ef'; c.lineWidth = S * 0.035; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-S * 0.05, S * 0.3); c.bezierCurveTo(S * 0.45, S * 0.15, S * 0.55, S * 0.85, S * 1.05, S * 0.7); c.stroke();
    sphereShade(c, S, 0.5);
  }
  c.restore();
  return cv;
}
function loadImage(name) {
  return new Promise(res => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = new URL('../../assets/img/' + name, import.meta.url).href;
  });
}
// Square crop of a full planet disc on a black background, or null if the photo isn't one.
function discFromPhoto(im) {
  try {
    const nw = im.naturalWidth, nh = im.naturalHeight; if (!nw || !nh) return null;
    const k = Math.min(1, 360 / Math.max(nw, nh)), W = Math.max(8, Math.round(nw * k)), H = Math.max(8, Math.round(nh * k));
    const cv = mkCanvas(W, H), c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(im, 0, 0, W, H);
    const px = c.getImageData(0, 0, W, H).data;
    const rows = new Int32Array(H), cols = new Int32Array(W); let n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2] > 22) { rows[y]++; cols[x]++; n++; }
    }
    let y0 = -1, y1 = -1, x0 = -1, x1 = -1;
    for (let y = 0; y < H; y++) if (rows[y] > Math.max(2, W * 0.01)) { if (y0 < 0) y0 = y; y1 = y; }
    for (let x = 0; x < W; x++) if (cols[x] > Math.max(2, H * 0.01)) { if (x0 < 0) x0 = x; x1 = x; }
    if (y0 < 0 || x0 < 0) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, ar = bw / bh;
    const touch = (x0 <= 1) + (y0 <= 1) + (x1 >= W - 2) + (y1 >= H - 2);
    if (touch || ar < 0.85 || ar > 1.18 || n / (bw * bh) < 0.7) return null;
    const S = 512, out = mkCanvas(S, S), r = Math.max(bw, bh) / 2 / k;
    out.getContext('2d').drawImage(im, ((x0 + x1) / 2) / k - r, ((y0 + y1) / 2) / k - r, 2 * r, 2 * r, 0, 0, S, S);
    return out;
  } catch (e) { return null; }
}

// ---------- comparison silhouettes (metres, y up from the ground) ----------
function builder(x0, y0, s) {
  const parts = [];
  const X = a => x0 + a * s, Y = b => y0 - b * s;
  const b = {
    parts,
    poly(pts) { const p = new Path2D(); pts.forEach(([a, c], i) => (i ? p.lineTo(X(a), Y(c)) : p.moveTo(X(a), Y(c)))); p.closePath(); parts.push(p); return b; },
    rect(a, c, w, h) { const p = new Path2D(); p.rect(X(a), Y(c + h), w * s, h * s); parts.push(p); return b; },
    rr(a, c, w, h, r) { const p = new Path2D(); rrPath(p, X(a), Y(c + h), w * s, h * s, r * s); parts.push(p); return b; },
    circ(a, c, r) { const p = new Path2D(); p.arc(X(a), Y(c), Math.max(0.05, r * s), 0, TAU); parts.push(p); return b; },
    ell(a, c, rx, ry) { const p = new Path2D(); p.ellipse(X(a), Y(c), Math.max(0.05, rx * s), Math.max(0.05, ry * s), 0, 0, TAU); parts.push(p); return b; },
    path(cmds) {
      const p = new Path2D();
      for (const k of cmds) {
        if (k[0] === 'M') p.moveTo(X(k[1]), Y(k[2]));
        else if (k[0] === 'L') p.lineTo(X(k[1]), Y(k[2]));
        else if (k[0] === 'Q') p.quadraticCurveTo(X(k[1]), Y(k[2]), X(k[3]), Y(k[4]));
      }
      p.closePath(); parts.push(p); return b;
    },
  };
  return b;
}
const THINGS = {
  cat: { h: 0.31, w: 0.5, shape(b) {
    b.ell(0.25, 0.17, 0.17, 0.07).circ(0.075, 0.245, 0.058)
      .poly([[0.03, 0.27], [0.033, 0.312], [0.065, 0.29]]).poly([[0.08, 0.295], [0.11, 0.31], [0.115, 0.268]])
      .poly([[0.05, 0.2], [0.11, 0.27], [0.17, 0.2], [0.12, 0.13]])
      .rect(0.1, 0, 0.032, 0.16).rect(0.15, 0, 0.032, 0.15).rect(0.33, 0, 0.032, 0.16).rect(0.38, 0, 0.032, 0.15)
      .poly([[0.405, 0.19], [0.465, 0.23], [0.495, 0.3], [0.475, 0.31], [0.45, 0.245], [0.395, 0.21]]);
  } },
  table: { h: 0.755, w: 1.2, shape(b) {
    b.rr(0, 0.71, 1.2, 0.045, 0.012).rect(0.07, 0, 0.055, 0.71).rect(1.075, 0, 0.055, 0.71).rect(0.07, 0.63, 1.06, 0.08);
  } },
  dad: { h: 1.79, w: 0.56, shape(b) {
    b.circ(0.28, 1.68, 0.11).rect(0.25, 1.5, 0.06, 0.1)
      .path([['M', 0.06, 1.42], ['Q', 0.07, 1.53, 0.17, 1.545], ['L', 0.39, 1.545], ['Q', 0.49, 1.53, 0.5, 1.42], ['L', 0.45, 0.92], ['L', 0.11, 0.92]])
      .poly([[0.062, 1.44], [0.13, 1.43], [0.1, 0.9], [0.035, 0.9]]).poly([[0.498, 1.44], [0.43, 1.43], [0.46, 0.9], [0.525, 0.9]])
      .circ(0.068, 0.87, 0.04).circ(0.492, 0.87, 0.04)
      .poly([[0.115, 0.96], [0.28, 0.96], [0.265, 0.06], [0.15, 0.06]]).poly([[0.28, 0.96], [0.445, 0.96], [0.41, 0.06], [0.295, 0.06]])
      .rr(0.12, 0, 0.17, 0.075, 0.03).rr(0.28, 0, 0.17, 0.075, 0.03);
  } },
  door: { h: 2.04, w: 0.98, shape(b) { b.rect(0, 0, 0.98, 2.04); },
    detail(b) { b.rect(0.07, 0, 0.84, 1.97); },
    detail2(b) { b.rect(0.2, 1.12, 0.58, 0.68).rect(0.2, 0.2, 0.58, 0.76); },
    extra(c, x, y, s) { c.fillStyle = GOLD; c.beginPath(); c.arc(x + 0.8 * s, y - 1.02 * s, Math.max(1.5, 0.035 * s), 0, TAU); c.fill(); } },
  bus: { h: 4.4, w: 11, shape(b) { b.rr(0, 0.38, 11, 4.02, 0.5).circ(2.3, 0.55, 0.55).circ(8.7, 0.55, 0.55); },
    detail2(b) {
      for (let i = 0; i < 6; i++) b.rr(0.5 + i * 1.66, 2.95, 1.42, 1.0, 0.14);
      for (let i = 0; i < 5; i++) b.rr(2.0 + i * 1.66, 1.6, 1.42, 0.95, 0.14);
      b.rr(0.45, 0.62, 1.05, 1.95, 0.1).rr(10.25, 1.45, 0.55, 1.12, 0.1).circ(2.3, 0.55, 0.24).circ(8.7, 0.55, 0.24);
    } },
};
function drawThing(c, key, x, y, s, alpha = 1, flip = false) {
  const T = THINGS[key];
  c.save();
  c.globalAlpha = alpha;
  if (flip) { c.translate(x + T.w * s, 0); c.scale(-1, 1); x = 0; }
  const b = builder(x, y, s); T.shape(b);
  const lw = clamp(T.h * s * 0.012, 1, 2);
  c.lineJoin = 'round';
  c.strokeStyle = GOLD; c.lineWidth = lw * 2;
  for (const p of b.parts) c.stroke(p);
  const g = c.createLinearGradient(0, y - T.h * s, 0, y);
  g.addColorStop(0, '#cfd5e1'); g.addColorStop(1, '#8d95a7');
  c.fillStyle = g;
  for (const p of b.parts) c.fill(p);
  if (T.detail) { const d = builder(x, y, s); T.detail(d); c.fillStyle = 'rgba(150,158,176,0.9)'; for (const p of d.parts) c.fill(p); }
  if (T.detail2 && T.h * s > 30) {
    const d = builder(x, y, s); T.detail2(d);
    c.fillStyle = 'rgba(9,13,28,0.85)'; c.strokeStyle = 'rgba(242,181,68,0.5)'; c.lineWidth = Math.max(0.8, lw * 0.7);
    for (const p of d.parts) { c.fill(p); c.stroke(p); }
  }
  if (T.extra) T.extra(c, x, y, s);
  c.restore();
}

// ---------- the astronaut (1.2 m tall, Finn in a spacesuit) ----------
// pose: { squash 0..1 (crouch/landing), up 0..1 (arms raised in the air) }
function drawAstronaut(c, x, y, s, pose) {
  const sq = pose.squash || 0, up = pose.up || 0;
  c.save();
  c.translate(x, y);
  c.scale(s * (1 + 0.08 * sq), s * (1 - 0.17 * sq));
  c.lineCap = 'round'; c.lineJoin = 'round';
  const suit = c.createLinearGradient(-0.2, -1.2, 0.2, 0);
  suit.addColorStop(0, '#fbf9f4'); suit.addColorStop(1, '#c9c5bc');
  // backpack
  c.fillStyle = '#8f98aa'; c.beginPath(); rrPath(c, -0.215, -1.0, 0.13, 0.38, 0.04); c.fill();
  // legs (knees bend forward when crouching)
  const knee = 0.09 * sq;
  c.strokeStyle = '#e4e0d7'; c.lineWidth = 0.115;
  for (const dx of [-0.055, 0.06]) {
    c.beginPath(); c.moveTo(dx, -0.52); c.lineTo(dx + knee + 0.01, -0.28); c.lineTo(dx, -0.07); c.stroke();
  }
  c.fillStyle = '#7d8594';
  c.beginPath(); rrPath(c, -0.125, -0.075, 0.15, 0.075, 0.025); c.fill();
  c.beginPath(); rrPath(c, -0.005, -0.075, 0.15, 0.075, 0.025); c.fill();
  // body
  c.fillStyle = suit; c.beginPath(); rrPath(c, -0.135, -0.99, 0.27, 0.52, 0.08); c.fill();
  c.fillStyle = '#2b3550'; c.beginPath(); rrPath(c, -0.035, -0.86, 0.13, 0.085, 0.015); c.fill();
  c.fillStyle = GOLD; c.beginPath(); c.arc(0.0, -0.818, 0.012, 0, TAU); c.fill();
  c.fillStyle = CYAN; c.beginPath(); c.arc(0.04, -0.818, 0.012, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 0.012; c.beginPath(); c.moveTo(-0.13, -0.55); c.lineTo(0.13, -0.55); c.stroke();
  // arms: down at the sides, swinging up while in the air
  c.strokeStyle = '#ece9e1'; c.lineWidth = 0.088;
  const arm = (sx, side) => {
    const hx = lerp(sx + side * 0.05, sx + side * 0.11, up), hy = lerp(-0.6, -1.2, up);
    const ex = lerp(sx + side * 0.04, sx + side * 0.12, up), ey = lerp(-0.76, -1.02, up);
    c.beginPath(); c.moveTo(sx, -0.93); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
    c.fillStyle = '#c9ced6'; c.beginPath(); c.arc(hx, hy, 0.048, 0, TAU); c.fill();
  };
  arm(-0.11, -1); arm(0.11, 1);
  // helmet + gold visor
  const hg = c.createRadialGradient(-0.03, -1.11, 0.02, 0.01, -1.06, 0.16);
  hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, '#cfcac0');
  c.fillStyle = hg; c.beginPath(); c.arc(0.01, -1.06, 0.14, 0, TAU); c.fill();
  const vg = c.createLinearGradient(0.0, -1.13, 0.12, -0.99);
  vg.addColorStop(0, GOLD2); vg.addColorStop(0.55, GOLD); vg.addColorStop(1, '#8a5a12');
  c.fillStyle = vg; c.beginPath(); c.ellipse(0.055, -1.06, 0.092, 0.074, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(0.03, -1.09, 0.03, 0.016, -0.5, 0, TAU); c.fill();
  c.restore();
}

// ---------- the three worlds ----------
const WORLDS = [
  { id: 'earth', name: 'Earth', g: G_EARTH, pull: 'Normal pull', sky: ['#0a1d36', '#2a5a86'], ground: ['#2a3f2d', '#141f17'], edge: '#4d6b4e', dust: '150,130,100' },
  { id: 'mars', name: 'Mars', g: G_MARS, pull: 'Weaker pull', sky: ['#1f100c', '#9c5636'], ground: ['#7a3b22', '#3f1d10'], edge: '#a2583a', dust: '190,110,70' },
  { id: 'moon', name: 'Moon', g: G_MOON, pull: 'Very weak pull', sky: ['#020306', '#0a0d16'], ground: ['#76777c', '#3b3c40'], edge: '#9a9ba0', dust: '190,190,195' },
];

// =====================================================================
export async function mount(el, ctx) {
  injectCSS();
  ctx = ctx || {};
  const data = (ctx.data && typeof ctx.data === 'object') ? ctx.data : {};
  const qs = new URLSearchParams(location.search);
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const finn = (ctx.crew && ctx.crew.commander) || 'Finn';
  const dad = (ctx.crew && ctx.crew.engineer) || 'Dad';

  let destroyed = false;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (!destroyed) { try { fn(); } catch (e) { console.warn('[planets]', e); } } }, ms);
    timers.add(id); return id;
  };
  const call = (name, ...a) => { try { if (typeof ctx[name] === 'function') return ctx[name](...a); } catch (e) { console.warn('[planets] ctx.' + name, e); } };
  let speakTimer = 0;
  const sayLater = (text, ms = 500) => {
    if (speakTimer) { clearTimeout(speakTimer); timers.delete(speakTimer); }
    speakTimer = later(() => { speakTimer = 0; call('speak', text); }, ms);
  };

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.className = 'g-planets';
  root.innerHTML = `
    <div class="gp-top"><div class="gp-tabs" role="tablist">
      <button type="button" class="gp-tab" role="tab" data-tab="lineup">Planet Lineup</button>
      <button type="button" class="gp-tab" role="tab" data-tab="jump">Mars Jump</button>
    </div></div>
    <div class="gp-body">
      <section class="gp-panel" data-panel="lineup">
        <canvas class="gp-cv" aria-label="Earth, Mars and the Moon to scale. Tap a planet."></canvas>
        <div class="gp-cap"><div class="gp-cap-main"></div><div class="gp-cap-sub"></div></div>
        <button type="button" class="btn gp-handbtn">Hand-size</button>
      </section>
      <section class="gp-panel" data-panel="jump">
        <div class="gp-jumpui">
          <div class="gp-ctrl">
            <div class="gp-q">How high can ${esc(finn)} jump on Earth?</div>
            <div class="gp-stepper">
              <button type="button" class="gp-pm" data-d="-5" aria-label="Lower">&minus;</button>
              <div class="gp-val" aria-live="polite"></div>
              <button type="button" class="gp-pm" data-d="5" aria-label="Higher">+</button>
            </div>
            <button type="button" class="btn big gp-jump">JUMP!</button>
          </div>
          <div class="gp-scenes"><canvas class="gp-cv" aria-label="The same jump on Earth, Mars and the Moon"></canvas></div>
          <div class="gp-jcap"><div class="gp-cap-main"></div><div class="gp-cap-sub"></div></div>
        </div>
      </section>
    </div>`;
  el.appendChild(root);
  const $ = s => root.querySelector(s);
  const tabs = [...root.querySelectorAll('.gp-tab')];
  const panelL = $('[data-panel="lineup"]'), panelJ = $('[data-panel="jump"]');
  const cvL = panelL.querySelector('canvas'), cvJ = panelJ.querySelector('canvas');
  const gL = cvL.getContext('2d'), gJ = cvJ.getContext('2d');
  const capL = panelL.querySelector('.gp-cap'), capLMain = capL.querySelector('.gp-cap-main'), capLSub = capL.querySelector('.gp-cap-sub');
  const handBtn = panelL.querySelector('.gp-handbtn');
  const scenesBox = panelJ.querySelector('.gp-scenes');
  const valEl = panelJ.querySelector('.gp-val'), jumpBtn = panelJ.querySelector('.gp-jump');
  const pmBtns = [...panelJ.querySelectorAll('.gp-pm')];
  const capJMain = panelJ.querySelector('.gp-jcap .gp-cap-main'), capJSub = panelJ.querySelector('.gp-jcap .gp-cap-sub');

  let tab = (qs.get('debugTab') || data.tab) === 'jump' ? 'jump' : 'lineup';
  let raf = 0, lastT = performance.now(), dirty = true;
  const sz = { L: { W: 1, H: 1 }, J: { W: 1, H: 1 } };
  let dpr = 1;
  const listeners = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); listeners.push([target, type, fn, opts]); };

  function setTab(t) {
    tab = t;
    tabs.forEach(b => { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', String(b.dataset.tab === t)); });
    panelL.classList.toggle('on', t === 'lineup');
    panelJ.classList.toggle('on', t === 'jump');
    if (t !== 'lineup') closeCard();
    resize();
    dirty = true; kick();
  }
  tabs.forEach(b => on(b, 'click', () => setTab(b.dataset.tab)));

  // =================== LINEUP ===================
  const BODIES = [
    { id: 'earth', name: 'Earth', d: 12756, img: 'earth.jpg', ball: 'football', ballName: 'Football', ballCm: '22 cm' },
    { id: 'mars', name: 'Mars', d: 6792, img: 'mars-globe.jpg', ball: 'grapefruit', ballName: 'Grapefruit', ballCm: '12 cm' },
    { id: 'moon', name: 'The Moon', d: 3475, img: 'moon-full.jpg', ball: 'tennis', ballName: 'Tennis ball', ballCm: '6 cm' },
  ];
  const CARD_DEFAULTS = {
    earth: { title: 'Earth', lead: 'Our home.', text: '12,756 km across. The biggest of these three.' },
    mars: { title: 'Mars', lead: 'About half as wide as Earth.', text: '6,792 km across. Two Marses would almost fit across Earth.' },
    moon: { title: 'The Moon', lead: 'About a quarter as wide as Earth.', text: '3,475 km across. Almost four Moons would fit across Earth.' },
  };
  const cardsData = (data.cards && typeof data.cards === 'object') ? data.cards : {};
  for (const b of BODIES) { b.sprite = makeSprite(b.id); b.ballSprite = makeSprite(b.ball); b.photo = null; }
  for (const b of BODIES) loadImage(b.img).then(im => { if (destroyed || !im) return; const d = discFromPhoto(im); if (d) { b.photo = d; dirty = true; kick(); } });

  const L = { hand: qs.get('debugHand') === '1', handT: qs.get('debugHand') === '1' ? 1 : 0, shift: 0, card: null, cardEl: null, loggedHand: false, starsKey: '', stars: null, layout: null };

  function lineupCaption() {
    if (L.hand) {
      capLMain.textContent = 'If Earth were a football, Mars would be a grapefruit and the Moon a tennis ball!';
      capLSub.innerHTML = 'Football <b>22 cm</b> &middot; grapefruit <b>12 cm</b> &middot; tennis ball <b>6 cm</b>';
    } else {
      capLMain.textContent = 'Earth, Mars and the Moon, to scale';
      capLSub.textContent = 'Tap a planet to find out more.';
    }
  }
  lineupCaption();
  handBtn.textContent = L.hand ? 'Back to planets' : 'Hand-size';

  on(handBtn, 'click', () => {
    L.hand = !L.hand;
    handBtn.textContent = L.hand ? 'Back to planets' : 'Hand-size';
    lineupCaption();
    if (L.hand) {
      sayLater(capLMain.textContent, 250);
      if (!L.loggedHand) { L.loggedHand = true; call('log', 'Shrank the planets to hand-size: Earth a football, Mars a grapefruit, the Moon a tennis ball'); }
    }
    if (L.card) openCard(L.card, false);
    dirty = true; kick();
  });

  function closeCard() {
    if (L.cardEl) { L.cardEl.remove(); L.cardEl = null; }
    L.card = null; dirty = true; kick();
  }
  function openCard(id, speakIt = true) {
    const b = BODIES.find(x => x.id === id); if (!b) return;
    const over = cardsData[id] || {};
    const cd = { ...CARD_DEFAULTS[id], ...over };
    const handLine = L.hand ? `<p>Hand-size: a ${esc(b.ballName.toLowerCase())}, ${esc(b.ballCm)} across.</p>` : '';
    if (L.cardEl) L.cardEl.remove();
    const card = document.createElement('div');
    card.className = 'card gp-card' + (sz.L.W <= 900 ? ' low' : '');
    card.innerHTML = `<div class="gp-row"><h3>${esc(cd.title)}</h3>
        <div class="gp-row"><button type="button" class="speak-btn" aria-label="Read aloud"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg></button>
        <button type="button" class="gp-x" aria-label="Close">&times;</button></div></div>
      <p class="gp-lead">${esc(cd.lead || '')}</p><p>${esc(cd.text || '')}</p>${handLine}`;
    panelL.appendChild(card);
    L.cardEl = card; L.card = id;
    const spoken = `${cd.title}. ${cd.lead || ''} ${cd.text || ''}`.trim();
    card.querySelector('.speak-btn').addEventListener('click', () => call('speak', spoken));
    card.querySelector('.gp-x').addEventListener('click', closeCard);
    if (speakIt) sayLater(spoken, 200);
    dirty = true; kick();
  }

  function lineupLayout() {
    const { W, H } = sz.L;
    const capB = capL.offsetTop + capL.offsetHeight;
    const btnTop = handBtn.offsetTop || (H - 80);
    const top = capB + 20;
    let bottom = btnTop - (W < 520 ? 120 : 66);
    if (W <= 900 && L.cardEl) bottom = Math.max(top + 80, Math.min(bottom, L.cardEl.offsetTop - 60));
    const availH = Math.max(60, bottom - top);
    const wide = W > 900;
    const cardW = wide ? Math.min(390, W * 0.32) + 40 : 0;
    const E = Math.max(40, Math.min(availH * 0.94, (W - 72 - (wide ? cardW * L.shift : 0)) / 2.12));
    const gap = E * 0.13;
    const ds = BODIES.map(b => (E * b.d) / 12756);
    const total = ds.reduce((a, b) => a + b, 0) + gap * 2;
    let x = (W - (wide ? cardW * L.shift : 0) - total) / 2;
    const cy = top + availH / 2;
    const out = BODIES.map((b, i) => { const r = ds[i] / 2, cx = x + r; x += ds[i] + gap; return { b, cx, cy, r }; });
    return { items: out, labelY: cy + E / 2 + 30 };
  }

  function lineupStars(W, H) {
    const key = `${W}x${H}@${dpr}`;
    if (key === L.starsKey) return L.stars;
    const cv = mkCanvas(W * dpr, H * dpr), c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createRadialGradient(W * 0.5, H * 0.55, 0, W * 0.5, H * 0.55, Math.max(W, H) * 0.75);
    g.addColorStop(0, '#0d1428'); g.addColorStop(1, '#04060c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const R = rng(77), n = Math.round((W * H) / 2200);
    for (let i = 0; i < n; i++) {
      const z = R();
      c.fillStyle = `rgba(${z > 0.85 ? '255,226,170' : '235,240,255'},${0.15 + Math.pow(R(), 2) * 0.6})`;
      c.beginPath(); c.arc(R() * W, R() * H, z > 0.96 ? 1.3 : z > 0.7 ? 0.9 : 0.6, 0, TAU); c.fill();
    }
    L.starsKey = key; L.stars = cv;
    return cv;
  }

  function renderLineup(dt) {
    const { W, H } = sz.L, c = gL;
    // animate the hand-size morph and the shift that makes room for the card
    const tgt = L.hand ? 1 : 0, sTgt = L.card ? 1 : 0;
    const speed = reduced ? 100 : 1.4;
    L.handT = tgt > L.handT ? Math.min(tgt, L.handT + dt * speed) : Math.max(tgt, L.handT - dt * speed);
    const sSpeed = reduced ? 100 : 5;
    L.shift = sTgt > L.shift ? Math.min(1, L.shift + dt * sSpeed) : Math.max(0, L.shift - dt * sSpeed);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(lineupStars(W, H), 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const lay = lineupLayout(); L.layout = lay;
    const e = easeIO(L.handT);
    c.font = `600 22px ${FONT_D}`;
    let prevRight = -1e9, row = 0;
    const rows = lay.items.map(({ b, cx }) => {
      const nm = e < 0.5 ? b.name : b.ballName, sb = e < 0.5 ? `${b.d.toLocaleString('en-GB')} km` : b.ballCm;
      const hw = Math.max(c.measureText(nm).width, c.measureText(sb).width * 0.9) / 2 + 6;
      row = (cx - hw < prevRight && row === 0) ? 1 : 0;
      if (row === 0) prevRight = cx + hw;
      return row;
    });
    for (const [idx, { b, cx, cy, r }] of lay.items.entries()) {
      const pulse = 1 + 0.07 * Math.sin(Math.PI * e);
      const rr = r * pulse;
      if (b.id === 'earth' && e < 1) {
        const gl = c.createRadialGradient(cx, cy, rr * 0.95, cx, cy, rr * 1.14);
        gl.addColorStop(0, `rgba(110,180,255,${0.32 * (1 - e)})`); gl.addColorStop(1, 'rgba(110,180,255,0)');
        c.fillStyle = gl; c.beginPath(); c.arc(cx, cy, rr * 1.14, 0, TAU); c.fill();
      }
      c.save();
      c.beginPath(); c.arc(cx, cy, rr, 0, TAU); c.clip();
      if (e < 1) { c.globalAlpha = 1 - e; c.drawImage(b.photo || b.sprite, cx - rr, cy - rr, rr * 2, rr * 2); }
      if (e > 0) {
        c.globalAlpha = e;
        c.translate(cx, cy); c.rotate((1 - e) * 2.2); c.translate(-cx, -cy);
        c.drawImage(b.ballSprite, cx - rr, cy - rr, rr * 2, rr * 2);
      }
      c.restore();
      if (L.card === b.id) {
        c.strokeStyle = GOLD; c.lineWidth = 2.5;
        c.beginPath(); c.arc(cx, cy, rr + 10, 0, TAU); c.stroke();
      }
      // labels crossfade
      const name = e < 0.5 ? b.name : b.ballName;
      const sub = e < 0.5 ? `${b.d.toLocaleString('en-GB')} km` : b.ballCm;
      const a = Math.abs(e - 0.5) * 2;
      c.globalAlpha = reduced ? 1 : Math.max(0.15, a);
      c.textAlign = 'center';
      const ly = lay.labelY + rows[idx] * 54;
      c.font = `600 22px ${FONT_D}`; c.fillStyle = INK; c.fillText(name, cx, ly);
      c.font = `500 19px ${FONT_B}`; c.fillStyle = GOLD2; c.fillText(sub, cx, ly + 24);
      c.globalAlpha = 1;
    }
    return L.handT !== tgt || L.shift !== sTgt;
  }

  on(cvL, 'pointerdown', e => {
    const lay = L.layout; if (!lay) return;
    const r = cvL.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let hit = null;
    for (const it of lay.items) if (Math.hypot(x - it.cx, y - it.cy) <= Math.max(it.r + 10, 38)) hit = it.b.id;
    if (hit) { if (L.card === hit) closeCard(); else openCard(hit); }
    else if (L.card) closeCard();
  });

  // =================== JUMP ===================
  const CROUCH = 0.22, VX = 0.28;
  const COMPARE = [
    { key: 'cat', h: 0.30, label: 'Cat 30 cm', as: 'as high as a cat', over: 'higher than a cat' },
    { key: 'table', h: 0.75, label: 'Table 75 cm', as: 'as high as a table', over: 'higher than a table' },
    { key: 'dad', h: 1.8, label: `${dad} 1.8 m`, as: `as high as ${dad} is tall`, over: `higher than ${dad}'s head` },
    { key: 'door', h: 2.0, label: 'Door 2 m', as: 'as high as a door', over: 'higher than a door' },
    { key: 'bus', h: 4.4, label: 'Bus 4.4 m', as: 'as high as a double-decker bus', over: 'higher than a double-decker bus' },
  ];
  // A true, friendly comparison for a jump height in metres: { text, o } where o is the thing named.
  function compare(h) {
    let best = null;
    for (const o of COMPARE) { const k = Math.abs(h - o.h) / o.h; if (k <= 0.12 && (!best || k < best.k)) best = { o, k }; }
    if (best) return { text: best.o.as, o: best.o };
    const below = COMPARE.filter(o => o.h < h);
    if (below.length) { const o = below[below.length - 1]; return { text: o.over, o }; }
    const r = h / COMPARE[0].h;
    return { o: COMPARE[0], text: r >= 0.6 ? 'almost as high as a cat' : r >= 0.4 ? 'about half as high as a cat' : 'about a third as high as a cat' };
  }
  const phrase = h => compare(h).text;
  // The silhouette that stands next to the jumper is the one the caption talks about.
  const pickThing = h => compare(h).o;

  let saved = null; try { saved = ctx.load ? ctx.load('jumpCm') : null; } catch (e) { saved = null; }
  const startCm = +(qs.get('debugCm') || saved || data.jumpCm || 30);
  const J = {
    cm: clamp(Math.round((Number.isFinite(startCm) ? startCm : 30) / 5) * 5, 10, 80),
    t: -1, running: false, freeze: qs.has('debugFreeze') ? Math.max(0, +qs.get('debugFreeze') || 0) : null,
    ppm: 0, captioned: false, finished: false, landedSnd: [false, false, false], completed: false, jumps: 0,
  };
  const heights = () => { const hE = J.cm / 100, v0 = Math.sqrt(2 * G_EARTH * hE); return WORLDS.map(w => ({ v0, h: (v0 * v0) / (2 * w.g), T: (2 * v0) / w.g })); };

  function jumpIdleCaption() {
    capJMain.textContent = 'Press JUMP to see the same jump on Mars and the Moon!';
    capJSub.textContent = 'Same legs, same push. Only the pull of gravity changes.';
  }
  function showValue() {
    valEl.innerHTML = `${J.cm}<small>cm</small>`;
    pmBtns[0].disabled = J.cm <= 10; pmBtns[1].disabled = J.cm >= 80;
  }
  showValue(); jumpIdleCaption();

  pmBtns.forEach(b => on(b, 'click', () => {
    const v = clamp(J.cm + +b.dataset.d, 10, 80);
    if (v === J.cm) return;
    J.cm = v; showValue();
    try { if (ctx.save) ctx.save('jumpCm', v); } catch (e) { /* ignore */ }
    J.t = -1; J.running = false; J.captioned = false; jumpIdleCaption();
    dirty = true; kick();
  }));

  // soft synthesised sounds (only if sound is on)
  let audio = null;
  function wakeAudio() { // only ever called from a tap, so the browser allows it
    if (!ctx.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { audio = null; }
  }
  function tone(f0, f1, dur, gain) {
    if (!ctx.sound || !audio || audio.state !== 'running') return;
    try {
      const o = audio.createOscillator(), gn = audio.createGain(), t = audio.currentTime;
      o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(gain, t + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn).connect(audio.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* no audio */ }
  }

  function startJump() {
    J.t = 0; J.running = true; J.captioned = false; J.finished = false; J.landedSnd = [false, false, false];
    capJMain.textContent = 'Jump!'; capJSub.textContent = ' ';
    tone(260, 620, 0.25, 0.05);
    lastT = performance.now();
    dirty = true; kick();
  }
  on(jumpBtn, 'click', () => { wakeAudio(); startJump(); });

  function jumpLayout() {
    const { W, H } = sz.J;
    const pad = W < 600 ? 8 : 16, gap = W < 600 ? 6 : 12;
    const sw = (W - pad * 2 - gap * 2) / 3, sh = H - 4;
    const narrow = sw < 270, tiny = sw < 170;
    const head = narrow ? 104 : 80;
    const groundH = clamp(sh * 0.13, 34, 54);
    return WORLDS.map((w, i) => {
      const x = pad + i * (sw + gap), y = 2;
      return { w, i, x, y, sw, sh, narrow, tiny, topY: y + head, groundY: y + sh - groundH, groundH };
    });
  }

  const starPts = (() => { const R = rng(9); return Array.from({ length: 70 }, () => [R(), R(), R()]); })();
  function drawScene(c, s, st, ppm, now) {
    const { w, x, y, sw, sh, topY, groundY } = s;
    c.save();
    c.beginPath(); rrPath(c, x, y, sw, sh, 18); c.clip();
    const sky = c.createLinearGradient(0, y, 0, groundY);
    sky.addColorStop(0, w.sky[0]); sky.addColorStop(1, w.sky[1]);
    c.fillStyle = sky; c.fillRect(x, y, sw, sh);
    if (w.id === 'moon') {
      for (const [a, b, z] of starPts) { c.fillStyle = `rgba(235,240,255,${0.2 + z * 0.5})`; c.fillRect(x + a * sw, y + b * (groundY - y), z > 0.8 ? 1.6 : 1, z > 0.8 ? 1.6 : 1); }
      const er = Math.max(9, Math.min(18, sw * 0.05)), ex = x + sw - er - 18, ey = topY + er + 6;
      const eg = c.createRadialGradient(ex - er * 0.3, ey - er * 0.3, 1, ex, ey, er);
      eg.addColorStop(0, '#8fc7ff'); eg.addColorStop(1, '#1d4f91');
      c.fillStyle = eg; c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fill();
    } else if (w.id === 'earth') {
      c.fillStyle = 'rgba(20,40,32,0.8)';
      c.beginPath(); c.moveTo(x, groundY);
      for (let k = 0; k <= 8; k++) c.lineTo(x + (k / 8) * sw, groundY - 14 - 12 * Math.sin(k * 1.7 + 1));
      c.lineTo(x + sw, groundY); c.closePath(); c.fill();
    } else {
      c.fillStyle = 'rgba(90,40,24,0.7)';
      c.beginPath(); c.moveTo(x, groundY);
      for (let k = 0; k <= 6; k++) c.lineTo(x + (k / 6) * sw, groundY - 10 - 18 * Math.abs(Math.sin(k * 1.3 + 0.4)));
      c.lineTo(x + sw, groundY); c.closePath(); c.fill();
    }
    const gr = c.createLinearGradient(0, groundY, 0, y + sh);
    gr.addColorStop(0, w.ground[0]); gr.addColorStop(1, w.ground[1]);
    c.fillStyle = gr; c.fillRect(x, groundY, sw, y + sh - groundY);
    c.fillStyle = w.edge; c.fillRect(x, groundY, sw, 2);

    // ruler
    const rx = x + 12;
    const step = [0.25, 0.5, 1, 2].find(v => v * ppm >= 40) || 2;
    c.strokeStyle = 'rgba(243,239,230,0.35)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(rx + 0.5, groundY); c.lineTo(rx + 0.5, topY - 6); c.stroke();
    c.font = `500 18px ${FONT_B}`; c.textAlign = 'left'; c.textBaseline = 'middle';
    for (let k = 1; k < 60; k++) {
      const m = k * step, yy = groundY - m * ppm;
      if (yy < topY) break;
      c.strokeStyle = 'rgba(242,181,68,0.75)';
      c.beginPath(); c.moveTo(rx - 3, Math.round(yy) + 0.5); c.lineTo(rx + 8, Math.round(yy) + 0.5); c.stroke();
      if (!s.tiny) { c.fillStyle = 'rgba(243,239,230,0.6)'; c.fillText(m < 0.995 ? `${Math.round(m * 100)} cm` : `${m} m`, rx + 12, yy); }
    }

    // comparison thing (fades in once this jumper has reached the top)
    const ax = s.tiny ? x + sw * 0.42 : x + Math.max(78 + 0.24 * ppm, sw * 0.3);
    if (st.showThing > 0) {
      const th = pickThing(st.h), T = THINGS[th.key];
      const tx = Math.max(x + sw * 0.6, ax + 0.3 * ppm + 12);
      drawThing(c, th.key, tx, groundY, ppm, st.showThing, th.key === 'cat');
      c.globalAlpha = st.showThing;
      c.font = `600 18px ${FONT_D}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = INK;
      c.fillText(th.label, Math.max(x + 8, Math.min(tx, x + sw - c.measureText(th.label).width - 10)), groundY + s.groundH / 2 + 1);
      c.globalAlpha = 1;
    }
    // trail
    if (st.trail.length > 1) {
      c.fillStyle = 'rgba(255,210,122,0.55)';
      for (const [px, py] of st.trail) { c.beginPath(); c.arc(ax + px * ppm, groundY - (py + 0.6) * ppm, 2, 0, TAU); c.fill(); }
    }
    // peak marker
    if (st.peakShown) {
      const py = groundY - st.h * ppm;
      c.setLineDash([7, 6]); c.strokeStyle = 'rgba(242,181,68,0.9)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(rx + 8, py); c.lineTo(x + sw - 8, py); c.stroke(); c.setLineDash([]);
      const txt = fmtH(st.h);
      c.font = `700 20px ${FONT_D}`; const tw = c.measureText(txt).width;
      const bx = x + sw - tw - 26, by = py - 30;
      c.fillStyle = 'rgba(5,7,13,0.75)'; c.beginPath(); rrPath(c, bx, by, tw + 16, 26, 13); c.fill();
      c.fillStyle = GOLD2; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(txt, bx + 8, by + 13.5);
    }
    // dust
    for (const d of st.dust) {
      c.fillStyle = `rgba(${w.dust},${d.a})`;
      c.beginPath(); c.arc(ax + d.x * ppm, groundY - d.y * ppm, Math.max(1.5, 0.03 * ppm), 0, TAU); c.fill();
    }
    // astronaut (feet at height st.y)
    drawAstronaut(c, ax + st.x * ppm, groundY - st.y * ppm, ppm, { squash: st.squash, up: st.up });

    // header: name, pull, live numbers
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.font = `700 24px ${FONT_D}`; c.fillStyle = INK; c.fillText(w.name, x + 14, y + 32);
    c.font = `500 18px ${FONT_B}`; c.fillStyle = 'rgba(243,239,230,0.6)';
    if (!s.narrow) c.fillText(w.pull, x + 14, y + 56);
    if (st.active) {
      const hTxt = fmtH(st.peak), aTxt = s.tiny ? `${st.air.toFixed(1)} s` : `${st.air.toFixed(1)} s in the air`;
      if (s.narrow) {
        c.font = `700 22px ${FONT_D}`; c.fillStyle = GOLD2; c.fillText(s.tiny ? hTxt : `${hTxt} high`, x + 14, y + 60);
        c.font = `500 18px ${FONT_B}`; c.fillStyle = INK2; c.fillText(aTxt, x + 14, y + 86);
      } else {
        c.textAlign = 'right';
        c.font = `700 24px ${FONT_D}`; c.fillStyle = GOLD2; c.fillText(`${hTxt} high`, x + sw - 14, y + 32);
        c.font = `500 18px ${FONT_B}`; c.fillStyle = INK2; c.fillText(aTxt, x + sw - 14, y + 56);
      }
    } else if (s.narrow) {
      c.fillText(w.pull, x + 14, y + 58);
    }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1;
    c.beginPath(); rrPath(c, x + 0.5, y + 0.5, sw - 1, sh - 1, 18); c.stroke();
  }

  function worldState(i, hs, t) {
    const { v0, h, T } = hs[i], g = WORLDS[i].g;
    const st = { y: 0, x: 0, squash: 0, up: 0, peak: 0, air: 0, h, T, trail: [], dust: [], showThing: 0, peakShown: false, active: t >= 0 };
    if (t < 0) return st;
    const ta = t - CROUCH;
    if (ta < 0) { st.squash = Math.sin(clamp(t / CROUCH, 0, 1) * Math.PI / 2) * 0.85; return st; }
    const tf = Math.min(ta, T);
    st.y = Math.max(0, v0 * tf - 0.5 * g * tf * tf);
    st.x = VX * tf;
    st.air = tf;
    st.peak = ta >= T / 2 ? h : st.y;
    st.peakShown = ta >= T / 2;
    st.showThing = clamp((ta - T / 2) / 0.5, 0, 1);
    for (let k = 0.04; k < tf; k += 0.06) st.trail.push([VX * k, Math.max(0, v0 * k - 0.5 * g * k * k)]);
    if (ta <= T) {
      st.squash = Math.max(0, 0.85 - ta * 9);
      st.up = Math.pow(Math.sin(Math.PI * clamp(ta / T, 0, 1)), 0.6);
    } else {
      const lt = ta - T;
      st.squash = lt < 0.3 ? Math.sin((Math.PI * lt) / 0.3) * 0.7 : 0;
      const R = rng(i * 17 + 5);
      for (let k = 0; k < 16; k++) {
        const vx = (R() - 0.5) * 1.6, vy = 0.25 + R() * 0.9, life = (2 * vy) / g;
        if (lt < life) st.dust.push({ x: st.x + vx * lt * 0.6, y: Math.max(0, vy * lt - 0.5 * g * lt * lt), a: 0.75 * (1 - lt / life) });
      }
    }
    return st;
  }

  function renderJump(dt) {
    const { W, H } = sz.J, c = gJ;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const hs = heights();
    if (J.running && J.freeze === null) J.t += dt;
    const t = J.freeze !== null && J.running ? CROUCH + J.freeze : J.t;
    const lay = jumpLayout();
    const s0 = lay[0];
    const maxM = Math.max(2.3, hs[2].h + 1.45);
    const target = Math.min((s0.groundY - s0.topY) / maxM, Math.max(40, (s0.sw - 90) / 1.5));
    J.ppm = J.ppm ? lerp(J.ppm, target, reduced ? 1 : clamp(dt * 6, 0, 1)) : target;
    const easing = Math.abs(J.ppm - target) > 0.2;
    const states = lay.map(s => worldState(s.i, hs, J.running || J.t >= 0 ? t : -1));
    lay.forEach((s, i) => drawScene(c, s, states[i], J.ppm, t));

    if (J.running) {
      const ta = t - CROUCH;
      // landing thuds
      hs.forEach((hw, i) => { if (ta > hw.T && !J.landedSnd[i]) { J.landedSnd[i] = true; if (J.freeze === null) tone(150, 60, 0.18, 0.07); } });
      if (!J.captioned && ta >= hs[2].T / 2) {
        J.captioned = true;
        const main = `On the Moon you'd jump ${phrase(hs[2].h)}!`;
        capJMain.textContent = main;
        capJSub.innerHTML = `On Mars you'd jump <b>${fmtH(hs[1].h)}</b>: ${esc(phrase(hs[1].h))}. On the Moon: <b>${fmtH(hs[2].h)}</b>.`;
        sayLater(main, 150);
      }
      if (!J.finished && ta >= hs[2].T + 0.6) {
        J.finished = true;
        J.jumps++;
        call('log', `Jumped ${J.cm} cm on Earth: ${fmtH(hs[1].h)} on Mars and ${fmtH(hs[2].h)} on the Moon!`);
        if (!J.completed) { J.completed = true; call('complete'); }
      }
      if (ta >= hs[2].T + 1.8 && J.freeze === null) J.running = false;
    }
    return (J.running && J.freeze === null) || easing;
  }

  // =================== loop, resize, lifecycle ===================
  function frame(t) {
    raf = 0;
    if (destroyed || document.hidden) return;
    const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
    lastT = t;
    dirty = false;
    let more = false;
    try { more = tab === 'lineup' ? renderLineup(dt) : renderJump(dt); } catch (e) { console.warn('[planets] render', e); }
    if (more || dirty) kick();
  }
  function kick() {
    if (!raf && !destroyed && !document.hidden) { if (!dirty && !J.running) lastT = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function fit(cv, box, key) {
    const r = box.getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    if (W === sz[key].W && H === sz[key].H && cv.width === Math.round(W * dpr)) return;
    sz[key].W = W; sz[key].H = H;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function resize() {
    if (destroyed) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (tab === 'lineup') fit(cvL, panelL, 'L'); else fit(cvJ, scenesBox, 'J');
    dirty = true;
    // repaint straight away so a resized (cleared) canvas never shows a blank frame
    if (!document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } frame(performance.now()); } else kick();
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(el); ro.observe(scenesBox);
  const onVis = () => { if (!document.hidden) { lastT = performance.now(); dirty = true; kick(); } };
  document.addEventListener('visibilitychange', onVis);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destroyed) { dirty = true; kick(); } }).catch(() => {});

  setTab(tab);
  if (qs.get('debugCard')) later(() => openCard(qs.get('debugCard'), false), 50);
  if (qs.get('debugJump') === '1') later(startJump, 300);

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
      for (const [t, type, fn, opts] of listeners) { try { t.removeEventListener(type, fn, opts); } catch (e) { /* ignore */ } }
      if (audio) { try { audio.close(); } catch (e) { /* ignore */ } audio = null; }
      root.remove();
    },
  };
}
