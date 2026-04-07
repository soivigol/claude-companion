import { state } from '../core/state.js';

export function renderStatus() {
  if (!state.status) return;
  const count = state.status.files.length;
  document.getElementById('changesCount').textContent = count;
  document.getElementById('statusFiles').textContent = `${count} changed file${count !== 1 ? 's' : ''}`;

  const branchEl = document.getElementById('branchName');
  const popover = document.getElementById('repoPopover');

  if (state.status.isMultiRepo && state.status.repos) {
    branchEl.textContent = `${state.status.repos.length} repos`;
    branchEl.title = '';
    popover.innerHTML = state.status.repos.map((r) => {
      const repoChanges = state.status.files.filter((f) => f.repo === r.repo).length;
      const badge = repoChanges > 0 ? `<span class="repo-popover-count">${repoChanges}</span>` : '';
      return `<div class="repo-popover-item">
        <span class="repo-popover-name">${r.repo}</span>
        <span class="repo-popover-branch">${r.branch}</span>
        ${badge}
      </div>`;
    }).join('');
  } else {
    branchEl.textContent = state.status.branch || 'no git';
    branchEl.title = '';
    popover.innerHTML = '';
  }
}

export function initRepoPopover() {
  const badge = document.getElementById('branchBadge');
  const popover = document.getElementById('repoPopover');

  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.status?.isMultiRepo) return;
    popover.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    popover.classList.remove('open');
  });

  popover.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}
