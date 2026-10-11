// Number and place value generators (Year 1 and Year 2). See ENGINE.md section 4.
// Each export: { about, levels, make(level, R, params) } returning one practice item.
// Level 1 is gentle (pictures, choice, within 20); level 3 is Year-2-hard.
// Optional params (from mission JSON) are listed on each generator.
// Help: every item's hint points at the picture and, where it can, changes it (hintProps / hintWidget: digits under
// the blocks, running totals under groups, a "?" on the square to look at, a hop on the number line); every explain
// shows the method with the DfE sentence stems.
// Debug: dev/gen.html?gen=number&all=1  or  dev/gen.html?gen=number.readTensOnes&level=3

// ---------- helpers ----------
// Only boldly coloured, solid icons for counting (the pale moon, grey asteroid and thin comet are left out).
const ICONS = ['star', 'rocket', 'alien', 'astronaut', 'crystal', 'planet', 'satellite', 'fuel'];
const PLURAL = { star: 'stars', rocket: 'rockets', alien: 'aliens', astronaut: 'astronauts', moon: 'moons', crystal: 'crystals', planet: 'planets', satellite: 'satellites', fuel: 'fuel cans', asteroid: 'asteroids', comet: 'comets' };
const THINGS = ['moon rocks', 'fuel cans', 'crystals', 'stars', 'space bolts', 'star stickers'];

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function words(n) {
  n = Math.round(n);
  if (n === 100) return 'one hundred';
  if (n < 20) return ONES[n] ?? String(n);
  const t = Math.floor(n / 10), o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const tenOf = n => Math.floor(n / 10) * 10;
const swapDigits = n => (n % 10) * 10 + Math.floor(n / 10);
const tensList = t => Array.from({ length: t }, (_, i) => (i + 1) * 10);   // 3 -> [10, 20, 30]
const marksWord = k => `${k} mark${k === 1 ? '' : 's'}`;

// Choice options: the answer plus distinct, sensible distractors (numbers stay >= 0), shuffled.
function choices(R, answer, distractors, n = 3) {
  const out = [answer];
  const ok = d => d !== undefined && d !== null && d !== '' && !(typeof d === 'number' && (d < 0 || !Number.isFinite(d))) && !out.some(o => String(o) === String(d));
  for (const d of distractors) { if (out.length >= n) break; if (ok(d)) out.push(d); }
  for (let k = 1; out.length < n && typeof answer === 'number' && k < 60; k++) {
    for (const d of [answer + k, answer - k]) if (out.length < n && ok(d)) out.push(d);
  }
  return R.shuffle(out);
}

function iconOf(R, params) {
  const icon = R.pick(Array.isArray(params.icons) && params.icons.length ? params.icons : ICONS);
  return { icon, name: PLURAL[icon] || 'things' };
}

const lvl = (level, max = 3) => Math.max(1, Math.min(max, Math.round(Number(level) || 1)));

// DfE-style sentence for where a number sits near a ten (1NPV-2, 2NPV-2 language focus).
function nearTenLine(n) {
  const T = tenOf(n), o = n % 10;
  if (o === 0) return `${n} is a ten.`;
  if (o === 5) return `${n} is halfway between ${T} and ${T + 10}.`;
  if (o < 5) return `${n} is ${o} more than ${T}.`;
  return `${n} is ${10 - o} less than ${T + 10}.`;
}
// The nearest labelled five on a 0 to 20 line, and how far n is from it.
function nearFive(n) {
  const F = Math.round(n / 5) * 5, d = n - F;
  return { F, d, line: d === 0 ? `${n} has its own label.` : d > 0 ? `${n} is ${d} more than ${F}.` : `${n} is ${-d} less than ${F}.` };
}
// Labelled marks for a list of numbers on a line; close neighbours take turns above and below.
function labelledMarks(nums, close, colour = 'orange') {
  const sorted = [...nums].sort((a, b) => a - b);
  let lastAbove = -Infinity, lastBelow = -Infinity;
  return sorted.map(v => {
    const below = v - lastAbove < close && v - lastBelow >= v - lastAbove;
    if (below) lastBelow = v; else lastAbove = v;
    return { at: v, label: String(v), colour, below };
  });
}

// ---------- countObjects (Y1-NPV-2, 1NF-2) ----------
// params: icons, min, max (level 1 only)
export const countObjects = {
  about: 'Count a set of space things: tap to count in a row, rows of 5 or groups of 10, then rings of ten',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    const { icon, name } = iconOf(R, params);
    if (L === 1) {
      const n = R.int(Math.max(1, params.min ?? 3), Math.min(10, params.max ?? 10));
      const said = n <= 6 ? Array.from({ length: n }, (_, i) => i + 1).join(', ') : `1, 2, 3, 4 ... ${n}`;
      return {
        lines: [`How many ${name}?`, 'Tap each one as you count.'],
        widget: 'objects', props: { n, icon, arrange: 'row', tappable: true, interactive: true },
        input: 'choice', answer: n, options: choices(R, n, R.shuffle([n + 1, n - 1, n + 2])),
        hint: [`Tap the ${name} one at a time.`, 'Say one number for each tap.'],
        explain: [`Count them: ${said}.`, `The last number we say tells us how many: ${n}.`],
        reteach: n > 5 ? countObjects.make(1, R, { ...params, min: 2, max: 5 }) : undefined,
      };
    }
    if (L === 2) {
      const n = R.int(11, 20);
      const per = R.pick([5, 10]);
      const full = Math.floor(n / per), rest = n % per;
      const run = Array.from({ length: full }, (_, i) => (i + 1) * per);
      if (per === 10) {
        // Groups of ten in rings, like full tens frames; the hint writes the running total under each full ring.
        return {
          lines: [`How many ${name}?`, 'Each ring holds 10.'],
          widget: 'objects', props: { n, icon, arrange: 'groups', groups: rest ? [...Array(full).fill(10), rest] : Array(full).fill(10) },
          input: 'numpad', answer: n,
          hint: ['They are in groups of 10, so count in tens.', rest ? `Then count on the last ${rest}.` : 'Count the rings: 10, 20.'],
          hintProps: { groupLabels: [...run.map(String), ...(rest ? [''] : [])] },
          explain: rest ? [`1 full ring is 10.`, `10 and ${rest} more is ${n}.`] : ['2 rings of 10.', '10, 20. There are 20.'],
          reteach: countObjects.make(1, R, params),
        };
      }
      return {
        lines: [`How many ${name}?`, 'They are in rows of 5.'],
        widget: 'objects', props: { n, icon, arrange: 'rows', perRow: 5 },
        input: 'numpad', answer: n,
        hint: [`Count the full rows in 5s: ${run.join(', ')}.`, rest ? `Then count on the last ${rest}.` : 'The last number is how many.'],
        explain: rest
          ? [`${full} rows of 5: ${run.join(', ')}.`, `${full * 5} and ${rest} more is ${n}.`]
          : [`${full} rows of 5: ${run.join(', ')}.`, `There are ${n}.`],
        reteach: countObjects.make(1, R, params),
      };
    }
    const n = R.int(21, 49);
    const t = Math.floor(n / 10), o = n % 10;
    const groups = [...Array(t).fill(10), ...(o ? [o] : [])];
    return {
      lines: ['How many dots?', 'Each ring holds 10.'],
      widget: 'objects', props: { n, icon: 'dot', arrange: 'groups', groups },
      input: 'numpad', answer: n,
      hint: ['They are in groups of 10, so we count in tens.', o ? 'Then count on the ones.' : 'Count the rings in tens.'],
      hintProps: { groupLabels: [...tensList(t).map(String), ...(o ? [''] : [])] },
      explain: o ? [`${t} tens is ${t * 10}.`, `${t * 10} and ${o} more is ${n}.`] : [`${t} tens is ${n}.`, 'There are no extra ones.'],
      reteach: countObjects.make(2, R, params),
    };
  },
};

