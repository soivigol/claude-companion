import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { initTerminal, term } from './terminal.js';
import { initResize } from './resize.js';
import { renderTree, initTreeDrag } from './file-tree.js';
import { renderStatus } from './status.js';
import { switchViewerTab, loadChanges } from './viewer.js';
import { refreshSftpControls } from './sftp-modal.js';

export async function openProject(folderPath) {
  try {
    const info = await api.openProject(folderPath);
    if (!info) return;

    state.projectOpen = true;
    state.projectRoot = info.fullPath;
    state.activeFile = null;
    state.expandedDirs.clear();

    document.getElementById('welcome').classList.add('hidden');
    const appEl = document.getElementById('app');
    appEl.classList.add('active');
    document.getElementById('projectName').textContent = info.root;
    document.getElementById('statusBarPath').textContent = info.fullPath;

    // Force the browser to compute the grid layout synchronously.
    // Reading offsetHeight after display:none→grid triggers a reflow,
    // guaranteeing child containers have real dimensions before we
    // initialize xterm. Without this, fitAddon.fit() may compute 0 rows.
    // eslint-disable-next-line no-unused-expressions
    appEl.offsetHeight;

    // Double rAF ensures at least one paint frame has completed.
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        try {
          initTerminal();
          initTreeDrag();
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

          // Refresh SFTP controls visibility
          refreshSftpControls();

          // Focus terminal
          term.focus();
        } catch (err) {
          console.error('[CC] post-open error:', err);
        }
      });
    });
  } catch (err) {
    console.error('[CC] openProject error:', err);
  }
}

export async function handleSelectFolder() {
  const folder = await api.selectFolder();
  if (folder) openProject(folder);
}

function renderRecentList(projects) {
  const container = document.getElementById('recentProjects');
  if (!projects.length) {
    container.innerHTML = '';
    return;
  }

  const folderSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';

  container.innerHTML =
    '<div class="recent-projects-title">Recent Projects</div>' +
    projects.map((p) =>
      `<div class="recent-item" data-path="${p.path.replace(/"/g, '&quot;')}">
        <div class="recent-item-icon">${folderSvg}</div>
        <div class="recent-item-info">
          <div class="recent-item-name">${p.name}</div>
          <div class="recent-item-path">${p.path}</div>
        </div>
        <button class="recent-item-remove" data-remove="${p.path.replace(/"/g, '&quot;')}" title="Remove from list">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`
    ).join('');

  container.onclick = async (e) => {
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      e.stopPropagation();
      await api.removeRecentProject(removeBtn.dataset.remove);
      const updated = await api.getRecentProjects();
      renderRecentList(updated);
      return;
    }
    const item = e.target.closest('.recent-item');
    if (item) openProject(item.dataset.path);
  };
}

export async function initRecentProjects() {
  const projects = await api.getRecentProjects();
  renderRecentList(projects);
}
