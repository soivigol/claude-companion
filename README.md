# Claude Companion

A native cross-platform desktop app to pair with [Claude Code](https://claude.ai/claude-code). Three-pane workspace: file explorer, embedded terminal running Claude Code, and a live diff/file viewer with syntax highlighting. Available for **macOS**, **Windows**, and **Linux**.

> **Disclaimer:** This is an independent, unofficial project. It is not made by, endorsed by, or affiliated with Anthropic. "Claude" is a trademark of Anthropic, PBC.

## Download

| Platform | Download | Notes |
|----------|----------|-------|
| macOS (Apple Silicon) | [.dmg](https://github.com/soivigol/claude-companion/releases/download/v2.2.91/Claude.Companion-2.2.91-arm64.dmg) | M1/M2/M3/M4 |
| macOS (Intel) | [.dmg](https://github.com/soivigol/claude-companion/releases/download/v2.2.91/Claude.Companion-2.2.91.dmg) | Intel Macs |
| Windows | [Installer .exe](https://github.com/soivigol/claude-companion/releases/download/v2.2.91/Claude.Companion.Setup.2.2.91.exe) | Standard installer |
| Windows | [Portable .exe](https://github.com/soivigol/claude-companion/releases/download/v2.2.91/Claude.Companion.2.2.91.exe) | No install required |
| Linux | [.AppImage](https://github.com/soivigol/claude-companion/releases/download/v2.2.91/Claude.Companion-2.2.91.AppImage) | Universal |
| Linux | [.deb](https://github.com/soivigol/claude-companion/releases/download/v2.2.91/claude-companion_2.2.91_amd64.deb) | Debian/Ubuntu |

[All releases](https://github.com/soivigol/claude-companion/releases)

## Features

- **File explorer** (left pane) — project tree with git status indicators, drag files to the terminal to add them as context
- **Embedded terminal** (center pane) — runs Claude Code CLI directly, auto-launches on project open
- **Rich text input** (bottom of terminal) — compose messages with syntax highlighting for `/commands` and `@file` mentions, autocomplete for slash commands (including project skills) and project files/folders
- **Diff & file viewer** (right pane) — live git diffs, commit history, syntax-highlighted file viewer with inline change highlights
- **Inline code editor** — edit files directly with CodeMirror 6 (syntax highlighting, bracket matching, search/replace, multi-cursor)
- **Git operations panel** — Source Control tab in the sidebar for one-click commit and push with smart auto-generated commit messages
- **Multi-repo git** — projects with multiple nested repos get independent commit/push sections per repository
- **SFTP & FTP sync** — push files to remote SFTP or plain FTP servers with configurable profiles, ignore patterns, and conflict detection. Right-click any folder (including nested descendants of a configured folder) to sync just that subtree, preserving the remote path structure
- **Native tabs on macOS** — Cmd+T to open multiple projects, each tab is fully independent
- **Multi-window support** — open multiple projects simultaneously on any platform
- **Light/dark theme** — toggle with the button in the header, persists across sessions
- **Live file watching** — tree and diffs update in real time as Claude makes changes
- **Resizable panes** — drag the handles between panes

## Quick Start

```bash
# Clone the repo
git clone https://github.com/your-user/claude-companion.git
cd claude-companion

# Install dependencies
npm install

# Rebuild native modules for Electron
npm run rebuild

# Run in development mode
npm start
```

A folder picker dialog will appear. Select a project directory and Claude Code will launch in the terminal pane.

## Packaging

Build a standalone app for your platform:

```bash
# Build for your current platform
npm run package

# Or build for a specific platform
npm run package:mac      # macOS → .dmg and .zip (arm64 + x64)
npm run package:win      # Windows → .exe installer and portable .exe (x64)
npm run package:linux    # Linux → .AppImage and .deb (x64)

# Build for all platforms at once (requires running on macOS)
npm run package:all
```

### Output locations

All builds are saved to the `release/` directory:

| Platform | Formats | Notes |
|----------|---------|-------|
| macOS | `.dmg`, `.zip` | Universal: builds for both Apple Silicon (arm64) and Intel (x64) |
| Windows | `.exe` (NSIS installer), portable `.exe` | x64. The installer allows choosing the install directory |
| Linux | `.AppImage`, `.deb` | x64. AppImage runs on most distros without installation |

> **Note:** Cross-compilation (e.g. building Windows from macOS) requires additional tools. Building for all platforms simultaneously with `package:all` works best from macOS. For CI/CD, use platform-specific runners.

## Keyboard Shortcuts

| Shortcut | macOS | Windows / Linux |
|----------|-------|-----------------|
| New window/tab | Cmd+T | Ctrl+T |
| Close window | Cmd+W | Alt+F4 |
| Toggle rich input | Cmd+I | Ctrl+I |
| Next tab (macOS only) | Ctrl+Tab | — |
| Previous tab (macOS only) | Ctrl+Shift+Tab | — |

## Project Structure

```
main.cjs              Electron main process orchestrator
preload.cjs           IPC bridge (contextBridge API)
index.html            Three-pane layout shell (light/dark themes via CSS variables)
src/
  main.js             Renderer entry point (bundled by esbuild)
  core/               Shared state, API bridge, pure utilities
  components/         UI modules (terminal, file-tree, viewer, commits, themes…)
  css/styles.css      All application CSS
lib/
  platform.cjs        Shell detection, PATH, terminal env, window/menu options
  git-helpers.cjs     File tree, git status, diffs, commits, stage, push (pure functions)
  git-commit-message.cjs  Smart commit message generator
  git-facade.cjs      Unified single/multi-repo routing
  git-multi-repo.cjs  Aggregates git ops across nested repos
  git-discovery.cjs   Discovers nested .git repos
  ipc-handlers.cjs    All IPC handler registration
  terminal-setup.cjs  PTY spawn with dependency injection
  file-watcher.cjs    Chokidar watcher setup
  window-manager.cjs  Window creation, context lookup, cleanup
  auto-updater.cjs    electron-updater wrapper
  sftp-config.cjs     SFTP config CRUD via electron-store
  sftp-client.cjs     SFTP transport wrapper (ssh2-sftp-client)
  sftp-sync.cjs       Sync engine with conflict detection
  logger.cjs          Debug log factory
scripts/              Post-packaging fixes (spawn-helper, icon)
assets/               App icons (.icns, .ico, .png)
electron-builder.yml  Cross-platform build configuration
```

## Tech Stack

- [Electron](https://www.electronjs.org/) — cross-platform desktop framework
- [electron-builder](https://www.electron.build/) — multi-platform packaging and distribution
- [xterm.js](https://xtermjs.org/) + [node-pty](https://github.com/niclas-niclas/node-pty) — embedded terminal
- [highlight.js](https://highlightjs.org/) — syntax highlighting in file viewer
- [CodeMirror 6](https://codemirror.net/) — inline code editor
- [chokidar](https://github.com/paulmillr/chokidar) — filesystem watching
- [esbuild](https://esbuild.github.io/) — renderer bundling
- Git CLI — diffs, status, commit history

## Requirements

- **macOS** (Apple Silicon or Intel), **Windows** 10+ (x64), or **Linux** (x64, Ubuntu 20.04+/Debian-based recommended)
- Node.js 20+
- Claude Code CLI installed (`claude` available in PATH)
- Git installed and available in PATH

## Platform Notes

- **macOS**: Native tab support, hidden titlebar with traffic light buttons, uses your default shell (typically zsh)
- **Windows**: Standard window chrome, uses PowerShell by default (falls back to cmd.exe)
- **Linux**: Standard window chrome, uses your default shell (typically bash). AppImage format works on most distributions without installation

## License

[MIT](LICENSE)
