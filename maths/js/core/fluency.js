// Fluency: fact families, Leitner boxes, the Quick Fire deck and Fact Map data.
import { store } from './store.js';
import { parseFact } from './facts.js';

const DAY = 24 * 3600 * 1000;
const INTERVAL = [0, 1, 3, 7, 14]; // days until due, per box

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const add = (a, b) => `+:${Math.min(a, b)},${Math.max(a, b)}`;
const mul = (a, b) => `x:${Math.min(a, b)},${Math.max(a, b)}`;

// Each family is a view over fact keys. `after` is the mission that unlocks it (null = always on).
export const FAMILIES = [
  { id: 'bonds10', title: 'Bonds to 10', after: null, keys: () => range(0, 5).map(a => add(a, 10 - a)), ask: 'bond', target: 10 },
  { id: 'add10', title: 'Adding within 10', after: null, keys: () => range(1, 9).flatMap(a => range(a, 10 - a).map(b => add(a, b))) },
  { id: 'sub10', title: 'Taking away within 10', after: null, keys: () => range(2, 10).flatMap(a => range(1, a - 1).map(b => `-:${a},${b}`)) },
  { id: 'doubles', title: 'Doubles to 20', after: 'l5', keys: () => range(1, 10).map(n => add(n, n)) },
  { id: 'bonds20', title: 'Bonds to 20', after: 'l5', keys: () => range(1, 10).map(a => add(a, 20 - a)), ask: 'bond', target: 20 },
  { id: 'add20', title: 'Adding across 10', after: 'b2', keys: () => range(2, 9).flatMap(a => range(Math.max(a, 11 - a), 9).map(b => add(a, b))) },
  { id: 'sub20', title: 'Taking away across 10', after: 'b2', keys: () => range(11, 18).flatMap(a => range(a - 9, 9).filter(b => a - b <= 9 && b >= 2).map(b => `-:${a},${b}`)) },
  { id: 'tens', title: 'Tens to 100', after: 'b1', keys: () => [...range(1, 9).flatMap(a => range(a, 10 - a).map(b => add(a * 10, b * 10)))] },
  { id: 'x2', title: '2 times table', after: 'a3', keys: () => range(1, 12).map(n => mul(2, n)), table: 2 },
  { id: 'x10', title: '10 times table', after: 'a4', keys: () => range(1, 12).map(n => mul(10, n)), table: 10 },
  { id: 'x5', title: '5 times table', after: 'a4', keys: () => range(1, 12).map(n => mul(5, n)), table: 5 },
  { id: 'div', title: 'Dividing by 2, 5 and 10', after: 'a6', keys: () => [2, 5, 10].flatMap(d => range(1, 12).map(n => `÷:${n * d},${d}`)) },
];

export function unlockedFamilies() {
  const done = store.state.done || {};
  return FAMILIES.filter(f => !f.after || done[f.after]);
}

export function factInfo(key) {
  return store.state.facts[key] || null;
}

// box: -1 = never seen, 0..4 Leitner box.
export function boxOf(key) {
  const f = store.state.facts[key];
  return f ? f.box : -1;
}

export function recordFact(key, correct) {
  if (!key || !parseFact(key)) return;
  const facts = store.state.facts;
  const f = facts[key] || { box: 0, due: 0, seen: 0, right: 0 };
  f.seen++;
  if (correct) { f.right++; f.box = Math.min(4, (f.seen === 1 ? 1 : f.box + 1)); }
  else f.box = Math.max(0, f.box - 1);
  f.due = Date.now() + INTERVAL[f.box] * DAY;
  f.last = Date.now();
  facts[key] = f;
  store.save();
}

function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Build a Quick Fire deck: due facts first, a few new ones, and a couple of easy wins.
export function buildDeck(n = 10, onlyFamily = null) {
  const fams = onlyFamily ? FAMILIES.filter(f => f.id === onlyFamily) : unlockedFamilies();
  const famOf = {};
  const all = [];
  for (const f of fams) for (const k of f.keys()) { if (!famOf[k]) { famOf[k] = f; all.push(k); } }
  const now = Date.now();
  const seen = all.filter(k => store.state.facts[k]);
  const due = shuffle(seen.filter(k => store.state.facts[k].due <= now)).sort((a, b) => store.state.facts[a].box - store.state.facts[b].box);
  const solid = shuffle(seen.filter(k => store.state.facts[k].box >= 3));
  // New facts come from the earliest family that still has unseen facts.
  const fresh = [];
  for (const f of fams) {
    const un = shuffle(f.keys().filter(k => !store.state.facts[k]));
    fresh.push(...un);
  }
  const pick = [];
  const take = (arr, k) => { for (const x of arr) { if (pick.length >= n || k <= 0) break; if (!pick.includes(x)) { pick.push(x); k--; } } };
  take(solid, 2);
  take(due, n - 4);
  take(fresh, 3);
  take(due, n);
  take(fresh, n);
  take(shuffle(seen), n);
  take(shuffle(all), n);
  return shuffle(pick.slice(0, n)).map(k => cardFor(k, famOf[k]));
}

// Turn a fact key into a flash card.
export function cardFor(key, fam) {
  const f = parseFact(key);
  if (!f) return null;
  const { op, a, b } = f;
  if (op === '+') {
    if (fam && fam.ask === 'bond' && a + b === fam.target) {
      const [p, q] = Math.random() < 0.5 ? [a, b] : [b, a];
      return { key, text: `${p} + ? = ${fam.target}`, answer: q };
    }
    const [p, q] = Math.random() < 0.5 ? [a, b] : [b, a];
    return { key, text: `${p} + ${q}`, answer: a + b };
  }
  if (op === '-') return { key, text: `${a} − ${b}`, answer: a - b };
  if (op === 'x') {
    // Show the table number second most of the time ("3 × 5" is three fives).
    const table = [10, 5, 2].find(t => t === a || t === b) || b;
    const other = table === a ? b : a;
    const [p, q] = Math.random() < 0.7 ? [other, table] : [table, other];
    return { key, text: `${p} × ${q}`, answer: a * b };
  }
  if (op === '÷') return { key, text: `${a} ÷ ${b}`, answer: a / b };
  return null;
}

// Counts per family for Engineer's notes.
export function familyStats(f) {
  const keys = [...new Set(f.keys())];
  const c = { total: keys.length, grey: 0, amber: 0, green: 0 };
  for (const k of keys) {
    const bx = boxOf(k);
    if (bx < 0) c.grey++; else if (bx <= 1) c.amber++; else c.green++;
  }
  return c;
}

export function shakiest(n = 10) {
  return Object.entries(store.state.facts)
    .filter(([, f]) => f.seen >= 1)
    .sort((a, b) => a[1].box - b[1].box || (a[1].right / a[1].seen) - (b[1].right / b[1].seen))
    .slice(0, n)
    .map(([k]) => cardFor(k, null)?.text || k);
}
