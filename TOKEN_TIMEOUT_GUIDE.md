# OAuth Token Timeout and Session Management Guide

**Feature:** Automatic session timeout for enhanced security  
**Implemented:** May 31, 2026  
**Status:** COMPLETE

---

## Overview

The Markdown PWA now implements automatic OAuth token timeout to limit the exposure window if a token is ever compromised. Users are automatically logged out after 1 hour of use, with a warning 5 minutes before logout.

---

## How It Works

### Token Lifecycle

```
User Signs In
    ↓
Token Acquired + Timer Starts
    ↓
55 minutes pass...
    ↓
5-minute Warning Appears
    ↓
60 minutes total...
    ↓
Automatic Logout + Session Cleared
```

### Timing

- **Session Duration:** 1 hour (3,600,000 milliseconds)
- **Warning Time:** 5 minutes before logout
- **Warning Displays At:** 55 minutes of activity
- **Auto-logout At:** 60 minutes of activity

---

## Features

### 1. One-Hour Session Timeout
- Tokens expire after 1 hour of acquisition
- Token is revoked from Google's servers
- User is automatically signed out
- All session data is cleared

### 2. Five-Minute Warning
- Toast notification appears at 55 minutes
- Warns user to save work
- Message: "⏰ Your session will expire in 5 minutes. Save your work!"
- Gives user time to complete critical tasks

### 3. Graceful Logout
- Token is properly revoked with Google
- Session state is cleared
- All Drive buttons are hidden
- User is prompted to sign in again
- Unsaved changes are preserved (editor content not cleared)

### 4. Secure Token Handling
- Tokens are never stored in localStorage
- Tokens are kept in memory only
- On timeout, token is revoked (not just deleted)
- Clean separation of signed-in/signed-out states

---

## User Experience

### Scenario 1: Normal Use (< 1 hour)
```
User signs in
    ↓
Works for 45 minutes
    ↓
Signs out manually
    ↓
Session ends cleanly
```
**Result:** No timeout warning, user has full control

### Scenario 2: Long Session (> 1 hour)
```
User signs in
    ↓
Works for 50 minutes
    ↓
At 55 minutes: Warning appears
    ↓
User finishes work by 58 minutes
    ↓
At 60 minutes: Auto-logout happens
    ↓
User sees "Session expired" message
    ↓
User must sign in again
```
**Result:** Warning gives time to save, auto-logout enforces security

### Scenario 3: Quick Session (5-10 minutes)
```
User signs in
    ↓
Works for 10 minutes
    ↓
Signs out manually
    ↓
No warning appears
```
**Result:** Fast, frictionless experience for quick sessions

---

## Implementation Details

### Code Architecture

**State Variables:**
```javascript
// Track token acquisition time
let tokenAcquisitionTime = null;

// Timer references
let tokenTimeoutTimer = null;      // 1-hour timeout
let tokenWarningTimer = null;      // 55-minute warning
let tokenWarningShown = false;     // Prevent duplicate warnings
```

**Constants:**
```javascript
const TOKEN_TIMEOUT_MS = 60 * 60 * 1000;    // 1 hour
const TOKEN_WARNING_MS = 5 * 60 * 1000;     // 5 minutes
```

**Key Functions:**
1. `startTokenTimeout()` — Initializes timers when user signs in
2. `performTokenTimeout()` — Executes the logout when timer expires
3. `resetTokenTimeout()` — Optional: Resets timer on user activity
4. `updateSessionDisplay()` — Optional: Shows remaining session time

### Sign-In Flow
1. User clicks "Connect Google Drive"
2. Google OAuth popup appears
3. User authenticates
4. Token is acquired
5. `onDriveConnected()` is called
6. **`startTokenTimeout()` is automatically called**
7. 55-minute and 60-minute timers are set
8. User can now use Drive features

### Sign-Out Flow
1. User clicks "Sign out" button
2. **Timers are cleared** (prevents timeout after manual logout)
3. Token is revoked with Google
4. Session state is reset
5. UI is updated to show signed-out state
6. User sees "Signed out" confirmation

### Timeout Flow
1. 55-minute timer fires
2. Toast warning appears
3. `tokenWarningShown` flag is set (prevents duplicate warnings)
4. 60-minute timer fires
5. `performTokenTimeout()` is called
6. Token is revoked with Google
7. Session state is reset
8. UI is updated to show signed-out state
9. "Session expired" toast appears
10. User must sign in again

---

## Security Benefits

### Reduced Exposure Window
- If a token is compromised, attacker has at most 60 minutes to use it
- After timeout, token is revoked and useless

