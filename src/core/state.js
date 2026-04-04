export const state = {
  tree: null,
  status: null,
  activeFile: null,
  expandedDirs: new Set(),
  changedPaths: new Set(),
  viewerTab: 'changes',
  sidebarWidth: 260,
  viewerWidth: 400,
  projectOpen: false,
  theme: localStorage.getItem('cc-theme') || 'light',
};
