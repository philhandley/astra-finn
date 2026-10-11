// Measurement generators (Measure Lab and Launch Pad): rulers, scales, jugs, thermometers, units, comparing.
// Each export: { about, levels, make(level, R, params) } -> item (see ENGINE.md section 4.1).
// Readings always sit exactly on a mark. Level 1: labelled marks. Level 2: unlabelled marks between labels.
// Level 3: a ruler not starting at 0, or a scale counting in 2s, 5s or 50s.
// Check: dev/gen.html?gen=measure&all=1
const lv = (level, max) => Math.max(1, Math.min(max, Math.round(level) || 1));
const OBJ = ['pencil', 'crayon', 'worm', 'key', 'spoon', 'rocket'];
// Things to weigh: light things in grams, heavy things in kilograms (no 6 kg apples).
const MASS_G = ['boot', 'crystal', 'asteroid', 'helmet'];
const MASS_KG = ['robot', 'asteroid', 'fuel', 'crystal'];
const massThing = (R, unit, want) => { const list = unit === 'kg' ? MASS_KG : MASS_G; return list.includes(want) ? want : R.pick(list); };
const NAME = { pencil: 'pencil', crayon: 'crayon', worm: 'worm', key: 'key', spoon: 'spoon', rocket: 'rocket', asteroid: 'moon rock', apple: 'apple', crystal: 'crystal', robot: 'robot', helmet: 'helmet', boot: 'boot', fuel: 'fuel can', cookie: 'cookie', rover: 'rover' };

function pickOptions(R, correct, pool, n = 3) {
  const out = [correct];
  for (const d of R.shuffle(pool)) { if (out.length >= n) break; if (!out.some(o => String(o) === String(d))) out.push(d); }
  return R.shuffle(out);
}
// A value on a mark of the scale: onLabel true -> a labelled mark, false -> a mark between labels.
function onMark(R, min, max, marks, labels, onLabel) {
  const vals = [];
  for (let v = min + marks; v <= max - (onLabel ? 0 : marks) + 1e-9; v += marks) {
    const lab = Math.abs(v / labels - Math.round(v / labels)) < 1e-9;
    if (lab === onLabel) vals.push(Math.round(v));
  }
  return R.pick(vals.length ? vals : [min + marks]);
}
// The method for reading a scale: start at the labelled number below, then count on in the small marks.
// what: 'The needle points to' (scales), 'The water comes up to' (jug), 'The red line comes up to' (thermometer).
function scaleCount(v, labels, marks, what = 'The needle points to') {
  const below = Math.floor(v / labels) * labels;
  if (below === v) return [`${what} ${v}.`];
  const steps = [];
  for (let x = below + marks; x <= v + 1e-9; x += marks) steps.push(Math.round(x));
  return [`Each small mark is ${marks} more. Start at ${below}.`, `Count on in ${marks}s: ${steps.join(', ')}.`];
}
const belowLabel = (v, labels) => Math.floor(v / labels) * labels;
// A reading hint: point at the labelled number below (blue) and draw the count-on hops (purple) up to the reading.
function readHint(v, s, thing) {
  if (s.on) return { hint: [`Look where ${thing}.`, 'Read the number there.'], hintProps: undefined };
  const b = belowLabel(v, s.labels);
  return {
    hint: [`The numbers go up in ${s.labels}s. Each small mark is ${s.marks} more.`, `Start at ${b}, in the blue ring. Count on along the purple jumps.`],
    hintProps: { target: b, hops: b },
  };
}
// A setting hint: ring the number to find (labelled), or the labelled number to count on from.
function setHint(v, s, verb) {
  if (s.on) return { hint: [verb, `Find ${v}, in the blue ring.`], hintProps: { target: v } };
  const b = belowLabel(v, s.labels);
  return { hint: [`Start at ${b}, in the blue ring.`, `Each small mark is ${s.marks} more. Count on to ${v}.`], hintProps: { target: b } };
}
const PIC = {
  cm: 'A centimetre is about as wide as your finger.', m: 'A metre is about one big stride.',
  g: 'A gram is as light as a paper clip.', kg: 'A kilogram is like a bag of sugar.',
  ml: 'A millilitre is a tiny drop.', l: 'A litre is a big bottle of water.',
};

