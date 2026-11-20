// Ticket-03 "Đèn cạn dầu": lantern fuel, relight, capacity, drain, weak safe zones, dawn win, new scoring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from '../src/sim/run.js';

const run = (opts) => runHeadless({ seed: 1, night: 1, ticks: 60, snapshotEvery: 1, ...opts }).trim().split('\n').map((l) => JSON.parse(l));
const quiet = (extra = {}) => ({ random_motes: false, random_shades: false, ...extra });
const ev = (lines, name) => lines.filter((l) => l.type === 'event' && l.name === name);
const snap = (lines, tick) => lines.find((l) => l.type === 'snapshot' && l.tick === tick);
const press = (name, at) => [{ tick: at, [name]: true }, { tick: at + 1, [name]: false }];
const L = (lines, tick, id = 'L1') => snap(lines, tick).lanterns.find((l) => l.id === id);

test('fuel: a lit lantern burns 1/s exactly and goes out at 0 (lantern_out, deposited 0, ever_lit kept)', () => {
  const lines = run({ ticks: 6001, snapshotEvery: 60, scenario: quiet({ player: { pos: [0, 0, -20] }, lanterns: [{ id: 'L1', lit: true, deposited: 10 }] }) });
  assert.equal(L(lines, 0).fuel, 100);
  assert.equal(L(lines, 60).fuel, 99);
  assert.equal(L(lines, 3000).fuel, 50);
  assert.equal(L(lines, 5940).fuel, 1);
  assert.deepEqual(ev(lines, 'lantern_out')[0], { type: 'event', tick: 6000, name: 'lantern_out', data: { lantern_id: 'L1' } });
  assert.deepEqual(L(lines, 6000), { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0, fuel: 0, ever_lit: true, relit_count: 0 });
});

test('refuel: used = min(carried, ceil((100 - fuel)/10)), +10 fuel each, capped at 100, +5 score each', () => {
  const lines = run({ scenario: quiet({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: [{ id: 'L1', lit: true, fuel: 55.5 }] }), inputs: { frames: press('interact', 0) } });
  // at tick 1 fuel has burned to 55.483 before step 5; ceil(44.52/10) = 5
  assert.deepEqual(ev(lines, 'refuel')[0].data, { lantern_id: 'L1', amount: 5, fuel: 100 });
  assert.equal(snap(lines, 1).player.carried, 5);
  assert.equal(snap(lines, 1).score, 25);
});

// Assumption C3: fuel burns in step 2, before interact in step 5 (Ticket-03 order), so at interact time a lit
// lantern is never exactly full: a "just topped up" lantern still takes 1 firefly (ceil(1/60 / 10) = 1).
test('refuel: a nearly full lantern still accepts 1 firefly; a lit lantern is chosen over a farther unlit one', () => {
  const lines = run({ scenario: quiet({ player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true }, { id: 'L2', pos: [0, 0, -1.5] }] }), inputs: { frames: [...press('interact', 0), ...press('interact', 2)] } });
  assert.deepEqual(ev(lines, 'refuel').map((e) => [e.tick, e.data]), [[1, { lantern_id: 'L1', amount: 1, fuel: 100 }], [3, { lantern_id: 'L1', amount: 1, fuel: 100 }]]);
  assert.equal(ev(lines, 'deposit').length, 0);
});

test('relight: an ever-lit lantern needs only 5; lantern_lit relight:true, +40, relit_count 1, fuel 100', () => {
  const lines = run({ scenario: quiet({ player: { pos: [0, 0, 23.5], carried: 7 }, lanterns: [{ id: 'L1', ever_lit: true }] }), inputs: { frames: press('interact', 0) } });
  assert.deepEqual(ev(lines, 'deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(ev(lines, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  const l = L(lines, 1);
  assert.equal(l.relit_count, 1);
  assert.equal(l.fuel, 100);
  assert.equal(snap(lines, 1).score, 25 + 40);
  assert.equal(snap(lines, 1).player.carried, 2);
});

test('capacity: 10 + 2 per successful lighting this Night, max 20; scenario pre-lit lanterns do not count', () => {
  let lines = run({ scenario: quiet({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: [{ id: 'L2', lit: true }] }), inputs: { frames: press('interact', 0) } });
  assert.equal(snap(lines, 0).player.capacity, 10);
  assert.equal(snap(lines, 1).player.capacity, 12);
  lines = run({ ticks: 0, scenario: quiet({ player: { successful_lights: 7 } }) });
  assert.equal(lines[0].player.capacity, 20);
});

test('weak lantern (fuel < 30) loses its safe zone; at >= 30 it still protects', () => {
  const setup = (fuel) => run({ ticks: 120, scenario: quiet({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true, fuel }], shades: [{ pos: [0, 1, 18], state: 'chase' }] }) });
  assert.equal(ev(setup(29), 'player_hit').length, 1);
  assert.equal(ev(setup(40), 'player_hit').length, 0);
});

