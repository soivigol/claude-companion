import { state } from '../core/state.js';

export function renderStatus() {
  if (!state.status) return;
  const count = state.status.files.length;
  document.getElementById('changesCount').textContent = count;
  document.getElementById('statusFiles').textContent = `${count} changed file${count !== 1 ? 's' : ''}`;
  document.getElementById('branchName').textContent = state.status.branch || 'no git';
}
