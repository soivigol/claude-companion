import { state } from '../core/state.js';

let fileSelectHandler = null;

export function setFileSelectHandler(fn) {
  fileSelectHandler = fn;
}

export const FILE_ICONS = {
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

export function countFiles(nodes) {
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

    return `<div class="tree-item directory" style="padding-left:${12 + indent}px" data-dir="${node.path}" draggable="true">
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

export function initTreeDrag() {
  const container = document.getElementById('treeContainer');
  container.addEventListener('dragstart', (e) => {
    const fileItem = e.target.closest('[data-file]');
    if (fileItem) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', fileItem.dataset.file);
      return;
    }
    const dirItem = e.target.closest('[data-dir]');
    if (dirItem) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', dirItem.dataset.dir);
    }
  });
}

export function renderTree() {
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
    if (fileItem && fileSelectHandler) fileSelectHandler(fileItem.dataset.file, fileItem.dataset.ext);
  };

}
