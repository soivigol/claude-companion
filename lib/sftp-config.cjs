const STORE_KEY = 'sftpConfigs';
const CHANGED_KEY = 'sftpChangedFiles';

const defaultServerConfig = {
  id: '',
  name: '',
  context: '.',
  host: '',
  port: 22,
  username: '',
  protocol: 'sftp',
  remotePath: '/',
  password: null,
  privateKeyPath: null,
  passphrase: null,
  agent: null,
  ignore: ['node_modules/', '.git/', '.DS_Store'],
  concurrency: 4,
  enabled: true,
};

function createSftpConfig(store, crypto) {
  const getAllConfigs = () => store.get(STORE_KEY, {});

  const getProjectConfig = (projectPath) => {
    const all = getAllConfigs();
    return all[projectPath] || null;
  };

  const getEffectiveConfigs = (projectPath) => {
    const config = getProjectConfig(projectPath);
    if (!config) return [];

    if (config.rootConfig && config.rootConfig.enabled) {
      return [config.rootConfig];
    }

    return (config.contextConfigs || []).filter((c) => c.enabled);
  };

  const saveRootConfig = (projectPath, config) => {
    const all = getAllConfigs();
    const existing = all[projectPath] || { rootConfig: null, contextConfigs: [] };
    const id = config.id || crypto.randomUUID();

    existing.rootConfig = { ...defaultServerConfig, ...config, id, context: '.' };
    all[projectPath] = existing;
    store.set(STORE_KEY, all);
    return id;
  };

  const saveContextConfig = (projectPath, config) => {
    const all = getAllConfigs();
    const existing = all[projectPath] || { rootConfig: null, contextConfigs: [] };
    const id = config.id || crypto.randomUUID();
    const entry = { ...defaultServerConfig, ...config, id };

    const idx = existing.contextConfigs.findIndex((c) => c.id === id);
    if (idx >= 0) {
      existing.contextConfigs[idx] = entry;
    } else {
      existing.contextConfigs.push(entry);
    }

    all[projectPath] = existing;
    store.set(STORE_KEY, all);
    return id;
  };

  const removeConfig = (projectPath, configId) => {
    const all = getAllConfigs();
    const existing = all[projectPath];
    if (!existing) return;

    if (existing.rootConfig && existing.rootConfig.id === configId) {
      existing.rootConfig = null;
    } else {
      existing.contextConfigs = existing.contextConfigs.filter((c) => c.id !== configId);
    }

    if (!existing.rootConfig && existing.contextConfigs.length === 0) {
      delete all[projectPath];
    } else {
      all[projectPath] = existing;
    }

    store.set(STORE_KEY, all);
  };

  const removeProjectConfig = (projectPath) => {
    const all = getAllConfigs();
    delete all[projectPath];
    store.set(STORE_KEY, all);
  };

  // ── Changed file tracking (persistent across sessions) ──

  const getChangedFiles = (projectPath) => {
    const all = store.get(CHANGED_KEY, {});
    return all[projectPath] || [];
  };

  const addChangedFile = (projectPath, relativePath) => {
    const all = store.get(CHANGED_KEY, {});
    const files = all[projectPath] || [];
    if (!files.includes(relativePath)) {
      files.push(relativePath);
      all[projectPath] = files;
      store.set(CHANGED_KEY, all);
    }
  };

  const clearChangedFiles = (projectPath) => {
    const all = store.get(CHANGED_KEY, {});
    delete all[projectPath];
    store.set(CHANGED_KEY, all);
  };

  return {
    getProjectConfig,
    getEffectiveConfigs,
    saveRootConfig,
    saveContextConfig,
    removeConfig,
    removeProjectConfig,
    defaultServerConfig,
    getChangedFiles,
    addChangedFile,
    clearChangedFiles,
  };
}

module.exports = { createSftpConfig };