// ---------- countOn (Y1-NPV-1, 1NPV-1) ----------
// params: dir ('fwd' | 'back'), max
export const countOn = {
  about: 'Missing numbers in a counting sequence, forwards and backwards across tens',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    if (L === 1) {
      const s = R.int(1, 15);
      const seq = [s, s + 1, s + 2, s + 3, s + 4];
      const mi = R.int(2, 4);
      const m = seq[mi];
      const cap = seq.map((v, i) => (i === mi ? '?' : v)).join(', ');
      return {
        lines: ['Count on.', mi === 4 ? 'What number comes next?' : 'What number is missing?'],
        caption: cap,
        // A short stretch of the line (10 steps) so every number is big enough to read.
        widget: 'numberline', props: { min: Math.max(0, s - 2), max: Math.max(0, s - 2) + 10, labels: 'all', hide: [m], marks: seq.filter(v => v !== m) },
        input: 'choice', answer: m, options: choices(R, m, [m + 10 <= 30 ? m + 10 : m - 10, m + 2, m - 2]),
        hint: [`Say them: ${seq.slice(0, mi).join(', ')}...`, `The orange hop goes 1 on from ${m - 1}.`],
        hintProps: { hops: [{ from: m - 1, to: m, label: '+1', colour: 'orange' }] },
        explain: [`${seq.slice(0, mi + 1).join(', ')}.`, `${m} comes after ${m - 1}. It is 1 more.`],
      };
    }
    // Crossing a ten. L2: forwards or backwards within 100. L3: backwards, including the teens.
    const dir = params.dir || (L === 3 ? 'back' : R.pick(['fwd', 'back']));
    if (L === 3 && dir === 'back' && R.chance(0.3)) {
      // The teens trap: counting back inside the teens (the irregular names).
      const s = R.int(15, 19);
      const seq = [s, s - 1, s - 2, s - 3, s - 4];
      const mi = R.int(1, 4), m = seq[mi];
      return {
        lines: ['Count back.', 'What number is missing?'],
        caption: seq.map((v, i) => (i === mi ? '?' : v)).join(', '),
        input: 'numpad', answer: m,
        hint: ['Count back out loud, slowly.', `Find ${m + 1} on the line. Go back 1.`],
        hintWidget: { widget: 'numberline', props: { min: 10, max: 20, labels: 'all', hide: [m], marks: seq.filter(v => v !== m) } },
        explain: [`${seq.slice(0, mi + 1).join(', ')}.`, `${m} comes before ${m + 1}. It is 1 less.`],
        reteach: countOn.make(1, R, {}),
      };
    }
    let T;
    if (L === 3 && R.chance(0.45)) T = R.pick([10, 20]);
    else T = R.int(2, 9) * 10;
    let seq;
    if (dir === 'fwd') { const s = T - R.int(2, 3); seq = [s, s + 1, s + 2, s + 3, s + 4]; }
    else { const s = T + R.int(1, 2); seq = [s, s - 1, s - 2, s - 3, s - 4]; }
    // Hide a number at the crossing (the hard part).
    const near = seq.map((v, i) => ({ v, i })).filter(o => o.i >= 1 && Math.abs(o.v - T) <= 1);
    const pick = R.pick(near.length ? near : [{ v: seq[2], i: 2 }]);
    const m = pick.v, mi = pick.i;
    const cap = seq.map((v, i) => (i === mi ? '?' : v)).join(', ');
    const lo = Math.max(0, Math.min(...seq) - 3), hi = Math.min(100, Math.max(...seq) + 3);
    const onSquare = L === 2;
    return {
      lines: [dir === 'fwd' ? 'Count on.' : 'Count back.', 'What number is missing?'],
      caption: cap,
      input: 'numpad', answer: m,
      hint: dir === 'fwd'
        ? [onSquare ? 'The yellow squares are the count.' : 'Say the numbers out loud.', `What comes after ${m - 1}?`]
        : [onSquare ? 'The yellow squares are the count.' : 'Count back out loud.', `What comes before ${m + 1}?`],
      hintWidget: onSquare
        ? { widget: 'hundred', props: { hide: [m], highlight: seq.filter(v => v !== m && v >= 1) } }
        : { widget: 'numberline', props: { min: lo, max: hi, labels: 'all', hide: [m], marks: seq.filter(v => v !== m) } },
      explain: [`${seq.slice(0, mi + 1).join(', ')}.`, dir === 'fwd' ? `${m} comes after ${m - 1}.` : `${m} comes before ${m + 1}.`],
      reteach: L === 3 ? countOn.make(2, R, { dir: 'back' }) : countOn.make(1, R, {}),
    };
  },
};

// ---------- oneMoreLess (Y1-NPV-3) ----------
// params: kind ('more' | 'less'), by (1 | 10)
export const oneMoreLess = {
  about: '1 more and 1 less (to 20 with objects, to 100 on the 100 square), then 10 more and 10 less',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    const kind = params.kind || R.pick(['more', 'less']);
    const by = params.by || (L === 3 ? 10 : 1);
    if (L === 1 && by === 1) {
      const { icon, name } = iconOf(R, params);
      const n = kind === 'more' ? R.int(1, 15) : R.int(2, 16);
      const ans = kind === 'more' ? n + 1 : n - 1;
      const arrange = n <= 9 ? 'row' : 'rows';
      return {
        lines: [`Here are ${n} ${name}.`, `What is 1 ${kind} than ${n}?`],
        widget: 'objects', props: { n, icon, arrange, perRow: 5 },
        input: 'choice', answer: ans, options: choices(R, ans, [kind === 'more' ? n - 1 : n + 1, n]),
        // The picture acts it out: 1 more joins the end, or the last one is crossed out.
        hint: kind === 'more' ? ['Look: 1 more has joined them.', `Count on 1 from ${n}.`] : ['Look: 1 is crossed out.', `Count back 1 from ${n}.`],
        hintProps: kind === 'more' ? { n: n + 1 } : { crossed: 1 },
        explain: kind === 'more' ? [`${n} and 1 more is ${ans}.`, `1 more than ${n} is ${ans}.`] : [`${n} take away 1 is ${ans}.`, `1 less than ${n} is ${ans}.`],
      };
    }
    if (by === 1) {
      let n = R.chance(0.4) ? R.int(2, 9) * 10 + (kind === 'more' ? 9 : 0) : R.int(21, 98);
      if (kind === 'more') n = Math.min(n, 99); else n = Math.max(n, 2);
      const ans = kind === 'more' ? n + 1 : n - 1;
      return {
        lines: [`What is 1 ${kind} than ${n}?`, `${n} is yellow.`],
        widget: 'hundred', props: { highlight: [n] },
        input: 'numpad', answer: ans,
        hint: kind === 'more' ? ['1 more is the next square.', 'Look at the square with the ?.'] : ['1 less is the square before.', 'Look at the square with the ?.'],
        hintProps: { hide: [ans] },
        explain: [kind === 'more' ? `After ${n} comes ${ans}.` : `Before ${n} comes ${ans}.`, `1 ${kind} than ${n} is ${ans}.`],
        reteach: oneMoreLess.make(1, R, { kind }),
      };
    }
    let n = kind === 'more' ? R.int(3, 89) : R.int(13, 99);
    if (n === 20 && kind === 'less') n = 21;
    const ans = kind === 'more' ? n + 10 : n - 10;
    const t = Math.floor(n / 10);
    return {
      lines: [`What is 10 ${kind} than ${n}?`],
      caption: kind === 'more' ? `${n} + 10` : `${n} − 10`,
      input: 'numpad', answer: ans,
      hint: kind === 'more' ? ['10 more is one row down.', 'The ones digit stays the same.'] : ['10 less is one row up.', 'The ones digit stays the same.'],
      hintWidget: { widget: 'hundred', props: { highlight: [n], hide: [ans] } },
      explain: [`${t} ${t === 1 ? 'ten' : 'tens'} becomes ${kind === 'more' ? t + 1 : t - 1} tens.`, `10 ${kind} than ${n} is ${ans}.`],
      reteach: { lines: [`What is 10 ${kind} than ${kind === 'more' ? 40 : 60}?`], input: 'numpad', answer: 50, hint: [kind === 'more' ? 'Add 1 green rod.' : 'Take away 1 green rod.', 'Count the rods in tens.'], explain: [kind === 'more' ? '4 tens and 1 more ten is 5 tens.' : '6 tens take away 1 ten is 5 tens.', '5 tens is 50.'], widget: 'placevalue', props: { tens: kind === 'more' ? 4 : 6, ones: 0, readonly: true } },
    };
  },
};

