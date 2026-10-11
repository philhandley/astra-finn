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
const EXPLAIN2D = {
  circle: ['It is a circle.', 'It is round, with 1 curved side.'],
  semicircle: ['It is a semicircle.', 'Half a circle: 1 curved side and 1 straight side.'],
  oval: ['It is an oval.', 'It looks like a stretched circle.'],
  triangle: ['It is a triangle.', 'It has 3 straight sides.'],
  square: ['It is a square.', '4 straight sides, all the same length.'],
  rectangle: ['It is a rectangle.', '4 straight sides and 4 square corners.'],
  pentagon: ['This shape is a pentagon.', 'It has exactly 5 straight sides.'],
  hexagon: ['This shape is a hexagon.', 'It has exactly 6 straight sides.'],
  octagon: ['This shape is an octagon.', 'It has exactly 8 straight sides.'],
  quadrilateral: ['This shape is a quadrilateral.', 'It has exactly 4 straight sides.'],
};
const shapeOpt = name => ({ value: name, label: cap(name) });

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
      scale = R.pick([0.5, 0.7, 0.85, 1]);
      pool = ['circle', 'triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'semicircle', 'oval'];
    } else {
      shape = R.pick(['octagon', 'irregular-pentagon', 'irregular-hexagon', 'l-hexagon', 'house', 'scalene', 'long-triangle', 'right-triangle', 'irregular-quad', 'kite', 'trapezium', 'parallelogram', 'pentagon', 'hexagon']);
      rotate = R.pick([0, 20, 45, 90, 160, 200, 270]);
      scale = R.pick([0.55, 0.75, 1]);
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
      hint: answer === 'circle' || answer === 'oval' || answer === 'semicircle' ? ['Is it all curved?', 'Does it have any straight sides?'] : ['Count the sides.', 'Tap each side as you count.'],
      hintProps: { tap: 'sides', interactive: true, readonly: false },
      explain,
      reteach: {
        lines: ['What is this shape called?'],
        widget: 'shapes2d',
        props: { shape: regular, readonly: true },
        input: 'choice',
        options: R.shuffle([answer, other2]).map(shapeOpt),
        answer,
        hint: ['Count the sides.'],
        hintProps: { tap: 'sides', interactive: true, readonly: false },
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
  yes3: ['This is a triangle because it has 3 straight sides.', 'Turned or stretched, it is still a triangle.'],
  no4: ['This is not a triangle because it has 4 sides.'],
  no5: ['This is not a triangle because it has 5 sides.'],
  no6: ['This is not a triangle because it has 6 sides.'],
  curved: ['This is not a triangle because some sides are curved.'],
};
function reasonFor(shape) {
  const info = shapeInfo(shape);
  if (info.curved > 0) return 'curved';
  return { 3: 'yes3', 4: 'no4', 5: 'no5', 6: 'no6' }[info.sides] || 'no6';
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
    const hint = ['A triangle has 3 sides.', 'All 3 sides are straight.'];
    if (level <= 1) {
      const answer = isTri ? 'yes' : 'no';
      return {
        lines: ['Is this a triangle?'],
        widget: 'shapes2d',
        props: { shape, rotate, readonly: true },
        input: 'choice',
        options: YESNO,
        answer,
        hint,
        hintProps: { tap: 'sides', interactive: true, readonly: false },
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
      hint,
      hintProps: { tap: 'sides', interactive: true, readonly: false },
      explain: REASON_EXPLAIN[reason],
      reteach: {
        lines: ['Is this a triangle?'],
        widget: 'shapes2d',
        props: { shape: simple, readonly: true },
        input: 'choice',
        options: YESNO,
        answer: simple === 'triangle' ? 'yes' : 'no',
        hint,
        explain: REASON_EXPLAIN[simple === 'triangle' ? 'yes3' : 'no4'],
      },
    };
  },
};

// ---------- counting sides and vertices ----------
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
  const explain = n === 0
    ? [`A ${info.name} has 0 vertices.`, 'It has no corners at all.']
    : [`It has ${n} ${n === 1 ? one : word}.`, ...(named ? [`So it is ${an(named)} ${named}.`] : []), ...(kind === 'vertices' ? ['Each corner is 1 vertex.'] : ['Count each side once and only once.'])].slice(0, 3);
  const hint = kind === 'sides' ? ['Start at the top and go round one way.', 'Tap each side as you count.'] : ['A vertex is a corner where sides meet.', 'Tap each corner as you count.'];
  const small = kind === 'sides' ? 'triangle' : 'square';
  const smallN = kind === 'sides' ? 3 : 4;
  const reteach = {
    lines: [`Tap each ${one} of this ${small} once.`],
    widget: 'shapes2d',
    props: { shape: small, tap: kind },
    input: 'widget',
    goal: { [kind]: smallN },
    hint,
    explain: [`A ${small} has ${smallN} ${word}.`],
  };
  if (level <= 1) {
    return {
      lines: [`Tap each ${one} once.`, kind === 'vertices' ? 'A vertex is a corner.' : 'Count as you tap.'],
      widget: 'shapes2d',
      props: { shape, rotate, tap: kind },
      input: 'widget',
      goal: { [kind]: n },
      hint,
      explain,
    };
  }
  return {
    lines: level === 2 ? [`How many ${word} does this shape have?`, ...(kind === 'vertices' ? ['A vertex is a corner.'] : [])] : [`How many ${word}?`, `Count each ${one} once.`],
    widget: 'shapes2d',
    props: level === 2 ? { shape, rotate, tap: kind, interactive: true } : { shape, rotate, readonly: true },
    input: 'numpad',
    answer: n,
    hint,
    hintProps: { tap: kind, interactive: true, readonly: false },
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
    const explain = sym ? ['Fold it down the middle.', 'The two halves match, so yes.'] : ['Fold it down the middle.', 'The halves do not match, so no.'];
    const hint = ['Imagine folding it down the middle.', 'Would the halves sit on top of each other?'];
    const reteachShape = sym ? 'square' : 'parallelogram';
    const reteach = {
      lines: ['Is the dashed line a line of symmetry?', 'Tap Fold to check.'],
      widget: 'shapes2d',
      props: { shape: reteachShape, fold: true, interactive: true },
      input: 'choice', options: YESNO, answer: sym ? 'yes' : 'no',
      hint: ['Tap Fold. Do the halves match?'],
      explain: sym ? ['The halves match.', 'A square has a vertical line of symmetry.'] : ['The halves do not match.', 'So the line is not a line of symmetry.'],
    };
    if (level <= 2) {
      return {
        lines: level === 1 ? ['Is the dashed line a line of symmetry?', 'Tap Fold to check.'] : ['Does it have a vertical line of symmetry?'],
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
      hint, hintProps: { fold: true, interactive: true, readonly: false },
      explain, reteach,
    };
  },
};

// ---------- 3-D shapes ----------
const SOLID_LONG = { cube: 'cube', cuboid: 'cuboid', sphere: 'sphere', cylinder: 'cylinder', cone: 'cone', pyramid: 'square-based pyramid', 'tri-pyramid': 'triangle-based pyramid', prism: 'triangular prism' };
const SOLID_HINT = {
  cube: 'All its faces are squares the same size.',
  cuboid: 'Its faces are rectangles, like a box.',
  sphere: 'It is round all over, like a ball.',
  cylinder: 'It has 2 flat circle faces and a curved face.',
  cone: 'It has 1 flat circle face and a point.',
  pyramid: 'Its triangle faces meet at a point.',
  prism: 'It has the same triangle at each end.',
};
const SOLID_EXPLAIN = {
  cube: ['It is a cube.', '6 square faces, all the same size.'],
  cuboid: ['It is a cuboid.', '6 rectangle faces, like a cereal box.'],
  sphere: ['It is a sphere.', 'Round all over, like a ball.'],
  cylinder: ['It is a cylinder.', '2 flat circles and 1 curved face.'],
  cone: ['It is a cone.', '1 flat circle and a point at the top.'],
  pyramid: ['It is a pyramid.', 'Triangle faces meet at a point.'],
  prism: ['It is a prism.', 'The same triangle shape at both ends.'],
};
const NAMES3 = ['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'pyramid', 'prism'];
const CONFUSE = { cube: 'cuboid', cuboid: 'cube', pyramid: 'prism', prism: 'pyramid', cone: 'cylinder', cylinder: 'cone', sphere: 'cylinder' };

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
      hint: ['Spin it and look at every face.', SOLID_HINT[answer]],
      explain: SOLID_EXPLAIN[answer],
      reteach: {
        lines: ['What is this 3-D shape called?'],
        widget: 'shapes3d',
        props: { shape: answer === 'pyramid' ? 'pyramid' : shape, autoRotate: true, interactive: true },
        input: 'choice',
        options: R.shuffle([answer, CONFUSE[answer]]).map(opt),
        answer,
        hint: [SOLID_HINT[answer]],
        explain: SOLID_EXPLAIN[answer],
      },
    };
  },
};

