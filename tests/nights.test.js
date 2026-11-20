// Ticket-02 Part 2 (standard maps for Nights 2-3) and Part 3 (Gió Lạc, Bùa Gió, wind).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from '../src/sim/run.js';

const run = (opts) => runHeadless({ seed: 1, ticks: 60, snapshotEvery: 1, ...opts }).trim().split('\n').map((l) => JSON.parse(l));
const quiet = (extra = {}) => ({ random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, ...extra });
const ev = (lines, name) => lines.filter((l) => l.type === 'event' && l.name === name);
const snap = (lines, tick) => lines.find((l) => l.type === 'snapshot' && l.tick === tick);
const press = (name, at) => [{ tick: at, [name]: true }, { tick: at + 1, [name]: false }];
const r = (p, c = [0, 0, 0]) => Math.hypot(p[0] - c[0], p[2] - c[2]);

test('night_start {night} is the first event (tick 1); --night 2/3 load their maps', () => {
  for (const night of [1, 2, 3]) {
    const lines = run({ night, ticks: 1 });
    assert.deepEqual(ev(lines, 'night_start')[0], { type: 'event', tick: 1, name: 'night_start', data: { night } });
    assert.equal(lines[0].night, night);
  }
});

// Phase 3: Night lengths changed to 240/270/300 s (Ticket-03 Part 3)
test('Night 2 Đảo Cau: 6 lanterns at standard positions, 270 s, charm C1 at (35,0,0)', () => {
  const s = run({ night: 2, ticks: 0 })[0];
  assert.deepEqual(s.lanterns.map((l) => [l.id, ...l.pos]), [['L1', 0, 0, 25], ['L2', 17, 0, -10], ['L3', -17, 0, -10], ['L4', 70, 0, 25], ['L5', 87, 0, -10], ['L6', 53, 0, -10]]);
  assert.equal(s.time_left_s, 270);
  assert.deepEqual(s.charms, [{ id: 'C1', available: true, respawn_s: 0 }]);
  assert.equal(s.motes_active, 20);
});

