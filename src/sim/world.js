// Pure, deterministic game simulation (Ticket-02 standard numbers, Contract v1.1).
// No DOM, no Three.js, no Math.random(), no wall-clock time: the browser client
// and the headless runner both drive it through createWorld() + step().
//
// step() follows the mandatory 12-step order of Ticket-02 (numbered below).
// Covers Nights 1-3: terrain levels, ramps, jump pads, wind, fireflies,
// lanterns, safe zones, pulse, Bóng Mực, Gió Lạc, Bùa Gió, falling, dash,
// pause, scoring, win/lose.
import { TUNING, RULES, DT, TICK_RATE, ticks } from './config.js';
import { MAPS, SHADE_FIRST_TICK, SHADE_FIRST_COUNT, polar, topAt, supportAt, blockedAt } from './maps.js';
import { createRng } from './rng.js';
import { FormatError } from './errors.js';
import { worldMove } from './inputs.js';

const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
const DRIFTER_STATES = ['idle', 'chase', 'flee'];
const STEP_UP = 0.3; // feet may step up/down this much per tick on ramps
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isCount = (v) => Number.isInteger(v) && v >= 0;
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** Natural id order: S2 < S10; ids without a number fall back to string order. */
export function compareIds(a, b) {
  const ma = /^(\D*)(\d+)$/.exec(a);
  const mb = /^(\D*)(\d+)$/.exec(b);
  if (ma && mb && ma[1] === mb[1]) return Number(ma[2]) - Number(mb[2]);
  return a < b ? -1 : a > b ? 1 : 0;
}

function validateScenario(sc) {
  const obj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!obj(sc)) throw new FormatError('scenario: top level must be an object');
  const p = sc.player;
  if (p !== undefined) {
    if (!obj(p)) throw new FormatError('scenario.player: must be an object');
    if ('pos' in p && !isVec3(p.pos)) throw new FormatError('scenario.player.pos: must be [x, y, z]');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) if (k in p && !isCount(p[k])) throw new FormatError(`scenario.player.${k}: must be a non-negative integer`);
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) if (k in sc && typeof sc[k] !== 'boolean') throw new FormatError(`scenario.${k}: must be a boolean`);
  if ('motes' in sc) {
    if (!Array.isArray(sc.motes)) throw new FormatError('scenario.motes: must be an array');
    sc.motes.forEach((m, i) => {
      if (!isVec3(Array.isArray(m) ? m : m?.pos)) throw new FormatError(`scenario.motes[${i}]: must be [x, y, z] or { pos }`);
    });
  }
  if ('shades' in sc) {
    if (!Array.isArray(sc.shades)) throw new FormatError('scenario.shades: must be an array');
    sc.shades.forEach((s, i) => {
      if (!obj(s) || !isVec3(s.pos)) throw new FormatError(`scenario.shades[${i}].pos: must be [x, y, z]`);
      if ('id' in s && typeof s.id !== 'string') throw new FormatError(`scenario.shades[${i}].id: must be a string`);
      if ('state' in s && !SHADE_STATES.includes(s.state)) throw new FormatError(`scenario.shades[${i}].state: must be one of ${SHADE_STATES.join(', ')}`);
      if ('state_ticks_left' in s && !isCount(s.state_ticks_left)) throw new FormatError(`scenario.shades[${i}].state_ticks_left: must be a non-negative integer`);
    });
  }
  if ('drifters' in sc) {
    if (!Array.isArray(sc.drifters)) throw new FormatError('scenario.drifters: must be an array');
    sc.drifters.forEach((d, i) => {
      if (!obj(d) || !isVec3(d.pos)) throw new FormatError(`scenario.drifters[${i}].pos: must be [x, y, z]`);
      if ('id' in d && typeof d.id !== 'string') throw new FormatError(`scenario.drifters[${i}].id: must be a string`);
      if ('state' in d && !DRIFTER_STATES.includes(d.state)) throw new FormatError(`scenario.drifters[${i}].state: must be one of ${DRIFTER_STATES.join(', ')}`);
      if ('stolen' in d && !isCount(d.stolen)) throw new FormatError(`scenario.drifters[${i}].stolen: must be a non-negative integer`);
    });
  }
  if ('charms' in sc) {
    if (!Array.isArray(sc.charms)) throw new FormatError('scenario.charms: must be an array');
    sc.charms.forEach((c, i) => {
      if (!obj(c) || !isVec3(c.pos)) throw new FormatError(`scenario.charms[${i}].pos: must be [x, y, z]`);
      if ('id' in c && typeof c.id !== 'string') throw new FormatError(`scenario.charms[${i}].id: must be a string`);
      if ('available' in c && typeof c.available !== 'boolean') throw new FormatError(`scenario.charms[${i}].available: must be a boolean`);
      if ('respawn_ticks' in c && !isCount(c.respawn_ticks)) throw new FormatError(`scenario.charms[${i}].respawn_ticks: must be a non-negative integer`);
    });
  }
  if ('lanterns' in sc) {
    if (!Array.isArray(sc.lanterns)) throw new FormatError('scenario.lanterns: must be an array');
    sc.lanterns.forEach((l, i) => {
      if (!obj(l) || typeof l.id !== 'string') throw new FormatError(`scenario.lanterns[${i}].id: must be a string`);
      if ('pos' in l && !isVec3(l.pos)) throw new FormatError(`scenario.lanterns[${i}].pos: must be [x, y, z]`);
      if ('lit' in l && typeof l.lit !== 'boolean') throw new FormatError(`scenario.lanterns[${i}].lit: must be a boolean`);
      if ('deposited' in l && !isCount(l.deposited)) throw new FormatError(`scenario.lanterns[${i}].deposited: must be a non-negative integer`);
    });
  }
  if ('time_left_s' in sc && !(isNum(sc.time_left_s) && sc.time_left_s >= 0)) throw new FormatError('scenario.time_left_s: must be a non-negative number');
}

