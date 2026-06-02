# OneDrive Integration Implementation Plan

This document provides a detailed step-by-step implementation guide for integrating OneDrive support into the markdown-pwa application.

**Status**: Foundation files exist (`onedrive-client.js`, `onedrive-picker.js`). This plan covers wiring them into the application and deployment.

---

## Overview

The OneDrive integration runs parallel to Google Drive (not abstracted/unified). Both services coexist independently:
- Google Drive uses the Google API + gapi library
- OneDrive uses Microsoft Graph API + MSAL library
- Each has separate UI controls, state management, and file operations

The implementation is sequenced in four phases:

1. **Code Integration Phase** — Wire OneDrive into index.html and app.js
2. **Azure Setup Phase** — Create Azure app registration and obtain credentials
3. **Testing Phase** — Local verification before deployment
4. **Deployment Phase** — Configure GitHub Actions and GitHub Secrets

---

## Phase 1: Code Integration

### 1.1 Update Content Security Policy (CSP) in index.html

**File**: `/sessions/stoic-confident-bardeen/mnt/markdown-pwa-main/index.html`

**Current CSP** (lines 10-17):
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'self' https://cdn.jsdelivr.net https://apis.google.com https://accounts.google.com;
  style-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://*.googleapis.com https://accounts.google.com;
  frame-src https://accounts.google.com https://content.googleapis.com;
  manifest-src 'self';
  worker-src 'self';
  base-uri 'self';
  form-action 'none';
"/>
```

**Changes Required**:
1. Add `https://alcdn.msauth.net` to `script-src` (MSAL CDN)
2. Add `https://login.microsoftonline.com` to `connect-src` (Microsoft auth endpoint)
3. Add `https://graph.microsoft.com` to `connect-src` (Microsoft Graph API)

**Updated CSP**:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'self' https://cdn.jsdelivr.net https://apis.google.com https://accounts.google.com https://alcdn.msauth.net;
  style-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://*.googleapis.com https://accounts.google.com https://login.microsoftonline.com https://graph.microsoft.com;
  frame-src https://accounts.google.com https://content.googleapis.com;
  manifest-src 'self';
  worker-src 'self';
  base-uri 'self';
  form-action 'none';
"/>
```

**Verification**: CSP errors should no longer appear in browser console for MSAL or Graph API calls.

---

### 1.2 Add MSAL Library Script Tag in index.html

**File**: `/sessions/stoic-confident-bardeen/mnt/markdown-pwa-main/index.html`

**Location**: After Google sign-in scripts (around line 53), add:

```html
<!-- Microsoft Authentication Library (MSAL) for browser-based OAuth -->
<script 
  src="https://alcdn.msauth.net/browser/2.26.0/js/msal-browser.min.js"
  integrity="sha384-aVnzpbXl6Ax79WxcnE9TnrP29L7gO5QiKdQMW9Z0IY6A6sVkKPFkdKBc8ZyZg5jXx"
  crossorigin="anonymous"
