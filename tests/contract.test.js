// Test Contract v1.0: file shape, CLI behaviour, output format, tick model, determinism.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHeadless } from '../src/sim/run.js';

const contract = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
const CLI = fileURLToPath(new URL('../src/headless/cli.js', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'ddl-'));
const parse = (text) => text.trim().split('\n').map((l) => JSON.parse(l));
const cli = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
const file = (name, obj) => {
  const p = join(tmp, name);
  writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return p;
};

// Phase 2: version check changed 1.0 -> 1.1 (Ticket-02 Part 4); tuning must now equal the standard numbers.
test('game.contract.json is v1.1 and tuning matches the Ticket-02 standard numbers', () => {
  for (const k of ['contract_version', 'team', 'build_cmd', 'run_cmd', 'headless_cmd', 'tuning']) assert.ok(k in contract, k);
  assert.equal(contract.contract_version, '1.1');
  assert.deepEqual(contract.tuning, {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
    pulse_cost: 3, pulse_radius: 5, night1_duration_s: 300, night2_duration_s: 330, night3_duration_s: 360, flames: 3,
    invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6,
    shade_speed: 4, shade_hit_radius: 1, fall_enabled: true, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
    score: { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 },
  });
});

test('CLI writes snapshot at tick 0, every N ticks, and a final end line; exit 0', () => {
  const out = join(tmp, 'a.jsonl');
  const r = cli(['--seed', '1', '--night', '1', '--ticks', '25', '--out', out, '--snapshot-every', '10']);
  assert.equal(r.status, 0, r.stderr);
  const lines = parse(readFileSync(out, 'utf8'));
  assert.deepEqual(lines.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 10, 20]);
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 25, state: 'playing', score: 0 });
  const s0 = lines[0];
  for (const k of ['type', 'tick', 'sim_tick', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) assert.ok(k in s0, k);
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  assert.equal(s0.lanterns.length, 5);
  assert.deepEqual(s0.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
});

test('default --snapshot-every is 10', () => {
  const lines = parse(runHeadless({ seed: 3, ticks: 30 }));
  assert.deepEqual(lines.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 10, 20, 30]);
});

test('malformed inputs / scenario => exit 2 with stderr message', () => {
  const out = join(tmp, 'b.jsonl');
  for (const [flag, body] of [
    ['--inputs', '{not json'],
    ['--inputs', { frames: [{ tick: 5 }, { tick: 5 }] }],
    ['--inputs', { frames: [{ tick: 0, move: [1] }] }],
    ['--scenario', { player: { pos: [0, 0] } }],
    ['--scenario', { lanterns: [{ id: 'L9', lit: true }] }],
  ]) {
    const r = cli(['--seed', '1', '--night', '1', '--ticks', '5', '--out', out, flag, file('bad.json', body)]);
    assert.equal(r.status, 2, `${flag} ${JSON.stringify(body)}`);
    assert.match(r.stderr, /error/);
  }
});

test('missing required argument => non-zero exit', () => {
  assert.notEqual(cli(['--seed', '1', '--night', '1', '--out', join(tmp, 'c.jsonl')]).status, 0);
});

test('tick model: input at tick k moves the player in step k; time_left_s = start - steps/60', () => {
  // speed 6 m/s, move +Z from tick 0 for 60 steps => 6 m
  const lines = parse(runHeadless({ seed: 1, ticks: 60, inputs: { frames: [{ tick: 0, move: [0, 1] }] }, scenario: { random_motes: false }, snapshotEvery: 60 }));
  const s60 = lines.find((l) => l.type === 'snapshot' && l.tick === 60);
  assert.deepEqual(s60.player.pos, [0, 0, contract.tuning.player_speed]);
  assert.equal(s60.time_left_s, contract.tuning.night1_duration_s - 1);
});

test('move is rotated by cam_yaw_deg and normalised', () => {
  // yaw 90: x' = z*sin90 = +1 => move [0,1] goes +X
  // Phase 2: look the snapshot up by tick; the night_start event now precedes it in the output
  const at60 = (lines) => lines.find((l) => l.type === 'snapshot' && l.tick === 60);
  let s = at60(parse(runHeadless({ seed: 1, ticks: 60, inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] }, snapshotEvery: 60 })));
  assert.deepEqual(s.player.pos, [6, 0, 0]);
  // [1,1] is normalised: total distance 6 m along the diagonal
  s = at60(parse(runHeadless({ seed: 1, ticks: 60, inputs: { frames: [{ tick: 0, move: [1, 1] }] }, snapshotEvery: 60 })));
  assert.ok(Math.abs(Math.hypot(s.player.pos[0], s.player.pos[2]) - 6) < 0.002);
});

test('scenario setup: replaces lists, keeps unmentioned lanterns, emits nothing, scores nothing', () => {
  const lines = parse(runHeadless({
    seed: 1, ticks: 0,
    scenario: { player: { pos: [0, 0, 0], carried: 2, flames: 3 }, random_motes: false, random_shades: false, motes: [[0, 0, 5]], shades: [{ pos: [10, 0, 0] }], lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true }], time_left_s: 100 },
  }));
  assert.equal(lines.filter((l) => l.type === 'event').length, 0);
  const s = lines[0];
  assert.equal(s.score, 0);
  assert.equal(s.motes_active, 1);
  assert.deepEqual(s.shades.map((x) => x.id), ['S1']);
  assert.deepEqual(s.lanterns[0], { id: 'L1', pos: [0, 0, 25], lit: true, deposited: 0 });
  assert.equal(s.lanterns[1].lit, false);
  assert.equal(s.time_left_s, 100);
  assert.equal(s.player.carried, 2);
});

test('dawn: game ends lost/dawn when time runs out, event tick = k+1, run stops early', () => {
  const lines = parse(runHeadless({ seed: 1, ticks: 1000, scenario: { time_left_s: 1 } }));
  const go = lines.find((l) => l.name === 'game_over');
  assert.deepEqual(go, { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 60, state: 'lost', score: 0 });
});

test('determinism: same seed/scenario/inputs => byte-identical output (two CLI runs)', () => {
  const inputs = file('in.json', { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, { tick: 40, jump: true }, { tick: 41, jump: false }] });
  const a = join(tmp, 'd1.jsonl');
  const b = join(tmp, 'd2.jsonl');
  for (const out of [a, b]) assert.equal(cli(['--seed', '42', '--night', '1', '--inputs', inputs, '--ticks', '600', '--out', out]).status, 0);
  assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
});

test('different seeds give different random mote layouts', () => {
  const m = (seed) => JSON.stringify(parse(runHeadless({ seed, ticks: 0 }))[0].motes);
  assert.notEqual(m(1), m(2));
});