/** Fisher-Yates with the seeded rng. */
function shuffled(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fresh id `prefix<n>` not in `used`; counters are per prefix. */
function nextId(world, prefix, used) {
  while (used.has(`${prefix}${world.counters[prefix]}`)) world.counters[prefix]++;
  return `${prefix}${world.counters[prefix]++}`;
}

function newShade(id, pos, state = 'wander', stateTicks = 0) {
  return { id, pos: [...pos], state, stateTicks, pushDir: [1, 0], pushLeft: 0, recoilDir: [1, 0], evicting: false, target: null };
}

function newDrifter(id, pos, state = 'idle', stolen = 0) {
  return { id, pos: [...pos], state, stolen, fleeTicks: state === 'flee' ? RULES.drifterFleeTicks : 0, hasStolen: stolen > 0, target: null };
}

/**
 * Build the world for (seed, night, scenario). Setup emits no events and awards no score.
 */
export function createWorld({ seed = 0, night = 1, scenario = null } = {}) {
  const map = MAPS[night];
  if (!map) throw new Error(`--night must be 1, 2 or 3 (got ${night})`);
  const rng = createRng(seed);
  const sc = scenario ?? {};
  validateScenario(sc);

  const world = {
    seed,
    night,
    map,
    rng,
    tick: 0,
    simTick: 0,
    started: false,
    state: 'playing',
    paused: false,
    score: 0,
    timeStart: 'time_left_s' in sc ? sc.time_left_s : map.duration,
    timeLeft: 0,
    randomMotes: sc.random_motes !== false,
    randomShades: sc.random_shades !== false,
    randomDrifters: sc.random_drifters !== false && map.drifters,
    windEnabled: sc.wind_enabled ?? map.wind,
    wind: { active: false, dirDeg: 0, ticksLeft: 0 },
    counters: { M: 1, S: 1, D: 1, C: 1 },
    player: {
      pos: [...map.start],
      vel: [0, 0, 0],
      grounded: true,
      facing: [0, 1], // facing +Z at the start
      flames: TUNING.flames,
      carried: 0,
      invulnTicks: 0,
      dashCdTicks: 0,
      dashTicks: 0,
      dashDir: [0, 1],
      pulseCdTicks: 0,
      charmTicks: 0,
      fallWait: 0,
      launch: null, // [vx, vz] kept from a jump pad until landing
    },
    motes: [],
    shades: [],
    lanterns: map.lanterns.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0, evictLeft: 0 })),
    drifters: [],
    charms: map.charms.map((pos, i) => ({ id: `C${i + 1}`, pos: [...pos], available: true, respawnTicks: 0 })),
  };
  world.timeLeft = world.timeStart;

  const p = world.player;
  const sp = sc.player ?? {};
  if (sp.pos) p.pos = [...sp.pos];
  if ('flames' in sp) p.flames = sp.flames;
  if ('carried' in sp) p.carried = sp.carried;
  if ('invuln_ticks' in sp) p.invulnTicks = sp.invuln_ticks;
  if ('dash_cd_ticks' in sp) p.dashCdTicks = sp.dash_cd_ticks;
  if ('pulse_cd_ticks' in sp) p.pulseCdTicks = sp.pulse_cd_ticks;
  if ('charm_ticks' in sp) p.charmTicks = sp.charm_ticks;
  const g = supportAt(map, p.pos[0], p.pos[2], p.pos[1], 1e-6);
  p.grounded = g !== null && Math.abs(p.pos[1] - g) < 1e-6;

  // Initial fireflies: always drawn, so the RNG stream for a seed does not
  // depend on which scenario fields are present.
  const startPoints = shuffled(map.motePoints.map((_, i) => i), rng).slice(0, RULES.motesStart);
  if (sc.motes) {
    world.motes = sc.motes.map((m) => ({ id: `M${world.counters.M++}`, pos: [...(Array.isArray(m) ? m : m.pos)], kind: 'random', ttl: null, point: null, born: -1 }));
  } else if (world.randomMotes) {
    world.motes = startPoints.map((pi) => ({ id: `M${world.counters.M++}`, pos: [...map.motePoints[pi]], kind: 'random', ttl: null, point: pi, born: -1 }));
  }

  if (sc.shades) {
    const used = new Set(sc.shades.map((s) => s.id).filter(Boolean));
    world.shades = sc.shades.map((s) => newShade(s.id ?? nextId(world, 'S', used), s.pos, s.state ?? 'wander', s.state_ticks_left ?? (s.state === 'stunned' ? ticks(TUNING.pulse_stun_s) : 0)));
  }
  if (sc.drifters) {
    const used = new Set(sc.drifters.map((d) => d.id).filter(Boolean));
    world.drifters = sc.drifters.map((d) => newDrifter(d.id ?? nextId(world, 'D', used), d.pos, d.state ?? 'idle', d.stolen ?? 0));
  }
  if (sc.charms) {
    const used = new Set(sc.charms.map((c) => c.id).filter(Boolean));
    world.charms = sc.charms.map((c) => ({ id: c.id ?? nextId(world, 'C', used), pos: [...c.pos], available: c.available ?? true, respawnTicks: c.respawn_ticks ?? 0 }));
  }

  for (const u of sc.lanterns ?? []) {
    const l = world.lanterns.find((x) => x.id === u.id);
    if (!l) throw new FormatError(`scenario.lanterns: unknown lantern id "${u.id}"`);
    if (u.pos) l.pos = [...u.pos];
    if ('lit' in u) l.lit = u.lit;
    if ('deposited' in u) l.deposited = u.deposited;
  }
  return world;
}

