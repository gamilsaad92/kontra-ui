const express = require('express');
const { getOrders } = require('./orders');
const { getPayments } = require('./payments');
const requireOrg = require('../middlewares/requireOrg');

const clients = [];

function calcMetrics(orgId) {
  const orders = getOrders(orgId);
  const payments = getPayments(orgId);
  const totalOrders = orders.length;
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  return { totalOrders, totalRevenue };
}

function broadcastAnalytics(orgId) {
  const data = `data: ${JSON.stringify(calcMetrics(orgId))}\n\n`;
  clients
    .filter(c => c.orgId === orgId)
    .forEach(c => c.res.write(data));
}

const router = express.Router();

router.use(requireOrg);

router.get('/analytics/orders', (req, res) => {
  const orders = getOrders(req.orgId);
  const payments = getPayments(req.orgId);
  const totalOrders = orders.length;
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  res.json({ totalOrders, totalRevenue });
});

router.get('/analytics/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();
  const client = { res, orgId: req.orgId };
  clients.push(client);
  res.write(`data: ${JSON.stringify(calcMetrics(req.orgId))}\n\n`);
  req.on('close', () => {
    const idx = clients.indexOf(client);
    if (idx !== -1) clients.splice(idx, 1);
  });
});

router.get('/analytics/restaurant', (req, res) => {
  const orders = getOrders(req.orgId);
  const payments = getPayments(req.orgId);
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

router.get('/accounting/entries', (req, res) => {
  const payments = getPayments(req.orgId);
  const entries = payments.map(p => ({
    date: p.created_at,
    description: `Payment for order ${p.order_id}`,
    amount: p.amount
  }));
   if (req.query.format === 'csv') {
    const header = 'date,description,amount';
    const rows = entries.map(e => `${e.date},${e.description},${e.amount}`);
    res.setHeader('Content-Type', 'text/csv');
    return res.send([header, ...rows].join('\n'));
  }
  res.json({ entries });
});

module.exports = { router, broadcastAnalytics };
