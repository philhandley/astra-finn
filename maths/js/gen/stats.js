// Statistics generators: tally charts, pictograms, block diagrams and tables (Y2-S-1, Y2-S-2, Y2-S-3).
// Every item follows ENGINE.md section 4.1. Levels: 1 easiest, 3 hardest.
// Check: dev/gen.html?gen=stats&all=1  and  dev/gen.html?gen=stats.<name>&level=<n>
import { factKey } from '../core/facts.js';

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Space-flavoured data sets. Each knows how to word its questions.
const THEMES = [
  {
    id: 'asteroids', title: 'Asteroids by colour', which: 'Colour', symbol: 'asteroid',
    cats: [['Red', 'red'], ['Blue', 'blue'], ['Green', 'green'], ['Yellow', 'yellow'], ['Purple', 'purple']].map(([label, colour]) => ({ label, colour, icon: 'asteroid' })),
    howMany: c => `How many ${c.label.toLowerCase()} asteroids?`,
    more: (a, b) => `How many more ${a.label.toLowerCase()} asteroids than ${b.label.toLowerCase()} ones?`,
    most: w => `Which colour has the ${w} asteroids?`,
    total: 'How many asteroids altogether?',
    which2: v => `Which colour has ${v} asteroids?`,
  },
  {
    id: 'visitors', title: 'Visitors to the Moon base', which: 'Visitor', symbol: null,
    cats: [{ label: 'Aliens', icon: 'alien' }, { label: 'Robots', icon: 'robot' }, { label: 'UFOs', icon: 'ufo' }, { label: 'Satellites', icon: 'satellite' }],
    howMany: c => `How many ${c.label === 'UFOs' ? 'UFOs' : c.label.toLowerCase()} came to the base?`,
    more: (a, b) => `How many more ${a.label === 'UFOs' ? 'UFOs' : a.label.toLowerCase()} than ${b.label === 'UFOs' ? 'UFOs' : b.label.toLowerCase()}?`,
    most: w => `Which visitor came ${w === 'most' ? 'most' : 'least'} often?`,
    total: 'How many visitors altogether?',
    which2: v => `Which visitor came ${v} times?`,
  },
  {
    id: 'launches', title: 'Rocket launches this week', which: 'Day', symbol: 'rocket',
    cats: [['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'], ['Fri', 'Friday']].map(([label, full]) => ({ label, full, icon: 'rocket' })),
    howMany: c => `How many launches were on ${c.full}?`,
    more: (a, b) => `How many more launches on ${a.full} than on ${b.full}?`,
    most: w => `Which day had the ${w} launches?`,
    total: 'How many launches altogether?',
    which2: v => `Which day had ${v} launches?`,
  },
  {
    id: 'crystals', title: 'Moon crystals found', which: 'Colour', symbol: 'crystal',
    cats: [['Pink', 'pink'], ['Purple', 'purple'], ['Blue', 'blue'], ['Yellow', 'yellow']].map(([label, colour]) => ({ label, colour, icon: 'crystal' })),
    howMany: c => `How many ${c.label.toLowerCase()} crystals were found?`,
    more: (a, b) => `How many more ${a.label.toLowerCase()} crystals than ${b.label.toLowerCase()} ones?`,
    most: w => `Which colour has the ${w} crystals?`,
    total: 'How many crystals altogether?',
    which2: v => `Which colour has ${v} crystals?`,
  },
  {
    id: 'places', title: 'Where shall we fly next?', which: 'Place', symbol: null,
    cats: [{ label: 'Moon', icon: 'moon', the: 'the Moon' }, { label: 'Saturn', icon: 'planet', the: 'Saturn' }, { label: 'Sun', icon: 'sun', the: 'the Sun' }, { label: 'Comet', icon: 'comet', the: 'the comet' }],
    howMany: c => `How many votes for ${c.the}?`,
    more: (a, b) => `How many more votes for ${a.the} than for ${b.the}?`,
    most: w => `Which place got the ${w} votes?`,
    total: 'How many votes altogether?',
    which2: v => `Which place got ${v} votes?`,
  },
];
const nameOf = c => c.full || c.label;

