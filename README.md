# Claude Companion

A native cross-platform desktop app to pair with [Claude Code](https://claude.ai/claude-code). Three-pane workspace: file explorer, embedded terminal running Claude Code, and a live diff/file viewer with syntax highlighting. Available for **macOS**, **Windows**, and **Linux**.

> **Disclaimer:** This is an independent, unofficial project. It is not made by, endorsed by, or affiliated with Anthropic. "Claude" is a trademark of Anthropic, PBC.

## Features

- **File explorer** (left pane) — project tree with git status indicators, drag files to the terminal to add them as context
- **Embedded terminal** (center pane) — runs Claude Code CLI directly, auto-launches on project open
- **Diff & file viewer** (right pane) — live git diffs, commit history, syntax-highlighted file viewer (highlight.js)
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
| Next tab (macOS only) | Ctrl+Tab | — |
| Previous tab (macOS only) | Ctrl+Shift+Tab | — |

## Project Structure

```
main.cjs              Electron main process (per-window state, IPC, node-pty, chokidar)
preload.cjs           IPC bridge (contextBridge API)
index.html            Three-pane layout + CSS (light/dark themes, hljs colors)
src/renderer.js       Renderer logic (xterm.js, file tree, diff viewer, highlight.js)
scripts/              Post-packaging fixes (spawn-helper, icon)
assets/               App icons (.icns for macOS, .ico for Windows, .png for Linux)
electron-builder.yml  Cross-platform build configuration
```

## Tech Stack

- [Electron](https://www.electronjs.org/) — cross-platform desktop framework
- [electron-builder](https://www.electron.build/) — multi-platform packaging and distribution
- [xterm.js](https://xtermjs.org/) + [node-pty](https://github.com/niclas-niclas/node-pty) — embedded terminal
- [highlight.js](https://highlightjs.org/) — syntax highlighting (16 languages)
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
