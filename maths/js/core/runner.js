// Mission runner: step navigation and every step type.
import { h, esc, sleep } from './dom.js';
import { icon } from './icons.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { makeRand } from './rand.js';
import { recordFact } from './fluency.js';
import { patchSVG } from './patch.js';
import { SECTOR_COL } from './theme.js';
import { canSpeak, say, autoSay, hush, speakButton, toast, burst, toggleBtn } from './ui.js';
import { lessonLayout, fill, fillValue, matches, same, answerMatches, optVal, optLabel, praise, crewScope, loadWidget } from './lesson.js';
import { sentences } from './speak.js';
import { art } from './art.js';

const STEP_LABEL = { look: 'Look', ask: 'Check in', guess: 'Guess', try: 'Try it', practise: 'Practise', question: 'Big Question', error: "Engineer's Error", athome: 'Try it at home', finish: 'Mission complete' };
export const TIER_NAME = ['', 'Cadet', 'Pilot', 'Commander'];

let R = null;          // the live runner
let cleanup = [];      // per-step cleanups
let token = 0;         // bumps on every step change; stale async work checks it
let wakeLock = null;

const crew = () => store.state.crew || { commander: 'Finn', engineer: 'Dad' };
const alive = t => t === token && R;

async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener?.('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && R) keepAwake(true); });

function leaveStep() {
  token++;
  for (const fn of cleanup.splice(0)) { try { fn(); } catch (e) { console.warn(e); } }
  hush();
}

export function leaveMission() {
  leaveStep();
  R = null;
  keepAwake(false);
}

export function stepsFor(mission, tier) {
  return (mission.steps || []).filter(s => !Array.isArray(s.tiers) || s.tiers.includes(tier));
}

/* ---------------- Shell ---------------- */
export function showMission(appEl, env, id, tier, idx) {
  const mission = env.missions[id];
  if (!R || R.id !== id || R.tier !== tier || !R.el.isConnected) build(appEl, env, mission, tier);
  showStep(idx);
}

function build(appEl, env, mission, tier) {
  leaveMission();
  const steps = stepsFor(mission, tier);
  const accent = (SECTOR_COL[mission.sector] || SECTOR_COL.number)[0];
  const el = h(`<section class="view runner" style="--accent:${accent}">
    <div class="topbar">
      <button class="btn ghost round home-btn" type="button" aria-label="Mission Control" title="Mission Control">${icon('home')}</button>
      <div class="title">${esc(mission.title)}</div>
      <span class="chip gold" title="Level">${'★'.repeat(tier)} ${TIER_NAME[tier]}</span>
      <div class="spacer"></div>
      <div class="dots">${steps.map(() => '<i></i>').join('')}</div>
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
  if (canSpeak) tools.append(toggleBtn(store.state.autoRead, 'speaker', 'speakerOff', 'Read aloud automatically', on => { store.set({ autoRead: on }); if (!on) hush(); toast(on ? 'Nova will read aloud' : 'Read-aloud off. Tap a speaker to hear a line'); }));
  tools.append(toggleBtn(store.state.sound, 'music', 'musicOff', 'Sounds', on => { store.set({ sound: on }); toast(on ? 'Sounds on' : 'Sounds off'); }));
  el.querySelector('.home-btn').addEventListener('click', () => { location.hash = '#/'; });
  R = {
    id: mission.id, tier, mission, steps, env, idx: -1, el,
    stage: el.querySelector('.stage'),
    nextBtn: el.querySelector('.next-btn'),
    backBtn: el.querySelector('.back-btn'),
    label: el.querySelector('.steplabel'),
    dots: [...el.querySelectorAll('.dots i')],
  };
  R.backBtn.addEventListener('click', () => go(R.idx - 1));
  R.nextBtn.addEventListener('click', () => {
    if (R.idx >= R.steps.length - 1) location.hash = '#/';
    else go(R.idx + 1);
  });
  R.dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  appEl.replaceChildren(el);
  keepAwake(true);
}

export function go(i) {
  if (!R) return;
  const n = Math.max(0, Math.min(R.steps.length - 1, i));
  location.hash = `#/m/${R.id}/${R.tier}/${n}`;
}

function setReady(on = true) { if (R) { R.nextBtn.classList.toggle('glow', on); R.nextBtn.classList.toggle('ghost', !on); } }

function showStep(i) {
  const r = R;
  i = Math.max(0, Math.min(r.steps.length - 1, i));
  leaveStep();
  r.idx = i;
  const step = r.steps[i];
  r.dots.forEach((d, k) => { d.className = k < i ? 'done' : k === i ? 'now' : ''; });
  r.backBtn.style.visibility = i === 0 ? 'hidden' : '';
  const last = i === r.steps.length - 1;
  r.nextBtn.innerHTML = last ? `${icon('home')} Mission Control` : `Next ${icon('next')}`;
  setReady(false);
  r.label.textContent = STEP_LABEL[step.type] || '';
  const el = h(`<div class="step"></div>`);
  r.stage.replaceChildren(el);
  const fn = RENDER[step.type] || renderUnknown;
  const t = token;
  Promise.resolve().then(() => fn(el, step, t)).catch(e => { console.error('STEP FAILED', step.type, e); if (alive(t)) renderUnknown(el); });
}

function renderUnknown(el) {
  el.className = 'step pad';
  el.innerHTML = `<div class="card" style="max-width:640px;margin:40px auto">This part isn't ready yet. Tap Next to carry on.</div>`;
  setReady(true);
}

/* ---------------- Look ---------------- */
async function renderLook(el, s, t) {
  const { tutor, con } = lessonLayout(el);
  cleanup.push(() => { tutor.destroy(); con.destroy(); });
  const scope = { ...crewScope(), ...(s.props || {}) };
  if (s.caption) con.caption(fill(s.caption, scope));
  if (s.widget) await con.widget(s.widget, s.props || {}, { readonly: true });
  else if (s.art) con.showArt(s.art);
  else if (s.big) con.showBig(fill(s.big, scope));
  if (!alive(t)) return;
  await tutor.lines((s.lines || []).map(l => fill(l, scope)));
  if (s.question && alive(t)) tutor.add([fill(s.question, scope)], { cls: 'q' });
  setReady(true);
}

/* ---------------- Ask ---------------- */
function renderAsk(el, s, t) {
  const { tutor, con } = lessonLayout(el);
  cleanup.push(() => { tutor.destroy(); con.destroy(); });
  tutor.lines([fill(s.text, crewScope())], { cls: 'q' });
  con.showArt(s.art || 'astronaut');
  const yes = con.button('Yes, I know a bit', () => {
    if (!alive(t)) return;
    store.addLog(R.id, `${crew().commander} said they have done "${R.mission.title}" at school.`);
    const nextP = R.steps.findIndex((st, k) => k > R.idx && st.type === 'practise');
    if (nextP > 0) { toast("Let's see what you know!"); go(nextP); } else go(R.idx + 1);
  });
  const no = con.button('Not yet', () => { if (alive(t)) go(R.idx + 1); }, 'ghost');
  void yes; void no;
  setReady(true);
}

/* ---------------- Guess ---------------- */
async function renderGuess(el, s, t) {
  const { tutor, con } = lessonLayout(el);
  cleanup.push(() => { tutor.destroy(); con.destroy(); });
  const c = crew();
  const scope = { ...crewScope(), ...(s.props || {}) };
  if (s.caption) con.caption(fill(s.caption, scope));
  if (s.widget) await con.widget(s.widget, s.props || {}, { readonly: true });
  else if (s.art) con.showArt(s.art);
  if (!alive(t)) return;
  tutor.lines([fill(s.prompt, scope)], { cls: 'q' });
  const opts = s.options || [];
  let cmd = null, eng = null, phase = 'cmd';
  const ch = con.choices(opts, (v, b) => {
    const i = ch.buttons.indexOf(b);
    if (phase === 'cmd') { cmd = i; phase = 'eng'; }
    else if (phase === 'eng') { eng = i; phase = 'ready'; }
    else if (phase === 'ready') { if (eng === null) cmd = i; else eng = i; }
    else return;
    sfx('click');
    badges();
    turn();
  });
  const badges = () => ch.buttons.forEach((b, i) => {
    b.querySelector('.badges')?.remove();
    const bs = (i === cmd ? `<span class="badge cmd">${esc(c.commander)}</span>` : '') + (i === eng ? `<span class="badge eng">${esc(c.engineer)}</span>` : '');
    if (bs) b.insertAdjacentHTML('beforeend', `<span class="badges">${bs}</span>`);
    b.classList.toggle('pick', i === cmd || i === eng);
  });
  const turn = () => {
    if (phase === 'cmd') tutor.actions([h(`<div class="turn"><span class="who cmd">${esc(c.commander)}</span><span>tap your guess!</span></div>`)]);
    else if (phase === 'eng') tutor.actions([h(`<div class="turn"><span class="who eng">${esc(c.engineer)}</span><span>your guess?</span></div>`), tutor.button('Skip', () => { phase = 'ready'; turn(); }, { ghost: true })]);
    else if (phase === 'ready') tutor.actions([tutor.button('Reveal!', reveal, { glow: true })]);
  };
  async function reveal() {
    phase = 'done';
    tutor.actions([]);
    const ans = typeof s.answer === 'number' ? s.answer : -1;
    ch.buttons.forEach((b, i) => { b.classList.toggle('right', i === ans); if (ans >= 0 && i !== ans) b.classList.add('tried'); });
    const opener = ans < 0 ? 'Here it is!' : cmd === ans ? `Spot on, ${c.commander}!` : 'Good guess! Here it is:';
    sfx('chime');
    if (s.revealProps && con.api) con.api.update(s.revealProps);
    store.addLog(R.id, `Guess: ${s.prompt} ${cmd !== null ? `${c.commander} said "${optLabel(opts[cmd])}".` : ''}${eng !== null ? ` ${c.engineer} said "${optLabel(opts[eng])}".` : ''}`);
    await tutor.add([opener, ...[].concat(s.reveal || []).map(l => fill(l, scope))], { cls: 'then' });
    setReady(true);
  }
  turn();
}

/* ---------------- Try (scripted widget) ---------------- */
async function renderTry(el, s, t) {
  const { tutor, con } = lessonLayout(el);
  cleanup.push(() => { tutor.destroy(); con.destroy(); });
  let state = {};
  let waiter = null;
  const props = s.props || {};
  const scope = () => ({ ...crewScope(), ...props, ...state });
  const onChange = st => {
    state = st || {};
    if (waiter && matches(waiter.goal, state)) { const w = waiter; waiter = null; clearTimeout(w.timer); setTimeout(() => w.resolve(), 350); }
  };
  await con.widget(s.widget, props, { readonly: !!props.readonly, onChange });
  if (!alive(t)) return;
  state = con.state();
  const script = s.script || [];
  const waitTap = (label = 'Got it', glow = true) => new Promise(res => tutor.actions([tutor.button(label, () => { tutor.actions([]); res(); }, { glow, iconName: 'next' })]));
  for (let j = 0; j < script.length; j++) {
    if (!alive(t)) return;
    const sub = script[j];
    con.clearInputs();
    tutor.actions([]);
    if (sub.set && con.api) { try { con.api.update(sub.set); } catch (e) { console.warn(e); } state = con.state(); }
    if ('caption' in sub) con.caption(fill(sub.caption, scope()), { glow: false });
    const lines = (sub.say || []).map(l => fill(l, scope()));
    const help = sub.hint ? tutor.button('Help', () => tutor.add(sub.hint.map(l => fill(l, scope())), { cls: 'soft' }), { ghost: true, iconName: 'help' }) : null;
    let skipped = false;
    if (sub.goal) {
      tutor.lines(lines);
      if (matches(sub.goal, state)) await sleep(500);
      else {
        skipped = await new Promise(resolve => {
          const w = { goal: sub.goal, resolve };
          // A grown-up escape hatch if a goal ever can't be reached.
          w.timer = setTimeout(() => { if (alive(t) && waiter === w) tutor.actions([help, tutor.button('Skip this bit', () => { waiter = null; resolve(true); }, { ghost: true, iconName: 'next' })]); }, 30000);
          waiter = w;
          window.__astraSkip = () => { if (waiter === w) { clearTimeout(w.timer); waiter = null; resolve(true); } }; // for automated tests
          tutor.actions([help]);
          cleanup.push(() => { clearTimeout(w.timer); waiter = null; });
        });
      }
      if (!alive(t)) return;
      if (!skipped) {
        sfx('chime');
        con.glow(true);
        setTimeout(() => con.glow(false), 900);
      }
    } else if (sub.input) {
      tutor.lines(lines, { cls: 'q' });
      const item = { lines: [], input: sub.input, answer: fillValue(sub.answer, scope()), options: sub.options, unit: sub.unit, prefix: sub.prefix, hint: sub.hint || ['Have another look.', 'Count carefully.'], explain: [] };
      await askItem({ tutor, con }, item, { mount: false, sayLines: false, t });
      if (!alive(t)) return;
    } else {
      tutor.lines(lines);
      tutor.actions([help]);
      await waitTap(j === script.length - 1 && !sub.then ? 'Got it' : 'Got it');
      if (!alive(t)) return;
    }
    if (sub.then && sub.then.length && !skipped) {
      await tutor.add(sub.then.map(l => fill(l, scope())), { cls: 'then' });
      if (!alive(t)) return;
      if (j < script.length - 1) { await waitTap('Next'); if (!alive(t)) return; }
    } else if (sub.goal && !skipped) {
      tutor.add([praise()], { cls: 'good' });
      await sleep(1000);
    } else if (sub.input) {
      await sleep(500);
    }
  }
  if (!alive(t)) return;
  con.clearInputs();
  tutor.actions([]);
  tutor.add(['Ready for the next part? Tap Next.'], { cls: 'soft', speak: false });
  setReady(true);
}

/* ---------------- Asking one item (practice, try inputs, Cadet Check) ---------------- */
// Resolves { correct, firstTry, explained }.
export function askItem({ tutor, con }, item, { mount = true, sayLines = true, t, checkMode = false, onFirstWrong } = {}) {
  const live = () => t === undefined || alive(t);
  return new Promise(async resolve => {
    let attempt = 0;
    let finished = false;
    let pad = null, ch = null, ord = null, goalTimer = null;
    const input = item.input || 'numpad';
    const scope = { ...crewScope() };
    window.__astraItem = item; // for automated tests
    if (sayLines) {
      const ls = (item.lines || []).map(l => fill(l, scope));
      tutor.lines(ls.slice(0, 1), { cls: 'q', speak: false });
      if (ls.length > 1) tutor.add(ls.slice(1), { speak: false });
      autoSay(ls.join(' '), tutor.spBtn);
    }
    if (mount) {
      const readonly = input !== 'widget' && !(item.props && item.props.interactive === true);
      if (item.widget) {
        con.caption(item.caption || '');
        await con.widget(item.widget, item.props || {}, { readonly, onChange: st => onWidget(st) });
      } else if (item.art) { con.caption(item.caption || ''); con.showArt(item.art); }
      else if (item.caption) { con.caption(''); con.showBig(item.caption, String(item.caption).length > 12 ? 'mid' : ''); }
      else { con.caption(''); con.clearWidget(); }
    }
    if (!live()) return;
    const finish = res => { if (goalTimer) clearTimeout(goalTimer); finished = true; resolve(res); };
    const answerText = () => {
      if (input === 'choice') { const o = (item.options || []).find(x => same(optVal(x), item.answer)); return String(optLabel(o) ?? item.answer); }
      if (input === 'order') return (item.answer || []).map(v => { const o = (item.options || []).find(x => same(optVal(x), v)); return optLabel(o) ?? v; }).join(', ');
      if (input === 'widget') return '';
      return `${item.prefix || ''}${item.answer}${item.unit ? ' ' + item.unit : ''}`;
    };
    const showAnswered = () => {
      const capEl = con.capEl;
      if (capEl.textContent.includes('?') && input !== 'widget') con.caption(capEl.textContent.replace('?', answerText()), { glow: true });
      else if (con.wbox.querySelector('.bigcap') && input !== 'widget') {
        const b = con.wbox.querySelector('.bigcap');
        if (b.textContent.includes('?')) b.textContent = b.textContent.replace('?', answerText());
        else if (!/=/.test(b.textContent)) b.textContent = `${b.textContent} = ${answerText()}`;
        b.style.color = 'var(--gold)';
      } else con.glow(true);
    };
    const judge = async (ok, btn) => {
      if (finished || !live()) return;
      if (ok) {
        finished = true;
        if (goalTimer) clearTimeout(goalTimer);
        pad && pad.lock();
        btn && btn.classList.add('right');
        sfx('chime');
        showAnswered();
        if (checkMode) { tutor.lines(['Thanks!'], { cls: 'good' }); await sleep(700); resolve({ correct: true, firstTry: true }); return; }
        const p = tutor.lines([attempt === 0 ? praise() : 'There it is!'], { cls: 'good', append: false });
        await Promise.race([p, sleep(1600)]);
        await sleep(300);
        resolve({ correct: true, firstTry: attempt === 0 });
        return;
      }
      attempt++;
      btn && btn.classList.add('tried');
      if (checkMode) { finished = true; pad && pad.lock(); tutor.lines(['Thanks!'], { cls: 'good' }); await sleep(700); resolve({ correct: false, firstTry: false }); return; }
      sfx('click');
      if (attempt === 1) {
        onFirstWrong && onFirstWrong();
        tutor.lines(['Not yet.'], { cls: 'notyet', speak: false });
        const hint = (item.hint && item.hint.length ? item.hint : ['Have another look.']).map(l => fill(l, scope));
        tutor.add(hint, { speak: false });
        autoSay(['Not yet.', ...hint].join(' '), tutor.spBtn);
        const unlock = item.hintProps && (item.hintProps.interactive === true || item.hintProps.readonly === false);
        if (item.hintProps && item.widget && unlock && mount && input !== 'widget' && !(item.props && item.props.interactive === true)) {
          // The hint makes a picture hands-on: remount it interactive with the hint props.
          await con.widget(item.widget, { ...(item.props || {}), ...item.hintProps, readonly: false }, { readonly: false });
        } else if (item.hintProps && con.api) { try { con.api.update(item.hintProps); } catch (e) { console.warn(e); } }
        else if (item.hintWidget && !item.widget) { await con.widget(item.hintWidget.widget, item.hintWidget.props || {}, { readonly: !(item.hintWidget.props && item.hintWidget.props.interactive) }); }
        pad && pad.clear();
        ord && setTimeout(() => ord.reset(), 400);
        return;
      }
      // Second "Not yet": explain and show the answer.
      finished = true;
      if (goalTimer) clearTimeout(goalTimer);
      pad && pad.lock();
      tutor.lines(['Not yet.'], { cls: 'notyet', speak: false });
      const ex = (item.explain || []).map(l => fill(l, scope));
      const at = answerText();
      const lines = [...ex, ...(at && !ex.join(' ').includes(String(item.answer)) ? [`The answer is ${at}.`] : [])];
      tutor.add(lines, { speak: false });
      autoSay(['Not yet.', ...lines].join(' '), tutor.spBtn);
      if (pad && input === 'numpad') pad.set(item.answer);
      if (ch) { const rb = ch.find(item.answer); rb && rb.classList.add('right'); }
      if (con.api && con.api.showAnswer) { try { con.api.showAnswer(item.answer ?? item.goal); } catch (e) { console.warn(e); } }
      showAnswered();
      tutor.actions([tutor.button('Got it', () => { tutor.actions([]); resolve({ correct: false, firstTry: false, explained: true }); }, { glow: true, iconName: 'next' })]);
    };
    function onWidget(st) {
      if (finished || input !== 'widget' || !item.goal) return;
      if (matches(item.goal, st)) {
        clearTimeout(goalTimer);
        goalTimer = setTimeout(() => { if (matches(item.goal, con.state())) judge(true); }, 450);
      }
    }
    con.clearInputs();
    if (input === 'numpad') {
      pad = con.numpad({ allowColon: typeof item.answer === 'string' && item.answer.includes(':'), prefix: item.prefix || '', unit: item.unit || '', onSubmit: v => judge(answerMatches(v, item.answer)) });
    } else if (input === 'choice') {
      ch = con.choices(item.options || [], (v, b) => { if (!b.classList.contains('tried')) judge(same(v, item.answer), b); });
    } else if (input === 'order') {
      ord = con.order(item.options || [], arr => judge(arr.length === (item.answer || []).length && arr.every((x, i) => same(x, item.answer[i]))));
    } else if (input === 'widget') {
      con.button('Check', () => judge(matches(item.goal, con.state())), 'checkbtn');
      if (matches(item.goal, con.state())) { /* already there: still ask them to press Check */ }
    } else {
      con.button('Next', () => judge(true));
    }
  });
}

/* ---------------- Practise ---------------- */
const genMods = {};
export async function loadGen(spec) {
  const [strand, name] = String(spec).split('.');
  if (!genMods[strand]) genMods[strand] = import(`../gen/${strand}.js`);
  const mod = await genMods[strand];
  const g = mod[name];
  if (!g || typeof g.make !== 'function') throw new Error(`generator ${spec} not found`);
  return g;
}

export function makeItem(g, level, params, seen) {
  let item = null;
  for (let k = 0; k < 8; k++) {
    try { item = g.make(level, makeRand(), params || {}); } catch (e) { console.error('GENERATOR FAILED', e); return null; }
    const sig = JSON.stringify([item.caption, item.lines, item.answer, item.goal, item.props]);
    if (!seen.has(sig)) { seen.add(sig); break; }
  }
  return item;
}

async function renderPractise(el, s, t) {
  const { tutor, con } = lessonLayout(el);
  cleanup.push(() => { tutor.destroy(); con.destroy(); });
  const tier = R.tier;
  const specs = [].concat(s.gen || []);
  let gens;
  try { gens = await Promise.all(specs.map(loadGen)); } catch (e) {
    console.error(e);
    tutor.lines(['This practice is still being built.', 'Tap Next to carry on.']);
    setReady(true);
    return;
  }
  if (!alive(t)) return;
  const base = Array.isArray(s.levels) ? s.levels[tier - 1] : (s.level || 1) + (tier - 1);
  const maxLv = Math.min(...gens.map(g => g.levels || 1));
  const baseLv = Math.max(1, Math.min(maxLv, base));
  let level = baseLv;
  const total = Array.isArray(s.items) ? s.items[tier - 1] : (s.items || 6);
  tutor.pips(total);
  const seen = new Set();
  let streak = 0;
  if (s.intro) { await tutor.lines(s.intro.map(l => fill(l, crewScope()))); await sleep(400); }
  let rightFirst = 0;
  for (let i = 0; i < total; i++) {
    if (!alive(t)) return;
    tutor.pip(i, 'now');
    const g = gens[i % gens.length];
    const lv = Math.max(1, Math.min(g.levels || 1, level));
    const item = makeItem(g, lv, s.params, seen);
    if (!item) { tutor.pip(i, 'help'); continue; }
    const res = await askItem({ tutor, con }, item, { t, onFirstWrong: () => { streak = 0; level = Math.max(Math.max(1, baseLv - 1), level - 1); } });
    if (!alive(t)) return;
    if (item.fact) recordFact(item.fact, res.firstTry);
    tutor.pip(i, res.firstTry ? 'ok' : 'help');
    if (res.firstTry) {
      rightFirst++;
      streak++;
      if (streak >= 3 && level < Math.min(maxLv, baseLv + 1)) { level++; streak = 0; }
    }
    if (res.explained && item.reteach) {
      await askItem({ tutor, con }, { ...item.reteach, lines: ["Let's try a smaller one.", ...(item.reteach.lines || [])].slice(0, 3) }, { t });
      if (!alive(t)) return;
    }
  }
  if (!alive(t)) return;
  con.clearInputs();
  con.clearWidget();
  con.caption('');
  con.showArt('star');
  const msg = rightFirst === total ? `All ${total} first time. Superb!` : `You did all ${total}.`;
  await tutor.lines(['Practice complete!', msg], { cls: 'good' });
  if (!alive(t)) return;
  tutor.actions([tutor.button('Five more', () => { if (alive(t)) { const step = { ...s, items: 5, levels: undefined, level: level - (tier - 1) }; leaveStep(); const nt = token; renderPractise(el, step, nt); } }, { ghost: true, iconName: 'repeat' })]);
  store.addLog(R.id, `Practice: ${rightFirst} of ${total} first time (${specs.join(', ')}, level ${level}).`);
  setReady(true);
}

/* ---------------- Big Question ---------------- */
async function renderQuestion(el, s, t) {
  el.className = 'step pad';
  const c = crew();
  const opts = s.options || [];
  const scope = crewScope();
  const fmtTitle = s.format === 'wodb' ? "Which one doesn't belong?" : s.format === 'wyr' ? 'Would you rather...?' : 'Big Question';
  el.innerHTML = `<div class="ask">
    <div class="headrow"><div><div class="eyebrow">${esc(s.title || fmtTitle)} &middot; there's no right answer</div>
      <div class="prompt" style="font-size:clamp(26px,2.7vw,36px)">${esc(fill(s.prompt || '', scope))}</div></div><span class="sp"></span></div>
    <div class="choices">${opts.map((o, i) => `<button class="choice" type="button" data-i="${i}" style="align-items:center;text-align:center;justify-content:center;min-height:${o.widget ? 230 : 140}px">
      <span class="badges"></span>${o.widget ? '<div class="mini" style="position:relative;width:100%;height:150px;pointer-events:none"></div>' : ''}${o.art ? `<span style="display:block;margin:0 auto">${art(o.art, 90)}</span>` : ''}
      <span style="font-size:${String(o.label).length > 12 ? 24 : 40}px">${esc(fill(o.label, scope))}</span>${o.detail ? `<span class="detail">${esc(o.detail)}</span>` : ''}</button>`).join('')}</div>
    <div class="turn"></div>
    <div class="revealslot"></div>
  </div>`;
  const btns = [...el.querySelectorAll('.choice')];
  btns.forEach((b, i) => {
    const o = opts[i];
    if (o.widget) loadWidget(o.widget).then(m => { if (alive(t)) m.mount(b.querySelector('.mini'), { ...(o.props || {}), readonly: true }, { readonly: true }); }).catch(e => console.warn(e));
  });
  const turnEl = el.querySelector('.turn');
  const slot = el.querySelector('.revealslot');
  const text = sentences(fill(s.prompt || fmtTitle, scope), opts.map(o => fill(o.label, scope)).join(', or '));
  const sb = speakButton(() => text);
  el.querySelector('.sp').replaceWith(sb);
  autoSay(text, sb);
  let cmd = null, eng = null, phase = 'cmd', changing = null;
  const setBadges = () => btns.forEach((b, i) => {
    b.classList.toggle('pick-cmd', i === cmd);
    b.classList.toggle('pick-eng', i === eng);
    b.querySelector('.badges').innerHTML = (i === cmd ? `<span class="badge cmd">${esc(c.commander)}</span>` : '') + (i === eng ? `<span class="badge eng">${esc(c.engineer)}</span>` : '');
  });
  const drawTurn = () => {
    turnEl.innerHTML = '';
    if (phase === 'cmd') turnEl.innerHTML = `<span class="who cmd">${esc(c.commander)}</span><span>which do you pick? Tap one.</span>`;
    else if (phase === 'eng') turnEl.innerHTML = `<span class="who eng">${esc(c.engineer)}</span><span>your turn. Which do you pick?</span>`;
    else if (phase === 'why') {
      const box = h(`<div style="display:flex;flex-direction:column;gap:12px;width:100%">
        <div class="turn"><span class="who cmd">${esc(c.commander)}</span><span>why did you pick that? Tell ${esc(c.engineer)}!</span></div>
        <div class="whybox"><input class="textin" type="text" maxlength="160" placeholder="${esc(c.engineer)} can write the reason here (optional)"><button class="btn big glow" type="button">What do other people think?</button></div>
      </div>`);
      autoSay(`${c.commander}, why did you pick that? Tell ${c.engineer}!`);
      box.querySelector('.btn').addEventListener('click', () => {
        const why = box.querySelector('input').value.trim();
        store.addLog(R.id, `Big Question: ${fill(s.prompt || fmtTitle, scope)} ${c.commander} picked "${fill(opts[cmd]?.label, scope)}"${eng !== null ? `, ${c.engineer} picked "${fill(opts[eng]?.label, scope)}"` : ''}.${why ? ` Because: ${why}` : ''}`);
        phase = 'reveal'; drawTurn(); showReveal();
      });
      turnEl.append(box);
    } else if (phase === 'reveal') {
      const row = h(`<div class="mindrow"></div>`);
      const mk = (who, name, col) => {
        const b = h(`<button class="btn ghost small" type="button" style="border-color:${col}">${icon('star')} ${esc(name)}: I changed my mind</button>`);
        b.addEventListener('click', () => { changing = who; turnEl.querySelector('.hint')?.remove(); row.after(h(`<span class="hint muted">Tap your new choice, ${esc(name)}.</span>`)); });
        return b;
      };
      row.append(mk('cmd', c.commander, 'var(--gold)'), mk('eng', c.engineer, 'var(--cyan)'));
      turnEl.append(row);
    }
  };
  btns.forEach((b, i) => b.addEventListener('click', () => {
    if (phase === 'cmd') { cmd = i; phase = 'eng'; }
    else if (phase === 'eng') { eng = i; phase = 'why'; }
    else if (phase === 'reveal' && changing) {
      const who = changing; changing = null;
      const before = who === 'cmd' ? cmd : eng;
      if (before === i) { turnEl.querySelector('.hint')?.remove(); return; }
      if (who === 'cmd') cmd = i; else eng = i;
      const name = who === 'cmd' ? c.commander : c.engineer;
      store.addStar();
      store.addLog(R.id, `${name} had a rethink and picked "${fill(opts[i]?.label, scope)}". A star for changing your mind!`);
      toast(`${name} had a rethink. That's what mathematicians do! +1 star`);
      say(`${name} had a rethink. That's what mathematicians do!`);
      turnEl.querySelector('.hint')?.remove();
    } else return;
    sfx('click');
    setBadges(); drawTurn();
  }));
  function showReveal() {
    const lines = [].concat(s.reveal || []).map(l => fill(l, scope));
    const rv = h(`<div class="reveal noimg"><div class="card">
      <div class="headrow"><div class="eyebrow">What other people think</div><span class="sp"></span></div>
      ${lines.map(l => `<p class="lead" style="font-size:23px;margin:0">${esc(l)}</p>`).join('')}
      ${s.followUp ? `<div class="dadline" style="font-size:21px"><b>Talk about it</b><span>${esc(fill(s.followUp, scope))}</span></div>` : ''}
    </div></div>`);
    const txt = sentences(...lines, s.followUp ? fill(s.followUp, scope) : '');
    const b = speakButton(() => txt);
    rv.querySelector('.sp').replaceWith(b);
    slot.replaceChildren(rv);
    autoSay(txt, b);
    setReady(true);
    rv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  drawTurn();
}

/* ---------------- Engineer's Error ---------------- */
async function renderError(el, s, t) {
  const { tutor, con } = lessonLayout(el);
  cleanup.push(() => { tutor.destroy(); con.destroy(); });
  const scope = crewScope();
  con.clearWidget();
  con.wbox.classList.remove('none');
  con.wbox.style.display = 'flex';
  const box = h(`<div class="errlines"></div>`);
  (s.lines || []).forEach((ln, i) => {
    const b = h(`<button class="errline ${i === 0 ? 'first' : ''}" type="button">${esc(fill(ln, scope))}</button>`);
    if (i > 0) b.addEventListener('click', async () => {
      if (box.classList.contains('done')) return;
      if (i === s.wrong) {
        box.classList.add('done');
        b.classList.add('found');
        sfx('chime');
        await tutor.lines(['You found it!', ...(s.fix || []).map(l => fill(l, scope))], { cls: 'then' });
        store.addLog(R.id, `${crew().commander} spotted ${crew().engineer}'s slip: "${fill(ln, scope)}".`);
        setReady(true);
      } else {
        b.classList.add('nope');
        sfx('click');
        tutor.lines(['That line is fine.', 'Keep looking.'], { cls: 'soft' });
      }
    });
    box.appendChild(b);
  });
  con.wbox.appendChild(box);
  await tutor.lines((s.intro || [`${crew().engineer} worked this out.`, 'Can you spot the slip?']).map(l => fill(l, scope)));
}

/* ---------------- At home ---------------- */
function renderAtHome(el, s) {
  el.className = 'step pad';
  const need = s.need || [];
  const steps = s.steps || [];
  el.innerHTML = `<div style="max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:20px">
    <div class="headrow"><div><div class="eyebrow">Try it at home</div><h2>${esc(s.title || '')}</h2></div><span class="sp"></span></div>
    <div class="athome">
      <div class="card"><h3 style="margin-bottom:14px">You need</h3><ul>${need.map((n, i) => `<li><span class="tick" role="checkbox" aria-checked="false" tabindex="0" data-i="${i}"></span><span>${esc(n)}</span></li>`).join('') || '<li class="muted">Nothing special.</li>'}</ul></div>
      <div class="card"><h3 style="margin-bottom:14px">What to do</h3><ol>${steps.map((x, i) => `<li><span class="n">${i + 1}</span><span>${esc(fill(x, crewScope()))}</span></li>`).join('')}</ol>
        ${s.why ? `<div class="wow" style="font-size:22px;margin-top:18px;font-family:var(--font-body);font-weight:500;color:var(--ink)"><span style="color:var(--accent);font-family:var(--font-display)">Why it works: </span>${esc(s.why)}</div>` : ''}
      </div>
    </div></div>`;
  el.querySelectorAll('.tick').forEach(tk => {
    const flip = () => { const on = !tk.classList.contains('on'); tk.classList.toggle('on', on); tk.setAttribute('aria-checked', on); tk.innerHTML = on ? icon('check') : ''; };
    tk.addEventListener('click', flip);
  });
  const text = sentences(s.title, need.length ? 'You need: ' + need.join(', ') : '', ...steps.map(x => fill(x, crewScope())), s.why ? 'Why it works: ' + s.why : '');
  const b = speakButton(() => text);
  el.querySelector('.sp').replaceWith(b);
  autoSay(sentences('Try it at home.', s.title), b);
  setReady(true);
}

/* ---------------- Finish ---------------- */
function renderFinish(el, s) {
  el.className = 'step pad';
  const c = crew();
  const m = R.mission;
  const tier = R.tier;
  const before = store.tierOf(m.id);
  const result = store.finishMission(m.id, tier);
  const shownTier = Math.max(before, tier);
  const sector = R.env.sectorOf(m.id);
  const accent = SECTOR_COL[m.sector] || SECTOR_COL.number;
  const pName = m.patch?.name || m.title;
  if (result === 'new') store.addLog(m.id, `Mission complete! Earned the "${pName}" patch.`);
  else if (result === 'up') store.addLog(m.id, `${TIER_NAME[tier]} level complete! A new star on the "${pName}" patch.`);
  const next = R.env.nextAfter(m.id);
  const deb = s.debrief || ['What was your favourite part?'];
  el.innerHTML = `<div class="finish">
    <div class="patchbig">${patchSVG({ name: pName, icon: m.patch?.icon || sector?.icon || 'star', accent, crew: c, tier: shownTier })}</div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div><div class="eyebrow">${TIER_NAME[tier]} level complete</div><h1>${esc(pName)}</h1>
        <p class="muted" style="font-size:22px;margin-top:8px">${result === 'new' ? 'A new patch for the wall!' : result === 'up' ? `A new star: ${'★'.repeat(tier)}` : 'You flew this mission again. Great flying!'}</p></div>
      <div class="card"><h3 style="margin-bottom:12px">Crew debrief</h3><div class="debrief">${deb.map((q, i) => `<div class="q"><span class="sp" data-i="${i}"></span><span>${esc(fill(q, crewScope()))}</span></div>`).join('')}</div></div>
      <div class="mindrow">
        ${next ? `<button class="btn big next-go" type="button">Next: ${esc(next.title)} ${icon('next')}</button>` : ''}
        ${tier < 3 ? `<button class="btn ghost big harder" type="button">Make it harder ${'★'.repeat(tier + 1)}</button>` : ''}
        <button class="btn ghost big home-go" type="button">${icon('home')}</button>
      </div>
    </div></div>`;
  el.querySelectorAll('.sp').forEach(sp => { const q = fill(deb[+sp.dataset.i], crewScope()); sp.replaceWith(speakButton(() => q)); });
  el.querySelector('.home-go').addEventListener('click', () => { location.hash = '#/'; });
  el.querySelector('.next-go')?.addEventListener('click', () => { location.hash = `#/m/${next.id}/1/0`; });
  el.querySelector('.harder')?.addEventListener('click', () => { location.hash = `#/m/${m.id}/${tier + 1}/0`; });
  if (result !== 'again') { toast(result === 'new' ? `New patch: ${pName}!` : `New star on ${pName}!`); sfx('chime'); cleanup.push(burst(el, el.querySelector('.patchbig'))); }
  autoSay(sentences(`Mission complete! ${result === 'new' ? `You earned the ${pName} patch` : ''}`, fill(deb[0], crewScope())));
  setReady(true);
}

const RENDER = { look: renderLook, ask: renderAsk, guess: renderGuess, try: renderTry, practise: renderPractise, question: renderQuestion, error: renderError, athome: renderAtHome, finish: renderFinish };

// Keyboard: arrows move between steps on a PC (the number pad takes digits and Enter).
document.addEventListener('keydown', e => {
  if (!R || e.target.closest?.('input, textarea') || document.querySelector('.modal-back')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); R.nextBtn.click(); }
  if (e.key === 'ArrowLeft' && R.idx > 0) { e.preventDefault(); go(R.idx - 1); }
});
