// blaster: the Array Blaster. A dark scene with a glowing perspective grid. Tap the blast zone to fire:
// a beam shoots from where you tapped and a new row of `size` dots drops in under the previous rows.
// Props: size (1-10, default 1), rows (start rows, default 0), maxRows (default 10), maxSize (default 10),
//        lockSize (hide the arrows), highlightRows (yellow boxes round each row), groupsView (each blast is a circled group),
//        caption (bubble above the array, e.g. "3 × 5 = 15"), flipButton (or flip: show a Flip button), flipped,
//        bar (false hides the top bar, for small readonly pictures), icon (an art name such as 'fuel': draw that
//        picture instead of a blue dot), mirror ('alternate': every second picture in a row faces the other way, so a
//        row of 2 boots is a left and a right boot), rowLabels (true: the running total at the end of each row, 5, 10, 15;
//        or an array of strings, e.g. ["5", "10", "?"] for a hint; in groupsView the label sits under each ring),
//        interactive (default true), readonly.
// update({ flipped }) on its own (no size or rows) turns the array a quarter turn with the flip animation, even when
// readonly, so a look step's "Turn the crate" button can act it out. With size or rows it only sets the flag.
// State: { size, rows, total, flipped }
// Debug: dev/harness.html?widget=blaster&props={"size":5,"rows":3,"highlightRows":true,"caption":"3 × 5 = 15"}
//        dev/harness.html?widget=blaster&props={"size":4,"rows":3,"groupsView":true}
//        dev/harness.html?widget=blaster&props={"size":5,"rows":3,"flipButton":true}
//        dev/harness.html?widget=blaster&props={"size":5,"rows":3,"icon":"fuel","bar":false,"readonly":true}
//        dev/harness.html?widget=blaster&props={"size":5,"rows":3,"highlightRows":true,"rowLabels":["5","10","?"]}
//        dev/harness.html?widget=blaster&props={"size":2,"rows":4,"icon":"boot","mirror":"alternate","rowLabels":true}
import { injectCSS, onTap, clamp, reducedMotion } from '../core/dom.js';
import { artInner } from '../core/art.js';
import { FONT, PAL, COL } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Array Blaster',
  surface: 'dark', // the console turns dark around the Tron scene (style v2 exception, as in Synthesis)
  playground: { size: 3, rows: 0, maxRows: 10, flipButton: true, interactive: true },
  state: ['size', 'rows', 'total', 'flipped'],
};

const YEL = '#f7d56b';   // preview dots and caption factors (soft yellow, as in Synthesis)
const BOX = '#f5d36b';   // yellow row boxes and group rings
const DOT = '#5aa2ff';   // blue array dots
const DOT_EDGE = '#2f6fe0';

// Ray gun drawn in a 48 x 48 box, pointing right. Shared by the bar icon (SVG) and the canvas (Path2D).
const GUN = [
  ['M14 18l5-8h8l-3 8z', '#5fd4ff'],
  ['M12 30h9l-3 12h-9z', '#8d99b3'],
  ['M8 17h23a6 6 0 0 1 6 6v2a6 6 0 0 1-6 6H8a4 4 0 0 1-4-4v-6a4 4 0 0 1 4-4z', '#dfe6f2'],
  ['M22 17h3v14h-3zM27 17h3v14h-3z', '#4f9dff'],
  ['M36 20h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7z', '#9cc4ff'],
  ['M8 21h10v2H8z', '#ffffff'],
];
const gunSVG = (sz = 34) => `<svg viewBox="0 0 48 48" width="${sz}" height="${sz}" aria-hidden="true">${GUN.map(([d, f]) => `<path d="${d}" fill="${f}"/>`).join('')}<circle cx="45" cy="24" r="2.6" fill="#5fd4ff"/></svg>`;

