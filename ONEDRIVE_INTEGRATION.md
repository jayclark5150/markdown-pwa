# OneDrive Integration Guide

This document outlines the OneDrive integration for markdown-pwa, enabling users to open, edit, and auto-save Markdown files stored in their personal Microsoft OneDrive accounts.

## Overview

The OneDrive integration runs **in parallel** with the existing Google Drive implementation. Both can be active simultaneously, and users can switch between providers or use them independently.

### Supported Features
- Browse OneDrive folder structure with a file picker
- Open `.md` files from OneDrive
- Edit files with automatic saving
- Create and save new files to OneDrive
- Sync status and error handling
- Token refresh and expiration management

## Architecture

### OAuth 2.0 Flow

OneDrive uses the Microsoft Graph API with OAuth 2.0 authentication:

1. **Token Client Initialization**: Uses `@microsoft/msal-browser` library
2. **Authentication Scopes**: `Files.ReadWrite` (user's entire OneDrive)
3. **Token Storage**: In-memory with expiration tracking
4. **Refresh**: Automatic silent refresh when token nears expiration

### State Variables

Added to app.js alongside Google Drive state:

```javascript
let onedriveConnected    = false;
let onedriveFileId       = null;      // OneDrive file ID (not path)
let onedriveFileName     = null;
let onedriveAccessToken  = null;
let onedriveTokenExpire  = null;
let onedriveTokenClient  = null;      // MSAL TokenClient instance
```

### Key Differences from Google Drive

| Feature | Google Drive | OneDrive |
|---------|-------------|----------|
| **API** | Google Drive API v3 | Microsoft Graph API |
| **File ID** | `/drive/files/{id}` | `/items/{id}` |
| **Update Method** | `drive.files.update()` | `PATCH /me/drive/items/{id}/content` |
| **Discovery** | Via discovery doc | Direct HTTPS calls |
| **Token Library** | `gapi.auth2` | MSAL (`@microsoft/msal-browser`) |

## Setup: Getting OneDrive Credentials

### 1. Register App in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory → App registrations → New registration**
3. Enter details:
   - **Name**: `markdown-pwa` (or your preferred name)
   - **Supported account types**: "Accounts in this organizational directory only (Single tenant)" **OR** "Multitenant" (for personal accounts, select "Multitenant")
   - **Redirect URI**: `http://localhost:3000/` (for local dev); add production URL later
4. Click **Register**

### 2. Create Client Secret

1. Go to **Certificates & secrets → New client secret**
2. Enter description: `markdown-pwa-key`
3. Copy the **Value** (not the ID) — this is your `MICROSOFT_CLIENT_SECRET`
4. ⚠️ Save it securely; you can only view it once

### 3. Configure Permissions

1. Go to **API permissions**
2. Click **Add a permission → Microsoft Graph**
3. Select **Delegated permissions**
4. Search for and add:
   - `Files.ReadWrite` (read/write access to user's OneDrive)
5. Click **Grant admin consent** (if your org allows) or users will be prompted

### 4. Get Your Credentials

From the **Overview** page:
- **Client ID** (Application ID)
- **Tenant ID** (Directory ID)

Store in `config.js`:

```javascript
window.APP_CONFIG = {
  // ... existing Google credentials ...

  // Microsoft OneDrive OAuth
  MICROSOFT_CLIENT_ID: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  MICROSOFT_TENANT_ID: 'common', // Use 'common' for personal accounts
  MICROSOFT_REDIRECT_URI: 'http://localhost:3000/', // Must match registered redirect
};
```

### 5. Update Registered Redirect URIs (for Production)

In Azure Portal, go to **Authentication** and add your production URL(s):
- `https://yourdomain.com/`
- Update `MICROSOFT_REDIRECT_URI` in production config

## Implementation Details

### Loading MSAL

The integration loads MSAL dynamically from CDN (Subresource Integrity pinned):

```html
<script 
  src="https://alcdn.msauth.net/browser/2.26.0/js/msal-browser.min.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

### Initialization

```javascript
async function initMicrosoftAuth() {
  if (!window.msal || !MICROSOFT_CLIENT_ID) return;

  const msalConfig = {
    auth: {
      clientId: MICROSOFT_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}`,
      redirectUri: MICROSOFT_REDIRECT_URI
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false
    }
  };

  publicClientApplication = new msal.PublicClientApplication(msalConfig);
  await publicClientApplication.initialize();

  // Check if user already authenticated
  const accounts = publicClientApplication.getAllAccounts();
  if (accounts.length > 0) {
    onOnedriveConnected();
  }
}
```

### File Operations

#### Open File Picker

```javascript
async function openOnedriveFile() {
  // Launch OAuth flow if needed
  if (!onedriveAccessToken) {
    try {
      const response = await publicClientApplication.acquireTokenPopup({
        scopes: ['Files.ReadWrite'],
        forceRefresh: false
      });
      onedriveAccessToken = response.accessToken;
      onedriveTokenExpire = response.expiresOn;
    } catch (error) {
      showToast('OneDrive sign-in failed: ' + error.errorCode);
      return;
    }
  }

  // Fetch root folder items from OneDrive
  const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
    headers: { 'Authorization': `Bearer ${onedriveAccessToken}` }
  });
  const data = await response.json();
  // ... render file picker UI
}
```

#### Read File

```javascript
async function readOnedriveFile(fileId) {
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
    headers: { 'Authorization': `Bearer ${onedriveAccessToken}` }
  });
  return await response.text();
}
```

#### Update File

```javascript
async function saveToOnedrive(fileId, content) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${onedriveAccessToken}`,
        'Content-Type': 'text/plain'
      },
      body: content
    }
  );
  return response.ok;
}
```

#### Create New File

```javascript
async function createOnedriveFile(filename, content, parentFolderId = 'root') {
  // Create the file
  const createResp = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}:/${filename}:/content`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${onedriveAccessToken}`,
        'Content-Type': 'text/plain'
      },
      body: content
    }
  );

  if (!createResp.ok) throw new Error('Failed to create file');
  return await createResp.json();
}
```

### Token Management

OneDrive tokens expire after 1 hour. Implement silent refresh:

```javascript
async function refreshOnedriveToken() {
  try {
    const response = await publicClientApplication.acquireTokenSilent({
      scopes: ['Files.ReadWrite'],
      forceRefresh: true
    });
    onedriveAccessToken = response.accessToken;
    onedriveTokenExpire = response.expiresOn;
  } catch (error) {
    console.error('Token refresh failed:', error);
    setOnedriveStatus('disconnected');
  }
}

