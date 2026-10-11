// The Astra Bleeps sound chip, built on the Web Audio API and modelled on 1980s sound chips.
// Voices:
//   bleep  pulse wave from an 8-step table, like the NES and Game Boy (duty 12.5%, 25% or 50%)
//   hoot   4-bit stepped triangle from a 32-step table, like the NES triangle channel
//   buzz   stepped sawtooth (the Commodore 64's SID had one)
//   fizz   noise from a 15-bit LFSR, like the NES noise channel (long and short "metallic" modes)
//   crew   a 32-step drawn wave, like the Game Boy's wave channel
// Every voice goes through a channel bus (lead, chords, bass, drums, sfx), then a master gain,
// a compressor (so eight pads at once never clip) and an analyser that feeds the LCD scopes.

export const VOICES = ['bleep', 'hoot', 'buzz', 'fizz', 'crew'];
export const BUSES = ['lead', 'chords', 'bass', 'drums', 'sfx'];
const LEVEL = { bleep: 0.17, hoot: 0.36, buzz: 0.15, fizz: 0.24, crew: 0.22 };

let ac = null;
let out = null;
let volume = 0.8;
const live = new Set();
const waves = new Map();
let crewTable = defaultCrewTable();
let crewVersion = 0;

export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = m => NAMES[((m % 12) + 12) % 12];
export const noteLabel = m => noteName(m) + (Math.floor(m / 12) - 1);

/* ---------------- Context ---------------- */
export function ensure() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ac = new AC(); } catch (e2) { return null; } }
    build();
  }
  if (ac.state === 'suspended' && !document.hidden) ac.resume().catch(() => {});
  return ac;
}
export const ready = () => !!ac && ac.state === 'running';
export const now = () => (ac ? ac.currentTime : 0);
export const context = () => ac;
if (typeof window !== 'undefined' && /[?&]flow=1/.test(location.search)) window.__chipTime = () => (ac ? ac.currentTime.toFixed(2) + ' ' + ac.state : 'none');

// Android needs a user gesture before sound can start: unlock on the first touch anywhere.
if (typeof window !== 'undefined') {
  const unlock = () => { ensure(); };
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend().catch(() => {});
    else ac.resume().catch(() => {});
  });
}

function build() {
  const master = ac.createGain();
  master.gain.value = volume;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.18;
  const analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0;
  master.connect(comp);
  comp.connect(ac.destination);
  comp.connect(analyser);
  // Echo: a feedback delay with a low-pass filter, so each repeat is softer and duller.
  const echoIn = ac.createGain();
  const delay = ac.createDelay(1.0);
  delay.delayTime.value = 0.23;
  const fb = ac.createGain(); fb.gain.value = 0.4;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  const wet = ac.createGain(); wet.gain.value = 0.6;
  echoIn.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(master);
  const buses = {};
  for (const name of BUSES) {
    const duck = ac.createGain();
    const mute = ac.createGain();
    duck.connect(mute); mute.connect(master);
    buses[name] = { duck, mute };
  }
  out = { master, comp, analyser, echoIn, buses };
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (out) out.master.gain.setTargetAtTime(volume, ac.currentTime, 0.02);
}
export const analyser = () => (ensure() && out ? out.analyser : null);

/* ---------------- Channel buses ---------------- */
const busIn = name => out.buses[name] ? out.buses[name].duck : out.buses.sfx.duck;
export function muteBus(name, muted) {
  if (!ensure() || !out.buses[name]) return;
  out.buses[name].mute.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.01);
}
// A sound effect "borrows" a music channel: that channel goes quiet while the effect plays (as on the NES).
export function borrow(name, at, dur) {
  if (!ensure() || !out.buses[name]) return;
  const g = out.buses[name].duck.gain;
  g.cancelScheduledValues(at);
  g.setValueAtTime(0, at);
  g.setValueAtTime(1, at + dur);
}
export function unduckAll() {
  if (!out) return;
  for (const b of Object.values(out.buses)) { b.duck.gain.cancelScheduledValues(0); b.duck.gain.value = 1; }
}