// ---------- numberWords (Y1-NPV-5, Y2-NPV-5) ----------
// params: dir ('toWords' | 'toDigits'), min (level 1: smallest number, default 1; 11 practises the teens)
export const numberWords = {
  about: 'Numbers in digits and words: to 20, to 100 with hyphens, then the tricky teens and tens',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    const dir = params.dir || R.pick(['toWords', 'toDigits']);
    if (L === 1) {
      const n = R.int(Math.max(1, Math.min(19, Number(params.min) || 1)), 20);
      const confus = n > 12 && n < 20 ? [(n - 10) * 10, n - 10, n + 1] : n <= 10 ? [n + 10, n + 1, n - 1] : [n * 1 === 20 ? 12 : 20, n - 10, n + 1];
      const opts = dir === 'toWords'
        ? choices(R, words(n), confus.filter(v => v >= 0 && v <= 100 && v !== n).map(words))
        : choices(R, n, confus);
      const teen = n > 10 && n < 20;
      // The hint colours the counters: 10 red and the rest yellow ("teen means ten and some more").
      return {
        lines: [dir === 'toWords' ? 'Which word says this number?' : 'Which number is this word?'],
        caption: dir === 'toWords' ? String(n) : words(n),
        widget: 'tensframe', props: { count: n, frames: n > 10 ? 2 : 1, interactive: false, readonly: true },
        input: 'choice', answer: dir === 'toWords' ? words(n) : n, options: opts,
        hint: teen ? ['Teen means ten and some more.', `Look: 10 red and ${n - 10} yellow.`]
          : n === 20 ? ['Look: 2 full frames.', 'Count in tens: 10, 20.']
          : n === 10 ? ['Look: 1 full frame.', 'A full frame is 10.'] : ['Count the red counters.', 'Say the number out loud.'],
        hintProps: teen ? { colours: [10, n - 10] } : n === 20 ? { colours: [10, 10] } : undefined,
        explain: teen ? [`1 full frame and ${n - 10} more is ${n}.`, `${cap(words(n))} is ${n}.`]
          : n === 20 ? ['2 full frames is 20.', 'We say twenty.'] : [`There are ${n} counters.`, `${n} is ${words(n)}.`],
      };
    }
    if (L === 2) {
      const t = R.int(2, 9), o = R.int(1, 9);
      const n = t * 10 + o;
      const sw = swapDigits(n);
      const ds = [sw !== n ? sw : n + 10, t * 10, n + 10 <= 99 ? n + 10 : n - 10];
      return {
        lines: [dir === 'toWords' ? 'Which words say this number?' : 'Which number do these words say?'],
        caption: dir === 'toWords' ? String(n) : words(n),
        input: 'choice', answer: dir === 'toWords' ? words(n) : n,
        options: dir === 'toWords' ? choices(R, words(n), ds.filter(v => v <= 100).map(words)) : choices(R, n, ds),
        hint: dir === 'toWords' ? [`The ${t} means ${t} tens: ${words(t * 10)}.`, `The ${o} means ${o} ones: ${words(o)}.`] : [`${cap(words(t * 10))} is ${t} tens.`, `${cap(words(o))} is ${o} ones.`],
        hintWidget: { widget: 'placevalue', props: { tens: t, ones: o, readonly: true } },
        explain: [`${cap(words(t * 10))} is ${t * 10}. ${cap(words(o))} is ${o}.`, `${cap(words(t * 10))} and ${words(o)} make ${n}: ${words(n)}.`],
        reteach: numberWords.make(1, R, { dir }),
      };
    }
    // Level 3: the tricky pairs, or words to digits on the numpad.
    if (R.chance(0.5)) {
      const d = R.int(3, 9);
      const teen = 10 + d, ten = d * 10;
      const askTeen = R.chance(0.5);
      const target = askTeen ? teen : ten;
      const blocks = { widget: 'placevalue', props: { tens: askTeen ? 1 : d, ones: askTeen ? d : 0, readonly: true } };
      if (R.chance(0.5)) {
        return {
          lines: [`Which number is ${words(target)}?`],
          caption: words(target),
          input: 'choice', answer: target, options: choices(R, target, [askTeen ? ten : teen, d]),
          hint: askTeen ? ['Teen means 1 ten and some more.', 'Here are the blocks for it.'] : ['"Ty" means tens.', `${cap(words(ten))} is ${d} green rods.`],
          hintWidget: blocks,
          explain: [`${cap(words(teen))} is ${teen}: 1 ten and ${d} ones.`, `${cap(words(ten))} is ${ten}: ${d} tens.`],
        };
      }
      return {
        lines: ['Which word says this number?'],
        caption: String(target),
        input: 'choice', answer: words(target), options: choices(R, words(target), [words(askTeen ? ten : teen), words(d)]),
        hint: askTeen ? ['This number is 1 ten and some ones.', 'Teen words are for 1 ten and some more.'] : ['This number is only tens.', '"Ty" words are for tens.'],
        hintWidget: blocks,
        explain: [`${teen} is ${words(teen)}: 1 ten and ${d} ones.`, `${ten} is ${words(ten)}: ${d} tens.`],
      };
    }
    const n = R.chance(0.2) ? R.pick([13, 14, 15, 16, 17, 18, 19, 30, 40, 50, 60, 70, 80, 90]) : R.int(2, 9) * 10 + R.int(1, 9);
    const t = Math.floor(n / 10), o = n % 10;
    return {
      lines: ['Type this number in digits.'],
      caption: words(n),
      input: 'numpad', answer: n,
      hint: n < 20 ? ['Teen means 1 ten and some ones.', 'So it starts with a 1.'] : [`${cap(words(t * 10))} is ${t} tens.`, o ? `${cap(words(o))} is the ones.` : 'There are no extra ones.'],
      hintWidget: { widget: 'placevalue', props: { tens: t, ones: o, readonly: true } },
      explain: [`${cap(words(n))} is ${t} ${t === 1 ? 'ten' : 'tens'} and ${o} ones.`, `We write it ${n}.`],
      reteach: numberWords.make(2, R, { dir: 'toDigits' }),
    };
  },
};

// ---------- skipCount (Y1-NPV-2, 1NF-2, Y2-NPV-1) ----------
// params: steps (e.g. [2, 5, 10]), dir ('fwd' | 'back'), odd (true = count in 2s from an odd number)
export const skipCount = {
  about: 'Count in 2s, 5s and 10s (then 3s, odd numbers and 10s from any number), forwards and back',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    const steps = Array.isArray(params.steps) && params.steps.length ? params.steps : L === 3 ? [3, 10] : [2, 5, 10];
    const step = R.pick(steps);
    const word = `${step}s`;
    if (L === 1) {
      const seq = [0, step, 2 * step, 3 * step, 4 * step];
      const askNext = R.chance(0.4);
      const full = askNext ? [...seq, 5 * step] : seq;
      const mi = askNext ? 5 : R.int(2, 4);
      const m = full[mi];
      const max = step === 2 ? 20 : step === 3 ? 30 : step === 5 ? 50 : 100;
      const hops = [];
      for (let i = 0; i < mi; i++) hops.push({ from: full[i], to: full[i + 1] });
      return {
        lines: [`Count in ${word}.`, mi === full.length - 1 ? 'What number comes next?' : 'What number is missing?'],
        caption: full.map((v, i) => (i === mi ? '?' : v)).join(', '),
        widget: 'numberline', props: { min: 0, max, step, minor: step === 10 ? 5 : 1, labels: 'all', hide: [m], hops },
        input: 'choice', answer: m, options: choices(R, m, [m + 1, m - 1, m + step]),
        // The hint turns the last hop orange: it lands on the "?".
        hint: [`The orange hop lands on the ?.`, `It is ${step} more than ${full[mi - 1]}.`],
        hintProps: { hops: hops.map((h, i) => (i === hops.length - 1 ? { ...h, colour: 'orange' } : h)) },
        explain: [full.slice(0, mi + 1).join(', ') + '.', `${full[mi - 1]} and ${step} more is ${m}.`],
      };
    }
    let start, dir = params.dir || R.pick(['fwd', 'back']);
    if (L === 2) {
      const odd = params.odd || (step === 2 && R.chance(0.3));
      const k = R.int(1, Math.floor(90 / step) - 4);
      start = odd ? 2 * R.int(0, 20) + 1 : k * step;
      if (dir === 'back') start += 4 * step;
      if (start + 4 * step > 100) start = 100 - 4 * step - (odd ? 1 : 0);
    } else if (step === 3) {
      start = dir === 'back' ? 3 * R.int(4, 10) : 3 * R.int(0, 4);
    } else {
      // 10s from any number: 7, 17, 27...
      const o = R.int(1, 9);
      start = dir === 'back' ? R.int(4, 9) * 10 + o : R.int(0, 5) * 10 + o;
    }
    const sgn = dir === 'back' ? -1 : 1;
    const seq = [0, 1, 2, 3, 4].map(i => start + sgn * i * step);
    let mi = R.int(1, 4);
    if (seq[mi] === step) mi = mi === 4 ? 3 : mi + 1; // never hide a number the lines already say
    const m = seq[mi];
    const isOdd = step === 2 && start % 2 === 1;
    const prev = seq[mi - 1];
    let hintWidget;
    if (step === 3) hintWidget = { widget: 'numberline', props: { min: 0, max: 30, step: 3, minor: 1, labels: 'all', hide: [m], marks: seq.filter(v => v !== m) } };
    else hintWidget = { widget: 'hundred', props: { pattern: { every: step, from: ((start % step) + step) % step || step }, hide: [m] } };
    const where = step === 3 ? 'line' : 'square';
    return {
      lines: [isOdd ? `Count ${dir === 'back' ? 'back' : 'on'} in 2s through the odd numbers.` : `Count ${dir === 'back' ? 'back' : 'on'} in ${word}.`, 'What number is missing?'],
      caption: seq.map((v, i) => (i === mi ? '?' : v)).join(', '),
      input: 'numpad', answer: m,
      hint: step === 10
        ? ['Only the tens digit changes.', `The green column all ends in ${start % 10}. Find the ?.`]
        : [where === 'line' ? 'The line counts in 3s. Find the ?.' : `The green squares are the ${word}. Find the ?.`, dir === 'back' ? `What is ${step} less than ${prev}?` : `What is ${step} more than ${prev}?`],
      hintWidget,
      explain: [seq.slice(0, mi + 1).join(', ') + '.', dir === 'back' ? `${prev} take away ${step} is ${m}.` : `${prev} and ${step} more is ${m}.`],
      reteach: skipCount.make(1, R, { steps: step === 3 ? [2] : [step] }),
    };
  },
};