// Check and refresh if expiring soon (5 min before expiry)
setInterval(() => {
  if (onedriveTokenExpire && Date.now() > onedriveTokenExpire.getTime() - 5 * 60 * 1000) {
    refreshOnedriveToken();
  }
}, 60000); // Check every minute
```

## UI Integration

### Toolbar Additions

Add to the toolbar in `index.html`:

```html
<!-- OneDrive Status and Actions -->
<div id="onedrive-status" class="drive-status">
  <span id="onedrive-status-text">Not connected</span>
  <span id="onedrive-file-info" style="margin-left: 1rem; font-size: 0.9em; opacity: 0.8;"></span>
</div>

<button id="onedrive-connect-btn" class="btn" title="Sign in to OneDrive">
  Connect to OneDrive
</button>
<button id="onedrive-open-btn" class="btn" style="display: none;" title="Open a file from OneDrive">
  Open from OneDrive
</button>
<button id="onedrive-saveas-btn" class="btn" style="display: none;" title="Save to OneDrive as new file">
  Save to OneDrive as...
</button>
<button id="onedrive-rename-btn" class="btn" style="display: none;" title="Rename OneDrive file">
  Rename
</button>
<button id="onedrive-delete-btn" class="btn" style="display: none;" title="Delete OneDrive file">
  Delete
