// Mission patch generator: an SVG string styled like a real mission patch, with tier stars.
let uid = 0;
const IVORY = '#f3efe6';

// Icons drawn in a 100x100 box. `a` = accent colour.
const ICONS = {
  rocket: a => `
    <path d="M50 6c9 7 12 17 12 27v40l6 7v8h-7l-3-5H42l-3 5h-7v-8l6-7V33c0-10 3-20 12-27z" fill="${IVORY}"/>
    <path d="M50 6c9 7 12 17 12 27v40h-12z" fill="#000" opacity=".12"/>
    <circle cx="50" cy="36" r="6" fill="${a}"/>
    <path d="M38 64l-8 10v8l8-4zM62 64l8 10v8l-8-4z" fill="${a}"/>
    <path d="M44 88q6 14 12 0z" fill="${a}"/>`,
  blocks: a => `
    ${[0, 1, 2, 3].map(i => `<rect x="${14 + i * 13}" y="14" width="10" height="66" rx="2" fill="${a}" stroke="#000" stroke-opacity=".25"/>`).join('')}
    ${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${70 + (i % 2) * 12}" y="${20 + Math.floor(i / 2) * 15}" width="10" height="10" rx="2" fill="${IVORY}"/>`).join('')}`,
  partwhole: a => `
    <path d="M50 30L28 70M50 30L72 70" stroke="${IVORY}" stroke-width="4"/>
    <circle cx="50" cy="26" r="17" fill="${a}"/><circle cx="26" cy="72" r="15" fill="${IVORY}"/><circle cx="74" cy="72" r="15" fill="${IVORY}"/>
    <text x="50" y="33" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="20" fill="#0b1020">10</text>
    <text x="26" y="79" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="20" fill="#0b1020">7</text>
    <text x="74" y="79" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="20" fill="#0b1020">3</text>`,
  blaster: a => `
    ${[0, 1, 2].map(r => [0, 1, 2, 3].map(c => `<circle cx="${34 + c * 14}" cy="${30 + r * 14}" r="5.5" fill="#4f9dff"/>`).join('')).join('')}
    <rect x="27" y="23" width="56" height="14" rx="4" fill="none" stroke="${a}" stroke-width="2"/>
    <path d="M12 82l18-14 10 6-14 14z" fill="${IVORY}"/><path d="M30 68l14-8" stroke="${a}" stroke-width="4" stroke-linecap="round"/>
    <path d="M46 60l30-10" stroke="${a}" stroke-width="2" stroke-dasharray="4 4"/>`,
  fraction: a => `
    <circle cx="50" cy="50" r="34" fill="${IVORY}" opacity=".2"/>
    <path d="M50 50L50 16A34 34 0 0 1 84 50z" fill="${a}"/><path d="M50 50L84 50A34 34 0 0 1 50 84z" fill="${a}" opacity=".75"/>
    <path d="M50 50L50 84A34 34 0 0 1 16 50z" fill="${a}" opacity=".5"/>
    <circle cx="50" cy="50" r="34" fill="none" stroke="${IVORY}" stroke-width="3"/><path d="M50 16v68M16 50h68" stroke="${IVORY}" stroke-width="3"/>`,
  clock: a => `
    <circle cx="50" cy="50" r="36" fill="${IVORY}"/><circle cx="50" cy="50" r="36" fill="none" stroke="${a}" stroke-width="5"/>
    ${Array.from({ length: 12 }, (_, i) => { const t = (i * Math.PI) / 6; return `<circle cx="${50 + 28 * Math.sin(t)}" cy="${50 - 28 * Math.cos(t)}" r="2.2" fill="#0b1020"/>`; }).join('')}
    <path d="M50 50V24" stroke="#0b1020" stroke-width="4" stroke-linecap="round"/><path d="M50 50l14 8" stroke="#0b1020" stroke-width="5" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="4" fill="${a}"/>`,
  shapes: a => `
    <path d="M28 16l20 34H8z" fill="${a}"/><rect x="54" y="18" width="32" height="32" rx="2" fill="${IVORY}"/>
    <circle cx="32" cy="72" r="16" fill="${IVORY}" opacity=".85"/><path d="M60 58h26l-6 28H54z" fill="${a}" opacity=".8"/>`,
  chart: a => `
    <path d="M14 84h74M14 84V14" stroke="${IVORY}" stroke-width="3"/>
    <rect x="22" y="54" width="14" height="30" fill="${a}"/><rect x="42" y="30" width="14" height="54" fill="${IVORY}"/>
    <rect x="62" y="44" width="14" height="40" fill="${a}" opacity=".75"/>`,
  star: a => `<path d="M50 10l11 25 27 3-20 18 6 27-24-14-24 14 6-27-20-18 27-3z" fill="${a}" stroke="${IVORY}" stroke-width="2" stroke-linejoin="round"/>`,
  coin: a => `
    <circle cx="40" cy="56" r="26" fill="#c98a4b" stroke="#8a5a2b" stroke-width="3"/><text x="40" y="64" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="22" fill="#4a2d10">2p</text>
    <path d="M66 22l16 7 4 17-11 14H58L47 46l4-17z" fill="#d7dbe2" stroke="${IVORY}" stroke-width="2"/><text x="66" y="48" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="16" fill="#0b1020">50p</text>
    <circle cx="74" cy="76" r="14" fill="${a}" stroke="${IVORY}" stroke-width="2"/>`,
  ruler: a => `
    <rect x="10" y="38" width="80" height="26" rx="3" fill="${a}"/>
    ${Array.from({ length: 11 }, (_, i) => `<path d="M${14 + i * 7.2} 38v${i % 5 === 0 ? 12 : 7}" stroke="#0b1020" stroke-width="2"/>`).join('')}
    <path d="M18 22h56" stroke="${IVORY}" stroke-width="4" stroke-linecap="round"/><path d="M18 16v12M74 16v12" stroke="${IVORY}" stroke-width="3"/>`,
  scales: a => `
    <path d="M50 18v56M24 82h52" stroke="${IVORY}" stroke-width="4" stroke-linecap="round"/><path d="M20 30h60" stroke="${IVORY}" stroke-width="4" stroke-linecap="round"/>
    <path d="M20 30l-10 22h20zM80 30l-10 22h20z" fill="none" stroke="${a}" stroke-width="3"/><path d="M10 52a10 6 0 0 0 20 0zM70 52a10 6 0 0 0 20 0z" fill="${a}"/>`,
  numberline: a => `
    <path d="M8 62h84" stroke="${IVORY}" stroke-width="4"/><path d="M8 62l6-5v10zM92 62l-6-5v10z" fill="${IVORY}"/>
    ${[18, 34, 50, 66, 82].map(x => `<path d="M${x} 56v12" stroke="${IVORY}" stroke-width="3"/>`).join('')}
    <path d="M18 54q8-24 16 0M34 54q8-24 16 0M50 54q8-24 16 0" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/>`,
  hundred: a => `
    ${Array.from({ length: 25 }, (_, i) => `<rect x="${16 + (i % 5) * 14}" y="${16 + Math.floor(i / 5) * 14}" width="12" height="12" rx="2" fill="${i % 5 === 4 ? a : IVORY}" opacity="${i % 5 === 4 ? 1 : 0.35}"/>`).join('')}`,
  rover: a => `
    <rect x="22" y="40" width="56" height="22" rx="5" fill="${IVORY}"/><rect x="30" y="28" width="22" height="14" rx="3" fill="${a}"/>
    <path d="M58 40V24h14" stroke="${IVORY}" stroke-width="3"/><circle cx="74" cy="22" r="5" fill="${a}"/>
    <circle cx="30" cy="68" r="9" fill="#5a6274" stroke="${IVORY}" stroke-width="2.5"/><circle cx="50" cy="68" r="9" fill="#5a6274" stroke="${IVORY}" stroke-width="2.5"/><circle cx="70" cy="68" r="9" fill="#5a6274" stroke="${IVORY}" stroke-width="2.5"/>`,
  cube: a => `
    <path d="M50 14l32 16v38L50 86 18 68V30z" fill="${a}" opacity=".35" stroke="${IVORY}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M18 30l32 16 32-16M50 46v40" stroke="${IVORY}" stroke-width="3" fill="none"/><path d="M50 14l32 16-32 16-32-16z" fill="${a}"/>`,
  tensframe: a => `
    <rect x="10" y="30" width="80" height="34" rx="3" fill="none" stroke="${IVORY}" stroke-width="3"/>
    <path d="M26 30v34M42 30v34M58 30v34M74 30v34M10 47h80" stroke="${IVORY}" stroke-width="2"/>
    ${[18, 34, 50, 66, 82].map(x => `<circle cx="${x}" cy="38.5" r="6" fill="${a}"/>`).join('')}${[18, 34].map(x => `<circle cx="${x}" cy="55.5" r="6" fill="#5fd4ff"/>`).join('')}`,
  words: a => `
    <text x="50" y="46" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="34" fill="${a}">64</text>
    <text x="50" y="76" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="600" font-size="15" fill="${IVORY}">sixty-four</text>`,
};
export const patchIcons = Object.keys(ICONS);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STAR = 'M0 -8L2.35 -3.24 7.6 -2.47 3.8 1.24 4.7 6.47 0 4 -4.7 6.47 -3.8 1.24 -7.6 -2.47 -2.35 -3.24Z';

// accent: [main, light]. tier: 0 (not earned, shown faint) to 3 (all three stars lit).
export function patchSVG({ name = 'Mission', icon = 'rocket', accent = ['#f2b544', '#ffe0a0'], crew = { commander: 'Finn', engineer: 'Dad' }, tier = 1, sub = '' } = {}) {
  const id = `mp${++uid}`;
  const [a, a2] = accent;
  const top = String(name).toUpperCase();
  const bottom = (sub || `${crew.commander || 'Finn'} · ${crew.engineer || 'Dad'}`).toUpperCase();
  const fsTop = Math.min(18, 300 / Math.max(8, top.length * 0.95));
  const fsBot = Math.min(16, 280 / Math.max(8, bottom.length * 0.95));
  const draw = (ICONS[icon] || ICONS.rocket)(a);
  const stars = [0, 1, 2].map(i => {
    const lit = i < tier;
    const x = 120 + (i - 1) * 24;
    return `<path d="${STAR}" transform="translate(${x} 186) scale(1.25)" fill="${lit ? a : 'none'}" stroke="${lit ? a2 : 'rgba(243,239,230,.35)'}" stroke-width="1.2"/>`;
  }).join('');
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(name)} patch"${tier ? '' : ' style="opacity:.28;filter:grayscale(1)"'}>
  <defs>
    <radialGradient id="${id}g" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#1c2a52"/><stop offset=".7" stop-color="#0a1024"/><stop offset="1" stop-color="#060914"/></radialGradient>
    <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a2}"/><stop offset=".5" stop-color="${a}"/><stop offset="1" stop-color="${a2}"/></linearGradient>
    <path id="${id}t" d="M 41 120 A 79 79 0 0 1 199 120"/>
    <path id="${id}b" d="M 27 120 A 93 93 0 0 0 213 120"/>
    <clipPath id="${id}c"><circle cx="120" cy="112" r="64"/></clipPath>
  </defs>
  <circle cx="120" cy="120" r="117" fill="url(#${id}r)"/>
  <circle cx="120" cy="120" r="110" fill="#070b18"/>
  <circle cx="120" cy="120" r="106" fill="none" stroke="${a}" stroke-width="1.2" opacity=".6"/>
  <text font-family="Space Grotesk, system-ui, sans-serif" font-weight="700" font-size="${fsTop.toFixed(1)}" letter-spacing="2.4" fill="${IVORY}" text-anchor="middle"><textPath href="#${id}t" startOffset="50%">${esc(top)}</textPath></text>
  <text font-family="Space Grotesk, system-ui, sans-serif" font-weight="600" font-size="${fsBot.toFixed(1)}" letter-spacing="2.4" fill="${a}" text-anchor="middle"><textPath href="#${id}b" startOffset="50%">${esc(bottom)}</textPath></text>
  <circle cx="120" cy="112" r="66" fill="url(#${id}g)" stroke="${a}" stroke-width="2.5"/>
  <g clip-path="url(#${id}c)">
    <circle cx="76" cy="82" r="1.2" fill="#fff" opacity=".7"/><circle cx="160" cy="76" r="1" fill="#fff" opacity=".6"/>
    <circle cx="150" cy="150" r="1.3" fill="#fff" opacity=".5"/><circle cx="88" cy="146" r=".9" fill="#fff" opacity=".6"/>
    <g transform="translate(76 68) scale(.88)">${draw}</g>
  </g>
  ${stars}
</svg>`;
}
