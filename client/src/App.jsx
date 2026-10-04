import { useEffect, useMemo, useState } from 'react';
import { localDb } from './db/localDb';
import { queue, refreshFromServer, sync } from './services/sync';

const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const id = () => crypto.randomUUID().replaceAll('-', '').slice(0, 24);
const day = value => new Date(value).toDateString() === new Date().toDateString();
const stockStatus = stock => stock === 0 ? ['🔴 Out of Stock', 'out'] : stock <= 5 ? ['⚠ Low Stock', 'low'] : ['🟢 In Stock', 'normal'];
const starterProducts = [
  ['Milk', 60, 20], ['Bread', 40, 15], ['Biscuits', 30, 50], ['Rice', 70, 25], ['Wheat Flour', 55, 20],
  ['Sugar', 45, 20], ['Salt', 25, 30], ['Cooking Oil', 150, 15], ['Tea', 120, 15], ['Maggi', 15, 40],
  ['Dal', 110, 20], ['Eggs', 7, 60], ['Butter', 60, 15], ['Shampoo', 120, 10], ['Soap', 35, 30],
  ['Toothpaste', 95, 15], ['Potato', 30, 25], ['Onion', 35, 25], ['Tomato', 40, 25], ['Banana', 50, 20],
  ['Apple', 120, 15], ['Cold Drink', 50, 20], ['Namkeen', 60, 20], ['Juice', 80, 15], ['Chocolate', 40, 25]
];

