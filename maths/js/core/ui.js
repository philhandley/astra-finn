// Shared UI helpers: speech, toasts, modals, celebration burst.
import { speak, stopSpeaking, canSpeak, sayable } from './speak.js';
import { store } from './store.js';
import { icon } from './icons.js';
import { h, esc } from './dom.js';

export { canSpeak };

let speakingBtn = null;
let speakListeners = new Set();
export const onSpeaking = fn => { speakListeners.add(fn); return () => speakListeners.delete(fn); };
const notify = on => speakListeners.forEach(fn => { try { fn(on); } catch (e) { /* ignore */ } });

// Speak text now. Resolves when speech ends (or immediately if speech is unavailable).
export function say(text, btn = null) {
  return new Promise(resolve => {
    const t = sayable(text);
    if (!t || !canSpeak) { resolve(); return; }
    if (speakingBtn && speakingBtn !== btn) speakingBtn.classList.remove('on');
    speakingBtn = btn;
    btn && btn.classList.add('on');
    notify(true);
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      btn && btn.classList.remove('on');
      if (speakingBtn === btn) speakingBtn = null;
      notify(false);
      resolve();
    };
    // Some speech engines never fire onend; never let a lesson wait forever.
    const guard = setTimeout(done, Math.min(14000, 1200 + t.length * 75));
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
  notify(false);
}

export function speakButton(getText, label = 'Read aloud') {
  const b = h(`<button class="speak-btn" type="button" aria-label="${esc(label)}" title="${esc(label)}">${icon('speaker')}</button>`);
  if (!canSpeak) b.style.display = 'none';
  b.addEventListener('click', e => {
    e.stopPropagation();
    if (b.classList.contains('on')) { hush(); return; }
    say(getText(), b);
  });
  return b;
}

export function toast(text) {
  const t = h(`<div class="toast">${esc(text)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

export function modal(title, bodyEl, { wide = false, onClose } = {}) {
  const back = h(`<div class="modal-back" role="dialog" aria-modal="true"><div class="modal card"${wide ? ' style="width:min(1060px,100%)"' : ''}>
    <div class="headrow"><h2>${esc(title)}</h2><button class="btn ghost round" type="button" aria-label="Close">${icon('close')}</button></div>
  </div></div>`);
  back.querySelector('.modal').appendChild(bodyEl);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  back.querySelector('.headrow .btn').addEventListener('click', close);
  back.addEventListener('click', e => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  return close;
}

export function confirmBox(title, text, yes, no = 'Not now') {
  return new Promise(resolve => {
    const body = h(`<div style="display:flex;flex-direction:column;gap:18px"><p class="muted" style="font-size:22px;margin:0">${esc(text)}</p>
      <div class="mindrow"><button class="btn big yes" type="button">${esc(yes)}</button><button class="btn ghost big no" type="button">${esc(no)}</button></div></div>`);
    let done = false;
    const close = modal(title, body, { onClose: () => { if (!done) resolve(false); } });
    body.querySelector('.yes').addEventListener('click', () => { done = true; close(); resolve(true); });
    body.querySelector('.no').addEventListener('click', () => { done = true; close(); resolve(false); });
  });
}

export function burst(host, originEl = null) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5';
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
  const cols = ['#f2b544', '#ffd27a', '#5fd4ff', '#f3efe6', '#6fe3a5'];
  const parts = Array.from({ length: 90 }, () => { const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 7; return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, r: 1.5 + Math.random() * 3, c: cols[(Math.random() * cols.length) | 0], life: 1 }; });
  let raf;
  const tick = () => {
    g.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive++;
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.985; p.life -= 0.012;
      g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
    if (alive) raf = requestAnimationFrame(tick); else cv.remove();
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); cv.remove(); };
}

export function toggleBtn(on, iconOn, iconOff, label, onToggle) {
  const b = h(`<button class="btn ghost round" type="button" aria-label="${esc(label)}" aria-pressed="${on}" title="${esc(label)}">${icon(on ? iconOn : iconOff)}</button>`);
  if (on) b.style.color = 'var(--gold)';
  b.addEventListener('click', () => {
    on = !on;
    b.innerHTML = icon(on ? iconOn : iconOff);
    b.setAttribute('aria-pressed', on);
    b.style.color = on ? 'var(--gold)' : '';
    onToggle(on);
  });
  return b;
}
