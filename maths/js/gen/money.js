// Money generators (Measure Lab and Launch Pad): UK coins and notes, totals, making amounts, change.
// Each export: { about, levels, make(level, R, params) } -> item (see ENGINE.md section 4.1).
// Amounts are in pence. Lines say "£1 and 35p" (Year 2 records pounds and pence separately).
// Check: dev/gen.html?gen=money&all=1
import { COINS } from '../widgets/coins.js';

const PENCE = ['1p', '2p', '5p', '10p', '20p', '50p'];
const ALL = ['1p', '2p', '5p', '10p', '20p', '50p', '£1', '£2'];
const V = n => COINS[n].v;
const lv = (level, max) => Math.max(1, Math.min(max, Math.round(level) || 1));
// "35p", "£3", "£1 and 35p"
export const say = p => (p < 100 ? `${p}p` : p % 100 === 0 ? `£${p / 100}` : `£${Math.floor(p / 100)} and ${p % 100}p`);
const sum = arr => arr.reduce((a, n) => a + V(n), 0);
const byValue = arr => [...arr].sort((a, b) => V(b) - V(a));

function pickOptions(R, correct, pool, n = 3) {
  const out = [correct];
  for (const d of R.shuffle(pool)) { if (out.length >= n) break; if (!out.some(o => String(o) === String(d))) out.push(d); }
  return R.shuffle(out);
}
// Fewest coins for an amount from a set of coin names.
function greedy(amount, set = ALL) {
  const out = [];
  let left = amount;
  for (const n of byValue(set)) while (left >= V(n)) { out.push(n); left -= V(n); }
  return left === 0 ? out : null;
}
// Running totals for counting on, biggest first: "20p, 30p, 35p".
function countOn(coins) {
  let t = 0;
  return byValue(coins).map(n => say((t += V(n))));
}
function countLines(coins) {
  const steps = countOn(coins);
  return ['Start with the biggest coin and count on.', steps.join(', ') + '.'];
}
// A random purse of k coins from a set, total under max.
function purse(R, k, set, max) {
  for (let t = 0; t < 200; t++) {
    const p = Array.from({ length: k }, () => R.pick(set));
    if (sum(p) < max) return p;
  }
  return set.slice(0, k);
}
const coinProps = (items, extra = {}) => ({ purse: items, tray: [], showTotal: false, readonly: true, ...extra });

