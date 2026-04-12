import { api } from '../core/api.js';
import { state } from '../core/state.js';

let selectedConfigId = null;
let projectConfig = null;

const defaultConfig = {
  name: '',
  context: '.',
  host: '',
  port: 22,
  username: '',
  remotePath: '/',
  password: null,
  privateKeyPath: null,
  passphrase: null,
  agent: null,
  ignore: ['node_modules/', '.git/', '.DS_Store', 'dist/', '.env'],
  concurrency: 4,
  enabled: true,
};

export function initSftpModal() {
  const modal = document.getElementById('sftpModal');
  const backdrop = document.getElementById('sftpModalBackdrop');
  const addBtn = document.getElementById('sftpAddBtn');

  backdrop.addEventListener('click', closeSftpModal);
  addBtn.addEventListener('click', () => renderConfigForm(null));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeSftpModal();
    }
  });
}

export async function openSftpModal() {
  projectConfig = await api.sftpGetProjectConfig();
  selectedConfigId = null;
  renderServerList();
  renderFormPlaceholder();
  document.getElementById('sftpModal').classList.add('open');
}

export function closeSftpModal() {
  document.getElementById('sftpModal').classList.remove('open');
}

function getAllConfigs() {
  if (!projectConfig) return [];
  const configs = [];
  if (projectConfig.rootConfig) configs.push({ ...projectConfig.rootConfig, _isRoot: true });
  for (const c of projectConfig.contextConfigs || []) {
    configs.push({ ...c, _isRoot: false });
  }
  return configs;
}

function renderServerList() {
  const list = document.getElementById('sftpServerList');
  const configs = getAllConfigs();

  if (!configs.length) {
    list.innerHTML = '<div class="sftp-server-empty">No servers configured</div>';
    return;
  }

  list.innerHTML = configs.map((c) => `
    <div class="sftp-server-item ${c.id === selectedConfigId ? 'active' : ''} ${!c.enabled ? 'disabled' : ''}" data-id="${c.id}">
      <span class="sftp-server-name">${escapeHtml(c.name || c.host || 'Unnamed')}</span>
      <span class="sftp-server-meta">${c._isRoot ? 'Root' : c.context}</span>
    </div>
  `).join('');

  list.onclick = (e) => {
    const item = e.target.closest('.sftp-server-item');
    if (!item) return;
    selectedConfigId = item.dataset.id;
    const config = configs.find((c) => c.id === selectedConfigId);
    if (config) renderConfigForm(config);
    renderServerList();
  };
}

function renderFormPlaceholder() {
  document.getElementById('sftpModalForm').innerHTML =
    '<div class="sftp-form-placeholder">Select or add a server configuration</div>';
}

