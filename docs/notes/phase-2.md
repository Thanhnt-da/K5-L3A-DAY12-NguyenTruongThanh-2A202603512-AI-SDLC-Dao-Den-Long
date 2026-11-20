# Phase 2: Ticket-02 "Ba hòn đảo" (Contract v1.1)

Requirements: [phase-2-ticket.md](phase-2-ticket.md) (working copy of the lab board tab).

## What changed from Phase 1 and why (design note)

Ticket-02 replaces every number I chose with **standard numbers**, and the hidden Phase 1 tests are re-run with them. So instead of finishing Phase 1 with my draft numbers, I rewrote `src/sim/world.js` once, around the ticket's **mandatory 12-step tick order**. Each step in the code is commented with its number. `game.contract.json` moved to v1.1 and still feeds `TUNING`. Standard numbers without a contract key live in `RULES` in `src/sim/config.js`. Maps moved to `src/sim/maps.js` (Night 1 now: radius 40 m, fixed lantern positions, 24 firefly spawn points, 12 shade spawn points).

Old Phase 1 decisions that were dropped: A2 (30 m wall, no falling), A3 (lantern ring), A4 (30 random fireflies). Ticket-02 replaces all three.

### Tests changed (with reason)
- `contract.test.js` "has every required key" → now checks `contract_version: "1.1"` and that `tuning` **equals** the standard numbers (Ticket-02 Part 4).
- All other Phase 1 contract tests are kept unchanged and still pass (regression).
- The Phase 1 headless scenarios `walk-forward` and `dawn-timeout` are unchanged. Speed 6 m/s still gives 6 m in 1 s, and dawn still ends the run.

## Acceptance criteria (Part 1 + contract, Night 1)

| # | Criterion | Verified by | Status |
|---|---|---|---|
| R1 | `tuning` = standard numbers, v1.1 keys present | `contract.test.js` | đạt |
| R2 | Pickup at XZ ≤ 1.0 m and height ≤ 1.5 m, capacity 10 | `rules.test.js` pickup ×2 | đạt |
| R3 | Interact ≤ 2.0 m deposits `min(carried, missing)` into the nearest unlit lantern (tie → smaller id); 10 lights it | `rules.test.js` lantern ×2 | đạt |
| R4 | Score: +10 per deposited firefly, +100 per lantern, +5 per pulsed shade, win bonus `floor(s)*2 + 50*flames` | lantern, pulse, win tests | đạt |
| R5 | Pulse: cost 3, 3D radius 5 from Mây+0.8 m, stun 120 ticks, push 4 m over 15 ticks, cooldown 3 s, no activation with < 3 | `rules.test.js` pulse ×2 | đạt |
| R6 | Shade hit: −1 flame, drop `floor(carried/2)` on a 1.5–2.5 m ring (TTL 480), 90 ticks invulnerable, shade recoils 2 m / 60 ticks, max 1 flame per tick | `rules.test.js` shade hit | đạt |
| R7 | Lose: no flames → `no_flames` (always wins over all_lit); time out → `dawn`. Win: all lit → `all_lit` | no_flames, win, dawn tests | đạt |
| R8 | Fall (Y < −10): −1 flame ignoring invulnerability, lose carried, wait 60 ticks, respawn at start, invulnerable 90; `player_hit.lost` | `rules.test.js` fall | đạt |
| R9 | Safe zone 6 m: shades blocked outside; a shade inside when lit is pushed out within 30 ticks, no damage | `rules.test.js` safe zone ×2 | đạt |
| R10 | Shade spawns: 2 at tick 300, then every 480, max 6, ≥ 15 m from player, ids S1.. | `rules.test.js` spawning | đạt |
| R11 | Fireflies: 20 at start on distinct points, +1 every 240 ticks up to 30 | `rules.test.js` fireflies | đạt |
| R12 | Dash 14 m/s × 0.2 s, facing direction when still, keeps height, cooldown 1.5 s; `dash` event | `rules.test.js` dash | đạt |
| R13 | Jump 7 m/s, gravity 20, jump only when grounded | `rules.test.js` jump | đạt |
| R14 | Pause: `tick` advances, `sim_tick`/time/cooldowns/spawns freeze, `state: "paused"`, `paused`/`resumed` events | `rules.test.js` pause + browser check | đạt |
| R15 | Snapshot v1.1 fields (`night`, `wind`, player `vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s`, `motes` with `kind/ttl_s`, `drifters`, `charms`) | snapshot output, CLI test | đạt (drifters/charms empty on Night 1) |
| R16 | Full headless Night ≤ 30 s | `rules.test.js` performance (to dawn, 6 shades) | đạt (0.4 s on the dev laptop) |
| R17 | Nights 2 and 3 (maps, jump pads, levels, wind) | — | **chưa đạt** (next) |
| R18 | Gió Lạc (drifters) | — | **chưa đạt** |
| R19 | Bùa Gió (charms): pickup, 7.2 m/s, no dash cooldown | speed/dash effect done via `charm_ticks`; pickup entity not yet | **một phần** (partial) |
| R20 | 3-Night chain, menus, settings saved, sound, full HUD, palette | — | **chưa đạt** |
| R21 | ≥ 30 FPS at 1280×720 | — | not measured yet |

## Assumptions (things Ticket-02 does not say)

| # | Topic | Assumption |
|---|---|---|
| B1 | Acceleration "≤ 0.1 s" | Instant (0 s), which satisfies ≤ 0.1 s and keeps 6 m/s exact |
| B2 | Shade `spawning` state | Lasts 60 ticks; does not move or hit |
| B3 | Shade `wander` | 1.5 m/s towards random points on the island (seeded rng) |
| B4 | Shade height | Centre floats 1.0 m above the ground (as in the contract's example snapshot) |
| B5 | `player.invuln` in snapshots | Boolean (invulnerable now or not) |
| B6 | Random firefly "free point" | A spawn point with no undropped random firefly on it |
| B7 | Shade spawn points | Also skip points inside a lit lantern's safe zone |
| B8 | `night_start` event | Not emitted yet; to decide with the 3-Night chain |
| B9 | Pre-lit lantern via scenario | `deposited` stays as given in the scenario |
| B10 | Interact distance | Measured on XZ only, like the other radii |

## Evaluation (fill in at the tag)

- Met / not met:
- Broke anything earlier: no. All Phase 1 contract tests and scenarios still pass with the standard numbers.
- What AI got wrong and how I caught it: (1) the client still imported a removed constant, so the build broke while all tests stayed green. Caught by running the build; the Stop hook now also builds. (2) The first "full Night" performance test ended early (shades killed the idle player at tick ~1700), so it didn't measure a full Night. Caught by checking the end line; the test now waits in a safe zone until dawn. (3) Key taps shorter than one frame were lost in the browser (pause didn't work). Caught in the browser check and fixed by latching taps.
- Harness changes: Stop hook also runs `vite build`; evidence script no longer flags its own output as "uncommitted".
- Tokens / cost estimate:
