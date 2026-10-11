// Fraction generators (Fraction Forge sector). See ENGINE.md section 4.
// Year 1: halves and quarters as 1 of 2 or 1 of 4 equal parts. Year 2: 1/3, 1/4, 2/4, 3/4 of shapes, lengths,
// sets and amounts; 1/2 of 6 = 3; 2/4 is the same as 1/2; counting in halves and quarters past 1.
// Debug: dev/gen.html?gen=fractions&all=1   or   dev/gen.html?gen=fractions.shadeFraction&level=3&n=12
// Fractions in lines are written "1/2" so the read-aloud says "a half".
// Sets always draw real things (crystals, apples, biscuits) named in the words, never empty circles.
// params.parts (nameFraction, shadeFraction): limit the denominators, e.g. { parts: [2] } for a halves-only warm-up.

const SHAPES = ['square', 'circle', 'rect'];
const NAME = { square: 'square', circle: 'circle', rect: 'rectangle', bar: 'strip', set: 'set' };
const POOL = ['1/2', '1/3', '1/4', '2/4', '3/4', '2/3'];
const ITEMS = [
  { item: 'crystals', icon: 'crystal' }, { item: 'moon rocks', icon: 'asteroid' }, { item: 'space biscuits', icon: 'cookie' },
  { item: 'fuel cans', icon: 'fuel' }, { item: 'stars', icon: 'star' }, { item: 'apples', icon: 'apple' },
];

const frac = (k, n) => `${k}/${n}`;
const WORDS = { 2: 'halves', 3: 'thirds', 4: 'quarters' };
// A set of real things for a set picture: { item, icon }.
const setOf = R => R.pick(ITEMS);
// DfE stems (2F-1): "The whole is divided into _ equal parts. _ of them are shaded."
const wholeIs = (n, what = 'The whole') => `${what} is divided into ${n} equal parts.`;
const only = (params, list) => {
  const want = Array.isArray(params && params.parts) ? params.parts.map(Number) : null;
  const out = want ? list.filter(x => want.includes(Array.isArray(x) ? x[0] : x)) : list;
  return out.length ? out : list;
};
const fval = f => { const [a, b] = String(f).split('/').map(Number); return a / b; };
// Distractors that are never equal in value to the answer (so 1/2 is never offered beside 2/4).
const notSame = (ans, list) => {
  const seen = [fval(ans)], out = [];
  for (const v of list) {
    const x = fval(v);
    if (!(x > 0 && x < 1) || seen.some(y => Math.abs(x - y) < 1e-9)) continue;
    seen.push(x); out.push(v);
  }
  return out;
};
const fw = (v, den = 2) => {
  // A number as whole + unicode fraction: 1.5 -> "1½", 0.25 -> "¼".
  const w = Math.floor(v + 1e-9), r = Math.round((v - w) * 4);
  const part = { 0: '', 1: '¼', 2: '½', 3: '¾' }[r];
  if (!part) return String(w);
  return (w ? String(w) : '') + part;
};

function opts(R, ans, cands, n = 3) {
  const out = [ans];
  for (const c of R.shuffle(cands)) {
    if (out.length >= n) break;
    if (c !== undefined && c !== null && !out.some(o => String(o) === String(c)) && (typeof c !== 'number' || c >= 0)) out.push(c);
  }
  let d = 1;
  while (out.length < n && typeof ans === 'number') {
    for (const c of [ans + d, ans - d]) if (out.length < n && c >= 0 && !out.includes(c)) out.push(c);
    d++;
  }
  return R.shuffle(out);
}

// Pick "each" so the answer never equals a number already written in the question (like the 4 in 1/4).
function pickEach(R, a, b, n, k, extra = []) {
  for (let t = 0; t < 30; t++) {
    const e = R.int(a, b);
    const ans = e * k, total = e * n;
    if (![n, k, ...extra].includes(ans) && !String(total).includes(String(ans)) || t === 29) return e;
  }
  return a;
}

const fr = (props) => ({ widget: 'fractions', props: { readonly: true, ...props } });
// Share `total` into n groups. The groups widget holds at most 50 things; bigger totals get a still picture of the groups.
const shareHint = (total, n) => (total <= 50
  ? { widget: 'groups', props: { total, mode: 'share', bowls: n, icon: 'dot', interactive: true } }
  : { widget: 'objects', props: { n: total, arrange: 'groups', groups: Array(n).fill(total / n), icon: 'dot' } });
