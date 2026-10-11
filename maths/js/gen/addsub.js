// Addition and subtraction generators. Owner: addsub. Item format: ENGINE.md section 4.
// Debug: dev/gen.html?gen=addsub&all=1      dev/gen.html?gen=addsub.makeTen&level=1&n=12
// Generators (levels): bondsTo (3, params { target: 5 | 10 | 20 | 100 }), factsWithin10 (3, params { op, zero }),
//   factsWithin20 (3, params { op }), countOn (3), doubles (3), nearDoubles (3), makeTen (3), subtractAcross10 (3),
//   addOnesTens (3, params { kinds }), relatedFacts100 (3), addTwoDigit (3), subTwoDigit (3), threeNumbers (3),
//   missingNumber (3), equalsTrueFalse (3), commutative (3), inverseCheck (3), factFamily (3), difference (3),
//   wordProblem (3, params { structures }).
import { factKey } from '../core/facts.js';

const M = '−'; // minus sign used in captions and lines (sayable() reads it as "minus")

const THINGS = [
  { one: 'rocket', many: 'rockets', icon: 'rocket' },
  { one: 'moon rock', many: 'moon rocks', icon: 'asteroid' },
  { one: 'crystal', many: 'crystals', icon: 'crystal' },
  { one: 'fuel can', many: 'fuel cans', icon: 'fuel' },
  { one: 'star', many: 'stars', icon: 'star' },
  { one: 'satellite', many: 'satellites', icon: 'satellite' },
  { one: 'alien', many: 'aliens', icon: 'alien' },
  { one: 'robot', many: 'robots', icon: 'robot' },
  { one: 'helmet', many: 'helmets', icon: 'helmet' },
  { one: 'flag', many: 'flags', icon: 'flag' },
  { one: 'comet', many: 'comets', icon: 'comet' },
];
const many = (t, n) => (n === 1 ? t.one : t.many);
const isAre = n => (n === 1 ? 'is' : 'are');
const TF = [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }];

// Three (or n) sorted number options including the answer, with near misses.
function choices(R, ans, { n = 3, min = 0, max = 100, step = 1, extra = [] } = {}) {
  const set = new Set([ans]);
  const cands = [...R.shuffle(extra), ...R.shuffle([ans + step, ans - step, ans + 2 * step, ans - 2 * step, ans + 10, ans - 10])]
    .filter(v => Number.isInteger(v) && v >= min && v <= max && v !== ans);
  for (const c of cands) { if (set.size >= n) break; set.add(c); }
  for (let k = 3; set.size < n && k < 60; k++) {
    for (const v of [ans + k * step, ans - k * step]) if (set.size < n && v >= min && v <= max) set.add(v);
  }
  return [...set].sort((x, y) => x - y);
}

// Choice options from strings: the answer plus distractors, shuffled.
function strChoices(R, ans, distractors, n = 3) {
  const out = [ans];
  for (const d of distractors) { if (out.length >= n) break; if (!out.includes(d)) out.push(d); }
  return R.shuffle(out);
}

function evalExpr(s) {
  const t = String(s).replace(/([+\-−])/g, ' $1 ').split(/\s+/).filter(Boolean);
  let total = null, op = '+';
  for (const tok of t) {
    if (tok === '+' || tok === '-' || tok === M) { op = tok; continue; }
    const v = Number(tok);
    if (!Number.isFinite(v)) return null;
    total = total === null ? v : op === '+' ? total + v : total - v;
  }
  return total;
}

const without = (item, ...keys) => { const o = { ...item }; keys.forEach(k => delete o[k]); return o; };
const sym = op => (op === '+' ? '+' : M);
const word = op => (op === '+' ? 'plus' : 'minus');
const tens = n => `${n} ${n === 1 ? 'ten' : 'tens'}`;

// ---------------------------------------------------------------- bonds

function fillFrame(a) {
  return {
    lines: ['Fill the frame to make 10.', 'Tap each empty space.'],
    widget: 'tensframe', props: { count: a, frames: 1, interactive: true },
    input: 'widget', goal: { count: 10 },
    hint: ['Tap the empty spaces one at a time.'],
    explain: [`${a} and ${10 - a} make 10.`],
  };
}

function bondPicture(T, a, b, R) {
  const fact = factKey('+', a, b);
  const pic = T === 5
    ? { widget: 'partwhole', props: { whole: 5, parts: [a, b], hide: 1, counters: 'both' } }
    : { widget: 'tensframe', props: { count: a, frames: T > 10 ? 2 : 1 } };
  return {
    lines: [T === 5 ? `5 is the whole. One part is ${a}.` : `There are ${a} counters.`, `How many more to make ${T}?`],
    caption: `${a} + ? = ${T}`,
    ...pic,
    input: 'choice', answer: b, options: choices(R, b, { min: 0, max: T }),
    hint: T === 5 ? [`Count on from ${a} to 5.`] : ['Count the empty spaces.'],
    explain: [`${a} and ${b} make ${T}.`, `${T} is made of ${a} and ${b}.`],
    fact,
  };
}

function bond100(level, R) {
  const p = R.int(1, 9), q = 10 - p, a = p * 10, b = q * 10;
  const explain = [`${p} + ${q} = 10.`, `So ${a} + ${b} = 100.`];
  const reteach = {
    lines: ['What goes with ' + p + ' to make 10?'], caption: `${p} + ? = 10`,
    widget: 'tensframe', props: { count: p, frames: 1 },
    input: 'numpad', answer: q, hint: ['Count the empty spaces.'], explain: [`${p} and ${q} make 10.`], fact: factKey('+', p, q),
  };
  const pw = hide => ({ widget: 'partwhole', props: { whole: 100, parts: [a, b], hide } });
  if (level === 1) {
    return {
      lines: [`${a} and what make 100?`], caption: `${a} + ? = 100`, ...pw(1),
      input: 'choice', answer: b, options: choices(R, b, { min: 0, max: 100, step: 10, extra: [q] }),
      hint: [`${p} + ? = 10.`, `So ${a} + ? = 100.`], explain, fact: factKey('+', a, b), reteach,
    };
  }
  if (level === 2) {
    return {
      lines: ['What is the missing part?'], caption: `${a} + ? = 100`, ...pw(1),
      input: 'numpad', answer: b, hint: [`Think: ${p} + ? = 10.`], explain, fact: factKey('+', a, b), reteach,
    };
  }
  const form = R.pick(['?+b', '100-?', '100=a+?']);
  const cap = form === '?+b' ? `? + ${b} = 100` : form === '100-?' ? `100 ${M} ? = ${a}` : `100 = ${a} + ?`;
  const ans = form === '?+b' ? a : b;
  return {
    lines: ['What is the missing number?'], caption: cap, input: 'numpad', answer: ans,
    hint: [`Think of ${form === '?+b' ? q : p} tens.`, 'What makes 10 tens?'],
    hintWidget: pw(form === '?+b' ? 0 : 1),
    explain: form === '100-?' ? [`${a} + ${b} = 100.`, `So 100 ${M} ${b} = ${a}.`] : explain,
    fact: form === '100-?' ? factKey('-', 100, b) : factKey('+', a, b), reteach,
  };
}

export const bondsTo = {
  about: 'Number bonds: the missing part of 5, 10, 20 or 100 (by tens)',
  levels: 3,
  make(level, R, params = {}) {
    const T = [5, 10, 20, 100].includes(Number(params.target)) ? Number(params.target) : 10;
    if (T === 100) return bond100(level, R);
    const a = T === 20 ? R.int(1, 19) : R.int(level >= 3 ? 0 : 1, T - 1);
    const b = T - a;
    const fact = factKey('+', a, b);
    const explain = [`${a} and ${b} make ${T}.`, `${T} is made of ${a} and ${b}.`];
    let reteach;
    if (T === 20 && a !== 10) {
      const s = a % 10;
      reteach = without(bondPicture(10, s, 10 - s, R), 'reteach');
      reteach.lines = [`${a} is 10 and ${s}.`, `How many more make 10 from ${s}?`];
    }
    if (level === 1) {
      const it = bondPicture(T, a, b, R);
      if (T === 10) it.reteach = fillFrame(a);
      else if (reteach) it.reteach = reteach;
      return it;
    }
    const smaller = reteach || (T <= 10 && a > 0 ? bondPicture(T, a, b, R) : undefined);
    if (level === 2) {
      const hideA = R.chance(0.35);
      return {
        lines: ['What is the missing part?'],
        caption: hideA ? `? + ${b} = ${T}` : `${a} + ? = ${T}`,
        widget: 'partwhole', props: { whole: T, parts: [a, b], hide: hideA ? 0 : 1, counters: T <= 10 ? 'both' : 'digits' },
        input: 'numpad', answer: hideA ? a : b,
        hint: [`Count on from ${hideA ? b : a} to ${T}.`],
        explain, fact, reteach: smaller,
      };
    }
    const form = R.pick(['?+b', 'a+?', 'T-?', 'T=a+?']);
    const caption = { '?+b': `? + ${b} = ${T}`, 'a+?': `${a} + ? = ${T}`, 'T-?': `${T} ${M} ? = ${a}`, 'T=a+?': `${T} = ${a} + ?` }[form];
    const ans = form === '?+b' ? a : b;
    const known = form === '?+b' ? b : a;
    return {
      lines: ['What is the missing number?'], caption,
      input: 'numpad', answer: ans,
      hint: [`What goes with ${known} to make ${T}?`],
      hintWidget: { widget: 'partwhole', props: { whole: T, parts: [a, b], hide: form === '?+b' ? 0 : 1, counters: T <= 10 ? 'both' : 'digits' } },
      explain: form === 'T-?' ? [`${a} and ${b} make ${T}.`, `So ${T} ${M} ${b} = ${a}.`] : explain,
      fact: form === 'T-?' ? factKey('-', T, b) : fact,
      reteach: smaller,
    };
  },
};

