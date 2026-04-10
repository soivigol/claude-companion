import { state } from '../core/state.js';
import { fitTerminal } from './terminal.js';

export function updateGrid() {
  const appEl = document.getElementById('app');
  if (state.viewerFullscreen) {
    appEl.style.gridTemplateColumns = `${state.sidebarWidth}px 0 0 0 1fr`;
  } else {
    appEl.style.gridTemplateColumns =
      `${state.sidebarWidth}px 5px 1fr 5px ${state.viewerWidth}px`;
  }
}

export function toggleViewerFullscreen() {
  state.viewerFullscreen = !state.viewerFullscreen;

  const terminalPane = document.querySelector('.terminal-pane');
  const viewerPane = document.querySelector('.viewer-pane');
  const leftHandle = document.getElementById('leftHandle');
  const rightHandle = document.getElementById('rightHandle');
  const btn = document.getElementById('viewerFullscreenBtn');

  if (state.viewerFullscreen) {
    terminalPane.classList.add('hidden-fullscreen');
    leftHandle.classList.add('hidden-fullscreen');
    rightHandle.classList.add('hidden-fullscreen');
    viewerPane.classList.add('viewer-expanded');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
    btn.title = 'Exit fullscreen';
  } else {
    terminalPane.classList.remove('hidden-fullscreen');
    leftHandle.classList.remove('hidden-fullscreen');
    rightHandle.classList.remove('hidden-fullscreen');
    viewerPane.classList.remove('viewer-expanded');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
    btn.title = 'Toggle fullscreen';
    fitTerminal();
  }

  updateGrid();
}

export function initResize() {
  const appEl = document.getElementById('app');
  let dragging = null;

  const onMouseDown = (handle) => (e) => {
    if (state.viewerFullscreen) return;
    dragging = handle;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.getElementById('terminal').style.pointerEvents = 'none';
    e.preventDefault();
  };

  document.getElementById('leftHandle').addEventListener('mousedown', onMouseDown('left'));
  document.getElementById('rightHandle').addEventListener('mousedown', onMouseDown('right'));

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    if (dragging === 'left') {
      state.sidebarWidth = Math.max(180, Math.min(500, e.clientX));
    } else {
      state.viewerWidth = Math.max(250, Math.min(700, window.innerWidth - e.clientX));
    }
    updateGrid();
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.getElementById('terminal').style.pointerEvents = '';
    fitTerminal();
  });

  // Fullscreen toggle
  document.getElementById('viewerFullscreenBtn').addEventListener('click', toggleViewerFullscreen);

  // Escape exits fullscreen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.viewerFullscreen) {
      toggleViewerFullscreen();
    }
  });
}