/* ---------- Coin values ---------- */
export const coinValue = {
  about: 'Recognise coins and notes and know their values',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    if (level === 1) {
      if (R.chance(0.5)) {
        const [a, b] = R.pick([['2p', '5p'], ['5p', '10p'], ['1p', '2p'], ['10p', '20p'], ['20p', '50p'], ['50p', '£1'], ['1p', '5p'], ['2p', '10p']]);
        const answer = V(a) > V(b) ? a : b;
        return {
          lines: ['Which coin is worth more?'], input: 'choice', answer,
          options: R.shuffle([a, b]).map(n => ({ label: '', value: n, widget: 'coins', props: coinProps([n]) })),
          hint: ['Read the number on each coin.', 'A bigger coin is not always worth more.'],
          explain: [`${a} or ${b}.`, `${answer} is worth more.`],
        };
      }
      const target = R.pick(ALL);
      const others = R.sample(ALL.filter(n => n !== target), 2);
      return {
        lines: [`Which coin is ${target}?`], input: 'choice', answer: target,
        options: R.shuffle([target, ...others]).map(n => ({ label: '', value: n, widget: 'coins', props: coinProps([n]) })),
        hint: ['Look at the number on each coin.'],
        explain: [`This is the ${target} coin.`, 'The number tells you its value.'],
      };
    }
    if (level === 2) {
      const name = R.pick(ALL);
      const looks = {
        '1p': 'It is small and copper coloured.', '2p': 'It is big and copper coloured.', '5p': 'It is small, round and silver.',
        '10p': 'It is big, round and silver.', '20p': 'It is silver with 7 sides. It is small.', '50p': 'It is silver with 7 sides. It is big.',
        '£1': 'It is gold and silver with 12 sides.', '£2': 'It is round, gold outside and silver inside.',
      };
      const similar = { '1p': ['2p', '5p'], '2p': ['1p', '10p'], '5p': ['10p', '1p'], '10p': ['5p', '50p'], '20p': ['50p', '10p'], '50p': ['20p', '10p'], '£1': ['£2', '20p'], '£2': ['£1', '10p'] };
      return {
        lines: ['This coin has no number on it.', 'Which coin is it?'],
        widget: 'coins', props: coinProps([name], { labels: false }),
        input: 'choice', answer: name, options: pickOptions(R, name, similar[name]),
        hint: ['Look at its colour.', 'Count its sides. Is it big or small?'],
        hintProps: { labels: false },
        explain: [looks[name], `It is ${name}.`],
      };
    }
    if (R.chance(0.5)) {
      const x = R.pick(['10p', '2p', '5p', '50p', '£2', '20p', '£5']);
      const pairs = { '10p': ['£1', 10, '10, 20, 30... up to 100.'], '2p': ['10p', 5, '2, 4, 6, 8, 10.'], '5p': ['10p', 2, '5, 10.'], '50p': ['£1', 2, '50, 100.'], '£2': ['£10', 5, '2, 4, 6, 8, 10.'], '20p': ['£1', 5, '20, 40, 60, 80, 100.'], '£5': ['£10', 2, '5, 10.'] };
      const [tot, a, ex] = pairs[x];
      return {
        lines: [`How many of these ${x === '£5' ? 'notes' : 'coins'} make ${tot}?`], input: 'numpad', answer: a, widget: 'coins', props: coinProps([x]),
        hint: ['Count in steps.', 'How many steps make the total?'],
        explain: [`Count: ${ex}`, `That is ${a}.`],
      };
    }
    const set = R.sample(['50p', '£1', '£2', '£5', '£10', '£20', '20p'], 3);
    const most = R.chance(0.6);
    const answer = byValue(set)[most ? 0 : 2];
    return {
      lines: [most ? 'Which is worth the most?' : 'Which is worth the least?'], input: 'choice', answer,
      options: R.shuffle(set).map(n => ({ label: '', value: n, widget: 'coins', props: coinProps([n]) })),
      hint: ['Pounds are worth more than pence.', '£1 is the same as 100p.'],
      explain: [`${byValue(set).join(', ')}.`, `${answer} is worth the ${most ? 'most' : 'least'}.`],
    };
  },
};

/* ---------- Count a purse ---------- */
export const countCoins = {
  about: 'Count the money in a purse',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    if (level === 1) {
      const p = purse(R, R.int(2, 4), ['1p', '2p', '5p', '10p'], 20);
      const small = p.slice(0, 2);
      return {
        lines: ['How much money is in the purse?'], widget: 'coins', props: coinProps(byValue(p)),
        input: 'numpad', answer: sum(p), unit: 'p',
        hint: countLines(p).slice(0, 1), explain: countLines(p),
        reteach: p.length > 2 ? { lines: ['How much is this?'], widget: 'coins', props: coinProps(byValue(small)), input: 'numpad', answer: sum(small), unit: 'p', hint: ['Count on from the biggest coin.'], explain: countLines(small) } : undefined,
      };
    }
    if (level === 2) {
      const p = purse(R, R.int(3, 5), PENCE, 100);
      const easy = byValue(p).slice(0, 2);
      return {
        lines: ['How much money is in the purse?'], widget: 'coins', props: coinProps(R.shuffle(p)),
        input: 'numpad', answer: sum(p), unit: 'p',
        hint: countLines(p).slice(0, 1), hintProps: { sort: true }, explain: countLines(p),
        reteach: { lines: ['Count these 2 coins.'], widget: 'coins', props: coinProps(easy), input: 'numpad', answer: sum(easy), unit: 'p', hint: ['Start with the bigger coin.'], explain: countLines(easy) },
      };
    }
    if (R.chance(0.5)) {
      const p = purse(R, R.int(2, 4), ['£1', '£2', '£5', '£10', '£20'], 4000);
      return {
        lines: ['How many pounds are in the purse?'], widget: 'coins', props: coinProps(R.shuffle(p)),
        input: 'numpad', answer: sum(p) / 100, prefix: '£',
        hint: ['Start with the biggest note.', 'Count on in pounds.'], hintProps: { sort: true },
        explain: [countOn(p).join(', ') + '.', `That is ${say(sum(p))}.`],
      };
    }
    const pounds = purse(R, R.int(1, 2), ['£1', '£2'], 400);
    const pence = purse(R, R.int(1, 3), ['5p', '10p', '20p', '50p'], 100);
    const all = [...pounds, ...pence];
    const t = sum(all), P = Math.floor(t / 100), q = t % 100;
    if (q === 0) return countCoins.make(2, R);
    const answer = say(t);
    const pool = [say(t + 10), say(t + 100), say(q > 10 ? t - 5 : t + 5), say(t > 200 ? t - 100 : t + 200)];
    return {
      lines: ['How much money is in the purse?'], widget: 'coins', props: coinProps(R.shuffle(all)),
      input: 'choice', answer, options: pickOptions(R, answer, pool),
      hint: ['Count the pounds first.', 'Then count the pence.'], hintProps: { sort: true },
      explain: [`The pounds make £${P}.`, `The pence make ${q}p.`, `That is ${answer}.`],
    };
  },
};