// ---------------------------------------------------------------- facts within 10 and 20

function factPicture(op, a, b, c, R) {
  const t = R.pick(THINGS);
  if (op === '+') {
    return {
      lines: [`${a} ${many(t, a)} and ${b} more.`, 'How many altogether?'],
      caption: `${a} + ${b} = ?`,
      widget: 'objects', props: { n: c, icon: t.icon, colours: [a, b], arrange: c <= 10 ? 'row' : 'rows', perRow: 10 },
    };
  }
  return {
    lines: [`${a} ${many(t, a)}.`, `${b} ${isAre(b)} crossed out.`, 'How many are left?'],
    caption: `${a} ${M} ${b} = ?`,
    widget: 'objects', props: { n: a, icon: t.icon, crossed: b, arrange: a <= 10 ? 'row' : 'rows', perRow: 10 },
  };
}

function factHint(op, a, b) {
  if (op === '+') {
    if (a === 0 || b === 0) return ['Adding 0 changes nothing.'];
    return [`Start at ${Math.max(a, b)}.`, `Count on ${Math.min(a, b)}.`];
  }
  if (b === 0) return ['Subtracting 0 changes nothing.'];
  if (b === a) return [`You subtract all ${a}.`, 'How many are left?'];
  return [`Start at ${a}.`, `Count back ${b}.`];
}

function factExplain(op, a, b, c) {
  const lines = [`${a} ${word(op)} ${b} is equal to ${c}.`];
  if (b === 0 || (op === '+' && a === 0)) lines.push(op === '+' ? 'Adding 0 changes nothing.' : 'Subtracting 0 changes nothing.');
  return lines;
}

function missingForm(op, a, b, c, R) {
  const forms = op === '+'
    ? [[`${a} + ? = ${c}`, b, `Count on from ${a} to ${c}.`], [`? + ${b} = ${c}`, a, `What goes with ${b} to make ${c}?`], [`${c} = ${a} + ?`, b, `Count on from ${a} to ${c}.`]]
    : [[`${a} ${M} ? = ${c}`, b, `Count back from ${a} to ${c}.`], [`? ${M} ${b} = ${c}`, a, `Think: ${c} + ${b} = ?`], [`${c} = ${a} ${M} ?`, b, `Count back from ${a} to ${c}.`]];
  return R.pick(forms);
}

function factItem(level, R, op, a, b, { max = 10, bridging = false } = {}) {
  const c = op === '+' ? a + b : a - b;
  const fact = factKey(op, a, b);
  const pic = factPicture(op, a, b, c, R);
  const l1 = { ...pic, input: 'choice', answer: c, options: choices(R, c, { min: 0, max: Math.max(max, c + 2) }), hint: factHint(op, a, b), explain: factExplain(op, a, b, c), fact };
  if (level === 1) return l1;
  const hintWidget = op === '+'
    ? { widget: 'tensframe', props: { colours: [a, b], frames: c > 10 ? 2 : 1 } }
    : { widget: pic.widget, props: pic.props };
  if (level === 2) {
    return {
      lines: [`What is ${a} ${sym(op)} ${b}?`], caption: `${a} ${sym(op)} ${b} = ?`,
      input: 'numpad', answer: c, hint: factHint(op, a, b), hintWidget, explain: factExplain(op, a, b, c), fact,
      reteach: without(l1, 'reteach'),
    };
  }
  const [caption, ans, hint] = missingForm(op, a, b, c, R);
  return {
    lines: ['What is the missing number?'], caption, input: 'numpad', answer: ans,
    hint: [hint], hintWidget, explain: [`${a} ${sym(op)} ${b} = ${c}.`], fact,
    reteach: without(l1, 'reteach'),
  };
}

export const factsWithin10 = {
  about: 'Addition and subtraction facts within 10, including 0 (1NF–1, Y1-AS-3)',
  levels: 3,
  make(level, R, params = {}) {
    const op = params.op === '+' || params.op === '-' ? params.op : (R.chance(0.55) ? '+' : '-');
    const zero = params.zero === true ? R.chance(0.6) : R.chance(0.08);
    let a, b;
    if (op === '+') {
      if (zero) { a = R.int(1, 10); b = 0; if (R.chance(0.4)) [a, b] = [b, a]; } else { a = R.int(1, 9); b = R.int(1, 10 - a); }
    } else if (zero) { a = R.int(1, 10); b = R.chance(0.75) ? 0 : a; } else { a = R.int(2, 10); b = R.int(1, a - 1); }
    return factItem(level, R, op, a, b, { max: 10 });
  },
};

export const factsWithin20 = {
  about: 'Addition and subtraction facts within 20: L1 no bridging, L2 across 10, L3 missing numbers (Y1-AS-2, Y2-AS-2)',
  levels: 3,
  make(level, R, params = {}) {
    const op = params.op === '+' || params.op === '-' ? params.op : (R.chance(0.55) ? '+' : '-');
    let a, b;
    const bridge = level === 2 || (level === 3 && R.chance(0.6));
    if (op === '+') {
      if (bridge) { a = R.int(2, 9); b = R.int(11 - a, 9); } else { a = 10 + R.int(0, 8); b = R.int(1, 9 - (a - 10)); if (R.chance(0.3)) [a, b] = [b, a]; }
    } else if (bridge) { a = R.int(11, 18); b = R.int(a - 9, 9); if (b <= a - 10) b = a - 9; } else { a = R.int(11, 19); b = R.int(1, a - 10); }
    const c = op === '+' ? a + b : a - b;
    if (level === 1) {
      const it = factItem(1, R, op, a, b, { max: 20 });
      if (op === '+') { it.widget = 'tensframe'; it.props = { colours: [a, b], frames: 2 }; it.lines = [`${a} + ${b}.`, 'How many counters altogether?']; }
      it.hint = op === '+' ? [`${Math.max(a, b)} is 10 and ${Math.max(a, b) - 10}.`, `Add ${Math.min(a, b)} to the ${Math.max(a, b) - 10}.`] : [`${a} is 10 and ${a - 10}.`, `Subtract ${b} from the ${a - 10}.`];
      return it;
    }
    const it = factItem(level, R, op, a, b, { max: 20 });
    if (bridge) {
      if (op === '+') {
        const big = Math.max(a, b), small = Math.min(a, b), k = 10 - big, r = small - k;
        it.hint = ['Make 10 first.', `${big} + ${k} = 10.`];
        it.explain = [`${big} + ${k} = 10.`, `10 + ${r} = ${c}.`];
        it.hintWidget = { widget: 'tensframe', props: { colours: [big, small], frames: 2 } };
        it.reteach = { lines: [`What goes with ${big} to make 10?`], caption: `${big} + ? = 10`, widget: 'tensframe', props: { count: big, frames: 1 }, input: 'numpad', answer: k, hint: ['Count the empty spaces.'], explain: [`${big} and ${k} make 10.`], fact: factKey('+', big, k) };
      } else {
        const o = a - 10, rest = b - o;
        it.hint = [`First subtract ${o} to get to 10.`, `Then subtract ${rest} more.`];
        it.explain = [`${a} ${M} ${o} = 10.`, `10 ${M} ${rest} = ${c}.`];
        it.hintWidget = { widget: 'tensframe', props: { count: a, frames: 2 } };
        it.reteach = { lines: [`What is 10 ${M} ${rest}?`], caption: `10 ${M} ${rest} = ?`, widget: 'tensframe', props: { count: 10, frames: 1 }, input: 'numpad', answer: 10 - rest, hint: [`Count back ${rest} from 10.`], explain: [`10 ${M} ${rest} = ${10 - rest}.`], fact: factKey('-', 10, rest) };
      }
    }
    return it;
  },
};

export const countOn = {
  about: 'Count on and count back on a number line (Y1-AS-3)',
  levels: 3,
  make(level, R) {
    const op = level === 1 ? '+' : level === 2 ? '-' : (R.chance(0.5) ? '+' : '-');
    const b = R.int(1, level === 3 ? 5 : 4);
    const a = op === '+' ? R.int(1, 20 - b) : R.int(b + 1, 20);
    const c = op === '+' ? a + b : a - b;
    const hops = Array.from({ length: b }, (_, k) => (op === '+' ? { from: a + k, to: a + k + 1 } : { from: a - k, to: a - k - 1 }));
    const fact = factKey(op, a, b);
    const say = [`Start at ${a}.`, `Count ${op === '+' ? 'on' : 'back'} ${b}.`];
    const explain = [`${a} ${sym(op)} ${b} = ${c}.`];
    if (level === 1) {
      return {
        lines: say, caption: `${a} + ${b} = ?`,
        widget: 'numberline', props: { min: 0, max: 20, labels: 'all', hops, readonly: true },
        input: 'choice', answer: c, options: choices(R, c, { min: 0, max: 20 }),
        hint: ['Follow the hops.', 'Where does the last hop land?'], explain, fact,
      };
    }
    if (level === 2) {
      return {
        lines: say, caption: `${a} ${M} ${b} = ?`,
        widget: 'numberline', props: { min: 0, max: 20, labels: [...new Set([0, 10, 20, a])], hops, readonly: true },
        input: 'numpad', answer: c,
        hint: [`Count back ${b} hops from ${a}.`], hintProps: { labels: 'all' }, explain, fact,
      };
    }
    return {
      lines: say, caption: `${a} ${sym(op)} ${b} = ?`, input: 'numpad', answer: c,
      hint: [`Say ${a}, then count ${op === '+' ? 'on' : 'back'} ${b}.`],
      hintWidget: { widget: 'numberline', props: { min: 0, max: 20, labels: 'all', hops, readonly: true } },
      explain, fact,
    };
  },
};

