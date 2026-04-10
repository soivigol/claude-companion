const ALWAYS_IGNORE = ['.git', 'node_modules', '.DS_Store'];

function createSftpSync(sftpClient, fs, path, log, picomatch) {
  const matchesIgnore = (filePath, patterns) => {
    const allPatterns = [...ALWAYS_IGNORE, ...patterns];
    for (const pattern of allPatterns) {
      const matcher = picomatch(pattern, { dot: true });
      if (matcher(filePath)) return true;

      const segments = filePath.split('/');
      for (const segment of segments) {
        if (matcher(segment)) return true;
        if (matcher(segment + '/')) return true;
      }
    }
    return false;
  };

  const buildFileList = (localRoot, ignorePatterns) => {
    const files = [];

    const walk = (dir, relativeBase) => {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const relativePath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;

        if (matchesIgnore(relativePath, ignorePatterns)) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, relativePath);
        } else if (entry.isFile()) {
          files.push(relativePath);
        }
      }
    };

    walk(localRoot, '');
    return files;
  };

  const detectConflicts = async (client, localRoot, remotePath, files) => {
    const conflicts = [];

    for (const file of files) {
      const localFull = path.join(localRoot, file);
      const remoteFile = `${remotePath}/${file}`;

      const remoteStat = await sftpClient.stat(client, remoteFile);
      if (!remoteStat) continue;

      const localStat = fs.statSync(localFull);
      const localMtime = localStat.mtimeMs;
      const remoteMtime = remoteStat.mtime;

      if (remoteMtime > localMtime) {
        conflicts.push({
          file,
          localMtime,
          remoteMtime,
        });
      }
    }

    return conflicts;
  };

  const collectRemoteDirs = (files, remotePath) => {
    const dirs = new Set();
    for (const file of files) {
      const dir = path.posix.dirname(file);
      if (dir === '.') continue;

      const parts = dir.split('/');
      let current = '';
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        dirs.add(`${remotePath}/${current}`);
      }
    }
    return [...dirs].sort();
  };

  const asyncPool = async (concurrency, items, fn) => {
    const results = [];
    const executing = new Set();

    for (const item of items) {
      const p = fn(item).then((r) => {
        executing.delete(p);
        return { status: 'fulfilled', value: r };
      }).catch((err) => {
        executing.delete(p);
        return { status: 'rejected', reason: err };
      });
      executing.add(p);
      results.push(p);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  };

  const syncFiles = async (client, localRoot, remotePath, files, options = {}) => {
    const { concurrency = 4, skipFiles = new Set(), onProgress } = options;

    const uploadList = files.filter((f) => !skipFiles.has(f));

    const dirs = collectRemoteDirs(uploadList, remotePath);
    for (const dir of dirs) {
      try {
        await sftpClient.mkdir(client, dir);
      } catch (err) {
        log('[sftp] mkdir error:', dir, err.message);
      }
    }

    let uploaded = 0;
    let skipped = skipFiles.size;
    const errors = [];
    let index = 0;

    const results = await asyncPool(concurrency, uploadList, async (file) => {
      const localFull = path.join(localRoot, file);
      const remoteFile = `${remotePath}/${file}`;
      const currentIndex = ++index;

      if (onProgress) {
        onProgress({ file, index: currentIndex, total: uploadList.length, status: 'uploading' });
      }

      try {
        await sftpClient.upload(client, localFull, remoteFile);
        uploaded++;
      } catch (err) {
        errors.push({ file, error: err.message });
        log('[sftp] upload error:', file, err.message);
      }
    });

    return { uploaded, skipped, errors, total: files.length };
  };

  return {
    matchesIgnore,
    buildFileList,
    detectConflicts,
    collectRemoteDirs,
    asyncPool,
    syncFiles,
  };
}

module.exports = { createSftpSync, ALWAYS_IGNORE };
