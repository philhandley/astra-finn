// Songs: scales, note colours, chords, speeds, the song model, scheduling a step, demo songs.
import { note, drum, mtof, noteName } from './chip.js';

/* ---------------- Notes and scales ---------------- */
// Classroom Boomwhacker colours: C red, D orange, E yellow, F lime, G green, A purple, B pink.
export const NOTE_COL = { C: '#e8352e', D: '#f7882f', E: '#f6c81e', F: '#9acd32', G: '#1fa35c', A: '#7b4fd6', B: '#e2459a' };
export const NOTE_WORD = { C: 'red', D: 'orange', E: 'yellow', F: 'lime', G: 'green', A: 'purple', B: 'pink' };
export const colourOf = midi => NOTE_COL[noteName(midi)] || '#888';

// "Magic notes" = C pentatonic (no wrong notes). "All notes" = C major.
export const SCALES = {
  magic: { name: 'Magic notes', steps: [0, 2, 4, 7, 9] },
  all: { name: 'All notes', steps: [0, 2, 4, 5, 7, 9, 11] },
};
// Row 0 is the lowest note.
export function scaleNotes(scale = 'magic', count = 5, base = 60) {
  const st = (SCALES[scale] || SCALES.magic).steps;
  return Array.from({ length: count }, (_, i) => base + 12 * Math.floor(i / st.length) + st[i % st.length]);
}

/* ---------------- Chords ---------------- */
// Friendly names for the C major chords. Intervals from the root.
export const CHORDS = {
  home: { name: 'Home', sym: 'C', root: 48, iv: [0, 4, 7], col: '#f6c81e', ink: '#5a4300', icon: 'house', mood: 'happy' },
  sunny: { name: 'Sunny', sym: 'F', root: 53, iv: [0, 4, 7], col: '#f7882f', ink: '#5a2a00', icon: 'sun', mood: 'happy' },
  ready: { name: 'Ready', sym: 'G', root: 55, iv: [0, 4, 7], col: '#1fa35c', ink: '#ffffff', icon: 'rocket', mood: 'happy' },
  rainy: { name: 'Rainy', sym: 'Am', root: 57, iv: [0, 3, 7], col: '#3b82f6', ink: '#ffffff', icon: 'cloud', mood: 'sad' },
  dreamy: { name: 'Dreamy', sym: 'Em', root: 52, iv: [0, 3, 7], col: '#7b4fd6', ink: '#ffffff', icon: 'moon', mood: 'sad' },
  cloudy: { name: 'Cloudy', sym: 'Dm', root: 50, iv: [0, 3, 7], col: '#64748b', ink: '#ffffff', icon: 'cloud', mood: 'sad' },
};
export const CHORD_KEYS = ['home', 'sunny', 'ready', 'rainy', 'dreamy', 'cloudy'];
export const STARTER_CHORDS = ['home', 'sunny', 'ready', 'rainy'];

/* ---------------- Speeds ---------------- */
export const SPEEDS = [
  { id: 'snail', name: 'Snail', bpm: 70 },
  { id: 'tortoise', name: 'Tortoise', bpm: 90 },
  { id: 'cat', name: 'Cat', bpm: 110 },
  { id: 'hare', name: 'Hare', bpm: 130 },
  { id: 'rocket', name: 'Rocket', bpm: 155 },
];
export const speedIndex = id => Math.max(0, SPEEDS.findIndex(s => s.id === id));

/* ---------------- Robots (instruments) ---------------- */
export const BOTS = {
  bleep: { name: 'Bleep', wave: 'square', col: '#ff4f45', dark: '#c4271f', soft: '#ffe1de', words: 'beepy' },
  hoot: { name: 'Hoot', wave: 'triangle', col: '#3b82f6', dark: '#1d56c9', soft: '#dde9ff', words: 'soft' },
  buzz: { name: 'Buzz', wave: 'sawtooth', col: '#f5b400', dark: '#b07e00', soft: '#fff1c7', words: 'buzzy' },
  fizz: { name: 'Fizz', wave: 'noise', col: '#8b5cf6', dark: '#6232d9', soft: '#ece4ff', words: 'hissy' },
  crew: { name: 'Our Bot', wave: 'our own wave', col: '#14b8a6', dark: '#0b7f73', soft: '#d5f5f1', words: 'our own' },
};
export const TUNE_BOTS = ['bleep', 'hoot', 'buzz', 'crew'];
export const DRUM_KINDS = ['boom', 'tap', 'tss'];
export const DRUM_INFO = {
  boom: { name: 'Boom', what: 'big drum' },
  tap: { name: 'Tap', what: 'snare drum' },
  tss: { name: 'Tss', what: 'hi-hat' },
};

