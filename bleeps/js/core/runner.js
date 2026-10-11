// Mission runner: one step at a time, with a top bar, a stage and a bottom bar.
// Step types: story, guess, question (Big Question), toy, move, make, game, athome, video, finish.
import { store, crew, ROLES, ROLE_NAME } from './store.js';
import { icon } from './icons.js';
import { h, esc } from './dom.js';
import { botSVG, sing, lcdWave } from './bots.js';
import { sticker } from './stickers.js';
import { patchSVG } from './patch.js';
import { hello, sfx, stopAll, shape, ensure, drum, note, BONKS } from './chip.js';
import { Sequencer } from './seq.js';
import { scheduleStep, stepsOf, stepDur, demoSongs, cleanSong, CHORDS, BOTS } from './song.js';
import { say, autoSay, hush, speakButton, toast, burst, sentences } from './ui.js';

let R = null;            // the current runner
let cleanup = [];
let token = 0;
const FRAMED = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();

export function leaveMission() {
  runCleanup();
  R = null;
}
function runCleanup() {
  const list = cleanup; cleanup = [];
  for (const fn of list) { try { fn(); } catch (e) { console.warn(e); } }
  stopAll();
  hush();
}
const onLeave = fn => cleanup.push(fn);

export function showMission(app, mission, idx, env) {
  if (!R || R.mission.id !== mission.id || !R.root.isConnected) build(app, mission, env);
  go(Math.min(idx, mission.steps.length - 1));
}

function build(app, mission, env) {
  runCleanup();
  const i = env.list.findIndex(m => m.id === mission.id);
  const root = h(`<section class="view runner">
    <header class="topbar">
      <a class="btn round" href="#/" aria-label="Home">${icon('home')}</a>
      <div class="title"><span class="pixel" style="font-size:14px;color:var(--ink-2);margin-right:10px">${i >= 0 ? 'M' + (i + 1) : ''}</span>${esc(mission.title)}</div>
      <div class="spacer"></div><div class="pips"></div>
    </header>
    <div class="stagearea"></div>
    <footer class="bottombar">
      <button class="btn big back" type="button" aria-label="Back">${icon('back')}</button>
      <div class="mid"></div>
      <button class="btn big primary next" type="button">Next ${icon('next')}</button>
    </footer>
  </section>`);
  root.querySelector('.topbar').appendChild(env.readToggle());
  app.replaceChildren(root);
  R = {
    app, mission, env, root, idx: 0,
    stage: root.querySelector('.stagearea'),
    mid: root.querySelector('.mid'),
    next: root.querySelector('.next'),
    back: root.querySelector('.back'),
    pips: root.querySelector('.pips'),
  };
  R.next.addEventListener('click', () => {
    hush();
    const n = R.idx + 1;
    if (n >= mission.steps.length) { location.hash = '#/'; return; }
    location.hash = `#/m/${mission.id}/${n}`;
  });
  R.back.addEventListener('click', () => {
    hush();
    if (R.idx === 0) { location.hash = '#/'; return; }
    location.hash = `#/m/${mission.id}/${R.idx - 1}`;
  });
}

function setReady(on) {
  if (!R) return;
  R.next.classList.toggle('glow', !!on);
}

function setMid(stepWho, label = '') {
  const c = crew();
  R.mid.innerHTML = '';
  if (stepWho) {
    const name = stepWho === 'everyone' ? 'Everyone' : c[stepWho];
    const text = stepWho === 'everyone' ? 'Everyone!' : stepWho === 'copilot' ? `${name}'s turn` : stepWho === 'commander' ? `${name}'s turn` : `${name}'s turn`;
    R.mid.appendChild(h(`<span class="who ${esc(stepWho)}">${esc(text)}</span>`));
  }
  if (label) R.mid.appendChild(h(`<span class="label">${esc(label)}</span>`));
}

function go(idx) {
  runCleanup();
  const myToken = ++token;
  const m = R.mission;
  const step = m.steps[idx];
  R.idx = idx;
  R.pips.innerHTML = m.steps.map((_, i) => `<i class="${i < idx ? 'on' : i === idx ? 'now' : ''}"></i>`).join('');
  const last = idx === m.steps.length - 1;
  R.next.innerHTML = last ? `${icon('home')} Sound Station` : `Next ${icon('next')}`;
  setReady(false);
  setMid(step.who || null, step.label || '');
  const el = h(`<div class="step"></div>`);
  R.stage.replaceChildren(el);
  const fn = RENDER[step.type] || renderUnknown;
  const ctx = { token: myToken, live: () => myToken === token && R && el.isConnected };
  try { fn(el, step, ctx); } catch (e) { console.error(e); renderUnknown(el); }
}

