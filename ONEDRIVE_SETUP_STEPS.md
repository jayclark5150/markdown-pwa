# OneDrive Integration Setup Steps

This guide walks through integrating the OneDrive functionality into your markdown-pwa application.

## Files Provided

- **`ONEDRIVE_INTEGRATION.md`** — Complete architecture and API documentation
- **`onedrive-client.js`** — Core OneDrive client library (auth, file ops, token management)
- **`onedrive-picker.js`** — File picker modal UI component
- **`ONEDRIVE_SETUP_STEPS.md`** — This file

## Step 1: Update config.example.js

Add Microsoft credentials template to `config.example.js`:

```javascript
window.APP_CONFIG = {
  // ... existing Google credentials ...

  // Microsoft OneDrive OAuth (personal accounts)
  MICROSOFT_CLIENT_ID: 'PLACEHOLDER_CLIENT_ID',
  MICROSOFT_TENANT_ID: 'common',
  MICROSOFT_REDIRECT_URI: 'http://localhost:3000/',
};
```

## Step 2: Update index.html

### 2a. Add MSAL Library (before your app scripts)

Add this before `app.js` loads. Pinned to a specific version with SRI:

```html
<!-- Microsoft Authentication Library (MSAL) for browser-based auth -->
<script 
  src="https://alcdn.msauth.net/browser/2.26.0/js/msal-browser.min.js"
  integrity="sha384-aVnzpbXl6Ax79WxcnE9TnrP29L7gO5QiKdQMW9Z0IY6A6sVkKPFkdKBc8ZyZg5jXx"
  crossorigin="anonymous"
></script>
```

### 2b. Add OneDrive UI Elements (in toolbar, alongside Google Drive elements)

Add this section to your toolbar (in `index.html`):

```html
<!-- OneDrive Controls (parallel to Google Drive) -->
<div id="onedrive-status" class="drive-status">
  <span id="onedrive-status-text">Not connected</span>
  <span id="onedrive-file-info" style="margin-left: 1rem; font-size: 0.9em; opacity: 0.8;"></span>
</div>

<button 
  id="onedrive-connect-btn" 
  class="btn" 
  title="Sign in to OneDrive"
  onclick="window.onedriveClient.signIn()"
>
  Connect to OneDrive
</button>

<button 
  id="onedrive-open-btn" 
  class="btn" 
  style="display: none;" 
  title="Open a markdown file from OneDrive"
  onclick="handleOnedriveOpen()"
>
  Open from OneDrive
</button>

<button 
  id="onedrive-saveas-btn" 
  class="btn" 
  style="display: none;" 
  title="Save current document to OneDrive"
  onclick="handleOnedriveSaveAs()"
>
  Save to OneDrive as...
</button>

<button 
  id="onedrive-rename-btn" 
  class="btn" 
  style="display: none;" 
  title="Rename the currently open OneDrive file"
  onclick="handleOnedriveRename()"
>
  Rename
</button>

<button 
  id="onedrive-delete-btn" 
  class="btn" 
  style="display: none;" 
  title="Delete the currently open OneDrive file"
  onclick="handleOnedriveDelete()"
>
  Delete
</button>
```

### 2c. Add Script Tags (before closing `</body>`)

```html
<!-- OneDrive integration -->
<script src="onedrive-client.js"></script>
<script src="onedrive-picker.js"></script>
```

## Step 3: Update app.js

### 3a. Initialize OneDrive on App Load

In the existing initialization code (look for where Google Drive is initialized), add:

```javascript
// After validateCredentials() and other init code, add:

// Initialize OneDrive if credentials are configured
setTimeout(() => {
  window.onedriveClient.init().catch(e => console.warn('OneDrive init skipped:', e));
}, 100);
```

Or better yet, call it when the app is ready:

```javascript
// In your app's load/ready handler:
document.addEventListener('DOMContentLoaded', async () => {
  // ... existing init code ...
  
  // Initialize OneDrive
  try {
    await window.onedriveClient.init();
  } catch (e) {
    console.warn('OneDrive initialization failed:', e);
  }
});
```

### 3b. Add Handler Functions

Add these functions to `app.js` to handle OneDrive operations:

