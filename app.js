// ── Config ────────────────────────────────────────────────────────────────────
// Credentials are loaded from window.APP_CONFIG, which is populated by:
// 1. config.js (local development - gitignored)
// 2. GitHub Actions build process (production - injected from secrets)
// 3. Environment variable fallback (if available)
//
// For local development: Copy config.example.js to config.js and fill in your credentials.
// For deployment: Credentials are injected at build time from GitHub Secrets.
//
// ⚠️ IMPORTANT: config.js is gitignored. Never commit actual credentials.

const APP_CONFIG       = window.APP_CONFIG || {};
const GOOGLE_CLIENT_ID = APP_CONFIG.GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY   = APP_CONFIG.GOOGLE_API_KEY   || '';
const SCOPES           = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC    = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const MS_CLIENT_ID     = APP_CONFIG.MS_CLIENT_ID || '';
const GRAPH_SCOPES     = ['Files.ReadWrite'];
const GRAPH_BASE       = 'https://graph.microsoft.com/v1.0';

// Validate credentials are present
function validateCredentials() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isDev) {
      console.warn(
        '⚠️ Google credentials not found.\n\n' +
        'For local development:\n' +
        '1. Copy config.example.js to config.js\n' +
        '2. Replace PLACEHOLDER values with actual credentials from Google Cloud Console\n' +
        '3. See CREDENTIAL_ROTATION_GUIDE.md for setup instructions\n\n' +
        'For production: Credentials are injected at deploy time from GitHub Secrets.'
      );
    } else {
      console.error(
        '❌ Critical Error: Google credentials not found on production.\n' +
        'This should not happen. Check that GitHub Secrets are configured correctly.'
      );
      // Show user-friendly error
      document.body.innerHTML =
        '<div style="padding:20px;font-family:system-ui;color:#cf222e;">' +
        '<h2>Configuration Error</h2>' +
        '<p>Google credentials are not configured. The application cannot function.</p>' +
        '<p>This is likely a deployment issue. Please contact the administrator.</p>' +
        '</div>';
    }
  }
}

// Validate on load
validateCredentials();

// ── State ─────────────────────────────────────────────────────────────────────
let driveConnected    = false;
let driveFileId       = null;
let driveFileName     = null;
let currentTitle      = 'New Document';
let isDirty           = false;
let autoSaveTimer     = null;
let tokenClient       = null;
let driveFiles        = [];
let selectedDriveFile = null;
let oneDriveConnected = false;
let oneDriveFileId    = null;
let oneDriveFileName  = null;
let msalInstance      = null;
let msalAccount       = null;
let cloudPickerMode   = 'gdrive'; // which provider the shared file-picker modal targets

// ── DOM refs ──────────────────────────────────────────────────────────────────
const editor         = document.getElementById('editor');
const previewInner   = document.getElementById('preview-inner');
const previewPane    = document.getElementById('preview-pane');
const lineNumbers    = document.getElementById('line-numbers');
const tbTitle        = document.getElementById('tb-title');
const titleInput     = document.getElementById('title-input');
const driveStatus    = document.getElementById('drive-status');
const driveStatusTxt = document.getElementById('drive-status-text');
const saveStatus     = document.getElementById('save-status');
const driveFileInfo  = document.getElementById('drive-file-info');
const toast          = document.getElementById('toast');

// ── Marked setup ─────────────────────────────────────────────────────────────
if (window.marked && window.hljs) {
  marked.use({
    renderer: {
      // marked 12 calls this with positional args (code, infostring); other
      // versions pass a token object ({ text, lang }). Handle both, and never
      // pass undefined to highlight.js.
      code(codeOrToken, infostring) {
        let text, lang;
        if (codeOrToken && typeof codeOrToken === 'object') {
          text = codeOrToken.text;
          lang = codeOrToken.lang;
        } else {
          text = codeOrToken;
          lang = infostring;
        }
        text = (text == null) ? '' : String(text);
        if (lang) lang = lang.trim().split(/\s+/)[0];
        const language = (lang && hljs.getLanguage(lang)) ? lang : 'plaintext';
        const highlighted = hljs.highlight(text, { language }).value;
        return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
      }
    }
  });
}