// ---------------------------------------------------------------- helpers

function detectable(world, s) {
  const p = world.player;
  return p.fallWait === 0 && distXZ(p.pos, s.pos) <= RULES.shadeDetect;
}

function awayDir(from, to) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const d = Math.hypot(dx, dz);
  return d < 1e-9 ? [1, 0] : [dx / d, dz / d]; // same position -> +X
}

/** Move a shade horizontally; it floats 1 m over the top surface, never over the cloud sea, and stops at lit safe zones. */
function moveShade(world, s, dx, dz) {
  const nx = s.pos[0] + dx;
  const nz = s.pos[2] + dz;
  const top = topAt(world.map, nx, nz);
  if (top === null) return false;
  s.pos[0] = nx;
  s.pos[2] = nz;
  s.pos[1] = top + RULES.shadeY;
  if (!s.evicting) clampOutOfSafeZones(world, s);
  return true;
}

function clampOutOfSafeZones(world, s) {
  for (const l of world.lanterns) {
    if (!l.lit) continue;
    const d = distXZ(s.pos, l.pos);
    if (d < TUNING.safe_radius) {
      const [ux, uz] = awayDir(l.pos, s.pos);
      s.pos[0] = l.pos[0] + ux * TUNING.safe_radius;
      s.pos[2] = l.pos[2] + uz * TUNING.safe_radius;
    }
  }
}

