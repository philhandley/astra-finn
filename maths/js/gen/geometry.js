// Geometry generators: 2-D and 3-D shapes, patterns, turns and the rover.
// Every item follows ENGINE.md section 4.1. Levels: 1 easiest, 3 hardest.
// Check: dev/gen.html?gen=geometry&all=1  and  dev/gen.html?gen=geometry.<name>&level=<n>
import { shapeInfo, isSymmetric, rightAngles as rightAngleCount, NAME2D } from '../widgets/shapes2d.js';
import { SOLIDS, NAME3D } from '../widgets/shapes3d.js';
import { roverRoute, turnDir } from '../widgets/rover.js';
import { patternKey } from '../widgets/pattern.js';

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const an = w => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const YESNO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];

// ---------- 2-D naming ----------
// The method in words: what you notice, then the name (DfE sentence stem "It is a ... because ...").
const EXPLAIN2D = {
  circle: ['It is perfectly round, with no corners.', 'So it is a circle.'],
  semicircle: ['It has 1 curved side and 1 straight side.', 'It is half a circle: a semicircle.'],
  oval: ['It is round but stretched, like an egg.', 'So it is an oval.'],
  triangle: ['It has exactly 3 straight sides.', 'So it is a triangle.'],
  square: ['It has 4 straight sides, all the same length.', 'So it is a square.'],
  rectangle: ['It has 4 straight sides and 4 square corners.', '2 long sides and 2 short sides: a rectangle.'],
  pentagon: ['It has exactly 5 straight sides.', 'So it is a pentagon.'],
  hexagon: ['It has exactly 6 straight sides.', 'So it is a hexagon.'],
  octagon: ['It has exactly 8 straight sides.', 'So it is an octagon.'],
  quadrilateral: ['It has exactly 4 straight sides.', 'So it is a quadrilateral.'],
};
const shapeOpt = name => ({ value: name, label: cap(name) });
const CURVED_NAMES = ['circle', 'oval', 'semicircle'];
// Help for naming: curved shapes get a "trace the edge" nudge; straight ones become hands-on, with the sides
// still to count dotted in blue.
function nameHint(answer) {
  if (answer === 'circle' || answer === 'oval') return { hint: ['Run your finger round the edge.', 'Is it perfectly round, or stretched like an egg?'] };
  if (answer === 'semicircle') return { hint: ['Run your finger round the edge.', 'Is every side curved, or is one side straight?'], hintProps: { showAll: 'sides' } };
  return {
    hint: ['Tap each side as you count.', answer === 'square' || answer === 'rectangle' ? 'Are all 4 sides the same length?' : 'The dotted sides still need a tap.'],
    hintProps: { tap: 'sides', showLeft: 'sides', interactive: true, readonly: false },
  };
}

