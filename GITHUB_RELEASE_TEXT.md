## What's New in v1.2.0

### Major Features
- **OneDrive Integration** - Full support for Microsoft OneDrive with parallel architecture
- **File Picker Modal** - Browse and select files directly from OneDrive
- **Auto-save** - Automatic file synchronization with 2-second debounce
- **Token Management** - Automatic OAuth token refresh (1-hour validity)

### UI Improvements
- Added 6 new OneDrive toolbar buttons (connect, open, save, rename, delete, sign-out)
- Toolbar buttons now icon-only (no text labels)
- Comprehensive toolbar icon reference table in RELEASE_NOTES.md

### Technical Updates
- Local MSAL stub for development (workaround for CDN blocking)
- GitHub Actions credential injection for production
- Updated CSP for OneDrive API endpoints
- Parallel cloud storage support (Google Drive + OneDrive)

### Documentation
- New: RELEASE_NOTES.md with complete icon reference
- New: ONEDRIVE_SETUP_STEPS.md for step-by-step setup
- New: ONEDRIVE_INTEGRATION.md for technical details
- Updated: config.example.js with Azure fields

### Files Changed
- **New**: `lib/msal-browser.min.js` (MSAL authentication stub)
- **New**: `onedrive-client.js` (OneDrive API integration)
- **New**: `onedrive-picker.js` (File picker UI component)
- **New**: `RELEASE_NOTES.md` (icon reference + features)
- **New**: `ONEDRIVE_SETUP_STEPS.md` (setup guide)
- **New**: `ONEDRIVE_INTEGRATION.md` (technical reference)
- **Modified**: `app.js` (+150 lines for OneDrive handlers)
- **Modified**: `index.html` (OneDrive buttons + CSP)
- **Modified**: `config.js` (Azure credentials)
- **Modified**: `manifest.json` (v1.2.0)
- **Modified**: `.github/workflows/deploy.yml` (secrets)

### Known Limitations
- File picker requires valid Azure app credentials
- Browser popup blocking may prevent OAuth flows
- Auto-save only works when connected to cloud storage

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for complete details.
