import { useEffect, useMemo, useState } from 'react';
import { localDb } from './db/localDb';
import { queue, refreshFromServer, sync } from './services/sync';

const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const id = () => crypto.randomUUID().replaceAll('-', '').slice(0, 24);
const day = value => new Date(value).toDateString() === new Date().toDateString();
const stockStatus = stock => stock === 0 ? ['Out of Stock', 'out'] : stock <= 5 ? ['⚠ Low Stock', 'low'] : ['Normal', 'normal'];

export default function App() {
  const [page, setPage] = useState('Dashboard');
  const [products, setProducts] = useState([]); const [sales, setSales] = useState([]); const [pending, setPending] = useState([]);
  const [online, setOnline] = useState(navigator.onLine); const [lastSync, setLastSync] = useState(null); const [notice, setNotice] = useState('');
  const load = async () => { setProducts(await localDb.all('products')); setSales(await localDb.all('sales')); setPending(await localDb.all('syncQueue')); setLastSync((await localDb.get('meta', 'lastSync'))?.value || null); };
  const synchronize = async () => { await sync(setNotice); await load(); };
  useEffect(() => { (async () => { try { if (navigator.onLine) await refreshFromServer(); } catch { setNotice('Server unavailable — working from local storage.'); } await load(); if (navigator.onLine) synchronize(); })(); }, []);
  useEffect(() => {
    const goOnline = () => { setOnline(true); synchronize(); }; const goOffline = () => { setOnline(false); setNotice('Changes are being saved locally.'); };
    addEventListener('online', goOnline); addEventListener('offline', goOffline); return () => { removeEventListener('online', goOnline); removeEventListener('offline', goOffline); };
  }, []);
  const mutate = async (type, data, apply) => { await apply(); await queue(type, data); await load(); if (navigator.onLine) synchronize(); };
  const today = sales.filter(s => day(s.createdAt));
  const stats = { revenue: today.reduce((n, s) => n + s.total, 0), items: today.reduce((n, s) => n + s.quantity, 0), low: products.filter(p => p.stock > 0 && p.stock <= 5), best: [...products].sort((a,b) => b.totalSold - a.totalSold).slice(0, 3) };
  const props = { products, sales, pending, mutate, refresh: load, setNotice };
  return <div className="shell">
    <aside><div className="brand">🏪 <span>ShopTrack<small>Offline-First Sales Tracker</small></span></div>{['Dashboard','Products','New Sale','Sales History'].map(item => <button key={item} className={page === item ? 'nav active' : 'nav'} onClick={() => setPage(item)}>{item === 'Dashboard' ? '▦' : item === 'Products' ? '□' : item === 'New Sale' ? '＋' : '◷'} {item}</button>)}<div className="offline-note">The shop never has to stop selling.</div></aside>
    <main><header><div><h1>{page}</h1><p>{online ? 'Your data is ready to sync.' : 'Changes are safely stored on this device.'}</p></div><div className="connection"><strong className={online ? 'online' : 'offline'}>{online ? '🟢 ONLINE' : '🔴 OFFLINE'}</strong><span>Pending Sync: {pending.length}</span>{lastSync && <small>Last sync: {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>}</div></header>
      {notice && <div className={'notice ' + (notice.includes('⚠') ? 'warn' : '')}>{notice}</div>}
      {page === 'Dashboard' && <Dashboard products={products} pending={pending} stats={stats} />}
      {page === 'Products' && <Products {...props} />}
      {page === 'New Sale' && <NewSale products={products} mutate={mutate} refresh={load} setNotice={setNotice} />}
      {page === 'Sales History' && <SalesHistory sales={sales} pending={pending} />}
    </main></div>;
}

function Dashboard({ products, pending, stats }) { return <><section className="cards"><Card label="Today's Sales" value={money(stats.revenue)} icon="₹" /><Card label="Items Sold" value={stats.items} icon="◫" /><Card label="Total Products" value={products.length} icon="□" /><Card label="Low Stock Items" value={stats.low.length} icon="⚠" /><Card label="Pending Sync" value={pending.length} icon="↻" /></section><section className="grid"><article className="panel"><h2>⚠ Stock Running Low</h2>{stats.low.length ? stats.low.map(p => <div className="row" key={p._id}><b>{p.name}</b><span>{p.stock} left</span></div>) : <Empty text="All inventory levels look healthy." />}</article><article className="panel"><h2>🔥 Best-Selling Products</h2>{stats.best.filter(p => p.totalSold).length ? stats.best.filter(p => p.totalSold).map((p, i) => <div className="row" key={p._id}><b>{i + 1}. {p.name}</b><span>{p.totalSold} sold</span></div>) : <Empty text="Record a sale to see your best sellers." />}</article></section></> }
function Card({ label, value, icon }) { return <article className="card"><span className="card-icon">{icon}</span><small>{label}</small><strong>{value}</strong></article>; }
function Empty({ text }) { return <p className="empty">{text}</p>; }

function Products({ products, mutate, refresh, setNotice }) { const [query, setQuery] = useState(''); const [editing, setEditing] = useState(null); const filtered = products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  const save = async form => { const product = { ...form, price: Number(form.price), stock: Number(form.stock) }; if (!product.name.trim() || product.price < 0 || product.stock < 0) return setNotice('Please enter a product name, price, and valid stock.');
    if (editing) await mutate('UPDATE_PRODUCT', product, () => localDb.put('products', product)); else { const created = { ...product, _id: id(), totalSold: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; await mutate('CREATE_PRODUCT', created, () => localDb.put('products', created)); }
    setEditing(null); await refresh(); setNotice('Product saved locally.'); };
  const remove = async product => { if (!confirm(`Delete ${product.name}?`)) return; await mutate('DELETE_PRODUCT', { _id: product._id }, () => localDb.remove('products', product._id)); setNotice('Product deleted locally.'); };
  return <><div className="toolbar"><input placeholder="Search products…" value={query} onChange={e => setQuery(e.target.value)} /><button className="primary" onClick={() => setEditing({ name: '', price: '', stock: '' })}>+ Add Product</button></div>{editing && <ProductForm initial={editing} onCancel={() => setEditing(null)} onSave={save} />}<div className="table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(p => { const [label, cls] = stockStatus(p.stock); return <tr key={p._id}><td><b>{p.name}</b><small>{p.totalSold || 0} sold</small></td><td>{money(p.price)}</td><td>{p.stock}</td><td><span className={'badge '+cls}>{label}</span></td><td><button onClick={() => setEditing(p)}>Edit</button><button className="danger" onClick={() => remove(p)}>Delete</button></td></tr>; })}</tbody></table>{!filtered.length && <Empty text="No products found. Add your first item." />}</div></>; }
function ProductForm({ initial, onSave, onCancel }) { const [form, setForm] = useState(initial); const change = e => setForm({ ...form, [e.target.name]: e.target.value }); return <form className="form panel" onSubmit={e => { e.preventDefault(); onSave(form); }}><h2>{initial._id ? 'Edit Product' : 'Add Product'}</h2><label>Product name<input name="name" required value={form.name} onChange={change} /></label><label>Selling price (₹)<input name="price" type="number" min="0" required value={form.price} onChange={change} /></label><label>Stock quantity<input name="stock" type="number" min="0" required value={form.stock} onChange={change} /></label><div><button className="primary">Save Product</button><button type="button" onClick={onCancel}>Cancel</button></div></form>; }

function NewSale({ products, mutate, refresh, setNotice }) { const [productId, setProductId] = useState(''); const [quantity, setQuantity] = useState(1); const product = products.find(p => p._id === productId); const total = product ? product.price * Number(quantity || 0) : 0;
  const sell = async e => { e.preventDefault(); const qty = Number(quantity); if (!product) return setNotice('Select a product.'); if (qty <= 0 || qty > product.stock) return setNotice('Quantity must be within available stock.'); const sale = { _id: id(), productId: product._id, productName: product.name, quantity: qty, price: product.price, total, createdAt: new Date().toISOString() }; const updated = { ...product, stock: product.stock - qty, totalSold: (product.totalSold || 0) + qty, updatedAt: new Date().toISOString() };
    // Apply once locally. Sync only applies this operation to MongoDB, then replaces local records.
    await mutate('CREATE_SALE', sale, async () => { await localDb.put('products', updated); await localDb.put('sales', sale); }); await refresh(); setProductId(''); setQuantity(1); setNotice('Sale recorded locally.'); };
  return <form className="sale-form panel" onSubmit={sell}><h2>Record a new sale</h2><label>Product<select value={productId} onChange={e => setProductId(e.target.value)} required><option value="">Choose a product</option>{products.filter(p => p.stock > 0).map(p => <option key={p._id} value={p._id}>{p.name} — {p.stock} in stock</option>)}</select></label><label>Quantity<input type="number" min="1" max={product?.stock || 1} value={quantity} onChange={e => setQuantity(e.target.value)} required /></label>{product && <div className="total"><span>Price <b>{money(product.price)}</b></span><span>Total <b>{money(total)}</b></span></div>}<button className="primary">Record Sale</button></form>; }
function SalesHistory({ sales, pending }) { return <div className="table-wrap"><table><thead><tr><th>Sale ID</th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th>Date</th><th>Status</th></tr></thead><tbody>{sales.map(s => { const isPending = pending.some(p => p.type === 'CREATE_SALE' && p.data._id === s._id); return <tr key={s._id}><td>#{s._id.slice(-5)}</td><td><b>{s.productName}</b></td><td>{s.quantity}</td><td>{money(s.price)}</td><td>{money(s.total)}</td><td>{new Date(s.createdAt).toLocaleString()}</td><td><span className={'badge '+(isPending ? 'pending' : 'synced')}>{isPending ? '🟡 Pending' : '✓ Synced'}</span></td></tr>; })}</tbody></table>{!sales.length && <Empty text="No sales have been recorded yet." />}</div>; }
