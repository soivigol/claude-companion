/**
 * Platform-specific helpers — extracted for testability.
 * All functions accept platform/env overrides so they can be tested
 * on any OS without mocking process globals.
 */
const path = require('path');
const fs = require('fs');

function getDefaultShell(platform = process.platform, env = process.env) {
  if (platform === 'win32') return env.COMSPEC || 'powershell.exe';
  return env.SHELL || (platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
}

function getDefaultPath(platform = process.platform, env = process.env) {
  const envPath = env.PATH || '';
  if (platform === 'win32') return envPath;
  if (platform === 'darwin') {
    const macDefault = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin';
    return envPath.includes('/usr/local/bin') ? envPath : `${macDefault}:${envPath}`;
  }
  // Linux
  const linuxDefault = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
  return envPath.includes('/usr/local/bin') ? envPath : `${linuxDefault}:${envPath}`;
}

function getShellArgs(platform = process.platform) {
  return platform === 'win32' ? [] : ['--login'];
}

function getTerminalEnv(shell, platform = process.platform, env = process.env) {
  const base = {
    ...env,
    PATH: getDefaultPath(platform, env),
    HOME: env.HOME || require('os').homedir(),
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
  };
  if (platform !== 'win32') {
    base.SHELL = shell;
  }
  return base;
}

function getAppIcon(platform = process.platform, baseDir = __dirname) {
  const assetsDir = path.join(baseDir, 'assets');
  if (platform === 'win32') {
    const icoPath = path.join(assetsDir, 'icon.ico');
    if (fs.existsSync(icoPath)) return icoPath;
  }
  return path.join(assetsDir, 'icon.png');
}

function getWindowOptions(platform = process.platform, baseDir = __dirname) {
  const options = {
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 500,
    title: 'Claude Companion',
    backgroundColor: '#ffffff',
    icon: getAppIcon(platform, baseDir),
    webPreferences: {
      preload: path.join(baseDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  };

  if (platform === 'darwin') {
    options.tabbingIdentifier = 'claude-companion';
    options.titleBarStyle = 'hiddenInset';
    options.trafficLightPosition = { x: 14, y: 14 };
  }

  return options;
}

function buildMenuTemplate(platform = process.platform, appName = 'Claude Companion', createWindowFn = () => {}) {
  const isMac = platform === 'darwin';
  const template = [];

  if (isMac) {
    template.push({
      label: appName,
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
        { label: 'New Window', accelerator: 'CmdOrCtrl+T', click: createWindowFn },
        { type: 'separator' },
        ...(isMac ? [{ role: 'close' }] : [{ role: 'quit' }]),
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
        ...(isMac ? [{ role: 'zoom' }] : []),
        { type: 'separator' },
        ...(isMac
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

  return template;
}

module.exports = {
  getDefaultShell,
  getDefaultPath,
  getShellArgs,
  getTerminalEnv,
  getAppIcon,
  getWindowOptions,
  buildMenuTemplate,
};
