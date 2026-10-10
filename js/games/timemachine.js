/*
 * The Metal Time Machine  (js/games/timemachine.js)
 *
 * Pick a place (Seaside on Earth, the Moon, Mars, Venus, Deep space) and a thing
 * (a steel bike or a robot rover), then drag the giant time slider from 1 day to
 * 1 million years. The object is drawn in layered SVG; rust, dust, pits, paint
 * fade, sand-blasting, heat glow, acid crust and crumbling are separate layers
 * whose strength is interpolated continuously along the slider. A one-sentence
 * "why" caption is shown and read aloud (debounced) for every place and time.
 *
 * ctx.data schema (everything optional; built-in defaults are used otherwise):
 * {
 *   "startPlace":  "seaside" | "moon" | "mars" | "venus" | "space",   // default "seaside"
 *   "startObject": "bike" | "rover",                                   // default "bike"
 *   "completeAfter": 3,                       // distinct places tried before ctx.complete()
 *   "places": {
 *     "<placeId>": {
 *       "name": "Mars", "sub": "the red planet",
 *       "fact": "Opportunity: built for 90 days, lasted about 15 years",
 *       "captions": [ "1 day", "1 year", "10 years", "100 years", "1,000 years", "1 million years" ]
 *          // each caption is a string or { "bike": "...", "rover": "..." }; {thing} becomes "bike"/"rover"
 *     }
 *   },
 *   "objects": { "bike": { "name": "Steel bike" }, "rover": { "name": "Robot rover" } },
 *   "stops": [ "1 day", "1 year", "10 years", "100 years", "1,000 years", "1 million years" ]
 * }
 *
 * Debug URL params (harmless): debugPlace=<placeId>, debugTime=0..5 (may be fractional),
 * debugObject=bike|rover.
 */

const PLACES = ['seaside', 'moon', 'mars', 'venus', 'space'];
const OBJECTS = ['bike', 'rover'];

const DEFAULTS = {
  startPlace: 'seaside',
  startObject: 'bike',
  completeAfter: 3,
  stops: ['1 day', '1 year', '10 years', '100 years', '1,000 years', '1 million years'],
  objects: { bike: { name: 'Steel bike' }, rover: { name: 'Robot rover' } },
  places: {
    seaside: {
      name: 'Seaside', sub: 'on Earth', in: 'at the seaside',
      fact: 'Rust needs water and oxygen.',
      outcome: 'rusted away',
      conds: [['water', 'Water', 1], ['air', 'Oxygen', 1], ['salt', 'Salty spray', 1]],
      captions: [
        'Rust needs water and oxygen, and salty sea air has lots of both. Tiny orange spots are starting already!',
        'After a year of salty sea spray, orange rust is spreading over the {thing}.',
        'Rust eats into the steel, making it flaky and weak.',
        'After 100 years the rusty {thing} is crumbling to bits!',
        'Only a few rusty lumps are left in the sand.',
        'The {thing} is gone! Its rust has mixed back into the sand and rocks.',
      ],
    },
    moon: {
      name: 'The Moon', sub: 'no air at all', in: 'on the Moon',
      fact: 'Apollo landers are still there after more than 50 years.',
      outcome: 'still there, just dusty and pitted',
      conds: [['water', 'No water', 0], ['air', 'No air', 0], ['speck', 'Space dust specks', 1]],
      captions: [
        'The Moon has no air and no water, so nothing can rust!',
        'Fine Moon dust sticks to the {thing} like grey powder.',
        'Tiny specks of space dust zoom in faster than a rocket and make little pits.',
        "The Apollo landers have been on the Moon for over 50 years, and they're still there!",
        'Slowly, more pits and dust build up, but the metal stays strong.',
        'Still there after a million years! Things on the Moon can last for millions of years.',
      ],
    },
    mars: {
      name: 'Mars', sub: 'the red planet', in: 'on Mars',
      fact: 'The Opportunity rover was built for 90 days and lasted about 15 years.',
      factRover2: "Curiosity's aluminium wheels got holes from sharp rocks.",
      outcome: 'dusty, faded and half buried',
      conds: [['water', 'Hardly any water', 0], ['air', 'Very thin air', 0], ['wind', 'Dusty wind', 1]],
      captions: [
        'Mars has very thin air and hardly any water, so rust is super slow here.',
        'Red Mars dust settles on everything, like a dusty old shelf.',
        { bike: 'The Opportunity rover was built to last 90 days, and it kept going for about 15 years!', rover: 'Sharp rocks poke holes in the wheels. That really happened to the Curiosity rover!' },
        'Windy sand scrubs off the paint like sandpaper, and the colours fade.',
        'Sand dunes are slowly creeping over the faded {thing}.',
        "After a million years it's sandblasted and half buried, but bits of it are still there.",
      ],
    },
    venus: {
      name: 'Venus', sub: 'super hot', in: 'on Venus',
      fact: 'Venera 13 lasted 127 minutes!',
      outcome: 'cooked and crumbled by acid',
      status: { rover: 'Stopped working after about 2 hours', bike: 'Too hot! The tyres melted.' },
      conds: [['heat', 'About 465 °C', 1], ['acid', 'Acid clouds', 1], ['air', 'No oxygen', 0]],
      captions: [
        { rover: 'Venus is about 465 °C, way hotter than a kitchen oven! The rover stopped working after about 2 hours.', bike: 'Venus is about 465 °C, way hotter than a kitchen oven! The tyres melt, but the steel is still there.' },
        'Venus has acid clouds, and hot gases slowly eat into the metal.',
        "The air here is so thick and heavy, it's like being deep under the sea.",
        'After 100 years the {thing} is crusty and covered in yellow stains.',
        'Heat and acid have slowly eaten big holes in the metal.',
        'After a million years only a crumbly crust is left.',
      ],
    },
    space: {
      name: 'Deep space', sub: 'far, far away', in: 'in deep space',
      fact: 'Voyager 1 has been flying since 1977!',
      outcome: 'almost like new',
      conds: [['water', 'No water', 0], ['air', 'No air', 0], ['wind', 'No wind', 0]],
      captions: [
        'Deep space has no air, no water and no wind, so the {thing} stays shiny.',
        'Nothing to rust it and no dust storms, so it looks almost brand new.',
        "Voyager 1 has been flying through space since 1977, and it's still working!",
        "A few tiny specks of space dust make little pits, but that's all.",
        "Clean metal touching in space can even stick together. It's called cold welding!",
        "After a million years it's still there, drifting between the stars.",
      ],
    },
  },
};

