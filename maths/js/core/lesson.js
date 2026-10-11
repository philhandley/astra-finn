// Lesson building blocks: the tutor panel (left), the console (right), inputs, templates and goal checks.
import { h, esc } from './dom.js';
import { icon } from './icons.js';
import { art } from './art.js';
import { sfx } from './sfx.js';
import { autoSay, say, hush, speakButton, onSpeaking } from './ui.js';
import { store } from './store.js';

/* ---------------- Templates and goals ---------------- */
function fmt(v) {
  if (Array.isArray(v)) return v.map(fmt).join(' and ');
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

function evalExpr(expr, scope) {
  if (/^[A-Za-z_]\w*$/.test(expr)) return scope[expr];
  if (!/^[\w\s+\-*/().]+$/.test(expr)) return undefined;
  let bad = false;
  const js = expr.replace(/[A-Za-z_]\w*/g, id => { const v = scope[id]; if (typeof v !== 'number') bad = true; return String(v); });
  if (bad) return undefined;
  try { return Function(`"use strict";return (${js});`)(); } catch (e) { return undefined; }
}

export function fill(text, scope = {}) {
  return String(text ?? '').replace(/\{([^{}]+)\}/g, (m, expr) => {
    const v = evalExpr(expr.trim(), scope);
    if (v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))) {
      console.warn('TEMPLATE unresolved', m, Object.keys(scope));
      return '?';
    }
    return fmt(v);
  });
}

// Evaluate a template that should produce a value (number when numeric).
export function fillValue(v, scope) {
  if (typeof v !== 'string' || !v.includes('{')) return v;
  const s = fill(v, scope);
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
}

export function same(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b);
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na === nb;
  }
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

function matchVal(g, v) {
  if (Array.isArray(g)) return Array.isArray(v) && v.length === g.length && g.every((x, i) => matchVal(x, v[i]));
  if (g && typeof g === 'object') {
    if (v === null || v === undefined) return false;
    let ok = true;
    if ('gte' in g) ok = ok && Number(v) >= g.gte;
    if ('lte' in g) ok = ok && Number(v) <= g.lte;
    if ('in' in g) ok = ok && g.in.some(x => same(x, v));
    if ('not' in g) ok = ok && !same(g.not, v);
    if ('eq' in g) ok = ok && same(g.eq, v);
    return ok;
  }
  return same(g, v);
}

export function matches(goal, state) {
  if (!goal || typeof goal !== 'object') return false;
  return Object.entries(goal).every(([k, g]) => matchVal(g, state ? state[k] : undefined));
}

const normTime = s => { const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(s).trim()); return m ? `${+m[1]}:${String(+m[2]).padStart(2, '0')}` : String(s).trim(); };
export function answerMatches(typed, answer) {
  if (typeof answer === 'string' && answer.includes(':')) return normTime(typed) === normTime(answer);
  return same(String(typed).replace(/^0+(\d)/, '$1'), answer);
}

export const optVal = o => (o && typeof o === 'object' && 'value' in o ? o.value : (o && typeof o === 'object' && 'label' in o ? o.label : o));
export const optLabel = o => (o && typeof o === 'object' ? (o.label ?? o.value) : o);

const PRAISE = ['Yes!', 'Spot on.', 'Exactly.', "That's it.", 'Brilliant.', 'Nailed it.', 'Super.', 'Yes, well worked out.'];
export const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

