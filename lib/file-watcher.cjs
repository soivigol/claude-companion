function setupWatcher(ctx, { log, watch, getFileTree, getGitStatus, path, onFileTracked }) {
  ctx.watcher = watch(ctx.projectRoot, {
    ignored: /(node_modules|\.git|\.next|dist|build|__pycache__|\.cache|\.turbo|\.vercel|vendor)/,
    persistent: true, ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
  });
  let debounceTimer;
  const debouncedUpdate = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (ctx.window && !ctx.window.isDestroyed()) {
        ctx.window.webContents.send('file-change', {
          tree: { root: path.basename(ctx.projectRoot), tree: getFileTree(ctx.projectRoot, ctx.projectRoot) },
          status: getGitStatus(ctx.projectRoot),
        });
      }
    }, 500);
  };

  const trackAndUpdate = (filePath) => {
    if (onFileTracked && ctx.projectRoot) {
      const relative = path.relative(ctx.projectRoot, filePath).split(path.sep).join('/');
      if (relative && !relative.startsWith('..')) {
        onFileTracked(ctx.projectRoot, relative);
      }
    }
    debouncedUpdate();
  };

  ctx.watcher
    .on('add', trackAndUpdate)
    .on('change', trackAndUpdate)
    .on('unlink', trackAndUpdate)
    .on('addDir', debouncedUpdate)
    .on('unlinkDir', debouncedUpdate);
}

module.exports = { setupWatcher };
