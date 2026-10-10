/* Astra Finn: "Catch the Booster" (js/games/catch.js)
 *
 * 2D canvas game. Side view at dusk over the Texas coast. The Super Heavy booster
 * falls toward the launch tower; hold THRUST to slow it, steer LEFT/RIGHT, and land
 * it between the chopstick arms slowly enough to be caught.
 *
 * ctx.data (all optional):
 *   facts: string[]                              real facts, one shown per results card (rotates)
 *   level: 'cadet' | 'pilot' | 'commander'       starting level (default 'cadet')
 *
 * Saved with ctx.save/ctx.load: 'catches' (number), 'best' (softest catch, m/s),
 * 'bestLevel' (level id of the softest catch), 'factIdx' (next fact to show).
 *
 * Dev-only URL params (read from location.search, harmless in production):
 *   debugState=start|falling|brake|caught|crash|splash|fuel   jump straight to a state
 *   debugLevel=cadet|pilot|commander                     level for debug states / autopilot
 *   debugAutopilot=1 [&debugRounds=3]                    fly rounds automatically, log results
 *   debugSim=1 [&debugSimN=300]                          headless physics sim: autopilot + novice model
 *   debugNoCard=1                                        never show the results card
 *   debugPauseAt=<s>                                     freeze the scene <s> s into the outcome (or the round)
 *   debugTimer=1                                         drive the loop with setTimeout (for headless screenshots)
 */

const STEP = 1 / 120;
const TAU = Math.PI * 2;

// World geometry in metres. y = 0 is pad / sea level, x = 0 is the catch point.
const G = {
  R: 4.5, L: 70, PIN: 61, FIN0: 61.6, FIN1: 66.4, FINW: 3.3,
  TOWER_H: 130, TOWER_HW: 11, CAR_HW: 13.5,
  ARM_Y: 90, ARM_LEN: 30, ARM_T: 3.2, ARM_OPEN: 0.22,
  OLM_TOP: 19, OLM_HW: 14.5,
  PAD_L: -62, PAD_R: 27, SEA_X: 36,
  XLIM: 150, BF: 0.13,
};
G.VH0 = G.TOWER_H / 0.66; // base view height: tower fills about two thirds of the screen

const LEVELS = {
  cadet: {
    id: 'cadet', name: 'Cadet', blurb: 'Slow and easy',
    g: 2.0, thrust: 5.0, vTerm: 14, v0: 7, h0: 150, x0: [12, 26],
    vCatch: 5.0, tol: 7.0, fuel: 34, steer: 6.0, latDrag: 1.5, wind: 0, gust: 0,
    hints: true, assist: true,
  },
  pilot: {
    id: 'pilot', name: 'Pilot', blurb: 'A little windy',
    g: 3.2, thrust: 7.0, vTerm: 20, v0: 10, h0: 170, x0: [16, 36],
    vCatch: 3.5, tol: 4.5, fuel: 22, steer: 5.5, latDrag: 1.0, wind: 2.5, gust: 0.6,
    hints: true, assist: false,
  },
  commander: {
    id: 'commander', name: 'Commander', blurb: 'Windy and tricky',
    g: 4.5, thrust: 9.5, vTerm: 27, v0: 15, h0: 200, x0: [24, 50],
    vCatch: 2.5, tol: 3.0, fuel: 14, steer: 5.0, latDrag: 0.6, wind: 4.0, gust: 1.2,
    hints: false, assist: false,
  },
};
const LEVEL_IDS = ['cadet', 'pilot', 'commander'];

const DEFAULT_FACTS = [
  'Flight 5, in October 2024, was the first time the tower ever caught a booster.',
  'The tower has caught a booster three times: on Flights 5, 7 and 8.',
  "Most early test rockets blew up. That's how the engineers learned to make them better.",
  "The tower's giant catching arms are nicknamed the chopsticks.",
  'Nobody has caught the Ship yet. So far only the booster has been caught.',
  'The booster has 33 engines. It uses just a few of them to slow down for the catch.',
  'Grid fins near the top steer the booster as it falls back through the air.',
  'The booster is about 70 metres tall. That is about 16 double-decker buses stacked up!',
];

// ---------- small helpers ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- physics (pure, shared by the game, the autopilot and the debug sim) ----------
function newFlight(cfg, rng) {
  const side = rng() < 0.5 ? -1 : 1;
  const x0 = side * (cfg.x0[0] + rng() * (cfg.x0[1] - cfg.x0[0]));
  const wSide = rng() < 0.5 ? -1 : 1;
  const windBase = cfg.wind ? wSide * cfg.wind * (0.45 + 0.4 * rng()) : 0;
  return {
    x: x0, y: G.ARM_Y + cfg.h0 - G.PIN, vx: 0, vy: cfg.v0, fuel: cfg.fuel, t: 0, rng,
    wind: windBase, windBase, windTarget: windBase, windT: 2 + rng() * 2, windPh: rng() * TAU, windNow: windBase,
    ang: 0, steer: 0, thr: 0, thrust: false, needBrake: false,
  };
}

function physStep(s, inp, cfg, dt) {
  s.t += dt;
  if (cfg.wind > 0) {
    s.windT -= dt;
    if (s.windT <= 0) {
      s.windT = 3 + s.rng() * 3.5;
      s.windTarget = clamp(s.windBase + (s.rng() * 2 - 1) * cfg.wind * 0.45, -cfg.wind, cfg.wind);
    }
    s.wind += (s.windTarget - s.wind) * Math.min(1, dt * 0.35);
    s.windNow = s.wind + cfg.gust * Math.sin(s.t * 1.3 + s.windPh) * Math.sin(s.t * 0.41 + 1.7);
  } else s.windNow = 0;

  const h = s.y + G.PIN - G.ARM_Y; // catch pins above the arms
  const drag = cfg.g * s.vy * Math.abs(s.vy) / (cfg.vTerm * cfg.vTerm);
  let thr = 0;
  s.thrust = !!inp.thrust && s.fuel > 0;
  if (s.thrust) {
    thr = cfg.thrust;
    if (cfg.assist) {
      // Cadet helper: the flight computer never lets THRUST push the booster back up.
      // Holding THRUST settles to a gentle descent that gets slower near the arms.
      const vHold = Math.max(cfg.vCatch * 0.4, 0.08 * h);
      thr = clamp(cfg.g - drag + 2.5 * (s.vy - vHold), 0, cfg.thrust);
    }
    if (h > cfg.h0 + 25) thr = Math.min(thr, cfg.g * 0.92); // soft ceiling
  }
  s.thr = thr / cfg.thrust;
  s.vy += (cfg.g - thr - drag) * dt;
  s.y -= s.vy * dt;
  if (thr > 0) s.fuel = Math.max(0, s.fuel - dt * s.thr);

  const st = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  s.steer = st;
  s.vx += (st * cfg.steer + cfg.latDrag * (s.windNow - s.vx)) * dt;
  s.x += s.vx * dt;
  if (s.x > G.XLIM) { s.x = G.XLIM; if (s.vx > 0) s.vx = 0; }
  if (s.x < -G.XLIM) { s.x = -G.XLIM; if (s.vx < 0) s.vx = 0; }

  const angT = clamp(-st * 0.07 - (s.vx - s.windNow) * 0.012, -0.16, 0.16);
  s.ang += (angT - s.ang) * Math.min(1, dt * 4);

  const aNet = Math.max(0.5, cfg.thrust - cfg.g);
  const vT = cfg.vCatch * 0.6;
  const dStop = (s.vy * s.vy - vT * vT) / (2 * aNet * 0.8);
  s.needBrake = s.vy > cfg.vCatch * 0.85 && dStop >= h - 8;
}

function judgeCrossing(s, cfg) {
  const v = Math.max(0.1, Math.round(s.vy * 10) / 10);
  const inSlot = Math.abs(s.x) <= cfg.tol;
  return { type: inSlot ? (v <= cfg.vCatch ? 'caught' : 'fast') : 'miss', v, dx: s.x };
}

// Competent autopilot (debug): proves each level can be caught.
function makeAutopilot(cfg) {
  let acc = 0;
  return (s) => {
    const h = s.y + G.PIN - G.ARM_Y;
    const aB = Math.max(0.5, cfg.thrust - cfg.g) * 0.55;
    const aligned = Math.abs(s.x) < cfg.tol * 0.45 && Math.abs(s.vx) < 1.2;
    let vT = Math.sqrt(Math.max(0, 2 * aB * Math.max(0, h - 3))) + cfg.vCatch * 0.45;
    if (!aligned && h < 22) vT = Math.min(vT, 0.5);
    const thrust = s.vy > vT;
    const vDes = clamp(-s.x * 0.45, -6, 6);
    const u = ((vDes - s.windNow) * cfg.latDrag + (vDes - s.vx) * 2.0) / cfg.steer;
    acc += clamp(u, -1, 1);
    let st = 0;
    if (acc > 0.5) { st = 1; acc -= 1; } else if (acc < -0.5) { st = -1; acc += 1; }
    return { thrust, left: st < 0, right: st > 0 };
  };
}

// Rough model of a six-year-old: slow reactions, a steering dead-band, follows the on-screen hints.
function makeNovice(cfg, rng) {
  const delay = 0.35 + rng() * 0.45;
  const dead = cfg.tol * (0.25 + rng() * 0.5);
  const stopAt = dead * (0.25 + rng() * 0.45);
  const keepHold = rng() < 0.5;
  const judgeH = 20 + rng() * 60;
  const lateHint = rng() < 0.3 ? 0.4 + rng() * 1.0 : 0; // sometimes notices the hint late
  const hist = [];
  let steer = 0, thrust = false, next = 0, nbSince = -1;
  return (s) => {
    hist.push({ t: s.t, x: s.x, vy: s.vy, h: s.y + G.PIN - G.ARM_Y, nb: s.needBrake });
    while (hist.length > 1 && hist[1].t <= s.t - delay) hist.shift();
    const o = hist[0];
    if (s.t >= next) {
      next = s.t + 0.08 + rng() * 0.14;
      if (Math.abs(o.x) > dead) steer = o.x > 0 ? -1 : 1;
      else if (Math.abs(o.x) < stopAt) steer = 0;
      if (rng() < 0.02) steer = -steer; // occasional wrong way
      if (cfg.hints) {
        if (o.nb) { if (nbSince < 0) nbSince = s.t; if (s.t - nbSince >= lateHint) thrust = true; }
        else nbSince = -1;
        if (o.vy < -0.2) thrust = false;
        else if (!cfg.assist && !o.nb && o.vy < cfg.vCatch * (keepHold ? 0.35 : 0.7)) thrust = false;
      } else {
        if (o.h < judgeH && o.vy > cfg.vCatch * 0.9) thrust = true;
        else if (o.vy < cfg.vCatch * 0.5) thrust = false;
      }
    }
    return { thrust, left: steer < 0, right: steer > 0 };
  };
}

function simulateRound(levelId, kind, seed) {
  const cfg = LEVELS[levelId];
  const rng = mulberry32(seed);
  const s = newFlight(cfg, rng);
  let pilot;
  if (kind === 'auto') pilot = makeAutopilot(cfg);
  else if (kind === 'novice') pilot = makeNovice(cfg, mulberry32(seed * 7 + 3));
  else {
    // 'holdall': holds THRUST the whole time and steers like the autopilot; 'nothrust': steers only
    const ap = makeAutopilot(cfg);
    pilot = (s) => { const i = ap(s); i.thrust = kind === 'holdall'; return i; };
  }
  for (let i = 0; i < 120 * 300; i++) {
    const inp = pilot(s);
    const prev = s.y + G.PIN;
    physStep(s, inp, cfg, STEP);
    if (prev > G.ARM_Y && s.y + G.PIN <= G.ARM_Y) return Object.assign(judgeCrossing(s, cfg), { t: s.t, fuel: s.fuel / cfg.fuel });
    if (s.fuel <= 0) return { type: 'fuel', v: s.vy, dx: s.x, t: s.t, fuel: 0 };
  }
  return { type: 'timeout', t: s.t };
}

