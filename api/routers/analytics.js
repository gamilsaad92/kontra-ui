const express = require('express');
const { orders } = require('./orders');
const { payments } = require('./payments');

const router = express.Router();

router.get('/analytics/orders', (_req, res) => {
  const totalOrders = orders.length;
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  res.json({ totalOrders, totalRevenue });
});

router.get('/analytics/restaurant', (_req, res) => {
  const tables = orders.map(o => o.table).filter(t => t);
  const uniqueTables = new Set(tables);
  const tableTurnover = uniqueTables.size
    ? parseFloat((orders.length / uniqueTables.size).toFixed(2))
    : 0;

  const paymentTimes = payments
    .map(p => {
      const order = orders.find(o => o.id === p.order_id);
      if (!order) return null;
      return new Date(p.created_at) - new Date(order.created_at);
    })
    .filter(t => t !== null);
  const avgPaymentTimeMinutes = paymentTimes.length
    ? Math.round(
        paymentTimes.reduce((a, b) => a + b, 0) /
          paymentTimes.length /
          60000
      )
    : 0;

  const tipPercents = orders
    .filter(o => typeof o.tip === 'number')
    .map(o => o.tip / o.total);
  const avgTipPercent = tipPercents.length
    ? parseFloat(
        ((tipPercents.reduce((a, b) => a + b, 0) / tipPercents.length) * 100).toFixed(2)
      )
    : 0;

  res.json({ tableTurnover, avgPaymentTimeMinutes, avgTipPercent });
});

router.get('/accounting/entries', (_req, res) => {
  const entries = payments.map(p => ({
    date: p.created_at,
    description: `Payment for order ${p.order_id}`,
    amount: p.amount
  }));
  if (_req.query.format === 'csv') {
    const header = 'date,description,amount';
    const rows = entries.map(e => `${e.date},${e.description},${e.amount}`);
    res.setHeader('Content-Type', 'text/csv');
    return res.send([header, ...rows].join('\n'));
  }
  res.json({ entries });
});

module.exports = router;
