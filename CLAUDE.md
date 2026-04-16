# CLAUDE.md

## Project Overview

Claude Companion is a native cross-platform Electron desktop app (macOS, Windows, Linux) that provides a three-pane workspace for pairing with the Claude Code CLI: file explorer (left), embedded terminal (center), and diff/file viewer with syntax highlighting (right).

## Architecture

- **`main.cjs`** — Electron main process orchestrator. Wires per-window state (`windows` Map), IPC handlers, terminal, and file watcher via lib modules.
- **`preload.cjs`** — Context-isolated IPC bridge exposing `window.companion` API to the renderer. Includes `platform` property, `getPathForFile()` (via `webUtils`), auto-update channels, and listener cleanup (disposers).
- **`src/main.js`** — Renderer entry point bundled by esbuild. Imports from `core/` and `components/`, wires cross-module connections, runs init.
- **`src/core/`** — Shared state, API bridge, pure utilities: `api.js`, `state.js`, `diff.js`, `themes-data.js`, `highlight-setup.js`, `editor-setup.js`.
- **`src/components/`** — UI modules: `terminal.js`, `themes.js`, `file-tree.js`, `file-viewer.js`, `viewer.js`, `commits.js`, `status.js`, `resize.js`, `project.js`, `update-banner.js`, `sidebar-tabs.js`, `git-panel.js`, `input-box.js`.
- **`src/components/input-box.js`** — Rich text input box at the bottom of the terminal pane and the primary input surface: larger by default, focused automatically after a project opens. CodeMirror 6 editor with `MatchDecorator`-based syntax highlighting for `/commands`, `@mentions`, and file paths. Autocomplete via `@codemirror/autocomplete` for slash commands (scanned from `~/.claude/skills/` and project `.claude/skills/`) and `@` file/folder mentions (from `state.tree`). Toggle with Cmd/Ctrl+I, persisted in localStorage. Submit strategy in `submitInput()`: every message is wrapped in bracketed paste markers (`\x1b[200~ … \x1b[201~`) and the trailing `\r` is sent ~50ms later on a separate PTY write, so Claude Code treats the payload as a paste and still fires submit. Sending `text + '\r'` in a single write is unreliable even for short messages — the TUI sometimes consumes the `\r` as part of the paste stream instead of as Enter, leaving the text typed but not submitted. Esc returns focus to the terminal for y/n prompts and interactive keystrokes.
- **`src/css/styles.css`** — All application CSS, bundled by esbuild into `dist/main.css`.
- **`index.html`** — Three-pane layout shell. Light and dark theme via `[data-theme]` CSS variables. CSP meta tag.
- **`lib/platform.cjs`** — Pure functions for shell detection, PATH handling, terminal env, window options, and menu templates. All accept overrides for testability.
- **`lib/git-helpers.cjs`** — Pure functions for file tree traversal, git status, diffs, commits, stage, commit, push, and remote info. All accept `projRoot` as parameter.
- **`lib/git-commit-message.cjs`** — Smart commit message generator. Pure function `generateCommitMessage(statusFiles, diffText)` that produces conventional-commit-style messages from file status and diff analysis.
- **`lib/git-discovery.cjs`** — Recursive scanner that finds nested `.git` repos inside a project directory (max depth 4).
- **`lib/git-multi-repo.cjs`** — Aggregates git operations (status, diff, commits) across multiple sub-repos, returning paths relative to the project root.
- **`lib/git-facade.cjs`** — Unified API that auto-detects single-repo vs multi-repo layout and routes to `git-helpers` or `git-multi-repo`. Drop-in replacement for `git-helpers` with layout caching.
- **`lib/logger.cjs`** — Debug log factory (`createLogger`).
- **`lib/window-manager.cjs`** — Window creation, context lookup, cleanup. BrowserWindow injected as parameter.
- **`lib/ipc-handlers.cjs`** — All IPC handler registration. Dependencies injected.
- **`lib/terminal-setup.cjs`** — PTY spawn with dependency injection for platform helpers.
- **`lib/file-watcher.cjs`** — Chokidar watcher setup with debounced updates.
- **`lib/auto-updater.cjs`** — electron-updater wrapper. Broadcasts update status to all windows. Disabled in dev mode.
- **`lib/sftp-config.cjs`** — SFTP config CRUD via electron-store. Factory `createSftpConfig(store, crypto)` with hierarchical resolution (root config overrides subfolder configs).
- **`lib/sftp-client.cjs`** — Transport wrapper around `ssh2-sftp-client`. Factory `createSftpClient(SftpClientClass, fs, log)` with connect/disconnect/stat/upload/mkdir.
- **`lib/sftp-sync.cjs`** — Sync engine with file scanning, ignore pattern matching (picomatch), conflict detection, and concurrent upload orchestration.
- **`src/components/sftp-modal.js`** — SFTP configuration modal UI with server list, form, and test connection.
- **`src/components/sftp-status.js`** — Sync button, status indicator, and conflict resolution dialog.
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

