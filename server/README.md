# Overleft Studios — local server

Zero-dependency Node server (Node 18+, built-ins only) that serves the
static site **and** the newsletter signup API.

## Run

```bash
node server/server.js
```

Then open http://localhost:3000 — `GET /` maps to `index.html`.
Set `PORT` to change the port (`PORT=8080 node server/server.js`).

## Endpoints

| Method | Path                | Purpose                                                        |
|--------|---------------------|----------------------------------------------------------------|
| POST   | `/api/subscribe`    | Body: `{"email":"you@example.com"}`. New email → `201 {ok:true}`; duplicate → `200 {ok:true, already:true}` ("already on the list"); bad input → `400 {ok:false, error}` |
| GET    | `/api/subscribers`  | Returns `{count}` only — stored addresses are never exposed    |
| OPTIONS| `/api/*`            | CORS preflight → `204`                                         |

## Storage

Sign-ups are appended to `server/data/subscribers.json` as an array of
`{email, subscribedAt}` (the file/dir are created lazily, and the file
is gitignored). If the file ever becomes corrupt it is backed up next
to itself as `*.corrupt-<ts>.bak` and re-initialised — the server keeps
running.

## Static hosting note

GitHub Pages (and any static host) **cannot run this server**. The site
works fine there, but the form on `subscribe.html` degrades gracefully:
it detects the unreachable `/api/subscribe` endpoint and points visitors
to the studio's socials instead. Run this server only when you want the sign-up
desk live (local dev, VPS, etc.).