// n categories from a theme, in the theme's own order.
// Callers must use cats.length afterwards: some themes have fewer categories than asked for.
function pickCats(R, th, n) {
  const idx = R.sample(th.cats.map((_, i) => i), Math.min(n, th.cats.length)).sort((a, b) => a - b);
  return idx.map(i => th.cats[i]);
}
// n values from lo..hi, all different when possible, multiples of `step`.
function vals(R, n, lo, hi, step = 1) {
  const span = Math.floor((hi - lo) / step) + 1;
  if (span >= n) return R.distinct(n, 0, span - 1).map(k => lo + k * step);
  return Array.from({ length: n }, () => lo + R.int(0, span - 1) * step);
}
function chart(kind, th, cats, values, extra = {}) {
  return {
    kind,
    title: th.title,
    cats: cats.map((c, i) => ({ label: c.label, icon: c.icon, colour: c.colour, value: values[i] })),
    // Pictures match the words: a theme without one shared picture (visitors, places) draws each row's own icon.
    ...(kind === 'pictogram' ? { ...(th.symbol ? { icon: th.symbol } : {}), key: 1 } : {}),
    ...(kind === 'table' ? { heads: [th.which, 'Number'] } : {}),
    readonly: true,
    ...extra,
  };
}
const plural = (n, one, many) => (n === 1 ? one : many);

const upTo = (a, b, step = 1) => { const out = []; for (let v = a; v <= b; v += step) out.push(v); return out; };
// The method for a tally: count the gates in 5s, then count on the single lines.
function tallyExplain(v) {
  const g = Math.floor(v / 5), r = v % 5;
  if (g === 0) return [`Count the lines: ${upTo(1, v).join(', ')}.`, `That makes ${v}.`];
  const fives = `${g} ${plural(g, 'gate', 'gates')} of 5: ${upTo(5, g * 5, 5).join(', ')}.`;
  if (r === 0) return [fives, `That makes ${v}.`];
  return [fives, `Count on the single lines: ${upTo(g * 5 + 1, v).join(', ')}.`, `That makes ${v}.`];
}
// Help for a tally row: light the row and put 5, 10, 15 over the gates.
const tallyHint = (name, v) => (v >= 5
  ? [`Find the ${name} row.`, 'Each gate is 5. Count 5, 10, then the single lines.']
  : [`Find the ${name} row.`, 'Count the lines, one at a time.']);

// ---------- reading charts ----------
export const readTally = {
  about: 'Read one row of a tally chart',
  levels: 3,
  make(level, R) {
    const th = R.pick(THEMES);
    const n = level <= 1 ? 3 : 4;
    const [lo, hi] = level <= 1 ? [1, 10] : level === 2 ? [4, 20] : [8, 25];
    const cats = pickCats(R, th, n);
    const values = vals(R, n, lo, hi);
    const i = R.int(0, n - 1);
    const small = R.int(6, 9);
    return {
      lines: level <= 1 ? [th.howMany(cats[i]), 'Count the tally marks.'] : [th.howMany(cats[i])],
      widget: 'charts',
      props: chart('tally', th, cats, values),
      input: 'numpad',
      answer: values[i],
      hint: tallyHint(nameOf(cats[i]), values[i]),
      hintProps: { focus: i, gates: true },
      explain: tallyExplain(values[i]),
      reteach: {
        lines: [th.howMany(cats[0]), 'Count the gate of 5, then the single lines.'],
        widget: 'charts',
        props: chart('tally', th, [cats[0]], [small]),
        input: 'numpad', answer: small,
        hint: tallyHint(nameOf(cats[0]), small),
        hintProps: { focus: 0, gates: true },
        explain: tallyExplain(small),
      },
    };
  },
};

// The method for a pictogram row: count the pictures in the key's steps, then add the part picture.
function pictoExplain(v, key) {
  if (key === 1) return [`Count the pictures: ${upTo(1, v).join(', ')}.`, `That makes ${v}.`];
  const full = Math.floor(v / key), rest = v % key;
  const lines = [];
  if (full) lines.push(`Each picture is ${key}. Count in ${key}s: ${upTo(key, full * key, key).join(', ')}.`);
  if (rest) lines.push(`Half a picture is ${rest}. ${full * key} and ${rest} more is ${v}.`);
  else lines.push(`That makes ${v}.`);
  return lines;
}
const pictoHint = (name, key) => (key === 1
  ? [`Find the ${name} row.`, 'Count the pictures, one at a time.']
  : [`Find the ${name} row.`, `The key says each picture is ${key}.`, `Count in ${key}s along the row.`]);

