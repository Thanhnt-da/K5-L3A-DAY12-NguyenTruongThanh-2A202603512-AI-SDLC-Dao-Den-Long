---
name: verify-phase
description: Run the full verification for a lab phase and save evidence to docs/proof/phase-N (tests, headless scenarios run twice for determinism, machine info). Use before tagging a phase, or when asked to "verify", "collect evidence" or "prove it works".
---

# Verify a phase and save evidence

1. Make sure the work is committed (evidence records the commit; uncommitted changes are flagged).
2. Run `node scripts/evidence.mjs <N>` (N = current phase 1-4). It writes:
   - `docs/proof/phase-N/test-report.txt`: full `npm test` output
   - `docs/proof/phase-N/scenarios/<case>/out.jsonl` + `command.txt`: headless output for every `tests/scenarios/<case>/`
   - `docs/proof/phase-N/summary.md`: pass/fail table, sha256 of two runs per case, machine info
3. If it prints FAIL: fix the cause. Never edit outputs or expectations by hand to make them pass.
4. Read every `end` line in summary.md against the case's `description`. A scenario that runs but ends in the wrong state is a FAIL; say so.
5. Update the requirement table in `docs/proof/phase-N/README.md` (requirement → how verified → evidence file → result). Unmet requirements are written as **chưa đạt** with the reason.
6. Report to the user what passed, what did not, and the evidence paths. Do not claim anything the evidence does not show.

Adding a scenario: create `tests/scenarios/<name>/case.json` (`description`, `seed`, `ticks`, `snapshot_every`) plus optional `scenario.json` and `inputs.json` in Test Contract format. If the check can be asserted automatically, also add an assertion in `tests/`.
