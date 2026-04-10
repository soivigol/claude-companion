function setupAutoUpdater({ log, windows }) {
  const { app } = require('electron');

  if (!app.isPackaged) {
    log('[updater] skipping auto-updater in dev mode');
    return null;
  }

  let autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (err) {
    log('[updater] failed to load electron-updater:', err.message);
    return null;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  function broadcast(channel, data) {
    for (const [, ctx] of windows) {
      if (ctx.window && !ctx.window.isDestroyed()) {
        ctx.window.webContents.send(channel, data);
      }
    }
  }

  autoUpdater.on('update-available', (info) => {
    log('[updater] update available:', info.version);
    broadcast('update-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    log('[updater] no update available');
  });

  autoUpdater.on('download-progress', (progress) => {
    broadcast('update-status', { status: 'downloading', percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log('[updater] update downloaded:', info.version);
    broadcast('update-status', { status: 'ready', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    log('[updater] error:', err.message);
    log('[updater] error stack:', err.stack);
    broadcast('update-status', { status: 'error', message: err.message });
  });

  return {
    checkForUpdates: () => autoUpdater.checkForUpdates(),
    downloadUpdate: () => autoUpdater.downloadUpdate().catch((err) => {
      log('[updater] downloadUpdate rejected:', err.message);
      broadcast('update-status', { status: 'error', message: err.message });
      throw err;
    }),
    quitAndInstall: () => autoUpdater.quitAndInstall(),
  };
}

module.exports = { setupAutoUpdater };