/* How each place changes things at the six stops (interpolated in between). */
const FX = {
  seaside: { rust: [0.05, 0.36, 0.64, 0.9, 1, 1], crumble: [0, 0, 0.14, 0.52, 0.86, 1], dust: [0, 0.08, 0.14, 0.2, 0.25, 0.25], fade: [0, 0.25, 0.5, 0.75, 0.9, 1], perish: [0, 0.25, 0.65, 1, 1, 1] },
  moon: { dust: [0.03, 0.16, 0.3, 0.45, 0.6, 0.82], pits: [0, 0.05, 0.16, 0.32, 0.56, 0.9], fade: [0, 0.15, 0.35, 0.55, 0.75, 0.9], perish: [0, 0.1, 0.3, 0.5, 0.7, 0.9] },
  mars: { dust: [0.06, 0.36, 0.55, 0.68, 0.8, 0.9], chips: [0, 0.08, 0.3, 0.56, 0.8, 1], fade: [0, 0.22, 0.45, 0.7, 0.85, 1], rust: [0, 0, 0.02, 0.05, 0.1, 0.18], holes: [0, 0.12, 0.45, 0.7, 0.85, 1], buried: [0, 0, 0.03, 0.12, 0.38, 0.62], perish: [0, 0.12, 0.32, 0.62, 0.86, 1] },
  venus: { glow: [1, 1, 1, 1, 1, 1], acid: [0.04, 0.26, 0.46, 0.7, 0.9, 1], crumble: [0, 0, 0.05, 0.22, 0.52, 0.86], fade: [0.65, 0.85, 0.95, 1, 1, 1], melt: [1, 1, 1, 1, 1, 1], pits: [0, 0.1, 0.2, 0.35, 0.5, 0.6] },
  space: { pits: [0, 0, 0.02, 0.06, 0.12, 0.24], fade: [0, 0.03, 0.06, 0.1, 0.16, 0.3], perish: [0, 0.02, 0.05, 0.1, 0.2, 0.4] },
};
const LOOK = {
  //           paint fade target (bike)  body fade target (rover)  tint                 shadow: k (length), m (drop), opacity, blur
  seaside: { fadeTo: '#9fb3bf', bodyTo: '#d8d2c4', tint: ['#4a5a66', '#ffffff', 0.22], shadow: [-0.7, 0.07, 0.3, 4], dustTex: 'sand', remnant: 'rust' },
  moon: { fadeTo: '#c7cdd2', bodyTo: '#f2f2ee', tint: ['#ffffff', '#3a3d44', 0.62], shadow: [1.5, 0.1, 0.72, 1.2], dustTex: 'moon' },
  mars: { fadeTo: '#b98f78', bodyTo: '#d9b79c', tint: ['#7a4a32', '#ffd9b0', 0.4], shadow: [-0.9, 0.08, 0.42, 3], dustTex: 'mars' },
  venus: { fadeTo: '#4e3a2e', bodyTo: '#6d5444', tint: ['#ffb060', '#8a3a12', 0.55], shadow: [0.15, 0.05, 0.32, 9], dustTex: 'mars', remnant: 'acid' },
  space: { fadeTo: '#4f86b0', bodyTo: '#e2e4e8', tint: ['#141824', '#ffffff', 0.7], shadow: null, dustTex: 'moon' },
};

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const CSS = `
.g-timemachine{position:absolute;inset:0;display:grid;overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--font-body);user-select:none;-webkit-user-select:none}
.g-timemachine [hidden]{display:none!important}
.g-timemachine.land{grid-template-columns:var(--tm-side-w,290px) minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
.g-timemachine.port{grid-template-rows:auto minmax(0,1fr);grid-template-columns:minmax(0,1fr)}
.g-timemachine .tm-side{display:flex;flex-direction:column;gap:8px;padding:12px 10px 12px 12px;min-height:0;overflow:auto}
.g-timemachine.port .tm-side{padding:10px 12px 0}
.g-timemachine .tm-h{font-family:var(--font-display);font-weight:600;font-size:18px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);padding:2px 4px}
.g-timemachine .tm-places{display:flex;flex-direction:column;gap:8px}
.g-timemachine.port .tm-places{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))}
.g-timemachine.port.tiny .tm-places{gap:6px}
.g-timemachine.port.tiny .tm-place{padding:3px 3px 6px;border-radius:12px;gap:4px}
.g-timemachine.port.tiny .tm-place svg{border-radius:8px}
.g-timemachine.port.tiny .tm-place b{font-size:18px;line-height:1.05}
.g-timemachine.port.short .tm-h{display:none}
.g-timemachine.port.short .tm-objbtn{min-height:56px}
.g-timemachine.port.short .tm-main{gap:8px}
.g-timemachine.port.short .tm-caption{min-height:56px;padding:6px 8px 6px 14px}
.g-timemachine.port.short .tm-why{font-size:19px}
.g-timemachine.tiny .tm-fact{max-width:58%;font-size:18px;padding:8px 10px}
.g-timemachine.tiny.short .tm-fact,.g-timemachine.tiny.short .tm-conds{display:none}
.g-timemachine.port.vshort .tm-place .tx{display:none}
.g-timemachine.port.vshort .tm-place{padding:3px}
.g-timemachine.sparse .tm-lab{visibility:hidden}
.g-timemachine.sparse .tm-lab.show{visibility:visible}
.g-timemachine.sparse .tm-lab:first-child{transform:translateX(-30%)}
.g-timemachine.sparse .tm-lab:last-child{transform:translateX(-70%)}
.g-timemachine.nosub .tm-place small{display:none}
.g-timemachine.nosub .tm-place b{font-size:19px}
.g-timemachine.nosub .tm-place svg{aspect-ratio:4/3}
.g-timemachine .tm-place .tx{flex:1}
.g-timemachine.tiny .tm-cond{min-height:30px;padding:0 10px 0 6px}
.g-timemachine.tiny .tm-when{font-size:26px}
.g-timemachine .tm-place{appearance:none;cursor:pointer;display:flex;align-items:center;gap:12px;min-height:56px;height:var(--tm-pl-h,80px);padding:6px 12px 6px 6px;border-radius:16px;border:2px solid var(--line);background:rgba(255,255,255,.03);color:var(--ink);text-align:left;transition:border-color .25s,background .25s,transform .15s;min-width:0}
.g-timemachine .tm-place:active{transform:scale(.97)}
.g-timemachine .tm-place svg{height:100%;width:auto;aspect-ratio:3/2;flex:none;border-radius:11px;display:block}
.g-timemachine .tm-place .tx{display:flex;flex-direction:column;min-width:0}
.g-timemachine .tm-place b{font-family:var(--font-display);font-weight:600;font-size:21px;line-height:1.1;white-space:nowrap}
.g-timemachine .tm-place small{font-size:18px;color:var(--ink-3);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.g-timemachine .tm-place.on{border-color:var(--gold);background:rgba(242,181,68,.1)}
.g-timemachine .tm-place.on small{color:var(--gold-2)}
.g-timemachine .tm-place .seen{width:12px;height:12px;border-radius:50%;background:var(--green);margin-left:auto;flex:none;opacity:0;transition:opacity .3s}
.g-timemachine .tm-place.visited .seen{opacity:.9}
.g-timemachine.port .tm-place{flex-direction:column;align-items:stretch;height:auto;padding:5px 5px 8px;gap:6px;text-align:center}
.g-timemachine.port .tm-place svg{width:100%;height:auto}
.g-timemachine.port .tm-place .tx{align-items:center}
.g-timemachine.port .tm-place small,.g-timemachine.port .tm-place .seen{display:none}
.g-timemachine.port .tm-place b{font-size:19px;white-space:normal}
.g-timemachine .tm-objs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.g-timemachine .tm-objbtn{appearance:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;min-height:64px;padding:4px 8px;min-width:0;text-align:left;border-radius:16px;border:2px solid var(--line);background:rgba(255,255,255,.03);color:var(--ink);font-family:var(--font-display);font-weight:600;font-size:19px;line-height:1.1;transition:border-color .25s,background .25s,transform .15s}
.g-timemachine .tm-objbtn:active{transform:scale(.97)}
.g-timemachine .tm-objbtn svg{width:44px;height:32px;flex:none}
.g-timemachine .tm-objbtn.on{border-color:var(--cyan);background:rgba(95,212,255,.1)}
.g-timemachine .tm-main{display:grid;grid-template-rows:minmax(0,1fr) auto auto;gap:10px;padding:12px 12px 10px 4px;min-height:0;min-width:0}
.g-timemachine.port .tm-main{padding:10px 12px 10px}
.g-timemachine .tm-scene{position:relative;border-radius:20px;overflow:hidden;border:1px solid var(--line);background:#05070d;min-height:110px}
.g-timemachine .tm-svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.g-timemachine .tm-hud{position:absolute;left:16px;top:12px;display:flex;flex-direction:column;gap:2px;pointer-events:none;max-width:54%}
.g-timemachine .tm-where{font-family:var(--font-display);font-weight:600;font-size:19px;letter-spacing:.14em;text-transform:uppercase;color:rgba(243,239,230,.9);text-shadow:0 1px 10px rgba(0,0,0,.6)}
.g-timemachine .tm-when{font-family:var(--font-display);font-weight:700;font-size:clamp(28px,2.8vw,38px);line-height:1.05;color:var(--gold-2);text-shadow:0 2px 14px rgba(0,0,0,.65);white-space:nowrap}
.g-timemachine .tm-conds{position:absolute;left:12px;bottom:12px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;pointer-events:none}
.g-timemachine .tm-cond{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px 0 8px;border-radius:999px;font-size:18px;background:rgba(5,7,13,.62);border:1px solid rgba(255,255,255,.16);color:var(--ink);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);white-space:nowrap}
.g-timemachine .tm-cond svg{width:20px;height:20px;flex:none}
.g-timemachine .tm-cond.no{color:var(--ink-2)}
.g-timemachine .tm-cond.yes{border-color:rgba(242,181,68,.55)}
.g-timemachine .tm-fact{position:absolute;right:12px;top:12px;max-width:min(300px,42%);padding:10px 14px;border-radius:16px;font-size:19px;line-height:1.3;pointer-events:none}
.g-timemachine .tm-fact .eyebrow{font-size:18px;color:var(--gold)}
.g-timemachine .tm-status{align-self:flex-start;margin-top:6px;display:inline-flex;align-items:center;gap:10px;padding:7px 16px 7px 12px;border-radius:999px;background:rgba(40,8,4,.78);border:1px solid rgba(255,107,87,.65);color:#ffe2dc;font-family:var(--font-display);font-weight:600;font-size:19px;line-height:1.2;pointer-events:none}
.g-timemachine .tm-status i{width:12px;height:12px;border-radius:50%;background:var(--red);box-shadow:0 0 10px var(--red)}
.g-timemachine .tm-caption{display:flex;align-items:center;gap:14px;padding:10px 12px 10px 18px;border-radius:18px;min-height:64px}
.g-timemachine .tm-why{flex:1;margin:0;font-size:21px;line-height:1.35}
.g-timemachine .tm-caption .speak-btn{width:56px;height:56px}
.g-timemachine .tm-slider{position:relative;height:var(--tm-sl-h,118px);touch-action:none;cursor:pointer;outline:none;margin:0 6px}
.g-timemachine .tm-slider:focus-visible .tm-thumb{box-shadow:0 0 0 4px var(--cyan),0 8px 24px rgba(0,0,0,.5)}
.g-timemachine .tm-track{position:absolute;left:var(--tm-inset,40px);right:var(--tm-inset,40px);top:30px;height:14px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid var(--line)}
.g-timemachine .tm-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,var(--gold-2),var(--gold));box-shadow:0 0 16px rgba(242,181,68,.45)}
.g-timemachine .tm-stop{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#2a3148;border:2px solid rgba(255,255,255,.35)}
.g-timemachine .tm-stop.past{background:var(--gold-2);border-color:var(--gold-2)}
.g-timemachine .tm-thumb{position:absolute;top:37px;left:0;width:var(--tm-thumb,72px);height:var(--tm-thumb,72px);margin:calc(var(--tm-thumb,72px) / -2) 0 0 calc(var(--tm-thumb,72px) / -2);border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--gold-2),var(--gold) 70%);box-shadow:0 8px 24px rgba(0,0,0,.5),0 0 0 6px rgba(242,181,68,.18);display:grid;place-items:center;color:#1a1205;transition:transform .15s}
.g-timemachine .tm-slider.drag .tm-thumb{transform:scale(1.08)}
.g-timemachine .tm-thumb svg{width:38px;height:38px}
.g-timemachine .tm-thumb.spin svg{animation:tm-spin .5s ease}
@keyframes tm-spin{from{transform:rotate(0)}to{transform:rotate(180deg)}}
.g-timemachine .tm-labels{position:absolute;left:var(--tm-inset,40px);right:var(--tm-inset,40px);top:78px}
.g-timemachine .tm-lab{position:absolute;top:0;transform:translateX(-50%);font-family:var(--font-display);font-weight:600;font-size:18px;line-height:1.1;color:var(--ink-3);text-align:center;width:var(--tm-lab-w,130px);transition:color .2s}
.g-timemachine .tm-lab.on{color:var(--gold-2)}
.g-timemachine .tm-flash{opacity:0;pointer-events:none}
.g-timemachine .tm-flash.go{animation:tm-flash .55s ease-out}
@keyframes tm-flash{0%{opacity:.55}100%{opacity:0}}
.g-timemachine .tm-bgnew{animation:tm-fade .55s ease}
@keyframes tm-fade{from{opacity:0}to{opacity:1}}
.g-timemachine .tm-waves{animation:tm-waves 7s linear infinite}
@keyframes tm-waves{from{transform:translateX(0)}to{transform:translateX(-200px)}}
.g-timemachine .tm-foam{animation:tm-foam 4.5s ease-in-out infinite}
@keyframes tm-foam{0%,100%{opacity:.75;transform:translateY(0)}50%{opacity:.35;transform:translateY(6px)}}
.g-timemachine .tm-clouds{animation:tm-clouds 60s linear infinite alternate}
@keyframes tm-clouds{from{transform:translateX(-30px)}to{transform:translateX(40px)}}
.g-timemachine .tm-drift{animation:tm-drift 6s linear infinite}
@keyframes tm-drift{from{transform:translateX(-500px)}to{transform:translateX(0)}}
.g-timemachine .tm-shimmer{animation:tm-shimmer 3.2s ease-in-out infinite}
@keyframes tm-shimmer{0%{transform:translateY(20px);opacity:0}40%{opacity:.5}100%{transform:translateY(-60px);opacity:0}}
.g-timemachine .tm-haze{animation:tm-haze 18s ease-in-out infinite alternate}
@keyframes tm-haze{from{transform:translateX(-40px)}to{transform:translateX(40px)}}
.g-timemachine .tm-float{animation:tm-float 7s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes tm-float{0%,100%{transform:translateY(-8px) rotate(-2.5deg)}50%{transform:translateY(8px) rotate(2.5deg)}}
.g-timemachine .tm-twinkle{animation:tm-twinkle 3s ease-in-out infinite}
@keyframes tm-twinkle{0%,100%{opacity:.9}50%{opacity:.25}}
.g-timemachine.paused *{animation-play-state:paused!important}
@media (prefers-reduced-motion: reduce){.g-timemachine .tm-waves,.g-timemachine .tm-foam,.g-timemachine .tm-clouds,.g-timemachine .tm-drift,.g-timemachine .tm-shimmer,.g-timemachine .tm-haze,.g-timemachine .tm-float,.g-timemachine .tm-twinkle,.g-timemachine .tm-flash.go{animation:none}}
`;

function styleRef(delta) {
  let s = document.querySelector('style[data-module="timemachine"]');
  if (!s && delta > 0) {
    s = document.createElement('style');
    s.setAttribute('data-module', 'timemachine');
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  if (!s) return;
  const n = (+s.dataset.refs || 0) + delta;
  s.dataset.refs = String(n);
  if (n <= 0) s.remove();
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const f1 = (n) => (Math.round(n * 10) / 10).toString();

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t, 0, 1))).toString(16).padStart(2, '0')).join('');
}

/* Tileable value-noise textures, rendered once to data URLs. */
function makeTexture(size, palette, seed, opts = {}) {
  const rnd = mulberry32(seed);
  const L = 64, V = new Float32Array(L * L);
  for (let i = 0; i < L * L; i++) V[i] = rnd();
  const noise = (x, y, P) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const x0 = ((xi % P) + P) % P, x1 = (x0 + 1) % P, y0 = ((yi % P) + P) % P, y1 = (y0 + 1) % P;
    const a = V[y0 * L + x0], b = V[y0 * L + x1], c = V[y1 * L + x0], d = V[y1 * L + x1];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const img = g.createImageData(size, size);
  const base = opts.base || 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let s = 0, amp = 0.5, n = 0, P = base;
    for (let o = 0; o < 5; o++) { s += amp * noise((x / size) * P, (y / size) * P, P); n += amp; amp *= 0.5; P *= 2; }
    let t = s / n;
    t = clamp((t - 0.5) * (opts.contrast || 1.8) + 0.5, 0, 1);
    let k = 0;
    while (k < palette.length - 2 && t > palette[k + 1][0]) k++;
    const p0 = palette[k], p1 = palette[k + 1];
    const u = clamp((t - p0[0]) / (p1[0] - p0[0]), 0, 1);
    let r = lerp(p0[1], p1[1], u), gg = lerp(p0[2], p1[2], u), b = lerp(p0[3], p1[3], u);
    if (opts.speck && rnd() < opts.speck) { const d = 0.55 + rnd() * 0.3; r *= d; gg *= d; b *= d; }
    const o = (y * size + x) * 4;
    img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = opts.alpha ? Math.round(255 * clamp(Math.pow(t, opts.alpha), 0, 1)) : 255;
  }
  g.putImageData(img, 0, 0);
  try { return cv.toDataURL('image/png'); } catch (e) { return ''; }
}

