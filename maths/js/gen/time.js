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
const fivesTo = n => Array.from({ length: n }, (_, k) => 5 * (k + 1)).join(', ');
// A nudge for reading a clock: lines that point at the picture, and clock props that change it to help
// (a blue ring where the long hand is, the shaded sweep of the long hand, the minute numbers, past and to).
function clockHint(m, dig = false) {
  const k = m / 5;
  if (m === 0) return { hint: ['Look at the long blue hand first. Which number is it on?', 'Then find the number the short red hand points to.'], hintProps: { ring: [12] } };
  if (dig) return { hint: ['Count in 5s from 12 round to the long blue hand.', 'The short red hand gives the hour: the number it has just passed.'], hintProps: { minuteLabels: true, sweep: 'past', ring: [k] } };
  if (m === 30) return { hint: ['The long blue hand is on 6: half way round.', 'The short red hand is between 2 numbers. Which one has it just passed?'], hintProps: { sweep: true, ring: [6] } };
  if (m === 15) return { hint: ['The long blue hand is on 3: a quarter of the way round.', 'Which number has the short red hand just passed?'], hintProps: { sweep: true, pastTo: true, ring: [3] } };
  if (m === 45) return { hint: ['The long blue hand is on 9. The orange part is the quarter of an hour still to go.', 'Which number is the short red hand nearly at?'], hintProps: { sweep: true, ring: [9] } };
  if (m < 30) return { hint: ['Count in 5s from 12 round to the long blue hand.', 'Which number has the short red hand just passed?'], hintProps: { sweep: true, pastTo: true, minuteLabels: true, ring: [k] } };
  return { hint: ['The long blue hand is past 6, so it is a "to" time.', 'Count in 5s along the orange part, from the long hand to 12.'], hintProps: { sweep: true, ring: [k] } };
}
// The method, long hand first (DfE): "The long hand is on 3, that's 15 minutes past. The short hand..."
function clockExplain(h, m, dig = false) {
  const nx = hh(h + 1), k = m / 5;
  let long;
  if (m === 0) long = "The long hand points to 12, so it is o'clock.";
  else if (dig) long = `The long hand is on ${k}. Count in 5s: ${fivesTo(k)}.`;
  else if (m === 30) long = 'The long hand points to 6: half way round. That is half past.';
  else if (m === 15) long = "The long hand points to 3. That's 15 minutes past: quarter past.";
  else if (m === 45) long = "The long hand points to 9. That's 15 minutes to go: quarter to.";
  else if (m < 30) long = `The long hand is on ${k}: ${fivesTo(k)}. That's ${m} minutes past.`;
  else long = `The long hand is on ${k}. Count on to 12: ${fivesTo((60 - m) / 5)}. That's ${60 - m} minutes to.`;
  let short;
  if (m === 0) short = `The short hand points to ${h}.`;
  else if (m < 30) short = `The short hand has just passed ${h}.`;
  else if (m === 30) short = `The short hand is half way from ${h} to ${nx}.`;
  else short = dig ? `The short hand is nearly at ${nx}, so the hour is still ${h}.` : `The short hand is nearly at ${nx}.`;
  return [long, short, `It is ${dig ? digital(h, m) : clockWords(h, m)}.`];
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
    const { hint, hintProps } = clockHint(m);
    const explain = clockExplain(h, m);
    // Level 3: half the time type it with the colon key.
    if (level === 3 && (params.numpad === true || (params.numpad !== false && R.chance(0.5)))) {
      const dh = clockHint(m, true);
      const rm = m < 30 ? m : m - 30;
      return {
        lines: ['What time does the clock show?', 'Type the hour, the colon, then the minutes.'],
        widget: 'clock', props, input: 'numpad', answer: digital(h, m),
        hint: dh.hint, hintProps: dh.hintProps, explain: clockExplain(h, m, true),
        reteach: {
          lines: ['Look at the long blue hand.', 'How many minutes past the hour?'],
          widget: 'clock', props: { h, m: rm, readonly: true, minuteLabels: true }, input: 'numpad', answer: rm, unit: 'minutes',
          hint: ['Count in 5s from 12 round to the long hand.'], hintProps: { sweep: 'past', ring: [rm / 5] },
          explain: [`The long hand is on ${rm / 5}.`, `Count in 5s: ${fivesTo(rm / 5)}. That is ${rm} minutes.`],
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
      hint, hintProps, explain,
      reteach: level > 1 && m !== 0 && m !== 30 ? {
        lines: ['Where is the long blue hand?', 'Is it in the past half or the to half?'], widget: 'clock', props: { h, m, readonly: true, pastTo: true }, input: 'choice',
        answer: m < 30 ? 'past' : 'to', options: [{ label: 'The past half', value: 'past' }, { label: 'The to half', value: 'to' }],
        hint: ['The past half is the blue side, on the right.', 'The to half is the orange side, on the left.'],
        explain: [m < 30 ? 'The long hand is on the blue right side: past.' : 'The long hand is on the orange left side: to.'],
      } : level > 1 ? {
        lines: ['Look at the long blue hand.', "Is it o'clock or half past?"], widget: 'clock', props: { h, m, readonly: true }, input: 'choice',
        answer: m === 0 ? "o'clock" : 'half past', options: ["o'clock", 'half past'],
        hint: ["On 12 means o'clock. On 6 means half past."], hintProps: { ring: [m === 0 ? 12 : 6] },
        explain: [m === 0 ? "The long hand is on 12: o'clock." : 'The long hand is on 6: half past.'],
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
    const nx = hh(h + 1), k = m / 5;
    // Hint: ring the number the long hand goes to (blue) and the hour the short hand goes near (red).
    let hint, ringHour;
    if (m === 0) { hint = ['The long blue hand goes on 12, in the blue ring.', `Then turn the short red hand to ${h}.`]; ringHour = [h]; }
    else if (m === 30) { hint = ['The long blue hand goes on 6, in the blue ring.', `The short red hand goes half way from ${h} to ${nx}.`]; ringHour = [h, nx]; }
    else if (m < 30) { hint = [`${m === 15 ? 'Quarter past' : `${m} minutes past`}: the long blue hand goes on ${k}.`, `The short red hand goes just past ${h}.`]; ringHour = [h]; }
    else { hint = [`${m === 45 ? 'Quarter to' : `${60 - m} minutes to`}: the long blue hand goes on ${k}.`, `The short red hand goes nearly to ${nx}.`]; ringHour = [nx]; }
    if (useDigits && m > 30) hint[0] = `${m} minutes: count in 5s to ${m}. The long blue hand goes on ${k}.`;
    return {
      lines: [useDigits ? 'Make the clock show this time.' : `Make the clock say ${w}.`, 'Drag the long hand, then check the short hand.'],
      caption: useDigits ? digital(h, m) : w,
      widget: 'clock', props: { ...start, interactive: true, snap, minuteLabels: level === 3, pastTo: level === 2, digital: false },
      input: 'widget', goal: { h, m },
      hint, hintProps: { ring: [m === 0 ? 12 : k], ringHour, pastTo: level >= 2 && !useDigits },
      explain: clockExplain(h, m, useDigits),
      reteach: level > 1 ? {
        lines: [`Make the clock say ${h} o'clock.`], caption: `${h} o'clock`,
        widget: 'clock', props: { h: h === 12 ? 6 : 12, m: 0, interactive: true, snap: 60 }, input: 'widget', goal: { h, m: 0 },
        hint: ['The long blue hand stays on 12.', `Turn the short red hand to ${h}.`], hintProps: { ring: [12], ringHour: [h] },
        explain: ["The long hand on 12 means o'clock.", `The short hand points to ${h}: ${h} o'clock.`],
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
    let lines, answer, pool, hint, explain;
    const kind = level === 1 ? R.pick(['after', 'after', 'before']) : level === 2 ? R.pick(['yesterday', 'tomorrow', 'before']) : R.pick(['2after', '2ago', 'weekend']);
    // Hints say the days up to the gap ("Tuesday, Wednesday, ...?") so Finn says the next one himself.
    const fwd = `Say them in order: ${day(i - 1)}, ${day(i)}, ...?`;
    const back = `Say them backwards: ${day(i + 1)}, ${day(i)}, ...?`;
    if (kind === 'after') { lines = [`What day comes after ${day(i)}?`]; answer = day(i + 1); pool = [day(i - 1), day(i + 2), day(i + 3)]; hint = ['After means the next day.', fwd]; explain = [`${day(i - 1)}, ${day(i)}, ${day(i + 1)}.`, `${day(i + 1)} comes after ${day(i)}.`]; }
    else if (kind === 'before') { lines = [`What day comes before ${day(i)}?`]; answer = day(i - 1); pool = [day(i + 1), day(i - 2), day(i + 2)]; hint = ['Before means the day just in front.', back]; explain = [`${day(i - 1)}, ${day(i)}, ${day(i + 1)}.`, `${day(i - 1)} comes before ${day(i)}.`]; }
    else if (kind === 'yesterday') { lines = [`Today is ${day(i)}.`, 'What day was it yesterday?']; answer = day(i - 1); pool = [day(i + 1), day(i - 2), day(i + 2)]; hint = ['Yesterday is the day before today.', back]; explain = [`Yesterday is the day before ${day(i)}.`, `${day(i - 1)}, then ${day(i)}. So yesterday was ${day(i - 1)}.`]; }
    else if (kind === 'tomorrow') { lines = [`Today is ${day(i)}.`, 'What day will it be tomorrow?']; answer = day(i + 1); pool = [day(i - 1), day(i + 2), day(i - 2)]; hint = ['Tomorrow is the day after today.', fwd]; explain = [`Tomorrow is the day after ${day(i)}.`, `${day(i)}, then ${day(i + 1)}. So tomorrow is ${day(i + 1)}.`]; }
    else if (kind === '2after') { lines = [`Today is ${day(i)}.`, 'What day will it be in 2 days?']; answer = day(i + 2); pool = [day(i + 1), day(i + 3), day(i - 2)]; hint = [`Start at ${day(i)}.`, 'Say the next day, then the next. Count 2 on your fingers.']; explain = [`${day(i)}, then 1 day: ${day(i + 1)}.`, `2 days: ${day(i + 2)}.`]; }
    else if (kind === '2ago') { lines = [`Today is ${day(i)}.`, 'What day was it 2 days ago?']; answer = day(i - 2); pool = [day(i - 1), day(i + 2), day(i - 3)]; hint = [`Start at ${day(i)}.`, 'Say the day before, then the one before that.']; explain = [`${day(i)}, back 1 day: ${day(i - 1)}.`, `Back 2 days: ${day(i - 2)}.`]; }
    else {
      const which = R.pick(['first', 'last']);
      lines = [`The weekend is Saturday and Sunday.`, `Which day comes ${which === 'first' ? 'just before' : 'just after'} the weekend?`];
      answer = which === 'first' ? 'Friday' : 'Monday';
      pool = which === 'first' ? ['Monday', 'Thursday', 'Sunday'] : ['Friday', 'Sunday', 'Tuesday'];
      hint = which === 'first' ? ['Which day comes just before Saturday?', 'Say them in order: Thursday, ..., Saturday.'] : ['Which day comes just after Sunday?', 'The week starts again after Sunday.'];
      explain = which === 'first' ? ['Thursday, Friday, Saturday.', 'Friday is just before the weekend.'] : ['Saturday, Sunday, then Monday.', 'Monday is just after the weekend.'];
    }
    return {
      lines, input: 'choice', answer, options: pickOptions(R, answer, pool), hint, explain,
      reteach: level > 1 ? { lines: [`What day comes after ${day(i)}?`], input: 'choice', answer: day(i + 1), options: pickOptions(R, day(i + 1), [day(i - 1), day(i + 3)]), hint: [fwd], explain: [`${day(i - 1)}, ${day(i)}, ${day(i + 1)}.`, `After ${day(i)} comes ${day(i + 1)}.`] } : undefined,
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
        hint: ['Say the months in order from January.', 'Tap each one when you say it.'],
        explain: ['Say them from January: January, February, March...', `${answer[0]} comes first, then ${answer[1]}, then ${answer[2]}.`],
      };
    }
    let lines, answer, pool, hint, explain;
    const kind = level === 1 ? 'after' : level === 2 ? R.pick(['before', 'first', 'last', 'before']) : R.pick(['2after', '2before']);
    if (kind === 'after') { lines = [`Which month comes after ${mon(i)}?`]; answer = mon(i + 1); pool = [mon(i - 1), mon(i + 2), mon(i + 3)]; hint = ['After means the next one.', `Say them in order: ${mon(i - 1)}, ${mon(i)}, ...?`]; explain = [`${mon(i - 1)}, ${mon(i)}, ${mon(i + 1)}.`, `${mon(i + 1)} comes after ${mon(i)}.`]; }
    else if (kind === 'before') { lines = [`Which month comes before ${mon(i)}?`]; answer = mon(i - 1); pool = [mon(i + 1), mon(i - 2), mon(i + 2)]; hint = ['Before means the one just in front.', `Say them backwards: ${mon(i + 1)}, ${mon(i)}, ...?`]; explain = [`${mon(i - 1)}, ${mon(i)}, ${mon(i + 1)}.`, `${mon(i - 1)} comes before ${mon(i)}.`]; }
    else if (kind === 'first') { lines = ['Which is the first month of the year?']; answer = 'January'; pool = ['December', 'March', 'June']; hint = ['Which month has New Year\'s Day?']; explain = ['The year starts in January.', 'January, February, March...']; }
    else if (kind === 'last') { lines = ['Which is the last month of the year?']; answer = 'December'; pool = ['January', 'November', 'October']; hint = ['Which month has Christmas?', 'The year ends in that month.']; explain = ['...October, November, December.', 'December is the last month.']; }
    else if (kind === '2after') { lines = [`It is ${mon(i)}.`, 'Which month will it be in 2 months?']; answer = mon(i + 2); pool = [mon(i + 1), mon(i + 3), mon(i - 2)]; hint = [`Start at ${mon(i)}.`, 'Say the next month, then the next.']; explain = [`${mon(i)}, then 1 month: ${mon(i + 1)}.`, `2 months: ${mon(i + 2)}.`]; }
    else { lines = [`It is ${mon(i)}.`, 'Which month was it 2 months ago?']; answer = mon(i - 2); pool = [mon(i - 1), mon(i + 2), mon(i - 3)]; hint = [`Start at ${mon(i)}.`, 'Say the month before, then the one before that.']; explain = [`${mon(i)}, back 1 month: ${mon(i - 1)}.`, `Back 2 months: ${mon(i - 2)}.`]; }
    return { lines, input: 'choice', answer, options: pickOptions(R, answer, pool), hint, explain };
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
    let answer, lines, explain, hint;
    const low = t => t[0].toLowerCase() + t.slice(1);
    if (level === 1) {
      if (R.chance(0.5)) {
        answer = ['morning', 'afternoon', 'evening'];
        lines = ['Put the parts of the day in order.', 'Start with the earliest.'];
        hint = ['When do you eat breakfast?', 'That part of the day comes first.'];
        explain = ['Breakfast is in the morning, so morning is first.', 'Then afternoon. Evening comes last, before bed.'];
      } else {
        answer = R.pick(STORIES);
        lines = ['Put the story in order.', 'What happens first?'];
        hint = ['Imagine doing it for real.', `Can you ${low(answer[1])} before you ${low(answer[0])}?`];
        explain = [`First: ${answer[0]}.`, `Next: ${answer[1]}.`, `Last: ${answer[2]}.`];
      }
    } else if (level === 2) {
      if (R.chance(0.5)) {
        answer = R.pick(STORIES4);
        lines = ['Put the story in order.', 'What happens first?'];
        hint = ['Imagine doing it for real.', `What has to happen before you can ${low(answer[3])}?`];
        explain = [`First: ${answer[0]}. Then: ${answer[1]}.`, `Then: ${answer[2]}. Last: ${answer[3]}.`];
      } else {
        answer = ['yesterday', 'today', 'tomorrow'];
        lines = ['Put these in order.', 'Start with the earliest.'];
        hint = ['Yesterday has already happened.', 'Tomorrow has not happened yet.'];
        explain = ['Yesterday was before today.', 'Tomorrow comes after today.'];
      }
    } else {
      if (R.chance(0.5)) {
        answer = ['the day before yesterday', 'yesterday', 'today', 'tomorrow'];
        lines = ['Put these in order.', 'Start with the earliest.'];
        hint = ['The day before yesterday was 2 days ago.', 'Tomorrow has not happened yet.'];
        explain = ['The day before yesterday is earliest.', 'Then yesterday, today, tomorrow.'];
      } else {
        const hs = R.distinct(3, 7, 11).sort((a, b) => a - b);
        const acts = R.sample(['Space school', 'Rocket repair', 'Moon walk', 'Fuel check', 'Star map', 'Robot race'], 3);
        answer = hs.map((h, k) => `${acts[k]} at ${h} o'clock`);
        lines = ['Put the day in order.', 'Earliest first.'];
        hint = ["Look at the o'clock numbers.", 'In the morning, the smallest number is the earliest.'];
        explain = [`${hs[0]} o'clock comes first.`, `Then ${hs[1]}, then ${hs[2]} o'clock.`];
      }
    }
    return {
      lines, input: 'order', options: shuffleNotSame(R, answer), answer, hint, explain,
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
// d: how long it takes, in words a six-year-old can picture.
const ACTS = [
  { t: 'Blinking', s: 0.3, d: 'less than a second' }, { t: 'A rocket countdown from 10', s: 10, d: 'about 10 seconds' },
  { t: 'Brushing your teeth', s: 120, d: 'about 2 minutes' }, { t: 'Eating a snack', s: 300, d: 'about 5 minutes' },
  { t: 'A school playtime', s: 900, d: 'about 15 minutes' }, { t: 'A film', s: 6000, d: 'about 2 hours' },
  { t: 'A night of sleep', s: 36000, d: 'about 10 hours' }, { t: 'A trip to the Moon', s: 260000, d: 'about 3 days' },
  { t: 'Saying your name', s: 1, d: 'about 1 second' }, { t: 'Putting on your shoes', s: 60, d: 'about 1 minute' },
  { t: 'A school day', s: 22000, d: 'about 6 hours' },
];
const UNIT_S = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 };
const span = (n, u) => `${n} ${u}${n === 1 ? '' : 's'}`;
const lowFirst = t => t[0].toLowerCase() + t.slice(1);
// Write a span in the smaller unit of a pair, so the two can be compared: [2, 'hour'] in minutes is "120 minutes".
function convert(x, y) {
  const [big, small] = UNIT_S[x[1]] >= UNIT_S[y[1]] ? [x, y] : [y, x];
  if (big[1] === small[1]) return null;
  const k = UNIT_S[big[1]] / UNIT_S[small[1]];
  if (!Number.isInteger(k) || k > 168) return null;
  return { big, small, n: big[0] * k, unit: small[1], line: `${span(...big)} is ${span(big[0] * k, small[1])}.`, fact: `1 ${big[1]} is ${span(k, small[1])}.` };
}
function compareLines(x, y) {
  const c = convert(x, y);
  if (!c) return { hint: ['Look at the units first.'], why: [] };
  const an = u => (u === 'hour' ? 'an hour' : `a ${u}`), An = u => an(u)[0].toUpperCase() + an(u).slice(1);
  if (c.big[0] === c.small[0] || c.small[0] < c.big[0]) return { hint: [`${An(c.big[1])} is much longer than ${an(c.small[1])}.`], why: [`${An(c.big[1])} is much longer than ${an(c.small[1])}.`] };
  return { hint: [c.fact, `So compare ${span(c.n, c.unit)} and ${span(...c.small)}.`], why: [c.line] };
}
export const compareIntervals = {
  about: 'Compare and order intervals of time',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    if (level === 1) {
      let a, b;
      do { [a, b] = R.sample(ACTS, 2); } while (Math.max(a.s, b.s) / Math.min(a.s, b.s) < 4);
      const longer = R.chance(0.6);
      const win = longer ? (a.s > b.s ? a : b) : (a.s < b.s ? a : b);
      return {
        lines: [longer ? 'Which takes longer?' : 'Which is quicker?'], input: 'choice', answer: win.t, options: [a.t, b.t],
        hint: ['Imagine doing both.', longer ? 'Which one goes on and on?' : 'Which one is over fast?'],
        explain: [`${a.t} takes ${a.d}.`, `${b.t} takes ${b.d}.`, `So ${lowFirst(win.t)} ${longer ? 'takes longer' : 'is quicker'}.`],
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
      const cl = compareLines(x, y);
      return {
        lines: [longer ? 'Which is longer?' : 'Which is shorter?'], input: 'choice', answer, options: [span(...x), span(...y)],
        hint: cl.hint,
        explain: [...cl.why, `So ${answer} is ${longer ? 'longer' : 'shorter'}.`],
      };
    }
    if (R.chance(0.5)) {
      // Each set comes with the fact that helps to order it.
      const sets = [
        [[[30, 'second'], [30, 'minute'], [1, 'hour']], ['Seconds are quick, minutes are longer.', '1 hour is 60 minutes.']],
        [[[1, 'minute'], [1, 'hour'], [1, 'day']], ['Minutes, then hours, then days.', '1 day is 24 hours.']],
        [[[45, 'minute'], [2, 'hour'], [1, 'day']], ['1 hour is 60 minutes, so 2 hours is 120.', '1 day is 24 hours.']],
        [[[10, 'second'], [10, 'minute'], [1, 'week']], ['Seconds, then minutes.', 'A week is 7 whole days.']],
        [[[50, 'minute'], [1, 'hour'], [90, 'minute']], ['1 hour is 60 minutes.', 'So compare 50, 60 and 90 minutes.']],
        [[[1, 'day'], [1, 'week'], [30, 'hour']], ['1 day is 24 hours.', '1 week is 7 days.']],
      ];
      const [set, hint] = R.pick(sets);
      const answer = [...set].sort((p, q) => p[0] * UNIT_S[p[1]] - q[0] * UNIT_S[q[1]]).map(p => span(...p));
      return {
        lines: ['Put them in order.', 'Shortest time first.'], input: 'order', options: shuffleNotSame(R, answer), answer,
        hint, explain: [...hint, `Shortest first: ${answer.join(', ')}.`],
      };
    }
    const cmp = R.pick([
      [[1, 'hour'], [60, 'minute'], '='], [[1, 'minute'], [60, 'second'], '='], [[1, 'day'], [24, 'hour'], '='],
      [[1, 'hour'], [45, 'minute'], '>'], [[30, 'minute'], [1, 'hour'], '<'], [[2, 'hour'], [100, 'minute'], '>'],
      [[1, 'week'], [10, 'day'], '<'], [[90, 'second'], [1, 'minute'], '>'],
    ]);
    const c = convert(cmp[0], cmp[1]);
    const word = cmp[2] === '=' ? 'is the same as' : cmp[2] === '>' ? 'is longer than' : 'is shorter than';
    return {
      lines: ['Which sign goes in the gap?'], caption: `${span(...cmp[0])}  ?  ${span(...cmp[1])}`,
      input: 'choice', answer: cmp[2], options: ['<', '>', '='],
      hint: c ? [c.fact, 'The open side faces the longer time.'] : ['The open side faces the longer time.'],
      explain: cmp[2] === '=' ? [...(c ? [c.line] : []), `They are the same, so ${span(...cmp[0])} = ${span(...cmp[1])}.`]
        : [...(c ? [c.line] : []), `${span(...cmp[0])} ${word} ${span(...cmp[1])}.`, `So ${span(...cmp[0])} ${cmp[2]} ${span(...cmp[1])}.`],
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
    // Option values are the names shown, so the answer reads naturally ("Rocket").
    if (level === 1 || level === 3) {
      let ta, tb;
      if (level === 1) { ta = R.int(3, 9); do { tb = R.int(3, 9); } while (Math.abs(tb - ta) < 2); }
      else { ta = R.int(10, 30); do { tb = R.int(10, 30); } while (Math.abs(tb - ta) < 1 || Math.abs(tb - ta) > 6); }
      const quick = R.chance(0.5);
      const answer = (quick ? ta < tb : ta > tb) ? an : bn;
      return {
        lines: level === 1 ? [`${an} finished the race in ${ta} seconds.`, `${bn} took ${tb} seconds.`, quick ? 'Who was quicker?' : 'Who was slower?']
          : [`${an}: ${ta} seconds. ${bn}: ${tb} seconds.`, quick ? 'Who was quicker?' : 'Who was slower?'],
        input: 'choice', answer,
        options: [{ label: `${an}: ${ta} seconds`, value: an, art: aa }, { label: `${bn}: ${tb} seconds`, value: bn, art: ba }],
        hint: quick ? ['Quicker means it took less time.', `Which is smaller, ${ta} or ${tb}?`] : ['Slower means it took more time.', `Which is bigger, ${ta} or ${tb}?`],
        explain: [`${Math.min(ta, tb)} seconds is less time than ${Math.max(ta, tb)} seconds.`, `So ${answer} was ${quick ? 'quicker' : 'slower'}.`],
      };
    }
    const ha = R.int(6, 11);
    let hb; do { hb = R.int(6, 11); } while (hb === ha);
    const early = R.chance(0.5);
    const answer = (early ? ha < hb : ha > hb) ? an : bn;
    return {
      lines: ['These clocks show when each one woke up.', early ? 'Who woke up earlier?' : 'Who woke up later?'],
      input: 'choice', answer,
      options: [{ label: an, value: an, widget: 'clock', props: { h: ha, m: 0 } }, { label: bn, value: bn, widget: 'clock', props: { h: hb, m: 0 } }],
      hint: ['Read the short red hand on each clock.', early ? 'Earlier is the smaller hour in the morning.' : 'Later is the bigger hour in the morning.'],
      explain: [`${an} woke at ${ha} o'clock. ${bn} woke at ${hb} o'clock.`, early ? `${Math.min(ha, hb)} o'clock comes first, so ${answer} woke up earlier.` : `${Math.max(ha, hb)} o'clock comes after ${Math.min(ha, hb)} o'clock, so ${answer} woke up later.`],
    };
  },
};
