// Astra Finn: router, home, crew setup, mission runner.
import { speak, stopSpeaking, sentences, canSpeak } from './core/speak.js';
import { store } from './core/store.js';
import { patchSVG } from './core/patch.js';
import { icon } from './core/icons.js';

const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ACCENT = { gold: 'var(--gold)', cyan: 'var(--cyan)', red: '#ff8a6b', green: 'var(--green)' };
// Inside a sandboxed frame (e.g. a hosted preview) other sites can't be embedded, so videos open in YouTube instead.
const FRAMED = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();
const STEP_LABEL = { story: 'Look', guess: 'Guess', play: 'Play', question: 'Big Question', video: 'Watch', athome: 'Try it at home', finish: 'Mission complete' };

let missionIds = [];
const missions = {};
let runner = null;     // { id, mission, idx, el, stage, nextBtn, backBtn, label, dots }
let stepCleanup = [];  // functions to run when leaving a step
let stepToken = 0;
let wakeLock = null;

/* ---------------- Data ---------------- */
async function loadMission(id) {
  if (!missions[id]) {
    const r = await fetch(`content/${id}.json`);
    if (!r.ok) throw new Error(`Mission ${id} not found`);
    missions[id] = await r.json();
  }
  return missions[id];
}

async function loadAll() {
  try {
    missionIds = await (await fetch('content/missions.json')).json();
  } catch (e) {
    missionIds = ['starship'];
  }
  await Promise.all(missionIds.map(id => loadMission(id).catch(err => console.warn(err.message))));
  missionIds = missionIds.filter(id => missions[id]);
}

const crew = () => store.state.crew || { commander: 'Finn', engineer: 'Dad' };

/* ---------------- Speech helpers ---------------- */
let speakingBtn = null;
function say(text, btn = null) {
  if (!text) return;
  if (speakingBtn && speakingBtn !== btn) speakingBtn.classList.remove('on');
  speakingBtn = btn;
  btn && btn.classList.add('on');
  speak(text, {
    onend: () => {
      btn && btn.classList.remove('on');
      if (speakingBtn === btn) speakingBtn = null;
    },
  });
}
function hush() {
  stopSpeaking();
  if (speakingBtn) speakingBtn.classList.remove('on');
  speakingBtn = null;
}
function speakButton(getText, label = 'Read aloud') {
  const b = h(`<button class="speak-btn" type="button" aria-label="${esc(label)}">${icon('speaker')}</button>`);
  if (!canSpeak) b.style.display = 'none';
  b.addEventListener('click', e => {
    e.stopPropagation();
    if (b.classList.contains('on')) { hush(); return; }
    say(getText(), b);
  });
  return b;
}
function autoSay(text, btn) {
  if (!store.state.autoRead) return;
  const token = stepToken;
  setTimeout(() => { if (token === stepToken) say(text, btn); }, 450);
}

