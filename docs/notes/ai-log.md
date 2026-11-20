# AI usage log

Tool: Claude Code (desktop app), model Claude Opus 5.5. Token figures are estimates from the session usage view.

| When | Phase | Task given to AI | Result / what I checked | AI mistakes caught | Tokens / cost (est.) |
|---|---|---|---|---|---|
| 2026-11-20 | Setup | Read lab repo + lab board, summarise | Summary matched the docs | — | _fill in_ |
| 2026-11-20 | Setup | Set up stack, sim skeleton, headless CLI, tests, CI, harness | 11/11 tests pass, build ok, headless smoke run | Test used a URL path with `%20` for the space in the folder name; failed, fixed with `fileURLToPath` | _fill in_ |
| 2026-11-20 | 1→2 | Read Ticket-02 from the lab board (needed sign-in in the browser pane; text read from screenshots), saved working copy | Checked numbers against the screenshots | First read of the board missed Phase 2 because the tab loads only when signed in | _fill in_ |
| 2026-11-20 | 1 | Phase 1 evaluation, evidence, tag `phase-1` | Evidence PASS (11 tests, 2 scenarios) | Evidence summary flagged its own new files as "uncommitted changes"; script fixed in Phase 2 | _fill in_ |
| 2026-11-20 | 2 | Rewrite sim for standard numbers + 12-step tick order, 18 rule tests, client controls | 29/29 tests, build ok, pause checked in browser | (1) client import broke the build while tests were green → Stop hook now builds; (2) "full night" perf test ended early at tick ~1700 → test now asserts it reaches dawn; (3) key taps lost between frames → latched taps | _fill in_ |
| 2026-11-20 | 2 | Nights 2-3, Gió Lạc, Bùa Gió, wind (sim) + 15 tests; new client (screens, HUD, sound, settings) | 44/44 tests, build ok, browser check of menu/intro/HUD/pause, FPS 59.7 at 1280×720 | 3 wrong tests (charm on bridge, cliff boundary, wind in perf run): game was right, tests fixed with reasons; angle direction for map points was flipped; first client ran at only 33 FPS → pixel ratio 1 + Lambert | _fill in_ |
| 2026-11-20 | 3 | Read Ticket-03; fuel model, drain, dawn win, scoring, capacity; updated 9 replaced-rule tests with reasons; 12 new tests; client fuel bars + colour-blind; ADR | 56/56 tests, build ok, browser check | 2 wrong test expectations (impossible "full lantern" case, 70 vs 69.9); stale screenshot; inline shell script quoting | 5-h limit 41% → 50% (+9 pts); context 389k → 458k |
| 2026-11-20 | 4 | Read Ticket-04; soak, benchmark (Playwright), leaderboard server, accessibility, README/retro/release | 62/62 tests, bench 82.1/32.6 FPS, soak 0 crashes +4% | benchmark 1%-low 3.6 (shader compile stalls, found via slow-frame dump); soak +45% RSS (V8 warm-up, not a leak); Enter ignored in the name box; negative seed | 5-h limit 54% → 68% (+14 pts); context 489k → 570k |

## Token usage readings (Claude Pro plan: % of limits, no per-token price)

Read with the desktop app's usage tool (`get_usage`). Pro is a flat subscription, so cost is tracked as % of the plan's limits.

| When | 5-hour limit | Weekly (all models) | Conversation context |
|---|---|---|---|
| Before reading Ticket-03 (after setup + Phases 1–2) | 41% | 71% | 389k tokens |
| End of Phase 3 build (before evidence/tag) | 50% | 72% | 458k tokens |
| After tagging phase-3 | 51% | 72% | 476k tokens |
| Start of Phase 4 (after reading Ticket-04) | 54% | 72% | 489k tokens |
| Phase 4 build done (before docs/tag) | 68% | 74% | 570k tokens |
| Creative additions + tag phase-4 (the 5-hour window had reset at 10:10 UTC) | 8% of the new window | 76% | 633k tokens |

Setup + Phases 1–2 were not measured while they ran; together they used about 41% of one 5-hour window, plus some of the weekly share (the part already used before this lab can't be separated).

## Token-saving habits
- Short `CLAUDE.md`, requirements summarised once in `docs/notes/` instead of re-pasting the lab board.
- Verify with `npm test` / `scripts/evidence.mjs` instead of asking the agent to re-read code.
