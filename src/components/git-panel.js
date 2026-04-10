import { api } from '../core/api.js';
import { state } from '../core/state.js';
import { renderTree } from './file-tree.js';
import { renderStatus } from './status.js';

let pendingFeedback = null;

const STATUS_DISPLAY = {
  M: { label: 'M', cls: 'modified' },
  MM: { label: 'M', cls: 'modified' },
  AM: { label: 'A', cls: 'added' },
  A: { label: 'A', cls: 'added' },
  D: { label: 'D', cls: 'deleted' },
  '??': { label: '?', cls: 'untracked' },
  UU: { label: 'U', cls: 'conflict' },
  R: { label: 'R', cls: 'renamed' },
};

function renderFileList(files) {
  if (!files.length) return '';
  return files.map((f) => {
    const statusCode = f.status.trim();
    const info = STATUS_DISPLAY[statusCode] || { label: statusCode, cls: 'modified' };
    // In multi-repo, strip the repo prefix from path display
    const displayPath = f.displayPath || f.path;
    return `<div class="git-file-item">
      <span class="git-file-status git-status-${info.cls}">${info.label}</span>
      <span class="git-file-path" title="${f.path}">${displayPath}</span>
    </div>`;
  }).join('');
}

async function refreshAfterGitAction() {
  try {
    const [treeData, statusData] = await Promise.all([
      api.getFileTree(),
      api.getGitStatus(),
    ]);
    state.tree = treeData;
    state.status = statusData;
    state.changedPaths = new Set(statusData.files.map((f) => f.path));
    renderTree();
    renderStatus();
    loadGitPanel();
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
  } catch {
    // silent
  }
}

function showFeedback(container, message, type) {
  const el = container.querySelector('.git-feedback');
  if (!el) return;
  el.textContent = message;
  el.className = `git-feedback git-feedback-${type}`;
}

function setButtonsDisabled(container, disabled) {
  container.querySelectorAll('.git-btn').forEach((btn) => { btn.disabled = disabled; });
}

// ── Clean state (with optional push) ────────────────

async function renderCleanState(panel) {
  const feedbackHtml = pendingFeedback
    ? `<div class="git-feedback git-feedback-${pendingFeedback.type}" style="padding:8px 16px">${pendingFeedback.message}</div>`
    : '';

  const isMultiRepo = state.status && state.status.isMultiRepo;
  let pushHtml = '';

  if (isMultiRepo && state.status.repos) {
    // Check each repo for unpushed commits
    const repoInfos = await Promise.all(
      state.status.repos.map(async (r) => {
        const info = await api.getRemoteInfoRepo(r.repo);
        return { ...r, ...info };
      })
    );
    const unpushed = repoInfos.filter((r) => r.hasRemote && r.ahead > 0);
    if (unpushed.length > 0) {
      pushHtml = '<div class="git-panel-content" style="padding-top:0">';
      for (const r of unpushed) {
        pushHtml += `<div class="git-repo-section" data-push-repo="${r.repo}">
          <div class="git-repo-header">
            <span class="git-repo-name">${r.repo}</span>
            <span class="file-count">${r.ahead} unpushed</span>
          </div>
          <div class="git-actions" style="flex-direction:row">
            <button class="git-btn git-btn-secondary" data-push-action="${r.repo}">Push</button>
          </div>
          <div class="git-feedback"></div>
        </div>`;
      }
      pushHtml += '</div>';
    }
  } else {
    const remoteInfo = await api.getRemoteInfo();
    if (remoteInfo.hasRemote && remoteInfo.ahead > 0) {
      pushHtml = `<div class="git-panel-content" style="padding-top:0">
        <div class="git-section-label">${remoteInfo.ahead} unpushed commit${remoteInfo.ahead > 1 ? 's' : ''}</div>
        <div class="git-actions">
          <button class="git-btn git-btn-secondary" data-push-action="single">Push</button>
        </div>
        <div class="git-feedback"></div>
      </div>`;
    }
  }

  panel.innerHTML = `<div class="git-empty-state">
    <div class="git-empty-icon">&check;</div>
    <h3>Working tree clean</h3>
    <p>No pending changes to commit.</p>
  </div>${pushHtml}${feedbackHtml}`;

  // Wire push buttons
  panel.querySelectorAll('[data-push-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const repoName = btn.dataset.pushAction;
      const section = btn.closest('.git-repo-section') || btn.closest('.git-panel-content');
      btn.disabled = true;
      showFeedback(section, 'Pushing...', 'info');

      let result;
      if (repoName === 'single') {
        result = await api.gitPush();
      } else {
        result = await api.gitPushRepo(repoName);
      }

      if (result.error) {
        showFeedback(section, `Push failed: ${result.error}`, 'error');
        btn.disabled = false;
      } else {
        pendingFeedback = { message: `Pushed ${repoName === 'single' ? '' : repoName} successfully`, type: 'success' };
        await refreshAfterGitAction();
      }
    });
  });

  if (pendingFeedback) {
    setTimeout(() => {
      pendingFeedback = null;
      const fb = panel.querySelector('.git-feedback:last-child');
      if (fb) fb.remove();
    }, 8000);
  }
}

