'use strict';

/**
 * Overleft Studios — dev/newsletter server.
 *
 * Zero-dependency Node server (node:http + node:fs + node:path only).
 * Serves the static site from the repo root and exposes a tiny JSON API
 * for the newsletter signup form on subscribe.html.
 *
 * Run:  node server/server.js        (Node 18+)
 * Port: process.env.PORT || 3000
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..'); // repo root, one level up from server/
const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'subscribers.json');
const MAX_BODY_BYTES = 10 * 1024; // ~10KB cap for API bodies

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

/* ---------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------- */

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req, onDone, onOverflow) {
  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      onOverflow();
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => onDone(Buffer.concat(chunks).toString('utf8')));
  req.on('error', () => { /* socket died — nothing to answer */ });
}

/**
 * Load the subscriber list. If the file is missing it starts empty;
 * if it is corrupt, the bad file is backed up next to the original
 * and a fresh list is started — the server never crashes on storage.
 */
function loadSubscribers() {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('store is not an array');
    return parsed;
  } catch (err) {
    try {
      const backup = STORE_FILE + '.corrupt-' + Date.now() + '.bak';
      fs.copyFileSync(STORE_FILE, backup);
      console.warn(`[subscribe] subscribers.json was corrupt — backed up to ${path.basename(backup)} and re-initialised.`);
    } catch (backupErr) {
      console.warn('[subscribe] subscribers.json was corrupt and could not be backed up:', backupErr.message);
    }
    return [];
  }
}

function saveSubscribers(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STORE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, STORE_FILE);
}

/* ---------------------------------------------------------------
 * API handlers
 * ------------------------------------------------------------- */

function handleSubscribe(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed. Use POST.' });
    return;
  }

  readBody(req, (raw) => {
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      sendJson(res, 400, { ok: false, error: 'Request body must be valid JSON.' });
      return;
    }

    if (!body || typeof body.email !== 'string') {
      sendJson(res, 400, { ok: false, error: 'Missing "email" field.' });
      return;
    }

    const email = body.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      sendJson(res, 400, { ok: false, error: 'That email address does not look valid.' });
      return;
    }

    try {
      const list = loadSubscribers();
      if (list.some((entry) => entry && entry.email === email)) {
        sendJson(res, 200, { ok: true, already: true, message: 'already on the list' });
        return;
      }
      list.push({ email, subscribedAt: new Date().toISOString() });
      saveSubscribers(list);
      sendJson(res, 201, { ok: true });
    } catch (err) {
      console.error('[subscribe] storage error:', err);
      sendJson(res, 500, { ok: false, error: 'Could not save your email — please try again later.' });
    }
  }, () => {
    sendJson(res, 413, { ok: false, error: 'Request body too large.' });
  });
}

function handleSubscribersCount(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed. Use GET.' });
    return;
  }

  // Only ever expose the count — never the stored addresses.
  sendJson(res, 200, { count: loadSubscribers().length });
}

/* ---------------------------------------------------------------
 * Static file serving
 * ------------------------------------------------------------- */

function send404(res) {
  const notFound = path.join(ROOT, '404.html');
  fs.readFile(notFound, (nfErr, content) => {
    if (nfErr) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 — page not found');
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  });
}

function serveStatic(req, res, pathname) {
  const relPath = pathname === '/' ? '/index.html' : pathname;

  // Decode and resolve against the repo root, then confirm the result
  // is still inside it (blocks ../ path traversal).
  let resolved;
  try {
    resolved = path.resolve(ROOT, '.' + decodeURIComponent(relPath));
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  // Denylist: never serve internals. The server/ directory holds the
  // subscriber store and server source; dotfiles/dotdirs cover .git,
  // .gitignore, .nojekyll, .gitkeep etc. Return a plain 404 so the
  // existence of these files isn't even revealed.
  const rel = path.relative(ROOT, resolved);
  const segments = rel.split(path.sep);
  if (segments[0] === 'server' || segments.some((seg) => seg.startsWith('.'))) {
    send404(res);
    return;
  }

  fs.stat(resolved, (err, stat) => {
    if (err || !stat.isFile()) {
      send404(res);
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size
    });
    fs.createReadStream(resolved).pipe(res);
  });
}

/* ---------------------------------------------------------------
 * Server
 * ------------------------------------------------------------- */

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  if (pathname === '/api/subscribe') {
    handleSubscribe(req, res);
    return;
  }

  if (pathname === '/api/subscribers') {
    handleSubscribersCount(req, res);
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { ok: false, error: 'Unknown API endpoint.' });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Overleft Studios site running at http://localhost:${PORT}`);
  console.log(`Newsletter endpoint: POST http://localhost:${PORT}/api/subscribe`);
});