/* ---------- Make an amount ---------- */
export const makeAmount = {
  about: 'Tap coins into the purse to make an amount',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    let target, tray, showTotal;
    if (level === 1) { target = R.int(3, 20); tray = ['1p', '2p', '5p', '10p']; showTotal = true; }
    else if (level === 2) { target = R.int(21, 99); tray = PENCE; showTotal = false; }
    else { target = R.pick([R.int(11, 39) * 5, R.int(101, 299)]); if (target < 100) target += 100; tray = ALL; showTotal = true; }
    const way = greedy(target, tray);
    let small = target % 50 || 25;
    if (small < 5) small += 10;
    const fewest = level === 3 && R.chance(0.5);
    return {
      lines: [`Make ${say(target)}.`, fewest ? 'Can you use the fewest coins?' : 'Tap coins to put them in the purse.'],
      caption: say(target),
      widget: 'coins', props: { tray, purse: [], showTotal, interactive: true, maxItems: 12 },
      input: 'widget', goal: { total: target },
      hint: ['Start with the biggest coin that fits.', 'Tap a coin in the purse to take it out.'],
      hintProps: { showTotal: true },
      explain: [`${way.join(' + ')} makes ${say(target)}.`],
      reteach: level > 1 ? {
        lines: [`Make ${say(small)}.`], caption: say(small),
        widget: 'coins', props: { tray: PENCE, purse: [], showTotal: true, interactive: true, maxItems: 12 }, input: 'widget', goal: { total: small },
        hint: ['Start with the biggest coin that fits.'], explain: ['Biggest coins first, then count on.'],
      } : undefined,
    };
  },
};

/* ---------- Same amount, different coins ---------- */
function decompose(R, target, k, set) {
  for (let t = 0; t < 400; t++) {
    const p = Array.from({ length: k }, () => R.pick(set.filter(n => V(n) <= target)));
    if (sum(p) === target) return byValue(p);
  }
  return null;
}
export const sameAmountDifferentWays = {
  about: 'Find another set of coins that makes the same amount',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const target = level === 1 ? R.pick([6, 10, 12, 15, 20]) : level === 2 ? R.pick([20, 30, 40, 50, 60, 75, 100]) : R.pick([100, 150, 200, 250, 300]);
    const set = level === 1 ? ['1p', '2p', '5p', '10p'] : level === 2 ? ['2p', '5p', '10p', '20p', '50p'] : ['10p', '20p', '50p', '£1', '£2'];
    const ref = greedy(target, set);
    let right = null;
    for (let t = 0; t < 30 && !right; t++) { const d = decompose(R, target, R.int(2, 5), set); if (d && d.join() !== ref.join()) right = d; }
    if (!right) right = ref;
    const wrongs = [];
    for (let t = 0; t < 60 && wrongs.length < 2; t++) {
      const w = [...right];
      const i = R.int(0, w.length - 1);
      const alt = R.pick(set.filter(n => n !== w[i]));
      w[i] = alt;
      if (sum(w) !== target && !wrongs.some(x => sum(x) === sum(w))) wrongs.push(byValue(w));
    }
    while (wrongs.length < 2) wrongs.push(byValue([...right, set[0]]));
    const opts = R.shuffle([['a', right], ['b', wrongs[0]], ['c', wrongs[1]]]);
    return {
      lines: [`This purse has ${say(target)}.`, `Which purse also makes ${say(target)}?`],
      widget: 'coins', props: coinProps(ref, { showTotal: true }),
      input: 'choice', answer: 'a',
      options: opts.map(([v, p]) => ({ label: '', value: v, widget: 'coins', props: coinProps(p) })),
      hint: ['Count each purse.', 'Start with the biggest coin.'],
      explain: [`${right.join(' + ')} makes ${say(target)} too.`, 'Different coins, same amount.'],
    };
  },
};

