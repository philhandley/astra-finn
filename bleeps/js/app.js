// Astra Bleeps: boot, router, Sound Station (home), crew setup, studio screens, notes and log.
import { store, crew, ROLE_NAME } from './core/store.js';
import { icon } from './core/icons.js';
import { h, esc } from './core/dom.js';
import { botSVG, sing } from './core/bots.js';
import { sticker } from './core/stickers.js';
import { patchSVG } from './core/patch.js';
import { hello, setVolume, stopAll, setCrewWave, ensure } from './core/chip.js';
import { KIT_SLOTS, BOTS } from './core/song.js';
import { toast, hush, say, autoSay, speakButton, modal, confirmBox } from './core/ui.js';
import { showMission, leaveMission } from './core/runner.js';
import { renderNotes } from './core/notes.js';

const app = document.getElementById('app');
const DATA = { list: [], missions: {} };
export const env = { data: DATA };

/* ---------------- Data ---------------- */
async function loadAll() {
  const idx = await fetch('content/missions.json').then(r => r.json());
  DATA.list = idx.missions;
  await Promise.all(DATA.list.map(m => fetch(`content/missions/${m.id}.json`).then(r => (r.ok ? r.json() : null)).then(j => { if (j) DATA.missions[m.id] = { ...m, ...j }; }).catch(() => {})));
  const dm = new URLSearchParams(location.search).get('devmission');
  if (dm && /^[\w-]+$/.test(dm)) {
    try { const m = await (await fetch(`dev/${dm}.json`)).json(); DATA.missions[m.id] = m; DATA.list.push(m); } catch (e) { console.warn('devmission failed', e); }
  }
}

/* ---------------- Shell helpers ---------------- */
let leaveCurrent = null;
function leaveAll() {
  try { leaveCurrent && leaveCurrent(); } catch (e) { console.warn(e); }
  leaveCurrent = null;
  leaveMission();
  stopAll();
  hush();
}
function mount(view) { app.replaceChildren(view); }

export function topbar({ title = '', back = '#/', extra = [] } = {}) {
  const bar = h(`<header class="topbar">
    <a class="btn round" href="${back}" aria-label="Home">${icon('home')}</a>
    <div class="title">${esc(title)}</div><div class="spacer"></div></header>`);
  extra.forEach(e => bar.appendChild(e));
  bar.appendChild(readToggle());
  return bar;
}

export function readToggle() {
  const b = h(`<button class="btn round ghost" type="button"></button>`);
  const draw = () => {
    const on = store.state.autoRead;
    b.innerHTML = icon(on ? 'speaker' : 'speakerOff');
    b.setAttribute('aria-label', on ? 'Reading aloud is on' : 'Reading aloud is off');
    b.setAttribute('aria-pressed', on);
    b.title = b.getAttribute('aria-label');
  };
  b.addEventListener('click', () => { store.set({ autoRead: !store.state.autoRead }); if (!store.state.autoRead) hush(); draw(); toast(store.state.autoRead ? 'Reading aloud: on' : 'Reading aloud: off'); });
  draw();
  return b;
}

function logoSVG() {
  return `<svg class="mark" viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#1b1b24"/><rect x="8" y="8" width="32" height="22" rx="3" fill="#9bbc0f"/><path d="M11 24V14h5v10h5V14h5v10h5V14h5" fill="none" stroke="#0f380f" stroke-width="3"/><circle cx="34" cy="37" r="3.5" fill="#b0246a"/><circle cx="26" cy="38.5" r="3.5" fill="#b0246a"/><path d="M10 37h8M14 33v8" stroke="#ece6da" stroke-width="3"/></svg>`;
}

