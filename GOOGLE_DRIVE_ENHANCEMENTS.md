# Google Drive Control Enhancements for Markdown PWA

This guide shows how to add **Save As**, **Delete**, and **Rename** functionality to your markdown PWA's Google Drive integration.

---

## Overview of Current Implementation

The PWA already has:
- ✅ Sign in/out with Google
- ✅ Load files from Drive
- ✅ Save to Drive (update existing file)
- ✅ Save new file to Drive

Missing:
- ❌ Save As (create a copy with a new name)
- ❌ Delete file from Drive
- ❌ Rename file in Drive

---

## Implementation Steps

### Step 1: Add New UI Buttons

**Location:** `index.html` (around line 759, after the Drive buttons)

Add these buttons to the toolbar Drive section:

```html
<button class="tb-btn" id="drive-saveas-btn" style="display:none">
  💾 Save As
</button>
<button class="tb-btn" id="drive-rename-btn" style="display:none">
  ✎ Rename
</button>
<button class="tb-btn danger" id="drive-delete-btn" style="display:none">
  🗑 Delete
</button>
```

**Show/Hide Logic:** Add to the `setDriveStatus()` function so buttons only appear when Drive is connected and a file is open:

```javascript
function setDriveStatus(status, message) {
  // ... existing code ...
  
  const isFileOpen = driveFileId !== null;
  document.getElementById('drive-saveas-btn').style.display  = status === 'connected' ? 'inline-block' : 'none';
  document.getElementById('drive-rename-btn').style.display  = status === 'connected' && isFileOpen ? 'inline-block' : 'none';
  document.getElementById('drive-delete-btn').style.display  = status === 'connected' && isFileOpen ? 'inline-block' : 'none';
}
```

---

### Step 2: Add Modal for Save As & Rename

**Location:** `index.html` (add a new modal)

```html
<!-- Save As / Rename Modal -->
<div id="drive-action-modal" class="modal">
  <div class="modal-content">
    <h2 id="modal-title">Save As</h2>
    <input type="text" id="drive-action-input" placeholder="New filename (without extension)" />
    <div class="modal-buttons">
      <button id="drive-action-confirm" class="btn-primary">Confirm</button>
      <button id="drive-action-cancel" class="btn-secondary">Cancel</button>
    </div>
  </div>
</div>
```

---

### Step 3: Add JavaScript Functions

**Location:** `app.js` (add after the existing `saveNewToDrive()` function around line 636)

#### 3a. Delete File Function

```javascript
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
```

#### 3b. Rename File Function

```javascript
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
```

#### 3c. Save As Function

```javascript
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
```

---

### Step 4: Add Event Listeners

**Location:** `app.js` (add after the existing button event listeners, around line 598)

```javascript
// Save As
document.getElementById('drive-saveas-btn').addEventListener('click', () => {
  document.getElementById('modal-title').textContent = 'Save As';
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
  document.getElementById('modal-title').textContent = 'Rename File';
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
```

---

### Step 5: Add CSS Styling

**Location:** `index.html` `<style>` section or in your stylesheet

```css
/* Drive Action Modal (reuse existing modal styles) */
#drive-action-modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  align-items: center;
  justify-content: center;
}

#drive-action-modal.open {
  display: flex;
}

#drive-action-modal .modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 90%;
}

#drive-action-modal h2 {
  margin: 0 0 15px 0;
  font-size: 18px;
}

#drive-action-modal input {
  width: 100%;
  padding: 10px;
  margin-bottom: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

#drive-action-modal input:focus {
  outline: none;
  border-color: #4285f4;
  box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
}

.modal-buttons {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-primary, .btn-secondary {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background: #4285f4;
  color: white;
}

.btn-primary:hover {
  background: #3367d6;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}
```

---

## Summary of Changes

| Feature | API Used | Status |
|---------|----------|--------|
| Save As | `POST /upload/drive/v3/files` (creates new file) | ✅ New |
| Delete | `DELETE /upload/drive/v3/files/{fileId}` | ✅ New |
| Rename | `PATCH /upload/drive/v3/files/{fileId}` | ✅ New |

---

## Testing Checklist

- [ ] Click "Save As" and create a new file with a different name
- [ ] Verify new file appears in the Drive file list
- [ ] Click "Rename" on an open file and change its name
- [ ] Verify the rename is reflected in Drive and the UI
- [ ] Click "Delete" and confirm the file is removed from Drive
- [ ] Verify editor clears after deletion

---

## Notes

1. **Permissions:** Your Google OAuth scope (`drive.file`) already allows you to create, update, and delete files you own. No scope change needed.

2. **Error Handling:** All functions include try-catch blocks and user-friendly error messages via `showToast()`.

3. **File Refresh:** After Save As, Rename, or Delete, `fetchDriveFiles()` is called to refresh the file list.

4. **File Extension:** The functions automatically append `.md` if you don't provide it.

5. **UI Safety:** Delete button is marked with `danger` class; all actions require confirmation or explicit user input.

---

## Optional Enhancements

- Add keyboard shortcuts (e.g., `Cmd+Shift+S` for Save As)
- Add a confirmation dialog before delete
- Show file size/modification date in the file list
- Add a "recent files" quick access menu
- Implement file version history (requires additional API calls)
