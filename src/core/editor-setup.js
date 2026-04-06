import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';

const LANG_EXTENSIONS = {
  js: javascript, mjs: javascript, cjs: javascript,
  jsx: () => javascript({ jsx: true }),
  ts: () => javascript({ typescript: true }),
  tsx: () => javascript({ typescript: true, jsx: true }),
  html: html, htm: html, vue: html, svelte: html,
  css: css, scss: css, less: css,
  php: php,
  py: python,
  json: json,
  md: markdown, mdx: markdown,
  sql: sql,
  xml: xml, svg: xml,
  yaml: yaml, yml: yaml,
};

export function getLangExtension(fileExt) {
  const factory = LANG_EXTENSIONS[fileExt?.toLowerCase()];
  return factory ? factory() : [];
}

const lightTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)',
    borderRight: '1px solid var(--border-subtle)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'var(--bg-hover)' },
  '.cm-activeLine': { backgroundColor: 'var(--bg-hover)' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(218, 119, 86, 0.18)',
  },
});

export function createEditor(parent, content, fileExt, isDark) {
  const extensions = [
    basicSetup,
    EditorView.lineWrapping,
    getLangExtension(fileExt),
    isDark ? oneDark : lightTheme,
    EditorState.tabSize.of(4),
  ];

  const state = EditorState.create({ doc: content, extensions });
  return new EditorView({ state, parent });
}
