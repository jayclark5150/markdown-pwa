// ══════════════════════════════════════════════════════════════════════════════
// OneDrive Client
// ══════════════════════════════════════════════════════════════════════════════
//
// Handles authentication, file operations, and token management for Microsoft
// OneDrive personal accounts via Microsoft Graph API.
//
// Requirements:
// - MSAL Browser library (loaded in index.html)
// - MICROSOFT_CLIENT_ID, MICROSOFT_TENANT_ID, MICROSOFT_REDIRECT_URI in config.js
//

const ONEDRIVE_CONFIG = {
  SCOPES: ['Files.ReadWrite'],
  GRAPH_API_BASE: 'https://graph.microsoft.com/v1.0',
  TOKEN_TIMEOUT_MS: 60 * 60 * 1000,      // 1 hour
  TOKEN_WARNING_MS: 5 * 60 * 1000,       // 5 minutes before timeout
  SILENT_REFRESH_INTERVAL: 60 * 1000,    // Check every minute
};

// ── State ──────────────────────────────────────────────────────────────────────
let onedriveConnected = false;
let onedriveFileId = null;
let onedriveFileName = null;
let onedriveParentId = 'root';            // Current folder in picker
let onedriveAccessToken = null;
let onedriveTokenExpire = null;
let onedriveTokenClient = null;
let onedrivePublicClientApp = null;
let onedriveTokenRefreshTimer = null;
let onedriveTokenWarningTimer = null;
let onedriveTokenWarningShown = false;

// ── Initialization ─────────────────────────────────────────────────────────────

/**
 * Initialize Microsoft Authentication Library (MSAL)
 * Called once on app load if credentials are present
 */
async function initOnedriveAuth() {
  const clientId = window.APP_CONFIG?.MICROSOFT_CLIENT_ID;
  const tenantId = window.APP_CONFIG?.MICROSOFT_TENANT_ID;
  const redirectUri = window.APP_CONFIG?.MICROSOFT_REDIRECT_URI;

  if (!clientId || !tenantId || !redirectUri) {
    console.debug('OneDrive credentials not configured, skipping MSAL init');
    return;
  }

  // MSAL is loaded locally, should be available immediately
  if (!window.msal) {
    console.warn('MSAL library not loaded; OneDrive unavailable');
    return;
  }

  try {
    const msalConfig = {
      auth: {
        clientId: clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: redirectUri
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, containsPii) => {
            if (!containsPii) console.debug('[MSAL]', message);
          },
          piiLoggingEnabled: false,
          logLevel: msal.LogLevel.Verbose
        }
      }
    };

    onedrivePublicClientApp = new msal.PublicClientApplication(msalConfig);
    await onedrivePublicClientApp.initialize();

    // Check if user already has a session
    const accounts = onedrivePublicClientApp.getAllAccounts();
    if (accounts.length > 0) {
      // Try silent acquisition (user already authenticated in another tab)
      try {
        const response = await onedrivePublicClientApp.acquireTokenSilent({
          scopes: ONEDRIVE_CONFIG.SCOPES,
          account: accounts[0],
          forceRefresh: false
        });
        setOnedriveToken(response.accessToken, response.expiresOn);
        onOnedriveConnected();
      } catch (error) {
        if (error.name === 'InteractionRequiredAuthError') {
          console.debug('Interactive sign-in required for OneDrive');
        } else {
          console.error('OneDrive token acquisition failed:', error);
        }
      }
    }

    startOnedriveTokenRefreshTimer();
    console.debug('OneDrive MSAL initialized');
  } catch (error) {
    console.error('OneDrive MSAL initialization failed:', error);
    setOnedriveStatus('error', 'OneDrive setup failed');
  }
}

// ── Authentication ─────────────────────────────────────────────────────────────

/**
 * Initiate OneDrive sign-in (popup OAuth flow)
 */
