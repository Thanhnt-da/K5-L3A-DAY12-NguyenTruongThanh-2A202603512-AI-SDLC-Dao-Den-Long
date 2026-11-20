// Ticket-02 Part 1 standard rules on Night 1. Each test names the rule it checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from '../src/sim/run.js';

const run = (opts) => runHeadless({ seed: 1, night: 1, ticks: 60, snapshotEvery: 1, ...opts }).trim().split('\n').map((l) => JSON.parse(l));
const quiet = (extra = {}) => ({ random_motes: false, random_shades: false, ...extra });
const ev = (lines, name) => lines.filter((l) => l.type === 'event' && l.name === name);
const snap = (lines, tick) => lines.find((l) => l.type === 'snapshot' && l.tick === tick);
const press = (name, at) => [{ tick: at, [name]: true }, { tick: at + 1, [name]: false }];

test('pickup: walking onto a firefly picks it within XZ 1.0 m', () => {
  const lines = run({ scenario: quiet({ motes: [[0, 0, 5]] }), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  const [e] = ev(lines, 'mote_picked');
  assert.deepEqual(e.data, { carried: 1 });
  // z after step k is 0.1*(k+1); within 1.0 m of z=5 from z=4.0 (tick 40, allow float rounding to 41)
  assert.ok(e.tick === 40 || e.tick === 41, `tick ${e.tick}`);
  assert.ok(snap(lines, e.tick - 1).player.pos[2] < 4.0001);
});

test('pickup: capacity 10 is never exceeded', () => {
  const lines = run({ scenario: quiet({ player: { carried: 10 }, motes: [[0, 0, 0.5]] }) });
  assert.equal(ev(lines, 'mote_picked').length, 0);
  assert.equal(snap(lines, 60).motes_active, 1);
});

test('lantern: interact deposits min(carried, missing) into the nearest unlit lantern; 10 lights it', () => {
  let lines = run({ scenario: quiet({ player: { pos: [0, 0, 23.5], carried: 4 } }), inputs: { frames: press('interact', 0) } });
  assert.deepEqual(ev(lines, 'deposit')[0].data, { lantern_id: 'L1', amount: 4, deposited: 4 });
  assert.equal(snap(lines, 1).score, 40);
  assert.equal(ev(lines, 'lantern_lit').length, 0);

  lines = run({ scenario: quiet({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: [{ id: 'L1', deposited: 4 }] }), inputs: { frames: press('interact', 0) } });
  assert.deepEqual(ev(lines, 'deposit')[0].data, { lantern_id: 'L1', amount: 6, deposited: 10 });
  assert.deepEqual(ev(lines, 'lantern_lit')[0], { type: 'event', tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1' } });
  assert.equal(snap(lines, 1).score, 60 + 100);
  assert.equal(snap(lines, 1).player.carried, 4);
});

test('lantern: tie in distance goes to the smaller id; out of 2.0 m does nothing', () => {
  let lines = run({ scenario: quiet({ player: { carried: 1 }, lanterns: [{ id: 'L2', pos: [0, 0, -1.5] }, { id: 'L1', pos: [0, 0, 1.5] }] }), inputs: { frames: press('interact', 0) } });
  assert.equal(ev(lines, 'deposit')[0].data.lantern_id, 'L1');
  lines = run({ scenario: quiet({ player: { pos: [0, 0, 22.9], carried: 5 } }), inputs: { frames: press('interact', 0) } });
  assert.equal(ev(lines, 'deposit').length, 0);
});

test('win: lighting the last lantern wins; bonus floor(seconds left)*2 + 50*flames', () => {
  const lanterns = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const lines = run({ scenario: quiet({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns }), inputs: { frames: press('interact', 0) } });
  assert.deepEqual(ev(lines, 'game_over')[0], { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
  // 10*10 deposit + 100 lantern + floor(299.983)*2 + 3*50
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 1, state: 'won', score: 100 + 100 + 598 + 150 });
});

test('pulse: costs 3, stuns shades within 5 m for 120 ticks, pushes 4 m over 15 ticks, +5 each', () => {
  const lines = run({ ticks: 130, scenario: quiet({ player: { carried: 3 }, shades: [{ pos: [3, 1, 0] }] }), inputs: { frames: press('pulse', 0) } });
  assert.deepEqual(ev(lines, 'pulse')[0].data, { stunned_ids: ['S1'] });
  const s1 = snap(lines, 1);
  assert.equal(s1.player.carried, 0);
  assert.equal(s1.score, 5);
  assert.equal(s1.player.pulse_cd_s, 3);
  assert.equal(s1.shades[0].state, 'stunned');
  assert.deepEqual(snap(lines, 15).shades[0].pos, [7, 1, 0]);
  assert.deepEqual(snap(lines, 30).shades[0].pos, [7, 1, 0]);
  assert.equal(snap(lines, 120).shades[0].state, 'stunned');
  assert.notEqual(snap(lines, 121).shades[0].state, 'stunned');
});

test('pulse: needs 3 fireflies and respects the 3 s cooldown', () => {
  let lines = run({ scenario: quiet({ player: { carried: 2 } }), inputs: { frames: press('pulse', 0) } });
  assert.equal(ev(lines, 'pulse').length, 0);
  lines = run({ ticks: 200, scenario: quiet({ player: { carried: 9 } }), inputs: { frames: [...press('pulse', 0), ...press('pulse', 60), ...press('pulse', 180)] } });
  assert.deepEqual(ev(lines, 'pulse').map((e) => e.tick), [1, 181]);
});

test('shade hit: -1 flame, drop floor(carried/2) on a 1.5-2.5 m ring, 90 ticks invulnerable, shade recoils', () => {
  const lines = run({ ticks: 100, scenario: quiet({ player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0], state: 'chase' }, { pos: [-0.5, 1, 0], state: 'chase' }] }) });
  const hits = ev(lines, 'player_hit');
  assert.deepEqual(hits[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
  const s = snap(lines, 1);
  assert.equal(s.player.carried, 3);
  assert.equal(s.player.invuln, true);
  const dropped = s.motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 2);
  for (const m of dropped) {
    const r = Math.hypot(m.pos[0], m.pos[2]);
    assert.ok(r >= 1.499 && r <= 2.501, `ring radius ${r}`);
    assert.equal(m.ttl_s, 8);
  }
  assert.equal(s.shades.find((x) => x.id === 'S1').state, 'recoil');
  // only one flame per tick, and none while invulnerable
  assert.ok(hits.every((h, i) => i === 0 || h.tick > 90), JSON.stringify(hits.map((h) => h.tick)));
});

test('no_flames: last flame lost => game_over lost/no_flames', () => {
  const lines = run({ scenario: quiet({ player: { flames: 1 }, shades: [{ pos: [0.5, 1, 0], state: 'chase' }] }) });
  assert.deepEqual(ev(lines, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(lines.at(-1).state, 'lost');
});

test('fall: leaving the 40 m island, Y < -10 => -1 flame, lose carried, respawn at start after 60 ticks, invulnerable', () => {
  const lines = run({ ticks: 200, scenario: quiet({ player: { pos: [39.5, 0, 0], carried: 4 } }), inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 10, move: [0, 0] }] } });
  const [hit] = ev(lines, 'player_hit');
  assert.deepEqual(hit.data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  const after = snap(lines, hit.tick + 60);
  assert.deepEqual(after.player.pos, [0, 0, 0]);
  assert.equal(after.player.invuln, true);
  assert.equal(after.player.carried, 0);
  assert.equal(ev(lines, 'player_hit').length, 1);
});

test('safe zone: a chasing shade cannot enter 6 m around a lit lantern', () => {
  const lines = run({ ticks: 300, scenario: quiet({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [0, 1, 15], state: 'chase' }] }) });
  assert.equal(ev(lines, 'player_hit').length, 0);
  for (const s of lines.filter((l) => l.type === 'snapshot')) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2] - 25) >= 5.999);
});

