// Multiplication and division generators (Array Blaster sector). See ENGINE.md section 4.
// Every make(level, R, params) returns one item. Level 1 is gentle (pictures, choice, small numbers);
// level 3 is genuinely Year 2 hard (abstract, missing numbers, bigger facts).
// Common params: tables (array of 2, 5, 10), icon (art name).
// Debug: dev/gen.html?gen=muldiv&all=1   or   dev/gen.html?gen=muldiv.times5&level=3&n=20
import { factKey } from '../core/facts.js';
const rowsOf = n => (n === 1 ? '1 row' : `${n} rows`);
const pairsOf = n => (n === 1 ? '1 pair' : `${n} pairs`);

// ---------- helpers ----------
const TABLES = [2, 5, 10];
const WORD = { 2: 'twos', 5: 'fives', 10: 'tens' };

// Space contexts for equal groups. icon draws the item.
const GROUPS = [
  { g: 'bags', g1: 'bag', item: 'moon rocks', icon: 'asteroid', where: 'in each bag' },
  { g: 'boxes', g1: 'box', item: 'fuel cans', icon: 'fuel', where: 'in each box' },
  { g: 'trays', g1: 'tray', item: 'crystals', icon: 'crystal', where: 'on each tray' },
  { g: 'packs', g1: 'pack', item: 'star stickers', icon: 'star', where: 'in each pack' },
  { g: 'tins', g1: 'tin', item: 'space biscuits', icon: 'cookie', where: 'in each tin' },
  { g: 'pods', g1: 'pod', item: 'astronauts', icon: 'astronaut', where: 'in each pod' },
];
const SHARERS = ['astronauts', 'robots', 'aliens', 'pilots'];
const SHARE_ITEMS = [
  { item: 'crystals', icon: 'crystal' }, { item: 'moon rocks', icon: 'asteroid' }, { item: 'space biscuits', icon: 'cookie' },
  { item: 'fuel cans', icon: 'fuel' }, { item: 'apples', icon: 'apple' }, { item: 'stars', icon: 'star' },
];

const tablesFrom = (params, fallback = TABLES) => {
  const t = Array.isArray(params?.tables) ? params.tables.filter(v => [2, 3, 4, 5, 10].includes(+v)).map(Number) : [];
  return t.length ? t : fallback;
};

// Three (or n) distinct whole-number options including ans, shuffled.
function opts(R, ans, cands, n = 3) {
  const out = [ans];
  for (const c of R.shuffle(cands)) {
    if (out.length >= n) break;
    if (Number.isInteger(c) && c >= 0 && !out.includes(c)) out.push(c);
  }
  let d = 1;
  while (out.length < n) {
    for (const c of [ans + d, ans - d]) if (out.length < n && c >= 0 && !out.includes(c)) out.push(c);
    d++;
  }
  return R.shuffle(out);
}

// Pick a number of groups g and a group size s with g !== avoid.
const pickNot = (R, a, b, avoid) => { let v; let k = 0; do { v = R.int(a, b); k++; } while (v === avoid && k < 20); return v; };

const objGroups = (g, s, icon = 'dot') => ({ widget: 'objects', props: { n: g * s, arrange: 'groups', groups: Array(g).fill(s), icon } });
const blasterPic = (rows, size, extra = {}) => ({ widget: 'blaster', props: { size, rows, readonly: true, bar: false, highlightRows: true, ...extra } });
// The groups widget holds at most 50 things. Bigger totals get a still picture instead, so the hint never shows wrong numbers.
const GROUPS_MAX = 50;
// icon: draw the things the words name (crystals, biscuits); plain dots when the words just say numbers.
const shareHint = (b, e, icon = 'dot') => (b * e <= GROUPS_MAX
  ? { widget: 'groups', props: { total: b * e, mode: 'share', bowls: b, icon, interactive: true } }
  : objGroups(b, e, icon));
const groupHint = (k, gs, icon = 'dot') => (k * gs <= GROUPS_MAX
  ? { widget: 'groups', props: { total: k * gs, mode: 'group', groupSize: gs, icon, interactive: true } }
  : blasterPic(k, gs));
const skip = (s, g) => Array.from({ length: g }, (_, i) => (i + 1) * s).join(', ');
const repeated = (s, g) => Array(g).fill(s).join(' + ');
// Running totals with the last one left as "?", for a hint that starts the count but leaves the answer to Finn.
const partial = (s, g) => Array.from({ length: g }, (_, i) => (i === g - 1 ? '?' : String((i + 1) * s)));
// The same groups, each in its own colour (red, yellow, blue, green), so each group reads as one lot.
const colourGroups = (g, s) => Array(g).fill(s);
// Empty labels reserve the room under each group, so the picture does not jump when a hint fills them in.
const blankLabels = g => Array(g).fill('');
const objGroupsLabelled = (g, s, icon = 'dot', labels = partial(s, g)) => ({ widget: 'objects', props: { n: g * s, arrange: 'groups', groups: Array(g).fill(s), icon, groupLabels: labels } });
// The DfE sentence stems for equal groups (2MD-1).
// A 100 square with the shown numbers lit up (yellow), so the pattern of the count is easy to see.
const squareHint = shown => {
  const lo = Math.min(...shown), hi = Math.max(...shown);
  const start = lo === 0 ? 0 : 1;
  const rows = Math.min(10, start === 0 ? Math.floor(hi / 10) + 2 : Math.ceil(hi / 10) + 1);
  return { widget: 'hundred', props: { start, rows, highlight: shown, readonly: true } };
};
const stems = (g, s) => [`There are ${g} equal groups. There are ${s} in each group.`, `${g} groups of ${s} is ${g * s}.`];

