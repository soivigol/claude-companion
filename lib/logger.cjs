const fs = require('fs');

function createLogger(logPath) {
  fs.writeFileSync(logPath, '');
  function log(...args) {
    const msg = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
    fs.appendFileSync(logPath, msg);
  }
  return { log };
}

module.exports = { createLogger };
