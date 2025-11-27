const express = require('express');
const authenticate = require('../middlewares/authenticate');
const { supabase } = require('../db');

const router = express.Router();

const DEFAULT_STABLECOIN = {
  token: 'USDC',
  network: 'Base',
  contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

function normalizeEntry(raw) {
  if (!raw) return raw;

  const payoutFrequency = raw.payout_frequency || raw.metadata?.payoutFrequency || 'monthly';
  const expectedApy =
    raw.expected_apy !== undefined && raw.expected_apy !== null
      ? Number(raw.expected_apy)
      : raw.metadata?.expectedApy !== undefined
        ? Number(raw.metadata.expectedApy)
        : null;

  const settlementType = raw.settlement_type || raw.metadata?.settlementType || 'p2p';
  const stablecoin = raw.stablecoin || raw.metadata?.stablecoin || DEFAULT_STABLECOIN.token;
  const walletAddress = raw.wallet_address || raw.metadata?.walletAddress || null;
  const ammPoolId = raw.amm_pool || raw.metadata?.ammPoolId || null;

  const quantity = Number(raw.quantity || 0);
  const price = Number(raw.price || 0);
  const notionalValue = quantity * price;

  return {
    id: raw.id,
    type: raw.type,
    symbol: raw.symbol,
    quantity,
    price,
    status: raw.status || 'open',
    loanId: raw.loan_id || raw.symbol,
    loanName: raw.loan_name || raw.metadata?.loanName || raw.symbol,
    expectedApy,
    payoutFrequency,
    settlementType,
    ammPoolId,
    stablecoinPayment: {
      ...DEFAULT_STABLECOIN,
      token: stablecoin,
      destination: walletAddress,
      settlementType,
    },
    notionalValue,
    distributionPlan: {
      strategy: 'pro-rata',
      autopay: true,
      schedule: payoutFrequency,
      oracle: raw.metadata?.yieldOracle || 'loanPaymentFeed',
      destination: walletAddress,
    },
    metadata: raw.metadata || {},
  };
}

router.use(authenticate);

// List all marketplace entries
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('trade_marketplace')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    return res.status(500).json({ message: 'Failed to list marketplace entries' });
  }
  const entries = (data || []).map(normalizeEntry);
  res.json({ entries });
});

// Submit a bid or ask
router.post('/', async (req, res) => {
  const {
    type,
    symbol,
    quantity,
    price,
    loanId,
    loanName,
    expectedApy,
    settlementType = 'p2p',
    stablecoin = DEFAULT_STABLECOIN.token,
    walletAddress,
    payoutFrequency = 'monthly',
    ammPoolId,
    baseYield,
  } = req.body || {};

  if (!['bid', 'ask'].includes(type) || !symbol) {
    return res.status(400).json({ message: 'Missing type or symbol for marketplace order' });
  }
  
  if (quantity === undefined || price === undefined) {
    return res.status(400).json({ message: 'Quantity and price are required for marketplace order' });
  }

  if (Number(quantity) <= 0 || Number(price) <= 0) {
    return res.status(400).json({ message: 'Quantity and price must be positive' });
  }

  const { data, error } = await supabase
    .from('trade_marketplace')
    .insert([
      {
        type,
        symbol,
        quantity,
        price,
        investor_id: req.user.id,
        loan_id: loanId || symbol,
        loan_name: loanName || symbol,
        expected_apy: expectedApy,
        settlement_type: settlementType,
        stablecoin,
        wallet_address: walletAddress,
        payout_frequency: payoutFrequency,
        amm_pool: ammPoolId,
        metadata: {
          baseYield,
          settlementType,
          stablecoin,
          walletAddress,
          payoutFrequency,
          ammPoolId,
          expectedApy,
          loanId: loanId || symbol,
          loanName: loanName || symbol,
          yieldOracle: 'loanPaymentFeed',
        },
      },
    ])
    .select()
    .single();
  if (error) {
    return res.status(500).json({ message: 'Failed to create entry' });
  }
   res.status(201).json({ entry: normalizeEntry(data) });
});

router.post('/distribute', async (req, res) => {
  const { loanId, paymentAmount, holders = [], memo } = req.body || {};

  if (!loanId || paymentAmount === undefined || !Array.isArray(holders) || holders.length === 0) {
    return res.status(400).json({ message: 'Loan ID, payment amount, and holders are required' });
  }

  const totalOwnership = holders.reduce((sum, h) => sum + Number(h.ownership || 0), 0) || 1;
  const amount = Number(paymentAmount);

  const distributions = holders.map(holder => ({
    wallet: holder.wallet,
    ownership: Number(holder.ownership || 0),
    amount: Number(((Number(holder.ownership || 0) / totalOwnership) * amount).toFixed(2)),
    stablecoin: DEFAULT_STABLECOIN,
    loanId,
    memo: memo || 'Automated distribution from borrower payment',
  }));

  res.json({
    summary: {
      loanId,
      paymentAmount: amount,
      stablecoin: DEFAULT_STABLECOIN,
      totalRecipients: distributions.length,
    },
    distributions,
  });
});

module.exports = router;