/* ---------- Reading scales ---------- */
export const readRuler = {
  about: 'Read the length of an object on a cm ruler',
  levels: 3,
  make(level, R, params = {}) {
    level = lv(level, 3);
    const obj = params.object || R.pick(OBJ);
    let max, start = 0, value, labels;
    if (level === 1) { max = 15; labels = 1; value = R.int(3, 15); }
    else if (level === 2) { max = R.pick([20, 30]); labels = max === 20 ? 2 : 5; do { value = R.int(3, max - 1); } while (value % labels === 0); }
    else { max = R.pick([20, 30]); labels = max === 20 ? 2 : 5; start = R.int(1, 8); value = R.int(3, Math.min(15, max - start)); }
    const end = start + value;
    const props = { tool: 'ruler', unit: 'cm', max, start, value, object: obj, marks: 1, labels, readonly: true };
    if (level === 3) {
      return {
        lines: [`The ${NAME[obj]} does not start at 0.`, `How long is the ${NAME[obj]}?`],
        widget: 'measure', props, input: 'numpad', answer: value, unit: 'cm',
        hint: [`It starts at ${start}, not 0.`, 'Count the purple jumps: one for each centimetre.'], hintProps: { hops: start },
        explain: [`It starts at ${start} and ends at ${end}.`, `${end} − ${start} = ${value}.`, `It is ${value} cm long.`],
        reteach: {
          lines: [`How long is the ${NAME[obj]} now?`], widget: 'measure', props: { ...props, start: 0 },
          input: 'numpad', answer: value, unit: 'cm', hint: ['It starts at 0 now.'], explain: [`It ends at ${value}.`, `So it is ${value} cm long.`],
        },
      };
    }
    const b = belowLabel(value, labels);
    return {
      lines: [`How long is the ${NAME[obj]}?`], widget: 'measure', props, input: 'numpad', answer: value, unit: 'cm',
      hint: level === 1 ? ['It starts at 0.', 'Follow the dashed line down from the end. What number is there?']
        : ['It starts at 0. The end is between 2 numbers.', `Start at ${b}, in the blue ring. Count on the purple jumps.`],
      hintProps: level === 1 ? undefined : { target: b, hops: b },
      explain: level === 1 ? [`The ${NAME[obj]} starts at 0.`, `It ends at ${value}.`, `It is ${value} cm long.`]
        : [`It starts at 0 and ends after ${b}.`, `Count on from ${b}: ${Array.from({ length: value - b }, (_, k) => b + k + 1).join(', ')}.`, `It is ${value} cm long.`],
      reteach: level === 2 ? {
        lines: [`How long is the ${NAME[obj]}?`], widget: 'measure', props: { ...props, max: 15, value: Math.min(value, 15), labels: 1 },
        input: 'numpad', answer: Math.min(value, 15), unit: 'cm', hint: ['Every centimetre has a number here.'], explain: [`It ends at ${Math.min(value, 15)}.`],
      } : undefined,
    };
  },
};

const SCALE_SETS = {
  1: [{ unit: 'kg', max: 10, labels: 1, marks: 1, on: true }, { unit: 'g', max: 1000, labels: 100, marks: 100, on: true }, { unit: 'kg', max: 5, labels: 1, marks: 1, on: true }],
  2: [{ unit: 'g', max: 1000, labels: 100, marks: 50, on: false }, { unit: 'kg', max: 10, labels: 2, marks: 1, on: false }, { unit: 'g', max: 1000, labels: 200, marks: 100, on: false }],
  3: [{ unit: 'kg', max: 20, labels: 10, marks: 2, on: false }, { unit: 'kg', max: 50, labels: 10, marks: 5, on: false }, { unit: 'g', max: 1000, labels: 200, marks: 50, on: false }],
};
export const readScales = {
  about: 'Read the mass on a kitchen dial in g or kg',
  levels: 3,
  make(level, R, params = {}) {
    level = lv(level, 3);
    const s = R.pick(SCALE_SETS[level]);
    const value = onMark(R, 0, s.max, s.marks, s.labels, s.on);
    const obj = massThing(R, s.unit, params.object);
    return {
      lines: [`How heavy is the ${NAME[obj]}?`, 'Read the scales.'],
      widget: 'measure', props: { tool: 'scales', unit: s.unit, max: s.max, labels: s.labels, marks: s.marks, value, object: obj, readonly: true },
      input: 'numpad', answer: value, unit: s.unit,
      ...readHint(value, s, 'the red needle points'),
      explain: [...scaleCount(value, s.labels, s.marks), `It weighs ${value} ${s.unit}.`],
      reteach: level > 1 ? readScales.make(level - 1, R, { object: obj }) : undefined,
    };
  },
};

const JUG_SETS = {
  1: [{ unit: 'ml', max: 500, labels: 100, marks: 100, on: true }, { unit: 'l', max: 5, labels: 1, marks: 1, on: true }, { unit: 'ml', max: 1000, labels: 100, marks: 100, on: true }],
  2: [{ unit: 'ml', max: 500, labels: 100, marks: 50, on: false }, { unit: 'ml', max: 1000, labels: 200, marks: 100, on: false }, { unit: 'l', max: 10, labels: 2, marks: 1, on: false }],
  3: [{ unit: 'ml', max: 1000, labels: 200, marks: 50, on: false }, { unit: 'ml', max: 100, labels: 20, marks: 5, on: false }, { unit: 'ml', max: 500, labels: 100, marks: 20, on: false }],
};
export const readJug = {
  about: 'Read how much is in a measuring jug in ml or l',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const s = R.pick(JUG_SETS[level]);
    const value = onMark(R, 0, s.max, s.marks, s.labels, s.on);
    const liquid = R.pick(['water', 'water', 'juice', 'fuel']);
    return {
      lines: ['How much is in the jug?'],
      widget: 'measure', props: { tool: 'jug', unit: s.unit, max: s.max, labels: s.labels, marks: s.marks, value, liquid, readonly: true },
      input: 'numpad', answer: value, unit: s.unit,
      ...readHint(value, s, 'the top of the liquid is'),
      explain: [...scaleCount(value, s.labels, s.marks, 'The top of the liquid is level with'), `There is ${value} ${s.unit}.`],
      reteach: level > 1 ? readJug.make(level - 1, R) : undefined,
    };
  },
};