// ---------------------------------------------------------------- doubles

export const doubles = {
  about: 'Doubles: L1 to 5 + 5, L2 to 10 + 10, L3 halves of even numbers to 20',
  levels: 3,
  make(level, R) {
    if (level === 3) {
      const n = R.int(2, 10), d = 2 * n;
      return {
        lines: [`What is half of ${d}?`], caption: `Half of ${d} = ?`, input: 'numpad', answer: n,
        hint: [`What number doubled makes ${d}?`],
        hintWidget: { widget: 'tensframe', props: { count: d, frames: 2 } },
        explain: [`Double ${n} is ${d}.`, `So half of ${d} is ${n}.`], fact: factKey('-', d, n),
        reteach: { lines: [`What is double ${n}?`], caption: `${n} + ${n} = ?`, widget: 'tensframe', props: { colours: [n, n], frames: 2 }, input: 'numpad', answer: d, hint: ['Count both colours.'], explain: [`Double ${n} is ${d}.`], fact: factKey('+', n, n) },
      };
    }
    const n = level === 1 ? R.int(1, 5) : R.int(3, 10);
    const d = 2 * n;
    const t = R.pick(THINGS);
    const pic = { widget: 'objects', props: { n: d, icon: level === 1 ? t.icon : 'dot', arrange: 'rows', perRow: n, colours: [n, n] } };
    if (level === 1) {
      return {
        lines: [`Two rows of ${n} ${many(t, n)}.`, 'How many altogether?'], caption: `${n} + ${n} = ?`, ...pic,
        input: 'choice', answer: d, options: choices(R, d, { min: 0, max: 12 }),
        hint: [`Count the top row. Then count on ${n}.`], explain: [`Double ${n} is ${d}.`, `${n} + ${n} = ${d}.`], fact: factKey('+', n, n),
      };
    }
    return {
      lines: [`What is double ${n}?`], caption: `${n} + ${n} = ?`, input: 'numpad', answer: d,
      hint: n > 5 ? [`${n} is 5 and ${n - 5}.`, `Double 5 is 10. Double ${n - 5} is ${2 * (n - 5)}.`] : [`Count on ${n} from ${n}.`],
      hintWidget: { widget: 'tensframe', props: { colours: [n, n], frames: 2 } },
      explain: [`Double ${n} is ${d}.`], fact: factKey('+', n, n),
      reteach: n > 5 ? { lines: [`What is double ${n - 5}?`], caption: `${n - 5} + ${n - 5} = ?`, widget: 'objects', props: { n: 2 * (n - 5), arrange: 'rows', perRow: n - 5, colours: [n - 5, n - 5] }, input: 'numpad', answer: 2 * (n - 5), hint: ['Count all the dots.'], explain: [`Double ${n - 5} is ${2 * (n - 5)}.`], fact: factKey('+', n - 5, n - 5) } : undefined,
    };
  },
};

export const nearDoubles = {
  about: 'Near doubles: 6 + 7 from double 6 (1NF–1, 2AS–1)',
  levels: 3,
  make(level, R) {
    if (level === 3 && R.chance(0.5)) {
      // 7 + 9 is double 8; or 13 - 6 from 6 + 7.
      if (R.chance(0.5)) {
        const n = R.int(3, 9), a = n - 1, b = n + 1, s = a + b;
        return {
          lines: ['Use a double to help.'], caption: `${a} + ${b} = ?`, input: 'numpad', answer: s,
          hint: [`Move 1 from ${b} to ${a}.`, `Now it is ${n} + ${n}.`], explain: [`${a} + ${b} is the same as ${n} + ${n}.`, `Double ${n} is ${s}.`], fact: factKey('+', a, b),
        };
      }
      const n = R.int(4, 9), s = 2 * n + 1;
      return {
        lines: [`Double ${n} is ${2 * n}.`, 'Use it to help.'], caption: `${s} ${M} ${n} = ?`, input: 'numpad', answer: n + 1,
        hint: [`${s} is 1 more than double ${n}.`, `So ${s} is ${n} and 1 more than ${n}.`], explain: [`${n} + ${n + 1} = ${s}.`, `So ${s} ${M} ${n} = ${n + 1}.`], fact: factKey('-', s, n),
      };
    }
    const n = level === 1 ? R.int(1, 5) : R.int(5, 9);
    let a = n, b = n + 1;
    if (R.chance(0.4)) [a, b] = [b, a];
    const s = 2 * n + 1;
    const explain = [`Double ${n} is equal to ${2 * n}.`, `So ${a} plus ${b} is equal to ${s}.`];
    const pic = { widget: 'objects', props: { n: s, arrange: 'groups', groups: [a, b], colours: [a, b] } };
    if (level === 1) {
      return {
        lines: [`Double ${n} is ${2 * n}.`, `So what is ${a} + ${b}?`], caption: `${a} + ${b} = ?`, ...pic,
        input: 'choice', answer: s, options: choices(R, s, { min: 0, max: 12, extra: [2 * n] }),
        hint: ['It is 1 more than the double.'], explain, fact: factKey('+', a, b),
      };
    }
    return {
      lines: ['Use a double to help.'], caption: `${a} + ${b} = ?`, input: 'numpad', answer: s,
      hint: [`What is double ${n}?`, 'Then add 1 more.'], hintWidget: pic, explain, fact: factKey('+', a, b),
      reteach: { lines: [`What is double ${n}?`], caption: `${n} + ${n} = ?`, widget: 'tensframe', props: { colours: [n, n], frames: 2 }, input: 'numpad', answer: 2 * n, hint: ['Count both colours.'], explain: [`Double ${n} is ${2 * n}.`], fact: factKey('+', n, n) },
    };
  },
};

// ---------------------------------------------------------------- across 10

export const makeTen = {
  about: 'Add across 10 by making 10 first: 8 + 5 (2AS–1)',
  levels: 3,
  make(level, R) {
    let big = R.int(5, 9), small = R.int(11 - big, 9);
    if (small === big && R.chance(0.75)) small = R.int(11 - big, 9);
    if (small > big) [big, small] = [small, big]; // the bigger number fills the first frame; the sum stays over 10
    let a = big, b = small;
    if (level >= 2 && R.chance(0.3)) [a, b] = [b, a];
    const s = big + small, k = 10 - big, r = small - k;
    const fact = factKey('+', a, b);
    const explain = [`${big} + ${k} = 10.`, `10 + ${r} = ${s}.`];
    const frames = { widget: 'tensframe', props: { colours: [big, small], frames: 2 } };
    const reteach = { lines: [`What goes with ${big} to make 10?`], caption: `${big} + ? = 10`, widget: 'tensframe', props: { count: big, frames: 1 }, input: 'numpad', answer: k, hint: ['Count the empty spaces.'], explain: [`${big} and ${k} make 10.`], fact: factKey('+', big, k) };
    if (level === 1) {
      return {
        lines: [`${big} gold and ${small} blue.`, 'Fill the first 10. Then add the rest.'], caption: `${big} + ${small} = ?`, ...frames,
        input: 'choice', answer: s, options: choices(R, s, { min: 10, max: 20 }),
        hint: [`${k} blue counters fill the first frame.`, `${r} are left over.`], explain, fact, reteach,
      };
    }
    if (level === 2) {
      return {
        lines: ['Make 10 first.'], caption: `${a} + ${b} = ?`, input: 'numpad', answer: s,
        hint: [`${big} + ${k} = 10.`, `How many are left from ${small}?`], hintWidget: frames, explain, fact, reteach,
      };
    }
    if (R.chance(0.5)) {
      return {
        lines: [`Split ${small} to make 10.`], caption: `${big} + ${small} = ${big} + ${k} + ?`, input: 'numpad', answer: r,
        hint: [`${small} is ${k} and something.`], hintWidget: { widget: 'partwhole', props: { whole: small, parts: [k, r], hide: 1 } },
        explain: [`${small} is ${k} and ${r}.`, `${big} + ${k} = 10. 10 + ${r} = ${s}.`], reteach,
      };
    }
    return {
      lines: ['Make 10 first.', 'What goes with 10?'], caption: `${big} + ${small} = 10 + ?`, input: 'numpad', answer: r,
      hint: [`${big} + ${k} = 10.`, `${small} ${M} ${k} = ?`], hintWidget: frames,
      explain: [`${big} + ${k} = 10.`, `${r} is left from ${small}.`, `So ${big} + ${small} = 10 + ${r}.`], reteach,
    };
  },
};

