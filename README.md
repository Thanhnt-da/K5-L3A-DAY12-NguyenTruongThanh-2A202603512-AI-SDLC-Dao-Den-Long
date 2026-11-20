# Đảo Đèn Lồng

> **Demo video:** _(link added in Phase 4)_ · Day 12 AI SDLC lab · Nguyễn Trường Thành · 2A202603512

Mây, a young lantern keeper, collects fireflies to relight the Big Lanterns of a cloud-sea island while dodging the Bóng Mực in the black fog. 3D third-person, runs in the browser (Three.js); game logic is a pure deterministic simulation that also runs headless (Node) for the Test Contract.

> Status: **Phase 1 in progress.** Project skeleton, headless runner and contract I/O are done; gameplay rules are being built. See [docs/proof/](docs/proof/) for what is verified.

## Install and run (macOS / Linux, Node.js 20+)

```bash
npm ci
npm run build
npm start          # then open http://localhost:4173
```

`npm run dev` starts a hot-reload dev server instead. The built `dist/` folder is a static site and can be served by any web server.

## Controls

| Key | Action |
|---|---|
| W A S D / arrow keys | Move (relative to camera) |
| Mouse drag, Q / E | Rotate camera |
| Space | Jump |
| F | Interact (deposit fireflies into a lantern) |
| R | Light pulse |
| Enter | Replay after win / loss |

## Scoring

_(Filled in with the Phase 1 rules; the values are declared in `game.contract.json` → `tuning.score`.)_

## Tests and headless mode

```bash
npm test                                   # unit + contract + determinism tests
node scripts/evidence.mjs 1                # save Phase 1 evidence to docs/proof/phase-1/
node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario tests/scenarios/walk-forward/scenario.json] \
  [--inputs tests/scenarios/walk-forward/inputs.json] [--snapshot-every 10]
```

Test Contract v1.0 declaration: [`game.contract.json`](game.contract.json). Exit codes: `0` ok, `2` malformed inputs/scenario, `1` other errors.

### Tuning notes (values that are `null` / `false` or need explanation)

- `fall_enabled: false`: the island edge is a wall; Mây cannot fall off.
- World layout outside the contract: island radius 30 m, lanterns L1–L5 evenly on a 22 m ring (L1 at +Z), 30 random fireflies. See `src/sim/config.js`.

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