></script>
```

**Placement Context**:
```html
  <!-- Google libraries are continuously updated by Google and do not support SRI;
       they are constrained via the script-src allowlist in the CSP above. -->
  <script src="https://apis.google.com/js/api.js"></script>
  <script src="https://accounts.google.com/gsi/client"></script>
  
  <!-- Microsoft Authentication Library (MSAL) for browser-based OAuth -->
  <script 
    src="https://alcdn.msauth.net/browser/2.26.0/js/msal-browser.min.js"
    integrity="sha384-aVnzpbXl6Ax79WxcnE9TnrP29L7gO5QiKdQMW9Z0IY6A6sVkKPFkdKBc8ZyZg5jXx"
    crossorigin="anonymous"
  ></script>
  
  <!-- Inter typeface -->
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
```

**Verification**: `window.msal` should be defined in browser console.

---

### 1.3 Add OneDrive UI Elements in index.html

**File**: `/sessions/stoic-confident-bardeen/mnt/markdown-pwa-main/index.html`

**Location**: After Google Drive UI elements (around line 205), add these toolbar button groups:

```html
          <!-- OneDrive Controls -->
          <div class="tb-group">
            <div class="tw">
              <button class="tb-btn" id="onedrive-connect-btn" title="Connect to OneDrive">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              </button>
              <div class="tw-dot" id="onedrive-toolbar-dot"></div>
              <span class="tw-tip" id="onedrive-toolbar-tip">Not connected to OneDrive</span>
            </div>
          </div>

          <div class="tb-group">
            <div class="tw">
              <button class="tb-btn" id="onedrive-open-btn" style="display:none" title="Open from OneDrive">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
              </button>
            </div>
          </div>

          <div class="tb-group">
            <div class="tw">
              <button class="tb-btn" id="onedrive-save-btn" style="display:none" title="Save to OneDrive">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              </button>
            </div>
          </div>

          <div class="tb-group">
            <div class="tw">
              <button class="tb-btn" id="onedrive-saveas-btn" style="display:none" title="Save to OneDrive as...">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l-5.5 9h11z"/><rect x="3" y="13" width="18" height="8" rx="2"/></svg>
              </button>
            </div>
          </div>

          <div class="tb-group">
            <div class="tw">
              <button class="tb-btn" id="onedrive-rename-btn" style="display:none" title="Rename OneDrive file">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              </button>
            </div>
          </div>

          <div class="tb-group">
            <div class="tw">
              <button class="tb-btn danger" id="onedrive-delete-btn" style="display:none" title="Delete OneDrive file">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          </div>

          <div class="tb-group">
            <div class="tw">
              <button class="tb-btn danger" id="onedrive-signout-btn" style="display:none" title="Disconnect from OneDrive">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>
```

**Also add status display** (around line 214, after drive-status div):

```html
  <!-- OneDrive Status Display -->
  <div id="onedrive-status" style="display:none">
    <span class="drive-dot"></span>
    <span id="onedrive-status-text">Not connected</span>
    <span id="onedrive-file-info" style="margin-left: 1rem; font-size: 0.9em; opacity: 0.8;"></span>
  </div>
```

**Also add OneDrive file picker modal** (at end of HTML, before closing </body>, around line 300+):

```html
<!-- OneDrive file picker modal -->
<div id="onedrive-picker-backdrop" style="display:none;">
  <!-- Populated dynamically by onedrive-picker.js -->