const THERMO_SETS = { 1: { labels: 5, marks: 5, on: true }, 2: { labels: 10, marks: 5, on: false }, 3: { labels: 10, marks: 2, on: false } };
export const readThermometer = {
  about: 'Read a thermometer in degrees Celsius',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const s = THERMO_SETS[level];
    const value = onMark(R, 0, 40, s.marks, s.labels, s.on);
    const object = value >= 20 ? 'sun' : R.pick(['moon', 'planet']);
    return {
      lines: ['How warm is it?', 'Read the thermometer.'],
      widget: 'measure', props: { tool: 'thermometer', min: 0, max: 40, labels: s.labels, marks: s.marks, value, object, readonly: true },
      input: 'numpad', answer: value, unit: '°C',
      ...readHint(value, { ...s, labels: s.labels }, 'the top of the red line is'),
      explain: [...scaleCount(value, s.labels, s.marks, 'The red line comes up to'), `It is ${value} °C.`],
      reteach: level > 1 ? readThermometer.make(level - 1, R) : undefined,
    };
  },
};

/* ---------- Make a measurement with the widget ---------- */
export const makeLength = {
  about: 'Drag the end of an object to make a length on the ruler',
  levels: 3,
  make(level, R, params = {}) {
    level = lv(level, 3);
    const obj = params.object || R.pick(['pencil', 'worm', 'crayon', 'rocket']);
    const max = level === 1 ? 15 : R.pick([20, 30]);
    const start = level === 3 ? R.int(1, 6) : 0;
    const goal = level === 1 ? R.int(3, 15) : level === 2 ? R.int(7, Math.min(19, max - start)) : R.int(4, 14);
    const from = goal === 2 ? 5 : 2;
    const labels = max === 15 ? 1 : max === 20 ? 2 : 5;
    const end = start + goal, b = belowLabel(end, labels);
    let hint, hintProps;
    if (level === 3) { hint = [`It starts at ${start}. Drag the end and count the purple jumps.`, `Stop when there are ${goal} jumps.`]; hintProps = { hops: start }; }
    else if (end % labels === 0) { hint = [`Find ${goal} on the ruler, by the blue arrow.`, 'Drag the orange handle there.']; hintProps = { target: goal }; }
    else { hint = [`${goal} has no number. Find ${b}, by the blue arrow.`, `Then count on ${end - b} small mark${end - b === 1 ? '' : 's'}.`]; hintProps = { target: b }; }
    return {
      lines: [`Make the ${NAME[obj]} ${goal} cm long.`, level === 3 ? `It starts at ${start}.` : 'Drag the orange handle.'],
      caption: `${goal} cm`,
      widget: 'measure', props: { tool: 'ruler', unit: 'cm', max, start, value: from, object: obj, marks: 1, labels, interactive: true },
      input: 'widget', goal: { value: goal },
      hint, hintProps,
      explain: level === 3 ? [`It starts at ${start}. Count on ${goal}: ${start} + ${goal} = ${end}.`, `The end goes on ${end}.`] : [`The ${NAME[obj]} starts at 0.`, `So the end goes on ${goal}.`],
    };
  },
};

export const setScale = {
  about: 'Move the needle on the scales to show a mass',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const s = R.pick(SCALE_SETS[level]);
    const value = onMark(R, 0, s.max, s.marks, s.labels, s.on);
    const obj = massThing(R, s.unit);
    return {
      lines: [`The ${NAME[obj]} weighs ${value} ${s.unit}.`, 'Move the needle to show it.'],
      caption: `${value} ${s.unit}`,
      widget: 'measure', props: { tool: 'scales', unit: s.unit, max: s.max, labels: s.labels, marks: s.marks, value: 0, object: obj, interactive: true },
      input: 'widget', goal: { value },
      ...setHint(value, s, 'Drag the red needle, or tap the + button.'),
      explain: [...scaleCount(value, s.labels, s.marks), `It weighs ${value} ${s.unit}.`],
    };
  },
};