const FEV_EXPLAIN = {
  'cube.faces': ['A cube has 6 faces.', 'Top, bottom and 4 around the sides.'],
  'cube.edges': ['A cube has 12 edges.', '4 on top, 4 on the bottom, 4 up the sides.'],
  'cube.vertices': ['A cube has 8 vertices.', '4 on top and 4 on the bottom.'],
  'cuboid.faces': ['A cuboid has 6 faces.', 'Top, bottom and 4 around the sides.'],
  'cuboid.edges': ['A cuboid has 12 edges.', '4 on top, 4 on the bottom, 4 up the sides.'],
  'cuboid.vertices': ['A cuboid has 8 vertices.', '4 on top and 4 on the bottom.'],
  'pyramid.faces': ['This pyramid has 5 faces.', '1 square and 4 triangles.'],
  'pyramid.edges': ['This pyramid has 8 edges.', '4 round the base and 4 up to the point.'],
  'pyramid.vertices': ['This pyramid has 5 vertices.', '4 round the base and 1 at the top.'],
  'tri-pyramid.faces': ['This pyramid has 4 faces.', 'They are all triangles.'],
  'tri-pyramid.edges': ['This pyramid has 6 edges.', '3 round the base and 3 up to the top.'],
  'tri-pyramid.vertices': ['This pyramid has 4 vertices.', '3 round the base and 1 at the top.'],
  'prism.faces': ['A triangular prism has 5 faces.', '2 triangles and 3 rectangles.'],
  'prism.edges': ['A triangular prism has 9 edges.', '3 on each triangle and 3 joining them.'],
  'prism.vertices': ['A triangular prism has 6 vertices.', '3 on each triangle end.'],
  'cylinder.faces': ['A cylinder has 3 faces.', '2 flat circles and 1 curved face.'],
  'cylinder.edges': ['A cylinder has 2 edges.', 'A curved edge round the top and the bottom.'],
  'cone.faces': ['A cone has 2 faces.', '1 flat circle and 1 curved face.'],
};
const ONE = { faces: 'face', edges: 'edge', vertices: 'vertex' };

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
    const hint = [`Tap each ${ONE[prop]} once.`, 'Spin it to find the ones at the back.'];
    return {
      lines: [`How many ${prop} does the ${nm} have?`, ...(level <= 1 ? ['Tap each face to count it.'] : [])],
      widget: 'shapes3d',
      props: { shape, tap: level <= 2 ? prop : null, interactive: true },
      input: 'numpad',
      answer: n,
      hint,
      hintProps: { tap: prop },
      explain: FEV_EXPLAIN[`${shape}.${prop}`] || [`It has ${n} ${prop}.`],
      reteach: {
        lines: [`Tap every ${ONE[prop]} of the ${nm}.`, 'Spin it to see the back.'],
        widget: 'shapes3d',
        props: { shape, tap: prop },
        input: 'widget',
        goal: { [prop]: n },
        hint,
        explain: FEV_EXPLAIN[`${shape}.${prop}`] || [`It has ${n} ${prop}.`],
      },
    };
  },
};

