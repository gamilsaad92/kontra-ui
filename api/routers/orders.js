const express = require('express');
const { menuItems } = require('./menu');
const requireOrg = require('../middlewares/requireOrg');

const router = express.Router();
const ordersByOrg = {};
let nextOrderId = 1;

const getMenuItems = () => menuItems;
const getOrders = orgId => ordersByOrg[orgId] || [];

router.use(requireOrg);

// Get all orders
router.get('/orders', (req, res) => {
  res.json({ orders: getOrders(req.orgId) });
});

// Create new order
router.post('/orders', (req, res) => {
  const { items, table } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Missing or invalid items' });
  }

  const menuItems = getMenuItems();
  let total = 0;

  for (const { menuItemId, quantity } of items) {
    const menuItem = menuItems.find(m => m.id === menuItemId);
    if (!menuItem) return res.status(400).json({ message: 'Invalid item' });
    total += menuItem.price * (quantity || 1);
  }

  const order = {
    id: nextOrderId++,
    items,
    total,
    table,
    created_at: new Date().toISOString()
  };

  const arr = ordersByOrg[req.orgId] || (ordersByOrg[req.orgId] = []);
  arr.push(order);

  res.status(201).json({ order });
});

// Get order by ID
router.get('/orders/:id', (req, res) => {
  const order = getOrders(req.orgId).find(o => o.id === parseInt(req.params.id, 10));
  if (!order) return res.status(404).json({ message: 'Not found' });
  res.json({ order });
});

// Split order
router.post('/orders/:id/split', (req, res) => {
  const { method, count, amounts } = req.body || {};
  const order = getOrders(req.orgId).find(o => o.id === parseInt(req.params.id, 10));
  if (!order) return res.status(404).json({ message: 'Not found' });

  if (method === 'equal') {
    if (!count || count <= 0) return res.status(400).json({ message: 'Missing count' });
    const share = parseFloat((order.total / count).toFixed(2));
    return res.json({ splits: Array.from({ length: count }, () => ({ amount: share })) });
  }

  if (method === 'itemized') {
    if (!amounts || typeof amounts !== 'object') return res.status(400).json({ message: 'Missing amounts' });
    return res.json({ splits: amounts });
  }

  res.status(400).json({ message: 'Invalid method' });
});

// Add tip & feedback
router.post('/orders/:id/tip', (req, res) => {
  const { amount, feedback } = req.body || {};
  if (typeof amount !== 'number') return res.status(400).json({ message: 'Missing amount' });

  const order = getOrders(req.orgId).find(o => o.id === parseInt(req.params.id, 10));
  if (!order) return res.status(404).json({ message: 'Not found' });

  order.tip = amount;
  if (feedback) order.feedback = feedback;

  res.json({ message: 'Tip recorded' });
});

module.exports = { router, getOrders };
