import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

// highlight.js — core + individual languages to keep bundle small
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import markdown from 'highlight.js/lib/languages/markdown';
import ini from 'highlight.js/lib/languages/ini';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('php', php);
hljs.registerLanguage('python', python);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('ini', ini);

const LANG_MAP = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  php: 'php', py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  css: 'css', scss: 'scss', less: 'css',
  html: 'xml', htm: 'xml', vue: 'xml', svelte: 'xml', svg: 'xml', xml: 'xml',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
  sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash',
  md: 'markdown', mdx: 'markdown',
};

const api = window.companion;

// --- Platform class for CSS ---
if (document.body) {
  document.body.classList.add(`platform-${api.platform || 'unknown'}`);
}

// --- Themes ---

const THEMES = {
  light: {
    xterm: {
      background: '#f6f8fa',
      foreground: '#1f2328',
      cursor: '#da7756',
      cursorAccent: '#f6f8fa',
      selectionBackground: 'rgba(218, 119, 86, 0.18)',
      black: '#1f2328',
      red: '#cf222e',
      green: '#1a7f37',
      yellow: '#9a6700',
      blue: '#0969da',
      magenta: '#8250df',
      cyan: '#0e8a6f',
      white: '#e6edf3',
      brightBlack: '#59636e',
      brightRed: '#f85149',
      brightGreen: '#3fb950',
      brightYellow: '#d29922',
      brightBlue: '#58a6ff',
      brightMagenta: '#bc8cff',
      brightCyan: '#76e3ea',
      brightWhite: '#ffffff',
    },
  },
  dark: {
    xterm: {
      background: '#0d1117',
      foreground: '#e6edf3',
      cursor: '#da7756',
      cursorAccent: '#0d1117',
      selectionBackground: 'rgba(218, 119, 86, 0.3)',
      black: '#0d1117',
      red: '#f85149',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#76e3ea',
      white: '#e6edf3',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#b3f0ff',
      brightWhite: '#f0f6fc',
    },
  },
};

// --- State ---

const state = {
  tree: null,
  status: null,
  activeFile: null,
  expandedDirs: new Set(),
  changedPaths: new Set(),
  viewerTab: 'changes',
  sidebarWidth: 260,
  viewerWidth: 400,
  projectOpen: false,
  theme: localStorage.getItem('cc-theme') || 'light',
};

// --- Terminal ---

const term = new Terminal({
  fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
  fontSize: 13,
  lineHeight: 1.3,
  theme: THEMES[state.theme].xterm,
  cursorBlink: true,
  cursorStyle: 'bar',
  scrollback: 10000,
  allowProposedApi: true,
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.loadAddon(new WebLinksAddon());

let terminalAttached = false;
let terminalOutputBound = false;

function initTerminal() {
  const container = document.getElementById('terminal');

  if (!terminalAttached) {
    // First time: open xterm in the DOM
    term.open(container);
    terminalAttached = true;
  }

  if (!terminalOutputBound) {
    terminalOutputBound = true;

    term.onData((data) => api.terminalInput(data));

    api.onTerminalOutput((data) => term.write(data));

    api.onTerminalExit((code) => {
      term.writeln(`\r\n\x1b[90m[Process exited with code ${code}. Press any key to restart.]\x1b[0m`);
      const disposable = term.onKey(() => {
        disposable.dispose();
        api.terminalRestart();
        term.clear();
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        const dims = fitAddon.proposeDimensions();
        if (dims) api.terminalResize({ cols: dims.cols, rows: dims.rows });
      } catch {}
    });
    resizeObserver.observe(container);

    // Drag-and-drop: receive file path from tree
    const terminalPane = container.closest('.terminal-pane');

    terminalPane.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      terminalPane.classList.add('drop-active');
    });

    terminalPane.addEventListener('dragleave', (e) => {
      if (!terminalPane.contains(e.relatedTarget)) {
        terminalPane.classList.remove('drop-active');
      }
    });

    terminalPane.addEventListener('drop', (e) => {
      e.preventDefault();
      terminalPane.classList.remove('drop-active');
      const filePath = e.dataTransfer.getData('text/plain');
      if (filePath) {
        api.terminalInput(filePath);
        term.focus();
      }
    });
  }

  // Fit with multiple retries to handle layout settling
  fitTerminal();
  setTimeout(fitTerminal, 100);
  setTimeout(fitTerminal, 300);
  setTimeout(fitTerminal, 600);
}

function fitTerminal() {
  try {
    fitAddon.fit();
    const dims = fitAddon.proposeDimensions();
    if (dims) api.terminalResize({ cols: dims.cols, rows: dims.rows });
  } catch {}
}

// --- Theme toggle ---

function applyTheme(themeName) {
  state.theme = themeName;
  localStorage.setItem('cc-theme', themeName);
  document.documentElement.setAttribute('data-theme', themeName);
  term.options.theme = THEMES[themeName].xterm;

  // Update theme icon
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.innerHTML = themeName === 'light'
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  }
}