// Which 2-D shape is on the yellow face?
const FLAT = ['circle', 'square', 'triangle', 'rectangle'];
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
        hint: ['Look at the flat faces of each shape.', `Which one has ${an(flat)} ${flat}?`],
        explain: [`${cap(an(NAME3D[solid]))} ${NAME3D[solid]} has ${an(flat)} ${flat} face.`],
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
      hint: ['Trace round the yellow face with your finger.', 'Count its sides. Are any curved?'],
      explain: [`The yellow face is ${an(answer)} ${answer}.`, `You can find ${answer}s on ${an(SOLID_LONG[shape])} ${SOLID_LONG[shape]}.`],
      reteach: level <= 1 ? undefined : {
        lines: ['Look at the yellow face.', 'Which 2-D shape is it?'],
        widget: 'shapes3d', props: { shape: rs, highlight: rh, interactive: true },
        input: 'choice', options: [flatOpt('circle'), flatOpt('square')], answer: ra,
        hint: ['Is it round or does it have corners?'],
        explain: ['The top of a cylinder is a circle.'],
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
        hint: [ROLL[solid]],
        explain: [`${cap(obj)} is like ${an(solid)} ${solid}.`, ROLL[solid]],
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
        hint: [ROLL[solid]],
        explain: [`${cap(yes[0])} is like ${an(NAME3D[solid])} ${NAME3D[solid]}.`],
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
      hint: [ROLL[solid], 'Which object is a different shape?'],
      explain: [`${cap(odd[0])} is like ${an(NAME3D[odd[1]])} ${NAME3D[odd[1]]}.`, `The others are all ${solid}s.`],
      reteach: everydayObject.make(1, R),
    };
  },
};

