import Product from '../models/Product.js';
import Sale from '../models/Sale.js';

// Each mutation carries a client-generated operationId. Sale.operationId is unique,
// so retries are safe: the same sale never decrements server stock twice.
export async function processOperation(operation) {
  const { type, data, operationId } = operation;
  if (!operationId) throw new Error('operationId is required');

  if (type === 'CREATE_PRODUCT') {
    const existing = await Product.findById(data._id);
    if (existing) return { duplicate: true, product: existing };
    const product = await Product.create({ _id: data._id, name: data.name, price: data.price, stock: data.stock, totalSold: data.totalSold || 0 });
    return { product };
  }
  if (type === 'UPDATE_PRODUCT') {
    const product = await Product.findByIdAndUpdate(data._id, { name: data.name, price: data.price, stock: data.stock }, { new: true, runValidators: true });
    if (!product) throw new Error('Product not found');
    return { product };
  }
  if (type === 'DELETE_PRODUCT') {
    await Product.findByIdAndDelete(data._id);
    return { deleted: true };
  }
  if (type === 'CREATE_SALE') {
    const repeated = await Sale.findOne({ operationId });
    if (repeated) return { duplicate: true, sale: repeated };
    const product = await Product.findById(data.productId);
    if (!product) throw new Error('Product not found');
    if (data.quantity <= 0 || data.quantity > product.stock) throw new Error('Insufficient stock for this sale');
    // This only changes MongoDB. The UI was already updated locally when queued.
    product.stock -= data.quantity;
    product.totalSold += data.quantity;
    await product.save();
    const sale = await Sale.create({ ...data, operationId });
    return { sale };
  }
  throw new Error(`Unknown operation type: ${type}`);
}
