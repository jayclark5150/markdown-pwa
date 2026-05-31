# Markdown PWA — Runbook

Operational notes for the Markdown PWA: what was hardened, how it deploys, and how to fix the issues that came up during setup. Written for the live deployment at `https://jayclark5150.github.io/markdown-pwa/`.

## Architecture at a glance

Static client-side app (HTML/CSS/JS, no build step) hosted on GitHub Pages. Markdown is parsed by marked, sanitized by DOMPurify, highlighted by highlight.js; Turndown handles HTML→Markdown in focus mode. Optional Google Drive sync uses the Google Identity Services (GIS) token flow plus the gapi Drive client. Offline support comes from a service worker.

Credentials are not committed. Locally they live in a gitignored `config.js`; on the live site that file is generated at deploy time from a GitHub Actions secret.

## Credentials — what goes where

Three Google values exist and are easy to confuse. Only the first two are used by this app.

| Value | Looks like | Where it goes | Notes |
|-------|-----------|---------------|-------|
| API key | `AIzaSy…` | `GOOGLE_API_KEY` (GitHub secret + local `config.js`) | Used by gapi to load the Drive discovery doc and make Drive calls. |
| OAuth Client ID | `…apps.googleusercontent.com` | Hardcoded in `config.js` / deploy workflow | Public, not a secret. |
| OAuth Client secret | `GOCSPX-…` | Nowhere | The browser sign-in flow does not use it. Never put it in the app. |

The most common failure in this project was putting the wrong value in `GOOGLE_API_KEY` (the `GOCSPX-` client secret, or a deleted key). The API key must start with `AIzaSy`.

## Deploy procedure

1. Make code changes locally; commit and push to `main`.
2. The workflow `.github/workflows/deploy.yml` runs on every push (and can be run manually via Actions → Run workflow).
3. It regenerates `config.js` from the `GOOGLE_API_KEY` secret, then publishes the repo to Pages.
4. Verify: hard-refresh `https://jayclark5150.github.io/markdown-pwa/config.js` (Cmd+Shift+R) and confirm the `GOOGLE_API_KEY` shown is the current valid `AIzaSy…` key.

To redeploy without a code change:

```bash
git commit --allow-empty -m "Redeploy" && git push
```

`config.js` is gitignored, so `git status` will never show it and editing it locally will not appear as a change to commit. That is expected.

## Updating the API key

1. Cloud Console → Credentials: create or identify the valid `AIzaSy…` key. Restrict it to Application = Websites (`https://jayclark5150.github.io/*`, plus `http://localhost:3000` for local dev) and API = Google Drive API only.
2. GitHub → Settings → Secrets and variables → Actions → `GOOGLE_API_KEY` → set the new value, no spaces or line breaks.
3. Update local `config.js` to the same value (for local testing).
4. Redeploy (push or empty commit). Confirm via the live `config.js` URL.
5. Delete the old key in Cloud Console so only the active one remains.

Note: key edits in Cloud Console can take up to ~5 minutes to take effect.

## Troubleshooting

### Drive icon does nothing on click
The OAuth popup must open synchronously inside the click handler. If an `await` runs before `requestAccessToken()`, the browser (Safari especially) silently blocks the popup. Fixed by initializing the token client up front and calling `requestAccessToken()` directly in the click. Also check Safari → Settings → Websites → Pop-up Windows.

### Popup opens, but it never connects after entering credentials — `API key not valid` / `API_KEY_INVALID` (HTTP 400)
The `GOOGLE_API_KEY` being served is wrong or points to a deleted key. Open the live `config.js` URL and read the actual deployed value:
- If it starts with `GOCSPX-`, the secret holds the client secret by mistake — set it to the `AIzaSy…` key.
- If it is an `AIzaSy…` key but still invalid, that key was likely deleted in Cloud Console — create a new key and update the secret + local config.
Always redeploy and hard-refresh after changing the secret.

### `requests-from-referer-blocked` / 403
The key's HTTP-referrer restriction does not include the site origin. Add `https://jayclark5150.github.io/*` (and localhost for dev).

### `Google Drive API has not been used in project … or it is disabled` / 403
Enable the API: `https://console.cloud.google.com/apis/library/drive.googleapis.com`.

### `access_denied` after consent
The OAuth consent screen is in Testing mode and the account is not a listed test user. Add the account under OAuth consent screen → Test users, or publish the app.

### Code blocks crash the preview — `undefined is not an object (evaluating 'e.replace')`
marked 12 calls the custom code renderer with positional args `(code, infostring)`, not a `{ text, lang }` token object. Passing `undefined` text to highlight.js threw. Fixed by a renderer that accepts both calling conventions and coerces text to a string; `renderPreview` is also wrapped in try/catch.

### Stale content after a deploy
The service worker caches assets. After a deploy, hard-refresh (Cmd+Shift+R), or in dev tools → Application → Service Workers → Unregister, then Application → Clear site data, then reload. The cache name is versioned (`md-editor-vN`); bump it when changing the cached asset list.

## Security hardening applied this session

- Fixed two DOM-based XSS sinks: filenames (local and Drive) are now set via `textContent`/`dataset` instead of `innerHTML` interpolation.
- Escaped single quotes/backslashes in the Drive search query to prevent query injection.
- Pinned all CDN libraries to exact versions with Subresource Integrity hashes; added a Content Security Policy. (Google's `api.js`/`gsi/client` can't use SRI and are constrained by the CSP allowlist.)
- Service worker now only caches successful, non-opaque GET responses from allowlisted origins.
- Rendered links get `rel="noopener noreferrer"`.
- Moved Google credentials out of source into a gitignored `config.js` (local) and a GitHub Actions secret (deploy).

## Residual items / good hygiene

- The original exposed API key and the old client secret remain in git history but have been invalidated (deleted / reset), so they are inert. Rewriting history is not worth it for this repo.
- Keep only the active `AIzaSy…` key in Cloud Console, with referrer + Drive-API restrictions.
- Any client-side API key is visible to users of the live app by design; the Cloud Console restrictions — not secrecy — are the real protection.
