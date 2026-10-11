// Simple space icons drawn in a 100 x 100 box. Used for counting sets, word problems and option tiles.
const IV = '#f3efe6';
const GOLD = '#f2b544';
const CYAN = '#5fd4ff';
const GREY = '#9aa3b2';
const DARK = '#0c1430';

const ICONS = {
  rocket: `<path d="M50 6c11 9 15 21 15 33v30l8 9v12h-9l-4-7H40l-4 7h-9V78l8-9V39c0-12 4-24 15-33z" fill="${IV}"/>
    <path d="M50 6c11 9 15 21 15 33v30H50z" fill="#000" opacity=".12"/>
    <circle cx="50" cy="40" r="8" fill="${CYAN}" stroke="${DARK}" stroke-width="3"/>
    <path d="M35 60l-10 12v12l10-6zM65 60l10 12v12l-10-6z" fill="${GOLD}"/>
    <path d="M42 90q8 14 16 0z" fill="#ff9a52"/>`,
  astronaut: `<path d="M22 96c2-20 13-29 28-29s26 9 28 29z" fill="${IV}"/>
    <rect x="40" y="76" width="20" height="10" rx="2" fill="${GOLD}"/>
    <circle cx="50" cy="40" r="27" fill="${IV}"/>
    <path d="M31 38c0-11 9-17 19-17s19 6 19 17-9 16-19 16-19-5-19-16z" fill="${DARK}"/>
    <path d="M38 31c3-4 7-5 12-5" stroke="${CYAN}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  star: `<path d="M50 6l12 28 30 3-23 20 7 30-26-16-26 16 7-30L8 37l30-3z" fill="${GOLD}" stroke="#ffe0a0" stroke-width="2" stroke-linejoin="round"/>`,
  asteroid: `<path d="M22 38l17-17 22 1 17 14 6 20-10 21-22 11-23-5-14-17-1-17z" fill="#8f949e" stroke="${IV}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="40" cy="44" r="9" fill="#6f747e"/><circle cx="62" cy="64" r="7" fill="#6f747e"/><circle cx="34" cy="68" r="4" fill="#6f747e"/><circle cx="64" cy="38" r="4" fill="#6f747e"/>`,
  planet: `<ellipse cx="50" cy="52" rx="46" ry="12" fill="none" stroke="${IV}" stroke-width="4" opacity=".5" transform="rotate(-18 50 52)"/>
    <circle cx="50" cy="50" r="27" fill="#ff9a52"/>
    <path d="M25 44c9 3 16-2 25 0s16 6 27 2M24 58c11-2 18 3 28 1s14-4 24-2" stroke="#000" stroke-opacity=".18" stroke-width="4" fill="none"/>
    <path d="M4 66 A46 12 -18 0 0 96 37" fill="none" stroke="${IV}" stroke-width="4" transform="rotate(0)"/>`,
  moon: `<circle cx="50" cy="50" r="40" fill="#d4d7de"/>
    <path d="M50 10a40 40 0 0 1 0 80 28 40 0 0 0 0-80z" fill="#000" opacity=".2"/>
    <circle cx="38" cy="38" r="8" fill="#b4b8c1"/><circle cx="60" cy="62" r="10" fill="#b4b8c1"/><circle cx="34" cy="66" r="5" fill="#b4b8c1"/>`,
  sun: `<g stroke="${GOLD}" stroke-width="6" stroke-linecap="round">
    <path d="M50 4v12M50 84v12M4 50h12M84 50h12M17 17l9 9M74 74l9 9M17 83l9-9M74 26l9-9"/></g>
    <circle cx="50" cy="50" r="26" fill="${GOLD}"/><circle cx="50" cy="50" r="18" fill="#ffd27a"/>`,
  alien: `<ellipse cx="50" cy="44" rx="30" ry="32" fill="#6fe3a5"/>
    <path d="M30 10l8 14M70 10l-8 14" stroke="#6fe3a5" stroke-width="5" stroke-linecap="round"/>
    <circle cx="30" cy="9" r="5" fill="${GOLD}"/><circle cx="70" cy="9" r="5" fill="${GOLD}"/>
    <ellipse cx="39" cy="42" rx="8" ry="11" fill="${DARK}"/><ellipse cx="61" cy="42" rx="8" ry="11" fill="${DARK}"/>
    <circle cx="41" cy="38" r="3" fill="#fff"/><circle cx="63" cy="38" r="3" fill="#fff"/>
    <path d="M40 60q10 8 20 0" stroke="${DARK}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M30 74q20 22 40 0" fill="#6fe3a5"/>`,
  satellite: `<rect x="38" y="36" width="24" height="28" rx="3" fill="${IV}"/>
    <rect x="4" y="40" width="30" height="20" fill="${CYAN}" stroke="${IV}" stroke-width="2"/>
    <rect x="66" y="40" width="30" height="20" fill="${CYAN}" stroke="${IV}" stroke-width="2"/>
    <path d="M14 40v20M24 40v20M76 40v20M86 40v20" stroke="${DARK}" stroke-width="2"/>
    <path d="M50 36V22" stroke="${IV}" stroke-width="3"/><circle cx="50" cy="18" r="6" fill="${GOLD}"/>`,
  ufo: `<ellipse cx="50" cy="42" rx="18" ry="16" fill="${CYAN}" opacity=".85"/>
    <ellipse cx="50" cy="58" rx="44" ry="14" fill="${GREY}"/><ellipse cx="50" cy="54" rx="44" ry="10" fill="#c9ced6"/>
    <circle cx="26" cy="58" r="4" fill="${GOLD}"/><circle cx="50" cy="62" r="4" fill="${GOLD}"/><circle cx="74" cy="58" r="4" fill="${GOLD}"/>`,
  boot: `<path d="M28 10h30v48l26 10c8 3 10 10 10 20v6H18V18c0-5 4-8 10-8z" fill="${IV}"/>
    <path d="M18 84h76v10H18z" fill="${GREY}"/><path d="M28 26h30M28 40h30" stroke="${GREY}" stroke-width="4"/>`,
  helmet: `<circle cx="50" cy="48" r="38" fill="${IV}"/>
    <path d="M24 46c0-15 11-24 26-24s26 9 26 24-11 22-26 22-26-7-26-22z" fill="${DARK}"/>
    <path d="M33 36c4-6 10-8 17-8" stroke="${CYAN}" stroke-width="5" stroke-linecap="round" fill="none"/>
    <rect x="30" y="84" width="40" height="10" rx="4" fill="${GOLD}"/>`,
  crystal: `<path d="M50 6l22 26-22 62-22-62z" fill="#b46cff"/><path d="M50 6l22 26H28z" fill="#e2d4ff"/>
    <path d="M50 32v62" stroke="#e2d4ff" stroke-width="2" opacity=".6"/>`,
  fuel: `<rect x="22" y="22" width="56" height="72" rx="8" fill="#ff6b57"/>
    <rect x="38" y="8" width="24" height="16" rx="3" fill="${GREY}"/>
    <rect x="30" y="40" width="40" height="30" rx="4" fill="${IV}"/>
    <path d="M50 46c6 8 8 12 8 15a8 8 0 0 1-16 0c0-3 2-7 8-15z" fill="#ff9a52"/>`,
  apple: `<path d="M50 30c-10-8-34-6-34 22 0 22 16 42 26 42 4 0 6-3 8-3s4 3 8 3c10 0 26-20 26-42 0-28-24-30-34-22z" fill="#ff6b57"/>
    <path d="M50 30c0-10 4-18 12-22" stroke="#7a4b26" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M54 18c10-8 22-4 22-4s-6 12-20 10z" fill="#6fe3a5"/>`,
  cookie: `<circle cx="50" cy="50" r="40" fill="#d9a066"/><circle cx="50" cy="50" r="40" fill="none" stroke="#b07a42" stroke-width="4"/>
    <circle cx="36" cy="38" r="6" fill="#5a3418"/><circle cx="62" cy="34" r="5" fill="#5a3418"/><circle cx="58" cy="62" r="6" fill="#5a3418"/><circle cx="34" cy="62" r="4" fill="#5a3418"/>`,
  robot: `<rect x="24" y="30" width="52" height="44" rx="10" fill="#c9ced6"/>
    <rect x="34" y="42" width="12" height="12" rx="3" fill="${CYAN}"/><rect x="54" y="42" width="12" height="12" rx="3" fill="${CYAN}"/>
    <rect x="38" y="62" width="24" height="5" rx="2" fill="${DARK}"/><path d="M50 30V16" stroke="#c9ced6" stroke-width="4"/>
    <circle cx="50" cy="12" r="6" fill="#ff6b57"/><rect x="34" y="76" width="10" height="18" rx="3" fill="${GREY}"/><rect x="56" y="76" width="10" height="18" rx="3" fill="${GREY}"/>`,
  flag: `<path d="M24 8v88" stroke="${IV}" stroke-width="6" stroke-linecap="round"/>
    <path d="M27 12h50l-10 16 10 16H27z" fill="${GOLD}"/><circle cx="46" cy="28" r="6" fill="${DARK}"/>`,
  comet: `<path d="M8 20l52 40" stroke="${CYAN}" stroke-width="12" stroke-linecap="round" opacity=".35"/>
    <path d="M18 14l44 42" stroke="${CYAN}" stroke-width="6" stroke-linecap="round" opacity=".6"/>
    <circle cx="68" cy="64" r="20" fill="${IV}"/><circle cx="64" cy="60" r="7" fill="${CYAN}" opacity=".5"/>`,
  crater: `<ellipse cx="50" cy="60" rx="44" ry="24" fill="#9aa3b2"/><ellipse cx="50" cy="56" rx="30" ry="14" fill="#6f747e"/>
    <ellipse cx="50" cy="52" rx="22" ry="8" fill="#575c66"/>`,
  dot: `<circle cx="50" cy="50" r="40" fill="${CYAN}"/>`,
};

export const artNames = Object.keys(ICONS);

// Inner SVG markup for embedding inside another SVG: wrap in <g transform="translate(x y) scale(s)">.
export function artInner(name) {
  return ICONS[name] || ICONS.star;
}

export function art(name, size = 64, extra = '') {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true" ${extra}>${artInner(name)}</svg>`;
}
