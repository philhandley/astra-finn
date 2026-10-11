// shapes3d: a 3-D shape to spin with a finger and tap to count faces, edges or vertices (Three.js 0.170 via the import map).
// Props: shape ('cube' | 'cuboid' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' (square-based) | 'tri-pyramid' | 'prism' (triangular)),
//        tap ('faces' | 'edges' | 'vertices' | null): tapping a face paints it gold; tapping near an edge or vertex lights it.
//            Each counts once only; a gold number shows the order they were tapped.
//        autoRotate (slow spin until touched), colour (name or #hex),
//        highlight ('top' | 'base' | 'side' | 'end' | 'curved'): paint that face gold and turn the shape so it shows,
//        svg (true: draw the simple SVG picture instead of WebGL, for small option tiles), readonly.
// Drag to rotate. Renders only when something changes or while spinning; stops when hidden or destroyed.
// Without WebGL (or before Three.js loads) it shows an SVG drawing of the shape.
// State: { faces, edges, vertices, shape }  (counts tapped so far)
// Debug: dev/harness.html?widget=shapes3d&props={"shape":"cube","tap":"faces"}
import { S, svgRoot, injectCSS, h } from '../core/dom.js';
import { COL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: '3-D shapes',
  playground: { shape: 'cube', tap: 'faces', autoRotate: true },
  state: ['faces', 'edges', 'vertices', 'shape'],
};

export const SHAPES3D = ['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'pyramid', 'tri-pyramid', 'prism'];
export const NAME3D = { cube: 'cube', cuboid: 'cuboid', sphere: 'sphere', cylinder: 'cylinder', cone: 'cone', pyramid: 'pyramid', 'tri-pyramid': 'pyramid', prism: 'prism' };
// How Year 2 counts them (curved surfaces count as faces; a cone has 1 vertex at its point).
export const SOLIDS = {
  cube: { faces: 6, edges: 12, vertices: 8 },
  cuboid: { faces: 6, edges: 12, vertices: 8 },
  pyramid: { faces: 5, edges: 8, vertices: 5 },
  'tri-pyramid': { faces: 4, edges: 6, vertices: 4 },
  prism: { faces: 5, edges: 9, vertices: 6 },
  cylinder: { faces: 3, edges: 2, vertices: 0 },
  cone: { faces: 2, edges: 1, vertices: 1 },
  sphere: { faces: 1, edges: 0, vertices: 0 },
};
// The flat 2-D shapes found on each solid's faces.
export const FACE_SHAPES = {
  cube: ['square'], cuboid: ['rectangle'], pyramid: ['square', 'triangle'], 'tri-pyramid': ['triangle'],
  prism: ['triangle', 'rectangle'], cylinder: ['circle'], cone: ['circle'], sphere: [],
};

const DEFAULT_COL = '#6f8dff';
const NAMED = { gold: '#f2b544', cyan: '#5fd4ff', pink: '#ff8fb1', green: '#6fe3a5', purple: '#b48cff', orange: '#ff9a52', red: '#ff6b57', blue: '#4f9dff', white: '#f3efe6', grey: '#9aa3b2' };
const colourOf = c => NAMED[c] || (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : DEFAULT_COL);

// ---------- small vector and quaternion helpers ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const avg = pts => mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length);
const qAxis = (ax, a) => { const s = Math.sin(a / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)]; };
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qNorm = q => { const l = Math.hypot(...q) || 1; return q.map(v => v / l); };
const qConj = q => [-q[0], -q[1], -q[2], q[3]];
function qRot(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}
function qFromTo(a, b) {
  const d = dot(a, b);
  if (d < -0.9999) return qAxis(Math.abs(a[0]) < 0.9 ? norm(cross(a, [1, 0, 0])) : norm(cross(a, [0, 1, 0])), Math.PI);
  const c = cross(a, b);
  return qNorm([c[0], c[1], c[2], 1 + d]);
}

// ---------- shape models ----------
function newell(pts) {
  let n = [0, 0, 0];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
  });
  return norm(n);
}

