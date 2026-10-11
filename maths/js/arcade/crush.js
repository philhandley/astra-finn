// Crystal Crush (SVG). Join touching number crystals that make the target, Candy Crush style.
// Add: "Make 10" (L1 pairs to 10 with 1 to 9; L2 targets 10 to 20 with 2 crystals; L3 any target to 20 with 2 or 3).
// Take away: "Difference of 3", big take away small (L1 differences 1 to 5 with numbers to 10; L2 differences to 9
// with numbers to 20; L3 like L2, then a "Take away chain": the first crystal minus the next one or two lands on the target).
// Drag a path through touching crystals (up, down, left, right) or tap one, then a neighbour. A match bursts with
// sparkles, a star flies to the tally, the column above falls with a bounce and new crystals drop in.
// The target changes every 4 matches ("New target!"). Rounds of 12 matches, then a summary card.
// No timer, no lives, no fail state: a path that misses springs back with a kind line. The board always has
// at least two valid moves (refills are chosen to keep moves; otherwise the board swirls into a fresh one).
// Style v2: white board, a soft lavender tray, six flat outlined gem shapes (one per colour) with a lip and a highlight.
// URL params: ?mode=add|sub picks the mode (otherwise the saved one). Tests only: ctx.debug, ?debug or ?arcdebug
// exposes window.__crush (state, moves, eval, centre, placed, hint, swirl, timerCount, svg).
import { S, svgPoint, onTap, injectCSS, clamp, esc, reducedMotion } from '../core/dom.js';
import { makeRand } from '../core/rand.js';
import { COL, PAL, FONT } from '../core/theme.js';
import { factKey } from '../core/facts.js';
import { sfx as coreSfx } from '../core/sfx.js';

export const meta = { id: 'crush', title: 'Crystal Crush', about: 'Join crystals that make the number. Add or take away.', icon: 'crystal' };

const C = 'arc-crush';
export const COLS = 7, ROWS = 6, ROUND = 12, EVERY = 4;
const MINUS = '−';

// ---------- crystals ----------
const mix = (hex, to, t) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = (x, s) => (x >> s) & 255;
  const m = s => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1);
};
// One shape per colour (drawn in a 100 x 100 box); cy is where the numeral sits.
const GEMS = [
  { name: 'red', fill: PAL.red, dark: PAL.redDark, d: 'M30 7H70Q93 7 93 30V70Q93 93 70 93H30Q7 93 7 70V30Q7 7 30 7Z', cy: 50 },
  { name: 'orange', fill: PAL.orange, dark: PAL.orangeDark, d: 'M27 7H73L95 50L73 93H27L5 50Z', cy: 50 },
  { name: 'yellow', fill: PAL.yellow, dark: PAL.yellowDark, d: 'M5 50A45 45 0 1 1 95 50A45 45 0 1 1 5 50Z', cy: 50 },
  { name: 'green', fill: PAL.green, dark: PAL.greenDark, d: 'M31 6H69L94 31V69L69 94H31L6 69V31Z', cy: 50 },
  { name: 'blue', fill: PAL.blue, dark: PAL.blueDark, d: 'M19 8H81L97 35L50 96L3 35Z', cy: 40 },
  { name: 'purple', fill: PAL.purple, dark: PAL.purpleDark, d: 'M50 4L93 27V73L50 96L7 73V27Z', cy: 50 },
].map(g => ({ ...g, light: mix(g.fill, '#ffffff', 0.26) }));
// The same number always has the same colour and shape, so a six-year-old can spot "the other 7".
// Partners that make 10 or 20 always differ in colour, as do n and n + 10 and neighbouring numbers.
//              1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
const GEM_OF = [0, 0, 1, 2, 3, 4, 5, 3, 5, 4, 2, 5, 0, 4, 1, 3, 2, 5, 0, 1, 4];
const gemOf = n => GEMS[GEM_OF[clamp(Math.round(n), 1, 20)]];
const HI = 'M20 33Q23 19 37 15';
function gemMarkup(n, num = true) {
  const g = gemOf(n);
  const fs = n >= 10 ? 46 : 56;
  return `<path d="${g.d}" transform="translate(0 6)" fill="${g.dark}" stroke="${COL.ink}" stroke-width="4.5" stroke-linejoin="round"/>`
    + `<path d="${g.d}" fill="${g.fill}" stroke="${COL.ink}" stroke-width="4.5" stroke-linejoin="round"/>`
    + `<path d="${g.d}" transform="translate(50 ${g.cy}) scale(.56) translate(-50 ${-g.cy})" fill="${g.light}"/>`
    + `<path d="${HI}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".85"/>`
    + (num ? `<text x="50" y="${g.cy + 2}" text-anchor="middle" dominant-baseline="central" font-family="${FONT.display}" font-weight="800" font-size="${fs}" fill="#fff" stroke="${COL.ink}" stroke-width="8" stroke-linejoin="round" paint-order="stroke">${n}</text>` : '');
}

// ---------- the model (pure, seeded; also driven by the tests) ----------
const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
const NB = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const inside = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const emptyGrid = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

// kind: 'sum' (add 2..max crystals), 'diff' (two crystals, big take away small), 'chain' (first − next (− next)).
function mkTarget(kind, n, max, level) {
  const t = { kind, n, max };
  if (kind === 'sum') {
    [t.lo, t.hi] = max === 3 ? [1, Math.min(n - 1, 12)] : level === 1 ? [1, 9] : [Math.max(1, n - 15), Math.min(n - 1, 15)];
    t.eb = 'Add'; t.text = `Make ${n}`;
    t.say = max === 3 ? `Make ${n}. Use 2 or 3 crystals.` : `Make ${n}.`;
    t.how = max === 3 ? `Join 2 or 3 touching crystals that make ${n}.` : `Join two touching crystals that make ${n}.`;
  } else if (kind === 'diff') {
    [t.lo, t.hi] = [1, level === 1 ? 10 : 20];
    t.eb = 'Take away'; t.text = `Difference of ${n}`;
    t.say = `Difference of ${n}. Big take away small makes ${n}.`;
    t.how = `Join two touching crystals. Big take away small makes ${n}.`;
  } else {
    [t.lo, t.hi] = [1, 20];
    t.eb = 'Take away chain'; t.text = `Make ${n}`;
    t.say = `Take away chain. Start on a big number, then take away to make ${n}.`;
    t.how = `Start on a big number. Take away 1 or 2 touching crystals to land on ${n}.`;
  }
  return t;
}
function targetPool(mode, level, seg) {
  if (mode === 'add') {
    if (level === 1) return [mkTarget('sum', 10, 2, 1)];
    if (level === 2) return range(10, 20).map(n => mkTarget('sum', n, 2, 2));
    return range(8, 20).map(n => mkTarget('sum', n, 3, 3));
  }
  if (level === 1) return range(1, 5).map(n => mkTarget('diff', n, 2, 1));
  if (level === 2) return range(1, 9).map(n => mkTarget('diff', n, 2, 2));
  // Level 3: a difference first, then take away chains.
  return seg === 0 ? range(2, 9).map(n => mkTarget('diff', n, 2, 3)) : range(2, 9).map(n => mkTarget('chain', n, 3, 3));
}
const sameTarget = (a, b) => !!a && !!b && a.kind === b.kind && a.n === b.n;
function makeTarget(mode, level, seg, R, avoid, grid) {
  let pool = targetPool(mode, level, seg);
  if (avoid && pool.length > 1) pool = pool.filter(t => !sameTarget(t, avoid));
  if (grid) {
    // Prefer a target the board already has moves for (Finn re-sees the same crystals in a new way).
    const good = pool.filter(t => findMoves(grid, t, 3).length >= 3);
    if (good.length) return R.pick(good);
  }
  return R.pick(pool);
}

// Status of a path of numbers: empty, open (keep going), match, over (past the target), full (no room left).
export function evalNums(nums, tg) {
  const k = nums.length;
  if (!k) return { st: 'empty', v: 0 };
  if (tg.kind === 'sum') {
    const v = nums.reduce((a, b) => a + b, 0);
    if (k === 1) return { st: v >= tg.n ? 'over' : 'open', v };
    if (v === tg.n) return { st: 'match', v };
    if (v > tg.n) return { st: 'over', v };
    return { st: k >= tg.max ? 'full' : 'open', v };
  }
  if (tg.kind === 'diff') {
    if (k === 1) return { st: 'open', v: nums[0] };
    const v = Math.abs(nums[0] - nums[1]);
    return { st: v === tg.n ? 'match' : 'full', v };
  }
  const v = nums.slice(1).reduce((a, b) => a - b, nums[0]);
  if (k === 1) return { st: v <= tg.n ? 'over' : 'open', v };
  if (v === tg.n) return { st: 'match', v };
  if (v < tg.n) return { st: 'over', v };
  return { st: k >= tg.max ? 'full' : 'open', v };
}

