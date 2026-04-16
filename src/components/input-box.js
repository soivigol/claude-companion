import { EditorView, keymap, placeholder, ViewPlugin, Decoration, MatchDecorator } from '@codemirror/view';
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { autocompletion, completionKeymap, acceptCompletion } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { api } from '../core/api.js';
import { state } from '../core/state.js';
import { term, fitTerminal } from './terminal.js';

// --- Theme compartment for live switching ---
const themeCompartment = new Compartment();

const inputLightTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--bg-panel)', color: 'var(--text-primary)' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(218, 119, 86, 0.18)',
  },
});

// --- Syntax highlighting via MatchDecorator ---

const slashDeco = Decoration.mark({ class: 'cm-claude-slash' });
const mentionDeco = Decoration.mark({ class: 'cm-claude-mention' });
const pathDeco = Decoration.mark({ class: 'cm-claude-filepath' });

const createHighlightPlugin = (regexp, deco) => {
  const matcher = new MatchDecorator({
    regexp,
    decoration: () => deco,
  });
  return ViewPlugin.define(
    (view) => ({ decorations: matcher.createDeco(view), update(u) { this.decorations = matcher.updateDeco(u, this.decorations); } }),
    { decorations: (v) => v.decorations },
  );
};

const slashPlugin = createHighlightPlugin(/(?:^|\s)(\/[a-zA-Z][\w-]*)/g, slashDeco);
const mentionPlugin = createHighlightPlugin(/(?:^|\s)(@[\w][\w./-]*)/g, mentionDeco);
const pathPlugin = createHighlightPlugin(/(?:^|\s)((?:\.\.?\/)?[\w.-]+(?:\/[\w.-]+)+)/g, pathDeco);

// --- Autocomplete: / commands + skills ---

const FALLBACK_COMMANDS = [
  { label: '/bug', detail: 'Report a bug with Claude Code' },
  { label: '/clear', detail: 'Clear conversation history' },
  { label: '/compact', detail: 'Compact conversation to save context' },
  { label: '/config', detail: 'View or update configuration' },
  { label: '/cost', detail: 'Show token usage and cost' },
  { label: '/doctor', detail: 'Check Claude Code health' },
  { label: '/help', detail: 'Show available commands' },
  { label: '/init', detail: 'Initialize project with CLAUDE.md' },
  { label: '/login', detail: 'Switch account or auth method' },
  { label: '/logout', detail: 'Sign out from current account' },
  { label: '/memory', detail: 'Edit CLAUDE.md memory files' },
  { label: '/model', detail: 'Switch AI model' },
  { label: '/permissions', detail: 'View or update permissions' },
  { label: '/pr-comments', detail: 'View PR comments' },
  { label: '/review', detail: 'Review code changes' },
  { label: '/status', detail: 'Show session status' },
  { label: '/terminal-setup', detail: 'Install terminal integration' },
  { label: '/vim', detail: 'Toggle vim mode' },
];

let claudeCommands = null;

const loadClaudeCommands = async () => {
  if (claudeCommands) return claudeCommands;
  try {
    const skills = await api.getClaudeCommands();
    // Merge: built-in commands + scanned skills, dedup by label
    const seen = new Set();
    const merged = [];
    for (const s of skills) { seen.add(s.label); merged.push(s); }
    for (const c of FALLBACK_COMMANDS) { if (!seen.has(c.label)) merged.push(c); }
    claudeCommands = merged;
  } catch {
    claudeCommands = FALLBACK_COMMANDS;
  }
  return claudeCommands;
};

const slashCompletion = (context) => {
  const word = context.matchBefore(/\/[\w-]*/);
  if (!word) return null;
  if (word.from > 0) {
    const charBefore = context.state.doc.sliceString(word.from - 1, word.from);
    if (charBefore && !/\s/.test(charBefore)) return null;
  }
  const commands = claudeCommands || FALLBACK_COMMANDS;
  return {
    from: word.from,
    options: commands.map((cmd) => ({
      label: cmd.label,
      detail: cmd.detail,
      type: cmd.type === 'skill' ? 'method' : 'keyword',
      boost: cmd.type === 'skill' ? 1 : 0,
    })),
  };
};

// --- Autocomplete: @ file/folder mentions ---

const flattenTree = (nodes, prefix = '') => {
  const results = [];
  if (!nodes) return results;
  for (const node of nodes) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
    const isDir = node.type === 'directory';
    results.push({
      label: fullPath,
      detail: isDir ? 'folder' : (node.ext || 'file'),
      type: isDir ? 'method' : 'text',
      boost: isDir ? 1 : 0,
    });
    if (isDir && node.children) {
      results.push(...flattenTree(node.children, fullPath));
    }
  }
  return results;
};

let cachedTreeOptions = null;
let cachedTreeRef = null;

