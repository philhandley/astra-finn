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
// How many running totals to show under the coins as a counting-on hint: enough to get going, never the last.
const hintCounts = n => Math.max(1, n - 2);
// Counting on from a price to the coin paid: to the next 10, then in 10s. Returns the stops and the jumps.
function countOnSteps(from, to) {
  const stops = [from], jumps = [];
  let cur = from;
  while (cur < to) {
    const next = cur % 10 ? Math.min(to, Math.ceil(cur / 10) * 10) : Math.min(to, cur + 10);
    jumps.push(next - cur); stops.push(next); cur = next;
  }
  return { stops, jumps };
}
// A hint picture for counting on between two amounts: the smaller amount as coins (or notes) in the purse and
// the bigger one on the price tag. (Pence in, pence out; the purse never changes when the answer is shown.)
function gapCoins(a, b) {
  const set = greedy(a, a >= 100 ? ['1p', '2p', '5p', '10p', '20p', '50p', '£1', '£2', '£5', '£10', '£20'] : ALL) || [];
  return { widget: 'coins', props: coinProps(set, { price: b, showTotal: true, sort: true }) };
}
const LOOKS = {
  '1p': { hint: ['It is copper coloured.', 'Is it big or small next to the others?'], ex: ['1p and 2p are both copper.', '1p is the small one.'] },
  '2p': { hint: ['It is copper coloured.', 'Is it big or small next to the others?'], ex: ['1p and 2p are both copper.', '2p is the big one.'] },
  '5p': { hint: ['It is silver and round.', 'Is it big or small next to the others?'], ex: ['5p and 10p are silver and round.', '5p is the small one.'] },
  '10p': { hint: ['It is silver and round.', 'Is it big or small next to the others?'], ex: ['5p and 10p are silver and round.', '10p is the big one.'] },
  '20p': { hint: ['It is silver. Count its sides.', 'Is it big or small next to the others?'], ex: ['20p and 50p are silver with 7 sides.', '20p is the small one.'] },
  '50p': { hint: ['It is silver. Count its sides.', 'Is it big or small next to the others?'], ex: ['20p and 50p are silver with 7 sides.', '50p is the big one.'] },
  '£1': { hint: ['It is gold and silver.', 'Is it round, or does it have lots of sides?'], ex: ['£1 is gold and silver with 12 sides.', '£2 is gold and silver too, but round.'] },
  '£2': { hint: ['It is gold and silver.', 'Is it round, or does it have lots of sides?'], ex: ['£2 is round: gold outside, silver inside.', '£1 has 12 sides.'] },
};

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
          explain: [`${a} is ${V(a)} pence. ${b} is ${V(b)} pence.`, `${Math.max(V(a), V(b))} is more than ${Math.min(V(a), V(b))}, so ${answer} is worth more.`],
        };
      }
      const target = R.pick(ALL);
      const others = R.sample(ALL.filter(n => n !== target), 2);
      return {
        lines: [`Which coin is ${target}?`], input: 'choice', answer: target,
        options: R.shuffle([target, ...others]).map(n => ({ label: '', value: n, widget: 'coins', props: coinProps([n]) })),
        hint: ['Read the number on each coin.', `Which one says ${target}?`],
        explain: [`The ${target} coin has ${target} on it.`, LOOKS[target].ex[0]],
      };
    }
    if (level === 2) {
      const name = R.pick(ALL);
      const similar = { '1p': ['2p', '5p'], '2p': ['1p', '10p'], '5p': ['10p', '1p'], '10p': ['5p', '50p'], '20p': ['50p', '10p'], '50p': ['20p', '10p'], '£1': ['£2', '20p'], '£2': ['£1', '10p'] };
      const options = pickOptions(R, name, similar[name]);
      // The hint puts the look-alike coins beside it at their real sizes (still no numbers), with the mystery coin ringed.
      return {
        lines: ['This coin has no number on it.', 'Which coin is it?'],
        widget: 'coins', props: coinProps([name], { labels: false }),
        input: 'choice', answer: name, options,
        hint: LOOKS[name].hint,
        hintProps: { purse: [name, ...options.filter(o => o !== name)], highlight: [name], labels: false },
        explain: [...LOOKS[name].ex, `So it is ${name}.`],
      };
    }
    if (R.chance(0.5)) {
      const x = R.pick(['10p', '2p', '5p', '50p', '£2', '20p', '£5']);
      const pairs = { '10p': ['£1', 10, '10, 20, 30... up to 100.'], '2p': ['10p', 5, '2, 4, 6, 8, 10.'], '5p': ['10p', 2, '5, 10.'], '50p': ['£1', 2, '50, 100.'], '£2': ['£10', 5, '2, 4, 6, 8, 10.'], '20p': ['£1', 5, '20, 40, 60, 80, 100.'], '£5': ['£10', 2, '5, 10.'] };
      const [tot, a, ex] = pairs[x];
      const things = x === '£5' ? 'notes' : 'coins';
      // The hint makes the purse hands-on: tap the coin in until the total says the amount, then count.
      return {
        lines: [`How many of these ${things} make ${tot}?`], input: 'numpad', answer: a, widget: 'coins', props: coinProps([x], { countAnswer: true }),
        hint: [`Tap the ${x} again and again.`, `Stop when the purse shows ${tot}. Then count the ${things}.`],
        hintProps: { interactive: true, readonly: false, tray: [x], purse: [], showTotal: true, countAnswer: true },
        explain: [`Count in steps of ${x}: ${ex}`, `That is ${a} ${things}.`],
      };
    }
    const set = R.sample(['50p', '£1', '£2', '£5', '£10', '£20', '20p'], 3);
    const most = R.chance(0.6);
    const answer = byValue(set)[most ? 0 : 2];
    return {
      lines: [most ? 'Which is worth the most?' : 'Which is worth the least?'], input: 'choice', answer,
      options: R.shuffle(set).map(n => ({ label: '', value: n, widget: 'coins', props: coinProps([n]) })),
      hint: ['Pounds are worth more than pence.', '£1 is the same as 100p.'],
      explain: [`From most to least: ${byValue(set).join(', ')}.`, `${answer} is worth the ${most ? 'most' : 'least'}.`],
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
        hint: [`Start with the biggest coin: ${byValue(p)[0]}.`, 'Count on for each coin after it.'],
        hintProps: { sort: true, counts: hintCounts(p.length) }, explain: countLines(p),
        reteach: p.length > 2 ? { lines: ['How much is this?'], widget: 'coins', props: coinProps(byValue(small)), input: 'numpad', answer: sum(small), unit: 'p', hint: ['Count on from the biggest coin.'], explain: countLines(small) } : undefined,
      };
    }
    if (level === 2) {
      const p = purse(R, R.int(3, 5), PENCE, 100);
      const easy = byValue(p).slice(0, 2);
      return {
        lines: ['How much money is in the purse?'], widget: 'coins', props: coinProps(R.shuffle(p)),
        input: 'numpad', answer: sum(p), unit: 'p',
        hint: ['Put the biggest coin first, then count on.', 'The blue numbers show the counting so far.'],
        hintProps: { sort: true, counts: hintCounts(p.length) }, explain: countLines(p),
        reteach: { lines: ['Count these 2 coins.'], widget: 'coins', props: coinProps(easy), input: 'numpad', answer: sum(easy), unit: 'p', hint: ['Start with the bigger coin.'], explain: countLines(easy) },
      };
    }
    if (R.chance(0.5)) {
      const p = purse(R, R.int(2, 4), ['£1', '£2', '£5', '£10', '£20'], 4000);
      return {
        lines: ['How many pounds are in the purse?'], widget: 'coins', props: coinProps(R.shuffle(p)),
        input: 'numpad', answer: sum(p) / 100, prefix: '£',
        hint: ['Start with the biggest note.', 'Count on in pounds. The blue numbers show the counting so far.'],
        hintProps: { sort: true, counts: hintCounts(p.length) },
        explain: ['Biggest first, then count on.', countOn(p).join(', ') + '.', `That is ${say(sum(p))}.`],
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
      hint: ['Count the pounds first.', 'Then count on the pence.'], hintProps: { sort: true, counts: pounds.length },
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
      hint: [`The biggest coin that fits is ${way[0]}. Start with that.`, 'Watch the total. Tap a coin in the purse to take it out.'],
      hintProps: { showTotal: true },
      explain: [`Biggest coins first: ${way.join(', ')}.`, `Count on: ${countOn(way).join(', ')}.`],
      reteach: level > 1 ? {
        lines: [`Make ${say(small)}.`], caption: say(small),
        widget: 'coins', props: { tray: PENCE, purse: [], showTotal: true, interactive: true, maxItems: 12 }, input: 'widget', goal: { total: small },
        hint: [`Start with ${greedy(small, PENCE)[0]}.`, 'Then add coins until the total says ' + say(small) + '.'],
        explain: [`Biggest coins first: ${greedy(small, PENCE).join(', ')}.`, `Count on: ${countOn(greedy(small, PENCE)).join(', ')}.`],
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
      hint: ['Count each purse, biggest coin first.', `Which one gets to exactly ${say(target)}?`],
      explain: [`Count on: ${countOn(right).join(', ')}.`, `So that purse makes ${say(target)} too. Different coins, same amount.`],
    };
  },
};

