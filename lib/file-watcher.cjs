function setupWatcher(ctx, { log, watch, getFileTree, getGitStatus, path }) {
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
  ctx.watcher
    .on('add', debouncedUpdate)
    .on('change', debouncedUpdate)
    .on('unlink', debouncedUpdate)
    .on('addDir', debouncedUpdate)
    .on('unlinkDir', debouncedUpdate);
}

module.exports = { setupWatcher };
