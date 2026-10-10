/*
 * Build the Moon Base  (js/games/moonbase.js)
 *
 * A top-down map of the lunar south pole (Shackleton Crater). The terrain is a
 * procedural height field lit by a very low Sun from the left: the crater rim
 * catches the light, the floor stays in permanent shadow (with frost glints),
 * and every bump casts a long shadow. Six base parts are dragged (or tapped,
 * then tapped onto the map) into place. Feedback is always gentle; parts can be
 * moved again at any time. When all six are happy the lights come on, a rover
 * drives between the garage and the ice miner, and the lunar-night twist asks
 * where the power will come from.
 *
 * Rules (distances in crater radii, R):
 *   solar  - on the rim (0.8R..1.55R from the centre) and in sunlight
 *   ice    - inside the crater, in the dark
 *   home   - outside the crater, within `near` of the solar tower, not near the pad
 *   pad    - outside the crater, at least `padFar` from home
 *   garage - outside the crater
 *   green  - outside the crater, not in shadow
 *
 * ctx.data schema (everything optional; built-in defaults are used otherwise):
 * {
 *   "intro":      "Drag each part onto the map. Where should it go?",
 *   "introTip":   "Or tap a part, then tap the map.",
 *   "names":      { "solar": "Solar tower", "ice": "Ice miner", "home": "Home",
 *                   "pad": "Landing pad", "garage": "Rover garage", "green": "Greenhouse" },
 *   "messages":   { "<id>.<key>": "line" },   // override any line in DEFAULT_MESSAGES below
 *   "lightsOn":   "Lights on! Your Moon base has power.",
 *   "lightsBack": "Lights back on!",
 *   "logText":    "Built a Moon base with power on the sunny rim",
 *   "twist": { "eyebrow": "...", "prompt": "...", "footer": "...", "ask": "...", "button": "...",
 *              "choices": [ { "label": "...", "answer": "..." } x3 ] },
 *   "nearDistance": 1.7,   // how close home must be to the solar tower (crater radii)
 *   "padDistance":  1.7    // how far the landing pad must be from home (crater radii)
 * }
 *
 * Debug URL params (harmless): debugPlaceAll=1, debugNight=1, debugReveal=0..2,
 * debugBad=1, debugSelect=<id>.
 */

const IDS = ['solar', 'ice', 'home', 'pad', 'garage', 'green'];
const TAN_E = Math.tan(4.5 * Math.PI / 180);          // Sun elevation used for shadows
const SUN = norm3(-0.93, -0.27, 0.26);                  // light direction for shading (towards the Sun)
const SKY = norm3(0.75, -0.05, 0.66);                   // faint light scattered off the sunlit far wall

const DEFAULT_MESSAGES = {
  'solar.good': 'Sunny spot! Power on.',
  'solar.dark': "It's too dark here for solar panels. Try the bright rim!",
  'solar.shadow': 'This spot is in a long shadow. Try the bright rim!',
  'solar.plain': 'Solar panels love the high, bright rim. Try up there!',
  'ice.good': 'Found ice! It has been frozen in the dark for billions of years.',
  'ice.sunwall': 'The Sun shines on this wall, so the ice is gone. Go deeper into the dark!',
  'ice.dry': 'No ice here. The Sun warms the ground. Try inside the dark crater!',
  'home.good': 'Home sweet home, right next to the power!',
  'home.wait': 'Cosy spot! Now put the solar tower close by for power.',
  'home.far': 'Your home is far from the power. Move it closer to the solar tower!',
  'home.crater': 'Brrr! The crater is dark and freezing. Homes like the sunny side!',
  'home.pad': 'Too close to the landing pad! Rocket dust would sandblast your house.',
  'pad.good': "Good! Rocket dust won't sandblast your house.",
  'pad.wait': 'Landing pad ready! Keep it far away from your home.',
  'pad.close': 'Whoa, rocket exhaust blasts dust like sandpaper. Move it further away!',
  'pad.crater': 'Landing in the dark crater is too tricky. Try flat ground outside!',
  'garage.good': 'Garage built! The rover can drive out to the ice.',
  'garage.crater': 'Too dark and steep to park in there. Try outside the crater!',
  'green.good': 'Plants love sunshine. Lettuce on the Moon!',
  'green.crater': 'Plants need light! Try a sunny spot outside the crater.',
  'green.shadow': 'Plants need sunshine, and this spot is in shadow. Try a brighter spot!',
  'tap.select': 'Now tap the map to place the {name}.',
  'tap.move': 'Tap the map to move the {name}.',
  'removed': 'The {name} is back in the tray.',
  'zone.crater': 'Shackleton Crater. It is always dark inside, and ice hides there.',
  'zone.rim': 'The crater rim. The Sun shines here most of the year.',
  'zone.plain': 'Grey Moon dust and rocks. The Sun is low, so shadows are long.',
  'reset.confirm': 'Tap again to start over.',
  'restored': 'Your Moon base is lit! Tap Lunar night for a new challenge.',
};

