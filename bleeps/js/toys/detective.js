// Sound Detective (Mission 6, everyone). A listening game for one tablet.
// Round: the sound maker (Commander, then Co-pilot, taking turns) taps a secret sound while the others close
// their eyes; the cards flip over; then the detectives open their eyes and tap the card they think it was.
// The reveal is always warm: it plays the secret sound and names it. No score is ever kept.
// props: none.
// Done: after 2 rounds.
import { sfx, note, now, stopAll } from '../core/chip.js';
import { BOTS } from '../core/song.js';
import { h, esc, injectCSS } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { sticker } from '../core/stickers.js';
import { LAB_PRESETS, soundArt } from './lab.js';

const CARDS = ['jump', 'laser', 'coin', 'crash'].map(id => LAB_PRESETS.find(p => p.id === id));
const ROLE_COL = { commander: '#fff1c7', copilot: '#fde0ef', everyone: '#e6f6ee' };

const CSS = `
.t-detective { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 18px; padding: 16px 24px 20px; }
.t-detective .dt-banner {
  flex: none; display: flex; align-items: center; gap: 16px; min-height: 92px; padding: 10px 20px 10px 14px;
  background: var(--bannerbg, var(--card)); border: 3px solid var(--edge); border-radius: 22px; box-shadow: var(--pop); transition: background .3s;
}
.t-detective .dt-banner .pic { width: 66px; height: 66px; flex: none; }
.t-detective .dt-banner .pic svg { width: 100%; height: 100%; }
.t-detective .dt-banner .txt { flex: 1; min-width: 0; font-size: 28px; font-weight: 800; line-height: 1.2; }
.t-detective .dt-banner .txt b { color: var(--a); }
.t-detective .dt-cards { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; }
.t-detective .dt-card { position: relative; min-width: 0; min-height: 0; padding: 0; border: 0; background: none; cursor: pointer; perspective: 1100px; touch-action: manipulation; font-family: var(--font); }
.t-detective .dt-inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .5s cubic-bezier(.3,1.3,.5,1); transition-delay: var(--d, 0s); }
.t-detective .dt-card.back .dt-inner { transform: rotateY(180deg); }
.t-detective .dt-face {
  position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border: 3px solid var(--edge); border-radius: 26px;
  box-shadow: var(--pop); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6%; padding: 8% 6%;
}
.t-detective .dt-front { background: var(--soft); }
.t-detective .dt-front .art { width: 70%; max-width: 190px; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
.t-detective .dt-front .art svg { width: 100%; height: 100%; max-height: 190px; }
.t-detective .dt-front .nm { flex: none; font-size: 30px; font-weight: 800; color: var(--ink); line-height: 1; }
.t-detective .dt-front::before { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 12px; border-radius: 0 0 23px 23px; background: var(--col); }
.t-detective .dt-back { transform: rotateY(180deg); background: var(--lcd); border-color: var(--edge); box-shadow: var(--pop), inset 0 0 0 10px var(--bezel); }
.t-detective .dt-back .q { font-family: var(--pixel); font-size: 76px; color: var(--lcd-ink); line-height: 1; }
.t-detective .dt-card.press .dt-face { box-shadow: 1px 2px 0 var(--edge); }
.t-detective .dt-card.press .dt-inner { transform: translateY(4px); }
.t-detective .dt-card.back.press .dt-inner { transform: rotateY(180deg) translateY(4px); }
.t-detective .dt-card.picked .dt-front { box-shadow: var(--pop), inset 0 0 0 5px var(--ink); }
.t-detective .dt-card.secret .dt-front { outline: 8px solid var(--go); outline-offset: 4px; }
.t-detective .dt-card.dim .dt-front { opacity: .55; }
.t-detective .dt-card.spin .dt-inner { animation: dtSpin .7s cubic-bezier(.3,1.2,.5,1); }
@keyframes dtSpin { from { transform: rotateY(-360deg) scale(.9); } to { transform: rotateY(0) scale(1); } }
.t-detective .dt-actions { flex: none; min-height: 84px; display: flex; align-items: center; justify-content: center; gap: 18px; }
.t-detective .dt-actions .hint { font-size: 21px; color: var(--ink-2); font-weight: 600; }
@media (max-width: 900px) {
  .t-detective { padding: 12px 14px 16px; gap: 14px; }
  .t-detective .dt-cards { gap: 14px; }
  .t-detective .dt-front .nm { font-size: 24px; }
  .t-detective .dt-banner .txt { font-size: 24px; }
  .t-detective .dt-back .q { font-size: 56px; }
}
@media (max-height: 640px) {
  .t-detective { gap: 14px; padding-top: 12px; padding-bottom: 14px; }
  .t-detective .dt-banner { min-height: 80px; }
  .t-detective .dt-banner .pic { width: 56px; height: 56px; }
  .t-detective .dt-banner .txt { font-size: 25px; }
  .t-detective .dt-actions { min-height: 80px; }
  .t-detective .dt-front .nm { font-size: 26px; }
}
`;

