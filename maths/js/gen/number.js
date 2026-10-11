// Number and place value generators (Year 1 and Year 2). See ENGINE.md section 4.
// Each export: { about, levels, make(level, R, params) } returning one practice item.
// Level 1 is gentle (pictures, choice, within 20); level 3 is Year-2-hard.
// Optional params (from mission JSON) are listed on each generator.
// Debug: dev/gen.html?gen=number&all=1  or  dev/gen.html?gen=number.readTensOnes&level=3

// ---------- helpers ----------
const ICONS = ['star', 'rocket', 'alien', 'astronaut', 'moon', 'crystal', 'planet', 'satellite', 'fuel', 'asteroid', 'comet'];
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

const tenOf = n => Math.floor(n / 10) * 10;
const swapDigits = n => (n % 10) * 10 + Math.floor(n / 10);

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

// ---------- countObjects (Y1-NPV-2, 1NF-2) ----------
// params: icons, min, max (level 1 only)
export const countObjects = {
  about: 'Count a set of space things: tap to count, rows of 5 or 10, groups of ten',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    const { icon, name } = iconOf(R, params);
    if (L === 1) {
      const n = R.int(Math.max(1, params.min ?? 3), Math.min(10, params.max ?? 10));
      return {
        lines: [`How many ${name}?`, 'Tap each one as you count.'],
        widget: 'objects', props: { n, icon, arrange: n <= 6 ? 'row' : 'scatter', tappable: true, interactive: true },
        input: 'choice', answer: n, options: choices(R, n, R.shuffle([n + 1, n - 1, n + 2])),
        hint: ['Touch each one once.', 'Say one number for each one.'],
        explain: [`There are ${n} ${name}.`, 'The last number you say is how many.'],
        reteach: n > 5 ? countObjects.make(1, R, { ...params, min: 2, max: 5 }) : undefined,
      };
    }
    if (L === 2) {
      const n = R.int(11, 20);
      const per = R.pick([5, 10]);
      const full = Math.floor(n / per), rest = n % per;
      return {
        lines: [`How many ${name}?`, `They are in rows of ${per}.`],
        widget: 'objects', props: { n, icon, arrange: 'rows', perRow: per },
        input: 'numpad', answer: n,
        hint: [`Count the full rows in ${per}s.`, 'Then count on the rest.'],
        explain: rest
          ? [`${full} rows of ${per} is ${full * per}.`, `${full * per} and ${rest} more is ${n}.`]
          : [`${full} rows of ${per} is ${n}.`],
        reteach: countObjects.make(1, R, params),
      };
    }
    const n = R.int(21, 49);
    const t = Math.floor(n / 10), o = n % 10;
    const groups = [...Array(t).fill(10), ...(o ? [o] : [])];
    return {
      lines: [`How many ${name}?`, 'Each ring holds 10.'],
      widget: 'objects', props: { n, icon: 'dot', arrange: 'groups', groups },
      input: 'numpad', answer: n,
      hint: ['They are in groups of 10, so count in tens.', 'Then count on the ones.'],
      explain: o ? [`${t} tens is ${t * 10}.`, `${t * 10} and ${o} more is ${n}.`] : [`${t} tens is ${n}.`],
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
        lines: ['Count on.', 'What number is missing?'],
        caption: cap,
        widget: 'numberline', props: { min: 0, max: 20, labels: 'all', hide: [m], marks: seq.filter(v => v !== m) },
        input: 'choice', answer: m, options: choices(R, m, [m + 10 <= 30 ? m + 10 : m - 10, m + 2, m - 2]),
        hint: [`Say the numbers: ${seq.slice(0, mi).join(', ')}...`, 'What comes next?'],
        explain: [`${seq.slice(0, mi + 1).join(', ')}.`, `${m} comes after ${m - 1}.`],
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
        hint: ['Count back out loud, slowly.', `What comes before ${m + 1}?`],
        hintWidget: { widget: 'numberline', props: { min: 10, max: 20, labels: 'all', hide: [m] } },
        explain: [`${seq.slice(0, mi + 1).join(', ')}.`, `${m} comes before ${m + 1}.`],
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
    return {
      lines: [dir === 'fwd' ? 'Count on.' : 'Count back.', 'What number is missing?'],
      caption: cap,
      input: 'numpad', answer: m,
      hint: dir === 'fwd' ? ['Say the numbers out loud.', `What comes after ${m - 1}?`] : ['Count back out loud.', `What comes before ${m + 1}?`],
      hintWidget: L === 2
        ? { widget: 'hundred', props: { hide: [m], highlight: seq.filter(v => v !== m && v >= 1) } }
        : { widget: 'numberline', props: { min: lo, max: hi, labels: 'all', hide: [m] } },
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
      return {
        lines: [`Here are ${n} ${name}.`, `What is 1 ${kind} than ${n}?`],
        widget: 'objects', props: { n, icon, arrange: n <= 10 ? 'row' : 'rows', perRow: 5 },
        input: 'choice', answer: ans, options: choices(R, ans, [kind === 'more' ? n - 1 : n + 1, n]),
        hint: kind === 'more' ? ['Imagine 1 more joins them.', `Count on 1 from ${n}.`] : ['Imagine 1 flies away.', `Count back 1 from ${n}.`],
        explain: [`1 ${kind} than ${n} is ${ans}.`],
      };
    }
    if (by === 1) {
      let n = R.chance(0.4) ? R.int(2, 9) * 10 + (kind === 'more' ? 9 : 0) : R.int(21, 98);
      if (kind === 'more') n = Math.min(n, 99); else n = Math.max(n, 2);
      const ans = kind === 'more' ? n + 1 : n - 1;
      return {
        lines: [`What is 1 ${kind} than ${n}?`],
        widget: 'hundred', props: { highlight: [n] },
        input: 'numpad', answer: ans,
        hint: kind === 'more' ? ['Find it on the 100 square.', 'Look at the next square.'] : ['Find it on the 100 square.', 'Look at the square before.'],
        explain: [`1 ${kind} than ${n} is ${ans}.`],
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
      hint: kind === 'more' ? ['The tens digit goes up by 1.', 'The ones digit stays the same.'] : ['The tens digit goes down by 1.', 'The ones digit stays the same.'],
      hintWidget: { widget: 'hundred', props: { highlight: [n] } },
      explain: [`${t} tens becomes ${kind === 'more' ? t + 1 : t - 1} tens.`, `10 ${kind} than ${n} is ${ans}.`],
      reteach: { lines: [`What is 10 ${kind} than ${kind === 'more' ? 40 : 60}?`], input: 'numpad', answer: kind === 'more' ? 50 : 50, hint: ['Count in tens.'], explain: [kind === 'more' ? '4 tens and 1 more ten is 5 tens.' : '6 tens take away 1 ten is 5 tens.'], widget: 'placevalue', props: { tens: kind === 'more' ? 4 : 6, ones: 0, readonly: true } },
    };
  },
};

// ---------- numberWords (Y1-NPV-5, Y2-NPV-5) ----------
// params: dir ('toWords' | 'toDigits')
export const numberWords = {
  about: 'Numbers in digits and words: to 20, to 100 with hyphens, then the tricky teens and tens',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    const dir = params.dir || R.pick(['toWords', 'toDigits']);
    if (L === 1) {
      const n = R.int(1, 20);
      const confus = n > 12 && n < 20 ? [(n - 10) * 10, n - 10, n + 1] : n <= 10 ? [n + 10, n + 1, n - 1] : [n * 1 === 20 ? 12 : 20, n - 10, n + 1];
      const opts = dir === 'toWords'
        ? choices(R, words(n), confus.filter(v => v >= 0 && v <= 100 && v !== n).map(words))
        : choices(R, n, confus);
      return {
        lines: [dir === 'toWords' ? 'Which word says this number?' : 'Which number is this word?'],
        caption: dir === 'toWords' ? String(n) : words(n),
        widget: 'tensframe', props: { count: n, frames: n > 10 ? 2 : 1, interactive: false, readonly: true },
        input: 'choice', answer: dir === 'toWords' ? words(n) : n, options: opts,
        hint: n > 12 && n < 20 ? ['Teen numbers are ten and some more.', `Count the counters.`] : ['Count the counters.', 'Say the number out loud.'],
        explain: [`${n} is ${words(n)}.`],
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
        hint: [`${words(t * 10)} is ${t * 10}.`, `${words(o)} is ${o}.`],
        hintWidget: { widget: 'placevalue', props: { tens: t, ones: o, readonly: true } },
        explain: [`${words(t * 10)} and ${words(o)} make ${words(n)}.`, `${words(n)} is ${n}.`],
        reteach: numberWords.make(1, R, { dir }),
      };
    }
    // Level 3: the tricky pairs, or words to digits on the numpad.
    if (R.chance(0.5)) {
      const d = R.int(3, 9);
      const teen = 10 + d, ten = d * 10;
      const askTeen = R.chance(0.5);
      const target = askTeen ? teen : ten;
      if (R.chance(0.5)) {
        return {
          lines: [`Which number is ${words(target)}?`],
          caption: words(target),
          input: 'choice', answer: target, options: choices(R, target, [askTeen ? ten : teen, d]),
          hint: askTeen ? ['"Teen" means ten and some more.'] : ['"Ty" means tens.', `${words(ten)} is ${d} tens.`],
          explain: [`${words(teen)} is ${teen}. It is 1 ten and ${d} ones.`, `${words(ten)} is ${ten}. It is ${d} tens.`],
        };
      }
      return {
        lines: ['Which word says this number?'],
        caption: String(target),
        input: 'choice', answer: words(target), options: choices(R, words(target), [words(askTeen ? ten : teen), words(d)]),
        hint: askTeen ? ['This number is 1 ten and some ones.'] : ['This number is only tens.'],
        explain: [`${teen} is ${words(teen)}.`, `${ten} is ${words(ten)}.`],
      };
    }
    const n = R.chance(0.2) ? R.pick([13, 14, 15, 16, 17, 18, 19, 30, 40, 50, 60, 70, 80, 90]) : R.int(2, 9) * 10 + R.int(1, 9);
    const t = Math.floor(n / 10), o = n % 10;
    return {
      lines: ['Type this number in digits.'],
      caption: words(n),
      input: 'numpad', answer: n,
      hint: n < 20 ? ['Teen numbers start with a 1.'] : [`${words(t * 10)} is ${t} tens.`, o ? `${words(o)} is the ones.` : 'There are no extra ones.'],
      hintWidget: { widget: 'placevalue', props: { tens: t, ones: o, readonly: true } },
      explain: [`${words(n)} is ${t} tens and ${o} ones.`, `We write it ${n}.`],
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
        lines: [`Count in ${word}.`, askNext ? 'What number comes next?' : 'What number is missing?'],
        caption: full.map((v, i) => (i === mi ? '?' : v)).join(', '),
        widget: 'numberline', props: { min: 0, max, step, minor: step === 10 ? 5 : 1, labels: 'all', hide: [m], hops },
        input: 'choice', answer: m, options: choices(R, m, [m + 1, m - 1, m + step]),
        hint: [`Hop on ${step} more from ${full[mi - 1]}.`],
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
    let hintWidget;
    if (step === 3) hintWidget = { widget: 'numberline', props: { min: 0, max: 30, step: 3, minor: 1, labels: 'all', hide: [m] } };
    else hintWidget = { widget: 'hundred', props: { pattern: { every: step, from: ((start % step) + step) % step || step }, hide: [m] } };
    return {
      lines: [isOdd ? `Count ${dir === 'back' ? 'back' : 'on'} in 2s through the odd numbers.` : `Count ${dir === 'back' ? 'back' : 'on'} in ${word}.`, 'What number is missing?'],
      caption: seq.map((v, i) => (i === mi ? '?' : v)).join(', '),
      input: 'numpad', answer: m,
      hint: step === 10 ? ['Only the tens digit changes.', `The ones digit stays ${start % 10}.`] : [`Each jump is ${step}.`, dir === 'back' ? `What is ${step} less than ${seq[mi - 1]}?` : `What is ${step} more than ${seq[mi - 1]}?`],
      hintWidget,
      explain: [seq.slice(0, mi + 1).join(', ') + '.', `${seq[mi - 1]} ${dir === 'back' ? '−' : '+'} ${step} = ${m}`],
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
    if (L === 1) {
      const t = R.int(1, 4);
      let o = R.int(1, 9);
      if (o === t) o = o === 9 ? 8 : o + 1;
      const n = t * 10 + o;
      return {
        lines: ['What number do the blocks show?', 'Count the tens, then the ones.'],
        widget: 'placevalue', props: { tens: t, ones: o, readonly: true },
        input: 'choice', answer: n, options: choices(R, n, [swapDigits(n), n + 10, n - 1]),
        hint: ['Count the rods in tens: 10, 20, 30...', 'Then count on the ones.'],
        hintProps: { showDigits: true },
        explain: [`${t} tens is ${t * 10}.`, `${t * 10} and ${o} more is ${n}.`],
        reteach: { lines: ['What number do the blocks show?'], widget: 'placevalue', props: { tens: 1, ones: o, readonly: true }, input: 'choice', answer: 10 + o, options: choices(R, 10 + o, [o * 10 + 1, o]), hint: ['1 rod is 10.'], explain: [`10 and ${o} more is ${10 + o}.`] },
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
        hint: ['Count the tens first.', 'Then count on the ones.'],
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
      hint: ['10 ones make 1 ten.', 'Count the tens, then count on the ones.'],
      hintProps: { showDigits: true },
      explain: [`${t} tens is ${t * 10}.`, `${o} ones is 1 ten and ${o - 10} ones.`, `${t * 10} + ${o} = ${n}`],
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
        hint: [`How many tens are in ${n}?`, 'How many ones?'],
        hintProps: { showDigits: true },
        explain: [`${n} is ${t} tens and ${o} ones.`],
        reteach: L === 2 ? buildNumber.make(1, R, params) : undefined,
      };
    }
    const t = R.int(2, 8), o = R.int(0, 8);
    const n = t * 10 + o;
    return {
      lines: [`This is ${n}.`, `Make ${n} a different way.`, 'Use more than 9 ones.'],
      caption: String(n),
      widget: 'placevalue', props: { tens: t, ones: o, showExpanded: true, interactive: true },
      input: 'widget', goal: { value: n, ones: { gte: 10 } },
      hint: ['Tap a ten.', 'Swap it for 10 ones.'],
      explain: [`${t - 1} tens and ${o + 10} ones is ${n} too.`, `${(t - 1) * 10} + ${o + 10} = ${n}`],
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
          hint: [`${d * 10} is ${d} tens.`, `The ${d} must be in the tens place.`],
          explain: [`In ${ans} the ${d} is in the tens place.`, `It shows ${d} groups of ten.`],
        };
      }
      if (kind === 'tensOnes') {
        return {
          lines: [`What number has ${t} tens and ${o} ones?`],
          input: 'numpad', answer: n,
          hint: [`${t} tens is ${t * 10}.`],
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
        hint: [`${a} tens is ${a * 10}.`],
        explain: [`${a} tens is ${a * 10}. ${b} ones is ${b}.`, `So ${big} is more.`],
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
      hint: askTens ? [`The ${t} is in the tens place.`, `How many is ${t} tens?`] : [`The ${o} is in the ones place.`],
      hintWidget: L === 2 ? { widget: 'placevalue', props: { tens: t, ones: o, showDigits: true, readonly: true } } : undefined,
      explain: askTens ? [`The ${t} shows we have ${t} groups of ten.`, `It is worth ${t * 10}.`] : [`The ${o} shows we have ${o} extra ones.`, `It is worth ${o}.`],
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
        hint: ['The tens make the first part.', 'How many ones are left?'],
        explain: [`${n} is ${t * 10} and ${o}.`, `${n} = ${t * 10} + ${o}`],
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
        hint: kind === 1 ? [`How many tens are in ${n}?`] : kind === 0 ? [`How many ones are in ${n}?`] : [`${t} tens and ${o} ones.`],
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
      hint: ['Swap a ten for 10 ones.', `${t * 10} is ${a} + ${k * 10}.`],
      hintWidget: { widget: 'placevalue', props: { tens: t - k, ones: o + k * 10, readonly: true } },
      explain: [`${n} = ${t * 10} + ${o}`, `${n} = ${a} + ${b} too.`],
      reteach: partition.make(2, R, params),
    };
  },
};

// ---------- numberLinePlace (Y1-NPV-4, 1NPV-2, Y2-NPV-3, 2NPV-2): widget input ----------
export const numberLinePlace = {
  about: 'Land the rocket on a number line: 0 to 20 labelled, 0 to 100 in tens, then only 0, 50, 100',
  levels: 3,
  make(level, R, params = {}) {
    const L = lvl(level);
    if (L === 1) {
      const n = R.int(1, 19);
      return {
        lines: [`Land the rocket on ${n}.`, 'Drag it, or tap the line.'],
        caption: String(n),
        widget: 'numberline', props: { min: 0, max: 20, mode: 'place', labels: 'all' },
        input: 'widget', goal: { value: n },
        hint: [`Find ${n} under the line.`, n > 10 ? `It is after 10.` : 'It is before 10.'],
        explain: [n === 10 ? '10 is halfway between 0 and 20.' : n > 10 ? `${n} is ${n - 10} more than 10.` : `${n} is ${10 - n} less than 10.`],
      };
    }
    if (L === 2) {
      let n = R.int(3, 97);
      if (n % 10 === 0) n += R.pick([1, 3, -2]);
      return {
        lines: [`Land the rocket on ${n}.`, 'Use the tens to help.'],
        caption: String(n),
        widget: 'numberline', props: { min: 0, max: 100, mode: 'place', labels: 'tens', minor: 1 },
        input: 'widget', goal: { value: { gte: n - 1, lte: n + 1 } },
        hint: [`${n} is between ${tenOf(n)} and ${tenOf(n) + 10}.`],
        explain: [nearTenLine(n)],
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
      hint: ['50 is halfway.', n > 50 ? `${n} is more than 50.` : `${n} is less than 50.`],
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
      return {
        lines: ['What number is the dot on?'],
        widget: 'numberline', props: { min: 0, max: 20, labels: 'fives', minor: 1, marks: [{ at: n, label: '?', colour: 'gold' }] },
        input: 'numpad', answer: n,
        hint: ['Find the nearest number you can see.', 'Count the little marks from there.'],
        explain: [nearTenLine(n)],
      };
    }
    if (L === 2) {
      const T = R.int(1, 8) * 10;
      let o = R.int(1, 9);
      if (o === 5) o = R.pick([4, 6]);
      const n = T + o;
      return {
        lines: ['What number is the dot on?', `The middle is ${T + 5}.`],
        widget: 'numberline', props: { min: T, max: T + 10, labels: [T, T + 5, T + 10], minor: 1, marks: [{ at: n, label: '?', colour: 'gold' }] },
        input: 'numpad', answer: n,
        hint: [o < 5 ? `Count on from ${T}.` : `Count on from ${T + 5}, or back from ${T + 10}.`],
        explain: [o === 4 || o === 6 ? `It is 1 ${o === 6 ? 'more' : 'less'} than the midpoint, ${T + 5}.` : nearTenLine(n), `So the dot is on ${n}.`],
        reteach: numberLineRead.make(1, R, params),
      };
    }
    const n = R.pick([10, 15, 20, 25, 30, 35, 40, 45, 55, 60, 65, 70, 75, 80, 85, 90]);
    return {
      lines: ['What number is the dot on?', 'The long marks are tens.'],
      widget: 'numberline', props: { min: 0, max: 100, labels: [0, 50, 100], step: 10, minor: 5, marks: [{ at: n, label: '?', colour: 'gold' }] },
      input: 'numpad', answer: n,
      hint: [n > 50 ? 'Count on in tens from 50.' : 'Count on in tens from 0.', 'A short mark is halfway: a 5.'],
      explain: [n % 10 === 5 ? `It is halfway between ${n - 5} and ${n + 5}.` : `Count the tens: it is ${n}.`, `The dot is on ${n}.`],
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
        widget: 'numberline', props: { min: T - 10, max: T + 20, step: 10, minor: 1, labels: 'none', marks: [{ at: n, label: String(n), colour: 'gold' }] },
        input: 'choice', answer: pair(T, T + 10),
        options: R.shuffle([pair(T, T + 10), pair(T - 10, T), pair(T + 10, T + 20)]),
        hint: [`${n} has ${T / 10} tens.`, 'So it is just after one ten.'],
        hintProps: { labels: 'tens' },
        explain: [`${n} is after ${T} and before ${T + 10}.`],
      };
    }
    if (L === 2) {
      const next = R.chance(0.5);
      return {
        lines: [next ? `What is the next ten after ${n}?` : `What ten comes just before ${n}?`],
        input: 'numpad', answer: next ? T + 10 : T,
        hint: [next ? `Count on from ${n} to a ten.` : `Count back from ${n} to a ten.`],
        hintWidget: { widget: 'numberline', props: { min: T, max: T + 10, labels: 'ends', minor: 1, marks: [{ at: n, label: String(n), colour: 'gold' }] } },
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
      hintWidget: { widget: 'numberline', props: { min: T, max: T + 10, labels: [T, T + 5, T + 10], minor: 1, marks: [{ at: n, label: String(n), colour: 'gold' }] } },
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
      return {
        lines: [`About how many ${name}?`, "Don't count them all. Estimate!"],
        widget: 'objects', props: { n, icon: n > 30 ? 'dot' : icon, arrange: 'scatter' },
        input: 'choice', answer: band[2], options: ['About 10', 'About 30', 'About 50'],
        hint: ['Count a small group of 10.', 'How many groups like that?'],
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
    return {
      lines: [`Which dot is about ${target}?`],
      widget: 'numberline', props: { min: 0, max, labels, step: L === 1 ? 10 : L === 2 ? 50 : 100, minor: 0, marks: pts.map((v, i) => ({ at: v, label: letters[i], colour: 'gold' })) },
      input: 'choice', answer: letters[ti], options: letters,
      hint: [`Find the middle first. That is ${max / 2}.`, `Is ${target} more or less than ${max / 2}?`],
      explain: [target > max / 2 ? `${target} is more than half way.` : target < max / 2 ? `${target} is less than half way.` : `${target} is half way.`, `Dot ${letters[ti]} is about ${target}.`],
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
        lines: ['Which sign goes in the gap?', `Has gold got more, fewer or the same?`],
        caption: `${a}  ?  ${b}`,
        widget: 'objects', props: { n: a + b, icon: 'dot', arrange: 'groups', groups: [a, b], colours: [a, b] },
        input: 'choice', answer: s, options: SIGNS,
        hint: ['The crocodile mouth eats the bigger number.', '= means the same.'],
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
      return {
        lines: ['Which sign goes in the gap?'],
        caption: `${a}  ?  ${b}`,
        input: 'choice', answer: s, options: SIGNS,
        hint: sameT ? ['The tens are the same.', 'So look at the ones.'] : ['Look at the tens first.', 'More tens means a bigger number.'],
        hintWidget: sameT && a !== b
          ? { widget: 'numberline', props: { min: tenOf(a), max: tenOf(a) + 10, labels: 'all', marks: [{ at: a, colour: 'gold' }, { at: b, colour: 'cyan' }] } }
          : { widget: 'numberline', props: { min: 0, max: 100, labels: 'tens', marks: [{ at: a, label: String(a), colour: 'gold' }, { at: b, label: a === b ? '' : String(b), colour: 'cyan' }] } },
        explain: [`${a} ${signWords(s)} ${b}.`, `${a} ${s} ${b}`],
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
      explain: [`${left} is ${lv}. ${right} is ${rv}.`, `${lv} ${s} ${rv}`],
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
    return {
      lines: ['Put the numbers in order.', desc ? 'Biggest first.' : 'Smallest first.'],
      input: 'order', options: R.shuffle(nums), answer: sorted,
      hint: [desc ? 'Find the biggest number first.' : 'Find the smallest number first.', 'Look at the tens, then the ones.'],
      hintWidget: { widget: 'numberline', props: L === 1 ? { min: 0, max: 20, labels: 'fives', minor: 1, marks: nums.map(v => ({ at: v, label: String(v), colour: 'gold' })) } : { min: 0, max: 100, labels: 'tens', marks: nums.map(v => ({ at: v, colour: 'gold' })) } },
      explain: [sorted.join(', ') + '.', desc ? `${hi} is the biggest.` : `${lo} is the smallest.`],
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
        hint: big ? ['The tens digit matters most.', 'Which digit should be the tens?'] : ['The tens digit matters most.', 'Which digit should be the tens?'],
        explain: [big ? `${hi} tens is more than ${lo} tens.` : `${lo} tens is less than ${hi} tens.`, `So ${ans} is the ${big ? 'biggest' : 'smallest'}.`],
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
          hint: [`${t} boxes of 10 is ${t} tens.`, 'Then add the loose ones.'],
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
        hint: [more ? 'Add 1 ten.' : 'Take away 1 ten.', 'The ones stay the same.'],
        hintWidget: { widget: 'placevalue', props: { tens: Math.floor(n / 10), ones: n % 10, readonly: true } },
        explain: [`${n} ${more ? '+' : '−'} 10 = ${ans}`],
        reteach: oneMoreLess.make(3, R, { kind: more ? 'more' : 'less' }),
      };
    }
    const kind = R.int(0, 2);
    if (kind === 0) {
      const t = R.int(1, 7), o = R.int(10, 19);
      return {
        lines: [`I have ${t} tens and ${o} ones.`, 'What number am I?'],
        input: 'numpad', answer: t * 10 + o,
        hint: [`${o} ones is 1 ten and ${o - 10} ones.`],
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
        hint: [`Numbers between ${T} and ${T + 10} have ${T / 10} tens.`],
        explain: [`${T / 10} tens and ${o} ones is ${T + o}.`],
        reteach: partition.make(2, R, {}),
      };
    }
    const n = R.int(11, 69);
    const k = R.int(2, 3);
    return {
      lines: [`Start at ${n}.`, `Add ${k} more tens.`, 'Where do you land?'],
      input: 'numpad', answer: n + k * 10,
      hint: ['Count on in tens.', 'The ones stay the same.'],
      hintWidget: { widget: 'hundred', props: { highlight: [n] } },
      explain: [[0, 1, 2, 3].slice(0, k + 1).map(i => n + i * 10).join(', ') + '.', `${n} + ${k * 10} = ${n + k * 10}`],
      reteach: oneMoreLess.make(3, R, { kind: 'more' }),
    };
  },
};

// ---------- tidy grammar: "1 tens" -> "1 ten", "1 rows" -> "1 row" in every tutor line ----------
const SINGULAR = { tens: 'ten', ones: 'one', rows: 'row', hops: 'hop', groups: 'group', boxes: 'box' };
const tidyText = s => (typeof s === 'string' ? s.replace(/(^|[^\d.])1 (tens|ones|rows|hops|groups|boxes)\b/g, (m, pre, w) => `${pre}1 ${SINGULAR[w]}`) : s);
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
