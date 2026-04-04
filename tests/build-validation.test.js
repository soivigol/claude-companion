import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ============================================================
// Required files exist
// ============================================================

describe('required project files', () => {
  const requiredFiles = [
    'main.cjs',
    'preload.cjs',
    'index.html',
    'package.json',
    'electron-builder.yml',
    'src/main.js',
    'lib/platform.cjs',
    'lib/git-helpers.cjs',
    'assets/icon.png',
    'assets/icon.icns',
    'assets/icon.ico',
  ];

  for (const file of requiredFiles) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    });
  }
});

// ============================================================
// package.json validation
// ============================================================

describe('package.json', () => {
  let pkg;

  it('is valid JSON', () => {
    const content = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8');
    pkg = JSON.parse(content);
    expect(pkg).toBeTruthy();
  });

  it('has correct main entry', () => {
    expect(pkg.main).toBe('main.cjs');
  });

  it('has build script', () => {
    expect(pkg.scripts.build).toBeTruthy();
    expect(pkg.scripts.build).toContain('esbuild');
  });

  it('has platform-specific package scripts', () => {
    expect(pkg.scripts['package:mac']).toContain('electron-builder --mac');
    expect(pkg.scripts['package:win']).toContain('electron-builder --win');
    expect(pkg.scripts['package:linux']).toContain('electron-builder --linux');
    expect(pkg.scripts['package:all']).toContain('-mwl');
  });

  it('has test script', () => {
    expect(pkg.scripts.test).toBeTruthy();
  });

  it('has electron-builder as devDependency', () => {
    expect(pkg.devDependencies['electron-builder']).toBeTruthy();
  });

  it('has electron as devDependency', () => {
    expect(pkg.devDependencies.electron).toBeTruthy();
  });

  it('has required runtime dependencies', () => {
    expect(pkg.dependencies['node-pty']).toBeTruthy();
    expect(pkg.dependencies['@xterm/xterm']).toBeTruthy();
    expect(pkg.dependencies['chokidar']).toBeTruthy();
    expect(pkg.dependencies['highlight.js']).toBeTruthy();
  });
});

// ============================================================
// electron-builder.yml validation
// ============================================================

describe('electron-builder.yml', () => {
  let config;

  it('is valid YAML (parseable)', () => {
    const content = fs.readFileSync(path.join(ROOT, 'electron-builder.yml'), 'utf-8');
    expect(content).toContain('appId:');
    expect(content).toContain('productName:');
    config = content;
  });

  it('has macOS configuration', () => {
    expect(config).toContain('mac:');
    expect(config).toContain('dmg');
    expect(config).toContain('icon.icns');
  });

  it('has Windows configuration', () => {
    expect(config).toContain('win:');
    expect(config).toContain('nsis');
    expect(config).toContain('icon.ico');
  });

  it('has Linux configuration', () => {
    expect(config).toContain('linux:');
    expect(config).toContain('AppImage');
    expect(config).toContain('deb');
    expect(config).toContain('icon.png');
  });

  it('configures asar unpacking for node-pty', () => {
    expect(config).toContain('asarUnpack');
    expect(config).toContain('node-pty');
  });
});

// ============================================================
// main.cjs syntax validation
// ============================================================

