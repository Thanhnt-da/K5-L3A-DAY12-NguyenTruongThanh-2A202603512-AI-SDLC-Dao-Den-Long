// Standard maps (Ticket-02 Part 2). Angles: from +X, counter-clockwise seen
// from above. With Y up, that rotation takes +X towards -Z, the same rotation
// the contract uses for cam_yaw_deg.
import { TUNING } from './config.js';

const deg = (d) => (d * Math.PI) / 180;
export const polar = (r, aDeg, y = 0, cx = 0, cz = 0) => [cx + r * Math.cos(deg(aDeg)), y, cz - r * Math.sin(deg(aDeg))];
const ring = (n, r, start, step, y = 0, cx = 0, cz = 0) => Array.from({ length: n }, (_, i) => polar(r, start + i * step, y, cx, cz));

const NIGHT1 = {
  night: 1,
  name: 'Đảo Bến',
  duration: TUNING.night1_duration_s,
  start: [0, 0, 0],
  islands: [{ cx: 0, cz: 0, r: 40 }],
  lanterns: [
    [0, 0, 25],
    [23.8, 0, 7.7],
    [14.7, 0, -20.2],
    [-14.7, 0, -20.2],
    [-23.8, 0, 7.7],
  ],
  motePoints: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
  shadePoints: ring(12, 37, 15, 30),
  shadeFirstTick: 300,
  shadeFirstCount: 2,
  shadeEveryTicks: 480,
  shadeMax: 6,
  shadeSpeed: TUNING.shade_speed,
};

export const MAPS = { 1: NIGHT1 };

/** Ground height under (x, z), or null over the cloud sea. */
export function groundAt(map, x, z) {
  for (const is of map.islands) if (Math.hypot(x - is.cx, z - is.cz) <= is.r) return 0;
  return null;
}
