import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { renderDiff } from '../core/diff.js';
import { loadCommits } from './commits.js';

export function switchViewerTab(tab) {
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

export async function loadChanges() {
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
