# OneDrive Integration Points - Quick Reference

## File Modification Map

### index.html (3 sections to modify)

```
Line 10-17: Content Security Policy (CSP)
├─ ADD to script-src: https://alcdn.msauth.net
└─ ADD to connect-src: https://login.microsoftonline.com https://graph.microsoft.com

Line ~53: Script tags (after Google scripts)
└─ ADD: <script src="https://alcdn.msauth.net/browser/2.26.0/js/msal-browser.min.js" ...>

Line ~205: Toolbar buttons (after Google Drive section)
├─ ADD: <div class="tb-group"> for onedrive-connect-btn
├─ ADD: <div class="tb-group"> for onedrive-open-btn
├─ ADD: <div class="tb-group"> for onedrive-save-btn
├─ ADD: <div class="tb-group"> for onedrive-saveas-btn
├─ ADD: <div class="tb-group"> for onedrive-rename-btn
├─ ADD: <div class="tb-group"> for onedrive-delete-btn
└─ ADD: <div class="tb-group"> for onedrive-signout-btn

Line ~214: Status display (after drive-status div)
└─ ADD: <div id="onedrive-status">...</div>

Line ~300+: Modal backdrop (before </body>)
└─ ADD: <div id="onedrive-picker-backdrop">...</div>

Line 314-315: Script loading
CHANGE FROM:
  <script src="config.js"></script>
  <script src="app.js"></script>

TO:
  <script src="config.js"></script>
  <script src="onedrive-client.js"></script>
  <script src="onedrive-picker.js"></script>
  <script src="app.js"></script>
```

### app.js (5 sections to modify)

```
Line ~47: validateCredentials() function
└─ UPDATE: Add check for window.APP_CONFIG?.MICROSOFT_CLIENT_ID && MICROSOFT_TENANT_ID

Line ~52-61: State variables
└─ ADD: onedriveConnected, onedriveFileId, onedriveFileName

Line ~80-83: DOM references
└─ ADD: onedriveStatus, onedriveStatusTxt, onedriveFileInfo, toolbarOnedriveToolDot, toolbarOnedriveTip

Line ~214-230: setDriveStatus() function (after)
└─ ADD: setOnedriveStatus() function (~15 lines)

Line ~457-461: Page load (DOMContentLoaded handler)
└─ ADD: Initialize MSAL if credentials present (~5 lines)

Line ~335-345: Auto-save logic
UPDATE FROM:
  if (driveConnected && driveFileId)   { await saveToDrive(...); }
  else if (driveConnected)             { await saveNewToDrive(...); }

TO:
  if (driveConnected && driveFileId)        { await saveToDrive(...); }
  else if (driveConnected)                  { await saveNewToDrive(...); }
  else if (onedriveConnected && onedriveFileId) { await saveToOnedrive(...); }

Line ~371-377: newDocument() function
└─ ADD: Clear onedriveFileId, onedriveFileName, call setOnedriveStatus()

Line ~960+: After Google Drive handlers
└─ ADD: 9 new functions (~150 lines total)
   ├─ handleOnedriveConnect()
   ├─ handleOnedriveOpen()
   ├─ loadOnedriveFile()
   ├─ handleOnedriveSaveAs()
   ├─ saveOnedriveNew()
   ├─ saveToOnedrive()
   ├─ handleOnedriveRename()
   ├─ handleOnedriveDelete()
   └─ handleOnedriveSignout()

Line ~950+: After Google Drive event listeners
└─ ADD: Event listeners for all 7 OneDrive buttons (~10 lines)
   ├─ onedrive-connect-btn → handleOnedriveConnect
   ├─ onedrive-open-btn → handleOnedriveOpen
   ├─ onedrive-save-btn → saveToOnedrive
   ├─ onedrive-saveas-btn → handleOnedriveSaveAs
   ├─ onedrive-rename-btn → handleOnedriveRename
   ├─ onedrive-delete-btn → handleOnedriveDelete
   └─ onedrive-signout-btn → handleOnedriveSignout
```

### .github/workflows/deploy.yml (1 section to modify)

```
Line 17-29: Generate config.js from secrets
CHANGE FROM:
  env:
    GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
    GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
  run: |
    cat > config.js <<EOF
    window.APP_CONFIG = {
      GOOGLE_CLIENT_ID: '${GOOGLE_CLIENT_ID}',
      GOOGLE_API_KEY:   '${GOOGLE_API_KEY}',
    };
    EOF

TO:
  env:
    GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
    GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
    MICROSOFT_CLIENT_ID: ${{ secrets.MICROSOFT_CLIENT_ID }}
    MICROSOFT_TENANT_ID: ${{ secrets.MICROSOFT_TENANT_ID }}
    MICROSOFT_REDIRECT_URI: ${{ secrets.MICROSOFT_REDIRECT_URI }}
  run: |
    cat > config.js <<EOF
    window.APP_CONFIG = {
      GOOGLE_CLIENT_ID: '${GOOGLE_CLIENT_ID}',
      GOOGLE_API_KEY:   '${GOOGLE_API_KEY}',
      MICROSOFT_CLIENT_ID: '${MICROSOFT_CLIENT_ID}',
      MICROSOFT_TENANT_ID: '${MICROSOFT_TENANT_ID}',
      MICROSOFT_REDIRECT_URI: '${MICROSOFT_REDIRECT_URI}',
    };
    EOF
```

