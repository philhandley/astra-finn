// Tiny persistent store in localStorage. Everything degrades gracefully if storage is blocked.
const KEY = 'astrafinn.v1';
const DEFAULTS = () => ({ crew: null, patches: {}, stars: 0, log: [], sound: false, autoRead: true, mod: {}, done: {} });

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS(), ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return DEFAULTS();
}

let state = read();

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

export const store = {
  get state() { return state; },
  set(patch) { Object.assign(state, patch); write(); },
  addLog(mission, text) {
    state.log.push({ t: Date.now(), m: mission || '', text: String(text) });
    if (state.log.length > 600) state.log.splice(0, state.log.length - 600);
    write();
  },
  earnPatch(id) {
    if (state.patches[id]) return false;
    state.patches[id] = Date.now();
    write();
    return true;
  },
  addStar() { state.stars = (state.stars || 0) + 1; write(); },
  modSave(mod, k, v) { (state.mod[mod] ||= {})[k] = v; write(); },
  modLoad(mod, k) { return state.mod?.[mod]?.[k] ?? null; },
  reset() { const crew = state.crew; state = DEFAULTS(); state.crew = crew; write(); },
};
