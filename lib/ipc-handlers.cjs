function setupIPC({ windows, log, getWindowContext, setupTerminal, setupWatcher, gitHelpers, ipcMain, dialog, fs, path, BrowserWindow, recentProjects, sftpConfig, crypto }) {
  const { getFileTree, getGitStatus, getGitDiff, getFullDiff, getRecentCommits, getCommitDiff, clearLayoutCache, gitStageAll, gitCommit, gitPush, getRemoteInfo } = gitHelpers;
  const { generateCommitMessage } = require('./git-commit-message.cjs');

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
    if (clearLayoutCache) clearLayoutCache(ctx.projectRoot);
    log('[main] open-project:', ctx.projectRoot, 'window:', ctx.window.id);
    try { setupTerminal(ctx); } catch (err) {
      log('[main] terminal setup failed:', err.message, err.stack);
    }
    try { setupWatcher(ctx); } catch (err) {
      log('[main] watcher setup failed:', err.message);
    }
    ctx.window.setTitle(path.basename(ctx.projectRoot));
    if (recentProjects) recentProjects.add(ctx.projectRoot);
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

  // ── Git write operations ────────────────────────────────

  ipcMain.handle('git-stage-all', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project open' };
    return gitStageAll(ctx.projectRoot);
  });

  ipcMain.handle('git-commit', (event, message) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project open' };
    return gitCommit(ctx.projectRoot, message);
  });

  ipcMain.handle('git-push', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project open' };
    return gitPush(ctx.projectRoot);
  });

  ipcMain.handle('git-get-remote-info', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { hasRemote: false, remoteName: null, remoteUrl: null };
    return getRemoteInfo(ctx.projectRoot);
  });

  ipcMain.handle('git-generate-commit-message', (event, repoFilter) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return '';
    const status = getGitStatus(ctx.projectRoot);
    let files = status.files;
    if (repoFilter) {
      files = files.filter((f) => f.repo === repoFilter);
    }
    const diff = getFullDiff(ctx.projectRoot);
    return generateCommitMessage(files, diff);
  });

  ipcMain.handle('git-stage-all-repo', (event, repoName) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project open' };
    const repoPath = path.join(ctx.projectRoot, repoName);
    if (!repoPath.startsWith(ctx.projectRoot)) return { error: 'Invalid repo path' };
    const { gitStageAll: stageAll } = require('./git-helpers.cjs');
    return stageAll(repoPath);
  });

  ipcMain.handle('git-commit-repo', (event, repoName, message) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project open' };
    const repoPath = path.join(ctx.projectRoot, repoName);
    if (!repoPath.startsWith(ctx.projectRoot)) return { error: 'Invalid repo path' };
    const { gitCommit: commitRepo } = require('./git-helpers.cjs');
    return commitRepo(repoPath, message);
  });

  ipcMain.handle('git-push-repo', (event, repoName) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project open' };
    const repoPath = path.join(ctx.projectRoot, repoName);
    if (!repoPath.startsWith(ctx.projectRoot)) return { error: 'Invalid repo path' };
    const { gitPush: pushRepo } = require('./git-helpers.cjs');
    return pushRepo(repoPath);
  });

  ipcMain.handle('git-get-remote-info-repo', (event, repoName) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { hasRemote: false, ahead: 0, behind: 0 };
    const repoPath = path.join(ctx.projectRoot, repoName);
    if (!repoPath.startsWith(ctx.projectRoot)) return { hasRemote: false, ahead: 0, behind: 0 };
    const { getRemoteInfo: remoteInfo } = require('./git-helpers.cjs');
    return remoteInfo(repoPath);
  });

  ipcMain.on('terminal-input', (event, data) => {
    const ctx = getWindowContext(event.sender);
    if (ctx?.ptyProcess) ctx.ptyProcess.write(data);
  });

  ipcMain.on('terminal-resize', (event, { cols, rows }) => {
    const ctx = getWindowContext(event.sender);
    try { if (ctx?.ptyProcess) ctx.ptyProcess.resize(cols, rows); } catch {}
  });

  ipcMain.handle('get-recent-projects', () => {
    return recentProjects ? recentProjects.get() : [];
  });

  ipcMain.handle('remove-recent-project', (_event, projectPath) => {
    if (recentProjects) recentProjects.remove(projectPath);
  });

  // ── Claude commands + skills autocomplete ──────────────────

  const scanSkills = (skillsDir) => {
    const skills = [];
    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
        try {
          const content = fs.readFileSync(skillFile, 'utf-8');
          const nameMatch = content.match(/^name:\s*(.+)/m);
          const descMatch = content.match(/^description:\s*>?\s*\n?\s*(.+)/m);
          const name = nameMatch ? nameMatch[1].trim() : entry.name;
          const desc = descMatch ? descMatch[1].trim() : '';
          skills.push({ label: `/${name}`, detail: desc || 'Project skill', type: 'skill' });
        } catch {}
      }
    } catch {}
    return skills;
  };

  let cachedClaudeCommands = null;

  ipcMain.handle('get-claude-commands', (event) => {
    if (cachedClaudeCommands) return cachedClaudeCommands;

    const os = require('os');
    const globalSkillsDir = path.join(os.homedir(), '.claude', 'skills');
    const globalSkills = scanSkills(globalSkillsDir);

    // Project-specific skills
    const ctx = getWindowContext(event.sender);
    let projectSkills = [];
    if (ctx?.projectRoot) {
      const projSkillsDir = path.join(ctx.projectRoot, '.claude', 'skills');
      projectSkills = scanSkills(projSkillsDir);
    }

    // Merge: project skills override global ones with same name
    const seen = new Set();
    const allSkills = [];
    for (const s of projectSkills) { seen.add(s.label); allSkills.push(s); }
    for (const s of globalSkills) { if (!seen.has(s.label)) { seen.add(s.label); allSkills.push(s); } }

    cachedClaudeCommands = allSkills;
    return cachedClaudeCommands;
  });

  ipcMain.on('terminal-restart', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx) return;
    if (ctx.ptyProcess) { try { ctx.ptyProcess.kill(); } catch {} ctx.ptyProcess = null; }
    if (ctx.projectRoot) setupTerminal(ctx);
  });

  // ── SFTP ──────────────────────────────────────────────────────

  const loadSftpClient = new Function('return import("ssh2-sftp-client")');
  const loadBasicFtp = new Function('return import("basic-ftp")');
  const loadPicomatch = new Function('return import("picomatch")');

  const getClientForProtocol = async (protocol) => {
    if (protocol === 'ftp') {
      const { Client: FtpClientClass } = await loadBasicFtp();
      const { createFtpClient } = require('./ftp-client.cjs');
      return createFtpClient(FtpClientClass, log);
    }
    const { default: SftpClient } = await loadSftpClient();
    const { createSftpClient: createClient } = require('./sftp-client.cjs');
    return createClient(SftpClient, fs, log);
  };

  const sendProgress = (ctx, data) => {
    if (ctx.window && !ctx.window.isDestroyed()) {
      ctx.window.webContents.send('sftp-progress', data);
    }
  };

  const syncSingleConfig = async (ctx, serverConfig, clientApi, syncApi, passphrases, { isFtp = false, force = false } = {}) => {
    const localRoot = path.join(ctx.projectRoot, serverConfig.context === '.' ? '' : serverConfig.context);
    if (!localRoot.startsWith(ctx.projectRoot)) {
      return { config: serverConfig.name, error: 'Invalid context path' };
    }

    sendProgress(ctx, { status: 'scanning', server: serverConfig.name });

    const allFiles = syncApi.buildFileList(localRoot, serverConfig.ignore || []);
    let files;
    if (force) {
      files = allFiles;
    } else {
      const changedForConfig = sftpConfig.getChangedFilesForConfig(ctx.projectRoot, serverConfig);
      const changedSet = new Set(changedForConfig);
      files = changedSet.size > 0 ? allFiles.filter((f) => changedSet.has(f)) : [];
    }

    if (!files.length) {
      return { config: serverConfig.name, uploaded: 0, skipped: 0, errors: [] };
    }

    let conn;
    try {
      const resolvedConfig = passphrases[serverConfig.id]
        ? { ...serverConfig, passphrase: passphrases[serverConfig.id] }
        : serverConfig;
      conn = await clientApi.connect(resolvedConfig);
    } catch (err) {
      sendProgress(ctx, { status: 'error', server: serverConfig.name, message: err.message });
      return { config: serverConfig.name, error: err.message };
    }

    try {
      sendProgress(ctx, { status: 'uploading', server: serverConfig.name, total: files.length });
      const result = await syncApi.syncFiles(conn, localRoot, serverConfig.remotePath, files, {
        concurrency: isFtp ? 1 : (serverConfig.concurrency || 4),
        skipFiles: new Set(),
        onProgress: (p) => sendProgress(ctx, { status: 'uploading', server: serverConfig.name, ...p }),
      });
      return { config: serverConfig.name, ...result };
    } finally {
      await clientApi.disconnect(conn);
    }
  };

  ipcMain.handle('sftp-get-configs', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return [];
    return sftpConfig.getEffectiveConfigs(ctx.projectRoot);
  });

  ipcMain.handle('sftp-get-pending-count', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return 0;
    const configs = sftpConfig.getEffectiveConfigs(ctx.projectRoot);
    if (!configs.length) return 0;
    const changedFiles = sftpConfig.getChangedFiles(ctx.projectRoot);
    const relevant = changedFiles.filter((f) =>
      configs.some((c) => c.context === '.' || f.startsWith(c.context + '/'))
    );
    return relevant.length;
  });

  ipcMain.handle('sftp-get-project-config', (event) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return null;
    return sftpConfig.getProjectConfig(ctx.projectRoot);
  });

  ipcMain.handle('sftp-save-config', (event, { config, isRoot }) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project open' };
    const id = isRoot
      ? sftpConfig.saveRootConfig(ctx.projectRoot, config)
      : sftpConfig.saveContextConfig(ctx.projectRoot, config);
    return { success: true, id };
  });

  ipcMain.handle('sftp-remove-config', (event, configId) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project open' };
    sftpConfig.removeConfig(ctx.projectRoot, configId);
    return { success: true };
  });

  ipcMain.handle('sftp-test-connection', async (event, { config, passphrase }) => {
    try {
      const client = await getClientForProtocol(config.protocol || 'sftp');
      const resolvedConfig = passphrase ? { ...config, passphrase } : config;
      const conn = await client.connect(resolvedConfig);
      await client.disconnect(conn);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('sftp-select-key-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: 'Select SSH Private Key',
      filters: [{ name: 'All Files', extensions: ['*'] }],
      defaultPath: require('os').homedir() + '/.ssh',
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('sftp-start-sync', async (event, { passphrases = {} } = {}) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project open' };

    const configs = sftpConfig.getEffectiveConfigs(ctx.projectRoot);
    if (!configs.length) return { error: 'No SFTP configs' };

    ctx.sftpSyncState = { active: true, conflictResolver: null };
    const allResults = [];

    try {
      const { default: picomatch } = await loadPicomatch();

      for (const serverConfig of configs) {
        if (!ctx.sftpSyncState.active) break;
        const protocol = serverConfig.protocol || 'sftp';
        const clientApi = await getClientForProtocol(protocol);
        const { createSftpSync: createSync } = require('./sftp-sync.cjs');
        const syncApi = createSync(clientApi, fs, path, log, picomatch);
        const result = await syncSingleConfig(ctx, serverConfig, clientApi, syncApi, passphrases, { isFtp: protocol === 'ftp' });
        allResults.push(result);
      }

      sftpConfig.clearChangedFiles(ctx.projectRoot);
      sendProgress(ctx, { status: 'done', results: allResults });
      return { success: true, results: allResults };
    } catch (err) {
      log('[sftp] sync error:', err.message, err.stack);
      sendProgress(ctx, { status: 'error', message: err.message });
      return { error: err.message };
    } finally {
      if (ctx.sftpSyncState) ctx.sftpSyncState.active = false;
    }
  });

  ipcMain.handle('sftp-sync-folder', async (event, { configId, passphrases = {}, force = false, subPath = '' } = {}) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.projectRoot) return { error: 'No project open' };

    const projectCfg = sftpConfig.getProjectConfig(ctx.projectRoot);
    if (!projectCfg) return { error: 'No SFTP configs' };

    const allConfigs = [
      ...(projectCfg.rootConfig ? [projectCfg.rootConfig] : []),
      ...(projectCfg.contextConfigs || []),
    ];
    const serverConfig = allConfigs.find((c) => c.id === configId);
    if (!serverConfig) return { error: 'Config not found' };

    // When a subPath is provided, build a virtual config whose context points
    // at the inner folder. This reuses all existing sync/filter/clear logic
    // which already filters changed files by the config's context prefix.
    let effectiveConfig = serverConfig;
    if (subPath) {
      const joinedContext = serverConfig.context === '.'
        ? subPath
        : path.posix.join(serverConfig.context, subPath);
      const joinedRemotePath = path.posix.join(serverConfig.remotePath || '/', subPath);
      effectiveConfig = {
        ...serverConfig,
        context: joinedContext,
        remotePath: joinedRemotePath,
      };
    }

    ctx.sftpSyncState = { active: true, conflictResolver: null };

    try {
      const protocol = effectiveConfig.protocol || 'sftp';
      const clientApi = await getClientForProtocol(protocol);
      const { default: picomatch } = await loadPicomatch();
      const { createSftpSync: createSync } = require('./sftp-sync.cjs');
      const syncApi = createSync(clientApi, fs, path, log, picomatch);

      const result = await syncSingleConfig(ctx, effectiveConfig, clientApi, syncApi, passphrases, { isFtp: protocol === 'ftp', force });
      sftpConfig.clearChangedFilesForConfig(ctx.projectRoot, effectiveConfig);
      sendProgress(ctx, { status: 'done', results: [result] });
      return { success: true, results: [result] };
    } catch (err) {
      log('[sftp] folder sync error:', err.message, err.stack);
      sendProgress(ctx, { status: 'error', message: err.message });
      return { error: err.message };
    } finally {
      if (ctx.sftpSyncState) ctx.sftpSyncState.active = false;
    }
  });

  ipcMain.handle('sftp-resolve-conflicts', (event, resolutions) => {
    const ctx = getWindowContext(event.sender);
    if (!ctx?.sftpSyncState?.conflictResolver) return { error: 'No pending conflicts' };
    ctx.sftpSyncState.conflictResolver(resolutions);
    return { success: true };
  });
}

module.exports = { setupIPC };