// Harden links in sanitized output: any anchor that opens a new tab gets
// rel="noopener noreferrer" so the target page can't reach back via window.opener.
if (window.DOMPurify) {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

// ── Render preview ────────────────────────────────────────────────────────────
function renderPreview() {
  if (window.marked && window.DOMPurify) {
    try {
      previewInner.innerHTML = DOMPurify.sanitize(marked.parse(editor.value || ''));
    } catch (e) {
      console.error('Preview render failed:', e);
    }
  }
}

// ── Stats & cursor ────────────────────────────────────────────────────────────
function updateStats() {
  const text  = editor.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  document.getElementById('word-count').textContent = `Words: ${words}`;
  document.getElementById('char-count').textContent = `Chars: ${text.length}`;
}

function updateCursor() {
  const before = editor.value.slice(0, editor.selectionStart);
  const lines  = before.split('\n');
  document.getElementById('cursor-pos').textContent =
    `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
}

editor.addEventListener('input', () => {
  isDirty = true;
  renderPreview();
  updateStats();
  updateLineNumbers();
  scheduleAutoSave();
});
editor.addEventListener('click',  updateCursor);
editor.addEventListener('keyup',  updateCursor);

// ── Line numbers ──────────────────────────────────────────────────────────────
function updateLineNumbers() {
  const lines = editor.value.split('\n').length;
  lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
}

// Sync scroll between line numbers and editor
editor.addEventListener('scroll', () => {
  lineNumbers.scrollTop = editor.scrollTop;
});

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, duration = 2500) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ── Title editing ─────────────────────────────────────────────────────────────
tbTitle.addEventListener('click', () => {
  titleInput.value = currentTitle;
  tbTitle.style.display = 'none';
  titleInput.style.display = 'inline-block';
  titleInput.focus();
  titleInput.select();
});

titleInput.addEventListener('blur', commitTitle);
titleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  commitTitle();
  if (e.key === 'Escape') { titleInput.style.display = 'none'; tbTitle.style.display = ''; }
});

function commitTitle() {
  const v = titleInput.value.trim();
  if (v) {
    currentTitle = v.endsWith('.md') || v.endsWith('.txt') ? v : v + '.md';
    tbTitle.textContent = currentTitle;
    if (driveFileId)    driveFileName    = currentTitle;
    if (oneDriveFileId) oneDriveFileName = currentTitle;
  }
  titleInput.style.display = 'none';
  tbTitle.style.display = '';
}

function setTitle(name) {
  currentTitle = name;
  tbTitle.textContent = name;
}

// ── Drive status display ──────────────────────────────────────────────────────
const toolbarDriveDot = document.getElementById('toolbar-drive-dot');
const toolbarDriveTip = document.getElementById('toolbar-drive-tip');

function setDriveStatus(state, text) {
  driveStatus.className = 'drive-status ' + state;
  driveStatusTxt.textContent = text;
  toolbarDriveDot.className = state || '';
  if (toolbarDriveTip) toolbarDriveTip.textContent = text || 'Not connected to Drive';

  // Show/hide Drive action buttons based on connection state and file open status
  const isFileOpen = driveFileId !== null;
  document.getElementById('drive-saveas-btn').style.display  = state === 'connected' ? 'inline-flex' : 'none';
  document.getElementById('drive-rename-btn').style.display  = state === 'connected' && isFileOpen ? 'inline-flex' : 'none';
  document.getElementById('drive-delete-btn').style.display  = state === 'connected' && isFileOpen ? 'inline-flex' : 'none';
}

// ── Zoom controls ─────────────────────────────────────────────────────────────
let zoomLevel = 1.0;
const ZOOM_STEP = 0.1;
const ZOOM_MIN  = 0.5;
const ZOOM_MAX  = 2.0;

function applyZoom() {
  previewInner.style.transform = `scale(${zoomLevel})`;
  previewInner.style.width     = `${100 / zoomLevel}%`;
  document.getElementById('zoom-pct').textContent = Math.round(zoomLevel * 100) + '%';
}

document.getElementById('zoom-in-btn').addEventListener('click',    () => { zoomLevel = Math.min(ZOOM_MAX, +(zoomLevel + ZOOM_STEP).toFixed(1)); applyZoom(); });
document.getElementById('zoom-out-btn').addEventListener('click',   () => { zoomLevel = Math.max(ZOOM_MIN, +(zoomLevel - ZOOM_STEP).toFixed(1)); applyZoom(); });
document.getElementById('zoom-reset-btn').addEventListener('click', () => { zoomLevel = 1.0; applyZoom(); });

// ── Auto-save ─────────────────────────────────────────────────────────────────
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  if (!driveConnected && !oneDriveConnected) return;
  saveStatus.textContent = 'Unsaved…';
  autoSaveTimer = setTimeout(async () => { await performSave(true); }, 2000);
}

async function performSave(silent = false) {
  if (!isDirty) return;
  const content = editor.value;
  if (driveConnected && driveFileId)            { await saveToDrive(content, silent); }
  else if (oneDriveConnected && oneDriveFileId) { await saveToOneDrive(content, silent); }
  else if (driveConnected)                      { await saveNewToDrive(content, currentTitle, silent); }
  else if (oneDriveConnected)                   { await saveToOneDrive(content, silent); }
  else if (localFileHandle)                     { await localSave(); }
  else if (!silent)                             { await localSave(); }
}

// ── New file ──────────────────────────────────────────────────────────────────
document.getElementById('new-btn').addEventListener('click', () => {
  if (isDirty && !confirm('You have unsaved changes. Create new document anyway?')) return;
  openNewModal();
});

function openNewModal() {
  document.getElementById('new-filename').value = '';
  document.getElementById('new-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-filename').focus(), 50);
}

document.getElementById('new-modal-cancel').addEventListener('click', () => {
  document.getElementById('new-modal').classList.remove('open');
});
document.getElementById('new-modal-ok').addEventListener('click', createNewDoc);
document.getElementById('new-filename').addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  createNewDoc();
  if (e.key === 'Escape') document.getElementById('new-modal').classList.remove('open');
});

function createNewDoc() {
  let name = document.getElementById('new-filename').value.trim() || 'untitled.md';
  if (!name.includes('.')) name += '.md';
  document.getElementById('new-modal').classList.remove('open');
  editor.value     = '';
  setTitle(name);
  driveFileId      = null;
  driveFileName    = null;
  oneDriveFileId   = null;
  oneDriveFileName = null;
  isDirty          = false;
  saveStatus.textContent    = '';
  driveFileInfo.textContent = driveConnected ? '☁ Drive (new)' : (oneDriveConnected ? '☁ OneDrive (new)' : '');
  renderPreview(); updateStats(); updateCursor(); updateLineNumbers();
}

// ── Google Drive ──────────────────────────────────────────────────────────────
async function initGoogleApi() {
  return new Promise((resolve, reject) => {
    gapi.load('client', async () => {
      try {
        await gapi.client.init({ apiKey: GOOGLE_API_KEY, discoveryDocs: [DISCOVERY_DOC] });
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

// gapi/Google errors are nested objects; pull out something human-readable.
function gErr(e) {
  if (!e) return 'unknown error';
  return (e.result && e.result.error && e.result.error.message) ||
         e.details || e.message ||
         (typeof e === 'string' ? e : JSON.stringify(e));
}

// Create the GSI token client once. This is synchronous config only — safe to
// call inside a click handler so the OAuth popup opens within the user gesture.
function ensureTokenClient() {
  if (tokenClient) return tokenClient;
  if (!window.google || !google.accounts || !google.accounts.oauth2) return null;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: async (response) => {
      if (response.error) { setDriveStatus('error', 'Auth failed'); showToast('Google sign-in failed: ' + response.error); return; }
      try {
        await initGoogleApi();                                  // load Drive client lib now that we have a token
        gapi.client.setToken({ access_token: response.access_token });
        onDriveConnected();
      } catch (e) {
        console.error('Drive init failed:', e);
        setDriveStatus('error', 'Setup failed');
        showToast('Drive setup failed: ' + gErr(e), 5000);
      }
    },
  });
  return tokenClient;
}

function onDriveConnected() {
  driveConnected = true;
  setDriveStatus('connected', 'Drive connected');
  document.getElementById('drive-signin-btn').style.display  = 'none';
  document.getElementById('drive-open-btn').style.display    = '';
  document.getElementById('drive-save-btn').style.display    = '';
  document.getElementById('drive-signout-btn').style.display = '';
  // Header dropdown: hide "Connect", reveal "Sign out" (mirrors OneDrive)
  document.getElementById('hdr-drive-connect').style.display  = 'none';
  document.getElementById('hdr-drive-signout').style.display  = '';
  if (!driveFileId) driveFileInfo.textContent = '☁ Drive (new)';
  showToast('✓ Connected to Google Drive');
  fetchDriveFiles();
}

document.getElementById('drive-signin-btn').addEventListener('click', () => {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_')) {
    showToast('⚠ Add your Google credentials in config.js first', 4000); return;
  }
  const client = ensureTokenClient();
  if (!client) {
    showToast('Google sign-in library not loaded yet — check your connection and retry', 4000); return;
  }
  // Called synchronously within the click so the browser allows the popup.
  client.requestAccessToken({ prompt: 'consent' });
});

document.getElementById('drive-signout-btn').addEventListener('click', () => {
  const token = gapi.client.getToken();
  if (token) google.accounts.oauth2.revoke(token.access_token);
  gapi.client.setToken('');
  driveConnected = false;
  driveFileId    = null;
  driveFileName  = null;
  setDriveStatus('', 'Not connected to Drive');
  document.getElementById('drive-signin-btn').style.display  = '';
  document.getElementById('drive-open-btn').style.display    = 'none';
  document.getElementById('drive-save-btn').style.display    = 'none';
  document.getElementById('drive-signout-btn').style.display = 'none';
  // Header dropdown: restore "Connect", hide "Sign out"
  document.getElementById('hdr-drive-connect').style.display  = '';
  document.getElementById('hdr-drive-signout').style.display  = 'none';
  driveFileInfo.textContent = '';
  showToast('Signed out of Google Drive');
});

async function fetchDriveFiles(query = '') {
  try {
    setDriveStatus('saving', 'Loading files…');
    let q = "mimeType='text/plain' or mimeType='text/markdown' or fileExtension='md'";
    if (query) {
      // Escape backslashes and single quotes to prevent Drive query injection
      const safeQuery = query.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      q = `name contains '${safeQuery}' and (${q})`;
    }
    q += " and trashed=false";
    const res = await gapi.client.drive.files.list({ q, fields: 'files(id,name,modifiedTime,size)', orderBy: 'modifiedTime desc', pageSize: 50 });
    driveFiles = res.result.files || [];
    setDriveStatus('connected', 'Drive connected');
    return driveFiles;
  } catch (e) {
    setDriveStatus('error', 'Load failed');
    showToast('Could not load Drive files: ' + e.message);
    return [];
  }
}

document.getElementById('drive-open-btn').addEventListener('click', async () => {
  cloudPickerMode = 'gdrive';
  document.getElementById('cloud-modal-title').textContent = '📂 Open from Google Drive';
  await fetchDriveFiles();
  renderDriveFileList(driveFiles);
  document.getElementById('drive-modal').classList.add('open');
  document.getElementById('drive-search').value = '';
  selectedDriveFile = null;
});

document.getElementById('drive-modal-cancel').addEventListener('click', () => {
  document.getElementById('drive-modal').classList.remove('open');
});

document.getElementById('drive-search').addEventListener('input', async (e) => {
  const q = e.target.value.trim();
  let files;
  if (cloudPickerMode === 'onedrive') {
    files = await fetchOneDriveFiles(q);
  } else {
    files = q ? await fetchDriveFiles(q) : driveFiles;
  }
  renderDriveFileList(files);
});

function renderDriveFileList(files) {
  const list = document.getElementById('drive-file-list');
  if (!files.length) {
    list.innerHTML = '<div class="file-item" style="color:var(--text2);cursor:default">No markdown files found</div>';
    return;
  }
  list.innerHTML = '';
  files.forEach(f => {
    const row = document.createElement('div');
    row.className = 'file-item';
    row.dataset.id = f.id;
    row.dataset.name = f.name;
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = '📄';
    const nameEl = document.createElement('span');
    nameEl.className = 'file-name';
    nameEl.textContent = f.name;
    const dateEl = document.createElement('span');
    dateEl.className = 'file-date';
    dateEl.textContent = new Date(f.modifiedTime).toLocaleDateString();
    row.append(icon, nameEl, dateEl);
    list.appendChild(row);
  });
  list.querySelectorAll('.file-item').forEach(el => {
    el.addEventListener('click', () => {
      list.querySelectorAll('.file-item').forEach(i => i.classList.remove('selected'));
      el.classList.add('selected');
      selectedDriveFile = { id: el.dataset.id, name: el.dataset.name };
    });
    el.addEventListener('dblclick', () => {
      selectedDriveFile = { id: el.dataset.id, name: el.dataset.name };
      openSelectedDriveFile();
    });
  });
}

document.getElementById('drive-modal-open').addEventListener('click', openSelectedDriveFile);

async function openSelectedDriveFile() {
  if (!selectedDriveFile) { showToast('Select a file first'); return; }
  document.getElementById('drive-modal').classList.remove('open');
  if (cloudPickerMode === 'onedrive') {
    await loadOneDriveFile(selectedDriveFile.id, selectedDriveFile.name);
  } else {
    await loadDriveFile(selectedDriveFile.id, selectedDriveFile.name);
  }
}

async function loadDriveFile(fileId, fileName) {
  try {
    setDriveStatus('saving', 'Loading…');
    const res = await gapi.client.drive.files.get({ fileId, alt: 'media' });
    editor.value    = res.body;
    driveFileId     = fileId;
    driveFileName   = fileName;
    oneDriveFileId   = null;
    oneDriveFileName = null;
    setTitle(fileName);
    isDirty = false;
    saveStatus.textContent    = 'Opened from Drive';
    driveFileInfo.textContent = '☁ Google Drive';
    setDriveStatus('connected', 'Drive connected');
    renderPreview(); updateStats(); updateCursor(); updateLineNumbers();
    showToast('✓ Opened ' + fileName);
  } catch (e) {
    setDriveStatus('error', 'Load failed');
    showToast('Could not open file: ' + e.message);
  }
}

document.getElementById('drive-save-btn').addEventListener('click', () => performSave(false));

// Save As
document.getElementById('drive-saveas-btn').addEventListener('click', () => {
  document.getElementById('drive-action-title').textContent = 'Save As';
  document.getElementById('drive-action-input').value = driveFileName || currentTitle;
  document.getElementById('drive-action-input').placeholder = 'New filename';
  document.getElementById('drive-action-modal').classList.add('open');
  document.getElementById('drive-action-input').focus();

  document.getElementById('drive-action-confirm').onclick = async () => {
    const newName = document.getElementById('drive-action-input').value.trim();
    if (!newName) {
      showToast('Please enter a filename');
      return;
    }

    // Add .md extension if not present
    const filename = newName.endsWith('.md') ? newName : `${newName}.md`;

    document.getElementById('drive-action-modal').classList.remove('open');
    await saveAsNewFile(filename);
  };
});

// Rename
document.getElementById('drive-rename-btn').addEventListener('click', () => {
  document.getElementById('drive-action-title').textContent = 'Rename File';
  document.getElementById('drive-action-input').value = driveFileName || currentTitle;
  document.getElementById('drive-action-input').placeholder = 'New filename';
  document.getElementById('drive-action-modal').classList.add('open');
  document.getElementById('drive-action-input').focus();

  document.getElementById('drive-action-confirm').onclick = async () => {
    const newName = document.getElementById('drive-action-input').value.trim();
    if (!newName) {
      showToast('Please enter a filename');
      return;
    }

    // Add .md extension if not present
    const filename = newName.endsWith('.md') ? newName : `${newName}.md`;

    document.getElementById('drive-action-modal').classList.remove('open');
    await renameDriveFile(filename);
  };
});

// Delete
document.getElementById('drive-delete-btn').addEventListener('click', deleteDriveFile);

// Modal cancel button
document.getElementById('drive-action-cancel').addEventListener('click', () => {
  document.getElementById('drive-action-modal').classList.remove('open');
});

// Allow Enter key in modal
document.getElementById('drive-action-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('drive-action-confirm').click();
  } else if (e.key === 'Escape') {
    document.getElementById('drive-action-modal').classList.remove('open');
  }
});

async function saveToDrive(content, silent = false) {
  try {
    setDriveStatus('saving', 'Saving…');
    const boundary = '-------314159265358979323846';
    const metadata = JSON.stringify({ name: driveFileName || currentTitle, mimeType: 'text/markdown' });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n${content}\r\n--${boundary}--`;
    await gapi.client.request({ path: `/upload/drive/v3/files/${driveFileId}`, method: 'PATCH', params: { uploadType: 'multipart' }, headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` }, body });
    isDirty = false;
    saveStatus.textContent = silent ? `Saved ${new Date().toLocaleTimeString()}` : 'Saved to Drive';
    setDriveStatus('connected', 'Drive connected');
    if (!silent) showToast('✓ Saved to Google Drive');
  } catch (e) {
    setDriveStatus('error', 'Save failed');
    showToast('Drive save failed: ' + e.message);
  }
}

async function saveNewToDrive(content, filename, silent = false) {
  try {
    setDriveStatus('saving', 'Saving…');
    const boundary = '-------314159265358979323846';
    const metadata = JSON.stringify({ name: filename, mimeType: 'text/markdown' });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n${content}\r\n--${boundary}--`;
    const res = await gapi.client.request({ path: '/upload/drive/v3/files', method: 'POST', params: { uploadType: 'multipart' }, headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` }, body });
    driveFileId   = res.result.id;
    driveFileName = filename;
    isDirty = false;
    saveStatus.textContent    = 'Saved to Drive';
    driveFileInfo.textContent = '☁ Google Drive';
    setDriveStatus('connected', 'Drive connected');
    if (!silent) showToast('✓ Saved to Google Drive');
    fetchDriveFiles();
  } catch (e) {
    setDriveStatus('error', 'Save failed');
    showToast('Drive save failed: ' + e.message);
  }
}

// ── Google Drive: Save As, Rename, Delete ─────────────────────────────────────

async function saveAsNewFile(newName) {
  if (!editor.value) {
    showToast('Nothing to save');
    return;
  }

  try {
    setDriveStatus('saving', 'Saving as…');

    const boundary = '-------314159265358979323846';
    const metadata = JSON.stringify({ name: newName, mimeType: 'text/markdown' });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n${editor.value}\r\n--${boundary}--`;

    const res = await gapi.client.request({
      path: '/upload/drive/v3/files',
      method: 'POST',
      params: { uploadType: 'multipart' },
      headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body
    });

    // Update state to point to the new file
    driveFileId   = res.result.id;
    driveFileName = newName;
    currentTitle  = newName;
    isDirty       = false;

    driveFileInfo.textContent = `☁ ${newName}`;
    saveStatus.textContent    = 'Saved to Drive';
    setDriveStatus('connected', 'Drive connected');
    showToast(`✓ Saved as "${newName}" to Google Drive`);

    fetchDriveFiles(); // Refresh the file list
  } catch (e) {
    setDriveStatus('error', 'Save As failed');
    showToast('Drive Save As failed: ' + e.message);
  }
}

async function renameDriveFile(newName) {
  if (!driveFileId) {
    showToast('No file open');
    return;
  }

  try {
    setDriveStatus('saving', 'Renaming…');

    // Update file metadata on Drive
    await gapi.client.drive.files.update({
      fileId: driveFileId,
      resource: { name: newName }
    });

    driveFileName = newName;
    currentTitle  = newName;
    driveFileInfo.textContent = `☁ ${newName}`;

    setDriveStatus('connected', 'Drive connected');
    showToast(`✓ File renamed to "${newName}"`);
    fetchDriveFiles(); // Refresh the file list
  } catch (e) {
    setDriveStatus('error', 'Rename failed');
    showToast('Drive rename failed: ' + e.message);
  }
}

async function deleteDriveFile() {
  if (!driveFileId) {
    showToast('No file open');
    return;
  }

  const confirmed = confirm(`Delete "${driveFileName}" from Google Drive? This cannot be undone.`);
  if (!confirmed) return;

  try {
    setDriveStatus('saving', 'Deleting…');
    await gapi.client.drive.files.delete({ fileId: driveFileId });

    // Reset state
    driveFileId   = null;
    driveFileName = null;
    currentTitle  = 'New Document';
    isDirty       = false;
    editor.value  = '';

    driveFileInfo.textContent = '';
    saveStatus.textContent    = '';
    setDriveStatus('connected', 'Drive connected');
    showToast('✓ File deleted from Google Drive');

    renderPreview();
    updateStats();
    fetchDriveFiles(); // Refresh the file list
  } catch (e) {
    setDriveStatus('error', 'Delete failed');
    showToast('Drive delete failed: ' + e.message);
  }
}

// ── OneDrive (Microsoft Graph) ────────────────────────────────────────────────
// Auth is handled by MSAL.js (SPA + PKCE, no client secret). Tokens live in
// sessionStorage for the tab session only; file I/O goes through Graph.

async function ensureMsal() {
  if (msalInstance) return msalInstance;
  if (!window.msal || !MS_CLIENT_ID) return null;
  const inst = new msal.PublicClientApplication({
    auth: {
      clientId: MS_CLIENT_ID,
      // 'common' allows both work/school and personal Microsoft accounts.
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin + window.location.pathname,
    },
    cache: { cacheLocation: 'sessionStorage' },
  });
  await inst.initialize();
  msalInstance = inst;
  return inst;
}

async function getGraphToken() {
  if (!msalInstance || !msalAccount) throw new Error('Not signed in to OneDrive');
  try {
    const r = await msalInstance.acquireTokenSilent({ scopes: GRAPH_SCOPES, account: msalAccount });
    return r.accessToken;
  } catch (_) {
    const r = await msalInstance.acquireTokenPopup({ scopes: GRAPH_SCOPES, account: msalAccount });
    return r.accessToken;
  }
}

async function graphFetch(path, opts = {}) {
  const token = await getGraphToken();
  const res = await fetch(GRAPH_BASE + path, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token },
  });
  if (!res.ok) {
    let msg = res.status + ' ' + res.statusText;
    try {
      const j = await res.json();
      if (j.error && j.error.message) msg = j.error.message;
    } catch (_) {}
    throw new Error(msg);
  }
  return res;
}

async function connectOneDrive() {
  if (!MS_CLIENT_ID || MS_CLIENT_ID.includes('PLACEHOLDER')) {
    showToast('⚠ Add your MS_CLIENT_ID in config.js first', 4000); return;
  }
  const inst = await ensureMsal();
  if (!inst) {
    showToast('Microsoft sign-in library not loaded yet — check your connection and retry', 4000); return;
  }
  try {
    const result = await inst.loginPopup({ scopes: GRAPH_SCOPES, prompt: 'select_account' });
    msalAccount = result.account;
    onOneDriveConnected();
  } catch (e) {
    if (e && e.errorCode === 'user_cancelled') return;
    showToast('Microsoft sign-in failed: ' + (e.message || e), 5000);
  }
}

function onOneDriveConnected() {
  oneDriveConnected = true;
  document.getElementById('hdr-onedrive-connect').style.display = 'none';
  document.getElementById('hdr-onedrive-open').style.display    = '';
  document.getElementById('hdr-onedrive-save').style.display    = '';
  document.getElementById('hdr-onedrive-saveas').style.display  = '';
  document.getElementById('hdr-onedrive-rename').style.display  = '';
  document.getElementById('hdr-onedrive-signout').style.display = '';
  if (!driveConnected && !oneDriveFileId) driveFileInfo.textContent = '☁ OneDrive (new)';
  showToast('✓ Connected to OneDrive');
}

async function fetchOneDriveFiles(query = '') {
  try {
    // Graph has no name-suffix filter, so search then filter client-side.
    const q = (query || '.md').replace(/'/g, "''");
    const res = await graphFetch(
      `/me/drive/root/search(q='${encodeURIComponent(q)}')?$top=50&$select=id,name,lastModifiedDateTime,file`
    );
    const items = (await res.json()).value || [];
    return items
      .filter(f => f.file && /\.(md|markdown|txt)$/i.test(f.name))
      .map(f => ({ id: f.id, name: f.name, modifiedTime: f.lastModifiedDateTime }))
      .sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
  } catch (e) {
    showToast('Could not load OneDrive files: ' + e.message);
    return [];
  }
}

async function loadOneDriveFile(fileId, fileName) {
  try {
    const res = await graphFetch(`/me/drive/items/${fileId}/content`);
    editor.value     = await res.text();
    oneDriveFileId   = fileId;
    oneDriveFileName = fileName;
    driveFileId      = null;
    driveFileName    = null;
    setTitle(fileName);
    isDirty = false;
    saveStatus.textContent    = 'Opened from OneDrive';
    driveFileInfo.textContent = '☁ OneDrive';
    renderPreview(); updateStats(); updateCursor(); updateLineNumbers();
    showToast('✓ Opened ' + fileName);
  } catch (e) {
    showToast('Could not open file: ' + e.message);
  }
}

async function saveAsToOneDrive(newName) {
  if (!editor.value) { showToast('Nothing to save'); return; }
  try {
    saveStatus.textContent = 'Saving as…';
    const res  = await graphFetch(`/me/drive/root:/${encodeURIComponent(newName)}:/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/markdown' },
      body: editor.value,
    });
    const item = await res.json();
    oneDriveFileId   = item.id;
    oneDriveFileName = item.name;
    driveFileId      = null;
    driveFileName    = null;
    currentTitle     = item.name;
    tbTitle.textContent = item.name;
    isDirty = false;
    saveStatus.textContent    = 'Saved to OneDrive';
    driveFileInfo.textContent = `☁ ${item.name}`;
    showToast(`✓ Saved as "${item.name}" to OneDrive`);
  } catch (e) {
    saveStatus.textContent = 'Save As failed';
    showToast('OneDrive Save As failed: ' + e.message);
  }
}

async function renameOneDriveFile(newName) {
  if (!oneDriveFileId) { showToast('No OneDrive file open'); return; }
  try {
    saveStatus.textContent = 'Renaming…';
    const res  = await graphFetch(`/me/drive/items/${oneDriveFileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    const item = await res.json();
    oneDriveFileName = item.name;
    currentTitle     = item.name;
    tbTitle.textContent = item.name;
    saveStatus.textContent    = '';
    driveFileInfo.textContent = `☁ ${item.name}`;
    showToast(`✓ File renamed to "${item.name}"`);
  } catch (e) {
    saveStatus.textContent = 'Rename failed';
    showToast('OneDrive rename failed: ' + e.message);
  }
}

async function saveToOneDrive(content, silent = false) {
  try {
    saveStatus.textContent = 'Saving…';
    // Existing files are addressed by id; new files by path under the drive root.
    const path = oneDriveFileId
      ? `/me/drive/items/${oneDriveFileId}/content`
      : `/me/drive/root:/${encodeURIComponent(oneDriveFileName || currentTitle)}:/content`;
    const res  = await graphFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/markdown' },
      body: content,
    });
    const item = await res.json();
    oneDriveFileId   = item.id;
    oneDriveFileName = item.name;
    isDirty = false;
    saveStatus.textContent    = silent ? `Saved ${new Date().toLocaleTimeString()}` : 'Saved to OneDrive';
    driveFileInfo.textContent = '☁ OneDrive';
    if (!silent) showToast('✓ Saved to OneDrive');
  } catch (e) {
    saveStatus.textContent = 'Save failed';
    showToast('OneDrive save failed: ' + e.message);
  }
}

document.getElementById('hdr-onedrive-connect').addEventListener('click', () => {
  document.getElementById('hdr-more-menu').classList.remove('open');
  connectOneDrive();
});

document.getElementById('hdr-onedrive-open').addEventListener('click', async () => {
  document.getElementById('hdr-more-menu').classList.remove('open');
  cloudPickerMode = 'onedrive';
  document.getElementById('cloud-modal-title').textContent = '📂 Open from OneDrive';
  document.getElementById('drive-file-list').innerHTML =
    '<div class="file-item" style="color:var(--text2);cursor:default">Loading files…</div>';
  document.getElementById('drive-search').value = '';
  selectedDriveFile = null;
  document.getElementById('drive-modal').classList.add('open');
  renderDriveFileList(await fetchOneDriveFiles());
});

document.getElementById('hdr-onedrive-save').addEventListener('click', () => {
  document.getElementById('hdr-more-menu').classList.remove('open');
  saveToOneDrive(editor.value, false);
});

document.getElementById('hdr-onedrive-saveas').addEventListener('click', () => {
  document.getElementById('hdr-more-menu').classList.remove('open');
  document.getElementById('drive-action-title').textContent = 'Save As to OneDrive';
  document.getElementById('drive-action-input').value = oneDriveFileName || currentTitle;
  document.getElementById('drive-action-input').placeholder = 'New filename';
  document.getElementById('drive-action-modal').classList.add('open');
  document.getElementById('drive-action-input').focus();

  document.getElementById('drive-action-confirm').onclick = async () => {
    const newName = document.getElementById('drive-action-input').value.trim();
    if (!newName) { showToast('Please enter a filename'); return; }
    const filename = newName.endsWith('.md') ? newName : `${newName}.md`;
    document.getElementById('drive-action-modal').classList.remove('open');
    await saveAsToOneDrive(filename);
  };
});

document.getElementById('hdr-onedrive-rename').addEventListener('click', () => {
  document.getElementById('hdr-more-menu').classList.remove('open');
  if (!oneDriveFileId) { showToast('No OneDrive file open'); return; }
  document.getElementById('drive-action-title').textContent = 'Rename OneDrive File';
  document.getElementById('drive-action-input').value = oneDriveFileName || currentTitle;
  document.getElementById('drive-action-input').placeholder = 'New filename';
  document.getElementById('drive-action-modal').classList.add('open');
  document.getElementById('drive-action-input').focus();

  document.getElementById('drive-action-confirm').onclick = async () => {
    const newName = document.getElementById('drive-action-input').value.trim();
    if (!newName) { showToast('Please enter a filename'); return; }
    const filename = newName.endsWith('.md') ? newName : `${newName}.md`;
    document.getElementById('drive-action-modal').classList.remove('open');
    await renameOneDriveFile(filename);
  };
});

document.getElementById('hdr-onedrive-signout').addEventListener('click', async () => {
  document.getElementById('hdr-more-menu').classList.remove('open');
  try { if (msalInstance) await msalInstance.clearCache({ account: msalAccount }); } catch (_) {}
  msalAccount       = null;
  oneDriveConnected = false;
  oneDriveFileId    = null;
  oneDriveFileName  = null;
  document.getElementById('hdr-onedrive-connect').style.display = '';
  document.getElementById('hdr-onedrive-open').style.display    = 'none';
  document.getElementById('hdr-onedrive-save').style.display    = 'none';
  document.getElementById('hdr-onedrive-saveas').style.display  = 'none';
  document.getElementById('hdr-onedrive-rename').style.display  = 'none';
  document.getElementById('hdr-onedrive-signout').style.display = 'none';
  if (!driveConnected) driveFileInfo.textContent = '';
  showToast('Signed out of OneDrive');
});

// Initialize MSAL eagerly so the sign-in popup opens synchronously on click,
// and restore the session if this tab already signed in (sessionStorage cache).
if (MS_CLIENT_ID && !MS_CLIENT_ID.includes('PLACEHOLDER')) {
  ensureMsal().then(inst => {
    if (!inst) return;
    const accounts = inst.getAllAccounts();
    if (accounts.length) {
      msalAccount = accounts[0];
      onOneDriveConnected();
    }
  }).catch(console.error);
}

// ── List continuation ─────────────────────────────────────────────────────────
editor.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;

  const start     = editor.selectionStart;
  const value     = editor.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd   = value.indexOf('\n', start);
  const line      = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);

  const unordered = line.match(/^(\s*)([-*+]) /);
  const ordered   = line.match(/^(\s*)(\d+)\. /);
  const match     = unordered || ordered;
  if (!match) return;

  const prefix  = match[0];
  const content = line.slice(prefix.length).trim();

  e.preventDefault();

  if (content === '') {
    // Empty list item — exit the list, remove prefix
    const newValue  = value.slice(0, lineStart) + '\n' + value.slice(lineStart + prefix.length);
    editor.value    = newValue;
    editor.setSelectionRange(lineStart + 1, lineStart + 1);
  } else {
    // Continue list on next line
    let newPrefix;
    if (ordered) {
      newPrefix = ordered[1] + (parseInt(ordered[2], 10) + 1) + '. ';
    } else {
      newPrefix = unordered[1] + unordered[2] + ' ';
    }
    const insert    = '\n' + newPrefix;
    const newValue  = value.slice(0, start) + insert + value.slice(start);
    const newCursor = start + insert.length;
    editor.value    = newValue;
    editor.setSelectionRange(newCursor, newCursor);
  }

  isDirty = true;
  renderPreview(); updateStats(); updateLineNumbers(); updateCursor();
  scheduleAutoSave();
});

