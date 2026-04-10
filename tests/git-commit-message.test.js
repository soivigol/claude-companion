import { describe, it, expect } from 'vitest';
const { generateCommitMessage } = require('../lib/git-commit-message.cjs');

describe('generateCommitMessage', () => {
  it('returns fallback for empty file list', () => {
    expect(generateCommitMessage([], '')).toBe('chore: empty commit');
    expect(generateCommitMessage(null, '')).toBe('chore: empty commit');
  });

  it('detects dependency-only changes', () => {
    const files = [
      { status: 'M', path: 'package.json' },
      { status: 'M', path: 'package-lock.json' },
    ];
    expect(generateCommitMessage(files, '')).toBe('chore: update dependencies');
  });

  it('detects test-only changes', () => {
    const files = [
      { status: 'M', path: 'tests/foo.test.js' },
      { status: 'M', path: 'tests/bar.test.js' },
    ];
    const msg = generateCommitMessage(files, '');
    expect(msg).toMatch(/^test/);
  });

  it('detects docs-only changes', () => {
    const files = [
      { status: 'M', path: 'docs/README.md' },
    ];
    const msg = generateCommitMessage(files, '');
    expect(msg).toMatch(/^docs:/);
  });

  it('detects style-only changes', () => {
    const files = [
      { status: 'M', path: 'src/css/styles.css' },
    ];
    const msg = generateCommitMessage(files, '');
    expect(msg).toMatch(/^style:/);
  });

  it('generates feat prefix for all-new files', () => {
    const files = [
      { status: '??', path: 'src/components/new-thing.js' },
      { status: 'A', path: 'src/components/another.js' },
    ];
    const msg = generateCommitMessage(files, '');
    expect(msg).toMatch(/^feat/);
    expect(msg).toMatch(/add/);
  });

  it('generates chore prefix for all-deleted files', () => {
    const files = [
      { status: 'D', path: 'src/old.js' },
      { status: 'D', path: 'src/legacy.js' },
    ];
    const msg = generateCommitMessage(files, '');
    expect(msg).toMatch(/^chore:/);
    expect(msg).toMatch(/remove/);
  });

  it('names specific file for single change', () => {
    const files = [
      { status: 'M', path: 'lib/helpers.cjs' },
    ];
    const msg = generateCommitMessage(files, '');
    expect(msg).toContain('helpers');
  });

  it('handles mixed changes with scope', () => {
    const files = [
      { status: 'M', path: 'src/main.js' },
      { status: '??', path: 'src/new.js' },
      { status: 'D', path: 'src/old.js' },
    ];
    const msg = generateCommitMessage(files, '');
    expect(msg).toMatch(/src/);
    expect(msg).toMatch(/files/);
  });

  it('handles files in root directory (no scope)', () => {
    const files = [
      { status: 'M', path: 'index.html' },
    ];
    const msg = generateCommitMessage(files, '');
    expect(msg).toContain('index');
  });
});
