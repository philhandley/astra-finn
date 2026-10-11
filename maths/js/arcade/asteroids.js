// Asteroid Sort (canvas). Asteroids carrying numbers drift down; blast the ones that fit the rule.
// A round is two waves of asteroids with a "New rule!" in between. No lives, no game over, no countdown.
// Tests only: ctx.debug or ?arcdebug exposes window.__arc (list, spawn, freeze, tally, rule).
import { injectCSS, onTap, clamp, esc, reducedMotion } from '../core/dom.js';
import { makeRand } from '../core/rand.js';
import { COL, FONT } from '../core/theme.js';
import { art } from '../core/art.js';
import { factKey } from '../core/facts.js';
import { sfx as coreSfx } from '../core/sfx.js';

export const meta = { id: 'asteroids', title: 'Asteroid Sort', about: 'Blast the asteroids that fit the rule.', icon: 'asteroid' };

const C = 'arc-ast';
const WAVE = 12; // asteroids per rule
// speed: fraction of the field height per second; every: seconds between spawns; max: on screen at once
const PACE = { 1: { speed: 0.045, every: 3.0, max: 3 }, 2: { speed: 0.052, every: 2.7, max: 3 }, 3: { speed: 0.06, every: 2.4, max: 4 } };

// ---------- rules ----------
const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
const tensWord = t => (t === 1 ? '1 ten' : `${t} tens`);
const mk = o => ({ ...o, yes: o.pool.filter(o.test), no: o.pool.filter(n => !o.test(n)) });

const RULE = {
  even: max => mk({ type: 'even', text: 'Even numbers', say: 'Blast the even numbers.', pool: range(1, max), test: n => n % 2 === 0, why: n => `${n} is odd` }),
  odd: max => mk({ type: 'odd', text: 'Odd numbers', say: 'Blast the odd numbers.', pool: range(1, max), test: n => n % 2 === 1, why: n => `${n} is even` }),
  makes: (total, k) => mk({
    type: 'makes', text: `Makes ${total} with ${k}`, say: `Blast the number that makes ${total} with ${k}.`,
    pool: range(0, total), test: n => n + k === total,
    why: n => `${k} + ${n} = ${k + n}`, hit: n => `${k} + ${n} = ${total}`, fact: n => factKey('+', k, n),
  }),
  oneTen: () => mk({
    type: 'oneten', text: 'Has 1 ten', say: 'Blast the numbers with 1 ten.', pool: range(1, 20),
    test: n => n >= 10 && n <= 19, why: n => `${n} has ${tensWord(Math.floor(n / 10))}`, hit: n => (n === 10 ? '10 = 1 ten' : `${n} = 10 + ${n - 10}`),
  }),
  table: (t, max, text) => mk({
    type: `x${t}`, text,
    say: t === 2 ? 'Blast the numbers in the 2 times table.' : t === 10 ? 'Blast the numbers in the 10s.' : `Blast the multiples of ${t}.`,
    pool: range(1, max), test: n => n % t === 0,
    why: n => {
      if (t === 2) return `${n} is odd`;
      if (t === 5) return `${n} doesn't end in 0 or 5`;
      if (t === 10) return `${n} doesn't end in 0`;
      const lo = n - (n % t);
      return `${n} is between ${lo} and ${lo + t}`;
    },
    hit: n => `${n / t} × ${t} = ${n}`,
    fact: n => ((t === 2 || t === 5 || t === 10) && n / t <= 12 ? factKey('x', n / t, t) : null),
  }),
  tens: t => {
    const pool = [...new Set([...range(t * 10 - 10, t * 10 + 19), ...range(0, 9).map(k => k * 10 + t)])].filter(n => n >= 1 && n <= 100).sort((a, b) => a - b);
    return mk({
      type: 'tens', text: `Has ${tensWord(t)}`, say: `Blast the numbers with ${tensWord(t)}.`, pool,
      test: n => Math.floor(n / 10) === t, why: n => `${n} has ${tensWord(Math.floor(n / 10))}`, hit: n => `${n} = ${t * 10} + ${n % 10}`,
    });
  },
  more: T => mk({
    type: 'more', text: `More than ${T}`, say: `Blast the numbers more than ${T}.`, pool: range(Math.max(1, T - 25), Math.min(100, T + 25)),
    test: n => n > T, why: n => (n === T ? `${n} is equal to ${T}` : `${n} is less than ${T}`),
  }),
  less: T => mk({
    type: 'less', text: `Less than ${T}`, say: `Blast the numbers less than ${T}.`, pool: range(Math.max(1, T - 25), Math.min(100, T + 25)),
    test: n => n < T, why: n => (n === T ? `${n} is equal to ${T}` : `${n} is more than ${T}`),
  }),
};