// ── Find & Replace ────────────────────────────────────────────────────────────
const findBar      = document.getElementById('find-replace-bar');
const findInput    = document.getElementById('find-input');
const replaceInput = document.getElementById('replace-input');
const matchInfo    = document.getElementById('match-info');

let findMatches = [];
let findIndex   = -1;

function openFindBar() {
  findBar.classList.add('visible');
  findInput.focus();
  findInput.select();
  if (findInput.value) runFind();
}
function closeFindBar() {
  findBar.classList.remove('visible');
  findMatches = []; findIndex = -1;
  matchInfo.textContent = '';
  findInput.classList.remove('no-match');
  editor.focus();
}
function runFind() {
  matchInfo.textContent = '';
  findMatches = []; findIndex = -1;
  findInput.classList.remove('no-match');
  const q = findInput.value;
  if (!q) return;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let m;
  while ((m = re.exec(editor.value)) !== null) findMatches.push(m.index);
  if (!findMatches.length) { findInput.classList.add('no-match'); matchInfo.textContent = 'No results'; return; }
  findIndex = 0;
  highlightMatch();
}
function highlightMatch() {
  if (!findMatches.length) return;
  const pos = findMatches[findIndex];
  editor.focus();
  editor.setSelectionRange(pos, pos + findInput.value.length);
  matchInfo.textContent = `${findIndex + 1} / ${findMatches.length}`;
  const linesBefore = editor.value.slice(0, pos).split('\n').length;
  const lineHeight  = parseFloat(getComputedStyle(editor).lineHeight) || 24;
  editor.scrollTop  = Math.max(0, (linesBefore - 4) * lineHeight);
}
function findNext() { if (!findMatches.length) { runFind(); return; } findIndex = (findIndex + 1) % findMatches.length; highlightMatch(); }
function findPrev() { if (!findMatches.length) { runFind(); return; } findIndex = (findIndex - 1 + findMatches.length) % findMatches.length; highlightMatch(); }

