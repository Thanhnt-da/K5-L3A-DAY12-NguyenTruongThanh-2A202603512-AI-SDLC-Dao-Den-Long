#!/usr/bin/env node
// bench_cmd (Ticket-04 Part 1): node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Serves dist/, opens the game's benchmark scene in a real 1280x720 browser window
// with vsync off (Chromium flags), waits for 3 s warm-up + `duration` s of
// measurement, and writes bench.json. Needs `npm run build` first.
// Browser: Playwright's Chromium if installed, else installed Chrome / Edge,
// else it runs `npx playwright install chromium` once.
// Options: --headless (no window; software rendering, much slower, only for CI smoke tests).
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { platform, release, cpus, totalmem } from 'node:os';
import { chromium } from 'playwright';
import { startServer } from '../server.js';

const t0Epoch = performance.timeOrigin; // process start (ms since epoch)
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const seed = Number(opt('--seed', 42));
const duration = Number(opt('--duration', 30));
const out = opt('--out', 'bench.json');
const headless = argv.includes('--headless');
if (!Number.isInteger(seed) || !(duration > 0)) {
  process.stderr.write('usage: --seed <int> --duration <s> --out bench.json [--headless]\n');
  process.exit(1);
}

const ARGS = [
  '--disable-gpu-vsync',
  '--disable-frame-rate-limit',
  '--ignore-gpu-blocklist',
  // keep full speed even if another window covers the benchmark window
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--window-size=1280,720',
  '--window-position=40,40',
];

async function launch() {
  const tries = [{}, { channel: 'chrome' }, { channel: 'msedge' }];
  for (const t of tries) {
    try {
      return await chromium.launch({ headless, args: ARGS, ...t });
    } catch {
      /* try the next browser */
    }
  }
  process.stderr.write('no browser found: installing Playwright Chromium (one time)…\n');
  execSync('npx playwright install chromium', { stdio: 'inherit' });
  return chromium.launch({ headless, args: ARGS });
}

let server;
let browser;
try {
  server = await startServer({ port: 0 });
  const port = server.address().port;
  browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${port}/?bench&seed=${seed}&duration=${duration}`);
  await page.waitForFunction(() => window.__benchResult, null, { timeout: (duration + 120) * 1000, polling: 500 });
  const r = await page.evaluate(() => ({ ...window.__benchResult, firstFrame: window.__benchFirstFrameEpoch }));
  if (argv.includes('--debug')) {
    const d = await page.evaluate(() => window.__benchDts);
    const worst = d.map((v, i) => [Math.round(v), i]).sort((a, b) => b[0] - a[0]).slice(0, 15);
    const median = [...d].sort((a, b) => a - b)[d.length >> 1];
    process.stderr.write(`worst frames [ms, frame#]: ${JSON.stringify(worst)}\nmedian: ${median.toFixed(1)} ms\n`);
  }
  const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
  const result = {
    contract_version: '1.3',
    avg_fps: round(r.avg_fps),
    p1_low_fps: round(r.p1_low_fps),
    frame_ms_p95: round(r.frame_ms_p95, 2),
    frames: r.frames,
    load_ms: Math.round(r.firstFrame - t0Epoch),
    peak_mem_mb: null, // web build: the browser's process memory is not readable from the page (see README)
    vsync_off: true, // launched with --disable-gpu-vsync --disable-frame-rate-limit
    renderer: `${r.renderer} · ${browser.version()}${headless ? ' · headless' : ''}`,
    os: `${platform()} ${release()} · ${cpus()[0]?.model ?? '?'} x${cpus().length} · ${Math.round(totalmem() / 2 ** 30)} GB`,
    seed,
    duration_s: duration,
    viewport: r.size,
    scene: { shades: r.shades, motes: r.motes },
  };
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result) + '\n');
} catch (e) {
  process.stderr.write(`error: ${e.message}\n`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.close();
}
