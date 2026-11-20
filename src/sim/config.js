// Single source of truth for gameplay numbers.
// `TUNING` is read from game.contract.json so the declared contract can never
// drift from what the simulation uses. `RULES` holds the other Ticket-02
// standard numbers that have no contract key.
import contract from '../../game.contract.json' with { type: 'json' };

export const TUNING = Object.freeze({ ...contract.tuning, score: Object.freeze({ ...contract.tuning.score }) });

export const TICK_RATE = 60; // fixed: 1 tick = 1/60 s
export const DT = 1 / TICK_RATE;
export const ticks = (s) => Math.round(s * TICK_RATE);

export const RULES = Object.freeze({
  // movement (Ticket-02 Part 1). Run speed is reached instantly (<= 0.1 s allowed).
  jumpSpeed: 7, // m/s
  gravity: 20, // m/s^2
  fallY: -10, // below this Y the player has fallen off
  fallWaitTicks: 60,
  // fireflies
  pickupHeight: 1.5,
  motesStart: 20,
  motesMax: 30,
  moteSpawnEveryTicks: 240,
  dropRingMin: 1.5,
  dropRingMax: 2.5,
  dropTtlTicks: 480,
  // lanterns
  evictTicks: 30, // a shade inside a newly lit safe zone is pushed out within this many ticks
  // pulse
  pulseCenterUp: 0.8,
  pulsePushTicks: 15,
  // shades
  shadeY: 1, // shade centre height above the ground it floats over
  shadeDetect: 12,
  shadeLose: 18,
  shadeHitHeight: 1.5,
  shadeRecoilM: 2,
  shadeRecoilTicks: 60,
  shadeSpawnTicks: 60, // assumption: harmless "spawning" state lasts 1 s
  shadeWanderSpeed: 1.5, // assumption
  shadeSpawnMinDist: 15,
  // Gió Lạc (drifters), Nights 2-3
  drifterSpeed: 7,
  drifterIdleSpeed: 2,
  drifterMax: 2,
  drifterEveryTicks: 1200,
  drifterChaseCarry: 5,
  drifterChaseDist: 15,
  drifterHitRadius: 1.2,
  drifterStealMax: 3,
  drifterFleeTicks: 240,
  drifterVanishAfterDropTicks: 120,
  // Bùa Gió (charms)
  charmTicks: 600,
  charmRespawnTicks: 2700,
  charmSpeed: 7.2,
  // wind (Night 3)
  windEveryTicks: 1800,
  windGustTicks: 300,
  windPush: 2,
});
