function setupTerminal(ctx, { log, getDefaultShell, getShellArgs, getTerminalEnv }) {
  let pty;
  try {
    pty = require('node-pty');
  } catch (err) {
    log('[main] FAILED to load node-pty:', err.message);
    if (ctx.window && !ctx.window.isDestroyed()) {
      ctx.window.webContents.send('terminal-output',
        `\r\n  Error: Could not load terminal module.\r\n  ${err.message}\r\n`);
    }
    return;
  }
  const shell = getDefaultShell();
  const shellArgs = getShellArgs();
  const termEnv = getTerminalEnv(shell);
  log('[main] pty.spawn:', shell, shellArgs, 'cwd:', ctx.projectRoot);
  ctx.ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color', cols: 80, rows: 24,
    cwd: ctx.projectRoot, env: termEnv,
  });
  log('[main] pty spawned, pid:', ctx.ptyProcess.pid, 'window:', ctx.window.id);
  ctx.ptyProcess.onData((data) => {
    if (ctx.window && !ctx.window.isDestroyed()) {
      ctx.window.webContents.send('terminal-output', data);
    }
  });
  ctx.ptyProcess.onExit(({ exitCode }) => {
    log('[main] pty exited:', exitCode, 'window:', ctx.window.id);
    if (ctx.window && !ctx.window.isDestroyed()) {
      ctx.window.webContents.send('terminal-exit', exitCode);
    }
  });
  setTimeout(() => {
    if (ctx.ptyProcess) ctx.ptyProcess.write('claude\n');
  }, 400);
}

module.exports = { setupTerminal };