/* ---------------- The song model ---------------- */
// mode 'tiny': 8 steps, 5 magic notes, drums boom and tss, each step a beat (for the Co-pilot).
// mode 'big': 16 steps a page (each an eighth note), up to 4 pages, 8 notes, 3 drums, a chord every 4 steps.
export const PAGE = 16;
export const MAX_PAGES = 4;
let idn = 0;
export const newId = () => 's' + Date.now().toString(36) + (idn++).toString(36);

export function emptySong(mode = 'big', extra = {}) {
  const tiny = mode === 'tiny';
  return {
    v: 1, id: newId(), name: '', mode,
    scale: 'magic', rows: tiny ? 5 : 8, pages: 1, speed: tiny ? 'cat' : 'cat',
    lead: tiny ? 'bleep' : 'bleep', duty: 0.5,
    notes: [], drums: [], chords: [],
    mute: { lead: false, chords: false, bass: false, drums: false },
    fx: { wobble: false, echo: false },
    pageSpeed: [null, null, null, null],
    cover: { col: '#ff4f45', sticker: 'star' },
    ...extra,
  };
}

export const stepsOf = song => (song.mode === 'tiny' ? 8 : PAGE * Math.max(1, Math.min(MAX_PAGES, song.pages || 1)));
export const rowNotes = song => scaleNotes(song.scale, song.rows || (song.mode === 'tiny' ? 5 : 8), 60);
export function stepDur(song, step = 0) {
  const page = Math.floor(step / PAGE);
  const sp = SPEEDS[speedIndex((song.pageSpeed && song.pageSpeed[page]) || song.speed)];
  return song.mode === 'tiny' ? 60 / sp.bpm : 30 / sp.bpm;
}
export const songLength = song => { let t = 0; const n = stepsOf(song); for (let i = 0; i < n; i++) t += stepDur(song, i); return t; };

// Notes are [step, row, len]; drums are [step, kindIndex].
export function noteAt(song, step, row) { return song.notes.find(n => n[1] === row && step >= n[0] && step < n[0] + (n[2] || 1)); }

// Schedule everything that starts on this step.
export function scheduleStep(song, step, t, dur, opt = {}) {
  const rows = rowNotes(song);
  const m = song.mute || {};
  const tiny = song.mode === 'tiny';
  if (!m.lead) {
    for (const n of song.notes) {
      if (n[0] !== step) continue;
      const len = n[2] || 1;
      let d = 0; for (let i = 0; i < len; i++) d += stepDur(song, step + i);
      note({
        voice: song.lead || 'bleep', midi: rows[n[1]], at: t, dur: d * (tiny ? 0.8 : 0.9), duty: song.duty ?? 0.5,
        bus: opt.leadBus || 'lead', vol: 0.95, wobble: song.fx?.wobble ? 0.7 : 0, echo: song.fx?.echo ? 0.35 : 0,
      });
    }
  }
  if (!m.drums) {
    for (const d of song.drums) if (d[0] === step) drum(DRUM_KINDS[d[1]] || 'boom', t, { vol: tiny ? 0.9 : 0.8 });
  }
  if (!tiny && song.chords && step % 4 === 0) {
    const key = song.chords[Math.floor(step / 4)];
    const c = CHORDS[key];
    if (c) {
      let d = 0; for (let i = 0; i < 4; i++) d += stepDur(song, step + i);
      if (!m.chords) note({ voice: 'bleep', duty: 0.25, midi: c.root + 12, arp: c.iv.concat(c.iv[0] + 12), arpRate: 1 / 24, at: t, dur: d * 0.96, vol: 0.42, bus: 'chords', env: { a: 0.003, d: 0.2, s: 0.65, r: 0.05 } });
      if (!m.bass) {
        const q = stepDur(song, step);
        note({ voice: 'hoot', midi: c.root - 12, at: t, dur: q * 1.7, vol: 0.95, bus: 'bass' });
        note({ voice: 'hoot', midi: c.root - 12 + 7, at: t + q * 2, dur: q * 1.6, vol: 0.85, bus: 'bass' });
      }
    }
  }
}

// What a step "plays" as text, for the tracker view.
export function trackerRow(song, step) {
  const rows = rowNotes(song);
  const lead = song.notes.filter(n => n[0] === step).map(n => rows[n[1]]).sort((a, b) => b - a);
  const held = song.notes.some(n => step > n[0] && step < n[0] + (n[2] || 1));
  const drums = song.drums.filter(d => d[0] === step).map(d => DRUM_KINDS[d[1]]);
  const chord = step % 4 === 0 ? song.chords?.[Math.floor(step / 4)] : null;
  return { lead, held, drums, chord };
}

