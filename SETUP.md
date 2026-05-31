# Markdown PWA — Setup Guide

## Files
```
markdown-pwa/
├── index.html    — App UI
├── app.js        — Editor logic + Google Drive integration
├── sw.js         — Service worker (offline support)
├── manifest.json — PWA manifest
├── icons/        — Create this folder (see step 4)
│   ├── icon-192.png
│   └── icon-512.png
└── SETUP.md      — This file
```

---

## Step 1 — Get Google API Credentials

1. Go to https://console.cloud.google.com
2. Create a new project (or select existing)
3. Go to **APIs & Services → Enable APIs**
   - Search for and enable **Google Drive API**
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → API Key**
   - Copy the key — this is your `GOOGLE_API_KEY`
6. Click **Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: Markdown Editor
   - Authorized JavaScript origins: add your domain
     - For local testing: `http://localhost:8080`
     - For production: `https://yourusername.github.io`
   - Copy the Client ID — this is your `GOOGLE_CLIENT_ID`
7. Go to **APIs & Services → OAuth consent screen**
   - Add your email as a test user (while in development)

---

## Step 2 — Add credentials to config.js

Copy the template and fill in your values:

```bash
cp config.example.js config.js
```

Then edit `config.js`:

```js
window.APP_CONFIG = {
  GOOGLE_CLIENT_ID: '123456789-abc.apps.googleusercontent.com',
  GOOGLE_API_KEY:   'AIzaSyABC123...',
};
```

`config.js` is gitignored so your keys are never committed. Note that any
client-side Google API key is still visible to anyone who loads the app in a
browser, so lock the key down in Google Cloud Console with HTTP-referrer
restrictions (limited to your domain) and restrict it to the Google Drive API.

---

## Step 3 — Create icons folder

Create an `icons/` folder and add two PNG icons:
- `icon-192.png` — 192x192 pixels
- `icon-512.png` — 512x512 pixels

You can use any image editor or generate them at:
https://favicon.io/favicon-generator/

---

## Step 4 — Test locally

You need a local server (PWAs require HTTPS or localhost).

Install a simple server:
```powershell
npm install -g serve
```

Run it:
```powershell
cd "C:\Users\Jay Clark\Documents\markdown-pwa"
serve .
```

Open http://localhost:3000 in Chrome or Edge.

---

## Step 5 — Deploy to GitHub Pages (free hosting)

1. Create a new GitHub repo called `markdown-pwa`
2. Push all files to the repo:
   ```powershell
   git init
   git add .
   git commit -m "Initial PWA"
   git remote add origin https://github.com/jayclark5150/markdown-pwa.git
   git push -u origin main
   ```
3. Go to repo Settings → Pages → Source: **main branch**
4. Your app will be live at:
   `https://jayclark5150.github.io/markdown-pwa`
5. Add that URL to your Google OAuth authorized origins

---

## How Google Drive works

| Action | What happens |
|--------|-------------|
| Click "Connect Drive" | Google OAuth popup, one-time sign-in |
| Click "Open from Drive" | Shows your .md files, click to open |
| Click "Save to Drive" | Saves/updates the file in your Drive |
| Auto-save | Saves automatically 2 seconds after you stop typing |
| New file | Creates a new file in Drive on first save |

Files are saved to the root of your Google Drive.
They appear in Drive as regular `.md` files you can share.

---

## Browser support

| Browser | Open local | Save local | Drive |
|---------|-----------|-----------|-------|
| Chrome  | ✅ Native picker | ✅ Native picker | ✅ |
| Edge    | ✅ Native picker | ✅ Native picker | ✅ |
| Safari  | ✅ Input fallback | ⬇ Download | ✅ |
| Firefox | ✅ Input fallback | ⬇ Download | ✅ |
