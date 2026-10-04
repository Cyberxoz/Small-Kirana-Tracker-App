# ShopTrack — Offline-First Small Shop & Sales Tracker

ShopTrack is a simple hackathon MVP for a small shop: manage inventory, record sales, and keep selling when the connection drops.

## Problem and solution

Small shops can lose the ability to record sales and manage stock during unreliable connectivity. ShopTrack writes the UI data to IndexedDB first, queues every mutation, then automatically sends queued work to Express and MongoDB when the browser comes online.

## Features

- Product CRUD, inventory search, low/out-of-stock indicators
- Sales that update stock and total quantity sold immediately
- Dashboard for today's sales, units, low stock, best sellers, and sync count
- IndexedDB `products`, `sales`, `syncQueue`, and metadata stores
- Visible online/offline state and automatic retry on the browser `online` event
- Duplicate-safe server sync: a unique operation ID prevents sales from being created twice

## Offline flow

```text
User action → IndexedDB (immediate UI update) → pending queue
                                              ↓ when online
                                      Express API → MongoDB
```

The client reduces inventory **only once** when recording the local sale. Sync applies that operation to MongoDB, then refreshes local IndexedDB from the server; it never reapplies the sale locally.

When the API starts, it adds the starter grocery catalog (Milk, Bread, Biscuits, Rice, Wheat Flour, Sugar, Salt, Cooking Oil, Tea, Maggi, Dal, Eggs, Butter, Shampoo, Soap, Toothpaste, Potato, Onion, Tomato, Banana, Apple, Cold Drink, Namkeen, Juice, and Chocolate) if those products do not already exist. Existing products and their stock are preserved.

## Run locally

1. Start MongoDB locally (or use a MongoDB Atlas URI).
2. Copy `.env.example` to `server/.env` and set `MONGODB_URI` if needed.
3. Install dependencies and start both apps:

```bash
npm install
npm run install:all
npm run dev
```

Open `http://localhost:5173`. The API runs on port 5000.

## Environment variables

`MONGODB_URI` is the MongoDB connection string. `PORT` defaults to `5000`.

## Hackathon demo

1. Add Milk (₹60, 20 stock), Bread (₹40, 15), and Biscuits (₹30, 50).
2. Record a Milk sale while online.
3. In browser DevTools, set the network to Offline. The red OFFLINE status appears.
4. Record Bread and Milk sales; inventory, history, dashboard, and pending count update immediately.
5. Go back online. Watch the pending count fall to zero after automatic sync.
