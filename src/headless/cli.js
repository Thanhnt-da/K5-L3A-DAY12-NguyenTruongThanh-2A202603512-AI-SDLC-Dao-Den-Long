#!/usr/bin/env node
// Test Contract v1.0 headless entry point.
// <headless_cmd> --seed <int> --night 1 [--scenario f.json] [--inputs f.json]
//                --ticks <int> --out f.jsonl [--snapshot-every <int, default 10>]
// Exit 0 on success; 2 for malformed inputs/scenario; 1 for any other error.
import { readFileSync, writeFileSync } from 'node:fs';
import { runHeadless } from '../sim/run.js';
import { FormatError } from '../sim/errors.js';

const USAGE = 'usage: --seed <int> --night 1 [--scenario f.json] [--inputs f.json] --ticks <int> --out f.jsonl [--snapshot-every <int>]';

function fail(code, msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const known = new Set(['--seed', '--night', '--scenario', '--inputs', '--ticks', '--out', '--snapshot-every']);
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!known.has(k)) fail(1, `unknown argument "${k}"\n${USAGE}`);
    if (i + 1 >= argv.length) fail(1, `missing value for ${k}`);
    a[k] = argv[i + 1];
  }
  const int = (k, min) => {
    const v = a[k];
    if (!/^-?\d+$/.test(v ?? '') || Number(v) < min) fail(1, `${k} must be an integer >= ${min}\n${USAGE}`);
    return Number(v);
  };
  for (const k of ['--seed', '--night', '--ticks', '--out']) if (a[k] === undefined) fail(1, `missing ${k}\n${USAGE}`);
  return {
    seed: int('--seed', -(2 ** 53)),
    night: int('--night', 1),
    ticks: int('--ticks', 0),
    snapshotEvery: a['--snapshot-every'] === undefined ? 10 : int('--snapshot-every', 1),
    scenarioPath: a['--scenario'],
    inputsPath: a['--inputs'],
    out: a['--out'],
  };
}

function readJson(path, what) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    fail(2, `cannot read ${what} file "${path}": ${e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    fail(2, `${what} file "${path}" is not valid JSON: ${e.message}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const scenario = args.scenarioPath ? readJson(args.scenarioPath, 'scenario') : null;
const inputs = args.inputsPath ? readJson(args.inputsPath, 'inputs') : null;

let out;
try {
  out = runHeadless({ seed: args.seed, night: args.night, scenario, inputs, ticks: args.ticks, snapshotEvery: args.snapshotEvery });
} catch (e) {
  if (e instanceof FormatError) fail(2, e.message);
  fail(1, e.message);
}
try {
  writeFileSync(args.out, out);
} catch (e) {
  fail(1, `cannot write "${args.out}": ${e.message}`);
}
