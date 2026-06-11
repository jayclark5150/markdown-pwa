# Google Credential Rotation Guide

## Step 1: Delete Old Credentials in Google Cloud Console

### Delete Old OAuth 2.0 Client ID
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure you're in the correct project
3. Navigate to **APIs & Services** > **Credentials**
4. Find your OAuth 2.0 Client ID (type: "Web application")
5. Click the three dots menu (⋮) on the right
6. Select **Delete**
7. Confirm deletion

### Delete Old API Key
1. In the same **Credentials** page
2. Find your API Key (type: "API key")
3. Click the three dots menu (⋮) on the right
4. Select **Delete**
5. Confirm deletion

---

## Step 2: Create New OAuth 2.0 Client ID

1. In **APIs & Services** > **Credentials**
2. Click **+ Create Credentials** > **OAuth client ID**
3. If prompted, configure OAuth consent screen first:
   - User Type: External
   - App name: Markdown Editor
   - User support email: your-email@gmail.com
   - Developer contact: your-email@gmail.com
   - Scopes: `https://www.googleapis.com/auth/drive.file`
4. For Application type, select **Web application**
5. Name: "Markdown Editor - Web"
6. Authorized JavaScript origins:
   - `http://localhost:8000` (for local testing)
   - Your production domain (e.g., `https://yourdomain.com`)
7. Authorized redirect URIs:
   - `http://localhost:8000` (for local testing)
   - Your production domain (e.g., `https://yourdomain.com`)
8. Click **Create**
9. **COPY the Client ID** (you'll need it in the next step)

---

## Step 3: Create New API Key

1. In **APIs & Services** > **Credentials**
2. Click **+ Create Credentials** > **API Key**
3. A popup will show your new API Key
4. **COPY the API Key** (you'll need it in the next step)
5. Click **Edit API Key** to restrict it:

### Application Restrictions (Website Restrictions)
   - Under "Application restrictions":
     - Select **Websites**
   - Under "Website restrictions":
     - Click **Add**
     - Add your domain(s):
       - `http://localhost:8000/*` (for local testing)
       - `https://yourdomain.com/*` (for production)
     - **Important:** Include the `/*` wildcard at the end to allow all paths
     - Example for GitHub Pages: `https://jayclark5150.github.io/*`

### API Restrictions
   - Under "API restrictions":
     - Select **Restrict key**
     - Choose **Google Drive API** only
   - Click **Save**

### Complete Example
For a GitHub Pages deployment, your website restrictions should look like:
```
http://localhost:8000/*
https://jayclark5150.github.io/*
```

---

## Step 4: Update GitHub Actions Secrets

1. Go to your GitHub repository: https://github.com/jayclark5150/markdown-pwa
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Create secret #1:
   - Name: `GOOGLE_CLIENT_ID`
   - Value: (paste the Client ID from Step 2)
   - Click **Add secret**
5. Click **New repository secret** again
6. Create secret #2:
   - Name: `GOOGLE_API_KEY`
   - Value: (paste the API Key from Step 3)
   - Click **Add secret**

✅ Now GitHub Actions has secure access to the credentials without exposing them in logs.

---

## Step 5: Update Local Development Config (Do NOT commit to git)

For local testing, create a `config.js` file in the root directory:

```javascript
window.APP_CONFIG = {
  GOOGLE_CLIENT_ID: 'YOUR_NEW_CLIENT_ID_HERE',
  GOOGLE_API_KEY:   'YOUR_NEW_API_KEY_HERE',
};
```

**⚠️ IMPORTANT:** This file is already in `.gitignore`, so it won't be committed. Keep it secure and never share it.

---

## Step 6: Test Locally with Python Server

To test the PWA with your new credentials:

### Start the Local Server

Open your terminal and run:

```bash
cd /Users/jayclark/Documents/markdown-pwa-main
python3 -m http.server 8000
```

You should see output like:
```
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

### Open in Browser

Go to: **http://localhost:8000**

### Test These Features

1. **Sign In**
   - Click the Google Drive button (cloud icon)
   - Authenticate with your Google account
   - Verify you see "Drive connected" status

2. **Open File**
   - Click the "Open from Drive" button
   - Select a markdown file
   - Verify the file content loads

3. **Save File**
   - Edit the content
   - Click "Save to Drive"
   - Verify the save succeeds (check status bar)

4. **Save As** (NEW)
   - Click "💾 Save As"
   - Enter a new filename
   - Verify a new file appears in the Drive file list

5. **Rename File** (NEW)
   - Open a file
   - Click "✎ Rename"
   - Enter a new name
   - Verify the file renames in Drive

6. **Delete File** (NEW)
   - Open a file
   - Click "🗑 Delete"
   - Confirm deletion
   - Verify the file disappears from Drive

7. **Sign Out**
   - Click the "Sign out" button
   - Verify "Not connected" status

### Stop the Server

When done testing, press `Ctrl+C` in the terminal to stop the server.

---

## Verification Checklist

- [ ] Old Client ID deleted from Google Cloud Console
- [ ] Old API Key deleted from Google Cloud Console
- [ ] New Client ID created and copied
- [ ] New API Key created and copied
- [ ] API Key has HTTP referrer restrictions
- [ ] API Key is limited to Google Drive API only
- [ ] GOOGLE_CLIENT_ID secret added to GitHub
- [ ] GOOGLE_API_KEY secret added to GitHub
- [ ] Local config.js updated with new credentials
- [ ] Python server started: `python3 -m http.server 8000`
- [ ] Local PWA tested in browser: http://localhost:8000
- [ ] Google Drive sign-in works
- [ ] File open/save/rename/delete all work locally
- [ ] PWA tested in Chrome
- [ ] PWA tested in Safari

---

## Security Notes

✅ **What's now secure:**
- Old exposed credentials are deleted
- New credentials are stored as GitHub secrets (not in git history)
- API key has referrer restrictions (can only be used from your domain)
- API key is limited to Google Drive API only

❌ **What still needs fixing:**
- config.js is still exposed in browser (see next steps: environment-based credentials)
- Build process needs to inject credentials at deployment time

---

## Troubleshooting

### "Access Denied" or 403 Errors on GitHub Pages

If you get "access denied" or "Failed to load resource: 403" errors when testing on GitHub Pages:

**Problem:** Website restrictions on the API key are blocking your domain.

**Solution:**
1. Go to **APIs & Services** > **Credentials**
2. Click on your API Key
3. Under "Website restrictions", verify you have:
   - `https://yourdomain.github.io/*` (with the wildcard `/*`)
4. If the list is blank, the API key will accept requests from any website (less secure but works)
5. Save and hard refresh your browser: `Cmd+Shift+R`

**Key Points:**
- ✅ Must use `https://` for GitHub Pages (not `http://`)
- ✅ Must include the `/*` wildcard at the end
- ✅ Can have multiple domains (localhost + GitHub Pages)
- ❌ Do NOT include the subdirectory path (e.g., `/markdown-pwa/`)

### OAuth Redirect URI Errors

If you get redirect URI errors:

1. Go to **APIs & Services** > **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Check **Authorized redirect URIs** includes:
   - `https://yourdomain.github.io/markdown-pwa/` (with trailing slash and subdirectory)
4. Check **Authorized JavaScript origins** includes:
   - `https://yourdomain.github.io` (without subdirectory)

---

## Next Steps

After rotation is complete:
1. Verify the PWA works with new credentials locally and on GitHub Pages
2. Implement environment-based credential injection (see Implementation Guide)
3. Update deploy workflow to use GitHub secrets
4. Test deployment with new credentials
5. Monitor Google Cloud for any unusual API usage
