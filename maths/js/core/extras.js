// Quick Fire, Fact Map, Arcade, Playground and the Cadet Check.
import { h, esc, injectCSS, sleep } from './dom.js';
import { icon } from './icons.js';
import { art } from './art.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { autoSay, hush, toast, burst } from './ui.js';
import { lessonLayout, answerMatches, praise, loadWidget } from './lesson.js';
import { askItem, loadGen, makeItem } from './runner.js';
import { buildDeck, recordFact, FAMILIES, unlockedFamilies, boxOf } from './fluency.js';
import { factKey } from './facts.js';
import { cover } from './covers.js';

let current = null; // { destroy() }
export function leaveExtras() {
  if (current) { try { current.destroy(); } catch (e) { console.warn(e); } }
  current = null;
  hush();
}

injectCSS('x-extras', `
  .xview { display: grid; grid-template-rows: auto minmax(0, 1fr); height: 100%; }
  .xview .xstage { position: relative; min-height: 0; overflow: hidden; }
  .xview .xstage.scroll { overflow-y: auto; }
  .flashcard { position: relative; background: #fff; color: #1b1e2e; border: 4px solid #1b1e2e; border-radius: 14px; padding: 34px 56px; min-width: 360px; text-align: center;
    font-family: var(--font-display); font-weight: 800; font-size: clamp(60px, 7vw, 92px); line-height: 1.05; letter-spacing: -0.02em;
    box-shadow: 8px 8px 0 #fff, 8px 8px 0 4px #1b1e2e, 16px 16px 0 #fff, 16px 16px 0 4px #1b1e2e; transform: rotate(-2deg); transition: transform .25s, background .25s; }
  .flashcard::before, .flashcard::after { content: ''; position: absolute; width: 34px; height: 34px; background: #1b1e2e; }
  .flashcard::before { top: -2px; right: -2px; clip-path: polygon(0 0, 100% 0, 100% 100%); border-top-right-radius: 8px; }
  .flashcard::after { bottom: -2px; left: -2px; clip-path: polygon(0 0, 0 100%, 100% 100%); border-bottom-left-radius: 8px; }
  .flashcard.good { transform: rotate(0) scale(1.03); background: #e6f6ee; }
  .flashcard .q { color: #3b82f6; border-bottom: 6px solid #3b82f6; padding: 0 .1em; }
  .qf-topo { background-color: #fff; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='160'%3E%3Cg fill='none' stroke='%23e4e7ef' stroke-width='2'%3E%3Cpath d='M-10 30 C40 10 80 50 130 30 S220 10 260 40'/%3E%3Cpath d='M-10 60 C40 40 90 80 140 60 S220 40 260 70'/%3E%3Cpath d='M-10 95 C30 75 90 115 150 95 S230 75 260 105'/%3E%3Cpath d='M-10 130 C40 110 100 150 150 128 S220 110 260 140'/%3E%3C/g%3E%3C/svg%3E"); }
  .qf-wrap { display: grid; place-items: center; height: 100%; }
  .chk-list { display: grid; gap: 10px; }
  .chk-list div { display: flex; gap: 12px; align-items: center; font-size: 21px; }
  .chk-list .ok { color: var(--green); } .chk-list .not { color: var(--cyan); }
`);

function topbar(title, back = '#/', extra = '') {
  return `<div class="topbar"><button class="btn ghost round xback" type="button" aria-label="Back">${icon('back')}</button>
    <div class="title">${esc(title)}</div><div class="spacer"></div>${extra}</div>`;
}
function wireBack(v, back) { v.querySelector('.xback').addEventListener('click', () => { location.hash = back; }); }

