# Overleft Studios — Game Promo Website

Promotional website for **MERCHANTS**, the first game by
Overleft Studios — a team of 13 developers.

Built with plain HTML/CSS/JS: no build step, so it deploys to GitHub Pages as-is
and works on any static host (Netlify, Vercel, your own server) later.

## Structure

```
index.html      Home — hero, about the game, features, media, CTA
about.html      About — the studio, the project, the team
steam.html      Placeholder for the Steam link ("we're hard at work")
subscribe.html  Newsletter signup page
404.html        GitHub Pages 404 page
css/style.css   All styling — theme variables live at the top (:root)
js/main.js      Mobile nav toggle + dynamic footer year
js/subscribe.js Newsletter form handler — posts to Google Apps Script
server/         Optional zero-dependency Node dev server
assets/         Favicon and future images
```

## Things to update before launch

- Search the codebase for `TODO` comments:
  - Replace the `steam.html` links with the real Steam store URL once live.
- Game title is currently `MERCHANTS` (working title) — swap if it changes.
- Swap the `.media-placeholder` boxes for real screenshots/art.

## Restyling

All colors, fonts, spacing and radii are CSS custom properties in the `:root`
block at the top of `css/style.css`. Once the game's art direction is decided,
change the values there to restyle the entire site.

## Deploying to GitHub Pages

1. Push this repo to GitHub (already done if you're reading this there).
2. On GitHub: **Settings → Pages**.
3. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`, then **Save**.
5. The site goes live at `https://itsmysquid.github.io/Overleft_Studios/`.

The `.nojekyll` file tells GitHub Pages to serve the files as-is.

## Newsletter signup

The form on `subscribe.html` posts the email to a Google Apps Script web
app (the `ENDPOINT` in `js/subscribe.js`), which appends it to a private
Google Sheet — that's where you check who's subscribed. It works on plain
static hosting, so no backend runs on GitHub Pages.

The Apps Script lives in the Sheet's **Extensions → Apps Script**. It
validates the email and de-duplicates; the body is sent as `text/plain`
to avoid a CORS preflight, which Apps Script doesn't answer. Editing the
script and bumping the deployment version keeps the same `/exec` URL —
only a brand-new deployment changes it (then update `ENDPOINT`).

## Local development

Open `index.html` directly in a browser, or serve the folder:

```
npx serve .
```

Or use the bundled dev server (plain static file serving):

```
node server/server.js   # http://localhost:3000
```
