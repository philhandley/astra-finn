// Time generators (Measure Lab and Launch Pad): clocks, days, months, sequencing and intervals.
// Each export: { about, levels, make(level, R, params) } -> item (see ENGINE.md section 4.1).
// Check: dev/gen.html?gen=time&all=1
import { clockWords } from '../widgets/clock.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const hh = h => ((h - 1 + 1200) % 12) + 1;
const digital = (h, m) => `${h}:${String(m).padStart(2, '0')}`;
const lv = (level, max) => Math.max(1, Math.min(max, Math.round(level) || 1));

// Up to n distinct options (correct first), shuffled.
function pickOptions(R, correct, pool, n = 3) {
  const out = [correct];
  for (const d of R.shuffle(pool)) { if (out.length >= n) break; if (!out.some(o => String(o) === String(d))) out.push(d); }
  return R.shuffle(out);
}

/* ---------- Reading the clock ---------- */
function clockHint(m) {
  if (m === 0) return ['The long hand points to 12.', 'That means o\'clock.'];
  if (m === 30) return ['The long hand points to 6.', 'That means half past.'];
  if (m === 15) return ['The long hand points to 3.', 'That is a quarter of the way round.'];
  if (m === 45) return ['The long hand points to 9.', 'A quarter more to go to the next hour.'];
  return ['Count the minutes in 5s from the 12.', 'Then look at the short hand.'];
}
function clockExplain(h, m) {
  const w = clockWords(h, m);
  const shortHand = m === 0 ? `The short hand points to ${h}.` : m === 30 ? `The short hand is halfway from ${h} to ${hh(h + 1)}.` : m < 30 ? `The short hand is just past ${h}.` : `The short hand is nearly at ${hh(h + 1)}.`;
  const longHand = m === 0 ? 'The long hand points to 12.' : `The long hand points to ${m / 5 === 0 ? 12 : m / 5}. That is ${m} minutes.`;
  return [shortHand, longHand, `It is ${w}.`];
}

export const readClock = {
  about: "Read the time on a clock: o'clock and half past, quarter past and to, then five minutes",
  levels: 3,
  make(level, R, params = {}) {
    level = lv(level, 3);
    const h = R.int(1, 12);
    let m;
    if (level === 1) m = R.pick([0, 30]);
    else if (level === 2) m = R.pick([15, 45, 15, 45, 0, 30]);
    else m = R.pick([5, 10, 20, 25, 35, 40, 50, 55, 15, 45]);
    const right = clockWords(h, m);
    const props = { h, m, readonly: true, minuteLabels: level === 3 && !!params.minuteLabels };
    const hint = clockHint(m);
    const explain = clockExplain(h, m);
    // Level 3: half the time type it with the colon key.
    if (level === 3 && (params.numpad === true || (params.numpad !== false && R.chance(0.5)))) {
      return {
        lines: ['What time does the clock show?', 'Type the hour, the colon, then the minutes.'],
        widget: 'clock', props, input: 'numpad', answer: digital(h, m),
        hint, hintProps: { minuteLabels: true }, explain: [...explain.slice(0, 2), `It is ${digital(h, m)}.`],
        reteach: {
          lines: ['Look at the long hand.', 'How many minutes past the hour?'],
          widget: 'clock', props: { h, m: m < 30 ? m : m - 30, readonly: true, minuteLabels: true }, input: 'numpad', answer: m < 30 ? m : m - 30, unit: 'minutes',
          hint: ['Count in 5s from the 12.'], explain: [`The long hand is on ${(m < 30 ? m : m - 30) / 5}.`, `That is ${m < 30 ? m : m - 30} minutes.`],
        },
      };
    }
    const pool = [];
    const next = hh(h + 1), prev = hh(h - 1);
    if (m === 0) pool.push(`half past ${h}`, `${next} o'clock`, `${prev} o'clock`, `12 o'clock`);
    else if (m === 30) pool.push(`half past ${next}`, `${h} o'clock`, `half past ${prev}`);
    else if (m === 15) pool.push(`quarter to ${h}`, `quarter past ${next}`, `half past ${h}`);
    else if (m === 45) pool.push(`quarter past ${h}`, `quarter to ${h}`, `quarter past ${next}`);
    else {
      const other = m < 30 ? `${m} to ${h}` : `${60 - m} past ${next}`;
      pool.push(other, m < 30 ? `${m} past ${next}` : `${60 - m} to ${h}`, clockWords(h, (m + 5) % 60 || 5));
    }
    return {
      lines: ['What time does the clock show?'],
      widget: 'clock', props, input: 'choice', answer: right, options: pickOptions(R, right, pool),
      hint, hintProps: level >= 2 ? { pastTo: true, minuteLabels: level === 3 } : undefined,
      explain,
      reteach: level > 1 ? {
        lines: ['Where is the long hand?'], widget: 'clock', props: { h, m, readonly: true, pastTo: true }, input: 'choice',
        answer: m < 30 ? 'past' : 'to', options: [{ label: 'In the past half', value: 'past' }, { label: 'In the to half', value: 'to' }],
        hint: ['The past half is on the right.'], explain: [m < 30 ? 'It is in the past half.' : 'It is in the to half.'],
      } : undefined,
    };
  },
};

