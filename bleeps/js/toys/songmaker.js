// The Song Maker: tap boxes to make a song.
// Tiny mode (the Co-pilot): 8 big boxes, 5 magic notes, boom and tss.
// Big mode (the Commander): 16 boxes a page, up to 4 pages, 8 notes, 3 drums, a chord row, long notes,
// a band of four channels to switch on and off, and a Tracker view (the song going down the screen).
// props: { mode: 'tiny'|'big', slot: 'win'|'music', sharing: true, start: 'kit', ruleChange: true, studio, arg }
import { h, esc, injectCSS, clamp } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { note, drum, ensure, stopAll, noteLabel, noteName, muteBus } from '../core/chip.js';
import { Sequencer } from '../core/seq.js';
import { botSVG, sing } from '../core/bots.js';
import { sticker, COVER_STICKERS } from '../core/stickers.js';
import { store } from '../core/store.js';
import { modal, burst} from '../core/ui.js';
import {
  emptySong, cleanSong, copySong, stepsOf, stepDur, rowNotes, scheduleStep, demoSongs, trackerRow, newId,
  CHORDS, CHORD_KEYS, SPEEDS, speedIndex, BOTS, TUNE_BOTS, DRUM_KINDS, colourOf, PAGE, MAX_PAGES, NOTE_COL,
} from '../core/song.js';

const COVER_COLS = ['#ff4f45', '#3b82f6', '#f5b400', '#8b5cf6', '#14b8a6', '#e2459a', '#1fa35c', '#1b1b24'];
const SPEED_ART = { snail: 'snail', tortoise: 'tortoise', cat: 'cat', hare: 'hare', rocket: 'rocket' };
const DRUM_GLYPH = {
  boom: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="currentColor"/></svg>',
  tap: '<svg viewBox="0 0 40 40"><rect x="8" y="8" width="24" height="24" rx="5" fill="currentColor"/></svg>',
  tss: '<svg viewBox="0 0 40 40"><path d="M20 4 24 16 36 20 24 24 20 36 16 24 4 20 16 16Z" fill="currentColor"/></svg>',
};
const DRUM_LABEL = { boom: 'Boom', tap: 'Tap', tss: 'Tss' };

