import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { hljs, LANG_MAP } from '../core/highlight-setup.js';
import { renderTree } from './file-tree.js';
import { escapeHtml, renderDiff } from '../core/diff.js';
import { switchViewerTab } from './viewer.js';

export async function selectFile(filePath, ext) {
  state.activeFile = filePath;
  renderTree();

  const fileTab = document.getElementById('fileTab');
  fileTab.style.display = '';
  fileTab.querySelector('.tab-name').textContent = filePath.split('/').pop();

  if (state.changedPaths.has(filePath)) {
    const diff = await api.getDiff(filePath);
    if (diff) {
      document.getElementById('filePanel').innerHTML = renderDiff(diff);
      switchViewerTab('file');
      return;
    }
  }

  const data = await api.getFileContent(filePath);
  if (data.content !== undefined) {
    const fileExt = filePath.split('.').pop();
    const lang = LANG_MAP[fileExt];
    const lineCount = data.content.split('\n').length;

    // Syntax highlight (skip for very large files to avoid UI freeze)
    let highlightedLines;
    if (lang && lineCount <= 5000) {
      try {
        const result = hljs.highlight(data.content, { language: lang });
        highlightedLines = result.value.split('\n');
      } catch {
        highlightedLines = null;
      }
    }

    let html = `<div class="file-header"><span class="file-path">${escapeHtml(filePath)}</span></div>`;
    html += '<div class="file-viewer">';
    if (highlightedLines) {
      for (let i = 0; i < highlightedLines.length; i++) {
        html += `<div class="file-line"><span class="line-num">${i + 1}</span><span class="line-text hljs">${highlightedLines[i]}</span></div>`;
      }
    } else {
      const lines = data.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        html += `<div class="file-line"><span class="line-num">${i + 1}</span><span class="line-text">${escapeHtml(lines[i])}</span></div>`;
      }
    }
    html += '</div>';
    document.getElementById('filePanel').innerHTML = html;
    switchViewerTab('file');
  }
}