describe('main.cjs syntax', () => {
  it('parses without syntax errors', () => {
    const result = execSync(
      `node --check "${path.join(ROOT, 'main.cjs')}" 2>&1; echo $?`,
      { cwd: ROOT }
    ).toString().trim();
    expect(result).toBe('0');
  });

  it('imports lib/platform.cjs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'main.cjs'), 'utf-8');
    expect(content).toContain("require('./lib/platform.cjs')");
  });

  it('imports lib/git-helpers.cjs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'main.cjs'), 'utf-8');
    expect(content).toContain("require('./lib/git-helpers.cjs')");
  });

  it('does not contain hardcoded /bin/zsh shell', () => {
    const content = fs.readFileSync(path.join(ROOT, 'main.cjs'), 'utf-8');
    expect(content).not.toMatch(/const shell = ['"]\/bin\/zsh['"]/);
  });

  it('does not contain hardcoded macOS PATH', () => {
    const content = fs.readFileSync(path.join(ROOT, 'main.cjs'), 'utf-8');
    expect(content).not.toContain('/opt/homebrew/bin');
  });

  it('imports lib/logger.cjs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'main.cjs'), 'utf-8');
    expect(content).toContain("require('./lib/logger.cjs')");
  });

  it('imports lib/window-manager.cjs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'main.cjs'), 'utf-8');
    expect(content).toContain("require('./lib/window-manager.cjs')");
  });

  it('imports lib/terminal-setup.cjs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'main.cjs'), 'utf-8');
    expect(content).toContain("require('./lib/terminal-setup.cjs')");
  });

  it('imports lib/file-watcher.cjs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'main.cjs'), 'utf-8');
    expect(content).toContain("require('./lib/file-watcher.cjs')");
  });

  it('imports lib/ipc-handlers.cjs', () => {
    const content = fs.readFileSync(path.join(ROOT, 'main.cjs'), 'utf-8');
    expect(content).toContain("require('./lib/ipc-handlers.cjs')");
  });
});

// ============================================================
// src/ module files exist
// ============================================================

describe('src/ module files', () => {
  const coreModules = [
    'core/api.js',
    'core/state.js',
    'core/diff.js',
    'core/themes-data.js',
    'core/highlight-setup.js',
  ];

  const componentModules = [
    'components/terminal.js',
    'components/themes.js',
    'components/file-tree.js',
    'components/file-viewer.js',
    'components/viewer.js',
    'components/commits.js',
    'components/status.js',
    'components/resize.js',
    'components/project.js',
    'components/update-banner.js',
  ];

  for (const file of ['main.js', ...coreModules, ...componentModules]) {
    it(`src/${file} exists`, () => {
      expect(fs.existsSync(path.join(ROOT, 'src', file))).toBe(true);
    });
  }

  it('src/css/styles.css exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'src', 'css', 'styles.css'))).toBe(true);
  });
});

// ============================================================
// lib/ module files exist
// ============================================================

describe('lib/ module files', () => {
  const libModules = [
    'platform.cjs',
    'git-helpers.cjs',
    'logger.cjs',
    'window-manager.cjs',
    'terminal-setup.cjs',
    'file-watcher.cjs',
    'ipc-handlers.cjs',
  ];

  for (const file of libModules) {
    it(`lib/${file} exists`, () => {
      expect(fs.existsSync(path.join(ROOT, 'lib', file))).toBe(true);
    });
  }
});

// ============================================================
// lib modules load correctly
// ============================================================

describe('lib modules', () => {
  it('platform.cjs loads and exports all functions', () => {
    const platform = require('../lib/platform.cjs');
    expect(typeof platform.getDefaultShell).toBe('function');
    expect(typeof platform.getDefaultPath).toBe('function');
    expect(typeof platform.getShellArgs).toBe('function');
    expect(typeof platform.getTerminalEnv).toBe('function');
    expect(typeof platform.getAppIcon).toBe('function');
    expect(typeof platform.getWindowOptions).toBe('function');
    expect(typeof platform.buildMenuTemplate).toBe('function');
  });

  it('git-helpers.cjs loads and exports all functions', () => {
    const git = require('../lib/git-helpers.cjs');
    expect(typeof git.getGitRoot).toBe('function');
    expect(typeof git.getFileTree).toBe('function');
    expect(typeof git.getGitStatus).toBe('function');
    expect(typeof git.getGitDiff).toBe('function');
    expect(typeof git.getFullDiff).toBe('function');
    expect(typeof git.getRecentCommits).toBe('function');
    expect(typeof git.getCommitDiff).toBe('function');
  });

  it('logger.cjs loads and exports createLogger', () => {
    const logger = require('../lib/logger.cjs');
    expect(typeof logger.createLogger).toBe('function');
  });

  it('window-manager.cjs loads and exports all functions', () => {
    const wm = require('../lib/window-manager.cjs');
    expect(typeof wm.getWindowContext).toBe('function');
    expect(typeof wm.cleanupWindow).toBe('function');
    expect(typeof wm.createWindow).toBe('function');
  });
});