const CSS = `
.w-blaster { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; background: #04101c; user-select: none; -webkit-user-select: none; font-family: ${FONT.display}; }
.w-blaster canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; }
.w-blaster.ro canvas { cursor: default; }
.w-blaster-bar { position: absolute; left: 0; right: 0; top: 0; height: 80px; display: flex; align-items: center; gap: 12px; padding: 0 12px 4px;
  background: #121a33; border-bottom: 2px solid rgba(124, 156, 255, .16); z-index: 1; }
.w-blaster-bar.short { height: 70px; gap: 8px; }
.w-blaster-gun { display: flex; align-items: center; gap: 6px; height: 56px; padding: 0 14px 0 8px; border-radius: 28px; background: rgba(255, 255, 255, .06);
  color: ${COL.darkInk}; font-weight: 800; font-size: 34px; line-height: 1; font-variant-numeric: tabular-nums; }
.w-blaster-gun b { min-width: 1.25ch; text-align: center; font-weight: 800; }
.w-blaster-pre { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 6px; }
.w-blaster-pre i { flex: none; border-radius: 50%; background: ${YEL}; box-shadow: inset 0 -3px 0 rgba(183, 121, 31, .35); transition: transform .2s; }
.w-blaster-pre i.pop { animation: wbl-pop .25s ease; }
@keyframes wbl-pop { 0% { transform: scale(.3); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }
.w-blaster button { appearance: none; border: 0; margin: 0; padding: 0; cursor: pointer; font-family: ${FONT.display};
  display: grid; place-items: center; flex: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  transition: transform .08s ease, box-shadow .08s ease, opacity .15s; }
/* Round tactile controls: white face, ink icon, a solid bottom edge that sinks when pressed (style v2 on a dark bar). */
.w-blaster-arrow, .w-blaster-reset { width: 60px; height: 60px; border-radius: 50%; background: #ffffff; color: ${COL.ink};
  box-shadow: 0 5px 0 #8f99b3; margin-bottom: 5px; }
.w-blaster-bar.short .w-blaster-arrow, .w-blaster-bar.short .w-blaster-reset { width: 56px; height: 56px; }
.w-blaster-arrow svg { width: 28px; height: 28px; }
.w-blaster-reset svg { width: 30px; height: 30px; }
.w-blaster-flip { height: 58px; padding: 0 22px 0 18px !important; border-radius: 29px; gap: 8px; grid-auto-flow: column; font-size: 23px; font-weight: 700;
  background: ${PAL.blue}; color: #fff; box-shadow: 0 5px 0 ${PAL.blueDark}; margin-bottom: 5px; }
.w-blaster-bar.short .w-blaster-flip { height: 56px; }
.w-blaster-flip svg { width: 26px; height: 26px; }
.w-blaster-arrow:active:not([disabled]), .w-blaster-reset:active, .w-blaster-flip:active:not([disabled]) { transform: translateY(4px); box-shadow: 0 1px 0 #8f99b3; }
.w-blaster-flip:active:not([disabled]) { box-shadow: 0 1px 0 ${PAL.blueDark}; }
.w-blaster-arrow[disabled], .w-blaster-flip[disabled] { opacity: .28; cursor: default; }
`;

const ARROW_L = '<svg viewBox="0 0 24 24"><path d="M15.5 5L7 12l8.5 7z" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>';
const ARROW_R = '<svg viewBox="0 0 24 24"><path d="M8.5 5L17 12l-8.5 7z" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>';
const RESET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 3.5v4.6h4.6"/></svg>';
const FLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-13.7 5.7"/><path d="M4 12A8 8 0 0 1 17.7 6.3"/><path d="M18 2.5v4h-4M6 21.5v-4h4"/></svg>';