let TEX = null;
function textures() {
  if (TEX) return TEX;
  TEX = {
    rust: makeTexture(128, [[0, 62, 24, 9], [0.3, 110, 42, 15], [0.5, 158, 70, 25], [0.72, 198, 106, 44], [1, 226, 150, 82]], 11, { speck: 0.05, contrast: 2.1 }),
    acid: makeTexture(128, [[0, 58, 46, 22], [0.35, 98, 84, 38], [0.65, 146, 128, 56], [1, 196, 178, 92]], 12, { speck: 0.06, contrast: 1.7 }),
    steel: makeTexture(128, [[0, 140, 146, 154], [0.5, 186, 191, 198], [1, 226, 229, 233]], 13, { contrast: 1.6 }),
    moon: makeTexture(128, [[0, 104, 102, 98], [0.5, 150, 147, 141], [1, 190, 187, 181]], 14, { speck: 0.06 }),
    mars: makeTexture(128, [[0, 132, 66, 36], [0.5, 182, 106, 62], [1, 216, 152, 104]], 15, { speck: 0.05 }),
    sand: makeTexture(128, [[0, 186, 168, 132], [0.5, 216, 202, 172], [1, 240, 234, 218]], 16, { speck: 0.05 }),
    venusRock: makeTexture(128, [[0, 70, 36, 16], [0.5, 112, 60, 28], [1, 160, 92, 44]], 17, { speck: 0.05 }),
  };
  return TEX;
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const SVG_SPEAK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const SVG_HOURGLASS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 10 5 10 9s-10 4-10 9"/><path d="M17 3c0 5-10 5-10 9s10 4 10 9"/><path d="M9.5 18.5h5l-2.5-2z" fill="currentColor" stroke="none"/></svg>';
const COND_ICONS = {
  water: '<svg viewBox="0 0 24 24"><path d="M12 3c3.5 4.5 6 7.6 6 10.6A6 6 0 0 1 6 13.6C6 10.6 8.5 7.5 12 3z" fill="#7cc4ff"/></svg>',
  air: '<svg viewBox="0 0 24 24" fill="none" stroke="#b9c0cf" stroke-width="2" stroke-linecap="round"><path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7"/></svg>',
  salt: '<svg viewBox="0 0 24 24" fill="#f3efe6"><circle cx="7" cy="8" r="1.6"/><circle cx="13" cy="6" r="1.3"/><circle cx="17" cy="11" r="1.6"/><circle cx="10" cy="13" r="1.4"/><circle cx="6" cy="17" r="1.3"/><circle cx="15" cy="17" r="1.6"/></svg>',
  speck: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffd27a" stroke-width="2" stroke-linecap="round"><path d="M4 20L14 10"/><circle cx="17" cy="7" r="3" fill="#ffd27a" stroke="none"/></svg>',
  wind: '<svg viewBox="0 0 24 24" fill="none" stroke="#e0a070" stroke-width="2" stroke-linecap="round"><path d="M3 8h12a3 3 0 1 0-3-3M3 13h16M3 18h10a3 3 0 1 1-3 3"/></svg>',
  heat: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff6b57" stroke-width="2" stroke-linecap="round"><path d="M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><circle cx="12" cy="17" r="2" fill="#ff6b57"/></svg>',
  acid: '<svg viewBox="0 0 24 24"><path d="M12 3c3.5 4.5 6 7.6 6 10.6A6 6 0 0 1 6 13.6C6 10.6 8.5 7.5 12 3z" fill="#d6c860"/><path d="M9.5 14.5a2.6 2.6 0 0 0 2.6 2.6" stroke="#5a4a22" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
};
const NO_MARK = '<path d="M5 19L19 5" stroke="#ff6b57" stroke-width="2.4" stroke-linecap="round"/>';
const OBJ_ICON = {
  bike: '<svg viewBox="0 0 58 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="27" r="9"/><circle cx="46" cy="27" r="9"/><path d="M12 27l10-14h16l8 14M22 13l7 14 9-14M28 8h-6M37 8l2 5"/></svg>',
  rover: '<svg viewBox="0 0 58 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="13" width="32" height="10" rx="2"/><path d="M8 11h40M41 13V4h7v5h-7"/><circle cx="12" cy="32" r="5"/><circle cx="28" cy="32" r="5"/><circle cx="44" cy="32" r="5"/><path d="M18 23l-6 9M24 23l4 9 8-9 8 9"/></svg>',
};

/* ------------------------------------------------------------------ */
/* Backgrounds (viewBox 0 0 1000 600) and thumbnails (0 0 120 80)       */
/* ------------------------------------------------------------------ */

function starsMarkup(seed, n, w, h, opts = {}) {
  const r = mulberry32(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, big = r() < (opts.big || 0.08);
    const rad = big ? 1.4 + r() * 1.2 : 0.5 + r() * 0.8;
    const op = (opts.op || 0.85) * (0.35 + r() * 0.65);
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(rad)}" fill="#fff" opacity="${op.toFixed(2)}"${big && opts.twinkle ? ` class="tm-twinkle" style="animation-delay:-${f1(r() * 3)}s"` : ''}/>`;
  }
  return s;
}

