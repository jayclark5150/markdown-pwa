# Markdown PWA

A fast, offline-capable Markdown editor that runs entirely in the browser, with live preview and optional Google Drive sync. Installable as a Progressive Web App.

## Features

- **Live preview** — Markdown rendered as you type, with syntax-highlighted code blocks.
- **Focus mode** — distraction-free WYSIWYG writing with typewriter scrolling.
- **Find & replace** — with match navigation and replace-all.
- **Local files** — open and save directly to disk via the File System Access API (Chrome/Edge), with a download fallback for Safari/Firefox.
- **Google Drive sync** — open, edit, and auto-save `.md` files in your Drive.
- **Auto-save** — saves two seconds after you stop typing.
- **Offline** — works without a connection once installed; install it as an app from the browser.
- Line numbers, word/character count, adjustable zoom, and light keyboard shortcuts.

## Tech

Plain HTML/CSS/JavaScript — no build step, no framework. It uses [marked](https://github.com/markedjs/marked) for parsing, [DOMPurify](https://github.com/cure53/DOMPurify) to sanitize rendered HTML, [highlight.js](https://highlightjs.org/) for code highlighting, and [Turndown](https://github.com/mixmark-io/turndown) for HTML→Markdown in focus mode. All third-party scripts are version-pinned with Subresource Integrity, and the app ships a Content Security Policy.

## Setup

See [SETUP.md](SETUP.md) for full instructions on Google API credentials, local testing, and deployment.

Quick version:

```bash
cp config.example.js config.js   # then add your Google credentials
npx serve .                       # serve locally (PWAs need https or localhost)
```

Open the local URL in Chrome or Edge.

### Credentials

Google credentials live in `config.js`, which is **gitignored** and never committed. Copy `config.example.js` to `config.js` and fill in your own `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY`.

Because the app is fully client-side, any API key it uses is visible in the browser. Restrict your key in the Google Cloud Console with HTTP-referrer restrictions (limited to your domain) and scope it to the Google Drive API only.

## Deployment

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that publishes to GitHub Pages. It generates `config.js` at deploy time from a `GOOGLE_API_KEY` repository secret, so the key stays out of the repo source.

To use it:

1. Add a repository secret named `GOOGLE_API_KEY` (Settings → Secrets and variables → Actions).
2. Set Pages to deploy from GitHub Actions (Settings → Pages → Source → GitHub Actions).
3. Push to `main` — the workflow builds and deploys automatically.

Remember to add your Pages URL to the key's referrer restrictions and to your OAuth client's authorized JavaScript origins.

## Browser support

| Browser | Open local | Save local | Drive |
|---------|-----------|-----------|-------|
| Chrome  | Native picker | Native picker | Yes |
| Edge    | Native picker | Native picker | Yes |
| Safari  | Input fallback | Download | Yes |
| Firefox | Input fallback | Download | Yes |