export const fillJug = {
  about: 'Drag the level to fill a jug to an amount',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const s = R.pick(JUG_SETS[level]);
    const value = onMark(R, 0, s.max, s.marks, s.labels, s.on);
    return {
      lines: [`Fill the jug to ${value} ${s.unit}.`, 'Drag the water up or down.'],
      caption: `${value} ${s.unit}`,
      widget: 'measure', props: { tool: 'jug', unit: s.unit, max: s.max, labels: s.labels, marks: s.marks, value: 0, interactive: true },
      input: 'widget', goal: { value },
      ...setHint(value, s, 'Drag the orange handle up.'),
      explain: [...scaleCount(value, s.labels, s.marks, 'Fill it so the top of the water is level with'), `That is ${value} ${s.unit}.`],
    };
  },
};

export const setThermometer = {
  about: 'Drag the red line to show a temperature',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    const s = THERMO_SETS[level];
    const value = onMark(R, 0, 40, s.marks, s.labels, s.on);
    return {
      lines: [`Make the thermometer show ${value} °C.`, 'Drag the red line.'],
      caption: `${value} °C`,
      widget: 'measure', props: { tool: 'thermometer', min: 0, max: 40, labels: s.labels, marks: s.marks, value: 0, object: value >= 20 ? 'sun' : 'moon', interactive: true },
      input: 'widget', goal: { value },
      ...setHint(value, s, 'Drag the orange handle up or down.'),
      explain: [...scaleCount(value, s.labels, s.marks, 'The red line goes up to'), `That is ${value} °C.`],
    };
  },
};

/* ---------- Units and tools ---------- */
const UNIT_ITEMS = {
  length: [['a pencil', 'cm'], ['a crayon', 'cm'], ['a key', 'cm'], ['a rocket', 'm'], ['a football pitch', 'm'], ['a school hall', 'm'], ['a ladybird', 'cm'], ['a bus', 'm'], ['your hand', 'cm'], ['a swimming pool', 'm'], ['a spoon', 'cm'], ['a garden', 'm']],
  mass: [['an apple', 'g'], ['a bag of potatoes', 'kg'], ['a feather', 'g'], ['a big dog', 'kg'], ['a pencil', 'g'], ['an astronaut', 'kg'], ['a biscuit', 'g'], ['a sack of sand', 'kg'], ['a moon rock you can hold', 'g'], ['a rover', 'kg']],
  capacity: [['a cup', 'ml'], ['a bath', 'l'], ['a spoon', 'ml'], ['a bucket', 'l'], ['a fish tank', 'l'], ['an egg cup', 'ml'], ['a rocket fuel tank', 'l'], ['a small bottle', 'ml']],
};
const UNIT_PAIR = { length: ['cm', 'm'], mass: ['g', 'kg'], capacity: ['ml', 'l'] };
const UNIT_WORD = { cm: 'centimetres', m: 'metres', g: 'grams', kg: 'kilograms', ml: 'millilitres', l: 'litres' };
const VERB = { length: 'measure', mass: 'weigh', capacity: 'fill' };
const TOOL_Q = [['how long a pencil is', 'ruler'], ['how heavy an apple is', 'scales'], ['how much water is in a bottle', 'jug'], ['how hot it is outside', 'thermometer'], ['how tall a plant is', 'ruler'], ['how much a parcel weighs', 'scales'], ['how cold the fridge is', 'thermometer'], ['how much juice is in a cup', 'jug']];
export const chooseUnit = {
  about: 'Choose cm or m, g or kg, ml or l, and the right measuring tool (params.kind: length, mass or capacity)',
  levels: 3,
  make(level, R, params = {}) {
    level = lv(level, 3);
    if (level === 3 && R.chance(0.5)) {
      const [q, tool] = R.pick(TOOL_Q);
      const why = { ruler: 'A ruler measures how long or tall.', scales: 'Scales measure how heavy.', jug: 'A jug measures how much liquid.', thermometer: 'A thermometer measures how hot or cold.' };
      return {
        lines: [`Which tool shows ${q}?`], input: 'choice', answer: tool, options: R.shuffle(['ruler', 'scales', 'jug', 'thermometer']),
        hint: ['A ruler measures length. Scales measure mass.', 'A jug measures liquid. A thermometer measures heat.'],
        explain: [why[tool], `So use the ${tool}.`],
      };
    }
    const kind = UNIT_ITEMS[params.kind] ? params.kind : level === 1 ? 'length' : R.pick(level === 2 ? ['mass', 'capacity'] : ['length', 'mass', 'capacity']);
    const [thing, unit] = R.pick(UNIT_ITEMS[kind]);
    const [small, big] = UNIT_PAIR[kind];
    return {
      lines: [`Would you ${VERB[kind]} ${thing} in ${small} or ${big}?`], input: 'choice', answer: unit,
      options: [small, big].map(u => ({ label: `${u}: ${UNIT_WORD[u]}`, value: u })),
      hint: [`Is ${thing} small or big?`, PIC[small], PIC[big]],
      explain: [`${thing[0].toUpperCase() + thing.slice(1)} is ${unit === small ? 'small' : 'big'}.`, `So use ${UNIT_WORD[unit]}: ${unit}.`],
    };
  },
};