function toggleTheme() {
  applyTheme(state.theme === 'light' ? 'dark' : 'light');
}

// --- File tree ---

const FILE_ICONS = {
  js: '#f0db4f', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb',
  php: '#777bb4', py: '#3776ab', rb: '#cc342d', go: '#00add8',
  css: '#1572b6', scss: '#cf649a', less: '#1d365d',
  html: '#e34f26', htm: '#e34f26', vue: '#41b883', svelte: '#ff3e00',
  json: '#6d8086', yaml: '#cb171e', yml: '#cb171e', toml: '#9c4221',
  md: '#083fa1', mdx: '#083fa1', txt: '#8b949e',
  sql: '#e38c00', sh: '#89e051', bash: '#89e051', zsh: '#89e051',
  svg: '#ffb13b', png: '#a463f2', jpg: '#a463f2', gif: '#a463f2',
  lock: '#8b949e', env: '#ecd53f',
};

function fileIconDot(ext) {
  const color = FILE_ICONS[ext?.toLowerCase()] || '#8b949e';
  return `<span class="file-dot" style="background:${color}"></span>`;
}

function getChangeStatus(filePath) {
  if (!state.status) return null;
  const f = state.status.files.find((x) => x.path === filePath);
  return f ? f.statusLabel : null;
}

function countFiles(nodes) {
  let n = 0;
  for (const node of nodes) {
    if (node.type === 'file') n++;
    else if (node.children) n += countFiles(node.children);
  }
  return n;
}

function renderTreeNode(node, depth = 0) {
  const indent = depth * 16;

  if (node.type === 'directory') {
    const isOpen = state.expandedDirs.has(node.path);
    const hasChanges = node.children?.some((c) =>
      c.type === 'file'
        ? state.changedPaths.has(c.path)
        : c.children?.some((gc) => state.changedPaths.has(gc?.path))
    );

    return `<div class="tree-item directory" style="padding-left:${12 + indent}px" data-dir="${node.path}">
      <svg class="chevron ${isOpen ? 'open' : ''}" viewBox="0 0 16 16" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg>
      <span class="name">${node.name}</span>
      ${hasChanges ? '<span class="status-dot modified"></span>' : ''}
    </div>
    <div class="tree-children ${isOpen ? 'open' : ''}">${
      node.children ? node.children.map((c) => renderTreeNode(c, depth + 1)).join('') : ''
    }</div>`;
  }

  const changeStatus = getChangeStatus(node.path);
  const isActive = state.activeFile === node.path ? ' active' : '';

  return `<div class="tree-item file${isActive}" style="padding-left:${12 + indent + 18}px" data-file="${node.path}" data-ext="${node.ext || ''}" draggable="true">
    ${fileIconDot(node.ext)}
    <span class="name">${node.name}</span>
    ${changeStatus ? `<span class="status-dot ${changeStatus}"></span>` : ''}
  </div>`;
}

function renderTree() {
  if (!state.tree) return;
  const container = document.getElementById('treeContainer');
  container.innerHTML = state.tree.tree.map((n) => renderTreeNode(n)).join('');
  document.getElementById('fileCount').textContent = countFiles(state.tree.tree);

  container.onclick = (e) => {
    const dirItem = e.target.closest('[data-dir]');
    if (dirItem) {
      const p = dirItem.dataset.dir;
      state.expandedDirs.has(p) ? state.expandedDirs.delete(p) : state.expandedDirs.add(p);
      renderTree();
      return;
    }
    const fileItem = e.target.closest('[data-file]');
    if (fileItem) selectFile(fileItem.dataset.file, fileItem.dataset.ext);
  };

  // Drag-and-drop: drag file path from tree to terminal
  container.addEventListener('dragstart', (e) => {
    const fileItem = e.target.closest('[data-file]');
    if (fileItem) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', fileItem.dataset.file);
    }
  });
}

// --- Status ---

function renderStatus() {
  if (!state.status) return;
  const count = state.status.files.length;
  document.getElementById('changesCount').textContent = count;
  document.getElementById('statusFiles').textContent = `${count} changed file${count !== 1 ? 's' : ''}`;
  document.getElementById('branchName').textContent = state.status.branch || 'no git';
}

// --- Viewer tabs ---

