# Changelog

All notable changes to Claude Companion are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [2.2.91] - 2026-04-17

### Fixed
- Pressing Enter in the rich input box now reliably submits every message to Claude Code. Short single-line messages used to land in the prompt without firing submit because the trailing carriage return was consumed as part of the text stream. All messages are now sent via bracketed paste (`\x1b[200~ … \x1b[201~`) with the `\r` on a separate, slightly delayed PTY write so Enter is always recognized as submit

## [2.2.9] - 2026-04-17

### Changed
- Rich text input is now the primary input — larger by default (120–320px tall, 96px min editor), focused automatically after opening a project
- Placeholder text updated to highlight `/`, `@`, and `Esc` shortcuts; the footer hint now documents `Esc to focus terminal`

### Fixed
- Pressing Enter in the rich editor now submits the message directly to Claude Code instead of leaving the text sitting in the prompt — PTY writes are consolidated into a single call so the trailing carriage return is processed as Enter
- Large or multi-line messages are now wrapped in bracketed paste markers (`\x1b[200~ … \x1b[201~`) so Claude Code treats them as a paste and the submit keystroke fires afterwards

## [2.2.8] - 2026-04-16

### Added
- Rich text input box — a CodeMirror 6-powered editor fixed at the bottom of the terminal pane for composing messages to Claude Code with syntax highlighting
- Slash command autocomplete — type `/` to see a dropdown of all available commands and skills (scanned from `~/.claude/skills/` and project `.claude/skills/`)
- File mention autocomplete — type `@` to browse and insert project files and folders from the tree
- Toggle input box visibility with Cmd+I / Ctrl+I (persists across sessions)
- Drag-and-drop files from the sidebar into the rich editor inserts the path as text (cursor moves to end)
- Multi-line composition with Shift+Enter, submitted with Enter
- Theme-aware styling — input box and autocomplete dropdown follow light/dark theme

### Fixed
- Terminal ResizeObserver called `fitAddon.fit()` without zero-dimension guards, causing invisible terminal when sibling elements changed the flex layout
- Drag-and-drop from sidebar no longer fires in both the terminal and input box simultaneously

## [2.2.7] - 2026-04-11

### Added
- FTP protocol support — configure servers for plain FTP in addition to SFTP, with automatic default port switching (21 for FTP, 22 for SFTP)
- Right-click context menu on folders — sync a specific folder from the file tree when it has an SFTP/FTP config, with "Sync changed files" and "Upload all files" options
- Nested folder sync — right-click any descendant of a configured folder to sync just that subtree, preserving the relative path on the remote server
- Upload status now shows in the bottom status bar with an animated upload icon while syncing

### Changed
- Sync button in the header is now disabled correctly when a folder sync is triggered from the right-click menu
- Folder sync from the context menu only clears the changed-files tracking for files inside that folder, leaving other pending changes intact

### Fixed
- Pending upload badge counted files outside any configured context, showing misleading numbers
- Sync to subfolder configs (non-root context) was silently uploading zero files due to a path prefix mismatch between tracked changed files and the file list
- Renderer bundle dead code and minor file-tree rendering glitches after recent drag changes

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