function polyModel(V, F, tags) {
  const C = avg(V);
  const pos = [], nor = [], triFace = [];
  const faces = F.map((idx0, fi) => {
    let idx = idx0.slice();
    let n = newell(idx.map(i => V[i]));
    const centre = avg(idx.map(i => V[i]));
    if (dot(n, sub(centre, C)) < 0) { idx.reverse(); n = mul(n, -1); }
    for (let k = 1; k < idx.length - 1; k++) {
      for (const i of [idx[0], idx[k], idx[k + 1]]) { pos.push(...V[i]); nor.push(...n); }
      triFace.push(fi);
    }
    return { tag: tags[fi], normal: n, centre, poly: idx.map(i => V[i]), idx };
  });
  const emap = new Map();
  faces.forEach((f, fi) => f.idx.forEach((a, k) => {
    const b = f.idx[(k + 1) % f.idx.length];
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!emap.has(key)) emap.set(key, { pts: [V[a], V[b]], faces: [] });
    emap.get(key).faces.push(fi);
  }));
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), triFace, faces, edges: [...emap.values()], verts: V };
}

function box(a, b, c) {
  const V = [];
  for (let i = 0; i < 8; i++) V.push([i & 1 ? a : -a, i & 2 ? b : -b, i & 4 ? c : -c]);
  return polyModel(V, [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]], ['end', 'end', 'base', 'top', 'side', 'side']);
}

function ring(r, y, n) { return Array.from({ length: n + 1 }, (_, k) => { const t = (k / n) * Math.PI * 2; return [r * Math.cos(t), y, r * Math.sin(t)]; }); }

function cylinderModel() {
  const r = 0.72, hh = 0.82, N = 40;
  const T = ring(r, hh, N), B = ring(r, -hh, N);
  const pos = [], nor = [], triFace = [];
  const tri = (a, b, c, na, nb, nc, f) => { pos.push(...a, ...b, ...c); nor.push(...na, ...nb, ...nc); triFace.push(f); };
  const up = [0, 1, 0], down = [0, -1, 0];
  for (let k = 0; k < N; k++) {
    tri([0, hh, 0], T[k + 1], T[k], up, up, up, 0);
    tri([0, -hh, 0], B[k], B[k + 1], down, down, down, 1);
    const n0 = norm([T[k][0], 0, T[k][2]]), n1 = norm([T[k + 1][0], 0, T[k + 1][2]]);
    tri(B[k], T[k], T[k + 1], n0, n0, n1, 2);
    tri(B[k], T[k + 1], B[k + 1], n0, n1, n1, 2);
  }
  return {
    pos: new Float32Array(pos), nor: new Float32Array(nor), triFace,
    faces: [{ tag: 'top', normal: up, centre: [0, hh, 0] }, { tag: 'base', normal: down, centre: [0, -hh, 0] }, { tag: 'curved', normal: [0, 0, 1], centre: [0, 0, r], curved: true }],
    edges: [{ pts: T, faces: [0, 2], centre: [0, hh, 0], closed: true }, { pts: B, faces: [1, 2], centre: [0, -hh, 0], closed: true }],
    verts: [],
  };
}

function coneModel() {
  const r = 0.85, y0 = -0.65, apex = [0, 0.95, 0], H = apex[1] - y0, N = 40;
  const B = ring(r, y0, N);
  const pos = [], nor = [], triFace = [];
  const tri = (a, b, c, na, nb, nc, f) => { pos.push(...a, ...b, ...c); nor.push(...na, ...nb, ...nc); triFace.push(f); };
  const down = [0, -1, 0];
  const sn = t => norm([H * Math.cos(t), r, H * Math.sin(t)]);
  for (let k = 0; k < N; k++) {
    const t0 = (k / N) * Math.PI * 2, t1 = ((k + 1) / N) * Math.PI * 2;
    tri([0, y0, 0], B[k], B[k + 1], down, down, down, 0);
    tri(B[k], apex, B[k + 1], sn(t0), sn((t0 + t1) / 2), sn(t1), 1);
  }
  return {
    pos: new Float32Array(pos), nor: new Float32Array(nor), triFace,
    faces: [{ tag: 'base', normal: down, centre: [0, y0, 0] }, { tag: 'curved', normal: norm([0, r, H]), centre: [0, 0.15, r * 0.5], curved: true }],
    edges: [{ pts: B, faces: [0, 1], centre: [0, y0, 0], closed: true }],
    verts: [apex],
  };
}

