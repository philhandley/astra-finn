// clock: an analogue clock face with draggable hands (Measure Lab).
// Props: h (1-12), m (0-59), interactive (default true), snap (minutes the minute hand snaps to: 60, 30, 15, 5 or 1; default 5),
//        digital (digital readout beside the face), minuteLabels (5, 10 ... 55 round the outside),
//        pastTo (shade the "past" and "to" halves), dragHour (default true: the hour hand can be dragged too),
//        hands ('both' | 'hour' | 'minute'; default 'both'), readonly.
// Drag anywhere on the face: near the short hand moves the hour hand, anywhere else moves the minute hand.
// The hands are geared like a real clock: turning the minute hand past 12 moves the hour on (or back).
// State: { h, m, minutes, words }  minutes = (h % 12) * 60 + m; words is the UK phrase ("quarter past 3", "25 to 7").
// Debug: dev/harness.html?widget=clock&props={"h":3,"m":0,"interactive":true,"digital":true,"minuteLabels":true,"pastTo":true}
import { S, svgRoot, svgPoint, drag, injectCSS, clamp, reducedMotion } from '../core/dom.js';
import { COL, FONT } from '../core/theme.js';
import { sfx } from '../core/sfx.js';

export const meta = {
  title: 'Clock',
  playground: { h: 3, m: 0, interactive: true, snap: 5, digital: true, minuteLabels: true },
  state: ['h', 'm', 'minutes', 'words'],
};

const W = 800, H = 500;
const FACE = '#f3efe6', NAVY = '#0c1430', HOUR = '#e0661f', MIN = '#1f5fd1', MINLAB = '#8fbcff';

// UK words for a time.
export function clockWords(h, m) {
  h = ((Math.round(h) - 1) % 12 + 12) % 12 + 1;
  m = clamp(Math.round(m), 0, 59);
  const next = h % 12 + 1;
  if (m === 0) return `${h} o'clock`;
  if (m === 15) return `quarter past ${h}`;
  if (m === 30) return `half past ${h}`;
  if (m === 45) return `quarter to ${next}`;
  if (m < 30) return `${m} past ${h}`;
  return `${60 - m} to ${next}`;
}

const norm720 = t => ((Math.round(t) % 720) + 720) % 720;
function hm(total) {
  const t = norm720(total);
  const idx = Math.floor(t / 60);
  return { h: idx === 0 ? 12 : idx, m: t % 60 };
}
function totalFrom(h, m) {
  h = Math.round(Number(h));
  if (!Number.isFinite(h)) h = 12;
  h = ((h - 1) % 12 + 12) % 12 + 1;
  m = clamp(Math.round(Number(m) || 0), 0, 59);
  return (h % 12) * 60 + m;
}