/* ---------------- Quick Fire ---------------- */
export function renderQuick(app, env, family = null) {
  const v = h(`<section class="view xview">${topbar('Quick Fire')}<div class="xstage"></div></section>`);
  wireBack(v, '#/');
  app.replaceChildren(v);
  const stage = v.querySelector('.xstage');
  const { tutor, con } = lessonLayout(stage);
  let alive = true;
  current = { destroy() { alive = false; tutor.destroy(); con.destroy(); } };
  const run = async () => {
    const deck = buildDeck(10, family);
    tutor.pips(deck.length);
    await tutor.lines(['Quick Fire!', `${deck.length} quick facts. Type the answer and tap the tick.`]);
    let streak = 0, first = 0, best = store.state.quick.streakBest || 0;
    const again = [];
    for (let i = 0; i < deck.length && alive; i++) {
      const card = deck[i];
      tutor.pip(i, 'now');
      const res = await flash(card);
      if (!alive) return;
      recordFact(card.key, res.firstTry);
      tutor.pip(i, res.firstTry ? 'ok' : 'help');
      if (res.firstTry) {
        first++; streak++;
        if (streak > best) best = streak;
        if (streak === 5) tutor.add(['Five in a row!'], { cls: 'good' });
        if (streak === 10) tutor.add(["Ten in a row! You're on fire."], { cls: 'good' });
      } else { streak = 0; again.push(card); }
    }
    if (!alive) return;
    store.set({ quick: { streakBest: best, rounds: (store.state.quick.rounds || 0) + 1 } });
    store.addLog('', `Quick Fire: ${first} of ${deck.length} first time.`);
    con.clearInputs();
    con.showArt('star');
    con.caption(`${first} / ${deck.length}`);
    await tutor.lines(['Round complete!', first === deck.length ? 'Every one first time!' : `${first} first time. The others will come back soon.`], { cls: 'good' });
    if (first === deck.length) burst(stage);
    tutor.actions([
      tutor.button('Go again', () => { tutor.clear(); run(); }, { iconName: 'repeat', glow: true }),
      tutor.button('Fact Map', () => { location.hash = '#/facts'; }, { ghost: true }),
      tutor.button('Mission Control', () => { location.hash = '#/'; }, { ghost: true }),
    ]);
  };
  const flash = card => new Promise(resolve => {
    let tries = 0;
    con.clearWidget();
    con.caption('');
    con.wbox.classList.remove('none');
    con.el.classList.add('qf-topo');
    con.wbox.innerHTML = `<div class="qf-wrap"><div class="flashcard">${esc(card.text).replace('?', '<span class="q">?</span>')}</div></div>`;
    const fc = con.wbox.querySelector('.flashcard');
    autoSay(card.text.includes('?') ? card.text : `${card.text}?`);
    const pad = con.numpad({ onSubmit: async val => {
      if (answerMatches(val, card.answer)) {
        pad.lock(); sfx('chime'); fc.classList.add('good');
        fc.innerHTML = esc(card.text.includes('?') ? card.text.replace('?', card.answer) : `${card.text} = ${card.answer}`);
        tutor.lines([tries ? 'There it is!' : praise()], { cls: 'good' });
        await sleep(850);
        resolve({ firstTry: tries === 0 });
      } else {
        tries++;
        sfx('click');
        if (tries === 1) { tutor.lines(['Not yet. Have another go.'], { cls: 'notyet' }); pad.clear(); }
        else {
          pad.lock();
          fc.innerHTML = esc(card.text.includes('?') ? card.text.replace('?', card.answer) : `${card.text} = ${card.answer}`);
          await tutor.lines([`It's ${card.answer}.`, "It'll come back again soon."], { cls: 'notyet' });
          await sleep(600);
          resolve({ firstTry: false });
        }
      }
    } });
  });
  run();
}

/* ---------------- Fact Map ---------------- */
function grid(rows, cols, cell) {
  const n = cols.length + 1;
  let out = `<div class="fm-grid" style="grid-template-columns:repeat(${n}, 40px)"><div class="c h"></div>`;
  for (const c of cols) out += `<div class="c h">${esc(c.h)}</div>`;
  for (const r of rows) {
    out += `<div class="c h">${esc(r.h)}</div>`;
    for (const c of cols) {
      const k = cell(r, c);
      if (!k) { out += '<div class="c" style="opacity:.15"></div>'; continue; }
      const bx = boxOf(k.key);
      out += `<div class="c ${bx >= 0 ? 'b' + bx : ''}" title="${esc(k.label)}">${bx >= 3 ? '★' : ''}</div>`;
    }
  }
  return out + '</div>';
}

