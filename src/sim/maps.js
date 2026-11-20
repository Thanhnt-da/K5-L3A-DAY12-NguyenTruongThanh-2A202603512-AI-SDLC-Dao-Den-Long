// Standard maps (Ticket-02 Part 2) and terrain queries.
// Angles are measured from +X towards +Z: (r cos a, r sin a). The ticket's
// Night 3 data needs this direction: level 1 is "the half with z > 0" and its
// firefly points sit at 20°..160°, so sin must be positive there.
import { TUNING } from './config.js';

const rad = (d) => (d * Math.PI) / 180;
export const polar = (r, aDeg, y = 0, cx = 0, cz = 0) => [cx + r * Math.cos(rad(aDeg)), y, cz + r * Math.sin(rad(aDeg))];
const ring = (n, r, start, step, y = 0, cx = 0, cz = 0) => Array.from({ length: n }, (_, i) => polar(r, start + i * step, y, cx, cz));
const norm2 = (x, z) => {
  const d = Math.hypot(x, z);
  return [x / d, z / d];
};

// Surfaces: each returns its height at (x, z) or null when (x, z) is outside it.
const disc = (cx, cz, r, y = 0) => (x, z) => (Math.hypot(x - cx, z - cz) <= r ? y : null);
const rect = (x0, x1, z0, z1, y = 0) => (x, z) => (x >= x0 && x <= x1 && z >= z0 && z <= z1 ? y : null);
const halfRing = (rIn, rOut, y) => (x, z) => {
  const r = Math.hypot(x, z);
  return r >= rIn && r <= rOut && z > 0 ? y : null;
};
/** Straight ramp along a radius: foot at rFoot (y0), top at rTop (y1), given width. */
const ramp = (aDeg, rFoot, rTop, width, y0, y1) => {
  const [ux, uz] = [Math.cos(rad(aDeg)), Math.sin(rad(aDeg))];
  return (x, z) => {
    const along = x * ux + z * uz;
    const side = -x * uz + z * ux;
    if (Math.abs(side) > width / 2 || along < rTop || along > rFoot) return null;
    return y0 + ((rFoot - along) / (rFoot - rTop)) * (y1 - y0);
  };
};

const NIGHT1 = {
  night: 1,
  name: 'Đảo Bến',
  duration: TUNING.night1_duration_s,
  start: [0, 0, 0],
  surfaces: [disc(0, 0, 40)],
  lanterns: [
    [0, 0, 25],
    [23.8, 0, 7.7],
    [14.7, 0, -20.2],
    [-14.7, 0, -20.2],
    [-23.8, 0, 7.7],
  ],
  motePoints: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
  shadePoints: ring(12, 37, 15, 30),
  shadeEveryTicks: 480,
  shadeMax: 6,
  shadeSpeed: TUNING.shade_speed,
  pads: [],
  charms: [],
  drifters: false,
  wind: false,
  wanderAreas: [{ cx: 0, cz: 0, r: 36 }],
};

const NIGHT2 = {
  night: 2,
  name: 'Đảo Cau',
  duration: TUNING.night2_duration_s,
  start: [0, 0, 0],
  surfaces: [disc(0, 0, 28), disc(70, 0, 28), rect(26, 44, -2, 2)],
  lanterns: [
    [0, 0, 25],
    [17, 0, -10],
    [-17, 0, -10],
    [70, 0, 25],
    [87, 0, -10],
    [53, 0, -10],
  ],
  motePoints: [0, 70].flatMap((cx) => [...ring(4, 10, 0, 90, 0, cx), ...ring(8, 22, 0, 45, 0, cx)]),
  shadePoints: [0, 70].flatMap((cx) => ring(8, 26, 22.5, 45, 0, cx)),
  shadeEveryTicks: 420,
  shadeMax: 8,
  shadeSpeed: TUNING.shade_speed,
  pads: [
    { pos: [20, 0, 18], r: 1, vy: 14, h: 24, dir: norm2(70 - 20, 0 - 18) },
    { pos: [50, 0, -18], r: 1, vy: 14, h: 24, dir: norm2(0 - 50, 0 + 18) },
  ],
  charms: [[35, 0, 0]],
  drifters: true,
  wind: false,
  wanderAreas: [{ cx: 0, cz: 0, r: 25 }, { cx: 70, cz: 0, r: 25 }],
};

const NIGHT3 = {
  night: 3,
  name: 'Đảo Chuông',
  duration: TUNING.night3_duration_s,
  start: [0, 0, -30], // assumption B11: (0,0,0) is inside the bell tower
  surfaces: [
    disc(0, 0, 45, 0),
    halfRing(12, 24, 3),
    disc(0, 0, 8, 6),
    ramp(30, 30, 24, 3, 0, 3),
    ramp(150, 30, 24, 3, 0, 3),
    disc(0, 0, 2, 14), // bell tower (8 m on level 2): a cliff nobody can climb
  ],
  lanterns: [
    [0, 6, 6],
    [18, 3, 10],
    [-18, 3, 10],
    [35, 0, -10],
    [-35, 0, -10],
    [20, 0, -35],
    [-20, 0, -35],
  ],
  motePoints: [...ring(18, 34, 0, 20, 0), ...ring(8, 18, 20, 20, 3), ...ring(4, 5, 45, 90, 6)],
  shadePoints: ring(16, 43, 0, 22.5),
  shadeEveryTicks: 360,
  shadeMax: 10,
  shadeSpeed: 4.5,
  pads: [{ pos: [0, 3, 13], r: 1, vy: 12, h: 8, dir: [0, -1] }],
  charms: [
    [30, 0, 25],
    [-30, 0, 25],
  ],
  drifters: true,
  wind: true,
  wanderAreas: [{ cx: 0, cz: 0, r: 42 }],
};

export const MAPS = { 1: NIGHT1, 2: NIGHT2, 3: NIGHT3 };
export const SHADE_FIRST_TICK = 300;
export const SHADE_FIRST_COUNT = 2;

/** All surface heights under (x, z). */
export function surfacesAt(map, x, z) {
  const hs = [];
  for (const s of map.surfaces) {
    const h = s(x, z);
    if (h !== null) hs.push(h);
  }
  return hs;
}

/** Highest surface under (x, z), or null over the cloud sea. Used for things that float (shades, drifters). */
export function topAt(map, x, z) {
  const hs = surfacesAt(map, x, z);
  return hs.length ? Math.max(...hs) : null;
}

/** Ground for feet at height y: highest surface not above y + step, or null. */
export function supportAt(map, x, z, y, step) {
  let best = null;
  for (const h of surfacesAt(map, x, z)) if (h <= y + step && (best === null || h > best)) best = h;
  return best;
}

/** True when a surface at (x, z) rises above y + step (a cliff or the bell tower). */
export function blockedAt(map, x, z, y, step) {
  return surfacesAt(map, x, z).some((h) => h > y + step);
}