/* ---------------- Tutor panel ---------------- */
export class Tutor {
  constructor(el, name = 'Nova') {
    this.el = el;
    el.className = 'tutor';
    el.innerHTML = `<div class="who"><span class="orb"></span><span class="name">${esc(name)}</span><span class="sp"></span></div>
      <div class="pips"></div><div class="lines" aria-live="polite"></div><div class="actions"></div>`;
    this.linesEl = el.querySelector('.lines');
    this.actionsEl = el.querySelector('.actions');
    this.pipsEl = el.querySelector('.pips');
    this.orb = el.querySelector('.orb');
    this.current = [];
    this.spBtn = speakButton(() => this.current.join(' '), 'Say it again');
    el.querySelector('.sp').replaceWith(this.spBtn);
    this.off = onSpeaking(on => this.orb.classList.toggle('talk', on));
  }
  // Show lines. Returns a promise that resolves when they've been spoken (or straight away).
  lines(arr, { cls = '', append = false, speak = true } = {}) {
    const list = (Array.isArray(arr) ? arr : [arr]).filter(x => x !== undefined && x !== null && String(x).trim() !== '').map(String);
    if (!append) { this.linesEl.replaceChildren(); this.current = []; }
    for (const t of list) {
      const p = document.createElement('p');
      if (cls) p.className = cls;
      p.textContent = t;
      this.linesEl.appendChild(p);
    }
    this.current.push(...list);
    this.el.scrollTop = this.el.scrollHeight;
    if (!speak || !list.length) return Promise.resolve();
    return autoSay(list.join(' '), this.spBtn);
  }
  add(arr, opts = {}) { return this.lines(arr, { ...opts, append: true }); }
  sayNow(text) { return say(text, this.spBtn); }
  clear() { this.linesEl.replaceChildren(); this.current = []; this.actions([]); }
  actions(btns) { this.actionsEl.replaceChildren(...btns.filter(Boolean)); }
  button(label, onClick, { ghost = false, glow = false, iconName = null } = {}) {
    const b = h(`<button class="btn ${ghost ? 'ghost' : ''} ${glow ? 'glow' : ''}" type="button">${esc(label)}${iconName ? ' ' + icon(iconName) : ''}</button>`);
    b.addEventListener('click', onClick);
    return b;
  }
  pips(n) { this.pipsEl.innerHTML = Array.from({ length: n }, () => '<i></i>').join(''); this.pipEls = [...this.pipsEl.children]; }
  pip(i, state) { const p = this.pipEls?.[i]; if (p) p.className = state; }
  destroy() { this.off && this.off(); hush(); }
}