export function renderFacts(app, env) {
  const v = h(`<section class="view xview">${topbar('Fact Map')}<div class="xstage scroll"><div class="factmap view" style="height:auto"></div></div></section>`);
  wireBack(v, '#/');
  const box = v.querySelector('.factmap');
  const un = new Set(unlockedFamilies().map(f => f.id));
  const r = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const lockNote = ids => {
    if (ids.some(id => un.has(id))) return '';
    const f = FAMILIES.find(x => x.id === ids[0]);
    const t = env.missions[f.after]?.title || f.after.toUpperCase();
    return `<p class="faint" style="font-size:16px;margin:4px 0 0">${icon('lock')} Unlocks after ${esc(t)}.</p>`;
  };
  const section = (title, html, ids) => `<div class="card"><h3>${esc(title)}</h3>${lockNote(ids)}<div style="margin-top:12px;overflow-x:auto">${html}</div></div>`;
  box.innerHTML = `
    <div class="fm-legend"><span><i style="background:rgba(255,255,255,.08)"></i>not met yet</span><span><i style="background:rgba(255,179,107,.5)"></i>getting there</span><span><i style="background:rgba(111,227,165,.35)"></i>nearly solid</span><span><i style="background:#6fe3a5"></i>solid ★</span>
      <button class="btn small cyan qf" type="button">${icon('bolt')} Quick Fire</button></div>
    <div class="fm-fams">
      ${section('Adding (0 to 10 plus 0 to 10)', grid(r(0, 10).map(a => ({ h: a, a })), r(0, 10).map(b => ({ h: b, b })), (row, col) => ({ key: factKey('+', row.a, col.b), label: `${row.a} + ${col.b}` })), ['add10', 'add20'])}
      ${section('Taking away within 10', grid(r(1, 10).map(a => ({ h: a, a })), r(1, 9).map(b => ({ h: '−' + b, b })), (row, col) => (col.b < row.a ? { key: `-:${row.a},${col.b}`, label: `${row.a} − ${col.b}` } : null)), ['sub10'])}
      ${section('Taking away across 10', grid(r(11, 18).map(a => ({ h: a, a })), r(2, 9).map(b => ({ h: '−' + b, b })), (row, col) => (row.a - col.b <= 9 && row.a - col.b >= 1 ? { key: `-:${row.a},${col.b}`, label: `${row.a} − ${col.b}` } : null)), ['sub20'])}
      ${section('Tens to 100', grid(r(1, 9).map(a => ({ h: a * 10, a: a * 10 })), r(1, 9).map(b => ({ h: b * 10, b: b * 10 })), (row, col) => (row.a + col.b <= 100 ? { key: factKey('+', row.a, col.b), label: `${row.a} + ${col.b}` } : null)), ['tens'])}
      ${section('Times tables: 2, 5 and 10', grid([2, 5, 10].map(t => ({ h: '×' + t, t })), r(1, 12).map(n => ({ h: n, n })), (row, col) => ({ key: factKey('x', row.t, col.n), label: `${col.n} × ${row.t}` })), ['x2', 'x5', 'x10'])}
      ${section('Dividing by 2, 5 and 10', grid([2, 5, 10].map(d => ({ h: '÷' + d, d })), r(1, 12).map(n => ({ h: n, n })), (row, col) => ({ key: `÷:${row.d * col.n},${row.d}`, label: `${row.d * col.n} ÷ ${row.d}` })), ['div'])}
    </div>`;
  box.querySelector('.qf').addEventListener('click', () => { location.hash = '#/quick'; });
  app.replaceChildren(v);
}

/* ---------------- Arcade ---------------- */
export const ARCADE = [
  { id: 'crush', title: 'Crystal Crush', about: 'Join crystals that make the number. Add or take away.', art: 'crystal', after: null },
  { id: 'drop', title: 'Bond Drop', about: 'Drop number blocks so touching pairs make the target.', art: 'star', after: null },
  { id: 'asteroids', title: 'Asteroid Sort', about: 'Blast the asteroids that fit the rule.', art: 'asteroid', after: 'l4' },
  { id: 'tiledock', title: 'Tile Dock', about: 'Make every row and column add up.', art: 'crystal', after: 'l7' },
  { id: 'landing', title: 'Rocket Landing', about: 'Land on the number line.', art: 'rocket', after: 'n3' },
  { id: 'shoprun', title: 'Shop Run', about: 'Pay the exact price with UK coins.', art: 'fuel', after: 'm4' },
];

export function renderArcade(app, env) {
  const done = store.state.done;
  const v = h(`<section class="view xview">${topbar('Arcade')}<div class="xstage scroll"><div class="mc" style="height:auto">
    <p class="muted" style="font-size:20px;margin:0">Games unlock as you finish missions. Quick Fire is always open.</p>
    <div class="gamelist">
      <div class="game" data-go="#/quick"><div class="gcover">${cover('quick')}</div><div class="gbody"><h3>Quick Fire</h3><p>Ten quick facts with the number pad.</p></div></div>
      ${ARCADE.map(g => {
        const open = !g.after || done[g.after];
        const t = env.missions[g.after]?.title || g.after;
        return `<div class="game ${open ? '' : 'locked'}" data-go="${open ? '#/arcade/' + g.id : ''}"><div class="gcover">${cover(g.id)}</div><div class="gbody"><h3>${esc(g.title)}</h3><p>${esc(g.about)}</p>${open ? '' : `<p class="faint" style="display:flex;gap:6px;align-items:center">${icon('lock')} Unlocks after ${esc(t)}</p>`}</div></div>`;
      }).join('')}
    </div></div></div></section>`);
  wireBack(v, '#/');
  v.querySelectorAll('.game').forEach(g => g.addEventListener('click', () => { if (g.dataset.go) location.hash = g.dataset.go; else toast('Finish that mission to unlock this game.'); }));
  app.replaceChildren(v);
}