// ---------- readTensOnes (Y2-NPV-2, 2NPV-1) ----------
// params: look ('blocks' | 'counters')
export const readTensOnes = {
  about: 'Read a two-digit number shown as tens and ones (blocks or counters, then non-standard)',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    const countTens = (t, look) => (look === 'counters'
      ? (t >= 2 ? `Count the green 10s: ${tensList(Math.min(t, 3)).join(', ')}...` : 'The green counter is 10.')
      : (t >= 2 ? `Count the green rods in tens: ${tensList(Math.min(t, 3)).join(', ')}...` : 'The green rod is 10.'));
    if (L === 1) {
      const t = R.int(1, 4);
      let o = R.int(1, 9);
      if (o === t) o = o === 9 ? 8 : o + 1;
      const n = t * 10 + o;
      return {
        lines: ['What number do the blocks show?', 'Count the tens, then the ones.'],
        widget: 'placevalue', props: { tens: t, ones: o, readonly: true },
        input: 'choice', answer: n, options: choices(R, n, [swapDigits(n), n + 10, n - 1]),
        hint: [countTens(t, 'blocks'), 'Then count on the blue cubes.'],
        hintProps: { showDigits: true },
        explain: [`The ${t} shows we have ${t} ${t === 1 ? 'group' : 'groups'} of ten: ${t * 10}.`, `${t * 10} and ${o} more is ${n}.`],
        reteach: { lines: ['What number do the blocks show?'], widget: 'placevalue', props: { tens: 1, ones: o, readonly: true }, input: 'choice', answer: 10 + o, options: choices(R, 10 + o, [o * 10 + 1, o]), hint: ['1 green rod is 10.', 'Count on the blue cubes.'], hintProps: { showDigits: true }, explain: [`10 and ${o} more is ${10 + o}.`] },
      };
    }
    if (L === 2) {
      const t = R.int(1, 9), o = R.int(0, 9);
      const n = t * 10 + o;
      const look = params.look || (R.chance(0.3) ? 'counters' : 'blocks');
      return {
        lines: [look === 'counters' ? 'What number do the counters show?' : 'What number do the blocks show?'],
        widget: 'placevalue', props: { tens: t, ones: o, look, readonly: true },
        input: 'numpad', answer: n,
        hint: [countTens(t, look), o ? `Then count on the blue ${look === 'counters' ? '1s' : 'cubes'}.` : 'There are no blue ones.'],
        hintProps: { showDigits: true },
        explain: o ? [`${t} tens is ${t * 10}.`, `${t * 10} and ${o} more is ${n}.`] : [`${t} tens is ${n}.`, 'There are no extra ones.'],
        reteach: readTensOnes.make(1, R, params),
      };
    }
    // Level 3: more than 9 ones.
    const t = R.int(1, 6), o = R.int(10, 18);
    const n = t * 10 + o;
    const look = params.look || R.pick(['blocks', 'counters']);
    return {
      lines: ['What number is this?', 'Look carefully at the ones.'],
      widget: 'placevalue', props: { tens: t, ones: o, look, readonly: true },
      input: 'numpad', answer: n,
      hint: ['10 blue ones make 1 ten.', 'Add the tens and the ones together.'],
      hintProps: { showExpanded: true },
      explain: [`${o} ones is 1 ten and ${o - 10} ones.`, `So it is ${t + 1} tens and ${o - 10} ones.`, `${t * 10} + ${o} = ${n}`],
      reteach: readTensOnes.make(2, R, { look: 'blocks' }),
    };
  },
};

// ---------- buildNumber (Y2-NPV-2, 2NPV-1): widget input ----------
export const buildNumber = {
  about: 'Build a number with tens and ones; at level 3 make it a different way (more than 9 ones)',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    if (L <= 2) {
      const t = L === 1 ? R.int(1, 3) : R.int(2, 9);
      const o = R.int(0, 9);
      const n = t * 10 + o;
      let start = L === 1 || R.chance(0.5) ? { tens: 0, ones: 0 } : { tens: R.int(1, 4), ones: R.int(0, 6) };
      if (start.tens * 10 + start.ones === n) start = { tens: 0, ones: 0 };
      return {
        lines: [`Make ${n} with tens and ones.`, L === 1 ? 'Use the + buttons.' : 'Use + and − to change them.'],
        caption: String(n),
        widget: 'placevalue', props: { ...start, showDigits: L === 1, interactive: true },
        input: 'widget', goal: { value: n, tens: t, ones: o },
        hint: [`The ${t} in ${n} means ${t} green ${t === 1 ? 'rod' : 'rods'}.`, o ? `The ${o} means ${o} blue ${o === 1 ? 'cube' : 'cubes'}.` : 'The 0 means no blue cubes.'],
        hintProps: { showDigits: true },
        explain: [`The ${t} shows ${t} ${t === 1 ? 'group' : 'groups'} of ten.`, `The ${o} shows ${o} extra ones.`, `${n} is ${t} tens and ${o} ones.`],
        reteach: L === 2 ? buildNumber.make(1, R, params) : undefined,
      };
    }
    const t = R.int(2, 8), o = R.int(0, 8);
    const n = t * 10 + o;
    return {
      lines: [`This is ${n}.`, `Make ${n} a different way.`, 'Use more than 9 ones.'],
      caption: String(n),
      widget: 'placevalue', props: { tens: t, ones: o, showExpanded: true, interactive: true, swapUp: false },
      input: 'widget', goal: { value: n, ones: { gte: 10 } },
      hint: ['Tap a green rod.', 'Then tap the blue swap button.'],
      explain: ['Swap 1 ten for 10 ones.', `${t - 1} tens and ${o + 10} ones is ${n} too.`, `${(t - 1) * 10} + ${o + 10} = ${n}`],
    };
  },
};