// ---------- multiplication ----------
export const equalGroups = {
  about: 'Equal groups: count them, add them, then write the multiplication',
  levels: 3,
  make(level, R, params = {}) {
    const tabs = tablesFrom(params);
    const c = R.pick(GROUPS);
    if (level <= 1) {
      const s = R.pick(tabs.filter(t => t <= 5).length ? tabs.filter(t => t <= 5) : [2, 5]);
      const g = R.int(2, s === 5 ? 3 : 4);
      const t = g * s;
      return {
        lines: [`${g} ${c.g}. ${s} ${c.item} ${c.where}.`, 'How many altogether?'],
        ...objGroupsLabelled(g, s, c.icon, blankLabels(g)),
        input: 'choice', answer: t, options: opts(R, t, [g + s, t - s, t + s, t + 1]),
        hint: [`Count in ${s}s. Touch each ${c.g1}.`, 'The numbers start the count for you.'],
        hintProps: { groupLabels: partial(s, g) },
        explain: [...stems(g, s), `Count in ${s}s: ${skip(s, g)}.`],
        reteach: small(R, 2, 2, c),
      };
    }
    if (level === 2) {
      const s = R.pick(tabs);
      const g = pickNot(R, 2, s === 10 ? 4 : 5, s);
      const t = g * s;
      return {
        lines: [`There are ${g} equal groups.`, `There are ${s} in each group.`, 'How many altogether?'],
        // A long sum would wrap beside the number pad; then the caption says it in words.
        caption: `${repeated(s, g)} = ?`.length <= 18 ? `${repeated(s, g)} = ?` : `${g} groups of ${s} = ?`,
        ...objGroupsLabelled(g, s, 'dot', blankLabels(g)),
        input: 'numpad', answer: t,
        hint: [`Count in ${s}s, one group at a time.`, 'What goes where the ? is?'],
        hintProps: { groupLabels: partial(s, g) },
        explain: [...stems(g, s), `${repeated(s, g)} = ${t}.`],
        fact: factKey('x', g, s),
        reteach: small(R, 2, s, c),
      };
    }
    const s = R.pick(tabs);
    const g = pickNot(R, 3, 10, s);
    const t = g * s;
    return {
      lines: [`${g} ${c.g}. ${s} ${c.item} ${c.where}.`, 'Write the total.'],
      caption: `${g} × ${s} = ?`,
      input: 'numpad', answer: t,
      hint: [`The ${g} is the number of groups.`, `Count in ${s}s, one group at a time.`],
      hintWidget: objGroupsLabelled(g, s, c.icon),
      explain: [...stems(g, s), `${g} × ${s} = ${t}. There are ${t} ${c.item}.`],
      fact: factKey('x', g, s),
      reteach: small(R, 3, s, c),
    };
  },
};

// A small picture-and-count item used as a re-teach.
function small(R, g, s, c = R.pick(GROUPS)) {
  const t = g * s;
  return {
    lines: [`${g} groups of ${s}.`, 'Count them all.'],
    ...objGroupsLabelled(g, s, 'dot', blankLabels(g)),
    input: 'choice', answer: t, options: opts(R, t, [t + 1, t - 1, g + s]),
    hint: [`Count in ${s}s.`], hintProps: { groupLabels: partial(s, g) },
    explain: [`Count in ${s}s: ${skip(s, g)}.`, `${g} groups of ${s} is ${t}.`],
  };
}

export const arrays = {
  about: 'Read an array of blasted dots: rows of equal size',
  levels: 3,
  make(level, R, params = {}) {
    const tabs = tablesFrom(params);
    if (level <= 1) {
      const s = R.pick([2, 5, ...(tabs.includes(10) ? [10] : [])]);
      const r = pickNot(R, 2, s === 10 ? 2 : 4, s);
      const t = r * s;
      return {
        lines: [`${rowsOf(r)} of ${s}.`, 'How many dots?'],
        ...blasterPic(r, s),
        input: 'choice', answer: t, options: opts(R, t, [r + s, t + s, t - s]),
        hint: [`Count in ${s}s, one row at a time.`, 'The numbers start the count for you.'],
        hintProps: { rowLabels: partial(s, r) },
        explain: [`There are ${rowsOf(r)}. There are ${s} in each row.`, `Count in ${s}s: ${skip(s, r)}.`, `${rowsOf(r)} of ${s} is ${t}.`],
        reteach: { lines: [`2 rows of ${s}.`, 'How many dots?'], ...blasterPic(2, s), input: 'choice', answer: 2 * s, options: opts(R, 2 * s, [s, 2 * s + 1, s + 2]), hint: ['Count the first row.', 'The second row is the same.'], hintProps: { rowLabels: [String(s), '?'] }, explain: [`${s} and ${s} make ${2 * s}.`] },
      };
    }
    if (level === 2) {
      const s = R.pick(tabs);
      const r = pickNot(R, 2, 6, s);
      const t = r * s;
      return {
        lines: [`Each row has ${s} dots.`, `How many dots in ${r} rows?`],
        ...blasterPic(r, s),
        input: 'numpad', answer: t,
        hint: [`Count in ${s}s down the rows.`, 'What goes where the ? is?'],
        hintProps: { rowLabels: partial(s, r) },
        explain: [`There are ${rowsOf(r)} of ${s}.`, `Count in ${s}s: ${skip(s, r)}.`, `${r} × ${s} = ${t}.`],
        fact: factKey('x', r, s),
        reteach: arrays.make(1, R, params),
      };
    }
    const s = R.pick(tabs);
    const r = pickNot(R, 3, 8, s);
    const t = r * s;
    const right = `${r} × ${s} = ${t}`;
    return {
      lines: ['Which number sentence matches the array?'],
      ...blasterPic(r, s),
      input: 'choice', answer: right,
      options: R.shuffle([right, `${r} + ${s} = ${r + s}`, `${r} × ${s} = ${t + s}`]),
      hint: ['Count the rows.', 'Then count the dots in one row.'],
      explain: [`There are ${rowsOf(r)}. There are ${s} in each row.`, `${rowsOf(r)} of ${s} is ${t}, so ${right}.`],
      fact: factKey('x', r, s),
      reteach: arrays.make(2, R, params),
    };
  },
};