const DEFAULTS = {
  intro: 'Drag each part onto the map. Where should it go?',
  introTip: 'Or tap a part, then tap the map.',
  names: { solar: 'Solar tower', ice: 'Ice miner', home: 'Home', pad: 'Landing pad', garage: 'Rover garage', green: 'Greenhouse' },
  messages: DEFAULT_MESSAGES,
  lightsOn: 'Lights on! Your Moon base has power.',
  lightsBack: 'Lights back on!',
  logText: 'Built a Moon base with power on the sunny rim',
  near: 1.7,
  padFar: 1.7,
  twist: {
    eyebrow: 'Plot twist',
    prompt: 'Lunar night is coming: two weeks of dark! Where will the power come from?',
    choices: [
      { label: 'Big batteries', answer: 'Batteries save sunshine for later. Two weeks of dark needs lots of them, and they are heavy!' },
      { label: 'A tiny nuclear power plant', answer: 'A small nuclear power plant makes power day and night. NASA is working on one for the Moon.' },
      { label: 'Solar towers on sunny peaks', answer: "Shackleton's rim gets sunshine more than 90% of the year, so tall towers there hardly ever go dark!" },
    ],
    footer: "NASA is testing all of these. There's no single right answer.",
    ask: 'Which would you pick? Why?',
    button: 'Back to the base',
  },
};

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const CSS = `
.g-moonbase{position:absolute;inset:0;display:grid;overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--font-body);user-select:none;-webkit-user-select:none}
.g-moonbase.land{grid-template-columns:minmax(0,1fr) var(--mb-tray-w,310px);grid-template-rows:minmax(0,1fr)}
.g-moonbase.port{grid-template-rows:minmax(0,1fr) auto;grid-template-columns:minmax(0,1fr)}
.g-moonbase .mb-map{position:relative;overflow:hidden;touch-action:none;background:#141518;min-height:0;min-width:0}
.g-moonbase .mb-map.picking{cursor:crosshair}
.g-moonbase .mb-map canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none}
.g-moonbase .mb-layer,.g-moonbase .mb-labels{position:absolute;inset:0;pointer-events:none}
.g-moonbase .mb-label{position:absolute;left:0;top:0;transform:translate(-50%,-50%);text-align:center;font-family:var(--font-display);font-weight:600;font-size:18px;letter-spacing:.16em;text-transform:uppercase;color:rgba(185,192,207,.78);white-space:nowrap;text-shadow:0 1px 8px rgba(0,0,0,.9);transition:opacity .6s}
.g-moonbase .mb-label span{display:block;margin-top:2px;font-family:var(--font-body);font-weight:500;font-size:18px;letter-spacing:.01em;text-transform:none;color:rgba(124,196,255,.78)}
.g-moonbase .mb-label.rim{color:rgba(255,210,122,.92);text-shadow:0 1px 8px rgba(0,0,0,.95)}
.g-moonbase.night .mb-label{opacity:.35}
.g-moonbase .mb-sun{position:absolute;left:12px;top:0;transform:translateY(-50%);display:flex;align-items:center;gap:8px;padding:6px 14px 6px 8px;border-radius:999px;background:rgba(5,7,13,.55);border:1px solid rgba(255,210,122,.35);color:var(--gold-2);font-family:var(--font-display);font-weight:600;font-size:18px;pointer-events:none;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);transition:opacity .6s}
.g-moonbase .mb-sun svg{width:34px;height:34px;flex:none}
.g-moonbase .mb-sun .arr{width:30px;height:18px}
.g-moonbase.night .mb-sun{opacity:.25}
.g-moonbase .mb-marker{position:absolute;left:0;top:0;width:var(--mb-mark,84px);height:var(--mb-mark,84px);margin:calc(var(--mb-mark,84px) / -2) 0 0 calc(var(--mb-mark,84px) / -2);border-radius:50%;pointer-events:auto;touch-action:none;cursor:grab;background:radial-gradient(circle at 36% 30%,rgba(44,55,84,.96),rgba(9,12,22,.96) 72%);border:2px solid rgba(255,255,255,.3);box-shadow:14px 5px 14px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.14);transition:box-shadow .5s,border-color .3s,opacity .2s,transform .2s}
.g-moonbase .mb-marker > svg{position:absolute;left:8%;top:8%;width:84%;height:84%}
.g-moonbase .mb-marker.ok{border-color:rgba(111,227,165,.9)}
.g-moonbase .mb-marker.bad{border-color:rgba(242,181,68,.95)}
.g-moonbase .mb-marker.sel{box-shadow:0 0 0 5px rgba(242,181,68,.55),14px 5px 14px rgba(0,0,0,.62);animation:mb-selpulse 1.3s ease-in-out infinite}
@keyframes mb-selpulse{50%{box-shadow:0 0 0 11px rgba(242,181,68,.12),14px 5px 14px rgba(0,0,0,.62)}}
.g-moonbase .mb-marker.lifted{transform:scale(1.14);box-shadow:24px 12px 24px rgba(0,0,0,.55);z-index:4;cursor:grabbing;transition:none;animation:none}
.g-moonbase .mb-marker.ghosted{opacity:.22}
.g-moonbase .mb-marker.pop{animation:mb-pop .45s cubic-bezier(.2,1.6,.4,1)}
@keyframes mb-pop{0%{transform:scale(1.25)}100%{transform:scale(1)}}
.g-moonbase .mb-pip{position:absolute;right:-4px;top:-4px;width:30px;height:30px;border-radius:50%;display:none;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.55)}
.g-moonbase .mb-pip svg{width:18px;height:18px}
.g-moonbase .ok > .mb-pip{display:grid;background:var(--green);color:#052414}
.g-moonbase .bad > .mb-pip{display:grid;background:var(--gold);color:#1a1205}
.g-moonbase.lit .mb-marker.ok{border-color:var(--gold-2);box-shadow:0 0 30px rgba(255,210,122,.55),14px 5px 14px rgba(0,0,0,.62)}
.g-moonbase .win{transition:fill .8s,opacity .8s}
.g-moonbase.lit .mb-layer .win{fill:var(--gold-2);opacity:1}
.g-moonbase .mb-ghost{position:absolute;left:0;top:0;z-index:30;pointer-events:none;transform:scale(1.14);box-shadow:24px 12px 24px rgba(0,0,0,.55);transition:none;animation:none}
.g-moonbase .mb-caption{position:absolute;left:50%;top:12px;transform:translateX(-50%);width:min(720px,calc(100% - 24px));display:flex;gap:14px;align-items:center;padding:10px 12px 10px 14px;z-index:8;border-radius:20px;pointer-events:auto;transition:border-color .4s}
.g-moonbase .mb-caption.ok{border-color:rgba(111,227,165,.55)}
.g-moonbase .mb-caption.hint{border-color:rgba(242,181,68,.55)}
.g-moonbase .mb-cap-ic{width:52px;height:52px;flex:none;border-radius:50%;background:rgba(255,255,255,.05);display:grid;place-items:center}
.g-moonbase .mb-cap-ic svg{width:44px;height:44px}
.g-moonbase .mb-cap-body{flex:1;min-width:0}
.g-moonbase .mb-cap-txt{font-size:21px;line-height:1.3;font-weight:500}
.g-moonbase .mb-cap-sub{font-size:18px;line-height:1.3;color:var(--ink-2);margin-top:2px}
.g-moonbase .mb-cap-sub:empty{display:none}
.g-moonbase .mb-caption .speak-btn{width:56px;height:56px}
.g-moonbase .mb-cap-act{min-height:56px;padding:0 20px;font-size:19px}
.g-moonbase .mb-banner{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.8);z-index:9;pointer-events:none;opacity:0;font-family:var(--font-display);font-weight:700;font-size:clamp(44px,7vw,88px);letter-spacing:.04em;color:var(--gold-2);text-shadow:0 0 30px rgba(242,181,68,.7),0 4px 30px rgba(0,0,0,.8);white-space:nowrap}
.g-moonbase .mb-banner.show{animation:mb-banner 3.4s ease forwards}
@keyframes mb-banner{0%{opacity:0;transform:translate(-50%,-50%) scale(.8)}14%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}22%{transform:translate(-50%,-50%) scale(1)}78%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.02)}}
.g-moonbase .mb-tray{display:flex;flex-direction:column;gap:10px;padding:12px;background:linear-gradient(180deg,rgba(14,20,38,.96),rgba(7,10,20,.98));min-height:0;overflow:auto}
.g-moonbase.land .mb-tray{border-left:1px solid var(--line)}
.g-moonbase.port .mb-tray{border-top:1px solid var(--line)}
.g-moonbase .mb-tray-head{display:flex;align-items:center;gap:10px;min-height:56px}
.g-moonbase .mb-prog{flex:1;display:flex;flex-direction:column;gap:6px;font-family:var(--font-display);font-weight:600;font-size:19px;color:var(--ink-2)}
.g-moonbase .mb-dots{display:flex;gap:6px}
.g-moonbase .mb-dots i{width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.15);transition:background .3s}
.g-moonbase .mb-dots i.ok{background:var(--green);border-color:var(--green)}
.g-moonbase .mb-dots i.bad{background:var(--gold);border-color:var(--gold)}
.g-moonbase .mb-reset{width:56px;height:56px;min-height:56px;padding:0;flex:none}
.g-moonbase .mb-reset.armed{border-color:var(--gold);color:var(--gold)}
.g-moonbase .mb-reset svg{width:26px;height:26px}
.g-moonbase .mb-tiles{display:grid;grid-template-columns:repeat(var(--mb-cols,2),minmax(0,1fr));gap:10px;align-content:start}
.g-moonbase .mb-tile{appearance:none;position:relative;border:1.5px solid var(--line);background:rgba(255,255,255,.035);border-radius:18px;color:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px 6px 10px;touch-action:none;cursor:grab;font-family:var(--font-display);font-weight:600;font-size:18px;line-height:1.15;text-align:center;transition:border-color .25s,background .25s,opacity .25s;min-width:0}
.g-moonbase .mb-tile > svg{width:var(--mb-icon,100px);height:var(--mb-icon,100px);flex:none;filter:drop-shadow(0 6px 10px rgba(0,0,0,.45))}
.g-moonbase .mb-tile:active{background:rgba(255,255,255,.07)}
.g-moonbase .mb-tile.sel{border-color:var(--gold);background:rgba(242,181,68,.1);box-shadow:0 0 0 3px rgba(242,181,68,.3)}
.g-moonbase .mb-tile.placed > svg{opacity:.38}
.g-moonbase .mb-tile.placed .mb-tl{color:var(--ink-2)}
.g-moonbase .mb-tile .mb-pip{right:6px;top:6px}
.g-moonbase .mb-twist{position:absolute;inset:0;z-index:12;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(2,3,8,.35);opacity:0;transition:opacity .6s}
.g-moonbase .mb-twist.show{opacity:1}
.g-moonbase .mb-twist[hidden]{display:none}
.g-moonbase .mb-twist-card{width:min(980px,100%);max-height:100%;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:20px 22px}
.g-moonbase .mb-twist-top{display:flex;gap:14px;align-items:flex-start}
.g-moonbase .mb-twist-top > div{flex:1}
.g-moonbase .mb-twist-q{font-size:clamp(23px,2.4vw,30px);line-height:1.2;margin-top:4px}
.g-moonbase .mb-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.g-moonbase.narrow .mb-choices{grid-template-columns:1fr}
.g-moonbase .mb-choice{appearance:none;cursor:pointer;text-align:left;border-radius:18px;border:2px solid var(--line);background:rgba(255,255,255,.04);color:var(--ink);padding:10px 12px 14px;display:flex;flex-direction:column;gap:8px;font-family:var(--font-display);font-weight:600;font-size:21px;line-height:1.2;min-height:56px;transition:border-color .25s,background .25s}
.g-moonbase .mb-choice svg{width:100%;height:auto;aspect-ratio:16/10;border-radius:12px;background:#07090f;display:block}
.g-moonbase .mb-choice .ans{display:none;font-family:var(--font-body);font-weight:400;font-size:19px;line-height:1.35;color:var(--ink)}
.g-moonbase .mb-choice.open{border-color:var(--gold);background:rgba(242,181,68,.08)}
.g-moonbase .mb-choice.open .ans{display:block;animation:fadein .4s ease}
.g-moonbase.narrow .mb-choice{flex-direction:row;align-items:center;flex-wrap:wrap}
.g-moonbase.narrow .mb-choice svg{width:120px;flex:none}
.g-moonbase.narrow .mb-choice .lab{flex:1}
.g-moonbase.narrow .mb-choice .ans{flex-basis:100%}
.g-moonbase .mb-twist-foot{display:flex;gap:14px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:12px}
.g-moonbase .mb-twist-foot[hidden]{display:none}
.g-moonbase .mb-twist-foot p{flex:1;min-width:240px;margin:0;font-size:20px}
.g-moonbase .mb-twist-foot p b{color:var(--gold-2);font-weight:600;display:block}
@media (prefers-reduced-motion: reduce){.g-moonbase .mb-marker.sel{animation:none}.g-moonbase .mb-banner.show{animation:mb-banner 3.4s steps(1) forwards}}
`;