export const subtractAcross10 = {
  about: 'Subtract across 10: through 10 or from 10, 15 − 9 (2AS–1)',
  levels: 3,
  make(level, R) {
    const a = R.int(11, 18);
    const o = a - 10;
    const b = R.int(o + 1, 9);
    const c = a - b, rest = b - o;
    const fact = factKey('-', a, b);
    const through = R.chance(0.5);
    const hint = through ? [`First subtract ${o} to get to 10.`, `Then subtract ${rest} more.`] : [`Subtract ${b} from the 10.`, `Then add the ${o} back on.`];
    const explain = through ? [`${a} ${M} ${o} = 10.`, `10 ${M} ${rest} = ${c}.`] : [`10 ${M} ${b} = ${10 - b}.`, `${10 - b} + ${o} = ${c}.`];
    const frame = { widget: 'tensframe', props: { count: a, frames: 2 } };
    const reteach = through
      ? { lines: [`What is 10 ${M} ${rest}?`], caption: `10 ${M} ${rest} = ?`, widget: 'tensframe', props: { count: 10, frames: 1 }, input: 'numpad', answer: 10 - rest, hint: [`Count back ${rest} from 10.`], explain: [`10 ${M} ${rest} = ${10 - rest}.`], fact: factKey('-', 10, rest) }
      : { lines: [`What is 10 ${M} ${b}?`], caption: `10 ${M} ${b} = ?`, widget: 'tensframe', props: { count: 10, frames: 1 }, input: 'numpad', answer: 10 - b, hint: [`Count back ${b} from 10.`], explain: [`10 ${M} ${b} = ${10 - b}.`], fact: factKey('-', 10, b) };
    if (level === 1) {
      return {
        lines: [`${a} counters.`, `Subtract ${b}.`, 'How many are left?'], caption: `${a} ${M} ${b} = ?`, ...frame,
        input: 'choice', answer: c, options: choices(R, c, { min: 0, max: 10 }), hint, explain, fact, reteach,
      };
    }
    if (level === 2) {
      return { lines: [`What is ${a} ${M} ${b}?`], caption: `${a} ${M} ${b} = ?`, input: 'numpad', answer: c, hint, hintWidget: frame, explain, fact, reteach };
    }
    if (through) {
      return {
        lines: ['Subtract through 10.'], caption: `${a} ${M} ${b} = 10 ${M} ?`, input: 'numpad', answer: rest,
        hint: [`${a} ${M} ${o} = 10.`, `How much of ${b} is still to go?`], hintWidget: frame,
        explain: [`${b} is ${o} and ${rest}.`, `${a} ${M} ${o} = 10, then 10 ${M} ${rest} = ${c}.`], reteach,
      };
    }
    return {
      lines: ['Subtract from 10.'], caption: `${a} ${M} ${b} = ${10 - b} + ?`, input: 'numpad', answer: o,
      hint: [`10 ${M} ${b} = ${10 - b}.`, `What else is in ${a} besides the 10?`], hintWidget: frame,
      explain: [`${a} is 10 and ${o}.`, `10 ${M} ${b} = ${10 - b}. Add the ${o}.`], reteach,
    };
  },
};

// ---------------------------------------------------------------- two-digit numbers

export const addOnesTens = {
  about: 'A two-digit number and ones, or tens: 64 + 3, 75 − 30, 30 − 3 (2AS–3)',
  levels: 3,
  make(level, R, params = {}) {
    const all = ['onesAdd', 'onesSub', 'tensAdd', 'tensSub', 'tensTens', 'fromTen'];
    const kinds = Array.isArray(params.kinds) && params.kinds.length ? params.kinds.filter(k => all.includes(k)) : all;
    const kind = R.pick(kinds.length ? kinds : all);
    let a, b, op, small, explain, hintL3;
    if (kind === 'onesAdd') {
      const t = R.int(1, 9), u = R.int(0, 8), v = R.int(1, 9 - u);
      a = t * 10 + u; b = v; op = '+'; small = [u, '+', v];
      explain = [`${u} + ${v} = ${u + v}.`, `So ${a} + ${b} = ${a + b}.`]; hintL3 = [`Only the ones change.`, `${u} + ${v} = ?`];
    } else if (kind === 'onesSub') {
      const t = R.int(1, 9), u = R.int(1, 9), v = R.int(1, u);
      a = t * 10 + u; b = v; op = '-'; small = [u, '-', v];
      explain = [`${u} ${M} ${v} = ${u - v}.`, `So ${a} ${M} ${b} = ${a - b}.`]; hintL3 = ['Only the ones change.', `${u} ${M} ${v} = ?`];
    } else if (kind === 'tensAdd') {
      const t = R.int(1, 8), u = R.int(1, 9), w = R.int(1, 9 - t);
      a = t * 10 + u; b = w * 10; op = '+'; small = [t, '+', w];
      explain = [`${tens(t)} + ${tens(w)} = ${tens(t + w)}.`, `So ${a} + ${b} = ${a + b}.`]; hintL3 = [`${t} + ${w} = ${t + w}.`, `So ${tens(t)} + ${tens(w)} = ${tens(t + w)}.`];
    } else if (kind === 'tensSub') {
      const t = R.int(2, 9), u = R.int(1, 9), w = R.int(1, t - 1);
      a = t * 10 + u; b = w * 10; op = '-'; small = [t, '-', w];
      explain = [`${tens(t)} ${M} ${tens(w)} = ${tens(t - w)}.`, `So ${a} ${M} ${b} = ${a - b}.`]; hintL3 = [`${t} ${M} ${w} = ${t - w}.`, `So ${tens(t)} ${M} ${tens(w)} = ${tens(t - w)}.`];
    } else if (kind === 'tensTens') {
      if (R.chance(0.5)) {
        const p = R.int(1, 8), q = R.int(1, 9 - p);
        a = p * 10; b = q * 10; op = '+'; small = [p, '+', q];
        explain = [`${p} plus ${q} is equal to ${p + q}.`, `So ${tens(p)} plus ${tens(q)} is equal to ${tens(p + q)}.`];
      } else {
        const p = R.int(2, 9), q = R.int(1, p - 1);
        a = p * 10; b = q * 10; op = '-'; small = [p, '-', q];
        explain = [`${p} minus ${q} is equal to ${p - q}.`, `So ${tens(p)} minus ${tens(q)} is equal to ${tens(p - q)}.`];
      }
      hintL3 = [explain[0]];
    } else {
      const t = R.int(2, 9), v = R.int(1, 9);
      a = t * 10; b = v; op = '-'; small = [10, '-', v];
      explain = [`10 minus ${v} is equal to ${10 - v}.`, `So ${a} minus ${v} is equal to ${a - v}.`]; hintL3 = [`10 ${M} ${v} = ${10 - v}.`, `So ${a} ${M} ${v} = ?`];
    }
    const c = op === '+' ? a + b : a - b;
    const [x, sop, y] = small;
    const sc = sop === '+' ? x + y : x - y;
    const reteach = {
      lines: [`What is ${x} ${sym(sop)} ${y}?`], caption: `${x} ${sym(sop)} ${y} = ?`, input: 'numpad', answer: sc,
      hint: factHint(sop, x, y), hintWidget: sop === '+' ? { widget: 'tensframe', props: { colours: [x, y], frames: x + y > 10 ? 2 : 1 } } : { widget: 'tensframe', props: { count: x, frames: x > 10 ? 2 : 1 } },
      explain: [`${x} ${sym(sop)} ${y} = ${sc}.`], fact: factKey(sop, x, y),
    };
    const fact = kind === 'tensTens' ? factKey(op, a, b) : undefined;
    const caption = `${a} ${sym(op)} ${b} = ?`;
    const lines = [`What is ${a} ${sym(op)} ${b}?`];
    const hint = kind === 'onesAdd' || kind === 'onesSub' ? ['Only the ones change.', 'The tens stay the same.']
      : kind === 'tensAdd' || kind === 'tensSub' ? ['Only the tens change.', 'The ones stay the same.']
        : kind === 'fromTen' ? [`Think: 10 ${M} ${b}.`] : hintL3;
    if (level === 1) {
      return {
        lines: [...lines, 'Use the blocks to help.'], caption,
        widget: 'blocks', props: { a, b, op, interactive: true },
        input: 'choice', answer: c, options: choices(R, c, { min: 0, max: 100, extra: [c + 10, c - 10, c + 1, c - 1].filter(v => v !== c) }),
        hint, explain, fact, reteach,
      };
    }
    if (level === 2) {
      let pic;
      if (kind === 'onesAdd' || kind === 'onesSub') {
        const t10 = Math.floor(a / 10) * 10;
        const hops = Array.from({ length: b }, (_, k) => (op === '+' ? { from: a + k, to: a + k + 1 } : { from: a - k, to: a - k - 1 }));
        pic = { widget: 'numberline', props: { min: t10, max: t10 + 10, labels: [...new Set([t10, a, t10 + 10])], hops, readonly: true } };
      } else if (kind === 'fromTen') {
        const hops = Array.from({ length: b }, (_, k) => ({ from: a - k, to: a - k - 1 }));
        pic = { widget: 'numberline', props: { min: a - 10, max: a, labels: [a - 10, a], hops, readonly: true } };
      } else if (kind === 'tensAdd' || kind === 'tensSub') {
        pic = { widget: 'blocks', props: { a, b, op, interactive: true } };
      } else {
        pic = { widget: 'partwhole', props: op === '+' ? { whole: c, parts: [a, b], hide: 'whole' } : { whole: a, parts: [b, c], hide: 1 } };
      }
      return { lines, caption, ...pic, input: 'numpad', answer: c, hint, explain, fact, reteach };
    }
    return { lines, caption, input: 'numpad', answer: c, hint: hintL3, explain, fact, reteach };
  },
};

