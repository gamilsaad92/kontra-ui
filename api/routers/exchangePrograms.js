const express = require('express');
const authenticate = require('../middlewares/authenticate');
const { supabase } = require('../db');

const router = express.Router();

router.use(authenticate);
router.use((req, res, next) => {
  const orgId = req.organizationId;
  if (!orgId) {
    return res.status(400).json({ message: 'Missing organization id' });
  }
  req.orgId = orgId;
  next();
});

function normalizeCollateral(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(/\n|,/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return value;
}

function transformPool(row, groupedOrders) {
  const orders = groupedOrders.get(row.id) || { bids: [], asks: [] };
  const bids = orders.bids.sort((a, b) => b.price - a.price);
  const asks = orders.asks.sort((a, b) => a.price - b.price);
  const highestBid = bids[0]?.price ?? null;
  const lowestAsk = asks[0]?.price ?? null;
  const clearingPrice =
    highestBid !== null && lowestAsk !== null && highestBid >= lowestAsk
      ? (highestBid + lowestAsk) / 2
      : null;

  return {
    ...row,
    collateral: normalizeCollateral(row.collateral),
    order_book: { bids, asks },
    clearing_price: clearingPrice
  };
}

router.get('/mini-cmbs', async (req, res) => {
  let poolQuery = supabase.from('mini_cmbs_pools').eq('organization_id', req.orgId);
  const { data: pools, error } = await poolQuery.select('*');
  if (error) {
    return res.status(500).json({ message: 'Failed to list CMBS pools' });
  }

  const { data: orders } = await supabase
    .from('mini_cmbs_orders')
    .eq('organization_id', req.orgId)
    .select('*');

  const groupedOrders = new Map();
  for (const order of orders || []) {
    const collection = groupedOrders.get(order.pool_id) || { bids: [], asks: [] };
    const side = order.side === 'ask' ? 'asks' : 'bids';
    collection[side].push(order);
    groupedOrders.set(order.pool_id, collection);
  }

  res.json({ pools: (pools || []).map(pool => transformPool(pool, groupedOrders)) });
});

router.post('/mini-cmbs', async (req, res) => {
  const {
    pool_name,
    total_balance,
    coupon_rate,
    structure,
    auction_type,
    collateral
  } = req.body || {};

  if (!pool_name || total_balance === undefined || coupon_rate === undefined) {
    return res
      .status(400)
      .json({ message: 'Missing pool_name, total_balance or coupon_rate' });
  }

  const collateralArray = normalizeCollateral(collateral);
  const { data, error } = await supabase
    .from('mini_cmbs_pools')
    .insert([
      {
        pool_name,
        total_balance,
        coupon_rate,
        structure: structure || null,
        auction_type: auction_type || 'order_book',
        collateral: collateralArray,
        organization_id: req.orgId,
        status: 'open'
      }
    ])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ message: 'Failed to create CMBS pool' });
  }

  res.status(201).json({ pool: transformPool(data, new Map()) });
});

router.post('/mini-cmbs/:id/orders', async (req, res) => {
  const { id } = req.params;
  const { side, price, size } = req.body || {};
  if (!['bid', 'ask'].includes(side) || price === undefined || size === undefined) {
    return res.status(400).json({ message: 'Missing side, price or size' });
  }

  const { data, error } = await supabase
    .from('mini_cmbs_orders')
    .insert([
      {
        pool_id: id,
        side,
        price,
        size,
        organization_id: req.orgId,
        investor_id: req.user?.id || null
      }
    ])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ message: 'Failed to submit order' });
  }

  res.status(201).json({ order: data });
});

function transformParticipation(row, groupedBids) {
  const bids = (groupedBids.get(row.id) || []).sort((a, b) => b.rate - a.rate);
  return {
    ...row,
    bids
  };
}

router.get('/participations', async (req, res) => {
  const { data: listings, error } = await supabase
    .from('loan_participations')
    .eq('organization_id', req.orgId)
    .select('*');
  if (error) {
    return res.status(500).json({ message: 'Failed to list participations' });
  }

  const { data: bids } = await supabase
    .from('loan_participation_bids')
    .eq('organization_id', req.orgId)
    .select('*');

  const groupedBids = new Map();
  for (const bid of bids || []) {
    const collection = groupedBids.get(bid.listing_id) || [];
    collection.push(bid);
    groupedBids.set(bid.listing_id, collection);
  }

  res.json({ participations: (listings || []).map(listing => transformParticipation(listing, groupedBids)) });
});