function styleRef(delta) {
  let s = document.querySelector('style[data-module="moonbase"]');
  if (!s && delta > 0) {
    s = document.createElement('style');
    s.setAttribute('data-module', 'moonbase');
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  if (!s) return;
  const n = (+s.dataset.refs || 0) + delta;
  s.dataset.refs = String(n);
  if (n <= 0) s.remove();
}

/* ------------------------------------------------------------------ */
/* Icons (viewBox 0 0 96 96).  Colours via CSS variables in style=.     */
/* ------------------------------------------------------------------ */

const ST = 'var(--steel)';
const ICONS = {
  solar: `
    <ellipse cx="54" cy="88" rx="26" ry="4.5" fill="rgba(0,0,0,.35)"/>
    <path d="M48 86V17" style="stroke:${ST}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M48 85l-13 5M48 85l13 5" style="stroke:${ST}" stroke-width="2.6" stroke-linecap="round"/>
    <g stroke-width="1.6" stroke-linejoin="round" style="stroke:${ST}">
      <path d="M17 21l27 2v15l-27-2z" fill="#1d3a6c"/><path d="M79 21l-27 2v15l27-2z" fill="#22457f"/>
      <path d="M17 42l27 2v15l-27-2z" fill="#1d3a6c"/><path d="M79 42l-27 2v15l27-2z" fill="#22457f"/>
      <path d="M21 63l23 1.6v12l-23-1.6z" fill="#1d3a6c"/><path d="M75 63l-23 1.6v12l23-1.6z" fill="#22457f"/>
    </g>
    <g stroke="rgba(124,196,255,.45)" stroke-width=".9">
      <path d="M26 21.7v15M35 22.3v15M17 29l27 2M61 22.3v15M70 21.7v15M79 29l-27 2"/>
      <path d="M26 42.7v15M35 43.3v15M17 50l27 2M61 43.3v15M70 42.7v15M79 50l-27 2"/>
      <path d="M29 63.6v12M37 64.1v12M61 64.1v12M68 63.6v12"/>
    </g>
    <path d="M19 23.5l11 .8M54 24.6l10-.7" stroke="rgba(255,255,255,.55)" stroke-width="1.6" stroke-linecap="round"/>
    <circle class="win" cx="48" cy="13" r="4" style="fill:var(--gold)" opacity=".85"/>`,
  ice: `
    <ellipse cx="50" cy="86" rx="34" ry="4.5" fill="rgba(0,0,0,.35)"/>
    <rect x="10" y="64" width="54" height="16" rx="8" fill="#23272f" style="stroke:${ST}" stroke-width="2"/>
    <g style="fill:${ST}" opacity=".8"><circle cx="18" cy="72" r="4"/><circle cx="30" cy="72" r="4"/><circle cx="42" cy="72" r="4"/><circle cx="55" cy="72" r="4"/></g>
    <path d="M14 64V47a7 7 0 0 1 7-7h27l11 12v12z" fill="#d6dbe3" stroke="#8d96a6" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M14 56h45" stroke="rgba(0,0,0,.18)" stroke-width="2"/>
    <rect class="win" x="21" y="45" width="15" height="8" rx="2.5" style="fill:var(--cyan)" opacity=".75"/>
    <path d="M56 52l13-14 10 15" fill="none" style="stroke:${ST}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M74 52h10l-5 22z" style="fill:var(--gold)"/>
    <path d="M76 58h6M77 64h4" stroke="#1a1205" stroke-width="1.4" opacity=".55"/>
    <g style="stroke:var(--cyan)" stroke-width="2" stroke-linecap="round" fill="none">
      <path d="M84 77l7-4M84 77l7 4M84 77v-8M84 77v8M84 77l-7-4M84 77l-7 4"/>
    </g>
    <path d="M68 84l4-5 4 5-4 3z" style="fill:var(--oxygen)" opacity=".8"/>`,
  home: `
    <ellipse cx="52" cy="85" rx="40" ry="5" fill="rgba(0,0,0,.35)"/>
    <path d="M9 82a36 32 0 0 1 70 0z" fill="#8a857c"/>
    <path d="M9 82a36 32 0 0 1 70 0" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.6"/>
    <path d="M17 82a28 24 0 0 1 54 0M27 82a18 16 0 0 1 34 0" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1.4"/>
    <g fill="rgba(0,0,0,.18)"><circle cx="24" cy="70" r="1.6"/><circle cx="36" cy="59" r="1.4"/><circle cx="56" cy="57" r="1.8"/><circle cx="65" cy="68" r="1.5"/><circle cx="45" cy="66" r="1.2"/></g>
    <path d="M26 58a28 24 0 0 1 22-11" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M70 82V69h17v13z" style="fill:${ST}" stroke="#7d869a" stroke-width="1.4"/>
    <rect x="76" y="72" width="7" height="10" rx="1.5" fill="#2b313d"/>
    <rect class="win" x="31" y="66" width="9" height="7" rx="2" style="fill:var(--gold-2)" opacity=".45"/>
    <rect class="win" x="45" y="62" width="9" height="7" rx="2" style="fill:var(--gold-2)" opacity=".45"/>
    <path d="M5 82h86" style="stroke:${ST}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`,
  pad: `
    <ellipse cx="50" cy="70" rx="43" ry="17" fill="rgba(0,0,0,.3)"/>
    <ellipse cx="48" cy="67" rx="42" ry="16" fill="#555a64" style="stroke:${ST}" stroke-width="2"/>
    <ellipse cx="48" cy="67" rx="31" ry="11" fill="none" style="stroke:var(--gold)" stroke-width="2.2" stroke-dasharray="6 5"/>
    <path d="M40 63v8M56 63v8M40 67h16" stroke="rgba(243,239,230,.8)" stroke-width="2.6" stroke-linecap="round"/>
    <g class="win" style="fill:var(--red)" opacity=".7"><circle cx="8" cy="67" r="2.6"/><circle cx="88" cy="67" r="2.6"/><circle cx="48" cy="51.5" r="2.6"/><circle cx="48" cy="82.5" r="2.6"/><circle cx="20" cy="56" r="2.2"/><circle cx="76" cy="56" r="2.2"/><circle cx="20" cy="78" r="2.2"/><circle cx="76" cy="78" r="2.2"/></g>
    <path d="M43 58V22c0-6 2-11 5-15 3 4 5 9 5 15v36z" fill="#d9dde4" stroke="#8d96a6" stroke-width="1.4"/>
    <path d="M43 58l-6 6M53 58l6 6" style="stroke:${ST}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M45 24c0-5 1.3-9 3-12" stroke="rgba(255,255,255,.7)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <rect x="43" y="40" width="10" height="5" fill="#2b313d" opacity=".55"/>`,
  garage: `
    <ellipse cx="52" cy="85" rx="40" ry="5" fill="rgba(0,0,0,.35)"/>
    <path d="M10 82V54a38 32 0 0 1 76 0v28z" fill="#3b4354" style="stroke:${ST}" stroke-width="2"/>
    <path d="M22 82V45M35 82V36M61 82V36M74 82V45" stroke="rgba(255,255,255,.12)" stroke-width="2"/>
    <path d="M18 46a34 28 0 0 1 30-18" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M27 82V63a21 17 0 0 1 42 0v19z" fill="#0b0f1a"/>
    <rect x="33" y="66" width="30" height="9" rx="2.5" style="fill:var(--gold)"/>
    <rect x="38" y="62" width="14" height="4" rx="1" fill="#1d3a6c"/>
    <circle cx="37" cy="78" r="4" fill="#1b1f27" style="stroke:${ST}" stroke-width="1.6"/>
    <circle cx="59" cy="78" r="4" fill="#1b1f27" style="stroke:${ST}" stroke-width="1.6"/>
    <circle class="win" cx="34.5" cy="70" r="1.8" style="fill:var(--gold-2)" opacity=".6"/>
    <circle class="win" cx="61.5" cy="70" r="1.8" style="fill:var(--gold-2)" opacity=".6"/>
    <path d="M6 82h84" style="stroke:${ST}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`,
  green: `
    <ellipse cx="52" cy="85" rx="40" ry="5" fill="rgba(0,0,0,.35)"/>
    <path class="win" d="M12 82a36 34 0 0 1 72 0z" style="fill:var(--green)" opacity=".14"/>
    <g fill="none" stroke="rgba(201,206,214,.55)" stroke-width="1.3">
      <path d="M30 82a18 34 0 0 1 36 0"/><path d="M48 48v34"/><path d="M15 69h66"/><path d="M22 57h52"/>
    </g>
    <g style="fill:var(--green)">
      <path d="M24 82c-1-9 3-14 9-16-1 7-4 12-9 16z"/><path d="M33 82c1-8 6-12 11-12-2 6-6 10-11 12z" opacity=".8"/>
      <path d="M46 82c-2-11 2-17 8-20 0 8-3 15-8 20z"/><path d="M57 82c0-8 5-13 10-14-1 7-5 11-10 14z" opacity=".85"/>
      <path d="M66 82c0-6 4-10 8-11 0 5-3 9-8 11z" opacity=".75"/>
    </g>
    <path d="M12 82a36 34 0 0 1 72 0" fill="none" style="stroke:${ST}" stroke-width="2.2"/>
    <path d="M22 60a28 28 0 0 1 16-14" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M6 82h84" style="stroke:${ST}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`,
};
const ICON_MOON = `<circle cx="48" cy="48" r="30" fill="#9a978f"/><circle cx="38" cy="40" r="7" fill="#7d7a73"/><circle cx="58" cy="58" r="9" fill="#7d7a73"/><circle cx="60" cy="34" r="4" fill="#85827a"/><path d="M48 18a30 30 0 0 1 0 60a38 38 0 0 0 0-60z" fill="rgba(0,0,0,.35)"/>`;
const svgIcon = (id) => `<svg viewBox="0 0 96 96" aria-hidden="true">${ICONS[id] || ICON_MOON}</svg>`;
const SVG_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const SVG_BANG = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="10.3" y="4" width="3.4" height="11" rx="1.7"/><circle cx="12" cy="19.2" r="2"/></svg>';
const SVG_SPEAK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const SVG_RESET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/></svg>';
const SVG_SUN = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="8" fill="#ffd27a"/><g stroke="#ffd27a" stroke-width="2.4" stroke-linecap="round"><path d="M20 4v5M20 31v5M4 20h5M31 20h5M8.7 8.7l3.5 3.5M27.8 27.8l3.5 3.5M8.7 31.3l3.5-3.5M27.8 12.2l3.5-3.5"/></g></svg>';
const SVG_ARROW = '<svg class="arr" viewBox="0 0 30 18" fill="none" stroke="#ffd27a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9h24M19 3l7 6-7 6"/></svg>';

const TWIST_PICS = [
  // Big batteries
  `<svg viewBox="0 0 160 100" aria-hidden="true">
    <rect width="160" height="100" fill="#07090f"/>
    <path d="M0 78c30-6 60-4 90-8s50 2 70 0v30H0z" fill="#2a2b2f"/>
    <g>
      <rect x="22" y="38" width="32" height="44" rx="5" fill="#2b3346" stroke="#c9ced6" stroke-width="2"/>
      <rect x="31" y="33" width="14" height="6" rx="2" fill="#c9ced6"/>
      <rect x="27" y="62" width="22" height="15" rx="2" fill="#6fe3a5"/><rect x="27" y="50" width="22" height="9" rx="2" fill="#6fe3a5" opacity=".55"/>
      <rect x="64" y="30" width="32" height="52" rx="5" fill="#2b3346" stroke="#c9ced6" stroke-width="2"/>
      <rect x="73" y="25" width="14" height="6" rx="2" fill="#c9ced6"/>
      <rect x="69" y="58" width="22" height="19" rx="2" fill="#6fe3a5"/><rect x="69" y="44" width="22" height="11" rx="2" fill="#6fe3a5" opacity=".55"/>
      <rect x="106" y="38" width="32" height="44" rx="5" fill="#2b3346" stroke="#c9ced6" stroke-width="2"/>
      <rect x="115" y="33" width="14" height="6" rx="2" fill="#c9ced6"/>
      <rect x="111" y="62" width="22" height="15" rx="2" fill="#6fe3a5"/>
      <path d="M84 8l-10 14h7l-4 11 11-15h-7z" fill="#ffd27a"/>
    </g></svg>`,
  // Tiny nuclear power plant
  `<svg viewBox="0 0 160 100" aria-hidden="true">
    <defs><radialGradient id="mbNukeGlow"><stop offset="0" stop-color="#5fd4ff" stop-opacity=".45"/><stop offset="1" stop-color="#5fd4ff" stop-opacity="0"/></radialGradient></defs>
    <rect width="160" height="100" fill="#07090f"/>
    <path d="M0 80c40-5 80-3 160-6v26H0z" fill="#2a2b2f"/>
    <circle cx="80" cy="56" r="40" fill="url(#mbNukeGlow)"/>
    <path d="M26 34l40 8v22l-40 8z" fill="#3b4354" stroke="#c9ced6" stroke-width="1.6"/>
    <path d="M134 34l-40 8v22l40 8z" fill="#3b4354" stroke="#c9ced6" stroke-width="1.6"/>
    <path d="M34 36v34M42 37.5v31M50 39v28M58 40.5v25M126 36v34M118 37.5v31M110 39v28M102 40.5v25" stroke="rgba(255,255,255,.18)" stroke-width="1.4"/>
    <path d="M70 80V30l10-12 10 12v50z" fill="#d9dde4" stroke="#8d96a6" stroke-width="1.4"/>
    <rect x="70" y="58" width="20" height="10" fill="#f2b544"/>
    <path d="M70 80l-8 8M90 80l8 8" stroke="#c9ced6" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="80" cy="44" r="4" fill="#5fd4ff"/>
  </svg>`,
  // Solar towers on sunny peaks
  `<svg viewBox="0 0 160 100" aria-hidden="true">
    <defs><linearGradient id="mbPeakLit" x1="0" x2="1"><stop offset="0" stop-color="#d8d2c4"/><stop offset="1" stop-color="#6d6a63"/></linearGradient></defs>
    <rect width="160" height="100" fill="#07090f"/>
    <circle cx="10" cy="40" r="9" fill="#ffd27a"/><circle cx="10" cy="40" r="18" fill="#ffd27a" opacity=".15"/>
    <path d="M0 100V78l30-8 30-34 22 22 18-6 60 30v18z" fill="#141519"/>
    <path d="M60 36l22 22 18-6 10 5-36 4z" fill="url(#mbPeakLit)" opacity=".9"/>
    <path d="M30 70l30-34 8 30z" fill="#bfb9ad"/>
    <g stroke="#c9ced6" stroke-width="1.8"><path d="M60 36V10M74 50V24"/></g>
    <g fill="#22457f" stroke="#c9ced6" stroke-width="1"><rect x="52" y="10" width="7" height="12"/><rect x="61" y="10" width="7" height="12"/><rect x="66" y="25" width="7" height="12"/><rect x="75" y="25" width="7" height="12"/></g>
    <path d="M14 40h30" stroke="#ffd27a" stroke-width="1.4" stroke-dasharray="3 4" opacity=".7"/>
  </svg>`,
];

/* ------------------------------------------------------------------ */
/* Maths, noise and terrain                                             */
/* ------------------------------------------------------------------ */

function norm3(x, y, z) { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const r = mulberry32(seed);
  const perm = new Uint16Array(512);
  const val = new Float32Array(256);
  const p = [];
  for (let i = 0; i < 256; i++) { p.push(i); val[i] = r() * 2 - 1; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = val[perm[perm[X] + Y]], b = val[perm[perm[X + 1] + Y]];
    const c = val[perm[perm[X] + Y + 1]], d = val[perm[perm[X + 1] + Y + 1]];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct) {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += amp * n2(x * f, y * f); n += amp; amp *= 0.5; f *= 2.03; }
    return s / n;
  }
  return { n2, fbm };
}