/* ---------------- Crew setup ---------------- */
function renderSetup() {
  leaveAll();
  const c = store.state.crew || { commander: 'Finn', copilot: '', engineer: 'Dad' };
  const v = h(`<section class="view setup scroll"><div class="card">
    <div class="col gap">
      <div class="logo">${logoSVG()}<div class="word">ASTRA<br><span>BLEEPS</span></div></div>
      <h1>Welcome to the Sound Station</h1>
      <p class="lead muted">A chiptune studio for a crew of three. Meet the Bleep Bots, make sounds for a game, and write your own song.</p>
      <div class="hero">${['bleep', 'hoot', 'buzz', 'fizz'].map(b => `<div class="bot" data-bot="${b}">${botSVG(b)}</div>`).join('')}</div>
    </div>
    <div class="col gap">
      <div class="field"><label for="cmd"><span class="who commander">Commander</span><small>makes the final call</small></label><input id="cmd" type="text" maxlength="16" autocomplete="off" value="${esc(c.commander)}"></div>
      <div class="field"><label for="cop"><span class="who copilot">Co-pilot</span><small>presses the big buttons</small></label><input id="cop" type="text" maxlength="16" autocomplete="off" placeholder="Name" value="${esc(c.copilot)}"></div>
      <div class="field"><label for="eng"><span class="who engineer">Sound Engineer</span><small>the grown-up</small></label><input id="eng" type="text" maxlength="16" autocomplete="off" value="${esc(c.engineer)}"></div>
      <div><h3 style="margin:6px 0 10px">Engineer's rules</h3>
        <ol class="rules">
          <li><span class="n">1</span><span>The children have a go first. Never give the answer away.</span></li>
          <li><span class="n">2</span><span>Ask "What does it sound like?" and "Why?" more than you explain.</span></li>
          <li><span class="n">3</span><span>There are no wrong notes. Changing your mind earns a star.</span></li>
        </ol></div>
      <button class="btn primary big" type="button">${icon('play')} Start the Sound Station</button>
    </div>
  </div></section>`);
  v.querySelectorAll('.bot').forEach(b => b.addEventListener('pointerdown', () => { ensure(); hello(b.dataset.bot); sing(b); }));
  v.querySelector('.btn.primary').addEventListener('click', () => {
    const commander = v.querySelector('#cmd').value.trim() || 'Finn';
    const copilot = v.querySelector('#cop').value.trim() || 'Co-pilot';
    const engineer = v.querySelector('#eng').value.trim() || 'Dad';
    const first = !store.state.crew;
    store.set({ crew: { commander, copilot, engineer } });
    if (first) store.addLog('', `Crew formed: Commander ${commander}, Co-pilot ${copilot}, Sound Engineer ${engineer}.`);
    location.hash = '#/';
  });
  mount(v);
  autoSay('Welcome to the Sound Station! Type the crew names, then press Start.');
}

/* ---------------- Home: the Sound Station ---------------- */
const TOOLS = [
  { id: 'song', name: 'Song Maker', text: 'Tap boxes, make a song', col: 'var(--bleep)', ic: 'grid' },
  { id: 'pads', name: 'Bleep Pads', text: 'Big buttons, no wrong notes', col: 'var(--hoot)', ic: 'music' },
  { id: 'lab', name: 'Sound Lab', text: 'Jumps, lasers and coins', col: 'var(--buzz)', ic: 'sparkle' },
  { id: 'wave', name: 'Wave Drawer', text: 'Draw your own sound', col: 'var(--crew)', ic: 'wave' },
  { id: 'chords', name: 'Chord Blocks', text: 'Happy and sad loops', col: 'var(--fizz)', ic: 'pages' },
  { id: 'jukebox', name: 'Jukebox', text: 'Our songs and demos', col: 'var(--a)', ic: 'list' },
  { id: 'game', name: 'Moon Run', text: 'Play our game', col: 'var(--go)', ic: 'game' },
];

function missionArt(m) {
  if (m.art?.bot) return botSVG(m.art.bot, { label: false });
  return sticker(m.art?.sticker || 'note');
}