/* ---------------- Copying and checking ---------------- */
export function cleanSong(s) {
  const base = emptySong(s && s.mode === 'tiny' ? 'tiny' : 'big');
  const out = { ...base, ...(s || {}) };
  out.mute = { ...base.mute, ...(s?.mute || {}) };
  out.fx = { ...base.fx, ...(s?.fx || {}) };
  out.cover = { ...base.cover, ...(s?.cover || {}) };
  out.notes = (s?.notes || []).filter(n => Array.isArray(n) && n.length >= 2).map(n => [n[0] | 0, n[1] | 0, Math.max(1, n[2] | 0 || 1)]);
  out.drums = (s?.drums || []).filter(d => Array.isArray(d) && d.length >= 2).map(d => [d[0] | 0, d[1] | 0]);
  out.chords = Array.isArray(s?.chords) ? s.chords.slice(0, 16) : [];
  out.pageSpeed = Array.isArray(s?.pageSpeed) ? s.pageSpeed.slice(0, 4) : [null, null, null, null];
  return out;
}
export const copySong = s => cleanSong(JSON.parse(JSON.stringify(s)));

/* ---------------- Demo songs ---------------- */
// Helper: build notes from a list of [step, midi, len] using the song's rows.
function N(song, list) {
  const rows = rowNotes(song);
  song.notes = list.map(([s, m, l]) => {
    const r = rows.indexOf(m);
    if (r < 0) console.warn('demo note not in scale', song.name, m);
    return [s, Math.max(0, r), l || 1];
  });
  return song;
}
const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76;
// A standard beat for one page: boom on 1 and 3, tap on 2 and 4, tss on every beat.
function beatPages(pages, { tss = 2 } = {}) {
  const out = [];
  for (let p = 0; p < pages; p++) {
    const o = p * PAGE;
    out.push([o, 0], [o + 8, 0], [o + 4, 1], [o + 12, 1]);
    for (let i = 0; i < PAGE; i += tss) out.push([o + i, 2]);
  }
  return out;
}

