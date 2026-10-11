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
    id: 'visitors', title: 'Visitors to the Moon base', which: 'Visitor', symbol: 'star',
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
    id: 'places', title: 'Where shall we fly next?', which: 'Place', symbol: 'star',
    cats: [{ label: 'Moon', icon: 'moon', the: 'the Moon' }, { label: 'Mars', icon: 'planet', the: 'Mars' }, { label: 'Sun', icon: 'sun', the: 'the Sun' }, { label: 'Comet', icon: 'comet', the: 'the comet' }],
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
    ...(kind === 'pictogram' ? { icon: th.symbol, key: 1 } : {}),
    ...(kind === 'table' ? { heads: [th.which, 'Number'] } : {}),
    readonly: true,
    ...extra,
  };
}
const plural = (n, one, many) => (n === 1 ? one : many);

function tallyExplain(v) {
  const g = Math.floor(v / 5), r = v % 5;
  if (g === 0) return [`There are ${v} single ${plural(v, 'mark', 'marks')}.`];
  if (r === 0) return [`${g} ${plural(g, 'group', 'groups')} of 5 make ${v}.`];
  return [`${g} ${plural(g, 'group', 'groups')} of 5 make ${g * 5}.`, `${g * 5} and ${r} more is ${v}.`];
}
const TALLY_HINT = ['Each gate of 5 has 4 lines and 1 across.', 'Count the gates in 5s, then the ones.'];

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
      hint: TALLY_HINT,
      explain: tallyExplain(values[i]),
      reteach: {
        lines: [th.howMany(cats[0]), 'Count the gate in 5, then the ones.'],
        widget: 'charts',
        props: chart('tally', th, [cats[0]], [small]),
        input: 'numpad', answer: small,
        hint: TALLY_HINT,
        explain: tallyExplain(small),
      },
    };
  },
};

function pictoExplain(v, key) {
  if (key === 1) return [`There are ${v} pictures.`];
  const full = Math.floor(v / key), rest = v % key;
  const lines = [];
  if (key === 2) lines.push(`${full} ${plural(full, 'picture', 'pictures')} of 2 make ${full * 2}.`);
  else lines.push(`Count in ${key}s: ${Array.from({ length: full }, (_, k) => (k + 1) * key).join(', ')}.`);
  if (rest) lines.push(`Half a picture is ${rest}. So ${v}.`);
  return lines;
}

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
      hint: key === 1 ? ['Count the pictures in that row.'] : ['Look at the key first.', `Each picture stands for ${key}.`],
      explain: pictoExplain(values[i], key),
      reteach: level > 1 ? {
        lines: [th.howMany(cats[0]), 'Each picture stands for 1.'],
        widget: 'charts', props: chart('pictogram', th, cats.slice(0, 3), rv, { key: 1 }),
        input: 'numpad', answer: rv[0],
        hint: ['Count the pictures in that row.'],
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
    const explain = level >= 3 && v % 2 === 1
      ? [`It stops halfway between ${v - 1} and ${v + 1}.`, `So it is ${v}.`]
      : [`The ${nameOf(cats[i])} column reaches ${v}.`];
    const rv = vals(R, 3, 1, 9);
    return {
      lines: [th.howMany(cats[i])],
      widget: 'charts',
      props: chart('block', th, cats, values, { max }),
      input: 'numpad',
      answer: v,
      hint: ['Look at the top of the column.', 'Read across to the numbers.'],
      explain,
      reteach: level > 1 ? {
        lines: [th.howMany(cats[0]), 'Count the blocks.'],
        widget: 'charts', props: chart('block', th, cats.slice(0, 3), rv, { max: 10 }),
        input: 'numpad', answer: rv[0],
        hint: ['Count the blocks one at a time.'],
        explain: [`There are ${rv[0]} blocks.`],
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
    if (level === 2) {
      return {
        lines: [th.which2(values[i])],
        widget: 'charts', props,
        input: 'choice',
        options: cats.map(c => ({ value: c.label, label: nameOf(c) })),
        answer: cats[i].label,
        hint: ['Look down the Number column.', `Find ${values[i]}, then look along the row.`],
        explain: [`${nameOf(cats[i])} has ${values[i]}.`],
        reteach: readTable.make(1, R),
      };
    }
    return {
      lines: [th.howMany(cats[i])],
      widget: 'charts', props,
      input: 'numpad',
      answer: values[i],
      hint: ['Find the row first.', 'Then read the number next to it.'],
      explain: [`${nameOf(cats[i])} has ${values[i]}.`],
    };
  },
};

// ---------- comparing, ordering and totalling ----------
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
        hint: [desc ? 'Find the tallest column first.' : 'Find the shortest column first.', 'Then the next one.'],
        explain: [order.map(o => `${o.c.label} ${o.v}`).join(', ') + '.'],
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
      hint: kind === 'tally' ? [`Which row has the ${most ? 'most' : 'fewest'} marks?`] : kind === 'block' ? [`Look for the ${most ? 'tallest' : 'shortest'} column.`] : [`Which row has the ${most ? 'most' : 'fewest'} pictures?`],
      explain: [`${nameOf(cats[best])} has ${values[best]}.`, `That is the ${w}.`],
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
    return {
      lines: [th.more(cats[ia], cats[ib])],
      widget: 'charts',
      props: chart(kind, th, cats, values, extra),
      input: 'numpad',
      answer: d,
      hint: ['Find both numbers first.', 'Then count on from the smaller one.'],
      explain: [`${nameOf(cats[ia])} has ${a}. ${nameOf(cats[ib])} has ${b}.`, `${a} take away ${b} is ${d}.`],
      ...(a <= 20 ? { fact: factKey('-', a, b) } : {}),
      reteach: level > 1 ? {
        lines: [th.more(cats[0], cats[1])],
        widget: 'charts', props: chart('table', th, cats.slice(0, 2), rs),
        input: 'numpad', answer: rs[0] - rs[1],
        hint: ['Count on from the smaller number.'],
        explain: [`${rs[0]} take away ${rs[1]} is ${rs[0] - rs[1]}.`],
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
    return {
      lines: [th.total],
      widget: 'charts',
      props: chart(kind, th, cats, values, extra),
      input: 'numpad',
      answer: sum,
      hint: ['Find each number first.', 'Then add them together.'],
      explain: [`${values.join(' + ')} = ${sum}.`],
      ...(n === 2 && sum <= 20 ? { fact: factKey('+', values[0], values[1]) } : {}),
      reteach: level > 1 ? {
        lines: [th.total],
        widget: 'charts', props: chart('table', th, cats.slice(0, 2), rs),
        input: 'numpad', answer: rs[0] + rs[1],
        hint: ['Add the 2 numbers.'],
        explain: [`${rs[0]} + ${rs[1]} = ${rs[0] + rs[1]}.`],
        fact: factKey('+', rs[0], rs[1]),
      } : undefined,
    };
  },
};

// ---------- building charts ----------
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
        hint: ['Do one column at a time.', 'Count the blocks as you add them.'],
        explain: ['Each column now matches its number.'],
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
        hint: ['Count each tally first.', 'Then add that many blocks.'],
        explain: ['Each column now matches its tally.'],
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
        hint: ['Each tap adds 1 picture, which is 2.', 'Count in 2s as you tap.'],
        explain: ['Each row now matches its number.'],
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
      hint: ['Every fifth mark goes across the other 4.', 'Count in 5s, then the ones.'],
      explain: ['Each row now matches its number.'],
      reteach: buildChart.make(1, R),
    };
  },
};