const pickIdx = (R, n, k) => R.sample(Array.from({ length: n }, (_, i) => i), k).sort((a, b) => a - b);

// ---------- equal parts ----------
export const isEqualParts = {
  about: 'Is it cut into equal parts? Is the coloured part a half, a quarter, a third?',
  levels: 3,
  make(level, R) {
    const n = level <= 1 ? 2 : level === 2 ? 4 : R.pick([2, 3, 4]);
    const shape = level <= 1 ? R.pick(SHAPES) : level === 2 ? R.pick([...SHAPES, 'bar']) : R.pick([...SHAPES, 'bar', 'set']);
    const unequal = R.chance(0.5);
    const props = { shape, parts: n, unequal, shaded: 1 };
    const f = frac(1, n);
    const word = WORDS[n];
    if (shape === 'set') {
      const c = setOf(R);
      props.setSize = n * R.int(2, 3);
      props.icon = c.icon;
      return {
        lines: [`Is the coloured ring ${f} of the ${c.item}?`],
        ...fr(props),
        input: 'choice', answer: unequal ? 'No' : 'Yes', options: ['Yes', 'No'],
        hint: [`Count the ${c.item} in each ring.`, 'Does every ring have the same number?'],
        explain: unequal
          ? ['The rings do not have the same number.', `So they are not ${word}.`]
          : [`The ${c.item} are in ${n} equal groups.`, `1 of ${n} equal groups is ${f}.`],
        reteach: isEqualParts.make(1, R),
      };
    }
    return {
      lines: [`Is the coloured part ${f} of the ${NAME[shape]}?`],
      ...fr(props),
      input: 'choice', answer: unequal ? 'No' : 'Yes', options: ['Yes', 'No'],
      hint: [`${f} is 1 of ${n} equal parts.`, n === 2 ? 'Is the coloured part the same size as the white part?' : 'Is every part the same size?'],
      explain: unequal
        ? ['The parts are not the same size.', `So they are not ${word}, and the coloured part is not ${f}.`]
        : [wholeIs(n), `Each part is ${f} of the whole. The coloured part is ${f}.`],
      reteach: level > 1 ? isEqualParts.make(1, R) : undefined,
    };
  },
};

export const nameFraction = {
  about: 'Name the coloured fraction of a shape, strip or set',
  levels: 3,
  make(level, R, params = {}) {
    let n, k, shape;
    if (level <= 1) { n = R.pick(only(params, [2, 4])); k = 1; shape = R.pick(SHAPES); }
    else if (level === 2) { [n, k] = R.pick(only(params, [[2, 1], [3, 1], [4, 1], [4, 2], [4, 3]])); shape = R.pick([...SHAPES, 'bar']); }
    else { [n, k] = R.pick(only(params, [[3, 1], [4, 2], [4, 3], [3, 2], [4, 1]])); shape = R.pick(['bar', 'set', 'circle', 'rect']); }
    const ans = frac(k, n);
    const props = { shape, parts: n, shadedIdx: level <= 1 ? [0] : pickIdx(R, n, k) };
    const c = shape === 'set' ? setOf(R) : null;
    if (c) { props.setSize = n * R.int(2, 3); props.icon = c.icon; }
    const of = c ? ` of the ${c.item}` : '';
    const part = c ? 'group' : 'part';
    const whole = c ? `The ${c.item} are split into ${n} equal groups.` : wholeIs(n);
    if (level >= 3 && R.chance(0.35)) {
      // Name the part that is NOT coloured.
      const un = frac(n - k, n);
      return {
        lines: [`What fraction${of} is not coloured?`],
        ...fr(props),
        input: 'choice', answer: un, options: opts(R, un, notSame(un, [ans, frac(1, n), ...POOL]).slice(0, 4)),
        hint: [`Count the ${part}s that are not coloured.`, `There are ${n} equal ${part}s altogether.`],
        hintProps: { labels: true },
        explain: [whole, `${n - k} of the ${n} ${part}s are not coloured. That is ${un}.`],
        reteach: nameFraction.make(2, R, params),
      };
    }
    const cands = notSame(ans, [frac(n - k, n), frac(1, n), ...R.shuffle(POOL)]);
    return {
      lines: [`What fraction${of} is coloured?`],
      ...fr(props),
      input: 'choice', answer: ans, options: opts(R, ans, cands.slice(0, 4)),
      hint: [`How many equal ${part}s are there?`, 'How many are coloured?'],
      hintProps: { labels: true },
      explain: [whole, `${k} ${k === 1 ? `${part} is` : `${part}s are`} coloured. That is ${ans}.`],
      reteach: level > 1 ? nameFraction.make(1, R, params) : undefined,
    };
  },
};

