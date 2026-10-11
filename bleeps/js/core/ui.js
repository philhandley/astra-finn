// Shared UI helpers: speech, toasts, modals, celebration burst.
import { speak, stopSpeaking, canSpeak, sentences } from './speak.js';
import { store } from './store.js';
import { icon } from './icons.js';
import { h, esc } from './dom.js';

export { canSpeak, sentences };

let speakingBtn = null;
const speakListeners = new Set();
export const onSpeaking = fn => { speakListeners.add(fn); return () => speakListeners.delete(fn); };
const notify = on => speakListeners.forEach(fn => { try { fn(on); } catch (e) { /* ignore */ } });
let speakingNow = false;
export const isSpeaking = () => speakingNow;

// Speak text now. Resolves when speech ends (or straight away if speech is unavailable).
export function say(text, btn = null) {
  return new Promise(resolve => {
    const t = String(text || '').replace(/\s{2,}/g, ' ').trim();
    if (!t || !canSpeak) { resolve(); return; }
    if (speakingBtn && speakingBtn !== btn) speakingBtn.classList.remove('on');
    speakingBtn = btn;
    btn && btn.classList.add('on');
    speakingNow = true;
    notify(true);
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      btn && btn.classList.remove('on');
      if (speakingBtn === btn) speakingBtn = null;
      speakingNow = false;
      notify(false);
      resolve();
    };
    // Some speech engines never fire onend; never let a step wait forever.
    const guard = setTimeout(done, Math.min(16000, 1400 + t.length * 80));
    speak(t, { onend: done });
  });
}

// Speak only when automatic reading is on.
export function autoSay(text, btn = null) {
  if (!store.state.autoRead) return Promise.resolve();
  return say(text, btn);
}

export function hush() {
  stopSpeaking();
  if (speakingBtn) speakingBtn.classList.remove('on');
  speakingBtn = null;
  speakingNow = false;
  notify(false);
}

export function speakButton(getText, label = 'Read aloud') {
  const b = h(`<button class="speak-btn" type="button" aria-label="${esc(label)}" title="${esc(label)}">${icon('speaker')}</button>`);
  if (!canSpeak) b.style.display = 'none';
  b.addEventListener('click', e => {
    e.stopPropagation();
    if (b.classList.contains('on')) { hush(); return; }
    say(typeof getText === 'function' ? getText() : getText, b);
  });
  return b;
}

export function toast(text) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = h(`<div class="toast" role="status">${esc(text)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

export function modal(title, bodyEl, { wide = false, onClose } = {}) {
  const back = h(`<div class="modal-back" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal${wide ? ' wide' : ''}">
    <div class="modal-head"><h2>${esc(title)}</h2><button class="btn ghost round" type="button" aria-label="Close">${icon('close')}</button></div>
  </div></div>`);
  back.querySelector('.modal').appendChild(bodyEl);
  let closed = false;
  const close = () => { if (closed) return; closed = true; back.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  back.querySelector('.modal-head .btn').addEventListener('click', close);
  back.addEventListener('click', e => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  return close;
}

export function confirmBox(title, text, yes, no = 'Not now') {
  return new Promise(resolve => {
    const body = h(`<div class="col gap"><p class="lead">${esc(text)}</p>
      <div class="row gap"><button class="btn big yes" type="button">${esc(yes)}</button><button class="btn ghost big no" type="button">${esc(no)}</button></div></div>`);
    let done = false;
    const close = modal(title, body, { onClose: () => { if (!done) resolve(false); } });
    body.querySelector('.yes').addEventListener('click', () => { done = true; close(); resolve(true); });
    body.querySelector('.no').addEventListener('click', () => { done = true; close(); resolve(false); });
  });
}

// Confetti made of little pixel squares.
export function burst(host, originEl = null) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:50';
  const cs = getComputedStyle(host);
  if (cs.position === 'static') host.style.position = 'relative';
  host.appendChild(cv);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = host.clientWidth, H = host.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  let ox = W / 2, oy = H / 2;
  if (originEl) {
    const r = originEl.getBoundingClientRect(), hb = host.getBoundingClientRect();
    ox = r.left - hb.left + r.width / 2; oy = r.top - hb.top + r.height / 2;
  }
  const cols = ['#ff4f45', '#3b82f6', '#f5b400', '#8b5cf6', '#14b8a6', '#9bbc0f'];
  const parts = Array.from({ length: 80 }, () => { const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 8; return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, s: 5 + Math.random() * 7, c: cols[(Math.random() * cols.length) | 0], life: 1 }; });
  let raf;
  const tick = () => {
    g.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive++;
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.985; p.life -= 0.011;
      g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    if (alive) raf = requestAnimationFrame(tick); else cv.remove();
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); cv.remove(); };
}
