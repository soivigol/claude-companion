import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  getDefaultShell,
  getDefaultPath,
  getShellArgs,
  getTerminalEnv,
  getAppIcon,
  getWindowOptions,
  buildMenuTemplate,
} = require('../lib/platform.cjs');

// ============================================================
// getDefaultShell
// ============================================================

describe('getDefaultShell', () => {
  it('returns powershell on Windows when COMSPEC is not set', () => {
    expect(getDefaultShell('win32', {})).toBe('powershell.exe');
  });

  it('returns COMSPEC on Windows when set', () => {
    expect(getDefaultShell('win32', { COMSPEC: 'C:\\Windows\\System32\\cmd.exe' }))
      .toBe('C:\\Windows\\System32\\cmd.exe');
  });

  it('returns /bin/zsh on macOS when SHELL is not set', () => {
    expect(getDefaultShell('darwin', {})).toBe('/bin/zsh');
  });

  it('returns SHELL env on macOS when set', () => {
    expect(getDefaultShell('darwin', { SHELL: '/bin/fish' })).toBe('/bin/fish');
  });

  it('returns /bin/bash on Linux when SHELL is not set', () => {
    expect(getDefaultShell('linux', {})).toBe('/bin/bash');
  });

  it('returns SHELL env on Linux when set', () => {
    expect(getDefaultShell('linux', { SHELL: '/usr/bin/zsh' })).toBe('/usr/bin/zsh');
  });
});

// ============================================================
// getDefaultPath
// ============================================================

describe('getDefaultPath', () => {
  it('returns envPath as-is on Windows', () => {
    const env = { PATH: 'C:\\Windows\\system32;C:\\Windows' };
    expect(getDefaultPath('win32', env)).toBe('C:\\Windows\\system32;C:\\Windows');
  });

  it('returns empty string on Windows when PATH not set', () => {
    expect(getDefaultPath('win32', {})).toBe('');
  });

  it('prepends macOS defaults when /usr/local/bin is missing', () => {
    const result = getDefaultPath('darwin', { PATH: '/some/custom/path' });
    expect(result).toContain('/usr/local/bin');
    expect(result).toContain('/opt/homebrew/bin');
    expect(result).toContain('/some/custom/path');
  });

  it('keeps macOS PATH as-is when /usr/local/bin is present', () => {
    const envPath = '/usr/local/bin:/usr/bin:/bin:/custom';
    expect(getDefaultPath('darwin', { PATH: envPath })).toBe(envPath);
  });

  it('prepends Linux defaults when /usr/local/bin is missing', () => {
    const result = getDefaultPath('linux', { PATH: '/some/path' });
    expect(result).toContain('/usr/local/bin');
    expect(result).toContain('/some/path');
    expect(result).not.toContain('/opt/homebrew/bin');
  });

  it('keeps Linux PATH as-is when /usr/local/bin is present', () => {
    const envPath = '/usr/local/bin:/usr/bin:/bin';
    expect(getDefaultPath('linux', { PATH: envPath })).toBe(envPath);
  });
});

// ============================================================
// getShellArgs
// ============================================================

describe('getShellArgs', () => {
  it('returns empty array on Windows', () => {
    expect(getShellArgs('win32')).toEqual([]);
  });

  it('returns ["--login"] on macOS', () => {
    expect(getShellArgs('darwin')).toEqual(['--login']);
  });

  it('returns ["--login"] on Linux', () => {
    expect(getShellArgs('linux')).toEqual(['--login']);
  });
});

// ============================================================
// getTerminalEnv
// ============================================================

describe('getTerminalEnv', () => {
  it('sets TERM and COLORTERM on all platforms', () => {
    for (const platform of ['darwin', 'win32', 'linux']) {
      const env = getTerminalEnv('/bin/sh', platform, { PATH: '/usr/bin', HOME: '/home/test' });
      expect(env.TERM).toBe('xterm-256color');
      expect(env.COLORTERM).toBe('truecolor');
    }
  });

  it('sets SHELL on macOS and Linux but not Windows', () => {
    const macEnv = getTerminalEnv('/bin/zsh', 'darwin', { PATH: '/usr/bin', HOME: '/home/test' });
    expect(macEnv.SHELL).toBe('/bin/zsh');

    const linuxEnv = getTerminalEnv('/bin/bash', 'linux', { PATH: '/usr/bin', HOME: '/home/test' });
    expect(linuxEnv.SHELL).toBe('/bin/bash');

    const winEnv = getTerminalEnv('powershell.exe', 'win32', { PATH: 'C:\\Windows', HOME: 'C:\\Users\\test' });
    expect(winEnv.SHELL).toBeUndefined();
  });

  it('uses getDefaultPath for PATH', () => {
    const env = getTerminalEnv('/bin/zsh', 'darwin', { PATH: '/some/path', HOME: '/home/test' });
    expect(env.PATH).toContain('/usr/local/bin');
  });
});

// ============================================================
// getAppIcon
// ============================================================

describe('getAppIcon', () => {
  const projectRoot = path.join(__dirname, '..');

  it('returns icon.png for macOS', () => {
    const result = getAppIcon('darwin', path.join(projectRoot, 'lib'));
    expect(result).toContain('icon.png');
    expect(fs.existsSync(result)).toBe(true);
  });

  it('returns icon.ico for Windows when it exists', () => {
    const result = getAppIcon('win32', path.join(projectRoot, 'lib'));
    expect(result).toContain('icon.ico');
    expect(fs.existsSync(result)).toBe(true);
  });

  it('returns icon.png for Linux', () => {
    const result = getAppIcon('linux', path.join(projectRoot, 'lib'));
    expect(result).toContain('icon.png');
    expect(fs.existsSync(result)).toBe(true);
  });
});

