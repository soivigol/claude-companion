import { describe, it, expect } from 'vitest';
import { escapeHtml, parseDiff, renderDiff } from '../src/core/diff.js';

// ============================================================
// escapeHtml
// ============================================================

describe('escapeHtml', () => {
  it('escapes &, <, >', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('returns the same string when no special chars', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('escapes multiple occurrences', () => {
    expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
  });
});

// ============================================================
// parseDiff
// ============================================================

const SIMPLE_DIFF = `diff --git a/file.js b/file.js
index abc1234..def5678 100644
--- a/file.js
+++ b/file.js
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 const d = 5;`;

const MULTI_FILE_DIFF = `diff --git a/src/app.js b/src/app.js
--- a/src/app.js
+++ b/src/app.js
@@ -1,2 +1,2 @@
-console.log("old");
+console.log("new");
diff --git a/readme.md b/readme.md
--- a/readme.md
+++ b/readme.md
@@ -1 +1,2 @@
 # Title
+Some text`;

describe('parseDiff', () => {
  it('parses a simple unified diff with additions and deletions', () => {
    const files = parseDiff(SIMPLE_DIFF);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('file.js');
    expect(files[0].additions).toBe(2);
    expect(files[0].deletions).toBe(1);
  });

  it('returns correct line types', () => {
    const files = parseDiff(SIMPLE_DIFF);
    const types = files[0].lines.map(l => l.type);
    expect(types).toContain('hunk-header');
    expect(types).toContain('addition');
    expect(types).toContain('deletion');
    expect(types).toContain('context');
  });

  it('handles multiple files in one diff', () => {
    const files = parseDiff(MULTI_FILE_DIFF);
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe('src/app.js');
    expect(files[1].path).toBe('readme.md');
  });

  it('handles hunk headers with correct line numbers', () => {
    const files = parseDiff(SIMPLE_DIFF);
    const hunk = files[0].lines.find(l => l.type === 'hunk-header');
    expect(hunk).toBeTruthy();
    expect(hunk.content).toContain('@@');

    // The first context line after the hunk should be line 1
    const firstContext = files[0].lines.find(l => l.type === 'context');
    expect(firstContext.num).toBe(1);
  });

  it('counts additions and deletions per file', () => {
    const files = parseDiff(MULTI_FILE_DIFF);
    expect(files[0].additions).toBe(1);
    expect(files[0].deletions).toBe(1);
    expect(files[1].additions).toBe(1);
    expect(files[1].deletions).toBe(0);
  });
});

// ============================================================
// renderDiff
// ============================================================

describe('renderDiff', () => {
  it('returns HTML with diff-section class', () => {
    const html = renderDiff(SIMPLE_DIFF);
    expect(html).toContain('class="diff-section"');
  });

  it('contains diff-file-header with file path', () => {
    const html = renderDiff(SIMPLE_DIFF);
    expect(html).toContain('class="diff-file-header"');
    expect(html).toContain('file.js');
  });

  it('contains addition and deletion line classes', () => {
    const html = renderDiff(SIMPLE_DIFF);
    expect(html).toContain('class="diff-line addition"');
    expect(html).toContain('class="diff-line deletion"');
  });

  it('escapes HTML in line content', () => {
    const diffWithHtml = `diff --git a/test.html b/test.html
--- a/test.html
+++ b/test.html
@@ -1 +1 @@
-<div>old</div>
+<div>new</div>`;
    const html = renderDiff(diffWithHtml);
    expect(html).toContain('&lt;div&gt;');
    expect(html).not.toContain('<div>old</div>');
  });

  it('renders directory part of the path separately', () => {
    const html = renderDiff(MULTI_FILE_DIFF);
    expect(html).toContain('class="dir"');
    expect(html).toContain('src/');
  });

  it('shows addition and deletion stats', () => {
    const html = renderDiff(SIMPLE_DIFF);
    expect(html).toContain('class="additions"');
    expect(html).toContain('+2');
    expect(html).toContain('class="deletions"');
    expect(html).toContain('-1');
  });
});
