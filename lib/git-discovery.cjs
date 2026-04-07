/**
 * Git repository discovery — finds nested git repos inside a project directory.
 * Used when the project root itself is not a git repo but contains sub-repos.
 */
const path = require('path');
const fs = require('fs');

const IGNORE_DIRS = new Set([
  'node_modules', '.next', '.cache', '__pycache__', 'dist', 'build',
  '.turbo', '.vercel', '.nuxt', 'vendor', '.wp-cli', 'coverage',
  'wp-content/uploads',
]);

const MAX_SCAN_DEPTH = 4;

/**
 * Recursively scan `projRoot` for directories containing `.git`.
 * Stops descending into a directory once a `.git` is found.
 * Returns absolute paths of all discovered git repos.
 */
function discoverGitRepos(projRoot) {
  const repos = [];
  scan(projRoot, 0, repos);
  return repos;
}

function scan(dir, depth, repos) {
  if (depth > MAX_SCAN_DEPTH) return;

  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

  const hasGit = items.some((i) => i.name === '.git');
  if (hasGit) {
    repos.push(dir);
    return;
  }

  for (const item of items) {
    if (!item.isDirectory()) continue;
    if (IGNORE_DIRS.has(item.name)) continue;
    if (item.name.startsWith('.')) continue;
    scan(path.join(dir, item.name), depth + 1, repos);
  }
}

/**
 * Given a file path (relative to projRoot), find which sub-repo it belongs to.
 * Returns { repoPath, repoName, repoRelativePath } or null.
 */
function findRepoForFile(repos, projRoot, filePath) {
  const normalized = filePath.split(path.sep).join('/');

  for (const repoPath of repos) {
    const repoName = path.relative(projRoot, repoPath).split(path.sep).join('/');
    if (normalized.startsWith(repoName + '/')) {
      return {
        repoPath,
        repoName,
        repoRelativePath: normalized.slice(repoName.length + 1),
      };
    }
  }
  return null;
}

module.exports = { discoverGitRepos, findRepoForFile };
