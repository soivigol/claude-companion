import { api } from '../core/api.js';

export function initUpdateBanner() {
  const container = document.getElementById('updateStatus');
  if (!container) return;

  let pendingVersion = null;

  api.onUpdateStatus((data) => {
    switch (data.status) {
      case 'available':
        pendingVersion = data.version;
        container.innerHTML = `<span class="update-badge available" id="updateAction">Update v${data.version}</span>`;
        container.querySelector('#updateAction').onclick = () => {
          container.innerHTML = '<span class="update-badge downloading">Starting download…</span>';
          api.downloadUpdate().catch(() => {
            showRetry(container, pendingVersion);
          });
        };
        break;
      case 'downloading':
        container.innerHTML = `<span class="update-badge downloading">Downloading… ${data.percent}%</span>`;
        break;
      case 'ready':
        container.innerHTML = `<span class="update-badge ready" id="updateAction">Restart to update</span>`;
        container.querySelector('#updateAction').onclick = () => api.installUpdate();
        break;
      case 'install-failed':
        showDownloadLink(container, data.version);
        break;
      case 'error':
        showRetry(container, pendingVersion);
        break;
    }
  });

  // Check for updates 5 seconds after startup
  setTimeout(() => {
    api.checkForUpdates();
  }, 5000);
}

function showRetry(container, version) {
  if (!version) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `<span class="update-badge error" id="updateAction">Retry update v${version}</span>`;
  container.querySelector('#updateAction').onclick = () => {
    container.innerHTML = '<span class="update-badge downloading">Starting download…</span>';
    api.downloadUpdate().catch(() => {
      showRetry(container, version);
    });
  };
}

function showDownloadLink(container, version) {
  container.innerHTML = `<span class="update-badge ready" id="updateAction">Download v${version}</span>`;
  container.querySelector('#updateAction').onclick = () => api.openReleasePage();
}
