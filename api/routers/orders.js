const express = require('express');
const { menuItems } = require('./menu');
const requireOrg = require('../middlewares/requireOrg');

const router = express.Router();

const ordersByOrg = {};
let nextOrderId = 1;

// Access menu items array from menu service
const getMenuItems = () => menuItems;

const getOrders = orgId => ordersByOrg[orgId] || [];

router.use(requireOrg);
router.get('/orders', (req, res) => {
  res.json({ orders: getOrders(req.orgId) });
});

router.post('/orders', (req, res) => {
 const { items, table } = req.body || {};
 const { items, table } = req.body || {};
    return res.status(400).json({ message: 'Missing items' });
  }
  const menuItems = getMenuItems();
  let total = 0;
  for (const { menuItemId, quantity } of items) {
    const menuItem = menuItems.find(m => m.id === menuItemId);
    if (!menuItem) return res.status(400).json({ message: 'Invalid item' });
    total += menuItem.price * (quantity || 1);
  }
   const order = {
  const order = {
    items,
    total,
    table,
    created_at: new Date().toISOString()
  };
  orders.push(order);
 const arr = ordersByOrg[req.orgId] || (ordersByOrg[req.orgId] = []);
  arr.push(order);
  res.status(201).json({ order });
});

router.get('/orders/:id', (req, res) => {
  const { id } = req.params;
  const order = orders.find(o => o.id === parseInt(id, 10));
  if (!order) return res.status(404).json({ message: 'Not found' });
  res.json({ order });
});

// Split bill ---------------------------------------------------------------
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

// Add tip & feedback -------------------------------------------------------
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