function doReplace() {
  if (!findMatches.length) { runFind(); return; }
  const pos = findMatches[findIndex];
  editor.focus();
  editor.setSelectionRange(pos, pos + findInput.value.length);
  document.execCommand('insertText', false, replaceInput.value);
  isDirty = true; renderPreview(); updateStats();
  runFind();
}
function doReplaceAll() {
  const q = findInput.value;
  if (!q) return;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const count = (editor.value.match(re) || []).length;
  editor.value = editor.value.replace(re, replaceInput.value);
  isDirty = true; renderPreview(); updateStats(); updateLineNumbers();
  showToast(`✓ Replaced ${count} occurrence${count !== 1 ? 's' : ''}`);
  runFind();
}

document.getElementById('find-btn').addEventListener('click',        openFindBar);
document.getElementById('find-close-btn').addEventListener('click',  closeFindBar);
document.getElementById('find-next-btn').addEventListener('click',   findNext);
document.getElementById('find-prev-btn').addEventListener('click',   findPrev);
document.getElementById('replace-btn').addEventListener('click',     doReplace);
document.getElementById('replace-all-btn').addEventListener('click', doReplaceAll);

findInput.addEventListener('input', runFind);
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  { e.shiftKey ? findPrev() : findNext(); }
  if (e.key === 'Escape') closeFindBar();
});
replaceInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  doReplace();
  if (e.key === 'Escape') closeFindBar();
});

