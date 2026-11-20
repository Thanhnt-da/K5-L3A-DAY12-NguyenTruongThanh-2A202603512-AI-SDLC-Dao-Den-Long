// Volume and mouse sensitivity, saved between launches (Ticket-02 Part 3.5).
// localStorage can be missing or throw (private mode); the game still runs with defaults.
const KEY = 'dao-den-long.settings';
const DEFAULTS = { volume: 0.6, sensitivity: 0.3, colorBlind: false };

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      volume: Number.isFinite(s.volume) ? Math.min(1, Math.max(0, s.volume)) : DEFAULTS.volume,
      sensitivity: Number.isFinite(s.sensitivity) ? Math.min(1, Math.max(0.05, s.sensitivity)) : DEFAULTS.sensitivity,
      colorBlind: s.colorBlind === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* not saved; still applied for this session */
  }
}
