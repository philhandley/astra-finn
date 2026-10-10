// Astra Finn - "Explore Starship": a procedural Three.js Starship (version 3) on its launch tower.
// Spin it, tap the numbered parts, slice it open with Cutaway, then LAUNCH: countdown, ascent, hot staging,
// boostback, the chopstick catch, space, belly-flop re-entry, flip and splashdown.
//
// export async function mount(el, ctx) -> { destroy() }
// ctx.data (all optional, defaults built in):
//   hotspots:    [{ id, title, text, wow, label? }]  ids: booster-engines, ship-engines, grid-fins, hot-stage, lox-tank,
//                methane-tank, ship-tanks, header-tanks, payload, flaps, tiles, tower  (override defaults by id)
//   launchBeats: [{ id, caption, title?, wow? }]     ids: ignition, liftoff, maxq, hotstage, boostback, catch, space,
//                reentry, flip  (override defaults by id)
// Dev-only URL params (ignored unless present): debugCutaway, debugHotspot=<id>, debugLaunchAt=<s after liftoff, -10..77>,
//   debugEnd, debugStats.  1 scene unit = 1 metre.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------- dimensions (metres)
const R = 4.5;                                   // 9 m diameter
const MOUNT_H = 18;                              // top of the orbital launch mount
const B_LEN = 72, S_LEN = 52;                    // booster, ship
const B_PAD_Y = MOUNT_H + B_LEN / 2;             // booster centre on the pad (54)
const SHIP_OFF = B_LEN / 2 + S_LEN / 2;          // ship centre above booster centre (62)
const S_PAD_Y = B_PAD_Y + SHIP_OFF;              // 116
const TOWER_X = -21, TOWER_H = 146, TOWER_W = 9;
const ARM_PIVOT_LX = TOWER_W / 2 + 1.6;          // arm pivot, tower-local x
const ARM_Z = 5.4, ARM_LEN = 23.5;
const ARM_REST_Y = 100, ARM_CATCH_Y = 86;        // carriage heights
const ARM_OPEN = 0.75;                           // radians
const CATCH_Y = 62;                              // booster centre once caught
const BELLY = -0.32 * Math.PI;                   // azimuth of the ship's tiled belly on the pad (0 = +z)
const EARTH_R = 5000;

// ---------------------------------------------------------------- launch timeline (seconds after liftoff)
const TL = {
  start: -10, ignition: -4, liftoff: 0, maxq: 8, hotstage: 16, sep: 19, boostback: 23,
  catchB: 30, close0: 39.6, close1: 40.5, contact: 41.0, space: 45, reentry: 53,
  flip: 61, flip0: 64, flip1: 65.6, splash: 72.6, end: 77,
};
const BEAT_IDS = ['ignition', 'liftoff', 'maxq', 'hotstage', 'boostback', 'catch', 'space', 'reentry', 'flip'];
const BEAT_T = [TL.ignition, TL.liftoff, TL.maxq, TL.hotstage, TL.boostback, TL.catchB, TL.space, TL.reentry, TL.flip];
const CUTS = [TL.catchB, TL.space, TL.flip];

// ---------------------------------------------------------------- default words (for a six-year-old)
const DEFAULT_HOTSPOTS = [
  { id: 'booster-engines', label: '33 engines', title: '33 Raptor engines', text: 'The booster has 33 Raptor engines. They all light up at the same time.', wow: '33 engines - more than any rocket ever!' },
  { id: 'grid-fins', label: 'Grid fins', title: 'Grid fins', text: 'Waffle-shaped fins steer the booster as it falls back home.', wow: 'They work like the feathers on a shuttlecock!' },
  { id: 'hot-stage', label: 'Hot-stage ring', title: 'Hot-stage ring', text: 'This ring is full of holes. When the ship lights its engines, the fire blasts out through them.', wow: 'The ship starts its engines while still sitting on the booster!' },
  { id: 'lox-tank', label: 'Oxygen tank', title: 'Liquid oxygen tank', text: 'This giant tank holds super-cold liquid oxygen. Fire needs oxygen to burn.', wow: 'Minus 183 °C - colder than anywhere on Earth!' },
  { id: 'methane-tank', label: 'Methane tank', title: 'Liquid methane tank', text: 'This tank holds the fuel, liquid methane. It mixes with the oxygen inside the engines.', wow: 'Full tanks weigh as much as 300 buses!' },
  { id: 'ship-engines', label: 'Ship engines', title: '6 ship engines', text: 'The ship has 6 engines. 3 small ones work in the air. 3 big ones work in space.', wow: 'Each big engine bell is wider than Dad is tall!' },
  { id: 'ship-tanks', label: 'Ship tanks', title: "The ship's tanks", text: 'The ship has its own oxygen and methane tanks. They push it all the way to space.', wow: 'As heavy as 130 buses when full!' },
  { id: 'payload', label: 'Cargo bay', title: 'Cargo bay', text: 'Satellites ride in here. A slot opens and lets them out one by one, like sweets from a dispenser.', wow: '26 satellites on one flight!' },
  { id: 'header-tanks', label: 'Header tanks', title: 'Header tanks', text: 'Little tanks in the nose keep fuel safe for landing.', wow: 'Like a spare drink saved for the trip home!' },
  { id: 'flaps', label: 'Flaps', title: 'Flaps', text: "Four flaps steer the ship as it falls, like a skydiver's arms and legs.", wow: 'Two small flaps at the front, two big ones at the back!' },
  { id: 'tiles', label: 'Heat tiles', title: 'Heat-shield tiles', text: 'Black tiles cover one side of the ship. They keep it safe from the fiery heat of coming home.', wow: 'About 18,000 tiles - more than the bricks in a house!' },
  { id: 'tower', label: 'Tower', title: 'The launch tower', text: 'The tower is even taller than the rocket. Its two arms, called chopsticks, catch the booster.', wow: '146 m tall - one and a half Big Bens!' },
];
const DEFAULT_BEATS = [
  { id: 'ignition', title: 'Ignition', caption: 'All 33 engines light up together. The ground shakes!', wow: '33 engines - more than any rocket ever!' },
  { id: 'liftoff', title: 'Liftoff', caption: 'Starship climbs past the tower and into the sky.', wow: 'Taller than Big Ben, and it can fly!' },
  { id: 'maxq', title: 'Max-Q', caption: 'The air pushes hardest here. Starship is strong enough to take it.', wow: 'Already faster than a jumbo jet!' },
  { id: 'hotstage', title: 'Hot staging', caption: 'The ship lights its engines while still attached. Then the two halves split apart!', wow: '64 km up - higher than 7 Mount Everests!' },
  { id: 'boostback', title: 'Boostback', caption: 'The booster flips round and fires its engines to fly back home.', wow: 'A somersault as tall as a skyscraper!' },
  { id: 'catch', title: 'The catch', caption: "The tower's giant arms, the chopsticks, catch the booster in mid-air.", wow: 'Like chopsticks catching a flying skyscraper!' },
  { id: 'space', title: 'Space', caption: "The ship reaches space. Look at Earth's curved edge and the black sky!", wow: '250 times faster than a car on the motorway!' },
  { id: 'reentry', title: 'Belly flop', caption: 'The ship falls back belly first, like a skydiver. The air around it glows with heat.', wow: '18,000 black tiles keep it safe!' },
  { id: 'flip', title: 'Flip and splashdown', caption: 'Just before the sea, the ship flips upright and fires its engines to slow down. Splash!', wow: 'Flipping something as long as five buses!' },
];

// hotspot -> where it lives on the model and how the camera looks at it
//   kind 'cam': point on the hull facing the camera; 'fin' / 'flap' / 'belly': a real part; 'tower': the chopstick arm
const HS_DEF = {
  'booster-engines': { kind: 'cam', y: MOUNT_H + 0.9, r: 3.2, side: 'right', focus: 'engines' },
  'methane-tank': { kind: 'cam', y: B_PAD_Y - 18, side: 'right', internal: true, dist: 60, elev: 0.08 },
  'lox-tank': { kind: 'cam', y: B_PAD_Y + 12, side: 'right', internal: true, dist: 72, elev: 0.04 },
  'grid-fins': { kind: 'fin', y: B_PAD_Y + 27.6, side: 'left', dist: 28, elev: 0.28 },
  'hot-stage': { kind: 'cam', y: B_PAD_Y + 34.5, side: 'right', dist: 26, elev: 0.1 },
  'ship-engines': { kind: 'cam', y: S_PAD_Y - 24.2, side: 'left', internal: true, dist: 24, elev: 0.04 },
  'ship-tanks': { kind: 'cam', y: S_PAD_Y - 10, side: 'right', internal: true, dist: 48, elev: 0.06 },
  'flaps': { kind: 'flap', y: S_PAD_Y - 17, side: 'left', dist: 36, elev: 0.1 },
  'tiles': { kind: 'belly', y: S_PAD_Y + 1, side: 'left', dist: 36, elev: 0.06 },
  'payload': { kind: 'cam', y: S_PAD_Y + 6.5, side: 'right', internal: true, dist: 30, elev: 0.08 },
  'header-tanks': { kind: 'cam', y: S_PAD_Y + 17, side: 'left', internal: true, dist: 30, elev: 0.16 },
  'tower': { kind: 'tower', side: 'left', dist: 78, elev: 0.1 },
};

// ---------------------------------------------------------------- icons
const ICON = {
  speak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c3 2.5 4.5 6 4.5 10.5V17h-9v-4.5C7.5 8 9 4.5 12 2z"/><path d="M7.5 13 5 16v3l2.5-1.5M16.5 13 19 16v3l-2.5-1.5"/><path d="M10 20.5c.5 1 1.2 1.5 2 1.5s1.5-.5 2-1.5"/></svg>',
  cut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="2.5" width="10" height="19" rx="5"/><path d="M12 2.5v19"/><path d="M12 8h5M12 13h5" opacity=".6"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
  skip: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 5v14l9-7zM13 5v14l9-7z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
};

// ---------------------------------------------------------------- scoped CSS
const CSS = `
.g-ship3d{position:absolute;inset:0;overflow:hidden;background:var(--bg);color:var(--ink);font-family:var(--font-body);user-select:none;-webkit-user-select:none}
.g-ship3d .s3-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
.g-ship3d .s3-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.g-ship3d .s3-lines line{stroke:rgba(242,181,68,.6);stroke-width:1.5}
.g-ship3d .s3-dot{position:absolute;left:0;top:0;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--gold-2);box-shadow:0 0 10px 4px rgba(242,181,68,.65);pointer-events:none}
.g-ship3d .s3-hs{position:absolute;left:0;top:0;min-height:48px;display:flex;align-items:center;gap:10px;padding:4px 18px 4px 4px;border-radius:999px;border:1px solid var(--line);background:var(--panel);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--ink);font:600 18px/1.1 var(--font-display);cursor:pointer;white-space:nowrap;transition:opacity .25s,border-color .2s,background .2s;appearance:none}
.g-ship3d .s3-hs .n{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;border:2px solid var(--gold);color:var(--gold);font-size:18px;flex:none;background:rgba(242,181,68,.12)}
.g-ship3d .s3-hs.left{flex-direction:row-reverse;padding:4px 4px 4px 18px}
.g-ship3d .s3-hs:hover{border-color:rgba(242,181,68,.6)}
.g-ship3d .s3-hs.on{border-color:var(--gold);background:rgba(242,181,68,.22)}
.g-ship3d .s3-hs.on .n{background:var(--gold);color:#1a1205}
.g-ship3d .s3-hs.seen .n{background:rgba(242,181,68,.35)}
.g-ship3d .s3-hs.far{opacity:.6}
.g-ship3d.compact .s3-hs .t{display:none}
.g-ship3d.compact .s3-hs,.g-ship3d.compact .s3-hs.left{padding:4px}
.g-ship3d .s3-hide{opacity:0!important;pointer-events:none!important;visibility:hidden}
.g-ship3d .s3-tl{position:absolute;left:18px;top:14px;pointer-events:none;text-shadow:0 2px 12px rgba(0,0,0,.7)}
.g-ship3d .s3-tl .eb{font:600 18px/1.2 var(--font-display);letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}
.g-ship3d .s3-tl .sub{font-size:18px;color:var(--ink-2);margin-top:2px}
.g-ship3d .s3-tr{position:absolute;right:14px;top:12px;display:flex;gap:10px;align-items:center}
.g-ship3d .s3-tr .btn{min-height:52px;padding:0 20px;font-size:19px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);background:var(--panel)}
.g-ship3d .s3-tr .btn.round{width:52px;padding:0}
.g-ship3d .s3-cut .sw{width:40px;height:24px;border-radius:999px;background:rgba(255,255,255,.14);position:relative;transition:background .2s;flex:none}
.g-ship3d .s3-cut .sw::after{content:'';position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:var(--ink-2);transition:transform .2s,background .2s}
.g-ship3d .s3-cut.on{border-color:var(--gold)}
.g-ship3d .s3-cut.on .sw{background:rgba(242,181,68,.45)}
.g-ship3d .s3-cut.on .sw::after{transform:translateX(16px);background:var(--gold)}
.g-ship3d .s3-legend{position:absolute;right:14px;top:74px;display:flex;flex-direction:column;gap:6px;padding:10px 14px;border-radius:14px;background:var(--panel);border:1px solid var(--line);font-size:18px;transition:opacity .3s;pointer-events:none}
.g-ship3d .s3-legend i{display:inline-block;width:14px;height:14px;border-radius:4px;margin-right:8px;vertical-align:-1px}
.g-ship3d .s3-bottom{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:12px;align-items:center}
.g-ship3d .s3-launch{letter-spacing:.12em}
.g-ship3d .s3-card{position:absolute;right:16px;top:78px;width:min(400px,42%);max-height:calc(100% - 180px);overflow:auto;background:var(--panel);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:12px;opacity:0;transform:translateX(30px);transition:opacity .3s,transform .3s;pointer-events:none}
.g-ship3d .s3-card.show{opacity:1;transform:none;pointer-events:auto}
.g-ship3d .s3-card .head{display:flex;align-items:center;gap:12px}
.g-ship3d .s3-card .num{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--gold);color:#1a1205;font:700 19px/1 var(--font-display);flex:none}
.g-ship3d .s3-card h3{font-family:var(--font-display);font-size:27px;line-height:1.15;margin:0;flex:1}
.g-ship3d .s3-card p{font-size:20px;line-height:1.45;margin:0;color:var(--ink)}
.g-ship3d .s3-wow{font-family:var(--font-display);font-weight:600;font-size:23px;line-height:1.2;color:var(--gold)}
.g-ship3d .s3-card .foot{display:flex;align-items:center;gap:12px;margin-top:4px}
.g-ship3d .s3-card .foot .grow{flex:1}
.g-ship3d .s3-x{appearance:none;border:1.5px solid var(--line);background:rgba(255,255,255,.05);color:var(--ink);width:48px;height:48px;border-radius:50%;display:grid;place-items:center;cursor:pointer;flex:none}
.g-ship3d .s3-x svg{width:22px;height:22px}
.g-ship3d .speak-btn{width:56px;height:56px}
.g-ship3d .s3-count{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.g-ship3d .s3-count span{font:700 clamp(120px,26vh,230px)/1 var(--font-display);color:var(--ink);text-shadow:0 0 50px rgba(242,181,68,.55),0 6px 30px rgba(0,0,0,.7);animation:s3pop .9s ease-out both}
.g-ship3d.paused .s3-count span{animation-play-state:paused}
.g-ship3d .s3-count span.word{font-size:clamp(64px,13vh,130px);color:var(--gold);letter-spacing:.04em}
@keyframes s3pop{0%{transform:scale(1.5);opacity:0}18%{transform:scale(1);opacity:1}80%{opacity:1}100%{transform:scale(.92);opacity:0}}
.g-ship3d .s3-cap{position:absolute;left:18px;bottom:18px;width:min(560px,calc(100% - 36px));background:var(--panel);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px 16px 20px;box-shadow:var(--shadow);display:flex;gap:14px;align-items:center;transition:opacity .35s,transform .35s}
.g-ship3d .s3-cap.off{opacity:0;transform:translateY(16px);pointer-events:none}
.g-ship3d .s3-cap .body{flex:1;display:flex;flex-direction:column;gap:6px}
.g-ship3d .s3-cap .eb{font:600 18px/1.1 var(--font-display);letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
.g-ship3d .s3-cap .txt{font-size:21px;line-height:1.38}
.g-ship3d .s3-cap .s3-wow{font-size:21px}
.g-ship3d .s3-lc{position:absolute;right:14px;top:12px;display:flex;gap:10px}
.g-ship3d .s3-lc .btn{min-height:56px;background:var(--panel);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.g-ship3d .s3-clock{position:absolute;left:18px;top:14px;pointer-events:none;text-shadow:0 2px 12px rgba(0,0,0,.8)}
.g-ship3d .s3-clock .t{font:600 30px/1 var(--font-display);font-variant-numeric:tabular-nums;letter-spacing:.04em}
.g-ship3d .s3-clock .ticks{display:flex;gap:6px;margin-top:10px}
.g-ship3d .s3-clock .ticks i{width:22px;height:5px;border-radius:3px;background:rgba(255,255,255,.2);transition:background .3s}
.g-ship3d .s3-clock .ticks i.done{background:rgba(242,181,68,.55)}
.g-ship3d .s3-clock .ticks i.now{background:var(--gold)}
.g-ship3d .s3-caught{position:absolute;left:50%;top:24%;transform:translate(-50%,-50%);font:700 clamp(56px,10vw,124px)/1 var(--font-display);letter-spacing:.08em;color:var(--gold);text-shadow:0 0 40px rgba(242,181,68,.75),0 6px 30px rgba(0,0,0,.6);pointer-events:none;opacity:0}
.g-ship3d .s3-caught.show{animation:s3caught 2.8s ease-out both}
@keyframes s3caught{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.12)}22%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.04)}}
.g-ship3d .s3-fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
.g-ship3d .s3-end{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:14px}
.g-ship3d .s3-end .eb{font:600 20px/1.2 var(--font-display);letter-spacing:.16em;text-transform:uppercase;color:var(--gold);text-shadow:0 2px 12px rgba(0,0,0,.8)}
.g-ship3d .s3-end .row{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.g-ship3d .s3-end .btn.ghost{background:var(--panel)}
.g-ship3d .s3-fallback{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;font-size:22px;color:var(--ink-2)}
.g-ship3d.narrow .s3-card{left:12px;right:12px;width:auto;top:auto;bottom:104px;max-height:46%;transform:translateY(30px)}
.g-ship3d.narrow .s3-card.show{transform:none}
.g-ship3d.narrow .s3-cap{left:12px;right:12px;width:auto;bottom:12px}
.g-ship3d.narrow .s3-tl .sub{display:none}
.g-ship3d.tiny .s3-tl{display:none}
.g-ship3d.tiny .s3-tr .btn .lbl{display:none}
.g-ship3d.tiny .s3-tr .btn{padding:0 12px}
@media (prefers-reduced-motion: reduce){.g-ship3d .s3-count span,.g-ship3d .s3-caught.show{animation-duration:.01ms}.g-ship3d .s3-caught.show{opacity:1}}
`;