/* ---------------- Wave tables ---------------- */
export function pulseTable(duty = 0.5) {
  const on = Math.max(1, Math.round(duty * 8));
  return Array.from({ length: 8 }, (_, i) => (i < on ? 1 : -1));
}
export const TRIANGLE_TABLE = Array.from({ length: 32 }, (_, i) => (i < 16 ? 15 - i : i - 16) / 7.5 - 1);
export const SAW_TABLE = Array.from({ length: 32 }, (_, i) => (i / 31) * 2 - 1);
function defaultCrewTable() {
  // A rounded "hill" until the crew draws their own.
  return Array.from({ length: 32 }, (_, i) => Math.round(Math.sin((i / 32) * Math.PI * 2) * 7) / 7);
}
export function noiseTable(n = 32, seed = 7) {
  let s = seed;
  return Array.from({ length: n }, () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return ((s >> 16) & 15) / 7.5 - 1; });
}

// One cycle of a voice's wave as an array of -1..1 values (for drawing on the LCD screens).
export function shape(voice, opts = {}) {
  switch (voice) {
    case 'bleep': return pulseTable(opts.duty ?? 0.5);
    case 'hoot': return TRIANGLE_TABLE;
    case 'buzz': return SAW_TABLE;
    case 'fizz': return noiseTable(32, opts.seed ?? 7);
    case 'crew': return opts.table || crewTable;
    default: return opts.table || TRIANGLE_TABLE;
  }
}

export function setCrewWave(table) {
  if (!Array.isArray(table) || table.length < 2) return;
  crewTable = table.map(v => Math.max(-1, Math.min(1, +v || 0)));
  crewVersion++;
}
export const crewWave = () => crewTable;

// Fourier series of a stepped (zero-order-hold) table, computed exactly, then a PeriodicWave.
// Keeping the steps gives the slightly gritty sound of a 4-bit chip.
function tableWave(key, table) {
  if (waves.has(key)) return waves.get(key);
  const L = table.length;
  const K = 160;
  const real = new Float32Array(K + 1);
  const imag = new Float32Array(K + 1);
  let mean = 0;
  for (const v of table) mean += v;
  mean /= L;
  for (let k = 1; k <= K; k++) {
    let re = 0, im = 0;
    for (let j = 0; j < L; j++) {
      const v = table[j] - mean;
      const a0 = (2 * Math.PI * k * j) / L, a1 = (2 * Math.PI * k * (j + 1)) / L;
      re += v * (Math.sin(a1) - Math.sin(a0));
      im += v * (Math.cos(a0) - Math.cos(a1));
    }
    real[k] = re / (Math.PI * k);
    imag[k] = im / (Math.PI * k);
  }
  const w = ac.createPeriodicWave(real, imag);
  if (waves.size > 60) waves.clear();
  waves.set(key, w);
  return w;
}

function waveFor(voice, o) {
  if (o.table) return tableWave('t:' + o.table.map(v => v.toFixed(2)).join(','), o.table);
  switch (voice) {
    case 'bleep': { const d = o.duty ?? 0.5; return tableWave('pulse' + d, pulseTable(d)); }
    case 'buzz': return tableWave('saw', SAW_TABLE);
    case 'crew': return tableWave('crew' + crewVersion, crewTable);
    case 'hoot':
    default: return tableWave('tri', TRIANGLE_TABLE);
  }
}

