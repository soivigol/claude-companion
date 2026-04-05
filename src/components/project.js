import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { initTerminal, term } from './terminal.js';
import { initResize } from './resize.js';
import { renderTree, initTreeDrag } from './file-tree.js';
import { renderStatus } from './status.js';
import { switchViewerTab, loadChanges } from './viewer.js';

export async function openProject(folderPath) {
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

export async function handleSelectFolder() {
  const folder = await api.selectFolder();
  if (folder) openProject(folder);
}
