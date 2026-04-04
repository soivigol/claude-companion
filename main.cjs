const { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { watch } = require('chokidar');

const {
  getDefaultShell, getDefaultPath, getShellArgs, getTerminalEnv,
  getAppIcon, getWindowOptions, buildMenuTemplate,
} = require('./lib/platform.cjs');
const {
  getFileTree, getGitStatus, getGitDiff, getFullDiff,
  getRecentCommits, getCommitDiff,
} = require('./lib/git-helpers.cjs');

const IS_MAC = process.platform === 'darwin';

// --- Per-window state ---
// Each tab/window gets its own project, terminal, and watcher.
const windows = new Map(); // windowId → { window, ptyProcess, watcher, projectRoot }

// Debug log
const logFile = path.join(os.homedir(), 'cc-debug.log');
function log(...args) {
  const msg = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  fs.appendFileSync(logFile, msg);
}
fs.writeFileSync(logFile, '');

// --- Helpers ---

function getWindowContext(webContents) {
  const win = BrowserWindow.fromWebContents(webContents);
  return win ? windows.get(win.id) : null;
}

function cleanupWindow(id) {
  const ctx = windows.get(id);
  if (!ctx) return;
  if (ctx.ptyProcess) { try { ctx.ptyProcess.kill(); } catch {} }
  if (ctx.watcher) { try { ctx.watcher.close(); } catch {} }
  windows.delete(id);
  log('[main] window cleaned up:', id);
}

// --- App lifecycle ---

app.setName('Claude Companion');

app.whenReady().then(() => {
  setupMenu();
  setupIPC();
  createWindow();

  if (IS_MAC) {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(nativeImage.createFromPath(iconPath));
    }
  }
});

app.on('window-all-closed', () => {
  for (const [id] of windows) cleanupWindow(id);
  app.quit();
});

// --- Menu ---

function setupMenu() {
  const template = buildMenuTemplate(process.platform, app.name, () => createWindow());
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- Window ---

function createWindow() {
  const windowOptions = getWindowOptions(process.platform, __dirname);
  const win = new BrowserWindow(windowOptions);

  windows.set(win.id, { window: win, ptyProcess: null, watcher: null, projectRoot: null });

  win.on('closed', () => cleanupWindow(win.id));

  win.loadFile('index.html');

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  log('[main] window created:', win.id);
  return win;
}

// --- IPC ---

function setupIPC() {
  ipcMain.handle('select-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      message: 'Select a project directory',
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('open-project', (event, folderPath) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx) return null;

    // Cleanup previous project in this window
    if (ctx.ptyProcess) { try { ctx.ptyProcess.kill(); } catch {} ctx.ptyProcess = null; }
    if (ctx.watcher) { try { ctx.watcher.close(); } catch {} ctx.watcher = null; }

    ctx.projectRoot = path.resolve(folderPath);
    log('[main] open-project:', ctx.projectRoot, 'window:', ctx.window.id);

    try { setupTerminal(ctx); } catch (err) {
      log('[main] terminal setup failed:', err.message, err.stack);
    }
    try { setupWatcher(ctx); } catch (err) {
      log('[main] watcher setup failed:', err.message);
    }

    // Set tab title to project name
    ctx.window.setTitle(path.basename(ctx.projectRoot));

    return { root: path.basename(ctx.projectRoot), fullPath: ctx.projectRoot };
  });

  ipcMain.handle('get-project-info', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return null;
    return { root: path.basename(ctx.projectRoot), fullPath: ctx.projectRoot };
  });

  ipcMain.handle('get-file-tree', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { root: '', tree: [] };
    return { root: path.basename(ctx.projectRoot), tree: getFileTree(ctx.projectRoot, ctx.projectRoot) };
  });

  ipcMain.handle('get-git-status', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { isGit: false, files: [], branch: null };
    return getGitStatus(ctx.projectRoot);
  });

  ipcMain.handle('get-diff', (event, file) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return null;
    return file ? getGitDiff(ctx.projectRoot, file) : getFullDiff(ctx.projectRoot);
  });

  ipcMain.handle('get-file-content', (event, filePath) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project' };
    const fullPath = path.join(ctx.projectRoot, filePath);
    if (!fullPath.startsWith(ctx.projectRoot)) return { error: 'Forbidden' };
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return { content, path: filePath, ext: path.extname(filePath).slice(1) };
    } catch {
      return { error: 'Not found' };
    }
  });

  ipcMain.handle('get-commits', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return [];
    return getRecentCommits(ctx.projectRoot, 20);
  });

  ipcMain.handle('get-commit-diff', (event, hash) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return null;
    return getCommitDiff(ctx.projectRoot, hash);
  });

  // Terminal — use event.sender to find the right PTY
  ipcMain.on('terminal-input', (event, data) => {
    const ctx = getWindowContext(event.sender);
    if (ctx?.ptyProcess) ctx.ptyProcess.write(data);
  });

  ipcMain.on('terminal-resize', (event, { cols, rows }) => {
    const ctx = getWindowContext(event.sender);
    try { if (ctx?.ptyProcess) ctx.ptyProcess.resize(cols, rows); } catch {}
  });

  ipcMain.on('terminal-restart', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx) return;
    if (ctx.ptyProcess) { try { ctx.ptyProcess.kill(); } catch {} ctx.ptyProcess = null; }
    if (ctx.projectRoot) setupTerminal(ctx);
  });
}

// --- Terminal (node-pty) ---

function setupTerminal(ctx) {
  let pty;
  try {
    pty = require('node-pty');
  } catch (err) {
    log('[main] FAILED to load node-pty:', err.message);
    if (ctx.window && !ctx.window.isDestroyed()) {
      ctx.window.webContents.send('terminal-output',
        `\r\n  Error: Could not load terminal module.\r\n  ${err.message}\r\n`);
    }
    return;
  }

  const shell = getDefaultShell();
  const shellArgs = getShellArgs();
  const termEnv = getTerminalEnv(shell);

  ctx.ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: ctx.projectRoot,
    env: termEnv,
  });

  log('[main] pty spawned, pid:', ctx.ptyProcess.pid, 'window:', ctx.window.id);

  ctx.ptyProcess.onData((data) => {
    if (ctx.window && !ctx.window.isDestroyed()) {
      ctx.window.webContents.send('terminal-output', data);
    }
  });

  ctx.ptyProcess.onExit(({ exitCode }) => {
    log('[main] pty exited:', exitCode, 'window:', ctx.window.id);
    if (ctx.window && !ctx.window.isDestroyed()) {
      ctx.window.webContents.send('terminal-exit', exitCode);
    }
  });

  setTimeout(() => {
    if (ctx.ptyProcess) ctx.ptyProcess.write('claude\n');
  }, 400);
}

// --- File watcher ---

function setupWatcher(ctx) {
  ctx.watcher = watch(ctx.projectRoot, {
    ignored: /(node_modules|\.git|\.next|dist|build|__pycache__|\.cache|\.turbo|\.vercel|vendor)/,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
  });

  let debounceTimer;
  const debouncedUpdate = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (ctx.window && !ctx.window.isDestroyed()) {
        ctx.window.webContents.send('file-change', {
          tree: { root: path.basename(ctx.projectRoot), tree: getFileTree(ctx.projectRoot, ctx.projectRoot) },
          status: getGitStatus(ctx.projectRoot),
        });
      }
    }, 500);
  };

  ctx.watcher
    .on('add', debouncedUpdate)
    .on('change', debouncedUpdate)
    .on('unlink', debouncedUpdate)
    .on('addDir', debouncedUpdate)
    .on('unlinkDir', debouncedUpdate);
}
