// Pure, deterministic game simulation (Ticket-02 standard numbers, Contract v1.1).
// No DOM, no Three.js, no Math.random(), no wall-clock time: the browser client
// and the headless runner both drive it through createWorld() + step().
//
// step() follows the mandatory 12-step order of Ticket-02. Implemented: Night 1
// (movement, jump, dash, falling, fireflies, lanterns, safe zones, pulse,
// Bóng Mực, hits, scoring, win/lose, pause). Nights 2-3, Gió Lạc, Bùa Gió pickups
// and wind are TODO(phase-2).
import { TUNING, RULES, DT, TICK_RATE, ticks } from './config.js';
import { MAPS, groundAt, polar } from './maps.js';
import { createRng } from './rng.js';
import { FormatError } from './errors.js';
import { worldMove } from './inputs.js';

const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
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
  if (sc === null || typeof sc !== 'object' || Array.isArray(sc)) throw new FormatError('scenario: top level must be an object');
  const p = sc.player;
  if (p !== undefined) {
    if (p === null || typeof p !== 'object' || Array.isArray(p)) throw new FormatError('scenario.player: must be an object');
    if ('pos' in p && !isVec3(p.pos)) throw new FormatError('scenario.player.pos: must be [x, y, z]');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) if (k in p && !isCount(p[k])) throw new FormatError(`scenario.player.${k}: must be a non-negative integer`);
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) if (k in sc && typeof sc[k] !== 'boolean') throw new FormatError(`scenario.${k}: must be a boolean`);
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
      if ('state' in s && !SHADE_STATES.includes(s.state)) throw new FormatError(`scenario.shades[${i}].state: must be one of ${SHADE_STATES.join(', ')}`);
      if ('state_ticks_left' in s && !isCount(s.state_ticks_left)) throw new FormatError(`scenario.shades[${i}].state_ticks_left: must be a non-negative integer`);
    });
  }
  if ('lanterns' in sc) {
    if (!Array.isArray(sc.lanterns)) throw new FormatError('scenario.lanterns: must be an array');
    sc.lanterns.forEach((l, i) => {
      if (l === null || typeof l !== 'object' || typeof l.id !== 'string') throw new FormatError(`scenario.lanterns[${i}].id: must be a string`);
      if ('pos' in l && !isVec3(l.pos)) throw new FormatError(`scenario.lanterns[${i}].pos: must be [x, y, z]`);
      if ('lit' in l && typeof l.lit !== 'boolean') throw new FormatError(`scenario.lanterns[${i}].lit: must be a boolean`);
      if ('deposited' in l && !isCount(l.deposited)) throw new FormatError(`scenario.lanterns[${i}].deposited: must be a non-negative integer`);
    });
  }
  for (const k of ['drifters', 'charms']) if (k in sc && !Array.isArray(sc[k])) throw new FormatError(`scenario.${k}: must be an array`);
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

function nextId(world, prefix, used) {
  const key = `next${prefix}`;
  while (used.has(`${prefix}${world[key]}`)) world[key]++;
  return `${prefix}${world[key]++}`;
}

function newShade(id, pos, state = 'wander', stateTicks = 0) {
  return { id, pos: [...pos], state, stateTicks, pushDir: [1, 0], pushLeft: 0, recoilDir: [1, 0], evicting: false, target: null };
}

/**
 * Build the world for (seed, night, scenario). Setup emits no events and awards no score.
 */
