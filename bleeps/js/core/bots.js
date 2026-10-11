// The Bleep Bots: one robot per sound shape. Flat, geometric, friendly.
// Each robot's body is its wave's shape and its mouth is a little LCD wave.
import { shape } from './chip.js';
import { BOTS } from './song.js';

const LCD = { bg: '#9bbc0f', light: '#8bac0f', dark: '#306230', ink: '#0f380f' };
export { LCD };
let uid = 0;

// An SVG path through one or more cycles of a wave table, drawn as steps (like a chip would).
export function wavePath(table, x, y, w, h, cycles = 2, { smooth = false } = {}) {
  const n = table.length * cycles;
  const dx = w / n;
  const Y = v => (y + h / 2 - (v * h) / 2).toFixed(1);
  let d = '';
  for (let i = 0; i < n; i++) {
    const v = table[i % table.length];
    const x0 = (x + i * dx).toFixed(1), x1 = (x + (i + 1) * dx).toFixed(1);
    if (smooth) d += (i ? 'L' : 'M') + x0 + ' ' + Y(v);
    else d += (i ? 'L' : 'M') + x0 + ' ' + Y(v) + 'L' + x1 + ' ' + Y(v);
  }
  if (smooth) d += 'L' + (x + w).toFixed(1) + ' ' + Y(table[0]);
  return d;
}

// The mouth glyph for each bot (a short clean wave, not the stepped table).
function mouthPath(bot, x, y, w, h, table) {
  const H = h / 2, mid = y + H;
  switch (bot) {
    case 'bleep': { const q = w / 4; return `M${x} ${mid + H}V${y}h${q}v${h}h${q}V${y}h${q}v${h}h${q}`; }
    case 'hoot': { const q = w / 4; return `M${x} ${mid}L${x + q} ${y}L${x + 2 * q} ${y + h}L${x + 3 * q} ${y}L${x + 4 * q} ${mid}`; }
    case 'buzz': { const q = w / 3; return `M${x} ${y + h}L${x + q} ${y}V${y + h}L${x + 2 * q} ${y}V${y + h}L${x + 3 * q} ${y}V${y + h}`; }
    case 'fizz': { let d = `M${x} ${mid}`; const pts = [0.2, -0.9, 0.6, -0.3, 0.95, -0.7, 0.1, 0.8, -0.5, 0.4, -0.95, 0.3]; pts.forEach((v, i) => { d += `L${(x + ((i + 1) * w) / pts.length).toFixed(1)} ${(mid - v * H).toFixed(1)}`; }); return d; }
    default: return wavePath(table || shape('crew'), x, y, w, h, 1, { smooth: true });
  }
}

function face(bot, fx, fy, fw, fh, { sleep, table, id }) {
  const ex = fw * 0.26, ey = fh * 0.22, es = Math.max(7, fw * 0.14);
  const eyes = sleep
    ? `<path d="M${fx + ex - es / 2} ${fy + ey + es / 2}h${es}M${fx + fw - ex - es / 2} ${fy + ey + es / 2}h${es}" stroke="${LCD.ink}" stroke-width="3" stroke-linecap="square"/>`
    : `<g class="eyes"><rect x="${fx + ex - es / 2}" y="${fy + ey}" width="${es}" height="${es}" fill="${LCD.ink}"/><rect x="${fx + fw - ex - es / 2}" y="${fy + ey}" width="${es}" height="${es}" fill="${LCD.ink}"/>
       <rect x="${fx + ex - es / 2 + es * 0.55}" y="${fy + ey + es * 0.15}" width="${es * 0.3}" height="${es * 0.3}" fill="${LCD.bg}"/><rect x="${fx + fw - ex - es / 2 + es * 0.55}" y="${fy + ey + es * 0.15}" width="${es * 0.3}" height="${es * 0.3}" fill="${LCD.bg}"/></g>`;
  const mw = fw * 0.56, mh = fh * 0.24, mx = fx + (fw - mw) / 2, my = fy + fh * 0.58;
  return `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="6" fill="${LCD.bg}" stroke="rgba(0,0,0,.28)" stroke-width="3"/>
    <rect x="${fx + 3}" y="${fy + 3}" width="${fw - 6}" height="${fh * 0.18}" rx="3" fill="#ffffff" opacity=".18"/>
    ${eyes}
    <g class="mouth" style="transform-origin:${fx + fw / 2}px ${my + mh / 2}px"><path d="${mouthPath(bot, mx, my, mw, mh, table)}" fill="none" stroke="${LCD.dark}" stroke-width="3.2" stroke-linejoin="miter" stroke-linecap="square"/></g>`;
}