export const readPictogram = {
  about: 'Read a pictogram where one picture stands for 1, 2, 5 or 10',
  levels: 3,
  make(level, R) {
    const th = R.pick(THEMES);
    const n = level <= 1 ? 3 : 4;
    let key, values;
    if (level <= 1) { key = 1; values = vals(R, n, 2, 8); }
    else if (level === 2) { key = 2; values = vals(R, n, 2, 16); }
    else if (R.chance(0.5)) { key = 5; values = vals(R, n, 5, 40, 5); }
    else { key = 10; values = vals(R, n, 10, 70, 5); }
    const cats = pickCats(R, th, n);
    const i = R.int(0, n - 1);
    const rv = vals(R, 3, 2, 8);
    return {
      lines: key === 1 ? [th.howMany(cats[i]), 'Each picture stands for 1.'] : [th.howMany(cats[i]), 'Look at the key.'],
      widget: 'charts',
      props: chart('pictogram', th, cats, values, { key }),
      input: 'numpad',
      answer: values[i],
      hint: pictoHint(nameOf(cats[i]), key),
      hintProps: { focus: i, focusKey: key > 1 },
      explain: pictoExplain(values[i], key),
      reteach: level > 1 ? {
        lines: [th.howMany(cats[0]), 'Each picture stands for 1.'],
        widget: 'charts', props: chart('pictogram', th, cats.slice(0, 3), rv, { key: 1 }),
        input: 'numpad', answer: rv[0],
        hint: pictoHint(nameOf(cats[0]), 1),
        hintProps: { focus: 0 },
        explain: pictoExplain(rv[0], 1),
      } : undefined,
    };
  },
};

export const readBlock = {
  about: 'Read a block diagram with a scale in 1s or 2s',
  levels: 3,
  make(level, R) {
    const th = R.pick(THEMES);
    const n = level <= 1 ? 3 : 4;
    const values = level <= 1 ? vals(R, n, 1, 10) : level === 2 ? vals(R, n, 2, 20, 2) : vals(R, n, 1, 20);
    const cats = pickCats(R, th, n);
    let i = R.int(0, n - 1);
    if (level >= 3) { const odd = values.findIndex(v => v % 2 === 1); if (odd >= 0) i = odd; }
    const v = values[i];
    const max = level <= 1 ? 10 : 20;
    const name = nameOf(cats[i]);
    const between = max > 10 && v % 2 === 1;
    const explain = between
      ? [`The top of the ${name} column is halfway between ${v - 1} and ${v + 1}.`, `So it is ${v}.`]
      : [`Go to the top of the ${name} column.`, `Look across to the numbers: it lines up with ${v}.`];
    const rv = vals(R, 3, 1, 9);
    return {
      lines: [th.howMany(cats[i])],
      widget: 'charts',
      props: chart('block', th, cats, values, { max }),
      input: 'numpad',
      answer: v,
      // Help: the column lights up and a dashed line runs from its top across to the numbers.
      hint: [`Find the top of the ${name} column.`, 'Follow the dashed line across to the numbers.', ...(level >= 3 ? ['Between 2 numbers? It is the one in the middle.'] : [])],
      hintProps: { focus: i, guide: i },
      explain,
      reteach: level > 1 ? {
        lines: [th.howMany(cats[0]), 'Count the blocks.'],
        widget: 'charts', props: chart('block', th, cats.slice(0, 3), rv, { max: 10 }),
        input: 'numpad', answer: rv[0],
        hint: [`Find the ${nameOf(cats[0])} column.`, 'Count the blocks from the bottom up.'],
        hintProps: { focus: 0 },
        explain: [`Count the blocks: ${upTo(1, rv[0]).join(', ')}.`, `That makes ${rv[0]}.`],
      } : undefined,
    };
  },
};

