const express = require('express');
const authenticate = require('../middlewares/authenticate');
const { triggerWebhooks } = require('../webhooks');
const collabServer = require('../collabServer');
const { validateTrade } = require('../compliance');

const router = express.Router();

const tradesByOrg = {};
let nextTradeId = 1;

router.use(authenticate);
router.use((req, res, next) => {
  const orgId = req.organizationId;
  if (!orgId) {
    return res.status(400).json({ message: 'Missing organization id' });
  }
  req.orgId = orgId;
  next();
});

// Submit a trade order
router.post('/trades', async (req, res) => {
   const { symbol, quantity, price, side, counterparties } = req.body || {};
  if (!symbol || quantity === undefined) {
    return res.status(400).json({ message: 'Missing symbol or quantity' });
  }

  const trade = {
    id: nextTradeId++,
    symbol,
    quantity,
    price,
    side,
    counterparties: counterparties || [],
    orgId: req.orgId,
    status: 'pending',
    created_at: new Date().toISOString()
  };

    let validation;
  try {
    validation = await validateTrade(trade);
  } catch (err) {
    console.error('Compliance check error:', err);
    return res.status(502).json({ message: 'Compliance service failed' });
  }
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const arr = tradesByOrg[req.orgId] || (tradesByOrg[req.orgId] = []);
  arr.push(trade);

  await triggerWebhooks('trade.created', { trade, organization_id: req.orgId });
  // Broadcast to any websocket clients that a trade was created
  collabServer.broadcast && collabServer.broadcast({ type: 'trade.created', trade });
  
  res.status(201).json({ trade });
});

// List or filter trades
router.get('/trades', (req, res) => {
  const { status, symbol } = req.query;
  let trades = tradesByOrg[req.orgId] || [];
  if (status) trades = trades.filter(t => t.status === status);
  if (symbol) trades = trades.filter(t => t.symbol === symbol);
  res.json({ trades });
});

// Finalize a trade
router.post('/trades/:id/settle', async (req, res) => {
  const { id } = req.params;
  const trades = tradesByOrg[req.orgId] || [];
  const trade = trades.find(t => t.id === parseInt(id, 10));
  if (!trade) return res.status(404).json({ message: 'Trade not found' });

  trade.status = 'settled';
  trade.settled_at = new Date().toISOString();

  await triggerWebhooks('trade.settled', { trade, organization_id: req.orgId });
 collabServer.broadcast && collabServer.broadcast({ type: 'trade.settled', trade });
  
  res.json({ trade });
});

module.exports = router;