// ---------------------------------------------------------------- small helpers
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const bump = (t, a, b, c, d) => sstep(a, b, t) * (1 - sstep(c, d, t));
const hermite = (p0, m0, p1, m1, s) => { const s2 = s * s, s3 = s2 * s; return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1; };
const azDir = (a, out) => out.set(Math.sin(a), 0, Math.cos(a));
const Y_AXIS = new THREE.Vector3(0, 1, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// uv.x * repU around the cylinder, uv.y from height in metres (so steel rings line up everywhere)
function cylUV(geo, repU, vMeters, yOff = 0) {
  const uv = geo.attributes.uv, p = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * repU, (p.getY(i) + yOff) / vMeters);
  uv.needsUpdate = true; return geo;
}
function mergeGeos(geos) {
  let n = 0;
  const parts = geos.map((g) => { const ng = g.index ? g.toNonIndexed() : g; if (ng !== g) g.dispose(); n += ng.attributes.position.count; return ng; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
function boxAt(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  _q.setFromEuler(_e.set(rx, ry, rz)); _m4.compose(_a.set(x, y, z), _q, _s.set(1, 1, 1)); g.applyMatrix4(_m4); return g;
}
function beam(ax, ay, az, bx, by, bz, t) {
  _a.set(bx - ax, by - ay, bz - az); const len = _a.length();
  const g = new THREE.BoxGeometry(t, len, t);
  _q.setFromUnitVectors(Y_AXIS, _a.normalize()); _m4.compose(_b.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), _q, _s.set(1, 1, 1));
  g.applyMatrix4(_m4); return g;
}
function bellGeo() { // Raptor nozzle: throat at y=0, exit radius 0.58 at y=-2.2
  const pts = [[0.3, 0.3], [0.25, 0], [0.33, -0.45], [0.44, -1.1], [0.53, -1.7], [0.58, -2.2]].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 14);
}

// ---------------------------------------------------------------- procedural textures
function steelCanvas() {
  const w = 256, h = 512, c = makeCanvas(w, h), g = c.getContext('2d');
  const rings = 16, rh = h / rings;
  for (let i = 0; i < rings; i++) {
    const b = 200 + Math.floor(hash(i * 3.1) * 40);
    g.fillStyle = `rgb(${b},${b + 2},${b + 6})`; g.fillRect(0, i * rh, w, rh);
    for (let k = 0; k < 3; k++) {
      const x = Math.floor((hash(i * 7.7 + k) * 0.3 + k / 3) * w);
      g.fillStyle = 'rgba(80,82,90,0.45)'; g.fillRect(x, i * rh, 1, rh);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x + 1, i * rh, 1, rh);
    }
  }
  for (let k = 0; k < 2600; k++) { // brushed streaks
    const y = Math.floor(hash(k * 1.37) * h), x = hash(k * 2.11) * w, len = 10 + hash(k * 3.3) * 90, a = 0.03 + hash(k * 4.1) * 0.07;
    g.fillStyle = hash(k * 5.9) > 0.5 ? `rgba(255,255,255,${a})` : `rgba(40,42,48,${a})`;
    g.fillRect(x, y, len, 1); if (x + len > w) g.fillRect(x - w, y, len, 1);
  }
  for (let i = 0; i < rings; i++) { // ring welds
    const y = Math.round(i * rh);
    g.fillStyle = 'rgba(60,62,70,0.75)'; g.fillRect(0, y, w, 1);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y + 1, w, 1);
  }
  return c;
}
function roughCanvas() {
  const w = 128, h = 256, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = 'rgb(205,205,205)'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 900; k++) {
    const y = Math.floor(hash(k * 1.91) * h), x = hash(k * 2.71) * w, len = 8 + hash(k * 3.7) * 60, v = 150 + Math.floor(hash(k * 6.1) * 105);
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, len, 1); if (x + len > w) g.fillRect(x - w, y, len, 1);
  }
  return c;
}
function tileCanvas() { // pointy-top hexagons, tiles seamlessly
  const r = 9, hw = Math.sqrt(3) * r, cols = 14, rows = 16;
  const w = Math.round(cols * hw), h = Math.round(rows * 1.5 * r);
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const sx = w / (cols * hw), sy = h / (rows * 1.5 * r);
  g.fillStyle = '#5a5c63'; g.fillRect(0, 0, w, h);
  for (let row = -1; row <= rows; row++) for (let col = -1; col <= cols; col++) {
    const cx = (col + (row & 1) * 0.5) * hw * sx, cy = row * 1.5 * r * sy;
    const v = 18 + Math.floor(hash(((row + rows) % rows) * 31.7 + ((col + cols) % cols) * 7.3) * 18);
    g.fillStyle = `rgb(${v},${v},${v + 3})`;
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3, px = cx + Math.cos(a) * (r - 1.2), py = cy + Math.sin(a) * (r - 1.2); if (k) g.lineTo(px, py); else g.moveTo(px, py); }
    g.closePath(); g.fill();
  }
  return c;
}
function puffCanvas() {
  const s = 128, c = makeCanvas(s, s), g = c.getContext('2d');
  for (let k = 0; k < 40; k++) {
    const a = hash(k * 2.3) * Math.PI * 2, d = Math.sqrt(hash(k * 4.7)) * 30, x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d, rr = 10 + hash(k * 9.1) * 18;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  m.addColorStop(0, 'rgba(255,255,255,1)'); m.addColorStop(0.55, 'rgba(255,255,255,0.8)'); m.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = m; g.fillRect(0, 0, s, s);
  return c;
}
function groundCanvas() {
  const s = 256, c = makeCanvas(s, s), g = c.getContext('2d');
  g.fillStyle = 'rgb(200,200,200)'; g.fillRect(0, 0, s, s);
  for (let k = 0; k < 220; k++) {
    const x = hash(k * 1.7) * s, y = hash(k * 3.1) * s, rr = 6 + hash(k * 5.3) * 34, v = 150 + Math.floor(hash(k * 7.9) * 105);
    for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
      gr.addColorStop(0, 'rgba(' + v + ',' + (v - 6) + ',' + (v - 12) + ',0.35)'); gr.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)');
      g.fillStyle = gr; g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2);
    }
  }
  return c;
}
function glowCanvas() {
  const s = 128, c = makeCanvas(s, s), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.6)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s); return c;
}
// value noise for the Earth texture (painted a few rows per frame so it never stalls)
function h3(a, b, c) { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const x00 = lerp(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), x10 = lerp(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u);
  const x01 = lerp(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), x11 = lerp(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}
function fbm3(x, y, z, oct) { let a = 0.5, s = 0, n = 0; for (let o = 0; o < oct; o++) { s += a * vnoise(x, y, z); n += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; } return s / n; }
function earthPainter(tex) {
  const c = tex.image, w = c.width, h = c.height, g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  let row = 0;
  return function step(rows) {
    if (row >= h) return true;
    const start = row, end = Math.min(h, row + rows);
    for (let y = start; y < end; y++) {
      const lat = (0.5 - (y + 0.5) / h) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (let x = 0; x < w; x++) {
        const lon = ((x + 0.5) / w) * Math.PI * 2, px = cl * Math.cos(lon), py = sl, pz = cl * Math.sin(lon);
        const land = fbm3(px * 2.1 + 5, py * 2.1, pz * 2.1, 4), cloud = fbm3(px * 4.5 + 9, py * 9 + 3, pz * 4.5, 3);
        let r, gg, b;
        if (land > 0.55) { const k = clamp((land - 0.55) * 5, 0, 1); r = lerp(58, 132, k); gg = lerp(86, 112, k); b = lerp(44, 72, k); }
        else { const k = clamp((0.55 - land) * 4, 0, 1); r = lerp(24, 8, k); gg = lerp(78, 36, k); b = lerp(128, 88, k); }
        const ice = sstep(0.86, 0.93, Math.abs(sl)); r = lerp(r, 236, ice); gg = lerp(gg, 242, ice); b = lerp(b, 248, ice);
        const cv = sstep(0.5, 0.7, cloud) * 0.92; r = lerp(r, 245, cv); gg = lerp(gg, 247, cv); b = lerp(b, 252, cv);
        const i = (y * w + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    row = end;
    g.putImageData(img, 0, 0, 0, start, w, end - start);
    tex.needsUpdate = true;
    return row >= h;
  };
}

// ---------------------------------------------------------------- shaders (raw display colours, no tone mapping)
const FLAME_VS = `
varying vec2 vUv; varying float vFacing;
void main(){
  vUv = uv;
  vec4 lp = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    lp = instanceMatrix * lp;
    n = mat3(instanceMatrix) * normal;
  #endif
  vec4 mv = modelViewMatrix * lp;
  vec3 nv = normalize(normalMatrix * n);
  vFacing = abs(dot(nv, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
const FLAME_FS = `
uniform float uTime, uInt, uDiamond, uSoft; uniform vec3 uCore, uMid, uEdge;
varying vec2 vUv; varying float vFacing;
void main(){
  float x = 1.0 - vUv.y;
  float flick = 0.8 + 0.2 * sin(uTime * 47.0 + vUv.x * 25.13 + x * 9.0) * sin(uTime * 31.0 - x * 14.0);
  vec3 col = mix(uCore, uMid, smoothstep(0.0, 0.22, x));
  col = mix(col, uEdge, smoothstep(0.3, 0.85, x));
  float dia = 1.0 + uDiamond * 0.6 * (1.0 - smoothstep(0.2, 0.55, x)) * pow(0.5 + 0.5 * cos(x * 70.0), 4.0);
  float a = (1.0 - smoothstep(0.25, 1.0, x)) * pow(vFacing, uSoft) * flick * uInt * dia;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}`;
const PLASMA_FS = `
uniform float uTime, uInt; uniform vec3 uCore, uMid, uEdge;
varying vec2 vUv; varying float vFacing;
void main(){
  float across = sin(3.14159 * vUv.x);
  float n = 0.72 + 0.28 * sin(uTime * 23.0 + vUv.y * 40.0) * sin(uTime * 13.0 + vUv.x * 17.0);
  vec3 col = mix(uEdge, mix(uMid, uCore, across * across), across);
  float a = pow(across, 1.4) * pow(vFacing, 0.5) * n * uInt * smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}`;
const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FS = `
uniform vec3 uSun; uniform float uSpace; uniform vec3 uFog; uniform float uLimb, uLimbI;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec2 hz = normalize(d.xz + vec2(1e-5)); vec2 sz = normalize(uSun.xz);
  float sa = max(dot(hz, sz), 0.0);
  vec3 zen = vec3(0.03, 0.045, 0.12), mid = vec3(0.15, 0.18, 0.37);
  vec3 horWarm = vec3(0.98, 0.55, 0.32), horCool = vec3(0.40, 0.35, 0.50);
  vec3 hor = mix(horCool, horWarm, pow(sa, 3.0));
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.24, h));
  col = mix(col, zen, smoothstep(0.2, 0.85, h));
  col += vec3(1.0, 0.62, 0.32) * pow(max(dot(d, normalize(uSun)), 0.0), 60.0) * 0.9;
  col = mix(uFog, col, smoothstep(-0.01, 0.05, h));
  if (h < -0.01) col = uFog;
  col = mix(col, vec3(0.0), uSpace);
  float lb = h - uLimb;
  col += vec3(0.3, 0.55, 1.0) * uLimbI * (exp(-max(lb, 0.0) / 0.012) * 0.9 + exp(-max(lb, 0.0) / 0.05) * 0.25) * step(-0.003, lb);
  gl_FragColor = vec4(col, 1.0);
}`;
const PUFF_VS = `
attribute vec3 iPos; attribute float iSize; attribute float iAlpha; attribute vec3 iColor; attribute float iRot;
varying vec2 vUv; varying float vA; varying vec3 vC;
void main(){
  vUv = uv; vC = iColor;
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  mv.z += iSize * 0.5;
  vA = iAlpha * clamp((-mv.z - 2.0) / (iSize * 1.3 + 0.01), 0.0, 1.0);
  float c = cos(iRot), s = sin(iRot);
  mv.xy += vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iSize;
  gl_Position = projectionMatrix * mv;
}`;
const PUFF_FS = `
uniform sampler2D uMap; varying vec2 vUv; varying float vA; varying vec3 vC;
void main(){ vec4 t = texture2D(uMap, vUv); float a = t.a * vA; if (a < 0.004) discard; gl_FragColor = vec4(vC, a); }`;
const EARTH_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const EARTH_FS = `
uniform sampler2D uMap; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main(){
  vec3 n = normalize(vN); vec3 col = texture2D(uMap, vUv).rgb;
  float day = smoothstep(-0.12, 0.3, dot(n, normalize(uSun)));
  float haze = 1.0 - exp(-length(cameraPosition - vP) / 1500.0);
  col = col * (0.05 + 0.95 * day);
  col = mix(col, vec3(0.42, 0.62, 0.95) * (0.15 + 0.85 * day), haze * 0.7);
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------- materials
function makeMaterials(tex, cutPlane, aniso) {
  const clip = [cutPlane];
  const steel = new THREE.MeshStandardMaterial({ color: 0xd2d7de, map: tex.steel, roughnessMap: tex.rough, metalness: 0.92, roughness: 0.36, side: THREE.FrontSide, clippingPlanes: clip });
  const steel2 = steel.clone(); steel2.side = THREE.DoubleSide; steel2.clippingPlanes = clip;
  const liner = new THREE.MeshStandardMaterial({ color: 0x8d939c, metalness: 0.8, roughness: 0.5, side: THREE.BackSide, clippingPlanes: clip });
  const tile = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.tile, metalness: 0.15, roughness: 0.72, side: THREE.FrontSide, clippingPlanes: clip });
  const fin = new THREE.MeshStandardMaterial({ color: 0x9aa0a9, metalness: 0.85, roughness: 0.45, side: THREE.DoubleSide, clippingPlanes: clip });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d22, metalness: 0.5, roughness: 0.62, side: THREE.DoubleSide, clippingPlanes: clip });
  const hsInner = new THREE.MeshStandardMaterial({ color: 0x24252b, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide, clippingPlanes: clip, emissive: 0xff6a1a, emissiveIntensity: 0 });
  const bellB = new THREE.MeshStandardMaterial({ color: 0x55504c, metalness: 0.85, roughness: 0.42, side: THREE.DoubleSide, emissive: 0xff5a12, emissiveIntensity: 0 });
  const bellS = bellB.clone();
  const engine = new THREE.MeshStandardMaterial({ color: 0x3a3b40, metalness: 0.7, roughness: 0.5 });
  const pipe = new THREE.MeshStandardMaterial({ color: 0xe6eaf0, metalness: 0.9, roughness: 0.25 });
  const liq = (hex) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.55, transparent: true, opacity: 0.74, roughness: 0.35, metalness: 0, depthWrite: false, envMapIntensity: 0.3 });
  const oxy = liq(0x7cc4ff), meth = liq(0x9be8b0);
  const satBody = new THREE.MeshStandardMaterial({ color: 0x9aa3b0, metalness: 0.8, roughness: 0.35 });
  const satPanel = new THREE.MeshStandardMaterial({ color: 0x1b2f5a, metalness: 0.5, roughness: 0.3, emissive: 0x0a1a3a, emissiveIntensity: 0.4 });
  const tower = new THREE.MeshStandardMaterial({ color: 0x4f545d, metalness: 0.55, roughness: 0.62 });
  const arm = new THREE.MeshStandardMaterial({ color: 0x6b717b, metalness: 0.6, roughness: 0.5 });
  const rail = new THREE.MeshStandardMaterial({ color: 0xd9c38a, metalness: 0.6, roughness: 0.4 });
  const mountM = new THREE.MeshStandardMaterial({ color: 0x5c6068, metalness: 0.45, roughness: 0.7 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x77777a, metalness: 0, roughness: 0.95 });
  const ground = new THREE.MeshStandardMaterial({ color: 0x4a4038, metalness: 0, roughness: 1 });
  const sea = new THREE.MeshStandardMaterial({ color: 0x0a1828, metalness: 0, roughness: 0.3, envMapIntensity: 0.45 });
  const farm = new THREE.MeshStandardMaterial({ color: 0xb4bac3, metalness: 0.75, roughness: 0.42 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff0d0 });
  const red = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  [tex.steel, tex.tile].forEach((t) => { t.anisotropy = aniso; });
  return { steel, steel2, liner, tile, fin, dark, hsInner, bellB, bellS, engine, pipe, oxy, meth, satBody, satPanel, tower, arm, rail, mountM, concrete, ground, sea, farm, lamp, red };
}
function flameMat(core, mid, edge, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uInt: { value: 1 }, uDiamond: { value: opts.diamond ?? 1 }, uSoft: { value: opts.soft ?? 1.3 },
      uCore: { value: new THREE.Color(core).convertLinearToSRGB() }, uMid: { value: new THREE.Color(mid).convertLinearToSRGB() }, uEdge: { value: new THREE.Color(edge).convertLinearToSRGB() } },
    vertexShader: FLAME_VS, fragmentShader: opts.fs || FLAME_FS, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
}
function glowSprite(tex, color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false }));
  s.scale.set(size, size, 1); s.renderOrder = 4; return s;
}
function liquid(r, y0, y1, mat) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 32, 1, true), mat); c.position.y = (y0 + y1) / 2; g.add(c);
  const dome = new THREE.SphereGeometry(r, 32, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const top = new THREE.Mesh(dome, mat); top.scale.y = 0.42; top.position.y = y1; g.add(top);
  const bot = new THREE.Mesh(dome, mat); bot.rotation.x = Math.PI; bot.scale.y = 0.42; bot.position.y = y0; g.add(bot);
  g.children.forEach((m) => { m.renderOrder = 1; });
  return g;
}
function engineLayout33() {
  const a = [];
  for (let i = 0; i < 3; i++) { const t = (i / 3) * Math.PI * 2 + Math.PI / 2; a.push([Math.sin(t) * 0.95, Math.cos(t) * 0.95, 0]); }
  for (let i = 0; i < 10; i++) { const t = (i / 10) * Math.PI * 2; a.push([Math.sin(t) * 2.45, Math.cos(t) * 2.45, 1]); }
  for (let i = 0; i < 20; i++) { const t = ((i + 0.5) / 20) * Math.PI * 2; a.push([Math.sin(t) * 3.82, Math.cos(t) * 3.82, 2]); }
  return a;
}
const FLAME_GEO = () => new THREE.CylinderGeometry(0.5, 0.14, 1, 10, 5, true).translate(0, -0.5, 0);

