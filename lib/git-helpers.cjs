/**
 * Git & filesystem helpers — extracted for testability.
 * These are pure functions that operate on the filesystem via injected
 * dependencies or direct calls, making them testable without Electron.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function getGitRoot(projRoot) {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd: projRoot }).toString().trim();
  } catch {
    return null;
  }
}

function getFileTree(dir, projRoot, depth = 0, maxDepth = 6) {
  if (depth > maxDepth) return [];

  const ignore = new Set([
    'node_modules', '.git', '.next', '.cache', '__pycache__',
    'dist', 'build', '.turbo', '.vercel', '.nuxt', 'vendor',
    '.wp-cli', 'wp-content/uploads', '.svn', 'coverage',
  ]);

  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  items = items
    .filter((i) => !i.name.startsWith('.') || i.name === '.claude')
    .filter((i) => !ignore.has(i.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const entries = [];
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(projRoot, fullPath);

    if (item.isDirectory()) {
      entries.push({
        name: item.name,
        path: relativePath,
        type: 'directory',
        children: getFileTree(fullPath, projRoot, depth + 1, maxDepth),
      });
    } else {
      entries.push({
        name: item.name,
        path: relativePath,
        type: 'file',
        ext: path.extname(item.name).slice(1),
      });
    }
  }

  return entries;
}

function getGitStatus(projRoot) {
  const gitRoot = getGitRoot(projRoot);
  if (!gitRoot) return { isGit: false, files: [], branch: null };

  try {
    const branch = execSync('git branch --show-current', { cwd: projRoot }).toString().trim();
    const raw = execSync('git status --porcelain', { cwd: projRoot }).toString();

    const statusMap = {
      M: 'modified', A: 'added', D: 'deleted', '??': 'untracked',
      R: 'renamed', MM: 'modified', AM: 'added', UU: 'conflict',
    };

    const files = raw.split('\n').filter(line => line.length > 0).map((line) => {
      const status = line.substring(0, 2).trim();
      return { status, path: line.substring(3), statusLabel: statusMap[status] || 'changed' };
    });

    return { isGit: true, files, branch };
  } catch {
    return { isGit: false, files: [], branch: null };
  }
}

function getGitDiff(projRoot, filePath) {
  if (!getGitRoot(projRoot)) return null;
  try {
    let diff = execSync(`git diff --no-color -- "${filePath}"`, {
      cwd: projRoot, maxBuffer: 5 * 1024 * 1024,
    }).toString();

    if (!diff) {
      diff = execSync(`git diff --cached --no-color -- "${filePath}"`, {
        cwd: projRoot, maxBuffer: 5 * 1024 * 1024,
      }).toString();
    }

    if (!diff) {
      const fullPath = path.join(projRoot, filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').map((l) => `+${l}`).join('\n');
        diff = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${content.split('\n').length} @@\n${lines}`;
      }
    }

    return diff || null;
  } catch {
    return null;
  }
}

function getFullDiff(projRoot) {
  if (!getGitRoot(projRoot)) return null;
  try {
    const buf = 10 * 1024 * 1024;
    let diff = execSync('git diff --no-color', { cwd: projRoot, maxBuffer: buf }).toString();
    const staged = execSync('git diff --cached --no-color', { cwd: projRoot, maxBuffer: buf }).toString();
    if (staged) diff = staged + '\n' + diff;

    // Include untracked files as synthetic diffs
    const raw = execSync('git status --porcelain', { cwd: projRoot }).toString();
    const untrackedFiles = raw.split('\n')
      .filter((line) => line.startsWith('??'))
      .map((line) => line.substring(3));

    for (const filePath of untrackedFiles) {
      const fullPath = path.join(projRoot, filePath);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        const linesDiff = lines.map((l) => `+${l}`).join('\n');
        diff += `\ndiff --git a/${filePath} b/${filePath}\nnew file mode 100644\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n${linesDiff}\n`;
      } catch {
        // Skip binary or unreadable files
      }
    }

    return diff || null;
  } catch {
    return null;
  }
}

function getRecentCommits(projRoot, count = 10) {
  try {
    const raw = execSync(
      `git log --oneline --no-decorate -n ${count} --format="%h|||%s|||%cr|||%an"`,
      { cwd: projRoot }
    ).toString().trim();
    return raw.split('\n').filter(Boolean).map((line) => {
      const [hash, message, time, author] = line.split('|||');
      return { hash, message, time, author };
    });
  } catch {
    return [];
  }
}

function getCommitDiff(projRoot, hash) {
  try {
    return execSync(`git show --no-color ${hash}`, {
      cwd: projRoot, maxBuffer: 10 * 1024 * 1024,
    }).toString();
  } catch {
    return null;
  }
}

module.exports = {
  getGitRoot,
  getFileTree,
  getGitStatus,
  getGitDiff,
  getFullDiff,
  getRecentCommits,
  getCommitDiff,
};
