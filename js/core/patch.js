// Mission patch generator: returns an SVG string styled like a real NASA mission patch.
let uid = 0;

const ACCENTS = {
  gold: ['#f2b544', '#ffe0a0'],
  cyan: ['#5fd4ff', '#c4f0ff'],
  red: ['#ff7f5e', '#ffc2ad'],
  green: ['#6fe3a5', '#c5f7dc'],
};

const IVORY = '#f3efe6';

// Icons drawn in a 100x100 box centred on (50,50). `a` = accent colour.
const ICONS = {
  rocket: a => `
    <path d="M22 86 Q50 70 78 86" fill="none" stroke="${a}" stroke-width="2" opacity=".5"/>
    <path d="M50 6c9 7 12 17 12 27v40l6 7v8h-7l-3-5H42l-3 5h-7v-8l6-7V33c0-10 3-20 12-27z" fill="${IVORY}"/>
    <path d="M50 6c9 7 12 17 12 27v40h-12z" fill="#000" opacity=".12"/>
    <path d="M38 24l-7 9v6l7-3zM62 24l7 9v6l-7-3z" fill="${IVORY}"/>
    <path d="M38 64l-8 10v8l8-4zM62 64l8 10v8l-8-4z" fill="${IVORY}" opacity=".9"/>
    <path d="M44 88q6 14 12 0z" fill="${a}"/>
    <path d="M47 88q3 8 6 0z" fill="#fff" opacity=".8"/>`,
  asteroid: a => `
    <path d="M78 20l-16 9M84 32l-14 6M72 12l-12 12" stroke="${a}" stroke-width="3" stroke-linecap="round" opacity=".85"/>
    <path d="M30 36l14-12 17 2 13 11 4 16-8 16-17 8-18-4-12-14-1-14z" fill="#8f949e" stroke="${IVORY}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="44" cy="46" r="7" fill="#6f747e"/><circle cx="60" cy="62" r="5" fill="#6f747e"/>
    <circle cx="36" cy="62" r="3.5" fill="#6f747e"/><circle cx="62" cy="40" r="3" fill="#6f747e"/>`,
  planet: a => `
    <path d="M7.7 64.1 A44 11 -16 0 1 92.3 39.9" fill="none" stroke="${IVORY}" stroke-width="3" opacity=".55"/>
    <circle cx="50" cy="50" r="25" fill="${a}"/>
    <path d="M27 43c8 2 14-2 22 0s14 6 24 2" stroke="#000" stroke-opacity=".18" stroke-width="4" fill="none"/>
    <path d="M26 57c10-2 16 3 26 1s12-4 22-2" stroke="#000" stroke-opacity=".14" stroke-width="3" fill="none"/>
    <circle cx="42" cy="40" r="7" fill="#fff" opacity=".18"/>
    <path d="M7.7 64.1 A44 11 -16 0 0 92.3 39.9" fill="none" stroke="${IVORY}" stroke-width="3"/>`,
  astronaut: a => `
    <path d="M24 92c2-18 12-26 26-26s24 8 26 26z" fill="${IVORY}"/>
    <rect x="40" y="74" width="20" height="10" rx="2" fill="${a}" opacity=".9"/>
    <circle cx="50" cy="40" r="25" fill="${IVORY}"/>
    <path d="M32 38c0-10 8-16 18-16s18 6 18 16-8 15-18 15-18-5-18-15z" fill="#0c1430"/>
    <path d="M38 32c3-4 7-5 11-5" stroke="${a}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <circle cx="60" cy="42" r="2.5" fill="${a}" opacity=".7"/>`,
  moon: a => `
    <circle cx="50" cy="50" r="30" fill="#d4d7de"/>
    <path d="M50 20a30 30 0 0 1 0 60 22 30 0 0 0 0-60z" fill="#000" opacity=".22"/>
    <circle cx="40" cy="40" r="6" fill="#b4b8c1"/><circle cx="58" cy="60" r="8" fill="#b4b8c1"/>
    <circle cx="36" cy="62" r="4" fill="#b4b8c1"/><circle cx="62" cy="36" r="3.5" fill="#b4b8c1"/>
    <path d="M30 78h40" stroke="${a}" stroke-width="3" stroke-linecap="round"/>
    <path d="M42 78a8 8 0 0 1 16 0" fill="${a}"/>
    <path d="M64 78V64l8 3-8 3" stroke="${IVORY}" stroke-width="2" fill="${IVORY}"/>`,
  bolt: a => `
    <path d="M50 16l29 17v34L50 84 21 67V33z" fill="#c9ced6" stroke="${IVORY}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M50 16l29 17v34L50 84z" fill="#000" opacity=".14"/>
    <circle cx="50" cy="50" r="15" fill="#0c1430" stroke="${a}" stroke-width="3"/>
    <path d="M44 50a6 6 0 0 1 12 0" stroke="${a}" stroke-width="2" fill="none" opacity=".7"/>
    <circle cx="70" cy="76" r="6" fill="#b5652d" opacity=".9"/><circle cx="76" cy="70" r="3" fill="#b5652d" opacity=".7"/>`,
  zoom: a => `
    <circle cx="50" cy="50" r="40" fill="none" stroke="${IVORY}" stroke-width="1.5" opacity=".35"/>
    <circle cx="50" cy="50" r="29" fill="none" stroke="${IVORY}" stroke-width="2" opacity=".55"/>
    <circle cx="50" cy="50" r="18" fill="none" stroke="${IVORY}" stroke-width="2.5" opacity=".8"/>
    <circle cx="50" cy="50" r="8" fill="${a}"/>
    <circle cx="79" cy="50" r="5" fill="#ff8a65"/><circle cx="50" cy="21" r="4" fill="#7cc4ff"/>
    <circle cx="22" cy="78" r="6" fill="#e8c38a"/><circle cx="66" cy="65" r="3" fill="#d4d7de"/>`,
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function patchSVG({ name = 'Mission', icon = 'rocket', accent = 'gold', crew = { commander: 'Finn', engineer: 'Dad' }, year = '2026', locked = false } = {}) {
  const id = `ap${++uid}`;
  const [a, a2] = ACCENTS[accent] || ACCENTS.gold;
  const top = String(name).toUpperCase();
  const bottom = `${crew.commander || 'Finn'} · ${crew.engineer || 'Dad'}`.toUpperCase();
  const fsTop = Math.min(18, 300 / Math.max(8, top.length * 0.95));
  const fsBot = Math.min(16, 280 / Math.max(8, bottom.length * 0.95));
  const draw = (ICONS[icon] || ICONS.rocket)(a);
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(name)} mission patch"${locked ? ' style="opacity:.25;filter:grayscale(1)"' : ''}>
  <defs>
    <radialGradient id="${id}g" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#1c2a52"/><stop offset=".7" stop-color="#0a1024"/><stop offset="1" stop-color="#060914"/></radialGradient>
    <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a2}"/><stop offset=".5" stop-color="${a}"/><stop offset="1" stop-color="${a2}"/></linearGradient>
    <path id="${id}t" d="M 41 120 A 79 79 0 0 1 199 120"/>
    <path id="${id}b" d="M 27 120 A 93 93 0 0 0 213 120"/>
    <clipPath id="${id}c"><circle cx="120" cy="120" r="70"/></clipPath>
  </defs>
  <circle cx="120" cy="120" r="117" fill="url(#${id}r)"/>
  <circle cx="120" cy="120" r="110" fill="#070b18"/>
  <circle cx="120" cy="120" r="106" fill="none" stroke="${a}" stroke-width="1.2" opacity=".6"/>
  <text font-family="Space Grotesk, system-ui, sans-serif" font-weight="700" font-size="${fsTop.toFixed(1)}" letter-spacing="2.4" fill="${IVORY}" text-anchor="middle"><textPath href="#${id}t" startOffset="50%">${esc(top)}</textPath></text>
  <text font-family="Space Grotesk, system-ui, sans-serif" font-weight="600" font-size="${fsBot.toFixed(1)}" letter-spacing="2.4" fill="${a}" text-anchor="middle"><textPath href="#${id}b" startOffset="50%">${esc(bottom)}</textPath></text>
  <path d="M0 -8L2.35 -3.24 7.6 -2.47 3.8 1.24 4.7 6.47 0 4 -4.7 6.47 -3.8 1.24 -7.6 -2.47 -2.35 -3.24Z" fill="${a}" transform="translate(27 120)"/>
  <path d="M0 -8L2.35 -3.24 7.6 -2.47 3.8 1.24 4.7 6.47 0 4 -4.7 6.47 -3.8 1.24 -7.6 -2.47 -2.35 -3.24Z" fill="${a}" transform="translate(213 120)"/>
  <circle cx="120" cy="120" r="72" fill="url(#${id}g)" stroke="${a}" stroke-width="2.5"/>
  <g clip-path="url(#${id}c)">
    <circle cx="72" cy="88" r="1.2" fill="#fff" opacity=".7"/><circle cx="160" cy="80" r="1" fill="#fff" opacity=".6"/>
    <circle cx="150" cy="160" r="1.3" fill="#fff" opacity=".5"/><circle cx="84" cy="150" r=".9" fill="#fff" opacity=".6"/>
    <circle cx="170" cy="120" r="1" fill="#fff" opacity=".5"/><circle cx="96" cy="70" r=".8" fill="#fff" opacity=".7"/>
    <g transform="translate(70 70)">${draw}</g>
  </g>
  <text x="120" y="184" font-family="Space Grotesk, system-ui, sans-serif" font-size="9" letter-spacing="3" fill="${IVORY}" opacity=".55" text-anchor="middle">${esc(year)}</text>
</svg>`;
}