// ── Focus Mode (WYSIWYG + Typewriter) ────────────────────────────────────────
let focusMode    = false;
const focusOverlay = document.getElementById('focus-overlay');
const focusWysiwyg = document.getElementById('focus-wysiwyg');

// Turndown instance for HTML → Markdown on exit
let td;
function getTurndown() {
  if (!td && window.TurndownService) {
    td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  }
  return td;
}

// ── Typewriter scrolling (focus mode) ────────────────────────────────────────
function typewriterScroll() {
  if (!focusMode) return;
  // Use a temporary invisible span to find the cursor's Y position in the textarea
  const ta = editor;
  const text = ta.value.substring(0, ta.selectionStart);
  const mirror = document.createElement('div');
  const cs = getComputedStyle(ta);
  ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing',
   'padding','paddingTop','paddingBottom','paddingLeft','paddingRight',
   'border','borderTop','borderBottom','whiteSpace','wordWrap','width','boxSizing'
  ].forEach(p => mirror.style[p] = cs[p]);
  mirror.style.position   = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.overflow   = 'hidden';
  mirror.style.height     = 'auto';
  mirror.style.top = ta.getBoundingClientRect().top + window.scrollY + 'px';
  mirror.style.left = ta.getBoundingClientRect().left + window.scrollX + 'px';
  mirror.textContent = text;
  const caret = document.createElement('span');
  caret.textContent = '|';
  mirror.appendChild(caret);
  document.body.appendChild(mirror);
  const caretTop = caret.getBoundingClientRect().top;
  document.body.removeChild(mirror);

  const target = window.innerHeight * 0.45;
  const diff = caretTop - target;
  if (Math.abs(diff) > 5) ta.scrollTop += diff;
}

