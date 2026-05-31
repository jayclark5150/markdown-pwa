// ── Config ────────────────────────────────────────────────────────────────────
// Credentials live in config.js (gitignored). Copy config.example.js to config.js.
const APP_CONFIG       = window.APP_CONFIG || {};
const GOOGLE_CLIENT_ID = APP_CONFIG.GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY   = APP_CONFIG.GOOGLE_API_KEY   || '';
const SCOPES           = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC    = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// ── State ─────────────────────────────────────────────────────────────────────
let driveConnected    = false;
let driveFileId       = null;
let driveFileName     = null;
let localFileHandle   = null;
let currentTitle      = 'New Document';
let isDirty           = false;
let autoSaveTimer     = null;
let tokenClient       = null;
let driveFiles        = [];
let selectedDriveFile = null;
let dirHandle         = null;   // File System Access API directory handle
let activeTreeHandle  = null;   // currently open file handle in sidebar

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
    if (driveFileId) driveFileName = currentTitle;
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

// ── File Sidebar ──────────────────────────────────────────────────────────────
const fileSidebar   = document.getElementById('file-sidebar');
const fileTree      = document.getElementById('file-tree');
const folderNameEl  = document.getElementById('sidebar-folder-name');

document.getElementById('sidebar-toggle-btn').addEventListener('click', () => {
  const isOpen = fileSidebar.classList.toggle('open');
  document.getElementById('sidebar-toggle-btn').classList.toggle('active', isOpen);
});

document.getElementById('sidebar-pick-btn').addEventListener('click', openDirectory);

async function openDirectory() {
  if (!('showDirectoryPicker' in window)) {
    showToast('File browser requires Chrome or Edge', 3000); return;
  }
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    folderNameEl.textContent = dirHandle.name;
    fileSidebar.classList.add('open');
    document.getElementById('sidebar-toggle-btn').classList.add('active');
    await refreshFileTree();
  } catch (e) {
    if (e.name !== 'AbortError') showToast('Could not open folder: ' + e.message);
  }
}

async function refreshFileTree() {
  if (!dirHandle) return;
  const entries = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file' && /\.(md|txt|markdown)$/i.test(name)) {
      entries.push({ name, handle });
    }
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  if (!entries.length) {
    fileTree.innerHTML = '<div class="sidebar-empty">No .md files in this folder.</div>';
    return;
  }

  fileTree.innerHTML = '';
  for (const { name, handle } of entries) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    if (handle === activeTreeHandle) item.classList.add('active');
    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = '📄';
    const nameEl = document.createElement('span');
    nameEl.className = 'tree-name';
    nameEl.textContent = name;
    item.append(icon, nameEl);
    item.addEventListener('click', () => openFileFromSidebar(handle, name, item));
    fileTree.appendChild(item);
  }
}

async function openFileFromSidebar(handle, name, itemEl) {
  if (isDirty && !confirm('You have unsaved changes. Open this file anyway?')) return;
  try {
    const file    = await handle.getFile();
    const content = await file.text();
    editor.value  = content;
    localFileHandle  = handle;
    activeTreeHandle = handle;
    driveFileId      = null;
    setTitle(name);
    isDirty = false;
    saveStatus.textContent = 'Opened';
    driveFileInfo.textContent = '📄 Local file';
    renderPreview(); updateStats(); updateCursor(); updateLineNumbers();
    // Update active highlight
    fileTree.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    itemEl.classList.add('active');
  } catch (e) {
    showToast('Could not open file: ' + e.message);
  }
}

// ── Auto-save ─────────────────────────────────────────────────────────────────
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  if (!driveConnected && !localFileHandle) return;
  saveStatus.textContent = 'Unsaved…';
  autoSaveTimer = setTimeout(async () => { await performSave(true); }, 2000);
}

async function performSave(silent = false) {
  if (!isDirty) return;
  const content = editor.value;
  if (driveConnected && driveFileId)   { await saveToDrive(content, silent); }
  else if (driveConnected)             { await saveNewToDrive(content, currentTitle, silent); }
  else if (localFileHandle)            { await saveToLocalHandle(content, silent); }
  else                                 { downloadFile(content, currentTitle); }
}

// ── Open button (local file) ──────────────────────────────────────────────────
document.getElementById('open-local-btn').addEventListener('click', () => {
  if ('showOpenFilePicker' in window) { openWithFilePicker(); }
  else { document.getElementById('file-input').click(); }
});

async function openWithFilePicker() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.txt', '.markdown'] } }]
    });
    localFileHandle  = handle;
    activeTreeHandle = handle;
    driveFileId = null;
    const file    = await handle.getFile();
    const content = await file.text();
    editor.value  = content;
    setTitle(file.name);
    isDirty = false;
    saveStatus.textContent = 'Opened';
    driveFileInfo.textContent = '📄 Local file';
    renderPreview(); updateStats(); updateCursor(); updateLineNumbers();
  } catch (e) {
    if (e.name !== 'AbortError') showToast('Could not open file: ' + e.message);
  }
}

document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  localFileHandle = null; driveFileId = null;
  const content = await file.text();
  editor.value  = content;
  setTitle(file.name);
  isDirty = false;
  saveStatus.textContent = 'Opened';
  driveFileInfo.textContent = '📄 Local file';
  renderPreview(); updateStats(); updateCursor(); updateLineNumbers();
  e.target.value = '';
});

