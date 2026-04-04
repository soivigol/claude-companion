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
const { createLogger } = require('./lib/logger.cjs');
const { getWindowContext, cleanupWindow, createWindow } = require('./lib/window-manager.cjs');
const { setupTerminal } = require('./lib/terminal-setup.cjs');
const { setupWatcher } = require('./lib/file-watcher.cjs');
const { setupIPC } = require('./lib/ipc-handlers.cjs');
const { setupAutoUpdater } = require('./lib/auto-updater.cjs');

const IS_MAC = process.platform === 'darwin';
const windows = new Map();
const { log } = createLogger(path.join(os.homedir(), 'cc-debug.log'));

const terminalDeps = { log, getDefaultShell, getShellArgs, getTerminalEnv };
const watcherDeps = { log, watch, getFileTree, getGitStatus, path };

app.setName('Claude Companion');

app.whenReady().then(() => {
  const template = buildMenuTemplate(process.platform, app.name, () => spawnWindow());
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  setupIPC({
    windows, log,
    getWindowContext: (webContents) => getWindowContext(windows, webContents, BrowserWindow),
    setupTerminal: (ctx) => setupTerminal(ctx, terminalDeps),
    setupWatcher: (ctx) => setupWatcher(ctx, watcherDeps),
    gitHelpers: { getFileTree, getGitStatus, getGitDiff, getFullDiff, getRecentCommits, getCommitDiff },
    ipcMain, dialog, fs, path, BrowserWindow,
  });

  spawnWindow();

  const updater = setupAutoUpdater({ log, windows });
  if (updater) {
    ipcMain.handle('check-for-updates', () => updater.checkForUpdates());
    ipcMain.handle('download-update', () => updater.downloadUpdate());
    ipcMain.handle('install-update', () => updater.quitAndInstall());
  }

  if (IS_MAC) {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(nativeImage.createFromPath(iconPath));
    }
  }
});

app.on('window-all-closed', () => {
  for (const [id] of windows) cleanupWindow(windows, id, log);
  app.quit();
});

function spawnWindow() {
  return createWindow(windows, log, {
    getWindowOptions, BrowserWindow,
    isPackaged: app.isPackaged,
    indexPath: path.join(__dirname, 'index.html'),
  });
}