const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-blaster', CSS);
  let p = {};
  let size = 1, rows = 0, flipped = false;
  let dots = [];       // { r, c, x, y, born, ox, oy, arrived }
  let ghosts = [];     // { x, y, rad, born }
  let beams = [];      // { x0, y0, x1, y1, born }
  let guns = [];       // { x, y, ang, born }
  let flip = null;     // { start, dur, R, C, from: {cx, cy, s}, to: {cx, cy, s} }
  let hlFlash = 0;
  let wob = 0;
  let W = 0, H = 0, dpr = 1;
  let raf = 0, last = 0, alive = true;
  let L = null;        // current layout targets
  let cur = null;      // smoothed { s }
  let bg = null, sprite = null, spriteR = 0;
  let iconName = '', iconImg = null; // optional art drawn instead of the blue dot
  const unbinds = [];

  const wrap = document.createElement('div');
  wrap.className = 'w-blaster';
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  wrap.appendChild(cv);
  const bar = document.createElement('div');
  bar.className = 'w-blaster-bar';
  bar.innerHTML = `<div class="w-blaster-gun">${gunSVG(46)}<b></b></div>
    <button class="w-blaster-arrow l" aria-label="Smaller blast">${ARROW_L}</button>
    <div class="w-blaster-pre"></div>
    <button class="w-blaster-arrow r" aria-label="Bigger blast">${ARROW_R}</button>
    <button class="w-blaster-flip" aria-label="Flip">${FLIP}<span>Flip</span></button>
    <button class="w-blaster-reset" aria-label="Reset">${RESET}</button>`;
  wrap.appendChild(bar);
  el.appendChild(wrap);
  const $ = s => bar.querySelector(s);
  const bL = $('.l'), bR = $('.r'), bFlip = $('.w-blaster-flip'), bReset = $('.w-blaster-reset'), pre = $('.w-blaster-pre'), num = $('.w-blaster-gun b');

  const ro = () => !!(p.readonly || ctx.readonly || p.interactive === false);
  const maxSize = () => clamp(Math.round(p.maxSize ?? 10), 1, 10);
  const maxRows = () => clamp(Math.round(p.maxRows ?? 10), 1, 12);
  const showBar = () => p.bar !== false;
  const barH = () => (showBar() ? (H < 380 ? 66 : 76) : 0);
  const motion = () => !reducedMotion();
  const state = () => ({ size, rows, total: size * rows, flipped });
  const hasLabels = () => p.rowLabels === true || (Array.isArray(p.rowLabels) && p.rowLabels.length > 0);
  const labelFor = r => (p.rowLabels === true ? String((r + 1) * size) : Array.isArray(p.rowLabels) && p.rowLabels[r] != null ? String(p.rowLabels[r]) : '');
  const changed = () => { ctx.onChange && ctx.onChange(state()); };

  // ---------- layout ----------
  function computeLayout() {
    const top = barH() + 10;
    const capH = p.caption ? 70 : 0;
    const availW = Math.max(60, W - 36);
    const availH = Math.max(60, H - top - capH - 16);
    const maxS = clamp(Math.min(W, H) * 0.16, 30, 78);
    const lay = { top, capH, cap: { x: W / 2, y: top + capH / 2 } };
    const labelled = hasLabels();
    if (p.groupsView) {
      const gc = size <= 3 ? size : size === 4 ? 2 : size <= 6 ? 3 : size <= 8 ? 4 : 5;
      const gr = Math.ceil(size / gc);
      const slots = Math.max(rows, ro() ? rows : Math.min(Math.max(rows + 1, 3), maxRows()), 1);
      const bw = gc + 0.9, bh = gr + 0.9 + (labelled ? 0.95 : 0), gap = 0.55;
      let best = null;
      for (let k = 1; k <= slots; k++) {
        const ln = Math.ceil(slots / k);
        const sk = Math.min(availW / (k * (bw + gap)), availH / (ln * (bh + gap)), maxS * 0.92);
        if (!best || sk > best.s + 0.5) best = { s: sk, gpl: k };
      }
      const s = best.s, gpl = best.gpl;
      const used = Math.max(1, Math.min(gpl, rows));
      const blockW = used * (bw + gap) * s - gap * s;
      const gx0 = W / 2 - blockW / 2;
      const usedLines = Math.max(1, Math.ceil(rows / gpl));
      const gy0 = ro() ? top + capH + Math.max(8, (availH - usedLines * (bh + gap) * s) / 2) : top + capH + 8;
      lay.s = s; lay.groups = [];
      const cols = size <= 0 ? 1 : gc;
      for (let k = 0; k < Math.max(rows, 0); k++) {
        const li = Math.floor(k / gpl), ci = k % gpl;
        const bx = gx0 + ci * (bw + gap) * s, by = gy0 + li * (bh + gap) * s;
        lay.groups.push({ x: bx, y: by, w: bw * s, h: (bh - (labelled ? 0.95 : 0)) * s, cols, gr });
      }
      lay.slot = (r, c) => {
        const gk = lay.groups[r] || { x: W / 2, y: gy0, w: bw * s, h: bh * s };
        const inRow = Math.min(gc, size - Math.floor(c / gc) * gc);
        const lr = Math.floor(c / gc), lc = c % gc;
        const rowsHere = gr;
        const x = gk.x + gk.w / 2 + (lc - (inRow - 1) / 2) * s;
        const y = gk.y + gk.h / 2 + (lr - (rowsHere - 1) / 2) * s;
        return { x, y };
      };
      lay.nextRowCentre = () => {
        const k = rows; const li = Math.floor(k / gpl), ci = k % gpl;
        return { x: gx0 + ci * (bw + gap) * s + bw * s / 2, y: gy0 + li * (bh + gap) * s + bh * s / 2 };
      };
      return lay;
    }
    const extra = labelled ? 1.7 : 0;  // room for the running totals at the end of each row
    const fitCols = Math.max(size, 3) + extra;
    const fitRows = Math.max(rows, ro() ? rows : Math.min(Math.max(rows + 1, 3), maxRows()), 1);
    const s = Math.min(availW / (fitCols + 0.4), availH / (fitRows + 0.25), maxS);
    lay.s = s;
    const x0 = W / 2 - ((size - 1) * s) / 2 - (extra * s) / 2;
    const y0 = ro() ? top + capH + Math.max(0, (availH - rows * s) / 2) + s / 2 : top + capH + s * 0.6;
    lay.x0 = x0; lay.y0 = y0;
    lay.slot = (r, c) => ({ x: x0 + c * s, y: y0 + r * s });
    lay.nextRowCentre = () => ({ x: W / 2, y: y0 + rows * s });
    return lay;
  }

  // ---------- cached art ----------
  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = Math.max(1, Math.round(W * dpr)); bg.height = Math.max(1, Math.round(H * dpr));
    const b = bg.getContext('2d');
    b.scale(dpr, dpr);
    const top = barH();
    const zh = H - top;
    // Deep space gradient with a blue glow in the middle.
    const lg = b.createLinearGradient(0, top, 0, H);
    lg.addColorStop(0, '#04131f'); lg.addColorStop(0.45, '#08223f'); lg.addColorStop(1, '#03111b');
    b.fillStyle = lg; b.fillRect(0, 0, W, H);
    const rg = b.createRadialGradient(W / 2, top + zh * 0.5, 10, W / 2, top + zh * 0.5, Math.max(W, zh) * 0.6);
    rg.addColorStop(0, 'rgba(40, 110, 210, .28)'); rg.addColorStop(1, 'rgba(40, 110, 210, 0)');
    b.fillStyle = rg; b.fillRect(0, 0, W, H);
    // Faint stars.
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 46; i++) {
      const x = rnd() * W, y = top + zh * (0.22 + rnd() * 0.56), r = 0.5 + rnd() * 1.1;
      b.fillStyle = `rgba(200, 225, 255, ${0.12 + rnd() * 0.3})`;
      b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
    }
    // Ceiling and floor grids.
    const band = Math.max(40, zh * 0.2);
    drawGrid(b, top, top + band, -1);
    drawGrid(b, H, H - band, 1);
  }

  // edge = the screen edge (nearest the viewer), hz = the horizon line of this grid band. dir: -1 ceiling, 1 floor.
  function drawGrid(b, edge, hz, dir) {
    const band = Math.abs(hz - edge);
    const cx = W / 2;
    const vy = hz - dir * band * 1.9; // vanishing point beyond the horizon, toward the middle of the scene
    const grad = b.createLinearGradient(0, edge, 0, hz);
    grad.addColorStop(0, 'rgba(90, 175, 255, .85)'); grad.addColorStop(1, 'rgba(90, 175, 255, .06)');
    const glow = b.createLinearGradient(0, edge, 0, hz);
    glow.addColorStop(0, 'rgba(60, 150, 255, .28)'); glow.addColorStop(1, 'rgba(60, 150, 255, 0)');
    const lines = [];
    for (let k = 0; k < 14; k++) {
      const off = band / (1 + k * 0.55); // distance from the horizon
      const y = hz + dir * off;
      lines.push([0, y, W, y]);
    }
    const n = Math.ceil(W / 70) + 6;
    const spacing = Math.max(70, W / 9);
    for (let i = -n; i <= n; i++) {
      const xe = cx + i * spacing;
      // Point on the line from (xe, edge) toward the vanishing point (cx, vy), cut at the horizon.
      const t = (hz - edge) / (vy - edge);
      const xh = xe + (cx - xe) * t;
      lines.push([xe, edge, xh, hz]);
    }
    for (const [w, style] of [[5, glow], [1.3, grad]]) {
      b.lineWidth = w; b.strokeStyle = style; b.beginPath();
      for (const [x1, y1, x2, y2] of lines) { b.moveTo(x1, y1); b.lineTo(x2, y2); }
      b.stroke();
    }
    // Horizon glow.
    const hg = b.createLinearGradient(0, 0, W, 0);
    hg.addColorStop(0, 'rgba(110, 190, 255, 0)'); hg.addColorStop(0.5, 'rgba(110, 190, 255, .45)'); hg.addColorStop(1, 'rgba(110, 190, 255, 0)');
    b.strokeStyle = hg; b.lineWidth = 1.5; b.beginPath(); b.moveTo(0, hz); b.lineTo(W, hz); b.stroke();
  }

  function buildSprite() {
    spriteR = 40;
    const R = spriteR * dpr;
    const sz = Math.ceil(R * 3.4);
    sprite = document.createElement('canvas');
    sprite.width = sz; sprite.height = sz;
    const s = sprite.getContext('2d');
    const c = sz / 2;
    if (iconImg) {
      // A picture (fuel can, crystal...) on a faint halo so it still reads on the dark scene.
      const halo = s.createRadialGradient(c, c, R * 0.6, c, c, R * 1.6);
      halo.addColorStop(0, 'rgba(150, 200, 255, .22)'); halo.addColorStop(1, 'rgba(150, 200, 255, 0)');
      s.fillStyle = halo; s.beginPath(); s.arc(c, c, R * 1.6, 0, Math.PI * 2); s.fill();
      const d = R * 2.25;
      s.drawImage(iconImg, c - d / 2, c - d / 2, d, d);
      return;
    }
    // A soft halo so the dots read on the dark scene, then a flat blue dot with a darker rim and a small shine.
    const glow = s.createRadialGradient(c, c, R * 0.85, c, c, R * 1.55);
    glow.addColorStop(0, 'rgba(90, 162, 255, .32)'); glow.addColorStop(1, 'rgba(90, 162, 255, 0)');
    s.fillStyle = glow; s.beginPath(); s.arc(c, c, R * 1.55, 0, Math.PI * 2); s.fill();
    s.fillStyle = DOT; s.beginPath(); s.arc(c, c, R, 0, Math.PI * 2); s.fill();
    s.strokeStyle = DOT_EDGE; s.lineWidth = R * 0.1; s.beginPath(); s.arc(c, c, R * 0.95, 0, Math.PI * 2); s.stroke();
    s.fillStyle = 'rgba(255, 255, 255, .3)'; s.beginPath(); s.ellipse(c - R * 0.32, c - R * 0.36, R * 0.3, R * 0.2, -0.6, 0, Math.PI * 2); s.fill();
  }

  // The optional icon is an art SVG turned into an image; the sprite is rebuilt once it has loaded.
  function loadIcon() {
    const name = p.icon && p.icon !== 'dot' ? String(p.icon) : '';
    if (name === iconName) return;
    iconName = name; iconImg = null;
    if (sprite) buildSprite();
    if (!name) return;
    const img = new Image();
    img.onload = () => {
      if (!alive || iconName !== name) return;
      iconImg = img;
      buildSprite();
      if (W) { render(performance.now()); kick(); }
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="160" height="160">${artInner(name)}</svg>`);
  }

  // ---------- drawing ----------
  function drawDot(x, y, rad, alpha = 1, mirror = false) {
    if (rad <= 0.3) return;
    const d = (rad / spriteR) * (sprite.width / dpr);
    if (alpha < 1) g.globalAlpha = alpha;
    if (mirror) { g.save(); g.translate(x, y); g.scale(-1, 1); g.drawImage(sprite, -d / 2, -d / 2, d, d); g.restore(); }
    else g.drawImage(sprite, x - d / 2, y - d / 2, d, d);
    if (alpha < 1) g.globalAlpha = 1;
  }

  // Running totals (or hint labels such as "?") at the end of each row, or under each ring in groupsView.
  function drawRowLabels(now, s) {
    const fs = clamp(Math.round(s * 0.6), 22, 40);
    g.font = `800 ${fs}px ${FONT.display}`;
    g.textBaseline = 'middle';
    for (let r = 0; r < rows; r++) {
      const txt = labelFor(r);
      if (!txt) continue;
      const a = clamp((now - rowBorn(r) - 200) / 250, 0, 1);
      if (a <= 0) continue;
      g.globalAlpha = a;
      g.fillStyle = txt === '?' ? '#ffffff' : YEL;
      if (p.groupsView && L.groups && L.groups[r]) {
        const gb = L.groups[r];
        g.textAlign = 'center';
        g.fillText(txt, gb.x + gb.w / 2, gb.y + gb.h + s * 0.5);
      } else {
        const q = L.slot(r, size - 1);
        g.textAlign = 'left';
        g.fillText(txt, q.x + s * 0.72, q.y + 1);
      }
      g.globalAlpha = 1;
    }
    g.textAlign = 'left';
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  const gunPaths = GUN.map(([d, f]) => [new Path2D(d), f]);
  function drawGun(x, y, ang, scale, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y); g.rotate(ang); g.scale(scale, scale); g.translate(-24, -24);
    g.shadowColor = 'rgba(95, 212, 255, .8)'; g.shadowBlur = 14;
    for (const [path, fill] of gunPaths) { g.fillStyle = fill; g.fill(path); }
    g.shadowBlur = 0;
    g.restore();
  }

  function drawCaption(text) {
    const fs = clamp(Math.round(Math.min(W, H) * 0.075), 24, 40);
    g.font = `700 ${fs}px ${FONT.display}`;
    const toks = String(text).split(/(\s+)/).filter(t => t !== '');
    const eqAt = toks.findIndex(t => t.trim() === '=');
    const widths = toks.map(t => g.measureText(t).width);
    const tw = widths.reduce((a, b) => a + b, 0);
    const padX = fs * 0.7, bh = fs * 1.55;
    const bw = tw + padX * 2;
    const { x, y } = L.cap;
    g.save();
    g.shadowColor = 'rgba(0, 0, 0, .45)'; g.shadowBlur = 16; g.shadowOffsetY = 4;
    roundRect(x - bw / 2, y - bh / 2, bw, bh, 14);
    g.fillStyle = '#121a33'; g.fill();
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.lineWidth = 2.5; g.strokeStyle = 'rgba(214, 224, 250, .7)'; g.stroke();
    g.restore();
    g.textBaseline = 'middle';
    let cx = x - tw / 2;
    toks.forEach((t, i) => {
      const isNum = /\d/.test(t);
      g.fillStyle = !isNum ? '#f3efe6' : (eqAt >= 0 && i > eqAt ? '#8cc2ff' : YEL);
      g.fillText(t, cx, y + 1);
      cx += widths[i];
    });
  }

  function render(now) {
    if (!W || !H) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.drawImage(bg, 0, 0, W, H);
    const s = cur.s;
    const rad = s * 0.37;
    const wobX = wob && now - wob < 300 ? Math.sin((now - wob) / 22) * 5 * (1 - (now - wob) / 300) : 0;
    g.save();
    g.translate(wobX, 0);
    const flipping = !!flip;
    // Group rings or row highlights (hidden while the array turns).
    if (!flipping && rows > 0) {
      if (p.groupsView && L.groups) {
        L.groups.forEach((gb, k) => {
          const born = rowBorn(k);
          const a = clamp((now - born) / 250, 0, 1);
          if (a <= 0) return;
          g.globalAlpha = a;
          roundRect(gb.x, gb.y, gb.w, gb.h, Math.min(gb.w, gb.h) * 0.45);
          g.fillStyle = 'rgba(245, 211, 107, .07)'; g.fill();
          g.lineWidth = 3; g.strokeStyle = BOX; g.stroke();
          g.globalAlpha = 1;
        });
      }
      const flash = hlFlash && now - hlFlash < 1800;
      if ((p.highlightRows || flash) && !p.groupsView) {
        const pulse = flash ? 0.6 + 0.4 * Math.sin((now - hlFlash) / 120) : 1;
        for (let r = 0; r < rows; r++) {
          const a = clamp((now - rowBorn(r) - 200) / 250, 0, 1) * pulse;
          if (a <= 0) continue;
          const a0 = L.slot(r, 0), a1 = L.slot(r, size - 1);
          g.globalAlpha = a;
          roundRect(a0.x - s * 0.47, a0.y - s * 0.45, a1.x - a0.x + s * 0.94, s * 0.9, s * 0.18);
          g.fillStyle = 'rgba(245, 211, 107, .07)'; g.fill();
          g.lineWidth = 3; g.strokeStyle = BOX; g.stroke();
          g.globalAlpha = 1;
        }
      }
    }
    // Ghosts (dots leaving).
    for (const q of ghosts) {
      const t = clamp((now - q.born) / 260, 0, 1);
      drawDot(q.x, q.y, q.rad * (1 - t * 0.6), 1 - t);
    }
    // Dots.
    for (const d of dots) {
      if (now < d.born) continue;
      const fl = clamp((now - d.born) / 220, 0, 1);
      const sc = d.pop ? 0.3 + 0.7 * ease(fl * 1.4) : 0.35 + 0.65 * ease(fl);
      drawDot(d.x, d.y, rad * sc, 1, !!iconImg && p.mirror === 'alternate' && d.c % 2 === 1);
      if (d.arrived && now - d.arrived < 300) {
        const t = (now - d.arrived) / 300;
        g.strokeStyle = `rgba(160, 210, 255, ${0.7 * (1 - t)})`; g.lineWidth = 2;
        g.beginPath(); g.arc(d.x, d.y, rad * (1 + t * 0.9), 0, Math.PI * 2); g.stroke();
      }
    }
    if (!flipping && rows > 0 && hasLabels()) drawRowLabels(now, s);
    g.restore();
    // Beams.
    for (const bm of beams) {
      const t = Math.max(0, (now - bm.born) / 300);
      const ext = ease(Math.min(1, t * 3.5));
      const x2 = bm.x0 + (bm.x1 - bm.x0) * ext, y2 = bm.y0 + (bm.y1 - bm.y0) * ext;
      const a = 1 - clamp((t - 0.3) / 0.7, 0, 1);
      g.lineCap = 'round';
      g.strokeStyle = `rgba(90, 170, 255, ${0.35 * a})`; g.lineWidth = 12;
      g.beginPath(); g.moveTo(bm.x0, bm.y0); g.lineTo(x2, y2); g.stroke();
      g.strokeStyle = `rgba(200, 235, 255, ${0.95 * a})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(bm.x0, bm.y0); g.lineTo(x2, y2); g.stroke();
      if (t < 0.5) {
        const fr = 10 + 26 * t;
        const rg = g.createRadialGradient(x2, y2, 0, x2, y2, fr);
        rg.addColorStop(0, `rgba(220, 240, 255, ${0.9 * a})`); rg.addColorStop(1, 'rgba(120, 190, 255, 0)');
        g.fillStyle = rg; g.beginPath(); g.arc(x2, y2, fr, 0, Math.PI * 2); g.fill();
      }
    }
    // Guns at tap points.
    for (const gn of guns) {
      const t = Math.max(0, (now - gn.born) / 520);
      const recoil = Math.sin(Math.min(1, t * 4) * Math.PI) * 6;
      drawGun(gn.x - Math.cos(gn.ang) * recoil, gn.y - Math.sin(gn.ang) * recoil, gn.ang, 1.05, 1 - clamp((t - 0.55) / 0.45, 0, 1));
    }
    if (p.caption && !flipping) drawCaption(p.caption);
  }

  // When each row's dots started arriving (for fades). Rows given by props are "born" long ago.
  function rowBorn(r) {
    let b = Infinity;
    for (const d of dots) if (d.r === r && d.born < b) b = d.born;
    return b === Infinity ? 0 : b;
  }

  // ---------- animation step ----------
  function step(now, dt) {
    let busy = false;
    const k = 1 - Math.exp(-dt / 75);
    // Smooth the spacing toward the target.
    if (Math.abs(cur.s - L.s) > 0.05) { cur.s += (L.s - cur.s) * k; busy = true; } else cur.s = L.s;
    if (flip) {
      const t = (now - flip.start) / flip.dur;
      const e = easeInOut(t);
      const th = e * Math.PI / 2;
      const s = flip.from.s + (flip.to.s - flip.from.s) * e;
      const cx = flip.from.cx + (flip.to.cx - flip.from.cx) * e;
      const cy = flip.from.cy + (flip.to.cy - flip.from.cy) * e;
      const cos = Math.cos(th), sin = Math.sin(th);
      for (const d of dots) {
        // d.r, d.c are already the new indices; recover the old ones.
        const oldR = flip.R - 1 - d.c, oldC = d.r;
        const ox = (oldC - (flip.C - 1) / 2) * s, oy = (oldR - (flip.R - 1) / 2) * s;
        d.x = cx + ox * cos - oy * sin; d.y = cy + ox * sin + oy * cos;
      }
      cur.s = s;
      if (t >= 1) { flip = null; for (const d of dots) { const q = L.slot(d.r, d.c); d.x = q.x; d.y = q.y; } }
      busy = true;
    } else {
      for (const d of dots) {
        if (now < d.born) { busy = true; continue; }
        const q = L.slot(d.r, d.c);
        const dx = q.x - d.x, dy = q.y - d.y;
        if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
          const kk = 1 - Math.exp(-dt / 65);
          d.x += dx * kk; d.y += dy * kk; busy = true;
          if (!d.arrived && Math.hypot(dx, dy) < 3) d.arrived = now;
        } else {
          d.x = q.x; d.y = q.y;
          if (!d.arrived) d.arrived = now;
        }
        if (now - d.born < 320) busy = true;
        if (d.arrived && now - d.arrived < 300) busy = true;
      }
    }
    ghosts = ghosts.filter(q => now - q.born < 260);
    beams = beams.filter(b => now - b.born < 300);
    guns = guns.filter(gn => now - gn.born < 520);
    if (ghosts.length || beams.length || guns.length) busy = true;
    if (hlFlash && now - hlFlash < 1800) busy = true;
    if (wob && now - wob < 300) busy = true;
    return busy;
  }

  function frame() {
    raf = 0;
    if (!alive) return;
    const now = performance.now();
    const dt = Math.min(1000, Math.max(1, now - last)); last = now;
    const busy = step(now, dt);
    render(now);
    if (busy && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!alive || raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function snapAll() {
    for (const d of dots) { const q = L.slot(d.r, d.c); d.x = q.x; d.y = q.y; d.arrived = d.arrived || 1; }
    cur.s = L.s;
  }

  // ---------- model changes ----------
  function relayout() { L = computeLayout(); if (!cur) cur = { s: L.s }; }

  function setRows(n, how = 'pop') {
    n = clamp(Math.round(n) || 0, 0, 12);
    const now = performance.now();
    if (n < rows) {
      dots = dots.filter(d => { if (d.r >= n) { ghosts.push({ x: d.x, y: d.y, rad: cur.s * 0.37, born: now }); return false; } return true; });
    }
    const old = rows;
    rows = n;
    relayout();
    if (n > old) {
      for (let r = old; r < n; r++) for (let c = 0; c < size; c++) {
        const q = L.slot(r, c);
        dots.push({ r, c, x: q.x, y: q.y, born: how === 'instant' ? 0 : now + (r - old) * 60 + c * 18, pop: true, arrived: how === 'instant' ? 1 : 0 });
      }
    }
  }

  function setSize(n) {
    n = clamp(Math.round(n) || 1, 1, maxSize());
    if (n === size) return false;
    const now = performance.now();
    if (n < size) {
      dots = dots.filter(d => { if (d.c >= n) { ghosts.push({ x: d.x, y: d.y, rad: cur.s * 0.37, born: now }); return false; } return true; });
    }
    const old = size;
    size = n;
    relayout();
    if (n > old) {
      for (let r = 0; r < rows; r++) for (let c = old; c < n; c++) {
        const q = L.slot(r, c);
        dots.push({ r, c, x: q.x, y: q.y, born: now + r * 30 + (c - old) * 25, pop: true, arrived: 0 });
      }
    }
    return true;
  }

  function blast(px, py) {
    const now = performance.now();
    if (rows >= maxRows()) {
      wob = now; sfx('click');
      guns.push({ x: px, y: py, ang: -Math.PI / 2, born: now });
      kick();
      return;
    }
    const r = rows;
    rows += 1;
    relayout();
    const gb = p.groupsView && L.groups ? L.groups[r] : null;
    const tgt = gb ? { x: gb.x + gb.w / 2, y: gb.y + gb.h / 2 } : { x: W / 2, y: L.slot(r, 0).y };
    const ang = Math.atan2(tgt.y - py, tgt.x - px);
    const muzzle = { x: px + Math.cos(ang) * 22, y: py + Math.sin(ang) * 22 };
    if (motion()) {
      beams.push({ x0: muzzle.x, y0: muzzle.y, x1: tgt.x, y1: tgt.y, born: now });
      guns.push({ x: px, y: py, ang, born: now });
    }
    for (let c = 0; c < size; c++) {
      const q = L.slot(r, c);
      dots.push(motion()
        ? { r, c, x: tgt.x, y: tgt.y, born: now + 70 + c * 22, arrived: 0 }
        : { r, c, x: q.x, y: q.y, born: 0, arrived: 1 });
    }
    sfx('pew');
    kick();
    changed();
  }

  function doFlip(quiet = false) {
    if (rows <= 0 || flip) { if (!flip) { wob = performance.now(); kick(); } return; }
    const R = rows, C = size;
    const from = { s: cur.s, cx: 0, cy: 0 };
    // Centre of the array as drawn now.
    const a = L.slot(0, 0), b = L.slot(R - 1, C - 1);
    from.cx = (a.x + b.x) / 2; from.cy = (a.y + b.y) / 2;
    // Re-index: old (r, c) -> new (c, R - 1 - r) after a quarter turn clockwise.
    for (const d of dots) { const nr = d.c, nc = R - 1 - d.r; d.r = nr; d.c = nc; }
    rows = C; size = R; flipped = !flipped;
    relayout();
    const a2 = L.slot(0, 0), b2 = L.slot(rows - 1, size - 1);
    const to = { s: L.s, cx: (a2.x + b2.x) / 2, cy: (a2.y + b2.y) / 2 };
    if (motion() && !p.groupsView) flip = { start: performance.now(), dur: 750, R, C, from, to };
    else if (!motion()) snapAll();
    sfx('whoosh');
    syncBar();
    kick();
    if (!quiet) changed();
  }

  // ---------- bar ----------
  function syncBar() {
    bar.style.display = showBar() ? '' : 'none';
    bar.classList.toggle('short', H < 380);
    num.textContent = String(size);
    const interactive = !ro();
    const showArrows = interactive && !p.lockSize;
    bL.style.display = bR.style.display = showArrows ? '' : 'none';
    bL.disabled = size <= 1; bR.disabled = size >= maxSize();
    bReset.style.display = interactive ? '' : 'none';
    bFlip.style.display = interactive && (p.flipButton || p.flip) ? '' : 'none';
    bFlip.disabled = rows <= 0;
    // Preview dots sized to fit.
    const have = pre.children.length;
    if (have !== size) {
      pre.replaceChildren();
      for (let i = 0; i < size; i++) { const d = document.createElement('i'); if (i >= have) d.className = 'pop'; pre.appendChild(d); }
    }
    requestAnimationFrame(() => {
      const avail = pre.clientWidth || 200;
      const dd = clamp(Math.floor((avail - (size - 1) * 6) / size), 8, 28);
      for (const d of pre.children) { d.style.width = d.style.height = dd + 'px'; }
    });
    wrap.classList.toggle('ro', !interactive);
  }

  // ---------- events ----------
  unbinds.push(onTap(cv, e => {
    if (ro() || flip) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (y < barH()) return;
    blast(x, y);
    syncBar();
  }));
  unbinds.push(onTap(bL, () => { if (ro() || p.lockSize) return; if (setSize(size - 1)) { sfx('click'); syncBar(); kick(); changed(); } }));
  unbinds.push(onTap(bR, () => { if (ro() || p.lockSize) return; if (setSize(size + 1)) { sfx('click'); syncBar(); kick(); changed(); } }));
  unbinds.push(onTap(bReset, () => {
    if (ro()) return;
    flip = null;
    const had = rows > 0 || flipped;
    setRows(0); flipped = false;
    sfx('whoosh'); syncBar(); kick();
    if (had) changed();
  }));
  unbinds.push(onTap(bFlip, () => { if (ro()) return; doFlip(); }));

  const ro2 = new ResizeObserver(() => resize());
  ro2.observe(wrap);
  const onVis = () => { if (!document.hidden) { last = performance.now(); kick(); render(performance.now()); } else if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  document.addEventListener('visibilitychange', onVis);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive && W) { syncBar(); render(performance.now()); } });

  function resize() {
    const r = wrap.getBoundingClientRect();
    const nw = Math.round(r.width), nh = Math.round(r.height);
    if (!nw || !nh || (nw === W && nh === H)) return;
    W = nw; H = nh;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    buildBackground();
    if (!sprite) buildSprite();
    relayout();
    flip = null;
    snapAll();
    syncBar();
    render(performance.now());
    kick();
  }

  function applyProps(np, first) {
    p = { ...p, ...np };
    if ('icon' in np) loadIcon();
    if (first) {
      size = clamp(Math.round(p.size ?? 1) || 1, 1, maxSize());
      flipped = !!p.flipped;
      rows = 0; dots = [];
      relayout();
      setRows(p.rows ?? 0, 'instant');
      return;
    }
    if ('size' in np) {
      const want = clamp(Math.round(np.size ?? 1) || 1, 1, maxSize());
      if ('rows' in np) {
        // A fresh set-up: rebuild without the grow animation of the old rows.
        const now = performance.now();
        for (const d of dots) ghosts.push({ x: d.x, y: d.y, rad: cur.s * 0.37, born: now });
        dots = []; rows = 0; size = want;
        relayout();
        setRows(np.rows, 'pop');
      } else setSize(want);
    } else if ('rows' in np) {
      setRows(np.rows, 'pop');
    }
    if ('maxSize' in np && size > maxSize()) setSize(maxSize());
    // A lone flipped change turns the array (animated); with size or rows it is a fresh set-up and only sets the flag.
    let turn = false;
    if ('flipped' in np) {
      if (!('size' in np) && !('rows' in np) && !!np.flipped !== flipped && rows > 0) turn = true;
      else flipped = !!np.flipped;
    }
    relayout();
    if ('bar' in np && W) buildBackground();
    return turn;
  }

  const api = {
    getState: state,
    update(np = {}) {
      flip = null;
      const turn = applyProps(np, false);
      if (turn) { snapAll(); doFlip(true); }
      syncBar();
      if (W) { render(performance.now()); kick(); }
    },
    showAnswer(answer) {
      if (answer && typeof answer === 'object') {
        // A try goal such as { size: 5, rows: 3 }, { total: 30, size: 10 } or { flipped: true }.
        flip = null;
        if (typeof answer.size === 'number') setSize(answer.size);
        if (typeof answer.rows === 'number') setRows(answer.rows);
        else if (typeof answer.total === 'number' && size > 0 && answer.total % size === 0 && answer.total / size <= maxRows()) setRows(answer.total / size);
        if (typeof answer.flipped === 'boolean' && answer.flipped !== flipped && rows > 0) { snapAll(); doFlip(true); }
      } else if (typeof answer === 'number' && rows === 0 && size > 0 && answer % size === 0 && answer / size <= 12) {
        // Only build the answer on an empty array; otherwise the picture already shows it (the number may be a factor).
        setRows(answer / size);
      }
      hlFlash = performance.now() + 300;
      syncBar();
      kick();
    },
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      unbinds.splice(0).forEach(u => u());
      ro2.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      el.replaceChildren();
    },
  };

  applyProps(props, true);
  syncBar();
  resize();
  return api;
}
