#!/usr/bin/env node
// Claude Code Stop hook: the agent may not finish its turn while tests are red.
// Exit 2 blocks the stop and feeds the failure back to the agent.
// If the agent is already continuing because of this hook (stop_hook_active),
// we let it stop but still print the failure, so a test it cannot fix never
// causes an endless loop; the human then sees the red result.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let hookInput = {};
try {
  hookInput = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  /* no or invalid stdin: treat as a first stop */
}

const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const r = spawnSync(process.execPath, ['--test', 'tests/'], { encoding: 'utf8', cwd });
// Phase 2: also build the client. Tests only cover src/sim, so a broken client
// import once slipped through with all tests green.
const b = r.status === 0 ? spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--logLevel', 'error'], { encoding: 'utf8', cwd }) : { status: 0 };
if (r.status === 0 && b.status === 0) process.exit(0);

const failures = (r.status !== 0 ? r.stdout + r.stderr : b.stdout + b.stderr)
  .split('\n')
  .filter((l) => l.startsWith('✖') || /AssertionError|Error|error/.test(l))
  .slice(0, 30)
  .join('\n');
const what = r.status !== 0 ? `Tests are failing (npm test exit ${r.status})` : `The client build is failing (vite build exit ${b.status})`;
process.stderr.write(`${what}. Fix it before finishing, or tell the user plainly why it still fails.\n${failures}\n`);
process.exit(hookInput.stop_hook_active ? 0 : 2);