/* ---------- Compare and order ---------- */
export const compareMeasures = {
  about: 'Compare two measures with <, > or = (params.units limits the units at level 2)',
  levels: 3,
  make(level, R, params = {}) {
    level = lv(level, 3);
    let xs, ys, x, y;
    if (level === 1) {
      // In the mission's units (a mass mission compares grams or kilograms, not centimetres).
      const u = Array.isArray(params.units) && params.units.length ? R.pick(params.units) : 'cm';
      const hund = u === 'g' || u === 'ml';
      x = hund ? R.int(1, 9) * 100 : R.int(2, 50); y = R.chance(0.15) ? x : hund ? R.int(1, 9) * 100 : R.int(2, 50);
      if (Math.abs(x - y) < 3 && x !== y) y = x + 5;
      xs = `${x} ${u}`; ys = `${y} ${u}`;
    } else if (level === 2) {
      const u = R.pick(Array.isArray(params.units) && params.units.length ? params.units : ['g', 'kg', 'ml', 'l', 'cm', 'm']);
      const big = u === 'g' || u === 'ml';
      x = big ? R.int(1, 19) * 50 : R.int(2, 99); y = R.chance(0.15) ? x : big ? R.int(1, 19) * 50 : R.int(2, 99);
      if (!big && R.chance(0.4) && x > 9) y = Number(String(x).split('').reverse().join('')) || y;
      xs = `${x} ${u}`; ys = `${y} ${u}`;
    } else {
      const all3 = [[100, '1 m', 90, '90 cm'], [100, '1 m', 100, '100 cm'], [50, '50 cm', 100, '1 m'], [200, '2 m', 150, '150 cm'], [1000, '1 kg', 1000, '1000 g'], [500, '500 g', 1000, '1 kg'], [2000, '2 kg', 1500, '1500 g'], [1000, '1 l', 1000, '1000 ml'], [2000, '2 l', 1500, '1500 ml'], [750, '750 ml', 1000, '1 l']];
      const want = Array.isArray(params.units) ? all3.filter(q => params.units.some(u => q[1].endsWith(' ' + u) || q[3].endsWith(' ' + u))) : [];
      const pr = R.pick(want.length ? want : all3);
      [x, xs, y, ys] = R.chance(0.5) ? pr : [pr[2], pr[3], pr[0], pr[1]];
    }
    const answer = x > y ? '>' : x < y ? '<' : '=';
    // Level 3: write the bigger unit in the smaller one (1 m is 100 cm) so both numbers can be compared.
    const SMALL = { m: ['cm', '1 m is 100 cm.'], kg: ['g', '1 kg is 1000 g.'], l: ['ml', '1 l is 1000 ml.'] };
    const conv = [[xs, x], [ys, y]].map(([t, v]) => { const u = t.split(' ').pop(); return SMALL[u] ? { t, v, u: SMALL[u][0], fact: SMALL[u][1] } : null; }).filter(Boolean);
    const big = Math.max(x, y) >= 100 && (Math.max(x, y) % 50 === 0);
    return {
      lines: ['Which sign goes in the gap?'], caption: `${xs}  ?  ${ys}`, input: 'choice', answer, options: ['<', '>', '='],
      hint: level === 3 && conv.length ? [conv[0].fact, `So compare ${x} and ${y}.`] : [big ? 'Compare the hundreds first.' : 'Compare the tens first, then the ones.', 'The open side of the sign faces the bigger amount.'],
      explain: [...(level === 3 ? conv.map(c => `${c.t} is ${c.v} ${c.u}.`) : []), `${xs} ${answer === '=' ? 'is the same as' : answer === '>' ? 'is more than' : 'is less than'} ${ys}.`, `So ${xs} ${answer} ${ys}.`],
    };
  },
};

export const orderMeasures = {
  about: 'Order lengths, masses or capacities (params.units limits the units)',
  levels: 3,
  make(level, R, params = {}) {
    level = lv(level, 3);
    const n = level === 1 ? 3 : 4;
    const units = Array.isArray(params.units) && params.units.length ? params.units : null;
    const u = units ? R.pick(units) : level === 1 ? 'cm' : R.pick(['g', 'kg', 'ml', 'l', 'm', 'cm']);
    const vals = level === 1 && !(u === 'g' || u === 'ml') ? R.distinct(n, 2, 40) : (u === 'g' || u === 'ml') ? R.distinct(n, 1, 19).map(v => v * 50) : R.distinct(n, 5, 95);
    const words = { cm: ['shortest', 'longest'], m: ['shortest', 'longest'], g: ['lightest', 'heaviest'], kg: ['lightest', 'heaviest'], ml: ['least', 'most'], l: ['least', 'most'] }[u];
    const up = level < 3 || R.chance(0.5);
    const sorted = [...vals].sort((a, b) => (up ? a - b : b - a)).map(v => `${v} ${u}`);
    let opts = R.shuffle(sorted);
    if (opts.every((v, i) => v === sorted[i])) opts = [...sorted].reverse();
    return {
      lines: ['Put them in order.', `Start with the ${up ? words[0] : words[1]}.`], input: 'order', options: opts, answer: sorted,
      hint: [`Find the ${up ? 'smallest' : 'biggest'} number first. Tap it.`, (u === 'g' || u === 'ml') ? 'Compare the hundreds, then the tens.' : 'Compare the tens, then the ones.'],
      explain: [`${sorted[0]} is the ${up ? words[0] : words[1]}.`, `Then ${sorted.slice(1).join(', then ')}.`],
    };
  },
};