</div>
```

**Verification**: 
- All OneDrive buttons visible in toolbar (initially all hidden except connect button)
- No console errors related to missing elements
- SVG icons render properly

---

### 1.4 Load OneDrive Scripts Before app.js in index.html

**File**: `/sessions/stoic-confident-bardeen/mnt/markdown-pwa-main/index.html`

**Location**: Before final `<script src="app.js"></script>` (around line 314-315), add:

```html
<script src="config.js"></script>
<script src="onedrive-client.js"></script>
<script src="onedrive-picker.js"></script>
<script src="app.js"></script>
```

**Current**:
```html
<script src="config.js"></script>
<script src="app.js"></script>
```

**Updated**:
```html
<script src="config.js"></script>
<script src="onedrive-client.js"></script>
<script src="onedrive-picker.js"></script>
<script src="app.js"></script>
```

**Reason**: `onedrive-client.js` and `onedrive-picker.js` must load before `app.js` so they can register handlers.

**Verification**: `window.onedriveClient` and `window.OnedrivePicker` should be defined before app.js runs.

---

### 1.5 Add OneDrive Integration to app.js

**File**: `/sessions/stoic-confident-bardeen/mnt/markdown-pwa-main/app.js`

#### 1.5a Update Config Validation

**Location**: After `validateCredentials()` function (around line 47)

Add Microsoft credentials to validation:

```javascript
// Validate credentials are present
function validateCredentials() {
  const hasGoogle = GOOGLE_CLIENT_ID && GOOGLE_API_KEY;
  const hasMicrosoft = window.APP_CONFIG?.MICROSOFT_CLIENT_ID && 
                       window.APP_CONFIG?.MICROSOFT_TENANT_ID &&
                       window.APP_CONFIG?.MICROSOFT_REDIRECT_URI;

  if (!hasGoogle && !hasMicrosoft) {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isDev) {
      console.warn(
        '⚠️ No credentials found.\n\n' +
        'For local development:\n' +
        '1. Copy config.example.js to config.js\n' +
        '2. Replace PLACEHOLDER values with actual credentials\n' +
        '3. See CREDENTIAL_ROTATION_GUIDE.md for setup instructions\n\n' +
        'For production: Credentials are injected at deploy time from GitHub Secrets.'
      );
    } else {
      console.error(
        '❌ Critical Error: No credentials found on production.\n' +
        'This should not happen. Check that GitHub Secrets are configured correctly.'
      );
      document.body.innerHTML =
        '<div style="padding:20px;font-family:system-ui;color:#cf222e;">' +
        '<h2>Configuration Error</h2>' +
        '<p>Credentials are not configured. The application cannot function.</p>' +
        '<p>This is likely a deployment issue. Please contact the administrator.</p>' +
        '</div>';
    }
  }
}
```

#### 1.5b Add OneDrive State Variables

**Location**: After Google Drive state variables (around line 52-61)

```javascript
// OneDrive state (parallel to Google Drive)
let onedriveConnected = false;
let onedriveFileId   = null;
let onedriveFileName = null;
```

#### 1.5c Add OneDrive DOM References

**Location**: After Google Drive DOM refs (around line 80-83)

```javascript
const onedriveStatus    = document.getElementById('onedrive-status');
const onedriveStatusTxt = document.getElementById('onedrive-status-text');
const onedriveFileInfo  = document.getElementById('onedrive-file-info');
const toolbarOnedriveToolDot = document.getElementById('onedrive-toolbar-dot');
const toolbarOnedriveTip = document.getElementById('onedrive-toolbar-tip');
```

#### 1.5d Add OneDrive Status Function

**Location**: After `setDriveStatus()` function (around line 214-230)

```javascript
// ── OneDrive status display ────────────────────────────────────────────────────
function setOnedriveStatus(state, text) {
  if (!onedriveStatus || !onedriveStatusTxt) return;

  onedriveStatus.className = 'drive-status ' + state;
  onedriveStatus.style.display = state ? '' : 'none';
  onedriveStatusTxt.textContent = text;
  toolbarOnedriveToolDot.className = state || '';
  if (toolbarOnedriveTip) toolbarOnedriveTip.textContent = text || 'Not connected to OneDrive';

  // Show/hide OneDrive action buttons based on connection state
  const isConnected = state === 'connected';
  const isFileOpen = onedriveFileId !== null;
  
  document.getElementById('onedrive-open-btn').style.display     = isConnected ? 'inline-flex' : 'none';
  document.getElementById('onedrive-save-btn').style.display     = isConnected && onedriveFileId ? 'inline-flex' : 'none';
  document.getElementById('onedrive-saveas-btn').style.display   = isConnected ? 'inline-flex' : 'none';
  document.getElementById('onedrive-rename-btn').style.display   = isConnected && isFileOpen ? 'inline-flex' : 'none';
  document.getElementById('onedrive-delete-btn').style.display   = isConnected && isFileOpen ? 'inline-flex' : 'none';
  document.getElementById('onedrive-signout-btn').style.display  = isConnected ? 'inline-flex' : 'none';
}
```

#### 1.5e Initialize OneDrive on Page Load

**Location**: After Google API initialization code (around line 457-461), add to DOMContentLoaded handler:

```javascript
// Initialize OneDrive if credentials are present
if (window.APP_CONFIG?.MICROSOFT_CLIENT_ID && window.APP_CONFIG?.MICROSOFT_TENANT_ID) {
  window.onedriveClient.init().catch(err => {
    console.warn('OneDrive initialization skipped:', err);
  });
} else {
  console.debug('OneDrive credentials not configured, skipping MSAL init');
}
```

**Location for this**: Inside the main DOMContentLoaded event listener, after Google Drive initialization.

#### 1.5f Add OneDrive Handler Functions

**Location**: After Google Drive handler functions (around line 960+), add:

```javascript
// ── OneDrive Handlers ──────────────────────────────────────────────────────────

