const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('companion', {
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
  onTerminalOutput: (cb) => ipcRenderer.on('terminal-output', (_, data) => cb(data)),
  onTerminalExit: (cb) => ipcRenderer.on('terminal-exit', (_, code) => cb(code)),

  // File watcher
  onFileChange: (cb) => ipcRenderer.on('file-change', (_, data) => cb(data)),
});