/* ---------------- Noise (NES-style LFSR) ---------------- */
const noiseBufs = {};
function noiseBuffer(short) {
  const key = short ? 'short' : 'long';
  if (noiseBufs[key]) return noiseBufs[key];
  const len = short ? 93 * 64 : 32767;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let reg = 1;
  for (let i = 0; i < len; i++) {
    const bit = (reg & 1) ^ ((reg >> (short ? 6 : 1)) & 1);
    reg = (reg >> 1) | (bit << 14);
    d[i] = (reg & 1) ? 0.9 : -0.9;
  }
  noiseBufs[key] = buf;
  return buf;
}
// Higher "notes" make brighter noise: midi 84 plays one LFSR step per sample.
const noiseRate = m => Math.max(0.01, Math.min(1, Math.pow(2, ((m ?? 84) - 84) / 12)));

/* ---------------- Envelopes and bookkeeping ---------------- */
function envelope(p, at, dur, peak, env = {}) {
  const A = env.a ?? 0.004, D = env.d ?? 0.09, S = env.s ?? 0.7, R = env.r ?? 0.07;
  p.setValueAtTime(0, at);
  p.linearRampToValueAtTime(peak, at + A);
  p.setTargetAtTime(peak * S, at + A, Math.max(0.005, D / 3));
  p.setTargetAtTime(0, at + dur, Math.max(0.004, R / 3));
  return at + dur + R * 2.2;
}
function track(src, gain, extra = []) {
  const item = { src, gain, extra };
  live.add(item);
  src.onended = () => { live.delete(item); try { gain.disconnect(); extra.forEach(n => n.disconnect()); } catch (e) { /* ignore */ } };
  return item;
}

// Silence everything now (leaving a screen, pressing Stop).
export function stopAll() {
  if (!ac) return;
  const t = ac.currentTime;
  for (const it of live) {
    try {
      it.gain.gain.cancelScheduledValues(t);
      it.gain.gain.setTargetAtTime(0, t, 0.01);
      it.src.stop(t + 0.06);
      it.extra.forEach(n => { try { n.stop && n.stop(t + 0.06); } catch (e) { /* ignore */ } });
    } catch (e) { /* ignore */ }
  }
  unduckAll();
}

/* ---------------- Notes ---------------- */
// o: { voice, midi | freq, to (midi to slide to), slideTime, at, dur, vol, duty, table,
//      wobble (0..2), arp ([semitones]), arpRate (s), echo (0..1), bus, env, short (noise mode), filter }
export function note(o = {}) {
  const a = ensure();
  if (!a) return null;
  const voice = o.voice || 'bleep';
  const at = Math.max(a.currentTime, o.at ?? a.currentTime);
  const dur = Math.max(0.03, o.dur ?? 0.25);
  if (voice === 'fizz') return noiseNote(o, at, dur);
  const osc = a.createOscillator();
  osc.setPeriodicWave(waveFor(voice, o));
  const f0 = o.freq ?? mtof(o.midi ?? 60);
  const f1 = o.to != null ? mtof(o.to) : f0;
  const st = Math.max(0.02, o.slideTime ?? dur);
  if (o.arp && o.arp.length) {
    // Stepped arpeggio ("sparkle"), at tracker speed, riding on any slide.
    const rate = o.arpRate || 1 / 30;
    let i = 0;
    for (let t = at; t < at + dur + 0.2; t += rate, i++) {
      const k = Math.min(1, (t - at) / st);
      const base = f0 * Math.pow(f1 / f0, k);
      osc.frequency.setValueAtTime(base * Math.pow(2, o.arp[i % o.arp.length] / 12), t);
    }
  } else {
    osc.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + st);
  }
  const g = a.createGain();
  const end = envelope(g.gain, at, dur, (o.vol ?? 1) * (LEVEL[voice] ?? 0.2), o.env);
  osc.connect(g);
  g.connect(busIn(o.bus || 'sfx'));
  const extra = [];
  if (o.wobble) {
    const lfo = a.createOscillator();
    lfo.frequency.value = o.wobbleRate || 6;
    const lg = a.createGain();
    lg.gain.setValueAtTime(0, at);
    lg.gain.linearRampToValueAtTime(Math.min(f0, f1) * 0.035 * o.wobble, at + Math.min(0.15, dur * 0.5));
    lfo.connect(lg); lg.connect(osc.frequency);
    lfo.start(at); lfo.stop(end);
    extra.push(lfo, lg);
  }
  if (o.echo) {
    const s = a.createGain(); s.gain.value = o.echo;
    g.connect(s); s.connect(out.echoIn);
    extra.push(s);
  }
  osc.start(at);
  osc.stop(end);
  track(osc, g, extra);
  return { at, end, stop: t => { try { g.gain.cancelScheduledValues(t ?? a.currentTime); g.gain.setTargetAtTime(0, t ?? a.currentTime, 0.01); osc.stop((t ?? a.currentTime) + 0.05); } catch (e) { /* ignore */ } } };
}

