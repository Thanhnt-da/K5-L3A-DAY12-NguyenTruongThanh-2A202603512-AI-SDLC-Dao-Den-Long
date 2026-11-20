# Changelog

## Unreleased (Phase 2, Ticket-02, Contract v1.1)
- Standard numbers from Ticket-02 in `game.contract.json` (v1.1) and `RULES`; standard Night 1 map (radius 40 m, fixed lanterns, spawn points).
- Simulation rewritten around the mandatory 12-step tick order: fireflies (spawn, pickup, drop TTL), lanterns (deposit, light, safe zones with eviction), pulse, Bóng Mực (spawning/wander/chase/recoil/stunned), hits, falling + respawn, dash, jump, pause, scoring, win/lose.
- Snapshot v1.1 fields, new events (`dash`, `paused`, `resumed`, `player_hit.lost`), scenario v1.1 fields.
- Client: new controls (Shift dash, E deposit, F pulse, Esc/P pause); quick key taps no longer get lost.
- Harness: Stop hook also builds the client; evidence script ignores its own output when checking for uncommitted changes.
- 18 new rule tests (29 total).

## phase-1

- Project setup: Vite + Three.js client, deterministic simulation core, Test Contract v1.0 headless CLI.
- Contract I/O: argument parsing, inputs/scenario validation (exit 2), snapshot/event/end JSONL, 3-decimal rounding, tick model, dawn timer.
- Movement (camera-relative, normalised), jump, island edge wall.
- Tests, CI, evidence script, AI harness (CLAUDE.md, verify-phase skill, Stop hook).