export const setClock = {
  about: 'Drag the hands to show a time',
  levels: 3,
  make(level, R, params = {}) {
    level = lv(level, 3);
    const h = R.int(1, 12);
    const m = level === 1 ? R.pick([0, 30]) : level === 2 ? R.pick([15, 45, 15, 45, 30]) : R.pick([5, 10, 20, 25, 35, 40, 50, 55]);
    const snap = level === 1 ? 30 : level === 2 ? 15 : 5;
    const start = (h === 12 && m === 0) ? { h: 6, m: 0 } : { h: 12, m: 0 };
    const w = clockWords(h, m);
    const useDigits = level === 3 && R.chance(0.5);
    return {
      lines: [useDigits ? 'Make the clock show this time.' : `Make the clock say ${w}.`, 'Drag the long hand, then check the short hand.'],
      caption: useDigits ? digital(h, m) : w,
      widget: 'clock', props: { ...start, interactive: true, snap, minuteLabels: level === 3, pastTo: level === 2, digital: false },
      input: 'widget', goal: { h, m },
      hint: [...clockHint(m).slice(0, 1), m === 0 ? `The short hand points to ${h}.` : m <= 30 ? `The short hand goes just past ${h}.` : `The short hand goes nearly to ${hh(h + 1)}.`],
      hintProps: { minuteLabels: level >= 2, pastTo: level >= 2 },
      explain: clockExplain(h, m),
      reteach: level > 1 ? {
        lines: [`Make the clock say ${h} o'clock.`], caption: `${h} o'clock`,
        widget: 'clock', props: { h: h === 12 ? 6 : 12, m: 0, interactive: true, snap: 60 }, input: 'widget', goal: { h, m: 0 },
        hint: ['The long hand points to 12.', `The short hand points to ${h}.`], explain: [`The short hand on ${h}, the long hand on 12.`],
      } : undefined,
    };
  },
};

/* ---------- Days and months ---------- */
export const daysOfWeek = {
  about: 'Days of the week: after, before, yesterday and tomorrow',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const i = R.int(0, 6);
    const day = k => DAYS[((k % 7) + 7) % 7];
    let lines, answer, pool;
    const kind = level === 1 ? R.pick(['after', 'after', 'before']) : level === 2 ? R.pick(['yesterday', 'tomorrow', 'before']) : R.pick(['2after', '2ago', 'weekend']);
    if (kind === 'after') { lines = [`What day comes after ${day(i)}?`]; answer = day(i + 1); pool = [day(i - 1), day(i + 2), day(i + 3)]; }
    else if (kind === 'before') { lines = [`What day comes before ${day(i)}?`]; answer = day(i - 1); pool = [day(i + 1), day(i - 2), day(i + 2)]; }
    else if (kind === 'yesterday') { lines = [`Today is ${day(i)}.`, 'What day was it yesterday?']; answer = day(i - 1); pool = [day(i + 1), day(i - 2), day(i + 2)]; }
    else if (kind === 'tomorrow') { lines = [`Today is ${day(i)}.`, 'What day will it be tomorrow?']; answer = day(i + 1); pool = [day(i - 1), day(i + 2), day(i - 2)]; }
    else if (kind === '2after') { lines = [`Today is ${day(i)}.`, 'What day will it be in 2 days?']; answer = day(i + 2); pool = [day(i + 1), day(i + 3), day(i - 2)]; }
    else if (kind === '2ago') { lines = [`Today is ${day(i)}.`, 'What day was it 2 days ago?']; answer = day(i - 2); pool = [day(i - 1), day(i + 2), day(i - 3)]; }
    else {
      const which = R.pick(['first', 'last']);
      lines = [`The weekend is Saturday and Sunday.`, `Which day comes ${which === 'first' ? 'just before' : 'just after'} the weekend?`];
      answer = which === 'first' ? 'Friday' : 'Monday';
      pool = which === 'first' ? ['Monday', 'Thursday', 'Sunday'] : ['Friday', 'Sunday', 'Tuesday'];
    }
    return {
      lines, input: 'choice', answer, options: pickOptions(R, answer, pool),
      hint: ['Say the days in order.', 'Monday, Tuesday, Wednesday, Thursday...'],
      explain: [`The answer is ${answer}.`, 'Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.'],
      reteach: level > 1 ? { lines: [`What day comes after ${day(i)}?`], input: 'choice', answer: day(i + 1), options: pickOptions(R, day(i + 1), [day(i - 1), day(i + 3)]), hint: ['Say the days in order.'], explain: [`After ${day(i)} comes ${day(i + 1)}.`] } : undefined,
    };
  },
};

