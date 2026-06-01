# GitHub Actions Secrets Setup

Your GitHub Actions workflow now uses secrets to inject credentials at deploy time. Follow these steps to set them up.

## Step 1: Go to GitHub Repository Settings

1. Go to: https://github.com/jayclark5150/markdown-pwa
2. Click **Settings** (top right)
3. In the left sidebar, click **Secrets and variables** → **Actions**

## Step 2: Add GOOGLE_CLIENT_ID Secret

1. Click **New repository secret**
2. Fill in:
   - **Name:** `GOOGLE_CLIENT_ID`
   - **Value:** `505353054413-0mi7s88ai4p320f89ghhi8m58h6sde29.apps.googleusercontent.com`
3. Click **Add secret**

## Step 3: Add GOOGLE_API_KEY Secret

1. Click **New repository secret** again
2. Fill in:
   - **Name:** `GOOGLE_API_KEY`
   - **Value:** `AIzaSyCjlYUDBRr16VuWwrmx-Zf36NXSpjgn7bo`
3. Click **Add secret**

## Step 4: Verify Secrets Are Set

After adding both secrets, you should see:
- ✅ `GOOGLE_CLIENT_ID`
- ✅ `GOOGLE_API_KEY`

Both should show as "Updated X seconds ago"

## Step 5: Deploy and Test

Once secrets are set up:

1. Push the workflow update:
   ```bash
   git add .github/workflows/deploy.yml
   git commit -m "chore: update deploy workflow to use client ID and API key secrets"
   git push origin main
   ```

2. GitHub Actions will automatically run
   - Go to: https://github.com/jayclark5150/markdown-pwa/actions
   - You should see the deployment in progress

3. Once deployed, test at your GitHub Pages URL:
   - https://jayclark5150.github.io/markdown-pwa/
   - Sign in to Google Drive
   - Test all features (open, save, rename, delete)

## Security Notes

✅ **What's secure now:**
- Secrets are masked in build logs (shows `***` instead of actual values)
- Credentials are only visible in the workflow file
- No credentials in git history
- No credentials in source code
- Different credentials can be used per environment

## Troubleshooting

**If deployment fails:**
1. Check the Actions tab for error messages
2. Verify secrets are correctly named: `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY` (exact spelling)
3. Verify secret values are correct (no extra spaces)
4. Check that the workflow file has the correct environment variable names

**If sign-in fails on GitHub Pages:**
1. Check browser console for errors
2. Verify API key restrictions in Google Cloud Console allow your GitHub Pages domain
3. Verify OAuth Client ID is configured for your GitHub Pages URL