export function demoSongs() {
  const list = [];

  // Moon Run Theme (original): I-vi-IV-V, magic notes, quick.
  const moon = emptySong('big', { id: 'demo-moonrun', name: 'Moon Run Theme', demo: true, pages: 2, speed: 'hare', lead: 'bleep', duty: 0.5, cover: { col: '#1d56c9', sticker: 'moon' } });
  N(moon, [
    [0, G4], [1, C5], [2, E5, 2], [4, D5], [5, C5], [6, A4, 2], [8, A4], [9, C5], [10, A4], [11, G4], [12, G4, 2], [14, D5, 2],
    [16, E5], [17, D5], [18, C5, 2], [20, A4], [21, C5], [22, E5, 2], [24, D5], [25, C5], [26, A4], [27, C5], [28, D5, 4],
  ]);
  moon.chords = ['home', 'rainy', 'sunny', 'ready', 'home', 'rainy', 'sunny', 'ready'];
  moon.drums = beatPages(2);
  list.push(moon);

  // Robot Dance (original): minor and bouncy.
  const robot = emptySong('big', { id: 'demo-robot', name: 'Robot Dance', demo: true, pages: 1, speed: 'cat', lead: 'buzz', cover: { col: '#f5b400', sticker: 'robot' } });
  N(robot, [[0, A4], [2, C5], [3, A4], [4, E5, 2], [6, D5], [7, C5], [8, A4], [10, C5], [11, D5], [12, D5, 2], [14, G4, 2]]);
  robot.chords = ['rainy', 'rainy', 'sunny', 'ready'];
  robot.drums = [[0, 0], [3, 0], [8, 0], [11, 0], [4, 1], [12, 1], [2, 2], [6, 2], [10, 2], [14, 2], [15, 2]];
  robot.fx = { wobble: false, echo: true };
  list.push(robot);

  // Twinkle Twinkle Little Star (traditional, public domain). Quarter notes = 2 steps.
  const tw = emptySong('big', { id: 'demo-twinkle', name: 'Twinkle Twinkle', demo: true, scale: 'all', pages: 4, speed: 'tortoise', lead: 'hoot', cover: { col: '#7b4fd6', sticker: 'star' } });
  const phrase = (o, ns) => ns.map((m, i) => [o + i * 2, m, i === 6 ? 4 : 2]).slice(0, 7);
  N(tw, [
    ...phrase(0, [C4, C4, G4, G4, A4, A4, G4]),
    ...phrase(16, [F4, F4, E4, E4, D4, D4, C4]),
    ...phrase(32, [G4, G4, F4, F4, E4, E4, D4]),
    ...phrase(48, [F4, F4, E4, E4, D4, D4, C4]),
  ]);
  tw.chords = ['home', 'home', 'sunny', 'home', 'sunny', 'home', 'ready', 'home', 'home', 'ready', 'home', 'ready', 'sunny', 'home', 'ready', 'home'];
  tw.drums = beatPages(4, { tss: 4 });
  list.push(tw);

  // Mary Had a Little Lamb (traditional, public domain).
  const mary = emptySong('big', { id: 'demo-mary', name: 'Mary Had a Little Lamb', demo: true, scale: 'all', pages: 4, speed: 'cat', lead: 'bleep', duty: 0.25, cover: { col: '#1fa35c', sticker: 'heart' } });
  const q = (o, ns) => { const out = []; let s = o; for (const [m, l] of ns) { if (m) out.push([s, m, l]); s += l; } return out; };
  N(mary, [
    ...q(0, [[E4, 2], [D4, 2], [C4, 2], [D4, 2], [E4, 2], [E4, 2], [E4, 4]]),
    ...q(16, [[D4, 2], [D4, 2], [D4, 4], [E4, 2], [G4, 2], [G4, 4]]),
    ...q(32, [[E4, 2], [D4, 2], [C4, 2], [D4, 2], [E4, 2], [E4, 2], [E4, 2], [E4, 2]]),
    ...q(48, [[D4, 2], [D4, 2], [E4, 2], [D4, 2], [C4, 8]]),
  ]);
  mary.chords = ['home', 'home', 'home', 'home', 'ready', 'ready', 'home', 'home', 'home', 'home', 'home', 'home', 'ready', 'ready', 'home', 'home'];
  mary.drums = beatPages(4, { tss: 4 });
  list.push(mary);

  // Ode to Joy (Beethoven, public domain).
  const ode = emptySong('big', { id: 'demo-ode', name: 'Ode to Joy', demo: true, scale: 'all', pages: 4, speed: 'cat', lead: 'bleep', duty: 0.5, cover: { col: '#ff4f45', sticker: 'note' } });
  N(ode, [
    ...q(0, [[E4, 2], [E4, 2], [F4, 2], [G4, 2], [G4, 2], [F4, 2], [E4, 2], [D4, 2]]),
    ...q(16, [[C4, 2], [C4, 2], [D4, 2], [E4, 2], [E4, 3], [D4, 1], [D4, 4]]),
    ...q(32, [[E4, 2], [E4, 2], [F4, 2], [G4, 2], [G4, 2], [F4, 2], [E4, 2], [D4, 2]]),
    ...q(48, [[C4, 2], [C4, 2], [D4, 2], [E4, 2], [D4, 3], [C4, 1], [C4, 4]]),
  ]);
  ode.chords = ['home', 'home', 'ready', 'ready', 'home', 'home', 'ready', 'ready', 'home', 'home', 'ready', 'ready', 'home', 'home', 'ready', 'home'];
  ode.drums = beatPages(4);
  list.push(ode);

  // A Tiny-mode example for the Co-pilot.
  const tiny = emptySong('tiny', { id: 'demo-tiny', name: 'Little Bleeps', demo: true, lead: 'hoot', cover: { col: '#e2459a', sticker: 'heart' } });
  tiny.notes = [[0, 0, 1], [1, 2, 1], [2, 4, 1], [3, 2, 1], [4, 3, 1], [5, 1, 1], [6, 0, 1]];
  tiny.drums = [[0, 0], [2, 0], [4, 0], [6, 0], [1, 2], [3, 2], [5, 2], [7, 2]];
  list.push(tiny);

  return list;
}

/* ---------------- The Moon Run sound kit ---------------- */
export const KIT_SLOTS = [
  { id: 'bump', name: 'Bump', mission: 'm1' },
  { id: 'wave', name: 'Our Bot', mission: 'm2' },
  { id: 'star', name: 'Star', mission: 'm3' },
  { id: 'beat', name: 'Beat', mission: 'm4' },
  { id: 'win', name: 'Win tune', mission: 'm5' },
  { id: 'jump', name: 'Jump', mission: 'm6' },
  { id: 'chords', name: 'Chords', mission: 'm7' },
  { id: 'music', name: 'Music', mission: 'm8' },
];
// Used when a slot is still empty, so Moon Run always works (Mission 1 starts it silent on purpose).
export const KIT_DEFAULTS = {
  bump: { voice: 'hoot', from: 57, to: 40, len: 0.2 },
  star: { voice: 'bleep', duty: 0.5, notes: [83, 88], len: 0.22 },
  jump: { voice: 'bleep', duty: 0.25, from: 62, to: 79, len: 0.2 },
  beat: [[0, 0], [4, 1], [2, 2], [6, 2]],
  speed: 'cat',
  chords: ['home', 'rainy', 'sunny', 'ready'],
  channel: 'borrow',
};
export { mtof };