export const readTable = {
  about: 'Read a simple table',
  levels: 3,
  make(level, R) {
    const th = R.pick(THEMES);
    const cats = pickCats(R, th, level <= 1 ? 3 : level === 2 ? 4 : 5);
    const n = cats.length;
    const values = level <= 2 ? vals(R, n, 1, 20) : vals(R, n, 10, 50);
    const i = R.int(0, n - 1);
    const props = chart('table', th, cats, values);
    const name = nameOf(cats[i]);
    if (level === 2) {
      return {
        lines: [th.which2(values[i])],
        widget: 'charts', props,
        input: 'choice',
        options: cats.map(c => ({ value: c.label, label: nameOf(c) })),
        answer: cats[i].label,
        hint: [`Look down the Number column for ${values[i]}.`, 'Then look along that row to its name.'],
        explain: [`${values[i]} is in the ${name} row.`, `So the answer is ${name}.`],
        reteach: readTable.make(1, R),
      };
    }
    return {
      lines: [th.howMany(cats[i])],
      widget: 'charts', props,
      input: 'numpad',
      answer: values[i],
      hint: [`Find the ${name} row. It is blue now.`, 'Read the number next to it.'],
      hintProps: { focus: i },
      explain: [`Find the ${name} row.`, `The number next to it is ${values[i]}.`],
    };
  },
};

