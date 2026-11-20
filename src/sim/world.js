// Pure, deterministic game simulation. No DOM, no Three.js, no Math.random(),
// no wall-clock time: the browser client and the headless runner both drive it.
//
// PHASE 1 SKELETON: setup, movement, jump, island wall and the dawn timer are in.
// Gameplay rules (pickup, deposit, shades, pulse, hits, scoring, all_lit win)
// are still TODO and get built against the Phase 1 acceptance criteria.
import { TUNING, WORLD, DT, TICK_RATE } from './config.js';
import { createRng } from './rng.js';
import { FormatError } from './errors.js';
import { worldMove } from './inputs.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);

function defaultLanterns() {
  const out = [];
  for (let i = 0; i < TUNING.lantern_count_night1; i++) {
    const a = (i / TUNING.lantern_count_night1) * Math.PI * 2;
    const r = WORLD.lanternRingRadius;
    out.push({ id: `L${i + 1}`, pos: [r * Math.sin(a), 0, r * Math.cos(a)], lit: false, deposited: 0 });
  }
  return out;
}

function randomMotes(rng) {
  const out = [];
  for (let i = 0; i < WORLD.randomMoteCount; i++) {
    const a = rng() * Math.PI * 2;
    // sqrt for uniform density over the annulus
    const r = Math.sqrt(WORLD.moteMinR ** 2 + rng() * (WORLD.moteMaxR ** 2 - WORLD.moteMinR ** 2));
    out.push({ pos: [r * Math.sin(a), 0, r * Math.cos(a)] });
  }
  return out;
}

/** Give every entity an id: keep explicit ids, fill the rest with prefix+n skipping used ones. */
function assignIds(list, prefix) {
  const used = new Set(list.map((e) => e.id).filter((id) => id !== undefined));
  let n = 1;
  return list.map((e) => {
    if (e.id !== undefined) return e;
    while (used.has(`${prefix}${n}`)) n++;
    const id = `${prefix}${n++}`;
    used.add(id);
    return { ...e, id };
  });
}

function validateScenario(sc) {
  if (sc === null || typeof sc !== 'object' || Array.isArray(sc)) throw new FormatError('scenario: top level must be an object');
  const p = sc.player;
  if (p !== undefined) {
    if (p === null || typeof p !== 'object') throw new FormatError('scenario.player: must be an object');
    if ('pos' in p && !isVec3(p.pos)) throw new FormatError('scenario.player.pos: must be [x, y, z]');
    for (const k of ['carried', 'flames']) if (k in p && !(Number.isInteger(p[k]) && p[k] >= 0)) throw new FormatError(`scenario.player.${k}: must be a non-negative integer`);
  }
  for (const k of ['random_motes', 'random_shades']) if (k in sc && typeof sc[k] !== 'boolean') throw new FormatError(`scenario.${k}: must be a boolean`);
  if ('motes' in sc) {
    if (!Array.isArray(sc.motes)) throw new FormatError('scenario.motes: must be an array');
    sc.motes.forEach((m, i) => {
      const pos = Array.isArray(m) ? m : m?.pos;
      if (!isVec3(pos)) throw new FormatError(`scenario.motes[${i}]: must be [x, y, z] or { pos }`);
    });
  }
  if ('shades' in sc) {
    if (!Array.isArray(sc.shades)) throw new FormatError('scenario.shades: must be an array');
    sc.shades.forEach((s, i) => {
      if (s === null || typeof s !== 'object' || !isVec3(s.pos)) throw new FormatError(`scenario.shades[${i}].pos: must be [x, y, z]`);
      if ('id' in s && typeof s.id !== 'string') throw new FormatError(`scenario.shades[${i}].id: must be a string`);
    });
  }
  if ('lanterns' in sc) {
    if (!Array.isArray(sc.lanterns)) throw new FormatError('scenario.lanterns: must be an array');
    sc.lanterns.forEach((l, i) => {
      if (l === null || typeof l !== 'object' || typeof l.id !== 'string') throw new FormatError(`scenario.lanterns[${i}].id: must be a string`);
      if ('pos' in l && !isVec3(l.pos)) throw new FormatError(`scenario.lanterns[${i}].pos: must be [x, y, z]`);
      if ('lit' in l && typeof l.lit !== 'boolean') throw new FormatError(`scenario.lanterns[${i}].lit: must be a boolean`);
      if ('deposited' in l && !(Number.isInteger(l.deposited) && l.deposited >= 0)) throw new FormatError(`scenario.lanterns[${i}].deposited: must be a non-negative integer`);
    });
  }
  if ('time_left_s' in sc && !(isNum(sc.time_left_s) && sc.time_left_s >= 0)) throw new FormatError('scenario.time_left_s: must be a non-negative number');
}