export async function renderArcadeGame(app, env, id) {
  const meta = ARCADE.find(g => g.id === id);
  if (!meta) { location.hash = '#/arcade'; return; }
  const v = h(`<section class="view"><div class="fullhost"></div></section>`);
  app.replaceChildren(v);
  const host = v.querySelector('.fullhost');
  let inst = null, alive = true;
  current = { destroy() { alive = false; try { inst && inst.destroy(); } catch (e) { console.warn(e); } } };
  const done = Object.keys(store.state.done).length;
  const ctx = {
    level: done > 30 ? 3 : done > 12 ? 2 : 1,
    sfx, say: t => autoSay(t),
    save: (k, val) => store.modSave('arc-' + id, k, val),
    load: k => store.modLoad('arc-' + id, k),
    recordFact,
    onExit: () => { location.hash = '#/arcade'; },
    crew: store.state.crew || { commander: 'Finn', engineer: 'Dad' },
  };
  try {
    const mod = await import(`../arcade/${id}.js`);
    if (!alive) return;
    inst = await mod.mount(host, ctx);
    if (!alive) { try { inst && inst.destroy(); } catch (e) { /* ignore */ } }
  } catch (e) {
    console.error('ARCADE FAILED', id, e);
    host.innerHTML = `<div class="card" style="max-width:640px;margin:60px auto;text-align:center">This game is still being built. <a href="#/arcade">Back to the Arcade</a></div>`;
  }
}

/* ---------------- Playground ---------------- */
const PLAY = ['tensframe', 'partwhole', 'numberline', 'hundred', 'placevalue', 'blocks', 'blaster', 'groups', 'fractions', 'clock', 'coins', 'measure', 'shapes2d', 'shapes3d', 'rover', 'charts', 'pattern', 'balance', 'objects'];

export async function renderPlaygroundList(app) {
  const v = h(`<section class="view xview">${topbar('Playground')}<div class="xstage scroll"><div class="mc" style="height:auto">
    <p class="muted" style="font-size:20px;margin:0">Every tool with no goals. Just play.</p><div class="gamelist"></div></div></div></section>`);
  wireBack(v, '#/');
  app.replaceChildren(v);
  const list = v.querySelector('.gamelist');
  for (const w of PLAY) {
    let meta = null;
    try { meta = (await loadWidget(w)).meta; } catch (e) { continue; }
    if (!meta || !meta.playground) continue;
    // A live, read-only preview of the tool itself.
    const el = h(`<div class="game"><div class="gprev ${meta.surface === 'dark' ? 'dark' : ''}"><div></div></div><div class="gbody"><h3>${esc(meta.title || w)}</h3><p>Free play</p></div></div>`);
    list.appendChild(el);
    const PREVIEW = {
      tensframe: { colours: [7, 3], frames: 1 }, partwhole: { whole: 7, parts: [4, 3], mode: 'display' }, blaster: { size: 3, rows: 3 },
      fractions: { shape: 'circle', parts: 4, shaded: 3 }, coins: { purse: ['50p', '20p', '10p', '2p'], tray: [], showTotal: true },
      groups: { total: 12, mode: 'share', bowls: 3, filled: [4, 4, 4] }, objects: { n: 10, icon: 'rocket', arrange: 'groups', groups: [5, 5] },
      numberline: { min: 0, max: 20, hops: [{ from: 0, to: 5 }, { from: 5, to: 10 }] },
      charts: { kind: 'block', max: 8, cats: [{ label: 'Red', value: 4 }, { label: 'Blue', value: 7 }, { label: 'Green', value: 3 }, { label: 'Yellow', value: 5 }] },
    };
    try { (await loadWidget(w)).mount(el.querySelector('.gprev > div'), { ...(meta.playground || {}), ...(PREVIEW[w] || {}), readonly: true }, { readonly: true, onChange() {} }); } catch (err) { console.warn(err); }
    el.addEventListener('click', () => { location.hash = `#/play/${w}`; });
  }
}

export async function renderPlay(app, env, w) {
  const v = h(`<section class="view xview">${topbar('Playground')}<div class="xstage"></div></section>`);
  wireBack(v, '#/play');
  app.replaceChildren(v);
  const { tutor, con } = lessonLayout(v.querySelector('.xstage'));
  current = { destroy() { tutor.destroy(); con.destroy(); } };
  let meta;
  try { meta = (await loadWidget(w)).meta; } catch (e) { tutor.lines(['That tool is still being built.']); return; }
  tutor.lines([meta.title || w, 'No goals here. Just play!']);
  await con.widget(w, meta.playground || {}, { readonly: false, onChange() {} });
}