// ---------- sorting shapes by a property ----------
const LETTERS = ['A', 'B', 'C', 'D'];
const RULES = [
  { id: 'four', ask: 'Which shape has 4 sides?', test: s => shapeInfo(s).curved === 0 && shapeInfo(s).sides === 4, yes: ['square', 'rectangle', 'kite', 'trapezium', 'parallelogram', 'rhombus'], no: ['triangle', 'pentagon', 'hexagon', 'circle', 'semicircle'], why: 'It has 4 straight sides.', lvl: 1 },
  { id: 'three', ask: 'Which shape has 3 sides?', test: s => shapeInfo(s).curved === 0 && shapeInfo(s).sides === 3, yes: ['triangle', 'right-triangle', 'long-triangle', 'scalene'], no: ['square', 'pentagon', 'circle', 'rectangle', 'hexagon'], why: 'It has 3 straight sides.', lvl: 1 },
  { id: 'curved', ask: 'Which shape has a curved side?', test: s => shapeInfo(s).curved > 0, yes: ['circle', 'semicircle', 'oval'], no: ['square', 'triangle', 'hexagon', 'rectangle', 'pentagon'], why: 'It has a curved side.', lvl: 1 },
  { id: 'morethan4', ask: 'Which shape has more than 4 vertices?', test: s => shapeInfo(s).vertices > 4, yes: ['pentagon', 'hexagon', 'octagon', 'irregular-pentagon', 'l-hexagon'], no: ['square', 'triangle', 'kite', 'rectangle', 'right-triangle'], why: 'It has more than 4 vertices.', lvl: 3 },
  { id: 'sym', ask: 'Which shape has a vertical line of symmetry?', test: s => isSymmetric(s, 0), yes: ['heart', 'house', 'kite', 'trapezium', 'arrow', 'pentagon'], no: ['scalene', 'parallelogram', 'irregular-quad', 'right-triangle', 'irregular-pentagon'], why: 'Its two halves match when folded.', lvl: 3 },
  { id: 'novert', ask: 'Which shape has no vertices?', test: s => shapeInfo(s).vertices === 0, yes: ['circle', 'oval'], no: ['semicircle', 'triangle', 'square', 'hexagon', 'heart'], why: 'It has no corners at all.', lvl: 3 },
];
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
    return {
      lines: oddOneOut ? [`3 of these have ${groupWord}.`, 'Which one does not belong?'] : [rule.ask],
      widget: 'shapes2d',
      props: { shapes, readonly: true },
      input: 'choice',
      options: shapes.map(s => ({ value: s.label, label: s.label })),
      answer,
      hint: oddOneOut ? ['Check each shape in turn.', 'Count sides, vertices, or look for curves.'] : ['Look at each shape in turn.', 'Count the sides and vertices.'],
      explain: oddOneOut ? [`Shape ${answer} does not have ${groupWord}.`] : [`Shape ${answer}. ${rule.why}`],
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
function centred(polys, cx = 400, cy = 250, colour = 'green') {
  const xs = polys.flat().map(p => p[0]), ys = polys.flat().map(p => p[1]);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
  return polys.map(poly => ({ poly: poly.map(([x, y]) => [x - mx, y - my]), x: cx, y: cy, colour }));
}
const PAIRS = {
  square: { label: '2 triangles', pieces: [{ shape: 'half-square', x: 380, y: 262 }, { shape: 'half-square', rotate: 180, x: 420, y: 238 }], target: [{ poly: [[-1, -1], [1, -1], [1, 1], [-1, 1]], x: 400, y: 250 }] },
  rectangle: { label: '2 squares', pieces: [{ shape: 'square', x: 322, y: 250 }, { shape: 'square', x: 478, y: 250 }], target: [{ poly: [[-2, -1], [2, -1], [2, 1], [-2, 1]], x: 400, y: 250 }] },
  circle: { label: '2 semicircles', pieces: [{ shape: 'semicircle', x: 400, y: 212 }, { shape: 'semicircle', rotate: 180, x: 400, y: 288 }], target: [{ shape: 'circle', x: 400, y: 250 }] },
  triangle: { label: '2 right-angled triangles', pieces: [{ shape: 'half-square', rotate: 270, x: 324, y: 250 }, { shape: 'half-square', x: 476, y: 250 }], target: [{ poly: [[-2, 1], [2, 1], [0, -1]], x: 400, y: 250 }] },
  hexagon: { label: '2 trapeziums', pieces: [{ poly: [[-1, 0], [1, 0], [0.5, -H3], [-0.5, -H3]], x: 400, y: 243 }, { poly: [[-1, 0], [1, 0], [0.5, H3], [-0.5, H3]], x: 400, y: 257 }], target: [{ shape: 'hexagon', x: 400, y: 250 }] },
};
const PIECE_LABEL = { square: '2 triangles', rectangle: '2 squares', circle: '2 semicircles', hexagon: '2 trapeziums' };
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
        hint: ['Imagine sliding them until they touch.', 'What is the outline of the new shape?'],
        explain: [`${cap(pr.label)} make ${an(whole)} ${whole}.`],
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
        hint: ['Imagine cutting the shape into 2 pieces.', 'Which pieces fit with no gaps?'],
        explain: [`${cap(PIECE_LABEL[whole])} fit together to make it.`],
        reteach: composeShapes.make(1, R),
      };
    }
    const name = R.pick(['big triangle', 'hexagon', 'trapezium', 'rhombus', 'square']);
    const polys = TRI_SETS[name];
    const n = polys.length;
    return {
      lines: ['This shape is made of small triangles.', 'How many triangles make it?'],
      widget: 'shapes2d',
      props: { shapes: centred(polys, 400, 250, R.pick(['green', 'yellow', 'blue'])), unit: name === 'square' ? 120 : 140, readonly: true },
      input: 'numpad',
      answer: n,
      hint: ['Count each triangle once.', 'Start at the top and go round.'],
      explain: [`It is made of ${n} triangles.`],
      reteach: {
        lines: ['How many triangles make this shape?'],
        widget: 'shapes2d',
        props: { shapes: centred(TRI_SETS.rhombus, 400, 250, 'green'), unit: 140, readonly: true },
        input: 'numpad', answer: 2,
        hint: ['Count each triangle once.'],
        explain: ['It is made of 2 triangles.'],
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
    const lines = arrows ? ['The arrow turns each time.', middleGap ? 'What goes in the gap?' : 'What comes next?'] : [middleGap ? 'What goes in the gap?' : 'What comes next?'];
    const spoken = seq.slice(0, Math.min(3, k + 1)).map(say).join(', ');
    const turnWord = { quarter: 'a quarter turn clockwise', quarterAcw: 'a quarter turn anticlockwise' };
    const rotStep = arrows && k === 4 ? ((unit[1].rotate - unit[0].rotate + 360) % 360 === 90 ? turnWord.quarter : turnWord.quarterAcw) : null;
    return {
      lines,
      widget: 'pattern',
      props: { items, gap, readonly: true },
      input: 'choice',
      options: opts.map(pItemOpt),
      answer: patternKey(answerItem),
      hint: arrows ? ['Watch how the arrow turns each time.', 'Is it clockwise or anticlockwise?'] : ['Say the pattern out loud.', `${cap(spoken)}...`],
      hintProps: { unit: k },
      explain: [rotStep ? `Each arrow is ${rotStep}.` : `The pattern repeats every ${k}.`, `So it is the ${say(answerItem)}.`],
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
    return {
      lines,
      widget: 'rover',
      props: { cols: 3, rows: 3, start: { x: 1, y: 1, dir: from }, trail: false, readonly: true },
      input: 'choice',
      options: dirOpts(R, to, from, level >= 3),
      answer: to,
      hint: ['Clockwise is the way clock hands go.', 'Try it with the turn buttons.'],
      hintProps: { controls: ['left', 'right'], showTurnArc: true, interactive: true, readonly: false },
      explain: [`It started facing ${DIR_WORD[from]}.`, `After ${phrase.replace(', then ', ' and ')}, it faces ${DIR_WORD[to]}.`],
      reteach: level > 1 ? {
        lines: ['It makes a quarter turn clockwise.', 'Which way does it face now?'],
        widget: 'rover',
        props: { cols: 3, rows: 3, start: { x: 1, y: 1, dir: 'N' }, trail: false, readonly: true },
        input: 'choice', options: dirOpts(R, 'E', 'N', false), answer: 'E',
        hint: ['Clockwise is the way clock hands go.'],
        hintProps: { controls: ['right'], showTurnArc: true, interactive: true, readonly: false },
        explain: ['From up, a quarter turn clockwise faces right.'],
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
        hint: level <= 1 ? ['Press Forward until you reach the flag.'] : level === 2 ? ['Turn to face the flag first.', 'Then drive forward.'] : ['Plan one step at a time.', 'Undo fixes the last card.'],
        explain: describeRoute(route),
        reteach: level > 1 ? {
          lines: ['Drive the rover to the flag.'],
          widget: 'rover',
          props: { cols, rows, start: { x: 1, y: 4, dir: 'N' }, target: { x: 1, y: 1 }, controls: ['forward', 'back'] },
          input: 'widget', goal: { atTarget: true },
          hint: ['Press Forward until you reach the flag.'],
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
      props: { cols: 3, rows: 3, start: { x: 1, y: 1, dir: start }, controls: ['right'], showTurnArc: true, trail: false, interactive: true },
      input: 'numpad',
      answer: Math.abs(q),
      hint: ['Press the clockwise button and count.', 'Each quarter turn is 1 right angle.'],
      explain: [`${cap(TURN_PHRASE(q).replace(' clockwise', ''))} is ${Math.abs(q)} quarter turns.`, `That is ${Math.abs(q)} right angles.`],
    });
    const shapeItem = shape => ({
      lines: ['How many right angles does this shape have?', 'A right angle is a square corner.'],
      widget: 'shapes2d',
      props: { shape, rotate: R.pick([0, 0, 90, 30]), readonly: true },
      input: 'numpad',
      answer: rightAngleCount(shape),
      hint: ['Look at each corner.', 'Is it a square corner, like a book?'],
      hintProps: { marks: 'right' },
      explain: [`It has ${rightAngleCount(shape)} right ${rightAngleCount(shape) === 1 ? 'angle' : 'angles'}.`, 'Look for the square corners.'],
      reteach: {
        lines: ['Count the little squares in the corners.'],
        widget: 'shapes2d', props: { shape: 'square', marks: 'right', readonly: true },
        input: 'numpad', answer: 4,
        hint: ['Each little square marks a right angle.'],
        explain: ['A square has 4 right angles.'],
      },
    });
    if (level <= 1) return turnItem(R.pick([2, 4, 2]), R.pick(['N', 'E']));
    if (level === 2) return R.chance(0.5) ? turnItem(R.pick([3, 2, 4])) : shapeItem(R.pick(['square', 'rectangle', 'right-triangle', 'half-square']));
    return R.chance(0.3) ? turnItem(R.pick([3, 4])) : shapeItem(R.pick(['house', 'l-hexagon', 'arrow', 'right-triangle', 'triangle', 'pentagon', 'rectangle', 'trapezium']));
  },
};