## Data Flow Diagram

```
User Interface (Toolbar Buttons)
        ↓
Event Listeners in app.js
        ↓
Handler Functions:
├─ handleOnedriveConnect() → window.onedriveClient.signIn()
├─ handleOnedriveOpen() → OnedrivePicker.pickFile() → loadOnedriveFile()
├─ handleOnedriveSaveAs() → OnedrivePicker.pickSaveLocation() → saveOnedriveNew()
├─ handleOnedriveRename() → window.onedriveClient.renameFile()
├─ handleOnedriveDelete() → window.onedriveClient.deleteFile()
└─ handleOnedriveSignout() → window.onedriveClient.signOut()
        ↓
window.onedriveClient API (onedrive-client.js)
        ↓
MSAL Library (window.msal)
        ↓
Microsoft Graph API
        ↓
OneDrive/Microsoft Account
```

## State Machine

```
                                    ┌─────────────────┐
                                    │   NOT CONNECTED │
                                    └────────┬────────┘
                                             │
                         handleOnedriveConnect()
                                             ↓
                    ┌─────────────────────────────────────────┐
                    │  CONNECTED (onedriveConnected = true)    │
                    │ (buttons: open, save-as, rename, delete)│
                    └────────┬───────────────────────┬─────────┘
                             │                       │
                handleOnedriveOpen()        handleOnedriveSignout()
                    │                               │
                    ↓                               │
        ┌───────────────────┐                      │
        │  FILE OPEN STATE  │                      │
        │ (onedriveFileId   │                      │
        │  != null)         │                      │
        └───┬───┬───┬───┬───┘                      │
            │   │   │   │                          │
            ├───┘   │   │                          │
    saveToOnedrive()│   │                          │
                    │   │                          │
        handleOnedriveSaveAs()  OR                 │
        handleOnedriveRename()                     │
        handleOnedriveDelete()                     │
                    │                              │
                    └──────────────────┬───────────┘
                                       ↓
                                    NOT CONNECTED
```

## Integration Checklist (Quick)

Phase 1: Code Changes
- [ ] index.html: Update CSP (3 additions)
- [ ] index.html: Add MSAL script tag
- [ ] index.html: Add 7 button groups (60+ lines)
- [ ] index.html: Add status display
- [ ] index.html: Add picker modal container
- [ ] index.html: Update script loading (3 tags)
- [ ] app.js: Update validateCredentials()
- [ ] app.js: Add 3 state variables
- [ ] app.js: Add 5 DOM references
- [ ] app.js: Add setOnedriveStatus() function
- [ ] app.js: Initialize MSAL on page load
- [ ] app.js: Add 9 handler functions
- [ ] app.js: Add 7 event listeners
- [ ] app.js: Update auto-save logic (1 branch)
- [ ] app.js: Update newDocument() function

Phase 2: Azure
- [ ] Create app registration
- [ ] Copy Client ID, Tenant ID
- [ ] Add production redirect URI

Phase 3: Testing
- [ ] Local server running on port 3000
- [ ] Connection test passes
- [ ] Create file test passes
- [ ] Open file test passes
- [ ] Auto-save test passes
- [ ] Rename test passes
- [ ] Delete test passes
- [ ] Sign out test passes
- [ ] Google Drive still works
- [ ] No CSP errors in console

Phase 4: Deployment
- [ ] Update GitHub Actions workflow
- [ ] Add 3 GitHub Secrets
- [ ] Commit and push
- [ ] Wait for workflow to complete
- [ ] Test on production URL

## Line Count Summary

| File | Section | Added Lines |
|---|---|---|
| index.html | CSP | 3 new lines |
| index.html | MSAL script | 8 new lines |
| index.html | OneDrive buttons | 65 new lines |
| index.html | Status display | 3 new lines |
| index.html | Picker container | 1 new line |
| index.html | Script tags | 2 new lines (reordered) |
| app.js | validateCredentials | 6 modified lines |
| app.js | State variables | 3 new lines |
| app.js | DOM references | 5 new lines |
| app.js | setOnedriveStatus | 15 new lines |
| app.js | MSAL init | 5 new lines |
| app.js | Handler functions | 150 new lines |
| app.js | Event listeners | 10 new lines |
| app.js | Auto-save logic | 1 new line |
| app.js | Reset function | 3 modified lines |
| .github/workflows/deploy.yml | Config generation | 8 new lines |

**Total: ~288 new or modified lines across 3 files**

