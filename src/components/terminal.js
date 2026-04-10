import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { THEMES } from '../core/themes-data.js';

const shellQuote = (p) => (/[^a-zA-Z0-9_.\/:-]/.test(p) ? `'${p.replace(/'/g, "'\\''")}'` : p);

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

    // Alt+Enter or Shift+Enter: insert newline instead of submit
    term.attachCustomKeyEventHandler((event) => {
      if (event.key === 'Enter' && event.type === 'keydown' && (event.altKey || event.shiftKey)) {
        event.preventDefault();
        api.terminalInput('\x1b\r');
        return false;
      }
      return true;
    });

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

    // Drag-and-drop: file paths from tree sidebar or external (Finder/Explorer)
    const terminalPane = container.closest('.terminal-pane');
    let dragCounter = 0;

    terminalPane.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      terminalPane.classList.add('drop-active');
    }, { capture: true });

    terminalPane.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }, { capture: true });

    terminalPane.addEventListener('dragleave', () => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        terminalPane.classList.remove('drop-active');
      }
    }, { capture: true });

    terminalPane.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      terminalPane.classList.remove('drop-active');

      // External files from Finder/Explorer
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const paths = [];
        for (let i = 0; i < files.length; i++) {
          const filePath = api.getPathForFile(files[i]);
          if (filePath) paths.push(shellQuote(filePath));
        }
        if (paths.length > 0) {
          api.terminalInput(paths.join(' '));
          term.focus();
          return;
        }
      }

      // Internal tree drag (from file explorer sidebar)
      const textData = e.dataTransfer.getData('text/plain');
      if (textData) {
        api.terminalInput(shellQuote(textData));
        term.focus();
      }
    }, { capture: true });
  }

  // Fit with layout-aware retries — the CSS grid may not have settled yet
  fitTerminalWhenReady();
}

export function fitTerminal() {
  try {
    const container = document.getElementById('terminal');
    if (!container || container.clientHeight === 0 || container.clientWidth === 0) return;
    fitAddon.fit();
    const dims = fitAddon.proposeDimensions();
    if (dims && dims.cols > 0 && dims.rows > 0) {
      api.terminalResize({ cols: dims.cols, rows: dims.rows });
    }
  } catch {}
}

function fitTerminalWhenReady(attempt = 0) {
  const container = document.getElementById('terminal');
  if (container && container.clientHeight > 0 && container.clientWidth > 0) {
    fitTerminal();
    // Still retry a few times — grid dimensions may shift as siblings render
    if (attempt === 0) {
      setTimeout(fitTerminal, 200);
      setTimeout(fitTerminal, 500);
    }
    return;
  }
  // Container not visible yet — retry with requestAnimationFrame + fallback timeout
  if (attempt < 20) {
    requestAnimationFrame(() => fitTerminalWhenReady(attempt + 1));
  } else {
    // Final fallback after ~20 frames
    setTimeout(fitTerminal, 300);
  }
}
