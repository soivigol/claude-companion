# Claude Companion

A native macOS app to pair with [Claude Code](https://claude.ai/claude-code). Three-pane workspace: file explorer, embedded terminal running Claude Code, and a live diff/file viewer with syntax highlighting.

## Features

- **File explorer** (left pane) — project tree with git status indicators, drag files to the terminal to add them as context
- **Embedded terminal** (center pane) — runs Claude Code CLI directly, auto-launches on project open
- **Diff & file viewer** (right pane) — live git diffs, commit history, syntax-highlighted file viewer (highlight.js)
- **Native macOS tabs** — Cmd+T to open multiple projects, each tab is fully independent
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

Build a standalone `.app` bundle:

```bash
npm run package
```

The app will be at `release/Claude Companion-darwin-arm64/Claude Companion.app`. Drag it to `/Applications` to install.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+T | New tab |
| Ctrl+Tab | Next tab |
| Ctrl+Shift+Tab | Previous tab |
| Cmd+W | Close tab |

## Project Structure

```
main.cjs          Electron main process (per-window state, IPC, node-pty, chokidar)
preload.cjs       IPC bridge (contextBridge API)
index.html        Three-pane layout + CSS (light/dark themes, hljs colors)
src/renderer.js   Renderer logic (xterm.js, file tree, diff viewer, highlight.js)
scripts/          Post-packaging fixes (spawn-helper, icon)
assets/           App icon (.icns, .png)
```

## Tech Stack

- [Electron](https://www.electronjs.org/) — native macOS window with tabs
- [xterm.js](https://xtermjs.org/) + [node-pty](https://github.com/niclas-niclas/node-pty) — embedded terminal
- [highlight.js](https://highlightjs.org/) — syntax highlighting (16 languages)
- [chokidar](https://github.com/paulmillr/chokidar) — filesystem watching
- [esbuild](https://esbuild.github.io/) — renderer bundling
- Git CLI — diffs, status, commit history

## Requirements

- macOS (Apple Silicon or Intel)
- Node.js 20+
- Claude Code CLI installed (`claude` available in PATH)

## License

[MIT](LICENSE)
