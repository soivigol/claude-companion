import { api } from '../core/api.js';

export function initUpdateBanner() {
  const container = document.getElementById('updateStatus');
  if (!container) return;

  api.onUpdateStatus((data) => {
    switch (data.status) {
      case 'available':
        container.innerHTML = `<span class="update-badge available" id="updateAction">Update v${data.version}</span>`;
        container.querySelector('#updateAction').onclick = () => api.downloadUpdate();
        break;
      case 'downloading':
        container.innerHTML = `<span class="update-badge downloading">Downloading... ${data.percent}%</span>`;
        break;
      case 'ready':
        container.innerHTML = `<span class="update-badge ready" id="updateAction">Restart to update</span>`;
        container.querySelector('#updateAction').onclick = () => api.installUpdate();
        break;
      case 'error':
        container.innerHTML = '';
        break;
    }
  });

  // Check for updates 5 seconds after startup
  setTimeout(() => {
    api.checkForUpdates();
  }, 5000);
}
