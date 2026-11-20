# Đảo Đèn Lồng: agent guide

3D lantern-keeper game for the Day 12 AI SDLC lab. Requirements live on the lab board (PRD-0, then Ticket-02..04); copies and our assumptions are in `docs/notes/`. The **Test Contract** is graded by hidden automated tests: follow it exactly.

## Commands
- Install + build: `npm ci && npm run build`
- Tests (unit + contract + determinism): `npm test`
- Headless: `node src/headless/cli.js --seed 1 --night 1 [--scenario f.json] [--inputs f.json] --ticks 600 --out out.jsonl [--snapshot-every 10]`
- Play: `npm run dev` (dev server) or `npm start` (serves the built `dist/`)
- Evidence for phase N: `node scripts/evidence.mjs N` (see skill `verify-phase`)

## Current scope (Phase 3, Contract v1.2)
- Specs: `docs/notes/phase-2-ticket.md` + `docs/notes/phase-3-ticket.md` (Ticket-03 replaces some Ticket-02 rules: check it first). Criteria + assumptions: `docs/notes/phase-3.md`; design: `docs/adr/`.
- Lantern fuel is integer 1/60 units (`FUEL_MAX = 6000`); never use float fuel in the sim.
- All numbers are the Ticket-02 **standard numbers**: never invent or "tune" them. Contract keys live in `game.contract.json`; the rest in `RULES` (`src/sim/config.js`); maps in `src/sim/maps.js`.
- `step()` in `src/sim/world.js` follows the ticket's mandatory 12-step tick order; keep new logic in the right numbered step.
- Shade states must be exactly `spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`.
- When a ticket replaces a rule: update or remove the old test with a `// Phase N:` comment and list it in that phase's notes.

## Layout
- `src/sim/`: pure deterministic simulation. Shared by browser and headless.
- `src/headless/cli.js`: Test Contract CLI (exit 2 = malformed inputs/scenario).
- `src/client/`: `main.js` (screens, input, loop), `scene.js` (Three.js, draws `map.shapes`), `hud.js`, `audio.js` (synthesised, no files), `settings.js`. No game rules here.
- Browser checks: `npm run build && npm start`, open `/?fps&night=N`; `window.__game.world` / `.scene` expose live state for inspection.
- `game.contract.json`: contract declaration. `tuning` is imported by `src/sim/config.js`; it is the only place gameplay numbers live.
- `tests/`: `node:test` files; `tests/scenarios/<case>/`: headless scenario files.

## Rules
- `src/sim/` must not use `Math.random`, `Date`, `performance`, DOM or Three.js. Randomness only via the seeded rng in `world.rng`.
- Changing a gameplay number = edit `game.contract.json` tuning, never a hard-coded constant.
- Positions in output are rounded to 3 decimals; events carry `tick = k+1` for step k.
- Creative extras must not change headless output (disable them in headless).
- Do not invent requirements. If the ticket does not say, write the assumption in `docs/notes/` and test that assumption.
- Never write tests that always pass or edit outputs by hand. Unmet requirement → write "chưa đạt" + reason.
- When a new ticket replaces a rule: update or remove the old test with a one-line reason in the phase notes; never skip silently.
- Do not delete harness files (`CLAUDE.md`, `.claude/`, `scripts/`). Do not commit `.env` or keys.
- Small commits, one change each. A Stop hook runs `npm test` and `vite build` and blocks finishing while either is red.
- A test that checks a "full run" must assert the run really went to the end (check the `end` line), not just that it was fast.
- After touching `src/client/`, also check the game in a browser: tests only cover `src/sim/`.
