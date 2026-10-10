/*
 * Astra Finn - "Pack the Ship" (js/games/pack.js)
 *
 * A Synthesis-style trade-off game. The crew loads cargo into a Starship hold
 * under a weight limit. When the hold first reaches 60 tonnes, Mission Control
 * radios in: a fuel tank is leaking and the limit drops to 85. No score. After
 * LAUNCH, "Six months later on Mars..." shows 3 or 4 gentle story cards built
 * from what was packed.
 *
 * ctx.data schema (every field optional, built-in defaults below):
 * {
 *   "capacity": 100,                 // starting limit, in tonnes
 *   "twist": {                       // mid-game rule change; false switches it off
 *     "at": 60,                      // fires the first time the hold reaches this many tonnes
 *     "capacity": 85,                // the new limit
 *     "from": "Mission Control",
 *     "text": "A fuel tank is leaking. Your ship can now carry 85 tonnes.",
 *     "why": "Less fuel means the ship can lift less. Can you re-pack?"
 *   },
 *   "cargo": [                       // up to 12 items; ids below get built-in icons and stories
 *     { "id": "water", "label": "Water", "weight": 20, "icon": "water" }
 *   ],                               // icons: water food air solar greenhouse parts medicine
 *                                    //        rover printer toys piano bikes crate flag
 *   "outcomes": {                    // override or add story lines per cargo id
 *     "water": { "packed": "...", "missing": "..." },
 *     "printer": { "fix": "Used when spare parts were left behind but the printer came." }
 *   },                               // {commander} and {engineer} become the crew names
 *   "question": "What would you pack next time?"
 * }
 *
 * Debug URL params (dev only): debugCargo=water,food,piano  debugCap=85
 * debugTwist=1  debugLaunch=1 (+ debugRise=0.4 to freeze the lift-off)  debugResult=1  debugFly=0.5
 */

const MOD = 'pack';
let styleRefs = 0;

const DEFAULT_CARGO = [
  { id: 'water', label: 'Water', weight: 20 },
  { id: 'food', label: 'Food', weight: 15 },
  { id: 'air', label: 'Air maker', weight: 10 },
  { id: 'solar', label: 'Solar panels', weight: 10 },
  { id: 'greenhouse', label: 'Greenhouse', weight: 15 },
  { id: 'parts', label: 'Spare parts', weight: 10 },
  { id: 'medicine', label: 'Medicine', weight: 5 },
  { id: 'rover', label: 'Rover', weight: 20 },
  { id: 'printer', label: '3D printer', weight: 10 },
  { id: 'toys', label: 'Toys and books', weight: 5 },
  { id: 'piano', label: 'Piano', weight: 25 },
  { id: 'bikes', label: 'Bikes', weight: 10 },
];

// Gentle consequences. Missing items are always a problem the crew solved.
const STORY = {
  water: {
    packed: 'You brought water. Everyone had plenty to drink, and so did the plants!',
    missing: 'No water tank? The crew dug up ice under the ground and melted it. Mars has ice!',
  },
  air: {
    packed: 'Your air maker made fresh air from Mars air. A real machine called MOXIE has done this on Mars!',
    missing: "No air maker, so the crew used the ship's air tanks very carefully. The next ship brought a new one.",
  },
  greenhouse: { packed: 'You brought the greenhouse. Fresh lettuce and tomatoes on Mars!' },
  food: {
    packed: 'Lots of tasty space food. Next time, a greenhouse could grow fresh salad too!',
    missing: "No food crate! The crew shared the ship's snacks until a supply ship came. Lesson learned: food first!",
  },
  parts: {
    packed: 'When the air pump broke, Commander {commander} had a spare part. Fixed in ten minutes!',
    missing: 'No spare parts... When the air pump broke, the crew fixed it with tape and clever ideas, then waited for the next ship.',
  },
  printer: {
    packed: 'The 3D printer made new cups, tools and even a chess set!',
    fix: 'No spare parts... When the air pump broke, you made a new part with the 3D printer!',
  },
  solar: {
    packed: 'Solar panels turned sunshine into power. Lights on, heaters on!',
    missing: 'No solar panels, so the crew saved power with early nights. The next ship brought some.',
  },
  medicine: {
    packed: 'When someone caught a sniffle, the medicine kit helped them feel better fast.',
    missing: 'No medicine kit, so everyone was extra careful. A doctor on Earth helped by radio, but every answer took ages!',
  },
  rover: {
    packed: 'The rover drove you to a giant canyon. What a view!',
    missing: 'No rover, so you explored on foot. You found a shiny red rock right next to the base!',
  },
  toys: {
    packed: 'On dusty storm days, everyone read books and played games inside. Cosy!',
    missing: 'No toys? You made up a brilliant game with Mars pebbles!',
  },
  piano: { packed: 'You brought the piano! It was very heavy, but music every evening made everyone smile.' },
  bikes: { packed: 'Bike races round the base! Mars pulls on you less, so every bump felt bouncy.' },
};
const FIRST_CREW = 'You were the first crew to live on Mars. What an adventure!';
const TAGS = { packed: 'You packed it', solved: 'Problem solved', adventure: 'Big adventure' };

// Line icons, 48x48. Stroke is var(--ink); class "a" is the gold accent; "af" is a gold fill.
function starPath(cx, cy, R, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
  }
  return d + 'Z';
}
function gearPath(cx, cy, r1, r2, n) {
  let d = '';
  const step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a = i * step;
    const pts = [[r1, a], [r2, a + step * 0.12], [r2, a + step * 0.42], [r1, a + step * 0.54]];
    pts.forEach(([r, t], k) => {
      d += (i === 0 && k === 0 ? 'M' : 'L') + (cx + r * Math.cos(t)).toFixed(1) + ' ' + (cy + r * Math.sin(t)).toFixed(1);
    });
  }
  return d + 'Z';
}
const FAN_BLADE = 'M24 20.5c-1-5.5.8-10 5-10.5 3.4-.4 5.2 2.8 3.2 5.9-1.8 2.8-4.8 4.2-8.2 4.6z';
const ICON = {
  water: '<path d="M24 5.5C19 13 11.5 20.5 11.5 28.5a12.5 12.5 0 0 0 25 0C36.5 20.5 29 13 24 5.5z"/><path class="a" d="M17.5 29a7 7 0 0 0 5.5 6.5"/>',
  food: '<rect x="7" y="23" width="34" height="18" rx="3"/><path d="M7 32h34"/><circle class="a" cx="16" cy="15.5" r="6"/><path class="a" d="M16 9.5c.3-2.4 1.8-4 4-4.5"/><path d="M26 22.5c0-4.6 3.1-8 7-8s7 3.4 7 8"/>',
  air: '<circle cx="24" cy="24" r="18"/>' +
    [0, 120, 240].map(r => `<path d="${FAN_BLADE}" transform="rotate(${r} 24 24)"/>`).join('') +
    '<circle class="a" cx="24" cy="24" r="3.2"/>',
  solar: '<circle class="a" cx="11" cy="9" r="3.5"/><path class="a" d="M11 2v1.5M4 9h1.5M16.5 9H18M6 4l1 1M16 4l-1 1"/>' +
    '<path d="M14 18h28l-6 17H8z"/><path d="M11 26.5h28M23.3 18l-6 17M32.7 18l-6 17"/><path d="M22 35v6M16 41h12"/>',
  greenhouse: '<path d="M5 41h38"/><path d="M9 41V27a15 15 0 0 1 30 0v14"/><path d="M15 27h18"/>' +
    '<path class="a" d="M24 41v-9"/><path class="a" d="M24 36.5c-4.5 0-7-2.5-7-6 3.5 0 7 2 7 6z"/><path class="a" d="M24 33.5c0-4 2.5-6.5 6.5-6.5 0 3.5-2.5 6.5-6.5 6.5z"/>',
  parts: `<path class="a" d="${gearPath(15, 33, 6.5, 9.5, 8)}"/><circle class="a" cx="15" cy="33" r="2.5"/>` +
    '<g transform="rotate(-45 30 20)"><path d="M25 6.5V12a5 5 0 0 0 10 0V6.5"/><rect x="27.5" y="17" width="5" height="21" rx="2.5"/></g>',
  medicine: '<rect x="7" y="14" width="34" height="27" rx="5"/><path d="M18 14v-3.5A2.5 2.5 0 0 1 20.5 8h7a2.5 2.5 0 0 1 2.5 2.5V14"/>' +
    '<path class="a" style="stroke-width:3.6" d="M24 21v13M17.5 27.5h13"/>',
  rover: '<rect x="8" y="24" width="28" height="8" rx="2"/><path d="M31 24V13"/><rect x="27" y="7" width="13" height="6" rx="2"/><path d="M8 24h-2"/>' +
    '<circle class="a" cx="12" cy="37" r="4.5"/><circle class="a" cx="22" cy="37" r="4.5"/><circle class="a" cx="32" cy="37" r="4.5"/>',
  printer: '<rect x="7" y="6" width="34" height="36" rx="3"/><path d="M7 13h34"/><path d="M20 13h8v5l-4 4-4-4z"/><path d="M12 37h24"/>' +
    '<path class="a" d="M18.5 37v-8h11v8"/><path class="a" d="M24 23.5v2"/>',
  toys: `<path class="a" d="${starPath(24, 9, 6, 2.6)}"/>` +
    '<path d="M24 22c-5-3-11-3.5-17-2v20c6-1.5 12-1 17 2 5-3 11-3.5 17-2V20c-6-1.5-12-1-17 2zM24 22v20"/>',
  piano: '<path d="M8 25V10a2 2 0 0 1 2-2h28a2 2 0 0 1 2 2v15"/><rect x="5" y="25" width="38" height="8" rx="1.5"/>' +
    '<path d="M11.5 25v8M17.5 25v8M23.5 25v8M29.5 25v8M35.5 25v8M10 33v8M38 33v8"/>' +
    '<circle class="af" cx="20" cy="19" r="2.6"/><path class="a" d="M22.6 19v-8.5l5.5 2"/>',
  bikes: '<circle cx="12" cy="31" r="8"/><circle cx="36" cy="31" r="8"/><path d="M12 31h11l-4-12zM19 19h13l4 12M32 19l-9 12"/>' +
    '<path class="a" d="M15.5 17.5h7M32 19l-1.5-5h4.5"/>',
  crate: '<rect x="8" y="12" width="32" height="28" rx="3"/><path d="M8 20h32M20 12v8M28 12v8"/><path class="a" d="M18 30h12"/>',
  flag: '<path d="M5 41c6-6 12.5-8 19-8s13 2 19 8"/><path d="M17 34V7"/><path class="a" d="M17 8h16l-4 5 4 5H17"/>',
};