export const repeatedAddition = {
  about: 'Repeated addition is multiplication: 5 + 5 + 5 = 3 × 5',
  levels: 3,
  make(level, R, params = {}) {
    const tabs = tablesFrom(params);
    const s = R.pick(tabs);
    if (level <= 1) {
      const g = pickNot(R, 2, 4, s);
      return {
        lines: [`How many ${s}s are added?`],
        caption: repeated(s, g),
        ...objGroups(g, s, 'dot'),
        input: 'choice', answer: g, options: opts(R, g, [g + 1, g - 1, s]),
        hint: [`Each colour is one group of ${s}.`, 'Count the colours.'],
        hintProps: { colours: colourGroups(g, s) },
        explain: [`There are ${g} groups of ${s}.`, `${repeated(s, g)} is ${g} lots of ${s}.`],
      };
    }
    if (level === 2) {
      const g = pickNot(R, 2, 5, s);
      return {
        lines: [`Adding ${s} again and again is multiplying.`, `How many ${s}s?`],
        caption: `${repeated(s, g)} = ? × ${s}`,
        input: 'numpad', answer: g,
        hint: [`Count how many ${s}s are added.`, `Each colour is one ${s}.`],
        hintWidget: { widget: 'objects', props: { ...objGroups(g, s, 'dot').props, colours: colourGroups(g, s) } },
        explain: [`There are ${g} ${WORD[s] || s + 's'}.`, `${repeated(s, g)} = ${g} × ${s}.`],
        reteach: repeatedAddition.make(1, R, params),
      };
    }
    const g = pickNot(R, 3, 6, s);
    const right = repeated(s, g);
    return {
      lines: [`Which addition is the same as ${g} × ${s}?`],
      input: 'choice', answer: right,
      options: R.shuffle([right, `${g} + ${s}`, repeated(s, g - 1)]),
      hint: [`${g} × ${s} means ${g} groups of ${s}.`, `Look for ${g} lots of ${s}.`],
      hintWidget: { widget: 'objects', props: { ...objGroups(g, s, 'dot').props, colours: colourGroups(g, s) } },
      explain: [`${g} × ${s} is ${g} groups of ${s}.`, `${right} = ${g * s}.`],
      fact: factKey('x', g, s),
      reteach: repeatedAddition.make(2, R, params),
    };
  },
};

// The 2, 5 and 10 times tables share one maker.
function tableGen(t) {
  return {
    about: `The ${t} times table: picture, then facts, then missing numbers`,
    levels: 3,
    make(level, R, params = {}) {
      if (level <= 1) {
        const g = pickNot(R, 2, 5, t);
        const p = g * t;
        return {
          lines: [`${rowsOf(g)} of ${t}.`, 'How many dots?'],
          caption: `${g} × ${t} = ?`,
          ...blasterPic(g, t),
          input: 'choice', answer: p, options: opts(R, p, [p + t, p - t, g + t]),
          hint: [`Count in ${t}s, one row at a time.`, 'The numbers start the count for you.'],
          hintProps: { rowLabels: partial(t, g) },
          explain: [`There ${g === 1 ? 'is 1 row' : `are ${g} rows`} of ${t}.`, `Count in ${t}s: ${skip(t, g)}.`, `${g} × ${t} = ${p}.`],
          fact: factKey('x', g, t),
        };
      }
      if (level === 2) {
        const g = R.int(2, 10);
        const p = g * t;
        const swap = R.chance(0.4);
        return {
          lines: [R.pick(['Quick fire!', 'Use your times table.', 'You know this one.'])],
          caption: swap ? `${t} × ${g} = ?` : `${g} × ${t} = ?`,
          input: 'numpad', answer: p,
          hint: [`Count in ${t}s, ${g} times.`, 'One row for each jump.'],
          hintWidget: blasterPic(g, t, { rowLabels: partial(t, g) }),
          explain: [`${g} groups of ${t}.`, `Count in ${t}s: ${skip(t, g)}.`, `${g} × ${t} = ${p}.`],
          fact: factKey('x', g, t),
          reteach: tableGen(t).make(1, R, params),
        };
      }
      const g = pickNot(R, 2, 10, t);
      const p = g * t;
      return {
        lines: ['Find the missing number.'],
        caption: R.chance(0.5) ? `? × ${t} = ${p}` : `${t} × ? = ${p}`,
        input: 'numpad', answer: g,
        hint: [`Count in ${t}s until you reach ${p}.`, 'Count the rows.'],
        hintWidget: blasterPic(g, t, { rowLabels: true }),
        explain: [`Count in ${t}s: ${skip(t, g)}. That is ${g} jumps.`, `${g} × ${t} = ${p}, so the missing number is ${g}.`],
        fact: factKey('x', g, t),
        reteach: { lines: ['Count the rows.'], caption: `? × ${t} = ${Math.min(g, 3) * t}`, ...blasterPic(Math.min(g, 3), t), input: 'choice', answer: Math.min(g, 3), options: opts(R, Math.min(g, 3), [t, Math.min(g, 3) + 1, Math.min(g, 3) - 1].filter(v => v !== t)), hint: [`Count in ${t}s.`, 'Count the rows.'], hintProps: { rowLabels: true }, explain: [`Count in ${t}s: ${skip(t, Math.min(g, 3))}.`, `That is ${Math.min(g, 3)} rows.`] },
      };
    },
  };
}
// Written out in full so tools/check_content.py can read each one's levels.
export const times2 = { about: 'The 2 times table: picture, then facts, then missing numbers', levels: 3, make: (level, R, params) => tableGen(2).make(level, R, params) };
export const times5 = { about: 'The 5 times table: picture, then facts, then missing numbers', levels: 3, make: (level, R, params) => tableGen(5).make(level, R, params) };
export const times10 = { about: 'The 10 times table: picture, then facts, then missing numbers', levels: 3, make: (level, R, params) => tableGen(10).make(level, R, params) };

