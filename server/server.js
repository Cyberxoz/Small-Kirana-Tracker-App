import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Product from './models/Product.js';
import Sale from './models/Sale.js';
import { processOperation } from './services/operations.js';
import { seedStarterProducts } from './services/seedProducts.js';

const app = express();
app.use(cors());
app.use(express.json());
const operation = (type, data, operationId = `api-${crypto.randomUUID()}`) => processOperation({ type, data, operationId });

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/products', async (_req, res, next) => { try { res.json(await Product.find().sort({ createdAt: -1 })); } catch (e) { next(e); } });
app.post('/api/products', async (req, res, next) => { try { res.status(201).json((await operation('CREATE_PRODUCT', { ...req.body, _id: req.body._id || undefined })).product); } catch (e) { next(e); } });
app.put('/api/products/:id', async (req, res, next) => { try { res.json((await operation('UPDATE_PRODUCT', { ...req.body, _id: req.params.id })).product); } catch (e) { next(e); } });
app.delete('/api/products/:id', async (req, res, next) => { try { await operation('DELETE_PRODUCT', { _id: req.params.id }); res.status(204).end(); } catch (e) { next(e); } });
app.get('/api/sales', async (_req, res, next) => { try { res.json(await Sale.find().sort({ createdAt: -1 })); } catch (e) { next(e); } });
app.post('/api/sales', async (req, res, next) => { try { res.status(201).json((await operation('CREATE_SALE', req.body, req.body.operationId || `api-${crypto.randomUUID()}`)).sale); } catch (e) { next(e); } });
app.post('/api/sync', async (req, res, next) => { try {
  const results = [];
  for (const item of req.body.operations || []) {
    try { await processOperation(item); results.push({ operationId: item.operationId, success: true }); }
    catch (error) { results.push({ operationId: item.operationId, success: false, error: error.message }); }
  }
  res.json({ results });
} catch (e) { next(e); } });
app.use((err, _req, res, _next) => res.status(400).json({ error: err.message || 'Request failed' }));

const port = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shoptrack')
  .then(async () => {
    await seedStarterProducts();
    app.listen(port, () => console.log(`ShopTrack API on ${port}`));
  })
  .catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
