function getWindowContext(windows, webContents, BrowserWindow) {
  const win = BrowserWindow.fromWebContents(webContents);
  return win ? windows.get(win.id) : null;
}

function cleanupWindow(windows, id, log) {
  const ctx = windows.get(id);
  if (!ctx) return;
  if (ctx.ptyProcess) { try { ctx.ptyProcess.kill(); } catch {} }
  if (ctx.watcher) { try { ctx.watcher.close(); } catch {} }
  windows.delete(id);
  log('[main] window cleaned up:', id);
}

function createWindow(windows, log, { getWindowOptions, BrowserWindow, isPackaged, indexPath }) {
  const windowOptions = getWindowOptions(process.platform, require('path').dirname(indexPath));
  const win = new BrowserWindow(windowOptions);
  windows.set(win.id, { window: win, ptyProcess: null, watcher: null, projectRoot: null });
  win.on('closed', () => cleanupWindow(windows, win.id, log));
  win.loadFile(indexPath);
  if (!isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
  log('[main] window created:', win.id);
  return win;
}

module.exports = { getWindowContext, cleanupWindow, createWindow };