// ============================================================
// getWindowOptions
// ============================================================

describe('getWindowOptions', () => {
  const baseDir = path.join(__dirname, '..', 'lib');

  it('includes common options on all platforms', () => {
    for (const platform of ['darwin', 'win32', 'linux']) {
      const opts = getWindowOptions(platform, baseDir);
      expect(opts.width).toBe(1440);
      expect(opts.height).toBe(900);
      expect(opts.minWidth).toBe(900);
      expect(opts.minHeight).toBe(500);
      expect(opts.title).toBe('Claude Companion');
      expect(opts.backgroundColor).toBe('#ffffff');
      expect(opts.icon).toBeTruthy();
      expect(opts.webPreferences.contextIsolation).toBe(true);
      expect(opts.webPreferences.nodeIntegration).toBe(false);
    }
  });

  it('adds macOS-specific chrome on darwin', () => {
    const opts = getWindowOptions('darwin', baseDir);
    expect(opts.tabbingIdentifier).toBe('claude-companion');
    expect(opts.titleBarStyle).toBe('hiddenInset');
    expect(opts.trafficLightPosition).toEqual({ x: 14, y: 14 });
  });

  it('does NOT add macOS chrome on Windows', () => {
    const opts = getWindowOptions('win32', baseDir);
    expect(opts.tabbingIdentifier).toBeUndefined();
    expect(opts.titleBarStyle).toBeUndefined();
    expect(opts.trafficLightPosition).toBeUndefined();
  });

  it('does NOT add macOS chrome on Linux', () => {
    const opts = getWindowOptions('linux', baseDir);
    expect(opts.tabbingIdentifier).toBeUndefined();
    expect(opts.titleBarStyle).toBeUndefined();
    expect(opts.trafficLightPosition).toBeUndefined();
  });

  it('uses .ico icon on Windows', () => {
    const opts = getWindowOptions('win32', baseDir);
    expect(opts.icon).toContain('icon.ico');
  });

  it('uses .png icon on Linux', () => {
    const opts = getWindowOptions('linux', baseDir);
    expect(opts.icon).toContain('icon.png');
  });
});

// ============================================================
// buildMenuTemplate
// ============================================================

describe('buildMenuTemplate', () => {
  it('includes app menu on macOS (4 top-level menus)', () => {
    const template = buildMenuTemplate('darwin', 'TestApp');
    expect(template.length).toBe(4);
    expect(template[0].label).toBe('TestApp');
  });

  it('does NOT include app menu on Windows (3 top-level menus)', () => {
    const template = buildMenuTemplate('win32', 'TestApp');
    expect(template.length).toBe(3);
    expect(template[0].label).toBe('File');
  });

  it('does NOT include app menu on Linux (3 top-level menus)', () => {
    const template = buildMenuTemplate('linux', 'TestApp');
    expect(template.length).toBe(3);
    expect(template[0].label).toBe('File');
  });

  it('File menu has "close" on macOS, "quit" on others', () => {
    const macTemplate = buildMenuTemplate('darwin');
    const macFileSubmenu = macTemplate.find(m => m.label === 'File').submenu;
    expect(macFileSubmenu.some(item => item.role === 'close')).toBe(true);

    const winTemplate = buildMenuTemplate('win32');
    const winFileSubmenu = winTemplate.find(m => m.label === 'File').submenu;
    expect(winFileSubmenu.some(item => item.role === 'quit')).toBe(true);
  });

  it('Window menu has tab selectors only on macOS', () => {
    const macTemplate = buildMenuTemplate('darwin');
    const macWindowSubmenu = macTemplate.find(m => m.label === 'Window').submenu;
    expect(macWindowSubmenu.some(item => item.selector === 'selectNextTab:')).toBe(true);
    expect(macWindowSubmenu.some(item => item.role === 'zoom')).toBe(true);
    expect(macWindowSubmenu.some(item => item.role === 'front')).toBe(true);

    const winTemplate = buildMenuTemplate('win32');
    const winWindowSubmenu = winTemplate.find(m => m.label === 'Window').submenu;
    expect(winWindowSubmenu.some(item => item.selector === 'selectNextTab:')).toBe(false);
    expect(winWindowSubmenu.some(item => item.role === 'zoom')).toBe(false);
  });

  it('Edit menu is the same on all platforms', () => {
    const macEdit = buildMenuTemplate('darwin').find(m => m.label === 'Edit').submenu;
    const winEdit = buildMenuTemplate('win32').find(m => m.label === 'Edit').submenu;
    const linEdit = buildMenuTemplate('linux').find(m => m.label === 'Edit').submenu;

    const getRoles = (items) => items.filter(i => i.role).map(i => i.role).sort();
    expect(getRoles(macEdit)).toEqual(getRoles(winEdit));
    expect(getRoles(macEdit)).toEqual(getRoles(linEdit));
  });

  it('New Window uses CmdOrCtrl+T accelerator', () => {
    for (const platform of ['darwin', 'win32', 'linux']) {
      const template = buildMenuTemplate(platform);
      const fileMenu = template.find(m => m.label === 'File');
      const newWindow = fileMenu.submenu.find(i => i.label === 'New Window');
      expect(newWindow.accelerator).toBe('CmdOrCtrl+T');
    }
  });
});
