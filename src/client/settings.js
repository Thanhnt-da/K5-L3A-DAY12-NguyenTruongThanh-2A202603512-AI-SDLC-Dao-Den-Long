// Player settings, saved between launches: volume, mouse sensitivity (Ticket-02),
// colour-blind palette (Ticket-03), key bindings, reduced motion, UI scale (Ticket-04).
// localStorage can be missing or throw (private mode); the game still runs with defaults.
import { DEFAULT_KEYS, sanitizeKeys } from './keys.js';

const KEY = 'dao-den-long.settings';

export function loadSettings() {
  let s = {};
  try {
    s = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    s = {};
  }
  const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return {
    volume: num(s.volume, 0, 1, 0.6),
    sensitivity: num(s.sensitivity, 0.05, 1, 0.3),
    colorBlind: s.colorBlind === true,
    reducedMotion: s.reducedMotion === true,
    uiScale: s.uiScale === 1.25 ? 1.25 : 1,
    keys: sanitizeKeys(s.keys ?? DEFAULT_KEYS),
  };
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* not saved; still applied for this session */
  }
}