// ---------- CSS (scoped under .g-catch, injected once) ----------
const CSS = `
.g-catch{position:absolute;inset:0;overflow:hidden;background:#070a16;color:var(--ink,#f3efe6);font-family:var(--font-body,system-ui,sans-serif);touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
.g-catch *{box-sizing:border-box;-webkit-touch-callout:none}
.g-catch [hidden]{display:none!important}
.g-catch .gc-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.g-catch .gc-hud{position:absolute;inset:0;z-index:1;pointer-events:none;transition:opacity .35s ease}
.g-catch .gc-hud.off{opacity:0}
.g-catch .gc-box{background:var(--panel,rgba(14,20,38,.78));border:1px solid var(--line,rgba(255,255,255,.12));-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-radius:16px}
.g-catch .gc-gauges{position:absolute;left:16px;top:14px;width:310px;padding:12px 16px 14px;display:grid;gap:12px}
.g-catch .gc-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.g-catch .gc-k{font-family:var(--font-display,system-ui);font-size:18px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2,#b9c0cf)}
.g-catch .gc-num{font-family:var(--font-display,system-ui);font-weight:700;font-size:40px;line-height:1;font-variant-numeric:tabular-nums;color:var(--ink,#f3efe6);transition:color .2s;white-space:nowrap}
.g-catch .gc-num small{font-size:20px;font-weight:500;color:var(--ink-2,#b9c0cf);margin-left:6px}
.g-catch .gc-num.ok{color:var(--green,#6fe3a5)}
.g-catch .gc-num.warn{color:var(--gold,#f2b544)}
.g-catch .gc-num.up{color:var(--cyan,#5fd4ff)}
.g-catch .gc-pct{font-family:var(--font-display,system-ui);font-weight:700;font-size:26px;font-variant-numeric:tabular-nums}
.g-catch .gc-bar{position:relative;height:18px;border-radius:999px;background:rgba(255,255,255,.1)}
.g-catch .gc-band{position:absolute;left:0;top:0;bottom:0;border-radius:999px 4px 4px 999px;background:rgba(111,227,165,.3);box-shadow:inset 0 0 0 2px rgba(111,227,165,.85)}
.g-catch .gc-mark{position:absolute;top:-7px;left:0;width:8px;height:32px;margin-left:-4px;border-radius:4px;background:#fff;box-shadow:0 0 0 2px rgba(5,7,13,.6),0 0 12px rgba(255,255,255,.5)}
.g-catch .gc-bandlbl{font-size:18px;color:var(--green,#6fe3a5);line-height:1.1;margin-top:-4px}
.g-catch .gc-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,var(--gold,#f2b544),var(--gold-2,#ffd27a))}
.g-catch .gc-fill.low{background:var(--red,#ff6b57);animation:gcBlink 1s ease-in-out infinite}
@keyframes gcBlink{50%{opacity:.45}}
.g-catch .gc-tr{position:absolute;right:16px;top:14px;display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.g-catch .gc-wind{display:flex;align-items:center;gap:12px;padding:10px 16px}
.g-catch .gc-wind svg{width:60px;height:24px;color:var(--cyan,#5fd4ff);transition:transform .5s ease,opacity .5s}
.g-catch .gc-wind b{font-family:var(--font-display,system-ui);font-weight:600;font-size:20px;min-width:5.2em}
.g-catch .gc-stats{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.g-catch .chip{font-size:18px;min-height:40px;background:rgba(14,20,38,.72)}
.g-catch .gc-hint{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);max-width:min(600px,calc(100% - 430px));text-align:center;padding:10px 22px;border-radius:999px;font-family:var(--font-display,system-ui);font-weight:600;font-size:24px;line-height:1.2;color:var(--ink,#f3efe6);background:var(--panel,rgba(14,20,38,.78));border:1.5px solid var(--line,rgba(255,255,255,.12));opacity:0;transition:opacity .25s,border-color .25s,color .25s;white-space:nowrap}
.g-catch .gc-hint.show{opacity:1}
.g-catch .gc-hint.gold{border-color:var(--gold,#f2b544);color:var(--gold-2,#ffd27a)}
.g-catch .gc-hint.cyan{border-color:var(--cyan,#5fd4ff);color:var(--cyan,#5fd4ff)}
.g-catch .gc-hint.red{border-color:var(--red,#ff6b57);color:#ffb3a8}
.g-catch .gc-banner{position:absolute;left:0;right:0;top:19%;z-index:2;text-align:center;pointer-events:none;font-family:var(--font-display,system-ui);font-weight:700;font-size:78px;line-height:1;letter-spacing:.02em;color:var(--ink,#f3efe6);text-shadow:0 4px 30px rgba(0,0,0,.65);opacity:0;padding:0 12px}
.g-catch .gc-banner.show{animation:gcBan .6s cubic-bezier(.2,1.4,.4,1) forwards}
.g-catch .gc-banner.gold{color:var(--gold-2,#ffd27a);text-shadow:0 0 34px rgba(242,181,68,.6),0 4px 30px rgba(0,0,0,.6)}
.g-catch .gc-banner.cyan{color:var(--cyan,#5fd4ff)}
.g-catch .gc-banner.small{font-size:54px}
@keyframes gcBan{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
.g-catch .gc-ctl{position:absolute;left:0;right:0;bottom:0;height:0;z-index:2}
.g-catch .gc-btn{position:absolute;bottom:18px;margin:0;padding:0;border:0;-webkit-appearance:none;appearance:none;cursor:pointer;touch-action:none;-webkit-user-select:none;user-select:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transition:transform .08s ease,background-color .15s,box-shadow .15s,opacity .3s;outline:none}
.g-catch .gc-btn svg,.g-catch .gc-btn span{pointer-events:none}
.g-catch .gc-lr{width:104px;height:104px;border-radius:30px;background:rgba(14,20,38,.62);border:2.5px solid rgba(95,212,255,.55);color:var(--cyan,#5fd4ff);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 8px 24px rgba(0,0,0,.35)}
.g-catch .gc-left{left:18px}
.g-catch .gc-right{left:136px}
.g-catch .gc-lr.on{background:rgba(95,212,255,.32);transform:scale(.94)}
.g-catch .gc-thrust{right:18px;width:136px;height:136px;border-radius:50%;color:#2a1704;background:radial-gradient(circle at 50% 35%,#ffe09a 0%,var(--gold,#f2b544) 55%,#c98a1e 100%);box-shadow:0 10px 30px rgba(242,181,68,.35),inset 0 -6px 12px rgba(120,70,0,.35);font-family:var(--font-display,system-ui);font-weight:700;font-size:20px;letter-spacing:.06em}
.g-catch .gc-thrust.on{transform:scale(.95);background:radial-gradient(circle at 50% 40%,#fff3cc 0%,#ffcf6a 50%,#e0961f 100%);box-shadow:0 0 0 8px rgba(242,181,68,.25),0 0 40px rgba(255,190,90,.6)}
.g-catch .gc-thrust.pulse:not(.on){animation:gcPulse 1s ease-in-out infinite}
@keyframes gcPulse{0%,100%{box-shadow:0 0 0 0 rgba(242,181,68,.75),0 10px 30px rgba(242,181,68,.35)}50%{box-shadow:0 0 0 20px rgba(242,181,68,0),0 10px 30px rgba(242,181,68,.35)}}
.g-catch .gc-ctl.off .gc-btn{opacity:0;pointer-events:none}
.g-catch .gc-panel{position:absolute;z-index:3;left:24px;top:50%;transform:translateY(-50%);width:min(520px,46%);max-height:calc(100% - 28px);overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:14px;padding:22px 26px;pointer-events:auto;animation:gcIn .4s ease both}
@keyframes gcIn{from{opacity:0}to{opacity:1}}
.g-catch.is-mid .gc-panel{left:50%;transform:translate(-50%,-50%);width:min(540px,calc(100% - 32px))}
.g-catch.is-port .gc-panel{left:16px;right:16px;top:auto;bottom:16px;transform:none;width:auto;max-height:66%}
.g-catch .eyebrow{font-size:18px}
.g-catch .gc-title{font-size:40px;line-height:1.05}
.g-catch .gc-p{margin:0;font-size:21px;color:var(--ink-2,#b9c0cf);line-height:1.35}
.g-catch .gc-p b{color:var(--gold,#f2b544);font-weight:600}
.g-catch .gc-levels{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.g-catch .gc-lv{-webkit-appearance:none;appearance:none;cursor:pointer;min-height:78px;padding:8px 6px;border-radius:16px;border:2px solid var(--line,rgba(255,255,255,.12));background:rgba(255,255,255,.04);color:var(--ink,#f3efe6);font-family:var(--font-display,system-ui);font-weight:600;font-size:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transition:border-color .2s,background-color .2s,transform .12s;touch-action:manipulation}
.g-catch .gc-lv small{font-family:var(--font-body,system-ui);font-weight:400;font-size:18px;color:var(--ink-2,#b9c0cf);line-height:1.15;text-align:center}
.g-catch .gc-lv:active{transform:scale(.97)}
.g-catch .gc-lv.on[data-l="cadet"]{border-color:var(--green,#6fe3a5);background:rgba(111,227,165,.15)}
.g-catch .gc-lv.on[data-l="pilot"]{border-color:var(--cyan,#5fd4ff);background:rgba(95,212,255,.15)}
.g-catch .gc-lv.on[data-l="commander"]{border-color:var(--gold,#f2b544);background:rgba(242,181,68,.15)}
.g-catch .gc-results .gc-lv{min-height:58px;font-size:20px}
.g-catch .gc-results .gc-lv small{display:none}
.g-catch .gc-go{width:100%}
.g-catch .gc-actions{display:flex;flex-direction:column;gap:12px}
.g-catch.is-narrow .gc-results .gc-actions,.g-catch.is-short .gc-results .gc-actions{order:1}
.g-catch.is-narrow .gc-results .gc-tip,.g-catch.is-short .gc-results .gc-tip,.g-catch.is-narrow .gc-results .gc-fact,.g-catch.is-short .gc-results .gc-fact{order:2}
.g-catch.is-narrow .gc-results .gc-line{font-size:21px}
.g-catch.is-narrow .gc-panel{max-height:calc(100% - 24px)}
.g-catch .gc-head{font-family:var(--font-display,system-ui);font-weight:700;font-size:56px;line-height:1;color:var(--ink,#f3efe6)}
.g-catch .gc-head.gold{color:var(--gold-2,#ffd27a)}
.g-catch .gc-head.cyan{color:var(--cyan,#5fd4ff)}
.g-catch .gc-line{margin:0;font-size:23px;line-height:1.3}
.g-catch .gc-chips{display:flex;gap:8px;flex-wrap:wrap}
.g-catch .gc-chips:empty{display:none}
.g-catch .gc-tip{margin:0;font-size:20px;color:var(--cyan,#5fd4ff);line-height:1.3}
.g-catch .gc-tip:empty{display:none}
.g-catch .gc-fact{display:flex;gap:14px;align-items:center;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid var(--line,rgba(255,255,255,.12))}
.g-catch .gc-fact .gc-k{display:block;color:var(--gold,#f2b544);margin-bottom:4px}
.g-catch .gc-fact p{margin:0;font-size:19px;line-height:1.35}
.g-catch .gc-fact > div{flex:1;min-width:0}
.g-catch .gc-stat{margin:0;font-size:19px;color:var(--ink-2,#b9c0cf);text-align:center}
.g-catch .gc-stat:empty{display:none}
.g-catch.is-mid .gc-stats{display:none}
.g-catch.is-mid .gc-hint{white-space:normal;font-size:21px}
.g-catch.is-port .gc-hint{bottom:166px;max-width:calc(100% - 32px);white-space:normal}
.g-catch.is-narrow .gc-gauges{width:208px;left:10px;top:10px;padding:10px 12px;gap:8px}
.g-catch.is-narrow .gc-num{font-size:30px}
.g-catch.is-narrow .gc-num small{font-size:18px;margin-left:3px}
.g-catch.is-narrow .gc-pct{font-size:22px}
.g-catch.is-narrow .gc-tr{right:10px;top:10px}
.g-catch.is-narrow .gc-stats{display:none}
.g-catch.is-narrow .gc-wind{padding:8px 10px;gap:6px;flex-direction:column;align-items:flex-start}
.g-catch.is-narrow .gc-wind svg{width:44px}
.g-catch.is-narrow .gc-wind b{min-width:0;font-size:18px}
.g-catch.is-narrow .gc-hint{bottom:128px;max-width:calc(100% - 24px);font-size:20px;white-space:normal}
.g-catch.is-narrow .gc-banner{font-size:50px}
.g-catch.is-narrow .gc-banner.small{font-size:38px}
.g-catch.is-narrow .gc-lr{width:96px;height:96px;border-radius:26px}
.g-catch.is-narrow .gc-btn{bottom:12px}
.g-catch.is-narrow .gc-left{left:12px}
.g-catch.is-narrow .gc-right{left:116px}
.g-catch.is-narrow .gc-thrust{width:116px;height:116px;right:12px;font-size:18px}
.g-catch.is-narrow .gc-panel{padding:16px 16px}
.g-catch.is-narrow .gc-head{font-size:44px}
.g-catch.is-narrow .gc-title{font-size:32px}
.g-catch.is-narrow .gc-lv{font-size:19px;min-height:70px}
.g-catch.is-short .gc-lr{width:96px;height:96px;border-radius:26px}
.g-catch.is-short .gc-btn{bottom:12px}
.g-catch.is-short .gc-right{left:122px}
.g-catch.is-short .gc-thrust{width:118px;height:118px}
.g-catch.is-short .gc-panel{padding:14px 20px;gap:10px}
.g-catch.is-short .gc-head{font-size:44px}
.g-catch.is-short .gc-title{font-size:32px}
.g-catch.is-short .gc-lv{min-height:62px}
.g-catch.is-short .gc-fact{padding:10px 14px}
.g-catch.is-short .gc-gauges{gap:8px;padding:10px 14px}
.g-catch.is-short .gc-num{font-size:34px}
@media (prefers-reduced-motion: reduce){
  .g-catch .gc-thrust.pulse:not(.on){animation:none;box-shadow:0 0 0 7px rgba(242,181,68,.5)}
  .g-catch .gc-banner.show{animation:gcIn .2s ease forwards}
  .g-catch .gc-fill.low{animation:none}
}
`;

const ICON = {
  left: '<svg viewBox="0 0 24 24" width="50" height="50" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4.5 7.5 12l7.5 7.5"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="50" height="50" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.5 16.5 12 9 19.5"/></svg>',
  flame: '<svg viewBox="0 0 24 24" width="36" height="36"><path fill="currentColor" d="M12 1.8c.9 3.4 5 5.6 5 10.6a5 5 0 0 1-10 0c0-2.5 1.3-4 2.5-5.2.1 2 1 3.2 2.1 3.6-.5-3-.3-6 .4-9z"/></svg>',
  speak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  wind: '<svg viewBox="0 0 60 24"><path d="M5 12h38" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M37 4l12 8-12 8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function levelButtons(compact) {
  return LEVEL_IDS.map((id) => `<button type="button" class="gc-lv" data-l="${id}" aria-pressed="false">${LEVELS[id].name}${compact ? '' : `<small>${LEVELS[id].blurb}</small>`}</button>`).join('');
}