function noiseNote(o, at, dur) {
  const a = ac;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(!!o.short);
  src.loop = true;
  const r0 = noiseRate(o.midi);
  src.playbackRate.setValueAtTime(r0, at);
  if (o.to != null) src.playbackRate.exponentialRampToValueAtTime(noiseRate(o.to), at + Math.max(0.02, o.slideTime ?? dur));
  const g = a.createGain();
  const end = envelope(g.gain, at, dur, (o.vol ?? 1) * LEVEL.fizz, o.env || { a: 0.002, d: dur * 0.6, s: 0.35, r: 0.08 });
  let head = src;
  const extra = [];
  if (o.filter) {
    const f = a.createBiquadFilter();
    f.type = o.filter.type || 'highpass';
    f.frequency.value = o.filter.freq || 4000;
    f.Q.value = o.filter.q ?? 0.7;
    src.connect(f); head = f; extra.push(f);
  }
  head.connect(g);
  g.connect(busIn(o.bus || 'sfx'));
  if (o.wobble) {
    const lfo = a.createOscillator(); lfo.frequency.value = 7;
    const lg = a.createGain(); lg.gain.value = r0 * 0.25 * o.wobble;
    lfo.connect(lg); lg.connect(src.playbackRate); lfo.start(at); lfo.stop(end); extra.push(lfo, lg);
  }
  if (o.echo) { const s = a.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(out.echoIn); extra.push(s); }
  src.start(at, Math.random() * 0.3);
  src.stop(end);
  track(src, g, extra);
  return { at, end, stop: t => { try { src.stop((t ?? a.currentTime) + 0.03); } catch (e) { /* ignore */ } } };
}

/* ---------------- Drums (Fizz plays them) ---------------- */
export const DRUMS = ['boom', 'tap', 'tss', 'crash'];
export function drum(kind, at, { vol = 1, bus = 'drums', echo = 0 } = {}) {
  const a = ensure(); if (!a) return;
  const t = Math.max(a.currentTime, at ?? a.currentTime);
  switch (kind) {
    case 'boom': // big drum: a triangle that drops in pitch, plus a click
      slideFreq(t, 150, 42, 0.13, vol, bus);
      note({ voice: 'fizz', midi: 80, at: t, dur: 0.012, vol: 0.6 * vol, bus });
      break;
    case 'tap': // snare
      note({ voice: 'fizz', midi: 76, at: t, dur: 0.11, vol: 1.0 * vol, bus, echo, filter: { type: 'bandpass', freq: 1900, q: 0.6 }, env: { a: 0.001, d: 0.09, s: 0.2, r: 0.07 } });
      note({ voice: 'bleep', duty: 0.5, midi: 55, to: 45, at: t, dur: 0.05, vol: 0.55 * vol, bus, env: { a: 0.001, d: 0.04, s: 0.3, r: 0.03 } });
      break;
    case 'tss': // hi-hat
      note({ voice: 'fizz', midi: 86, at: t, dur: 0.03, vol: 0.7 * vol, bus, echo, filter: { type: 'highpass', freq: 6500 }, env: { a: 0.001, d: 0.03, s: 0.2, r: 0.03 } });
      break;
    case 'crash':
      note({ voice: 'fizz', midi: 82, at: t, dur: 0.5, vol: 0.9 * vol, bus, echo, filter: { type: 'highpass', freq: 2500 }, env: { a: 0.001, d: 0.3, s: 0.4, r: 0.4 } });
      break;
    default:
      note({ voice: 'fizz', midi: 70, at: t, dur: 0.1, vol, bus });
  }
}
function slideFreq(t, f0, f1, dur, vol, bus) {
  const osc = ac.createOscillator();
  osc.setPeriodicWave(waveFor('hoot', {}));
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  const end = envelope(g.gain, t, dur, 1.15 * vol * LEVEL.hoot, { a: 0.002, d: dur, s: 0.5, r: 0.06 });
  osc.connect(g); g.connect(busIn(bus));
  osc.start(t); osc.stop(end);
  track(osc, g);
}