function bgMarkup(place, U) {
  if (place === 'seaside') {
    return `
      <defs>
        <linearGradient id="${U}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e5f97"/><stop offset=".6" stop-color="#8db6d6"/><stop offset="1" stop-color="#e6edee"/></linearGradient>
        <linearGradient id="${U}sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f86a6"/><stop offset="1" stop-color="#1c5874"/></linearGradient>
        <linearGradient id="${U}beach" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6c099"/><stop offset="1" stop-color="#b3966a"/></linearGradient>
        <radialGradient id="${U}sun"><stop offset="0" stop-color="#fffbe9" stop-opacity="1"/><stop offset=".25" stop-color="#fff2c6" stop-opacity=".75"/><stop offset="1" stop-color="#fff2c6" stop-opacity="0"/></radialGradient>
        <linearGradient id="${U}spray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <filter id="${U}soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
        <pattern id="${U}sandtex" patternUnits="userSpaceOnUse" width="200" height="200"><image href="${textures().sand}" width="200" height="200"/></pattern>
      </defs>
      <rect width="1000" height="380" fill="url(#${U}sky)"/>
      <circle cx="880" cy="282" r="170" fill="url(#${U}sun)"/>
      <circle cx="880" cy="282" r="26" fill="#fffaf0"/>
      <g class="tm-clouds" filter="url(#${U}soft)" fill="#fff" opacity=".8">
        <ellipse cx="190" cy="120" rx="120" ry="26"/><ellipse cx="260" cy="104" rx="70" ry="24"/><ellipse cx="560" cy="70" rx="90" ry="16"/><ellipse cx="930" cy="210" rx="80" ry="14"/>
      </g>
      <g fill="none" stroke="#2b3a44" stroke-width="2.4" stroke-linecap="round" opacity=".7"><path d="M600 170q8-7 16 0q8-7 16 0"/><path d="M660 196q6-5 12 0q6-5 12 0"/></g>
      <path d="M0 336c60-26 130-40 200-30s90 20 130 30v10H0z" fill="#6f8580" opacity=".75"/>
      <path d="M0 340c40-20 90-30 140-24s60 14 90 24z" fill="#4f625d"/>
      <rect y="336" width="1000" height="96" fill="url(#${U}sea)"/>
      <path d="M0 337h1000" stroke="#d8eef6" stroke-width="1.5" opacity=".6"/>
      <g stroke="#fff" stroke-linecap="round" opacity=".6"><path d="M840 348h70M820 358h110M850 370h60M810 382h90M860 396h50" stroke-width="2.5"/></g>
      <g class="tm-waves" fill="none" stroke="#e8f6fa" stroke-width="2" opacity=".35">
        <path d="M0 362q25-6 50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0"/>
        <path d="M0 392q30-7 60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0"/>
      </g>
      <path d="M0 424q250-14 500-4t500-4V460H0z" fill="#a58b5f"/>
      <path class="tm-foam" d="M0 424q250-14 500-4t500-4" fill="none" stroke="#fbfdfd" stroke-width="6" opacity=".75"/>
      <path d="M0 446q300-12 600-4t400-2V600H0z" fill="url(#${U}beach)"/>
      <path d="M0 446q300-12 600-4t400-2V600H0z" fill="url(#${U}sandtex)" opacity=".55"/>
      <g fill="#8f7a58" opacity=".7"><ellipse cx="120" cy="520" rx="9" ry="4"/><ellipse cx="840" cy="560" rx="12" ry="5"/><ellipse cx="900" cy="500" rx="6" ry="3"/><ellipse cx="210" cy="575" rx="7" ry="3"/></g>
      <g fill="#efe6d6"><path d="M760 528l10-7 10 7-10 4z"/><ellipse cx="160" cy="470" rx="5" ry="3"/></g>
      <rect y="380" width="1000" height="110" fill="url(#${U}spray)"/>`;
  }
  if (place === 'moon') {
    return `
      <defs>
        <radialGradient id="${U}earth" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#5fa6e8"/><stop offset=".7" stop-color="#2560a8"/><stop offset="1" stop-color="#173f78"/></radialGradient>
        <linearGradient id="${U}mground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#77746f"/><stop offset="1" stop-color="#a19e98"/></linearGradient>
        <linearGradient id="${U}crater" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2c2b29"/><stop offset=".55" stop-color="#5a5854"/><stop offset="1" stop-color="#bdbab3"/></linearGradient>
        <clipPath id="${U}eclip"><circle cx="800" cy="120" r="46"/></clipPath>
        <filter id="${U}glowE" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
        <pattern id="${U}regtex" patternUnits="userSpaceOnUse" width="220" height="220"><image href="${textures().moon}" width="220" height="220"/></pattern>
      </defs>
      <rect width="1000" height="600" fill="#010205"/>
      <g>${starsMarkup(5, 70, 1000, 360, { op: 0.55, big: 0.05 })}</g>
      <g transform="translate(70 176)">
      <circle cx="800" cy="120" r="52" fill="#7cc4ff" opacity=".35" filter="url(#${U}glowE)"/>
      <circle cx="800" cy="120" r="46" fill="url(#${U}earth)"/>
      <g clip-path="url(#${U}eclip)">
        <path d="M770 92c10-6 22-4 30 2s4 14-6 16-24 6-28 0 0-14 4-18z" fill="#6d9a58" opacity=".85"/>
        <path d="M806 128c8-2 16 4 14 12s-10 12-16 8-6-18 2-20z" fill="#b39462" opacity=".85"/>
        <g fill="none" stroke="#fff" stroke-linecap="round" opacity=".85"><path d="M758 110c16 6 30 2 44-6" stroke-width="5"/><path d="M790 150c14-4 26-10 40-6" stroke-width="4"/><path d="M780 78c10 2 22 0 32-6" stroke-width="3.5"/></g>
        <path d="M800 74a46 46 0 0 1 0 92a60 60 0 0 0 0-92z" fill="#000" opacity=".6" transform="translate(14 0)"/>
      </g>
      </g>
      <path d="M0 378l70-18 60 8 90-26 80 20 110-14 90 22 120-30 110 22 120-16 150 26V400H0z" fill="#56544f"/>
      <path d="M70 360l60 8M220 342l80 20M410 350l90 22M620 342l110 22" stroke="#c9c6bf" stroke-width="2" opacity=".55"/>
      <rect y="384" width="1000" height="216" fill="url(#${U}mground)"/>
      <rect y="384" width="1000" height="216" fill="url(#${U}regtex)" opacity=".45"/>
      <g>
        <ellipse cx="150" cy="500" rx="120" ry="26" fill="url(#${U}crater)"/><path d="M30 500a120 26 0 0 1 240 0" fill="none" stroke="#cfccc5" stroke-width="2" opacity=".5"/>
        <ellipse cx="880" cy="440" rx="70" ry="13" fill="url(#${U}crater)"/>
        <ellipse cx="610" cy="560" rx="60" ry="12" fill="url(#${U}crater)"/>
        <ellipse cx="360" cy="420" rx="34" ry="6" fill="url(#${U}crater)"/>
      </g>
      <g><path d="M78 432l10-9 12 3 4 7z" fill="#a9a59e"/><path d="M104 433l80 6-80 0z" fill="#000" opacity=".55"/>
      <path d="M720 520l14-12 16 4 6 9z" fill="#b3afa8"/><path d="M756 521l120 8-120 0z" fill="#000" opacity=".55"/>
      <path d="M440 470l6-5 8 2 2 4z" fill="#a9a59e"/><path d="M456 471l50 4-50 0z" fill="#000" opacity=".5"/></g>`;
  }
  if (place === 'mars') {
    return `
      <defs>
        <linearGradient id="${U}msky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9875a"/><stop offset=".65" stop-color="#ddb487"/><stop offset="1" stop-color="#ecd0a4"/></linearGradient>
        <linearGradient id="${U}mgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b0653a"/><stop offset="1" stop-color="#874426"/></linearGradient>
        <radialGradient id="${U}msun"><stop offset="0" stop-color="#fffaf0"/><stop offset=".2" stop-color="#e9f0f2" stop-opacity=".7"/><stop offset="1" stop-color="#e9f0f2" stop-opacity="0"/></radialGradient>
        <linearGradient id="${U}mhaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eccca0" stop-opacity="0"/><stop offset=".5" stop-color="#eccca0" stop-opacity=".45"/><stop offset="1" stop-color="#eccca0" stop-opacity="0"/></linearGradient>
        <pattern id="${U}marstex" patternUnits="userSpaceOnUse" width="200" height="200"><image href="${textures().mars}" width="200" height="200"/></pattern>
      </defs>
      <rect width="1000" height="600" fill="url(#${U}msky)"/>
      <circle cx="860" cy="250" r="80" fill="url(#${U}msun)"/>
      <circle cx="860" cy="250" r="12" fill="#fffaf2"/>
      <path d="M0 352l60-6 30-26h70l22 24 120 4 40-30 90 2 30 26 200 2 50-22 80 0 40 20 168 4V380H0z" fill="#c4906c" opacity=".75"/>
      <path d="M0 372c120-14 220-20 360-10s240 4 380-8 200 6 260 10V400H0z" fill="#a8613c"/>
      <rect y="380" width="1000" height="40" fill="url(#${U}mhaze)"/>
      <path d="M0 392c200-8 400-10 600-4s300 2 400 0V600H0z" fill="url(#${U}mgr)"/>
      <path d="M0 392c200-8 400-10 600-4s300 2 400 0V600H0z" fill="url(#${U}marstex)" opacity=".55"/>
      <g fill="none" stroke="#d48a5c" stroke-width="2" opacity=".5"><path d="M40 470q60-8 120 0M70 486q60-8 120 0M700 520q70-10 140 0M740 540q70-10 140 0M520 452q40-6 80 0"/></g>
      <g>
        <path d="M90 520l26-30 40 6 22 28z" fill="#5e2f1a"/><path d="M116 490l40 6 6 10-40-4z" fill="#a0583a"/>
        <path d="M800 470l18-20 30 4 14 18z" fill="#5a2c18"/><path d="M818 450l30 4 4 8-30-4z" fill="#9c5636"/>
        <path d="M640 590l30-36 50 10 26 30z" fill="#4e2614"/>
        <circle cx="300" cy="560" r="6" fill="#5e2f1a"/><circle cx="560" cy="470" r="4" fill="#5e2f1a"/><circle cx="910" cy="560" r="7" fill="#5e2f1a"/><circle cx="410" cy="500" r="3" fill="#5e2f1a"/>
      </g>
      <g class="tm-drift" fill="#f0c89a" opacity=".55">
        ${(() => { const r = mulberry32(9); let s = ''; for (let i = 0; i < 70; i++) s += `<circle cx="${f1(r() * 1500)}" cy="${f1(330 + r() * 260)}" r="${f1(0.8 + r() * 1.8)}"/>`; return s; })()}
      </g>`;
  }
  if (place === 'venus') {
    return `
      <defs>
        <linearGradient id="${U}vsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a3f12"/><stop offset=".45" stop-color="#d37a2c"/><stop offset="1" stop-color="#f3b55c"/></linearGradient>
        <linearGradient id="${U}vgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a4a20"/><stop offset="1" stop-color="#4c2410"/></linearGradient>
        <radialGradient id="${U}vglow" cx=".5" cy=".7" r=".5"><stop offset="0" stop-color="#ff9a40" stop-opacity=".35"/><stop offset="1" stop-color="#ff9a40" stop-opacity="0"/></radialGradient>
        <filter id="${U}vblur" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="14"/></filter>
        <pattern id="${U}vtex" patternUnits="userSpaceOnUse" width="180" height="180"><image href="${textures().venusRock}" width="180" height="180"/></pattern>
      </defs>
      <rect width="1000" height="600" fill="url(#${U}vsky)"/>
      <g class="tm-haze" filter="url(#${U}vblur)" fill="#ffd08a" opacity=".35"><ellipse cx="200" cy="120" rx="320" ry="30"/><ellipse cx="760" cy="200" rx="360" ry="34"/><ellipse cx="460" cy="290" rx="420" ry="26"/></g>
      <path d="M0 356l1000-22V600H0z" fill="url(#${U}vgr)"/>
      <g stroke="#c9783c" stroke-width="2" stroke-linejoin="round">
        <path d="M0 380l220-10 60 30-280 16z" fill="#7a4120"/>
        <path d="M250 372l260-14 50 22-280 20z" fill="#8a4c26"/>
        <path d="M560 358l300-14 70 24-330 18z" fill="#7d4422"/>
        <path d="M0 430l300-16 90 46-390 30z" fill="#6c3618"/>
        <path d="M380 420l340-20 110 50-420 30z" fill="#74391a"/>
        <path d="M760 400l240-10V470l-170 14z" fill="#6a3517"/>
        <path d="M0 520l420-24 140 70-560 34z" fill="#5c2c12"/>
        <path d="M520 500l480-30V600H600z" fill="#62301a"/>
      </g>
      <rect y="340" width="1000" height="260" fill="url(#${U}vtex)" opacity=".35"/>
      <g fill="#3a1a0a" opacity=".8"><circle cx="160" cy="470" r="4"/><circle cx="700" cy="440" r="3"/><circle cx="880" cy="540" r="5"/><circle cx="420" cy="560" r="4"/></g>
      <g opacity=".8"><path d="M118 352h40l-6-10h-28z" fill="#3b2a20"/><ellipse cx="138" cy="352" rx="26" ry="5" fill="none" stroke="#3b2a20" stroke-width="3"/><path d="M128 342a10 8 0 0 1 20 0" fill="#3b2a20"/></g>
      <rect width="1000" height="600" fill="url(#${U}vglow)"/>
      <g class="tm-shimmer" fill="none" stroke="#ffe0a8" stroke-width="2" opacity=".4">
        <path d="M380 300q10-10 0-20t0-20 0-20"/><path d="M500 290q10-10 0-20t0-20 0-20"/><path d="M620 300q10-10 0-20t0-20 0-20"/>
      </g>`;
  }
  // deep space
  return `
    <defs>
      <linearGradient id="${U}space" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#03040b"/><stop offset="1" stop-color="#0a1022"/></linearGradient>
      <radialGradient id="${U}mw" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#c9d6ff" stop-opacity=".16"/><stop offset="1" stop-color="#c9d6ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="${U}sunstar"><stop offset="0" stop-color="#fff8e8"/><stop offset=".15" stop-color="#ffe9b0" stop-opacity=".7"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1000" height="600" fill="url(#${U}space)"/>
    <ellipse cx="520" cy="300" rx="620" ry="120" fill="url(#${U}mw)" transform="rotate(-18 520 300)"/>
    <g>${starsMarkup(21, 200, 1000, 600, { op: 0.9, big: 0.07, twinkle: true })}</g>
    <g transform="rotate(-18 520 300)">${starsMarkup(22, 140, 1000, 70, { op: 0.6, big: 0.02 }).replace(/cy="([\d.]+)"/g, (m, v) => `cy="${f1(265 + +v)}"`)}</g>
    <circle cx="900" cy="430" r="70" fill="url(#${U}sunstar)"/>
    <path d="M900 395v70M865 430h70" stroke="#fff4d6" stroke-width="1.5" opacity=".8"/>
    <circle cx="900" cy="430" r="5" fill="#fffdf6"/>`;
}

function thumbMarkup(place, U) {
  const id = `${U}th-${place}`;
  if (place === 'seaside') return `<svg viewBox="0 0 120 80" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e5f97"/><stop offset="1" stop-color="#cfe2ec"/></linearGradient></defs><rect width="120" height="80" fill="url(#${id})"/><circle cx="92" cy="18" r="7" fill="#fffaf0"/><rect y="44" width="120" height="16" fill="#2f7898"/><path d="M0 58q30-4 60-1t60-1v24H0z" fill="#d6c099"/><path d="M0 58q30-4 60-1t60-1" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/><path d="M0 46c10-6 24-8 36-4l8 4z" fill="#4f625d"/></svg>`;
  if (place === 'moon') return `<svg viewBox="0 0 120 80" aria-hidden="true"><rect width="120" height="80" fill="#020308"/><circle cx="90" cy="20" r="9" fill="#2f6fb8"/><path d="M84 16c4 0 8 2 10 4" stroke="#fff" stroke-width="2" fill="none"/><path d="M90 11a9 9 0 0 1 0 18a12 12 0 0 0 0-18z" fill="#000" opacity=".55"/><circle cx="20" cy="14" r=".8" fill="#fff"/><circle cx="50" cy="26" r=".7" fill="#fff"/><circle cx="64" cy="8" r=".8" fill="#fff"/><path d="M0 52l20-5 18 3 22-6 24 5 36-4V80H0z" fill="#8a8781"/><ellipse cx="34" cy="66" rx="16" ry="4" fill="#5a5854"/><ellipse cx="88" cy="72" rx="10" ry="3" fill="#5a5854"/></svg>`;
  if (place === 'mars') return `<svg viewBox="0 0 120 80" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9875a"/><stop offset="1" stop-color="#ecd0a4"/></linearGradient></defs><rect width="120" height="80" fill="url(#${id})"/><circle cx="28" cy="18" r="4" fill="#fffaf2"/><path d="M0 48l14-2 8-8h18l6 7 30 1 10-8 20 1 14 8V60H0z" fill="#c4906c"/><path d="M0 52c30-4 70-4 120 0V80H0z" fill="#a85f38"/><path d="M14 70l6-8 10 2 6 7z" fill="#5e2f1a"/><circle cx="84" cy="68" r="2.5" fill="#5e2f1a"/></svg>`;
  if (place === 'venus') return `<svg viewBox="0 0 120 80" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a3f12"/><stop offset="1" stop-color="#f3b55c"/></linearGradient></defs><rect width="120" height="80" fill="url(#${id})"/><ellipse cx="40" cy="22" rx="46" ry="5" fill="#ffd08a" opacity=".35"/><ellipse cx="86" cy="34" rx="40" ry="4" fill="#ffd08a" opacity=".3"/><path d="M0 48l120-4V80H0z" fill="#6c3618"/><path d="M0 54l50-3 12 6-62 4zM60 50l60-3V58l-48 4z" fill="#8a4c26" stroke="#c9783c" stroke-width=".8"/><path d="M0 70l70-5 20 10-90 5z" fill="#5c2c12"/></svg>`;
  return `<svg viewBox="0 0 120 80" aria-hidden="true"><rect width="120" height="80" fill="#050816"/><ellipse cx="62" cy="40" rx="70" ry="12" fill="#c9d6ff" opacity=".12" transform="rotate(-18 62 40)"/>${starsMarkup(4, 36, 120, 80, { op: 0.9, big: 0.1 })}<circle cx="14" cy="16" r="3" fill="#fff6dc"/><path d="M14 10v12M8 16h12" stroke="#fff6dc" stroke-width=".8"/></svg>`;
}

/* ------------------------------------------------------------------ */
/* Objects: local box 0..400 x 0..280, ground at y = 274                */
/* ------------------------------------------------------------------ */

