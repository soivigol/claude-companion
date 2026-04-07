import { api } from '../core/api.js';
import { escapeHtml, renderDiff } from '../core/diff.js';

export async function loadCommits() {
  const panel = document.getElementById('commitsPanel');
  const commits = await api.getCommits();

  if (!commits.length) {
    panel.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128203;</div><h3>No commits yet</h3></div>`;
    return;
  }

  let html = '<div class="commit-list">';
  for (const c of commits) {
    const repoBadge = c.repo ? `<span class="commit-repo">${escapeHtml(c.repo)}</span>` : '';
    html += `<div class="commit-item" data-hash="${c.hash}">
      <span class="commit-hash">${c.hash}</span>
      ${repoBadge}
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
