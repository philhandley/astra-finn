// Demo generators used only by the core's dev test mission (dev/zz-test.json).
import { factKey } from '../core/facts.js';

export const countDots = {
  about: 'Count dots in a tens frame (dev test)',
  levels: 2,
  make(level, R) {
    const n = level === 1 ? R.int(3, 10) : R.int(11, 20);
    if (level === 1) {
      const opts = R.shuffle([n, Math.max(1, n - 1), n + 1]);
      return { lines: ['How many counters?'], widget: 'tensframe', props: { count: n }, input: 'choice', options: opts, answer: n,
        hint: ['Count each counter once.'], explain: [`There are ${n}.`] };
    }
    return { lines: ['How many counters?'], widget: 'tensframe', props: { count: n, frames: 2 }, input: 'numpad', answer: n,
      hint: ['A full frame is 10.', 'Then count on.'], explain: [`10 and ${n - 10} is ${n}.`] };
  },
};

export const addFact = {
  about: 'Add within 10 (dev test)',
  levels: 1,
  make(level, R) {
    const a = R.int(1, 6), b = R.int(1, 10 - a);
    return { lines: ['Work it out.'], caption: `${a} + ${b} = ?`, input: 'numpad', answer: a + b, fact: factKey('+', a, b),
      hint: [`Start at ${a} and count on ${b}.`], explain: [`${a} and ${b} make ${a + b}.`],
      reteach: { lines: ['Count them.'], widget: 'tensframe', props: { colours: [a, b] }, input: 'numpad', answer: a + b, hint: ['Count every counter.'], explain: [`${a + b}.`] } };
  },
};

export const makeN = {
  about: 'Make a number on the tens frame (dev test)',
  levels: 1,
  make(level, R) {
    const n = R.int(4, 9);
    return { lines: [`Make ${n} on the tens frame.`], widget: 'tensframe', props: { count: 0 }, input: 'widget', goal: { count: n },
      hint: ['Tap the frame to add a counter.', 'Tap a counter to take it away.'], explain: [`${n} counters.`] };
  },
};
