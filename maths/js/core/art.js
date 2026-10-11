// Simple icons in a flat "sticker" style: bold fills with a dark outline, so they read on white and on dark.
// Drawn in a 100 x 100 box.
const O = 'stroke="#1b1e2e" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';
const W = '#ffffff';
const GREY = '#c9cfdb';
const DARK = '#1b1e2e';
const RED = '#ef4444', YEL = '#fbbf24', BLUE = '#3b82f6', GREEN = '#22c55e', ORANGE = '#f59e0b', PURPLE = '#8b5cf6', PINK = '#ec4899', TEAL = '#14b8a6';

const ICONS = {
  rocket: `<path d="M50 6c11 9 15 21 15 33v30l9 10v12H64l-4-7H40l-4 7H26V79l9-10V39c0-12 4-24 15-33z" fill="${W}" ${O}/>
    <circle cx="50" cy="40" r="8" fill="${BLUE}" ${O}/>
    <path d="M35 60l-9 11v13l9-6zM65 60l9 11v13l-9-6z" fill="${RED}" ${O}/>
    <path d="M42 91q8 12 16 0z" fill="${ORANGE}" ${O}/>`,
  astronaut: `<path d="M22 96c2-20 13-29 28-29s26 9 28 29z" fill="${W}" ${O}/>
    <rect x="40" y="76" width="20" height="10" rx="2" fill="${ORANGE}" ${O}/>
    <circle cx="50" cy="40" r="27" fill="${W}" ${O}/>
    <path d="M31 39c0-11 9-17 19-17s19 6 19 17-9 16-19 16-19-5-19-16z" fill="${BLUE}" ${O}/>
    <path d="M38 33c3-4 7-5 12-5" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  star: `<path d="M50 6l12 28 30 3-23 20 7 30-26-16-26 16 7-30L8 37l30-3z" fill="${YEL}" ${O}/>`,
  asteroid: `<path d="M22 38l17-17 22 1 17 14 6 20-10 21-22 11-23-5-14-17-1-17z" fill="#a8adb9" ${O}/>
    <circle cx="40" cy="44" r="8" fill="#7d8392"/><circle cx="62" cy="64" r="7" fill="#7d8392"/><circle cx="34" cy="68" r="4" fill="#7d8392"/><circle cx="64" cy="38" r="4" fill="#7d8392"/>`,
  planet: `<circle cx="50" cy="50" r="27" fill="${ORANGE}" ${O}/>
    <path d="M26 44c9 3 16-2 25 0s16 6 26 2" stroke="#b45309" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M7 62c-5-9 13-20 43-26s49-1 50 9" fill="none" stroke="${DARK}" stroke-width="10" stroke-linecap="round"/>
    <path d="M7 62c-5-9 13-20 43-26s49-1 50 9" fill="none" stroke="${YEL}" stroke-width="4" stroke-linecap="round"/>`,
  moon: `<circle cx="50" cy="50" r="40" fill="#e5e7eb" ${O}/>
    <circle cx="38" cy="38" r="8" fill="#c4c8d0"/><circle cx="60" cy="62" r="10" fill="#c4c8d0"/><circle cx="34" cy="66" r="5" fill="#c4c8d0"/>`,
  sun: `<g stroke="${DARK}" stroke-width="9" stroke-linecap="round"><path d="M50 6v12M50 82v12M6 50h12M82 50h12M18 18l9 9M73 73l9 9M18 82l9-9M73 27l9-9"/></g>
    <g stroke="${YEL}" stroke-width="4" stroke-linecap="round"><path d="M50 6v12M50 82v12M6 50h12M82 50h12M18 18l9 9M73 73l9 9M18 82l9-9M73 27l9-9"/></g>
    <circle cx="50" cy="50" r="24" fill="${YEL}" ${O}/>`,
  alien: `<path d="M30 10l8 14M70 10l-8 14" stroke="${DARK}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="30" cy="9" r="6" fill="${YEL}" ${O}/><circle cx="70" cy="9" r="6" fill="${YEL}" ${O}/>
    <path d="M30 74q20 24 40 0" fill="${GREEN}" ${O}/>
    <ellipse cx="50" cy="44" rx="30" ry="31" fill="${GREEN}" ${O}/>
    <ellipse cx="39" cy="42" rx="8" ry="10" fill="${DARK}"/><ellipse cx="61" cy="42" rx="8" ry="10" fill="${DARK}"/>
    <circle cx="41" cy="38" r="3" fill="#fff"/><circle cx="63" cy="38" r="3" fill="#fff"/>
    <path d="M41 60q9 7 18 0" stroke="${DARK}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  satellite: `<rect x="4" y="38" width="30" height="24" rx="2" fill="${BLUE}" ${O}/><rect x="66" y="38" width="30" height="24" rx="2" fill="${BLUE}" ${O}/>
    <path d="M14 38v24M24 38v24M76 38v24M86 38v24" stroke="${DARK}" stroke-width="2.5"/>
    <rect x="36" y="34" width="28" height="32" rx="4" fill="${W}" ${O}/>
    <path d="M50 34V22" stroke="${DARK}" stroke-width="4"/><circle cx="50" cy="17" r="6" fill="${RED}" ${O}/>`,
  ufo: `<ellipse cx="50" cy="44" rx="18" ry="17" fill="#bae6fd" ${O}/>
    <ellipse cx="50" cy="58" rx="44" ry="14" fill="${PURPLE}" ${O}/>
    <circle cx="26" cy="59" r="4" fill="${YEL}"/><circle cx="50" cy="63" r="4" fill="${YEL}"/><circle cx="74" cy="59" r="4" fill="${YEL}"/>`,
  boot: `<path d="M28 10h30v48l26 10c8 3 10 10 10 20v4H18V18c0-5 4-8 10-8z" fill="${W}" ${O}/>
    <path d="M18 84h76v10H18z" fill="#9aa1b1" ${O}/><path d="M28 28h30M28 42h30" stroke="${DARK}" stroke-width="3"/>`,
  helmet: `<circle cx="50" cy="46" r="38" fill="${W}" ${O}/>
    <path d="M24 46c0-15 11-24 26-24s26 9 26 24-11 22-26 22-26-7-26-22z" fill="${BLUE}" ${O}/>
    <path d="M34 36c4-6 10-8 17-8" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/>
    <rect x="30" y="84" width="40" height="10" rx="4" fill="${ORANGE}" ${O}/>`,
  crystal: `<path d="M50 6l22 26-22 62-22-62z" fill="${PURPLE}" ${O}/><path d="M28 32h44L50 6z" fill="#c4b5fd" ${O}/>`,
  fuel: `<rect x="38" y="6" width="24" height="16" rx="3" fill="#9aa1b1" ${O}/>
    <rect x="22" y="20" width="56" height="74" rx="9" fill="${RED}" ${O}/>
    <rect x="31" y="40" width="38" height="32" rx="5" fill="${W}" ${O}/>
    <path d="M50 45c6 8 8 12 8 15a8 8 0 0 1-16 0c0-3 2-7 8-15z" fill="${ORANGE}" stroke="${DARK}" stroke-width="3"/>`,
  apple: `<path d="M50 30c0-10 4-18 12-22" stroke="#7a4b26" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M54 18c10-8 22-4 22-4s-6 12-20 10z" fill="${GREEN}" ${O}/>
    <path d="M50 30c-10-8-34-6-34 22 0 22 16 42 26 42 4 0 6-3 8-3s4 3 8 3c10 0 26-20 26-42 0-28-24-30-34-22z" fill="${RED}" ${O}/>`,
  cookie: `<circle cx="50" cy="50" r="40" fill="#e0a96d" ${O}/>
    <circle cx="36" cy="38" r="6" fill="#6b3a1f"/><circle cx="62" cy="34" r="5" fill="#6b3a1f"/><circle cx="58" cy="62" r="6" fill="#6b3a1f"/><circle cx="34" cy="62" r="4" fill="#6b3a1f"/>`,
  robot: `<path d="M50 30V16" stroke="${DARK}" stroke-width="5"/><circle cx="50" cy="12" r="7" fill="${RED}" ${O}/>
    <rect x="34" y="74" width="11" height="20" rx="3" fill="#9aa1b1" ${O}/><rect x="55" y="74" width="11" height="20" rx="3" fill="#9aa1b1" ${O}/>
    <rect x="22" y="28" width="56" height="48" rx="11" fill="#d7dce6" ${O}/>
    <rect x="33" y="40" width="13" height="13" rx="3" fill="${BLUE}" ${O}/><rect x="54" y="40" width="13" height="13" rx="3" fill="${BLUE}" ${O}/>
    <rect x="38" y="62" width="24" height="5" rx="2" fill="${DARK}"/>`,
  flag: `<path d="M24 8v88" stroke="${DARK}" stroke-width="7" stroke-linecap="round"/>
    <path d="M27 12h50l-10 16 10 16H27z" fill="${YEL}" ${O}/><circle cx="46" cy="28" r="6" fill="${DARK}"/>`,
  comet: `<path d="M10 18l50 42" stroke="#bae6fd" stroke-width="14" stroke-linecap="round"/>
    <path d="M20 14l42 40" stroke="${BLUE}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="68" cy="64" r="20" fill="${W}" ${O}/><circle cx="64" cy="60" r="7" fill="#bae6fd"/>`,
  crater: `<ellipse cx="50" cy="60" rx="44" ry="24" fill="#c4c8d0" ${O}/><ellipse cx="50" cy="56" rx="28" ry="13" fill="#9aa1b1" ${O}/>`,
  dot: `<circle cx="50" cy="50" r="40" fill="${BLUE}"/>`,
};
void PINK; void TEAL; void GREY;

export const artNames = Object.keys(ICONS);

// Inner SVG markup for embedding inside another SVG: wrap in <g transform="translate(x y) scale(s)">.
export function artInner(name) {
  return ICONS[name] || ICONS.star;
}

export function art(name, size = 64, extra = '') {
  return `<svg viewBox="-2 -2 104 104" width="${size}" height="${size}" aria-hidden="true" ${extra}>${artInner(name)}</svg>`;
}
