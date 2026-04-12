import { api } from '../core/api.js';
import { state } from '../core/state.js';
import { openSftpModal } from './sftp-modal.js';

let doneTimeout = null;

export function initSftpSync() {
  document.getElementById('sftpSyncBtn').addEventListener('click', startSync);
  document.getElementById('sftpSettingsBtn').addEventListener('click', openSftpModal);
  document.getElementById('sftpOverwriteAll').addEventListener('click', () => setAllConflicts('overwrite'));
  document.getElementById('sftpSkipAll').addEventListener('click', () => setAllConflicts('skip'));
  document.getElementById('sftpConflictContinue').addEventListener('click', resolveConflicts);

  // Refresh pending count when file watcher reports changes
  api.onFileChange(() => updatePendingBadge());

  api.onSftpProgress((data) => {
    state.sftpSyncStatus = data.status;

    if (data.status === 'conflicts') {
      state.sftpConflicts = data.conflicts || [];
      showConflictDialog();
      return;
    }

    if (data.status === 'done') {
      renderSftpStatus('done', formatDoneMessage(data.results));
      updatePendingBadge();
      clearTimeout(doneTimeout);
      doneTimeout = setTimeout(() => {
        if (state.sftpSyncStatus === 'done') renderSftpStatus('idle');
      }, 5000);
      return;
    }

    if (data.status === 'error') {
      renderSftpStatus('error', data.message || 'Sync failed');
      return;
    }

    if (data.status === 'uploading' && data.index) {
      renderSftpStatus('syncing', `Uploading ${data.index}/${data.total}`);
    } else if (data.status === 'uploading') {
      renderSftpStatus('syncing', `${data.total} files...`);
    } else if (data.status === 'scanning') {
      renderSftpStatus('syncing', 'Scanning...');
    }
  });
}

async function startSync() {
  if (state.sftpSyncStatus === 'syncing' || state.sftpSyncStatus === 'uploading') return;

  const configs = state.sftpConfigs;
  if (!configs.length) {
    openSftpModal();
    return;
  }

  const passphrases = {};
  for (const config of configs) {
    if (config.passphrase === true) {
      const passphrase = prompt(`Enter passphrase for SSH key (${config.name || config.host}):`);
      if (passphrase === null) return;
      passphrases[config.id] = passphrase;
    }
  }

  renderSftpStatus('syncing', 'Starting...');
  await api.sftpStartSync({ passphrases });
}

export async function startFolderSync(config, { force = false, subPath = '' } = {}) {
  if (state.sftpSyncStatus === 'syncing' || state.sftpSyncStatus === 'uploading') return;

  const passphrases = {};
  if (config.passphrase === true) {
    const passphrase = prompt(`Enter passphrase for SSH key (${config.name || config.host}):`);
    if (passphrase === null) return;
    passphrases[config.id] = passphrase;
  }

  const label = subPath
    ? (force ? `Uploading all in "${subPath}"...` : `Syncing "${subPath}"...`)
    : (force ? 'Uploading all...' : 'Starting...');
  renderSftpStatus('syncing', label);
  await api.sftpSyncFolder({ configId: config.id, passphrases, force, subPath });
}

function renderSftpStatus(status, message) {
  const el = document.getElementById('sftpStatusBar');
  const syncBtn = document.getElementById('sftpSyncBtn');

  if (status === 'idle') {
    el.innerHTML = '';
    el.className = 'sftp-statusbar';
    syncBtn.disabled = false;
    return;
  }

  if (status === 'syncing') {
    el.innerHTML = `<svg class="sftp-statusbar-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>${escapeHtml(message || 'Syncing...')}`;
    el.className = 'sftp-statusbar sftp-status-syncing';
    syncBtn.disabled = true;
    return;
  }

  if (status === 'done') {
    el.textContent = message || 'Synced';
    el.className = 'sftp-statusbar sftp-status-done';
    syncBtn.disabled = false;
    return;
  }

  if (status === 'error') {
    el.textContent = message || 'Error';
    el.className = 'sftp-statusbar sftp-status-error';
    syncBtn.disabled = false;
  }
}

function formatDoneMessage(results) {
  if (!results || !results.length) return 'Synced';
  const total = results.reduce((sum, r) => sum + (r.uploaded || 0), 0);
  const errors = results.reduce((sum, r) => sum + (r.errors?.length || 0), 0);
  if (errors) return `${total} uploaded, ${errors} errors`;
  return `${total} uploaded`;
}

// ── Conflict Dialog ──

function showConflictDialog() {
  const list = document.getElementById('sftpConflictList');

  list.innerHTML = state.sftpConflicts.map((c) => `
    <div class="sftp-conflict-item" data-file="${escapeAttr(c.file)}">
      <span class="sftp-conflict-file">${escapeHtml(c.file)}</span>
      <span class="sftp-conflict-times">
        local: ${formatTime(c.localMtime)} / remote: ${formatTime(c.remoteMtime)}
      </span>
      <div class="sftp-conflict-btns">
        <button class="sftp-conflict-btn overwrite active" data-action="overwrite">Overwrite</button>
        <button class="sftp-conflict-btn skip" data-action="skip">Skip</button>
      </div>
    </div>
  `).join('');

  list.onclick = (e) => {
    const btn = e.target.closest('.sftp-conflict-btn');
    if (!btn) return;
    const item = btn.closest('.sftp-conflict-item');
    item.querySelectorAll('.sftp-conflict-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  };

  document.getElementById('sftpConflictOverlay').classList.add('open');
}

function setAllConflicts(action) {
  document.querySelectorAll('.sftp-conflict-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.action === action);
  });
}

async function resolveConflicts() {
  const resolutions = {};
  document.querySelectorAll('.sftp-conflict-item').forEach((item) => {
    const file = item.dataset.file;
    const activeBtn = item.querySelector('.sftp-conflict-btn.active');
    resolutions[file] = activeBtn?.dataset.action || 'skip';
  });

  document.getElementById('sftpConflictOverlay').classList.remove('open');
  await api.sftpResolveConflicts(resolutions);
}

function formatTime(ms) {
  if (!ms) return '--';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export async function updatePendingBadge() {
  if (!state.sftpConfigs.length) return;
  const count = await api.sftpGetPendingCount();
  const badge = document.getElementById('sftpPendingBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
