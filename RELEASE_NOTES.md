# Markdown Editor - Release Notes

## Latest Updates

### OneDrive Integration (NEW)
The markdown editor now supports **Microsoft OneDrive** for cloud file storage, alongside existing Google Drive support. This parallel implementation allows users to choose between Google Drive and OneDrive for their file synchronization needs.

**Features:**
- ✅ OAuth 2.0 authentication with personal Microsoft accounts
- ✅ File browser and picker modal UI
- ✅ Open, create, rename, and delete files in OneDrive
- ✅ Auto-save with configurable 2-second debounce
- ✅ Automatic token refresh (1-hour validity)
- ✅ Seamless switching between OneDrive and Google Drive

**Setup:** Configure Azure app credentials in `config.js` with `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID`, and `MICROSOFT_REDIRECT_URI`.

---

## Toolbar Icon Reference

| Icon | Name | Keyboard Shortcut | Purpose |
|------|------|-------------------|---------|
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIi8+PHBhdGggZD0iTTkgM3YxOCIvPjwvc3ZnPg==) | File Browser | — | Toggle the file sidebar to browse local files |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0iY3VycmVudENvbG9yIj48cGF0aCBkPSJNMiAxLjc1QzIgLjc4NCAyLjc4NCAwIDMuNzUgMGg2LjU4NmMuNDY0IDAgLjkwOS4xODQgMS4yMzcuNTEzbDIuOTE0IDIuOTE0Yy4zMjkuMzI4LjUxMy43NzMuNTEzIDEuMjM3djkuNTg2QTEuNzUgMS43NSAwIDAgMSAxMy4yNSAxNmgtOS41QTEuNzUgMS43NSAwIDAgMSAyIDE0LjI1Wm0xLjc1LS4yNWEuMjUuMjUgMCAwIDAtLjI1LjI1djEyLjVjMCAuMTM4LjExMi4yNS4yNS4yNWg5LjVhLjI1LjI1IDAgMCAwIC4yNS0uMjVWNmgtMi43NUExLjc1IDEuNzUgMCAwIDEgOSA0LjI1VjEuNVptNi43NS4wNjJWNC4yNWMwIC4xMzguMTEyLjI1LjI1LjI1aDIuNjg4bC0uMDExLS4wMTMtMi45MTQtMi45MTQtLjAxMy0uMDExWiIvPjwvc3ZnPg==) | New Document | Ctrl+N | Create a new blank document |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0iY3VycmVudENvbG9yIj48cGF0aCBkPSJNMS43NSAxQTEuNzUgMS43NSAwIDAgMCAwIDIuNzV2MTAuNUMwIDE0LjIxNi43ODQgMTUgMS43NSAxNWgxMi41QTEuNzUgMS43NSAwIDAgMCAxNiAxMy4yNXYtOC41QTEuNzUgMS43NSAwIDAgMCAxNC4yNSAzSDcuNWEuMjUuMjUgMCAwIDEtLjItLjFsLS45LTEuMkM2LjA3IDEuMjYgNS41NSAxIDUgMVoiLz48L3N2Zz4=) | Open File | Ctrl+O | Open a markdown file from your computer |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0iY3VycmVudENvbG9yIj48cGF0aCBkPSJNMi43NSAxNEExLjc1IDEuNzUgMCAwIDEgMSAxMi4yNXYtMTAuNUMxIC43ODQgMS43ODQgMCAyLjc1IDBozLjU4NmMuNDY0IDAgLjkwOS4xODQgMS4yMzcuNTEzbDIuOTE0IDIuOTE0Yy4zMjkuMzI4LjUxMy43NzMuNTEzIDEuMjM3djcuODM2QTEuNzUgMS43NSAwIDAgMSAxMy4yNSAxNFptMC0xMi41YS4yNS4yNSAwIDAgMC0uMjUuMjV2MTAuNWMwIC4xMzguMTEyLjI1LjI1LjI1aDEwLjVhLjI1LjI1IDAgMCAwIC4yNS0uMjVWNC42NjRhLjI1LjI1IDAgMCAwLS4wNzMtLjE3N2wtMi45MTQtMi45MTRhLjI1LjI1IDAgMCAwLS4xNzctLjA3M1pNOCAxMS41YTEuNSAxLjUgMCAxIDEgMC0zIDEuNSAxLjUgMCAwIDEgMCAzWk02Ljc1IDRoMi41YS43NS43NSAwIDAgMSAwIDEuNWgtMi41YS43NS43NSAwIDAgMSAwLTEuNVoiLz48L3N2Zz4=) | Save File | Ctrl+S | Save changes to local file |
| ![Google Drive logo](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODcuMyIgaGVpZ2h0PSI3OCIgdmlld0JveD0iMCAwIDg3LjMgNzgiPjxwYXRoIGQ9Im02LjYgNjYuODUgMy44NSA2LjY1Yy44IDEuNCAxLjk1IDIuNSAzLjMgMy4zbDEzLjc1LTIzLjhoLTI3LjVjMCAxLjU1LjQgMy4xIDEuMiA0LjV6IiBmaWxsPSIjMDA2NmRhIi8+PHBhdGggZD0ibTQzLjY1IDI1LTEzLjc1LTIzLjhjLTEuMzUuOC0yLjUgMS45LTMuMyAzLjNsLTI1LjQgNDRhOS4wNiA5LjA2IDAgMCAwIC0xLjIgNC41aDI3LjV6IiBmaWxsPSIjMDBhYzQ3Ii8+PHBhdGggZD0ibTczLjU1IDc2LjhjMS4zNS0uOCAyLjUtMS45IDMuMy0zLjNsMS42LTIuNzUgNy42NS0xMy4yNWMuOC0xLjQgMS4yLTIuOTUgMS4yLTQuNWgtMjcuNTAybDUuODUyIDExLjV6IiBmaWxsPSIjZWE0MzM1Ii8+PHBhdGggZD0ibTQzLjY1IDI1IDEzLjc1LTIzLjhjLTEuMzUtLjgtMi45LTEuMi00LjUtMS4yaC0xOC41Yy0xLjYgMC0zLjE1LjQ1LTQuNSAxLjJ6IiBmaWxsPSIjMDA4MzJkIi8+PHBhdGggZD0ibTU5LjggNTNoLTMyLjNsLTEzLjc1IDIzLjhjMS4zNS44IDIuOSAxLjIgNC41IDEuMmg1MC44YzEuNiAwIDMuMTUtLjQ1IDQuNS0xLjJ6IiBmaWxsPSIjMjY4NGZjIi8+PHBhdGggZD0ibTczLjQgMjYuNS0xMi43LTIyYy0uOC0xLjQtMS45NS0yLjUtMy4zLTMuM2wtMTMuNzUgMjMuOGwxNi4xNSAyOGgyNy40NWMwLTEuNTUtLjQtMy4xLTEuMi00LjV6IiBmaWxsPSIjZmZiYTAwIi8+PC9zdmc+) | Google Drive | — | Connect to Google Drive (when disconnected) |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCI+PHBvbHlsaW5lIHBvaW50cz0iNyAxMCAxMiAxNSAxNyAxMCI+PjxsaW5lIHgxPSIxMiIgeTE9IjE1IiB4Mj0iMTIiIHkyPSIzIj48L3N2Zz4=) | Open from Drive | — | Open a file from Google Drive |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCI+PHBvbHlsaW5lIHBvaW50cz0iMTcgOCAxMiAzIDcgOCI+PjxsaW5lIHgxPSIxMiIgeTE9IjMiIHgyPSIxMiIgeTI9IjE1Ij48L3N2Zz4=) | Save to Drive | — | Save current file to Google Drive |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTkgMjFINWEyIDIgMCAwIDEtMi0yVjVhMiAyIDAgMCAxIDItMmgxMWw1IDV2MTFhMiAyIDAgMCAxLTIgMnoiPjwvcG9seWxpbmUgcG9pbnRzPSIxNyAyMSAxNyAxMyA3IDEzIDcgMjEiPjwvcG9seWxpbmUgcG9pbnRzPSI3IDMgNyA4IDE1IDgiPjwvc3ZnPg==) | Save As | — | Save current file with new name to Drive |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMjBoOSI+PHBhdGggZD0iTTE2LjUgMy41YTIuMTIxIDIuMTIxIDAgMCAxIDMgM0w3IDE5SDR2LTNMMTYuNSAzLjV6Ij48L3N2Zz4=) | Rename | — | Rename the currently open cloud file |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSIzIDYgNSA2IDIxIDYiPjwvcG9seWxpbmUgPHBhdGggZD0iTTE5IDZ2MTRhMiAyIDAgMCAxLTIgMkg3YTIgMiAwIDAgMS0yLTJWNm0zIDBWNGEyIDIgMCAwIDEgMi0yaDRhMiAyIDAgMCAxIDIgMnYyIj48bGluZSB4MT0iMTAiIHkxPSIxMSIgeDI9IjEwIiB5Mj0iMTciPjwvbGluZT48bGluZSB4MT0iMTQiIHkxPSIxMSIgeDI9IjE0IiB5Mj0iMTciPjwvc3ZnPg==) | Delete | — | Delete the currently open cloud file (red) |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0iY3VycmVudENvbG9yIj48cGF0aCBkPSJNMiAyLjc1QzIgMS43ODQgMi43ODQgMSAzLjc1IDFoMi41YS43NS43NSAwIDAgMSAwIDEuNWgtMi41YS4yNS4yNSAwIDAgMC0uMjUuMjV2MTAuNWMwIC4xMzguMTEyLjI1LjI1LjI1aDIuNWEuNzUuNzUgMCAwIDEgMCAxLjVoLTIuNUExLjc1IDEuNzUgMCAwIDEgMiAxMy4yNVptNi41NiA0LjVoNC42OWwtMS4yMi0xLjIyYS43NS43NSAwIDEgMSAxLjA2LTEuMDZsMi41IDIuNWEuNzUuNzUgMCAwIDEgMCAxLjA2bC0yLjUgMi41YS43NDkuNzQ5IDAgMCAxLTEuMDYtMS4wNmwxLjIyLTEuMjJIOC41NmEuNzUuNzUgMCAwIDEgMC0xLjVaIi8+PC9zdmc+) | Sign Out | — | Sign out of Google Drive (red) |
| ![OneDrive logo](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iY3VycmVudENvbG9yIj48cGF0aCBkPSJNMjMuMyA4LjNjMC0uMS0uMS0uMi0uMS0uMyAwLS4xIDAtLjItLjEtLjMgMC0uMS0uMS0uMi0uMi0uMyAwLS4xLS4xLS4yLS4yLS4yIDAgMCAwLS4xLS4xLS4xTDEyLjUuNGMtLjMtLjItLjgtLjItMS4xIDBMLjkgNy4yYy0uMSAwLS4xLjEtLjEuMSEtLjEuMS0uMS4yLS4yLjIgMCAuMS0uMS4yLS4yLjMgMCAuMS0uMS4yLS4xLjMgMCAuMSAwIC4yLS4xLjMgMCAuMyAwIC42LjEuOXY5LjRjMCAuOS43IDEuNiAxLjYgMS42aDIuOXYtNS44YzAtMS4xLjktMiAyLTJoNmMxLjEgMCAyIC45IDIgMnY1LjhoMi45Yy45IDAgMS42LS43IDEuNi0xLjZWOS4yYy4xLS4zLjEtLjYuMS0uOVoiLz48L3N2Zz4=) | OneDrive | — | Connect to OneDrive (when disconnected) |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCI+PHBvbHlsaW5lIHBvaW50cz0iNyAxMCAxMiAxNSAxNyAxMCI+PjxsaW5lIHgxPSIxMiIgeTE9IjE1IiB4Mj0iMTIiIHkyPSIzIj48L3N2Zz4=) | Open from OneDrive | — | Open a file from OneDrive |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTkgMjFINWEyIDIgMCAwIDEtMi0yVjVhMiAyIDAgMCAxIDItMmgxMWw1IDV2MTFhMiAyIDAgMCAxLTIgMnoiPjwvcG9seWxpbmUgcG9pbnRzPSIxNyAyMSAxNyAxMyA3IDEzIDcgMjEiPjwvcG9seWxpbmUgcG9pbnRzPSI3IDMgNyA4IDE1IDgiPjwvc3ZnPg==) | Save to OneDrive as | — | Save current file to OneDrive |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMjBoOSI+PHBhdGggZD0iTTE2LjUgMy41YTIuMTIxIDIuMTIxIDAgMCAxIDMgM0w3IDE5SDR2LTNMMTYuNSAzLjV6Ij48L3N2Zz4=) | Rename OneDrive File | — | Rename file on OneDrive |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSIzIDYgNSA2IDIxIDYiPjwvcG9seWxpbmUgPHBhdGggZD0iTTE5IDZ2MTRhMiAyIDAgMCAxLTIgMkg3YTIgMiAwIDAgMS0yLTJWNm0zIDBWNGEyIDIgMCAwIDEgMi0yaDRhMiAyIDAgMCAxIDIgMnYyIj48bGluZSB4MT0iMTAiIHkxPSIxMSIgeDI9IjEwIiB5Mj0iMTciPjwvbGluZT48bGluZSB4MT0iMTQiIHkxPSIxMSIgeDI9IjE0IiB5Mj0iMTciPjwvc3ZnPg==) | Delete from OneDrive | — | Delete file from OneDrive (red) |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0iY3VycmVudENvbG9yIj48cGF0aCBkPSJNMiAyLjc1QzIgMS43ODQgMi43ODQgMSAzLjc1IDFoMi41YS43NS43NSAwIDAgMSAwIDEuNWgtMi41YS4yNS4yNSAwIDAgMC0uMjUuMjV2MTAuNWMwIC4xMzguMTEyLjI1LjI1LjI1aDIuNWEuNzUuNzUgMCAwIDEgMCAxLjVoLTIuNUExLjc1IDEuNzUgMCAwIDEgMiAxMy4yNVptNi41NiA0LjVoNC42OWwtMS4yMi0xLjIyYS43NS43NSAwIDEgMSAxLjA2LTEuMDZsMi41IDIuNWEuNzUuNzUgMCAwIDEgMCAxLjA2bC0yLjUgMi41YS43NDkuNzQ5IDAgMCAxLTEuMDYtMS4wNmwxLjIyLTEuMjJIOC41NmEuNzUuNzUgMCAwIDEgMC0xLjVaIi8+PC9zdmc+) | Sign out of OneDrive | — | Sign out of OneDrive (red) |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0iY3VycmVudENvbG9yIj48cGF0aCBkPSJNMTAuNjggMTEuNzRhNiA2IDAgMCAxLTcuOTIyLTguOTgyIDYgNiAwIDAgMSA4Ljk4MiA3LjkyMmwzLjA0IDMuMDRhLjc0OS43NDkgMCAwIDEtLjMyNiAxLjI3NS43NDkuNzQ5IDAgMCAxLS43MzQtLjIxNVpNMTEuNSA3YTQuNDk5IDQuNDk5IDAgMSAwLTguOTk3IDBBNC40OTkgNC40OTkgMCAwIDAgMTEuNSA3WiIvPjwvc3ZnPg==) | Find & Replace | Ctrl+F | Open find and replace dialog |
| ![](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS43NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNOCAzSDS1hYS4yNS4yNSAwIDAgMS0uMi0uMWwtLjktMS4yQzYuMDcgMS4yNiA1LjU1IDEgNSAxWiI+PC9wYXRoIj48cGF0aCBkPSJNMjEgOFY1YTIgMiAwIDAgMC0yLTJoLTMiPjwvcGF0aD48cGF0aCBkPSJNMyAxNnYzYTIgMiAwIDAgMCAyIDJoMyI+PC9wYXRoPjxwYXRoIGQ9Ik0xNiAyMWgzYTIgMiAwIDAgMCAyLTJ2LTMiPjwvcGF0aD48L3N2Zz4=) | Focus Mode | F11 | Full-screen distraction-free editing |

