const express = require('express');
const { getOrders } = require('./orders');
const requireOrg = require('../middlewares/requireOrg');

const router = express.Router();

const paymentsByOrg = {};
let nextPaymentId = 1;

const getPayments = orgId => paymentsByOrg[orgId] || [];

const { broadcastAnalytics } = require('./analytics');

router.use(requireOrg);

router.get('/payments', (req, res) => {
  res.json({ payments: getPayments(req.orgId) });
});

router.post('/payments', (req, res) => {
  const { order_id, amount, method } = req.body || {};
  if (!order_id || typeof amount !== 'number') {
    return res.status(400).json({ message: 'Missing order_id or amount' });
  }
  const order = getOrders(req.orgId).find(o => o.id === order_id);
  if (!order) return res.status(400).json({ message: 'Invalid order' });
 const payment = {
    id: nextPaymentId++,
    order_id,
    amount,
    method,
    created_at: new Date().toISOString()
  };
const arr = paymentsByOrg[req.orgId] || (paymentsByOrg[req.orgId] = []);
  arr.push(payment);
 broadcastAnalytics(req.orgId);
  res.status(201).json({ payment });
});

module.exports = { router, getPayments };