function renderHome() {
  leaveAll();
  const c = crew();
  const s = store.state;
  const kit = s.kit || {};
  const doneCount = DATA.list.filter(m => store.isDone(m.id)).length;
  const v = h(`<section class="view">
    <header class="topbar">
      <div class="logo">${logoSVG()}<div class="word">ASTRA<br><span>BLEEPS</span></div></div>
      <div class="spacer"></div>
      <div class="row gap-s"><span class="who commander">${esc(c.commander)}</span><span class="who copilot">${esc(c.copilot)}</span><span class="who engineer">${esc(c.engineer)}</span></div>
      <button class="btn round ghost" type="button" data-act="crew" aria-label="Change crew names">${icon('edit')}</button>
    </header>
    <div class="scroll" style="flex:1"><div class="home">
      <div class="home-top">
        <div class="stage">
          <svg class="stars" viewBox="0 0 100 60" preserveAspectRatio="none">${Array.from({ length: 40 }, (_, i) => `<rect x="${(i * 37) % 100}" y="${(i * 23) % 44}" width=".5" height=".8" fill="#fff" opacity="${0.2 + ((i * 7) % 6) / 10}"/>`).join('')}</svg>
          <div class="stagehead"><span class="pixel">TAP A BOT!</span><span style="font-size:18px;opacity:.8">The Bleep Bots</span></div>
          <div class="bots">${['bleep', 'hoot', 'buzz', 'fizz', ...(kit.wave ? ['crew'] : [])].map(b => `<div class="bot" data-bot="${b}">${botSVG(b, { table: b === 'crew' ? kit.wave?.table : null })}<div class="name">${esc(b === 'crew' ? (kit.wave?.name || BOTS.crew.name) : BOTS[b].name)}</div></div>`).join('')}</div>
          <div class="floor"></div>
        </div>
        <div class="cart">
          <div class="label"><div class="art">${moonArt()}</div><div class="col" style="gap:4px"><h3>Moon Run</h3><span class="muted" style="font-size:17px">Our game. Each mission gives it a sound.</span></div></div>
          <div class="slots">${KIT_SLOTS.map(sl => `<div class="slot ${kit[sl.id] ? 'full' : ''}"><span class="led"></span>${esc(sl.name)}</div>`).join('')}</div>
          <a class="btn go big" href="#/studio/game">${icon('game')} Play Moon Run</a>
          <div class="ridges"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
      </div>
      <div>
        <div class="section-title"><h2>Missions</h2><span class="muted">${doneCount} of ${DATA.list.length} patches</span></div>
        <div class="missions">${DATA.list.map((m, i) => {
          const done = store.isDone(m.id);
          return `<button class="mcard" type="button" data-m="${m.id}" style="background:${m.col}">
            <span class="num">${i + 1}</span>
            ${done ? `<span class="done">${patchSVG({ name: m.patch?.name || m.title, art: m.patch?.art || 'star', col: m.col, col2: m.col2, names: '', gold: m.gold })}</span>` : ''}
            <div class="pic">${missionArt(m)}</div>
            <div><h3>${esc(m.title)}</h3><div class="tag">${esc(m.tagline || '')}</div></div>
          </button>`;
        }).join('')}</div>
      </div>
      <div>
        <div class="section-title"><h2>Studio</h2><span class="muted">Free play, any time</span></div>
        <div class="tools">${TOOLS.map(t => `<a class="tool" href="#/studio/${t.id}"><span class="ic" style="background:${t.col};color:#fff">${icon(t.ic)}</span><span><h3>${esc(t.name)}</h3><p>${esc(t.text)}</p></span></a>`).join('')}</div>
      </div>
      <div class="card flat" style="display:flex;flex-direction:column;gap:14px">
        <div class="section-title" style="margin:0"><h2>Patch wall</h2><span class="chip">${icon('star')} ${s.stars || 0} changed mind${s.stars === 1 ? '' : 's'}</span></div>
        <div class="patchwall">${DATA.list.map(m => `<div class="p">${patchSVG({ name: m.patch?.name || m.title, art: m.patch?.art || 'star', col: m.col, col2: m.col2, names: `${c.commander} · ${c.copilot} · ${c.engineer}`, earned: store.isDone(m.id), gold: m.gold })}</div>`).join('')}</div>
      </div>
      <div class="homefoot">
        <a class="btn" href="#/log">${icon('log')} Crew Log</a>
        <a class="btn" href="#/notes">${icon('book')} Engineer's notes</a>
        <div class="spacer grow"></div>
        <label class="row gap-s" style="font-weight:700">${icon('volume').replace('<svg', '<svg style="width:30px;height:30px"')}<input type="range" min="0" max="100" value="${Math.round((s.volume ?? 0.8) * 100)}" aria-label="Volume" style="width:220px;accent-color:#b0246a"></label>
      </div>
    </div></div>
  </section>`);
  v.querySelectorAll('.stage .bot').forEach(b => b.addEventListener('pointerdown', () => { ensure(); hello(b.dataset.bot); sing(b); }));
  v.querySelectorAll('.mcard').forEach(b => b.addEventListener('click', () => { location.hash = `#/m/${b.dataset.m}/0`; }));
  v.querySelector('[data-act="crew"]').addEventListener('click', () => { location.hash = '#/setup'; });
  const vol = v.querySelector('input[type=range]');
  vol.addEventListener('input', () => { const x = vol.value / 100; setVolume(x); store.set({ volume: x }); });
  vol.addEventListener('change', () => hello('bleep'));
  mount(v);
}

function moonArt() {
  return `<svg viewBox="0 0 120 72" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" shape-rendering="crispEdges">
    <rect width="120" height="72" fill="#1b1b2e"/>${[[10, 8], [30, 20], [52, 6], [80, 14], [104, 9], [92, 30], [18, 34]].map(([x, y]) => `<rect x="${x}" y="${y}" width="2" height="2" fill="#fff"/>`).join('')}
    <circle cx="96" cy="20" r="9" fill="#f4e7a6"/><rect x="0" y="54" width="120" height="18" fill="#9aa1b1"/><rect x="0" y="54" width="120" height="3" fill="#c5cad6"/>
    <rect x="20" y="40" width="12" height="12" fill="#14b8a6"/><rect x="22" y="43" width="8" height="5" fill="#9bbc0f"/><rect x="21" y="52" width="3" height="3" fill="#1b1b24"/><rect x="28" y="52" width="3" height="3" fill="#1b1b24"/>
    <path d="M60 30l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z" fill="#f6c81e"/><rect x="78" y="46" width="12" height="8" fill="#6b7385"/><rect x="104" y="30" width="2" height="24" fill="#f3f4f8"/><rect x="106" y="30" width="10" height="7" fill="#e8352e"/></svg>`;
}