export const months = {
  about: 'Months of the year: order, before and after',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const i = R.int(0, 11);
    const mon = k => MONTHS[((k % 12) + 12) % 12];
    if (level === 3 && R.chance(0.5)) {
      const picks = R.sample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 3).sort((a, b) => a - b);
      const answer = picks.map(k => MONTHS[k]);
      return {
        lines: ['Put these months in order.', 'Start with the one nearest January.'],
        input: 'order', options: R.shuffle(answer), answer,
        hint: ['Say the months in order from January.'],
        explain: [`${answer.join(', ')}.`, 'January comes first in the year.'],
      };
    }
    let lines, answer, pool;
    const kind = level === 1 ? 'after' : level === 2 ? R.pick(['before', 'first', 'last', 'before']) : R.pick(['2after', '2before']);
    if (kind === 'after') { lines = [`Which month comes after ${mon(i)}?`]; answer = mon(i + 1); pool = [mon(i - 1), mon(i + 2), mon(i + 3)]; }
    else if (kind === 'before') { lines = [`Which month comes before ${mon(i)}?`]; answer = mon(i - 1); pool = [mon(i + 1), mon(i - 2), mon(i + 2)]; }
    else if (kind === 'first') { lines = ['Which is the first month of the year?']; answer = 'January'; pool = ['December', 'March', 'June']; }
    else if (kind === 'last') { lines = ['Which is the last month of the year?']; answer = 'December'; pool = ['January', 'November', 'October']; }
    else if (kind === '2after') { lines = [`It is ${mon(i)}.`, 'Which month will it be in 2 months?']; answer = mon(i + 2); pool = [mon(i + 1), mon(i + 3), mon(i - 2)]; }
    else { lines = [`It is ${mon(i)}.`, 'Which month was it 2 months ago?']; answer = mon(i - 2); pool = [mon(i - 1), mon(i + 2), mon(i - 3)]; }
    return {
      lines, input: 'choice', answer, options: pickOptions(R, answer, pool),
      hint: ['Say the months in order.', 'January, February, March, April...'],
      explain: [`The answer is ${answer}.`, 'There are 12 months in a year.'],
    };
  },
};