export function mount(el, props = {}, ctx = {}) {
  injectCSS('w-clock', `
    .w-clock { width: 100%; height: 100%; }
    .w-clock .grab { cursor: grab; }
    .w-clock.ro .grab { cursor: default; }
  `);
  let p = {};
  let total = 0;        // continuous minutes since 12:00 while dragging; whole snapped value at rest
  let anim = 0;
  let dragging = false;
  const root = svgRoot(W, H, 'w-clock');
  el.appendChild(root);
  let unbindDrag = null;

  const ro = () => !!(p.readonly || ctx.readonly || p.interactive === false);
  const snap = () => { const s = Math.round(Number(p.snap) || 5); return [1, 5, 10, 15, 30, 60].includes(s) ? s : 5; };
  const snapped = t => Math.round(t / snap()) * snap();

  function setFromProps(np) {
    p = { ...p, ...np };
    if ('h' in np || 'm' in np || !Number.isFinite(total)) total = totalFrom(p.h ?? 12, p.m ?? 0);
  }

  // Geometry depends on the options shown.
  function geo() {
    const R = p.minuteLabels ? 178 : 212;
    const cx = p.digital ? (p.minuteLabels ? 285 : 300) : 400;
    return { R, cx, cy: H / 2 };
  }
  const pol = (cx, cy, r, deg) => {
    const a = (deg * Math.PI) / 180;
    return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
  };

  let handsG = null, readout = null;

  function draw() {
    root.replaceChildren();
    root.classList.toggle('ro', ro());
    const { R, cx, cy } = geo();
    const face = S('g', { class: 'grab' });
    // Outside ring and face.
    face.appendChild(S('circle', { cx, cy, r: R + 10, fill: '#2a3557', stroke: '#9fb3d9', 'stroke-width': 4 }));
    face.appendChild(S('circle', { cx, cy, r: R, fill: FACE }));
    if (p.pastTo) {
      const top = pol(cx, cy, R, 0), bot = pol(cx, cy, R, 180);
      face.appendChild(S('path', { d: `M${cx} ${cy}L${top.x} ${top.y}A${R} ${R} 0 0 1 ${bot.x} ${bot.y}Z`, fill: 'rgba(31,95,209,.13)' }));
      face.appendChild(S('path', { d: `M${cx} ${cy}L${bot.x} ${bot.y}A${R} ${R} 0 0 1 ${top.x} ${top.y}Z`, fill: 'rgba(224,102,31,.12)' }));
      face.appendChild(S('line', { x1: cx, y1: cy - R, x2: cx, y2: cy + R, stroke: 'rgba(12,20,48,.25)', 'stroke-width': 3, 'stroke-dasharray': '8 8' }));
      face.appendChild(S('text', { x: cx + R * 0.36, y: cy + R * 0.5, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: MIN, opacity: 0.75 }, ['past']));
      face.appendChild(S('text', { x: cx - R * 0.36, y: cy + R * 0.5, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 30, fill: HOUR, opacity: 0.8 }, ['to']));
    }
    // Minute marks.
    for (let i = 0; i < 60; i++) {
      const five = i % 5 === 0;
      const a = pol(cx, cy, R * (five ? 0.86 : 0.92), i * 6), b = pol(cx, cy, R * 0.975, i * 6);
      face.appendChild(S('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: NAVY, 'stroke-width': five ? 5 : 2.2, 'stroke-linecap': 'round', opacity: five ? 0.9 : 0.55 }));
    }
    // Hour numbers.
    const fs = Math.round(R * 0.2);
    for (let n = 1; n <= 12; n++) {
      const q = pol(cx, cy, R * 0.7, n * 30);
      face.appendChild(S('text', { x: q.x, y: q.y + fs * 0.36, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': fs, fill: NAVY }, [String(n)]));
    }
    // Minute labels outside the face.
    if (p.minuteLabels) {
      for (let k = 1; k < 12; k++) {
        const q = pol(cx, cy, R + 40, k * 30);
        face.appendChild(S('text', { x: q.x, y: q.y + 10, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 600, 'font-size': 28, fill: MINLAB }, [String(k * 5)]));
      }
    }
    // A big transparent target so the whole face (and its rim labels) can be grabbed.
    face.appendChild(S('circle', { cx, cy, r: R + (p.minuteLabels ? 58 : 18), fill: 'transparent' }));
    root.appendChild(face);
    handsG = S('g', { 'pointer-events': 'none' });
    root.appendChild(handsG);
    if (p.digital) {
      const bx = 560, bw = 215, bh = 120, by = cy - bh / 2;
      root.appendChild(S('rect', { x: bx, y: by, width: bw, height: bh, rx: 22, fill: '#0b1020', stroke: '#9fb3d9', 'stroke-width': 3 }));
      readout = S('text', { x: bx + bw / 2, y: by + bh / 2 + 24, 'text-anchor': 'middle', 'font-family': FONT.display, 'font-weight': 700, 'font-size': 68, fill: COL.good, 'letter-spacing': '2' }, ['']);
      root.appendChild(readout);
    } else readout = null;
    drawHands(total);
    if (unbindDrag) { unbindDrag(); unbindDrag = null; }
    if (!ro()) bindDrag();
  }

  function drawHands(t) {
    if (!handsG) return;
    handsG.replaceChildren();
    const { R, cx, cy } = geo();
    const tt = ((t % 720) + 720) % 720;
    const minDeg = (tt % 60) * 6, hourDeg = tt / 2;
    const which = p.hands || 'both';
    const hand = (deg, len, wid, col, knob) => {
      const tip = pol(cx, cy, len, deg), tail = pol(cx, cy, -len * 0.14, deg);
      handsG.appendChild(S('line', { x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y, stroke: col, 'stroke-width': wid, 'stroke-linecap': 'round' }));
      if (knob) {
        const k = pol(cx, cy, len * 0.8, deg);
        handsG.appendChild(S('circle', { cx: k.x, cy: k.y, r: wid * 0.95, fill: col, stroke: FACE, 'stroke-width': 3 }));
      }
    };
    const live = !ro();
    if (which !== 'minute') hand(hourDeg, R * 0.5, 17, HOUR, live && p.dragHour !== false);
    if (which !== 'hour') hand(minDeg, R * 0.84, 10, MIN, live);
    handsG.appendChild(S('circle', { cx, cy, r: 13, fill: NAVY }));
    handsG.appendChild(S('circle', { cx, cy, r: 5, fill: FACE }));
    if (readout) {
      const { h, m } = hm(dragging ? snapped(t) : Math.round(total));
      readout.textContent = `${h}:${String(m).padStart(2, '0')}`;
    }
  }

  function bindDrag() {
    let mode = null, prev = 0, startTotal = 0, lastSnap = 0;
    const angleOf = q => {
      const { cx, cy } = geo();
      let a = (Math.atan2(q.x - cx, -(q.y - cy)) * 180) / Math.PI;
      if (a < 0) a += 360;
      return a;
    };
    const angDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
    unbindDrag = drag(root, {
      start(q) {
        cancelAnimationFrame(anim); clearTimeout(fallback);
        const { R, cx, cy } = geo();
        const d = Math.hypot(q.x - cx, q.y - cy);
        if (d > R + (p.minuteLabels ? 70 : 40)) { mode = null; return; }
        dragging = true;
        startTotal = snapped(total);
        total = startTotal;
        lastSnap = startTotal;
        const a = angleOf(q);
        const tt = norm720(total);
        const hourDeg = tt / 2, minDeg = (tt % 60) * 6;
        const which = p.hands || 'both';
        const canHour = p.dragHour !== false && which !== 'minute';
        const nearHour = angDist(a, hourDeg) < 45;
        // The inner zone belongs to the short hand (so it can be grabbed when the hands overlap).
        if (which === 'hour' || (canHour && nearHour && (d < R * 0.52 || (d < R * 0.62 && angDist(a, hourDeg) < angDist(a, minDeg))))) {
          mode = 'hour';
          prev = a * 2; // minutes on a 720-minute dial
        } else {
          mode = 'min';
          // Tap away from the minute hand: put it there, staying in the same hour.
          if (angDist(a, minDeg) > 18) total = Math.floor(total / 60) * 60 + a / 6;
          prev = a / 6;
          drawHands(total);
        }
      },
      move(q) {
        if (!mode) return;
        const a = angleOf(q);
        if (mode === 'min') {
          const raw = a / 6;
          let dlt = raw - prev;
          if (dlt > 30) dlt -= 60; else if (dlt < -30) dlt += 60;
          total += dlt; prev = raw;
        } else {
          const raw = a * 2;
          let dlt = raw - prev;
          if (dlt > 360) dlt -= 720; else if (dlt < -360) dlt += 720;
          total += dlt; prev = raw;
        }
        const s = snapped(total);
        if (s !== lastSnap) { lastSnap = s; sfx('tick'); }
        drawHands(total);
      },
      end() {
        dragging = false;
        if (!mode) return;
        mode = null;
        const target = snapped(total);
        const from = total;
        total = norm720(target);
        animateFrom(from - target + total, total, 160);
        if (total !== norm720(startTotal)) {
          sfx('click');
          ctx.onChange && ctx.onChange(api.getState());
        }
      },
    }, root);
  }

  // Visual only: sweep the hands from one dial position to another. The logical time (total) is already set.
  let fallback = 0;
  function animateFrom(from, to, ms) {
    cancelAnimationFrame(anim); clearTimeout(fallback);
    if (reducedMotion() || ms <= 0 || Math.abs(to - from) < 0.01) { drawHands(to); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      drawHands(from + (to - from) * e);
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
    // If frames are paused (hidden tab), still land on the final position.
    fallback = setTimeout(() => { cancelAnimationFrame(anim); drawHands(to); }, ms + 80);
  }

  const api = {
    getState() {
      const { h, m } = hm(dragging ? snapped(total) : Math.round(total));
      return { h, m, minutes: (h % 12) * 60 + m, words: clockWords(h, m) };
    },
    update(np) { cancelAnimationFrame(anim); clearTimeout(fallback); setFromProps(np || {}); draw(); },
    showAnswer(answer) {
      let t = null;
      if (answer && typeof answer === 'object' && ('h' in answer || 'm' in answer)) t = totalFrom(answer.h ?? 12, answer.m ?? 0);
      else if (typeof answer === 'string' && /^\d{1,2}:\d{2}$/.test(answer.trim())) { const [a, b] = answer.trim().split(':'); t = totalFrom(+a, +b); }
      else if (typeof answer === 'number') t = norm720(answer);
      if (t === null) return;
      // Turn forwards (clockwise) like a real clock, at most one turn of the dial.
      const cur = norm720(total);
      let target = t;
      while (target < cur) target += 720;
      total = norm720(t);
      animateFrom(cur, target, 900);
    },
    destroy() { cancelAnimationFrame(anim); clearTimeout(fallback); if (unbindDrag) unbindDrag(); el.replaceChildren(); },
  };
  total = NaN;
  setFromProps(props);
  draw();
  return api;
}