async function onedriveSignIn() {
  if (!onedrivePublicClientApp) {
    showToast('OneDrive is not configured');
    return;
  }

  try {
    setOnedriveStatus('connecting', 'Signing in to OneDrive...');

    const response = await onedrivePublicClientApp.acquireTokenPopup({
      scopes: ONEDRIVE_CONFIG.SCOPES,
      forceRefresh: false
    });

    setOnedriveToken(response.accessToken, response.expiresOn);
    onOnedriveConnected();
    showToast('Connected to OneDrive');
  } catch (error) {
    setOnedriveStatus('error', 'Sign-in failed');
    showToast(`OneDrive sign-in failed: ${error.errorCode || error.message}`, 5000);
    console.error('OneDrive sign-in error:', error);
  }
}

/**
 * Sign out from OneDrive
 */
async function onedriveSignOut() {
  if (!onedrivePublicClientApp) return;

  try {
    const accounts = onedrivePublicClientApp.getAllAccounts();
    if (accounts.length > 0) {
      await onedrivePublicClientApp.logoutPopup({
        postLogoutRedirectUri: window.location.origin
      });
    }
  } catch (error) {
    console.error('OneDrive sign-out error:', error);
  }

  clearOnedriveSession();
}

/**
 * Store and manage token with expiration tracking
 */
function setOnedriveToken(accessToken, expiresOn) {
  onedriveAccessToken = accessToken;
  onedriveTokenExpire = expiresOn;
  onedriveTokenWarningShown = false;

  console.debug(
    `OneDrive token acquired, expires at ${expiresOn?.toLocaleTimeString()}`
  );
}

/**
 * Clear OneDrive session state
 */
function clearOnedriveSession() {
  onedriveConnected = false;
  onedriveFileId = null;
  onedriveFileName = null;
  onedriveAccessToken = null;
  onedriveTokenExpire = null;

  if (onedriveTokenRefreshTimer) {
    clearInterval(onedriveTokenRefreshTimer);
    onedriveTokenRefreshTimer = null;
  }
  if (onedriveTokenWarningTimer) {
    clearTimeout(onedriveTokenWarningTimer);
    onedriveTokenWarningTimer = null;
  }

  setOnedriveStatus('disconnected', 'Not connected to OneDrive');
  updateOnedriveFileInfo();
}

// ── Token Refresh ──────────────────────────────────────────────────────────────

/**
 * Start background token refresh monitor
 */
function startOnedriveTokenRefreshTimer() {
  if (onedriveTokenRefreshTimer) clearInterval(onedriveTokenRefreshTimer);

  onedriveTokenRefreshTimer = setInterval(async () => {
    if (!onedriveTokenExpire) return;

    const msUntilExpiry = onedriveTokenExpire.getTime() - Date.now();
    const warningThreshold = ONEDRIVE_CONFIG.TOKEN_WARNING_MS;
    const refreshThreshold = 2 * 60 * 1000; // Refresh 2 min before expiry

    // Show warning if approaching expiry
    if (msUntilExpiry < warningThreshold && msUntilExpiry > 0) {
      if (!onedriveTokenWarningShown) {
        onedriveTokenWarningShown = true;
        showToast(
          '⚠️ OneDrive session expiring in 5 minutes. Click to re-authenticate.',
          10000,
          () => onedriveSignIn()
        );
      }
    }

    // Refresh token if needed
    if (msUntilExpiry < refreshThreshold && msUntilExpiry > 0) {
      await refreshOnedriveToken();
    }

    // Token expired
    if (msUntilExpiry <= 0) {
      setOnedriveStatus('error', 'OneDrive session expired');
      clearOnedriveSession();
    }
  }, ONEDRIVE_CONFIG.SILENT_REFRESH_INTERVAL);
}

/**
 * Silently refresh the OneDrive access token
 */
async function refreshOnedriveToken() {
  if (!onedrivePublicClientApp) return;

  try {
    const accounts = onedrivePublicClientApp.getAllAccounts();
    if (accounts.length === 0) return;

    const response = await onedrivePublicClientApp.acquireTokenSilent({
      scopes: ONEDRIVE_CONFIG.SCOPES,
      account: accounts[0],
      forceRefresh: true
    });

    setOnedriveToken(response.accessToken, response.expiresOn);
    console.debug('OneDrive token refreshed');
  } catch (error) {
    console.warn('OneDrive token refresh failed:', error);
    // Don't disconnect; user can manually re-sign-in
  }
}

