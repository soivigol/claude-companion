import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFtpClient } from '../lib/ftp-client.cjs';

function createMockFtpClass(overrides = {}) {
  return class MockFtp {
    constructor() {
      this.connected = false;
      this.accessOptions = null;
      this.ftp = { verbose: true };
    }
    async access(options) {
      if (overrides.connectError) throw new Error(overrides.connectError);
      this.accessOptions = options;
      this.connected = true;
    }
    close() {
      this.connected = false;
    }
    async lastMod(remotePath) {
      if (overrides.lastModResults && remotePath in overrides.lastModResults) {
        return overrides.lastModResults[remotePath];
      }
      throw new Error('No such file');
    }
    async size(remotePath) {
      if (overrides.sizeResults && remotePath in overrides.sizeResults) {
        return overrides.sizeResults[remotePath];
      }
      throw new Error('No such file');
    }
    async uploadFrom(localPath, remotePath) {
      if (overrides.uploadError) throw new Error(overrides.uploadError);
    }
    async ensureDir(remotePath) {
      if (overrides.mkdirError) throw new Error(overrides.mkdirError);
    }
    async cd() {}
  };
}

const mockLog = vi.fn();

describe('ftp-client', () => {
  beforeEach(() => {
    mockLog.mockClear();
  });

  describe('connect', () => {
    it('connects with password', async () => {
      const MockClass = createMockFtpClass();
      const client = createFtpClient(MockClass, mockLog);
      const conn = await client.connect({ host: 'ftp.example.com', port: 21, username: 'user', password: 'pass' });
      expect(conn.accessOptions.host).toBe('ftp.example.com');
      expect(conn.accessOptions.port).toBe(21);
      expect(conn.accessOptions.user).toBe('user');
      expect(conn.accessOptions.password).toBe('pass');
      expect(conn.ftp.verbose).toBe(false);
    });

    it('defaults port to 21', async () => {
      const MockClass = createMockFtpClass();
      const client = createFtpClient(MockClass, mockLog);
      const conn = await client.connect({ host: 'ftp.example.com', username: 'user' });
      expect(conn.accessOptions.port).toBe(21);
    });

    it('throws on connection failure', async () => {
      const MockClass = createMockFtpClass({ connectError: 'Connection refused' });
      const client = createFtpClient(MockClass, mockLog);
      await expect(client.connect({ host: 'bad.com', username: 'u' })).rejects.toThrow('Connection refused');
    });
  });

  describe('stat', () => {
    it('returns mtime and size for existing file', async () => {
      const mtime = new Date('2024-01-15T10:00:00Z');
      const MockClass = createMockFtpClass({
        lastModResults: { '/remote/file.txt': mtime },
        sizeResults: { '/remote/file.txt': 2048 },
      });
      const client = createFtpClient(MockClass, mockLog);
      const conn = await client.connect({ host: 'ftp.example.com', username: 'u', password: 'p' });
      const result = await client.stat(conn, '/remote/file.txt');
      expect(result).toEqual({ mtime: mtime.getTime(), size: 2048 });
    });

    it('returns null for non-existent file', async () => {
      const MockClass = createMockFtpClass();
      const client = createFtpClient(MockClass, mockLog);
      const conn = await client.connect({ host: 'ftp.example.com', username: 'u', password: 'p' });
      const result = await client.stat(conn, '/remote/missing.txt');
      expect(result).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('disconnects without error', async () => {
      const MockClass = createMockFtpClass();
      const client = createFtpClient(MockClass, mockLog);
      const conn = await client.connect({ host: 'ftp.example.com', username: 'u', password: 'p' });
      await client.disconnect(conn);
      expect(conn.connected).toBe(false);
    });
  });

  describe('upload', () => {
    it('uploads a file', async () => {
      const MockClass = createMockFtpClass();
      const client = createFtpClient(MockClass, mockLog);
      const conn = await client.connect({ host: 'ftp.example.com', username: 'u', password: 'p' });
      await expect(client.upload(conn, '/local/file.txt', '/remote/file.txt')).resolves.toBeUndefined();
    });
  });

  describe('mkdir', () => {
    it('creates directory recursively', async () => {
      const MockClass = createMockFtpClass();
      const client = createFtpClient(MockClass, mockLog);
      const conn = await client.connect({ host: 'ftp.example.com', username: 'u', password: 'p' });
      await expect(client.mkdir(conn, '/remote/deep/path')).resolves.toBeUndefined();
    });
  });
});