function sphereModel() {
  const r = 0.95, LAT = 18, LON = 36;
  const P = (i, j) => { const ph = (i / LAT) * Math.PI, th = (j / LON) * Math.PI * 2; return [r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)]; };
  const pos = [], nor = [], triFace = [];
  const tri = (a, b, c) => { pos.push(...a, ...b, ...c); nor.push(...norm(a), ...norm(b), ...norm(c)); triFace.push(0); };
  for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) {
    if (i > 0) tri(P(i, j), P(i, j + 1), P(i + 1, j + 1));
    if (i < LAT - 1) tri(P(i, j), P(i + 1, j + 1), P(i + 1, j));
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), triFace, faces: [{ tag: 'curved', normal: [0, 0, 1], centre: [0, 0, r], curved: true }], edges: [], verts: [] };
}

const MODELS = {};
function model(name) {
  if (MODELS[name]) return MODELS[name];
  let m;
  switch (name) {
    case 'cuboid': m = box(1.0, 0.55, 0.4); break;
    case 'pyramid': m = polyModel([[-0.85, -0.6, -0.85], [0.85, -0.6, -0.85], [0.85, -0.6, 0.85], [-0.85, -0.6, 0.85], [0, 0.85, 0]],
      [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]], ['base', 'side', 'side', 'side', 'side']); break;
    case 'tri-pyramid': {
      const b = [35, 155, 275].map(d => { const t = (d * Math.PI) / 180; return [Math.sin(t), -0.55, Math.cos(t)]; });
      m = polyModel([...b, [0, 0.95, 0]], [[0, 1, 2], [0, 1, 3], [1, 2, 3], [2, 0, 3]], ['base', 'side', 'side', 'side']); break;
    }
    case 'prism': {
      const X = 1.05, A = [-0.6, -0.75], Bp = [-0.6, 0.75], Cp = [0.7, 0];
      const V = [[-X, A[0], A[1]], [-X, Bp[0], Bp[1]], [-X, Cp[0], Cp[1]], [X, A[0], A[1]], [X, Bp[0], Bp[1]], [X, Cp[0], Cp[1]]];
      m = polyModel(V, [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]], ['end', 'end', 'base', 'side', 'side']); break;
    }
    case 'cylinder': m = cylinderModel(); break;
    case 'cone': m = coneModel(); break;
    case 'sphere': m = sphereModel(); break;
    default: m = box(0.8, 0.8, 0.8);
  }
  MODELS[name] = m;
  return m;
}
const validShape = s => (SHAPES3D.includes(s) ? s : 'cube');

// Three.js is loaded lazily so the widget can show its SVG picture straight away and still work if the CDN is unreachable.
let threeP = null;
const loadThree = () => (threeP = threeP || import('three'));

