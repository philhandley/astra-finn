// Read-aloud with the browser's speech synthesis, preferring a UK English voice.
const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;
let current = null;

function pickVoice() {
  if (!synth) return null;
  const voices = synth.getVoices();
  const tests = [
    v => /en[-_]GB/i.test(v.lang) && /(Google|Natural|Online|Neural|Enhanced|Premium)/i.test(v.name),
    v => /en[-_]GB/i.test(v.lang),
    v => /^en[-_](AU|IE|NZ)/i.test(v.lang),
    v => /^en/i.test(v.lang),
  ];
  for (const t of tests) {
    const v = voices.find(t);
    if (v) return v;
  }
  return null;
}

if (synth) {
  voice = pickVoice();
  synth.addEventListener?.('voiceschanged', () => { voice = pickVoice(); });
}

export const canSpeak = !!synth;

export function speak(text, { onend } = {}) {
  if (!synth || !text) { onend && onend(); return; }
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : 'en-GB';
    u.rate = 0.92;
    u.pitch = 1.02;
    let ended = false;
    const done = () => { if (ended) return; ended = true; if (current === u) current = null; onend && onend(); };
    u.onend = done;
    u.onerror = done;
    current = u;
    synth.speak(u);
  } catch (e) {
    onend && onend();
  }
}

export function stopSpeaking() {
  if (!synth) return;
  try { synth.cancel(); } catch (e) { /* ignore */ }
}

// Join parts into speakable text, adding full stops where needed.
export function sentences(...parts) {
  return parts
    .filter(Boolean)
    .map(p => String(p).trim())
    .map(p => (/[.!?:]$/.test(p) ? p : p + '.'))
    .join(' ');
}

// Turn maths text into English a speech engine reads well.
const FRAC_WORDS = {
  '1/2': 'a half', '1/3': 'a third', '2/3': 'two thirds', '1/4': 'a quarter', '2/4': 'two quarters', '3/4': 'three quarters',
  '1/5': 'a fifth', '1/10': 'a tenth', '4/4': 'four quarters', '2/2': 'two halves', '3/3': 'three thirds',
};
export function sayable(text) {
  let t = String(text ?? '');
  const VULGAR = { '½': 'a half', '¼': 'a quarter', '¾': 'three quarters', '⅓': 'a third', '⅔': 'two thirds' };
  t = t.replace(/(\d+)\s*([½¼¾⅓⅔])/g, (m, n, f) => `${n} and ${VULGAR[f]}`).replace(/[½¼¾⅓⅔]/g, f => VULGAR[f]);
  t = t.replace(/(\d+)\s*\/\s*(\d+)/g, (m, a, b) => FRAC_WORDS[`${a}/${b}`] || `${a} over ${b}`);
  t = t.replace(/£(\d+)\.(\d{2})/g, (m, p, q) => `${p} pound${p === '1' ? '' : 's'} ${+q}`);
  t = t.replace(/£(\d+)/g, (m, p) => `${p} pound${p === '1' ? '' : 's'}`);
  t = t.replace(/(\d+)p\b/g, '$1 p');
  const unit = word => (m, n) => `${n} ${word}${n === '1' ? '' : 's'}`;
  t = t.replace(/\b(\d+)\s*cm\b/g, unit('centimetre')).replace(/\b(\d+)\s*m\b/g, unit('metre')).replace(/\b(\d+)\s*kg\b/g, unit('kilogram'))
    .replace(/\b(\d+)\s*g\b/g, unit('gram')).replace(/\b(\d+)\s*ml\b/g, unit('millilitre')).replace(/\b(\d+)\s*l\b/g, unit('litre'))
    .replace(/(-?\d+)\s*°C/g, '$1 degrees');
  t = t.replace(/(\d{1,2}):(\d{2})/g, (m, hh, mm) => (mm === '00' ? `${hh} o'clock` : `${hh} ${mm}`));
  t = t.replace(/\s*×\s*/g, ' times ').replace(/\s*÷\s*/g, ' divided by ').replace(/\s*[−]\s*/g, ' minus ')
    .replace(/(\d)\s*-\s*(\d)/g, '$1 minus $2').replace(/\s*\+\s*/g, ' plus ').replace(/\s*=\s*/g, ' equals ')
    .replace(/\s*<\s*/g, ' is less than ').replace(/\s*>\s*/g, ' is greater than ');
  t = t.replace(/\?{1,}\s*$/, '?').replace(/\s\?\s/g, ' what ').replace(/^\?\s/, 'what ').replace(/\s\?$/, ' what?');
  t = t.replace(/[□_]+/g, ' what ');
  return t.replace(/\s{2,}/g, ' ').trim();
}