---

## File Storage Options

### Local Storage
- Save files directly to your computer
- No cloud account required
- Best for offline work

### Google Drive
- Cloud storage with Google accounts
- Real-time sync and backup
- Automatic version history
- Configure credentials in `config.js`

### OneDrive (NEW)
- Cloud storage with Microsoft accounts
- Auto-save with 2-second debounce
- Automatic token refresh
- Configure Azure app credentials in `config.js`

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+N** | Create new document |
| **Ctrl+O** | Open file from computer |
| **Ctrl+S** | Save file |
| **Ctrl+F** | Find & Replace |
| **Ctrl+** (plus) | Zoom in |
| **Ctrl+** (minus) | Zoom out |
| **F11** | Toggle Focus Mode |

---

## Configuration

### Azure App Registration (OneDrive)
To enable OneDrive support:

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new app registration
3. Add credentials (Web platform, Redirect URI: `http://localhost:3000/`)
4. Copy `Application (client) ID` and Tenant ID
5. Update `config.js`:
   ```javascript
   MICROSOFT_CLIENT_ID: 'your-client-id',
   MICROSOFT_TENANT_ID: 'common',
   MICROSOFT_REDIRECT_URI: 'http://localhost:3000/'
   ```

For production, update redirect URI to your deployed URL (must be HTTPS).

