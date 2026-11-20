# Ticket-04 "Bình minh: phát hành v1.0.0" (Phase 4): working copy

Summary of the lab board's Phase 4 tab, read 2026-11-20. Type: **non-functional + release**. Priority high. Submit tag `phase-4` + GitHub Release `v1.0.0`. **Contract v1.3**.

**Goal:** turn the game into a **releasable product**: measurable performance, stable over long runs, a leaderboard, easy to install. Every requirement has a **concrete number** and is graded automatically or by checklist.

**Creative extras:** still allowed if they don't change rules, numbers, the Test Contract or headless output. In the **benchmark and soak scenes**, extra characters and effects must be **switched off** (or not affect the measurement), so everyone is measured on the same scene.

## 1. Benchmark mode (mandatory)

Command: `<bench_cmd> --seed 42 --duration 30 --out bench.json`

Benchmark scene (the same for everyone):
1. Open a 1280×720 window, not full screen; turn vsync off if the engine allows (if not, say so in the README).
2. Load Night 1 with all effects and lighting as in real play.
3. Spawn **exactly 200 Bóng Mực** in state `wander`, spread evenly over the island (seed 42), and **exactly 100 fireflies** (the bench may exceed the gameplay caps). Lanterns L1–L3 lit with `fuel` 100.
4. In the bench scene these are **off**: spawning more entities, damage, pickup, fuel burn, and the Night's end conditions. Bóng Mực still move by the normal `wander` rules.
5. No player input. Mây stands still at (0,0,0). The camera circles (0,0,0) at radius 30 m, height Y = 15 m, always looking at (0,0,0), starting at angle 0° (point (30,15,0)), counter-clockwise seen from above, one lap per 15 s.
6. The first 3 s are warm-up (not measured). Then measure exactly `--duration` seconds and exit with code 0.

Output `bench.json`:

```json
{
  "contract_version": "1.3",
  "avg_fps": 87.3,
  "p1_low_fps": 52.1,
  "frame_ms_p95": 14.2,
  "frames": 2619,
  "load_ms": 2400,
  "peak_mem_mb": 512,
  "vsync_off": true,
  "renderer": "describe engine/renderer and version",
  "os": "as reported"
}
```

| Field | Definition |
|---|---|
| `frames` | Number of frames N in the measured window |
| `avg_fps` | `1000 × N / Σ dt_i`, where `dt_i` is each frame's time (ms) |
| `p1_low_fps` | `k = max(1, ceil(0.01 × N))`: take the k largest `dt`; `p1_low_fps = 1000 / mean of those k` |
| `frame_ms_p95` | 95th percentile of `dt` (ms) |
| `load_ms` | From process start to the first frame of the bench scene |
| `peak_mem_mb` | Peak process memory (RSS) during the measurement; `null` for a web build that can't measure it, with an explanation |

**Pass thresholds, measured on the instructor's grading machine:** `avg_fps ≥ 60`, `p1_low_fps ≥ 30`, `load_ms ≤ 10000`. The instructor will publish that machine's config (CPU, GPU, RAM, OS, power mode) before measuring. Every submission runs on the same machine; your own numbers are for reference only.

## 2. Soak test (mandatory)

Command: `<soak_cmd> --seed 7 --nights 10 --out soak.json`

- Headless, 10 Nights in a row **in the same process** (Night 1 → 2 → 3, cycling). Night i uses seed `7 + i`. Each Night runs until it ends or its standard time runs out.
- Random input from that seed: every 30 ticks pick a new movement direction; every tick 5% jump, 3% dash, 2% pulse, 10% interact.
- `mem_start_mb`: process memory (RSS) after loading the first Night. `mem_end_mb`: RSS after resetting the last Night.
- Output: `{"nights": 10, "crashes": 0, "results": ["lost","won","lost"], "mem_start_mb": 120, "mem_end_mb": 131, "duration_s": 84.2}`
- Pass: `crashes = 0` and `mem_end_mb ≤ 1.2 × mem_start_mb`.

## 3. Local leaderboard

- After the Bình Minh screen (Night 3 won) **or** after losing any Night, ask for a name.
- Name: 3–12 characters `[A-Za-z0-9_-]`. Vietnamese with diacritics is a bonus, not required.
- Each entry: `name`, `score` (sum of the Nights won), `nights_won` (0–3), `achieved_at` (ISO 8601 with timezone), `seed`.
- Keep the **top 10**, sorted by `score` descending; on a tie, whoever got there first ranks higher.
- Stored on the local machine; must survive quitting and reopening the game.
- A Leaderboard screen reachable from the main menu.
- Export command: `<run_cmd> --export-leaderboard out.json` writes `{"entries": [...]}` in rank order.

## 4. Accessibility

| Requirement | Detail |
|---|---|
| Key remapping | Every action: move (4 directions), jump, dash, interact, pulse, pause. Warn on a duplicate key. A "Khôi phục mặc định" (restore defaults) button. Saved |
| Visual cues for sounds | Bóng Mực appearing (arrow at the screen edge towards it), strong wind (warning 2 s before), last 10 s, a lantern with `fuel < 30` |
| Reduced motion | Turns off camera shake and screen flash effects |
| UI text size | At least 18 px at 1280×720; optional larger UI (×1.25) |

## 5. Packaging and documentation

- Clean clone → follow the README in **at most 3 commands** → playable. The instructor will try this on a clean machine.
- `README.md`: short description, a screenshot or GIF, system requirements, install, controls, how to run tests, headless, bench, soak.
- `CHANGELOG.md` has sections for all 4 phases. `CREDITS.md` lists every asset, sound and AI tool used to make content. `LICENSE` present.
- GitHub Release `v1.0.0` has a runnable build: an executable, a static web folder, or a Docker image with instructions.

## 6. Test Contract v1.3

- `contract_version: "1.3"`.
- `game.contract.json` adds `bench_cmd` and `soak_cmd`.
- Everything from v1.0–v1.2 stays.

## 7. Retro and demo

- Retro (1–2 pages, any name and place): sums up the 4 phases' evaluations; what worked or didn't with AI; times the AI was wrong and how I noticed; which harness parts (AGENTS.md, skill, hook) helped most; estimated total tokens/cost and how I saved; what I'd change if I did it again.
- Demo video `.mp4` **under 5 minutes** (attached to Release `v1.0.0` or at `docs/demo/demo.mp4`): play a stretch, and show evidence the game works (tests, headless, bench).

## Definition of Done

- Evidence that the game meets this phase's requirements.
- Tag `phase-4` and Release `v1.0.0`.
- `bench.json` and `soak.json` that I ran myself, committed to the repo.
- Every hidden Phase 1–3 test still passes.
- Public repo, with the full AI harness and docs as the submission rules require.