export const shadeFraction = {
  about: 'Colour a fraction of a shape; at level 3 smash it into parts first',
  levels: 3,
  make(level, R, params = {}) {
    let n, k, shape;
    if (level <= 1) { n = R.pick(only(params, [2, 4])); k = 1; shape = R.pick(SHAPES); }
    else if (level === 2) { [n, k] = R.pick(only(params, [[4, 3], [4, 2], [3, 1], [3, 2], [4, 1]])); shape = R.pick([...SHAPES, 'bar']); }
    else { [n, k] = R.pick(only(params, [[4, 3], [4, 2], [3, 1], [2, 1], [4, 1]])); shape = R.pick(['square', 'circle', 'rect', 'bar']); }
    const f = frac(k, n);
    const word = WORDS[n];
    if (level >= 3) {
      return {
        lines: [`Smash the ${NAME[shape]} into ${word}.`, `Then colour ${f}.`],
        widget: 'fractions', props: { shape, parts: 1, tools: n === 3 ? ['2', '3', 'glue'] : ['2', '3', '4', 'glue'] },
        input: 'widget', goal: { parts: n, shaded: k },
        hint: [n === 4 ? 'Tap the hammer with a 4, or the 2 twice.' : `Tap the hammer with a ${n}.`, `Then tap ${k} of the ${n} parts.`],
        hintProps: { labels: true },
        explain: [`${f} means ${k} of ${n} equal parts.`, `Smash it into ${word}, then colour ${k}.`],
        reteach: { lines: [`Colour ${f} of the ${NAME[shape]}.`], widget: 'fractions', props: { shape, parts: n, labels: true }, input: 'widget', goal: { parts: n, shaded: k }, hint: [`Tap ${k} of the ${n} parts.`], explain: [`${f} is ${k} of the ${n} equal parts.`] },
      };
    }
    return {
      lines: [`Colour ${f} of the ${NAME[shape]}.`, 'Tap the parts to colour them.'],
      widget: 'fractions', props: { shape, parts: n },
      input: 'widget', goal: { parts: n, shaded: k },
      hint: [`There are ${n} equal parts.`, `Tap ${k} of them.`],
      hintProps: { labels: true },
      explain: [wholeIs(n, `The ${NAME[shape]}`), `${f} means ${k} of the ${n} equal parts.`],
      reteach: level > 1 ? shadeFraction.make(1, R, params) : undefined,
    };
  },
};

// ---------- fractions of sets, amounts and lengths ----------
export const fractionOfSet = {
  about: 'A fraction of a set of objects, split into equal rings',
  levels: 3,
  make(level, R) {
    let n, k, each;
    if (level <= 1) { n = 2; k = 1; each = pickEach(R, 2, 5, n, k); }
    else if (level === 2) { n = R.pick([2, 4]); k = 1; each = pickEach(R, 2, n === 4 ? 4 : 6, n, k); }
    else { [n, k] = R.pick([[4, 3], [4, 2], [3, 1], [3, 2], [4, 3]]); each = pickEach(R, 2, 4, n, k); }
    const total = n * each, ans = k * each, f = frac(k, n);
    const c = setOf(R);
    // Level 1 shows the equal groups (one coloured). Higher levels start as one whole set; the hint smashes it into groups.
    const props = level <= 1 ? { shape: 'set', setSize: total, parts: n, shaded: 1, icon: c.icon } : { shape: 'set', setSize: total, parts: 1, icon: c.icon };
    const item = {
      lines: [`What is ${f} of ${total} ${c.item}?`],
      ...fr(props),
      hint: [`Look: the ${c.item} are in ${n} equal groups now.`, `Count the ${c.item} in ${k === 1 ? 'the coloured ring' : `the ${k} coloured rings`}.`],
      hintProps: { parts: n, shaded: k, labels: true },
      explain: [`${total} split into ${n} equal groups is ${each} in each group.`, k === 1 ? `${f} of ${total} is ${ans}.` : `${k} groups of ${each} is ${ans}. So ${f} of ${total} is ${ans}.`],
    };
    if (level <= 1) return { ...item, input: 'choice', answer: ans, options: opts(R, ans, [total, n, ans + 1, ans - 1]) };
    return { ...item, input: 'numpad', answer: ans, reteach: fractionOfSet.make(level - 1, R) };
  },
};

