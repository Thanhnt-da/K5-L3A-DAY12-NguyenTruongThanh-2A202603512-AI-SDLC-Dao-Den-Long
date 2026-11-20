# AI usage log

Tool: Claude Code (desktop app), model Claude Opus 5.5. Token figures are estimates from the session usage view.

| When | Phase | Task given to AI | Result / what I checked | AI mistakes caught | Tokens / cost (est.) |
|---|---|---|---|---|---|
| 2026-11-20 | Setup | Read lab repo + lab board, summarise | Summary matched the docs | — | _fill in_ |
| 2026-11-20 | Setup | Set up stack, sim skeleton, headless CLI, tests, CI, harness | 11/11 tests pass, build ok, headless smoke run | Test used a URL path with `%20` for the space in the folder name; failed, fixed with `fileURLToPath` | _fill in_ |

## Token-saving habits
- Short `CLAUDE.md`, requirements summarised once in `docs/notes/` instead of re-pasting the lab board.
- Verify with `npm test` / `scripts/evidence.mjs` instead of asking the agent to re-read code.