### Google Drive Setup
1. Visit [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Copy credentials to `config.js`

---

## Features

- ✅ Real-time markdown preview
- ✅ Side-by-side editor and preview
- ✅ Local file browser
- ✅ Google Drive integration with auto-save
- ✅ OneDrive integration with auto-save
- ✅ Find & Replace functionality
- ✅ Focus mode for distraction-free writing
- ✅ Zoom controls
- ✅ Responsive design for mobile
- ✅ Progressive Web App (installable)
- ✅ Service worker for offline support

---

## Known Limitations

- OneDrive file picker requires valid Azure app credentials to access real files
- Browser popup blocking may prevent OAuth flows
- Auto-save only works when connected to cloud storage

---

## Version History

### v1.2.0 (Current)
- Added OneDrive integration
- Parallel cloud storage support (Google Drive + OneDrive)
- Local MSAL stub for development
- Updated toolbar icon reference

### v1.1.0
- Google Drive integration
- Auto-save functionality
- Focus mode

### v1.0.0
- Initial release
- Local file support
- Markdown preview

---

## Support

For issues or feature requests, please check:
- `ONEDRIVE_SETUP_STEPS.md` - OneDrive configuration guide
- `ONEDRIVE_INTEGRATION.md` - Technical architecture details
- `config.example.js` - Configuration template
