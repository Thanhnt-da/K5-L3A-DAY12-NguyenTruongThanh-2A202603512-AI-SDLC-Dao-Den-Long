// Local leaderboard rules (Ticket-04 Part 3), shared by the server and the browser.
// Top 10 by score (descending); on a tie, whoever got there first stays ahead.

export const MAX_ENTRIES = 10;

/** 3-12 characters: A-Z a-z 0-9 _ - (required), plus Vietnamese letters with diacritics (bonus). */
export function normalizeName(raw) {
  const name = String(raw ?? '').normalize('NFC').trim();
  const len = [...name].length;
  if (len < 3 || len > 12) return null;
  if (!/^[\p{L}\p{M}0-9_-]+$/u.test(name)) return null;
  return name;
}

/** ISO 8601 with the local timezone offset, e.g. 2026-11-20T16:40:05+07:00. */
export function isoWithOffset(d = new Date()) {
  const pad = (n) => String(Math.abs(Math.trunc(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(off / 60)}:${pad(off % 60)}`;
}

/** Validate one submission; returns a clean entry or throws with a message. */
export function makeEntry({ name, score, nights_won, seed }, now = new Date()) {
  const n = normalizeName(name);
  if (!n) throw new Error('name must be 3-12 characters: letters, digits, _ or -');
  if (!Number.isInteger(score) || score < 0) throw new Error('score must be a non-negative integer');
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) throw new Error('nights_won must be 0-3');
  if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
  return { name: n, score, nights_won, achieved_at: isoWithOffset(now), seed };
}

/** Insert keeping rank order; a new entry goes after existing entries with the same score. */
export function insertEntry(entries, entry) {
  const list = [...entries];
  let i = list.findIndex((e) => e.score < entry.score);
  if (i === -1) i = list.length;
  list.splice(i, 0, entry);
  return list.slice(0, MAX_ENTRIES);
}