/* ---------- Sequencing ---------- */
const STORIES = [
  ['Build the rocket', 'Fill it with fuel', 'Blast off'],
  ['Put on the space suit', 'Climb into the rocket', 'Count down'],
  ['Wake up', 'Eat breakfast', 'Go to school'],
  ['Land on the Moon', 'Open the hatch', 'Step outside'],
  ['Plant the seed', 'Water it', 'See the flower'],
  ['Mix the cake', 'Bake it', 'Eat a slice'],
];
const STORIES4 = [
  ['Build the rocket', 'Fill it with fuel', 'Count down', 'Blast off'],
  ['Wake up', 'Get dressed', 'Eat breakfast', 'Go to school'],
  ['Land on the Moon', 'Open the hatch', 'Step outside', 'Plant a flag'],
];
export const sequenceEvents = {
  about: 'Put events in order: first, next, last; morning, afternoon, evening',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    let answer, lines, explain;
    if (level === 1) {
      if (R.chance(0.5)) {
        answer = ['morning', 'afternoon', 'evening'];
        lines = ['Put the parts of the day in order.', 'Start with the earliest.'];
        explain = ['First morning, then afternoon.', 'Evening comes last.'];
      } else {
        answer = R.pick(STORIES);
        lines = ['Put the story in order.', 'What happens first?'];
        explain = [`First: ${answer[0]}.`, `Next: ${answer[1]}.`, `Last: ${answer[2]}.`];
      }
    } else if (level === 2) {
      if (R.chance(0.5)) {
        answer = R.pick(STORIES4);
        lines = ['Put the story in order.', 'What happens first?'];
        explain = [`First: ${answer[0]}.`, `Last: ${answer[3]}.`];
      } else {
        answer = ['yesterday', 'today', 'tomorrow'];
        lines = ['Put these in order.', 'Start with the earliest.'];
        explain = ['Yesterday was before today.', 'Tomorrow comes after today.'];
      }
    } else {
      if (R.chance(0.5)) {
        answer = ['the day before yesterday', 'yesterday', 'today', 'tomorrow'];
        lines = ['Put these in order.', 'Start with the earliest.'];
        explain = ['The day before yesterday is earliest.', 'Then yesterday, today, tomorrow.'];
      } else {
        const hs = R.distinct(3, 7, 11).sort((a, b) => a - b);
        const acts = R.sample(['Space school', 'Rocket repair', 'Moon walk', 'Lunch', 'Star map', 'Robot race'], 3);
        answer = hs.map((h, k) => `${acts[k]} at ${h} o'clock`);
        lines = ['Put the day in order.', 'Earliest first.'];
        explain = [`${hs[0]} o'clock comes first.`, `Then ${hs[1]}, then ${hs[2]} o'clock.`];
      }
    }
    return {
      lines, input: 'order', options: shuffleNotSame(R, answer), answer,
      hint: ['What happens first?', 'Then what happens next?'], explain,
    };
  },
};
function shuffleNotSame(R, arr) {
  for (let k = 0; k < 8; k++) { const s = R.shuffle(arr); if (s.some((v, i) => v !== arr[i])) return s; }
  return [...arr].reverse();
}

/* ---------- Facts about time ---------- */
const FACTS = {
  1: [
    { q: ['How many days are in 1 week?'], a: 7, unit: 'days', hint: ['Say the days and count them.'], ex: ['Monday to Sunday is 7 days.'] },
    { q: ['How many months are in 1 year?'], a: 12, unit: 'months', hint: ['Say the months and count them.'], ex: ['January to December is 12 months.'] },
    { q: ['How many days are in a weekend?'], a: 2, unit: 'days', hint: ['Saturday and...'], ex: ['Saturday and Sunday. 2 days.'] },
  ],
  2: [
    { q: ['How many minutes are in 1 hour?'], a: 60, unit: 'minutes', hint: ['The long hand goes all the way round.', 'Count the minutes in 5s.'], hw: { widget: 'clock', props: { h: 12, m: 0, minuteLabels: true, readonly: true } }, ex: ['The long hand goes round once in 1 hour.', 'That is 60 minutes.'] },
    { q: ['How many hours are in 1 day?'], a: 24, unit: 'hours', hint: ['The short hand goes round twice in 1 day.', '12 and 12 more.'], ex: ['12 hours in the day, 12 in the night.', 'That is 24 hours.'] },
    { q: ['How many seconds are in 1 minute?'], a: 60, unit: 'seconds', hint: ['It is the same as minutes in an hour.'], ex: ['There are 60 seconds in 1 minute.'] },
  ],
  3: [
    { q: ['How many minutes are in half an hour?'], a: 30, unit: 'minutes', hint: ['Half of 60.'], hw: { widget: 'clock', props: { h: 12, m: 30, minuteLabels: true, readonly: true } }, ex: ['1 hour is 60 minutes.', 'Half of 60 is 30.'] },
    { q: ['How many minutes are in a quarter of an hour?'], a: 15, unit: 'minutes', hint: ['The long hand goes from 12 to 3.'], hw: { widget: 'clock', props: { h: 12, m: 15, minuteLabels: true, readonly: true } }, ex: ['From 12 to 3 is 15 minutes.'] },
    { q: ['How many minutes are in 2 hours?'], a: 120, unit: 'minutes', hint: ['1 hour is 60 minutes.', '60 and 60 more.'], ex: ['60 + 60 = 120.'] },
    { q: ['How many days are in 2 weeks?'], a: 14, unit: 'days', hint: ['1 week is 7 days.'], ex: ['7 + 7 = 14.'] },
    { q: ['How many hours are in 2 days?'], a: 48, unit: 'hours', hint: ['1 day is 24 hours.'], ex: ['24 + 24 = 48.'] },
  ],
};
export const timeFacts = {
  about: 'Know the facts: days in a week, minutes in an hour, hours in a day',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const f = R.pick(FACTS[level]);
    const base = level > 1 ? R.pick(FACTS[level - 1]) : null;
    return {
      lines: f.q, input: 'numpad', answer: f.a, unit: f.unit,
      hint: f.hint, hintWidget: f.hw, explain: f.ex,
      reteach: base ? { lines: base.q, input: 'numpad', answer: base.a, unit: base.unit, hint: base.hint, explain: base.ex } : undefined,
    };
  },
};

