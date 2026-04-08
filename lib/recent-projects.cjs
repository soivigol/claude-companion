const MAX_RECENT = 10;
const STORE_KEY = 'recentProjects';

function createRecentProjects(store, path) {
  const get = () => store.get(STORE_KEY, []);

  const add = (fullPath) => {
    const list = get().filter((entry) => entry.path !== fullPath);
    list.unshift({
      path: fullPath,
      name: path.basename(fullPath),
      openedAt: new Date().toISOString(),
    });
    store.set(STORE_KEY, list.slice(0, MAX_RECENT));
  };

  const remove = (fullPath) => {
    store.set(STORE_KEY, get().filter((entry) => entry.path !== fullPath));
  };

  const clear = () => {
    store.set(STORE_KEY, []);
  };

  return { get, add, remove, clear };
}

module.exports = { createRecentProjects };
