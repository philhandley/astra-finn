// Mission patches: a round embroidered-style patch with a sticker in the middle and the crew's names.
import { sticker } from './stickers.js';
let uid = 0;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// earned=false draws a faint outline (not yet earned).
export function patchSVG({ name = 'Mission', art = 'star', col = '#ff4f45', col2 = '#ffd0cc', names = '', earned = true, gold = false } = {}) {
  const id = `pt${++uid}`;
  const top = String(name).toUpperCase();
  const bottom = String(names).toUpperCase();
  const fsTop = Math.min(19, (236 / Math.max(6, top.length) - 2) / 0.74);
  const fsBot = Math.min(14, (250 / Math.max(6, bottom.length) - 2) / 0.72);
  const ring = gold ? '#d4a017' : col;
  const inner = sticker(art).replace('<svg class="sticker"', '<svg x="68" y="62" width="104" height="104"');
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(name)} patch"${earned ? '' : ' style="opacity:.22;filter:grayscale(1)"'}>
  <defs>
    <path id="${id}t" d="M 38 120 A 82 82 0 0 1 202 120"/>
    <path id="${id}b" d="M 30 120 A 90 90 0 0 0 210 120"/>
    ${gold ? `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".5" stop-color="#e2b42a"/><stop offset="1" stop-color="#fff2b0"/></linearGradient>` : ''}
  </defs>
  <circle cx="120" cy="120" r="116" fill="${gold ? `url(#${id}g)` : ring}"/>
  <circle cx="120" cy="120" r="109" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 5" opacity=".7"/>
  <circle cx="120" cy="120" r="100" fill="#1b1b24"/>
  <text font-family="Lexend, system-ui, sans-serif" font-weight="800" font-size="${fsTop.toFixed(1)}" letter-spacing="2" fill="#fff" text-anchor="middle"><textPath href="#${id}t" startOffset="50%">${esc(top)}</textPath></text>
  <text font-family="Lexend, system-ui, sans-serif" font-weight="700" font-size="${fsBot.toFixed(1)}" letter-spacing="2" fill="${col2}" text-anchor="middle"><textPath href="#${id}b" startOffset="50%">${esc(bottom)}</textPath></text>
  <circle cx="120" cy="114" r="64" fill="${col2}" stroke="${ring}" stroke-width="6"/>
  ${inner}
</svg>`;
}