/* ---------- Change ---------- */
const ITEMS = ['star sticker', 'space snack', 'moon map', 'robot badge', 'fuel can', 'torch', 'crystal', 'comet card', 'alien toy', 'rocket pen'];
export const changeFrom = {
  about: 'Pay with one coin and work out the change',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const pay = level === 1 ? R.pick([10, 20]) : level === 2 ? 50 : 100;
    let price;
    do { price = level === 1 ? R.int(pay - 9, pay - 1) : level === 2 ? R.int(1, 9) * 5 : R.int(2, 19) * 5; } while (price * 2 === pay || price <= 0);
    const item = R.pick(ITEMS);
    const coin = pay === 100 ? '£1' : `${pay}p`;
    const change = pay - price;
    const small = level === 1 ? null : { pay: level === 2 ? 20 : 50, price: level === 2 ? R.int(11, 18) : R.pick([15, 20, 30, 35, 40, 45]) };
    return {
      lines: [`A ${item} costs ${say(price)}.`, `You pay with ${coin === '£1' ? 'a £1 coin' : `a ${coin} coin`}.`, 'How much change do you get?'],
      widget: 'coins', props: coinProps([coin], { price }),
      input: 'numpad', answer: change, unit: 'p',
      hint: [`Count on from ${say(price)} to ${say(pay)}.`],
      hintWidget: { widget: 'coins', props: coinProps([coin], { price }) },
      explain: [`${say(price)} and ${say(change)} makes ${say(pay)}.`, `The change is ${say(change)}.`],
      reteach: small ? {
        lines: [`It costs ${say(small.price)}. You pay ${say(small.pay)}.`, 'How much change?'],
        input: 'numpad', answer: small.pay - small.price, unit: 'p',
        hint: [`Count on from ${small.price} to ${small.pay}.`], explain: [`${small.price} + ${small.pay - small.price} = ${small.pay}.`],
      } : undefined,
    };
  },
};

