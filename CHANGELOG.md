# Changelog

All notable changes to Claude Companion are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [2.2.6] - 2026-04-10

### Changed
- Test release to verify internal DMG download update flow from v2.2.5

## [2.2.5] - 2026-04-10

### Fixed
- Update install fallback now downloads the DMG internally (via Electron) instead of opening the browser, avoiding macOS Gatekeeper quarantine ("damaged" error)
- Quarantine attribute automatically removed from downloaded DMG before opening

### Changed
- Install-failed flow: badge shows "Install vX.Y.Z" → downloads DMG to ~/Downloads → removes quarantine → opens DMG in Finder → badge shows "DMG ready — drag to Applications"

## [2.2.4] - 2026-04-10

### Changed
- Test release to verify auto-updater install-failed fallback from v2.2.3

## [2.2.3] - 2026-04-10

### Fixed
- Auto-update install failing on unsigned macOS builds (Squirrel code signature validation)
- When native install fails, the badge now shows "Download vX.Y.Z" linking to the GitHub release page instead of a broken retry loop

### Added
- `install-failed` update status with fallback to opening the release page in the browser
- `open-release-page` IPC channel for manual update downloads

## [2.2.2] - 2026-04-10

### Changed
- Test release to verify auto-updater flow end-to-end

## [2.2.1] - 2026-04-10

### Fixed
- Update badge not responding to clicks — download now shows immediate "Starting download…" feedback on click
- Silent update errors — failed downloads now show a red "Retry update" badge instead of disappearing silently
- Unhandled promise rejection when `downloadUpdate()` fails before the error event fires

### Added
- Error state styling for the update badge (red retry button)
- Stack trace logging for update errors in `~/cc-debug.log`

## [2.2.0] - 2026-04-10

### Added
- Git operations panel — new sidebar tab (Source Control) alongside the file explorer for commit, push, and branch management
- Smart commit message generator that auto-detects change type (feat, fix, chore, test, docs, style) from file paths and diff content
- One-click "Commit All" stages all changes and commits with the generated (or edited) message
- "Commit & Push" button for combined commit + push in a single action
- Standalone "Push" button shown on clean working tree when unpushed commits exist
- Multi-repo support: each repository with changes gets its own independent commit section with separate message, commit, and push buttons
- Ahead/behind tracking — detects unpushed commits per repo via upstream comparison
- SFTP sync — push local project files to remote SFTP servers with a single click
- SFTP configuration modal with support for multiple server profiles per project
- Authentication via password, SSH private key (with passphrase), or SSH agent
- Hierarchical config: root-level config takes priority; subfolder configs available when no root is set
- Per-server ignore patterns (separate from .gitignore) and configurable upload concurrency
- Conflict detection — warns when remote files are newer, with per-file overwrite/skip resolution
- Sync status indicator in the header (syncing/done/error)
- Test connection button to verify SFTP credentials before syncing

### Changed
- Left sidebar now has tabbed navigation (Explorer / Source Control) instead of a fixed file tree

## [2.1.2] - 2026-04-08

### Added
- Recent projects list on the welcome screen — quickly reopen previously opened projects with a single click
- Projects are persisted across sessions via electron-store (up to 10 entries)
- Remove individual projects from the recent list with the X button on hover

## [2.1.1] - 2026-04-07

### Added
- Multi-repo git support — projects without a root `.git` now discover and aggregate changes from nested git repositories
- Git repo indicators in the file tree with branch badges on repo root directories
- Clickable "N repos" header badge with popover listing all discovered repos, branches, and per-repo change counts
- Commits tab merges commits from all sub-repos sorted by date, with repo name badges
- New modular git architecture: `git-discovery.cjs`, `git-multi-repo.cjs`, `git-facade.cjs`

## [2.1.0] - 2026-04-06

### Added
- Inline file editor powered by CodeMirror 6 — click Edit on any file to open a full code editor with syntax highlighting, bracket matching, search/replace, and multi-cursor support
- Save file content from the editor (Save/Cancel buttons in the file header)
- `save-file-content` IPC channel for writing files from the renderer
- CodeMirror language support for JS/TS/JSX/TSX, HTML, CSS, PHP, Python, JSON, Markdown, SQL, XML, YAML
- Light and dark CodeMirror themes matching the app theme

### Changed
- File viewer now shows full file content with syntax highlighting when clicking a changed file, instead of showing only diff hunks
- Changed lines (additions) are highlighted inline with green background in the full file view
- Active file auto-refreshes when the file watcher detects changes
- Horizontal scroll now applies to the full panel content in file viewer, changes, and commits tabs (instead of per-line scroll)
- Diff headers and section borders extend to full scrollable content width

## [2.0.3] - 2026-04-06

### Added
- External file drag-and-drop onto the terminal — dragging files from Finder/Explorer now pastes the file path, matching native terminal behavior
- Shell quoting for dropped file paths containing spaces or special characters
- `webUtils.getPathForFile()` exposed via preload bridge for Electron 33+ compatibility
- Navigation safety net (`will-navigate` prevention) to protect against accidental page navigation

### Fixed
- File drag-and-drop from external sources (Finder/Explorer) not working — `File.path` is unavailable in Electron 33 with `contextIsolation: true`; replaced with `webUtils.getPathForFile()`

## [2.0.2] - 2026-04-05

### Fixed
- `@` key input not working on certain keyboard layouts
- Drag-and-drop from file tree sidebar to terminal
- UI cleanup and minor styling fixes

## [2.0.1] - 2026-04-05

### Fixed
- Project opening failing on first launch
- Terminal newline handling
- Untracked files not appearing in Changes panel

## [2.0.0] - 2026-04-05

### Added
- Modular architecture: split main process into `lib/` modules with dependency injection
- Auto-update support via electron-updater
- Native macOS tabs (`tabbingIdentifier`)
- File watcher with debounced updates
- Resize handles between panes

### Changed
- Renderer entry point modularized into `src/core/` and `src/components/`
- All platform-specific logic isolated in `lib/platform.cjs`