/* ---------------- Little UI helpers ---------------- */
function toast(text) {
  const t = h(`<div class="toast">${esc(text)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

function modal(title, bodyEl, { wide = false } = {}) {
  const back = h(`<div class="modal-back" role="dialog" aria-modal="true"><div class="modal card"${wide ? ' style="width:min(1000px,100%)"' : ''}>
    <div class="headrow"><h2>${esc(title)}</h2><button class="btn ghost round" type="button" aria-label="Close">${icon('close')}</button></div>
  </div></div>`);
  back.querySelector('.modal').appendChild(bodyEl);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  back.querySelector('.headrow .btn').addEventListener('click', close);
  back.addEventListener('click', e => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  return close;
}

function fmtTime(t) {
  const d = new Date(t);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function openLog() {
  const s = store.state;
  const body = h(`<div class="loglist"></div>`);
  const add = h(`<div class="whybox"><input class="textin" type="text" maxlength="200" placeholder="Add a note to the Crew Log..."><button class="btn small" type="button">${icon('plus')} Add</button></div>`);
  const list = h(`<div></div>`);
  const draw = () => {
    const items = [...store.state.log].reverse();
    list.innerHTML = items.length ? items.map(it => `<div class="logitem"><div class="when">${esc(fmtTime(it.t))}</div><div class="what">${it.m && missions[it.m] ? `<b>${esc(missions[it.m].title)}</b> &middot; ` : ''}${esc(it.text)}</div></div>`).join('')
      : `<p class="muted">Nothing here yet. Guesses, Big Question answers and catches will appear here.</p>`;
  };
  add.querySelector('button').addEventListener('click', () => {
    const inp = add.querySelector('input');
    if (inp.value.trim()) { store.addLog('', inp.value.trim()); inp.value = ''; draw(); }
  });
  const exp = h(`<div class="mindrow"><button class="btn ghost small copy" type="button">${icon('book')} Copy the log</button>${FRAMED ? '' : `<button class="btn ghost small save" type="button">${icon('download')} Save as a text file</button>`}</div>`);
  const logText = () => {
    const c = crew();
    const lines = [`Astra Finn crew log: Commander ${c.commander} and Flight Engineer ${c.engineer}`, ''];
    for (const it of store.state.log) lines.push(`${fmtTime(it.t)}  ${it.m && missions[it.m] ? '[' + missions[it.m].title + '] ' : ''}${it.text}`);
    return lines.join('\n');
  };
  exp.querySelector('.copy').addEventListener('click', () => {
    const btn = exp.querySelector('.copy');
    if (!navigator.clipboard) { btn.textContent = 'Copy not available here'; return; }
    navigator.clipboard.writeText(logText()).then(() => { btn.innerHTML = `${icon('check')} Copied`; }, () => { btn.textContent = 'Copy not allowed here'; });
  });
  exp.querySelector('.save')?.addEventListener('click', () => {
    const blob = new Blob([logText()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'astra-finn-crew-log.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  draw();
  body.append(add, list, exp);
  modal(`${s.crew ? crew().commander + ' and ' + crew().engineer + "'s" : 'Crew'} Log`, body);
}

function openNotes() {
  const c = crew();
  const body = h(`<div class="notes"></div>`);
  body.innerHTML = `
    <h3>The three crew rules</h3>
    <ul>
      <li>${esc(c.commander)} guesses first. ${esc(c.engineer)} never gives the answer before the reveal.</li>
      <li>Ask "why?" and "what do you think?" more than you explain.</li>
      <li>Changing your mind is brave. Tap "I changed my mind" and it earns a star.</li>
    </ul>
    <h3>How a mission works</h3>
    <ul>
      <li><b>Look</b>: a big picture and a short card. The speaker button reads it aloud.</li>
      <li><b>Guess</b>: ${esc(c.commander)} taps first, then ${esc(c.engineer)}, then Reveal. No wrong answers, just good guesses.</li>
      <li><b>Play</b>: hands-on. Next lights up once you've had a go, but you can always skip.</li>
      <li><b>Big Question</b>: a real "what would you do?" with no right answer. Say why out loud.</li>
      <li><b>Try it at home</b>: a small experiment for the kitchen table.</li>
    </ul>
    ${missionIds.map(id => missions[id]).filter(m => m.dadNotes && m.dadNotes.length).map(m => `
      <h3>${esc(m.title)}</h3><ul>${m.dadNotes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`).join('')}
    <h3>Settings</h3>`;
  const row = h(`<div class="mindrow"></div>`);
  const edit = h(`<button class="btn ghost small" type="button">${icon('edit')} Change crew names</button>`);
  edit.addEventListener('click', () => { document.querySelector('.modal-back')?.remove(); location.hash = '#/setup'; });
  const reset = h(`<button class="btn ghost small" type="button">${icon('refresh')} Start fresh (clear patches and log)</button>`);
  let armed = false;
  reset.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      reset.innerHTML = `${icon('refresh')} Tap again to clear everything`;
      reset.style.borderColor = 'var(--red)';
      setTimeout(() => { armed = false; reset.innerHTML = `${icon('refresh')} Start fresh (clear patches and log)`; reset.style.borderColor = ''; }, 4000);
      return;
    }
    store.reset(); document.querySelector('.modal-back')?.remove(); route();
  });
  row.append(edit, reset);
  body.append(row, h(`<p class="faint" style="font-size:15px;margin-top:12px">Photos: NASA, JPL, JAXA, ESA and Wikimedia Commons contributors. Full credits in assets/img/CREDITS.md. Videos open from YouTube.</p>`));
  modal("Engineer's notes", body, { wide: true });
}

function toggleBtn(on, iconOn, iconOff, label, onToggle) {
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

/* ---------------- Wake lock ---------------- */
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && runner) keepAwake(true); });

/* ---------------- Views ---------------- */
function mount(view) {
  app.replaceChildren(view);
}

function leaveStep() {
  stepToken++;
  for (const fn of stepCleanup.splice(0)) { try { fn(); } catch (e) { console.warn(e); } }
  hush();
}

function leaveRunner() {
  leaveStep();
  runner = null;
  keepAwake(false);
}

function renderSetup() {
  leaveRunner();
  const c = store.state.crew || { commander: 'Finn', engineer: 'Dad' };
  const v = h(`<section class="view setup"><div class="card">
    <div><div class="eyebrow">Welcome to</div><h1>Astra Finn</h1><p class="muted" style="font-size:22px;margin-top:8px">A space academy for a crew of two. Look, guess, play, and wonder together.</p></div>
    <div class="crew-fields">
      <div class="field"><label for="cmd">Commander</label><input id="cmd" type="text" maxlength="16" autocomplete="off" value="${esc(c.commander)}"></div>
      <div class="field"><label for="eng">Flight Engineer</label><input id="eng" type="text" maxlength="16" autocomplete="off" value="${esc(c.engineer)}"></div>
    </div>
    <div><h3 style="margin-bottom:12px">Crew rules</h3>
      <ol class="rules">
        <li><span class="n">1</span><span>The Commander guesses first. The Engineer never tells the answer before the reveal.</span></li>
        <li><span class="n">2</span><span>Ask "why?" and "what do you think?" a lot.</span></li>
        <li><span class="n">3</span><span>Changing your mind is brave. It earns a star.</span></li>
      </ol></div>
    <div class="mindrow"><button class="btn big" type="button">${icon('rocket')} Start our missions</button></div>
  </div></section>`);
  v.querySelector('.btn.big').addEventListener('click', () => {
    const commander = v.querySelector('#cmd').value.trim() || 'Finn';
    const engineer = v.querySelector('#eng').value.trim() || 'Dad';
    const first = !store.state.crew;
    store.set({ crew: { commander, engineer } });
    if (first) store.addLog('', `Crew formed: Commander ${commander} and Flight Engineer ${engineer}.`);
    location.hash = '#/';
  });
  mount(v);
}

function missionTileImg(m) {
  return m.hero ? `<img src="${esc(m.hero)}" alt="" loading="lazy" onerror="this.remove()">` : '';
}

function renderHome() {
  leaveRunner();
  document.documentElement.style.setProperty('--accent', 'var(--gold)');
  const s = store.state;
  const c = crew();
  const nextId = missionIds.find(id => !s.patches[id]) || missionIds[0];
  const nm = missions[nextId];
  const earned = missionIds.filter(id => s.patches[id]);
  const v = h(`<section class="view home">
    <header class="home-head">
      <div class="wordmark">
        <svg class="mark" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="25" fill="#0b1020" stroke="rgba(255,255,255,.14)"/><ellipse cx="26" cy="27" rx="20" ry="8" fill="none" stroke="#f2b544" stroke-width="1.6" transform="rotate(-20 26 27)"/><circle cx="43" cy="20" r="2.6" fill="#f2b544"/><path d="M26 11c3 2.4 4.2 5.8 4.2 9.4V31l2.4 3v3.4h-2.6l-1.3-2.1h-5.4l-1.3 2.1h-2.6V34l2.4-3V20.4c0-3.6 1.2-7 4.2-9.4z" fill="#f3efe6"/></svg>
        <div><h1>ASTRA FINN</h1><div class="sub">Space academy &middot; Commander ${esc(c.commander)} &middot; Engineer ${esc(c.engineer)}</div></div>
      </div>
      <div class="home-actions"></div>
    </header>
    ${nm ? `<div class="hero" data-go="${esc(nextId)}">${missionTileImg(nm)}
      <div class="hero-body"><div class="eyebrow">${s.patches[nextId] ? 'Fly again' : earned.length ? 'Next mission' : 'First mission'}</div>
        <h1>${esc(nm.title)}</h1><p>${esc(nm.tagline || '')}</p>
        <button class="btn big" type="button">${icon('play')} Start mission</button></div></div>` : ''}
    <div>
      <div class="section-title"><h2>Missions</h2><span class="faint" style="font-size:17px">Pick any one. There's no wrong order.</span></div>
      <div class="tiles">${missionIds.map((id, i) => {
        const m = missions[id];
        return `<div class="tile" data-go="${esc(id)}" role="button" tabindex="0" aria-label="${esc(m.title)}">
          ${missionTileImg(m)}<span class="num">${String(i + 1).padStart(2, '0')}</span>
          ${m.minutes ? `<span class="chip mins" style="background:rgba(5,7,13,.6)">${esc(m.minutes)} min</span>` : ''}
          ${s.patches[id] ? `<span class="earned">${patchSVG({ ...m.patch, accent: m.accent, crew: c })}</span>` : ''}
          <div class="tile-body"><h3>${esc(m.title)}</h3><p>${esc(m.tagline || '')}</p></div></div>`;
      }).join('')}</div>
    </div>
    <div class="card">
      <div class="section-title"><h2>Patch wall</h2><span class="stars-row">${icon('star')} ${s.stars || 0} changed mind${s.stars === 1 ? '' : 's'}</span></div>
      <div class="patch-wall">${earned.length ? earned.map(id => patchSVG({ ...missions[id].patch, accent: missions[id].accent, crew: c })).join('')
        : `<span class="empty">Finish a mission to earn your first patch.</span>`}</div>
    </div>
  </section>`);
  const actions = v.querySelector('.home-actions');
  const logBtn = h(`<button class="btn ghost" type="button">${icon('book')} Crew Log</button>`);
  logBtn.addEventListener('click', openLog);
  const notesBtn = h(`<button class="btn ghost" type="button">${icon('notes')} Engineer's notes</button>`);
  notesBtn.addEventListener('click', openNotes);
  actions.append(logBtn, notesBtn);
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (!standalone && document.documentElement.requestFullscreen) {
    const fs = h(`<button class="btn ghost round" type="button" aria-label="Full screen" title="Full screen">${icon('expand')}</button>`);
    fs.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); });
    actions.append(fs);
  }
  v.querySelectorAll('[data-go]').forEach(el => {
    const go = () => { location.hash = `#/m/${el.dataset.go}/0`; };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  mount(v);
}

/* ---------------- Mission runner ---------------- */
async function renderRunner(id, idx) {
  let mission;
  try { mission = await loadMission(id); } catch (e) { location.hash = '#/'; return; }
  if (runner && runner.id === id && runner.el.isConnected) { showStep(idx); return; }
  leaveRunner();
  const c = crew();
  const el = h(`<section class="view runner" style="--accent:${ACCENT[mission.accent] || ACCENT.gold}">
    <div class="topbar">
      <button class="btn ghost round home-btn" type="button" aria-label="Mission Control" title="Mission Control">${icon('home')}</button>
      <div class="title">${esc(mission.title)}</div>
      <div class="spacer"></div>
      <div class="dots">${mission.steps.map(() => '<i></i>').join('')}</div>
      <div class="spacer"></div>
      <span class="tb-tools" style="display:flex;gap:8px"></span>
    </div>
    <div class="stage"></div>
    <div class="bottombar">
      <button class="btn ghost back-btn" type="button">${icon('back')} Back</button>
      <div class="steplabel"></div>
      <button class="btn next-btn" type="button">Next ${icon('next')}</button>
    </div>
  </section>`);
  const tools = el.querySelector('.tb-tools');
  if (canSpeak) {
    tools.append(toggleBtn(store.state.autoRead, 'speaker', 'speakerOff', 'Read cards aloud automatically', on => {
      store.set({ autoRead: on });
      if (!on) hush();
      toast(on ? 'Cards will be read aloud' : 'Read-aloud off. Tap a speaker to hear a card');
    }));
  }
  tools.append(toggleBtn(store.state.sound, 'music', 'musicOff', 'Game sounds', on => {
    store.set({ sound: on });
    toast(on ? 'Game sounds on' : 'Game sounds off');
  }));
  const logBtn = h(`<button class="btn ghost round" type="button" aria-label="Crew Log" title="Crew Log">${icon('book')}</button>`);
  logBtn.addEventListener('click', openLog);
  tools.append(logBtn);
  el.querySelector('.home-btn').addEventListener('click', () => { location.hash = '#/'; });
  runner = {
    id, mission, idx: -1, el,
    stage: el.querySelector('.stage'),
    nextBtn: el.querySelector('.next-btn'),
    backBtn: el.querySelector('.back-btn'),
    label: el.querySelector('.steplabel'),
    dots: [...el.querySelectorAll('.dots i')],
  };
  runner.backBtn.addEventListener('click', () => go(runner.idx - 1));
  runner.nextBtn.addEventListener('click', () => {
    if (runner.idx >= runner.mission.steps.length - 1) location.hash = '#/';
    else go(runner.idx + 1);
  });
  runner.dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  mount(el);
  keepAwake(true);
  showStep(idx);
  void c;
}

function go(i) {
  if (!runner) return;
  const n = clamp(i, 0, runner.mission.steps.length - 1);
  location.hash = `#/m/${runner.id}/${n}`;
}

function setReady(on = true) {
  if (!runner) return;
  runner.nextBtn.classList.toggle('glow', on);
}

function showStep(i) {
  const r = runner;
  const steps = r.mission.steps;
  i = clamp(i, 0, steps.length - 1);
  leaveStep();
  r.idx = i;
  const step = steps[i];
  r.dots.forEach((d, k) => { d.className = k < i ? 'done' : k === i ? 'now' : ''; });
  r.backBtn.disabled = i === 0;
  r.backBtn.style.visibility = i === 0 ? 'hidden' : '';
  const last = i === steps.length - 1;
  r.nextBtn.innerHTML = last ? `${icon('home')} Mission Control` : `Next ${icon('next')}`;
  setReady(false);
  r.label.replaceChildren(document.createTextNode(STEP_LABEL[step.type] || ''));
  const el = h(`<div class="step"></div>`);
  r.stage.replaceChildren(el);
  const fn = RENDER[step.type] || renderUnknown;
  try { fn(el, step, r, i); } catch (e) { console.error(e); renderUnknown(el, step); }
  r.stage.scrollTop = 0;
}

function renderUnknown(el) {
  el.className = 'step pad';
  el.innerHTML = `<div class="card" style="max-width:640px;margin:40px auto">This part isn't ready yet. Tap Next to carry on.</div>`;
}

/* ---------------- Step renderers ---------------- */
function photoHTML(img, credit, extraClass = '') {
  if (!img) return '';
  return `<div class="photo ${extraClass}"><img src="${esc(img)}" alt="">${credit ? `<span class="credit">${esc(credit)}</span>` : ''}</div>`;
}
function wireImgFallback(root, onFail) {
  root.querySelectorAll('.photo img').forEach(img => img.addEventListener('error', () => { const p = img.closest('.photo'); p && p.remove(); onFail && onFail(); }, { once: true }));
}

function renderStory(el, s) {
  el.className = 'step pad story-step';
  const c = crew();
  el.innerHTML = `<div class="story ${s.img ? '' : 'noimg'}">
    ${photoHTML(s.img, s.credit)}
    <div class="text"><div class="card">
      <div class="headrow"><h2>${esc(s.title)}</h2><span class="sp"></span></div>
      <p class="lead">${esc(s.text)}</p>
      ${s.wow ? `<div class="wow">${esc(s.wow)}</div>` : ''}
      ${s.dad ? `<div class="dadline"><b>${esc(c.engineer)}</b><span>${esc(s.dad)}</span></div>` : ''}
    </div></div></div>`;
  wireImgFallback(el, () => el.querySelector('.story').classList.add('noimg'));
  const text = sentences(s.title, s.text, s.wow);
  const btn = speakButton(() => text);
  el.querySelector('.sp').replaceWith(btn);
  autoSay(text, btn);
  setReady(false);
}

function choiceHTML(ch, i, showKey) {
  return `<button class="choice ${ch.img ? 'has-img' : ''}" type="button" data-i="${i}">
    ${ch.img ? `<img class="cimg" src="${esc(ch.img)}" alt="" onerror="this.remove()">` : ''}
    <span class="badges"></span>
    ${showKey ? `<span class="key">${'ABCD'[i] || ''}</span>` : ''}
    <span>${esc(ch.label)}</span>
    ${ch.detail ? `<span class="detail">${esc(ch.detail)}</span>` : ''}
  </button>`;
}

function setBadges(btns, cmd, eng) {
  const c = crew();
  btns.forEach((b, i) => {
    b.classList.toggle('pick-cmd', i === cmd);
    b.classList.toggle('pick-eng', i === eng);
    b.querySelector('.badges').innerHTML = (i === cmd ? `<span class="badge cmd">${esc(c.commander)}</span>` : '') + (i === eng ? `<span class="badge eng">${esc(c.engineer)}</span>` : '');
  });
}

function renderGuess(el, s, r) {
  el.className = 'step pad';
  const c = crew();
  const choices = s.choices || [];
  el.innerHTML = `<div class="ask">
    <div class="headrow"><div><div class="eyebrow">${esc(s.title || 'Guess!')}</div><div class="prompt">${esc(s.prompt)}</div></div><span class="sp"></span></div>
    <div class="choices guess-choices">${choices.map((ch, i) => choiceHTML(ch, i, false)).join('')}</div>
    <div class="turn"></div>
    <div class="revealslot"></div>
  </div>`;
  const btns = [...el.querySelectorAll('.choice')];
  const turn = el.querySelector('.turn');
  const slot = el.querySelector('.revealslot');
  const pbtn = speakButton(() => sentences(s.prompt, choices.map(ch => ch.label).join(', or ') + '?'));
  el.querySelector('.sp').replaceWith(pbtn);
  autoSay(sentences(s.prompt), pbtn);
  let cmd = null, eng = null, phase = 'cmd';

  const drawTurn = () => {
    turn.innerHTML = '';
    if (phase === 'cmd') {
      turn.innerHTML = `<span class="who cmd">${esc(c.commander)}</span><span>tap your guess!</span>`;
    } else if (phase === 'eng') {
      turn.innerHTML = `<span class="who eng">${esc(c.engineer)}</span><span>what's your guess?</span>`;
      const skip = h(`<button class="btn ghost small" type="button">Skip</button>`);
      skip.addEventListener('click', () => { phase = 'ready'; drawTurn(); });
      turn.append(skip);
    } else if (phase === 'ready') {
      const rb = h(`<button class="btn big glow" type="button">Reveal!</button>`);
      rb.addEventListener('click', reveal);
      turn.append(rb);
    }
  };

  btns.forEach((b, i) => b.addEventListener('click', () => {
    if (phase === 'cmd') { cmd = i; phase = 'eng'; }
    else if (phase === 'eng') { eng = i; phase = 'ready'; }
    else if (phase === 'ready') { if (eng === null) cmd = i; else eng = i; }
    else return;
    setBadges(btns, cmd, eng);
    drawTurn();
  }));

  function reveal() {
    phase = 'done';
    turn.innerHTML = '';
    const ans = typeof s.answer === 'number' ? s.answer : -1;
    btns.forEach((b, i) => { b.classList.toggle('answer', i === ans); b.classList.toggle('dim', ans >= 0 && i !== ans); });
    const hit = cmd === ans;
    const opener = ans < 0 ? 'Here is the answer!' : hit ? `Spot on, ${c.commander}!` : 'Good guess! Here is the answer:';
    const rv = h(`<div class="reveal ${s.img ? '' : 'noimg'}">
      ${s.img ? `<img class="rimg" src="${esc(s.img)}" alt="" onerror="this.remove()">` : ''}
      <div class="card"><div class="headrow"><div class="big">${esc(opener)}</div><span class="sp"></span></div><p class="lead" style="font-size:24px;margin:0">${esc(s.reveal)}</p></div>
    </div>`);
    const text = sentences(opener, s.reveal);
    const b = speakButton(() => text);
    rv.querySelector('.sp').replaceWith(b);
    slot.replaceChildren(rv);
    if (store.state.autoRead) say(text, b);
    const who = [cmd !== null ? `${c.commander} said "${choices[cmd]?.label}"` : null, eng !== null ? `${c.engineer} said "${choices[eng]?.label}"` : null].filter(Boolean).join(', ');
    store.addLog(r.id, `Guess: ${s.prompt} ${who ? who + '.' : ''} Answer: ${ans >= 0 ? choices[ans]?.label : s.reveal}`);
    setReady(true);
    rv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  drawTurn();
}

function renderQuestion(el, s, r) {
  el.className = 'step pad';
  const c = crew();
  const opts = s.options || [];
  el.innerHTML = `<div class="ask">
    <div class="eyebrow">${esc(s.title || 'Big Question')} &middot; there's no right answer</div>
    <div class="qlayout ${s.img ? '' : 'noimgq'}" ${s.img ? '' : 'style="grid-template-columns:1fr"'}>
      ${photoHTML(s.img, s.credit)}
      <div class="card" style="display:flex;flex-direction:column;gap:14px"><div class="headrow"><p class="scenario" style="margin:0">${esc(s.scenario)}</p><span class="sp"></span></div></div>
    </div>
    <div class="choices">${opts.map((o, i) => choiceHTML(o, i, true)).join('')}</div>
    <div class="turn"></div>
    <div class="revealslot"></div>
  </div>`;
  wireImgFallback(el, () => { el.querySelector('.qlayout').style.gridTemplateColumns = '1fr'; });
  const btns = [...el.querySelectorAll('.choice')];
  const turn = el.querySelector('.turn');
  const slot = el.querySelector('.revealslot');
  const scen = sentences(s.scenario, 'What would you do?', opts.map((o, i) => `${'ABCD'[i]}: ${o.label}`).join('. '));
  const sb = speakButton(() => scen);
  el.querySelector('.sp').replaceWith(sb);
  autoSay(scen, sb);
  let cmd = null, eng = null, phase = 'cmd', changing = null;

  const drawTurn = () => {
    turn.innerHTML = '';
    if (phase === 'cmd') turn.innerHTML = `<span class="who cmd">${esc(c.commander)}</span><span>what would you do? Tap one.</span>`;
    else if (phase === 'eng') {
      turn.innerHTML = `<span class="who eng">${esc(c.engineer)}</span><span>your turn. What would you do?</span>`;
    } else if (phase === 'why') {
      const box = h(`<div style="display:flex;flex-direction:column;gap:12px;width:100%">
        <div class="turn"><span class="who cmd">${esc(c.commander)}</span><span>why did you choose that? Tell ${esc(c.engineer)}!</span></div>
        <div class="whybox"><input class="textin" type="text" maxlength="160" placeholder="${esc(c.engineer)} can write ${esc(c.commander)}'s reason here (optional)"><button class="btn big glow" type="button">What really happened?</button></div>
      </div>`);
      const ask = `${c.commander}, why did you choose that? Tell ${c.engineer}!`;
      say(store.state.autoRead ? ask : '', null);
      box.querySelector('.btn').addEventListener('click', () => {
        const why = box.querySelector('input').value.trim();
        store.addLog(r.id, `${/^big question/i.test(s.title || '') ? s.title : 'Big Question: ' + (s.title || '')}. ${c.commander} chose "${opts[cmd]?.label}"${eng !== null ? `, ${c.engineer} chose "${opts[eng]?.label}"` : ''}.${why ? ` Because: ${why}` : ''}`);
        phase = 'reveal';
        drawTurn();
        showReveal();
      });
      turn.append(box);
    } else if (phase === 'reveal') {
      const row = h(`<div class="mindrow"></div>`);
      const mk = (who, name, cls) => {
        const b = h(`<button class="btn ghost small" type="button" style="border-color:${cls}">${icon('star')} ${esc(name)}: I changed my mind</button>`);
        b.addEventListener('click', () => { changing = who; turn.querySelector('.hint')?.remove(); row.after(h(`<span class="hint muted">Tap your new choice, ${esc(name)}.</span>`)); });
        return b;
      };
      row.append(mk('cmd', c.commander, 'var(--gold)'), mk('eng', c.engineer, 'var(--cyan)'));
      turn.append(row);
    }
  };

  btns.forEach((b, i) => b.addEventListener('click', () => {
    if (phase === 'cmd') { cmd = i; phase = 'eng'; }
    else if (phase === 'eng') { eng = i; phase = 'why'; }
    else if (phase === 'why') { return; }
    else if (phase === 'reveal' && changing) {
      const who = changing; changing = null;
      const before = who === 'cmd' ? cmd : eng;
      if (before === i) { turn.querySelector('.hint')?.remove(); return; }
      if (who === 'cmd') cmd = i; else eng = i;
      const name = who === 'cmd' ? c.commander : c.engineer;
      store.addStar();
      store.addLog(r.id, `${name} had a rethink and chose "${opts[i]?.label}". A star for being brave!`);
      toast(`${name} had a rethink. That's what scientists do! +1 star`);
      say(`${name} had a rethink. That's what scientists do!`);
      turn.querySelector('.hint')?.remove();
    } else return;
    setBadges(btns, cmd, eng);
    drawTurn();
  }));

  function showReveal() {
    const rv = h(`<div class="reveal noimg"><div class="card">
      <div class="headrow"><div class="eyebrow">What really happened</div><span class="sp"></span></div>
      <p class="lead" style="font-size:23px;margin:0">${esc(s.reveal)}</p>
      ${s.followUp ? `<div class="dadline" style="font-size:21px"><b>Talk about it</b><span>${esc(s.followUp)}</span></div>` : ''}
    </div></div>`);
    const text = sentences(s.reveal, s.followUp);
    const b = speakButton(() => text);
    rv.querySelector('.sp').replaceWith(b);
    slot.replaceChildren(rv);
    if (store.state.autoRead) say(text, b);
    setReady(true);
    rv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  drawTurn();
}

function renderVideo(el, s, r) {
  el.className = 'step pad';
  const id = String(s.youtubeId || '').replace(/[^\w-]/g, '');
  const start = Math.max(0, parseInt(s.start || 0, 10) || 0);
  el.innerHTML = `<div class="video">
    <div class="vframe"><img class="poster" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="">${FRAMED
      ? `<a class="play" href="https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}" target="_blank" rel="noopener" aria-label="Play video in YouTube">${icon('play')}</a>`
      : `<button class="play" type="button" aria-label="Play video">${icon('play')}</button>`}</div>
    <div class="card">
      <div class="eyebrow">Watch</div>
      <div class="headrow"><h2>${esc(s.title)}</h2><span class="sp"></span></div>
      ${s.why ? `<p class="lead" style="font-size:22px;margin:0">${esc(s.why)}</p>` : ''}
      ${s.warning ? `<div><span class="chip gold">${esc(s.warning)}</span></div>` : ''}
      ${s.channel ? `<p class="faint" style="font-size:16px;margin:0">From ${esc(s.channel)} on YouTube</p>` : ''}
      <div><a class="btn ghost small" href="https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}" target="_blank" rel="noopener">${icon('ext')} Open in YouTube</a></div>
    </div></div>`;
  const text = sentences(s.title, s.why, s.warning);
  const b = speakButton(() => text);
  el.querySelector('.sp').replaceWith(b);
  autoSay(text, b);
  const poster = el.querySelector('.poster');
  poster.addEventListener('error', () => {
    const fb = s.poster || (r && r.mission && r.mission.hero);
    if (fb && !poster.dataset.fb) { poster.dataset.fb = '1'; poster.src = fb; } else poster.remove();
  });
  el.querySelector('.play').addEventListener('click', () => {
    hush();
    if (FRAMED) return; // the link opens YouTube
    const fr = el.querySelector('.vframe');
    fr.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1${start ? `&start=${start}` : ''}" title="${esc(s.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  });
  setReady(true);
}

function renderAtHome(el, s, r) {
  el.className = 'step pad';
  const need = s.need || [];
  const steps = s.steps || [];
  el.innerHTML = `<div style="max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:20px">
    <div class="headrow"><div><div class="eyebrow">Try it at home</div><h2>${esc(String(s.title || '').replace(/^Try it at home:\s*/i, ''))}</h2></div><span class="sp"></span></div>
    <div class="athome">
      <div class="card"><h3 style="margin-bottom:14px">You need</h3><ul>${need.map((n, i) => `<li><span class="tick" role="checkbox" aria-checked="false" tabindex="0" data-i="${i}"></span><span>${esc(n)}</span></li>`).join('')}</ul></div>
      <div class="card"><h3 style="margin-bottom:14px">What to do</h3><ol>${steps.map((t, i) => `<li><span class="n">${i + 1}</span><span>${esc(t)}</span></li>`).join('')}</ol>
        ${s.why ? `<div class="wow" style="font-size:22px;margin-top:18px;font-family:var(--font-body);font-weight:500;color:var(--ink)"><span style="color:var(--accent);font-family:var(--font-display)">Why it works: </span>${esc(s.why)}</div>` : ''}
      </div>
    </div></div>`;
  el.querySelectorAll('.tick').forEach(t => {
    const flip = () => { const on = !t.classList.contains('on'); t.classList.toggle('on', on); t.setAttribute('aria-checked', on); t.innerHTML = on ? icon('check') : ''; };
    t.addEventListener('click', flip);
    t.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  });
  const text = sentences(s.title, 'You need: ' + need.join(', '), ...steps, s.why ? 'Why it works: ' + s.why : '');
  const b = speakButton(() => text);
  el.querySelector('.sp').replaceWith(b);
  autoSay(sentences(s.title), b);
  setReady(true);
  void r;
}

function renderFinish(el, s, r) {
  el.className = 'step pad';
  const c = crew();
  const m = r.mission;
  const isNew = store.earnPatch(m.id);
  if (isNew) store.addLog(m.id, `Mission complete! Earned the "${m.patch?.name || m.title}" patch.`);
  const nextId = missionIds[missionIds.indexOf(m.id) + 1];
  const deb = s.debrief || ['What was your favourite part?'];
  el.innerHTML = `<div class="finish">
    <div class="patchbig">${patchSVG({ ...m.patch, accent: m.accent, crew: c })}</div>
    <div style="display:flex;flex-direction:column;gap:20px">
      <div><div class="eyebrow">Mission complete</div><h1>${esc(m.patch?.name || m.title)}</h1>
        <p class="muted" style="font-size:22px;margin-top:8px">${isNew ? 'A new patch for the wall!' : 'You flew this mission again. Great flying!'}</p></div>
      <div class="card"><h3 style="margin-bottom:12px">Crew debrief</h3><div class="debrief">${deb.map((q, i) => `<div class="q"><span class="sp" data-i="${i}"></span><span>${esc(q)}</span></div>`).join('')}</div></div>
      <div class="mindrow"><button class="btn big home-go" type="button">${icon('home')} Mission Control</button>${nextId ? `<button class="btn ghost big next-go" type="button">Next: ${esc(missions[nextId].title)} ${icon('next')}</button>` : ''}</div>
    </div></div>`;
  el.querySelectorAll('.sp').forEach(sp => {
    const q = deb[+sp.dataset.i];
    sp.replaceWith(speakButton(() => q));
  });
  el.querySelector('.home-go').addEventListener('click', () => { location.hash = '#/'; });
  el.querySelector('.next-go')?.addEventListener('click', () => { location.hash = `#/m/${nextId}/0`; });
  if (isNew) { toast(`New patch: ${m.patch?.name || m.title}!`); burst(el); }
  autoSay(sentences(`Mission complete! You earned the ${m.patch?.name || m.title} patch`, deb[0]), null);
  setReady(true);
}

function burst(host) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5';
  host.appendChild(cv);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = host.clientWidth, H = host.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const patch = host.querySelector('.patchbig').getBoundingClientRect();
  const hb = host.getBoundingClientRect();
  const ox = patch.left - hb.left + patch.width / 2, oy = patch.top - hb.top + patch.height / 2;
  const cols = ['#f2b544', '#ffd27a', '#5fd4ff', '#f3efe6'];
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
  stepCleanup.push(() => { cancelAnimationFrame(raf); cv.remove(); });
}

function renderPlay(el, s, r, idx) {
  el.className = 'step';
  el.innerHTML = `<div class="play-host"></div>`;
  const host = el.firstElementChild;
  const c = crew();
  // Intro lives in the bottom bar so it never covers the activity.
  const intro = h(`<div style="display:flex;align-items:center;gap:12px;justify-content:center;text-transform:none;letter-spacing:0;font-family:var(--font-body);font-size:18px;color:var(--ink-2)"><span class="sp"></span><span><b style="color:var(--ink);font-family:var(--font-display)">${esc(s.title || 'Play')}</b>${s.intro ? ' &middot; ' + esc(s.intro) : ''}</span></div>`);
  const text = sentences(s.title, s.intro);
  const b = speakButton(() => text);
  intro.querySelector('.sp').replaceWith(b);
  r.label.replaceChildren(intro);
  autoSay(text, b);
  const token = stepToken;
  let inst = null;
  stepCleanup.push(() => { try { inst && inst.destroy && inst.destroy(); } catch (e) { console.warn(e); } inst = null; });
  const ctx = {
    data: s.data || {},
    speak: t => { if (store.state.autoRead) say(t); },
    stopSpeaking: hush,
    log: t => store.addLog(r.id, t),
    complete: () => { if (token === stepToken) setReady(true); },
    crew: c,
    get sound() { return !!store.state.sound; },
    save: (k, v) => store.modSave(s.module, k, v),
    load: k => store.modLoad(s.module, k),
  };
  host.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;color:var(--ink-3)">Loading...</div>`;
  import(`./games/${s.module}.js`).then(async mod => {
    if (token !== stepToken) return;
    host.innerHTML = '';
    const made = await mod.mount(host, ctx);
    if (token !== stepToken) { try { made && made.destroy && made.destroy(); } catch (e) { /* ignore */ } return; }
    inst = made;
  }).catch(err => {
    console.error(err);
    if (token !== stepToken) return;
    host.innerHTML = `<div class="card" style="max-width:640px;margin:60px auto;text-align:center">This activity couldn't load right now. Tap Next to carry on.</div>`;
    setReady(true);
  });
  void idx;
}

const RENDER = { story: renderStory, guess: renderGuess, question: renderQuestion, video: renderVideo, athome: renderAtHome, finish: renderFinish, play: renderPlay };

/* ---------------- Router ---------------- */
function route() {
  document.querySelectorAll('.modal-back').forEach(m => m.remove());
  const hash = location.hash || '#/';
  if (!store.state.crew && !hash.startsWith('#/setup')) { location.replace('#/setup'); return; }
  const m = hash.match(/^#\/m\/([\w-]+)(?:\/(\d+))?/);
  if (m && missions[m[1]]) { renderRunner(m[1], +(m[2] || 0)); return; }
  if (hash.startsWith('#/setup')) { renderSetup(); return; }
  renderHome();
}

/* ---------------- Starfield ---------------- */
function drawStars() {
  const cv = document.getElementById('stars');
  if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, hgt = window.innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = g.createRadialGradient(w * 0.78, hgt * 0.1, 0, w * 0.78, hgt * 0.1, Math.max(w, hgt) * 1.0);
  bg.addColorStop(0, '#111c3a'); bg.addColorStop(0.42, '#080d1b'); bg.addColorStop(1, '#04060b');
  g.fillStyle = bg; g.fillRect(0, 0, w, hgt);
  const neb = g.createRadialGradient(w * 0.12, hgt * 0.9, 0, w * 0.12, hgt * 0.9, w * 0.55);
  neb.addColorStop(0, 'rgba(95,212,255,0.07)'); neb.addColorStop(1, 'rgba(95,212,255,0)');
  g.fillStyle = neb; g.fillRect(0, 0, w, hgt);
  const neb2 = g.createRadialGradient(w * 0.55, hgt * 0.35, 0, w * 0.55, hgt * 0.35, w * 0.4);
  neb2.addColorStop(0, 'rgba(242,181,68,0.035)'); neb2.addColorStop(1, 'rgba(242,181,68,0)');
  g.fillStyle = neb2; g.fillRect(0, 0, w, hgt);
  let seed = 1234567;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const n = Math.round((w * hgt) / 1700);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * hgt;
    const big = rnd() > 0.94;
    const r = big ? 0.9 + rnd() * 1.1 : 0.25 + rnd() * 0.75;
    const a = big ? 0.6 + rnd() * 0.4 : 0.2 + rnd() * 0.55;
    const tint = rnd();
    g.fillStyle = tint > 0.9 ? `rgba(255,214,160,${a})` : tint > 0.8 ? `rgba(180,215,255,${a})` : `rgba(255,255,255,${a})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    if (big && rnd() > 0.5) {
      g.globalAlpha = a * 0.25;
      g.fillRect(x - r * 4, y - 0.3, r * 8, 0.6);
      g.fillRect(x - 0.3, y - r * 4, 0.6, r * 8);
      g.globalAlpha = 1;
    }
  }
}
let starTimer;
window.addEventListener('resize', () => { clearTimeout(starTimer); starTimer = setTimeout(drawStars, 150); });

/* ---------------- Keyboard (PC) ---------------- */
document.addEventListener('keydown', e => {
  if (!runner || e.target.closest('input, textarea') || document.querySelector('.modal-back')) return;
  const step = runner.mission.steps[runner.idx];
  if (step && step.type === 'play') return; // games use the keys
  if (e.key === 'ArrowRight') { e.preventDefault(); runner.nextBtn.click(); }
  if (e.key === 'ArrowLeft' && runner.idx > 0) { e.preventDefault(); go(runner.idx - 1); }
});

/* ---------------- Boot ---------------- */
async function boot() {
  drawStars();
  app.innerHTML = `<div style="height:100%;display:grid;place-items:center;color:var(--ink-3);font-family:var(--font-display);letter-spacing:.2em">LOADING</div>`;
  await loadAll();
  // Dev/testing hook: ?devcrew skips crew setup with default names.
  if (new URLSearchParams(location.search).has('devcrew') && !store.state.crew) store.set({ crew: { commander: 'Finn', engineer: 'Dad' } });
  window.addEventListener('hashchange', route);
  route();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ('serviceWorker' in navigator && (!local || location.search.includes('sw'))) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW failed', err));
  }
}

boot();