function settleShade(world, s) {
  s.state = detectable(world, s) ? 'chase' : 'wander';
  s.stateTicks = 0;
}

function addDroppedMote(world, pos) {
  world.motes.push({ id: `M${world.counters.M++}`, pos, kind: 'dropped', ttl: RULES.dropTtlTicks, point: null, born: world.simTick });
}

function dropMotesAround(world, n, center) {
  for (let i = 0; i < n; i++) {
    const a = world.rng() * 360;
    const r = RULES.dropRingMin + world.rng() * (RULES.dropRingMax - RULES.dropRingMin);
    const pos = polar(r, a, 0, center[0], center[2]);
    const g = supportAt(world.map, pos[0], pos[2], center[1], STEP_UP);
    if (g === null) continue; // fell into the cloud sea or off a ledge edge we cannot place on
    pos[1] = g;
    addDroppedMote(world, pos);
  }
}

function randomWanderTarget(world) {
  const areas = world.map.wanderAreas;
  const a = areas[Math.floor(world.rng() * areas.length)];
  return polar(Math.sqrt(world.rng()) * a.r, world.rng() * 360, 0, a.cx, a.cz);
}

// ---------------------------------------------------------------- step

/**
 * Advance one step with the input for tick k = world.tick. Returns this step's
 * events; each carries tick k + 1.
 */