// ── Main entry ──────────────────────────────────────

export async function loadGitPanel() {
  const panel = document.getElementById('gitView');
  if (!panel) return;

  if (!state.status || !state.status.isGit) {
    panel.innerHTML = `<div class="git-empty-state">
      <div class="git-empty-icon">&#128194;</div>
      <h3>Not a git repository</h3>
      <p>Open a project with git to use source control.</p>
    </div>`;
    return;
  }

  const files = state.status.files || [];

  if (files.length === 0) {
    await renderCleanState(panel);
    return;
  }

  const isMultiRepo = state.status.isMultiRepo;

  if (isMultiRepo) {
    await renderMultiRepo(panel, files);
  } else {
    await renderSingleRepo(panel, files);
  }
}

// ── Single repo layout ──────────────────────────────

async function renderSingleRepo(panel, files) {
  const existingMsg = panel.querySelector('.git-commit-input');
  const preservedMsg = existingMsg ? existingMsg.value : null;

  const remoteInfo = await api.getRemoteInfo();

  panel.innerHTML = `<div class="git-panel-content">
    <div class="git-section-label">
      Changed Files <span class="file-count">${files.length}</span>
    </div>
    <div class="git-files-list">${renderFileList(files)}</div>

    <div class="git-commit-form">
      <div class="git-section-label">
        Commit Message
        <button class="git-generate-btn" title="Auto-generate message">Generate</button>
      </div>
      <textarea class="git-commit-input" rows="3"
        placeholder="Enter commit message..."></textarea>
    </div>

    <div class="git-actions">
      <button class="git-btn git-btn-primary" data-action="commit">Commit All</button>
      ${remoteInfo.hasRemote ? '<button class="git-btn git-btn-secondary" data-action="commit-push">Commit &amp; Push</button>' : ''}
    </div>
    <div class="git-feedback"></div>
  </div>`;

  const textarea = panel.querySelector('.git-commit-input');

  if (preservedMsg !== null) {
    textarea.value = preservedMsg;
  } else {
    generateMsg(panel, textarea);
  }

  panel.querySelector('.git-generate-btn').addEventListener('click', () => generateMsg(panel, textarea));
  panel.querySelector('[data-action="commit"]').addEventListener('click', () => handleSingleCommit(panel, textarea, false));
  const pushBtn = panel.querySelector('[data-action="commit-push"]');
  if (pushBtn) pushBtn.addEventListener('click', () => handleSingleCommit(panel, textarea, true));
}

async function generateMsg(container, textarea, repoFilter) {
  try {
    showFeedback(container, 'Generating...', 'info');
    const msg = await api.generateCommitMessage(repoFilter);
    if (msg) textarea.value = msg;
    showFeedback(container, '', 'info');
  } catch {
    showFeedback(container, 'Could not generate message', 'error');
  }
}

async function handleSingleCommit(panel, textarea, andPush) {
  const message = textarea.value.trim();
  if (!message) {
    showFeedback(panel, 'Please enter a commit message', 'error');
    textarea.focus();
    return;
  }

  setButtonsDisabled(panel, true);
  showFeedback(panel, 'Staging files...', 'info');

  const stageResult = await api.gitStageAll();
  if (stageResult.error) {
    showFeedback(panel, `Stage failed: ${stageResult.error}`, 'error');
    setButtonsDisabled(panel, false);
    return;
  }

  showFeedback(panel, 'Committing...', 'info');
  const commitResult = await api.gitCommit(message);
  if (commitResult.error) {
    showFeedback(panel, `Commit failed: ${commitResult.error}`, 'error');
    setButtonsDisabled(panel, false);
    return;
  }

  if (andPush) {
    showFeedback(panel, 'Pushing...', 'info');
    const pushResult = await api.gitPush();
    if (pushResult.error) {
      pendingFeedback = { message: `Committed ${commitResult.hash || ''} but push failed: ${pushResult.error}`, type: 'error' };
    } else {
      pendingFeedback = { message: `Committed & pushed: ${commitResult.hash || 'ok'}`, type: 'success' };
    }
  } else {
    pendingFeedback = { message: `Committed: ${commitResult.hash || 'ok'}`, type: 'success' };
  }

  setButtonsDisabled(panel, false);
  await refreshAfterGitAction();
}