/* Terrain in "crater radii": Shackleton has radius 1 and sits at the origin. */
function makeTerrain() {
  const N = makeNoise(7), N2 = makeNoise(13);
  const rnd = mulberry32(424242);
  const ph = [rnd() * 6.283, rnd() * 6.283, rnd() * 6.283, rnd() * 6.283];
  const rimR = (th) => 1 + 0.03 * Math.sin(3 * th + ph[0]) + 0.022 * Math.sin(5 * th + ph[1]) + 0.012 * Math.sin(9 * th + ph[2]) + 0.006 * Math.sin(17 * th + ph[3]);
  const feats = [];
  let tries = 0;
  while (feats.length < 120 && tries < 4000) {
    tries++;
    const x = (rnd() * 2 - 1) * 7, y = (rnd() * 2 - 1) * 6;
    const u = rnd();
    const r = 0.04 + 0.4 * u * u * u * u;
    if (Math.hypot(x, y) < 1.6 + r * 1.6) continue;
    feats.push({ k: 0, x, y, r, dep: r * (0.36 + 0.14 * rnd()), rim: r * (0.07 + 0.05 * rnd()) });
  }
  for (let i = 0; i < 8; i++) {
    const a = rnd() * 6.283, d = rnd() * 0.6, r = 0.05 + 0.1 * rnd();
    feats.push({ k: 0, x: Math.cos(a) * d, y: Math.sin(a) * d, r, dep: r * 0.32, rim: r * 0.07 });
  }
  for (let i = 0; i < 300; i++) {
    const x = (rnd() * 2 - 1) * 7, y = (rnd() * 2 - 1) * 6;
    if (Math.hypot(x, y) < 1.0) continue;
    const r = 0.016 + 0.05 * rnd() * rnd();
    feats.push({ k: 1, x, y, r, h: r * (0.45 + 0.7 * rnd()) });
  }
  // a few "peaks of light" on the rim
  for (const a of [2.55, 3.05, 3.55, 4.0, 2.1]) {
    const rr = rimR(a) * 1.03;
    feats.push({ k: 1, x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: 0.07 + rnd() * 0.04, h: 0.04 + rnd() * 0.025 });
  }
  const CELL = 0.5, GX0 = -8, GY0 = -7, GW = 32, GH = 28;
  const grid = Array.from({ length: GW * GH }, () => []);
  for (const f of feats) {
    const ext = f.r * 2.2;
    const i0 = Math.max(0, Math.floor((f.x - ext - GX0) / CELL)), i1 = Math.min(GW - 1, Math.floor((f.x + ext - GX0) / CELL));
    const j0 = Math.max(0, Math.floor((f.y - ext - GY0) / CELL)), j1 = Math.min(GH - 1, Math.floor((f.y + ext - GY0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) grid[j * GW + i].push(f);
  }
  function big(q) {
    const D = 0.5, H = 0.11;
    if (q < 1) return -D + (D + H) * Math.pow(q, 2.3);
    const t = (q - 1) / 0.42;
    return H * Math.exp(-t * t);
  }
  function height(x, y) {
    let h = 0.02 * N.fbm(x * 0.6 + 3.1, y * 0.6 + 1.7, 4) + 0.007 * N2.fbm(x * 2.7 + 9.2, y * 2.7 + 4.4, 3);
    const r = Math.hypot(x, y);
    if (r < 2.8) h += big(r / rimR(Math.atan2(y, x)));
    const ci = Math.floor((x - GX0) / CELL), cj = Math.floor((y - GY0) / CELL);
    if (ci >= 0 && cj >= 0 && ci < GW && cj < GH) {
      const list = grid[cj * GW + ci];
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        const dx = x - f.x, dy = y - f.y, d2 = dx * dx + dy * dy;
        if (f.k === 0) {
          const lim = f.r * 2;
          if (d2 > lim * lim) continue;
          const q = Math.sqrt(d2) / f.r;
          if (q < 1) h += -f.dep + (f.dep + f.rim) * q * q;
          else { const t = 2 - q; h += f.rim * t * t; }
        } else {
          const q2 = d2 / (f.r * f.r);
          if (q2 > 4.6) continue;
          h += f.h * Math.exp(-q2 * 1.6);
        }
      }
    }
    return h;
  }
  const qAt = (x, y) => Math.hypot(x, y) / rimR(Math.atan2(y, x));
  function litAt(x, y) {
    const h0 = height(x, y) + 0.003;
    for (let d = 0.03; d < 3.4; d += 0.03) if (height(x - d, y) > h0 + d * TAN_E) return 0;
    return 1;
  }
  function litFrac(x, y) {
    const o = 0.13;
    return (2 * litAt(x, y) + litAt(x - o, y) + litAt(x + o, y) + litAt(x, y - o) + litAt(x, y + o)) / 6;
  }
  return { height, qAt, litAt, litFrac, albedo: (x, y) => 0.9 + 0.2 * N2.fbm(x * 1.1 + 20, y * 1.1 + 5, 2), frost: (x, y) => N.n2(x * 5 + 40, y * 5 + 11) };
}

let TERRAIN = null; // shared, deterministic

/* ------------------------------------------------------------------ */
/* Sound (soft WebAudio blips, only if ctx.sound)                        */
/* ------------------------------------------------------------------ */

function makeAudio(enabled) {
  let ac = null;
  function ensure() {
    if (!enabled) return null;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume().catch(() => {});
    } catch (e) { return null; }
    return ac;
  }
  function tone(f, t0, dur, type = 'sine', g = 0.06) {
    const a = ensure(); if (!a) return;
    try {
      const o = a.createOscillator(), gn = a.createGain();
      o.type = type; o.frequency.value = f;
      const t = a.currentTime + t0;
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(g, t + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn).connect(a.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  return {
    unlock() { ensure(); },
    place() { tone(150, 0, 0.22, 'sine', 0.09); tone(75, 0, 0.3, 'sine', 0.06); },
    good() { tone(660, 0, 0.3, 'sine', 0.05); tone(990, 0.1, 0.4, 'sine', 0.045); },
    hint() { tone(392, 0, 0.35, 'triangle', 0.04); tone(330, 0.14, 0.4, 'triangle', 0.035); },
    lights() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.13, 1.2, 'sine', 0.035)); },
    pick() { tone(520, 0, 0.12, 'sine', 0.035); },
    close() { try { if (ac) ac.close(); } catch (e) { /* ignore */ } ac = null; },
  };
}

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

