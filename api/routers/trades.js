const express = require('express');
const authenticate = require('../middlewares/authenticate');
const { triggerWebhooks } = require('../webhooks');
const collabServer = require('../collabServer');
const { validateTrade } = require('../compliance');
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

// Submit a trade order
router.post('/', async (req, res) => {
  const {
    trade_type,
    notional_amount,
    symbol,
    quantity,
    price,
    side,
   counterparties,
    repo_rate_bps,
    term_days,
    collateral_ref,
    distribution_schedule,
    agent_bank
  } = req.body || {};

  if (
    !trade_type ||
    notional_amount === undefined ||
    price === undefined ||
    !side ||
    !Array.isArray(counterparties) ||
    counterparties.length === 0
  ) {
    return res
      .status(400)
      .json({ message: 'Missing trade_type, notional_amount, price, side or counterparties' });
  }

   const tradeForValidation = {
    ...req.body,
    trade_type,
    notional_amount,
    price,
    side,
    counterparties,
    orgId: req.orgId
  };

  let validation;
  try {
   validation = await validateTrade(tradeForValidation);
  } catch (err) {
    console.error('Compliance check error:', err);
    return res.status(502).json({ message: 'Compliance service failed' });
  }
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const { data: tradeRow, error } = await supabase
    .from('trades')
    .insert([
      {
        trade_type,
        notional_amount,
        symbol,
        quantity,
        price,
        side,
        repo_rate_bps,
        term_days,
        collateral_ref,
        status: 'pending'
      }
    ])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ message: 'Failed to create trade' });
  }

  await supabase
    .from('trade_participants')
    .insert(
      counterparties.map(cp => ({
        trade_id: tradeRow.id,
        counterparty_id: cp,
        role: 'counterparty'
      }))
    );

   const eventPayload = {};
  if (trade_type === 'participation' && distribution_schedule) {
    eventPayload.distribution_schedule = distribution_schedule;
  }
  if (trade_type === 'repo' || trade_type === 'reverse_repo') {
    if (repo_rate_bps !== undefined) eventPayload.repo_rate_bps = repo_rate_bps;
    if (term_days !== undefined) eventPayload.term_days = term_days;
    if (collateral_ref) eventPayload.collateral_ref = collateral_ref;
  }
  if (trade_type === 'syndication_assignment' && agent_bank) {
    eventPayload.agent_bank = agent_bank;
  }
  if (['participation', 'syndication_assignment', 'repo', 'reverse_repo'].includes(trade_type)) {
    await supabase
      .from('trade_events')
      .insert([{ trade_id: tradeRow.id, event_type: trade_type, event_payload: eventPayload }]);
  }

  const trade = {
    id: tradeRow.id,
    trade_type,
    notional_amount,
    symbol,
    quantity,
    price,
    side,
    status: tradeRow.status,
    counterparties,
    created_at: tradeRow.created_at
  };

  await triggerWebhooks('trade.created', { trade, organization_id: req.orgId });
  collabServer.broadcast && collabServer.broadcast({ type: 'trade.created', trade });
  
  res.status(201).json({ trade });
});

// List or filter trades
router.get('/', async (req, res) => {
  const { status, trade_type } = req.query;
  let query = supabase.from('trades');
  if (status) query = query.eq('status', status);
  if (trade_type) query = query.eq('trade_type', trade_type);

  const { data: tradeRows, error } = await query.select('*');
  if (error) {
    return res.status(500).json({ message: 'Failed to list trades' });
  }

  const trades = await Promise.all(
    (tradeRows || []).map(async t => {
      const { data: participants } = await supabase
        .from('trade_participants')
        .eq('trade_id', t.id)
        .select('counterparty_id');
      return {
        ...t,
        counterparties: (participants || []).map(p => p.counterparty_id)
      };
    })
  );

  res.json({ trades });
});

// Finalize a trade
router.post('/:id/settle', async (req, res) => {
  const { id } = req.params;
   const { data: tradeRow } = await supabase
    .from('trades')
    .update({ status: 'settled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (!tradeRow) return res.status(404).json({ message: 'Trade not found' });

  await supabase
    .from('trade_settlements')
    .insert([{ trade_id: id, settlement_date: new Date().toISOString(), status: 'settled' }]);

  const { data: participants } = await supabase
    .from('trade_participants')
    .eq('trade_id', id)
    .select('counterparty_id');

  const trade = {
    ...tradeRow,
    counterparties: (participants || []).map(p => p.counterparty_id)
  };

  await triggerWebhooks('trade.settled', { trade, organization_id: req.orgId });
  collabServer.broadcast && collabServer.broadcast({ type: 'trade.settled', trade });

  res.json({ trade });
});

module.exports = router;
