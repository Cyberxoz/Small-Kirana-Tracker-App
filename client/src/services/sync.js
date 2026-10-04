import { localDb } from '../db/localDb';
const api = (path, options) => fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
export const operationId = () => `local-${crypto.randomUUID()}`;

export async function queue(type, data) { const op = { _id: operationId(), operationId: operationId(), type, data, createdAt: new Date().toISOString() }; await localDb.put('syncQueue', op); return op; }
export async function refreshFromServer() {
  const [products, sales] = await Promise.all([api('/api/products'), api('/api/sales')]);
  if (!products.ok || !sales.ok) throw new Error('Could not refresh server data');
  await localDb.replaceAll('products', await products.json()); await localDb.replaceAll('sales', await sales.json());
}
// Process in queue order. Successful operations are removed, failures remain for the next online event.
export async function sync(onStatus) {
  if (!navigator.onLine) return false;
  const operations = await localDb.all('syncQueue');
  if (!operations.length) { await refreshFromServer(); return true; }
  onStatus?.('Synchronizing local changes…');
  try {
    const response = await api('/api/sync', { method: 'POST', body: JSON.stringify({ operations }) });
    if (!response.ok) throw new Error('Sync request failed');
    const { results } = await response.json();
    for (const result of results) if (result.success) { const item = operations.find(x => x.operationId === result.operationId); await localDb.remove('syncQueue', item._id); }
    await refreshFromServer(); await localDb.put('meta', { key: 'lastSync', value: new Date().toISOString() });
    onStatus?.(results.some(x => !x.success) ? 'Some changes will retry later.' : 'Synchronization complete');
    return results.every(x => x.success);
  } catch { onStatus?.('⚠ Sync failed — will retry when connection is available.'); return false; }
}