function switchViewerTab(tab) {
  state.viewerTab = tab;
  document.querySelectorAll('.viewer-tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  document.getElementById('changesPanel').style.display = tab === 'changes' ? '' : 'none';
  document.getElementById('commitsPanel').style.display = tab === 'commits' ? '' : 'none';
  document.getElementById('filePanel').style.display = tab === 'file' ? '' : 'none';

  if (tab === 'changes') loadChanges();
  if (tab === 'commits') loadCommits();
}

// --- Changes / Diff ---

async function loadChanges() {
  const panel = document.getElementById('changesPanel');

  if (!state.status || state.status.files.length === 0) {
    panel.innerHTML = `<div class="empty-state">
      <div class="empty-icon">&check;</div>
      <h3>Working tree clean</h3>
      <p>Changes made by Claude will appear here in real time.</p>
    </div>`;
    return;
  }

  panel.innerHTML = '<div class="loading">Loading diffs...</div>';
  const diff = await api.getDiff();
  if (!diff) {
    panel.innerHTML = `<div class="empty-state">
      <div class="empty-icon">&#128194;</div>
      <h3>No diffs available</h3>
      <p>Files might be untracked.</p>
    </div>`;
    return;
  }
  panel.innerHTML = renderDiff(diff);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseDiff(raw) {
  const files = [];
  const chunks = raw.split(/^diff --git /m).filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const pathMatch = chunk.match(/\+\+\+ b\/(.+)/);
    const filePath = pathMatch ? pathMatch[1] : lines[0]?.split(' ')[0]?.replace('a/', '') || 'unknown';

    let additions = 0, deletions = 0, lineNum = 0;
    const parsedLines = [];

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const m = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
        lineNum = m ? parseInt(m[1]) - 1 : 0;
        parsedLines.push({ type: 'hunk-header', content: line, num: '' });
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        lineNum++;
        additions++;
        parsedLines.push({ type: 'addition', content: line.substring(1), num: lineNum });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
        parsedLines.push({ type: 'deletion', content: line.substring(1), num: '' });
      } else if (
        !line.startsWith('\\') && !line.startsWith('diff') && !line.startsWith('index') &&
        !line.startsWith('---') && !line.startsWith('+++') && !line.startsWith('new file') &&
        !line.startsWith('old mode') && !line.startsWith('new mode') &&
        !line.startsWith('deleted file') && !line.startsWith('similarity') &&
        !line.startsWith('rename') && !line.startsWith('Binary')
      ) {
        lineNum++;
        parsedLines.push({ type: 'context', content: line.substring(1) || '', num: lineNum });
      }
    }

    files.push({ path: filePath, additions, deletions, lines: parsedLines });
  }
  return files;
}

function renderDiff(rawDiff) {
  const files = parseDiff(rawDiff);
  return files.map((file) => {
    const parts = file.path.split('/');
    const name = parts.pop();
    const dir = parts.length ? `<span class="dir">${parts.join('/')}/</span>` : '';

    const linesHtml = file.lines.map((l) =>
      `<div class="diff-line ${l.type}"><span class="line-num">${l.num}</span><span class="line-content">${escapeHtml(l.content)}</span></div>`
    ).join('');

    return `<div class="diff-section">
      <div class="diff-file-header">
        <span class="diff-file-path">${dir}${name}</span>
        <div class="diff-file-stats">
          ${file.additions ? `<span class="additions">+${file.additions}</span>` : ''}
          ${file.deletions ? `<span class="deletions">-${file.deletions}</span>` : ''}
        </div>
      </div>
      <div class="diff-content">${linesHtml}</div>
    </div>`;
  }).join('');
}

// --- Commits ---