const TEMPLATE = `
<canvas class="gc-cv" aria-label="Catch the Booster game"></canvas>
<div class="gc-hud off" data-r="hud">
  <div class="gc-gauges gc-box">
    <div>
      <div class="gc-row"><span class="gc-k">Speed</span><span class="gc-num" data-r="spdw"><span data-r="spd">0.0</span><small>m/s</small></span></div>
      <div class="gc-bar" style="margin-top:10px"><i class="gc-band" data-r="band"></i><i class="gc-mark" data-r="mark"></i></div>
      <div class="gc-bandlbl" style="margin-top:6px">slow enough</div>
    </div>
    <div>
      <div class="gc-row"><span class="gc-k">Fuel</span><span class="gc-pct" data-r="fuelpct">100%</span></div>
      <div class="gc-bar" style="margin-top:8px"><i class="gc-fill" data-r="fuel"></i></div>
    </div>
  </div>
  <div class="gc-tr">
    <div class="gc-wind gc-box"><span class="gc-k">Wind</span><span data-r="windsvg">${ICON.wind}</span><b data-r="windtxt">Calm</b></div>
    <div class="gc-stats"><span class="chip gold" data-r="catches"></span><span class="chip cyan" data-r="best"></span></div>
  </div>
  <div class="gc-hint" data-r="hint"></div>
</div>
<div class="gc-banner" data-r="banner"></div>
<div class="gc-ctl off" data-r="ctl">
  <button type="button" class="gc-btn gc-lr gc-left" data-k="left" aria-label="Steer left" tabindex="-1">${ICON.left}</button>
  <button type="button" class="gc-btn gc-lr gc-right" data-k="right" aria-label="Steer right" tabindex="-1">${ICON.right}</button>
  <button type="button" class="gc-btn gc-thrust" data-k="thrust" aria-label="Thrust" tabindex="-1">${ICON.flame}<span>THRUST</span></button>
</div>
<div class="card gc-panel gc-menu" data-r="menu">
  <div class="eyebrow">The booster is coming home</div>
  <h2 class="gc-title">Catch the Booster</h2>
  <p class="gc-p">Hold <b>THRUST</b> to slow down. Steer it between the arms.</p>
  <div class="gc-levels" data-r="lv1">${levelButtons(false)}</div>
  <button type="button" class="btn big gc-go" data-r="go">Fly!</button>
  <p class="gc-stat" data-r="statline"></p>
</div>
<div class="card gc-panel gc-results" data-r="results" hidden>
  <div class="eyebrow" data-r="reye">Test flight</div>
  <div class="gc-head" data-r="rhead"></div>
  <p class="gc-line" data-r="rline"></p>
  <div class="gc-chips" data-r="rchips"></div>
  <p class="gc-tip" data-r="rtip"></p>
  <div class="gc-fact"><div><span class="gc-k">Did you know?</span><p data-r="fact"></p></div><button type="button" class="speak-btn" data-r="factsay" aria-label="Read the fact aloud">${ICON.speak}</button></div>
  <div class="gc-actions">
    <div class="gc-levels" data-r="lv2">${levelButtons(true)}</div>
    <button type="button" class="btn big gc-go" data-r="again">Try again</button>
  </div>
</div>
`;

function injectStyle() {
  let st = document.querySelector('style[data-module="catch"]');
  if (!st) {
    st = document.createElement('style');
    st.setAttribute('data-module', 'catch');
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  st.dataset.users = String((+st.dataset.users || 0) + 1);
  return st;
}

function makeSprite(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}
function makeStar(size, col, glow) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const m = size / 2;
  const gr = g.createRadialGradient(m, m, 0, m, m, m);
  gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  g.fillStyle = col;
  g.beginPath();
  const a = m * 0.95, b = m * 0.16;
  g.moveTo(m, m - a);
  g.quadraticCurveTo(m + b, m - b, m + a, m);
  g.quadraticCurveTo(m + b, m + b, m, m + a);
  g.quadraticCurveTo(m - b, m + b, m - a, m);
  g.quadraticCurveTo(m - b, m - b, m, m - a);
  g.fill();
  g.beginPath(); g.arc(m, m, m * 0.14, 0, TAU); g.fillStyle = '#ffffff'; g.fill();
  return c;
}

