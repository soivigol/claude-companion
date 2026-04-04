export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function parseDiff(raw) {
  const files = [];
  const chunks = raw.split(/^diff --git /m).filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const pathMatch = chunk.match(/\+\+\+ b\/(.+)/);
    const filePath = pathMatch ? pathMatch[1] : lines[0]?.split(' ')[0]?.replace('a/', '') || 'unknown';

    let additions = 0, deletions = 0, lineNum = 0;
    const parsedLines = [];

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const m = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
        lineNum = m ? parseInt(m[1]) - 1 : 0;
        parsedLines.push({ type: 'hunk-header', content: line, num: '' });
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        lineNum++;
        additions++;
        parsedLines.push({ type: 'addition', content: line.substring(1), num: lineNum });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
        parsedLines.push({ type: 'deletion', content: line.substring(1), num: '' });
      } else if (
        !line.startsWith('\\') && !line.startsWith('diff') && !line.startsWith('index') &&
        !line.startsWith('---') && !line.startsWith('+++') && !line.startsWith('new file') &&
        !line.startsWith('old mode') && !line.startsWith('new mode') &&
        !line.startsWith('deleted file') && !line.startsWith('similarity') &&
        !line.startsWith('rename') && !line.startsWith('Binary')
      ) {
        lineNum++;
        parsedLines.push({ type: 'context', content: line.substring(1) || '', num: lineNum });
      }
    }

    files.push({ path: filePath, additions, deletions, lines: parsedLines });
  }
  return files;
}

export function renderDiff(rawDiff) {
  const files = parseDiff(rawDiff);
  return files.map((file) => {
    const parts = file.path.split('/');
    const name = parts.pop();
    const dir = parts.length ? `<span class="dir">${parts.join('/')}/</span>` : '';

    const linesHtml = file.lines.map((l) =>
      `<div class="diff-line ${l.type}"><span class="line-num">${l.num}</span><span class="line-content">${escapeHtml(l.content)}</span></div>`
    ).join('');

    return `<div class="diff-section">
      <div class="diff-file-header">
        <span class="diff-file-path">${dir}${name}</span>
        <div class="diff-file-stats">
          ${file.additions ? `<span class="additions">+${file.additions}</span>` : ''}
          ${file.deletions ? `<span class="deletions">-${file.deletions}</span>` : ''}
        </div>
      </div>
      <div class="diff-content">${linesHtml}</div>
    </div>`;
  }).join('');
}