const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ROCKET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5c3 2.2 4.5 5.5 4.5 9.5v5h-9v-5c0-4 1.5-7.3 4.5-9.5z"/><path d="M7.5 13.5L5 16v3l2.5-1.5M16.5 13.5L19 16v3l-2.5-1.5M10.5 20.5h3"/><circle cx="12" cy="9" r="1.6"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
const REDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4.5H9"/></svg>';
const CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H10l-6 4z"/></svg>';
const ANTENNA = '<svg class="pk-antenna" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 27v15M17 42h14"/><circle class="af" cx="24" cy="24" r="3.4"/>' +
  '<path class="w1" d="M17.5 17.5a9.2 9.2 0 0 0 0 13M30.5 17.5a9.2 9.2 0 0 1 0 13"/><path class="w2" d="M12 12a17 17 0 0 0 0 24M36 12a17 17 0 0 1 0 24"/></svg>';

const SHIP_W = 240, SHIP_H = 540;
const BAY_TOP = 136, DECK_H = 65, BAY_BOTTOM = BAY_TOP + DECK_H * 4;

const CSS = `
.g-pack{position:absolute;inset:0;overflow:hidden;color:var(--ink);font-family:var(--font-body);font-size:20px;line-height:1.35;
  background:radial-gradient(70% 60% at 82% 30%,rgba(95,212,255,.07),transparent 70%),radial-gradient(60% 60% at 0% 100%,rgba(242,181,68,.05),transparent 70%);}
.g-pack .pk-main{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);
  grid-template-areas:"head head" "tray ship";gap:14px 24px;padding:16px 22px 18px;}
.g-pack .pk-main>*{min-width:0;}
.g-pack.portrait .pk-main{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"head" "ship" "tray";}
.g-pack.narrow .pk-main{grid-template-rows:auto auto auto;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:12px 14px 16px;gap:12px;}
.g-pack.narrow .pk-ship-area{height:var(--shiph,360px);}
.g-pack.portrait.narrow .pk-tray{height:auto;overflow:visible;}
.g-pack.narrow .pk-head h2{font-size:26px;}
.g-pack button{font-family:var(--font-display);-webkit-tap-highlight-color:transparent;}
.g-pack .pk-head{grid-area:head;display:flex;align-items:center;gap:16px;transition:opacity .4s;}
.g-pack .pk-titles{flex:1;min-width:0;}
.g-pack .pk-head h2{font-size:30px;line-height:1.1;}
.g-pack .pk-head p{margin:4px 0 0;color:var(--ink-2);font-size:20px;}
.g-pack .pk-head p b{color:var(--gold);font-weight:600;}
.g-pack .pk-kicker{font-family:var(--font-display);font-weight:600;font-size:18px;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);}
.g-pack .pk-kicker.gold{color:var(--gold);}

/* Tray */
.g-pack .pk-tray{grid-area:tray;display:grid;grid-template-columns:repeat(var(--cols,4),minmax(0,1fr));grid-auto-rows:minmax(120px,1fr);
  gap:12px;overflow-y:auto;overflow-x:hidden;min-height:0;padding:2px;transition:opacity .5s;-webkit-overflow-scrolling:touch;}
.g-pack.portrait .pk-tray{grid-auto-rows:var(--rowh,140px);height:var(--trayh,auto);}
.g-pack .pk-card{position:relative;appearance:none;margin:0;cursor:pointer;color:var(--ink);text-align:center;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px 8px;min-height:120px;
  border-radius:18px;border:1.5px solid var(--line);background:var(--panel);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  transition:border-color .25s,background .25s,transform .15s,box-shadow .25s;touch-action:manipulation;}
.g-pack .pk-card:active{transform:scale(.96);}
.g-pack .pk-card:focus-visible{outline:3px solid var(--gold);outline-offset:2px;}
.g-pack .pk-card.on{border-color:var(--gold);background:linear-gradient(180deg,rgba(242,181,68,.17),rgba(242,181,68,.04));box-shadow:0 0 0 1px rgba(242,181,68,.35),0 8px 26px rgba(242,181,68,.12);}
.g-pack .pk-ico{display:block;width:var(--ico,64px);height:var(--ico,64px);flex:none;transition:transform .25s,opacity .25s;}
.g-pack .pk-ico svg{width:100%;height:100%;display:block;}
.g-pack .pk-card.on .pk-ico{opacity:.55;transform:scale(.9);}
.g-pack .pk-name{font-weight:600;font-size:20px;line-height:1.1;}
.g-pack .pk-wt{display:flex;align-items:center;gap:7px;font-size:18px;color:var(--cyan);font-family:var(--font-display);}
.g-pack .pk-wt b{font-weight:600;}
.g-pack .pk-blocks{display:flex;gap:3px;}
.g-pack .pk-blocks i{display:block;width:7px;height:15px;border-radius:2px;background:var(--cyan);opacity:.8;}
.g-pack .pk-tick{position:absolute;top:8px;right:8px;width:32px;height:32px;border-radius:50%;background:var(--gold);color:var(--bg);
  display:grid;place-items:center;transform:scale(0);transition:transform .3s cubic-bezier(.2,1.6,.4,1);}
.g-pack .pk-tick svg{width:20px;height:20px;}
.g-pack .pk-card.on .pk-tick{transform:scale(1);}
.g-pack.tight .pk-card{min-height:110px;padding:8px 6px;}
.g-pack.tight .pk-name{font-size:18px;}

/* Icons */
.g-pack .pk-icon{fill:none;stroke:var(--ink);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;overflow:visible;}
.g-pack .pk-icon .a{stroke:var(--gold);}
.g-pack .pk-icon .af{fill:var(--gold);stroke:none;}

/* Ship area */
.g-pack .pk-ship-area{grid-area:ship;min-height:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;
  padding:14px 18px 14px 14px;border-radius:var(--radius);border:1px solid var(--line);
  background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.01));}
.g-pack .pk-visual{display:flex;gap:16px;height:100%;min-height:0;}
.g-pack.tight .pk-ship-area{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;gap:10px;padding:10px 12px;}
.g-pack.tight .pk-visual{justify-content:center;}
.g-pack .pk-shipbox{position:relative;width:var(--shipw,200px);height:100%;min-height:0;will-change:transform;}
.g-pack .pk-ship{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}
.g-pack .pk-hull{fill:var(--panel-solid);stroke:var(--steel);stroke-opacity:.6;stroke-width:2;}
.g-pack .pk-cut{fill:var(--bg);fill-opacity:.9;stroke:var(--steel);stroke-opacity:.28;stroke-width:1.5;}
.g-pack .pk-shelf{stroke:var(--steel);stroke-opacity:.55;stroke-width:3;stroke-linecap:round;}
.g-pack .pk-lamp{stroke:var(--gold-2);stroke-width:2.5;stroke-linecap:round;opacity:.85;}
.g-pack .pk-flap{fill:var(--panel-solid);stroke:var(--steel);stroke-opacity:.5;stroke-width:1.5;}
.g-pack .pk-bell{fill:var(--steel);fill-opacity:.28;stroke:var(--steel);stroke-opacity:.6;stroke-width:1.5;}
.g-pack .pk-tank-o{fill:var(--oxygen);fill-opacity:.16;stroke:var(--oxygen);stroke-opacity:.55;stroke-width:1.5;}
.g-pack .pk-tank-m{fill:var(--methane);fill-opacity:.1;}
.g-pack .pk-dome{fill:none;stroke:var(--methane);stroke-opacity:.5;stroke-width:1.5;}
.g-pack .pk-pipe{fill:none;stroke:var(--steel);stroke-opacity:.35;stroke-width:2;}
.g-pack .pk-weld{stroke:var(--steel);stroke-opacity:.18;stroke-width:1;}
.g-pack .pk-ph{fill:rgba(255,255,255,.015);stroke:var(--line);stroke-width:1.5;stroke-dasharray:4 4;}
.g-pack .pk-box{fill:var(--panel-solid);stroke:var(--gold);stroke-width:1.8;}
.g-pack .pk-slot.filled{cursor:pointer;}
.g-pack .pk-crate{transform-box:fill-box;transform-origin:50% 50%;}
.g-pack .pk-flame{opacity:0;transform-box:fill-box;transform-origin:50% 0;transition:opacity .25s;}
.g-pack .firing .pk-flame{opacity:1;animation:pk-flick .11s ease-in-out infinite alternate;}
@keyframes pk-flick{from{transform:scale(.94,.86);}to{transform:scale(1.04,1.08);}}
.g-pack .pk-leak circle{fill:var(--methane);opacity:0;transform-box:fill-box;transform-origin:50% 50%;}
.g-pack .leaking .pk-leak circle{animation:pk-puff 1.6s ease-out infinite;}
.g-pack .leaking .pk-leak circle:nth-child(2){animation-delay:.5s;}
.g-pack .leaking .pk-leak circle:nth-child(3){animation-delay:1s;}
@keyframes pk-puff{0%{opacity:.75;transform:translate(0,0) scale(.6);}100%{opacity:0;transform:translate(26px,-18px) scale(2.6);}}

/* Gauge */
.g-pack .pk-gauge{position:relative;width:104px;height:100%;}
.g-pack .pk-track{position:absolute;left:6px;top:6px;bottom:6px;width:46px;border-radius:23px;border:1.5px solid var(--line);background:rgba(255,255,255,.04);}
.g-pack .pk-trackin{position:absolute;inset:4px;border-radius:19px;overflow:hidden;
  background:repeating-linear-gradient(to top,transparent 0,transparent calc(var(--tick,7.7%) - 1px),rgba(255,255,255,.07) calc(var(--tick,7.7%) - 1px),rgba(255,255,255,.07) var(--tick,7.7%));}
.g-pack .pk-fill{position:absolute;left:0;right:0;bottom:0;height:0;border-radius:17px;background:linear-gradient(0deg,var(--cyan),var(--oxygen));
  box-shadow:0 0 22px rgba(95,212,255,.5);transition:height .55s cubic-bezier(.3,1.25,.5,1),background .5s,box-shadow .5s;}
.g-pack .over .pk-fill{background:var(--red);box-shadow:0 0 22px rgba(255,107,87,.55);}
.g-pack .over .pk-track{border-color:rgba(255,107,87,.55);animation:pk-warn 1.6s ease-in-out infinite;}
@keyframes pk-warn{50%{box-shadow:0 0 0 6px rgba(255,107,87,.12);}}
.g-pack .pk-limit{position:absolute;left:-6px;width:56px;height:0;border-top:3px solid var(--gold);
  bottom:calc(4px + (100% - 8px) * var(--lim,.77));transition:bottom 1.3s cubic-bezier(.65,0,.25,1);filter:drop-shadow(0 0 6px rgba(242,181,68,.6));}
.g-pack .pk-limit-tag{position:absolute;left:calc(100% + 4px);top:-17px;min-width:44px;text-align:center;background:var(--gold);color:var(--bg);
  font:600 18px/30px var(--font-display);padding:0 8px;border-radius:999px;}
.g-pack .pk-limit.moved .pk-limit-tag{animation:pk-tagpop .7s ease 1.2s 2;}
@keyframes pk-tagpop{50%{transform:scale(1.25);}}

/* Info */
.g-pack .pk-info{display:flex;flex-direction:column;justify-content:space-between;gap:14px;min-width:0;padding:4px 0;}
.g-pack.tight .pk-info{flex-direction:row;align-items:center;flex-wrap:wrap;}
.g-pack.tight .pk-info .pk-kicker{display:none;}
.g-pack.tight .pk-readout{gap:2px 8px;}
.g-pack.tight .pk-of{font-size:18px;}
.g-pack.tight .pk-launch{min-height:60px;font-size:22px;}
.g-pack.tight .pk-readwrap{flex:1;min-width:0;}
.g-pack.tight .pk-status{min-height:0;margin-top:4px;font-size:18px;}
.g-pack.tight .pk-launch{padding:0 20px;}
.g-pack .pk-readout{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-top:4px;}
.g-pack .pk-num{font-family:var(--font-display);font-weight:600;font-size:64px;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums;transition:color .4s;}
.g-pack.tight .pk-num{font-size:44px;}
.g-pack .pk-of{font-size:20px;color:var(--ink-2);}
.g-pack .pk-of em{font-style:normal;color:var(--gold);font-weight:600;}
.g-pack .over .pk-num{color:var(--red);}
.g-pack .pk-status{margin-top:10px;font-size:20px;color:var(--ink-2);min-height:2.7em;transition:color .3s;}
.g-pack .over .pk-status{color:var(--red);font-weight:600;}
.g-pack .pk-launch{width:100%;max-width:340px;padding:0 18px;}
.g-pack.tight .pk-launch{width:auto;flex:none;}
.g-pack .pk-launch:not(:disabled){animation:glow 1.6s ease-in-out infinite;}
.g-pack.launching .pk-main{overflow:hidden;}
.g-pack.launching .pk-head,.g-pack.launching .pk-tray,.g-pack.launching .pk-gauge,.g-pack.launching .pk-readwrap{opacity:.25;pointer-events:none;}
.g-pack.launching .pk-launch{opacity:1;animation:none;}

/* Flyer */
.g-pack .pk-flyer{position:absolute;left:0;top:0;z-index:20;pointer-events:none;filter:drop-shadow(0 0 10px rgba(242,181,68,.7));}
.g-pack .pk-flyer svg{width:100%;height:100%;display:block;}

/* Radio twist */
.g-pack .pk-modal{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,3,8,.62);}
.g-pack .pk-radio{width:min(660px,100%);max-height:100%;overflow-y:auto;display:flex;flex-direction:column;gap:14px;
  border-color:rgba(95,212,255,.45);box-shadow:var(--shadow),0 0 70px rgba(95,212,255,.16);}
.g-pack .pk-radio-head{display:flex;align-items:center;gap:16px;}
.g-pack .pk-radio-who{flex:1;min-width:0;}
.g-pack .pk-radio h3{font-size:30px;}
.g-pack .pk-antenna{width:64px;height:64px;flex:none;fill:none;stroke:var(--cyan);stroke-width:2.4;stroke-linecap:round;}
.g-pack .pk-antenna .af{fill:var(--gold);stroke:none;}
.g-pack .pk-antenna .w1{animation:pk-wave 1.4s ease-in-out infinite;}
.g-pack .pk-antenna .w2{animation:pk-wave 1.4s ease-in-out .35s infinite;}
@keyframes pk-wave{0%,100%{opacity:.15;}50%{opacity:1;}}
.g-pack .pk-radio-text{margin:0;font-family:var(--font-display);font-weight:500;font-size:27px;line-height:1.25;}
.g-pack .pk-cap{display:flex;align-items:center;gap:14px;font-family:var(--font-display);font-weight:600;color:var(--ink-2);font-size:22px;}
.g-pack .pk-cap svg{width:34px;height:34px;color:var(--ink-3);}
.g-pack .pk-cap .old{font-size:40px;color:var(--ink-3);text-decoration:line-through;text-decoration-thickness:3px;}
.g-pack .pk-cap .new{font-size:52px;color:var(--gold);line-height:1;}
.g-pack .pk-radio-why{margin:0;color:var(--ink-2);font-size:20px;}
.g-pack .pk-radio .btn{align-self:flex-start;}

/* Result */
.g-pack .pk-result{position:absolute;inset:0;z-index:40;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;
  background:radial-gradient(120% 70% at 50% 120%,rgba(255,107,87,.28),transparent 65%),var(--bg);}
.g-pack .pk-mars{position:absolute;left:0;right:0;bottom:0;width:100%;height:46%;pointer-events:none;}
.g-pack .pk-res-inner{position:relative;min-height:100%;display:flex;flex-direction:column;justify-content:center;gap:16px;
  padding:22px clamp(16px,2.4vw,32px);max-width:1500px;margin:0 auto;}
.g-pack .pk-res-head{display:flex;align-items:center;gap:16px;}
.g-pack .pk-res-title{flex:1;font-size:clamp(30px,3.4vw,46px);line-height:1.08;}
.g-pack .pk-res-packed{display:flex;flex-wrap:wrap;align-items:center;gap:8px 8px;}
.g-pack .pk-res-label{font-family:var(--font-display);font-weight:600;font-size:18px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-right:6px;}
.g-pack .pk-chip{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px 0 8px;border-radius:999px;border:1px solid rgba(242,181,68,.35);
  background:rgba(242,181,68,.06);font-size:18px;color:var(--ink);}
.g-pack .pk-chip svg{width:28px;height:28px;}
.g-pack .pk-res-w{font-family:var(--font-display);font-weight:600;font-size:18px;color:var(--cyan);margin-left:6px;}
.g-pack .pk-again{background:var(--panel-solid);}
.g-pack .pk-res-cards{display:grid;grid-template-columns:repeat(var(--rc,4),minmax(0,1fr));gap:16px;}
.g-pack .pk-story{display:flex;flex-direction:column;gap:12px;padding:18px 20px 14px;}
.g-pack .pk-story .pk-story-say{margin-top:auto;align-self:flex-end;}
.g-pack .pk-story p{margin:0;font-size:20px;line-height:1.4;}
.g-pack .pk-story-top{display:flex;align-items:center;gap:12px;}
.g-pack .pk-story-ico{width:58px;height:58px;flex:none;border-radius:16px;border:1.5px solid rgba(242,181,68,.45);background:rgba(242,181,68,.06);display:grid;place-items:center;}
.g-pack .pk-story-ico svg{width:42px;height:42px;}
.g-pack .pk-story.solved .pk-story-ico{border-color:rgba(95,212,255,.45);background:rgba(95,212,255,.06);}
.g-pack .pk-tag{flex:1;min-width:0;font-family:var(--font-display);font-weight:600;font-size:18px;color:var(--gold);line-height:1.15;}
.g-pack .pk-story.solved .pk-tag{color:var(--cyan);}
.g-pack .pk-res-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:4px;}
.g-pack .pk-ask{display:flex;align-items:center;gap:12px;color:var(--cyan);font-size:21px;}
.g-pack .pk-ask svg{width:28px;height:28px;flex:none;}
.g-pack .pk-ask b{font-family:var(--font-display);font-size:18px;letter-spacing:.1em;text-transform:uppercase;margin-right:8px;}
.g-pack.is-paused,.g-pack.is-paused *{animation-play-state:paused !important;}
@media (prefers-reduced-motion: reduce){.g-pack .pk-card,.g-pack .pk-fill,.g-pack .pk-limit{transition:none;}.g-pack .pk-launch:not(:disabled),.g-pack .over .pk-track{animation:none;}}
`;