/* ---------- Problems ---------- */
export const measureProblem = {
  about: 'Add and subtract lengths, masses and capacities in the same unit',
  levels: 3,
  make(level, R) {
    level = lv(level, 3);
    if (level === 1) {
      const a = R.int(4, 12), b = R.int(2, 7);
      const t = R.pick([
        { lines: [`A worm is ${a} cm long.`, `It grows ${b} cm.`, 'How long is it now?'], ans: a + b, u: 'cm', ex: [`${a} + ${b} = ${a + b}.`] },
        { lines: [`A rocket is ${a + b} cm tall.`, `A toy rocket is ${a} cm tall.`, 'How much taller is the big one?'], ans: b, u: 'cm', ex: [`${a} + ${b} = ${a + b}.`, `It is ${b} cm taller.`] },
        { lines: [`A bag has ${a} kg of moon rock.`, `You add ${b} kg more.`, 'How much now?'], ans: a + b, u: 'kg', ex: [`${a} + ${b} = ${a + b}.`] },
      ]);
      return { lines: t.lines, input: 'numpad', answer: t.ans, unit: t.u, hint: ['Start at the bigger number.', 'Count on the smaller one on your fingers.'], explain: t.ex };
    }
    if (level === 2) {
      let a = R.int(2, 7) * 10 + R.int(0, 9), b = R.int(1, 3) * 10 + R.int(0, 5);
      if (a === 2 * b) a += 3;
      const t = R.pick([
        { lines: [`A fuel tank has ${a} l.`, `You add ${b} l.`, 'How much fuel is in the tank now?'], ans: a + b, u: 'l', ex: [`${a} + ${b} = ${a + b}.`] },
        { lines: [`A rope is ${a} m long.`, `You cut off ${b} m.`, 'How long is it now?'], ans: a - b, u: 'm', ex: [`${a} − ${b} = ${a - b}.`] },
        { lines: [`The robot weighs ${a} kg.`, `The rover weighs ${a + b} kg.`, 'How much heavier is the rover?'], ans: b, u: 'kg', ex: [`${a} + ${b} = ${a + b}.`, `The rover is ${b} kg heavier.`] },
      ]);
      return { lines: t.lines, input: 'numpad', answer: t.ans, unit: t.u, hint: ['Work with the tens first.', 'Then the ones.'], explain: t.ex };
    }
    const t = R.pick([
      () => { const a = R.int(3, 8) * 10 + R.int(1, 9); return { lines: [`A ribbon is ${a} cm long.`, 'How much more makes 100 cm?'], ans: 100 - a, u: 'cm', ex: [`${a} + ${100 - a} = 100.`] }; },
      () => { const a = R.int(2, 6) * 100; const b = R.int(1, 3) * 100; return { lines: [`A jug has ${a} ml.`, `You pour in ${b} ml more.`, 'How much is in the jug?'], ans: a + b, u: 'ml', ex: [`${a} + ${b} = ${a + b}.`] }; },
      () => { const a = R.int(15, 35), b = R.int(15, 35), c = R.int(5, 10); return { lines: [`3 rocks weigh ${a} kg, ${b} kg and ${c} kg.`, 'How much altogether?'], ans: a + b + c, u: 'kg', ex: [`${a} + ${b} = ${a + b}.`, `${a + b} + ${c} = ${a + b + c}.`] }; },
      () => { const a = R.int(5, 9) * 10, b = R.int(2, 4) * 10, c = R.int(1, 9); return { lines: [`A plank is ${a} cm.`, `You cut ${b + c} cm off.`, 'How long is it now?'], ans: a - b - c, u: 'cm', ex: [`${a} − ${b} = ${a - b}.`, `${a - b} − ${c} = ${a - b - c}.`] }; },
    ])();
    return { lines: t.lines, input: 'numpad', answer: t.ans, unit: t.u, hint: ['Do it in two small steps.', 'Tens first, then ones.'], explain: t.ex };
  },
};

