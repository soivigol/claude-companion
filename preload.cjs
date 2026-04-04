const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('companion', {
  // Platform info
  platform: process.platform,
  appVersion: require('./package.json').version,

  // Folder picker
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openProject: (folderPath) => ipcRenderer.invoke('open-project', folderPath),

  // Project
  getProjectInfo: () => ipcRenderer.invoke('get-project-info'),
  getFileTree: () => ipcRenderer.invoke('get-file-tree'),
  getGitStatus: () => ipcRenderer.invoke('get-git-status'),
  getDiff: (file) => ipcRenderer.invoke('get-diff', file || null),
  getFileContent: (filePath) => ipcRenderer.invoke('get-file-content', filePath),
  getCommits: () => ipcRenderer.invoke('get-commits'),
  getCommitDiff: (hash) => ipcRenderer.invoke('get-commit-diff', hash),

  // Terminal
  terminalInput: (data) => ipcRenderer.send('terminal-input', data),
  terminalResize: (size) => ipcRenderer.send('terminal-resize', size),
  terminalRestart: () => ipcRenderer.send('terminal-restart'),
  onTerminalOutput: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('terminal-output', handler);
    return () => ipcRenderer.removeListener('terminal-output', handler);
  },
  onTerminalExit: (cb) => {
    const handler = (_, code) => cb(code);
    ipcRenderer.on('terminal-exit', handler);
    return () => ipcRenderer.removeListener('terminal-exit', handler);
  },

  // File watcher
  onFileChange: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('file-change', handler);
    return () => ipcRenderer.removeListener('file-change', handler);
  },

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },
});