test('Night 2: the bamboo bridge carries Mây from island A to B; stepping off the island edge falls', () => {
  let lines = run({ night: 2, ticks: 300, scenario: quiet({ player: { pos: [20, 0, 0] }, charms: [] /* no charm: it would speed Mây up */ }), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.equal(ev(lines, 'player_hit').length, 0);
  assert.deepEqual(snap(lines, 300).player.pos, [50, 0, 0]);
  lines = run({ night: 2, ticks: 120, scenario: quiet({ player: { pos: [35, 0, 1.5] } }), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.equal(ev(lines, 'player_hit')[0].data.by, 'fall'); // no railing
});

test('Night 2 jump pad: launches Mây (vy 14, 24 m/s) and lands on the other island', () => {
  const lines = run({ night: 2, ticks: 120, scenario: quiet({ player: { pos: [20, 0, 18] } }), inputs: { frames: [{ tick: 0, move: [-1, 0] }, { tick: 1, move: [0, 0] }] } });
  assert.equal(ev(lines, 'player_hit').length, 0);
  const s1 = snap(lines, 1);
  assert.equal(s1.player.grounded, false);
  assert.ok(Math.abs(Math.hypot(s1.player.vel[0], s1.player.vel[2]) - 24) < 0.01, JSON.stringify(s1.player.vel));
  const landed = lines.find((l) => l.type === 'snapshot' && l.tick > 1 && l.player.grounded);
  assert.ok(landed, 'should land');
  assert.ok(landed.tick >= 80 && landed.tick <= 90, `landed at ${landed.tick} (~1.4 s)`);
  assert.ok(r(landed.player.pos, [70, 0, 0]) <= 28, JSON.stringify(landed.player.pos));
});

test('Night 3 Đảo Chuông: 7 lanterns on 3 levels, fireflies spawn on all levels, start (0,0,-30)', () => {
  const s = run({ night: 3, ticks: 0, scenario: { random_shades: false } })[0];
  assert.deepEqual(s.lanterns.map((l) => l.pos[1]), [6, 3, 3, 0, 0, 0, 0]);
  assert.deepEqual(s.player.pos, [0, 0, -30]);
  assert.equal(s.time_left_s, 300);
  assert.equal(s.motes_active, 20);
  for (const m of s.motes) assert.ok([0, 3, 6].includes(m.pos[1]));
});

test('Night 3: level edges are cliffs (cannot walk up), ramps lead to level 1, the tower blocks', () => {
  // walking +Z on level 0 at x=0 hits the level-1 cliff at r = 12
  let lines = run({ night: 3, ticks: 60, scenario: quiet({ player: { pos: [0, 0, 9.5] } }), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  let p = snap(lines, 60).player.pos;
  assert.equal(p[1], 0);
  assert.ok(p[2] <= 12, JSON.stringify(p)); // stops against the cliff face at r = 12
  // ramp at 30°: from its foot (r = 31) walking inwards ends on level 1 (Y = 3)
  const a = Math.PI / 6;
  lines = run({ night: 3, ticks: 120, scenario: quiet({ player: { pos: [31 * Math.cos(a), 0, 31 * Math.sin(a)] } }), inputs: { frames: [{ tick: 0, move: [-Math.cos(a), -Math.sin(a)] }] } });
  p = snap(lines, 120).player;
  assert.equal(p.pos[1], 3);
  assert.equal(p.grounded, true);
  assert.ok(r(p.pos) >= 12 && r(p.pos) <= 24);
  // the bell tower (radius 2) cannot be entered from level 2
  lines = run({ night: 3, ticks: 60, scenario: quiet({ player: { pos: [0, 6, 5] } }), inputs: { frames: [{ tick: 0, move: [0, -1] }] } });
  assert.ok(r(snap(lines, 60).player.pos) >= 2);
  assert.equal(snap(lines, 60).player.pos[1], 6);
});

test('Night 3 jump pad (0,3,13): lands on level 2 (Y = 6)', () => {
  const lines = run({ night: 3, ticks: 90, scenario: quiet({ player: { pos: [0, 3, 13.5] } }), inputs: { frames: [{ tick: 0, move: [0, -1] }, { tick: 3, move: [0, 0] }] } });
  const landed = lines.find((l) => l.type === 'snapshot' && l.tick > 5 && l.player.grounded);
  assert.ok(landed, 'should land');
  assert.equal(landed.player.pos[1], 6);
  assert.ok(r(landed.player.pos) <= 8);
});

test('Night 3 wind: a 5 s gust every 30 s pushes Mây 2 m/s; wind_enabled false turns it off', () => {
  let lines = run({ night: 3, ticks: 2200, snapshotEvery: 100, scenario: quiet({ wind_enabled: true, time_left_s: 360 }) });
  assert.equal(snap(lines, 1700).wind.active, false);
  const gust = snap(lines, 1900);
  assert.equal(gust.wind.active, true);
  assert.equal(snap(lines, 2200).wind.active, false);
  const moved = r(snap(lines, 2200).player.pos, [0, 0, -30]);
  assert.ok(moved > 9.9 && moved < 10.1, `moved ${moved} m in a 5 s gust`);
  lines = run({ night: 3, ticks: 2200, snapshotEvery: 100, scenario: quiet() });
  assert.ok(lines.filter((l) => l.type === 'snapshot').every((s) => !s.wind.active));
});

test('Night 3 shades move at 4.5 m/s', () => {
  const lines = run({ night: 3, ticks: 60, scenario: quiet({ shades: [{ pos: [10, 1, -30], state: 'chase' }] }) });
  assert.deepEqual(snap(lines, 60).shades[0].pos, [5.5, 1, -30]);
});

test('Gió Lạc: chases when carrying >= 5 within 15 m, steals min(3, carried), flees 240 ticks, then disappears', () => {
  const lines = run({ night: 2, ticks: 300, scenario: quiet({ player: { carried: 6 }, drifters: [{ pos: [3, 1, 0] }] }) });
  assert.equal(snap(lines, 1).drifters[0].state, 'chase');
  const [st] = ev(lines, 'drifter_steal');
  assert.deepEqual(st.data, { drifter_id: 'D1', amount: 3, carried: 3 });
  assert.equal(snap(lines, st.tick).drifters[0].state, 'flee');
  assert.equal(snap(lines, st.tick).drifters[0].stolen, 3);
  assert.equal(snap(lines, st.tick + 239).drifters.length, 1);
  assert.equal(snap(lines, st.tick + 240).drifters.length, 0);
  assert.equal(ev(lines, 'drifter_steal').length, 1); // steals only once
  assert.equal(ev(lines, 'player_hit').length, 0); // costs no flame
});

test('Gió Lạc: stays idle when Mây carries fewer than 5', () => {
  const lines = run({ night: 2, ticks: 120, scenario: quiet({ player: { carried: 4 }, drifters: [{ pos: [3, 1, 0] }] }) });
  assert.equal(ev(lines, 'drifter_steal').length, 0);
  assert.equal(snap(lines, 1).drifters[0].state, 'idle');
});

test('Gió Lạc + pulse: a chasing one flees without stealing; a fleeing one drops what it stole and vanishes after 120 ticks', () => {
  let lines = run({ night: 2, ticks: 30, scenario: quiet({ player: { carried: 9 }, drifters: [{ pos: [4, 1, 0] }] }), inputs: { frames: press('pulse', 0) } });
  assert.equal(snap(lines, 1).drifters[0].state, 'flee');
  assert.equal(ev(lines, 'drifter_steal').length, 0);
  lines = run({ night: 2, ticks: 200, scenario: quiet({ player: { carried: 3 }, drifters: [{ pos: [3, 1, 0], state: 'flee', stolen: 3 }] }), inputs: { frames: press('pulse', 0) } });
  assert.deepEqual(ev(lines, 'drifter_drop')[0].data, { drifter_id: 'D1', amount: 3 });
  assert.equal(snap(lines, 1).motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(snap(lines, 120).drifters.length, 1);
  assert.equal(snap(lines, 121).drifters.length, 0);
});

test('Gió Lạc spawn (Nights 2-3): at tick 1200, 2400; ids D1, D2; max 2', () => {
  const lines = run({ night: 2, ticks: 2400, snapshotEvery: 1200, scenario: { random_shades: false, random_motes: false, player: { pos: [0, 0, 0] } } });
  assert.deepEqual(snap(lines, 1200).drifters.map((d) => d.id), ['D1']);
  assert.deepEqual(snap(lines, 2400).drifters.map((d) => d.id), ['D1', 'D2']);
  assert.equal(run({ night: 1, ticks: 1200, snapshotEvery: 1200, scenario: { random_shades: false } }).at(-2).drifters.length, 0);
});

test('Bùa Gió: pickup gives 600 ticks of 7.2 m/s and dash without cooldown; respawns after 2700 ticks', () => {
  const lines = run({ night: 2, ticks: 2800, snapshotEvery: 1, scenario: quiet({ player: { pos: [34.5, 0, 0] } }), inputs: { frames: [{ tick: 1, move: [-1, 0] }, { tick: 61, move: [0, 0] }, ...press('dash', 100), ...press('dash', 115)] } });
  assert.deepEqual(ev(lines, 'charm_picked')[0], { type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } });
  assert.equal(snap(lines, 1).player.charm_s, 10);
  assert.equal(snap(lines, 1).charms[0].available, false);
  // 60 ticks at 7.2 m/s = 7.2 m
  assert.ok(Math.abs(snap(lines, 61).player.pos[0] - (34.5 - 7.2)) < 0.001, JSON.stringify(snap(lines, 61).player.pos));
  assert.deepEqual(ev(lines, 'dash').map((e) => e.tick), [101, 116]);
  assert.equal(snap(lines, 2700).charms[0].available, false);
  assert.equal(snap(lines, 2701).charms[0].available, true);
});

// Phase 3: Night 3 is now 300 s (18,000 ticks). Lanterns burn out, so a safe zone no longer keeps Mây safe;
// the run uses 200 flames instead so it reaches dawn with all spawns active.
test('performance: a full Night 3 headless run to dawn (18,000 ticks) finishes under 30 s', () => {
  const t0 = performance.now();
  const lines = run({ night: 3, ticks: 21600, snapshotEvery: 10, scenario: { player: { pos: [35, 0, -14], flames: 200 } } });
  const ms = performance.now() - t0;
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 18000, state: 'lost', score: 0 });
  assert.ok(ms < 30000, `${ms} ms`);
});
