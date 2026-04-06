# Changelog

All notable changes to Claude Companion are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/).

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
