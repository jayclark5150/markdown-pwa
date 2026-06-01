# GitHub Pages + Google OAuth Setup

When deploying to GitHub Pages, you need to configure the OAuth Client ID to allow your GitHub Pages domain.

## Your GitHub Pages URL

Your PWA is deployed at:
```
https://jayclark5150.github.io/markdown-pwa/
```

## Fix: Add GitHub Pages Domain to OAuth Client ID

Follow these steps in Google Cloud Console:

### Step 1: Go to Google Cloud Console

1. Go to: https://console.cloud.google.com/
2. Make sure you're in the correct project
3. Navigate to **APIs & Services** > **Credentials**

### Step 2: Edit OAuth 2.0 Client ID

1. Find your OAuth 2.0 Client ID (type: "Web application")
   - Name should be something like "Markdown Editor - Web"
2. Click on it to edit

### Step 3: Add GitHub Pages as Authorized Origin

1. Scroll down to **Authorized JavaScript origins**
2. Add this entry:
   ```
   https://jayclark5150.github.io
   ```
   (Note: This is WITHOUT /markdown-pwa/ at the end - just the domain)

3. Scroll down to **Authorized redirect URIs**
4. Add this entry:
   ```
   https://jayclark5150.github.io/markdown-pwa/
   ```
   (Note: This DOES include /markdown-pwa/ at the end)

5. Click **Save**

### Step 4: Test Deployment

After saving, GitHub Pages should automatically re-deploy with the updated config. If not:

1. Go to: https://github.com/jayclark5150/markdown-pwa/actions
2. Click the latest workflow run
3. Click **Re-run all jobs**

Then test at: https://jayclark5150.github.io/markdown-pwa/

## Why This Matters

Google OAuth requires you to explicitly whitelist which domains can use your credentials. This is a security feature to prevent attackers from using your credentials on their own domains.

## If You Still Get "Access Denied"

1. **Hard refresh the page:** `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
2. **Clear browser cache** and try again
3. **Check browser console** (F12) for error messages - they'll show what's being rejected
4. **Verify the exact domain matches** - spaces, slashes, and capitalization matter

## Checklist

- [ ] Google Cloud Console open and in correct project
- [ ] OAuth 2.0 Client ID found and opened for editing
- [ ] `https://jayclark5150.github.io` added to Authorized JavaScript origins
- [ ] `https://jayclark5150.github.io/markdown-pwa/` added to Authorized redirect URIs
- [ ] Changes saved
- [ ] GitHub Pages workflow re-run (if needed)
- [ ] Hard refresh on GitHub Pages
- [ ] Sign-in tested and working