// ---------- digitValue (Y2-NPV-2, 2NPV-1) ----------
export const digitValue = {
  about: 'What is each digit worth? Tens place and ones place',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    const t = R.int(1, 9);
    let o = R.int(1, 9);
    if (o === t) o = t === 9 ? 1 : t + 1;
    const n = t * 10 + o;
    if (L === 3) {
      const kind = R.pick(['which', 'tensOnes', 'compare']);
      if (kind === 'which') {
        const d = R.int(2, 9);
        let other = R.int(1, 9);
        if (other === d) other = d === 9 ? 1 : d + 1;
        const ans = d * 10 + other;
        return {
          lines: [`In which number is the ${d} worth ${d * 10}?`],
          input: 'choice', answer: ans, options: choices(R, ans, [other * 10 + d, d]),
          hint: [`${d * 10} is ${d} tens. Look at the rods.`, `So the ${d} must be in the tens place.`],
          hintWidget: { widget: 'placevalue', props: { tens: d, ones: 0, showValue: true, readonly: true } },
          explain: [`In ${ans} the ${d} is in the tens place.`, `It shows ${d} groups of ten: ${d * 10}.`],
        };
      }
      if (kind === 'tensOnes') {
        return {
          lines: [`What number has ${t} tens and ${o} ones?`],
          input: 'numpad', answer: n,
          hint: [`${t} tens is ${t * 10}.`, `Then count on ${o} ones.`],
          hintWidget: { widget: 'placevalue', props: { tens: t, ones: o, readonly: true } },
          explain: [`${t} tens is ${t * 10}.`, `${t * 10} and ${o} is ${n}.`],
          reteach: digitValue.make(1, R, params),
        };
      }
      const a = R.int(3, 7), b = a * 10 + R.pick([-5, -3, 3, 5, 8]);
      const big = a * 10 > b ? `${a} tens` : `${b} ones`;
      return {
        lines: ['Which is more?'],
        input: 'choice', answer: big, options: R.shuffle([`${a} tens`, `${b} ones`]),
        hint: [`${a} tens is ${a * 10}.`, `Is ${b} more or less than ${a * 10}?`],
        hintWidget: { widget: 'placevalue', props: { tens: a, ones: b, showDigits: true, readonly: true } },
        explain: [`${a} tens is ${a * 10}. ${b} ones is ${b}.`, `${Math.max(a * 10, b)} > ${Math.min(a * 10, b)}, so ${big} is more.`],
      };
    }
    const askTens = R.chance(0.55);
    const d = askTens ? t : o;
    const ans = askTens ? t * 10 : o;
    if (L === 2 && R.chance(0.4)) {
      return {
        lines: [`Look at ${n}.`, `Which digit is in the ${askTens ? 'tens' : 'ones'} place?`],
        caption: String(n),
        input: 'choice', answer: d, options: choices(R, d, [askTens ? o : t, askTens ? t * 10 : o * 10]),
        hint: ['The tens digit is on the left.', 'The ones digit is on the right.'],
        hintWidget: { widget: 'placevalue', props: { tens: t, ones: o, showDigits: true, readonly: true } },
        explain: [`In ${n} the ${t} is in the tens place.`, `The ${o} is in the ones place.`],
      };
    }
    return {
      lines: [`Look at ${n}.`, `What is the ${d} worth?`],
      caption: String(n),
      widget: L === 1 ? 'placevalue' : undefined,
      props: L === 1 ? { tens: t, ones: o, showDigits: true, readonly: true } : undefined,
      input: 'choice', answer: ans, options: choices(R, ans, askTens ? [t, n] : [o * 10, n]),
      hint: askTens
        ? [`The ${t} is in the tens place.`, L === 1 ? 'Count the green rods in tens.' : `How many is ${t} tens?`]
        : [`The ${o} is in the ones place.`, L === 1 ? 'Count the blue cubes.' : 'Ones are worth just 1 each.'],
      hintWidget: L === 2 ? { widget: 'placevalue', props: { tens: t, ones: o, showDigits: true, readonly: true } } : undefined,
      explain: askTens ? [`The ${t} shows we have ${t} ${t === 1 ? 'group' : 'groups'} of ten.`, `It is worth ${t * 10}.`] : [`The ${o} shows we have ${o} extra ones.`, `It is worth ${o}.`],
    };
  },
};

// ---------- partition (Y2-NPV-6, 2NPV-1) ----------
export const partition = {
  about: 'Partition into tens and ones (47 = 40 + 7), then non-standard (47 = 30 + 17)',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    if (L === 1) {
      const t = R.int(2, 4), o = R.int(1, 9);
      const n = t * 10 + o;
      return {
        lines: ['Split the number into tens and ones.'],
        caption: `${n} = ${t * 10} + ?`,
        widget: 'placevalue', props: { tens: t, ones: o, readonly: true },
        input: 'choice', answer: o, options: choices(R, o, [t, o + 10]),
        hint: [`The green rods make the ${t * 10}.`, 'How many blue cubes are left?'],
        hintProps: { showDigits: true },
        explain: [`${n} is ${t} tens and ${o} ones.`, `${n} = ${t * 10} + ${o}`],
      };
    }
    const t = R.int(L === 3 ? 3 : 2, 9), o = R.int(1, 9);
    const n = t * 10 + o;
    if (L === 2) {
      const kind = R.int(0, 2);
      const caption = kind === 0 ? `${n} = ${t * 10} + ?` : kind === 1 ? `${n} = ? + ${o}` : `${t * 10} + ${o} = ?`;
      const ans = kind === 0 ? o : kind === 1 ? t * 10 : n;
      return {
        lines: [kind === 2 ? 'Put the tens and ones together.' : 'What is the missing part?'],
        caption,
        input: 'numpad', answer: ans,
        hint: kind === 1 ? [`How many tens are in ${n}?`, 'Count the green rods in tens.'] : kind === 0 ? [`How many ones are in ${n}?`, 'Count the blue cubes.'] : [`${t} tens and ${o} ones.`, 'Count the rods in tens, then the cubes.'],
        hintWidget: { widget: 'placevalue', props: { tens: t, ones: o, readonly: true } },
        explain: [`${n} is ${t} tens and ${o} ones.`, `${n} = ${t * 10} + ${o}`],
        reteach: partition.make(1, R, params),
      };
    }
    // Level 3: non-standard. Take 1 or 2 tens off the tens part.
    const k = t >= 4 && R.chance(0.4) ? 2 : 1;
    const a = (t - k) * 10, b = o + k * 10;
    const missingFirst = R.chance(0.3);
    return {
      lines: ['Split it a different way.', 'What is the missing part?'],
      caption: missingFirst ? `${n} = ? + ${b}` : `${n} = ${a} + ?`,
      input: 'numpad', answer: missingFirst ? a : b,
      hint: [`${k === 1 ? '1 ten has' : '2 tens have'} been swapped for ones.`, missingFirst ? 'Count the green rods in tens.' : 'Count the blue cubes.'],
      hintWidget: { widget: 'placevalue', props: { tens: t - k, ones: o + k * 10, readonly: true } },
      explain: [`${n} = ${t * 10} + ${o}`, `Swap ${k === 1 ? '1 ten' : '2 tens'} for ones: ${n} = ${a} + ${b}.`],
      reteach: partition.make(2, R, params),
    };
  },
};