/* ---------- Year 1 comparing ---------- */
export const compareY1 = {
  about: 'Year 1: longer, taller, heavier, fuller; measure with cubes',
  levels: 3,
  make(level, R, params = {}) {
    level = lv(level, 3);
    // params.kind keeps to one kind: 'length' (length and height), 'mass' or 'capacity'.
    const want = params.kind;
    if (want === 'capacity') level = 2;
    if (level === 2 && (want === 'length' || want === 'mass')) level = want === 'length' ? 1 : 3;
    if (level === 1) {
      const kind = want === 'length' ? R.pick(['length', 'height']) : want === 'mass' ? 'mass' : R.pick(['length', 'height', 'mass']);
      let a, b;
      do { a = R.int(2, 9); b = R.int(2, 9); } while (Math.abs(a - b) < 2);
      if (kind === 'length') {
        const [oa, ob] = R.sample(['pencil', 'crayon', 'worm', 'key', 'spoon'], 2);
        const longer = R.chance(0.6);
        const answer = (longer ? a > b : a < b) ? oa : ob;
        return {
          lines: [longer ? 'Which is longer?' : 'Which is shorter?'],
          widget: 'measure', props: { tool: 'compare', kind: 'length', a, b, icons: [oa, ob], readonly: true },
          input: 'choice', answer, options: [oa, ob],
          hint: ['They both start at the same line.', 'Now each has cubes under it. Which needs more cubes?'], hintProps: { cubes: true },
          explain: [`The ${oa} is ${a} cubes long. The ${ob} is ${b} cubes long.`, `So the ${answer} is ${longer ? 'longer' : 'shorter'}.`],
        };
      }
      if (kind === 'height') {
        const [ia, ib] = R.sample(['rocket', 'astronaut', 'alien', 'robot'], 2);
        const taller = R.chance(0.6);
        const answer = (taller ? a > b : a < b) ? ia : ib;
        return {
          lines: [taller ? 'Which is taller?' : 'Which is shorter?'],
          widget: 'measure', props: { tool: 'compare', kind: 'height', a, b, icons: [ia, ib], readonly: true },
          input: 'choice', answer, options: [{ label: ia, value: ia, art: ia }, { label: ib, value: ib, art: ib }],
          hint: ['They stand on the same ground.', 'Look at the tops. Count the cubes beside each one.'], hintProps: { cubes: true },
          explain: [`The ${ia} is ${a} cubes tall. The ${ib} is ${b} cubes tall.`, `So the ${answer} is ${taller ? 'taller' : 'shorter'}.`],
        };
      }
      const [ia, ib] = R.sample(['asteroid', 'apple', 'crystal', 'cookie', 'helmet'], 2);
      const heavy = R.chance(0.6);
      const answer = (heavy ? a > b : a < b) ? ia : ib;
      return {
        lines: [heavy ? 'Which is heavier?' : 'Which is lighter?'],
        widget: 'measure', props: { tool: 'compare', kind: 'mass', a, b, icons: [ia, ib], readonly: true },
        input: 'choice', answer, options: [{ label: NAME[ia], value: ia, art: ia }, { label: NAME[ib], value: ib, art: ib }],
        hint: ['The heavier side goes down.', 'Which pan is lower?'],
        explain: [`The ${NAME[answer]} side is ${heavy ? 'down' : 'up'}.`, `So the ${NAME[answer]} is ${heavy ? 'heavier' : 'lighter'}.`],
      };
    }
    if (level === 2) {
      if (R.chance(0.5)) {
        const [lvl, word] = R.pick([[10, 'full'], [5, 'half full'], [0, 'empty']]);
        return {
          lines: ['Look at the tank.', 'Is it full, half full or empty?'],
          widget: 'measure', props: { tool: 'compare', kind: 'capacity', a: lvl, max: 10, readonly: true },
          input: 'choice', answer: word, options: ['full', 'half full', 'empty'],
          hint: ['Full means right to the top.', 'Half full means up to the dashed half line.'], hintProps: { halfLine: true },
          explain: [word === 'full' ? 'The water comes right to the top.' : word === 'empty' ? 'There is no water at all.' : 'The water comes up to the half line.', `So the tank is ${word}.`],
        };
      }
      let a, b;
      do { a = R.int(1, 10); b = R.int(1, 10); } while (Math.abs(a - b) < 2);
      const more = R.chance(0.6);
      const answer = (more ? a > b : a < b) ? 'A' : 'B';
      return {
        lines: [more ? 'Which tank has more water?' : 'Which tank has less water?'],
        widget: 'measure', props: { tool: 'compare', kind: 'capacity', a, b, max: 10, readonly: true },
        input: 'choice', answer, options: ['A', 'B'],
        hint: ['The tanks are the same size.', 'Follow the dashed lines. Which water is higher?'], hintProps: { guides: true },
        explain: [`The water in tank ${a > b ? 'A' : 'B'} is higher.`, `So tank ${answer} has ${more ? 'more' : 'less'} water.`],
      };
    }
    if (want === 'length' || (want !== 'mass' && R.chance(0.5))) {
      const obj = R.pick(['worm', 'pencil', 'crayon', 'spoon']);
      const n = R.int(3, 9);
      return {
        lines: [`How many cubes long is the ${obj}?`],
        widget: 'measure', props: { tool: 'compare', kind: 'length', a: n, icons: [obj], cubes: true, readonly: true },
        input: 'numpad', answer: n, unit: 'cubes',
        hint: ['Count the cubes under it.', 'Touch each one as you count.'],
        explain: [`There are ${n} cubes.`, `The ${obj} is ${n} cubes long.`],
      };
    }
    const obj = R.pick(['asteroid', 'apple', 'crystal', 'helmet']);
    const n = R.int(3, 9);
    return {
      lines: ['The scales balance.', `How many cubes weigh the same as the ${NAME[obj]}?`],
      widget: 'measure', props: { tool: 'compare', kind: 'mass', a: n, b: n, icons: [obj], cubes: true, readonly: true },
      input: 'numpad', answer: n, unit: 'cubes',
      hint: ['Count the cubes on the pan.'],
      explain: [`There are ${n} cubes.`, `The ${NAME[obj]} weighs the same as ${n} cubes.`],
    };
  },
};