export const name2d = {
  about: 'Name a 2-D shape shown in any orientation and size',
  levels: 3,
  make(level, R) {
    let shape, rotate = 0, scale = 1, pool, n = 3;
    if (level <= 1) {
      shape = R.pick(['circle', 'triangle', 'square', 'rectangle']);
      scale = R.pick([0.7, 0.85, 1]);
      pool = ['circle', 'triangle', 'square', 'rectangle'];
    } else if (level === 2) {
      shape = R.pick(['circle', 'triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'semicircle', 'oval', 'long-rectangle', 'long-triangle', 'right-triangle']);
      rotate = R.pick([0, 30, 45, 90, 135, 180, 210]);
      scale = R.pick([0.6, 0.75, 0.9, 1]);
      pool = ['circle', 'triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'semicircle', 'oval'];
    } else {
      shape = R.pick(['octagon', 'irregular-pentagon', 'irregular-hexagon', 'l-hexagon', 'house', 'scalene', 'long-triangle', 'right-triangle', 'irregular-quad', 'kite', 'trapezium', 'parallelogram', 'pentagon', 'hexagon']);
      rotate = R.pick([0, 20, 45, 90, 160, 200, 270]);
      scale = R.pick([0.7, 0.85, 1]);
      pool = ['triangle', 'quadrilateral', 'pentagon', 'hexagon', 'octagon'];
      n = 4;
    }
    let answer = NAME2D[shape];
    if (level >= 3 && ['kite', 'trapezium', 'parallelogram', 'quadrilateral'].includes(answer)) answer = 'quadrilateral';
    const others = R.sample(pool.filter(x => x !== answer && !(answer === 'square' && x === 'rectangle')), n - 1);
    const options = R.shuffle([answer, ...others]).map(shapeOpt);
    const turned = rotate % 360 !== 0;
    const explain = [...(EXPLAIN2D[answer] || [`It is ${an(answer)} ${answer}.`])];
    if (turned && explain.length < 3) explain.push('Turning a shape does not change its name.');
    const regular = { triangle: 'triangle', quadrilateral: 'square', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon' }[answer] || shape;
    const other2 = R.pick(pool.filter(x => x !== answer && !(answer === 'square' && x === 'rectangle')));
    return {
      lines: level >= 3 ? ['Name this shape.', 'Count its straight sides first.'] : ['What is this shape called?'],
      widget: 'shapes2d',
      props: { shape, rotate, scale, readonly: true },
      input: 'choice',
      options,
      answer,
      ...nameHint(answer),
      explain,
      reteach: {
        lines: ['What is this shape called?'],
        widget: 'shapes2d',
        props: { shape: regular, readonly: true },
        input: 'choice',
        options: R.shuffle([answer, other2]).map(shapeOpt),
        answer,
        ...nameHint(answer),
        explain: EXPLAIN2D[answer] || [`It is ${an(answer)} ${answer}.`],
      },
    };
  },
};

// ---------- Is it a triangle? (DfE 1G–1 language focus) ----------
const REASONS = {
  yes3: { value: 'yes3', label: 'Yes. It has 3 straight sides.' },
  no4: { value: 'no4', label: 'No. It has 4 sides.' },
  no5: { value: 'no5', label: 'No. It has 5 sides.' },
  no6: { value: 'no6', label: 'No. It has 6 sides.' },
  curved: { value: 'curved', label: 'No. Some sides are curved.' },
};
const REASON_EXPLAIN = {
  yes3: ['Count the sides: 1, 2, 3. All straight.', 'This is a triangle because it has 3 straight sides.'],
  no4: ['Count the sides: 1, 2, 3, 4.', 'This is not a triangle because it has 4 sides.'],
  no5: ['Count the sides: 1, 2, 3, 4, 5.', 'This is not a triangle because it has 5 sides.'],
  no6: ['Count the sides: 1, 2, 3, 4, 5, 6.', 'This is not a triangle because it has 6 sides.'],
  curved: ['Run a finger along the sides: some bend.', 'This is not a triangle because some sides are curved.'],
};
function reasonFor(shape) {
  const info = shapeInfo(shape);
  if (info.curved > 0) return 'curved';
  return { 3: 'yes3', 4: 'no4', 5: 'no5', 6: 'no6' }[info.sides] || 'no6';
}
// Help: curved shapes light every side so the bends stand out; straight ones become hands-on to tap and count.
function triHint(shape) {
  if (shapeInfo(shape).curved > 0) return { hint: ['The sides are blue now. Look at each one.', 'Is every side straight, like a ruler?'], hintProps: { showAll: 'sides' } };
  return { hint: ['A triangle has 3 straight sides.', 'Tap each side to count. Dotted ones still need a tap.'], hintProps: { tap: 'sides', showLeft: 'sides', interactive: true, readonly: false } };
}

export const notATriangle = {
  about: 'Is this a triangle? Say why, with the DfE sentence stems',
  levels: 3,
  make(level, R) {
    let shape, rotate = 0;
    if (level <= 1) {
      shape = R.pick(['triangle', 'triangle', 'right-triangle', 'square', 'circle', 'rectangle', 'long-triangle']);
      rotate = shape.includes('triangle') ? R.pick([0, 0, 180]) : 0;
    } else if (level === 2) {
      shape = R.pick(['triangle', 'right-triangle', 'long-triangle', 'scalene', 'square', 'rectangle', 'hexagon', 'semicircle', 'circle', 'pentagon']);
      rotate = R.pick([0, 45, 90, 180, 250]);
    } else {
      shape = R.pick(['curvy-triangle', 'half-square', 'scalene', 'long-triangle', 'l-hexagon', 'house', 'kite', 'heart', 'semicircle', 'irregular-quad', 'right-triangle']);
      rotate = R.pick([0, 30, 90, 135, 180, 300]);
    }
    const reason = reasonFor(shape);
    const isTri = reason === 'yes3';
    if (level <= 1) {
      const answer = isTri ? 'yes' : 'no';
      return {
        lines: ['Is this a triangle?'],
        widget: 'shapes2d',
        props: { shape, rotate, readonly: true },
        input: 'choice',
        options: YESNO,
        answer,
        ...triHint(shape),
        explain: REASON_EXPLAIN[reason],
      };
    }
    let keys;
    const sideKey = ['no4', 'no5', 'no6'].includes(reason) ? reason : R.pick(['no4', 'no6']);
    if (level === 2) keys = ['yes3', sideKey, 'curved'];
    else keys = ['yes3', 'no4', sideKey === 'no4' ? R.pick(['no5', 'no6']) : sideKey, 'curved'];
    const simple = isTri ? 'square' : 'triangle';
    return {
      lines: ['Is this a triangle?', 'Pick the reason.'],
      widget: 'shapes2d',
      props: { shape, rotate, readonly: true },
      input: 'choice',
      options: keys.map(k => REASONS[k]),
      answer: reason,
      ...triHint(shape),
      explain: REASON_EXPLAIN[reason],
      reteach: {
        lines: ['Is this a triangle?'],
        widget: 'shapes2d',
        props: { shape: simple, readonly: true },
        input: 'choice',
        options: YESNO,
        answer: simple === 'triangle' ? 'yes' : 'no',
        ...triHint(simple),
        explain: REASON_EXPLAIN[simple === 'triangle' ? 'yes3' : 'no4'],
      },
    };
  },
};

// ---------- counting sides and vertices ----------
const upTo = n => Array.from({ length: n }, (_, i) => i + 1).join(', ');
function countItem(kind, level, R) {
  const word = kind === 'sides' ? 'sides' : 'vertices';
  const one = kind === 'sides' ? 'side' : 'vertex';
  let shape, rotate = 0;
  if (level <= 1) shape = R.pick(['triangle', 'square', 'rectangle', 'pentagon', 'hexagon']);
  else if (level === 2) { shape = R.pick(['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon', 'kite', 'right-triangle', 'semicircle']); rotate = R.pick([0, 30, 90, 180]); }
  else {
    shape = R.pick(kind === 'sides' ? ['l-hexagon', 'irregular-pentagon', 'irregular-hexagon', 'octagon', 'star', 'arrow', 'house', 'scalene', 'circle'] : ['l-hexagon', 'irregular-pentagon', 'irregular-hexagon', 'octagon', 'star', 'arrow', 'house', 'circle', 'semicircle']);
    rotate = R.pick([0, 45, 90, 200]);
  }
  const info = shapeInfo(shape);
  const n = kind === 'sides' ? info.sides : info.vertices;
  const named = ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon'].includes(info.name) ? info.name : null;
  let explain;
  if (n === 0) explain = [`A ${info.name} has no corners at all.`, 'So it has 0 vertices.'];
  else if (kind === 'sides' && info.name === 'circle') explain = ['A circle has 1 curved side.', 'It goes all the way round.'];
  else explain = [`Count round once: ${upTo(n)}.`, `It has ${n} ${n === 1 ? one : word}${named ? `, so it is ${an(named)} ${named}` : ''}.`];
  // Help: the sides (or corners) still to count are dotted (or ringed) in blue, and the picture becomes hands-on.
  const hint = kind === 'sides'
    ? ['Start at the top. Go round one way.', 'Tap each side. The dotted ones still need a tap.']
    : ['A vertex is a corner. Tap each one.', 'The blue rings still need a tap.'];
  const hintProps = { tap: kind, showLeft: kind, interactive: true, readonly: false };
  const small = kind === 'sides' ? 'triangle' : 'square';
  const smallN = kind === 'sides' ? 3 : 4;
  const reteach = {
    lines: [`Tap each ${one} of this ${small} once.`],
    widget: 'shapes2d',
    props: { shape: small, tap: kind },
    input: 'widget',
    goal: { [kind]: smallN },
    hint, hintProps,
    explain: [`Count round once: ${upTo(smallN)}.`, `A ${small} has ${smallN} ${word}.`],
  };
  if (level <= 1) {
    return {
      lines: [`Tap each ${one} once.`, kind === 'vertices' ? 'A vertex is a corner.' : 'Count as you tap.'],
      widget: 'shapes2d',
      props: { shape, rotate, tap: kind },
      input: 'widget',
      goal: { [kind]: n },
      hint, hintProps,
      explain,
    };
  }
  return {
    lines: level === 2 ? [`How many ${word} does this shape have?`, ...(kind === 'vertices' ? ['A vertex is a corner.'] : [])] : [`How many ${word}?`, `Count each ${one} once.`],
    widget: 'shapes2d',
    props: level === 2 ? { shape, rotate, tap: kind, interactive: true } : { shape, rotate, readonly: true },
    input: 'numpad',
    answer: n,
    hint, hintProps,
    explain,
    reteach,
  };
}
export const countSides = { about: 'Count the sides of a 2-D shape (tap them, then type)', levels: 3, make: (l, R) => countItem('sides', l, R) };
export const countVertices = { about: 'Count the vertices of a 2-D shape', levels: 3, make: (l, R) => countItem('vertices', l, R) };

// ---------- vertical line of symmetry ----------
export const symmetry = {
  about: 'Does the shape have a vertical line of symmetry? Fold to check',
  levels: 3,
  make(level, R) {
    let shape, rotate = 0;
    const wantYes = R.chance(0.5);
    if (level <= 1) {
      shape = wantYes ? R.pick(['square', 'rectangle', 'triangle', 'heart', 'circle', 'pentagon', 'house', 'kite', 'arrow']) : R.pick(['scalene', 'right-triangle', 'parallelogram', 'irregular-quad', 'irregular-pentagon']);
    } else {
      const pool = level === 2
        ? ['square', 'rectangle', 'triangle', 'heart', 'pentagon', 'house', 'kite', 'arrow', 'scalene', 'right-triangle', 'parallelogram', 'trapezium', 'semicircle']
        : ['star', 'hexagon', 'octagon', 'l-hexagon', 'kite', 'arrow', 'trapezium', 'parallelogram', 'half-square', 'irregular-hexagon', 'heart', 'long-triangle', 'house'];
      const rots = level === 2 ? [0, 90, 180] : [0, 45, 90, 135, 180, 270, 315];
      // Pick until the answer matches wantYes (bounded).
      for (let k = 0; k < 40; k++) {
        shape = R.pick(pool); rotate = R.pick(rots);
        if (isSymmetric(shape, rotate) === wantYes) break;
      }
    }
    const sym = isSymmetric(shape, rotate);
    const answer = sym ? 'yes' : 'no';
    const explain = sym
      ? ['Fold it along the dashed line.', 'The two halves sit exactly on top of each other.', 'So it has a vertical line of symmetry.']
      : ['Fold it along the dashed line.', 'The two halves do not match up.', 'So it has no vertical line of symmetry.'];
    // Help: the fold button does the checking. At level 3 the dashed line and the Fold button appear.
    const hint = ['Tap Fold and watch the left half flip over.', 'Does it land exactly on the right half?'];
    const reteachShape = sym ? 'square' : 'parallelogram';
    const reteach = {
      lines: ['Is the dashed line a line of symmetry?', 'Tap Fold to check.'],
      widget: 'shapes2d',
      props: { shape: reteachShape, fold: true, interactive: true },
      input: 'choice', options: YESNO, answer: sym ? 'yes' : 'no',
      hint: ['Tap Fold. Do the two halves match?'],
      explain: sym ? ['Fold it: the halves match.', 'A square has a vertical line of symmetry.'] : ['Fold it: the halves do not match.', 'So the line is not a line of symmetry.'],
    };
    if (level <= 2) {
      return {
        lines: level === 1 ? ['Is the dashed line a line of symmetry?', 'Tap Fold to check.'] : ['Does it have a vertical line of symmetry?', 'Fold it to check.'],
        widget: 'shapes2d',
        props: { shape, rotate, fold: true, interactive: true },
        input: 'choice', options: YESNO, answer,
        hint, explain, reteach,
      };
    }
    return {
      lines: ['Does it have a vertical line of symmetry?'],
      widget: 'shapes2d',
      props: { shape, rotate, readonly: true },
      input: 'choice', options: YESNO, answer,
      hint: ['Here is a fold line down the middle.', ...hint],
      hintProps: { fold: true, interactive: true, readonly: false },
      explain, reteach,
    };
  },
};

// ---------- 3-D shapes ----------
const SOLID_LONG = { cube: 'cube', cuboid: 'cuboid', sphere: 'sphere', cylinder: 'cylinder', cone: 'cone', pyramid: 'square-based pyramid', 'tri-pyramid': 'triangle-based pyramid', prism: 'triangular prism' };
const SOLID_HINT = {
  cube: 'Are all its faces squares the same size?',
  cuboid: 'Its faces are rectangles, like a box.',
  sphere: 'It is round all over, like a ball.',
  cylinder: 'It has 2 flat circle faces and a curved face.',
  cone: 'It has 1 flat circle face and a point.',
  pyramid: 'Its triangle faces meet at a point.',
  prism: 'It has the same triangle at each end.',
};
// The face the hint paints yellow (and turns to the front): the one that gives the shape away.
const SOLID_CLUE = { cube: 'side', cuboid: 'side', cylinder: 'top', cone: 'base', pyramid: 'side', prism: 'end', sphere: null };
const SOLID_EXPLAIN = {
  cube: ['Every face is a square, all the same size.', 'So it is a cube.'],
  cuboid: ['Its faces are rectangles, like a cereal box.', 'So it is a cuboid.'],
  sphere: ['It is round all over, with no flat faces.', 'So it is a sphere.'],
  cylinder: ['It has 2 flat circle faces and 1 curved face.', 'So it is a cylinder.'],
  cone: ['It has 1 flat circle face and a point.', 'So it is a cone.'],
  pyramid: ['Its triangle faces meet at a point at the top.', 'So it is a pyramid.'],
  prism: ['It has the same triangle at each end.', 'So it is a prism.'],
};
const NAMES3 = ['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'pyramid', 'prism'];
const CONFUSE = { cube: 'cuboid', cuboid: 'cube', pyramid: 'prism', prism: 'pyramid', cone: 'cylinder', cylinder: 'cone', sphere: 'cylinder' };
function solidHint(answer) {
  const clue = SOLID_CLUE[answer];
  return clue
    ? { hint: ['Look at the yellow face. Spin it to see more.', SOLID_HINT[answer]], hintProps: { highlight: clue, autoRotate: false } }
    : { hint: ['Spin it all the way round.', SOLID_HINT[answer]] };
}

export const name3d = {
  about: 'Name a 3-D shape (spin it with a finger)',
  levels: 3,
  make(level, R) {
    const shape = level <= 1 ? R.pick(['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'pyramid']) : R.pick(['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'pyramid', 'tri-pyramid', 'prism']);
    const answer = NAME3D[shape];
    let others;
    if (level >= 3) others = [CONFUSE[answer], ...R.sample(NAMES3.filter(x => x !== answer && x !== CONFUSE[answer]), 2)];
    else others = R.sample(NAMES3.filter(x => x !== answer && (level > 1 || x !== 'prism')), 2);
    const opt = v => ({ value: v, label: cap(v) });
    return {
      lines: level <= 1 ? ['What is this 3-D shape called?'] : level === 2 ? ['What is this 3-D shape called?', 'Spin it with your finger.'] : ['Name this 3-D shape.'],
      widget: 'shapes3d',
      props: { shape, autoRotate: true, interactive: true },
      input: 'choice',
      options: R.shuffle([answer, ...others]).map(opt),
      answer,
      ...solidHint(answer),
      explain: SOLID_EXPLAIN[answer],
      reteach: {
        lines: ['What is this 3-D shape called?'],
        widget: 'shapes3d',
        props: { shape: answer === 'pyramid' ? 'pyramid' : shape, autoRotate: true, interactive: true },
        input: 'choice',
        options: R.shuffle([answer, CONFUSE[answer]]).map(opt),
        answer,
        ...solidHint(answer),
        explain: SOLID_EXPLAIN[answer],
      },
    };
  },
};

const FEV_EXPLAIN = {
  'cube.faces': ['Top, bottom and 4 around the sides.', 'A cube has 6 faces.'],
  'cube.edges': ['4 on top, 4 on the bottom, 4 up the sides.', 'A cube has 12 edges.'],
  'cube.vertices': ['4 corners on top and 4 on the bottom.', 'A cube has 8 vertices.'],
  'cuboid.faces': ['Top, bottom and 4 around the sides.', 'A cuboid has 6 faces.'],
  'cuboid.edges': ['4 on top, 4 on the bottom, 4 up the sides.', 'A cuboid has 12 edges.'],
  'cuboid.vertices': ['4 corners on top and 4 on the bottom.', 'A cuboid has 8 vertices.'],
  'pyramid.faces': ['1 square underneath and 4 triangles.', 'This pyramid has 5 faces.'],
  'pyramid.edges': ['4 round the base and 4 up to the point.', 'This pyramid has 8 edges.'],
  'pyramid.vertices': ['4 round the base and 1 at the top.', 'This pyramid has 5 vertices.'],
  'tri-pyramid.faces': ['1 triangle underneath and 3 round the sides.', 'This pyramid has 4 faces.'],
  'tri-pyramid.edges': ['3 round the base and 3 up to the top.', 'This pyramid has 6 edges.'],
  'tri-pyramid.vertices': ['3 round the base and 1 at the top.', 'This pyramid has 4 vertices.'],
  'prism.faces': ['2 triangle ends and 3 rectangles.', 'A triangular prism has 5 faces.'],
  'prism.edges': ['3 on each triangle and 3 joining them.', 'A triangular prism has 9 edges.'],
  'prism.vertices': ['3 corners on each triangle end.', 'A triangular prism has 6 vertices.'],
  'cylinder.faces': ['2 flat circles and 1 curved face.', 'A cylinder has 3 faces.'],
  'cylinder.edges': ['1 round the top and 1 round the bottom.', 'A cylinder has 2 curved edges.'],
  'cone.faces': ['1 flat circle and 1 curved face.', 'A cone has 2 faces.'],
};
const ONE = { faces: 'face', edges: 'edge', vertices: 'vertex' };
const LIT_WORD = { faces: 'yellow', edges: 'blue', vertices: 'blue' };

export const facesEdgesVertices = {
  about: 'Count the faces, edges or vertices of a 3-D shape (tap to count)',
  levels: 3,
  make(level, R) {
    let shape, prop;
    if (level <= 1) { shape = R.pick(['cube', 'cuboid', 'pyramid', 'tri-pyramid']); prop = 'faces'; }
    else if (level === 2) { shape = R.pick(['cube', 'cuboid', 'pyramid', 'tri-pyramid']); prop = R.pick(['edges', 'vertices', 'faces']); }
    else {
      const key = R.pick(['prism.faces', 'prism.edges', 'prism.vertices', 'cylinder.faces', 'cylinder.edges', 'cone.faces', 'pyramid.edges', 'pyramid.vertices', 'cuboid.edges', 'tri-pyramid.edges']);
      [shape, prop] = key.split('.');
    }
    const n = SOLIDS[shape][prop];
    const nm = SOLID_LONG[shape];
    // Help: tapping marks each one, so nothing is counted twice; spinning finds the hidden ones.
    const hint = [`Tap each ${ONE[prop]} once. It turns ${LIT_WORD[prop]}.`, `Spin it to find ${prop} that are not ${LIT_WORD[prop]} yet.`];
    const explain = FEV_EXPLAIN[`${shape}.${prop}`] || [`It has ${n} ${prop}.`];
    return {
      lines: [`How many ${prop} does the ${nm} have?`, ...(level <= 1 ? ['Tap each face to count it.'] : [])],
      widget: 'shapes3d',
      props: { shape, tap: level <= 2 ? prop : null, interactive: true },
      input: 'numpad',
      answer: n,
      hint,
      hintProps: { tap: prop },
      explain,
      reteach: {
        lines: [`Tap every ${ONE[prop]} of the ${nm}.`, 'Spin it to see the back.'],
        widget: 'shapes3d',
        props: { shape, tap: prop },
        input: 'widget',
        goal: { [prop]: n },
        hint,
        explain,
      },
    };
  },
};

// Which 2-D shape is on the yellow face?
const FLAT = ['circle', 'square', 'triangle', 'rectangle'];
const FLAT_WHY = { circle: 'It is round, with no straight sides', square: 'It has 4 straight sides, all the same length', triangle: 'It has 3 straight sides', rectangle: 'It has 4 straight sides: 2 long and 2 short' };
const flatOpt = s => ({ value: s, label: cap(s), widget: 'shapes2d', props: { shape: s, readonly: true } });
const solidOpt = s => ({ value: s, label: cap(NAME3D[s]), widget: 'shapes3d', props: { shape: s, svg: true, readonly: true } });
export const faceShape = {
  about: 'Find the 2-D shape on a face of a 3-D shape',
  levels: 3,
  make(level, R) {
    const L1 = [['cylinder', 'top', 'circle'], ['cube', 'side', 'square'], ['cone', 'base', 'circle'], ['pyramid', 'side', 'triangle']];
    const L2 = [['cuboid', 'side', 'rectangle'], ['pyramid', 'base', 'square'], ['prism', 'end', 'triangle'], ['tri-pyramid', 'side', 'triangle'], ['cylinder', 'base', 'circle']];
    const L3 = [['prism', 'side', 'rectangle'], ['prism', 'base', 'rectangle'], ['cuboid', 'end', 'rectangle'], ['tri-pyramid', 'base', 'triangle']];
    const reverse = level >= 3 && R.chance(0.5);
    if (reverse) {
      const spec = R.pick([
        ['circle', R.pick(['cylinder', 'cone']), ['cube', 'cuboid', 'pyramid', 'prism', 'tri-pyramid']],
        ['triangle', R.pick(['pyramid', 'tri-pyramid', 'prism']), ['cube', 'cuboid', 'cylinder', 'sphere']],
        ['square', R.pick(['cube', 'pyramid']), ['cylinder', 'cone', 'sphere', 'tri-pyramid']],
        ['rectangle', 'cuboid', ['sphere', 'cone', 'tri-pyramid', 'cylinder']],
      ]);
      const [flat, solid, nots] = spec;
      return {
        lines: ['Which 3-D shape has a face like this?'],
        widget: 'shapes2d',
        props: { shape: flat, readonly: true },
        input: 'choice',
        options: R.shuffle([solid, ...R.sample(nots, 2)]).map(solidOpt),
        answer: solid,
        hint: ['Imagine pressing each 3-D shape on paper.', `Which one would print ${an(flat)} ${flat}?`],
        explain: [`${cap(an(NAME3D[solid]))} ${NAME3D[solid]} has ${an(flat)} ${flat} face.`, `Press that face on paper and it prints ${an(flat)} ${flat}.`],
        reteach: faceShape.make(1, R),
      };
    }
    const [shape, highlight, answer] = R.pick(level <= 1 ? L1 : level === 2 ? L2 : L3);
    const nOpts = 3;
    const options = R.shuffle([answer, ...R.sample(FLAT.filter(x => x !== answer && !(answer === 'rectangle' && x === 'square') && !(answer === 'square' && x === 'rectangle')), nOpts - 1)]).map(flatOpt);
    const [rs, rh, ra] = L1[0];
    return {
      lines: ['Look at the yellow face.', 'Which 2-D shape is it?'],
      widget: 'shapes3d',
      props: { shape, highlight, interactive: true },
      input: 'choice',
      options,
      answer,
      // Help: the yellow face is "printed" flat on paper, so its outline is easy to see.
      hint: ['Here it is pressed flat on paper.', 'Count the sides of the print. Are any curved?'],
      hintProps: { print: true, autoRotate: false },
      explain: [`${FLAT_WHY[answer]}.`, `So the yellow face is ${an(answer)} ${answer}.`],
      reteach: level <= 1 ? undefined : {
        lines: ['Look at the yellow face.', 'Which 2-D shape is it?'],
        widget: 'shapes3d', props: { shape: rs, highlight: rh, interactive: true },
        input: 'choice', options: [flatOpt('circle'), flatOpt('square')], answer: ra,
        hint: ['Here it is pressed flat on paper.', 'Is it round, or does it have corners?'],
        hintProps: { print: true, autoRotate: false },
        explain: ['It is round, with no corners.', 'The top of a cylinder is a circle.'],
      },
    };
  },
};

// Everyday objects and their 3-D shapes.
const OBJECTS = [
  ['a tin of beans', 'cylinder'], ['a drum', 'cylinder'], ['a candle', 'cylinder'], ['a kitchen roll', 'cylinder'],
  ['a dice', 'cube'], ['a sugar cube', 'cube'], ['an ice cube', 'cube'],
  ['a cereal box', 'cuboid'], ['a brick', 'cuboid'], ['a shoe box', 'cuboid'], ['a book', 'cuboid'],
  ['a football', 'sphere'], ['a marble', 'sphere'], ['the Moon', 'sphere', 'moon'], ['an orange', 'sphere'],
  ['an ice-cream cone', 'cone'], ['a party hat', 'cone'], ['a traffic cone', 'cone'],
  ['a pyramid in Egypt', 'pyramid'], ['a tent', 'prism'], ['a triangle chocolate box', 'prism'],
];
const ROLL = { sphere: 'It rolls any way and has no flat faces.', cylinder: 'It has 2 flat circle ends and rolls.', cube: 'Every face is a square.', cuboid: 'It is box-shaped with rectangle faces.', cone: 'It has a circle at one end and a point.', pyramid: 'It has a square base and triangle sides.', prism: 'It has the same triangle at each end.' };
// "<object> ..." completes a sentence about the object's shape (the method: what you notice, then the name).
const OBJ_WHY = { sphere: 'is round all over, with no flat faces', cylinder: 'has 2 flat circle ends and a curved side', cube: 'has 6 square faces, all the same size', cuboid: 'is box-shaped, with rectangle faces', cone: 'has a circle at one end and a point', pyramid: 'has a square base and triangle sides', prism: 'has the same triangle at each end' };
export const everydayObject = {
  about: 'Match everyday objects to 3-D shapes',
  levels: 3,
  make(level, R) {
    const solidsOf = [...new Set(OBJECTS.map(o => o[1]))];
    if (level <= 1) {
      const pool = OBJECTS.filter(o => !['pyramid', 'prism'].includes(o[1]));
      const [obj, solid, artName] = R.pick(pool);
      const others = R.sample(['cube', 'cuboid', 'sphere', 'cylinder', 'cone'].filter(s => s !== solid && !(solid === 'cube' && s === 'cuboid') && !(solid === 'cuboid' && s === 'cube')), 2);
      return {
        lines: [`Think of ${obj}.`, 'Which 3-D shape is it like?'],
        caption: cap(obj),
        ...(artName ? { widget: 'objects', props: { n: 1, icon: artName, readonly: true } } : {}),
        input: 'choice',
        options: R.shuffle([solid, ...others]).map(solidOpt),
        answer: solid,
        hint: [`Picture ${obj} in your hand.`, ROLL[solid]],
        explain: [`${cap(obj)} ${OBJ_WHY[solid]}.`, `So it is like ${an(solid)} ${solid}.`],
      };
    }
    if (level === 2) {
      const solid = R.pick(solidsOf);
      const yes = R.pick(OBJECTS.filter(o => o[1] === solid));
      const nos = R.sample(OBJECTS.filter(o => o[1] !== solid && !(solid === 'cube' && o[1] === 'cuboid') && !(solid === 'cuboid' && o[1] === 'cube')), 2);
      return {
        lines: [`Which object is shaped like ${an(NAME3D[solid])} ${NAME3D[solid]}?`],
        widget: 'shapes3d',
        props: { shape: solid, autoRotate: true, interactive: true },
        input: 'choice',
        options: R.shuffle([yes, ...nos]).map(o => ({ value: o[0], label: cap(o[0]) })),
        answer: yes[0],
        hint: [ROLL[solid], 'Picture each object. Which one is like that?'],
        explain: [`${cap(yes[0])} ${OBJ_WHY[solid]}.`, `So it is shaped like ${an(NAME3D[solid])} ${NAME3D[solid]}.`],
        reteach: everydayObject.make(1, R),
      };
    }
    const solid = R.pick(['sphere', 'cylinder', 'cuboid', 'cone']);
    const same = R.sample(OBJECTS.filter(o => o[1] === solid), 3);
    const odd = R.pick(OBJECTS.filter(o => o[1] !== solid && !(solid === 'cuboid' && o[1] === 'cube')));
    return {
      lines: [`Which one is NOT ${an(solid)} ${solid}?`],
      widget: 'shapes3d',
      props: { shape: solid, autoRotate: true, interactive: true },
      input: 'choice',
      options: R.shuffle([...same, odd]).map(o => ({ value: o[0], label: cap(o[0]) })),
      answer: odd[0],
      hint: [ROLL[solid], 'Picture each object. Which one is a different shape?'],
      explain: [`${cap(odd[0])} is like ${an(NAME3D[odd[1]])} ${NAME3D[odd[1]]}.`, `The others are all ${solid}s.`],
      reteach: everydayObject.make(1, R),
    };
  },
};

// ---------- sorting shapes by a property ----------
const LETTERS = ['A', 'B', 'C', 'D'];
const RULES = [
  { id: 'four', ask: 'Which shape has 4 sides?', test: s => shapeInfo(s).curved === 0 && shapeInfo(s).sides === 4, yes: ['square', 'rectangle', 'kite', 'trapezium', 'parallelogram', 'rhombus'], no: ['triangle', 'pentagon', 'hexagon', 'circle', 'semicircle'], lvl: 1 },
  { id: 'three', ask: 'Which shape has 3 sides?', test: s => shapeInfo(s).curved === 0 && shapeInfo(s).sides === 3, yes: ['triangle', 'right-triangle', 'long-triangle', 'scalene'], no: ['square', 'pentagon', 'circle', 'rectangle', 'hexagon'], lvl: 1 },
  { id: 'curved', ask: 'Which shape has a curved side?', test: s => shapeInfo(s).curved > 0, yes: ['circle', 'semicircle', 'oval'], no: ['square', 'triangle', 'hexagon', 'rectangle', 'pentagon'], lvl: 1 },
  { id: 'morethan4', ask: 'Which shape has more than 4 vertices?', test: s => shapeInfo(s).vertices > 4, yes: ['pentagon', 'hexagon', 'octagon', 'irregular-pentagon', 'l-hexagon'], no: ['square', 'triangle', 'kite', 'rectangle', 'right-triangle'], lvl: 3 },
  { id: 'sym', ask: 'Which shape has a vertical line of symmetry?', test: s => isSymmetric(s, 0), yes: ['heart', 'house', 'kite', 'trapezium', 'arrow', 'pentagon'], no: ['scalene', 'parallelogram', 'irregular-quad', 'right-triangle', 'irregular-pentagon'], lvl: 3 },
  { id: 'novert', ask: 'Which shape has no vertices?', test: s => shapeInfo(s).vertices === 0, yes: ['circle', 'oval'], no: ['semicircle', 'triangle', 'square', 'hexagon', 'heart'], lvl: 3 },
];
// What a child would notice about one shape, for the rule being sorted by ("has 5 sides", "has a curved side").
function noticeFor(rule, s) {
  const info = shapeInfo(s);
  if (rule === 'four' || rule === 'three') return info.curved ? 'has a curved side' : `has ${info.sides} sides`;
  if (rule === 'curved') return info.curved ? 'has a curved side' : 'has only straight sides';
  if (rule === 'morethan4' || rule === 'novert') return `has ${info.vertices} ${info.vertices === 1 ? 'vertex' : 'vertices'}`;
  return isSymmetric(s, 0) ? 'has two matching halves' : 'has halves that do not match';
}
// What the shapes that do not fit have in common (pick-the-one-that-fits items).
const SORT_OTHERS = { four: 'None of the others have 4 sides.', three: 'None of the others have 3 sides.', curved: 'The others have only straight sides.', morethan4: 'None of the others have more than 4.', sym: 'The others have halves that do not match.', novert: 'The others all have corners.' };
// Help per rule: number the sides or vertices of every shape, or say what to look for.
const SORT_HINT = {
  four: { hint: ['The blue numbers count the sides of each shape.'], hintProps: { showAll: 'sides' } },
  three: { hint: ['The blue numbers count the sides of each shape.'], hintProps: { showAll: 'sides' } },
  curved: { hint: ['Run your finger round each shape.', 'Does any side bend?'] },
  morethan4: { hint: ['The blue numbers count the corners of each shape.'], hintProps: { showAll: 'vertices' } },
  novert: { hint: ['The blue numbers count the corners of each shape.'], hintProps: { showAll: 'vertices' } },
  sym: { hint: ['Imagine folding each one straight down the middle.', 'Would the two halves match?'] },
};
export const sortShapes = {
  about: 'Sort shapes by a property: pick the one that fits, or the one that does not belong',
  levels: 3,
  make(level, R) {
    const oddOneOut = level === 2;
    const rule = R.pick(RULES.filter(r => (level >= 3 ? true : r.lvl === 1)));
    let picks, answerIdx;
    if (oddOneOut) {
      const ins = R.sample(rule.yes, 3), out = R.pick(rule.no);
      picks = R.shuffle([...ins.map(s => ({ s, odd: false })), { s: out, odd: true }]);
      answerIdx = picks.findIndex(x => x.odd);
    } else {
      const n = level >= 3 ? 4 : 3;
      const yes = R.pick(rule.yes), nos = R.sample(rule.no, n - 1);
      picks = R.shuffle([{ s: yes, odd: true }, ...nos.map(s => ({ s, odd: false }))]);
      answerIdx = picks.findIndex(x => x.odd);
    }
    const shapes = picks.map((x, i) => ({ shape: x.s, rotate: level >= 3 && rule.id !== 'sym' ? R.pick([0, 30, 90]) : 0, label: LETTERS[i] }));
    const answer = LETTERS[answerIdx];
    const groupWord = { four: '4 sides', three: '3 sides', curved: 'a curved side', morethan4: 'more than 4 vertices', sym: 'a line of symmetry', novert: 'no vertices' }[rule.id];
    const h = SORT_HINT[rule.id];
    const others = LETTERS.slice(0, picks.length).filter(l => l !== answer);
    const list = others.length === 3 ? `${others[0]}, ${others[1]} and ${others[2]}` : `${others[0]} and ${others[1]}`;
    return {
      lines: oddOneOut ? [`3 of these have ${groupWord}.`, 'Which one does not belong?'] : [rule.ask],
      widget: 'shapes2d',
      props: { shapes, readonly: true },
      input: 'choice',
      options: shapes.map(s => ({ value: s.label, label: s.label })),
      answer,
      hint: oddOneOut ? [...h.hint, 'Which one is different?'].slice(0, 3) : h.hint,
      ...(h.hintProps ? { hintProps: h.hintProps } : {}),
      explain: oddOneOut
        ? [`Shapes ${list} have ${groupWord}.`, `Shape ${answer} ${noticeFor(rule.id, picks[answerIdx].s)}, so it does not belong.`]
        : [`Shape ${answer} ${noticeFor(rule.id, picks[answerIdx].s)}.`, SORT_OTHERS[rule.id]],
      reteach: level > 1 ? sortShapes.make(1, R) : undefined,
    };
  },
};

// ---------- composing shapes from smaller shapes (DfE 1G–2) ----------
const H3 = Math.sqrt(3) / 2;
const TRI_SETS = {
  'big triangle': [[[0, 0], [1, 0], [0.5, -H3]], [[1, 0], [2, 0], [1.5, -H3]], [[0.5, -H3], [1.5, -H3], [1, -2 * H3]], [[0.5, -H3], [1.5, -H3], [1, 0]]],
  hexagon: Array.from({ length: 6 }, (_, k) => { const a = (k * Math.PI) / 3, b = ((k + 1) * Math.PI) / 3; return [[0, 0], [Math.cos(a), Math.sin(a)], [Math.cos(b), Math.sin(b)]]; }),
  trapezium: [[[0, 0], [1, 0], [0.5, -H3]], [[1, 0], [0.5, -H3], [1.5, -H3]], [[1, 0], [2, 0], [1.5, -H3]]],
  rhombus: [[[0, 0], [1, 0], [0.5, -H3]], [[1, 0], [0.5, -H3], [1.5, -H3]]],
  square: [[[-1, -1], [1, -1], [0, 0]], [[1, -1], [1, 1], [0, 0]], [[1, 1], [-1, 1], [0, 0]], [[-1, 1], [-1, -1], [0, 0]]],
};
// Two colours for the hint, chosen so no two triangles that touch along a side share a colour.
const TRI_TWO = { 'big triangle': [0, 0, 0, 1], hexagon: [0, 1, 0, 1, 0, 1], trapezium: [0, 1, 0], rhombus: [0, 1], square: [0, 1, 0, 1] };
function centred(polys, cx = 400, cy = 250, colour = 'green') {
  const xs = polys.flat().map(p => p[0]), ys = polys.flat().map(p => p[1]);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
  return polys.map((poly, i) => ({ poly: poly.map(([x, y]) => [x - mx, y - my]), x: cx, y: cy, colour: Array.isArray(colour) ? colour[i % colour.length] : colour }));
}
// pieces: spread apart to start; join: the same pieces pushed together (used by the hints).
const PAIRS = {
  square: { label: '2 triangles', pieces: [{ shape: 'half-square', x: 378, y: 266 }, { shape: 'half-square', rotate: 180, x: 422, y: 234 }], join: [{ shape: 'half-square', x: 400, y: 250 }, { shape: 'half-square', rotate: 180, x: 400, y: 250 }], target: [{ poly: [[-1, -1], [1, -1], [1, 1], [-1, 1]], x: 400, y: 250 }] },
  rectangle: { label: '2 squares', pieces: [{ shape: 'square', x: 310, y: 250 }, { shape: 'square', x: 490, y: 250 }], join: [{ shape: 'square', x: 330, y: 250 }, { shape: 'square', x: 470, y: 250 }], target: [{ poly: [[-2, -1], [2, -1], [2, 1], [-2, 1]], x: 400, y: 250 }] },
  circle: { label: '2 semicircles', pieces: [{ shape: 'semicircle', x: 400, y: 202 }, { shape: 'semicircle', rotate: 180, x: 400, y: 298 }], join: [{ shape: 'semicircle', x: 400, y: 218.5 }, { shape: 'semicircle', rotate: 180, x: 400, y: 281.5 }], target: [{ shape: 'circle', x: 400, y: 250 }] },
  triangle: { label: '2 right-angled triangles', pieces: [{ shape: 'half-square', rotate: 270, x: 305, y: 250 }, { shape: 'half-square', x: 495, y: 250 }], join: [{ shape: 'half-square', rotate: 270, x: 330, y: 250 }, { shape: 'half-square', x: 470, y: 250 }], target: [{ poly: [[-2, 1], [2, 1], [0, -1]], x: 400, y: 250 }] },
  hexagon: { label: '2 trapeziums', pieces: [{ poly: [[-1, 0], [1, 0], [0.5, -H3], [-0.5, -H3]], x: 400, y: 236 }, { poly: [[-1, 0], [1, 0], [0.5, H3], [-0.5, H3]], x: 400, y: 264 }], join: [{ poly: [[-1, 0], [1, 0], [0.5, -H3], [-0.5, -H3]], x: 400, y: 250 }, { poly: [[-1, 0], [1, 0], [0.5, H3], [-0.5, H3]], x: 400, y: 250 }], target: [{ shape: 'hexagon', x: 400, y: 250 }] },
};
const PIECE_LABEL = { square: '2 triangles', rectangle: '2 squares', circle: '2 semicircles', hexagon: '2 trapeziums' };
const OUTLINE_WHY = { square: 'The outside has 4 equal straight sides', rectangle: 'The outside has 2 long and 2 short sides', circle: 'The outside is round all the way', triangle: 'The outside has 3 straight sides', hexagon: 'The outside has 6 straight sides' };
// Spread pieces about the middle (400, 250) by f; one unit is 70 * f pixels.
const grow = (list, f, colour) => ({ shapes: list.map(p => ({ ...p, x: 400 + (p.x - 400) * f, y: 250 + (p.y - 250) * f, colour })), unit: 70 * f, readonly: true });
export const composeShapes = {
  about: 'Put smaller shapes together to make a bigger shape',
  levels: 3,
  make(level, R) {
    if (level <= 1) {
      const whole = R.pick(['square', 'rectangle', 'circle', 'triangle']);
      const pool = { square: ['rectangle', 'triangle', 'circle'], rectangle: ['square', 'triangle', 'hexagon'], circle: ['square', 'oval', 'triangle'], triangle: ['square', 'rectangle', 'circle'] }[whole];
      const pr = PAIRS[whole];
      return {
        lines: ['Push these 2 pieces together.', 'What shape do they make?'],
        widget: 'shapes2d',
        props: grow(pr.pieces, 1.4, 'blue'),
        input: 'choice',
        options: R.shuffle([whole, ...R.sample(pool, 2)]).map(shapeOpt),
        answer: whole,
        // Help: the pieces slide together, so only the outline is left to name.
        hint: ['Here they are, pushed together.', 'Trace round the outside edge. What shape is it?'],
        hintProps: grow(pr.join, 1.4, 'blue'),
        explain: [`${OUTLINE_WHY[whole]}.`, `So ${pr.label} make ${an(whole)} ${whole}.`],
      };
    }
    if (level === 2) {
      const whole = R.pick(['square', 'rectangle', 'circle', 'hexagon']);
      const labels = R.shuffle([whole, ...R.sample(Object.keys(PIECE_LABEL).filter(k => k !== whole), 2)]);
      return {
        lines: ['Which 2 pieces make this shape?'],
        widget: 'shapes2d',
        props: grow(PAIRS[whole].target, 1.5, 'purple'),
        input: 'choice',
        options: labels.map(k => ({ value: k, label: PIECE_LABEL[k], widget: 'shapes2d', props: grow(PAIRS[k].pieces, 1.6, 'blue') })),
        answer: whole,
        // Help: a cut line appears, splitting the shape into its 2 pieces.
        hint: ['Look: a line now cuts it into 2 pieces.', 'Which card shows those 2 pieces?'],
        hintProps: grow(PAIRS[whole].join, 1.5, 'purple'),
        explain: [`Cut along the line and you get ${PIECE_LABEL[whole]}.`, `So ${PIECE_LABEL[whole]} make ${an(whole)} ${whole}.`],
        reteach: composeShapes.make(1, R),
      };
    }
    const name = R.pick(['big triangle', 'hexagon', 'trapezium', 'rhombus', 'square']);
    const polys = TRI_SETS[name];
    const n = polys.length;
    const colour = R.pick(['green', 'yellow', 'blue']);
    const other = { green: 'yellow', yellow: 'blue', blue: 'yellow' }[colour];
    const unit = name === 'square' ? 170 : 190;
    return {
      lines: ['This shape is made of small triangles.', 'How many triangles make it?'],
      widget: 'shapes2d',
      props: { shapes: centred(polys, 400, 250, colour), unit, readonly: true },
      input: 'numpad',
      answer: n,
      // Help: the triangles take turns in 2 colours, so each one stands out.
      hint: ['Now the triangles are 2 colours, so each one stands out.', 'Count each triangle once.'],
      hintProps: { shapes: centred(polys, 400, 250, TRI_TWO[name].map(k => (k ? other : colour))), unit },
      explain: [`Count each triangle once: ${upTo(n)}.`, `It is made of ${n} triangles.`],
      reteach: {
        lines: ['How many triangles make this shape?'],
        widget: 'shapes2d',
        props: { shapes: centred(TRI_SETS.rhombus, 400, 250, 'green'), unit: 190, readonly: true },
        input: 'numpad', answer: 2,
        hint: ['Each triangle is a different colour now.', 'Count them.'],
        hintProps: { shapes: centred(TRI_SETS.rhombus, 400, 250, ['green', 'yellow']), unit: 190 },
        explain: ['Count each triangle once: 1, 2.', 'It is made of 2 triangles.'],
      },
    };
  },
};

// ---------- repeating patterns ----------
// Palette words only (style v2). Orange is left out: it is too close to yellow to tell apart in a pattern.
const COLOUR_SET = ['yellow', 'blue', 'pink', 'green', 'purple'];
const PSHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'hexagon'];
const ARROW_DIR = { 0: 'up', 90: 'right', 180: 'down', 270: 'left' };
const say = it => (it.shape === 'arrow' ? `arrow pointing ${ARROW_DIR[((it.rotate || 0) % 360 + 360) % 360] || 'up'}` : `${it.colour ? it.colour + ' ' : ''}${it.shape || it.art}`);
const pItemOpt = it => ({ value: patternKey(it), label: cap(say(it)), widget: 'shapes2d', props: { shape: it.shape, rotate: it.rotate || 0, colour: it.colour, readonly: true } });

function makeUnit(level, R) {
  if (level <= 1) {
    if (R.chance(0.5)) { const [a, b] = R.sample(COLOUR_SET, 2); const s = R.pick(PSHAPES); return [{ shape: s, colour: a }, { shape: s, colour: b }]; }
    const [a, b] = R.sample(PSHAPES, 2); const c = R.pick(COLOUR_SET); return [{ shape: a, colour: c }, { shape: b, colour: c }];
  }
  if (level === 2) {
    const kind = R.pick(['ABC', 'AAB', 'ABB', 'AB2']);
    const [a, b, c] = R.sample(PSHAPES, 3), [x, y, z] = R.sample(COLOUR_SET, 3);
    if (kind === 'ABC') return [{ shape: a, colour: x }, { shape: b, colour: y }, { shape: c, colour: z }];
    if (kind === 'AAB') return [{ shape: a, colour: x }, { shape: a, colour: x }, { shape: b, colour: y }];
    if (kind === 'ABB') return [{ shape: a, colour: x }, { shape: b, colour: y }, { shape: b, colour: y }];
    return [{ shape: a, colour: x }, { shape: b, colour: x }];
  }
  const kind = R.pick(['quarter', 'half', 'quarterAcw', 'shapeColour']);
  const col = R.pick(COLOUR_SET);
  if (kind === 'quarter') return [0, 90, 180, 270].map(r => ({ shape: 'arrow', colour: col, rotate: r }));
  if (kind === 'quarterAcw') return [0, 270, 180, 90].map(r => ({ shape: 'arrow', colour: col, rotate: r }));
  if (kind === 'half') return [{ shape: 'arrow', colour: col, rotate: 0 }, { shape: 'arrow', colour: col, rotate: 180 }, { shape: 'arrow', colour: col, rotate: 180 }];
  const [a, b] = R.sample(PSHAPES, 2), [x, y, z] = R.sample(COLOUR_SET, 3);
  return [{ shape: a, colour: x }, { shape: b, colour: y }, { shape: a, colour: z }];
}

export const patternNext = {
  about: 'What comes next (or in the gap) in a repeating pattern of shapes, colours and turns',
  levels: 3,
  make(level, R) {
    const unit = makeUnit(level, R);
    const k = unit.length;
    const len = Math.max(k * 2 + R.int(0, k - 1), 5);
    const seq = Array.from({ length: len }, (_, i) => ({ ...unit[i % k] }));
    const middleGap = level >= 2 && R.chance(0.4);
    let answerItem, items, gap;
    if (middleGap) {
      gap = R.int(k, len - 2);
      answerItem = seq[gap];
      items = seq;
    } else {
      answerItem = unit[len % k];
      items = seq;
      gap = 'end';
    }
    const uniq = [...new Map(unit.map(u => [patternKey(u), u])).values()];
    let distract = [];
    if (unit[0].shape === 'arrow') {
      distract = [0, 90, 180, 270].map(r => ({ shape: 'arrow', colour: unit[0].colour, rotate: r })).filter(d => patternKey(d) !== patternKey(answerItem));
    } else {
      distract = uniq.filter(u => patternKey(u) !== patternKey(answerItem));
      const extra = { shape: R.pick(PSHAPES.filter(s => !unit.some(u => u.shape === s))), colour: R.pick(COLOUR_SET) };
      distract.push(extra);
    }
    const opts = R.shuffle([answerItem, ...R.sample(distract, Math.min(2, distract.length))]);
    const arrows = unit[0].shape === 'arrow';
    const turning = arrows && k === 4; // quarter turns every time (the up, down, down pattern does not turn every time)
    const lines = arrows ? [turning ? 'The arrow turns each time.' : 'Look at which way each arrow points.', middleGap ? 'What goes in the gap?' : 'What comes next?'] : [middleGap ? 'What goes in the gap?' : 'What comes next?'];
    // Arrows are said by direction only ("up, down, down"), so the lines stay short.
    const chunk = arrows ? unit.map(it => ARROW_DIR[((it.rotate || 0) % 360 + 360) % 360] || 'up').join(', ') : unit.map(say).join(', ');
    const turnWord = { quarter: 'a quarter turn clockwise', quarterAcw: 'a quarter turn anticlockwise' };
    const rotStep = arrows && k === 4 ? ((unit[1].rotate - unit[0].rotate + 360) % 360 === 90 ? turnWord.quarter : turnWord.quarterAcw) : null;
    const where = middleGap ? 'the gap' : 'the next one';
    return {
      lines,
      widget: 'pattern',
      props: { items, gap, readonly: true },
      input: 'choice',
      options: opts.map(pItemOpt),
      answer: patternKey(answerItem),
      // Help: brackets mark each chunk that repeats.
      hint: turning
        ? ['The brackets show the part that repeats.', 'Which way does the arrow turn each time?']
        : ['The brackets show the part that repeats.', `Say it out loud: ${chunk}...`],
      hintProps: { unit: k },
      explain: rotStep
        ? [`Each arrow makes ${rotStep}.`, `So ${where} is the ${say(answerItem)}.`]
        : [arrows ? `The arrows go ${chunk}, then again.` : `The part that repeats is: ${chunk}.`, `So ${where} is the ${say(answerItem)}.`],
      reteach: level > 1 ? patternNext.make(1, R) : undefined,
    };
  },
};

// ---------- turns ----------
const DIR_WORD = { N: 'up', E: 'right', S: 'down', W: 'left' };
const DIR_OPTS = [['N', '↑ Up'], ['E', '→ Right'], ['S', '↓ Down'], ['W', '← Left']].map(([d, l]) => ({ value: d, label: l }));
// 3 directions (always including the answer and the start) at lower levels, all 4 at level 3; kept in compass order.
function dirOpts(R, ans, from, all) {
  if (all) return DIR_OPTS;
  const keep = new Set([ans, from]);
  while (keep.size < 3) keep.add(R.pick(['N', 'E', 'S', 'W'].filter(d => !keep.has(d))));
  return DIR_OPTS.filter(o => keep.has(o.value));
}
const TURN_PHRASE = q => ({ 1: 'a quarter turn clockwise', '-1': 'a quarter turn anticlockwise', 2: 'a half turn', '-2': 'a half turn', 3: 'a three-quarter turn clockwise', '-3': 'a three-quarter turn anticlockwise', 4: 'a whole turn' }[q]);
// The quarter turns a turn is made of, as rover commands (a half turn is shown clockwise).
const turnCmds = q => Array(Math.abs(q)).fill(q < 0 ? 'left' : 'right');
// The directions passed through, one quarter turn at a time.
function quarterPath(from, q) {
  const out = [];
  for (let i = 1; i <= Math.abs(q); i++) out.push(DIR_WORD[turnDir(from, Math.sign(q) * i)]);
  return out;
}

export const turns = {
  about: 'Which way does the rover face after a turn?',
  levels: 3,
  make(level, R) {
    const from = R.pick(['N', 'E', 'S', 'W']);
    let qs;
    if (level <= 1) qs = [R.pick([1, 1, 2, -1])];
    else if (level === 2) qs = [R.pick([1, -1, 2, 4, -1])];
    else qs = R.chance(0.5) ? [R.pick([3, -3])] : [R.pick([1, -1]), R.pick([1, -1, 2])];
    const total = qs.reduce((a, b) => a + b, 0);
    const to = turnDir(from, total);
    const phrase = qs.map(TURN_PHRASE).join(', then ');
    const lines = qs.length === 1 ? [`It makes ${phrase}.`, 'Which way does it face now?'] : [`It makes ${TURN_PHRASE(qs[0])},`, `then ${TURN_PHRASE(qs[1])}.`, 'Which way does it face now?'];
    let explain;
    if (qs.length === 1) {
      const q = qs[0];
      if (Math.abs(q) === 1) explain = [`It started facing ${DIR_WORD[from]}.`, `After ${phrase}, it faces ${DIR_WORD[to]}.`];
      else if (q === 4) explain = [`It started facing ${DIR_WORD[from]}.`, `Turn a quarter at a time: ${quarterPath(from, 4).join(', ')}.`, 'A whole turn ends where it started.'];
      else explain = [`It started facing ${DIR_WORD[from]}.`, `Turn a quarter at a time: ${quarterPath(from, q).join(', ')}.`, `So it faces ${DIR_WORD[to]}.`];
    } else {
      const mid = turnDir(from, qs[0]);
      explain = [`It started facing ${DIR_WORD[from]}.`, `${cap(TURN_PHRASE(qs[0]))}: now ${DIR_WORD[mid]}.`, `${cap(TURN_PHRASE(qs[1]))}: now ${DIR_WORD[to]}.`];
    }
    const helpLines = ['Try it: press the turn buttons.', 'Blue turns clockwise. Pink turns anticlockwise.'];
    const big = Math.max(...qs.map(Math.abs));
    if (big >= 2) helpLines.push({ 2: 'A half turn is 2 quarter turns.', 3: 'A three-quarter turn is 3 quarter turns.', 4: 'A whole turn is 4 quarter turns.' }[big]);
    return {
      lines,
      widget: 'rover',
      props: { cols: 3, rows: 3, start: { x: 1, y: 1, dir: from }, trail: false, showTurnArc: true, answerCmds: qs.flatMap(turnCmds), readonly: true },
      input: 'choice',
      options: dirOpts(R, to, from, level >= 3),
      answer: to,
      hint: helpLines,
      hintProps: { controls: ['left', 'right'], showTurnArc: true, interactive: true, readonly: false },
      explain,
      reteach: level > 1 ? {
        lines: ['It makes a quarter turn clockwise.', 'Which way does it face now?'],
        widget: 'rover',
        props: { cols: 3, rows: 3, start: { x: 1, y: 1, dir: 'N' }, trail: false, showTurnArc: true, answerCmds: ['right'], readonly: true },
        input: 'choice', options: dirOpts(R, 'E', 'N', false), answer: 'E',
        hint: ['Press the blue clockwise button once.', 'Clockwise is the way clock hands go.'],
        hintProps: { controls: ['right'], showTurnArc: true, interactive: true, readonly: false },
        explain: ['It started facing up.', 'A quarter turn clockwise makes it face right.'],
      } : undefined,
    };
  },
};

// ---------- drive the rover to the flag ----------
function describeRoute(cmds) {
  const parts = [];
  for (let i = 0; i < cmds.length; i++) {
    if (cmds[i] === 'forward') {
      let n = 1;
      while (cmds[i + 1] === 'forward') { n++; i++; }
      parts.push(`forward ${n}`);
    } else parts.push(cmds[i] === 'right' ? 'quarter turn clockwise' : 'quarter turn anticlockwise');
  }
  const out = [];
  for (let i = 0; i < parts.length; i += 2) out.push(cap(parts.slice(i, i + 2).join(', ')) + (i + 2 >= parts.length ? '.' : ','));
  return out.slice(0, 3);
}

export const roverPath = {
  about: 'Drive or program the rover to the flag',
  levels: 3,
  make(level, R) {
    const cols = 6, rows = 5;
    for (let attempt = 0; attempt < 60; attempt++) {
      let start, target, rocks = [], controls, program = false;
      if (level <= 1) {
        const dir = R.pick(['N', 'E']);
        if (dir === 'N') { const x = R.int(0, cols - 1); start = { x, y: rows - 1, dir }; target = { x, y: R.int(0, rows - 3) }; }
        else { const y = R.int(0, rows - 1); start = { x: 0, y, dir }; target = { x: R.int(2, cols - 1), y }; }
        controls = ['forward', 'back'];
      } else if (level === 2) {
        start = { x: R.int(0, 2), y: R.int(2, rows - 1), dir: R.pick(['N', 'E']) };
        target = { x: R.int(3, cols - 1), y: R.int(0, 1) };
        controls = ['forward', 'left', 'right'];
      } else {
        start = { x: R.int(0, 1), y: R.int(2, rows - 1), dir: R.pick(['N', 'E', 'S']) };
        target = { x: R.int(3, cols - 1), y: R.int(0, rows - 1) };
        const nr = R.int(1, 2);
        for (let k = 0; k < nr; k++) rocks.push({ x: R.int(1, cols - 2), y: R.int(0, rows - 1) });
        controls = ['forward', 'left', 'right'];
        program = true;
      }
      if (rocks.some(r => (r.x === start.x && r.y === start.y) || (r.x === target.x && r.y === target.y))) continue;
      const route = roverRoute(cols, rows, start, target, rocks);
      if (!route || !route.length) continue;
      const turnsN = route.filter(c => c !== 'forward').length;
      if (level === 2 && turnsN < 1) continue;
      if (level >= 3 && (route.length > 12 || turnsN < 1)) continue;
      return {
        lines: level <= 1 ? ['Drive the rover to the flag.'] : level === 2 ? ['Drive the rover to the flag.', 'You will need a quarter turn.'] : ['Plan the route with arrow cards.', 'Then press Go!'],
        widget: 'rover',
        props: { cols, rows, start, target, rocks, controls, program, showTurnArc: level >= 2 },
        input: 'widget',
        goal: { atTarget: true },
        // Help: the dashed blue arrow shows the squares Forward will cross (it follows the rover as it turns).
        hint: level <= 1 ? ['The blue arrow shows where Forward goes.', 'Press Forward until you reach the flag.']
          : level === 2 ? ['The blue arrow shows where Forward goes.', 'Drive straight, then turn to face the flag.']
            : ['Plan one card at a time.', 'Put your finger where the rover would be after each card.', 'Undo takes away the last card.'],
        ...(level <= 2 ? { hintProps: { ahead: true } } : {}),
        explain: describeRoute(route),
        reteach: level > 1 ? {
          lines: ['Drive the rover to the flag.'],
          widget: 'rover',
          props: { cols, rows, start: { x: 1, y: 4, dir: 'N' }, target: { x: 1, y: 1 }, controls: ['forward', 'back'] },
          input: 'widget', goal: { atTarget: true },
          hint: ['The blue arrow shows where Forward goes.', 'Press Forward until you reach the flag.'],
          hintProps: { ahead: true },
          explain: ['Forward 3.'],
        } : undefined,
      };
    }
    return roverPath.make(1, R);
  },
};

// ---------- right angles in turns and shapes ----------
export const rightAngles = {
  about: 'How many right angles in a turn or a shape?',
  levels: 3,
  make(level, R) {
    const turnItem = (q, start = 'N') => ({
      lines: q === 1 ? ['How many right angles make a quarter turn?'] : ['A quarter turn is 1 right angle.', `How many right angles make ${TURN_PHRASE(q).replace(' clockwise', '')}?`],
      widget: 'rover',
      props: { cols: 3, rows: 3, start: { x: 1, y: 1, dir: start }, controls: ['right'], showTurnArc: true, trail: false, interactive: true, answerCmds: turnCmds(q) },
      input: 'numpad',
      answer: Math.abs(q),
      hint: ['Press the clockwise button and count the turns.', 'Each quarter turn is 1 right angle.'],
      explain: [`${cap(TURN_PHRASE(q).replace(' clockwise', ''))} is ${Math.abs(q)} quarter turns.`, `So it is ${Math.abs(q)} right angles.`],
    });
    const shapeItem = shape => {
      const n = rightAngleCount(shape);
      return {
        lines: ['How many right angles does this shape have?', 'A right angle is a square corner.'],
        widget: 'shapes2d',
        props: { shape, rotate: R.pick([0, 0, 90, 30]), readonly: true },
        input: 'numpad',
        answer: n,
        // Help: a little square appears in every square corner.
        hint: ['A little square now marks each square corner.', 'Count the little squares.'],
        hintProps: { marks: 'right' },
        explain: n
          ? ['Check each corner: is it square, like a book corner?', `${n} ${n === 1 ? 'corner is a right angle' : 'corners are right angles'}.`]
          : ['Check each corner: is it square, like a book corner?', 'None of them is. So it has 0 right angles.'],
        reteach: {
          lines: ['Count the little squares in the corners.'],
          widget: 'shapes2d', props: { shape: 'square', marks: 'right', readonly: true },
          input: 'numpad', answer: 4,
          hint: ['Each little square marks a right angle.', 'Count round: one in each corner.'],
          explain: ['Count round the corners: 1, 2, 3, 4.', 'A square has 4 right angles.'],
        },
      };
    };
    if (level <= 1) return turnItem(R.pick([2, 4, 2]), R.pick(['N', 'E']));
    if (level === 2) return R.chance(0.5) ? turnItem(R.pick([3, 2, 4])) : shapeItem(R.pick(['square', 'rectangle', 'right-triangle', 'half-square']));
    // No shapes with inside (reflex) corners: from outside they look like square corners too, so a child could fairly count them.
    return R.chance(0.3) ? turnItem(R.pick([3, 4])) : shapeItem(R.pick(['house', 'half-square', 'right-triangle', 'triangle', 'pentagon', 'rectangle', 'trapezium', 'parallelogram']));
  },
};