// ============================================================
// preload.cjs validation
// ============================================================

describe('preload.cjs', () => {
  it('exposes platform property', () => {
    const content = fs.readFileSync(path.join(ROOT, 'preload.cjs'), 'utf-8');
    expect(content).toContain('platform: process.platform');
  });

  it('has all required IPC bindings', () => {
    const content = fs.readFileSync(path.join(ROOT, 'preload.cjs'), 'utf-8');
    const requiredBindings = [
      'selectFolder', 'openProject', 'getProjectInfo',
      'getFileTree', 'getGitStatus', 'getDiff',
      'getFileContent', 'getCommits', 'getCommitDiff',
      'terminalInput', 'terminalResize', 'terminalRestart',
      'onTerminalOutput', 'onTerminalExit', 'onFileChange',
    ];
    for (const binding of requiredBindings) {
      expect(content).toContain(binding);
    }
  });
});

// ============================================================
// index.html validation
// ============================================================

describe('index.html', () => {
  let html;

  it('is valid HTML', () => {
    html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('loads main script', () => {
    expect(html).toContain('./dist/main.js');
  });
});

// ============================================================
// src/main.js validation
// ============================================================

describe('src/main.js', () => {
  let content;

  it('reads without error', () => {
    content = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf-8');
    expect(content).toBeTruthy();
  });

  it('adds platform class to body', () => {
    expect(content).toContain('platform-${api.platform');
  });

  it('accesses window.companion API via api module', () => {
    const apiContent = fs.readFileSync(path.join(ROOT, 'src', 'core', 'api.js'), 'utf-8');
    expect(apiContent).toContain('window.companion');
    expect(content).toContain("from './core/api.js'");
  });
});

// ============================================================
// Asset validation
// ============================================================

describe('icon assets', () => {
  it('icon.png exists and is non-empty', () => {
    const stat = fs.statSync(path.join(ROOT, 'assets', 'icon.png'));
    expect(stat.size).toBeGreaterThan(1000);
  });

  it('icon.icns exists and is non-empty', () => {
    const stat = fs.statSync(path.join(ROOT, 'assets', 'icon.icns'));
    expect(stat.size).toBeGreaterThan(1000);
  });

  it('icon.ico exists and is non-empty', () => {
    const stat = fs.statSync(path.join(ROOT, 'assets', 'icon.ico'));
    expect(stat.size).toBeGreaterThan(1000);
  });

  it('icon.ico has valid ICO header', () => {
    const buf = Buffer.alloc(4);
    const fd = fs.openSync(path.join(ROOT, 'assets', 'icon.ico'), 'r');
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    expect(buf[0]).toBe(0);
    expect(buf[1]).toBe(0);
    expect(buf[2]).toBe(1);
    expect(buf[3]).toBe(0);
  });

  it('icon.png has valid PNG header', () => {
    const buf = Buffer.alloc(8);
    const fd = fs.openSync(path.join(ROOT, 'assets', 'icon.png'), 'r');
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4E);
    expect(buf[3]).toBe(0x47);
  });
});

// ============================================================
// esbuild renderer bundle
// ============================================================

describe('renderer build', () => {
  it('builds without errors', () => {
    execSync('npx esbuild src/main.js --bundle --outfile=dist/main.js --format=iife --platform=browser --loader:.css=css 2>&1', {
      cwd: ROOT,
      timeout: 30000,
    });
    expect(fs.existsSync(path.join(ROOT, 'dist', 'main.js'))).toBe(true);
  });

  it('renderer bundle is non-empty', () => {
    const stat = fs.statSync(path.join(ROOT, 'dist', 'main.js'));
    expect(stat.size).toBeGreaterThan(1000);
  });

  it('renderer bundle contains platform class logic', () => {
    const content = fs.readFileSync(path.join(ROOT, 'dist', 'main.js'), 'utf-8');
    expect(content).toContain('platform-');
  });
});
