# Phase 2: FPS at 1280×720 (DoD: ≥ 30 FPS average)

Measured in the browser pane of the Claude desktop app (Chromium), page `http://localhost:4173/?fps&night=3` after `npm run build && npm start`,
viewport emulated at 1280×720, pixel ratio 1. Night 3 (heaviest map: 3 levels, tower, 7 lanterns with point lights) while playing,
`window.__fps.avg` sampled once per second for 10 s.

Machine: Windows 10 Pro, Intel Core i7-6600U @ 2.60 GHz (4 threads), integrated Intel HD 520, 7.9 GB RAM, Node v26.13.1.

| Build | Samples (FPS) | Average | Min | Result |
|---|---|---|---|---|
| First client (pixel ratio 1.5, MeshStandardMaterial) | 32.9, 33.9, 33.9, 34.3, 32.9, 30.5, 35, 33.4 | 33.4 | 30.5 | passes, but barely |
| Pixel ratio 1 + MeshLambertMaterial | 60, 60, 60, 60, 60, 57, 60, 60, 60, 60 | **59.7** | 57 | **đạt** (vsync cap 60) |

World state during the second sample: Night 3, sim tick 1563, 5 Bóng Mực, 26 fireflies.
Screenshot: [screens/night3-1280x720-60fps.jpg](screens/night3-1280x720-60fps.jpg) (FPS counter top-left).
Re-check: open `/?fps&night=3`, press Enter twice, read the counter or `window.__fps.avg` in the console.