function enterFocusMode() {
  focusMode = true;
  document.body.classList.add('focus-mode');
  document.getElementById('focus-btn').classList.add('active');
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  // Render markdown into the WYSIWYG pane
  focusWysiwyg.innerHTML = (window.marked && window.DOMPurify)
    ? DOMPurify.sanitize(marked.parse(editor.value || ''))
    : editor.value;
  focusWysiwyg.focus();
}

function exitFocusMode() {
  // Convert WYSIWYG HTML back to markdown
  const turndown = getTurndown();
  if (turndown) {
    const md = turndown.turndown(focusWysiwyg.innerHTML);
    if (md !== editor.value) {
      editor.value = md;
      isDirty = true;
      renderPreview();
      updateStats();
      updateLineNumbers();
    }
  }
  focusWysiwyg.innerHTML = '';
  focusMode = false;
  document.body.classList.remove('focus-mode');
  document.getElementById('focus-btn').classList.remove('active');
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  editor.focus();
}

// Sanitize pasted content — strip rich HTML, keep plain text only
focusWysiwyg.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  document.execCommand('insertText', false, text);
});

// Live sync: keep editor.value up to date while editing in WYSIWYG
let wysiwygSyncTimer;
focusWysiwyg.addEventListener('input', () => {
  clearTimeout(wysiwygSyncTimer);
  wysiwygSyncTimer = setTimeout(() => {
    if (!focusMode) return;
    const turndown = getTurndown();
    if (turndown) {
      editor.value = turndown.turndown(focusWysiwyg.innerHTML);
      isDirty = true;
      updateStats();
    }
  }, 600);
});

function toggleFocusMode() {
  focusMode ? exitFocusMode() : enterFocusMode();
}

// Exit focus mode if user presses Escape or browser exits fullscreen
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && focusMode) exitFocusMode();
});

document.getElementById('focus-btn').addEventListener('click', toggleFocusMode);
document.getElementById('focus-exit-btn').addEventListener('click', exitFocusMode);

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 's') { e.preventDefault(); performSave(false); }
  if (mod && e.key === 'n') { e.preventDefault(); if (!isDirty || confirm('Discard changes?')) openNewModal(); }
  if (mod && e.key === 'o') { e.preventDefault(); document.getElementById('drive-open-btn').click(); }
  if (mod && e.shiftKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); toggleFocusMode(); return; }
  if (mod && e.key === 'f') { e.preventDefault(); openFindBar(); }
  if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomLevel = Math.min(ZOOM_MAX, +(zoomLevel + ZOOM_STEP).toFixed(1)); applyZoom(); }
  if (mod && e.key === '-') { e.preventDefault(); zoomLevel = Math.max(ZOOM_MIN, +(zoomLevel - ZOOM_STEP).toFixed(1)); applyZoom(); }
  if (mod && e.key === '0') { e.preventDefault(); zoomLevel = 1.0; applyZoom(); }
  if (e.key === 'Escape' && findBar.classList.contains('visible')) closeFindBar();
  if (e.key === 'F11') { e.preventDefault(); toggleFocusMode(); }
  if (e.key === 'Escape' && focusMode) exitFocusMode();
});