**IMPORTANT — dev workflow**: After code changes, always use `npm run build && npm run rebuild && npm start`. The `rebuild` step recompiles `node-pty` for Electron's architecture. Skipping it is the #1 cause of "terminal not appearing" — see Known Pitfalls below.

## Key Patterns

- **Per-window isolation**: Each window/tab has independent state (`windows` Map). IPC handlers use `BrowserWindow.fromWebContents(event.sender)` to route to the correct context.
- **Platform abstraction**: All platform-specific logic is in `lib/platform.cjs` with injectable overrides — never check `process.platform` directly in main.cjs.
- **Dependency injection**: All lib modules receive dependencies as parameters (no module-level Electron requires) for testability.
- **Pure git helpers**: `lib/git-helpers.cjs` functions accept `projRoot` as parameter. No global state or singletons.
- **Multi-repo support**: Projects without a root `.git` are scanned for nested repos. `lib/git-facade.cjs` transparently routes between single and multi-repo modes, caching the layout per project root.
- **Inline editor**: CodeMirror 6 (`src/core/editor-setup.js`) provides read-only syntax-highlighted file viewing with language auto-detection and theme integration.
- **Modular renderer**: Entry point (`src/main.js`) imports core utilities and components, wires cross-module connections. Circular dependencies broken via setter pattern (`setFileSelectHandler`).
- **Testable design**: Platform, git, diff, logger, and window-manager modules are fully testable with vitest.
- **Native macOS tabs**: `tabbingIdentifier: 'claude-companion'` on BrowserWindow. Each tab is a separate BrowserWindow with its own renderer process.
- **SFTP sync**: Manual push to remote SFTP servers. Config stored in electron-store with hierarchical resolution (root overrides subfolders). Auth via password, SSH key, or agent. Conflict detection warns on remote-newer files. Uses `ssh2-sftp-client` and `picomatch`.
- **Git operations panel**: Sidebar tab (Source Control) with commit, push, and smart message generation. Single-repo: one unified form. Multi-repo: each repo gets its own section with independent commit/push. Detects unpushed commits and shows Push button on clean working tree.
- **Sidebar tabs**: Left sidebar has tabbed navigation (Explorer / Source Control). `src/components/sidebar-tabs.js` handles switching, `state.sidebarTab` tracks active view.
- **Rich input box**: Toggleable CodeMirror 6 editor at the bottom of the terminal pane. Sends plain text to the PTY on Enter. Syntax highlighting for `/commands`, `@mentions`, and file paths via `MatchDecorator`. Autocomplete for slash commands (scanned from skills directories) and `@` file mentions (from `state.tree`). Drag-and-drop from file tree inserts path into editor (not terminal). Multi-line via Shift+Enter, uses `\x1b\r` escape sequence for Claude Code newlines.

## Testing

Ten test suites in `tests/`:
- **`platform.test.js`** — Shell detection, PATH, terminal env, icons, window options, menus (cross-platform assertions)
- **`git-helpers.test.js`** — File tree, git status, diffs, commits (uses temp git repos)
- **`build-validation.test.js`** — File existence, package.json validity, icon headers, esbuild output, API surface
- **`diff.test.js`** — escapeHtml, parseDiff, renderDiff (pure function unit tests)
- **`logger.test.js`** — createLogger factory (writes to temp files)
- **`window-manager.test.js`** — getWindowContext, cleanupWindow, createWindow (mock-based)
- **`sftp-config.test.js`** — Config CRUD, hierarchy resolution, ID stability (in-memory store mock)
- **`sftp-client.test.js`** — Auth resolution (password, key, agent), connection errors (mocked ssh2-sftp-client)
- **`sftp-sync.test.js`** — Ignore matching, file scanning, conflict detection, async pool, sync orchestration
- **`git-commit-message.test.js`** — Smart commit message generation: dependency detection, test/docs/style patterns, single/multi-file, scope extraction