function renderUnknown(el) {
  el.className = 'step pad';
  el.innerHTML = `<div class="card" style="max-width:640px;margin:40px auto">This part isn't ready yet. Tap Next to carry on.</div>`;
}

/* ---------------- Names and text ---------------- */
// Fill {commander}, {copilot}, {engineer} in content text.
export function fill(t) {
  const c = crew();
  return String(t ?? '').replace(/\{(commander|copilot|engineer)\}/g, (_, k) => c[k]);
}

/* ---------------- Sounds named in content ---------------- */
// sound: { hello: bot } | { sfx: recipe } | { notes: [midi...], voice, gap } | { chord: key, style } | { song: demoId | 'kit:win' | 'kit:music', loop } | { drum: kind } | { bonk: bot }
const demos = () => (demos.list ||= demoSongs());
let playingSeq = null;
export function playSound(s, { onEnd } = {}) {
  if (!s) return 0;
  ensure();
  if (playingSeq) { playingSeq.stop(); playingSeq = null; }
  if (s.hello) return hello(s.hello);
  if (s.sfx) return sfx(s.sfx);
  if (s.drum) { drum(s.drum); return 0.3; }
  if (s.drums) { const t0 = (ensure()?.currentTime || 0) + 0.05; let end = 0; s.drums.forEach(([t, k]) => { drum(k, t0 + t); end = Math.max(end, t); }); return end + 0.3; }
  if (s.chords) {
    const t0 = (ensure()?.currentTime || 0) + 0.05; const each = s.each || 0.9;
    s.chords.forEach((k, i) => { const c = CHORDS[k]; if (!c) return; note({ voice: 'bleep', duty: 0.25, midi: c.root + 12, arp: c.iv.concat(c.iv[0] + 12), arpRate: 1 / 24, at: t0 + i * each, dur: each * 0.95, vol: 0.8 }); note({ voice: 'hoot', midi: c.root - 12, at: t0 + i * each, dur: each * 0.9, vol: 0.8 }); });
    return s.chords.length * each;
  }
  if (s.notes) {
    const gap = s.gap || 0.32;
    stopAll();
    const t0 = (ensure()?.currentTime || 0) + 0.05;
    s.notes.forEach((m, i) => { if (m) note({ voice: s.voice || 'bleep', duty: s.duty, midi: m, at: t0 + i * gap, dur: gap * (s.legato ? 1 : 0.8), wobble: s.wobble || 0 }); });
    return s.notes.length * gap;
  }
  if (s.chord) {
    const c = CHORDS[s.chord] || CHORDS.home;
    const t0 = (ensure()?.currentTime || 0) + 0.03;
    const voice = s.voice || 'bleep';
    if (s.style === 'arp') note({ voice, duty: 0.25, midi: c.root + 12, arp: c.iv.concat(c.iv[0] + 12), arpRate: 1 / 24, at: t0, dur: s.len || 1.6, vol: 0.9 });
    else if (s.style === 'up') c.iv.forEach((iv, i) => note({ voice, duty: 0.5, midi: c.root + 12 + iv, at: t0 + i * 0.28, dur: (s.len || 1.6) - i * 0.28, vol: 0.7 }));
    else c.iv.forEach(iv => note({ voice: s.voice || 'hoot', midi: c.root + 12 + iv, at: t0, dur: s.len || 1.6, vol: 0.75 }));
    note({ voice: 'hoot', midi: c.root - 12, at: t0, dur: s.len || 1.6, vol: 0.7 });
    return s.len || 1.6;
  }
  if (s.song) {
    let song = null;
    if (s.song.startsWith('kit:')) {
      const k = store.kit(s.song.slice(4));
      song = k && (k.notes ? k : store.song(k.id));
    } else song = demos().find(d => d.id === s.song) || store.song(s.song);
    if (!song) return 0;
    song = cleanSong(song);
    if (s.speed) song.speed = s.speed;
    if (s.pages) song.pages = s.pages;
    if (s.pageSpeed) song.pageSpeed = s.pageSpeed.slice();
    const seq = new Sequencer({ steps: () => stepsOf(song), stepDur: st => stepDur(song, st), schedule: (st, t, d) => scheduleStep(song, st, t, d), loop: !!s.loop, onEnd: () => { if (playingSeq === seq) playingSeq = null; onEnd && onEnd(); } });
    seq.start();
    playingSeq = seq;
    onLeave(() => { seq.stop(); if (playingSeq === seq) playingSeq = null; });
    let t = 0; for (let i = 0; i < stepsOf(song); i++) t += stepDur(song, i);
    return t;
  }
  if (s.bonk) return sfx({ ...(BONKS[s.bonk] || BONKS.hoot) });
  return 0;
}
export const stopSound = () => { if (playingSeq) { playingSeq.stop(); playingSeq = null; } stopAll(); };

