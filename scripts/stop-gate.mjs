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
if (r.status === 0) process.exit(0);

const failures = (r.stdout + r.stderr)
  .split('\n')
  .filter((l) => l.startsWith('✖') || /AssertionError|Error:/.test(l))
  .slice(0, 30)
  .join('\n');
process.stderr.write(`Tests are failing (npm test exit ${r.status}). Fix them before finishing, or tell the user plainly why they still fail.\n${failures}\n`);
process.exit(hookInput.stop_hook_active ? 0 : 2);
