# Security Policy & Architecture

**Document Status:** Complete  
**Last Updated:** June 1, 2026  
**Risk Level:** 🟢 LOW  
**Security Audit:** PASSED

---

## Table of Contents

1. [Overview](#overview)
2. [Threat Model](#threat-model)
3. [Credential Management](#credential-management)
4. [OAuth 2.0 Security](#oauth-20-security)
5. [API Key Security](#api-key-security)
6. [Content Security Policy](#content-security-policy)
7. [Data Protection](#data-protection)
8. [Dependency Management](#dependency-management)
9. [Build & Deployment Security](#build--deployment-security)
10. [Incident Response](#incident-response)
11. [Security Checklist](#security-checklist)
12. [References](#references)

---

## Overview

The Markdown PWA is a secure, production-grade Progressive Web App with comprehensive security hardening across all layers: credential management, API authentication, content security, data protection, and deployment pipelines.

### Security Goals
- **Zero hardcoded secrets** in source code or git history
- **Strong credential isolation** between environments (dev/prod)
- **Limited token exposure window** via 1-hour auto-logout
- **Strict Content Security Policy** without unsafe exceptions
- **Secure build pipeline** with GitHub Actions secrets
- **Defense-in-depth architecture** with multiple security layers

### Key Security Features

| Feature | Status | Details |
|---------|--------|---------|
| Credential rotation | ✅ Implemented | New credentials, old ones deleted |
| GitHub Secrets | ✅ Implemented | Credentials never in git or logs |
| OAuth token timeout | ✅ Implemented | Auto-logout after 1 hour |
| API key restrictions | ✅ Implemented | HTTPS + Drive API only |
| Content Security Policy | ✅ Hardened | No unsafe-inline exceptions |
| External CSS | ✅ Implemented | styles.css + CSP alignment |
| DOMPurify integration | ✅ Implemented | XSS prevention in markdown |
| Subresource Integrity | ✅ Implemented | CDN resource pinning |
| Service Worker isolation | ✅ Implemented | Cache poisoning mitigation |

---

## Threat Model

### In Scope

#### 1. Credential Exposure
**Risk:** Hardcoded or exposed API credentials → API abuse  
**Mitigation:**
- No credentials in source code or git history
- GitHub Secrets injection at build time
- Regular credential rotation (see [Credential Rotation](#credential-rotation))
- API key scoped to Drive API only

#### 2. Token Compromise
**Risk:** Stolen OAuth token → Unauthorized Drive access  
**Mitigation:**
- 1-hour automatic session timeout (see [Session Management](#oauth-20-security))
- 5-minute warning before auto-logout
- Proper token revocation with Google's servers
- Tokens kept in memory only (not localStorage)

#### 3. Cross-Site Scripting (XSS)
**Risk:** Malicious script injection → Data theft or session hijacking  
**Mitigation:**
- Strict Content Security Policy without unsafe-inline
- DOMPurify for markdown HTML sanitization
- No eval() or Function() constructors
- External CSS only, no inline styles

#### 4. Cross-Site Request Forgery (CSRF)
**Risk:** Forged request to Google Drive API  
**Mitigation:**
- OAuth 2.0 handles CSRF protection
- SameSite cookies enforced by browser
- POST/DELETE requests require valid OAuth token

#### 5. Man-in-the-Middle (MITM)
**Risk:** Network sniffing of credentials or data  
**Mitigation:**
- HTTPS only (enforced for all API calls)
- HTTP referrer restrictions on API key
- Subresource Integrity (SRI) for CDN resources
- No unencrypted storage of sensitive data

### Out of Scope

- **Client-side JavaScript vulnerabilities** (framework security is a dependency)
- **Google Cloud infrastructure security** (delegated to Google)
- **Physical security** of user devices
- **Social engineering** attacks targeting users
- **Supply chain attacks** on npm dependencies (mitigated via SRI)

---

## Credential Management

### Architecture

```
Local Development               Production (GitHub Pages)
────────────────              ──────────────────────────

config.js (gitignored)         GitHub Actions
    ↓                              ↓
Contains real                  Reads secrets from
credentials                    GitHub Secrets
    ↓                              ↓
app.js loads                   Generates config.js
credentials                    at build time
    ↓                              ↓
App uses credentials           Deployed app uses
for Drive API calls            credentials
```

### Implementation Details

#### Local Development

**File:** `config.js` (gitignored, never committed)

```javascript
// config.js - LOCAL DEVELOPMENT ONLY
export const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
export const GOOGLE_API_KEY = 'YOUR_API_KEY_HERE';
```

**Setup:**
1. Copy `config.example.js` → `config.js`
2. Fill in real credentials from Google Cloud Console
3. Add to `.gitignore` (already done)
4. Start local server: `python3 -m http.server 8000`

**Important:** Never commit `config.js`. Verify it's in `.gitignore`:
```bash
grep "config.js" .gitignore
# Should output: config.js
```

#### Production (GitHub Pages)

**Method:** GitHub Actions secrets + build-time injection

**Setup:**
1. Create secrets in GitHub repository settings:
   - `GOOGLE_CLIENT_ID` — OAuth 2.0 Client ID
   - `GOOGLE_API_KEY` — Restricted API Key

2. Workflow automatically generates `config.js` at build time:
   ```yaml
   # .github/workflows/deploy.yml
   - name: Generate config from secrets
     run: |
       echo "export const GOOGLE_CLIENT_ID = '${{ secrets.GOOGLE_CLIENT_ID }}';" > config.js
       echo "export const GOOGLE_API_KEY = '${{ secrets.GOOGLE_API_KEY }}';" >> config.js
   ```

3. Build and deploy — credentials are injected automatically

**Security Properties:**
- ✅ Credentials never appear in git history
- ✅ Credentials masked in build logs (shown as `***`)
- ✅ Each deployment uses current secrets
- ✅ Easy rotation — just update GitHub Secrets

### Credential Rotation

**When to rotate:**
- Annually (set reminder for May 31, 2027)
- Immediately if compromise is suspected
- After personnel changes with credential access

**How to rotate:**

1. **Create new credentials in Google Cloud Console:**
   - Create new OAuth 2.0 Client ID
   - Create new API Key
   - Configure same restrictions on new key

2. **Update GitHub Secrets:**
   ```
   Repository Settings → Secrets and variables → Actions
   Edit: GOOGLE_CLIENT_ID (new value)
   Edit: GOOGLE_API_KEY (new value)
   ```

3. **Verify locally:**
   ```bash
   cp config.example.js config.js
   # Update with new credentials
   python3 -m http.server 8000
   # Test Drive features
   ```

4. **Delete old credentials:**
   - In Google Cloud Console, delete old OAuth Client ID
   - In Google Cloud Console, delete old API Key
   - Confirm they're removed

5. **Next deployment:**
   - Push any change or manually trigger workflow
   - GitHub Actions uses new secrets automatically

**See also:** [CREDENTIAL_ROTATION_GUIDE.md](CREDENTIAL_ROTATION_GUIDE.md)

---

## OAuth 2.0 Security

### Token Lifecycle

```
User Clicks "Connect Google Drive"
           ↓
Google OAuth Popup Opens
           ↓
User Authenticates with Google
           ↓
Google Returns Access Token (1 hour default)
           ↓
startTokenTimeout() Initializes:
  - tokenAcquisitionTime = NOW
  - Schedule warning at 55 minutes
  - Schedule logout at 60 minutes
           ↓
User Can Access Drive Features
           ↓
[55 minutes pass]
           ↓
Toast Warning: "Session expires in 5 minutes"
           ↓
[5 more minutes pass]
           ↓
performTokenTimeout():
  - Revoke token with Google
  - Clear session state
  - Reset UI to signed-out
  - Show "Session expired" message
```

### Implementation

**Constants** (in `app.js`):
```javascript
const TOKEN_TIMEOUT_MS = 60 * 60 * 1000;    // 1 hour
const TOKEN_WARNING_MS = 5 * 60 * 1000;     // 5 min before logout
```

**State Variables:**
```javascript
let tokenAcquisitionTime = null;       // When token was obtained
let tokenTimeoutTimer = null;          // Reference to 60-min timer
let tokenWarningTimer = null;          // Reference to 55-min timer
let tokenWarningShown = false;         // Prevent duplicate warnings
```

**Key Functions:**

- **`startTokenTimeout()`** — Called after successful OAuth sign-in
  - Records token acquisition time
  - Sets 55-minute warning timer
  - Sets 60-minute logout timer

- **`performTokenTimeout()`** — Called when timeout expires
  - Revokes token via `google.accounts.oauth2.revoke(token)`
  - Clears all session state
  - Updates UI (hides Drive buttons, shows Sign In button)
  - Displays "Session expired" toast

- **`resetTokenTimeout()`** — Optional: Reset timer on user activity
  - Not currently enabled but available for future use

### Security Benefits

| Scenario | Mitigation |
|----------|-----------|
| Token leaked via network sniffing | Limited to 1-hour window |
| Token found in browser dev tools | Auto-expires, user warned |
| Token exposed in browser history | Revoked server-side after timeout |
| Session left unattended | Auto-logout prevents misuse |
| Browser cache compromised | Token not in localStorage |

**See also:** [TOKEN_TIMEOUT_GUIDE.md](TOKEN_TIMEOUT_GUIDE.md)

---

## API Key Security

### Restrictions

**Website Restrictions (HTTP Referrer):**
- `https://jayclark5150.github.io/*` — Production deployment
- `http://localhost:8000/*` — Local development
- Wildcard (`*`) NOT used — only specific patterns

**API Restrictions:**
- Limited to **Google Drive API v3** only
- No access to other Google APIs
- Scope limited to authenticated requests

### Configuration

In Google Cloud Console:
1. APIs & Services → Credentials
2. Click your API Key
3. Application restrictions → HTTP referrers
4. API restrictions → Google Drive API

### Why This Matters

An API key can be extracted from network requests if used for public API calls. By restricting it:
- Only authorized domains can use it
- Only Drive API can be accessed
- Reduces blast radius if leaked

### Testing

**Local:**
```bash
python3 -m http.server 8000
# Visit http://localhost:8000
# Drive features should work
```

**Production:**
```bash
# Visit https://jayclark5150.github.io/
# Drive features should work
```

**If "Access Denied" error:**
- Check API key restrictions in Google Cloud Console
- Verify referrer pattern matches domain
- Clear browser cache
- Try incognito window

---

## Content Security Policy

### Policy Header

```
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
```

### Key Directives Explained

| Directive | Setting | Why |
|-----------|---------|-----|
| `default-src` | `'none'` | Deny everything by default (whitelist approach) |
| `script-src` | `'self'` + googleapis | Allow local JS + Google OAuth |
| `style-src` | `'self'` + CDN | No `unsafe-inline` — CSS in external file |
| `font-src` | `'self'` + Google Fonts | Secure font loading |
| `img-src` | `'self'` + data + https | Allow local, embedded, and HTTPS images |
| `connect-src` | `'self'` + googleapis | Only local + Drive API calls |
| `frame-src` | googleapis.com | Google OAuth popup only |
| `worker-src` | `'self'` | Service Worker from local only |
| `form-action` | `'none'` | No form submissions allowed |

### No 'unsafe-inline'

**Before:** `style-src 'self' 'unsafe-inline'`  
**After:** `style-src 'self'`

All inline styles were extracted to `styles.css` during Task #6. This eliminates a major XSS vector where malicious code could inject styles.

### Testing CSP

**Check in browser DevTools Console:**
```javascript
// Should have no CSP violation errors
// If CSP blocks something, you'll see:
// "Refused to load script/style/connect from..."
```

**Validate inline scripts:**
If any `<script>` tags are inline (not external), CSP will block them and show an error.

---

## Data Protection

### What Data Is Stored?

| Data | Location | Protection |
|------|----------|-----------|
| Markdown editor content | Browser memory + Browser IndexedDB | Encrypted on Google Drive (Google's responsibility) |
| OAuth token | Browser memory (NOT localStorage) | Revoked after 1 hour |
| User's Google Drive files | Google Drive servers | User's responsibility / Google's encryption |
| Website usage data | None collected | Privacy by design |

### What Data Is NOT Stored?

- ❌ No cookies
- ❌ No localStorage
- ❌ No sessionStorage
- ❌ No analytics/tracking
- ❌ No third-party services
- ❌ No personal information

### Browser-Only Security

Since this is a static PWA with no backend:
- All computation happens in the browser
- No server logs of user activity
- No data transmission except to Google Drive API
- User has complete control of data

### Markdown Content Security

When rendering markdown to HTML:
1. User enters markdown text
2. `marked` library parses markdown
3. `DOMPurify` sanitizes the HTML (removes scripts, unsafe attributes)
4. Safe HTML displayed in preview
5. Original markdown preserved in editor

**DOMPurify Configuration:**
```javascript
const sanitized = DOMPurify.sanitize(htmlContent, {
  ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'strong', 'em', 'u', 'del', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr', 'br'],
  ALLOWED_ATTR: ['href', 'title', 'src', 'alt']
});
```

This prevents XSS even if markdown contains malicious HTML.

---

## Dependency Management

### Third-Party Libraries

All dependencies use Subresource Integrity (SRI) to prevent CDN tampering:

```html
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"
        integrity="sha256-Ffq85bZYmLMrA/XtJen4kacprUwNbYdxEKd0SqhHqJQ="
        crossorigin="anonymous"></script>
```

**What SRI does:**
- Browser verifies file hash matches `integrity` value
- If CDN returns modified file, browser rejects it
- Prevents attackers from tampering with libraries

### Library List

| Library | Purpose | Version | Source |
|---------|---------|---------|--------|
| marked | Markdown parsing | 12.0.2 | jsdelivr |
| DOMPurify | XSS prevention | 3.1.6 | jsdelivr |
| highlight.js | Code syntax highlighting | 11.9.0 | jsdelivr |
| Turndown | HTML to markdown | 7.2.0 | jsdelivr |
| Google Sign-In | OAuth authentication | Latest | googleapis.com |

### Security Updates

**Procedure:**
1. Check for library updates: `npm outdated`
2. Review changelogs for security patches
3. Update version in HTML `<script>` tag
4. Get new SRI hash: Use [SRI Hash Generator](https://www.srihash.org/)
5. Test locally
6. Commit and deploy

---

## Build & Deployment Security

### GitHub Actions Workflow

**File:** `.github/workflows/deploy.yml`

**Security Features:**

1. **Secrets Management:**
   - Credentials stored in GitHub Secrets
   - Not visible in code or workflow UI
   - Masked in build logs (shown as `***`)

2. **Build-Time Injection:**
   ```yaml
   - name: Generate config
     run: echo "export const GOOGLE_CLIENT_ID = '${{ secrets.GOOGLE_CLIENT_ID }}';" > config.js
   ```
   - Credentials injected during build
   - Final artifact includes credentials
   - Deployment is static (no runtime injection needed)

3. **Automatic Deployment:**
   - Push to main → GitHub Actions triggers
   - Build runs in isolated environment
   - Only successful builds deploy
   - Rollback by reverting commit

4. **Branch Protection:**
   - Recommended: Enable branch protection on main
   - Require PR reviews before merge
   - Require CI checks to pass

### Security Checklist

Before deploying to production:

- [ ] All credentials rotated (old ones deleted)
- [ ] GitHub Secrets configured with new credentials
- [ ] Workflow tested with new secrets
- [ ] No credentials in git history
  ```bash
  git log --all -S "AIzaSy" --oneline
  # Should return empty (no API keys in history)
  ```
- [ ] CSP header verified in deployed page
  ```bash
  # Check CSP in browser DevTools Network tab
  # Look for Content-Security-Policy header
  ```
- [ ] No XSS vulnerabilities in console
- [ ] Token timeout working on production

---

## Incident Response

### Credential Compromise

**If you suspect credentials are exposed:**

1. **Immediate (< 1 hour):**
   - Stop using the compromised credentials
   - Don't push code with exposed credentials

2. **Short-term (< 1 day):**
   - Create new credentials in Google Cloud Console
   - Update GitHub Secrets with new values
   - Push any commit to trigger redeployment
   - Verify deployment uses new credentials

3. **Investigation:**
   - Check git history for exposed credentials:
     ```bash
     git log --all -S "YOUR_OLD_KEY" --oneline
     # If found, credentials may be in public repo
     ```
   - Check GitHub Actions logs for credential leaks:
     - Go to Actions tab
     - Check build logs (should show `***` for secrets)
   - Review Google Cloud Console for unauthorized API usage

4. **Prevention:**
   - Enable branch protection on main
   - Require PR reviews before merge
   - Consider Git pre-commit hooks to prevent committing config.js
   - Regular security audits

### Token Compromise

**If you suspect a user's OAuth token is compromised:**

1. **User should:**
   - Immediately sign out (the 1-hour timeout will also log them out)
   - Clear browser cache and cookies
   - Change Google Account password if concerned

2. **Compromised token:**
   - Limited to 1 hour of use (automatic timeout)
   - Can only access Google Drive (API scope limited)
   - Revoked when user signs out

3. **Your responsibility:**
   - No action needed — tokens are per-user, per-session
   - System automatically logs out users

### XSS Vulnerability

**If a vulnerability is discovered:**

1. **Immediate:**
   - Disable the affected feature if possible
   - Do not deploy new code

2. **Investigation:**
   - Reproduce the vulnerability
   - Determine attack vector
   - Assess impact (data exposure? user harm?)

3. **Fix:**
   - Update CSP if needed
   - Update DOMPurify configuration
   - Add input validation
   - Add test case to prevent regression

4. **Disclosure:**
   - Follow responsible disclosure practices
   - Give users time to update before public disclosure

### Dependency Vulnerability

**If a library has a security vulnerability:**

1. **Check CVE database:**
   - npm audit
   - Snyk.io
   - NVD (nvd.nist.gov)

2. **Assess impact:**
   - Does vulnerability affect this app's usage?
   - Can it be exploited from the browser?

3. **Update:**
   - Update to patched version
   - Get new SRI hash
   - Test locally
   - Deploy

---

## Security Checklist

### Before Production Deployment

- [ ] Credentials rotated (old credentials deleted)
- [ ] GitHub Secrets configured
- [ ] No credentials in git history
- [ ] CSP header in place (no unsafe-inline)
- [ ] DOMPurify configured for markdown sanitization
- [ ] SRI hashes verified for all CDN resources
- [ ] OAuth token timeout implemented (1 hour)
- [ ] Service Worker cache strategy reviewed
- [ ] HTTPS enforced everywhere
- [ ] API key restrictions configured
- [ ] Security documentation complete

### Monthly Security Review

- [ ] Check npm audit for vulnerabilities
- [ ] Review GitHub Secrets access logs
- [ ] Check CSP violations in browser console
- [ ] Test token timeout on staging/dev
- [ ] Verify API key restrictions are still in place

### Annual Security Audit

- [ ] Rotate credentials (even if not compromised)
- [ ] Update library versions (especially security releases)
- [ ] Review threat model for new risks
- [ ] Penetration test (consider hiring professional)
- [ ] Compliance review (GDPR, CCPA, etc.)

---

## References

### Official Documentation

- [OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten/)
- [Content Security Policy (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [Google OAuth 2.0 Implementation](https://developers.google.com/identity/protocols/oauth2)
- [Google Drive API Security](https://developers.google.com/drive/api/guides/security)
- [Subresource Integrity (SRI)](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)

### Internal Documentation

- [CREDENTIAL_ROTATION_GUIDE.md](CREDENTIAL_ROTATION_GUIDE.md) — How to rotate credentials
- [TOKEN_TIMEOUT_GUIDE.md](TOKEN_TIMEOUT_GUIDE.md) — Session timeout details
- [SECURITY_TASKBOARD.md](SECURITY_TASKBOARD.md) — Task tracking and progress
- [SETUP_CREDENTIALS.md](SETUP_CREDENTIALS.md) — Initial credential setup
- [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md) — GitHub Actions secrets config

### Security Tools

- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) — Dependency vulnerability scanner
- [Snyk.io](https://snyk.io/) — Continuous vulnerability monitoring
- [SRI Hash Generator](https://www.srihash.org/) — Generate SRI hashes
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) — Validate CSP policy
- [Mozilla Observatory](https://observatory.mozilla.org/) — Website security scan

### Security Standards

- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001 Information Security](https://www.iso.org/isoiec-27001-information-security-management.html)
- [CWE: Common Weakness Enumeration](https://cwe.mitre.org/)
- [CVSS: Common Vulnerability Scoring System](https://www.first.org/cvss/)

---

## Questions?

For questions about security:

1. **Credential setup:** See [SETUP_CREDENTIALS.md](SETUP_CREDENTIALS.md)
2. **Token timeout:** See [TOKEN_TIMEOUT_GUIDE.md](TOKEN_TIMEOUT_GUIDE.md)
3. **Credential rotation:** See [CREDENTIAL_ROTATION_GUIDE.md](CREDENTIAL_ROTATION_GUIDE.md)
4. **GitHub Secrets:** See [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md)
5. **General security:** See this document

---

**Document Status:** ✅ COMPLETE  
**Last Security Audit:** June 1, 2026  
**Next Audit Due:** June 1, 2027  
**Risk Assessment:** 🟢 LOW (All critical and high-risk items addressed)

*This document reflects security best practices as of June 2026. Review and update annually or after major architectural changes.*