/**
 * Handle "Connect to OneDrive" button click
 */
async function handleOnedriveConnect() {
  try {
    await window.onedriveClient.signIn();
    onedriveConnected = true;
    setOnedriveStatus('connected', 'Connected to OneDrive');
    showToast('✓ Connected to OneDrive');
  } catch (error) {
    console.error('OneDrive sign-in failed:', error);
    setOnedriveStatus('error', 'Connection failed');
    showToast('OneDrive sign-in failed: ' + error.message, 5000);
  }
}

/**
 * Handle "Open from OneDrive" button click
 */
async function handleOnedriveOpen() {
  if (!onedriveConnected) {
    showToast('Not connected to OneDrive', 3000);
    return;
  }

  try {
    const picker = new window.OnedrivePicker();
    const result = await picker.pickFile();
    
    if (!result) return; // User cancelled

    const { id, name } = result;
    await loadOnedriveFile(id, name);
  } catch (error) {
    console.error('OneDrive open failed:', error);
    showToast('Failed to open file: ' + error.message, 5000);
  }
}

/**
 * Load a file from OneDrive into the editor
 */
async function loadOnedriveFile(fileId, fileName) {
  try {
    const content = await window.onedriveClient.readFile(fileId);
    
    // Clear previous file state
    driveFileId = null;
    localFileHandle = null;
    isDirty = false;
    
    // Load new content
    editor.value = content;
    currentTitle = fileName.replace(/\.md$/, '');
    updateTitle();
    renderPreview();
    updateStats();
    
    // Set OneDrive file info
    onedriveFileId = fileId;
    onedriveFileName = fileName;
    window.onedriveClient.setFileId(fileId, fileName);
    
    // Update save indicator
    saveStatus.textContent = '✓ Opened';
    
    showToast(`✓ Opened: ${fileName}`);
  } catch (error) {
    console.error('Failed to load OneDrive file:', error);
    showToast('Failed to load file: ' + error.message, 5000);
  }
}

/**
 * Handle "Save to OneDrive as..." button click
 */
async function handleOnedriveSaveAs() {
  if (!onedriveConnected) {
    showToast('Not connected to OneDrive', 3000);
    return;
  }

  try {
    const picker = new window.OnedrivePicker();
    const result = await picker.pickSaveLocation(currentTitle);
    
    if (!result) return; // User cancelled

    const { filename, parentFolderId } = result;
    await saveOnedriveNew(editor.value, filename, parentFolderId);
  } catch (error) {
    console.error('OneDrive save-as failed:', error);
    showToast('Failed to save file: ' + error.message, 5000);
  }
}

/**
 * Save new file to OneDrive
 */
async function saveOnedriveNew(content, filename, parentFolderId, silent = false) {
  try {
    // Clear Drive state since user switched to OneDrive
    driveFileId = null;
    driveFileName = null;
    localFileHandle = null;

    const result = await window.onedriveClient.createFile(filename, content, parentFolderId);
    
    onedriveFileId = result.id;
    onedriveFileName = result.name;
    currentTitle = result.name.replace(/\.md$/, '');
    isDirty = false;
    updateTitle();
    
    window.onedriveClient.setFileId(result.id, result.name, parentFolderId);
    
    if (!silent) {
      showToast(`✓ Saved to OneDrive: ${result.name}`);
    }
    
    saveStatus.textContent = '✓ Saved';
    return result;
  } catch (error) {
    console.error('OneDrive save-as error:', error);
    showToast('Save failed: ' + error.message, 5000);
    throw error;
  }
}

/**
 * Auto-save to OneDrive (called periodically if file is open)
 */