export const relatedFacts100 = {
  about: 'Related facts to 100: 3 + 7 = 10 so 30 + 70 = 100 (Y2-AS-2, 2AS–3)',
  levels: 3,
  make(level, R) {
    const op = R.chance(0.6) ? '+' : '-';
    let p, q;
    if (op === '+') { p = R.int(1, 9); q = R.chance(0.5) ? 10 - p : R.int(1, Math.max(1, 9 - p)); if (p + q > 10) q = 10 - p; }
    else { p = R.chance(0.5) ? 10 : R.int(3, 9); q = R.int(1, p - 1); }
    const r = op === '+' ? p + q : p - q;
    const A = p * 10, B = q * 10, C = r * 10;
    const fact = factKey(op, A, B);
    const small = `${p} ${sym(op)} ${q} = ${r}`;
    const explain = [`${p} ${word(op)} ${q} is equal to ${r}.`, `So ${A} ${word(op)} ${B} is equal to ${C}.`];
    const reteach = {
      lines: [`What is ${p} ${sym(op)} ${q}?`], caption: `${p} ${sym(op)} ${q} = ?`, input: 'numpad', answer: r,
      hint: factHint(op, p, q), explain: [`${small}.`], fact: factKey(op, p, q),
      hintWidget: op === '+' ? { widget: 'tensframe', props: { colours: [p, q], frames: 1 } } : { widget: 'tensframe', props: { count: p, frames: 1 } },
    };
    const pw = op === '+' ? { widget: 'partwhole', props: { whole: C, parts: [A, B], hide: 'whole' } } : { widget: 'partwhole', props: { whole: A, parts: [B, C], hide: 1 } };
    if (level === 1) {
      return {
        lines: [`${small}.`, `So what is ${A} ${sym(op)} ${B}?`], caption: `${A} ${sym(op)} ${B} = ?`, ...pw,
        input: 'choice', answer: C, options: choices(R, C, { min: 0, max: 100, step: 10, extra: [r] }),
        hint: ['Use the small fact.', 'Think in tens.'], explain, fact, reteach,
      };
    }
    if (level === 2) {
      return { lines: [`What is ${A} ${sym(op)} ${B}?`], caption: `${A} ${sym(op)} ${B} = ?`, input: 'numpad', answer: C, hint: [`Think: ${p} ${sym(op)} ${q}.`], hintWidget: pw, explain, fact, reteach };
    }
    const form = R.pick(['?x', 'x?']);
    const cap = form === '?x' ? `? ${sym(op)} ${B} = ${C}` : `${A} ${sym(op)} ? = ${C}`;
    return {
      lines: ['What is the missing number?'], caption: cap, input: 'numpad', answer: form === '?x' ? A : B,
      hint: [`Think in tens: ${form === '?x' ? `? ${sym(op)} ${q} = ${r}` : `${p} ${sym(op)} ? = ${r}`}.`], hintWidget: pw,
      explain: [`${small}.`, `So ${A} ${sym(op)} ${B} = ${C}.`], fact, reteach,
    };
  },
};

export const addTwoDigit = {
  about: 'Add two 2-digit numbers: L1 no exchange, L2 with exchange, L3 bigger or a missing digit (2AS–4)',
  levels: 3,
  make(level, R) {
    let t1, t2, u1, u2;
    const exch = level === 2 || (level === 3 && R.chance(0.7));
    if (exch) { u1 = R.int(1, 9); u2 = R.int(10 - u1, 9); t1 = R.int(1, 7); t2 = R.int(1, 8 - t1); }
    else { u1 = R.int(0, 8); u2 = R.int(u1 === 0 ? 1 : 0, 9 - u1); t1 = R.int(1, 8); t2 = R.int(1, 9 - t1); }
    if (level === 3 && !exch && R.chance(0.5)) { t1 = R.int(3, 7); t2 = R.int(1, 9 - t1); }
    const a = t1 * 10 + u1, b = t2 * 10 + u2, s = a + b;
    const T = (t1 + t2) * 10, O = u1 + u2;
    const explain = [`${t1 * 10} + ${t2 * 10} = ${T}.`, `${u1} + ${u2} = ${O}.`, `${T} + ${O} = ${s}.`];
    const hint = ['First add the tens.', 'Then add the ones.'];
    const reteach = { lines: [`What is ${u1} + ${u2}?`], caption: `${u1} + ${u2} = ?`, input: 'numpad', answer: O, hint: factHint('+', u1, u2), hintWidget: { widget: 'tensframe', props: { colours: [u1, u2], frames: O > 10 ? 2 : 1 } }, explain: [`${u1} + ${u2} = ${O}.`], fact: factKey('+', u1, u2) };
    const blocks = { widget: 'blocks', props: { a, b, op: '+', interactive: true } };
    if (level === 1) {
      return {
        lines: [`What is ${a} + ${b}?`, 'Put the blocks together to help.'], caption: `${a} + ${b} = ?`, ...blocks,
        input: 'choice', answer: s, options: choices(R, s, { min: 0, max: 100, extra: [s + 10, s - 10, s + 1] }), hint, explain, reteach,
      };
    }
    if (level === 2) {
      return {
        lines: [`What is ${a} + ${b}?`, 'Swap 10 ones for a ten.'], caption: `${a} + ${b} = ?`, ...blocks,
        input: 'numpad', answer: s, hint: [...hint, `${O} ones is 1 ten and ${O - 10} ones.`], explain, reteach,
      };
    }
    if (R.chance(0.4)) {
      const hideTens = R.chance(0.5);
      const shown = hideTens ? `?${u1}` : `${t1}?`;
      return {
        lines: ['What is the missing digit?'], caption: `${shown} + ${b} = ${s}`, input: 'numpad', answer: hideTens ? t1 : u1,
        hint: hideTens ? ['Look at the tens.', exch ? 'Remember the ten from the ones.' : `What adds to ${t2} tens?`] : ['Look at the ones.', `What adds to ${u2} to end in ${s % 10}?`],
        explain: [`${a} + ${b} = ${s}.`, `The missing digit is ${hideTens ? t1 : u1}.`], reteach,
      };
    }
    return { lines: [`What is ${a} + ${b}?`], caption: `${a} + ${b} = ?`, input: 'numpad', answer: s, hint, hintWidget: blocks, explain, reteach };
  },
};

export const subTwoDigit = {
  about: 'Subtract two 2-digit numbers, partitioning one number only: L1 no exchange, L2 exchange, L3 harder (2AS–4)',
  levels: 3,
  make(level, R) {
    let a, b;
    if (level === 1) {
      const t1 = R.int(2, 9), u1 = R.int(1, 9), t2 = R.int(1, t1 - 1), u2 = R.int(0, u1);
      a = t1 * 10 + u1; b = t2 * 10 + u2;
    } else if (level === 2 || R.chance(0.6)) {
      const t1 = R.int(3, 9), u1 = R.int(0, 8), t2 = R.int(1, t1 - 2), u2 = R.int(u1 + 1, 9);
      a = t1 * 10 + u1; b = t2 * 10 + u2;
    } else {
      const t1 = R.int(4, 9), t2 = R.int(1, t1 - 2), u2 = R.int(1, 9);
      a = t1 * 10; b = t2 * 10 + u2;
    }
    const c = a - b, T = Math.floor(b / 10) * 10, u = b % 10, mid = a - T;
    const explain = u ? [`${a} ${M} ${T} = ${mid}.`, `${mid} ${M} ${u} = ${c}.`] : [`${a} ${M} ${T} = ${c}.`];
    const hint = u ? [`First subtract ${T}.`, `Then subtract ${u}.`] : [`Subtract ${T}.`, 'The ones stay the same.'];
    const ones = a % 10;
    const reteach = u > ones
      ? { lines: [`What is ${10 + ones} ${M} ${u}?`], caption: `${10 + ones} ${M} ${u} = ?`, input: 'numpad', answer: 10 + ones - u, hint: [`First subtract ${ones} to get to 10.`], hintWidget: { widget: 'tensframe', props: { count: 10 + ones, frames: 2 } }, explain: [`${10 + ones} ${M} ${u} = ${10 + ones - u}.`], fact: factKey('-', 10 + ones, u) }
      : { lines: [`What is ${ones} ${M} ${u}?`], caption: `${ones} ${M} ${u} = ?`, input: 'numpad', answer: ones - u, hint: factHint('-', ones, u), explain: [`${ones} ${M} ${u} = ${ones - u}.`], fact: factKey('-', ones, u) };
    const blocks = { widget: 'blocks', props: { a, b, op: '-', interactive: true } };
    if (level === 1) {
      return {
        lines: [`What is ${a} ${M} ${b}?`, 'Tap the blocks to subtract.'], caption: `${a} ${M} ${b} = ?`, ...blocks,
        input: 'choice', answer: c, options: choices(R, c, { min: 0, max: 100, extra: [c + 10, c - 10, c + 1].filter(v => v >= 0) }), hint, explain, reteach,
      };
    }
    if (level === 2) {
      return {
        lines: [`What is ${a} ${M} ${b}?`, 'Swap a ten for 10 ones.'], caption: `${a} ${M} ${b} = ?`, ...blocks,
        input: 'numpad', answer: c, hint, explain, reteach,
      };
    }
    return { lines: [`What is ${a} ${M} ${b}?`], caption: `${a} ${M} ${b} = ?`, input: 'numpad', answer: c, hint, hintWidget: blocks, explain, reteach };
  },
};