export function step(world, input) {
  const events = [];
  if (world.state !== 'playing') return events;
  world.tick += 1;
  const emit = (name, data) => events.push({ type: 'event', tick: world.tick, name, data });
  const p = world.player;
  const pr = input.pressed;
  const map = world.map;
  if (!world.started) {
    world.started = true;
    emit('night_start', { night: world.night });
  }

  // 1. input: pause first
  if (pr.pause) {
    world.paused = !world.paused;
    emit(world.paused ? 'paused' : 'resumed', {});
    if (world.paused) return events;
  } else if (world.paused) return events;

  // 2. timers
  world.simTick += 1;
  world.timeLeft = Math.max(0, world.timeStart - world.simTick / TICK_RATE);
  for (const k of ['invulnTicks', 'dashCdTicks', 'pulseCdTicks', 'charmTicks']) if (p[k] > 0) p[k]--;
  let respawnNow = false;
  if (p.fallWait > 0 && --p.fallWait === 0) respawnNow = p.flames > 0;
  for (const s of world.shades) {
    if (s.state === 'spawning' || s.state === 'stunned' || s.state === 'recoil') {
      if (s.stateTicks > 0) s.stateTicks--;
      if (s.stateTicks === 0) settleShade(world, s);
    }
  }
  world.motes = world.motes.filter((m) => m.ttl === null || --m.ttl > 0);
  for (const c of world.charms) if (!c.available && c.respawnTicks > 0 && --c.respawnTicks === 0) c.available = true;
  for (const d of world.drifters) if (d.state === 'flee' && d.fleeTicks > 0 && --d.fleeTicks === 0) d.state = 'removed';
  world.drifters = world.drifters.filter((d) => d.state !== 'removed');
  if (world.windEnabled) {
    if (world.wind.ticksLeft > 0 && --world.wind.ticksLeft === 0) world.wind.active = false;
    if (world.simTick % RULES.windEveryTicks === 0) {
      world.wind.active = true;
      world.wind.ticksLeft = RULES.windGustTicks;
      world.wind.dirDeg = Math.floor(world.rng() * 360);
    }
  }

  // 3. move Mây (jump, dash, jump pad, wind), then check falling off
  if (respawnNow) {
    p.pos = [...map.start];
    p.vel = [0, 0, 0];
    p.grounded = true;
    p.dashTicks = 0;
    p.launch = null;
    p.invulnTicks = ticks(TUNING.invuln_s);
  } else if (p.fallWait === 0 && p.flames > 0) {
    movePlayer(world, input, emit);
  }

  if (p.fallWait === 0 && p.pos[1] < RULES.fallY) {
    // falling off: once, ignores invulnerability
    p.flames = Math.max(0, p.flames - 1);
    const lost = p.carried;
    p.carried = 0;
    p.vel = [0, 0, 0];
    p.dashTicks = 0;
    p.launch = null;
    p.fallWait = RULES.fallWaitTicks;
    emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
  }
  const active = p.fallWait === 0;
  const touching = (pos, r) => distXZ(p.pos, pos) <= r && Math.abs(p.pos[1] - pos[1]) <= RULES.pickupHeight;

  // 4. pick up fireflies and charms
  if (active) {
    const keep = [];
    for (const m of world.motes) {
      if (p.carried < TUNING.carry_capacity && m.born < world.simTick && touching(m.pos, TUNING.pickup_radius)) {
        p.carried++;
        emit('mote_picked', { carried: p.carried });
      } else keep.push(m);
    }
    world.motes = keep;
    for (const c of world.charms) {
      if (!c.available || !touching(c.pos, TUNING.pickup_radius)) continue;
      c.available = false;
      c.respawnTicks = RULES.charmRespawnTicks;
      p.charmTicks = RULES.charmTicks;
      emit('charm_picked', { charm_id: c.id, charm_ticks: p.charmTicks });
    }
  }

  // 5. lanterns
  if (active && pr.interact) {
    let best = null;
    let bestD = Infinity;
    for (const l of world.lanterns) {
      if (l.lit) continue;
      const d = distXZ(p.pos, l.pos);
      if (d > TUNING.interact_radius) continue;
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && compareIds(l.id, best.id) < 0)) {
        best = l;
        bestD = d;
      }
    }
    const amount = best ? Math.min(p.carried, TUNING.lantern_cost - best.deposited) : 0;
    if (amount > 0) {
      p.carried -= amount;
      best.deposited += amount;
      world.score += amount * TUNING.score.per_mote;
      emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= TUNING.lantern_cost) {
        best.lit = true;
        best.evictLeft = RULES.evictTicks;
        world.score += TUNING.score.per_lantern;
        emit('lantern_lit', { lantern_id: best.id });
      }
    }
  }

  // 6. safe zones: shades caught inside a newly lit zone are pushed to its edge within 30 ticks
  for (const s of world.shades) s.evicting = false;
  for (const l of world.lanterns) {
    if (!l.lit) continue;
    for (const s of world.shades) {
      const d = distXZ(s.pos, l.pos);
      if (d >= TUNING.safe_radius) continue;
      const [ux, uz] = awayDir(l.pos, s.pos);
      const stepOut = l.evictLeft > 0 ? (TUNING.safe_radius - d) / l.evictLeft : TUNING.safe_radius - d;
      s.pos[0] += ux * stepOut;
      s.pos[2] += uz * stepOut;
      s.evicting = l.evictLeft > 1;
    }
    if (l.evictLeft > 0) l.evictLeft--;
  }

  // 7. pulse (Tỏa Sáng)
  if (active && pr.pulse && p.pulseCdTicks === 0 && p.carried >= TUNING.pulse_cost) {
    p.carried -= TUNING.pulse_cost;
    p.pulseCdTicks = ticks(TUNING.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + RULES.pulseCenterUp, p.pos[2]];
    const inRange = (pos) => Math.hypot(pos[0] - c[0], pos[1] - c[1], pos[2] - c[2]) <= TUNING.pulse_radius;
    const hit = world.shades.filter((s) => inRange(s.pos));
    for (const s of hit) {
      s.state = 'stunned';
      s.stateTicks = ticks(TUNING.pulse_stun_s);
      s.pushDir = awayDir(p.pos, s.pos);
      s.pushLeft = RULES.pulsePushTicks;
      world.score += TUNING.score.per_stun;
    }
    for (const d of world.drifters) {
      if (!inRange(d.pos)) continue;
      if (d.state === 'chase' || d.state === 'idle') {
        // assumption B13: idle drifters are scared off too
        d.state = 'flee';
        d.fleeTicks = RULES.drifterFleeTicks;
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        for (let i = 0; i < amount; i++) {
          const g = topAt(map, d.pos[0], d.pos[2]);
          if (g !== null) addDroppedMote(world, [d.pos[0], g, d.pos[2]]);
        }
        d.stolen = 0;
        d.fleeTicks = Math.min(d.fleeTicks, RULES.drifterVanishAfterDropTicks);
        emit('drifter_drop', { drifter_id: d.id, amount });
      }
    }
    emit('pulse', { stunned_ids: hit.map((s) => s.id).sort(compareIds) });
  }

  // 8. move Bóng Mực and Gió Lạc
  const speed = map.shadeSpeed * DT;
  for (const s of world.shades) {
    if (s.state === 'stunned') {
      if (s.pushLeft > 0) {
        const d = TUNING.pulse_push_m / RULES.pulsePushTicks;
        if (!moveShade(world, s, s.pushDir[0] * d, s.pushDir[1] * d)) s.pushLeft = 0;
        else s.pushLeft--;
      }
      continue;
    }
    if (s.state === 'spawning' || s.evicting) continue;
    if (s.state === 'recoil') {
      const d = RULES.shadeRecoilM / RULES.shadeRecoilTicks;
      moveShade(world, s, s.recoilDir[0] * d, s.recoilDir[1] * d);
      continue;
    }
    const dist = distXZ(p.pos, s.pos);
    if (s.state === 'wander' && detectable(world, s)) s.state = 'chase';
    else if (s.state === 'chase' && (dist > RULES.shadeLose || p.fallWait > 0)) s.state = 'wander';
    if (s.state === 'chase') {
      const stepLen = Math.min(speed, dist);
      const [ux, uz] = awayDir(s.pos, p.pos);
      moveShade(world, s, ux * stepLen, uz * stepLen);
    } else {
      if (!s.target || distXZ(s.pos, s.target) < 0.5) s.target = randomWanderTarget(world);
      const stepLen = Math.min(RULES.shadeWanderSpeed * DT, distXZ(s.pos, s.target));
      const [ux, uz] = awayDir(s.pos, s.target);
      if (!moveShade(world, s, ux * stepLen, uz * stepLen)) s.target = null;
    }
  }
  for (const d of world.drifters) {
    const wants = active && p.carried >= RULES.drifterChaseCarry && distXZ(p.pos, d.pos) <= RULES.drifterChaseDist;
    if (d.state === 'idle' && wants && !d.hasStolen) d.state = 'chase';
    else if (d.state === 'chase' && !wants) d.state = 'idle';
    let dir;
    let v;
    if (d.state === 'chase') {
      dir = awayDir(d.pos, p.pos);
      v = Math.min(RULES.drifterSpeed * DT, distXZ(d.pos, p.pos));
    } else if (d.state === 'flee') {
      dir = awayDir(p.pos, d.pos);
      v = RULES.drifterSpeed * DT;
    } else {
      if (!d.target || distXZ(d.pos, d.target) < 0.5) d.target = randomWanderTarget(world);
      dir = awayDir(d.pos, d.target);
      v = Math.min(RULES.drifterIdleSpeed * DT, distXZ(d.pos, d.target));
    }
    d.pos[0] += dir[0] * v;
    d.pos[2] += dir[1] * v;
    d.pos[1] = (topAt(map, d.pos[0], d.pos[2]) ?? 0) + RULES.shadeY;
  }

  // 9. contact: Gió Lạc steal first, then Bóng Mực hit (by increasing id)
  if (active) {
    for (const d of [...world.drifters].sort((a, b) => compareIds(a.id, b.id))) {
      if (d.state !== 'chase' || d.hasStolen || p.carried <= 0) continue;
      if (distXZ(p.pos, d.pos) > RULES.drifterHitRadius || Math.abs(p.pos[1] - d.pos[1]) > RULES.shadeHitHeight) continue;
      const amount = Math.min(RULES.drifterStealMax, p.carried);
      p.carried -= amount;
      d.stolen += amount;
      d.hasStolen = true;
      d.state = 'flee';
      d.fleeTicks = RULES.drifterFleeTicks;
      emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
    for (const s of [...world.shades].sort((a, b) => compareIds(a.id, b.id))) {
      if (s.state !== 'wander' && s.state !== 'chase') continue;
      if (s.evicting || distXZ(p.pos, s.pos) > TUNING.shade_hit_radius || Math.abs(p.pos[1] - s.pos[1]) > RULES.shadeHitHeight) continue;
      if (p.invulnTicks > 0) continue; // touching while invulnerable does nothing
      p.flames = Math.max(0, p.flames - 1);
      const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
      p.carried -= dropped;
      dropMotesAround(world, dropped, p.pos);
      p.invulnTicks = ticks(TUNING.invuln_s);
      s.state = 'recoil';
      s.stateTicks = RULES.shadeRecoilTicks;
      s.recoilDir = awayDir(p.pos, s.pos);
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      break; // at most one flame per tick
    }
  }

  // 10. spawns (new entities interact from the next tick)
  if (world.randomMotes && world.simTick % RULES.moteSpawnEveryTicks === 0 && world.motes.length < RULES.motesMax) {
    const taken = new Set(world.motes.filter((m) => m.point !== null).map((m) => m.point));
    const free = map.motePoints.map((_, i) => i).filter((i) => !taken.has(i));
    if (free.length) {
      const pi = free[Math.floor(world.rng() * free.length)];
      world.motes.push({ id: `M${world.counters.M++}`, pos: [...map.motePoints[pi]], kind: 'random', ttl: null, point: pi, born: world.simTick });
    }
  }
  if (world.randomShades) {
    let n = 0;
    if (world.simTick === SHADE_FIRST_TICK) n = SHADE_FIRST_COUNT;
    else if (world.simTick > SHADE_FIRST_TICK && (world.simTick - SHADE_FIRST_TICK) % map.shadeEveryTicks === 0) n = 1;
    const used = new Set(world.shades.map((s) => s.id));
    for (let i = 0; i < n && world.shades.length < map.shadeMax; i++) {
      const valid = map.shadePoints.filter((pt) => distXZ(pt, p.pos) >= RULES.shadeSpawnMinDist && !world.lanterns.some((l) => l.lit && distXZ(pt, l.pos) < TUNING.safe_radius));
      if (!valid.length) break;
      const pt = valid[Math.floor(world.rng() * valid.length)];
      const id = nextId(world, 'S', used);
      used.add(id);
      world.shades.push(newShade(id, [pt[0], (topAt(map, pt[0], pt[2]) ?? 0) + RULES.shadeY, pt[2]], 'spawning', RULES.shadeSpawnTicks));
      emit('shade_spawned', { id });
    }
  }
  if (world.randomDrifters && world.simTick % RULES.drifterEveryTicks === 0 && world.drifters.length < RULES.drifterMax) {
    // assumption B12: "a random fog point" = one of the night's Bóng Mực spawn points
    const pt = map.shadePoints[Math.floor(world.rng() * map.shadePoints.length)];
    const id = nextId(world, 'D', new Set(world.drifters.map((d) => d.id)));
    world.drifters.push(newDrifter(id, [pt[0], (topAt(map, pt[0], pt[2]) ?? 0) + RULES.shadeY, pt[2]]));
  }

  // 11. win / lose
  if (p.flames <= 0) {
    world.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'no_flames' });
  } else if (world.lanterns.every((l) => l.lit)) {
    world.state = 'won';
    world.score += Math.floor(world.timeLeft) * TUNING.score.per_second_left + p.flames * TUNING.score.per_flame_left;
    emit('game_over', { result: 'won', reason: 'all_lit' });
  } else if (world.timeLeft <= 0) {
    world.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'dawn' });
  }
  return events;
}

