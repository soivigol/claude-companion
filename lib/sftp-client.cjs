function createSftpClient(SftpClientClass, fs, log) {
  const connect = async (config) => {
    const options = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: 10000,
    };

    if (config.agent) {
      options.agent = config.agent;
    } else if (config.privateKeyPath) {
      options.privateKey = fs.readFileSync(config.privateKeyPath);
      if (config.passphrase && config.passphrase !== true) {
        options.passphrase = config.passphrase;
      }
    } else if (config.password) {
      options.password = config.password;
    }

    const client = new SftpClientClass();
    await client.connect(options);
    log('[sftp] connected to', config.host);
    return client;
  };

  const disconnect = async (client) => {
    try {
      await client.end();
      log('[sftp] disconnected');
    } catch (err) {
      log('[sftp] disconnect error:', err.message);
    }
  };

  const stat = async (client, remotePath) => {
    try {
      const info = await client.stat(remotePath);
      return { mtime: info.modifyTime, size: info.size };
    } catch {
      return null;
    }
  };

  const upload = async (client, localPath, remotePath) => {
    await client.put(localPath, remotePath);
  };

  const mkdir = async (client, remotePath) => {
    await client.mkdir(remotePath, true);
  };

  return { connect, disconnect, stat, upload, mkdir };
}

module.exports = { createSftpClient };