// ---------- numberLinePlace (Y1-NPV-4, 1NPV-2, Y2-NPV-3, 2NPV-2): widget input ----------
export const numberLinePlace = {
  about: 'Land the rocket on a number line: 0 to 20 in fives, 0 to 100 in tens, then only 0, 50, 100',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    if (L === 1) {
      let n = R.int(1, 19);
      if (n % 5 === 0) n += R.pick([1, -1]);
      const { F, d, line } = nearFive(n);
      // Only the fives are labelled; the hint labels every number.
      return {
        lines: [`Land the rocket on ${n}.`, 'Drag it, or tap the line.'],
        caption: String(n),
        widget: 'numberline', props: { min: 0, max: 20, mode: 'place', labels: 'fives', step: 5, minor: 1 },
        input: 'widget', goal: { value: n },
        hint: [`Find ${F} first.`, d > 0 ? `Then count on ${marksWord(d)}.` : `Then count back ${marksWord(-d)}.`],
        hintProps: { labels: 'all' },
        explain: [line, `So ${n} is here.`],
        reteach: undefined,
      };
    }
    if (L === 2) {
      let n = R.int(3, 97);
      if (n % 10 === 0) n += R.pick([1, 3, -2]);
      const T = tenOf(n);
      return {
        lines: [`Land the rocket on ${n}.`, 'Use the tens to help.'],
        caption: String(n),
        widget: 'numberline', props: { min: 0, max: 100, mode: 'place', labels: 'tens', minor: 5 },
        input: 'widget', goal: { value: { gte: n - 1, lte: n + 1 } },
        hint: [`${n} is between ${T} and ${T + 10}. Look for the green dots.`, nearTenLine(n)],
        hintProps: { marks: [{ at: T, colour: 'green' }, { at: T + 10, colour: 'green' }] },
        explain: [`${n} is between ${T} and ${T + 10}.`, nearTenLine(n)],
        reteach: numberLinePlace.make(1, R, params),
      };
    }
    let n = R.int(8, 92);
    if (Math.abs(n - 50) < 4) n += 9;
    return {
      lines: [`Where does ${n} go?`, 'Land the rocket roughly there.'],
      caption: String(n),
      widget: 'numberline', props: { min: 0, max: 100, mode: 'place', labels: [0, 50, 100], step: 50, minor: 0 },
      input: 'widget', goal: { value: { gte: n - 4, lte: n + 4 } },
      hint: ['50 is halfway. Now 25 and 75 are there too.', n > 50 ? `${n} is more than 50.` : `${n} is less than 50.`],
      hintProps: { labels: [0, 25, 50, 75, 100], step: 25 },
      explain: [n > 50 ? `${n} is more than half way.` : `${n} is less than half way.`, nearTenLine(n)],
      reteach: numberLinePlace.make(2, R, params),
    };
  },
};

// ---------- numberLineRead (1NPV-2, 2NPV-2) ----------
export const numberLineRead = {
  about: 'Which number is marked on the line? (0 to 20 in fives, a zoomed ten, 0 to 100 in tens)',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    if (L === 1) {
      let n = R.int(1, 19);
      if (n % 5 === 0) n += R.pick([1, 2, -1]);
      const { F, d, line } = nearFive(n);
      return {
        lines: ['What number is the dot on?'],
        widget: 'numberline', props: { min: 0, max: 20, labels: 'fives', minor: 1, marks: [{ at: n, label: '?', colour: 'orange' }] },
        input: 'numpad', answer: n,
        hint: [`Start at ${F}.`, `Follow the orange hop: count ${d > 0 ? 'on' : 'back'} the little marks.`],
        hintProps: { hops: [{ from: F, to: n, label: '', colour: 'orange' }] },
        explain: [line, `So the dot is on ${n}.`],
      };
    }
    if (L === 2) {
      const T = R.int(1, 8) * 10;
      let o = R.int(1, 9);
      if (o === 5) o = R.pick([4, 6]);
      const n = T + o;
      const from = o < 3 ? T : o > 7 ? T + 10 : T + 5;
      return {
        lines: ['What number is the dot on?', `The middle is ${T + 5}.`],
        widget: 'numberline', props: { min: T, max: T + 10, labels: [T, T + 5, T + 10], minor: 1, marks: [{ at: n, label: '?', colour: 'orange' }] },
        input: 'numpad', answer: n,
        hint: [`Start at ${from}.`, `Follow the orange hop: count ${n > from ? 'on' : 'back'} the marks.`],
        hintProps: { hops: [{ from, to: n, label: '', colour: 'orange' }] },
        explain: [o === 4 || o === 6 ? `It is 1 ${o === 6 ? 'more' : 'less'} than the midpoint, ${T + 5}.` : nearTenLine(n), `So the dot is on ${n}.`],
        reteach: numberLineRead.make(1, R, params),
      };
    }
    const n = R.pick([10, 15, 20, 25, 30, 35, 40, 45, 55, 60, 65, 70, 75, 80, 85, 90]);
    return {
      lines: ['What number is the dot on?', 'The long marks are tens.'],
      widget: 'numberline', props: { min: 0, max: 100, labels: [0, 50, 100], step: 10, minor: 5, marks: [{ at: n, label: '?', colour: 'orange' }] },
      input: 'numpad', answer: n,
      hint: ['Now every ten has its label.', 'A short mark is halfway: a 5.'],
      hintProps: { labels: 'tens' },
      explain: [n % 10 === 5 ? `It is halfway between ${n - 5} and ${n + 5}.` : `It is on a long mark: ${n / 10} tens.`, `The dot is on ${n}.`],
      reteach: numberLineRead.make(2, R, params),
    };
  },
};

// ---------- betweenTens (2NPV-2) ----------
export const betweenTens = {
  about: 'The previous and next multiple of 10; which ten is nearer',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    let n = R.int(11, 89);
    if (n % 10 === 0) n += R.int(1, 9);
    const T = tenOf(n);
    if (L === 1) {
      const pair = (a, b) => `${a} and ${b}`;
      return {
        lines: [`${n} is between two tens.`, 'Which two?'],
        widget: 'numberline', props: { min: T - 10, max: T + 20, step: 10, minor: 1, labels: 'none', marks: [{ at: n, label: String(n), colour: 'orange' }] },
        input: 'choice', answer: pair(T, T + 10),
        options: R.shuffle([pair(T, T + 10), pair(T - 10, T), pair(T + 10, T + 20)]),
        hint: [`${n} has ${T / 10} tens.`, 'Now the tens have labels. Look either side.'],
        hintProps: { labels: 'tens' },
        explain: [`${n} is after ${T} and before ${T + 10}.`, `So ${n} is between ${T} and ${T + 10}.`],
      };
    }
    if (L === 2) {
      const next = R.chance(0.5);
      const ans = next ? T + 10 : T;
      return {
        lines: [next ? `What is the next ten after ${n}?` : `What ten comes just before ${n}?`],
        input: 'numpad', answer: ans,
        hint: [next ? `Count on from ${n} to the ?.` : `Count back from ${n} to the ?.`, 'Stop when you reach a ten.'],
        hintWidget: { widget: 'numberline', props: { min: T, max: T + 10, labels: 'ends', minor: 1, hide: [ans], marks: [{ at: n, label: String(n), colour: 'orange' }] } },
        explain: [`${n} is between ${T} and ${T + 10}.`, next ? `The next ten is ${T + 10}.` : `The ten before is ${T}.`],
        reteach: betweenTens.make(1, R, params),
      };
    }
    let o = n % 10;
    if (o === 5) { n += R.pick([-2, 2]); o = n % 10; }
    const nearer = o < 5 ? T : T + 10;
    return {
      lines: [`Is ${n} nearer to ${T} or ${T + 10}?`],
      input: 'choice', answer: nearer, options: [T, T + 10],
      hint: [`Halfway is ${T + 5}.`, `Is ${n} before or after ${T + 5}?`],
      hintWidget: { widget: 'numberline', props: { min: T, max: T + 10, labels: [T, T + 5, T + 10], minor: 1, marks: [{ at: n, label: String(n), colour: 'orange' }] } },
      explain: [o < 5 ? `${n} is ${o} more than ${T}.` : `${n} is ${10 - o} less than ${T + 10}.`, `So it is nearer to ${nearer}.`],
      reteach: betweenTens.make(2, R, params),
    };
  },
};

