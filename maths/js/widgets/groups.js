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
import { COL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Share and group',
  playground: { total: 12, mode: 'share', bowls: 3, icon: 'dot', interactive: true },
  state: ['bowls', 'groups', 'left', 'done', 'groupSize'],
};

const VW = 800, VH = 470;
const PILE = { x0: 20, x1: 780, y0: 14, y1: 196 };
const LOW = { x0: 10, x1: 790, y0: 214, y1: 462 };

const CSS = `
.w-groups { position: absolute; inset: 0; display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; }
.w-groups .w-groups-svg { flex: 1 1 auto; min-height: 0; position: relative; }
.w-groups .w-groups-svg > svg { position: absolute; inset: 0; }
.w-groups .it { transition: transform .38s cubic-bezier(.3, 1.25, .5, 1), opacity .3s; transform-box: view-box; }
.w-groups.rm .it { transition: none; }
.w-groups .it .halo { opacity: 0; transition: opacity .3s; }
.w-groups .it.spare .halo { opacity: 1; }
.w-groups .pilehit { cursor: pointer; }
.w-groups.ro .pilehit { cursor: default; }
.w-groups .ring { transition: opacity .3s; }
.w-groups-ctl { flex: none; display: flex; justify-content: center; align-items: center; gap: 14px; padding: 6px 10px 10px; }
.w-groups-ctl button { appearance: none; border: 0; cursor: pointer; font-family: ${FONT.display}; font-weight: 600; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.w-groups-ctl .go { min-height: 60px; padding: 0 26px; border-radius: 30px; font-size: 23px; background: var(--gold, #f2b544); color: #1a1205;
  display: flex; align-items: center; gap: 10px; box-shadow: 0 6px 20px rgba(242, 181, 68, .25); transition: transform .1s, opacity .2s; }
.w-groups-ctl .go:active, .w-groups-ctl .rs:active { transform: scale(.95); }
.w-groups-ctl .go[disabled] { opacity: .35; cursor: default; box-shadow: none; }
.w-groups-ctl .go svg { width: 28px; height: 28px; }
.w-groups-ctl .rs { width: 58px; height: 58px; border-radius: 50%; background: rgba(255, 255, 255, .08); color: var(--ink, #f3efe6);
  border: 2px solid rgba(255, 255, 255, .25); display: grid; place-items: center; }
.w-groups-ctl .rs svg { width: 28px; height: 28px; }
`;

const I_DEAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="5" r="2.6" fill="currentColor"/><path d="M12 9v4M12 13l-6 5M12 13l6 5M12 13v6"/></svg>';
const I_RING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9" stroke-dasharray="3 2.4"/><circle cx="9" cy="9.5" r="2" fill="currentColor"/><circle cx="15" cy="9.5" r="2" fill="currentColor"/><circle cx="9" cy="14.5" r="2" fill="currentColor"/><circle cx="15" cy="14.5" r="2" fill="currentColor"/></svg>';
const I_RESET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 3.5v4.6h4.6"/></svg>';