async function saveToOnedrive(content, silent = false) {
  if (!onedriveConnected || !onedriveFileId) return;

  try {
    const result = await window.onedriveClient.updateFile(onedriveFileId, content);
    isDirty = false;
    
    if (!silent) {
      saveStatus.textContent = '✓ Saved to OneDrive';
    }
    
    return result;
  } catch (error) {
    console.error('OneDrive auto-save failed:', error);
    saveStatus.textContent = '✗ Save failed';
    showToast('Auto-save to OneDrive failed: ' + error.message, 5000);
  }
}

/**
 * Handle "Rename OneDrive file" button click
 */
async function handleOnedriveRename() {
  if (!onedriveFileId) return;

  const newName = prompt('New filename:', onedriveFileName);
  if (!newName || newName === onedriveFileName) return;

  try {
    const result = await window.onedriveClient.renameFile(onedriveFileId, newName);
    onedriveFileName = result.name;
    currentTitle = result.name.replace(/\.md$/, '');
    updateTitle();
    window.onedriveClient.updateFileInfo();
    
    showToast(`✓ Renamed to: ${result.name}`);
  } catch (error) {
    console.error('OneDrive rename failed:', error);
    showToast('Rename failed: ' + error.message, 5000);
  }
}

/**
 * Handle "Delete OneDrive file" button click
 */
async function handleOnedriveDelete() {
  if (!onedriveFileId) return;

  const confirmed = confirm(`Delete "${onedriveFileName}" from OneDrive?`);
  if (!confirmed) return;

  try {
    await window.onedriveClient.deleteFile(onedriveFileId);
    
    // Clear file state
    editor.value = '';
    currentTitle = 'New Document';
    onedriveFileId = null;
    onedriveFileName = null;
    isDirty = false;
    updateTitle();
    renderPreview();
    
    window.onedriveClient.clearFile();
    setOnedriveStatus('connected', 'Connected to OneDrive');
    
    showToast(`✓ Deleted from OneDrive`);
  } catch (error) {
    console.error('OneDrive delete failed:', error);
    showToast('Delete failed: ' + error.message, 5000);
  }
}

/**
 * Handle OneDrive disconnect button click
 */
async function handleOnedriveSignout() {
  try {
    await window.onedriveClient.signOut();
    
    onedriveConnected = false;
    onedriveFileId = null;
    onedriveFileName = null;
    
    setOnedriveStatus('', 'Not connected to OneDrive');
    document.getElementById('onedrive-connect-btn').style.display = 'inline-flex';
    
    showToast('✓ Disconnected from OneDrive');
  } catch (error) {
    console.error('OneDrive sign-out failed:', error);
    showToast('Sign-out failed: ' + error.message, 5000);
  }
}
```

#### 1.5g Add OneDrive Event Listeners

**Location**: After Google Drive event listeners (around line 950+), add:

```javascript
// ── OneDrive Event Listeners ───────────────────────────────────────────────────

