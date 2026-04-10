import { state } from '../core/state.js';
import { loadGitPanel } from './git-panel.js';

export function initSidebarTabs() {
  const tabs = document.querySelectorAll('.sidebar-tab');
  const views = {
    explorer: document.getElementById('explorerView'),
    git: document.getElementById('gitView'),
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.sidebar;
      if (target === state.sidebarTab) return;

      state.sidebarTab = target;

      tabs.forEach((t) => t.classList.toggle('active', t.dataset.sidebar === target));
      Object.entries(views).forEach(([key, el]) => {
        if (el) el.style.display = key === target ? '' : 'none';
      });

      if (target === 'git') loadGitPanel();
    });
  });
}