// Positions inside one group: a "flower" for small groups, a grid for bigger ones.
function groupShape(gs) {
  if (gs <= 6) {
    const f = gs <= 1 ? 0 : gs === 2 ? 0.5 : 0.5 / Math.sin(Math.PI / gs);
    const pts = [];
    for (let k = 0; k < gs; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / gs + (gs === 2 ? Math.PI / 2 : 0);
      pts.push({ x: f * Math.cos(a), y: f * Math.sin(a) });
    }
    return { pts, round: true, w: 2 * (f + 0.62), h: 2 * (f + 0.62) };
  }
  const mc = gs === 9 ? 3 : Math.ceil(gs / 2), mr = Math.ceil(gs / mc);
  const pts = [];
  for (let k = 0; k < gs; k++) {
    const r = Math.floor(k / mc), inRow = Math.min(mc, gs - r * mc);
    pts.push({ x: (k % mc) - (inRow - 1) / 2, y: r - (mr - 1) / 2 });
  }
  return { pts, round: false, w: mc + 0.3, h: mr + 0.3 };
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
  root.append(layBack, layItems, layFront);

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
  function computeLayout() {
    const lay = {};
    // Pile.
    const cols = total <= 10 ? Math.max(total, 1) : 10;
    const prow = Math.max(1, Math.ceil(total / cols));
    const psp = Math.min((PILE.x1 - PILE.x0) / cols, (PILE.y1 - PILE.y0) / prow, 66);
    const pw = cols * psp, ph = prow * psp;
    const px0 = (VW - pw) / 2 + psp / 2, py0 = PILE.y0 + ((PILE.y1 - PILE.y0) - ph) / 2 + psp / 2;
    lay.pile = i => ({ x: px0 + (i % cols) * psp, y: py0 + Math.floor(i / cols) * psp, r: psp * 0.4 });
    lay.psp = psp;
    lay.pileBox = { x: (VW - pw) / 2 - 8, y: py0 - psp / 2 - 6, w: pw + 16, h: ph + 12 };
    const LW = LOW.x1 - LOW.x0, LH = LOW.y1 - LOW.y0;
    if (mode === 'share') {
      const per = nB <= 5 ? nB : Math.ceil(nB / 2), br = Math.ceil(nB / per);
      const cw = LW / per, ch = LH / br;
      const maxPer = Math.max(1, Math.ceil(total / nB));
      const rx = cw * 0.45, ry = ch * 0.37;
      let mc = clamp(Math.ceil(Math.sqrt((maxPer * rx) / ry)), 1, maxPer);
      const mr = Math.ceil(maxPer / mc);
      const sp = Math.min((rx * 1.45) / mc, (ry * 1.45) / mr, 58);
      lay.pads = [];
      for (let b = 0; b < nB; b++) {
        const row = Math.floor(b / per), inRow = Math.min(per, nB - row * per);
        const cx = LOW.x0 + LW / 2 + ((b % per) - (inRow - 1) / 2) * cw, cy = LOW.y0 + (row + 0.5) * ch - 14;
        lay.pads.push({ cx, cy, rx, ry });
      }
      lay.slot = (b, k) => {
        const pd = lay.pads[b];
        // Fixed slots (filled in reading order) so items never shuffle while dealing.
        const n = Math.max(maxPer, k + 1);
        const rowsHere = Math.ceil(n / mc);
        const r = Math.floor(k / mc), inRow = Math.min(mc, n - r * mc);
        return { x: pd.cx + ((k % mc) - (inRow - 1) / 2) * sp, y: pd.cy + (r - (rowsHere - 1) / 2) * sp, r: sp * 0.4 };
      };
    } else {
      const G = Math.max(1, Math.floor(total / gs));
      const per = G <= 5 ? G : G <= 10 ? Math.ceil(G / 2) : Math.ceil(G / 3), gr = Math.ceil(G / per);
      const cw = LW / per, ch = LH / gr;
      const shp = groupShape(gs);
      const sp = Math.min((cw * 0.92) / shp.w, (ch * 0.92) / shp.h, 58);
      lay.rings = [];
      for (let g = 0; g < G; g++) {
        const row = Math.floor(g / per), inRow = Math.min(per, G - row * per);
        const cx = LOW.x0 + LW / 2 + ((g % per) - (inRow - 1) / 2) * cw, cy = LOW.y0 + (row + 0.5) * ch;
        lay.rings.push({ cx, cy, w: shp.w * sp, h: shp.h * sp, round: shp.round });
      }
      lay.slot = (g, k) => {
        const rg = lay.rings[g] || lay.rings[lay.rings.length - 1];
        const q = shp.pts[k] || { x: 0, y: 0 };
        return { x: rg.cx + q.x * sp, y: rg.cy + q.y * sp, r: sp * 0.4 };
      };
    }
    return lay;
  }

  // ---------- drawing ----------
  function itemInner(r0) {
    const icon = p.icon || 'dot';
    const g = S('g');
    g.appendChild(S('circle', { class: 'halo', r: r0 * 1.32, fill: 'rgba(242,181,68,.16)', stroke: COL.tens, 'stroke-width': 3.5 }));
    if (icon === 'dot') {
      g.appendChild(S('circle', { r: r0, fill: COL.b }));
      g.appendChild(S('circle', { r: r0 * 0.55, cx: -r0 * 0.25, cy: -r0 * 0.28, fill: 'rgba(255,255,255,.28)' }));
    } else {
      const a = S('g', { transform: `translate(${-r0 * 1.12} ${-r0 * 1.12}) scale(${(r0 * 2.24) / 100})` });
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
      g.appendChild(itemInner(20));
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
    const k = q.r / 20;
    if (instant) g.style.transition = 'none';
    g.style.transform = `translate(${q.x}px, ${q.y}px) scale(${k})`;
    if (instant) { void g.getBoundingClientRect(); g.style.transition = ''; }
    const spare = where[i] < 0 && isDone() && left() > 0;
    g.classList.toggle('spare', spare);
  }

  // Leftovers gather in the middle of the tray once the sharing or grouping is finished.
  function spareSpot(i) {
    const spare = where.map((w, k) => (w < 0 ? k : -1)).filter(k => k >= 0);
    const rank = spare.indexOf(i), n = spare.length;
    const r = Math.min(L.psp * 0.4, 26), sp = r * 2.6;
    return { x: VW / 2 + (rank - (n - 1) / 2) * sp, y: (PILE.y0 + PILE.y1) / 2 + 14, r };
  }

  function drawBack() {
    layBack.replaceChildren();
    layFront.replaceChildren();
    // Pile tray.
    const pb = L.pileBox;
    layBack.appendChild(S('rect', { x: pb.x, y: pb.y, width: pb.w, height: pb.h, rx: 22, fill: 'rgba(255,255,255,.035)', stroke: 'rgba(255,255,255,.1)', 'stroke-width': 2, 'stroke-dasharray': '8 8' }));
    if (mode === 'share') {
      L.pads.forEach((pd, b) => {
        const g = S('g');
        g.appendChild(S('ellipse', { cx: pd.cx, cy: pd.cy + pd.ry * 0.12, rx: pd.rx, ry: pd.ry, fill: 'rgba(0,0,0,.35)' }));
        g.appendChild(S('ellipse', { cx: pd.cx, cy: pd.cy, rx: pd.rx, ry: pd.ry, fill: '#1a2a4f', stroke: 'rgba(95,212,255,.55)', 'stroke-width': 3 }));
        g.appendChild(S('ellipse', { cx: pd.cx, cy: pd.cy, rx: pd.rx * 0.84, ry: pd.ry * 0.82, fill: 'none', stroke: 'rgba(242,181,68,.4)', 'stroke-width': 2, 'stroke-dasharray': '6 9' }));
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          g.appendChild(S('circle', { cx: pd.cx + Math.cos(a) * pd.rx * 0.93, cy: pd.cy + Math.sin(a) * pd.ry * 0.93, r: 3, fill: COL.ones, opacity: 0.8 }));
        }
        layBack.appendChild(g);
        // Count under each pad (a small label, not an instruction).
        const n = counts[b] || 0;
        const t = S('text', { x: pd.cx, y: pd.cy + pd.ry + 28, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 28, fill: n ? COL.ink : 'rgba(255,255,255,.25)' }, [String(n)]);
        if (p.counts !== false) layFront.appendChild(t);
      });
    } else {
      L.rings.forEach((rg, gi) => {
        const made = gi < counts.length;
        const attrs = { fill: made ? 'rgba(232,121,249,.10)' : 'rgba(255,255,255,.02)', stroke: made ? '#e879f9' : 'rgba(255,255,255,.14)', 'stroke-width': made ? 3.5 : 2, 'stroke-dasharray': made ? '' : '7 8', class: 'ring' };
        const el2 = rg.round
          ? S('circle', { cx: rg.cx, cy: rg.cy, r: rg.w / 2, ...attrs })
          : S('rect', { x: rg.cx - rg.w / 2, y: rg.cy - rg.h / 2, width: rg.w, height: rg.h, rx: Math.min(rg.w, rg.h) * 0.4, ...attrs });
        layBack.appendChild(el2);
      });
    }
    // Leftover label.
    if (isDone() && left() > 0) {
      const q0 = spareSpot(where.indexOf(-1));
      layFront.appendChild(S('text', { x: VW / 2, y: q0.y - q0.r * 1.6 - 10, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 24, fill: COL.tens }, ['left over']));
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
    drawBack();
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
  const hit = S('rect', { class: 'pilehit', x: 0, y: 0, width: VW, height: PILE.y1 + 10, fill: 'transparent' });
  root.insertBefore(hit, layBack);
  unbinds.push(onTap(root, e => {
    if (ro()) return;
    const pt = root.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = root.getScreenCTM(); if (!m) return;
    const v = pt.matrixTransform(m.inverse());
    if (v.y > PILE.y1 + 14) return;
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