// A big round "Hear it" button for a sound.
function hearButton(s, label = 'Hear it') {
  const b = h(`<button class="playbig" type="button"><span class="disc">${icon('play')}</span><span>${esc(label)}</span></button>`);
  let timer = 0;
  b.addEventListener('pointerdown', () => {
    hush();
    b.classList.add('playing');
    const len = playSound(s, { onEnd: () => b.classList.remove('playing') });
    clearTimeout(timer);
    timer = setTimeout(() => b.classList.remove('playing'), Math.max(400, len * 1000 + 150));
    const bots = b.closest('.step')?.querySelectorAll('.bot');
    if (s.hello && bots) bots.forEach(x => { if (x.dataset.bot === s.hello) sing(x, Math.max(600, len * 1000)); });
  });
  onLeave(() => clearTimeout(timer));
  return b;
}

/* ---------------- Pictures named in content ---------------- */
// art: { bots: [...], bot, sticker, img, credit, wave: voice | {voice, duty}, stickers: [...] }
function artHTML(art = {}) {
  if (art.img) return `<div class="frame"><img src="${esc(art.img)}" alt="${esc(art.alt || '')}">${art.credit ? `<span class="credit">${esc(art.credit)}</span>` : ''}</div>`;
  if (art.bots) return `<div class="botrow">${art.bots.map(b => `<div class="bot" data-bot="${b}">${botSVG(b, { sleep: !!art.sleep, table: b === 'crew' ? store.kit('wave')?.table : null })}<div class="name">${esc(BOTS[b]?.name || b)}</div></div>`).join('')}</div>`;
  if (art.bot) return `<div class="botrow one"><div class="bot" data-bot="${art.bot}">${botSVG(art.bot, { table: art.bot === 'crew' ? store.kit('wave')?.table : null })}</div></div>`;
  if (art.wave) { const w = typeof art.wave === 'string' ? { voice: art.wave } : art.wave; return `<div class="frame" style="background:var(--lcd);padding:24px">${lcdWave(shape(w.voice, w), { w: 320, h: 160, cycles: w.cycles || 2 })}</div>`; }
  if (art.waves) return `<div class="waverow">${art.waves.map(w => `<div class="wv"><div class="frame" style="background:var(--lcd);padding:14px">${lcdWave(shape(w.voice, w), { w: 320, h: 120, cycles: w.cycles || 2 })}</div>${w.label ? `<div class="name">${esc(w.label)}</div>` : ''}</div>`).join('')}</div>`;
  if (art.stickers) return `<div class="botrow">${art.stickers.map(s => `<div class="stk" style="width:30%;height:auto">${sticker(s)}</div>`).join('')}</div>`;
  if (art.sticker) return `<div class="stk">${sticker(art.sticker)}</div>`;
  return '';
}
function wireArt(el) {
  el.querySelectorAll('.art .bot').forEach(b => b.addEventListener('pointerdown', () => { hush(); hello(b.dataset.bot); sing(b); }));
  el.querySelectorAll('.art img').forEach(img => img.addEventListener('error', () => { const st = img.closest('.story'); st && st.classList.add('noart'); img.closest('.art')?.remove(); }, { once: true }));
}

/* ---------------- Step: story ---------------- */
function renderStory(el, s, ctx) {
  el.className = 'step pad';
  const hasArt = !!(s.art && Object.keys(s.art).length);
  el.innerHTML = `<div class="story ${hasArt ? '' : 'noart'}">
    ${hasArt ? `<div class="art">${artHTML(s.art)}</div>` : ''}
    <div class="text"><div class="card">
      ${s.eyebrow ? `<div class="eyebrow">${esc(s.eyebrow)}</div>` : ''}
      <div class="row gap" style="align-items:flex-start"><h2 class="grow">${esc(fill(s.title))}</h2><span class="sp"></span></div>
      <div class="say">${esc(fill(s.text))}</div>
      ${s.sounds ? `<div class="row gap wrap sounds"></div>` : s.sound ? `<div class="row gap wrap sounds"></div>` : ''}
      ${s.wow ? `<div class="wow"><span>${esc(fill(s.wow.text || s.wow))}${s.wow.source ? `<span class="src">Source: ${esc(s.wow.source)}</span>` : ''}</span></div>` : ''}
      ${s.dad ? `<div class="dadline"><b>${esc(crew().engineer)}</b><span>${esc(fill(s.dad))}</span></div>` : ''}
    </div></div></div>`;
  const row = el.querySelector('.sounds');
  if (row) {
    const list = s.sounds || [{ sound: s.sound, label: s.soundLabel || 'Hear it' }];
    list.forEach(x => {
      const b = hearButton(x.sound, x.label || 'Hear it');
      if (x.sticker) b.querySelector('.disc').innerHTML = sticker(x.sticker);
      if (x.col) b.style.background = x.col;
      row.appendChild(b);
      b.addEventListener('pointerdown', () => setReady(true));
    });
  }
  wireArt(el);
  const text = sentences(fill(s.title), fill(s.text), s.wow ? fill(s.wow.text || s.wow) : '');
  const btn = speakButton(() => text);
  el.querySelector('.sp').replaceWith(btn);
  autoSay(text, btn).then(() => { if (ctx.live() && !row) setReady(true); });
  if (!row) setTimeout(() => ctx.live() && setReady(true), 2500);
}

