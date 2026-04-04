import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import os from 'os';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  getGitRoot,
  getFileTree,
  getGitStatus,
  getGitDiff,
  getFullDiff,
  getRecentCommits,
  getCommitDiff,
} = require('../lib/git-helpers.cjs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
let tmpDir;

// Create a temporary git repo for isolated testing
beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-test-'));
  execSync('git init', { cwd: tmpDir });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir });
  execSync('git config user.name "Test"', { cwd: tmpDir });
  execSync('git config commit.gpgsign false', { cwd: tmpDir });

  // Create some files
  fs.writeFileSync(path.join(tmpDir, 'hello.js'), 'console.log("hello");\n');
  fs.writeFileSync(path.join(tmpDir, 'readme.md'), '# Test\n');
  fs.mkdirSync(path.join(tmpDir, 'src'));
  fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), 'export {};\n');
  fs.mkdirSync(path.join(tmpDir, '.claude'));
  fs.writeFileSync(path.join(tmpDir, '.claude', 'config.json'), '{}');
  fs.mkdirSync(path.join(tmpDir, 'node_modules'));
  fs.writeFileSync(path.join(tmpDir, 'node_modules', 'junk.js'), '// should be ignored');
  fs.mkdirSync(path.join(tmpDir, '.git-ignored-dir'));
  fs.writeFileSync(path.join(tmpDir, '.git-ignored-dir', 'secret.txt'), 'hidden');

  execSync('git add -A', { cwd: tmpDir });
  execSync('git commit --no-gpg-sign -m "initial commit"', { cwd: tmpDir });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// getGitRoot
// ============================================================

describe('getGitRoot', () => {
  it('returns the git root for a valid repo', () => {
    const root = getGitRoot(PROJECT_ROOT);
    expect(root).toBe(PROJECT_ROOT);
  });

  it('returns the git root for the temp repo', () => {
    const root = getGitRoot(tmpDir);
    expect(root).toBeTruthy();
  });

  it('returns null for a non-git directory', () => {
    const root = getGitRoot('/tmp');
    expect(root).toBeNull();
  });
});

// ============================================================
// getFileTree
// ============================================================

describe('getFileTree', () => {
  it('returns files and directories', () => {
    const tree = getFileTree(tmpDir, tmpDir);
    const names = tree.map(n => n.name);
    expect(names).toContain('hello.js');
    expect(names).toContain('readme.md');
    expect(names).toContain('src');
  });

  it('includes .claude directory', () => {
    const tree = getFileTree(tmpDir, tmpDir);
    const names = tree.map(n => n.name);
    expect(names).toContain('.claude');
  });

  it('ignores node_modules', () => {
    const tree = getFileTree(tmpDir, tmpDir);
    const names = tree.map(n => n.name);
    expect(names).not.toContain('node_modules');
  });

  it('ignores hidden directories (except .claude)', () => {
    const tree = getFileTree(tmpDir, tmpDir);
    const names = tree.map(n => n.name);
    expect(names).not.toContain('.git-ignored-dir');
    expect(names).not.toContain('.git');
  });

  it('directories are listed before files', () => {
    const tree = getFileTree(tmpDir, tmpDir);
    const firstDir = tree.findIndex(n => n.type === 'directory');
    const firstFile = tree.findIndex(n => n.type === 'file');
    if (firstDir >= 0 && firstFile >= 0) {
      expect(firstDir).toBeLessThan(firstFile);
    }
  });

  it('respects maxDepth', () => {
    const tree = getFileTree(tmpDir, tmpDir, 0, 0);
    const srcEntry = tree.find(n => n.name === 'src');
    expect(srcEntry.children).toEqual([]);
  });

  it('sets correct file extensions', () => {
    const tree = getFileTree(tmpDir, tmpDir);
    const jsFile = tree.find(n => n.name === 'hello.js');
    expect(jsFile.ext).toBe('js');
    const mdFile = tree.find(n => n.name === 'readme.md');
    expect(mdFile.ext).toBe('md');
  });

  it('uses relative paths', () => {
    const tree = getFileTree(tmpDir, tmpDir);
    for (const item of tree) {
      expect(path.isAbsolute(item.path)).toBe(false);
    }
  });

  it('returns empty array for non-existent directory', () => {
    const tree = getFileTree('/nonexistent/path/xyz', '/nonexistent');
    expect(tree).toEqual([]);
  });
});

// ============================================================
// getGitStatus
// ============================================================