function feet(c) {
  return `<rect x="36" y="112" width="14" height="16" rx="3" fill="${c.dark}"/><rect x="70" y="112" width="14" height="16" rx="3" fill="${c.dark}"/>
    <rect x="31" y="124" width="22" height="9" rx="4" fill="#2b2b33"/><rect x="67" y="124" width="22" height="9" rx="4" fill="#2b2b33"/>`;
}

const BODIES = {
  bleep: (c, o) => `
    <g class="antenna"><path d="M60 30V12" stroke="#2b2b33" stroke-width="4"/><rect x="53" y="4" width="14" height="14" rx="2" fill="${c.col}" stroke="${c.dark}" stroke-width="3"/></g>
    <rect x="10" y="62" width="12" height="28" rx="5" fill="${c.dark}"/><rect x="98" y="62" width="12" height="28" rx="5" fill="${c.dark}"/>
    <rect x="18" y="28" width="84" height="88" rx="14" fill="${c.col}"/>
    <rect x="18" y="96" width="84" height="20" rx="10" fill="${c.dark}" opacity=".35"/>
    ${face('bleep', 28, 38, 64, 52, o)}
    <rect x="30" y="100" width="12" height="6" rx="2" fill="#fff" opacity=".55"/><rect x="46" y="100" width="12" height="6" rx="2" fill="#fff" opacity=".35"/>`,
  hoot: (c, o) => `
    <g class="antenna"><circle cx="60" cy="8" r="6" fill="${c.col}" stroke="${c.dark}" stroke-width="3"/></g>
    <path d="M60 16 L108 112 Q110 118 103 118 L17 118 Q10 118 12 112 Z" fill="${c.col}" stroke="${c.col}" stroke-width="10" stroke-linejoin="round"/>
    <path d="M24 104 L96 104 L103 118 L17 118 Z" fill="${c.dark}" opacity=".35"/>
    ${face('hoot', 33, 58, 54, 44, o)}`,
  buzz: (c, o) => `
    <g class="wings"><ellipse cx="22" cy="44" rx="18" ry="11" fill="#dff3ff" opacity=".85" stroke="#9cc9e6" stroke-width="2" transform="rotate(-25 22 44)"/>
      <ellipse cx="98" cy="44" rx="18" ry="11" fill="#dff3ff" opacity=".85" stroke="#9cc9e6" stroke-width="2" transform="rotate(25 98 44)"/></g>
    <path d="M20 38 L40 18 V38 L60 18 V38 L80 18 V38 L100 18 V44 H20 Z" fill="${c.dark}"/>
    <rect x="18" y="36" width="84" height="80" rx="14" fill="${c.col}"/>
    <rect x="18" y="94" width="84" height="9" fill="#2b2b33" opacity=".85"/><rect x="18" y="106" width="84" height="10" rx="5" fill="#2b2b33" opacity=".85"/>
    ${face('buzz', 28, 44, 64, 44, o)}`,
  fizz: (c, o) => {
    const bumps = 16, cx = 60, cy = 72, r = 46;
    let d = '';
    for (let i = 0; i <= bumps; i++) {
      const a = (i / bumps) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      d += i ? `A9 9 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}` : `M${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const dots = [[30, 50], [92, 46], [26, 86], [96, 90], [44, 108], [80, 110], [60, 30], [40, 34], [84, 32]];
    return `<g class="antenna"><path d="M60 26V12" stroke="#2b2b33" stroke-width="4"/><path d="M60 2 63 9 70 9 64 13 66 20 60 16 54 20 56 13 50 9 57 9Z" fill="#f5b400" stroke="${c.dark}" stroke-width="1.5"/></g>
      <path d="${d}Z" fill="${c.col}"/>
      ${dots.map(([x, y]) => `<rect x="${x}" y="${y}" width="4" height="4" fill="#fff" opacity=".45"/>`).join('')}
      ${face('fizz', 32, 50, 56, 44, o)}`;
  },
  crew: (c, o) => `
    <g class="antenna"><path d="M48 30 36 10M72 30 84 10" stroke="#2b2b33" stroke-width="4" stroke-linecap="round"/><circle cx="36" cy="9" r="6" fill="${c.col}" stroke="${c.dark}" stroke-width="3"/><circle cx="84" cy="9" r="6" fill="${c.col}" stroke="${c.dark}" stroke-width="3"/></g>
    <rect x="10" y="64" width="12" height="26" rx="5" fill="${c.dark}"/><rect x="98" y="64" width="12" height="26" rx="5" fill="${c.dark}"/>
    <rect x="16" y="28" width="88" height="88" rx="26" fill="${c.col}"/>
    <rect x="16" y="96" width="88" height="20" rx="10" fill="${c.dark}" opacity=".3"/>
    ${face('crew', 27, 40, 66, 50, o)}
    <circle cx="44" cy="104" r="4" fill="#fff" opacity=".6"/><circle cx="60" cy="104" r="4" fill="#fff" opacity=".4"/><circle cx="76" cy="104" r="4" fill="#fff" opacity=".25"/>`,
};

// state: 'idle' | 'sleep'. The wrapper toggles .sing for the singing animation.
export function botSVG(bot, { sleep = false, table = null, label = true } = {}) {
  const c = BOTS[bot] || BOTS.bleep;
  const id = `bot${++uid}`;
  const body = (BODIES[bot] || BODIES.bleep)(c, { sleep, table, id });
  return `<svg class="botsvg" viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg"${label ? ` role="img" aria-label="${c.name}, the ${c.wave} robot"` : ' aria-hidden="true"'}>
    <ellipse cx="60" cy="134" rx="40" ry="5" fill="#000" opacity=".12"/>
    ${bot === 'fizz' ? '' : feet(c)}
    <g class="body">${body}</g>
    ${sleep ? `<g class="zzz" fill="${c.dark}" font-family="'Press Start 2P', monospace" font-size="11"><text x="88" y="24">z</text><text x="98" y="12">z</text></g>` : ''}
  </svg>`;
}

// Make a bot element sing for a moment.
export function sing(el, ms = 600) {
  if (!el) return;
  el.classList.remove('sing');
  void el.offsetWidth;
  el.classList.add('sing');
  clearTimeout(el._singT);
  el._singT = setTimeout(() => el.classList.remove('sing'), ms);
}

// A small picture of a wave on an LCD panel (used in choices, chips and the Sound Lab).
export function lcdWave(table, { w = 160, h = 70, cycles = 2, smooth = false, col = LCD.ink } = {}) {
  return `<svg class="lcdwave" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="${w}" height="${h}" rx="8" fill="${LCD.bg}"/>
    <path d="M8 ${h / 2}H${w - 8}" stroke="${LCD.light}" stroke-width="2" stroke-dasharray="4 4"/>
    <path d="${wavePath(table, 10, 10, w - 20, h - 20, cycles, { smooth })}" fill="none" stroke="${col}" stroke-width="4" stroke-linejoin="miter"/>
  </svg>`;
}