export const mixedTables = {
  about: 'Mixed facts from the 2, 5 and 10 times tables, with division at level 3',
  levels: 3,
  make(level, R, params = {}) {
    const tabs = tablesFrom(params);
    if (level <= 1) {
      const t = R.pick(tabs.filter(v => v !== 5).length ? tabs.filter(v => v !== 5) : tabs);
      const g = R.int(1, 5);
      const p = g * t;
      return {
        lines: ['Pick the answer.'], caption: `${g} × ${t} = ?`,
        input: 'choice', answer: p, options: opts(R, p, [p + t, p - t, g + t]),
        hint: [`Count in ${t}s, ${g} times.`], hintWidget: blasterPic(g, t, { rowLabels: partial(t, g) }),
        explain: [`${g} groups of ${t}.`, `Count in ${t}s: ${skip(t, g)}.`, `${g} × ${t} = ${p}.`], fact: factKey('x', g, t),
      };
    }
    const t = R.pick(tabs);
    const g = R.int(2, 10);
    const p = g * t;
    if (level === 2) {
      return {
        lines: [R.pick(['Quick fire!', 'What is the answer?'])], caption: R.chance(0.5) ? `${g} × ${t} = ?` : `${t} × ${g} = ?`,
        input: 'numpad', answer: p, hint: [`Count in ${t}s, ${g} times.`], hintWidget: blasterPic(g, t, { rowLabels: partial(t, g) }),
        explain: [`${g} groups of ${t}.`, `Count in ${t}s: ${skip(t, g)}.`, `${g} × ${t} = ${p}.`], fact: factKey('x', g, t), reteach: mixedTables.make(1, R, params),
      };
    }
    const kind = R.pick(['div', 'div', 'miss']);
    if (kind === 'div' && g !== t) {
      return {
        lines: ['Use a times table fact.'], caption: `${p} ÷ ${t} = ?`,
        input: 'numpad', answer: g, hint: [`How many ${t}s make ${p}?`, 'Count the rows.'], hintWidget: blasterPic(g, t, { rowLabels: true }),
        explain: [`${p} divided into groups of ${t} is equal to ${g}.`, `${g} × ${t} = ${p}, so ${p} ÷ ${t} = ${g}.`], fact: factKey('÷', p, t),
        reteach: mixedTables.make(2, R, params),
      };
    }
    const gg = g === t ? (g === 10 ? 9 : g + 1) : g;
    return {
      lines: ['Find the missing number.'], caption: `? × ${t} = ${gg * t}`,
      input: 'numpad', answer: gg, hint: [`Count in ${t}s to ${gg * t}.`, 'Count the rows.'], hintWidget: blasterPic(gg, t, { rowLabels: true }),
      explain: [`Count in ${t}s: ${skip(t, gg)}. That is ${gg} jumps.`, `${gg} × ${t} = ${gg * t}.`], fact: factKey('x', gg, t), reteach: mixedTables.make(2, R, params),
    };
  },
};