// ── Multi-repo layout ───────────────────────────────

async function renderMultiRepo(panel, files) {
  // Group files by repo
  const repoMap = new Map();
  for (const f of files) {
    const repo = f.repo || '(root)';
    if (!repoMap.has(repo)) repoMap.set(repo, []);
    // Strip repo prefix from display path
    const displayPath = f.path.startsWith(repo + '/') ? f.path.slice(repo.length + 1) : f.path;
    repoMap.get(repo).push({ ...f, displayPath });
  }

  let html = '<div class="git-panel-content">';

  for (const [repoName, repoFiles] of repoMap) {
    const repoId = repoName.replace(/[^a-zA-Z0-9-_]/g, '-');
    html += `<div class="git-repo-section" data-repo="${repoName}">
      <div class="git-repo-header">
        <span class="git-repo-name">${repoName}</span>
        <span class="file-count">${repoFiles.length}</span>
      </div>
      <div class="git-files-list">${renderFileList(repoFiles)}</div>

      <div class="git-commit-form">
        <div class="git-section-label">
          Commit Message
          <button class="git-generate-btn" data-repo-gen="${repoName}" title="Auto-generate message">Generate</button>
        </div>
        <textarea class="git-commit-input" data-repo-msg="${repoName}" rows="2"
          placeholder="Commit message for ${repoName}..."></textarea>
      </div>

      <div class="git-actions">
        <button class="git-btn git-btn-primary" data-repo-commit="${repoName}">Commit</button>
        <button class="git-btn git-btn-secondary" data-repo-push="${repoName}">Commit &amp; Push</button>
      </div>
      <div class="git-feedback"></div>
    </div>`;
  }

  html += '</div>';
  panel.innerHTML = html;

  // Wire events for each repo section
  for (const [repoName] of repoMap) {
    const section = panel.querySelector(`[data-repo="${repoName}"]`);
    const textarea = section.querySelector(`[data-repo-msg="${repoName}"]`);

    // Auto-generate message for each repo
    generateMsg(section, textarea, repoName);

    section.querySelector(`[data-repo-gen="${repoName}"]`).addEventListener('click', () => {
      generateMsg(section, textarea, repoName);
    });

    section.querySelector(`[data-repo-commit="${repoName}"]`).addEventListener('click', () => {
      handleRepoCommit(section, textarea, repoName, false);
    });

    section.querySelector(`[data-repo-push="${repoName}"]`).addEventListener('click', () => {
      handleRepoCommit(section, textarea, repoName, true);
    });
  }
}

async function handleRepoCommit(section, textarea, repoName, andPush) {
  const message = textarea.value.trim();
  if (!message) {
    showFeedback(section, 'Please enter a commit message', 'error');
    textarea.focus();
    return;
  }

  setButtonsDisabled(section, true);
  showFeedback(section, 'Staging...', 'info');

  const stageResult = await api.gitStageAllRepo(repoName);
  if (stageResult.error) {
    showFeedback(section, `Stage failed: ${stageResult.error}`, 'error');
    setButtonsDisabled(section, false);
    return;
  }

  showFeedback(section, 'Committing...', 'info');
  const commitResult = await api.gitCommitRepo(repoName, message);
  if (commitResult.error) {
    showFeedback(section, `Commit failed: ${commitResult.error}`, 'error');
    setButtonsDisabled(section, false);
    return;
  }

  if (andPush) {
    showFeedback(section, 'Pushing...', 'info');
    const pushResult = await api.gitPushRepo(repoName);
    if (pushResult.error) {
      showFeedback(section, `Committed but push failed: ${pushResult.error}`, 'error');
      setButtonsDisabled(section, false);
      pendingFeedback = { message: `${repoName}: committed but push failed`, type: 'error' };
      await refreshAfterGitAction();
      return;
    }
    showFeedback(section, `Committed & pushed: ${commitResult.hash || 'ok'}`, 'success');
  } else {
    showFeedback(section, `Committed: ${commitResult.hash || 'ok'}`, 'success');
  }

  setButtonsDisabled(section, false);
  pendingFeedback = { message: `${repoName}: ${andPush ? 'committed & pushed' : 'committed'} ${commitResult.hash || ''}`, type: 'success' };
  await refreshAfterGitAction();
}
