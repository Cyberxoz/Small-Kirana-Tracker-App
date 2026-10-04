const DB = 'shoptrack-local';
const stores = ['products', 'sales', 'syncQueue', 'meta'];

// IndexedDB is the source read by the interface, so inventory stays usable offline.
function openDb() { return new Promise((resolve, reject) => {
  const request = indexedDB.open(DB, 1);
  request.onupgradeneeded = () => stores.forEach(name => { if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: name === 'meta' ? 'key' : '_id' }); });
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
}); }
async function tx(store, mode, fn) { const db = await openDb(); return new Promise((resolve, reject) => { const request = fn(db.transaction(store, mode).objectStore(store)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
export const localDb = {
  all: store => tx(store, 'readonly', s => s.getAll()),
  get: (store, id) => tx(store, 'readonly', s => s.get(id)),
  put: (store, item) => tx(store, 'readwrite', s => s.put(item)),
  remove: (store, id) => tx(store, 'readwrite', s => s.delete(id)),
  clear: store => tx(store, 'readwrite', s => s.clear()),
  replaceAll: async (store, items) => { const db = await openDb(); const transaction = db.transaction(store, 'readwrite'); const objectStore = transaction.objectStore(store); objectStore.clear(); items.forEach(item => objectStore.put(item)); return new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); }); }
};