export const commutative = {
  about: 'Multiplication can be done in any order; division cannot',
  levels: 3,
  make(level, R, params = {}) {
    const tabs = tablesFrom(params);
    const s = R.pick(tabs);
    const r = pickNot(R, 2, 6, s);
    if (level <= 1) {
      if (R.chance(0.6)) {
        return {
          lines: [`Is ${r} × ${s} the same as ${s} × ${r}?`],
          ...blasterPic(r, s, { flipButton: true }),
          input: 'choice', answer: 'Yes', options: ['Yes', 'No'],
          hint: ['Tap Flip to turn the array round.', 'Are there more dots now?'],
          hintProps: { interactive: true, readonly: false, flipButton: true, bar: true, lockSize: true },
          explain: [`${rowsOf(r)} of ${s} turns into ${rowsOf(s)} of ${r}.`, `No dots come or go. Both make ${r * s}.`],
        };
      }
      const big = r * s;
      return {
        lines: [`${big} biscuits shared by ${s} robots.`, `Is ${big} ÷ ${s} the same as ${s} ÷ ${big}?`],
        caption: `${big} ÷ ${s}   or   ${s} ÷ ${big}`,
        ...(big <= GROUPS_MAX ? { widget: 'groups', props: { total: big, mode: 'share', bowls: s, icon: 'cookie', readonly: true } } : {}),
        input: 'choice', answer: 'No', options: ['Yes', 'No'],
        hint: [big <= GROUPS_MAX ? 'Tap Deal one each to share them out.' : `Picture ${big} biscuits shared by ${s} robots.`, `Could ${s} biscuits go round ${big} robots?`],
        ...(big <= GROUPS_MAX ? { hintProps: { interactive: true, readonly: false } } : { hintWidget: blasterPic(r, s) }),
        explain: [`${big} shared between ${s} is ${r} each.`, `${s} shared between ${big} is not even 1 each.`],
      };
    }
    if (level === 2) {
      // Which array has the same number of dots? Small dot pictures as options.
      const rr = Math.min(r, 5), ss = Math.min(s, 5) === rr ? (rr === 5 ? 4 : rr + 1) : Math.min(s, 5);
      const pic = (rows, per) => ({ widget: 'objects', props: { n: rows * per, arrange: 'rows', perRow: per, icon: 'dot', readonly: true } });
      return {
        lines: [`${rowsOf(rr)} of ${ss}.`, 'Which array has the same number of dots?'],
        ...pic(rr, ss),
        input: 'choice', answer: 'flip',
        options: R.shuffle([
          { label: `${rowsOf(ss)} of ${rr}`, value: 'flip', ...pic(ss, rr) },
          { label: `${rowsOf(ss)} of ${rr + 1}`, value: 'more', ...pic(ss, rr + 1) },
          { label: `${rowsOf(rr)} of ${ss - 1}`, value: 'less', ...pic(rr, ss - 1) },
        ]),
        hint: ['Turn the array a quarter turn in your head.', 'The rows become the columns.'],
        explain: [`${rowsOf(rr)} of ${ss} turns into ${rowsOf(ss)} of ${rr}.`, `${rr} × ${ss} = ${ss} × ${rr} = ${rr * ss}.`],
        reteach: commutative.make(1, R, params),
      };
    }
    if (R.chance(0.5)) {
      const right = `${s} × ${r}`;
      return {
        lines: [`Which one is the same as ${r} × ${s}?`],
        input: 'choice', answer: right, options: R.shuffle([right, `${r} + ${s}`, `${r * s} ÷ ${s}`]),
        hint: ['Multiplying can be done in any order.', 'Tap Flip to see it.'],
        hintWidget: blasterPic(r, s, { flipButton: true, interactive: true, readonly: false, bar: true, lockSize: true }),
        explain: [`${rowsOf(r)} of ${s} flips to ${rowsOf(s)} of ${r}.`, `${r} × ${s} = ${s} × ${r} = ${r * s}.`],
        fact: factKey('x', r, s),
      };
    }
    const right = `${s} × ${r} = ${r} × ${s}`;
    return {
      lines: ['Which one is true?'],
      input: 'choice', answer: right,
      options: R.shuffle([right, `${r * s} ÷ ${s} = ${s} ÷ ${r * s}`, `${r + s} − ${s} = ${s} − ${r + s}`]),
      hint: ['Only one kind of sum works in any order here.', 'Try each one with small numbers.'],
      explain: ['Multiplying works in any order.', 'Dividing and taking away do not.'],
      reteach: commutative.make(2, R, params),
    };
  },
};

export const oddEven = {
  about: 'Odd and even: pair the dots, then use the last digit',
  levels: 3,
  make(level, R) {
    if (level <= 1) {
      const n = R.int(3, 12);
      const pairs = Math.floor(n / 2);
      const ans = n % 2 ? 'Odd' : 'Even';
      // The dots start in a line (or scattered); the hint pairs them up.
      return {
        lines: ['Can every dot have a partner?', `Is ${n} odd or even?`],
        widget: 'objects', props: { n, arrange: n <= 10 ? 'row' : 'scatter', icon: 'dot' },
        input: 'choice', answer: ans, options: ['Odd', 'Even'],
        hint: ['Look: the dots are in pairs now.', 'Is there a dot with no partner?'],
        hintProps: { arrange: 'groups', groups: [...Array(pairs).fill(2), ...(n % 2 ? [1] : [])] },
        explain: n % 2 ? [`${n} makes ${pairsOf(pairs)} and 1 left over.`, `${n} is odd.`] : [`${n} makes ${pairsOf(pairs)}. Every dot has a partner.`, `${n} is even.`],
      };
    }
    if (level === 2) {
      const n = R.int(11, 50);
      const ans = n % 2 ? 'Odd' : 'Even';
      return {
        lines: ['Is this number odd or even?'], caption: String(n),
        input: 'choice', answer: ans, options: ['Odd', 'Even'],
        hint: n % 10 ? ['Only the ones digit matters.', `Can ${n % 10} dots all have partners?`] : ['Look at the ones digit.', 'Can 10 dots all have partners?'],
        hintWidget: { widget: 'objects', props: { n: n % 10 || 10, arrange: 'groups', groups: [...Array(Math.floor((n % 10 || 10) / 2)).fill(2), ...((n % 10) % 2 ? [1] : [])], icon: 'dot' } },
        explain: [`${n} ends in ${n % 10}.`, `Numbers ending in ${n % 2 ? '1, 3, 5, 7 or 9' : '0, 2, 4, 6 or 8'} are ${ans.toLowerCase()}.`],
        reteach: oddEven.make(1, R),
      };
    }
    const wantEven = R.chance(0.5);
    const pick = even => { let v; do { v = R.int(21, 99); } while ((v % 2 === 0) !== even); return v; };
    const ans = pick(wantEven);
    const others = [];
    while (others.length < 2) { const v = pick(!wantEven); if (!others.includes(v) && v !== ans) others.push(v); }
    return {
      lines: [`Which number is ${wantEven ? 'even' : 'odd'}?`],
      input: 'choice', answer: ans, options: R.shuffle([ans, ...others]),
      hint: ['Look at the last digit of each number.', wantEven ? 'Even numbers end in 0, 2, 4, 6 or 8.' : 'Odd numbers end in 1, 3, 5, 7 or 9.'],
      explain: [`${ans} ends in ${ans % 10}.`, `So ${ans} is ${wantEven ? 'even' : 'odd'}.`],
      reteach: oddEven.make(2, R),
    };
  },
};