export const fractionOfAmount = {
  about: 'Find 1/2, 1/4, 1/3 and 3/4 of an amount',
  levels: 3,
  make(level, R) {
    const c = R.pick(ITEMS);
    if (level <= 1) {
      const n = R.pick([2, 2, 4]);
      const each = R.int(2, n === 4 ? 3 : 5);
      const total = n * each;
      return {
        lines: [`Find ${frac(1, n)} of ${total} ${c.item}.`, `Share them into ${n} equal groups.`],
        widget: 'groups', props: { total, mode: 'share', bowls: n, icon: c.icon, interactive: true },
        input: 'choice', answer: each, options: opts(R, each, [total, n, each + 1, each - 1]),
        hint: ['Tap Deal one each until they are all shared.', 'Then count one group.'],
        explain: [`${total} shared into ${n} equal groups is ${each} in each group.`, `${frac(1, n)} of ${total} = ${each}.`],
      };
    }
    if (level === 2) {
      const n = R.pick([2, 4, 2]);
      const each = n === 2 ? pickEach(R, 3, 10, n, 1) : pickEach(R, 2, 5, n, 1);
      const total = n * each;
      return {
        lines: ['Find the fraction of the number.'],
        caption: `${frac(1, n)} of ${total} = ?`,
        input: 'numpad', answer: each,
        hint: [`Share ${total} into ${n} equal groups.`, 'Tap Deal one each, then count one group.'],
        hintWidget: { widget: 'groups', props: { total, mode: 'share', bowls: n, icon: c.icon, interactive: true } },
        explain: [`${total} shared into ${n} equal groups is ${each} in each group.`, `${frac(1, n)} of ${total} = ${each}.`],
        reteach: fractionOfAmount.make(1, R),
      };
    }
    const [n, k] = R.pick([[4, 3], [3, 1], [4, 2], [2, 1], [4, 3], [3, 2]]);
    const each = n === 2 ? R.pick([10, 15, 20, 25, 30]) : pickEach(R, 2, 5, n, k);
    const total = n * each, ans = k * each;
    return {
      lines: [k > 1 ? `First find ${frac(1, n)}. Then ${k} lots of it.` : 'Find the fraction of the number.'],
      caption: `${frac(k, n)} of ${total} = ?`,
      input: 'numpad', answer: ans,
      hint: [`${frac(1, n)} of ${total} is ${total} shared into ${n}.`, k > 1 ? `Then add ${k} of the groups.` : 'Count one group.'],
      hintWidget: shareHint(total, n),
      explain: [`${total} shared into ${n} equal groups is ${each} in each group, so ${frac(1, n)} of ${total} is ${each}.`, k > 1 ? `${k} groups of ${each} is ${ans}. So ${frac(k, n)} of ${total} = ${ans}.` : `${frac(1, n)} of ${total} = ${ans}.`],
      reteach: fractionOfAmount.make(2, R),
    };
  },
};