// ── PWA install ───────────────────────────────────────────────────────────────
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('install-banner').classList.add('show');
});
document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('install-banner').classList.remove('show');
});
document.getElementById('install-close').addEventListener('click', () => {
  document.getElementById('install-banner').classList.remove('show');
});

// ── Unsaved changes warning on navigation ────────────────────────────────────
window.addEventListener('beforeunload', (e) => {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ── Resizable divider ─────────────────────────────────────────────────────────
(function () {
  const divider      = document.getElementById('divider');
  const editorPane   = document.getElementById('editor-pane');
  const previewWrap  = document.getElementById('preview-wrapper');
  const mainContent  = document.getElementById('main-content');
  let dragging = false, startX = 0, startEditorW = 0, startPreviewW = 0;

  divider.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX;
    startEditorW  = editorPane.getBoundingClientRect().width;
    startPreviewW = previewWrap.getBoundingClientRect().width;
    divider.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const newEditorW  = Math.max(200, startEditorW + dx);
    const newPreviewW = Math.max(200, startPreviewW - dx);
    editorPane.style.flex  = 'none';
    editorPane.style.width = newEditorW + 'px';
    previewWrap.style.flex  = 'none';
    previewWrap.style.width = newPreviewW + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();

// ── Service worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}

// ── Formatting helpers ────────────────────────────────────────────────────────
function wrapSelection(before, after) {
  if (after === undefined) after = before;
  const start    = editor.selectionStart;
  const end      = editor.selectionEnd;
  const selected = editor.value.slice(start, end);
  const newText  = before + selected + after;
  document.execCommand('insertText', false, newText);
  // Reselect the inner content
  editor.setSelectionRange(start + before.length, start + before.length + selected.length);
  editor.dispatchEvent(new Event('input'));
  editor.focus();
}

function prefixLines(prefix) {
  const start     = editor.selectionStart;
  const end       = editor.selectionEnd;
  const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd   = editor.value.indexOf('\n', end);
  const blockEnd  = lineEnd === -1 ? editor.value.length : lineEnd;
  const block     = editor.value.slice(lineStart, blockEnd);
  const lines     = block.split('\n');
  const already   = lines.every(l => l.startsWith(prefix));
  const newBlock  = already
    ? lines.map(l => l.slice(prefix.length)).join('\n')
    : lines.map(l => prefix + l).join('\n');
  editor.focus();
  editor.setSelectionRange(lineStart, blockEnd);
  document.execCommand('insertText', false, newBlock);
  editor.dispatchEvent(new Event('input'));
}

function insertHeading(level) {
  const hashes = '#'.repeat(level) + ' ';
  const start     = editor.selectionStart;
  const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd   = editor.value.indexOf('\n', start);
  const end       = lineEnd === -1 ? editor.value.length : lineEnd;
  const line      = editor.value.slice(lineStart, end);
  // Strip any existing heading prefix
  const stripped  = line.replace(/^#{1,6}\s*/, '');
  editor.focus();
  editor.setSelectionRange(lineStart, end);
  document.execCommand('insertText', false, hashes + stripped);
  editor.dispatchEvent(new Event('input'));
}

// ── Format bar button handlers ────────────────────────────────────────────────
document.getElementById('fmt-bold-btn').addEventListener('click',   () => wrapSelection('**'));
document.getElementById('fmt-italic-btn').addEventListener('click', () => wrapSelection('_'));
document.getElementById('fmt-strike-btn').addEventListener('click', () => wrapSelection('~~'));
document.getElementById('fmt-ul-btn').addEventListener('click',     () => prefixLines('- '));
document.getElementById('fmt-ol-btn').addEventListener('click',     () => prefixLines('1. '));
document.getElementById('fmt-quote-btn').addEventListener('click',  () => prefixLines('> '));
document.getElementById('fmt-code-btn').addEventListener('click',   () => {
  const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  if (selected.includes('\n')) {
    wrapSelection('```\n', '\n```');
  } else {
    wrapSelection('`');
  }
});
document.getElementById('fmt-link-btn').addEventListener('click', () => {
  const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  if (selected) {
    wrapSelection('[', '](url)');
  } else {
    wrapSelection('[link text](', ')');
  }
});
document.getElementById('fmt-image-btn').addEventListener('click', () => {
  wrapSelection('![alt text](', ')');
});

// Heading dropdown
document.getElementById('fmt-heading-btn').addEventListener('click', () => insertHeading(1));
document.getElementById('fmt-heading-dd').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('fmt-heading-menu').classList.toggle('open');
  document.getElementById('fmt-code-menu').classList.remove('open');
});
document.getElementById('fmt-heading-menu').querySelectorAll('[data-level]').forEach(btn => {
  btn.addEventListener('click', () => {
    insertHeading(parseInt(btn.dataset.level, 10));
    document.getElementById('fmt-heading-menu').classList.remove('open');
  });
});

// Code dropdown
document.getElementById('fmt-code-dd').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('fmt-code-menu').classList.toggle('open');
  document.getElementById('fmt-heading-menu').classList.remove('open');
});
document.getElementById('fmt-inline-code').addEventListener('click', () => {
  wrapSelection('`');
  document.getElementById('fmt-code-menu').classList.remove('open');
});
document.getElementById('fmt-code-block').addEventListener('click', () => {
  wrapSelection('```\n', '\n```');
  document.getElementById('fmt-code-menu').classList.remove('open');
});

// Close dropdowns on outside click
document.addEventListener('click', () => {
  document.getElementById('fmt-heading-menu').classList.remove('open');
  document.getElementById('fmt-code-menu').classList.remove('open');
  document.getElementById('hdr-more-menu').classList.remove('open');
});

// Keyboard shortcuts for formatting
document.addEventListener('keydown', (e) => {
  if (document.activeElement !== editor) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 'b') { e.preventDefault(); wrapSelection('**'); }
  if (mod && e.key === 'i') { e.preventDefault(); wrapSelection('_'); }
}, true);

// ── View toggles ──────────────────────────────────────────────────────────────
(function () {
  const editorPane   = document.getElementById('editor-pane');
  const previewWrap  = document.getElementById('preview-wrapper');
  const divider      = document.getElementById('divider');
  const btnEdit      = document.getElementById('view-edit-btn');
  const btnSplit     = document.getElementById('view-split-btn');
  const btnPreview   = document.getElementById('view-preview-btn');

  function setView(mode) {
    btnEdit.classList.remove('active');
    btnSplit.classList.remove('active');
    btnPreview.classList.remove('active');
    editorPane.style.flex  = '';
    editorPane.style.width = '';
    previewWrap.style.flex  = '';
    previewWrap.style.width = '';
    if (mode === 'edit') {
      btnEdit.classList.add('active');
      editorPane.style.flex   = '1';
      previewWrap.style.display = 'none';
      divider.style.display   = 'none';
    } else if (mode === 'preview') {
      btnPreview.classList.add('active');
      editorPane.style.display = 'none';
      divider.style.display   = 'none';
    } else {
      btnSplit.classList.add('active');
      editorPane.style.display  = '';
      previewWrap.style.display = '';
      divider.style.display     = '';
    }
  }

  btnEdit.addEventListener('click',    () => { userPickedView = true; setView('edit'); });
  btnSplit.addEventListener('click',   () => { userPickedView = true; setView('split'); });
  btnPreview.addEventListener('click', () => { userPickedView = true; setView('preview'); });

  let userPickedView = false;
  let wasMobile = window.innerWidth <= 700;
  setView(wasMobile ? 'edit' : 'split');

  window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 700;
    if (isMobile !== wasMobile && !userPickedView) {
      setView(isMobile ? 'edit' : 'split');
    }
    wasMobile = isMobile;
  });
})();