// ---------- division ----------
export const sharing = {
  about: 'Share equally into groups: how many does each get?',
  levels: 3,
  make(level, R, params = {}) {
    const c = R.pick(SHARE_ITEMS);
    const who = R.pick(SHARERS);
    if (level <= 1) {
      const b = R.int(2, 4);
      const e = pickNot(R, 2, 5, b);
      const total = b * e;
      return {
        lines: [`Share ${total} ${c.item} between ${b} ${who}.`, 'How many does each one get?'],
        widget: 'groups', props: { total, mode: 'share', bowls: b, icon: c.icon, interactive: true },
        input: 'choice', answer: e, options: opts(R, e, [e + 1, e - 1, b]),
        hint: ['Tap Deal one each until they are all gone.', 'Then count one group.'],
        explain: [`${total} shared equally between ${b} is ${e} each.`, `Each one gets ${e}.`],
      };
    }
    if (level === 2) {
      const b = R.pick([2, 5, 10, 3, 4].filter(v => !params.bowls || params.bowls.includes(v)));
      const e = pickNot(R, 2, b === 10 ? 4 : 6, b);
      const total = b * e;
      const tabled = [2, 5, 10].includes(b);
      return {
        lines: [`Share ${total} ${c.item} equally.`, `There are ${b} ${who}.`, 'How many each?'],
        caption: `${total} ÷ ${b} = ?`,
        widget: 'groups', props: { total, mode: 'share', bowls: b, icon: c.icon, interactive: true },
        input: 'numpad', answer: e,
        hint: ['Tap Deal one each until they are all gone.', 'Then count one group.'],
        explain: [`${total} shared equally between ${b} is ${e} each.`, `${total} ÷ ${b} = ${e}.`],
        ...(tabled ? { fact: factKey('÷', total, b) } : {}),
        reteach: sharing.make(1, R, params),
      };
    }
    const b = R.pick([2, 5, 10]);
    const e = pickNot(R, 3, 10, b);
    const total = b * e;
    return {
      lines: [`${total} ${c.item} are shared by ${b} ${who}.`, 'Each gets the same. How many each?'],
      caption: `${total} ÷ ${b} = ?`,
      input: 'numpad', answer: e,
      hint: [`Think: ? × ${b} = ${total}.`, 'Or deal them out and count one group.'],
      hintWidget: shareHint(b, e, c.icon),
      explain: [`${total} shared equally between ${b} is ${e} each.`, `${e} × ${b} = ${total}, so ${total} ÷ ${b} = ${e}.`],
      fact: factKey('÷', total, b),
      reteach: sharing.make(2, R, { bowls: [2, 5] }),
    };
  },
};

export const grouping = {
  about: 'Group into equal groups: how many groups? (the missing factor)',
  levels: 3,
  make(level, R, params = {}) {
    const c = R.pick(GROUPS);
    if (level <= 1) {
      const gs = R.pick([2, 3, 4, 5]);
      const k = pickNot(R, 2, gs === 5 ? 4 : 5, gs);
      const total = gs * k;
      return {
        lines: [`${total} ${c.item}. Put them in groups of ${gs}.`, 'How many groups?'],
        widget: 'groups', props: { total, mode: 'group', groupSize: gs, icon: c.icon, interactive: true },
        input: 'choice', answer: k, options: opts(R, k, [k + 1, k - 1, gs]),
        hint: [`Tap Make a group of ${gs} until none are left.`, 'Then count the groups.'],
        explain: [`${total} divided into groups of ${gs} is equal to ${k}.`, `There are ${k} groups of ${gs}.`],
      };
    }
    if (level === 2) {
      const gs = R.pick([2, 5, 10]);
      const k = pickNot(R, 2, gs === 10 ? 5 : 6, gs);
      const total = gs * k;
      return {
        lines: [`${total} ${c.item}. ${gs} ${c.where}.`, `How many ${c.g}?`],
        caption: `? × ${gs} = ${total}`,
        widget: 'groups', props: { total, mode: 'group', groupSize: gs, icon: c.icon, interactive: true },
        input: 'numpad', answer: k,
        hint: [`Tap Make a group of ${gs}.`, 'Count the groups you make.'],
        explain: [`${total} divided into groups of ${gs} is equal to ${k}.`, `${k} × ${gs} = ${total}, so you need ${k} ${c.g}.`],
        fact: factKey('÷', total, gs),
        reteach: grouping.make(1, R, params),
      };
    }
    const gs = R.pick([2, 5, 10]);
    const k = pickNot(R, 3, 10, gs);
    const total = gs * k;
    return {
      lines: [`How many groups of ${gs} are in ${total}?`],
      caption: `${total} ÷ ${gs} = ?`,
      input: 'numpad', answer: k,
      hint: [`Count in ${gs}s until you reach ${total}.`, 'Count the rows.'],
      hintWidget: blasterPic(k, gs, { rowLabels: true }),
      explain: [`${total} divided into groups of ${gs} is equal to ${k}.`, `${k} × ${gs} = ${total}.`],
      fact: factKey('÷', total, gs),
      reteach: grouping.make(2, R, params),
    };
  },
};

