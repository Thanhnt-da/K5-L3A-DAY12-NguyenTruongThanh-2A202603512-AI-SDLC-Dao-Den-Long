// Leaderboard storage for the browser. With `npm start` (server.js) entries are
// kept in a file on this machine (and exported with --export-leaderboard).
// Under `npm run dev` there is no server, so it falls back to localStorage.
import { makeEntry, insertEntry } from '../leaderboard.js';

const LS_KEY = 'dao-den-long.leaderboard';

function localGet() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export async function getBoard() {
  try {
    const r = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (r.ok) return (await r.json()).entries;
  } catch {
    /* no server: fall back */
  }
  return localGet();
}

/** Returns { entries } or throws Error(message) for an invalid name. */
export async function submitScore(data) {
  makeEntry(data); // validate first so the player sees the error either way
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error);
    return body;
  } catch (e) {
    if (e instanceof TypeError) {
      // network error: no server, use localStorage
      const entries = insertEntry(localGet(), makeEntry(data));
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(entries));
      } catch {
        /* not saved */
      }
      return { entries };
    }
    throw e;
  }
}
