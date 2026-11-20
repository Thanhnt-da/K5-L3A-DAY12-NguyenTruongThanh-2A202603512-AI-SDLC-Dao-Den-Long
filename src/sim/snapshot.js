// Contract v1.0 output line builders. All coordinates rounded to 3 decimals.
const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
};
const v3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];

export function snapshotLine(w) {
  return {
    type: 'snapshot',
    tick: w.tick,
    sim_tick: w.tick, // Phase 1: gameplay steps == ticks
    state: w.state,
    time_left_s: r3(w.timeLeft),
    score: w.score,
    player: { pos: v3(w.player.pos), flames: w.player.flames, carried: w.player.carried },
    lanterns: w.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: w.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: v3(m.pos) })),
  };
}

export function endLine(w) {
  return { type: 'end', ticks: w.tick, state: w.state, score: w.score };
}