</button>
```

### Status Indicator

```javascript
function setOnedriveStatus(state, text) {
  const status = document.getElementById('onedrive-status');
  const statusTxt = document.getElementById('onedrive-status-text');
  
  status.className = 'drive-status ' + state;
  statusTxt.textContent = text || 'Not connected';
  
  // Show/hide buttons based on state
  const isFileOpen = onedriveFileId !== null;
  document.getElementById('onedrive-connect-btn').style.display = 
    state === 'connected' ? 'none' : 'inline-flex';
  document.getElementById('onedrive-open-btn').style.display = 
    state === 'connected' ? 'inline-flex' : 'none';
  document.getElementById('onedrive-saveas-btn').style.display = 
    state === 'connected' ? 'inline-flex' : 'none';
  document.getElementById('onedrive-rename-btn').style.display = 
    state === 'connected' && isFileOpen ? 'inline-flex' : 'none';
  document.getElementById('onedrive-delete-btn').style.display = 
    state === 'connected' && isFileOpen ? 'inline-flex' : 'none';
}
```

## Deployment (GitHub Pages)

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `MICROSOFT_CLIENT_ID` — Your Azure-registered Client ID
- `MICROSOFT_TENANT_ID` — `common` (or your specific tenant)
- `MICROSOFT_REDIRECT_URI` — Your production URL (e.g., `https://yourdomain.com/`)

Update `.github/workflows/deploy.yml` to inject them:

```yaml
- name: Inject credentials
  run: |
    cat > config.js << 'EOF'
    window.APP_CONFIG = {
      GOOGLE_CLIENT_ID: '${{ secrets.GOOGLE_CLIENT_ID }}',
      GOOGLE_API_KEY: '${{ secrets.GOOGLE_API_KEY }}',
      MICROSOFT_CLIENT_ID: '${{ secrets.MICROSOFT_CLIENT_ID }}',
      MICROSOFT_TENANT_ID: '${{ secrets.MICROSOFT_TENANT_ID }}',
      MICROSOFT_REDIRECT_URI: '${{ secrets.MICROSOFT_REDIRECT_URI }}',
    };
    EOF
```

## Security Considerations

### OAuth Scope
- **`Files.ReadWrite`** grants access to the user's entire OneDrive, not individual files. This is the broadest OneDrive permission.
- For tighter scoping, consider requesting only on-demand (incremental consent).

### Token Storage
- Tokens are stored **in-memory only** (`sessionStorage` in MSAL config) and cleared on browser close.
- Secrets are never exposed in client code; they are injected at deploy time.

### Redirect URI
- Must be registered in Azure Portal exactly as used in `MICROSOFT_REDIRECT_URI`.
- For development: `http://localhost:3000/`
- For production: Use `https://yourdomain.com/` with HTTP restriction.

### CORS
- Microsoft Graph API has built-in CORS support; no proxy needed.
- Requests go directly from the browser to the API.

## Testing

### Local Development

1. Copy and update `config.js`:
   ```bash
   cp config.example.js config.js
   ```
   Add MICROSOFT credentials.

2. Serve locally:
   ```bash
   npx serve . --port 3000
   ```

3. Open `http://localhost:3000/`

4. Click **Connect to OneDrive**; you'll be prompted to sign in.

5. After authentication, you can open and edit files.

### Testing File Operations

- Open a `.md` file from OneDrive
- Edit and verify auto-save triggers
- Create a new file
- Rename and delete files (if implemented)

## Troubleshooting

### "Redirect URI mismatch" Error
- Verify the redirect URI in Azure Portal matches `MICROSOFT_REDIRECT_URI` in config.js
- Include trailing slash: `http://localhost:3000/`

### Token Expired
- Tokens auto-refresh silently; if you see "Token expired" errors, check network requests in DevTools.
- Manual fix: Refresh the page or re-authenticate.

### File Not Found (404)
- Verify the file ID is correct and the file hasn't been deleted.
- File IDs change if moved; refresh the file picker.

### MSAL Library Load Error
- Check that `alcdn.msauth.net` is not blocked by your network.
- Verify Subresource Integrity hash is correct in index.html.

## Future Enhancements

- **SharePoint support** — extend to SharePoint document libraries
- **File picker UI** — better folder navigation and search
- **Sync conflict resolution** — handle concurrent edits
- **Version history** — view file versions stored in OneDrive
- **Advanced permissions** — request only `Files.ReadWrite.AppFolder` for app-specific folder
