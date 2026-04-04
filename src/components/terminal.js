import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { THEMES } from '../core/themes-data.js';

export const term = new Terminal({
  fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
  fontSize: 13,
  lineHeight: 1.3,
  theme: THEMES[state.theme].xterm,
  cursorBlink: true,
  cursorStyle: 'bar',
  scrollback: 10000,
  allowProposedApi: true,
});

export const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.loadAddon(new WebLinksAddon());

let terminalAttached = false;
let terminalOutputBound = false;

export function initTerminal() {
  const container = document.getElementById('terminal');

  if (!terminalAttached) {
    // First time: open xterm in the DOM
    term.open(container);
    terminalAttached = true;
  }

  if (!terminalOutputBound) {
    terminalOutputBound = true;

    term.onData((data) => api.terminalInput(data));

    api.onTerminalOutput((data) => term.write(data));

    api.onTerminalExit((code) => {
      term.writeln(`\r\n\x1b[90m[Process exited with code ${code}. Press any key to restart.]\x1b[0m`);
      const disposable = term.onKey(() => {
        disposable.dispose();
        api.terminalRestart();
        term.clear();
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        const dims = fitAddon.proposeDimensions();
        if (dims) api.terminalResize({ cols: dims.cols, rows: dims.rows });
      } catch {}
    });
    resizeObserver.observe(container);

    // Drag-and-drop: receive file path from tree
    const terminalPane = container.closest('.terminal-pane');

    terminalPane.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      terminalPane.classList.add('drop-active');
    });

    terminalPane.addEventListener('dragleave', (e) => {
      if (!terminalPane.contains(e.relatedTarget)) {
        terminalPane.classList.remove('drop-active');
      }
    });

    terminalPane.addEventListener('drop', (e) => {
      e.preventDefault();
      terminalPane.classList.remove('drop-active');
      const filePath = e.dataTransfer.getData('text/plain');
      if (filePath) {
        api.terminalInput(filePath);
        term.focus();
      }
    });
  }

  // Fit with multiple retries to handle layout settling
  fitTerminal();
  setTimeout(fitTerminal, 100);
  setTimeout(fitTerminal, 300);
  setTimeout(fitTerminal, 600);
}

export function fitTerminal() {
  try {
    fitAddon.fit();
    const dims = fitAddon.proposeDimensions();
    if (dims) api.terminalResize({ cols: dims.cols, rows: dims.rows });
  } catch {}
}
