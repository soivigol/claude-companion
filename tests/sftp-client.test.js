import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSftpClient } from '../lib/sftp-client.cjs';

function createMockSftpClass(overrides = {}) {
  return class MockSftp {
    constructor() {
      this.connected = false;
      this.connectOptions = null;
    }
    async connect(options) {
      if (overrides.connectError) throw new Error(overrides.connectError);
      this.connectOptions = options;
      this.connected = true;
    }
    async end() {
      this.connected = false;
    }
    async stat(remotePath) {
      if (overrides.statResults && remotePath in overrides.statResults) {
        return overrides.statResults[remotePath];
      }
      throw new Error('No such file');
    }
    async put(localPath, remotePath) {
      if (overrides.putError) throw new Error(overrides.putError);
    }
    async mkdir(remotePath, recursive) {
      if (overrides.mkdirError) throw new Error(overrides.mkdirError);
    }
  };
}

const mockFs = {
  readFileSync: (path) => `key-content-of-${path}`,
};

const mockLog = vi.fn();

describe('sftp-client', () => {
  beforeEach(() => {
    mockLog.mockClear();
  });

  describe('connect', () => {
    it('connects with password auth', async () => {
      const MockClass = createMockSftpClass();
      const client = createSftpClient(MockClass, mockFs, mockLog);
      const conn = await client.connect({ host: 'srv.com', port: 22, username: 'user', password: 'pass' });
      expect(conn.connectOptions.password).toBe('pass');
      expect(conn.connectOptions.host).toBe('srv.com');
    });

    it('connects with private key', async () => {
      const MockClass = createMockSftpClass();
      const client = createSftpClient(MockClass, mockFs, mockLog);
      const conn = await client.connect({ host: 'srv.com', username: 'user', privateKeyPath: '/home/.ssh/id_rsa' });
      expect(conn.connectOptions.privateKey).toBe('key-content-of-/home/.ssh/id_rsa');
      expect(conn.connectOptions.password).toBeUndefined();
    });

    it('connects with private key and passphrase', async () => {
      const MockClass = createMockSftpClass();
      const client = createSftpClient(MockClass, mockFs, mockLog);
      const conn = await client.connect({
        host: 'srv.com', username: 'user',
        privateKeyPath: '/home/.ssh/id_rsa', passphrase: 'secret',
      });
      expect(conn.connectOptions.privateKey).toBe('key-content-of-/home/.ssh/id_rsa');
      expect(conn.connectOptions.passphrase).toBe('secret');
    });

    it('ignores passphrase=true (prompt marker)', async () => {
      const MockClass = createMockSftpClass();
      const client = createSftpClient(MockClass, mockFs, mockLog);
      const conn = await client.connect({
        host: 'srv.com', username: 'user',
        privateKeyPath: '/home/.ssh/id_rsa', passphrase: true,
      });
      expect(conn.connectOptions.passphrase).toBeUndefined();
    });

    it('connects with SSH agent', async () => {
      const MockClass = createMockSftpClass();
      const client = createSftpClient(MockClass, mockFs, mockLog);
      const conn = await client.connect({ host: 'srv.com', username: 'user', agent: '/tmp/ssh-agent.sock' });
      expect(conn.connectOptions.agent).toBe('/tmp/ssh-agent.sock');
    });

    it('throws on connection failure', async () => {
      const MockClass = createMockSftpClass({ connectError: 'Connection refused' });
      const client = createSftpClient(MockClass, mockFs, mockLog);
      await expect(client.connect({ host: 'bad.com', username: 'u' })).rejects.toThrow('Connection refused');
    });
  });

  describe('stat', () => {
    it('returns mtime and size for existing file', async () => {
      const MockClass = createMockSftpClass({
        statResults: { '/remote/file.txt': { modifyTime: 1700000000, size: 1024 } },
      });
      const sftpClient = createSftpClient(MockClass, mockFs, mockLog);
      const conn = await sftpClient.connect({ host: 'srv.com', username: 'u', password: 'p' });
      const result = await sftpClient.stat(conn, '/remote/file.txt');
      expect(result).toEqual({ mtime: 1700000000, size: 1024 });
    });

    it('returns null for non-existent file', async () => {
      const MockClass = createMockSftpClass();
      const sftpClient = createSftpClient(MockClass, mockFs, mockLog);
      const conn = await sftpClient.connect({ host: 'srv.com', username: 'u', password: 'p' });
      const result = await sftpClient.stat(conn, '/remote/missing.txt');
      expect(result).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('disconnects without error', async () => {
      const MockClass = createMockSftpClass();
      const sftpClient = createSftpClient(MockClass, mockFs, mockLog);
      const conn = await sftpClient.connect({ host: 'srv.com', username: 'u', password: 'p' });
      await sftpClient.disconnect(conn);
      expect(conn.connected).toBe(false);
    });
  });
});
