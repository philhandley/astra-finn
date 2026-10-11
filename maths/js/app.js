// Astra Maths: boot, router, Mission Control, sectors, crew setup, notes and log.
import { store } from './core/store.js';
import { icon } from './core/icons.js';
import { h, esc } from './core/dom.js';
import { patchSVG } from './core/patch.js';
import { SECTOR_COL } from './core/theme.js';
import { cover } from './core/covers.js';
import { modal, toast, confirmBox, hush } from './core/ui.js';
import { showMission, leaveMission, TIER_NAME } from './core/runner.js';
import { FAMILIES, familyStats, shakiest } from './core/fluency.js';
import { renderQuick, renderFacts, renderArcade, renderArcadeGame, renderPlaygroundList, renderPlay, renderCheck, leaveExtras, ARCADE } from './core/extras.js';

const app = document.getElementById('app');
const DATA = { sectors: [], path: [], curriculum: [], missions: {}, meta: {} };
const crew = () => store.state.crew || { commander: 'Finn', engineer: 'Dad' };
const FRAMED = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();

/* ---------------- Data ---------------- */
async function loadAll() {
  const [sec, cur] = await Promise.all([
    fetch('content/sectors.json').then(r => r.json()),
    fetch('content/curriculum.json').then(r => r.json()).catch(() => []),
  ]);
  DATA.sectors = sec.sectors;
  DATA.path = sec.path;
  DATA.curriculum = cur;
  for (const s of DATA.sectors) for (const m of s.missions) DATA.meta[m.id] = { ...m, sector: s.id };
  const ids = Object.keys(DATA.meta);
  const getMission = id => fetch(`content/missions/${id}.json`).then(r => (r.ok ? r.json() : null));
  await Promise.all(ids.map(id => getMission(id).catch(() => new Promise(r => setTimeout(r, 600)).then(() => getMission(id))).then(m => { if (m && m.steps) DATA.missions[id] = m; }).catch(() => {})));
  // Dev only: ?devmission=<name> loads dev/<name>.json as an extra mission.
  const dm = new URLSearchParams(location.search).get('devmission');
  if (dm && /^[\w-]+$/.test(dm)) {
    try { const m = await (await fetch(`dev/${dm}.json`)).json(); DATA.missions[m.id] = m; DATA.meta[m.id] = { id: m.id, title: m.title, tagline: m.tagline, sector: m.sector }; } catch (e) { console.warn('devmission failed', e); }
  }
}

const sectorOf = id => DATA.sectors.find(s => s.missions.some(m => m.id === id));
const isReady = id => !!DATA.missions[id];
const tierOf = id => store.tierOf(id);
const checkSkips = () => new Set(store.state.check?.skip || []);

function recommended() {
  const skip = checkSkips();
  const ready = DATA.path.filter(isReady);
  for (const t of [1, 2, 3]) {
    const id = ready.find(i => tierOf(i) < t && !(t === 1 && skip.has(i)));
    if (id) return { id, tier: t };
  }
  return ready.length ? { id: ready[0], tier: 3 } : null;
}

function nextAfter(id) {
  const ready = DATA.path.filter(isReady);
  const at = ready.indexOf(id);
  const after = [...ready.slice(at + 1), ...ready.slice(0, Math.max(0, at))];
  const nid = after.find(i => !tierOf(i)) || ready[at + 1];
  return nid ? { id: nid, title: DATA.missions[nid].title } : null;
}

export const env = { get missions() { return DATA.missions; }, sectorOf, nextAfter, data: DATA };