export const divisionFacts = {
  about: 'Division facts for the 2, 5 and 10 times tables',
  levels: 3,
  make(level, R, params = {}) {
    const tabs = tablesFrom(params);
    if (level <= 1) {
      const d = R.pick(tabs.includes(5) ? [2, 10, 5] : [2, 10]);
      const q = pickNot(R, 2, 5, d);
      const p = q * d;
      return {
        lines: [`${p} dots. Put them in groups of ${d}.`, 'How many groups?'],
        caption: `${p} ÷ ${d} = ?`,
        // Scattered first: the hint sorts them into groups.
        widget: 'objects', props: { n: p, arrange: 'scatter', icon: 'dot' },
        input: 'choice', answer: q, options: opts(R, q, [q + 1, q - 1, d]),
        hint: [`Look: the dots are in groups of ${d} now.`, 'Count the rings.'],
        hintProps: { arrange: 'groups', groups: Array(q).fill(d) },
        explain: [`${p} divided into groups of ${d} is equal to ${q}.`, `${p} ÷ ${d} = ${q}.`],
        fact: factKey('÷', p, d),
      };
    }
    const d = R.pick(tabs);
    const q = pickNot(R, 2, 10, d);
    const p = q * d;
    if (level === 2) {
      return {
        lines: ['Use your times tables.'], caption: `${p} ÷ ${d} = ?`,
        input: 'numpad', answer: q,
        hint: [`How many ${d}s make ${p}?`, 'Count the rows.'], hintWidget: blasterPic(q, d, { rowLabels: true }),
        explain: [`${p} divided into groups of ${d} is equal to ${q}.`, `${q} × ${d} = ${p}, so ${p} ÷ ${d} = ${q}.`],
        fact: factKey('÷', p, d), reteach: divisionFacts.make(1, R, params),
      };
    }
    const q2 = Math.max(2, q);
    const p2 = q2 * d;
    if (R.chance(0.5)) {
      return {
        lines: ['Find the missing number.'], caption: `? ÷ ${d} = ${q2}`,
        input: 'numpad', answer: p2,
        hint: [`${q2} groups of ${d}. How many altogether?`, `Count in ${d}s.`],
        hintWidget: blasterPic(q2, d, { rowLabels: partial(d, q2) }),
        explain: [`${q2} groups of ${d} is ${p2}.`, `So ${p2} ÷ ${d} = ${q2}.`],
        fact: factKey('÷', p2, d), reteach: divisionFacts.make(2, R, params),
      };
    }
    const q3 = q2 === d ? (q2 === 10 ? 9 : q2 + 1) : q2;
    return {
      lines: ['Find the missing number.'], caption: `${q3 * d} ÷ ? = ${q3}`,
      input: 'numpad', answer: d,
      hint: [`Share ${q3 * d} into ${q3} equal groups.`, 'How many in each group?'],
      hintWidget: shareHint(q3, d),
      explain: [`${q3 * d} shared equally between ${q3} is ${d} each.`, `${q3} × ${d} = ${q3 * d}, so ${q3 * d} ÷ ${d} = ${q3}.`],
      fact: factKey('÷', q3 * d, d), reteach: divisionFacts.make(2, R, params),
    };
  },
};

