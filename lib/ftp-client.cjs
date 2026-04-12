function createFtpClient(FtpClientClass, log) {
  const connect = async (config) => {
    const client = new FtpClientClass();
    client.ftp.verbose = false;
    await client.access({
      host: config.host,
      port: config.port || 21,
      user: config.username,
      password: config.password || '',
      secure: false,
    });
    log('[ftp] connected to', config.host);
    return client;
  };

  const disconnect = async (client) => {
    try {
      client.close();
      log('[ftp] disconnected');
    } catch (err) {
      log('[ftp] disconnect error:', err.message);
    }
  };

  const stat = async (client, remotePath) => {
    try {
      const mtime = await client.lastMod(remotePath);
      const size = await client.size(remotePath);
      return { mtime: mtime.getTime(), size };
    } catch {
      return null;
    }
  };

  const upload = async (client, localPath, remotePath) => {
    await client.uploadFrom(localPath, remotePath);
  };

  const mkdir = async (client, remotePath) => {
    await client.ensureDir(remotePath);
    await client.cd('/');
  };

  return { connect, disconnect, stat, upload, mkdir };
}

module.exports = { createFtpClient };