function renderConfigForm(config) {
  const isNew = !config;
  const c = config || { ...defaultConfig };
  const isRoot = config ? config._isRoot : true;
  selectedConfigId = c.id || null;

  const protocol = c.protocol || 'sftp';
  const authType = c.agent ? 'agent' : c.privateKeyPath ? 'key' : 'password';
  const isFtp = protocol === 'ftp';

  const form = document.getElementById('sftpModalForm');
  form.innerHTML = `
    <div class="sftp-form-header">
      <h3>${isNew ? 'Add Server' : 'Edit Server'}</h3>
      <button class="sftp-modal-close" id="sftpFormClose">&times;</button>
    </div>

    <div class="sftp-form-scroll">
      <div class="sftp-field-group">
        <label class="sftp-field-label">Name</label>
        <input class="sftp-field-input" id="sftpName" value="${escapeAttr(c.name)}" placeholder="My Server">
      </div>

      <div class="sftp-field-group">
        <label class="sftp-field-label">Protocol</label>
        <div class="sftp-protocol-options">
          <button class="sftp-protocol-option ${protocol === 'sftp' ? 'active' : ''}" data-protocol="sftp">SFTP</button>
          <button class="sftp-protocol-option ${protocol === 'ftp' ? 'active' : ''}" data-protocol="ftp">FTP</button>
        </div>
      </div>

      <div class="sftp-field-row">
        <div class="sftp-field-group sftp-field-flex">
          <label class="sftp-field-label">Host</label>
          <input class="sftp-field-input" id="sftpHost" value="${escapeAttr(c.host)}" placeholder="example.com">
        </div>
        <div class="sftp-field-group sftp-field-small">
          <label class="sftp-field-label">Port</label>
          <input class="sftp-field-input" id="sftpPort" type="number" value="${c.port || (isFtp ? 21 : 22)}">
        </div>
      </div>

      <div class="sftp-field-group">
        <label class="sftp-field-label">Username</label>
        <input class="sftp-field-input" id="sftpUsername" value="${escapeAttr(c.username)}" placeholder="deploy">
      </div>

      <div class="sftp-field-group">
        <label class="sftp-field-label">Remote Path</label>
        <input class="sftp-field-input" id="sftpRemotePath" value="${escapeAttr(c.remotePath)}" placeholder="/var/www/html">
      </div>

      <div class="sftp-field-group">
        <label class="sftp-field-label">Scope</label>
        <div class="sftp-scope-options">
          <label class="sftp-radio-label">
            <input type="radio" name="sftpScope" value="root" ${isRoot ? 'checked' : ''}> Entire project
          </label>
          <label class="sftp-radio-label">
            <input type="radio" name="sftpScope" value="context" ${!isRoot ? 'checked' : ''}> Subfolder
          </label>
        </div>
        <input class="sftp-field-input sftp-context-input ${isRoot ? 'hidden' : ''}" id="sftpContext" value="${escapeAttr(c.context === '.' ? '' : c.context)}" placeholder="frontend">
      </div>

      <div class="sftp-field-group sftp-auth-group" ${isFtp ? 'style="display:none"' : ''}>
        <label class="sftp-field-label">Authentication</label>
        <div class="sftp-auth-options">
          <button class="sftp-auth-option ${authType === 'password' ? 'active' : ''}" data-auth="password">Password</button>
          <button class="sftp-auth-option ${authType === 'key' ? 'active' : ''}" data-auth="key">Key File</button>
          <button class="sftp-auth-option ${authType === 'agent' ? 'active' : ''}" data-auth="agent">SSH Agent</button>
        </div>
      </div>

      <div class="sftp-auth-fields" id="sftpAuthFields">
        ${renderAuthFields(isFtp ? 'password' : authType, c)}
      </div>

      <div class="sftp-field-group">
        <label class="sftp-field-label">Ignore Patterns <span class="sftp-field-hint">(one per line)</span></label>
        <textarea class="sftp-field-textarea" id="sftpIgnore" rows="4">${escapeHtml((c.ignore || []).join('\n'))}</textarea>
      </div>

      <div class="sftp-field-group sftp-field-small">
        <label class="sftp-field-label">Concurrency</label>
        <input class="sftp-field-input" id="sftpConcurrency" type="number" value="${c.concurrency || 4}" min="1" max="10">
      </div>

      <div class="sftp-field-group">
        <label class="sftp-checkbox-label">
          <input type="checkbox" id="sftpEnabled" ${c.enabled !== false ? 'checked' : ''}> Enabled
        </label>
      </div>
    </div>

    <div class="sftp-form-footer">
      <div class="sftp-form-footer-left">
        <button class="sftp-btn" id="sftpTestBtn">Test Connection</button>
        <span class="sftp-test-result" id="sftpTestResult"></span>
      </div>
      <div class="sftp-form-footer-right">
        ${!isNew ? '<button class="sftp-btn sftp-btn-danger" id="sftpDeleteBtn">Delete</button>' : ''}
        <button class="sftp-btn sftp-btn-primary" id="sftpSaveBtn">Save</button>
      </div>
    </div>
  `;

  wireFormEvents(isNew, c);
}