const GROUND = 274;
const BIKE = {
  RW: [96, 202], FW: [312, 202], BB: [190, 208], ST: [168, 104], HT: [286, 96], HB: [296, 136], SP: [163, 80],
};
function bikeTubes() {
  const { RW, FW, BB, ST, HT, HB, SP } = BIKE;
  return [
    { a: ST, b: BB, w: 11 }, { a: ST, b: HT, w: 10 }, { a: HB, b: BB, w: 12 }, { a: ST, b: RW, w: 7 },
    { a: BB, b: RW, w: 8 }, { a: HB, b: FW, w: 8, fork: true }, { a: HT, b: HB, w: 14 },
  ];
}
function bikeTyres() {
  let s = '';
  for (const [x, y] of [BIKE.RW, BIKE.FW]) {
    s += `<circle class="tm-tyre" cx="${x}" cy="${y}" r="66" fill="none" stroke="#1c1d21" stroke-width="12"/>`;
    s += `<circle class="tm-tyre-crack" cx="${x}" cy="${y}" r="66" fill="none" stroke="#6b665e" stroke-width="1.4" stroke-dasharray="5 9 2 14" opacity="0"/>`;
    s += `<path class="tm-hl" d="M${x - 46} ${y - 46}a66 66 0 0 1 32-17" fill="none" stroke="#fff" stroke-width="1.6" opacity=".35"/>`;
  }
  return s;
}
function bikeMarkup(sil) {
  const { RW, FW, BB, HT, SP } = BIKE;
  const W = (c) => (sil ? '#fff' : c);
  const paint = sil ? '#fff' : 'var(--tm-paint)';
  let s = '';
  // wheels (tyres are drawn separately, outside the metal mask)
  for (const [x, y] of [RW, FW]) {
    s += `<circle cx="${x}" cy="${y}" r="58" fill="none" stroke="${W('#c4c9d1')}" stroke-width="4.5"/>`;
    let sp = '';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2, a2 = a + (i % 2 ? 0.32 : -0.32);
      sp += `M${f1(x + Math.cos(a) * 7)} ${f1(y + Math.sin(a) * 7)}L${f1(x + Math.cos(a2) * 56)} ${f1(y + Math.sin(a2) * 56)}`;
    }
    s += `<path d="${sp}" stroke="${W('#d7dce3')}" stroke-width="${sil ? 1.6 : 1.1}" fill="none"/>`;
    s += `<circle cx="${x}" cy="${y}" r="7.5" fill="${W('#9aa1ab')}"/>`;
  }
  // chain and chainring
  s += `<path d="M${BB[0]} ${BB[1] - 19}L${RW[0]} ${RW[1] - 9}M${BB[0]} ${BB[1] + 19}L${RW[0]} ${RW[1] + 9}" stroke="${W('#3d4048')}" stroke-width="3.2" stroke-dasharray="${sil ? 'none' : '2.5 1.5'}"/>`;
  s += `<circle cx="${RW[0]}" cy="${RW[1]}" r="9" fill="none" stroke="${W('#8d949e')}" stroke-width="3"/>`;
  s += `<circle cx="${BB[0]}" cy="${BB[1]}" r="19" fill="none" stroke="${W('#aeb4bd')}" stroke-width="4.5"/>`;
  // frame
  for (const t of bikeTubes()) {
    if (!sil) s += `<line x1="${t.a[0]}" y1="${t.a[1] + 1.5}" x2="${t.b[0]}" y2="${t.b[1] + 1.5}" stroke="rgba(0,0,0,.35)" stroke-width="${t.w + 1}" stroke-linecap="round"/>`;
    s += `<line x1="${t.a[0]}" y1="${t.a[1]}" x2="${t.b[0]}" y2="${t.b[1]}" style="stroke:${paint}" stroke-width="${t.w}" stroke-linecap="round"/>`;
  }
  // seat post, saddle
  s += `<line x1="${SP[0]}" y1="${SP[1]}" x2="168" y2="104" stroke="${W('#b8bec7')}" stroke-width="6" stroke-linecap="round"/>`;
  s += `<path d="M128 74c14-6 50-8 68-2 4 2 2 8-4 9-14 2-36 2-50 1-10-1-18-4-14-8z" fill="${W('#2a2522')}"/>`;
  // stem, handlebar, grip
  s += `<path d="M${HT[0]} ${HT[1]}L282 70Q272 60 250 66" fill="none" stroke="${W('#b8bec7')}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="M252 66L236 72" stroke="${W('#24252a')}" stroke-width="9" stroke-linecap="round"/>`;
  // crank and pedal
  s += `<path d="M${BB[0]} ${BB[1]}L212 242" stroke="${W('#9aa1ab')}" stroke-width="6" stroke-linecap="round"/>`;
  s += `<rect x="202" y="238" width="22" height="7" rx="2" fill="${W('#24252a')}"/>`;
  s += `<circle cx="${BB[0]}" cy="${BB[1]}" r="5" fill="${W('#7d848f')}"/>`;
  if (!sil) {
    // specular highlights
    let hl = '';
    for (const t of bikeTubes()) {
      const dx = t.b[0] - t.a[0], dy = t.b[1] - t.a[1], L = Math.hypot(dx, dy);
      let nx = -dy / L, ny = dx / L;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const o = t.w / 2 - 2.2;
      hl += `<line x1="${f1(t.a[0] + nx * o + dx * 0.08)}" y1="${f1(t.a[1] + ny * o + dy * 0.08)}" x2="${f1(t.b[0] + nx * o - dx * 0.12)}" y2="${f1(t.b[1] + ny * o - dy * 0.12)}"/>`;
    }
    s += `<g class="tm-hl" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".55">${hl}</g>`;
  }
  return s;
}
function bikePoints(rnd, n) {
  const segs = bikeTubes().map((t) => ({ a: t.a, b: t.b, w: t.w, len: Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1]) }));
  const circles = [[BIKE.RW, 62], [BIKE.FW, 62], [BIKE.RW, 66], [BIKE.FW, 66]];
  const pts = [];
  const total = segs.reduce((a, s) => a + s.len, 0);
  for (let i = 0; i < n; i++) {
    if (rnd() < 0.7) {
      let k = rnd() * total, s = segs[0];
      for (const sg of segs) { if (k <= sg.len) { s = sg; break; } k -= sg.len; }
      const t = rnd();
      pts.push([lerp(s.a[0], s.b[0], t) + (rnd() - 0.5) * s.w * 0.6, lerp(s.a[1], s.b[1], t) + (rnd() - 0.5) * s.w * 0.6, s.w]);
    } else {
      const [c, r] = circles[Math.floor(rnd() * circles.length)];
      const a = rnd() * Math.PI * 2;
      pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, 8]);
    }
  }
  return pts;
}

const ROVER = { W: [[86, 240], [202, 240], [318, 240]], WR: 34 };
function roverMarkup(sil) {
  const W = (c) => (sil ? '#fff' : c);
  const body = sil ? '#fff' : 'var(--tm-body)';
  let s = '';
  // rocker-bogie suspension
  s += `<g fill="none" stroke="${W('#9aa1ab')}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M86 240L176 168L262 200L318 240M262 200L202 240"/></g>`;
  s += `<circle cx="176" cy="168" r="7" fill="${W('#6b7280')}"/><circle cx="262" cy="200" r="6" fill="${W('#6b7280')}"/>`;
  // wheels
  for (const [x, y] of ROVER.W) {
    s += `<circle cx="${x}" cy="${y}" r="34" fill="${W('#8b929c')}"/>`;
    s += `<circle cx="${x}" cy="${y}" r="27" fill="${W('#c6cbd3')}"/>`;
    if (!sil) {
      let t = '';
      for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; t += `M${f1(x + Math.cos(a) * 28)} ${f1(y + Math.sin(a) * 28)}L${f1(x + Math.cos(a + 0.12) * 34)} ${f1(y + Math.sin(a + 0.12) * 34)}`; }
      s += `<path d="${t}" stroke="#5f6670" stroke-width="2.4"/>`;
      s += `<path d="M${x - 18} ${y - 16}a26 26 0 0 1 22-10" fill="none" stroke="#fff" stroke-width="2" opacity=".55" class="tm-hl"/>`;
    }
    s += `<circle cx="${x}" cy="${y}" r="7" fill="${W('#6b7280')}"/>`;
  }
  // body
  s += `<rect x="96" y="112" width="234" height="60" rx="7" style="fill:${body}"/>`;
  if (!sil) {
    s += `<rect x="96" y="150" width="234" height="22" rx="4" class="tm-foil" fill="#c9a14a" opacity=".95"/>`;
    s += `<path d="M110 150v22M140 150v22M176 150v22M214 150v22M252 150v22M290 150v22" stroke="#8a6a24" stroke-width="1.4" opacity=".7"/>`;
    s += `<path d="M150 116v32M210 116v32M270 116v32" stroke="rgba(0,0,0,.14)" stroke-width="2"/>`;
    s += `<rect x="96" y="112" width="234" height="60" rx="7" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/>`;
  }
  // solar deck
  s += `<rect x="70" y="100" width="282" height="13" rx="3" fill="${W('#1d3a6c')}"/>`;
  if (!sil) s += `<path d="M90 100v13M112 100v13M134 100v13M156 100v13M178 100v13M200 100v13M222 100v13M244 100v13M266 100v13M288 100v13M310 100v13M332 100v13M70 106.5h282" stroke="rgba(124,196,255,.4)" stroke-width="1"/><path d="M74 102h120" stroke="#fff" stroke-width="1.6" opacity=".5" class="tm-hl"/>`;
  // dish antenna
  s += `<path d="M140 100v-10" stroke="${W('#9aa1ab')}" stroke-width="4"/><ellipse cx="140" cy="86" rx="24" ry="8" transform="rotate(-14 140 86)" style="fill:${body}"/>`;
  // mast and camera head
  s += `<path d="M302 100V36" stroke="${W('#aeb4bd')}" stroke-width="8" stroke-linecap="round"/>`;
  s += `<rect x="280" y="12" width="52" height="28" rx="5" style="fill:${body}"/>`;
  s += `<circle cx="298" cy="26" r="6" fill="${W('#14161b')}"/><circle cx="316" cy="26" r="6" fill="${W('#14161b')}"/>`;
  if (!sil) s += `<circle class="tm-eye" cx="290" cy="18" r="3.4" fill="#5fd4ff"/><circle cx="296" cy="24" r="1.6" fill="#fff" opacity=".8"/><circle cx="314" cy="24" r="1.6" fill="#fff" opacity=".8"/>`;
  // robot arm
  s += `<path d="M330 150L362 162L356 198" fill="none" stroke="${W('#aeb4bd')}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><rect x="346" y="196" width="20" height="12" rx="3" fill="${W('#7d848f')}"/>`;
  return s;
}
function roverPoints(rnd, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const k = rnd();
    if (k < 0.5) pts.push([96 + rnd() * 234, 112 + rnd() * 60, 14]);
    else if (k < 0.82) { const [x, y] = ROVER.W[Math.floor(rnd() * 3)]; const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 33; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r, 10]); }
    else if (k < 0.92) pts.push([70 + rnd() * 282, 100 + rnd() * 13, 6]);
    else pts.push([280 + rnd() * 52, 12 + rnd() * 90, 8]);
  }
  return pts;
}

