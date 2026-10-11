// Seeded random helpers. Generators always use R from makeRand so tests can repeat.
export function makeRand(seed) {
  let s = (seed === undefined ? (Math.random() * 2 ** 31) | 0 : seed | 0) || 1;
  const next = () => {
    // mulberry32
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const R = {
    next,
    int(a, b) { if (b < a) [a, b] = [b, a]; return a + Math.floor(next() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    chance(p) { return next() < p; },
    distinct(n, a, b) {
      const span = b - a + 1;
      n = Math.min(n, span);
      const out = new Set();
      while (out.size < n) out.add(R.int(a, b));
      return [...out];
    },
    sample(arr, n) { return R.shuffle(arr).slice(0, Math.min(n, arr.length)); },
  };
  return R;
}