function renderAuthFields(type, config) {
  if (type === 'password') {
    return `
      <div class="sftp-field-group">
        <label class="sftp-field-label">Password</label>
        <input class="sftp-field-input" id="sftpPassword" type="password" value="${escapeAttr(config.password || '')}" placeholder="Leave empty to prompt">
      </div>
    `;
  }
  if (type === 'key') {
    return `
      <div class="sftp-field-group">
        <label class="sftp-field-label">Private Key Path</label>
        <div class="sftp-field-with-btn">
          <input class="sftp-field-input" id="sftpKeyPath" value="${escapeAttr(config.privateKeyPath || '')}" placeholder="~/.ssh/id_rsa">
          <button class="sftp-btn sftp-btn-small" id="sftpBrowseKey">Browse</button>
        </div>
      </div>
      <div class="sftp-field-group">
        <label class="sftp-checkbox-label">
          <input type="checkbox" id="sftpPassphrasePrompt" ${config.passphrase === true ? 'checked' : ''}> Prompt for passphrase
        </label>
        <input class="sftp-field-input sftp-passphrase-input ${config.passphrase === true || !config.passphrase ? 'hidden' : ''}" id="sftpPassphrase" type="password" value="${escapeAttr(typeof config.passphrase === 'string' ? config.passphrase : '')}" placeholder="Passphrase">
      </div>
    `;
  }
  return `
    <div class="sftp-field-group">
      <label class="sftp-field-label">Agent Socket</label>
      <input class="sftp-field-input" id="sftpAgent" value="${escapeAttr(config.agent || '')}" placeholder="$SSH_AUTH_SOCK">
    </div>
  `;
}

function wireFormEvents(isNew, originalConfig) {
  const closeBtn = document.getElementById('sftpFormClose');
  closeBtn.addEventListener('click', () => {
    renderFormPlaceholder();
    selectedConfigId = null;
    renderServerList();
  });

  // Scope toggle
  document.querySelectorAll('input[name="sftpScope"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const contextInput = document.getElementById('sftpContext');
      contextInput.classList.toggle('hidden', radio.value === 'root');
    });
  });

  // Protocol toggle
  document.querySelectorAll('.sftp-protocol-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sftp-protocol-option').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const isFtp = btn.dataset.protocol === 'ftp';
      const portInput = document.getElementById('sftpPort');
      const currentPort = parseInt(portInput.value, 10);
      if (isFtp && currentPort === 22) portInput.value = '21';
      if (!isFtp && currentPort === 21) portInput.value = '22';

      const authGroup = document.querySelector('.sftp-auth-group');
      if (authGroup) authGroup.style.display = isFtp ? 'none' : '';

      if (isFtp) {
        document.querySelectorAll('.sftp-auth-option').forEach((b) => b.classList.remove('active'));
        const pwBtn = document.querySelector('.sftp-auth-option[data-auth="password"]');
        if (pwBtn) pwBtn.classList.add('active');
        document.getElementById('sftpAuthFields').innerHTML = renderAuthFields('password', buildConfigFromForm(originalConfig));
        wireAuthSubEvents();
      }
    });
  });

  // Auth type toggle
  document.querySelectorAll('.sftp-auth-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sftp-auth-option').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('sftpAuthFields').innerHTML = renderAuthFields(btn.dataset.auth, buildConfigFromForm(originalConfig));
      wireAuthSubEvents();
    });
  });

  wireAuthSubEvents();

  // Test connection
  document.getElementById('sftpTestBtn').addEventListener('click', async () => {
    const resultEl = document.getElementById('sftpTestResult');
    resultEl.textContent = 'Testing...';
    resultEl.className = 'sftp-test-result';
    const config = buildConfigFromForm(originalConfig);
    const res = await api.sftpTestConnection({ config });
    if (res.success) {
      resultEl.textContent = 'Connected';
      resultEl.className = 'sftp-test-result sftp-test-success';
    } else {
      resultEl.textContent = res.error || 'Failed';
      resultEl.className = 'sftp-test-result sftp-test-error';
    }
  });

  // Save
  document.getElementById('sftpSaveBtn').addEventListener('click', async () => {
    const config = buildConfigFromForm(originalConfig);
    const isRoot = document.querySelector('input[name="sftpScope"]:checked')?.value === 'root';

    if (!config.host || !config.username) {
      document.getElementById('sftpTestResult').textContent = 'Host and username are required';
      document.getElementById('sftpTestResult').className = 'sftp-test-result sftp-test-error';
      return;
    }

    const res = await api.sftpSaveConfig({ config, isRoot });
    if (res.success) {
      projectConfig = await api.sftpGetProjectConfig();
      selectedConfigId = res.id;
      renderServerList();
      await refreshSftpControls();
    }
  });

  // Delete
  const deleteBtn = document.getElementById('sftpDeleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!originalConfig?.id) return;
      await api.sftpRemoveConfig(originalConfig.id);
      projectConfig = await api.sftpGetProjectConfig();
      selectedConfigId = null;
      renderServerList();
      renderFormPlaceholder();
      await refreshSftpControls();
    });
  }
}

