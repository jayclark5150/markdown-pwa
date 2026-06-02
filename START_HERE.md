# OneDrive Integration - START HERE

## What You Have

The markdown-pwa project has foundation files for OneDrive integration already built and ready. This document tells you where to go next.

### Existing Foundation (Complete and Production-Ready)
- `onedrive-client.js` — MSAL authentication + Microsoft Graph API client (575 lines)
- `onedrive-picker.js` — File picker UI component (442 lines)
- `config.example.js` — Configuration template with Microsoft credential fields
- `ONEDRIVE_INTEGRATION.md` — Architecture and API documentation
- `ONEDRIVE_SETUP_STEPS.md` — High-level setup guide

### What's Missing (What This Plan Covers)
The foundation files are not yet wired into the main application. You need to:
1. Modify `index.html` to include MSAL library and UI elements
2. Modify `app.js` to call OneDrive functions from UI events
3. Update GitHub Actions workflow for credential injection
4. Create Azure app registration and get credentials
5. Test locally and deploy

---

## The Plan Documents

### Read These In Order:

#### 1. **IMPLEMENTATION_SUMMARY.txt** (Start here - 2 min read)
High-level overview of all 4 phases, time estimates, and file modifications needed.

#### 2. **INTEGRATION_POINTS.md** (5 min read)
Visual guide showing exactly what lines to change in which files.
- File modification map with line numbers
- Data flow diagram
- State machine diagram
- Quick checklist

#### 3. **ONEDRIVE_IMPLEMENTATION_PLAN.md** (Main reference - 45 min read)
Complete step-by-step implementation guide for all 4 phases:
- **Phase 1: Code Integration** — Detailed code snippets for index.html and app.js
- **Phase 2: Azure Setup** — Creating app registration step-by-step
- **Phase 3: Testing** — Local verification with 7 test scenarios
- **Phase 4: Deployment** — GitHub Pages configuration

This is your working reference document. Copy code from here directly into your files.

#### 4. **ONEDRIVE_INTEGRATION.md** (Reference - detailed architecture)
Low-level API documentation if you need to understand how onedrive-client.js works.

#### 5. **ONEDRIVE_SETUP_STEPS.md** (Reference - high-level overview)
Simplified version of the plan, good for a quick reference.

---

## Quick Timeline

| Phase | Duration | What You Do |
|---|---|---|
| Phase 1: Code Integration | 2-3 hours | Edit index.html and app.js (~250 lines total) |
| Phase 2: Azure Setup | 15 min | Create Azure app registration, copy credentials |
| Phase 3: Testing | 30 min | Run local server, test 7 scenarios, verify no regressions |
| Phase 4: Deployment | 10 min | Update workflow, add GitHub Secrets, push to main |
| **TOTAL** | **4-5 hours** | Complete integration with testing |

---

## Critical Files You'll Modify

1. **index.html** (~80 new lines)
   - Content Security Policy (CSP) — 3 additions
   - MSAL script tag — 7 lines
   - OneDrive toolbar buttons — 65 lines
   - Script loading order — 3 tags

2. **app.js** (~200 new lines)
   - State variables and DOM refs — 8 lines
   - setOnedriveStatus() function — 15 lines
   - MSAL initialization — 5 lines
   - 9 handler functions — 150 lines
   - Event listeners — 10 lines
   - Auto-save logic update — 1 line
   - Reset function update — 3 lines

3. **.github/workflows/deploy.yml** (~10 new lines)
   - Config generation step — add Microsoft secrets

---

## How to Use This Plan

### For Implementation:
1. Read IMPLEMENTATION_SUMMARY.txt (2 min)
2. Read INTEGRATION_POINTS.md (5 min)
3. Open ONEDRIVE_IMPLEMENTATION_PLAN.md (your working reference)
4. Follow Phase 1, 2, 3, 4 in order
5. Check off the verification checklist as you go

