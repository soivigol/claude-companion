import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { hljs, LANG_MAP } from '../core/highlight-setup.js';
import { renderTree } from './file-tree.js';
import { escapeHtml, parseDiff } from '../core/diff.js';
import { switchViewerTab } from './viewer.js';
import { createEditor } from '../core/editor-setup.js';

let activeEditor = null;

function getAddedLines(diffRaw) {
  const files = parseDiff(diffRaw);
  const added = new Set();
  for (const file of files) {
    for (const line of file.lines) {
      if (line.type === 'addition' && line.num) added.add(line.num);
    }
  }
  return added;
}

function destroyEditor() {
  if (activeEditor) {
    activeEditor.destroy();
    activeEditor = null;
  }
}

function enterEditMode(filePath, content) {
  destroyEditor();
  const panel = document.getElementById('filePanel');
  const header = panel.querySelector('.file-header');

  header.innerHTML = `<span class="file-path">${escapeHtml(filePath)}</span>
    <div class="file-actions">
      <button class="file-action-btn save-btn" id="fileSaveBtn">Save</button>
      <button class="file-action-btn cancel-btn" id="fileCancelBtn">Cancel</button>
    </div>`;

  const viewer = panel.querySelector('.file-viewer');
  const editorContainer = document.createElement('div');
  editorContainer.className = 'file-editor-container';
  viewer.replaceWith(editorContainer);

  const fileExt = filePath.split('.').pop();
  activeEditor = createEditor(editorContainer, content, fileExt, state.theme === 'dark');

  document.getElementById('fileSaveBtn').addEventListener('click', async () => {
    const newContent = activeEditor.state.doc.toString();
    const result = await api.saveFileContent(filePath, newContent);
    if (result.error) {
      editorContainer.classList.add('editor-error');
      setTimeout(() => editorContainer.classList.remove('editor-error'), 600);
      return;
    }
    destroyEditor();
    selectFile(filePath, fileExt);
  });

  document.getElementById('fileCancelBtn').addEventListener('click', () => {
    destroyEditor();
    selectFile(filePath, filePath.split('.').pop());
  });
}

export async function selectFile(filePath, ext) {
  destroyEditor();
  state.activeFile = filePath;
  renderTree();

  const fileTab = document.getElementById('fileTab');
  fileTab.style.display = '';
  fileTab.querySelector('.tab-name').textContent = filePath.split('/').pop();

  // Get added line numbers from diff if file has changes
  let addedLines = new Set();
  if (state.changedPaths.has(filePath)) {
    const diff = await api.getDiff(filePath);
    if (diff) addedLines = getAddedLines(diff);
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

    let html = `<div class="file-header">
      <span class="file-path">${escapeHtml(filePath)}</span>
      <div class="file-actions">
        <button class="file-action-btn edit-btn" id="fileEditBtn">Edit</button>
      </div>
    </div>`;
    html += '<div class="file-viewer">';
    if (highlightedLines) {
      for (let i = 0; i < highlightedLines.length; i++) {
        const lineClass = addedLines.has(i + 1) ? 'file-line addition' : 'file-line';
        html += `<div class="${lineClass}"><span class="line-num">${i + 1}</span><span class="line-text hljs">${highlightedLines[i]}</span></div>`;
      }
    } else {
      const lines = data.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const lineClass = addedLines.has(i + 1) ? 'file-line addition' : 'file-line';
        html += `<div class="${lineClass}"><span class="line-num">${i + 1}</span><span class="line-text">${escapeHtml(lines[i])}</span></div>`;
      }
    }
    html += '</div>';
    document.getElementById('filePanel').innerHTML = html;
    switchViewerTab('file');

    document.getElementById('fileEditBtn').addEventListener('click', () => {
      enterEditMode(filePath, data.content);
    });
  }
}
