import { FormatError } from './errors.js';

const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Validate an inputs document ({ frames: [...] }) and return the frames. */
export function parseInputs(doc) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) throw new FormatError('inputs: top level must be an object');
  if (!Array.isArray(doc.frames)) throw new FormatError('inputs: "frames" must be an array');
  let last = -1;
  doc.frames.forEach((f, i) => {
    const where = `inputs.frames[${i}]`;
    if (f === null || typeof f !== 'object' || Array.isArray(f)) throw new FormatError(`${where}: must be an object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new FormatError(`${where}.tick: must be a non-negative integer`);
    if (f.tick <= last) throw new FormatError(`${where}.tick: ticks must strictly increase`);
    last = f.tick;
    if ('move' in f && !(Array.isArray(f.move) && f.move.length === 2 && f.move.every(isNum))) throw new FormatError(`${where}.move: must be [x, z] numbers`);
    if ('cam_yaw_deg' in f && !isNum(f.cam_yaw_deg)) throw new FormatError(`${where}.cam_yaw_deg: must be a number`);
    for (const b of BUTTONS) if (b in f && typeof f[b] !== 'boolean') throw new FormatError(`${where}.${b}: must be a boolean`);
  });
  return doc.frames;
}

/**
 * Replays frames tick by tick. Fields absent from a frame keep their previous
 * value; buttons report `pressed` only on a false -> true change.
 */
export class InputTrack {
  constructor(frames = []) {
    this.frames = frames;
    this.idx = 0;
    this.cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
    this.prevButtons = { jump: false, interact: false, pulse: false, dash: false, pause: false };
  }

  /** Input for step k. Must be called with k = 0, 1, 2, ... in order. */
  at(k) {
    while (this.idx < this.frames.length && this.frames[this.idx].tick <= k) {
      const f = this.frames[this.idx++];
      if (f.move) this.cur.move = [f.move[0], f.move[1]];
      if ('cam_yaw_deg' in f) this.cur.cam_yaw_deg = f.cam_yaw_deg;
      for (const b of BUTTONS) if (b in f) this.cur[b] = f[b];
    }
    const pressed = {};
    for (const b of BUTTONS) {
      pressed[b] = this.cur[b] && !this.prevButtons[b];
      this.prevButtons[b] = this.cur[b];
    }
    return { move: this.cur.move, camYawDeg: this.cur.cam_yaw_deg, pressed };
  }
}

/** Contract move mapping: camera-relative [x, z] -> world XZ direction (length <= 1). */
export function worldMove(move, camYawDeg) {
  // Assumption: components outside [-1, 1] are clamped (contract says they lie in that range).
  let x = Math.max(-1, Math.min(1, move[0]));
  let z = Math.max(-1, Math.min(1, move[1]));
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const th = (camYawDeg * Math.PI) / 180;
  return [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];
}
