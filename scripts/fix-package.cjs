/**
 * Post-packaging fixes for Claude Companion:
 * 1. Copy spawn-helper binary for node-pty
 * 2. Set custom icon in Info.plist
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP = path.join(__dirname, '..', 'release', 'Claude Companion-darwin-arm64', 'Claude Companion.app');
const RESOURCES = path.join(APP, 'Contents', 'Resources');
const UNPACKED_PTY = path.join(RESOURCES, 'app.asar.unpacked', 'node_modules', 'node-pty');
const LOCAL_PTY = path.join(__dirname, '..', 'node_modules', 'node-pty');

// 1. Copy spawn-helper to all build dirs
const dirs = ['build/Release', 'prebuilds/darwin-arm64', 'bin/darwin-arm64-130'];
for (const d of dirs) {
  const src = path.join(LOCAL_PTY, d === 'prebuilds/darwin-arm64' ? d : 'build/Release', 'spawn-helper');
  const dest = path.join(UNPACKED_PTY, d, 'spawn-helper');
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, 0o755);
    console.log(`  spawn-helper -> ${d}/`);
  }
}

// 2. Fix icon
const icns = path.join(__dirname, '..', 'assets', 'icon.icns');
if (fs.existsSync(icns)) {
  fs.copyFileSync(icns, path.join(RESOURCES, 'electron.icns'));
  fs.copyFileSync(icns, path.join(RESOURCES, 'icon.icns'));
  execSync(`plutil -replace CFBundleIconFile -string "icon.icns" "${path.join(APP, 'Contents', 'Info.plist')}"`);
  console.log('  icon replaced');
}

console.log('Post-package fixes applied.');