export function mount(el, props = {}, api) {
  injectCSS('t-song', CSS);
  const slot = props.slot || null;
  const studio = !!props.studio && !slot;
  let song = null;
  let page = 0;
  let tool = 'dot';
  let seq = null;
  let follow = true;
  let tracker = false;
  let history = [];
  let placed = 0;
  let plays = 0;
  let turn = 'commander';
  let ruleShown = false;
  let destroyed = false;
  const timers = [];

  const root = h(`<div class="t-song">
    <div class="sm-main">
      <div class="sm-top"></div>
      <div class="sm-gridwrap"><div class="sm-grid"></div><div class="sm-tracker hidden"></div></div>
    </div>
    <aside class="sm-side"></aside>
  </div>`);
  el.appendChild(root);
  const topEl = root.querySelector('.sm-top');
  const gridEl = root.querySelector('.sm-grid');
  const trackEl = root.querySelector('.sm-tracker');
  const side = root.querySelector('.sm-side');

  /* ---------- Starting song ---------- */
  function initial() {
    const mode = props.mode || (slot === 'win' ? 'tiny' : 'big');
    if (props.arg) {
      const s = store.song(props.arg) || demoSongs().find(d => d.id === props.arg);
      if (s) return cleanSong(s);
    }
    if (slot) {
      const draft = store.modLoad('songmaker', 'draft-' + slot);
      if (draft) return cleanSong(draft);
      if (slot === 'win' && store.kit('win')) return cleanSong(store.kit('win'));
      if (slot === 'music') { const k = store.kit('music'); const s = k && store.song(k.id); if (s) return cleanSong(s); }
    }
    const s = emptySong(mode);
    if (props.start === 'kit' && mode === 'big') {
      const beat = store.kit('beat');
      if (beat && beat.length) for (const p of [0, 8]) for (const [st, k] of beat) s.drums.push([st + p, k]);
      const ch = store.kit('chords');
      s.chords = (ch && ch.length ? ch : ['home', 'rainy', 'sunny', 'ready']).slice(0, 4);
      const sp = store.state.choices?.speed;
      if (sp === 'slow') s.speed = 'tortoise'; else if (sp === 'fast') s.speed = 'hare';
    }
    if (slot === 'win') s.speed = 'hare';
    return s;
  }

  /* ---------- Saving drafts and history ---------- */
  function touch() {
    if (slot) store.modSave('songmaker', 'draft-' + slot, song);
    else if (studio) store.modSave('songmaker', 'draft', song);
  }
  function snapshot() {
    history.push(JSON.stringify(song));
    if (history.length > 40) history.shift();
  }
  function undo() {
    const last = history.pop();
    if (!last) { api.toast('Nothing to undo'); return; }
    song = cleanSong(JSON.parse(last));
    page = Math.min(page, pagesOf() - 1);
    touch();
    renderAll();
    note({ voice: 'bleep', duty: 0.5, midi: 67, to: 60, dur: 0.12 });
  }

  const tiny = () => song.mode === 'tiny';
  const pagesOf = () => (tiny() ? 1 : Math.max(1, song.pages || 1));
  const cols = () => (tiny() ? 8 : PAGE);
  const drumKinds = () => (tiny() ? ['boom', 'tss'] : DRUM_KINDS);
  const drumIndex = k => DRUM_KINDS.indexOf(k);

  /* ---------- Top bar: pages and band ---------- */
  function renderTop() {
    topEl.innerHTML = '';
    if (tiny()) {
      topEl.appendChild(sharingBar() || h(`<div class="sm-hint">${icon('hand')}<span>Tap the boxes, then press <b>Play</b>!</span></div>`));
      return;
    }
    const pages = h(`<div class="sm-pages"></div>`);
    for (let p = 0; p < pagesOf(); p++) {
      const sp = song.pageSpeed?.[p];
      const b = h(`<button class="sm-page ${p === page ? 'on' : ''}" type="button">${'ABCD'[p]}${sp ? `<span class="pspd">${sticker(SPEED_ART[sp] || 'hare')}</span>` : ''}</button>`);
      b.addEventListener('click', () => {
        if (p === page && pagesOf() > 1) { pageMenu(p, b); return; }
        page = p; follow = false; renderGrid(); renderTop();
      });
      pages.appendChild(b);
    }
    if (pagesOf() < MAX_PAGES) {
      const add = h(`<button class="sm-page add" type="button" aria-label="Add a page">${icon('plus')}</button>`);
      add.addEventListener('click', () => addPage(add));
      pages.appendChild(add);
    }
    topEl.appendChild(pages);
    const sh = sharingBar();
    if (sh) topEl.appendChild(sh);
    topEl.appendChild(h(`<div class="grow"></div>`));
    const band = h(`<div class="sm-band"><span class="bl">Band</span></div>`);
    const members = [
      { k: 'lead', name: 'Tune', bot: song.lead },
      { k: 'chords', name: 'Chords', bot: 'bleep', sparkle: true },
      { k: 'bass', name: 'Bass', bot: 'hoot' },
      { k: 'drums', name: 'Drums', bot: 'fizz' },
    ];
    for (const m of members) {
      const off = !!song.mute?.[m.k];
      const b = h(`<button class="sm-member ${off ? 'off' : ''}" type="button" aria-pressed="${!off}" title="${m.name}"><span class="face">${botSVG(m.bot, { label: false, sleep: off })}</span><span>${m.name}</span></button>`);
      b.addEventListener('click', () => {
        song.mute = { ...song.mute, [m.k]: !off };
        muteBus(m.k, !off);
        touch();
        renderTop();
        if (off) { if (m.k === 'drums') drum('boom'); else note({ voice: m.k === 'bass' ? 'hoot' : m.bot, midi: m.k === 'bass' ? 48 : 72, dur: 0.2, duty: m.k === 'chords' ? 0.25 : song.duty }); }
        api.say(off ? `${m.name} on!` : `${m.name} off. Shh!`);
      });
      band.appendChild(b);
    }
    topEl.appendChild(band);
  }

  function sharingBar() {
    if (!props.sharing) return null;
    const c = api.crew;
    const how = store.state.choices?.sharing || 'together';
    if (how === 'turns') return h(`<div class="sm-share"><span class="who ${turn}">${esc(c[turn])}'s turn</span><span class="muted">one box each</span></div>`);
    if (how === 'highlow') return h(`<div class="sm-share"><span class="who commander">${esc(c.commander)}: high notes</span><span class="who copilot">${esc(c.copilot)}: low notes and drums</span></div>`);
    if (how === 'halves') return h(`<div class="sm-share"><span class="who commander">${esc(c.commander)}: first half</span><span class="who copilot">${esc(c.copilot)}: second half</span></div>`);
    return h(`<div class="sm-share"><span class="who everyone">Everyone together!</span></div>`);
  }
  function nextTurn() {
    if (!props.sharing || (store.state.choices?.sharing || '') !== 'turns') return;
    turn = turn === 'commander' ? 'copilot' : 'commander';
    renderTop();
    api.setWho && api.setWho(turn);
  }

  function addPage(anchor) {
    const body = h(`<div class="col gap"><button class="btn big" data-a="copy">${icon('copy')} Copy page ${'ABCD'[page]}</button><button class="btn big" data-a="empty">${icon('plus')} Empty page</button></div>`);
    const close = modal('Add a page', body);
    body.querySelector('[data-a=copy]').addEventListener('click', () => { snapshot(); copyPage(page, pagesOf()); song.pages = pagesOf() + 1; page = song.pages - 1; close(); touch(); renderAll(); });
    body.querySelector('[data-a=empty]').addEventListener('click', () => { snapshot(); song.pages = pagesOf() + 1; page = song.pages - 1; const o = page * PAGE; for (let i = 0; i < 4; i++) song.chords[o / 4 + i] = song.chords[i] || null; close(); touch(); renderAll(); });
  }
  function copyPage(from, to) {
    const a = from * PAGE, b = to * PAGE;
    song.notes = song.notes.filter(n => n[0] < b || n[0] >= b + PAGE);
    song.drums = song.drums.filter(d => d[0] < b || d[0] >= b + PAGE);
    for (const n of song.notes.filter(n => n[0] >= a && n[0] < a + PAGE)) song.notes.push([n[0] - a + b, n[1], n[2]]);
    for (const d of song.drums.filter(d => d[0] >= a && d[0] < a + PAGE)) song.drums.push([d[0] - a + b, d[1]]);
    for (let i = 0; i < 4; i++) song.chords[b / 4 + i] = song.chords[a / 4 + i] || null;
  }
  function pageMenu(p, anchor) {
    const body = h(`<div class="col gap"><button class="btn big" data-a="del">${icon('trash')} Delete page ${'ABCD'[p]}</button></div>`);
    const close = modal(`Page ${'ABCD'[p]}`, body);
    body.querySelector('[data-a=del]').addEventListener('click', () => {
      snapshot();
      const a = p * PAGE;
      song.notes = song.notes.filter(n => n[0] < a || n[0] >= a + PAGE).map(n => (n[0] >= a + PAGE ? [n[0] - PAGE, n[1], n[2]] : n));
      song.drums = song.drums.filter(d => d[0] < a || d[0] >= a + PAGE).map(d => (d[0] >= a + PAGE ? [d[0] - PAGE, d[1]] : d));
      song.chords.splice(a / 4, 4);
      song.pageSpeed.splice(p, 1); song.pageSpeed.push(null);
      song.pages = pagesOf() - 1;
      page = Math.max(0, Math.min(page, song.pages - 1));
      close(); touch(); renderAll();
    });
  }

  /* ---------- The grid ---------- */
  function renderGrid() {
    const rows = rowNotes(song);
    const n = cols();
    const o = page * cols();
    const nr = rows.length;
    const kinds = drumKinds();
    const how = props.sharing ? store.state.choices?.sharing : null;
    gridEl.className = `sm-grid ${tiny() ? 'tiny' : 'big'}`;
    gridEl.style.setProperty('--cols', n);
    let html = `<div class="sm-block mel" style="flex:${nr}">`;
    for (let i = 0; i < nr; i++) {
      const r = nr - 1 - i;
      const midi = rows[r];
      const zone = how === 'highlow' ? (r >= Math.ceil(nr / 2) ? 'zc' : 'zp') : '';
      html += `<div class="sm-row ${zone}"><button class="sm-lab note" type="button" data-prev="m${r}" style="--c:${colourOf(midi)}"><span>${noteName(midi)}</span></button>`;
      for (let s = 0; s < n; s++) {
        const st = o + s;
        const nt = noteAt(st, r);
        const start = nt && nt[0] === st;
        const end = nt && st === nt[0] + nt[2] - 1;
        const half = how === 'halves' ? (s < n / 2 ? 'zc' : 'zp') : '';
        html += `<div class="cell m ${bandClass(s)} ${half} ${nt ? 'on' : ''} ${nt && !start ? 'held' : ''} ${nt && !end ? 'cont' : ''}" data-k="m" data-r="${r}" data-s="${st}" style="--c:${colourOf(midi)}"></div>`;
      }
      html += `</div>`;
    }
    html += `</div><div class="sm-block drums" style="flex:${kinds.length * 0.95}">`;
    for (const k of kinds) {
      const di = drumIndex(k);
      const zone = how === 'highlow' ? 'zp' : '';
      html += `<div class="sm-row ${zone}"><button class="sm-lab drum" type="button" data-prev="d${di}"><span class="g">${DRUM_GLYPH[k]}</span><span class="t">${DRUM_LABEL[k]}</span></button>`;
      for (let s = 0; s < n; s++) {
        const st = o + s;
        const on = song.drums.some(d => d[0] === st && d[1] === di);
        const half = how === 'halves' ? (s < n / 2 ? 'zc' : 'zp') : '';
        html += `<div class="cell d ${k} ${bandClass(s)} ${half} ${on ? 'on' : ''}" data-k="d" data-r="${di}" data-s="${st}">${on ? DRUM_GLYPH[k] : ''}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    if (!tiny()) {
      html += `<div class="sm-block chords" style="flex:1.05"><div class="sm-row"><div class="sm-lab chl"><span class="g">${icon('sparkle')}</span><span class="t">Chords</span></div>`;
      for (let c = 0; c < n / 4; c++) {
        const key = song.chords[(o / 4) + c];
        const ch = CHORDS[key];
        html += `<button class="cell ch ${ch ? 'on' : ''}" type="button" data-k="c" data-c="${o / 4 + c}" style="grid-column:span 4;${ch ? `--c:${ch.col};--i:${ch.ink}` : ''}">${ch ? `<span class="chi">${sticker(chordArt(key))}</span><span>${ch.name}</span>` : `<span class="faint">${icon('plus')}</span>`}</button>`;
      }
      html += `</div></div>`;
    }
    gridEl.innerHTML = html;
  }
  const bandClass = s => (tiny() ? (Math.floor(s / 4) % 2 ? 'b1' : 'b0') : (Math.floor(s / 4) % 2 ? 'b1' : 'b0')) + (s % (tiny() ? 4 : 8) === 0 && s ? ' bar' : '');
  const chordArt = key => { const c = CHORDS[key]; return c.icon === 'cloud' ? (c.mood === 'sad' ? (key === 'cloudy' ? 'greycloud' : 'rain') : 'greycloud') : c.icon; };
  const noteAt = (st, r) => song.notes.find(n => n[1] === r && st >= n[0] && st < n[0] + (n[2] || 1));

  /* ---------- Painting ---------- */
  let gesture = null;
  function playCell(k, r) {
    if (k === 'm') { const midi = rowNotes(song)[r]; note({ voice: song.lead, midi, dur: 0.28, duty: song.duty ?? 0.5, vol: 0.9, wobble: song.fx?.wobble ? 0.7 : 0 }); }
    else drum(DRUM_KINDS[r]);
  }
  function apply(cell) {
    const k = cell.dataset.k;
    const r = +cell.dataset.r;
    const st = +cell.dataset.s;
    if (!gesture) return;
    if (gesture.kind !== k) return;
    const key = `${k}${r}:${st}`;
    if (gesture.seen.has(key)) return;
    gesture.seen.add(key);
    if (k === 'm') {
      const nt = noteAt(st, r);
      if (gesture.mode === 'erase') { if (nt) { song.notes = song.notes.filter(x => x !== nt); gesture.changed = true; } }
      else if (gesture.mode === 'stretch') {
        const a = gesture.anchor;
        if (r === a[1] && st > a[0] && Math.floor(st / cols()) === Math.floor(a[0] / cols())) {
          const blocker = song.notes.find(x => x !== a && x[1] === r && x[0] > a[0] && x[0] <= st);
          const end = blocker ? blocker[0] - 1 : st;
          if (end - a[0] + 1 !== a[2]) { a[2] = end - a[0] + 1; gesture.changed = true; }
          gesture.seen.clear();
        }
      } else if (!nt) {
        song.notes.push([st, r, 1]); gesture.changed = true; placed++; playCell('m', r);
      }
    } else if (k === 'd') {
      const has = song.drums.find(d => d[0] === st && d[1] === r);
      if (gesture.mode === 'erase') { if (has) { song.drums = song.drums.filter(d => d !== has); gesture.changed = true; } }
      else if (!has) { song.drums.push([st, r]); gesture.changed = true; placed++; playCell('d', r); }
    }
    renderGrid();
  }
  gridEl.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    ensure();
    const lab = e.target.closest('.sm-lab');
    if (lab && lab.dataset.prev) { const p = lab.dataset.prev; playCell(p[0], +p.slice(1)); lab.classList.add('hit'); setTimeout(() => lab.classList.remove('hit'), 150); return; }
    const chc = e.target.closest('.cell.ch');
    if (chc) { chordPicker(+chc.dataset.c); return; }
    const cell = e.target.closest('.cell');
    if (!cell) return;
    e.preventDefault();
    snapshot();
    const k = cell.dataset.k, r = +cell.dataset.r, st = +cell.dataset.s;
    let mode = 'add';
    if (k === 'm') {
      const nt = noteAt(st, r);
      if (nt) mode = 'erase';
      else if (tool === 'long' && !tiny()) { const a = [st, r, 1]; song.notes.push(a); placed++; playCell('m', r); gesture = { kind: k, mode: 'stretch', anchor: a, seen: new Set(), changed: true }; renderGrid(); capture(e); return; }
    } else if (song.drums.some(d => d[0] === st && d[1] === r)) mode = 'erase';
    gesture = { kind: k, mode, seen: new Set(), changed: false };
    apply(cell);
    capture(e);
  });
  function capture(e) { try { gridEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } gesture.pid = e.pointerId; gesture.x = e.clientX; gesture.y = e.clientY; }
  gridEl.addEventListener('pointermove', e => {
    if (!gesture || e.pointerId !== gesture.pid) return;
    // Walk from the last point to this one so a fast swipe still fills every box it crosses.
    const x0 = gesture.x ?? e.clientX, y0 = gesture.y ?? e.clientY;
    const dist = Math.hypot(e.clientX - x0, e.clientY - y0);
    const n = Math.max(1, Math.ceil(dist / 10));
    for (let i = 1; i <= n; i++) {
      const x = x0 + ((e.clientX - x0) * i) / n, y = y0 + ((e.clientY - y0) * i) / n;
      const t = document.elementFromPoint(x, y);
      const cell = t && t.closest && t.closest('.sm-grid .cell');
      if (cell && cell.dataset.k === gesture.kind) apply(cell);
    }
    gesture.x = e.clientX; gesture.y = e.clientY;
  });
  const endGesture = e => {
    if (!gesture || (e && e.pointerId !== gesture.pid)) return;
    const changed = gesture.changed;
    gesture = null;
    if (!changed) { history.pop(); return; }
    touch();
    nextTurn();
    checkProgress();
  };
  gridEl.addEventListener('pointerup', endGesture);
  gridEl.addEventListener('pointercancel', endGesture);

  function chordPicker(slotIndex) {
    const body = h(`<div class="sm-chords">${CHORD_KEYS.map(k => { const c = CHORDS[k]; return `<button class="chtile" type="button" data-k="${k}" style="background:${c.col};color:${c.ink}"><span class="chi">${sticker(chordArt(k))}</span><b>${c.name}</b><small>${c.sym}</small></button>`; }).join('')}<button class="chtile none" type="button" data-k="">${icon('close')}<b>No chord</b></button></div>`);
    const close = modal('Pick a chord', body, { wide: true });
    body.querySelectorAll('.chtile').forEach(b => {
      b.addEventListener('pointerdown', () => { const c = CHORDS[b.dataset.k]; if (c) note({ voice: 'bleep', duty: 0.25, midi: c.root + 12, arp: c.iv.concat(c.iv[0] + 12), arpRate: 1 / 24, dur: 0.9, vol: 0.8 }); });
      b.addEventListener('click', () => {
        snapshot();
        song.chords[slotIndex] = b.dataset.k || null;
        touch(); renderGrid(); close(); checkProgress();
      });
    });
  }

  /* ---------- Playing ---------- */
  function play() {
    if (seq) { stop(); return; }
    ensure();
    for (const k of ['lead', 'chords', 'bass', 'drums']) muteBus(k, false);
    seq = new Sequencer({
      steps: () => stepsOf(song),
      stepDur: st => stepDur(song, st),
      schedule: (st, t, d) => scheduleStep(song, st, t, d),
      onStep: st => showStep(st),
      loop: true,
    });
    const from = tiny() ? 0 : page * PAGE;
    follow = true;
    seq.start(from);
    plays++;
    renderSide();
    checkProgress();
  }
  function stop() {
    if (seq) { seq.stop(); seq = null; }
    gridEl.querySelectorAll('.now').forEach(c => c.classList.remove('now'));
    trackEl.querySelectorAll('.now').forEach(c => c.classList.remove('now'));
    renderSide();
  }
  function showStep(st) {
    const pg = tiny() ? 0 : Math.floor(st / PAGE);
    if (!tiny() && follow && pg !== page) { page = pg; renderGrid(); renderTop(); }
    gridEl.querySelectorAll('.now').forEach(c => c.classList.remove('now'));
    gridEl.querySelectorAll(`.cell[data-s="${st}"]`).forEach(c => c.classList.add('now'));
    if (st % 4 === 0) gridEl.querySelectorAll(`.cell.ch[data-c="${st / 4}"]`).forEach(c => c.classList.add('now'));
    const botEl = side.querySelector('.sm-bots .bot.sel');
    if (botEl && song.notes.some(n => n[0] === st)) sing(botEl, 250);
    if (tracker) {
      trackEl.querySelectorAll('.now').forEach(c => c.classList.remove('now'));
      const row = trackEl.querySelector(`[data-s="${st}"]`);
      if (row) { row.classList.add('now'); const top = row.offsetTop - trackEl.clientHeight / 2 + row.offsetHeight / 2; trackEl.scrollTop = top; }
    }
  }

  /* ---------- Tracker view ---------- */
  function renderTracker() {
    const n = stepsOf(song);
    let html = `<div class="tk-head"><span>ROW</span><span>TUNE</span><span>CHORD</span><span>BASS</span><span>DRUM</span></div>`;
    let lastChord = null;
    for (let st = 0; st < n; st++) {
      const r = trackerRow(song, st);
      const tune = r.lead.length ? r.lead.map(m => noteLabel(m).replace(/^([A-G])(\d)$/, '$1-$2')).join(' ') : r.held ? '|||' : '---';
      const ch = r.chord ? CHORDS[r.chord] : null;
      if (st % 4 === 0) lastChord = ch;
      const bass = ch ? noteLabel(ch.root - 12).replace(/^([A-G]#?)(\d)$/, (m, a, b) => (a.length === 1 ? a + '-' : a) + b) : st % 4 === 2 && lastChord ? noteLabel(lastChord.root - 5).replace(/^([A-G]#?)(\d)$/, (m, a, b) => (a.length === 1 ? a + '-' : a) + b) : '...';
      const dr = r.drums.length ? r.drums.map(d => d.toUpperCase()).join('+') : '...';
      html += `<div class="tk-row ${st % (tiny() ? 4 : 8) === 0 ? 'bar' : ''}" data-s="${st}"><span>${String(st).padStart(2, '0')}</span><span class="tn">${tune}</span><span>${ch ? ch.sym : st % 4 ? '' : '...'}</span><span>${bass}</span><span>${dr}</span></div>`;
    }
    trackEl.innerHTML = html;
  }
  function setTracker(on) {
    tracker = on;
    trackEl.classList.toggle('hidden', !on);
    gridEl.classList.toggle('hidden', on);
    if (on) { renderTracker(); api.say('This is the tracker. The song goes down the screen, one row at a time.'); }
    renderSide();
  }

  /* ---------- Side panel ---------- */
  function renderSide() {
    const playing = !!seq;
    const sp = SPEEDS[speedIndex(song.speed)];
    side.innerHTML = `
      <button class="btn sm-play ${playing ? 'primary' : 'go'}" type="button" data-a="play">${icon(playing ? 'stop' : 'play')}<span class="pixel">${playing ? 'STOP' : 'PLAY'}</span></button>
      <div class="sm-lbl">Tune robot</div>
      <div class="sm-bots">${TUNE_BOTS.map(b => `<button class="bot ${song.lead === b ? 'sel' : ''}" type="button" data-bot="${b}" title="${esc(BOTS[b].name)}" style="--bc:${BOTS[b].col}">${botSVG(b, { label: false, table: b === 'crew' ? store.kit('wave')?.table : null })}</button>`).join('')}</div>
      <div class="sm-two">
        <button class="btn sm-speed" type="button" data-a="speed" title="Speed: ${sp.name}"><span class="stk">${sticker(SPEED_ART[sp.id])}</span><span>${sp.name}</span></button>
        <button class="btn sm-undo" type="button" data-a="undo" aria-label="Undo">${icon('back')}<span>Undo</span></button>
      </div>
      ${tiny() ? '' : `<div class="sm-two">
        <button class="btn small ${song.scale === 'magic' ? 'on' : ''}" type="button" data-a="scale" title="Magic notes always sound good">${icon('sparkle')} ${song.scale === 'magic' ? 'Magic' : 'All'}</button>
        <button class="btn small ${tool === 'long' ? 'on' : ''}" type="button" data-a="long" title="Draw long notes">${icon(tool === 'long' ? 'long' : 'dot')} ${tool === 'long' ? 'Long' : 'Short'}</button>
      </div>
      <div class="sm-two">
        <button class="btn small ${tracker ? 'on' : ''}" type="button" data-a="tracker">${icon('list')} Tracker</button>
        <button class="btn small" type="button" data-a="clear">${icon('trash')} Clear</button>
      </div>`}
      ${tiny() ? `<button class="btn small" type="button" data-a="clear">${icon('trash')} Clear</button>` : ''}
      <div class="grow"></div>
      ${saveButtonHTML()}`;
    side.querySelector('[data-a=play]').addEventListener('pointerdown', e => { e.preventDefault(); play(); });
    side.querySelectorAll('.sm-bots .bot').forEach(b => b.addEventListener('pointerdown', () => {
      song.lead = b.dataset.bot;
      if (song.lead === 'bleep') song.duty = song.duty || 0.5;
      touch();
      note({ voice: song.lead, midi: 72, dur: 0.25, duty: song.duty ?? 0.5 });
      renderSide(); renderTop();
      sing(side.querySelector(`.sm-bots .bot[data-bot="${song.lead}"]`), 500);
    }));
    side.querySelector('[data-a=speed]').addEventListener('pointerdown', () => {
      const i = (speedIndex(song.speed) + 1) % SPEEDS.length;
      song.speed = SPEEDS[i].id;
      touch();
      drum('tap');
      renderSide();
      api.say(SPEEDS[i].name + ' speed!');
    });
    side.querySelector('[data-a=undo]').addEventListener('click', undo);
    side.querySelector('[data-a=scale]')?.addEventListener('click', () => {
      snapshot();
      song.scale = song.scale === 'magic' ? 'all' : 'magic';
      touch(); renderAll();
      api.say(song.scale === 'magic' ? 'Magic notes: they always sound good together.' : 'All the notes. Try them out!');
    });
    side.querySelector('[data-a=long]')?.addEventListener('click', () => { tool = tool === 'long' ? 'dot' : 'long'; renderSide(); api.say(tool === 'long' ? 'Long notes: put your finger down and slide it along.' : 'Short notes: tap the boxes.'); });
    side.querySelector('[data-a=tracker]')?.addEventListener('click', () => setTracker(!tracker));
    side.querySelectorAll('[data-a=clear]').forEach(b => b.addEventListener('click', () => {
      if (!song.notes.length && !song.drums.length) return;
      snapshot();
      if (tiny()) { song.notes = []; song.drums = []; }
      else { const a = page * PAGE; song.notes = song.notes.filter(n => n[0] < a || n[0] >= a + PAGE); song.drums = song.drums.filter(d => d[0] < a || d[0] >= a + PAGE); }
      touch(); renderGrid();
      note({ voice: 'fizz', midi: 80, to: 60, dur: 0.3 });
      api.toast(tiny() ? 'All clear! (Undo brings it back.)' : `Page ${'ABCD'[page]} cleared. Undo brings it back.`);
    }));
    side.querySelector('[data-a=save]')?.addEventListener('click', saveDialog);
  }
  function saveButtonHTML() {
    if (slot === 'win') return `<button class="btn primary big sm-save" type="button" data-a="save">${icon('save')} Our win tune</button>`;
    if (slot === 'music') return `<button class="btn primary big sm-save" type="button" data-a="save">${icon('save')} Save our song</button>`;
    if (studio) return `<button class="btn primary big sm-save" type="button" data-a="save">${icon('save')} Save</button>`;
    return '';
  }

  /* ---------- Saving ---------- */
  function saveDialog() {
    if (!song.notes.length && !song.drums.length) { api.toast('Tap some boxes first!'); api.say('Tap some boxes first!'); return; }
    if (slot === 'win') {
      const s = copySong(song);
      s.name = s.name || 'Win tune';
      store.setKit('win', s);
      api.log(`Made our win tune: ${describe(s)}.`);
      api.toast('Saved as the Moon Run win tune!');
      api.say('Saved! Moon Run will play this when you reach the flag.');
      burst(root, side.querySelector('.sm-save'));
      api.done();
      return;
    }
    const c = api.crew;
    const n = (store.state.songs || []).filter(s => !s.demo).length + 1;
    let name = song.name || (slot === 'music' ? 'Moon Run Song' : `Song ${n}`);
    let col = song.cover?.col || COVER_COLS[(n - 1) % COVER_COLS.length];
    let stk = song.cover?.sticker || COVER_STICKERS[(n - 1) % COVER_STICKERS.length];
    const body = h(`<div class="sm-savebox">
      <div class="sm-cart"></div>
      <div class="col gap grow">
        <div class="field"><label for="smname">Song name</label><input id="smname" type="text" maxlength="24" value="${esc(name)}" autocomplete="off"></div>
        <div><div class="sm-lbl">Colour</div><div class="row gap-s wrap">${COVER_COLS.map(x => `<button class="sw" type="button" data-c="${x}" style="background:${x}"></button>`).join('')}</div></div>
        <div><div class="sm-lbl">Sticker</div><div class="row gap-s wrap">${COVER_STICKERS.map(x => `<button class="st" type="button" data-s="${x}">${sticker(x)}</button>`).join('')}</div></div>
        <button class="btn primary big" type="button" data-a="ok">${icon('save')} ${slot === 'music' ? 'Save and put it in Moon Run' : 'Save to the Jukebox'}</button>
      </div></div>`);
    const draw = () => {
      body.querySelector('.sm-cart').innerHTML = cartridgeHTML({ name, col, sticker: stk, crew: c });
      body.querySelectorAll('.sw').forEach(b => b.classList.toggle('on', b.dataset.c === col));
      body.querySelectorAll('.st').forEach(b => b.classList.toggle('on', b.dataset.s === stk));
    };
    body.querySelector('#smname').addEventListener('input', e => { name = e.target.value.trim() || 'Our song'; draw(); });
    body.querySelectorAll('.sw').forEach(b => b.addEventListener('click', () => { col = b.dataset.c; draw(); note({ voice: 'bleep', midi: 76, dur: 0.08 }); }));
    body.querySelectorAll('.st').forEach(b => b.addEventListener('click', () => { stk = b.dataset.s; draw(); note({ voice: 'bleep', midi: 79, dur: 0.08 }); }));
    const close = modal('Make a cartridge', body, { wide: true });
    body.querySelector('[data-a=ok]').addEventListener('click', () => {
      if (song.demo) { song = copySong(song); song.id = newId(); song.demo = false; }
      song.name = name; song.cover = { col, sticker: stk };
      store.saveSong(song);
      if (slot === 'music') store.setKit('music', { id: song.id });
      store.modSave('songmaker', 'draft' + (slot ? '-' + slot : ''), null);
      api.log(`Saved the song "${name}" to the Jukebox${slot === 'music' ? ' and made it the Moon Run music' : ''}.`);
      close();
      api.toast(`"${name}" is in the Jukebox!`);
      api.say(slot === 'music' ? `${name} is now the music for Moon Run!` : `${name} is in the Jukebox!`);
      burst(root, side.querySelector('.sm-save'));
      api.done();
    });
    draw();
  }
  function describe(s) {
    const rows = rowNotes(s);
    return s.notes.slice().sort((a, b) => a[0] - b[0]).map(n => noteName(rows[n[1]])).join(' ') || 'drums only';
  }

  /* ---------- Progress, the rule change ---------- */
  function checkProgress() {
    if (!slot && !studio && placed >= 5 && plays >= 1) api.done(false);
    if (props.ruleChange && !ruleShown && song.notes.length >= 8 && plays >= 1) {
      ruleShown = true;
      timers.push(setTimeout(() => { if (!destroyed) ruleChange(); }, 2500));
    }
  }
  function ruleChange() {
    stop();
    const c = api.crew;
    const next = SPEEDS[Math.min(SPEEDS.length - 1, speedIndex(song.speed) + 1)].id;
    const body = h(`<div class="sm-news">
      <div class="sm-newsbot">${botSVG('crew', { table: store.kit('wave')?.table })}</div>
      <div class="col gap grow">
        <div class="eyebrow">News from the game designer</div>
        <p class="lead" style="margin:0">The last part of Moon Run is harder. Can the music get faster there?</p>
        <p class="muted" style="margin:0">${esc(c.commander)}, you make the final call. Talk about it first!</p>
        <div class="col gap-s">
          <button class="btn big" data-a="part">${sticker('speedup', { size: 52 })} Add a faster part at the end</button>
          <button class="btn big" data-a="all">${sticker('hare', { size: 52 })} Make it all faster</button>
          <button class="btn big" data-a="same">${sticker('tortoise', { size: 52 })} Keep it the same</button>
        </div>
      </div></div>`);
    const close = modal('A rule has changed!', body, { wide: true });
    api.say('News from the game designer! The last part of Moon Run is harder. Can the music get faster there? Talk about it, then the Commander makes the final call.');
    note({ voice: 'bleep', duty: 0.5, notes: [84, 79, 84, 91], dur: 0.1 });
    const pick = (what, text) => {
      api.log(`Rule change! The game designer asked for faster music at the end. The crew chose: ${text}.`);
      close();
      renderAll();
      api.toast(text);
    };
    body.querySelector('[data-a=part]').addEventListener('click', () => {
      snapshot();
      if (pagesOf() < MAX_PAGES) { const last = pagesOf() - 1; copyPage(last, pagesOf()); song.pages = pagesOf() + 1; }
      song.pageSpeed[pagesOf() - 1] = next;
      page = pagesOf() - 1;
      touch();
      pick('part', `a faster part (page ${'ABCD'[page]})`);
      api.say(`Page ${'ABCD'[page]} plays faster. Press play to hear it!`);
    });
    body.querySelector('[data-a=all]').addEventListener('click', () => { snapshot(); song.speed = next; touch(); pick('all', 'make it all faster'); });
    body.querySelector('[data-a=same]').addEventListener('click', () => pick('same', 'keep it the same'));
  }

  function renderAll() { renderTop(); renderGrid(); renderSide(); if (tracker) renderTracker(); }

  /* ---------- Studio: choose or carry on ---------- */
  function chooser() {
    const draft = store.modLoad('songmaker', 'draft');
    const body = h(`<div class="sm-choose">
      ${draft && (draft.notes?.length || draft.drums?.length) ? `<button class="sm-opt" data-a="draft"><span class="ic">${icon('play')}</span><b>Carry on</b><small>the song you were making</small></button>` : ''}
      <button class="sm-opt" data-a="tiny"><span class="ic big">${'<i></i>'.repeat(4)}</span><b>Tiny song</b><small>8 big boxes, for little fingers</small></button>
      <button class="sm-opt" data-a="big"><span class="ic small">${'<i></i>'.repeat(16)}</span><b>Big song</b><small>more boxes, chords, pages</small></button>
    </div>`);
    const close = modal('Make a song', body, { wide: true });
    const go = s => { song = s; page = 0; history = []; close(); renderAll(); };
    body.querySelector('[data-a=draft]')?.addEventListener('click', () => go(cleanSong(draft)));
    body.querySelector('[data-a=tiny]').addEventListener('click', () => go(emptySong('tiny')));
    body.querySelector('[data-a=big]').addEventListener('click', () => go(emptySong('big')));
  }

  song = initial();
  renderAll();
  if (studio && !props.arg) chooser();
  else if (!studio && props.intro !== false) {
    // In a mission the runner reads the step intro; nothing more to say here.
  }

  return {
    destroy() {
      destroyed = true;
      timers.forEach(clearTimeout);
      if (seq) seq.stop();
      for (const k of ['lead', 'chords', 'bass', 'drums']) muteBus(k, false);
      stopAll();
    },
    getState: () => song,
  };
}

// A cartridge picture for a song (used in the save dialog and the Jukebox).
export function cartridgeHTML({ name, col, sticker: stk, crew }) {
  return `<div class="cartridge" style="--cc:${col}">
    <div class="ct-top"><i></i><i></i><i></i></div>
    <div class="ct-label"><div class="ct-art">${sticker(stk || 'note')}</div><div class="ct-name">${esc(name || 'Our song')}</div>${crew ? `<div class="ct-by">${esc(crew.commander)} · ${esc(crew.copilot)} · ${esc(crew.engineer)}</div>` : ''}</div>
    <div class="ct-foot"></div>
  </div>`;
}

const CSS = `
.t-song { flex: 1; min-height: 0; display: flex; gap: 14px; padding: 12px 14px 12px 12px; }
.t-song .sm-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.t-song .sm-top { display: flex; align-items: center; gap: 12px; min-height: 58px; flex-wrap: wrap; }
.t-song .sm-hint { display: flex; align-items: center; gap: 10px; font-size: 22px; color: var(--ink-2); }
.t-song .sm-hint svg { width: 30px; height: 30px; }
.t-song .sm-pages { display: flex; gap: 8px; }
.t-song .sm-page { position: relative; width: 58px; height: 54px; border-radius: 14px; border: 3px solid var(--edge); background: var(--card); font-family: var(--pixel); font-size: 16px; cursor: pointer; box-shadow: 0 4px 0 var(--edge); }
.t-song .sm-page.on { background: var(--ink); color: #fff; }
.t-song .sm-page.add svg { width: 26px; height: 26px; margin: auto; }
.t-song .sm-page .pspd { position: absolute; right: -10px; top: -12px; width: 30px; height: 30px; background: var(--card); border-radius: 50%; border: 2px solid var(--edge); padding: 2px; }
.t-song .sm-share { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.t-song .sm-band { display: flex; gap: 6px; align-items: center; }
.t-song .sm-band .bl { font-family: var(--pixel); font-size: 11px; color: var(--ink-2); margin-right: 4px; }
.t-song .sm-member { display: flex; align-items: center; gap: 6px; height: 54px; padding: 0 10px 0 4px; border-radius: 14px; border: 3px solid var(--edge); background: var(--card); font-weight: 700; font-size: 16px; cursor: pointer; box-shadow: 0 3px 0 var(--edge); }
.t-song .sm-member .face { width: 38px; height: 44px; display: block; }
.t-song .sm-member .face svg { width: 100%; height: 100%; }
.t-song .sm-member.off { background: var(--bg-3); color: var(--ink-3); box-shadow: none; transform: translateY(3px); text-decoration: line-through; }
.t-song .sm-gridwrap { flex: 1; min-height: 0; position: relative; display: flex; }
.t-song .sm-grid { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.t-song .sm-block { min-height: 0; display: flex; flex-direction: column; gap: 4px; }
.t-song .sm-row { flex: 1; min-height: 0; display: grid; grid-template-columns: 76px repeat(var(--cols), 1fr); gap: 4px; }
.t-song .sm-grid.tiny .sm-row { grid-template-columns: 96px repeat(var(--cols), 1fr); gap: 8px; }
.t-song .sm-grid.tiny .sm-block { gap: 8px; }
.t-song .sm-lab { border: 3px solid var(--edge); border-radius: 12px; background: var(--card); display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 800; cursor: pointer; padding: 0; min-height: 0; color: var(--ink); }
.t-song .sm-lab.note { background: var(--c); color: #fff; font-size: 22px; text-shadow: 0 2px 0 rgba(0,0,0,.25); }
.t-song .sm-lab.note span { font-family: var(--pixel); font-size: 15px; }
.t-song .sm-lab.drum { color: var(--fizz); flex-direction: row; }
.t-song .sm-lab .g { width: 26px; height: 26px; display: flex; }
.t-song .sm-lab .g svg { width: 100%; height: 100%; }
.t-song .sm-lab .t { font-size: 14px; color: var(--ink); }
.t-song .sm-lab.chl { color: var(--a); background: var(--card-2); cursor: default; }
.t-song .sm-lab.hit { transform: scale(.94); }
.t-song .sm-grid.tiny .sm-lab.note span { font-size: 20px; }
.t-song .cell { border-radius: 10px; background: #fffdf8; border: 2px solid #d9d1c0; min-height: 0; min-width: 0; position: relative; touch-action: none; transition: background .08s, transform .08s; display: flex; align-items: center; justify-content: center; }
.t-song .cell.b1 { background: #f3eee3; }
.t-song .sm-grid.tiny .cell { border-radius: 16px; border-width: 3px; }
.t-song .cell.m.on { background: var(--c); border: 3px solid var(--edge); box-shadow: inset 0 -5px 0 rgba(0,0,0,.18); }
.t-song .cell.m.on.cont { border-top-right-radius: 3px; border-bottom-right-radius: 3px; border-right-width: 0; margin-right: -6px; z-index: 1; }
.t-song .cell.m.on.held { border-top-left-radius: 3px; border-bottom-left-radius: 3px; border-left-width: 0; }
.t-song .sm-grid.tiny .cell.m.on.cont { margin-right: -10px; }
.t-song .cell.d { color: var(--fizz); }
.t-song .cell.d.on { background: var(--fizz-soft); border: 3px solid var(--fizz-dark); }
.t-song .cell.d svg { width: 62%; height: 62%; max-width: 40px; max-height: 40px; }
.t-song .cell.d.tap svg, .t-song .cell.d.tss svg { color: var(--fizz-dark); }
.t-song .cell.now { outline: 4px solid var(--ink); outline-offset: -2px; z-index: 2; }
.t-song .cell.m.on.now { transform: scale(1.06); filter: brightness(1.15); }
.t-song .cell.d.on.now { transform: scale(1.1); background: var(--fizz); color: #fff; }
.t-song .cell.ch { border: 3px dashed #c4baa6; background: #fffdf8; cursor: pointer; font-weight: 800; font-size: 18px; gap: 8px; color: var(--ink); }
.t-song .cell.ch.on { background: var(--c); color: var(--i); border: 3px solid var(--edge); }
.t-song .cell.ch .chi { width: 38px; height: 38px; display: flex; }
.t-song .cell.ch svg { width: 100%; height: 100%; }
.t-song .cell.ch .faint svg { width: 28px; height: 28px; color: #b4aa96; }
.t-song .sm-row.zc .cell:not(.on) { background: #fff6d6; }
.t-song .sm-row.zp .cell:not(.on) { background: #fde7f2; }
.t-song .cell.zc:not(.on) { background: #fff6d6; }
.t-song .cell.zp:not(.on) { background: #fde7f2; }
.t-song .sm-tracker { flex: 1; min-height: 0; overflow-y: auto; background: var(--lcd); border: 12px solid var(--bezel); border-radius: 16px; font-family: var(--pixel); font-size: 14px; color: var(--lcd-ink); padding: 6px 10px; }
.t-song .tk-head, .t-song .tk-row { display: grid; grid-template-columns: 70px 1.4fr 1fr 1fr 1.4fr; gap: 10px; padding: 6px 8px; }
.t-song .tk-head { position: sticky; top: -6px; background: var(--lcd-2); color: var(--lcd-dark); border-bottom: 3px solid var(--lcd-dark); z-index: 1; }
.t-song .tk-row.bar { border-top: 2px dashed var(--lcd-dark); }
.t-song .tk-row.now { background: var(--lcd-ink); color: var(--lcd); }
.t-song .sm-side { width: 214px; flex: none; display: flex; flex-direction: column; gap: 10px; }
.t-song .sm-play { min-height: 92px; font-size: 18px; flex-direction: column; gap: 4px; border-radius: 22px; }
.t-song .sm-play svg { width: 40px; height: 40px; }
.t-song .sm-lbl { font-family: var(--pixel); font-size: 11px; color: var(--ink-2); margin: 2px 0 -2px; }
.t-song .sm-bots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.t-song .sm-bots .bot { min-width: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; height: 66px; border-radius: 14px; border: 3px solid var(--edge); background: var(--card); padding: 2px; cursor: pointer; }
.t-song .sm-bots .bot .botsvg { height: 100%; width: auto; max-width: 100%; }
.t-song .sm-bots .bot.sel { background: var(--bc); box-shadow: 0 0 0 3px var(--card), 0 0 0 6px var(--edge); }
.t-song .sm-two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.t-song .sm-two .btn { padding: 0 6px; min-height: 58px; font-size: 16px; gap: 6px; }
.t-song .sm-two .btn svg { width: 22px; height: 22px; }
.t-song .sm-speed, .t-song .sm-undo { flex-direction: column; min-height: 76px !important; gap: 2px !important; }
.t-song .sm-speed .stk { width: 40px; height: 40px; display: flex; }
.t-song .sm-speed .stk svg { width: 100%; height: 100%; }
.t-song .sm-save { min-height: 78px; font-size: 21px; padding: 0 12px; white-space: normal; line-height: 1.1; }
.sm-chords { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.sm-chords .chtile { min-height: 150px; border: 3px solid var(--edge); border-radius: 20px; box-shadow: var(--pop); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 22px; cursor: pointer; }
.sm-chords .chtile .chi { width: 70px; height: 70px; display: flex; }
.sm-chords .chtile small { font-family: var(--pixel); font-size: 11px; opacity: .8; }
.sm-chords .chtile.none { background: var(--card); color: var(--ink-2); }
.sm-chords .chtile.none svg { width: 50px; height: 50px; }
.sm-savebox { display: flex; gap: 28px; align-items: flex-start; }
.sm-savebox .sm-cart { width: 300px; flex: none; }
.sm-savebox .sw { width: 54px; height: 54px; border-radius: 14px; border: 3px solid var(--edge); cursor: pointer; }
.sm-savebox .sw.on, .sm-savebox .st.on { box-shadow: 0 0 0 3px var(--card), 0 0 0 6px var(--edge); }
.sm-savebox .st { width: 62px; height: 62px; border-radius: 14px; border: 3px solid var(--edge); background: var(--card); padding: 5px; cursor: pointer; }
.sm-savebox .sm-lbl { font-family: var(--pixel); font-size: 11px; color: var(--ink-2); margin-bottom: 8px; }
.sm-choose { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
.sm-choose .sm-opt { min-height: 230px; border: 3px solid var(--edge); border-radius: 22px; background: var(--card); box-shadow: var(--pop); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; cursor: pointer; font-size: 26px; padding: 16px; }
.sm-choose .sm-opt small { font-size: 18px; color: var(--ink-2); }
.sm-choose .ic { width: 120px; height: 90px; display: grid; gap: 6px; }
.sm-choose .ic svg { width: 60px; height: 60px; margin: auto; color: var(--go); }
.sm-choose .ic.big { grid-template-columns: repeat(2, 1fr); }
.sm-choose .ic.small { grid-template-columns: repeat(4, 1fr); gap: 4px; }
.sm-choose .ic i { background: var(--bleep); border-radius: 8px; border: 2px solid var(--edge); }
.sm-choose .ic.small i:nth-child(3n) { background: var(--hoot); }
.sm-choose .ic.small i:nth-child(4n) { background: var(--buzz); }
.sm-news { display: flex; gap: 24px; align-items: center; }
.sm-news .sm-newsbot { width: 180px; flex: none; }
.sm-news .btn.big { justify-content: flex-start; white-space: normal; text-align: left; }
.sm-news .btn.big svg.sticker { width: 52px; height: 52px; }
@media (max-width: 1100px) {
  .t-song .sm-side { width: 176px; }
  .t-song .sm-row { grid-template-columns: 58px repeat(var(--cols), 1fr); gap: 3px; }
  .t-song .sm-band .bl, .t-song .sm-member span:last-child { display: none; }
}
@media (max-width: 860px) {
  .t-song { flex-direction: column; }
  .t-song .sm-side { width: auto; flex-direction: row; flex-wrap: wrap; }
  .sm-savebox { flex-direction: column; align-items: center; }
}
`;
