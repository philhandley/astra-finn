// Fluency keys for basic facts. One key per fact; commutative pairs share a key.
export function factKey(op, a, b) {
  a = Number(a); b = Number(b);
  if (op === '+' || op === 'x' || op === '×' || op === '*') {
    const [p, q] = a <= b ? [a, b] : [b, a];
    return `${op === '+' ? '+' : 'x'}:${p},${q}`;
  }
  if (op === '-' || op === '−') return `-:${a},${b}`;
  if (op === '÷' || op === '/') return `÷:${a},${b}`;
  return `${op}:${a},${b}`;
}

// Parse a key back into { op, a, b }.
export function parseFact(key) {
  const m = /^([+\-x÷]):(\d+),(\d+)$/.exec(String(key));
  if (!m) return null;
  return { op: m[1], a: +m[2], b: +m[3] };
}
