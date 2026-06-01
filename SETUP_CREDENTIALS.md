# Setting Up Google Credentials for Markdown PWA

This guide explains how to set up Google API credentials for local development and understand how they work in production.

---

## Quick Start (Local Development)

### Step 1: Copy the Template
```bash
cd /Users/jayclark/Documents/markdown-pwa-main
cp config.example.js config.js
```

### Step 2: Get Your Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Make sure you're in the correct project
3. Find your **OAuth 2.0 Client ID** (Web application)
   - Click on it to see the full value
4. Find your **API Key**
   - Click on it to see the full value

### Step 3: Update config.js
```bash
# Edit config.js and replace the PLACEHOLDER values
# Your credentials should look like:
# GOOGLE_CLIENT_ID: 505353054413-0mi7s88ai4p320f89ghhi8m58h6sde29.apps.googleusercontent.com
# GOOGLE_API_KEY: AIzaSyCjlYUDBRr16VuWwrmx-Zf36NXSpjgn7bo
```

### Step 4: Test Locally
```bash
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
```

---

## Understanding the Credential System

### Local Development
```
┌──────────────────────────────────────────┐
│ You                                      │
│ ├── Create config.js (gitignored)       │
│ └── config.js contains real credentials │
└──────────────────────────────────────────┘
                    ↓
        app.js loads from config.js
                    ↓
        window.APP_CONFIG populated
                    ↓
        Google API works locally
```

**Key Points:**
- `config.js` is created manually by you
- `config.js` is in `.gitignore` — never committed
- Contains YOUR actual credentials
- Only exists on your local machine
- Required for local testing

### Production (GitHub Pages)
```
┌──────────────────────────────────────────┐
│ GitHub Actions (Automated)               │
│ ├── Reads from GitHub Secrets            │
│ ├── Generates config.js at build time    │
│ ├── Injects credentials into config.js   │
│ └── Deploys to GitHub Pages              │
└──────────────────────────────────────────┘
                    ↓
     Deployed app loads config.js
                    ↓
     window.APP_CONFIG populated
                    ↓
     Google API works on GitHub Pages
```

**Key Points:**
- GitHub Secrets store credentials securely
- Build process generates config.js (not in git)
- Credentials never exposed in:
  - Git history
  - Build logs (masked)
  - Source code
- Automatic on every push to `main` branch

---

## Security Notes

### Why This Approach?

**Problem:** Credentials in source code = compromise risk

**Solution:** 
- Local: Manual manual setup per developer
- Production: Automated injection from secrets

### What to Protect

1. **config.js (Local)**
   - Contains YOUR credentials
   - NEVER share or commit
   - Keep on your machine only

2. **GitHub Secrets (Production)**
   - Contains production credentials
   - Stored encrypted by GitHub
   - Only visible to authorized workflows
   - Automatically masked in logs

### Credential Rotation

If credentials are ever compromised:

**Local:**
```bash
# Delete old config.js
rm config.js

# Create new one with rotated credentials
cp config.example.js config.js
# Edit with new credentials
```

**Production:**
1. Go to GitHub Settings > Secrets
2. Update `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY`
3. Next deployment automatically uses new credentials

---

## Troubleshooting

### "Credentials not found" Error (Local)

**Symptom:** Console warning about missing credentials

**Fix:**
1. Make sure config.js exists: `ls config.js`
2. If not, create it: `cp config.example.js config.js`
3. Edit config.js and add your actual credentials
4. Refresh browser: `Cmd+Shift+R`

### "Access Denied" on GitHub Pages

**Symptom:** Can't sign in or "403 Forbidden" error

**Possible Causes:**
1. Credentials not in GitHub Secrets
2. API Key restrictions blocking github.io domain
3. OAuth Client ID not configured for GitHub Pages

**Fix:**
1. Check GitHub Secrets are set: Settings > Secrets and variables > Actions
2. Check Google Cloud API restrictions
3. Check OAuth Client ID authorized origins/URIs

### "undefined" or "PLACEHOLDER" Values

**Symptom:** Config shows PLACEHOLDER values

**Cause:** You forgot to replace PLACEHOLDER in config.js

**Fix:**
1. Edit config.js
2. Replace `PLACEHOLDER_CLIENT_ID` with your actual Client ID
3. Replace `PLACEHOLDER_API_KEY` with your actual API Key
4. Save file
5. Refresh browser: `Cmd+Shift+R`

---

## Files Involved

### Local Development
- `config.example.js` — Template (in git)
- `config.js` — Your credentials (gitignored, NOT in git)

### Source Code
- `app.js` — Reads from `window.APP_CONFIG`
- `.gitignore` — Prevents config.js from being committed

### Build/Deployment
- `.github/workflows/deploy.yml` — Generates config.js from secrets
- GitHub Secrets — Encrypted credential storage

---

## Verification Checklist

### Local Development
- [ ] config.js exists: `ls config.js`
- [ ] config.js has real credentials (not PLACEHOLDER)
- [ ] `python3 -m http.server 8000` runs without errors
- [ ] Browser opens to http://localhost:8000
- [ ] Google Drive sign-in works
- [ ] Can open/save/rename/delete files

### Production (GitHub Pages)
- [ ] GitHub Secrets configured (2 secrets)
- [ ] Workflow runs successfully
- [ ] Deployment shows "Deploy successful"
- [ ] Site is live at https://yourdomain.github.io/markdown-pwa/
- [ ] Google Drive sign-in works
- [ ] Can open/save/rename/delete files

---

## References

- [CREDENTIAL_ROTATION_GUIDE.md](CREDENTIAL_ROTATION_GUIDE.md) — How to rotate credentials
- [CREDENTIAL_IMPLEMENTATION.md](CREDENTIAL_IMPLEMENTATION.md) — Technical architecture
- [PWA_SECURITY_OVERHAUL.md](PWA_SECURITY_OVERHAUL.md) — Security improvements

---

## Still Have Questions?

1. Check the error message in browser console (F12)
2. Read the relevant guide above
3. Check your config.js has real (not PLACEHOLDER) values
4. Verify Google Cloud Console has credentials created
5. Verify GitHub Secrets are configured

Contact: See PWA_SECURITY_OVERHAUL.md for escalation path