export const mulDivProblem = {
  about: 'Times and divide problems in space contexts',
  levels: 3,
  make(level, R, params = {}) {
    const tabs = tablesFrom(params);
    const kind = level <= 1 ? 'mul' : R.pick(['mul', 'share', 'group']);
    if (kind === 'mul') {
      const s = level <= 1 ? R.pick([2, 5]) : R.pick(tabs);
      // max: the biggest group that still makes sense (no robot has 10 wheels).
      const ctx = R.pick([
        { a: 'rockets', b: 'fuel tanks', each: 'on each rocket', icon: 'fuel', max: 5, pic: 'rocket' },
        { a: 'aliens', b: 'eyes', each: 'on each alien', icon: 'dot', max: 10, pic: 'alien' },
        { a: 'robots', b: 'wheels', each: 'on each robot', icon: 'dot', max: 5, pic: 'robot' },
        { a: 'bags', b: 'moon rocks', each: 'in each bag', icon: 'asteroid', max: 10 },
        { a: 'pods', b: 'astronauts', each: 'in each pod', icon: 'astronaut', max: 10 },
        { a: 'trays', b: 'crystals', each: 'on each tray', icon: 'crystal', max: 10 },
      ].filter(c => s <= c.max));
      const g = pickNot(R, 2, level <= 1 ? 4 : level === 2 ? 6 : 10, s);
      const t = g * s;
      const item = {
        lines: [`${g} ${ctx.a}. ${s} ${ctx.b} ${ctx.each}.`, `How many ${ctx.b} altogether?`],
        hint: [`Count in ${s}s, ${g} times.`, 'The numbers start the count for you.'],
        explain: [`There are ${g} groups of ${s}.`, `${g} × ${s} = ${t}. There are ${t} ${ctx.b}.`],
        fact: factKey('x', g, s),
      };
      if (level <= 1) return { ...item, ...objGroupsLabelled(g, s, ctx.icon, blankLabels(g)), hintProps: { groupLabels: partial(s, g) }, input: 'choice', answer: t, options: opts(R, t, [g + s, t + s, t - s]) };
      // The story picture shows the rockets, aliens or robots; the hint turns it into the equal groups.
      const story = ctx.pic ? { widget: 'objects', props: { n: g, icon: ctx.pic, arrange: g <= 6 ? 'row' : 'rows', perRow: 5 }, hintProps: objGroupsLabelled(g, s, ctx.icon).props } : { hintWidget: objGroupsLabelled(g, s, ctx.icon) };
      return { ...item, ...story, input: 'numpad', answer: t, reteach: mulDivProblem.make(1, R, params) };
    }
    if (kind === 'share') {
      const c = R.pick(SHARE_ITEMS);
      const who = R.pick(SHARERS);
      const b = R.pick(level === 2 ? [2, 5] : [2, 5, 10]);
      const e = pickNot(R, 2, level === 2 ? 6 : 10, b);
      const total = b * e;
      return {
        lines: [`${b} ${who} share ${total} ${c.item} equally.`, 'How many does each one get?'],
        input: 'numpad', answer: e,
        hint: [`Think: ${b} × ? = ${total}.`, 'Or deal them out and count one group.'],
        // The story picture is the pile and the plates; the hint makes it hands-on so Finn can deal.
        ...(total <= GROUPS_MAX
          ? { widget: 'groups', props: { total, mode: 'share', bowls: b, icon: c.icon, readonly: true }, hintProps: { interactive: true, readonly: false } }
          : { hintWidget: shareHint(b, e, c.icon) }),
        explain: [`${total} shared equally between ${b} is ${e} each.`, `${total} ÷ ${b} = ${e}.`],
        fact: factKey('÷', total, b),
        reteach: sharing.make(1, R),
      };
    }
    const c = R.pick(GROUPS);
    const gs = R.pick(level === 2 ? [2, 5, 10] : [2, 5, 10]);
    const k = pickNot(R, 2, level === 2 ? 6 : 10, gs);
    const total = gs * k;
    return {
      lines: [`There are ${total} ${c.item}.`, `${gs} fit ${c.where}. How many ${c.g}?`],
      input: 'numpad', answer: k,
      hint: [`Make groups of ${gs} until none are left.`, 'Count the groups.'],
      ...(total <= GROUPS_MAX
        ? { widget: 'groups', props: { total, mode: 'group', groupSize: gs, icon: c.icon, readonly: true }, hintProps: { interactive: true, readonly: false } }
        : { hintWidget: groupHint(k, gs, c.icon) }),
      explain: [`${total} divided into groups of ${gs} is equal to ${k}.`, `${k} × ${gs} = ${total}, so ${k} ${c.g}.`],
      fact: factKey('÷', total, gs),
      reteach: grouping.make(1, R),
    };
  },
};

export const countInMultiples = {
  about: 'Count in 2s, 5s and 10s: find the missing number in the pattern',
  levels: 3,
  make(level, R, params = {}) {
    const tabs = tablesFrom(params);
    const s = R.pick(tabs);
    const len = 5;
    if (level <= 1) {
      const seq = Array.from({ length: len }, (_, i) => (i + 1) * s);
      const ans = seq[len - 1];
      return {
        lines: [`Count in ${s}s.`, 'What comes next?'],
        caption: `${seq.slice(0, len - 1).join(', ')}, ?`,
        input: 'choice', answer: ans, options: opts(R, ans, [ans + 1, ans - 1, ans + s, ans - s + 1]),
        hint: ['Look at the yellow squares.', `Each one is ${s} more. Count on ${s} from ${seq[len - 2]}.`],
        hintWidget: squareHint(seq.slice(0, len - 1)),
        explain: [`Each number is ${s} more than the one before.`, `${seq.join(', ')}.`],
      };
    }
    const maxStart = s === 2 ? 10 : s === 5 ? 7 : 6;
    const start = R.int(0, maxStart) * s;
    const back = level === 3 && R.chance(0.6);
    // Five numbers, or four when five 2-digit numbers would wrap the big caption beside the number pad.
    const n = Array.from({ length: len }, (_, i) => start + i * s).join(', ').length > 15 ? 4 : len;
    let seq = Array.from({ length: n }, (_, i) => start + i * s);
    if (back) seq = seq.reverse();
    const miss = level === 2 ? R.int(1, n - 1) : R.int(1, n - 2);
    const ans = seq[miss];
    const shown = seq.map((v, i) => (i === miss ? '?' : String(v))).join(', ');
    return {
      lines: [back ? `Count back in ${s}s.` : `Count in ${s}s.`, 'Find the missing number.'],
      caption: shown,
      input: 'numpad', answer: ans,
      hint: [back ? `Each number is ${s} less.` : `Each number is ${s} more.`, 'Look at the yellow squares. Which one is missing?'],
      hintWidget: squareHint(seq.filter((_, i) => i !== miss)),
      explain: [back ? `Each number is ${s} less than the one before.` : `Each number is ${s} more than the one before.`, `${seq.join(', ')}.`],
      reteach: countInMultiples.make(1, R, params),
    };
  },
};