async function loadCommits() {
  const panel = document.getElementById('commitsPanel');
  const commits = await api.getCommits();

  if (!commits.length) {
    panel.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128203;</div><h3>No commits yet</h3></div>`;
    return;
  }

  let html = '<div class="commit-list">';
  for (const c of commits) {
    html += `<div class="commit-item" data-hash="${c.hash}">
      <span class="commit-hash">${c.hash}</span>
      <span class="commit-message">${escapeHtml(c.message)}</span>
      <span class="commit-time">${c.time}</span>
    </div>`;
  }
  html += '</div><div id="commitDiffView"></div>';
  panel.innerHTML = html;

  panel.querySelectorAll('.commit-item').forEach((el) => {
    el.onclick = async () => {
      panel.querySelectorAll('.commit-item').forEach((i) => i.classList.remove('active'));
      el.classList.add('active');
      const view = document.getElementById('commitDiffView');
      view.innerHTML = '<div class="loading">Loading...</div>';
      const diff = await api.getCommitDiff(el.dataset.hash);
      if (diff) {
        const start = diff.indexOf('diff --git');
        view.innerHTML = renderDiff(start >= 0 ? diff.substring(start) : diff);
      }
    };
  });
}

// --- File viewer ---

async function selectFile(filePath, ext) {
  state.activeFile = filePath;
  renderTree();

  const fileTab = document.getElementById('fileTab');
  fileTab.style.display = '';
  fileTab.querySelector('.tab-name').textContent = filePath.split('/').pop();

  if (state.changedPaths.has(filePath)) {
    const diff = await api.getDiff(filePath);
    if (diff) {
      document.getElementById('filePanel').innerHTML = renderDiff(diff);
      switchViewerTab('file');
      return;
    }
  }

  const data = await api.getFileContent(filePath);
  if (data.content !== undefined) {
    const fileExt = filePath.split('.').pop();
    const lang = LANG_MAP[fileExt];
    const lineCount = data.content.split('\n').length;

    // Syntax highlight (skip for very large files to avoid UI freeze)
    let highlightedLines;
    if (lang && lineCount <= 5000) {
      try {
        const result = hljs.highlight(data.content, { language: lang });
        highlightedLines = result.value.split('\n');
      } catch {
        highlightedLines = null;
      }
    }

    let html = `<div class="file-header"><span class="file-path">${escapeHtml(filePath)}</span></div>`;
    html += '<div class="file-viewer">';
    if (highlightedLines) {
      for (let i = 0; i < highlightedLines.length; i++) {
        html += `<div class="file-line"><span class="line-num">${i + 1}</span><span class="line-text hljs">${highlightedLines[i]}</span></div>`;
      }
    } else {
      const lines = data.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        html += `<div class="file-line"><span class="line-num">${i + 1}</span><span class="line-text">${escapeHtml(lines[i])}</span></div>`;
      }
    }
    html += '</div>';
    document.getElementById('filePanel').innerHTML = html;
    switchViewerTab('file');
  }
}

// --- Resizable panes ---

function initResize() {
  const appEl = document.getElementById('app');
  let dragging = null;

  const onMouseDown = (handle) => (e) => {
    dragging = handle;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.getElementById('terminal').style.pointerEvents = 'none';
    e.preventDefault();
  };

  document.getElementById('leftHandle').addEventListener('mousedown', onMouseDown('left'));
  document.getElementById('rightHandle').addEventListener('mousedown', onMouseDown('right'));

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    if (dragging === 'left') {
      state.sidebarWidth = Math.max(180, Math.min(500, e.clientX));
    } else {
      state.viewerWidth = Math.max(250, Math.min(700, window.innerWidth - e.clientX));
    }
    appEl.style.gridTemplateColumns =
      `${state.sidebarWidth}px 5px 1fr 5px ${state.viewerWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.getElementById('terminal').style.pointerEvents = '';
    fitTerminal();
  });
}

// --- Open project ---

async function openProject(folderPath) {
  try {
    const info = await api.openProject(folderPath);
    if (!info) return;

    state.projectOpen = true;
    state.activeFile = null;
    state.expandedDirs.clear();

    document.getElementById('welcome').classList.add('hidden');
    document.getElementById('app').classList.add('active');
    document.getElementById('projectName').textContent = info.root;
    document.getElementById('statusBarPath').textContent = info.fullPath;

    // Give the grid layout time to render before initializing xterm
    setTimeout(async () => {
      try {
        initTerminal();
        initResize();

        const [treeData, statusData] = await Promise.all([
          api.getFileTree(),
          api.getGitStatus(),
        ]);

        state.tree = treeData;
        state.status = statusData;
        state.changedPaths = new Set(statusData.files.map((f) => f.path));

        renderTree();
        renderStatus();
        loadChanges();

        document.querySelectorAll('.viewer-tab').forEach((t) => {
          t.onclick = () => switchViewerTab(t.dataset.tab);
        });

        // Focus terminal
        term.focus();
      } catch (err) {
        console.error('[CC] post-open error:', err);
      }
    }, 150);
  } catch (err) {
    console.error('[CC] openProject error:', err);
  }
}

async function handleSelectFolder() {
  const folder = await api.selectFolder();
  if (folder) openProject(folder);
}

// --- Init ---

function init() {
  // Apply saved theme
  applyTheme(state.theme);

  // Welcome screen
  document.getElementById('selectFolderBtn').addEventListener('click', handleSelectFolder);

  // Header buttons
  document.getElementById('changeFolderBtn').addEventListener('click', handleSelectFolder);
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

  // Live updates from file watcher
  api.onFileChange((data) => {
    if (!state.projectOpen) return;
    state.tree = data.tree;
    state.status = data.status;
    state.changedPaths = new Set(data.status.files.map((f) => f.path));
    renderTree();
    renderStatus();
    if (state.viewerTab === 'changes') loadChanges();
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
  });

  // Periodic refresh
  setInterval(async () => {
    if (!state.projectOpen) return;
    const [t, s] = await Promise.all([api.getFileTree(), api.getGitStatus()]);
    state.tree = t;
    state.status = s;
    state.changedPaths = new Set(s.files.map((f) => f.path));
    renderTree();
    renderStatus();
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
  }, 8000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try { init(); } catch (e) { console.error('[CC] init error:', e); }
  });
} else {
  try { init(); } catch (e) { console.error('[CC] init error:', e); }
}