// ---------- estimateLine (1NPV-2, Y2-NPV-3) ----------
export const estimateLine = {
  about: 'Estimate: which dot is about this number? About how many?',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    if (L === 3 && R.chance(0.35)) {
      const { icon, name } = iconOf(R, params);
      const band = R.pick([[8, 13, 'About 10'], [27, 33, 'About 30'], [47, 53, 'About 50']]);
      const n = R.int(band[0], band[1]);
      const nm = n > 30 ? 'dots' : name;
      return {
        lines: [`About how many ${nm}?`, "Don't count them all. Estimate!"],
        widget: 'objects', props: { n, icon: n > 30 ? 'dot' : icon, arrange: 'scatter' },
        input: 'choice', answer: band[2], options: ['About 10', 'About 30', 'About 50'],
        hint: ['Find a clump of about 10.', 'How many clumps like that are there?'],
        explain: [`There are ${n}.`, `That is ${band[2].toLowerCase()}.`],
      };
    }
    const max = L === 1 ? 20 : 100;
    const gap = L === 1 ? 5 : L === 2 ? 22 : 13;
    const lo = L === 1 ? 2 : 6, hi = max - lo;
    // Three dots far enough apart; one is the target.
    let pts = [];
    for (let tries = 0; pts.length < 3 && tries < 200; tries++) {
      const v = R.int(lo, hi);
      if (pts.every(q => Math.abs(q - v) >= gap) && (L > 1 || v !== 10)) pts.push(v);
    }
    while (pts.length < 3) pts.push(pts.length === 0 ? lo : pts.length === 1 ? Math.round(max / 2) + 1 : hi);
    pts.sort((a, b) => a - b);
    const ti = R.int(0, 2);
    const target = L === 1 ? pts[ti] : Math.round(pts[ti] / 5) * 5;
    const letters = ['A', 'B', 'C'];
    const labels = L === 1 ? [0, 10, 20] : L === 2 ? [0, 50, 100] : [0, 100];
    const half = max / 2;
    // The hint adds more labels to the line (fives, quarters, or the middle).
    const more = L === 1 ? { labels: [0, 5, 10, 15, 20], step: 5 } : L === 2 ? { labels: [0, 25, 50, 75, 100], step: 25 } : { labels: [0, 50, 100], step: 50 };
    return {
      lines: [`Which dot is about ${target}?`],
      widget: 'numberline', props: { min: 0, max, labels, step: L === 1 ? 10 : L === 2 ? 50 : 100, minor: 0, marks: pts.map((v, i) => ({ at: v, label: letters[i], colour: 'orange' })) },
      input: 'choice', answer: letters[ti], options: letters,
      hint: [L === 1 ? 'Now the fives have labels too.' : L === 2 ? 'Now 25 and 75 have labels too.' : 'Now the middle has its label: 50.', target === half ? `${target} is the middle.` : `Is ${target} more or less than ${half}?`],
      hintProps: more,
      explain: [target > half ? `${target} is more than half way.` : target < half ? `${target} is less than half way.` : `${target} is half way.`, `Dot ${letters[ti]} is about ${target}.`],
      reteach: L > 1 ? estimateLine.make(1, R, params) : undefined,
    };
  },
};

// ---------- compare (Y1-NPV-4, 1NPV-2, Y2-NPV-4) ----------
const SIGNS = ['<', '>', '='];
const signOf = (a, b) => (a < b ? '<' : a > b ? '>' : '=');
const signWords = s => (s === '<' ? 'is less than' : s === '>' ? 'is greater than' : 'is equal to');
export const compare = {
  about: 'Compare with <, > and = (pictures to 20, two-digit numbers, then expressions)',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    if (L === 1) {
      let a = R.int(1, 20), b = R.int(1, 20);
      if (R.chance(0.2)) b = a;
      const s = signOf(a, b);
      return {
        lines: ['Which sign goes in the gap?', 'Do the red dots have more, fewer or the same?'],
        caption: `${a}  ?  ${b}`,
        widget: 'objects', props: { n: a + b, icon: 'dot', arrange: 'groups', groups: [a, b], colours: [a, b] },
        input: 'choice', answer: s, options: SIGNS,
        hint: [`Look: ${a} red and ${b} yellow.`, a === b ? '= means the same.' : "The crocodile's mouth eats the bigger number."],
        hintProps: { groupLabels: [String(a), String(b)] },
        explain: [s === '=' ? `${a} is the same as ${b}.` : `${a} is ${s === '>' ? 'more' : 'fewer'} than ${b}.`, `${a} ${s} ${b}: ${a} ${signWords(s)} ${b}.`],
        reteach: a > 6 || b > 6 ? compare.make(1, { ...R, int: (x, y) => R.int(x, Math.min(y, 6)) }, params) : undefined,
      };
    }
    if (L === 2) {
      const kind = R.int(0, 3);
      let a, b;
      if (kind === 0) { const T = R.int(1, 9) * 10; a = T + R.int(0, 9); b = T + R.int(0, 9); if (a === b) b = a === T + 9 ? a - 1 : a + 1; }
      else if (kind === 1) { const x = R.int(1, 9); let y = R.int(1, 9); if (y === x) y = x === 9 ? 1 : x + 1; a = x * 10 + y; b = y * 10 + x; }
      else if (kind === 2) { a = R.int(10, 99); b = R.int(10, 99); }
      else { a = R.int(10, 99); b = a; }
      if (R.chance(0.5)) [a, b] = [b, a];
      const s = signOf(a, b);
      const sameT = tenOf(a) === tenOf(b);
      const ta = Math.floor(a / 10), tb = Math.floor(b / 10);
      return {
        lines: ['Which sign goes in the gap?'],
        caption: `${a}  ?  ${b}`,
        input: 'choice', answer: s, options: SIGNS,
        hint: a === b ? ['Look at both numbers closely.', 'Same tens and same ones?'] : sameT ? ['The tens are the same.', 'So look at the ones.'] : ['Look at the tens first.', 'More tens means a bigger number.'],
        hintWidget: sameT && a !== b
          ? { widget: 'numberline', props: { min: tenOf(a), max: tenOf(a) + 10, labels: 'all', marks: [{ at: a, colour: 'orange' }, { at: b, colour: 'purple' }] } }
          : { widget: 'numberline', props: { min: 0, max: 100, labels: 'tens', marks: a === b ? [{ at: a, label: String(a), colour: 'orange' }] : [{ at: a, label: String(a), colour: 'orange' }, { at: b, label: String(b), colour: 'purple', below: Math.abs(a - b) < 9 }] } },
        explain: a === b ? [`${a} and ${b} are the same.`, `${a} = ${b}`]
          : sameT ? [`Both have ${ta} tens. ${a % 10} ones ${a > b ? 'is more than' : 'is less than'} ${b % 10} ones.`, `${a} ${signWords(s)} ${b}: ${a} ${s} ${b}`]
          : [`${ta} tens ${ta > tb ? 'is more than' : 'is less than'} ${tb} tens.`, `${a} ${signWords(s)} ${b}: ${a} ${s} ${b}`],
        reteach: compare.make(1, R, params),
      };
    }
    // Level 3: expressions.
    const kind = R.int(0, 3);
    let left, lv, right, rv;
    const t = R.int(2, 8), o = R.int(1, 9);
    if (kind === 0) { left = `${t * 10} + ${o}`; lv = t * 10 + o; rv = R.chance(0.3) ? lv : o * 10 + t === lv ? lv + 1 : o * 10 + t; right = String(rv); }
    else if (kind === 1) { left = `${t} tens`; lv = t * 10; rv = t * 10 + R.pick([-3, -1, 0, 2, 5]); right = String(rv); }
    else if (kind === 2) { left = `${t * 10} + ${o}`; lv = t * 10 + o; const t2 = R.chance(0.5) ? t : t + 1; const o2 = R.chance(0.5) ? o : R.int(0, 9); right = `${t2 * 10} + ${o2}`; rv = t2 * 10 + o2; }
    else { left = `${t * 10} + ${o}`; lv = t * 10 + o; const same = R.chance(0.6); right = same ? `${o} + ${t * 10}` : `${o} + ${(t - 1) * 10}`; rv = same ? lv : o + (t - 1) * 10; }
    if (R.chance(0.5)) { [left, right] = [right, left]; [lv, rv] = [rv, lv]; }
    const s = signOf(lv, rv);
    return {
      lines: ['Work out each side first.', 'Which sign goes in the gap?'],
      caption: `${left}  ?  ${right}`,
      input: 'choice', answer: s, options: SIGNS,
      hint: [`${left} is ${lv}.`, `${right} is ${rv}.`],
      hintWidget: { widget: 'numberline', props: { min: 0, max: 100, labels: 'tens', marks: lv === rv ? [{ at: lv, label: String(lv), colour: 'orange' }] : [{ at: lv, label: String(lv), colour: 'orange' }, { at: rv, label: String(rv), colour: 'purple', below: Math.abs(lv - rv) < 9 }] } },
      explain: [`${left} is ${lv}. ${right} is ${rv}.`, `${lv} ${signWords(s)} ${rv}, so ${left} ${s} ${right}.`],
      reteach: compare.make(2, R, params),
    };
  },
};

