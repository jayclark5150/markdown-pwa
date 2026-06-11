# v1.3.0 Release Notes

## What's New

**Focus Mode — Fullscreen Writing**
Focus mode now takes over the entire screen with no toolbar, status bar, or preview pane. Just you and your text. Typewriter scrolling keeps your active line centered as you write. Press F11 or the focus button to enter, Escape to exit.

**Resizable Editor/Preview Split**
Drag the divider between the editor and preview panes to resize them to your liking.

## Improvements

- Google Drive is now the only storage option — local file/directory access has been removed for a cleaner, online-first experience
- Google Drive toolbar icon now matches the monochrome style of all other icons
- Task list items (`- [ ]` / `- [x]`) no longer show a bullet point alongside the checkbox
- Version number now displayed in the status bar
- Added a Markdown cheatsheet (`markdown-cheatsheet.md`) to the repo

## Security

- Hardened credential injection in the GitHub Actions deploy workflow — credentials are now safely escaped using Python's `json.dumps` rather than shell interpolation
- Service worker cache bumped to v3 to ensure all users load fresh files