// =====================================================================================
export async function mount(el, ctx) {
  ctx = ctx || {};
  const data = ctx.data && typeof ctx.data === 'object' ? ctx.data : {};
  let destroyed = false;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (!destroyed) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const call = (name, ...a) => {
    try { if (typeof ctx[name] === 'function') return ctx[name](...a); } catch (e) { console.warn('[catch]', name, e); }
    return undefined;
  };
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

  // ---------- debug params ----------
  let qs;
  try { qs = new URLSearchParams(location.search); } catch (e) { qs = new URLSearchParams(''); }
  const DBG = {
    state: qs.get('debugState'),
    level: LEVELS[qs.get('debugLevel')] ? qs.get('debugLevel') : null,
    auto: qs.get('debugAutopilot') === '1',
    rounds: Math.max(1, +qs.get('debugRounds') || 3),
    sim: qs.get('debugSim') === '1',
    simN: Math.max(10, +qs.get('debugSimN') || 300),
    noCard: qs.get('debugNoCard') === '1',
    pauseAt: qs.has('debugPauseAt') ? +qs.get('debugPauseAt') : null,
    timer: qs.get('debugTimer') === '1', // drive the loop with setTimeout (headless virtual time)
  };

  // ---------- saved stats ----------
  const facts = (Array.isArray(data.facts) ? data.facts.filter((f) => typeof f === 'string' && f.trim()) : []);
  const FACTS = facts.length ? facts : DEFAULT_FACTS;
  let catches = Math.max(0, Math.round(num(call('load', 'catches')) || 0));
  let best = num(call('load', 'best'));
  let bestLevel = call('load', 'bestLevel');
  let factIdx = Math.max(0, Math.round(num(call('load', 'factIdx')) || 0));
  let level = DBG.level || (LEVELS[data.level] ? data.level : 'cadet');

  const reduceMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  // ---------- DOM ----------
  const styleEl = injectStyle();
  const root = document.createElement('div');
  root.className = 'g-catch';
  root.innerHTML = TEMPLATE;
  el.appendChild(root);
  const $ = (r) => root.querySelector(`[data-r="${r}"]`);
  const cv = root.querySelector('.gc-cv');
  // (debugTimer also asks for a software canvas so headless screenshots work without a GPU)
  const g2 = cv.getContext('2d', DBG.timer ? { alpha: false, willReadFrequently: true } : { alpha: false }) || cv.getContext('2d');
  const hud = $('hud'), ctl = $('ctl'), menu = $('menu'), results = $('results'), bannerEl = $('banner'), hintEl = $('hint');
  const ui = {
    spd: $('spd'), spdw: $('spdw'), band: $('band'), mark: $('mark'), fuel: $('fuel'), fuelpct: $('fuelpct'),
    windsvg: $('windsvg'), windtxt: $('windtxt'), catches: $('catches'), best: $('best'), statline: $('statline'),
  };
  const btnEls = Array.from(root.querySelectorAll('.gc-btn'));
  const btnByKey = {};
  for (const b of btnEls) btnByKey[b.dataset.k] = b;

  // ---------- canvas sizing ----------
  let W = 0, H = 0, dpr = 1, hudBottomFrac = 0.2;
  const sky = document.createElement('canvas');
  const vign = document.createElement('canvas');
  const spr = {
    warm: makeSprite(64, [[0, 'rgba(255,246,220,1)'], [0.22, 'rgba(255,205,120,0.8)'], [0.55, 'rgba(242,135,60,0.28)'], [1, 'rgba(242,100,40,0)']]),
    smoke: makeSprite(64, [[0, 'rgba(126,122,138,0.95)'], [0.45, 'rgba(108,104,122,0.55)'], [1, 'rgba(96,92,110,0)']]),
    steam: makeSprite(64, [[0, 'rgba(236,239,246,0.95)'], [0.45, 'rgba(222,228,238,0.5)'], [1, 'rgba(220,226,236,0)']]),
    glow: makeSprite(64, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]),
    red: makeSprite(32, [[0, 'rgba(255,160,140,1)'], [0.3, 'rgba(255,107,87,0.6)'], [1, 'rgba(255,107,87,0)']]),
    drop: makeSprite(16, [[0, 'rgba(240,248,255,1)'], [0.5, 'rgba(200,225,255,0.7)'], [1, 'rgba(200,225,255,0)']]),
    starG: makeStar(64, '#ffe7a8', 'rgba(242,181,68,0.55)'),
    starC: makeStar(64, '#c8f1ff', 'rgba(95,212,255,0.5)'),
    starW: makeStar(64, '#ffffff', 'rgba(255,255,255,0.45)'),
  };

  function buildSky() {
    const w = cv.width, h = cv.height;
    if (!w || !h) return;
    sky.width = w; sky.height = h;
    const g = sky.getContext('2d');
    const hy = Math.round(h * (1 - G.BF));
    const gr = g.createLinearGradient(0, 0, 0, hy);
    gr.addColorStop(0, '#04060f');
    gr.addColorStop(0.28, '#0a1029');
    gr.addColorStop(0.52, '#1b1c44');
    gr.addColorStop(0.72, '#3a2b57');
    gr.addColorStop(0.86, '#743f60');
    gr.addColorStop(0.95, '#c06a5a');
    gr.addColorStop(1, '#e89c64');
    g.fillStyle = gr; g.fillRect(0, 0, w, hy + 1);
    g.fillStyle = '#0b0d16'; g.fillRect(0, hy, w, h - hy);
    const RR = Math.max(w, h);
    let rg = g.createRadialGradient(w * 0.12, hy, 0, w * 0.12, hy, RR * 0.72);
    rg.addColorStop(0, 'rgba(255,205,120,0.62)');
    rg.addColorStop(0.16, 'rgba(250,160,90,0.32)');
    rg.addColorStop(0.42, 'rgba(190,90,110,0.12)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, hy);
    rg = g.createRadialGradient(w * 0.92, hy * 0.7, 0, w * 0.92, hy * 0.7, RR * 0.5);
    rg.addColorStop(0, 'rgba(95,130,210,0.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, hy);
    const rnd = mulberry32(7);
    const n = Math.min(340, Math.round((w * h) / (dpr * dpr) / 2400));
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, yy = Math.pow(rnd(), 1.7) * hy * 0.78;
      const a = (1 - yy / (hy * 0.78)) * (0.25 + rnd() * 0.65);
      const r = (0.45 + rnd() * rnd() * 1.3) * dpr;
      const tint = rnd();
      g.globalAlpha = a;
      g.fillStyle = tint < 0.15 ? '#ffe6b8' : tint < 0.3 ? '#cfe6ff' : '#ffffff';
      g.beginPath(); g.arc(x, yy, r, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 7; i++) {
      const cx = rnd() * w, cy = hy * (0.52 + rnd() * 0.36), cw = w * (0.12 + rnd() * 0.26), chh = h * (0.005 + rnd() * 0.012);
      const warm = 1 - cx / w;
      const cg = g.createLinearGradient(0, cy - chh, 0, cy + chh);
      cg.addColorStop(0, 'rgba(60,50,90,0)');
      cg.addColorStop(0.6, `rgba(${Math.round(150 + 95 * warm)},${Math.round(92 + 55 * warm)},${Math.round(125 - 25 * warm)},${(0.16 + 0.22 * warm).toFixed(2)})`);
      cg.addColorStop(1, 'rgba(60,50,90,0)');
      g.fillStyle = cg;
      g.beginPath(); g.ellipse(cx, cy, cw / 2, chh, 0, 0, TAU); g.fill();
    }
    // distant shore and buildings to the west (left)
    g.fillStyle = '#16131e';
    g.beginPath(); g.moveTo(0, hy + 1);
    let x = 0;
    const shoreEnd = w * 0.46;
    while (x < shoreEnd) {
      const bh = (rnd() * 0.01 + 0.003) * h * (1 - (x / shoreEnd) * 0.85);
      g.lineTo(x, hy - bh);
      x += w * (0.01 + rnd() * 0.03);
    }
    g.lineTo(shoreEnd, hy + 1); g.closePath(); g.fill();
    for (let i = 0; i < 6; i++) {
      const bx = w * (0.03 + rnd() * 0.3), bw = w * (0.012 + rnd() * 0.03), bh = h * (0.01 + rnd() * 0.028);
      g.fillStyle = '#19162a'; g.fillRect(bx, hy - bh, bw, bh + 1);
      g.fillStyle = 'rgba(255,214,150,0.85)';
      for (let k = 0; k < 4; k++) if (rnd() < 0.7) g.fillRect(bx + rnd() * bw, hy - bh * (0.2 + 0.7 * rnd()), 1.3 * dpr, 1.3 * dpr);
    }
    const hz = g.createLinearGradient(0, hy - h * 0.06, 0, hy);
    hz.addColorStop(0, 'rgba(255,170,120,0)'); hz.addColorStop(1, 'rgba(255,170,120,0.16)');
    g.fillStyle = hz; g.fillRect(0, hy - h * 0.06, w, h * 0.06);

    vign.width = w; vign.height = h;
    const vg = vign.getContext('2d');
    const vr = vg.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.hypot(w, h) * 0.62);
    vr.addColorStop(0, 'rgba(0,0,0,0)'); vr.addColorStop(1, 'rgba(2,3,10,0.42)');
    vg.fillStyle = vr; vg.fillRect(0, 0, w, h);
  }

  function resize() {
    if (destroyed) return;
    const w = Math.max(1, Math.round(el.clientWidth || root.clientWidth));
    const h = Math.max(1, Math.round(el.clientHeight || root.clientHeight));
    const nd = Math.min(2, window.devicePixelRatio || 1);
    if (w === W && h === H && nd === dpr && cv.width) return;
    W = w; H = h; dpr = nd;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const port = H > W * 1.05;
    root.classList.toggle('is-port', port);
    root.classList.toggle('is-narrow', W < 560);
    root.classList.toggle('is-short', H < 540);
    root.classList.toggle('is-mid', !port && W < 860);
    const gauges = root.querySelector('.gc-gauges');
    hudBottomFrac = gauges ? (gauges.offsetTop + gauges.offsetHeight + 10) / H : 0.2;
    buildSky();
    if (!raf && !document.hidden) render();
  }

  // ---------- game state ----------
  let mode = 'menu'; // menu | fly | outcome | results
  let cfg = LEVELS[level];
  let s = null; // physics state during flight
  let out = null; // outcome script state
  let b = null; // booster visual {x, y, ang, pivot, alpha, flame}
  let armsClose = 0, armsTol = cfg.tol;
  let roundNo = 0;
  let paused = false; // debug freeze
  let freezeFlight = false; // debug: hold the booster still in flight
  let autopilot = null;
  let autoLog = [];
  let hintUntil = 0, startHint = '';
  let time = 0;
  const parts = [];
  const shake = { t: 0, dur: 0, amp: 0 };
  const cam = { cx: 0, vh: G.VH0 };
  let rcsAcc = 0, exhAcc = 0, sparkleUntil = 0, smokeUntil = 0, popGlow = 0, popAt = null;

  // ---------- audio (WebAudio synth, only if ctx.sound) ----------
  const audio = (() => {
    let ac = null, master = null, engGain = null, engSrc = null, white = null, lastRcs = 0;
    const on = () => !!ctx.sound && !destroyed;
    function unlock() {
      if (!on()) return;
      try {
        if (!ac) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ac = new AC();
          master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
          const len = Math.floor(ac.sampleRate * 2);
          const brown = ac.createBuffer(1, len, ac.sampleRate);
          const d = brown.getChannelData(0);
          let last = 0;
          for (let i = 0; i < len; i++) { const wv = Math.random() * 2 - 1; last = (last + 0.02 * wv) / 1.02; d[i] = last * 3.5; }
          white = ac.createBuffer(1, Math.floor(ac.sampleRate * 1.5), ac.sampleRate);
          const wd = white.getChannelData(0);
          for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
          engSrc = ac.createBufferSource(); engSrc.buffer = brown; engSrc.loop = true;
          const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 0.7;
          engGain = ac.createGain(); engGain.gain.value = 0;
          engSrc.connect(lp); lp.connect(engGain); engGain.connect(master);
          engSrc.start();
        }
        if (ac.state === 'suspended' && !document.hidden) ac.resume().catch(() => {});
      } catch (e) { ac = null; }
    }
    function burst(type, freq, q, dur, gain, attack = 0.005, when = 0) {
      if (!ac || !white) return;
      const t = ac.currentTime + when;
      const src = ac.createBufferSource(); src.buffer = white;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const gn = ac.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(gain, t + attack);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(gn); gn.connect(master);
      src.start(t); src.stop(t + dur + 0.05);
    }
    function tone(type, f0, f1, dur, gain, when = 0) {
      if (!ac) return;
      const t = ac.currentTime + when;
      const o = ac.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const gn = ac.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    }
    return {
      unlock,
      engine(level) { if (ac && engGain) try { engGain.gain.setTargetAtTime(clamp(level, 0, 1) * 0.55, ac.currentTime, 0.07); } catch (e) {} },
      clunk() {
        if (!ac) return;
        tone('sine', 120, 46, 0.42, 0.6);
        [430, 652, 1003, 1517].forEach((f, i) => tone('triangle', f, f * 0.995, 0.5 + i * 0.12, 0.07 / (1 + i * 0.5)));
        burst('bandpass', 2300, 1.4, 0.07, 0.22);
      },
      chime() { if (!ac) return; [1047, 1319, 1568, 2093].forEach((f, i) => tone('sine', f, f, 0.6, 0.055, 0.12 + i * 0.09)); },
      thump() { if (!ac) return; burst('lowpass', 380, 0.7, 0.9, 0.45, 0.02); tone('sine', 70, 38, 0.6, 0.45); },
      splash(p) { if (!ac) return; burst('bandpass', 1100, 0.5, 0.9 + 0.5 * p, 0.12 + 0.18 * p, 0.03); burst('lowpass', 300, 0.6, 0.6, 0.18 * p + 0.06, 0.02); },
      rcs() { if (!ac) return; const t = ac.currentTime; if (t - lastRcs < 0.16) return; lastRcs = t; burst('highpass', 3200, 0.7, 0.09, 0.035); },
      suspend() { if (ac && ac.state === 'running') ac.suspend().catch(() => {}); },
      resume() { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); },
      close() {
        try { if (engSrc) engSrc.stop(); } catch (e) {}
        try { if (ac) ac.close(); } catch (e) {}
        ac = null; engGain = null;
      },
    };
  })();

  // ---------- inputs (multi-touch pads + keyboard) ----------
  const pads = { thrust: false, left: false, right: false };
  const keys = { thrust: false, left: false, right: false };
  const ptrs = new Map();
  function recomputePads() {
    const next = { thrust: false, left: false, right: false };
    if (ptrs.size && mode === 'fly') {
      for (const bt of btnEls) {
        const r = bt.getBoundingClientRect();
        const pad = 14;
        for (const p of ptrs.values()) {
          if (p.x >= r.left - pad && p.x <= r.right + pad && p.y >= r.top - pad && p.y <= r.bottom + pad) { next[bt.dataset.k] = true; break; }
        }
      }
    }
    for (const k in next) {
      if (next[k] !== pads[k]) { pads[k] = next[k]; btnByKey[k].classList.toggle('on', next[k]); }
    }
  }
  function onPDown(e) {
    const bt = e.target && e.target.closest ? e.target.closest('.gc-btn') : null;
    if (!bt) return;
    e.preventDefault();
    try { bt.setPointerCapture(e.pointerId); } catch (err) {}
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    audio.unlock();
    recomputePads();
  }
  function onPMove(e) {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    recomputePads();
  }
  function onPUp(e) { if (ptrs.delete(e.pointerId)) recomputePads(); }
  function clearInputs() {
    ptrs.clear();
    keys.thrust = keys.left = keys.right = false;
    recomputePads();
  }
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'thrust', ArrowUp: 'thrust', KeyW: 'thrust' };
  function onKey(e, down) {
    if (destroyed || !root.isConnected) return;
    const k = KEYMAP[e.code];
    if (mode === 'fly' || mode === 'outcome') {
      if (k) { keys[k] = down; e.preventDefault(); if (down) audio.unlock(); }
      return;
    }
    if (!down || e.repeat) return;
    const t = e.target;
    const inField = t && t.closest && t.closest('button, input, textarea, select, a, [contenteditable="true"]');
    if ((e.code === 'Enter' || e.code === 'Space') && !inField && (mode === 'menu' || mode === 'results')) {
      e.preventDefault();
      audio.unlock();
      startRound();
    }
  }
  const onKeyDown = (e) => onKey(e, true);
  const onKeyUp = (e) => onKey(e, false);
  const onBlur = () => clearInputs();
  const onCtx = (e) => e.preventDefault();
  const onSelect = (e) => { if (!(e.target && e.target.closest && e.target.closest('input,textarea'))) e.preventDefault(); };

  ctl.addEventListener('pointerdown', onPDown);
  ctl.addEventListener('pointermove', onPMove);
  ctl.addEventListener('pointerup', onPUp);
  ctl.addEventListener('pointercancel', onPUp);
  ctl.addEventListener('lostpointercapture', onPUp);
  root.addEventListener('contextmenu', onCtx);
  root.addEventListener('selectstart', onSelect);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // Panel buttons
  function setLevel(id) {
    if (!LEVELS[id]) return;
    level = id;
    for (const bt of root.querySelectorAll('.gc-lv')) {
      const onNow = bt.dataset.l === id;
      bt.classList.toggle('on', onNow);
      bt.setAttribute('aria-pressed', onNow ? 'true' : 'false');
    }
  }
  function onClick(e) {
    const t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    const lv = t.closest('.gc-lv');
    if (lv) { audio.unlock(); setLevel(lv.dataset.l); return; }
    const go = t.closest('[data-r="go"], [data-r="again"]');
    if (go) { audio.unlock(); startRound(); return; }
    const say = t.closest('[data-r="factsay"]');
    if (say) { call('speak', $('fact').textContent); }
  }
  root.addEventListener('click', onClick);
  setLevel(level);

  // ---------- HUD helpers ----------
  const hudCache = {};
  function setText(node, key, txt) { if (hudCache[key] !== txt) { hudCache[key] = txt; node.textContent = txt; } }
  function setCls(node, key, cls) { if (hudCache[key] !== cls) { hudCache[key] = cls; node.className = cls; } }
  function updateStatsUi() {
    ui.catches.textContent = `Catches: ${catches}`;
    ui.best.textContent = best != null ? `Softest: ${best.toFixed(1)} m/s` : 'Softest: none yet';
    ui.statline.textContent = catches > 0
      ? `Catches so far: ${catches}${best != null ? `  ·  Softest: ${best.toFixed(1)} m/s` : ''}`
      : '';
  }
  updateStatsUi();

  function showHint(txt, cls) {
    if (!txt) { setCls(hintEl, 'hintc', 'gc-hint'); return; }
    setText(hintEl, 'hint', txt);
    setCls(hintEl, 'hintc', `gc-hint show ${cls || ''}`);
  }
  function showBanner(txt, cls) {
    bannerEl.textContent = txt;
    bannerEl.className = 'gc-banner';
    void bannerEl.offsetWidth; // restart animation
    bannerEl.className = `gc-banner show ${cls || ''}`;
  }
  function hideBanner() { bannerEl.className = 'gc-banner'; }

  function updateHud() {
    if (!s || !cfg) return;
    const v = s.vy;
    const up = v < -0.3;
    setText(ui.spd, 'spd', (up ? '↑ ' : '') + Math.abs(v).toFixed(1));
    setCls(ui.spdw, 'spdc', 'gc-num' + (up ? ' up' : v <= cfg.vCatch + 0.049 ? ' ok' : v <= cfg.vCatch * 2 ? ' warn' : ''));
    const vmax = cfg.vTerm * 1.05;
    setText({ set textContent(x) { ui.mark.style.left = x; } }, 'mark', (clamp(Math.max(0, v) / vmax, 0, 1) * 100).toFixed(1) + '%');
    setText({ set textContent(x) { ui.band.style.width = x; } }, 'band', ((cfg.vCatch / vmax) * 100).toFixed(1) + '%');
    const fp = clamp(s.fuel / cfg.fuel, 0, 1);
    setText(ui.fuelpct, 'fuelpct', Math.ceil(fp * 100) + '%');
    setText({ set textContent(x) { ui.fuel.style.width = x; } }, 'fuel', (fp * 100).toFixed(1) + '%');
    setCls(ui.fuel, 'fuelc', 'gc-fill' + (fp < 0.2 ? ' low' : ''));
    const w = s.windNow || 0, aw = Math.abs(w);
    setText(ui.windtxt, 'windt', aw < 0.3 ? 'Calm' : aw < 1.8 ? 'Breezy' : aw < 3.4 ? 'Windy' : 'Very windy');
    const sc = aw < 0.3 ? 0 : clamp(0.55 + aw / 6, 0.6, 1.25);
    setText({ set textContent(x) { ui.windsvg.firstElementChild.style.transform = x; } }, 'winds', `scaleX(${(w < 0 ? -1 : 1) * sc})`);
    setText({ set textContent(x) { ui.windsvg.style.display = x; } }, 'windo', aw < 0.3 ? 'none' : '');

    // coaching hints
    let hTxt = '', hCls = '';
    const h = s.y + G.PIN - G.ARM_Y;
    if (mode === 'fly') {
      if (time < hintUntil) { hTxt = startHint; hCls = 'cyan'; }
      else if (cfg.hints && s.needBrake) { hTxt = 'Hold THRUST to slow down!'; hCls = 'gold'; }
      else if (cfg.hints && !cfg.assist && v < -0.8 && s.thrust) { hTxt = 'Going up! Let go of THRUST.'; hCls = 'cyan'; }
      else if (fp < 0.2) { hTxt = 'Low fuel!'; hCls = 'red'; }
      else if (cfg.hints && h < 40 && Math.abs(s.x) > cfg.tol) { hTxt = 'Steer into the gap!'; hCls = 'cyan'; }
    }
    showHint(hTxt, hCls);
    btnByKey.thrust.classList.toggle('pulse', mode === 'fly' && cfg.hints && s.needBrake);
  }

  // ---------- particles ----------
  const MAXP = reduceMotion ? 260 : 520;
  function addP(p) {
    if (parts.length >= MAXP) return null;
    p.age = 0;
    if (p.drag == null) p.drag = 0;
    if (p.grav == null) p.grav = 0;
    if (p.windK == null) p.windK = 0;
    parts.push(p);
    return p;
  }
  const R01 = Math.random;
  const U = (a, bb) => a + R01() * (bb - a);
  function groundAt(x) { return Math.abs(x) < G.OLM_HW ? G.OLM_TOP : 0; }
  function curWind() { return mode === 'fly' || mode === 'outcome' ? (s ? s.windNow : 0) : 0; }

  function localToWorld(bb, lx, ly) {
    const ca = Math.cos(bb.ang), sa = Math.sin(bb.ang);
    const yy = ly - bb.pivot;
    return [bb.x + lx * ca - yy * sa, bb.y + bb.pivot + lx * sa + yy * ca];
  }

  function spawnExhaust(dt, bvx, bvy) {
    const rate = (reduceMotion ? 30 : 70) * b.flame;
    exhAcc += rate * dt;
    const dir = [Math.sin(b.ang), -Math.cos(b.ang)];
    while (exhAcc >= 1) {
      exhAcc -= 1;
      const [px, py] = localToWorld(b, U(-1.6, 1.6), -3 - R01() * 4);
      const sp = U(32, 52);
      addP({
        x: px, y: py, vx: bvx + dir[0] * sp + U(-3, 3), vy: bvy + dir[1] * sp, life: U(0.45, 0.85),
        s0: U(3, 4.5), s1: U(9, 14), drag: 1.6, sprA: spr.warm, aA: 0.8, fo: 0.45, sprN: spr.smoke, aN: 0.3, fi: 0.35,
        hit: true, windK: 0.6,
      });
    }
  }
  function spawnRcs(dt) {
    if (!s || !s.steer) return;
    rcsAcc += dt;
    if (rcsAcc < 0.055) return;
    rcsAcc = 0;
    const side = -s.steer; // thrusters on the opposite side fire outward
    for (let i = 0; i < 2; i++) {
      const [px, py] = localToWorld(b, side * (G.R + 0.4), 57.5 - i * 1.6);
      addP({ x: px, y: py, vx: side * U(10, 16) + s.vx, vy: -s.vy + U(-1, 1), life: U(0.35, 0.55), s0: 0.7, s1: U(3.2, 4.4), drag: 4, sprN: spr.steam, aN: 0.6, fi: 0.1 });
    }
    audio.rcs();
  }
  function steamPuff(x, y, n, spread, up) {
    for (let i = 0; i < n; i++) addP({ x: x + U(-spread, spread), y: y + U(-1, 2), vx: U(-6, 6), vy: U(0, up), life: U(1.2, 2.2), s0: U(3, 5), s1: U(10, 16), drag: 1.2, sprN: spr.steam, aN: 0.42, fi: 0.15, windK: 0.4 });
  }
  function sparkles(x, y, n, speed) {
    const sprs = [spr.starG, spr.starC, spr.starG, spr.starW, spr.starG];
    for (let i = 0; i < n; i++) {
      const a = R01() * TAU, sp = U(speed * 0.3, speed);
      addP({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 4, life: U(0.9, 1.9), s0: U(3.5, 6.5), s1: U(0.8, 1.6), drag: 1.4, grav: 3, sprA: sprs[i % 5], aA: 1, fo: 1, tw: R01() * TAU });
    }
  }
  function splashFx(x, power) {
    const nd = Math.round((reduceMotion ? 22 : 45) + 55 * power);
    for (let i = 0; i < nd; i++) {
      addP({ x: x + U(-5, 5), y: 0.5, vx: U(-14, 14) * (0.6 + power), vy: U(9, 28) * (0.5 + power), life: 3.5, s0: U(1, 2), s1: U(0.8, 1.6), grav: 9.8, drag: 0.15, sprN: spr.drop, aN: 0.9, fi: 0, water: true });
    }
    for (let i = 0; i < 9; i++) addP({ x: x + U(-9, 9), y: U(1, 6), vx: U(-5, 5), vy: U(2, 7) * (0.5 + power), life: U(1.6, 2.6), s0: U(7, 12), s1: U(18, 28) * (0.6 + power), drag: 0.9, sprN: spr.steam, aN: 0.5, fi: 0.08, windK: 0.4 });
    for (let i = 0; i < 3; i++) addP({ ring: true, x, y: -0.8, delay: i * 0.28, life: 2.4 + i * 0.28, s0: 3, s1: 26 + 22 * power });
  }
  function popFx(bx, by) {
    const n = reduceMotion ? 5 : 8;
    for (let i = 0; i < n; i++) {
      addP({
        x: bx + U(-5, 5), y: by + U(4, 42), vx: U(-3, 3), vy: U(1, 4), life: U(2.4, 3.6),
        s0: U(9, 14), s1: U(26, 38), drag: 0.6, sprA: spr.warm, aA: 0.95, fo: 0.32, sprN: spr.smoke, aN: 0.78, fi: 0.12, windK: 0.5, delay: i * 0.05,
      });
    }
    steamPuff(bx, G.OLM_TOP + 2, 10, 14, 3);
    popGlow = 1;
    popAt = [bx, by + 20];
  }

  function updateParticles(dt) {
    const w = curWind();
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      if (p.age >= p.life || (p.water && p.y < -0.4 && p.age > 0.1)) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      if (p.ring) continue;
      const k = Math.exp(-p.drag * dt);
      p.vx = p.vx * k + w * p.windK * dt;
      p.vy = p.vy * k - p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.hit) {
        const gy = groundAt(p.x);
        if (p.y < gy && p.y > gy - 6) {
          p.y = gy + 0.3;
          const dirx = b ? Math.sign(p.x - b.x) || (R01() < 0.5 ? -1 : 1) : 1;
          p.vx = dirx * U(14, 30); p.vy = U(0.5, 4);
          p.hit = false; p.aA *= 0.5; p.aN = 0.42; p.sprN = spr.steam; p.s1 *= 1.8; p.life = Math.max(p.life, p.age + U(0.8, 1.4));
        }
      }
    }
  }

  function drawParticles(c, additive) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.delay > 0 || p.ring) continue;
      const k = p.age / p.life;
      const size = p.s0 + (p.s1 - p.s0) * (p.sprA === spr.starG || p.sprA === spr.starC || p.sprA === spr.starW ? k : Math.sqrt(k));
      if (additive) {
        if (!p.sprA) continue;
        let a = p.aA * Math.max(0, 1 - k / (p.fo || 1));
        if (p.tw != null) a *= 0.6 + 0.4 * Math.sin(p.tw + p.age * 18);
        if (a <= 0.01) continue;
        c.globalAlpha = Math.min(1, a);
        c.drawImage(p.sprA, p.x - size / 2, p.y - size / 2, size, size);
      } else {
        if (!p.sprN) continue;
        const fi = p.fi || 0.0001;
        const a = p.aN * Math.min(1, k / fi) * (1 - k);
        if (a <= 0.01) continue;
        c.globalAlpha = a;
        c.drawImage(p.sprN, p.x - size / 2, p.y - size / 2, size, size);
      }
    }
    c.globalAlpha = 1;
  }
  function drawRings(c) {
    c.lineWidth = 0.5;
    for (const p of parts) {
      if (!p.ring || p.delay > 0) continue;
      const k = p.age / p.life;
      const rx = p.s0 + (p.s1 - p.s0) * easeOut(k);
      c.strokeStyle = `rgba(225,236,255,${(0.55 * (1 - k)).toFixed(3)})`;
      c.beginPath(); c.ellipse(p.x, p.y - rx * 0.05, rx, rx * 0.16, 0, 0, TAU); c.stroke();
    }
  }

  // ---------- drawing: scene ----------
  const steelGrad = g2.createLinearGradient(-G.R, 0, G.R, 0);
  steelGrad.addColorStop(0, '#5d6470'); steelGrad.addColorStop(0.1, '#8e95a0'); steelGrad.addColorStop(0.27, '#dfe4ea');
  steelGrad.addColorStop(0.36, '#f1f4f7'); steelGrad.addColorStop(0.5, '#c9ced6'); steelGrad.addColorStop(0.75, '#959ca7');
  steelGrad.addColorStop(0.92, '#6c727d'); steelGrad.addColorStop(1, '#4a4f58');
  const skirtGrad = g2.createLinearGradient(-G.R, 0, G.R, 0);
  skirtGrad.addColorStop(0, '#3a3e46'); skirtGrad.addColorStop(0.32, '#7c828c'); skirtGrad.addColorStop(0.6, '#5a5f68'); skirtGrad.addColorStop(1, '#2e3138');
  const sootGrad = g2.createLinearGradient(0, 0, 0, 16);
  sootGrad.addColorStop(0, 'rgba(28,24,22,0.62)'); sootGrad.addColorStop(1, 'rgba(28,24,22,0)');
  const flameGrad = g2.createLinearGradient(0, 0, 0, -1);
  flameGrad.addColorStop(0, 'rgba(255,250,232,0.95)'); flameGrad.addColorStop(0.12, 'rgba(255,216,128,0.92)');
  flameGrad.addColorStop(0.45, 'rgba(244,150,62,0.6)'); flameGrad.addColorStop(1, 'rgba(240,100,40,0)');
  const plumeGrad = g2.createLinearGradient(0, 0, 0, -1);
  plumeGrad.addColorStop(0, 'rgba(255,190,90,0.55)'); plumeGrad.addColorStop(0.35, 'rgba(242,140,60,0.32)');
  plumeGrad.addColorStop(0.75, 'rgba(200,90,60,0.1)'); plumeGrad.addColorStop(1, 'rgba(160,70,60,0)');
  const coreGrad = g2.createLinearGradient(0, 0, 0, -1);
  coreGrad.addColorStop(0, 'rgba(225,240,255,0.95)'); coreGrad.addColorStop(1, 'rgba(255,230,180,0)');
  const lightGrad = g2.createLinearGradient(0, 0, 0, 10);
  lightGrad.addColorStop(0, 'rgba(255,170,80,0.38)'); lightGrad.addColorStop(1, 'rgba(255,170,80,0)');
  const streaks = [];
  { const r = mulberry32(11); for (let i = 0; i < 30; i++) streaks.push([lerp(-G.R + 0.3, G.R - 0.3, r()), 4 + r() * 50, 6 + r() * 20, 0.04 + r() * 0.08, r() < 0.5]); }
  const scrub = [];
  { const r = mulberry32(5); let x = G.PAD_L - 2; scrub.push([x, 0.2]); while (x > -900) { x -= 2 + r() * 6; scrub.push([x, r() < 0.25 ? 1.2 + r() * 1.4 : 0.25 + r() * 0.7]); } }
  const shimmer = [];
  { const r = mulberry32(3); for (let i = 0; i < 40; i++) shimmer.push([G.SEA_X + 6 + r() * 600, Math.pow(r(), 1.6), 3 + r() * 14, r() * TAU, r()]); }

  function drawTower(c) {
    const hw = G.TOWER_HW, TH = G.TOWER_H;
    c.fillStyle = 'rgba(10,13,22,0.66)';
    c.fillRect(-hw, 0, hw * 2, TH);
    c.strokeStyle = 'rgba(80,92,120,0.32)'; c.lineWidth = 0.32;
    c.beginPath();
    for (let y = 0; y < TH - 1; y += 10) { c.moveTo(-hw + 2, y + 5); c.lineTo(hw - 2, y + 15); c.moveTo(hw - 2, y + 5); c.lineTo(-hw + 2, y + 15); }
    c.stroke();
    c.strokeStyle = '#2f3850'; c.lineWidth = 0.6;
    c.beginPath();
    for (let y = 0; y < TH - 1; y += 10) {
      const y1 = Math.min(TH, y + 10);
      c.moveTo(-hw, y); c.lineTo(hw, y1); c.moveTo(hw, y); c.lineTo(-hw, y1);
      c.moveTo(-hw, y1); c.lineTo(hw, y1);
    }
    c.stroke();
    const colW = 1.9;
    c.fillStyle = '#262e42';
    c.fillRect(-hw, 0, colW, TH); c.fillRect(hw - colW, 0, colW, TH);
    c.fillStyle = 'rgba(255,186,120,0.38)'; c.fillRect(-hw, 0, 0.45, TH);
    c.fillStyle = 'rgba(255,186,120,0.16)'; c.fillRect(hw - colW, 0, 0.35, TH);
    c.fillStyle = 'rgba(140,170,230,0.22)'; c.fillRect(hw - 0.35, 0, 0.35, TH);
    c.fillStyle = '#2b3348'; c.fillRect(-hw - 1.2, TH - 1.4, hw * 2 + 2.4, 1.8);
    c.fillStyle = 'rgba(255,186,120,0.3)'; c.fillRect(-hw - 1.2, TH + 0.2, hw * 2 + 2.4, 0.25);
    c.fillStyle = '#262e42';
    c.fillRect(-0.5, TH, 1, 9); c.fillRect(-4, TH, 0.6, 4); c.fillRect(3.4, TH, 0.6, 4);
    // lights
    c.globalCompositeOperation = 'lighter';
    const blink = 0.45 + 0.45 * Math.sin(time * 2.4);
    c.globalAlpha = blink; c.drawImage(spr.red, -2.5, TH + 7, 5, 5);
    c.globalAlpha = blink * 0.8; c.drawImage(spr.red, -hw - 2.2, TH - 1, 4, 4); c.drawImage(spr.red, hw - 1.8, TH - 1, 4, 4);
    c.globalAlpha = 0.55;
    for (const [lx, ly] of [[-hw + 1, 30], [hw - 1, 52], [-hw + 1, 74], [hw - 1, 108], [-hw + 1, 118]]) c.drawImage(spr.glow, lx - 1.6, ly - 1.6, 3.2, 3.2);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function drawWindSock(c) {
    const px = G.TOWER_HW - 0.6, py = G.TOWER_H + 0.4;
    c.fillStyle = '#39425a'; c.fillRect(px - 0.2, py, 0.4, 7);
    const w = curWind();
    const str = clamp(Math.abs(w) / 4.5, 0, 1);
    const dir = w < 0 ? -1 : 1;
    let x = px, y = py + 6.8;
    const base = -Math.PI / 2 + (Math.PI / 2) * (0.15 + 0.85 * str);
    for (let i = 0; i < 5; i++) {
      const a = base + Math.sin(time * 7 + i * 0.9) * 0.05 * (0.3 + str) - i * 0.04 * (1 - str);
      const len = 1.25;
      const nx = x + Math.cos(a) * len * dir, ny = y + Math.sin(a) * len;
      const w0 = 0.75 - i * 0.09, w1 = 0.66 - i * 0.09;
      const px2 = -Math.sin(a) * dir, py2 = Math.cos(a);
      c.fillStyle = i % 2 ? '#f3efe6' : '#f2b544';
      c.beginPath();
      c.moveTo(x + px2 * w0, y + py2 * w0); c.lineTo(nx + px2 * w1, ny + py2 * w1);
      c.lineTo(nx - px2 * w1, ny - py2 * w1); c.lineTo(x - px2 * w0, y - py2 * w0); c.closePath(); c.fill();
      x = nx; y = ny;
    }
  }

  function drawCarriage(c) {
    const y0 = G.ARM_Y - 5, h = 5.6;
    const g = c.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, '#1c2232'); g.addColorStop(1, '#3a4459');
    c.fillStyle = g; c.fillRect(-G.CAR_HW, y0, G.CAR_HW * 2, h);
    c.fillStyle = 'rgba(255,186,120,0.3)'; c.fillRect(-G.CAR_HW, y0 + h - 0.35, G.CAR_HW * 2, 0.35);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7;
    c.drawImage(spr.glow, -G.CAR_HW - 1.2, y0 + 1, 2.4, 2.4); c.drawImage(spr.glow, G.CAR_HW - 1.2, y0 + 1, 2.4, 2.4);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function armsAligned() { return mode === 'fly' && s && Math.abs(s.x) <= cfg.tol; }

  function drawGuide(c) {
    if (mode !== 'fly' || !s) return;
    const aligned = armsAligned();
    const tip = G.R + armsTol;
    const g = c.createLinearGradient(0, G.ARM_Y, 0, G.ARM_Y + 95);
    const col = aligned ? '111,227,165' : '95,212,255';
    g.addColorStop(0, `rgba(${col},${aligned ? 0.22 : 0.14})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(-tip, G.ARM_Y, tip * 2, 95);
    c.fillStyle = `rgba(${col},${aligned ? 0.5 : 0.32})`;
    for (let y = G.ARM_Y + 1; y < G.ARM_Y + 70; y += 5) {
      const a = 1 - (y - G.ARM_Y) / 70;
      c.globalAlpha = a; c.fillRect(-tip - 0.15, y, 0.3, 2.6); c.fillRect(tip - 0.15, y, 0.3, 2.6);
    }
    c.globalAlpha = 1;
  }

  function drawArms(c) {
    const aligned = armsAligned();
    const close = smooth(clamp(armsClose, 0, 1));
    const inner = lerp(G.R + armsTol, G.R + 0.3, close);
    const ang = lerp(G.ARM_OPEN, 0, close);
    const T = G.ARM_T, LEN = G.ARM_LEN;
    let tipCol = '#f2b544';
    if (mode === 'fly') tipCol = aligned ? '#6fe3a5' : '#f2b544';
    else if (armsClose > 0.98) tipCol = '#c9ced6';
    for (const side of [-1, 1]) {
      c.save();
      c.translate(side * inner, G.ARM_Y);
      c.scale(side, 1);
      c.rotate(ang);
      c.fillStyle = 'rgba(28,34,48,0.92)'; c.fillRect(0, -T, LEN, T);
      c.strokeStyle = '#59647c'; c.lineWidth = 0.32;
      c.beginPath();
      for (let x = 1.2; x < LEN - 2; x += 3) { c.moveTo(x, -T + 0.65); c.lineTo(x + 1.5, -0.65); c.lineTo(x + 3, -T + 0.65); }
      c.stroke();
      const tg = c.createLinearGradient(0, -0.8, 0, 0);
      tg.addColorStop(0, '#6f7a90'); tg.addColorStop(1, '#aab3c4');
      c.fillStyle = tg; c.fillRect(0, -0.8, LEN, 0.8);
      c.fillStyle = 'rgba(255,190,125,0.45)'; c.fillRect(0, -0.12, LEN, 0.12);
      c.fillStyle = '#434c61'; c.fillRect(0, -T, LEN, 0.7);
      c.fillStyle = '#2d3446'; c.fillRect(LEN - 1.4, -T - 0.4, 1.4, T + 0.8);
      c.fillStyle = tipCol; c.fillRect(-0.3, -T - 0.3, 1.3, T + 0.6);
      if (mode === 'fly' || mode === 'menu') {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = aligned ? 0.75 : 0.45 + 0.15 * Math.sin(time * 3);
        c.drawImage(spr.glow, -3.2, -T / 2 - 3.6, 7, 7);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      c.restore();
    }
  }

  function drawOLM(c) {
    c.fillStyle = '#242a39';
    for (const lx of [-12.6, -5.2, 5.2, 12.6]) c.fillRect(lx - 1.15, 0, 2.3, G.OLM_TOP - 3.4);
    c.fillStyle = 'rgba(255,186,120,0.22)';
    for (const lx of [-12.6, -5.2, 5.2, 12.6]) c.fillRect(lx - 1.15, 0, 0.35, G.OLM_TOP - 3.4);
    const tg = c.createLinearGradient(0, G.OLM_TOP - 3.6, 0, G.OLM_TOP);
    tg.addColorStop(0, '#20263a'); tg.addColorStop(1, '#4d566c');
    c.fillStyle = tg; c.fillRect(-G.OLM_HW, G.OLM_TOP - 3.6, G.OLM_HW * 2, 3.6);
    c.fillStyle = 'rgba(255,190,125,0.4)'; c.fillRect(-G.OLM_HW, G.OLM_TOP - 0.25, G.OLM_HW * 2, 0.25);
    c.fillStyle = '#353d50'; c.fillRect(-11, 0, 22, 1.1);
  }

  function drawPadLights(c) {
    c.globalCompositeOperation = 'lighter';
    for (const [x0, x1] of [[-36, -6], [26, 6]]) {
      const g = c.createLinearGradient(x0, 0, x1, 120);
      g.addColorStop(0, 'rgba(255,232,200,0.07)'); g.addColorStop(1, 'rgba(255,232,200,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x0 - 0.6, 0.5); c.lineTo(x1 - 7, 125); c.lineTo(x1 + 7, 125); c.lineTo(x0 + 0.6, 0.5); c.closePath(); c.fill();
      c.globalAlpha = 0.85; c.drawImage(spr.glow, x0 - 2, -1, 4, 4); c.globalAlpha = 1;
    }
    // warm light from the engines on the pad and mount
    if (b && b.flame > 0.05 && b.alpha > 0.3) {
      const gy = groundAt(b.x);
      const dist = Math.max(0, b.y - 3 - gy);
      const a = b.flame * clamp(1 - dist / 70, 0, 1) * b.alpha;
      if (a > 0.02) {
        const sz = 36 + dist * 0.4;
        c.globalAlpha = a * 0.75;
        c.drawImage(spr.warm, b.x - sz / 2, gy - sz * 0.25, sz, sz * 0.5);
        c.globalAlpha = 1;
      }
    }
    c.globalCompositeOperation = 'source-over';
  }

  function drawGround(c, xL, xR, yB) {
    const d = -yB + 1;
    const ex = (X, dd) => X * (1 + dd / 60);
    const lg = c.createLinearGradient(0, 0, 0, -d);
    lg.addColorStop(0, '#2c2734'); lg.addColorStop(0.2, '#1b1924'); lg.addColorStop(1, '#0b0b12');
    c.fillStyle = lg; c.fillRect(xL - 20, -d, xR - xL + 40, d + 0.05);
    // low dunes and scrub (left)
    c.fillStyle = '#14121b';
    c.beginPath(); c.moveTo(G.PAD_L, 0);
    for (const [x, hh] of scrub) {
      if (x < xL - 20) break;
      c.lineTo(x, hh);
    }
    c.lineTo(Math.min(xL - 20, G.PAD_L), 0); c.closePath(); c.fill();
    // sea
    const sg = c.createLinearGradient(0, 0, 0, -d);
    sg.addColorStop(0, '#46446f'); sg.addColorStop(0.1, '#2a2d56'); sg.addColorStop(0.45, '#151b38'); sg.addColorStop(1, '#091022');
    c.fillStyle = sg;
    c.beginPath(); c.moveTo(G.SEA_X, 0.05); c.lineTo(Math.max(xR, G.SEA_X) + 400, 0.05); c.lineTo(Math.max(xR, G.SEA_X) + 400, -d); c.lineTo(ex(G.SEA_X, d), -d); c.closePath(); c.fill();
    // shimmer on the water
    c.globalCompositeOperation = 'lighter';
    for (const [sx, rd, len, ph, tint] of shimmer) {
      const yy = -rd * d - 0.3;
      const x = ex(sx, -yy) + Math.sin(time * 0.6 + ph) * 2.5;
      if (x > xR + 20 || x + len < xL) continue;
      if (x < ex(G.SEA_X, -yy) + 2) continue;
      const a = (0.06 + 0.1 * (1 - rd)) * (0.6 + 0.4 * Math.sin(time * 1.4 + ph * 3));
      c.fillStyle = tint < 0.5 ? `rgba(240,150,140,${a.toFixed(3)})` : `rgba(150,180,255,${a.toFixed(3)})`;
      c.fillRect(x, yy, len * (1 + rd), Math.max(0.18, 0.12 + rd * 0.3));
    }
    c.fillStyle = 'rgba(255,200,170,0.25)'; c.fillRect(G.SEA_X, -0.15, Math.max(xR, G.SEA_X) + 400 - G.SEA_X, 0.3);
    c.globalCompositeOperation = 'source-over';
    // beach
    c.fillStyle = '#4a3d44';
    c.beginPath(); c.moveTo(G.PAD_R - 2, 0.05); c.lineTo(G.SEA_X, 0.05); c.lineTo(ex(G.SEA_X, d), -d); c.lineTo(ex(G.PAD_R - 2, d), -d); c.closePath(); c.fill();
    c.strokeStyle = `rgba(235,240,255,${(0.3 + 0.12 * Math.sin(time * 1.3)).toFixed(3)})`; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(G.SEA_X + 0.3, 0); c.lineTo(ex(G.SEA_X, d) + 0.3, -d); c.stroke();
    // pad
    const pg = c.createLinearGradient(0, 0, 0, -d);
    pg.addColorStop(0, '#4e505d'); pg.addColorStop(0.35, '#353743'); pg.addColorStop(1, '#1d1f27');
    c.fillStyle = pg;
    c.beginPath(); c.moveTo(G.PAD_L, 0.05); c.lineTo(G.PAD_R, 0.05); c.lineTo(ex(G.PAD_R, d), -d); c.lineTo(ex(G.PAD_L, d), -d); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 0.3;
    c.beginPath();
    for (const X of [-40, -20, 0, 20]) { c.moveTo(X, 0); c.lineTo(ex(X, d), -d); }
    c.moveTo(G.PAD_L, -d * 0.3); c.lineTo(G.PAD_R + d * 0.3 * G.PAD_R / 60, -d * 0.3);
    c.stroke();
    c.fillStyle = 'rgba(255,190,125,0.18)'; c.fillRect(G.PAD_L, -0.25, G.PAD_R - G.PAD_L, 0.3);
  }

  function drawBooster(c, bb) {
    if (!bb || bb.alpha <= 0.01) return;
    const R = G.R;
    c.save();
    c.globalAlpha = bb.alpha;
    c.translate(bb.x, bb.y + bb.pivot); c.rotate(bb.ang); c.translate(0, -bb.pivot);
    // engine bells
    for (let i = -3; i <= 3; i++) {
      const ex = i * 1.2;
      c.fillStyle = Math.abs(i) <= 1 && bb.flame > 0.05 ? '#5a3a24' : '#1f2228';
      c.beginPath(); c.moveTo(ex - 0.45, 0); c.lineTo(ex + 0.45, 0); c.lineTo(ex + 0.62, -2.7); c.lineTo(ex - 0.62, -2.7); c.closePath(); c.fill();
      c.fillStyle = '#8a6a4a'; c.fillRect(ex - 0.62, -2.8, 1.24, 0.18);
    }
    c.fillStyle = skirtGrad; c.fillRect(-R, 0, 2 * R, 3.8);
    c.fillStyle = steelGrad; c.fillRect(-R, 3.8, 2 * R, G.FIN1 - 3.8);
    // welds
    c.fillStyle = 'rgba(40,44,52,0.18)';
    for (let y = 8; y < G.FIN1 - 1; y += 4.4) c.fillRect(-R, y, 2 * R, 0.12);
    // brushed streaks
    for (const [sx, sy, sl, sa, light] of streaks) {
      c.fillStyle = light ? `rgba(255,255,255,${sa})` : `rgba(40,44,52,${sa})`;
      c.fillRect(sx, sy, 0.09, sl);
    }
    // raceway
    c.fillStyle = 'rgba(70,76,88,0.55)'; c.fillRect(1.7, 4, 0.75, G.PIN - 4);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(1.7, 4, 0.14, G.PIN - 4);
    // soot
    c.fillStyle = sootGrad; c.fillRect(-R, 0, 2 * R, 16);
    // warm dusk rim on the sun side (left) and cool rim on the right
    c.fillStyle = 'rgba(255,190,120,0.32)'; c.fillRect(-R, 3.8, 0.45, G.FIN1 - 3.8);
    c.fillStyle = 'rgba(150,180,240,0.18)'; c.fillRect(R - 0.35, 3.8, 0.35, G.FIN1 - 3.8);
    // hot-stage ring
    c.fillStyle = '#2b2f37'; c.fillRect(-R, G.FIN1, 2 * R, G.L - G.FIN1);
    c.fillStyle = '#6f7682';
    for (let x = -R + 0.5; x < R - 0.4; x += 1.05) c.fillRect(x, G.FIN1 + 0.7, 0.42, 2.0);
    c.fillStyle = '#a7aeb9'; c.fillRect(-R, G.L - 0.6, 2 * R, 0.6);
    c.fillStyle = '#d6dbe2'; c.fillRect(-R + 0.4, G.L - 0.15, 2 * R - 0.8, 0.3);
    // grid fins (two in profile, one facing us)
    const f0 = G.FIN0, f1 = G.FIN1 - 0.4, fh = f1 - f0;
    for (const side of [-1, 1]) {
      const x0 = side > 0 ? R : -R - G.FINW;
      c.fillStyle = '#3d424d'; c.fillRect(x0, f0, G.FINW, fh);
      c.fillStyle = '#7d8592';
      for (let i = 1; i < 4; i++) c.fillRect(x0 + (G.FINW * i) / 4 - 0.07, f0, 0.14, fh);
      for (let j = 1; j < 5; j++) c.fillRect(x0, f0 + (fh * j) / 5 - 0.07, G.FINW, 0.14);
      c.fillStyle = '#9aa2ae'; c.fillRect(x0, f1 - 0.25, G.FINW, 0.25);
      // catch pin
      c.fillStyle = '#4f5562'; c.fillRect(side > 0 ? R - 0.1 : -R - 1.0, G.PIN - 0.9, 1.1, 0.9);
    }
    c.fillStyle = 'rgba(48,52,62,0.92)'; c.fillRect(-1.9, f0, 3.8, fh);
    c.fillStyle = 'rgba(130,138,150,0.85)';
    for (let i = 1; i < 5; i++) c.fillRect(-1.9 + (3.8 * i) / 5 - 0.06, f0, 0.12, fh);
    for (let j = 1; j < 5; j++) c.fillRect(-1.9, f0 + (fh * j) / 5 - 0.06, 3.8, 0.12);
    // engine light on the skirt
    if (bb.flame > 0.03) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = bb.alpha * bb.flame;
      c.fillStyle = lightGrad; c.fillRect(-R, 0, 2 * R, 10);
      drawFlame(c, bb);
    }
    c.restore();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }

  function drawFlame(c, bb) {
    const f = bb.flame;
    const flick = 0.9 + 0.2 * R01();
    // big soft glow around the engines
    c.globalAlpha = bb.alpha * 0.7 * Math.min(1, f + 0.25);
    const gs = 30 + 16 * f;
    c.drawImage(spr.warm, -gs / 2, -6 - gs / 2, gs, gs);
    // outer plume
    const plen = (16 + 20 * f) * flick;
    c.save();
    c.translate(0, -2.75);
    c.scale(1, plen);
    c.globalAlpha = bb.alpha * Math.min(1, 0.3 + 0.6 * f);
    c.fillStyle = plumeGrad;
    const pw = 2.4 + 1.2 * f;
    c.beginPath();
    c.moveTo(-2.1, 0);
    c.bezierCurveTo(-pw, -0.25, -pw * 0.7, -0.65, 0, -1);
    c.bezierCurveTo(pw * 0.7, -0.65, pw, -0.25, 2.1, 0);
    c.closePath(); c.fill();
    c.restore();
    // three bright engine flames
    for (let i = -1; i <= 1; i++) {
      const ex = i * 1.2;
      const len = (9 + 13 * f) * (0.86 + 0.28 * R01());
      const w1 = 1.0 + 0.5 * f;
      c.save();
      c.translate(ex, -2.75);
      c.scale(1, len);
      c.globalAlpha = bb.alpha * Math.min(1, 0.5 + f);
      c.fillStyle = flameGrad;
      c.beginPath();
      c.moveTo(-0.6, 0);
      c.bezierCurveTo(-w1, -0.22, -w1 * 0.55, -0.62, 0, -1);
      c.bezierCurveTo(w1 * 0.55, -0.62, w1, -0.22, 0.6, 0);
      c.closePath(); c.fill();
      c.fillStyle = coreGrad;
      c.beginPath();
      c.moveTo(-0.36, 0);
      c.quadraticCurveTo(-0.42, -0.2, 0, -0.42);
      c.quadraticCurveTo(0.42, -0.2, 0.36, 0);
      c.closePath(); c.fill();
      c.restore();
    }
  }

  function drawChevrons(c, view) {
    if (mode !== 'fly' || !s || !cfg.hints || !b) return;
    const dx = s.x;
    if (Math.abs(dx) <= cfg.tol) return;
    const dir = dx > 0 ? -1 : 1; // toward the gap
    const sx = view.ox + b.x * view.ppm;
    const sy = view.oy - (b.y + 34) * view.ppm;
    const off = G.R * view.ppm + 22;
    c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = (time * 2.2 - i * 0.33) % 1;
      const a = clamp(Math.sin(ph * Math.PI), 0, 1) * 0.9;
      const x = sx + dir * (off + i * 18);
      c.strokeStyle = `rgba(95,212,255,${a.toFixed(3)})`;
      c.beginPath(); c.moveTo(x - dir * 7, sy - 13); c.lineTo(x + dir * 5, sy); c.lineTo(x - dir * 7, sy + 13); c.stroke();
    }
  }

  // ---------- camera ----------
  function boosterBBox(bb) {
    if (!bb || bb.alpha < 0.05) return null;
    const ca = Math.cos(bb.ang), sa = Math.sin(bb.ang);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [lx, ly] of [[-G.R - G.FINW, -3], [G.R + G.FINW, -3], [-G.R - G.FINW, G.L], [G.R + G.FINW, G.L]]) {
      const yy = ly - bb.pivot;
      const wx = bb.x + lx * ca - yy * sa, wy = bb.y + bb.pivot + lx * sa + yy * ca;
      if (wx < x0) x0 = wx; if (wx > x1) x1 = wx; if (wy < y0) y0 = wy; if (wy > y1) y1 = wy;
    }
    return { x0, x1, y0, y1 };
  }
  function cameraTarget() {
    const aspect = W / Math.max(1, H);
    const port = H > W * 1.05;
    let baseCx = 0;
    const panelLeft = !port && W >= 860 && (mode === 'menu' || mode === 'results');
    if (panelLeft) baseCx = -G.VH0 * aspect * 0.2;
    let cx = baseCx, vh = G.VH0;
    const bb = boosterBBox(b);
    if (bb) {
      // keep the top of the booster below the HUD (portrait/narrow) or the top edge (landscape)
      const topPad = port || W < 560 ? clamp(hudBottomFrac, 0.1, 0.34) : 0.12;
      vh = Math.max(vh, bb.y1 / (1 - G.BF - topPad));
      const needH = (c0) => (2 * (Math.max(bb.x1 - c0, c0 - bb.x0) + 14)) / aspect;
      let nh = needH(cx);
      const comfy = G.VH0 * 1.7;
      if (Math.max(vh, nh) > comfy) {
        const mid = (bb.x0 + bb.x1) / 2;
        const c2 = (cx + mid) / 2;
        if (needH(c2) < nh) { cx = c2; nh = needH(c2); }
        if (Math.max(vh, nh) > comfy) { cx = mid; nh = needH(mid); }
      }
      vh = Math.min(Math.max(vh, nh), G.VH0 * 3.2);
      if (panelLeft) {
        // keep the panel side clear: make sure the booster is right of the panel
        const vw = vh * aspect;
        const leftEdge = cx - vw / 2 + vw * 0.45;
        if (bb.x0 < leftEdge) cx -= leftEdge - bb.x0;
      }
    }
    return { cx, vh };
  }
  function updateCamera(dt, snap) {
    const t = cameraTarget();
    if (snap) { cam.cx = t.cx; cam.vh = t.vh; return; }
    const k = 1 - Math.exp(-dt * 2.4);
    cam.cx += (t.cx - cam.cx) * k;
    cam.vh += (t.vh - cam.vh) * k;
  }
  function addShake(amp, dur) {
    if (reduceMotion) return;
    if (amp >= shake.amp * (1 - shake.t / Math.max(0.001, shake.dur))) { shake.amp = amp; shake.dur = dur; shake.t = 0; }
  }

  // ---------- render ----------
  const view = { ppm: 1, ox: 0, oy: 0 };
  function render() {
    if (destroyed || !cv.width || !cv.height) return;
    const c = g2;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (sky.width === cv.width && sky.height === cv.height) c.drawImage(sky, 0, 0);
    else { c.fillStyle = '#0b1020'; c.fillRect(0, 0, cv.width, cv.height); }
    let shx = 0, shy = 0;
    if (shake.t < shake.dur) {
      const k = 1 - shake.t / shake.dur;
      const a = shake.amp * k * k;
      shx = a * (Math.sin(shake.t * 57) * 0.7 + Math.sin(shake.t * 31 + 1) * 0.3);
      shy = a * (Math.sin(shake.t * 43 + 2) * 0.7 + Math.sin(shake.t * 23) * 0.3);
    }
    const ppm = H / cam.vh;
    view.ppm = ppm;
    view.ox = W / 2 - cam.cx * ppm + shx;
    view.oy = H * (1 - G.BF) + shy;
    c.setTransform(dpr * ppm, 0, 0, -dpr * ppm, dpr * view.ox, dpr * view.oy);
    const vw = cam.vh * (W / H);
    const xL = cam.cx - vw / 2 - 30, xR = cam.cx + vw / 2 + 30;
    const yB = -(cam.vh * G.BF) - (Math.abs(shy) + 2) / ppm;

    drawTower(c);
    drawWindSock(c);
    drawCarriage(c);
    drawGuide(c);
    drawArms(c);
    drawOLM(c);
    drawPadLights(c);
    drawBooster(c, b);
    drawGround(c, xL, xR, yB);
    drawRings(c);
    drawParticles(c, false);
    c.globalCompositeOperation = 'lighter';
    drawParticles(c, true);
    c.globalCompositeOperation = 'source-over';

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (popGlow > 0.01 && popAt) {
      const px = view.ox + popAt[0] * ppm, py = view.oy - popAt[1] * ppm;
      const r = 160 + 260 * (1 - popGlow);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = popGlow * 0.35;
      c.drawImage(spr.warm, px - r, py - r, r * 2, r * 2);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    drawChevrons(c, view);
    if (vign.width === cv.width) { c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(vign, 0, 0); }
  }

  // ---------- flow ----------
  function boosterFromFlight() {
    if (!b) b = { x: 0, y: 0, ang: 0, pivot: 30, alpha: 1, flame: 0 };
    b.x = s.x; b.y = s.y; b.ang = s.ang; b.pivot = 30; b.alpha = 1;
    const target = s.thrust ? Math.max(s.thr, 0.3) : 0;
    b.flame += (target - b.flame) * Math.min(1, (target > b.flame ? 18 : 10) * STEP);
  }

  function startRound() {
    if (destroyed) return;
    try { if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur(); } catch (e) {}
    cfg = LEVELS[level];
    s = newFlight(cfg, Math.random);
    out = null;
    b = null;
    boosterFromFlight();
    b.flame = 0;
    parts.length = 0;
    popGlow = 0; popAt = null; sparkleUntil = 0; smokeUntil = 0;
    armsTol = cfg.tol;
    roundNo++;
    mode = 'fly';
    menu.hidden = true; results.hidden = true;
    hud.classList.remove('off'); ctl.classList.remove('off');
    hideBanner();
    startHint = cfg.hints ? 'Steer to the gap between the arms!' : 'Good luck, Commander!';
    hintUntil = time + 3.2;
    for (const k in hudCache) delete hudCache[k];
    clearInputs();
    autopilot = DBG.auto ? makeAutopilot(cfg) : null;
    updateCamera(0, true);
    updateHud();
  }

  function beginOutcome(type, v) {
    mode = 'outcome';
    clearInputs();
    ctl.classList.add('off');
    btnByKey.thrust.classList.remove('pulse');
    showHint('');
    out = { type, v, dx: s.x, t: 0, x0: b.x, y0: b.y, done: {}, level: cfg.id };
    call('complete');
    if (autopilot) {
      autoLog.push({ level: cfg.id, type, v: +v.toFixed(2), dx: +s.x.toFixed(2), fuel: +(s.fuel / cfg.fuel).toFixed(2), t: +s.t.toFixed(1) });
      console.log(`AUTOPILOT ${cfg.id} round ${autoLog.length}: ${type} speed=${v.toFixed(1)} m/s dx=${s.x.toFixed(2)} m fuelLeft=${Math.round((s.fuel / cfg.fuel) * 100)}% time=${s.t.toFixed(1)}s`);
    }
    if (type === 'miss') { showBanner('Missed the arms!', 'cyan small'); setupSea(true); }
    if (type === 'fuel') { showBanner('Out of fuel!', 'gold small'); setupSea(false); }
    if (type === 'caught') { b.pivot = 30; }
  }

  function setupSea(engines) {
    out.engines = engines;
    out.xs = b.x < G.SEA_X + 14 ? G.SEA_X + 26 + R01() * 8 : b.x + 6;
    out.x0 = b.x; out.y0 = Math.max(0, b.y); out.a0 = b.ang;
    const dist = Math.abs(out.xs - out.x0);
    out.D = engines ? clamp(dist / 24 + 0.9 + out.y0 / 45, 1.8, 4.4) : clamp(1.6 + out.y0 / 50 + dist / 70, 2.2, 5.5);
    out.phase = 'glide'; out.pt = 0; out.rcsT = 0;
  }

  function recordCatch(v) {
    catches++;
    call('save', 'catches', catches);
    const isBest = best == null || v < best - 1e-9;
    if (isBest) { best = v; bestLevel = cfg.id; call('save', 'best', best); call('save', 'bestLevel', bestLevel); }
    out.isBest = isBest;
    call('log', `Caught the booster at ${v.toFixed(1)} m/s on ${cfg.name}!`);
    updateStatsUi();
  }

  function outcomeStep(dt) {
    const o = out;
    o.t += dt;
    if (o.type === 'caught') {
      const TC = 0.5;
      armsClose = clamp(o.t / TC, 0, 1);
      b.x = lerp(o.x0, 0, easeOut(clamp(o.t / 0.42, 0, 1)));
      b.ang *= Math.exp(-dt * 10);
      let dip = 0;
      if (o.t > TC) dip = -0.8 * Math.exp(-(o.t - TC) * 4.5) * Math.sin((o.t - TC) * 13);
      b.y = G.ARM_Y - G.PIN + dip;
      b.flame = o.t < TC ? Math.max(0.35, b.flame * Math.exp(-dt * 2)) : b.flame * Math.exp(-dt * 14);
      if (!o.done.clunk && o.t >= TC) {
        o.done.clunk = true;
        audio.clunk(); audio.chime();
        addShake(6, 0.45);
        sparkles(-G.R, G.ARM_Y, reduceMotion ? 14 : 30, 22);
        sparkles(G.R, G.ARM_Y, reduceMotion ? 14 : 30, 22);
        addP({ x: -G.R, y: G.ARM_Y, vx: 0, vy: 0, life: 0.7, s0: 8, s1: 30, sprA: spr.warm, aA: 0.7, fo: 1 });
        addP({ x: G.R, y: G.ARM_Y, vx: 0, vy: 0, life: 0.7, s0: 8, s1: 30, sprA: spr.warm, aA: 0.7, fo: 1 });
        steamPuff(b.x, b.y - 4, 12, 3, 2);
        sparkleUntil = time + 1.8;
        showBanner('CAUGHT!', 'gold');
        call('speak', 'Caught it!');
        recordCatch(o.v);
      }
      if (!o.done.card && o.t >= TC + 2.0) { o.done.card = true; showResults(); }
    } else if (o.type === 'fast') {
      if (o.t < 0.14) b.y -= o.v * dt * (1 - o.t / 0.14);
      b.flame = 0;
      if (!o.done.pop && o.t >= 0.1) {
        o.done.pop = true;
        popFx(b.x, b.y);
        smokeUntil = time + 1.2;
        addShake(8, 0.55);
        audio.thump();
        showBanner('Too fast!', '');
        call('speak', "Too fast! That's why we test.");
      }
      b.alpha = 1 - clamp((o.t - 0.12) / 0.45, 0, 1);
      if (!o.done.card && o.t >= 2.8) { o.done.card = true; showResults(); }
    } else {
      seaStep(o, dt);
    }
  }

  function seaStep(o, dt) {
    o.pt += dt;
    if (o.phase === 'glide') {
      const u = Math.min(1, o.pt / o.D);
      const dirx = Math.sign(o.xs - o.x0) || 1;
      if (o.engines) {
        b.x = lerp(o.x0, o.xs, smooth(Math.min(1, u * 1.35)));
        b.y = o.y0 * (1 - smooth(clamp((u - 0.2) / 0.8, 0, 1)));
        b.flame += (0.55 - b.flame) * Math.min(1, dt * 8);
      } else {
        b.x = lerp(o.x0, o.xs, smooth(u));
        b.y = o.y0 * (1 - u * u);
        b.flame *= Math.exp(-dt * 8);
        o.rcsT -= dt;
        if (o.rcsT <= 0) {
          o.rcsT = 0.3;
          const [px, py] = localToWorld(b, -dirx * (G.R + 0.4), 57);
          addP({ x: px, y: py, vx: -dirx * 12, vy: 8, life: 0.5, s0: 0.7, s1: 4, drag: 4, sprN: spr.steam, aN: 0.6, fi: 0.1 });
        }
      }
      b.ang = lerp(o.a0, 0, u) - dirx * 0.16 * Math.sin(Math.PI * u);
      b.pivot = 30;
      if (u >= 1) {
        o.phase = 'splash'; o.pt = 0;
        b.y = 0; b.ang = 0; b.pivot = 0;
        const power = o.engines ? 0.35 : clamp((2 * o.y0) / o.D / 45, 0.45, 1);
        splashFx(b.x, power);
        audio.splash(power);
        addShake(3 + 3 * power, 0.4);
        showBanner('Splash!', 'cyan');
        call('speak', o.type === 'fuel'
          ? 'Out of fuel! Splash! Lost the booster, but everyone is safe.'
          : 'Splash! Lost the booster, but everyone is safe.');
      }
    } else if (o.phase === 'splash') {
      b.flame *= Math.exp(-dt * 12);
      b.y = -3.5 * smooth(Math.min(1, o.pt / 0.6));
      if (o.pt > 0.5) { o.phase = 'tip'; o.pt = 0; }
    } else if (o.phase === 'tip') {
      const u = Math.min(1, o.pt / 1.5);
      b.ang = -1.5 * u * u;
      b.y = -3.5;
      if (u >= 1) {
        o.phase = 'float'; o.pt = 0;
        for (let i = 0; i < 4; i++) splashFx(b.x + 22 + i * 14, 0.35);
        audio.splash(0.6);
        addShake(4, 0.4);
      }
    } else if (o.phase === 'float') {
      b.ang = -1.5 + 0.015 * Math.sin(o.pt * 1.6);
      b.y = -3.5 + 0.35 * Math.sin(o.pt * 1.3);
      if (!o.done.card && o.pt > 1.3) { o.done.card = true; showResults(); }
    }
  }

  function showResults() {
    if (destroyed) return;
    const o = out;
    hideBanner();
    if (DBG.noCard) { mode = 'results'; hud.classList.add('off'); return; }
    mode = 'results';
    hud.classList.add('off'); ctl.classList.add('off');
    const head = $('rhead'), line = $('rline'), chips = $('rchips'), tip = $('rtip'), eye = $('reye');
    chips.innerHTML = '';
    tip.textContent = '';
    const chip = (txt, cls) => { const sp = document.createElement('span'); sp.className = `chip ${cls || ''}`; sp.textContent = txt; chips.appendChild(sp); };
    const lvName = LEVELS[o.level].name;
    if (o.type === 'caught') {
      eye.textContent = `${lvName} · Booster caught`;
      head.textContent = 'CAUGHT!'; head.className = 'gc-head gold';
      line.textContent = `You caught it at ${o.v.toFixed(1)} m/s.`;
      chip(`Catches: ${catches}`, 'gold');
      chip(`Softest: ${best != null ? best.toFixed(1) : o.v.toFixed(1)} m/s`, 'cyan');
      if (o.isBest && catches > 1) chip('New softest catch!', 'gold');
      if (o.level === 'cadet' && catches >= 2) tip.textContent = 'Ready to try Pilot?';
      else if (o.level === 'pilot' && catches >= 3) tip.textContent = 'Ready to try Commander?';
      else tip.textContent = 'Can you catch it even softer?';
    } else if (o.type === 'fast') {
      eye.textContent = `${lvName} · Test flight`;
      head.textContent = 'Too fast!'; head.className = 'gc-head';
      line.textContent = "That's why we test.";
      tip.textContent = `It was going ${o.v.toFixed(1)} m/s. Hold THRUST sooner to slow down.`;
    } else {
      eye.textContent = o.type === 'fuel' ? `${lvName} · Out of fuel` : `${lvName} · Test flight`;
      head.textContent = 'Splash!'; head.className = 'gc-head cyan';
      line.textContent = 'Lost the booster, but everyone is safe.';
      if (o.type === 'fuel') tip.textContent = 'Save fuel: let it fall first, then hold THRUST near the arms.';
      else {
        const far = Math.abs(o.dx) > LEVELS[o.level].tol * 2.5;
        const side = o.dx < 0 ? 'left' : 'right';
        tip.textContent = far ? `It was too far to the ${side}. Steer into the gap!` : `So close! Just a little bit too far ${side}.`;
      }
    }
    $('fact').textContent = FACTS[factIdx % FACTS.length];
    factIdx = (factIdx + 1) % FACTS.length;
    call('save', 'factIdx', factIdx);
    setLevel(level);
    results.hidden = false;
    results.scrollTop = 0;
    if (autopilot) {
      const maxR = DBG.level ? DBG.rounds : DBG.rounds * 3;
      if (autoLog.length < maxR) {
        if (!DBG.level) level = LEVEL_IDS[Math.floor(autoLog.length / DBG.rounds)];
        later(() => { if (mode === 'results') startRound(); }, 800);
      } else {
        const sum = {};
        for (const r of autoLog) { const k = r.level; sum[k] = sum[k] || { rounds: 0, caught: 0, speeds: [] }; sum[k].rounds++; if (r.type === 'caught') { sum[k].caught++; sum[k].speeds.push(r.v); } }
        console.log('AUTOPILOT SUMMARY ' + JSON.stringify(sum));
      }
    }
  }

  // ---------- main loop ----------
  let raf = 0, lastNow = null, acc = 0, dbgClock = 0, snapImg = null;
  function fixedUpdate(dt) {
    if (mode === 'fly' && s) {
      const inp = autopilot ? autopilot(s) : { thrust: keys.thrust || pads.thrust, left: keys.left || pads.left, right: keys.right || pads.right };
      const prevPin = s.y + G.PIN;
      if (freezeFlight) {
        s.t += dt;
        s.thrust = true; s.thr = 0.9; s.steer = 1;
      } else {
        physStep(s, inp, cfg, dt);
      }
      boosterFromFlight();
      armsClose = Math.max(0, armsClose - dt * 2.5);
      const pin = s.y + G.PIN;
      if (prevPin > G.ARM_Y && pin <= G.ARM_Y) {
        const j = judgeCrossing(s, cfg);
        beginOutcome(j.type, j.v);
      } else if (s.fuel <= 0) {
        beginOutcome('fuel', s.vy);
      }
    } else if (mode === 'outcome' && out) {
      outcomeStep(dt);
    } else if (mode === 'results' && out) {
      out.t += dt;
      if (out.type === 'caught') { b.y = G.ARM_Y - G.PIN; b.flame *= Math.exp(-dt * 14); }
      else if (out.type === 'fast') b.alpha = 0;
      else seaStep(out, dt);
    } else if (mode === 'menu') {
      armsClose = Math.max(0, armsClose - dt * 2);
    }
    armsTol += (LEVELS[level].tol - armsTol) * Math.min(1, dt * 5);
    if (mode === 'fly' || mode === 'outcome') armsTol = cfg.tol;
  }

  function frameUpdate(dt) {
    time += dt;
    if (shake.t < shake.dur) shake.t += dt;
    if (popGlow > 0) popGlow = Math.max(0, popGlow - dt * 1.8);
    if (b && b.alpha > 0.3) {
      if (!b.prev) b.prev = [b.x, b.y];
      const bvx = dt > 0 ? (b.x - b.prev[0]) / dt : 0, bvy = dt > 0 ? (b.y - b.prev[1]) / dt : 0;
      b.prev[0] = b.x; b.prev[1] = b.y;
      if (b.flame > 0.05 && dt > 0) spawnExhaust(dt, clamp(bvx, -40, 40), clamp(bvy, -60, 60));
      if (mode === 'fly') spawnRcs(dt);
    }
    if (time < sparkleUntil && b && R01() < dt * 30) {
      const [px, py] = [b.x + U(-9, 9), b.y + U(40, 72)];
      sparkles(px, py, 1, 4);
    }
    if (time < smokeUntil && b && R01() < dt * 12) {
      addP({ x: b.x + U(-6, 6), y: G.ARM_Y - U(10, 40), vx: U(-2, 2), vy: U(1, 3), life: U(2, 3), s0: 10, s1: 26, drag: 0.6, sprN: spr.smoke, aN: 0.55, fi: 0.2, windK: 0.5 });
    }
    updateParticles(dt);
    updateCamera(dt, false);
    if (mode === 'fly' || mode === 'outcome') updateHud();
    audio.engine(b && (mode === 'fly' || mode === 'outcome') ? b.flame * b.alpha : 0);
  }

  function frame(now) {
    raf = 0;
    if (destroyed) return;
    if (lastNow == null) lastNow = now;
    let dt = (now - lastNow) / 1000;
    lastNow = now;
    if (!(dt >= 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    if (DBG.pauseAt != null && !paused && (out ? out.t : dbgClock) >= DBG.pauseAt) {
      paused = true;
      // Headless Chrome without a GPU does not present a canvas that keeps redrawing, so freeze it into an <img>.
      if (DBG.timer && !snapImg) {
        try {
          render();
          snapImg = new Image();
          snapImg.className = 'gc-cv';
          snapImg.src = cv.toDataURL('image/png');
          cv.after(snapImg);
          cv.style.visibility = 'hidden';
        } catch (e) { console.warn('[catch] snapshot failed', e); }
      }
    }
    if (paused) dt = 0;
    dbgClock += dt;
    try {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 20) { fixedUpdate(STEP); acc -= STEP; n++; }
      frameUpdate(dt);
      render();
    } catch (e) {
      console.error('[catch] frame error', e);
    }
    if (!destroyed && !document.hidden) schedule();
  }
  function schedule() { raf = DBG.timer ? setTimeout(() => frame(performance.now()), 16) : requestAnimationFrame(frame); }
  function startLoop() { if (!raf && !destroyed && !document.hidden) { lastNow = null; schedule(); } }
  function stopLoop() { if (raf) { if (DBG.timer) clearTimeout(raf); else cancelAnimationFrame(raf); } raf = 0; }
  function onVis() {
    if (destroyed) return;
    if (document.hidden) { stopLoop(); clearInputs(); audio.suspend(); }
    else { audio.resume(); startLoop(); }
  }
  document.addEventListener('visibilitychange', onVis);

  let ro = null;
  try { ro = new ResizeObserver(() => resize()); ro.observe(el); } catch (e) { ro = null; }
  resize();

  // ---------- debug entry points ----------
  if (DBG.sim) {
    const lines = [];
    for (const id of LEVEL_IDS) {
      for (const kind of ['auto', 'novice', 'holdall', 'nothrust']) {
        const n = kind === 'novice' ? DBG.simN : Math.min(DBG.simN, 100);
        const tally = { caught: 0, fast: 0, miss: 0, fuel: 0, timeout: 0 };
        let tSum = 0, vSum = 0;
        for (let i = 0; i < n; i++) {
          const r = simulateRound(id, kind, 1000 + i * 17);
          tally[r.type]++; tSum += r.t || 0;
          if (r.type === 'caught') vSum += r.v;
        }
        const p = (tally.caught / n) * 100;
        const tries = p > 0 ? (100 / p).toFixed(1) : 'inf';
        lines.push(`SIM ${id.padEnd(9)} ${kind.padEnd(8)} n=${n} caught=${p.toFixed(0)}% fast=${tally.fast} miss=${tally.miss} fuel=${tally.fuel} timeout=${tally.timeout} avgTime=${(tSum / n).toFixed(1)}s avgCatchSpeed=${tally.caught ? (vSum / tally.caught).toFixed(2) : '-'} expectedTries=${tries}`);
      }
    }
    for (const l of lines) console.log(l);
  }

  if ((DBG.auto || DBG.state) && ctx.sound) audio.unlock(); // dev only: exercise the synth without a tap
  if (DBG.auto) {
    level = DBG.level || 'cadet';
    setLevel(level);
    startRound();
  } else if (DBG.state && DBG.state !== 'start' && DBG.state !== 'menu') {
    startRound();
    const st = DBG.state;
    if (st === 'falling') {
      s.y = G.ARM_Y + 34 - G.PIN; s.x = -7; s.vy = 6.2; s.vx = 1.2; s.fuel = cfg.fuel * 0.62;
      freezeFlight = true; hintUntil = 0;
      boosterFromFlight();
      updateCamera(0, true);
    } else if (st === 'caught' || st === 'crash' || st === 'splash') {
      s.y = G.ARM_Y - G.PIN + 0.004;
      s.x = st === 'splash' ? -cfg.tol - 6 : 1.1;
      s.vy = st === 'crash' ? cfg.vCatch + 6 : cfg.vCatch * 0.36;
      s.ang = 0.04;
      boosterFromFlight();
      b.flame = 0.6;
      updateCamera(0, true);
    } else if (st === 'brake') {
      s.y = G.ARM_Y + 55 - G.PIN; s.x = 2; s.vy = cfg.vTerm * 0.9; hintUntil = 0;
      boosterFromFlight();
      updateCamera(0, true);
    } else if (st === 'fuel') {
      s.y = G.ARM_Y + 70 - G.PIN; s.x = -12; s.vy = 9; s.fuel = 0;
      boosterFromFlight();
      updateCamera(0, true);
    }
  } else {
    // menu: the arms wait, open
    mode = 'menu';
    hud.classList.add('off');
    ctl.classList.add('off');
  }
  if (b) b.prev = null;
  updateCamera(0, true);
  startLoop();

  // ---------- destroy ----------
  let gone = false;
  function destroy() {
    if (gone) return;
    gone = true;
    destroyed = true;
    stopLoop();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    try { if (ro) ro.disconnect(); } catch (e) {}
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    ctl.removeEventListener('pointerdown', onPDown);
    ctl.removeEventListener('pointermove', onPMove);
    ctl.removeEventListener('pointerup', onPUp);
    ctl.removeEventListener('pointercancel', onPUp);
    ctl.removeEventListener('lostpointercapture', onPUp);
    root.removeEventListener('contextmenu', onCtx);
    root.removeEventListener('selectstart', onSelect);
    root.removeEventListener('click', onClick);
    audio.close();
    parts.length = 0;
    try { root.remove(); } catch (e) {}
    try {
      const users = (+styleEl.dataset.users || 1) - 1;
      if (users <= 0) styleEl.remove(); else styleEl.dataset.users = String(users);
    } catch (e) {}
  }
  return { destroy };
}
