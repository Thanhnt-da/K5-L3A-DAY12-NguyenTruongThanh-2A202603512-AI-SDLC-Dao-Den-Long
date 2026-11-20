// Ticket-04: soak command, benchmark scene and frame statistics, leaderboard rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBenchWorld, frameStats, benchCamera } from '../src/sim/bench.js';
import { step } from '../src/sim/world.js';
import { normalizeName, makeEntry, insertEntry, isoWithOffset } from '../src/leaderboard.js';

const tmp = mkdtempSync(join(tmpdir(), 'ddl4-'));

test('soak: N Nights in one process, no crashes, memory stays within +20%', () => {
  const out = join(tmp, 'soak.json');
  const r = spawnSync(process.execPath, ['--expose-gc', '--jitless', '--max-semi-space-size=1', 'src/headless/soak.js', '--seed', '7', '--nights', '4', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(s.nights, 4);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 4);
  for (const x of s.results) assert.ok(['won', 'lost'].includes(x));
  assert.ok(s.mem_end_mb <= 1.2 * s.mem_start_mb, JSON.stringify(s));
});

test('bench scene: 200 wandering shades, 100 fireflies, L1-L3 lit at 100; nothing spawns, burns, hurts or ends', () => {
  const w = createBenchWorld(42);
  assert.equal(w.shades.length, 200);
  assert.equal(w.motes.length, 100);
  assert.deepEqual(w.lanterns.filter((l) => l.lit).map((l) => [l.id, l.fuel / 60]), [['L1', 100], ['L2', 100], ['L3', 100]]);
  for (let k = 0; k < 120 * 60; k++) step(w, { move: [0, 0], camYawDeg: 0, pressed: {} }); // 2 minutes
  assert.equal(w.state, 'playing');
  assert.equal(w.shades.length, 200);
  assert.equal(w.motes.length, 100);
  assert.equal(w.player.flames, 3);
  assert.ok(w.shades.every((s) => s.state === 'wander'));
  assert.ok(w.lanterns.filter((l) => l.lit).every((l) => l.fuel === 6000));
  // same seed => same layout
  assert.deepEqual(createBenchWorld(42).shades.map((s) => s.pos), createBenchWorld(42).shades.map((s) => s.pos));
});

test('bench camera: starts at (30,15,0), one counter-clockwise lap per 15 s', () => {
  assert.deepEqual(benchCamera(0), [30, 15, 0]);
  const q = benchCamera(3.75);
  assert.ok(Math.abs(q[0]) < 1e-9 && Math.abs(q[2] - 30) < 1e-9, JSON.stringify(q));
  assert.ok(Math.abs(benchCamera(15)[0] - 30) < 1e-9);
});

test('frame stats follow the Ticket-04 definitions', () => {
  const dts = [...Array(198).fill(10), 50, 100]; // 200 frames
  const s = frameStats(dts);
  assert.equal(s.frames, 200);
  assert.ok(Math.abs(s.avg_fps - (1000 * 200) / (198 * 10 + 150)) < 1e-9);
  assert.ok(Math.abs(s.p1_low_fps - 1000 / 75) < 1e-9); // k = ceil(0.01*200) = 2 worst: 50, 100
  assert.equal(s.frame_ms_p95, 10);
});

test('leaderboard: names 3-12 of [A-Za-z0-9_-] (Vietnamese allowed), top 10, ties keep the earlier entry first', () => {
  assert.equal(normalizeName('ab'), null);
  assert.equal(normalizeName('Mây_01'), 'Mây_01');
  assert.equal(normalizeName('bad name'), null);
  assert.equal(normalizeName('x'.repeat(13)), null);
  let list = [];
  const e = (name, score) => makeEntry({ name, score, nights_won: 1, seed: 1 });
  for (let i = 0; i < 12; i++) list = insertEntry(list, e(`p${String(i).padStart(2, '0')}`, i * 10));
  assert.equal(list.length, 10);
  assert.deepEqual(list.map((x) => x.score), [110, 100, 90, 80, 70, 60, 50, 40, 30, 20]);
  list = insertEntry(list, e('late', 100));
  assert.deepEqual(list.slice(0, 3).map((x) => x.name), ['p11', 'p10', 'late']);
  assert.throws(() => makeEntry({ name: 'okay', score: 1, nights_won: 4, seed: 1 }));
  assert.match(isoWithOffset(new Date()), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
});

test('leaderboard export: run_cmd --export-leaderboard writes {"entries": [...]}', () => {
  const out = join(tmp, 'lb.json');
  const r = spawnSync(process.execPath, ['server.js', '--export-leaderboard', out], { encoding: 'utf8', env: { ...process.env, DDL_DATA_DIR: join(tmp, 'data') } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), { entries: [] });
});