/* ---------- Estimating ---------- */
const EST = {
  1: [['a door', 'tall', 2, 'm', 'cm'], ['a pencil', 'long', 15, 'cm', 'm'], ['a car', 'long', 4, 'm', 'cm'], ['a book', 'wide', 20, 'cm', 'm'], ['a classroom', 'long', 8, 'm', 'cm'], ['a crayon', 'long', 10, 'cm', 'm'], ['a bus', 'long', 10, 'm', 'cm'], ['a key', 'long', 5, 'cm', 'm']],
  // Level 2 adds mass and capacity, plus harder lengths (used when a mission keeps to length).
  2: [['a bed', 'long', 2, 'm', 'cm'], ['a school ruler', 'long', 30, 'cm', 'm'], ['a giraffe', 'tall', 5, 'm', 'cm'], ['a shoe', 'long', 20, 'cm', 'm'],
    ['an apple', 'heavy', 200, 'g', 'kg'], ['a bath', 'full', 100, 'l', 'ml'], ['a teaspoon', 'full', 5, 'ml', 'l'], ['a bag of sugar', 'heavy', 1, 'kg', 'g'], ['a cup', 'full', 200, 'ml', 'l'], ['a big dog', 'heavy', 30, 'kg', 'g'], ['a bucket', 'full', 10, 'l', 'ml'], ['a biscuit', 'heavy', 10, 'g', 'kg']],
};
const EST3 = [
  ['How long is a pencil?', 'about 15 cm', ['about 15 m', 'about 2 cm']], ['How tall is a door?', 'about 2 m', ['about 20 m', 'about 20 cm']],
  ['How heavy is an apple?', 'about 200 g', ['about 200 kg', 'about 2 g']], ['How much does a mug hold?', 'about 300 ml', ['about 300 l', 'about 3 ml']],
  ['How long is a bed?', 'about 2 m', ['about 2 cm', 'about 20 m']], ['How heavy is a 6 year old?', 'about 20 kg', ['about 20 g', 'about 200 kg']],
  ['How much does a bath hold?', 'about 100 l', ['about 100 ml', 'about 1 l']], ['How long is your thumb?', 'about 5 cm', ['about 5 m', 'about 50 cm']],
];
const Q = { tall: 'How tall is', long: 'How long is', wide: 'How wide is', heavy: 'How heavy is', full: 'How much does it hold:' };
export const estimate = {
  about: 'Estimate: is it about 2 m or 2 cm?',
  levels: 3,
  make(level, R, params = {}) {
    level = lv(level, 3);
    // params.units (e.g. ['cm', 'm']) keeps to those units, so a length mission only estimates lengths.
    const units = Array.isArray(params.units) && params.units.length ? params.units : null;
    const keep = list => { const k = units ? list.filter(e => units.includes(e[3])) : list; return k.length ? k : list; };
    if (level === 3) {
      const pool = units ? EST3.filter(e => units.includes(e[1].split(' ').pop())) : EST3;
      const [q, a, others] = R.pick(pool.length ? pool : EST3);
      const u = a.split(' ').pop();
      return {
        lines: [q, 'Pick the best guess.'], input: 'choice', answer: a, options: R.shuffle([a, ...others]),
        hint: ['Picture it in your hands. Is it small or big?', PIC[u]], explain: [`It is ${a}.`, PIC[u]],
      };
    }
    const pool = level === 1 ? EST[1] : units ? [...EST[1], ...EST[2]] : EST[2];
    const [thing, adj, n, u, wrongU] = R.pick(keep(pool));
    const right = `about ${n} ${u}`, wrong = `about ${n} ${wrongU}`;
    const q = adj === 'full' ? `How much does ${thing} hold?` : `${Q[adj]} ${thing}?`;
    return {
      lines: [q], input: 'choice', answer: right, options: R.shuffle([right, wrong]),
      hint: [`Picture ${thing}.`, PIC[u], PIC[wrongU]],
      explain: [`${thing[0].toUpperCase() + thing.slice(1)} is ${right}.`, PIC[u]],
    };
  },
};
