/**
 * Post-packaging fixes for Claude Companion (legacy @electron/packager builds).
 * For electron-builder builds, these fixes are handled automatically.
 *
 * 1. Copy spawn-helper binary for node-pty
 * 2. Set custom icon in Info.plist (macOS only)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

// Detect platform and arch from release folder
const releaseDir = path.join(__dirname, '..', 'release');
let appDir;

if (IS_MAC) {
  const platformDir = fs.readdirSync(releaseDir).find(d => d.includes('darwin'));
  if (!platformDir) { console.log('No darwin build found, skipping.'); process.exit(0); }
  appDir = path.join(releaseDir, platformDir, 'Claude Companion.app');
  const RESOURCES = path.join(appDir, 'Contents', 'Resources');
  const UNPACKED_PTY = path.join(RESOURCES, 'app.asar.unpacked', 'node_modules', 'node-pty');
  const LOCAL_PTY = path.join(__dirname, '..', 'node_modules', 'node-pty');

  // 1. Copy spawn-helper to all build dirs
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const dirs = ['build/Release', `prebuilds/darwin-${arch}`, `bin/darwin-${arch}-130`];
  for (const d of dirs) {
    const src = path.join(LOCAL_PTY, d.startsWith('prebuilds') ? d : 'build/Release', 'spawn-helper');
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
    const RESOURCES_DIR = path.join(appDir, 'Contents', 'Resources');
    fs.copyFileSync(icns, path.join(RESOURCES_DIR, 'electron.icns'));
    fs.copyFileSync(icns, path.join(RESOURCES_DIR, 'icon.icns'));
    try {
      execSync(`plutil -replace CFBundleIconFile -string "icon.icns" "${path.join(appDir, 'Contents', 'Info.plist')}"`);
    } catch (e) {
      console.log('  Warning: plutil not available, icon may not be set in Info.plist');
    }
    console.log('  icon replaced');
  }
} else {
  console.log('  No macOS-specific post-package fixes needed on this platform.');
}

console.log('Post-package fixes applied.');