function injectStyle() {
  styleRefs++;
  if (document.querySelector(`style[data-module="${MOD}"]`)) return;
  const s = document.createElement('style');
  s.setAttribute('data-module', MOD);
  s.textContent = CSS;
  document.head.appendChild(s);
}
function releaseStyle() {
  styleRefs = Math.max(0, styleRefs - 1);
  if (styleRefs === 0) {
    const s = document.querySelector(`style[data-module="${MOD}"]`);
    if (s) s.remove();
  }
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const posNum = (v, d) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : d);

function normaliseCargo(list) {
  const defaults = () => DEFAULT_CARGO.map(c => ({ ...c, icon: c.id }));
  if (!Array.isArray(list) || !list.length) return defaults();
  const seen = new Set();
  const out = [];
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    const id = String(c.id || c.label || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!id || seen.has(id)) continue;
    const base = DEFAULT_CARGO.find(d => d.id === id);
    out.push({
      id,
      label: String(c.label || (base && base.label) || id),
      weight: Math.round(posNum(Number(c.weight), base ? base.weight : 10)),
      icon: ICON[c.icon] ? c.icon : (ICON[id] ? id : 'crate'),
    });
    seen.add(id);
    if (out.length >= 12) break;
  }
  return out.length ? out : defaults();
}