// Every valid move as a path of [r, c]. Zeros (holes) are skipped.
export function findMoves(grid, tg, limit = Infinity) {
  const out = [], seen = new Set();
  const val = (r, c) => (inside(r, c) ? grid[r][c] : 0);
  const add = p => {
    const ids = p.map(([r, c]) => r * COLS + c);
    const key = tg.kind === 'chain' ? ids.join('>') : ids.sort((a, b) => a - b).join(',');
    if (!seen.has(key)) { seen.add(key); out.push(p); }
  };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const a = grid[r][c];
    if (!a) continue;
    for (const [dr, dc] of NB) {
      const r2 = r + dr, c2 = c + dc, b = val(r2, c2);
      if (!b) continue;
      const e2 = evalNums([a, b], tg);
      if (e2.st === 'match') add([[r, c], [r2, c2]]);
      else if (tg.max === 3 && e2.st === 'open') {
        for (const [er, ec] of NB) {
          const r3 = r2 + er, c3 = c2 + ec;
          if (r3 === r && c3 === c) continue;
          const x = val(r3, c3);
          if (x && evalNums([a, b, x], tg).st === 'match') add([[r, c], [r2, c2], [r3, c3]]);
        }
      }
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// A number for a new crystal; with probability `bias` it is a partner for a neighbour.
function sampleNum(tg, R, nbrs, bias) {
  if (nbrs.length && R.chance(bias)) {
    const v = R.pick(nbrs);
    const opts = [];
    if (tg.kind === 'sum') {
      if (tg.max === 3 && R.chance(0.4) && tg.n - v >= 3) opts.push(R.int(1, tg.n - v - 1));
      else opts.push(tg.n - v);
    } else opts.push(v + tg.n, v - tg.n);
    const ok = opts.filter(x => x >= tg.lo && x <= tg.hi);
    if (ok.length) return R.pick(ok);
  }
  return R.int(tg.lo, tg.hi);
}
function plant(g, tg, R) {
  const r = R.int(0, ROWS - 1), c = R.int(0, COLS - 1);
  const [r2, c2] = R.pick(NB.map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => inside(a, b)));
  let a, b;
  if (tg.kind === 'sum') { a = R.int(Math.max(tg.lo, tg.n - tg.hi), Math.min(tg.hi, tg.n - tg.lo)); b = tg.n - a; }
  else { b = R.int(tg.lo, tg.hi - tg.n); a = b + tg.n; }
  g[r][c] = a; g[r2][c2] = b;
}
export function genBoard(tg, R) {
  let best = null, bestK = -1;
  for (let i = 0; i < 30; i++) {
    const g = emptyGrid();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const nb = [];
      if (c) nb.push(g[r][c - 1]);
      if (r) nb.push(g[r - 1][c]);
      g[r][c] = sampleNum(tg, R, nb, 0.2);
    }
    const k = findMoves(g, tg, 5).length;
    if (k >= 5) return g;
    if (k > bestK) { best = g; bestK = k; }
  }
  for (let i = 0; i < 80 && findMoves(best, tg, 3).length < 3; i++) plant(best, tg, R);
  return best;
}
// Remove the matched cells and let each column fall. Returns the falls and the holes (top cells to refill).
function collapse(grid, cells) {
  const gone = new Set(cells.map(([r, c]) => r * COLS + c));
  const falls = [], holes = [];
  for (let c = 0; c < COLS; c++) {
    let w = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (gone.has(r * COLS + c)) continue;
      if (w !== r) { grid[w][c] = grid[r][c]; falls.push({ c, from: r, to: w }); }
      w--;
    }
    for (let r = w; r >= 0; r--) { grid[r][c] = 0; holes.push({ r, c, drop: w + 1, n: 0 }); }
  }
  return { falls, holes };
}
// Choose numbers for the holes that keep (at least) four moves on the board when possible.
function refill(grid, holes, tg, R) {
  let best = null, bestK = -1;
  for (let i = 0; i < 30; i++) {
    for (const h of holes) grid[h.r][h.c] = 0;
    for (const h of holes) {
      const nb = NB.map(([dr, dc]) => [h.r + dr, h.c + dc]).filter(([r, c]) => inside(r, c) && grid[r][c]).map(([r, c]) => grid[r][c]);
      grid[h.r][h.c] = sampleNum(tg, R, nb, 0.5);
    }
    const k = findMoves(grid, tg, 5).length;
    if (k > bestK) { bestK = k; best = holes.map(h => grid[h.r][h.c]); }
    if (k >= 4) break;
  }
  holes.forEach((h, i) => { grid[h.r][h.c] = best[i]; h.n = best[i]; });
  return bestK;
}

export function makeModel(mode, level, R = makeRand()) {
  const M = { mode, level, R, grid: null, tg: null, seg: 0, matches: 0, stars: 0, chains: 0, targets: [], shuffles: 0 };
  M.start = () => {
    M.seg = 0; M.matches = 0; M.stars = 0; M.chains = 0;
    M.tg = makeTarget(mode, level, 0, R, null, null);
    M.targets = [M.tg];
    M.grid = genBoard(M.tg, R);
    return M;
  };
  M.moves = limit => findMoves(M.grid, M.tg, limit);
  M.nums = cells => cells.map(([r, c]) => M.grid[r][c]);
  M.eval = cells => evalNums(M.nums(cells), M.tg);
  M.reshuffle = () => { M.grid = genBoard(M.tg, R); M.shuffles++; };
  // Apply a matching path: score, gravity, maybe a new target, refill, and keep two moves on the board.
  M.match = cells => {
    const nums = M.nums(cells);
    const ev = evalNums(nums, M.tg);
    if (ev.st !== 'match') return null;
    const tg = M.tg;
    M.matches++;
    M.stars += cells.length - 1;
    if (cells.length > 2) M.chains++;
    let fact = null;
    if (cells.length === 2) {
      if (tg.kind === 'sum') { if (nums[0] + nums[1] <= 20) fact = factKey('+', nums[0], nums[1]); }
      else fact = factKey('-', Math.max(...nums), Math.min(...nums));
    }
    const plan = collapse(M.grid, cells);
    const done = M.matches >= ROUND;
    let newTarget = null;
    if (!done && M.matches % EVERY === 0) {
      M.seg++;
      const t = makeTarget(mode, level, M.seg, R, M.tg, M.grid);
      if (!sameTarget(t, M.tg)) newTarget = t;
      M.tg = t;
      M.targets.push(t);
    }
    refill(M.grid, plan.holes, M.tg, R);
    let shuffled = false;
    if (!done && findMoves(M.grid, M.tg, 2).length < 2) { M.reshuffle(); shuffled = true; }
    return { nums, tg, fact, stars: cells.length - 1, falls: plan.falls, holes: plan.holes, newTarget, shuffled, done };
  };
  return M;
}

// Plays n random valid matches on the model (no drawing). Used by the tests.
export function simulate(mode, level, n = 200, seed = 1) {
  const R = makeRand(seed);
  const M = makeModel(mode, level, R).start();
  const out = { mode, level, matches: 0, rounds: 1, minMoves: Infinity, shuffles: 0, changes: 0, facts: 0, targets: new Set(), problems: [] };
  const check = where => {
    const k = M.moves().length;
    out.minMoves = Math.min(out.minMoves, k);
    if (k < 2) out.problems.push(`${where}: only ${k} moves`);
    for (const row of M.grid) for (const v of row) if (!(v >= 1 && v <= 20)) out.problems.push(`${where}: bad number ${v}`);
    out.targets.add(`${M.tg.kind}${M.tg.n}/${M.tg.max}`);
  };
  check('start');
  while (out.matches < n) {
    const p = R.pick(M.moves());
    const res = p && M.match(p);
    if (!res) { out.problems.push('a move did not match'); break; }
    out.matches++;
    if (res.fact) out.facts++;
    if (res.newTarget) out.changes++;
    if (res.shuffled) out.shuffles++;
    if (res.done) { M.start(); out.rounds++; }
    check(`after ${out.matches}`);
  }
  out.targets = [...out.targets].sort();
  return out;
}