/* Irregular blob outline of radius ~1 around the origin. */
function blobPath(rnd) {
  const n = 9, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const r = 0.65 + rnd() * 0.55; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const mid = (i) => { const p = pts[i % n], q = pts[(i + 1) % n]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
  const m0 = mid(0);
  let d = `M${m0[0].toFixed(2)} ${m0[1].toFixed(2)}`;
  for (let i = 1; i <= n; i++) { const c = pts[i % n], m = mid(i); d += `Q${c[0].toFixed(2)} ${c[1].toFixed(2)} ${m[0].toFixed(2)} ${m[1].toFixed(2)}`; }
  return d + 'Z';
}

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

function buildConfig(d) {
  d = d && typeof d === 'object' ? d : {};
  const c = JSON.parse(JSON.stringify(DEFAULTS));
  if (PLACES.includes(d.startPlace)) c.startPlace = d.startPlace;
  if (OBJECTS.includes(d.startObject)) c.startObject = d.startObject;
  if (Number.isFinite(+d.completeAfter) && +d.completeAfter >= 1) c.completeAfter = Math.min(5, Math.round(+d.completeAfter));
  if (Array.isArray(d.stops) && d.stops.length === 6 && d.stops.every((x) => typeof x === 'string')) c.stops = d.stops.slice();
  if (d.objects && typeof d.objects === 'object') for (const o of OBJECTS) if (d.objects[o] && typeof d.objects[o].name === 'string') c.objects[o].name = d.objects[o].name;
  if (d.places && typeof d.places === 'object') {
    for (const p of PLACES) {
      const src = d.places[p];
      if (!src || typeof src !== 'object') continue;
      for (const k of ['name', 'sub', 'fact']) if (typeof src[k] === 'string') c.places[p][k] = src[k];
      if (Array.isArray(src.captions)) src.captions.slice(0, 6).forEach((cap, i) => {
        if (typeof cap === 'string' || (cap && typeof cap === 'object')) c.places[p].captions[i] = cap;
      });
    }
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Mount                                                               */
/* ------------------------------------------------------------------ */

export async function mount(el, ctx) {
  ctx = ctx || {};
  const cfg = buildConfig(ctx.data);
  const call = (fn, ...a) => { try { return typeof fn === 'function' ? fn(...a) : undefined; } catch (e) { console.warn('[timemachine]', e); return undefined; } };
  let qs;
  try { qs = new URLSearchParams(location.search); } catch (e) { qs = new URLSearchParams(''); }
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const U = 'tm' + Math.random().toString(36).slice(2, 7) + '-';
  styleRef(+1);
  const dbgT = qs.has('debugTiming') ? (m) => console.log('[timemachine] ' + m + ' ' + Math.round(performance.now())) : () => {};
  dbgT('start');
  const TX = textures();
  dbgT('textures');

  const ac = new AbortController();
  const on = (t, type, fn, opts) => t.addEventListener(type, fn, Object.assign({ signal: ac.signal }, opts || {}));
  const timers = new Set();
  let dead = false, raf = 0, layoutRaf = 0;
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); return id; };

  /* ---------- state ---------- */
  const saved = call(ctx.load, 'tm') || {};
  const state = {
    place: PLACES.includes(saved.place) ? saved.place : cfg.startPlace,
    object: OBJECTS.includes(saved.object) ? saved.object : cfg.startObject,
    v: 0,
    visited: new Set(Array.isArray(saved.visited) ? saved.visited.filter((p) => PLACES.includes(p)) : []),
    logged: new Set(Array.isArray(saved.logged) ? saved.logged : []),
    completed: false,
  };
  if (PLACES.includes(qs.get('debugPlace'))) state.place = qs.get('debugPlace');
  if (OBJECTS.includes(qs.get('debugObject'))) state.object = qs.get('debugObject');
  if (qs.get('debugTime') !== null && Number.isFinite(+qs.get('debugTime'))) state.v = clamp(+qs.get('debugTime'), 0, 5);

  /* ---------- DOM ---------- */
  const root = document.createElement('div');
  root.className = 'g-timemachine land';
  root.innerHTML = `
    <div class="tm-side">
      <div class="tm-h">Pick a place</div>
      <div class="tm-places">
        ${PLACES.map((p) => `<button class="tm-place" type="button" data-p="${p}" aria-label="${esc(cfg.places[p].name)}">${thumbMarkup(p, U)}<span class="tx"><b>${esc(cfg.places[p].name)}</b><small>${esc(cfg.places[p].sub)}</small></span><i class="seen"></i></button>`).join('')}
      </div>
      <div class="tm-h">Pick a thing</div>
      <div class="tm-objs">
        ${OBJECTS.map((o) => `<button class="tm-objbtn" type="button" data-o="${o}">${OBJ_ICON[o]}<span>${esc(cfg.objects[o].name)}</span></button>`).join('')}
      </div>
    </div>
    <div class="tm-main">
      <div class="tm-scene">
        <svg class="tm-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs class="tm-defs"></defs>
          <g class="tm-bg-old"></g>
          <g class="tm-bg"></g>
          <g class="tm-under"></g>
          <g class="tm-objwrap"></g>
          <g class="tm-front"></g>
          <rect class="tm-flash" width="1000" height="600" fill="url(#${U}flash)"/>
        </svg>
        <div class="tm-hud"><div class="tm-where"></div><div class="tm-when"></div><div class="tm-status" hidden><i></i><span></span></div></div>
        <div class="tm-conds"></div>
        <div class="tm-fact card"><div class="eyebrow">Real fact</div><div class="tm-fact-t"></div></div>
      </div>
      <div class="tm-caption card"><p class="tm-why" aria-live="polite"></p><button class="speak-btn tm-say" type="button" aria-label="Read aloud">${SVG_SPEAK}</button></div>
      <div class="tm-slider" role="slider" tabindex="0" aria-label="Time" aria-valuemin="0" aria-valuemax="5">
        <div class="tm-track"><div class="tm-fill"></div>${cfg.stops.map(() => '<i class="tm-stop"></i>').join('')}</div>
        <div class="tm-labels">${cfg.stops.map((s) => `<span class="tm-lab">${esc(s)}</span>`).join('')}</div>
        <div class="tm-thumb">${SVG_HOURGLASS}</div>
      </div>
    </div>`;
  el.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const svg = $('.tm-svg'), defsEl = $('.tm-defs'), bgEl = $('.tm-bg'), bgOld = $('.tm-bg-old'), underEl = $('.tm-under'), wrapEl = $('.tm-objwrap'), frontEl = $('.tm-front'), flashEl = $('.tm-flash');
  const whereEl = $('.tm-where'), whenEl = $('.tm-when'), condsEl = $('.tm-conds'), factEl = $('.tm-fact-t'), statusEl = $('.tm-status'), whyEl = $('.tm-why');
  const slider = $('.tm-slider'), track = $('.tm-track'), fillEl = $('.tm-fill'), thumb = $('.tm-thumb');
  const stopEls = [...root.querySelectorAll('.tm-stop')], labEls = [...root.querySelectorAll('.tm-lab')];
  const placeBtns = [...root.querySelectorAll('.tm-place')], objBtns = [...root.querySelectorAll('.tm-objbtn')];

  /* ---------- static defs (textures, masks, filters) ---------- */
  defsEl.innerHTML = `
    <radialGradient id="${U}flash" cx=".5" cy=".55" r=".7"><stop offset="0" stop-color="#fff6dc" stop-opacity=".9"/><stop offset=".5" stop-color="#ffd27a" stop-opacity=".25"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
    <pattern id="${U}rust" patternUnits="userSpaceOnUse" width="110" height="110"><image href="${TX.rust}" width="110" height="110"/></pattern>
    <pattern id="${U}acid" patternUnits="userSpaceOnUse" width="110" height="110"><image href="${TX.acid}" width="110" height="110"/></pattern>
    <pattern id="${U}steel" patternUnits="userSpaceOnUse" width="90" height="90"><image href="${TX.steel}" width="90" height="90"/></pattern>
    <pattern id="${U}dust-moon" patternUnits="userSpaceOnUse" width="90" height="90"><image href="${TX.moon}" width="90" height="90"/></pattern>
    <pattern id="${U}dust-mars" patternUnits="userSpaceOnUse" width="90" height="90"><image href="${TX.mars}" width="90" height="90"/></pattern>
    <pattern id="${U}dust-sand" patternUnits="userSpaceOnUse" width="90" height="90"><image href="${TX.sand}" width="90" height="90"/></pattern>
    <linearGradient id="${U}dustfall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></linearGradient>
    <mask id="${U}dustm" maskUnits="userSpaceOnUse" x="-60" y="-60" width="520" height="400"><rect x="-60" y="-60" width="520" height="400" fill="url(#${U}dustfall)"/></mask>
    <filter id="${U}shadowf" x="-30%" y="-30%" width="160%" height="160%"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/><feGaussianBlur class="tm-shblur" stdDeviation="3"/></filter>
    <filter id="${U}glowf" x="-40%" y="-40%" width="180%" height="180%"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.5  0 0 0 0 0.12  0 0 0 1 0"/><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="${U}rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter>
    <linearGradient id="${U}tintg" x1="0" y1="0" x2="1" y2="0"><stop class="tm-t0" offset="0" stop-color="#fff"/><stop class="tm-t1" offset="1" stop-color="#fff"/></linearGradient>
    <g id="${U}sil-bike">${bikeMarkup(true)}</g>
    <g id="${U}sil-rover">${roverMarkup(true)}</g>
    <mask id="${U}silm" maskUnits="userSpaceOnUse" x="-60" y="-60" width="520" height="400"><use class="tm-silref" href="#${U}sil-bike"/><g class="tm-holes" fill="#000"></g></mask>
    <mask id="${U}rustm" maskUnits="userSpaceOnUse" x="-60" y="-60" width="520" height="400"><g class="tm-rustblobs" fill="#fff" filter="url(#${U}rough)"></g></mask>
    <mask id="${U}acidm" maskUnits="userSpaceOnUse" x="-60" y="-60" width="520" height="400"><g class="tm-acidblobs" fill="#fff" fill-opacity=".85"></g></mask>
    <mask id="${U}chipm" maskUnits="userSpaceOnUse" x="-60" y="-60" width="520" height="400"><g class="tm-chipblobs" fill="#fff"></g></mask>`;
  const silRef = defsEl.querySelector('.tm-silref'), holesG = defsEl.querySelector('.tm-holes');
  const rustBlobsG = defsEl.querySelector('.tm-rustblobs'), acidBlobsG = defsEl.querySelector('.tm-acidblobs'), chipBlobsG = defsEl.querySelector('.tm-chipblobs');
  const tintStops = [defsEl.querySelector('.tm-t0'), defsEl.querySelector('.tm-t1')];
  const shBlur = defsEl.querySelector('.tm-shblur');

  /* ---------- object build ---------- */
  let O = null; // element references for the current object
  function buildObject() {
    const kind = state.object;
    const rnd = mulberry32(kind === 'bike' ? 101 : 202);
    const pts = (kind === 'bike' ? bikePoints : roverPoints)(rnd, 140);
    const shapes = Array.from({ length: 6 }, () => blobPath(rnd));
    silRef.setAttribute('href', `#${U}sil-${kind}`);
    // blob sets with thresholds
    const mk = (count, rmin, rmax, offset) => {
      const list = [];
      for (let i = 0; i < count; i++) {
        const p = pts[(i * 7 + offset) % pts.length];
        list.push({ x: p[0], y: p[1], r: rmin + rnd() * (rmax - rmin), th: Math.pow(rnd(), 0.9) * 0.92, sh: shapes[i % shapes.length], rot: Math.round(rnd() * 360) });
      }
      list.sort((a, b) => a.th - b.th);
      return list;
    };
    const rust = mk(64, 9, 30, 0), acid = mk(56, 6, 20, 3), chips = mk(40, 3, 10, 5), holes = mk(28, 5, 15, 2);
    const pits = [];
    for (let i = 0; i < 90; i++) { const p = pts[(i * 3 + 1) % pts.length]; pits.push({ x: p[0] + (rnd() - 0.5) * 6, y: p[1] + (rnd() - 0.5) * 6, r: 0.6 + rnd() * 1.1, th: rnd() * 0.98 }); }
    pits.sort((a, b) => a.th - b.th);
    const blobEl = (b) => `<path d="${b.sh}" transform="translate(${f1(b.x)} ${f1(b.y)}) rotate(${b.rot}) scale(0.001)"/>`;
    rustBlobsG.innerHTML = rust.map(blobEl).join('');
    acidBlobsG.innerHTML = acid.map(blobEl).join('');
    chipBlobsG.innerHTML = chips.map(blobEl).join('');
    holesG.innerHTML = holes.map(blobEl).join('');
    // wheel holes for the rover on Mars (Curiosity!)
    let wheelHoles = '';
    const wh = [];
    if (kind === 'rover') {
      for (const [x, y] of ROVER.W) for (let i = 0; i < 4; i++) {
        const a = rnd() * Math.PI * 2, r = 18 + rnd() * 12;
        wh.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, s: 3 + rnd() * 4, th: rnd() * 0.9, rot: Math.round(rnd() * 360) });
      }
      wh.sort((a, b) => a.th - b.th);
      wheelHoles = wh.map((h) => `<path d="M-1 -0.6L-0.2 -1.1L0.9 -0.4L0.6 0.8L-0.5 1L-1.1 0.2Z" fill="#1a1410" transform="translate(${f1(h.x)} ${f1(h.y)}) rotate(${h.rot}) scale(0.001)"/>`).join('');
    }
    const markup = kind === 'bike' ? bikeMarkup(false) : roverMarkup(false);
    wrapEl.innerHTML = `
      <g class="tm-objpos">
        <g class="tm-floater">
          <g class="tm-shadow" filter="url(#${U}shadowf)"><use href="#${U}sil-${kind}"/>${kind === 'bike' ? `<g fill="none" stroke="#fff" stroke-width="12"><circle cx="${BIKE.RW[0]}" cy="${BIKE.RW[1]}" r="66"/><circle cx="${BIKE.FW[0]}" cy="${BIKE.FW[1]}" r="66"/></g>` : ''}</g>
          <g class="tm-glowback" opacity="0"><use href="#${U}sil-${kind}" filter="url(#${U}glowf)"/></g>
          <g class="tm-sag">
            ${kind === 'bike' ? `<g class="tm-tyres">${bikeTyres()}</g>` : ''}
            <g class="tm-obj" mask="url(#${U}silm)">
              <g class="tm-base">${markup}</g>
              <rect class="tm-dust" x="-60" y="-60" width="520" height="400" fill="url(#${U}dust-moon)" mask="url(#${U}dustm)" opacity="0"/>
              <rect class="tm-chips" x="-60" y="-60" width="520" height="400" fill="url(#${U}steel)" mask="url(#${U}chipm)"/>
              <rect class="tm-rustall" x="-60" y="-60" width="520" height="400" fill="url(#${U}rust)" opacity="0"/>
              <rect class="tm-acidall" x="-60" y="-60" width="520" height="400" fill="url(#${U}acid)" opacity="0"/>
              <rect class="tm-rust" x="-60" y="-60" width="520" height="400" fill="url(#${U}rust)" mask="url(#${U}rustm)"/>
              <rect class="tm-acid" x="-60" y="-60" width="520" height="400" fill="url(#${U}acid)" mask="url(#${U}acidm)"/>
              <g class="tm-pits">${pits.map((p) => `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(p.r)}" fill="#2b2b2e" opacity="0"/>`).join('')}</g>
              <g class="tm-wheelholes">${wheelHoles}</g>
              <rect class="tm-tint" x="-60" y="-60" width="520" height="400" fill="url(#${U}tintg)" style="mix-blend-mode:multiply" opacity="0"/>
              <rect class="tm-hot" x="-60" y="-60" width="520" height="400" fill="#ff4a12" style="mix-blend-mode:screen" opacity="0"/>
            </g>
          </g>
        </g>
      </g>`;
    O = {
      kind, rust, acid, chips, holes, pits, wh,
      pos: wrapEl.querySelector('.tm-objpos'), floater: wrapEl.querySelector('.tm-floater'), sag: wrapEl.querySelector('.tm-sag'),
      obj: wrapEl.querySelector('.tm-obj'), shadow: wrapEl.querySelector('.tm-shadow'), glowback: wrapEl.querySelector('.tm-glowback'),
      rustAll: wrapEl.querySelector('.tm-rustall'), acidAll: wrapEl.querySelector('.tm-acidall'),
      dust: wrapEl.querySelector('.tm-dust'), tint: wrapEl.querySelector('.tm-tint'), hot: wrapEl.querySelector('.tm-hot'),
      rustEls: [...rustBlobsG.children], acidEls: [...acidBlobsG.children], chipEls: [...chipBlobsG.children], holeEls: [...holesG.children],
      pitEls: [...wrapEl.querySelectorAll('.tm-pits circle')], whEls: [...wrapEl.querySelectorAll('.tm-wheelholes path')],
      hl: [...wrapEl.querySelectorAll('.tm-hl')], tyres: [...wrapEl.querySelectorAll('.tm-tyre')], cracks: [...wrapEl.querySelectorAll('.tm-tyre-crack')],
      eye: wrapEl.querySelector('.tm-eye'), foil: wrapEl.querySelector('.tm-foil'), base: wrapEl.querySelector('.tm-base'),
    };
  }

  /* ---------- place build ---------- */
  function buildPlace(animate) {
    const p = state.place;
    if (animate && !reduced) {
      bgOld.innerHTML = '';
      while (bgEl.firstChild) bgOld.appendChild(bgEl.firstChild);
      later(() => { bgOld.innerHTML = ''; }, 600);
    }
    bgEl.innerHTML = bgMarkup(p, U);
    bgEl.classList.remove('tm-bgnew');
    if (animate && !reduced) { void bgEl.getBBox; bgEl.getBoundingClientRect(); bgEl.classList.add('tm-bgnew'); }
    const P = cfg.places[p];
    whereEl.textContent = P.name;
    condsEl.innerHTML = P.conds.map(([ic, label, yes]) => `<span class="tm-cond ${yes ? 'yes' : 'no'}"><svg viewBox="0 0 24 24">${(COND_ICONS[ic] || '').replace(/^<svg[^>]*>|<\/svg>$/g, '')}${!yes && (ic === 'water' || ic === 'air') ? NO_MARK : ''}</svg>${esc(label)}</span>`).join('');
    placeBtns.forEach((b) => b.classList.toggle('on', b.dataset.p === p));
    // object position: floating in space, standing elsewhere
    if (O) {
      O.pos.setAttribute('transform', p === 'space' ? 'translate(300 150)' : 'translate(300 190)');
      O.floater.classList.toggle('tm-float', p === 'space');
      const look = LOOK[p];
      if (look.shadow) {
        const [k, m, op, blur] = look.shadow;
        O.shadow.setAttribute('transform', `matrix(1 0 ${-k} ${-m} ${f1(GROUND * k)} ${f1(GROUND * (1 + m))})`);
        O.shadow.setAttribute('opacity', String(op));
        shBlur.setAttribute('stdDeviation', String(blur));
        O.shadow.style.display = '';
      } else O.shadow.style.display = 'none';
      O.dust.setAttribute('fill', `url(#${U}dust-${look.dustTex})`);
      if (look.tint) {
        tintStops[0].setAttribute('stop-color', look.tint[0]);
        tintStops[1].setAttribute('stop-color', look.tint[1]);
      }
    }
  }

  /* ---------- rendering for a time value ---------- */
  const val = (arr, v) => { if (!arr) return 0; const i = Math.min(4, Math.floor(v)); return lerp(arr[i], arr[i + 1], v - i); };
  function setBlobs(els, list, amount, grow = 0.35) {
    for (let i = 0; i < list.length; i++) {
      const b = list[i], k = clamp((amount - b.th) / grow, 0, 1);
      const sc = k <= 0 ? 0.001 : b.r * (0.35 + 0.95 * k);
      els[i].setAttribute('transform', `translate(${f1(b.x)} ${f1(b.y)}) rotate(${b.rot}) scale(${sc.toFixed(2)})`);
    }
  }
  function renderTime() {
    if (!O) return;
    const p = state.place, v = state.v, F = FX[p], look = LOOK[p];
    const rust = val(F.rust, v), crumble = val(F.crumble, v), dust = val(F.dust, v), fade = val(F.fade, v), perish = val(F.perish, v);
    const pits = val(F.pits, v), chips = val(F.chips, v), holes = val(F.holes, v), buried = val(F.buried, v), glow = val(F.glow, v), acid = val(F.acid, v), melt = val(F.melt, v);
    // paint
    const paintBase = '#2b6f9e', bodyBase = '#eceef1';
    root.style.setProperty('--tm-paint', mixHex(paintBase, look.fadeTo, fade));
    root.style.setProperty('--tm-body', mixHex(bodyBase, look.bodyTo, fade));
    if (O.foil) O.foil.setAttribute('opacity', (0.95 - fade * 0.5).toFixed(2));
    const shine = (1 - fade * 0.55) * (1 - dust * 0.85) * (1 - rust) * (1 - acid) * (1 - chips * 0.4);
    O.hl.forEach((h) => h.setAttribute('opacity', (0.6 * shine).toFixed(2)));
    // layers
    setBlobs(O.rustEls, O.rust, rust);
    setBlobs(O.acidEls, O.acid, acid);
    setBlobs(O.chipEls, O.chips, chips, 0.25);
    setBlobs(O.holeEls, O.holes, crumble, 0.3);
    O.dust.setAttribute('opacity', (dust * 0.92).toFixed(2));
    O.rustAll.setAttribute('opacity', (0.8 * smooth(0.45, 1, rust)).toFixed(2));
    O.acidAll.setAttribute('opacity', (0.7 * smooth(0.45, 1, acid)).toFixed(2));
    for (let i = 0; i < O.pits.length; i++) O.pitEls[i].setAttribute('opacity', pits > O.pits[i].th ? '0.6' : '0');
    for (let i = 0; i < O.wh.length; i++) {
      const h = O.wh[i], k = p === 'mars' ? clamp((holes - h.th) / 0.2, 0, 1) : 0;
      O.whEls[i].setAttribute('transform', `translate(${f1(h.x)} ${f1(h.y)}) rotate(${h.rot}) scale(${k <= 0 ? 0.001 : (h.s * (0.5 + 0.5 * k)).toFixed(2)})`);
    }
    // tyres
    const gone = Math.max(smooth(0.55, 1, perish) * (p === 'seaside' ? 1 : 0.5), melt * 0.75);
    O.tyres.forEach((t) => {
      t.setAttribute('stroke', melt > 0 ? '#2a1a12' : mixHex('#1c1d21', '#5a554e', perish));
      t.setAttribute('opacity', (1 - gone).toFixed(2));
      t.setAttribute('stroke-width', melt > 0 ? '7' : '12');
    });
    O.cracks.forEach((c) => c.setAttribute('opacity', (smooth(0.15, 0.6, perish) * (1 - gone)).toFixed(2)));
    // lighting
    if (look.tint) O.tint.setAttribute('opacity', String(look.tint[2])); else O.tint.setAttribute('opacity', '0');
    O.hot.setAttribute('opacity', (0.42 * glow * (1 - 0.5 * acid)).toFixed(2));
    O.glowback.setAttribute('opacity', (0.85 * glow * (1 - smooth(0.5, 1, crumble))).toFixed(2));
    // crumble: sag, sink and finally fade away
    const sag = smooth(0.2, 1, crumble);
    O.sag.setAttribute('transform', `translate(${f1(sag * 8)} ${f1(sag * 34)}) rotate(${f1(sag * 7)} 200 ${GROUND})`);
    const objOp = 1 - smooth(0.82, 1, crumble);
    O.sag.setAttribute('opacity', objOp.toFixed(2));
    if (O.shadow.style.display !== 'none') O.shadow.style.opacity = '';
    O.shadow.setAttribute('opacity', String(look.shadow ? (look.shadow[2] * objOp).toFixed(2) : 0));
    // rover status light
    if (O.eye) {
      const off = p === 'venus' || crumble > 0.3 || (p === 'mars' && v >= 2.6) || (p === 'seaside' && v >= 2);
      O.eye.setAttribute('fill', off ? '#2a2f38' : '#5fd4ff');
    }
    // ground effects: remnants, stains, sand drifts, dunes
    let under = '', front = '';
    const remnant = smooth(0.42, 0.85, crumble) * (1 - 0.75 * smooth(0.93, 1, crumble));
    const stain = smooth(0.5, 1, crumble);
    if (crumble > 0.01 && p !== 'space') {
      const fillRem = look.remnant === 'acid' ? `url(#${U}acid)` : `url(#${U}rust)`;
      const stainCol = look.remnant === 'acid' ? '#6d5a24' : '#7a3412';
      under += `<ellipse cx="500" cy="${GROUND + 192}" rx="${f1(150 + stain * 60)}" ry="${f1(16 + stain * 6)}" fill="${stainCol}" opacity="${(0.45 * stain).toFixed(2)}"/>`;
      if (remnant > 0.01) {
        front += `<g opacity="${remnant.toFixed(2)}" fill="${fillRem}" stroke="rgba(0,0,0,.35)" stroke-width="1">
          <path d="M392 466l14-10 22 2 10 9z"/><path d="M450 468l8-14 26-4 18 10 4 9z"/><path d="M520 467l16-8 20 3 6 6z"/><path d="M574 468l10-12 34 0 12 12z"/><path d="M630 467l6-6 14 1 4 5z"/>
          <path d="M470 452c10-30 40-50 70-58" fill="none" stroke="${look.remnant === 'acid' ? '#6d5a24' : '#7a3412'}" stroke-width="7" stroke-linecap="round"/>
          <circle cx="${O.kind === 'bike' ? 402 : 395}" cy="${O.kind === 'bike' ? 432 : 440}" r="${O.kind === 'bike' ? 34 : 24}" fill="none" stroke="${look.remnant === 'acid' ? '#5b4b20' : '#6b2e10'}" stroke-width="5" stroke-dasharray="30 18 12 26" transform="scale(1 .35) translate(0 ${O.kind === 'bike' ? 860 : 850})"/>
        </g>`;
      }
    }
    if ((p === 'mars' || p === 'seaside' || p === 'moon') && O && p !== 'space') {
      const drift = p === 'mars' ? 0.3 + dust * 0.7 : p === 'moon' ? dust * 0.5 : dust * 0.6;
      const col = p === 'mars' ? '#a65a33' : p === 'moon' ? '#8a8781' : '#cdb68c';
      if (drift > 0.05) {
        const xs = O.kind === 'bike' ? [396, 612] : [386, 502, 618];
        front += xs.map((x) => `<ellipse cx="${x}" cy="${GROUND + 190}" rx="${f1(30 + 26 * drift)}" ry="${f1(4 + 6 * drift)}" fill="${col}" opacity="${(0.85 * Math.min(1, drift * 1.4)).toFixed(2)}"/>`).join('');
      }
    }
    if (p === 'mars' && buried > 0.005) {
      const top = GROUND + 190 - buried * 150;
      front += `<path d="M120 600L120 ${f1(GROUND + 196)}C260 ${f1(GROUND + 190)} 330 ${f1(top)} 500 ${f1(top - 6)}S760 ${f1(top + 20)} 880 ${f1(GROUND + 196)}L880 600Z" fill="#a65a33"/>
        <path d="M120 600L120 ${f1(GROUND + 196)}C260 ${f1(GROUND + 190)} 330 ${f1(top)} 500 ${f1(top - 6)}S760 ${f1(top + 20)} 880 ${f1(GROUND + 196)}L880 600Z" fill="url(#${U}dust-mars)" opacity=".7"/>
        <path d="M300 ${f1(top + 40)}q60-10 120 0M520 ${f1(top + 30)}q70-10 140 0M380 ${f1(top + 70)}q80-10 160 0" fill="none" stroke="#c97d50" stroke-width="2" opacity=".6"/>`;
    }
    if (p === 'venus' && O.kind === 'bike') {
      front += `<g fill="#2a1a12" opacity=".85"><ellipse cx="396" cy="${GROUND + 192}" rx="44" ry="6"/><ellipse cx="612" cy="${GROUND + 192}" rx="44" ry="6"/></g>`;
    }
    if (p === 'venus') front += `<g class="tm-shimmer" fill="none" stroke="#ffe7b8" stroke-width="2.4" opacity=".45" style="animation-delay:-1.2s"><path d="M430 250q10-10 0-20t0-20 0-20"/><path d="M560 240q10-10 0-20t0-20 0-20"/></g>`;
    underEl.innerHTML = under;
    frontEl.innerHTML = front;
    // HUD
    const si = Math.round(v);
    whenEl.textContent = `After ${cfg.stops[si]}`;
    const P = cfg.places[p];
    factEl.textContent = p === 'mars' && O.kind === 'rover' && v >= 1.5 && P.factRover2 ? P.factRover2 : P.fact;
    const st = P.status && P.status[O.kind];
    statusEl.hidden = !st;
    if (st) statusEl.querySelector('span').textContent = st;
    // slider
    const pct = (v / 5) * 100;
    thumb.style.left = `calc(var(--tm-inset,40px) + (100% - 2 * var(--tm-inset,40px)) * ${(v / 5).toFixed(4)})`;
    fillEl.style.width = pct + '%';
    stopEls.forEach((s, i) => { s.style.left = (i * 20) + '%'; s.classList.toggle('past', i <= v + 0.001); });
    labEls.forEach((l, i) => {
      l.style.left = (i * 20) + '%';
      l.classList.toggle('on', i === si);
      l.classList.toggle('show', i === si || ((i === 0 || i === 5) && Math.abs(i - si) >= 2));
    });
    slider.setAttribute('aria-valuenow', String(si));
    slider.setAttribute('aria-valuetext', cfg.stops[si]);
  }

  /* ---------- caption and speech ---------- */
  let lastStop = -1, lastKey = '', speakTimer = 0, lastSpoken = '';
  function captionText() {
    const si = Math.round(state.v);
    let c = cfg.places[state.place].captions[si];
    if (c && typeof c === 'object') c = c[state.object] || c.bike || c.rover || '';
    const thing = state.object === 'bike' ? 'bike' : 'rover';
    return String(c || '').replace(/\{thing\}/g, thing).replace(/\{Thing\}/g, thing[0].toUpperCase() + thing.slice(1));
  }
  function updateCaption(force) {
    const key = `${state.place}|${state.object}|${Math.round(state.v)}`;
    if (key === lastKey && !force) return;
    lastKey = key;
    const text = captionText();
    whyEl.textContent = text;
    clearTimeout(speakTimer);
    if (lastSpoken && lastSpoken !== text) call(ctx.stopSpeaking);
    speakTimer = setTimeout(() => { if (dead) return; if (text !== lastSpoken || force) { lastSpoken = text; call(ctx.speak, text); } }, 750);
  }

  /* ---------- progress, logging, saving ---------- */
  function persist() {
    call(ctx.save, 'tm', { place: state.place, object: state.object, visited: [...state.visited], logged: [...state.logged].slice(-40) });
  }
  function markVisited() {
    if (!state.visited.has(state.place)) {
      state.visited.add(state.place);
      persist();
    }
    placeBtns.forEach((b) => b.classList.toggle('visited', state.visited.has(b.dataset.p)));
    if (!state.completed && state.visited.size >= cfg.completeAfter) {
      state.completed = true;
      call(ctx.complete);
      if (!state.logged.has('complete')) { state.logged.add('complete'); call(ctx.log, `Tried the Metal Time Machine in ${state.visited.size} places`); persist(); }
    }
  }
  function maybeLog() {
    if (Math.round(state.v) !== 5) return;
    const key = `${state.place}:${state.object}`;
    if (state.logged.has(key)) return;
    state.logged.add(key);
    const P = cfg.places[state.place];
    const name = cfg.objects[state.object].name.toLowerCase();
    call(ctx.log, `Time machine: a ${name} ${P.in} after ${cfg.stops[5]} was ${P.outcome}.`);
    persist();
  }
  function stopChanged() {
    const si = Math.round(state.v);
    if (si !== lastStop) {
      if (lastStop !== -1 && !reduced) {
        flashEl.classList.remove('go'); void flashEl.getBoundingClientRect(); flashEl.classList.add('go');
        thumb.classList.remove('spin'); void thumb.offsetWidth; thumb.classList.add('spin');
      }
      lastStop = si;
    }
    updateCaption();
  }

  /* ---------- interactions ---------- */
  function setPlace(p) {
    if (p === state.place) { updateCaption(true); markVisited(); return; }
    state.place = p;
    buildPlace(true);
    renderTime();
    lastKey = '';
    updateCaption();
    markVisited();
    maybeLog();
    persist();
  }
  function setObject(o) {
    if (o === state.object) return;
    state.object = o;
    objBtns.forEach((b) => b.classList.toggle('on', b.dataset.o === o));
    buildObject();
    buildPlace(false);
    renderTime();
    lastKey = '';
    updateCaption();
    maybeLog();
    persist();
  }
  placeBtns.forEach((b) => on(b, 'click', () => setPlace(b.dataset.p)));
  objBtns.forEach((b) => on(b, 'click', () => setObject(b.dataset.o)));
  on($('.tm-say'), 'click', () => { lastSpoken = whyEl.textContent; call(ctx.speak, whyEl.textContent); });

  let drag = null, anim = 0;
  function valueFromX(clientX) {
    const r = track.getBoundingClientRect();
    return clamp(((clientX - r.left) / Math.max(1, r.width)) * 5, 0, 5);
  }
  function setV(v, settle) {
    state.v = clamp(v, 0, 5);
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (!dead) { renderTime(); stopChanged(); } });
    if (settle) { markVisited(); maybeLog(); }
  }
  function animateTo(target) {
    cancelAnimationFrame(anim);
    const from = state.v, t0 = performance.now(), dur = reduced ? 1 : 260;
    const step = (now) => {
      if (dead) return;
      const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      state.v = lerp(from, target, e);
      renderTime(); stopChanged();
      if (k < 1 && !document.hidden) anim = requestAnimationFrame(step);
      else { state.v = target; renderTime(); stopChanged(); markVisited(); maybeLog(); }
    };
    anim = requestAnimationFrame(step);
  }
  on(slider, 'pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    cancelAnimationFrame(anim);
    try { slider.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const tr = thumb.getBoundingClientRect();
    const onThumb = e.clientX >= tr.left - 6 && e.clientX <= tr.right + 6 && e.clientY >= tr.top - 6 && e.clientY <= tr.bottom + 6;
    drag = { pid: e.pointerId, off: onThumb ? (tr.left + tr.width / 2) - e.clientX : 0, moved: false, sx: e.clientX };
    slider.classList.add('drag');
    if (!onThumb) setV(valueFromX(e.clientX));
    slider.focus({ preventScroll: true });
  });
  on(slider, 'pointermove', (e) => {
    if (!drag || drag.pid !== e.pointerId) return;
    if (Math.abs(e.clientX - drag.sx) > 3) drag.moved = true;
    setV(valueFromX(e.clientX + drag.off));
  });
  const endDrag = (e) => {
    if (!drag || drag.pid !== e.pointerId) return;
    drag = null;
    slider.classList.remove('drag');
    animateTo(Math.round(state.v));
  };
  on(slider, 'pointerup', endDrag);
  on(slider, 'pointercancel', endDrag);
  on(slider, 'keydown', (e) => {
    let t = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') t = Math.min(5, Math.round(state.v) + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') t = Math.max(0, Math.round(state.v) - 1);
    else if (e.key === 'Home') t = 0;
    else if (e.key === 'End') t = 5;
    if (t !== null) { e.preventDefault(); animateTo(t); }
  });
  on(document, 'visibilitychange', () => root.classList.toggle('paused', document.hidden));

  /* ---------- layout ---------- */
  function layout() {
    layoutRaf = 0;
    if (dead) return;
    const W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;
    const land = W >= H * 1.1 && W >= 700;
    root.classList.toggle('land', land);
    root.classList.toggle('port', !land);
    root.classList.toggle('tiny', W < 600);
    root.classList.toggle('short', H < 760);
    root.classList.toggle('vshort', H < 560);
    if (land) {
      const sideW = clamp(Math.round(W * 0.23), 250, 330);
      root.style.setProperty('--tm-side-w', sideW + 'px');
      root.classList.toggle('nosub', sideW < 280);
      const plH = clamp(Math.floor((H - 24 - 2 * 30 - 64 - 6 * 8) / 5), 56, 92);
      root.style.setProperty('--tm-pl-h', plH + 'px');
    }
    const thumbSize = H < 560 ? 64 : 72;
    root.style.setProperty('--tm-thumb', thumbSize + 'px');
    const sw = Math.max(200, slider.clientWidth);
    // label slot width; labels wrap to two lines when the slot is narrow
    let inset = Math.round(thumbSize / 2 + 10);
    let labW = Math.floor((sw - 2 * inset) / 5) - 8;
    labW = clamp(labW, 60, 160);
    inset = Math.max(inset, Math.ceil(labW / 2) - 2);
    labW = clamp(Math.floor((sw - 2 * inset) / 5) - 8, 60, 160);
    root.style.setProperty('--tm-inset', inset + 'px');
    root.style.setProperty('--tm-lab-w', labW + 'px');
    root.classList.toggle('sparse', (sw - 2 * inset) / 5 < 78);
    root.style.setProperty('--tm-sl-h', (labW < 134 ? 128 : 112) + 'px');
  }
  const ro = new ResizeObserver(() => { if (!layoutRaf && !dead) layoutRaf = requestAnimationFrame(layout); });
  ro.observe(el);

  /* ---------- start ---------- */
  objBtns.forEach((b) => b.classList.toggle('on', b.dataset.o === state.object));
  dbgT('dom');
  buildObject();
  dbgT('object');
  buildPlace(false);
  dbgT('place');
  layout();
  renderTime();
  dbgT('render');
  lastStop = Math.round(state.v);
  updateCaption();
  placeBtns.forEach((b) => b.classList.toggle('visited', state.visited.has(b.dataset.p)));
  if (state.visited.size >= cfg.completeAfter) { state.completed = true; call(ctx.complete); }
  if (qs.get('debugPlace') || qs.get('debugTime')) markVisited();
  root.classList.toggle('paused', document.hidden);

  return {
    destroy() {
      if (dead) return;
      dead = true;
      try { ac.abort(); } catch (e) { /* ignore */ }
      try { ro.disconnect(); } catch (e) { /* ignore */ }
      if (raf) cancelAnimationFrame(raf);
      if (layoutRaf) cancelAnimationFrame(layoutRaf);
      cancelAnimationFrame(anim);
      clearTimeout(speakTimer);
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      try { root.remove(); } catch (e) { /* ignore */ }
      styleRef(-1);
    },
  };
}
