import './css/styles.css';
import { api } from './core/api.js';
import { state } from './core/state.js';
import { applyTheme, toggleTheme } from './components/themes.js';
import { handleSelectFolder } from './components/project.js';
import { renderTree, setFileSelectHandler } from './components/file-tree.js';
import { renderStatus } from './components/status.js';
import { loadChanges } from './components/viewer.js';
import { selectFile } from './components/file-viewer.js';
import { initUpdateBanner } from './components/update-banner.js';

// Wire file-tree click handler to file-viewer
setFileSelectHandler(selectFile);

// --- Platform class for CSS ---
if (document.body) {
  document.body.classList.add(`platform-${api.platform || 'unknown'}`);
}

// --- Allow file drops (dragover must preventDefault to enable dropping) ---
document.addEventListener('dragover', (e) => e.preventDefault());

// --- Init ---

function init() {
  // Apply saved theme
  applyTheme(state.theme);


  initUpdateBanner();

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
    if (state.viewerTab === 'file' && state.activeFile) {
      selectFile(state.activeFile, state.activeFile.split('.').pop());
    }
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
  });

  // Periodic refresh
  setInterval(async () => {
    if (!state.projectOpen) return;
    try {
      const [t, s] = await Promise.all([api.getFileTree(), api.getGitStatus()]);
      state.tree = t;
      state.status = s;
      state.changedPaths = new Set(s.files.map((f) => f.path));
      renderTree();
      renderStatus();
      document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
    } catch {}
  }, 8000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try { init(); } catch (e) { console.error('[CC] init error:', e); }
  });
} else {
  try { init(); } catch (e) { console.error('[CC] init error:', e); }
}