/* ---------------- Number pad ---------------- */
export class Numpad {
  constructor(host, { allowColon = false, prefix = '', unit = '', maxLen = 5, onSubmit } = {}) {
    this.value = '';
    this.onSubmit = onSubmit;
    this.maxLen = maxLen;
    this.el = h(`<div class="numpad" role="group" aria-label="Number pad">
      <div class="disp"><span class="pre">${esc(prefix)}</span><span class="val"></span><span class="cursor"></span><span class="unit">${esc(unit)}</span></div>
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}">${n}</button>`).join('')}
      <button type="button" class="del" data-k="del" aria-label="Delete">${icon('backspace')}</button>
      <button type="button" data-k="0">0</button>
      <button type="button" class="ok" data-k="ok" aria-label="Check">${icon('check')}</button>
      ${allowColon ? '<button type="button" class="colon" data-k=":" style="grid-column:2">:</button>' : ''}
    </div>`);
    this.valEl = this.el.querySelector('.val');
    this.el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      this.press(b.dataset.k);
    });
    this.onKey = e => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      if (document.querySelector('.modal-back')) return;
      if (/^[0-9]$/.test(e.key)) this.press(e.key);
      else if (e.key === ':' && allowColon) this.press(':');
      else if (e.key === 'Backspace') { e.preventDefault(); this.press('del'); }
      else if (e.key === 'Enter') { e.preventDefault(); this.press('ok'); }
    };
    document.addEventListener('keydown', this.onKey);
    host.appendChild(this.el);
  }
  press(k) {
    if (this.locked) return;
    if (k === 'del') { this.value = this.value.slice(0, -1); sfx('click'); }
    else if (k === 'ok') { if (this.value !== '' && this.onSubmit) { sfx('click'); this.onSubmit(this.value); } return; }
    else if (k === ':') { if (!this.value.includes(':') && this.value.length) this.value += ':'; }
    else if (this.value.length < this.maxLen) { this.value += k; sfx('tick'); }
    this.valEl.textContent = this.value;
  }
  set(v) { this.value = String(v); this.valEl.textContent = this.value; }
  clear() { this.set(''); }
  lock(on = true) { this.locked = on; this.el.classList.toggle('locked', on); }
  destroy() { document.removeEventListener('keydown', this.onKey); this.el.remove(); }
}

/* ---------------- Console (right panel) ---------------- */
const widgetMods = {};
export async function loadWidget(name) {
  // One retry, in case the network hiccups while loading a part of the app.
  if (!widgetMods[name]) widgetMods[name] = import(`../widgets/${name}.js`).catch(() => new Promise(r => setTimeout(r, 700)).then(() => import(`../widgets/${name}.js?retry=1`)));
  try { return await widgetMods[name]; } catch (e) { delete widgetMods[name]; throw e; }
}

export class Console {
  constructor(el) {
    this.el = el;
    el.className = 'console';
    el.innerHTML = `<div class="cap"></div><div class="wbox none"></div><div class="inrow"></div>`;
    this.capEl = el.querySelector('.cap');
    this.wbox = el.querySelector('.wbox');
    this.inrow = el.querySelector('.inrow');
    this.api = null;
    this.widgetName = null;
    this.pad = null;
    this.token = 0;
  }
  caption(text, { glow = false } = {}) {
    const t = String(text ?? '');
    this.capEl.innerHTML = esc(t).replace(/\?/g, '<span class="q">?</span>').replace(/□/g, '<span class="q">&nbsp;</span>');
    this.capEl.classList.toggle('glow', glow);
  }
  glow(on = true) { this.capEl.classList.toggle('glow', on); if (on) { this.wbox.classList.remove('flash'); void this.wbox.offsetWidth; this.wbox.classList.add('flash'); } }
  clearWidget() {
    if (this.api) { try { this.api.destroy(); } catch (e) { console.warn(e); } }
    this.api = null; this.widgetName = null;
    this.wbox.replaceChildren();
    this.wbox.classList.add('none');
    this.el.classList.remove('dark');
  }
  async widget(name, props = {}, { readonly = false, onChange } = {}) {
    const tok = ++this.token;
    this.clearWidget();
    this.wbox.classList.remove('none');
    const host = document.createElement('div');
    host.className = 'widget';
    this.wbox.appendChild(host);
    let mod;
    try { mod = await loadWidget(name); } catch (e) {
      console.error('WIDGET LOAD FAILED', name, e);
      if (tok === this.token) host.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:var(--ink-3);font-size:20px">This part is still being built.</div>`;
      return null;
    }
    if (tok !== this.token) return null;
    this.el.classList.toggle('dark', mod.meta?.surface === 'dark');
    try {
      this.api = mod.mount(host, readonly ? { ...props, readonly: true } : { ...props }, { readonly, onChange: s => onChange && onChange(s) });
      this.widgetName = name;
    } catch (e) {
      console.error('WIDGET MOUNT FAILED', name, e);
      host.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:var(--ink-3);font-size:20px">This part is still being built.</div>`;
      this.api = null;
    }
    return this.api;
  }
  state() { try { return this.api ? this.api.getState() : {}; } catch (e) { return {}; } }
  showArt(name) {
    this.clearWidget();
    this.wbox.innerHTML = `<div class="bigart">${art(name, 320)}</div>`;
    const svg = this.wbox.querySelector('svg'); if (svg) { svg.setAttribute('width', '100%'); svg.removeAttribute('height'); }
  }
  showBig(text, cls = '') {
    this.clearWidget();
    this.wbox.innerHTML = `<div class="bigcap ${cls}">${esc(text)}</div>`;
    const b = this.wbox.querySelector('.bigcap');
    const fit = () => {
      if (!b.isConnected) return;
      b.style.fontSize = '';
      let size = parseFloat(getComputedStyle(b).fontSize) || 100;
      const room = this.wbox.clientWidth - 24;
      while (b.scrollWidth > room && size > 30) { size -= 4; b.style.fontSize = `${size}px`; }
    };
    requestAnimationFrame(fit);
    setTimeout(fit, 120);
  }
  clearInputs() {
    this.inrow.replaceChildren();
    this.inrow.classList.remove('compact');
    if (this.pad) { this.pad.destroy(); this.pad = null; }
    this.el.querySelector('.padcol')?.remove();
    this.el.classList.remove('with-pad');
  }
  numpad(opts) {
    this.clearInputs();
    const col = document.createElement('div');
    col.className = 'padcol';
    this.el.appendChild(col);
    this.el.classList.add('with-pad');
    this.pad = new Numpad(col, opts);
    return this.pad;
  }
  // options: values or {label, value, art, widget, props}. Returns { buttons, find(value) }.
  choices(options, onPick) {
    this.clearInputs();
    // One text size for the whole set, so a longer (or shorter) answer never stands out.
    const longSet = options.some(o => String(optLabel(o) ?? '').length > 9);
    const btns = options.map(o => {
      const label = String(optLabel(o) ?? '');
      const b = h(`<button class="opt ${longSet ? 'long' : ''}" type="button"></button>`);
      if (o && typeof o === 'object' && o.art) b.insertAdjacentHTML('beforeend', `<span class="oart">${art(o.art, 72)}</span>`);
      if (o && typeof o === 'object' && o.widget) {
        const mini = h('<div class="mini"></div>');
        b.appendChild(mini);
        loadWidget(o.widget).then(m => { try { m.mount(mini, { ...(o.props || {}), readonly: true }, { readonly: true }); } catch (e) { console.warn(e); } }).catch(() => {});
      }
      if (label) b.insertAdjacentHTML('beforeend', `<span class="olabel">${esc(label)}</span>`);
      b.dataset.v = String(optVal(o));
      b.addEventListener('click', () => onPick(optVal(o), b));
      this.inrow.appendChild(b);
      return b;
    });
    const minis = options.filter(o => o && typeof o === 'object' && o.widget).length;
    this.inrow.classList.toggle('compact', minis >= 4 || (minis >= 3 && options.length >= 4));
    return { buttons: btns, find: v => btns.find(b => same(b.dataset.v, v)) };
  }
  // Tap tiles in order. onSubmit(arrayOfValues).
  order(options, onSubmit) {
    this.clearInputs();
    const picked = [];
    const btns = options.map(o => {
      const b = h(`<button class="opt" type="button">${esc(String(optLabel(o)))}</button>`);
      b.addEventListener('click', () => {
        const v = optVal(o);
        const at = picked.findIndex(x => same(x.v, v) && x.b === b);
        if (at >= 0) picked.splice(at, 1); else picked.push({ v, b });
        btns.forEach(x => { x.removeAttribute('data-n'); x.classList.remove('pick'); });
        picked.forEach((p, i) => { p.b.dataset.n = i + 1; p.b.classList.add('pick'); });
        sfx('click');
        if (picked.length === options.length) setTimeout(() => onSubmit(picked.map(p => p.v)), 250);
      });
      this.inrow.appendChild(b);
      return b;
    });
    return { buttons: btns, reset: () => { picked.length = 0; btns.forEach(x => { x.removeAttribute('data-n'); x.classList.remove('pick'); }); } };
  }
  button(label, onClick, cls = '') {
    const b = h(`<button class="btn big ${cls}" type="button">${esc(label)}</button>`);
    b.addEventListener('click', onClick);
    this.inrow.appendChild(b);
    return b;
  }
  destroy() { this.token++; this.clearInputs(); this.clearWidget(); }
}

export function lessonLayout(el) {
  el.innerHTML = `<div class="lesson"><div></div><div></div></div>`;
  const [t, c] = el.querySelectorAll('.lesson > div');
  return { tutor: new Tutor(t), con: new Console(c) };
}

export const crewScope = () => {
  const c = store.state.crew || { commander: 'Finn', engineer: 'Dad' };
  return { commander: c.commander, engineer: c.engineer };
};