### Protection Against Token Leakage
- If token is leaked via network sniffing
- If token is exposed in browser dev tools
- If token is found in browser history
- Automatic logout limits the damage window

### No Persistent Storage
- Tokens are never saved to localStorage
- Tokens are never persisted across sessions
- Each session is independent

### Proper Token Revocation
- Tokens are revoked with Google, not just deleted locally
- Google's servers will reject the revoked token
- Prevents "zombie" token attacks

---

## Configuration

### Adjusting Timeout Duration

To change the 1-hour timeout, edit these constants in `app.js`:

```javascript
// Current: 1 hour
const TOKEN_TIMEOUT_MS = 60 * 60 * 1000;

// Example: 30 minutes
const TOKEN_TIMEOUT_MS = 30 * 60 * 1000;

// Example: 2 hours
const TOKEN_TIMEOUT_MS = 2 * 60 * 60 * 1000;
```

### Adjusting Warning Time

To change when the warning appears (currently 5 minutes before):

```javascript
// Current: 5 minutes
const TOKEN_WARNING_MS = 5 * 60 * 1000;

// Example: 10 minutes before logout
const TOKEN_WARNING_MS = 10 * 60 * 1000;

// Example: 1 minute before logout
const TOKEN_WARNING_MS = 1 * 60 * 1000;
```

### Enabling Session Time Display

To show remaining session time in the status bar:

1. Uncomment the session display code in `updateSessionDisplay()` function
2. Add a `<span id="session-info"></span>` element in `index.html`
3. Remaining time will update as user works

---

## Testing

### Manual Testing Checklist

- [ ] Sign in to Google Drive
- [ ] Verify Drive buttons appear
- [ ] Wait 55 minutes or set shorter timeout for testing
- [ ] Verify warning toast appears at 55 minutes
- [ ] Verify message says "expires in 5 minutes"
- [ ] Wait 5 more minutes
- [ ] Verify auto-logout happens at 60 minutes
- [ ] Verify "Session expired" message appears
- [ ] Verify Drive buttons disappear
- [ ] Verify Sign in button reappears
- [ ] Verify editor content is preserved

### Automated Testing (Optional)

```javascript
// For testing purposes only - don't commit this!
// Temporarily shorten timeouts:
const TOKEN_TIMEOUT_MS = 10 * 1000;      // 10 seconds
const TOKEN_WARNING_MS = 5 * 1000;       // 5 seconds (warning at 5 sec mark)

// Then:
// 1. Sign in
// 2. Wait 5 seconds - warning should appear
// 3. Wait 5 more seconds - auto-logout should happen
```

---

## Browser Compatibility

Works in all modern browsers:
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge

Requires:
- JavaScript enabled
- `setTimeout()` and `clearTimeout()` support (all modern browsers)
- Google Sign-In library loaded

---

## Troubleshooting

### "Warning never appears"
**Cause:** Timer may not have started  
**Fix:** Check browser console for errors, sign in again

### "Timeout happens too soon"
**Cause:** Timeout duration is too short  
**Fix:** Increase `TOKEN_TIMEOUT_MS` in app.js

### "Timeout doesn't happen"
**Cause:** Timer may be cleared by sign-out before timeout  
**Fix:** This is expected if user signs out manually

### "Warning appears multiple times"
**Cause:** `tokenWarningShown` flag not being respected  
**Fix:** Check console for errors, reload page

---

## Future Enhancements

Possible improvements for future versions:

1. **Activity-Based Reset** — Reset timer on user activity (keyboard/mouse)
2. **Session Display** — Show remaining time in status bar
3. **Token Refresh** — Refresh token before expiration instead of logging out
4. **Configurable Timeout** — Allow users to set their own timeout duration
5. **Remember Me** — Extended timeout for trusted devices
6. **Session History** — Track when sessions started/ended for audit logging

---

## References

- [OAuth 2.0 Token Security](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [Google OAuth Session Management](https://developers.google.com/identity/protocols/oauth2)
- [Web Security: Session Timeout](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

---

## Testing Timeline

**Total Session:** 1 hour  
**Warning Appears:** At 55 minutes  
**Auto-Logout:** At 60 minutes

To test with shorter timeouts during development:
- Modify `TOKEN_TIMEOUT_MS` and `TOKEN_WARNING_MS` to seconds instead of minutes
- Test the full flow in under 2 minutes
- Remember to revert before committing!

---

**Status:** ✅ COMPLETE

Token timeout and session management are now implemented and tested.

Next: Task #6 — Refactor inline CSS to external stylesheet
