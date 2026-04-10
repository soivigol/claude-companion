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

function gitStageAll(projRoot) {
  try {
    execSync('git add -A', { cwd: projRoot });
    return { success: true };
  } catch (err) {
    return { error: err.stderr ? err.stderr.toString().trim() : err.message };
  }
}

function gitCommit(projRoot, message) {
  if (!message || !message.trim()) return { error: 'Commit message is required' };
  try {
    // Check if there are staged changes
    const staged = execSync('git diff --cached --name-only', { cwd: projRoot }).toString().trim();
    if (!staged) return { error: 'Nothing to commit — no staged changes' };

    const output = execSync('git commit -m ' + JSON.stringify(message.trim()), {
      cwd: projRoot, maxBuffer: 5 * 1024 * 1024,
    }).toString();

    // Extract short hash from output (e.g., "[main a1b2c3d] message")
    const match = output.match(/\[[\w/.-]+\s+([a-f0-9]+)\]/);
    const hash = match ? match[1] : null;
    return { success: true, hash };
  } catch (err) {
    return { error: err.stderr ? err.stderr.toString().trim() : err.message };
  }
}

function gitPush(projRoot) {
  try {
    execSync('git push 2>&1', { cwd: projRoot, maxBuffer: 5 * 1024 * 1024, timeout: 60000, shell: true });
    return { success: true };
  } catch (err) {
    const msg = (err.stdout ? err.stdout.toString().trim() : '') ||
                (err.stderr ? err.stderr.toString().trim() : '') ||
                err.message;
    return { error: msg };
  }
}

function getRemoteInfo(projRoot) {
  try {
    const raw = execSync('git remote -v', { cwd: projRoot }).toString().trim();
    if (!raw) return { hasRemote: false, remoteName: null, remoteUrl: null, ahead: 0, behind: 0 };
    const firstLine = raw.split('\n')[0];
    const parts = firstLine.split(/\s+/);
    let ahead = 0, behind = 0;
    try {
      const ab = execSync('git rev-list --left-right --count HEAD...@{upstream}', { cwd: projRoot }).toString().trim();
      const [a, b] = ab.split(/\s+/);
      ahead = parseInt(a, 10) || 0;
      behind = parseInt(b, 10) || 0;
    } catch {
      // no upstream configured
    }
    return { hasRemote: true, remoteName: parts[0] || 'origin', remoteUrl: parts[1] || null, ahead, behind };
  } catch {
    return { hasRemote: false, remoteName: null, remoteUrl: null, ahead: 0, behind: 0 };
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
  gitStageAll,
  gitCommit,
  gitPush,
  getRemoteInfo,
};