function movePlayer(world, input, emit) {
  const p = world.player;
  const map = world.map;
  const [dx, dz] = worldMove(input.move, input.camYawDeg);
  const mag = Math.hypot(dx, dz);
  if (mag > 1e-9) p.facing = [dx / mag, dz / mag];

  const charm = p.charmTicks > 0;
  if (input.pressed.dash && p.dashTicks === 0 && (p.dashCdTicks === 0 || charm)) {
    p.dashTicks = ticks(TUNING.dash_duration_s);
    p.dashDir = mag > 1e-9 ? [dx / mag, dz / mag] : [...p.facing];
    p.dashCdTicks = charm ? 0 : ticks(TUNING.dash_cooldown_s);
    emit('dash', {});
  }

  const prevY = p.pos[1];
  if (p.dashTicks > 0) {
    // dash keeps height
    p.dashTicks--;
    p.vel = [p.dashDir[0] * TUNING.dash_speed, 0, p.dashDir[1] * TUNING.dash_speed];
  } else {
    if (p.launch) {
      // jump pad: launch velocity is kept until landing, movement keys do not override
      p.vel[0] = p.launch[0];
      p.vel[2] = p.launch[1];
    } else {
      const run = charm ? RULES.charmSpeed : TUNING.player_speed;
      p.vel[0] = dx * run;
      p.vel[2] = dz * run;
    }
    if (input.pressed.jump && p.grounded) {
      p.vel[1] = RULES.jumpSpeed;
      p.grounded = false;
    }
    if (!p.grounded) p.vel[1] -= RULES.gravity * DT;
  }

  let mx = p.vel[0] * DT;
  let mz = p.vel[2] * DT;
  if (world.wind.active) {
    const a = (world.wind.dirDeg * Math.PI) / 180;
    mx += Math.cos(a) * RULES.windPush * DT;
    mz += Math.sin(a) * RULES.windPush * DT;
  }
  const ny = p.pos[1] + p.vel[1] * DT;
  // cliffs and the bell tower block horizontal movement
  if (!blockedAt(map, p.pos[0] + mx, p.pos[2] + mz, Math.max(p.pos[1], ny), STEP_UP)) {
    p.pos[0] += mx;
    p.pos[2] += mz;
  }
  p.pos[1] = ny;

  const g = supportAt(map, p.pos[0], p.pos[2], p.grounded ? prevY : Math.max(prevY, p.pos[1]), STEP_UP);
  if (p.grounded) {
    if (g === null || g < prevY - STEP_UP) p.grounded = false; // walked off an edge
    else p.pos[1] = g;
  } else if (g !== null && p.pos[1] <= g && prevY >= g - 1e-6 && p.vel[1] <= 0) {
    p.pos[1] = g;
    p.vel[1] = 0;
    p.grounded = true;
    p.launch = null;
  }

  // jump pads: feet touching the pad launch Mây towards the target
  if (p.grounded) {
    for (const pad of map.pads) {
      if (distXZ(p.pos, pad.pos) <= pad.r && Math.abs(p.pos[1] - pad.pos[1]) < 1e-6) {
        p.launch = [pad.dir[0] * pad.h, pad.dir[1] * pad.h];
        p.vel = [p.launch[0], pad.vy, p.launch[1]];
        p.grounded = false;
        p.dashTicks = 0;
        break;
      }
    }
  }
}