/* ---------------- Choice pictures ---------------- */
function choicePic(ch) {
  if (ch.bot) return `<div class="bot" data-bot="${ch.bot}">${botSVG(ch.bot, { label: false, table: ch.bot === 'crew' ? store.kit('wave')?.table : null })}</div>`;
  if (ch.wave) { const w = typeof ch.wave === 'string' ? { voice: ch.wave } : ch.wave; return lcdWave(shape(w.voice, w), { w: 220, h: 110, cycles: w.cycles || 2 }); }
  if (ch.sticker) return sticker(ch.sticker);
  if (ch.chord) { const c = CHORDS[ch.chord]; return `<div style="width:130px;height:130px;border-radius:20px;border:3px solid #1b1b24;background:${c.col};display:flex;align-items:center;justify-content:center">${sticker(c.icon === 'cloud' ? (c.mood === 'sad' ? 'rain' : 'greycloud') : c.icon, { size: 96 })}</div>`; }
  return '';
}
function choiceHTML(ch, i, { key = false } = {}) {
  const pic = choicePic(ch);
  return `<button class="choice" type="button" data-i="${i}">
    ${key ? `<span class="key">${'ABCD'[i]}</span>` : ''}
    ${ch.sound ? `<span class="listen" role="button" aria-label="Hear ${esc(ch.label)}">${icon('play')}</span>` : ''}
    ${pic ? `<div class="pic">${pic}</div>` : ''}
    <span>${esc(fill(ch.label))}</span>
    ${ch.detail ? `<span class="detail">${esc(fill(ch.detail))}</span>` : ''}
    <span class="badges"></span>
  </button>`;
}
function wireListen(el, list) {
  el.querySelectorAll('.choice').forEach(b => {
    const ch = list[+b.dataset.i];
    const ls = b.querySelector('.listen');
    if (ls && ch.sound) ls.addEventListener('pointerdown', e => { e.stopPropagation(); hush(); playSound(ch.sound); const bt = b.querySelector('.bot'); bt && sing(bt); });
    if (ls) ls.addEventListener('click', e => e.stopPropagation());
  });
}
function drawBadges(btns, picks) {
  const c = crew();
  btns.forEach((b, i) => {
    b.querySelector('.badges').innerHTML = ROLES.filter(r => picks[r] === i).map(r => `<span class="badge ${r}">${esc(c[r])}</span>`).join('');
  });
}