export const fractionOfLength = {
  about: 'A fraction of a length: a strip in centimetres',
  levels: 3,
  make(level, R) {
    let n, k, each;
    if (level <= 1) { n = 2; k = 1; each = pickEach(R, 2, 5, n, k); }
    else if (level === 2) { n = R.pick([2, 4]); k = 1; each = pickEach(R, 2, n === 4 ? 5 : 8, n, k); }
    else { [n, k] = R.pick([[4, 3], [3, 1], [3, 2], [4, 2]]); each = pickEach(R, 2, 5, n, k); }
    const len = n * each, ans = k * each, f = frac(k, n);
    const item = {
      lines: [`This strip is ${len} cm long.`, `How long is ${f} of it?`],
      caption: `${len} cm`,
      ...fr({ shape: 'bar', parts: n, shaded: k, labels: level <= 1 }),
      hint: [`Split ${len} cm into ${n} equal parts.`, n === 2 ? `Which number and the same again make ${len}?` : n === 4 ? 'Halve it, then halve it again.' : `Which number, 3 times, makes ${len}?`],
      hintProps: { labels: true },
      explain: [`${len} cm split into ${n} equal parts is ${each} cm each.`, k === 1 ? `${f} of ${len} cm is ${ans} cm.` : `${k} parts of ${each} cm is ${ans} cm. So ${f} of ${len} cm is ${ans} cm.`],
    };
    if (level <= 1) return { ...item, input: 'choice', answer: ans, options: opts(R, ans, [len, ans + 1, ans + 2, n]), unit: 'cm' };
    return { ...item, input: 'numpad', answer: ans, unit: 'cm', reteach: fractionOfLength.make(level - 1, R) };
  },
};

// ---------- equivalence ----------
export const equivalence = {
  about: '2/4 is the same as 1/2: see it, glue it, use it',
  levels: 3,
  make(level, R) {
    if (level <= 1) {
      const same = R.chance(0.6);
      const shape = R.pick(['square', 'circle', 'bar']);
      const idx = same ? (shape === 'square' ? [0, 2] : [0, 1]) : [0];
      const shown = same ? '2/4' : '1/4';
      return {
        lines: [`${shown} is coloured.`, 'Is that the same as 1/2?'],
        ...fr({ shape, parts: 4, shadedIdx: idx, labels: true }),
        input: 'choice', answer: same ? 'Yes' : 'No', options: ['Yes', 'No'],
        hint: ['Imagine a line down the middle.', 'Is one whole side coloured?'],
        explain: same ? ['2 quarters fill half the shape.', '2/4 is the same as 1/2.'] : ['1 quarter fills only half of a half.', '1/4 is not the same as 1/2.'],
      };
    }
    if (level === 2) {
      const shape = R.pick(['square', 'circle', 'bar', 'rect']);
      const idx = shape === 'square' || shape === 'rect' ? [0, 2] : shape === 'circle' ? R.pick([[0, 1], [1, 2]]) : [0, 1];
      return {
        lines: ['2/4 is coloured.', 'Glue the quarters into halves.'],
        widget: 'fractions', props: { shape, parts: 4, shadedIdx: idx, labels: true, tools: ['glue'] },
        input: 'widget', goal: { parts: 2, shaded: 1 },
        hint: ['Tap the Glue button.', 'Watch the 2 coloured quarters.'],
        explain: ['2 quarters glue into 1 half.', '2/4 is the same as 1/2.'],
        reteach: equivalence.make(1, R),
      };
    }
    if (R.chance(0.5)) {
      const ans = '2/4';
      return {
        lines: ['Which fraction is the same as 1/2?'],
        input: 'choice', answer: ans, options: R.shuffle([ans, '1/4', '3/4']),
        hint: ['How many quarters fill half a square?', 'Count the coloured quarters.'],
        hintWidget: fr({ shape: 'square', parts: 4, shadedIdx: [0, 2], labels: true }),
        explain: ['2 quarters make a half.', '2/4 is the same as 1/2.'],
        reteach: equivalence.make(1, R),
      };
    }
    const each = R.int(2, 6);
    const total = 4 * each;
    return {
      lines: ['2/4 is the same as 1/2.', 'Use that to find the answer.'],
      caption: `2/4 of ${total} = ?`,
      input: 'numpad', answer: 2 * each,
      hint: [`2/4 is the same as 1/2, so find 1/2 of ${total}.`, 'Deal them into 2 equal groups.'],
      hintWidget: { widget: 'groups', props: { total, mode: 'share', bowls: 2, icon: 'dot', interactive: true } },
      explain: [`${total} shared into 2 equal groups is ${2 * each} in each, so 1/2 of ${total} is ${2 * each}.`, `So 2/4 of ${total} is ${2 * each} too.`],
      reteach: equivalence.make(2, R),
    };
  },
};