export const threeNumbers = {
  about: 'Add three one-digit numbers: find the bond to 10 first (Y2-AS-3)',
  levels: 3,
  make(level, R) {
    let nums, bond = null;
    if (level === 3 && R.chance(0.4)) {
      // No pair makes 10: 8 + 5 + 6.
      do { nums = [R.int(3, 9), R.int(3, 9), R.int(3, 9)]; } while (nums[0] + nums[1] === 10 || nums[0] + nums[2] === 10 || nums[1] + nums[2] === 10);
    } else {
      const x = R.int(1, 9), y = 10 - x, z = level === 1 ? R.int(1, 5) : R.int(1, 9);
      bond = [x, y];
      nums = R.shuffle([x, y, z]);
      if (nums[0] + nums[1] === 10 && R.chance(0.7)) nums = [nums[0], nums[2], nums[1]]; // usually not side by side
    }
    const [p, q, r] = nums, s = p + q + r;
    const caption = `${p} + ${q} + ${r} = ?`;
    const z = bond ? s - 10 : null;
    const explain = bond ? [`${bond[0]} + ${bond[1]} = 10.`, `10 + ${z} = ${s}.`] : [`${p} + ${q} = ${p + q}.`, `${p + q} + ${r} = ${s}.`];
    const hint = bond ? ['Find 2 numbers that make 10.'] : ['Add 2 numbers first.', 'Then add the last one.'];
    const pic = { widget: 'objects', props: { n: s, arrange: 'groups', groups: nums, colours: nums } };
    const reteach = bond
      ? { lines: [`What goes with ${bond[0]} to make 10?`], caption: `${bond[0]} + ? = 10`, widget: 'tensframe', props: { count: bond[0], frames: 1 }, input: 'numpad', answer: bond[1], hint: ['Count the empty spaces.'], explain: [`${bond[0]} and ${bond[1]} make 10.`], fact: factKey('+', bond[0], bond[1]) }
      : { lines: [`What is ${p} + ${q}?`], caption: `${p} + ${q} = ?`, input: 'numpad', answer: p + q, hint: factHint('+', p, q), explain: [`${p} + ${q} = ${p + q}.`], fact: factKey('+', p, q) };
    if (level === 1) {
      return { lines: ['Add the 3 numbers.', 'Find a bond to 10 first.'], caption, ...pic, input: 'choice', answer: s, options: choices(R, s, { min: 0, max: 30 }), hint, explain, reteach };
    }
    if (level === 2) return { lines: ['Add the 3 numbers.'], caption, input: 'numpad', answer: s, hint, hintWidget: pic, explain, reteach };
    if (bond && R.chance(0.5)) {
      const hideAt = nums.indexOf(bond[1]);
      const shown = nums.map((v, i) => (i === hideAt ? '?' : String(v)));
      return {
        lines: ['What is the missing number?'], caption: `${shown.join(' + ')} = ${s}`, input: 'numpad', answer: bond[1],
        hint: [`The total is ${s}.`, 'Is there a bond to 10 hiding?'], explain, reteach,
      };
    }
    return { lines: ['Add the 3 numbers.'], caption, input: 'numpad', answer: s, hint, hintWidget: pic, explain, reteach };
  },
};

// ---------------------------------------------------------------- the equals sign, order and the inverse

export const missingNumber = {
  about: 'Missing numbers such as ? + 4 = 9 and 7 = ? − 9, with balance pictures at L1–L2 (Y1-AS-4, Y2-AS-5)',
  levels: 3,
  make(level, R) {
    let L, Rt, ans, full, fact, hint;
    if (level === 1) {
      const c = R.int(3, 10), b = R.int(1, c - 1), a = c - b;
      if (R.chance(0.5)) { L = `? + ${b}`; Rt = `${c}`; ans = a; hint = `What goes with ${b} to make ${c}?`; }
      else { L = `${a} + ?`; Rt = `${c}`; ans = b; hint = `Count on from ${a} to ${c}.`; }
      if (R.chance(0.3)) [L, Rt] = [Rt, L];
      full = `${a} + ${b} = ${c}`; fact = factKey('+', a, b);
    } else if (level === 2) {
      const form = R.pick(['?+b=c', 'c=a+?', 'c=?-b', '?-b=c', 'a-?=c']);
      if (form === '?+b=c' || form === 'c=a+?') {
        const c = R.int(11, 20), b = R.int(2, 9), a = c - b;
        if (form === '?+b=c') { L = `? + ${b}`; Rt = `${c}`; ans = a; hint = `What goes with ${b} to make ${c}?`; }
        else { L = `${c}`; Rt = `${a} + ?`; ans = b; hint = `Count on from ${a} to ${c}.`; }
        full = `${a} + ${b} = ${c}`; fact = factKey('+', a, b);
      } else {
        const a = R.int(11, 20), b = R.int(2, 9), c = a - b;
        if (form === 'c=?-b') { L = `${c}`; Rt = `? ${M} ${b}`; ans = a; hint = `Think: ${c} + ${b} = ?`; }
        else if (form === '?-b=c') { L = `? ${M} ${b}`; Rt = `${c}`; ans = a; hint = `Think: ${c} + ${b} = ?`; }
        else { L = `${a} ${M} ?`; Rt = `${c}`; ans = b; hint = `Count back from ${a} to ${c}.`; }
        full = `${a} ${M} ${b} = ${c}`; fact = factKey('-', a, b);
      }
    } else {
      const form = R.pick(['?+tens', 'a-?=tens', 'c=tens-?', '?-tens', '?+ones']);
      if (form === '?+tens') { const t = R.int(1, 5), a = R.int(11, 49), c = a + t * 10; L = `? + ${t * 10}`; Rt = `${c}`; ans = a; hint = `Think: ${c} ${M} ${t * 10} = ?`; full = `${a} + ${t * 10} = ${c}`; }
      else if (form === 'a-?=tens') { const t = R.int(2, 9), u = R.int(1, 9), a = t * 10 + u; L = `${a} ${M} ?`; Rt = `${t * 10}`; ans = u; hint = `What do you subtract to reach ${t * 10}?`; full = `${a} ${M} ${u} = ${t * 10}`; }
      else if (form === 'c=tens-?') { const t = R.int(2, 9), v = R.int(1, 9), c = t * 10 - v; L = `${c}`; Rt = `${t * 10} ${M} ?`; ans = v; hint = `Count on from ${c} to ${t * 10}.`; full = `${c} = ${t * 10} ${M} ${v}`; }
      else if (form === '?-tens') { const t = R.int(1, 4), c = R.int(11, 59), a = c + t * 10; L = `? ${M} ${t * 10}`; Rt = `${c}`; ans = a; hint = `Think: ${c} + ${t * 10} = ?`; full = `${a} ${M} ${t * 10} = ${c}`; }
      else { const t = R.int(1, 8), v = R.int(1, 9), u = R.int(0, 9 - v), a = t * 10 + u, c = a + v; L = `? + ${v}`; Rt = `${c}`; ans = a; hint = `Think: ${c} ${M} ${v} = ?`; full = `${a} + ${v} = ${c}`; }
      fact = undefined;
    }
    const caption = `${L} = ${Rt}`;
    const balance = { widget: 'balance', props: { left: L, right: Rt } };
    const explain = [`${full}.`, 'Both sides are the same.'];
    if (level === 1) {
      return {
        lines: ['The scales balance.', 'What number is hiding?'], caption, ...balance,
        input: 'choice', answer: ans, options: choices(R, ans, { min: 0, max: 10 }),
        hint: ['Both sides must be the same.', hint], explain, fact,
      };
    }
    if (level === 2) {
      return { lines: ['The scales balance.', 'What number is hiding?'], caption, ...balance, input: 'numpad', answer: ans, hint: ['Both sides must be the same.', hint], explain, fact };
    }
    return { lines: ['What is the missing number?'], caption, input: 'numpad', answer: ans, hint: [hint], hintWidget: balance, explain, fact };
  },
};

function tfExplain(left, right, truth) {
  const lv = evalExpr(left), rv = evalExpr(right);
  const parts = [];
  if (String(lv) !== String(left).trim()) parts.push(`${left} = ${lv}.`);
  if (String(rv) !== String(right).trim()) parts.push(`${right} = ${rv}.`);
  parts.push(truth ? 'Both sides are the same, so it is true.' : 'The sides are not the same, so it is false.');
  return parts.slice(-3);
}