/* ---------------- Step: guess ---------------- */
function renderGuess(el, s, ctx) {
  el.className = 'step pad';
  const c = crew();
  const list = s.choices || [];
  const order = s.order || ROLES;
  el.innerHTML = `<div class="ask">
    <div class="row gap"><div class="grow"><div class="eyebrow">${esc(s.eyebrow || 'Guess first!')}</div><div class="prompt">${esc(fill(s.prompt))}</div></div><span class="hear"></span><span class="sp"></span></div>
    <div class="choices" style="--n:${Math.min(4, list.length)}">${list.map((ch, i) => choiceHTML(ch, i)).join('')}</div>
    <div class="turnrow"></div>
    <div class="revealslot"></div>
  </div>`;
  if (s.play) el.querySelector('.hear').replaceWith(hearButton(s.play, s.playLabel || 'Hear it'));
  const btns = [...el.querySelectorAll('.choice')];
  wireListen(el, list);
  const turn = el.querySelector('.turnrow');
  const slot = el.querySelector('.revealslot');
  const pb = speakButton(() => sentences(fill(s.prompt), list.map(ch => fill(ch.label)).join(', or ') + '?'));
  el.querySelector('.sp').replaceWith(pb);
  autoSay(sentences(fill(s.prompt)), pb);
  const picks = {};
  let who = 0;
  let done = false;

  const drawTurn = () => {
    turn.innerHTML = '';
    if (who < order.length) {
      const r = order[who];
      turn.appendChild(h(`<span class="who ${r}">${esc(c[r])}</span>`));
      turn.appendChild(h(`<span class="ask-line">${r === 'engineer' ? 'your guess too?' : r === 'copilot' ? 'point to one!' : 'what do you think?'}</span>`));
      if (r === 'engineer' || r === 'copilot') {
        const skip = h(`<button class="btn ghost small" type="button">Skip</button>`);
        skip.addEventListener('click', () => { who++; drawTurn(); });
        turn.appendChild(skip);
      }
      setMid(r);
    } else if (!done) {
      const rb = h(`<button class="btn primary big glow" type="button">${icon('play')} Let's find out!</button>`);
      rb.addEventListener('click', reveal);
      turn.appendChild(rb);
      setMid('everyone');
    }
  };
  btns.forEach((b, i) => b.addEventListener('click', () => {
    if (done) { const ch = list[i]; if (ch.sound) playSound(ch.sound); return; }
    if (who >= order.length) { picks[order[order.length - 1]] = i; drawBadges(btns, picks); return; }
    const r = order[who];
    picks[r] = i;
    who++;
    drawBadges(btns, picks);
    drawTurn();
    if (who < order.length) autoSay(`${c[order[who]]}, ${order[who] === 'copilot' ? 'point to one' : 'what do you think'}?`);
  }));

  function reveal() {
    done = true;
    turn.innerHTML = '';
    const ans = typeof s.answer === 'number' ? s.answer : -1;
    if (ans >= 0) btns.forEach((b, i) => { b.classList.toggle('answer', i === ans); b.classList.toggle('dim', i !== ans); });
    const anyRight = ans >= 0 && ROLES.some(r => picks[r] === ans);
    const opener = ans < 0 ? 'Let’s listen!' : picks.commander === ans || picks.copilot === ans ? 'Yes! Good listening!' : anyRight ? 'Good guessing, crew!' : 'Ooh, good guess! Listen...';
    const rv = h(`<div class="reveal"><div class="card"><div class="row gap"><div class="big grow">${esc(opener)}</div><span class="sp"></span></div><p>${esc(fill(s.reveal || ''))}</p></div></div>`);
    const text = sentences(opener, fill(s.reveal || ''));
    const b = speakButton(() => text);
    rv.querySelector('.sp').replaceWith(b);
    slot.replaceChildren(rv);
    if (s.revealSound) setTimeout(() => ctx.live() && playSound(s.revealSound), 150);
    else if (ans >= 0 && list[ans]?.sound) setTimeout(() => ctx.live() && playSound(list[ans].sound), 150);
    const bt = ans >= 0 ? btns[ans].querySelector('.bot') : null;
    bt && sing(bt, 900);
    setTimeout(() => ctx.live() && autoSay(text, b), s.revealSound || (ans >= 0 && list[ans]?.sound) ? 900 : 0);
    const said = ROLES.filter(r => picks[r] !== undefined).map(r => `${c[r]} said "${fill(list[picks[r]]?.label)}"`).join(', ');
    store.addLog(R.mission.id, `Guess: ${fill(s.prompt)} ${said ? said + '.' : ''}${ans >= 0 ? ` Answer: ${fill(list[ans]?.label)}.` : ''}`);
    setReady(true);
    setMid(null);
    rv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  drawTurn();
}

/* ---------------- Step: Big Question ---------------- */
function renderQuestion(el, s, ctx) {
  el.className = 'step pad';
  const c = crew();
  const opts = s.options || [];
  el.innerHTML = `<div class="ask">
    <div class="row gap" style="align-items:flex-start">
      ${s.art ? `<div style="width:150px;flex:none">${s.art.bot ? `<div class="bot" data-bot="${s.art.bot}">${botSVG(s.art.bot)}</div>` : sticker(s.art.sticker || 'note')}</div>` : ''}
      <div class="grow"><div class="eyebrow">Big Question &middot; there's no right answer</div><h2 style="margin-bottom:8px">${esc(fill(s.title || ''))}</h2><div class="scenario">${esc(fill(s.scenario))}</div></div>
      <span class="sp"></span>
    </div>
    <div class="choices" style="--n:${Math.min(4, opts.length)}">${opts.map((o, i) => choiceHTML(o, i, { key: true })).join('')}</div>
    <div class="turnrow"></div>
    <div class="revealslot"></div>
  </div>`;
  const btns = [...el.querySelectorAll('.choice')];
  wireListen(el, opts);
  el.querySelectorAll('.ask > .row .bot').forEach(b => b.addEventListener('pointerdown', () => { hello(b.dataset.bot); sing(b); }));
  const turn = el.querySelector('.turnrow');
  const slot = el.querySelector('.revealslot');
  const scen = sentences(fill(s.scenario), opts.map((o, i) => `${'ABCD'[i]}: ${fill(o.label)}`).join('. '), 'What would you do?');
  const sb = speakButton(() => scen);
  el.querySelector('.sp').replaceWith(sb);
  autoSay(scen, sb);
  const picks = {};
  let who = 0;
  let phase = 'vote';
  let changing = null;

  const finalNote = h(`<div class="chip" style="font-size:20px;padding:10px 18px"></div>`);
  const drawFinal = () => {
    if (!s.sets) return;
    const i = picks.commander ?? picks.copilot ?? picks.engineer;
    if (i === undefined) return;
    finalNote.innerHTML = `${icon('check')} ${esc(s.setsLabel || 'Our game will use')}: <b style="margin-left:6px">${esc(fill(opts[i].label))}</b>`;
    store.choose(s.sets, s.values ? s.values[i] : i);
  };

  const drawTurn = () => {
    turn.innerHTML = '';
    if (phase === 'vote') {
      const r = ROLES[who];
      turn.appendChild(h(`<span class="who ${r}">${esc(c[r])}</span>`));
      turn.appendChild(h(`<span class="ask-line">${r === 'copilot' ? 'which one do you like?' : 'what would you do? Tap one.'}</span>`));
      if (r !== 'commander') {
        const skip = h(`<button class="btn ghost small" type="button">Skip</button>`);
        skip.addEventListener('click', () => { who++; if (who >= ROLES.length) toWhy(); else drawTurn(); });
        turn.appendChild(skip);
      }
      setMid(r);
    } else if (phase === 'why') {
      const box = h(`<div class="col gap" style="width:100%;align-items:center">
        <div class="row gap wrap center"><span class="who everyone">Everyone</span><span class="ask-line">Why did you choose that? Tell each other!</span></div>
        <div class="row gap" style="width:min(900px,100%)"><input class="whyin grow" type="text" maxlength="160" placeholder="${esc(c.engineer)} can write the crew's reasons here (optional)" style="min-height:64px;border-radius:16px;border:3px solid #1b1b24;padding:0 16px;font-size:20px">
        <button class="btn primary big" type="button">What did game makers do?</button></div></div>`);
      box.querySelector('.btn').addEventListener('click', () => {
        const why = box.querySelector('input').value.trim();
        const said = ROLES.filter(r => picks[r] !== undefined).map(r => `${c[r]} chose "${fill(opts[picks[r]]?.label)}"`).join(', ');
        store.addLog(R.mission.id, `Big Question, ${fill(s.title || '')}: ${said}.${why ? ` Because: ${why}` : ''}`);
        phase = 'reveal';
        drawTurn();
        showReveal();
      });
      turn.appendChild(box);
      setMid('everyone');
      autoSay('Why did you choose that? Tell each other!');
    } else if (phase === 'reveal') {
      const wrap = h(`<div class="col gap" style="align-items:center"></div>`);
      const row = h(`<div class="mindrow"></div>`);
      for (const r of ROLES) {
        if (picks[r] === undefined) continue;
        const b = h(`<button class="btn small" type="button">${icon('star')} ${esc(c[r])}: I changed my mind</button>`);
        b.addEventListener('click', () => {
          changing = r;
          hint.textContent = `Tap your new choice, ${c[r]}.`;
          autoSay(`Tap your new choice, ${c[r]}.`);
        });
        row.appendChild(b);
      }
      const hint = h(`<span class="muted" style="font-size:19px"></span>`);
      wrap.append(row, hint);
      if (s.sets) { wrap.appendChild(finalNote); drawFinal(); }
      turn.appendChild(wrap);
    }
  };
  function toWhy() { phase = 'why'; drawTurn(); }

  btns.forEach((b, i) => b.addEventListener('click', () => {
    if (phase === 'vote') {
      picks[ROLES[who]] = i;
      who++;
      drawBadges(btns, picks);
      if (who >= ROLES.length) toWhy();
      else { drawTurn(); autoSay(`${c[ROLES[who]]}, ${ROLES[who] === 'copilot' ? 'which one do you like?' : 'what would you do?'}`); }
    } else if (phase === 'reveal' && changing) {
      const r = changing; changing = null;
      if (picks[r] === i) return;
      picks[r] = i;
      drawBadges(btns, picks);
      store.addStar(r);
      store.addLog(R.mission.id, `${c[r]} changed their mind to "${fill(opts[i]?.label)}". A star for a brave rethink!`);
      toast(`${c[r]} had a rethink. +1 star!`);
      say(`${c[r]} changed their mind. That's brave thinking! A star!`);
      burst(el, b);
      drawTurn();
      drawFinal();
    } else if (opts[i].sound) playSound(opts[i].sound);
  }));

  function showReveal() {
    const rv = h(`<div class="reveal"><div class="card">
      <div class="row gap"><div class="eyebrow grow" style="margin:0">What real game makers did</div><span class="sp"></span></div>
      <p>${esc(fill(s.reveal))}</p>
      ${s.followUp ? `<div class="dadline" style="font-size:21px"><b>Talk about it</b><span>${esc(fill(s.followUp))}</span></div>` : ''}
    </div></div>`);
    const text = sentences(fill(s.reveal), fill(s.followUp || ''));
    const b = speakButton(() => text);
    rv.querySelector('.sp').replaceWith(b);
    slot.replaceChildren(rv);
    autoSay(text, b);
    setReady(true);
    setMid(null);
    rv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  drawTurn();
}

/* ---------------- Step: toy (also move, make, game) ---------------- */
const EYEBROW = { toy: 'Play', move: 'Move your body!', make: 'Make it', game: 'Try it in the game' };
function renderToy(el, s, ctx) {
  el.className = 'step';
  const intro = fill(s.intro || s.title || '');
  // Compact steps (the big Song Maker) put their instructions in the bottom bar to give the toy more room.
  const compact = !!s.compact && !!intro;
  el.innerHTML = `<div class="toyhost">${intro && !compact ? `<div class="toyintro"><span class="sp"></span><div><div class="eyebrow" style="margin:0 0 4px">${esc(s.eyebrow || EYEBROW[s.type] || 'Play')}</div><div class="t">${esc(intro)}</div></div></div>` : ''}<div class="toybody"></div></div>`;
  if (compact) {
    R.mid.innerHTML = '';
    R.mid.appendChild(h(`<span class="sp"></span>`));
    R.mid.appendChild(h(`<span class="label compact">${esc(intro)}</span>`));
  }
  const body = el.querySelector('.toybody');
  // While the step's own intro is being read, a toy's opening line would cut it off: skip those.
  let introTalking = false;
  let pending = null;
  if (intro) {
    const b = speakButton(() => intro);
    (compact ? R.mid : el).querySelector('.sp').replaceWith(b);
    introTalking = !!store.state.autoRead;
    autoSay(intro, b).then(() => {
      introTalking = false;
      if (pending && ctx.live()) { const t = pending; pending = null; setTimeout(() => ctx.live() && autoSay(t), 250); }
    });
  }
  const name = s.toy || (s.type === 'game' ? 'moonrun' : null);
  if (!name) { renderUnknown(el); return; }
  let inst = null;
  onLeave(() => { try { inst && inst.destroy && inst.destroy(); } catch (e) { console.warn(e); } inst = null; });
  const api = R.env.toyApi({
    mode: 'mission',
    mission: R.mission.id,
    done: (msg) => {
      if (!ctx.live()) return;
      if (!R.next.classList.contains('glow') && msg !== false) { burst(el); }
      setReady(true);
    },
    log: t => store.addLog(R.mission.id, t),
    say: t => { if (!ctx.live()) return; if (introTalking) pending = t; else autoSay(t); },
    setWho: (r, label) => ctx.live() && !compact && setMid(r, label || ''),
  });
  import(`../toys/${name}.js`).then(mod => {
    if (!ctx.live()) return;
    inst = mod.mount(body, { ...(s.props || {}), step: s }, api);
  }).catch(e => { console.error(e); body.innerHTML = `<div class="card" style="margin:40px auto;max-width:640px">This activity isn't ready yet. Tap Next to carry on.</div>`; setReady(true); });
  if (s.skippable !== false) setTimeout(() => ctx.live() && s.readyAfter && setReady(true), (s.readyAfter || 0) * 1000);
}

/* ---------------- Step: try it at home ---------------- */
function renderAtHome(el, s) {
  el.className = 'step pad';
  const need = s.need || [];
  const steps = s.steps || [];
  el.innerHTML = `<div class="col gap" style="max-width:1220px;margin:0 auto;width:100%">
    <div class="row gap"><div class="grow"><div class="eyebrow">Try it at home</div><h2>${esc(fill(s.title))}</h2></div><span class="sp"></span></div>
    <div class="athome">
      <div class="card col gap">${s.art ? `<div style="height:150px;display:flex;justify-content:center">${sticker(s.art, { size: 150 })}</div>` : ''}<h3>You need</h3><ul>${need.map((n, i) => `<li><span class="tick" role="checkbox" aria-checked="false" tabindex="0" data-i="${i}"></span><span>${esc(n)}</span></li>`).join('')}</ul></div>
      <div class="card col gap"><h3>What to do</h3><ol>${steps.map((t, i) => `<li><span class="n">${i + 1}</span><span>${esc(fill(t))}</span></li>`).join('')}</ol>
        ${s.why ? `<div class="wow"><span><b>What it shows:</b> ${esc(fill(s.why))}</span></div>` : ''}
        ${s.safety ? `<div class="safe"><b>Grown-ups:</b> ${esc(s.safety)}</div>` : ''}
      </div>
    </div></div>`;
  el.querySelectorAll('.tick').forEach(t => {
    const flip = () => { const on = !t.classList.contains('on'); t.classList.toggle('on', on); t.setAttribute('aria-checked', on); t.innerHTML = on ? icon('check') : ''; if (on) sfx({ voice: 'bleep', notes: [76, 84], len: 0.14 }); };
    t.addEventListener('click', flip);
    t.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  });
  const text = sentences(fill(s.title), 'You need: ' + need.join(', '), ...steps.map(fill), s.why ? 'What it shows: ' + fill(s.why) : '');
  const b = speakButton(() => text);
  el.querySelector('.sp').replaceWith(b);
  autoSay(sentences('Try it at home!', fill(s.title)), b);
  setReady(true);
}

/* ---------------- Step: video ---------------- */
function renderVideo(el, s) {
  el.className = 'step pad';
  const id = String(s.youtubeId || '').replace(/[^\w-]/g, '');
  const start = Math.max(0, parseInt(s.start || 0, 10) || 0);
  const url = `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`;
  el.innerHTML = `<div class="video">
    <div class="vframe"><img class="poster" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="">${FRAMED
      ? `<a class="play" href="${url}" target="_blank" rel="noopener" aria-label="Play video in YouTube">${icon('play')}</a>`
      : `<button class="play" type="button" aria-label="Play video">${icon('play')}</button>`}</div>
    <div class="card col gap">
      <div class="eyebrow">Watch together</div>
      <div class="row gap"><h2 class="grow">${esc(fill(s.title))}</h2><span class="sp"></span></div>
      ${s.why ? `<p class="lead" style="margin:0">${esc(fill(s.why))}</p>` : ''}
      ${s.channel ? `<p class="faint" style="font-size:17px;margin:0">From ${esc(s.channel)} on YouTube. Needs the internet.</p>` : ''}
      <div><a class="btn ghost small" href="${url}" target="_blank" rel="noopener">Open in YouTube</a></div>
    </div></div>`;
  const text = sentences(fill(s.title), fill(s.why || ''));
  const b = speakButton(() => text);
  el.querySelector('.sp').replaceWith(b);
  autoSay(text, b);
  el.querySelector('.poster').addEventListener('error', e => e.target.remove());
  el.querySelector('button.play')?.addEventListener('click', () => {
    hush(); stopAll();
    el.querySelector('.vframe').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1${start ? `&start=${start}` : ''}" title="${esc(s.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  });
  setReady(true);
}

/* ---------------- Step: finish (debrief and patch) ---------------- */
function renderFinish(el, s) {
  el.className = 'step pad';
  const c = crew();
  const m = R.mission;
  const isNew = store.finishMission(m.id);
  if (isNew) store.addLog(m.id, `Mission complete! The crew earned the "${m.patch?.name || m.title}" patch.`);
  const list = R.env.list;
  const at = list.findIndex(x => x.id === m.id);
  const nxt = list[at + 1];
  const deb = (s.debrief || []).map(fill);
  const qs = ['What was your favourite part?', ...deb];
  el.innerHTML = `<div class="finish">
    <div class="patchbig">${patchSVG({ name: m.patch?.name || m.title, art: m.patch?.art || 'star', col: m.col, col2: m.col2, names: `${c.commander} · ${c.copilot} · ${c.engineer}`, gold: m.gold })}</div>
    <div class="col gap">
      <div><div class="eyebrow">Mission complete</div><h1>${esc(m.patch?.name || m.title)}</h1>
        <p class="lead muted" style="margin-top:8px">${isNew ? 'A new patch for the wall!' : 'You did this mission again. Brilliant!'}</p></div>
      <div class="card col gap"><h3>Crew debrief</h3><div class="debrief">${qs.map((q, i) => `<div class="q"><span class="sp" data-i="${i}"></span><span>${esc(q)}</span></div>`).join('')}</div></div>
      <div class="row gap wrap">${nxt ? `<a class="btn primary big" href="#/m/${nxt.id}/0">Next: ${esc(nxt.title)} ${icon('next')}</a>` : ''}<a class="btn big" href="#/">${icon('home')} Sound Station</a></div>
    </div></div>`;
  el.querySelectorAll('.sp').forEach(sp => { const q = qs[+sp.dataset.i]; sp.replaceWith(speakButton(() => q)); });
  sfx({ voice: 'bleep', duty: 0.5, notes: [72, 76, 79, 84], len: 0.6, fx: 'echo' });
  if (isNew) setTimeout(() => burst(el, el.querySelector('.patchbig')), 300);
  setTimeout(() => autoSay(sentences(`Mission complete! You earned the ${m.patch?.name || m.title} patch`, ...qs)), 700);
  setReady(true);
}

const RENDER = { story: renderStory, guess: renderGuess, question: renderQuestion, toy: renderToy, move: renderToy, make: renderToy, game: renderToy, athome: renderAtHome, video: renderVideo, finish: renderFinish };
