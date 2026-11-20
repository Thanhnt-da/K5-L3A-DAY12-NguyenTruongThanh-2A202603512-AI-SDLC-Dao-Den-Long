# Changelog

## phase-3 (Ticket-03 "Đèn cạn dầu", Contract v1.2)

### Breaking changes
- **Win rule:** the instant `all_lit` win is gone. Winning now means surviving to dawn with at least `ceil(0.6 × lanterns)` lit (`dawn_survived`). Lighting every lantern no longer ends the Night.
- **Night lengths:** 300/330/360 s → **240/270/300 s**.
- **Scoring:** +10 → **+5** per firefly put in; relight +40; a pulsed draining shade is worth +15 in total; the dawn bonus is per lit lantern (`50 + floor(fuel)`) plus 50 per flame; the time bonus is removed.
- **Safe zones:** a lantern with fuel < 30 no longer protects. Shades can enter and drain it.
- **Capacity:** no longer fixed at 10: `10 + 2 × successful lights`, max 20.
- **Contract v1.2:** new tuning keys; lantern snapshots add `fuel`, `ever_lit`, `relit_count`; player adds `capacity`; new shade state `drain`; new events `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` adds `relight`.

### Added
- Lantern fuel stored as integer 1/60 units (ADR 0001), refuel, relight, drain state, colour-blind setting, fuel bars and the refuel prompt in the client.
- 12 fuel tests, scenarios `p3-dawn-survived` and `p3-shade-drain`; removed `last-lantern-win` (its rule was replaced).

## phase-2

- Standard numbers from Ticket-02 in `game.contract.json` (v1.1) and `RULES`; standard Night 1 map (radius 40 m, fixed lanterns, spawn points).
- Simulation rewritten around the mandatory 12-step tick order: fireflies (spawn, pickup, drop TTL), lanterns (deposit, light, safe zones with eviction), pulse, Bóng Mực (spawning/wander/chase/recoil/stunned), hits, falling + respawn, dash, jump, pause, scoring, win/lose.
- Snapshot v1.1 fields, new events (`dash`, `paused`, `resumed`, `player_hit.lost`), scenario v1.1 fields.
- Client: new controls (Shift dash, E deposit, F pulse, Esc/P pause); quick key taps no longer get lost.
- Harness: Stop hook also builds the client; evidence script ignores its own output when checking for uncommitted changes.
- 18 new rule tests (29 total).
- Nights 2 (Đảo Cau) and 3 (Đảo Chuông): bridge, jump pads, 3 levels with cliffs and ramps, bell tower, wind gusts; Gió Lạc; Bùa Gió pickups; `night_start`.
- Terrain shapes are plain data shared by sim and client.
- Client: 3-Night chain with menu, intros, results and Bình Minh screen; pause menu; saved settings; synthesised sound; full HUD; standard palette; `?night=` and `?fps` URL options; 1280×720 runs at ~60 FPS.
- 15 Night 2-3 tests (44 total), 3 more headless scenarios.

## phase-1

- Project setup: Vite + Three.js client, deterministic simulation core, Test Contract v1.0 headless CLI.
- Contract I/O: argument parsing, inputs/scenario validation (exit 2), snapshot/event/end JSONL, 3-decimal rounding, tick model, dawn timer.
- Movement (camera-relative, normalised), jump, island edge wall.
- Tests, CI, evidence script, AI harness (CLAUDE.md, verify-phase skill, Stop hook).
