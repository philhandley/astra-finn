// Addition and subtraction generators. Owner: addsub. Item format: ENGINE.md section 4.
// Debug: dev/gen.html?gen=addsub&all=1      dev/gen.html?gen=addsub.makeTen&level=1&n=12
// Generators (levels): bondsTo (3, params { target: 5 | 10 | 20 | 100 }), factsWithin10 (3, params { op, zero }),
//   factsWithin20 (3, params { op }), countOn (3), doubles (3), nearDoubles (3), makeTen (3), subtractAcross10 (3),
//   addOnesTens (3, params { kinds }), relatedFacts100 (3), addTwoDigit (3), subTwoDigit (3), threeNumbers (3),
//   missingNumber (3), equalsTrueFalse (3), commutative (3), inverseCheck (3), factFamily (3), difference (3),
//   wordProblem (3, params { structures }).
// Items whose picture is a tens frame also carry answerProps: the props that show the answer on that picture
// (e.g. 7 red and 3 yellow for 7 + ? = 10). tensframe.showAnswer(3) would show 3 red counters instead.
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

// "Start at 6. Count on 3: 7, 8, 9." (only for small counts, so the line stays short)
function countWords(op, a, b) {
  if (!(b >= 1 && b <= 5)) return null;
  const seq = Array.from({ length: b }, (_, k) => (op === '+' ? a + k + 1 : a - k - 1));
  return `Start at ${a}. Count ${op === '+' ? 'on' : 'back'} ${b}: ${seq.join(', ')}.`;
}

// A number line from `from` to `to` for "count the hops" hints: one hop per step for short gaps, or a jump to 10
// and a jump on (labelled +n / −n) when a long gap crosses 10 (the bridging-10 strategy), so there are fewer hops to count.
function hopLine(from, to, max = 20) {
  const step = to >= from ? 1 : -1, gap = Math.abs(to - from);
  const viaTen = gap > 6 && Math.min(from, to) < 10 && Math.max(from, to) > 10;
  const hops = [];
  if (viaTen) hops.push({ from, to: 10 }, { from: 10, to });
  else for (let v = from; v !== to; v += step) hops.push({ from: v, to: v + step });
  return { widget: 'numberline', props: { min: 0, max, labels: 'all', hops, marks: [from], readonly: true }, jumps: viaTen };
}

// ---------------------------------------------------------------- bonds

function fillFrame(a) {
  return {
    lines: ['Fill the frame to make 10.', 'Tap each empty space.'],
    widget: 'tensframe', props: { count: a, frames: 1, interactive: true },
    input: 'widget', goal: { count: 10 },
    hint: ['Tap each empty space once.', 'Count as you tap.'],
    explain: [`${a} and ${10 - a} more fill the frame.`, `10 is made of ${a} and ${10 - a}.`],
  };
}

function bondPicture(T, a, b, R) {
  const fact = factKey('+', a, b);
  const pic = T === 5
    ? { widget: 'partwhole', props: { whole: 5, parts: [a, b], hide: 1, counters: 'both' } }
    : { widget: 'tensframe', props: { count: a, frames: T > 10 ? 2 : 1 } };
  return {
    lines: [T === 5 ? `5 is the whole. One part is ${a}.` : `There ${isAre(a)} ${a} ${a === 1 ? 'counter' : 'counters'}.`, `How many more to make ${T}?`],
    caption: `${a} + ? = ${T}`,
    ...pic,
    input: 'choice', answer: b, options: choices(R, b, { min: 0, max: T }),
    // Tens frames: the hint makes the frame hands-on, so Finn can fill the empty spaces and count them.
    hint: T === 5 ? ['The whole has 5 dots.', `Count on from ${a} to 5.`] : [T > 10 ? 'Tap the empty spaces to fill both frames.' : 'Tap the empty spaces to fill the frame.', 'Count how many you add.'],
    hintProps: T === 5 ? undefined : { interactive: true },
    answerProps: T === 5 ? undefined : { colours: [a, b] },
    explain: [`${a} and ${b} more make ${T}.`, `${T} is made of ${a} and ${b}.`],
    fact,
  };
}

function bond100(level, R) {
  const p = R.int(1, 9), q = 10 - p, a = p * 10, b = q * 10;
  const explain = [`${p} + ${q} = 10.`, `So ${tens(p)} + ${tens(q)} = 10 tens.`, `${a} + ${b} = 100.`];
  const reteach = {
    lines: ['What goes with ' + p + ' to make 10?'], caption: `${p} + ? = 10`,
    widget: 'tensframe', props: { count: p, frames: 1 },
    input: 'numpad', answer: q, hint: ['Count the empty spaces.'], answerProps: { colours: [p, q] },
    explain: [`${p} and ${q} make 10.`, `10 is made of ${p} and ${q}.`], fact: factKey('+', p, q),
  };
  const pw = hide => ({ widget: 'partwhole', props: { whole: 100, parts: [a, b], hide } });
  if (level === 1) {
    return {
      lines: [`${a} and what make 100?`], caption: `${a} + ? = 100`, ...pw(1),
      input: 'choice', answer: b, options: choices(R, b, { min: 0, max: 100, step: 10, extra: [q] }),
      hint: [`Think in tens: ${a} is ${tens(p)}.`, `${p} + ? = 10.`], explain, fact: factKey('+', a, b), reteach,
    };
  }
  if (level === 2) {
    return {
      lines: ['What is the missing part?'], caption: `${a} + ? = 100`, ...pw(1),
      input: 'numpad', answer: b, hint: [`Think in tens: ${a} is ${tens(p)}.`, `${p} + ? = 10.`], explain, fact: factKey('+', a, b), reteach,
    };
  }
  const form = R.pick(['?+b', '100-?', '100=a+?']);
  const cap = form === '?+b' ? `? + ${b} = 100` : form === '100-?' ? `100 ${M} ? = ${a}` : `100 = ${a} + ?`;
  const ans = form === '?+b' ? a : b;
  return {
    lines: ['What is the missing number?'], caption: cap, input: 'numpad', answer: ans,
    hint: [`Think in tens: ${tens(form === '?+b' ? q : p)}.`, 'What goes with it to make 10 tens?'],
    hintWidget: pw(form === '?+b' ? 0 : 1),
    explain: form === '100-?' ? [`${p} + ${q} = 10, so ${a} + ${b} = 100.`, `So 100 ${M} ${b} = ${a}.`] : explain,
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
    const explain = T === 20 && a % 10 !== 0
      ? [`${a % 10} + ${10 - (a % 10)} = 10, so ${a} + ${b} = 20.`, `${T} is made of ${a} and ${b}.`]
      : [`${a} and ${b} make ${T}.`, `${T} is made of ${a} and ${b}.`];
    const dots = T <= 20; // part-whole counters can be drawn
    let reteach;
    if (T === 20 && a !== 10) {
      const s = a % 10;
      reteach = without(bondPicture(10, s, 10 - s, R), 'reteach');
      reteach.lines = a > 10 ? [`${a} is 10 and ${s}.`, `How many more make 10 from ${s}?`] : ['Make 10 first.', `How many more make 10 from ${s}?`];
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
        hint: [`The whole is ${T}. One part is ${hideA ? b : a}.`, `Count on from ${hideA ? b : a} to ${T}.`],
        hintProps: dots && T > 10 ? { counters: 'both' } : undefined,
        explain, fact, reteach: smaller,
      };
    }
    const form = R.pick(['?+b', 'a+?', 'T-?', 'T=a+?']);
    const caption = { '?+b': `? + ${b} = ${T}`, 'a+?': `${a} + ? = ${T}`, 'T-?': `${T} ${M} ? = ${a}`, 'T=a+?': `${T} = ${a} + ?` }[form];
    const ans = form === '?+b' ? a : b;
    const known = form === '?+b' ? b : a;
    // The hint: the known part as counters in a tens frame; the empty spaces are the missing number.
    return {
      lines: ['What is the missing number?'], caption,
      input: 'numpad', answer: ans,
      hint: T === 5 ? ['The whole is 5.', `Count on from ${known} to 5.`] : [known === 0 ? `The ${T > 10 ? 'frames are' : 'frame is'} empty.` : `${known} ${known === 1 ? 'counter is' : 'counters are'} in the ${T > 10 ? 'frames' : 'frame'}.`, `How many more make ${T}? Count the empty spaces.`],
      hintWidget: T === 5
        ? { widget: 'partwhole', props: { whole: 5, parts: [a, b], hide: form === '?+b' ? 0 : 1, counters: 'both' } }
        : { widget: 'tensframe', props: { count: known, frames: T > 10 ? 2 : 1 } },
      answerProps: T === 5 ? undefined : { colours: [known, ans] },
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

// Hints that point at the level 1 picture (coloured rings for adding, crossed-out things for subtracting).
function pictureHint(op, a, b) {
  if (op === '+') {
    if (a === 0 || b === 0) return ['Adding 0 changes nothing.', 'Count them all.'];
    return ['Tap each one to count it.', `Or start at ${a} and count on the ${b} yellow ones.`];
  }
  if (b === 0) return ['Nothing is crossed out.', 'Count them all.'];
  if (b === a) return [`All ${a} are crossed out.`, 'How many are left?'];
  return ['Do not count the crossed-out ones.', 'Tap the others to count them.'];
}

// The method, then the DfE sentence: "Start at 6. Count on 3: 7, 8, 9." "6 plus 3 is equal to 9."
function factExplain(op, a, b, c) {
  const say = `${a} ${word(op)} ${b} is equal to ${c}.`;
  if (op === '+' && (a === 0 || b === 0)) return ['Adding 0 changes nothing.', say];
  if (op === '-' && b === 0) return ['Subtracting 0 changes nothing.', say];
  if (op === '-' && b === a) return [`Take away all ${a}. None are left.`, say];
  const big = op === '+' ? Math.max(a, b) : a, small = op === '+' ? Math.min(a, b) : b;
  const how = countWords(op, big, small) || (op === '+' ? `Start at ${big}. Count on ${small} more.` : `Think: ${c} + ${b} = ${a}.`);
  return [how, say];
}

// Missing-number forms with a number-line hint: count the hops (or add the two jumps), or hop and see where you land.
function missingForm(op, a, b, c, R, max) {
  const count = (from, to, back) => {
    const line = hopLine(from, to, max);
    if (from === to) return [[back ? `What can you take away from ${from} and still have ${to}?` : `What can you add to ${from} and still have ${to}?`], line];
    const hint = line.jumps ? [`Start at ${from}. Jump to 10, then to ${to}.`, 'Add the two jumps.'] : [`Start at ${from}.`, `Count the hops ${back ? 'back ' : ''}to ${to}.`];
    return [hint, line];
  };
  const land = (from, n, to, think) => {
    const line = hopLine(from, to, max);
    return [[think, line.jumps ? `Start at ${from}. Jump to 10, then on.` : `Start at ${from}. Hop ${to > from ? 'on' : 'back'} ${n}.`], line];
  };
  // ? + b = c: hop back b from c (land on the answer), or count up from b when that is fewer hops.
  const forms = op === '+'
    ? [[`${a} + ? = ${c}`, b, ...count(a, c)], [`? + ${b} = ${c}`, a, ...(b <= a ? land(c, b, a, `What goes with ${b} to make ${c}?`) : count(b, c))], [`${c} = ${a} + ?`, b, ...count(a, c)]]
    : [[`${a} ${M} ? = ${c}`, b, ...count(a, c, true)], [`? ${M} ${b} = ${c}`, a, ...land(c, b, a, `Think: ${c} + ${b} = ?`)], [`${c} = ${a} ${M} ?`, b, ...count(a, c, true)]];
  return R.pick(forms);
}

function factItem(level, R, op, a, b, { max = 10 } = {}) {
  const c = op === '+' ? a + b : a - b;
  const fact = factKey(op, a, b);
  const pic = factPicture(op, a, b, c, R);
  // Level 1: Help makes the picture tappable, so Finn can count it.
  const l1 = { ...pic, input: 'choice', answer: c, options: choices(R, c, { min: 0, max: Math.max(max, c + 2) }), hint: pictureHint(op, a, b), hintProps: { tappable: true, interactive: true }, explain: factExplain(op, a, b, c), fact };
  if (level === 1) return l1;
  const hintWidget = op === '+'
    ? { widget: 'tensframe', props: { colours: [a, b], frames: c > 10 ? 2 : 1 } }
    : { widget: pic.widget, props: pic.props };
  const hint = op === '+'
    ? (a === 0 || b === 0 ? ['Adding 0 changes nothing.'] : [`${a} red and ${b} yellow counters.`, `Start at ${Math.max(a, b)}. Count on ${Math.min(a, b)}.`])
    : (b === 0 ? ['Subtracting 0 changes nothing.'] : ['Some are crossed out.', 'Count the ones that are left.']);
  if (level === 2) {
    return {
      lines: [`What is ${a} ${sym(op)} ${b}?`], caption: `${a} ${sym(op)} ${b} = ?`,
      input: 'numpad', answer: c, hint, hintWidget, explain: factExplain(op, a, b, c), fact,
      reteach: without(l1, 'reteach'),
    };
  }
  const [caption, ans, mHint, line] = missingForm(op, a, b, c, R, max);
  return {
    lines: ['What is the missing number?'], caption, input: 'numpad', answer: ans,
    hint: mHint, hintWidget: { widget: line.widget, props: line.props }, explain: [`${a} ${word(op)} ${b} is equal to ${c}.`, `So the missing number is ${ans}.`], fact,
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
    const big = Math.max(a, b), small = Math.min(a, b);
    if (level === 1) {
      const it = factItem(1, R, op, a, b, { max: 20 });
      if (op === '+') {
        it.widget = 'tensframe'; it.props = { colours: [a, b], frames: 2 }; it.lines = [`${a} + ${b}.`, 'How many counters altogether?'];
        it.hint = ['The first frame is full. That is 10.', 'Count on the counters in the second frame.'];
        delete it.hintProps;
        it.answerProps = { colours: [a, b] };
        it.explain = big === 10 ? [`10 and ${small} make ${c}.`, `So ${a} plus ${b} is equal to ${c}.`] : [`${big} is 10 and ${big - 10}. ${big - 10} + ${small} = ${c - 10}.`, `So ${a} plus ${b} is equal to ${c}.`];
      } else {
        it.hint = ['The top row is 10.', 'Count the ones that are not crossed out.'];
        it.explain = [`${a} is 10 and ${a - 10}. ${a - 10} ${M} ${b} = ${c - 10}.`, `So ${a} minus ${b} is equal to ${c}.`];
      }
      return it;
    }
    const it = factItem(level, R, op, a, b, { max: 20 });
    if (bridge && level === 2) {
      if (op === '+') {
        const k = 10 - big, r = small - k;
        it.hint = ['Make 10 first.', `${big} + ${k} = 10. Then add the rest.`];
        it.explain = [`${small} is ${k} and ${r}.`, `${big} + ${k} = 10.`, `10 + ${r} = ${c}.`];
        it.hintWidget = { widget: 'tensframe', props: { colours: [big, small], frames: 2 } };
        it.answerProps = { colours: [big, small] };
        it.reteach = { lines: [`What goes with ${big} to make 10?`], caption: `${big} + ? = 10`, widget: 'tensframe', props: { count: big, frames: 1 }, input: 'numpad', answer: k, hint: ['Count the empty spaces.'], answerProps: { colours: [big, k] }, explain: [`${big} and ${k} make 10.`, `10 is made of ${big} and ${k}.`], fact: factKey('+', big, k) };
      } else {
        const o = a - 10, rest = b - o;
        // Hands-on hint: tap the counters away, the second frame first.
        it.hint = [`Tap the ${o} in the second frame to take ${o === 1 ? 'it' : 'them'} away.`, `Then take ${rest} more from the full frame.`];
        it.explain = [`${b} is ${o} and ${rest}.`, `${a} ${M} ${o} = 10.`, `10 ${M} ${rest} = ${c}.`];
        it.hintWidget = { widget: 'tensframe', props: { count: a, frames: 2, interactive: true } };
        it.answerProps = { count: c };
        it.reteach = { lines: [`What is 10 ${M} ${rest}?`], caption: `10 ${M} ${rest} = ?`, widget: 'tensframe', props: { count: 10, frames: 1 }, input: 'numpad', answer: 10 - rest, hint: [`Count back ${rest} from 10.`], explain: [`Start at 10. Count back ${rest}.`, `10 ${M} ${rest} = ${10 - rest}.`], fact: factKey('-', 10, rest) };
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
    const explain = [countWords(op, a, b), `${a} ${word(op)} ${b} is equal to ${c}.`];
    if (level === 1) {
      return {
        lines: say, caption: `${a} + ${b} = ?`,
        widget: 'numberline', props: { min: 0, max: 20, labels: 'all', hops, readonly: true },
        input: 'choice', answer: c, options: choices(R, c, { min: 0, max: 20 }),
        hint: [`Put your finger on ${a}.`, 'Follow the hops. Where does the last one land?'], explain, fact,
      };
    }
    if (level === 2) {
      return {
        lines: say, caption: `${a} ${M} ${b} = ?`,
        widget: 'numberline', props: { min: 0, max: 20, labels: [...new Set([0, 10, 20, a])], hops, readonly: true },
        input: 'numpad', answer: c,
        hint: ['Now every number is shown.', `Count back ${b} ${b === 1 ? 'hop' : 'hops'} from ${a}.`], hintProps: { labels: 'all' }, explain, fact,
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
        hint: [`Here are ${d} dots in 2 equal groups.`, 'Half is one group. Count it.'],
        hintWidget: { widget: 'objects', props: { n: d, arrange: 'groups', groups: [n, n], colours: [n, n] } },
        explain: [`Double ${n} is ${d}.`, `So half of ${d} is ${n}.`], fact: factKey('-', d, n),
        reteach: { lines: [`What is double ${n}?`], caption: `${n} + ${n} = ?`, widget: 'objects', props: { n: d, arrange: 'rows', perRow: n, colours: [n, n] }, input: 'numpad', answer: d, hint: [`${n} red and ${n} yellow.`, 'Count them all.'], explain: [`${n} + ${n} = ${d}.`, `Double ${n} is ${d}.`], fact: factKey('+', n, n) },
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
        hint: [`The top row has ${n}. The bottom row has ${n} too.`, `Start at ${n}. Count on the bottom row.`], explain: [`${n} + ${n} = ${d}.`, `Double ${n} is ${d}.`], fact: factKey('+', n, n),
      };
    }
    return {
      lines: [`What is double ${n}?`], caption: `${n} + ${n} = ?`, input: 'numpad', answer: d,
      hint: n > 5 ? [`${n} is 5 and ${n - 5}.`, `Double 5 is 10. Then double ${n - 5}.`] : [`Two rows of ${n}.`, `Start at ${n}. Count on ${n}.`],
      hintWidget: { widget: 'objects', props: { n: d, arrange: 'rows', perRow: n, colours: [n, n] } },
      explain: n > 5 ? [`${n} is 5 and ${n - 5}.`, `Double 5 is 10. Double ${n - 5} is ${2 * (n - 5)}.`, `10 + ${2 * (n - 5)} = ${d}. Double ${n} is ${d}.`] : [`${n} + ${n} = ${d}.`, `Double ${n} is ${d}.`],
      fact: factKey('+', n, n),
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
          hint: [`Move 1 from the ${b} to the ${a}.`, `Now it is ${n} + ${n}.`],
          hintWidget: { widget: 'objects', props: { n: s, arrange: 'groups', groups: [a, b], colours: [a, b] } },
          explain: [`Move 1 across: ${a} + ${b} = ${n} + ${n}.`, `Double ${n} is ${s}.`], fact: factKey('+', a, b),
        };
      }
      const n = R.int(4, 9), s = 2 * n + 1;
      return {
        lines: [`Double ${n} is ${2 * n}.`, 'Use it to help.'], caption: `${s} ${M} ${n} = ?`, input: 'numpad', answer: n + 1,
        hint: [`${s} is 1 more than double ${n}.`, `Take away one group of ${n}. Count what is left.`],
        hintWidget: { widget: 'objects', props: { n: s, arrange: 'groups', groups: [n, n + 1], colours: [n, n + 1] } },
        explain: [`Double ${n} is ${2 * n}, so ${n} + ${n + 1} = ${s}.`, `So ${s} ${M} ${n} = ${n + 1}.`], fact: factKey('-', s, n),
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
        hint: [`The ${b > a ? 'yellow' : 'red'} group has 1 extra.`, `So it is 1 more than double ${n}.`], explain, fact: factKey('+', a, b),
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
    const explain = [`${small} is ${k} and ${r}.`, `${big} + ${k} = 10.`, `10 + ${r} = ${s}.`];
    const frames = { widget: 'tensframe', props: { colours: [big, small], frames: 2 } };
    const reteach = { lines: [`What goes with ${big} to make 10?`], caption: `${big} + ? = 10`, widget: 'tensframe', props: { count: big, frames: 1 }, input: 'numpad', answer: k, hint: ['Count the empty spaces.'], answerProps: { colours: [big, k] }, explain: [`${big} and ${k} make 10.`, `10 is made of ${big} and ${k}.`], fact: factKey('+', big, k) };
    if (level === 1) {
      return {
        lines: [`${big} red and ${small} yellow.`, 'Fill the first 10. Then add the rest.'], caption: `${big} + ${small} = ?`, ...frames,
        input: 'choice', answer: s, options: choices(R, s, { min: 10, max: 20 }),
        hint: ['The first frame is full. That is 10.', 'Count on the yellow in the second frame.'], answerProps: { colours: [big, small] }, explain, fact, reteach,
      };
    }
    if (level === 2) {
      return {
        lines: ['Make 10 first.'], caption: `${a} + ${b} = ?`, input: 'numpad', answer: s,
        hint: [`${big} + ${k} = 10. The first frame is full.`, `How many yellow are in the second frame?`], hintWidget: frames, answerProps: { colours: [big, small] }, explain, fact, reteach,
      };
    }
    if (R.chance(0.5)) {
      return {
        lines: [`Split ${small} to make 10.`], caption: `${big} + ${small} = ${big} + ${k} + ?`, input: 'numpad', answer: r,
        hint: [`${small} is the whole. ${k} is one part.`, 'What is the other part?'], hintWidget: { widget: 'partwhole', props: { whole: small, parts: [k, r], hide: 1, counters: 'both' } },
        explain: [`${small} is ${k} and ${r}.`, `${big} + ${k} = 10. 10 + ${r} = ${s}.`], reteach,
      };
    }
    return {
      lines: ['Make 10 first.', 'What goes with 10?'], caption: `${big} + ${small} = 10 + ?`, input: 'numpad', answer: r,
      hint: [`${big} + ${k} = 10. The first frame is full.`, 'How many yellow are in the second frame?'], hintWidget: frames, answerProps: { colours: [big, small] },
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
    // Hands-on hints: the frame becomes tappable, so Finn takes counters away (the second frame first).
    const tapHint = [`Tap the ${o} in the second frame to take ${o === 1 ? 'it' : 'them'} away.`, `Then take ${rest} more from the full frame.`];
    const hint = through ? tapHint : [`Take ${b} away from the full frame.`, `Then add the ${o} in the second frame.`];
    const explain = through ? [`${b} is ${o} and ${rest}.`, `${a} ${M} ${o} = 10.`, `10 ${M} ${rest} = ${c}.`] : [`${a} is 10 and ${o}.`, `10 ${M} ${b} = ${10 - b}.`, `${10 - b} + ${o} = ${c}.`];
    const frame = { widget: 'tensframe', props: { count: a, frames: 2 } };
    const tapFrame = { widget: 'tensframe', props: { count: a, frames: 2, interactive: true } };
    const answerProps = { count: c };
    const reteach = through
      ? { lines: [`What is 10 ${M} ${rest}?`], caption: `10 ${M} ${rest} = ?`, widget: 'tensframe', props: { count: 10, frames: 1 }, input: 'numpad', answer: 10 - rest, hint: [`Count back ${rest} from 10.`], explain: [`Start at 10. Count back ${rest}.`, `10 ${M} ${rest} = ${10 - rest}.`], fact: factKey('-', 10, rest) }
      : { lines: [`What is 10 ${M} ${b}?`], caption: `10 ${M} ${b} = ?`, widget: 'tensframe', props: { count: 10, frames: 1 }, input: 'numpad', answer: 10 - b, hint: [`What goes with ${b} to make 10?`], explain: [`${b} and ${10 - b} make 10.`, `So 10 ${M} ${b} = ${10 - b}.`], fact: factKey('-', 10, b) };
    if (level === 1) {
      return {
        lines: [`${a} counters.`, `Subtract ${b}.`, 'How many are left?'], caption: `${a} ${M} ${b} = ?`, ...frame,
        input: 'choice', answer: c, options: choices(R, c, { min: 0, max: 10 }), hint: tapHint, hintProps: { interactive: true }, answerProps,
        explain: [`${b} is ${o} and ${rest}.`, `${a} ${M} ${o} = 10.`, `10 ${M} ${rest} = ${c}.`], fact, reteach,
      };
    }
    if (level === 2) {
      return { lines: [`What is ${a} ${M} ${b}?`], caption: `${a} ${M} ${b} = ?`, input: 'numpad', answer: c, hint: tapHint, hintWidget: tapFrame, answerProps, explain, fact, reteach };
    }
    if (through) {
      return {
        lines: ['Subtract through 10.'], caption: `${a} ${M} ${b} = 10 ${M} ?`, input: 'numpad', answer: rest,
        hint: [`${a} ${M} ${o} = 10.`, `${b} is ${o} and how many more?`], hintWidget: { widget: 'partwhole', props: { whole: b, parts: [o, rest], hide: 1, counters: 'both' } },
        explain: [`${b} is ${o} and ${rest}.`, `${a} ${M} ${o} = 10, then 10 ${M} ${rest} = ${c}.`], reteach,
      };
    }
    return {
      lines: ['Subtract from 10.'], caption: `${a} ${M} ${b} = ${10 - b} + ?`, input: 'numpad', answer: o,
      hint: [`${a} is 10 and some more.`, 'How many are in the second frame?'], hintWidget: frame, answerProps: { count: a },
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
    let a, b, op, small, explain, hintL3, blockHint;
    if (kind === 'onesAdd') {
      const t = R.int(1, 9), u = R.int(0, 8), v = R.int(1, 9 - u);
      a = t * 10 + u; b = v; op = '+'; small = [u, '+', v];
      explain = [`${a} is ${t * 10} and ${u}.`, `${u} + ${v} = ${u + v}.`, `So ${a} + ${b} = ${a + b}.`];
      hintL3 = ['Only the ones change.', `${u} + ${v} = ?`];
      blockHint = ['Tap Put together.', 'The green tens stay the same. Count the blue ones.'];
    } else if (kind === 'onesSub') {
      const t = R.int(1, 9), u = R.int(1, 9), v = R.int(1, u);
      a = t * 10 + u; b = v; op = '-'; small = [u, '-', v];
      explain = [`${a} is ${t * 10} and ${u}.`, `${u} ${M} ${v} = ${u - v}.`, `So ${a} ${M} ${b} = ${a - b}.`];
      hintL3 = ['Only the ones change.', `${u} ${M} ${v} = ?`];
      blockHint = [`Tap ${v} blue ${v === 1 ? 'cube' : 'cubes'} to take ${v === 1 ? 'it' : 'them'} away.`, 'The green tens stay the same.'];
    } else if (kind === 'tensAdd') {
      const t = R.int(1, 8), u = R.int(1, 9), w = R.int(1, 9 - t);
      a = t * 10 + u; b = w * 10; op = '+'; small = [t, '+', w];
      explain = [`${b} is ${tens(w)}.`, `${tens(t)} + ${tens(w)} = ${tens(t + w)}.`, `So ${a} + ${b} = ${a + b}.`];
      hintL3 = [`${b} is ${tens(w)}. Only the tens change.`, `${t} + ${w} = ?`];
      blockHint = ['Tap Put together.', 'The blue ones stay the same. Count the green tens.'];
    } else if (kind === 'tensSub') {
      const t = R.int(2, 9), u = R.int(1, 9), w = R.int(1, t - 1);
      a = t * 10 + u; b = w * 10; op = '-'; small = [t, '-', w];
      explain = [`${b} is ${tens(w)}.`, `${tens(t)} ${M} ${tens(w)} = ${tens(t - w)}.`, `So ${a} ${M} ${b} = ${a - b}.`];
      hintL3 = [`${b} is ${tens(w)}. Only the tens change.`, `${t} ${M} ${w} = ?`];
      blockHint = [`Tap ${w} green ${w === 1 ? 'rod' : 'rods'} to take ${w === 1 ? 'it' : 'them'} away.`, 'The blue ones stay the same.'];
    } else if (kind === 'tensTens') {
      if (R.chance(0.5)) {
        const p = R.int(1, 8), q = R.int(1, 9 - p);
        a = p * 10; b = q * 10; op = '+'; small = [p, '+', q];
        explain = [`${p} plus ${q} is equal to ${p + q}.`, `So ${tens(p)} plus ${tens(q)} is equal to ${tens(p + q)}.`];
        blockHint = ['Tap Put together.', 'Count the green tens: 10, 20, 30…'];
      } else {
        const p = R.int(2, 9), q = R.int(1, p - 1);
        a = p * 10; b = q * 10; op = '-'; small = [p, '-', q];
        explain = [`${p} minus ${q} is equal to ${p - q}.`, `So ${tens(p)} minus ${tens(q)} is equal to ${tens(p - q)}.`];
        blockHint = [`Tap ${q} green ${q === 1 ? 'rod' : 'rods'} to take ${q === 1 ? 'it' : 'them'} away.`, 'Count the tens that are left.'];
      }
      hintL3 = [`Think in tens: ${small[0]} ${sym(small[1])} ${small[2]} = ?`];
    } else {
      const t = R.int(2, 9), v = R.int(1, 9);
      a = t * 10; b = v; op = '-'; small = [10, '-', v];
      explain = [`${a} is ${tens(t - 1)} and 10 ones.`, `10 ${M} ${v} = ${10 - v}.`, `So ${a} ${M} ${v} = ${a - v}.`];
      hintL3 = [`Swap a ten for 10 ones.`, `10 ${M} ${v} = ?`];
      blockHint = ['There are no ones. Tap Swap 1 ten for 10 ones.', `Then tap ${v} blue ${v === 1 ? 'cube' : 'cubes'}.`];
    }
    const c = op === '+' ? a + b : a - b;
    const [x, sop, y] = small;
    const sc = sop === '+' ? x + y : x - y;
    // A smaller fact to try after "Show me" (none when it is trivial, like 0 + 9).
    const reteach = x === 0 || y === 0 ? undefined : {
      lines: [`What is ${x} ${sym(sop)} ${y}?`], caption: `${x} ${sym(sop)} ${y} = ?`, input: 'numpad', answer: sc,
      hint: factHint(sop, x, y), hintWidget: sop === '+' ? { widget: 'tensframe', props: { colours: [x, y], frames: x + y > 10 ? 2 : 1 } } : { widget: 'tensframe', props: { count: x, frames: x > 10 ? 2 : 1, interactive: true } },
      explain: factExplain(sop, x, y, sc), fact: factKey(sop, x, y),
    };
    const fact = kind === 'tensTens' ? factKey(op, a, b) : undefined;
    const caption = `${a} ${sym(op)} ${b} = ?`;
    const lines = [`What is ${a} ${sym(op)} ${b}?`];
    const blocks = { widget: 'blocks', props: { a, b, op, interactive: true } };
    if (level === 1) {
      return {
        lines: [...lines, 'Use the blocks to help.'], caption, ...blocks,
        input: 'choice', answer: c, options: choices(R, c, { min: 0, max: 100, extra: [c + 10, c - 10, c + 1, c - 1].filter(v => v !== c) }),
        hint: blockHint, explain, fact, reteach,
      };
    }
    if (level === 2) {
      let pic, hint = blockHint;
      if (kind === 'onesAdd' || kind === 'onesSub') {
        const t10 = Math.floor(a / 10) * 10;
        const hops = Array.from({ length: b }, (_, k) => (op === '+' ? { from: a + k, to: a + k + 1 } : { from: a - k, to: a - k - 1 }));
        pic = { widget: 'numberline', props: { min: t10, max: t10 + 10, labels: [...new Set([t10, a, t10 + 10])], hops, readonly: true } };
        hint = [`Start at ${a}. Count the ${b} ${b === 1 ? 'hop' : 'hops'}.`, 'Now every number is shown.'];
        return { lines, caption, ...pic, input: 'numpad', answer: c, hint, hintProps: { labels: 'all' }, explain, fact, reteach };
      } else if (kind === 'fromTen') {
        const hops = Array.from({ length: b }, (_, k) => ({ from: a - k, to: a - k - 1 }));
        pic = { widget: 'numberline', props: { min: a - 10, max: a, labels: [a - 10, a], hops, readonly: true } };
        hint = [`Start at ${a}. Count back ${b} ${b === 1 ? 'hop' : 'hops'}.`, 'Now every number is shown.'];
        return { lines, caption, ...pic, input: 'numpad', answer: c, hint, hintProps: { labels: 'all' }, explain, fact, reteach };
      } else if (kind === 'tensAdd' || kind === 'tensSub') {
        pic = blocks;
      } else {
        pic = { widget: 'partwhole', props: op === '+' ? { whole: c, parts: [a, b], hide: 'whole' } : { whole: a, parts: [b, c], hide: 1 } };
        hint = hintL3;
      }
      return { lines, caption, ...pic, input: 'numpad', answer: c, hint, explain, fact, reteach };
    }
    return { lines, caption, input: 'numpad', answer: c, hint: hintL3, hintWidget: blocks, explain, fact, reteach };
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
        hint: [`Think in tens: ${tens(p)} ${sym(op)} ${tens(q)}.`, `${p} ${sym(op)} ${q} = ${r}, so how many tens?`], explain, fact, reteach,
      };
    }
    if (level === 2) {
      return { lines: [`What is ${A} ${sym(op)} ${B}?`], caption: `${A} ${sym(op)} ${B} = ?`, input: 'numpad', answer: C, hint: [`Think in tens: ${tens(p)} ${sym(op)} ${tens(q)}.`, `What is ${p} ${sym(op)} ${q}?`], hintWidget: pw, explain, fact, reteach };
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
    // DfE: "First I partition both numbers. Then I add the tens. Then I add the ones. Then I combine."
    const part = x => (x % 10 === 0 ? `${x} is ${tens(x / 10)}.` : `${x} is ${x - (x % 10)} and ${x % 10}.`);
    const explain = [`${part(a)} ${part(b)}`, `${t1 * 10} + ${t2 * 10} = ${T}.${u1 && u2 ? ` ${u1} + ${u2} = ${O}.` : ''}`, O ? `${T} + ${O} = ${s}.` : `So ${a} + ${b} = ${s}.`];
    const hint = ['First add the tens.', 'Then add the ones.'];
    const reteach = u1 === 0 || u2 === 0 ? undefined : { lines: [`What is ${u1} + ${u2}?`], caption: `${u1} + ${u2} = ?`, input: 'numpad', answer: O, hint: factHint('+', u1, u2), hintWidget: { widget: 'tensframe', props: { colours: [u1, u2], frames: O > 10 ? 2 : 1 } }, answerProps: { colours: [u1, u2] }, explain: factExplain('+', u1, u2, O), fact: factKey('+', u1, u2) };
    const blocks = { widget: 'blocks', props: { a, b, op: '+', interactive: true } };
    if (level === 1) {
      return {
        lines: [`What is ${a} + ${b}?`, 'Put the blocks together to help.'], caption: `${a} + ${b} = ?`, ...blocks,
        input: 'choice', answer: s, options: choices(R, s, { min: 0, max: 100, extra: [s + 10, s - 10, s + 1] }),
        hint: ['Tap Put together.', 'Count the green tens, then the blue ones.'], explain, reteach,
      };
    }
    if (level === 2) {
      return {
        lines: [`What is ${a} + ${b}?`, 'Swap 10 ones for a ten.'], caption: `${a} + ${b} = ?`, ...blocks,
        input: 'numpad', answer: s, hint: ['Tap Put together. Then tap Swap.', `${O} ones is 1 ten and ${O - 10} ones.`, 'Count the tens, then the ones.'], explain, reteach,
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
    const t2 = T / 10;
    // DfE: partition only the number you subtract: 52 − 27 = 52 − 20 − 7.
    const explain = u ? [`I partition ${b} into ${T} and ${u}.`, `${a} ${M} ${T} = ${mid}.`, `${mid} ${M} ${u} = ${c}.`] : [`${b} is ${tens(t2)}.`, `${a} ${M} ${T} = ${c}.`];
    const hint = u ? [`First subtract ${T}.`, `Then subtract ${u}.`] : [`Subtract ${T}.`, 'The ones stay the same.'];
    const rodWord = `${t2} green ${t2 === 1 ? 'rod' : 'rods'}`, cubeWord = `${u} blue ${u === 1 ? 'cube' : 'cubes'}`;
    const ones = a % 10;
    const reteach = u > ones
      ? { lines: [`What is ${10 + ones} ${M} ${u}?`], caption: `${10 + ones} ${M} ${u} = ?`, input: 'numpad', answer: 10 + ones - u, hint: ones ? [`Tap the ${ones} in the second frame first.`, 'Then take the rest from the full frame.'] : [`Take ${u} from the full frame.`], hintWidget: { widget: 'tensframe', props: { count: 10 + ones, frames: 2, interactive: true } }, answerProps: { count: 10 + ones - u }, explain: ones ? [`${u} is ${ones} and ${u - ones}.`, `${10 + ones} ${M} ${ones} = 10. 10 ${M} ${u - ones} = ${10 + ones - u}.`] : [`10 ${M} ${u} = ${10 - u}.`], fact: factKey('-', 10 + ones, u) }
      : u === 0 ? undefined
        : { lines: [`What is ${ones} ${M} ${u}?`], caption: `${ones} ${M} ${u} = ?`, input: 'numpad', answer: ones - u, hint: factHint('-', ones, u), explain: factExplain('-', ones, u, ones - u), fact: factKey('-', ones, u) };
    const blocks = { widget: 'blocks', props: { a, b, op: '-', interactive: true } };
    if (level === 1) {
      return {
        lines: [`What is ${a} ${M} ${b}?`, 'Tap the blocks to subtract.'], caption: `${a} ${M} ${b} = ?`, ...blocks,
        input: 'choice', answer: c, options: choices(R, c, { min: 0, max: 100, extra: [c + 10, c - 10, c + 1].filter(v => v >= 0) }),
        hint: u ? [`Tap ${rodWord}.`, `Then tap ${cubeWord}. Count what is left.`] : [`Tap ${rodWord}.`, 'Count what is left.'], explain, reteach,
      };
    }
    if (level === 2) {
      return {
        lines: [`What is ${a} ${M} ${b}?`, 'Swap a ten for 10 ones.'], caption: `${a} ${M} ${b} = ?`, ...blocks,
        input: 'numpad', answer: c, hint: [`Tap ${rodWord} first.`, 'Then tap Swap 1 ten for 10 ones.', `Now tap ${cubeWord}.`], explain, reteach,
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
    const explain = bond ? [`First I find a bond to 10: ${bond[0]} + ${bond[1]} = 10.`, `Then 10 + ${z} = ${s}.`] : [`${p} + ${q} = ${p + q}.`, `${p + q} + ${r} = ${s}.`];
    const hint = bond ? ['Find 2 groups that make 10.', 'Add those first. Then add the last group.'] : ['Add 2 groups first.', 'Then add the last one.'];
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
        hint: [`The whole is ${s}.`, 'Is there a bond to 10 hiding?'],
        hintWidget: { widget: 'partwhole', props: { whole: s, parts: nums, hide: hideAt } },
        explain: [`${bond[0]} + ${bond[1]} = 10.`, `10 + ${z} = ${s}.`, `So the missing number is ${bond[1]}.`], reteach,
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
    const explain = [`${full}.`, 'Both sides are the same, so the scales balance.'];
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
        hint: [`The bar shows ${a} and ${b}.`, 'Which one uses the same two numbers, added?'],
        hintWidget: { widget: 'bar', props: { kind: 'partwhole', whole: a + b, parts: [a, b] } },
        explain: [`${a} + ${b} = ${a + b} and ${b} + ${a} = ${a + b}.`, 'Adding works in any order.'],
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
        hint: [`${big} ${M} ${small} = ${big - small}.`, `Start with ${small}. Can you take away ${big}?`],
        hintWidget: { widget: 'balance', props: { left: `${big} ${M} ${small}`, right: `${small} ${M} ${big}` } },
        explain: [`${big} ${M} ${small} = ${big - small}.`, `${small} ${M} ${big} is not ${big - small}.`, 'Order matters when we subtract.'],
      };
    }
    const truth = R.chance(0.75);
    const right = truth ? `${b} + ${a}` : `${b} + ${a + 1}`;
    return {
      lines: ['Is this true or false?'], caption: `${a} + ${b} = ${right}`, input: 'choice', answer: truth ? 'true' : 'false', options: TF,
      hint: ['Look at the numbers on each side.', 'Are they the same two numbers?'], hintWidget: { widget: 'balance', props: { left: `${a} + ${b}`, right } },
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
        hint: ['Subtraction undoes addition.', `Start with the whole: ${s}.`],
        explain: [`${s} ${M} ${b} = ${a}.`, `We got back to ${a}, so it checks.`],
        hintWidget: { widget: 'partwhole', props: { whole: s, parts: [a, b] } },
      };
    }
    const ans = `${a} + ${b} = ${s}`;
    const d = [`${s} + ${b} = ${s + b}`, a >= b ? `${a} ${M} ${b} = ${a - b}` : `${b} ${M} ${a} = ${b - a}`];
    return {
      lines: [`${s} ${M} ${b} = ${a}.`, 'Which calculation checks it?'], caption: `${s} ${M} ${b} = ${a}`,
      input: 'choice', answer: ans, options: strChoices(R, ans, d),
      hint: ['Addition undoes subtraction.', `Which one adds back to ${s}?`],
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
    const explain = [`${S} is the whole. ${A} and ${B} are the parts.`, `${fam[0]}, ${fam[1]}.`, `${fam[2]}, ${fam[3]}.`];
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
    const formHint = [
      [`The parts are ${A} and ${B}.`, 'Put the parts together. What is the whole?'],
      [`The whole is ${S}. One part is ${B}.`, 'What is the other part?'],
      [`The whole is ${S}. Take away the ${A} part.`, 'Which part is left?'],
      [`The whole is ${S}. ${A} is left.`, 'Which part was taken away?'],
    ][form];
    // The picture hides the number we are looking for, so it shows the family without giving the answer away.
    const hidden = { widget: 'partwhole', props: { ...pw.props, hide: form === 0 ? 'whole' : form === 1 ? 0 : 1 } };
    return {
      lines: [level === 2 ? 'Use the part-whole picture.' : 'Use a fact family.'], caption: caps[form], ...(level === 2 ? hidden : {}),
      input: 'numpad', answer: answers[form], hint: formHint,
      hintWidget: level === 3 ? hidden : undefined,
      explain: [`${S} is the whole. ${A} and ${B} are the parts.`, `So ${fam[form]}.`], fact: facts[form],
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
          widget: 'bar', props: { kind: 'compare', a: price, b: have, labelA: 'Cost', labelB: 'You have', unknown: 'difference' },
          input: 'numpad', answer: d, prefix: '£',
          hint: [`Count on from £${have} to £${price}.`, `Or work out £${price} ${M} £${have}.`],
          explain: [`£${price} ${M} £${have} = £${d}.`, `You need £${d} more.`],
        };
      }
      const a = R.int(30, 95);
      let b = R.int(12, a - 3);
      if (a - b === b) b += 1;
      const d = a - b;
      return {
        lines: [`Rocket A is ${a} cm tall.`, `Rocket B is ${b} cm tall.`, 'What is the difference in height?'],
        widget: 'bar', props: { kind: 'compare', a, b, labelA: 'Rocket A', labelB: 'Rocket B', unknown: 'difference' },
        input: 'numpad', answer: d, unit: 'cm',
        hint: [`Count on from ${b} to ${a}.`, `Or work out ${a} ${M} ${b}.`],
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
    const explain = [`${b} + ${d} = ${a}.`, `The difference between ${a} and ${b} is ${d}.`];
    const hint = [`${b} + ? = ${a}`, `Or work out ${a} ${M} ${b}.`];
    if (level === 1) return { lines, ...bar, input: 'choice', answer: d, options: choices(R, d, { min: 0, max: 10, extra: [a, b].filter(v => v !== d) }), hint: ['Line up the two bars.', 'Count the empty boxes.'], explain, fact: factKey('-', a, b) };
    return {
      lines, ...bar, input: 'numpad', answer: d,
      hint: a <= 12 ? ['Line up the two bars.', 'Count the empty boxes.'] : [`Count on from ${b} to ${a}.`, `Or work out ${a} ${M} ${b}.`],
      hintProps: a <= 12 ? { icons: t.icon } : undefined,
      explain, fact: factKey('-', a, b),
      reteach: d <= 10 && a <= 10 ? undefined : { lines: ['Crew A found 7.', 'Crew B found 4.', 'How many more did Crew A find?'], widget: 'bar', props: { kind: 'compare', a: 7, b: 4, labelA: 'Crew A', labelB: 'Crew B', unknown: 'difference', icons: 'star' }, input: 'numpad', answer: 3, hint: ['Count the empty boxes.'], explain: ['4 + 3 = 7.', 'The difference is 3.'], fact: factKey('-', 7, 4) },
    };
  },
};

function story(structure, t, a, b, R, level = 1) {
  const s = a + b;
  switch (structure) {
    case 'aggregation': {
      // Level 1 draws the first group with red rings and the second with yellow, so the words must say red and yellow.
      const [c1, c2] = level === 1 ? ['red', 'yellow'] : R.pick([['red', 'yellow'], ['big', 'small']]);
      return { lines: [`There are ${a} ${c1} ${many(t, a)}.`, `There are ${b} ${c2} ${many(t, b)}.`, `How many ${t.many} altogether?`], op: '+', ans: s, full: [a, '+', b, s], say: `${a} plus ${b} is equal to ${s}` };
    }
    case 'partitioning': {
      return { lines: [`There are ${s} ${t.many}.`, `${a} ${isAre(a)} red.`, `How many are not red?`], op: '-', ans: b, full: [s, '-', a, b], say: `${s} minus ${a} is equal to ${b}` };
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
    if (a === b) b = b > 2 ? b - 1 : b + 1; // equal parts would put the answer in the story
    const st = story(structure, t, a, b, R, level);
    const [x, op, y, z] = st.full;
    const eq = `${x} ${sym(op)} ${y} = ${z}`;
    const explain = [`${eq}.`, `We can write this as ${st.say}.`];
    // Counting on or back is a good nudge for small steps; bigger ones go tens first.
    const onHint = (p, q) => (q <= 5 ? [`Start at ${p}. Count on ${q}.`] : p + q <= 20 ? [`Start at ${Math.max(p, q)}.`, `Count on ${Math.min(p, q)}.`] : ['Add the tens.', 'Then add the ones.']);
    const backHint = (p, q) => (q <= 5 ? [`Start at ${p}. Count back ${q}.`] : p <= 20 ? [`Take away ${p - 10} to get to 10.`, 'Then take away the rest.'] : ['Take away the tens.', 'Then take away the ones.']);
    let hint = structure === 'aggregation' ? ['Put the two groups together.', 'How many altogether?'] : structure === 'augmentation' ? onHint(a, b)
      : structure === 'partitioning' ? [`${x} is the whole. ${y} is one part.`, 'What is the other part?'] : backHint(x, y);
    if (level === 1) {
      // Point at the picture: coloured rings, or crossed-out things.
      hint = structure === 'reduction' ? ['Do not count the crossed-out ones.', 'Tap the others to count them.']
        : structure === 'partitioning' ? ['The red ones are not the answer.', 'Tap the yellow ones to count them.']
          : ['Tap each one to count them all.', `Or start at ${a} and count on ${b}.`];
    }
    const basic = z <= 20 && x <= 20;
    const fact = basic ? factKey(op, x, y) : undefined;
    if (level === 1) {
      const props = structure === 'reduction' ? { n: x, icon: t.icon, crossed: y, arrange: 'row' }
        : structure === 'partitioning' ? { n: x, icon: t.icon, colours: [y, z], arrange: 'row' }
          : { n: z, icon: t.icon, colours: [x, y], arrange: 'row' };
      return { lines: st.lines, widget: 'objects', props, input: 'choice', answer: st.ans, options: choices(R, st.ans, { min: 0, max: 12 }), hint, hintProps: { tappable: true, interactive: true }, explain, fact };
    }
    // Levels 2 and 3 show the story as a model (part-whole, then a bar model); the hint adds counters where they fit.
    const model = level === 2
      ? { widget: 'partwhole', props: op === '+' ? { whole: z, parts: [x, y], hide: 'whole' } : { whole: x, parts: [y, z], hide: 1 } }
      : { widget: 'bar', props: op === '+' ? { kind: 'partwhole', whole: z, parts: [x, y], unknown: 'whole' } : { kind: 'partwhole', whole: x, parts: [y, z], unknown: 1 } };
    const hintProps = level === 2 && Math.max(x, z) <= 20 ? { counters: 'both' } : undefined;
    const reteach = level === 3
      ? { lines: [`What is ${x} ${sym(op)} ${y}?`], caption: `${x} ${sym(op)} ${y} = ?`, input: 'numpad', answer: z, hint: op === '+' ? ['Add the tens. Then add the ones.'] : [`Subtract the tens. Then the ones.`], explain: [`${eq}.`], hintWidget: { widget: 'blocks', props: { a: x, b: y, op, interactive: true } } }
      : { lines: [`What is ${x} ${sym(op)} ${y}?`], caption: `${x} ${sym(op)} ${y} = ?`, input: 'numpad', answer: z, hint: factHint(op, x, y), explain: [`${eq}.`], fact };
    return { lines: st.lines, ...model, input: 'numpad', answer: st.ans, hint, hintProps, explain, fact, reteach };
  },
};
