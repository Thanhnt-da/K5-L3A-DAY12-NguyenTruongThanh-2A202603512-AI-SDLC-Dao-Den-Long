// Headless run loop shared by the CLI and the tests. Returns JSONL text.
import { createWorld, step } from './world.js';
import { InputTrack, parseInputs } from './inputs.js';
import { snapshotLine, endLine } from './snapshot.js';

export function runHeadless({ seed, night = 1, scenario = null, inputs = null, ticks, snapshotEvery = 10 }) {
  const world = createWorld({ seed, night, scenario });
  const track = new InputTrack(inputs ? parseInputs(inputs) : []);
  const lines = [JSON.stringify(snapshotLine(world))]; // tick 0: after setup, before inputs
  for (let k = 0; k < ticks && world.state === 'playing'; k++) {
    for (const ev of step(world, track.at(k))) lines.push(JSON.stringify(ev));
    if (world.tick % snapshotEvery === 0) lines.push(JSON.stringify(snapshotLine(world)));
  }
  lines.push(JSON.stringify(endLine(world)));
  return lines.join('\n') + '\n';
}
