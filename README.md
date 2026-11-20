# Đảo Đèn Lồng

> **Demo video:** _(link added in Phase 4)_ · Day 12 AI SDLC lab · Nguyễn Trường Thành · 2A202603512

Mây, a young lantern keeper, collects fireflies to relight the Big Lanterns of a cloud-sea island while dodging the Bóng Mực in the black fog. 3D third-person, runs in the browser (Three.js); game logic is a pure deterministic simulation that also runs headless (Node) for the Test Contract.

> Status: **Phase 2.** Three Nights (Đảo Bến, Đảo Cau, Đảo Chuông) with the Ticket-02 standard numbers and Contract v1.1: Gió Lạc, Bùa Gió, wind, jump pads, menus, pause, settings, sound, full HUD. Verified: [docs/notes/phase-2.md](docs/notes/phase-2.md), [docs/proof/](docs/proof/).

## Install and run (macOS / Linux, Node.js 20+)

```bash
npm ci
npm run build
npm start          # then open http://localhost:4173
```

`npm run dev` starts a hot-reload dev server instead. Add `?night=2` or `?night=3` to the URL to start from that Night, and `?fps` to show an FPS counter. The built `dist/` folder is a static site and can be served by any web server.

## Controls

| Key | Action |
|---|---|
| W / S, A / D (↑ / ↓) | Move (relative to camera) |
| Mouse drag, Q / R, ← / → | Rotate camera |
| Space | Jump |
| Shift | Dash |
| E | Deposit fireflies into the nearest unlit lantern |
| F | Light pulse (costs 3 fireflies) |
| Esc / P | Pause menu (continue, replay Night, settings, main menu) |
| Enter | Confirm on menus (start, play, next Night, replay) |

## Scoring

Ticket-02 standard scoring (`game.contract.json` → `tuning.score`):

- +10 per firefly **deposited** into a lantern (picking up gives nothing yet)
- +100 per lantern lit
- +5 per Bóng Mực hit by a light pulse (each one, each time)
- On a win: + `floor(seconds left) × 2` + 50 × flames left

## Tests and headless mode

```bash
npm test                                   # unit + contract + rules + determinism tests
node scripts/evidence.mjs 2                # save Phase 2 evidence to docs/proof/phase-2/
node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario tests/scenarios/walk-forward/scenario.json] \
  [--inputs tests/scenarios/walk-forward/inputs.json] [--snapshot-every 10]
```

Test Contract v1.1 declaration: [`game.contract.json`](game.contract.json). Exit codes: `0` ok, `2` malformed inputs/scenario, `1` other errors.

### Tuning notes (values that are `null` / `false` or need explanation)

- All `tuning` values are the Ticket-02 standard numbers. `fall_enabled: true`: below Y = −10 Mây loses a flame and all carried fireflies, then respawns at the start.
- Standard numbers without a contract key (jump 7 m/s, gravity 20, detect 12 m / lose 18 m, spawn schedules…) are in `RULES` in [`src/sim/config.js`](src/sim/config.js); maps are in [`src/sim/maps.js`](src/sim/maps.js).
- My own assumptions where the ticket is silent are listed in [docs/notes/phase-2.md](docs/notes/phase-2.md) (B1–B10).

## Project layout

```
src/sim/        deterministic simulation (no DOM, no randomness except seeded rng)
src/headless/   Test Contract CLI
src/client/     Three.js rendering and input
tests/          node:test suites + tests/scenarios/ headless cases
scripts/        evidence collector, Claude Code stop-hook gate
docs/notes/     requirements, assumptions, AI log, retro
docs/proof/     evidence per phase
CLAUDE.md, .claude/   AI harness (agent guide, skill, hook)
```

## Sáng tạo của tôi

_(Added once the core is done. Extras are disabled in headless mode so they never change contract output.)_

## AI harness

- [`CLAUDE.md`](CLAUDE.md): agent guide (commands, layout, rules).
- [`.claude/skills/verify-phase`](.claude/skills/verify-phase/SKILL.md): how to run verification and save evidence.
- [`.claude/settings.json`](.claude/settings.json): Stop hook running [`scripts/stop-gate.mjs`](scripts/stop-gate.mjs), which blocks the agent from finishing while `npm test` is red.
- CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs tests, build and a headless smoke run on every push.

License: [MIT](LICENSE) · Credits: [CREDITS.md](CREDITS.md)