/* ---------------- Sound-effect recipes ---------------- */
// r: { voice, from, to, len, fx: 'none'|'wobble'|'echo'|'sparkle', duty, notes: [midi...] }
// Returns how long the sound lasts (seconds).
export function sfx(r = {}, at, { bus = 'sfx', vol = 1 } = {}) {
  const a = ensure(); if (!a) return 0;
  const t = Math.max(a.currentTime, at ?? a.currentTime);
  const voice = r.voice || 'bleep';
  const len = Math.max(0.04, r.len ?? 0.25);
  const fx = r.fx || 'none';
  const common = { voice, duty: r.duty, bus, vol: vol * (r.vol ?? 1), wobble: fx === 'wobble' ? 1.6 : 0, echo: fx === 'echo' ? 0.65 : 0 };
  if (r.notes && r.notes.length) {
    const each = len / r.notes.length;
    r.notes.forEach((m, i) => note({ ...common, midi: m, at: t + i * each, dur: each * (i === r.notes.length - 1 ? 1.4 : 0.95), env: { a: 0.002, d: 0.06, s: 0.75, r: 0.05 }, arp: fx === 'sparkle' ? [0, 4, 7, 12] : null, arpRate: 0.035 }));
    return len * 1.1 + (fx === 'echo' ? 0.7 : 0);
  }
  const from = r.from ?? 72;
  const to = r.to ?? from;
  note({
    ...common, midi: from, to: to !== from ? to : undefined, at: t, dur: len,
    env: voice === 'fizz' ? { a: 0.002, d: len * 0.7, s: 0.3, r: 0.1 } : { a: 0.003, d: len * 0.6, s: 0.55, r: 0.06 },
    arp: fx === 'sparkle' ? [0, 4, 7, 12] : null, arpRate: 0.04,
  });
  return len + (fx === 'echo' ? 0.7 : 0.08);
}

// Each bot's "bonk" (Mission 1) and its signature hello.
export const BONKS = {
  bleep: { voice: 'bleep', duty: 0.5, from: 67, to: 55, len: 0.14 },
  hoot: { voice: 'hoot', from: 57, to: 40, len: 0.2 },
  buzz: { voice: 'buzz', from: 62, to: 50, len: 0.16 },
  fizz: { voice: 'fizz', from: 70, to: 52, len: 0.18 },
  crew: { voice: 'crew', from: 64, to: 52, len: 0.16 },
};
export const HELLOS = {
  bleep: { voice: 'bleep', duty: 0.5, notes: [72, 76, 79], len: 0.42 },
  hoot: { voice: 'hoot', notes: [67, 72], len: 0.6, fx: 'wobble' },
  buzz: { voice: 'buzz', from: 60, to: 67, len: 0.45, fx: 'wobble' },
  fizz: { voice: 'fizz', from: 84, to: 64, len: 0.55 },
  crew: { voice: 'crew', notes: [67, 71, 74, 79], len: 0.5 },
};
export const hello = (bot, at) => sfx(HELLOS[bot] || HELLOS.bleep, at);
