import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSftpSync, ALWAYS_IGNORE } from '../lib/sftp-sync.cjs';
import path from 'path';
import picomatch from 'picomatch';

const mockLog = vi.fn();

function createMockSftpClient(statMap = {}) {
  return {
    stat: async (_client, remotePath) => statMap[remotePath] || null,
    upload: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockFs(tree = {}) {
  const statResults = {};
  for (const [filePath, mtime] of Object.entries(tree)) {
    if (typeof mtime === 'number') {
      statResults[filePath] = { mtimeMs: mtime };
    }
  }

  return {
    readdirSync: (dir, opts) => {
      const entries = [];
      const prefix = dir.endsWith('/') ? dir : dir + '/';

      const children = new Set();
      for (const fullPath of Object.keys(tree)) {
        if (!fullPath.startsWith(prefix)) continue;
        const rest = fullPath.slice(prefix.length);
        const firstSegment = rest.split('/')[0];
        children.add(firstSegment);
      }

      for (const name of children) {
        const fullPath = prefix + name;
        const isDir = Object.keys(tree).some((k) => k.startsWith(fullPath + '/'));
        entries.push({
          name,
          isDirectory: () => isDir,
          isFile: () => !isDir,
        });
      }

      return entries;
    },
    statSync: (filePath) => {
      if (statResults[filePath]) return statResults[filePath];
      throw new Error(`ENOENT: ${filePath}`);
    },
  };
}

describe('sftp-sync', () => {
  beforeEach(() => {
    mockLog.mockClear();
  });

  describe('matchesIgnore', () => {
    it('matches glob patterns', () => {
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(), path, mockLog, picomatch);
      expect(sync.matchesIgnore('debug.log', ['*.log'])).toBe(true);
      expect(sync.matchesIgnore('app.js', ['*.log'])).toBe(false);
    });

    it('matches directory segments', () => {
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(), path, mockLog, picomatch);
      expect(sync.matchesIgnore('vendor/lib/file.php', ['vendor/'])).toBe(true);
    });

    it('always ignores built-in patterns', () => {
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(), path, mockLog, picomatch);
      expect(sync.matchesIgnore('.git/config', [])).toBe(true);
      expect(sync.matchesIgnore('node_modules/pkg/index.js', [])).toBe(true);
      expect(sync.matchesIgnore('.DS_Store', [])).toBe(true);
    });

    it('does not match non-ignored files', () => {
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(), path, mockLog, picomatch);
      expect(sync.matchesIgnore('src/index.js', ['*.log'])).toBe(false);
    });

    it('matches nested patterns', () => {
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(), path, mockLog, picomatch);
      expect(sync.matchesIgnore('dist/bundle.js', ['dist/**'])).toBe(true);
    });
  });

  describe('buildFileList', () => {
    it('lists all files recursively', () => {
      const tree = {
        '/proj/src/index.js': 1000,
        '/proj/src/utils.js': 1000,
        '/proj/readme.md': 1000,
      };
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(tree), path, mockLog, picomatch);
      const files = sync.buildFileList('/proj', []);
      expect(files).toContain('src/index.js');
      expect(files).toContain('src/utils.js');
      expect(files).toContain('readme.md');
    });

    it('filters out ignored patterns', () => {
      const tree = {
        '/proj/src/app.js': 1000,
        '/proj/debug.log': 1000,
        '/proj/error.log': 1000,
      };
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(tree), path, mockLog, picomatch);
      const files = sync.buildFileList('/proj', ['*.log']);
      expect(files).toEqual(['src/app.js']);
    });

    it('always ignores .git and node_modules', () => {
      const tree = {
        '/proj/src/app.js': 1000,
        '/proj/.git/config': 1000,
        '/proj/node_modules/pkg/index.js': 1000,
      };
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(tree), path, mockLog, picomatch);
      const files = sync.buildFileList('/proj', []);
      expect(files).toEqual(['src/app.js']);
    });
  });

  describe('detectConflicts', () => {
    it('detects files with newer remote mtime', async () => {
      const tree = { '/proj/file.txt': 1000 };
      const statMap = { '/remote/file.txt': { mtime: 2000, size: 100 } };
      const mockClient = createMockSftpClient(statMap);
      const mockFs = createMockFs(tree);
      const sync = createSftpSync(mockClient, mockFs, path, mockLog, picomatch);
      const conflicts = await sync.detectConflicts('client', '/proj', '/remote', ['file.txt']);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].file).toBe('file.txt');
    });

    it('no conflicts when local is newer', async () => {
      const tree = { '/proj/file.txt': 3000 };
      const statMap = { '/remote/file.txt': { mtime: 1000, size: 100 } };
      const mockClient = createMockSftpClient(statMap);
      const mockFs = createMockFs(tree);
      const sync = createSftpSync(mockClient, mockFs, path, mockLog, picomatch);
      const conflicts = await sync.detectConflicts('client', '/proj', '/remote', ['file.txt']);
      expect(conflicts).toHaveLength(0);
    });

    it('no conflict for files that do not exist on remote', async () => {
      const tree = { '/proj/new-file.txt': 1000 };
      const mockClient = createMockSftpClient({});
      const mockFs = createMockFs(tree);
      const sync = createSftpSync(mockClient, mockFs, path, mockLog, picomatch);
      const conflicts = await sync.detectConflicts('client', '/proj', '/remote', ['new-file.txt']);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('collectRemoteDirs', () => {
    it('collects all nested directories', () => {
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(), path, mockLog, picomatch);
      const dirs = sync.collectRemoteDirs(['src/components/button.js', 'src/utils.js'], '/remote');
      expect(dirs).toEqual(['/remote/src', '/remote/src/components']);
    });

    it('returns empty for root-level files', () => {
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(), path, mockLog, picomatch);
      const dirs = sync.collectRemoteDirs(['index.js', 'readme.md'], '/remote');
      expect(dirs).toEqual([]);
    });
  });

  describe('asyncPool', () => {
    it('respects concurrency limit', async () => {
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(), path, mockLog, picomatch);

      let maxConcurrent = 0;
      let current = 0;

      const items = [1, 2, 3, 4, 5, 6];
      const results = await sync.asyncPool(2, items, async (item) => {
        current++;
        if (current > maxConcurrent) maxConcurrent = current;
        await new Promise((r) => setTimeout(r, 10));
        current--;
        return item * 2;
      });

      expect(maxConcurrent).toBeLessThanOrEqual(2);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(6);
    });

    it('handles errors without stopping', async () => {
      const mockClient = createMockSftpClient();
      const sync = createSftpSync(mockClient, createMockFs(), path, mockLog, picomatch);

      const results = await sync.asyncPool(2, [1, 2, 3], async (item) => {
        if (item === 2) throw new Error('fail');
        return item;
      });

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(2);
      expect(rejected).toHaveLength(1);
    });
  });

  describe('syncFiles', () => {
    it('uploads files and reports progress', async () => {
      const tree = {
        '/proj/a.js': 1000,
        '/proj/b.js': 1000,
      };
      const mockSftpClient = createMockSftpClient();
      const sync = createSftpSync(mockSftpClient, createMockFs(tree), path, mockLog, picomatch);

      const progress = [];
      const result = await sync.syncFiles('client', '/proj', '/remote', ['a.js', 'b.js'], {
        concurrency: 1,
        onProgress: (p) => progress.push(p),
      });

      expect(result.uploaded).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(progress).toHaveLength(2);
    });

    it('skips files in skipFiles set', async () => {
      const tree = {
        '/proj/a.js': 1000,
        '/proj/b.js': 1000,
      };
      const mockSftpClient = createMockSftpClient();
      const sync = createSftpSync(mockSftpClient, createMockFs(tree), path, mockLog, picomatch);

      const result = await sync.syncFiles('client', '/proj', '/remote', ['a.js', 'b.js'], {
        skipFiles: new Set(['b.js']),
      });

      expect(result.uploaded).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('creates remote directories before uploading', async () => {
      const tree = { '/proj/src/deep/file.js': 1000 };
      const mockSftpClient = createMockSftpClient();
      const sync = createSftpSync(mockSftpClient, createMockFs(tree), path, mockLog, picomatch);

      await sync.syncFiles('client', '/proj', '/remote', ['src/deep/file.js']);

      expect(mockSftpClient.mkdir).toHaveBeenCalledWith('client', '/remote/src');
      expect(mockSftpClient.mkdir).toHaveBeenCalledWith('client', '/remote/src/deep');
    });
  });
});