```javascript
// ── OneDrive integration handlers ──────────────────────────────────────────────

/**
 * Handle "Open from OneDrive" button click
 */
async function handleOnedriveOpen() {
  if (!window.onedriveClient.isConnected()) {
    showToast('Not connected to OneDrive');
    return;
  }

  try {
    const picker = new window.OnedrivePicker();
    const selected = await picker.pickFile();

    if (!selected) return; // User cancelled

    // Read file content
    showToast('Opening ' + selected.name + '...');
    const content = await window.onedriveClient.readFile(selected.id);

    // Load into editor
    editor.value = content;
    isDirty = false;
    renderPreview();
    updateStats();
    updateCursor();

    // Clear any local/Drive file handles
    localFileHandle = null;
    dirHandle = null;

    // Set up for OneDrive auto-save
    window.onedriveClient.setFileId(selected.id, selected.name);

    currentTitle = selected.name.replace(/\.md$/, '');
    tbTitle.textContent = currentTitle;
    
    showToast('Opened: ' + selected.name);
  } catch (error) {
    showToast('Failed to open file: ' + error.message, 5000);
    console.error('OneDrive open failed:', error);
  }
}

/**
 * Handle "Save to OneDrive as..." button click
 */
async function handleOnedriveSaveAs() {
  if (!window.onedriveClient.isConnected()) {
    showToast('Not connected to OneDrive');
    return;
  }

  try {
    const picker = new window.OnedrivePicker();
    const saveLocation = await picker.pickSaveLocation(currentTitle + '.md');

    if (!saveLocation) return; // User cancelled

    showToast('Saving to OneDrive...');

    // Create file
    const created = await window.onedriveClient.createFile(
      saveLocation.filename,
      editor.value,
      saveLocation.parentFolderId
    );

    // Set up for auto-save
    window.onedriveClient.setFileId(created.id, created.name);
    currentTitle = created.name.replace(/\.md$/, '');
    tbTitle.textContent = currentTitle;
    isDirty = false;

    showToast(`Saved to OneDrive: ${created.name}`);
  } catch (error) {
    showToast('Failed to save file: ' + error.message, 5000);
    console.error('OneDrive save failed:', error);
  }
}

/**
 * Handle "Rename" button click for OneDrive file
 */
async function handleOnedriveRename() {
  const fileId = window.onedriveClient.getFileId();
  const currentName = window.onedriveClient.getFileName();

  if (!fileId || !currentName) {
    showToast('No OneDrive file open');
    return;
  }

  const newName = prompt('New filename:', currentName);
  if (!newName) return;

  try {
    showToast('Renaming...');
    const renamed = await window.onedriveClient.renameFile(fileId, newName);
    window.onedriveClient.setFileId(renamed.id, renamed.name);
    currentTitle = renamed.name.replace(/\.md$/, '');
    tbTitle.textContent = currentTitle;
    showToast(`Renamed to: ${renamed.name}`);
  } catch (error) {
    showToast('Failed to rename: ' + error.message, 5000);
    console.error('OneDrive rename failed:', error);
  }
}

/**
 * Handle "Delete" button click for OneDrive file
 */
async function handleOnedriveDelete() {
  const fileId = window.onedriveClient.getFileId();
  const currentName = window.onedriveClient.getFileName();

  if (!fileId || !currentName) {
    showToast('No OneDrive file open');
    return;
  }

  if (!confirm(`Delete "${currentName}" from OneDrive?`)) {
    return;
  }

  try {
    showToast('Deleting...');
    await window.onedriveClient.deleteFile(fileId);
    
    // Clear editor
    editor.value = '';
    isDirty = false;
    renderPreview();
    updateStats();
    currentTitle = 'New Document';
    tbTitle.textContent = currentTitle;
    window.onedriveClient.clearFile();

    showToast('File deleted from OneDrive');
  } catch (error) {
    showToast('Failed to delete: ' + error.message, 5000);
    console.error('OneDrive delete failed:', error);
  }
}

/**
 * Auto-save to OneDrive (called by existing auto-save logic)
 */
async function saveToOnedrive(content, silent = false) {
  const fileId = window.onedriveClient.getFileId();

  if (!fileId) {
    // New file, not yet saved to OneDrive
    return;
  }

  try {
    const updated = await window.onedriveClient.updateFile(fileId, content);
    if (!silent) {
      showToast(`Saved to OneDrive: ${updated.name}`);
    }
    return true;
  } catch (error) {
    showToast(`OneDrive save failed: ${error.message}`, 5000);
    console.error('OneDrive auto-save error:', error);
    return false;
  }
}
```

### 3c. Integrate with Auto-Save Logic

In the existing `autoSave()` function or auto-save timer, add OneDrive support:

```javascript
// In your existing auto-save function, after saving to Drive/local:

async function autoSave() {
  if (!isDirty || !editor.value) return;

  const content = editor.value;

  // Save to OneDrive if a file is open there
  if (window.onedriveClient?.isConnected() && window.onedriveClient?.getFileId()) {
    try {
      await saveToOnedrive(content, true); // true = silent (don't show toast)
    } catch (error) {
      console.warn('OneDrive auto-save failed:', error);
      // Don't interrupt other save paths if OneDrive fails
    }
  }

  // ... rest of existing auto-save logic (Google Drive, local file) ...

  isDirty = false;
  saveStatus.textContent = '✓ All saved';
}
```

## Step 4: Get Microsoft Credentials

### 4a. Register App in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory → App registrations → New registration**
3. Fill in:
   - **Name**: `markdown-pwa`
   - **Supported account types**: Select "Accounts in any organizational directory..." (supports personal accounts)
   - **Redirect URI**: `http://localhost:3000/` (for local development)
4. Click **Register**

### 4b. Create Client Secret (for GitHub Pages deployment)

Note: Client secrets are NOT needed for local development (MSAL handles auth entirely client-side). Only create if deploying to production.

1. Go to **Certificates & secrets → New client secret**
2. Description: `markdown-pwa-deploy`
3. Copy the **Value** (not the ID)

### 4c. Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission → Microsoft Graph**
3. Select **Delegated permissions**
4. Search for and add: `Files.ReadWrite`
5. Click **Grant admin consent** (if available in your org)

### 4d. Get Your Credentials

From **Overview** page:
- **Client ID** (Application ID)
- **Tenant ID** (Directory ID)

### 4e. Update Redirect URI for Production

In **Authentication** section, add your production URL:
- `https://yourdomain.com/`

## Step 5: Configure Local Development

1. Copy config.example.js (updated with OneDrive fields):
   ```bash
   cp config.example.js config.js
   ```

2. Edit `config.js` and add your credentials:
   ```javascript
   window.APP_CONFIG = {
     GOOGLE_CLIENT_ID: 'your-google-client-id...',
     GOOGLE_API_KEY: 'your-google-api-key...',
     MICROSOFT_CLIENT_ID: 'your-microsoft-client-id',
     MICROSOFT_TENANT_ID: 'common',
     MICROSOFT_REDIRECT_URI: 'http://localhost:3000/',
   };
   ```

3. Start local server on port 3000:
   ```bash
   npx serve . --port 3000
   ```

4. Open `http://localhost:3000/`

## Step 6: Configure GitHub Pages Deployment

Update your `.github/workflows/deploy.yml`:

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

Add these GitHub repository secrets (Settings → Secrets and variables → Actions):
- `MICROSOFT_CLIENT_ID` — Your Azure app's Client ID
- `MICROSOFT_TENANT_ID` — `common` (for personal accounts)
- `MICROSOFT_REDIRECT_URI` — Your production GitHub Pages URL, e.g., `https://yourusername.github.io/markdown-pwa-main/`

## Step 7: Test the Integration

### Local Testing
1. Open `http://localhost:3000/`
2. Click "Connect to OneDrive"
3. Sign in with your Microsoft account
4. Click "Open from OneDrive"
5. Browse and select a `.md` file
6. Edit and verify auto-save works
7. Click "Save to OneDrive as..." to create a new file

### Verify Auto-Save
- Open a file from OneDrive
- Make changes
- Wait 2 seconds (auto-save delay)
- Check save status indicator

## Troubleshooting

### "Redirect URI does not match"
- Check `config.js` has correct `MICROSOFT_REDIRECT_URI`
- Verify it matches exactly what's registered in Azure Portal
- Include trailing slash: `http://localhost:3000/`

### "MSAL not defined"
- Verify MSAL script tag is in `index.html` before `onedrive-client.js`
- Check browser console for CDN load errors
- May be blocked by network/firewall

### Token Expiration Issues
- Tokens auto-refresh; if problems persist, refresh the page
- Manual re-sign-in: click "Connect to OneDrive" again

### File Not Found (404)
- File may have been deleted
- Refresh file picker to get updated list
- Try opening a different file

## What's Next?

After successful integration:

1. **Test thoroughly** — especially auto-save and file operations
2. **Update README.md** — add OneDrive to feature list
3. **Deploy** — push to GitHub with updated workflow secrets
4. **Document for users** — explain OneDrive sync in your docs

## Security Notes

- **Tokens**: Stored in-memory only, cleared on browser close
- **Secrets**: Never commit `config.js`; use GitHub Secrets for deployment
- **Scopes**: `Files.ReadWrite` grants access to user's entire OneDrive
  - For tighter security, consider requesting `Files.ReadWrite.AppFolder` (app-specific folder only)
- **CORS**: Microsoft Graph API handles CORS; no proxy needed
