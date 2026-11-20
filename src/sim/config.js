// Single source of truth for gameplay numbers.
// `tuning` is read from game.contract.json so the declared contract can never
// drift from what the simulation actually uses (the hidden tests build
// situations from those declared numbers).
import contract from '../../game.contract.json' with { type: 'json' };

export const TUNING = Object.freeze({ ...contract.tuning, score: Object.freeze({ ...contract.tuning.score }) });

export const TICK_RATE = 60; // fixed: 1 tick = 1/60 s (Test Contract v1.0)
export const DT = 1 / TICK_RATE;

// World layout (not part of the contract tuning block; documented in README).
export const WORLD = Object.freeze({
  islandRadius: 30, // metres; the edge acts as a wall while fall_enabled is false
  lanternRingRadius: 22, // L1..L5 sit evenly on this ring, L1 at +Z
  randomMoteCount: 30,
  moteMinR: 4, // random motes spawn in this annulus around the origin
  moteMaxR: 28,
  gravity: 25, // m/s^2
  jumpSpeed: 8, // m/s initial upward speed
});