describe('getGitStatus', () => {
  it('returns isGit: true and branch for a git repo', () => {
    const status = getGitStatus(tmpDir);
    expect(status.isGit).toBe(true);
    expect(typeof status.branch).toBe('string');
    expect(Array.isArray(status.files)).toBe(true);
  });

  it('returns isGit: false for a non-git directory', () => {
    const status = getGitStatus('/tmp');
    expect(status.isGit).toBe(false);
    expect(status.files).toEqual([]);
    expect(status.branch).toBeNull();
  });

  it('detects modified files', () => {
    // Verify initial commit exists
    const log = execSync('git log --oneline', { cwd: tmpDir }).toString().trim();
    expect(log).toContain('initial commit');

    const testFile = path.join(tmpDir, 'hello.js');
    fs.writeFileSync(testFile, 'console.log("modified");\n');

    const status = getGitStatus(tmpDir);
    expect(status.files.length).toBeGreaterThan(0);
    const modified = status.files.find(f => f.path.includes('hello.js'));
    expect(modified).toBeTruthy();
    expect(modified.statusLabel).toBe('modified');

    // Restore using git checkout to ensure clean state
    execSync('git checkout -- hello.js', { cwd: tmpDir });
  });

  it('detects untracked files', () => {
    const newFile = path.join(tmpDir, 'new-file.txt');
    fs.writeFileSync(newFile, 'new content\n');

    const status = getGitStatus(tmpDir);
    const untracked = status.files.find(f => f.path.includes('new-file.txt'));
    expect(untracked).toBeTruthy();
    expect(untracked.statusLabel).toBe('untracked');

    fs.unlinkSync(newFile);
  });
});

// ============================================================
// getGitDiff
// ============================================================

describe('getGitDiff', () => {
  it('returns null for non-git directory', () => {
    expect(getGitDiff('/tmp', 'file.txt')).toBeNull();
  });

  it('returns diff for a modified file', () => {
    const testFile = path.join(tmpDir, 'hello.js');
    const original = fs.readFileSync(testFile, 'utf-8');
    fs.writeFileSync(testFile, 'console.log("changed");\n');

    const diff = getGitDiff(tmpDir, 'hello.js');
    expect(diff).toBeTruthy();
    expect(diff).toContain('hello.js');

    execSync('git checkout -- hello.js', { cwd: tmpDir });
  });

  it('returns diff for untracked files as new file', () => {
    const newFile = path.join(tmpDir, 'brand-new.js');
    fs.writeFileSync(newFile, 'const x = 1;\n');

    const diff = getGitDiff(tmpDir, 'brand-new.js');
    expect(diff).toBeTruthy();
    expect(diff).toContain('+++ b/brand-new.js');
    expect(diff).toContain('+const x = 1;');

    fs.unlinkSync(newFile);
  });

  it('returns synthetic diff for unchanged tracked file (shows file content)', () => {
    // When a file has no git diff (tracked, unchanged), getGitDiff falls back
    // to returning the file content as a "new file" diff for display purposes
    const diff = getGitDiff(tmpDir, 'hello.js');
    // The fallback shows file content as additions
    expect(diff).toContain('+++ b/hello.js');
  });

  it('returns null for nonexistent file', () => {
    const diff = getGitDiff(tmpDir, 'does-not-exist.js');
    expect(diff).toBeNull();
  });
});

// ============================================================
// getFullDiff
// ============================================================

describe('getFullDiff', () => {
  it('returns null for non-git directory', () => {
    expect(getFullDiff('/tmp')).toBeNull();
  });

  it('returns combined diff when there are changes', () => {
    const testFile = path.join(tmpDir, 'hello.js');
    const original = fs.readFileSync(testFile, 'utf-8');
    fs.writeFileSync(testFile, 'console.log("full diff test");\n');

    const diff = getFullDiff(tmpDir);
    expect(diff).toBeTruthy();

    execSync('git checkout -- hello.js', { cwd: tmpDir });
  });

  it('returns null when there are no changes', () => {
    const diff = getFullDiff(tmpDir);
    expect(diff).toBeNull();
  });
});

// ============================================================
// getRecentCommits
// ============================================================

describe('getRecentCommits', () => {
  it('returns commits for a git repo', () => {
    const commits = getRecentCommits(tmpDir, 5);
    expect(commits.length).toBeGreaterThan(0);
    expect(commits[0]).toHaveProperty('hash');
    expect(commits[0]).toHaveProperty('message');
    expect(commits[0]).toHaveProperty('time');
    expect(commits[0]).toHaveProperty('author');
  });

  it('includes the initial commit message', () => {
    const commits = getRecentCommits(tmpDir);
    expect(commits.some(c => c.message === 'initial commit')).toBe(true);
  });

  it('returns empty array for non-git directory', () => {
    expect(getRecentCommits('/tmp')).toEqual([]);
  });

  it('respects count parameter', () => {
    // Add a couple more commits
    fs.writeFileSync(path.join(tmpDir, 'second.txt'), 'second\n');
    execSync('git add -A && git commit --no-gpg-sign -m "second commit"', { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'third.txt'), 'third\n');
    execSync('git add -A && git commit --no-gpg-sign -m "third commit"', { cwd: tmpDir });

    const one = getRecentCommits(tmpDir, 1);
    expect(one.length).toBe(1);

    const all = getRecentCommits(tmpDir, 10);
    expect(all.length).toBe(3);
  });
});

// ============================================================
// getCommitDiff
// ============================================================

describe('getCommitDiff', () => {
  it('returns diff for a valid commit hash', () => {
    const commits = getRecentCommits(tmpDir, 1);
    const diff = getCommitDiff(tmpDir, commits[0].hash);
    expect(diff).toBeTruthy();
    expect(typeof diff).toBe('string');
  });

  it('returns null for invalid hash', () => {
    expect(getCommitDiff(tmpDir, 'invalidhash123')).toBeNull();
  });

  it('returns null for non-git directory', () => {
    expect(getCommitDiff('/tmp', 'abc123')).toBeNull();
  });
});
