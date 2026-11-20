# AI usage log

Tool: Claude Code (desktop app), model Claude Opus 5.5. Token figures are estimates from the session usage view.

| When | Phase | Task given to AI | Result / what I checked | AI mistakes caught | Tokens / cost (est.) |
|---|---|---|---|---|---|
| 2026-11-20 | Setup | Read lab repo + lab board, summarise | Summary matched the docs | — | _fill in_ |
| 2026-11-20 | Setup | Set up stack, sim skeleton, headless CLI, tests, CI, harness | 11/11 tests pass, build ok, headless smoke run | Test used a URL path with `%20` for the space in the folder name; failed, fixed with `fileURLToPath` | _fill in_ |
| 2026-11-20 | 1→2 | Read Ticket-02 from the lab board (needed sign-in in the browser pane; text read from screenshots), saved working copy | Checked numbers against the screenshots | First read of the board missed Phase 2 because the tab loads only when signed in | _fill in_ |
| 2026-11-20 | 1 | Phase 1 evaluation, evidence, tag `phase-1` | Evidence PASS (11 tests, 2 scenarios) | Evidence summary flagged its own new files as "uncommitted changes"; script fixed in Phase 2 | _fill in_ |
| 2026-11-20 | 2 | Rewrite sim for standard numbers + 12-step tick order, 18 rule tests, client controls | 29/29 tests, build ok, pause checked in browser | (1) client import broke the build while tests were green → Stop hook now builds; (2) "full night" perf test ended early at tick ~1700 → test now asserts it reaches dawn; (3) key taps lost between frames → latched taps | _fill in_ |

## Token-saving habits
- Short `CLAUDE.md`, requirements summarised once in `docs/notes/` instead of re-pasting the lab board.
- Verify with `npm test` / `scripts/evidence.mjs` instead of asking the agent to re-read code.