// ---------- counting in fractions ----------
export const countInFractions = {
  about: 'Count in halves and quarters on a number line, past 1',
  levels: 3,
  make(level, R) {
    const d = level <= 1 ? 0.5 : level === 2 ? 0.25 : R.pick([0.5, 0.25]);
    const back = level >= 3 && R.chance(0.5);
    const len = 5;
    const maxStart = level <= 1 ? 2 : level === 2 ? 1.5 : 4;
    let seq, miss, ans;
    for (let t = 0; t < 30; t++) {
      const start = d * R.int(level <= 1 ? 1 : 0, Math.round(maxStart / d));
      seq = Array.from({ length: len }, (_, i) => start + i * d);
      if (back) seq = seq.reverse();
      miss = level <= 1 ? len - 1 : R.int(1, len - 1);
      ans = seq[miss];
      // Avoid a whole-number answer that also starts a shown mixed number (4 and 4½).
      if (!Number.isInteger(ans) || !seq.some((v, i) => i !== miss && Math.floor(v) === ans)) break;
    }
    const lo = Math.floor(Math.min(...seq)), hi = Math.ceil(Math.max(...seq) + 1e-9);
    const max = Math.max(hi, lo + 2);
    const labels = [];
    for (let v = lo; v <= max + 1e-9; v += d) labels.push({ at: +v.toFixed(2), text: fw(v) });
    const what = d === 0.5 ? 'halves' : 'quarters';
    const item = {
      lines: [back ? `Count back in ${what}.` : `Count in ${what}.`, miss === len - 1 ? 'What comes next?' : 'What is missing?'],
      caption: seq.map((v, i) => (i === miss ? '?' : fw(v))).join(', '),
      widget: 'numberline',
      props: { min: lo, max, step: d, minor: 0, labels: labels.filter(l => Math.abs(l.at - ans) > 1e-6), hide: [ans], readonly: true },
      hint: [d === 0.5 ? 'Each hop is 1/2. Two halves make 1 whole.' : 'Each hop is 1/4. Four quarters make 1 whole.', 'Where does the hop to the ? land?'],
      hintProps: { hops: seq.slice(1).map((v, i) => ({ from: seq[i], to: v })) },
      explain: [`${back ? 'Count back' : 'Count on'} 1/${d === 0.5 ? 2 : 4} each time.`, `${seq.map(fw).join(', ')}.`],
    };
    if (Number.isInteger(ans) && level >= 2) return { ...item, input: 'numpad', answer: ans, reteach: countInFractions.make(1, R) };
    const cands = [ans + d, ans + 1, ans - d, ans + 2 * d].filter(v => v >= 0).map(v => fw(v));
    return { ...item, input: 'choice', answer: fw(ans), options: opts(R, fw(ans), cands), reteach: level > 1 ? countInFractions.make(1, R) : undefined };
  },
};

export const halvesMakeWholes = {
  about: 'Fractions can add up to more than 1: how many halves or quarters make a number?',
  levels: 3,
  make(level, R) {
    const d = level <= 1 ? 2 : level === 2 ? R.pick([2, 4]) : 4;
    const w = level <= 1 ? R.int(1, 3) : R.int(2, 5);
    const what = d === 2 ? 'halves' : 'quarters';
    const ans = d * w;
    // Long lines label only the whole numbers, so the labels never crowd (the ticks still show every part).
    const labels = [];
    for (let v = 0; v <= w + 1e-9; v += 1 / d) if (w * d <= 10 || Number.isInteger(+v.toFixed(2))) labels.push({ at: +v.toFixed(2), text: fw(v) });
    return {
      lines: [`How many ${what} make ${w}?`],
      widget: 'numberline', props: { min: 0, max: w, step: 1 / d, minor: 0, labels, readonly: true },
      ...(level <= 1 ? { input: 'choice', options: opts(R, ans, [w, ans + 1, ans + d]) } : { input: 'numpad' }),
      answer: ans,
      hint: [`${d} ${what} make 1 whole.`, `Count the hops from 0 to ${w}.`],
      hintProps: { hops: Array.from({ length: ans }, (_, i) => ({ from: +(i / d).toFixed(2), to: +((i + 1) / d).toFixed(2), label: '' })) },
      explain: [`There are ${d} ${what} in each whole.`, `${w} wholes is ${w} lots of ${d}: ${ans} ${what}.`],
      reteach: level > 1 ? halvesMakeWholes.make(1, R) : undefined,
    };
  },
};
