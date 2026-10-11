// Small DOM and SVG helpers shared by the app, widgets and arcade games.
const NS = 'http://www.w3.org/2000/svg';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html).trim();
  return t.content.firstElementChild;
}

export function S(tag, attrs = {}, children = []) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children || [])) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export function svgRoot(viewW, viewH, cls = '') {
  const s = S('svg', { viewBox: `0 0 ${viewW} ${viewH}`, preserveAspectRatio: 'xMidYMid meet', class: cls, width: '100%', height: '100%' });
  s.style.display = 'block';
  s.style.touchAction = 'none';
  s.style.userSelect = 'none';
  return s;
}

export function svgPoint(svgEl, evt) {
  const pt = svgEl.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  const m = svgEl.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = pt.matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

// Fires once per tap (pointer down and up close together). Returns an unbind function.
export function onTap(el, fn, { slop = 12 } = {}) {
  let sx = 0, sy = 0, id = null, t0 = 0;
  const down = e => { if (e.button > 0) return; id = e.pointerId; sx = e.clientX; sy = e.clientY; t0 = performance.now(); };
  const up = e => {
    if (e.pointerId !== id) return;
    id = null;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) <= slop && performance.now() - t0 < 1200) fn(e);
  };
  const cancel = () => { id = null; };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  // Keyboard access for focusable elements.
  const key = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); fn(e); } };
  el.addEventListener('keydown', key);
  return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel); el.removeEventListener('keydown', key); };
}

// Pointer-captured drag. p is in SVG viewBox coordinates when svgEl is given.
export function drag(el, { start, move, end } = {}, svgEl = null) {
  let active = null;
  const pos = e => (svgEl ? svgPoint(svgEl, e) : { x: e.clientX, y: e.clientY });
  const down = e => {
    if (active !== null || e.button > 0) return;
    active = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
    start && start(pos(e), e);
  };
  const mv = e => { if (e.pointerId !== active) return; e.preventDefault(); move && move(pos(e), e); };
  const up = e => {
    if (e.pointerId !== active) return;
    active = null;
    try { el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    end && end(pos(e), e);
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', mv);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', mv);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
  };
}

export function injectCSS(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
