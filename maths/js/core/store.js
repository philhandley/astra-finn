// Persistent state in localStorage. Everything degrades gracefully if storage is blocked.
const KEY = 'astramaths.v1';
const DEFAULTS = () => ({
  crew: null,            // { commander, engineer }
  done: {},              // missionId -> { tier: best tier finished (1..3), at: time, plays: n }
  stars: 0,              // changed-mind stars
  log: [],               // crew log [{ t, m, text }]
  sound: false,
  autoRead: true,
  facts: {},             // fluency: factKey -> { box: 0..4, due: time, seen: n, right: n }
  levels: {},            // generator name -> last level reached (for practice warm-starts)
  check: null,           // Cadet Check result { at, results: { skill: true|false }, start: missionId }
  arcade: {},            // game -> { best, plays }
  quick: { streakBest: 0, rounds: 0 },
  mod: {},
});

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS(), ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return DEFAULTS();
}

let state = read();
function write() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

export const store = {
  get state() { return state; },
  set(patch) { Object.assign(state, patch); write(); },
  save() { write(); },
  addLog(mission, text) {
    state.log.push({ t: Date.now(), m: mission || '', text: String(text) });
    if (state.log.length > 800) state.log.splice(0, state.log.length - 800);
    write();
  },
  // Returns 'new' (first finish), 'up' (a higher tier than before) or 'again'.
  finishMission(id, tier) {
    const d = state.done[id];
    if (!d) { state.done[id] = { tier, at: Date.now(), plays: 1 }; write(); return 'new'; }
    d.plays = (d.plays || 1) + 1; d.at = Date.now();
    if (tier > d.tier) { d.tier = tier; write(); return 'up'; }
    write(); return 'again';
  },
  tierOf(id) { return state.done[id]?.tier || 0; },
  addStar() { state.stars = (state.stars || 0) + 1; write(); },
  modSave(mod, k, v) { (state.mod[mod] ||= {})[k] = v; write(); },
  modLoad(mod, k) { return state.mod?.[mod]?.[k] ?? null; },
  reset() { const crew = state.crew; state = DEFAULTS(); state.crew = crew; write(); },
};