function buildConfig(d) {
  d = d && typeof d === 'object' ? d : {};
  const c = JSON.parse(JSON.stringify(DEFAULTS));
  for (const k of ['intro', 'introTip', 'lightsOn', 'lightsBack', 'logText']) if (typeof d[k] === 'string') c[k] = d[k];
  if (d.names && typeof d.names === 'object') for (const id of IDS) if (typeof d.names[id] === 'string') c.names[id] = d.names[id];
  if (d.messages && typeof d.messages === 'object') for (const k in d.messages) if (typeof d.messages[k] === 'string') c.messages[k] = d.messages[k];
  if (d.twist && typeof d.twist === 'object') {
    for (const k of ['eyebrow', 'prompt', 'footer', 'ask', 'button']) if (typeof d.twist[k] === 'string') c.twist[k] = d.twist[k];
    if (Array.isArray(d.twist.choices)) d.twist.choices.slice(0, 3).forEach((ch, i) => {
      if (!ch || typeof ch !== 'object') return;
      if (typeof ch.label === 'string') c.twist.choices[i].label = ch.label;
      if (typeof ch.answer === 'string') c.twist.choices[i].answer = ch.answer;
    });
  }
  if (Number.isFinite(+d.nearDistance) && +d.nearDistance > 0) c.near = +d.nearDistance;
  if (Number.isFinite(+d.padDistance) && +d.padDistance > 0) c.padFar = +d.padDistance;
  return c;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/* ------------------------------------------------------------------ */
/* Mount                                                               */
/* ------------------------------------------------------------------ */

export async function mount(el, ctx) {
  ctx = ctx || {};
  const cfg = buildConfig(ctx.data);
  const call = (fn, ...a) => { try { return typeof fn === 'function' ? fn(...a) : undefined; } catch (e) { console.warn('[moonbase]', e); return undefined; } };
  let qs;
  try { qs = new URLSearchParams(location.search); } catch (e) { qs = new URLSearchParams(''); }
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  styleRef(+1);
  if (!TERRAIN) TERRAIN = makeTerrain();
  const T = TERRAIN;

  const ac = new AbortController();
  const on = (t, type, fn, opts) => t.addEventListener(type, fn, Object.assign({ signal: ac.signal }, opts || {}));
  const timers = new Set();
  let raf = 0, dead = false, layoutRaf = 0, terrainTimer = 0;
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); return id; };
  const audio = makeAudio(!!ctx.sound);

  let lastSaid = '', lastSaidAt = 0;
  function say(text, force) {
    if (!text) return;
    const now = performance.now();
    if (!force && text === lastSaid && now - lastSaidAt < 4000) return;
    lastSaid = text; lastSaidAt = now;
    call(ctx.speak, text);
  }
  const msg = (key, id) => (cfg.messages[key] || '').replace('{name}', id ? cfg.names[id].toLowerCase() : '');

  /* ---------- DOM ---------- */
  const root = document.createElement('div');
  root.className = 'g-moonbase land';
  root.innerHTML = `
    <div class="mb-map">
      <canvas class="mb-terrain"></canvas>
      <canvas class="mb-fx"></canvas>
      <div class="mb-labels">
        <div class="mb-label crater">Shackleton Crater<span>always dark inside</span></div>
        <div class="mb-label rim">Sunny rim</div>
      </div>
      <div class="mb-sun">${SVG_SUN}<span>Low Sun</span>${SVG_ARROW}</div>
      <div class="mb-layer"></div>
      <div class="mb-caption card">
        <div class="mb-cap-ic"></div>
        <div class="mb-cap-body"><div class="mb-cap-txt"></div><div class="mb-cap-sub"></div></div>
        <button class="btn ghost mb-cap-act" type="button" hidden>Lunar night</button>
        <button class="speak-btn mb-cap-say" type="button" aria-label="Read aloud">${SVG_SPEAK}</button>
      </div>
      <div class="mb-banner">Lights on!</div>
      <div class="mb-twist" hidden>
        <div class="mb-twist-card card">
          <div class="mb-twist-top">
            <div><div class="eyebrow">${esc(cfg.twist.eyebrow)}</div><h3 class="mb-twist-q">${esc(cfg.twist.prompt)}</h3></div>
            <button class="speak-btn mb-twist-say" type="button" aria-label="Read aloud">${SVG_SPEAK}</button>
          </div>
          <div class="mb-choices">
            ${cfg.twist.choices.map((c, i) => `<button class="mb-choice" type="button" data-i="${i}">${TWIST_PICS[i]}<span class="lab">${esc(c.label)}</span><span class="ans">${esc(c.answer)}</span></button>`).join('')}
          </div>
          <div class="mb-twist-foot" hidden>
            <p><b>${esc(cfg.twist.footer)}</b>${esc(cfg.twist.ask)}</p>
            <button class="btn mb-twist-close" type="button">${esc(cfg.twist.button)}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="mb-tray">
      <div class="mb-tray-head">
        <div class="mb-prog"><span class="mb-prog-t">0 of 6 parts happy</span><div class="mb-dots">${IDS.map(() => '<i></i>').join('')}</div></div>
        <button class="btn ghost mb-reset" type="button" aria-label="Start over">${SVG_RESET}</button>
      </div>
      <div class="mb-tiles">
        ${IDS.map((id) => `<button class="mb-tile" type="button" data-id="${id}" aria-label="${esc(cfg.names[id])}">${svgIcon(id)}<span class="mb-tl">${esc(cfg.names[id])}</span><span class="mb-pip"></span></button>`).join('')}
      </div>
    </div>`;
  el.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const mapEl = $('.mb-map'), terrainCv = $('.mb-terrain'), fxCv = $('.mb-fx');
  const layerEl = $('.mb-layer'), capEl = $('.mb-caption'), capIc = $('.mb-cap-ic'), capTxt = $('.mb-cap-txt'), capSub = $('.mb-cap-sub');
  const capAct = $('.mb-cap-act'), bannerEl = $('.mb-banner'), twistEl = $('.mb-twist'), sunEl = $('.mb-sun');
  const lblCrater = $('.mb-label.crater'), lblRim = $('.mb-label.rim');
  const progT = $('.mb-prog-t'), dots = [...root.querySelectorAll('.mb-dots i')], resetBtn = $('.mb-reset');
  const tiles = {};
  root.querySelectorAll('.mb-tile').forEach((t) => { tiles[t.dataset.id] = t; });
  const tctx = terrainCv.getContext('2d');
  const fx = fxCv.getContext('2d');

  /* ---------- state ---------- */
  const state = { placed: {}, status: {}, selected: null, lit: false, everLit: false, twistOpen: false, opened: [] };
  const markers = {};
  const G = { w: 0, h: 0, cx: 0, cy: 0, R: 100, mark: 84, dpr: 1, land: true, ready: false };
  let zones = null;           // { rim: canvas, dark: canvas }
  let glints = [];
  let hint = null;            // { kind, id, t0, until }
  const puffs = [];
  let nightA = 0, nightTarget = 0, litA = 0;
  let rover = null;
  let capText = '';

  function setCaption(text, opts = {}) {
    capText = text;
    capTxt.textContent = text;
    capSub.textContent = opts.sub || '';
    capIc.innerHTML = svgIcon(opts.icon || null);
    capEl.classList.toggle('ok', opts.tone === 'ok');
    capEl.classList.toggle('hint', opts.tone === 'hint');
    capAct.hidden = !(state.everLit && !state.twistOpen && opts.action !== false);
  }

  /* ---------- persistence ---------- */
  function save() {
    const placed = {};
    for (const id of IDS) if (state.placed[id]) placed[id] = [+state.placed[id].x.toFixed(4), +state.placed[id].y.toFixed(4)];
    call(ctx.save, 'base', { placed, opened: state.opened.slice() });
  }
  function restore() {
    const s = call(ctx.load, 'base');
    if (!s || typeof s !== 'object' || !s.placed) return false;
    let n = 0;
    for (const id of IDS) {
      const p = s.placed[id];
      if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) { state.placed[id] = { x: p[0], y: p[1] }; n++; }
    }
    if (Array.isArray(s.opened)) state.opened = s.opened.filter((i) => i === 0 || i === 1 || i === 2);
    return n > 0;
  }

  /* ---------- rules ---------- */
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function evaluate() {
    const P = state.placed, S = {};
    for (const id of IDS) {
      const p = P[id];
      if (!p) continue;
      const q = T.qAt(p.x, p.y);
      let key = 'good';
      if (id === 'solar') {
        const lf = T.litFrac(p.x, p.y);
        if (q < 0.82) key = 'dark';
        else if (q <= 1.55 && lf >= 0.5) key = 'good';
        else if (lf < 0.5) key = 'shadow';
        else key = 'plain';
      } else if (id === 'ice') {
        if (q < 0.92) key = T.litFrac(p.x, p.y) <= 0.34 ? 'good' : 'sunwall';
        else key = 'dry';
      } else if (id === 'home') {
        if (q < 0.95) key = 'crater';
        else if (P.pad && dist(p, P.pad) < cfg.padFar) key = 'pad';
        else if (!P.solar) key = 'wait';
        else if (dist(p, P.solar) > cfg.near) key = 'far';
      } else if (id === 'pad') {
        if (q < 0.95) key = 'crater';
        else if (!P.home) key = 'wait';
        else if (dist(p, P.home) < cfg.padFar) key = 'close';
      } else if (id === 'garage') {
        if (q < 0.95) key = 'crater';
      } else if (id === 'green') {
        if (q < 0.95) key = 'crater';
        else if (T.litFrac(p.x, p.y) < 0.4) key = 'shadow';
      }
      const ok = key === 'good' || (id === 'pad' && key === 'wait');
      S[id] = { key, ok };
    }
    state.status = S;
  }

  /* ---------- layout ---------- */
  function layout() {
    layoutRaf = 0;
    if (dead) return;
    const W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;
    const land = W >= H * 1.05 && W >= 640;
    root.classList.toggle('land', land);
    root.classList.toggle('port', !land);
    let icon, cols;
    if (land) {
      cols = 2;
      icon = clamp(Math.floor((H - 24 - 56 - 10 - 20 - 3 * 50) / 3), 60, 112);
      const trayW = Math.max(292, icon * 2 + 2 * 18 + 10 + 24);
      root.style.setProperty('--mb-tray-w', trayW + 'px');
    } else {
      cols = W >= 620 ? 6 : 3;
      const rows = 6 / cols;
      icon = Math.floor((W - 24 - (cols - 1) * 10) / cols - 18);
      const maxTray = H * 0.4;
      icon = Math.min(icon, Math.floor((maxTray - 24 - 56 - 10 - (rows - 1) * 10) / rows - 66));
      icon = clamp(icon, 52, 112);
    }
    root.style.setProperty('--mb-icon', icon + 'px');
    root.style.setProperty('--mb-cols', String(cols));
    root.classList.toggle('narrow', W < 700);

    const mw = mapEl.clientWidth, mh = mapEl.clientHeight;
    if (!mw || !mh) return;
    const reserve = mw < 560 ? 132 : 100;
    const avH = Math.max(120, mh - reserve);
    const s = Math.min(mw, avH);
    const R = Math.max(40, (land ? 0.27 : 0.23) * s);
    const sizeChanged = Math.abs(mw - G.w) > 0.5 || Math.abs(mh - G.h) > 0.5;
    G.w = mw; G.h = mh; G.R = R; G.land = land;
    G.cx = mw * 0.56; G.cy = Math.min(mh - 1.2 * R, reserve + avH * 0.5);
    G.mark = Math.round(clamp(R * 0.58, 64, 108));
    G.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    root.style.setProperty('--mb-mark', G.mark + 'px');

    fxCv.width = Math.round(mw * G.dpr); fxCv.height = Math.round(mh * G.dpr);
    sunEl.style.top = G.cy + 'px';
    positionLabels();
    buildGlints();

    // keep placed parts on the map
    for (const id of IDS) if (state.placed[id]) state.placed[id] = clampWorld(state.placed[id].x, state.placed[id].y);

    if (sizeChanged || !G.ready) {
      if (!G.ready) { renderTerrain(); }
      else { clearTimeout(terrainTimer); terrainTimer = setTimeout(() => { if (!dead) renderTerrain(); }, 160); }
    }
    evaluate();
    syncAll();
    buildRover();
  }
  function scheduleLayout() { if (!layoutRaf && !dead) layoutRaf = requestAnimationFrame(layout); }

  function positionLabels() {
    const { cx, cy, R } = G;
    lblCrater.style.left = cx + 'px'; lblCrater.style.top = (cy - 0.12 * R) + 'px';
    lblRim.style.left = (cx - 1.02 * R) + 'px'; lblRim.style.top = (cy - 1.28 * R) + 'px';
  }

  const toPx = (p) => ({ x: G.cx + p.x * G.R, y: G.cy + p.y * G.R });
  function clampWorld(x, y) {
    const half = G.mark / 2 + 4;
    const top = Math.min(G.h - half, capEl.offsetTop + capEl.offsetHeight + 6 + half * 0.6);
    const px = clamp(G.cx + x * G.R, half, G.w - half);
    const py = clamp(G.cy + y * G.R, top, G.h - half);
    return { x: (px - G.cx) / G.R, y: (py - G.cy) / G.R };
  }
  function resolveOverlap(id, p) {
    const minD = (G.mark * 0.98) / G.R;
    for (let it = 0; it < 10; it++) {
      let moved = false;
      for (const o of IDS) {
        if (o === id || !state.placed[o]) continue;
        const q = state.placed[o];
        let dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
        if (d < minD) {
          if (d < 1e-4) { dx = 1; dy = 0.3; d = Math.hypot(dx, dy); }
          p = clampWorld(q.x + (dx / d) * minD * 1.02, q.y + (dy / d) * minD * 1.02);
          moved = true;
        }
      }
      if (!moved) break;
    }
    return p;
  }

  /* ---------- terrain rendering ---------- */
  function renderTerrain() {
    const t0 = performance.now();
    const { w, h, cx, cy, R } = G;
    const dpr = G.dpr;
    terrainCv.width = Math.round(w * dpr); terrainCv.height = Math.round(h * dpr);
    const maxPix = 200000;
    const k = Math.max(1, Math.sqrt((w * h) / maxPix));
    const gw = Math.ceil(w / k), gh = Math.ceil(h / k);
    const step = k / R;
    const Hf = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      const wy = ((j + 0.5) * k - cy) / R;
      for (let i = 0; i < gw; i++) Hf[j * gw + i] = T.height(((i + 0.5) * k - cx) / R, wy);
    }
    // shadows: the Sun is low on the left, so sweep each row left to right
    const L = new Float32Array(gw * gh);
    const drop = step * TAN_E;
    const x0 = (0.5 * k - cx) / R;
    for (let j = 0; j < gh; j++) {
      const wy = ((j + 0.5) * k - cy) / R;
      let hor = -1e9;
      for (let s = 40; s >= 1; s--) { hor = Math.max(hor - 0.06 * TAN_E, T.height(x0 - s * 0.06, wy)); }
      hor -= 0.06 * TAN_E;
      for (let i = 0; i < gw; i++) {
        const idx = j * gw + i;
        hor -= drop;
        const diff = Hf[idx] - hor;
        L[idx] = clamp(0.5 + diff / 0.006, 0, 1);
        if (Hf[idx] > hor) hor = Hf[idx];
      }
    }
    const off = document.createElement('canvas');
    off.width = gw; off.height = gh;
    const octx = off.getContext('2d');
    const img = octx.createImageData(gw, gh);
    const D = img.data;
    const rimC = document.createElement('canvas'); rimC.width = gw; rimC.height = gh;
    const darkC = document.createElement('canvas'); darkC.width = gw; darkC.height = gh;
    const rimImg = rimC.getContext('2d').createImageData(gw, gh), darkImg = darkC.getContext('2d').createImageData(gw, gh);
    const rimMask = new Uint8Array(gw * gh), darkMask = new Uint8Array(gw * gh);
    const E = 1.7, inv2 = 1 / (2 * step);
    const rnd = mulberry32(99);
    for (let j = 0; j < gh; j++) {
      const wy = ((j + 0.5) * k - cy) / R;
      const ju = j > 0 ? j - 1 : j, jd = j < gh - 1 ? j + 1 : j;
      for (let i = 0; i < gw; i++) {
        const idx = j * gw + i;
        const wx = ((i + 0.5) * k - cx) / R;
        const il = i > 0 ? i - 1 : i, ir = i < gw - 1 ? i + 1 : i;
        let nx = (Hf[j * gw + il] - Hf[j * gw + ir]) * inv2 * E;
        let ny = (Hf[ju * gw + i] - Hf[jd * gw + i]) * inv2 * E;
        const nl = 1 / Math.sqrt(nx * nx + ny * ny + 1);
        nx *= nl; ny *= nl; const nz = nl;
        const dif = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
        const sky = Math.max(0, nx * SKY[0] + ny * SKY[1] + nz * SKY[2]);
        const alb = T.albedo(wx, wy);
        const hh = Hf[idx];
        const lit = L[idx];
        const b = (0.16 + 1.42 * dif) * alb * (1 + 1.1 * Math.max(0, hh));
        let lr = 238 * b, lg = 233 * b, lb = 223 * b;
        const am = (0.04 + 0.075 * sky) * alb;
        let sr = 150 * am, sg = 168 * am, sb = 208 * am;
        const q = T.qAt(wx, wy);
        if (q < 0.97 && lit < 0.6) {
          const fr = T.frost(wx, wy);
          const fv = fr > 0.15 ? (fr - 0.15) * 1.0 : 0;
          sr += 18 * fv; sg += 30 * fv; sb += 44 * fv;
          const rr = rnd();
          if (rr < 0.018) { const v = rnd(); sr += 40 * v; sg += 58 * v; sb += 78 * v; }
        }
        let r = sr + (lr - sr) * lit, g = sg + (lg - sg) * lit, bb = sb + (lb - sb) * lit;
        // gentle tone curve
        r = 255 * Math.pow(clamp(r / 255, 0, 1), 0.92); g = 255 * Math.pow(clamp(g / 255, 0, 1), 0.92); bb = 255 * Math.pow(clamp(bb / 255, 0, 1), 0.92);
        const o = idx * 4;
        D[o] = r; D[o + 1] = g; D[o + 2] = bb; D[o + 3] = 255;
        if (q >= 0.8 && q <= 1.55 && lit > 0.5) rimMask[idx] = 1;
        if (q < 0.9 && lit < 0.35) darkMask[idx] = 1;
      }
    }
    octx.putImageData(img, 0, 0);
    // zone hint images: soft fill plus a bright edge
    const fillZone = (mask, imgd, c) => {
      const d = imgd.data;
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const idx = j * gw + i; if (!mask[idx]) continue;
        const edge = (i === 0 || !mask[idx - 1]) || (i === gw - 1 || !mask[idx + 1]) || (j === 0 || !mask[idx - gw]) || (j === gh - 1 || !mask[idx + gw]);
        const o = idx * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = edge ? 235 : 70;
      }
    };
    fillZone(rimMask, rimImg, [255, 210, 122]); rimC.getContext('2d').putImageData(rimImg, 0, 0);
    fillZone(darkMask, darkImg, [95, 212, 255]); darkC.getContext('2d').putImageData(darkImg, 0, 0);
    zones = { rim: rimC, dark: darkC };

    const c = tctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(off, 0, 0, w, h);
    // fine regolith grain
    const grain = document.createElement('canvas'); grain.width = grain.height = 128;
    const gc = grain.getContext('2d'); const gi = gc.createImageData(128, 128);
    const gr = mulberry32(5);
    for (let i = 0; i < 128 * 128; i++) { const v = gr(); const o = i * 4; const c2 = v > 0.5 ? 255 : 0; gi.data[o] = gi.data[o + 1] = gi.data[o + 2] = c2; gi.data[o + 3] = Math.abs(v - 0.5) * 34; }
    gc.putImageData(gi, 0, 0);
    c.save(); c.globalAlpha = 0.9; c.fillStyle = c.createPattern(grain, 'repeat'); c.fillRect(0, 0, w, h); c.restore();
    // low Sun glow on the left edge, and a vignette
    let g = c.createLinearGradient(0, 0, w * 0.35, 0);
    g.addColorStop(0, 'rgba(255,214,150,0.10)'); g.addColorStop(1, 'rgba(255,214,150,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.42)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    G.ready = true;
    if (qs.has('debugTiming')) console.log('[moonbase] terrain ' + Math.round(performance.now() - t0) + ' ms ' + gw + 'x' + gh);
    // statuses depend on terrain only through T, so they are stable; refresh visuals anyway
    evaluate(); syncAll();
  }

  function buildGlints() {
    const r = mulberry32(31);
    glints = [];
    for (let i = 0; i < 70; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * 0.8;
      glints.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, sp: 0.6 + r() * 1.8, ph: r() * 6.283, s: 0.6 + r() * 0.9 });
    }
  }

  /* ---------- markers / tiles ---------- */
  function markerEl(id) {
    let m = markers[id];
    if (!m) {
      m = document.createElement('div');
      m.className = 'mb-marker';
      m.dataset.id = id;
      m.setAttribute('role', 'button');
      m.setAttribute('aria-label', cfg.names[id]);
      m.innerHTML = svgIcon(id) + '<span class="mb-pip"></span>';
      layerEl.appendChild(m);
      markers[id] = m;
    }
    return m;
  }
  function syncAll() {
    let happy = 0;
    IDS.forEach((id, i) => {
      const p = state.placed[id], st = state.status[id];
      const t = tiles[id];
      t.classList.toggle('placed', !!p);
      t.classList.toggle('sel', state.selected === id);
      t.classList.toggle('ok', !!(p && st && st.ok));
      t.classList.toggle('bad', !!(p && st && !st.ok));
      t.querySelector('.mb-pip').innerHTML = p && st ? (st.ok ? SVG_CHECK : SVG_BANG) : '';
      dots[i].className = p && st ? (st.ok ? 'ok' : 'bad') : '';
      if (p && st && st.ok) happy++;
      if (p) {
        const m = markerEl(id);
        const px = toPx(p);
        if (!m.classList.contains('lifted')) { m.style.left = px.x + 'px'; m.style.top = px.y + 'px'; }
        m.classList.toggle('ok', !!(st && st.ok));
        m.classList.toggle('bad', !!(st && !st.ok));
        m.classList.toggle('sel', state.selected === id);
        m.querySelector('.mb-pip').innerHTML = st ? (st.ok ? SVG_CHECK : SVG_BANG) : '';
      } else if (markers[id]) {
        markers[id].remove();
        delete markers[id];
      }
    });
    progT.textContent = happy === 6 ? 'All 6 parts happy!' : `${happy} of 6 parts happy`;
    mapEl.classList.toggle('picking', !!state.selected);
  }

  function selectId(id, announce) {
    state.selected = id;
    syncAll();
    if (id && announce) {
      const placed = !!state.placed[id];
      if (placed && state.status[id]) {
        const st = state.status[id];
        const line = msg(`${id}.${st.key}`, id);
        setCaption(line, { icon: id, tone: st.ok ? 'ok' : 'hint', sub: msg('tap.move', id) });
        say(line);
      } else {
        const line = msg('tap.select', id);
        setCaption(line, { icon: id });
        say(line);
      }
      audio.pick();
    }
  }

  /* ---------- placing ---------- */
  function placeAt(id, wx, wy, opts = {}) {
    let p = clampWorld(wx, wy);
    p = resolveOverlap(id, p);
    state.placed[id] = p;
    state.selected = null;
    evaluate();
    syncAll();
    const m = markers[id];
    if (m && !opts.quiet) { m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop'); }
    const st = state.status[id];
    if (!opts.quiet) {
      const line = msg(`${id}.${st.key}`, id);
      setCaption(line, { icon: id, tone: st.ok ? 'ok' : 'hint' });
      say(line, true);
      audio.place();
      later(() => (st.ok ? audio.good() : audio.hint()), 140);
      const px = toPx(p);
      puffs.push({ x: px.x, y: px.y, t0: performance.now() / 1000 });
      hint = st.ok ? null : { id, key: st.key, t0: performance.now() / 1000, until: performance.now() / 1000 + 3.6 };
      save();
    }
    buildRover();
    checkLit(opts.quiet);
  }
  function unplace(id) {
    delete state.placed[id];
    state.selected = null;
    evaluate();
    syncAll();
    setCaption(msg('removed', id), { icon: id });
    save();
    buildRover();
    checkLit();
  }

  function checkLit(quiet) {
    const all = IDS.every((id) => state.placed[id] && state.status[id] && state.status[id].ok);
    if (all && !state.lit) {
      state.lit = true;
      if (!state.everLit) {
        if (quiet) { lightsOnQuiet(); }
        else later(() => { if (state.lit && !state.everLit) firstLights(); }, 1700);
      } else if (!quiet) {
        later(() => { if (state.lit) { setCaption(cfg.lightsBack, { tone: 'ok' }); say(cfg.lightsBack); audio.lights(); } }, 1500);
      }
    } else if (!all && state.lit) {
      state.lit = false;
    }
    root.classList.toggle('lit', state.lit && state.everLit);
    nightTarget = state.twistOpen ? 0.55 : (state.lit && state.everLit ? 0.16 : 0);
  }
  function lightsOnQuiet() {
    state.everLit = true;
    root.classList.add('lit');
    nightTarget = 0.16;
    call(ctx.complete);
  }
  function firstLights() {
    state.everLit = true;
    root.classList.add('lit');
    nightTarget = 0.16;
    bannerEl.textContent = 'Lights on!';
    bannerEl.classList.remove('show'); void bannerEl.offsetWidth; bannerEl.classList.add('show');
    setCaption(cfg.lightsOn, { tone: 'ok' });
    say(cfg.lightsOn, true);
    audio.lights();
    call(ctx.log, cfg.logText);
    call(ctx.complete);
    save();
    later(() => { if (!state.twistOpen) openTwist(); }, 5200);
  }

  /* ---------- twist ---------- */
  let twistCount = 0;
  function openTwist() {
    if (state.twistOpen) return;
    state.twistOpen = true;
    twistEl.hidden = false;
    void twistEl.offsetWidth;
    twistEl.classList.add('show');
    root.classList.add('night');
    nightTarget = 0.55;
    capAct.hidden = true;
    root.querySelectorAll('.mb-choice').forEach((b) => b.classList.toggle('open', state.opened.includes(+b.dataset.i)));
    $('.mb-twist-foot').hidden = state.opened.length === 0;
    say(cfg.twist.prompt, true);
  }
  function closeTwist() {
    state.twistOpen = false;
    twistEl.classList.remove('show');
    root.classList.remove('night');
    later(() => { if (!state.twistOpen) twistEl.hidden = true; }, 600);
    nightTarget = state.lit ? 0.16 : 0;
    setCaption(state.lit ? cfg.lightsOn : cfg.intro, { tone: state.lit ? 'ok' : undefined });
  }
  function reveal(i) {
    const ch = cfg.twist.choices[i];
    if (!ch) return;
    const b = root.querySelector(`.mb-choice[data-i="${i}"]`);
    b.classList.add('open');
    if (!state.opened.includes(i)) { state.opened.push(i); call(ctx.log, `Lunar night idea: ${ch.label}`); }
    const foot = $('.mb-twist-foot');
    const firstTime = foot.hidden;
    foot.hidden = false;
    say(ch.answer + (firstTime ? ' ' + cfg.twist.footer : ''), true);
    audio.good();
    twistCount++;
    save();
  }

  /* ---------- rover ---------- */
  function buildRover() {
    const a = state.placed.garage, b = state.placed.ice;
    if (!a || !b || !G.ready) { rover = null; return; }
    const A = toPx(a), B = toPx(b);
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
    if (d < G.mark * 1.2) { rover = null; return; }
    const ux = dx / d, uy = dy / d;
    const off = G.mark * 0.55;
    const P0 = { x: A.x + ux * off, y: A.y + uy * off }, P2 = { x: B.x - ux * off, y: B.y - uy * off };
    const bend = 0.18 * d;
    const P1 = { x: (P0.x + P2.x) / 2 - uy * bend, y: (P0.y + P2.y) / 2 + ux * bend };
    const pts = [];
    let len = 0;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, mt = 1 - t;
      const x = mt * mt * P0.x + 2 * mt * t * P1.x + t * t * P2.x;
      const y = mt * mt * P0.y + 2 * mt * t * P1.y + t * t * P2.y;
      if (i) len += Math.hypot(x - pts[i - 1].x, y - pts[i - 1].y);
      pts.push({ x, y, s: len });
    }
    const prev = rover;
    rover = { pts, len, s: prev ? Math.min(prev.s, len) : 0, dir: prev ? prev.dir : 1, pause: prev ? prev.pause : 0.6, seen: prev ? Math.min(prev.seen, len) : 0 };
  }
  function roverAt(s) {
    const pts = rover.pts;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid].s < s) lo = mid; else hi = mid; }
    const a = pts[lo], b = pts[hi];
    const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  /* ---------- fx loop ---------- */
  let lastT = performance.now() / 1000;
  function frame(nowMs) {
    raf = 0;
    if (dead || document.hidden) return;
    const t = nowMs / 1000;
    const dt = Math.min(0.05, Math.max(0, t - lastT));
    lastT = t;
    try { drawFx(t, dt); } catch (e) { console.warn('[moonbase] fx', e); }
    raf = requestAnimationFrame(frame);
  }
  function startLoop() { if (!raf && !dead && !document.hidden) { lastT = performance.now() / 1000; raf = requestAnimationFrame(frame); } }

  function drawFx(t, dt) {
    const c = fx, { w, h, R } = G;
    if (!w || !h) return;
    c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    nightA += (nightTarget - nightA) * Math.min(1, dt * 1.2);
    const lightsWanted = state.lit && state.everLit ? 1 : 0;
    litA += (lightsWanted - litA) * Math.min(1, dt * 1.6);

    if (nightA > 0.004) { c.fillStyle = `rgba(2,4,12,${nightA.toFixed(3)})`; c.fillRect(0, 0, w, h); }

    // zone hint after a gentle misplacement
    if (hint && zones) {
      if (t > hint.until) hint = null;
      else {
        const k = (t - hint.t0);
        const a = Math.min(1, k * 3) * Math.min(1, (hint.until - t) * 1.5) * (0.65 + 0.35 * Math.sin(k * 6));
        c.save();
        c.globalAlpha = a;
        c.imageSmoothingEnabled = true;
        if (hint.id === 'solar') c.drawImage(zones.rim, 0, 0, w, h);
        else if (hint.id === 'ice' || (hint.id !== 'pad' && hint.key === 'shadow' && false)) c.drawImage(zones.dark, 0, 0, w, h);
        else if (hint.id === 'home' && (hint.key === 'far' || hint.key === 'wait') && state.placed.solar) ring(state.placed.solar, cfg.near, 'rgba(255,210,122,1)', a);
        else if (hint.id === 'home' && hint.key === 'pad' && state.placed.pad) ring(state.placed.pad, cfg.padFar, 'rgba(255,107,87,1)', a);
        else if (hint.id === 'pad' && hint.key === 'close' && state.placed.home) ring(state.placed.home, cfg.padFar, 'rgba(255,107,87,1)', a);
        c.restore();
      }
    }

    // frost glints in the permanently dark crater
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const g of glints) {
      let v = Math.sin(t * g.sp + g.ph);
      if (reduced) v = g.ph > 5 ? 0.8 : 0;
      if (v < 0.55) continue;
      const a = Math.pow((v - 0.55) / 0.45, 2) * 0.9;
      const x = G.cx + g.x * R, y = G.cy + g.y * R;
      const s = (2.2 + 3.2 * a) * g.s;
      c.strokeStyle = `rgba(205,236,255,${a.toFixed(3)})`;
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x, y - s); c.lineTo(x, y + s); c.stroke();
      c.fillStyle = `rgba(225,245,255,${(a * 0.9).toFixed(3)})`;
      c.beginPath(); c.arc(x, y, 1.1, 0, 6.283); c.fill();
    }
    c.restore();

    // placement dust puffs
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i], k = (t - p.t0) / 0.7;
      if (k > 1 || k < 0) { if (k > 1) puffs.splice(i, 1); continue; }
      c.strokeStyle = `rgba(220,215,205,${(0.5 * (1 - k)).toFixed(3)})`;
      c.lineWidth = 3 * (1 - k) + 1;
      c.beginPath(); c.ellipse(p.x, p.y, G.mark * (0.5 + 0.55 * k), G.mark * (0.42 + 0.45 * k), 0, 0, 6.283); c.stroke();
    }

    // base lights, cables and the rover
    if (litA > 0.01) drawLights(t, dt);
  }

  function ring(p, rad, col, a) {
    const c = fx, P = toPx(p);
    c.save();
    c.globalAlpha = a;
    c.setLineDash([10, 8]);
    c.lineDashOffset = -performance.now() / 60;
    c.strokeStyle = col; c.lineWidth = 3;
    c.beginPath(); c.arc(P.x, P.y, rad * G.R, 0, 6.283); c.stroke();
    c.setLineDash([]);
    c.globalAlpha = a * 0.1; c.fillStyle = col; c.fill();
    c.restore();
  }

  function drawLights(t, dt) {
    const c = fx, P = state.placed;
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
    const glowA = litA * (0.55 + nightA * 0.9);
    c.save();
    // cables from the solar tower
    const links = [['solar', 'home'], ['home', 'green'], ['home', 'garage'], ['solar', 'ice'], ['home', 'pad']];
    for (const [a, b] of links) {
      if (!P[a] || !P[b]) continue;
      const A = toPx(P[a]), B = toPx(P[b]);
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 + Math.hypot(B.x - A.x, B.y - A.y) * 0.08;
      c.lineCap = 'round';
      c.strokeStyle = `rgba(0,0,0,${(0.45 * litA).toFixed(3)})`; c.lineWidth = 5;
      c.beginPath(); c.moveTo(A.x, A.y); c.quadraticCurveTo(mx, my, B.x, B.y); c.stroke();
      c.strokeStyle = `rgba(242,181,68,${(0.55 * litA).toFixed(3)})`; c.lineWidth = 2;
      c.beginPath(); c.moveTo(A.x, A.y); c.quadraticCurveTo(mx, my, B.x, B.y); c.stroke();
      if (!reduced) {
        c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          const u = ((t * 0.28 + k / 3) % 1);
          const mu = 1 - u;
          const x = mu * mu * A.x + 2 * mu * u * mx + u * u * B.x, y = mu * mu * A.y + 2 * mu * u * my + u * u * B.y;
          const g = c.createRadialGradient(x, y, 0, x, y, 9);
          g.addColorStop(0, `rgba(255,224,150,${(0.9 * litA).toFixed(3)})`); g.addColorStop(1, 'rgba(255,224,150,0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, y, 9, 0, 6.283); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
      }
    }
    // warm pools of light
    c.globalCompositeOperation = 'lighter';
    for (const id of IDS) {
      if (!P[id]) continue;
      const p = toPx(P[id]);
      const r = G.mark * 1.25;
      const col = id === 'green' ? '111,227,165' : id === 'ice' ? '124,196,255' : '255,206,128';
      const g = c.createRadialGradient(p.x, p.y, G.mark * 0.3, p.x, p.y, r);
      g.addColorStop(0, `rgba(${col},${(0.42 * glowA * pulse).toFixed(3)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, 6.283); c.fill();
    }
    // blinking landing-pad lights
    if (P.pad) {
      const p = toPx(P.pad);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * 6.283 + 0.2;
        const on = reduced ? 1 : ((Math.floor(t * 4) + k) % 8 === 0 ? 1 : 0.25);
        const x = p.x + Math.cos(a) * G.mark * 0.68, y = p.y + Math.sin(a) * G.mark * 0.68;
        const g = c.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, `rgba(255,120,90,${(on * litA).toFixed(3)})`); g.addColorStop(1, 'rgba(255,120,90,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, 9, 0, 6.283); c.fill();
      }
    }
    c.globalCompositeOperation = 'source-over';
    c.restore();

    if (rover && state.lit) drawRover(t, dt);
  }

  function drawRover(t, dt) {
    const c = fx;
    const sc = clamp(G.R / 150, 0.7, 1.6);
    const speed = 46 * sc;
    if (rover.pause > 0) rover.pause -= dt;
    else {
      rover.s += rover.dir * speed * dt;
      if (rover.s >= rover.len) { rover.s = rover.len; rover.dir = -1; rover.pause = 1.6; }
      else if (rover.s <= 0) { rover.s = 0; rover.dir = 1; rover.pause = 1.6; }
    }
    rover.seen = Math.max(rover.seen, rover.s);
    // tracks
    const pts = rover.pts;
    c.save();
    c.lineWidth = 1.6;
    c.strokeStyle = `rgba(20,20,24,${(0.4 * litA).toFixed(3)})`;
    for (const side of [-1, 1]) {
      c.beginPath();
      let started = false;
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].s > rover.seen) break;
        const a = pts[i - 1], b = pts[i];
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const ox = -Math.sin(ang) * 4.2 * sc * side, oy = Math.cos(ang) * 4.2 * sc * side;
        if (!started) { c.moveTo(a.x + ox, a.y + oy); started = true; }
        c.lineTo(b.x + ox, b.y + oy);
      }
      c.stroke();
    }
    const r = roverAt(rover.s);
    const ang = r.ang + (rover.dir < 0 ? Math.PI : 0);
    c.translate(r.x, r.y);
    // headlights (always on in the dark)
    const q = T.qAt((r.x - G.cx) / G.R, (r.y - G.cy) / G.R);
    const beam = clamp((q < 1.05 ? 1 : 0.35) + nightA, 0, 1) * litA;
    c.save();
    c.rotate(ang);
    if (beam > 0.02) {
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(10 * sc, 0, 0, 10 * sc, 0, 46 * sc);
      g.addColorStop(0, `rgba(255,240,205,${(0.55 * beam).toFixed(3)})`); g.addColorStop(1, 'rgba(255,240,205,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(9 * sc, -3 * sc); c.lineTo(52 * sc, -17 * sc); c.lineTo(52 * sc, 17 * sc); c.lineTo(9 * sc, 3 * sc); c.closePath(); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
    // shadow (Sun on the left, so shadows fall to the right)
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.beginPath(); c.ellipse(7 * sc, 2 * sc, 13 * sc, 7 * sc, 0, 0, 6.283); c.fill();
    c.rotate(ang);
    c.fillStyle = '#16181e';
    for (const [x, y] of [[-7, -7.2], [7, -7.2], [-7, 7.2], [7, 7.2], [0, -7.2], [0, 7.2]]) { c.beginPath(); c.roundRect ? c.roundRect((x - 3) * sc, (y - 2) * sc, 6 * sc, 4 * sc, 1.2 * sc) : c.rect((x - 3) * sc, (y - 2) * sc, 6 * sc, 4 * sc); c.fill(); }
    c.fillStyle = '#d6dbe3';
    c.beginPath(); c.roundRect ? c.roundRect(-10 * sc, -5.6 * sc, 20 * sc, 11.2 * sc, 2.5 * sc) : c.rect(-10 * sc, -5.6 * sc, 20 * sc, 11.2 * sc); c.fill();
    c.fillStyle = '#1f3f74';
    c.fillRect(-7.5 * sc, -4 * sc, 10 * sc, 8 * sc);
    c.fillStyle = '#f2b544';
    c.beginPath(); c.arc(6 * sc, 0, 2.4 * sc, 0, 6.283); c.fill();
    c.fillStyle = '#ff6b57';
    c.beginPath(); c.arc(-10 * sc, -3.5 * sc, 1.1 * sc, 0, 6.283); c.arc(-10 * sc, 3.5 * sc, 1.1 * sc, 0, 6.283); c.fill();
    c.restore();
  }

  /* ---------- pointer handling ---------- */
  let drag = null;
  let ghost = null;
  function rootPoint(clientX, clientY) { const r = root.getBoundingClientRect(); return { x: clientX - r.left, y: clientY - r.top }; }
  function clientToMap(clientX, clientY) {
    const r = mapEl.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return null;
    return { px: x, py: y, x: (x - G.cx) / G.R, y: (y - G.cy) / G.R };
  }
  function startGhost(id, clientX, clientY) {
    endGhost();
    ghost = document.createElement('div');
    ghost.className = 'mb-marker mb-ghost';
    ghost.innerHTML = svgIcon(id);
    root.appendChild(ghost);
    moveGhost(clientX, clientY);
  }
  function moveGhost(clientX, clientY) {
    if (!ghost) return;
    const p = rootPoint(clientX, clientY);
    ghost.style.left = p.x + 'px'; ghost.style.top = p.y + 'px';
  }
  function endGhost() { if (ghost) { ghost.remove(); ghost = null; } }

  Object.values(tiles).forEach((tile) => {
    on(tile, 'pointerdown', (e) => {
      if (e.button > 0 || drag) return;
      e.preventDefault();
      try { tile.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      drag = { id: tile.dataset.id, from: 'tray', pid: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
      audio.unlock();
    });
    on(tile, 'pointermove', (e) => {
      if (!drag || drag.from !== 'tray' || drag.pid !== e.pointerId) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && dx * dx + dy * dy > 81) {
        drag.moved = true;
        startGhost(drag.id, e.clientX, e.clientY);
        if (markers[drag.id]) markers[drag.id].classList.add('ghosted');
        if (state.selected) { state.selected = null; syncAll(); }
      }
      if (drag.moved) moveGhost(e.clientX, e.clientY);
    });
    on(tile, 'pointerup', (e) => {
      if (!drag || drag.from !== 'tray' || drag.pid !== e.pointerId) return;
      const d = drag; drag = null;
      if (d.moved) {
        endGhost();
        if (markers[d.id]) markers[d.id].classList.remove('ghosted');
        const p = clientToMap(e.clientX, e.clientY);
        if (p) placeAt(d.id, p.x, p.y);
      } else {
        selectId(state.selected === d.id ? null : d.id, state.selected !== d.id);
      }
    });
    on(tile, 'pointercancel', () => {
      if (!drag || drag.from !== 'tray') return;
      if (markers[drag.id]) markers[drag.id].classList.remove('ghosted');
      drag = null; endGhost();
    });
    on(tile, 'click', (e) => { if (e.detail === 0) selectId(state.selected === tile.dataset.id ? null : tile.dataset.id, true); }); // keyboard
  });

  on(mapEl, 'pointerdown', (e) => {
    if (e.button > 0 || drag) return;
    if (e.target.closest('.mb-caption, .mb-twist')) return;
    const mk = e.target.closest('.mb-marker');
    e.preventDefault();
    try { mapEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    drag = { id: mk ? mk.dataset.id : null, from: 'map', pid: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
    audio.unlock();
  });
  on(mapEl, 'pointermove', (e) => {
    if (!drag || drag.from !== 'map' || drag.pid !== e.pointerId || !drag.id) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && dx * dx + dy * dy > 64) {
      drag.moved = true;
      if (state.selected) { state.selected = null; syncAll(); }
      markers[drag.id] && markers[drag.id].classList.add('lifted');
    }
    if (drag.moved && markers[drag.id]) {
      const r = mapEl.getBoundingClientRect();
      const m = markers[drag.id];
      m.style.left = clamp(e.clientX - r.left, -G.mark, G.w + G.mark * 3) + 'px';
      m.style.top = clamp(e.clientY - r.top, -G.mark, G.h + G.mark * 3) + 'px';
    }
  });
  function endMapDrag(e, cancelled) {
    if (!drag || drag.from !== 'map' || drag.pid !== e.pointerId) return;
    const d = drag; drag = null;
    if (d.id) {
      const m = markers[d.id];
      if (m) m.classList.remove('lifted');
      if (cancelled) { syncAll(); return; }
      if (d.moved) {
        const p = clientToMap(e.clientX, e.clientY);
        if (p) placeAt(d.id, p.x, p.y);
        else {
          const tr = $('.mb-tray').getBoundingClientRect();
          if (e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom) unplace(d.id);
          else syncAll();
        }
      } else if (state.selected === d.id) {
        selectId(null);
      } else {
        selectId(d.id, true);
      }
    } else if (!d.moved && !cancelled) {
      const p = clientToMap(e.clientX, e.clientY);
      if (!p) return;
      if (state.selected) placeAt(state.selected, p.x, p.y);
      else {
        const q = T.qAt(p.x, p.y);
        const key = q < 0.92 ? 'zone.crater' : q <= 1.55 ? 'zone.rim' : 'zone.plain';
        const line = msg(key);
        setCaption(line, {});
        say(line);
      }
    }
  }
  on(mapEl, 'pointerup', (e) => endMapDrag(e, false));
  on(mapEl, 'pointercancel', (e) => endMapDrag(e, true));
  on(mapEl, 'lostpointercapture', (e) => { if (drag && drag.from === 'map' && drag.pid === e.pointerId) endMapDrag(e, true); });

  on($('.mb-cap-say'), 'click', () => say(capText, true));
  on(capAct, 'click', () => openTwist());
  on($('.mb-twist-say'), 'click', () => say(cfg.twist.prompt, true));
  on($('.mb-twist-close'), 'click', () => closeTwist());
  root.querySelectorAll('.mb-choice').forEach((b) => on(b, 'click', () => reveal(+b.dataset.i)));
  let resetArmed = 0;
  on(resetBtn, 'click', () => {
    const now = performance.now();
    if (now - resetArmed < 3500) {
      resetArmed = 0;
      resetBtn.classList.remove('armed');
      for (const id of IDS) delete state.placed[id];
      state.selected = null; state.lit = false; state.everLit = false; state.opened = [];
      if (state.twistOpen) closeTwist();
      root.classList.remove('lit', 'night');
      nightTarget = 0; hint = null;
      evaluate(); syncAll(); buildRover(); save();
      setCaption(cfg.intro, { sub: cfg.introTip });
      say(cfg.intro, true);
    } else {
      resetArmed = now;
      resetBtn.classList.add('armed');
      setCaption(msg('reset.confirm'), { tone: 'hint' });
      later(() => { if (performance.now() - resetArmed >= 3400) resetBtn.classList.remove('armed'); }, 3600);
    }
  });
  on(window, 'keydown', (e) => { if (e.key === 'Escape' && state.selected) selectId(null); });
  on(document, 'visibilitychange', () => { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; } else startLoop(); });

  /* ---------- start ---------- */
  const ro = new ResizeObserver(() => scheduleLayout());
  ro.observe(el);
  setCaption(cfg.intro, { sub: cfg.introTip });
  const restored = restore();
  layout();
  if (restored) {
    evaluate(); syncAll(); buildRover();
    if (IDS.every((id) => state.placed[id] && state.status[id] && state.status[id].ok)) {
      state.lit = true; lightsOnQuiet();
      setCaption(msg('restored'), { tone: 'ok' });
    }
    checkLit(true);
  }

  // debug helpers (only via URL params)
  function goodSpot(id) {
    const P = state.placed;
    if (id === 'solar') {
      for (let a = Math.PI - 0.15; a < Math.PI + 1.2; a += 0.1) for (const rr of [1.15, 1.08, 1.25, 1.0]) {
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (T.litFrac(x, y) >= 0.8) return { x, y };
      }
      return { x: -1.12, y: -0.1 };
    }
    if (id === 'ice') return { x: 0.1, y: 0.15 };
    if (id === 'home') return { x: P.solar.x - 0.95, y: P.solar.y + 0.45 };
    if (id === 'green') {
      for (const [dx, dy] of [[-0.8, -0.6], [-1.0, -0.35], [-0.5, -0.9], [-1.3, 0.1]]) { const x = P.home.x + dx, y = P.home.y + dy; if (T.litFrac(x, y) >= 0.5) return { x, y }; }
      return { x: P.home.x - 0.8, y: P.home.y - 0.6 };
    }
    if (id === 'garage') return { x: P.home.x + 0.55, y: P.home.y + 0.95 };
    if (id === 'pad') return { x: 1.9, y: 1.05 };
    return { x: 0, y: 0 };
  }
  if (qs.has('debugPlaceAll') || qs.has('debugNight')) {
    for (const id of ['solar', 'ice', 'home', 'green', 'garage', 'pad']) { const p = goodSpot(id); placeAt(id, p.x, p.y, { quiet: id !== 'pad' }); }
    if (qs.has('debugNight')) {
      if (!state.everLit && state.lit) { later(() => {}, 0); }
      openTwistNow();
    }
  } else if (qs.has('debugBad')) {
    placeAt('solar', 0.1, 0.1, { quiet: true });
    placeAt('home', 0.2, -1.9, { quiet: true });
    placeAt('pad', 1.0, -1.9);
  }
  function openTwistNow() {
    if (!state.everLit) { state.everLit = true; root.classList.add('lit'); call(ctx.complete); }
    openTwist();
    const r = qs.get('debugReveal');
    if (r !== null) reveal(clamp(+r || 0, 0, 2));
  }
  if (qs.get('debugSelect') && IDS.includes(qs.get('debugSelect'))) selectId(qs.get('debugSelect'), true);

  startLoop();

  return {
    destroy() {
      if (dead) return;
      dead = true;
      try { ac.abort(); } catch (e) { /* ignore */ }
      try { ro.disconnect(); } catch (e) { /* ignore */ }
      if (raf) cancelAnimationFrame(raf);
      if (layoutRaf) cancelAnimationFrame(layoutRaf);
      clearTimeout(terrainTimer);
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      audio.close();
      endGhost();
      try { root.remove(); } catch (e) { /* ignore */ }
      styleRef(-1);
    },
  };
}