function wireAuthSubEvents() {
  const browseBtn = document.getElementById('sftpBrowseKey');
  if (browseBtn) {
    browseBtn.addEventListener('click', async () => {
      const keyPath = await api.sftpSelectKeyFile();
      if (keyPath) document.getElementById('sftpKeyPath').value = keyPath;
    });
  }

  const promptCheck = document.getElementById('sftpPassphrasePrompt');
  if (promptCheck) {
    promptCheck.addEventListener('change', () => {
      const input = document.getElementById('sftpPassphrase');
      if (input) input.classList.toggle('hidden', promptCheck.checked);
    });
  }
}

function buildConfigFromForm(original) {
  const activeAuth = document.querySelector('.sftp-auth-option.active')?.dataset.auth || 'password';
  const isRoot = document.querySelector('input[name="sftpScope"]:checked')?.value === 'root';
  const contextVal = document.getElementById('sftpContext')?.value.trim() || '';

  const config = {
    id: original?.id || undefined,
    name: document.getElementById('sftpName').value.trim(),
    context: isRoot ? '.' : (contextVal || '.'),
    host: document.getElementById('sftpHost').value.trim(),
    port: parseInt(document.getElementById('sftpPort').value, 10) || 22,
    username: document.getElementById('sftpUsername').value.trim(),
    protocol: document.querySelector('.sftp-protocol-option.active')?.dataset.protocol || 'sftp',
    remotePath: document.getElementById('sftpRemotePath').value.trim() || '/',
    password: null,
    privateKeyPath: null,
    passphrase: null,
    agent: null,
    ignore: document.getElementById('sftpIgnore').value.split('\n').map((s) => s.trim()).filter(Boolean),
    concurrency: parseInt(document.getElementById('sftpConcurrency').value, 10) || 4,
    enabled: document.getElementById('sftpEnabled').checked,
  };

  if (activeAuth === 'password') {
    config.password = document.getElementById('sftpPassword')?.value || null;
  } else if (activeAuth === 'key') {
    config.privateKeyPath = document.getElementById('sftpKeyPath')?.value || null;
    const promptCheck = document.getElementById('sftpPassphrasePrompt');
    if (promptCheck?.checked) {
      config.passphrase = true;
    } else {
      config.passphrase = document.getElementById('sftpPassphrase')?.value || null;
    }
  } else if (activeAuth === 'agent') {
    config.agent = document.getElementById('sftpAgent')?.value || null;
  }

  return config;
}

export async function refreshSftpControls() {
  const configs = await api.sftpGetConfigs();
  state.sftpConfigs = configs || [];
  const syncBtn = document.getElementById('sftpSyncBtn');
  syncBtn.style.display = state.sftpConfigs.length ? 'flex' : 'none';
  // Lazy import to avoid circular dependency
  const { updatePendingBadge } = await import('./sftp-status.js');
  updatePendingBadge();
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
