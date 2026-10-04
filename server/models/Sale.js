import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  operationId: { type: String, required: true, unique: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.model('Sale', saleSchema);
