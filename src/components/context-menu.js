let activeMenu = null;

function dismiss() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
  document.removeEventListener('click', onOutsideClick);
  document.removeEventListener('keydown', onEscape);
}

function onOutsideClick() {
  dismiss();
}

function onEscape(e) {
  if (e.key === 'Escape') dismiss();
}

export function showContextMenu(x, y, items) {
  dismiss();

  const menu = document.createElement('div');
  menu.className = 'context-menu';

  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'context-menu-item';
    el.textContent = item.label;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
      item.onClick();
    });
    menu.appendChild(el);
  }

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  document.body.appendChild(menu);

  // Adjust if overflowing viewport
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 4}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 4}px`;

  activeMenu = menu;

  requestAnimationFrame(() => {
    document.addEventListener('click', onOutsideClick);
    document.addEventListener('keydown', onEscape);
  });
}
