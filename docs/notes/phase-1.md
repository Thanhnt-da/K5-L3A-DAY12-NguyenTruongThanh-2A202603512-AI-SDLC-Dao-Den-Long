# Phase 1: PRD-0 + Test Contract v1.0

## Requirements (summary of the lab board, Phase 1 tab)

- Night 1 "Đêm 1 – Đảo Bến": round island, **5 Big Lanterns** (L1–L5).
- Movement, jump, third-person 3D camera.
- Fireflies scattered on the island: pick up, carry, deposit into lanterns to light them.
- Bóng Mực chase Mây; contact costs a flame (HP). Light pulse pushes/stuns them and costs light. They fear lanterns.
- Win: all lanterns lit. Lose: no flames left (or dawn). Score, HUD, replay.
- Deliverables: playable Night 1 start → win/lose; README (≤ 3 commands, controls, scoring); `game.contract.json` + headless mode per Test Contract v1.0; evidence + notes; AI harness. Tag `phase-1`.

## Acceptance criteria (each one testable)

| # | Criterion ("do A → see B") | How verified | Status |
|---|---|---|---|
| C1 | Contract file has every required key, `lantern_count_night1 = 5` | `tests/contract.test.js` | done |
| C2 | Headless writes snapshot at tick 0 and every N ticks, final `end` line, exit 0 | `tests/contract.test.js` | done |
| C3 | Malformed inputs/scenario → exit 2 + stderr | `tests/contract.test.js` | done |
| C4 | Input of tick k applies in step k; events have tick k+1; `time_left_s` = start − steps/60 | `tests/contract.test.js` | done |
| C5 | `move` rotated by `cam_yaw_deg`, normalised; player moves `player_speed` m/s | `tests/contract.test.js`, scenario `walk-forward` | done |
| C6 | Scenario setup replaces lists, updates lanterns by id, no events, no score | `tests/contract.test.js` | done |
| C7 | Same seed + scenario + inputs → identical output (2 runs) | `tests/contract.test.js`, `scripts/evidence.mjs` | done |
| C8 | Time runs out → `game_over` lost/dawn | test + scenario `dawn-timeout` | done |
| C9 | Walk within `pickup_radius` of a firefly → `mote_picked`, carried +1, up to `carry_capacity` | _todo_ | todo |
| C10 | Interact within `interact_radius` of a lantern → `deposit`; reaching `lantern_cost` → `lantern_lit` | _todo_ | todo |
| C11 | All lanterns lit → `game_over` won/all_lit | _todo_ | todo |
| C12 | Shade within `shade_hit_radius` → `player_hit`, flames −1, drops `hit_drop_ratio` of carried, `invuln_s` immunity | _todo_ | todo |
| C13 | Flames reach 0 → `game_over` lost/no_flames | _todo_ | todo |
| C14 | Pulse (cost, radius, cooldown) → shades in radius `stunned` for `pulse_stun_s`, pushed `pulse_push_m` | _todo_ | todo |
| C15 | Shades never enter `safe_radius` around lit lanterns | _todo_ | todo |
| C16 | Score adds per_mote / per_lantern / per_stun, plus end bonus per second / flame left | _todo_ | todo |
| C17 | Playable in browser: HUD, win/lose screen, replay | screenshots | todo |

## Assumptions (PRD-0 is vague on purpose; these are my decisions)

| # | Topic | Assumption | Why |
|---|---|---|---|
| A1 | Stack | Three.js web game + Node headless; the same `src/sim` code runs in both | Runs on macOS/Linux without GPU; one source of truth for rules |
| A2 | Island | Radius 30 m, edge is a wall (`fall_enabled: false`) | Simplest; no `fall` hits |
| A3 | Lantern layout | L1–L5 evenly on a 22 m ring, L1 at +Z | Deterministic, fair spread |
| A4 | Fireflies | 30 random motes per night, seeded, 4–28 m from centre | Enough for 5 × `lantern_cost` (25) with some slack |
| A5 | `move` out of [−1, 1] | Components clamped, then vector normalised if longer than 1 | Contract says inputs lie in range; clamping is safest |
| A6 | Unknown lantern id in scenario | Malformed → exit 2 | Most likely a test-writing error |
| A7 | Dawn | Reaching `time_left_s = 0` ends the night: lost / `dawn` | Contract lists `dawn` as a loss reason |
| A8 | Numbers in `tuning` | Draft values, finalised once each rule is implemented | Hidden tests use these numbers, so they must match the code |
| A9 | "Pulse costs light" | _to decide: costs carried fireflies (`pulse_cost` = 1)?_ | |
| A10 | Shade spawning | _to decide: how many, where, when (`shade_spawned`)_ | |
| A11 | End-of-night score bonus | _to decide: only on a win?_ | |

## Evaluation (fill in at the end of the phase)

- Met / not met:
- Broke anything earlier: n/a (first phase)
- What AI got wrong and how I caught it:
- Harness changes:
- Tokens / cost estimate:
