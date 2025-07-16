const express = require('express');
const { menuItems } = require('./menu');

const router = express.Router();

const orders = [];
let nextOrderId = 1;

// Access menu items array from menu service
const getMenuItems = () => menuItems;

router.get('/orders', (req, res) => {
  res.json({ orders });
});

router.post('/orders', (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Missing items' });
  }
  const menuItems = getMenuItems();
  let total = 0;
  for (const { menuItemId, quantity } of items) {
    const menuItem = menuItems.find(m => m.id === menuItemId);
    if (!menuItem) return res.status(400).json({ message: 'Invalid item' });
    total += menuItem.price * (quantity || 1);
  }
  const order = { id: nextOrderId++, items, total };
  orders.push(order);
  res.status(201).json({ order });
});

router.get('/orders/:id', (req, res) => {
  const { id } = req.params;
  const order = orders.find(o => o.id === parseInt(id, 10));
  if (!order) return res.status(404).json({ message: 'Not found' });
  res.json({ order });
});

module.exports = { router, orders };