/**
 * Build the world for (seed, night, scenario). Setup emits no events and awards no score.
 */
export function createWorld({ seed = 0, night = 1, scenario = null } = {}) {
  if (night !== 1) throw new Error(`night ${night} is not available yet (only night 1)`);
  const rng = createRng(seed);
  const sc = scenario ?? {};
  validateScenario(sc);

  const player = { pos: [0, 0, 0], vy: 0, onGround: true, flames: TUNING.flames, carried: 0 };
  if (sc.player?.pos) player.pos = [...sc.player.pos];
  if (sc.player && 'flames' in sc.player) player.flames = sc.player.flames;
  if (sc.player && 'carried' in sc.player) player.carried = sc.player.carried;
  player.onGround = player.pos[1] <= 0;

  // Random content is always drawn (even if later replaced) so the RNG stream
  // for a given seed does not depend on which scenario fields are present.
  const genMotes = randomMotes(rng);
  let motes = sc.random_motes === false ? [] : genMotes;
  if (sc.motes) motes = sc.motes.map((m) => ({ pos: [...(Array.isArray(m) ? m : m.pos)] }));
  motes = assignIds(motes, 'M');

  // TODO(phase-1): random shade spawning (shade_spawned events) when random_shades !== false.
  let shades = [];
  if (sc.shades) shades = sc.shades.map((s) => ({ ...(s.id !== undefined ? { id: s.id } : {}), pos: [...s.pos], state: 'chase', stunLeft: 0 }));
  shades = assignIds(shades, 'S');

  const lanterns = defaultLanterns();
  for (const u of sc.lanterns ?? []) {
    const l = lanterns.find((x) => x.id === u.id);
    if (!l) throw new FormatError(`scenario.lanterns: unknown lantern id "${u.id}"`);
    if (u.pos) l.pos = [...u.pos];
    if ('lit' in u) l.lit = u.lit;
    if ('deposited' in u) l.deposited = u.deposited;
  }

  const timeStart = 'time_left_s' in sc ? sc.time_left_s : TUNING.night1_duration_s;

  return {
    seed,
    night,
    rng,
    tick: 0,
    state: 'playing',
    score: 0,
    timeStart,
    timeLeft: timeStart,
    player,
    motes,
    shades,
    lanterns,
  };
}

/**
 * Advance one step with input for tick k = world.tick. Returns the events of
 * this step; each event's tick is k + 1.
 */
export function step(world, input) {
  const events = [];
  if (world.state !== 'playing') return events;
  const t = world.tick + 1;
  const emit = (name, data) => events.push({ type: 'event', tick: t, name, data });
  const p = world.player;

  // --- movement (horizontal) ---
  const [dx, dz] = worldMove(input.move, input.camYawDeg);
  p.pos[0] += dx * TUNING.player_speed * DT;
  p.pos[2] += dz * TUNING.player_speed * DT;
  // island edge is a wall while fall_enabled is false
  const r = Math.hypot(p.pos[0], p.pos[2]);
  if (r > WORLD.islandRadius) {
    p.pos[0] *= WORLD.islandRadius / r;
    p.pos[2] *= WORLD.islandRadius / r;
  }

  // --- jump / gravity ---
  if (input.pressed.jump && p.onGround) {
    p.vy = WORLD.jumpSpeed;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= WORLD.gravity * DT;
    p.pos[1] += p.vy * DT;
    if (p.pos[1] <= 0) {
      p.pos[1] = 0;
      p.vy = 0;
      p.onGround = true;
    }
  }

  // TODO(phase-1): mote pickup, deposit/interact, lantern lighting, pulse,
  // shade AI + hits, score, all_lit / no_flames endings.

  // --- clock ---
  world.tick = t;
  world.timeLeft = Math.max(0, world.timeStart - world.tick / TICK_RATE);
  if (world.timeLeft <= 0) {
    world.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'dawn' });
  }
  return events;
}
