# Retro: Đảo Đèn Lồng (Day 12 AI SDLC, 4 phases)

## Numbers

| | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| Requirement doc | PRD-0 + Contract v1.0 | Ticket-02, v1.1 | Ticket-03 change request, v1.2 | Ticket-04 release, v1.3 |
| Tests at the tag | 11 | 44 | 56 | 62 |
| Headless scenarios | 2 | 8 | 9 | 9 |
| Criteria met | C1–C8 of 17 (gameplay rules **not** met in time) | R1–R21 (menus, HUD and sound checked by hand) | F1–F13; F14 partial | R1–R9, R11; Release + video by me |
| Old tests changed | — | 2 (version check, line-order lookup) | 9 updated/removed with reasons | 1 (version check) |

Token use (Claude Pro, so no per-token price; % of plan limits, read with the app's usage tool):
- Setup + Phases 1–2: about 41% of one 5-hour window. Not measured while it ran.
- Phase 3: about +10 points.
- Phase 4 build: about +14 points.
- Weekly limit went from 71% → about 75% during Phases 3–4.
- Conversation context grew to about 570k tokens. Every message re-sends it, so it was the biggest cost driver.

## What worked with AI

- **Reading the Test Contract first and building one pure simulation** used by both the browser and the headless CLI. Each new ticket then meant one change in one place, and the hidden-test format never broke.
- **Writing the acceptance criteria and the test from the ticket before checking the output.** When a test failed, reading the failure first showed whether the game or the test was wrong. Six times the test was wrong (charm on the bridge, cliff boundary, wind in a perf run, impossible "full lantern" case, 70 vs 69.9 fuel, line order). The game matched the ticket each time, and every fix got a comment saying why.
- **Measuring instead of guessing on performance:** the slow-frame dump found shader-compile stalls (1%-low 3.6 → 39.6 FPS). The 3/10/30-Night soak runs showed memory warm-up, not a leak.
- **Committing and tagging early:** every phase tag landed with evidence, even Phase 1 where the rules were not finished.

## What did not work / where the AI was wrong, and how I caught it

| Mistake | How I noticed | What changed |
|---|---|---|
| Phase 1 ran out of time: installing Node.js + the contract skeleton took the hour | Phase 2 was released before the rules existed | Tagged honestly with "chưa đạt"; built the rules once on the standard numbers |
| A client import broke the build while all tests were green | Ran the build | **Stop hook now also builds** (harness fix) |
| A "full Night" perf test ended early (shades killed the idle player) | Read the `end` line | CLAUDE.md rule: perf tests must assert they reached the end |
| Map angle direction was mirrored | Night 3 level-1 data only made sense one way | Fixed and recorded (B14) |
| Quick key taps lost; Enter ignored in the name box | Browser checks | Latched taps; Enter handler on the field |
| The first lab-board read missed Phases 2–4 | The tab needs sign-in | Read through the signed-in browser pane |
| Long inline shell scripts broke on quoting | Shell errors | Patch scripts in files instead |

## Harness: what helped most

1. **The Stop hook** (`npm test` + build must pass before the agent may finish). It caught the broken client build and made every commit green.
2. **`scripts/evidence.mjs` + the `verify-phase` skill:** one command per phase for tests, scenarios run twice (determinism) and machine info. Also re-runnable by the grader at each tag.
3. **CLAUDE.md**, kept short and updated each phase with the current scope and the lessons above.
4. Working copies of each ticket in `docs/notes/`, so the board never had to be re-read.

## Saving tokens

- Ticket text summarised once into the repo; later work referred to the file.
- Verification by commands (`npm test`, evidence, bench `--debug`) rather than asking the AI to re-read code.
- Big edits as patch scripts instead of many small tool calls; screenshots only for things that need eyes.
- What I would do better: start a **fresh session per phase** with the notes as context. One long conversation made every later step re-send ~0.5M tokens.

## If I did it again

- Install the toolchain before the lab, so Phase 1 delivers the rules on time.
- Fresh AI session per phase to keep context (and cost) small.
- Add a browser-level smoke test (Playwright is already in the project) so menus and HUD get automated checks too, not only manual ones.
- Measure performance on day one: the shader-compile stall was invisible until the benchmark.