export const equalsTrueFalse = {
  about: 'Is it true? The equals sign means "the same as" (1AS–2, Y1-AS-1)',
  levels: 3,
  make(level, R) {
    const truth = R.chance(0.5);
    let left, right;
    if (level === 1) {
      const kind = R.pick(['sum', 'sum', 'diff', 'same']);
      if (kind === 'same') { const n = R.int(2, 10); left = `${n}`; right = truth ? `${n}` : `${n + R.pick([-1, 1])}`; }
      else if (kind === 'sum') { const s = R.int(3, 10), a = R.int(1, s - 1), b = s - a; left = `${a} + ${b}`; right = `${truth ? s : s + R.pick([-1, 1])}`; }
      else { const a = R.int(3, 10), b = R.int(1, a - 1); left = `${a} ${M} ${b}`; right = `${truth ? a - b : a - b + R.pick([-1, 1])}`; }
      if (R.chance(0.5)) [left, right] = [right, left];
    } else if (level === 2) {
      const s = R.int(6, 20);
      const a = R.int(1, Math.min(9, s - 1)), b = s - a;
      let c = R.int(1, Math.min(9, s - 1)); if (c === a || c === b) c = Math.min(s - 1, c + 1 === a || c + 1 === b ? c + 2 : c + 1);
      const d = s - c;
      left = `${a} + ${b}`;
      if (R.chance(0.3)) right = truth ? `${b} + ${a}` : `${b} + ${a + 1}`;
      else if (R.chance(0.5)) right = truth ? `${c} + ${d}` : `${c} + ${d + R.pick([-1, 1])}`;
      else { const e = s + R.int(1, 5); right = truth ? `${e} ${M} ${e - s}` : `${e} ${M} ${e - s + 1}`; }
      if (R.chance(0.4)) [left, right] = [right, left];
    } else {
      const kind = R.pick(['tens', 'split', 'diffdiff', 'double']);
      if (kind === 'tens') { const p = R.int(1, 8), q = R.int(1, 9 - p); left = `${p * 10} + ${q * 10}`; right = `${(p + q) * 10 + (truth ? 0 : R.pick([-10, 10]))}`; }
      else if (kind === 'split') { const t = R.int(2, 9), u = R.int(1, 9); left = `${t * 10 + u}`; right = truth ? `${t * 10} + ${u}` : `${t} + ${u}`; }
      else if (kind === 'diffdiff') { const a = R.int(6, 10), b = R.int(1, a - 2), k = R.int(1, 3); left = `${a} ${M} ${b}`; right = truth ? `${a - k} ${M} ${b - k}` : `${a - k} ${M} ${b}`; if (b - k < 0) right = truth ? `${a + k} ${M} ${b + k}` : `${a + k} ${M} ${b}`; }
      else { const n = R.int(6, 25); left = `${2 * n}`; right = truth ? `${n} + ${n}` : `${n} + ${n + 1}`; }
      if (R.chance(0.4)) [left, right] = [right, left];
    }
    const lv = evalExpr(left), rv = evalExpr(right);
    const isTrue = lv === rv;
    return {
      lines: ['Is this true or false?'], caption: `${left} = ${right}`,
      input: 'choice', answer: isTrue ? 'true' : 'false', options: TF,
      hint: ['Work out each side.', 'Are they the same?'],
      hintWidget: { widget: 'balance', props: { left, right } },
      explain: tfExplain(left, right, isTrue),
    };
  },
};

export const commutative = {
  about: 'Addition in any order, subtraction not (Y2-AS-4)',
  levels: 3,
  make(level, R) {
    if (level === 2) {
      const a = R.int(2, 9), b = R.int(2, 9) === a ? a + 1 : R.int(2, 9);
      const big = Math.max(a, b), small = Math.min(a, b);
      const ans = `${b} + ${a}`;
      const opts = strChoices(R, ans, [`${big} ${M} ${small}`, `${b} + ${b}`, `${a} + ${a}`].filter(x => x !== ans));
      return {
        lines: [`Which is the same as ${a} + ${b}?`], caption: `${a} + ${b}`, input: 'choice', answer: ans, options: opts,
        hint: ['Adding works in any order.'], explain: [`${a} + ${b} = ${a + b} and ${b} + ${a} = ${a + b}.`, 'Adding works in any order.'],
        fact: factKey('+', a, b),
      };
    }
    const sub = R.chance(level === 1 ? 0.4 : 0.5);
    let a, b;
    if (level === 1) { a = R.int(1, 9); b = R.int(1, 10 - a); if (a === b) b = a === 1 ? 2 : a - 1; }
    else if (R.chance(0.5)) { a = R.int(11, 59); b = R.int(11, 99 - a); } else { a = R.int(2, 9) * 10; b = R.int(1, 9) * 10; if (a === b) b = a === 90 ? 80 : a + 10; }
    if (sub) {
      const big = Math.max(a, b), small = Math.min(a, b);
      return {
        lines: ['Is this true or false?'], caption: `${big} ${M} ${small} = ${small} ${M} ${big}`, input: 'choice', answer: 'false', options: TF,
        hint: [`Start with ${small}. Can you subtract ${big}?`],
        explain: [`${big} ${M} ${small} = ${big - small}.`, `${small} ${M} ${big} is not ${big - small}.`, 'Order matters when we subtract.'],
      };
    }
    const truth = R.chance(0.75);
    const right = truth ? `${b} + ${a}` : `${b} + ${a + 1}`;
    return {
      lines: ['Is this true or false?'], caption: `${a} + ${b} = ${right}`, input: 'choice', answer: truth ? 'true' : 'false', options: TF,
      hint: ['Look at the numbers on each side.'], hintWidget: { widget: 'balance', props: { left: `${a} + ${b}`, right } },
      explain: truth ? [`Both sides use ${a} and ${b}.`, 'Adding works in any order, so it is true.'] : [`${a} + ${b} = ${a + b}.`, `${right} = ${a + b + 1}.`, 'The sides are not the same.'],
      fact: level === 1 ? factKey('+', a, b) : undefined,
    };
  },
};

export const inverseCheck = {
  about: 'Check a calculation with the inverse: 34 + 28 = 62, so 62 − 28 = 34 (Y2-AS-5)',
  levels: 3,
  make(level, R) {
    const isSub = level === 3 && R.chance(0.5);
    let a, b;
    if (level === 1) { a = R.int(3, 12); b = R.int(2, 20 - a); }
    else { a = R.int(12, 60); b = R.int(11, 99 - a); }
    if (a === b) b += 1;
    const s = a + b;
    if (!isSub) {
      const ans = `${s} ${M} ${b} = ${a}`;
      const d = [`${s} + ${b} = ${s + b}`, a >= b ? `${a} ${M} ${b} = ${a - b}` : `${b} ${M} ${a} = ${b - a}`, `${a} + ${b} = ${s}`];
      return {
        lines: [`${a} + ${b} = ${s}.`, 'Which calculation checks it?'], caption: `${a} + ${b} = ${s}`,
        input: 'choice', answer: ans, options: strChoices(R, ans, d.slice(0, 2)),
        hint: ['Subtraction undoes addition.', `Start at ${s}. Subtract ${b}.`],
        explain: [`${s} ${M} ${b} = ${a}.`, `We got back to ${a}, so it checks.`],
        hintWidget: { widget: 'partwhole', props: { whole: s, parts: [a, b] } },
      };
    }
    const ans = `${a} + ${b} = ${s}`;
    const d = [`${s} + ${b} = ${s + b}`, a >= b ? `${a} ${M} ${b} = ${a - b}` : `${b} ${M} ${a} = ${b - a}`];
    return {
      lines: [`${s} ${M} ${b} = ${a}.`, 'Which calculation checks it?'], caption: `${s} ${M} ${b} = ${a}`,
      input: 'choice', answer: ans, options: strChoices(R, ans, d),
      hint: ['Addition undoes subtraction.', `Start at ${a}. Add ${b}.`],
      explain: [`${a} + ${b} = ${s}.`, `We got back to ${s}, so it checks.`],
      hintWidget: { widget: 'partwhole', props: { whole: s, parts: [a, b] } },
    };
  },
};

export const factFamily = {
  about: 'Fact families from one part-whole picture: 3 + 4 = 7, 4 + 3 = 7, 7 − 3 = 4, 7 − 4 = 3 (Y2-AS-2, 2NF–1)',
  levels: 3,
  make(level, R) {
    const tens = level === 3 && R.chance(0.5);
    const k = tens ? 10 : 1;
    let a = R.int(1, level === 1 ? 6 : 9), b = R.int(1, level === 1 ? 10 - a : (tens ? 9 - a : 9));
    if (b < 1) { a = 4; b = 3; }
    if (a === b) b = a + 1 <= 9 ? a + 1 : a - 1;
    if (tens && a + b > 9) { a = 3; b = 4; }
    const A = a * k, B = b * k, S = A + B;
    const fam = [`${A} + ${B} = ${S}`, `${B} + ${A} = ${S}`, `${S} ${M} ${A} = ${B}`, `${S} ${M} ${B} = ${A}`];
    const pw = { widget: 'partwhole', props: { whole: S, parts: [A, B], counters: S <= 10 ? 'both' : 'digits' } };
    const explain = [`${S} is the whole. ${A} and ${B} are the parts.`, `${fam[2]} and ${fam[3]}.`];
    if (level === 1) {
      const ans = R.pick(fam);
      const d = R.shuffle([`${S} + ${A} = ${S + A}`, `${S} + ${B} = ${S + B}`, `${A} + ${A} = ${2 * A}`].filter(x => !fam.includes(x)));
      return {
        lines: ['Which fact belongs to this family?'], ...pw, input: 'choice', answer: ans, options: strChoices(R, ans, d),
        hint: [`The family only uses ${A}, ${B} and ${S}.`, `${S} is the whole.`], explain: [`${ans} uses the whole and both parts.`, explain[0]],
      };
    }
    const form = R.pick([0, 1, 2, 3]);
    const caps = [`${A} + ${B} = ?`, `${B} + ? = ${S}`, `${S} ${M} ${A} = ?`, `${S} ${M} ? = ${A}`];
    const answers = [S, A, B, B];
    const facts = [factKey('+', A, B), factKey('+', A, B), factKey('-', S, A), factKey('-', S, B)];
    return {
      lines: ['Use the part-whole picture.'], caption: caps[form], ...(level === 2 ? pw : {}),
      input: 'numpad', answer: answers[form], hint: [`${S} is the whole.`, `${A} and ${B} are the parts.`],
      hintWidget: level === 3 ? pw : undefined, explain, fact: tens ? facts[form] : facts[form],
    };
  },
};

