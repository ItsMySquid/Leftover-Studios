'use strict';

/**
 * Overleft Studios — local dev server.
 *
 * Zero-dependency Node server (node:http + node:fs + node:path only).
 * Serves the static site from the repo root for local development.
 * The newsletter form posts directly to a Google Apps Script web app
 * (see js/subscribe.js), so no backend API is needed here.
 *
 * Run:  node server/server.js        (Node 18+)
 * Port: process.env.PORT || 3000
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..'); // repo root, one level up from server/

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
  // server source; dotfiles/dotdirs cover .git, .gitignore, .nojekyll,
  // .gitkeep etc. Return a plain 404 so the existence of these files
  // isn't even revealed.
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

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Overleft Studios site running at http://localhost:${PORT}`);
});
