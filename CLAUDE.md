# CLAUDE.md

## Project Overview

Claude Companion is a native cross-platform Electron desktop app (macOS, Windows, Linux) that provides a three-pane workspace for pairing with the Claude Code CLI: file explorer (left), embedded terminal (center), and diff/file viewer with syntax highlighting (right).

## Architecture

- **`main.cjs`** — Electron main process orchestrator. Wires per-window state (`windows` Map), IPC handlers, terminal, and file watcher via lib modules.
- **`preload.cjs`** — Context-isolated IPC bridge exposing `window.companion` API to the renderer. Includes `platform` property, `getPathForFile()` (via `webUtils`), auto-update channels, and listener cleanup (disposers).
- **`src/main.js`** — Renderer entry point bundled by esbuild. Imports from `core/` and `components/`, wires cross-module connections, runs init.
- **`src/core/`** — Shared state, API bridge, pure utilities: `api.js`, `state.js`, `diff.js`, `themes-data.js`, `highlight-setup.js`, `editor-setup.js`.
- **`src/components/`** — UI modules: `terminal.js`, `themes.js`, `file-tree.js`, `file-viewer.js`, `viewer.js`, `commits.js`, `status.js`, `resize.js`, `project.js`, `update-banner.js`.
- **`src/css/styles.css`** — All application CSS, bundled by esbuild into `dist/main.css`.
- **`index.html`** — Three-pane layout shell. Light and dark theme via `[data-theme]` CSS variables. CSP meta tag.
- **`lib/platform.cjs`** — Pure functions for shell detection, PATH handling, terminal env, window options, and menu templates. All accept overrides for testability.
- **`lib/git-helpers.cjs`** — Pure functions for file tree traversal, git status, diffs, commits. All accept `projRoot` as parameter.
- **`lib/logger.cjs`** — Debug log factory (`createLogger`).
- **`lib/window-manager.cjs`** — Window creation, context lookup, cleanup. BrowserWindow injected as parameter.
- **`lib/ipc-handlers.cjs`** — All IPC handler registration. Dependencies injected.
- **`lib/terminal-setup.cjs`** — PTY spawn with dependency injection for platform helpers.
- **`lib/file-watcher.cjs`** — Chokidar watcher setup with debounced updates.
- **`lib/auto-updater.cjs`** — electron-updater wrapper. Broadcasts update status to all windows. Disabled in dev mode.
- **`electron-builder.yml`** — Cross-platform build config with GitHub publish. `asarUnpack: node-pty/**`.

## Commands

```bash
npm install          # Install dependencies
npm run rebuild      # Rebuild native modules (node-pty) for Electron
npm start            # Build renderer + launch in dev mode (DevTools auto-open)
npm test             # Run all tests (vitest)
npm run test:watch   # Vitest watch mode
npm run build        # Bundle src/main.js → dist/main.js via esbuild
npm run package      # Build for all platforms via electron-builder
npm run package:mac  # macOS only (.dmg, .zip)
npm run package:win  # Windows only (.exe)
npm run package:linux # Linux only (.AppImage, .deb)
```

## Key Patterns

- **Per-window isolation**: Each window/tab has independent state (`windows` Map). IPC handlers use `BrowserWindow.fromWebContents(event.sender)` to route to the correct context.
- **Platform abstraction**: All platform-specific logic is in `lib/platform.cjs` with injectable overrides — never check `process.platform` directly in main.cjs.
- **Dependency injection**: All lib modules receive dependencies as parameters (no module-level Electron requires) for testability.
- **Pure git helpers**: `lib/git-helpers.cjs` functions accept `projRoot` as parameter. No global state or singletons.
- **Modular renderer**: Entry point (`src/main.js`) imports core utilities and components, wires cross-module connections. Circular dependencies broken via setter pattern (`setFileSelectHandler`).
- **Testable design**: Platform, git, diff, logger, and window-manager modules are fully testable with vitest.
- **Native macOS tabs**: `tabbingIdentifier: 'claude-companion'` on BrowserWindow. Each tab is a separate BrowserWindow with its own renderer process.

## Testing

Six test suites in `tests/`:
- **`platform.test.js`** — Shell detection, PATH, terminal env, icons, window options, menus (cross-platform assertions)
- **`git-helpers.test.js`** — File tree, git status, diffs, commits (uses temp git repos)
- **`build-validation.test.js`** — File existence, package.json validity, icon headers, esbuild output, API surface
- **`diff.test.js`** — escapeHtml, parseDiff, renderDiff (pure function unit tests)
- **`logger.test.js`** — createLogger factory (writes to temp files)
- **`window-manager.test.js`** — getWindowContext, cleanupWindow, createWindow (mock-based)

## Debug

- Dev mode auto-opens DevTools (detached)
- Debug log written to `~/cc-debug.log` with timestamps for window/IPC/PTY lifecycle events
- Renderer logs prefixed with `[CC]`

## Changelog

Maintain `CHANGELOG.md` at the project root following [Keep a Changelog](https://keepachangelog.com/) format:
- Update the changelog with every version bump
- Group changes under: `Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`
- Each release has a `## [version] - YYYY-MM-DD` header
- Write entries from the user's perspective (what changed, not implementation details)
- Keep the `[Unreleased]` section at the top for work-in-progress (move to a version header on release)

## File Ignore List (tree and watcher)

node_modules, .git, .next, .cache, __pycache__, dist, build, .turbo, .vercel, .nuxt, vendor, .wp-cli, wp-content/uploads, .svn, coverage. The `.claude/` directory is always included.