// ── File Operations ────────────────────────────────────────────────────────────

/**
 * Fetch children of a folder (for file picker)
 * @param {string} folderId - OneDrive folder ID ('root' for drive root)
 * @returns {Promise<Array>} - Array of item objects with id, name, folder, size
 */
async function onedriveListFolder(folderId = 'root') {
  if (!onedriveAccessToken) {
    throw new Error('Not authenticated with OneDrive');
  }

  try {
    const url = `${ONEDRIVE_CONFIG.GRAPH_API_BASE}/me/drive/items/${folderId}/children`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${onedriveAccessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return (data.value || [])
      .map(item => ({
        id: item.id,
        name: item.name,
        isFolder: !!item.folder,
        size: item.size || 0,
        lastModified: item.lastModifiedDateTime,
        webUrl: item.webUrl
      }))
      .sort((a, b) => {
        // Folders first, then alphabetical
        if (a.isFolder !== b.isFolder) return b.isFolder ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    console.error('OneDrive folder listing failed:', error);
    throw error;
  }
}

/**
 * Read markdown file content from OneDrive
 * @param {string} fileId - OneDrive file ID
 * @returns {Promise<string>} - File content
 */
async function onedriveReadFile(fileId) {
  if (!onedriveAccessToken) {
    throw new Error('Not authenticated with OneDrive');
  }

  try {
    const url = `${ONEDRIVE_CONFIG.GRAPH_API_BASE}/me/drive/items/${fileId}/content`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${onedriveAccessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.text();
  } catch (error) {
    console.error('OneDrive file read failed:', error);
    throw error;
  }
}

/**
 * Update existing markdown file in OneDrive
 * @param {string} fileId - OneDrive file ID
 * @param {string} content - New file content
 * @returns {Promise<Object>} - Updated file metadata
 */
async function onedriveUpdateFile(fileId, content) {
  if (!onedriveAccessToken) {
    throw new Error('Not authenticated with OneDrive');
  }

  try {
    const url = `${ONEDRIVE_CONFIG.GRAPH_API_BASE}/me/drive/items/${fileId}/content`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${onedriveAccessToken}`,
        'Content-Type': 'text/plain'
      },
      body: content
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      lastModified: data.lastModifiedDateTime
    };
  } catch (error) {
    console.error('OneDrive file update failed:', error);
    throw error;
  }
}

/**
 * Create new markdown file in OneDrive
 * @param {string} filename - Filename (should end with .md)
 * @param {string} content - File content
 * @param {string} parentFolderId - Parent folder ID ('root' for drive root)
 * @returns {Promise<Object>} - Created file metadata
 */
async function onedriveCreateFile(filename, content, parentFolderId = 'root') {
  if (!onedriveAccessToken) {
    throw new Error('Not authenticated with OneDrive');
  }

  // Ensure .md extension
  if (!filename.endsWith('.md')) {
    filename += '.md';
  }

  try {
    const url = `${ONEDRIVE_CONFIG.GRAPH_API_BASE}/me/drive/items/${parentFolderId}:/${encodeURIComponent(filename)}:/content`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${onedriveAccessToken}`,
        'Content-Type': 'text/plain'
      },
      body: content
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      lastModified: data.lastModifiedDateTime
    };
  } catch (error) {
    console.error('OneDrive file create failed:', error);
    throw error;
  }
}

/**
 * Rename file in OneDrive
 * @param {string} fileId - OneDrive file ID
 * @param {string} newName - New filename
 * @returns {Promise<Object>} - Updated file metadata
 */
async function onedriveRenameFile(fileId, newName) {
  if (!onedriveAccessToken) {
    throw new Error('Not authenticated with OneDrive');
  }

  try {
    const url = `${ONEDRIVE_CONFIG.GRAPH_API_BASE}/me/drive/items/${fileId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${onedriveAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: newName })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      lastModified: data.lastModifiedDateTime
    };
  } catch (error) {
    console.error('OneDrive file rename failed:', error);
    throw error;
  }
}

/**
 * Delete file from OneDrive
 * @param {string} fileId - OneDrive file ID
 * @returns {Promise<void>}
 */
async function onedriveDeleteFile(fileId) {
  if (!onedriveAccessToken) {
    throw new Error('Not authenticated with OneDrive');
  }

  try {
    const url = `${ONEDRIVE_CONFIG.GRAPH_API_BASE}/me/drive/items/${fileId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${onedriveAccessToken}`
      }
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    console.debug(`Deleted OneDrive file: ${fileId}`);
  } catch (error) {
    console.error('OneDrive file delete failed:', error);
    throw error;
  }
}

// ── UI State Management ────────────────────────────────────────────────────────

/**
 * Update UI to reflect OneDrive connection state
 */
function setOnedriveStatus(state, text) {
  const statusEl = document.getElementById('onedrive-status');
  const statusTextEl = document.getElementById('onedrive-status-text');

  if (!statusEl || !statusTextEl) return; // UI not ready yet

  statusEl.className = 'drive-status ' + state;
  statusTextEl.textContent = text || 'Not connected to OneDrive';

  // Update button visibility
  const isConnected = state === 'connected';
  const isFileOpen = onedriveFileId !== null;

  const connectBtn = document.getElementById('onedrive-connect-btn');
  const openBtn = document.getElementById('onedrive-open-btn');
  const saveAsBtn = document.getElementById('onedrive-saveas-btn');
  const renameBtn = document.getElementById('onedrive-rename-btn');
  const deleteBtn = document.getElementById('onedrive-delete-btn');

  if (connectBtn) connectBtn.style.display = isConnected ? 'none' : 'inline-flex';
  if (openBtn) openBtn.style.display = isConnected ? 'inline-flex' : 'none';
  if (saveAsBtn) saveAsBtn.style.display = isConnected ? 'inline-flex' : 'none';
  if (renameBtn) renameBtn.style.display = isConnected && isFileOpen ? 'inline-flex' : 'none';
  if (deleteBtn) deleteBtn.style.display = isConnected && isFileOpen ? 'inline-flex' : 'none';
}

/**
 * Update file info display in the UI
 */
function updateOnedriveFileInfo() {
  const fileInfoEl = document.getElementById('onedrive-file-info');
  if (!fileInfoEl) return;

  if (onedriveFileId && onedriveFileName) {
    fileInfoEl.textContent = `☁️ OneDrive: ${onedriveFileName}`;
  } else if (onedriveConnected) {
    fileInfoEl.textContent = '☁️ OneDrive (new)';
  } else {
    fileInfoEl.textContent = '';
  }
}

/**
 * Called when OneDrive authentication succeeds
 */
function onOnedriveConnected() {
  onedriveConnected = true;
  setOnedriveStatus('connected', 'Connected to OneDrive');
  console.debug('OneDrive connected');
}

// ── Export for use in app.js ───────────────────────────────────────────────────

// These are used by app.js for integration
window.onedriveClient = {
  // Auth
  init: initOnedriveAuth,
  signIn: onedriveSignIn,
  signOut: onedriveSignOut,

  // File ops
  listFolder: onedriveListFolder,
  readFile: onedriveReadFile,
  updateFile: onedriveUpdateFile,
  createFile: onedriveCreateFile,
  renameFile: onedriveRenameFile,
  deleteFile: onedriveDeleteFile,

  // State
  isConnected: () => onedriveConnected,
  getFileId: () => onedriveFileId,
  getFileName: () => onedriveFileName,
  setFileId: (id, name, parentId = 'root') => {
    onedriveFileId = id;
    onedriveFileName = name;
    onedriveParentId = parentId;
    updateOnedriveFileInfo();
  },
  clearFile: () => {
    onedriveFileId = null;
    onedriveFileName = null;
    updateOnedriveFileInfo();
  },

  // UI
  setStatus: setOnedriveStatus,
  updateFileInfo: updateOnedriveFileInfo
};