// ── Local file system ────────────────────────────────────────────────────────
let localFileHandle = null;

async function localOpen() {
  if (isDirty && !confirm('Discard unsaved changes?')) return;
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Markdown / Text', accept: { 'text/markdown': ['.md'], 'text/plain': ['.txt'] } }]
      });
      localFileHandle = handle;
      const file = await handle.getFile();
      editor.value = await file.text();
      setTitle(file.name);
      // Detach any open cloud file so auto-save can't overwrite it with local content
      driveFileId = null;    driveFileName    = null;
      oneDriveFileId = null; oneDriveFileName = null;
      isDirty = false;
      renderPreview(); updateStats(); updateLineNumbers();
      showToast(`Opened "${file.name}"`);
    } catch (e) { if (e.name !== 'AbortError') showToast('Could not open file'); }
  } else {
    document.getElementById('local-file-input').click();
  }
}

async function localSave() {
  if (!editor.value) { showToast('Nothing to save'); return; }
  if (window.showSaveFilePicker) {
    try {
      if (!localFileHandle) {
        localFileHandle = await window.showSaveFilePicker({
          suggestedName: currentTitle || 'untitled.md',
          types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }]
        });
      }
      const writable = await localFileHandle.createWritable();
      await writable.write(editor.value);
      await writable.close();
      isDirty = false;
      saveStatus.textContent = 'Saved';
      showToast(`Saved "${localFileHandle.name}"`);
    } catch (e) { if (e.name !== 'AbortError') showToast('Save failed'); }
  } else {
    localDownload();
  }
}

function localDownload() {
  const blob = new Blob([editor.value], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = currentTitle || 'untitled.md';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Downloaded "${a.download}"`);
}

// Save As — always prompt for a new file location, then track that handle
async function localSaveAs() {
  if (!editor.value) { showToast('Nothing to save'); return; }
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: currentTitle || 'untitled.md',
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }]
      });
      localFileHandle = handle;
      const writable = await handle.createWritable();
      await writable.write(editor.value);
      await writable.close();
      setTitle(handle.name);
      // Detach any open cloud file so auto-save targets the new local copy
      driveFileId = null;    driveFileName    = null;
      oneDriveFileId = null; oneDriveFileName = null;
      isDirty = false;
      saveStatus.textContent = 'Saved';
      showToast(`Saved "${handle.name}"`);
    } catch (e) { if (e.name !== 'AbortError') showToast('Save failed'); }
  } else {
    localDownload();
  }
}

// Rename — reuse the shared action modal, mirroring Drive/OneDrive rename UX
function localRename() {
  document.getElementById('drive-action-title').textContent = 'Rename File';
  const input = document.getElementById('drive-action-input');
  input.value = currentTitle;
  input.placeholder = 'New filename';
  document.getElementById('drive-action-modal').classList.add('open');
  input.focus(); input.select();

  document.getElementById('drive-action-confirm').onclick = async () => {
    let newName = input.value.trim();
    if (!newName) return;
    if (!newName.endsWith('.md') && !newName.endsWith('.txt')) newName += '.md';
    try {
      // Rename the on-disk file where supported (Chromium 111+); otherwise
      // fall back to renaming the working document.
      if (localFileHandle && typeof localFileHandle.move === 'function') {
        await localFileHandle.move(newName);
      }
      setTitle(newName);
      showToast(`Renamed to "${newName}"`);
    } catch (e) {
      setTitle(newName);
      showToast(`Renamed to "${newName}"`);
    }
    document.getElementById('drive-action-modal').classList.remove('open');
  };
}

// File input fallback (Safari/Firefox open)
document.getElementById('local-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  editor.value = await file.text();
  setTitle(file.name);
  localFileHandle = null;
  driveFileId = null;    driveFileName    = null;
  oneDriveFileId = null; oneDriveFileName = null;
  isDirty = false;
  renderPreview(); updateStats(); updateLineNumbers();
  showToast(`Opened "${file.name}"`);
  e.target.value = '';
});

document.getElementById('hdr-local-open').addEventListener('click', () => {
  localOpen();
  document.getElementById('hdr-more-menu').classList.remove('open');
});
document.getElementById('hdr-local-save').addEventListener('click', () => {
  localSave();
  document.getElementById('hdr-more-menu').classList.remove('open');
});
document.getElementById('hdr-local-saveas').addEventListener('click', () => {
  localSaveAs();
  document.getElementById('hdr-more-menu').classList.remove('open');
});
document.getElementById('hdr-local-rename').addEventListener('click', () => {
  localRename();
  document.getElementById('hdr-more-menu').classList.remove('open');
});

// ── Header bar delegation ─────────────────────────────────────────────────────
document.getElementById('hdr-more-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('hdr-more-menu').classList.toggle('open');
});
document.getElementById('hdr-open-mobile').addEventListener('click', () => {
  if (!driveConnected) {
    document.getElementById('drive-signin-btn').click();
  } else {
    document.getElementById('drive-open-btn').click();
  }
  document.getElementById('hdr-more-menu').classList.remove('open');
});
document.getElementById('hdr-share-mobile').addEventListener('click', () => {
  if (!driveConnected) {
    document.getElementById('drive-signin-btn').click();
  } else {
    document.getElementById('drive-save-btn').click();
  }
  document.getElementById('hdr-more-menu').classList.remove('open');
});
document.getElementById('hdr-drive-connect').addEventListener('click', () => {
  document.getElementById('drive-signin-btn').click();
  document.getElementById('hdr-more-menu').classList.remove('open');
});
document.getElementById('hdr-drive-saveas').addEventListener('click', () => {
  document.getElementById('drive-saveas-btn').click();
  document.getElementById('hdr-more-menu').classList.remove('open');
});
document.getElementById('hdr-drive-rename').addEventListener('click', () => {
  document.getElementById('drive-rename-btn').click();
  document.getElementById('hdr-more-menu').classList.remove('open');
});
document.getElementById('hdr-drive-signout').addEventListener('click', () => {
  document.getElementById('drive-signout-btn').click();
  document.getElementById('hdr-more-menu').classList.remove('open');
});
document.getElementById('hdr-focus-mode').addEventListener('click', () => {
  toggleFocusMode();
  document.getElementById('hdr-more-menu').classList.remove('open');
});

// ── Theme cycle ──────────────────────────────────────────────────────────────
(function() {
  const THEMES = ['lokai', 'dark', 'light'];
  const LABELS = { lokai: 'Lokai', dark: 'Dark', light: 'Light' };
  const btn    = document.getElementById('theme-toggle-btn');
  const label  = document.getElementById('theme-label');
  const tip    = document.getElementById('theme-tip');

  function applyTheme(t) {
    document.body.classList.remove('theme-dark', 'theme-light');
    if (t === 'dark')  document.body.classList.add('theme-dark');
    if (t === 'light') document.body.classList.add('theme-light');
    label.textContent = LABELS[t];
    tip.textContent   = 'Theme: ' + LABELS[t];
    try { localStorage.setItem('md-theme', t); } catch(_) {}
  }

  let current;
  try { current = localStorage.getItem('md-theme'); } catch(_) {}
  if (!THEMES.includes(current)) current = 'lokai';
  applyTheme(current);

  btn.addEventListener('click', () => {
    const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    current = next;
    applyTheme(next);
  });
})();

// ── Boot ──────────────────────────────────────────────────────────────────────
renderPreview();
updateStats();
updateCursor();
updateLineNumbers();
applyZoom();