/* ---------------- Crew Log ---------------- */
function renderLog() {
  leaveAll();
  const items = [...(store.state.log || [])].reverse();
  const v = h(`<section class="view"></section>`);
  const exp = h(`<button class="btn small" type="button">${icon('download')} Save as text</button>`);
  v.appendChild(topbar({ title: 'Crew Log', extra: [exp] }));
  const body = h(`<div class="scroll" style="flex:1"><div class="notes">
    ${items.length ? items.map(it => `<div class="logitem"><time>${fmtTime(it.t)}</time><span>${esc(it.text)}</span></div>`).join('') : '<p class="lead muted">Nothing yet. Guesses, votes and the things you make will appear here.</p>'}
  </div></div>`);
  v.appendChild(body);
  exp.addEventListener('click', () => {
    const c = crew();
    const text = `Astra Bleeps Crew Log\nCommander ${c.commander}, Co-pilot ${c.copilot}, Sound Engineer ${c.engineer}\n\n` + (store.state.log || []).map(it => `${fmtTime(it.t)}  ${it.text}`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'astra-bleeps-crew-log.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  mount(v);
}
function fmtTime(t) { const d = new Date(t); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }

/* ---------------- Studio screens ---------------- */
const STUDIO = {
  song: { title: 'Song Maker', mod: 'songmaker' },
  pads: { title: 'Bleep Pads', mod: 'pads' },
  lab: { title: 'Sound Lab', mod: 'lab' },
  wave: { title: 'Wave Drawer', mod: 'wavedraw' },
  chords: { title: 'Chord Blocks', mod: 'chords' },
  jukebox: { title: 'Jukebox', mod: 'jukebox' },
  game: { title: 'Moon Run', mod: 'moonrun' },
};

export function toyApi(extra = {}) {
  return {
    mode: 'studio',
    crew: crew(),
    done: () => {},
    say: t => autoSay(t),
    sayNow: t => say(t),
    log: t => store.addLog('', t),
    toast,
    kit: { get: k => store.kit(k), set: (k, v) => store.setKit(k, v) },
    ...extra,
  };
}

async function renderStudio(tool, arg) {
  leaveAll();
  const def = STUDIO[tool];
  if (!def) { location.hash = '#/'; return; }
  const v = h(`<section class="view studio"></section>`);
  const bar = topbar({ title: def.title });
  v.appendChild(bar);
  const host = h(`<div class="toybody"></div>`);
  v.appendChild(host);
  mount(v);
  try {
    const mod = await import(`./toys/${def.mod}.js`);
    if (!v.isConnected) return;
    const inst = mod.mount(host, { studio: true, arg, bar }, toyApi());
    leaveCurrent = () => { try { inst && inst.destroy && inst.destroy(); } catch (e) { console.warn(e); } };
  } catch (e) {
    console.error(e);
    host.innerHTML = `<div class="card" style="margin:40px auto;max-width:640px">This part of the studio isn't ready yet.</div>`;
  }
}

/* ---------------- Router ---------------- */
async function route() {
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const dev = new URLSearchParams(location.search).has('devcrew');
  if (dev && !store.state.crew) store.set({ crew: { commander: 'Finn', copilot: 'Rosie', engineer: 'Dad' } });
  if (!store.state.crew && parts[0] !== 'setup') { renderSetup(); return; }
  const [a, b, c] = parts;
  if (!a) return renderHome();
  if (a === 'setup') return renderSetup();
  if (a === 'log') return renderLog();
  if (a === 'notes') { leaveAll(); return renderNotes(app, DATA, topbar); }
  if (a === 'studio') return renderStudio(b, c);
  if (a === 'm' && DATA.missions[b]) {
    leaveCurrent && (leaveAll());
    return showMission(app, DATA.missions[b], Math.max(0, parseInt(c || '0', 10) || 0), { list: DATA.list, missions: DATA.missions, topbar, readToggle, toyApi });
  }
  location.hash = '#/';
}

/* ---------------- Boot ---------------- */
async function boot() {
  setVolume(store.state.volume ?? 0.8);
  if (store.state.kit?.wave?.table) setCrewWave(store.state.kit.wave.table);
  try { await loadAll(); } catch (e) { console.error('Could not load missions', e); }
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && !/[?&]nosw\b/.test(location.search) && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
  }
}
boot();
