#!/usr/bin/env node
// run_cmd: serves the built game (dist/) and keeps the local leaderboard in a
// file, so it survives closing and reopening the game (Ticket-04 Part 3).
//   node server.js [--port 4173]                 play at http://localhost:4173
//   node server.js --export-leaderboard out.json write {"entries": [...]} in rank order and exit
// Leaderboard file: $DDL_DATA_DIR/leaderboard.json (default ~/.dao-den-long/).
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEntry, insertEntry } from './src/leaderboard.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(ROOT, 'dist');
const DATA_DIR = process.env.DDL_DATA_DIR || join(homedir(), '.dao-den-long');
const DATA_FILE = join(DATA_DIR, 'leaderboard.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

export function loadBoard() {
  try {
    const d = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(d.entries) ? d.entries : [];
  } catch {
    return [];
  }
}

function saveBoard(entries) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify({ entries }, null, 2));
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

export function startServer({ port = 4173, host = '127.0.0.1' } = {}) {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ not found: run "npm run build" first');
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/leaderboard') {
      if (req.method === 'GET') return send(res, 200, { entries: loadBoard() });
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => {
          body += c;
          if (body.length > 10_000) req.destroy();
        });
        req.on('end', () => {
          try {
            const entry = makeEntry(JSON.parse(body));
            const entries = insertEntry(loadBoard(), entry);
            saveBoard(entries);
            send(res, 200, { entries, entry });
          } catch (e) {
            send(res, 400, { error: e.message });
          }
        });
        return;
      }
      return send(res, 405, { error: 'method not allowed' });
    }
    // static files from dist/, never outside it
    const file = resolve(DIST, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(DIST + sep) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, readFileSync(file), TYPES[extname(file)] ?? 'application/octet-stream');
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => ok(server));
  });
}

// ---- CLI ----
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const exp = argv.indexOf('--export-leaderboard');
  if (exp !== -1) {
    const out = argv[exp + 1];
    if (!out) {
      process.stderr.write('error: --export-leaderboard needs a file name\n');
      process.exit(1);
    }
    writeFileSync(out, JSON.stringify({ entries: loadBoard() }, null, 2) + '\n');
    process.stdout.write(`leaderboard exported to ${out}\n`);
    process.exit(0);
  }
  const pi = argv.indexOf('--port');
  const port = pi !== -1 ? Number(argv[pi + 1]) : Number(process.env.PORT || 4173);
  startServer({ port })
    .then(() => process.stdout.write(`Đảo Đèn Lồng: open http://localhost:${port}\nleaderboard file: ${DATA_FILE}\n`))
    .catch((e) => {
      process.stderr.write(`error: ${e.message}\n`);
      process.exit(1);
    });
}
