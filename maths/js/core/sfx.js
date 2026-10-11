// Tiny synthesised sound effects. Silent unless sound is switched on in the store.
import { store } from './store.js';

let ac = null;
function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

function tone(freq, dur, { type = 'sine', vol = 0.15, slide = 0, delay = 0 } = {}) {
  const a = ctx(); if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  pew: () => tone(1200, 0.18, { type: 'square', vol: 0.06, slide: -900 }),
  pop: () => tone(520, 0.08, { type: 'sine', vol: 0.12, slide: 200 }),
  click: () => tone(900, 0.04, { type: 'triangle', vol: 0.08 }),
  tick: () => tone(1500, 0.03, { type: 'square', vol: 0.03 }),
  chime: () => { tone(784, 0.25, { vol: 0.1 }); tone(1046, 0.35, { vol: 0.1, delay: 0.09 }); tone(1318, 0.5, { vol: 0.08, delay: 0.18 }); },
  whoosh: () => tone(300, 0.35, { type: 'sawtooth', vol: 0.04, slide: 600 }),
  clunk: () => { tone(140, 0.18, { type: 'square', vol: 0.12, slide: -60 }); tone(90, 0.25, { vol: 0.15, delay: 0.03 }); },
  boom: () => tone(80, 0.5, { type: 'sawtooth', vol: 0.12, slide: -50 }),
};

export function sfx(name) {
  try { if (!store.state.sound) return; (SOUNDS[name] || SOUNDS.click)(); } catch (e) { /* ignore */ }
}
