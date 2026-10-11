// groups: division by sharing (deal into landing pads) or by grouping (snap items into rings). Also equal groups for ×.
// Props: total (0-50), mode ('share' | 'group'), bowls (share mode: 1-10 pads), groupSize (group mode: 1-10),
//        icon (art name or 'dot'), filled (share mode: counts already in each pad), made (group mode: groups already made),
//        interactive (default true), readonly.
// Share: tap the pile or "Deal one each" to deal round-robin. Done when nothing is left, or when fewer are left than pads.
// Group: tap "Make a group" or tap an item to pull it and its neighbours into a ring. Done when fewer than a group are left.
// State (keys always present): { bowls, groups, left, done, groupSize }
//   share: bowls = counts per pad, groups = number of pads, groupSize = the smallest pad count (what each gets so far)
//   group: bowls = sizes of the groups made, groups = groups made, groupSize = the group size
// Debug: dev/harness.html?widget=groups&props={"total":12,"mode":"share","bowls":3}
//        dev/harness.html?widget=groups&props={"total":14,"mode":"group","groupSize":4,"icon":"crystal"}
import { S, svgRoot, onTap, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { artInner } from '../core/art.js';
import { COL, PAL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Share and group',
  playground: { total: 12, mode: 'share', bowls: 3, icon: 'dot', interactive: true },
  state: ['bowls', 'groups', 'left', 'done', 'groupSize'],
};

const VW = 800, VH = 470;
const R0 = 20;            // items are drawn at radius R0 and scaled into place
const DOT = COL.a, DOT_EDGE = COL.aDark;   // red dots, like the Synthesis division "flowers"

const CSS = `
.w-groups { position: absolute; inset: 0; display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; font-family: ${FONT.display}; }
.w-groups .w-groups-svg { flex: 1 1 auto; min-height: 0; position: relative; }
.w-groups .w-groups-svg > svg { position: absolute; inset: 0; }
.w-groups .it { transition: transform .38s cubic-bezier(.3, 1.25, .5, 1), opacity .3s; transform-box: view-box; }
.w-groups.rm .it { transition: none; }
.w-groups .pilehit { cursor: pointer; }
.w-groups.ro .pilehit { cursor: default; }
.w-groups .ring.pop { animation: wgr-pop .3s cubic-bezier(.3, 1.4, .5, 1) both; transform-box: fill-box; transform-origin: center; }
.w-groups.rm .ring.pop { animation: none; }
@keyframes wgr-pop { from { transform: scale(.82); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.w-groups-ctl { flex: none; display: flex; justify-content: center; align-items: center; gap: 16px; padding: 4px 10px 14px; }
.w-groups-ctl button { appearance: none; border: 0; margin: 0; cursor: pointer; font-family: ${FONT.display}; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  transition: transform .08s ease; white-space: nowrap; }
.w-groups-ctl .go { min-height: 62px; padding: 0 30px 0 24px; border-radius: 18px; font-size: 24px; font-weight: 700; background: ${PAL.blue}; color: #fff;
  display: flex; align-items: center; gap: 12px; box-shadow: 0 5px 0 ${PAL.blueDark}; }
.w-groups-ctl .go:active:not([disabled]) { transform: translateY(4px); box-shadow: 0 1px 0 ${PAL.blueDark}; }
.w-groups-ctl .go[disabled] { background: ${COL.surface3}; color: ${COL.ink3}; box-shadow: 0 5px 0 ${COL.line}; cursor: default; }
.w-groups-ctl .go svg { width: 30px; height: 30px; flex: none; }
.w-groups-ctl .rs { width: 62px; height: 62px; border-radius: 18px; background: #fff; color: ${COL.ink}; border: 3px solid ${COL.line};
  box-shadow: 0 5px 0 ${COL.line}; display: grid; place-items: center; padding: 0; }
.w-groups-ctl .rs:active { transform: translateY(4px); box-shadow: 0 1px 0 ${COL.line}; }
.w-groups-ctl .rs svg { width: 30px; height: 30px; }
`;

// Deal: one counter going to each of three plates. Group: a ring round four counters.
const I_DEAL = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="7" r="3.6" fill="currentColor" stroke="none"/><path d="M16 12v6M14 14l-7 6M18 14l7 6"/><circle cx="6" cy="25" r="3.4"/><circle cx="16" cy="25" r="3.4"/><circle cx="26" cy="25" r="3.4"/></svg>';
const I_RING = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="16" cy="16" r="13"/><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/><circle cx="20" cy="12" r="3.4" fill="currentColor" stroke="none"/><circle cx="12" cy="20" r="3.4" fill="currentColor" stroke="none"/><circle cx="20" cy="20" r="3.4" fill="currentColor" stroke="none"/></svg>';
const I_RESET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 3.5v4.6h4.6"/></svg>';

// A tight cluster of n touching items (unit spacing, centred on 0,0), like the Synthesis division "flowers".
// Small numbers use familiar dice-like patterns; bigger ones pack in hex rows. rho = radius of the
// smallest circle round the cluster (dot centres + half a dot).
function cluster(n) {
  n = Math.max(1, n);
  const H = Math.sqrt(3) / 2;
  const fixed = {
    1: [[0, 0]],
    2: [[-0.5, 0], [0.5, 0]],
    3: [[0, -0.58], [-0.5, 0.29], [0.5, 0.29]],
    4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
    5: [[-0.71, -0.71], [0.71, -0.71], [0, 0], [-0.71, 0.71], [0.71, 0.71]],
    6: [[-1, -0.5], [0, -0.5], [1, -0.5], [-1, 0.5], [0, 0.5], [1, 0.5]],
    7: [[-0.5, -H], [0.5, -H], [-1, 0], [0, 0], [1, 0], [-0.5, H], [0.5, H]],
    9: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  };
  let pts = fixed[n];
  if (!pts) {
    const rowsN = Math.max(2, Math.round(Math.sqrt(n * 0.9)));
    const counts = Array(rowsN).fill(Math.floor(n / rowsN));
    // Extra items go to the middle rows first, so the cluster stays round.
    const order = counts.map((_, i) => i).sort((a, b) => Math.abs(a - (rowsN - 1) / 2) - Math.abs(b - (rowsN - 1) / 2));
    for (let k = 0; k < n % rowsN; k++) counts[order[k]]++;
    const same = counts.every(c => c === counts[0]);
    const dy = same ? 1 : H;
    pts = [];
    counts.forEach((c, r) => { for (let k = 0; k < c; k++) pts.push([k - (c - 1) / 2, (r - (rowsN - 1) / 2) * dy]); });
  }
  pts = pts.map(([x, y]) => ({ x, y }));
  const rho = Math.max(...pts.map(q => Math.hypot(q.x, q.y))) + 0.5;
  return { pts, rho };
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-groups', CSS);
  let p = {};
  let total = 0, mode = 'share', nB = 3, gs = 4;
  let where = [];   // share: -1 pile or pad index; group: -1 pile or group index
  let slotIn = [];  // index within its pad/group
  let counts = [];  // share: counts per pad; group: sizes of made groups
  let L = null;
  const unbinds = [];
  let items = [];   // persistent <g> per item
  let iconKey = '';
  const timers = new Set();

  const wrap = document.createElement('div');
  wrap.className = 'w-groups';
  const svgBox = document.createElement('div');
  svgBox.className = 'w-groups-svg';
  const root = svgRoot(VW, VH, '');
  svgBox.appendChild(root);
  const ctl = document.createElement('div');
  ctl.className = 'w-groups-ctl';
  wrap.append(svgBox, ctl);
  el.appendChild(wrap);
  const layBack = S('g'), layItems = S('g'), layFront = S('g');
  const hit = S('rect', { class: 'pilehit', x: 0, y: 0, width: VW, height: 200, fill: 'transparent' });
  root.append(hit, layBack, layItems, layFront);

  const ro = () => !!(p.readonly || ctx.readonly || p.interactive === false);
  const left = () => where.filter(w => w < 0).length;
  const isDone = () => (mode === 'share' ? left() === 0 || (left() < nB && counts.every(c => c === counts[0])) : left() < gs);
  const state = () => {
    if (mode === 'share') return { bowls: counts.slice(), groups: nB, left: left(), done: isDone(), groupSize: counts.length ? Math.min(...counts) : 0 };
    return { bowls: counts.slice(), groups: counts.length, left: left(), done: isDone(), groupSize: gs };
  };
  const changed = () => { ctx.onChange && ctx.onChange(state()); };
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

  // ---------- layout ----------
  // Top: the pile in a soft tray. Below: white landing pads (share) or group rings (group), each a circle
  // that fits the tight cluster of items it will hold.
  function computeLayout() {
    const lay = {};
    const rowsOfPads = mode === 'share' ? (nB <= 5 ? 1 : 2) : 0;
    const G = mode === 'group' ? Math.max(1, Math.floor(total / gs)) : 0;
    const gRows = mode === 'group' ? (G <= 5 ? 1 : G <= 10 ? 2 : 3) : 0;
    const twoRows = rowsOfPads > 1 || gRows > 1;
    // Pile: up to 12 a row, in a tray across the top.
    const cols = total <= 12 ? Math.max(total, 1) : Math.ceil(total / Math.ceil(total / 12));
    const prow = Math.max(1, Math.ceil(total / cols));
    const trayMax = gRows > 2 ? 120 : twoRows ? 150 : 178;
    const psp = Math.min(740 / cols, (trayMax - 24) / prow, 58);
    const pw = cols * psp, ph = prow * psp;
    const px0 = (VW - pw) / 2 + psp / 2, py0 = 12 + 12 + psp / 2;
    lay.pile = i => ({ x: px0 + (i % cols) * psp, y: py0 + Math.floor(i / cols) * psp, r: psp * 0.43 });
    lay.psp = psp;
    const trayW = Math.max(pw + 36, 300);
    lay.pileBox = { x: (VW - trayW) / 2, y: 12, w: trayW, h: ph + 24 };
    lay.pileBottom = lay.pileBox.y + lay.pileBox.h;
    // Lower zone.
    const z0 = lay.pileBottom + 14, z1 = VH - 6;
    const ZH = z1 - z0, ZW = 780;
    if (mode === 'share') {
      const per = nB <= 5 ? nB : Math.ceil(nB / 2), br = Math.ceil(nB / per);
      const lbl = p.counts !== false ? 50 : 0;
      const cw = ZW / per, ch = ZH / br;
      // Dealing stops when fewer than one each are left, so a pad never holds more than total / pads (rounded down).
      const preset = Array.isArray(p.filled) ? p.filled.slice(0, nB).map(c => clamp(Math.round(c) || 0, 0, 50)) : [];
      const maxPer = Math.max(1, Math.floor(total / nB), ...preset);
      const cl = cluster(maxPer);
      let R = Math.min(cw * 0.45, (ch - lbl) / 2 - 3, 150);
      const sp = Math.min(62, (R - 9) / cl.rho);
      R = Math.min(R, cl.rho * sp + 16);
      const blockH = br * (2 * R + lbl) + (br - 1) * 6;
      const top = z0 + Math.max(0, (ZH - blockH) / 2);
      lay.R = R; lay.lbl = lbl;
      lay.pads = [];
      for (let b = 0; b < nB; b++) {
        const row = Math.floor(b / per), inRow = Math.min(per, nB - row * per);
        const cx = VW / 2 + ((b % per) - (inRow - 1) / 2) * cw, cy = top + row * (2 * R + lbl + 6) + R;
        lay.pads.push({ cx, cy, r: R });
      }
      lay.slot = (b, k) => {
        const pd = lay.pads[b];
        const q = cl.pts[k] || cl.pts[cl.pts.length - 1];
        return { x: pd.cx + q.x * sp, y: pd.cy + q.y * sp, r: sp * 0.47 };
      };
    } else {
      const per = G <= 5 ? G : G <= 10 ? Math.ceil(G / 2) : Math.ceil(G / 3), gr = Math.ceil(G / per);
      const cw = ZW / per, ch = ZH / gr;
      const cl = cluster(gs);
      let R = Math.min(cw * 0.46, ch / 2 - 4, 150);
      const sp = Math.min(62, (R - 8) / cl.rho);
      R = Math.min(R, cl.rho * sp + 13);
      const blockH = gr * 2 * R + (gr - 1) * 8;
      const top = z0 + Math.max(0, (ZH - blockH) / 2);
      lay.rings = [];
      for (let g = 0; g < G; g++) {
        const row = Math.floor(g / per), inRow = Math.min(per, G - row * per);
        const cx = VW / 2 + ((g % per) - (inRow - 1) / 2) * cw, cy = top + row * (2 * R + 8) + R;
        lay.rings.push({ cx, cy, r: R });
      }
      lay.slot = (g, k) => {
        const rg = lay.rings[g] || lay.rings[lay.rings.length - 1];
        const q = cl.pts[k] || { x: 0, y: 0 };
        return { x: rg.cx + q.x * sp, y: rg.cy + q.y * sp, r: sp * 0.47 };
      };
    }
    return lay;
  }

  // ---------- drawing ----------
  function itemInner() {
    const icon = p.icon || 'dot';
    const g = S('g');
    if (icon === 'dot') {
      g.appendChild(S('circle', { r: R0, fill: DOT, stroke: DOT_EDGE, 'stroke-width': 3.2 }));
    } else {
      const a = S('g', { transform: `translate(${-R0 * 1.1} ${-R0 * 1.1}) scale(${(R0 * 2.2) / 100})` });
      a.innerHTML = artInner(icon);
      g.appendChild(a);
    }
    return g;
  }

  function buildItems() {
    layItems.replaceChildren();
    items = [];
    for (let i = 0; i < total; i++) {
      const g = S('g', { class: 'it' });
      g.appendChild(itemInner());
      layItems.appendChild(g);
      items.push(g);
    }
    iconKey = `${total}|${p.icon || 'dot'}`;
  }

  function place(i, instant) {
    const g = items[i];
    if (!g) return;
    let q;
    if (where[i] < 0 && isDone() && left() > 0) q = spareSpot(i);
    else if (where[i] < 0) q = L.pile(i);
    else q = L.slot(where[i], slotIn[i]);
    const k = q.r / R0;
    if (instant) g.style.transition = 'none';
    g.style.transform = `translate(${q.x}px, ${q.y}px) scale(${k})`;
    if (instant) { void g.getBoundingClientRect(); g.style.transition = ''; }
    g.classList.toggle('spare', where[i] < 0 && isDone() && left() > 0);
  }

  // Leftovers gather in the tray beside a "left over" label once the sharing or grouping is finished.
  const LEFT_W = 132, LEFT_GAP = 18;
  function spareLayout() {
    const n = where.filter(w => w < 0).length;
    const pb = L.pileBox;
    let r = Math.min(L.psp * 0.43, 26, pb.h / 2 - 8);
    const sp = Math.min(r * 2.3, (pb.w - LEFT_W - LEFT_GAP - 40) / Math.max(n, 1));
    r = Math.min(r, sp * 0.46);
    const itemsW = (n - 1) * sp + 2 * r;
    const x0 = VW / 2 - (LEFT_W + LEFT_GAP + itemsW) / 2;
    return { n, r, sp, x0, y: pb.y + pb.h / 2 };
  }
  function spareSpot(i) {
    const spare = where.map((w, k) => (w < 0 ? k : -1)).filter(k => k >= 0);
    const S0 = spareLayout();
    return { x: S0.x0 + LEFT_W + LEFT_GAP + S0.r + spare.indexOf(i) * S0.sp, y: S0.y, r: S0.r };
  }

  function drawBack(popGroup = -1) {
    layBack.replaceChildren();
    layFront.replaceChildren();
    // Pile tray.
    const pb = L.pileBox;
    layBack.appendChild(S('rect', { x: pb.x, y: pb.y, width: pb.w, height: pb.h, rx: 24, fill: COL.surface2 }));
    hit.setAttribute('height', L.pileBottom + 10);
    const pad = (cx, cy, r, cls = '') => {
      const g = S('g', { class: `ring ${cls}` });
      g.appendChild(S('circle', { cx, cy: cy + 5, r, fill: COL.line }));
      g.appendChild(S('circle', { cx, cy, r, fill: COL.surface, stroke: COL.ink, 'stroke-width': 4 }));
      return g;
    };
    if (mode === 'share') {
      L.pads.forEach((pd, b) => {
        layBack.appendChild(pad(pd.cx, pd.cy, pd.r));
        // Count under each pad (a label, not an instruction).
        const n = counts[b] || 0;
        if (p.counts !== false) {
          layFront.appendChild(S('text', { x: pd.cx, y: pd.cy + pd.r + 46, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 800, 'font-size': 42, fill: n ? COL.ink : COL.lineStrong }, [String(n)]));
        }
      });
    } else {
      // Only the groups made so far get a ring (empty rings would give the answer away).
      L.rings.forEach((rg, gi) => {
        if (gi < counts.length) layBack.appendChild(pad(rg.cx, rg.cy, rg.r, gi === popGroup ? 'pop' : ''));
      });
    }
    // Leftover label.
    if (isDone() && left() > 0) {
      const S0 = spareLayout();
      layFront.appendChild(S('text', { x: S0.x0, y: S0.y + 9, 'text-anchor': 'start', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 26, fill: COL.ink }, ['left over']));
    }
  }

  function redraw(instant) {
    if (iconKey !== `${total}|${p.icon || 'dot'}`) buildItems();
    drawBack();
    for (let i = 0; i < total; i++) place(i, instant);
    syncCtl();
  }

  // ---------- actions ----------
  function dealOne(i) {
    if (mode !== 'share' || isDone()) return false;
    const pileIdx = where.map((w, k) => (w < 0 ? k : -1)).filter(k => k >= 0);
    if (!pileIdx.length) return false;
    if (pileIdx.length < nB && counts.every(c => c === counts[0])) return false;
    if (i === undefined || where[i] !== -1) i = pileIdx[pileIdx.length - 1];
    const dealt = counts.reduce((a, b) => a + b, 0);
    const b = dealt % nB;
    where[i] = b; slotIn[i] = counts[b]; counts[b]++;
    return true;
  }

  function dealRound() {
    if (ro() || mode !== 'share') return;
    const before = counts.reduce((a, b) => a + b, 0);
    const startPad = before % nB;
    let n = 0;
    const want = nB - startPad; // finish the current round
    const pileIdx = where.map((w, k) => (w < 0 ? k : -1)).filter(k => k >= 0).reverse();
    for (let k = 0; k < want && k < pileIdx.length; k++) {
      if (!dealOne(pileIdx[k])) break;
      n++;
    }
    if (!n) return;
    animateDeal(n);
    changed();
  }

  function animateDeal(n) {
    // Items fly one after another for a dealing feel.
    if (reducedMotion()) { redraw(false); sfx('pop'); return; }
    drawBack();
    const moved = [];
    for (let i = 0; i < total; i++) if (where[i] >= 0 && items[i] && items[i].dataset.at !== `${where[i]}:${slotIn[i]}`) moved.push(i);
    moved.sort((a, b) => (slotIn[a] - slotIn[b]) || (where[a] - where[b]));
    moved.forEach((i, k) => later(() => { place(i); items[i].dataset.at = `${where[i]}:${slotIn[i]}`; sfx('pop'); }, k * 110));
    for (let i = 0; i < total; i++) if (where[i] < 0) place(i);
    later(() => { drawBack(); for (let i = 0; i < total; i++) if (where[i] < 0) place(i); }, moved.length * 110 + 50);
    syncCtl();
  }

  function makeGroup(seed) {
    if (ro() || mode !== 'group' || isDone()) return;
    const pileIdx = where.map((w, k) => (w < 0 ? k : -1)).filter(k => k >= 0);
    let pick;
    if (seed !== undefined && where[seed] === -1) {
      const s0 = L.pile(seed);
      pick = pileIdx.slice().sort((a, b) => {
        const qa = L.pile(a), qb = L.pile(b);
        return Math.hypot(qa.x - s0.x, qa.y - s0.y) - Math.hypot(qb.x - s0.x, qb.y - s0.y);
      }).slice(0, gs);
    } else pick = pileIdx.slice(-gs);
    const g = counts.length;
    pick.sort((a, b) => a - b).forEach((i, k) => { where[i] = g; slotIn[i] = k; });
    counts.push(gs);
    sfx('pop');
    drawBack(g);
    if (reducedMotion()) { for (let i = 0; i < total; i++) place(i); }
    else pick.forEach((i, k) => later(() => place(i), k * 45));
    for (let i = 0; i < total; i++) if (where[i] < 0) place(i);
    syncCtl();
    changed();
  }

  function reset() {
    if (ro()) return;
    const had = counts.some(c => c > 0) || (mode === 'group' && counts.length);
    setup(true);
    sfx('whoosh');
    redraw(false);
    if (had) changed();
  }

  // ---------- controls ----------
  const go = document.createElement('button');
  go.className = 'go';
  const rs = document.createElement('button');
  rs.className = 'rs';
  rs.setAttribute('aria-label', 'Start again');
  rs.innerHTML = I_RESET;
  ctl.append(go, rs);
  unbinds.push(onTap(go, () => { if (mode === 'share') dealRound(); else makeGroup(); }));
  unbinds.push(onTap(rs, reset));

  function syncCtl() {
    const show = !ro();
    ctl.style.display = show ? '' : 'none';
    wrap.classList.toggle('ro', !show);
    go.innerHTML = mode === 'share' ? `${I_DEAL}<span>Deal one each</span>` : `${I_RING}<span>Make a group of ${gs}</span>`;
    go.disabled = isDone();
  }

  // Tap the pile: deal that item (share) or group it with its neighbours (group).
  unbinds.push(onTap(root, e => {
    if (ro()) return;
    const pt = root.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = root.getScreenCTM(); if (!m) return;
    const v = pt.matrixTransform(m.inverse());
    if (v.y > L.pileBottom + 14) return;
    // Nearest pile item.
    let best = -1, bd = Infinity;
    for (let i = 0; i < total; i++) {
      if (where[i] !== -1) continue;
      const q = L.pile(i); const d = Math.hypot(q.x - v.x, q.y - v.y);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return;
    if (mode === 'share') {
      if (dealOne(bd < L.psp ? best : undefined)) { animateDeal(1); changed(); }
    } else makeGroup(bd < L.psp * 1.2 ? best : undefined);
  }));

  // ---------- setup ----------
  function setup(clear) {
    total = clamp(Math.round(p.total ?? 12) || 0, 0, 50);
    mode = p.mode === 'group' ? 'group' : 'share';
    nB = clamp(Math.round(p.bowls ?? 3) || 1, 1, 10);
    gs = clamp(Math.round(p.groupSize ?? 2) || 1, 1, 10);
    where = Array(total).fill(-1);
    slotIn = Array(total).fill(0);
    counts = mode === 'share' ? Array(nB).fill(0) : [];
    L = computeLayout();
    if (clear) return;
    if (mode === 'share' && Array.isArray(p.filled)) {
      // Pre-dealt pads. Items come from the end of the pile.
      let next = total - 1;
      p.filled.slice(0, nB).forEach((c, b) => {
        c = clamp(Math.round(c) || 0, 0, 50);
        for (let k = 0; k < c && next >= 0; k++) { where[next] = b; slotIn[next] = counts[b]; counts[b]++; next--; }
      });
    }
    if (mode === 'group' && p.made) {
      const m = clamp(Math.round(p.made) || 0, 0, Math.floor(total / gs));
      let next = total - 1;
      for (let g = 0; g < m; g++) {
        const pick = [];
        for (let k = 0; k < gs; k++) pick.unshift(next--);
        pick.forEach((i, k) => { where[i] = g; slotIn[i] = k; });
        counts.push(gs);
      }
    }
  }

  const api = {
    getState: state,
    update(np = {}) {
      timers.forEach(t => clearTimeout(t)); timers.clear();
      p = { ...p, ...np };
      setup(false);
      redraw(true);
      for (const g of items) g.dataset.at = '';
      for (let i = 0; i < total; i++) if (where[i] >= 0 && items[i]) items[i].dataset.at = `${where[i]}:${slotIn[i]}`;
    },
    showAnswer() {
      timers.forEach(t => clearTimeout(t)); timers.clear();
      if (mode === 'share') {
        let n = 0;
        while (dealOne()) n++;
        if (n) animateDeal(n);
      } else {
        while (!isDone()) {
          const pileIdx = where.map((w, k) => (w < 0 ? k : -1)).filter(k => k >= 0).slice(-gs);
          const g = counts.length;
          pileIdx.forEach((i, k) => { where[i] = g; slotIn[i] = k; });
          counts.push(gs);
        }
        redraw(false);
      }
    },
    destroy() {
      timers.forEach(t => clearTimeout(t)); timers.clear();
      unbinds.splice(0).forEach(u => u());
      el.replaceChildren();
    },
  };

  wrap.classList.toggle('rm', reducedMotion());
  api.update(props);
  return api;
}