test('safe zone: a shade inside when the lantern lights is pushed out within 30 ticks and does no damage', () => {
  const lines = run({ ticks: 40, scenario: quiet({ player: { pos: [0, 0, 24], carried: 10 }, shades: [{ pos: [0, 1, 23.5], state: 'chase' }] }), inputs: { frames: press('interact', 0) } });
  assert.equal(ev(lines, 'lantern_lit').length, 1);
  assert.equal(ev(lines, 'player_hit').length, 0);
  const s = snap(lines, 31).shades[0];
  assert.ok(Math.hypot(s.pos[0], s.pos[2] - 25) >= 5.999, JSON.stringify(s));
});

test('shade spawning (Night 1): 2 at tick 300, then 1 every 480 ticks, ids S1.., >= 15 m from player', () => {
  const lines = run({ ticks: 1300, snapshotEvery: 100, scenario: { random_motes: false } });
  assert.deepEqual(ev(lines, 'shade_spawned').map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3'], [1260, 'S4']]);
  assert.equal(snap(lines, 300).shades[0].state, 'spawning');
});

test('fireflies: 20 at start on distinct spawn points, +1 every 240 ticks up to 30', () => {
  const lines = run({ ticks: 480, snapshotEvery: 240, scenario: { random_shades: false } });
  const s0 = snap(lines, 0);
  assert.equal(s0.motes_active, 20);
  assert.equal(new Set(s0.motes.map((m) => m.pos.join())).size, 20);
  assert.equal(snap(lines, 240).motes_active, 21);
  assert.equal(snap(lines, 480).motes_active, 22);
});

test('dash: 14 m/s for 0.2 s in facing direction when standing still; 1.5 s cooldown', () => {
  const lines = run({ ticks: 150, scenario: quiet(), inputs: { frames: [...press('dash', 0), ...press('dash', 30), ...press('dash', 100)] } });
  assert.deepEqual(ev(lines, 'dash').map((e) => e.tick), [1, 101]);
  assert.deepEqual(snap(lines, 12).player.pos, [0, 0, 2.8]);
  assert.deepEqual(snap(lines, 20).player.pos, [0, 0, 2.8]);
  assert.equal(snap(lines, 1).player.dash_cd_s, 1.5);
});

test('jump: 7 m/s up, gravity 20, lands back on the ground', () => {
  const lines = run({ scenario: quiet(), inputs: { frames: press('jump', 0) } });
  assert.equal(snap(lines, 1).player.grounded, false);
  const peak = Math.max(...lines.filter((l) => l.type === 'snapshot').map((l) => l.player.pos[1]));
  assert.ok(peak > 1.1 && peak < 1.3, `peak ${peak}`);
  assert.equal(snap(lines, 60).player.grounded, true);
  assert.equal(snap(lines, 60).player.pos[1], 0);
});

test('pause: tick keeps counting, sim_tick and time stand still, snapshots say paused', () => {
  const lines = run({ ticks: 40, scenario: quiet(), inputs: { frames: [...press('pause', 10), ...press('pause', 20)] } });
  assert.deepEqual(ev(lines, 'paused').map((e) => e.tick), [11]);
  assert.deepEqual(ev(lines, 'resumed').map((e) => e.tick), [21]);
  const s = snap(lines, 15);
  assert.equal(s.state, 'paused');
  assert.equal(s.sim_tick, 10);
  assert.equal(snap(lines, 40).sim_tick, 30);
  assert.equal(snap(lines, 40).time_left_s, 299.5);
});

test('performance: a full Night 1 headless run to dawn (18,000 ticks, all spawns) finishes under 30 s', () => {
  // Player waits inside L1's safe zone so shades cannot end the run early: it must reach dawn.
  const t0 = performance.now();
  const out = runHeadless({ seed: 7, night: 1, ticks: 21600, scenario: { player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }] } });
  const ms = performance.now() - t0;
  const lines = out.trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 18000, state: 'lost', score: 0 });
  assert.equal(ev(lines, 'shade_spawned').length, 6);
  assert.ok(ms < 30000, `${ms} ms`);
});
