const express = require('express');
const { orders } = require('./orders');

const router = express.Router();

const payments = [];
let nextPaymentId = 1;

router.get('/payments', (req, res) => {
  res.json({ payments });
});

router.post('/payments', (req, res) => {
  const { order_id, amount, method } = req.body || {};
  if (!order_id || typeof amount !== 'number') {
    return res.status(400).json({ message: 'Missing order_id or amount' });
  }
  const order = orders.find(o => o.id === order_id);
  if (!order) return res.status(400).json({ message: 'Invalid order' });
    const payment = {
    id: nextPaymentId++,
    order_id,
    amount,
    method,
    created_at: new Date().toISOString()
  };
  payments.push(payment);
  res.status(201).json({ payment });
});

module.exports = { router, payments };