function rulesFor(level, R) {
  if (level === 1) return [RULE.even(20), RULE.odd(20), RULE.makes(10, R.int(1, 9)), RULE.oneTen()];
  if (level === 2) return [RULE.table(2, 24, 'In the 2 times table'), RULE.table(5, 50, 'Multiples of 5'), RULE.table(10, 50, 'In the 10s'), RULE.makes(20, R.int(11, 19)), RULE.even(50), RULE.odd(50)];
  return [RULE.tens(R.int(2, 9)), RULE.more(R.pick([30, 40, 50, 60, 70])), RULE.less(R.pick([30, 40, 50, 60, 70])), RULE.table(3, 36, 'Multiples of 3'), RULE.table(5, 100, 'Multiples of 5'), RULE.table(10, 100, 'In the 10s')];
}

// Two rules of different types for one round. Avoid even then odd back to back (too alike).
function pickPair(level, R) {
  const all = R.shuffle(rulesFor(level, R));
  const a = all[0];
  const b = all.find(r => r.type !== a.type && !(['even', 'odd', 'x2'].includes(a.type) && ['even', 'odd', 'x2'].includes(r.type))) || all[1];
  return [a, b];
}

// ---------- shared strip (each arcade file carries its own copy) ----------
const BACK = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function stripCSS(c) {
  return `
  .${c} { position: absolute; inset: 0; display: flex; flex-direction: column; color: var(--ink, #f3efe6); font-family: var(--font-body, system-ui); overflow: hidden; user-select: none; -webkit-user-select: none; }
  .${c}-top { flex: none; height: 84px; display: flex; align-items: center; gap: 18px; padding: 0 18px; border-bottom: 1px solid var(--line, rgba(255,255,255,.12)); background: rgba(5,8,18,.6); position: relative; z-index: 3; }
  .${c} button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .${c}-exit { appearance: none; min-height: 64px; min-width: 64px; padding: 0 22px 0 14px; border-radius: 999px; border: 1.5px solid var(--line, rgba(255,255,255,.12)); background: rgba(255,255,255,.04); color: var(--ink, #f3efe6); font: 600 22px ${FONT.display}; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
  .${c}-exit:active { transform: scale(.96); }
  .${c}-title { flex: 1; font: 600 28px ${FONT.display}; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .${c}-lv { display: flex; align-items: center; gap: 8px; }
  .${c}-lv span { font: 600 15px ${FONT.display}; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3, #7d869a); margin-right: 4px; }
  .${c}-lv button { appearance: none; width: 64px; height: 64px; border-radius: 50%; border: 1.5px solid var(--line, rgba(255,255,255,.12)); background: transparent; color: var(--ink, #f3efe6); font: 600 26px ${FONT.display}; cursor: pointer; transition: background .2s, color .2s; }
  .${c}-lv button.on { background: var(--gold, #f2b544); border-color: var(--gold, #f2b544); color: #1a1205; }
  .${c}-tally { min-width: 130px; text-align: right; line-height: 1.1; }
  .${c}-tally b { font: 700 30px ${FONT.display}; color: var(--gold, #f2b544); }
  .${c}-tally small { display: block; font: 500 16px ${FONT.display}; color: var(--ink-3, #7d869a); margin-top: 3px; }
  .${c}-tally b.bump { animation: ${c}-bump .35s ease; display: inline-block; }
  @keyframes ${c}-bump { 40% { transform: scale(1.3); } }
  .${c}-sum { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(4,6,14,.62); z-index: 5; animation: ${c}-fade .3s ease; }
  .${c}-sum .${c}-card { min-width: 460px; max-width: 640px; text-align: center; padding: 34px 40px 30px; border-radius: 24px; background: #111a2e; border: 1px solid rgba(255,255,255,.14); box-shadow: 0 20px 60px rgba(0,0,0,.5); }
  .${c}-sum .eb { font: 600 16px ${FONT.display}; letter-spacing: .16em; text-transform: uppercase; color: var(--gold, #f2b544); }
  .${c}-sum .big { font: 700 64px ${FONT.display}; color: var(--gold, #f2b544); margin: 10px 0 2px; }
  .${c}-sum p { margin: 6px 0; font-size: 22px; color: var(--ink-2, #b9c0cf); }
  .${c}-sum p.best { font-size: 18px; color: var(--ink-3, #7d869a); }
  .${c}-sum .row { display: flex; gap: 14px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
  .${c}-btn { appearance: none; border: 0; min-height: 64px; padding: 0 30px; border-radius: 999px; font: 600 23px ${FONT.display}; background: var(--gold, #f2b544); color: #1a1205; cursor: pointer; }
  .${c}-btn.ghost { background: transparent; color: var(--ink, #f3efe6); border: 1.5px solid rgba(255,255,255,.18); }
  .${c}-btn:active { transform: scale(.96); }
  @keyframes ${c}-fade { from { opacity: 0; } to { opacity: 1; } }
  `;
}
function makeStrip(root, c, title, level, { onExit, onLevel }) {
  const top = document.createElement('div');
  top.className = `${c}-top`;
  top.innerHTML = `<button type="button" class="${c}-exit" aria-label="Exit">${BACK}Exit</button>
    <div class="${c}-title">${esc(title)}</div>
    <div class="${c}-lv" role="group" aria-label="Level"><span>Level</span>${[1, 2, 3].map(n => `<button type="button" data-l="${n}" aria-label="Level ${n}">${n}</button>`).join('')}</div>
    <div class="${c}-tally" aria-live="polite"><b>★ 0</b><small></small></div>`;
  root.appendChild(top);
  const unb = [onTap(top.querySelector(`.${c}-exit`), () => onExit())];
  top.querySelectorAll(`.${c}-lv button`).forEach(b => unb.push(onTap(b, () => onLevel(+b.dataset.l))));
  const tb = top.querySelector(`.${c}-tally b`), ts = top.querySelector(`.${c}-tally small`);
  const api = {
    setLevel(l) { top.querySelectorAll(`.${c}-lv button`).forEach(b => b.classList.toggle('on', +b.dataset.l === l)); },
    setTally(html, bump) { tb.innerHTML = html; if (bump) { tb.classList.remove('bump'); void tb.offsetWidth; tb.classList.add('bump'); } },
    setNote(t) { ts.textContent = t || ''; },
    destroy() { unb.forEach(u => u()); },
  };
  api.setLevel(level);
  return api;
}

