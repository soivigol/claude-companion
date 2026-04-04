# CLAUDE.md

## Project Overview

Claude Companion is a native cross-platform Electron desktop app (macOS, Windows, Linux) that provides a three-pane workspace for pairing with the Claude Code CLI: file explorer (left), embedded terminal (center), and diff/file viewer with syntax highlighting (right).

## Architecture

- **`main.cjs`** — Electron main process. Per-window state via `windows` Map (each tab/window has its own project root, PTY process, and file watcher). Uses `lib/platform.cjs` for platform abstraction and `lib/git-helpers.cjs` for git/fs operations.
- **`preload.cjs`** — Context-isolated IPC bridge exposing `window.companion` API to the renderer. Includes `platform` property for CSS-level platform detection.
- **`src/renderer.js`** — Renderer logic bundled by esbuild. xterm.js terminal, file tree, diff viewer, syntax highlighting (highlight.js), drag-to-terminal, light/dark theme toggle.
- **`index.html`** — Three-pane layout with all CSS inline. Light and dark theme via `[data-theme]` CSS variables. Platform-specific header padding via `.platform-darwin`.
- **`lib/platform.cjs`** — Pure functions for shell detection, PATH handling, terminal env, window options, and menu templates. All functions accept platform/env overrides for testability.
- **`lib/git-helpers.cjs`** — Pure functions for file tree traversal, git status, diffs, commits. All accept `projRoot` as parameter (no global state).
- **`electron-builder.yml`** — Cross-platform build config. Key: `asarUnpack: node-pty/**` for native module support.
- **`scripts/fix-package.cjs`** — Legacy post-package fixes for @electron/packager builds (spawn-helper copy, icon replacement). electron-builder handles these automatically.

## Commands

```bash
npm install          # Install dependencies
npm run rebuild      # Rebuild native modules (node-pty) for Electron
npm start            # Build renderer + launch in dev mode (DevTools auto-open)
npm test             # Run all tests (vitest)
npm run test:watch   # Vitest watch mode
npm run build        # Bundle src/renderer.js → dist/renderer.js via esbuild
npm run package      # Build for all platforms via electron-builder
npm run package:mac  # macOS only (.dmg, .zip)
npm run package:win  # Windows only (.exe)
npm run package:linux # Linux only (.AppImage, .deb)
```

## Key Patterns

- **Per-window isolation**: Each window/tab has independent state (`windows.Map`). IPC handlers use `BrowserWindow.fromWebContents(event.sender)` to route to the correct context.
- **Platform abstraction**: All platform-specific logic is in `lib/platform.cjs` with injectable overrides — never check `process.platform` directly in main.cjs.
- **Pure git helpers**: `lib/git-helpers.cjs` functions accept `projRoot` as parameter. No global state or singletons.
- **Testable design**: Platform and git modules are fully testable with vitest. Tests create temp git repos for isolation.
- **Native macOS tabs**: `tabbingIdentifier: 'claude-companion'` on BrowserWindow. Each tab is a separate BrowserWindow with its own renderer process.

## Testing

Three test suites in `tests/`:
- **`platform.test.js`** — Shell detection, PATH, terminal env, icons, window options, menus (cross-platform assertions)
- **`git-helpers.test.js`** — File tree, git status, diffs, commits (uses temp git repos)
- **`build-validation.test.js`** — File existence, package.json validity, icon headers, esbuild output, API surface

## Debug

- Dev mode auto-opens DevTools (detached)
- Debug log written to `~/cc-debug.log` with timestamps for window/IPC/PTY lifecycle events
- Renderer logs prefixed with `[CC]`

## File Ignore List (tree and watcher)

node_modules, .git, .next, .cache, __pycache__, dist, build, .turbo, .vercel, .nuxt, vendor, .wp-cli, wp-content/uploads, .svn, coverage. The `.claude/` directory is always included.
