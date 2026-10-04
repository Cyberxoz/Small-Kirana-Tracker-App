import Product from '../models/Product.js';

const starterProducts = [
  ['Milk', 60, 20],
  ['Bread', 40, 15],
  ['Biscuits', 30, 50],
  ['Rice', 70, 25],
  ['Wheat Flour', 55, 20],
  ['Sugar', 45, 20],
  ['Salt', 25, 30],
  ['Cooking Oil', 150, 15],
  ['Tea', 120, 15],
  ['Maggi', 15, 40],
  ['Dal', 110, 20],
  ['Eggs', 7, 60],
  ['Butter', 60, 15],
  ['Shampoo', 120, 10],
  ['Soap', 35, 30],
  ['Toothpaste', 95, 15],
  ['Potato', 30, 25],
  ['Onion', 35, 25],
  ['Tomato', 40, 25],
  ['Banana', 50, 20],
  ['Apple', 120, 15],
  ['Cold Drink', 50, 20],
  ['Namkeen', 60, 20],
  ['Juice', 80, 15],
  ['Chocolate', 40, 25]
];

export async function seedStarterProducts() {
  await Promise.all(starterProducts.map(([name, price, stock]) => Product.updateOne(
    { name },
    { $setOnInsert: { name, price, stock, totalSold: 0 } },
    { upsert: true }
  )));
}