export default function App() {
  const [page, setPage] = useState('Dashboard');
  const [products, setProducts] = useState([]); const [sales, setSales] = useState([]); const [pending, setPending] = useState([]);
  const [online, setOnline] = useState(navigator.onLine); const [lastSync, setLastSync] = useState(null); const [notice, setNotice] = useState('');
  const [authOpen, setAuthOpen] = useState(false); const [member, setMember] = useState(() => localStorage.getItem('shoptrack-member') || '');
  const load = async () => { setProducts(await localDb.all('products')); setSales(await localDb.all('sales')); setPending(await localDb.all('syncQueue')); setLastSync((await localDb.get('meta', 'lastSync'))?.value || null); };
  const seedLocalProducts = async () => {
    if (await localDb.all('products').then(items => items.length)) return;
    for (const [name, price, stock] of starterProducts) {
      const product = { _id: id(), name, price, stock, totalSold: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await localDb.put('products', product);
      await queue('CREATE_PRODUCT', product);
    }
  };
  const synchronize = async () => { const synced = await sync(setNotice); await load(); return synced; };
  useEffect(() => { (async () => { try { if (navigator.onLine) await refreshFromServer(); } catch { setNotice('Server unavailable — working from local storage.'); } await seedLocalProducts(); await load(); if (navigator.onLine) synchronize(); })(); }, []);
  useEffect(() => {
    const goOnline = () => { setOnline(true); synchronize(); }; const goOffline = () => { setOnline(false); setNotice('Changes are being saved locally.'); };
    addEventListener('online', goOnline); addEventListener('offline', goOffline); return () => { removeEventListener('online', goOnline); removeEventListener('offline', goOffline); };
  }, []);
  const mutate = async (type, data, apply) => { await apply(); await queue(type, data); await load(); return navigator.onLine ? synchronize() : false; };
  const today = sales.filter(s => day(s.createdAt));
  const stats = { revenue: today.reduce((n, s) => n + s.total, 0), items: today.reduce((n, s) => n + s.quantity, 0), low: products.filter(p => p.stock > 0 && p.stock <= 5), best: [...products].sort((a,b) => b.totalSold - a.totalSold).slice(0, 3) };
  const props = { products, sales, pending, mutate, refresh: load, setNotice };
  const signOut = () => { localStorage.removeItem('shoptrack-member'); setMember(''); };
  return <div className="shell">
    <aside><div className="brand"><Logo /><span>ShopTrack<small>Offline-First Sales Tracker</small></span></div>{['Dashboard','Products','New Sale','Sales History'].map(item => <button key={item} className={page === item ? 'nav active' : 'nav'} onClick={() => setPage(item)}>{item === 'Dashboard' ? '▦' : item === 'Products' ? '□' : item === 'New Sale' ? '＋' : '◷'} {item}</button>)}<div className="offline-note">The shop never has to stop selling.</div></aside>
    <main><header className="topbar"><div className="topbar-brand"><span className="mobile-logo"><Logo /></span><div><h1>{page}</h1><p>{online ? 'Your business at a glance.' : 'Changes are safely stored on this device.'}</p></div></div><nav className="top-nav" aria-label="Primary navigation">{['Dashboard','Products','New Sale','Sales History'].map(item => <button key={item} className={page === item ? 'top-nav-active' : ''} onClick={() => setPage(item)}>{item}</button>)}</nav><div className="header-actions"><div className="connection"><strong className={online ? 'online' : 'offline'}>{online ? '● ONLINE' : '● OFFLINE'}</strong><span>{pending.length} pending</span>{lastSync && <small>Synced {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>}</div>{member ? <div className="account"><span>{member.slice(0, 1).toUpperCase()}</span><button title="Sign out" onClick={signOut}>Sign out</button></div> : <button className="signin" onClick={() => setAuthOpen(true)}>Sign in</button>}</div></header>
      {notice && <div className={'notice ' + (notice.includes('⚠') ? 'warn' : '')}>{notice}</div>}
      {page === 'Dashboard' && <Dashboard products={products} sales={sales} pending={pending} stats={stats} online={online} setPage={setPage} />}
      {page === 'Products' && <Products {...props} />}
      {page === 'New Sale' && <NewSale products={products} mutate={mutate} refresh={load} setNotice={setNotice} />}
      {page === 'Sales History' && <SalesHistory sales={sales} pending={pending} />}
    </main>{authOpen && <AuthModal onClose={() => setAuthOpen(false)} onComplete={name => { localStorage.setItem('shoptrack-member', name); setMember(name); setAuthOpen(false); setNotice(`Welcome, ${name}!`); }} />}</div>;
}

function Logo() { return <svg className="shoptrack-logo" viewBox="0 0 48 48" role="img" aria-label="ShopTrack logo"><defs><linearGradient id="logo-gradient" x1="8" y1="5" x2="40" y2="43" gradientUnits="userSpaceOnUse"><stop stopColor="#67e8f9" /><stop offset="1" stopColor="#9b6cff" /></linearGradient></defs><path d="M10 19.5 24 9l14 10.5v17A3.5 3.5 0 0 1 34.5 40h-21a3.5 3.5 0 0 1-3.5-3.5v-17Z" fill="url(#logo-gradient)" /><path d="M7 20.5 24 7l17 13.5M17 40V27h14v13M16 20h16" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="24" cy="20" r="3.2" fill="#fff" /></svg>; }

function AuthModal({ onClose, onComplete }) { const [isSignup, setIsSignup] = useState(false); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const submit = e => { e.preventDefault(); onComplete((isSignup ? name : email.split('@')[0]) || 'Shop owner'); };
  return <div className="modal-backdrop" role="presentation"><form className="auth-card" onSubmit={submit}><button type="button" className="close" aria-label="Close" onClick={onClose}>×</button><div className="auth-logo"><Logo /></div><h2>{isSignup ? 'Create your ShopTrack account' : 'Welcome back'}</h2><p>{isSignup ? 'Set up your shop profile in seconds.' : 'Sign in to your ShopTrack workspace.'}</p>{isSignup && <label>Shop owner name<input required value={name} placeholder="Your name" onChange={e => setName(e.target.value)} /></label>}<label>Email address<input required type="email" value={email} placeholder="you@shop.com" onChange={e => setEmail(e.target.value)} /></label><label>Password<input required type="password" minLength="4" placeholder="••••••••" /></label><button className="primary auth-submit">{isSignup ? 'Create account' : 'Sign in'}</button><div className="auth-switch">{isSignup ? 'Already have an account?' : 'New to ShopTrack?'} <button type="button" onClick={() => setIsSignup(!isSignup)}>{isSignup ? 'Sign in' : 'Create one'}</button></div><small className="demo-note">Demo-only sign-in: no password is sent or stored.</small></form></div>; }

function Dashboard({ products, sales, pending, stats, online, setPage }) {
  const bestProduct = stats.best.find(p => p.totalSold);
  const todaysSales = sales.filter(s => day(s.createdAt)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return <><section className="cards feature-cards">
    <FeatureCard label="Inventory" value={`${products.length} products`} icon="🏪" description="View products and available stock" action="View inventory" onClick={() => setPage('Products')} />
    <FeatureCard label="Today’s Sales" value={money(stats.revenue)} icon="💰" description={`${stats.items} items sold today`} />
    <FeatureCard label="Record Sale" value="Quick entry" icon="🛒" description="Add a new sale in seconds" action="Record a sale" onClick={() => setPage('New Sale')} />
    <FeatureCard label="Low Stock" value={stats.low.length} icon="⚠️" description={stats.low.length ? 'Products that are about to finish' : 'All stock levels look healthy'} />
    <FeatureCard label="Best-Selling Products" value={bestProduct ? bestProduct.name : 'No sales yet'} icon="🔥" description={bestProduct ? `${bestProduct.totalSold} sold so far` : 'Your top products will appear here'} />
    <FeatureCard label="Sync Status" value={online ? 'Online' : 'Offline'} icon="🔄" description={`${pending.length} pending change${pending.length === 1 ? '' : 's'}`} status={online ? 'online' : 'offline'} />
  </section><section className="grid"><article className="panel"><h2>💰 Today’s Sales</h2>{todaysSales.length ? todaysSales.map(s => <div className="row sale-row" key={s._id}><span><b>{s.productName}</b><small>{s.quantity} {s.quantity === 1 ? 'item' : 'items'} · {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></span><strong>{money(s.total)}</strong></div>) : <Empty text="No sales recorded today." />}</article><article className="panel"><h2>⚠ Stock Running Low</h2>{stats.low.length ? stats.low.map(p => <div className="row" key={p._id}><b>{p.name}</b><span>{p.stock} left</span></div>) : <Empty text="All inventory levels look healthy." />}</article><article className="panel"><h2>🔥 Best-Selling Products</h2>{stats.best.filter(p => p.totalSold).length ? stats.best.filter(p => p.totalSold).map((p, i) => <div className="row" key={p._id}><b>{i + 1}. {p.name}</b><span>{p.totalSold} sold</span></div>) : <Empty text="Record a sale to see your best sellers." />}</article></section></>
}
function FeatureCard({ label, value, icon, description, action, onClick, status }) { return <article className={'card feature-card ' + (onClick ? 'is-action' : '')} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}><span className="card-icon">{icon}</span><small>{label}</small><strong className={status}>{value}</strong><p>{description}</p>{action && <span className="feature-action">{action} →</span>}</article>; }
function Empty({ text }) { return <p className="empty">{text}</p>; }

function Products({ products, pending, mutate, refresh, setNotice }) { const [query, setQuery] = useState(''); const [editing, setEditing] = useState(null); const filtered = [...products].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  const save = async form => {
    const name = form.name.trim(); const price = Number(form.price); const stock = Number(form.stock);
    if (!name) return setNotice('Product name is required.');
    if (!Number.isFinite(price) || price <= 0) return setNotice('Price must be greater than 0.');
    if (!Number.isFinite(stock) || !Number.isInteger(stock) || stock < 0) return setNotice('Stock quantity cannot be negative.');
    const product = { ...form, name, price, stock };
    if (editing?._id) { const synced = await mutate('UPDATE_PRODUCT', product, () => localDb.put('products', product)); setEditing(null); await refresh(); setNotice(synced ? '✓ Product updated and synced' : '✓ Product updated successfully'); }
    else { const created = { ...product, _id: id(), totalSold: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; const synced = await mutate('CREATE_PRODUCT', created, () => localDb.put('products', created)); setEditing(null); await refresh(); setNotice(synced ? '✓ Product added and synced' : navigator.onLine ? '⚠ Product added locally — pending synchronization' : '✓ Product added successfully — pending synchronization'); }
  };
  const remove = async product => { if (!confirm(`Delete ${product.name}?`)) return; await mutate('DELETE_PRODUCT', { _id: product._id }, () => localDb.remove('products', product._id)); setNotice('Product deleted locally.'); };
return <><div className="toolbar"><input placeholder="Search products…" value={query} onChange={e => setQuery(e.target.value)} /><button type="button" className="primary" onClick={() => setEditing({ name: '', price: '', stock: '' })}>+ Add Product</button></div>{editing && <ProductForm initial={editing} onCancel={() => setEditing(null)} onSave={save} />}<div className="table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th>Total Sold</th><th>Actions</th></tr></thead><tbody>{filtered.map(p => { const [label, cls] = stockStatus(p.stock); const isPending = pending.some(item => item.type === 'CREATE_PRODUCT' && item.data._id === p._id); return <tr key={p._id}><td><b>{p.name}</b></td><td>{money(p.price)}</td><td>{p.stock}</td><td><span className={'badge '+cls}>{label}</span>{isPending && <small className="pending-product">🟡 Pending Sync</small>}</td><td>{p.totalSold || 0}</td><td><button type="button" onClick={() => setEditing(p)}>Edit</button><button type="button" className="danger" onClick={() => remove(p)}>Delete</button></td></tr>; })}</tbody></table>{!filtered.length && <Empty text="No products found. Add your first item." />}</div></>; }
function ProductForm({ initial, onSave, onCancel }) { const [form, setForm] = useState(initial); const change = e => setForm({ ...form, [e.target.name]: e.target.value }); return <form className="form panel" onSubmit={async e => { e.preventDefault(); await onSave(form); }}><h2>{initial._id ? 'Edit Product' : 'Add Product'}</h2><label>Product name<input name="name" placeholder="e.g. Milk" value={form.name} onChange={change} /></label><label>Selling price (₹)<input name="price" type="number" min="0.01" step="0.01" placeholder="60" value={form.price} onChange={change} /></label><label>Stock quantity<input name="stock" type="number" min="0" step="1" placeholder="20" value={form.stock} onChange={change} /></label><div><button type="submit" className="primary">Save Product</button><button type="button" onClick={onCancel}>Cancel</button></div></form>; }

function NewSale({ products, mutate, refresh, setNotice }) { const [productId, setProductId] = useState(''); const [quantity, setQuantity] = useState(1); const product = products.find(p => p._id === productId); const total = product ? product.price * Number(quantity || 0) : 0;
  const sell = async e => { e.preventDefault(); const qty = Number(quantity); if (!product) return setNotice('Select a product.'); if (qty <= 0 || qty > product.stock) return setNotice('Quantity must be within available stock.'); const sale = { _id: id(), productId: product._id, productName: product.name, quantity: qty, price: product.price, total, createdAt: new Date().toISOString() }; const updated = { ...product, stock: product.stock - qty, totalSold: (product.totalSold || 0) + qty, updatedAt: new Date().toISOString() };
    // Apply once locally. Sync only applies this operation to MongoDB, then replaces local records.
    await mutate('CREATE_SALE', sale, async () => { await localDb.put('products', updated); await localDb.put('sales', sale); }); await refresh(); setProductId(''); setQuantity(1); setNotice('Sale recorded locally.'); };
  return <form className="sale-form panel" onSubmit={sell}><h2>Record a new sale</h2><label>Product<select value={productId} onChange={e => setProductId(e.target.value)} required><option value="">Choose a product</option>{products.filter(p => p.stock > 0).map(p => <option key={p._id} value={p._id}>{p.name} — {p.stock} in stock</option>)}</select></label><label>Quantity<input type="number" min="1" max={product?.stock || 1} value={quantity} onChange={e => setQuantity(e.target.value)} required /></label>{product && <div className="total"><span>Price <b>{money(product.price)}</b></span><span>Total <b>{money(total)}</b></span></div>}<button className="primary">Record Sale</button></form>; }
function SalesHistory({ sales, pending }) { return <div className="table-wrap"><table><thead><tr><th>Sale ID</th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th>Date</th><th>Status</th></tr></thead><tbody>{sales.map(s => { const isPending = pending.some(p => p.type === 'CREATE_SALE' && p.data._id === s._id); return <tr key={s._id}><td>#{s._id.slice(-5)}</td><td><b>{s.productName}</b></td><td>{s.quantity}</td><td>{money(s.price)}</td><td>{money(s.total)}</td><td>{new Date(s.createdAt).toLocaleString()}</td><td><span className={'badge '+(isPending ? 'pending' : 'synced')}>{isPending ? '🟡 Pending' : '✓ Synced'}</span></td></tr>; })}</tbody></table>{!sales.length && <Empty text="No sales have been recorded yet." />}</div>; }