const VIEW = [0.28, 0.42, 0.86];
const edgePt = e => (e.closed ? e.pts[Math.floor(e.pts.length * 0.25)] : mul(add(e.pts[0], e.pts[1]), 0.5));
function initialQ(m, highlight) {
  let q = qMul(qAxis([1, 0, 0], 0.42), qAxis([0, 1, 0], -0.62));
  const f = highlight ? m.faces.find(x => x.tag === highlight) : null;
  if (f) {
    // Turn most of the way towards the viewer, so the face shows but the shape still looks solid.
    const t = qFromTo(qRot(q, f.normal), norm(VIEW));
    const ang = 2 * Math.acos(Math.min(1, Math.max(-1, t[3])));
    const sn = Math.sin(ang / 2);
    if (sn > 1e-6) q = qNorm(qMul(qAxis([t[0] / sn, t[1] / sn, t[2] / sn], ang * 0.72), q));
  }
  return q;
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-shapes3d', `
    .w-shapes3d { position: absolute; inset: 0; overflow: hidden; touch-action: none; user-select: none; }
    .w-shapes3d canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
    .w-shapes3d.ro canvas, .w-shapes3d.ro svg { cursor: default; }
    .w-shapes3d svg { position: absolute; inset: 0; }
    .w-shapes3d .b3 { position: absolute; inset: 0; pointer-events: none; }
    .w-shapes3d .b3 div { position: absolute; left: 0; top: 0; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%;
      background: ${COL.tens}; color: #1a1205; font: 700 24px/40px ${FONT.display}; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,.5); transition: opacity .15s; }
  `);
  let p = { ...props };
  let alive = true;
  let name = validShape(p.shape);
  let m = model(name);
  let q = initialQ(m, p.highlight);
  let litF = [], litE = [], litV = [];
  let anchors = []; // { kind, i, pt } in tap order (model coordinates)
  let touched = false;
  let raf = 0;
  const timers = [];
  const wrap = h('<div class="w-shapes3d"></div>');
  el.appendChild(wrap);
  const svg = svgRoot(800, 500);
  wrap.appendChild(svg);
  const badges = h('<div class="b3"></div>');
  wrap.appendChild(badges);
  let G = null; // the Three.js bits once loaded

  // readonly: false arriving through update() (a hint) switches interaction on even if mounted readonly.
  const ro = () => (p.readonly === false ? false : !!(p.readonly || ctx.readonly));
  const tapMode = () => (['faces', 'edges', 'vertices'].includes(p.tap) ? p.tap : null);
  const hlFace = () => (p.highlight ? m.faces.findIndex(f => f.tag === p.highlight) : -1);
  const spinOn = () => !!p.autoRotate && !touched && !document.hidden && alive;
  wrap.classList.toggle('ro', ro());

  // ---------- SVG picture (fallback and first paint) ----------
  function drawSVG() {
    svg.replaceChildren();
    const k = 150, cx = 400, cy = 250;
    const P = v => { const r = qRot(q, v); return [cx + r[0] * k, cy - r[1] * k, r[2]]; };
    const L = norm([-0.45, 0.7, 0.55]);
    const base = colourOf(p.colour);
    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const shade = (hex, n) => { const s = 0.38 + 0.62 * Math.max(0, dot(n, L)); return `rgb(${rgb(hex).map(c => Math.round(c * s)).join(',')})`; };
    const hl = hlFace();
    const fcol = fi => (litF.includes(fi) || fi === hl ? COL.tens : base);
    const items = [];
    m.faces.forEach((f, fi) => {
      if (!f.poly) return;
      const n = qRot(q, f.normal);
      if (n[2] <= 0.0001) return;
      const pts = f.poly.map(P);
      items.push({ z: pts.reduce((s, a) => s + a[2], 0) / pts.length, d: 'M' + pts.map(a => `${a[0].toFixed(1)} ${a[1].toFixed(1)}`).join('L') + 'Z', fill: shade(fcol(fi), n) });
    });
    const tris = m.triFace.length;
    for (let t = 0; t < tris; t++) {
      const fi = m.triFace[t];
      if (m.faces[fi].poly) continue;
      const vs = [0, 1, 2].map(j => [m.pos[t * 9 + j * 3], m.pos[t * 9 + j * 3 + 1], m.pos[t * 9 + j * 3 + 2]]);
      const ns = [0, 1, 2].map(j => [m.nor[t * 9 + j * 3], m.nor[t * 9 + j * 3 + 1], m.nor[t * 9 + j * 3 + 2]]);
      const n = qRot(q, norm(avg(ns)));
      const gn = qRot(q, norm(cross(sub(vs[1], vs[0]), sub(vs[2], vs[0]))));
      if (gn[2] <= 0.0001) continue;
      const pts = vs.map(P);
      const c = shade(fcol(fi), n);
      items.push({ z: (pts[0][2] + pts[1][2] + pts[2][2]) / 3, d: `M${pts.map(a => `${a[0].toFixed(1)} ${a[1].toFixed(1)}`).join('L')}Z`, fill: c, stroke: c });
    }
    items.sort((a, b) => a.z - b.z);
    for (const it of items) svg.appendChild(S('path', { d: it.d, fill: it.fill, stroke: it.stroke || 'none', 'stroke-width': it.stroke ? 1 : 0, 'stroke-linejoin': 'round' }));
    const front = fi => { const f = m.faces[fi]; return !f.curved && qRot(q, f.normal)[2] > 0.0001; };
    m.edges.forEach((e, i) => {
      const lit = litE.includes(i);
      const attrs = { fill: 'none', stroke: lit ? COL.tens : '#e9edf6', 'stroke-width': lit ? 9 : 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      if (!e.closed) {
        if (!e.faces.some(front)) return;
        const [a, b] = e.pts.map(P);
        svg.appendChild(S('path', { d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`, ...attrs }));
      } else {
        const capFront = front(e.faces[0]);
        let d = '', pen = false;
        for (let s = 0; s < e.pts.length - 1; s++) {
          const mid = mul(add(e.pts[s], e.pts[s + 1]), 0.5);
          const vis = capFront || qRot(q, sub(mid, e.centre))[2] > 0;
          const a = P(e.pts[s]), b = P(e.pts[s + 1]);
          if (vis) { d += `${pen ? '' : `M${a[0].toFixed(1)} ${a[1].toFixed(1)}`}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`; pen = true; } else pen = false;
        }
        if (d) svg.appendChild(S('path', { d, ...attrs }));
      }
    });
  }

  // ---------- Three.js ----------
  async function initThree() {
    if (p.svg) return;
    let T;
    try { T = await loadThree(); } catch (e) { return; }
    if (!alive || p.svg || G) return;
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { return; }
    if (!alive) { renderer.dispose(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(32, 1.6, 0.1, 50);
    camera.position.set(0, 0, 5.2);
    scene.add(new T.AmbientLight(0xffffff, 0.75));
    const d1 = new T.DirectionalLight(0xffffff, 2.5); d1.position.set(-2, 3.5, 2.5); scene.add(d1);
    const d2 = new T.DirectionalLight(0x9fb0ff, 0.55); d2.position.set(3, -1, 2); scene.add(d2);
    const group = new T.Group(); scene.add(group);
    const decor = new T.Group(); group.add(decor);
    const mat = new T.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const inkMat = new T.MeshBasicMaterial({ color: 0xe9edf6 });
    const goldMat = new T.MeshBasicMaterial({ color: new T.Color(COL.tens) });
    G = { T, renderer, scene, camera, group, decor, mat, inkMat, goldMat, mesh: null, ray: new T.Raycaster(), w: 0, h: 0 };
    const cv = renderer.domElement;
    wrap.insertBefore(cv, badges);
    svg.style.display = 'none';
    bindPointers(cv);
    buildMesh();
    buildDecor();
    resize();
    G.ro = new ResizeObserver(() => { resize(); renderNow(); });
    G.ro.observe(wrap);
    renderNow();
    loop();
  }

  function disposeObj(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); }); }

  function buildMesh() {
    if (!G) return;
    const { T } = G;
    if (G.mesh) { G.group.remove(G.mesh); G.mesh.geometry.dispose(); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(m.pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(m.nor, 3));
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(m.pos.length), 3));
    G.mesh = new T.Mesh(g, G.mat);
    G.group.add(G.mesh);
    paintFaces();
  }

  function paintFaces() {
    if (!G || !G.mesh) return;
    const { T } = G;
    const base = new T.Color(colourOf(p.colour)), gold = new T.Color(COL.tens);
    const hl = hlFace();
    const attr = G.mesh.geometry.getAttribute('color');
    const a = attr.array;
    m.triFace.forEach((fi, t) => {
      const c = litF.includes(fi) || fi === hl ? gold : base;
      for (let j = 0; j < 3; j++) { a[t * 9 + j * 3] = c.r; a[t * 9 + j * 3 + 1] = c.g; a[t * 9 + j * 3 + 2] = c.b; }
    });
    attr.needsUpdate = true;
  }

  function buildDecor() {
    if (!G) return;
    const { T, decor } = G;
    disposeObj(decor);
    decor.clear();
    const up = new T.Vector3(0, 1, 0);
    m.edges.forEach((e, i) => {
      const lit = litE.includes(i);
      const r = lit ? 0.05 : 0.022;
      let mesh;
      if (!e.closed) {
        const a = new T.Vector3(...e.pts[0]), b = new T.Vector3(...e.pts[1]);
        const dir = b.clone().sub(a);
        mesh = new T.Mesh(new T.CylinderGeometry(r, r, dir.length(), 8, 1, true), lit ? G.goldMat : G.inkMat);
        mesh.position.copy(a.clone().add(b).multiplyScalar(0.5));
        mesh.quaternion.setFromUnitVectors(up, dir.normalize());
      } else {
        const curve = new T.CatmullRomCurve3(e.pts.slice(0, -1).map(v => new T.Vector3(...v)), true);
        mesh = new T.Mesh(new T.TubeGeometry(curve, 72, r, 6, true), lit ? G.goldMat : G.inkMat);
      }
      decor.add(mesh);
    });
    if (tapMode() === 'vertices') {
      m.verts.forEach((v, i) => {
        const lit = litV.includes(i);
        const s = new T.Mesh(new T.SphereGeometry(lit ? 0.12 : 0.08, 14, 10), lit ? G.goldMat : G.inkMat);
        s.position.set(...v);
        decor.add(s);
      });
    }
  }

  function resize() {
    if (!G) return;
    const w = wrap.clientWidth, hgt = wrap.clientHeight;
    if (w < 2 || hgt < 2) return;
    G.w = w; G.h = hgt;
    G.renderer.setSize(w, hgt, false);
    const aspect = w / hgt;
    G.camera.aspect = aspect;
    G.camera.position.z = 5.2 * Math.max(1, 1.25 / aspect);
    G.camera.updateProjectionMatrix();
  }

  function toScreen(v) {
    const r = qRot(q, v);
    if (G) {
      const pv = new G.T.Vector3(...r).project(G.camera);
      return [((pv.x + 1) / 2) * G.w, ((1 - pv.y) / 2) * G.h];
    }
    const rect = svg.getBoundingClientRect();
    const s = Math.min(rect.width / 800, rect.height / 500);
    return [rect.width / 2 + r[0] * 150 * s, rect.height / 2 - r[1] * 150 * s];
  }

  function visible(v) {
    if (!G || !G.mesh) return true;
    const { T } = G;
    const world = new T.Vector3(...qRot(q, v));
    const cam = G.camera.position.clone();
    const dir = world.clone().sub(cam);
    const dist = dir.length();
    G.ray.set(cam, dir.normalize());
    const hit = G.ray.intersectObject(G.mesh, false)[0];
    return !hit || hit.distance > dist - 0.06;
  }

  function updateBadges() {
    const n = anchors.length;
    while (badges.children.length < n) badges.appendChild(document.createElement('div'));
    while (badges.children.length > n) badges.lastChild.remove();
    anchors.forEach((a, k) => {
      const d = badges.children[k];
      const [x, y] = toScreen(a.pt);
      d.textContent = String(a.n);
      d.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      d.style.opacity = visible(a.pt) ? '1' : '0.28';
    });
  }

  function renderNow() {
    if (!alive) return;
    if (G) {
      G.group.quaternion.set(q[0], q[1], q[2], q[3]);
      G.renderer.render(G.scene, G.camera);
    } else drawSVG();
    updateBadges();
  }

  function frame() {
    raf = 0;
    if (!spinOn()) return;
    q = qNorm(qMul(q, qAxis([0, 1, 0], 0.009)));
    renderNow();
    raf = requestAnimationFrame(frame);
  }
  function loop() { if (!raf && spinOn()) raf = requestAnimationFrame(frame); }
  const onVis = () => { if (!document.hidden) { renderNow(); loop(); } };
  document.addEventListener('visibilitychange', onVis);

  // ---------- pointer: drag to rotate, tap to count ----------
  let ptr = null, sx = 0, sy = 0, lx = 0, ly = 0, moved = false;
  const listeners = [];
  function bindPointers(target) {
    const on = (t, f) => { target.addEventListener(t, f); listeners.push([target, t, f]); };
    on('pointerdown', e => {
      if (ro() || ptr !== null || e.button > 0) return;
      ptr = e.pointerId; sx = lx = e.clientX; sy = ly = e.clientY; moved = false;
      touched = true;
      try { target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    on('pointermove', e => {
      if (e.pointerId !== ptr) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) moved = true;
      if (moved) {
        q = qNorm(qMul(qAxis([0, 1, 0], dx * 0.012), q));
        q = qNorm(qMul(qAxis([1, 0, 0], dy * 0.012), q));
        renderNow();
      }
    });
    const end = e => {
      if (e.pointerId !== ptr) return;
      ptr = null;
      try { target.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (!moved && e.type === 'pointerup') tapAt(e.clientX, e.clientY);
    };
    on('pointerup', end);
    on('pointercancel', end);
  }
  bindPointers(svg);

  function light(kind, i, pt) {
    const arr = kind === 'faces' ? litF : kind === 'edges' ? litE : litV;
    if (arr.includes(i)) { sfx('tick'); return false; }
    arr.push(i);
    anchors.push({ kind, i, pt, n: arr.length });
    sfx('pop');
    if (kind === 'faces') paintFaces(); else buildDecor();
    renderNow();
    ctx.onChange && ctx.onChange(api.getState());
    return true;
  }

  function tapAt(clientX, clientY) {
    const mode = tapMode();
    if (!mode || !G || ro()) return;
    const rect = G.renderer.domElement.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    if (mode === 'faces') {
      G.group.quaternion.set(q[0], q[1], q[2], q[3]);
      G.group.updateMatrixWorld(true);
      G.ray.setFromCamera(new G.T.Vector2((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1), G.camera);
      const hit = G.ray.intersectObject(G.mesh, false)[0];
      if (!hit) return;
      const fi = m.triFace[hit.faceIndex];
      const local = qRot(qConj(q), [hit.point.x, hit.point.y, hit.point.z]);
      light('faces', fi, add(local, mul(m.faces[fi].curved ? norm(local) : m.faces[fi].normal, 0.02)));
      return;
    }
    G.group.updateMatrixWorld(true);
    const cands = [];
    if (mode === 'edges') {
      m.edges.forEach((e, i) => {
        const sp = e.pts.map(toScreen);
        let best = { d: Infinity, pt: null };
        for (let s = 0; s < sp.length - 1; s++) {
          const a = sp[s], b = sp[s + 1];
          const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
          let t = L ? ((x - a[0]) * dx + (y - a[1]) * dy) / L : 0;
          t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
          if (d < best.d) best = { d, pt: add(e.pts[s], mul(sub(e.pts[s + 1], e.pts[s]), t)) };
        }
        if (best.d < 34) cands.push({ i, ...best });
      });
    } else {
      m.verts.forEach((v, i) => {
        const [vx, vy] = toScreen(v);
        const d = Math.hypot(x - vx, y - vy);
        if (d < 42) cands.push({ i, d, pt: v });
      });
    }
    cands.sort((a, b) => a.d - b.d);
    const pick = cands.find(c => visible(c.pt));
    if (pick) light(mode, pick.i, pick.pt);
  }

  // ---------- api ----------
  function rebuild(resetView) {
    name = validShape(p.shape);
    m = model(name);
    litF = []; litE = []; litV = []; anchors = [];
    if (resetView) q = initialQ(m, p.highlight);
    buildMesh();
    buildDecor();
  }

  const api = {
    getState() { return { faces: litF.length, edges: litE.length, vertices: litV.length, shape: name }; },
    update(np = {}) {
      const before = { ...p };
      p = { ...p, ...np };
      timers.splice(0).forEach(t => clearTimeout(t));
      wrap.classList.toggle('ro', ro());
      const shapeCh = validShape(p.shape) !== name;
      const tapCh = (before.tap || null) !== (p.tap || null);
      const hlCh = (before.highlight || null) !== (p.highlight || null);
      if (shapeCh || tapCh) rebuild(shapeCh || hlCh);
      else if (hlCh) q = initialQ(m, p.highlight);
      if ('autoRotate' in np) touched = false;
      paintFaces();
      buildDecor();
      if (np.svg === false && !G) initThree();
      renderNow();
      loop();
    },
    showAnswer() {
      const mode = tapMode();
      if (!mode) return;
      const list = mode === 'faces' ? m.faces.map((f, i) => ({ i, pt: f.centre })) : mode === 'edges' ? m.edges.map((e, i) => ({ i, pt: edgePt(e) })) : m.verts.map((v, i) => ({ i, pt: v }));
      const arr = mode === 'faces' ? litF : mode === 'edges' ? litE : litV;
      let delay = 0;
      list.forEach(({ i, pt }) => {
        if (arr.includes(i)) return;
        timers.push(setTimeout(() => {
          if (!alive || arr.includes(i)) return;
          arr.push(i); anchors.push({ kind: mode, i, pt, n: arr.length });
          if (mode === 'faces') paintFaces(); else buildDecor();
          sfx('pop'); renderNow();
        }, (delay += 320)));
      });
    },
    // For tests: client coordinates of face centres, edge midpoints or vertices, and whether each can be seen.
    debugPoints(kind) {
      if (!G) return [];
      const rect = G.renderer.domElement.getBoundingClientRect();
      const pts = kind === 'faces' ? m.faces.map(f => f.centre) : kind === 'edges' ? m.edges.map(edgePt) : m.verts;
      return pts.map((pt, i) => { const [x, y] = toScreen(pt); return { i, x: rect.left + x, y: rect.top + y, visible: visible(pt) }; });
    },
    ready() { return !!G; },
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      timers.splice(0).forEach(t => clearTimeout(t));
      document.removeEventListener('visibilitychange', onVis);
      listeners.splice(0).forEach(([t, ty, f]) => t.removeEventListener(ty, f));
      if (G) {
        try {
          G.ro && G.ro.disconnect();
          disposeObj(G.scene);
          G.mat.dispose(); G.inkMat.dispose(); G.goldMat.dispose();
          G.renderer.dispose();
          G.renderer.forceContextLoss();
        } catch (e) { /* ignore */ }
        G = null;
      }
      el.replaceChildren();
    },
  };

  drawSVG();
  initThree();
  return api;
}