const getTreeOptions = () => {
  const tree = state.tree?.tree;
  if (!tree) return [];
  if (tree === cachedTreeRef) return cachedTreeOptions;
  cachedTreeRef = tree;
  cachedTreeOptions = flattenTree(tree);
  return cachedTreeOptions;
};

const mentionCompletion = (context) => {
  const word = context.matchBefore(/@[\w./-]*/);
  if (!word) return null;
  if (word.from > 0) {
    const charBefore = context.state.doc.sliceString(word.from - 1, word.from);
    if (charBefore && !/\s/.test(charBefore)) return null;
  }
  const options = getTreeOptions();
  if (!options.length) return null;
  // Replace from after the @ so the @ stays and the path is inserted
  return {
    from: word.from + 1,
    options,
    validFor: /^[\w./-]*$/,
  };
};

// --- Editor instance ---
let editor = null;

// --- Submit logic ---

const stripControl = (s) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

function submitInput() {
  if (!editor) return;
  const text = stripControl(editor.state.doc.toString()).trimEnd();
  if (!text) return;

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    api.terminalInput(lines[i]);
    if (i < lines.length - 1) api.terminalInput('\x1b\r');
  }
  api.terminalInput('\r');

  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length } });
}

// --- Keymap ---

const inputBoxKeymap = keymap.of([
  {
    key: 'Shift-Enter',
    run: (view) => { view.dispatch(view.state.replaceSelection('\n')); return true; },
  },
  {
    key: 'Alt-Enter',
    run: (view) => { view.dispatch(view.state.replaceSelection('\n')); return true; },
  },
  {
    key: 'Escape',
    run: () => { term.focus(); return true; },
  },
]);

// Enter: accept completion if open, otherwise submit
const enterKeymap = Prec.highest(keymap.of([
  {
    key: 'Enter',
    run: (view) => {
      if (acceptCompletion(view)) return true;
      submitInput();
      return true;
    },
  },
]));

// --- Init / Toggle / Theme ---

export function initInputBox() {
  const container = document.getElementById('inputBoxEditor');
  const box = document.getElementById('inputBox');
  const toggleBtn = document.getElementById('inputBoxToggle');
  const sendBtn = document.getElementById('inputBoxSend');
  if (!container) return;

  loadClaudeCommands();

  const isDark = state.theme === 'dark';

  const extensions = [
    history(),
    enterKeymap,
    inputBoxKeymap,
    keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
    EditorView.lineWrapping,
    placeholder('Type a message for Claude Code...'),
    themeCompartment.of(isDark ? oneDark : inputLightTheme),
    autocompletion({
      override: [slashCompletion, mentionCompletion],
      activateOnTyping: true,
      icons: false,
    }),
    slashPlugin,
    mentionPlugin,
    pathPlugin,
    EditorView.updateListener.of((update) => {
      if (update.geometryChanged) {
        requestAnimationFrame(() => fitTerminal());
      }
    }),
  ];

  editor = new EditorView({
    state: EditorState.create({ doc: '', extensions }),
    parent: container,
  });

  if (!state.inputBoxVisible) {
    box.classList.add('hidden');
    toggleBtn.classList.remove('active');
  }

  toggleBtn.addEventListener('click', toggleInputBox);
  sendBtn.addEventListener('click', submitInput);

  // Drag-and-drop: intercept drops on the input box to insert path text into the editor
  box.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();

    let pathText = '';
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const paths = [];
      for (let i = 0; i < files.length; i++) {
        const filePath = api.getPathForFile(files[i]);
        if (filePath) paths.push(filePath);
      }
      pathText = paths.join(' ');
    } else {
      pathText = e.dataTransfer.getData('text/plain') || '';
    }

    if (pathText && editor) {
      const pos = editor.state.selection.main.head;
      const endPos = pos + pathText.length;
      editor.dispatch({
        changes: { from: pos, insert: pathText },
        selection: { anchor: endPos },
      });
      editor.focus();
    }
  }, { capture: false });

  box.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, { capture: false });
}

export function toggleInputBox() {
  const box = document.getElementById('inputBox');
  if (!box) return;

  box.classList.toggle('hidden');
  state.inputBoxVisible = !box.classList.contains('hidden');
  localStorage.setItem('cc-input-box', state.inputBoxVisible ? '1' : '0');
  document.getElementById('inputBoxToggle').classList.toggle('active', state.inputBoxVisible);

  requestAnimationFrame(() => fitTerminal());

  if (state.inputBoxVisible && editor) editor.focus();
}

export function updateInputBoxTheme(isDark) {
  if (!editor) return;
  editor.dispatch({
    effects: themeCompartment.reconfigure(isDark ? oneDark : inputLightTheme),
  });
}

export function focusInputBox() {
  if (editor && state.inputBoxVisible) editor.focus();
}