/* ---------- Word problems with money ---------- */
export const moneyProblem = {
  about: 'Add and take away prices in the same unit',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const [i1, i2] = R.sample(ITEMS, 2);
    if (level === 1) {
      const a = R.int(2, 10), b = R.int(2, 9);
      return {
        lines: [`A ${i1} costs ${a}p.`, `A ${i2} costs ${b}p.`, 'How much for both?'],
        caption: `${a}p + ${b}p = ?`, input: 'numpad', answer: a + b, unit: 'p',
        hint: ['Start with the bigger price.', 'Count on the smaller one.'],
        hintWidget: { widget: 'coins', props: coinProps([...greedy(a, PENCE), ...greedy(b, PENCE)]) },
        explain: [`${a} + ${b} = ${a + b}.`, `Both cost ${a + b}p.`],
      };
    }
    if (level === 2) {
      const kind = R.pick(['add', 'left', 'more']);
      if (kind === 'add') {
        const a = R.int(2, 7) * 5 + R.pick([0, 0, 2, 3]), b = R.int(1, 5) * 10;
        return {
          lines: [`A ${i1} costs ${a}p.`, `A ${i2} costs ${b}p.`, 'How much for both?'],
          input: 'numpad', answer: a + b, unit: 'p',
          hint: ['Add the tens first.', 'Then add the ones.'], explain: [`${a} + ${b} = ${a + b}.`],
          reteach: { lines: ['Add the tens.'], caption: `${Math.floor(a / 10) * 10} + ${b} = ?`, input: 'numpad', answer: Math.floor(a / 10) * 10 + b, hint: ['Count on in tens.'], explain: [`${Math.floor(a / 10) * 10} + ${b} = ${Math.floor(a / 10) * 10 + b}.`] },
        };
      }
      if (kind === 'left') {
        const have = R.pick([50, 60, 80, 100]), spend = R.int(1, have / 10 - 1) * 10 - R.pick([0, 0, 5]);
        if (have - spend === spend) return moneyProblem.make(2, R);
        return {
          lines: [`You have ${say(have)}.`, `You spend ${spend}p on a ${i1}.`, 'How much is left?'],
          input: 'numpad', answer: have - spend, unit: 'p',
          hint: [`Take ${spend} away from ${have}.`, `Or count on from ${spend} to ${have}.`], explain: [`${have} − ${spend} = ${have - spend}.`],
        };
      }
      const a = R.int(3, 9) * 5, d = R.int(1, 6) * 5, b = a + d;
      if (d === a) return moneyProblem.make(2, R);
      return {
        lines: [`A ${i1} costs ${b}p.`, `A ${i2} costs ${a}p.`, `How much more is the ${i1}?`],
        input: 'numpad', answer: d, unit: 'p',
        hint: [`Count on from ${a} to ${b}.`], explain: [`${a} + ${d} = ${b}.`, `It costs ${d}p more.`],
      };
    }
    const kind = R.pick(['add', 'more', 'add3']);
    if (kind === 'add') {
      const a = R.int(3, 18), b = R.int(3, 15);
      return {
        lines: [`A ${i1} costs £${a}.`, `A ${i2} costs £${b}.`, 'How much for both?'],
        input: 'numpad', answer: a + b, prefix: '£',
        hint: ['Make 10 first if you can.'], explain: [`£${a} + £${b} = £${a + b}.`],
      };
    }
    if (kind === 'add3') {
      const [a, b, c] = [R.int(2, 9), R.int(2, 9), R.int(2, 9)];
      return {
        lines: [`You buy 3 things: £${a}, £${b} and £${c}.`, 'How much altogether?'],
        input: 'numpad', answer: a + b + c, prefix: '£',
        hint: ['Look for 2 numbers that make 10.', 'Add the third one on.'], explain: [`${a} + ${b} + ${c} = ${a + b + c}.`, `That is £${a + b + c}.`],
      };
    }
    const have = R.int(11, 25), price = have + R.int(2, 9);
    return {
      lines: [`You have £${have}.`, `A ${i1} costs £${price}.`, 'How much more do you need?'],
      input: 'numpad', answer: price - have, prefix: '£',
      hint: [`Count on from £${have} to £${price}.`], explain: [`£${have} + £${price - have} = £${price}.`, `You need £${price - have} more.`],
    };
  },
};