// ---------------------------------------------------------------- Super Heavy booster (local y -36..+36, origin at centre)
function buildBooster(M, T) {
  const g = new THREE.Group(); g.name = 'booster';
  const skinH = 67;
  const skin = new THREE.Mesh(cylUV(new THREE.CylinderGeometry(R, R, skinH, 64, 1, true), 2, 29.3), M.steel);
  skin.position.y = -34 + skinH / 2; g.add(skin);
  const bl = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.06, R - 0.06, skinH, 48, 1, true), M.liner); bl.position.y = skin.position.y; g.add(bl);
  const shield = new THREE.Mesh(new THREE.CircleGeometry(R - 0.05, 48), M.dark); shield.rotation.x = Math.PI / 2; shield.position.y = -32.4; g.add(shield);
  // vented hot-stage ring on top (+33 .. +36)
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.5, R - 0.5, 2.9, 40, 1, true), M.hsInner); inner.position.y = 34.5; g.add(inner);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(R - 0.5, 40), M.hsInner); cap.rotation.x = -Math.PI / 2; cap.position.y = 33.2; g.add(cap);
  const ring = [];
  for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2; ring.push(boxAt(0.5, 2.4, 0.4, Math.sin(a) * (R - 0.2), 34.5, Math.cos(a) * (R - 0.2), 0, a, 0)); }
  ring.push(cylUV(new THREE.CylinderGeometry(R, R, 0.34, 64, 1, true).translate(0, 33.17, 0), 2, 29.3));
  ring.push(cylUV(new THREE.CylinderGeometry(R, R, 0.34, 64, 1, true).translate(0, 35.83, 0), 2, 29.3));
  g.add(new THREE.Mesh(mergeGeos(ring), M.steel2));
  // grid fins (4), catch pins (2), conduit
  const fins = [], finAz = [0.62, Math.PI - 0.62, Math.PI + 0.62, -0.62];
  for (const az of finAz) {
    const L = 4.6, W = 3.8, H = 1.0, list = [];
    list.push(boxAt(0.18, H, L, -W / 2, 0, L / 2), boxAt(0.18, H, L, W / 2, 0, L / 2), boxAt(W, H, 0.2, 0, 0, 0.1), boxAt(W, H, 0.2, 0, 0, L - 0.1));
    for (let i = 1; i < 6; i++) list.push(boxAt(0.07, H * 0.94, L, -W / 2 + (W * i) / 6, 0, L / 2));
    for (let i = 1; i < 7; i++) list.push(boxAt(W, H * 0.94, 0.07, 0, 0, (L * i) / 7));
    list.push(boxAt(1.3, 1.6, 0.9, 0, 0, -0.25));
    const fg = mergeGeos(list);
    fg.applyMatrix4(_m4.makeRotationX(-0.2));
    _q.setFromAxisAngle(Y_AXIS, az); _m4.compose(_a.set(Math.sin(az) * (R + 0.25), 27.6, Math.cos(az) * (R + 0.25)), _q, _s.set(1, 1, 1));
    fg.applyMatrix4(_m4); fins.push(fg);
  }
  for (const sgn of [1, -1]) fins.push(boxAt(1.5, 0.8, 1.2, 0, 25.6, sgn * (R + 0.5)));
  fins.push(boxAt(0.6, 58, 0.4, Math.sin(1.9) * (R + 0.15), -3, Math.cos(1.9) * (R + 0.15), 0, 1.9, 0));
  fins.push(boxAt(0.4, 50, 0.3, Math.sin(-1.4) * (R + 0.12), -6, Math.cos(-1.4) * (R + 0.12), 0, -1.4, 0));
  g.add(new THREE.Mesh(mergeGeos(fins), M.fin));
  // 33 Raptors: bells, powerheads, flames
  const layout = engineLayout33();
  const bells = new THREE.InstancedMesh(bellGeo(), M.bellB, 33);
  const heads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.36, 0.3, 1.4, 8), M.engine, 33);
  layout.forEach(([x, z], i) => {
    bells.setMatrixAt(i, _m4.makeTranslation(x, -32.8, z));
    heads.setMatrixAt(i, _m4.makeTranslation(x, -31.6, z));
  });
  g.add(bells, heads);
  const fMat = flameMat(0xfff4e0, 0xffa040, 0xff4a14, { diamond: 1, soft: 1.2 });
  const flames = new THREE.InstancedMesh(FLAME_GEO(), fMat, 33);
  flames.frustumCulled = false; flames.renderOrder = 3; g.add(flames);
  const pMat = flameMat(0xffe6c0, 0xff8a30, 0xc8401a, { diamond: 0, soft: 1.6 });
  const plume = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 7.5, 1, 20, 6, true).translate(0, -0.5, 0), pMat);
  plume.position.y = -35.2; plume.frustumCulled = false; plume.renderOrder = 3; g.add(plume);
  const glow = glowSprite(T.glow, 0xffa850, 34); glow.position.y = -38; g.add(glow);
  // hot-stage vent flames
  const vMat = flameMat(0xfff0d0, 0xff9a40, 0xff4a20, { diamond: 0, soft: 1.0 });
  const vents = new THREE.InstancedMesh(FLAME_GEO(), vMat, 15);
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2; azDir(a, _a);
    _q.setFromUnitVectors(_b.set(0, -1, 0), _a); _m4.compose(_c.set(_a.x * R, 34.5, _a.z * R), _q, _s.set(1.4, 7, 1.4)); vents.setMatrixAt(i, _m4);
  }
  vents.visible = false; vents.renderOrder = 3; vents.frustumCulled = false; g.add(vents);
  // Max-Q vapour collar
  const vapour = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.4, R + 7, 16, 32, 4, true).translate(0, -8, 0),
    flameMat(0xffffff, 0xe8eef8, 0xb8c4d8, { diamond: 0, soft: 2.2 }));
  vapour.position.y = 33; vapour.visible = false; vapour.renderOrder = 3; g.add(vapour);
  // inside (cutaway): oxygen on top, methane below, downcomer
  const inside = new THREE.Group(); inside.visible = false;
  inside.add(liquid(4.1, -5.2, 30.2, M.oxy), liquid(4.1, -29.4, -8.8, M.meth));
  const dc = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 26, 10), M.pipe); dc.position.y = -19; inside.add(dc);
  const lines = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; lines.push(beam(Math.sin(a) * 1.2, -30.8, Math.cos(a) * 1.2, Math.sin(a) * 3.3, -31.2, Math.cos(a) * 3.3, 0.22)); }
  inside.add(new THREE.Mesh(mergeGeos(lines), M.pipe));
  const manifold = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.22, 6, 40), M.pipe); manifold.rotation.x = Math.PI / 2; manifold.position.y = -30.6; inside.add(manifold);
  g.add(inside);
  return { group: g, bells, flames, plume, glow, vents, vapour, inside, layout, fMat, pMat, vMat, finAz };
}

