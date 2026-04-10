/**
 * Multi-repo git helpers — aggregates git operations across multiple sub-repos.
 * Each function receives the list of discovered repo paths and merges results
 * so file paths are relative to the project root (not the sub-repo).
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { findRepoForFile } = require('./git-discovery.cjs');

const STATUS_MAP = {
  M: 'modified', A: 'added', D: 'deleted', '??': 'untracked',
  R: 'renamed', MM: 'modified', AM: 'added', UU: 'conflict',
};

/* ── Status ─────────────────────────────────────────────── */

function getMultiRepoStatus(projRoot, repos) {
  if (repos.length === 0) return { isGit: false, files: [], branch: null };

  const allFiles = [];
  const branches = [];

  for (const repoPath of repos) {
    const repoName = path.relative(projRoot, repoPath);
    try {
      const branch = execSync('git branch --show-current', { cwd: repoPath }).toString().trim();
      const raw = execSync('git status --porcelain', { cwd: repoPath }).toString();

      branches.push({ repo: repoName, branch });

      for (const line of raw.split('\n').filter(Boolean)) {
        const status = line.substring(0, 2).trim();
        const filePath = line.substring(3);
        allFiles.push({
          status,
          path: [repoName, filePath].join('/'),
          statusLabel: STATUS_MAP[status] || 'changed',
          repo: repoName,
        });
      }
    } catch {
      // skip repos that fail
    }
  }

  if (branches.length === 0) return { isGit: false, files: [], branch: null };

  return {
    isGit: true,
    isMultiRepo: true,
    files: allFiles,
    branch: branches[0].branch,
    repos: branches,
  };
}

/* ── Single-file diff ───────────────────────────────────── */