## Debug

- Dev mode auto-opens DevTools (detached)
- Debug log written to `~/cc-debug.log` with timestamps for window/IPC/PTY lifecycle events
- Renderer logs prefixed with `[CC]`

## Known Pitfalls

### Terminal disappears after code changes (zero-dimension fit)

The xterm terminal can render as invisible (0 rows) when `fitAddon.fit()` is called before the CSS grid layout has fully settled. This happens intermittently during development when the renderer reloads.

**Root cause**: `openProject` shows the `.app` grid and then immediately initializes the terminal. If the browser hasn't completed a layout paint yet, the terminal container has `clientHeight === 0`, so `fit()` computes zero dimensions.

**Prevention**: Always use `requestAnimationFrame` (double-nested for paint guarantee) instead of `setTimeout` when waiting for layout before terminal operations. The `fitTerminal()` function must guard against zero-dimension containers and skip the fit call. The `fitTerminalWhenReady()` helper retries via rAF until the container is visible, with a frame-count cap and fallback timeout.

**If you hit this**: Never use a fixed `setTimeout` delay to wait for CSS grid layout. Always use `requestAnimationFrame` + dimension checks. Also force a synchronous reflow (`appEl.offsetHeight`) after toggling `display: none → grid`.

### Terminal invisible after adding/changing sibling elements in the terminal pane

Adding or modifying elements that share the `.terminal-pane` flex container (e.g. the input box below `#terminal`) can cause xterm to render with 0 rows. The `ResizeObserver` fires during the layout transition when the terminal container momentarily has zero height.

**Root cause**: Any code that calls `fitAddon.fit()` directly (without zero-dimension guards) during a flex layout shift will compute 0 rows. This includes `ResizeObserver` callbacks, `EditorView.updateListener` handlers from CodeMirror, or any resize-triggered logic.

**Prevention rules for any code that triggers `fitAddon.fit()`**:
1. **Never call `fitAddon.fit()` directly** — always call `fitTerminal()` which guards against zero-dimension containers.
2. **Always use `requestAnimationFrame`** when responding to layout changes from sibling elements (e.g. CodeMirror geometry updates) before calling `fitTerminal()`.
3. **`ResizeObserver` callbacks** must use `fitTerminal()`, not inline `fitAddon.fit()` calls.
4. **After toggling sibling visibility** (e.g. showing/hiding the input box), call `requestAnimationFrame(() => fitTerminal())` to let the flex layout settle first.

**If you hit this**: Check that no code path calls `fitAddon.fit()` without dimension guards. Search for `fitAddon.fit` — every call site should be inside `fitTerminal()` or have equivalent `clientHeight > 0 && clientWidth > 0` checks.

### Terminal missing — node-pty native rebuild required

The `node-pty` native binary (`pty.node`) can become invalid (wrong architecture or stale linking) after `npm install`, `npm run build`, or any code changes that trigger a full dev restart. The terminal silently fails to load — the app opens, the terminal pane is visible, but no shell/PTY content appears. The error only shows in `~/cc-debug.log` as `FAILED to load node-pty: dlopen(...incompatible architecture...)`.

**This is the most common cause of "the terminal disappeared after code changes."**

**Prevention**: **Always run `npm run rebuild` before `npm start`** when testing changes. The safe dev workflow is:
```bash
npm run build && npm run rebuild && npm start
```

**If you hit this**: Check `~/cc-debug.log` for `FAILED to load node-pty`. If present, run `npm run rebuild` then `npm start`.

## Changelog

Maintain `CHANGELOG.md` at the project root following [Keep a Changelog](https://keepachangelog.com/) format:
- Update the changelog with every version bump
- Group changes under: `Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`
- Each release has a `## [version] - YYYY-MM-DD` header
- Write entries from the user's perspective (what changed, not implementation details)
- Keep the `[Unreleased]` section at the top for work-in-progress (move to a version header on release)

## File Ignore List (tree and watcher)

node_modules, .git, .next, .cache, __pycache__, dist, build, .turbo, .vercel, .nuxt, vendor, .wp-cli, wp-content/uploads, .svn, coverage. The `.claude/` directory is always included.