// ---------------------------------------------------------------- difference and word problems

export const difference = {
  about: 'Difference: how many more, how many fewer, find the difference (2AS–2, Y2-AS-1)',
  levels: 3,
  make(level, R) {
    if (level === 3) {
      const money = R.chance(0.5);
      if (money) {
        const price = R.int(12, 60);
        let have = R.int(Math.max(5, price - 19), price - 2);
        if (price - have === have) have += 1;
        const d = price - have;
        return {
          lines: [`The rocket kit costs £${price}.`, `You have £${have}.`, 'How much more do you need?'],
          input: 'numpad', answer: d, prefix: '£',
          hint: [`Count on from £${have} to £${price}.`], hintWidget: { widget: 'bar', props: { kind: 'compare', a: price, b: have, labelA: 'Cost', labelB: 'You have', unknown: 'difference' } },
          explain: [`£${price} ${M} £${have} = £${d}.`, `You need £${d} more.`],
        };
      }
      const a = R.int(30, 95);
      let b = R.int(12, a - 3);
      if (a - b === b) b += 1;
      const d = a - b;
      return {
        lines: [`Rocket A is ${a} cm tall.`, `Rocket B is ${b} cm tall.`, 'What is the difference in height?'],
        input: 'numpad', answer: d, unit: 'cm',
        hint: [`Count on from ${b} to ${a}.`], hintWidget: { widget: 'bar', props: { kind: 'compare', a, b, labelA: 'Rocket A', labelB: 'Rocket B', unknown: 'difference' } },
        explain: [`${a} ${M} ${b} = ${d}.`, `The difference is ${d} cm.`],
      };
    }
    const t = R.pick(THINGS);
    const a = level === 1 ? R.int(3, 10) : R.int(8, 20);
    let b = R.int(1, a - 1);
    if (a - b === b) b = b > 1 ? b - 1 : b + 1;
    const d = a - b;
    const q = R.pick(['more', 'fewer', 'diff']);
    const lines = [`Crew A found ${a} ${many(t, a)}.`, `Crew B found ${b}.`,
      q === 'more' ? 'How many more did Crew A find?' : q === 'fewer' ? 'How many fewer did Crew B find?' : 'What is the difference?'];
    const bar = { widget: 'bar', props: { kind: 'compare', a, b, labelA: 'Crew A', labelB: 'Crew B', unknown: 'difference', icons: level === 1 ? t.icon : undefined } };
    const explain = [`${b} + ${d} = ${a}.`, `So the difference is ${d}.`];
    const hint = [`${b} + ? = ${a}`, `Or work out ${a} ${M} ${b}.`];
    if (level === 1) return { lines, ...bar, input: 'choice', answer: d, options: choices(R, d, { min: 0, max: 10, extra: [a, b].filter(v => v !== d) }), hint, explain, fact: factKey('-', a, b) };
    return {
      lines, ...bar, input: 'numpad', answer: d, hint, explain, fact: factKey('-', a, b),
      reteach: d <= 10 && a <= 10 ? undefined : { lines: ['Crew A found 7.', 'Crew B found 4.', 'How many more did Crew A find?'], widget: 'bar', props: { kind: 'compare', a: 7, b: 4, labelA: 'Crew A', labelB: 'Crew B', unknown: 'difference', icons: 'star' }, input: 'numpad', answer: 3, hint: ['Count the empty boxes.'], explain: ['4 + 3 = 7.', 'The difference is 3.'], fact: factKey('-', 7, 4) },
    };
  },
};

function story(structure, t, a, b, R) {
  const s = a + b;
  switch (structure) {
    case 'aggregation': {
      const [c1, c2] = R.pick([['gold', 'silver'], ['big', 'small'], ['red', 'blue']]);
      return { lines: [`There are ${a} ${c1} ${many(t, a)}.`, `There are ${b} ${c2} ${many(t, b)}.`, `How many ${t.many} altogether?`], op: '+', ans: s, full: [a, '+', b, s], say: `${a} plus ${b} is equal to ${s}` };
    }
    case 'partitioning': {
      return { lines: [`There are ${s} ${t.many}.`, `${a} ${isAre(a)} gold.`, `How many are not gold?`], op: '-', ans: b, full: [s, '-', a, b], say: `${s} minus ${a} is equal to ${b}` };
    }
    case 'augmentation': {
      const where = t.icon === 'rocket' ? 'on the launch pad' : R.pick(['in the hangar', 'at the moon base', 'in the space station']);
      const verb = t.icon === 'rocket' ? 'land' : 'arrive';
      return { lines: [`There ${isAre(a)} ${a} ${many(t, a)} ${where}.`, `${b} more ${verb}.`, `How many ${t.many} are there now?`], op: '+', ans: s, full: [a, '+', b, s], say: `${a} plus ${b} is equal to ${s}` };
    }
    default: {
      // reduction: the only structure where "take away" is used.
      return { lines: [`First there were ${s} ${t.many}.`, `Then the crew took away ${b}.`, 'How many are there now?'], op: '-', ans: a, full: [s, '-', b, a], say: `${s} minus ${b} is equal to ${a}` };
    }
  }
}

export const wordProblem = {
  about: 'One-step stories: aggregation, partitioning, augmentation and reduction (1AS–2, Y1-AS-4, Y2-AS-1)',
  levels: 3,
  make(level, R, params = {}) {
    const all = ['aggregation', 'partitioning', 'augmentation', 'reduction'];
    const sts = Array.isArray(params.structures) && params.structures.length ? params.structures.filter(x => all.includes(x)) : all;
    const structure = R.pick(sts.length ? sts : all);
    const t = R.pick(THINGS.filter(x => x.icon !== 'helmet'));
    let a, b;
    if (level === 1) { a = R.int(1, 6); b = R.int(1, 10 - a); }
    else if (level === 2) { a = R.int(3, 12); b = R.int(2, 20 - a); }
    else if (R.chance(0.5)) { a = R.int(12, 60); b = R.int(2, 9); } else { a = R.int(12, 50); b = R.int(10, 99 - a); }
    const st = story(structure, t, a, b, R);
    const [x, op, y, z] = st.full;
    const eq = `${x} ${sym(op)} ${y} = ${z}`;
    const explain = [`${eq}.`, `We can write this as ${st.say}.`];
    const hint = structure === 'aggregation' ? ['Put the two groups together.'] : structure === 'augmentation' ? [`Start at ${a}. Count on ${b}.`]
      : structure === 'partitioning' ? [`${x} is the whole. ${y} is one part.`] : [`Start at ${x}. Take away ${y}.`];
    const basic = z <= 20 && x <= 20;
    const fact = basic ? factKey(op, x, y) : undefined;
    if (level === 1) {
      const props = structure === 'reduction' ? { n: x, icon: t.icon, crossed: y, arrange: 'row' }
        : structure === 'partitioning' ? { n: x, icon: t.icon, colours: [y, z], arrange: 'row' }
          : { n: z, icon: t.icon, colours: [x, y], arrange: 'row' };
      return { lines: st.lines, widget: 'objects', props, input: 'choice', answer: st.ans, options: choices(R, st.ans, { min: 0, max: 12 }), hint, explain, fact };
    }
    const hintWidget = level === 2
      ? { widget: 'partwhole', props: op === '+' ? { whole: z, parts: [x, y], hide: 'whole' } : { whole: x, parts: [y, z], hide: 1 } }
      : { widget: 'bar', props: op === '+' ? { kind: 'partwhole', whole: z, parts: [x, y], unknown: 'whole' } : { kind: 'partwhole', whole: x, parts: [y, z], unknown: 1 } };
    const reteach = level === 3
      ? { lines: [`What is ${x} ${sym(op)} ${y}?`], caption: `${x} ${sym(op)} ${y} = ?`, input: 'numpad', answer: z, hint: op === '+' ? ['Add the tens. Then add the ones.'] : [`Subtract the tens. Then the ones.`], explain: [`${eq}.`], hintWidget: { widget: 'blocks', props: { a: x, b: y, op, interactive: true } } }
      : { lines: [`What is ${x} ${sym(op)} ${y}?`], caption: `${x} ${sym(op)} ${y} = ?`, input: 'numpad', answer: z, hint: factHint(op, x, y), explain: [`${eq}.`], fact };
    return { lines: st.lines, input: 'numpad', answer: st.ans, hint, hintWidget, explain, fact, reteach };
  },
};
