#!/usr/bin/env node
// Ticket-04 soak test: <soak_cmd> --seed 7 --nights 10 --out soak.json
// Runs N Nights headless in ONE process (Night 1 → 2 → 3 → 1 …). Night i uses
// seed (seed + i). Random input from that seed: a new move direction every 30
// ticks; each tick 5% jump, 3% dash, 2% pulse, 10% interact. Each Night runs
// until it ends or its standard time runs out.
// Run with --expose-gc (soak_cmd does) so memory is read after a collection.
import { writeFileSync } from 'node:fs';
import { createWorld, step } from '../sim/world.js';
import { createRng } from '../sim/rng.js';

function fail(msg) {
  process.stderr.write(`error: ${msg}\nusage: --seed <int> --nights <int> --out soak.json\n`);
  process.exit(1);
}
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  if (!['--seed', '--nights', '--out'].includes(argv[i]) || argv[i + 1] === undefined) fail(`bad argument "${argv[i]}"`);
  args[argv[i]] = argv[i + 1];
}
const seed = Number(args['--seed'] ?? 7);
const nights = Number(args['--nights'] ?? 10);
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) fail('--seed and --nights must be integers, nights >= 1');
if (!args['--out']) fail('missing --out');

const rssMb = () => {
  globalThis.gc?.();
  return Math.round((process.memoryUsage().rss / 2 ** 20) * 10) / 10;
};

function playNight(world, rng) {
  const BTN = ['jump', 'dash', 'pulse', 'interact'];
  const prev = { jump: false, dash: false, pulse: false, interact: false, pause: false };
  let move = [0, 0];
  for (let k = 0; world.state === 'playing'; k++) {
    if (k % 30 === 0) {
      const a = rng() * Math.PI * 2;
      move = [Math.cos(a), Math.sin(a)];
    }
    const cur = { jump: rng() < 0.05, dash: rng() < 0.03, pulse: rng() < 0.02, interact: rng() < 0.1, pause: false };
    const pressed = {};
    for (const b of [...BTN, 'pause']) pressed[b] = cur[b] && !prev[b];
    Object.assign(prev, cur);
    step(world, { move, camYawDeg: 0, pressed });
    if (k > 30 * 60 * 10) throw new Error('night did not end'); // safety net: longer than any Night
  }
  return world.state;
}

const t0 = performance.now();
const results = [];
let crashes = 0;
let memStart = null;
let world = null;
for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1;
  try {
    world = createWorld({ seed: seed + i, night });
    if (memStart === null) memStart = rssMb(); // after loading the first Night
    results.push(playNight(world, createRng(seed + i)));
  } catch (e) {
    crashes++;
    results.push('crash');
    process.stderr.write(`night ${i + 1} (Night ${night}) crashed: ${e.stack}\n`);
  }
  world = null; // reset before the next Night
}
const memEnd = rssMb(); // after resetting the last Night

const out = {
  nights,
  crashes,
  results,
  mem_start_mb: memStart,
  mem_end_mb: memEnd,
  duration_s: Math.round((performance.now() - t0) / 100) / 10,
};
writeFileSync(args['--out'], JSON.stringify(out) + '\n');
process.stdout.write(`${JSON.stringify(out)}\n`);
process.exit(0);
