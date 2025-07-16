const express = require('express');
const { orders } = require('./orders');
const { payments } = require('./payments');

const router = express.Router();

router.get('/analytics/orders', (_req, res) => {
  const totalOrders = orders.length;
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  res.json({ totalOrders, totalRevenue });
});

module.exports = router;
