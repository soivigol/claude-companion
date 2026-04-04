const { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { watch } = require('chokidar');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';

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
  const template = [];

  // macOS app menu (only on darwin)
  if (IS_MAC) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push(
    {
      label: 'File',
      submenu: [
        { label: 'New Window', accelerator: 'CmdOrCtrl+T', click: () => createWindow() },
        { type: 'separator' },
        ...(IS_MAC ? [{ role: 'close' }] : [{ role: 'quit' }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        ...(IS_MAC ? [{ role: 'zoom' }] : []),
        { type: 'separator' },
        ...(IS_MAC
          ? [
              { label: 'Show Next Tab', accelerator: 'Ctrl+Tab', selector: 'selectNextTab:' },
              { label: 'Show Previous Tab', accelerator: 'Ctrl+Shift+Tab', selector: 'selectPreviousTab:' },
              { type: 'separator' },
              { role: 'front' },
            ]
          : []),
      ],
    },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- Window ---

function getAppIcon() {
  if (IS_WIN) {
    const icoPath = path.join(__dirname, 'assets', 'icon.ico');
    if (fs.existsSync(icoPath)) return icoPath;
  }
  return path.join(__dirname, 'assets', 'icon.png');
}

function createWindow() {
  const windowOptions = {
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 500,
    title: 'Claude Companion',
    backgroundColor: '#ffffff',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  // macOS-specific window chrome
  if (IS_MAC) {
    windowOptions.tabbingIdentifier = 'claude-companion';
    windowOptions.titleBarStyle = 'hiddenInset';
    windowOptions.trafficLightPosition = { x: 14, y: 14 };
  }

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

function getDefaultShell() {
  if (IS_WIN) return process.env.COMSPEC || 'powershell.exe';
  return process.env.SHELL || (IS_MAC ? '/bin/zsh' : '/bin/bash');
}

function getDefaultPath() {
  const envPath = process.env.PATH || '';
  if (IS_WIN) return envPath;
  if (IS_MAC) {
    const macDefault = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin';
    return envPath.includes('/usr/local/bin') ? envPath : `${macDefault}:${envPath}`;
  }
  // Linux
  const linuxDefault = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
  return envPath.includes('/usr/local/bin') ? envPath : `${linuxDefault}:${envPath}`;
}

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
  const shellArgs = IS_WIN ? [] : ['--login'];
  const fullPath = getDefaultPath();

  ctx.ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: ctx.projectRoot,
    env: {
      ...process.env,
      PATH: fullPath,
      HOME: process.env.HOME || os.homedir(),
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      ...(IS_WIN ? {} : { SHELL: shell }),
    },
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

// --- Git / FS helpers (all accept projectRoot as parameter) ---

function getGitRoot(projRoot) {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd: projRoot }).toString().trim();
  } catch {
    return null;
  }
}

function getFileTree(dir, projRoot, depth = 0, maxDepth = 6) {
  if (depth > maxDepth) return [];

  const ignore = new Set([
    'node_modules', '.git', '.next', '.cache', '__pycache__',
    'dist', 'build', '.turbo', '.vercel', '.nuxt', 'vendor',
    '.wp-cli', 'wp-content/uploads', '.svn', 'coverage',
  ]);

  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  items = items
    .filter((i) => !i.name.startsWith('.') || i.name === '.claude')
    .filter((i) => !ignore.has(i.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const entries = [];
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(projRoot, fullPath);

    if (item.isDirectory()) {
      entries.push({
        name: item.name,
        path: relativePath,
        type: 'directory',
        children: getFileTree(fullPath, projRoot, depth + 1, maxDepth),
      });
    } else {
      entries.push({
        name: item.name,
        path: relativePath,
        type: 'file',
        ext: path.extname(item.name).slice(1),
      });
    }
  }

  return entries;
}

function getGitStatus(projRoot) {
  const gitRoot = getGitRoot(projRoot);
  if (!gitRoot) return { isGit: false, files: [], branch: null };

  try {
    const branch = execSync('git branch --show-current', { cwd: projRoot }).toString().trim();
    const raw = execSync('git status --porcelain', { cwd: projRoot }).toString().trim();

    const statusMap = {
      M: 'modified', A: 'added', D: 'deleted', '??': 'untracked',
      R: 'renamed', MM: 'modified', AM: 'added', UU: 'conflict',
    };

    const files = raw.split('\n').filter(Boolean).map((line) => {
      const status = line.substring(0, 2).trim();
      return { status, path: line.substring(3), statusLabel: statusMap[status] || 'changed' };
    });

    return { isGit: true, files, branch };
  } catch {
    return { isGit: false, files: [], branch: null };
  }
}

function getGitDiff(projRoot, filePath) {
  if (!getGitRoot(projRoot)) return null;
  try {
    let diff = execSync(`git diff --no-color -- "${filePath}"`, {
      cwd: projRoot, maxBuffer: 5 * 1024 * 1024,
    }).toString();

    if (!diff) {
      diff = execSync(`git diff --cached --no-color -- "${filePath}"`, {
        cwd: projRoot, maxBuffer: 5 * 1024 * 1024,
      }).toString();
    }

    if (!diff) {
      const fullPath = path.join(projRoot, filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').map((l) => `+${l}`).join('\n');
        diff = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${content.split('\n').length} @@\n${lines}`;
      }
    }

    return diff || null;
  } catch {
    return null;
  }
}

function getFullDiff(projRoot) {
  if (!getGitRoot(projRoot)) return null;
  try {
    const buf = 10 * 1024 * 1024;
    let diff = execSync('git diff --no-color', { cwd: projRoot, maxBuffer: buf }).toString();
    const staged = execSync('git diff --cached --no-color', { cwd: projRoot, maxBuffer: buf }).toString();
    if (staged) diff = staged + '\n' + diff;
    return diff || null;
  } catch {
    return null;
  }
}

function getRecentCommits(projRoot, count = 10) {
  try {
    const raw = execSync(
      `git log --oneline --no-decorate -n ${count} --format="%h|||%s|||%cr|||%an"`,
      { cwd: projRoot }
    ).toString().trim();
    return raw.split('\n').filter(Boolean).map((line) => {
      const [hash, message, time, author] = line.split('|||');
      return { hash, message, time, author };
    });
  } catch {
    return [];
  }
}

function getCommitDiff(projRoot, hash) {
  try {
    return execSync(`git show --no-color ${hash}`, {
      cwd: projRoot, maxBuffer: 10 * 1024 * 1024,
    }).toString();
  } catch {
    return null;
  }
}
