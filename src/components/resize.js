import { state } from '../core/state.js';
import { fitTerminal } from './terminal.js';

export function initResize() {
  const appEl = document.getElementById('app');
  let dragging = null;

  const onMouseDown = (handle) => (e) => {
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
    appEl.style.gridTemplateColumns =
      `${state.sidebarWidth}px 5px 1fr 5px ${state.viewerWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.getElementById('terminal').style.pointerEvents = '';
    fitTerminal();
  });
}
