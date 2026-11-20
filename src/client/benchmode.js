// In-browser half of the Ticket-04 benchmark (opened as /?bench&seed=42&duration=30).
// No input, no HUD, no creative extras. The camera orbits (0,0,0) at radius 30, Y 15.
// The first 3 s are warm-up; then every frame's dt is recorded for `duration` s.
// The result goes on window.__benchResult for scripts/bench.mjs to collect.
import { step } from '../sim/world.js';
import { DT } from '../sim/config.js';
import { createBenchWorld, benchCamera, frameStats, BENCH } from '../sim/bench.js';
import { NightScene } from './scene.js';
import { REVISION } from 'three';

export function runBench(renderer, params) {
  const seed = Number(params.get('seed') ?? 42);
  const duration = Number(params.get('duration') ?? 30);
  const world = createBenchWorld(seed);
  const scene = new NightScene(renderer, world.map);
  scene.cameraOverride = benchCamera;
  renderer.setSize(innerWidth, innerHeight);
  scene.resize(innerWidth, innerHeight);
  const noInput = { move: [0, 0], camYawDeg: 0, pressed: {} };
  scene.warm(world);

  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const dts = [];
  let start = null;
  let last = null;
  let acc = 0;

  function frame(now) {
    if (start === null) {
      start = now;
      last = now;
      window.__benchFirstFrameEpoch = Date.now();
    }
    const dt = now - last;
    last = now;
    acc += Math.min(0.25, dt / 1000);
    while (acc >= DT) {
      step(world, noInput);
      acc -= DT;
    }
    const t = (now - start) / 1000;
    scene.render(world, 0, t);
    if (t > BENCH.warmupS && dt > 0) dts.push(dt);
    window.__benchDts = dts; // kept for --debug in scripts/bench.mjs
    if (t >= BENCH.warmupS + duration) {
      const s = frameStats(dts);
      window.__benchResult = { ...s, renderer: `three.js r${REVISION} WebGL2 · ${gpu} · ${navigator.userAgent}`, size: [innerWidth, innerHeight], shades: world.shades.length, motes: world.motes.length };
      document.title = 'bench done';
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