// ---------- the game ----------
export function mount(el, ctx = {}) {
  injectCSS(C, stripCSS(C) + `
  .${C}-rule { flex: none; height: 66px; display: flex; align-items: center; justify-content: center; gap: 16px; background: linear-gradient(180deg, rgba(10,16,34,.9), rgba(10,16,34,.4)); border-bottom: 1px solid rgba(255,255,255,.06); position: relative; z-index: 2; }
  .${C}-rule .k { font: 600 15px ${FONT.display}; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3, #7d869a); }
  .${C}-rule .r { font: 700 34px ${FONT.display}; color: var(--gold, #f2b544); padding: 2px 22px; border-radius: 999px; border: 1.5px solid rgba(242,181,68,.45); background: rgba(242,181,68,.08); }
  .${C}-rule .r.flash { animation: ${C}-flash 1.2s ease; }
  @keyframes ${C}-flash { 0%, 60% { background: rgba(242,181,68,.45); color: #fff; } }
  .${C}-wrap { flex: 1; position: relative; min-height: 0; }
  .${C}-wrap canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; }
  .${C}-banner { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; z-index: 4; padding: 22px 46px; border-radius: 26px; background: rgba(8,12,28,.88); border: 1.5px solid rgba(242,181,68,.6); box-shadow: 0 0 60px rgba(242,181,68,.25); animation: ${C}-pop .45s cubic-bezier(.2,1.4,.4,1); }
  .${C}-banner .k { font: 700 46px ${FONT.display}; color: var(--ink, #f3efe6); }
  .${C}-banner .r { font: 700 40px ${FONT.display}; color: var(--gold, #f2b544); margin-top: 4px; }
  .${C}-banner.out { opacity: 0; transition: opacity .4s; }
  @keyframes ${C}-pop { from { transform: translate(-50%, -50%) scale(.6); opacity: 0; } }
  `);

  const say = t => { try { ctx.say && ctx.say(t); } catch (e) { /* ignore */ } };
  const sfx = n => { try { (ctx.sfx || coreSfx)(n); } catch (e) { /* ignore */ } };
  const load = k => { try { return ctx.load ? ctx.load(k) : null; } catch (e) { return null; } };
  const save = (k, v) => { try { ctx.save && ctx.save(k, v); } catch (e) { /* ignore */ } };
  const record = (k, ok) => { try { k && ctx.recordFact && ctx.recordFact(k, ok); } catch (e) { /* ignore */ } };
  const calm = reducedMotion();

  let level = clamp(Math.round(ctx.level || 1), 1, 3);
  const root = document.createElement('div');
  root.className = C;
  el.appendChild(root);
  const strip = makeStrip(root, C, meta.title, level, { onExit: () => ctx.onExit && ctx.onExit(), onLevel: l => { level = l; strip.setLevel(l); startRound(); } });
  const band = document.createElement('div');
  band.className = `${C}-rule`;
  band.innerHTML = `<span class="k">Blast</span><span class="r"></span>`;
  root.appendChild(band);
  const ruleEl = band.querySelector('.r');
  const wrap = document.createElement('div');
  wrap.className = `${C}-wrap`;
  root.appendChild(wrap);
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-label', 'Asteroid field. Tap an asteroid to blast it.');
  wrap.appendChild(cv);
  const g = cv.getContext('2d');

  // Rocket picture from the shared art set.
  const rocketImg = new Image();
  rocketImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(art('rocket', 200).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));

  let W = 800, H = 500, dpr = 1;
  let R, rules, ruleIdx, rule, phase, gameT, spawnT, tailT, tally, wave, lastN, frozen = false;
  let asts = [], lasers = [], parts = [], labels = [], timers = [], starsBg = [];
  const rocket = { ang: 0, aimT: 0, kick: 0 };
  let banner = null, sumEl = null;
  let raf = 0, last = 0, alive = true;

  const best = () => { const b = load('best'); return b && typeof b === 'object' ? b : {}; };
  function showBest() { const b = best()[level]; strip.setNote(b ? `Best ${b}` : ''); }

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(320, r.width); H = Math.max(240, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!starsBg.length || starsBg.W !== W) {
      const SR = makeRand(7);
      starsBg = Array.from({ length: 110 }, () => ({ x: SR.next() * W, y: SR.next() * H, z: SR.next(), tw: SR.next() * 6 }));
      starsBg.W = W;
    }
  }
  const ro = new ResizeObserver(() => { resize(); if (!raf) draw(); });
  ro.observe(wrap);
  resize();

  const rad = () => clamp(Math.min(W, H) * 0.1, 46, 66);
  const rocketPos = () => ({ x: W / 2, y: H - 64 });
  const later = (s, fn) => timers.push({ at: gameT + s, fn });

  function setRule(r, flash) {
    rule = r;
    ruleEl.textContent = r.text;
    if (flash) { ruleEl.classList.remove('flash'); void ruleEl.offsetWidth; ruleEl.classList.add('flash'); }
  }

  function startRound() {
    R = makeRand();
    rules = pickPair(level, R);
    ruleIdx = 0;
    setRule(rules[0], true);
    phase = 'play'; gameT = 0; spawnT = 0.5; tailT = 0; tally = 0; lastN = null;
    wave = { spawned: 0, yes: 0 };
    asts = []; lasers = []; parts = []; labels = []; timers = [];
    if (banner) { banner.remove(); banner = null; }
    if (sumEl) { sumEl.remove(); sumEl = null; }
    strip.setTally('★ 0');
    showBest();
    say(rule.say);
  }

  // ----- spawning -----
  function wantYes() {
    const onScreenYes = asts.some(a => !a.dead && a.fits);
    if (wave.spawned >= 2) {
      const ratio = wave.yes / wave.spawned;
      if (ratio < 0.42) return true;
      if (ratio > 0.62) return false;
    }
    if (!onScreenYes && asts.filter(a => !a.dead).length >= 1) return R.chance(0.75);
    return R.chance(0.55);
  }
  function pickNumber(yes) {
    const showing = new Set(asts.filter(a => !a.dead).map(a => a.n));
    const ok = list => list.filter(n => !showing.has(n) && n !== lastN);
    let list = ok(yes ? rule.yes : rule.no);
    if (!list.length) list = ok(yes ? rule.no : rule.yes);
    if (!list.length) list = rule.pool;
    return R.pick(list);
  }
  function makeShape() {
    const k = 11, pts = [];
    for (let i = 0; i < k; i++) pts.push([(i / k) * Math.PI * 2, 0.84 + R.next() * 0.2]);
    const craters = Array.from({ length: 3 }, () => ({ a: R.next() * 6.28, d: 0.25 + R.next() * 0.4, s: 0.1 + R.next() * 0.1 }));
    return { pts, craters, tint: R.int(0, 2) };
  }
  function spawn(n, fx, fy) {
    const r = rad();
    if (n === undefined) {
      const yes = wantYes();
      n = pickNumber(yes);
    }
    let x;
    if (fx !== undefined) x = fx * W;
    else {
      let tries = 0;
      do { x = r + 18 + R.next() * (W - 2 * r - 36); tries++; }
      while (tries < 40 && asts.some(a => !a.dead && Math.abs(a.x - x) < 2.4 * r && a.y < 3.2 * r));
    }
    const a = {
      n, x, y: fy !== undefined ? fy * H : -r * 0.35, r, rot: R.next() * 6.28, spin: (R.next() - 0.5) * 0.5, sway: R.next() * 6.28,
      shape: makeShape(), born: fy !== undefined ? gameT - 2 : gameT, wob: 0, dead: false, fits: rule.test(n), alpha: 0, fast: false,
    };
    asts.push(a);
    lastN = n;
    return a;
  }

  // ----- tapping -----
  function hitTest(px, py) {
    let best = null, bd = Infinity;
    for (const a of asts) {
      if (a.dead || a.alpha < 0.3) continue;
      const d = Math.hypot(a.x - px, a.y - py);
      if (d < a.r * 1.18 && d < bd) { bd = d; best = a; }
    }
    return best;
  }
  function tapAst(a) {
    const rp = rocketPos();
    rocket.ang = clamp(Math.atan2(a.x - rp.x, rp.y - a.y), -1.1, 1.1);
    rocket.aimT = 0.7; rocket.kick = 1;
    if (a.fits) {
      a.dead = true;
      lasers.push({ a, tx: a.x, ty: a.y, t: 0, life: 0.24, ok: true });
      sfx('pew');
      later(0.13, () => { burst(a); sfx('pop'); });
      tally++;
      strip.setTally(`★ ${tally}`, true);
      if (rule.hit) labels.push({ x: a.x, y: a.y - a.r * 0.2, text: rule.hit(a.n), kind: 'hit', t: 0, life: 1.9, rise: 26 });
      if (rule.fact) record(rule.fact(a.n), true);
    } else {
      lasers.push({ a, tx: a.x, ty: a.y, t: 0, life: 0.34, ok: false });
      sfx('tick');
      a.wob = 0.55;
      const prev = labels.find(l => l.follow === a);
      if (prev) prev.t = 0;
      else labels.push({ follow: a, text: rule.why(a.n), kind: 'why', t: 0, life: 2.6 });
    }
  }
  const onDown = e => {
    if (phase === 'done') return;
    const r = cv.getBoundingClientRect();
    const a = hitTest(e.clientX - r.left, e.clientY - r.top);
    if (a) { e.preventDefault(); tapAst(a); }
  };
  cv.addEventListener('pointerdown', onDown);

  function burst(a) {
    const n = calm ? 12 : 30;
    const cols = [COL.tens, COL.ones, COL.ink, '#ffd27a'];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 220;
      parts.push({ x: a.x, y: a.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, t: 0, life: 0.6 + Math.random() * 0.5, col: cols[i % cols.length], s: 2 + Math.random() * 3.5, star: i % 3 === 0 });
    }
    for (let i = 0; i < 7; i++) {
      const ang = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
      parts.push({ x: a.x, y: a.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, t: 0, life: 0.8, col: '#8f949e', s: 4 + Math.random() * 6, rock: true });
    }
    parts.push({ ring: true, x: a.x, y: a.y, t: 0, life: 0.45, r0: a.r * 0.6, r1: a.r * 1.8 });
  }

  // ----- phases -----
  function nextRule() {
    phase = 'banner';
    sfx('whoosh');
    banner = document.createElement('div');
    banner.className = `${C}-banner`;
    banner.innerHTML = `<div class="k">New rule!</div><div class="r">${esc(rules[1].text)}</div>`;
    wrap.appendChild(banner);
    say(`New rule! ${rules[1].say}`);
    later(2.4, () => {
      if (banner) { banner.classList.add('out'); const b = banner; later(0.45, () => b.remove()); banner = null; }
      ruleIdx = 1;
      setRule(rules[1], true);
      wave = { spawned: 0, yes: 0 };
      spawnT = 0.3;
      phase = 'play';
    });
  }
  function finish() {
    phase = 'done';
    const b = best();
    const prev = b[level] || 0;
    const isBest = tally > prev;
    if (isBest) { b[level] = tally; save('best', b); }
    const plays = (load('plays') || 0) + 1;
    save('plays', plays);
    showBest();
    sfx('chime');
    sumEl = document.createElement('div');
    sumEl.className = `${C}-sum`;
    sumEl.innerHTML = `<div class="${C}-card">
      <div class="eb">Round complete</div>
      <div class="big">★ ${tally}</div>
      <p>${tally === 1 ? 'asteroid' : 'asteroids'} blasted</p>
      <p class="best">${isBest && tally > 0 ? 'Your best yet at this level.' : prev ? `Your best at level ${level}: ${prev}` : ''}</p>
      <div class="row"><button type="button" class="${C}-btn go">Play again</button>${level < 3 ? `<button type="button" class="${C}-btn ghost up">Try level ${level + 1}</button>` : ''}</div>
    </div>`;
    wrap.appendChild(sumEl);
    const unb = [];
    unb.push(onTap(sumEl.querySelector('.go'), () => { unb.forEach(u => u()); startRound(); }));
    const up = sumEl.querySelector('.up');
    if (up) unb.push(onTap(up, () => { unb.forEach(u => u()); level += 1; strip.setLevel(level); startRound(); }));
  }

  // ----- loop -----
  function step(dt) {
    gameT += dt;
    for (let i = timers.length - 1; i >= 0; i--) if (gameT >= timers[i].at) { const t = timers.splice(i, 1)[0]; t.fn(); }
    const pace = PACE[level];
    const speed = pace.speed * H;
    if (phase === 'play' && !frozen) {
      spawnT -= dt;
      const live = asts.filter(a => !a.dead).length;
      if (wave.spawned < WAVE && ((spawnT <= 0 && live < pace.max) || live < 2 && spawnT < pace.every - 1.2)) {
        const a = spawn();
        wave.spawned++; if (a.fits) wave.yes++;
        spawnT = pace.every;
      }
      if (wave.spawned >= WAVE) { phase = 'tail'; tailT = 0; }
    }
    if (phase === 'tail') {
      tailT += dt;
      if (tailT > 5) asts.forEach(a => { a.fast = true; });
      if (!asts.length && !lasers.length) {
        if (ruleIdx === 0) nextRule(); else later(0.6, finish), phase = 'ending';
      }
    }
    for (const a of asts) {
      if (!frozen) {
        a.y += (a.fast ? speed * 5 : speed) * dt;
        a.x += Math.sin(gameT * 0.7 + a.sway) * 7 * dt;
        a.rot += a.spin * dt;
      }
      a.wob = Math.max(0, a.wob - dt);
      const fadeIn = clamp((gameT - a.born) / 0.5, 0, 1);
      const fadeOut = clamp((H - 34 - a.y) / 110, 0, 1);
      a.alpha = Math.min(fadeIn, fadeOut);
    }
    asts = asts.filter(a => !(a.dead && !lasers.some(l => l.a === a)) && a.y < H - 34);
    for (const l of lasers) l.t += dt;
    lasers = lasers.filter(l => l.t < l.life);
    for (const p of parts) {
      p.t += dt;
      if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy = p.vy * 0.97 + 30 * dt; }
    }
    parts = parts.filter(p => p.t < p.life);
    for (const l of labels) l.t += dt;
    labels = labels.filter(l => l.t < l.life && (!l.follow || asts.includes(l.follow)));
    if (rocket.aimT > 0) rocket.aimT -= dt; else rocket.ang *= Math.pow(0.02, dt);
    rocket.kick = Math.max(0, rocket.kick - dt * 5);
  }

  function drawBg() {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#060a18'); bg.addColorStop(0.7, '#0a1328'); bg.addColorStop(1, '#101c3a');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (const s of starsBg) {
      if (!calm && !frozen) s.y += (4 + s.z * 12) * (1 / 60);
      if (s.y > H) { s.y -= H; s.x = Math.random() * W; }
      const tw = 0.45 + 0.4 * Math.sin(gameT * 1.4 + s.tw);
      g.globalAlpha = (0.25 + s.z * 0.6) * tw;
      g.fillStyle = s.z > 0.85 ? '#ffe9b8' : '#cfe3ff';
      g.beginPath(); g.arc(s.x, s.y, 0.6 + s.z * 1.3, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
    const hz = g.createLinearGradient(0, H - 90, 0, H);
    hz.addColorStop(0, 'rgba(79,157,255,0)'); hz.addColorStop(1, 'rgba(79,157,255,.10)');
    g.fillStyle = hz; g.fillRect(0, H - 90, W, 90);
  }

  const TINTS = [['#9aa0ab', '#5a5f6a'], ['#a3988c', '#5f564c'], ['#8e98a8', '#4f5866']];
  function drawAst(a) {
    const r = a.r;
    const wx = a.wob > 0 ? Math.sin(gameT * 46) * a.wob * 10 : 0;
    g.save();
    g.globalAlpha = a.alpha * (a.dead ? 0.6 : 1);
    g.translate(a.x + wx, a.y);
    g.save();
    g.rotate(a.rot);
    const [c1, c2] = TINTS[a.shape.tint];
    const grd = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    g.beginPath();
    a.shape.pts.forEach(([ang, k], i) => { const px = Math.cos(ang) * r * k, py = Math.sin(ang) * r * k; i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.closePath();
    g.fillStyle = grd; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(243,239,230,.55)'; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = 'rgba(0,0,0,.18)';
    for (const c of a.shape.craters) { g.beginPath(); g.arc(Math.cos(c.a) * r * c.d, Math.sin(c.a) * r * c.d, r * c.s, 0, 6.283); g.fill(); }
    g.restore();
    const fs = Math.round(r * (a.n >= 100 ? 0.72 : 0.92));
    g.font = `700 ${fs}px ${FONT.display}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = 'rgba(6,9,20,.85)'; g.lineJoin = 'round';
    g.strokeText(String(a.n), 0, 2);
    g.fillStyle = COL.ink; g.fillText(String(a.n), 0, 2);
    g.restore();
  }

  function nose() {
    const rp = rocketPos();
    return { x: rp.x + Math.sin(rocket.ang) * 54, y: rp.y - Math.cos(rocket.ang) * 54 };
  }
  function drawLaser(l) {
    const n = nose();
    const k = l.t / l.life;
    g.save();
    g.lineCap = 'round';
    if (l.ok) {
      g.globalAlpha = 1 - k * 0.8;
      g.shadowColor = COL.ones; g.shadowBlur = 18;
      g.strokeStyle = 'rgba(95,212,255,.85)'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(l.tx, l.ty); g.stroke();
      g.shadowBlur = 0; g.strokeStyle = '#ffffff'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(l.tx, l.ty); g.stroke();
    } else {
      // The beam fizzles out halfway: short dashes and a puff.
      const fx = n.x + (l.tx - n.x) * 0.45, fy = n.y + (l.ty - n.y) * 0.45;
      g.globalAlpha = 1 - k;
      g.setLineDash([10, 9]); g.lineDashOffset = -l.t * 120;
      g.strokeStyle = 'rgba(160,178,210,.8)'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(fx, fy); g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(180,190,210,.5)';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(fx + Math.cos(i * 1.7) * 10 * (1 + k * 2), fy + Math.sin(i * 1.7) * 10 * (1 + k * 2), 5 + k * 6, 0, 6.283); g.fill(); }
    }
    g.restore();
  }
  function drawParts() {
    g.save();
    for (const p of parts) {
      const k = p.t / p.life;
      if (p.ring) {
        g.globalAlpha = 1 - k; g.strokeStyle = COL.tens; g.lineWidth = 4 * (1 - k) + 1;
        g.beginPath(); g.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * k, 0, 6.283); g.stroke();
        continue;
      }
      g.globalAlpha = 1 - k;
      g.fillStyle = p.col;
      if (p.star) {
        const s = p.s * 2.2;
        g.beginPath(); g.moveTo(p.x, p.y - s); g.lineTo(p.x + s * 0.3, p.y - s * 0.3); g.lineTo(p.x + s, p.y); g.lineTo(p.x + s * 0.3, p.y + s * 0.3);
        g.lineTo(p.x, p.y + s); g.lineTo(p.x - s * 0.3, p.y + s * 0.3); g.lineTo(p.x - s, p.y); g.lineTo(p.x - s * 0.3, p.y - s * 0.3); g.closePath(); g.fill();
      } else { g.beginPath(); g.arc(p.x, p.y, p.s, 0, 6.283); g.fill(); }
    }
    g.restore();
  }
  function drawRocket() {
    const rp = rocketPos();
    g.save();
    g.translate(rp.x, rp.y + rocket.kick * 6);
    const glow = g.createRadialGradient(0, 50, 2, 0, 50, 46);
    glow.addColorStop(0, 'rgba(255,170,90,.55)'); glow.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = glow; g.beginPath(); g.ellipse(0, 50, 46, 26, 0, 0, 6.283); g.fill();
    g.rotate(rocket.ang);
    const s = 116;
    if (rocketImg.complete && rocketImg.naturalWidth) g.drawImage(rocketImg, -s / 2, -s / 2 - 4, s, s);
    else { g.fillStyle = COL.ink; g.beginPath(); g.moveTo(0, -54); g.lineTo(18, 30); g.lineTo(-18, 30); g.closePath(); g.fill(); }
    const fl = 10 + Math.sin(gameT * 30) * 3;
    g.fillStyle = 'rgba(255,154,82,.85)';
    g.beginPath(); g.moveTo(-7, 52); g.quadraticCurveTo(0, 52 + fl * 2, 7, 52); g.closePath(); g.fill();
    g.restore();
  }
  function pill(x, y, text, kind, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.font = `600 24px ${FONT.display}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(text).width + 30, h = 42;
    x = clamp(x, w / 2 + 6, W - w / 2 - 6);
    g.beginPath();
    if (g.roundRect) g.roundRect(x - w / 2, y - h / 2, w, h, 21); else g.rect(x - w / 2, y - h / 2, w, h);
    g.fillStyle = 'rgba(8,12,28,.92)'; g.fill();
    g.lineWidth = 2; g.strokeStyle = kind === 'hit' ? 'rgba(242,181,68,.8)' : 'rgba(255,179,107,.75)'; g.stroke();
    g.fillStyle = kind === 'hit' ? COL.tens : COL.ink;
    g.fillText(text, x, y + 1);
    g.restore();
  }
  function drawLabels() {
    for (const l of labels) {
      const fade = Math.min(1, (l.life - l.t) / 0.4, l.t / 0.12);
      if (l.follow) {
        const a = l.follow;
        const below = a.y + a.r + 30 < H - 130;
        pill(a.x, below ? a.y + a.r + 28 : a.y - a.r - 28, l.text, l.kind, fade * Math.max(0.3, a.alpha));
      } else pill(l.x, l.y - (l.rise || 0) * l.t, l.text, l.kind, fade);
    }
  }

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBg();
    asts.forEach(drawAst);
    lasers.forEach(drawLaser);
    drawParts();
    drawRocket();
    drawLabels();
  }

  function frame(t) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    step(dt);
    draw();
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }
  function run() { if (!raf && alive && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else run(); };
  document.addEventListener('visibilitychange', onVis);

  startRound();
  run();

  // Tests only.
  const debug = !!(ctx.debug || /[?&]arcdebug\b/.test(location.search));
  if (debug) {
    window.__arc = {
      id: meta.id,
      rule: () => rule.text,
      fits: n => rule.test(n),
      tally: () => tally,
      time: () => gameT,
      phase: () => phase,
      freeze(on = true) { frozen = !!on; },
      clear() { asts = []; labels = []; },
      spawn(n, fx = 0.5, fy = 0.4) { const a = spawn(n, fx, fy); a.alpha = 1; return a.n; },
      list() {
        const r = cv.getBoundingClientRect();
        return asts.filter(a => !a.dead).map(a => ({ n: a.n, fits: a.fits, cx: r.left + a.x, cy: r.top + a.y, r: a.r }));
      },
      labels: () => labels.map(l => l.text),
      endWave() { wave.spawned = WAVE; },
      forceRule(type) { const r = rulesFor(level, R).find(x => x.type === type); if (r) { rules[ruleIdx] = r; setRule(r); } return rule.text; },
      warp(sec) { for (let t = 0; t < sec; t += 1 / 60) step(1 / 60); draw(); return gameT; },
    };
  }

  return {
    destroy() {
      alive = false;
      cancelAnimationFrame(raf); raf = 0;
      document.removeEventListener('visibilitychange', onVis);
      cv.removeEventListener('pointerdown', onDown);
      ro.disconnect();
      strip.destroy();
      timers = [];
      if (debug && window.__arc && window.__arc.id === meta.id) delete window.__arc;
      el.replaceChildren();
    },
  };
}
