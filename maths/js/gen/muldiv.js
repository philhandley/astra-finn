// Multiplication and division generators (Array Blaster sector). See ENGINE.md section 4.
// Every make(level, R, params) returns one item. Level 1 is gentle (pictures, choice, small numbers);
// level 3 is genuinely Year 2 hard (abstract, missing numbers, bigger facts).
// Common params: tables (array of 2, 5, 10), icon (art name).
// Debug: dev/gen.html?gen=muldiv&all=1   or   dev/gen.html?gen=muldiv.times5&level=3&n=20
import { factKey } from '../core/facts.js';

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
const skip = (s, g) => Array.from({ length: g }, (_, i) => (i + 1) * s).join(', ');
const repeated = (s, g) => Array(g).fill(s).join(' + ');

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
        ...objGroups(g, s, c.icon),
        input: 'choice', answer: t, options: opts(R, t, [g + s, t - s, t + s, t + 1]),
        hint: [`Count in ${s}s. Touch each ${c.g1}.`],
        explain: [`${skip(s, g)}.`, `${g} groups of ${s} is ${t}.`],
        reteach: small(R, 2, 2, c),
      };
    }
    if (level === 2) {
      const s = R.pick(tabs);
      const g = pickNot(R, 2, s === 10 ? 4 : 5, s);
      const t = g * s;
      return {
        lines: [`There are ${g} equal groups.`, `There are ${s} in each group.`, 'How many altogether?'],
        caption: `${repeated(s, g)} = ?`,
        ...objGroups(g, s, 'dot'),
        input: 'numpad', answer: t,
        hint: [`Count in ${s}s, one group at a time.`],
        explain: [`${repeated(s, g)} = ${t}.`, `${g} groups of ${s} is ${t}.`],
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
      hint: [`The ${g} is the number of groups.`, `Count in ${s}s ${g} times.`],
      hintWidget: objGroups(g, s, 'dot'),
      explain: [`${g} × ${s} = ${t}.`, `The ${t} is the total number of ${c.item}.`],
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
    ...objGroups(g, s, 'dot'),
    input: 'choice', answer: t, options: opts(R, t, [t + 1, t - 1, g + s]),
    hint: [`Count in ${s}s.`], explain: [`${skip(s, g)}.`],
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
        lines: [`${r} rows of ${s}.`, 'How many dots?'],
        ...blasterPic(r, s),
        input: 'choice', answer: t, options: opts(R, t, [r + s, t + s, t - s]),
        hint: [`Count in ${s}s, one row at a time.`],
        explain: [`${skip(s, r)}.`, `${r} rows of ${s} is ${t}.`],
        reteach: { lines: [`2 rows of ${s}.`, 'How many dots?'], ...blasterPic(2, s), input: 'choice', answer: 2 * s, options: opts(R, 2 * s, [s, 2 * s + 1, s + 2]), hint: [`Count every dot.`], explain: [`${s} and ${s} make ${2 * s}.`] },
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
        hint: [`Count in ${s}s down the rows.`],
        explain: [`${skip(s, r)}.`, `${r} × ${s} = ${t}.`],
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
      hint: ['Count the rows. Count the dots in one row.'],
      explain: [`${r} rows of ${s}.`, `${right}.`],
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
        hint: [`Count the groups of ${s}.`],
        explain: [`There are ${g} groups of ${s}.`, `${repeated(s, g)} is ${g} lots of ${s}.`],
      };
    }
    if (level === 2) {
      const g = pickNot(R, 2, 5, s);
      return {
        lines: [`Adding ${s} again and again is multiplying.`, `How many ${s}s?`],
        caption: `${repeated(s, g)} = ? × ${s}`,
        input: 'numpad', answer: g,
        hint: [`Count how many ${s}s you can see.`],
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
      hint: [`${g} × ${s} means ${g} groups of ${s}.`],
      explain: [`${g} × ${s} is ${g} lots of ${s}.`, `${right} = ${g * s}.`],
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
        const g = pickNot(R, 1, 5, t);
        const p = g * t;
        return {
          lines: [`${g} rows of ${t}.`, 'How many dots?'],
          caption: `${g} × ${t} = ?`,
          ...blasterPic(g, t),
          input: 'choice', answer: p, options: opts(R, p, [p + t, p - t, g + t]),
          hint: [`Count in ${t}s: ${t}, ${2 * t}, ${3 * t}…`],
          explain: [`${skip(t, g)}.`, `${g} × ${t} = ${p}.`],
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
          hint: [`Count in ${t}s, ${g} times.`],
          hintWidget: blasterPic(g, t),
          explain: [`${skip(t, g)}.`, `${g} × ${t} = ${p}.`],
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
        hint: [`Count in ${t}s until you reach ${p}.`, 'Count how many jumps.'],
        hintWidget: blasterPic(g, t),
        explain: [`${g} × ${t} = ${p}.`, `The missing number is ${g}.`],
        fact: factKey('x', g, t),
        reteach: { lines: ['Count the rows.'], caption: `? × ${t} = ${Math.min(g, 3) * t}`, ...blasterPic(Math.min(g, 3), t), input: 'choice', answer: Math.min(g, 3), options: opts(R, Math.min(g, 3), [t, Math.min(g, 3) + 1, Math.min(g, 3) - 1].filter(v => v !== t)), hint: [`Count in ${t}s.`], explain: [`${skip(t, Math.min(g, 3))}.`] },
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
        hint: [`Count in ${t}s.`], hintWidget: blasterPic(g, t),
        explain: [`${skip(t, g)}.`, `${g} × ${t} = ${p}.`], fact: factKey('x', g, t),
      };
    }
    const t = R.pick(tabs);
    const g = R.int(2, 10);
    const p = g * t;
    if (level === 2) {
      return {
        lines: [R.pick(['Quick fire!', 'What is the answer?'])], caption: R.chance(0.5) ? `${g} × ${t} = ?` : `${t} × ${g} = ?`,
        input: 'numpad', answer: p, hint: [`Count in ${t}s.`], hintWidget: blasterPic(g, t),
        explain: [`${g} × ${t} = ${p}.`], fact: factKey('x', g, t), reteach: mixedTables.make(1, R, params),
      };
    }
    const kind = R.pick(['div', 'div', 'miss']);
    if (kind === 'div' && g !== t) {
      return {
        lines: ['Use a times table fact.'], caption: `${p} ÷ ${t} = ?`,
        input: 'numpad', answer: g, hint: [`How many ${t}s make ${p}?`], hintWidget: blasterPic(g, t),
        explain: [`${g} × ${t} = ${p}.`, `So ${p} ÷ ${t} = ${g}.`], fact: factKey('÷', p, t),
        reteach: mixedTables.make(2, R, params),
      };
    }
    const gg = g === t ? (g === 10 ? 9 : g + 1) : g;
    return {
      lines: ['Find the missing number.'], caption: `? × ${t} = ${gg * t}`,
      input: 'numpad', answer: gg, hint: [`Count in ${t}s to ${gg * t}.`], hintWidget: blasterPic(gg, t),
      explain: [`${gg} × ${t} = ${gg * t}.`], fact: factKey('x', gg, t), reteach: mixedTables.make(2, R, params),
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
          hint: ['Turn the array round in your head.', 'Are there more dots?'],
          explain: [`${r} rows of ${s} is ${s} rows of ${r}.`, `Both make ${r * s}.`],
        };
      }
      const big = r * s;
      return {
        lines: [`Is ${big} ÷ ${s} the same as ${s} ÷ ${big}?`],
        input: 'choice', answer: 'No', options: ['Yes', 'No'],
        hint: [`Sharing ${big} biscuits is not like sharing ${s}.`],
        explain: [`${big} shared by ${s} gives ${r} each.`, `${s} shared by ${big} gives less than 1 each.`],
      };
    }
    if (level === 2) {
      // Which array has the same number of dots? Small dot pictures as options.
      const rr = Math.min(r, 5), ss = Math.min(s, 5) === rr ? (rr === 5 ? 4 : rr + 1) : Math.min(s, 5);
      const pic = (rows, per) => ({ widget: 'objects', props: { n: rows * per, arrange: 'rows', perRow: per, icon: 'dot', readonly: true } });
      return {
        lines: [`${rr} rows of ${ss}.`, 'Which array has the same number of dots?'],
        ...pic(rr, ss),
        input: 'choice', answer: 'flip',
        options: R.shuffle([
          { label: `${ss} rows of ${rr}`, value: 'flip', ...pic(ss, rr) },
          { label: `${ss} rows of ${rr + 1}`, value: 'more', ...pic(ss, rr + 1) },
          { label: `${rr} rows of ${ss - 1}`, value: 'less', ...pic(rr, ss - 1) },
        ]),
        hint: ['Turn the array a quarter turn in your head.'],
        explain: [`${rr} rows of ${ss} is ${ss} rows of ${rr}.`, `${rr} × ${ss} = ${ss} × ${rr} = ${rr * ss}.`],
        reteach: commutative.make(1, R, params),
      };
    }
    if (R.chance(0.5)) {
      const right = `${s} × ${r}`;
      return {
        lines: [`Which one is the same as ${r} × ${s}?`],
        input: 'choice', answer: right, options: R.shuffle([right, `${r} + ${s}`, `${r * s} ÷ ${s}`]),
        hint: ['Multiplying can be done in any order.'],
        explain: [`${r} × ${s} = ${s} × ${r} = ${r * s}.`],
        fact: factKey('x', r, s),
      };
    }
    const right = `${s} × ${r} = ${r} × ${s}`;
    return {
      lines: ['Which one is true?'],
      input: 'choice', answer: right,
      options: R.shuffle([right, `${r * s} ÷ ${s} = ${s} ÷ ${r * s}`, `${r + s} − ${s} = ${s} − ${r + s}`]),
      hint: ['Only one kind of sum works in any order here.'],
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
      return {
        lines: ['Pair up the dots.', `Is ${n} odd or even?`],
        widget: 'objects', props: { n, arrange: 'groups', groups: [...Array(pairs).fill(2), ...(n % 2 ? [1] : [])], icon: 'dot' },
        input: 'choice', answer: ans, options: ['Odd', 'Even'],
        hint: ['Is there a dot with no partner?'],
        explain: n % 2 ? [`${n} has one dot left over.`, `${n} is odd.`] : [`Every dot has a partner.`, `${n} is even.`],
      };
    }
    if (level === 2) {
      const n = R.int(11, 50);
      const ans = n % 2 ? 'Odd' : 'Even';
      return {
        lines: ['Is this number odd or even?'], caption: String(n),
        input: 'choice', answer: ans, options: ['Odd', 'Even'],
        hint: ['Look at the ones digit.', 'Even numbers end in 0, 2, 4, 6 or 8.'],
        explain: [`${n} ends in ${n % 10}.`, `${n} is ${ans.toLowerCase()}.`],
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
      hint: ['Look at the last digit of each number.'],
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
        hint: ['Tap Deal one each until they are all gone.'],
        explain: [`Each one gets ${e}.`, `${total} shared between ${b} is ${e}.`],
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
        widget: 'groups', props: { total, mode: 'share', bowls: b, icon: 'dot', interactive: true },
        input: 'numpad', answer: e,
        hint: ['Deal them out, one each at a time.'],
        explain: [`${total} ÷ ${b} = ${e}.`, `Each one gets ${e}.`],
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
      hint: [`Think: ? × ${b} = ${total}.`],
      hintWidget: { widget: 'groups', props: { total, mode: 'share', bowls: b, icon: 'dot', interactive: true } },
      explain: [`${e} × ${b} = ${total}.`, `So ${total} ÷ ${b} = ${e}.`],
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
        hint: [`Make groups of ${gs} until none are left.`],
        explain: [`There are ${k} groups of ${gs}.`, `${total} in groups of ${gs} makes ${k} groups.`],
      };
    }
    if (level === 2) {
      const gs = R.pick([2, 5, 10]);
      const k = pickNot(R, 2, gs === 10 ? 5 : 6, gs);
      const total = gs * k;
      return {
        lines: [`${total} ${c.item}. ${gs} ${c.where}.`, `How many ${c.g}?`],
        caption: `? × ${gs} = ${total}`,
        widget: 'groups', props: { total, mode: 'group', groupSize: gs, icon: 'dot', interactive: true },
        input: 'numpad', answer: k,
        hint: [`Count in ${gs}s to ${total}.`, 'Count the jumps.'],
        explain: [`${k} × ${gs} = ${total}.`, `So you need ${k} ${c.g}.`],
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
      hint: [`Count in ${gs}s until you reach ${total}.`],
      hintWidget: blasterPic(k, gs),
      explain: [`${total} divided into groups of ${gs} is equal to ${k}.`],
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
        lines: [`${p} dots in groups of ${d}.`, 'How many groups?'],
        caption: `${p} ÷ ${d} = ?`,
        ...objGroups(q, d, 'dot'),
        input: 'choice', answer: q, options: opts(R, q, [q + 1, q - 1, d]),
        hint: ['Count the rings.'],
        explain: [`There are ${q} groups of ${d}.`, `${p} ÷ ${d} = ${q}.`],
        fact: factKey('÷', p, d),
      };
    }
    const d = R.pick(tabs);
    const q = pickNot(R, 1, 10, d);
    const p = q * d;
    if (level === 2) {
      return {
        lines: ['Use your times tables.'], caption: `${p} ÷ ${d} = ?`,
        input: 'numpad', answer: q,
        hint: [`How many ${d}s make ${p}?`], hintWidget: blasterPic(q, d),
        explain: [`${q} × ${d} = ${p}.`, `So ${p} ÷ ${d} = ${q}.`],
        fact: factKey('÷', p, d), reteach: divisionFacts.make(1, R, params),
      };
    }
    const q2 = Math.max(2, q);
    const p2 = q2 * d;
    if (R.chance(0.5)) {
      return {
        lines: ['Find the missing number.'], caption: `? ÷ ${d} = ${q2}`,
        input: 'numpad', answer: p2,
        hint: [`${q2} groups of ${d}. How many altogether?`],
        explain: [`${q2} × ${d} = ${p2}.`, `So ${p2} ÷ ${d} = ${q2}.`],
        fact: factKey('÷', p2, d), reteach: divisionFacts.make(2, R, params),
      };
    }
    const q3 = q2 === d ? (q2 === 10 ? 9 : q2 + 1) : q2;
    return {
      lines: ['Find the missing number.'], caption: `${q3 * d} ÷ ? = ${q3}`,
      input: 'numpad', answer: d,
      hint: [`${q3} groups. How many in each group?`],
      explain: [`${q3} × ${d} = ${q3 * d}.`, `So ${q3 * d} ÷ ${d} = ${q3}.`],
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
      const ctx = R.pick([
        { a: 'rockets', b: 'boosters', each: 'on each rocket', icon: 'fuel' },
        { a: 'aliens', b: 'eyes', each: 'on each alien', icon: 'dot' },
        { a: 'robots', b: 'wheels', each: 'on each robot', icon: 'dot' },
        { a: 'bags', b: 'moon rocks', each: 'in each bag', icon: 'asteroid' },
        { a: 'pods', b: 'astronauts', each: 'in each pod', icon: 'astronaut' },
      ]);
      const s = level <= 1 ? R.pick([2, 5]) : R.pick(tabs);
      const g = pickNot(R, 2, level <= 1 ? 4 : level === 2 ? 6 : 10, s);
      const t = g * s;
      const item = {
        lines: [`${g} ${ctx.a}. ${s} ${ctx.b} ${ctx.each}.`, `How many ${ctx.b} altogether?`],
        hint: [`Count in ${s}s, ${g} times.`],
        explain: [`${g} × ${s} = ${t}.`, `There are ${t} ${ctx.b}.`],
        fact: factKey('x', g, s),
      };
      if (level <= 1) return { ...item, ...objGroups(g, s, ctx.icon), input: 'choice', answer: t, options: opts(R, t, [g + s, t + s, t - s]) };
      return { ...item, input: 'numpad', answer: t, hintWidget: objGroups(g, s, 'dot'), reteach: mulDivProblem.make(1, R, params) };
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
        hint: [`Think: ${b} × ? = ${total}.`],
        hintWidget: { widget: 'groups', props: { total, mode: 'share', bowls: b, icon: 'dot', interactive: true } },
        explain: [`${total} ÷ ${b} = ${e}.`, `Each one gets ${e}.`],
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
      hint: [`Count in ${gs}s until you reach ${total}.`],
      hintWidget: { widget: 'groups', props: { total, mode: 'group', groupSize: gs, icon: 'dot', interactive: true } },
      explain: [`? × ${gs} = ${total}.`, `${k} × ${gs} = ${total}, so ${k} ${c.g}.`],
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
        hint: [`Add ${s} more.`],
        explain: [`${seq.join(', ')}.`],
      };
    }
    const maxStart = s === 2 ? 10 : s === 5 ? 7 : 6;
    const start = R.int(0, maxStart) * s;
    const back = level === 3 && R.chance(0.6);
    let seq = Array.from({ length: len }, (_, i) => start + i * s);
    if (back) seq = seq.reverse();
    const miss = level === 2 ? R.int(1, len - 1) : R.int(1, len - 2);
    const ans = seq[miss];
    const shown = seq.map((v, i) => (i === miss ? '?' : String(v))).join(', ');
    return {
      lines: [back ? `Count back in ${s}s.` : `Count in ${s}s.`, 'Find the missing number.'],
      caption: shown,
      input: 'numpad', answer: ans,
      hint: [back ? `Each number is ${s} less.` : `Each number is ${s} more.`],
      explain: [`${seq.join(', ')}.`],
      reteach: countInMultiples.make(1, R, params),
    };
  },
};
