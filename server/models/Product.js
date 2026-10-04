import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0 },
  totalSold: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

export default mongoose.model('Product', productSchema);
