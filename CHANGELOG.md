# Changelog

All notable changes to Claude Companion are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [2.2.6] - 2026-04-10

### Added
- Git operations panel — Source Control sidebar tab for commit and push operations
- Smart commit messages — auto-generated conventional-commit-style messages based on changed files and diff analysis (feat, fix, chore, test, docs, style)
- One-click "Commit All" — stages everything and commits with a single click
- "Commit & Push" — combined commit + push action
- Push unpushed commits — after commit-only, a Push button appears on the clean working tree screen
- Multi-repo support — each repository with changes gets its own independent section with separate commit message, commit, and push buttons
- SFTP sync — push to remote SFTP servers with a single click from the header
- Multi-server profiles — configure multiple SFTP servers per project
- SFTP authentication — password, SSH private key (with passphrase), or SSH agent
- Conflict detection — warns when remote files are newer, with per-file overwrite/skip resolution
- Test connection — verify SFTP credentials before syncing

### Changed
- Left sidebar now has tabbed navigation (Explorer / Source Control) similar to VS Code's activity bar
- Sidebar tabs use icon buttons with active indicator

### Fixed
- Auto-update install failing on unsigned macOS builds

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