// ---------------------------------------------------------------- Starship upper stage (local y -26..+26; belly = local +z)
function noseRadius(s) { return R * Math.pow(Math.max(0, 1 - Math.pow(s, 2.1)), 0.62); }
function flapGeo(rootLen, tipLen, span, tipOff, depth, z0, uS, vS) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(span * 0.9, tipOff * 0.9); s.quadraticCurveTo(span, tipOff, span, tipOff + 0.6);
  s.lineTo(span, tipOff + tipLen - 0.6); s.quadraticCurveTo(span, tipOff + tipLen, span * 0.9, tipOff + tipLen + (rootLen - tipOff - tipLen) * 0.1);
  s.lineTo(0, rootLen); s.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, z0);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uS, uv.getY(i) * vS);
  return geo;
}
function buildShip(M, T) {
  const g = new THREE.Group(); g.name = 'ship';
  const bodyH = 32; // -26 .. +6
  const mk = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m); return m; };
  mk(cylUV(new THREE.CylinderGeometry(R, R, bodyH, 32, 1, true, Math.PI / 2, Math.PI), 1, 29.3, 0), M.steel, -10);
  mk(cylUV(new THREE.CylinderGeometry(R, R, bodyH, 32, 1, true, -Math.PI / 2, Math.PI), 2, 6.93, 0), M.tile, -10);
  const prof = [];
  for (let i = 0; i <= 22; i++) { const s = i / 22; prof.push(new THREE.Vector2(Math.max(noseRadius(s), 0.001), 6 + 20 * s)); }
  g.add(new THREE.Mesh(cylUV(new THREE.LatheGeometry(prof, 24, Math.PI / 2, Math.PI), 1, 29.3), M.steel));
  g.add(new THREE.Mesh(cylUV(new THREE.LatheGeometry(prof, 24, -Math.PI / 2, Math.PI), 2, 6.93), M.tile));
  mk(new THREE.CylinderGeometry(R - 0.06, R - 0.06, bodyH, 40, 1, true), M.liner, -10);
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map((v) => new THREE.Vector2(Math.max(v.x - 0.06, 0.001), v.y)), 40), M.liner));
  const shield = mk(new THREE.CircleGeometry(R - 0.05, 40), M.dark, -21.9); shield.rotation.x = Math.PI / 2;
  // payload door (Pez slot) on the leeward side
  mk(new THREE.CylinderGeometry(R + 0.04, R + 0.04, 1.2, 12, 1, true, Math.PI - 0.72, 1.44), M.dark, 6.0);
  // flaps: 2 big aft, 2 small forward, at the steel/tile boundary (local +-x)
  for (const sgn of [1, -1]) {
    const phi = sgn > 0 ? 0 : -Math.PI;                    // shape +x -> radial; extrude +z -> tangential
    const tz = sgn > 0 ? 1 : -1;                           // tile layer faces the belly (+z local)
    const add = (rootLen, tipLen, span, tipOff, rootR, y0, lean) => {
      const steel = new THREE.Mesh(flapGeo(rootLen, tipLen, span, tipOff, 0.26, tz > 0 ? -0.26 : 0, 1 / 14, 1 / 29.3), M.steel);
      const tile = new THREE.Mesh(flapGeo(rootLen, tipLen, span, tipOff, 0.14, tz > 0 ? 0 : -0.14, 1 / 7, 1 / 6.93), M.tile);
      const f = new THREE.Group(); f.add(steel, tile); f.rotation.set(0, phi, lean); f.position.set(sgn * rootR, y0, 0); g.add(f);
    };
    add(12, 8, 4.2, 1.6, R - 0.1, -24.5, 0);
    add(6.6, 3.6, 2.5, 1.3, 4.35, 9.2, 0.09);
  }
  // 6 engines: 3 sea-level (centre), 3 vacuum (big bells)
  const bells = new THREE.InstancedMesh(bellGeo(), M.bellS, 6);
  const heads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.36, 0.3, 1.3, 8), M.engine, 6);
  const fMat = flameMat(0xf4f6ff, 0xffb060, 0xff5a20, { diamond: 1, soft: 1.2 });
  const flames = new THREE.InstancedMesh(FLAME_GEO(), fMat, 6);
  const eng = [];
  for (let i = 0; i < 6; i++) {
    const vac = i >= 3, a = (vac ? (i - 3) / 3 : i / 3) * Math.PI * 2 + (vac ? Math.PI / 3 : 0), r = vac ? 3.05 : 1.05;
    const sc = vac ? [2.0, 1.35] : [1.05, 0.8], y = vac ? -22.7 : -23.9;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    bells.setMatrixAt(i, _m4.compose(_a.set(x, y, z), _q.identity(), _s.set(sc[0], sc[1], sc[0])));
    heads.setMatrixAt(i, _m4.makeTranslation(x, vac ? -21.6 : -22.4, z));
    eng.push({ x, z, vac, exitY: y - 2.2 * sc[1], w: vac ? 2.1 : 1.15 });
  }
  flames.frustumCulled = false; flames.renderOrder = 3;
  g.add(bells, heads, flames);
  const glow = glowSprite(T.glow, 0xffb060, 22); glow.position.y = -30; g.add(glow);
  // re-entry plasma on the belly + glowing wake
  const plasma = new THREE.Group(); plasma.visible = false;
  const shMat = flameMat(0xfff2d8, 0xff8a3a, 0xff3d6a, { fs: PLASMA_FS });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.9, R + 0.9, 50, 32, 1, true, -Math.PI / 2, Math.PI), shMat); shell.position.y = -1; plasma.add(shell);
  const wMat = flameMat(0xffb070, 0xff6a40, 0xb02a6a, { diamond: 0, soft: 1.4 });
  const wake = new THREE.Mesh(new THREE.CylinderGeometry(R + 2, R + 9, 1, 24, 4, true).translate(0, -0.5, 0), wMat);
  wake.rotation.x = Math.PI / 2; wake.scale.set(1.4, 30, 4.2); wake.position.z = 2; plasma.add(wake);
  const pglow = glowSprite(T.glow, 0xff7a3a, 60); pglow.position.z = 7; plasma.add(pglow);
  plasma.children.forEach((m) => { m.renderOrder = 3; m.frustumCulled = false; });
  g.add(plasma);
  // inside (cutaway)
  const inside = new THREE.Group(); inside.visible = false;
  inside.add(liquid(4.1, -9.0, -1.4, M.oxy), liquid(4.1, -19.6, -12.4, M.meth));
  const dc = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 13, 10), M.pipe); dc.position.y = -16.5; inside.add(dc);
  const hO = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 12), M.oxy); hO.position.y = 14.6; inside.add(hO);
  const hM = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 12), M.meth); hM.position.y = 18.7; inside.add(hM);
  const tubes = [beam(-1.0, 13.4, -1.6, -1.6, -1.2, -3.3, 0.18), beam(0.6, 17.6, -0.8, 1.6, -1.2, -3.4, 0.18), beam(-3.4, 1.4, 0, -3.4, 11.8, 0, 0.3), beam(3.4, 1.4, 0, 3.4, 11.8, 0, 0.3), boxAt(7.2, 0.3, 3.6, 0, 1.6, 0)];
  inside.add(new THREE.Mesh(mergeGeos(tubes), M.pipe));
  g.add(inside);
  // satellites: 9 flat plates stacked in the bay (always present so they can be deployed in space)
  const satGeo = new THREE.BoxGeometry(6.0, 0.3, 2.8);
  const sats = new THREE.InstancedMesh(satGeo, [M.satBody, M.satBody, M.satPanel, M.satBody, M.satBody, M.satBody], 9);
  sats.frustumCulled = false; g.add(sats);
  return { group: g, bells, flames, glow, eng, plasma, shMat, wMat, pglow, inside, sats, fMat };
}

// ---------------------------------------------------------------- launch tower ("Mechazilla") with chopsticks and QD arm
function buildTower(M) {
  const g = new THREE.Group(); g.position.set(TOWER_X, 0, 0);
  const hw = TOWER_W / 2, lv = 16, step = TOWER_H / lv, list = [];
  const C = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
  for (const [x, z] of C) list.push(boxAt(1.1, TOWER_H, 1.1, x, TOWER_H / 2, z));
  for (let i = 0; i <= lv; i++) {
    const y = Math.min(i * step, TOWER_H - 0.5) + 0.3;
    for (let f = 0; f < 4; f++) {
      const [ax, az] = C[f], [bx, bz] = C[(f + 1) % 4];
      list.push(beam(ax, y, az, bx, y, bz, 0.55));
      if (i < lv) { const y2 = (i + 1) * step; list.push(beam(ax, y, az, bx, y2, bz, 0.3), beam(bx, y, bz, ax, y2, az, 0.3)); }
    }
  }
  list.push(boxAt(TOWER_W + 2.4, 1.4, TOWER_W + 2.4, 0, TOWER_H + 0.7, 0));
  list.push(boxAt(0.4, 16, 0.4, 0, TOWER_H + 9, 0));
  list.push(boxAt(TOWER_W + 6, 3, TOWER_W + 6, 0, 1.5, 0));
  g.add(new THREE.Mesh(mergeGeos(list), M.tower));
  // carriage + chopstick arms
  const carriage = new THREE.Group(); carriage.position.y = ARM_REST_Y; g.add(carriage);
  const cl = [boxAt(TOWER_W + 2.6, 3.4, 1.0, 0, 0, hw + 0.9), boxAt(TOWER_W + 2.6, 3.4, 1.0, 0, 0, -hw - 0.9),
    boxAt(1.0, 3.4, TOWER_W + 2.6, hw + 0.9, 0, 0), boxAt(1.0, 3.4, TOWER_W + 2.6, -hw - 0.9, 0, 0), boxAt(1.8, 4.2, 2 * ARM_Z + 3.2, hw + 1.6, 0, 0)];
  carriage.add(new THREE.Mesh(mergeGeos(cl), M.arm));
  const armParts = [boxAt(ARM_LEN, 2.4, 1.3, ARM_LEN / 2, 0, 0), boxAt(ARM_LEN - 4, 0.32, 0.32, (ARM_LEN - 4) / 2 + 1.5, -3, 0)];
  const nseg = 6;
  for (let k = 0; k <= nseg; k++) {
    const x = 1.5 + (k * (ARM_LEN - 4)) / nseg;
    armParts.push(beam(x, -1.2, 0, x, -3, 0, 0.26));
    if (k < nseg) armParts.push(beam(x, -3, 0, x + (ARM_LEN - 4) / nseg, -1.2, 0, 0.22));
  }
  armParts.push(boxAt(2.6, 3.2, 2.2, 0.6, -0.3, 0));
  const armGeo = mergeGeos(armParts);
  const railGeo = boxAt(ARM_LEN * 0.42, 0.24, 0.6, ARM_LEN * 0.66, 1.32, -0.32);
  const arms = [];
  for (const sgn of [1, -1]) {
    const a = new THREE.Group(); a.position.set(hw + 1.6, 0, sgn * ARM_Z);
    const m = new THREE.Mesh(armGeo, M.arm), r = new THREE.Mesh(railGeo, M.rail);
    if (sgn < 0) r.scale.z = -1;
    a.add(m, r); carriage.add(a); arms.push(a);
  }
  // ship quick-disconnect arm
  const qd = new THREE.Group(); qd.position.set(hw + 0.5, 97, 2.2);
  qd.add(new THREE.Mesh(mergeGeos([boxAt(11.0, 2.0, 2.2, 5.5, 0, 0), boxAt(2.2, 4.0, 3.6, 10.6, 0, 0), beam(0.5, -6, 0, 8, -1, 0, 0.6)]), M.arm));
  g.add(qd);
  // lights: aviation reds and floodlights
  const reds = new THREE.Mesh(mergeGeos(C.map(([x, z]) => boxAt(0.7, 0.7, 0.7, x * 1.1, TOWER_H + 1.8, z * 1.1)).concat([boxAt(0.6, 0.6, 0.6, 0, TOWER_H + 17, 0)])), M.red);
  g.add(reds);
  const lamps = [];
  for (const y of [24, 52, 78, 112, 134]) for (const z of [-hw, hw]) lamps.push(boxAt(0.6, 0.9, 1.4, hw + 0.5, y, z * 0.8));
  g.add(new THREE.Mesh(mergeGeos(lamps), M.lamp));
  return { group: g, carriage, arms, qd, reds };
}

// ---------------------------------------------------------------- orbital launch mount, pad, Starbase bits
function buildPad(M) {
  const g = new THREE.Group();
  const list = [];
  list.push(new THREE.CylinderGeometry(7.6, 7.6, 4, 48, 1, true).translate(0, 16, 0));
  list.push(new THREE.CylinderGeometry(5.0, 5.0, 4, 48, 1, true).translate(0, 16, 0));
  list.push(new THREE.RingGeometry(5.0, 7.6, 48, 1).rotateX(-Math.PI / 2).translate(0, 18, 0));
  list.push(new THREE.RingGeometry(5.0, 7.6, 48, 1).rotateX(Math.PI / 2).translate(0, 14, 0));
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6, sx = Math.sin(a), cz = Math.cos(a);
    list.push(boxAt(2.6, 14.2, 2.6, sx * 10.5, 7.1, cz * 10.5, 0, a, 0));
    list.push(beam(sx * 10.5, 13.4, cz * 10.5, sx * 7.4, 15.5, cz * 7.4, 1.4));
    list.push(beam(sx * 10.5, 2, cz * 10.5, sx * 6.2, 13.8, cz * 6.2, 0.7));
  }
  for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; list.push(boxAt(0.7, 1.3, 1.0, Math.sin(a) * 5.45, 18.65, Math.cos(a) * 5.45, 0, a, 0)); }
  g.add(new THREE.Mesh(mergeGeos(list), M.mountM));
  const defl = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 10.5, 0.7, 40), M.dark); defl.position.y = 0.6; g.add(defl);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(60, 62, 0.5, 64), M.concrete); pad.position.y = 0.2; g.add(pad);
  // tank farm and buildings on the horizon
  const farm = [];
  [[190, -170, 4.5, 24], [204, -166, 4.5, 28], [218, -174, 4, 22], [196, -190, 3.6, 18], [232, -190, 5, 30]].forEach(([x, z, r, h]) => {
    farm.push(new THREE.CylinderGeometry(r, r, h, 20).translate(x, h / 2, z), new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1).translate(x, h, z));
  });
  for (let k = 0; k < 4; k++) farm.push(new THREE.CylinderGeometry(2.6, 2.6, 24, 14).rotateZ(Math.PI / 2).translate(80 + k * 2, 3.2, -60 - k * 6.2));
  g.add(new THREE.Mesh(mergeGeos(farm), M.farm));
  // light poles around the pad
  const poles = [], heads = [];
  [[40, 40], [-40, 46], [46, -38], [-44, -42]].forEach(([x, z]) => { poles.push(boxAt(0.5, 22, 0.5, x, 11, z)); heads.push(boxAt(2.2, 1.2, 1.2, x, 22.4, z, 0, Math.atan2(-x, -z), 0)); });
  g.add(new THREE.Mesh(mergeGeos(poles), M.tower), new THREE.Mesh(mergeGeos(heads), M.lamp));
  return g;
}

// ---------------------------------------------------------------- billboard particles (deterministic: state is a pure function of time)
class Puffs {
  constructor(n, map, additive) {
    const plane = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index; geo.setAttribute('position', plane.attributes.position); geo.setAttribute('uv', plane.attributes.uv);
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.col = new Float32Array(n * 3); this.rot = new Float32Array(n);
    this.attr = {
      iPos: new THREE.InstancedBufferAttribute(this.pos, 3), iSize: new THREE.InstancedBufferAttribute(this.size, 1),
      iAlpha: new THREE.InstancedBufferAttribute(this.alpha, 1), iColor: new THREE.InstancedBufferAttribute(this.col, 3), iRot: new THREE.InstancedBufferAttribute(this.rot, 1),
    };
    for (const k in this.attr) { this.attr[k].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, this.attr[k]); }
    geo.instanceCount = n;
    this.mat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: map } }, vertexShader: PUFF_VS, fragmentShader: PUFF_FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 5 : 2;
    this.n = n; this.used = 0; this.emitters = []; this._plane = plane; this._o = new THREE.Vector3();
  }
  add(e) { e.start = this.used; this.used += e.count; this.emitters.push(e); return e; }
  clear() { this.alpha.fill(0); this.size.fill(0); this.attr.iAlpha.needsUpdate = true; this.attr.iSize.needsUpdate = true; }
  update(t) {
    const P = this.pos, S = this.size, A = this.alpha, C = this.col, Ro = this.rot, o = this._o;
    for (const e of this.emitters) {
      const active = t > e.t0 - 0.01 && t < e.t1 + e.life;
      for (let i = 0; i < e.count; i++) {
        const j = e.start + i;
        if (!active) { A[j] = 0; S[j] = 0; continue; }
        const r1 = hash(j * 1.13 + 0.1), r2 = hash(j * 2.71 + 0.3), r3 = hash(j * 3.97 + 0.7), r4 = hash(j * 5.33 + 0.9);
        const b = e.t0 + (e.t1 - e.t0) * ((i + r1 * 0.9) / e.count);
        const age = t - b;
        if (age < 0 || age > e.life) { A[j] = 0; S[j] = 0; continue; }
        e.origin(b, r1, r2, r3, o);
        const vx = e.vel(0, r1, r2, r3, r4), vy = e.vel(1, r1, r2, r3, r4), vz = e.vel(2, r1, r2, r3, r4);
        const k = e.drag, f = k > 0 ? (1 - Math.exp(-k * age)) / k : age;
        P[j * 3] = o.x + vx * f; P[j * 3 + 1] = o.y + vy * f + 0.5 * e.lift * age * age; P[j * 3 + 2] = o.z + vz * f;
        const u = age / e.life;
        S[j] = lerp(e.size0, e.size1, 1 - Math.pow(1 - u, 2.2)) * (0.75 + 0.5 * r4);
        A[j] = e.alpha * sstep(0, e.fadeIn, age) * (1 - sstep(e.fadeOut, 1, u));
        e.color(age, u, r4, C, j * 3);
        Ro[j] = r2 * 6.283 + age * (r3 - 0.5) * 0.6;
      }
    }
    for (const k in this.attr) this.attr[k].needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); this._plane.dispose(); this.mat.dispose(); }
}