/* ---------------- Little helpers ---------------- */
function mount(view) { app.replaceChildren(view); }
function leaveAll() { leaveMission(); leaveExtras(); hush(); }
const accentOf = sid => SECTOR_COL[sid] || SECTOR_COL.number;
function patchFor(id, tier = tierOf(id)) {
  const m = DATA.missions[id] || DATA.meta[id];
  const sec = sectorOf(id);
  return patchSVG({ name: m.patch?.name || m.title, icon: m.patch?.icon || sec?.icon || 'star', accent: accentOf(sec?.id), crew: crew(), tier });
}
function ring(done, total, col) {
  const r = 26, c = 2 * Math.PI * r, f = total ? done / total : 0;
  return `<svg class="ring" viewBox="0 0 62 62" aria-hidden="true"><circle cx="31" cy="31" r="${r}" fill="rgba(5,7,13,.6)" stroke="rgba(255,255,255,.15)" stroke-width="5"/>
    <circle cx="31" cy="31" r="${r}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 31 31)"/>
    <text x="31" y="37" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="17" fill="#f3efe6">${done}/${total}</text></svg>`;
}
const starRow = tier => `<span class="tiers">${[1, 2, 3].map(i => `<span class="${i <= tier ? 'on' : ''}">${icon('star')}</span>`).join('')}</span>`;
function fmtTime(t) { const d = new Date(t); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }

/* ---------------- Launch a mission (with the level picker) ---------------- */
async function launch(id, { ask = true } = {}) {
  if (!isReady(id)) { toast('That mission is still being built.'); return; }
  const t = tierOf(id);
  if (!t || !ask) { location.hash = `#/m/${id}/1/0`; return; }
  const m = DATA.missions[id];
  const body = h(`<div style="display:flex;flex-direction:column;gap:18px">
    <p class="muted" style="font-size:20px;margin:0">${esc(m.tagline || '')}</p>
    <div class="tierpick">${[1, 2, 3].map(n => {
      const open = n <= t + 1;
      return `<button class="btn ${n === Math.min(3, t + 1) ? '' : 'ghost'}" type="button" data-t="${n}" ${open ? '' : 'disabled'}>
        <span>${'★'.repeat(n)} ${TIER_NAME[n]}${open ? '' : ' ' + icon('lock')}</span>
        <small>${n === 1 ? 'The first flight' : n === 2 ? 'Bigger numbers, fewer helpers' : 'The hardest version'}${n <= t ? ' · done' : ''}</small></button>`;
    }).join('')}</div></div>`);
  const close = modal(m.title, body);
  body.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { close(); location.hash = `#/m/${id}/${b.dataset.t}/0`; }));
}