// ---------- shared strip (each arcade file carries its own copy; this one adds the Add / Take away toggle) ----------
// Black top bar like the app's mission bar: chunky Exit and level keys (solid bottom edge), white title, quiet star tally.
const BACK = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLUS_I = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/></svg>';
const MINUS_I = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/></svg>';
const STAR_D = 'M50 6l12 28 30 3-23 20 7 30-26-16-26 16 7-30L8 37l30-3z';
const starSvg = (size, fill = '#ffcc33') => `<svg class="st" viewBox="-6 -6 112 112" width="${size}" height="${size}" aria-hidden="true"><path d="${STAR_D}" fill="${fill}" stroke="#1b1e2e" stroke-width="7" stroke-linejoin="round"/></svg>`;
const withStars = (html, size) => String(html).replace(/★/g, starSvg(size)).replace(/☆/g, starSvg(size, '#d3d9e3'));
function stripCSS(c) {
  return `
  .${c} { position: absolute; inset: 0; display: flex; flex-direction: column; background: #000; color: #fff; font-family: ${FONT.display}; overflow: hidden; user-select: none; -webkit-user-select: none; }
  .${c} button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; font-family: ${FONT.display}; }
  .${c}-top { flex: none; height: 82px; display: flex; align-items: center; gap: 14px; padding: 0 16px 4px; background: #000; position: relative; z-index: 3; }
  .${c}-key { appearance: none; cursor: pointer; min-width: 60px; min-height: 60px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 16px; border: 2px solid #3a3f4d; background: #23262f; color: #fff; font-weight: 700; font-size: 22px; box-shadow: 0 5px 0 #3a3f4d; transition: transform .1s ease, box-shadow .1s ease, background .2s; }
  .${c}-key:active { transform: translateY(4px); box-shadow: 0 1px 0 #3a3f4d; }
  .${c}-exit { padding: 0 22px 0 14px; }
  .${c}-title { flex: 1; min-width: 0; font-weight: 700; font-size: 26px; letter-spacing: -.01em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .${c}-mode { display: inline-flex; border-radius: 16px; border: 2px solid #3a3f4d; background: #23262f; box-shadow: 0 5px 0 #3a3f4d; overflow: hidden; margin-right: 6px; }
  .${c}-mode button { appearance: none; cursor: pointer; border: 0; min-height: 56px; padding: 0 18px 0 14px; display: inline-flex; align-items: center; gap: 7px; background: transparent; color: #c3c8d4; font-weight: 700; font-size: 21px; transition: background .15s, color .15s; }
  .${c}-mode button + button { border-left: 2px solid #3a3f4d; }
  .${c}-mode button.on { background: #fff; color: #1b1e2e; }
  .${c}-lv { display: flex; align-items: center; gap: 10px; }
  .${c}-lv span { font-weight: 700; font-size: 14px; letter-spacing: .14em; text-transform: uppercase; color: #7d8397; margin-right: 2px; }
  .${c}-lv button { width: 60px; height: 60px; padding: 0; font-size: 26px; font-weight: 800; }
  .${c}-lv button.on { background: #ffcc33; border-color: #ffcc33; color: #1d1600; box-shadow: 0 5px 0 #c99a0e; }
  .${c}-lv button.on:active { box-shadow: 0 1px 0 #c99a0e; }
  .${c}-tally { min-width: 124px; text-align: right; line-height: 1.1; margin-left: 6px; }
  .${c}-tally b { display: inline-flex; align-items: center; gap: 7px; font-weight: 800; font-size: 28px; color: #fff; }
  .${c}-tally b span { display: inline-flex; align-items: center; gap: 7px; margin-left: 8px; }
  .${c}-tally .st { flex: none; }
  .${c}-tally small { display: block; font-weight: 500; font-size: 14px; color: #7d8397; margin-top: 4px; }
  .${c}-tally b.bump { animation: ${c}-bump .35s ease; }
  @keyframes ${c}-bump { 40% { transform: scale(1.25); } }
  .${c}-sum { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.55); z-index: 5; animation: ${c}-fade .3s ease; }
  .${c}-card { min-width: 480px; max-width: 700px; text-align: center; padding: 30px 44px 34px; border-radius: 28px; background: #fff; color: #1b1e2e; border: 4px solid #1b1e2e; box-shadow: 0 8px 0 #1b1e2e, 0 30px 70px rgba(0,0,0,.45); animation: ${c}-pop .45s cubic-bezier(.2,1.4,.4,1); }
  .${c}-sum .eb { font-weight: 700; font-size: 15px; letter-spacing: .16em; text-transform: uppercase; color: #4b5168; }
  .${c}-sum .big { display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 800; font-size: 72px; line-height: 1; margin: 16px 0 10px; color: #1b1e2e; }
  .${c}-sum .big span { display: inline-flex; align-items: center; gap: 12px; margin-left: 18px; }
  .${c}-sum p { margin: 6px 0; font-size: 22px; font-weight: 500; color: #4b5168; }
  .${c}-sum p.best { font-size: 19px; color: #8b91a7; min-height: 1.2em; }
  .${c}-sum .row { display: flex; gap: 14px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
  .${c}-btn { appearance: none; cursor: pointer; min-height: 64px; padding: 0 30px; border-radius: 18px; border: 3px solid #1d4ed8; background: #3b82f6; color: #fff; font-weight: 700; font-size: 23px; box-shadow: 0 5px 0 #1d4ed8; transition: transform .1s ease, box-shadow .1s ease; }
  .${c}-btn:active { transform: translateY(4px); box-shadow: 0 1px 0 #1d4ed8; }
  .${c}-btn.ghost { background: #fff; color: #1b1e2e; border-color: #dfe3ec; box-shadow: 0 5px 0 #dfe3ec; }
  .${c}-btn.ghost:active { box-shadow: 0 1px 0 #dfe3ec; }
  @keyframes ${c}-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ${c}-pop { from { transform: scale(.8); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .${c} *, .${c} *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
  `;
}
function makeStrip(root, c, title, level, mode, { onExit, onLevel, onMode }) {
  const top = document.createElement('div');
  top.className = `${c}-top`;
  top.innerHTML = `<button type="button" class="${c}-key ${c}-exit" aria-label="Exit">${BACK}Exit</button>
    <div class="${c}-title">${esc(title)}</div>
    <div class="${c}-mode" role="group" aria-label="Add or take away"><button type="button" data-m="add">${PLUS_I}Add</button><button type="button" data-m="sub">${MINUS_I}Take away</button></div>
    <div class="${c}-lv" role="group" aria-label="Level"><span>Level</span>${[1, 2, 3].map(n => `<button type="button" class="${c}-key" data-l="${n}" aria-label="Level ${n}">${n}</button>`).join('')}</div>
    <div class="${c}-tally" aria-live="polite"><b>${withStars('★ 0', 30)}</b><small></small></div>`;
  root.appendChild(top);
  const unb = [onTap(top.querySelector(`.${c}-exit`), () => onExit())];
  top.querySelectorAll(`.${c}-lv button`).forEach(b => unb.push(onTap(b, () => onLevel(+b.dataset.l))));
  top.querySelectorAll(`.${c}-mode button`).forEach(b => unb.push(onTap(b, () => onMode(b.dataset.m))));
  const tb = top.querySelector(`.${c}-tally b`), ts = top.querySelector(`.${c}-tally small`);
  const api = {
    setLevel(l) { top.querySelectorAll(`.${c}-lv button`).forEach(b => b.classList.toggle('on', +b.dataset.l === l)); },
    setMode(m) { top.querySelectorAll(`.${c}-mode button`).forEach(b => { const on = b.dataset.m === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); },
    setTally(html, bump) { tb.innerHTML = withStars(html, 30); if (bump) { tb.classList.remove('bump'); void tb.offsetWidth; tb.classList.add('bump'); } },
    setNote(t) { ts.textContent = t || ''; },
    starEl() { return tb.querySelector('.st'); },
    destroy() { unb.forEach(u => u()); },
  };
  api.setLevel(level);
  api.setMode(mode);
  return api;
}

// ---------- the game ----------
const TRAY = { bg: '#f4f1ff', edge: '#e4ddfb', a: '#ebe6fc', b: '#f8f6ff' };
const AMBER = { fill: '#fff4dc', edge: '#f59e0b' };
const BULB = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" fill="#fde68a" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const STAR4 = 'M0 -12L3.2 -3.2L12 0L3.2 3.2L0 12L-3.2 3.2L-12 0L-3.2 -3.2Z';
const PRAISE = ['Brilliant!', 'Crystal clear!', 'Smashing!', 'Super!', 'Spot on!', 'Yes!', 'Great joining!'];

function boardCSS() {
  return `
  .${C}-board { flex: 1; min-height: 0; margin: 0 12px 12px; border-radius: 26px; background: ${COL.surface}; color: ${COL.ink}; display: flex; flex-direction: column; overflow: hidden; position: relative; }
  .${C}-band { flex: none; height: 104px; display: flex; align-items: center; justify-content: center; gap: 20px; padding: 12px 20px 0; box-sizing: border-box; }
  .${C}-tgt { min-width: 290px; height: 86px; padding: 0 26px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 22px; background: ${PAL.purple}; border: 4px solid ${COL.ink}; box-shadow: 0 6px 0 ${COL.ink}; color: #fff; }
  .${C}-tgt .eb { font-weight: 700; font-size: 14px; letter-spacing: .16em; text-transform: uppercase; color: #ede9fe; line-height: 1.2; }
  .${C}-tgt .tx { font-weight: 800; font-size: 36px; line-height: 1.1; white-space: nowrap; }
  .${C}-tgt.flash { animation: ${C}-flash .8s cubic-bezier(.2,1.4,.4,1); }
  @keyframes ${C}-flash { 0% { transform: scale(.8); } 45% { transform: scale(1.06); background: #a78bfa; } 100% { transform: none; } }
  .${C}-eq { min-width: 340px; height: 86px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 18px; border-radius: 22px; background: ${COL.surface2}; border: 3px solid ${COL.line}; }
  .${C}-eq .cc-op { flex: none; width: 32px; text-align: center; font-weight: 800; font-size: 38px; line-height: 1; color: ${COL.ink}; }
  .${C}-eq .cc-chip { width: 60px; height: 64px; flex: none; display: block; }
  .${C}-eq .cc-gh { flex: none; width: 58px; height: 58px; box-sizing: border-box; border-radius: 16px; border: 3px dashed ${COL.lineStrong}; background: #fff; display: grid; place-items: center; font-weight: 800; font-size: 30px; color: ${COL.ink3}; }
  .${C}-eq .cc-res { flex: none; min-width: 66px; height: 60px; padding: 0 12px; box-sizing: border-box; border-radius: 16px; border: 3px solid ${COL.ink}; background: #fff; display: grid; place-items: center; font-weight: 800; font-size: 34px; color: ${PAL.purpleDark}; box-shadow: 0 4px 0 ${COL.ink}; transition: background .15s, border-color .15s, color .15s; }
  .${C}-eq .cc-res.good { background: ${COL.goodSoft}; border-color: ${COL.good}; color: ${PAL.greenDark}; box-shadow: 0 4px 0 ${COL.good}; animation: ${C}-res .5s cubic-bezier(.2,1.5,.4,1); }
  .${C}-eq .cc-res.over { background: ${AMBER.fill}; border-color: ${AMBER.edge}; color: ${COL.ink}; box-shadow: 0 4px 0 ${AMBER.edge}; }
  @keyframes ${C}-res { 40% { transform: scale(1.18); } }
  .${C}-stage { flex: 1; min-height: 0; position: relative; }
  .${C}-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
  .${C}-msg { position: absolute; box-sizing: border-box; padding: 16px 20px 18px; border-radius: 20px; background: #fff; border: 3px solid ${COL.line}; font-size: 21px; font-weight: 500; line-height: 1.35; color: ${COL.ink2}; pointer-events: none; transition: background .2s, border-color .2s; z-index: 2; }
  .${C}-msg b { color: ${COL.ink}; font-weight: 700; }
  .${C}-msg small { display: block; margin-top: 12px; font-size: 16px; line-height: 1.35; color: ${COL.ink3}; }
  .${C}-msg.kind { background: #fff8e6; border-color: #fcd68a; color: ${COL.ink}; }
  .${C}-msg.good { background: ${COL.goodSoft}; border-color: #9fdcbc; color: ${PAL.greenDark}; }
  .${C}-msg.good b { display: block; color: ${PAL.greenDark}; font-size: 28px; font-weight: 800; margin-bottom: 4px; }
  .${C}-msg.hint { background: ${COL.focusSoft}; border-color: #b6cffb; color: ${COL.ink}; }
  .${C}-msg.hint b { display: block; }
  .${C}-msg.pop { animation: ${C}-msgpop .35s cubic-bezier(.2,1.4,.4,1); }
  @keyframes ${C}-msgpop { from { transform: scale(.94); } }
  .${C}-hint { position: absolute; appearance: none; cursor: pointer; min-height: 64px; padding: 0 26px 0 20px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; border-radius: 18px; border: 3px solid ${COL.line}; background: #fff; color: ${COL.ink}; font-weight: 700; font-size: 23px; box-shadow: 0 5px 0 ${COL.line}; transition: transform .1s ease, box-shadow .1s ease; z-index: 2; }
  .${C}-hint:active { transform: translateY(4px); box-shadow: 0 1px 0 ${COL.line}; }
  .${C}-stage.narrow .${C}-msg { left: 50% !important; transform: translateX(-50%); top: auto !important; bottom: 10px; width: min(92%, 560px) !important; text-align: center; }
  .${C}-stage.narrow .${C}-msg.how { display: none; }
  .${C}-stage.narrow .${C}-hint { left: auto !important; right: 10px; top: 10px !important; width: auto !important; min-height: 56px; }
  .${C}-banner { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 4; pointer-events: none; text-align: center; padding: 22px 46px 30px; border-radius: 28px; background: #fff; border: 4px solid ${COL.ink}; box-shadow: 0 8px 0 ${COL.ink}, 0 24px 60px rgba(27,30,46,.28); animation: ${C}-bpop .45s cubic-bezier(.2,1.4,.4,1); }
  .${C}-banner .k { font-weight: 800; font-size: 46px; color: ${COL.ink}; }
  .${C}-banner .p { display: inline-flex; flex-direction: column; align-items: center; margin-top: 12px; padding: 8px 30px 12px; border-radius: 20px; background: ${PAL.purple}; color: #fff; font-weight: 800; font-size: 36px; border: 4px solid ${COL.ink}; box-shadow: 0 5px 0 ${COL.ink}; }
  .${C}-banner .p span { font-size: 13px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700; color: #ede9fe; }
  .${C}-banner.out { opacity: 0; transition: opacity .35s; }
  @keyframes ${C}-bpop { from { transform: translate(-50%, -50%) scale(.6); opacity: 0; } }
  .${C}-fly { position: absolute; left: 0; top: 0; width: 46px; height: 46px; z-index: 6; pointer-events: none; }
  .${C}-fly svg { display: block; }
  .${C} .cc-a, .${C} .cc-s { transform-box: view-box; transform-origin: 0 0; }
  .${C} .cc-s { transition: transform .3s cubic-bezier(.3,1.6,.5,1); }
  .${C} .cc-cr.on .cc-s { transform: scale(1.1); }
  .${C} .cc-hl { fill: transparent; stroke: transparent; stroke-width: 4; transition: fill .15s, stroke .15s; }
  .${C} .cc-hl.on { fill: ${COL.focusSoft}; stroke: ${COL.focus}; }
  .${C} .cc-hl.on.good { fill: ${COL.goodSoft}; stroke: ${COL.good}; }
  .${C} .cc-hl.on.over { fill: ${AMBER.fill}; stroke: ${AMBER.edge}; }
  .${C} .cc-hl.hint { fill: #fff6cc; stroke: ${PAL.yellow}; stroke-dasharray: 12 8; }
  .${C} .cc-line { fill: none; stroke: ${COL.focus}; stroke-linecap: round; stroke-linejoin: round; opacity: .9; }
  .${C} .cc-line.good { stroke: ${COL.good}; }
  .${C} .cc-line.over { stroke: ${AMBER.edge}; }
  .${C} .cc-new { animation: ${C}-jar .55s cubic-bezier(.2,1.6,.4,1); transform-box: fill-box; transform-origin: center; }
  @keyframes ${C}-jar { from { transform: scale(0); } }
  @media (max-width: 1000px) {
    .${C}-title, .${C}-lv span { display: none; }
    .${C}-top { gap: 10px; }
    .${C}-mode button { padding: 0 12px 0 10px; font-size: 19px; }
    .${C}-band { gap: 12px; }
    .${C}-tgt { min-width: 0; padding: 0 18px; }
    .${C}-tgt .tx { font-size: 30px; }
    .${C}-eq { min-width: 0; padding: 0 12px; }
  }
  @media (max-height: 560px) {
    .${C}-top { height: 66px; }
    .${C}-band { height: 78px; padding-top: 8px; }
    .${C}-tgt, .${C}-eq { height: 66px; }
    .${C}-tgt .eb { display: none; }
    .${C}-eq .cc-chip { width: 48px; height: 52px; }
    .${C}-eq .cc-gh { width: 46px; height: 46px; }
    .${C}-eq .cc-res { height: 50px; font-size: 28px; }
  }
  `;
}

export function mount(el, ctx = {}) {
  injectCSS(C, stripCSS(C) + boardCSS());

  const say = t => { try { ctx.say && ctx.say(t); } catch (e) { /* ignore */ } };
  const sfx = n => { try { (ctx.sfx || coreSfx)(n); } catch (e) { /* ignore */ } };
  const load = k => { try { return ctx.load ? ctx.load(k) : null; } catch (e) { return null; } };
  const save = (k, v) => { try { ctx.save && ctx.save(k, v); } catch (e) { /* ignore */ } };
  const record = (k, ok) => { try { k && ctx.recordFact && ctx.recordFact(k, ok); } catch (e) { /* ignore */ } };
  const calm = reducedMotion();
  const tm = ms => (calm ? Math.round(ms * 0.35) : ms);
  const debug = !!(ctx.debug || /[?&](arc)?debug\b/.test(location.search));

  let level = clamp(Math.round(ctx.level || 1), 1, 3);
  const qMode = new URLSearchParams(location.search).get('mode');
  let mode = qMode === 'sub' || qMode === 'add' ? qMode : load('mode') === 'sub' ? 'sub' : 'add';
  let alive = true;

  const root = document.createElement('div');
  root.className = C;
  el.appendChild(root);
  const strip = makeStrip(root, C, meta.title, level, mode, {
    onExit: () => ctx.onExit && ctx.onExit(),
    onLevel: l => { level = l; strip.setLevel(l); sfx('click'); startRound(); },
    onMode: m => { if (m === mode) return; mode = m; save('mode', m); strip.setMode(m); sfx('click'); startRound(); },
  });
  const board = document.createElement('div');
  board.className = `${C}-board`;
  board.innerHTML = `<div class="${C}-band">
      <div class="${C}-tgt" aria-live="polite"><span class="eb"></span><span class="tx"></span></div>
      <div class="${C}-eq" aria-live="polite"></div>
    </div>
    <div class="${C}-stage">
      <div class="${C}-msg how" aria-live="polite"></div>
      <button type="button" class="${C}-hint">${BULB}Hint</button>
    </div>`;
  root.appendChild(board);
  const tgtEl = board.querySelector(`.${C}-tgt`);
  const eqEl = board.querySelector(`.${C}-eq`);
  const stage = board.querySelector(`.${C}-stage`);
  const msgEl = board.querySelector(`.${C}-msg`);
  const hintBtn = board.querySelector(`.${C}-hint`);

  const svg = S('svg', { class: `${C}-svg`, role: 'img', 'aria-label': 'Crystal board. Join touching crystals that make the target.' });
  stage.prepend(svg);
  const clipId = `${C}-clip-${Math.random().toString(36).slice(2, 8)}`;
  const clip = S('clipPath', { id: clipId });
  const clipRect = S('rect', {});
  clip.appendChild(clipRect);
  const defs = S('defs');
  defs.appendChild(clip);
  svg.appendChild(defs);
  const layer = name => { const g = S('g', { class: name }); svg.appendChild(g); return g; };
  const gTray = layer('cc-tray'), gHl = layer('cc-hls'), gLine = layer('cc-lines'), gCr = layer('cc-crs'), gFx = layer('cc-fx'), gJar = layer('cc-jar');
  gCr.setAttribute('clip-path', `url(#${clipId})`);
  const line = S('polyline', { class: 'cc-line', points: '' });
  gLine.appendChild(line);

  const timers = new Set();
  const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); return t; };
  const cancelT = t => { if (t) { clearTimeout(t); timers.delete(t); } return 0; };
  const unb = [];

  // ----- state -----
  let R = makeRand(), M = null;
  let cells = [];        // cells[r][c] -> crystal { n, r, c, x, y, g, a, s, body }
  let hlEls = [];        // cell highlight rects, index r * COLS + c
  let path = [];         // crystals in the current path
  let hintSet = new Set();
  let busy = false, sumEl = null, bannerEl = null;
  let pid = null, dragging = false, tapLast = false;
  let shownStars = 0, jarFill = [];
  let idleT = 0, msgT = 0, hintT = 0;
  let L = { W: 1000, H: 560, pitch: 80, size: 70, gx: 0, gy: 0, gw: 560, gh: 480, wide: true };

  const colX = c => L.gx + c * L.pitch + L.pitch / 2;
  const rowY = r => L.gy + r * L.pitch + L.pitch / 2;
  const allCrystals = () => cells.flat().filter(Boolean);
  const cellsOf = crs => crs.map(cr => [cr.r, cr.c]);
  const best = () => { const b = load('best'); return b && typeof b === 'object' ? b : {}; };
  const showBest = () => { const b = best()[`${mode}${level}`]; strip.setNote(b ? `Best round ${b}` : ''); };

  // ----- layout (viewBox = the stage's CSS pixel size, so HTML overlays can share coordinates) -----
  function layout() {
    const r = stage.getBoundingClientRect();
    const W = Math.max(320, Math.round(r.width || 1000)), H = Math.max(260, Math.round(r.height || 560));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const wide = W >= 940;
    const side = wide ? Math.max(212, Math.round(W * 0.19)) : 14;
    const pitch = Math.max(40, Math.floor(Math.min((W - 2 * side) / COLS, (H - 30) / ROWS, 116)));
    const gw = pitch * COLS, gh = pitch * ROWS;
    L = { W, H, pitch, size: Math.round(pitch * 0.9), gx: Math.round((W - gw) / 2), gy: Math.round((H - gh) / 2), gw, gh, wide };
    stage.classList.toggle('narrow', !wide);
    drawTray();
    allCrystals().forEach(place);
    drawPath(pathState());
    drawJar(false);
    if (wide) {
      const left = L.gx + L.gw + 26, w = Math.min(300, W - left - 14);
      msgEl.style.left = `${left}px`; msgEl.style.top = `${L.gy - 12}px`; msgEl.style.width = `${w}px`;
      msgEl.style.fontSize = w < 230 ? '18px' : '';
      hintBtn.style.left = `${left}px`; hintBtn.style.top = `${L.gy + L.gh - 60}px`; hintBtn.style.width = `${w}px`;
    }
  }
  function drawTray() {
    gTray.replaceChildren();
    gHl.replaceChildren();
    const { gx, gy, gw, gh, pitch: p } = L;
    gTray.appendChild(S('rect', { x: gx - 12, y: gy - 12, width: gw + 24, height: gh + 24, rx: 28, fill: TRAY.bg, stroke: TRAY.edge, 'stroke-width': 3 }));
    hlEls = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      gTray.appendChild(S('rect', { x: gx + c * p + 3, y: gy + r * p + 3, width: p - 6, height: p - 6, rx: 18, fill: (r + c) % 2 ? TRAY.a : TRAY.b }));
      const h = S('rect', { class: 'cc-hl', x: gx + c * p + 3, y: gy + r * p + 3, width: p - 6, height: p - 6, rx: 18 });
      gHl.appendChild(h);
      hlEls.push(h);
    }
    clipRect.setAttribute('x', gx - 20); clipRect.setAttribute('y', gy - 12);
    clipRect.setAttribute('width', gw + 40); clipRect.setAttribute('height', gh + 32);
    line.setAttribute('stroke-width', Math.round(p * 0.16));
  }

  // ----- crystals -----
  function makeCrystal(n, r, c) {
    const g = S('g', { class: 'cc-cr' });
    const a = S('g', { class: 'cc-a' });
    const s = S('g', { class: 'cc-s' });
    const body = S('g', {});
    s.appendChild(body); a.appendChild(s); g.appendChild(a);
    const cr = { n, r, c, x: 0, y: 0, g, a, s, body };
    paint(cr, n);
    place(cr);
    gCr.appendChild(g);
    return cr;
  }
  function paint(cr, n) {
    cr.n = n;
    cr.body.innerHTML = gemMarkup(n);
  }
  function place(cr) {
    cr.x = colX(cr.c); cr.y = rowY(cr.r);
    cr.g.style.transform = `translate(${cr.x}px, ${cr.y}px)`;
    const k = L.size / 100;
    cr.body.setAttribute('transform', `scale(${k}) translate(-50 -51)`);
  }
  function buildCrystals() {
    gCr.replaceChildren();
    cells = M.grid.map((row, r) => row.map((n, c) => makeCrystal(n, r, c)));
  }
  // Fall from fromY to the crystal's own cell with a bounce and a little squash. Returns the end time (ms).
  function drop(cr, fromY, delay) {
    place(cr);
    const x = cr.x, y = cr.y;
    const rows = Math.max(0, (y - fromY) / L.pitch);
    if (rows < 0.01) return 0;
    const d = tm(Math.round(250 + 95 * Math.sqrt(rows)));
    if (calm) {
      cr.g.animate([{ transform: `translate(${x}px, ${fromY}px)` }, { transform: `translate(${x}px, ${y}px)` }], { duration: d, delay, fill: 'backwards', easing: 'ease-in' });
      return delay + d;
    }
    const b = Math.min(16, 5 + 3 * rows);
    cr.g.animate([
      { transform: `translate(${x}px, ${fromY}px)`, easing: 'cubic-bezier(.5,0,.95,.55)' },
      { transform: `translate(${x}px, ${y}px)`, offset: 0.7, easing: 'cubic-bezier(.25,.7,.45,1)' },
      { transform: `translate(${x}px, ${y - b}px)`, offset: 0.86, easing: 'cubic-bezier(.55,0,.85,.45)' },
      { transform: `translate(${x}px, ${y}px)` },
    ], { duration: d, delay, fill: 'backwards' });
    const h = L.size / 2;
    cr.a.animate([
      { transform: 'none' },
      { transform: `translate(0px, ${h}px) scale(1.1, .86) translate(0px, ${-h}px)`, offset: 0.4 },
      { transform: 'none' },
    ], { duration: 240, delay: delay + d * 0.7 - 30 });
    return delay + d;
  }

  // ----- path, highlights and the live sum -----
  const pathState = () => {
    if (!M || !path.length) return 'sel';
    const st = M.eval(cellsOf(path)).st;
    return st === 'over' || st === 'full' ? 'over' : st === 'match' ? 'good' : 'sel';
  };
  function drawPath(state) {
    const on = new Set(path);
    allCrystals().forEach(cr => cr.g.classList.toggle('on', on.has(cr)));
    const idx = new Set(path.map(cr => cr.r * COLS + cr.c));
    hlEls.forEach((h, i) => {
      h.setAttribute('class', `cc-hl${idx.has(i) ? ` on ${state}` : ''}${hintSet.has(i) ? ' hint' : ''}`);
    });
    line.setAttribute('points', path.length > 1 ? path.map(cr => `${colX(cr.c)},${rowY(cr.r)}`).join(' ') : '');
    line.setAttribute('class', `cc-line ${state}`);
  }
  const chipSVG = n => `<svg class="cc-chip" viewBox="-4 -4 108 116" width="60" height="64" aria-hidden="true">${gemMarkup(n)}</svg>`;
  function renderEq(ev) {
    if (!M) return;
    const tg = M.tg;
    const nums = path.map(cr => cr.n);
    const op = tg.kind === 'sum' ? '+' : MINUS;
    let parts, res = { text: tg.n, cls: '' };
    const e = ev || (nums.length ? M.eval(cellsOf(path)) : { st: 'empty', v: 0 });
    if (!nums.length) parts = [null, null];
    else if (nums.length === 1 || e.st === 'open') {
      if (tg.kind === 'diff') parts = nums[0] > tg.n ? [nums[0], null] : [null, nums[0]];
      else parts = [...nums, null];
    } else {
      parts = tg.kind === 'diff' ? [Math.max(...nums), Math.min(...nums)] : nums.slice();
      res = e.st === 'match' ? { text: tg.n, cls: 'good' } : { text: e.v >= 0 ? e.v : '?', cls: 'over' };
    }
    const html = parts.map(n => (n === null ? '<span class="cc-gh">?</span>' : chipSVG(n))).join(`<span class="cc-op">${op}</span>`);
    eqEl.innerHTML = `${html}<span class="cc-op">=</span><span class="cc-res ${res.cls}">${res.text}</span>`;
    eqEl.setAttribute('aria-label', `${parts.map(n => (n === null ? '?' : n)).join(` ${op} `)} = ${res.text}`);
  }
  function setTarget(tg, flash) {
    tgtEl.querySelector('.eb').textContent = tg.eb;
    tgtEl.querySelector('.tx').textContent = tg.text;
    if (flash) { tgtEl.classList.remove('flash'); void tgtEl.offsetWidth; tgtEl.classList.add('flash'); }
  }
  const howHTML = () => `<b>${esc(M.tg.how)}</b><small>Drag across touching crystals, or tap one and then the next.</small>`;
  function setMsg(html, kind = 'how', hold = 0) {
    msgEl.innerHTML = html;
    msgEl.className = `${C}-msg ${kind}`;
    if (kind !== 'how') { void msgEl.offsetWidth; msgEl.classList.add('pop'); }
    msgT = cancelT(msgT);
    if (hold) msgT = later(hold, () => { msgT = 0; if (M) setMsg(howHTML(), 'how'); });
  }
  const exprText = (nums, tg) => {
    if (tg.kind === 'diff') return `${Math.max(...nums)} ${MINUS} ${Math.min(...nums)} = ${tg.n}`;
    return `${nums.join(tg.kind === 'sum' ? ' + ' : ` ${MINUS} `)} = ${tg.n}`;
  };
  function kindLine(ev, nums, tg) {
    const k = nums.length, T = tg.n, what = tg.max === 3 ? 'chain' : 'pair';
    if (tg.kind === 'sum') {
      if (k === 1) return nums[0] === T ? `${T} needs a partner, and that makes too many. Try a smaller one.` : `${nums[0]} is more than ${T} already. Try a smaller one.`;
      if (ev.st === 'over') return `${ev.v} is too many. Try a different ${what}.`;
      return `${nums.join(' + ')} makes ${ev.v}. We need ${T}. Try a different ${what}.`;
    }
    if (tg.kind === 'diff') {
      const big = Math.max(...nums), small = Math.min(...nums);
      return `${big} ${MINUS} ${small} is ${ev.v}. We need ${T}. Try a different pair.`;
    }
    if (k === 1) return `${nums[0]} is too small to start. Start on a bigger number.`;
    if (ev.v < 0) return 'That takes away too much. Start on a bigger number.';
    const ex = nums.join(` ${MINUS} `);
    if (ev.st === 'over') return `${ex} is ${ev.v}. That goes past ${T}. Try a different chain.`;
    return `${ex} is ${ev.v}. We need ${T}. Take away a bit more next time.`;
  }

  // ----- pointer: drag a path, or tap one then a neighbour -----
  function crystalAt(p, strict) {
    const c = Math.floor((p.x - L.gx) / L.pitch), r = Math.floor((p.y - L.gy) / L.pitch);
    if (!inside(r, c)) return null;
    // While dragging, only count the middle of a cell, so a finger crossing a corner never joins a diagonal.
    if (strict && Math.hypot(p.x - colX(c), p.y - rowY(r)) > L.pitch * 0.46) return null;
    return (cells[r] && cells[r][c]) || null;
  }
  const lastCr = () => path[path.length - 1];
  const adjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  const canExtend = () => path.length < M.tg.max && M.eval(cellsOf(path)).st === 'open';
  function changed(sound) {
    const ev = path.length ? M.eval(cellsOf(path)) : { st: 'empty', v: 0 };
    drawPath(pathState());
    renderEq(ev);
    if (sound) sfx('click');
    if (ev.st === 'match') commit(ev);
  }
  const onDown = e => {
    if (e.button > 0 || pid !== null || busy || sumEl || !M) return;
    const cr = crystalAt(svgPoint(svg, e), false);
    armIdle();
    if (!cr) { if (path.length) { path = []; changed(false); } return; }
    e.preventDefault();
    pid = e.pointerId;
    try { svg.setPointerCapture(pid); } catch (err) { /* synthetic pointers */ }
    dragging = true; tapLast = false;
    clearHint();
    const i = path.indexOf(cr);
    if (i >= 0 && i === path.length - 1) { tapLast = true; return; }
    if (i >= 0) path = path.slice(0, i + 1);
    else if (path.length && adjacent(cr, lastCr()) && canExtend()) path.push(cr);
    else path = [cr];
    changed(true);
  };
  const onMove = e => {
    if (e.pointerId !== pid || !dragging || busy) return;
    e.preventDefault();
    const cr = crystalAt(svgPoint(svg, e), true);
    if (!cr || cr === lastCr()) return;
    tapLast = false;
    if (path.length >= 2 && cr === path[path.length - 2]) { path.pop(); changed(false); return; }
    if (!path.includes(cr) && adjacent(cr, lastCr()) && canExtend()) { path.push(cr); changed(true); }
  };
  const onUp = e => {
    if (e.pointerId !== pid) return;
    pid = null; dragging = false;
    try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (busy || !M) return;
    if (tapLast) { tapLast = false; path.pop(); changed(false); return; }
    if (!path.length) return;
    const ev = M.eval(cellsOf(path));
    if (ev.st === 'over' || ev.st === 'full') springBack(ev);
  };
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);
  svg.addEventListener('lostpointercapture', onUp);

  function springBack(ev) {
    const crs = path.slice();
    const nums = crs.map(cr => cr.n);
    setMsg(esc(kindLine(ev, nums, M.tg)), 'kind', 4500);
    sfx('tick');
    path = [];
    drawPath('sel');
    crs.forEach(cr => { hlEls[cr.r * COLS + cr.c].setAttribute('class', 'cc-hl on over'); });
    later(tm(450), () => drawPath(pathState()));
    crs.forEach((cr, i) => cr.a.animate([
      { transform: 'rotate(0deg)' }, { transform: 'rotate(-9deg)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(0deg)' },
    ], { duration: tm(460), delay: i * 40, easing: 'ease-in-out' }));
  }

  // ----- a match: burst, star, gravity, refill -----
  function commit(ev) {
    const crs = path.slice();
    const res = M.match(cellsOf(crs));
    if (!res) return;
    busy = true; dragging = false;
    idleT = cancelT(idleT);
    clearHint();
    record(res.fact, true);
    drawPath('good');
    renderEq(ev);
    setMsg(`<b>${esc(exprText(res.nums, res.tg))}</b>${R.pick(PRAISE)}`, 'good', 2600);
    jarFill.push(crs[0].n);
    later(tm(200), () => {
      sfx('pop');
      crs.forEach(burst);
      const cx = crs.reduce((s, cr) => s + cr.x, 0) / crs.length, cy = crs.reduce((s, cr) => s + cr.y, 0) / crs.length;
      for (let i = 0; i < res.stars; i++) later(i * 150, () => flyStar(cx, cy));
      path = [];
      drawPath('sel');
      drawJar(true);
    });
    later(tm(200 + 250), () => gravity(res, crs));
  }
  function burst(cr) {
    const gem = gemOf(cr.n);
    cr.g.classList.remove('on');
    cr.a.animate([
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.28)', opacity: 1, offset: 0.3 },
      { transform: 'scale(.1)', opacity: 0 },
    ], { duration: tm(260), easing: 'ease-in', fill: 'forwards' });
    // Sparkles live in one group per burst, removed by a (tracked) timer rather than animation events.
    const fx = S('g', {});
    gFx.appendChild(fx);
    later(tm(800), () => fx.remove());
    const ring = S('circle', { cx: 0, cy: 0, r: L.size * 0.42, fill: 'none', stroke: '#ffcc33', 'stroke-width': 7 });
    fx.appendChild(ring);
    ring.animate([
      { transform: `translate(${cr.x}px, ${cr.y}px) scale(.6)`, opacity: 1 },
      { transform: `translate(${cr.x}px, ${cr.y}px) scale(1.7)`, opacity: 0 },
    ], { duration: tm(420), easing: 'ease-out', fill: 'forwards' });
    const n = calm ? 5 : 11;
    for (let i = 0; i < n; i++) {
      const star = i % 2 === 0;
      const p = S('path', { d: star ? STAR4 : 'M-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0Z', fill: i % 3 === 0 ? '#ffcc33' : i % 3 === 1 ? gem.fill : '#ffffff', stroke: COL.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' });
      fx.appendChild(p);
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const dist = L.pitch * (0.55 + Math.random() * 0.5);
      p.animate([
        { transform: `translate(${cr.x}px, ${cr.y}px) scale(.3) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${cr.x + Math.cos(ang) * dist}px, ${cr.y + Math.sin(ang) * dist}px) scale(${star ? 1.3 : 1}) rotate(120deg)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${cr.x + Math.cos(ang) * dist * 1.15}px, ${cr.y + Math.sin(ang) * dist * 1.15 + 10}px) scale(.4) rotate(160deg)`, opacity: 0 },
      ], { duration: tm(560 + Math.random() * 200), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    }
  }
  function clientOf(x, y) {
    const m = svg.getScreenCTM();
    if (!m) return { x, y };
    const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
    const q = pt.matrixTransform(m);
    return { x: q.x, y: q.y };
  }
  function flyStar(x, y) {
    const rr = root.getBoundingClientRect();
    const from = clientOf(x, y);
    const st = strip.starEl();
    const tr = st ? st.getBoundingClientRect() : { left: rr.right - 70, top: rr.top + 24, width: 30, height: 30 };
    const fx = from.x - rr.left - 23, fy = from.y - rr.top - 23;
    const tx = tr.left + tr.width / 2 - rr.left - 23, ty = tr.top + tr.height / 2 - rr.top - 23;
    const f = document.createElement('div');
    f.className = `${C}-fly`;
    f.innerHTML = starSvg(46);
    root.appendChild(f);
    const dur = tm(780);
    f.animate([
      { transform: `translate(${fx}px, ${fy}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${fx}px, ${fy - 46}px) scale(1.35)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${tx}px, ${ty}px) scale(.7)`, opacity: 1 },
    ], { duration: dur, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'forwards' });
    later(dur, () => {
      f.remove();
      if (!M) return;
      shownStars = Math.min(M.stars, shownStars + 1);
      strip.setTally(`★ ${shownStars}`, true);
    });
  }
  function gravity(res, popped) {
    popped.forEach(cr => cr.g.remove());
    const next = cells.map(row => row.slice());
    let end = 0;
    for (const f of res.falls) {
      const cr = cells[f.from][f.c];
      cr.r = f.to;
      next[f.to][f.c] = cr;
      end = Math.max(end, drop(cr, rowY(f.from), 0));
    }
    for (const h of res.holes) {
      const cr = makeCrystal(h.n, h.r, h.c);
      next[h.r][h.c] = cr;
      end = Math.max(end, drop(cr, rowY(h.r - h.drop) - L.pitch * 0.3, tm(70)));
    }
    cells = next;
    later(end + 40, () => afterFall(res));
  }
  function afterFall(res) {
    if (res.done) { later(tm(350), finish); return; }
    const go = () => { if (res.shuffled) swirl(); else ready(); };
    if (res.newTarget) {
      sfx('whoosh');
      showBanner(res.newTarget);
      setTarget(res.newTarget, true);
      renderEq({ st: 'empty', v: 0 });
      drawJar(false);
      setMsg(howHTML(), 'how');
      say(`New target! ${res.newTarget.say}`);
      later(1500, go);
    } else go();
  }
  function ready() { busy = false; armIdle(); }
  function showBanner(tg) {
    if (bannerEl) bannerEl.remove();
    const b = document.createElement('div');
    b.className = `${C}-banner`;
    b.innerHTML = `<div class="k">New target!</div><div class="p"><span>${esc(tg.eb)}</span>${esc(tg.text)}</div>`;
    stage.appendChild(b);
    bannerEl = b;
    later(1700, () => {
      b.classList.add('out');
      later(380, () => { b.remove(); if (bannerEl === b) bannerEl = null; });
    });
  }
  // Swirl every crystal away and back with the model's fresh board.
  function swirl() {
    busy = true;
    sfx('whoosh');
    setMsg('<b>Swirl!</b>Fresh crystals with more matches.', 'hint', 2400);
    path = []; drawPath('sel');
    let end = 0;
    allCrystals().forEach(cr => {
      const dl = tm((cr.r + cr.c) * 30), out = tm(300), back = tm(420);
      cr.a.animate([{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(200deg) scale(.1)' }], { duration: out, delay: dl, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'both' });
      later(dl + out, () => {
        paint(cr, M.grid[cr.r][cr.c]);
        cr.a.getAnimations().forEach(a => a.cancel());
        cr.a.animate([{ transform: 'rotate(-160deg) scale(.1)' }, { transform: 'rotate(0deg) scale(1)' }], { duration: back, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      });
      end = Math.max(end, dl + out + back);
    });
    later(end + 40, ready);
  }
  // Crystals tumble in from the top at the start of a round.
  function entrance() {
    busy = true;
    let end = 0;
    allCrystals().forEach(cr => {
      end = Math.max(end, drop(cr, rowY(cr.r) - (ROWS + 0.5) * L.pitch, tm(cr.c * 40 + (ROWS - 1 - cr.r) * 45)));
    });
    later(end + 40, ready);
  }

  // ----- the progress case: 3 rows (one per target) of 4 sockets -----
  function drawJar(popNew) {
    gJar.replaceChildren();
    if (!L.wide || !M) return;
    const x1 = 16, x2 = L.gx - 26, w = x2 - x1;
    if (w < 160) return;
    const lab = w < 220 ? 40 : 50, gap = w < 220 ? 6 : 8;
    const s = Math.min(46, Math.floor((w - 28 - lab - 3 * gap) / 4));
    if (s < 16) return;
    const rowH = s + 16;
    const top = L.gy - 12;
    const ph = 62 + 3 * rowH + 4;
    gJar.appendChild(S('rect', { x: x1, y: top, width: w, height: ph, rx: 22, fill: COL.surface2, stroke: COL.line, 'stroke-width': 3 }));
    if (w >= 236) gJar.appendChild(S('text', { x: x1 + 18, y: top + 34, 'font-family': FONT.display, 'font-weight': 700, 'font-size': 14, 'letter-spacing': 2.2, fill: COL.ink3 }, ['MATCHES']));
    gJar.appendChild(S('text', { x: w >= 236 ? x2 - 18 : x1 + w / 2, y: top + 36, 'text-anchor': w >= 236 ? 'end' : 'middle', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 22, fill: COL.ink }, [`${jarFill.length} / ${ROUND}`]));
    for (let row = 0; row < ROUND / EVERY; row++) {
      const y = top + 54 + row * rowH;
      const tg = M.targets[row] || (mode === 'add' && level === 1 ? M.targets[0] : null);
      const now = row === M.seg;
      const lx = x1 + 14;
      gJar.appendChild(S('rect', { x: lx, y: y + 2, width: lab - 6, height: s - 4, rx: 12, fill: tg ? PAL.purple : COL.surface3, stroke: now ? COL.ink : 'none', 'stroke-width': 3 }));
      gJar.appendChild(S('text', { x: lx + (lab - 6) / 2, y: y + s / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.display, 'font-weight': 800, 'font-size': Math.min(22, s * 0.55), fill: tg ? '#fff' : COL.ink3 }, [tg ? String(tg.n) : '?']));
      for (let i = 0; i < EVERY; i++) {
        const idx = row * EVERY + i;
        const sx = lx + lab + i * (s + gap);
        if (idx < jarFill.length) {
          const g = S('g', { transform: `translate(${sx} ${y}) scale(${s / 106})` });
          const inner = S('g', { class: popNew && idx === jarFill.length - 1 ? 'cc-new' : '' });
          inner.innerHTML = gemMarkup(jarFill[idx], false);
          g.appendChild(inner);
          gJar.appendChild(g);
        } else {
          gJar.appendChild(S('circle', { cx: sx + s / 2, cy: y + s / 2, r: s * 0.36, fill: '#fff', stroke: COL.lineStrong, 'stroke-width': 2.5, 'stroke-dasharray': '5 4' }));
        }
      }
    }
  }

  // ----- hints -----
  function clearHint() {
    hintT = cancelT(hintT);
    if (!hintSet.size) return;
    hintSet = new Set();
    drawPath(pathState());
  }
  function showHint(fromButton) {
    if (busy || sumEl || !M) return false;
    const mv = M.moves();
    if (!mv.length) return false;
    const pairs = mv.filter(p => p.length === 2);
    const pick = R.pick(pairs.length ? pairs : mv);
    if (fromButton && path.length) { path = []; renderEq({ st: 'empty', v: 0 }); }
    hintT = cancelT(hintT);
    hintSet = new Set(pick.map(([r, c]) => r * COLS + c));
    drawPath(pathState());
    pick.forEach(([r, c], i) => {
      cells[r][c].a.animate([
        { transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(-11deg) scale(1.08)' }, { transform: 'rotate(10deg) scale(1.08)' },
        { transform: 'rotate(-6deg) scale(1.05)' }, { transform: 'rotate(4deg) scale(1.02)' }, { transform: 'rotate(0deg) scale(1)' },
      ], { duration: tm(760), delay: i * 140, iterations: 2, easing: 'ease-in-out' });
    });
    hintT = later(2600, () => { hintT = 0; clearHint(); });
    if (fromButton) setMsg(M.tg.kind === 'chain' ? '<b>Look at the wiggly crystals.</b>Start on the bigger one.' : '<b>Look at the wiggly crystals.</b>Do they make it?', 'hint', 3600);
    return pick;
  }
  unb.push(onTap(hintBtn, () => { sfx('click'); armIdle(); showHint(true); }));
  function armIdle() {
    idleT = cancelT(idleT);
    if (document.hidden || !alive) return;
    idleT = later(15000, () => {
      idleT = 0;
      if (!busy && !sumEl && !bannerEl) showHint(false);
      armIdle();
    });
  }
  const onVis = () => { if (document.hidden) idleT = cancelT(idleT); else if (!busy && !sumEl) armIdle(); };
  document.addEventListener('visibilitychange', onVis);

  // ----- rounds -----
  function cancelAnims() {
    try { root.getAnimations({ subtree: true }).forEach(a => a.cancel()); } catch (e) { /* older browsers */ }
  }
  function startRound() {
    timers.forEach(t => clearTimeout(t)); timers.clear();
    idleT = 0; msgT = 0; hintT = 0;
    cancelAnims();
    if (sumEl) { sumEl.remove(); sumEl = null; }
    if (bannerEl) { bannerEl.remove(); bannerEl = null; }
    gFx.replaceChildren();
    root.querySelectorAll(`.${C}-fly`).forEach(f => f.remove());
    R = makeRand();
    M = makeModel(mode, level, R).start();
    path = []; hintSet = new Set(); pid = null; dragging = false; tapLast = false;
    shownStars = 0; jarFill = [];
    strip.setTally('★ 0');
    showBest();
    setTarget(M.tg, true);
    buildCrystals();
    drawPath('sel');
    renderEq({ st: 'empty', v: 0 });
    drawJar(false);
    setMsg(howHTML(), 'how');
    say(M.tg.say);
    entrance();
  }
  function finish() {
    busy = true;
    idleT = cancelT(idleT);
    shownStars = M.stars;
    strip.setTally(`★ ${M.stars}`, true);
    const key = `${mode}${level}`;
    const b = best();
    const prev = +b[key] || 0;
    const isBest = M.stars > prev;
    if (isBest) { b[key] = M.stars; save('best', b); }
    save('plays', (+load('plays') || 0) + 1);
    showBest();
    sfx('chime');
    const other = mode === 'add' ? 'sub' : 'add';
    sumEl = document.createElement('div');
    sumEl.className = `${C}-sum`;
    sumEl.innerHTML = `<div class="${C}-card">
      <div class="eb">Round complete</div>
      <div class="big">${withStars(`★ ${M.stars}`, 64)}</div>
      <p>${ROUND} matches made${M.chains ? `, ${M.chains} of them with 3 crystals` : ''}.</p>
      <p class="best">${isBest && prev ? 'Your best round yet!' : `Best round: ${Math.max(prev, M.stars)} stars`}</p>
      <div class="row"><button type="button" class="${C}-btn go">Play again</button>${level < 3 ? `<button type="button" class="${C}-btn ghost up">Try level ${level + 1}</button>` : ''}<button type="button" class="${C}-btn ghost sw">${other === 'add' ? 'Try Add' : 'Try Take away'}</button></div>
    </div>`;
    board.appendChild(sumEl);
    const u = [];
    const close = fn => () => { u.forEach(f => f()); fn(); };
    u.push(onTap(sumEl.querySelector('.go'), close(() => startRound())));
    const up = sumEl.querySelector('.up');
    if (up) u.push(onTap(up, close(() => { level += 1; strip.setLevel(level); startRound(); })));
    u.push(onTap(sumEl.querySelector('.sw'), close(() => { mode = other; save('mode', mode); strip.setMode(mode); startRound(); })));
  }

  const ro = new ResizeObserver(() => { if (alive) layout(); });
  ro.observe(stage);
  layout();
  startRound();

  // ----- tests only -----
  if (debug) {
    window.__crush = {
      id: meta.id,
      state: () => ({
        mode, level,
        target: M && { kind: M.tg.kind, n: M.tg.n, max: M.tg.max, text: M.tg.text },
        matches: M.matches, stars: M.stars, shown: shownStars, seg: M.seg, busy, summary: !!sumEl, banner: !!bannerEl,
        path: path.map(cr => cr.n), grid: M.grid.map(r => r.slice()), view: cells.map(r => r.map(cr => (cr ? cr.n : 0))),
        moves: M.moves().length, crystals: gCr.querySelectorAll('.cc-cr').length, msg: msgEl.textContent,
        msgKind: ['kind', 'good', 'hint'].find(k => msgEl.classList.contains(k)) || 'how',
        eq: eqEl.getAttribute('aria-label'), timers: timers.size, idle: !!idleT, jar: jarFill.length, pitch: L.pitch, size: L.size,
      }),
      moves: () => M.moves(),
      eval: cs => M.eval(cs),
      centre: (r, c) => clientOf(colX(c), rowY(r)),
      placed: () => allCrystals().every(cr => cr.g.style.transform === `translate(${colX(cr.c)}px, ${rowY(cr.r)}px)`) && cells.every((row, r) => row.every((cr, c) => cr && cr.r === r && cr.c === c && cr.n === M.grid[r][c])),
      hint: () => showHint(true),
      swirl: () => { if (busy || sumEl) return false; M.reshuffle(); swirl(); return true; },
      timerCount: () => timers.size,
      svg: () => svg,
    };
  }

  return {
    destroy() {
      alive = false;
      timers.forEach(t => clearTimeout(t)); timers.clear();
      idleT = 0; msgT = 0; hintT = 0;
      cancelAnims();
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('pointercancel', onUp);
      svg.removeEventListener('lostpointercapture', onUp);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      unb.forEach(u => u());
      strip.destroy();
      if (debug && window.__crush && window.__crush.id === meta.id) delete window.__crush;
      el.replaceChildren();
    },
  };
}