document.getElementById('onedrive-connect-btn').addEventListener('click', handleOnedriveConnect);
document.getElementById('onedrive-open-btn').addEventListener('click', handleOnedriveOpen);
document.getElementById('onedrive-save-btn').addEventListener('click', () => {
  if (onedriveFileId) saveToOnedrive(editor.value);
});
document.getElementById('onedrive-saveas-btn').addEventListener('click', handleOnedriveSaveAs);
document.getElementById('onedrive-rename-btn').addEventListener('click', handleOnedriveRename);
document.getElementById('onedrive-delete-btn').addEventListener('click', handleOnedriveDelete);
document.getElementById('onedrive-signout-btn').addEventListener('click', handleOnedriveSignout);
```

#### 1.5h Update Auto-Save Logic

**Location**: Find the auto-save logic (around line 335-345), update to include OneDrive:

**Current**:
```javascript
if (driveConnected && driveFileId)   { await saveToDrive(content, silent); }
else if (driveConnected)             { await saveNewToDrive(content, currentTitle, silent); }
```

**Updated**:
```javascript
if (driveConnected && driveFileId)        { await saveToDrive(content, silent); }
else if (driveConnected)                  { await saveNewToDrive(content, currentTitle, silent); }
else if (onedriveConnected && onedriveFileId) { await saveToOnedrive(content, silent); }
```

#### 1.5i Update Reset Logic on New Document

**Location**: Find reset logic (around line 371-377), ensure OneDrive state is cleared:

```javascript
function newDocument() {
  editor.value = '';
  localFileHandle = null;
  driveFileId = null;
  onedriveFileId = null;
  onedriveFileName = null;
  currentTitle = 'New Document';
  isDirty = false;
  autoSaveTimer = null;
  updateTitle();
  renderPreview();
  setDriveStatus('', '');
  setOnedriveStatus('', '');
  driveFileInfo.textContent = '';
  onedriveFileInfo.textContent = '';
  saveStatus.textContent = '';
}
```

---

### 1.6 Update config.example.js

**File**: `/sessions/stoic-confident-bardeen/mnt/markdown-pwa-main/config.example.js`

This file already has the template. No changes needed, but verify these fields are present:

```javascript
MICROSOFT_CLIENT_ID: 'PLACEHOLDER_MICROSOFT_CLIENT_ID',
MICROSOFT_TENANT_ID: 'common',
MICROSOFT_REDIRECT_URI: 'http://localhost:3000/',
```

---

## Phase 2: Azure Setup

### 2.1 Create Azure App Registration

**Steps**:
1. Visit [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory → App registrations**
3. Click **New registration**
4. Fill in:
   - **Name**: `markdown-pwa-onedrive` (or your choice)
   - **Supported account types**: Select "Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"
   - **Redirect URI**: Web, `http://localhost:3000/`
5. Click **Register**

### 2.2 Copy Credentials

**From the Overview page**:
- Copy **Application (client) ID** → Set as `MICROSOFT_CLIENT_ID`
- Copy **Directory (tenant) ID** → Set as `MICROSOFT_TENANT_ID` (or use `common` for personal accounts)

### 2.3 Configure Redirect URI for Production

**In Azure Portal**:
1. Go to **Authentication** in your app registration
2. Under **Web**, add a new Redirect URI:
   - `https://yourusername.github.io/markdown-pwa-main/` (your GitHub Pages URL)
   - Include trailing slash

### 2.4 Request API Permissions (Optional, but recommended)

**In Azure Portal**:
1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Search and add:
   - `Files.ReadWrite` (already used in onedrive-client.js)
6. Click **Grant admin consent** (if available)

---

## Phase 3: Testing Phase

### 3.1 Local Development Setup

**Prerequisites**:
- Node.js installed
- `npx` available
- `serve` package (or similar static server)

**Steps**:

1. **Copy config template**:
   ```bash
   cp config.example.js config.js
   ```

2. **Edit config.js** with your credentials:
   ```javascript
   window.APP_CONFIG = {
     GOOGLE_CLIENT_ID: 'your-google-client-id...',
     GOOGLE_API_KEY: 'your-google-api-key...',
     MICROSOFT_CLIENT_ID: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
     MICROSOFT_TENANT_ID: 'common',
     MICROSOFT_REDIRECT_URI: 'http://localhost:3000/',
   };
   ```

3. **Start local server on port 3000**:
   ```bash
   npx serve . --port 3000
   ```

4. **Open in browser**:
   ```
   http://localhost:3000/
   ```

### 3.2 Test OneDrive Integration

**Connection Test**:
1. Click "Connect to OneDrive" button
2. Microsoft sign-in popup should appear
3. Sign in with your Microsoft account
4. Button should change to show connected state
5. File operation buttons should appear

**Create File Test**:
1. Type some markdown content in editor
2. Click "Save to OneDrive as..."
3. File picker should appear
4. Enter filename (e.g., `test.md`)
5. File should appear in OneDrive

