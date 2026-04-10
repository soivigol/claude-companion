/**
 * Smart commit message generator — pure functions, no Electron deps.
 * Analyzes changed files and diff content to produce conventional-commit-style messages.
 */
const path = require('path');

const DEPENDENCY_FILES = new Set([
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'composer.json', 'composer.lock', 'Gemfile', 'Gemfile.lock',
  'requirements.txt', 'Pipfile', 'Pipfile.lock', 'go.sum', 'go.mod',
]);

const SPECIAL_DIR_PREFIXES = {
  test: 'test', tests: 'test', spec: 'test', __tests__: 'test',
  docs: 'docs', doc: 'docs',
};

function classifyFiles(statusFiles) {
  const groups = { added: [], modified: [], deleted: [], untracked: [], renamed: [] };
  for (const f of statusFiles) {
    const s = f.status;
    if (s === '??' || s === 'A') groups.added.push(f.path);
    else if (s === 'D') groups.deleted.push(f.path);
    else if (s === 'R') groups.renamed.push(f.path);
    else groups.modified.push(f.path);
  }
  return groups;
}

function getTopDir(filePath) {
  const parts = filePath.split(/[/\\]/);
  return parts.length > 1 ? parts[0] : null;
}

function getScope(files) {
  const dirs = new Map();
  for (const f of files) {
    const dir = getTopDir(f);
    if (dir) dirs.set(dir, (dirs.get(dir) || 0) + 1);
  }
  if (dirs.size === 0) return null;
  if (dirs.size === 1) return dirs.keys().next().value;
  // Return the directory with most files
  let maxDir = null, maxCount = 0;
  for (const [dir, count] of dirs) {
    if (count > maxCount) { maxDir = dir; maxCount = count; }
  }
  return maxDir;
}

function isDepsOnly(files) {
  return files.length > 0 && files.every((f) => DEPENDENCY_FILES.has(path.basename(f)));
}

function isTestsOnly(files) {
  return files.length > 0 && files.every((f) => {
    const top = getTopDir(f);
    return (top && SPECIAL_DIR_PREFIXES[top] === 'test') || /\.test\.|\.spec\.|__tests__/.test(f);
  });
}

function isDocsOnly(files) {
  return files.length > 0 && files.every((f) => {
    const top = getTopDir(f);
    const ext = path.extname(f).toLowerCase();
    return (top && SPECIAL_DIR_PREFIXES[top] === 'docs') || ext === '.md' || ext === '.txt' || /readme/i.test(f);
  });
}

function isStyleOnly(files) {
  return files.length > 0 && files.every((f) => {
    const ext = path.extname(f).toLowerCase();
    return ext === '.css' || ext === '.scss' || ext === '.less' || ext === '.styl';
  });
}

function describeFiles(files, maxNames = 2) {
  if (files.length === 0) return '';
  const names = files.map((f) => path.basename(f, path.extname(f)));
  if (names.length <= maxNames) return names.join(', ');
  return `${names.length} files`;
}

function generateCommitMessage(statusFiles, _diffText) {
  if (!statusFiles || statusFiles.length === 0) return 'chore: empty commit';

  const allPaths = statusFiles.map((f) => f.path);
  const groups = classifyFiles(statusFiles);
  const totalFiles = statusFiles.length;

  // Special patterns first
  if (isDepsOnly(allPaths)) return 'chore: update dependencies';
  if (isTestsOnly(allPaths)) {
    const scope = getScope(allPaths);
    const desc = describeFiles(allPaths);
    return scope ? `test(${scope}): update ${desc}` : `test: update ${desc}`;
  }
  if (isDocsOnly(allPaths)) {
    const desc = describeFiles(allPaths);
    return `docs: update ${desc}`;
  }
  if (isStyleOnly(allPaths)) {
    const desc = describeFiles(allPaths);
    return `style: update ${desc}`;
  }

  // All new files
  if (groups.added.length === totalFiles) {
    const scope = getScope(allPaths);
    const desc = describeFiles(allPaths);
    const prefix = scope ? `feat(${scope})` : 'feat';
    return `${prefix}: add ${desc}`;
  }

  // All deleted
  if (groups.deleted.length === totalFiles) {
    const desc = describeFiles(allPaths);
    return `chore: remove ${desc}`;
  }

  // Single file change
  if (totalFiles === 1) {
    const f = statusFiles[0];
    const name = path.basename(f.path, path.extname(f.path));
    const scope = getScope([f.path]);
    const prefix = scope ? `update(${scope})` : 'update';
    return `${prefix}: modify ${name}`;
  }

  // Mixed changes — use dominant scope
  const scope = getScope(allPaths);
  const prefix = scope ? `update(${scope})` : 'update';

  const parts = [];
  if (groups.added.length) parts.push(`add ${groups.added.length}`);
  if (groups.modified.length) parts.push(`modify ${groups.modified.length}`);
  if (groups.deleted.length) parts.push(`remove ${groups.deleted.length}`);

  return `${prefix}: ${parts.join(', ')} files`;
}

module.exports = { generateCommitMessage };