// ── Save button (local file) ──────────────────────────────────────────────────
document.getElementById('save-local-btn').addEventListener('click', async () => {
  if (localFileHandle) {
    await saveToLocalHandle(editor.value, false);
  } else if ('showSaveFilePicker' in window) {
    try {
      localFileHandle = await window.showSaveFilePicker({
        suggestedName: currentTitle,
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }]
      });
      await saveToLocalHandle(editor.value, false);
    } catch (e) {
      if (e.name !== 'AbortError') downloadFile(editor.value, currentTitle);
    }
  } else {
    downloadFile(editor.value, currentTitle);
  }
});

async function saveToLocalHandle(content, silent = false) {
  try {
    const writable = await localFileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    isDirty = false;
    saveStatus.textContent = silent ? `Saved ${new Date().toLocaleTimeString()}` : 'Saved';
    if (!silent) showToast('✓ Saved');
  } catch (e) {
    saveStatus.textContent = 'Save failed';
    showToast('Save failed: ' + e.message);
  }
}

function downloadFile(content, filename) {
  const a = document.createElement('a');
  a.href  = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  isDirty = false;
  saveStatus.textContent = 'Downloaded';
  showToast('✓ Downloaded ' + filename);
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
  localFileHandle  = null;
  activeTreeHandle = null;
  driveFileId      = null;
  driveFileName    = null;
  isDirty          = false;
  saveStatus.textContent    = '';
  driveFileInfo.textContent = driveConnected ? '☁ Drive (new)' : '';
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
  const files = q ? await fetchDriveFiles(q) : driveFiles;
  renderDriveFileList(files);
});

function renderDriveFileList(files) {
  const list = document.getElementById('drive-file-list');
  if (!files.length) {
    list.innerHTML = '<div class="file-item" style="color:var(--text2);cursor:default">No markdown files found in Drive</div>';
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
  await loadDriveFile(selectedDriveFile.id, selectedDriveFile.name);
}

async function loadDriveFile(fileId, fileName) {
  try {
    setDriveStatus('saving', 'Loading…');
    const res = await gapi.client.drive.files.get({ fileId, alt: 'media' });
    editor.value    = res.body;
    driveFileId     = fileId;
    driveFileName   = fileName;
    localFileHandle = null;
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

function enterFocusMode() {
  focusMode = true;
  // Sync preview then copy its rendered HTML into the WYSIWYG editor
  renderPreview();
  focusWysiwyg.innerHTML = previewInner.innerHTML;
  // Re-run syntax highlighting
  if (window.hljs) {
    focusWysiwyg.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
  }
  document.body.classList.add('focus-mode');
  document.getElementById('focus-btn').classList.add('active');
  // Place cursor at start
  focusWysiwyg.focus();
  try {
    const range = document.createRange();
    range.setStart(focusWysiwyg, 0);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  } catch(e) {}
}

function syncWysiwygToEditor() {
  const turndown = getTurndown();
  if (turndown && focusWysiwyg.innerHTML) {
    try {
      editor.value = turndown.turndown(focusWysiwyg.innerHTML);
    } catch(e) {
      editor.value = focusWysiwyg.innerText || focusWysiwyg.textContent || editor.value;
    }
  } else {
    editor.value = focusWysiwyg.innerText || focusWysiwyg.textContent || editor.value;
  }
}

function exitFocusMode() {
  const before = editor.value;
  syncWysiwygToEditor();
  if (editor.value !== before) {
    isDirty = true;
    renderPreview(); updateStats(); updateCursor(); updateLineNumbers();
    scheduleAutoSave();
  }
  focusMode = false;
  document.body.classList.remove('focus-mode');
  document.getElementById('focus-btn').classList.remove('active');
  editor.focus();
}

function toggleFocusMode() {
  focusMode ? exitFocusMode() : enterFocusMode();
}

// Typewriter scrolling — normal until cursor passes 50% viewport, then locks it there
function typewriterScroll() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range   = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const dummy   = document.createElement('span');
  dummy.appendChild(document.createTextNode('​'));
  range.insertNode(dummy);
  const cursorY = dummy.getBoundingClientRect().top;
  dummy.parentNode.removeChild(dummy);
  // Restore selection
  sel.removeAllRanges();
  sel.addRange(range);

  const midpoint = window.innerHeight * 0.5;
  if (cursorY > midpoint) {
    const diff = cursorY - midpoint;
    focusOverlay.scrollTop += diff;
  }
}

// Ctrl+B / Ctrl+I in WYSIWYG
focusWysiwyg.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
  if (mod && e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
});

// Live sync WYSIWYG → editor.value on every input
focusWysiwyg.addEventListener('input', () => {
  syncWysiwygToEditor();
  isDirty = true;
  updateStats();
  updateLineNumbers();
  scheduleAutoSave();
});

// Trigger typewriter on every keystroke inside focus editor
focusWysiwyg.addEventListener('keyup', typewriterScroll);
focusWysiwyg.addEventListener('click', typewriterScroll);

document.getElementById('focus-btn').addEventListener('click', toggleFocusMode);
document.getElementById('focus-exit-btn').addEventListener('click', exitFocusMode);

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 's') { e.preventDefault(); performSave(false); }
  if (mod && e.key === 'n') { e.preventDefault(); if (!isDirty || confirm('Discard changes?')) openNewModal(); }
  if (mod && e.key === 'o') { e.preventDefault(); document.getElementById('open-local-btn').click(); }
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

// ── Service worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
renderPreview();
updateStats();
updateCursor();
updateLineNumbers();
applyZoom();
