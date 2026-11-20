// Ticket-04 benchmark scene (the same for every submission):
// Night 1, exactly 200 Bóng Mực in `wander` and exactly 100 fireflies spread
// evenly over the island (seed 42), L1-L3 lit with fuel 100, Mây still at (0,0,0).
// In this scene spawning, damage, pickup, fuel burn and the Night's end are off;
// shades still move by the normal wander rules (world.bench = true).
import { createWorld } from './world.js';
import { createRng } from './rng.js';

export const BENCH = { shades: 200, motes: 100, radius: 38, orbitR: 30, orbitY: 15, lapS: 15, warmupS: 3 };

/** Uniform points in a disc (sqrt for even area density), from the seeded rng. */
function spread(rng, n, y) {
  return Array.from({ length: n }, () => {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * BENCH.radius;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  });
}

export function createBenchWorld(seed = 42) {
  const rng = createRng(seed);
  const shades = spread(rng, BENCH.shades, 1).map((pos) => ({ pos, state: 'wander' }));
  const motes = spread(rng, BENCH.motes, 0);
  const world = createWorld({
    seed,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0] },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: false,
      shades,
      motes,
      lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
    },
  });
  world.bench = true;
  return world;
}

/** Camera on the orbit at time t (s): radius 30, Y 15, starts at (30,15,0), counter-clockwise from above, one lap per 15 s. */
export function benchCamera(t) {
  const a = (2 * Math.PI * t) / BENCH.lapS;
  return [BENCH.orbitR * Math.cos(a), BENCH.orbitY, BENCH.orbitR * Math.sin(a)];
}

/** Frame statistics exactly as Ticket-04 defines them. dts are frame times in ms. */
export function frameStats(dts) {
  const n = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
  return {
    frames: n,
    avg_fps: (1000 * n) / sum,
    p1_low_fps: 1000 / (worst.reduce((a, b) => a + b, 0) / k),
    frame_ms_p95: p95,
  };
}