// ---------------------------------------------------------------- tiny WebAudio synth (only when ctx.sound)
function makeAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ac = new AC(), master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
  const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
  const rumble = ac.createGain(); rumble.gain.value = 0;
  src.connect(lp).connect(rumble).connect(master); src.start();
  const tone = (f, dur, vol, type = 'sine', f2) => {
    const o = ac.createOscillator(), e = ac.createGain(), t0 = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(e).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  };
  return {
    level(v) { rumble.gain.setTargetAtTime(clamp(v, 0, 1) * 0.6, ac.currentTime, 0.1); },
    beep() { tone(740, 0.22, 0.08); },
    clunk() { tone(140, 0.5, 0.35, 'triangle', 45); tone(70, 0.7, 0.3, 'sine', 40); },
    splash() { tone(400, 0.6, 0.06, 'sawtooth', 80); },
    pause(p) { try { if (p) ac.suspend(); else ac.resume(); } catch (e) { /* ignore */ } },
    close() { try { src.stop(); ac.close(); } catch (e) { /* ignore */ } },
  };
}

// ================================================================= mount
export async function mount(el, ctx) {
  ctx = ctx || {};
  const data = (ctx.data && typeof ctx.data === 'object') ? ctx.data : {};
  const safe = (fn) => (...a) => { try { return fn && fn(...a); } catch (e) { /* host callback failed; keep going */ } };
  const speak = safe(ctx.speak), log = safe(ctx.log), complete = safe(ctx.complete), stopSpeaking = safe(ctx.stopSpeaking);
  let qs; try { qs = new URLSearchParams(location.search); } catch (e) { qs = new URLSearchParams(); }
  const dbg = { cut: qs.has('debugCutaway'), hs: qs.get('debugHotspot'), at: qs.has('debugLaunchAt') ? parseFloat(qs.get('debugLaunchAt')) : null, end: qs.has('debugEnd'), stats: qs.has('debugStats') };
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  // ---------- content (defaults overridden by id)
  const byId = (arr) => { const m = {}; (Array.isArray(arr) ? arr : []).forEach((x) => { if (x && x.id) m[x.id] = x; }); return m; };
  const hsOver = byId(data.hotspots), beatOver = byId(data.launchBeats);
  const HOTS = DEFAULT_HOTSPOTS.map((d, i) => { const o = hsOver[d.id] || {}; return { ...d, ...o, label: o.label || d.label || o.title, n: i + 1, def: HS_DEF[d.id] }; });
  const BEATS = DEFAULT_BEATS.map((d) => ({ ...d, ...(beatOver[d.id] || {}) }));

  // ---------- DOM + CSS
  if (!document.querySelector('style[data-module="starship3d"]')) {
    const st = document.createElement('style'); st.setAttribute('data-module', 'starship3d'); st.textContent = CSS; document.head.appendChild(st);
  }
  const root = document.createElement('div'); root.className = 'g-ship3d'; el.appendChild(root);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  let destroyed = false, raf = 0;
  const cleanups = [];
  const on = (target, ev, fn, opt) => { target.addEventListener(ev, fn, opt); cleanups.push(() => target.removeEventListener(ev, fn, opt)); };

  // ---------- renderer
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    root.appendChild(h('div', 's3-fallback', 'This 3D rocket needs WebGL, which is switched off on this device.'));
    return { destroy() { root.remove(); } };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  const canvas = renderer.domElement; canvas.className = 's3-cv'; canvas.setAttribute('aria-label', 'Starship 3D model. Drag to spin, pinch to zoom.');
  root.appendChild(canvas);
  const size = { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) };
  renderer.setSize(size.w, size.h, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, size.w / size.h, 1, 20000);
  const FOG_COL = new THREE.Color(0x5b4b5c);
  scene.fog = new THREE.Fog(FOG_COL, 300, 3200);
  const SUN_PAD = new THREE.Vector3(-0.62, 0.1, -0.78).normalize();
  const SUN_SPACE = new THREE.Vector3(0.55, 0.55, 0.62).normalize();

  // ---------- textures
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const ctex = (c, srgb = true, rep = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const T = { steel: ctex(steelCanvas()), rough: ctex(roughCanvas(), false), tile: ctex(tileCanvas()), puff: ctex(puffCanvas(), false, false), glow: ctex(glowCanvas(), false, false) };
  T.earth = new THREE.CanvasTexture(makeCanvas(384, 192)); T.earth.wrapS = THREE.RepeatWrapping;
  { const g = T.earth.image.getContext('2d'); g.fillStyle = '#123a6e'; g.fillRect(0, 0, 384, 192); }
  const paintEarth = earthPainter(T.earth);
  let earthDone = false;

  // ---------- environment map (dusk gradient + soft boxes) for the steel reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT;
  {
    const es = new THREE.Scene(), geo = new THREE.SphereGeometry(50, 48, 24), pos = geo.attributes.position, cols = [], c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / 50, y = pos.getY(i) / 50, z = pos.getZ(i) / 50;
      const sa = Math.max(0, x * SUN_PAD.x + z * SUN_PAD.z) / Math.hypot(SUN_PAD.x, SUN_PAD.z);
      if (y >= 0) {
        const k = sstep(0, 0.5, y);
        c.setRGB(lerp(0.55 + 1.2 * sa * sa, 0.06, k), lerp(0.36 + 0.5 * sa * sa, 0.09, k), lerp(0.42 + 0.2 * sa, 0.22, k));
      } else c.setRGB(0.12, 0.1, 0.1);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    es.add(sky);
    const boxes = [];
    const panel = (az, el2, w, hh, col) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      m.position.set(Math.sin(az) * 40 * Math.cos(el2), Math.sin(el2) * 40, Math.cos(az) * 40 * Math.cos(el2)); m.lookAt(0, 0, 0); es.add(m); boxes.push(m);
    };
    panel(Math.atan2(SUN_PAD.x, SUN_PAD.z), 0.12, 16, 70, new THREE.Color(3.2, 1.9, 1.1));
    panel(1.25, 0.25, 10, 70, new THREE.Color(1.1, 1.25, 1.6));
    panel(-0.35, 0.3, 6, 70, new THREE.Color(0.7, 0.75, 0.95));
    panel(0.5, 1.2, 50, 12, new THREE.Color(0.35, 0.42, 0.7));
    envRT = pmrem.fromScene(es, 0.03);
    scene.environment = envRT.texture;
    sky.geometry.dispose(); sky.material.dispose(); boxes.forEach((b) => { b.geometry.dispose(); b.material.dispose(); });
  }

  // ---------- sky, stars, ground, sea, earth
  const skyMat = new THREE.ShaderMaterial({ uniforms: { uSun: { value: SUN_PAD.clone() }, uSpace: { value: 0 }, uFog: { value: FOG_COL.clone().convertLinearToSRGB() }, uLimb: { value: -2 }, uLimbI: { value: 0 } },
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, toneMapped: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
  {
    const n = 1800, p = new Float32Array(n * 3), b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = hash(i * 1.7 + 3), v = hash(i * 2.9 + 7), th = u * Math.PI * 2, y = v * 1.9 - 0.9, r = Math.sqrt(1 - y * y);
      p[i * 3] = Math.cos(th) * r * 90; p[i * 3 + 1] = y * 90; p[i * 3 + 2] = Math.sin(th) * r * 90; b[i] = 0.35 + 0.65 * Math.pow(hash(i * 5.1), 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aB', new THREE.BufferAttribute(b, 1));
    var starMat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0.4 }, uPx: { value: renderer.getPixelRatio() } },
      vertexShader: 'attribute float aB; uniform float uPx; varying float vB; varying float vH; void main(){ vB = aB; vH = normalize(position).y; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; gl_PointSize = (1.0 + aB * 1.6) * uPx; }',
      fragmentShader: 'uniform float uA; varying float vB; varying float vH; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(d)) * vB * uA * smoothstep(-0.02, 0.25, vH); gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), a); }',
      transparent: true, depthWrite: false, toneMapped: false,
    });
    var stars = new THREE.Points(g, starMat); stars.frustumCulled = false; stars.renderOrder = -9; scene.add(stars);
  }
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e5);
  const M = makeMaterials(T, cutPlane, aniso);

  const padGroup = new THREE.Group(); scene.add(padGroup);
  T.ground = ctex(groundCanvas()); T.ground.repeat.set(80000 / 70, 40400 / 70); T.ground.anisotropy = aniso; M.ground.map = T.ground;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80000, 40400), M.ground); ground.rotation.x = -Math.PI / 2; ground.position.z = 19800; padGroup.add(ground);
  const seaFar = new THREE.Mesh(new THREE.PlaneGeometry(80000, 40000), M.sea); seaFar.rotation.x = -Math.PI / 2; seaFar.position.z = -20400; padGroup.add(seaFar);
  const seaNear = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), M.sea); seaNear.rotation.x = -Math.PI / 2; seaNear.visible = false; scene.add(seaNear);
  padGroup.add(buildPad(M));
  const tower = buildTower(M); padGroup.add(tower.group);
  const earthMat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: T.earth }, uSun: { value: SUN_SPACE.clone() } }, vertexShader: EARTH_VS, fragmentShader: EARTH_FS, toneMapped: false });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 80, 56), earthMat); earth.visible = false; scene.add(earth);
  const foam = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 0, depthWrite: false }));
  foam.position.y = 0.15; foam.visible = false; scene.add(foam);

  // ---------- vehicles
  const B = buildBooster(M, T), S = buildShip(M, T);
  scene.add(B.group, S.group);

  // ---------- lights (never hidden: hiding lights would recompile shaders mid-launch)
  const hemi = new THREE.HemisphereLight(0x8fa4d8, 0x2c2420, 0.85); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb27a, 2.2); sun.position.copy(SUN_PAD).multiplyScalar(100); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9db4ff, 0.55); fill.position.set(60, 50, 100); scene.add(fill);
  const flood = new THREE.SpotLight(0xffe9cc, 2.2, 0, 0.55, 1.0, 0); flood.position.set(95, 4, 130); flood.target.position.set(0, 72, 0); scene.add(flood, flood.target);
  const bLight = new THREE.PointLight(0xffa050, 0, 0, 1.15); scene.add(bLight);
  const sLight = new THREE.PointLight(0xffb060, 0, 0, 1.15); scene.add(sLight);
  const pLight = new THREE.PointLight(0xff7a3a, 0, 0, 1.15); scene.add(pLight);

  // ---------- particles
  const smoke = new Puffs(470, T.puff, false), embers = new Puffs(170, T.glow, true);
  scene.add(smoke.mesh, embers.mesh);

  // ---------- controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.9; controls.panSpeed = 0.7;
  controls.minDistance = 12; controls.maxDistance = 460; controls.maxPolarAngle = Math.PI * 0.97;
  controls.autoRotateSpeed = 0.55; controls.autoRotate = !reduce;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  let lastInteract = 0;
  on(controls, 'start', () => { lastInteract = performance.now(); controls.autoRotate = false; camAnim = null; });

  // ---------- UI
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); lines.setAttribute('class', 's3-lines'); root.appendChild(lines);
  const markerLayer = h('div', 's3-markers'); root.appendChild(markerLayer);
  const tl = h('div', 's3-tl', '<div class="eb">Starship · Version 3</div><div class="sub">124 m tall · taller than Big Ben</div>'); root.appendChild(tl);
  const tr = h('div', 's3-tr'); root.appendChild(tr);
  const cutBtn = h('button', 'btn ghost s3-cut', '<span class="sw"></span><span class="lbl">Cutaway</span>'); cutBtn.type = 'button'; cutBtn.setAttribute('aria-pressed', 'false');
  const resetBtn = h('button', 'btn ghost', ICON.reset + '<span class="lbl">Reset view</span>'); resetBtn.type = 'button';
  tr.append(cutBtn, resetBtn);
  const legend = h('div', 's3-legend s3-hide', '<span><i style="background:var(--oxygen)"></i>Liquid oxygen</span><span><i style="background:var(--methane)"></i>Liquid methane</span>'); root.appendChild(legend);
  const bottom = h('div', 's3-bottom'); root.appendChild(bottom);
  const launchBtn = h('button', 'btn big glow s3-launch', ICON.rocket + 'LAUNCH'); launchBtn.type = 'button'; bottom.appendChild(launchBtn);
  const card = h('div', 's3-card'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite');
  card.innerHTML = '<div class="head"><span class="num"></span><h3></h3><button class="s3-x" type="button" aria-label="Close">' + ICON.close + '</button></div>' +
    '<p class="txt"></p><div class="s3-wow"></div><div class="foot"><button class="speak-btn" type="button" aria-label="Read aloud">' + ICON.speak + '</button><span class="grow"></span>' +
    '<button class="btn ghost small s3-next" type="button">Next part ' + ICON.next + '</button></div>';
  root.appendChild(card);
  const countEl = h('div', 's3-count'); root.appendChild(countEl);
  const cap = h('div', 's3-cap off', '<div class="body"><div class="eb"></div><div class="txt"></div><div class="s3-wow"></div></div><button class="speak-btn" type="button" aria-label="Read aloud">' + ICON.speak + '</button>');
  root.appendChild(cap);
  const clock = h('div', 's3-clock s3-hide', '<div class="t">T-00:10</div><div class="ticks">' + BEAT_IDS.map(() => '<i></i>').join('') + '</div>'); root.appendChild(clock);
  const lc = h('div', 's3-lc s3-hide'); root.appendChild(lc);
  const pauseBtn = h('button', 'btn ghost round', ICON.pause); pauseBtn.type = 'button'; pauseBtn.setAttribute('aria-label', 'Pause');
  const skipBtn = h('button', 'btn ghost', ICON.skip + 'Skip'); skipBtn.type = 'button';
  lc.append(pauseBtn, skipBtn);
  const caught = h('div', 's3-caught', 'CAUGHT!'); root.appendChild(caught);
  const fade = h('div', 's3-fade'); root.appendChild(fade);
  const endBox = h('div', 's3-end s3-hide', '<div class="eb">Mission complete!</div><div class="row"></div>'); root.appendChild(endBox);
  const againBtn = h('button', 'btn big glow', ICON.rocket + 'Fly again'); againBtn.type = 'button';
  const padBtn = h('button', 'btn ghost', 'Back to the pad'); padBtn.type = 'button';
  endBox.querySelector('.row').append(againBtn, padBtn);
  const show = (e, v) => e.classList.toggle('s3-hide', !v);

  // ---------- hotspot markers
  const ns = 'http://www.w3.org/2000/svg';
  HOTS.forEach((hs) => {
    const b = h('button', 's3-hs ' + hs.def.side, '<span class="n">' + hs.n + '</span><span class="t"></span>'); b.type = 'button';
    b.querySelector('.t').textContent = hs.label; b.setAttribute('aria-label', hs.n + ': ' + hs.title);
    const dot = h('div', 's3-dot'); const ln = document.createElementNS(ns, 'line');
    markerLayer.append(dot, b); lines.appendChild(ln);
    hs.btn = b; hs.dot = dot; hs.line = ln; hs.anchor = new THREE.Vector3(); hs.out = new THREE.Vector3(); hs.w = 0; hs.hh = 48;
    on(b, 'click', (ev) => { ev.stopPropagation(); openHotspot(hs); });
  });
  let saved = null; try { saved = ctx.load && ctx.load('opened'); } catch (e) { saved = null; }
  const opened = new Set((Array.isArray(saved) ? saved : []).filter((id) => HOTS.some((x) => x.id === id)));
  HOTS.forEach((hs) => hs.btn.classList.toggle('seen', opened.has(hs.id)));
  let completed = false;
  const doComplete = () => { if (!completed) { completed = true; complete(); } };

  // ---------- state
  const st = { mode: 'explore', t: TL.start, paused: false, beat: -2, logged: false, count: null };
  let active = null, camAnim = null, cutOn = false, cutAmt = 0, viewShift = 0, world = '', audio = null, userMoved = false;
  let time = 0, last = performance.now(), statsLogged = false;
  const sessionOpened = new Set();
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  const camDirH = new THREE.Vector3(), camRight = new THREE.Vector3(), scr = new THREE.Vector3();
  const cP0 = new THREE.Vector3(), cL0 = new THREE.Vector3();
  const bp = { p: new THREE.Vector3(), q: new THREE.Quaternion() }, sp = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const poseA = { p: new THREE.Vector3(), q: new THREE.Quaternion() }, poseC = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const qBelly = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, BELLY);
  const qSpace = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)));
  const qUp = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, Math.PI / 2).multiply(qSpace);
  const qTmp = new THREE.Quaternion();

  // ---------- trajectories: everything is a pure function of t, so Skip and debug seeking just work
  const ascH = (t) => { const u = Math.max(0, t); return 0.55 * u * u + 0.05 * u * u * u; };
  const ascDH = (t) => { const u = Math.max(0, t); return 1.1 * u + 0.15 * u * u; };
  const ascPitch = (t) => Math.atan(0.0005 * ascH(t));
  const ascPos = (t, out) => { const hh = ascH(t); return out.set(0.00025 * hh * hh, B_PAD_Y + hh, 0); };
  const ascVel = (t, out) => { const hh = ascH(t), dh = ascDH(t); return out.set(0.0005 * hh * dh, dh, 0); };
  const armDip = (t) => { if (t <= TL.contact) return 0; const s = t - TL.contact; return 0.7 * (1 - Math.exp(-4 * s)) + 0.45 * Math.sin(9 * s) * Math.exp(-2.6 * s); };

  function boosterPose(t, o) {
    if (t < TL.sep) { ascPos(t, o.p); o.q.setFromAxisAngle(Z_AXIS, -ascPitch(t)); return o; }
    if (t < TL.catchB) {
      const tau = t - TL.sep; ascPos(TL.sep, o.p); ascVel(TL.sep, tmpW);
      o.p.addScaledVector(tmpW, tau); o.p.y -= 4.9 * tau * tau;
      const bb = Math.max(0, t - 25.4); o.p.x -= 5 * bb * bb;
      const ang = lerp(-ascPitch(TL.sep), 1.95, easeIO(sstep(23.3, 26.2, t))) + 0.03 * Math.sin(t * 1.7) * sstep(20, 23, t);
      o.q.setFromAxisAngle(Z_AXIS, ang); return o;
    }
    const k = 1 - clamp((t - TL.catchB) / (TL.close0 - TL.catchB), 0, 1);
    let y = CATCH_Y + 2.5 + 340 * k * k * k;
    if (t > TL.close1) { const s = clamp((t - TL.close1) / (TL.contact - TL.close1), 0, 1); y = CATCH_Y + 2.5 * (1 - s * s); }
    if (t > TL.contact) y = CATCH_Y - armDip(t);
    o.p.set(18 * k * k, y, -7 * k * k);
    o.q.setFromAxisAngle(Z_AXIS, 0.07 * k * Math.sin(t * 1.3));
    return o;
  }
  function shipPose(t, o) {
    if (t < TL.sep) {
      boosterPose(t, poseA); o.p.set(0, SHIP_OFF, 0).applyQuaternion(poseA.q).add(poseA.p); o.q.copy(poseA.q).multiply(qBelly); return o;
    }
    if (t < TL.space) {
      const tau = t - TL.sep, p0 = ascPitch(TL.sep), p2 = p0 + 0.035 * tau;
      ascPos(TL.sep, o.p); o.p.x += Math.sin(p0) * SHIP_OFF; o.p.y += Math.cos(p0) * SHIP_OFF;
      ascVel(TL.sep, tmpW); o.p.addScaledVector(tmpW, tau);
      o.p.x += Math.sin(p2) * 5 * tau * tau; o.p.y += Math.cos(p2) * 5 * tau * tau;
      o.q.setFromAxisAngle(Z_AXIS, -p2).multiply(qBelly); return o;
    }
    if (t < TL.flip) {
      o.p.set(0, 0, 0);
      const nose = 0.44 * sstep(TL.reentry, TL.reentry + 2.5, t) + 0.025 * Math.sin(t * 2.3) * sstep(TL.reentry, TL.reentry + 2, t);
      o.q.setFromAxisAngle(Z_AXIS, nose).multiply(qSpace); return o;
    }
    let y;
    if (t < TL.flip0) y = 330 - 45 * (t - TL.flip);
    else if (t < TL.splash) { const T2 = TL.splash - TL.flip0; y = hermite(195, -45 * T2, 26.3, -1.5 * T2, (t - TL.flip0) / T2); }
    else { const s = t - TL.splash; y = 26.3 - 1.4 * sstep(0, 1.5, s) + 0.3 * Math.sin(1.8 * s) * Math.exp(-0.5 * s); }
    o.p.set(22 * (1 - sstep(TL.flip, 71, t)), y, 0);
    o.q.slerpQuaternions(qSpace, qUp, easeIO(sstep(TL.flip0, TL.flip1, t)));
    if (t < TL.flip0) o.q.premultiply(qTmp.setFromAxisAngle(X_AXIS_L, 0.04 * Math.sin(t * 1.9)));
    return o;
  }
  const X_AXIS_L = new THREE.Vector3(1, 0, 0);

  // engine throttles (0..1)
  function bThr(i, ring, t) {
    if (t < TL.sep + 2) {
      const ts = TL.ignition + 0.4 + (ring === 0 ? 0 : ring === 1 ? 0.25 + (i - 3) * 0.03 : 0.6 + (i - 13) * 0.025);
      const off = ring === 0 ? 19.6 : 17.6;
      return sstep(ts, ts + 0.3, t) * (1 - sstep(off, off + 0.25, t));
    }
    if (t < TL.catchB) return ring < 2 ? bump(t, 25.3, 25.6, 29.4, 29.8) : 0;
    if (ring === 0) return bump(t, 34.0, 34.3, 40.95, 41.05);
    if (ring === 1) return bump(t, 34.0, 34.3, 36.9, 37.2);
    return 0;
  }
  function sThr(vac, t) {
    if (t < TL.flip) { const d = vac ? 0.2 : 0; return bump(t, 18.0 + d, 18.3 + d, 47.4, 47.7); }
    return vac ? 0 : bump(t, TL.flip0 + 0.1, TL.flip0 + 0.4, TL.splash + 0.05, TL.splash + 0.3);
  }

  // ---------- particle emitters
  const smokeCol = (warm) => (age, u, r4, C, j) => {
    const heat = warm * (1 - sstep(0.15, 1.6, age)), g = 0.74 + 0.16 * r4;
    C[j] = lerp(g, 1.0, heat); C[j + 1] = lerp(g * 0.94, 0.62, heat); C[j + 2] = lerp(g * 0.92, 0.36, heat);
  };
  const radial = (lo, hi, up0, up1) => (ax, r1, r2, r3, r4) => { const a = r2 * 6.283, s = lo + r4 * (hi - lo); return ax === 0 ? Math.sin(a) * s : ax === 2 ? Math.cos(a) * s : up0 + r3 * (up1 - up0); };
  smoke.add({ count: 150, t0: -3.4, t1: 6.5, life: 9, drag: 0.55, lift: 0.5, size0: 8, size1: 36, alpha: 0.45, fadeIn: 0.35, fadeOut: 0.5,
    origin: (b, r1, r2, r3, o) => { const a = r2 * 6.283, rr = 6 + r3 * 6; return o.set(Math.sin(a) * rr, 2 + r1 * 6, Math.cos(a) * rr); },
    vel: radial(12, 34, 2, 7), color: smokeCol(1) });
  smoke.add({ count: 140, t0: 0.6, t1: 16, life: 8, drag: 0.5, lift: 0.3, size0: 10, size1: 36, alpha: 0.4, fadeIn: 0.3, fadeOut: 0.45,
    origin: (b, r1, r2, r3, o) => { boosterPose(b, poseC); o.set((r2 - 0.5) * 4, -42 - r1 * 8, (r3 - 0.5) * 4).applyQuaternion(poseC.q).add(poseC.p); return o; },
    vel: (ax, r1, r2, r3, r4) => (ax === 1 ? -5 - r4 * 6 : ((ax === 0 ? r2 : r3) - 0.5) * 10), color: smokeCol(0.6) });
  smoke.add({ count: 60, t0: 34.6, t1: 40.9, life: 5, drag: 0.6, lift: 0.6, size0: 6, size1: 26, alpha: 0.45, fadeIn: 0.3, fadeOut: 0.5,
    origin: (b, r1, r2, r3, o) => { const a = r2 * 6.283, rr = 5 + r3 * 4; return o.set(Math.sin(a) * rr, 17 + r1 * 3, Math.cos(a) * rr); },
    vel: radial(8, 22, 1, 4), color: smokeCol(0.8) });
  smoke.add({ count: 70, t0: TL.splash - 0.3, t1: TL.splash + 1.2, life: 3.2, drag: 0.25, lift: -9.8, size0: 3, size1: 14, alpha: 0.6, fadeIn: 0.1, fadeOut: 0.55,
    origin: (b, r1, r2, r3, o) => { const a = r2 * 6.283, rr = 3 + r3 * 4; return o.set(Math.sin(a) * rr, 0.5, Math.cos(a) * rr); },
    vel: radial(5, 15, 10, 24), color: (age, u, r4, C, j) => { C[j] = 0.86; C[j + 1] = 0.9; C[j + 2] = 0.95; } });
  smoke.add({ count: 50, t0: 70.6, t1: TL.splash + 1.5, life: 6, drag: 0.6, lift: 0.9, size0: 6, size1: 30, alpha: 0.5, fadeIn: 0.3, fadeOut: 0.5,
    origin: (b, r1, r2, r3, o) => { const a = r2 * 6.283, rr = 2 + r3 * 6; return o.set(Math.sin(a) * rr, 1 + r1 * 2, Math.cos(a) * rr); },
    vel: radial(8, 22, 2, 7), color: smokeCol(0.7) });
  const emberCol = (r, g0, g1, b) => (age, u, r4, C, j) => { C[j] = r; C[j + 1] = lerp(g0, g1, r4); C[j + 2] = b; };
  embers.add({ count: 50, t0: 18.1, t1: 19.6, life: 1.4, drag: 1.2, lift: 0, size0: 1.8, size1: 0.5, alpha: 1, fadeIn: 0.05, fadeOut: 0.4,
    origin: (b, r1, r2, r3, o) => { boosterPose(b, poseC); const a = r2 * 6.283; return o.set(Math.sin(a) * R, 34.5 + (r1 - 0.5) * 2, Math.cos(a) * R).applyQuaternion(poseC.q).add(poseC.p); },
    vel: radial(18, 40, -4, 8), color: emberCol(1, 0.55, 0.85, 0.3) });
  embers.add({ count: 70, t0: 53.6, t1: 60.6, life: 1.1, drag: 0.5, lift: 0, size0: 2.2, size1: 0.5, alpha: 0.95, fadeIn: 0.05, fadeOut: 0.4,
    origin: (b, r1, r2, r3, o) => { shipPose(b, poseC); return o.set((r2 > 0.5 ? 1 : -1) * (R + 0.8), (r1 - 0.5) * 46, 2.5).applyQuaternion(poseC.q).add(poseC.p); },
    vel: (ax, r1, r2, r3, r4) => (ax === 0 ? -40 - r4 * 40 : ax === 1 ? 12 + r3 * 18 : (r2 - 0.5) * 16), color: emberCol(1, 0.45, 0.8, 0.28) });
  embers.add({ count: 46, t0: TL.contact, t1: TL.contact + 0.35, life: 1.6, drag: 0.4, lift: -9.8, size0: 1.0, size1: 0.45, alpha: 1, fadeIn: 0.02, fadeOut: 0.5,
    origin: (b, r1, r2, r3, o) => { boosterPose(b, poseC); return o.set((r1 - 0.5) * 2.4, 25.2, (r2 > 0.5 ? 1 : -1) * (R + 0.6)).applyQuaternion(poseC.q).add(poseC.p); },
    vel: (ax, r1, r2, r3, r4) => (ax === 0 ? (r3 - 0.5) * 16 : ax === 1 ? 2 + r4 * 9 : (r2 > 0.5 ? 1 : -1) * (2 + r3 * 8)), color: emberCol(1, 0.75, 0.95, 0.45) });

  // ---------- world modes
  function setWorld(m) {
    if (world === m) return; world = m;
    const pad = m === 'pad', space = m === 'space', sea = m === 'sea';
    padGroup.visible = pad; seaNear.visible = sea; earth.visible = space; foam.visible = sea; B.group.visible = pad;
    skyMat.uniforms.uSpace.value = space ? 1 : 0; skyMat.uniforms.uLimbI.value = space ? 1 : 0;
    starMat.uniforms.uA.value = space ? 1 : 0.4;
    hemi.intensity = space ? 0.1 : 0.85; hemi.groundColor.set(space ? 0x1a3050 : 0x2c2420);
    sun.color.set(space ? 0xfff4e6 : 0xffb27a); sun.intensity = space ? 3.0 : 2.2;
    sun.position.copy(space ? SUN_SPACE : SUN_PAD).multiplyScalar(100);
    fill.intensity = space ? 0.12 : 0.55; flood.intensity = pad ? 2.2 : 0;
    scene.environmentIntensity = space ? 0.4 : 1;
    if (space) { scene.fog.near = 1e6; scene.fog.far = 2e6; }
  }

  // ---------- scene state at time t
  const flick = () => 0.85 + 0.15 * Math.sin(time * 31) * Math.sin(time * 17.3);
  function applyScene(t) {
    const m = t < TL.space ? 'pad' : t < TL.flip ? 'space' : 'sea';
    setWorld(m);
    boosterPose(t, bp); B.group.position.copy(bp.p); B.group.quaternion.copy(bp.q);
    shipPose(t, sp); S.group.position.copy(sp.p); S.group.quaternion.copy(sp.q);
    // booster engines
    const alt = m === 'pad' ? bp.p.y : 0, lenK = 1 + 0.9 * sstep(150, 1500, alt);
    let sum = 0;
    for (let i = 0; i < 33; i++) {
      const [x, z, ring] = B.layout[i], v = m === 'pad' ? bThr(i, ring, t) : 0; sum += v;
      const L = v * (14 + 4 * hash(i * 3.3)) * lenK, w = v > 0.001 ? 1.1 * (1 + 0.3 * (lenK - 1)) : 0;
      B.flames.setMatrixAt(i, _m4.compose(_a.set(x, -35.0, z), _q.identity(), _s.set(w, Math.max(L, 1e-4), w)));
    }
    B.flames.instanceMatrix.needsUpdate = true;
    const avg = sum / 33, any = sum > 0.01;
    B.flames.visible = any; B.plume.visible = any; B.glow.visible = any;
    const spread = Math.sqrt(Math.min(1, avg * 1.2));
    B.plume.scale.set(spread * (1 + 0.7 * (lenK - 1)), 30 * lenK * Math.min(1, avg * 1.4 + 0.3), spread * (1 + 0.7 * (lenK - 1)));
    B.pMat.uniforms.uInt.value = 0.65 * Math.min(1, avg * 1.5);
    B.glow.material.opacity = Math.min(1, avg * 2) * 0.85; B.glow.scale.setScalar(26 + 40 * avg);
    M.bellB.emissiveIntensity = Math.min(1, avg * 2) * 1.6;
    bLight.position.set(0, -44, 0).applyQuaternion(bp.q).add(bp.p); bLight.intensity = Math.min(1, avg * 2) * 2600 * flick();
    // ship engines
    let ss = 0;
    for (let i = 0; i < 6; i++) {
      const e = S.eng[i], v = sThr(e.vac, t); ss += v;
      const L = v * (e.vac ? (m === 'space' ? 26 : 17) : 10) * (m === 'sea' ? 0.8 : lenK), w = v > 0.001 ? e.w * (m === 'space' && e.vac ? 1.3 : 1) : 0;
      S.flames.setMatrixAt(i, _m4.compose(_a.set(e.x, e.exitY, e.z), _q.identity(), _s.set(w, Math.max(L, 1e-4), w)));
    }
    S.flames.instanceMatrix.needsUpdate = true;
    const sAvg = ss / 6; S.flames.visible = ss > 0.01; S.glow.visible = ss > 0.01;
    S.glow.material.opacity = Math.min(1, sAvg * 2) * 0.8;
    M.bellS.emissiveIntensity = Math.min(1, sAvg * 2) * 1.4;
    sLight.position.set(0, -34, 0).applyQuaternion(sp.q).add(sp.p); sLight.intensity = Math.min(1, sAvg * 2) * 1400 * flick();
    // hot staging, max-Q vapour, re-entry plasma
    const hs = m === 'pad' ? bump(t, 18.0, 18.3, 19.1, 19.7) : 0;
    B.vents.visible = hs > 0.01; B.vMat.uniforms.uInt.value = hs;
    M.hsInner.emissiveIntensity = hs * 3 + (m === 'pad' ? bump(t, 19.3, 19.8, 21, 25) * 0.8 : 0);
    const vap = m === 'pad' ? bump(t, 10.3, 11.2, 13.2, 14.4) : 0;
    B.vapour.visible = vap > 0.01; B.vapour.material.uniforms.uInt.value = vap * 0.65;
    const pl = m === 'space' ? bump(t, 53.4, 55.2, 59.6, 61) : 0;
    S.plasma.visible = pl > 0.01; S.shMat.uniforms.uInt.value = pl; S.wMat.uniforms.uInt.value = pl * 0.5; S.pglow.material.opacity = pl * 0.9;
    pLight.position.set(0, 0, 9).applyQuaternion(sp.q).add(sp.p); pLight.intensity = pl * 2200 * flick();
    // tower arms + QD arm
    let open = ARM_OPEN, cy = ARM_REST_Y;
    if (t >= TL.catchB) { cy = ARM_CATCH_Y - armDip(t); open = ARM_OPEN * (1 - easeIO(sstep(TL.close0, TL.close1, t))); }
    tower.carriage.position.y = cy; tower.arms[0].rotation.y = -open; tower.arms[1].rotation.y = open;
    tower.qd.rotation.y = sstep(-7.5, -5.5, t) * 1.25;
    // satellites: stacked; three slide out of the slot in space
    for (let i = 0; i < 9; i++) {
      const k = 8 - i, td = 48.4 + k * 1.5, s = t - td;
      let sc = 1; _a.set(0, 2.4 + i * 0.95, 0); _e.set(0, 0, 0);
      if (k < 3 && s > 0) {
        if (t >= TL.reentry) sc = 0;
        else { _a.set((k - 1) * 0.5 * s, 6.0 + 0.2 * s, -(1.4 + 2.1 * s + 0.12 * s * s)); _e.set(0.05 * s, 0.1 * s * (k - 1), 0.03 * s); }
      }
      S.sats.setMatrixAt(i, _m4.compose(_a, _q.setFromEuler(_e), _s.setScalar(sc)));
    }
    S.sats.instanceMatrix.needsUpdate = true;
    // earth, foam, particles
    if (m === 'space') {
      const ealt = lerp(170, 100, sstep(TL.reentry, TL.flip, t));
      earth.position.set(0, -(EARTH_R + ealt), 0); earth.rotation.z = (t - TL.space) * 0.006;
    }
    if (m === 'sea') { const s = t - TL.splash; foam.visible = s > 0; const k = 6 + 26 * sstep(0, 5, s); foam.scale.set(k, 1, k); foam.material.opacity = 0.5 * (1 - sstep(1, 5, s)); foam.position.x = sp.p.x; }
    smoke.update(t); embers.update(t);
    return avg + sAvg * 0.5;
  }

  // ---------- launch camera (pure function of t; short blends between shots, hard cuts behind a fade)
  function camCount(t, P, L) { const s = sstep(TL.start, TL.ignition, t); P.set(lerp(118, 92, s), lerp(16, 10, s), lerp(170, 138, s)); L.set(-4, 64, 0); return 40; }
  function camIgnite(t, P, L) { P.set(40, 4.5, 58); L.set(0, 30, 0); return 50; }
  function camGround(t, P, L) { P.set(122, 6, 172); boosterPose(t, poseC); L.set(0, Math.max(66, poseC.p.y + 14), 0); return lerp(42, 30, sstep(2, 8, t)); }
  function camChase(t, P, L) { boosterPose(t, poseC); const s = sstep(TL.maxq, TL.hotstage, t); L.copy(poseC.p).y += 10; P.copy(L).add(_b.set(lerp(150, 105, s), lerp(-70, -36, s), lerp(195, 140, s))); return 34; }
  function camStage(t, P, L) {
    boosterPose(t, poseC); L.set(0, 36, 0).applyQuaternion(poseC.q).add(poseC.p); const s = sstep(TL.hotstage, TL.boostback, t);
    P.copy(L).add(_b.set(lerp(36, 30, s), lerp(-6, 4, s), lerp(42, 36, s))); L.y += 4 * sstep(18.8, 21, t); return 40;
  }
  function camBoost(t, P, L) { boosterPose(t, poseC); const a = 0.85 + 0.09 * (t - TL.boostback); L.copy(poseC.p).y += 6; P.copy(poseC.p).add(_b.set(Math.sin(a) * 82, -16, Math.cos(a) * 82)); return 42; }
  function camCatch(t, P, L) {
    boosterPose(t, poseC);
    if (t < 36.5) { P.set(96, 22, 150); L.copy(poseC.p).lerp(_b.set(-6, 82, 0), 0.45); return 44; }
    if (t < TL.contact) { const s = easeIO(sstep(36.5, 39.8, t)); P.set(lerp(96, 74, s), lerp(22, 46, s), lerp(150, 104, s)); L.copy(poseC.p).lerp(_b.set(-6, 80, 0), lerp(0.45, 0.5, s)); return lerp(44, 40, s); }
    const s = easeIO(sstep(TL.contact, TL.space, t)); P.set(lerp(74, 50, s), lerp(46, 76, s), lerp(104, 74, s));
    L.copy(poseC.p).lerp(_b.set(-6, 80, 0), 0.5).lerp(_c.set(-4, 84, 0), sstep(TL.contact, 43, t)); return lerp(40, 35, s);
  }
  function camSpace(t, P, L) { const a = 0.95 + 0.11 * (t - TL.space); P.set(Math.sin(a) * 60, 9, Math.cos(a) * 60); L.set(4, -3, 0); return 40; }
  function camReentry(t, P, L) { P.set(-16 + (t - TL.reentry) * 1.4, 7, 56); L.set(6, -2, 0); return 44; }
  function camSea(t, P, L) { shipPose(t, poseC); P.set(64, Math.max(14, poseC.p.y * 0.55 + 8), 108); L.set(poseC.p.x * 0.8, Math.max(poseC.p.y, 20), 0); return 40; }
  const SEGS = [
    { t: TL.start, f: camCount, blend: 0 }, { t: TL.ignition, f: camIgnite, blend: 0 }, { t: TL.liftoff, f: camGround, blend: 0 }, { t: TL.maxq, f: camChase, blend: 2.0 },
    { t: TL.hotstage, f: camStage, blend: 1.4 }, { t: TL.boostback, f: camBoost, blend: 1.4 }, { t: TL.catchB, f: camCatch, blend: 0 },
    { t: TL.space, f: camSpace, blend: 0 }, { t: TL.reentry, f: camReentry, blend: 1.5 }, { t: TL.flip, f: camSea, blend: 0 },
  ];
  function camAt(t, P, L) {
    let i = SEGS.length - 1; while (i > 0 && t < SEGS[i].t) i--;
    const sg = SEGS[i]; let fov = sg.f(t, P, L);
    if (i > 0 && sg.blend > 0 && t < sg.t + sg.blend) {
      const k = easeIO((t - sg.t) / sg.blend), f0 = SEGS[i - 1].f(t, cP0, cL0);
      P.lerpVectors(cP0, P, k); L.lerpVectors(cL0, L, k); fov = lerp(f0, fov, k);
    }
    // shake: engines near the ground, the catch clunk, re-entry buffeting
    if (!reduce) {
      const amp = 0.35 * bump(t, -3.2, -2.4, 3, 7) + 0.55 * (t > TL.contact ? Math.exp(-(t - TL.contact) * 3.2) : 0) * (t < TL.space ? 1 : 0) + 0.12 * bump(t, 54, 55, 59, 60.5);
      if (amp > 0.001) { P.x += amp * Math.sin(t * 93); P.y += amp * Math.sin(t * 71 + 1.3); L.x += amp * 0.5 * Math.sin(t * 57); }
    }
    return fov;
  }
  const fadeAt = (t) => { let f = 0; for (const c of CUTS) f = Math.max(f, 1 - Math.abs(t - c) / 0.4); return clamp(f, 0, 1); };

  // ---------- explore: default view, hotspots, cutaway
  function defaultView(P, Tg) {
    const tn = Math.tan(THREE.MathUtils.degToRad(38) / 2), asp = size.w / size.h;
    const d = Math.max(86 / tn, 40 / (tn * asp));
    Tg.set(-5, 70, 0);
    const horiz = Math.sqrt(Math.max(1, d * d - 38 * 38)), az = 0.42;
    P.set(Tg.x + Math.sin(az) * horiz, 32, Math.cos(az) * horiz);
  }
  function startCamAnim(P, Tg, dur) {
    if (!dur) { camera.position.copy(P); controls.target.copy(Tg); camera.lookAt(Tg); camAnim = null; return; }
    camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: P.clone(), t1: Tg.clone(), start: performance.now(), dur };
  }
  function updateCamBasis() {
    camDirH.set(camera.position.x, 0, camera.position.z); if (camDirH.lengthSq() < 1e-6) camDirH.set(0, 0, 1); camDirH.normalize();
    camRight.set(camDirH.z, 0, -camDirH.x);
  }
  function anchorFor(hs, out, dir) { // world point + outward direction (pad pose)
    const d = hs.def;
    if (d.kind === 'cam') {
      const s = d.side === 'left' ? -1 : 1;
      dir.copy(camDirH).multiplyScalar(Math.cos(0.75)).addScaledVector(camRight, s * Math.sin(0.75)).normalize();
      return out.copy(dir).multiplyScalar(d.r ?? R + 0.1).setY(d.y);
    }
    if (d.kind === 'tower') { dir.set(0.6, 0, 1).normalize(); tower.group.updateMatrixWorld(); return tower.arms[0].localToWorld(out.set(ARM_LEN * 0.55, 1.4, 0)); }
    let best = -2;
    const cands = d.kind === 'fin' ? B.finAz : d.kind === 'flap' ? [BELLY + Math.PI / 2, BELLY - Math.PI / 2] : [BELLY];
    for (const az of cands) { azDir(az, tmpW); const v = tmpW.dot(camDirH); if (v > best) { best = v; dir.copy(tmpW); } }
    const r = d.kind === 'fin' ? R + 2.6 : d.kind === 'flap' ? R + 1.8 : R + 0.1;
    return out.copy(dir).multiplyScalar(r).setY(d.y);
  }
  function focusFor(hs, P, Tg) {
    const d = hs.def; updateCamBasis(); anchorFor(hs, Tg, tmpV);
    if (d.focus === 'engines') { Tg.set(0, MOUNT_H + 1.5, 0); P.copy(camDirH).multiplyScalar(8.5).setY(1.6); return; }
    if (d.kind === 'cam') { Tg.set(0, d.y, 0); tmpV.copy(camDirH); }
    else if (d.kind !== 'tower') tmpV.addScaledVector(camDirH, 0.7).normalize();
    P.copy(Tg).addScaledVector(tmpV, d.dist); P.y += d.dist * d.elev; P.y = Math.max(P.y, 2);
  }
  function setCut(v) {
    cutOn = !!v; cutBtn.classList.toggle('on', cutOn); cutBtn.setAttribute('aria-pressed', String(cutOn)); show(legend, cutOn && st.mode === 'explore');
  }
  function updateCut(dt) {
    cutAmt = clamp(cutAmt + (cutOn && st.mode === 'explore' ? dt : -dt) / 0.8, 0, 1);
    const e = easeIO(cutAmt);
    if (cutAmt <= 0) cutPlane.constant = 1e5;
    else { cutPlane.normal.copy(camDirH).negate(); cutPlane.constant = (1 - e) * 12; }
    B.inside.visible = S.inside.visible = cutAmt > 0.001;
  }
  function openHotspot(hs, instant) {
    if (st.mode !== 'explore' || !hs) return;
    active = hs; userMoved = true;
    HOTS.forEach((x) => x.btn.classList.toggle('on', x === hs));
    card.querySelector('.num').textContent = hs.n; card.querySelector('h3').textContent = hs.title;
    card.querySelector('.txt').textContent = hs.text || ''; const w = card.querySelector('.s3-wow'); w.textContent = hs.wow || ''; w.style.display = hs.wow ? '' : 'none';
    card.classList.add('show');
    if (hs.def.internal) setCut(true);
    focusFor(hs, tmpP, tmpL); startCamAnim(tmpP, tmpL, instant ? 0 : 1.4);
    controls.autoRotate = false; lastInteract = performance.now();
    opened.add(hs.id); sessionOpened.add(hs.id); hs.btn.classList.add('seen');
    try { ctx.save && ctx.save('opened', [...opened]); } catch (e) { /* ignore */ }
    if (sessionOpened.size >= 3) doComplete();
  }
  function closeCard() { active = null; card.classList.remove('show'); HOTS.forEach((x) => x.btn.classList.remove('on')); }

  function toScreen(v, out) { scr.copy(v).project(camera); out.x = (scr.x * 0.5 + 0.5) * size.w; out.y = (-scr.y * 0.5 + 0.5) * size.h; out.z = scr.z; return out; }
  const sA = new THREE.Vector3(), sB = new THREE.Vector3();
  function layoutMarkers() {
    updateCamBasis();
    const sides = { left: [], right: [] };
    for (const hs of HOTS) {
      anchorFor(hs, hs.anchor, hs.out);
      toScreen(hs.anchor, sA);
      const vis = sA.z < 1 && sA.x > -60 && sA.x < size.w + 60 && sA.y > -60 && sA.y < size.h + 60;
      hs.vis = vis; hs.sx = sA.x; hs.sy = sA.y;
      if (!vis) continue;
      hs.far = hs.def.kind !== 'cam' && hs.def.kind !== 'tower' && hs.out.dot(camDirH) < -0.05;
      if (!hs.w) { hs.w = hs.btn.offsetWidth || 160; hs.hh = hs.btn.offsetHeight || 48; }
      let side = hs.def.side;
      if (hs.def.kind === 'tower') hs.col = sA.x - 22;
      else {
        toScreen(tmpW.set(0, hs.anchor.y, 0), sB); const ax = sB.x;
        toScreen(tmpW.copy(camRight).multiplyScalar(R).setY(hs.anchor.y), sB); const half = Math.abs(sB.x - ax);
        if (hs.def.kind !== 'cam') side = sA.x < ax ? 'left' : 'right';
        hs.col = side === 'left' ? ax - half - 30 : ax + half + 30;
      }
      if (hs.side !== side) { hs.side = side; hs.btn.classList.toggle('left', side === 'left'); }
      sides[side].push(hs);
    }
    const top = root.classList.contains('narrow') ? 84 : 112, bot = size.h - 104, gap = 54;
    for (const k of ['left', 'right']) {
      const arr = sides[k].sort((a, b) => a.sy - b.sy);
      let prev = -1e9;
      for (const hs of arr) { hs.py = Math.max(hs.sy, prev + gap, top); prev = hs.py; }
      let lim = bot;
      for (let i = arr.length - 1; i >= 0; i--) { if (arr[i].py > lim) arr[i].py = lim; lim = arr[i].py - gap; }
    }
    for (const hs of HOTS) {
      const showIt = hs.vis && st.mode === 'explore';
      hs.btn.classList.toggle('s3-hide', !showIt); hs.dot.style.display = showIt && !hs.far ? '' : 'none';
      hs.line.style.display = showIt ? '' : 'none';
      if (!showIt) continue;
      const left = hs.side === 'left';
      const x = clamp(left ? hs.col - hs.w : hs.col, 6, size.w - hs.w - 6), y = hs.py - hs.hh / 2;
      hs.btn.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      hs.btn.classList.toggle('far', !!hs.far);
      hs.dot.style.transform = `translate(${hs.sx.toFixed(1)}px,${hs.sy.toFixed(1)}px)`;
      const ex = left ? x + hs.w : x;
      hs.line.setAttribute('x1', hs.sx.toFixed(1)); hs.line.setAttribute('y1', hs.sy.toFixed(1));
      hs.line.setAttribute('x2', ex.toFixed(1)); hs.line.setAttribute('y2', hs.py.toFixed(1));
      hs.line.style.opacity = hs.far ? '0.35' : '1';
    }
  }

  // ---------- modes and launch flow
  function setMode(m) {
    st.mode = m;
    const ex = m === 'explore', la = m === 'launch', en = m === 'ended';
    show(tl, ex); show(tr, ex); show(bottom, ex); show(lines, ex); show(markerLayer, ex); show(legend, ex && cutOn);
    show(clock, la || en); show(lc, la); show(endBox, en);
    if (!la) { cap.classList.add('off'); countEl.innerHTML = ''; st.count = null; }
    if (!ex) closeCard();
    root.classList.toggle('paused', false);
    controls.enabled = ex;
  }
  function resetToPad() {
    setMode('explore'); st.t = TL.start; st.paused = false; applyScene(TL.start);
    camera.fov = 38; camera.updateProjectionMatrix(); defaultView(tmpP, tmpL); startCamAnim(tmpP, tmpL, 0);
    fade.style.opacity = '0'; caught.style.opacity = '0'; userMoved = false; lastInteract = 0;
    if (audio) audio.level(0);
  }
  function startLaunch(at = TL.start, paused = false) {
    if (destroyed) return;
    stopSpeaking(); setCut(false); cutAmt = 0; camAnim = null; viewShift = 0; camera.clearViewOffset();
    setMode('launch');
    st.t = clamp(at, TL.start, TL.end); st.paused = paused; st.beat = -2; st.logged = st.t > 0;
    pauseBtn.innerHTML = paused ? ICON.play : ICON.pause; pauseBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    root.classList.toggle('paused', paused);
    if (ctx.sound && !audio) { try { audio = makeAudio(); } catch (e) { audio = null; } }
    if (audio) audio.pause(paused);
    if (st.t >= TL.end) finishLaunch();
  }
  function finishLaunch() {
    st.t = TL.end; setMode('ended'); applyScene(TL.end); doComplete();
    if (audio) audio.level(0);
    if (!st.logged) { st.logged = true; log('Launched Starship!'); }
  }
  function seek(x) {
    st.t = clamp(x, TL.start, TL.end);
    if (st.t > 0 && !st.logged) { st.logged = true; log('Launched Starship!'); }
    if (st.t >= TL.end) finishLaunch();
  }
  function events(prev, t) {
    const cross = (x) => prev < x && t >= x, natural = t - prev < 0.5;
    if (natural) for (let n = 10; n >= 1; n--) if (cross(-n)) { if (n <= 3) speak(String(n)); if (audio) audio.beep(); }
    if (cross(0)) { if (natural) speak('Liftoff!'); if (!st.logged) { st.logged = true; log('Launched Starship!'); } }
    if (cross(TL.contact + 0.05) && natural) { speak('Caught it!'); if (audio) audio.clunk(); }
    if (cross(TL.splash) && natural && audio) audio.splash();
  }
  const fmtClock = (t) => { const neg = t < 0, s = neg ? Math.ceil(-t) : Math.floor(t); return (neg ? 'T-' : 'T+') + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const clockT = clock.querySelector('.t'), ticks = [...clock.querySelectorAll('.ticks i')];
  function updateLaunchUI(t) {
    const txt = fmtClock(t); if (clockT.textContent !== txt) clockT.textContent = txt;
    let bi = -1; for (let i = 0; i < BEAT_T.length; i++) if (t >= BEAT_T[i]) bi = i;
    if (bi !== st.beat) {
      st.beat = bi;
      ticks.forEach((e, i) => { e.classList.toggle('done', i < bi); e.classList.toggle('now', i === bi); });
      if (bi >= 0 && st.mode === 'launch') {
        const b = BEATS[bi];
        cap.querySelector('.eb').textContent = (bi + 1) + ' / ' + BEATS.length + ' · ' + (b.title || '');
        cap.querySelector('.txt').textContent = b.caption || '';
        const w = cap.querySelector('.s3-wow'); w.textContent = b.wow || ''; w.style.display = b.wow ? '' : 'none';
        cap.classList.remove('off');
      } else cap.classList.add('off');
    }
    const c = t < 0 ? String(Math.ceil(-t)) : t < 1.6 ? 'Liftoff!' : '';
    if (c !== st.count && st.mode === 'launch') {
      st.count = c; countEl.innerHTML = c ? '<span class="' + (t >= 0 ? 'word' : '') + '"></span>' : '';
      if (c) countEl.firstChild.textContent = c;
    }
    fade.style.opacity = fadeAt(t).toFixed(3);
    const ca = t - TL.contact;
    if (ca > 0 && ca < 3.4 && st.mode === 'launch') {
      const pop = ca < 0.3 ? lerp(0.4, 1.15, ca / 0.3) : ca < 0.55 ? lerp(1.15, 1, (ca - 0.3) / 0.25) : 1 + 0.03 * (ca - 0.55);
      caught.style.opacity = (Math.min(1, ca / 0.2) * (1 - sstep(2.7, 3.4, ca))).toFixed(3);
      caught.style.transform = 'translate(-50%,-50%) scale(' + pop.toFixed(3) + ')';
    } else if (caught.style.opacity !== '0') caught.style.opacity = '0';
  }

  // ---------- UI wiring
  on(launchBtn, 'click', () => startLaunch());
  on(cutBtn, 'click', () => { setCut(!cutOn); lastInteract = performance.now(); });
  on(resetBtn, 'click', () => { closeCard(); defaultView(tmpP, tmpL); startCamAnim(tmpP, tmpL, 1.2); userMoved = false; lastInteract = performance.now() - 5000; });
  on(card.querySelector('.s3-x'), 'click', () => closeCard());
  on(card.querySelector('.speak-btn'), 'click', () => { if (active) speak(active.title + '. ' + (active.text || '')); });
  on(card.querySelector('.s3-next'), 'click', () => { if (active) openHotspot(HOTS[active.n % HOTS.length]); });
  on(cap.querySelector('.speak-btn'), 'click', () => { const b = BEATS[st.beat]; if (b) speak(b.caption); });
  on(pauseBtn, 'click', () => {
    if (st.mode !== 'launch') return;
    st.paused = !st.paused; pauseBtn.innerHTML = st.paused ? ICON.play : ICON.pause; pauseBtn.setAttribute('aria-label', st.paused ? 'Play' : 'Pause');
    root.classList.toggle('paused', st.paused); if (audio) audio.pause(st.paused);
  });
  on(skipBtn, 'click', () => { if (st.mode !== 'launch') return; const nx = BEAT_T.find((x) => x > st.t + 0.05); seek(nx ?? TL.end); });
  on(againBtn, 'click', () => { resetToPad(); startLaunch(); });
  on(padBtn, 'click', () => resetToPad());

  // ---------- layout + resize
  function layoutClasses() {
    root.classList.toggle('narrow', size.w < 760 || size.h > size.w * 1.05);
    root.classList.toggle('compact', size.w < 540);
    root.classList.toggle('tiny', size.w < 600);
  }
  function resize() {
    if (destroyed) return;
    const w = Math.max(1, el.clientWidth), hh = Math.max(1, el.clientHeight);
    if (w === size.w && hh === size.h) return;
    size.w = w; size.h = hh; renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix();
    layoutClasses(); HOTS.forEach((x) => { x.w = 0; });
    if (st.mode === 'explore' && !userMoved && !active && !camAnim) { defaultView(tmpP, tmpL); startCamAnim(tmpP, tmpL, 0); }
  }
  const ro = new ResizeObserver(() => resize()); ro.observe(el);
  layoutClasses();

  // ---------- main loop
  function tickExplore(dt, now) {
    updateCamBasis();
    if (camAnim) {
      const s = clamp((now - camAnim.start) / (camAnim.dur * 1000), 0, 1), e = easeIO(s);
      camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e); camera.lookAt(controls.target);
      if (s >= 1) { camAnim = null; controls.update(); }
    } else {
      if (!reduce && !active && now - lastInteract > 9000) controls.autoRotate = true;
      controls.update(dt);
      const tg = controls.target; tg.set(clamp(tg.x, -40, 30), clamp(tg.y, 3, 150), clamp(tg.z, -30, 30));
      if (camera.position.y < 1.5) camera.position.y = 1.5;
    }
    updateCut(dt);
    const wantShift = active && !root.classList.contains('narrow') ? Math.min(220, (card.offsetWidth || 380) / 2 + 8) : 0;
    viewShift += (wantShift - viewShift) * Math.min(1, dt * 5);
    if (Math.abs(viewShift) > 0.5) camera.setViewOffset(size.w, size.h, viewShift, 0, size.w, size.h); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  }
  function tickEnded() { camera.fov = camAt(TL.end, tmpP, tmpL); camera.updateProjectionMatrix(); camera.position.copy(tmpP); camera.lookAt(tmpL); fade.style.opacity = '0'; }
  function tickLaunch(dt) {
    if (!st.paused) {
      const rate = st.t > 39.0 && st.t < 41.7 ? 0.5 : 1, prev = st.t;
      st.t = Math.min(TL.end, st.t + dt * rate);
      events(prev, st.t);
      if (st.t >= TL.end) { finishLaunch(); return; }
    }
    const lvl = applyScene(st.t);
    camera.fov = camAt(st.t, tmpP, tmpL); camera.updateProjectionMatrix();
    camera.position.copy(tmpP); camera.lookAt(tmpL);
    updateCamBasis(); updateCut(dt);
    if (world === 'pad') {
      const cy = camera.position.y, sp2 = 0.85 * sstep(150, 1800, cy);
      skyMat.uniforms.uSpace.value = sp2; starMat.uniforms.uA.value = 0.4 + 0.6 * sp2;
      scene.fog.near = 300 + cy * 1.5; scene.fog.far = 3200 + cy * 4;
    } else if (world === 'sea') { scene.fog.near = 300; scene.fog.far = 3200; skyMat.uniforms.uSpace.value = 0; starMat.uniforms.uA.value = 0.4; }
    else {
      const altCam = -earth.position.y - EARTH_R + camera.position.y;
      skyMat.uniforms.uLimb.value = -Math.sin(Math.acos(EARTH_R / (EARTH_R + Math.max(1, altCam))));
    }
    updateLaunchUI(st.t);
    if (audio) {
      const dist = camera.position.distanceTo(bp.p), near = world === 'pad' ? 1 - sstep(120, 1200, dist) : world === 'sea' ? 0.5 : 0;
      audio.level(st.paused ? 0 : lvl * near);
    }
  }
  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; time += dt;
    if (!earthDone) earthDone = paintEarth(st.mode === 'launch' ? 24 : 6);
    if (size.w < 2 || size.h < 2) return;
    if (st.mode === 'launch') tickLaunch(dt); else if (st.mode === 'ended') tickEnded(); else tickExplore(dt, now);
    for (const m of [B.fMat, B.pMat, B.vMat, S.fMat, S.shMat, S.wMat, B.vapour.material]) m.uniforms.uTime.value = time;
    M.red.color.setRGB(1, 0.16, 0.1).multiplyScalar(Math.sin(time * 2.6) > 0.2 ? 1 : 0.15);
    sky.position.copy(camera.position); stars.position.copy(camera.position);
    renderer.render(scene, camera);
    if (st.mode === 'explore') layoutMarkers();
    if (dbg.stats && !statsLogged) { statsLogged = true; console.log('S3D tris', renderer.info.render.triangles, 'calls', renderer.info.render.calls); }
  }
  on(document, 'visibilitychange', () => {
    if (destroyed) return;
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; if (audio) audio.pause(true); }
    else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); if (audio && !st.paused) audio.pause(false); }
  });

  // ---------- go
  resetToPad();
  try { renderer.compile(scene, camera); } catch (e) { /* compile is only a warm-up */ }
  if (dbg.cut) { setCut(true); cutAmt = 1; }
  if (dbg.hs) { const hs = HOTS.find((x) => x.id === dbg.hs); if (hs) { openHotspot(hs, true); if (hs.def.internal) cutAmt = 1; viewShift = root.classList.contains('narrow') ? 0 : 200; } }
  if (dbg.at != null && isFinite(dbg.at)) startLaunch(dbg.at, true);
  if (dbg.end) startLaunch(TL.end, true);
  if (!document.hidden) raf = requestAnimationFrame(frame);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(raf); raf = 0;
    try { ro.disconnect(); } catch (e) { /* ignore */ }
    cleanups.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
    try { controls.dispose(); } catch (e) { /* ignore */ }
    if (audio) audio.close();
    stopSpeaking();
    const mats = new Set(), geos = new Set(), texs = new Set(Object.values(T));
    scene.traverse((o) => { if (o.geometry) geos.add(o.geometry); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => mats.add(x)); });
    mats.forEach((m) => {
      ['map', 'roughnessMap'].forEach((k) => { if (m[k]) texs.add(m[k]); });
      if (m.uniforms) Object.values(m.uniforms).forEach((u) => { if (u && u.value && u.value.isTexture) texs.add(u.value); });
      m.dispose();
    });
    geos.forEach((g) => g.dispose()); texs.forEach((t) => t.dispose());
    smoke.dispose(); embers.dispose();
    try { envRT.dispose(); pmrem.dispose(); } catch (e) { /* ignore */ }
    try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    root.remove();
    if (!document.querySelector('.g-ship3d')) { const s = document.querySelector('style[data-module="starship3d"]'); if (s) s.remove(); }
  }
  return { destroy };
}