**Open File Test**:
1. Click "Open from OneDrive"
2. Select the file you just created
3. Content should load in editor
4. Filename should display in status bar

**Auto-Save Test**:
1. With OneDrive file open, make a change
2. Status should briefly show "Saving..."
3. After 2 seconds, should show "✓ Saved"
4. Verify on OneDrive that changes persisted

**Rename Test**:
1. With OneDrive file open, click "Rename"
2. Enter new name
3. File should rename in OneDrive

**Delete Test**:
1. Click "Delete"
2. Confirm deletion
3. File should be removed from OneDrive

**Sign Out Test**:
1. Click "Disconnect from OneDrive"
2. Buttons should hide again
3. Status should show "Not connected"

### 3.3 Verify No Regressions

Ensure Google Drive functionality still works:
1. Click "Sign in with Google"
2. Open/save/rename/delete with Google Drive
3. Verify auto-save works
4. Switch between Drive and OneDrive files

### 3.4 Browser Console Checks

No errors should appear for:
- MSAL initialization
- Graph API calls
- CSP violations (MSAL, Graph)

Expected debug messages:
```
[MSAL] Initialized successfully
[MSAL] User signed in
OneDrive connected
```

---

## Phase 4: Deployment Phase

### 4.1 Update GitHub Actions Workflow

**File**: `/sessions/stoic-confident-bardeen/mnt/markdown-pwa-main/.github/workflows/deploy.yml`

**Current config generation section** (around line 17-29):
```yaml
- name: Generate config.js from secrets
  env:
    GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
    GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
  run: |
    cat > config.js <<EOF
    // Generated at deploy time from GitHub Actions secrets.
    window.APP_CONFIG = {
      GOOGLE_CLIENT_ID: '${GOOGLE_CLIENT_ID}',
      GOOGLE_API_KEY:   '${GOOGLE_API_KEY}',
    };
    EOF
```

**Update to**:
```yaml
- name: Generate config.js from secrets
  env:
    GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
    GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
    MICROSOFT_CLIENT_ID: ${{ secrets.MICROSOFT_CLIENT_ID }}
    MICROSOFT_TENANT_ID: ${{ secrets.MICROSOFT_TENANT_ID }}
    MICROSOFT_REDIRECT_URI: ${{ secrets.MICROSOFT_REDIRECT_URI }}
  run: |
    cat > config.js <<EOF
    // Generated at deploy time from GitHub Actions secrets.
    window.APP_CONFIG = {
      GOOGLE_CLIENT_ID: '${GOOGLE_CLIENT_ID}',
      GOOGLE_API_KEY:   '${GOOGLE_API_KEY}',
      MICROSOFT_CLIENT_ID: '${MICROSOFT_CLIENT_ID}',
      MICROSOFT_TENANT_ID: '${MICROSOFT_TENANT_ID}',
      MICROSOFT_REDIRECT_URI: '${MICROSOFT_REDIRECT_URI}',
    };
    EOF
```

### 4.2 Add GitHub Secrets

**In GitHub**:
1. Go to your repository **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Add these secrets:

| Secret Name | Value |
|---|---|
| `MICROSOFT_CLIENT_ID` | From Azure Portal (Application ID) |
| `MICROSOFT_TENANT_ID` | `common` (for personal accounts) or your tenant ID |
| `MICROSOFT_REDIRECT_URI` | `https://yourusername.github.io/markdown-pwa-main/` |

**Important**: 
- Redirect URI must have **trailing slash**
- Must be HTTPS (GitHub Pages enforces HTTPS)
- Must match exactly what's registered in Azure

### 4.3 Update Azure Redirect URI for Production

**If not already done in Phase 2.3**:
1. Azure Portal → Your app registration → Authentication
2. Under **Web**, verify the production redirect URI is registered:
   - `https://yourusername.github.io/markdown-pwa-main/`

### 4.4 Deploy

1. **Commit and push** your changes:
   ```bash
   git add index.html app.js .github/workflows/deploy.yml
   git commit -m "feat: integrate OneDrive functionality"
   git push origin main
   ```