function makeTwist(t, cap0) {
  if (t === false || t === null) return null;
  const o = t && typeof t === 'object' ? t : {};
  const capacity = Math.round(posNum(Number(o.capacity), Math.round(cap0 * 0.85)));
  return {
    at: posNum(Number(o.at), Math.round(cap0 * 0.6)),
    capacity,
    from: String(o.from || 'Mission Control'),
    text: String(o.text || `A fuel tank is leaking. Your ship can now carry ${capacity} tonnes.`),
    why: String(o.why || 'Less fuel means the ship can lift less. Can you re-pack?'),
  };
}

function makeSound(on) {
  let ac = null;
  const get = () => {
    if (!on) return null;
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  };
  const tone = (f0, f1, dur, gain = 0.05, type = 'sine', delay = 0) => {
    const a = get();
    if (!a) return;
    try {
      const t = a.currentTime + delay;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  };
  const noise = (dur, gain = 0.03, freq = 900, type = 'bandpass', delay = 0) => {
    const a = get();
    if (!a) return;
    try {
      const len = Math.max(1, Math.floor(a.sampleRate * dur));
      const buf = a.createBuffer(1, len, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const s = a.createBufferSource();
      s.buffer = buf;
      const f = a.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = a.createGain();
      const t = a.currentTime + delay;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(a.destination);
      s.start(t);
      s.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  };
  return {
    load: () => tone(240, 110, 0.2, 0.07),
    unload: () => tone(300, 560, 0.13, 0.035, 'triangle'),
    radio: () => { noise(0.45, 0.02, 1900); tone(880, 880, 0.12, 0.035, 'sine', 0.5); tone(1175, 1175, 0.16, 0.035, 'sine', 0.68); },
    tick: () => tone(660, 660, 0.09, 0.03, 'triangle'),
    rumble: () => noise(2.8, 0.07, 160, 'lowpass'),
    close: () => { try { if (ac) ac.close(); } catch (e) { /* ignore */ } ac = null; },
  };
}

function shipSVG(u) {
  const hull = 'M30 470V136C30 78 66 26 120 8C174 26 210 78 210 136V470Z';
  const engines = [92, 120, 148];
  const floors = [0, 1, 2, 3].map(i => BAY_BOTTOM - i * DECK_H); // bottom deck first
  let decks = '';
  floors.forEach(f => {
    const ceil = f - DECK_H;
    decks += `<rect x="40" y="${ceil}" width="160" height="56" fill="url(#${u}l)"/>` +
      `<path class="pk-lamp" d="M108 ${ceil + 3}h24"/>` +
      (f < BAY_BOTTOM ? `<path class="pk-shelf" d="M42 ${f}h156"/>` : '');
  });
  let slots = '';
  for (let d = 0; d < 4; d++) {
    for (let j = 0; j < 3; j++) {
      const k = d * 3 + j;
      slots += `<g class="pk-slot" data-slot="${k}" transform="translate(${47 + j * 50} ${floors[d] - 50})">` +
        `<rect class="pk-ph" x="0" y="0" width="46" height="46" rx="8"/><g class="pk-crate"></g></g>`;
    }
  }
  let welds = '';
  for (let y = 410; y < 470; y += 20) welds += `M31 ${y}H39M201 ${y}H209`;
  return `<svg class="pk-ship" viewBox="0 0 ${SHIP_W} ${SHIP_H}" preserveAspectRatio="xMidYMax meet" aria-label="Starship cargo hold">
  <defs>
    <linearGradient id="${u}h" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" style="stop-color:var(--steel);stop-opacity:.08"/>
      <stop offset=".28" style="stop-color:var(--steel);stop-opacity:.42"/>
      <stop offset=".55" style="stop-color:var(--steel);stop-opacity:.22"/>
      <stop offset="1" style="stop-color:var(--steel);stop-opacity:.06"/>
    </linearGradient>
    <linearGradient id="${u}f" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" style="stop-color:var(--ink);stop-opacity:1"/>
      <stop offset=".25" style="stop-color:var(--gold-2);stop-opacity:1"/>
      <stop offset=".6" style="stop-color:var(--gold);stop-opacity:.85"/>
      <stop offset="1" style="stop-color:var(--red);stop-opacity:0"/>
    </linearGradient>
    <radialGradient id="${u}l" cx=".5" cy="0" r=".9">
      <stop offset="0" style="stop-color:var(--gold-2);stop-opacity:.2"/>
      <stop offset="1" style="stop-color:var(--gold-2);stop-opacity:0"/>
    </radialGradient>
  </defs>
  <g class="pk-flame">${engines.map(c => `<path d="M${c - 11} 498Q${c} ${c === 120 ? 610 : 590} ${c + 11} 498Z" fill="url(#${u}f)"/>`).join('')}</g>
  ${engines.map(c => `<path class="pk-bell" d="M${c - 8} 470L${c - 13} 500H${c + 13}L${c + 8} 470Z"/>`).join('')}
  <path class="pk-flap" d="M31 400L8 426V470H31Z"/><path class="pk-flap" d="M209 400L232 426V470H209Z"/>
  <path class="pk-flap" d="M36 86L15 104V128H32Z"/><path class="pk-flap" d="M204 86L225 104V128H208Z"/>
  <path class="pk-hull" d="${hull}"/><path d="${hull}" fill="url(#${u}h)"/>
  <path class="pk-weld" d="${welds}"/>
  <path class="pk-cut" d="M44 130C44 88 74 46 120 26C166 46 196 88 196 130Z"/>
  <ellipse class="pk-tank-o" cx="120" cy="98" rx="24" ry="17"/><path class="pk-pipe" d="M120 115V130"/>
  <rect class="pk-cut" x="40" y="${BAY_TOP}" width="160" height="${DECK_H * 4}" rx="4"/>
  ${decks}
  ${slots}
  <path class="pk-tank-m" d="M40 466V420Q120 402 200 420V466Z"/><path class="pk-dome" d="M40 420Q120 402 200 420"/>
  <path class="pk-pipe" d="M120 ${BAY_BOTTOM}V408"/>
  <g class="pk-leak"><circle cx="212" cy="442" r="5"/><circle cx="212" cy="442" r="5"/><circle cx="212" cy="442" r="5"/></g>
</svg>`;
}

function marsSVG(u) {
  return `<svg class="pk-mars" viewBox="0 0 1600 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs><linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" style="stop-color:var(--red);stop-opacity:0"/><stop offset="1" style="stop-color:var(--red);stop-opacity:.18"/>
  </linearGradient></defs>
  <rect width="1600" height="420" fill="url(#${u}s)"/>
  <path d="M0 290C200 245 380 268 560 238S900 250 1100 228 1400 258 1600 214V420H0Z" style="fill:var(--red);fill-opacity:.13"/>
  <g transform="translate(1388 150)" style="fill:var(--steel);fill-opacity:.34">
    <path d="M0 175V40C0 18 10 4 20 0 30 4 40 18 40 40V175Z"/><path d="M0 150L-12 165V178H0ZM40 150L52 165V178H40Z"/>
  </g>
  <path d="M1170 330a70 70 0 0 1 140 0Z" style="fill:var(--steel);fill-opacity:.22"/>
  <circle cx="1215" cy="306" r="5" style="fill:var(--gold);fill-opacity:.9"/><circle cx="1240" cy="300" r="5" style="fill:var(--gold);fill-opacity:.9"/><circle cx="1265" cy="306" r="5" style="fill:var(--gold);fill-opacity:.9"/>
  <path d="M0 345C260 318 520 342 760 318S1200 330 1600 300V420H0Z" style="fill:var(--red);fill-opacity:.2"/>
  <path d="M0 392C300 372 700 396 1000 376S1400 382 1600 366V420H0Z" style="fill:var(--bg);fill-opacity:.55"/>
</svg>`;
}

export async function mount(el, ctx = {}) {
  ctx = ctx || {};
  const data = ctx.data && typeof ctx.data === 'object' ? ctx.data : {};
  const crew = { commander: 'Finn', engineer: 'Dad', ...(ctx.crew || {}) };
  const call = (fn, ...a) => {
    try { return typeof fn === 'function' ? fn(...a) : undefined; } catch (e) { console.warn('[pack]', e); return undefined; }
  };
  const say = t => call(ctx.speak, t);
  const fill = t => String(t == null ? '' : t)
    .replace(/\{commander\}/g, crew.commander || 'Commander')
    .replace(/\{engineer\}/g, crew.engineer || 'Engineer');
  let params;
  try { params = new URLSearchParams(location.search); } catch (e) { params = new URLSearchParams(); }
  let reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  const cargo = normaliseCargo(data.cargo);
  const byId = new Map(cargo.map(c => [c.id, c]));
  const cap0 = Math.round(posNum(Number(data.capacity), 100));
  const twist = makeTwist(data.twist, cap0);
  const outcomes = data.outcomes && typeof data.outcomes === 'object' ? data.outcomes : {};
  const question = fill(data.question || 'What would you pack next time?');
  const scaleMax = Math.max(cap0 * 1.3, 10);
  const SLOTS = 12;
  const dbgFly = params.has('debugFly') ? clamp(Number(params.get('debugFly')) || 0, 0, 1) : -1;

  let phase = 'pack'; // pack | twist | launch | result
  let capacity = cap0;
  let twisted = false;
  let warnedHeavy = false;
  let destroyed = false;
  let paused = false;
  const loaded = new Map(); // id -> slot index
  const flyingIn = new Set();
  const anims = new Set();
  const sfx = makeSound(!!ctx.sound);
  let refs = {};
  let story = [];

  injectStyle();
  const uid = 'pk' + Math.random().toString(36).slice(2, 8);
  const root = document.createElement('div');
  root.className = 'g-pack';
  root.style.setProperty('--tick', (10 / scaleMax) * 100 + '%');
  el.appendChild(root);

  const intro = () => `Pack the ship for Mars! Tap the cargo to load it. Stay under the gold line: ${capacity} tonnes.`;

  // ---------- helpers ----------
  // Web Animation wrapper. Resolves true when done, false if cancelled or destroyed.
  // A timer backs up the finished promise, so game logic never stalls if the
  // browser stops producing frames; it waits while the module is paused.
  const timers = new Set();
  function anim(node, frames, opts) {
    if (destroyed || !node || typeof node.animate !== 'function') return Promise.resolve(!destroyed);
    let a;
    try { a = node.animate(frames, opts); } catch (e) { return Promise.resolve(!destroyed); }
    anims.add(a);
    if (paused) { try { a.pause(); } catch (e) { /* ignore */ } }
    const total = (Number(opts && opts.duration) || 0) + (Number(opts && opts.delay) || 0);
    return new Promise(resolve => {
      let done = false, t = 0;
      const finish = ok => {
        if (done) return;
        done = true;
        clearTimeout(t);
        timers.delete(t);
        anims.delete(a);
        resolve(ok && !destroyed);
      };
      const arm = () => {
        t = setTimeout(() => {
          timers.delete(t);
          if (done) return;
          if (destroyed || a.playState === 'idle') { finish(false); return; }
          if (paused || a.playState === 'paused') { arm(); return; }
          try { a.finish(); } catch (e) { /* ignore */ }
          finish(true);
        }, total + 350);
        timers.add(t);
      };
      a.finished.then(() => finish(true), () => finish(false));
      arm();
    });
  }
  const wait = ms => anim(root, [], { duration: Math.max(0, ms) });
  const landedWeight = () => {
    let w = 0;
    loaded.forEach((s, id) => { if (!flyingIn.has(id)) w += byId.get(id).weight; });
    return w;
  };
  const totalWeight = () => {
    let w = 0;
    loaded.forEach((s, id) => { w += byId.get(id).weight; });
    return w;
  };
  const idAtSlot = k => { for (const [id, s] of loaded) if (s === k) return id; return null; };
  const firstFreeSlot = () => {
    const used = new Set(loaded.values());
    for (let k = 0; k < SLOTS; k++) if (!used.has(k)) return k;
    return -1;
  };
  const relRect = node => {
    const r = node.getBoundingClientRect();
    const o = root.getBoundingClientRect();
    return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
  };
  const iconSVG = icon => `<svg class="pk-icon" viewBox="0 0 48 48" aria-hidden="true">${ICON[icon] || ICON.crate}</svg>`;

  // ---------- build ----------
  function cardHTML(c) {
    const blocks = clamp(Math.round(c.weight / 5), 1, 8);
    return `<button class="pk-card" data-id="${esc(c.id)}" aria-pressed="false" aria-label="${esc(c.label)}, ${c.weight} tonnes">
      <span class="pk-tick" aria-hidden="true">${TICK}</span>
      <span class="pk-ico">${iconSVG(c.icon)}</span>
      <span class="pk-name">${esc(c.label)}</span>
      <span class="pk-wt"><span class="pk-blocks" aria-hidden="true">${'<i></i>'.repeat(blocks)}</span><b>${c.weight}</b> t</span>
    </button>`;
  }

  function buildMain() {
    root.innerHTML = `<div class="pk-main">
      <header class="pk-head">
        <div class="pk-titles">
          <h2 class="display">Pack the Ship</h2>
          <p>Tap cargo to load it. Stay under the <b>gold line</b>!</p>
        </div>
        <button class="speak-btn pk-say" aria-label="Read aloud">${SPEAKER}</button>
      </header>
      <section class="pk-tray" aria-label="Cargo">${cargo.map(cardHTML).join('')}</section>
      <section class="pk-ship-area">
        <div class="pk-visual">
          <div class="pk-shipbox">${shipSVG(uid)}</div>
          <div class="pk-gauge" aria-hidden="true">
            <div class="pk-track"><div class="pk-trackin"><div class="pk-fill"></div></div>
              <div class="pk-limit"><span class="pk-limit-tag">${capacity}</span></div></div>
          </div>
        </div>
        <div class="pk-info">
          <div class="pk-readwrap">
            <div class="pk-kicker">Cargo weight</div>
            <div class="pk-readout"><b class="pk-num">0</b><span class="pk-of">of <em class="pk-capn">${capacity}</em> tonnes</span></div>
            <div class="pk-status" aria-live="polite"></div>
          </div>
          <button class="btn big pk-launch" disabled>${ROCKET}<span class="pk-launch-t">Launch</span></button>
        </div>
      </section></div>`;
    const q = s => root.querySelector(s);
    refs = {
      tray: q('.pk-tray'),
      cards: new Map([...root.querySelectorAll('.pk-card')].map(b => [b.dataset.id, b])),
      shipArea: q('.pk-ship-area'),
      shipBox: q('.pk-shipbox'),
      svg: q('.pk-ship'),
      slots: [...root.querySelectorAll('.pk-slot')].sort((a, b) => a.dataset.slot - b.dataset.slot),
      fill: q('.pk-fill'),
      limit: q('.pk-limit'),
      limitTag: q('.pk-limit-tag'),
      num: q('.pk-num'),
      capN: q('.pk-capn'),
      status: q('.pk-status'),
      launch: q('.pk-launch'),
      launchT: q('.pk-launch-t'),
    };
    renderAll();
    layout();
  }

  // ---------- render ----------
  function renderCards() {
    refs.cards.forEach((b, id) => {
      const on = loaded.has(id);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function renderHold() {
    refs.slots.forEach((g, k) => {
      const id = idAtSlot(k);
      const show = id && !flyingIn.has(id);
      const crate = g.querySelector('.pk-crate');
      const cur = crate.getAttribute('data-id') || '';
      if (show && cur !== id) {
        crate.setAttribute('data-id', id);
        crate.innerHTML = `<rect class="pk-box" x="0" y="0" width="46" height="46" rx="8"/>` +
          `<svg class="pk-icon" x="6" y="6" width="34" height="34" viewBox="0 0 48 48">${ICON[byId.get(id).icon] || ICON.crate}</svg>`;
      } else if (!show && cur) {
        crate.removeAttribute('data-id');
        crate.innerHTML = '';
      }
      g.classList.toggle('filled', !!show);
    });
  }
  function renderGauge() {
    const w = landedWeight();
    const over = w > capacity;
    refs.shipArea.classList.toggle('over', over);
    refs.fill.style.height = (Math.min(w / scaleMax, 1) * 100).toFixed(2) + '%';
    refs.limit.style.setProperty('--lim', (capacity / scaleMax).toFixed(4));
    refs.limitTag.textContent = capacity;
    refs.num.textContent = w;
    refs.capN.textContent = capacity;
    let msg;
    if (!w) msg = 'Tap the cargo to pack it.';
    else if (over) msg = 'Too heavy! Take something out.';
    else if (w === capacity) msg = 'Full to the top!';
    else msg = `Room for ${capacity - w} more tonnes.`;
    if (refs.status.textContent !== msg) refs.status.textContent = msg;
    refs.launch.disabled = phase !== 'pack' || !w || over || flyingIn.size > 0;
  }
  function renderAll() { renderCards(); renderHold(); renderGauge(); }

  // ---------- layout ----------
  function layout() {
    if (destroyed || !refs.tray) return;
    const w = el.clientWidth || root.clientWidth;
    const h = el.clientHeight || root.clientHeight;
    if (!w || !h) return;
    const portrait = w < 900 || w / h < 1.15;
    const narrow = portrait && (w < 620 || h < 760);
    const tight = narrow;
    root.classList.toggle('portrait', portrait);
    root.classList.toggle('narrow', narrow);
    root.classList.toggle('tight', tight);
    if (narrow) root.style.setProperty('--shiph', Math.round(clamp(Math.min(w * 1.05, h * 0.62), 300, 460)) + 'px');
    const cols = w < 420 ? 2 : w < 560 ? 3 : 4;
    const rows = Math.ceil(cargo.length / cols);
    root.style.setProperty('--cols', cols);
    if (narrow) {
      root.style.setProperty('--rowh', (w < 420 ? 118 : 128) + 'px');
    } else if (portrait) {
      const avail = h * 0.43;
      const rowh = clamp((avail - (rows - 1) * 12 - 4) / rows, 112, 170);
      root.style.setProperty('--rowh', rowh + 'px');
      root.style.setProperty('--trayh', Math.min(avail, rows * rowh + (rows - 1) * 12 + 4) + 'px');
    }
    const card = refs.tray.querySelector('.pk-card');
    if (card) {
      const ch = card.clientHeight, cw = card.clientWidth;
      const ico = clamp(Math.min(ch - 82, cw * 0.5, ch * 0.46), 34, 84);
      root.style.setProperty('--ico', Math.round(ico) + 'px');
    }
    const sh = refs.shipBox.clientHeight;
    const aw = refs.shipArea.clientWidth;
    const sw = clamp(Math.min((sh * SHIP_W) / SHIP_H, aw * (tight ? 0.5 : 0.46)), 80, 420);
    root.style.setProperty('--shipw', Math.round(sw) + 'px');
    if (refs.result) sizeResult();
  }
  function sizeResult() {
    const w = root.clientWidth, h = root.clientHeight;
    const n = story.length || 4;
    const rc = w < 640 ? 1 : (w < 1000 || w / h < 1.2) ? 2 : n;
    root.style.setProperty('--rc', rc);
  }

  // ---------- fly animation ----------
  function fly(icon, fromEl, toEl, toSlot) {
    if (reduced || !fromEl || !toEl || destroyed) return Promise.resolve(!destroyed);
    const a = relRect(fromEl), b = relRect(toEl);
    if (!a.w || !b.w) return Promise.resolve(!destroyed);
    const base = Math.max(a.w, b.w);
    const k = toSlot ? 34 / 46 : 1;
    const kFrom = toSlot ? 1 : 34 / 46;
    const s0 = (a.w * kFrom) / base, s1 = (b.w * k) / base;
    const x0 = a.x + a.w / 2 - base / 2, y0 = a.y + a.h / 2 - base / 2;
    const x1 = b.x + b.w / 2 - base / 2, y1 = b.y + b.h / 2 - base / 2;
    const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - Math.min(90, Math.abs(x1 - x0) * 0.25 + 30);
    const f = document.createElement('div');
    f.className = 'pk-flyer';
    f.style.width = f.style.height = base + 'px';
    f.innerHTML = iconSVG(icon);
    root.appendChild(f);
    const pr = anim(f, [
      { transform: `translate(${x0}px,${y0}px) scale(${s0})` },
      { transform: `translate(${mx}px,${my}px) scale(${((s0 + s1) / 2) * 1.08}) rotate(${toSlot ? -10 : 10}deg)`, offset: 0.48 },
      { transform: `translate(${x1}px,${y1}px) scale(${s1})` },
    ], { duration: 640, easing: 'cubic-bezier(.45,0,.3,1)' }).then(ok => { f.remove(); return ok; });
    if (dbgFly >= 0) { const an = f.getAnimations()[0]; if (an) { an.pause(); an.currentTime = 640 * dbgFly; } }
    return pr;
  }

  // ---------- actions ----------
  function load(id) {
    const slot = firstFreeSlot();
    if (slot < 0) return;
    loaded.set(id, slot);
    flyingIn.add(id);
    renderCards();
    renderGauge();
    const card = refs.cards.get(id);
    const from = card && card.querySelector('.pk-ico');
    const to = refs.slots[slot] && refs.slots[slot].querySelector('.pk-ph');
    const myRefs = refs;
    fly(byId.get(id).icon, from, to, true).then(ok => {
      if (!ok || destroyed || refs !== myRefs) return;
      flyingIn.delete(id);
      renderHold();
      renderGauge();
      sfx.load();
      const crate = refs.slots[slot].querySelector('.pk-crate');
      if (!reduced) anim(crate, [{ transform: 'scale(1.25)' }, { transform: 'scale(.94)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
      afterChange();
    });
  }
  function unload(id) {
    if (flyingIn.has(id)) return;
    const slot = loaded.get(id);
    const from = refs.slots[slot] && refs.slots[slot].querySelector('.pk-ph');
    loaded.delete(id);
    renderHold();
    renderCards();
    renderGauge();
    sfx.unload();
    const card = refs.cards.get(id);
    fly(byId.get(id).icon, from, card && card.querySelector('.pk-ico'), false);
    afterChange();
  }
  function toggle(id) {
    if (phase !== 'pack' || !byId.has(id)) return;
    if (loaded.has(id)) unload(id); else load(id);
  }
  function afterChange() {
    if (destroyed || phase !== 'pack') return;
    const w = landedWeight();
    if (w > capacity && !warnedHeavy && flyingIn.size === 0) {
      warnedHeavy = true;
      say('Too heavy! Take something out.');
    }
    if (twist && !twisted && w >= twist.at) {
      twisted = true;
      phase = 'twist';
      renderGauge();
      wait(reduced ? 150 : 550).then(ok => { if (ok) showTwist(); });
    }
  }

  // ---------- twist ----------
  const twistSpeech = () => `${twist.from} calling ${crew.commander}! ${fill(twist.text)} ${fill(twist.why)}`;
  function showTwist() {
    if (destroyed || !twist) return;
    phase = 'twist';
    const m = document.createElement('div');
    m.className = 'pk-modal';
    m.innerHTML = `<div class="card pk-radio" role="dialog" aria-modal="true" aria-label="Radio message">
      <div class="pk-radio-head">${ANTENNA}
        <div class="pk-radio-who"><div class="pk-kicker">Incoming radio message</div><h3 class="display">${esc(twist.from)}</h3></div>
        <button class="speak-btn pk-radio-say" aria-label="Read aloud">${SPEAKER}</button>
      </div>
      <p class="pk-radio-text">${esc(fill(twist.text))}</p>
      <div class="pk-cap"><span class="old">${capacity}</span>${ARROW}<span class="new">${twist.capacity}</span><span>tonnes</span></div>
      <p class="pk-radio-why">${esc(fill(twist.why))}</p>
      <button class="btn big pk-roger">Roger that!</button>
    </div>`;
    root.appendChild(m);
    refs.modal = m;
    renderGauge();
    if (refs.svg) refs.svg.classList.add('leaking');
    sfx.radio();
    say(twistSpeech());
    if (!reduced) {
      anim(m, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
      anim(m.firstElementChild, [
        { opacity: 0, transform: 'translateY(28px) scale(.95)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 460, easing: 'cubic-bezier(.2,.9,.3,1.15)' });
    }
  }
  async function closeTwist() {
    const m = refs.modal;
    if (!m) return;
    refs.modal = null;
    if (!reduced) await anim(m, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' });
    m.remove();
    if (destroyed) return;
    capacity = twist.capacity;
    phase = 'pack';
    if (refs.limit) {
      refs.limit.classList.remove('moved');
      void refs.limit.offsetWidth;
      refs.limit.classList.add('moved');
    }
    renderGauge();
    if (landedWeight() > capacity) warnedHeavy = true;
    const svg = refs.svg;
    wait(5200).then(ok => { if (ok && svg) svg.classList.remove('leaking'); });
  }

  // ---------- launch ----------
  async function launch() {
    const w = landedWeight();
    if (phase !== 'pack' || !w || w > capacity || flyingIn.size) return;
    phase = 'launch';
    root.classList.add('launching');
    refs.launch.disabled = true;
    say('Three, two, one... liftoff!');
    for (const n of ['3', '2', '1']) {
      refs.launchT.textContent = n;
      sfx.tick();
      if (!await wait(reduced ? 250 : 800)) return;
    }
    refs.launchT.textContent = 'Liftoff!';
    refs.svg.classList.add('firing');
    sfx.rumble();
    if (!reduced) {
      const shake = [];
      for (let i = 0; i <= 10; i++) shake.push({ transform: `translate(${i % 2 ? 2 : -2}px,${i % 3 ? 1 : -1}px)` });
      shake.push({ transform: 'translate(0,0)' });
      if (!await anim(refs.shipBox, shake, { duration: 700 })) return;
      const dy = relRect(refs.shipBox).y + refs.shipBox.clientHeight + 160;
      const rise = anim(refs.shipBox, [{ transform: 'translateY(0)' }, { transform: `translateY(${-dy}px)` }],
        { duration: 1800, easing: 'cubic-bezier(.5,0,.9,.45)', fill: 'forwards' });
      if (params.has('debugRise')) {
        const an = refs.shipBox.getAnimations()[0];
        if (an) { an.pause(); an.currentTime = 1800 * clamp(Number(params.get('debugRise')) || 0, 0, 1); }
      }
      if (!await rise) return;
    } else if (!await wait(500)) return;
    showResult(false);
  }

  // ---------- story ----------
  function buildStory(has) {
    const offered = id => byId.has(id);
    const missing = id => offered(id) && !has.has(id);
    const text = (id, key) => {
      const o = outcomes[id];
      if (o && typeof o[key] === 'string') return o[key];
      return STORY[id] && STORY[id][key];
    };
    const iconOf = id => (byId.get(id) && byId.get(id).icon) || (ICON[id] ? id : 'crate');
    const good = [], solved = [];
    const G = (pri, id, key = 'packed', tag = 'packed') => { const t = text(id, key); if (t) good.push({ pri, id, icon: iconOf(id), text: fill(t), tag }); };
    const S = (pri, id) => { const t = text(id, 'missing'); if (t) solved.push({ pri, id, icon: iconOf(id), text: fill(t), tag: 'solved' }); };

    if (has.has('greenhouse')) G(1, 'greenhouse');
    if (has.has('parts')) G(2, 'parts');
    else if (missing('parts') && has.has('printer')) {
      const t = text('printer', 'fix');
      if (t) solved.push({ pri: 0, id: 'printer', icon: iconOf('printer'), text: fill(t), tag: 'solved' });
    } else if (missing('parts')) S(4, 'parts');
    if (has.has('piano')) G(3, 'piano');
    if (has.has('air')) G(4, 'air'); else if (missing('air')) S(2, 'air');
    if (has.has('water')) G(5, 'water'); else if (missing('water')) S(1, 'water');
    if (has.has('rover')) G(6, 'rover'); else if (missing('rover')) S(8, 'rover');
    if (has.has('solar')) G(7, 'solar'); else if (missing('solar')) S(5, 'solar');
    if (has.has('food') && !has.has('greenhouse')) G(8, 'food');
    if (missing('food') && !has.has('greenhouse')) S(3, 'food');
    if (has.has('printer') && has.has('parts')) G(9, 'printer');
    if (has.has('toys')) G(10, 'toys'); else if (missing('toys')) S(9, 'toys');
    if (has.has('bikes')) G(11, 'bikes');
    if (has.has('medicine')) G(12, 'medicine'); else if (missing('medicine')) S(6, 'medicine');
    for (const c of cargo) {
      if (STORY[c.id]) continue;
      if (has.has(c.id)) {
        const t = text(c.id, 'packed') || `You brought the ${c.label.toLowerCase()}. Good thinking!`;
        good.push({ pri: 20, id: c.id, icon: c.icon, text: fill(t), tag: 'packed' });
      } else {
        const t = text(c.id, 'missing');
        if (t) solved.push({ pri: 20, id: c.id, icon: c.icon, text: fill(t), tag: 'solved' });
      }
    }
    good.sort((a, b) => a.pri - b.pri);
    solved.sort((a, b) => a.pri - b.pri);
    // A well-packed ship gets mostly happy cards; one missing lots of essentials gets two "problem solved" stories.
    const covered = { water: ['water'], air: ['air'], food: ['food', 'greenhouse'], parts: ['parts', 'printer'], solar: ['solar'], medicine: ['medicine'] };
    const missingEssentials = Object.keys(covered).filter(k => offered(k) && !covered[k].some(id => has.has(id))).length;
    let nS = Math.min(solved.length, good.length >= 3 && missingEssentials <= 2 ? 1 : 2);
    const nG = Math.min(good.length, 4 - nS);
    if (nG + nS < 4) nS = Math.min(solved.length, 4 - nG);
    const g = good.slice(0, nG), s = solved.slice(0, nS);
    if (g.length < 2) g.push({ pri: 99, id: 'first', icon: 'flag', text: FIRST_CREW, tag: 'adventure' });
    const out = [];
    while (g.length || s.length) {
      if (g.length) out.push(g.shift());
      if (s.length) out.push(s.shift());
    }
    return out.slice(0, 4);
  }
  const storySpeech = () => `Six months later, on Mars... ${story.map(s => s.text).join(' ')}`;

  async function showResult(instant) {
    if (destroyed) return;
    phase = 'result';
    const ids = cargo.filter(c => loaded.has(c.id)).map(c => c.id);
    const has = new Set(ids);
    const w = totalWeight();
    const names = ids.map(id => byId.get(id).label);
    story = buildStory(has);
    call(ctx.log, `Packed the ship for Mars: ${names.join(', ')} (${w} of ${capacity} tonnes).`);
    call(ctx.complete);
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="pk-result">
      ${marsSVG(uid)}
      <div class="pk-res-inner">
        <div class="pk-res-head">
          <h2 class="display pk-res-title">Six months later on Mars...</h2>
          <button class="speak-btn pk-res-say" aria-label="Read aloud">${SPEAKER}</button>
        </div>
        <div class="pk-res-packed"><span class="pk-res-label">In the hold</span>${ids.map(id =>
          `<span class="pk-chip">${iconSVG(byId.get(id).icon)}${esc(byId.get(id).label)}</span>`).join('')}<span class="pk-res-w">${w} tonnes</span></div>
        <div class="pk-res-cards">${story.map((s, i) => `
          <article class="card pk-story ${s.tag}">
            <div class="pk-story-top"><span class="pk-story-ico">${iconSVG(s.icon)}</span>
              <span class="pk-tag">${TAGS[s.tag] || ''}</span></div>
            <p>${esc(s.text)}</p>
            <button class="speak-btn pk-story-say" data-i="${i}" aria-label="Read aloud">${SPEAKER}</button>
          </article>`).join('')}</div>
        <div class="pk-res-foot">
          <div class="pk-ask">${CHAT}<span><b>Talk about it</b>${esc(question)}</span></div>
          <button class="btn ghost big pk-again">${REDO}Pack again</button>
        </div>
      </div>
    </div>`;
    const res = wrap.firstElementChild;
    root.appendChild(res);
    refs.result = res;
    sizeResult();
    if (instant || reduced) { say(storySpeech()); return; }
    const title = res.querySelector('.pk-res-title');
    const rest = [res.querySelector('.pk-res-packed'), ...res.querySelectorAll('.pk-story'), res.querySelector('.pk-res-foot')];
    rest.forEach(n => { n.style.opacity = '0'; });
    if (!await anim(res, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease-out' })) return;
    say(storySpeech());
    anim(title, [{ opacity: 0, transform: 'translateY(18px)', letterSpacing: '0.06em' }, { opacity: 1, transform: 'none', letterSpacing: '-0.01em' }],
      { duration: 1300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    if (!await wait(1100)) return;
    rest.forEach((n, i) => {
      n.style.opacity = '';
      anim(n, [{ opacity: 0, transform: 'translateY(26px) scale(.97)' }, { opacity: 1, transform: 'none' }],
        { duration: 560, delay: i * 240, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
    });
  }

  function reset() {
    for (const a of [...anims]) { try { a.cancel(); } catch (e) { /* ignore */ } }
    anims.clear();
    call(ctx.stopSpeaking);
    loaded.clear();
    flyingIn.clear();
    capacity = cap0;
    twisted = false;
    warnedHeavy = false;
    phase = 'pack';
    story = [];
    root.classList.remove('launching');
    buildMain();
  }

  // ---------- events ----------
  function onClick(e) {
    if (destroyed) return;
    const t = e.target;
    if (!t || !t.closest) return;
    const card = t.closest('.pk-card');
    if (card) { toggle(card.dataset.id); return; }
    const slot = t.closest('.pk-slot');
    if (slot) { const id = idAtSlot(+slot.dataset.slot); if (id) toggle(id); return; }
    if (t.closest('.pk-launch')) { launch(); return; }
    if (t.closest('.pk-roger')) { closeTwist(); return; }
    if (t.closest('.pk-again')) { reset(); return; }
    if (t.closest('.pk-say')) { say(intro()); return; }
    if (t.closest('.pk-radio-say')) { say(twistSpeech()); return; }
    if (t.closest('.pk-res-say')) { say(storySpeech()); return; }
    const ss = t.closest('.pk-story-say');
    if (ss && story[+ss.dataset.i]) say(story[+ss.dataset.i].text);
  }
  function onVis() {
    paused = !!document.hidden;
    root.classList.toggle('is-paused', paused);
    for (const a of anims) {
      try {
        if (paused && a.playState === 'running') a.pause();
        else if (!paused && a.playState === 'paused') a.play();
      } catch (e) { /* ignore */ }
    }
  }
  root.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVis);
  let ro = null;
  let roRaf = 0;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => {
      cancelAnimationFrame(roRaf);
      roRaf = requestAnimationFrame(() => { if (!destroyed) layout(); });
    });
    ro.observe(el);
  }

  buildMain();
  onVis();

  // ---------- dev-only debug params ----------
  const dbg = (params.get('debugCargo') || '').split(',').map(s => s.trim()).filter(id => byId.has(id));
  dbg.forEach(id => { const s = firstFreeSlot(); if (s >= 0 && !loaded.has(id)) loaded.set(id, s); });
  if (params.has('debugCap')) { capacity = Math.round(posNum(Number(params.get('debugCap')), capacity)); twisted = true; }
  if (dbg.length || params.has('debugCap')) {
    if (twist && landedWeight() >= twist.at) twisted = true;
    renderAll();
  }
  if (params.get('debugTwist') === '1' && twist) { twisted = true; showTwist(); }
  if (params.get('debugLaunch') === '1') launch();
  if (params.get('debugResult') === '1' && loaded.size) showResult(true);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    try { if (ro) ro.disconnect(); } catch (e) { /* ignore */ }
    cancelAnimationFrame(roRaf);
    document.removeEventListener('visibilitychange', onVis);
    root.removeEventListener('click', onClick);
    for (const a of [...anims]) { try { a.cancel(); } catch (e) { /* ignore */ } }
    anims.clear();
    timers.forEach(clearTimeout);
    timers.clear();
    sfx.close();
    try { root.remove(); } catch (e) { /* ignore */ }
    releaseStyle();
  }

  return { destroy };
}
