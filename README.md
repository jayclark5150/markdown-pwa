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
- **Three themes** — Lokai (dark editor, light preview), Dark, and Light. Persisted across sessions.
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

## Changelog

### v1.5.0

- **UI redesign** — horizontal header bar and format bar replace the vertical toolbar
- **Three themes** — Lokai (dark editor + light preview, default), Dark, and Light with localStorage persistence
- **WYSIWYG focus mode** — renders markdown as styled prose for distraction-free editing; converts back to markdown on exit via Turndown
- **Mobile responsive** — safe-area insets for iPhone notch, 38px touch targets, horizontally scrollable format bar, Open/Share moved into the "..." menu
- **Security hardening** — SRI hash on highlight.js CSS, paste sanitizer on WYSIWYG contenteditable
- **Repo cleanup** — removed planning docs, stale archives, and editor config files

### v1.5.1

- **iPad PWA support** — installable via Safari "Add to Home Screen" with proper icons (152, 167, 180px) and dark launch images to prevent white flash on startup
- **iPhone responsive layout** — safe-area insets for notch/home indicator, auto-switches to edit-only view below 700px, launch images for iPhone 14/15
- **44px touch targets** — header and format bar buttons meet Apple Human Interface Guidelines minimum on iPad and iPhone
- **Tablet CSS breakpoint** (≤1024px) — safe-area insets, larger dropdown items, touch-optimized layout
- **Phone CSS breakpoint** (≤700px) — horizontally scrollable format bar, hidden line numbers, compact header with filename centered
- **Extra-narrow support** (≤380px) — iPhone SE and iPad Slide Over handled gracefully
- **Fixed manifest paths** — `start_url` and shortcuts corrected for GitHub Pages subpath
- **Service worker** — added `styles.css` to pre-cache, bumped cache version

### v2.0.0

- **OneDrive sync** — sign in with a Microsoft account (work/school or personal) and open/save markdown files in OneDrive via Microsoft Graph. Auth uses MSAL.js (SPA + PKCE, no client secret); tokens are session-only
- **Menu reorganization** — the "..." menu now groups actions by destination: local disk, Google Drive, then OneDrive
- **Clearer labels** — "Open" → "Open from Drive", "Share / Export" → "Save to Drive"
- **Safety fix** — opening a local file now detaches any open cloud file so auto-save can't overwrite it
- **Config** — new `MS_CLIENT_ID` value in `config.js` / `MS_CLIENT_ID` repository secret for deployment

### v2.1.0

- **Unified file menu** — Disk, Google Drive, and OneDrive now expose the same core actions in the same order: Open, Save, Save As, Rename
- **Disk Save As / Rename** — replaces "Download .md"; Save As prompts a fresh file location, Rename renames on disk via `FileSystemFileHandle.move()` where supported (falls back to renaming the working document)
- **OneDrive Save / Save As / Rename** — added to the menu, backed by Microsoft Graph (`PUT` for Save As, `PATCH` for Rename), shown/hidden with connection state to match Drive

## Browser support

| Browser | Open local | Save local | Drive |
|---------|-----------|-----------|-------|
| Chrome  | Native picker | Native picker | Yes |
| Edge    | Native picker | Native picker | Yes |
| Safari  | Input fallback | Download | Yes |
| Firefox | Input fallback | Download | Yes |
