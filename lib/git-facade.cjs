/**
 * Git facade — unified API that transparently routes between single-repo
 * (git-helpers) and multi-repo (git-multi-repo) based on project structure.
 *
 * Exports the same function signatures as git-helpers so it can be injected
 * as a drop-in replacement. Caches discovery results per project root.
 */
const { getGitRoot, getFileTree, getGitStatus, getGitDiff, getFullDiff, getRecentCommits, getCommitDiff, gitStageAll, gitCommit, gitPush, getRemoteInfo } = require('./git-helpers.cjs');
const { discoverGitRepos } = require('./git-discovery.cjs');
const { getMultiRepoStatus, getMultiRepoDiff, getMultiRepoFullDiff, getMultiRepoCommits, getMultiRepoCommitDiff, multiRepoStageAll, multiRepoCommit, multiRepoPush, multiRepoGetRemoteInfo } = require('./git-multi-repo.cjs');

/**
 * Cache stores the resolved git layout per project root:
 *   { type: 'single' }                    — root is a git repo
 *   { type: 'multi', repos: [string] }    — nested sub-repos found
 *   { type: 'none' }                      — no git at all
 */
const layoutCache = new Map();

function resolveLayout(projRoot) {
  if (layoutCache.has(projRoot)) return layoutCache.get(projRoot);

  if (getGitRoot(projRoot)) {
    const layout = { type: 'single' };
    layoutCache.set(projRoot, layout);
    return layout;
  }

  const repos = discoverGitRepos(projRoot);
  const layout = repos.length > 0
    ? { type: 'multi', repos }
    : { type: 'none' };
  layoutCache.set(projRoot, layout);
  return layout;
}

function clearLayoutCache(projRoot) {
  if (projRoot) layoutCache.delete(projRoot);
  else layoutCache.clear();
}

/* ── Facade functions (same signatures as git-helpers) ──── */

function facadeGetGitStatus(projRoot) {
  const layout = resolveLayout(projRoot);
  if (layout.type === 'single') return getGitStatus(projRoot);
  if (layout.type === 'multi') return getMultiRepoStatus(projRoot, layout.repos);
  return { isGit: false, files: [], branch: null };
}

function facadeGetGitDiff(projRoot, filePath) {
  const layout = resolveLayout(projRoot);
  if (layout.type === 'single') return getGitDiff(projRoot, filePath);
  if (layout.type === 'multi') return getMultiRepoDiff(projRoot, layout.repos, filePath);
  return null;
}

function facadeGetFullDiff(projRoot) {
  const layout = resolveLayout(projRoot);
  if (layout.type === 'single') return getFullDiff(projRoot);
  if (layout.type === 'multi') return getMultiRepoFullDiff(projRoot, layout.repos);
  return null;
}

function facadeGetRecentCommits(projRoot, count) {
  const layout = resolveLayout(projRoot);
  if (layout.type === 'single') return getRecentCommits(projRoot, count);
  if (layout.type === 'multi') return getMultiRepoCommits(projRoot, layout.repos, count);
  return [];
}

function facadeGetCommitDiff(projRoot, hash) {
  const layout = resolveLayout(projRoot);
  if (layout.type === 'single') return getCommitDiff(projRoot, hash);
  if (layout.type === 'multi') return getMultiRepoCommitDiff(projRoot, layout.repos, hash);
  return null;
}

/* ── Write operation facades ──────────────────────────── */

function facadeGitStageAll(projRoot) {
  const layout = resolveLayout(projRoot);
  if (layout.type === 'single') return gitStageAll(projRoot);
  if (layout.type === 'multi') return multiRepoStageAll(projRoot, layout.repos);
  return { error: 'Not a git repository' };
}

function facadeGitCommit(projRoot, message) {
  const layout = resolveLayout(projRoot);
  if (layout.type === 'single') return gitCommit(projRoot, message);
  if (layout.type === 'multi') return multiRepoCommit(projRoot, layout.repos, message);
  return { error: 'Not a git repository' };
}

function facadeGitPush(projRoot) {
  const layout = resolveLayout(projRoot);
  if (layout.type === 'single') return gitPush(projRoot);
  if (layout.type === 'multi') return multiRepoPush(projRoot, layout.repos);
  return { error: 'Not a git repository' };
}

function facadeGetRemoteInfo(projRoot) {
  const layout = resolveLayout(projRoot);
  if (layout.type === 'single') return getRemoteInfo(projRoot);
  if (layout.type === 'multi') return multiRepoGetRemoteInfo(projRoot, layout.repos);
  return { hasRemote: false, remoteName: null, remoteUrl: null };
}

module.exports = {
  getFileTree,
  getGitStatus: facadeGetGitStatus,
  getGitDiff: facadeGetGitDiff,
  getFullDiff: facadeGetFullDiff,
  getRecentCommits: facadeGetRecentCommits,
  getCommitDiff: facadeGetCommitDiff,
  gitStageAll: facadeGitStageAll,
  gitCommit: facadeGitCommit,
  gitPush: facadeGitPush,
  getRemoteInfo: facadeGetRemoteInfo,
  clearLayoutCache,
};