router.post('/participations', async (req, res) => {
  const { loan_name, available_amount, min_piece, target_yield, notes } = req.body || {};
  if (!loan_name || available_amount === undefined || min_piece === undefined) {
    return res
      .status(400)
      .json({ message: 'Missing loan_name, available_amount or min_piece' });
  }

  const { data, error } = await supabase
    .from('loan_participations')
    .insert([
      {
        loan_name,
        available_amount,
        min_piece,
        target_yield: target_yield ?? null,
        notes: notes || null,
        status: 'open',
        organization_id: req.orgId
      }
    ])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ message: 'Failed to list participation' });
  }

  res.status(201).json({ participation: transformParticipation(data, new Map()) });
});

router.post('/participations/:id/bids', async (req, res) => {
  const { id } = req.params;
  const { bidder, size, rate } = req.body || {};
  if (!bidder || size === undefined || rate === undefined) {
    return res.status(400).json({ message: 'Missing bidder, size or rate' });
  }

  const { data, error } = await supabase
    .from('loan_participation_bids')
    .insert([
      {
        listing_id: id,
        bidder,
        size,
        rate,
        organization_id: req.orgId,
        investor_id: req.user?.id || null
      }
    ])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ message: 'Failed to submit bid' });
  }

  res.status(201).json({ bid: data });
});

function transformToken(row, groupedDistributions) {
  const distributions = (groupedDistributions.get(row.id) || []).sort(
    (a, b) => new Date(b.distribution_date) - new Date(a.distribution_date)
  );
  return {
    ...row,
    distributions
  };
}

router.get('/preferred-equity', async (req, res) => {
  const { data: tokens, error } = await supabase
    .from('preferred_equity_tokens')
    .eq('organization_id', req.orgId)
    .select('*');
  if (error) {
    return res.status(500).json({ message: 'Failed to list preferred equity programs' });
  }

  const { data: distributions } = await supabase
    .from('preferred_equity_distributions')
    .eq('organization_id', req.orgId)
    .select('*');

  const grouped = new Map();
  for (const dist of distributions || []) {
    const collection = grouped.get(dist.token_id) || [];
    collection.push(dist);
    grouped.set(dist.token_id, collection);
  }

  res.json({ tokens: (tokens || []).map(token => transformToken(token, grouped)) });
});

router.post('/preferred-equity', async (req, res) => {
  const {
    token_name,
    project,
    price_per_token,
    total_supply,
    target_irr,
    distribution_frequency,
    waterfall_notes
  } = req.body || {};

  if (!token_name || price_per_token === undefined || total_supply === undefined) {
    return res
      .status(400)
      .json({ message: 'Missing token_name, price_per_token or total_supply' });
  }

  const { data, error } = await supabase
    .from('preferred_equity_tokens')
    .insert([
      {
        token_name,
        project: project || null,
        price_per_token,
        total_supply,
        target_irr: target_irr ?? null,
        distribution_frequency: distribution_frequency || null,
        waterfall_notes: waterfall_notes || null,
        organization_id: req.orgId
      }
    ])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ message: 'Failed to issue preferred equity token' });
  }

  res.status(201).json({ token: transformToken(data, new Map()) });
});

router.post('/preferred-equity/:id/distributions', async (req, res) => {
  const { id } = req.params;
  const { distribution_date, amount, memo } = req.body || {};

  if (!distribution_date || amount === undefined) {
    return res.status(400).json({ message: 'Missing distribution_date or amount' });
  }

  const { data, error } = await supabase
    .from('preferred_equity_distributions')
    .insert([
      {
        token_id: id,
        distribution_date,
        amount,
        memo: memo || null,
        organization_id: req.orgId
      }
    ])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ message: 'Failed to record distribution' });
  }

  res.status(201).json({ distribution: data });
});

module.exports = router;