/* ---------- Comparing intervals ---------- */
const ACTS = [
  { t: 'Blinking', s: 0.3 }, { t: 'A rocket countdown from 10', s: 10 }, { t: 'Brushing your teeth', s: 120 },
  { t: 'Eating a snack', s: 300 }, { t: 'A school playtime', s: 900 }, { t: 'A film', s: 6000 },
  { t: 'A night of sleep', s: 36000 }, { t: 'A trip to the Moon', s: 260000 }, { t: 'Saying your name', s: 1 },
  { t: 'Putting on your shoes', s: 60 }, { t: 'A school day', s: 22000 },
];
const UNIT_S = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 };
const span = (n, u) => `${n} ${u}${n === 1 ? '' : 's'}`;
export const compareIntervals = {
  about: 'Compare and order intervals of time',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    if (level === 1) {
      let a, b;
      do { [a, b] = R.sample(ACTS, 2); } while (Math.max(a.s, b.s) / Math.min(a.s, b.s) < 4);
      const longer = R.chance(0.6);
      const answer = (longer ? (a.s > b.s ? a : b) : (a.s < b.s ? a : b)).t;
      return {
        lines: [longer ? 'Which takes longer?' : 'Which is quicker?'], input: 'choice', answer, options: [a.t, b.t],
        hint: ['Imagine doing both.', longer ? 'Which one goes on and on?' : 'Which one is over fast?'],
        explain: [`${answer} ${longer ? 'takes longer' : 'is quicker'}.`],
      };
    }
    if (level === 2) {
      const pairs = [
        [[2, 'minute'], [2, 'hour']], [[1, 'hour'], [50, 'minute']], [[1, 'day'], [20, 'hour']], [[1, 'minute'], [50, 'second']],
        [[30, 'minute'], [1, 'hour']], [[3, 'day'], [1, 'week']], [[90, 'second'], [1, 'minute']], [[5, 'minute'], [5, 'second']],
        [[1, 'hour'], [70, 'minute']], [[2, 'week'], [10, 'day']],
      ];
      const [x, y] = R.shuffle(R.pick(pairs));
      const sx = x[0] * UNIT_S[x[1]], sy = y[0] * UNIT_S[y[1]];
      const longer = R.chance(0.6);
      const answer = span(...((longer ? sx > sy : sx < sy) ? x : y));
      return {
        lines: [longer ? 'Which is longer?' : 'Which is shorter?'], input: 'choice', answer, options: [span(...x), span(...y)],
        hint: ['1 minute is 60 seconds.', '1 hour is 60 minutes. 1 day is 24 hours.'],
        explain: [`${answer} is ${longer ? 'longer' : 'shorter'}.`],
      };
    }
    if (R.chance(0.5)) {
      const sets = [
        [[30, 'second'], [30, 'minute'], [1, 'hour']], [[1, 'minute'], [1, 'hour'], [1, 'day']], [[45, 'minute'], [2, 'hour'], [1, 'day']],
        [[10, 'second'], [10, 'minute'], [1, 'week']], [[50, 'minute'], [1, 'hour'], [90, 'minute']], [[1, 'day'], [1, 'week'], [30, 'hour']],
      ];
      const set = R.pick(sets);
      const answer = [...set].sort((p, q) => p[0] * UNIT_S[p[1]] - q[0] * UNIT_S[q[1]]).map(p => span(...p));
      return {
        lines: ['Put them in order.', 'Shortest time first.'], input: 'order', options: shuffleNotSame(R, answer), answer,
        hint: ['1 hour is 60 minutes.', '1 day is 24 hours.'], explain: [`${answer.join(', ')}.`],
      };
    }
    const cmp = R.pick([
      [[1, 'hour'], [60, 'minute'], '='], [[1, 'minute'], [60, 'second'], '='], [[1, 'day'], [24, 'hour'], '='],
      [[1, 'hour'], [45, 'minute'], '>'], [[30, 'minute'], [1, 'hour'], '<'], [[2, 'hour'], [100, 'minute'], '>'],
      [[1, 'week'], [10, 'day'], '<'], [[90, 'second'], [1, 'minute'], '>'],
    ]);
    return {
      lines: ['Which sign goes in the gap?'], caption: `${span(...cmp[0])}  ?  ${span(...cmp[1])}`,
      input: 'choice', answer: cmp[2], options: ['<', '>', '='],
      hint: ['1 hour is 60 minutes.', '1 minute is 60 seconds. 1 day is 24 hours.'],
      explain: [`${span(...cmp[0])} ${cmp[2] === '=' ? 'is the same as' : cmp[2] === '>' ? 'is longer than' : 'is shorter than'} ${span(...cmp[1])}.`],
    };
  },
};