2. **Watch the deployment**:
   - Go to repository **Actions**
   - Monitor the "Deploy to GitHub Pages" workflow
   - Should complete in ~30 seconds

3. **Verify deployment**:
   - Open your GitHub Pages URL: `https://yourusername.github.io/markdown-pwa-main/`
   - Test OneDrive connection (may see OAuth popup for GitHub Pages domain)
   - Verify all OneDrive operations work

---

## Potential Blockers & Decisions

### Blocker 1: "Redirect URI does not match" Error

**Cause**: Exact mismatch between config and Azure registration.

**Solution**:
- Verify trailing slash: `http://localhost:3000/` (local), `https://yourusername.github.io/markdown-pwa-main/` (prod)
- Check for hidden characters or typos
- Confirm Azure app registration matches exactly

### Blocker 2: MSAL Library Not Loading

**Cause**: CSP blocking MSAL CDN or network issue.

**Solution**:
- Verify `https://alcdn.msauth.net` is in CSP `script-src`
- Check browser Network tab for CDN errors
- Try hard-refresh (Ctrl+Shift+R / Cmd+Shift+R)

### Blocker 3: "Files.ReadWrite" Scope Issues

**Cause**: User denies permission or token scope mismatch.

**Solution**:
- User must explicitly grant `Files.ReadWrite` permission in sign-in flow
- Check Azure app permissions are correctly set
- Token may need re-request if scope changes

### Blocker 4: Token Expiration on GitHub Pages

**Cause**: One-hour token timeout may expire during long editing sessions.

**Solution**:
- Tokens auto-refresh via MSAL silent flow
- User sees warning at 55 minutes
- If needed, refresh page to get new token
- Consider implementing periodic silent token refresh

### Decision: Parallel vs. Abstracted Integration

**Chosen**: Parallel (Google Drive and OneDrive as separate, independent implementations)

**Rationale**:
- Simpler to understand and maintain
- No risk of cross-service bugs
- Users clearly see which service they're using
- Easier to debug issues

**If you want to unify later**, create an abstraction layer (e.g., `fileClient.js`) that both Drive and OneDrive implement.

---

## Verification Checklist

- [ ] CSP updated with MSAL and Graph API domains
- [ ] MSAL script tag added to index.html
- [ ] OneDrive UI elements added to index.html
- [ ] Script loading order: config → onedrive-client → onedrive-picker → app
- [ ] OneDrive state variables added to app.js
- [ ] setOnedriveStatus() function implemented
- [ ] OneDrive event listeners wired in app.js
- [ ] Auto-save includes OneDrive branch
- [ ] config.example.js has Microsoft fields
- [ ] Azure app registration created
- [ ] Credentials copied to local config.js
- [ ] Local testing passes all 7 tests (connection, create, open, auto-save, rename, delete, sign-out)
- [ ] No Google Drive regressions
- [ ] GitHub Actions workflow updated with MICROSOFT_* secrets
- [ ] GitHub Secrets populated
- [ ] Azure redirect URI updated for production
- [ ] Deployment successful
- [ ] Production testing passes

---

## Summary of Changes

| File | Changes | Lines |
|---|---|---|
| `index.html` | CSP, MSAL script, OneDrive UI elements, picker modal | ~15 lines CSP, 1 script, ~60 UI elements |
| `app.js` | State vars, status function, handlers, event listeners | ~200 lines |
| `.github/workflows/deploy.yml` | Config generation with OneDrive secrets | ~10 lines |
| `config.example.js` | Already has template (no changes needed) | N/A |

---

## Next Steps After Integration

1. **Update README.md** to document OneDrive support
2. **Add to CHANGELOG** or release notes
3. **Test on various browsers** (Chrome, Firefox, Safari, Edge)
4. **Monitor production** for errors in first week
5. **Gather user feedback** on OneDrive vs. Drive experience
6. **Document troubleshooting** for common user issues