/* ---------------- Crew setup ---------------- */
function renderSetup() {
  leaveAll();
  const c = store.state.crew || { commander: 'Finn', engineer: 'Dad' };
  const v = h(`<section class="view setup"><div class="card">
    <div><div class="eyebrow">Welcome to</div><h1>Astra Maths</h1><p class="muted" style="font-size:22px;margin-top:8px">A maths academy for a crew of two. Build it, blast it, split it, solve it.</p></div>
    <div class="crew-fields">
      <div class="field"><label for="cmd">Commander</label><input id="cmd" type="text" maxlength="16" autocomplete="off" value="${esc(c.commander)}"></div>
      <div class="field"><label for="eng">Flight Engineer</label><input id="eng" type="text" maxlength="16" autocomplete="off" value="${esc(c.engineer)}"></div>
    </div>
    <div><h3 style="margin-bottom:12px">Crew rules</h3>
      <ol class="rules">
        <li><span class="n">1</span><span>The Commander has a go first. The Engineer never gives the answer away.</span></li>
        <li><span class="n">2</span><span>Ask "how do you know?" more than you explain.</span></li>
        <li><span class="n">3</span><span>Mistakes are how we learn. Changing your mind earns a star.</span></li>
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

/* ---------------- Mission Control ---------------- */
function renderHome() {
  leaveAll();
  document.documentElement.style.setProperty('--accent', 'var(--gold)');
  const s = store.state;
  const c = crew();
  const rec = recommended();
  const firstRun = !s.check && !Object.keys(s.done).length;
  const recM = rec && DATA.missions[rec.id];
  const recS = rec && sectorOf(rec.id);
  const earned = DATA.path.filter(id => tierOf(id) > 0);
  const v = h(`<section class="view mc">
    <header class="home-head">
      <div class="wordmark">
        <svg class="mark" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="25" fill="#0b1020" stroke="rgba(255,255,255,.14)"/><ellipse cx="26" cy="27" rx="20" ry="8" fill="none" stroke="#f2b544" stroke-width="1.6" transform="rotate(-20 26 27)"/><circle cx="43" cy="20" r="2.6" fill="#5fd4ff"/><path d="M19 17h14M26 10v14M18 34h16M18 40h16" stroke="#f3efe6" stroke-width="3" stroke-linecap="round"/></svg>
        <div><h1>ASTRA MATHS</h1><div class="sub">Maths academy &middot; Commander ${esc(c.commander)} &middot; Engineer ${esc(c.engineer)}</div></div>
      </div>
      <div class="home-actions"></div>
    </header>
    <div class="row2">
      ${firstRun ? `<div class="nextcard"><div class="cover">${cover('check')}</div>
        <div class="body"><div class="eyebrow">Start here</div><h1>Cadet Check</h1>
          <p>A few warm-up questions to find the best place to start. No score, just a look around.</p>
          <div class="mindrow"><button class="btn big go-check" type="button">${icon('play')} Start the check</button><button class="btn ghost big go-first" type="button">Skip it</button></div></div></div>`
        : recM ? `<div class="nextcard" data-go="${esc(rec.id)}" style="--accent:${accentOf(recS?.id)[0]}"><div class="cover">${cover(recS?.id)}</div>
        <div class="body"><div class="eyebrow">Next on your path &middot; ${esc(recS?.title || '')}${rec.tier > 1 ? ` &middot; ${'★'.repeat(rec.tier)} ${TIER_NAME[rec.tier]}` : ''}</div>
          <h1>${esc(recM.title)}</h1><p>${esc(recM.tagline || '')}</p>
          <button class="btn big" type="button">${icon('play')} Start mission</button></div></div>`
        : `<div class="nextcard"><div class="body"><h1>Missions are loading</h1></div></div>`}
      <div class="card quickcard">
        <div><div class="eyebrow">Warm up</div><h2 style="margin-top:6px">Quick Fire</h2><p class="muted" style="font-size:18px;margin:6px 0 0">Ten quick facts to keep them fresh.</p></div>
        <button class="btn big cyan go-quick" type="button">${icon('bolt')} Quick Fire</button>
        <div class="btns">
          <button class="btn ghost go-facts" type="button">${icon('grid')} Fact Map</button>
          <button class="btn ghost go-arcade" type="button">${icon('game')} Arcade</button>
          <button class="btn ghost go-play" type="button">${icon('hand')} Playground</button>
          <button class="btn ghost go-check2" type="button">${icon('map')} Cadet Check</button>
        </div>
      </div>
    </div>
    <div>
      <div class="section-title"><h2>Star Chart</h2><span class="faint" style="font-size:17px">Year 1 at the Launch Pad, then Year 2. Any sector, any time.</span></div>
      <div class="sectors">${DATA.sectors.map(sec => {
        const ids = sec.missions.map(m => m.id);
        const done = ids.filter(id => tierOf(id) > 0).length;
        const col = accentOf(sec.id)[0];
        const status = done === 0 ? 'Not started' : done === ids.length ? 'Complete' : 'In progress';
        return `<div class="sector" data-sector="${esc(sec.id)}" role="button" tabindex="0" style="--accent:${col}">
          <div class="cover">${cover(sec.id)}<span class="status"><i></i>${status}</span><span class="yr">${esc(sec.year)}</span></div>
          <div class="sbody"><h3>${esc(sec.title)}</h3><p>${esc(sec.tagline)}</p>
            <div class="count">${done} of ${ids.length} patches</div>
            <div class="bar-prog"><i style="width:${(100 * done) / ids.length}%"></i></div></div></div>`;
      }).join('')}</div>
    </div>
    <div class="card">
      <div class="section-title"><h2>Patch wall</h2><span class="stars-row">${icon('star')} ${s.stars || 0} changed mind${s.stars === 1 ? '' : 's'}</span></div>
      <div class="patch-wall">${earned.length ? earned.map(id => `<span title="${esc(DATA.missions[id]?.title || '')}">${patchFor(id)}</span>`).join('') : '<span class="empty">Finish a mission to earn your first patch.</span>'}</div>
    </div>
  </section>`);
  const actions = v.querySelector('.home-actions');
  const logBtn = h(`<button class="btn ghost" type="button">${icon('book')} Crew Log</button>`);
  logBtn.addEventListener('click', openLog);
  const notesBtn = h(`<button class="btn ghost" type="button">${icon('notes')} Engineer's notes</button>`);
  notesBtn.addEventListener('click', openNotes);
  actions.append(logBtn, notesBtn);
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (!standalone && !FRAMED && document.documentElement.requestFullscreen) {
    const fs = h(`<button class="btn ghost round" type="button" aria-label="Full screen" title="Full screen">${icon('expand')}</button>`);
    fs.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); });
    actions.append(fs);
  }
  v.querySelector('.nextcard[data-go]')?.addEventListener('click', () => { location.hash = `#/m/${rec.id}/${rec.tier}/0`; });
  v.querySelector('.go-check')?.addEventListener('click', e => { e.stopPropagation(); location.hash = '#/check'; });
  v.querySelector('.go-first')?.addEventListener('click', e => { e.stopPropagation(); store.set({ check: { at: Date.now(), skipped: true, skip: [] } }); renderHome(); });
  v.querySelector('.go-quick').addEventListener('click', () => { location.hash = '#/quick'; });
  v.querySelector('.go-facts').addEventListener('click', () => { location.hash = '#/facts'; });
  v.querySelector('.go-arcade').addEventListener('click', () => { location.hash = '#/arcade'; });
  v.querySelector('.go-play').addEventListener('click', () => { location.hash = '#/play'; });
  v.querySelector('.go-check2').addEventListener('click', () => { location.hash = '#/check'; });
  v.querySelectorAll('[data-sector]').forEach(el => {
    const go = () => { location.hash = `#/s/${el.dataset.sector}`; };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  mount(v);
}

/* ---------------- Sector path ---------------- */
function renderSector(sid) {
  leaveAll();
  const sec = DATA.sectors.find(s => s.id === sid);
  if (!sec) { location.hash = '#/'; return; }
  const col = accentOf(sid)[0];
  document.documentElement.style.setProperty('--accent', col);
  const ids = sec.missions.map(m => m.id);
  const firstOpen = ids.find(id => !tierOf(id) && isReady(id));
  const v = h(`<section class="view sectorview" style="--accent:${col}">
    <div class="headrow" style="justify-content:flex-start;gap:18px">
      <button class="btn ghost round back" type="button" aria-label="Mission Control">${icon('back')}</button>
      <div class="eyebrow">Star Chart</div>
    </div>
    <div class="sector-hero"><div class="cover">${cover(sec.id)}</div>
      <div><div class="eyebrow">${esc(sec.year)} &middot; ${ids.filter(id => tierOf(id)).length} of ${ids.length} patches</div><h1>${esc(sec.title)}</h1>
      <p class="muted" style="font-size:20px;margin:8px 0 0">${esc(sec.tagline)}</p></div></div>
    <div class="path">${ids.map((id, i) => {
      const m = DATA.missions[id] || DATA.meta[id];
      const t = tierOf(id);
      const ready = isReady(id);
      const ahead = !t && ready && firstOpen && ids.indexOf(firstOpen) < i;
      return `<div class="node ${id === firstOpen ? 'next' : ''} ${ahead ? 'ahead' : ''}" data-id="${esc(id)}" role="button" tabindex="0" style="${ready ? '' : 'opacity:.4'}">
        ${t ? `<span class="np">${patchFor(id, t)}</span>` : ''}
        <span class="n">${id === firstOpen ? 'NEXT · ' : ''}MISSION ${i + 1}</span>
        <h3>${esc(m.title)}</h3><p>${esc(m.tagline || '')}</p>
        ${ready ? starRow(t) : '<span class="faint" style="font-size:15px">Coming soon</span>'}</div>`;
    }).join('')}</div>
  </section>`);
  v.querySelector('.back').addEventListener('click', () => { location.hash = '#/'; });
  v.querySelectorAll('.node').forEach(n => {
    const go = async () => {
      const id = n.dataset.id;
      if (!isReady(id)) { toast('That mission is still being built.'); return; }
      if (n.classList.contains('ahead')) {
        const ok = await confirmBox('Jump ahead?', 'This mission is further along the path. You can fly it now, or do the glowing one first.', 'Fly it now', 'Not yet');
        if (!ok) return;
        location.hash = `#/m/${id}/1/0`;
        return;
      }
      launch(id);
    };
    n.addEventListener('click', go);
    n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  mount(v);
}

/* ---------------- Crew Log ---------------- */
function openLog() {
  const body = h(`<div class="loglist"></div>`);
  const add = h(`<div class="logadd"><input class="textin" type="text" maxlength="200" placeholder="Add a note to the Crew Log..."><button class="btn small" type="button">${icon('plus')} Add</button></div>`);
  const list = h(`<div></div>`);
  const title = id => DATA.missions[id]?.title;
  const draw = () => {
    const items = [...store.state.log].reverse();
    list.innerHTML = items.length ? items.map(it => `<div class="logitem"><div class="when">${esc(fmtTime(it.t))}</div><div class="what">${it.m && title(it.m) ? `<b>${esc(title(it.m))}</b> &middot; ` : ''}${esc(it.text)}</div></div>`).join('')
      : `<p class="muted">Nothing here yet. Patches, guesses and Big Question answers will appear here.</p>`;
  };
  add.querySelector('button').addEventListener('click', () => {
    const inp = add.querySelector('input');
    if (inp.value.trim()) { store.addLog('', inp.value.trim()); inp.value = ''; draw(); }
  });
  const exp = h(`<div class="mindrow"><button class="btn ghost small copy" type="button">${icon('book')} Copy the log</button>${FRAMED ? '' : `<button class="btn ghost small save" type="button">${icon('download')} Save as a text file</button>`}</div>`);
  const logText = () => {
    const c = crew();
    const lines = [`Astra Maths crew log: Commander ${c.commander} and Flight Engineer ${c.engineer}`, ''];
    for (const it of store.state.log) lines.push(`${fmtTime(it.t)}  ${it.m && title(it.m) ? '[' + title(it.m) + '] ' : ''}${it.text}`);
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
    a.href = URL.createObjectURL(blob); a.download = 'astra-maths-crew-log.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  draw();
  body.append(add, list, exp);
  modal(`${crew().commander} and ${crew().engineer}'s Crew Log`, body);
}

/* ---------------- Engineer's notes ---------------- */
function openNotes() {
  const c = crew();
  const body = h(`<div class="notes"></div>`);
  const covered = {};
  for (const [id, m] of Object.entries(DATA.missions)) for (const cid of m.covers || []) (covered[cid] ||= []).push(id);
  const byYear = y => DATA.curriculum.filter(x => x.year === y && x.kind === 'statutory');
  const rtp = DATA.curriculum.filter(x => x.kind === 'rtp');
  const chip = id => { const t = tierOf(id); return `<span class="chip ${t ? 'gold' : ''}" style="min-height:28px;font-size:14px;padding:0 10px;margin:2px">${t ? '✓ ' : ''}${esc(DATA.missions[id]?.title || id)}</span>`; };
  const row = x => `<tr><td style="padding:6px 10px 6px 0;white-space:nowrap;color:var(--ink-3);font-size:15px">${esc(x.id)}</td><td style="padding:6px 10px 6px 0;font-size:17px">${esc(x.short)}</td><td style="padding:6px 0">${(covered[x.id] || []).map(chip).join('') || '<span class="faint">not yet</span>'}</td></tr>`;
  const allIds = DATA.curriculum.map(x => x.id);
  const doneIds = allIds.filter(id => (covered[id] || []).some(mid => tierOf(mid)));
  body.innerHTML = `
    <h3>The crew rules</h3>
    <ul>
      <li>${esc(c.commander)} has a go first. ${esc(c.engineer)} never gives the answer away.</li>
      <li>Ask "how do you know?" and "can you show me?" more than you explain.</li>
      <li>A "Not yet" from Nova is normal. Nova shows a hint, then the answer, then a smaller one.</li>
      <li>Changing your mind in a Big Question earns a star.</li>
    </ul>
    <h3>How a mission works</h3>
    <ul>
      <li><b>Look</b> and <b>Check in</b>: a picture and "have you done this at school?". "Yes" skips ahead to practice.</li>
      <li><b>Try it</b>: Nova talks, ${esc(c.commander)} works the blocks, blaster or clock. It describes what he did.</li>
      <li><b>Practise</b>: fresh questions every time. Three right in a row makes them harder; a "Not yet" makes them easier.</li>
      <li><b>Big Question</b> and <b>Engineer's Error</b>: talk, disagree, find the slip.</li>
      <li><b>Levels</b>: every mission can be flown as Cadet (earns the patch), Pilot and Commander (bigger numbers, fewer helpers). Each adds a star.</li>
    </ul>
    <h3>Progress</h3>
    <p style="font-size:19px">${Object.keys(store.state.done).length} missions flown. ${doneIds.length} of ${allIds.length} curriculum statements practised in a finished mission.</p>
    <h3>Times tables and facts</h3>
    <ul>${FAMILIES.map(f => { const st = familyStats(f); return `<li>${esc(f.title)}: ${st.green} solid, ${st.amber} wobbly, ${st.grey} not met yet (of ${st.total})</li>`; }).join('')}</ul>
    <p style="font-size:18px">Shakiest facts: ${esc(shakiest(10).join(', ') || 'none yet')}</p>
    <h3>This term at school</h3>
    <p style="font-size:18px">Most English primaries teach Year 2 in roughly this order (White Rose). Autumn: place value, addition and subtraction, shape, money. Spring: multiplication and division, length and height, mass, capacity and temperature. Summer: fractions, time, statistics, position and direction. Ask the teacher for the yearly overview and match the sectors to the weeks.</p>
    <h3>Curriculum checklist: Year 1</h3>
    <table style="border-collapse:collapse;width:100%">${byYear(1).map(row).join('')}</table>
    <h3>Curriculum checklist: Year 2</h3>
    <table style="border-collapse:collapse;width:100%">${byYear(2).map(row).join('')}</table>
    <h3>DfE ready-to-progress criteria</h3>
    <table style="border-collapse:collapse;width:100%">${rtp.map(row).join('')}</table>
    <h3>Mission crib notes</h3>
    ${DATA.path.filter(isReady).map(id => DATA.missions[id]).filter(m => m.dadNotes && m.dadNotes.length).map(m => `<p style="font-size:17px;margin:6px 0"><b style="color:var(--gold)">${esc(m.title)}:</b> ${m.dadNotes.map(esc).join(' ')}</p>`).join('')}
    <h3>Settings</h3>`;
  const setRow = h(`<div class="mindrow"></div>`);
  const edit = h(`<button class="btn ghost small" type="button">${icon('edit')} Change crew names</button>`);
  edit.addEventListener('click', () => { document.querySelector('.modal-back')?.remove(); location.hash = '#/setup'; });
  const reset = h(`<button class="btn ghost small" type="button">${icon('refresh')} Start fresh (clear patches, facts and log)</button>`);
  let armed = false;
  reset.addEventListener('click', () => {
    if (!armed) { armed = true; reset.innerHTML = `${icon('refresh')} Tap again to clear everything`; reset.style.borderColor = 'var(--red)'; setTimeout(() => { armed = false; reset.innerHTML = `${icon('refresh')} Start fresh (clear patches, facts and log)`; reset.style.borderColor = ''; }, 4000); return; }
    store.reset(); document.querySelector('.modal-back')?.remove(); route();
  });
  setRow.append(edit, reset);
  body.append(setRow, h(`<p class="faint" style="font-size:15px;margin-top:12px">Curriculum: National Curriculum in England, mathematics programmes of study (DfE), and DfE Mathematics guidance: key stages 1 and 2 (2020), under the Open Government Licence. Illustrations drawn for this app.</p>`));
  modal("Engineer's notes", body, { wide: true });
}

/* ---------------- Router ---------------- */
function route() {
  document.querySelectorAll('.modal-back').forEach(m => m.remove());
  const hash = location.hash || '#/';
  if (!store.state.crew && !hash.startsWith('#/setup')) { location.replace('#/setup'); return; }
  let m;
  if ((m = hash.match(/^#\/m\/([\w-]+)\/(\d)\/(\d+)/)) && isReady(m[1])) { leaveExtras(); showMission(app, env, m[1], Math.max(1, Math.min(3, +m[2])), +m[3]); return; }
  if ((m = hash.match(/^#\/m\/([\w-]+)/)) && isReady(m[1])) { location.replace(`#/m/${m[1]}/1/0`); return; }
  if ((m = hash.match(/^#\/s\/([\w-]+)/))) { renderSector(m[1]); return; }
  if (hash.startsWith('#/setup')) { renderSetup(); return; }
  if (hash.startsWith('#/quick')) { leaveAll(); renderQuick(app, env); return; }
  if (hash.startsWith('#/facts')) { leaveAll(); renderFacts(app, env); return; }
  if ((m = hash.match(/^#\/arcade\/([\w-]+)/))) { leaveAll(); renderArcadeGame(app, env, m[1]); return; }
  if (hash.startsWith('#/arcade')) { leaveAll(); renderArcade(app, env); return; }
  if ((m = hash.match(/^#\/play\/([\w-]+)/))) { leaveAll(); renderPlay(app, env, m[1]); return; }
  if (hash.startsWith('#/play')) { leaveAll(); renderPlaygroundList(app, env); return; }
  if (hash.startsWith('#/check')) { leaveAll(); renderCheck(app, env); return; }
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
  const bg = g.createRadialGradient(w * 0.8, hgt * 0.05, 0, w * 0.8, hgt * 0.05, Math.max(w, hgt));
  bg.addColorStop(0, '#1a1c25'); bg.addColorStop(0.5, '#111217'); bg.addColorStop(1, '#0b0c10');
  g.fillStyle = bg; g.fillRect(0, 0, w, hgt);
  let seed = 7654321;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const n = Math.round((w * hgt) / 1800);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * hgt, big = rnd() > 0.94;
    const r = big ? 0.9 + rnd() * 1.1 : 0.25 + rnd() * 0.75;
    const a = (big ? 0.6 + rnd() * 0.4 : 0.2 + rnd() * 0.55) * 0.45;
    const tint = rnd();
    g.fillStyle = tint > 0.9 ? `rgba(255,214,160,${a})` : tint > 0.8 ? `rgba(180,215,255,${a})` : `rgba(255,255,255,${a})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}
let starTimer;
window.addEventListener('resize', () => { clearTimeout(starTimer); starTimer = setTimeout(drawStars, 150); });

/* ---------------- Boot ---------------- */
async function boot() {
  drawStars();
  app.innerHTML = `<div style="height:100%;display:grid;place-items:center;color:var(--ink-3);font-family:var(--font-display);letter-spacing:.2em">LOADING</div>`;
  await loadAll();
  if (new URLSearchParams(location.search).has('devcrew') && !store.state.crew) store.set({ crew: { commander: 'Finn', engineer: 'Dad' } });
  // Dev only: ?devprogress fakes some finished missions and facts for screenshots.
  if (new URLSearchParams(location.search).has('devprogress') && !Object.keys(store.state.done).length) {
    const done = {};
    DATA.path.slice(0, 16).forEach((id, i) => { done[id] = { tier: 1 + (i % 3 === 0 ? 2 : i % 2), at: Date.now(), plays: 1 }; });
    const facts = {};
    for (let a = 0; a <= 10; a++) for (let b = a; a + b <= 10; b++) facts[`+:${a},${b}`] = { box: (a * 7 + b * 3) % 5, due: 0, seen: 2, right: 1 };
    for (let n = 1; n <= 8; n++) facts[`x:2,${Math.max(2, n)}`] = { box: n % 4 + 1, due: 0, seen: 2, right: 2 };
    store.set({ done, facts, check: { at: Date.now(), skip: [] }, stars: 3 });
  }
  window.addEventListener('hashchange', route);
  route();
  // Dev only: ?devopen=notes | log | tier:<missionId> opens a panel for screenshots.
  const dv = new URLSearchParams(location.search).get('devopen');
  if (dv === 'notes') setTimeout(openNotes, 300);
  else if (dv === 'log') setTimeout(openLog, 300);
  else if (dv && dv.startsWith('tier:')) setTimeout(() => launch(dv.slice(5)), 300);
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ('serviceWorker' in navigator && (!local || location.search.includes('sw'))) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW failed', err));
  }
}

boot();
export { route, launch, ARCADE };
