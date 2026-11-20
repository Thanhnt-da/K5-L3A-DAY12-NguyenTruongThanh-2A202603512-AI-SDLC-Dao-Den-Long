// Contract v1.1 output line builders. Coordinates and seconds rounded to 3 decimals.
import { TICK_RATE } from './config.js';
import { capacityOf } from './world.js';

const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};
const v3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];
const sec = (t) => r3(t / TICK_RATE);

export function snapshotLine(w) {
  const p = w.player;
  return {
    type: 'snapshot',
    tick: w.tick,
    sim_tick: w.simTick,
    night: w.night,
    state: w.paused && w.state === 'playing' ? 'paused' : w.state,
    time_left_s: r3(w.timeLeft),
    score: w.score,
    wind: { active: w.wind.active, dir_deg: r3(w.wind.dirDeg) },
    player: {
      pos: v3(p.pos),
      vel: v3(p.vel),
      grounded: p.grounded,
      flames: p.flames,
      carried: p.carried,
      capacity: capacityOf(p),
      invuln: p.invulnTicks > 0,
      dash_cd_s: sec(p.dashCdTicks),
      pulse_cd_s: sec(p.pulseCdTicks),
      charm_s: sec(p.charmTicks),
    },
    lanterns: w.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited, fuel: l.lit ? Math.round((l.fuel / TICK_RATE) * 10) / 10 : 0, ever_lit: l.everLit, relit_count: l.relitCount })),
    shades: w.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: v3(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : sec(m.ttl) })),
    drifters: w.drifters.map((d) => ({ id: d.id, pos: v3(d.pos), state: d.state, stolen: d.stolen })),
    charms: w.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: sec(c.respawnTicks) })),
  };
}

export function endLine(w) {
  return { type: 'end', ticks: w.tick, state: w.state, score: w.score };
}