export function mount(el, props = {}, api) {
  injectCSS('t-detective', CSS);
  const crew = api.crew || {};
  const nameOf = r => crew[r] || (r === 'commander' ? 'Commander' : r === 'copilot' ? 'Co-pilot' : 'Sound Engineer');
  const vars = c => `--col:${BOTS[c].col};--soft:${BOTS[c].soft}`;

  const root = h(`<div class="t-detective">
    <div class="dt-banner" role="status" aria-live="polite"><span class="pic"></span><div class="txt"></div></div>
    <div class="dt-cards">${CARDS.map((c, i) => `<button class="dt-card" type="button" data-i="${i}" style="${vars(c.col)};--d:${(i * 0.06).toFixed(2)}s" aria-label="${esc(c.name)}">
      <span class="dt-inner">
        <span class="dt-face dt-front"><span class="art">${soundArt(c.art)}</span><span class="nm">${esc(c.name)}</span></span>
        <span class="dt-face dt-back" aria-hidden="true"><span class="q">?</span></span>
      </span></button>`).join('')}</div>
    <div class="dt-actions"></div>
  </div>`);
  el.appendChild(root);

  const banner = root.querySelector('.dt-banner');
  const bannerPic = banner.querySelector('.pic');
  const bannerTxt = banner.querySelector('.txt');
  const cards = [...root.querySelectorAll('.dt-card')];
  const actions = root.querySelector('.dt-actions');
  const timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

  let round = 0;             // rounds finished
  let maker = 'commander';   // who makes the secret sound this round
  let phase = 'make';        // make | hidden | guess | reveal
  let secret = -1;
  let finished = false;
  const other = r => (r === 'commander' ? 'copilot' : 'commander');

  function play(i) {
    try { return sfx(CARDS[i].r) || 0; } catch (e) { return 0; }
  }
  function setBanner(pic, html, bg) {
    bannerPic.innerHTML = sticker(pic);
    bannerTxt.innerHTML = html;
    banner.style.setProperty('--bannerbg', bg || 'var(--card)');
  }
  function setActions(html) {
    actions.innerHTML = html;
  }
  const flipAll = back => cards.forEach(c => c.classList.toggle('back', back));
  const clearMarks = () => cards.forEach(c => c.classList.remove('secret', 'dim', 'picked', 'spin'));

  // Phase 1: the sound maker taps a secret sound while the detectives close their eyes.
  function startMake(first = false) {
    phase = 'make';
    secret = -1;
    clearMarks();
    flipAll(false);
    const m = nameOf(maker);
    setBanner('sleep', `Detectives, close your eyes! <b>${esc(m)}</b>, tap a secret sound.`, ROLE_COL[maker]);
    setActions(`<span class="hint">Shh... no peeking!</span>`);
    if (api.setWho) api.setWho(maker);
    const line = `Detectives, close your eyes! ${m}, tap a secret sound.`;
    if (first) timers.push(startLine(props, api, line)); else api.say(line);
  }

  // The secret is chosen: hide the cards, play the sound, then wake the detectives.
  function choose(i) {
    secret = i;
    phase = 'hidden';
    const len = play(i);
    flipAll(true);
    setBanner('ear', 'Listen carefully...', 'var(--card)');
    setActions('');
    later(startGuess, Math.max(1900, len * 1000 + 1100));
  }

  // Phase 2: the detectives open their eyes and guess.
  function startGuess() {
    phase = 'guess';
    flipAll(false);
    const d = other(maker);
    setBanner('eyes', 'Open your eyes! Which sound was it?', ROLE_COL.everyone);
    setActions(`<button class="btn big dt-again" type="button">${icon('speaker')}<span>Hear it again</span></button>`);
    press(actions.querySelector('.dt-again'), e => { flash(e.currentTarget, 'press', 120); play(secret); });
    if (api.setWho) api.setWho(d, `Detectives: ${nameOf(d)} and ${nameOf('engineer')}`);
    api.say('Open your eyes! Which sound was it?');
  }

  function guess(i) {
    phase = 'reveal';
    cards[i].classList.add('picked');
    try { note({ voice: 'bleep', duty: 0.5, midi: 84, dur: 0.05, vol: 0.5 }); } catch (e) { /* no sound */ }
    later(() => reveal(i), 380);
  }

  // The reveal: always warm, whatever the guess.
  function reveal(i) {
    const c = CARDS[secret];
    const match = i === secret;
    cards.forEach((card, k) => {
      card.classList.toggle('secret', k === secret);
      card.classList.toggle('dim', k !== secret);
      card.classList.remove('picked');
    });
    cards[secret].classList.add('spin');
    const len = play(secret);
    const text = match ? `Yes, good listening! It was the ${c.name}!` : `Ooh, it was the ${c.name}! Listen...`;
    setBanner(match ? 'happy' : 'ear', esc(text), match ? ROLE_COL.everyone : 'var(--card)');
    later(() => api.say(text), Math.min(900, len * 1000 + 150));
    round++;
    if (!finished && round >= 2) { finished = true; api.done(); }
    if (api.setWho) api.setWho('everyone');
    setActions(`<button class="btn go big dt-next" type="button">${icon('next')}<span>Next round</span></button>`);
    press(actions.querySelector('.dt-next'), () => {
      try { const t0 = now(); note({ voice: 'bleep', duty: 0.25, midi: 76, at: t0, dur: 0.06 }); note({ voice: 'bleep', duty: 0.25, midi: 83, at: t0 + 0.08, dur: 0.09 }); } catch (e) { /* no sound */ }
      maker = other(maker);
      startMake();
    });
  }

  cards.forEach((card, i) => press(card, () => {
    flash(card, 'press', 130);
    if (phase === 'make') choose(i);
    else if (phase === 'guess') guess(i);
    else if (phase === 'reveal') play(i);   // after the reveal, any card can be heard to compare
  }));

  startMake(true);

  return {
    destroy() {
      timers.forEach(t => clearTimeout(t));
      try { stopAll(); } catch (e) { /* ignore */ }
      root.remove();
    },
  };
}

/* ---------- small helpers (local to this toy) ---------- */
function press(el, fn) {
  el.addEventListener('pointerdown', e => { if (e.button > 0) return; fn(e); });
  el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); fn(e); } });
}
function flash(el, cls, ms) {
  if (!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  clearTimeout(el._fl); el._fl = setTimeout(() => el.classList.remove(cls), ms);
}
function startLine(props, api, text) {
  const intro = props && props.step ? String(props.step.intro || props.step.title || '') : '';
  if (!intro) { api.say(text); return 0; }
  return setTimeout(() => api.say(text), Math.min(9000, 900 + intro.length * 72));
}
