// Persistent state in localStorage. Everything degrades gracefully if storage is blocked.
const KEY = 'astrableeps.v1';
const DEFAULTS = () => ({
  crew: null,            // { commander, copilot, engineer }
  done: {},              // missionId -> { at, plays }
  stars: 0,              // changed-mind stars
  starsBy: {},           // role -> count
  log: [],               // crew log [{ t, m, text }]
  autoRead: true,
  volume: 0.8,
  kit: {},               // the Moon Run sound kit (see song.js KIT_SLOTS)
  songs: [],             // saved songs (the Jukebox)
  choices: {},           // Big Question choices that change the app: { speed, sharing, channel, ending }
  game: { runs: 0, stars: 0 },
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
function write() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Could not save', e); }
}

export const store = {
  get state() { return state; },
  set(patch) { Object.assign(state, patch); write(); },
  save() { write(); },
  addLog(mission, text) {
    state.log.push({ t: Date.now(), m: mission || '', text: String(text) });
    if (state.log.length > 800) state.log.splice(0, state.log.length - 800);
    write();
  },
  // Returns true the first time a mission is finished.
  finishMission(id) {
    const d = state.done[id];
    if (!d) { state.done[id] = { at: Date.now(), plays: 1 }; write(); return true; }
    d.plays = (d.plays || 1) + 1; d.at = Date.now(); write();
    return false;
  },
  isDone(id) { return !!state.done[id]; },
  addStar(role) {
    state.stars = (state.stars || 0) + 1;
    state.starsBy[role] = (state.starsBy[role] || 0) + 1;
    write();
  },
  setKit(slot, value) { state.kit = { ...state.kit, [slot]: value }; write(); },
  kit(slot) { return state.kit?.[slot] ?? null; },
  choose(key, value) { state.choices = { ...state.choices, [key]: value }; write(); },
  saveSong(song) {
    const i = state.songs.findIndex(s => s.id === song.id);
    const copy = JSON.parse(JSON.stringify(song));
    copy.saved = Date.now();
    if (i >= 0) state.songs[i] = copy; else state.songs.unshift(copy);
    if (state.songs.length > 60) state.songs.length = 60;
    write();
  },
  deleteSong(id) { state.songs = state.songs.filter(s => s.id !== id); write(); },
  song(id) { return state.songs.find(s => s.id === id) || null; },
  modSave(mod, k, v) { (state.mod[mod] ||= {})[k] = v; write(); },
  modLoad(mod, k) { return state.mod?.[mod]?.[k] ?? null; },
  reset() { const crew = state.crew; state = DEFAULTS(); state.crew = crew; write(); },
};

export const crew = () => {
  const c = state.crew || {};
  return { commander: c.commander || 'Finn', copilot: c.copilot || 'Co-pilot', engineer: c.engineer || 'Dad' };
};
export const ROLES = ['commander', 'copilot', 'engineer'];
export const ROLE_NAME = { commander: 'Commander', copilot: 'Co-pilot', engineer: 'Sound Engineer' };
