function setupIPC({ windows, log, getWindowContext, setupTerminal, setupWatcher, gitHelpers, ipcMain, dialog, fs, path, BrowserWindow }) {
  const { getFileTree, getGitStatus, getGitDiff, getFullDiff, getRecentCommits, getCommitDiff } = gitHelpers;

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

  ipcMain.handle('save-file-content', (event, filePath, content) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project' };
    const fullPath = path.join(ctx.projectRoot, filePath);
    if (!fullPath.startsWith(ctx.projectRoot)) return { error: 'Forbidden' };
    try {
      fs.writeFileSync(fullPath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { error: err.message };
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

module.exports = { setupIPC };