function getMultiRepoDiff(projRoot, repos, filePath) {
  const match = findRepoForFile(repos, projRoot, filePath);
  if (!match) return null;

  const { repoPath, repoRelativePath } = match;
  try {
    let diff = execSync(`git diff --no-color -- "${repoRelativePath}"`, {
      cwd: repoPath, maxBuffer: 5 * 1024 * 1024,
    }).toString();

    if (!diff) {
      diff = execSync(`git diff --cached --no-color -- "${repoRelativePath}"`, {
        cwd: repoPath, maxBuffer: 5 * 1024 * 1024,
      }).toString();
    }

    if (!diff) {
      const fullPath = path.join(repoPath, repoRelativePath);
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

/* ── Full diff (all repos combined) ─────────────────────── */

function getMultiRepoFullDiff(projRoot, repos) {
  if (repos.length === 0) return null;

  let combinedDiff = '';
  const buf = 10 * 1024 * 1024;

  for (const repoPath of repos) {
    const repoName = path.relative(projRoot, repoPath);
    try {
      let diff = execSync('git diff --no-color', { cwd: repoPath, maxBuffer: buf }).toString();
      const staged = execSync('git diff --cached --no-color', { cwd: repoPath, maxBuffer: buf }).toString();
      if (staged) diff = staged + '\n' + diff;

      diff = rewriteDiffPaths(diff, repoName);
      diff += buildUntrackedDiffs(repoPath, repoName);

      combinedDiff += diff;
    } catch {
      // skip failing repos
    }
  }

  return combinedDiff || null;
}

function rewriteDiffPaths(diff, repoName) {
  if (!diff) return '';
  return diff
    .replace(/^(diff --git a\/)(.+?)( b\/)(.+)$/gm, `$1${repoName}/$2$3${repoName}/$4`)
    .replace(/^(--- a\/)(.+)$/gm, `$1${repoName}/$2`)
    .replace(/^(\+\+\+ b\/)(.+)$/gm, `$1${repoName}/$2`);
}

function buildUntrackedDiffs(repoPath, repoName) {
  let diff = '';
  try {
    const raw = execSync('git status --porcelain', { cwd: repoPath }).toString();
    const untrackedFiles = raw.split('\n')
      .filter((line) => line.startsWith('??'))
      .map((line) => line.substring(3));

    for (const file of untrackedFiles) {
      try {
        const content = fs.readFileSync(path.join(repoPath, file), 'utf-8');
        const lines = content.split('\n');
        const linesDiff = lines.map((l) => `+${l}`).join('\n');
        const prefixed = [repoName, file].join('/');
        diff += `\ndiff --git a/${prefixed} b/${prefixed}\nnew file mode 100644\n--- /dev/null\n+++ b/${prefixed}\n@@ -0,0 +1,${lines.length} @@\n${linesDiff}\n`;
      } catch {
        // skip binary or unreadable
      }
    }
  } catch {
    // ignore
  }
  return diff;
}

/* ── Commits (merged from all repos, sorted by date) ───── */

function getMultiRepoCommits(projRoot, repos, count = 10) {
  const allCommits = [];

  for (const repoPath of repos) {
    const repoName = path.relative(projRoot, repoPath);
    try {
      const raw = execSync(
        `git log --oneline --no-decorate -n ${count} --format="%h|||%s|||%cr|||%an|||%ct"`,
        { cwd: repoPath },
      ).toString().trim();

      for (const line of raw.split('\n').filter(Boolean)) {
        const [hash, message, time, author, ts] = line.split('|||');
        allCommits.push({ hash, message, time, author, repo: repoName, _ts: parseInt(ts, 10) });
      }
    } catch {
      // skip
    }
  }

  return allCommits
    .sort((a, b) => b._ts - a._ts)
    .slice(0, count)
    .map(({ _ts, ...rest }) => rest);
}

/* ── Commit diff (try each repo until one matches) ──────── */

function getMultiRepoCommitDiff(projRoot, repos, hash) {
  for (const repoPath of repos) {
    try {
      return execSync(`git show --no-color ${hash}`, {
        cwd: repoPath, maxBuffer: 10 * 1024 * 1024,
      }).toString();
    } catch {
      // hash not in this repo — try next
    }
  }
  return null;
}

/* ── Write operations (stage, commit, push) ────────────── */

function multiRepoStageAll(projRoot, repos) {
  const staged = [];
  for (const repoPath of repos) {
    const repoName = path.relative(projRoot, repoPath);
    try {
      const raw = execSync('git status --porcelain', { cwd: repoPath }).toString().trim();
      if (!raw) continue;
      execSync('git add -A', { cwd: repoPath });
      staged.push(repoName);
    } catch (err) {
      return { error: `Failed to stage in ${repoName}: ${err.message}` };
    }
  }
  return { success: true, repos: staged };
}

function multiRepoCommit(projRoot, repos, message) {
  if (!message || !message.trim()) return { error: 'Commit message is required' };
  const committed = [];
  for (const repoPath of repos) {
    const repoName = path.relative(projRoot, repoPath);
    try {
      const staged = execSync('git diff --cached --name-only', { cwd: repoPath }).toString().trim();
      if (!staged) continue;
      const output = execSync('git commit -m ' + JSON.stringify(message.trim()), {
        cwd: repoPath, maxBuffer: 5 * 1024 * 1024,
      }).toString();
      const match = output.match(/\[[\w/.-]+\s+([a-f0-9]+)\]/);
      committed.push({ repo: repoName, hash: match ? match[1] : null });
    } catch (err) {
      return { error: `Failed to commit in ${repoName}: ${err.stderr ? err.stderr.toString().trim() : err.message}` };
    }
  }
  if (committed.length === 0) return { error: 'Nothing to commit — no staged changes in any repo' };
  return { success: true, committed };
}

function multiRepoPush(projRoot, repos) {
  const pushed = [];
  const errors = [];
  for (const repoPath of repos) {
    const repoName = path.relative(projRoot, repoPath);
    try {
      const remote = execSync('git remote -v', { cwd: repoPath }).toString().trim();
      if (!remote) continue;
      execSync('git push 2>&1', { cwd: repoPath, maxBuffer: 5 * 1024 * 1024, timeout: 60000, shell: true });
      pushed.push(repoName);
    } catch (err) {
      errors.push({ repo: repoName, error: err.stderr ? err.stderr.toString().trim() : err.message });
    }
  }
  if (errors.length > 0 && pushed.length === 0) return { error: errors.map((e) => `${e.repo}: ${e.error}`).join('; ') };
  return { success: true, pushed, errors };
}

function multiRepoGetRemoteInfo(projRoot, repos) {
  for (const repoPath of repos) {
    try {
      const raw = execSync('git remote -v', { cwd: repoPath }).toString().trim();
      if (raw) return { hasRemote: true, remoteName: raw.split(/\s+/)[0], remoteUrl: raw.split(/\s+/)[1] };
    } catch {
      // try next
    }
  }
  return { hasRemote: false, remoteName: null, remoteUrl: null };
}

module.exports = {
  getMultiRepoStatus,
  getMultiRepoDiff,
  getMultiRepoFullDiff,
  getMultiRepoCommits,
  getMultiRepoCommitDiff,
  multiRepoStageAll,
  multiRepoCommit,
  multiRepoPush,
  multiRepoGetRemoteInfo,
};
