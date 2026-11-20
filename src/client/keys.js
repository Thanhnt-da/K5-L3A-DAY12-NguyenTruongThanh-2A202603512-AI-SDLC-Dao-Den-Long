// Remappable controls (Ticket-04 Part 4). One key per action after remapping;
// the defaults also keep the arrow keys / P as second keys.
export const ACTIONS = [
  ['up', 'Đi lên'],
  ['down', 'Đi xuống'],
  ['left', 'Sang trái'],
  ['right', 'Sang phải'],
  ['jump', 'Nhảy'],
  ['dash', 'Lướt'],
  ['interact', 'Tương tác / nạp đèn'],
  ['pulse', 'Tỏa Sáng'],
  ['pause', 'Tạm dừng'],
];

export const DEFAULT_KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['Space'],
  dash: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  pulse: ['KeyF'],
  pause: ['Escape', 'KeyP'],
};

const ARROWS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
export const keyName = (code) => ARROWS[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '').replace(/Left$/, ' L').replace(/Right$/, ' R');

/** Which other action already uses this key, or null. */
export function conflictOf(keys, action, code) {
  for (const [a] of ACTIONS) if (a !== action && keys[a]?.includes(code)) return a;
  return null;
}

export function sanitizeKeys(k) {
  const out = {};
  for (const [a] of ACTIONS) out[a] = Array.isArray(k?.[a]) && k[a].length && k[a].every((c) => typeof c === 'string') ? k[a] : DEFAULT_KEYS[a];
  return out;
}