export function createWorld({ seed = 0, night = 1, scenario = null } = {}) {
  const map = MAPS[night];
  if (!map) throw new Error(`night ${night} is not available yet (implemented: ${Object.keys(MAPS).join(', ')})`);
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
    state: 'playing',
    paused: false,
    score: 0,
    timeStart: 'time_left_s' in sc ? sc.time_left_s : map.duration,
    timeLeft: 0,
    randomMotes: sc.random_motes !== false,
    randomShades: sc.random_shades !== false,
    wind: { active: false, dirDeg: 0 },
    nextM: 1,
    nextS: 1,
    shadesSpawned: 0,
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
    },
    motes: [],
    shades: [],
    lanterns: map.lanterns.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0, evictLeft: 0 })),
    drifters: [],
    charms: [],
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
  const g = groundAt(map, p.pos[0], p.pos[2]);
  p.grounded = g !== null && Math.abs(p.pos[1] - g) < 1e-9;

  // Initial fireflies: always drawn, so the RNG stream for a seed does not
  // depend on which scenario fields are present.
  const startPoints = shuffled(map.motePoints.map((_, i) => i), rng).slice(0, RULES.motesStart);
  if (sc.motes) {
    world.motes = sc.motes.map((m) => ({ id: `M${world.nextM++}`, pos: [...(Array.isArray(m) ? m : m.pos)], kind: 'random', ttl: null, point: null, born: -1 }));
  } else if (world.randomMotes) {
    world.motes = startPoints.map((pi) => ({ id: `M${world.nextM++}`, pos: [...map.motePoints[pi]], kind: 'random', ttl: null, point: pi, born: -1 }));
  }

  if (sc.shades) {
    const used = new Set(sc.shades.map((s) => s.id).filter(Boolean));
    world.shades = sc.shades.map((s) => newShade(s.id ?? nextId(world, 'S', used), s.pos, s.state ?? 'wander', s.state_ticks_left ?? (s.state === 'stunned' ? ticks(TUNING.pulse_stun_s) : 0)));
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

/** Move a shade horizontally; refuse to leave the island, stop at lit safe zones. */
function moveShade(world, s, dx, dz) {
  const nx = s.pos[0] + dx;
  const nz = s.pos[2] + dz;
  if (groundAt(world.map, nx, nz) === null) return false;
  s.pos[0] = nx;
  s.pos[2] = nz;
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

function dropMotes(world, n, center) {
  for (let i = 0; i < n; i++) {
    const a = world.rng() * 360;
    const r = RULES.dropRingMin + world.rng() * (RULES.dropRingMax - RULES.dropRingMin);
    const pos = polar(r, a, 0, center[0], center[2]);
    const g = groundAt(world.map, pos[0], pos[2]);
    if (g === null) continue; // fell into the cloud sea
    pos[1] = g;
    world.motes.push({ id: `M${world.nextM++}`, pos, kind: 'dropped', ttl: RULES.dropTtlTicks, point: null, born: world.simTick });
  }
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

  // 3. move Mây, then check falling off
  if (respawnNow) {
    p.pos = [...world.map.start];
    p.vel = [0, 0, 0];
    p.grounded = true;
    p.dashTicks = 0;
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
    p.fallWait = RULES.fallWaitTicks;
    emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
  }
  const active = p.fallWait === 0;

  // 4. pick up fireflies
  if (active) {
    const keep = [];
    for (const m of world.motes) {
      if (p.carried < TUNING.carry_capacity && m.born < world.simTick && distXZ(p.pos, m.pos) <= TUNING.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= RULES.pickupHeight) {
        p.carried++;
        emit('mote_picked', { carried: p.carried });
      } else keep.push(m);
    }
    world.motes = keep;
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

  // 7. pulse
  if (active && pr.pulse && p.pulseCdTicks === 0 && p.carried >= TUNING.pulse_cost) {
    p.carried -= TUNING.pulse_cost;
    p.pulseCdTicks = ticks(TUNING.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + RULES.pulseCenterUp, p.pos[2]];
    const hit = world.shades.filter((s) => Math.hypot(s.pos[0] - c[0], s.pos[1] - c[1], s.pos[2] - c[2]) <= TUNING.pulse_radius);
    for (const s of hit) {
      s.state = 'stunned';
      s.stateTicks = ticks(TUNING.pulse_stun_s);
      s.pushDir = awayDir(p.pos, s.pos);
      s.pushLeft = RULES.pulsePushTicks;
      world.score += TUNING.score.per_stun;
    }
    emit('pulse', { stunned_ids: hit.map((s) => s.id).sort(compareIds) });
  }

  // 8. move shades
  const speed = world.map.shadeSpeed * DT;
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
      if (!s.target || distXZ(s.pos, s.target) < 0.5) {
        const is = world.map.islands[Math.floor(world.rng() * world.map.islands.length)];
        s.target = polar(Math.sqrt(world.rng()) * is.r * 0.9, world.rng() * 360, 0, is.cx, is.cz);
      }
      const wd = distXZ(s.pos, s.target);
      const stepLen = Math.min(RULES.shadeWanderSpeed * DT, wd);
      const [ux, uz] = awayDir(s.pos, s.target);
      if (!moveShade(world, s, ux * stepLen, uz * stepLen)) s.target = null;
    }
  }

  // 9. contact: (Gió Lạc first - TODO phase-2), then Bóng Mực by increasing id
  if (active) {
    for (const s of [...world.shades].sort((a, b) => compareIds(a.id, b.id))) {
      if (s.state !== 'wander' && s.state !== 'chase') continue;
      if (s.evicting || distXZ(p.pos, s.pos) > TUNING.shade_hit_radius || Math.abs(p.pos[1] - s.pos[1]) > RULES.shadeHitHeight) continue;
      if (p.invulnTicks > 0) continue; // touching while invulnerable does nothing
      p.flames = Math.max(0, p.flames - 1);
      const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
      p.carried -= dropped;
      dropMotes(world, dropped, p.pos);
      p.invulnTicks = ticks(TUNING.invuln_s);
      s.state = 'recoil';
      s.stateTicks = RULES.shadeRecoilTicks;
      s.recoilDir = awayDir(p.pos, s.pos);
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      break; // at most one flame per tick
    }
  }

  // 10. spawns (new entities interact from the next tick)
  const map = world.map;
  if (world.randomMotes && world.simTick % RULES.moteSpawnEveryTicks === 0 && world.motes.length < RULES.motesMax) {
    const taken = new Set(world.motes.filter((m) => m.point !== null).map((m) => m.point));
    const free = map.motePoints.map((_, i) => i).filter((i) => !taken.has(i));
    if (free.length) {
      const pi = free[Math.floor(world.rng() * free.length)];
      world.motes.push({ id: `M${world.nextM++}`, pos: [...map.motePoints[pi]], kind: 'random', ttl: null, point: pi, born: world.simTick });
    }
  }
  if (world.randomShades) {
    let n = 0;
    if (world.simTick === map.shadeFirstTick) n = map.shadeFirstCount;
    else if (world.simTick > map.shadeFirstTick && (world.simTick - map.shadeFirstTick) % map.shadeEveryTicks === 0) n = 1;
    const used = new Set(world.shades.map((s) => s.id));
    for (let i = 0; i < n && world.shades.length < map.shadeMax; i++) {
      const valid = map.shadePoints.filter((pt) => distXZ(pt, p.pos) >= RULES.shadeSpawnMinDist && !world.lanterns.some((l) => l.lit && distXZ(pt, l.pos) < TUNING.safe_radius));
      if (!valid.length) break;
      const pt = valid[Math.floor(world.rng() * valid.length)];
      const id = nextId(world, 'S', used);
      used.add(id);
      world.shades.push(newShade(id, [pt[0], pt[1] + RULES.shadeY, pt[2]], 'spawning', RULES.shadeSpawnTicks));
      emit('shade_spawned', { id });
    }
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
    const run = charm ? 7.2 : TUNING.player_speed;
    p.vel[0] = dx * run;
    p.vel[2] = dz * run;
    if (input.pressed.jump && p.grounded) {
      p.vel[1] = RULES.jumpSpeed;
      p.grounded = false;
    }
    if (!p.grounded) p.vel[1] -= RULES.gravity * DT;
  }
  p.pos[0] += p.vel[0] * DT;
  p.pos[1] += p.vel[1] * DT;
  p.pos[2] += p.vel[2] * DT;

  const g = groundAt(map, p.pos[0], p.pos[2]);
  if (p.grounded) {
    if (g === null) p.grounded = false; // walked off the edge
    else p.pos[1] = g;
  } else if (g !== null && p.pos[1] <= g && prevY >= g - 1e-9 && p.vel[1] <= 0) {
    p.pos[1] = g;
    p.vel[1] = 0;
    p.grounded = true;
  }
}