/* ---------------- Cadet Check ---------------- */
const CHECK = [
  { gen: 'number.countOn', level: 1, m: 'l1', skill: 'Counting on and back' },
  { gen: 'number.numberWords', level: 1, m: 'l2', skill: 'Numbers in words' },
  { gen: 'addsub.bondsTo', level: 2, m: 'l4', skill: 'Bonds to 10', params: { target: 10 } },
  { gen: 'number.skipCount', level: 1, m: 'l3', skill: 'Counting in 2s, 5s and 10s' },
  { gen: 'addsub.doubles', level: 1, m: 'l5', skill: 'Doubles' },
  { gen: 'addsub.factsWithin20', level: 1, m: 'l6', skill: 'Adding and taking away' },
  { gen: 'addsub.missingNumber', level: 1, m: 'l7', skill: 'Missing numbers' },
  { gen: 'fractions.nameFraction', level: 1, m: 'l8', skill: 'Halves and quarters' },
  { gen: 'geometry.name2d', level: 1, m: 'l9', skill: 'Naming shapes' },
  { gen: 'time.readClock', level: 1, m: 'l10', skill: "O'clock and half past" },
  { gen: 'measure.compareY1', level: 1, m: 'l11', skill: 'Longer, heavier, fuller' },
];

export async function renderCheck(app, env) {
  const v = h(`<section class="view xview">${topbar('Cadet Check')}<div class="xstage"></div></section>`);
  wireBack(v, '#/');
  app.replaceChildren(v);
  const stage = v.querySelector('.xstage');
  const { tutor, con } = lessonLayout(stage);
  let alive = true;
  current = { destroy() { alive = false; tutor.destroy(); con.destroy(); } };
  const c = store.state.crew || { commander: 'Finn', engineer: 'Dad' };
  con.showArt('astronaut');
  await tutor.lines([`Hello, Commander ${c.commander}.`, 'Some warm-up questions to find where to start.', 'Just have a go. No score!']);
  if (!alive) return;
  await new Promise(res => tutor.actions([tutor.button("Let's go", () => { tutor.actions([]); res(); }, { glow: true, iconName: 'next' })]));
  const results = {};
  const items = CHECK.filter(x => env.missions[x.m]);
  tutor.pips(items.length);
  for (let i = 0; i < items.length && alive; i++) {
    const x = items[i];
    tutor.pip(i, 'now');
    let g;
    try { g = await loadGen(x.gen); } catch (e) { console.warn('check: missing', x.gen); tutor.pip(i, ''); continue; }
    const item = makeItem(g, Math.min(x.level, g.levels || 1), x.params, new Set());
    if (!item) continue;
    const res = await askItem({ tutor, con }, item, { checkMode: true });
    if (!alive) return;
    results[x.m] = res.correct;
    tutor.pip(i, 'ok');
  }
  if (!alive) return;
  const skip = Object.entries(results).filter(([, ok]) => ok).map(([m]) => m);
  store.set({ check: { at: Date.now(), results, skip } });
  const firstGap = env.data.path.find(id => env.missions[id] && !skip.includes(id) && !store.tierOf(id));
  store.addLog('', `Cadet Check: ${skip.length} of ${Object.keys(results).length} warm-ups first time.`);
  con.clearInputs();
  con.clearWidget();
  con.caption('');
  con.wbox.classList.remove('none');
  con.wbox.style.overflowY = 'auto';
  con.wbox.innerHTML = `<div style="padding:24px"><div class="chk-list">${items.filter(x => x.m in results).map(x => `<div class="${results[x.m] ? 'ok' : 'not'}">${results[x.m] ? '✓' : '→'} <span style="color:var(--ink)">${esc(x.skill)}</span> <span class="faint" style="font-size:16px">${results[x.m] ? 'ready' : "let's practise"}</span></div>`).join('')}</div></div>`;
  const fm = firstGap && env.missions[firstGap];
  await tutor.lines(['Check complete. Thank you!', fm ? `Let's start with ${fm.title}.` : 'You are ready for Year 2!'], { cls: 'good' });
  tutor.actions([
    fm ? tutor.button(`Start: ${fm.title}`, () => { location.hash = `#/m/${firstGap}/1/0`; }, { glow: true, iconName: 'next' }) : null,
    tutor.button('Mission Control', () => { location.hash = '#/'; }, { ghost: true }),
  ]);
}
