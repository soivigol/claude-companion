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
  getRecentCommits, getCommitDiff, clearLayoutCache,
  gitStageAll, gitCommit, gitPush, getRemoteInfo,
} = require('./lib/git-facade.cjs');
const { createLogger } = require('./lib/logger.cjs');
const { getWindowContext, cleanupWindow, createWindow } = require('./lib/window-manager.cjs');
const { setupTerminal } = require('./lib/terminal-setup.cjs');
const { setupWatcher } = require('./lib/file-watcher.cjs');
const { setupIPC } = require('./lib/ipc-handlers.cjs');
const { setupAutoUpdater } = require('./lib/auto-updater.cjs');
const { createRecentProjects } = require('./lib/recent-projects.cjs');
const { createSftpConfig } = require('./lib/sftp-config.cjs');
const { createSftpClient } = require('./lib/sftp-client.cjs');
const { createSftpSync } = require('./lib/sftp-sync.cjs');
const crypto = require('crypto');

const IS_MAC = process.platform === 'darwin';
const windows = new Map();
const { log } = createLogger(path.join(os.homedir(), 'cc-debug.log'));

const terminalDeps = { log, getDefaultShell, getShellArgs, getTerminalEnv };
let sftpConfigRef = null;
const watcherDeps = {
  log, watch, getFileTree, getGitStatus, path,
  onFileTracked: (projectPath, relativePath) => {
    if (sftpConfigRef) sftpConfigRef.addChangedFile(projectPath, relativePath);
  },
};

app.setName('Claude Companion');

// eslint-disable-next-line no-new-func
const loadStore = new Function('return import("electron-store")');
let recentProjects;

app.whenReady().then(async () => {
  const { default: Store } = await loadStore();
  const store = new Store();
  recentProjects = createRecentProjects(store, path);
  const sftpConfig = createSftpConfig(store, crypto);
  sftpConfigRef = sftpConfig;
  const template = buildMenuTemplate(process.platform, app.name, () => spawnWindow());
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  setupIPC({
    windows, log,
    getWindowContext: (webContents) => getWindowContext(windows, webContents, BrowserWindow),
    setupTerminal: (ctx) => setupTerminal(ctx, terminalDeps),
    setupWatcher: (ctx) => setupWatcher(ctx, watcherDeps),
    gitHelpers: { getFileTree, getGitStatus, getGitDiff, getFullDiff, getRecentCommits, getCommitDiff, clearLayoutCache, gitStageAll, gitCommit, gitPush, getRemoteInfo },
    ipcMain, dialog, fs, path, BrowserWindow, recentProjects, sftpConfig, crypto,
  });

  spawnWindow();

  const updater = setupAutoUpdater({ log, windows });
  ipcMain.handle('check-for-updates', () => updater?.checkForUpdates());
  ipcMain.handle('download-update', () => updater?.downloadUpdate());
  ipcMain.handle('install-update', () => updater?.quitAndInstall());
  ipcMain.handle('download-dmg', () => updater?.downloadDmg());
  ipcMain.handle('open-release-page', () => updater?.openReleasePage());

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
