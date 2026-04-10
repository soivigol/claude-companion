import { describe, it, expect, beforeEach } from 'vitest';
import { createSftpConfig } from '../lib/sftp-config.cjs';

function createMockStore() {
  const data = {};
  return {
    get: (key, fallback) => (key in data ? data[key] : fallback),
    set: (key, value) => { data[key] = value; },
    _data: data,
  };
}

const mockCrypto = {
  _counter: 0,
  randomUUID() {
    this._counter += 1;
    return `uuid-${this._counter}`;
  },
};

describe('sftp-config', () => {
  let store;
  let config;

  beforeEach(() => {
    store = createMockStore();
    mockCrypto._counter = 0;
    config = createSftpConfig(store, mockCrypto);
  });

  describe('getProjectConfig', () => {
    it('returns null for unknown project', () => {
      expect(config.getProjectConfig('/unknown')).toBeNull();
    });

    it('returns saved config', () => {
      config.saveRootConfig('/my-project', { host: 'example.com', username: 'user' });
      const result = config.getProjectConfig('/my-project');
      expect(result).not.toBeNull();
      expect(result.rootConfig.host).toBe('example.com');
    });
  });

  describe('saveRootConfig / getEffectiveConfigs', () => {
    it('saves and retrieves root config', () => {
      config.saveRootConfig('/proj', { host: 'srv.com', username: 'deploy', remotePath: '/var/www' });
      const effective = config.getEffectiveConfigs('/proj');
      expect(effective).toHaveLength(1);
      expect(effective[0].host).toBe('srv.com');
      expect(effective[0].context).toBe('.');
      expect(effective[0].port).toBe(22);
    });

    it('assigns an ID if none provided', () => {
      config.saveRootConfig('/proj', { host: 'a.com', username: 'u' });
      const effective = config.getEffectiveConfigs('/proj');
      expect(effective[0].id).toBe('uuid-1');
    });

    it('preserves existing ID on update', () => {
      const id = config.saveRootConfig('/proj', { host: 'a.com', username: 'u' });
      config.saveRootConfig('/proj', { id, host: 'b.com', username: 'u' });
      const effective = config.getEffectiveConfigs('/proj');
      expect(effective).toHaveLength(1);
      expect(effective[0].id).toBe(id);
      expect(effective[0].host).toBe('b.com');
    });

    it('applies defaults for missing fields', () => {
      config.saveRootConfig('/proj', { host: 'srv.com', username: 'u' });
      const c = config.getEffectiveConfigs('/proj')[0];
      expect(c.port).toBe(22);
      expect(c.protocol).toBe('sftp');
      expect(c.remotePath).toBe('/');
      expect(c.concurrency).toBe(4);
      expect(c.enabled).toBe(true);
      expect(c.ignore).toEqual(['node_modules/', '.git/', '.DS_Store']);
    });
  });

  describe('saveContextConfig', () => {
    it('adds context configs to the array', () => {
      config.saveContextConfig('/proj', { name: 'Frontend', context: 'frontend', host: 'cdn.com', username: 'u' });
      config.saveContextConfig('/proj', { name: 'API', context: 'api', host: 'api.com', username: 'u' });
      const raw = config.getProjectConfig('/proj');
      expect(raw.contextConfigs).toHaveLength(2);
      expect(raw.rootConfig).toBeNull();
    });

    it('updates existing context config by ID', () => {
      const id = config.saveContextConfig('/proj', { name: 'Frontend', context: 'frontend', host: 'cdn.com', username: 'u' });
      config.saveContextConfig('/proj', { id, name: 'Frontend', context: 'frontend', host: 'cdn2.com', username: 'u' });
      const raw = config.getProjectConfig('/proj');
      expect(raw.contextConfigs).toHaveLength(1);
      expect(raw.contextConfigs[0].host).toBe('cdn2.com');
    });
  });

  describe('hierarchy resolution', () => {
    it('root config takes priority over context configs', () => {
      config.saveContextConfig('/proj', { name: 'Sub', context: 'sub', host: 'sub.com', username: 'u' });
      config.saveRootConfig('/proj', { host: 'root.com', username: 'u' });
      const effective = config.getEffectiveConfigs('/proj');
      expect(effective).toHaveLength(1);
      expect(effective[0].host).toBe('root.com');
    });

    it('returns context configs when no root config', () => {
      config.saveContextConfig('/proj', { name: 'A', context: 'a', host: 'a.com', username: 'u' });
      config.saveContextConfig('/proj', { name: 'B', context: 'b', host: 'b.com', username: 'u' });
      const effective = config.getEffectiveConfigs('/proj');
      expect(effective).toHaveLength(2);
    });

    it('disabled root config falls through to context configs', () => {
      config.saveRootConfig('/proj', { host: 'root.com', username: 'u', enabled: false });
      config.saveContextConfig('/proj', { name: 'Sub', context: 'sub', host: 'sub.com', username: 'u' });
      const effective = config.getEffectiveConfigs('/proj');
      expect(effective).toHaveLength(1);
      expect(effective[0].host).toBe('sub.com');
    });

    it('filters out disabled context configs', () => {
      config.saveContextConfig('/proj', { name: 'A', context: 'a', host: 'a.com', username: 'u', enabled: true });
      config.saveContextConfig('/proj', { name: 'B', context: 'b', host: 'b.com', username: 'u', enabled: false });
      const effective = config.getEffectiveConfigs('/proj');
      expect(effective).toHaveLength(1);
      expect(effective[0].name).toBe('A');
    });
  });

  describe('removeConfig', () => {
    it('removes root config by ID', () => {
      const id = config.saveRootConfig('/proj', { host: 'a.com', username: 'u' });
      config.removeConfig('/proj', id);
      const raw = config.getProjectConfig('/proj');
      expect(raw).toBeNull();
    });

    it('removes context config by ID', () => {
      const id1 = config.saveContextConfig('/proj', { name: 'A', context: 'a', host: 'a.com', username: 'u' });
      config.saveContextConfig('/proj', { name: 'B', context: 'b', host: 'b.com', username: 'u' });
      config.removeConfig('/proj', id1);
      const raw = config.getProjectConfig('/proj');
      expect(raw.contextConfigs).toHaveLength(1);
      expect(raw.contextConfigs[0].name).toBe('B');
    });

    it('cleans up project entry when all configs removed', () => {
      const id = config.saveContextConfig('/proj', { name: 'A', context: 'a', host: 'a.com', username: 'u' });
      config.removeConfig('/proj', id);
      expect(config.getProjectConfig('/proj')).toBeNull();
    });
  });

  describe('removeProjectConfig', () => {
    it('removes all configs for a project', () => {
      config.saveRootConfig('/proj', { host: 'a.com', username: 'u' });
      config.saveContextConfig('/proj', { name: 'Sub', context: 'sub', host: 'b.com', username: 'u' });
      config.removeProjectConfig('/proj');
      expect(config.getProjectConfig('/proj')).toBeNull();
    });
  });

  describe('multiple projects', () => {
    it('configs are isolated per project path', () => {
      config.saveRootConfig('/proj-a', { host: 'a.com', username: 'u' });
      config.saveRootConfig('/proj-b', { host: 'b.com', username: 'u' });
      expect(config.getEffectiveConfigs('/proj-a')[0].host).toBe('a.com');
      expect(config.getEffectiveConfigs('/proj-b')[0].host).toBe('b.com');
    });
  });

  describe('changed file tracking', () => {
    it('returns empty array for unknown project', () => {
      expect(config.getChangedFiles('/unknown')).toEqual([]);
    });

    it('tracks added files', () => {
      config.addChangedFile('/proj', 'src/index.js');
      config.addChangedFile('/proj', 'src/utils.js');
      expect(config.getChangedFiles('/proj')).toEqual(['src/index.js', 'src/utils.js']);
    });

    it('deduplicates file paths', () => {
      config.addChangedFile('/proj', 'src/index.js');
      config.addChangedFile('/proj', 'src/index.js');
      expect(config.getChangedFiles('/proj')).toEqual(['src/index.js']);
    });

    it('clears changed files for a project', () => {
      config.addChangedFile('/proj', 'a.js');
      config.addChangedFile('/proj', 'b.js');
      config.clearChangedFiles('/proj');
      expect(config.getChangedFiles('/proj')).toEqual([]);
    });

    it('isolates changed files per project', () => {
      config.addChangedFile('/proj-a', 'a.js');
      config.addChangedFile('/proj-b', 'b.js');
      expect(config.getChangedFiles('/proj-a')).toEqual(['a.js']);
      expect(config.getChangedFiles('/proj-b')).toEqual(['b.js']);
    });

    it('persists across config instances (same store)', () => {
      config.addChangedFile('/proj', 'file.js');
      const config2 = createSftpConfig(store, mockCrypto);
      expect(config2.getChangedFiles('/proj')).toEqual(['file.js']);
    });
  });
});
