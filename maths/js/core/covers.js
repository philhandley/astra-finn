// Illustrated sector and game covers (320 x 180), flat and bold, outlined like the widgets.
import { artInner } from './art.js';

const INK = '#1b1e2e';
const O = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
let uid = 0;

function frame(bgA, bgB, body) {
  const id = `cv${++uid}`;
  return `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/></linearGradient></defs>
    <rect width="320" height="180" fill="url(#${id})"/>
    <g opacity=".22" fill="#fff"><circle cx="24" cy="22" r="2"/><circle cx="290" cy="30" r="2.5"/><circle cx="250" cy="150" r="1.8"/><circle cx="60" cy="150" r="2"/><circle cx="150" cy="16" r="1.6"/></g>
    ${body}</svg>`;
}
const icon = (name, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 100})">${artInner(name)}</g>`;
const num = (x, y, t, size = 40, fill = '#fff', stroke = INK) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Lexend, system-ui, sans-serif" font-weight="800" font-size="${size}" fill="${fill}" stroke="${stroke}" stroke-width="${size / 9}" paint-order="stroke" stroke-linejoin="round">${t}</text>`;

const COVERS = {
  launchpad: () => frame('#7dd3fc', '#0284c7', `
    <path d="M0 150 Q160 118 320 150 V180 H0z" fill="#e0f2fe" ${O}/>
    <rect x="182" y="132" width="76" height="14" rx="4" fill="#94a3b8" ${O}/>
    ${icon('rocket', 172, 20, 112)}
    ${[['1', 48, 70], ['2', 94, 46], ['3', 140, 70]].map(([t, x, y]) => `<circle cx="${x}" cy="${y}" r="22" fill="#fff" ${O}/>${num(x, y + 12, t, 30, '#0284c7', '#fff')}`).join('')}
    ${icon('star', 30, 112, 34)}${icon('star', 112, 106, 28)}`),
  number: () => frame('#86efac', '#15803d', `
    ${[0, 1, 2, 3].map(i => `<g transform="translate(${36 + i * 26} 28)"><rect width="20" height="124" rx="4" fill="#22a565" ${O}/>${Array.from({ length: 9 }, (_, k) => `<path d="M2 ${12.4 * (k + 1)}h16" stroke="#15803d" stroke-width="2"/>`).join('')}</g>`).join('')}
    ${Array.from({ length: 7 }, (_, i) => `<rect x="${150 + (i % 2) * 24}" y="${44 + Math.floor(i / 2) * 24}" width="20" height="20" rx="4" fill="#3b82f6" ${O}/>`).join('')}
    <rect x="212" y="54" width="92" height="72" rx="16" fill="#fff" ${O}/>
    <text x="258" y="106" text-anchor="middle" font-family="Lexend, sans-serif" font-weight="800" font-size="46"><tspan fill="#22a565">4</tspan><tspan fill="#3b82f6">7</tspan></text>`),
  bonds: () => frame('#fca5a5', '#dc2626', `
    <path d="M160 58 L96 122 M160 58 L224 122" stroke="${INK}" stroke-width="5"/>
    <circle cx="160" cy="50" r="34" fill="#fff" ${O}/>${num(160, 64, '10', 38, '#1b1e2e', '#fff')}
    <circle cx="96" cy="128" r="30" fill="#fff" ${O}/>
    <circle cx="224" cy="128" r="30" fill="#fff" ${O}/>
    ${[[-10, -9], [10, -9], [-10, 9], [10, 9], [0, 0]].slice(0, 4).map(([dx, dy]) => `<circle cx="${96 + dx}" cy="${128 + dy}" r="8" fill="#ef4444" stroke="#c62828" stroke-width="3"/>`).join('')}
    ${[[-10, -9], [10, -9], [-10, 9], [10, 9], [0, 0]].map(([dx, dy]) => `<circle cx="${224 + dx * 1.15}" cy="${128 + dy * 1.15}" r="7" fill="#fbbf24" stroke="#b7791f" stroke-width="3"/>`).join('')}
    ${num(42, 70, '+', 44)}${num(282, 70, '=', 44)}`),
  blaster: () => frame('#1e3a8a', '#0b1020', `
    <g stroke="#3b82f6" stroke-width="1.5" opacity=".55">${Array.from({ length: 9 }, (_, i) => `<path d="M${160 + (i - 4) * 18} 120 L${160 + (i - 4) * 70} 180"/>`).join('')}<path d="M0 132H320M0 148H320M0 166H320"/></g>
    ${[0, 1, 2].map(r => `<rect x="98" y="${30 + r * 30}" width="124" height="26" rx="8" fill="none" stroke="#fbbf24" stroke-width="3"/>${[0, 1, 2, 3, 4].map(c => `<circle cx="${112 + c * 24}" cy="${43 + r * 30}" r="9" fill="#4f9dff" stroke="#bfdbfe" stroke-width="2"/>`).join('')}`).join('')}
    <rect x="114" y="122" width="92" height="34" rx="10" fill="#0b1020" stroke="#fbbf24" stroke-width="3"/>
    <text x="160" y="146" text-anchor="middle" font-family="Lexend, sans-serif" font-weight="800" font-size="20" fill="#fde68a">3 × 5 = 15</text>`),
  fractions: () => frame('#c4b5fd', '#6d28d9', `
    <g transform="translate(96 90)">
      <path d="M0 0V-62A62 62 0 0 1 62 0z" fill="#8b5cf6" ${O}/><path d="M0 0H62A62 62 0 0 1 0 62z" fill="#ef4444" ${O}/>
      <path d="M0 0V62A62 62 0 0 1 -62 0z" fill="#3b82f6" ${O}/><path d="M0 0H-62A62 62 0 0 1 0 -62z" fill="#fff" ${O}/>
    </g>
    <rect x="196" y="36" width="96" height="108" rx="18" fill="#fff" ${O}/>
    ${num(244, 82, '3', 40, '#6d28d9', '#fff')}<path d="M220 92h48" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>${num(244, 132, '4', 40, '#6d28d9', '#fff')}`),
  measure: () => frame('#fde68a', '#f59e0b', `
    <circle cx="96" cy="84" r="58" fill="#fff" ${O} stroke-width="6"/>
    ${Array.from({ length: 12 }, (_, i) => { const t = (i * Math.PI) / 6; return `<circle cx="${96 + 46 * Math.sin(t)}" cy="${84 - 46 * Math.cos(t)}" r="${i % 3 ? 3 : 5}" fill="${INK}"/>`; }).join('')}
    <path d="M96 84V44" stroke="#3b82f6" stroke-width="7" stroke-linecap="round"/><path d="M96 84l26 14" stroke="#ef4444" stroke-width="9" stroke-linecap="round"/><circle cx="96" cy="84" r="7" fill="${INK}"/>
    <g transform="translate(178 120) rotate(-18)"><rect width="130" height="34" rx="5" fill="#fef3c7" ${O}/>${Array.from({ length: 13 }, (_, i) => `<path d="M${8 + i * 9.5} 0v${i % 5 === 0 ? 14 : 8}" stroke="${INK}" stroke-width="2.5"/>`).join('')}</g>
    <circle cx="246" cy="58" r="26" fill="#d9dde4" stroke="#8b93a3" stroke-width="4"/>${num(246, 66, '10p', 20, '#1b1e2e', '#d9dde4')}`),
  shape: () => frame('#f9a8d4', '#db2777', `
    <path d="M70 140 L112 66 L154 140z" fill="#fbbf24" ${O}/>
    <g transform="translate(176 52)"><path d="M0 22L40 4l40 18v46L40 86 0 68z" fill="#8b5cf6" ${O}/><path d="M0 22l40 18 40-18M40 40v46" fill="none" ${O}/><path d="M0 22L40 4l40 18-40 18z" fill="#c4b5fd" ${O}/></g>
    <circle cx="44" cy="62" r="26" fill="#3b82f6" ${O}/>
    <rect x="262" y="112" width="40" height="40" rx="4" fill="#22a565" ${O}/>`),
  data: () => frame('#99f6e4', '#0f766e', `
    <path d="M40 150H290M40 150V30" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    ${[[64, 80, '#ef4444'], [112, 50, '#fbbf24'], [160, 100, '#3b82f6'], [208, 66, '#8b5cf6']].map(([x, y, c]) => `<rect x="${x}" y="${y}" width="34" height="${150 - y}" rx="4" fill="${c}" ${O}/>`).join('')}
    <g stroke="${INK}" stroke-width="5" stroke-linecap="round"><path d="M262 44v34M274 44v34M286 44v34M298 44v34M256 70l48-20"/></g>`),
  check: () => frame('#a5b4fc', '#4338ca', `
    <path d="M0 150 Q160 120 320 150 V180 H0z" fill="#e0e7ff" ${O}/>
    ${icon('astronaut', 172, 30, 120)}
    <rect x="34" y="40" width="120" height="96" rx="16" fill="#fff" ${O}/>
    <path d="M54 66l10 10 18-20M54 102l10 10 18-20" fill="none" stroke="#22a565" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M96 70h40M96 106h40" stroke="#c3c9d6" stroke-width="8" stroke-linecap="round"/>`),
  quick: () => frame('#bae6fd', '#2563eb', `
    <g transform="translate(60 44) rotate(-5)"><rect x="12" y="12" width="150" height="96" rx="10" fill="#fff" ${O}/><rect x="6" y="6" width="150" height="96" rx="10" fill="#fff" ${O}/><rect width="150" height="96" rx="10" fill="#fff" ${O}/>${num(75, 62, '8×2', 36, '#1b1e2e', '#fff')}</g>
    <rect x="236" y="40" width="58" height="98" rx="12" fill="#3355e0" ${O}/>${[0, 1, 2].map(r => [0, 1].map(c => `<circle cx="${252 + c * 26}" cy="${62 + r * 26}" r="9" fill="#fff" ${O} stroke-width="2.5"/>`).join('')).join('')}`),
  asteroids: () => frame('#312e81', '#0b1020', `
    ${icon('asteroid', 36, 26, 80)}${icon('asteroid', 200, 14, 64)}${icon('asteroid', 220, 96, 56)}
    ${num(76, 74, '15', 26)}${num(232, 52, '7', 24)}${num(248, 130, '20', 22)}
    <path d="M150 168 L120 70" stroke="#fbbf24" stroke-width="5" stroke-linecap="round"/>${icon('rocket', 132, 112, 60)}`),
  tiledock: () => frame('#fed7aa', '#f59e0b', `
    <rect x="70" y="24" width="140" height="140" rx="16" fill="#ffedd5" ${O}/>
    ${[[0, 0, '7'], [1, 0, '8'], [0, 1, '3'], [1, 1, '']].map(([c, r, t]) => `<rect x="${84 + c * 64}" y="${38 + r * 64}" width="54" height="54" rx="10" fill="${t ? '#fff7ed' : '#f59e0b'}" stroke="#ea8a1a" stroke-width="3"/>${t ? num(111 + c * 64, 76 + r * 64, t, 30, '#3b1d5e', '#fff7ed') : ''}`).join('')}
    ${num(246, 80, '15', 26, '#1b1e2e', '#fed7aa')}${num(246, 144, '9', 26, '#1b1e2e', '#fed7aa')}`),
  landing: () => frame('#e0f2fe', '#7dd3fc', `
    <path d="M24 146H296" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    ${[0, 1, 2, 3, 4].map(i => `<path d="M${40 + i * 60} 134v24" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`).join('')}
    ${icon('rocket', 168, 22, 90)}<path d="M206 118 L206 136" stroke="#3b82f6" stroke-width="5" stroke-dasharray="6 6"/>`),
  shoprun: () => frame('#fef3c7', '#fbbf24', `
    <circle cx="90" cy="100" r="40" fill="#c27a3e" stroke="#8a4f22" stroke-width="5"/>${num(90, 112, '2p', 30, '#4a2a10', '#c27a3e')}
    <path d="M210 52l26 12 6 28-17 22h-30l-17-22 6-28z" fill="#d9dde4" stroke="#8b93a3" stroke-width="5"/>${num(210, 96, '50p', 22, '#1b1e2e', '#d9dde4')}
    ${icon('fuel', 132, 20, 64)}`),
};

export function cover(name) {
  return (COVERS[name] || COVERS.check)();
}