// ---------- comparing, ordering and totalling ----------
// "Red 5, Blue 8 and Green 3." for an explanation.
const listOf = (cats, values) => {
  const parts = cats.map((c, i) => `${nameOf(c)} ${values[i]}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.` : `${parts[0]}.`;
};
// Picture help that does not give a number away, per chart kind.
const readHelp = (kind, idx) => (kind === 'tally' ? { gates: true, ...(idx !== undefined ? { focus: idx } : {}) }
  : kind === 'block' ? { guide: idx ?? 'all', ...(idx !== undefined ? { focus: idx } : {}) }
    : kind === 'pictogram' ? { focusKey: true, ...(idx !== undefined ? { focus: idx } : {}) }
      : idx !== undefined ? { focus: idx } : {});
const readLine = (kind, key) => (kind === 'tally' ? 'Each gate is 5.' : kind === 'block' ? 'Follow the dashed lines across to the numbers.' : kind === 'pictogram' && key > 1 ? `Each picture is ${key}.` : null);

export const mostLeast = {
  about: 'Which has the most or the fewest? Put the categories in order',
  levels: 3,
  make(level, R) {
    const th = R.pick(THEMES);
    const n = level <= 1 ? 3 : 4;
    const cats = pickCats(R, th, n);
    if (level >= 3) {
      const values = vals(R, n, 2, 20);
      const desc = R.chance(0.6);
      const order = cats.map((c, i) => ({ c, v: values[i] })).sort((a, b) => (desc ? b.v - a.v : a.v - b.v));
      return {
        lines: [desc ? 'Put them in order, most first.' : 'Put them in order, fewest first.'],
        widget: 'charts',
        props: chart('block', th, cats, values, { max: 20 }),
        input: 'order',
        options: R.shuffle(cats.map(c => ({ value: c.label, label: nameOf(c) }))),
        answer: order.map(o => o.c.label),
        hint: [desc ? 'Find the tallest column first.' : 'Find the shortest column first.', 'The dashed lines show how tall each one is.'],
        hintProps: { guide: 'all' },
        explain: [`${order.map(o => `${nameOf(o.c)} ${o.v}`).join(', ')}.`, desc ? 'From the tallest column to the shortest.' : 'From the shortest column to the tallest.'],
        reteach: mostLeast.make(1, R),
      };
    }
    const values = vals(R, n, level <= 1 ? 1 : 2, level <= 1 ? 12 : 16, level <= 1 ? 1 : 2);
    const most = level <= 1 ? true : R.chance(0.5);
    const w = most ? 'most' : 'fewest';
    const best = values.indexOf(most ? Math.max(...values) : Math.min(...values));
    const kind = level <= 1 ? 'tally' : R.pick(['pictogram', 'block']);
    return {
      lines: [th.most(w)],
      widget: 'charts',
      props: chart(kind, th, cats, values, kind === 'pictogram' ? { key: 2 } : kind === 'block' ? { max: 20 } : {}),
      input: 'choice',
      options: cats.map(c => ({ value: c.label, label: nameOf(c) })),
      answer: cats[best].label,
      hint: kind === 'tally' ? [`Which row is ${most ? 'longest' : 'shortest'}?`, 'Each gate is 5, so count the gates first.']
        : kind === 'block' ? [`Look for the ${most ? 'tallest' : 'shortest'} column.`, 'The dashed lines help you compare.']
          : [`Which row is ${most ? 'longest' : 'shortest'}?`, 'Every picture is worth the same.'],
      ...(kind === 'pictogram' ? {} : { hintProps: readHelp(kind) }),
      explain: [listOf(cats, values), `${nameOf(cats[best])} has the ${w}.`],
    };
  },
};

export const howManyMore = {
  about: 'How many more? Compare two categories',
  levels: 3,
  make(level, R) {
    const th = R.pick(THEMES);
    const n = level <= 1 ? 3 : 4;
    const cats = pickCats(R, th, n);
    let values, kind, extra = {};
    if (level <= 1) { values = vals(R, n, 1, 10); kind = R.pick(['tally', 'table']); }
    else if (level === 2) { values = vals(R, n, 2, 20); kind = 'block'; extra = { max: 20 }; }
    else { const key = R.pick([2, 5]); values = key === 2 ? vals(R, n, 2, 20, 2) : vals(R, n, 5, 40, 5); kind = 'pictogram'; extra = { key }; }
    const [ia, ib] = R.sample(cats.map((_, i) => i), 2).sort((x, y) => values[y] - values[x]);
    const a = values[ia], b = values[ib];
    const d = a - b;
    const rs = vals(R, 2, 1, 8).sort((x, y) => y - x);
    const A = nameOf(cats[ia]), B = nameOf(cats[ib]);
    const line = readLine(kind, extra.key);
    return {
      lines: [th.more(cats[ia], cats[ib])],
      widget: 'charts',
      props: chart(kind, th, cats, values, extra),
      input: 'numpad',
      answer: d,
      // Help: both rows (or columns) light up.
      hint: [`Find ${A} and ${B}: they are lit up now.`, ...(line ? [line] : []), 'Count on from the smaller number to the bigger one.'],
      hintProps: { ...readHelp(kind, [ia, ib]) },
      explain: [`${A} has ${a}. ${B} has ${b}.`, `Count on from ${b} to ${a}: that is ${d} more.`],
      ...(a <= 20 ? { fact: factKey('-', a, b) } : {}),
      reteach: level > 1 ? {
        lines: [th.more(cats[0], cats[1])],
        widget: 'charts', props: chart('table', th, cats.slice(0, 2), rs),
        input: 'numpad', answer: rs[0] - rs[1],
        hint: [`Count on from ${rs[1]} to ${rs[0]}.`, 'Use your fingers to keep track.'],
        explain: [`Count on from ${rs[1]}: ${upTo(rs[1] + 1, rs[0]).join(', ')}.`, `That is ${rs[0] - rs[1]} more.`],
        fact: factKey('-', rs[0], rs[1]),
      } : undefined,
    };
  },
};

export const totalAll = {
  about: 'How many altogether? Add up the categories',
  levels: 3,
  make(level, R) {
    const th = R.pick(THEMES);
    let n, values, kind, extra = {};
    if (level <= 1) { n = 2; values = vals(R, n, 1, 9); kind = R.pick(['tally', 'table']); }
    else if (level === 2) { n = 3; values = vals(R, n, 1, 10); kind = 'block'; extra = { max: 10 }; }
    else {
      n = R.pick([3, 4]); const key = R.pick([2, 5, 10]);
      values = key === 2 ? vals(R, n, 2, 12, 2) : key === 5 ? vals(R, n, 5, 25, 5) : vals(R, n, 10, 40, 10);
      kind = 'pictogram'; extra = { key };
    }
    const cats = pickCats(R, th, n);
    const sum = values.reduce((s, v) => s + v, 0);
    const rs = vals(R, 2, 1, 6);
    const line = readLine(kind, extra.key);
    return {
      lines: [th.total],
      widget: 'charts',
      props: chart(kind, th, cats, values, extra),
      input: 'numpad',
      answer: sum,
      hint: ['Find how many each one has.', ...(line ? [line] : []), 'Then add them all together.'],
      ...(Object.keys(readHelp(kind)).length ? { hintProps: readHelp(kind) } : {}),
      explain: [listOf(cats, values), `${values.join(' + ')} = ${sum}.`],
      ...(n === 2 && sum <= 20 ? { fact: factKey('+', values[0], values[1]) } : {}),
      reteach: level > 1 ? {
        lines: [th.total],
        widget: 'charts', props: chart('table', th, cats.slice(0, 2), rs),
        input: 'numpad', answer: rs[0] + rs[1],
        hint: ['Add the 2 numbers.', `Start at ${Math.max(...rs)} and count on ${Math.min(...rs)}.`],
        explain: [`${rs[0]} + ${rs[1]} = ${rs[0] + rs[1]}.`],
        fact: factKey('+', rs[0], rs[1]),
      } : undefined,
    };
  },
};

// ---------- building charts ----------
// Help for building: the target is drawn faintly (dashed boxes, faded pictures or grey tally marks) to build up to.
export const buildChart = {
  about: 'Build a block diagram, pictogram or tally chart to match the data',
  levels: 3,
  make(level, R) {
    const th = R.pick(THEMES);
    if (level <= 1) {
      const cats = pickCats(R, th, 3);
      const values = vals(R, 3, 1, 6);
      return {
        lines: ['Make the block diagram match the numbers.', 'Tap + to add a block.'],
        widget: 'charts',
        props: chart('block', th, cats, [0, 0, 0], { interactive: true, given: values, givenAs: 'number', max: 10, readonly: false }),
        input: 'widget',
        goal: { values },
        hint: ['The dashed boxes show how tall to go.', 'Tap + until each column fills its box.'],
        hintProps: { ghost: values },
        explain: [`${listOf(cats, values)}`, 'Each column now matches its number.'],
      };
    }
    if (level === 2) {
      const cats = pickCats(R, th, 4);
      const values = vals(R, 4, 1, 10);
      return {
        lines: ['Make the block diagram match the tally.'],
        widget: 'charts',
        props: chart('block', th, cats, [0, 0, 0, 0], { interactive: true, given: values, givenAs: 'tally', max: 10, readonly: false }),
        input: 'widget',
        goal: { values },
        hint: ['Count each tally first.', 'The dashed boxes show how tall each column goes.'],
        hintProps: { ghost: values },
        explain: [`${listOf(cats, values)}`, 'Each column now matches its tally.'],
        reteach: buildChart.make(1, R),
      };
    }
    const cats = pickCats(R, th, 3);
    if (R.chance(0.5)) {
      const values = vals(R, 3, 2, 12, 2);
      return {
        lines: ['Make the pictogram match the numbers.', 'Each picture stands for 2.'],
        widget: 'charts',
        props: chart('pictogram', th, cats, [0, 0, 0], { key: 2, interactive: true, given: values, givenAs: 'number', readonly: false }),
        input: 'widget',
        goal: { values },
        hint: ['The faded pictures show how many to add.', 'Each tap adds 1 picture, which is 2.'],
        hintProps: { ghost: values },
        explain: [`${listOf(cats, values)}`, `Count in 2s: ${values[0]} is ${values[0] / 2} ${plural(values[0] / 2, 'picture', 'pictures')}.`],
        reteach: buildChart.make(1, R),
      };
    }
    const values = vals(R, 3, 3, 15);
    return {
      lines: ['Make a tally chart for these numbers.', 'Tap + to add a mark.'],
      widget: 'charts',
      props: chart('tally', th, cats, [0, 0, 0], { interactive: true, given: values, givenAs: 'number', readonly: false }),
      input: 'widget',
      goal: { values },
      hint: ['Tap + to draw over the grey marks.', 'Every fifth mark goes across the other 4.'],
      hintProps: { ghost: values },
      explain: [`${listOf(cats, values)}`, 'A gate for every 5, then single lines.'],
      reteach: buildChart.make(1, R),
    };
  },
};
