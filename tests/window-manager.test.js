import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getWindowContext, cleanupWindow, createWindow } = require('../lib/window-manager.cjs');

// ============================================================
// Helpers
// ============================================================

const mockBrowserWindow = {
  fromWebContents: (wc) => wc._window || null,
};

function createMockWindow(id) {
  return {
    id,
    on: () => {},
    loadFile: function (p) { this._loadedFile = p; },
    webContents: { openDevTools: () => {} },
    isDestroyed: () => false,
    _loadedFile: null,
  };
}

function createLogTracker() {
  const calls = [];
  const log = (...args) => calls.push(args.join(' '));
  return { log, calls };
}

// ============================================================
// getWindowContext
// ============================================================

describe('getWindowContext', () => {
  it('returns null when BrowserWindow.fromWebContents returns null', () => {
    const windows = new Map();
    const webContents = { _window: null };
    const result = getWindowContext(windows, webContents, mockBrowserWindow);
    expect(result).toBeNull();
  });

  it('returns the correct context from the windows Map', () => {
    const windows = new Map();
    const ctx = { projectRoot: '/test', ptyProcess: null, watcher: null };
    windows.set(42, ctx);

    const mockWin = { id: 42 };
    const webContents = { _window: mockWin };
    const result = getWindowContext(windows, webContents, mockBrowserWindow);
    expect(result).toBe(ctx);
  });

  it('returns undefined for unknown window id', () => {
    const windows = new Map();
    const mockWin = { id: 999 };
    const webContents = { _window: mockWin };
    const result = getWindowContext(windows, webContents, mockBrowserWindow);
    expect(result).toBeUndefined();
  });
});

// ============================================================
// cleanupWindow
// ============================================================

describe('cleanupWindow', () => {
  it('calls kill on ptyProcess and close on watcher', () => {
    const windows = new Map();
    let ptyCalled = false;
    let watcherClosed = false;
    const ctx = {
      ptyProcess: { kill: () => { ptyCalled = true; } },
      watcher: { close: () => { watcherClosed = true; } },
    };
    windows.set(1, ctx);
    const { log } = createLogTracker();

    cleanupWindow(windows, 1, log);
    expect(ptyCalled).toBe(true);
    expect(watcherClosed).toBe(true);
  });

  it('removes the window from the Map', () => {
    const windows = new Map();
    windows.set(1, { ptyProcess: null, watcher: null });
    const { log } = createLogTracker();

    cleanupWindow(windows, 1, log);
    expect(windows.has(1)).toBe(false);
  });

  it('handles missing window ID gracefully (no throw)', () => {
    const windows = new Map();
    const { log } = createLogTracker();
    expect(() => cleanupWindow(windows, 999, log)).not.toThrow();
  });

  it('handles ptyProcess.kill() throwing', () => {
    const windows = new Map();
    windows.set(1, {
      ptyProcess: { kill: () => { throw new Error('already dead'); } },
      watcher: { close: () => {} },
    });
    const { log } = createLogTracker();
    expect(() => cleanupWindow(windows, 1, log)).not.toThrow();
    expect(windows.has(1)).toBe(false);
  });
});

// ============================================================
// createWindow
// ============================================================

describe('createWindow', () => {
  it('adds window to the Map and calls loadFile', () => {
    const windows = new Map();
    const { log } = createLogTracker();

    const mockWin = createMockWindow(7);
    const MockBrowserWindow = function () { return mockWin; };

    const getWindowOptions = () => ({
      width: 1440,
      height: 900,
      webPreferences: { contextIsolation: true },
    });

    const win = createWindow(windows, log, {
      getWindowOptions,
      BrowserWindow: MockBrowserWindow,
      isPackaged: true,
      indexPath: '/app/index.html',
    });

    expect(win).toBe(mockWin);
    expect(windows.has(7)).toBe(true);
    expect(windows.get(7).window).toBe(mockWin);
    expect(mockWin._loadedFile).toBe('/app/index.html');
  });

  it('opens DevTools when not packaged', () => {
    const windows = new Map();
    const { log } = createLogTracker();

    let devToolsOpened = false;
    const mockWin = createMockWindow(8);
    mockWin.webContents.openDevTools = () => { devToolsOpened = true; };
    const MockBrowserWindow = function () { return mockWin; };

    createWindow(windows, log, {
      getWindowOptions: () => ({ webPreferences: {} }),
      BrowserWindow: MockBrowserWindow,
      isPackaged: false,
      indexPath: '/app/index.html',
    });

    expect(devToolsOpened).toBe(true);
  });

  it('does NOT open DevTools when packaged', () => {
    const windows = new Map();
    const { log } = createLogTracker();

    let devToolsOpened = false;
    const mockWin = createMockWindow(9);
    mockWin.webContents.openDevTools = () => { devToolsOpened = true; };
    const MockBrowserWindow = function () { return mockWin; };

    createWindow(windows, log, {
      getWindowOptions: () => ({ webPreferences: {} }),
      BrowserWindow: MockBrowserWindow,
      isPackaged: true,
      indexPath: '/app/index.html',
    });

    expect(devToolsOpened).toBe(false);
  });

  it('initializes context with null ptyProcess, watcher, and projectRoot', () => {
    const windows = new Map();
    const { log } = createLogTracker();

    const mockWin = createMockWindow(10);
    const MockBrowserWindow = function () { return mockWin; };

    createWindow(windows, log, {
      getWindowOptions: () => ({ webPreferences: {} }),
      BrowserWindow: MockBrowserWindow,
      isPackaged: true,
      indexPath: '/app/index.html',
    });

    const ctx = windows.get(10);
    expect(ctx.ptyProcess).toBeNull();
    expect(ctx.watcher).toBeNull();
    expect(ctx.projectRoot).toBeNull();
  });
});