### For Understanding Architecture:
1. Read ONEDRIVE_IMPLEMENTATION_PLAN.md § "Overview"
2. Read INTEGRATION_POINTS.md § "Data Flow Diagram"
3. Consult ONEDRIVE_INTEGRATION.md for API details

### If You Get Stuck:
1. Check "Potential Blockers & Decisions" in ONEDRIVE_IMPLEMENTATION_PLAN.md
2. Check "Troubleshooting" section in ONEDRIVE_SETUP_STEPS.md
3. Read the inline comments in onedrive-client.js

---

## Key Decisions Made

### Parallel vs. Abstracted
**Decision**: Parallel (Google Drive and OneDrive coexist independently)

**Why**: 
- Simpler to understand and maintain
- No risk of cross-service bugs
- Users clearly see which service they're using
- Easier to debug

Users can use either or both services simultaneously.

### Where Credentials Go
- **Local development**: `config.js` (gitignored)
- **Production**: GitHub Secrets (injected at deploy time)
- **Never committed**: Real credentials never touch git

### Authentication
- **Google Drive**: Uses Google OAuth (gapi library)
- **OneDrive**: Uses Microsoft OAuth (MSAL library)
- Both work independently without conflicts

---

## Before You Start

### Prerequisites
- Basic understanding of JavaScript/HTML
- Node.js + npx installed (for local testing)
- Azure account (free tier okay)
- Microsoft account (personal or work)
- GitHub account with repo write access

### Get These Ready
1. GitHub repository URL and admin access
2. Azure Portal access (portal.azure.com)
3. Code editor (VS Code recommended)
4. Local static server: `npm install -g serve`

---

## After Integration

### Post-Deployment
1. Update `README.md` to document OneDrive support
2. Test on multiple browsers (Chrome, Firefox, Safari, Edge)
3. Monitor for errors in first week
4. Gather user feedback
5. Document any troubleshooting for users

### Future Improvements (Optional)
- Add app-specific folder support (more restricted scope)
- Implement periodic silent token refresh
- Add OneDrive sync indicators
- Create abstraction layer if adding more cloud providers

---

## File Summary

All planning documents in this directory:

| File | Size | Purpose |
|---|---|---|
| **START_HERE.md** | This file | Quick overview (you are here) |
| **IMPLEMENTATION_SUMMARY.txt** | 4.3 KB | Phase overview + timeline |
| **INTEGRATION_POINTS.md** | 9.3 KB | Visual reference for changes |
| **ONEDRIVE_IMPLEMENTATION_PLAN.md** | 33 KB | Complete step-by-step guide |
| **ONEDRIVE_INTEGRATION.md** | 13 KB | API documentation |
| **ONEDRIVE_SETUP_STEPS.md** | 14 KB | High-level setup guide |

**Foundation files** (already exist, don't modify):
- onedrive-client.js (575 lines)
- onedrive-picker.js (442 lines)
- config.example.js

---

## Success Criteria

After implementation, you should have:

**Local testing (Phase 3)**:
- OneDrive connection works
- Create/open/rename/delete files works
- Auto-save works
- Google Drive still works
- No CSP errors

**Production (Phase 4)**:
- GitHub Pages deployment succeeds
- OneDrive works on production URL
- Credentials injected from GitHub Secrets
- No errors in browser console

**User experience**:
- Users see OneDrive controls in toolbar
- Users can sign in with Microsoft account
- Users can manage files independently from Google Drive
- Status shows connection state clearly

---

## Next Steps

1. **Right now**: Read IMPLEMENTATION_SUMMARY.txt (2 minutes)
2. **Next**: Open INTEGRATION_POINTS.md for visual reference
3. **Then**: Start Phase 1 with ONEDRIVE_IMPLEMENTATION_PLAN.md
4. **Questions?**: Check the troubleshooting sections or architecture docs

**Good luck! You've got a well-documented foundation. This should take 4-5 hours total.**