// ---------- order (Y1-NPV-4, Y2-NPV-4) ----------
export const order = {
  about: 'Order numbers smallest to largest (3 to 20, 4 to 100, 5 with digit swaps)',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    let nums;
    if (L === 1) nums = R.distinct(3, 1, 20);
    else if (L === 2) {
      const T = R.int(2, 8) * 10;
      nums = [T + R.int(0, 9), ...R.distinct(3, 10, 99)];
    } else {
      const x = R.int(1, 8), y = R.int(x + 1, 9);
      nums = [x * 10 + y, y * 10 + x, x * 10 + R.int(0, 9), ...R.distinct(2, 10, 99)];
    }
    nums = [...new Set(nums)];
    while (nums.length < (L === 1 ? 3 : L === 2 ? 4 : 5)) { const v = R.int(L === 1 ? 1 : 10, L === 1 ? 20 : 99); if (!nums.includes(v)) nums.push(v); }
    const desc = L === 3 && R.chance(0.35);
    const sorted = [...nums].sort((a, b) => (desc ? b - a : a - b));
    const lo = Math.min(...nums), hi = Math.max(...nums);
    // A picture to think with: a 0 to 20 line, or the 100 square. The hint puts the numbers on it.
    const onLine = L === 1;
    return {
      lines: ['Put the numbers in order.', desc ? 'Biggest first.' : 'Smallest first.'],
      widget: onLine ? 'numberline' : 'hundred', props: onLine ? { min: 0, max: 20, labels: 'fives', minor: 1 } : {},
      input: 'order', options: R.shuffle(nums), answer: sorted,
      hint: onLine
        ? ['Here they are on the number line.', desc ? 'The biggest is furthest along.' : 'The smallest is nearest to 0.']
        : ['Here they are on the 100 square.', desc ? 'The biggest is nearest the bottom.' : 'The smallest is nearest the top.'],
      hintProps: onLine ? { marks: labelledMarks(nums, 3) } : { highlight: nums },
      explain: L === 1
        ? [`${lo} is the smallest.`, `${hi} is the biggest.`]
        : ['Compare the tens first, then the ones.', `${lo} is the smallest. ${hi} is the biggest.`],
      reteach: L > 1 ? order.make(L - 1, R, params) : undefined,
    };
  },
};

// ---------- placeValueProblem (Y2-NPV-6) ----------
export const placeValueProblem = {
  about: 'Use place value to solve problems: biggest number from digits, tens and ones stories, riddles',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    if (L === 1) {
      const [a, b] = R.distinct(2, 1, 9);
      const hi = Math.max(a, b), lo = Math.min(a, b);
      const big = R.chance(0.6);
      const ans = big ? hi * 10 + lo : lo * 10 + hi;
      return {
        lines: [`Use the digits ${a} and ${b}.`, `Make the ${big ? 'biggest' : 'smallest'} number you can.`],
        input: 'choice', answer: ans, options: choices(R, ans, [big ? lo * 10 + hi : hi * 10 + lo, a + b]),
        hint: ['The tens digit matters most.', big ? `Which is more: ${hi} tens or ${lo} tens?` : `Which is less: ${lo} tens or ${hi} tens?`],
        explain: [big ? `${hi} tens is more than ${lo} tens.` : `${lo} tens is less than ${hi} tens.`, `So ${big ? hi : lo} goes in the tens place: ${ans}.`],
      };
    }
    const thing = R.pick(THINGS);
    if (L === 2) {
      const kind = R.int(0, 2);
      if (kind === 0) {
        const t = R.int(2, 8), o = R.int(1, 9);
        return {
          lines: [`${t} boxes hold 10 ${thing} each.`, `There are ${o} more loose.`, `How many ${thing}?`],
          input: 'numpad', answer: t * 10 + o,
          hint: [`${t} boxes of 10 is ${t} tens: the green rods.`, 'Then add the loose ones: the blue cubes.'],
          hintWidget: { widget: 'placevalue', props: { tens: t, ones: o, readonly: true } },
          explain: [`${t} tens is ${t * 10}.`, `${t * 10} + ${o} = ${t * 10 + o}`],
          reteach: readTensOnes.make(1, R, {}),
        };
      }
      const more = kind === 1;
      const n = more ? R.int(12, 89) : R.int(21, 99);
      const ans = more ? n + 10 : n - 10;
      return {
        lines: [`The rocket has ${n} ${thing}.`, more ? 'It picks up 10 more.' : 'It drops off 10.', `How many ${thing} now?`],
        input: 'numpad', answer: ans,
        hint: [more ? '10 more is one row down: the ?.' : '10 less is one row up: the ?.', 'The ones digit stays the same.'],
        hintWidget: { widget: 'hundred', props: { highlight: [n], hide: [ans] } },
        explain: [more ? `${Math.floor(n / 10)} tens becomes ${Math.floor(n / 10) + 1} tens.` : `${Math.floor(n / 10)} tens becomes ${Math.floor(n / 10) - 1} tens.`, `${n} ${more ? '+' : '−'} 10 = ${ans}`],
        reteach: oneMoreLess.make(3, R, { kind: more ? 'more' : 'less' }),
      };
    }
    const kind = R.int(0, 2);
    if (kind === 0) {
      const t = R.int(1, 7), o = R.int(10, 19);
      return {
        lines: [`I have ${t} tens and ${o} ones.`, 'What number am I?'],
        input: 'numpad', answer: t * 10 + o,
        hint: [`${o} ones is 1 ten and ${o - 10} ones.`, 'Count the rods in tens, then the cubes.'],
        hintWidget: { widget: 'placevalue', props: { tens: t, ones: o, readonly: true } },
        explain: [`${t} tens is ${t * 10}.`, `${t * 10} + ${o} = ${t * 10 + o}`],
        reteach: readTensOnes.make(2, R, {}),
      };
    }
    if (kind === 1) {
      const T = R.int(2, 9) * 10, o = R.int(1, 9);
      return {
        lines: [`I am between ${T} and ${T + 10}.`, `My ones digit is ${o}.`, 'What number am I?'],
        input: 'numpad', answer: T + o,
        hint: [`Numbers between ${T} and ${T + 10} have ${T / 10} tens.`, `Count ${o} on from ${T} to the ?.`],
        hintWidget: { widget: 'numberline', props: { min: T, max: T + 10, labels: 'ends', minor: 1, marks: [{ at: T + o, label: '?', colour: 'orange' }] } },
        explain: [`It has ${T / 10} tens and ${o} ones.`, `${T / 10} tens and ${o} ones is ${T + o}.`],
        reteach: partition.make(2, R, {}),
      };
    }
    const n = R.int(11, 69);
    const k = R.int(2, 3);
    return {
      lines: [`Start at ${n}.`, `Add ${k} more tens.`, 'Where do you land?'],
      input: 'numpad', answer: n + k * 10,
      hint: ['Count on in tens: one row down each time.', 'The ones stay the same. Find the ?.'],
      hintWidget: { widget: 'hundred', props: { highlight: Array.from({ length: k }, (_, i) => n + i * 10), hide: [n + k * 10] } },
      explain: [[0, 1, 2, 3].slice(0, k + 1).map(i => n + i * 10).join(', ') + '.', `${n} + ${k * 10} = ${n + k * 10}`],
      reteach: oneMoreLess.make(3, R, { kind: 'more' }),
    };
  },
};

// ---------- tidy grammar in every tutor line: "1 tens" -> "1 ten", "1 rows" -> "1 row"; capital first letter ----------
const SINGULAR = { tens: 'ten', ones: 'one', rows: 'row', hops: 'hop', groups: 'group', boxes: 'box' };
const tidyText = s => {
  if (typeof s !== 'string') return s;
  s = s.replace(/(^|[^\d.])1 (tens|ones|rows|hops|groups|boxes)\b/g, (m, pre, w) => `${pre}1 ${SINGULAR[w]}`);
  return s.replace(/^([a-z])/, c => c.toUpperCase());
};
function tidy(item) {
  if (!item || typeof item !== 'object') return item;
  for (const k of ['lines', 'hint', 'explain']) if (Array.isArray(item[k])) item[k] = item[k].map(tidyText);
  if (item.reteach) tidy(item.reteach);
  return item;
}
for (const g of [countObjects, countOn, oneMoreLess, numberWords, skipCount, readTensOnes, buildNumber, digitValue, partition, numberLinePlace, numberLineRead, betweenTens, estimateLine, compare, order, placeValueProblem]) {
  const make = g.make;
  g.make = function (level, R, params) { return tidy(make.call(this, level, R, params)); };
}