/* ---------- Pounds and pence ---------- */
export const poundsPence = {
  about: 'Read £ and p: 100p is £1',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    if (level === 1) {
      if (R.chance(0.5)) {
        const [a, b] = R.pick([['50p', '£1'], ['£2', '20p'], ['99p', '£1'], ['£5', '50p'], ['10p', '£1']]);
        const va = a.startsWith('£') ? +a.slice(1) * 100 : parseInt(a, 10), vb = b.startsWith('£') ? +b.slice(1) * 100 : parseInt(b, 10);
        const answer = va > vb ? a : b;
        return {
          lines: ['Which is worth more?'], input: 'choice', answer, options: R.shuffle([a, b]),
          hint: ['£ means pounds. p means pence.', '£1 is the same as 100p.'], explain: [`${answer} is worth more.`, '£1 is 100p.'],
        };
      }
      return {
        lines: ['How many pence make £1?'], input: 'numpad', answer: 100, unit: 'p',
        hint: ['Ten 10p coins make £1.', 'Count in 10s.'], hintWidget: { widget: 'coins', props: coinProps(Array(10).fill('10p')) },
        explain: ['10, 20, 30... 100.', '100p is £1.'],
      };
    }
    if (level === 2) {
      const P = R.int(1, 4), q = R.pick([0, 0, 50, 20, 10, 5]);
      const t = P * 100 + q;
      return {
        lines: [`${say(t)} is how many pence?`], input: 'numpad', answer: t, unit: 'p',
        hint: ['£1 is 100p.', `So £${P} is ${P * 100}p.`], explain: [`£${P} is ${P * 100}p.`, ...(q ? [`${P * 100} + ${q} = ${t}.`] : [])],
        reteach: { lines: [`£${P} is how many pence?`], input: 'numpad', answer: P * 100, unit: 'p', hint: ['£1 is 100p.'], explain: [`${P} lots of 100 is ${P * 100}.`] },
      };
    }
    const P = R.int(1, 5), q = R.int(11, 95);
    const t = P * 100 + q;
    const dec = `£${P}.${String(q).padStart(2, '0')}`;
    if (R.chance(0.5)) {
      return {
        lines: ['Look at the price tag.', `It shows £${P} and how many pence?`], widget: 'coins', props: coinProps([], { price: t }),
        input: 'numpad', answer: q, unit: 'p',
        hint: ['The numbers after the dot are the pence.'], explain: [`${dec} is £${P} and ${q}p.`],
      };
    }
    const qs = String(q).padStart(2, '0');
    const pool = [`£${q}.${String(P).padStart(2, '0')}`, `£${P}.${qs[1]}${qs[0]}`, `£${P + 1}.${qs}`];
    return {
      lines: [`Which price is £${P} and ${q}p?`], input: 'choice', answer: dec, options: pickOptions(R, dec, pool),
      hint: ['Pounds come before the dot.', 'Pence come after the dot.'], explain: [`£${P} and ${q}p is written ${dec}.`],
    };
  },
};

/* ---------- Compare amounts ---------- */
export const compareAmounts = {
  about: 'Compare amounts of money with <, > and =',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    if (level === 1) {
      let a, b;
      do { a = purse(R, R.int(2, 3), ['1p', '2p', '5p', '10p'], 25); b = purse(R, R.int(2, 3), ['1p', '2p', '5p', '10p'], 25); } while (sum(a) === sum(b));
      const more = R.chance(0.6);
      const answer = (more ? sum(a) > sum(b) : sum(a) < sum(b)) ? 'a' : 'b';
      return {
        lines: [more ? 'Which purse has more money?' : 'Which purse has less money?'], input: 'choice', answer,
        options: [{ label: '', value: 'a', widget: 'coins', props: coinProps(byValue(a)) }, { label: '', value: 'b', widget: 'coins', props: coinProps(byValue(b)) }],
        hint: ['Count each purse.', 'Start with the biggest coin.'],
        explain: [`One purse has ${say(sum(a))}. The other has ${say(sum(b))}.`],
      };
    }
    let x, y, xs, ys;
    if (level === 2) {
      x = R.int(1, 19) * 5; y = R.chance(0.2) ? x : R.int(1, 19) * 5;
      if (R.chance(0.3) && x !== y) y = Number(String(x).split('').reverse().join('')) || y;
      xs = `${x}p`; ys = `${y}p`;
    } else {
      const pairs = [[100, '£1', 100, '100p'], [200, '£2', 150, '150p'], [90, '90p', 100, '£1'], [100, '£1', 99, '99p'], [500, '£5', 50, '50p'], [200, '£2', 200, '200p'], [120, '£1 and 20p', 200, '£2'], [300, '£3', 250, '250p']];
      const pr = R.pick(pairs);
      [x, xs, y, ys] = R.chance(0.5) ? pr : [pr[2], pr[3], pr[0], pr[1]];
    }
    const answer = x > y ? '>' : x < y ? '<' : '=';
    return {
      lines: ['Which sign goes in the gap?'], caption: `${xs}  ?  ${ys}`, input: 'choice', answer, options: ['<', '>', '='],
      hint: ['The open side faces the bigger amount.', '£1 is 100p.'],
      explain: [`${xs} ${answer === '=' ? 'is the same as' : answer === '>' ? 'is more than' : 'is less than'} ${ys}.`],
    };
  },
};