test('drain: a wandering shade goes to the nearest weak lantern, drains 5/s within 2 m, logs fuel_drain every 60 ticks; lantern goes out', () => {
  const lines = run({ ticks: 600, snapshotEvery: 10, scenario: quiet({ player: { pos: [0, 0, -20] }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ pos: [0, 1, 28], state: 'wander' }] }) });
  const drainStart = lines.find((l) => l.type === 'snapshot' && l.shades[0].state === 'drain');
  assert.ok(drainStart, 'shade should start draining');
  const d = ev(lines, 'fuel_drain');
  assert.ok(d.length >= 2);
  assert.equal(d[1].tick - d[0].tick, 60);
  assert.equal(d[0].data.lantern_id, 'L1');
  assert.equal(d[0].data.shade_id, 'S1');
  // 1/s burn + 5/s drain = 6 fuel per 60 ticks
  assert.ok(Math.abs(d[0].data.fuel - d[1].data.fuel - 6) < 0.05, JSON.stringify(d.slice(0, 2)));
  const out = ev(lines, 'lantern_out')[0];
  assert.ok(out && out.tick < 600);
  assert.equal(snap(lines, Math.ceil(out.tick / 10) * 10).shades[0].state, 'wander');
});

test('drain -> chase when Mây comes within 6 m; drain -> wander when refuelled to >= 30', () => {
  let lines = run({ ticks: 5, scenario: quiet({ player: { pos: [0, 0, 18] }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ pos: [0, 1, 23.5], state: 'drain', target_lantern_id: 'L1' }] }) });
  assert.equal(snap(lines, 1).shades[0].state, 'chase');
  lines = run({ ticks: 5, scenario: quiet({ player: { pos: [1.9, 0, 25], carried: 5, pulse_cd_ticks: 0 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ pos: [0, 1, 32], state: 'drain', target_lantern_id: 'L1' }] }), inputs: { frames: press('interact', 0) } });
  // tick 1 step 2: burn 1/60 + drain 5/60 => 19.9, then +50
  assert.equal(ev(lines, 'refuel')[0].data.fuel, 69.9);
  assert.notEqual(snap(lines, 1).shades[0].state, 'drain');
});

test('pulse on a draining shade scores +15 in total', () => {
  const lines = run({ ticks: 2, scenario: quiet({ player: { pos: [0, 0, 20.5], carried: 3 }, lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ pos: [0, 1, 23.5], state: 'drain', target_lantern_id: 'L1' }] }), inputs: { frames: press('pulse', 0) } });
  assert.deepEqual(ev(lines, 'pulse')[0].data, { stunned_ids: ['S1'] });
  assert.equal(snap(lines, 1).score, 15);
});

test('win at dawn: alive with >= ceil(0.6 x lanterns) lit => dawn_survived, +50+floor(fuel) per lit lantern, +50 per flame', () => {
  const lit3 = ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true }));
  let lines = run({ ticks: 100, scenario: quiet({ player: { pos: [0, 0, -5] }, lanterns: lit3, time_left_s: 1 }) });
  assert.deepEqual(ev(lines, 'game_over')[0], { type: 'event', tick: 60, name: 'game_over', data: { result: 'won', reason: 'dawn_survived' } });
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 60, state: 'won', score: 3 * (50 + 99) + 3 * 50 });
  lines = run({ ticks: 100, scenario: quiet({ lanterns: lit3.slice(0, 2), time_left_s: 1 }) });
  assert.deepEqual(ev(lines, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
});

test('dawn tick: losing the last flame on the final tick is no_flames, not a win', () => {
  const lit3 = ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true }));
  const lines = run({ ticks: 10, scenario: quiet({ player: { pos: [0, 0, -5], flames: 1 }, lanterns: lit3, time_left_s: 1 / 60, shades: [{ pos: [0.5, 1, -5], state: 'chase' }] }) });
  assert.deepEqual(ev(lines, 'game_over')[0], { type: 'event', tick: 1, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } });
});

test('Night thresholds: Night 2 needs 4/6, Night 3 needs 5/7', () => {
  const lit = (n) => Array.from({ length: n }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
  const end = (night, n) => run({ night, ticks: 100, scenario: quiet({ random_drifters: false, wind_enabled: false, lanterns: lit(n), time_left_s: 1 }) }).at(-1).state;
  assert.equal(end(2, 3), 'lost');
  assert.equal(end(2, 4), 'won');
  assert.equal(end(3, 4), 'lost');
  assert.equal(end(3, 5), 'won');
});
