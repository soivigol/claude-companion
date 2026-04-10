function setupAutoUpdater({ log, windows }) {
  const { app, shell } = require('electron');
  const https = require('https');
  const fs = require('fs');
  const path = require('path');
  const { execFile } = require('child_process');

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

  let latestVersion = null;
  let installFailed = false;

  function broadcast(channel, data) {
    for (const [, ctx] of windows) {
      if (ctx.window && !ctx.window.isDestroyed()) {
        ctx.window.webContents.send(channel, data);
      }
    }
  }

  autoUpdater.on('update-available', (info) => {
    latestVersion = info.version;
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
    if (installFailed) {
      broadcast('update-status', { status: 'install-failed', version: latestVersion });
    } else {
      broadcast('update-status', { status: 'error', message: err.message });
    }
  });

  function downloadDmgAndOpen(version) {
    const arch = process.arch === 'arm64' ? '-arm64' : '';
    const filename = `Claude-Companion-${version}${arch}.dmg`;
    const url = `https://github.com/soivigol/claude-companion/releases/download/v${version}/${filename}`;
    const dest = path.join(app.getPath('downloads'), filename);

    log('[updater] downloading DMG internally:', url);
    broadcast('update-status', { status: 'downloading-dmg', version });

    return new Promise((resolve, reject) => {
      const follow = (href) => {
        https.get(href, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            follow(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`DMG download failed: HTTP ${res.statusCode}`));
            return;
          }
          const total = parseInt(res.headers['content-length'], 10) || 0;
          let downloaded = 0;
          const file = fs.createWriteStream(dest);
          res.on('data', (chunk) => {
            downloaded += chunk.length;
            if (total > 0) {
              const percent = Math.round((downloaded / total) * 100);
              broadcast('update-status', { status: 'downloading-dmg-progress', percent, version });
            }
          });
          res.pipe(file);
          file.on('finish', () => {
            file.close(() => {
              log('[updater] DMG saved to:', dest);
              execFile('xattr', ['-cr', dest], (err) => {
                if (err) log('[updater] xattr warning:', err.message);
                shell.openPath(dest).then(() => {
                  log('[updater] DMG opened');
                  broadcast('update-status', { status: 'dmg-ready', version });
                  resolve();
                });
              });
            });
          });
          file.on('error', reject);
        }).on('error', reject);
      };
      follow(url);
    }).catch((err) => {
      log('[updater] DMG download failed:', err.message);
      broadcast('update-status', { status: 'install-failed', version });
      throw err;
    });
  }

  return {
    checkForUpdates: () => autoUpdater.checkForUpdates(),
    downloadUpdate: () => autoUpdater.downloadUpdate().catch((err) => {
      log('[updater] downloadUpdate rejected:', err.message);
      broadcast('update-status', { status: 'error', message: err.message });
      throw err;
    }),
    quitAndInstall: () => {
      installFailed = true;
      autoUpdater.quitAndInstall();
    },
    downloadDmg: () => downloadDmgAndOpen(latestVersion),
    openReleasePage: () => {
      const version = latestVersion || 'latest';
      const url = `https://github.com/soivigol/claude-companion/releases/tag/v${version}`;
      log('[updater] opening release page:', url);
      shell.openExternal(url);
    },
  };
}

module.exports = { setupAutoUpdater };