/* ---------- Year 1: quicker, slower, earlier, later ---------- */
const RACERS = [['rocket', 'Rocket'], ['robot', 'Robot'], ['alien', 'Alien'], ['astronaut', 'Astronaut'], ['ufo', 'UFO'], ['comet', 'Comet']];
export const quickerSlower = {
  about: 'Year 1: quicker and slower, earlier and later',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const [[aa, an], [ba, bn]] = R.sample(RACERS, 2);
    if (level === 1) {
      const ta = R.int(3, 9);
      let tb; do { tb = R.int(3, 9); } while (Math.abs(tb - ta) < 2);
      const quick = R.chance(0.5);
      const answer = (quick ? ta < tb : ta > tb) ? aa : ba;
      return {
        lines: [`${an} ran the race in ${ta} seconds.`, `${bn} took ${tb} seconds.`, quick ? 'Who was quicker?' : 'Who was slower?'],
        input: 'choice', answer, options: [{ label: an, value: aa, art: aa }, { label: bn, value: ba, art: ba }],
        hint: ['Quicker means it took less time.'],
        explain: [`${Math.min(ta, tb)} seconds is less time than ${Math.max(ta, tb)}.`, `${answer === aa ? an : bn} was ${quick ? 'quicker' : 'slower'}.`],
      };
    }
    if (level === 2) {
      const ha = R.int(6, 11);
      let hb; do { hb = R.int(6, 11); } while (hb === ha);
      const early = R.chance(0.5);
      const answer = (early ? ha < hb : ha > hb) ? aa : ba;
      return {
        lines: ['These clocks show when each one woke up.', early ? 'Who woke up earlier?' : 'Who woke up later?'],
        input: 'choice', answer,
        options: [{ label: an, value: aa, widget: 'clock', props: { h: ha, m: 0 } }, { label: bn, value: ba, widget: 'clock', props: { h: hb, m: 0 } }],
        hint: ['Read each clock.', early ? 'Earlier is the smaller hour in the morning.' : 'Later is the bigger hour in the morning.'],
        explain: [`${an} woke at ${ha} o'clock. ${bn} woke at ${hb} o'clock.`, `${answer === aa ? an : bn} woke up ${early ? 'earlier' : 'later'}.`],
      };
    }
    const ta = R.int(10, 30);
    let tb; do { tb = R.int(10, 30); } while (Math.abs(tb - ta) < 1 || Math.abs(tb - ta) > 6);
    const quick = R.chance(0.5);
    const answer = (quick ? ta < tb : ta > tb) ? aa : ba;
    return {
      lines: [`${an}: ${ta} seconds. ${bn}: ${tb} seconds.`, quick ? 'Who was quicker?' : 'Who was slower?'],
      input: 'choice', answer, options: [{ label: an, value: aa, art: aa }, { label: bn, value: ba, art: ba }],
      hint: ['Quicker means less time.', `Which is smaller, ${ta} or ${tb}?`],
      explain: [`${Math.min(ta, tb)} is less than ${Math.max(ta, tb)}.`, `${answer === aa ? an : bn} was ${quick ? 'quicker' : 'slower'}.`],
    };
  },
};