/* ---------- Change ---------- */
const ITEMS = ['star sticker', 'space snack', 'moon map', 'robot badge', 'fuel can', 'torch', 'crystal', 'comet card', 'alien toy', 'rocket pen'];
// "a torch", "an alien toy"; capital A at the start of a line.
const an = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
const An = w => { const t = an(w); return t[0].toUpperCase() + t.slice(1); };
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
    let hint, explain;
    const ten = Math.ceil(price / 10) * 10;
    if (level === 1) {
      hint = [`Count on from ${price}p to ${pay}p.`, 'Hold up a finger for each 1p.'];
      const ones = Array.from({ length: change }, (_, k) => price + k + 1);
      explain = [`Count on from ${price}p: ${ones.join(', ')}.`, `That is ${change} finger${change === 1 ? '' : 's'}, so the change is ${change}p.`];
    } else if (ten === price || ten === pay) {
      // Already a ten (or one jump to the coin): count on in 10s, or one small jump.
      const steps = [];
      for (let v = ten === price ? price + 10 : pay; v <= pay; v += 10) steps.push(say(v));
      hint = [`Count on from ${say(price)} to ${say(pay)}.`, ten === price ? 'Count on in 10s.' : 'How many pence is that jump?'];
      explain = [ten === price ? `Count on in 10s from ${say(price)}: ${steps.join(', ')}.` : `${say(price)} and ${say(change)} makes ${say(pay)}.`, `The change is ${change}p.`];
    } else {
      // Two jumps: up to the next ten, then on to the coin.
      hint = [`Count on from ${say(price)} to ${say(pay)}.`, `First jump to ${say(ten)}.`];
      explain = [`${say(price)} + ${ten - price}p = ${say(ten)}. Then ${say(ten)} + ${pay - ten}p = ${say(pay)}.`, `${ten - price}p + ${pay - ten}p = ${change}p.`, `The change is ${change}p.`];
    }
    return {
      lines: [`${An(item)} costs ${say(price)}.`, `You pay with ${coin === '£1' ? 'a £1 coin' : `a ${coin} coin`}.`, 'How much change do you get?'],
      widget: 'coins', props: coinProps([coin], { price }),
      input: 'numpad', answer: change, unit: 'p',
      hint, explain,
      reteach: small ? {
        lines: [`It costs ${say(small.price)}. You pay ${say(small.pay)}.`, 'How much change?'],
        input: 'numpad', answer: small.pay - small.price, unit: 'p',
        hint: [`Count on from ${small.price}p to ${small.pay}p.`], explain: [`Count on: ${countOnSteps(small.price, small.pay).stops.map(say).join(', ')}.`, `${small.price} + ${small.pay - small.price} = ${small.pay}. The change is ${small.pay - small.price}p.`],
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
        lines: [`${An(i1)} costs ${a}p.`, `${An(i2)} costs ${b}p.`, 'How much for both?'],
        caption: `${a}p + ${b}p = ?`, input: 'numpad', answer: a + b, unit: 'p',
        hint: ['Start with the bigger price.', 'Count on the smaller one.'],
        hintWidget: { widget: 'coins', props: coinProps([...greedy(a, PENCE), ...greedy(b, PENCE)], { sort: true }) },
        explain: [`${a} + ${b} = ${a + b}.`, `Both cost ${a + b}p.`],
      };
    }
    if (level === 2) {
      const kind = R.pick(['add', 'left', 'more']);
      if (kind === 'add') {
        const a = R.int(2, 7) * 5 + R.pick([0, 0, 2, 3]), b = R.int(1, 5) * 10;
        return {
          lines: [`${An(i1)} costs ${a}p.`, `${An(i2)} costs ${b}p.`, 'How much for both?'],
          input: 'numpad', answer: a + b, unit: 'p',
          hint: [`Start at ${a}p.`, `${b}p is ${b / 10} ten${b === 10 ? '' : 's'}. Count on in tens.`],
          hintWidget: { widget: 'coins', props: coinProps([...greedy(a, PENCE), ...Array(b / 10).fill('10p')], { sort: true }) },
          explain: [`Start at ${a} and count on ${b / 10} ten${b === 10 ? '' : 's'}: ${Array.from({ length: b / 10 }, (_, k) => a + 10 * (k + 1)).join(', ')}.`, `${a} + ${b} = ${a + b}. Both cost ${a + b}p.`],
          reteach: { lines: ['Add the tens.'], caption: `${Math.floor(a / 10) * 10} + ${b} = ?`, input: 'numpad', answer: Math.floor(a / 10) * 10 + b, hint: ['Count on in tens.'], explain: [`${Math.floor(a / 10) * 10} + ${b} = ${Math.floor(a / 10) * 10 + b}.`] },
        };
      }
      if (kind === 'left') {
        const have = R.pick([50, 60, 80, 100]), spend = R.int(1, have / 10 - 1) * 10 - R.pick([0, 0, 5]);
        if (have - spend === spend) return moneyProblem.make(2, R);
        return {
          lines: [`You have ${say(have)}.`, `You spend ${spend}p on ${an(i1)}.`, 'How much is left?'],
          input: 'numpad', answer: have - spend, unit: 'p',
          hint: [`Count on from ${spend}p to ${have}p.`, `The purse shows ${spend}p. The tag shows ${say(have)}.`], hintWidget: gapCoins(spend, have),
          explain: [`Count on: ${countOnSteps(spend, have).stops.map(say).join(', ')}.`, `${have} − ${spend} = ${have - spend}. ${have - spend}p is left.`],
        };
      }
      const a = R.int(3, 9) * 5, d = R.int(1, 6) * 5, b = a + d;
      if (d === a) return moneyProblem.make(2, R);
      return {
        lines: [`${An(i1)} costs ${b}p.`, `${An(i2)} costs ${a}p.`, `How much more is the ${i1}?`],
        input: 'numpad', answer: d, unit: 'p',
        hint: [`Count on from ${a}p to ${b}p.`, `The purse shows ${a}p. The tag shows ${b}p.`], hintWidget: gapCoins(a, b),
        explain: [`Count on: ${countOnSteps(a, b).stops.map(say).join(', ')}.`, `${a} + ${d} = ${b}. It costs ${d}p more.`],
      };
    }
    const kind = R.pick(['add', 'more', 'add3']);
    if (kind === 'add') {
      const a = R.int(3, 18), b = R.int(3, 15);
      return {
        lines: [`${An(i1)} costs £${a}.`, `${An(i2)} costs £${b}.`, 'How much for both?'],
        input: 'numpad', answer: a + b, prefix: '£',
        hint: a < 10 && b < 10 && a + b > 10 ? [`Make 10 first: £${Math.max(a, b)} + £${10 - Math.max(a, b)} = £10.`, `Then add the £${a + b - 10} left over.`] : ['Add the tens first.', 'Then add the ones.'],
        explain: a < 10 && b < 10 && a + b > 10 ? [`£${Math.max(a, b)} + £${10 - Math.max(a, b)} = £10.`, `£10 + £${a + b - 10} = £${a + b}.`] : [`£${a} + £${b} = £${a + b}.`, `Both cost £${a + b}.`],
      };
    }
    if (kind === 'add3') {
      const [a, b, c] = [R.int(2, 9), R.int(2, 9), R.int(2, 9)];
      return {
        lines: [`You buy 3 things: £${a}, £${b} and £${c}.`, 'How much altogether?'],
        input: 'numpad', answer: a + b + c, prefix: '£',
        hint: [`Add £${a} and £${b} first.`, `Then add the £${c}.`], explain: [`£${a} + £${b} = £${a + b}.`, `£${a + b} + £${c} = £${a + b + c}.`],
      };
    }
    const have = R.int(11, 25), price = have + R.int(2, 9);
    return {
      lines: [`You have £${have}.`, `${An(i1)} costs £${price}.`, 'How much more do you need?'],
      input: 'numpad', answer: price - have, prefix: '£',
      hint: [`Count on from £${have} to £${price}.`, `The purse shows £${have}. The tag shows £${price}.`], hintWidget: gapCoins(have * 100, price * 100),
      explain: [`Count on from £${have}: ${Array.from({ length: price - have }, (_, k) => `£${have + k + 1}`).join(', ')}.`, `That is £${price - have}. You need £${price - have} more.`],
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
          hint: ['£ means pounds. p means pence.', '£1 is the same as 100p.'],
          explain: [`${a.startsWith('£') ? a : b} is ${a.startsWith('£') ? va : vb}p.`, `${Math.max(va, vb)}p is more than ${Math.min(va, vb)}p, so ${answer} is worth more.`],
        };
      }
      return {
        lines: ['How many pence make £1?'], input: 'numpad', answer: 100, unit: 'p',
        hint: ['Here are ten 10p coins. Together they make £1.', 'Count them in 10s.'], hintWidget: { widget: 'coins', props: coinProps(Array(10).fill('10p')) },
        explain: ['10, 20, 30, 40, 50, 60, 70, 80, 90, 100.', '100p is £1.'],
      };
    }
    if (level === 2) {
      const P = R.int(1, 4), q = R.pick([0, 0, 50, 20, 10, 5]);
      const t = P * 100 + q;
      return {
        lines: [`${say(t)} is how many pence?`], input: 'numpad', answer: t, unit: 'p',
        hint: q ? [P === 1 ? '£1 is 100p.' : `£1 is 100p, so £${P} is ${P * 100}p.`, `Then add on the ${q}p.`] : P === 1 ? ['Ten 10p coins make £1.', 'Count them in 10s.'] : ['£1 is 100p.', `Count in 100s, ${P} times.`],
        hintWidget: !q && P === 1 ? { widget: 'coins', props: coinProps(Array(10).fill('10p')) } : undefined,
        explain: [`£${P} is ${P * 100}p.`, ...(q ? [`${P * 100} + ${q} = ${t}.`] : [`${P} lots of 100 is ${P * 100}.`])],
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
        hint: ['The number before the dot is the pounds.', 'The numbers after the dot are the pence.'], explain: [`${dec}: £${P} before the dot.`, `${q} after the dot, so ${q}p.`],
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
        hint: ['Count each purse.', 'Start with the biggest coin, then count on.'],
        explain: [`One purse: ${countOn(a).join(', ')}.`, `The other purse: ${countOn(b).join(', ')}.`, `${say(Math.max(sum(a), sum(b)))} is more than ${say(Math.min(sum(a), sum(b)))}.`],
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
      hint: level === 2 ? ['Compare the tens first.', 'The open side faces the bigger amount.'] : ['Change pounds into pence: £1 is 100p.', 'The open side faces the bigger amount.'],
      explain: [...(level === 3 ? [[xs, x], [ys, y]].filter(([t]) => t.startsWith('£')).map(([t, v]) => `${t} is ${v}p.`) : []), `${xs} ${answer === '=' ? 'is the same as' : answer === '>' ? 'is more than' : 'is less than'} ${ys}.`, `So ${xs} ${answer} ${ys}.`],
    };
  },
};
